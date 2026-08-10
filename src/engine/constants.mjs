// 계약 상수. **세법 수치는 하나도 없다.**
// 여기 있는 숫자는 스키마 버전과 개월수 상한처럼 세법과 무관한 것뿐이다.
// 한도·비율·구간 경계는 전부 data/tax-rules/에서 읽는다.

export const SCHEMA_VERSION = '5.0.0';
export const SUPPORTED_MAJOR = 5;

export const ACCOUNT = {
  ANNUITY: 'annuity_savings',
  PENSION: 'retirement_pension',
  ISA: 'isa',
};

/** engine-interface.md 6.1절의 고정 계좌 순서. */
export const ACCOUNT_ORDER = [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA];

export const SCENARIO = { CURRENT: 'current', PROPOSED: 'proposed' };
export const SCENARIO_ORDER = [SCENARIO.CURRENT, SCENARIO.PROPOSED];

export const PLAN = {
  MAX_CREDIT: 'max_tax_credit',
  ANNUITY_FIRST: 'annuity_savings_first',
  ISA_FIRST: 'isa_first',
  /**
   * D26 — 연금계좌 **납입** 한도를 채우는 안. 세액공제 한도가 아니라 납입 한도가 상한이다.
   * 이름과 `priority_basis.code`가 세액공제를 말하지 않는 것은 의도다: 이 안의 근거는
   * `pension.contribution.annual_limit`과 `pension.contribution.beyond_credit_limit`이고,
   * 세법은 이 안이 유리한지 불리한지를 정하지 않는다. **기본안이 되지 않는다.**
   */
  PENSION_LIMIT_FILL: 'pension_contribution_limit_fill',
};

/**
 * 기본안을 뺀 나머지가 따르는 표준 순서.
 * `PENSION_LIMIT_FILL`이 마지막인 것도 의도다 — `BASELINE_BY_HORIZON`이 어떤 값에서도
 * 이 안을 가리키지 않고, 기본안 후보가 하나도 계산되지 않았을 때의 대체 선택에서도
 * 마지막으로 밀린다.
 */
export const PLAN_ORDER = [PLAN.MAX_CREDIT, PLAN.ANNUITY_FIRST, PLAN.ISA_FIRST, PLAN.PENSION_LIMIT_FILL];

export const FILL_SEQUENCE = {
  [PLAN.MAX_CREDIT]: [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA],
  [PLAN.ANNUITY_FIRST]: [ACCOUNT.ANNUITY, ACCOUNT.PENSION, ACCOUNT.ISA],
  [PLAN.ISA_FIRST]: [ACCOUNT.ISA, ACCOUNT.PENSION, ACCOUNT.ANNUITY],
  [PLAN.PENSION_LIMIT_FILL]: [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA],
};

/**
 * 연금계좌를 **세액공제 대상 한도까지만** 채우는 안의 집합.
 * 여기 없는 안은 납입 한도까지 채우고, 공제를 낳지 않는 납입분이 생긴다.
 */
export const CREDIT_BOUNDED_PLANS = new Set([PLAN.MAX_CREDIT, PLAN.ANNUITY_FIRST, PLAN.ISA_FIRST]);

export const HORIZON = {
  WITHIN_ISA_LOCK_IN: 'within_isa_lock_in',
  BEFORE_PENSION_AGE: 'before_pension_age',
  AT_OR_AFTER_PENSION_AGE: 'at_or_after_pension_age',
  UNKNOWN: 'unknown',
};

export const HORIZONS = Object.values(HORIZON);

export const ISA_ACCOUNT_TYPES = ['general', 'low_income'];
export const TRANSFER_DESTINATIONS = [ACCOUNT.PENSION, ACCOUNT.ANNUITY];

/** 두 연금계좌만 대상이다. ISA에는 연금수령 개시라는 상태가 없다. */
export const PENSION_ACCOUNT_KEYS = [ACCOUNT.PENSION, ACCOUNT.ANNUITY];

/**
 * 연금수령 개시 여부. **boolean이 아니라 세 값짜리 열거형이다.**
 * `unknown`을 `not_started`로 접으면 수령 중인 사용자에게 납입 가능액을 주게 되고,
 * 그 오류의 방향이 과대다(tax-rules-report.md 13.12절 주의 2).
 */
