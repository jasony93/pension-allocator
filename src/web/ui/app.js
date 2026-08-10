/**
 * 최상위 렌더 오케스트레이터. `screens.md` 1절 공통 골격 — 좌측 입력 / 우측 결과
 * 좌우 분할(데스크톱) 또는 세로 배치(모바일)를 하나의 컨테이너로 구현하고
 * CSS 미디어쿼리가 배치를 바꾼다.
 *
 * **렌더링은 다음 마이크로태스크로 미룬다.** 프레임워크 없이 매 상태 변경마다
 * 패널 전체를 다시 그리기 때문에, `input`·`blur` 이벤트 핸들러 안에서 그 자리에서
 * 곧바로 DOM을 갈아치우면 브라우저가 같은 이벤트를 처리하는 도중(특히 blur가
 * 연쇄로 발생할 때) 이미 떼어낸 노드를 다시 지우려다 `removeChild` 예외를 던진다
 * — 실제로 브라우저에서 재현되어 잡은 버그다. 마이크로태스크로 미루면 이벤트
 * 디스패치가 완전히 끝난 뒤에 다시 그리므로 이 경합이 사라진다.
 *
 * **두 패널 모두 노드를 지우지 않고 고쳐 쓴다**(`dom.js`의 `patch`).
 *
 * 예전에는 매 렌더마다 패널을 통째로 갈아치우고 그 위에 포커스·커서 복원을
 * 덧대었다. 그 방식이 실제로 낸 결함이 셋이었다 —
 *
 * ① 커서를 **문자 인덱스**로 기억해 되돌리는데 `maskBirthDate`가 `-`를 끼워 넣어
 *    문자열이 길어지므로 복원 위치가 한 칸씩 앞이 됐다. `19930417`을 한 자씩
 *    치면 `1993-41-70`이 됐다.
 * ② 다른 칸을 클릭하면 이전 칸에서 `blur`가 나고 그 `blur`가 재계산·재렌더를
 *    걸어 **방금 클릭한 노드**를 갈아치웠다. 초점이 옮겨 가는 도중이라
 *    `activeElement`가 `body`여서 복원할 대상조차 없었다 — 클릭 25회 중 12회
 *    초점이 붙지 않았다.
 * ③ 같은 연쇄가 결과 패널에서는 **클릭 자체를 삼켰다.** 재렌더가 `mousedown`과
 *    `mouseup` 사이에 버튼 노드를 바꿔치우면 브라우저가 `click`을 만들지 않는다.
 *    값을 친 직후 누른 `공유용 이미지 만들기`의 첫 클릭이 그렇게 사라졌다.
 *
 * 셋의 뿌리가 같다. **복원이 틀렸다기보다 복원할 일을 만들지 말았어야 했다.**
 * `patch`가 같은 자리의 같은 노드를 재사용하므로 초점을 가진 `input`도, 누르고
 * 있는 버튼도 살아 있고, 그러면 초점도 커서도 클릭도 애초에 잃지 않는다.
 * 좌측 입력 / 우측 즉시 반영이라는 화면 구성은 그대로다 — 매 상태 변경마다 두
 * 패널을 다시 그리는 것은 같고, **그리는 방법만** 바뀐다.
 *
 * 아래 `captureFocus`/`restoreFocus`는 **구조가 어긋나 노드를 교체할 수밖에 없는
 * 자리**(조건부 블록이 생겼다 사라지는 등)를 위한 대비책으로 남는다. 커서는
 * 문자 인덱스가 아니라 유효문자 개수로 기억한다.
 */

import { el, mount, patch, significantCount, indexAfterSignificant } from './dom.js';
import { renderInputPanel } from './input-panel.js';
import { renderResultPanel, setRerenderHook } from './result-panel.js';
import { SERVICE_NAME } from '../copy.js';
import { createStore } from '../state/store.js';
import { COMPACT_MEDIA_QUERY } from './charts.js';
import { createThemeController, themeControl } from './theme.js';

function captureFocus(container) {
  const active = document.activeElement;
  if (!active || !container.contains(active)) return null;
  const value = typeof active.value === 'string' ? active.value : null;
  return {
    node: active,
    id: active.id || null,
    // 문자 인덱스가 아니라 **커서 앞의 유효문자 개수**다 — 마스크가 구분자를
    // 끼워 넣어도 어긋나지 않는다(dom.js `significantCount` 머리말).
    startCount: value != null && typeof active.selectionStart === 'number' ? significantCount(value, active.selectionStart) : null,
    endCount: value != null && typeof active.selectionEnd === 'number' ? significantCount(value, active.selectionEnd) : null,
  };
}

function restoreFocus(focusInfo) {
  if (!focusInfo || !focusInfo.id) return;
  // `patch`가 노드를 지켜 냈으면 복원할 것이 없다. 되돌리는 시늉조차 하지 않는다 —
  // 이미 맞게 놓인 커서를 다시 건드릴 이유가 없다.
  if (focusInfo.node && focusInfo.node.isConnected && document.activeElement === focusInfo.node) return;
  const target = document.getElementById(focusInfo.id);
  if (!target) return;
  target.focus({ preventScroll: true });
  if (focusInfo.startCount == null || typeof target.setSelectionRange !== 'function' || typeof target.value !== 'string') return;
  try {
    target.setSelectionRange(
      indexAfterSignificant(target.value, focusInfo.startCount),
      indexAfterSignificant(target.value, focusInfo.endCount ?? focusInfo.startCount),
    );
  } catch {
    /* 일부 input type은 setSelectionRange를 지원하지 않는다(예: number) — 무시한다 */
  }
}

