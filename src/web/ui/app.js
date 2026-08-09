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
 * **입력 패널은 포커스를 보존한다.** 전체 서브트리를 매번 새로 만들기 때문에,
 * 다시 그리기 전의 포커스·커서 위치를 기억했다가 같은 id의 새 요소에 되돌려
 * 준다. 그렇지 않으면 타이핑 한 글자마다 포커스가 빠져 실사용이 불가능하다.
 */

import { el, mount } from './dom.js';
import { renderInputPanel } from './input-panel.js';
import { renderResultPanel, setRerenderHook } from './result-panel.js';
import { SERVICE_NAME } from '../copy.js';
import { createStore } from '../state/store.js';
import { COMPACT_MEDIA_QUERY } from './charts.js';

function captureFocus(container) {
  const active = document.activeElement;
  if (!active || !container.contains(active)) return null;
  return {
    id: active.id || null,
    selectionStart: 'selectionStart' in active ? active.selectionStart : null,
    selectionEnd: 'selectionEnd' in active ? active.selectionEnd : null,
  };
}

function restoreFocus(focusInfo) {
  if (!focusInfo || !focusInfo.id) return;
  const target = document.getElementById(focusInfo.id);
  if (!target) return;
  target.focus({ preventScroll: true });
  if (typeof focusInfo.selectionStart === 'number' && typeof target.setSelectionRange === 'function') {
    try {
      target.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
    } catch {
      /* 일부 input type은 setSelectionRange를 지원하지 않는다(예: number) — 무시한다 */
    }
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
  const header = el('header', { class: 'app-header' }, [
    el('span', { class: 'app-title' }, [SERVICE_NAME]),
    el('span', { class: 'app-tax-year' }, ['2026 과세연도 기준']),
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
    // 재진입 가드 — mount()가 지금 초점을 가진 노드를 지우는 동안 브라우저가
    // 합성 blur를 발생시킨다. 그 blur가 다시 재계산을 걸고 재렌더를 예약하면
    // "렌더 → 초점 노드 제거 → blur → 재계산 → 재렌더 → …" 무한 루프가 된다
    // (실제 브라우저에서 크래시까지 재현해 확인한 버그). 이 창 안에서는
    // 어떤 blur도 "우리가 방금 지운 것"이지 "사용자가 실제로 포커스를 옮긴
    // 것"이 아니므로 무시한다.
    renderGuard.active = true;
    mount(inputSlot, renderInputPanel({ state, store, boundariesInfo: state.boundaries, renderGuard }));
    renderGuard.active = false;
    restoreFocus(focusInfo);
    mount(resultSlot, renderResultPanel({ state, store }));
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
