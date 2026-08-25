/**
 * Pure analyst-record mappers for the tax advisory layers. Kept free of any
 * Vite-specific imports (the ?url dataset assets live in taxLayers.js) so
 * node:test can import and exercise them directly.
 *
 * Field sets mirror ANALYST_LAYERS['local-tp-radar'] and
 * ANALYST_LAYERS['local-tax-disputes'] exactly — src/data/taxLayers.test.mjs
 * guards against drift in either direction.
 */

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function boolOrNull(value) {
  if (value === null || value === undefined) return null;
  return Boolean(value);
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * Map one TP Radar feature's properties into a flat analyst record.
 * @param {object} props Unwrapped GeoJSON properties.
 * @param {{id?: string, lat?: number, lon?: number}} [anchor] Record identity/position.
 * @returns {object|null}
 */
export function mapTpAnalystRecord(props, { id, lat, lon } = {}) {
  if (!props || typeof props !== 'object') return null;
  return {
    id: textOrNull(props.name) || String(id ?? ''),
    lat: numberOrNull(lat),
    lon: numberOrNull(lon),
    name: textOrNull(props.name),
    iso2: textOrNull(props.iso2),
    tpDeadline: textOrNull(props.tpDeadline),
    apa: textOrNull(props.apa),
    oecdAlignment: textOrNull(props.oecdAlignment),
    cbcrThresholdEur: numberOrNull(props.cbcrThresholdEur),
    citRate: numberOrNull(props.citRate),
    tpDocRequired: boolOrNull(props.tpDocRequired),
    masterFileRequired: boolOrNull(props.masterFileRequired),
    localFileRequired: boolOrNull(props.localFileRequired),
    cbcrRequired: boolOrNull(props.cbcrRequired),
    apaBilateral: boolOrNull(props.apaBilateral),
    mapAvailable: boolOrNull(props.mapAvailable),
  };
}

/**
 * Map one Tax Disputes & M&A feature's properties into a flat analyst record.
 * @param {object} props Unwrapped GeoJSON properties.
 * @param {{id?: string, lat?: number, lon?: number}} [anchor] Record identity/position.
 * @returns {object|null}
 */
export function mapDisputesAnalystRecord(props, { id, lat, lon } = {}) {
  if (!props || typeof props !== 'object') return null;
  return {
    id: textOrNull(props.name) || String(id ?? ''),
    lat: numberOrNull(lat),
    lon: numberOrNull(lon),
    name: textOrNull(props.name),
    iso2: textOrNull(props.iso2),
    auditIntensity: textOrNull(props.auditIntensity),
    auditFocus: textOrNull(props.auditFocus),
    mapInventoryTp: numberOrNull(props.mapInventoryTp),
    mapNewCasesTp: numberOrNull(props.mapNewCasesTp),
    mapAvgMonthsTp: numberOrNull(props.mapAvgMonthsTp),
    treatyCount: numberOrNull(props.treatyCount),
    whtDividendPct: numberOrNull(props.whtDividendPct),
    whtInterestPct: numberOrNull(props.whtInterestPct),
    whtRoyaltyPct: numberOrNull(props.whtRoyaltyPct),
    arbitrationAvailable: boolOrNull(props.arbitrationAvailable),
    icapMember: boolOrNull(props.icapMember),
    mliSigned: boolOrNull(props.mliSigned),
    participationExemption: boolOrNull(props.participationExemption),
  };
}
