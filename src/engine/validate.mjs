// 입력 검증. 발견한 오류를 전부 담는다 — 입력 화면이 여러 필드의 오류를
// 한 번에 표시해야 하기 때문이다(engine-interface.md 7.1절).
// 표시 문구는 만들지 않는다. 코드와 파라미터만 낸다.

import {
  ACCOUNT,
  ANNUITY_START_VALUES,
  ERROR,
  HORIZONS,
  ISA_ACCOUNT_TYPES,
  MONTHS_IN_TAX_YEAR,
  PLAN_ORDER,
  PRIOR_TAX_STATE,
  PRIOR_TAX_STATES,
  SCENARIO_ORDER,
  SUPPORTED_MAJOR,
  TRANSFER_DESTINATIONS,
} from './constants.mjs';
import { parseIsoDate } from './dates.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

class Collector {
  constructor() {
    this.errors = [];
  }

  add(code, field, params = {}) {
    this.errors.push({ code, field, params });
  }

  /** 필수 정수. 없으면 missing_required, 정수가 아니면 not_integer, 음수면 negative_value. */
  requiredInt(value, field, { min = 0 } = {}) {
    if (value === undefined || value === null) {
      this.add(ERROR.MISSING_REQUIRED, field);
      return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.add(ERROR.NOT_INTEGER, field, { value: String(value) });
      return null;
    }
    if (!Number.isInteger(value)) {
      this.add(ERROR.NOT_INTEGER, field, { value });
      return null;
    }
    if (value < 0) {
      this.add(ERROR.NEGATIVE_VALUE, field, { value });
      return null;
    }
    if (value < min) {
      this.add(ERROR.OUT_OF_RANGE, field, { value, min });
      return null;
    }
    return value;
  }

  optionalInt(value, field, options) {
    if (value === undefined || value === null) return null;
    return this.requiredInt(value, field, options);
  }

  requiredBoolean(value, field) {
    if (value === undefined || value === null) {
      this.add(ERROR.MISSING_REQUIRED, field);
      return null;
    }
    if (typeof value !== 'boolean') {
      this.add(ERROR.INVALID_ENUM, field, { value: String(value) });
      return null;
    }
    return value;
  }

  optionalBoolean(value, field) {
    if (value === undefined || value === null) return null;
    return this.requiredBoolean(value, field);
  }

  /** `YYYY-MM-DD`만 받는다. 달력에 없는 날짜는 `invalid_date`다. */
  date(value, field, { required }) {
    if (value === undefined || value === null) {
      if (required) this.add(ERROR.MISSING_REQUIRED, field);
      return null;
    }
    const parsed = parseIsoDate(value);
    if (parsed === null) {
      // 오류 params에 입력값을 되풀이하지 않는다 — 생년월일은 designer가 박은 못 중
      // "오류 문구에 입력값 되풀이 금지"의 대상이다(D21에서 유지된 여섯 못).
      this.add(ERROR.INVALID_DATE, field, { format: 'YYYY-MM-DD' });
      return null;
    }
    return parsed;
  }

  enumValue(value, field, allowed, { required }) {
    if (value === undefined || value === null) {
      if (required) this.add(ERROR.MISSING_REQUIRED, field);
      return null;
    }
    if (!allowed.includes(value)) {
      this.add(ERROR.INVALID_ENUM, field, { value: String(value), allowed });
      return null;
    }
    return value;
  }
}

export function validateRequest(request) {
  const c = new Collector();

  if (!isObject(request)) {
    c.add(ERROR.MISSING_REQUIRED, null, { reason: 'request' });
    return { errors: c.errors, normalized: null };
  }

  validateSchemaVersion(c, request.schema_version);
  const taxYear = c.requiredInt(request.tax_year, 'tax_year');
  const scenarios = validateScenarios(c, request.scenarios);
  const profile = validateProfile(c, request.profile);
  const accounts = validateAccounts(c, request.accounts);
  const isaTransfer = validateTransfer(c, request.isa_transfer, accounts);
  const options = validateOptions(c, request.options);

  if (c.errors.length > 0) return { errors: c.errors, normalized: null };

  return {
    errors: [],
    normalized: {
      schema_version: request.schema_version,
      tax_year: taxYear,
      scenarios,
      profile,
      accounts,
      isa_transfer: isaTransfer,
      options,
    },
  };
}

