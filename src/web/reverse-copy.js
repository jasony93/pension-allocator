/**
 * 연금 역산기 탭의 문구 사전. `engine-interface.md` 8.11절: "역산기의 코드를
 * 그 목록(`copy.js`)에 섞으면 첫 탭의 사전이 두 번째 탭의 문장을 지게 된다" —
 * 그래서 이 파일을 첫 탭의 `copy.js`와 분리해 둔다. 코드 레지스트리의 단일
 * 진실 원천은 `src/engine/constants.mjs`의 `REVERSE_NOTICE`·`REVERSE_ASSUMPTION`이고,
 * `reverse-wording.test.mjs`가 그 두 목록을 전건 대조한다 — 코드가 늘었는데
 * 문구가 없으면 그 시험이 붉어진다.
 *
 * 오류 코드(`ERROR`)는 나누지 않는다(계약 8.11절) — `annuity_start_below_minimum_age`
 * 문구는 첫 탭과 공유하는 `src/web/copy.js`의 `ERROR_MESSAGE`에 있다.
 *
 * 헌장의 문구 규약(세무 상담·자문 어휘 금지, 지시형·단정형 금지, 세법 수치
 * 하드코딩 금지)을 그대로 지킨다 — 금액·연수·세율이 필요한 자리는 전부
 * `params`에서 채운다.
 */

import { formatKrw, formatPercentTrimmed, formatYears } from './format.js';

// ---------------------------------------------------------------------------
// 안내 코드 (`REVERSE_NOTICE`, 계약 8.11절) — `notices[]`
// ---------------------------------------------------------------------------

