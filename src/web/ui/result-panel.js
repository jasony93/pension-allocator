/**
 * 결과 패널 — `screens.md` 4·5·8절. 다섯 상태(입력 부족·빈·로딩·오류·정상)를
 * 전부 이 모듈이 담당한다. 고지 요소의 배치는 `screens.md` 4.2절 표를 그대로
 * 따른다 — 요소 ③④는 기본 펼침. **요소 ①②(성격·자격 배너)는 D60(관리자
 * 판정, 소유자 지시)으로 삭제됐고, 요소 ⑤(`LimitNote`)는 D61(관리자 판정,
 * 소유자 지시, 세 번째 같은 방향)로 삭제됐다** — 어느 것도 게시 의무가 있는
 * 문구가 아니라 이 서비스가 스스로 세운 방어였고, 소유자가 위험의 크기를
 * 확인한 뒤 지웠다.
 */

import { el } from './dom.js';
import { iconChart } from './icons.js';
import {
  ACCOUNT_LABEL,
  PLAN_LABEL,
  ENTRY_COPY,
  EXPECTATION_COPY,
  noticeMessage,
  assumptionMessage,
  warningMessage,
  comparisonNoteMessage,
  errorMessage,
  exclusionReasonMessage,
  excludedFromComparisonMessage,
  contributionRemainingCaption,
  creditHeadroomExceededMessage,
  isaTaxFreeCaption,
  ISA_TAX_FREE_SHORT_CAPTION,
  donutSingleSliceCaption,
  unallocatedReasonMessage,
  unallocatedBreakdownMessage,
  pensionWithoutCreditMessage,
  notAllocatedInPlanCaption,
  CONDITIONAL_PENDING_ALERT,
  CONDITIONAL_PENDING_STALE_CAPTION,
  RESULT_PLACEHOLDER_COPY,
  EXCLUDED_ACCOUNT_FALLBACK_REASON,
  EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER,
  PROPOSED_BADGE_LABEL,
  FILL_ORDER_NOTE_HEADING,
  fillOrderFactMessage,
  fillOrderDecisionMessage,
  AMOUNT_CARD_LABEL_CREDIT_ONLY,
  AMOUNT_CARD_LABEL_COMPOSITE,
  AMOUNT_CARD_LABEL_DELTA,
  capReducedNote,
  CAP_CARRYOVER_NOTE,
  TAX_CAP_ESTIMATE_NOTE,
  AMOUNT_CARD_CAPTION_REDUCED_CLAUSE,
  headlineValueText,
  headlineComponentDeterminedLine,
  headlineComponentAssumptionLine,
  STACKBAR_CAP_APPLIED_NOTE,
  ACCOUNT_BENEFIT_STRIP_TITLE,
  ACCOUNT_BENEFIT_STRIP_REF_CAPTION,
  ACCOUNT_BENEFIT_POOLED_NOTE,
  ACCOUNT_BENEFIT_ZERO_DIFFERENCE_NOTE,
  ACCOUNT_BENEFIT_REDUCED_NOTE,
  ACCOUNT_BENEFIT_CAP_BELOW_CEILING_NOTE,
  confirmedAxisAmountSentence,
  confirmedAxisBasisSentence,
  assumptionAxisCaption,
  ASSUMPTION_AXIS_CEILING_EXPLAINER,
  isaTaxFreeCeilingSentence,
  ACCOUNT_BENEFIT_NO_STATUTORY_CEILING_SUFFIX,
  boundedAxisAmountText,
  ACCOUNT_BENEFIT_ISA_NARRATIVE,
  ACCOUNT_BENEFIT_EXCLUDED_LABEL,
  ACCOUNT_BENEFIT_ISA_TAX_FREE_LABEL,
  ACCOUNT_BENEFIT_ISA_RATE_GAP_LABEL,
  ACCOUNT_BENEFIT_ISA_RESIDUAL_LABEL,
  ACCOUNT_BENEFIT_RATE_GAP_FAVORABLE_ZERO_NOTE,
  ACCOUNT_BENEFIT_FAVORABLE_ZERO_CHIP_LABEL,
  PENSION_REFERENCE_RETAX_SENTENCE,
  PENSION_REFERENCE_NOT_COMPUTABLE_SENTENCE,
  PENSION_REFERENCE_TABLE_HEADERS,
  PENSION_REFERENCE_SUMMARY_LABEL,
  pensionRateGapRangeText,
  pensionIncomeCharacterLabel,
  pensionWithdrawalBranchLabel,
  pensionGapSignLabel,
  ISA_RETURN_NOT_COMPUTABLE_NOTE,
  ISA_RETURN_SUPPRESSED_NOTE,
  isaReturnEstimateAmountText,
  isaReturnAssumptionCaption,
  donutSectionTitle,
  donutPlanNameCaption,
  DONUT_OPTIMAL_KICKER_LABEL,
  PDF_EXPORT_LABEL,
  IMAGE_EXPORT_LABEL,
  SAVE_SHARE_HEADING,
  SUMMARY_EXPORT_NOTE,
  PDF_EXPORT_BLOCKED_NOTE,
  IMAGE_EXPORT_BLOCKED_NOTE,
  SHARE_LINK_LABEL,
  SHARE_LINK_COPIED_NOTE,
  SHARE_LINK_COPY_BLOCKED_NOTE,
  ISA_CARRYOVER_REPEAL_DIVERGENCE_NOTE,
  CURRENT_SCENARIO_TAB_LABEL,
  PROPOSED_SCENARIO_TAB_LABEL,
  proposedSameAsCurrentNotice,
} from '../copy.js';
import { formatKrw, formatPercent, formatPlanRowAmount } from '../format.js';
import { CORE_REQUIREMENTS, formDerivedAssumptionCodes } from '../state/validation.js';
import { taxCreditHeadlineView, anyPlanCapApplied, showsCapBelowCeilingNote, HEADLINE_MODE } from '../tax-credit-view.js';
import { buildShareUrl } from '../state/share-link.js';
import { CALC2_DONUT_OPTIMAL_KICKER_LABEL } from '../calc2-copy.js';
import { SAVE_SHARE_IMAGE_ICON_DATA_URI, SAVE_SHARE_IMAGE_ICON_INTRINSIC_WIDTH, SAVE_SHARE_IMAGE_ICON_INTRINSIC_HEIGHT } from '../assets/save-share-image-icon.js';
import { SAVE_SHARE_SHARE_ICON_DATA_URI, SAVE_SHARE_SHARE_ICON_INTRINSIC_WIDTH, SAVE_SHARE_SHARE_ICON_INTRINSIC_HEIGHT } from '../assets/save-share-share-icon.js';
import {
  donutChart,
  donutLegend,
  allocationBar,
  stackBarSegments,
  computeTrackScalePercent,
  benefitMeter,
  placeholderRing,
  prefersReducedMotion,
  nextSeatStep,
  shapeOf,
  CHART_ACCOUNT_ORDER,
} from './charts.js';
import {
  accountLimitView,
  accountBenefitRows,
  excludedAccounts,
  fillOrderTieBreak,
  lawEntriesFor,
  pensionCreditHeadroomView,
  unallocatedBlockers,
  PENSION_ACCOUNTS,
} from './eligibility.js';
import { exportToPdf } from './print.js';
import { scenarioDisplaysEqual } from './scenario-compare.js';
import { buildSummaryData } from './summary-data.js';
import { exportSummaryPng, downloadDataUrl, buildSummarySvgMarkup, summarySvgElementFromMarkup } from './summary-image.js';

// 필수 항목의 라벨·초점 대상·충족 판정은 `validation.js`의 `CORE_REQUIREMENTS`
// 한 곳에만 있다. 여기에 다시 적으면 항목이 늘 때 한쪽만 고쳐진다.

// ---------------------------------------------------------------------------
// 입력 부족 / 빈 상태 (8.1 / 8.2)
// ---------------------------------------------------------------------------

function requirementChecklist({ form, validation }) {
  // 9.0.0(D39) — `priorTax` 항목이 사라지면서 `req.key`와 오류 맵의 키가
  // 어긋나는 항목이 없어졌다. 예전에는 여기 `errorKeyFor` 매핑이 있었다.
  const items = CORE_REQUIREMENTS.map((req) => {
    const filled = !validation.errors[req.key] && req.isFilled(form);
    return el(
      'button',
      { type: 'button', class: `req-item${filled ? ' req-item-filled' : ''}`, onclick: () => focusField(req.fieldId) },
      [
        el('span', { class: 'req-dot', 'aria-hidden': 'true' }, [filled ? '●' : '○']),
        el('span', {}, [
          req.label,
          // "모르면 모르겠습니다를 고르면 됩니다" — 막는 항목이 아니라는 사실을
          // 체크리스트 행에서 바로 말한다(screens.md 3.8.3절 빈 상태).
          req.hint && !filled ? el('span', { class: 'req-hint' }, [req.hint]) : null,
        ]),
        el('span', { class: 'req-status' }, [filled ? '입력됨' : '→ 입력하기']),
      ],
    );
  });

  const conditionalPendingRow =
    form.isaExists && form.isaTransferEnabled && !form.isaTransferAmount
      ? el('button', { type: 'button', class: 'req-item req-item-conditional', onclick: () => focusField('isaTransferAmount') }, [
          el('span', {}, ['▸ ISA 만기 전환을 선택하셔서 전환 금액이 추가로 필요합니다']),
          el('span', { class: 'req-status' }, ['→ 입력하기']),
        ])
      : null;

  const total = validation.requiredTotal;
  const filledCount = validation.requiredFilledCount;
  const progressLabel = conditionalPendingRow ? `${filledCount} / ${total} · 추가 항목 1개` : `${filledCount} / ${total} 항목`;

  return el('div', { class: 'requirement-checklist' }, [
    el('div', { class: 'req-progress-row' }, [
      el('span', { class: 'type-title-m' }, ['계산에 필요한 값이 아직 남았습니다']),
      el('span', { class: 'req-progress-label' }, [progressLabel]),
    ]),
    el('div', { class: 'req-progress-bar' }, [
      el('div', { class: 'req-progress-fill', style: { width: `${(filledCount / total) * 100}%` } }),
    ]),
    el('div', { class: 'req-checklist-box' }, items),
    el('p', { class: 'field-help' }, ['기납입액은 진행을 막지 않는다 — 0으로 계산하고 그 사실을 아래 가정에 적습니다.']),
    conditionalPendingRow,
  ]);
}

function focusField(key) {
  const target = document.getElementById(key);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus();
  }
}

/**
 * `LawChip`·`AccountBenefitStrip` 행이 공유하는 "누르면 그 항목으로 스크롤 +
 * 1.2초 하이라이트" 동작(design-system 5.9·5.31절). 포커스를 주지 않는다 —
 * 목적지가 버튼이 아니라 표의 행이라 포커스 이동은 스크린리더 사용자에게
 * 없던 조작 초점을 만든다.
 */
function scrollAndHighlight(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('row-highlight');
  setTimeout(() => target.classList.remove('row-highlight'), 1200);
}

/**
 * `ResultPlaceholder` — design-system 5.29절 · screens.md 8.1절.
 *
 * **`RequirementChecklist`와 분업한다.** 체크리스트가 "무엇을 하면 되는가"에
 * 답하고(항목 이름·남은 개수·진행 막대), 자리표시자는 "무엇이 나오는가"에
 * 답한다(결과의 형태와 자리·문구 두 줄). **자리표시자에는 숫자가 없다** — 남은
 * 항목 수를 여기 적으면 조건부 필수 항목이 분모에 안 들어가는 탓에 두 곳의 수가
 * 실제로 어긋나고, 어긋나는 순간 사용자는 어느 쪽을 믿을지 모른다.
 *
 * 링과 `?`는 `aria-hidden`이고 대체 문장 한 줄이 그 자리를 대신한다.
 * **`aria-live`를 걸지 않는다** — 빈 상태는 갱신이 아니다.
 */
function resultPlaceholder() {
  return el('div', { class: 'result-placeholder' }, [
    placeholderRing(),
    el('p', { class: 'visually-hidden' }, [RESULT_PLACEHOLDER_COPY.screenReader]),
    el('div', { class: 'placeholder-copy' }, [
      // 강조는 크기·굵기·색으로만 한다(8.1절 2번).
      el('p', { class: 'placeholder-copy-lead type-title-s' }, [RESULT_PLACEHOLDER_COPY.lead]),
      el('p', { class: 'placeholder-copy-sub type-body-s' }, [RESULT_PLACEHOLDER_COPY.sub]),
    ]),
  ]);
}

/** 사라지는 중인 링 — 120ms 뒤 그 자리를 도넛이 받는다. 문구 두 줄은 함께 가지 않는다. */
function leavingPlaceholderRing() {
  const ring = placeholderRing();
  ring.setAttribute('class', 'placeholder-ring placeholder-ring-leaving');
  return ring;
}

function inputIncompletePanel(state) {
  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'result-body' }, [
      requirementChecklist(state),
      resultPlaceholder(),
      el('div', { class: 'expectation-block' }, [
        el('h3', { class: 'type-title-s' }, ['이 계산기가 보여주는 것']),
        el(
          'ul',
          {},
          EXPECTATION_COPY.map((line) => el('li', {}, [line])),
        ),
      ]),
      el(
        'div',
        { class: 'entry-copy' },
        ENTRY_COPY.map((line) => el('p', {}, [line])),
      ),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// 로딩 상태 (8.3)
// ---------------------------------------------------------------------------

function loadingOverlayClass(hasPriorResult) {
  return hasPriorResult ? 'result-loading-overlay' : 'result-loading-fresh';
}

// ---------------------------------------------------------------------------
// 오류 상태 (8.4)
// ---------------------------------------------------------------------------

function fieldErrorBanner(store) {
  return el('div', { class: 'inline-alert inline-alert-error', role: 'alert' }, [
    el('p', { class: 'type-body-strong' }, ['입력값에 확인이 필요한 항목이 있어 아래 결과를 갱신하지 않았습니다.']),
    el('button', { type: 'button', class: 'btn btn-text', onclick: () => document.querySelector('.field-input-error')?.focus() }, [
      '→ 항목 보기',
    ]),
  ]);
}

function fatalErrorPanel(fatalError) {
  const errors = fatalError?.errors ?? [];
  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'inline-alert inline-alert-error', role: 'alert' }, [
      el('p', { class: 'type-body-strong' }, ['계산에 필요한 세법 규칙을 불러오지 못했습니다. 결과를 표시하지 않습니다.']),
      errors.length ? el('p', { class: 'type-body-s' }, [errors.map(errorMessage).join(' ')]) : null,
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => location.reload() }, ['다시 시도']),
    ]),
  ]);
}

function blockedPanel(fatalError, store) {
  const notices = fatalError?.reasonNotices ?? [];
  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'inline-alert inline-alert-error', role: 'alert' }, [
      el('p', { class: 'type-body-strong' }, ['입력한 조건에서는 배분을 계산할 수 없습니다']),
      notices.length
        ? el(
            'ul',
            {},
            notices.map((n) => el('li', {}, [noticeMessage(n)])),
          )
        : el('p', {}, ['입력한 조건에서 세 계좌 모두 배분 대상이 아닙니다.']),
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => focusField('birthDate') }, ['입력으로 이동']),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// 정상 상태 (4·5절)
// ---------------------------------------------------------------------------

/**
 * [2026-08-14, 관리자 지시 — 배포 번들 실측 회귀] `.amount-card-value`(헤드라인
 * 금액)를 **금액 덩어리 단위로 줄바꿈이 꺾이게** 만든다.
 *
 * **원인.** 한국어 텍스트의 기본 줄바꿈 규칙은 한글 음절이 인접한 문자와의
 * 사이에서도 꺾일 수 있게 허용한다(`word-break: normal`의 기본 동작, 라틴
 * 문자만 공백에서 꺾이는 것과 다르다). `formatKrw`가 내는 "1,713,690원"은
 * 숫자·쉼표(라틴/ASCII)에 한글 "원" 한 글자가 곧바로 붙은 문자열이라, 폭이
 * 좁아지면 브라우저가 **"690"과 "원" 사이**를 유효한 줄바꿈 지점으로 보고
 * 그 자리에서 꺾는다 — "원"이 혼자 다음 줄에 남는 것은 이 기본 규칙의
 * 결과이지 우연한 결함이 아니다. 관리자가 배포 번들(1440px)에서 실측으로
 * 확인했고, 구간 헤드라인("최소 ~ 최대")에서는 두 금액 덩어리 사이(공백)
 * 조차 아무 데서나 다시 꺾여 3줄로 흩어지는 것도 함께 확인했다.
 *
 * **수정.** `formatKrw`가 낸 금액 문자열 전체(숫자+"원")를 `nowrap` span
 * 하나로 묶는다 — 그 안에서는 어떤 이유로도 줄이 꺾이지 않는다. 구간
 * 헤드라인은 " ~ "로 정확히 둘로 나뉘고(`formatKrw`는 공백·물결을 내지
 * 않으므로 이 구분자가 유일하다), **그 사이에만** 보통 공백(텍스트 노드,
 * 줄바꿈 허용)을 남긴다 — "줄바꿈은 두 덩어리 사이에서만" 나야 한다는
 * 지시를 그대로 구현한 것이다.
 *
 * **`textContent`는 바뀌지 않는다.** 덩어리 텍스트 + 사이 공백을 그대로
 * 이어붙이면 `headlineValueText`/`formatPlanRowAmount`가 낸 원래 문자열과
 * 글자 하나까지 같다 — `example-showcase.browser.mjs`의 "화면에 렌더된
 * 예시 값이 …정확히 같다" 검사가 문자열 비교(`.textContent`)로 이미 이
 * 불변식을 고정한다.
 */
