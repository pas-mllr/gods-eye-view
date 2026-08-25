/**
 * Minimal, defensive SDMX-JSON extraction for the OECD data API. Pure and
 * free of Vite imports so vite.config.js (the /api/oecd-tax proxy) and
 * node:test share one implementation.
 *
 * Deliberately dataflow-AGNOSTIC: the proxy's dataflow ids are env-tunable,
 * so this walks whatever structure arrives, finds the REF_AREA series
 * dimension, and pulls the latest observation per area. A payload this walk
 * cannot understand yields an 'unavailable' sub-feed — never a throw — and
 * the layers keep their bundled figures.
 */

function sdmxRoot(payload) {
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  return root && typeof root === 'object' ? root : null;
}

function sdmxDimensions(root) {
  const structure = Array.isArray(root?.structures) ? root.structures[0] : root?.structure;
  const dimensions = structure?.dimensions;
  if (!dimensions || typeof dimensions !== 'object') return null;
  const series = Array.isArray(dimensions.series) ? dimensions.series : null;
  const observation = Array.isArray(dimensions.observation) ? dimensions.observation : [];
  return series ? { series, observation } : null;
}

/**
 * Latest numeric observation per REF_AREA from one SDMX-JSON payload.
 * @param {object} payload Parsed SDMX-JSON (series-keyed dataSets form).
 * @returns {Map<string, {value: number, period: string|null}>} Keyed by the
 *   REF_AREA value id (iso3 for OECD tax dataflows). Empty on any shape the
 *   walk cannot understand.
 */
export function extractLatestByRefArea(payload) {
  const result = new Map();
  const root = sdmxRoot(payload);
  const dims = root ? sdmxDimensions(root) : null;
  const series = root?.dataSets?.[0]?.series;
  if (!dims || !series || typeof series !== 'object') return result;

  const refAreaIndex = dims.series.findIndex((d) => d?.id === 'REF_AREA');
  if (refAreaIndex < 0) return result;
  const refAreaValues = Array.isArray(dims.series[refAreaIndex]?.values)
    ? dims.series[refAreaIndex].values
    : [];
  const timeValues = Array.isArray(dims.observation?.[0]?.values)
    ? dims.observation[0].values
    : [];

  for (const [seriesKey, seriesEntry] of Object.entries(series)) {
    const keyParts = String(seriesKey).split(':');
    const area = refAreaValues[Number(keyParts[refAreaIndex])]?.id;
    const observations = seriesEntry?.observations;
    if (!area || !observations || typeof observations !== 'object') continue;
    let bestTime = -1;
    let bestValue = null;
    for (const [timeKey, obs] of Object.entries(observations)) {
      const timeIndex = Number(timeKey);
      const value = Number(Array.isArray(obs) ? obs[0] : obs);
      if (!Number.isFinite(timeIndex) || !Number.isFinite(value)) continue;
      if (timeIndex > bestTime) {
        bestTime = timeIndex;
        bestValue = value;
      }
    }
    if (bestValue === null) continue;
    const period = timeValues[bestTime]?.id ?? null;
    const existing = result.get(area);
    // Multiple series per area (extra dimensions): keep the latest period,
    // first-seen on ties — deterministic, and correct for single-measure keys.
    if (!existing || (period !== null && String(period) > String(existing.period ?? ''))) {
      result.set(area, { value: bestValue, period: period === null ? null : String(period) });
    }
  }
  return result;
}

function feedFromMap(byArea) {
  if (!byArea || byArea.size === 0) {
    return { status: 'unavailable', period: null, byIso3: {} };
  }
  const byIso3 = {};
  let period = null;
  for (const [area, entry] of byArea.entries()) {
    byIso3[area] = entry.value;
    if (entry.period !== null && (period === null || entry.period > period)) period = entry.period;
  }
  return { status: 'ready', period, byIso3 };
}

/**
 * The /api/oecd-tax payload: two independent sub-feeds, each honest about
 * its own availability. Both unavailable is the caller's signal to throw
 * (so the proxy's serve-stale path takes over).
 * @param {object|null} citPayload SDMX-JSON for the CIT-rate dataflow.
 * @param {object|null} mapPayload SDMX-JSON for the MAP-caseload dataflow.
 * @param {number} [nowMs] Clock for retrievedAt (injectable for tests).
 * @returns {{retrievedAt: string, cit: object, map: object}}
 */
export function normalizeOecdTaxPayload(citPayload, mapPayload, nowMs = Date.now()) {
  return {
    retrievedAt: new Date(nowMs).toISOString(),
    cit: feedFromMap(citPayload ? extractLatestByRefArea(citPayload) : null),
    map: feedFromMap(mapPayload ? extractLatestByRefArea(mapPayload) : null),
  };
}
