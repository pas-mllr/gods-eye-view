/**
 * Pure analyst-record mappers for the entity-footprint and tax-flows layers.
 * Field sets mirror ANALYST_LAYERS exactly (drift-guarded in the pack test
 * suite). The jurisdiction enrichment and PREDICTED risk fields arrive
 * already joined by the /api/entity-footprint proxy — the mappers only
 * flatten and coerce.
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
 * Flatten one enriched footprint entity (ANALYST_LAYERS['entity-footprint']).
 * @param {object} props Enriched entity properties.
 * @param {{id?: string, lat?: number, lon?: number}} [anchor]
 * @returns {object|null}
 */
export function mapFootprintAnalystRecord(props, { id, lat, lon } = {}) {
  if (!props || typeof props !== 'object') return null;
  return {
    id: textOrNull(props.name) || String(id ?? ''),
    lat: numberOrNull(lat ?? props.lat),
    lon: numberOrNull(lon ?? props.lon),
    name: textOrNull(props.name),
    iso2: textOrNull(props.jurisdiction),
    role: textOrNull(props.role),
    riskBand: textOrNull(props.riskBand),
    pillarTwoStatus: textOrNull(props.pillarTwoStatus),
    auditIntensity: textOrNull(props.auditIntensity),
    riskScore: numberOrNull(props.riskScore),
    citRate: numberOrNull(props.citRate),
    headcount: numberOrNull(props.headcount),
    daysToSafeHarbourEnd: numberOrNull(props.daysToSafeHarbourEnd),
    mapAvgMonthsTp: numberOrNull(props.mapAvgMonthsTp),
    ipOwner: boolOrNull(props.ipOwner),
    financing: boolOrNull(props.financing),
  };
}

/**
 * Flatten one enriched flow (ANALYST_LAYERS['tax-flows']). Anchored at the
 * flow midpoint so spatial scopes behave sensibly.
 * @param {object} flow Enriched flow from the proxy payload.
 * @returns {object|null}
 */
export function mapTaxFlowAnalystRecord(flow) {
  if (!flow || typeof flow !== 'object') return null;
  const fromName = textOrNull(flow.fromName) || textOrNull(flow.from);
  const toName = textOrNull(flow.toName) || textOrNull(flow.to);
  return {
    id: textOrNull(flow.id) || `${flow.from}→${flow.to}`,
    lat: numberOrNull(flow.midLat),
    lon: numberOrNull(flow.midLon),
    name: fromName && toName ? `${fromName} → ${toName}` : null,
    flowType: textOrNull(flow.type),
    fromEntity: fromName,
    toEntity: toName,
    fromIso2: textOrNull(flow.fromIso2),
    toIso2: textOrNull(flow.toIso2),
    pricingMethod: textOrNull(flow.pricingMethod),
    annualValueEur: numberOrNull(flow.annualValueEur),
    crossBorder: boolOrNull(flow.crossBorder),
  };
}
