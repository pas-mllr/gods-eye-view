import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRegionalArticles,
  normalizeRegionalPlace,
  normalizeRegionalWeather,
  regionalDistanceM,
  weatherCodeLabel,
} from './regionalBrief.js';

test('normalizes a regional place with stable locality fallback', () => {
  assert.deepEqual(normalizeRegionalPlace({ address: {
    town: 'Davis', state: 'California', country: 'United States', country_code: 'us',
  } }), {
    label: 'Davis, California', locality: 'Davis', region: 'California',
    country: 'United States', countryCode: 'US',
  });
  assert.equal(normalizeRegionalPlace({ address: {} }), null);
});

test('normalizes, deduplicates, and rejects unsafe regional-news rows', () => {
  const articles = normalizeRegionalArticles({ articles: [
    { title: 'Regional update', url: 'https://news.example/one', domain: 'news.example', seendate: '20260722T081500Z' },
    { title: 'Regional   update', url: 'https://news.example/two' },
    { title: 'Unsafe', url: 'javascript:alert(1)' },
    { title: 'Second story', url: 'https://other.example/story', seendate: '2026-07-22T07:00:00Z' },
  ] });
  assert.equal(articles.length, 2);
  assert.equal(articles[0].publishedAt, '2026-07-22T08:15:00Z');
  assert.equal(articles[1].domain, 'other.example');
});

test('normalizes weather values and labels WMO conditions', () => {
  const weather = normalizeRegionalWeather({ current: {
    time: '2026-07-22T08:15:00Z', temperature_2m: 21.4, apparent_temperature: 20.8,
    precipitation: 0, cloud_cover: 42, wind_speed_10m: 18.2, wind_direction_10m: 270,
    visibility: 18000, weather_code: 2,
  } });
  assert.equal(weather.temperatureC, 21.4);
  assert.equal(weather.visibilityM, 18000);
  assert.equal(weatherCodeLabel(weather.weatherCode), 'PARTLY CLOUDY');
  assert.equal(normalizeRegionalWeather({ current: {} }), null);
});

test('zone-naive Open-Meteo timestamps are pinned to UTC, zoned ones pass through', () => {
  // Open-Meteo's default payload carries no zone designator; JS would parse it
  // as host-local time, skewing observedAt by the UTC offset.
  const naive = normalizeRegionalWeather({ current: { time: '2026-08-17T00:15', temperature_2m: 20 } });
  assert.equal(naive.observedAt, '2026-08-17T00:15:00.000Z');
  const zoned = normalizeRegionalWeather({ current: { time: '2026-08-17T00:15:00+02:00', temperature_2m: 20 } });
  assert.equal(zoned.observedAt, '2026-08-16T22:15:00.000Z');
  const invalid = normalizeRegionalWeather({ current: { time: 'not-a-time', temperature_2m: 20 } });
  assert.equal(invalid.observedAt, null);
});

test('regional distance handles nearby movement and missing positions', () => {
  const distance = regionalDistanceM(
    { latitude: 38.5, longitude: -121.7 },
    { latitude: 38.6, longitude: -121.7 },
  );
  assert.ok(distance > 11000 && distance < 11200);
  assert.equal(regionalDistanceM(null, null), Infinity);
});

test('the brief carries topic=tax exactly while a tax layer is registered', async () => {
  const { fetchRegionalBrief, setRegionalBriefTopicSource, activeRegionalBriefTopic } =
    await import('./regionalBrief.js');
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return { ok: true, json: async () => ({ status: 'ready' }) };
  };
  try {
    assert.equal(activeRegionalBriefTopic(), null, 'no topic before any layer registers');
    await fetchRegionalBrief(30.5, -97.5);
    assert.ok(!requested[0].includes('topic='), 'plain brief carries no topic param');

    setRegionalBriefTopicSource('local-tp-radar', true);
    setRegionalBriefTopicSource('local-tax-disputes', true);
    assert.equal(activeRegionalBriefTopic(), 'tax');
    await fetchRegionalBrief(30.5, -97.5);
    assert.ok(requested[1].includes('topic=tax'), 'tax brief carries topic=tax');

    // One tax layer off, the other still on → still tax-flavored.
    setRegionalBriefTopicSource('local-tp-radar', false);
    assert.equal(activeRegionalBriefTopic(), 'tax');

    // Both off → back to the plain brief, with nothing left behind.
    setRegionalBriefTopicSource('local-tax-disputes', false);
    assert.equal(activeRegionalBriefTopic(), null);
    await fetchRegionalBrief(30.5, -97.5);
    assert.ok(!requested[2].includes('topic='), 'topic clears with the last tax layer');
  } finally {
    globalThis.fetch = originalFetch;
    setRegionalBriefTopicSource('local-tp-radar', false);
    setRegionalBriefTopicSource('local-tax-disputes', false);
  }
});