export function amountValueNode(text) {
  const SEP = ' ~ ';
  const idx = text.indexOf(SEP);
  if (idx === -1) return [el('span', { class: 'amount-value-chunk' }, [text])];
  const before = text.slice(0, idx);
  const after = text.slice(idx + SEP.length);
  return [
    el('span', { class: 'amount-value-chunk' }, [before]),
    ' ',
    el('span', { class: 'amount-value-chunk' }, [`~ ${after}`]),
  ];
}

/**
 * D45 3번(관리자, 2026-08-11) — 헤드라인 자리의 대안 미리보기 형태. **`plan`의
 * `delta_vs_baseline_krw`를 새로 계산하지 않는다** — `formatPlanRowAmount`가
 * 스택바 비교 행에서 이미 쓰는 바로 그 함수이고, 여기서 `plan.is_baseline`이
 * 이미 `false`임을 호출부(`amountCard`)가 확인했으므로 반환값은 언제나
 * `formatDelta(plan.delta_vs_baseline_krw)`와 같다(`format.js`) — 스택바 행에
 * 뜨는 문자열과 글자 그대로 같다.
 *
 * 구성 두 줄(슬롯5)이 없다 — 차이는 세액공제액만의 차이이고(계약 9.0.0
 * `delta_vs_baseline_krw` 정의: "기본안 대비 세액공제액 차이"), 없는 합계를
 * 구성하는 두 줄을 그릴 대상이 없다.
 */
function alternativePlanDeltaCard(plan, baseCaption) {
  return el('div', { class: 'amount-card amount-card-delta' }, [
    el('p', { class: 'amount-card-label' }, [AMOUNT_CARD_LABEL_DELTA]),
    el('p', { class: 'amount-card-value type-display' }, amountValueNode(formatPlanRowAmount(plan))),
    el('p', { class: 'amount-card-caption' }, [baseCaption]),
  ]);
}

/**
 * `amountCard`의 캡션 문자열만 떼어낸 **순수 함수**(D40·D61 회귀 방지). DOM을
 * 만들지 않으므로 이 저장소가 갖지 않은 jsdom 없이도 `node:test`로 직접 잠글
 * 수 있다 — "사용자 자신의 결과(기본값)에서는 언제나 `TAX_CAP_ESTIMATE_NOTE`가
 * 있다"는 계약을 캡션을 만드는 이 한 곳에서, DOM 문자열이 아니라 반환값으로
 * 바로 확인한다(`result-panel-caption.test.mjs`). `amountCard`(바로 아래)는
 * 이 함수의 반환값을 그대로 옮겨 적을 뿐, 문구를 다시 조립하지 않는다.
 */
export function amountCardBaseCaption(scenario, { compactCaption = false } = {}) {
  // D40 — **사용자 자신의 결과에서는 언제나** 붙는다. 이 한도가 총급여액에서
  // 계산한 상한이고 다른 소득공제·세액공제를 반영하지 않았으며, 그래서 실제
  // 공제는 이보다 적을 수 있다는 사실이 금액과 같은 화면에 있어야 한다(계약
  // 8.7절 `required_display`). 대안 미리보기(위 `alternativePlanDeltaCard`)에서도
  // 같은 캡션을 쓴다 — 차이도 같은 과세연도·같은 한도 규칙 위에서 계산된
  // 세액공제액의 차이이기 때문이다. `compactCaption`이 `true`(예시 전용)일
  // 때만 축약한다(`ui/example-showcase.js`, 관리자 지시 2026-08-14 5번).
  return compactCaption
    ? `${scenario.ruleset.tax_year} 과세연도 기준`
    : `${scenario.ruleset.tax_year} 과세연도 기준 · 국세 + 개인지방소득세 합산 · 다른 소득공제 미반영 · ${TAX_CAP_ESTIMATE_NOTE}`;
}

/**
 * `AmountCard` — 금액 표시의 유일한 통로(design-system 5.6절). 슬롯 셋이 필수이고
 * 상한 변형에서는 넷, 구간 변형(D38)에서는 다섯이 된다.
 *
 * **D38 — 헤드라인은 `plan.headline_composite_total`을 그대로 읽는다. 화면이
 * 조립하지 않는다.** 소유자가 제품의 목적을 "세액공제가 얼마냐"에서 "얼마나
 * 아꼈냐"로 다시 정의했다(관리자 D38) — 세액공제와 ISA 혜택의 합계가 헤드라인이
 * 된다. 단, 두 성분의 단위 기간이 달라(세액공제=과세기간, ISA=계약기간) 합계에는
 * 「연간」 같은 기간 이름을 붙일 수 없고, 가정 성분이 들어 있으면 **구성 두 줄이
 * 같은 화면에 없는 채로 합계만 적는 것이 금지된다**(design-system 5.6절 "구간
 * 변형", 계약 5.17절).
 *
 * **[2026-08-11, D45 3번] 이 헤드라인은 기본안이 그려질 때만 있다.** 대안을
 * 눌러 미리 보면 `plan`이 대안으로 바뀌는데, 대안은 확정 성분(세액공제)이
 * 0인 경우가 있어 그 합계 구간의 아래 끝이 「최소 0원」이 되는 조합이
 * 나왔다 — 소유자가 그것을 보고 "기본안만 붙여줘"라고 답했다. 대안일 때는
 * 이 자리에 **기본안 대비 차이**가 온다(`alternativePlanDeltaCard`) — 스택바
 * 비교 행이 이미 낸 값(`formatPlanRowAmount`)을 그대로 옮기고, 화면은 새로
 * 계산하지 않는다. 구성 두 줄(슬롯5)도 함께 빠진다 — 합계가 없으면 그 두
 * 줄이 무엇의 구성인지 말할 대상이 없다(design-system 5.6절 "구간 변형"의
 * 뒷면).
 *
 * **`screens.md` 4.8절의 세액 한도 두 상태**(정상=plain·잘림=reduced, 2026-08-11
 * D39 전면 개정 — 옛 세 상태에서 "모름"이 빠졌다)는 여전히 `tax-credit-view.js`가
 * 엔진 응답에서 **고르기만** 하고, 이 함수는 그 결과와 `headline_composite_total`을
 * 함께 그린다 — 화면이 뺄셈·덧셈을 시작하면 그 순간 세법 판단이 화면 코드로
 * 들어온다. **전부 잘려 0원이 되는 극단도 `reduced` 하나에 흡수된다** — 별도
 * "0" 라벨·캡션을 두지 않는다.
 *
 * **오류가 아니다.** `state-error`·`state-warning` 색을 쓰지 않는다. 사용자가
 * 무언가를 잘못해서 생긴 상태가 아니다.
 *
 * **내보낸다** — `ui/example-showcase.js`(관리자 지시 2026-08-14 4번)가 예시
 * 헤드라인을 이 함수로 그린다. 예시도 사용자의 실제 결과와 **같은 경로**로
 * 계산·문구화되어야 한다는 것이 그 지시의 요구이고, 이 함수가 그 경로 자체다
 * (D36·D38의 「절세액」/「세액공제액」·구성 두 줄 규칙을 화면이 두 번 구현하면
 * 그중 하나는 반드시 낡는다).
 *
 * **`compactCaption`**(관리자 지시 2026-08-14 5번, 기본값 `false`) — 예시
 * 전용 축약. 사용자의 실제 결과에서는 **절대 `true`로 부르지 않는다**(모든
 * 실제 호출부는 인자를 생략해 기본값 `false`를 그대로 쓴다) — D40·D61이
 * TAX_CAP_ESTIMATE_NOTE를 "언제나" 금액과 같은 화면에 두라고 못박은 자리는
 * 사용자 자신의 결과이지, 재계산되지 않는 고정 예시가 아니다. 소유자가
 * "예시에는 이만큼 필요하지 않다"고 명시했고, 긴 캡션 중 과세연도 기준
 * 표기만 남기고 나머지(국세+지방소득세 합산·다른 소득공제 미반영·한도 추정
 * 문장)를 뗀다. **잘림(`isReduced`) 안내 문단(`amount-card-direction`)은
 * `compactCaption`과 무관하게 그대로 남는다** — 그건 캡션(부가 고지)이 아니라
 * 이 배분에서 실제로 무슨 일이 있었는지 설명하는 사실 문장이라, 줄일 대상이
 * 아니다. 캡션 문자열 자체는 `amountCardBaseCaption`(바로 위) 한 곳에서만
 * 조립한다 — 이 함수는 그 반환값을 그대로 옮겨 적는다.
 *
 * **`showCaption`·`showComposition`**(D70, 관리자 지시 2026-08-16, 둘 다
 * 기본값 `true`) — 예시 전용으로 캡션과 구성 두 줄을 **통째로 렌더하지
 * 않는다.** 소유자가 예시에서 「2026 과세연도 기준」 캡션과 구성 두 줄(「올해
 * 세액공제 …원」·「+ 앞으로 3년 동안 ISA 최대 …원」)을 빼라고 명시로
 * 지시했다 — `compactCaption`(캡션을 줄이는 것)만으로는 부족하고 캡션
 * 자체가 없어야 한다. **사용자 자신의 실제 결과에서는 이 두 옵션을 절대
 * `false`로 부르지 않는다**(모든 실제 호출부는 인자를 생략해 기본값
 * `true`를 그대로 쓴다) — D38이 "구성 두 줄이 같은 시야에 없으면 합계
 * 자체를 적는 것이 금지"라고 못박은 것은 사용자 자신의 결과를 향한 것이고,
 * 이 예외는 예시 하나에만 있다(D70 — 그 규칙이 지키려던 것, 즉 "가정이
 * 섞였다는 사실을 감추지 않는다"가 예시에서는 다른 채널로 이미 서 있기
 * 때문: 구간 모양 자체·"예시)" 표기·같은 시야의 「연 평균 수익률」 입력
 * 줄). **헤드라인 값 자체(`amount-card-value`, 구간 `○원 ~ ○원`)는 이
 * 옵션과 무관하게 언제나 그려진다** — 구성 두 줄과 캡션은 그 값을 "설명"할
 * 뿐, 값 자체의 일부가 아니다.
 */
export function amountCard(
  plan,
  scenario,
  annualReturnRate = null,
  { compactCaption = false, showCaption = true, showComposition = true } = {},
) {
  const baseCaption = amountCardBaseCaption(scenario, { compactCaption });

  if (!plan.is_baseline) {
    return alternativePlanDeltaCard(plan, baseCaption);
  }

  const view = taxCreditHeadlineView(plan);
  const headline = plan.headline_composite_total;

  // **합계에 가정 성분이 들어 있는가**(headline.includes_assumption_component)가
  // 이 카드의 모든 다른 판정보다 먼저 온다 — 「절세액」이라는 낱말을 쓸 수
  // 있는지, 구성 두 줄을 그려야 하는지가 전부 이 값 하나로 갈린다(계약 5.17절).
  const includesAssumption = headline.includes_assumption_component;
  const isReduced = view.mode === HEADLINE_MODE.REDUCED;

  const label = includesAssumption ? AMOUNT_CARD_LABEL_COMPOSITE : AMOUNT_CARD_LABEL_CREDIT_ONLY;

  // 슬롯2/슬롯2' — `bound_code`가 `range`면 두 끝을, `point`면 한 수를 적는다.
  // **세액 한도 자체에는 「최대」 접두를 붙이지 않는다**(D41) — 방향이 미정인
  // 분기(`direction_indeterminate`)에서는 「최대」도 「적어도」도 쓸 수 없고,
  // 그 제약을 지키는 가장 안전한 길은 애초에 한도 기반 접두를 만들지 않는
  // 것이다. `boundedPrefix`는 ISA `bound_code`(구간/점)에만 쓴다.
  const valueText = headlineValueText(headline);

  // 슬롯5(구성 두 줄, D38) — **가정 성분이 있을 때만, 접지 않는다.** 슬롯2'을
  // 적으려면 슬롯5가 반드시 같은 화면에 있어야 한다(design-system 5.6절). 줄①은
  // `bound_code`와 무관하게 언제나 슬롯2'의 {최소}(또는 point) 안에 든 확정
  // 성분과 같은 수다(항등식).
  const compositionBlock = includesAssumption && showComposition
    ? el('div', { class: 'amount-card-composition' }, [
        el('p', { class: 'amount-card-composition-line type-num' }, [headlineComponentDeterminedLine(headline)]),
        el('p', { class: 'amount-card-composition-line type-num' }, [
          headlineComponentAssumptionLine(headline, annualReturnRate),
        ]),
      ])
    : null;

  if (isReduced) {
    return el('div', { class: 'amount-card' }, [
      el('p', { class: 'amount-card-label' }, [label]),
      el('p', { class: 'amount-card-value type-display' }, amountValueNode(valueText)),
      showCaption ? el('p', { class: 'amount-card-caption' }, [`${baseCaption} · ${AMOUNT_CARD_CAPTION_REDUCED_CLAUSE}`]) : null,
      el('div', { class: 'amount-card-direction' }, [
        // 자르기 전 금액을 함께 보인다 — 잘린 뒤 금액만 보이면 사용자는 배분이
        // 잘못됐다고 읽는다. 실제로는 배분이 아니라 **세액이 한도였다**.
        el('p', { class: 'type-body-s' }, [capReducedNote(view.beforeCapKrw, view.reducedTotalKrw)]),
        view.contributionCarryoverAvailable ? el('p', { class: 'type-body-s' }, [CAP_CARRYOVER_NOTE]) : null,
      ]),
      compositionBlock,
    ]);
  }

  return el('div', { class: 'amount-card' }, [
    el('p', { class: 'amount-card-label' }, [label]),
    el('p', { class: 'amount-card-value type-display' }, amountValueNode(valueText)),
    showCaption ? el('p', { class: 'amount-card-caption' }, [baseCaption]) : null,
    compositionBlock,
  ]);
}

function allExitPenaltyBanner() {
  return el('div', { class: 'warning-note warning-note-banner' }, [
    el('p', {}, [comparisonNoteMessage('all_accounts_have_early_exit_penalty')]),
  ]);
}

/**
 * 5.0.0(D27) — `credit_rate_bracket.fallback_applied`가 `true`면 금액과 **같은
 * 화면에** 무엇이 적용됐고 왜인지를 적는다(계약 0.7절·10절). 세액 한도의
 * "최대 이만큼"과 방향이 반대다 — 이쪽은 "적어도 이만큼"이므로 같은 배너 틀을
 * 쓰지 않는다. `AmountCard`의 세 상태 기계(`tax-credit-view.js`)를 건드리지
 * 않고 그 위에 사실 배너 하나를 더한다 — 두 상태가 겹쳐도(한도도 모르고
 * 종합소득금액도 모르는 경우) 각자의 사실을 각자의 문장으로 말하게 하기 위해서다.
 */
function creditRateFallbackBanner(creditRateBracket) {
  if (!creditRateBracket?.fallback_applied) return null;
  return el('div', { class: 'warning-note warning-note-banner' }, [
    el('p', {}, [noticeMessage({ code: 'credit_rate_global_income_missing', params: {} })]),
  ]);
}

/**
 * D59(관리자 판정) — 조항 표기는 한 덩어리가 아니라 셋이었다. 지운 것은 (a)
 * 접힌 「법령 조항 N건」 나열 블록(`basisBlock`, 통째로 삭제)뿐이고, 이
 * 헬퍼는 (b) 배제 사유(`eligibilityNote`)와 (c) 「법령이 정한 것」 태그
 * (`fillOrderNote`) 두 자리에서 다시 쓴다 — 그 둘은 나열이 아니라 개별 주장에
 * 붙는 근거다.
 */
function lawChipRow(laws, className = 'note-laws') {
  if (!laws.length) return null;
  return el(
    'p',
    { class: className },
    laws.map((entry) => el('span', { class: 'law-chip' }, [entry.law])),
  );
}

function exclusionReasonText(view) {
  return view.reasonCodes.length
    ? view.reasonCodes.map(exclusionReasonMessage).join(' ')
    : EXCLUDED_ACCOUNT_FALLBACK_REASON;
}