export const ANNUITY_START = {
  NOT_STARTED: 'not_started',
  STARTED: 'started',
  UNKNOWN: 'unknown',
};

export const ANNUITY_START_VALUES = Object.values(ANNUITY_START);

/**
 * 세액 한도를 무엇으로 알았는가. 사용자가 답한 형태를 그대로 나타내는 값이고
 * 엔진이 상태를 추론해 만들지 않는다.
 */
export const PRIOR_TAX_STATE = {
  /** 결정세액 금액을 안다 */
  AMOUNT: 'amount',
  /** 금액은 모르나 "직전 과세연도 결정세액이 0이었다"고 답했다 */
  ZERO: 'zero',
  /** "0이 아니었다"까지만 답했다 — 한도의 크기는 여전히 모른다 */
  NONZERO_AMOUNT_UNKNOWN: 'nonzero_amount_unknown',
  /** 모르겠다 */
  UNKNOWN: 'unknown',
};

export const PRIOR_TAX_STATES = Object.values(PRIOR_TAX_STATE);

/** 한도를 어떻게 얻었는지. `null`이면 한도를 모르는 것이다. */
export const CAP_SOURCE = {
  ADD_BACK: 'determined_tax_add_back',
  DECLARED_ZERO: 'declared_zero',
};

/** 한도를 모른 채 낸 값이 어느 쪽으로 틀리는가. 조문상 방향이 한쪽으로만 열려 있다. */
export const CAP_ERROR_DIRECTION = 'overstated_or_equal';

/**
 * 공제율 구간을 **무엇으로** 판정했는가.
 *
 * `pension.credit.rate.basis_determination`이 정한다 — 본문 기준은 종합소득금액이고
 * 총급여액은 '근로소득만 있는 경우'에만 쓰는 **조건부 대체 기준**이다. 두 기준은
 * 유리한 쪽을 고를 수 있는 관계가 아니고, 총급여액을 종합소득금액으로 환산하는 것도
 * 아니다(환산하면 소괄호가 더 엄격한 구간에서 틀린다).
 */
export const CREDIT_RATE_BASIS = {
  /** 근로소득 외에 합산되는 소득이 없다고 답했다 → 총급여액으로 판정 */
  TOTAL_SALARY: 'total_salary',
  /** 합산되는 다른 소득이 있다고 답했고 금액도 받았다 → 종합소득금액으로 판정 */
  GLOBAL_INCOME: 'global_income',
  /** 금액을 모른다 → 대괄호 안의 예외를 적용하지 않고 본문 구간을 쓴다 */
  STATUTORY_DEFAULT: 'statutory_default',
};

/**
 * 본문 구간을 대체값으로 적용했을 때 결과가 어느 쪽으로 틀리는가.
 * 예외(우대 구간)를 적용하지 않은 것이므로 공제액은 과소이거나 같다.
 */
export const CREDIT_RATE_FALLBACK_DIRECTION = 'understated_or_equal';

/** 개시 가능 시점을 계산하지 못한 이유. */
export const START_DATE_REASON = {
  OPENED_ON_MISSING: 'opened_on_missing',
};

export const MONTHS_IN_TAX_YEAR = 12;

/**
 * 룰셋 어휘. 세법 수치가 아니라 data/tax-rules/ 파일이 스스로 쓰는 status 값이고
 * scripts/org/validate-rules.mjs가 같은 목록을 강제한다.
 */
export const RULESET_STATUS = { CONFIRMED: '확정', PROPOSED: '개정예고' };

/**
 * 룰셋이 계좌를 가리킬 때 쓰는 이름. 이것도 룰셋 어휘이지 세법 수치가 아니다.
 * 여러 규칙의 `conditions`와 `value.by_account`가 이 표기를 쓴다.
 */
export const ACCOUNT_TYPE_IN_RULESET = {
  [ACCOUNT.ANNUITY]: '연금저축계좌',
  [ACCOUNT.PENSION]: '퇴직연금계좌',
};

