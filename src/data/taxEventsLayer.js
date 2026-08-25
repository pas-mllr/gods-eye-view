import * as Cesium from 'cesium';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import {
  clearSelectedEntityContextForLayer,
  registerEntityContext,
  selectEntityContext,
} from './contextStore.js';
import { eventDecayAlpha, mapTaxEventAnalystRecord } from './taxEventsFeed.js';

/**
 * Live tax-events layer: geocoded tax news pins from /api/tax-events (GDELT
 * DOC 2.0, aggregated server-side onto the bundled jurisdiction anchors).
 *
 * Modeled on the earthquakes layer's perf doctrine — every pin is STATIC per
 * refresh tick (size from article count, alpha from age at fetch time); no
 * per-frame animators, no render-governor holds. Unlike earthquakes, a fetch
 * failure NEVER returns false: the previous pins stay up and the failure
 * surfaces only through getStats() (degraded with data, unavailable without),
 * so enabling the layer offline degrades instead of failing the toggle.
 */

const API_URL = '/api/tax-events';
export const TAX_EVENTS_OVERLAY_SOURCE_ID = 'tax-events';
const OVERLAY_COHORT_LIMIT = 48;
const OVERLAY_COLLISION_CAPACITY = 32;
const ACCENT = '#4dd2ff';

function clampLine(value, max = 48) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

/**
 * Build the shared-host ambient card for one event point. Exported for tests.
 * @param {object} point Aggregated proxy point.
 * @param {Cesium.Cartesian3} position Pin anchor.
 * @returns {object}
 */
export function createTaxEventOverlayEntry(point, position) {
  const details = [];
  const age = Number.isFinite(point.ageHours) ? ` · latest ${Math.round(point.ageHours)}h ago` : '';
  details.push(clampLine(`${point.articleCount} article${point.articleCount === 1 ? '' : 's'}${age}`));
  const latest = point.articles?.[0]?.title;
  if (latest) details.push(clampLine(latest));
  return {
    id: `tax-event:${point.iso2}`,
    source: TAX_EVENTS_OVERLAY_SOURCE_ID,
    position,
    variant: 'card',
    title: clampLine(point.name || point.iso2, 34),
    details,
    accent: ACCENT,
    priority: 1000 + (Number(point.articleCount) || 0),
    collisionGroup: 'ambient-card',
    zIndex: 30,
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    placement: 'above',
  };
}

