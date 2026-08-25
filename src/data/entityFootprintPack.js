/**
 * Pure normalization + enrichment for entity-footprint packs (the CCTV
 * source-pack pattern applied to a corporate group: an operator-trusted,
 * env-pointed JSON file — client-confidential packs are never committed; the
 * repo ships only the fictional Aurora demo). The /api/entity-footprint
 * proxy runs these helpers server-side; node:test drives them directly.
 *
 * Enrichment joins each entity to its jurisdiction's attributes through the
 * pure jurisdiction index (never another layer's runtime state) and stamps
 * the PREDICTED risk score. Every dropped record or repaired link lands in
 * `warnings` — silent repair would hide pack mistakes from the operator.
 */

import { daysUntil } from './taxPolicy.js';
import { explainRisk, riskBand, riskScore } from './entityRisk.js';

export const FOOTPRINT_ROLES = Object.freeze([
  'parent', 'holding', 'ip-owner', 'principal', 'distributor', 'manufacturer',
  'finance', 'shared-services', 'rnd', 'other',
]);

export const FLOW_TYPES = Object.freeze([
  'royalty', 'service-fee', 'goods', 'financing', 'dividend', 'cost-share', 'other',
]);

const LEI_PATTERN = /^[A-Z0-9]{18}[0-9]{2}$/;
const ISO2_PATTERN = /^[A-Z]{2}$/;

function cleanText(value, maxLength = 160) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return text || null;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Coerce one raw pack entity. Null when the record has no usable identity or
 * anchor — the caller records the drop as a warning.
 * @param {object} item Raw pack entry.
 * @returns {object|null}
 */
export function normalizeFootprintEntity(item) {
  const id = cleanText(item?.id, 64);
  const lat = finiteOrNull(item?.lat);
  const lon = finiteOrNull(item?.lon);
  if (!id) return null;
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const lei = cleanText(item?.lei, 20);
  const jurisdiction = cleanText(item?.jurisdiction, 2);
  const role = FOOTPRINT_ROLES.includes(item?.role) ? item.role : 'other';
  return {
    id,
    name: cleanText(item?.name, 120) || id,
    lei: lei && LEI_PATTERN.test(lei) ? lei : null,
    jurisdiction: jurisdiction && ISO2_PATTERN.test(jurisdiction) ? jurisdiction : null,
    lat,
    lon,
    role,
    parentId: cleanText(item?.parentId, 64),
    ipOwner: item?.ipOwner === true,
    financing: item?.financing === true,
    headcount: finiteOrNull(item?.headcount),
    functionsNote: cleanText(item?.functionsNote, 160),
  };
}

/**
 * Coerce one raw pack flow. Null without an id or endpoints.
 * @param {object} item Raw pack entry.
 * @returns {object|null}
 */
export function normalizeFootprintFlow(item) {
  const id = cleanText(item?.id, 64);
  const from = cleanText(item?.from, 64);
  const to = cleanText(item?.to, 64);
  if (!id || !from || !to) return null;
  return {
    id,
    from,
    to,
    type: FLOW_TYPES.includes(item?.type) ? item.type : 'other',
    annualValueEur: finiteOrNull(item?.annualValueEur),
    pricingMethod: cleanText(item?.pricingMethod, 60),
    note: cleanText(item?.note, 160),
  };
}

/**
 * Normalize, validate, and enrich a whole pack.
 * @param {object} raw Parsed pack JSON ({disclaimer, group, entities, flows}).
 * @param {Map<string, object>} jurisdictionIndex From buildJurisdictionIndex.
 * @param {{nowMs?: number, maxEntities?: number}} [options]
 * @returns {{group: string|null, disclaimer: string|null, asOf: string|null,
 *   entities: object[], flows: object[], warnings: string[]}}
 */