const REVERSE_NOTICE_MESSAGE = {
  reverse_return_rate_not_supplied: () =>
    '평균 수익률을 입력하지 않아 계좌별 월 납입액 시나리오를 계산하지 않았습니다. 법정 사실은 이 값과 무관하게 표시됩니다.',
  reverse_accumulation_period_not_positive: (params) =>
    params.accumulation_months != null && params.accumulation_months <= 0
      ? '오늘부터 연금 개시일까지 남은 기간이 없어 계좌별 월 납입액 시나리오를 계산하지 않았습니다.'
      : '오늘부터 연금 개시일까지 남은 기간이 0 이하로 계산되어 계좌별 월 납입액 시나리오를 계산하지 않았습니다.',
  reverse_target_already_funded: () =>
    '지금 가진 연금계좌 잔액(과 퇴직금 재원)만으로 개시 시점 필요 최소 평가액에 이미 닿아, 추가로 필요한 월 납입액이 0원입니다.',
  reverse_annual_cap_binds_before_balance: (params) =>
    `입력한 연금 필요 기간(${
      params.payout_years != null ? formatYears(params.payout_years) : '입력값'
    })이 짧아, 연금수령한도가 잔액 요건보다 먼저 요구하는 평가액이 더 큽니다.`,
  reverse_exceeds_statutory_contribution_ceiling: () =>
    '역산한 월 납입액의 합계가 세 계좌의 법정 납입 상한을 넘어, 그 초과분은 어느 계좌에도 배분하지 못했습니다.',
  reverse_public_pension_not_supplied: () =>
    '국민연금 등 공적연금 수령 계획을 받지 않아, 원하는 연금 수령액(월) 전부를 사적연금 계좌가 채워야 할 몫으로 보았습니다.',
  reverse_public_pension_covers_target: () =>
    '입력한 국민연금 등 공적연금 예상 월액이 원하는 연금 수령액(월) 이상이라, 사적연금 계좌가 채워야 할 몫을 0원으로 계산했습니다.',
  reverse_public_pension_start_age_not_in_ruleset: () =>
    '공적연금 개시 연령을 정한 규칙이 세법 룰셋에 없어, 공적연금 개시와 연금 개시일 사이의 공백 구간은 계산하지 않았습니다.',
  reverse_other_income_unknown: () =>
    '연금 수령 시기 예상 연금 외 소득을 받지 않아, "문턱 초과 감수" 전략에서 종합과세와 분리과세 중 어느 쪽이 낮은지는 판정하지 않았습니다.',
  reverse_elective_basis_undetermined: () =>
    '분리과세를 선택했을 때의 과세표준을 정하는 세법 룰셋의 계수가 아직 확정되지 않아, 종합과세·분리과세 두 금액은 표시하되 어느 쪽이 더 낮은지는 판정하지 않았습니다.',
  reverse_withholding_rate_varies_within_payout_period: (params) =>
    params.crossing_ages != null && params.crossing_ages.length > 0
      ? `연금 수령 기간 중 만 ${params.crossing_ages.join('세, 만 ')}세를 지나면서 원천징수세율 구간이 바뀝니다. 표시된 세액은 첫 해 기준입니다.`
      : '연금 수령 기간 중 원천징수세율 구간이 바뀝니다. 표시된 세액은 첫 해 기준입니다.',
  reverse_isa_conversion_path_not_open: (params) =>
    params.min_contract_years != null
      ? `ISA 가입경과연수가 연금계좌 전환에 필요한 최소 연수(${formatYears(params.min_contract_years)})에 못 미쳐, 전환 경로가 아직 열리지 않았습니다.`
      : 'ISA 가입경과연수가 연금계좌 전환에 필요한 최소 연수에 못 미쳐, 전환 경로가 아직 열리지 않았습니다.',
  reverse_deferred_retirement_base_rate_out_of_scope: () =>
    '퇴직금(이연퇴직소득)의 감면 비율은 계산했지만, 거기에 곱해지는 퇴직소득세 밑세율은 세법 룰셋 범위 밖이라 금액으로 내지 않았습니다.',
  // 첫 탭과 같은 문자열을 일부러 쓴다(계약 8.11절) — 같은 사실이다.
  isa_tenure_missing: () => 'ISA 가입 후 경과연수를 받지 않아 가장 보수적인 값(0년)으로 계산했습니다.',

  // ── 게이트 5 D78 ④ — ISA 연금 전환 (계약 14.1.1) ──
  reverse_isa_conversion_not_declared: () =>
    'ISA를 연금계좌로 전환할 계획을 답하지 않아, "아니오"와 같은 값으로 계산했습니다. "예"로 답하면 ISA가 개시 시점 재원에 들어가 금액이 달라집니다.',
  reverse_isa_conversion_not_eligible_at_annuity_start: (params) =>
    params.min_contract_years != null
      ? `전환하겠다고 답했지만 연금 개시 시점에도 ISA 가입경과연수가 연금계좌 전환에 필요한 최소 연수(${formatYears(params.min_contract_years)})에 못 미쳐, ISA를 개시 재원에서 제외했습니다.`
      : '전환하겠다고 답했지만 연금 개시 시점에도 ISA 가입경과연수가 연금계좌 전환에 필요한 최소 연수에 못 미쳐, ISA를 개시 재원에서 제외했습니다.',
  reverse_isa_source_capped_by_total_contribution_limit: () =>
    'ISA에 앉힐 수 있는 월 몫은 그 해의 한도가 아니라 ISA 총 납입한도의 남은 몫이 정했습니다.',
  reverse_isa_conversion_threshold_share_not_apportioned: () =>
    'ISA 전환금은 문턱을 쓰지 않는 금액이지만, 그 금액이 매년 수령액의 어느 몫인지를 정하는 규칙이 세법 룰셋에 없어 문턱에 세어지는 금액을 줄이지 않았습니다.',
};

export function reverseNoticeMessage(notice) {
  const fn = REVERSE_NOTICE_MESSAGE[notice.code];
  return fn ? fn(notice.params ?? {}) : notice.code;
}

// ---------------------------------------------------------------------------
// 가정 코드 (`REVERSE_ASSUMPTION`, 계약 8.11절) — `assumptions[]`
// ---------------------------------------------------------------------------

