/**
 * Pure analyst-record mappers for the tax advisory layers. Kept free of any
 * Vite-specific imports (the ?url dataset assets live in taxLayers.js) so
 * node:test can import and exercise them directly.
 *
 * Field sets mirror ANALYST_LAYERS['local-tp-radar'] and
 * ANALYST_LAYERS['local-tax-disputes'] exactly — src/data/taxLayers.test.mjs
 * guards against drift in either direction.
 */

import { daysUntil } from './taxPolicy.js';

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
 * @param {{id?: string, lat?: number, lon?: number, nowMs?: number}} [anchor]
 *   Record identity/position; nowMs is an injectable clock for the derived
 *   daysToGirDeadline field (tests pass a fixed value).
 * @returns {object|null}
 */
export function mapTpAnalystRecord(props, { id, lat, lon, nowMs = Date.now() } = {}) {
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
    pillarTwoStatus: textOrNull(props.pillarTwoStatus),
    safeHarbourUntil: textOrNull(props.safeHarbourUntil),
    eInvoicingPhase: textOrNull(props.eInvoicingPhase),
    eInvoicingFrom: textOrNull(props.eInvoicingFrom),
    girNextDeadline: textOrNull(props.girNextDeadline),
    // Numeric companion so gt/lt filters work (ISO strings don't compare
    // numerically in the engine's applyFilter).
    daysToGirDeadline: daysUntil(props.girNextDeadline, nowMs),
    citRateSource: textOrNull(props.citRateSource) || 'bundled',
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
    mapStatsSource: textOrNull(props.mapStatsSource) || 'bundled',
  };
}

/**
 * Live-merge patch for one TP record: statutory CIT rate from the OECD CIT
 * sub-feed, with provenance fields so cards/queries can say which figures
 * are live vs bundled. Pure — consumed by taxLayers.js as its applyLive hook.
 * @param {object} props Record properties (bundled + prior patches).
 * @param {object} payload /api/oecd-tax payload.
 * @returns {object|null} Patch, or null to leave the record untouched.
 */
export function applyOecdToTpRecord(props, payload) {
  const value = payload?.cit?.status === 'ready' ? payload.cit.byIso3?.[props?.iso3] : undefined;
  if (!Number.isFinite(value)) return null;
  return {
    citRate: value,
    citRateSource: 'oecd-live',
    citRateAsOf: payload.cit.period ?? null,
  };
}

/**
 * Live-merge patch for one disputes record: MAP TP caseload from the OECD
 * MAP sub-feed, with provenance fields. Pure — taxLayers.js applyLive hook.
 * @param {object} props Record properties.
 * @param {object} payload /api/oecd-tax payload.
 * @returns {object|null} Patch, or null to leave the record untouched.
 */
export function applyOecdToDisputesRecord(props, payload) {
  const value = payload?.map?.status === 'ready' ? payload.map.byIso3?.[props?.iso3] : undefined;
  if (!Number.isFinite(value)) return null;
  return {
    mapInventoryTp: value,
    mapStatsSource: 'oecd-live',
    mapStatsAsOf: payload.map.period ?? null,
  };
}