/**
 * `EligibilityNote`(design-system 5.24절) — 계좌가 법령 요건 때문에 배분 대상에서
 * 빠졌다는 **사실 통지**.
 *
 * **`state-info`를 쓰고 `state-warning`을 쓰지 않는다.** 엔진은 이 사유를
 * `severity: "warning"` notice로도 내지만, 계약에서 `warning`은 "결과의 정확도에
 * 영향을 준다"는 뜻이지 사용자에게 주의하라는 뜻이 아니다. 자격 미달은 사용자가
 * 잘못해서 생긴 상태가 아니고 대개 바꿀 수도 없다 — 주의 색을 칠하면 사용자가
 * 자기 상황을 결함으로 읽는다. **화면의 색은 화면이 정한다.**
 *
 * **D59(관리자 판정) — `LawChip`을 남긴다.** D46 2·3번으로 조항 표기를 걷어낼 때
 * 이 자리도 함께 지웠으나, `tax-domain`이 다시 재서 이 자리는 「나열」이
 * 아니라고 판정했다. `screens.md` 8.4(b)가 "차단 사유에 반드시 `LawChip`을
 * 붙인다"고 못박은 자리이고, 지우면 "이 계산기가 당신의 계좌를 뺐다"만 남아
 * 서비스가 임의로 막는 것처럼 읽힌다 — 법령 조건이라는 근거가 사라진다.
 * 배제가 없는 대다수 사용자에게는 이 칩이 아예 나타나지 않으므로 소유자가
 * 신고한 "나열"과도 부딪치지 않는다.
 */
function eligibilityNote(view, scenario) {
  return el('div', { class: 'eligibility-note' }, [
    el('p', { class: 'type-body-s' }, [exclusionReasonText(view)]),
    lawChipRow(lawEntriesFor(scenario, view.basisRuleIds), 'note-laws'),
  ]);
}

/**
 * 이 배분안이 연금 두 계좌를 어느 순서로 채웠는지, **그리고 왜 그 순서인지**.
 *
 * 소유자가 프로토타입을 보고 "왜 IRP를 먼저 채우는지 알려달라"고 물었다. 그
 * 물음이 맞았고 엔진의 순서가 바뀌었다(계약 0.4절). 그러므로 화면은 이제
 * **묻기 전에** 답해야 한다.
 *
 * **계좌 이름을 코드에 박지 않는다.** 어느 쪽이 인출이 자유로운지는 룰셋이
 * 정하고, 엔진이 `priority_basis.fill_sequence`에 **실제로 쓴 순서**를 실어
 * 보낸다(계약 5.6절: "고정 배열로 가정하지 말고 이 값을 읽어라"). 순서가
 * 뒤집히면 이 문장도 따라 뒤집힌다.
 *
 * **언제 그리는가.** `tie_break.code`가 `withdrawal_flexibility_first`일 때만이다.
 * 개정안 청년 우대처럼 두 계좌의 공제율이 갈리면 동점이 아니고 순서를 정한 것은
 * 세액공제 최대화이므로(계약 0.4절 지킨 선 1), 이 문장은 사실이 아니게 된다.
 * 더해서, 먼저 채운 계좌에 실제로 들어간 금액이 0이면 순서가 화면에 나타나지
 * 않으므로 설명할 대상도 없다 — 그때는 그리지 않는다.
 *
 * **D59(관리자 판정) — 근거 조항(`tie_break.basis_rule_ids`)의 `LawChip`을
 * 남긴다** 했으나(D46 2·3번으로 한 차례 뗐다가 `tax-domain`이 다시 재서
 * 되돌린 자리), **D61(관리자 판정, 소유자 지시, 세 번째 같은 방향)로
 * 「법령이 정한 것」·「이 계산기가 정한 것」 태그를 쌍으로 지우며 이 칩도
 * 함께 나갔다** — 태그가 붙어 있던 근거였고, 태그가 없으면 칩만 남아도 무엇의
 * 근거인지 붙일 자리가 없다. 사실·제품 판단 두 문장(`fillOrderFactMessage`·
 * `fillOrderDecisionMessage`)은 그대로 남는다 — 소유자가 초기 회차에 물은
 * "왜 IRP를 먼저 채우나"에 답하는 것은 설명이지 배지가 아니다.
 */
function fillOrderNote(plan, scenario) {
  const tieBreak = fillOrderTieBreak(plan);
  if (!tieBreak) return null;
  const { flexible, restricted } = tieBreak;

  return el('div', { class: 'fill-order-note' }, [
    el('h4', { class: 'type-title-s' }, [FILL_ORDER_NOTE_HEADING]),
    el('p', { class: 'type-body-s' }, [fillOrderFactMessage(flexible, restricted)]),
    el('p', { class: 'type-body-s' }, [fillOrderDecisionMessage(flexible)]),
  ]);
}

/**
 * D45 5번(관리자, 2026-08-11) — 「최적 월 배분표」. 헌장(`docs/org/charter.md`
 * "쓸 수 있다"/조건부 표 "최적화")은 "계산 대상이 명시될 때만" 이 낱말을
 * 허용한다("납입 배분 최적화"는 되고 "세무 최적화"는 안 된다). 계산 대상(월
 * 배분)이 라벨 자체에 있어 그 절반은 항상 채워지지만, **"무엇에 대해
 * 최적인지"는 이 라벨 혼자 말하지 못한다** — 그래서 바로 아래 배분안 이름
 * 캡션(`donutPlanNameCaption`)이 그 기준을 진술하는 것을 조건으로 건다
 * (`tax-rules-report.md` 15.5절 "순위를 화면이 매기면 그것은 판단이다").
 *
 * **캡션이 사라지면 이 함수가 던진다.** 우연히 같은 화면에 있는 것이 아니라
 * 코드로 묶는다 — 누군가 나중에 `donut-section-header`를 고치며 캡션 줄을
 * 지우고 이 kicker만 남기면, 여기서 즉시 예외가 난다(테스트가 실제로 이
 * 실패를 재현해 확인한다, `ui/donut-optimal-kicker.test.mjs`).
 *
 * **이 한 자리에만 쓴다.** 다른 화면 요소·서비스 이름에 이 상수를 재사용하지
 * 않는다 — 조건은 자리마다 다시 판정되어야 한다.
 */
// [2026-08-23, D83 소유자 지시 4번] `labelText` 매개변수 — 계산기2 한정으로
// 「최적 월 배분표」를 「최적 월 배분」으로 바꿔 부른다(`CALC2_DONUT_OPTIMAL_KICKER_LABEL`).
// 가드(캡션 없이 못 쓴다)는 문구와 무관하게 그대로 지킨다 — D45 5번 조건은
// 어느 라벨을 쓰든 "무엇에 대해 최적인지" 캡션이 같은 화면에 있어야 한다는
// 뜻이라 라벨 문구 자체와는 별개다. 기본값은 첫 탭이 쓰는 원래 상수라
// 이 매개변수를 넘기지 않는 모든 호출(첫 탭)은 전과 동일하다.
export function donutOptimalKicker(planNameCaptionText, labelText = DONUT_OPTIMAL_KICKER_LABEL) {
  if (!planNameCaptionText) {
    throw new Error(
      'donutOptimalKicker: 배분안 이름 캡션(donutPlanNameCaption) 없이 "최적"을 표시할 수 없습니다 — D45 5번 조건 위반',
    );
  }
  return el('p', { class: 'donut-optimal-kicker type-caption' }, [labelText]);
}

function chartArea(plan, scenario, months, { seatDraw = 'donut', isaReturnAssumption = null, hideConditionalCopy = false } = {}) {
  const unallocated = plan.unallocated_annual_krw;
  const excluded = excludedAccounts(scenario);
  const donutArgs = {
    allocations: plan.allocations,
    unallocatedAnnualKrw: unallocated,
    unallocatedMonthlyKrw: plan.unallocated_monthly_krw,
    excludedAccounts: excluded,
  };
  // 자리에는 **도형이 하나만** 놓인다(`nextSeatStep`). 사라지는 링과 도넛이 같은
  // 프레임에 함께 있는 경로가 코드에 없다 — 있으면 12등분이 결과로 변형되는
  // 것처럼 보이고, 그러면 "자리표시자가 답이었다"는 인상이 남는다.
  const donut =
    seatDraw === 'placeholder-leaving'
      ? leavingPlaceholderRing()
      : donutChart({
          ...donutArgs,
          // 도넛 중앙의 `월 배분`은 **네 조각의 합**이다(engine-interface.md
          // 0.12·10절, 7.0.0) — 계좌 셋(`total_allocated_monthly_krw`)에
          // 미배분(`unallocated_monthly_krw`)을 더해야 도넛이 실제로 그리는
          // 네 조각의 합과 가운데 값이 같아진다. 계좌 셋만 쓰면(6.0.0까지의
          // 동작) 미배분 조각의 몫이 빠져, 100% 배분이 아닌 배분에서 가운데
          // 값이 조각들의 합과 어긋난다. `monthly_unassigned_krw`는 더하지
          // 않는다 — 그 값은 네 조각 중 어디에도 실리지 않은 몫이고, 그만큼
          // 이 값이 `monthly_capacity_krw`보다 작은 것이 사실이다(charts.js
          // 중앙 값 주석).
          totalAllocatedMonthlyKrw: plan.total_allocated_monthly_krw + plan.unallocated_monthly_krw,
          isProposed: !scenario.is_enacted,
          animateFromZero: seatDraw === 'donut-entering',
          // [2026-08-23, D82 소유자 지시 5번 — 계산기2 결과 도넛 한정, 판단
          // 근거] "지시선 제거 + 조각에 더 가까이"는 `labelled`/`labelledWide`
          // 모드(라벨을 좌우 세로 열에 쌓고 지시선으로 잇는 설계, `charts.js`
          // `donutLabelLayout`)의 구조 자체와 상충한다 — 그 모드는 라벨이
          // 조각 옆이 아니라 열 안 빈자리에 앉는 것이 설계의 핵심이라, 지시선을
          // 없애면 "이 라벨이 어느 조각 것인지" 자체가 모호해진다. `legend`
          // 모드는 애초에 조각마다 **자기 위치**(중심각)에 라벨을 두므로
          // "조각에 더 가깝다"는 요구와 구조가 이미 맞는다 — 계산기2는 뷰포트
          // 폭과 무관하게 이 모드로 고정한다(아래 `applyDonutSliceInlineLabels`
          // 호출의 `hideLeader`가 이 모드에서만 뜻이 있다, `ui/app.js`).
          labelMode: hideConditionalCopy ? 'legend' : undefined,
        });

  // D16 — 공통 배율. 납입 잔여 한도가 가장 큰 계좌의 트랙이 폭을 채우고 나머지는
  // 그 비율만큼 짧아진다(screens.md 5.4절). 세 계좌의 납입 잔여 한도를 먼저 다
  // 모아야 계좌별 트랙 하나를 그릴 때 "셋 중 최댓값"을 알 수 있다.
  //
  // 한도는 `limits.by_account`를 직접 읽지 않고 `accountLimitView`를 지난다 —
  // 배제된 계좌는 `remainingLimitKrw: null`로 와서 배율 계산에도, 캡션에도
  // 들어가지 않는다(4단계 관찰 O1).
  const limitViews = Object.fromEntries(CHART_ACCOUNT_ORDER.map((account) => [account, accountLimitView(scenario, account)]));
  const maxRemaining = Math.max(0, ...CHART_ACCOUNT_ORDER.map((account) => limitViews[account].remainingLimitKrw ?? 0));
  // 세액공제 인정 여지를 적을 자리 — 연금계좌 묶음의 마지막 행 하나뿐이다.
  const creditCaptionAccount =
    CHART_ACCOUNT_ORDER.filter((account) => PENSION_ACCOUNTS.includes(account) && !limitViews[account].excluded).pop() ?? null;

  const barSection = el(
    'div',
    { class: 'allocation-bars' },
    CHART_ACCOUNT_ORDER.map((account) => {
      const alloc = plan.allocations.find((a) => a.account === account);
      const view = limitViews[account];

      if (view.excluded) {
        return el('div', { class: 'allocation-bar-row' }, [
          el('div', { class: 'allocation-bar-labels' }, [
            el('span', { class: 'type-body-strong' }, [ACCOUNT_LABEL[account]]),
            el('span', { class: 'field-help' }, [EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER]),
          ]),
          allocationBar({
            account,
            monthlyKrw: null,
            remainingLimitKrw: null,
            percentOfLimit: 0,
            unavailable: true,
            unavailableLabel: EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER,
          }),
          eligibilityNote(view, scenario),
        ]);
      }

      const remaining = view.remainingLimitKrw;
      const percentOfLimit = remaining > 0 ? alloc.annual_krw / remaining : alloc.annual_krw > 0 ? 1 : 0;
      const trackScalePercent = computeTrackScalePercent(remaining, maxRemaining);
      const warning0 = plan.warnings.find((w) => w.account === account);
      // **소유자가 지목해 지운 경고**(`early_withdrawal_penalty_pension`,
      // 2026-08-13)는 `warningMessage()`가 `null`을 돌려준다 — 여기서 그
      // `null`을 문구 없는 빈 상자로 그리지 않고, 경고 자체가 없었던 것처럼
      // 아예 만들지 않는다. `warning.code`가 그대로 화면에 새는 것도 같은
      // 이유로 막는다(`copy.js`의 `warningMessage` 주석 참고).
      // [2026-08-23, D82 판정 1] `hideConditionalCopy`(계산기2 전용) — 자금
      // 사용 시점 미판정 정직성 문구("자금 사용 시점을 밝히지 않아 판정하지
      // 않았습니다 — …")는 D42 계열 장치로 첫 탭에는 그대로 남는다. 계산기2
      // 한정으로 이 트리거(`horizon_unknown`)일 때만 경고 자체를 만들지
      // 않는다 — 같은 계좌의 다른 트리거(`declared_horizon`) 경고는 건드리지
      // 않는다(그 경고는 "밝혔다"는 사실 위에 서 있어 이 지시와 무관하다).
      const warning = hideConditionalCopy && warning0?.trigger === 'horizon_unknown' ? null : warning0;
      const warningText = warning ? warningMessage(warning, scenario.fund_use_horizon_boundaries) : null;
      return el('div', { class: 'allocation-bar-row' }, [
        el('div', { class: 'allocation-bar-labels' }, [
          el('span', { class: 'type-body-strong' }, [ACCOUNT_LABEL[account]]),
          el('span', { class: 'type-num' }, [`${formatKrw(alloc.monthly_krw)} / 월`]),
        ]),
        allocationBar({ account, monthlyKrw: alloc.monthly_krw, remainingLimitKrw: remaining, percentOfLimit, trackScalePercent }),
        // 바닥값으로 트랙이 눌린 계좌라도 정확한 숫자는 항상 원 단위로 보인다 —
        // 배율이 "거짓말"하지 않게 하는 장치(D16 지시사항). **트랙은 납입 쪽
        // 한도만 쓴다**(screens.md 5.10절 (1)) — 세액공제 인정 여지는 넘을 수
        // 있는 값이라 트랙-채움 관계가 성립하지 않는다.
        el('p', { class: 'field-help' }, [contributionRemainingCaption(remaining, Math.min(1, percentOfLimit))]),
        // 배분액이 0인 계좌는 도넛에 조각이 없다(design-system 5.20절 비활성).
        // "그 계좌는 어디 갔나"에 답하는 자리가 여기다 — screens.md 5.4절이 정한 캡션.
        // **`12.0.0`·`13.0.0`(D52·D53)** — 이유가 자금 사용 시점이거나 IRP
        // 트림이면 이 행에서 바로 그 사실을 말한다. "미배분" 요약 행은 계좌
        // 전체가 남아야만 뜨므로, 다른 계좌가 그 몫을 흡수하면 이 행이 이유를
        // 말할 유일한 자리가 된다.
        alloc.annual_krw === 0 ? el('p', { class: 'field-help' }, [notAllocatedInPlanCaption(alloc.limited_by)]) : null,
        // 연금계좌 묶음의 세액공제 인정 여지는 **마지막 연금계좌 행에 한 번만**
        // 적는다(5.10절 (4)). 계좌마다 적으면 사용자가 둘을 더한다.
        account === creditCaptionAccount ? creditHeadroomBlock(scenario, plan) : null,
        // ISA 비과세 한도 (5.11절). 배제된 계좌는 위 분기에서 이미 빠졌고,
        // 유형 미확정이면 값이 null이라 줄 자체를 그리지 않는다.
        account === 'isa' ? isaTaxFreeBlock(scenario, view) : null,
        warningText ? el('div', { class: `warning-note warning-note-${warning.severity}` }, [el('p', {}, [warningText])]) : null,
      ]);
    }),
  );

  const singleSlice = donutSingleSliceAccount(plan, excluded);

  // D38 소유자 3번(screens.md 5.14.9절) — 도넛이 "무엇의" 배분인지 이름으로
  // 답한다. 이미 있는 배분안 이름 규약을 그대로 재사용한다 — 새 어휘를
  // 만들지 않는다. **[2026-08-11, D45 5번] 이 문자열이 이제 "최적"의 조건도
  // 함께 진다** — 한 번만 계산해 두 자리(캡션 자체 + 아래 kicker 가드)에
  // 같은 값을 준다. 여기서 비면 둘 다 그 사실을 반영한다.
  const planNameCaptionText = donutPlanNameCaption(plan.plan_id, plan.is_baseline);

  // [2026-08-23, D82 판정(불요, 소유자 지시 3·4번) — 계산기2 한정] 「월 납입
  // 여력…나눕니다」 제목과 「…기본」 배분안 이름 캡션을 뺀다. 「최적 월
  // 배분표」(kicker)를 그 자리(결과 영역 최상단)로 올리고, 아이콘도 함께
  // 옮겨 주황으로 칠한다.
  //
  // **flag — D45 5번(헌장) 긴장.** `donutOptimalKicker`의 가드는 "「최적」은
  // 무엇에 대해 최적인지 말하는 캡션이 **같은 화면에 실제로 보일 때만**
  // 쓴다"는 조건을 지킨다(그 문서 머리말). 이 계산기2 분기는 가드 함수
  // 자체(`planNameCaptionText`가 비어 있으면 여전히 던진다)는 그대로 지키지만,
  // **그 캡션 문단 자체를 화면에서 지운다** — 소유자 지시 3번을 그대로
  // 따른 결과다. tax-domain이 이 항목을 판정 대상으로 올리지 않았으므로
  // (D82 게이트 기록 — 판정 1~4에 이 자리는 없다) 문면 그대로 구현했지만,
  // "무엇에 대해 최적인지"가 계산기2 화면 어디에도 문장으로 남지 않는다는
  // 점은 최종 보고에 열린 물음으로 올린다.
  const calc2DonutHeader = el('div', { class: 'donut-section-header donut-section-header-calc2' }, [
    el('div', { class: 'donut-section-header-title-row' }, [
      iconChart(),
      donutOptimalKicker(planNameCaptionText, CALC2_DONUT_OPTIMAL_KICKER_LABEL),
    ]),
  ]);
  const defaultDonutHeader = el('div', { class: 'donut-section-header' }, [
    // D45 5번 — 「최적」은 이 한 자리에만 쓴다. 조건(무엇에 대해 최적인지)은
    // 바로 아래 배분안 이름 캡션이 진다 — `donutOptimalKicker`가 그 캡션
    // 없이는 이 요소를 만들지 않는다(가드가 실제로 문다는 것은
    // `ui/donut-optimal-kicker.test.mjs`가 확인한다).
    donutOptimalKicker(planNameCaptionText),
    // [2026-08-17, 관리자 지시(2차) 9번] 「결과」 섹션 아이콘(도넛/파이 모양,
    // `icons.js`의 `iconChart`) — 제목 줄 앞에 붙인다. 도넛 중앙과 같은
    // 산식(`total_allocated_monthly_krw + unallocated_monthly_krw`
    // = `echo.monthly_capacity_krw`) — 네 조각의 합과 같은 값을 되비춘다.
    el('div', { class: 'donut-section-header-title-row' }, [
      iconChart(),
      el('p', { class: 'type-title-m' }, [donutSectionTitle(plan.total_allocated_monthly_krw + plan.unallocated_monthly_krw)]),
    ]),
    el('p', { class: 'type-body-s donut-plan-name' }, [planNameCaptionText]),
  ]);

  return el('div', { class: 'chart-area' }, [
    hideConditionalCopy ? calc2DonutHeader : defaultDonutHeader,
    el('div', { class: 'donut-with-strip' }, [
      el('div', { class: 'donut-wrap' }, [donut]),
      // 모바일 전용 — 라벨이 겹치는 폭에서 SVG 라벨 대신 이 리스트가 값을 낸다.
      // CSS 미디어쿼리가 둘 중 하나만 보이게 한다(둘 다 그려 두고 폭으로 고른다).
      donutLegend(donutArgs),
      // `[4-C']` — 도넛 카드의 자식이지 넷째 층이 아니다(screens.md 5.14절:
      // "C-1→C-2→C-3 사이에 넷째 층을 꽂지 않는다"). 도넛 바로 아래, 우측
      // 정렬, 절반 크기.
      accountBenefitStrip(scenario, plan, isaReturnAssumption, hideConditionalCopy),
    ]),
    singleSlice ? el('p', { class: 'field-help chart-note' }, [donutSingleSliceCaption(singleSlice)]) : null,
    // 12.2(c) — 같은 사실을 더 짧게.
    el('p', { class: 'field-help chart-note' }, ['납입 잔여 한도 대비']),
    barSection,
  ]);
}