const REVERSE_ASSUMPTION_MESSAGE = {
  reverse_zero_growth_for_statutory_cap: () =>
    '연금수령한도 판정과 개시 시점 필요 최소 평가액은 수익률을 0(무성장)으로 고정해 계산했습니다. 입력한 평균 수익률은 이 값에 영향을 주지 않습니다.',
  reverse_level_annual_withdrawal_assumed: () => '연금 필요 기간 동안 매년 같은 금액을 받는다고 보고 계산했습니다.',
  reverse_first_withdrawal_year_index_assumed: () =>
    '연금수령연차의 기산연차를 1년차로 보고 계산했습니다. 2013년 3월 1일 이전에 가입한 연금계좌라면 기산연차가 달라 첫 해 한도가 다르게 계산될 수 있습니다.',
  reverse_monthly_compounding: () => '적립 기간의 복리 계산은 월 복리로 통일했습니다.',
  reverse_return_rate_user_supplied: (params) =>
    params.annual_return_rate != null
      ? `계좌별 월 납입액은 입력한 연 수익률 ${formatPercentTrimmed(params.annual_return_rate)}을 그대로 계산에 넣은 값입니다. 이 수익률은 이 서비스가 제시한 값이 아닙니다.`
      : '계좌별 월 납입액은 입력한 연 수익률을 그대로 계산에 넣은 값입니다. 이 수익률은 이 서비스가 제시한 값이 아닙니다.',
  reverse_deferred_retirement_not_grown: () => '퇴직금(이연퇴직소득) 재원은 성장 없이 지금 금액 그대로 목표에서 뺐습니다.',
  reverse_lower_bounds_rounded_up: () => '개시 시점 필요 최소 평가액과 필요 월 납입액의 원 미만은 올려서 계산했습니다.',
  reverse_isa_cumulative_contribution_zero_assumed: () =>
    'ISA 누적 납입액을 받지 않아 0으로 보고 ISA 그 해의 납입 한도를 계산했습니다. 실제 누적 납입액이 있으면 한도는 이보다 작을 수 있습니다.',
  // ── 게이트 5 D78 ④ — ISA 연금 전환 (계약 14.1.1) ──
  reverse_isa_contract_held_to_annuity_start: () =>
    'ISA 계약이 연금 개시 시점까지 유지되다가 그때 연금계좌로 전환된다고 보고 계산했습니다. 계약 만료·중도해지·재가입은 반영하지 않았습니다.',
  reverse_isa_total_limit_spread_over_accumulation: () =>
    'ISA 총 납입한도의 남은 몫을 적립 개월수로 균등하게 나눠 ISA의 월 몫을 계산했습니다. 세법이 정한 나눗셈이 아니라 이 계산기가 균등 납입을 가정한 것입니다.',
  // 이 코드는 관리자가 전달한 6건 목록에 없었다 — `src/engine/constants.mjs`를
  // 직접 대조해 찾았다(전건 대조 시험이 잡아냈다). 세액공제 한도만 1단계
  // 상한으로 삼고 §61③ 세액 한도는 적용하지 않았다는 사실을 말한다 — 이
  // 탭이 총급여를 받지 않아 세액 한도를 계산할 수 없기 때문이다.
  reverse_tax_liability_cap_not_applied: () =>
    '개시 시점 필요 최소 평가액을 계산할 때, 세액공제 한도만 적용했습니다. 총급여를 받지 않아 낼 세금 자체의 한도(소득세법 §61③)는 적용하지 않았고, 그 방향은 이 값을 실제보다 크게 잡습니다.',
  reverse_amounts_in_today_currency: () => '이 결과의 모든 금액은 오늘 화폐 기준입니다. 물가상승을 반영한 미래 화폐 환산값이 아닙니다.',
  reverse_annuity_start_date_derived_from_birthday: () =>
    '연금 개시 시점은 입력한 연금 개시일이 속한 해의 생일로 계산했습니다.',
};

export function reverseAssumptionMessage(code, params) {
  const fn = REVERSE_ASSUMPTION_MESSAGE[code];
  return fn ? fn(params ?? {}) : code;
}

