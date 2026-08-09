/**
 * 계측 — `docs/stage-2-design/analytics-plan.md`의 이벤트만 심는다.
 *
 * 절대 규칙(헌장 "계측 허용 판정" + analytics-plan.md 1절):
 * - 나이·소득·납입액·계산 결과 금액 등 입력값·계산 결과는 원본이든 구간화든
 *   해시든 **어떤 형태로도** 이벤트에 싣지 않는다.
 * - 이벤트마다 허용된 속성 키만 화이트리스트로 강제한다(6-4절). 목록에 없는
 *   키를 넘기면 개발 모드에서 즉시 에러를 던진다 — "나중에 폼 전체를 같이
 *   보내자"는 유혹을 코드 차원에서 막는다.
 * - fire-and-forget이다. 계측이 실패해도 계산 기능에 영향을 주지 않는다(6-5절).
 *
 * 전송 계층(관리자 결정 D18, 게이트 5): 수집기는 자체 호스팅 Umami로 확정됐다.
 * 엔드포인트·website ID는 코드에 박지 않고 `analytics-config.js` 한 곳에서만
 * 읽는다 — 그 파일의 주석이 사람이 채워야 할 설정 지점이다.
 */

import { ANALYTICS_CONFIG } from './analytics-config.js';

const EVENT_SCHEMA = {
  page_view: ['session_id', 'ts', 'utm_source', 'utm_medium', 'device_type'],
  input_start: ['session_id', 'ts', 'field_name', 'utm_source', 'utm_medium', 'device_type'],
  result_shown: ['session_id', 'anon_id', 'ts', 'has_alternatives'],
  save_share_action: ['session_id', 'ts', 'method'],
  alternative_row_click: ['session_id', 'ts'],
};

const ONCE_PER_SESSION = new Set(['input_start', 'result_shown']);

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // 폴백 — 브라우저 crypto가 없는 극히 드문 환경(구형 브라우저) 대비.
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeStorage(storage) {
  // 프라이빗 브라우징 등에서 storage 접근이 예외를 던질 수 있다 — 계측은
  // 계산 기능을 절대 막지 않아야 하므로 전부 감싼다.
  return {
    get(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
        /* noop */
      }
    },
  };
}

export function createAnalytics({
  sessionStorageImpl = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  localStorageImpl = typeof localStorage !== 'undefined' ? localStorage : null,
  transport = defaultTransport,
  strict = false,
} = {}) {
  const sessionStore = sessionStorageImpl ? safeStorage(sessionStorageImpl) : { get: () => null, set: () => {} };
  const localStore = localStorageImpl ? safeStorage(localStorageImpl) : { get: () => null, set: () => {} };

  function sessionId() {
    let id = sessionStore.get('anon_session_id');
    if (!id) {
      id = uuid();
      sessionStore.set('anon_session_id', id);
    }
    return id;
  }

  function anonId() {
    let id = localStore.get('anon_id');
    if (!id) {
      id = uuid();
      localStore.set('anon_id', id);
    }
    return id;
  }

  const sentOnce = new Set();

  function alreadySent(eventName) {
    if (!ONCE_PER_SESSION.has(eventName)) return false;
    const flagKey = `anon_sent_${eventName}`;
    if (sentOnce.has(eventName)) return true;
    if (sessionStore.get(flagKey) === '1') {
      sentOnce.add(eventName);
      return true;
    }
    return false;
  }

  function markSent(eventName) {
    if (!ONCE_PER_SESSION.has(eventName)) return;
    sentOnce.add(eventName);
    sessionStore.set(`anon_sent_${eventName}`, '1');
  }

  function track(eventName, properties = {}) {
    const allowedKeys = EVENT_SCHEMA[eventName];
    if (!allowedKeys) {
      const msg = `analytics: unknown event "${eventName}"`;
      if (strict) throw new Error(msg);
      return;
    }
    const unknownKeys = Object.keys(properties).filter((k) => !allowedKeys.includes(k));
    if (unknownKeys.length > 0) {
      const msg = `analytics: event "${eventName}" received disallowed properties: ${unknownKeys.join(', ')}`;
      if (strict) throw new Error(msg);
      // 프로덕션에서는 화이트리스트 밖 속성을 조용히 버린다 — 계측 실패가
      // 계산 기능을 막아서는 안 된다는 6-5절 원칙을 지킨다.
    }

    if (alreadySent(eventName)) return;

    const payload = { session_id: sessionId(), ts: Date.now() };
    if (allowedKeys.includes('anon_id')) payload.anon_id = anonId();
    for (const key of allowedKeys) {
      if (key === 'session_id' || key === 'ts' || key === 'anon_id') continue;
      if (key in properties) payload[key] = properties[key];
    }

    markSent(eventName);
    try {
      transport(eventName, payload);
    } catch {
      /* fire-and-forget: 전송 실패가 계산 기능에 영향을 주지 않는다 */
    }
  }

  return { track, sessionId, anonId };
}