/** 엔진이 참조하는 규칙 id. 문자열일 뿐 수치가 아니다. */
export const RULE = {
  CREDIT_RATE: 'pension.credit.rate',
  // 10차 조사(D27). 12%/15% 구간을 **무엇으로** 판정하는지를 정하는 규칙이다.
  // 값(비율)은 CREDIT_RATE가 주고, 이 규칙은 그 값을 고르는 축과 순서를 준다.
  CREDIT_RATE_BASIS: 'pension.credit.rate.basis_determination',
  CREDIT_LIMIT_ANNUITY: 'pension.credit.limit.annuity_savings',
  CREDIT_LIMIT_COMBINED: 'pension.credit.limit.combined',
  CREDIT_TRANSFER_EXTRA: 'pension.credit.isa_transfer.extra_limit',
  PENSION_CONTRIBUTION_LIMIT: 'pension.contribution.annual_limit',
  PENSION_WITHDRAWAL_ELIGIBILITY: 'pension.withdrawal.eligibility',
  PENSION_EARLY_WITHDRAWAL_RATE: 'pension.early_withdrawal.other_income_rate',
  PENSION_MIDTERM_RESTRICTION: 'pension.withdrawal.midterm_restriction',
  ISA_ELIGIBILITY: 'isa.eligibility',
  ISA_EXCLUSION_FINANCIAL: 'isa.exclusion.financial_income_taxpayer',
  ISA_TAX_FREE_LIMIT: 'isa.tax_free_limit',
  ISA_EXCESS_RATE: 'isa.excess.separate_tax_rate',
  ISA_LOSS_OFFSET: 'isa.net_income.loss_offset',
  ISA_ACCOUNT_REQUIREMENTS: 'isa.account.requirements',
  ISA_ANNUAL_LIMIT: 'isa.contribution.annual_limit',
  ISA_CLAWBACK: 'isa.early_termination.clawback',
  LOCAL_SURTAX: 'tax.local.personal_income_surtax',

  // 6차 조사(tax-rules-report.md 13절)로 들어온 확정 규칙 6건.
  CREDIT_TAX_CAP: 'pension.credit.tax_liability_cap',
  CREDIT_TAX_CAP_SOURCE: 'pension.credit.tax_liability_cap.source_form',
  CREDIT_UNUSED_CARRYOVER: 'pension.credit.unused.contribution_carryover',

  // 9차 조사(D26). 세액공제 한도를 넘는 연금계좌 납입의 세법상 취급과
  // 그 원금이 인출될 때의 과세. 배분 금액을 바꾸지 않고 **사실**만 준다.
  PENSION_BEYOND_CREDIT_LIMIT: 'pension.contribution.beyond_credit_limit',
  PENSION_NON_DEDUCTED_PRINCIPAL: 'pension.withdrawal.non_deducted_principal',

  CREDIT_EXCLUDED_CONTRIBUTIONS: 'pension.credit.excluded_contributions',
  CONTRIBUTION_AFTER_ANNUITY_START: 'pension.contribution.after_annuity_start',
  PENSION_EARLIEST_START: 'pension.withdrawal.earliest_start',

  // 7차 조사로 들어온 규칙. **값이 아니라 판정 시점을 주는 규칙이고, 그 내용은
  // "단일 기준일은 존재하지 않는다"이다.** 엔진은 이 규칙을 읽어 (a) 기준일이
  // 룰셋에서 나오지 않는다는 사실의 근거로 삼고, (b) 어느 요건이 실제로 기준일을
  // 필요로 하는지를 응답에 싣는다.
  AGE_RECKONING: 'age.reckoning.reference_date',

  PROPOSED_ISA_ANNUAL_LIMIT: 'proposed.isa.annual_contribution_limit',
  PROPOSED_YOUTH_IRP_RATE: 'proposed.pension.credit.youth_irp_rate',
  PROPOSED_TRANSFER_EXTRA: 'proposed.productive_isa.pension_transfer.credit_extra_limit',
};

/**
 * 확정 규칙 ↔ 개정예고 규칙의 대응표 (engine-design.md 5.3절).
 * 룰셋에 supersedes 필드가 없어 엔진이 들고 있는 것이고, **세법 수치는 없다.**
 * 각 쌍은 룰셋이 스스로 적어 둔 상호 참조에서만 도출했다:
 *  - PROPOSED_ISA_ANNUAL_LIMIT.value.current_text / engine_note
 *  - PROPOSED_YOUTH_IRP_RATE.value.contrast_with_current
 *  - PROPOSED_TRANSFER_EXTRA.value.related_confirmed_rule
 */