// ---------------------------------------------------------------------------
// 배분 근거 코드 (`REVERSE_FILL_BASIS`·`REVERSE_FILL_ORDER_VARIANT`, 계약
// `Allocation.fill_steps[].basis_code`·`contribution_scenario.fill_order.
// variant_code`, `14.2.0`, D78 ④ 후속·`tax-rules-report.md` 32절) —
// `Allocation.fill_steps[]`·`ContributionScenario.fill_order`.
//
// **세법이 이 순서를 정한다는 뜻을 쓰지 않는다.** 조문이 고정하는 것은
// 각 한도의 크기와 소멸 여부뿐이고, 어느 몫을 먼저 채울지는 그 위에 선
// 제품 결정이다(32.5·32.6절 1번) — 첫 탭의 `fillOrderFactMessage`/
// `fillOrderDecisionMessage`(`copy.js`)가 사실과 제품 판단을 문장으로
// 가르는 것과 같은 원칙을 여기서도 "조문이 고정한 사실이 이 방향을
// 지지한다" 수준까지만 쓰는 것으로 지킨다 — "세법이 정한다"고는 쓰지
// 않는다.
// ---------------------------------------------------------------------------

const REVERSE_FILL_BASIS_MESSAGE = {
  reverse_fill_credit_limit_expires_with_tax_year: () =>
    '연금계좌 세액공제 한도는 그 해에 쓰지 않으면 사라집니다 — 이 몫을 그 한도 안에서 먼저 채웠습니다.',
  // ISA 전환 계획이 전제라는 사실을 문장 안에 명시한다(관리자 지시).
  reverse_fill_isa_transfer_opens_extra_credit_limit_if_converted: () =>
    'ISA를 연금계좌로 전환할 계획으로 답하셔서, 전환 경로에서 열리는 추가 공제 한도까지 이 몫에 반영했습니다.',
  // "혜택 없음"·"세액공제를 받습니다" 둘 다 금지(32.6절) — 쓸 수 있는 것은
  // "그 해의 세액공제를 낳지 않으나 인출 시 원금이 과세되지 않습니다" 하나뿐이다.
  reverse_fill_no_credit_this_year_but_principal_untaxed_on_withdrawal: () =>
    '이 몫은 그 해의 세액공제를 낳지 않습니다. 다만 인출 시 원금은 과세되지 않습니다.',
};

/** 개별 계좌 행 아래 한 줄로 표시한다(screens.md §14.3.3 갱신 전까지의 임시 자리, 관리자 지시). */
export function reverseFillBasisMessage(code) {
  const fn = REVERSE_FILL_BASIS_MESSAGE[code];
  return fn ? fn() : code;
}

const REVERSE_FILL_ORDER_VARIANT_MESSAGE = {
  // "세법이 순서를 정한다"고 쓰지 않는다 — 순서를 고른 것은 이 계산기이고,
  // 조문이 고정하는 것은 "전환 경로에서 추가 공제 한도가 열린다"는 사실뿐이다.
  isa_before_pension_surplus: () =>
    'ISA 전환 경로에서 추가 공제 한도가 열려 있어, 이 계산기는 그 몫을 연금계좌 초과분보다 먼저 채웠습니다.',
  pension_surplus_before_isa: () =>
    'ISA 전환 경로가 열려 있지 않아, 이 계산기는 종전 순서(연금계좌 초과분을 먼저 채우는 방식)를 그대로 따랐습니다.',
};

/** 배분 순서 변형에 대한 짧은 근거 한 줄 — 배분표 위(또는 아래)에 한 번만 둔다. */
export function reverseFillOrderVariantMessage(code) {
  const fn = REVERSE_FILL_ORDER_VARIANT_MESSAGE[code];
  return fn ? fn() : code;
}

// ---------------------------------------------------------------------------
// 필드 전용 열거형 문구 — 안내·가정 목록에 속하지 않는다(계약 8.11절 "필드 전용 열거형")
// ---------------------------------------------------------------------------

/** `PayoutStrategy.strategy_code` — 카드 제목. 지시형·단정형을 쓰지 않는다(AC-R19). */
export const STRATEGY_TITLE = {
  within_threshold: '문턱 이내 유지',
  exceed_threshold: '문턱 초과 감수',
  isa_supplement: 'ISA 충당',
};

/** `exceed_threshold.lower_option_code` — "낮은 쪽"이지 "권하는 쪽"이 아니다(계약 8.11절). */
export const TAX_OPTION_LABEL = {
  comprehensive: '종합과세',
  separate: '분리과세',
};