/** 조각이 하나뿐이면 그 계좌 id, 아니면 null (screens.md 5.12절 캡션 조건). */
function donutSingleSliceAccount(plan, excluded) {
  if (plan.unallocated_annual_krw > 0) return null;
  const drawn = plan.allocations.filter((a) => !excluded.includes(a.account) && a.annual_krw > 0);
  return drawn.length === 1 ? drawn[0].account : null;
}

/**
 * 세액공제 인정 여지 — **배분액이 이 여지를 넘을 때만** 그린다.
 *
 * 소유자가 잡은 문제: 이 여지(`pension_combined_credit_remaining_krw`)는
 * `scenario.limits`의 **배분 전** 값이라 어느 배분안을 보든 같다. 넘지 않는
 * 보통의 경우 이 값을 배분 결과 옆에 그대로 적으면, 배분이 여지를 정확히 다
 * 채운 흔한 경우(예: 월 80만원 예시의 연금 배분 900만원)에 "더 인정될 수 있는
 * 금액 900만원"이 나란히 서서 이미 다 쓴 한도를 아직 남은 것처럼 읽힌다. 틀이
 * 어긋난 것이지 숫자가 틀린 게 아니었다(`copy.js` `creditHeadroomExceededMessage`
 * 주석).
 *
 * 이 값이 여전히 필요한 자리는 배분액이 여지를 **넘는** 예외뿐이다(계약
 * 5.3절 — 상한이 아니므로 넘을 수 있다). 그때는 크기와 이유를 한 문장에 담아
 * 적는다(5.10절 (3)). 넘는 현상은 개정안 시나리오에서만 나타나므로 그때
 * `ProposedBadge`가 붙는다.
 *
 * D46 2·3번(관리자 판정) — 근거 조항(`LawChip`)을 뗐다. 배지는 남는다 —
 * "개정안에서만 나타나는 현상"이라는 사실은 조항 표기가 아니라 시나리오
 * 구분 표시다.
 */
function creditHeadroomBlock(scenario, plan) {
  const view = pensionCreditHeadroomView(scenario, plan);
  if (!view.exceeded) return null;
  return el('div', { class: 'headroom-note' }, [
    el('p', { class: 'type-body-s' }, [creditHeadroomExceededMessage(view.remainingKrw)]),
    !scenario.is_enacted ? el('p', { class: 'note-laws' }, [el('span', { class: 'proposed-badge' }, [PROPOSED_BADGE_LABEL])]) : null,
  ]);
}

/**
 * ISA 비과세 한도 — 한도이지 절감액이 아니다. 헤드라인 절세액에 더하지 않는다.
 *
 * **12.2(a) — 전문은 `[4-D]` 표에만 남긴다.** 이 자리(C-2)는 짧은 문구로
 * 줄인다 — 같은 문장이 글자 그대로 두 번 있던 자리였다. `LawChip`도 함께
 * 뗀다(D46 2·3번 이후로는 `[4-D]`도 조항을 내지 않는다 — 근거는 룰셋의
 * `source`에 그대로 있다).
 */
function isaTaxFreeBlock(scenario, view) {
  if (view.taxFreeLimitKrw === null) return null;
  return el('div', { class: 'headroom-note' }, [el('p', { class: 'type-body-s' }, [ISA_TAX_FREE_SHORT_CAPTION])]);
}

/**
 * `AccountBenefitStrip` — design-system 5.31.3절 · screens.md 5.14.8절(D36).
 * 도넛 카드 내용 폭 그대로(100%), `surface-overlay` 컨테이너(D35) 안에서 두
 * 축을 물리적으로 가른다 — **확정 축**(연금저축·IRP 세액공제, 올해)과
 * **가정 축**(ISA 비과세·저율분리과세·손익통산, 사용자가 준 수익률 위의
 * 추정)은 서로 다른 저울이다. 하나의 자에 올리면 확정 세액과 가정 위의
 * 추정치가 길이로 직접 비교되고, 그것은 룰셋이 금지한 "같은 저울"을 형태로
 * 실행하는 것이 된다(D36). 맨 아래 연금저축·IRP 참고 구역은 축도 등급도
 * 없다 — 잴 금액 자체가 없기 때문이다(계약 5.16절).
 *
 * **새 데이터를 만들지 않는다.** `accountBenefitRows`·`scenario.pension_credit_
 * ceiling`·`plan.assumption_based_isa_estimate`·`scenario.pension_withdrawal_
 * tax_reference`가 계약이 이미 낸 값만 고르고, 이 함수는 그것을 그리기만 한다.
 */
/**
 * [2026-08-21, D80 이후 회차] `hideConditionalCopy`(계산기2 전용) — 부연설명
 * (`benefit-strip-ref-caption`)과 「연금저축·IRP를 나중에 받을 때」(과세이연
 * 축, `pensionReferenceSection`)를 뺀다. `resultKey === 'calc2'`일 때만
 * `true`(`renderResultPanel` 참고) — 첫 탭·역산기는 인자 없이 불러 그대로다.
 */
function accountBenefitStrip(scenario, plan, isaReturnAssumption = null, hideConditionalCopy = false) {
  const rows = accountBenefitRows(scenario, plan);

  return el('div', { class: 'account-benefit-strip' }, [
    // D38 재개정 — D33이 낮춘 17px를 16px로 되돌린 것이 진짜 결손이 아니었다
    // (design-system 5.31.4절 "실측으로 찾은 진짜 결손"). 17px/600으로
    // 되돌린다(`.account-benefit-strip h4`, styles.css). `<h4>`는 스크린리더
    // 랜드마크로 유지한다.
    el('h4', {}, [ACCOUNT_BENEFIT_STRIP_TITLE]),
    hideConditionalCopy ? null : el('p', { class: 'benefit-strip-ref-caption' }, [ACCOUNT_BENEFIT_STRIP_REF_CAPTION]),
    confirmedAxisSection(scenario, plan, rows.pension),
    el('hr', { class: 'benefit-axis-divider' }),
    assumptionAxisSection(rows.isa, isaReturnAssumption),
    hideConditionalCopy ? null : pensionReferenceSection(scenario),
  ]);
}

/**
 * 확정 축(D36) — 연금저축·IRP 세액공제 하나뿐이다. 최댓값은
 * `pension_credit_ceiling.ceiling_krw`(소득세분+지방소득세분, 계약 5.15절) —
 * **소득세분만 쓰지 않는다**, 그러면 한도를 채운 사람의 막대가 트랙 밖으로
 * 나간다(D37 — 소유자의 148.5만원 예시가 이 결함을 잡았다).
 */
function confirmedAxisSection(scenario, plan, p) {
  const onClick = () => scrollAndHighlight(`account-row-${p.accounts[0]}`);
  const dots = p.accounts.map((a) =>
    el('span', { class: 'benefit-dot', style: { background: `var(--data-${a === 'annuity_savings' ? 'pension' : 'irp'})` } }),
  );
  const names = p.accounts.map((a) => ACCOUNT_LABEL[a]).join(' · ');

  if (p.state === 'excluded') {
    return el('div', { class: 'benefit-axis benefit-axis-confirmed' }, [
      el('button', { type: 'button', class: 'benefit-row', onclick: onClick }, [
        el('span', { class: 'benefit-row-dots' }, dots.length ? dots : [el('span', { class: 'benefit-dot' })]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names' }, [names]),
          el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_EXCLUDED_LABEL]),
        ]),
      ]),
    ]);
  }

  const ceiling = scenario.pension_credit_ceiling;
  // pooled — 세액 한도 상태와 동기화한다(D39 전면 개정 — 정상 → 그대로 /
  // 잘림 → 축약 문구, 전부 잘려 0원인 극단은 차이 없음 문구).
  const view = taxCreditHeadlineView(plan);
  // D38 재개정(design-system 5.31.4절) — 한 줄로 합친다. 위쪽 별도 캡션은 없앤다.
  // **여기서만 전체 자릿수를 쓴다**(`formatKrw`) — 연말정산 서류의 숫자와
  // 그대로 대조할 수 있어야 한다(D37 1번). **「최대」 접두를 붙이지 않는다**
  // (D41) — 세액 한도 축에서는 방향을 주장하지 않는다.
  const actualAmountText = formatKrw(view.totalKrw);
  const isReduced = view.mode === HEADLINE_MODE.REDUCED;
  const isZeroCredit = isReduced && view.totalKrw === 0;
  const zeroNote = isZeroCredit ? ACCOUNT_BENEFIT_ZERO_DIFFERENCE_NOTE : null;
  const reducedNote = isReduced && !isZeroCredit ? ACCOUNT_BENEFIT_REDUCED_NOTE : null;
  // D37 2번, D40으로 게이트 갱신, D46 1번·D49로 다시 갱신 — 짧은 막대의 이유.
  // 「덜 넣어서」가 아니라 「낼 세금이 적어서」다. **화면이 판단하지 않는다** —
  // 게이트 판정은 `tax-credit-view.js`의 `showsCapBelowCeilingNote`가 진다
  // (`binding_code === 'binds_provably'` 그리고 `reduced_total_krw > 0`, 계약
  // 5.5절). `binds_provably`가 아니면(자르지 않았거나 방향이 미정이면) 이
  // 문장을 쓰지 않는다(D40) — **11.0.0부터는 그것만으로도 부족하다**(D46 1번·
  // D49): 잘린 양이 1원에 못 미치면 `applied: true`(그래서 `binds_provably`)
  // 인데 표시 금액은 한 원도 줄지 않는 좌표가 실재하고, 이 문장은 눈에 보이는
  // 짧음에 대한 진술이라 아무것도 짧아지지 않았는데 왜 짧은지 설명하면 사용자가
  // 없는 것을 찾는다.
  const capBelowNote = showsCapBelowCeilingNote(plan) ? ACCOUNT_BENEFIT_CAP_BELOW_CEILING_NOTE : null;

  // 확정(solid) 등급 — 트랙 = 축의 끝(`ceiling.ceiling_krw`), 채움 = 실제
  // 세액공제액(한도 적용 후). `is_axis_degenerate`(축의 끝이 0)면 나눗셈이
  // 성립하지 않으므로 막대를 그리지 않는다(계약 5.15절).
  const fillPercent =
    ceiling && !ceiling.is_axis_degenerate
      ? Math.min(100, Math.max(0, ((p.afterCapKrw ?? 0) / ceiling.ceiling_krw) * 100))
      : null;
  const meter = fillPercent != null ? benefitMeter({ account: p.accounts[0], fillPercent }) : null;
  // D38 재개정 — 「최대 X 중 Y」 한 줄이 이 행에서 유일한 "행 = 소구획 전체"
  // 자리다. 판정 기준 문장(basis_code)은 그 아래 별도 줄로 둔다.
  const sentence = ceiling ? confirmedAxisAmountSentence(ceiling, actualAmountText) : actualAmountText;
  const basisSentence = ceiling ? confirmedAxisBasisSentence(ceiling) : null;
  const ariaLabel = `${names}, ${sentence}`;

  const row = el('button', { type: 'button', class: 'benefit-row', onclick: onClick, 'aria-label': ariaLabel }, [
    el('span', { class: 'benefit-row-dots' }, dots),
    el('span', { class: 'benefit-row-body' }, [
      el('span', { class: 'benefit-row-names' }, [names]),
      p.accounts.length > 1 ? el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_POOLED_NOTE]) : null,
      meter,
      el('span', { class: 'benefit-row-amount' }, [sentence]),
      basisSentence ? el('span', { class: 'benefit-row-subnote' }, [basisSentence]) : null,
      zeroNote ? el('span', { class: 'benefit-row-subnote' }, [zeroNote]) : null,
      reducedNote ? el('span', { class: 'benefit-row-subnote' }, [reducedNote]) : null,
      capBelowNote ? el('span', { class: 'benefit-row-subnote' }, [capBelowNote]) : null,
    ]),
  ]);

  return el('div', { class: 'benefit-axis benefit-axis-confirmed' }, [row]);
}

