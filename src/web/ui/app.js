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
 *
 * ---------------------------------------------------------------------------
 * **[2026-08-19, D77] 탭 확장.** 「연금 역산기」 탭이 늘면서 이 파일이 새로
 * 지는 일 셋 —
 *
 * 1. **탭 바.** `ui/tab-bar.js`(design-system 5.33절)가 렌더를 지고, 이
 *    파일은 활성 탭 id만 들고 있는다.
 * 2. **두 패널의 동시 마운트.** `screens.md` 2.1.2절 (3) — 탭 전환은
 *    패널을 없앴다 새로 만드는 것이 아니라 **표시 전환**이어야 한다. 그래서
 *    첫 탭(`renderInputPanel`/`renderResultPanel`)과 둘째 탭
 *    (`renderReverseInputPanel`/`renderReverseResultPanel`)을 **매 렌더마다
 *    함께** 고쳐 쓰고, 활성 탭이 아닌 쪽은 CSS 클래스(`tab-panel-hidden`)로만
 *    숨긴다 — DOM에서 지우지 않는다. 두 탭은 **서로 다른 store**를 쓴다
 *    (`state/store.js`의 것과 `state/reverse-store.js`의 것) — 재계산·
 *    디바운스가 탭마다 독립적으로 돈다(2.1.2절 (3) 근거 2번).
 * 3. **URL 프래그먼트.** `state/tab-fragment.js`가 탭 id만 읽고 쓴다 — 기존
 *    공유 링크(`state/share-link.js`, D74)의 `v:1` 데이터 블롭은 첫 탭
 *    전용으로 그대로 동작한다(아래 초기화 블록의 분기 순서가 그 구분이다).
 */

import { el, mount, patch, significantCount, indexAfterSignificant } from './dom.js';
import { renderResultPanel, setRerenderHook } from './result-panel.js';
import { renderCalc2InputPanel } from './calc2-input-panel.js';
import { buildCalc2PrefillForm } from './calc2-prefill.js';
import { maybeShowCalc2ExampleModal } from './calc2-example-modal.js';
import { maybeShowDepletionIntroModal } from './depletion-intro-modal.js';
import { renderTabBar } from './tab-bar.js';
import { mountDepletionPanel } from './depletion-panel.js';
import { SHARE_LINK_INVALID_NOTE, SHARE_LINK_PARTIAL_NOTE } from '../copy.js';
import { DEPLETION_SHARE_INVALID_NOTE } from '../depletion-copy.js';
import { createStore, initialForm } from '../state/store.js';
import { readShareFragmentFromLocation } from '../state/share-link.js';
import { readDepletionShareFragmentFromLocation } from '../depletion/share-link.js';
import { readTabIdFromLocation, writeActiveTabToLocation, DEFAULT_TAB_ID } from '../state/tab-fragment.js';
import { deriveAnnuityStartedFromBoundaries } from '../state/annuity-start-derivation.js';
import { COMPACT_MEDIA_QUERY, WIDE_DONUT_MEDIA_QUERY, runDonutEntrance, applyDonutSliceInlineLabels, watchDonutThemeChange, prefersReducedMotion } from './charts.js';
import { createThemeController, themeControl } from './theme.js';
import { LOGO_LIGHT_DATA_URI, LOGO_DARK_DATA_URI, LOGO_INTRINSIC_WIDTH, LOGO_INTRINSIC_HEIGHT } from '../assets/logo.js';

/**
 * [관리자 지시(4차) 7번, D74] 공유 링크로 열렸는데 프래그먼트를 읽지
 * 못했을 때(옛 버전·손상) 보이는 배너. **조용히 무시하지 않는다** — 짧게
 * 알린다는 D74의 조건을 그대로 옮긴다. `role="status"`는 기존
 * `proposedSameAsCurrentBody`의 안내 배너와 같은 패턴이다.
 */
function sharedFragmentInvalidNotice() {
  return el('div', { class: 'inline-alert inline-alert-warning shared-fragment-notice', role: 'status' }, [
    el('p', { class: 'type-body-strong' }, [SHARE_LINK_INVALID_NOTE]),
  ]);
}

