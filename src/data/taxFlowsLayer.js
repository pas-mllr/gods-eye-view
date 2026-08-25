import * as Cesium from 'cesium';
import {
  clearSelectedEntityContextForLayer,
  registerEntityContext,
  removeEntityContextsForLayer,
  selectEntityContext,
} from './contextStore.js';
import { mapTaxFlowAnalystRecord } from './footprintRecords.js';

/**
 * Intercompany-flow arcs: the configured group's flows (goods, royalties,
 * service fees, financing, dividends, cost-share) drawn as lifted
 * great-circle arcs between the entity anchors, from the same
 * /api/entity-footprint pack as the footprint layer.
 *
 * Geometry follows the rocket-launches trajectory recipe — EllipsoidGeodesic
 * sampling with an explicit height profile and ArcType.NONE — and the click
 * contract follows localGeojson: registerEntityContext + selectEntityContext
 * at the arc midpoint (the cables layer's context-less click handler is
 * deliberately NOT the template). Static geometry, no per-frame animators.
 */

export const FLOW_TYPE_COLORS = Object.freeze({
  goods: '#3ddc84',
  royalty: '#c792ea',
  'service-fee': '#4dd2ff',
  financing: '#ffd166',
  dividend: '#ff8c42',
  'cost-share': '#ff5f6d',
  other: '#9aa7b8',
});

const ARC_SAMPLES = 96;

/**
 * Sample one lifted great-circle arc. Exported for tests: endpoints on the
 * ground, apex lift scaling with distance (clamped 30–800 km) via sin(πt).
 * @param {{fromLat: number, fromLon: number, toLat: number, toLon: number}} flow
 * @param {number} [samples=96]
 * @returns {Cesium.Cartesian3[]}
 */
export function flowArcPositions(flow, samples = ARC_SAMPLES) {
  const from = Cesium.Cartographic.fromDegrees(flow.fromLon, flow.fromLat);
  const to = Cesium.Cartographic.fromDegrees(flow.toLon, flow.toLat);
  const geodesic = new Cesium.EllipsoidGeodesic(from, to);
  // Coincident endpoints (two entities at one address): the geodesic
  // interpolation divides by zero and yields NaN cartesians. Degenerate to
  // the two ground points — the polyline draws nothing, nothing throws.
  if (!(geodesic.surfaceDistance > 0)) {
    return [
      Cesium.Ellipsoid.WGS84.cartographicToCartesian(from),
      Cesium.Ellipsoid.WGS84.cartographicToCartesian(to),
    ];
  }
  const distanceKm = geodesic.surfaceDistance / 1000;
  const apexM = Math.min(800_000, Math.max(30_000, distanceKm * 40));
  const positions = [];
  const count = Math.max(8, Math.floor(samples));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const carto = geodesic.interpolateUsingFraction(t, new Cesium.Cartographic());
    carto.height = Math.sin(Math.PI * t) * apexM;
    positions.push(Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto));
  }
  return positions;
}

