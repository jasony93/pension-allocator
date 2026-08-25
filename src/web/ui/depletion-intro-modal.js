/**
 * [2026-08-25, 소유자 지시 9번] 「연금고갈 시뮬레이션」 탭 전용 팝업 — 이 탭이
 * 활성화될 때(탭 클릭, 공유 링크로 곧장 진입 등 이 탭을 여는 모든 경로에서
 * 같은 규칙으로) 한 번 뜬다. **계산기2 예시 팝업(`ui/calc2-example-modal.js`)
 * 과 같은 구조** — 모달 뼈대(`ui/modal.js`)를 그대로 쓰고, Shadow DOM 안에
 * 그려 문서 전체 질의 시험(`.depletion-chart`·`.chart-donut` 등)이 이 팝업의
 * 사본을 잡지 않게 한다. **일일 억제는 별도 키**(`depletionIntroModalDismissedDate`)
 * 다 — 계산기2 예시 팝업의 그 날 억제와 서로 간섭하지 않는다(탭이 다르면
 * 각자 그날 한 번씩 뜬다).
 *
 * **왼쪽 — 카피.** `src/design/popup-copy.html`의 `.popup-copy` 내용을 그대로
 * 옮긴다(문구는 `depletion-copy.js`의 `DEPLETION_POPUP_*` 사전에서만 온다 —
 * tax-domain 정정이 오면 그 사전 한 곳에서 갈린다). Pretendard CDN은 걷어내고
 * (이 앱 자신의 글꼴 스택을 그대로 물려받는다), 색은 리터럴 hex 대신 우리
 * 토큰(`--text-primary`·`--accent-warm` 등, `styles.css`)을 쓴다. `fadeUp`
 * 애니메이션과 `prefers-reduced-motion` 대응은 그대로 유지한다(기존 키프레임
 * `example-hero-fade-up`을 재사용 — 새 키프레임을 만들지 않는다).
 *
 * **오른쪽 — 상/하 두 영역.** 상단은 시뮬레이션 그래프+핵심 가정 슬라이더의
 * "디자인 구성만"(정적 축소 렌더, `depletionChartAndSlidersPreview`,
 * `ui/depletion-panel.js`) — 실제 조작은 안 된다. 하단은 김철수씨 예시 행
 * (`examplePersonaRow`, `ui/example-showcase.js`) — 계산기2 예시 팝업과 같은
 * 실제 엔진 계산(`computeExampleScenario`), 별도 목 없음. 각 영역 아래 버튼
 * 하나씩 — 상단 아래는 이 탭에 머문다(팝업만 닫는다), 하단 아래는 팝업을
 * 닫고 첫 탭(계산기2)으로 넘어간다.
 */

import { el } from './dom.js';
import { openModal } from './modal.js';
import {
  examplePersonaRow,
  computeExampleScenario,
  exampleInputLineTexts,
  EXAMPLE_PERSONA_NAME,
  attachHostStyles,
  fitAmountValueToCard,
} from './example-showcase.js';
import { applyDonutSliceInlineLabels, watchDonutThemeChange } from './charts.js';
import { depletionChartAndSlidersPreview } from './depletion-panel.js';
import { MAN_ICON_DATA_URI, MAN_ICON_INTRINSIC_WIDTH, MAN_ICON_INTRINSIC_HEIGHT } from '../assets/man-icon.js';
import {
  DEPLETION_POPUP_QUESTION_LINES,
  DEPLETION_POPUP_ANSWER_PREFIX,
  DEPLETION_POPUP_ANSWER_MARK_1,
  DEPLETION_POPUP_ANSWER_MIDDLE,
  DEPLETION_POPUP_ANSWER_MARK_2,
  DEPLETION_POPUP_ANSWER_SUFFIX,
  DEPLETION_POPUP_BODY_LINE_1,
  DEPLETION_POPUP_BODY_STRONG,
  DEPLETION_POPUP_BODY_TAIL_PREFIX,
  DEPLETION_POPUP_ACCOUNT_1,
  DEPLETION_POPUP_ACCOUNT_2,
  DEPLETION_POPUP_ACCOUNT_3,
  DEPLETION_POPUP_BODY_TAIL_SUFFIX,
  DEPLETION_POPUP_RECONCILIATION_NOTE,
  DEPLETION_POPUP_SOURCE_GUARANTEE,
  DEPLETION_POPUP_SOURCE_PROJECTION,
  DEPLETION_POPUP_CHART_BUTTON_LABEL,
  DEPLETION_POPUP_BRIDGE_BUTTON_LABEL,
} from '../depletion-copy.js';