export const PROPOSED_SUPERSEDES = {
  [RULE.PROPOSED_ISA_ANNUAL_LIMIT]: RULE.ISA_ANNUAL_LIMIT,
  [RULE.PROPOSED_YOUTH_IRP_RATE]: RULE.CREDIT_RATE,
  [RULE.PROPOSED_TRANSFER_EXTRA]: RULE.CREDIT_TRANSFER_EXTRA,
};

/**
 * 개정안 시나리오에서 반영하지 않는 규칙의 사유.
 * 목록에 없는 개정예고 규칙은 out_of_product_scope로 본다 — 새 규칙이 조용히
 * 사라지지 않고 출력에 드러나게 하기 위해서다.
 */
export const UNAPPLIED_REASON = {
  'proposed.productive_isa.youth_income_deduction': 'requires_rule_not_in_ruleset',
  'proposed.isa.contract_period': 'affects_multi_year_only',
  'proposed.isa.sunset': 'affects_multi_year_only',
};

export const DEFAULT_UNAPPLIED_REASON = 'out_of_product_scope';
export const REASON_INPUT_MISSING = 'requires_input_not_collected';

export const PRIORITY_BASIS = {
  [PLAN.MAX_CREDIT]: {
    code: 'tax_credit_maximization',
    basis_rule_ids: [RULE.CREDIT_LIMIT_ANNUITY, RULE.CREDIT_LIMIT_COMBINED],
  },
  [PLAN.ANNUITY_FIRST]: {
    code: 'annuity_savings_limit_first',
    basis_rule_ids: [RULE.CREDIT_LIMIT_ANNUITY],
  },
  [PLAN.ISA_FIRST]: {
    code: 'isa_liquidity_first',
    basis_rule_ids: [RULE.PENSION_WITHDRAWAL_ELIGIBILITY, RULE.PENSION_EARLY_WITHDRAWAL_RATE],
  },
  // **이름이 세액공제를 말하지 않는다.** D17·tie_break 때 세운 "이름이 실제 근거를
  // 말해야 한다"의 연장이다 — 이 안이 채우는 것은 납입 한도이고, 그 납입이 유리한지는
  // 세법이 정하지 않는다(규칙의 not_determined_by_tax_law).
  [PLAN.PENSION_LIMIT_FILL]: {
    code: 'pension_contribution_limit_first',
    basis_rule_ids: [RULE.PENSION_CONTRIBUTION_LIMIT, RULE.PENSION_BEYOND_CREDIT_LIMIT],
  },
};

/** engine-design.md 3.1절 — 기본안은 자금 사용 시점이 정한다. */
export const BASELINE_BY_HORIZON = {
  [HORIZON.AT_OR_AFTER_PENSION_AGE]: PLAN.MAX_CREDIT,
  [HORIZON.UNKNOWN]: PLAN.MAX_CREDIT,
  [HORIZON.BEFORE_PENSION_AGE]: PLAN.ISA_FIRST,
  // 세 계좌 모두 불이익이 걸려 어느 안도 피하지 못한다. 순서로 푼 척하지 않는다.
  [HORIZON.WITHIN_ISA_LOCK_IN]: PLAN.MAX_CREDIT,
};

export const ERROR = {
  SCHEMA_VERSION_MISMATCH: 'schema_version_mismatch',
  MISSING_REQUIRED: 'missing_required',
  NOT_INTEGER: 'not_integer',
  NEGATIVE_VALUE: 'negative_value',
  OUT_OF_RANGE: 'out_of_range',
  INVALID_ENUM: 'invalid_enum',
  INVALID_DATE: 'invalid_date',
  ISA_TRANSFER_EXCEEDS_CUMULATIVE: 'isa_transfer_exceeds_cumulative',
  ISA_YTD_EXCEEDS_CUMULATIVE: 'isa_ytd_exceeds_cumulative',
  EMPTY_SCENARIOS: 'empty_scenarios',
  UNKNOWN_SCENARIO: 'unknown_scenario',
  UNKNOWN_PLAN_VARIANT: 'unknown_plan_variant',
  RULESET_LOAD_FAILED: 'ruleset_load_failed',
  RULE_MISSING: 'rule_missing',
};

