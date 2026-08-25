import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RISK_BANDS,
  RISK_WEIGHTS,
  explainRisk,
  riskBand,
  riskBandColor,
  riskScore,
} from './entityRisk.js';

test('the formula table holds for representative entities', () => {
  // IP owner in a very-high-audit jurisdiction with congested MAP and an
  // imminent safe-harbour end — the textbook worst case.
  const hot = {
    role: 'ip-owner', ipOwner: true, financing: false,
    auditIntensity: 'very-high', mapAvgMonthsTp: 46, daysToSafeHarbourEnd: 120,
  };
  assert.deepEqual(explainRisk(hot), { audit: 95, map: 92, safeHarbour: 65, role: 65 });
  // 0.35·95 + 0.20·92 + 0.20·65 + 0.25·65 = 33.25 + 18.4 + 13 + 16.25 = 80.9 → 81
  assert.equal(riskScore(hot), 81);
  assert.equal(riskBand(81), 'very-high');

  // Plain distributor in a low-audit jurisdiction, no GloBE.
  const quiet = {
    role: 'distributor', ipOwner: false, financing: false,
    auditIntensity: 'low', mapAvgMonthsTp: 26, daysToSafeHarbourEnd: null,
  };
  assert.deepEqual(explainRisk(quiet), { audit: 10, map: 52, safeHarbour: 50, role: 20 });
  // 3.5 + 10.4 + 10 + 5 = 28.9 → 29
  assert.equal(riskScore(quiet), 29);
  assert.equal(riskBand(29), 'moderate');
});

test('unknown inputs take the documented neutral defaults, never NaN', () => {
  assert.deepEqual(explainRisk({}), { audit: 35, map: 30, safeHarbour: 50, role: 20 });
  assert.deepEqual(explainRisk(null), { audit: 35, map: 30, safeHarbour: 50, role: 20 });
  assert.ok(Number.isFinite(riskScore({})));
});

test('band edges and colors are exact', () => {
  assert.equal(riskBand(0), 'low');
  assert.equal(riskBand(24), 'low');
  assert.equal(riskBand(25), 'moderate');
  assert.equal(riskBand(49), 'moderate');
  assert.equal(riskBand(50), 'high');
  assert.equal(riskBand(74), 'high');
  assert.equal(riskBand(75), 'very-high');
  assert.equal(riskBand(100), 'very-high');
  assert.equal(riskBandColor('low'), '#3ddc84');
  assert.equal(riskBandColor('very-high'), '#ff4d4d');
  assert.equal(riskBandColor('nope'), null);
});

test('components saturate instead of overflowing', () => {
  const stacked = explainRisk({
    role: 'ip-owner', ipOwner: true, financing: true,
    auditIntensity: 'very-high', mapAvgMonthsTp: 500, daysToSafeHarbourEnd: -10,
  });
  assert.equal(stacked.map, 100);
  assert.equal(stacked.role, 90, '20+30+25+15 stays under the 100 cap here');
  assert.equal(stacked.safeHarbour, 80, 'expired reads as the maximum proximity');
  assert.ok(riskScore({
    role: 'ip-owner', ipOwner: true, financing: true,
    auditIntensity: 'very-high', mapAvgMonthsTp: 500, daysToSafeHarbourEnd: -10,
  }) <= 100);
});

test('weights sum to 1 and bands cover 0..100 in order', () => {
  const total = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const maxes = RISK_BANDS.map((b) => b.maxScore);
  assert.deepEqual(maxes, [...maxes].sort((a, b) => a - b));
  assert.equal(maxes[maxes.length - 1], 100);
});

test('determinism: identical input, identical score', () => {
  const entity = { role: 'finance', financing: true, auditIntensity: 'high', mapAvgMonthsTp: 30, daysToSafeHarbourEnd: 400 };
  assert.equal(riskScore(entity), riskScore({ ...entity }));
});
