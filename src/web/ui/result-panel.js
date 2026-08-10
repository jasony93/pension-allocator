/**
 * 결과 패널 — `screens.md` 4·5·8절. 다섯 상태(입력 부족·빈·로딩·오류·정상)를
 * 전부 이 모듈이 담당한다. 고지 여섯 요소의 배치는 `screens.md` 4.2절 표를
 * 그대로 따른다 — 요소 ①②⑤는 접기 불가, ③④는 기본 펼침.
 */

import { el } from './dom.js';
import {
  ACCOUNT_LABEL,
  PLAN_LABEL,
  DISCLOSURE,
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
  donutSingleSliceCaption,
  unallocatedReasonMessage,
  unallocatedBreakdownMessage,
  pensionWithoutCreditMessage,
  NOT_ALLOCATED_IN_PLAN_CAPTION,
  CONDITIONAL_PENDING_ALERT,
  CONDITIONAL_PENDING_STALE_CAPTION,
  RESULT_PLACEHOLDER_COPY,
  EXCLUDED_ACCOUNT_FALLBACK_REASON,
  EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER,
  PROPOSED_BADGE_LABEL,
  FILL_ORDER_NOTE_HEADING,
  FILL_ORDER_TAG_FACT,
  FILL_ORDER_TAG_PRODUCT,
  fillOrderFactMessage,
  fillOrderDecisionMessage,
  AMOUNT_CARD_LABEL,
  AMOUNT_CARD_LABEL_ZERO,
  BOUNDED_AMOUNT_PREFIX,
  BOUNDED_BACK_LINK,
  boundedDirectionNote,
  capReducedNote,
  CAP_CARRYOVER_NOTE,
  AMOUNT_CARD_CAPTION_BOUNDED_CLAUSE,
  AMOUNT_CARD_CAPTION_REDUCED_CLAUSE,
  AMOUNT_CARD_CAPTION_ZERO_CLAUSE,
  STACKBAR_CAP_APPLIED_NOTE,
  STACKBAR_BOUNDED_NOTE,
  ACCOUNT_BENEFIT_STRIP_TITLE,
  accountBenefitStripRefCaption,
  ACCOUNT_BENEFIT_POOLED_NOTE,
  ACCOUNT_BENEFIT_ZERO_DIFFERENCE_NOTE,
  ACCOUNT_BENEFIT_REDUCED_NOTE,
  ACCOUNT_BENEFIT_ISA_NARRATIVE,
  ACCOUNT_BENEFIT_ISA_SUFFIX,
  ACCOUNT_BENEFIT_EXCLUDED_LABEL,
  ISA_RETURN_ASSUMPTION_CHIP_LABEL,
  ISA_RETURN_NOT_COMPUTABLE_NOTE,
  ISA_RETURN_SUPPRESSED_NOTE,
  isaReturnEstimateAmountText,
  isaReturnAssumptionCaption,
} from '../copy.js';
import { formatKrw, formatKrwAbbreviated, formatPercent, formatPlanRowAmount } from '../format.js';
import { CORE_REQUIREMENTS, formDerivedAssumptionCodes } from '../state/validation.js';
import { taxCreditHeadlineView, isBoundedHeadline, anyPlanCapApplied, HEADLINE_MODE } from '../tax-credit-view.js';
import {
  donutChart,
  donutLegend,
  allocationBar,
  stackBarSegments,
  computeTrackScalePercent,
  benefitMeter,
  benefitMeterFillPercent,
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
  lawEntriesForPath,
  pensionCreditHeadroomView,
  unallocatedBlockers,
  PENSION_ACCOUNTS,
} from './eligibility.js';
import { openShareModal } from './share.js';

// 필수 항목의 라벨·초점 대상·충족 판정은 `validation.js`의 `CORE_REQUIREMENTS`
// 한 곳에만 있다. 여기에 다시 적으면 항목이 늘 때 한쪽만 고쳐진다.

// ---------------------------------------------------------------------------
// 고지 ①② — 항상 표시, 접기 불가
// ---------------------------------------------------------------------------

function disclosureBanner() {
  return el('div', { class: 'disclosure-banner', role: 'note' }, [
    el('span', { class: 'disclosure-icon', 'aria-hidden': 'true' }, ['ⓘ']),
    el('div', {}, [el('p', {}, [DISCLOSURE.nature]), el('p', {}, [DISCLOSURE.qualification])]),
  ]);
}

// ---------------------------------------------------------------------------
// 입력 부족 / 빈 상태 (8.1 / 8.2)
// ---------------------------------------------------------------------------