function validateSchemaVersion(c, version) {
  if (version === undefined || version === null) {
    c.add(ERROR.MISSING_REQUIRED, 'schema_version');
    return;
  }
  if (typeof version !== 'string') {
    c.add(ERROR.SCHEMA_VERSION_MISMATCH, 'schema_version', { value: String(version) });
    return;
  }
  const major = Number.parseInt(version.split('.')[0], 10);
  if (!Number.isInteger(major) || major !== SUPPORTED_MAJOR) {
    c.add(ERROR.SCHEMA_VERSION_MISMATCH, 'schema_version', {
      value: version,
      supported_major: SUPPORTED_MAJOR,
    });
  }
}

function validateScenarios(c, scenarios) {
  if (scenarios === undefined || scenarios === null) {
    c.add(ERROR.MISSING_REQUIRED, 'scenarios');
    return null;
  }
  if (!Array.isArray(scenarios)) {
    c.add(ERROR.INVALID_ENUM, 'scenarios', { value: String(scenarios) });
    return null;
  }
  if (scenarios.length === 0) {
    c.add(ERROR.EMPTY_SCENARIOS, 'scenarios');
    return null;
  }

  const unknown = scenarios.filter((s) => !SCENARIO_ORDER.includes(s));
  for (const value of unknown) {
    c.add(ERROR.UNKNOWN_SCENARIO, 'scenarios', { value: String(value) });
  }
  if (unknown.length > 0) return null;

  // 중복 제거하고 고정 순서로 정렬한다. 요청 순서는 응답 순서를 정하지 않는다.
  return SCENARIO_ORDER.filter((id) => scenarios.includes(id));
}

function validateProfile(c, profile) {
  if (!isObject(profile)) {
    c.add(ERROR.MISSING_REQUIRED, 'profile');
    return null;
  }

  const months = profile.months_remaining_in_tax_year;
  let normalizedMonths = MONTHS_IN_TAX_YEAR;
  let monthsDefaulted = true;
  if (months !== undefined && months !== null) {
    const value = c.optionalInt(months, 'profile.months_remaining_in_tax_year', { min: 1 });
    if (value !== null) {
      if (value > MONTHS_IN_TAX_YEAR) {
        c.add(ERROR.OUT_OF_RANGE, 'profile.months_remaining_in_tax_year', {
          value,
          max: MONTHS_IN_TAX_YEAR,
        });
      } else {
        normalizedMonths = value;
        monthsDefaulted = false;
      }
    }
  }

  const globalIncome = validateGlobalIncome(c, profile);

  return {
    // 만 나이가 아니라 생년월일을 받는다(D21). 환산은 엔진이 하고 기준일은 계산 층에서 정한다.
    birth_date: c.date(profile.birth_date, 'profile.birth_date', { required: true }),
    prior_year_tax: validatePriorYearTax(c, profile.prior_year_tax),
    current_year_total_salary_krw: c.requiredInt(
      profile.current_year_total_salary_krw,
      'profile.current_year_total_salary_krw',
    ),
    has_non_wage_global_income_current_year: globalIncome.hasNonWage,
    current_year_global_income_krw: globalIncome.amount,
    current_year_global_income_provided: globalIncome.provided,
    prior_year_total_salary_krw: c.optionalInt(
      profile.prior_year_total_salary_krw,
      'profile.prior_year_total_salary_krw',
    ),
    financial_income_taxpayer_last_3_years: c.optionalBoolean(
      profile.financial_income_taxpayer_last_3_years,
      'profile.financial_income_taxpayer_last_3_years',
    ),
    declared_youth: c.optionalBoolean(profile.declared_youth, 'profile.declared_youth'),
    fund_use_horizon: c.enumValue(profile.fund_use_horizon, 'profile.fund_use_horizon', HORIZONS, {
      required: true,
    }),
    monthly_capacity_krw: c.requiredInt(profile.monthly_capacity_krw, 'profile.monthly_capacity_krw'),
    months_remaining_in_tax_year: normalizedMonths,
    months_defaulted: monthsDefaulted,
  };
}

