import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FLOW_TYPES,
  FOOTPRINT_ROLES,
  footprintEntitiesToGeojsonl,
  normalizeFootprintEntity,
  normalizeFootprintFlow,
  normalizeFootprintPack,
} from './entityFootprintPack.js';
import { buildJurisdictionIndex } from './taxJurisdictionIndex.js';

const NOW = Date.UTC(2026, 7, 25);
const PACK = JSON.parse(fs.readFileSync(new URL('../../config/entity_footprint.example.json', import.meta.url), 'utf8'));
const INDEX = buildJurisdictionIndex(
  fs.readFileSync(new URL('./local_data/tax_advisory/tp_radar.geojsonl', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('./local_data/tax_advisory/tax_disputes.geojsonl', import.meta.url), 'utf8'),
);

test('the shipped demo pack honors the pack contract', () => {
  assert.ok(PACK.disclaimer.toLowerCase().includes('fictional'), 'the demo declares itself fictional');
  assert.match(PACK.group, /FICTIONAL/);
  assert.ok(PACK.entities.length >= 18, 'demo group is a real multinational footprint');
  const ids = new Set(PACK.entities.map((e) => e.id));
  assert.equal(ids.size, PACK.entities.length, 'entity ids unique');
  for (const entity of PACK.entities) {
    assert.match(entity.lei, /^[A-Z0-9]{18}[0-9]{2}$/, `${entity.id}: well-formed LEI`);
    assert.match(entity.jurisdiction, /^[A-Z]{2}$/, `${entity.id}: iso2 jurisdiction`);
    assert.ok(INDEX.has(entity.jurisdiction), `${entity.id}: jurisdiction covered by the radar datasets`);
    assert.ok(FOOTPRINT_ROLES.includes(entity.role), `${entity.id}: known role`);
    if (entity.parentId !== null) assert.ok(ids.has(entity.parentId), `${entity.id}: parent exists`);
  }
  const typesUsed = new Set(PACK.flows.map((f) => f.type));
  for (const type of FLOW_TYPES.filter((t) => t !== 'other')) {
    assert.ok(typesUsed.has(type), `demo exercises flow type ${type}`);
  }
  for (const flow of PACK.flows) {
    assert.ok(ids.has(flow.from) && ids.has(flow.to), `${flow.id}: endpoints exist`);
  }
});

test('normalization enriches the demo pack cleanly — zero warnings', () => {
  const pack = normalizeFootprintPack(PACK, INDEX, { nowMs: NOW });
  assert.deepEqual(pack.warnings, [], 'the shipped demo must normalize without repairs');
  assert.equal(pack.entities.length, PACK.entities.length);
  assert.equal(pack.flows.length, PACK.flows.length);

  const ip = pack.entities.find((e) => e.id === 'aurora-ie-ip');
  assert.equal(ip.jurisdictionName, 'Ireland');
  assert.ok(Number.isFinite(ip.citRate));
  assert.ok(Number.isFinite(ip.daysToSafeHarbourEnd), 'Ireland is a GloBE jurisdiction');
  assert.ok(ip.riskScore >= 0 && ip.riskScore <= 100);
  assert.ok(['low', 'moderate', 'high', 'very-high'].includes(ip.riskBand));
  assert.ok(ip.riskComponents.audit >= 0, 'components ride along for inspectability');

  const royalty = pack.flows.find((f) => f.id === 'roy-ie-ch');
  assert.equal(royalty.fromIso2, 'IE');
  assert.equal(royalty.toIso2, 'CH');
  assert.equal(royalty.crossBorder, true);
  assert.ok(Number.isFinite(royalty.midLat) && Number.isFinite(royalty.midLon));
});

test('bad records are repaired loudly, never silently', () => {
  const raw = {
    entities: [
      { id: 'a', jurisdiction: 'DE', lat: 50, lon: 8, role: 'weird-role', parentId: 'ghost', lei: 'tooshort' },
      { id: 'b', jurisdiction: 'DE', lat: 51, lon: 9, parentId: 'c' },
      { id: 'c', jurisdiction: 'XX', lat: 52, lon: 10, parentId: 'b' },
      { id: 'a', jurisdiction: 'FR', lat: 48, lon: 2 },
      { lat: 1, lon: 1 },
      { id: 'nowhere' },
    ],
    flows: [
      { id: 'f1', from: 'a', to: 'b' },
      { id: 'f1', from: 'a', to: 'c' },
      { id: 'f2', from: 'a', to: 'ghost' },
      { from: 'a', to: 'b' },
    ],
  };
  const pack = normalizeFootprintPack(raw, INDEX, { nowMs: NOW });
  assert.equal(pack.entities.length, 3);
  const a = pack.entities.find((e) => e.id === 'a');
  assert.equal(a.jurisdiction, 'FR', 'last duplicate wins, loudly');
  assert.equal(a.role, 'other', 'unknown roles coerce to other');
  assert.equal(a.lei, null, 'malformed LEIs become null');
  assert.equal(a.parentId, null, 'dangling parent link repaired');
  const b = pack.entities.find((e) => e.id === 'b');
  const c = pack.entities.find((e) => e.id === 'c');
  assert.ok(b.parentId === null || c.parentId === null, 'the b↔c cycle is broken');
  assert.equal(c.citRate, null, 'unknown jurisdiction XX enriches to nulls');
  assert.equal(pack.flows.length, 1, 'duplicate and dangling flows dropped');
  assert.ok(pack.warnings.length >= 6, `every repair is reported (${pack.warnings.length})`);
});

test('entity cap truncates loudly', () => {
  const raw = {
    entities: Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, jurisdiction: 'DE', lat: 50, lon: 8 })),
  };
  const pack = normalizeFootprintPack(raw, INDEX, { nowMs: NOW, maxEntities: 3 });
  assert.equal(pack.entities.length, 3);
  assert.ok(pack.warnings.some((w) => w.includes('cap 3')));
});

test('the GeoJSONL serialization round-trips per line', () => {
  const pack = normalizeFootprintPack(PACK, INDEX, { nowMs: NOW });
  const lines = footprintEntitiesToGeojsonl(pack).split('\n').filter((l) => l.trim());
  assert.equal(lines.length, pack.entities.length);
  const first = JSON.parse(lines[0]);
  assert.equal(first.type, 'Feature');
  assert.equal(first.geometry.type, 'Point');
  assert.equal(first.properties.id, pack.entities[0].id);
  assert.ok(Number.isFinite(first.properties.riskScore));
});

test('entity/flow normalizers reject unusable records', () => {
  assert.equal(normalizeFootprintEntity(null), null);
  assert.equal(normalizeFootprintEntity({ id: 'x' }), null, 'no anchor, no entity');
  assert.equal(normalizeFootprintEntity({ id: 'x', lat: 91, lon: 0 }), null, 'lat out of range');
  assert.equal(normalizeFootprintFlow({ id: 'f', from: 'a' }), null);
  assert.equal(normalizeFootprintFlow({ id: 'f', from: 'a', to: 'b', type: 'nonsense' }).type, 'other');
});
