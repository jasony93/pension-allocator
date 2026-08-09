/**
 * 문구 사전. `engine-interface.md` 7절: "엔진은 사용자에게 보이는 문장을 만들지
 * 않는다. `web-dev`는 code를 키로 하는 문구 사전을 화면 쪽에 두고 params로
 * 채운다." — 이 파일이 그 사전이다.
 *
 * 헌장의 세무사법 문구 정책(쓸 수 없는/조건부/쓸 수 있는 어휘)과
 * `screens.md`·`design-system.md` 7절의 문구 규약을 여기서 지킨다. 세법 수치는
 * 어디에도 하드코딩하지 않는다 — 금액·연수가 필요한 문구는 전부 `params`에서
 * 채운다(엔진의 `fund_use_horizon_boundaries`, `legal_basis`, 각 필드의 실제 값).
 */

import { formatKrw, formatPercent, formatYears } from './format.js';

export const SERVICE_NAME = '[가칭] 납입배분 계산기';

// ---------------------------------------------------------------------------
// 계좌 이름 · 배분안 이름
// ---------------------------------------------------------------------------

export const ACCOUNT_LABEL = {
  annuity_savings: '연금저축',
  retirement_pension: 'IRP',
  isa: 'ISA',
};

export const PLAN_LABEL = {
  max_tax_credit: '세액공제액이 가장 큰 배분',
  annuity_savings_first: '연금저축을 먼저 채우는 배분',
  isa_first: 'ISA를 먼저 채우는 배분',
};

export const FUND_USE_HORIZON_LABEL = {
  within_isa_lock_in: '비교적 이른 시기에 쓸 수도 있다',
  before_pension_age: '중간에 쓸 계획이다',
  at_or_after_pension_age: '연금 수령 나이까지 둘 수 있다',
  unknown: '아직 모르겠다',
};

export const FUND_USE_HORIZON_DESCRIPTION = {
  within_isa_lock_in: 'ISA 의무가입기간 안에 해지할 가능성이 있다',
  before_pension_age: '연금 수령을 시작할 수 있는 나이 전에 쓸 생각이다',
  at_or_after_pension_age: '',
  unknown: '이 경우 중도 인출 관련 규칙을 판정하지 않고 참고로만 보여줍니다',
};

// ---------------------------------------------------------------------------
// 오류 코드 (8.1)
// ---------------------------------------------------------------------------

const ERROR_MESSAGE = {
  schema_version_mismatch: () => '계산 엔진 버전이 맞지 않습니다. 새로고침 후 다시 시도해 주세요.',
  missing_required: () => '값이 필요합니다.',
  not_integer: () => '정수 값이 필요합니다.',
  negative_value: () => '0 이상의 값이 필요합니다.',
  out_of_range: () => '허용 범위를 벗어난 값입니다.',
  invalid_enum: () => '유효하지 않은 선택지입니다.',
  isa_transfer_exceeds_cumulative: () => 'ISA 만기 전환 금액이 ISA 누적 납입액을 초과합니다.',
  isa_ytd_exceeds_cumulative: () => 'ISA 당해연도 납입액이 누적 납입액을 초과합니다.',
  empty_scenarios: () => '계산할 시나리오가 없습니다.',
  unknown_scenario: () => '알 수 없는 시나리오입니다.',
  unknown_plan_variant: () => '알 수 없는 배분안입니다.',
  ruleset_load_failed: () => '계산에 필요한 세법 규칙을 불러오지 못했습니다.',
  rule_missing: (params) => `계산에 필요한 규칙(${params.rule_id})을 찾을 수 없습니다.`,
};

export function errorMessage(error) {
  const fn = ERROR_MESSAGE[error.code];
  return fn ? fn(error.params ?? {}) : '입력값을 확인해 주세요.';
}

// ---------------------------------------------------------------------------
// 안내 코드 (8.2) — Notice
// ---------------------------------------------------------------------------

