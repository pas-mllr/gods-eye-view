import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ANALYST_LAYERS } from './analystEngine.js';
import { mapTpAnalystRecord, mapDisputesAnalystRecord } from './taxAnalystRecords.js';

// The layer module itself carries Vite `?url` asset imports, so these tests
// read the bundled datasets straight from disk (the same pattern
// firstRunExperience.test.mjs uses for source-file pins) and exercise the
// pure mappers from taxAnalystRecords.js.

function readDataset(file) {
  const raw = fs.readFileSync(
    new URL(`./local_data/tax_advisory/${file}`, import.meta.url),
    'utf8',
  );
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    let feature;
    try {
      feature = JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1} is not valid JSON: ${error.message}`);
    }
    return feature;
  });
}

const TP = readDataset('tp_radar.geojsonl');
const DISPUTES = readDataset('tax_disputes.geojsonl');
const AUDIT_INTENSITIES = new Set(['low', 'moderate', 'high', 'very-high']);
const APA_VALUES = new Set(['none', 'unilateral', 'unilateral+bilateral']);

function assertPointGeometry(feature, file) {
  assert.equal(feature.type, 'Feature', `${file}: every line is a Feature`);
  assert.equal(feature.geometry?.type, 'Point', `${file}: every geometry is a Point`);
  const [lon, lat] = feature.geometry.coordinates || [];
  assert.ok(Number.isFinite(lon) && lon >= -180 && lon <= 180, `${file}: finite lon in range (${feature.id})`);
  assert.ok(Number.isFinite(lat) && lat >= -90 && lat <= 90, `${file}: finite lat in range (${feature.id})`);
}

function assertNumberOrNull(value, label) {
  assert.ok(value === null || Number.isFinite(value), `${label} is a finite number or null`);
}

test('tax datasets: valid point features with the shared jurisdiction contract', () => {
  assert.ok(TP.length >= 40, 'TP Radar covers at least 40 jurisdictions');
  assert.equal(TP.length, DISPUTES.length, 'both files cover the same number of jurisdictions');

  for (const [file, features] of [['tp_radar.geojsonl', TP], ['tax_disputes.geojsonl', DISPUTES]]) {
    const seen = new Set();
    for (const feature of features) {
      assertPointGeometry(feature, file);
      const props = feature.properties;
      assert.ok(props && typeof props === 'object', `${file}: properties present`);
      assert.ok(typeof props.name === 'string' && props.name.trim(), `${file}: name present`);
      assert.match(props.iso2, /^[A-Z]{2}$/, `${file}: iso2 is two uppercase letters (${props.name})`);
      assert.match(props.iso3, /^[A-Z]{3}$/, `${file}: iso3 is three uppercase letters (${props.name})`);
      assert.ok(typeof props.asOf === 'string' && props.asOf.trim(), `${file}: asOf present (${props.name})`);
      assert.ok(typeof props.sourceNote === 'string' && props.sourceNote.trim(), `${file}: sourceNote present (${props.name})`);
      assert.ok(!seen.has(props.iso2), `${file}: iso2 unique (${props.iso2})`);
      seen.add(props.iso2);
    }
  }

  const tpSet = new Set(TP.map((f) => f.properties.iso2));
  const disputesSet = new Set(DISPUTES.map((f) => f.properties.iso2));
  assert.deepEqual([...tpSet].sort(), [...disputesSet].sort(),
    'the two files cover the identical jurisdiction set');
});

test('tax datasets: TP records are typed and internally consistent', () => {
  for (const feature of TP) {
    const p = feature.properties;
    for (const flag of ['tpDocRequired', 'masterFileRequired', 'localFileRequired', 'cbcrRequired', 'apaBilateral', 'mapAvailable']) {
      assert.equal(typeof p[flag], 'boolean', `${p.name}: ${flag} is boolean`);
    }
    assertNumberOrNull(p.cbcrThresholdEur, `${p.name}: cbcrThresholdEur`);
    assert.ok(Number.isFinite(p.citRate) && p.citRate >= 0 && p.citRate <= 60, `${p.name}: plausible citRate`);
    assert.ok(APA_VALUES.has(p.apa), `${p.name}: apa is a known value`);
    assert.equal(p.apaBilateral, p.apa === 'unilateral+bilateral',
      `${p.name}: apaBilateral matches the apa enum`);
    assert.ok(typeof p.tpDeadline === 'string' && p.tpDeadline.trim(), `${p.name}: tpDeadline present`);
    assert.ok(typeof p.tpPenaltyNote === 'string' && p.tpPenaltyNote.trim(), `${p.name}: tpPenaltyNote present`);
    assert.ok(typeof p.oecdAlignment === 'string' && p.oecdAlignment.trim(), `${p.name}: oecdAlignment present`);
    assert.equal(p.tpDocRequired, p.masterFileRequired || p.localFileRequired,
      `${p.name}: tpDocRequired is the MF/LF union`);
  }
});

test('tax datasets: disputes records are typed and the audit rating is a known enum', () => {
  for (const feature of DISPUTES) {
    const p = feature.properties;
    for (const field of ['mapInventoryTp', 'mapNewCasesTp', 'mapAvgMonthsTp', 'mapAvgMonthsOther', 'treatyCount', 'whtDividendPct', 'whtInterestPct', 'whtRoyaltyPct']) {
      assertNumberOrNull(p[field], `${p.name}: ${field}`);
    }
    assert.ok(AUDIT_INTENSITIES.has(p.auditIntensity), `${p.name}: auditIntensity is a known rating`);
    assert.ok(typeof p.auditFocus === 'string' && p.auditFocus.trim(), `${p.name}: auditFocus present`);
    for (const flag of ['arbitrationAvailable', 'icapMember', 'mliSigned', 'participationExemption']) {
      assert.equal(typeof p[flag], 'boolean', `${p.name}: ${flag} is boolean`);
    }
  }
});

test('tax datasets: disputes anchors sit +0.35° longitude from the TP anchors', () => {
  // Documented in the dataset README: the offset keeps both layers' stems
  // individually clickable when they are enabled together.
  const tpByIso = new Map(TP.map((f) => [f.properties.iso2, f.geometry.coordinates]));
  for (const feature of DISPUTES) {
    const [dLon, dLat] = feature.geometry.coordinates;
    const [tLon, tLat] = tpByIso.get(feature.properties.iso2);
    assert.ok(Math.abs(dLon - (tLon + 0.35)) < 1e-6, `${feature.properties.name}: lon offset`);
    assert.ok(Math.abs(dLat - tLat) < 1e-6, `${feature.properties.name}: same lat`);
  }
});

test('analyst mappers produce every field ANALYST_LAYERS declares (drift guard)', () => {
  const cases = [
    ['local-tp-radar', mapTpAnalystRecord, TP[0].properties],
    ['local-tax-disputes', mapDisputesAnalystRecord, DISPUTES[0].properties],
  ];
  for (const [layerKey, mapper, props] of cases) {
    const schema = ANALYST_LAYERS[layerKey];
    assert.ok(schema, `${layerKey} is declared in ANALYST_LAYERS`);
    const record = mapper(props, { id: 'x', lat: 1, lon: 2 });
    const keys = new Set(Object.keys(record));
    for (const field of [...schema.numeric, ...schema.text, ...schema.flags]) {
      assert.ok(keys.has(field), `${layerKey}: mapper emits schema field ${field}`);
    }
    for (const field of ['id', 'lat', 'lon']) {
      assert.ok(keys.has(field), `${layerKey}: mapper emits engine identity field ${field}`);
    }
  }
});

test('analyst mappers coerce types and keep nulls null', () => {
  const tp = mapTpAnalystRecord(
    { name: ' Germany ', iso2: 'DE', citRate: '29.9', cbcrThresholdEur: null, cbcrRequired: true, apa: 'unilateral+bilateral' },
    { id: 'tp-DE', lat: 52.52, lon: 13.405 },
  );
  assert.equal(tp.id, 'Germany');
  assert.equal(tp.name, 'Germany');
  assert.equal(tp.citRate, 29.9);
  assert.equal(tp.cbcrThresholdEur, null);
  assert.equal(tp.cbcrRequired, true);
  assert.equal(tp.masterFileRequired, null, 'absent flags stay null so filters drop them');

  const disputes = mapDisputesAnalystRecord(
    { name: 'Germany', mapInventoryTp: '420', whtDividendPct: 26.375, mliSigned: true, auditIntensity: 'very-high' },
    { id: 'disp-DE', lat: 52.52, lon: 13.755 },
  );
  assert.equal(disputes.mapInventoryTp, 420);
  assert.equal(disputes.whtDividendPct, 26.375);
  assert.equal(disputes.mliSigned, true);
  assert.equal(disputes.auditIntensity, 'very-high');
  assert.equal(disputes.treatyCount, null);

  assert.equal(mapTpAnalystRecord(null), null);
  assert.equal(mapDisputesAnalystRecord(undefined), null);
});

test('tax datasets: dated policy states are typed, enum-valid, and internally consistent', () => {
  const P2 = new Set(['enacted', 'qdmtt-only', 'draft', 'announced', 'none']);
  const EI = new Set(['none', 'announced', 'voluntary', 'mandatory']);
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const dateOrNull = (value, label) => {
    assert.ok(value === null || ISO_DATE.test(value), `${label} is YYYY-MM-DD or null`);
  };
  for (const feature of TP) {
    const p = feature.properties;
    assert.ok(P2.has(p.pillarTwoStatus), `${p.name}: pillarTwoStatus is a known status`);
    assert.ok(EI.has(p.eInvoicingPhase), `${p.name}: eInvoicingPhase is a known phase`);
    dateOrNull(p.safeHarbourUntil, `${p.name}: safeHarbourUntil`);
    dateOrNull(p.eInvoicingFrom, `${p.name}: eInvoicingFrom`);
    dateOrNull(p.girNextDeadline, `${p.name}: girNextDeadline`);
    const globeAdopter = p.pillarTwoStatus === 'enacted' || p.pillarTwoStatus === 'qdmtt-only';
    assert.equal(p.safeHarbourUntil !== null, globeAdopter,
      `${p.name}: safe-harbour date tracks GloBE adoption`);
    assert.equal(p.girNextDeadline !== null, globeAdopter,
      `${p.name}: GIR deadline tracks GloBE adoption`);
    if (p.eInvoicingFrom !== null) {
      assert.notEqual(p.eInvoicingPhase, 'none',
        `${p.name}: a dated e-invoicing mandate cannot have phase none`);
    }
  }
});

test('tp analyst mapper derives daysToGirDeadline from an injectable clock', () => {
  const NOW = Date.UTC(2026, 7, 25);
  const record = mapTpAnalystRecord(
    { name: 'Germany', girNextDeadline: '2027-03-31', citRate: 29.9 },
    { id: 'tp-DE', lat: 52.52, lon: 13.405, nowMs: NOW },
  );
  assert.equal(record.daysToGirDeadline, 218);
  assert.equal(record.girNextDeadline, '2027-03-31');
  assert.equal(record.citRateSource, 'bundled', 'bundled is the default provenance');

  const none = mapTpAnalystRecord({ name: 'United States' }, { nowMs: NOW });
  assert.equal(none.daysToGirDeadline, null);
  assert.equal(none.pillarTwoStatus, null);
});

test('OECD live-merge patches carry values and provenance, and refuse bad feeds', async () => {
  const { applyOecdToTpRecord, applyOecdToDisputesRecord } = await import('./taxAnalystRecords.js');
  const payload = {
    cit: { status: 'ready', period: '2025', byIso3: { DEU: 29.83 } },
    map: { status: 'ready', period: '2024', byIso3: { DEU: 415 } },
  };
  assert.deepEqual(applyOecdToTpRecord({ iso3: 'DEU' }, payload), {
    citRate: 29.83, citRateSource: 'oecd-live', citRateAsOf: '2025',
  });
  assert.deepEqual(applyOecdToDisputesRecord({ iso3: 'DEU' }, payload), {
    mapInventoryTp: 415, mapStatsSource: 'oecd-live', mapStatsAsOf: '2024',
  });
  // Areas the feed does not cover, unavailable feeds, and junk stay bundled.
  assert.equal(applyOecdToTpRecord({ iso3: 'BRA' }, payload), null);
  assert.equal(applyOecdToTpRecord({ iso3: 'DEU' }, { cit: { status: 'unavailable', byIso3: {} } }), null);
  assert.equal(applyOecdToTpRecord({ iso3: 'DEU' }, null), null);
  assert.equal(
    applyOecdToTpRecord({ iso3: 'DEU' }, { cit: { status: 'ready', byIso3: { DEU: 'oops' } } }),
    null,
  );
});