/** `minimum_start_balance.binding_code` · `target_feasibility.binding_code`. */
export const BINDING_LABEL = {
  annual_cap: '연금수령한도',
  remaining_balance: '잔액 요건',
};

/** `threshold_consumption.rows[].source_code` — 재원별 문턱 사용 여부 표의 라벨. */
export const SOURCE_LABEL = {
  tax_credited_contribution_and_return: '세액공제 받은 연금저축·IRP분',
  deferred_retirement_income: '퇴직금(이연퇴직소득)분',
  isa_conversion_amount: 'ISA 전환금액분',
};

/** `Allocation.account` — 계좌별 월 납입액 막대의 행 이름. 첫 탭과 같은 이름이다. */
export const REVERSE_ACCOUNT_LABEL = {
  annuity_savings: '연금저축',
  retirement_pension: 'IRP',
  isa: 'ISA',
};

/** 조건절(AC-R15) — "연 {사용자 입력값}%가 유지된다면". 매 행에 반복해서 단다. */
export function returnRateConditionClause(annualReturnRate) {
  return `연 ${formatPercentTrimmed(annualReturnRate)}가 유지된다면`;
}

/** "오늘 화폐 기준" 동반 문구(AC-R24). 모든 금액 표시 옆에 붙는다. */
export const TODAY_CURRENCY_NOTE = '오늘 화폐 기준';

/** 개시 시점 필요 최소 평가액 등 법정 사실 블록의 라벨. */
export const STATUTORY_BLOCK_TITLE = '법정 사실';
export const MINIMUM_START_BALANCE_LABEL = '개시 시점 필요 최소 평가액';
export const LEGAL_SUCCESS_LABEL = '월 수령액의 법정 성립 여부';
export const LEGAL_SUCCESS_HOLDS = '성립함';
export const LEGAL_SUCCESS_FAILS = '성립하지 않음';

/** 2013-03-01 캡션 — design-system 5.34절이 못박은 대로 항상 표시하고 접지 않는다. */
export const PRE_2013_CAPTION_MAIN = '2013년 3월 이후 가입한 연금계좌 기준입니다.';
export const PRE_2013_CAPTION_DETAIL =
  '2013년 3월 1일 이전에 가입한 계좌라면 첫 해 한도가 두 배로 계산되어 이 최소 평가액이 절반까지 낮아질 수 있습니다 — 계좌 개설일을 받지 않아 어느 쪽인지 이 계산기가 판정하지 않습니다.';

/** 연금수령한도가 잔액 요건보다 먼저 무는 경우(AC-R12)의 문장. */
export const CAP_BINDS_FIRST_LINE = '연금수령한도가 잔액 요건보다 먼저 뭅니다';

/** 세 계좌 법정 납입 상한 초과(AC-R17). */
export const CONTRIBUTION_CEILING_EXCEEDED = '이 계획은 세 계좌만으로 달성할 수 없습니다';

/** 계좌별 월 납입액 시나리오가 없을 때(평균 수익률 미입력, AC-R6)의 안내 한 줄. */
export const CONTRIBUTION_SCENARIO_ABSENT_LINE = '연 평균 수익률을 입력하면 계좌별 월 납입액이 여기에 표시됩니다.';
export const CONTRIBUTION_SCENARIO_NEEDED_LINE = '이 계좌에서 추가로 필요한 금액이 없습니다';

/** "문턱 초과 감수" 전략의 유불리 미판정 문장(AC-R10). */
export const EXCEED_THRESHOLD_UNDETERMINED_LINE = '이 판단은 연금 수령 시기의 다른 소득 수준에 따라 달라집니다.';

/** "문턱 초과 감수" 전략 — 분리과세 과세표준의 계수가 룰셋에서 미확정일 때(`elective_basis_undetermined`). */
export const ELECTIVE_BASIS_UNDETERMINED_LINE =
  '분리과세를 선택했을 때의 세액을 정하는 계수가 세법 룰셋에서 아직 확정되지 않아, 어느 쪽이 더 낮은지는 표시하지 않습니다.';