const NOTICE_MESSAGE = {
  zero_capacity: () => '월 납입 여력이 0원으로 입력되어 배분할 금액이 없습니다.',
  budget_exceeds_all_limits: () =>
    '입력한 월 납입 여력이 이번 계산에서 배분할 수 있는 금액보다 많습니다. 남는 금액은 어느 계좌에도 배분되지 않았습니다.',
  existing_contribution_over_limit: () =>
    '이미 입력한 기납입액이 관련 한도를 넘어, 그 항목의 남은 금액을 0으로 계산했습니다.',
  prior_year_income_missing: () => '직전 과세기간 총급여액을 받지 않아 ISA 비과세 한도 구간의 교차확인을 하지 않았습니다.',
  isa_type_conflicts_with_prior_income: () => '입력한 ISA 계좌 유형이 직전 과세기간 소득 기준 판정과 다릅니다. 계산은 입력한 유형을 그대로 따랐습니다.',
  isa_type_not_declared: () => 'ISA 계좌 유형을 입력하지 않아 비과세 한도 표시를 생략했습니다.',
  isa_tenure_missing: () => 'ISA 가입 시기를 받지 않아 남은 의무가입기간을 가장 길게 잡았습니다.',
  financial_income_status_unknown: () => '금융소득종합과세 대상 여부를 받지 않아 ISA 배제 규칙을 적용하지 않았습니다.',
  isa_excluded_financial_income_taxpayer: () => '금융소득종합과세 대상자에 해당해 ISA를 배분 대상에서 제외했습니다.',
  isa_excluded_age: () => 'ISA 가입에 필요한 연령 요건에 해당하지 않아 ISA를 배분 대상에서 제외했습니다.',
  pension_age_not_evaluated: () => '연금계좌의 최소 가입 연령 요건은 판정 대상 규칙이 없어 확인하지 않았습니다.',
  youth_status_not_declared: () => '청년 우대 대상 여부를 받지 않아 개정안 시나리오의 청년 우대를 적용하지 않았습니다.',
  youth_age_range_undetermined: () => '청년 우대 연령 범위가 시행령 미공개로 확정되지 않았습니다.',
  proposed_transfer_cap_period_input_missing: () => '개정안의 넓어진 차감 기간에 해당하는 금액을 받지 않아 직전 1개 과세기간 값으로 대신했습니다.',
  proposed_not_enacted: () => '이 시나리오는 아직 국회를 통과하지 않은 개정안을 반영한 계산입니다.',
  plans_collapsed_single: () => '입력한 조건에서는 비교할 다른 배분이 나오지 않았습니다.',
  fund_use_horizon_not_declared: () => '자금 사용 시점을 밝히지 않아 중도 인출 관련 규칙이 걸리는지 판정하지 않았습니다.',
  pension_holding_period_not_evaluated: () => '연금계좌 가입 경과연수를 받지 않아 보유기간 요건은 판정하지 않았습니다.',
};

export function noticeMessage(notice) {
  const fn = NOTICE_MESSAGE[notice.code];
  return fn ? fn(notice.params ?? {}) : notice.code;
}

// ---------------------------------------------------------------------------
// 가정 코드 (8.3) — `[4-E]` AssumptionBlock. screens.md 4.5절의 문구를 그대로 쓴다.
// "무엇을 묻지 않았는가 → 그래서 어떻게 계산했는가" 형태를 유지한다.
// ---------------------------------------------------------------------------

const ASSUMPTION_MESSAGE = {
  months_remaining_defaulted: () => '과세연도 전체를 납입한다고 보고 연간 예산을 계산했습니다. 연중에 시작하면 실제 납입액은 이보다 적습니다.',
  isa_new_account_assumed: () => 'ISA 계좌가 없다고 하셔서 신규 가입을 전제로 납입 잔여 한도를 계산했습니다.',
  isa_tenure_zero_assumed: () => 'ISA 가입 시기를 받지 않아, 남은 의무가입기간을 가장 길게 잡았습니다. 실제로는 이보다 짧을 수 있습니다.',
  other_savings_zero_assumed: () => '재형저축·장기집합투자증권저축을 보유하지 않은 것으로 보고 ISA 총 납입한도를 계산했습니다.',
  prior_transfer_credit_zero_assumed: () => '직전 과세기간에 받은 전환 추가공제를 0으로 보았습니다. 실제로 받은 금액이 있으면 추가 한도가 결과보다 줄어듭니다.',
  single_tax_year_only: (params) => `${params.tax_year ?? ''} 과세연도 하나만 계산했습니다. 다음 해 이후는 반영하지 않았습니다.`,
  other_deductions_excluded: () => '연말정산의 다른 소득공제·세액공제(부양가족 등)는 반영하지 않았습니다.',
  rounding_floor_to_won: () => '원 미만은 버려서 계산했습니다.',
  isa_benefit_not_quantified: () => '투자 수익률과 계좌 운용 결과는 계산에 포함되지 않았습니다.',
  fund_use_horizon_excluded_from_amounts: () => '자금 사용 시점은 배분 금액과 세액공제액에 반영하지 않았습니다. 배분안의 순서와 안내에만 쓰였습니다.',
  early_exit_penalty_not_quantified: () => '중도 인출·해지 시의 세부담은 금액으로 계산하지 않았습니다.',
  pension_holding_period_not_evaluated: () => '연금계좌 가입 경과연수를 받지 않아 보유기간 요건은 판정하지 않았습니다.',
  // 화면이 직접 만드는 조건부 항목(엔진 notice가 아니라 입력 상태에서 파생) —
  // screens.md 4.5절 표의 나머지 행.
  isa_account_type_defaulted: () => 'ISA 계좌 유형을 일반형으로 두고 계산했습니다. 서민형이면 비과세 한도가 달라집니다.',
  isa_not_held_excluded: () => 'ISA 계좌가 없다고 하셔서 ISA를 배분 대상에서 제외하고 계산했습니다.',
  transfer_destination_defaulted: () => '전환한 자금을 받을 계좌를 IRP로 두고 계산했습니다. 연금저축으로 받으면 적용되는 단독 한도가 달라 결과가 바뀝니다.',
  existing_contribution_untouched: () => '올해 이 계좌들에 이미 넣은 금액을 0으로 두고 계산했습니다. 이미 납입한 금액이 있으면 납입 잔여 한도가 줄어 배분이 결과와 달라집니다.',
};