/**
 * 설정 지점(`analytics-config.js`)이 채워졌는지 조회한다. QA·운영이 배포 전
 * 기계적으로 검사할 수 있도록 노출한다 — "조용한 no-op"이 이번 사고의 본질이었다.
 */
export function isAnalyticsConfigured(config = ANALYTICS_CONFIG) {
  return Boolean(config?.collectUrl) && Boolean(config?.websiteId);
}

function pathOnly(locationLike) {
  try {
    return locationLike?.pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * Umami 이벤트 수집 프로토콜(`POST {collectUrl}`, body `{ type: 'event', payload }`)로
 * 감싸는 전송 계층. `track()`이 이미 화이트리스트로 정제한 `payload`를 `data`에
 * 그대로 싣는다 — 여기서 속성을 새로 붙이지 않는다. 페이지 URL은 쿼리스트링·해시를
 * 제거한 경로만 보낸다(요구사항 5).
 *
 * `sendBeacon`을 우선 쓰고(결과 화면 이탈 시점에도 유실 없이 전송), 없으면
 * `fetch(..., { keepalive: true })`로 폴백한다. 실패해도 호출자에게 예외를
 * 올리지 않는다(fire-and-forget, 6-5절) — `createAnalytics().track()`의 바깥쪽
 * try/catch와 별개로 이 함수 자체도 스스로 안전하게 막는다.
 */
export function createUmamiTransport({
  config = ANALYTICS_CONFIG,
  sendBeaconImpl = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
    ? navigator.sendBeacon.bind(navigator)
    : undefined,
  fetchImpl = typeof fetch !== 'undefined' ? fetch : undefined,
  locationLike = typeof window !== 'undefined' ? window.location : undefined,
  warn = typeof console !== 'undefined' ? console.warn.bind(console) : () => {},
} = {}) {
  return function umamiTransport(eventName, payload) {
    try {
      if (!isAnalyticsConfigured(config)) {
        warn(
          'analytics: collector가 설정되지 않았습니다 (src/web/analytics-config.js를 채우세요). 이벤트가 전송되지 않습니다:',
          eventName,
        );
        return;
      }

      const body = JSON.stringify({
        type: 'event',
        payload: {
          website: config.websiteId,
          url: pathOnly(locationLike),
          name: eventName,
          data: payload,
        },
      });

      if (sendBeaconImpl) {
        const blob = typeof Blob !== 'undefined' ? new Blob([body], { type: 'application/json' }) : body;
        const ok = sendBeaconImpl(config.collectUrl, blob);
        if (ok) return;
      }

      if (fetchImpl) {
        fetchImpl(config.collectUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {
          /* fire-and-forget: 네트워크 실패가 계산 기능에 영향을 주지 않는다 */
        });
      }
    } catch {
      /* fire-and-forget: 전송 계층 자체의 예외도 호출자에게 올리지 않는다 */
    }
  };
}

function defaultTransport(eventName, payload) {
  createUmamiTransport()(eventName, payload);
}

export function deviceType() {
  if (typeof navigator === 'undefined') return 'desktop';
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

export function utmFromLocation(locationLike) {
  try {
    const params = new URLSearchParams(locationLike?.search ?? '');
    return {
      utm_source: params.get('utm_source') ?? undefined,
      utm_medium: params.get('utm_medium') ?? undefined,
    };
  } catch {
    return {};
  }
}

export { EVENT_SCHEMA };
