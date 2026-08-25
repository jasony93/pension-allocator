/**
 * URL 프래그먼트 — 탭 축(screens.md 2.1.2절 (4)). **탭 id만 담는다.**
 *
 * 기존 공유 링크(`state/share-link.js`, D74)는 이미 프래그먼트에 `v:1` 데이터
 * 블롭(base64url로 인코딩된 JSON)을 싣고 있었다 — 그 기능은 손대지 않는다.
 * 이 파일이 새로 여는 것은 **탭 id 문자열 하나뿐인 프래그먼트**(`#calculator`
 * / `#pension-reverse`)이고, 두 형태가 같은 자리(`location.hash`)를 쓰므로
 * 파서가 **먼저** 탭 id인지 확인해야 한다 — 탭 id가 아니면 그 프래그먼트는
 * (있다면) 옛 공유 링크 데이터 블롭이므로 손대지 않고 `share-link.js`의
 * 기존 경로로 넘어간다.
 *
 * **탭 id 프래그먼트는 값을 나르지 않는다** — 그 탭을 빈 상태로 연다는 사실만
 * 나른다(2.1.2절 (4) "값을 전달하는 경로가 아니다"). 그래서 `data`가 없다.
 */

// [2026-08-20, D79] 「절세계좌 계산기2」 — 첫 탭과 같은 엔진, 다른 입력
// UX를 시험하는 실험 탭. id는 소유자/관리자 지시 원문 그대로 `calc2`.
// [2026-08-23, D84 판정 1·2] `calculator`(옛 근거판)·`pension-reverse`
// (역산기) 탭 자체가 지워졌다 — 그 둘은 더는 **현재** 탭 id가 아니다.
// 새 탭 `pension-depletion`(연금고갈 시뮬레이션)이 둘째 자리로 들어온다.
export const TAB_IDS = ['calc2', 'pension-depletion'];
// [2026-08-23, D84 판정 1] **옛 탭 id 프래그먼트의 갈 곳** — `#calculator`
// ·`#pension-reverse`로 북마크·공유된 링크가 죽지 않게, 지금 남은 유일한
// 계산 탭으로 돌린다("링크가 죽는 것보다 낫다", D84 판정 1). `TAB_IDS`에는
// 없으므로 `isTabIdFragment`가 그대로는 인식 못 하는데, `readTabIdFromLocation`
// 이 이 표를 먼저 본다.
const LEGACY_TAB_ID_REDIRECTS = { calculator: 'calc2', 'pension-reverse': 'calc2' };
// [2026-08-21, D81] 소유자가 계산기2(간결판)를 첫 탭 자리로 옮겼다 — 기본
// 활성 탭이 바뀐다. **내부 id·프래그먼트 문자열은 그대로**(`TAB_IDS` 위)다 —
// 옛 공유 링크(`#calculator`)가 계속 같은 패널을 연다. 바뀌는 것은 이
// 상수(초기 화면)와 표시 순서·라벨(`ui/tab-bar.js`)뿐이다.
// [2026-08-25, D86] **랜딩이 시뮬레이터가 된다.** 소유자 지시 — 기본
// 활성 탭이 `pension-depletion`으로 다시 바뀐다. `TAB_IDS`(위) 자체는
// 손대지 않는다 — `#calc2` 공유 링크는 여전히 같은 계산 탭을 그대로 연다.
export const DEFAULT_TAB_ID = 'pension-depletion';

/** `hash`(선행 `#` 없이)가 탭 id 프래그먼트인가(옛 id의 리다이렉트 대상 포함). */
export function isTabIdFragment(hash) {
  return TAB_IDS.includes(hash) || Object.prototype.hasOwnProperty.call(LEGACY_TAB_ID_REDIRECTS, hash);
}

/**
 * 현재 위치의 프래그먼트에서 탭 id만 읽는다. 탭 id가 아니면(빈 프래그먼트·
 * 옛 공유 링크의 `v:1` 데이터 블롭 등) `null`을 돌려준다 — 호출부가 그때는
 * 기본 탭(첫 탭)을 열고, 프래그먼트 자체는 `share-link.js`의 기존 경로가
 * 그대로 처리하게 둔다(3.11절 — "프래그먼트 파서가 탭 id와 데이터를 구분").
 * **옛 탭 id(`calculator`/`pension-reverse`)면 리다이렉트한 id를 돌려준다**
 * (D84 판정 1) — 호출부는 이 함수가 이미 "지금 존재하는" id만 낸다고
 * 믿을 수 있다.
 */
export function readTabIdFromLocation(locationLike = typeof window !== 'undefined' ? window.location : undefined) {
  const hash = locationLike?.hash ?? '';
  if (!hash || hash === '#') return null;
  const value = hash.slice(1);
  if (TAB_IDS.includes(value)) return value;
  if (Object.prototype.hasOwnProperty.call(LEGACY_TAB_ID_REDIRECTS, value)) return LEGACY_TAB_ID_REDIRECTS[value];
  return null;
}

/**
 * 탭을 전환할 때 프래그먼트를 갱신한다. `history.replaceState`를 쓴다
 * (`pushState`가 아니다) — 탭 전환마다 브라우저 히스토리가 쌓이면 "뒤로
 * 가기"가 값 입력 취소처럼 오작동한다(2.1.2절 (4)).
 */
export function writeActiveTabToLocation(tabId, locationLike = typeof window !== 'undefined' ? window.location : undefined) {
  if (typeof history === 'undefined' || !locationLike) return;
  if (!TAB_IDS.includes(tabId)) return;
  const base = `${locationLike.pathname}${locationLike.search}`;
  history.replaceState(null, '', `${base}#${tabId}`);
}
