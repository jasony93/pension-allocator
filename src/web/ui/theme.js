/**
 * `ThemeControl` — 화면 밝기 (design-system 5.30절 · screens.md 2.1절).
 *
 * **세 가지 상태를 다룬다**(8.1절): 지정 없음(기본) · 명시적 라이트 · 명시적 다크.
 * "지정 없음"에서 루트에는 아무 표시도 없고 `prefers-color-scheme`만이 결정한다 —
 * 그래서 `system`은 `data-theme`을 **지우는** 것이지 `data-theme="system"`을
 * 쓰는 것이 아니다. 쓰는 순간 CSS의 세 블록 계약이 무너진다.
 *
 * **저장 — 관리자 판정 D23이 승인한 제약 넷을 이 파일이 지킨다.**
 *
 *   1. 키 하나(`theme`), 값은 `light`·`dark`·`system` 셋뿐이다. 자유 문자열이
 *      아니므로 입력값이 흘러들 통로가 없다.
 *   2. **사용자가 토글을 누르기 전에는 아무것도 쓰지 않는다.** 첫 방문자는 이
 *      키를 남기지 않는다 — 저장은 `chooseTheme()`에서만 일어나고, 읽기 경로
 *      (`readStoredTheme`)는 어떤 경우에도 쓰지 않는다. 상호작용에서 의사를
 *      추론하지 않는다는 규약(screens.md 3.2절)의 같은 형태다.
 *   3. `자동`을 고르면 키를 **지운다.** 되돌릴 수 없는 저장을 만들지 않는다.
 *   4. 테마 값을 계측으로 보내지 않는다. 이 모듈은 analytics를 import하지 않으며,
 *      그 사실을 `theme.test.mjs`가 정적으로 검사한다.
 *
 * **전환에 트랜지션을 걸지 않는다**(6.2절). 색 토큰이 한꺼번에 바뀌는데 120ms
 * 색 전환이 페이지 전체에 걸려 있으면 수십 개 요소가 제각기 물들고, 그 중간
 * 프레임에서 고지 문구의 대비가 4.5:1 아래로 내려간다. 여기서는 루트 속성 하나만
 * 바꾸고 `styles.css`는 색에 `transition`을 걸지 않는다.
 *
 * **도넛을 다시 그리지 않는다.** 이 모듈은 앱의 재렌더를 부르지 않고 자기 메뉴의
 * DOM만 갱신한다 — 값이 바뀐 것이 아니므로 조각은 그 자리에 있고 색만 바뀐다
 * (색은 CSS 변수를 통해 자동으로 따라온다).
 */

import { el } from './dom.js';
import { THEME_CONTROL } from '../copy.js';

export const THEME_STORAGE_KEY = 'theme';
export const THEME_DEFAULT = 'system';
export const THEME_VALUES = THEME_CONTROL.options.map((o) => o.value);

/**
 * 저장소 접근은 **프로퍼티를 읽는 것만으로** 예외가 날 수 있다 —
 * `allow-same-origin` 없는 샌드박스 iframe, 쿠키 전면 차단 브라우저가 그렇다.
 * 테마가 계산 화면을 죽이는 경로를 만들지 않는다(analytics.js와 같은 판단).
 */
