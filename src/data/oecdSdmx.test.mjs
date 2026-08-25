import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractLatestByRefArea, normalizeOecdTaxPayload } from './oecdSdmx.js';

const CIT = JSON.parse(fs.readFileSync(new URL('./fixtures/oecd-sdmx-cit.json', import.meta.url), 'utf8'));
const MAP = JSON.parse(fs.readFileSync(new URL('./fixtures/oecd-sdmx-map.json', import.meta.url), 'utf8'));
const NOW = Date.UTC(2026, 7, 25);

test('extracts the latest observation per REF_AREA from the v2 structures form', () => {
  const byArea = extractLatestByRefArea(CIT);
  assert.deepEqual(byArea.get('DEU'), { value: 29.83, period: '2025' }, 'latest period wins');
  assert.deepEqual(byArea.get('USA'), { value: 21.0, period: '2024' });
  assert.deepEqual(byArea.get('IRL'), { value: 12.5, period: '2025' });
});

test('extracts from the v1 structure form with REF_AREA in any series position', () => {
  const byArea = extractLatestByRefArea(MAP);
  assert.deepEqual(byArea.get('DEU'), { value: 415, period: '2024' });
  assert.deepEqual(byArea.get('IND'), { value: 792, period: '2024' });
});

test('unrecognizable shapes yield an empty map, never a throw', () => {
  assert.equal(extractLatestByRefArea(null).size, 0);
  assert.equal(extractLatestByRefArea({}).size, 0);
  assert.equal(extractLatestByRefArea({ data: { dataSets: [] } }).size, 0);
  // A structure without REF_AREA (wrong dataflow configured) is unavailable.
  const noRefArea = {
    data: {
      structure: { dimensions: { series: [{ id: 'MEASURE', values: [{ id: 'X' }] }], observation: [] } },
      dataSets: [{ series: { 0: { observations: { 0: [1] } } } }],
    },
  };
  assert.equal(extractLatestByRefArea(noRefArea).size, 0);
  // Non-numeric observations are skipped.
  const junkObs = JSON.parse(JSON.stringify(MAP));
  junkObs.data.dataSets[0].series['0:0'].observations = { 0: ['n/a'] };
  assert.equal(extractLatestByRefArea(junkObs).has('DEU'), false);
});

test('normalizeOecdTaxPayload keeps the sub-feeds independently honest', () => {
  const both = normalizeOecdTaxPayload(CIT, MAP, NOW);
  assert.equal(both.retrievedAt, new Date(NOW).toISOString());
  assert.equal(both.cit.status, 'ready');
  assert.equal(both.cit.byIso3.DEU, 29.83);
  assert.equal(both.cit.period, '2025');
  assert.equal(both.map.status, 'ready');
  assert.equal(both.map.byIso3.IND, 792);

  const citOnly = normalizeOecdTaxPayload(CIT, null, NOW);
  assert.equal(citOnly.cit.status, 'ready');
  assert.equal(citOnly.map.status, 'unavailable');
  assert.deepEqual(citOnly.map.byIso3, {});

  const neither = normalizeOecdTaxPayload(null, {}, NOW);
  assert.equal(neither.cit.status, 'unavailable');
  assert.equal(neither.map.status, 'unavailable');
});