export const NOTICE = {
  ZERO_CAPACITY: 'zero_capacity',
  BUDGET_EXCEEDS_ALL_LIMITS: 'budget_exceeds_all_limits',
  EXISTING_OVER_LIMIT: 'existing_contribution_over_limit',
  PRIOR_YEAR_INCOME_MISSING: 'prior_year_income_missing',
  ISA_TYPE_CONFLICT: 'isa_type_conflicts_with_prior_income',
  ISA_TYPE_CROSS_CHECK_INCONCLUSIVE: 'isa_type_cross_check_inconclusive',
  CREDIT_RATE_GLOBAL_INCOME_MISSING: 'credit_rate_global_income_missing',
  ISA_TYPE_NOT_DECLARED: 'isa_type_not_declared',
  ISA_TENURE_MISSING: 'isa_tenure_missing',
  ISA_LOCK_IN_ELAPSED: 'isa_lock_in_already_elapsed',
  FINANCIAL_INCOME_UNKNOWN: 'financial_income_status_unknown',
  ISA_EXCLUDED_FINANCIAL: 'isa_excluded_financial_income_taxpayer',
  ISA_EXCLUDED_AGE: 'isa_excluded_age',
  PENSION_AGE_NOT_EVALUATED: 'pension_age_not_evaluated',
  YOUTH_NOT_DECLARED: 'youth_status_not_declared',
  YOUTH_AGE_UNDETERMINED: 'youth_age_range_undetermined',
  PROPOSED_TRANSFER_PERIOD_MISSING: 'proposed_transfer_cap_period_input_missing',
  PROPOSED_NOT_ENACTED: 'proposed_not_enacted',
  PLANS_COLLAPSED_SINGLE: 'plans_collapsed_single',
  HORIZON_NOT_DECLARED: 'fund_use_horizon_not_declared',
  PENSION_HOLDING_NOT_EVALUATED: 'pension_holding_period_not_evaluated',
  TAX_CAP_UNKNOWN: 'tax_liability_cap_unknown',
  TAX_CAP_ZERO: 'tax_liability_cap_zero',
  TAX_CAP_APPLIED: 'tax_liability_cap_applied',
  ANNUITY_STARTED: 'pension_contribution_blocked_annuity_started',
  ANNUITY_START_UNKNOWN: 'pension_annuity_start_unknown',
  PENSION_START_DATE_NOT_COMPUTABLE: 'pension_start_date_not_computable',
  RETIREMENT_TRANSFER_EXCLUDED: 'retirement_transfer_excluded_from_credit',
};

export const COMPARISON_NOTE = {
  PLANS_COLLAPSED_SINGLE: 'plans_collapsed_single',
  ALL_ACCOUNTS_PENALTY: 'all_accounts_have_early_exit_penalty',
  BASELINE_REORDERED: 'baseline_reordered_by_fund_use_horizon',
  EQUAL_TAX_CREDIT: 'alternatives_have_equal_tax_credit',
  TAX_CREDIT_AXIS_FLAT: 'tax_credit_axis_not_discriminating',
};

export const WARNING = {
  PENSION_EARLY_WITHDRAWAL: 'early_withdrawal_penalty_pension',
  ISA_CLAWBACK: 'early_termination_clawback_isa',
};