/** "문턱 초과 감수" 전략 — 사적연금 합계가 실제로는 문턱을 넘지 않는 입력일 때. */
export const EXCEED_THRESHOLD_NOT_APPLICABLE_LINE = '이 계획에서는 사적연금 합계가 문턱을 넘지 않습니다.';

/** "ISA 충당" 전략 — 계약 유지 인출은 확정하지 않는다(AC-R20). */
export const ISA_HELD_WITHDRAWAL_UNDETERMINED_LINE =
  '계약을 유지한 채 원금을 초과해 인출하는 경로는 세법 해석이 확정되지 않아, 가능·불가능 어느 쪽도 표시하지 않습니다.';

/**
 * `contract_held_withdrawal.deemed_terminated`가 `null`이 아닐 때(의무가입기간
 * 이전의 원금 초과 인출 — `reason_code`가 없는 경우)만 쓰는 별도 사실 문장.
 * `ISA_HELD_WITHDRAWAL_UNDETERMINED_LINE`과는 다른 질문에 대한 답이다 — 저
 * 문장은 "의무가입기간이 지난 뒤" 인출(해석이 갈리는 자리)을 말하고, 이
 * 함수는 "의무가입기간 이전" 인출(조문이 확정적으로 답하는 자리)을 말한다.
 */
export function isaDeemedTerminationLine(deemedTerminated) {
  return deemedTerminated
    ? '지금 잔액을 초과해 인출하면 해지로 의제됩니다.'
    : '지금 잔액 안에서 인출하면 해지로 의제되지 않습니다.';
}

/** 절세계좌 계산기로의 연결 버튼(AC-R21·AC-R22). */
export const PREFILL_BUTTON_LABEL = '절세계좌 계산기에 반영';
export const PREFILL_CAPTION = '계좌별 배분·평균 수익률·개시일 등 다른 값은 옮기지 않습니다.';

export const RESULT_TITLE = '결과';
export const REVERSE_TAB_LABEL = '연금 역산기';
export const CALCULATOR_TAB_LABEL = '절세계좌 계산기';

export const INPUT_INCOMPLETE_TITLE = '계산에 필요한 값이 아직 남았습니다';
export const WHAT_THIS_SHOWS_TITLE = '이 계산기가 보여주는 것';
export const WHAT_THIS_SHOWS_LINES = [
  '개시 시점 필요 최소 평가액과 그 근거 조문',
  '연 수익률을 입력하면 계좌별 월 납입액 시나리오',
  '세 가지 수령 전략의 법정 사실 비교',
];
export const BROWSER_ONLY_NOTE = '계산은 이 브라우저 안에서만 이루어집니다. 입력값은 전송되지 않습니다.';

/** ISA 연금 전환 계획 여부 — 게이트 5 D78 ④, `requirements.md` 9.1절·AC-R30. */
export const ISA_CONVERSION_LABEL = 'ISA를 연금계좌로 전환할 계획이 있나요?';
export const ISA_CONVERSION_NOT_DECLARED_NOTE =
  'ISA 전환 계획을 밝히지 않아, 계좌별 월 납입액 시나리오에서 ISA를 재원으로 반영하지 않았습니다.';
/**
 * "예"일 때의 효과 고지 캡션. **문턱 금액을 화면 코드에 박지 않는다** —
 * 이미 계산된 결과가 있으면 `statutory_facts.threshold_consumption.threshold_krw`
 * (엔진이 룰셋에서 읽은 값)를 그대로 옮기고, 아직 결과가 없으면(예: 이
 * 필드를 처음 여는 시점) 숫자 없이 사실만 말한다.
 */
export function isaConversionYesEffectCaption(thresholdKrw) {
  return thresholdKrw != null
    ? `전환금이 개시 시점 필요 평가액을 채우는 재원으로 반영되고, ${formatKrw(thresholdKrw)} 문턱을 쓰지 않습니다.`
    : '전환금이 개시 시점 필요 평가액을 채우는 재원으로 반영되고, 사적연금 분리과세 문턱을 쓰지 않습니다.';
}
