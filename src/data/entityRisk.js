/**
 * PREDICTED audit-risk scoring for entity-footprint records.
 *
 * Deterministic, inspectable, and labeled: this is an editorial weighting of
 * jurisdiction posture and entity profile — NOT a statistical model and NOT
 * tax advice. Every surface that renders the score prefixes it PREDICTED,
 * and explainRisk() exposes the four component scores so a reviewer can see
 * exactly why an entity scored what it did.
 *
 *   riskScore = clamp(round(0.35·audit + 0.20·map + 0.20·safeHarbour + 0.25·role), 0, 100)
 *
 *   audit        jurisdiction audit intensity: low 10 · moderate 40 · high 70
 *                · very-high 95 · unknown 35
 *   map          MAP congestion: min(100, mapAvgMonthsTp × 2) · unknown 30
 *   safeHarbour  proximity of full GloBE computation: expired/none 80 ·
 *                ≤180d 65 · ≤365d 45 · >365d 20 · not a GloBE jurisdiction 50
 *   role         entity profile: 20 base · +30 ipOwner · +25 financing ·
 *                +15 principal or ip-owner role · capped 100
 */

export const RISK_WEIGHTS = Object.freeze({
  audit: 0.35,
  map: 0.20,
  safeHarbour: 0.20,
  role: 0.25,
});

export const RISK_BANDS = Object.freeze([
  Object.freeze({ band: 'low', maxScore: 24, color: '#3ddc84' }),
  Object.freeze({ band: 'moderate', maxScore: 49, color: '#ffd166' }),
  Object.freeze({ band: 'high', maxScore: 74, color: '#ff8c42' }),
  Object.freeze({ band: 'very-high', maxScore: 100, color: '#ff4d4d' }),
]);

const AUDIT_SCORES = Object.freeze({
  low: 10,
  moderate: 40,
  high: 70,
  'very-high': 95,
});

function auditComponent(auditIntensity) {
  return AUDIT_SCORES[auditIntensity] ?? 35;
}

function mapComponent(mapAvgMonthsTp) {
  const months = Number(mapAvgMonthsTp);
  return Number.isFinite(months) ? Math.min(100, months * 2) : 30;
}

function safeHarbourComponent(daysToSafeHarbourEnd) {
  // Explicit null/undefined first: Number(null) is 0, which would read a
  // non-GloBE jurisdiction as "safe harbour expired" — the exact opposite.
  if (daysToSafeHarbourEnd === null || daysToSafeHarbourEnd === undefined) return 50;
  const days = Number(daysToSafeHarbourEnd);
  if (!Number.isFinite(days)) return 50;
  if (days <= 0) return 80;
  if (days <= 180) return 65;
  if (days <= 365) return 45;
  return 20;
}

function roleComponent(entity) {
  let score = 20;
  if (entity?.ipOwner === true) score += 30;
  if (entity?.financing === true) score += 25;
  if (entity?.role === 'principal' || entity?.role === 'ip-owner') score += 15;
  return Math.min(100, score);
}

/**
 * The four component scores for one enriched footprint entity.
 * @param {object} entity Enriched entity (jurisdiction attributes joined in).
 * @returns {{audit: number, map: number, safeHarbour: number, role: number}}
 */
export function explainRisk(entity) {
  return {
    audit: auditComponent(entity?.auditIntensity),
    map: mapComponent(entity?.mapAvgMonthsTp),
    safeHarbour: safeHarbourComponent(entity?.daysToSafeHarbourEnd),
    role: roleComponent(entity),
  };
}

/**
 * The PREDICTED risk score, 0–100.
 * @param {object} entity Enriched footprint entity.
 * @returns {number}
 */
export function riskScore(entity) {
  const parts = explainRisk(entity);
  const weighted = RISK_WEIGHTS.audit * parts.audit
    + RISK_WEIGHTS.map * parts.map
    + RISK_WEIGHTS.safeHarbour * parts.safeHarbour
    + RISK_WEIGHTS.role * parts.role;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

/**
 * Band for a score.
 * @param {number} score 0–100.
 * @returns {'low'|'moderate'|'high'|'very-high'}
 */
export function riskBand(score) {
  for (const entry of RISK_BANDS) {
    if (score <= entry.maxScore) return entry.band;
  }
  return 'very-high';
}

/**
 * Stem/point color for a band; null for unknown bands (layer base color).
 * @param {string} band
 * @returns {string|null}
 */
export function riskBandColor(band) {
  const entry = RISK_BANDS.find((candidate) => candidate.band === band);
  return entry ? entry.color : null;
}