export function optionalLocalStorage() {
  try {
    return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

/** 저장된 값을 읽는다. **쓰지 않는다.** 아는 값 셋이 아니면 기본값으로 접는다. */
export function readStoredTheme(storage) {
  if (!storage) return THEME_DEFAULT;
  let raw = null;
  try {
    raw = storage.getItem(THEME_STORAGE_KEY);
  } catch {
    return THEME_DEFAULT;
  }
  return THEME_VALUES.includes(raw) ? raw : THEME_DEFAULT;
}

/** `자동`이면 키를 지운다 — 되돌릴 수 없는 저장을 만들지 않는다(제약 3). */
export function persistTheme(storage, value) {
  if (!storage) return;
  try {
    if (value === THEME_DEFAULT) storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    /* 저장이 막힌 환경 — 화면은 그대로 동작한다 */
  }
}

/**
 * 루트 표시. `system`은 **속성을 지운다** — 지정 없음 상태에서 루트에 아무 표시도
 * 없어야 `prefers-color-scheme`만이 결정한다는 8.1절의 표가 성립한다.
 */
export function applyThemeAttribute(root, value) {
  if (!root) return;
  if (value === 'light' || value === 'dark') root.setAttribute('data-theme', value);
  else root.removeAttribute('data-theme');
}

/**
 * 컨트롤러. 상태는 "지금 고른 값" 하나뿐이고, 그 값을 루트와 저장소에 반영한다.
 *
 * 생성 시점에는 **읽기만** 한다(제약 2). `chooseTheme()`이 불려야 쓴다.
 */
export function createThemeController({ storage = optionalLocalStorage(), root = document.documentElement } = {}) {
  let current = readStoredTheme(storage);
  // 인라인 스크립트가 첫 페인트 전에 이미 찍어 두었지만, 그 스크립트가 없는
  // 환경(테스트·임베드)에서도 상태가 맞도록 한 번 더 맞춘다. 값이 같으면
  // `setAttribute`는 아무 일도 하지 않는다.
  applyThemeAttribute(root, current);
  const listeners = new Set();

  return {
    get value() {
      return current;
    },
    /** 사용자가 항목을 누른 **그때** 저장이 일어난다. 이 함수 밖에 쓰기 경로가 없다. */
    chooseTheme(value) {
      if (!THEME_VALUES.includes(value)) return;
      current = value;
      applyThemeAttribute(root, value);
      persistTheme(storage, value);
      for (const fn of listeners) fn(value);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/**
 * 헤더의 44px 아이콘 버튼 + 세 항목 목록.
 *
 * 열리기 전까지 헤더 폭을 44px만 쓴다 — 모바일에서도 가명칭·과세연도 표기를
 * 밀어내지 않는다(screens.md 2.1절). 클릭·탭으로 열고 `Esc`로 닫으며, 닫히면
 * 트리거로 포커스가 돌아온다. **호버 전용이 아니다**(5.17절과 같은 규약).
 */
export function themeControl(controller) {
  let open = false;
  const trigger = el(
    'button',
    {
      type: 'button',
      class: 'theme-control-trigger',
      'aria-label': THEME_CONTROL.label,
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      onclick: () => setOpen(!open),
    },
    // 아이콘 단독으로 뜻을 나르지 않는다 — 열린 목록에 항상 텍스트 라벨이 있다.
    [el('span', { 'aria-hidden': 'true' }, ['◐'])],
  );

  const menu = el('div', { class: 'theme-menu', role: 'radiogroup', 'aria-label': THEME_CONTROL.label });
  const root = el('div', { class: 'theme-control' }, [trigger]);

  function renderMenu() {
    menu.replaceChildren(
      ...THEME_CONTROL.options.map((option) => {
        const selected = controller.value === option.value;
        return el(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(selected),
            class: `theme-menu-item${selected ? ' theme-menu-item-selected' : ''}`,
            onclick: () => {
              controller.chooseTheme(option.value);
              renderMenu();
              setOpen(false);
            },
          },
          [el('span', { class: 'theme-menu-dot', 'aria-hidden': 'true' }, [selected ? '●' : '○']), option.label],
        );
      }),
    );
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    setOpen(false);
  }

  function onPointerDown(event) {
    if (!open || root.contains(event.target)) return;
    setOpen(false);
  }

  function setOpen(next) {
    open = next;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      renderMenu();
      root.append(menu);
      document.addEventListener('keydown', onKeydown, true);
      document.addEventListener('mousedown', onPointerDown, true);
      menu.querySelector('button')?.focus({ preventScroll: true });
    } else {
      menu.remove();
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('mousedown', onPointerDown, true);
      // 닫히면 트리거로 포커스 복귀(5.30절).
      if (document.activeElement && root.contains(document.activeElement)) trigger.focus({ preventScroll: true });
    }
  }

  return root;
}
