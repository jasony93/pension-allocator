// 입력 검증. 발견한 오류를 전부 담는다 — 입력 화면이 여러 필드의 오류를
// 한 번에 표시해야 하기 때문이다(engine-interface.md 7.1절).
// 표시 문구는 만들지 않는다. 코드와 파라미터만 낸다.

import {
  ACCOUNT,
  ERROR,
  HORIZONS,
  ISA_ACCOUNT_TYPES,
  MONTHS_IN_TAX_YEAR,
  PLAN_ORDER,
  SCENARIO_ORDER,
  SUPPORTED_MAJOR,
  TRANSFER_DESTINATIONS,
} from './constants.mjs';

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

  return {
    age_years: c.requiredInt(profile.age_years, 'profile.age_years'),
    current_year_total_salary_krw: c.requiredInt(
      profile.current_year_total_salary_krw,
      'profile.current_year_total_salary_krw',
    ),
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
  const ageYears = c.requiredInt(request.age_years, 'age_years');
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
      ageYears,
      isaExists,
      isaYearsSinceOpening: yearsSinceOpening,
      isaTenureProvided:
        request.isa_years_since_opening !== undefined && request.isa_years_since_opening !== null,
      scenario,
    },
  };
}
