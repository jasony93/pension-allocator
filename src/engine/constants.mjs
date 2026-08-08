// 계약 상수. **세법 수치는 하나도 없다.**
// 여기 있는 숫자는 스키마 버전과 개월수 상한처럼 세법과 무관한 것뿐이다.
// 한도·비율·구간 경계는 전부 data/tax-rules/에서 읽는다.

export const SCHEMA_VERSION = '3.0.0';
export const SUPPORTED_MAJOR = 3;

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
};

/** 기본안을 뺀 나머지가 따르는 표준 순서. */
export const PLAN_ORDER = [PLAN.MAX_CREDIT, PLAN.ANNUITY_FIRST, PLAN.ISA_FIRST];

export const FILL_SEQUENCE = {
  [PLAN.MAX_CREDIT]: [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA],
  [PLAN.ANNUITY_FIRST]: [ACCOUNT.ANNUITY, ACCOUNT.PENSION, ACCOUNT.ISA],
  [PLAN.ISA_FIRST]: [ACCOUNT.ISA, ACCOUNT.PENSION, ACCOUNT.ANNUITY],
};

export const HORIZON = {
  WITHIN_ISA_LOCK_IN: 'within_isa_lock_in',
  BEFORE_PENSION_AGE: 'before_pension_age',
  AT_OR_AFTER_PENSION_AGE: 'at_or_after_pension_age',
  UNKNOWN: 'unknown',
};

export const HORIZONS = Object.values(HORIZON);

export const ISA_ACCOUNT_TYPES = ['general', 'low_income'];
export const TRANSFER_DESTINATIONS = [ACCOUNT.PENSION, ACCOUNT.ANNUITY];

export const MONTHS_IN_TAX_YEAR = 12;

/**
 * 룰셋 어휘. 세법 수치가 아니라 data/tax-rules/ 파일이 스스로 쓰는 status 값이고
 * scripts/org/validate-rules.mjs가 같은 목록을 강제한다.
 */
export const RULESET_STATUS = { CONFIRMED: '확정', PROPOSED: '개정예고' };

/** 엔진이 참조하는 규칙 id. 문자열일 뿐 수치가 아니다. */
export const RULE = {
  CREDIT_RATE: 'pension.credit.rate',
  CREDIT_LIMIT_ANNUITY: 'pension.credit.limit.annuity_savings',
  CREDIT_LIMIT_COMBINED: 'pension.credit.limit.combined',
  CREDIT_TRANSFER_EXTRA: 'pension.credit.isa_transfer.extra_limit',
  PENSION_CONTRIBUTION_LIMIT: 'pension.contribution.annual_limit',
  PENSION_WITHDRAWAL_ELIGIBILITY: 'pension.withdrawal.eligibility',
  PENSION_EARLY_WITHDRAWAL_RATE: 'pension.early_withdrawal.other_income_rate',
  ISA_ELIGIBILITY: 'isa.eligibility',
  ISA_EXCLUSION_FINANCIAL: 'isa.exclusion.financial_income_taxpayer',
  ISA_TAX_FREE_LIMIT: 'isa.tax_free_limit',
  ISA_EXCESS_RATE: 'isa.excess.separate_tax_rate',
  ISA_LOSS_OFFSET: 'isa.net_income.loss_offset',
  ISA_ACCOUNT_REQUIREMENTS: 'isa.account.requirements',
  ISA_ANNUAL_LIMIT: 'isa.contribution.annual_limit',
  ISA_CLAWBACK: 'isa.early_termination.clawback',
  LOCAL_SURTAX: 'tax.local.personal_income_surtax',

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
  ISA_TYPE_NOT_DECLARED: 'isa_type_not_declared',
  ISA_TENURE_MISSING: 'isa_tenure_missing',
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
};

export const COMPARISON_NOTE = {
  PLANS_COLLAPSED_SINGLE: 'plans_collapsed_single',
  ALL_ACCOUNTS_PENALTY: 'all_accounts_have_early_exit_penalty',
  BASELINE_REORDERED: 'baseline_reordered_by_fund_use_horizon',
  EQUAL_TAX_CREDIT: 'alternatives_have_equal_tax_credit',
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
};

export const LIMITED_BY = {
  BUDGET: 'budget',
  CONTRIBUTION_LIMIT: 'contribution_limit',
  CREDIT_LIMIT: 'credit_limit',
  NOT_ELIGIBLE: 'not_eligible',
};

export const NON_QUANTIFIED = {
  ISA_HEADROOM: 'isa_tax_free_headroom',
  REASON_RETURN_UNKNOWN: 'depends_on_investment_return_not_in_ruleset',
};