/**
 * [2026-08-23, D84 판정 1] 옛(v:1) 공유 링크가 실었을 수 있는 값 중,
 * 지금 남은 계산 탭(계산기2, 간결판)이 화면에 그리지 않는 필드들 —
 * 청년 자기신고·당해연도 이미 넣은 금액(4종)·ISA 가입 이후 누적 관련
 * 경과연수·ISA 만기 전환·정산 기간·손실액. 하나라도 기본값과 다르면
 * "이 값은 못 실었다"는 사실을 안내해야 한다(D84 판정 1 — 조용히 버리지
 * 않는다).
 */
const CALC2_UNSUPPORTED_SHARE_FIELDS = [
  'declaredYouth',
  'annuitySavingsYtd',
  'retirementPensionYtd',
  'isaCumulative',
  'isaYtd',
  'isaYearsSinceOpening',
  'isaTransferEnabled',
  'isaTransferAmount',
  'isaTransferDestination',
  'isaTransferPriorApplied',
  'isaSettlementYears',
  'isaLossAmount',
];

function sharedFormHasCalc2UnsupportedValues(form) {
  const base = initialForm();
  return CALC2_UNSUPPORTED_SHARE_FIELDS.some((field) => JSON.stringify(form[field]) !== JSON.stringify(base[field]));
}

/** [2026-08-24, 소유자 지시 5번] 「연금고갈 시뮬레이션」 탭 공유 링크가
 * 깨졌을 때 — 위 배너와 같은 자리·같은 패턴, 슬라이더 어휘("조작")로만
 * 문구가 다르다(D74 관행 일관 유지 원문). */
function depletionSharedFragmentInvalidNotice() {
  return el('div', { class: 'inline-alert inline-alert-warning shared-fragment-notice', role: 'status' }, [
    el('p', { class: 'type-body-strong' }, [DEPLETION_SHARE_INVALID_NOTE]),
  ]);
}

/** [2026-08-23, D84 판정 1] 위 배너와 같은 자리·같은 패턴 — 문구만 다르다. */
function sharedFragmentPartialNotice() {
  return el('div', { class: 'inline-alert inline-alert-warning shared-fragment-notice', role: 'status' }, [
    el('p', { class: 'type-body-strong' }, [SHARE_LINK_PARTIAL_NOTE]),
  ]);
}

/**
 * [2026-08-17, 관리자 지시(3차) 1번] **로고 둘을 함께 심고 CSS로 표시를
 * 가른다.** `.app-logo-light`/`.app-logo-dark`(styles.css)가 `data-theme`
 * 스탬프 경로와 `prefers-color-scheme` 경로 둘 다에서 정확히 하나만
 * `display: block`으로 남긴다 — 옛 흰 알약 배경(`--logo-plate`)으로 다크에서
 * 로고를 읽히게 하던 처리는 다크 전용 원본이 생기며 이유가 사라져 없앴다.
 *
 * **[2026-08-19, D77 판정 2]** 브랜드는 이제 이 로고 하나가 전담한다 — 탭이
 * 둘이 되면서 "지금 활성 탭 라벨 = 서비스 이름"이라는 겸임이 깨졌다
 * (`screens.md` 2.1.2절 (2)). 그래서 이 함수는 로고만 그리고, 탭 행은
 * `tab-bar.js`가 따로 진다(`mountApp` 아래).
 */
/**
 * [2026-08-20, 관리자 지시(2차) 6번] **로고를 누르면 첫 랜딩으로 돌아간다** —
 * 「절세계좌 계산기」 탭을 활성화하고 페이지 맨 위로 스크롤한다(입력값은
 * 지우지 않는다 — `setActiveTab`이 표시만 전환할 뿐 store를 건드리지
 * 않는다, `mountApp` 아래).
 *
 * **버튼이다**(`<a>`가 아니다) — 다른 문서로 이동하지 않는다, 예시의 이동
 * 화살표(`example-showcase.js`의 `exampleShowcaseScrollArrow`)와 같은
 * 판단. `type="button"`·`aria-label`로 접근성 시맨틱을 준다(로고 두
 * `<img>`는 `alt="돈길"`이 이미 있지만, 버튼 자체의 목적은 "이동"이지
 * "이미지 보기"가 아니므로 버튼에도 별도 레이블을 준다). `cursor: pointer`
 * 는 `styles.css`(`.app-header-logo-button`)가 명시로 준다 — 버튼 기본
 * 커서는 브라우저마다 갈릴 수 있다.
 */