export function assumptionMessage(code, params) {
  const fn = ASSUMPTION_MESSAGE[code];
  return fn ? fn(params ?? {}) : code;
}

// ---------------------------------------------------------------------------
// 경고 코드 (8.4) — Plan.warnings. screens.md 4.7절: 사실 서술, 2인칭 지시·느낌표
// ·"손해"·"위험" 금지. `info`는 문두가 붙는다.
// ---------------------------------------------------------------------------

const WARNING_BODY = {
  early_withdrawal_penalty_pension: (params) =>
    `이 계좌에서 연금 수령 개시 연령 전에 인출하면 연금외수령으로 기타소득세가 적용되는 규칙이 있습니다.${
      params.pension_years_remaining != null ? ` 그 나이까지 ${formatYears(params.pension_years_remaining)}.` : ''
    }`,
  early_termination_clawback_isa: (params) =>
    `이 계좌를 의무가입기간 안에 해지하면 감면받은 세액을 추징하는 규칙이 있습니다.${
      params.isa_lock_in_years_remaining != null ? ` 남은 의무가입기간 ${formatYears(params.isa_lock_in_years_remaining)}.` : ''
    }`,
};

const INFO_PREFIX = '자금 사용 시점을 밝히지 않아 판정하지 않았습니다 — ';

export function warningMessage(warning, boundaries) {
  const params = { ...warning.params, ...boundaries };
  const body = WARNING_BODY[warning.code] ? WARNING_BODY[warning.code](params) : warning.code;
  return warning.trigger === 'horizon_unknown' ? `${INFO_PREFIX}${body}` : body;
}

// ---------------------------------------------------------------------------
// 계좌 배제 사유 (`AccountEligibility.reason_codes`)
//
// 4단계 검증 관찰 O1의 화면 처리. 배제된 계좌에는 한도·혜택 금액 대신 이 문장이
// 들어간다. 문구 규약은 `screens.md` 4.7절의 중도 불이익 안내와 같다 —
// **주어는 사용자가 아니라 법령이고, 사실 서술로 끝낸다.** "가입하세요"·"다른
// 계좌를 고려하세요" 같은 지시형, "손해"·"위험"·느낌표를 쓰지 않는다.
// 사유 옆에는 호출부가 `basis_rule_ids`의 `LawChip`을 붙인다(헌장 고지 요소 3,
// `screens.md` 8.4(b) "차단 사유에 반드시 LawChip을 붙인다").
// ---------------------------------------------------------------------------

const EXCLUSION_REASON_MESSAGE = {
  isa_excluded_age: () => 'ISA 가입에 필요한 연령 요건에 해당하지 않아 이번 계산의 배분 대상이 아닙니다.',
  isa_excluded_financial_income_taxpayer: () =>
    '직전 3개 과세기간 중 금융소득종합과세 대상이었던 경우 ISA 과세특례가 적용되지 않습니다. 그래서 이번 계산의 배분 대상이 아닙니다.',
};

export function exclusionReasonMessage(code) {
  const fn = EXCLUSION_REASON_MESSAGE[code];
  return fn ? fn() : code;
}

/** 배제 사유 코드가 하나도 없을 때의 대체 문장(계약상 있어야 하지만 비어 올 수 있다). */
export const EXCLUDED_ACCOUNT_FALLBACK_REASON = '이 계좌는 입력한 조건에서 배분 대상이 아닙니다.';

/** 한도·혜택 금액이 있어야 할 자리에 대신 들어가는 문장. */
export const EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER = '배분 대상 아님';