/**
 * 공제율 판정에 쓸 소득. **두 물음을 순서대로 받는다**(D27, 규칙의 `required_inputs`).
 *
 * 1. 해당 과세기간에 근로소득 외에 **종합소득과세표준에 합산되는** 소득이 있는가.
 *    아니오면 총급여액으로 판정하고 끝난다 — 대다수 사용자에게 입력이 늘지 않는다.
 * 2. 예일 때만 그 과세기간의 종합소득금액.
 *
 * **예/아니오만으로는 부족하고 금액만으로도 부족하다.** 예/아니오만 받으면 '예' 분기에
 * 판정할 값이 없어 결함이 그대로 남고, 금액만 받으면 총급여 5,500만원 소괄호가
 * 종합소득금액 4,500만원보다 **엄격한** 구간(순수 근로소득자)에서 15%를 잘못 준다.
 *
 * **1단계가 '아니오'인데 금액이 실려 오면 오류다.** 둘 중 무엇이 사용자의 답인지
 * 엔진이 고르면 그것이 추론이고, 고르는 순간 "총급여를 환산해 판정"으로 미끄러진다.
 * `prior_year_tax.state`와 `determined_tax_krw`에 이미 쓴 것과 같은 형태다.
 */
function validateGlobalIncome(c, profile) {
  const hasNonWage = c.requiredBoolean(
    profile.has_non_wage_global_income_current_year,
    'profile.has_non_wage_global_income_current_year',
  );
  const provided =
    profile.current_year_global_income_krw !== undefined &&
    profile.current_year_global_income_krw !== null;

  const amount = c.optionalInt(
    profile.current_year_global_income_krw,
    'profile.current_year_global_income_krw',
  );

  if (hasNonWage === false && provided) {
    c.add(ERROR.INVALID_ENUM, 'profile.has_non_wage_global_income_current_year', {
      value: String(hasNonWage),
      reason: 'current_year_global_income_krw_present',
    });
  }

  return { hasNonWage, amount, provided };
}

/**
 * 세액 한도의 재료. **결정세액과 연금계좌 세액공제액을 짝으로 받는다.**
 *
 * 하나만 받으면 등식이 성립하지 않는다 — 결정세액만 받으면 이미 받은 공제만큼 한도가
 * 줄어 보이는 순환이 생기고(과소), 공제액만 받으면 한도를 계산할 수조차 없다.
 * 그래서 두 값을 **한 객체 안에** 두고, 되더하기의 출발점인 결정세액을 그 객체의
 * 필수 항목으로 만들었다. 짝이라는 사실이 규약이 아니라 자료형으로 강제된다.
 *
 * `state`를 따로 두는 이유는 "빈 칸"과 "모르겠습니다"를 가르기 위해서다(D14).
 * 비어 있는 것을 모름으로 간주하면 사용자의 침묵에서 답을 추론하는 것이 된다.
 */
function validatePriorYearTax(c, node) {
  const field = 'profile.prior_year_tax';
  if (!isObject(node)) {
    c.add(ERROR.MISSING_REQUIRED, field);
    return null;
  }

  const state = c.enumValue(node.state, `${field}.state`, PRIOR_TAX_STATES, { required: true });

  // 되더하기의 가산항. 미입력이면 0으로 보되 그 사실을 가정으로 낸다 —
  // 0으로 두면 한도가 과소로 나오고, 과소는 절세액을 과대로 만들지 않는 방향이다.
  const creditProvided =
    node.pension_credit_applied_krw !== undefined && node.pension_credit_applied_krw !== null;
  const pensionCredit = c.optionalInt(
    node.pension_credit_applied_krw,
    `${field}.pension_credit_applied_krw`,
  );

  let determined = null;
  if (state === PRIOR_TAX_STATE.AMOUNT) {
    determined = c.requiredInt(node.determined_tax_krw, `${field}.determined_tax_krw`);
  } else if (node.determined_tax_krw !== undefined && node.determined_tax_krw !== null) {
    // 금액을 실었는데 state가 금액을 뜻하지 않는다. 둘 중 무엇이 사용자의 답인지
    // 엔진이 고르면 그것이 추론이다. 고르지 않고 되돌려준다.
    c.add(ERROR.INVALID_ENUM, `${field}.state`, {
      value: String(state),
      reason: 'determined_tax_krw_present',
    });
  }

  return {
    state,
    determined_tax_krw: determined,
    pension_credit_applied_krw: pensionCredit ?? 0,
    pension_credit_provided: creditProvided,
  };
}