function headerLogo(onClick) {
  const button = el(
    'button',
    { type: 'button', class: 'app-header-logo-button', 'aria-label': '돈길 처음으로' },
    [
      el('img', {
        class: 'app-logo app-logo-light',
        src: LOGO_LIGHT_DATA_URI,
        alt: '돈길',
        width: LOGO_INTRINSIC_WIDTH,
        height: LOGO_INTRINSIC_HEIGHT,
      }),
      el('img', {
        class: 'app-logo app-logo-dark',
        src: LOGO_DARK_DATA_URI,
        alt: '돈길',
        width: LOGO_INTRINSIC_WIDTH,
        height: LOGO_INTRINSIC_HEIGHT,
      }),
    ],
  );
  button.addEventListener('click', onClick);
  return el('div', { class: 'app-header-logo' }, [button]);
}

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

  // [2026-08-23, D84 판정 1] 첫 탭(옛 `store`)·역산기(`reverseStore`)는
  // 탭 자체가 지워지며 함께 걷혔다 — 계산기2(`calc2Store`, 아래)가 이제
  // 유일한 계산 store다.
  // [2026-08-20, D79] 계산기2 store — **첫 탭과 같은 엔진·같은 요청 스키마**
  // (`createStore`를 그대로 재사용한다, `state/store.js`)를 쓰지만 **독립된
  // 인스턴스**다 — 첫 탭 store와 상태를 공유하면 계산기2의 김철수씨 프리필이
  // 첫 탭(빈 상태로 시작해야 한다)에도 번진다. 계측은 첫 탭과 같은 이벤트
  // 사전을 공유한다(D79 머리말 "계측 분리는 계산기2가 살아남을 때 붙인다" —
  // 지금은 분리하지 않고 그대로 재사용한다).
  const calc2Store = createStore({
    engineClient,
    analytics,
    onChange: (calc2State) => {
      maybeAutoDeriveCalc2AnnuityStarted(calc2State);
      scheduleRender();
    },
  });
  /**
   * [D79 판정 3] 조문상 확실히 미개시(만 55세 미만)면 물음 없이 값을
   * 채운다. `calc2-input-panel.js`(순수 뷰)가 아니라 여기(store 오케스트
   * 레이션 계층)에서 한다 — `maybeFetchBoundaries`(state/store.js)가 이미
   * 여기(app.js 바깥, store 내부)에서처럼 "값 변화에 반응해 store를
   * 고치는" 부수효과를 지는 자리이므로, 같은 성격의 이 부수효과도 렌더
   * 함수 밖에 둔다. `applySharedForm`을 쓴다(`setField`가 아니다) — 이
   * 값은 사용자가 타이핑한 것이 아니라 조문에서 도출한 값이므로
   * `input_start` 계측을 걸지 않는다.
   */
  function maybeAutoDeriveCalc2AnnuityStarted(calc2State) {
    const derived = deriveAnnuityStartedFromBoundaries(calc2State.boundaries);
    if (derived === false && calc2State.form.annuityStarted !== false) {
      calc2Store.applySharedForm({ annuityStarted: false });
    }
  }
  const renderGuard = { active: false };

  const layout = el('div', { class: 'app-layout' });
  // `ThemeControl`은 헤더에 있고 **store를 거치지 않는다**(design-system 5.30절).
  // 화면 밝기는 결과가 아니라 화면 전체의 성질이고, store를 거치면 테마를 바꿀
  // 때마다 결과 패널이 다시 그려져 도넛의 각도 애니메이션이 발동한다 — 값이
  // 바뀐 것이 아니므로 조각은 그 자리에 있어야 한다. 색은 CSS 변수가 나른다.
  let activeTabId = DEFAULT_TAB_ID;
  const tabsSlot = el('div', {});
  const header = el('header', { class: 'app-header' }, [
    el('div', { class: 'app-header-brand' }, [headerLogo(goToFirstLanding), tabsSlot]),
    el('div', { class: 'app-header-meta' }, [
      el('span', { class: 'app-tax-year' }, ['2026 과세연도 기준']),
      themeControl(createThemeController()),
    ]),
  ]);
  // [2026-08-23, D84 판정 1] 헤더 아래 예시 블록(옛 첫 탭 전용
  // `exampleSlot`, 역산기 전용 `reverseExampleSlot`)은 그 두 탭과 함께
  // 걷혔다 — 계산기2는 애초에 예시 블록이 없었다(D79 판정 2, "예시 블록
  // 없이 김철수씨 값이 프리필된 편집 가능한 폼으로 시작한다").

  // ---- 두 탭의 패널 — 동시 마운트, 표시만 전환(2.1.2절 (3)) ----------------
  // [2026-08-20, D79] 계산기2 — **예시 블록이 없다**(판정 2).
  const calc2InputSlot = el('div', { class: 'calc2-input-slot' });
  const calc2ResultSlot = el('div', { class: 'calc2-result-slot' });
  const calc2Panel = el(
    'div',
    { class: 'app-main', id: 'tabpanel-calc2', role: 'tabpanel', 'aria-labelledby': 'tab-calc2' },
    [calc2InputSlot, calc2ResultSlot],
  );

  // [2026-08-23, D84 판정 2·3] 「연금고갈 시뮬레이션」 — 개인 세액 계산이
  // 아니라 공적 기금 시나리오 도구다. store·engineClient를 쓰지 않는다
  // (`ui/depletion-panel.js` 머리말) — 그래서 이 슬롯은 `mountDepletionPanel`
  // 이 한 번 마운트하면 끝이고, 다른 탭처럼 매 렌더 `patch`로 다시 그리지
  // 않는다(슬라이더 자신의 `input` 핸들러가 자기 안에서만 다시 그린다).
  const depletionSlot = el('div', { class: 'depletion-slot' });
  const depletionPanel = el(
    'div',
    { class: 'app-main', id: 'tabpanel-pension-depletion', role: 'tabpanel', 'aria-labelledby': 'tab-pension-depletion' },
    [depletionSlot],
  );

  const mainGroup = el('div', { class: 'app-main-group' }, [calc2Panel, depletionPanel]);

  // 12.2(b) — "현재 제휴·광고 없음"을 푸터에서 뗀 것은 원래 `LimitNote`가
  // 같은 스크롤에서 이미 그 사실을 말하고 있었기 때문이다. **D61(관리자
  // 판정, 소유자 지시)로 `LimitNote` 자체가 화면에서 없어져 그 전제가
  // 사라졌지만, 되돌리지 않는다** — 소유자가 그 문장을 포함해 지우라고
  // 지목한 세 문장 중 하나였고("이 계산기는 특정 금융상품·금융회사를
  // 다루지 않고, 현재 제휴·광고도 없습니다"), 지시 범위를 넘어 이 자리에
  // 다시 넣는 것은 소유자의 결정을 되돌리는 것이다.
  const footer = el('footer', { class: 'app-footer' }, ['제공자 표기 · 룰셋 기준일 2026-08-08']);

  layout.append(header, mainGroup, footer);
  mount(root, layout);
  // [2026-08-24, 소유자 지시 5번] 이 탭의 공유 링크(`dep1.` 접두,
  // `depletion/share-link.js`)를 **탭 패널을 마운트하기 전에** 미리
  // 읽는다 — `mountDepletionPanel`이 슬라이더를 그 값으로 초기화하려면
  // 마운트 시점에 값을 넘겨야 한다(계산기2처럼 마운트 뒤 store로 다시
  // 채우는 경로가 이 탭엔 없다, 머리말 — store를 안 쓴다). 탭 id
  // 프래그먼트(`#calc2`·`#pension-depletion`)와 계산기2 공유 링크(`v2.`)
  // 어느 쪽도 `dep1.`로 시작할 수 없으므로 이 읽기가 그 둘을 건드리지
  // 않는다(`isDepletionShareFragment`).
  const depletionShareResult = readDepletionShareFragmentFromLocation();
  // [2026-08-25, 소유자 지시 8번] 다리(문구+버튼)를 뺐다 — `mountDepletionPanel`
  // 은 더는 `onBridgeToCalc2`를 받지 않는다. 절세계좌 탭으로의 연결은 이
  // 탭 전용 팝업(`maybeShowDepletionIntroModal`, 아래 `activateDepletionExtras`)
  // 이 대신 진다.
  mountDepletionPanel(depletionSlot, {
    initialValues: depletionShareResult?.ok ? depletionShareResult.values : undefined,
  });

  /**
   * 활성 탭을 바꾼다. **DOM을 지우지 않는다** — `tab-panel-hidden` 클래스
   * 하나로 표시만 전환한다(2.1.2절 (3)). URL 프래그먼트도 함께 갱신한다
   * (`history.replaceState`, 2.1.2절 (4)) — 탭 전환마다 히스토리가 쌓이면
   * "뒤로 가기"가 값 입력 취소처럼 오작동하기 때문이다.
   */
  // [2026-08-20, D79 판정 2] 계산기2 프리필은 **이 탭을 처음 열 때** 채운다 —
  // 앱을 마운트하는 시점에 곧바로 채우지 않는다. 이유는 순전히 구조적이다:
  // 세 탭(첫 탭·계산기2·역산기)이 `screens.md` 2.1.2절 (3)에 따라 **항상
  // 동시에 DOM에 있으므로**, 마운트 시점에 곧장 채워 계산까지 실행하면
  // 사용자가 계산기2를 한 번도 열지 않아도 그 결과 DOM(도넛·표 등)이 문서에
  // 항상 존재하게 된다. 이 저장소의 여러 브라우저 검사가 결과 패널의 클래스
  // (`.chart-donut`·`.benefit-reference-table` 등)를 **문서 전체**에서
  // `querySelectorAll`로 세는데(첫 탭 하나만 결과를 낼 수 있던 시절의 전제),
  // 계산기2가 처음부터 계산돼 있으면 그 개수가 배로 잡혀 검사가 깨진다
  // (실측 — 세율표 7행 기대에 14행이 나왔다). **탭을 처음 열 때만** 채우면
  // 그 탭을 한 번도 열지 않는 기존 검사 전부가 이 결함을 피해 간다 —
  // "결과가 바로 서 있다"(D79 판정 2)는 사용자가 이 탭을 열었을 때의
  // 약속이지, 앱이 뜨는 순간의 약속이 아니다.
  let calc2Prefilled = false;
  function ensureCalc2Prefilled() {
    if (calc2Prefilled) return;
    calc2Prefilled = true;
    calc2Store.applySharedForm(buildCalc2PrefillForm());
  }

  // [2026-08-21, D81] 계산기2가 이 탭을 활성화하는 **모든** 경로(탭 클릭,
  // URL 프래그먼트로 곧장 진입, 이제는 기본 랜딩까지)에서 같은 일일 규칙을
  // 타야 한다 — 경로마다 따로 부르면 부르는 것을 잊은 경로 하나가 조용히
  // 어긋난다. 한 곳에 모은다.
  function activateCalc2Extras() {
    ensureCalc2Prefilled();
    // 「오늘 하루 보지 않음」으로 오늘 이미 닫았으면 `maybeShowCalc2ExampleModal`
    // 자신이 조용히 아무것도 하지 않는다(`ui/calc2-example-modal.js`).
    maybeShowCalc2ExampleModal({ engineClient });
  }

  // [2026-08-25, 소유자 지시 9번] 이 탭 전용 팝업 — 계산기2 예시 팝업과
  // 같은 일일 규칙(별도 키)으로, 이 탭이 활성화되는 모든 경로(탭 클릭,
  // 공유 링크로 곧장 진입)에서 같은 곳(이 함수)만 부른다.
  function activateDepletionExtras() {
    maybeShowDepletionIntroModal({ engineClient, onBridgeToCalc2: () => setActiveTab('calc2') });
  }

  function setActiveTab(tabId) {
    if (tabId === activeTabId) return;
    activeTabId = tabId;
    if (activeTabId === 'calc2') activateCalc2Extras();
    if (activeTabId === 'pension-depletion') activateDepletionExtras();
    calc2Panel.classList.toggle('tab-panel-hidden', activeTabId !== 'calc2');
    depletionPanel.classList.toggle('tab-panel-hidden', activeTabId !== 'pension-depletion');
    writeActiveTabToLocation(activeTabId);
    patch(tabsSlot, renderTabBar({ activeTabId, onSelect: setActiveTab }));
  }

  /**
   * [2026-08-20, 관리자 지시(2차) 6번] 로고 클릭 — 첫 탭 활성화 + 페이지
   * 맨 위로 스크롤. **입력값은 지우지 않는다** — `setActiveTab`은 표시만
   * 전환할 뿐 `store`/`reverseStore`를 전혀 건드리지 않는다(이미 그렇게
   * 짜여 있다, 위 함수 참고). 이미 첫 탭이 활성이어도(그리고 `setActiveTab`
   * 이 같은 탭이면 조용히 반환해도) 스크롤은 **항상** 실행한다 — "맨 위로"는
   * 탭 전환과 별개의 약속이다.
   */
  function goToFirstLanding() {
    // [2026-08-21, D81] 「첫 탭」이 이제 `calc2`다 — 소유자가 계산기2를
    // 첫 자리로 옮겼다. 내부 id가 바뀐 것이지 "로고를 누르면 첫 자리로"라는
    // 약속 자체는 그대로다.
    setActiveTab('calc2');
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  // [관리자 지시(4차) 7번, D74] 공유 링크로 열렸으면 입력을 채우고 계산까지
  // 실행한다. 프래그먼트가 아예 없으면(보통 방문) 아무것도 하지 않는다 —
  // `readShareFragmentFromLocation`이 그 둘을 구분한다(`null` vs
  // `{ ok:false, ... }`). **한 번만 읽는다** — 이후 사용자가 값을 고치면
  // 해시가 낡은 값을 계속 가리키게 되지만, 그 상태를 URL과 동기화하는 것은
  // 이번 지시(공유 시점의 스냅샷 링크)의 범위 밖이다.
  //
  // **[2026-08-19, D77] 탭 id 프래그먼트가 먼저다.** `readTabIdFromLocation`이
  // 탭 id를 찾으면 그 탭을 빈 상태로 열고, 옛 공유 링크 데이터 경로는 아예
  // 건드리지 않는다(`state/tab-fragment.js` 머리말 — "프래그먼트 파서가
  // 탭 id와 데이터를 구분") — 탭 id를 그 옛 base64url 디코더에 넣으면
  // `parse_failed`로 잘못 해석되어 "손상된 공유 링크" 배너가 뜨는 회귀가
  // 난다. **[2026-08-23, D84 판정 1]** `readTabIdFromLocation`은 이제
  // 옛 탭 id(`calculator`/`pension-reverse`)도 `calc2`로 리다이렉트해
  // 돌려준다(`state/tab-fragment.js`) — 이 자리는 그 사실을 몰라도 된다.
  const tabIdFromUrl = readTabIdFromLocation();
  if (tabIdFromUrl) {
    activeTabId = tabIdFromUrl;
  } else if (depletionShareResult) {
    // [2026-08-24, 소유자 지시 5번] 이 탭의 공유 링크로 열렸다 — 값은
    // 이미 위에서 `mountDepletionPanel`에 `initialValues`로 넘겼으니
    // 여기서는 탭을 여는 것과(성공 시) 실패를 알리는 것만 한다.
    activeTabId = 'pension-depletion';
    if (!depletionShareResult.ok) mainGroup.before(depletionSharedFragmentInvalidNotice());
  } else {
    const sharedFragment = readShareFragmentFromLocation();
    if (sharedFragment) {
      if (sharedFragment.ok) {
        // [2026-08-23, D84 판정 1] 옛(v:1) 공유 데이터가 가리키던 탭
        // (`calculator`, 옛 근거판)은 지워졌다 — **간결판(계산기2)으로
        // 라우팅해 싣는 값만 싣는다**("링크가 죽는 것보다 낫다"). 간결판이
        // 화면에 묻지 않는 값(청년 자기신고·당해연도 누적 등)이 실려 있으면
        // 조용히 버리지 않고 안내 한 줄을 낸다.
        calc2Store.applySharedForm(sharedFragment.form);
        activeTabId = 'calc2';
        // 방금 공유 링크로 채운 폼을 아래 `activateCalc2Extras`의 일일
        // 프리필(김철수씨 예시)이 덮어쓰지 않게 미리 참으로 둔다.
        calc2Prefilled = true;
        if (sharedFormHasCalc2UnsupportedValues(sharedFragment.form)) {
          mainGroup.before(sharedFragmentPartialNotice());
        }
      } else {
        mainGroup.before(sharedFragmentInvalidNotice());
      }
    }
  }
  // [2026-08-21, D81] 계산기2가 활성 탭이 되는 **모든** 경로 — 탭 id
  // 프래그먼트로 곧장 들어온 경우(`#calc2`)뿐 아니라 **기본 랜딩**(프래그먼트가
  // 아예 없는, 가장 흔한 첫 방문)까지 — 에서 같은 일일 팝업 규칙을 태운다.
  // `activeTabId`가 최종적으로 정해진 뒤(위 두 분기 모두 지난 뒤) 한 번만 본다.
  if (activeTabId === 'calc2') activateCalc2Extras();
  // [2026-08-25, 소유자 지시 9번] 시뮬레이션 탭도 같은 원칙 — 탭 id
  // 프래그먼트(`#pension-depletion`)나 이 탭의 공유 링크(`dep1.`)로 곧장
  // 들어온 경우도 "탭이 활성화되는 경로"이므로 같은 곳에서 한 번만 본다.
  if (activeTabId === 'pension-depletion') activateDepletionExtras();
  calc2Panel.classList.toggle('tab-panel-hidden', activeTabId !== 'calc2');
  depletionPanel.classList.toggle('tab-panel-hidden', activeTabId !== 'pension-depletion');
  mount(tabsSlot, renderTabBar({ activeTabId, onSelect: setActiveTab }));

  renderNow = function renderImpl() {
    const calc2State = calc2Store.getState();
    const focusInfo = captureFocus(mainGroup);
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
    patch(calc2InputSlot, renderCalc2InputPanel({ state: calc2State, store: calc2Store, renderGuard }));
    renderGuard.active = false;
    restoreFocus(focusInfo);
    // **결과 패널도 같은 이유로 고쳐 쓴다.** 통째로 갈아치우면, 입력 칸에서
    // 빠져나오며 걸린 재계산이 재렌더를 부르고 그 재렌더가 `mousedown`과
    // `mouseup` 사이에 버튼 노드를 바꿔치기한다 — 두 이벤트가 서로 다른 노드에
    // 걸리면 브라우저는 `click`을 만들지 않는다. 그래서 무언가를 입력한 직후에
    // 누른 결과 패널의 첫 클릭(공유·시나리오 탭·대안 행)이 통째로 삼켜졌다.
    // 브라우저에서 `mousedown`·`mouseup`은 오는데 `click`이 오지 않는 것을
    // 확인했다(`browser/share-modal.browser.mjs`).
    patch(calc2ResultSlot, renderResultPanel({ state: calc2State, store: calc2Store, resultKey: 'calc2' }));
    // 도넛 진입 애니메이션은 여기, **patch가 끝난 뒤** 실제로 화면에 붙은
    // 노드를 다시 찾아 돌린다. `patch`는 구조가 같으면 새로 만든 노드를 버리고
    // 기존 노드에 속성만 복사하므로, `renderResultPanel`이 만드는 시점에
    // 애니메이션을 걸면 아무도 보지 않는 사본 위에서 돈다 — 화면에 남는
    // 조각은 첫 프레임(0°)에서 멈춘다(charts.js `runDonutEntrance` 머리말).
    runDonutEntrance(calc2ResultSlot);
    // [2026-08-23, D82 소유자 지시 5번] 계산기2 결과 도넛만 지시선 없이,
    // 조각에 더 가까운 라벨로 그린다(`ui/result-panel.js`의 `chartArea`가
    // 계산기2 한정으로 `labelMode: 'legend'`를 강제하는 것과 짝이다 — 그
    // 모드에서만 이 옵션이 뜻이 있다). [2026-08-23, D83 판정 1] `forceOutside:
    // true` — 라벨이 고리 안쪽에 놓이는 것을 막는 상설 규칙.
    applyDonutSliceInlineLabels(calc2ResultSlot, { forceOutside: true, hideLeader: true });
  };

  setRerenderHook(scheduleRender);

  // [2026-08-17, D72] 조각 라벨의 흰/검 대비 승자는 테마마다 뒤집힐 수 있다
  // (`charts.js` `bestTextColorOn` 머리말) — 값이 바뀌지 않아도 테마가 바뀌면
  // 다시 그려야 한다. `ThemeControl`은 store를 거치지 않으므로(위 주석) 테마
  // 전환은 `renderNow`를 다시 부르지 않는다 — 그래서 이 감시를 한 번, 여기서
  // 따로 건다.
  watchDonutThemeChange(() => {
    applyDonutSliceInlineLabels(calc2ResultSlot, { forceOutside: true, hideLeader: true });
  });

  // 도넛은 라벨을 옆에 붙이는지 아래 리스트로 내리는지에 따라 **상자 크기 자체가
  // 다르다**(charts.js `donutGeometry`). CSS는 `viewBox`를 바꿀 수 없으므로 그
  // 판단이 렌더 시점에 들어가고, 폭이 경계를 넘으면 다시 그려야 한다. 없으면
  // 창을 줄인 사용자가 라벨 자리만큼 작아진 도넛을 계속 보게 된다.
  //
  // **`WIDE_DONUT_MEDIA_QUERY`(D48)도 같은 이유로 같은 자리에 건다** — 넓은
  // 데스크톱에서 도넛이 `labelledWide`(320px)로 커지는 경계(1440px)를 창
  // 크기를 바꾸며 넘나드는 사용자가 다시 그리지 않으면 옛 상자를 계속 본다.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    for (const query of [COMPACT_MEDIA_QUERY, WIDE_DONUT_MEDIA_QUERY]) {
      const mq = window.matchMedia(query);
      // Safari 13 이하는 addEventListener를 지원하지 않는다 — 있으면 그것만 쓴다.
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', scheduleRender);
      else if (typeof mq.addListener === 'function') mq.addListener(scheduleRender);
    }
  }

  // [2026-08-12, D48, 2026-08-13 주석 정정 D60, 2026-08-17 다시 소비자가
  // 생긴다 D72] 원래는 `[4-A]` `DisclosureBanner`가 문서 기준 sticky로
  // `top: var(--layout-header-height)`를 썼다. 그 배너는 D60(관리자 판정,
  // 소유자 지시)으로 삭제됐고 한동안 이 값을 읽는 CSS가 `styles.css`에
  // 없었다 — 그래도 지우지 않았다(design-system 5.19.1절의 `LiveSummaryStrip`,
  // 미구현, 같은 토큰을 이미 예약해 뒀다는 이유). **D72로 헤더가 다시
  // `position: sticky`가 되면서 실제 소비자가 하나 더 생겼다** — `.app-main`의
  // `scroll-margin-top`(`styles.css`)이 이 값을 읽는다. 고정 바가 스크롤
  // 목적지 위를 가리는 고전 결함(앵커 스크롤 시 상단이 바에 가려짐)을
  // 막는 자리다(`ui/example-showcase.js`의 `scrollToInputResult`가 부르는
  // `scrollIntoView({ block: 'start' })`가 이 여백을 자동으로 반영한다 —
  // 최신 브라우저는 `scroll-margin-top`을 `scrollIntoView`에도 적용한다).
  // 헤더 높이를 **하드코딩하지 않는다** — 설계 문서가 적은 56px과 실측
  // 77px가 이미 어긋나 있었다(design-system 4.1.1절, 로고+탭으로 바뀐 지금은
  // 그 값 자체도 다시 바뀐다). 헤더 자신이 실제 렌더 높이를 재서 커스텀
  // 프로퍼티로 공개하고, 다음에 이 값을 쓸 요소는 그 값을 읽기만 하면 된다.
  // `ResizeObserver`로 계속 갱신한다 — 모바일에서 브랜드·탭이 두 줄로
  // 접히는 등 헤더 높이가 폭에 따라 바뀌는 경우를 폭 경계 하나로 특정하지
  // 않고 실제 크기 변화 자체를 본다.
  function syncHeaderHeight() {
    if (typeof document === 'undefined') return;
    const height = header.getBoundingClientRect().height;
    if (height > 0) document.documentElement.style.setProperty('--layout-header-height', `${height}px`);
  }
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(syncHeaderHeight).observe(header);
  } else if (typeof window !== 'undefined') {
    // 아주 오래된 브라우저를 위한 대비책 — 창 리사이즈에만 반응한다.
    window.addEventListener('resize', syncHeaderHeight);
  }
  syncHeaderHeight();

  renderNow();

  return { render: scheduleRender, calc2Store };
}
