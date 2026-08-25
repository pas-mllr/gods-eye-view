/**
 * Pure normalization for the live tax-events feed. The /api/tax-events proxy
 * (vite.config.js) fetches GDELT DOC 2.0 artlist server-side and runs these
 * helpers so the client never parses GDELT; node:test drives them from
 * fixtures. Mirrors the regionalBrief.js normalizer discipline: http(s)-only
 * URLs, whitespace-clamped text, dedupe, compact-timestamp parsing, no HTML.
 */

const MAX_ARTICLES = 75;
const MAX_POINT_ARTICLES = 5;
/** Events older than this have fully decayed (the proxy queries 72h). */
export const EVENT_DECAY_HOURS = 72;

function cleanText(value, maxLength = 180) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function parseSeendate(raw) {
  const compact = /^(\d{8})T(\d{6})Z$/.exec(cleanText(raw, 32));
  if (compact) {
    const iso = `${compact[1].slice(0, 4)}-${compact[1].slice(4, 6)}-${compact[1].slice(6, 8)}`
      + `T${compact[2].slice(0, 2)}:${compact[2].slice(2, 4)}:${compact[2].slice(4, 6)}Z`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = Date.parse(String(raw || ''));
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Normalize a GDELT DOC artlist payload into safe article records.
 * @param {object} payload Parsed GDELT JSON ({articles: [...]}).
 * @param {number} [cap=75] Maximum articles kept (newest-first input order).
 * @returns {Array<{title: string, url: string, domain: string, timeMs: number|null, sourceCountry: string|null}>}
 */
export function normalizeTaxEventArticles(payload, cap = MAX_ARTICLES) {
  const rows = Array.isArray(payload?.articles) ? payload.articles : [];
  const seen = new Set();
  const articles = [];
  for (const row of rows) {
    const url = safeHttpUrl(row?.url || row?.url_mobile);
    const title = cleanText(row?.title, 180);
    if (!url || !title) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push({
      title,
      url,
      domain: cleanText(row?.domain || new URL(url).hostname.replace(/^www\./, ''), 80),
      timeMs: parseSeendate(row?.seendate),
      sourceCountry: cleanText(row?.sourcecountry, 60) || null,
    });
    if (articles.length >= Math.max(1, Math.min(MAX_ARTICLES, cap))) break;
  }
  return articles;
}

/** Pin longitude offset from the TP anchor: the disputes stems sit at +0.35°,
 * so events take the mirror side and all three stay individually clickable. */
export const EVENT_LON_OFFSET = -0.35;

/**
 * Aggregate normalized articles into one point per matched jurisdiction.
 * Articles whose sourceCountry has no anchor are counted, not dropped
 * silently — the proxy reports unmatchedCount so coverage stays honest.
 * @param {Array<object>} articles From normalizeTaxEventArticles.
 * @param {Map<string, object>} nameIndex From indexByCountryName.
 * @param {number} nowMs Reference clock.
 * @returns {{points: Array<object>, unmatchedCount: number}}
 */
export function aggregateTaxEventPoints(articles, nameIndex, nowMs) {
  const byIso2 = new Map();
  let unmatchedCount = 0;
  for (const article of articles || []) {
    const key = String(article?.sourceCountry || '').toLowerCase();
    const anchor = key ? nameIndex.get(key) : null;
    if (!anchor) {
      unmatchedCount += 1;
      continue;
    }
    let point = byIso2.get(anchor.iso2);
    if (!point) {
      point = {
        iso2: anchor.iso2,
        name: anchor.name,
        lat: anchor.lat,
        lon: wrapLon(anchor.lon + EVENT_LON_OFFSET),
        articleCount: 0,
        latestTimeMs: null,
        articles: [],
      };
      byIso2.set(anchor.iso2, point);
    }
    point.articleCount += 1;
    if (article.timeMs !== null
      && (point.latestTimeMs === null || article.timeMs > point.latestTimeMs)) {
      point.latestTimeMs = article.timeMs;
    }
    if (point.articles.length < MAX_POINT_ARTICLES) {
      point.articles.push({ title: article.title, url: article.url, domain: article.domain });
    }
  }
  const points = [...byIso2.values()].map((point) => ({
    ...point,
    ageHours: point.latestTimeMs === null
      ? null
      : Math.max(0, (nowMs - point.latestTimeMs) / 3_600_000),
  })).sort((a, b) => b.articleCount - a.articleCount || a.iso2.localeCompare(b.iso2));
  return { points, unmatchedCount };
}

/**
 * Freshness alpha for a point: 1 for breaking, floors at 0.15 so old pins
 * stay visible until the window drops them. Static per refresh tick — the
 * layer never animates alpha per frame.
 * @param {number|null} ageHours
 * @returns {number}
 */
export function eventDecayAlpha(ageHours) {
  if (!Number.isFinite(ageHours)) return 0.5;
  return Math.min(1, Math.max(0.15, 1 - ageHours / EVENT_DECAY_HOURS));
}

/**
 * Flat analyst record for one event point (ANALYST_LAYERS['tax-events']).
 * @param {object} point Aggregated point from the proxy payload.
 * @returns {object|null}
 */
export function mapTaxEventAnalystRecord(point) {
  if (!point || typeof point !== 'object') return null;
  return {
    id: point.name || point.iso2 || 'event',
    lat: Number.isFinite(point.lat) ? point.lat : null,
    lon: Number.isFinite(point.lon) ? point.lon : null,
    name: point.name ?? null,
    iso2: point.iso2 ?? null,
    articleCount: Number.isFinite(point.articleCount) ? point.articleCount : null,
    ageHours: Number.isFinite(point.ageHours) ? Math.round(point.ageHours * 10) / 10 : null,
    latestTitle: point.articles?.[0]?.title ?? null,
  };
}

function wrapLon(lon) {
  if (lon < -180) return lon + 360;
  if (lon > 180) return lon - 360;
  return lon;
}
