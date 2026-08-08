/**
 * 최상위 렌더 오케스트레이터. `screens.md` 1절 공통 골격 — 좌측 입력 / 우측 결과
 * 좌우 분할(데스크톱) 또는 세로 배치(모바일)를 하나의 컨테이너로 구현하고
 * CSS 미디어쿼리가 배치를 바꾼다.
 */

import { el, mount } from './dom.js';
import { renderInputPanel } from './input-panel.js';
import { renderResultPanel, setRerenderHook } from './result-panel.js';
import { SERVICE_NAME } from '../copy.js';
import { createStore } from '../state/store.js';

export function mountApp(root, { engineClient, analytics }) {
  let render = () => {};
  const store = createStore({ engineClient, analytics, onChange: () => render() });

  const layout = el('div', { class: 'app-layout' });
  const header = el('header', { class: 'app-header' }, [
    el('span', { class: 'app-title' }, [SERVICE_NAME]),
    el('span', { class: 'app-tax-year' }, ['2026 과세연도 기준']),
  ]);
  const main = el('div', { class: 'app-main' });
  const inputSlot = el('div', { class: 'input-slot' });
  const resultSlot = el('div', { class: 'result-slot' });
  main.append(inputSlot, resultSlot);

  const footer = el('footer', { class: 'app-footer' }, ['제공자 표기 · 현재 제휴·광고 없음 · 룰셋 기준일 2026-08-08']);

  layout.append(header, main, footer);
  mount(root, layout);

  render = function renderImpl() {
    const state = store.getState();
    mount(inputSlot, renderInputPanel({ state, store, boundariesInfo: state.boundaries }));
    mount(resultSlot, renderResultPanel({ state, store }));
  };

  setRerenderHook(render);
  render();

  return { render, store };
}