/**
 * 가정 축(D36 → D38 재개정 → D43 재개정) — ISA 비과세·저율분리과세·손익통산(보조
 * 행) 셋. **세법 재판정(관리자 메시지, 커밋 `13c42e4`)으로 행 구조가 비대칭이
 * 됐다** — 법정 상한이 있는 축은 비과세뿐이라, 막대를 갖는 행도 이제 하나뿐이다
 * (design-system 5.31.4절). 나머지 둘(저율분리·손익통산)은 숫자 +
 * `법정 상한 없음`만 낸다 — 상한 없는 값에 막대를 그리면 분모를 지어내는
 * 것이다. 가정 자체가 없거나 계산하지 못했으면(narrative) 축 캡션 없이
 * 서술만 남는다 — 잴 값 자체가 없다.
 * **[2026-08-11, D43] 막대는 이제 채움(solid)이다** — 빗금이 아니다.
 * 확정/가정 구분은 이 절 상단의 조건절(`assumptionAxisCaption`)과 아래
 * 비과세 행의 정산 기간이 진다(design-system 5.31.6절).
 */
function assumptionAxisSection(i, isaReturnAssumption) {
  const onClick = () => scrollAndHighlight('account-row-isa');
  const dot = el('span', { class: 'benefit-dot', style: { background: 'var(--data-isa)' } });

  if (i.state === 'excluded') {
    return el('div', { class: 'benefit-axis benefit-axis-assumption' }, [
      el('button', { type: 'button', class: 'benefit-row', onclick: onClick }, [
        el('span', { class: 'benefit-row-dots' }, [el('span', { class: 'benefit-dot benefit-dot-excluded' })]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names' }, [ACCOUNT_LABEL.isa]),
          el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_EXCLUDED_LABEL]),
        ]),
      ]),
    ]);
  }

  const est = i.estimate;
  // 5.1.0(D28·D29·D31) — 가정 기반 정산액이 **계산되어 있을 때만** 세 행으로
  // 그린다. 그 외(가정 자체가 없음 / 계산 못 함 / 표시 끔)는 여전히
  // narrative다 — ISA는 계약상 `DeterministicBenefit`을 갖지 않는다.
  if (est?.state === 'computed') {
    // D38 재개정 — 머리글은 기간·조건절만 말한다. 공통 최댓값 개념이
    // 성립하지 않으므로(둘은 법정 상한이 없다) 그 아래 한 번만 이유를 적는다.
    const axisCaption = assumptionAxisCaption({ estimate: est, annualReturnRate: isaReturnAssumption?.annual_return_rate ?? null });
    const breakdown = est.axis_breakdown;
    const ceiling = est.axis_ceilings;
    const taxFreeDenom = ceiling?.tax_free_krw > 0 ? ceiling.tax_free_krw : 0;
    const taxFreeFill = taxFreeDenom > 0 ? Math.min(100, Math.max(0, (breakdown.tax_free_krw / taxFreeDenom) * 100)) : 0;

    // D36 — 0인 것은 「혜택 없음」이 아니다. 판정은 오직 이 필드로 한다
    // (`rate_gap_krw === 0`으로 화면이 스스로 판정하지 않는다, 계약 5.14절).
    const rateGapFavorableZero = est.rate_gap_axis_zero_reason_code === 'within_tax_free_limit';
    const rateGapAmountText = rateGapFavorableZero ? '0원' : boundedAxisAmountText(breakdown.rate_gap_krw, est.axis_breakdown_bound_code);
    const residualKrw = breakdown.loss_offset_krw + breakdown.rounding_residual_krw;
    const residualAmountText = boundedAxisAmountText(residualKrw, est.axis_breakdown_bound_code);

    // 12.2(b) — 수익률·정산 기간은 뺐다. 바로 위 가정 축 캡션이 이미 말한다.
    const assumptionCaption = isaReturnAssumption
      ? isaReturnAssumptionCaption({
          incomeCharacter: isaReturnAssumption.income_character,
          settlementYearsSource: est.settlement_years_source,
        })
      : null;

    // 행 1 — ISA 비과세로 아낀 금액. 이 위젯에서 유일하게 막대(D43 — 채움)를
    // 갖는 가정 축 행이다. 「최대 X 중 Y」 형태이고 기간이 문장 맨 앞이다.
    const taxFreeSentence = ceiling ? isaTaxFreeCeilingSentence(est) : boundedAxisAmountText(breakdown.tax_free_krw, est.axis_breakdown_bound_code);
    const taxFreeRow = el(
      'button',
      {
        type: 'button',
        class: 'benefit-row',
        onclick: onClick,
        'aria-label': `${ACCOUNT_LABEL.isa}, ${ACCOUNT_BENEFIT_ISA_TAX_FREE_LABEL}, ${taxFreeSentence}`,
      },
      [
        el('span', { class: 'benefit-row-dots' }, [dot]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names' }, [ACCOUNT_BENEFIT_ISA_TAX_FREE_LABEL]),
          // **「가정 기반」 칩을 지웠다**(D39 #2, design-system 5.31.5절).
          // **[2026-08-11, D43] 빗금 → 채움.** 소유자가 "ISA 막대 안이 비어
          // 있다"를 두 번째로 신고했고, 확정/가정 구분은 이제 이 막대가
          // 아니라 가정 축 제목의 조건절과 이 행의 정산 기간(아래 문장 맨
          // 앞)이 진다 — `benefitMeter`는 더 이상 등급별로 모양을 가르지
          // 않는다(design-system 5.31.6절).
          benefitMeter({ account: 'isa', fillPercent: taxFreeFill }),
          el('span', { class: 'benefit-row-amount' }, [taxFreeSentence]),
        ]),
      ],
    );

    // 행 2 — ISA 저율 분리과세로 아낀 금액. **법정 상한이 없다**(D38 6번·7번,
    // 세법 재판정) — 막대를 그리지 않는다. 값만 + `법정 상한 없음`.
    const rateGapRow = el(
      'button',
      {
        type: 'button',
        class: `benefit-row${rateGapFavorableZero ? ' benefit-row-favorable-zero' : ''}`,
        onclick: onClick,
        'aria-label': `${ACCOUNT_LABEL.isa}, ${ACCOUNT_BENEFIT_ISA_RATE_GAP_LABEL}, ${rateGapFavorableZero ? ACCOUNT_BENEFIT_RATE_GAP_FAVORABLE_ZERO_NOTE : rateGapAmountText}`,
      },
      [
        el('span', { class: 'benefit-row-dots' }, [dot]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names' }, [ACCOUNT_BENEFIT_ISA_RATE_GAP_LABEL]),
          // 「가정 기반」 칩을 지웠다(D39 #2) — 이 칩은 `favorable_zero` 정보 칩과는
          // 다른 것이었다. `favorable_zero`는 그대로 남는다.
          rateGapFavorableZero ? el('span', { class: 'benefit-row-info-chip' }, [ACCOUNT_BENEFIT_FAVORABLE_ZERO_CHIP_LABEL]) : null,
          rateGapFavorableZero
            ? el('span', { class: 'benefit-row-amount' }, [rateGapAmountText])
            : el('span', { class: 'benefit-row-amount' }, [`${rateGapAmountText} · ${ACCOUNT_BENEFIT_NO_STATUTORY_CEILING_SUFFIX}`]),
          rateGapFavorableZero ? el('span', { class: 'benefit-row-subnote' }, [ACCOUNT_BENEFIT_RATE_GAP_FAVORABLE_ZERO_NOTE]) : null,
        ]),
      ],
    );

    // 행 3 — 보조 행(손익통산·절사 잔차). 지우면 "넷의 합이 upper_bound_krw와
    // 같다"는 항등식이 깨지므로 지우지 않되, 소유자가 요청한 둘과 같은
    // 무게로 두지 않는다(design-system 5.31.3절). 막대는 없다 — 상단의 공통
    // 안내 한 줄이 이미 이 행도 포괄하므로 「법정 상한 없음」을 반복하지 않는다.
    const residualRow = el(
      'button',
      {
        type: 'button',
        class: 'benefit-row benefit-row-secondary',
        onclick: onClick,
        'aria-label': `${ACCOUNT_LABEL.isa}, ${ACCOUNT_BENEFIT_ISA_RESIDUAL_LABEL}, ${residualAmountText}`,
      },
      [
        el('span', { class: 'benefit-row-dots' }, [dot]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names type-caption' }, [ACCOUNT_BENEFIT_ISA_RESIDUAL_LABEL]),
          el('span', { class: 'benefit-row-amount' }, [residualAmountText]),
        ]),
      ],
    );

    return el('div', { class: 'benefit-axis benefit-axis-assumption' }, [
      // D38 재개정 — 조건절만(기간 + 「수익률이 연 ○%라면」). 그 아래 상한이
      // 갈리는 이유를 한 번만 밝힌다(행마다 반복하지 않는다).
      el('p', { class: 'benefit-axis-caption' }, [axisCaption]),
      el('p', { class: 'benefit-axis-caption-note' }, [ASSUMPTION_AXIS_CEILING_EXPLAINER]),
      taxFreeRow,
      rateGapRow,
      residualRow,
      assumptionCaption ? el('p', { class: 'benefit-row-assumption-caption' }, [assumptionCaption]) : null,
    ]);
  }

  // narrative — 정산액을 아직 낼 수 없다. **금액을 쓰지 않는다** — ISA는
  // 세액공제 대상이 아닐 뿐 혜택이 없는 것이 아니다(tax-rules-report.md
  // 15.4.5절). 축 캡션이 없다 — 잴 값 자체가 없다.
  const subNote =
    est?.state === 'not_computable'
      ? ISA_RETURN_NOT_COMPUTABLE_NOTE
      : est?.state === 'display_suppressed'
        ? ISA_RETURN_SUPPRESSED_NOTE
        : null;
  return el('div', { class: 'benefit-axis benefit-axis-assumption' }, [
    el('button', { type: 'button', class: 'benefit-row', onclick: onClick }, [
      el('span', { class: 'benefit-row-dots' }, [dot]),
      el('span', { class: 'benefit-row-body' }, [
        el('span', { class: 'benefit-row-names' }, [ACCOUNT_LABEL.isa]),
        el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_ISA_NARRATIVE]),
        // **표시를 끈 상태를 조용한 빈칸으로 두지 않는다**(D19) — 왜 안 보이는지 말한다.
        subNote ? el('span', { class: 'benefit-row-subnote' }, [subNote]) : null,
      ]),
    ]),
  ]);
}

/**
 * 연금저축·IRP를 나중에 받을 때 — 참고 구역(D36, 계약 5.16절). 축도 등급도
 * 없다. `principal_retaxed_on_withdrawal`의 고정 문장이 표보다 먼저 온다 —
 * 이 문장이 곧 이 표가 "세제 혜택 요약" 안에 있는 이유다. **일곱 행 전부를
 * 보인다**(D37 3번) — 넷만 보이면 표의 모든 행에 확정된 부호가 붙어 있어
 * "그럼 계산되잖아"로 읽히고, 못 낸다고 판정한 바로 그 사실이 화면에서
 * 사라진다. 기본 접힘은 허용된다(D25) — 접는 것과 자르는 것은 다르다.
 *
 * **D46 2·3번(관리자 판정) — 표 밑의 `LawChip` 행을 뗀다. 표 안의 세율차·부호는
 * 남긴다.** 이 표가 "조문 그대로"인 것은 값의 출처가 조문이라는 뜻이지, 조항
 * 번호가 화면에 인쇄돼야 한다는 뜻이 아니다(D36 판정문: "세율표(새 입력
 * 0개·가정 0개, 조문 그대로)"라고 말한 것은 **엔진이 값을 지어내지 않고
 * 조문에서 그대로 가져온다**는 산출 방식이지 화면의 조항 표기 여부가 아니다).
 * 값 자체(세율차 %p·부호)는 계속 낸다 — 그건 조항 인용이 아니라 이 표의
 * 본문이다. 근거는 룰셋의 `source`에 그대로 있고 검증기가 계속 검사한다.
 *
 * **D59(관리자 판정)로 재확인됐다.** 이 표는 (a) 나열형 조항 표기에 가깝다고
 * 판정했다 — 표의 뜻(조문 그대로)이 깨지지 않았으므로 조항 번호 열만 뺀 이
 * 처리를 그대로 유지한다.
 */
function pensionReferenceSection(scenario) {
  const ref = scenario.pension_withdrawal_tax_reference;
  if (!ref) return null;

  const rows = ref.rate_gap_cases.map((c) =>
    el('tr', {}, [
      el('td', {}, [pensionIncomeCharacterLabel(c.income_character_code)]),
      el('td', {}, [pensionWithdrawalBranchLabel(c.withdrawal_branch_code)]),
      el('td', {}, [`${pensionRateGapRangeText(c)} (${pensionGapSignLabel(c.sign_code)})`]),
    ]),
  );

  return el('details', { class: 'benefit-reference' }, [
    el('summary', { class: 'benefit-reference-summary' }, [
      el('span', { class: 'block-summary-chevron', 'aria-hidden': 'true' }, ['▸']),
      PENSION_REFERENCE_SUMMARY_LABEL,
    ]),
    el('div', { class: 'benefit-reference-body' }, [
      // 12.2(a) — <summary>(PENSION_REFERENCE_SUMMARY_LABEL)와 같은 뜻이던
      // <h5>(PENSION_REFERENCE_TITLE)를 지웠다. 트리거 한 줄로 충분하다.
      // 고정 문장이 표보다 먼저 — 이것이 곧 표가 이 위젯 안에 있는 이유다.
      el('p', { class: 'type-body-s' }, [PENSION_REFERENCE_RETAX_SENTENCE]),
      // **`0원`으로 적지 않는다** — 계산했더니 0인 것과 계산 자체를 못 하는 것은 다른 사실이다.
      el('p', { class: 'type-body-s' }, [PENSION_REFERENCE_NOT_COMPUTABLE_SENTENCE]),
      el('table', { class: 'benefit-reference-table' }, [
        el('thead', {}, [el('tr', {}, PENSION_REFERENCE_TABLE_HEADERS.map((h) => el('th', {}, [h])))]),
        el('tbody', {}, rows),
      ]),
    ]),
  ]);
}

function stackBarComparison(scenario, activePlanId, onSelect) {
  const budget = scenario.plans[0]?.total_allocated_annual_krw + scenario.plans[0]?.unallocated_annual_krw || 1;
  const excluded = excludedAccounts(scenario);
  // 배제는 배분안마다 달라지지 않고 시나리오 전체에 걸린다 — 행마다 반복하면
  // 소음이므로 영역 위 한 줄로 세 행 모두에 적용된다는 것을 보인다(5.9절).
  const excludedLine = excluded.length ? el('p', { class: 'field-help' }, [excludedFromComparisonMessage(excluded)]) : null;
  // 배분안이 하나면 **스택바를 그리지 않고 그 자리에 한 줄 캡션만** 둔다
  // (screens.md 4.4절). 도넛과 한도 트랙 막대는 그대로 남는다 — 자리가 통째로
  // 사라지면 실시간 갱신 중에 화면이 뛴다.
  //
  // 계약 0.4절의 동점 순서가 들어오면서 `max_tax_credit`과
  // `annuity_savings_first`가 같은 배분이 되어 합쳐지는 경우가 늘었다. 즉 이
  // 분기는 이제 드문 경로가 아니다.
  if (scenario.plans.length < 2) {
    return el('div', { class: 'stackbar stackbar-single' }, [
      // 문장을 여기 따로 적지 않는다. 같은 사실을 말하는 문구가 사전에 이미
      // 있고(`plans_collapsed_single`), 두 곳에 적으면 한쪽만 고쳐진다.
      el('p', { class: 'field-help' }, [comparisonNoteMessage('plans_collapsed_single')]),
      // **배제 안내는 여기서 내지 않는다.** 그 문장은 "아래 비교에 나타나지
      // 않습니다"라고 말하는데, 비교 자체가 없으면 가리킬 대상이 없다. 배제된
      // 계좌의 사정은 C-2 캡션과 `[4-D]` 표가 그대로 말한다(screens.md 5.9절).
    ]);
  }
  const rows = scenario.plans.map((plan) => {
    const selected = plan.plan_id === activePlanId;
    return el(
      'button',
      {
        type: 'button',
        class: `stackbar-row${selected ? ' stackbar-row-selected' : ''}`,
        onclick: () => onSelect(plan.plan_id),
      },
      [
        el('span', { class: 'stackbar-row-marker' }, [selected ? '▸' : '']),
        el('span', { class: 'stackbar-row-label' }, [plan.is_baseline ? `${PLAN_LABEL[plan.plan_id]} (기본)` : PLAN_LABEL[plan.plan_id]]),
        stackBarSegments({
          allocations: plan.allocations,
          unallocatedAnnualKrw: plan.unallocated_annual_krw,
          totalBudgetKrw: budget,
          excludedAccounts: excluded,
        }),
        el('span', { class: 'type-num stackbar-row-amount' }, [formatPlanRowAmount(plan)]),
      ],
    );
  });
  // 금액 열 위의 한 줄들 — 4.8절이 요구하는 사실 둘.
  //  (1) 한도가 0으로 확정되면 **세액공제액으로는 배분안이 갈리지 않는다**.
  //      순위를 절세액 순으로 설명하면 없는 근거를 말하게 된다(계약 10절).
  //  (2) 잘림은 배분안마다 다를 수 있으므로 비교가 잘린 뒤 값으로 이뤄진다는
  //      사실을 적는다 — 없으면 "왜 공제 한도를 더 채운 안이 더 낫지 않지"에서 막힌다.
  // **9.0.0(D39)로 셋째 사실(STACKBAR_BOUNDED_NOTE)이 없어졌다** — "모름" 상태가
  // 없어져 한쪽만 상한 표기인 경우 자체가 성립하지 않는다. `[4-B]` 헤드라인이
  // 이제 언제나 같은 캡션(`TAX_CAP_ESTIMATE_NOTE`)을 달고 있으므로 중복도 없다.
  const axisFlat = scenario.comparison_note_codes.includes('tax_credit_axis_not_discriminating');
  const capApplied = anyPlanCapApplied(scenario);

  return el('div', { class: 'stackbar' }, [
    el('h3', { class: 'type-title-m' }, ['다른 배분 비교']),
    excludedLine,
    axisFlat ? el('p', { class: 'field-help' }, [comparisonNoteMessage('tax_credit_axis_not_discriminating')]) : null,
    !axisFlat && capApplied ? el('p', { class: 'field-help' }, [STACKBAR_CAP_APPLIED_NOTE]) : null,
    ...rows,
    el('p', { class: 'field-help' }, ['▸ 표시가 지금 그려진 배분입니다. 행을 누르면 도넛·막대가 바뀝니다.']),
  ]);
}

