/**
 * Pure jurisdiction index over the two bundled tax datasets. Consumers pass
 * the raw JSONL text in (the dev-server proxies read the files with fs, node
 * tests likewise), so this module carries no Vite asset imports and no other
 * layer's runtime state — the cross-layer "join" is a lookup table, never a
 * dependency on whether a layer is enabled.
 */

/**
 * Build iso2 → jurisdiction attributes from the bundled dataset texts.
 * @param {string} tpText Raw tp_radar.geojsonl contents.
 * @param {string} disputesText Raw tax_disputes.geojsonl contents.
 * @returns {Map<string, object>} Keyed by iso2; values combine both files'
 *   join-relevant fields plus the TP anchor lat/lon.
 */
export function buildJurisdictionIndex(tpText, disputesText) {
  const index = new Map();
  for (const feature of parseJsonl(tpText)) {
    const props = feature?.properties;
    const [lon, lat] = feature?.geometry?.coordinates || [];
    if (!props?.iso2 || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    index.set(props.iso2, {
      name: props.name ?? null,
      iso2: props.iso2,
      iso3: props.iso3 ?? null,
      lat,
      lon,
      citRate: numberOrNull(props.citRate),
      pillarTwoStatus: props.pillarTwoStatus ?? null,
      safeHarbourUntil: props.safeHarbourUntil ?? null,
      eInvoicingPhase: props.eInvoicingPhase ?? null,
      eInvoicingFrom: props.eInvoicingFrom ?? null,
      girNextDeadline: props.girNextDeadline ?? null,
      auditIntensity: null,
      mapInventoryTp: null,
      mapAvgMonthsTp: null,
      treatyCount: null,
    });
  }
  for (const feature of parseJsonl(disputesText)) {
    const props = feature?.properties;
    const entry = props?.iso2 ? index.get(props.iso2) : null;
    if (!entry) continue;
    entry.auditIntensity = props.auditIntensity ?? null;
    entry.mapInventoryTp = numberOrNull(props.mapInventoryTp);
    entry.mapAvgMonthsTp = numberOrNull(props.mapAvgMonthsTp);
    entry.treatyCount = numberOrNull(props.treatyCount);
  }
  return index;
}

/**
 * Common English aliases GDELT's sourcecountry field uses for jurisdictions
 * whose dataset name differs. Lowercased keys.
 */
const COUNTRY_ALIASES = Object.freeze({
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'south korea': 'KR',
  'korea, south': 'KR',
  'republic of korea': 'KR',
  czechia: 'CZ',
  'czech republic': 'CZ',
  turkey: 'TR',
  'türkiye': 'TR',
  turkiye: 'TR',
  'hong kong': 'HK',
  'united arab emirates': 'AE',
  uae: 'AE',
  vietnam: 'VN',
  'viet nam': 'VN',
});

/**
 * Lowercased country-name → index entry, dataset names plus aliases.
 * @param {Map<string, object>} index From buildJurisdictionIndex.
 * @returns {Map<string, object>}
 */
export function indexByCountryName(index) {
  const byName = new Map();
  for (const entry of index.values()) {
    if (entry.name) byName.set(String(entry.name).toLowerCase(), entry);
  }
  for (const [alias, iso2] of Object.entries(COUNTRY_ALIASES)) {
    const entry = index.get(iso2);
    if (entry) byName.set(alias, entry);
  }
  return byName;
}

function parseJsonl(text) {
  const features = [];
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue;
    try {
      features.push(JSON.parse(line));
    } catch { /* a malformed line degrades to a smaller index, never a throw */ }
  }
  return features;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
