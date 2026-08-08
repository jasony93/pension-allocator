import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics, EVENT_SCHEMA } from './analytics.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

function makeAnalytics(overrides = {}) {
  const sent = [];
  return {
    sent,
    analytics: createAnalytics({
      sessionStorageImpl: memoryStorage(),
      localStorageImpl: memoryStorage(),
      transport: (name, payload) => sent.push({ name, payload }),
      strict: true,
      ...overrides,
    }),
  };
}

test('every event in the whitelist only ever contains age/income/allocation-shaped values by name, never by accident', () => {
  // 화이트리스트 자체가 "금지 값의 이름"을 포함하지 않는지 정적으로 확인한다.
  const forbidden = /age|salary|income|krw|contribution|capacity|budget|amount/i;
  for (const [event, keys] of Object.entries(EVENT_SCHEMA)) {
    for (const key of keys) {
      assert.ok(!forbidden.test(key), `event "${event}" key "${key}" looks like it could carry a forbidden value`);
    }
  }
});

test('track() drops/rejects properties outside the whitelist', () => {
  const { analytics } = makeAnalytics();
  assert.throws(() => analytics.track('result_shown', { has_alternatives: true, age_years: 38 }));
});

test('track() rejects unknown event names', () => {
  const { analytics } = makeAnalytics();
  assert.throws(() => analytics.track('totally_made_up_event', {}));
});

test('result_shown and input_start fire at most once per session', () => {
  const { analytics, sent } = makeAnalytics();
  analytics.track('input_start', { field_name: 'age' });
  analytics.track('input_start', { field_name: 'age' });
  analytics.track('input_start', { field_name: 'monthly_capacity' });
  assert.equal(sent.filter((e) => e.name === 'input_start').length, 1);
});

test('save_share_action and alternative_row_click can fire repeatedly in one session', () => {
  const { analytics, sent } = makeAnalytics();
  analytics.track('save_share_action', { method: 'screenshot' });
  analytics.track('save_share_action', { method: 'link_copy' });
  assert.equal(sent.filter((e) => e.name === 'save_share_action').length, 2);
});

test('every sent payload carries session_id and ts, and nothing else beyond the schema', () => {
  const { analytics, sent } = makeAnalytics();
  analytics.track('alternative_row_click', {});
  const payload = sent[0].payload;
  assert.ok(payload.session_id);
  assert.ok(payload.ts);
  assert.deepEqual(Object.keys(payload).sort(), ['session_id', 'ts']);
});

test('anon_id is only attached to events that declare it (result_shown), not others', () => {
  const { analytics, sent } = makeAnalytics();
  analytics.track('page_view', {});
  analytics.track('result_shown', { has_alternatives: false });
  assert.ok(!('anon_id' in sent.find((e) => e.name === 'page_view').payload));
  assert.ok('anon_id' in sent.find((e) => e.name === 'result_shown').payload);
});

test('a transport failure never throws back to the caller (fire-and-forget)', () => {
  const { analytics } = makeAnalytics({
    transport: () => {
      throw new Error('network down');
    },
  });
  assert.doesNotThrow(() => analytics.track('page_view', {}));
});

test('session_id is stable across calls within the same session storage', () => {
  const { analytics } = makeAnalytics();
  const a = analytics.sessionId();
  const b = analytics.sessionId();
  assert.equal(a, b);
});

test('anon_id persists across a fresh analytics instance backed by the same localStorage', () => {
  const localStorageImpl = memoryStorage();
  const first = createAnalytics({ sessionStorageImpl: memoryStorage(), localStorageImpl, transport: () => {} });
  const id1 = first.anonId();
  const second = createAnalytics({ sessionStorageImpl: memoryStorage(), localStorageImpl, transport: () => {} });
  const id2 = second.anonId();
  assert.equal(id1, id2);
});
