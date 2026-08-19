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

export const TAB_IDS = ['calculator', 'pension-reverse'];
export const DEFAULT_TAB_ID = 'calculator';

/** `hash`(선행 `#` 없이)가 탭 id 프래그먼트인가. */
export function isTabIdFragment(hash) {
  return TAB_IDS.includes(hash);
}

/**
 * 현재 위치의 프래그먼트에서 탭 id만 읽는다. 탭 id가 아니면(빈 프래그먼트·
 * 옛 공유 링크의 `v:1` 데이터 블롭 등) `null`을 돌려준다 — 호출부가 그때는
 * 기본 탭(첫 탭)을 열고, 프래그먼트 자체는 `share-link.js`의 기존 경로가
 * 그대로 처리하게 둔다(3.11절 — "프래그먼트 파서가 탭 id와 데이터를 구분").
 */
export function readTabIdFromLocation(locationLike = typeof window !== 'undefined' ? window.location : undefined) {
  const hash = locationLike?.hash ?? '';
  if (!hash || hash === '#') return null;
  const value = hash.slice(1);
  return isTabIdFragment(value) ? value : null;
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
