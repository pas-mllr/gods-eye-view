import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaxEventsLayer, createTaxEventOverlayEntry } from './taxEventsLayer.js';
import { layerFeedState } from './manager.js';

// contextStore reaches for the browser window; stub it exactly as the
// localGeojson harness does so register/select/clear work under node:test.
if (globalThis.window === undefined) globalThis.window = { dispatchEvent() {} };

function makeHarness({ responses }) {
  const hostCalls = [];
  const overlayHost = {
    setEntries: (...args) => hostCalls.push(['entries', ...args]),
    setVisible: (...args) => hostCalls.push(['visible', ...args]),
    clearSource: (...args) => hostCalls.push(['clear', ...args]),
  };
  let call = 0;
  const layer = createTaxEventsLayer({
    overlayHost,
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
  layer.enable(viewer);
  return { layer, viewer, hostCalls, dataSources };
}

const PAYLOAD = {
  retrievedAt: '2026-08-25T12:00:00Z',
  articleCount: 4,
  unmatchedCount: 1,
  points: [
    { iso2: 'DE', name: 'Germany', lat: 52.52, lon: 13.055, articleCount: 3, ageHours: 3, articles: [{ title: 'Audit wave', url: 'https://x.example/a', domain: 'x.example' }] },
    { iso2: 'US', name: 'United States', lat: 38.9072, lon: -77.3869, articleCount: 1, ageHours: 60, articles: [] },
  ],
};

test('a successful tick builds pins, cards, and analyst records', async () => {
  const { layer, viewer } = makeHarness({ responses: [{ body: PAYLOAD }] });
  try {
    const outcome = await layer.update(viewer);
    assert.notEqual(outcome, false);
    const stats = layer.getStats();
    assert.equal(stats.count, 2);
    assert.equal(stats.error, null);
    assert.equal(layerFeedState(stats), 'nominal');
    assert.match(stats.loadingLabel, /^LIVE · updated \d+m ago$/);

    const records = layer.getAnalystRecords();
    assert.equal(records.length, 2);
    assert.equal(records[0].iso2, 'DE');
    assert.equal(records[0].articleCount, 3);
    assert.equal(records[0].latestTitle, 'Audit wave');
  } finally {
    layer.destroy(viewer);
  }
});

test('a feed failure keeps the previous pins and degrades honestly', async () => {
  const { layer, viewer } = makeHarness({
    responses: [{ body: PAYLOAD }, new Error('offline')],
  });
  try {
    await layer.update(viewer);
    const outcome = await layer.update(viewer);
    assert.notEqual(outcome, false, 'a failed poll must never read as lifecycle failure');
    const stats = layer.getStats();
    assert.equal(stats.count, 2, 'previous pins survive the failed poll');
    assert.equal(stats.error, 'live feed unavailable');
    assert.equal(layerFeedState(stats), 'degraded');
    assert.equal(layer.getAnalystRecords().length, 2, 'analyst snapshot survives too');
  } finally {
    layer.destroy(viewer);
  }
});

test('a feed that never succeeds reads UNAVAILABLE, and disable empties analyst records', async () => {
  const { layer, viewer } = makeHarness({ responses: [new Error('offline')] });
  try {
    const outcome = await layer.update(viewer);
    assert.notEqual(outcome, false);
    const stats = layer.getStats();
    assert.equal(layerFeedState(stats), 'unavailable', 'no data + error = unavailable');

    // Recovery then disable: records gate on enablement like every layer.
    await layer.update(viewer);
  } finally {
    layer.destroy(viewer);
  }
});

test('disable gates analyst records and clears the overlay source', async () => {
  const { layer, viewer, hostCalls } = makeHarness({ responses: [{ body: PAYLOAD }] });
  try {
    await layer.update(viewer);
    assert.equal(layer.getAnalystRecords().length, 2);
    layer.disable(viewer);
    assert.deepEqual(layer.getAnalystRecords(), []);
    assert.ok(hostCalls.some(([kind, sourceId]) => kind === 'clear' && sourceId === 'tax-events'));
  } finally {
    layer.destroy(viewer);
  }
});

test('overlay cards render volume, age, and the latest headline', () => {
  const entry = createTaxEventOverlayEntry(
    { iso2: 'DE', name: 'Germany', articleCount: 3, ageHours: 3.2, articles: [{ title: 'Bundestag debates Pillar Two guidance in marathon session' }] },
    { x: 0, y: 0, z: 0 },
  );
  assert.equal(entry.title, 'Germany');
  assert.equal(entry.details[0], '3 articles · latest 3h ago');
  assert.ok(entry.details[1].startsWith('Bundestag debates Pillar Two'));
  assert.ok(entry.details[1].length <= 48);
  assert.equal(entry.variant, 'card');
  assert.equal(entry.priority, 1003);

  const single = createTaxEventOverlayEntry(
    { iso2: 'US', name: 'United States', articleCount: 1, ageHours: null, articles: [] },
    { x: 0, y: 0, z: 0 },
  );
  assert.equal(single.details[0], '1 article');
  assert.equal(single.details.length, 1);
});
