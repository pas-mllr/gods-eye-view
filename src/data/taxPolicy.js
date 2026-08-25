/**
 * Dated policy-state helpers for the tax advisory layers. Pure and free of
 * Vite/Cesium imports so node:test drives every branch directly.
 *
 * The jurisdiction datasets carry dated obligations (safe-harbour expiry,
 * e-invoicing go-lives, GIR deadlines); these helpers turn them into
 * time-to-event answers and a deadline-urgency rendering policy. Urgency is a
 * RENDERING slant over curated dates, not a prediction — the honesty label
 * stays whatever the underlying dataset carries.
 */

export const PILLAR_TWO_STATUSES = Object.freeze([
  'enacted', 'qdmtt-only', 'draft', 'announced', 'none',
]);

export const EINVOICING_PHASES = Object.freeze([
  'none', 'announced', 'voluntary', 'mandatory',
]);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a strict YYYY-MM-DD date into epoch milliseconds (UTC midnight).
 * @param {unknown} text Candidate date string.
 * @returns {number|null} Epoch ms, or null for anything non-conforming.
 */
export function parseIsoDate(text) {
  const match = ISO_DATE.exec(String(text ?? ''));
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const check = new Date(ms);
  // Reject rollovers like 2026-02-31 that Date.UTC silently normalizes.
  if (check.getUTCFullYear() !== Number(match[1])
    || check.getUTCMonth() !== Number(match[2]) - 1
    || check.getUTCDate() !== Number(match[3])) return null;
  return ms;
}

/**
 * Whole days from now until the date (negative = past).
 * @param {unknown} dateIso YYYY-MM-DD.
 * @param {number} nowMs Reference clock.
 * @returns {number|null}
 */
export function daysUntil(dateIso, nowMs) {
  const ms = parseIsoDate(dateIso);
  if (ms === null || !Number.isFinite(nowMs)) return null;
  return Math.floor((ms - nowMs) / DAY_MS);
}

/**
 * The jurisdiction's nearest dated obligation across the three tracked kinds.
 *
 * Pastness is PER KIND: a mandate that went live years ago is history, not an
 * obligation — without this rule the ~25 jurisdictions whose e-invoicing has
 * been live since 2008–2024 would render permanently "overdue" and drown out
 * the real deadlines this feature exists to surface. Only a recently missed
 * GIR deadline (≤365d — an actionable late filing) counts while past;
 * e-invoicing go-lives and safe-harbour ends must be upcoming.
 *
 * @param {object} props Jurisdiction record properties.
 * @param {number} nowMs Reference clock.
 * @returns {{kind: 'safe-harbour-end'|'e-invoicing'|'gir', dateIso: string, days: number}|null}
 */
export function nearestObligation(props, nowMs) {
  if (!props || typeof props !== 'object') return null;
  const candidates = [
    { kind: 'safe-harbour-end', dateIso: props.safeHarbourUntil, allowPastDays: 0 },
    { kind: 'e-invoicing', dateIso: props.eInvoicingFrom, allowPastDays: 0 },
    { kind: 'gir', dateIso: props.girNextDeadline, allowPastDays: 365 },
  ];
  let best = null;
  for (const candidate of candidates) {
    const days = daysUntil(candidate.dateIso, nowMs);
    if (days === null) continue;
    if (days < -candidate.allowPastDays) continue;
    if (!best || days < best.days) {
      best = { kind: candidate.kind, dateIso: String(candidate.dateIso), days };
    }
  }
  return best;
}

/** Urgency bands and their stem/point colors, most urgent first. */
export const URGENCY_BANDS = Object.freeze([
  Object.freeze({ band: 'overdue', maxDays: -1, color: '#ff4d4d' }),
  Object.freeze({ band: 'imminent', maxDays: 90, color: '#ff8c42' }),
  Object.freeze({ band: 'upcoming', maxDays: 365, color: '#ffd166' }),
]);

/**
 * Deadline-urgency rendering policy for one jurisdiction.
 * @param {object} props Jurisdiction record properties.
 * @param {number} nowMs Reference clock.
 * @returns {{nearest: object|null, band: string|null, color: string|null}}
 *   band/color are null when nothing is due within a year (keep layer base color).
 */
export function deadlineUrgency(props, nowMs) {
  const nearest = nearestObligation(props, nowMs);
  if (!nearest) return { nearest: null, band: null, color: null };
  for (const entry of URGENCY_BANDS) {
    if (nearest.days <= entry.maxDays) {
      return { nearest, band: entry.band, color: entry.color };
    }
  }
  return { nearest, band: null, color: null };
}

const OBLIGATION_LABELS = Object.freeze({
  'safe-harbour-end': 'Safe harbour ends',
  'e-invoicing': 'E-invoicing from',
  gir: 'GIR due',
});

/**
 * One compact card line for the nearest obligation, e.g. "GIR due 2026-06-30 · 128d"
 * (or "· 12d overdue" for past dates).
 * @param {object} props Jurisdiction record properties.
 * @param {number} nowMs Reference clock.
 * @returns {string|null}
 */
export function obligationCardLine(props, nowMs) {
  const nearest = nearestObligation(props, nowMs);
  if (!nearest) return null;
  const label = OBLIGATION_LABELS[nearest.kind] || 'Due';
  const suffix = nearest.days < 0 ? `${-nearest.days}d overdue` : `${nearest.days}d`;
  return `${label} ${nearest.dateIso} · ${suffix}`;
}
