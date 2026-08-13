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

// D63(관리자 판정) — `sendBeacon`을 더 이상 쓰지 않는다. `navigator.sendBeacon()`의
// 반환값은 "브라우저 큐에 넣었다"만 뜻하고 수집기 도착을 보장하지 않는다 —
// 여기서 그 함수에 목을 세워 `true`를 돌려주면, 도착 여부와 무관하게 통과하는
// 검사가 되어 결함과 같은 모양을 만든다(그래서 D63이 실제로 놓쳤다). 도착 자체는
// 목으로 잴 수 없으므로 `analytics-delivery.browser.mjs`가 실제 Chrome +
// 실제 교차 오리진 수집기로 잰다. 여기서는 `fetch(..., { keepalive: true })`
// 하나만 쓰는 계약(호출 인자·once-per-session과 무관한 전송 계층의 모양)만 본다.
test('configured: sends via fetch(..., { keepalive: true }) to the configured collectUrl', async () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
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
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.keepalive, true);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.payload.name, 'save_share_action');
});

test('unconfigured: does not call fetch, and warns clearly', () => {
  let fetchCalled = false;
  const warnings = [];
  const transport = createUmamiTransport({
    config: { collectUrl: '', websiteId: '' },
    fetchImpl: () => {
      fetchCalled = true;
      return Promise.resolve();
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: (...args) => warnings.push(args),
  });

  transport('save_share_action', SAMPLE_PAYLOAD);

  assert.equal(fetchCalled, false);
  assert.equal(warnings.length, 1);
});

test('a transport failure (fetchImpl throws synchronously) never throws back to the caller', () => {
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    fetchImpl: () => {
      throw new Error('fetch exploded');
    },
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: () => {},
  });

  assert.doesNotThrow(() => transport('save_share_action', SAMPLE_PAYLOAD));
});

test('a rejected fetch promise is swallowed (fire-and-forget)', async () => {
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    fetchImpl: () => Promise.reject(new Error('network down')),
    locationLike: { pathname: '/result', search: '', hash: '' },
    warn: () => {},
  });

  assert.doesNotThrow(() => transport('save_share_action', SAMPLE_PAYLOAD));
  // 마이크로태스크 큐가 돌 시간을 준다 — 여기서 unhandled rejection이 나면 안 된다.
  await new Promise((resolve) => setTimeout(resolve, 10));
});

test('the query string and hash are stripped — only the path is sent as url', () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    fetchImpl: (url, init) => {
      calls.push(init.body);
      return Promise.resolve({ ok: true });
    },
    locationLike: { pathname: '/index.html', search: '?age=40&income=60000000', hash: '#anything' },
    warn: () => {},
  });

  transport('page_view', SAMPLE_PAYLOAD);

  const body = JSON.parse(calls[0]);
  assert.equal(body.payload.url, '/index.html');
  assert.ok(!body.payload.url.includes('?'));
  assert.ok(!body.payload.url.includes('age'));
  assert.ok(!body.payload.url.includes('60000000'));
});

test('the sent data is exactly the payload track() produced — the transport adds no new properties', () => {
  const calls = [];
  const transport = createUmamiTransport({
    config: { collectUrl: 'https://umami.example.com/api/send', websiteId: 'site-1' },
    fetchImpl: (url, init) => {
      calls.push(init.body);
      return Promise.resolve({ ok: true });
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

// ---------------------------------------------------------------------------
// 늘어난 입력이 전송 계층까지 새지 않는가 (계약 4.0.0으로 입력이 넷 늘었다)
//
// **화이트리스트를 믿지 않고 바이트를 본다.** `growth`가 지난 회차에 전송
// payload를 가로채 화이트리스트가 실제로 버리는지 확인한 전례가 있다. 같은
// 방식으로, 이번에 늘어난 입력(생년월일·직전 과세연도 결정세액·연금 수령 여부·
// 청년 자기신고)을 폼에 넣고 **실제로 나가는 문자열**을 검사한다.
// ---------------------------------------------------------------------------

import { createAnalytics } from './analytics.js';
import { createStore } from './state/store.js';
import { SCHEMA_VERSION } from './engine/engine-client.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

const SECRETS = {
  생년월일: '1988-03-15',
  생년: '1988',
  월일: '03-15',
  총급여액: '62000000',
  월납입여력: '812345',
  자금사용시점: 'within_isa_lock_in',
  ISA누적납입액: '17654321',
  청년자기신고: 'declaredYouth',
  연금수령여부: 'annuityStarted',
};

test('nothing the user typed reaches the wire — every new 4.0.0 input included', async () => {
  const wire = [];
  const analytics = createAnalytics({
    sessionStorageImpl: memoryStorage(),
    localStorageImpl: memoryStorage(),
    transport: (eventName, payload) => wire.push(JSON.stringify({ eventName, payload })),
  });

  const engineClient = {
    compute: async () => ({
      ok: true,
      schema_version: SCHEMA_VERSION,
      echo: {},
      scenarios: [
        {
          scenario_id: 'current',
          account_eligibility: [{ account: 'isa', eligible: true, reason_codes: [], basis_rule_ids: [] }],
          notices: [],
          plans: [{ plan_id: 'max_tax_credit', is_baseline: true }],
        },
      ],
      assumptions: [],
    }),
    computeFundUseHorizonBoundaries: async () => ({ ok: true, schema_version: SCHEMA_VERSION, boundaries: {}, legal_basis: [], notices: [] }),
    loadProvisionalYouthRule: async () => null,
  };

  const store = createStore({ engineClient, analytics, onChange: () => {} });
  store.setField('birthDate', SECRETS.생년월일);
  store.setField('currentSalary', SECRETS.총급여액);
  // 9.0.0(D39) — `profile.prior_year_tax`가 사라졌다. 그 물음 자체가 없다.
  store.setField('monthlyCapacity', SECRETS.월납입여력);
  store.setField('annuityStarted', true);
  store.setField('declaredYouth', true);
  store.setField('isaExists', true);
  store.setField('isaCumulative', SECRETS.ISA누적납입액);
  store.setField('isaFinancialIncomeTaxpayer', 'yes');
  store.setField('fundUseHorizon', SECRETS.자금사용시점, { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  store.reportSaveShare('screenshot');
  store.reportAlternativeClick();

  assert.ok(wire.length > 0, '아무 이벤트도 나가지 않으면 이 검사가 아무것도 증명하지 않는다');
  const sent = wire.join('\n');
  for (const [label, secret] of Object.entries(SECRETS)) {
    assert.ok(!sent.includes(secret), `${label}이 전송 payload에 실렸다: ${secret}\n${sent}`);
  }
  // 남는 것은 익명 식별자·시각·필드 이름·불리언 하나뿐이다.
  for (const line of wire) {
    const { payload } = JSON.parse(line);
    for (const key of Object.keys(payload)) {
      assert.ok(
        ['session_id', 'anon_id', 'ts', 'field_name', 'has_alternatives', 'method', 'utm_source', 'utm_medium', 'device_type'].includes(key),
        `허용 목록 밖 속성이 나갔다: ${key}`,
      );
    }
  }
});