export function normalizeFootprintPack(raw, jurisdictionIndex, { nowMs = Date.now(), maxEntities = 200 } = {}) {
  const warnings = [];
  const cap = Math.max(1, Math.min(500, Math.floor(Number(maxEntities) || 200)));

  const byId = new Map();
  const rawEntities = Array.isArray(raw?.entities) ? raw.entities : [];
  for (const item of rawEntities) {
    const entity = normalizeFootprintEntity(item);
    if (!entity) {
      warnings.push(`entity dropped (missing id or valid lat/lon): ${cleanText(item?.id, 64) || '<no id>'}`);
      continue;
    }
    if (byId.has(entity.id)) warnings.push(`duplicate entity id overridden: ${entity.id}`);
    byId.set(entity.id, entity);
  }
  let entities = [...byId.values()];
  if (entities.length > cap) {
    warnings.push(`entity cap ${cap} exceeded — keeping the first ${cap} of ${entities.length}`);
    entities = entities.slice(0, cap);
  }

  // Parent links: referential integrity + cycle guard. A dangling or cyclic
  // link is repaired to null and reported, never silently kept.
  const kept = new Map(entities.map((entity) => [entity.id, entity]));
  for (const entity of entities) {
    if (entity.parentId && !kept.has(entity.parentId)) {
      warnings.push(`parent link dropped (unknown id): ${entity.id} → ${entity.parentId}`);
      entity.parentId = null;
    }
  }
  for (const entity of entities) {
    const seen = new Set([entity.id]);
    let cursor = entity.parentId ? kept.get(entity.parentId) : null;
    while (cursor) {
      if (seen.has(cursor.id)) {
        warnings.push(`parent cycle broken at: ${entity.id}`);
        entity.parentId = null;
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.parentId ? kept.get(cursor.parentId) : null;
    }
  }

  for (const entity of entities) {
    const jurisdiction = entity.jurisdiction ? jurisdictionIndex?.get?.(entity.jurisdiction) : null;
    if (entity.jurisdiction && !jurisdiction) {
      warnings.push(`jurisdiction not in the radar datasets: ${entity.id} (${entity.jurisdiction})`);
    }
    entity.jurisdictionName = jurisdiction?.name ?? null;
    entity.citRate = jurisdiction?.citRate ?? null;
    entity.auditIntensity = jurisdiction?.auditIntensity ?? null;
    entity.mapAvgMonthsTp = jurisdiction?.mapAvgMonthsTp ?? null;
    entity.pillarTwoStatus = jurisdiction?.pillarTwoStatus ?? null;
    entity.safeHarbourUntil = jurisdiction?.safeHarbourUntil ?? null;
    entity.daysToSafeHarbourEnd = jurisdiction?.safeHarbourUntil
      ? daysUntil(jurisdiction.safeHarbourUntil, nowMs)
      : null;
    entity.riskScore = riskScore(entity);
    entity.riskBand = riskBand(entity.riskScore);
    entity.riskComponents = explainRisk(entity);
  }

  const flows = [];
  const seenFlowIds = new Set();
  for (const item of Array.isArray(raw?.flows) ? raw.flows : []) {
    const flow = normalizeFootprintFlow(item);
    if (!flow) {
      warnings.push(`flow dropped (missing id/from/to): ${cleanText(item?.id, 64) || '<no id>'}`);
      continue;
    }
    if (seenFlowIds.has(flow.id)) {
      warnings.push(`duplicate flow id dropped: ${flow.id}`);
      continue;
    }
    const fromEntity = kept.get(flow.from);
    const toEntity = kept.get(flow.to);
    if (!fromEntity || !toEntity) {
      warnings.push(`flow dropped (unknown endpoint): ${flow.id}`);
      continue;
    }
    seenFlowIds.add(flow.id);
    flows.push({
      ...flow,
      fromName: fromEntity.name,
      toName: toEntity.name,
      fromIso2: fromEntity.jurisdiction,
      toIso2: toEntity.jurisdiction,
      crossBorder: Boolean(fromEntity.jurisdiction && toEntity.jurisdiction
        && fromEntity.jurisdiction !== toEntity.jurisdiction),
      fromLat: fromEntity.lat,
      fromLon: fromEntity.lon,
      toLat: toEntity.lat,
      toLon: toEntity.lon,
      midLat: (fromEntity.lat + toEntity.lat) / 2,
      midLon: (fromEntity.lon + toEntity.lon) / 2,
    });
  }

  return {
    group: cleanText(raw?.group, 120),
    disclaimer: cleanText(raw?.disclaimer, 300),
    asOf: cleanText(raw?.asOf, 20),
    entities,
    flows,
    warnings,
  };
}

/**
 * Serialize the enriched entities as GeoJSONL for createLocalGeoJsonLayer —
 * the footprint layer is the bundled-layer factory pointed at the proxy.
 * @param {object} pack From normalizeFootprintPack.
 * @returns {string}
 */
export function footprintEntitiesToGeojsonl(pack) {
  const lines = (pack?.entities || []).map((entity) => JSON.stringify({
    id: entity.id,
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [entity.lon, entity.lat] },
    properties: { ...entity },
  }));
  return lines.join('\n') + (lines.length ? '\n' : '');
}
