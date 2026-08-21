/**
 * [신규 회차, 계산기2 한정] 예시 팝업 — 첫 탭 예시영역의 두 페르소나(김철수씨·
 * 이승은씨) + 히어로 카피를, 계산기2 탭을 클릭할 때 모달로 띄운다(소유자 지시).
 *
 * **컴포넌트를 그대로 재사용한다.** `examplePersonaRow`·`exampleHeroCopy`·
 * `attachHostStyles`·`fitAmountValueToCard`·`computeExampleScenario`·
 * `computeExamplePersona2Scenario`는 전부 `ui/example-showcase.js`가 이미
 * 갖고 있던 바로 그 함수다(첫 탭 예시와 같은 값, 같은 계산 경로) — 이 파일이
 * 새로 계산하거나 문구를 다시 짓지 않는다.
 *
 * **Shadow DOM 안에서 그린다** — 첫 탭 예시와 같은 이유(`example-showcase.js`
 * 머리말): `.chart-donut`·`.amount-card`를 문서 전체 질의로 짚는 여러 브라우저
 * 검사가 이 팝업의 사본까지 잡지 않게 하는 경계다.
 *
 * **모달 뼈대는 `ui/modal.js`의 `openModal`을 그대로 쓴다** — 포커스 트랩·
 * `Esc` 닫기·배경 스크롤 잠금·닫히면 트리거로 포커스 복귀가 공짜로 따라온다
 * (초기화 확인 모달과 같은 인프라, 새로 만들지 않는다).
 *
 * **「오늘 하루 보지 않음」은 `localStorage`에 날짜 문자열만 남긴다** —
 * 전송하지 않는다(브라우저 안에만 남는다는 이 저장소의 원칙 그대로). 값·
 * 입력이 아니라 "오늘 이 팝업을 봤다"는 UI 상태 하나뿐이라 계측·전송 금지
 * 규약과 무관하다(사용자 입력값이 아니다).
 */

import { el } from './dom.js';
import { openModal } from './modal.js';
import {
  examplePersonaRow,
  exampleHeroCopy,
  attachHostStyles,
  fitAmountValueToCard,
  computeExampleScenario,
  computeExamplePersona2Scenario,
  EXAMPLE_PERSONA_NAME,
  EXAMPLE_PERSONA_2_NAME,
  exampleInputLineTexts,
  examplePersona2InputLineTexts,
} from './example-showcase.js';
import { applyDonutSliceInlineLabels, watchDonutThemeChange } from './charts.js';
import { MAN_ICON_DATA_URI, MAN_ICON_INTRINSIC_WIDTH, MAN_ICON_INTRINSIC_HEIGHT } from '../assets/man-icon.js';
import { FEMALE_ICON_DATA_URI, FEMALE_ICON_INTRINSIC_WIDTH, FEMALE_ICON_INTRINSIC_HEIGHT } from '../assets/female-icon.js';

/** `localStorage` 키 — 값은 그 날짜(`YYYY-MM-DD`, 로컬) 하나뿐이다. */
export const CALC2_EXAMPLE_MODAL_STORAGE_KEY = 'calc2ExampleModalDismissedDate';

/** 로컬 날짜를 `YYYY-MM-DD`로 — `Date`의 타임존 그대로(과세연도 계산과 무관한 UI 상태다). */
export function localDateKey(now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 순수 함수 — `storage`·`now`를 인자로 받아 브라우저 없이도(단위 시험) 자정
 * 경계를 실제 시계 없이 확인할 수 있다. `storage` 접근이 실패하면(프라이빗
 * 모드 등) 안전한 쪽(보여준다)으로 접는다.
 */
export function shouldShowCalc2ExampleModal(now, storage) {
  try {
    return storage.getItem(CALC2_EXAMPLE_MODAL_STORAGE_KEY) !== localDateKey(now);
  } catch {
    return true;
  }
}

/** 「오늘 하루 보지 않음」— 오늘 날짜를 저장한다. 저장 실패는 조용히 무시한다. */
export function dismissCalc2ExampleModalForToday(now, storage) {
  try {
    storage.setItem(CALC2_EXAMPLE_MODAL_STORAGE_KEY, localDateKey(now));
  } catch {
    /* 프라이빗 모드 등 저장이 막힌 환경 — 다음에 또 뜨는 것으로 감수한다. */
  }
}

function safeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // 일부 임베드/샌드박스 환경은 접근 자체가 예외를 던진다.
  }
}

