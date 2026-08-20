/**
 * `TabBar` — design-system 5.33절, 배치는 `screens.md` 2.1.2절.
 *
 * WAI-ARIA 탭 패턴을 따른다 — 탭 묶음은 `role="tablist"`, 각 탭은
 * `role="tab"` + `aria-selected` + `aria-controls`, 방향키(←→)로 탭 사이를
 * 옮긴다. **탭 라벨은 서비스 이름을 지지 않는다**(D77 판정 2) — 순수하게
 * 지금 보이는 기능의 이름이다. 서비스 정체성은 로고가 진다(`ui/app.js`의
 * `headerLogo()`).
 */

import { el } from './dom.js';
import { SERVICE_NAME } from '../copy.js';
import { CALC2_TAB_LABEL } from '../calc2-copy.js';
import { REVERSE_TAB_LABEL } from '../reverse-copy.js';

// 라벨은 각 탭의 문구 사전에서 가져온다 — 세 탭이 문구 사전을 나누는
// 이유(계약 8.11절)와 같은 이유로, 탭 이름을 이 파일에 다시 박지 않는다.
// [2026-08-20, D79] 순서는 「절세계좌 계산기 | 절세계좌 계산기2 | 연금
// 역산기」 — 소유자 지시 원문 순서 그대로.
export const TABS = [
  { id: 'calculator', label: SERVICE_NAME },
  { id: 'calc2', label: CALC2_TAB_LABEL },
  { id: 'pension-reverse', label: REVERSE_TAB_LABEL },
];

/**
 * @param {object} params
 * @param {string} params.activeTabId
 * @param {(id: string) => void} params.onSelect
 */
export function renderTabBar({ activeTabId, onSelect }) {
  const buttons = TABS.map((tab, index) =>
    el(
      'button',
      {
        type: 'button',
        id: `tab-${tab.id}`,
        role: 'tab',
        // `dom.js`의 `el()`은 JS boolean을 HTML 불리언 속성 관례(존재=참,
        // 부재=거짓)로 다룬다 — `aria-selected`는 리터럴 문자열 "true"/"false"가
        // 필요한 ARIA 상태 속성이라 그 관례와 다르다(`ui/theme.js`의
        // `aria-checked: String(selected)`와 같은 이유로 여기서도 문자열로 바꾼다).
        'aria-selected': String(tab.id === activeTabId),
        'aria-controls': `tabpanel-${tab.id}`,
        tabindex: tab.id === activeTabId ? '0' : '-1',
        class: `app-tab${tab.id === activeTabId ? ' app-tab-active' : ''}`,
        onclick: () => onSelect(tab.id),
        onkeydown: (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
          e.preventDefault();
          let nextIndex = index;
          if (e.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
          else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
          else if (e.key === 'Home') nextIndex = 0;
          else if (e.key === 'End') nextIndex = TABS.length - 1;
          const nextId = TABS[nextIndex].id;
          onSelect(nextId);
          queueMicrotask(() => document.getElementById(`tab-${nextId}`)?.focus());
        },
      },
      [tab.label],
    ),
  );
  return el('div', { class: 'app-tabs', role: 'tablist', 'aria-label': '주요 기능' }, buttons);
}