export const ASSUMPTION = {
  MONTHS_DEFAULTED: 'months_remaining_defaulted',
  ISA_NEW_ACCOUNT: 'isa_new_account_assumed',
  ISA_TENURE_ZERO: 'isa_tenure_zero_assumed',
  OTHER_SAVINGS_ZERO: 'other_savings_zero_assumed',
  PRIOR_TRANSFER_CREDIT_ZERO: 'prior_transfer_credit_zero_assumed',
  SINGLE_TAX_YEAR: 'single_tax_year_only',
  OTHER_DEDUCTIONS_EXCLUDED: 'other_deductions_excluded',
  ROUNDING_FLOOR: 'rounding_floor_to_won',
  ISA_BENEFIT_NOT_QUANTIFIED: 'isa_benefit_not_quantified',
  HORIZON_EXCLUDED_FROM_AMOUNTS: 'fund_use_horizon_excluded_from_amounts',
  EARLY_EXIT_NOT_QUANTIFIED: 'early_exit_penalty_not_quantified',
  PENSION_HOLDING_NOT_EVALUATED: 'pension_holding_period_not_evaluated',
  // **이름이 낡았다.** 7차에 룰셋 규칙 `age.reckoning.reference_date`가 생겼으므로
  // "룰셋에 규칙이 없다"는 더는 사실이 아니다. 사실인 것은 **그 규칙이 기준일을
  // 하나로 정해 주지 않는다**는 것이고(단일 기준일은 존재하지 않는다), 그래서 엔진이
  // 고른 과세기간 종료일은 여전히 룰셋에서 나온 값이 아니다. 뜻은 계약 8.3절이
  // 정의하며 코드 문자열은 그대로 둔다 — 코드를 바꾸면 계약이 깨지고
  // `web-dev`가 `4.0.0`에 맞춰 구현 중인 화면이 낡는다(D22). 개명은 다음 회차에
  // 계산 기준일 입력과 함께 처리한다.
  AGE_REFERENCE_DATE: 'age_reference_date_not_in_ruleset',
  PRIOR_PENSION_CREDIT_ZERO: 'prior_pension_credit_zero_assumed',
  RETIREMENT_TRANSFER_IN_CONTRIBUTION_LIMIT: 'retirement_transfer_counted_in_contribution_limit',
  DEFERRED_RETIREMENT_INCOME_ABSENT: 'deferred_retirement_income_absent_assumed',
  LOCAL_TAX_FOLLOWS_CAP: 'local_tax_follows_income_tax_cap',
  // 규칙의 open_interpretation이 미확정으로 남긴 쟁점. 1단계 질문을 "합산되는 소득이
  // 있는가"로 좁혀 물으면 분리과세로 종결된 소득만 더 있는 사람이 총급여 기준으로
  // 가게 되고, 그것은 reading_b를 채택한 것이 된다. 조문이 정한 것처럼 표시하지 않는다.
  CREDIT_RATE_WAGE_ONLY_READING: 'credit_rate_wage_only_excludes_separately_taxed_income',
};

export const LIMITED_BY = {
  BUDGET: 'budget',
  CONTRIBUTION_LIMIT: 'contribution_limit',
  CREDIT_LIMIT: 'credit_limit',
  NOT_ELIGIBLE: 'not_eligible',
};

/**
 * 세제상 동점일 때 순서를 무엇으로 깼는지. 이름이 거짓말하지 않게 하려고 둔다 —
 * `max_tax_credit`은 공제를 최대화하되, 동점 구간에서는 이 기준으로 순서를 정한다.
 */
export const TIE_BREAK = {
  WITHDRAWAL_FLEXIBILITY: 'withdrawal_flexibility_first',
  NOT_APPLICABLE: 'not_applicable',
};

export const NON_QUANTIFIED = {
  ISA_HEADROOM: 'isa_tax_free_headroom',
  REASON_RETURN_UNKNOWN: 'depends_on_investment_return_not_in_ruleset',
  // D26 — 세액공제를 낳지 않는 연금계좌 납입. 이 효과에 딸린 사실들은 문구가 아니라
  // `facts`로 나간다. 셋 중 하나라도 빠지면 화면 문장이 거짓이 된다.
  PENSION_WITHOUT_CREDIT: 'pension_contribution_without_credit',
  REASON_DEFERRAL_UNKNOWN: 'benefit_depends_on_return_horizon_and_withdrawal_form_not_in_ruleset',
};

/**
 * 근거 안의 불확실성 표시가 어떤 형태인가. `LegalBasisEntry.uncertainty_notes[].kind`.
 * **유무가 아니라 목록으로 내는 이유**는 계약 5.7절에 있다 — 불확실을 일부 해소하며
 * 표시 하나를 지우면, 유무만 보는 구조에서는 남은 불확실까지 조용히 사라진다.
 */
export const UNCERTAINTY_KIND = {
  /** 규칙이 `unverified` 키로 스스로 적어 둔 것 */
  UNVERIFIED: 'unverified',
  /** `confidence`가 `verified`가 아니다 */
  CONFIDENCE_NOT_VERIFIED: 'confidence_not_verified',
  /** 시행령 위임 등으로 값 자체가 비어 있다 */
  VALUE_ABSENT: 'value_absent',
  /** 본문에 '미확인'이라고 적혀 있다 */
  TEXT_MARKER: 'text_marker',
};