function validateAccounts(c, accounts) {
  if (!isObject(accounts)) {
    c.add(ERROR.MISSING_REQUIRED, 'accounts');
    return null;
  }

  const pension = (key) => {
    const node = accounts[key];
    if (!isObject(node)) {
      c.add(ERROR.MISSING_REQUIRED, `accounts.${key}`);
      return null;
    }
    return {
      ytd_contribution_krw: c.requiredInt(
        node.ytd_contribution_krw,
        `accounts.${key}.ytd_contribution_krw`,
      ),
      // 기본값을 두지 않는다. 이 항목의 기본값 실수는 연금 수령 중인 사용자에게
      // 납입 가능액을 주는 방향, 즉 **과대** 방향으로 틀린다.
      annuity_start_status: c.enumValue(
        node.annuity_start_status,
        `accounts.${key}.annuity_start_status`,
        ANNUITY_START_VALUES,
        { required: true },
      ),
      opened_on: c.date(node.opened_on, `accounts.${key}.opened_on`, { required: false }),
      opened_on_provided: node.opened_on !== undefined && node.opened_on !== null,
      has_deferred_retirement_income: c.optionalBoolean(
        node.has_deferred_retirement_income,
        `accounts.${key}.has_deferred_retirement_income`,
      ),
      // 퇴직급여 입금액·계약이전액. **납입 여력과 분리해서 받는다** —
      // 여력에 섞여 들어오면 세액공제액이 과대 계산된다.
      retirement_transfer_in_krw: c.optionalInt(
        node.retirement_transfer_in_krw,
        `accounts.${key}.retirement_transfer_in_krw`,
      ) ?? 0,
    };
  };

  const annuity = pension(ACCOUNT.ANNUITY);
  const retirement = pension(ACCOUNT.PENSION);

  const isaNode = accounts[ACCOUNT.ISA];
  let isa = null;
  if (!isObject(isaNode)) {
    c.add(ERROR.MISSING_REQUIRED, 'accounts.isa');
  } else {
    const cumulative = c.requiredInt(
      isaNode.cumulative_contribution_krw,
      'accounts.isa.cumulative_contribution_krw',
    );
    const ytd = c.requiredInt(isaNode.ytd_contribution_krw, 'accounts.isa.ytd_contribution_krw');
    if (cumulative !== null && ytd !== null && ytd > cumulative) {
      c.add(ERROR.ISA_YTD_EXCEEDS_CUMULATIVE, 'accounts.isa.ytd_contribution_krw', {
        ytd,
        cumulative,
      });
    }

    isa = {
      exists: c.requiredBoolean(isaNode.exists, 'accounts.isa.exists'),
      account_type: c.enumValue(isaNode.account_type, 'accounts.isa.account_type', ISA_ACCOUNT_TYPES, {
        required: false,
      }),
      cumulative_contribution_krw: cumulative,
      ytd_contribution_krw: ytd,
      years_since_opening: c.optionalInt(
        isaNode.years_since_opening,
        'accounts.isa.years_since_opening',
      ),
      years_since_opening_provided:
        isaNode.years_since_opening !== undefined && isaNode.years_since_opening !== null,
      other_savings_contract_krw: c.optionalInt(
        isaNode.other_savings_contract_krw,
        'accounts.isa.other_savings_contract_krw',
      ),
      other_savings_provided:
        isaNode.other_savings_contract_krw !== undefined && isaNode.other_savings_contract_krw !== null,
    };
  }

  return { annuity_savings: annuity, retirement_pension: retirement, isa };
}