function requirementChecklist({ form, validation }) {
  const errorKeyFor = { priorTax: 'priorTaxAmount' };
  const items = CORE_REQUIREMENTS.map((req) => {
    const filled = !validation.errors[errorKeyFor[req.key] ?? req.key] && req.isFilled(form);
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
    disclosureBanner(),
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
    disclosureBanner(),
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
    disclosureBanner(),
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
 * `AmountCard` — 금액 표시의 유일한 통로(design-system 5.6절). 슬롯 셋이 필수이고
 * 상한 변형에서는 넷이 된다.
 *
 * **`screens.md` 4.8절의 세 상태가 여기서 갈린다.** 어느 상태인지는
 * `tax-credit-view.js`가 엔진 응답에서 **고르기만** 하고, 이 함수는 그 결과를
 * 그린다 — 화면이 뺄셈을 시작하면 그 순간 세법 판단이 화면 코드로 들어온다.
 *
 * **셋 다 오류가 아니다.** `state-error`·`state-warning` 색을 쓰지 않는다.
 * 사용자가 무언가를 잘못해서 생긴 상태가 아니다.
 */
function amountCard(plan, scenario) {
  const view = taxCreditHeadlineView(plan);
  const laws = lawEntriesFor(scenario, view.basisRuleIds);
  const baseCaption = `${scenario.ruleset.tax_year} 과세연도 기준 · 국세 + 개인지방소득세 합산 · 다른 소득공제 미반영`;

  if (view.mode === HEADLINE_MODE.ZERO) {
    // `—`나 빈칸을 넣지 않는다 — `AmountCard`의 오류 상태가 `—`이므로 그것을
    // 쓰면 계산 실패로 읽힌다. **이것은 오류가 아니라 결과다**(4.8절 (3)).
    return el('div', { class: 'amount-card' }, [
      el('p', { class: 'amount-card-label' }, [AMOUNT_CARD_LABEL_ZERO]),
      el('p', { class: 'amount-card-value type-display' }, [formatKrw(view.totalKrw)]),
      el('p', { class: 'amount-card-caption' }, [`${baseCaption} · ${AMOUNT_CARD_CAPTION_ZERO_CLAUSE}`]),
      lawChipRow(laws, 'note-laws'),
    ]);
  }

  if (view.mode === HEADLINE_MODE.BOUNDED) {
    return el('div', { class: 'amount-card' }, [
      el('p', { class: 'amount-card-label' }, [AMOUNT_CARD_LABEL]),
      // 상한 접두는 금액과 **한 덩어리**다. 줄바꿈으로 분리되지 않는다.
      el('p', { class: 'amount-card-value type-display' }, [`${BOUNDED_AMOUNT_PREFIX} ${formatKrwAbbreviated(view.totalKrw)}`]),
      el('p', { class: 'amount-card-caption' }, [`${baseCaption} · ${AMOUNT_CARD_CAPTION_BOUNDED_CLAUSE}`]),
      // 슬롯4 — **금액 아래 24px 이내, 같은 카드 안**(D11). 다른 카드로 밀거나
      // 접으면 위반이다. 임계값은 엔진이 낸 값이고 화면이 만들지 않는다(E4).
      el('div', { class: 'amount-card-direction' }, [
        el('p', { class: 'type-body-s' }, [
          view.thresholdIncomeTaxKrw != null ? boundedDirectionNote(view.thresholdIncomeTaxKrw) : '',
        ]),
        // 버튼이 아니라 텍스트 링크다 — 누르지 않아도 결과는 완결되어 있고,
        // 버튼으로 만들면 재촉으로 읽힌다.
        el('button', { type: 'button', class: 'btn btn-text', onclick: () => focusField('priorTaxAmount') }, [
          BOUNDED_BACK_LINK,
        ]),
      ]),
    ]);
  }

  if (view.mode === HEADLINE_MODE.REDUCED) {
    return el('div', { class: 'amount-card' }, [
      el('p', { class: 'amount-card-label' }, [AMOUNT_CARD_LABEL]),
      el('p', { class: 'amount-card-value type-display' }, [formatKrwAbbreviated(view.totalKrw)]),
      el('p', { class: 'amount-card-caption' }, [`${baseCaption} · ${AMOUNT_CARD_CAPTION_REDUCED_CLAUSE}`]),
      el('div', { class: 'amount-card-direction' }, [
        // 자르기 전 금액을 함께 보인다 — 잘린 뒤 금액만 보이면 사용자는 배분이
        // 잘못됐다고 읽는다. 실제로는 배분이 아니라 **세액이 한도였다**.
        el('p', { class: 'type-body-s' }, [capReducedNote(view.beforeCapKrw, view.reducedTotalKrw)]),
        view.contributionCarryoverAvailable ? el('p', { class: 'type-body-s' }, [CAP_CARRYOVER_NOTE]) : null,
        lawChipRow(laws, 'note-laws'),
      ]),
    ]);
  }

  return el('div', { class: 'amount-card' }, [
    el('p', { class: 'amount-card-label' }, [AMOUNT_CARD_LABEL]),
    el('p', { class: 'amount-card-value type-display' }, [formatKrwAbbreviated(view.totalKrw)]),
    el('p', { class: 'amount-card-caption' }, [baseCaption]),
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
 */
function fillOrderNote(plan, scenario) {
  const tieBreak = fillOrderTieBreak(plan);
  if (!tieBreak) return null;
  const { flexible, restricted } = tieBreak;

  // 헌장 고지 요소 3 — 사실 절 바로 옆에 근거 조항을 붙인다. 근거는 엔진이
  // `tie_break.basis_rule_ids`로 지목한 규칙이고, 그 조문은 `legal_basis`에서
  // 한 글자도 바꾸지 않고 가져온다.
  const laws = lawEntriesFor(scenario, tieBreak.basisRuleIds);

  return el('div', { class: 'fill-order-note' }, [
    el('h4', { class: 'type-title-s' }, [FILL_ORDER_NOTE_HEADING]),
    el('p', { class: 'type-body-s' }, [
      el('span', { class: 'note-tag note-tag-fact' }, [FILL_ORDER_TAG_FACT]),
      ' ',
      fillOrderFactMessage(flexible, restricted),
    ]),
    lawChipRow(laws, 'note-laws'),
    el('p', { class: 'type-body-s' }, [
      el('span', { class: 'note-tag note-tag-product' }, [FILL_ORDER_TAG_PRODUCT]),
      ' ',
      fillOrderDecisionMessage(flexible),
    ]),
  ]);
}

function chartArea(plan, scenario, months, { seatDraw = 'donut', isaReturnAssumption = null } = {}) {
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
          // 도넛 중앙의 `월 배분`은 엔진이 낸 배분 총액이다. 화면이 조각을 더하면
          // 미배분까지 섞여 라벨과 값이 어긋난다(charts.js 중앙 값 주석).
          totalAllocatedMonthlyKrw: plan.total_allocated_monthly_krw,
          isProposed: !scenario.is_enacted,
          animateFromZero: seatDraw === 'donut-entering',
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
      const warning = plan.warnings.find((w) => w.account === account);
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
        alloc.annual_krw === 0 ? el('p', { class: 'field-help' }, [NOT_ALLOCATED_IN_PLAN_CAPTION]) : null,
        // 연금계좌 묶음의 세액공제 인정 여지는 **마지막 연금계좌 행에 한 번만**
        // 적는다(5.10절 (4)). 계좌마다 적으면 사용자가 둘을 더한다.
        account === creditCaptionAccount ? creditHeadroomBlock(scenario, plan) : null,
        // ISA 비과세 한도 (5.11절). 배제된 계좌는 위 분기에서 이미 빠졌고,
        // 유형 미확정이면 값이 null이라 줄 자체를 그리지 않는다.
        account === 'isa' ? isaTaxFreeBlock(scenario, view) : null,
        warning ? el('div', { class: `warning-note warning-note-${warning.severity}` }, [el('p', {}, [warningMessage(warning, scenario.fund_use_horizon_boundaries)])]) : null,
      ]);
    }),
  );

  const singleSlice = donutSingleSliceAccount(plan, excluded);

  return el('div', { class: 'chart-area' }, [
    el('div', { class: 'donut-with-strip' }, [
      el('div', { class: 'donut-wrap' }, [donut]),
      // 모바일 전용 — 라벨이 겹치는 폭에서 SVG 라벨 대신 이 리스트가 값을 낸다.
      // CSS 미디어쿼리가 둘 중 하나만 보이게 한다(둘 다 그려 두고 폭으로 고른다).
      donutLegend(donutArgs),
      // `[4-C']` — 도넛 카드의 자식이지 넷째 층이 아니다(screens.md 5.14절:
      // "C-1→C-2→C-3 사이에 넷째 층을 꽂지 않는다"). 도넛 바로 아래, 우측
      // 정렬, 절반 크기.
      accountBenefitStrip(scenario, plan, isaReturnAssumption),
    ]),
    singleSlice ? el('p', { class: 'field-help chart-note' }, [donutSingleSliceCaption(singleSlice)]) : null,
    el('p', { class: 'field-help chart-note' }, ['같은 값을 납입 잔여 한도와 함께 —']),
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
 */
function creditHeadroomBlock(scenario, plan) {
  const view = pensionCreditHeadroomView(scenario, plan);
  if (!view.exceeded) return null;
  const laws = lawEntriesForPath(scenario, 'limits.pension_combined_credit_limit_krw');
  return el('div', { class: 'headroom-note' }, [
    el('p', { class: 'type-body-s' }, [creditHeadroomExceededMessage(view.remainingKrw)]),
    el('p', { class: 'note-laws' }, [
      !scenario.is_enacted ? el('span', { class: 'proposed-badge' }, [PROPOSED_BADGE_LABEL]) : null,
      ...laws.map((entry) => el('span', { class: 'law-chip' }, [entry.law])),
    ]),
  ]);
}

/** ISA 비과세 한도 — 한도이지 절감액이 아니다. 헤드라인 절세액에 더하지 않는다. */
function isaTaxFreeBlock(scenario, view) {
  if (view.taxFreeLimitKrw === null) return null;
  return el('div', { class: 'headroom-note' }, [
    el('p', { class: 'type-body-s' }, [isaTaxFreeCaption(view.taxFreeLimitKrw)]),
    lawChipRow(lawEntriesForPath(scenario, 'limits.by_account[isa].tax_free_limit_krw'), 'note-laws'),
  ]);
}

/**
 * `AccountBenefitStrip` — design-system 5.31절 · screens.md 5.14절. 도넛 바로
 * 아래, 우측 정렬로 붙는 절반 크기 위젯. `[4-D]` 표를 대체하지 않고 요약만
 * 앞으로 끌어온다 — 근거(`LawChip`)는 이 위젯이 아니라 표에 있고, 행을 누르면
 * 그 행으로 스크롤 + 하이라이트한다(P2, 5.31절 "근거" 규약).
 *
 * **새 데이터를 만들지 않는다.** `accountBenefitRows`가 계약이 이미 낸 값만
 * 고르고, 이 함수는 그것을 그리기만 한다.
 */
function accountBenefitStrip(scenario, plan, isaReturnAssumption = null) {
  const rows = accountBenefitRows(scenario, plan);

  const pensionRow = () => {
    const p = rows.pension;
    const dots = p.accounts.map((a) =>
      el('span', { class: 'benefit-dot', style: { background: `var(--data-${a === 'annuity_savings' ? 'pension' : 'irp'})` } }),
    );
    const names = p.accounts.map((a) => ACCOUNT_LABEL[a]).join(' · ');
    const onClick = () => scrollAndHighlight(`account-row-${p.accounts[0]}`);

    if (p.state === 'excluded') {
      return el('button', { type: 'button', class: 'benefit-row', onclick: onClick }, [
        el('span', { class: 'benefit-row-dots' }, dots.length ? dots : [el('span', { class: 'benefit-dot' })]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names type-body-s' }, [names]),
          el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_EXCLUDED_LABEL]),
        ]),
      ]);
    }

    // pooled — 낼 세금 상태와 동기화한다(모름 → 최대 / 잘림 → 축약 문구 /
    // 0 → 0원 + 차이 없음 문구, 5.31절 "낼 세금 상태와 동기화한다").
    const view = taxCreditHeadlineView(plan);
    const amountText =
      view.mode === HEADLINE_MODE.BOUNDED
        ? `${BOUNDED_AMOUNT_PREFIX} ${formatKrwAbbreviated(view.totalKrw)}`
        : formatKrwAbbreviated(view.totalKrw);
    const subNote =
      view.mode === HEADLINE_MODE.ZERO
        ? ACCOUNT_BENEFIT_ZERO_DIFFERENCE_NOTE
        : view.mode === HEADLINE_MODE.REDUCED
          ? ACCOUNT_BENEFIT_REDUCED_NOTE
          : null;

    // 확정(solid) 등급 — 트랙 = 한도 적용 전, 채움 = 적용 후(design-system
    // 5.31절 "값의 출처"). `beforeCapKrw`가 없으면(방어적으로만) 막대를 생략한다.
    const fillPercent = p.beforeCapKrw != null ? benefitMeterFillPercent(p.afterCapKrw ?? 0, p.beforeCapKrw) : null;
    const meter =
      fillPercent != null
        ? benefitMeter({ account: p.accounts[0], grade: 'solid', fillPercent })
        : null;
    const ariaLabel = `${names}, ${amountText}${fillPercent != null ? `, 세액공제 한도 대비 ${formatPercent(fillPercent / 100)}` : ''}`;

    return el('button', { type: 'button', class: 'benefit-row', onclick: onClick, 'aria-label': ariaLabel }, [
      el('span', { class: 'benefit-row-dots' }, dots),
      el('span', { class: 'benefit-row-body' }, [
        el('span', { class: 'benefit-row-names type-body-s' }, [names]),
        p.accounts.length > 1 ? el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_POOLED_NOTE]) : null,
        meter,
        el('span', { class: 'benefit-row-amount type-num' }, [amountText]),
        subNote ? el('span', { class: 'benefit-row-subnote' }, [subNote]) : null,
      ]),
    ]);
  };

  const isaRow = () => {
    const i = rows.isa;
    const onClick = () => scrollAndHighlight('account-row-isa');
    if (i.state === 'excluded') {
      return el('button', { type: 'button', class: 'benefit-row', onclick: onClick }, [
        el('span', { class: 'benefit-row-dots' }, [el('span', { class: 'benefit-dot benefit-dot-excluded' })]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names type-body-s' }, [ACCOUNT_LABEL.isa]),
          el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_EXCLUDED_LABEL]),
        ]),
      ]);
    }

    const dot = el('span', { class: 'benefit-dot', style: { background: 'var(--data-isa)' } });

    // 5.1.0(D28·D29·D31) — 가정 기반 정산액이 **계산되어 있을 때만** 가정
    // 등급으로 승격한다. 그 외(가정 자체가 없음 / 계산 못 함 / 표시 끔)는
    // 여전히 narrative다 — ISA는 계약상 `DeterministicBenefit`을 갖지 않는다.
    if (i.estimate?.state === 'computed') {
      const est = i.estimate;
      const referenceKrw = est.point_estimate_krw ?? est.upper_bound_krw ?? 0;
      // 자기정규화 — 다른 계좌·다른 행과 길이를 비교하지 않는다(값이 있으면
      // 윤곽이 트랙 전체를 잇는다. 0이면 빈 트랙만 — 0을 채움으로 그리지 않는다).
      const fillPercent = referenceKrw > 0 ? 100 : 0;
      const meter = benefitMeter({ account: 'isa', grade: 'assumption', fillPercent });
      const amountText = isaReturnEstimateAmountText(est);
      const caption = isaReturnAssumption
        ? isaReturnAssumptionCaption({
            annualReturnRate: isaReturnAssumption.annual_return_rate,
            incomeCharacter: isaReturnAssumption.income_character,
            settlementYears: est.settlement_years,
            settlementYearsSource: est.settlement_years_source,
          })
        : null;
      const ariaLabel = `${ACCOUNT_LABEL.isa}, ${ISA_RETURN_ASSUMPTION_CHIP_LABEL}, ${amountText}`;

      return el('button', { type: 'button', class: 'benefit-row', onclick: onClick, 'aria-label': ariaLabel }, [
        el('span', { class: 'benefit-row-dots' }, [dot]),
        el('span', { class: 'benefit-row-body' }, [
          el('span', { class: 'benefit-row-names type-body-s' }, [ACCOUNT_LABEL.isa]),
          el('span', { class: 'benefit-row-assumption-chip' }, [ISA_RETURN_ASSUMPTION_CHIP_LABEL]),
          meter,
          el('span', { class: 'benefit-row-amount type-num' }, [amountText]),
          el('span', { class: 'benefit-row-suffix' }, [ACCOUNT_BENEFIT_ISA_SUFFIX]),
          caption ? el('span', { class: 'benefit-row-assumption-caption' }, [caption]) : null,
        ]),
      ]);
    }

    // narrative — **금액을 쓰지 않는다.** ISA는 세액공제 대상이 아닐 뿐 혜택이
    // 없는 것이 아니다(tax-rules-report.md 15.4.5절). 서술과 절세액이
    // 다른 축이라는 것을 괄호로 항상 병기한다.
    const subNote =
      i.estimate?.state === 'not_computable'
        ? ISA_RETURN_NOT_COMPUTABLE_NOTE
        : i.estimate?.state === 'display_suppressed'
          ? ISA_RETURN_SUPPRESSED_NOTE
          : null;
    return el('button', { type: 'button', class: 'benefit-row', onclick: onClick }, [
      el('span', { class: 'benefit-row-dots' }, [dot]),
      el('span', { class: 'benefit-row-body' }, [
        el('span', { class: 'benefit-row-names type-body-s' }, [ACCOUNT_LABEL.isa]),
        el('span', { class: 'benefit-row-note' }, [ACCOUNT_BENEFIT_ISA_NARRATIVE]),
        el('span', { class: 'benefit-row-suffix' }, [ACCOUNT_BENEFIT_ISA_SUFFIX]),
        // **표시를 끈 상태를 조용한 빈칸으로 두지 않는다**(D19) — 왜 안
        // 보이는지 말한다.
        subNote ? el('span', { class: 'benefit-row-subnote' }, [subNote]) : null,
      ]),
    ]);
  };

  return el('div', { class: 'account-benefit-strip' }, [
    el('h4', { class: 'type-title-s' }, [ACCOUNT_BENEFIT_STRIP_TITLE]),
    el('p', { class: 'benefit-strip-ref-caption' }, [accountBenefitStripRefCaption(scenario.ruleset?.tax_year)]),
    pensionRow(),
    isaRow(),
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
  // 금액 열 위의 한 줄들 — 4.8절이 요구하는 세 가지 사실.
  //  (1) 한도가 0으로 확정되면 **세액공제액으로는 배분안이 갈리지 않는다**.
  //      순위를 절세액 순으로 설명하면 없는 근거를 말하게 된다(계약 10절).
  //  (2) 잘림은 배분안마다 다를 수 있으므로 비교가 잘린 뒤 값으로 이뤄진다는
  //      사실을 적는다 — 없으면 "왜 공제 한도를 더 채운 안이 더 낫지 않지"에서 막힌다.
  //  (3) 한 화면에서 같은 성격의 금액이 한쪽만 상한 표기이면 두 값이 다른 것으로 읽힌다.
  const axisFlat = scenario.comparison_note_codes.includes('tax_credit_axis_not_discriminating');
  const capApplied = anyPlanCapApplied(scenario);
  const bounded = scenario.plans.some((p) => isBoundedHeadline(p));

  return el('div', { class: 'stackbar' }, [
    el('h3', { class: 'type-title-m' }, ['다른 배분과 나란히 보기']),
    excludedLine,
    axisFlat ? el('p', { class: 'field-help' }, [comparisonNoteMessage('tax_credit_axis_not_discriminating')]) : null,
    !axisFlat && capApplied ? el('p', { class: 'field-help' }, [STACKBAR_CAP_APPLIED_NOTE]) : null,
    bounded ? el('p', { class: 'field-help' }, [STACKBAR_BOUNDED_NOTE]) : null,
    ...rows,
    el('p', { class: 'field-help' }, ['▸ 표시가 지금 위에 그려진 배분입니다. 행을 누르면 도넛과 막대가 그 배분으로 바뀝니다.']),
  ]);
}

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
    // 아니라 배분 대상이 아니라는 뜻이다) 바로 아래 줄에 사유와 근거 조항을
    // 붙인다. 납입 잔여 한도 대비 비율도 한도에서 나온 값이므로 표시하지 않는다.
    if (view.excluded) {
      const laws = lawEntriesFor(scenario, view.basisRuleIds);
      rows.push(
        // id — `AccountBenefitStrip`의 행을 눌렀을 때 스크롤 + 하이라이트할
        // 대상이다(design-system 5.31절: "근거가 없는 것이 아니라 한 단계
        // 아래에 있다").
        el('tr', { class: 'table-row-excluded', id: `account-row-${a.account}` }, [
          el('td', {}, [ACCOUNT_LABEL[a.account]]),
          el('td', {}, [EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER]),
          el('td', {}, ['—']),
          el('td', {}, ['—']),
          el('td', {}, laws.length ? laws.map((entry) => el('span', { class: 'law-chip' }, [entry.law])) : ['—']),
        ]),
      );
      rows.push(
        el('tr', { class: 'table-row-excluded' }, [el('td', { colspan: 5 }, [exclusionReasonText(view)])]),
      );
      continue;
    }

    const remaining = view.remainingLimitKrw;
    const pct = remaining > 0 ? a.annual_krw / remaining : 0;
    const lawIds = a.basis_rule_ids;
    const lawEntry = scenario.legal_basis.find((l) => lawIds.includes(l.rule_id));
    rows.push(
      el('tr', { id: `account-row-${a.account}` }, [
        el('td', {}, [ACCOUNT_LABEL[a.account]]),
        el('td', { class: 'type-num' }, [formatKrw(a.monthly_krw)]),
        el('td', { class: 'type-num' }, [formatKrw(a.annual_krw)]),
        el('td', {}, [formatPercent(Math.min(1, pct))]),
        el('td', {}, [lawEntry ? el('span', { class: 'law-chip' }, [lawEntry.law]) : '']),
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
            el('td', { colspan: 5 }, [
              creditHeadroomExceededMessage(headroom.remainingKrw),
              !scenario.is_enacted ? el('span', { class: 'proposed-badge' }, [PROPOSED_BADGE_LABEL]) : null,
            ]),
          ]),
        );
      }
    }
    if (a.account === 'isa' && view.taxFreeLimitKrw !== null) {
      rows.push(
        el('tr', { class: 'table-row-note' }, [
          el('td', { colspan: 5 }, [
            isaTaxFreeCaption(view.taxFreeLimitKrw),
            ...lawEntriesForPath(scenario, 'limits.by_account[isa].tax_free_limit_krw').flatMap((entry) => [
              ' ',
              el('span', { class: 'law-chip' }, [entry.law]),
            ]),
          ]),
        ]),
      );
    }

    // D26 — `pension_contribution_limit_fill`에서만 나온다. 셋을 같이 낸다
    // (원금 비과세 · 세무서 확인 필요·소급 없음 · 수익 과세) — 하나라도 빠지면
    // 문장이 거짓이 된다(계약 5.6절).
    const withoutCreditEffect = (plan.non_quantified_effects ?? []).find(
      (e) => e.code === 'pension_contribution_without_credit' && e.account === a.account,
    );
    if (withoutCreditEffect) {
      rows.push(
        el('tr', { class: 'table-row-note' }, [
          el('td', { colspan: 5 }, [
            pensionWithoutCreditMessage(withoutCreditEffect),
            ...lawEntriesFor(scenario, withoutCreditEffect.basis_rule_ids).flatMap((entry) => [
              ' ',
              el('span', { class: 'law-chip' }, [entry.law]),
            ]),
          ]),
        ]),
      );
    }
  }
  if (plan.unallocated_annual_krw > 0) {
    rows.push(
      el('tr', { class: 'table-row-warning' }, [
        el('td', {}, ['미배분']),
        el('td', { class: 'type-num' }, [formatKrw(plan.unallocated_monthly_krw)]),
        el('td', { class: 'type-num' }, [formatKrw(plan.unallocated_annual_krw)]),
        el('td', {}, ['—']),
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
        el('tr', { class: 'table-row-note' }, [el('td', { colspan: 5 }, [breakdownMessage])]),
      );
    }
  }
  const transferLimit = scenario.isa_transfer_extra_limit;
  if (transferLimit) {
    rows.push(
      el('tr', {}, [
        el('td', { colspan: 5 }, [
          `ISA 전환에 따른 추가 공제 한도 ${formatKrw(transferLimit.extra_credit_limit_krw)} — 위 연금저축·IRP 배분에 반영됨`,
        ]),
      ]),
    );
  }
  // 좁은 화면에서 다섯 칸을 욱여넣으면 헤더 글자가 한 자씩 세로로 쪼개진다
  // (실측). 열을 지우지 않고 가로 스크롤로 옮긴다 — 근거 조항 열을 지우면
  // 헌장 고지 요소 3이 그 표에서 사라진다.
  return el('div', { class: 'account-table-scroll' }, [
    el('table', { class: 'account-table' }, [
      el('thead', {}, [el('tr', {}, ['계좌', '월 배분', '연 환산', '납입 잔여 한도 대비', '적용 조항'].map((h) => el('th', {}, [h])))]),
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
// 3. 고지 배너(요소 ①②)는 이 절의 대상이 아니다 — `disclosureBanner()`는
//    별도 함수로 항상 렌더된다.
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
    // 이 가정이 **어느 요건에 걸리는지**를 엔진이 규칙 id로 지목하면, 그 요건의
    // 조항을 항목 옆에 붙인다(헌장 고지 요소 3 · 계약 5.7절의 두 방향 연결).
    // **화면이 요건 이름을 지어내지 않는다** — `legal_basis`에 실린 것만 그린다.
    // 지목이 없거나 그 규칙이 이 시나리오의 근거 목록에 없으면 아무것도 그리지
    // 않는다(값이 없으면 그 줄을 그리지 않는 규약).
    const affected = lawEntriesFor(scenario, a.params?.requires_reference_date_rule_ids ?? []);
    // 기준 과세연도는 엔진이 `echo`로 이미 되돌려 준 값이다. 문구가 그것을 쓰고
    // 싶을 때 쓸 수 있게 넘기되, **엔진이 실은 `params`가 언제나 이긴다** —
    // 화면이 엔진의 값을 덮어쓰는 경로를 만들지 않는다.
    const params = { tax_year: response.echo?.tax_year, ...a.params };
    entries.push({
      code: a.code,
      node: affected.length ? [assumptionMessage(a.code, params), lawChipRow(affected, 'note-laws')] : assumptionMessage(a.code, params),
    });
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

/**
 * 법령 조항의 "중요한 5개" — 이 배분안의 헤드라인 세액공제액(`deterministic_
 * benefit`)을 뒷받침하는 조항을 최우선으로, 그다음 계좌별 납입 한도를 뒷받침
 * 하는 조항, 나머지는 원래 순서를 지킨다. 판정하지 않는다 — 엔진이 이미 실어
 *보낸 `basis_rule_ids` 지목을 읽어 정렬만 한다.
 */
function lawEntryTier(entry, headlineRuleIds, limitRuleIds) {
  if (headlineRuleIds.has(entry.rule_id)) return 0;
  if (limitRuleIds.has(entry.rule_id)) return 1;
  return 2;
}

function basisBlock(scenario, plan) {
  const headlineRuleIds = new Set(plan?.deterministic_benefit?.basis_rule_ids ?? []);
  const limitRuleIds = new Set((scenario?.limits?.by_account ?? []).flatMap((l) => l.basis_rule_ids ?? []));
  const { primary, rest } = splitTopFive(scenario.legal_basis, (entry) => lawEntryTier(entry, headlineRuleIds, limitRuleIds));

  const row = (entry) =>
    el('li', {}, [
      el('span', { class: 'law-chip' }, [entry.law]),
      ` ${entry.title} · ${entry.effective_from} 시행`,
      entry.bill_stage ? el('span', { class: 'proposed-badge' }, [`정부안 · 국회 통과 전`]) : null,
      el('a', { href: entry.url, target: '_blank', rel: 'noopener', class: 'law-link' }, ['원문']),
    ]);

  return el('details', { class: 'basis-block' }, [
    el('summary', { class: 'block-summary type-title-m' }, [
      el('span', { class: 'block-summary-chevron', 'aria-hidden': 'true' }, ['▸']),
      `법령 조항 ${scenario.legal_basis.length}건 · ${scenario.ruleset.tax_year} 과세연도 기준`,
    ]),
    el('ul', {}, primary.map(row)),
    moreItemsDisclosure(rest.map(row), '이 배분안의 세액공제액·납입 한도를 직접 뒷받침하지 않는 조항 위주'),
  ]);
}

function limitNote() {
  return el(
    'div',
    { class: 'limit-note' },
    DISCLOSURE.limit.map((line) => el('p', {}, [line])),
  );
}

function saveShareBlock(store, plan, scenario) {
  return el('div', { class: 'save-share' }, [
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-secondary',
        onclick: () =>
          openShareModal({
            plan,
            scenario,
            onExport: () => store.reportSaveShare('screenshot'),
          }),
      },
      ['공유용 이미지 만들기'],
    ),
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

function resultPanelForScenario(
  response,
  scenario,
  activePlanId,
  store,
  onSelectPlan,
  { conditionalPending = false, form = {}, seatDraw = 'donut' } = {},
) {
  const plan = scenario.plans.find((p) => p.plan_id === activePlanId) ?? scenario.plans[0];
  const showAllExitBanner = scenario.comparison_note_codes.includes('all_accounts_have_early_exit_penalty');
  const reorderNote = scenario.comparison_note_codes.includes('baseline_reordered_by_fund_use_horizon');

  return el('div', { class: 'result-body' }, [
    amountCard(plan, scenario),
    // 표시된 숫자 바로 옆에서 말한다 — 배너만으로는 금액을 보는 사용자의 눈에
    // 안 들어온다(3.5절 "아래 결과에는 아직 반영되지 않았다는 표시를 함께 둔다").
    conditionalPending ? el('p', { class: 'stale-caption' }, [CONDITIONAL_PENDING_STALE_CAPTION]) : null,
    creditRateFallbackBanner(response.echo?.credit_rate_bracket),
    showAllExitBanner ? allExitPenaltyBanner() : null,
    proposedScenarioCaption(scenario),
    chartArea(plan, scenario, response.echo.months_remaining_in_tax_year, {
      seatDraw,
      // 5.1.0(D28) — "무엇을 주었는가"(echo)와 "무엇을 썼는가"(estimate)를 한
      // 칸에 뭉치지 않는다. 정산 기간은 estimate에서, 수익률·소득 성격은
      // echo에서 읽어 같은 캡션에 함께 적는다(계약 4.2절).
      isaReturnAssumption: response.echo.isa_return_assumption,
    }),
    fillOrderNote(plan, scenario),
    reorderNote ? el('p', { class: 'field-help' }, [comparisonNoteMessage('baseline_reordered_by_fund_use_horizon')]) : null,
    stackBarComparison(scenario, plan.plan_id, onSelectPlan),
    accountTable(plan, scenario),
    assumptionBlock(response, scenario, form),
    basisBlock(scenario, plan),
    limitNote(),
    saveShareBlock(store, plan, scenario),
  ]);
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
        [s.scenario_id === 'current' ? '확정 세법 기준' : el('span', {}, ['개정안(정부안) 반영', el('span', { class: 'proposed-badge' }, ['정부안 · 국회 통과 전'])])],
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// 상태 오케스트레이션 — 다섯 상태를 여기서 갈라 렌더한다.
// ---------------------------------------------------------------------------

let uiSelection = { scenarioId: 'current', planId: null };

// ---------------------------------------------------------------------------
// 결과 자리의 전환 상태 (design-system 5.29절)
//
// 판단은 `nextSeatStep`(순수 함수)이 하고 여기서는 그 결과를 기억하고 타이머를
// 건다. 상태를 이 모듈에 두는 이유: 자리표시자 → 결과 전환은 **한 번만** 일어나는
// 사건이라 store의 상태에서 파생되지 않는다(같은 `status === 'result'`가 첫 번째
// 계산인지 열 번째인지 상태만으로는 알 수 없다).
// ---------------------------------------------------------------------------

let seatShape = null; // 직전에 실제로 그린 도형
let seatPhase = 'idle';

function planSeat(desired) {
  const step = nextSeatStep({ desired, lastShape: seatShape, phase: seatPhase, reducedMotion: prefersReducedMotion() });
  seatPhase = step.phase;
  seatShape = shapeOf(step.draw);
  if (step.scheduleFadeMs != null) {
    // 링이 사라진 **다음 프레임에** 도넛을 그린다. 겹치는 프레임이 없다.
    setTimeout(() => {
      seatPhase = 'entering';
      rerenderHook();
    }, step.scheduleFadeMs);
  }
  return step.draw;
}

export function renderResultPanel({ state, store }) {
  const { status, result, fatalError } = state;

  if (status === 'fatal_error') {
    planSeat('none');
    return fatalErrorPanel(fatalError);
  }
  if (status === 'blocked') {
    planSeat('none');
    return blockedPanel(fatalError, store);
  }
  if (status === 'blank' || status === 'input_incomplete') {
    planSeat('placeholder');
    return inputIncompletePanel(state);
  }

  // loading / field_error / result — 직전 결과를 유지한다는 규약(design-system 6.1)
  if (!result) {
    // 첫 계산이 아직 끝나지 않은 로딩 상태. **자리표시자를 그대로 둔다** — 결과
    // 자리를 비우면 ① 레이아웃이 한 번 접혔다 펴지고 ② 자리표시자 → 결과 전환의
    // 두 끝이 붙어 있지 않게 되어 5.29절의 전환 자체가 성립하지 않는다.
    planSeat('placeholder');
    return el('div', { class: `result-panel-inner ${loadingOverlayClass(false)}` }, [
      disclosureBanner(),
      el('div', { class: 'result-body' }, [
        resultPlaceholder(),
        el('p', { class: 'type-body-s chart-note' }, ['계산 중입니다…']),
      ]),
    ]);
  }

  const scenarioId = result.scenarios.some((s) => s.scenario_id === uiSelection.scenarioId) ? uiSelection.scenarioId : 'current';
  const scenario = result.scenarios.find((s) => s.scenario_id === scenarioId);
  const planId = scenario.plans.some((p) => p.plan_id === uiSelection.planId) ? uiSelection.planId : scenario.plans[0].plan_id;

  const onSelectScenario = (id) => {
    uiSelection = { scenarioId: id, planId: null };
    rerenderHook();
  };
  const onSelectPlan = (id) => {
    if (id !== scenario.plans[0].plan_id) store.reportAlternativeClick();
    uiSelection = { scenarioId, planId: id };
    rerenderHook();
  };

  // Q2 — 조건부 필수 항목(전환 금액)이 비면 결과는 갱신되지 않는데 화면에 단서가
  // 하나도 없었다. `screens.md` 3.5절이 정한 처리: **직전 결과를 지우지 않고**
  // 상단에 `InlineAlert(info)`를 띄우고, 아래 결과가 아직 그 입력을 반영하지
  // 않았다는 표시를 함께 둔다. 오류 색이 아니라 info다 — 사용자가 무언가를
  // 망가뜨린 것이 아니라 아직 덜 채운 것이다.
  const conditionalPending = Boolean(state.validation?.conditionalPending);
  const seatDraw = planSeat('donut');
  const body = resultPanelForScenario(result, scenario, planId, store, onSelectPlan, {
    conditionalPending,
    form: state.form,
    seatDraw,
  });

  const wrapperClass =
    status === 'loading' ? 'result-panel-inner result-loading-overlay' : status === 'field_error' ? 'result-panel-inner' : 'result-panel-inner';

  return el('div', { class: wrapperClass }, [
    disclosureBanner(),
    status === 'field_error' ? fieldErrorBanner(store) : null,
    conditionalPending ? conditionalPendingAlert() : null,
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
