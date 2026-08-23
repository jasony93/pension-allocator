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
 * **[2026-08-23, D82 판정 3] v2 — 위치 기반 압축 인코딩.** v1(JSON을 그대로
 * base64url로 싼 것)은 키 이름을 매번 다시 실어 길다. v2는 키 이름을 버리고
 * `SHARE_LINK_FIELDS`의 **고정 순서**만으로 값을 위치로 식별한다 — 필드
 * 앞에 "몇 번째 값인가"라는 정보를 실을 필요가 없다. 원칙은 그대로다(프래그먼트
 * 전용, 서버 전송 없음, 공유 시점 고지 문구 유지, D74) — **바뀌는 것은 인코딩
 * 밀도뿐이다.**
 *
 * - **접두 `v2.`** — 리터럴 문자열이다(v1의 base64url 알파벳은 `.`을 낼 수
 *   없으므로 이 접두만으로 v1/v2를 명확히 가른다, `decodeShareFragment` 참고).
 * - **구분자 `.`** — `SHARE_LINK_FIELDS` 순서 그대로, 값 27개를 `.`으로 잇는다.
 * - **불리언은 1글자** — 참 `1`, 거짓 `0`, 모름(`null`)은 빈 슬롯.
 * - **금액은 이미 만원 단위 정수 문자열이다**(화면 입력 자체가 그렇다, `store.js`
 *   머리말) — 그대로 싣는다. 그 밖의 문자열(날짜·열거값)도 그대로 싣는다.
 * - **빈 값은 빈 슬롯** — 아무 값도 넣지 않는다(`''`).
 * - **값 안의 `.`은 이스케이프한다.** 유일하게 소수점을 가질 수 있는
 *   `isaReturnRatePercent`(예: `3.5`)가 구분자와 부딪히지 않도록, 인코딩
 *   시 `%`→`%25`, `.`→`%2E` 순서로 바꾼다(표준 퍼센트 인코딩의 부분집합 —
 *   이 두 글자만 다룬다). 나머지 필드는 이 두 글자를 쓰지 않으므로 사실상
 *   손대지 않는 값 그대로 나간다.
 * - **`null`(모름)과 `''`(빈 문자열)을 구분해 복원한다.** 세 열거값 필드
 *   (`fundUseHorizon`·`isaFinancialIncomeTaxpayer`·`isaIncomeCharacter`)는
 *   기본값이 `null`(아직 고르지 않음)이라 빈 슬롯을 `null`로 되돌리고,
 *   나머지(금액·날짜 등, 기본값이 `''`)는 빈 슬롯을 `''`로 되돌린다
 *   (`SHARE_LINK_NULLABLE_STRING_FIELDS`) — `state/store.js`의
 *   `initialForm()` 기본값과 어긋나면 안 되는 자리다.
 *
 * **v1 링크는 계속 열린다** — `decodeShareFragment`가 접두로 두 판을 가른
 * 뒤 각자의 디코더로 넘긴다. 이미 공유된 옛 링크를 죽이지 않는다(D82 판정 3
 * 원문).
 *
 * **버전 필드를 넣는 이유는 v1과 같다.** 폼 스키마가 나중에 바뀌면(필드
 * 추가·삭제) 옛 링크를 조용히 잘못 해석하는 대신 "이 링크는 읽을 수 없다"고
 * 말할 수 있어야 한다 — v1은 페이로드 안의 `v` 필드가, v2는 접두와 세그먼트
 * 개수가 그 방패다(개수가 다르면 스키마가 바뀐 것이므로 `version_mismatch`).
 */

const SHARE_LINK_VERSION = 1;
const SHARE_LINK_V2_PREFIX = 'v2.';

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
 * [2026-08-23, D82 판정 3] v2 인코딩이 각 필드를 어떻게 다루는지 — `state/store.js`의
 * `initialForm()`을 근거로 정했다(코드로 값을 보고 정하지 않았다 — 셋 다
 * "지금은 우연히 비슷해 보이는" 값이 아니라 그 필드의 실제 의미다).
 *
 * - `true`(`SHARE_LINK_BOOLEAN_FIELDS`) — `initialForm()` 기본값이 `false`
 *   또는 `null`인 토글/3택 물음. 1글자(`1`/`0`), 빈 슬롯은 `null`.
 * - `false`이지만 `SHARE_LINK_NULLABLE_STRING_FIELDS`에 있다 — `initialForm()`
 *   기본값이 `null`인 열거값 물음(아직 고르지 않음이 "빈 문자열"이 아니라
 *   "값 자체가 없음"이다). 빈 슬롯은 `null`.
 * - 그 밖(`false`, 목록에도 없음) — `initialForm()` 기본값이 `''`인 금액·
 *   날짜·열거값. 빈 슬롯은 `''`.
 */
const SHARE_LINK_BOOLEAN_FIELDS = new Set([
  'hasNonWageIncome',
  'priorSalaryEnabled',
  'annuityStarted',
  'declaredYouth',
  'isaExists',
  'isaTransferEnabled',
  'isaReturnEnabled',
]);
const SHARE_LINK_NULLABLE_STRING_FIELDS = new Set(['fundUseHorizon', 'isaFinancialIncomeTaxpayer', 'isaIncomeCharacter']);

/** 3택 불리언 → 1글자. `null`/`undefined`는 빈 슬롯(모름)이다. */
function encodeBoolSegment(value) {
  if (value === true) return '1';
  if (value === false) return '0';
  return '';
}
function decodeBoolSegment(segment) {
  if (segment === '1') return true;
  if (segment === '0') return false;
  return null;
}

