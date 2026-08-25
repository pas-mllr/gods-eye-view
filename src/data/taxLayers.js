import { createLocalGeoJsonLayer } from './localGeojson.js';
import { setRegionalBriefTopicSource } from './regionalBrief.js';
import { mapTpAnalystRecord, mapDisputesAnalystRecord } from './taxAnalystRecords.js';

// Use Vite's ?url import to properly resolve these assets in dev and build
import tpRadarUrl from './local_data/tax_advisory/tp_radar.geojsonl?url';
import taxDisputesUrl from './local_data/tax_advisory/tax_disputes.geojsonl?url';

/**
 * Tax advisory layers: hand-curated per-jurisdiction BUNDLED snapshots
 * (see src/data/local_data/tax_advisory/README.md for sources and the
 * honesty notes on every field). One Point per jurisdiction; the disputes
 * file offsets anchors +0.35° longitude so both stems stay clickable
 * when the layers are enabled together.
 *
 * The pure analyst-record mappers live in taxAnalystRecords.js (no ?url
 * imports there) so node:test can exercise them directly.
 */

export const TAX_LAYER_IDS = Object.freeze(['local-tp-radar', 'local-tax-disputes']);

/**
 * Register the layer with the regional-brief topic register so the cockpit's
 * news strip turns tax-flavored exactly while a tax layer is enabled. The
 * factory returns a plain object, so wrapping the lifecycle is enough — no
 * cockpit or manager code needs to know.
 * @param {object} layer createLocalGeoJsonLayer result.
 * @returns {object} The same layer, lifecycle-wrapped.
 */
function withTaxNewsTopic(layer) {
  const enable = layer.enable;
  const disable = layer.disable;
  const destroy = layer.destroy;
  layer.enable = async (viewer) => {
    setRegionalBriefTopicSource(layer.id, true);
    return enable(viewer);
  };
  layer.disable = (viewer) => {
    setRegionalBriefTopicSource(layer.id, false);
    return disable(viewer);
  };
  layer.destroy = (viewer) => {
    setRegionalBriefTopicSource(layer.id, false);
    return destroy(viewer);
  };
  return layer;
}

export const tpRadarLayer = withTaxNewsTopic(createLocalGeoJsonLayer({
  id: 'local-tp-radar',
  url: tpRadarUrl,
  name: 'TP Radar',
  color: '#ffb347', // Amber
  icon: '⊞',
  source: 'OECD/PUBLIC · BUNDLED 2026-08',
  labels: true,
  labelMax: 200,
  labelGridPx: 150,
  analystRecord: mapTpAnalystRecord,
}));

export const taxDisputesLayer = withTaxNewsTopic(createLocalGeoJsonLayer({
  id: 'local-tax-disputes',
  url: taxDisputesUrl,
  name: 'Tax Disputes & M&A',
  color: '#ff5f6d', // Red-pink
  icon: '⚖',
  source: 'OECD MAP STATS · BUNDLED 2026-08',
  labels: true,
  labelMax: 200,
  labelGridPx: 150,
  analystRecord: mapDisputesAnalystRecord,
}));
