/**
 * 결과 공유 링크(관리자 지시 7번, D74) — URL **프래그먼트**(`#...`)에 입력값을
 * 싣는다. **쿼리 문자열(`?...`)은 쓰지 않는다** — 쿼리는 HTTP 요청에 실려
 * GitHub Pages 서버 로그에 도달하고, 그 순간 "입력값은 서버로 나가지
 * 않는다"는 제품 원칙 4가 깨진다(D74). 프래그먼트는 브라우저가 애초에
 * 서버로 보내지 않는다 — 요청에 실리지 않고, 서버 로그에 남지 않으며,
 * 링크를 받은 쪽 브라우저 안에서만 풀린다.
 *
 * **생년월일도 싣는다(D74가 D21 계열 규칙을 좁혔다).** D21의 "생년월일을
 * URL·공유물에 넣지 않는다"가 막던 것은 **우리가 사용자 모르게 흘리는 것**
 * 이었다 — 이 버튼은 **사용자가 자기 값을 자기 뜻으로 보내는 행위**라 성질이
 * 다르다. 그 차이가 성립하는 조건 둘을 D74가 못박았다 — (1) 공유 시점에
 * "이 링크에는 입력하신 값이 들어 있습니다"가 반드시 보여야 한다(호출부,
 * `ui/result-panel.js`의 공유 버튼 핸들러), (2) 프래그먼트 한정 — 이 파일이
 * 그것을 구조로 보장한다(아래 `buildShareUrl`).
 *
 * **버전 필드(`v`)를 넣는다.** 폼 스키마가 나중에 바뀌면(필드 추가·삭제)
 * 옛 링크를 조용히 잘못 해석하는 대신 "이 링크는 읽을 수 없다"고 말할 수
 * 있어야 한다 — `decodeShareFragment`가 버전이 다르면 `version_mismatch`로
 * 명시로 실패한다.
 */

const SHARE_LINK_VERSION = 1;

/**
 * 프래그먼트에 실을 필드만 **명시로 고른다.** `state/store.js`의
 * `initialForm()` 전체를 그대로 직렬화하지 않는다 — 필드 목록을 한 곳에
 * 못박아 두지 않으면 이 파일이 무엇을 내보내는지 다음 사람이 코드를 읽지
 * 않고는 알 수 없다. `initialForm()`과 같은 키 이름을 쓴다(값을 옮길 때
 * 이름을 바꾸지 않는다 — `applySharedForm`이 그대로 `store.setField`에
 * 넘길 수 있어야 한다).
 */
export const SHARE_LINK_FIELDS = [
  'birthDate',
  'currentSalary',
  'hasNonWageIncome',
  'globalIncomeAmount',
  'priorSalaryEnabled',
  'priorSalary',
  'annuityStarted',
  'declaredYouth',
  'fundUseHorizon',
  'monthlyCapacity',
  'annuitySavingsYtd',
  'retirementPensionYtd',
  'isaExists',
  'isaAccountType',
  'isaCumulative',
  'isaYtd',
  'isaYearsSinceOpening',
  'isaFinancialIncomeTaxpayer',
  'isaTransferEnabled',
  'isaTransferAmount',
  'isaTransferDestination',
  'isaTransferPriorApplied',
  'isaReturnEnabled',
  'isaReturnRatePercent',
  'isaIncomeCharacter',
  'isaSettlementYears',
  'isaLossAmount',
];

/**
 * UTF-8 문자열 → base64url. 표준 `btoa`는 Latin1 바이트 문자열만 받으므로
 * 한글이 섞인 JSON을 바로 넣으면 예외가 난다 — `TextEncoder`로 UTF-8
 * 바이트를 먼저 만든다. `+`/`/`·패딩(`=`)을 URL 프래그먼트에 안전한
 * `-`/`_`로 바꾸고 패딩은 뗀다(compact — 관리자 지시 "compact하게").
 */
function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** `form` → 프래그먼트 문자열(선행 `#` 없이). 버전 필드를 함께 담는다. */
export function encodeShareFragment(form) {
  const payload = { v: SHARE_LINK_VERSION };
  for (const key of SHARE_LINK_FIELDS) payload[key] = form?.[key] ?? null;
  return base64UrlEncode(JSON.stringify(payload));
}

/**
 * 프래그먼트 문자열(선행 `#` 없이) → `{ ok: true, form }` 또는
 * `{ ok: false, reason }`. **조용히 무시하지 않는다** — 실패 이유를 셋으로
 * 가른다(`decode_failed`: base64url 자체가 깨짐, `parse_failed`: JSON이
 * 아니거나 객체가 아님, `version_mismatch`: 버전이 다름). 호출부가 이
 * `reason`으로 짧은 안내를 낼 수 있다(`copy.js`의 `SHARE_LINK_INVALID_NOTE`).
 */
export function decodeShareFragment(fragment) {
  if (!fragment) return { ok: false, reason: 'empty' };
  let json;
  try {
    json = base64UrlDecode(fragment);
  } catch {
    return { ok: false, reason: 'decode_failed' };
  }
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'parse_failed' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, reason: 'parse_failed' };
  if (payload.v !== SHARE_LINK_VERSION) return { ok: false, reason: 'version_mismatch' };
  const form = {};
  for (const key of SHARE_LINK_FIELDS) if (key in payload) form[key] = payload[key];
  return { ok: true, form };
}

/**
 * 공유 URL을 만든다. **선행 `#`이고, 물음표(`?`)가 어디에도 없다** —
 * `share-link.test.mjs`가 이것을 기계로 고정한다(D74 "프래그먼트이지
 * 쿼리가 아니다"). `locationLike`는 테스트·SSR 없는 환경을 위한 주입점이다.
 */
export function buildShareUrl(form, { locationLike = typeof window !== 'undefined' ? window.location : undefined } = {}) {
  const base = locationLike ? `${locationLike.origin}${locationLike.pathname}` : '';
  return `${base}#${encodeShareFragment(form)}`;
}

/**
 * 현재 위치의 프래그먼트를 읽어 디코드한다. 프래그먼트가 아예 없으면(첫
 * 방문·공유 링크가 아닌 일반 방문) `null` — 이 경우는 "잘못된 링크"가
 * 아니라 "공유 링크가 아니다"이므로 안내를 내지 않는다(호출부가 구분한다).
 */
export function readShareFragmentFromLocation(locationLike = typeof window !== 'undefined' ? window.location : undefined) {
  const hash = locationLike?.hash ?? '';
  if (!hash || hash === '#') return null;
  return decodeShareFragment(hash.slice(1));
}
