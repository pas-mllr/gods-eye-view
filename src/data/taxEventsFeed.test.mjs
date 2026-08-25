import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EVENT_LON_OFFSET,
  aggregateTaxEventPoints,
  eventDecayAlpha,
  mapTaxEventAnalystRecord,
  normalizeTaxEventArticles,
} from './taxEventsFeed.js';
import { buildJurisdictionIndex, indexByCountryName } from './taxJurisdictionIndex.js';
import { ANALYST_LAYERS } from './analystEngine.js';

const NOW = Date.UTC(2026, 7, 25, 12);
const TP_TEXT = fs.readFileSync(new URL('./local_data/tax_advisory/tp_radar.geojsonl', import.meta.url), 'utf8');
const DISPUTES_TEXT = fs.readFileSync(new URL('./local_data/tax_advisory/tax_disputes.geojsonl', import.meta.url), 'utf8');

const GDELT_FIXTURE = {
  articles: [
    { title: 'Germany announces transfer pricing audit wave', url: 'https://news.example/de-audit', domain: 'news.example', seendate: '20260825T090000Z', sourcecountry: 'Germany' },
    { title: 'Germany  announces   transfer pricing audit wave', url: 'https://news.example/de-audit', seendate: '20260825T091500Z', sourcecountry: 'Germany' },
    { title: 'Bundestag debates Pillar Two guidance', url: 'https://other.example/de-p2', domain: 'other.example', seendate: '20260824T120000Z', sourcecountry: 'Germany' },
    { title: 'IRS updates APA procedures', url: 'https://us.example/apa', seendate: '20260825T080000Z', sourcecountry: 'United States' },
    { title: 'Unsafe protocol', url: 'javascript:alert(1)', sourcecountry: 'Germany' },
    { title: 'No place to land', url: 'https://nowhere.example/story', seendate: '20260825T070000Z', sourcecountry: 'Atlantis' },
    { title: '', url: 'https://empty.example/x', sourcecountry: 'Germany' },
  ],
};

test('normalizeTaxEventArticles keeps safe, deduped, timestamped rows', () => {
  const articles = normalizeTaxEventArticles(GDELT_FIXTURE);
  assert.equal(articles.length, 4, 'dedupe by url, drop unsafe and titleless rows');
  assert.equal(articles[0].url, 'https://news.example/de-audit');
  assert.equal(articles[0].timeMs, Date.UTC(2026, 7, 25, 9));
  assert.equal(articles[0].sourceCountry, 'Germany');
  assert.equal(normalizeTaxEventArticles(null).length, 0);
  assert.equal(normalizeTaxEventArticles({ articles: 'nope' }).length, 0);
});

test('aggregation lands on real bundled anchors with the mirror-side offset', () => {
  const nameIndex = indexByCountryName(buildJurisdictionIndex(TP_TEXT, DISPUTES_TEXT));
  const { points, unmatchedCount } = aggregateTaxEventPoints(
    normalizeTaxEventArticles(GDELT_FIXTURE), nameIndex, NOW,
  );
  assert.equal(unmatchedCount, 1, 'Atlantis is counted, never silently dropped');
  assert.deepEqual(points.map((p) => p.iso2), ['DE', 'US'], 'sorted by article count');

  const germany = points[0];
  assert.equal(germany.articleCount, 2);
  assert.equal(germany.latestTimeMs, Date.UTC(2026, 7, 25, 9));
  assert.ok(Math.abs(germany.ageHours - 3) < 1e-9);
  assert.equal(germany.articles.length, 2);

  const tpGermany = TP_TEXT.split('\n').map((l) => l.trim() && JSON.parse(l))
    .find((f) => f && f.properties.iso2 === 'DE');
  assert.ok(Math.abs(germany.lon - (tpGermany.geometry.coordinates[0] + EVENT_LON_OFFSET)) < 1e-9,
    'event pin sits on the mirror side of the TP stem');
  assert.equal(germany.lat, tpGermany.geometry.coordinates[1]);
});

test('country aliases resolve GDELT naming to dataset jurisdictions', () => {
  const nameIndex = indexByCountryName(buildJurisdictionIndex(TP_TEXT, DISPUTES_TEXT));
  for (const [alias, iso2] of [
    ['united states', 'US'], ['united kingdom', 'GB'], ['south korea', 'KR'],
    ['czechia', 'CZ'], ['türkiye', 'TR'], ['hong kong', 'HK'], ['vietnam', 'VN'],
  ]) {
    assert.equal(nameIndex.get(alias)?.iso2, iso2, `alias ${alias}`);
  }
});

test('the jurisdiction index joins both datasets and survives junk lines', () => {
  const index = buildJurisdictionIndex(TP_TEXT, DISPUTES_TEXT);
  assert.equal(index.size, 51);
  const germany = index.get('DE');
  assert.equal(germany.citRate, 29.9);
  assert.equal(germany.auditIntensity, 'very-high', 'disputes attributes joined in');
  assert.equal(germany.pillarTwoStatus, 'enacted');
  assert.ok(Number.isFinite(germany.mapInventoryTp));

  const junky = buildJurisdictionIndex('not-json\n' + TP_TEXT.split('\n')[0], '');
  assert.equal(junky.size, 1, 'malformed lines shrink the index, never throw');
});

test('decay alpha is bounded, monotonic, and static math', () => {
  assert.equal(eventDecayAlpha(0), 1);
  assert.ok(eventDecayAlpha(36) > eventDecayAlpha(48));
  assert.equal(eventDecayAlpha(72), 0.15);
  assert.equal(eventDecayAlpha(500), 0.15, 'floors so stale pins stay visible');
  assert.equal(eventDecayAlpha(null), 0.5, 'unknown age is mid-faded, not invisible');
});

test('the event analyst mapper emits every ANALYST_LAYERS field (drift guard)', () => {
  const schema = ANALYST_LAYERS['tax-events'];
  assert.ok(schema, 'tax-events is declared in ANALYST_LAYERS');
  const record = mapTaxEventAnalystRecord({
    iso2: 'DE', name: 'Germany', lat: 52.52, lon: 13.055,
    articleCount: 2, ageHours: 3.04, articles: [{ title: 'Audit wave' }],
  });
  const keys = new Set(Object.keys(record));
  for (const field of [...schema.numeric, ...schema.text, ...schema.flags]) {
    assert.ok(keys.has(field), `mapper emits ${field}`);
  }
  assert.equal(record.ageHours, 3, 'age rounds to one decimal');
  assert.equal(record.latestTitle, 'Audit wave');
  assert.equal(mapTaxEventAnalystRecord(null), null);
});