/** `localStorage` 키 — 계산기2 예시 팝업(`calc2ExampleModalDismissedDate`)과
 * 겹치지 않는 별도 키(관리자 지시 원문 "일일 억제는 별도 키"). */
export const DEPLETION_INTRO_MODAL_STORAGE_KEY = 'depletionIntroModalDismissedDate';

/** 로컬 날짜를 `YYYY-MM-DD`로 — `calc2-example-modal.js`의 `localDateKey`와
 * 완전히 같은 규칙이지만, 그 파일에 대한 의존을 만들지 않으려 이 파일 안에
 * 다시 둔다(두 팝업이 서로의 내부 구현에 기대지 않게, 사전과 문구만 공유).
 * 이름 자체는 `depletionLocalDateKey`로 접두를 달았다 — 번들러
 * (`scripts/build.mjs`)가 전역 스코프 하나로 모듈을 합치므로, 다른 파일의
 * 같은 이름(`localDateKey`)과 충돌하지 않게 한다. */
function depletionLocalDateKey(now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 순수 함수 — `storage`·`now`를 인자로 받아 브라우저 없이도 단위 시험할 수
 * 있다. 저장 접근이 실패하면(프라이빗 모드 등) 안전한 쪽(보여준다)으로 접는다. */
export function shouldShowDepletionIntroModal(now, storage) {
  try {
    return storage.getItem(DEPLETION_INTRO_MODAL_STORAGE_KEY) !== depletionLocalDateKey(now);
  } catch {
    return true;
  }
}

/** 「오늘 하루 보지 않음」 — 오늘 날짜를 저장한다. 저장 실패는 조용히 무시한다. */
export function dismissDepletionIntroModalForToday(now, storage) {
  try {
    storage.setItem(DEPLETION_INTRO_MODAL_STORAGE_KEY, depletionLocalDateKey(now));
  } catch {
    /* 프라이빗 모드 등 저장이 막힌 환경 — 다음에 또 뜨는 것으로 감수한다. */
  }
}

function depletionSafeLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * 왼쪽 카피 — `src/design/popup-copy.html`의 `.popup-copy` 구조를 그대로
 * 옮긴다. `<br>`·강조(mark) 위치는 문구 사전(`depletion-copy.js`)의 조각을
 * DOM으로 다시 조립해 지킨다(innerHTML을 쓰지 않는다 — 이 저장소의 다른
 * 카피 컴포넌트, 예 `exampleHeroCopy`와 같은 관행).
 */
function depletionPopupCopy() {
  const question = el(
    'h2',
    { class: 'depletion-popup-question' },
    DEPLETION_POPUP_QUESTION_LINES.map((line) => el('span', { class: 'depletion-popup-question-line' }, [line])),
  );
  const answer = el('p', { class: 'depletion-popup-answer' }, [
    DEPLETION_POPUP_ANSWER_PREFIX,
    el('br'),
    el('span', { class: 'depletion-popup-mark' }, [DEPLETION_POPUP_ANSWER_MARK_1]),
    `${DEPLETION_POPUP_ANSWER_MIDDLE} `,
    el('span', { class: 'depletion-popup-mark' }, [DEPLETION_POPUP_ANSWER_MARK_2]),
    DEPLETION_POPUP_ANSWER_SUFFIX,
  ]);
  const bodyCopy = el('div', { class: 'depletion-popup-body-copy' }, [
    el('p', {}, [DEPLETION_POPUP_BODY_LINE_1]),
    el('p', {}, [
      el('strong', {}, [DEPLETION_POPUP_BODY_STRONG]),
      el('br'),
      DEPLETION_POPUP_BODY_TAIL_PREFIX,
      el('span', { class: 'depletion-popup-account' }, [DEPLETION_POPUP_ACCOUNT_1]),
      '·',
      el('span', { class: 'depletion-popup-account' }, [DEPLETION_POPUP_ACCOUNT_2]),
      '·',
      el('span', { class: 'depletion-popup-account' }, [DEPLETION_POPUP_ACCOUNT_3]),
      DEPLETION_POPUP_BODY_TAIL_SUFFIX,
    ]),
  ]);
  // [관리자 지시 — 카피 검증 3번, 신설] 2064(정부 추계) vs 이 시뮬레이터의
  // 소진 연도를 잇는 한 줄 — 없으면 사용자가 둘 중 하나를 오류로 읽는다.
  const reconciliation = el('p', { class: 'depletion-popup-note' }, [DEPLETION_POPUP_RECONCILIATION_NOTE]);
  // [관리자 지시 — 카피 검증 1번] 출처 두 줄 — 지급보장 문장과 2064년
  // 문장은 서로 다른 문서에서 왔다. 하나로 뭉치지 않는다.
  const source = el('div', { class: 'depletion-popup-source' }, [
    el('p', { class: 'depletion-popup-source-line' }, [DEPLETION_POPUP_SOURCE_GUARANTEE]),
    el('p', { class: 'depletion-popup-source-line' }, [DEPLETION_POPUP_SOURCE_PROJECTION]),
  ]);
  return el('div', { class: 'depletion-popup-copy' }, [question, answer, bodyCopy, reconciliation, source]);
}

/** 오른쪽 상단 — 정적 축소 렌더 + 버튼("연금고갈 시뮬레이션", 팝업만 닫는다
 * — 이미 이 탭이 활성 상태이므로 탭 전환은 필요 없다). */
function depletionPopupChartArea({ onClose }) {
  const button = el('button', { type: 'button', class: 'btn btn-secondary depletion-popup-chart-button', onclick: onClose }, [
    DEPLETION_POPUP_CHART_BUTTON_LABEL,
  ]);
  return el('div', { class: 'depletion-popup-right-top' }, [depletionChartAndSlidersPreview(), button]);
}

/** 오른쪽 하단 — 김철수씨 예시 행 + 버튼("ISA/연금저축/IRP 배분하기", 팝업을
 * 닫고 첫 탭(계산기2)으로 넘어간다). */
function depletionPopupExampleArea({ persona1, onBridge }) {
  const row = examplePersonaRow({
    name: EXAMPLE_PERSONA_NAME,
    iconDataUri: MAN_ICON_DATA_URI,
    iconWidth: MAN_ICON_INTRINSIC_WIDTH,
    iconHeight: MAN_ICON_INTRINSIC_HEIGHT,
    lines: exampleInputLineTexts(),
    scenario: persona1.scenario,
    plan: persona1.plan,
  });
  const button = el('button', { type: 'button', class: 'btn btn-secondary depletion-popup-bridge-button', onclick: onBridge }, [
    DEPLETION_POPUP_BRIDGE_BUTTON_LABEL,
  ]);
  return el('div', { class: 'depletion-popup-right-bottom' }, [row, button]);
}

/**
 * 「연금고갈 시뮬레이션」 탭이 활성화될 때 부른다. `shouldShowDepletionIntroModal`
 * 이 `false`면(오늘 이미 봤다) 조용히 아무것도 하지 않는다.
 *
 * @param {{ engineClient: object, onBridgeToCalc2: () => void, now?: Date, storage?: Storage }} opts
 */
export async function maybeShowDepletionIntroModal({ engineClient, onBridgeToCalc2, now = new Date(), storage = depletionSafeLocalStorage() } = {}) {
  if (!storage) return;
  if (!shouldShowDepletionIntroModal(now, storage)) return;

  const host = document.createElement('div');
  // `.modal:has(.depletion-intro-modal-host)`(styles.css)가 이 표식으로
  // 모달 자신의 폭을 넓힌다 — 계산기2 예시 팝업과 같은 관행(`:has()`는
  // shadow 경계를 넘지 못하므로 이 빛 DOM 요소 자신에 클래스를 둔다).
  host.className = 'depletion-intro-modal-host';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const loadingNode = document.createElement('p');
  loadingNode.textContent = '불러오는 중…';
  shadowRoot.appendChild(loadingNode);

  let modal;
  let stopWatchingTheme = null;
  const closeButton = el('button', { type: 'button', class: 'depletion-intro-modal-close', 'aria-label': '닫기' }, ['×']);
  closeButton.addEventListener('click', () => modal.close());

  const dismissButton = el('button', { type: 'button', class: 'depletion-intro-modal-dismiss' }, ['오늘 하루 보지 않음']);
  dismissButton.addEventListener('click', () => {
    dismissDepletionIntroModalForToday(now, storage);
    modal.close();
  });

  modal = openModal({
    label: '연금고갈 시뮬레이션 안내',
    body: [host],
    // 「오늘 하루 보지 않음」이 이 팝업의 주된 동작이므로 먼저 온다(계산기2
    // 예시 팝업과 같은 순서 관행 — 순서가 곧 열릴 때의 포커스 순서다).
    actions: [dismissButton, closeButton],
    onClose: () => stopWatchingTheme?.(),
  });

  let persona1;
  try {
    [persona1] = await Promise.all([computeExampleScenario(engineClient), attachHostStyles(shadowRoot)]);
  } catch (err) {
    console.error('[depletion-intro-modal] 예시를 계산하지 못했습니다', err);
    modal.close();
    return;
  }

  loadingNode.remove();
  const body = el('div', { class: 'depletion-popup-body' }, [
    depletionPopupCopy(),
    el('div', { class: 'depletion-popup-right' }, [
      depletionPopupChartArea({ onClose: () => modal.close() }),
      depletionPopupExampleArea({
        persona1,
        onBridge: () => {
          modal.close();
          onBridgeToCalc2?.();
        },
      }),
    ]),
  ]);
  shadowRoot.appendChild(body);
  // [2026-08-25, 관리자 지시 — 번들 실측(1440×900) 마감] 세액공제액 값
  // 덩어리(`.amount-value-chunk`, 예: "1,485,000원")는 `white-space: nowrap`
  // 이다(styles.css) — 이 팝업의 오른쪽 하단 열은 계산기2 예시 팝업의 카드보다
  // 훨씬 좁은데(약 360~460px), 이 실측 패스 없이는 그 값이 카드 폭을 넘어도
  // 줄어들지 않고 그대로 잘렸다(실측: "1,"만 보이고 나머지가 카드 밖으로
  // 넘쳐 모달에 가로 스크롤바가 생겼다). 계산기2 예시 팝업과 첫 탭 예시가
  // 이미 쓰는 바로 그 실측 패스(`fitAmountValueToCard`)를 여기서도 부른다.
  fitAmountValueToCard(shadowRoot);
  // [계산기2 예시 팝업과 같은 이유] 도넛 조각 라벨은 별도 후처리 패스로
  // 그려진다(`applyDonutSliceInlineLabels`) — 카드가 좁아 지시선까지 있으면
  // 더 붐빈다, `hideLeader: true`로 뺀다.
  applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true, hideLeader: true });
  stopWatchingTheme = watchDonutThemeChange(() => applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true, hideLeader: true }));
}
