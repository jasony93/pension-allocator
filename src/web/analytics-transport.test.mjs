import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUmamiTransport, isAnalyticsConfigured } from './analytics.js';

/**
 * 전송 계층(Umami) 테스트 — D18 결정 반영.
 *
 * `track()`이 이미 화이트리스트로 정제한 payload를 전송 계층이 그대로
 * 실어 보내는지, 미설정 상태를 조용히 넘기지 않는지, 쿼리스트링이
 * 새지 않는지를 검사한다. `analytics.test.mjs`의 기존 계약(화이트리스트,
 * 중복 방지, fire-and-forget)은 건드리지 않는다.
 */

const SAMPLE_PAYLOAD = { session_id: 's-1', ts: 1710000000000, method: 'pdf' };

test('isAnalyticsConfigured() is false when either value is missing, true when both are set', () => {
  assert.equal(isAnalyticsConfigured({ collectUrl: '', websiteId: '' }), false);
  assert.equal(isAnalyticsConfigured({ collectUrl: 'https://umami.example.com/api/send', websiteId: '' }), false);
  assert.equal(isAnalyticsConfigured({ collectUrl: '', websiteId: 'abc-123' }), false);
  assert.equal(
    isAnalyticsConfigured({ collectUrl: 'https://umami.example.com/api/send', websiteId: 'abc-123' }),
    true,
  );
});

test('configured: sends via sendBeacon to the configured collectUrl', () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    sendBeaconImpl: (url, blob) => {
      calls.push({ url, blob });
      return true;
    },
    fetchImpl: () => {
      throw new Error('fetch should not be used when sendBeacon is available');
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: () => {},
  });

  transport('save_share_action', SAMPLE_PAYLOAD);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://umami.example.com/api/send');
});

test('configured: falls back to fetch(..., { keepalive: true }) when sendBeacon is unavailable', async () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    sendBeaconImpl: undefined,
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: () => {},
  });

  transport('save_share_action', SAMPLE_PAYLOAD);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://umami.example.com/api/send');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.keepalive, true);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.payload.name, 'save_share_action');
});

test('unconfigured: does not call sendBeacon or fetch, and warns clearly', () => {
  let beaconCalled = false;
  let fetchCalled = false;
  const warnings = [];
  const transport = createUmamiTransport({
    config: { collectUrl: '', websiteId: '' },
    sendBeaconImpl: () => {
      beaconCalled = true;
      return true;
    },
    fetchImpl: () => {
      fetchCalled = true;
      return Promise.resolve();
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: (...args) => warnings.push(args),
  });

  transport('save_share_action', SAMPLE_PAYLOAD);

  assert.equal(beaconCalled, false);
  assert.equal(fetchCalled, false);
  assert.equal(warnings.length, 1);
});

test('a transport failure (sendBeacon throws) never throws back to the caller', () => {
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    sendBeaconImpl: () => {
      throw new Error('sendBeacon exploded');
    },
    fetchImpl: () => {
      throw new Error('fetch exploded too');
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: () => {},
  });

  assert.doesNotThrow(() => transport('save_share_action', SAMPLE_PAYLOAD));
});

test('the query string and hash are stripped — only the path is sent as url', () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    sendBeaconImpl: (url, blob) => {
      calls.push(blob);
      return true;
    },
    fetchImpl: undefined,
    locationLike: { pathname: '/index.html', search: '?age=40&income=60000000', hash: '#anything' },
    warn: () => {},
  });

  transport('page_view', SAMPLE_PAYLOAD);

  return calls[0].text().then((text) => {
    const body = JSON.parse(text);
    assert.equal(body.payload.url, '/index.html');
    assert.ok(!body.payload.url.includes('?'));
    assert.ok(!body.payload.url.includes('age'));
    assert.ok(!body.payload.url.includes('60000000'));
  });
});

test('the sent data is exactly the payload track() produced — the transport adds no new properties', () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    sendBeaconImpl: undefined,
    fetchImpl: (url, init) => {
      calls.push(init.body);
      return Promise.resolve();
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: () => {},
  });

  transport('result_shown', { session_id: 's-1', anon_id: 'a-1', ts: 123, has_alternatives: true });

  const body = JSON.parse(calls[0]);
  assert.deepEqual(body.payload.data, { session_id: 's-1', anon_id: 'a-1', ts: 123, has_alternatives: true });
  assert.equal(body.payload.website, 'site-1');
  assert.equal(body.payload.name, 'result_shown');
});
