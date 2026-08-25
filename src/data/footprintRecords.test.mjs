import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Cesium from 'cesium';
import { ANALYST_LAYERS } from './analystEngine.js';
import { mapFootprintAnalystRecord, mapTaxFlowAnalystRecord } from './footprintRecords.js';
import { normalizeFootprintPack } from './entityFootprintPack.js';
import { buildJurisdictionIndex } from './taxJurisdictionIndex.js';
import { flowArcPositions, FLOW_TYPE_COLORS } from './taxFlowsLayer.js';

const NOW = Date.UTC(2026, 7, 25);
const PACK = normalizeFootprintPack(
  JSON.parse(fs.readFileSync(new URL('../../config/entity_footprint.example.json', import.meta.url), 'utf8')),
  buildJurisdictionIndex(
    fs.readFileSync(new URL('./local_data/tax_advisory/tp_radar.geojsonl', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('./local_data/tax_advisory/tax_disputes.geojsonl', import.meta.url), 'utf8'),
  ),
  { nowMs: NOW },
);

test('footprint and flow mappers emit every ANALYST_LAYERS field (drift guard)', () => {
  const cases = [
    ['entity-footprint', mapFootprintAnalystRecord(PACK.entities[0], { id: 'x' })],
    ['tax-flows', mapTaxFlowAnalystRecord(PACK.flows[0])],
  ];
  for (const [layerKey, record] of cases) {
    const schema = ANALYST_LAYERS[layerKey];
    assert.ok(schema, `${layerKey} declared in ANALYST_LAYERS`);
    assert.ok(record, `${layerKey}: mapper produced a record`);
    const keys = new Set(Object.keys(record));
    for (const field of [...schema.numeric, ...schema.text, ...schema.flags, 'id', 'lat', 'lon']) {
      assert.ok(keys.has(field), `${layerKey}: mapper emits ${field}`);
    }
  }
  assert.equal(mapFootprintAnalystRecord(null), null);
  assert.equal(mapTaxFlowAnalystRecord(null), null);
});

test('footprint records answer the questions the radar promises', () => {
  const records = PACK.entities.map((e) => mapFootprintAnalystRecord(e));
  const ip = records.find((r) => r.role === 'ip-owner');
  assert.ok(ip, 'the demo group has an IP owner');
  assert.equal(ip.ipOwner, true);
  assert.ok(Number.isFinite(ip.riskScore));
  // "Which of our entities sit in very-high audit intensity jurisdictions?"
  const hot = records.filter((r) => r.auditIntensity === 'very-high');
  assert.ok(hot.length >= 1, 'jurisdiction enrichment reaches the analyst record');
});

test('flow records anchor at midpoints with typed, cross-border-aware fields', () => {
  const royalty = PACK.flows.find((f) => f.type === 'royalty');
  const record = mapTaxFlowAnalystRecord(royalty);
  assert.match(record.name, /→/);
  assert.equal(record.flowType, 'royalty');
  assert.equal(record.crossBorder, true);
  assert.ok(Number.isFinite(record.lat) && Number.isFinite(record.lon));
  assert.ok(Number.isFinite(record.annualValueEur));
});

test('flow arcs lift off the ground and land back on the endpoints', () => {
  const flow = PACK.flows.find((f) => f.id === 'goods-cn-ch');
  const positions = flowArcPositions(flow, 64);
  assert.equal(positions.length, 65);

  const heights = positions.map((p) => Cesium.Cartographic.fromCartesian(p).height);
  assert.ok(Math.abs(heights[0]) < 1, 'starts on the ellipsoid');
  assert.ok(Math.abs(heights[heights.length - 1]) < 1, 'ends on the ellipsoid');
  const apex = Math.max(...heights);
  assert.ok(apex >= 30_000 && apex <= 800_000, `apex within the clamp (${Math.round(apex)}m)`);
  const mid = Math.floor(heights.length / 2);
  assert.ok(Math.abs(heights[mid] - apex) < apex * 0.05, 'apex sits mid-arc');
  // Rising then falling — the sin(πt) profile, no sawtooth.
  for (let i = 1; i <= mid; i++) assert.ok(heights[i] >= heights[i - 1] - 1);
  for (let i = mid + 1; i < heights.length; i++) assert.ok(heights[i] <= heights[i - 1] + 1);

  const start = Cesium.Cartographic.fromCartesian(positions[0]);
  assert.ok(Math.abs(Cesium.Math.toDegrees(start.latitude) - flow.fromLat) < 1e-6);
  assert.ok(Math.abs(Cesium.Math.toDegrees(start.longitude) - flow.fromLon) < 1e-6);
});

test('every flow type in the demo pack has a color', () => {
  for (const flow of PACK.flows) {
    assert.ok(FLOW_TYPE_COLORS[flow.type], `color for flow type ${flow.type}`);
  }
});