export function mountApp(root, { engineClient, analytics }) {
  let renderNow = () => {};
  let renderScheduled = false;

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      renderNow();
    });
  }

  const store = createStore({ engineClient, analytics, onChange: () => scheduleRender() });
  const renderGuard = { active: false };

  const layout = el('div', { class: 'app-layout' });
  // `ThemeControl`은 헤더에 있고 **store를 거치지 않는다**(design-system 5.30절).
  // 화면 밝기는 결과가 아니라 화면 전체의 성질이고, store를 거치면 테마를 바꿀
  // 때마다 결과 패널이 다시 그려져 도넛의 각도 애니메이션이 발동한다 — 값이
  // 바뀐 것이 아니므로 조각은 그 자리에 있어야 한다. 색은 CSS 변수가 나른다.
  //
  // 가명칭과 과세연도 표기는 한 묶음이다. **묶지 않으면 모바일에서 밀린다** —
  // 헤더가 셋이 되면서 좁은 폭에서 가명칭이 두 줄로 접히는 것을 실측으로 봤고
  // (`browser/theme.browser.mjs`), screens.md 2.1절은 `ThemeControl`이 그 둘을
  // 밀어내지 않을 것을 요구한다. 묶어 두면 좁은 폭에서 둘이 세로로 쌓이고
  // 밝기 버튼은 44px 자리를 그대로 지킨다.
  const header = el('header', { class: 'app-header' }, [
    el('div', { class: 'app-header-titles' }, [
      el('span', { class: 'app-title' }, [SERVICE_NAME]),
      el('span', { class: 'app-tax-year' }, ['2026 과세연도 기준']),
    ]),
    themeControl(createThemeController()),
  ]);
  const mainEl = el('div', { class: 'app-main' });
  const inputSlot = el('div', { class: 'input-slot' });
  const resultSlot = el('div', { class: 'result-slot' });
  mainEl.append(inputSlot, resultSlot);

  const footer = el('footer', { class: 'app-footer' }, ['제공자 표기 · 현재 제휴·광고 없음 · 룰셋 기준일 2026-08-08']);

  layout.append(header, mainEl, footer);
  mount(root, layout);

  renderNow = function renderImpl() {
    const state = store.getState();
    const focusInfo = captureFocus(inputSlot);
    // 재진입 가드 — 렌더가 지금 초점을 가진 노드를 지우는 동안 브라우저가
    // 합성 blur를 발생시킨다. 그 blur가 다시 재계산을 걸고 재렌더를 예약하면
    // "렌더 → 초점 노드 제거 → blur → 재계산 → 재렌더 → …" 무한 루프가 된다
    // (실제 브라우저에서 크래시까지 재현해 확인한 버그). 이 창 안에서는
    // 어떤 blur도 "우리가 방금 지운 것"이지 "사용자가 실제로 포커스를 옮긴
    // 것"이 아니므로 무시한다.
    //
    // **`patch`로 바꾼 뒤에도 이 가드는 그대로 필요하다.** 노드를 재사용하는
    // 경로에서는 애초에 blur가 나지 않지만, 구조가 어긋나 노드를 교체하는
    // 경로는 여전히 남아 있고 그 자리에서 같은 연쇄가 시작될 수 있다.
    renderGuard.active = true;
    patch(inputSlot, renderInputPanel({ state, store, boundariesInfo: state.boundaries, renderGuard }));
    renderGuard.active = false;
    restoreFocus(focusInfo);
    // **결과 패널도 같은 이유로 고쳐 쓴다.** 통째로 갈아치우면, 입력 칸에서
    // 빠져나오며 걸린 재계산이 재렌더를 부르고 그 재렌더가 `mousedown`과
    // `mouseup` 사이에 버튼 노드를 바꿔치기한다 — 두 이벤트가 서로 다른 노드에
    // 걸리면 브라우저는 `click`을 만들지 않는다. 그래서 무언가를 입력한 직후에
    // 누른 결과 패널의 첫 클릭(공유·시나리오 탭·대안 행)이 통째로 삼켜졌다.
    // 브라우저에서 `mousedown`·`mouseup`은 오는데 `click`이 오지 않는 것을
    // 확인했다(`browser/share-modal.browser.mjs`).
    patch(resultSlot, renderResultPanel({ state, store }));
  };

  setRerenderHook(scheduleRender);

  // 도넛은 라벨을 옆에 붙이는지 아래 리스트로 내리는지에 따라 **상자 크기 자체가
  // 다르다**(charts.js `donutGeometry`). CSS는 `viewBox`를 바꿀 수 없으므로 그
  // 판단이 렌더 시점에 들어가고, 폭이 경계를 넘으면 다시 그려야 한다. 없으면
  // 창을 줄인 사용자가 라벨 자리만큼 작아진 도넛을 계속 보게 된다.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const compact = window.matchMedia(COMPACT_MEDIA_QUERY);
    // Safari 13 이하는 addEventListener를 지원하지 않는다 — 있으면 그것만 쓴다.
    if (typeof compact.addEventListener === 'function') compact.addEventListener('change', scheduleRender);
    else if (typeof compact.addListener === 'function') compact.addListener(scheduleRender);
  }

  renderNow();

  return { render: scheduleRender, store };
}
