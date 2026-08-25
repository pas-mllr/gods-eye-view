import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaxFlowsLayer } from './taxFlowsLayer.js';
import { layerFeedState } from './manager.js';

if (globalThis.window === undefined) globalThis.window = { dispatchEvent() {} };

const PACK_PAYLOAD = {
  group: 'Aurora Consumer Group (FICTIONAL)',
  flows: [
    { id: 'goods-a-b', from: 'a', to: 'b', type: 'goods', fromName: 'A GmbH', toName: 'B Ltd', fromIso2: 'DE', toIso2: 'GB', crossBorder: true, fromLat: 50.1, fromLon: 8.7, toLat: 51.5, toLon: -0.1, midLat: 50.8, midLon: 4.3, annualValueEur: 1000, pricingMethod: 'resale minus', note: null },
    { id: 'bad-flow', from: 'x', to: 'y', type: 'other', fromName: 'X', toName: 'Y', fromLat: null, fromLon: null, toLat: 1, toLon: 1, midLat: null, midLon: null },
  ],
};

function makeHarness({ responses }) {
  let call = 0;
  const layer = createTaxFlowsLayer({
    fetchImpl: async () => {
      const next = responses[Math.min(call, responses.length - 1)];
      call += 1;
      if (next instanceof Error) throw next;
      return { ok: next.ok !== false, json: async () => next.body };
    },
    screenSpaceEventHandlerFactory: () => ({ setInputAction() {}, destroy() {} }),
  });
  const dataSources = [];
  const viewer = {
    selectedEntity: undefined,
    dataSources: {
      add(ds) { dataSources.push(ds); return ds; },
      remove(ds) { const i = dataSources.indexOf(ds); if (i >= 0) dataSources.splice(i, 1); return i >= 0; },
    },
    scene: { canvas: {}, pick: () => null, requestRender() {} },
  };
  layer.init(viewer);
  return { layer, viewer, dataSources };
}

test('the manager-driven first update builds one arc per drawable flow', async () => {
  const { layer, viewer, dataSources } = makeHarness({ responses: [{ body: PACK_PAYLOAD }] });
  try {
    // The manager contract: enable() itself never fetches (that would double
    // every load); the manager runs the first update() immediately after.
    await layer.enable(viewer);
    assert.equal(layer.getStats().count, 0, 'enable alone fetches nothing');
    await layer.update(viewer);
    const stats = layer.getStats();
    assert.equal(stats.count, 1, 'the coordinate-less flow is skipped, not fatal');
    assert.equal(stats.error, null);
    assert.equal(layerFeedState(stats), 'nominal');
    const entity = dataSources[0].entities.values[0];
    assert.equal(entity.id, 'tax-flow:goods-a-b');
    assert.ok(entity.polyline, 'flows render as polyline arcs');
    assert.ok(entity.position, 'context anchor at the arc apex');

    const records = layer.getAnalystRecords();
    assert.equal(records.length, 2, 'analyst records cover ALL pack flows, drawable or not');
    assert.equal(records[0].flowType, 'goods');
    assert.equal(records[0].crossBorder, true);
  } finally {
    layer.destroy(viewer);
  }
});

test('an unreachable pack degrades the enable cycle instead of failing it', async () => {
  const { layer, viewer } = makeHarness({ responses: [new Error('offline')] });
  try {
    await layer.enable(viewer);
    // The manager contract: update must never read as lifecycle failure.
    const outcome = await layer.update(viewer);
    assert.notEqual(outcome, false);
    const stats = layer.getStats();
    assert.equal(layerFeedState(stats), 'unavailable');
    assert.deepEqual(layer.getAnalystRecords(), []);
  } finally {
    layer.destroy(viewer);
  }
});

test('disable gates analyst records; a later refresh failure keeps the arcs', async () => {
  const { layer, viewer } = makeHarness({ responses: [{ body: PACK_PAYLOAD }, new Error('offline')] });
  try {
    await layer.enable(viewer);
    await layer.update(viewer);
    await layer.update(viewer);
    const stats = layer.getStats();
    assert.equal(stats.count, 1, 'previous arcs survive a failed refresh');
    assert.equal(layerFeedState(stats), 'degraded');
    layer.disable(viewer);
    assert.deepEqual(layer.getAnalystRecords(), []);
  } finally {
    layer.destroy(viewer);
  }
});
