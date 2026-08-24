/**
 * 「연금고갈 시뮬레이션」 탭의 공유 링크(소유자 지시 5번) — 계산기2 공유
 * 링크(`state/share-link.js`, D74)와 **같은 관행**을 슬라이더 값에 적용한다.
 *
 * **프래그먼트만, 쿼리는 쓰지 않는다** — 이 값들은 개인 식별 정보가 아니라
 * 거시 가정(수익률·보험료율 등)이지만, "입력값은 서버로 나가지 않는다"는
 * 원칙(제품 원칙 4)과 "공유 시점 고지" 관행은 값의 성격과 무관하게 이
 * 저장소 전체에서 일관되게 지킨다(관리자 지시 원문 "여기 값은 거시
 * 가정이지만 관행 일관 유지").
 *
 * **접두로 계산기2 공유 링크(`v2.`)·탭 id 프래그먼트(`calc2`/`pension-
 * depletion`)와 절대 겹치지 않는다** — `dep1.`은 그 무엇과도 같은 문자열을
 * 낼 수 없는 리터럴이다(`ui/app.js`의 라우팅이 셋을 이 순서로 가른다: 탭
 * id → 이 접두 → 계산기2 공유 링크).
 *
 * **버전 필드(`dep1.`)** — `DEPLETION_SLIDER_PARAMS`가 늘거나 줄면(필드
 * 스키마 변경) 세그먼트 개수가 달라져 옛 링크를 잘못된 자리에 꽂아 읽는
 * 대신 `version_mismatch`로 명시 거절한다(계산기2 v2와 같은 방패).
 *
 * **구분자는 쉼표(`,`)다** — 슬라이더 값 자체가 소수점(`.`)을 가질 수
 * 있으므로(예: `4.5`), 계산기2 v2가 쓰는 `.` 구분자를 그대로 쓰면 값 안의
 * `.`과 구분자가 부딪힌다. 슬라이더 값은 이스케이프가 필요한 다른 특수
 * 문자(한글·공백 등)를 낼 수 없는 순수 십진수라 쉼표 하나로 충분하다.
 */

import { DEPLETION_SLIDER_PARAMS } from './constants.js';

const DEPLETION_SHARE_PREFIX = 'dep1.';

/** 슬라이더 값 객체(`{id: value}`) → 프래그먼트 문자열(선행 `#` 없음). */
export function encodeDepletionShareFragment(values) {
  const segments = DEPLETION_SLIDER_PARAMS.map((p) => {
    const v = values?.[p.id];
    return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  });
  return `${DEPLETION_SHARE_PREFIX}${segments.join(',')}`;
}

/** `hash`(선행 `#` 없이)가 이 탭의 공유 링크 프래그먼트인가. */
export function isDepletionShareFragment(hash) {
  return typeof hash === 'string' && hash.startsWith(DEPLETION_SHARE_PREFIX);
}

/**
 * 프래그먼트 문자열(선행 `#` 없이, `dep1.` 접두 포함) → `{ ok: true, values }`
 * 또는 `{ ok: false, reason }`. 값이 슬라이더의 `min`~`max` 범위 밖이면
 * **거절하지 않고 그 슬라이더의 범위로 자른다(clamp)** — 계산기2의
 * "못 싣는 값은 조용히 버리지 않고 안내한다"(D84 판정 1)와 달리, 여기는
 * 값 자체가 틀린 것이 아니라 범위 밖일 뿐이라 링크를 죽이는 대신 가장
 * 가까운 유효값으로 복원한다(거시 가정 슬라이더의 특성 — 조작 가능한
 * 범위 자체가 화면의 물리적 한계다).
 */
export function decodeDepletionShareFragment(fragment) {
  if (typeof fragment !== 'string' || !fragment.startsWith(DEPLETION_SHARE_PREFIX)) {
    return { ok: false, reason: 'decode_failed' };
  }
  const rest = fragment.slice(DEPLETION_SHARE_PREFIX.length);
  const segments = rest.split(',');
  if (segments.length !== DEPLETION_SLIDER_PARAMS.length) return { ok: false, reason: 'version_mismatch' };
  const values = {};
  for (let i = 0; i < DEPLETION_SLIDER_PARAMS.length; i++) {
    const param = DEPLETION_SLIDER_PARAMS[i];
    const raw = segments[i];
    const num = Number(raw);
    if (raw === '' || !Number.isFinite(num)) return { ok: false, reason: 'parse_failed' };
    values[param.id] = Math.min(param.max, Math.max(param.min, num));
  }
  return { ok: true, values };
}

/** 공유 URL을 만든다. `locationLike`는 테스트·SSR 없는 환경을 위한 주입점. */
export function buildDepletionShareUrl(values, { locationLike = typeof window !== 'undefined' ? window.location : undefined } = {}) {
  const base = locationLike ? `${locationLike.origin}${locationLike.pathname}` : '';
  return `${base}#${encodeDepletionShareFragment(values)}`;
}

/** 현재 위치의 프래그먼트가 이 탭의 공유 링크면 디코드해 돌려준다 —
 * 아니면(탭 id·계산기2 공유 링크·빈 프래그먼트) `null`. */
export function readDepletionShareFragmentFromLocation(locationLike = typeof window !== 'undefined' ? window.location : undefined) {
  const hash = locationLike?.hash ?? '';
  if (!hash || hash === '#') return null;
  const value = hash.slice(1);
  if (!isDepletionShareFragment(value)) return null;
  return decodeDepletionShareFragment(value);
}