/** 두 페르소나 행 + 히어로 카피 — 첫 탭 예시의 같은 자리(`rowsAndCopy`)와 같은 구조다. */
function exampleRowsAndCopy({ persona1, persona2 }) {
  const row1 = examplePersonaRow({
    name: EXAMPLE_PERSONA_NAME,
    iconDataUri: MAN_ICON_DATA_URI,
    iconWidth: MAN_ICON_INTRINSIC_WIDTH,
    iconHeight: MAN_ICON_INTRINSIC_HEIGHT,
    lines: exampleInputLineTexts(),
    scenario: persona1.scenario,
    plan: persona1.plan,
  });
  const row2 = examplePersonaRow({
    name: EXAMPLE_PERSONA_2_NAME,
    iconDataUri: FEMALE_ICON_DATA_URI,
    iconWidth: FEMALE_ICON_INTRINSIC_WIDTH,
    iconHeight: FEMALE_ICON_INTRINSIC_HEIGHT,
    lines: examplePersona2InputLineTexts(),
    scenario: persona2.scenario,
    plan: persona2.plan,
  });
  const rowsStack = el('div', { class: 'example-persona-rows-stack' }, [row1, row2]);
  return el('div', { class: 'example-persona-rows-and-copy calc2-example-modal-body' }, [rowsStack, exampleHeroCopy()]);
}

/**
 * 계산기2 탭을 클릭할 때 부른다. `shouldShowCalc2ExampleModal`이 `false`면
 * 조용히 아무것도 하지 않는다(같은 날 재클릭 — 소유자 지시).
 */
export async function maybeShowCalc2ExampleModal({ engineClient, now = new Date(), storage = safeLocalStorage() } = {}) {
  if (!storage) return;
  if (!shouldShowCalc2ExampleModal(now, storage)) return;

  const host = document.createElement('div');
  // `:has()`는 shadow DOM 경계를 넘지 못한다 — 안(shadow root)의
  // `.calc2-example-modal-body`가 아니라 이 빛 DOM 요소 자신에 표식을 둬야
  // `.modal:has(...)`(styles.css)가 폭을 넓힐 수 있다(실측 — 이 클래스
  // 없이는 `.modal`이 480px 기본값에 머물렀다).
  host.className = 'calc2-example-modal-host';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  // 아직 자리표시자다 — 스타일도, 계산 결과도 없다. 아래에서 모달을 먼저
  // 연 **다음에** 채운다(바로 다음 문단 참고). 이 문단만 뗄 수 있게 별도
  // 노드로 둔다 — `attachHostStyles`가 곧 이 shadow root에 스타일 노드를
  // 함께 심으므로 통째로 비우면 그 스타일까지 지운다.
  const loadingNode = document.createElement('p');
  loadingNode.textContent = '불러오는 중…';
  shadowRoot.appendChild(loadingNode);

  let modal;
  const closeButton = el(
    'button',
    { type: 'button', class: 'calc2-example-modal-close', 'aria-label': '닫기' },
    ['×'],
  );
  closeButton.addEventListener('click', () => modal.close());

  // [소유자 지시] 오른쪽 하단, 주황 계열로 눈에 띄게 — 첫 탭·화살표가 이미
  // 쓰는 `--accent-warm`을 그대로 쓴다(대표 색은 서비스 전체다).
  const dismissButton = el(
    'button',
    { type: 'button', class: 'calc2-example-modal-dismiss' },
    ['오늘 하루 보지 않음'],
  );
  dismissButton.addEventListener('click', () => {
    dismissCalc2ExampleModalForToday(now, storage);
    modal.close();
  });

  let stopWatchingTheme = null;
  modal = openModal({
    label: '계산기2 예시',
    body: [host],
    // 순서가 곧 포커스 순서다(`modal.js`) — 「오늘 하루 보지 않음」이 이
    // 팝업의 주된 동작이므로 먼저 온다.
    actions: [dismissButton, closeButton],
    onClose: () => stopWatchingTheme?.(),
  });

  // **`host`가 이제 문서에 연결됐다** — `openModal`이 `document.body.append`로
  // 붙였다. `attachHostStyles`가 심는 `<link rel="stylesheet">`는 연결되지
  // 않은(detached) shadow root 안에서는 `load` 이벤트가 나지 않는 브라우저가
  // 있다(실측 — 모달을 열기 전에 이 함수를 부르면 영원히 뜨지 않았다) —
  // 그래서 스타일·계산은 모달을 연 **다음에** 시작한다.
  let persona1;
  let persona2;
  try {
    [persona1, persona2] = await Promise.all([
      computeExampleScenario(engineClient),
      computeExamplePersona2Scenario(engineClient),
      attachHostStyles(shadowRoot),
    ]);
  } catch (err) {
    // 예시 계산 실패는 팝업을 닫는 것으로 조용히 넘어간다 — 첫 탭 예시
    // (`mountExampleShowcase`)와 같은 처리(계산기2 본 계산과는 무관하다).
    console.error('[calc2-example-modal] 예시를 계산하지 못했습니다', err);
    modal.close();
    return;
  }

  loadingNode.remove();
  shadowRoot.appendChild(exampleRowsAndCopy({ persona1, persona2 }));
  fitAmountValueToCard(shadowRoot);
  applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true });
  stopWatchingTheme = watchDonutThemeChange(() => applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true }));
}
