/**
 * [신규 회차, 계산기2 한정] 예시 팝업 — 첫 탭 예시영역의 히어로 카피 + 김철수씨
 * 한 사람을, 계산기2 탭을 클릭할 때 모달로 띄운다(소유자 지시).
 *
 * **[번들 실측 마감 회차] 재배치 셋.**
 * 1. **히어로 카피가 위, 예시(김철수씨)가 아래.** 옛 순서(예시 → 카피)를
 *    뒤집는다 — "무엇을 보여줄지"보다 "왜 봐야 하는지"를 먼저 말한다는
 *    소유자 판단이다.
 * 2. **이승은씨 행을 뺀다 — 김철수씨 한 사람만.** `computeExamplePersona2Scenario`
 *    호출 자체를 지웠다(계산 안 한다, 계산기2 본 계산과 무관).
 * 3. **버튼(오늘 하루 보지 않음·X)이 스크롤 없이 항상 보인다** —
 *    `.modal:has(.calc2-example-modal-host)`(styles.css)가 모달 자체의
 *    높이를 제한하고 `.modal-actions`를 sticky 바닥으로 고정한다. 스크롤은
 *    내용(`.calc2-example-modal-host`) 안에서만 난다.
 *
 * **컴포넌트를 그대로 재사용한다.** `examplePersonaRow`·`exampleHeroCopy`·
 * `attachHostStyles`·`fitAmountValueToCard`·`computeExampleScenario`는 전부
 * `ui/example-showcase.js`가 이미 갖고 있던 바로 그 함수다(첫 탭 예시와 같은
 * 값, 같은 계산 경로) — 이 파일이 새로 계산하거나 문구를 다시 짓지 않는다.
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
  examplePersonaCells,
  exampleHeroCopy,
  attachHostStyles,
  fitAmountValueToCard,
  computeExampleScenario,
  EXAMPLE_PERSONA_NAME,
  exampleInputLineTexts,
} from './example-showcase.js';
import { applyDonutSliceInlineLabels, watchDonutThemeChange } from './charts.js';
import { MAN_ICON_DATA_URI, MAN_ICON_INTRINSIC_WIDTH, MAN_ICON_INTRINSIC_HEIGHT } from '../assets/man-icon.js';
import { CALC2_EXAMPLE_CAPACITY_LABEL } from '../calc2-copy.js';

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

/**
 * [2026-08-23, D82 소유자 지시 1번] 「월 납입금」→「납입금」 — 입력 네 줄 중
 * 마지막 한 줄의 라벨만 짧아진다(값은 그대로). `exampleInputLineTexts()`가
 * 낸 문자열을 여기서 다시 짓지 않고 접두만 바꿔 친다 — 값(만원 숫자)이나
 * 줄 순서는 `example-showcase.js`가 계속 진다.
 */
function calc2ExampleInputLineTexts() {
  return exampleInputLineTexts().map((line) => (line.startsWith('월 납입금') ? line.replace('월 납입금', CALC2_EXAMPLE_CAPACITY_LABEL) : line));
}

/**
 * [2026-08-23, D82 소유자 지시 1번] 예시 카드 — 오른쪽 공간이 비어 보인다는
 * 지적에 따라, 정보(기본 정보 네 줄)를 카드 좌상단, 도넛을 우상단, 절세액
 * 카드를 카드 하단(전체 폭)에 앉힌다. **계산은 새로 하지 않는다** —
 * `examplePersonaCells`가 첫 탭과 똑같은 계산(`donutChart`·`amountCard`
 * 호출)으로 낸 세 칸을 이 카드만의 그리드(`calc2-example-card`,
 * styles.css)로 다시 배열할 뿐이다.
 *
 * **카드처럼 보이게 — 주황 테두리 + 더 연한 주황 바탕**(`--accent-warm`·
 * `--accent-warm-subtle`, 새 토큰 — 3단 구조로 다크 값도 함께 선언했다,
 * `styles.css` 머리말 쪽). 내용 전체(정보·도넛·절세액) −5%는 `styles.css`의
 * `.calc2-example-card` 스코프가 진다.
 */
function calc2ExampleCard({ persona1 }) {
  const { infoCol, donutCol, amountCol } = examplePersonaCells({
    name: EXAMPLE_PERSONA_NAME,
    iconDataUri: MAN_ICON_DATA_URI,
    iconWidth: MAN_ICON_INTRINSIC_WIDTH,
    iconHeight: MAN_ICON_INTRINSIC_HEIGHT,
    lines: calc2ExampleInputLineTexts(),
    scenario: persona1.scenario,
    plan: persona1.plan,
  });
  return el('div', { class: 'calc2-example-card' }, [infoCol, donutCol, amountCol]);
}

/**
 * 히어로 카피(왼쪽) + 예시 카드(오른쪽, 김철수씨) — [D82 소유자 지시 1번]
 * 오른쪽이 비어 보인다는 지적으로 가로 배치(카피 | 카드)로 되돌아간다.
 * **"카피가 먼저" 원칙(5항목 회차 판단)은 여전히 지킨다** — 그때는
 * 위/아래로 순서를 나타냈지만 이제는 왼쪽/오른쪽(읽기 순서)으로 나타낸다,
 * 뜻은 같다. 클래스는 그대로 `calc2-example-modal-body`(첫 탭의
 * `rowsAndCopy`와는 다른 그리드 규칙을 쓴다 — 두 파일이 서로의 레이아웃을
 * 밟지 않는다는 원래 원칙 그대로).
 */
function exampleCopyAndRow({ persona1 }) {
  return el('div', { class: 'calc2-example-modal-body' }, [exampleHeroCopy(), calc2ExampleCard({ persona1 })]);
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
  try {
    [persona1] = await Promise.all([computeExampleScenario(engineClient), attachHostStyles(shadowRoot)]);
  } catch (err) {
    // 예시 계산 실패는 팝업을 닫는 것으로 조용히 넘어간다 — 첫 탭 예시
    // (`mountExampleShowcase`)와 같은 처리(계산기2 본 계산과는 무관하다).
    console.error('[calc2-example-modal] 예시를 계산하지 못했습니다', err);
    modal.close();
    return;
  }

  loadingNode.remove();
  shadowRoot.appendChild(exampleCopyAndRow({ persona1 }));
  fitAmountValueToCard(shadowRoot);
  applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true });
  stopWatchingTheme = watchDonutThemeChange(() => applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true }));
}