function validateTransfer(c, transfer, accounts) {
  if (transfer === undefined || transfer === null) return null;
  if (!isObject(transfer)) {
    c.add(ERROR.INVALID_ENUM, 'isa_transfer', { value: String(transfer) });
    return null;
  }

  const amount = c.requiredInt(transfer.amount_krw, 'isa_transfer.amount_krw', { min: 1 });
  const cumulative = accounts?.isa?.cumulative_contribution_krw ?? null;
  if (amount !== null && cumulative !== null && amount > cumulative) {
    c.add(ERROR.ISA_TRANSFER_EXCEEDS_CUMULATIVE, 'isa_transfer.amount_krw', { amount, cumulative });
  }

  const priorYear = c.optionalInt(
    transfer.prior_year_applied_extra_credit_krw,
    'isa_transfer.prior_year_applied_extra_credit_krw',
  );

  return {
    amount_krw: amount,
    destination:
      c.enumValue(transfer.destination, 'isa_transfer.destination', TRANSFER_DESTINATIONS, {
        required: false,
      }) ?? ACCOUNT.PENSION,
    prior_year_applied_extra_credit_krw: priorYear ?? 0,
    prior_year_provided:
      transfer.prior_year_applied_extra_credit_krw !== undefined &&
      transfer.prior_year_applied_extra_credit_krw !== null,
    prior_multi_year_applied_extra_credit_krw: c.optionalInt(
      transfer.prior_multi_year_applied_extra_credit_krw,
      'isa_transfer.prior_multi_year_applied_extra_credit_krw',
    ),
  };
}

function validateOptions(c, options) {
  if (options === undefined || options === null) {
    return { plan_variants: null, include_legal_basis: true };
  }
  if (!isObject(options)) {
    c.add(ERROR.INVALID_ENUM, 'options', { value: String(options) });
    return null;
  }

  let variants = null;
  if (options.plan_variants !== undefined && options.plan_variants !== null) {
    if (!Array.isArray(options.plan_variants)) {
      c.add(ERROR.UNKNOWN_PLAN_VARIANT, 'options.plan_variants', {
        value: String(options.plan_variants),
      });
    } else {
      for (const id of options.plan_variants) {
        if (!PLAN_ORDER.includes(id)) {
          c.add(ERROR.UNKNOWN_PLAN_VARIANT, 'options.plan_variants', { value: String(id) });
        }
      }
      variants = PLAN_ORDER.filter((id) => options.plan_variants.includes(id));
    }
  }

  return {
    plan_variants: variants,
    include_legal_basis: c.optionalBoolean(options.include_legal_basis, 'options.include_legal_basis') ?? true,
  };
}

/** 경계값 전용 진입점의 요청 검증. compute와 같은 코드 체계를 쓴다. */
export function validateBoundariesRequest(request) {
  const c = new Collector();

  if (!isObject(request)) {
    c.add(ERROR.MISSING_REQUIRED, null, { reason: 'request' });
    return { errors: c.errors, normalized: null };
  }

  validateSchemaVersion(c, request.schema_version);
  const taxYear = c.requiredInt(request.tax_year, 'tax_year');
  // compute와 같은 이유로 만 나이가 아니라 생년월일을 받는다(D21).
  const birthDate = c.date(request.birth_date, 'birth_date', { required: true });
  const isaExists = c.requiredBoolean(request.isa_exists, 'isa_exists');
  const yearsSinceOpening = c.optionalInt(request.isa_years_since_opening, 'isa_years_since_opening');
  const scenario =
    c.enumValue(request.scenario, 'scenario', SCENARIO_ORDER, { required: false }) ?? SCENARIO_ORDER[0];

  if (c.errors.length > 0) return { errors: c.errors, normalized: null };

  return {
    errors: [],
    normalized: {
      schema_version: request.schema_version,
      taxYear,
      birthDate,
      isaExists,
      isaYearsSinceOpening: yearsSinceOpening,
      isaTenureProvided:
        request.isa_years_since_opening !== undefined && request.isa_years_since_opening !== null,
      scenario,
    },
  };
}
