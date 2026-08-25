import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EINVOICING_PHASES,
  PILLAR_TWO_STATUSES,
  URGENCY_BANDS,
  daysUntil,
  deadlineUrgency,
  nearestObligation,
  obligationCardLine,
  parseIsoDate,
} from './taxPolicy.js';

const NOW = Date.UTC(2026, 7, 25); // 2026-08-25T00:00Z — a fixed clock, never Date.now()

test('parseIsoDate accepts only real YYYY-MM-DD dates', () => {
  assert.equal(parseIsoDate('2026-06-30'), Date.UTC(2026, 5, 30));
  assert.equal(parseIsoDate('2026-02-31'), null, 'rolled-over dates are rejected');
  assert.equal(parseIsoDate('2026-6-30'), null, 'unpadded dates are rejected');
  assert.equal(parseIsoDate('30-06-2026'), null);
  assert.equal(parseIsoDate(''), null);
  assert.equal(parseIsoDate(null), null);
  assert.equal(parseIsoDate(undefined), null);
  assert.equal(parseIsoDate('2026-06-30T00:00:00Z'), null, 'datetime strings are not dates');
});

test('daysUntil counts whole days and goes negative for the past', () => {
  assert.equal(daysUntil('2026-08-26', NOW), 1);
  assert.equal(daysUntil('2026-08-25', NOW), 0);
  assert.equal(daysUntil('2026-08-24', NOW), -1);
  assert.equal(daysUntil('2027-08-25', NOW), 365);
  assert.equal(daysUntil(null, NOW), null);
  assert.equal(daysUntil('2026-08-26', Number.NaN), null);
});

test('nearestObligation picks the earliest dated obligation, past included', () => {
  const nearest = nearestObligation({
    safeHarbourUntil: '2026-12-31',
    eInvoicingFrom: '2026-09-01',
    girNextDeadline: '2026-06-30',
  }, NOW);
  assert.deepEqual(nearest, { kind: 'gir', dateIso: '2026-06-30', days: -56 });

  const onlyOne = nearestObligation({ eInvoicingFrom: '2027-01-01' }, NOW);
  assert.equal(onlyOne.kind, 'e-invoicing');

  assert.equal(nearestObligation({}, NOW), null);
  assert.equal(nearestObligation(null, NOW), null);
  assert.equal(nearestObligation({ safeHarbourUntil: 'not-a-date' }, NOW), null);
});

test('deadlineUrgency band edges: day 0/90/365 and overdue', () => {
  const at = (days) => {
    const date = new Date(NOW + days * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    return deadlineUrgency({ girNextDeadline: iso }, NOW);
  };
  assert.equal(at(-1).band, 'overdue');
  assert.equal(at(-1).color, '#ff4d4d');
  assert.equal(at(0).band, 'imminent', 'due today is imminent, not overdue');
  assert.equal(at(90).band, 'imminent');
  assert.equal(at(91).band, 'upcoming');
  assert.equal(at(365).band, 'upcoming');
  assert.equal(at(365).color, '#ffd166');
  assert.equal(at(366).band, null, 'beyond a year keeps the layer base color');
  assert.equal(at(366).color, null);
  assert.ok(at(366).nearest, 'the obligation itself is still reported');

  const none = deadlineUrgency({}, NOW);
  assert.deepEqual(none, { nearest: null, band: null, color: null });
});

test('obligationCardLine renders compact future and overdue lines', () => {
  assert.equal(
    obligationCardLine({ girNextDeadline: '2026-06-30' }, NOW),
    'GIR due 2026-06-30 · 56d overdue',
  );
  assert.equal(
    obligationCardLine({ eInvoicingFrom: '2026-09-01' }, NOW),
    'E-invoicing from 2026-09-01 · 7d',
  );
  assert.equal(
    obligationCardLine({ safeHarbourUntil: '2026-12-31' }, NOW),
    'Safe harbour ends 2026-12-31 · 128d',
  );
  assert.equal(obligationCardLine({}, NOW), null);
});

test('enums and bands are frozen and ordered most-urgent-first', () => {
  assert.ok(Object.isFrozen(PILLAR_TWO_STATUSES));
  assert.ok(Object.isFrozen(EINVOICING_PHASES));
  assert.ok(PILLAR_TWO_STATUSES.includes('enacted') && PILLAR_TWO_STATUSES.includes('none'));
  assert.ok(EINVOICING_PHASES.includes('mandatory'));
  const maxes = URGENCY_BANDS.map((b) => b.maxDays);
  assert.deepEqual(maxes, [...maxes].sort((a, b) => a - b));
});