/**
 * 값 안의 `.`이 v2의 구분자와 부딪히지 않도록 최소한으로 이스케이프한다 —
 * 표준 퍼센트 인코딩과 같은 관행이지만 이 두 글자만 다룬다(`%`을 먼저 바꿔야
 * 그 다음에 만드는 `%2E`의 `%`까지 다시 바뀌는 것을 막는다 — 순서가 중요하다).
 */
function escapeSegmentValue(value) {
  return String(value).replace(/%/g, '%25').replace(/\./g, '%2E');
}
function unescapeSegmentValue(segment) {
  return segment.replace(/%2E/g, '.').replace(/%25/g, '%');
}

function encodeStringSegment(value) {
  if (value === null || value === undefined || value === '') return '';
  return escapeSegmentValue(value);
}
function decodeStringSegment(segment, key) {
  if (segment === '') return SHARE_LINK_NULLABLE_STRING_FIELDS.has(key) ? null : '';
  return unescapeSegmentValue(segment);
}

/**
 * `form` → v2 프래그먼트(선행 `#`도 `v2.` 접두도 이미 포함된 문자열은 아니다
 * — `v2.` 접두 뒤 `SHARE_LINK_FIELDS` 순서대로 값 27개를 `.`으로 잇는다).
 */
function encodeShareFragmentV2(form) {
  const segments = SHARE_LINK_FIELDS.map((key) => {
    const value = form?.[key] ?? null;
    return SHARE_LINK_BOOLEAN_FIELDS.has(key) ? encodeBoolSegment(value) : encodeStringSegment(value);
  });
  return `${SHARE_LINK_V2_PREFIX}${segments.join('.')}`;
}

/**
 * v2 프래그먼트(선행 `#` 없이, `v2.` 접두 포함) → `{ ok, form }`/`{ ok, reason }`.
 * **세그먼트 개수가 `SHARE_LINK_FIELDS`와 다르면 `version_mismatch`다** —
 * v1의 `payload.v !== SHARE_LINK_VERSION`과 같은 방패: 필드가 늘거나 줄면
 * 옛 v2 링크를 잘못된 자리에 값을 꽂아 읽는 대신 명시로 거절한다.
 */
function decodeShareFragmentV2(fragment) {
  const rest = fragment.slice(SHARE_LINK_V2_PREFIX.length);
  // 값 자체는 이스케이프됐으므로(`.`→`%2E`) 이 시점의 `.` 분할은 항상 진짜
  // 구분자만 가른다 — 갈라진 조각 안에 남는 `.`이 없다. 필드가 27개면 빈
  // 값이어도 구분자 26개가 남으므로 `rest`가 완전히 빈 문자열일 일은 없다.
  const segments = rest.split('.');
  if (segments.length !== SHARE_LINK_FIELDS.length) return { ok: false, reason: 'version_mismatch' };
  const form = {};
  SHARE_LINK_FIELDS.forEach((key, i) => {
    form[key] = SHARE_LINK_BOOLEAN_FIELDS.has(key) ? decodeBoolSegment(segments[i]) : decodeStringSegment(segments[i], key);
  });
  return { ok: true, form };
}

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

/**
 * [2026-08-23, D82 판정 3] v1 — JSON을 그대로 base64url로 싼 옛 인코딩.
 * **더는 `buildShareUrl`이 만들지 않는다**(그 자리는 v2가 가져갔다) — 이미
 * 공유된 옛 링크를 여전히 읽으려고(`decodeShareFragmentV1`) 이름만 바꿔
 * 남긴다. `export`로 여는 이유는 옛 링크 하위 호환을 실측하는 시험
 * (`share-link.test.mjs`)이 v1 픽스처를 직접 만들어야 하기 때문이다.
 */
export function encodeShareFragmentV1(form) {
  const payload = { v: SHARE_LINK_VERSION };
  for (const key of SHARE_LINK_FIELDS) payload[key] = form?.[key] ?? null;
  return base64UrlEncode(JSON.stringify(payload));
}

function decodeShareFragmentV1(fragment) {
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
 * `form` → 프래그먼트 문자열(선행 `#` 없이). **[2026-08-23, D82 판정 3]
 * v2를 낸다** — 같은 값을 실어도 v1보다 짧다(길이 비교는 최종 보고 참고).
 */
export function encodeShareFragment(form) {
  return encodeShareFragmentV2(form);
}

/**
 * 프래그먼트 문자열(선행 `#` 없이) → `{ ok: true, form }` 또는
 * `{ ok: false, reason }`. **조용히 무시하지 않는다** — 실패 이유를 셋으로
 * 가른다(`decode_failed`: base64url 자체가 깨짐, `parse_failed`: JSON이
 * 아니거나 객체가 아님, `version_mismatch`: 버전/필드 수가 다름). 호출부가 이
 * `reason`으로 짧은 안내를 낼 수 있다(`copy.js`의 `SHARE_LINK_INVALID_NOTE`).
 *
 * **[2026-08-23, D82 판정 3] 접두로 v1/v2를 가른다.** `v2.`로 시작하면
 * v2(리터럴 접두 — base64url 알파벳은 `.`을 내지 않으므로 v1과 절대
 * 겹치지 않는다), 아니면 옛 v1 경로(base64url+JSON) 그대로 시도한다 — 이미
 * 공유된 v1 링크가 이 함수 하나로 계속 열린다.
 */
export function decodeShareFragment(fragment) {
  if (!fragment) return { ok: false, reason: 'empty' };
  if (fragment.startsWith(SHARE_LINK_V2_PREFIX)) return decodeShareFragmentV2(fragment);
  return decodeShareFragmentV1(fragment);
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