/** C-3 스택바 영역 위 한 줄 — 배제는 배분안마다 달라지지 않고 시나리오 전체에 걸린다(5.9절). */
export function excludedFromComparisonMessage(accounts) {
  const names = accounts.map((a) => ACCOUNT_LABEL[a] ?? a).join(' · ');
  return `${names}는 이번 계산에서 배분 대상이 아니어서 아래 비교에 나타나지 않습니다.`;
}

// ---------------------------------------------------------------------------
// 두 종류의 한도 (screens.md 5.10절 · design-system 7.1절)
//
// **"잔여 한도"를 수식어 없이 쓰지 않는다.** 성격이 다른 한도가 둘이다 —
// 넘을 수 없는 `납입 잔여 한도`(`contribution_limit_remaining_krw`)와, 넘을 수
// 있는 `세액공제 인정 여지`(`credit_eligible_limit_remaining_krw` ·
// `pension_combined_credit_remaining_krw`)다. 후자에 "한도"를 붙이면 사실과
// 어긋난다 — 개정안 청년 우대에서 배분액이 그 값을 넘을 수 있다.
// ---------------------------------------------------------------------------

export function contributionRemainingCaption(remainingKrw, usedRatio) {
  return `납입 잔여 한도 ${formatKrw(remainingKrw)} · 이 중 ${formatPercent(usedRatio)} 사용`;
}

export function creditHeadroomCaption(amountKrw) {
  return `세액공제가 더 인정될 수 있는 금액 ${formatKrw(amountKrw)} (연금저축·IRP 합산)`;
}

/** 배분액이 위 금액을 넘을 때 — 감추지 않고 왜 그런지 적는다(5.10절 (3)). */
export const CREDIT_HEADROOM_EXCEEDED_CAPTION =
  '이 배분은 그 금액을 넘습니다 — 추가 납입이 이미 인정된 다른 계좌의 납입분을 공제 대상에서 밀어내고, 밀려난 만큼에 더 높은 공제율이 적용되기 때문입니다.';

/** ISA 비과세 한도 (5.11절) — 한도이지 절감액이 아니다. 헤드라인 절세액에 더하지 않는다. */
export function isaTaxFreeCaption(limitKrw) {
  return `이 계좌의 비과세 한도 ${formatKrw(limitKrw)} — 계좌에서 생긴 수익에 적용됩니다. 수익은 계산하지 않으므로 위 절세액에 들어 있지 않습니다.`;
}

// ---------------------------------------------------------------------------
// 미배분 금액의 사유 (4단계 qa 결함 Q1)
//
// **왜 멈췄는지에 따라 문장이 달라야 한다.** 납입 잔여 한도를 다 채워 멈춘 것과
// 세액공제가 더 붙지 않아 멈춘 것은 사용자에게 전혀 다른 사실이다 — 전자는 더
// 넣을 곳이 없다는 뜻이고, 후자는 넣을 수는 있으나 이번 계산 기준으로 공제
// 이득이 없다는 뜻이다. 한 문장으로 뭉뚱그리면 후자의 사용자는 **더 넣을 수
// 있는데 못 넣는다.**
//
// 문구는 잠정안이다 — 문구 소유권은 `designer`에게 있고 `qa`가 그 사실을
// 리포트에 적었다. 대체 문구가 확정되면 이 사전만 바꾸면 된다.
// ---------------------------------------------------------------------------

const UNALLOCATED_REASON_CLAUSE = {
  contribution_limit: (names) => `${names}는 납입 잔여 한도를 모두 채웠습니다`,
  // 이 절이 Q1의 핵심 — 납입 여지가 남아 있다는 사실을 같은 문장 안에서 말한다.
  credit_limit: (names) => `${names}는 세액공제 대상 납입액을 모두 채웠습니다(납입 잔여 한도는 남아 있습니다)`,
  not_eligible: (names) => `${names}는 이번 계산의 배분 대상이 아닙니다`,
};

const UNALLOCATED_LEAD = '이 배분에 들어가지 않은 금액입니다.';

/** `groups`는 `unallocatedBlockers()`가 낸 `{ reason, accounts }[]`. */
export function unallocatedReasonMessage(groups) {
  const clauses = (groups ?? [])
    .map(({ reason, accounts }) => {
      const clause = UNALLOCATED_REASON_CLAUSE[reason];
      if (!clause || !accounts?.length) return null;
      return clause(accounts.map((a) => ACCOUNT_LABEL[a] ?? a).join('·'));
    })
    .filter(Boolean);
  return clauses.length ? `${UNALLOCATED_LEAD} ${clauses.join(', ')}.` : UNALLOCATED_LEAD;
}