/**
 * D46 2·3번(관리자 판정) — 「적용 조항」 열을 표에서 뗐다. 배분된(정상) 행의
 * 개별 적용 조항 표시는 소유자가 "칸마다 세법 항을 나열한다"고 지목한 바로
 * 그 형태였다. 열이 넷으로 줄어 `colspan`도 5 → 4로 함께 줄었다.
 *
 * **D59(관리자 판정) — 배제된 행에는 근거를 되돌린다.** `tax-domain`이 재서
 * "정상 행마다 붙는 조항 나열"과 "배제 사유의 근거"를 구분했다 — 후자는
 * `screens.md` 8.4(b)가 필수로 못박은 자리다. 열로는 되돌리지 않는다(정상
 * 행에는 빈 칸이 되어 표 구조가 다시 비대칭이 아니게 유지된다) — 대신 사유
 * 문장이 있는 아래 줄에 `LawChip`을 짝지어 붙인다(`eligibilityNote`와 같은
 * 패턴, design-system 5.24절).
 */
function accountTable(plan, scenario) {
  const rows = [];
  // 세액공제 인정 여지의 보조 줄은 연금계좌 묶음 아래 **한 번만** 붙는다(5.10절 (4)).
  const lastPensionAccount = plan.allocations
    .map((a) => a.account)
    .filter((account) => PENSION_ACCOUNTS.includes(account) && !accountLimitView(scenario, account).excluded)
    .pop();

  for (const a of plan.allocations) {
    const view = accountLimitView(scenario, a.account);

    // 배제된 계좌 — 금액 칸을 비우고(0원도 쓰지 않는다: 배분하지 않았다는 뜻이
    // 아니라 배분 대상이 아니라는 뜻이다) 바로 아래 줄에 사유를 붙인다. 납입
    // 잔여 한도 대비 비율도 한도에서 나온 값이므로 표시하지 않는다.
    if (view.excluded) {
      rows.push(
        // id — `AccountBenefitStrip`의 행을 눌렀을 때 스크롤 + 하이라이트할
        // 대상이다(design-system 5.31절: "근거가 없는 것이 아니라 한 단계
        // 아래에 있다").
        el('tr', { class: 'table-row-excluded', id: `account-row-${a.account}` }, [
          el('td', {}, [ACCOUNT_LABEL[a.account]]),
          el('td', {}, [EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER]),
          el('td', {}, ['—']),
          el('td', {}, ['—']),
        ]),
      );
      rows.push(
        el('tr', { class: 'table-row-excluded' }, [
          el('td', { colspan: 4 }, [exclusionReasonText(view), lawChipRow(lawEntriesFor(scenario, view.basisRuleIds), 'note-laws')]),
        ]),
      );
      continue;
    }

    const remaining = view.remainingLimitKrw;
    const pct = remaining > 0 ? a.annual_krw / remaining : 0;
    rows.push(
      el('tr', { id: `account-row-${a.account}` }, [
        el('td', {}, [ACCOUNT_LABEL[a.account]]),
        el('td', { class: 'type-num' }, [formatKrw(a.monthly_krw)]),
        el('td', { class: 'type-num' }, [formatKrw(a.annual_krw)]),
        el('td', {}, [formatPercent(Math.min(1, pct))]),
      ]),
    );

    // 보조 줄 — 배분액과 나란한 열에 놓지 않는다(5.10·5.11절). 나란히 놓는 순간
    // "이만큼까지 넣을 수 있다"로 읽힌다. **배분액이 여지를 넘을 때만** 그린다
    // — 넘지 않으면 배분 전 잔여 여지를 배분 결과 옆에 두게 되어, 이미 다 쓴
    // 한도가 남은 것처럼 읽힌다(`creditHeadroomBlock` 주석과 같은 이유).
    if (a.account === lastPensionAccount) {
      const headroom = pensionCreditHeadroomView(scenario, plan);
      if (headroom.exceeded) {
        rows.push(
          el('tr', { class: 'table-row-note' }, [
            el('td', { colspan: 4 }, [
              creditHeadroomExceededMessage(headroom.remainingKrw),
              !scenario.is_enacted ? el('span', { class: 'proposed-badge' }, [PROPOSED_BADGE_LABEL]) : null,
            ]),
          ]),
        );
      }
    }
    if (a.account === 'isa' && view.taxFreeLimitKrw !== null) {
      rows.push(
        el('tr', { class: 'table-row-note' }, [el('td', { colspan: 4 }, [isaTaxFreeCaption(view.taxFreeLimitKrw)])]),
      );
    }

    // D26 — 지금까지는 `pension_contribution_limit_fill`에서만 나왔다.
    // **D32(소유자 결정) 이후에는 기본안도 이 몫을 받을 수 있다** — 기본안의
    // 충당 순서에 "연금 납입한도까지" 3단계가 붙기 때문이다. **이 자리는
    // `plan.plan_id`로 걸지 않는다** — `plan.non_quantified_effects`를 그대로
    // 읽으므로 어느 안이 이 효과를 실어 오든(기본안 포함) 자동으로 뜬다. 셋을
    // 같이 낸다(원금 비과세 · 세무서 확인 필요·소급 없음 · 수익 과세) — 하나라도
    // 빠지면 문장이 거짓이 된다(계약 5.6절).
    const withoutCreditEffect = (plan.non_quantified_effects ?? []).find(
      (e) => e.code === 'pension_contribution_without_credit' && e.account === a.account,
    );
    if (withoutCreditEffect) {
      rows.push(
        el('tr', { class: 'table-row-note' }, [el('td', { colspan: 4 }, [pensionWithoutCreditMessage(withoutCreditEffect)])]),
      );
    }
  }
  if (plan.unallocated_annual_krw > 0) {
    rows.push(
      el('tr', { class: 'table-row-warning' }, [
        el('td', {}, ['미배분']),
        el('td', { class: 'type-num' }, [formatKrw(plan.unallocated_monthly_krw)]),
        el('td', { class: 'type-num' }, [formatKrw(plan.unallocated_annual_krw)]),
        // Q1 — 문장을 고정하지 않고 엔진의 `limited_by`를 읽어 사유별로 가른다.
        // 납입 한도를 다 채워 멈춘 것과 세액공제가 더 붙지 않아 멈춘 것은
        // 사용자에게 전혀 다른 사실이다.
        el('td', {}, [unallocatedReasonMessage(unallocatedBlockers(plan))]),
      ]),
    );
    // D26 — 「미배분」을 갈래로 나눈다. **"갈 곳이 없다"로 읽히지 않게** 두
    // 계좌의 여력과 정말 갈 곳 없는 몫을 나눠 말한다(계약 5.13절).
    const breakdownMessage = unallocatedBreakdownMessage(plan.unallocated_breakdown);
    if (breakdownMessage) {
      rows.push(
        el('tr', { class: 'table-row-note' }, [el('td', { colspan: 4 }, [breakdownMessage])]),
      );
    }
  }
  const transferLimit = scenario.isa_transfer_extra_limit;
  if (transferLimit) {
    rows.push(
      el('tr', {}, [
        el('td', { colspan: 4 }, [
          `ISA 전환에 따른 추가 공제 한도 ${formatKrw(transferLimit.extra_credit_limit_krw)} — 위 연금저축·IRP 배분에 반영됨`,
        ]),
      ]),
    );
  }
  // 좁은 화면에서 네 칸도 헤더 글자가 세로로 쪼개질 수 있다(실측). 열을 지우지
  // 않고 가로 스크롤로 옮긴다.
  return el('div', { class: 'account-table-scroll' }, [
    el('table', { class: 'account-table' }, [
      el('thead', {}, [el('tr', {}, ['계좌', '월 배분', '연 환산', '납입 잔여 한도 대비'].map((h) => el('th', {}, [h])))]),
      el('tbody', {}, rows),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// D25 — 가정 사항 · 법령 조항 블록. 관리자 판정(게이트 2 → D25)으로 기본 접힘이
// 허용됐다. **접기는 삭제가 아니다** — 이 절이 그 경계를 코드로 지킨다.
//
// 1. 접힌 상태에서도 제목과 건수가 읽힌다(아래 `summaryLabel`류 함수).
// 2. 펼치면 "중요한 5개"를 먼저 보이되, 나머지 전부에 도달할 경로가 **같은
//    블록 안**에 남는다 — 잘라내지 않는다(`splitTopFive` + 중첩 `<details>`).
// 3. D60(관리자 판정) — 성격·자격 배너(옛 요소 ①②, `disclosureBanner()`)는
//    소유자 지시로 지웠다. 이 절이 다루는 가정·근거·한계 블록과는 별개였다.
// ---------------------------------------------------------------------------

/**
 * "중요한 5개"의 기준 — **계산 결과에 실제로 영향을 준 것이 우선이다.**
 *
 * tier 0: 이번 계산에서 실제로 쓰인 숫자(배분액·세액공제 한도·계좌 자격)를
 *   바꾸는 가정 — 없었다면 그 금액이 달라졌을 것들.
 * tier 1: 화면에 보이는 다른 값(잔여 연수·안내 문구)이나 판정 시점에는
 *   영향을 주지만, 이 결과 화면의 헤드라인 금액 자체를 바꾸지는 않는 것들.
 * tier 2: 이번 계산의 특정 숫자가 아니라 서비스의 범위·계산 방식을 말하는
 *   일반 고지(예: "다른 소득공제는 반영하지 않았다").
 *
 * 목록에 없는 코드는 tier 1(중간)로 둔다 — 모르는 것을 최상위로 올려 다른
 * 항목을 밀어내지도, 바닥으로 내려 숨기지도 않는 안전한 기본값이다.
 */
const ASSUMPTION_TIER = {
  // tier 0 — 헤드라인 금액·한도·자격을 바꾸는 가정
  months_remaining_defaulted: 0,
  isa_new_account_assumed: 0,
  other_savings_zero_assumed: 0,
  prior_transfer_credit_zero_assumed: 0,
  prior_pension_credit_zero_assumed: 0,
  retirement_transfer_counted_in_contribution_limit: 0,
  local_tax_follows_income_tax_cap: 0,
  age_reference_date_not_in_ruleset: 0,
  deferred_retirement_income_absent_assumed: 0,
  existing_contribution_untouched: 0,
  transfer_destination_defaulted: 0,
  zero_capacity: 0,
  budget_exceeds_all_limits: 0,
  existing_contribution_over_limit: 0,
  isa_excluded_financial_income_taxpayer: 0,
  isa_excluded_age: 0,
  tax_liability_cap_unknown: 0,
  tax_liability_cap_zero: 0,
  tax_liability_cap_applied: 0,
  pension_contribution_blocked_annuity_started: 0,
  retirement_transfer_excluded_from_credit: 0,
  // 5.0.0(D27) — 헤드라인 공제율 자체를 바꾸는 가정·안내다.
  credit_rate_global_income_missing: 0,
  credit_rate_wage_only_excludes_separately_taxed_income: 0,
  // tier 2 — 특정 숫자가 아니라 범위·계산 방식을 말하는 일반 고지
  single_tax_year_only: 2,
  other_deductions_excluded: 2,
  rounding_floor_to_won: 2,
  isa_benefit_not_quantified: 2,
  fund_use_horizon_excluded_from_amounts: 2,
  early_exit_penalty_not_quantified: 2,
};

function assumptionTier(code) {
  return ASSUMPTION_TIER[code] ?? 1;
}

/** 안정 정렬로 tier가 낮은(중요한) 순서로 앞에 오게 한다 — 같은 tier 안의 순서는 바뀌지 않는다. */
function splitTopFive(entries, rank) {
  const ranked = entries.map((entry, index) => ({ entry, index, tier: rank(entry) }));
  ranked.sort((a, b) => a.tier - b.tier || a.index - b.index);
  const ordered = ranked.map((r) => r.entry);
  return { primary: ordered.slice(0, 5), rest: ordered.slice(5) };
}

/** 나머지 항목으로 가는 경로 — 모달·별도 페이지가 아니라 같은 블록 안의 중첩 `<details>`다. */
function moreItemsDisclosure(restNodes, label) {
  if (!restNodes.length) return null;
  return el('details', { class: 'more-items' }, [
    el('summary', { class: 'more-items-trigger' }, [`나머지 ${restNodes.length}건 더 보기 (${label})`]),
    el('ul', {}, restNodes),
  ]);
}

function assumptionBlock(response, scenario, form) {
  const entries = [];
  for (const a of response.assumptions) {
    // 기준 과세연도는 엔진이 `echo`로 이미 되돌려 준 값이다. 문구가 그것을 쓰고
    // 싶을 때 쓸 수 있게 넘기되, **엔진이 실은 `params`가 언제나 이긴다** —
    // 화면이 엔진의 값을 덮어쓰는 경로를 만들지 않는다.
    //
    // D46 2·3번(관리자 판정) — 이 가정이 걸리는 요건의 근거 조항을 옆에 붙이던
    // `LawChip`을 뗐다. 가정 사항 블록 자체와 문구는 그대로 남는다 — D25가
    // 지키는 것은 한계·가정이 화면에서 사라지지 않는 것이지 조항 인용이
    // 아니다. 근거는 여전히 엔진 응답(`basis_rule_ids`)과 룰셋의 `source`에 있다.
    const params = { tax_year: response.echo?.tax_year, ...a.params };
    entries.push({ code: a.code, node: assumptionMessage(a.code, params) });
  }
  // 화면 파생 항목(screens.md 4.5절) — 엔진 notice가 아니라 폼 상태에서 나온다.
  // 이 넷이 빠져 있어서 입력 부족 화면의 "그 사실을 아래 가정에 적습니다"가
  // 지켜지지 않고 있었다.
  for (const code of formDerivedAssumptionCodes(form ?? {})) entries.push({ code, node: assumptionMessage(code, {}) });
  for (const n of scenario.notices.filter((n) => n.severity === 'info' || n.severity === 'warning')) {
    if (n.code === 'proposed_not_enacted') continue; // 고지 ⑥에서 별도 표시
    // 배분안이 하나로 합쳐졌다는 사실은 **비교 자리에서** 이미 말한다(4.4절).
    // 여기 한 번 더 적으면 "가정 사항" 목록의 성격과도 어긋난다 — 계산의
    // 전제가 아니라 결과의 형태에 대한 안내다.
    if (n.code === 'plans_collapsed_single') continue;
    entries.push({ code: n.code, node: noticeMessage(n) });
  }

  const { primary, rest } = splitTopFive(entries, (e) => assumptionTier(e.code));
  const li = (entry) => el('li', { class: 'type-body-s' }, [].concat(entry.node));

  return el('details', { class: 'assumption-block' }, [
    // **접힌 상태에서도 제목과 건수가 읽힌다** — D25가 지킨 조건 2번.
    el('summary', { class: 'block-summary type-title-m' }, [
      el('span', { class: 'block-summary-chevron', 'aria-hidden': 'true' }, ['▸']),
      `가정 사항 ${entries.length}건`,
    ]),
    el('ul', {}, primary.map(li)),
    moreItemsDisclosure(
      rest.map(li),
      '이번 계산의 결과 금액을 바꾸지 않는 일반 고지 위주',
    ),
  ]);
}

// D46 2·3번(관리자 판정) — 「법령 조항」 disclosure(`basisBlock`, 옛 `<details
// class="basis-block">`)를 화면에서 걷어냈다. 소유자가 세 번째로 같은 항목을
// 줄여 달라고 했다("결과 화면에 소득세법 각 항이 너무 많이 나열되어 있다" ·
// "그 외의 밑에 칸들에도 세법 항을 나열한 구간들이 있는데 다 없애 달라").
// 이 블록은 처음부터 끝까지 조항 나열(`LawChip` + 조문 제목 + 원문 링크)이라
// 부분 축소가 아니라 전체 제거가 맞다. **헌장 D25("접는 것은 되고 자르는 것은
// 안 된다")에 걸리지 않는다** — D25가 지키는 것은 한계·가정이 화면에서
// 사라지지 않는 것이지 조항 인용의 존재가 아니다. **`scenario.legal_basis`는
// 엔진 응답에서 지우지 않았고 룰셋의 `source`도 그대로다** — 검증기가 계속
// 그것을 검사한다. 화면이 안 보이는 것과 우리가 근거 없이 계산하는 것은
// 다르다.

// D61(관리자 판정, 소유자 지시, 세 번째 같은 방향) — `[4-G]` `LimitNote`
// (`limitNote()`, 옛 `<div class="limit-note">`, 고지 ⑤)를 화면에서 걷어냈다.
// D60에서 「소유자가 인용하지 않았다」며 남겼던 것을 이번에 소유자가 직접
// 지목했다("실제 신고·납부는 세무사 등 자격자 확인이 필요합니다 … 다
// 지워줘"). 세 문장 전부와 그것을 담던 칸이 함께 나갔다 — `DISCLOSURE.limit`이
// `copy.js`에서 없어졌으니 여기 남기면 `undefined` 참조가 된다.

/**
 * `[6번, D74]` 요약 시트 — 이미지·PDF 내보내기가 실제로 찍는 대상. 화면에는
 * 보이지 않는다(`styles.css`의 `.summary-sheet { display: none }`) —
 * 인쇄(`@media print`)에서만 나타나고, 그때는 `.result-body`의 나머지
 * 전부가 숨는다(`styles.css` — 옛 규약("결과와 고지 전부가 인쇄된다")을
 * D74가 "요약 다섯 항목만 인쇄된다"로 좁혔다).
 *
 * **[2026-08-18, 관리자 지시(6차) 3번, D75] PDF도 PNG와 같은 SVG를 그대로
 * 쓴다 — 두 산출물이 갈릴 자리를 구조로 없앤다.** 옛(D74) 구현은 이 함수가
 * `donutChart`/`donutLegend`(DOM 컴포넌트) + `<table>`을 **직접** 조립해
 * PNG 경로(`summary-image.js`의 독립 SVG)와 서로 다른 마크업을 각자
 * 유지했다 — 도넛 라벨(D75 2번)이나 입력값 블록(D75) 같은 변경이 생길 때마다
 * 두 곳을 동시에 고쳐야 했고, 하나만 고치면 그 자리에서 조용히 갈라진다.
 * 이제 이 함수는 `buildSummarySvgMarkup`(PNG 경로가 쓰는 바로 그 함수)이
 * 낸 SVG 문자열을 `summarySvgElementFromMarkup`으로 파싱해 그대로 삽입할
 * 뿐, 도넛·표·입력값 블록을 다시 조립하지 않는다.
 *
 * 담는 것 — D74가 정한 다섯 항목(도넛(조각 라벨 포함)·계좌별 월 납입액·
 * 총 절세액·계좌별 납입 잔여 한도·연 환산) + D75가 더한 입력값 블록.
 * **가정 사항·다른 배분 비교는 여기 없다** — `assumptionBlock`도
 * `stackBarComparison`도 부르지 않는다(`buildSummaryData`가 애초에 그
 * 값을 읽지 않는다).
 *
 * **리터럴 hex 색을 쓰는 것이 이 통합의 전제다.** `buildSummarySvgMarkup`은
 * CSS 커스텀 프로퍼티를 참조하지 않는다(D74, `summary-image.js` 머리말) —
 * 그래서 이 인라인 삽입 경로도, PNG의 독립 문서 경로도 똑같은 문자열에서
 * 똑같은 색이 나온다. 인쇄가 라이브 문서 안에 있다는 사실은 이제 이 함수의
 * 전제가 아니다(`var(--...)` 상속에 기대지 않는다) — 그래서 `donutChart`를
 * 더는 재사용하지 않는다.
 */
function summarySheet(plan, scenario, annualReturnRate, form) {
  const data = buildSummaryData(plan, scenario, annualReturnRate, form);
  const svgMarkup = buildSummarySvgMarkup(data);
  const svgEl = summarySvgElementFromMarkup(svgMarkup);
  return el('div', { class: 'summary-sheet' }, [svgEl].filter(Boolean));
}

/**
 * `[4-H]` — 2026-08-10 소유자 지시로 "공유용 이미지 만들기"(캔버스 PNG)를
 * 걷어내고 PDF 내보내기(브라우저 인쇄)로 바꿨다.
 *
 * **[2026-08-18, 관리자 지시(4차) 6·7번, D74] 「요약 저장」으로 다시
 * 갈린다.** 이미지가 돌아왔지만 옛 방식(전체 페이지 캔버스, D10에서
 * 걷어냄)이 아니다 — 이번에는 이미지·PDF 둘 다 **요약 시트**(`summarySheet`,
 * 바로 위)만 찍는다. PDF는 인쇄 CSS가 좁힌 결과이고(`styles.css`), 이미지는
 * `summary-image.js`가 같은 자료(`buildSummaryData`)를 독립 SVG로 짜서
 * 캔버스에 굽는다. **여기에 공유 링크(관리자 지시 7번)도 함께 둔다** —
 * "저장·공유" 한 블록이라는 원래 자리 그대로다.
 *
 * **`onBlocked`가 클로저로 잡은 `note` 노드에 직접 쓰지 않고
 * `document.querySelector`로 그 순간 다시 찾는다.** `exportToPdf`의 차단
 * 감지는 500ms 뒤에 온다(`ui/print.js`). 그 사이 다른 입력이 blur돼
 * 재계산이 걸리면 결과 패널 전체가 `patch`로 다시 그려지며 `saveShareBlock`도
 * 다시 불려 **새 클로저의 새 `note` 객체**가 생긴다 — `patch`가 DOM 노드
 * 자체는 재사용해도, 먼저 클릭했던 그 클로저가 쥔 `note` 참조는 이미 옛
 * 렌더의 것이라 거기 쓴 텍스트가 화면에 반영되지 않는다(실측으로 잡았다:
 * `print()` 호출은 됐는데 문구는 그대로였다). `.save-share-note`는 결과
 * 패널에 하나뿐이므로, 콜백이 불릴 때 **그 순간의 살아있는 노드**를 다시
 * 찾으면 이 경합이 사라진다. 이미지 버튼의 실패 안내(`.save-share-note`
 * 재사용)와 공유 링크의 확인 안내(`.share-link-note`, 별도 노드 — PDF/이미지
 * 캡션을 지우지 않고 나란히 둔다)도 같은 이유로 클릭 시점에 다시 찾는다.
 */
/**
 * [2026-08-23, D82 판정 4] 저장·공유 버튼의 아이콘화 — 계산기2 한정
 * (`saveShareBlock`의 `hideConditionalCopy` 분기). 소유자 제공
 * `src/design/image.png`·`share.png`를 단색 마스크(CSS `mask-image`)로
 * `--accent-warm`을 입힌다 — 래스터 자체를 다시 칠하지 않는다(원본은
 * 그대로, 화면에 실제로 칠해지는 색은 토큰 하나가 진다. 테마가 바뀌어도
 * `--accent-warm`이 갱신되면 아이콘 색도 따라간다). **버튼의 접근 가능한
 * 이름은 `aria-label`이 진다** — 아이콘만 남아도 뜻은 텍스트가 나른다는
 * 9절 규약 그대로다.
 */
function saveShareIconButton({ extraClass, dataUri, iconWidth, iconHeight, ariaLabel, onclick }) {
  return el(
    'button',
    {
      type: 'button',
      class: `btn btn-secondary save-share-icon-btn ${extraClass}`,
      'aria-label': ariaLabel,
      onclick,
    },
    [
      el('span', {
        class: 'save-share-icon',
        'aria-hidden': 'true',
        style: `mask-image:url(${dataUri});-webkit-mask-image:url(${dataUri});width:${iconWidth}px;height:${iconHeight}px;`,
      }),
    ],
  );
}

function saveShareBlock(store, plan, scenario, annualReturnRate, hideConditionalCopy = false) {
  const imageOnClick = async () => {
    try {
      // [2026-08-18, 관리자 지시(6차) 2번, D75] `store.getState().form`을
      // 클릭 시점에 다시 읽는다 — `shareButton`(아래)이 이미 같은 이유로
      // 그렇게 한다: 클로저가 마운트 시점 값을 붙잡으면 그 뒤 입력이
      // 바뀌어도 예전 값이 이미지에 실린다.
      const data = buildSummaryData(plan, scenario, annualReturnRate, store.getState().form);
      const dataUrl = await exportSummaryPng(data);
      downloadDataUrl(dataUrl, `배분-요약-${scenario?.ruleset?.tax_year ?? ''}.png`);
      store.reportSaveShare('image');
    } catch {
      const note = document.querySelector('.save-share-note');
      if (note) note.textContent = IMAGE_EXPORT_BLOCKED_NOTE;
    }
  };
  const imageButton = hideConditionalCopy
    ? saveShareIconButton({
        extraClass: 'save-share-icon-btn-image',
        dataUri: SAVE_SHARE_IMAGE_ICON_DATA_URI,
        // [2026-08-23, D83 소유자 지시 7번] 22 × 1.05 = 23.1
        iconWidth: 23.1,
        iconHeight: 23.1,
        ariaLabel: IMAGE_EXPORT_LABEL,
        onclick: imageOnClick,
      })
    : el('button', { type: 'button', class: 'btn btn-secondary', onclick: imageOnClick }, [IMAGE_EXPORT_LABEL]);
  // [2026-08-23, D82 판정 2] PDF 저장 버튼 — 계산기2 한정으로 화면에서만
  // 뺀다. **조립기(`exportToPdf`, `ui/print.js`)와 인쇄 CSS는 그대로
  // 둔다** — 브라우저 인쇄(Ctrl/Cmd+P)로는 여전히 동작하고, 버튼을
  // 되살리려면 이 삼항 하나만 되돌리면 된다(D82 게이트 기록 원문).
  const pdfButton = hideConditionalCopy
    ? null
    : el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: () => {
            const attempted = exportToPdf({
              onBlocked: () => {
                const note = document.querySelector('.save-share-note');
                if (note) note.textContent = PDF_EXPORT_BLOCKED_NOTE;
              },
            });
            if (attempted) store.reportSaveShare('pdf');
          },
        },
        [PDF_EXPORT_LABEL],
      );
  // [2026-08-23, D82 판정(불요) — 소유자 지시 8번] 캡션 문장(SUMMARY_EXPORT_NOTE)
  // 자체는 계산기2에서 뺀다 — 그러나 **이 문단 요소는 그대로 둔다**(빈
  // 문자열로 시작). `.save-share-note`는 내보내기가 막혔을 때 이미지
  // 버튼 핸들러(`imageOnClick`)가 `document.querySelector`로 다시 찾아
  // 오류 안내를 적는 유일한 자리다 — 요소째 지우면 그 안내가 갈 곳이
  // 없어진다(소유자 지시는 "캡션 제거"이지 "오류 안내 경로 제거"가 아니다).
  const note = el('p', { class: 'type-caption save-share-note' }, [hideConditionalCopy ? '' : SUMMARY_EXPORT_NOTE]);

  /**
   * [관리자 지시(4차) 7번, D74] 공유 링크 — URL **프래그먼트**에 현재 입력을
   * 실어(`state/share-link.js`) 클립보드에 복사한다. **D74의 조건 — 공유
   * 시점에 "이 링크에는 입력하신 값이 들어 있습니다"가 반드시 보여야
   * 한다.** 복사 성공·실패 어느 쪽이든 이 문구는 먼저 뜬다(성공하면 복사
   * 완료를, 실패하면 "자동 복사 실패, 아래 주소를 직접 복사" 뒤에 실제
   * 링크를 이어 붙인다) — "복사됐다"는 사실만 알리고 "값이 들어 있다"를
   * 빠뜨리면 D74의 판정이 무너진다.
   */
  const shareOnClick = async () => {
    const url = buildShareUrl(store.getState().form);
    const noteEl = document.querySelector('.share-link-note');
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(url);
      if (noteEl) noteEl.textContent = SHARE_LINK_COPIED_NOTE;
    } catch {
      if (noteEl) noteEl.textContent = `${SHARE_LINK_COPY_BLOCKED_NOTE} ${url}`;
    }
    store.reportSaveShare('link_copy');
  };
  const shareButton = hideConditionalCopy
    ? saveShareIconButton({
        extraClass: 'save-share-icon-btn-share',
        dataUri: SAVE_SHARE_SHARE_ICON_DATA_URI,
        // [2026-08-23, D83 소유자 지시 7번] 22 × 1.05 = 23.1
        iconWidth: 23.1,
        iconHeight: 23.1,
        ariaLabel: SHARE_LINK_LABEL,
        onclick: shareOnClick,
      })
    : el('button', { type: 'button', class: 'btn btn-secondary', onclick: shareOnClick }, [SHARE_LINK_LABEL]);
  const shareNote = el('p', { class: 'type-caption share-link-note' }, ['']);

  // [2026-08-23, D82 소유자 지시 8번] 「요약 저장」 소제목 — 계산기2에서는
  // 뺀다(캡션과 같은 지시). 버튼 묶음(`save-share-actions`)에서 PDF 버튼이
  // 빠지면(판정 2) 이미지 버튼 하나만 남는다 — `pdfButton`이 `null`이면
  // `el()`이 그 자식을 조용히 건너뛴다(`dom.js` — 이 파일 다른 자리에서도
  // 쓰는 관행, 새로 만들지 않는다).
  //
  // [2026-08-23, D83 소유자 지시 7번] 계산기2는 이미지·공유 버튼을 같은 한
  // 행에 우측 정렬로 묶는다(`save-share-actions-calc2-row`, CSS
  // `justify-content:flex-end`) — 첫 탭은 이미지(+PDF) 행과 공유 행이
  // 여전히 따로다(`save-share-actions-secondary`). 테두리 제거·+5% 크기는
  // CSS(`.save-share-icon-btn`)와 위 `iconWidth/iconHeight`가 진다.
  const calc2ActionsRow = el('div', { class: 'save-share-actions save-share-actions-calc2-row' }, [imageButton, shareButton]);
  return el('div', { class: `save-share${hideConditionalCopy ? ' save-share-calc2' : ''}` }, [
    hideConditionalCopy ? null : el('p', { class: 'save-share-heading type-body-strong' }, [SAVE_SHARE_HEADING]),
    hideConditionalCopy ? calc2ActionsRow : el('div', { class: 'save-share-actions' }, [imageButton, pdfButton]),
    note,
    hideConditionalCopy ? null : el('div', { class: 'save-share-actions save-share-actions-secondary' }, [shareButton]),
    shareNote,
  ]);
}

function proposedScenarioCaption(scenario) {
  // 고지 ⑥ — 배지 하나로 끝내지 않는다(design-system 4.2절 "세 가지 구조적
  // 방어" 3). 차트 아래에 문장으로도 한 번 더 알린다.
  if (scenario.is_enacted) return null;
  return el('p', { class: 'field-help chart-note' }, [
    el('span', { class: 'proposed-badge' }, ['정부안 · 국회 통과 전']),
    ' 이 시나리오는 아직 국회를 통과하지 않은 개정안을 반영한 계산입니다.',
  ]);
}

/**
 * D47 — 확정 탭의 ISA 연간 납입한도에 이월 가산이 실려 있는데, 아직 국회를
 * 통과하지 않은 개정안(정부안)이 통과되면 그 이월분을 기존 가입자도 잃는다
 * (부칙 §27②). **두 한도가 실제로 갈릴 때만 나온다** — 대다수 사용자(누적
 * 0·경과 0)에게는 두 값이 같아 나오지 않는다.
 *
 * **판정은 계약이 이미 낸 값으로 한다.** 두 시나리오의
 * `limits.by_account[isa].contribution_limit_remaining_krw`를 그대로 비교할
 * 뿐, 이월 산식이나 부칙 조항을 이 파일이 다시 계산하지 않는다.
 *
 * **확정 탭에만 나온다.** 오해를 낳는 수가 거기 있다 — 개정안 탭에만 두면
 * 확정 탭만 보는 사용자는 못 본다.
 */
function isaCarryoverRepealDivergenceNote(response, scenario) {
  if (!scenario.is_enacted) return null;
  const proposed = response.scenarios.find((s) => !s.is_enacted);
  if (!proposed) return null; // 개정안을 계산하지 않았으면 갈림을 판정할 수 없다
  const currentIsa = scenario.limits.by_account.find((a) => a.account === 'isa');
  const proposedIsa = proposed.limits.by_account.find((a) => a.account === 'isa');
  if (!currentIsa || !proposedIsa) return null;
  if (currentIsa.contribution_limit_remaining_krw <= proposedIsa.contribution_limit_remaining_krw) return null;
  return el('div', { class: 'warning-note warning-note-banner' }, [el('p', {}, [ISA_CARRYOVER_REPEAL_DIVERGENCE_NOTE])]);
}

/**
 * D46 4번(관리자 판정) — 개정안 탭이 확정 탭과 **화면에 보이는 결과**에서
 * 같으면 결과 패널을 통째로 다시 그리지 않고 한 줄만 낸다. 소유자가 본
 * 중복("개정안 탭 안이 현 세법 기준과 똑같이 나온다")이 바로 이것이고, 그
 * 관찰이 참인 경우에만 이 판정을 적용한다 — 개정예고 규칙 12건 중 어느 것에도
 * 걸리지 않은 입력에서만 참이다(청년 퇴직연금 공제율 15%·ISA 이월 폐지·계약
 * 5년 상한·생산적금융 ISA 등 여럿이 실제로 결과를 바꾼다).
 *
 * **비교는 `scenarioDisplaysEqual`(순수 함수, `scenario-compare.js`)이 진다.**
 * 새 세법 판단이 아니다 — 엔진이 이미 두 시나리오를 각각 계산했고, 여기서는
 * 그 두 응답을 대조할 뿐이다. 무엇을 비교하는지(배분액만이 아니라 한도·자격·
 * 세율표·안내 코드까지)와 무엇을 뺐는지(정체성 필드·조항 인용)는 그 모듈의
 * 주석에 근거와 함께 있다.
 */
function proposedScenarioMatchesCurrent(response, scenario) {
  if (scenario.is_enacted) return false;
  const current = response.scenarios.find((s) => s.is_enacted);
  return scenarioDisplaysEqual(current, scenario);
}

/**
 * **`scenario.ruleset.tax_year`를 쓰지 않는다.** 그 값은 두 시나리오 모두
 * 요청한 과세연도(예: 2026)를 그대로 되비추는 값이다(`src/engine/compute.mjs`
 * `tax_year: selection.base.doc.tax_year` — 확정 룰셋의 연도이고 개정안
 * 시나리오에서도 바뀌지 않는다). "2027년 반영 예정"이 말하려는 것은 **개정안이
 * 시행되는 해**이므로 `ruleset.effective_from`(개정예고 룰셋 파일의 시행일,
 * 예: `2027-01-01`)에서 연도를 읽는다 — `tax-rules-report.md`가 낸 그 문서의
 * 값 그대로다.
 */
function proposedEffectiveYear(scenario) {
  const match = /^(\d{4})/.exec(scenario.ruleset.effective_from ?? '');
  return match ? match[1] : null;
}

function proposedSameAsCurrentBody(scenario) {
  return el('div', { class: 'result-body' }, [
    el('div', { class: 'inline-alert inline-alert-info', role: 'status' }, [
      el('p', { class: 'type-body-strong' }, [proposedSameAsCurrentNotice(proposedEffectiveYear(scenario))]),
    ]),
  ]);
}

/**
 * [2026-08-23, D83 판정 3 — 계산기2 한정] 결과 위계 변경 — 「최적 월 배분」
 * (`chart-area`, 도넛+배분표)이 시나리오 탭보다 위로 올라간다. `renderResultPanel`
 * 이 시나리오 탭을 이 함수보다 **먼저** 그리므로(고정 순서), `chart-area`
 * 자체를 이 함수 밖으로 빼서 `renderResultPanel`이 시나리오 탭 **앞**에
 * 직접 꽂을 수 있게 한다 — `resultPanelForScenario`는 그 자리에 `null`을
 * 남겨 두 번 그리지 않는다(계산도, DOM 노드도 하나뿐이다). 첫 탭
 * (`hideConditionalCopy === false`)은 이 함수 안 원래 자리에 그대로
 * 남는다 — 위계가 안 바뀐다.
 */
function resultPanelForScenario(
  response,
  scenario,
  activePlanId,
  store,
  onSelectPlan,
  { conditionalPending = false, form = {}, seatDraw = 'donut', hideConditionalCopy = false } = {},
) {
  if (proposedScenarioMatchesCurrent(response, scenario)) {
    return { body: proposedSameAsCurrentBody(scenario), extractedChartArea: null };
  }

  const plan = scenario.plans.find((p) => p.plan_id === activePlanId) ?? scenario.plans[0];
  const showAllExitBanner = scenario.comparison_note_codes.includes('all_accounts_have_early_exit_penalty');
  const reorderNote = scenario.comparison_note_codes.includes('baseline_reordered_by_fund_use_horizon');
  const annualReturnRate = response.echo.isa_return_assumption?.annual_return_rate ?? null;

  const chartAreaEl = chartArea(plan, scenario, response.echo.months_remaining_in_tax_year, {
    seatDraw,
    hideConditionalCopy,
    // 5.1.0(D28) — "무엇을 주었는가"(echo)와 "무엇을 썼는가"(estimate)를 한
    // 칸에 뭉치지 않는다. 정산 기간은 estimate에서, 수익률·소득 성격은
    // echo에서 읽어 같은 캡션에 함께 적는다(계약 4.2절).
    isaReturnAssumption: response.echo.isa_return_assumption,
  });

  const body = el('div', { class: 'result-body' }, [
    // 5.1.0(D28) — "무엇을 주었는가"(echo)를 헤드라인 구성 줄②의 조건절에도
    // 그대로 쓴다. 화면이 수익률을 제안하거나 미리 채우지 않는다(0.10절) —
    // 여기서도 사용자가 준 값을 되비출 뿐 새 값을 만들지 않는다.
    // [2026-08-21, D80 판정 2] `hideConditionalCopy`(계산기2 전용) —
    // `showCaption: false`로 헤드라인 밑 조건절만 뺀다. "잘림" 사실 문단
    // (`amount-card-direction`)은 `showCaption`과 무관하게 그대로 남는다
    // (`amountCard` 머리말) — D80이 지운 것은 조건절뿐이다.
    amountCard(plan, scenario, annualReturnRate, { showCaption: !hideConditionalCopy }),
    // 표시된 숫자 바로 옆에서 말한다 — 배너만으로는 금액을 보는 사용자의 눈에
    // 안 들어온다(3.5절 "아래 결과에는 아직 반영되지 않았다는 표시를 함께 둔다").
    conditionalPending ? el('p', { class: 'stale-caption' }, [CONDITIONAL_PENDING_STALE_CAPTION]) : null,
    creditRateFallbackBanner(response.echo?.credit_rate_bracket),
    showAllExitBanner ? allExitPenaltyBanner() : null,
    proposedScenarioCaption(scenario),
    // [2026-08-21, D80 판정 2] 이월 개정안 경고 — 계산기2에서는 뺀다.
    hideConditionalCopy ? null : isaCarryoverRepealDivergenceNote(response, scenario),
    // [2026-08-23, D83 판정 3] 계산기2는 이 자리에 그리지 않는다 — 시나리오
    // 탭보다 위(`renderResultPanel`)로 이미 옮겨졌다. 첫 탭은 원래 자리
    // 그대로.
    hideConditionalCopy ? null : chartAreaEl,
    // [2026-08-21, D80 판정 2] 「두 연금계좌 중 왜 이 순서인가」 블록 —
    // 계산기2에서는 뺀다.
    hideConditionalCopy ? null : fillOrderNote(plan, scenario),
    reorderNote ? el('p', { class: 'field-help' }, [comparisonNoteMessage('baseline_reordered_by_fund_use_horizon')]) : null,
    stackBarComparison(scenario, plan.plan_id, onSelectPlan),
    accountTable(plan, scenario),
    assumptionBlock(response, scenario, form),
    // `[6번, D74]` 요약 시트 — 화면에는 안 보이고(`.summary-sheet { display:
    // none }`) 인쇄에서만 나타난다. 위치는 DOM 순서일 뿐 시각 순서를 정하지
    // 않는다(어차피 숨어 있다) — 저장·공유 버튼 바로 앞에 두어 "이 결과를
    // 어떻게 들고 나갈까"라는 흐름과 코드 순서가 같게 맞춘다.
    summarySheet(plan, scenario, annualReturnRate, form),
    saveShareBlock(store, plan, scenario, annualReturnRate, hideConditionalCopy),
  ]);
  return { body, extractedChartArea: hideConditionalCopy ? chartAreaEl : null };
}

function scenarioTabs(response, activeScenarioId, onSelect) {
  if (response.scenarios.length < 2) return null;
  return el(
    'div',
    { class: 'scenario-tabs', role: 'tablist' },
    response.scenarios.map((s) =>
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: `scenario-tab${s.scenario_id === activeScenarioId ? ' scenario-tab-selected' : ''}`,
          'aria-selected': s.scenario_id === activeScenarioId,
          onclick: () => onSelect(s.scenario_id),
        },
        [
          s.scenario_id === 'current'
            ? CURRENT_SCENARIO_TAB_LABEL
            : el('span', {}, [PROPOSED_SCENARIO_TAB_LABEL, el('span', { class: 'proposed-badge' }, ['정부안 · 국회 통과 전'])]),
        ],
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// 상태 오케스트레이션 — 다섯 상태를 여기서 갈라 렌더한다.
// ---------------------------------------------------------------------------

// [2026-08-20, D79] **키로 나뉜 상태다 — 모듈 전역 값 하나가 아니다.**
// 계산기2가 이 파일을 첫 탭과 동시에(같은 문서, 같은 렌더 사이클 안에서)
// 부르면서, 옛 "모듈에 하나뿐인 전역"이 두 번째 소비자에게 첫 소비자의
// 상태를 덮어씌우는 결함이 실제로 났다(실측: 계산기2 결과가 `placeholder-
// leaving` 단계에 영원히 멈춰 도넛이 끝내 그려지지 않았다 — 두 `planSeat`
// 호출이 서로의 `phase`/`shape`를 밟았다). `resultKey`(기본값 `'default'`,
// 첫 탭이 넘기지 않으면 옛 동작과 완전히 같다)로 `Map`을 나눠 이 결함을
// 구조로 막는다. **`uiSelection`(시나리오/대안 탭 선택)도 같은 이유로
// 같이 나눈다** — 안 나누면 계산기2에서 시나리오 탭을 누르면 첫 탭 결과의
// 선택도 함께 바뀐다.
const uiSelectionByKey = new Map();
function getUiSelection(key) {
  if (!uiSelectionByKey.has(key)) uiSelectionByKey.set(key, { scenarioId: 'current', planId: null });
  return uiSelectionByKey.get(key);
}

// ---------------------------------------------------------------------------
// 결과 자리의 전환 상태 (design-system 5.29절)
//
// 판단은 `nextSeatStep`(순수 함수)이 하고 여기서는 그 결과를 기억하고 타이머를
// 건다. 상태를 이 모듈에 두는 이유: 자리표시자 → 결과 전환은 **한 번만** 일어나는
// 사건이라 store의 상태에서 파생되지 않는다(같은 `status === 'result'`가 첫 번째
// 계산인지 열 번째인지 상태만으로는 알 수 없다).
// ---------------------------------------------------------------------------

const seatStateByKey = new Map(); // resultKey -> { shape, phase }
function getSeatState(key) {
  if (!seatStateByKey.has(key)) seatStateByKey.set(key, { shape: null, phase: 'idle' });
  return seatStateByKey.get(key);
}

function planSeat(desired, resultKey) {
  const s = getSeatState(resultKey);
  const step = nextSeatStep({ desired, lastShape: s.shape, phase: s.phase, reducedMotion: prefersReducedMotion() });
  s.phase = step.phase;
  s.shape = shapeOf(step.draw);
  if (step.scheduleFadeMs != null) {
    // 링이 사라진 **다음 프레임에** 도넛을 그린다. 겹치는 프레임이 없다.
    setTimeout(() => {
      s.phase = 'entering';
      rerenderHook();
    }, step.scheduleFadeMs);
  }
  return step.draw;
}

export function renderResultPanel({ state, store, resultKey = 'default' }) {
  const { status, result, fatalError } = state;

  if (status === 'fatal_error') {
    planSeat('none', resultKey);
    return fatalErrorPanel(fatalError);
  }
  if (status === 'blocked') {
    planSeat('none', resultKey);
    return blockedPanel(fatalError, store);
  }
  if (status === 'blank' || status === 'input_incomplete') {
    planSeat('placeholder', resultKey);
    return inputIncompletePanel(state);
  }

  // loading / field_error / result — 직전 결과를 유지한다는 규약(design-system 6.1)
  if (!result) {
    // 첫 계산이 아직 끝나지 않은 로딩 상태. **자리표시자를 그대로 둔다** — 결과
    // 자리를 비우면 ① 레이아웃이 한 번 접혔다 펴지고 ② 자리표시자 → 결과 전환의
    // 두 끝이 붙어 있지 않게 되어 5.29절의 전환 자체가 성립하지 않는다.
    planSeat('placeholder', resultKey);
    return el('div', { class: `result-panel-inner ${loadingOverlayClass(false)}` }, [
      el('div', { class: 'result-body' }, [
        resultPlaceholder(),
        el('p', { class: 'type-body-s chart-note' }, ['계산 중입니다…']),
      ]),
    ]);
  }

  const uiSelection = getUiSelection(resultKey);
  const scenarioId = result.scenarios.some((s) => s.scenario_id === uiSelection.scenarioId) ? uiSelection.scenarioId : 'current';
  const scenario = result.scenarios.find((s) => s.scenario_id === scenarioId);
  const planId = scenario.plans.some((p) => p.plan_id === uiSelection.planId) ? uiSelection.planId : scenario.plans[0].plan_id;

  const onSelectScenario = (id) => {
    uiSelectionByKey.set(resultKey, { scenarioId: id, planId: null });
    rerenderHook();
  };
  const onSelectPlan = (id) => {
    if (id !== scenario.plans[0].plan_id) store.reportAlternativeClick();
    uiSelectionByKey.set(resultKey, { scenarioId, planId: id });
    rerenderHook();
  };

  // Q2 — 조건부 필수 항목(전환 금액)이 비면 결과는 갱신되지 않는데 화면에 단서가
  // 하나도 없었다. `screens.md` 3.5절이 정한 처리: **직전 결과를 지우지 않고**
  // 상단에 `InlineAlert(info)`를 띄우고, 아래 결과가 아직 그 입력을 반영하지
  // 않았다는 표시를 함께 둔다. 오류 색이 아니라 info다 — 사용자가 무언가를
  // 망가뜨린 것이 아니라 아직 덜 채운 것이다.
  const conditionalPending = Boolean(state.validation?.conditionalPending);
  const seatDraw = planSeat('donut', resultKey);
  // [2026-08-21, D80 판정 2] 계산기2(`resultKey === 'calc2'`) 마운트에서만
  // 조건절 문구 넷 중 셋(캡션 조건절·이월 개정안 경고·순서 근거 블록)을
  // 뺀다 — 첫 탭은 `resultKey`를 넘기지 않으므로(기본값 `'default'`) 전혀
  // 영향받지 않는다. 프리필 안내줄(넷째)은 `ui/calc2-input-panel.js`가
  // 이미 그리지 않는다(이 파일과 무관).
  const hideConditionalCopy = resultKey === 'calc2';
  const { body, extractedChartArea } = resultPanelForScenario(result, scenario, planId, store, onSelectPlan, {
    conditionalPending,
    form: state.form,
    seatDraw,
    hideConditionalCopy,
  });

  const wrapperClass =
    status === 'loading' ? 'result-panel-inner result-loading-overlay' : status === 'field_error' ? 'result-panel-inner' : 'result-panel-inner';

  return el('div', { class: wrapperClass }, [
    status === 'field_error' ? fieldErrorBanner(store) : null,
    conditionalPending ? conditionalPendingAlert() : null,
    // [2026-08-23, D83 판정 3 — 계산기2 한정] 「최적 월 배분」이 시나리오
    // 탭보다 위다 — `extractedChartArea`는 `hideConditionalCopy`일 때만
    // 값이 있다(`resultPanelForScenario`). 첫 탭은 `null`이라 이 줄이
    // 아무것도 안 그리고, 그 안(`body`)에 원래 자리 그대로 남는다.
    extractedChartArea,
    scenarioTabs(result, scenarioId, onSelectScenario),
    body,
  ]);
}

function conditionalPendingAlert() {
  return el('div', { class: 'inline-alert inline-alert-info', role: 'status' }, [
    el('p', { class: 'type-body-strong' }, [CONDITIONAL_PENDING_ALERT]),
    el('button', { type: 'button', class: 'btn btn-text', onclick: () => focusField('isaTransferAmount') }, ['→ 입력하기']),
  ]);
}

let rerenderHook = () => {};
export function setRerenderHook(fn) {
  rerenderHook = fn;
}