export function createTaxFlowsLayer({
  fetchImpl = (...args) => fetch(...args),
  screenSpaceEventHandlerFactory = (canvas) => new Cesium.ScreenSpaceEventHandler(canvas),
} = {}) {
  let _dataSource = null;
  let _clickHandler = null;
  let _enabled = false;
  let _count = 0;
  let _lastUpdate = null;
  let _error = null;
  let _flows = [];
  let _groupLabel = null;

  const layer = {
    id: 'tax-flows',
    name: 'Intercompany Flows',
    icon: '⇌',
    source: 'CONFIG PACK · FICTIONAL DEMO by default',
    updateInterval: 0,
    // The pack is a config file, not a feed: fetch on enable, then hold.
    refreshInterval: 0,
    statsRefreshInterval: 1000,

    init(viewer) {
      _dataSource = new Cesium.CustomDataSource('tax-flows');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
    },

    async enable(viewer) {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      if (!_clickHandler && viewer?.scene?.canvas) {
        _clickHandler = screenSpaceEventHandlerFactory(viewer.scene.canvas);
        _clickHandler.setInputAction((click) => {
          if (!_enabled) return;
          const picked = viewer.scene.pick(click.position);
          if (picked?.id?.__taxFlowLayer) {
            viewer.selectedEntity = picked.id;
            selectEntityContext(picked.id);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      }
      // No fetch here: the manager runs the first update() immediately after
      // enable, so an in-enable load would double every fetch and rebuild.
      // Pack edits still land on the next toggle through that manager call.
    },

    disable(viewer) {
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      clearSelectedEntityContextForLayer('tax-flows');
      if (viewer?.selectedEntity?.__taxFlowLayer) viewer.selectedEntity = undefined;
    },

    /** Fetch the pack and rebuild the arcs. Always resolves truthy. */
    async update(viewer) {
      if (!_dataSource) return true;
      let pack = null;
      try {
        const response = await fetchImpl('/api/entity-footprint');
        if (response.ok) pack = await response.json();
      } catch { /* handled below */ }
      // Re-check after the await: a destroy during the fetch nulls the source.
      if (!_dataSource) return true;
      if (!pack || !Array.isArray(pack.flows)) {
        _error = _lastUpdate ? 'pack refresh unavailable' : 'entity pack unavailable';
        return true;
      }

      _flows = pack.flows;
      _groupLabel = pack.group ?? null;
      _dataSource.entities.removeAll();
      // Prune before re-registering so flows removed from the pack do not
      // stay voice-selectable against removed entities.
      removeEntityContextsForLayer('tax-flows');
      for (const flow of _flows) {
        if (![flow.fromLat, flow.fromLon, flow.toLat, flow.toLon].every(Number.isFinite)) continue;
        const positions = flowArcPositions(flow);
        const css = FLOW_TYPE_COLORS[flow.type] || FLOW_TYPE_COLORS.other;
        const color = Cesium.Color.fromCssColorString(css);
        const entity = _dataSource.entities.add({
          id: `tax-flow:${flow.id}`,
          polyline: {
            positions,
            width: 2.5,
            arcType: Cesium.ArcType.NONE,
            material: new Cesium.ColorMaterialProperty(color.withAlpha(0.85)),
          },
        });
        entity.__taxFlowLayer = true;
        const midpoint = positions[Math.floor(positions.length / 2)];
        // Anchor the context card at the arc apex so selection reads sensibly.
        entity.position = midpoint;
        registerEntityContext(entity, {
          id: `tax-flows:${flow.id}`,
          layerId: 'tax-flows',
          layerName: 'Intercompany Flows',
          source: layer.source,
          dataSource: _dataSource,
          label: `${flow.fromName} → ${flow.toName} (${flow.type})`,
          properties: { ...flow, group: _groupLabel },
          latitude: flow.midLat,
          longitude: flow.midLon,
        });
      }
      _count = _dataSource.entities.values.length;
      _lastUpdate = Date.now();
      _error = null;
      viewer?.scene?.requestRender?.();
      return true;
    },

    getStats() {
      return { count: _count, lastUpdate: _lastUpdate, error: _error };
    },

    /**
     * Analyst snapshot over the loaded flows.
     * @param {number} [maxCount=2000]
     * @returns {Array<object>}
     */
    getAnalystRecords(maxCount = 2000) {
      if (!_enabled || !_flows.length) return [];
      const limit = Number.isFinite(maxCount) ? Math.max(1, Math.floor(maxCount)) : 2000;
      return _flows.slice(0, limit).map(mapTaxFlowAnalystRecord).filter(Boolean);
    },

    destroy(viewer) {
      layer.disable(viewer);
      removeEntityContextsForLayer('tax-flows');
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      if (_dataSource && viewer) viewer.dataSources.remove(_dataSource, true);
      _dataSource = null;
      _flows = [];
      _count = 0;
      _lastUpdate = null;
      _error = null;
    },
  };
  return layer;
}

const taxFlowsLayer = createTaxFlowsLayer();

export default taxFlowsLayer;