// ---------------------------------------------------------------------------
// 조건부 필수 항목이 비어 있을 때 (4단계 qa 결함 Q2 · screens.md 3.5절)
// ---------------------------------------------------------------------------

export const CONDITIONAL_PENDING_ALERT =
  'ISA 만기 전환을 선택하셨습니다. 전환 금액을 입력하면 추가 공제 한도를 반영해 다시 계산합니다.';

/** 아래 결과가 아직 전환을 반영하지 않았다는 표시(3.5절) — 금액 바로 옆에 둔다. */
export const CONDITIONAL_PENDING_STALE_CAPTION = '아래 결과에는 ISA 만기 전환이 아직 반영되지 않았습니다.';

/**
 * 배분액이 0인 계좌의 C-2 캡션(screens.md 5.4절). 도넛에는 조각이 없으므로
 * (design-system 5.20절 비활성 상태) "그 계좌가 어디 갔는지"를 말하는 자리가
 * 여기와 `[4-D]` 표다. 배분 대상이 아닌 것과는 다른 사실이다 — 이 계좌는
 * 대상이지만 이 배분안이 넣지 않았을 뿐이다.
 */
export const NOT_ALLOCATED_IN_PLAN_CAPTION = '이 배분에서는 배분하지 않음';

/** 조각이 하나뿐인 도넛의 캡션 (5.12절). */
export function donutSingleSliceCaption(account) {
  return `이번 배분은 전액이 ${ACCOUNT_LABEL[account] ?? account}로 갑니다. 계좌별 한도와 남은 여력은 아래에서 볼 수 있습니다.`;
}

export const PROPOSED_BADGE_LABEL = '정부안 · 국회 통과 전';

// ---------------------------------------------------------------------------
// 배분안 비교 안내 (8.5)
// ---------------------------------------------------------------------------

const COMPARISON_NOTE_MESSAGE = {
  plans_collapsed_single: () => '입력한 조건에서는 비교할 다른 배분이 나오지 않았습니다.',
  all_accounts_have_early_exit_penalty: () =>
    '세 계좌 모두 중도 인출·해지 시 적용되는 규칙이 있습니다. 선택하신 자금 사용 시점에서는 어떤 배분으로 나누어도 이 규칙을 피할 수 없습니다. 아래 배분안 비교는 세액공제액 기준이며, 중도 인출 규칙은 배분안에 따라 달라지지 않습니다.',
  baseline_reordered_by_fund_use_horizon: () =>
    '세액공제액이 가장 큰 배분이 기본안이 아닙니다. 자금 사용 시점 선택에 따라 순서가 바뀌었습니다.',
  alternatives_have_equal_tax_credit: () => '둘 이상의 배분안이 같은 세액공제액을 냅니다.',
};

export function comparisonNoteMessage(code) {
  const fn = COMPARISON_NOTE_MESSAGE[code];
  return fn ? fn() : code;
}

// ---------------------------------------------------------------------------
// 고정 문구 — 고지 여섯 요소, 안내, 입력 도움말
// ---------------------------------------------------------------------------

export const DISCLOSURE = {
  nature: '이 화면은 공개된 세법 규칙을 입력값에 적용한 자동 계산 결과이며, 조세에 관한 상담·자문이나 신고 대리가 아닙니다.',
  qualification: '이 서비스의 제공자는 세무사법 제6조에 따른 등록을 한 세무대리인이 아닙니다.',
  limit: [
    '개별 사정(다른 소득·공제 항목, 계좌 개설 시기, 금융기관별 조건 등)에 따라 실제 결과는 달라질 수 있습니다.',
    '실제 신고·납부는 세무사 등 자격을 갖춘 사람에게 확인하시기 바랍니다.',
    '이 계산기는 특정 금융상품이나 금융회사를 다루지 않습니다. 현재 제휴나 광고가 없습니다.',
  ],
};

export const ENTRY_COPY = [
  '왼쪽에 값을 넣으면 ISA · IRP · 연금저축에 각각 얼마씩 넣는 배분을 세법 규칙으로 계산해 오른쪽에 보여줍니다.',
  '계산은 이 브라우저 안에서만 이루어지고 입력값은 어디로도 전송되지 않습니다.',
];

export const EXPECTATION_COPY = [
  'ISA · IRP · 연금저축 세 계좌의 배분안과 대안 비교',
  '각 배분으로 계산된 연간 절세액',
  '계산에 사용한 법령 조항과 기준 과세연도',
];

export const HORIZON_EFFECT_CAPTION = '이 선택은 계산되는 금액을 바꾸지 않습니다. 어떤 배분안을 먼저 보여줄지와 중도 인출 관련 안내만 달라집니다.';