export function createTaxEventsLayer({
  overlayHost = Object.freeze({
    setEntries: setOverlayEntries,
    setVisible: setOverlaySourceVisible,
    clearSource: clearOverlaySource,
  }),
  fetchImpl = (...args) => fetch(...args),
  screenSpaceEventHandlerFactory = (canvas) => new Cesium.ScreenSpaceEventHandler(canvas),
} = {}) {
  let _dataSource = null;
  let _clickHandler = null;
  let _enabled = false;
  let _count = 0;
  let _lastUpdate = null;
  let _error = null;
  let _points = [];

  const layer = {
    id: 'tax-events',
    name: 'Tax Events',
    icon: '◍',
    source: 'GDELT DOC 2.0 · LIVE',
    updateInterval: 10 * 60_000,

    init(viewer) {
      _dataSource = new Cesium.CustomDataSource('tax-events');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      overlayHost.setVisible(TAX_EVENTS_OVERLAY_SOURCE_ID, false);
    },

    enable(viewer) {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(TAX_EVENTS_OVERLAY_SOURCE_ID, true);
      if (!_clickHandler && viewer?.scene?.canvas) {
        _clickHandler = screenSpaceEventHandlerFactory(viewer.scene.canvas);
        _clickHandler.setInputAction((click) => {
          if (!_enabled) return;
          const picked = viewer.scene.pick(click.position);
          if (picked?.id?.__taxEventLayer) {
            viewer.selectedEntity = picked.id;
            selectEntityContext(picked.id);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      }
    },

    disable(viewer) {
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(TAX_EVENTS_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(TAX_EVENTS_OVERLAY_SOURCE_ID, false);
      clearSelectedEntityContextForLayer('tax-events');
      if (viewer?.selectedEntity?.__taxEventLayer) viewer.selectedEntity = undefined;
    },

    /**
     * Poll the proxy and rebuild the pins. ALWAYS resolves truthy — a feed
     * failure keeps the previous tick's pins and surfaces via getStats()
     * (the manager treats `false` as a lifecycle rejection, which would make
     * an offline enable fail instead of degrade).
     */
    async update(viewer) {
      let payload = null;
      try {
        const response = await fetchImpl(API_URL);
        if (response.ok) payload = await response.json();
      } catch { /* handled below */ }
      if (!payload || !Array.isArray(payload.points)) {
        _error = 'live feed unavailable';
        return true;
      }

      _points = payload.points;
      _dataSource.entities.removeAll();
      const overlayEntries = [];
      for (const point of _points) {
        if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
        const position = Cesium.Cartesian3.fromDegrees(point.lon, point.lat);
        // Static per tick by design: size from volume, alpha from age at
        // fetch time. Never a CallbackProperty (earthquakes doctrine).
        const alpha = eventDecayAlpha(point.ageHours);
        const pixelSize = Math.min(16, 8 + Math.log2(1 + (point.articleCount || 1)) * 2.5);
        const entity = _dataSource.entities.add({
          id: `tax-event:${point.iso2}`,
          position,
          point: {
            pixelSize,
            color: Cesium.Color.fromCssColorString(ACCENT).withAlpha(alpha),
            outlineColor: Cesium.Color.BLACK.withAlpha(alpha),
            outlineWidth: 1.5,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entity.__taxEventLayer = true;
        registerEntityContext(entity, {
          id: `tax-events:${point.iso2}`,
          layerId: 'tax-events',
          layerName: 'Tax Events',
          source: 'GDELT DOC 2.0 · LIVE',
          dataSource: _dataSource,
          label: `${point.name} tax news`,
          properties: {
            name: point.name,
            iso2: point.iso2,
            articleCount: point.articleCount,
            ageHours: point.ageHours,
            articles: point.articles,
          },
          latitude: point.lat,
          longitude: point.lon,
        });
        overlayEntries.push(createTaxEventOverlayEntry(point, position));
      }

      if (_enabled) {
        overlayHost.setEntries(
          TAX_EVENTS_OVERLAY_SOURCE_ID,
          overlayEntries
            .sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
            .slice(0, OVERLAY_COHORT_LIMIT),
          {
            cohortLimit: OVERLAY_COHORT_LIMIT,
            collisionCapacity: OVERLAY_COLLISION_CAPACITY,
            moving: false,
          },
        );
      }
      _count = _dataSource.entities.values.length;
      _lastUpdate = Date.now();
      _error = null;
      return true;
    },

    /**
     * FIRMS discipline: a feed failure with pins still up reads DEGRADED
     * (error + prior data); without any successful tick it reads UNAVAILABLE.
     */
    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        error: _error,
        loadingLabel: _lastUpdate && !_error
          ? `LIVE · updated ${Math.max(1, Math.round((Date.now() - _lastUpdate) / 60_000))}m ago`
          : undefined,
      };
    },

    /**
     * Analyst snapshot over the last tick's aggregated points.
     * @param {number} [maxCount=2000]
     * @returns {Array<object>}
     */
    getAnalystRecords(maxCount = 2000) {
      if (!_enabled || !_points.length) return [];
      const limit = Number.isFinite(maxCount) ? Math.max(1, Math.floor(maxCount)) : 2000;
      return _points.slice(0, limit).map(mapTaxEventAnalystRecord).filter(Boolean);
    },

    destroy(viewer) {
      layer.disable(viewer);
      if (_clickHandler) {
        _clickHandler.destroy();
        _clickHandler = null;
      }
      if (_dataSource && viewer) viewer.dataSources.remove(_dataSource, true);
      _dataSource = null;
      _points = [];
      _count = 0;
      _lastUpdate = null;
      _error = null;
    },
  };
  return layer;
}

const taxEventsLayer = createTaxEventsLayer();

export default taxEventsLayer;
