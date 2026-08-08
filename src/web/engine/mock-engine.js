/**
 * 엔진 목(mock) — `docs/stage-2-design/engine-interface.md` (schema_version 2.1.0)의
 * `compute` / `computeFundUseHorizonBoundaries` 계약을 그대로 구현한다.
 *
 * 이 파일은 `calc-engine-dev`의 실제 엔진(`src/engine/`)이 나오기 전까지 UI를
 * 독립적으로 확인하기 위한 대체물이다. 세법 수치는 전부 인자로 주입되는
 * `rulesets`(= data/tax-rules/*.json을 파싱한 객체)에서 읽으며 이 파일 어디에도
 * 하드코딩하지 않는다 — 제품 원칙 1을 목에도 그대로 적용한다.
 *
 * **배분 알고리즘은 근사치다.** 세 배분안(`max_tax_credit` / `annuity_savings_first`
 * / `isa_first`)의 우선순위를 반영하는 합리적인 순차 충당 규칙을 구현했지만,
 * 이는 `calc-engine-dev`가 `engine-design.md`에서 확정할 실제 알고리즘을
 * 대신하는 것이 아니다. 목의 책임은 계약의 타입·필드·코드를 정확히 지키고
 * UI가 다섯 상태를 모두 확인할 수 있는 그럴듯한 값을 내는 것까지다.
 *
 * 순수 함수다 — 네트워크·파일 I/O·현재 시각을 읽지 않는다. 예외를 던지지 않는다.
 */

const ACCOUNTS = ['retirement_pension', 'annuity_savings', 'isa'];
const SCENARIO_ORDER = ['current', 'proposed'];
const PLAN_ORDER = ['max_tax_credit', 'annuity_savings_first', 'isa_first'];
const KNOWN_SCHEMA_MAJOR = '2';

// ---------------------------------------------------------------------------
// 룰셋 조회 헬퍼
// ---------------------------------------------------------------------------

function ruleFiles(rulesets) {
  return Object.keys(rulesets || {});
}

function findRule(rulesets, ruleId, fileKeys) {
  for (const key of fileKeys) {
    const file = rulesets[key];
    if (!file || !Array.isArray(file.rules)) continue;
    const rule = file.rules.find((r) => r.id === ruleId);
    if (rule) return { rule, fileKey: key };
  }
  return null;
}

function toLegalBasisEntry(rule, appliedTo) {
  const v = rule.value || {};
  const hasUncertainty = Boolean(
    v.unverified || v.confidence === 'corroborated' || v.age_range === null,
  );
  return {
    rule_id: rule.id,
    title: rule.title,
    law: rule.source.law,
    law_version: rule.source.law_version ?? null,
    url: rule.source.url,
    corroborating_url: rule.source.corroborating_url ?? null,
    status: rule.status,
    bill_stage: rule.bill_stage ?? null,
    effective_from: rule.effective_from,
    verified_on: rule.source.verified_on,
    applied_to: appliedTo,
    has_uncertainty_note: hasUncertainty,
  };
}

// ---------------------------------------------------------------------------
// 요청 검증 (7.1 / 8.1)
// ---------------------------------------------------------------------------

function err(code, field, params) {
  return { code, field: field ?? null, params: params ?? {} };
}

function isInt(v) {
  return typeof v === 'number' && Number.isInteger(v);
}

function validateRequest(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    return [err('missing_required', null, {})];
  }

  if (request.schema_version == null) {
    errors.push(err('missing_required', 'schema_version', {}));
  } else if (String(request.schema_version).split('.')[0] !== KNOWN_SCHEMA_MAJOR) {
    errors.push(
      err('schema_version_mismatch', 'schema_version', {
        received: request.schema_version,
        known_major: KNOWN_SCHEMA_MAJOR,
      }),
    );
  }

  if (request.tax_year == null) errors.push(err('missing_required', 'tax_year', {}));
  else if (!isInt(request.tax_year)) errors.push(err('not_integer', 'tax_year', {}));

  if (request.scenarios == null) {
    errors.push(err('missing_required', 'scenarios', {}));
  } else if (!Array.isArray(request.scenarios) || request.scenarios.length === 0) {
    errors.push(err('empty_scenarios', 'scenarios', {}));
  } else {
    for (const s of request.scenarios) {
      if (!SCENARIO_ORDER.includes(s)) errors.push(err('unknown_scenario', 'scenarios', { value: s }));
    }
  }

  if (request.profile == null) {
    errors.push(err('missing_required', 'profile', {}));
  } else {
    errors.push(...validateProfile(request.profile));
  }

  if (request.accounts == null) {
    errors.push(err('missing_required', 'accounts', {}));
  } else {
    errors.push(...validateAccounts(request.accounts));
  }

  if (request.isa_transfer != null) {
    errors.push(...validateIsaTransfer(request.isa_transfer, request.accounts));
  }

  if (request.options != null) {
    errors.push(...validateOptions(request.options));
  }

  return errors;
}

function validateProfile(p) {
  const errors = [];
  if (p.age_years == null) errors.push(err('missing_required', 'profile.age_years', {}));
  else if (!isInt(p.age_years)) errors.push(err('not_integer', 'profile.age_years', {}));
  else if (p.age_years < 0) errors.push(err('negative_value', 'profile.age_years', {}));

  if (p.current_year_total_salary_krw == null)
    errors.push(err('missing_required', 'profile.current_year_total_salary_krw', {}));
  else if (!isInt(p.current_year_total_salary_krw))
    errors.push(err('not_integer', 'profile.current_year_total_salary_krw', {}));
  else if (p.current_year_total_salary_krw < 0)
    errors.push(err('negative_value', 'profile.current_year_total_salary_krw', {}));

  if (p.prior_year_total_salary_krw != null) {
    if (!isInt(p.prior_year_total_salary_krw))
      errors.push(err('not_integer', 'profile.prior_year_total_salary_krw', {}));
    else if (p.prior_year_total_salary_krw < 0)
      errors.push(err('negative_value', 'profile.prior_year_total_salary_krw', {}));
  }

  if (p.fund_use_horizon == null) {
    errors.push(err('missing_required', 'profile.fund_use_horizon', {}));
  } else if (
    !['within_isa_lock_in', 'before_pension_age', 'at_or_after_pension_age', 'unknown'].includes(
      p.fund_use_horizon,
    )
  ) {
    errors.push(err('invalid_enum', 'profile.fund_use_horizon', { value: p.fund_use_horizon }));
  }

  if (p.monthly_capacity_krw == null)
    errors.push(err('missing_required', 'profile.monthly_capacity_krw', {}));
  else if (!isInt(p.monthly_capacity_krw))
    errors.push(err('not_integer', 'profile.monthly_capacity_krw', {}));
  else if (p.monthly_capacity_krw < 0)
    errors.push(err('negative_value', 'profile.monthly_capacity_krw', {}));

  if (p.months_remaining_in_tax_year != null) {
    if (!isInt(p.months_remaining_in_tax_year))
      errors.push(err('not_integer', 'profile.months_remaining_in_tax_year', {}));
    else if (p.months_remaining_in_tax_year < 1 || p.months_remaining_in_tax_year > 12)
      errors.push(err('out_of_range', 'profile.months_remaining_in_tax_year', {}));
  }

  if (
    p.financial_income_taxpayer_last_3_years != null &&
    typeof p.financial_income_taxpayer_last_3_years !== 'boolean'
  ) {
    errors.push(err('invalid_enum', 'profile.financial_income_taxpayer_last_3_years', {}));
  }
  if (p.declared_youth != null && typeof p.declared_youth !== 'boolean') {
    errors.push(err('invalid_enum', 'profile.declared_youth', {}));
  }

  return errors;
}

function validatePensionAccount(a, field, errors) {
  if (!a || a.ytd_contribution_krw == null) {
    errors.push(err('missing_required', `${field}.ytd_contribution_krw`, {}));
    return;
  }
  if (!isInt(a.ytd_contribution_krw)) errors.push(err('not_integer', `${field}.ytd_contribution_krw`, {}));
  else if (a.ytd_contribution_krw < 0) errors.push(err('negative_value', `${field}.ytd_contribution_krw`, {}));
}

function validateAccounts(accounts) {
  const errors = [];
  validatePensionAccount(accounts.annuity_savings, 'accounts.annuity_savings', errors);
  validatePensionAccount(accounts.retirement_pension, 'accounts.retirement_pension', errors);

  const isa = accounts.isa;
  if (!isa) {
    errors.push(err('missing_required', 'accounts.isa', {}));
    return errors;
  }
  if (isa.exists == null) errors.push(err('missing_required', 'accounts.isa.exists', {}));
  else if (typeof isa.exists !== 'boolean') errors.push(err('invalid_enum', 'accounts.isa.exists', {}));

  if (isa.account_type != null && !['general', 'low_income'].includes(isa.account_type)) {
    errors.push(err('invalid_enum', 'accounts.isa.account_type', { value: isa.account_type }));
  }

  if (isa.cumulative_contribution_krw == null)
    errors.push(err('missing_required', 'accounts.isa.cumulative_contribution_krw', {}));
  else if (!isInt(isa.cumulative_contribution_krw))
    errors.push(err('not_integer', 'accounts.isa.cumulative_contribution_krw', {}));
  else if (isa.cumulative_contribution_krw < 0)
    errors.push(err('negative_value', 'accounts.isa.cumulative_contribution_krw', {}));

  if (isa.ytd_contribution_krw == null)
    errors.push(err('missing_required', 'accounts.isa.ytd_contribution_krw', {}));
  else if (!isInt(isa.ytd_contribution_krw))
    errors.push(err('not_integer', 'accounts.isa.ytd_contribution_krw', {}));
  else if (isa.ytd_contribution_krw < 0)
    errors.push(err('negative_value', 'accounts.isa.ytd_contribution_krw', {}));
  else if (
    isInt(isa.cumulative_contribution_krw) &&
    isa.ytd_contribution_krw > isa.cumulative_contribution_krw
  ) {
    errors.push(err('isa_ytd_exceeds_cumulative', 'accounts.isa.ytd_contribution_krw', {}));
  }

  if (isa.years_since_opening != null) {
    if (!isInt(isa.years_since_opening))
      errors.push(err('not_integer', 'accounts.isa.years_since_opening', {}));
    else if (isa.years_since_opening < 0)
      errors.push(err('negative_value', 'accounts.isa.years_since_opening', {}));
  }
  if (isa.other_savings_contract_krw != null) {
    if (!isInt(isa.other_savings_contract_krw))
      errors.push(err('not_integer', 'accounts.isa.other_savings_contract_krw', {}));
    else if (isa.other_savings_contract_krw < 0)
      errors.push(err('negative_value', 'accounts.isa.other_savings_contract_krw', {}));
  }

  return errors;
}

function validateIsaTransfer(t, accounts) {
  const errors = [];
  if (t.amount_krw == null) errors.push(err('missing_required', 'isa_transfer.amount_krw', {}));
  else if (!isInt(t.amount_krw)) errors.push(err('not_integer', 'isa_transfer.amount_krw', {}));
  else if (t.amount_krw < 1) errors.push(err('out_of_range', 'isa_transfer.amount_krw', {}));
  else if (accounts?.isa && isInt(accounts.isa.cumulative_contribution_krw) && t.amount_krw > accounts.isa.cumulative_contribution_krw) {
    errors.push(err('isa_transfer_exceeds_cumulative', 'isa_transfer.amount_krw', {}));
  }

  if (t.destination != null && !['retirement_pension', 'annuity_savings'].includes(t.destination)) {
    errors.push(err('invalid_enum', 'isa_transfer.destination', { value: t.destination }));
  }
  if (t.prior_year_applied_extra_credit_krw != null) {
    if (!isInt(t.prior_year_applied_extra_credit_krw))
      errors.push(err('not_integer', 'isa_transfer.prior_year_applied_extra_credit_krw', {}));
    else if (t.prior_year_applied_extra_credit_krw < 0)
      errors.push(err('negative_value', 'isa_transfer.prior_year_applied_extra_credit_krw', {}));
  }
  if (t.prior_multi_year_applied_extra_credit_krw != null) {
    if (!isInt(t.prior_multi_year_applied_extra_credit_krw))
      errors.push(err('not_integer', 'isa_transfer.prior_multi_year_applied_extra_credit_krw', {}));
    else if (t.prior_multi_year_applied_extra_credit_krw < 0)
      errors.push(err('negative_value', 'isa_transfer.prior_multi_year_applied_extra_credit_krw', {}));
  }
  return errors;
}

function validateOptions(o) {
  const errors = [];
  if (o.plan_variants != null) {
    if (!Array.isArray(o.plan_variants)) {
      errors.push(err('invalid_enum', 'options.plan_variants', {}));
    } else {
      for (const id of o.plan_variants) {
        if (!PLAN_ORDER.includes(id)) errors.push(err('unknown_plan_variant', 'options.plan_variants', { value: id }));
      }
    }
  }
  if (o.include_legal_basis != null && typeof o.include_legal_basis !== 'boolean') {
    errors.push(err('invalid_enum', 'options.include_legal_basis', {}));
  }
  return errors;
}

// ---------------------------------------------------------------------------
// 시나리오 단위 계산
// ---------------------------------------------------------------------------

function fileKeysForScenario(scenario) {
  return scenario === 'proposed' ? ['2027-proposed.json', '2026.json'] : ['2026.json'];
}

function computeScenario(scenario, request, rulesets) {
  const files = fileKeysForScenario(scenario).filter((k) => rulesets[k]);
  const isEnacted = scenario === 'current';
  const profile = request.profile;
  const accounts = request.accounts;
  const isaTransfer = request.isa_transfer ?? null;
  const months = request.months_remaining_effective;
  const notices = [];
  const usedRules = new Map(); // ruleId -> { rule, appliedTo: Set }
  const missingRules = [];

  function use(ruleId, appliedTo) {
    const found = findRule(rulesets, ruleId, files);
    if (!found) {
      missingRules.push(ruleId);
      return null;
    }
    if (!usedRules.has(ruleId)) usedRules.set(ruleId, { rule: found.rule, appliedTo: new Set() });
    if (appliedTo) usedRules.get(ruleId).appliedTo.add(appliedTo);
    return found.rule;
  }

  // -- 연금계좌 세액공제율 구간 --------------------------------------------
  const creditRateRule = use('pension.credit.rate', 'echo.credit_rate_bracket');
  const surtaxRule = use('tax.local.personal_income_surtax', 'echo.credit_rate_bracket');
  let incomeTaxRate = 0.12;
  if (creditRateRule) {
    const bracket = creditRateRule.value.brackets.find(
      (b) => b.total_salary_only_max_krw == null || profile.current_year_total_salary_krw <= b.total_salary_only_max_krw,
    );
    incomeTaxRate = bracket ? bracket.rate : creditRateRule.value.brackets[creditRateRule.value.brackets.length - 1].rate;
  }
  const localRateOfIncomeTax = surtaxRule ? surtaxRule.value.rate_of_income_tax : 0.1;
  const localTaxRate = incomeTaxRate * localRateOfIncomeTax;
  const effectiveRate = incomeTaxRate + localTaxRate;

  // -- 연금계좌 한도 --------------------------------------------------------
  const annuityCreditLimitRule = use('pension.credit.limit.annuity_savings');
  const combinedCreditLimitRule = use('pension.credit.limit.combined');
  const pensionContributionLimitRule = use('pension.contribution.annual_limit');
  const annuityCreditCap = annuityCreditLimitRule ? annuityCreditLimitRule.value.amount_krw : 0;
  const baseCombinedCreditCap = combinedCreditLimitRule ? combinedCreditLimitRule.value.amount_krw : 0;
  const pensionContributionCap = pensionContributionLimitRule ? pensionContributionLimitRule.value.amount_krw : 0;

  // -- ISA 전환 추가한도 ------------------------------------------------
  let isaTransferExtraLimit = null;
  let extraCreditLimit = 0;
  let transferDestination = null;
  if (isaTransfer) {
    const transferRule =
      scenario === 'proposed'
        ? use('proposed.productive_isa.pension_transfer.credit_extra_limit', 'scenarios[].isa_transfer_extra_limit') ||
          use('pension.credit.isa_transfer.extra_limit', 'scenarios[].isa_transfer_extra_limit')
        : use('pension.credit.isa_transfer.extra_limit', 'scenarios[].isa_transfer_extra_limit');
    transferDestination = isaTransfer.destination ?? 'retirement_pension';
    if (transferRule) {
      const rate = transferRule.value.rate ?? 0.1;
      const cap = transferRule.value.cap_krw ?? 3000000;
      let priorApplied;
      if (scenario === 'proposed') {
        if (isaTransfer.prior_multi_year_applied_extra_credit_krw != null) {
          priorApplied = isaTransfer.prior_multi_year_applied_extra_credit_krw;
        } else {
          priorApplied = isaTransfer.prior_year_applied_extra_credit_krw ?? 0;
          notices.push({
            code: 'proposed_transfer_cap_period_input_missing',
            severity: 'warning',
            field: 'isa_transfer.prior_multi_year_applied_extra_credit_krw',
            params: {},
            basis_rule_ids: [transferRule.id],
          });
        }
      } else {
        // prior_year_applied_extra_credit_krw가 null인 경우는 8.2절에 별도 notice가
        // 없다 — top-level compute()의 assumptions에 prior_transfer_credit_zero_assumed로
        // 실린다(8.3절). 여기서는 notice를 내지 않는다.
        priorApplied = isaTransfer.prior_year_applied_extra_credit_krw ?? 0;
      }
      const rawExtra = Math.round(isaTransfer.amount_krw * rate);
      extraCreditLimit = Math.max(0, Math.min(rawExtra, cap - priorApplied));
      isaTransferExtraLimit = {
        transfer_amount_krw: isaTransfer.amount_krw,
        destination: transferDestination,
        extra_credit_limit_krw: extraCreditLimit,
        prior_applied_deducted_krw: priorApplied,
        counted_as_contribution_krw: isaTransfer.amount_krw,
        basis_rule_ids: [transferRule.id],
      };
    }
  }

  // -- ISA 자격 --------------------------------------------------------
  const isaEligibilityRule = use('isa.eligibility', 'scenarios[].account_eligibility');
  let isaEligible = true;
  const isaReasonCodes = [];
  if (isaEligibilityRule) {
    // 연령 경계는 코드에 적지 않고 룰셋의 any_of 조건에서 읽는다(제품 원칙 1).
    const anyOf = isaEligibilityRule.value.any_of || [];
    const unconditionalMinAge = anyOf.find((c) => !c.requires)?.min_age;
    const conditionalEntry = anyOf.find((c) => c.requires);
    if (unconditionalMinAge != null && profile.age_years >= unconditionalMinAge) {
      // age19 요건을 그대로 충족 — 자격 있음
    } else if (
      conditionalEntry &&
      profile.age_years >= conditionalEntry.min_age &&
      unconditionalMinAge != null &&
      profile.age_years < unconditionalMinAge
    ) {
      // age15_employed 요건은 '직전 과세기간 근로소득 보유' 확인이 필요하나 이
      // 입력을 받지 않는다(requirements.md 2절 — 1차 출시에서 묻지 않는 선택
      // 입력). 확인할 수 없는 조건이므로 보수적으로 배제한다.
      isaEligible = false;
      isaReasonCodes.push('isa_excluded_age');
      notices.push({ code: 'isa_excluded_age', severity: 'warning', field: 'profile.age_years', params: {}, basis_rule_ids: [isaEligibilityRule.id] });
    } else {
      isaEligible = false;
      isaReasonCodes.push('isa_excluded_age');
      notices.push({ code: 'isa_excluded_age', severity: 'warning', field: 'profile.age_years', params: {}, basis_rule_ids: [isaEligibilityRule.id] });
    }
  }
  if (profile.financial_income_taxpayer_last_3_years === true) {
    const excl = use('isa.exclusion.financial_income_taxpayer', 'scenarios[].account_eligibility');
    isaEligible = false;
    isaReasonCodes.push('isa_excluded_financial_income_taxpayer');
    notices.push({
      code: 'isa_excluded_financial_income_taxpayer',
      severity: 'warning',
      field: 'profile.financial_income_taxpayer_last_3_years',
      params: {},
      basis_rule_ids: excl ? [excl.id] : [],
    });
  } else if (profile.financial_income_taxpayer_last_3_years == null) {
    notices.push({
      code: 'financial_income_status_unknown',
      severity: 'info',
      field: 'profile.financial_income_taxpayer_last_3_years',
      params: {},
      basis_rule_ids: [],
    });
  }

  const accountEligibility = [
    { account: 'retirement_pension', eligible: true, reason_codes: [], basis_rule_ids: [] },
    { account: 'annuity_savings', eligible: true, reason_codes: [], basis_rule_ids: [] },
    {
      account: 'isa',
      eligible: isaEligible,
      reason_codes: isaReasonCodes,
      basis_rule_ids: isaEligibilityRule ? [isaEligibilityRule.id] : [],
    },
  ];
  notices.push({ code: 'pension_age_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });

  // -- ISA 비과세 한도 --------------------------------------------------
  const isaTaxFreeRule = use('isa.tax_free_limit', 'scenarios[].limits.by_account[isa].tax_free_limit_krw');
  let taxFreeLimit = null;
  if (accounts.isa.exists && accounts.isa.account_type != null && isaTaxFreeRule) {
    const bracket = isaTaxFreeRule.value.brackets.find((b) => b.id === (accounts.isa.account_type === 'low_income' ? '서민형' : '일반형'));
    taxFreeLimit = bracket ? bracket.limit_krw : null;

    if (profile.prior_year_total_salary_krw != null) {
      const lowIncomeBracket = isaTaxFreeRule.value.brackets.find((b) => b.id === '서민형');
      const qualifiesLowIncome =
        lowIncomeBracket && profile.prior_year_total_salary_krw <= lowIncomeBracket.prev_total_salary_max_krw;
      const declaredLowIncome = accounts.isa.account_type === 'low_income';
      if (qualifiesLowIncome !== declaredLowIncome) {
        notices.push({
          code: 'isa_type_conflicts_with_prior_income',
          severity: 'warning',
          field: 'accounts.isa.account_type',
          params: {},
          basis_rule_ids: [isaTaxFreeRule.id],
        });
      }
    } else {
      notices.push({ code: 'prior_year_income_missing', severity: 'info', field: 'profile.prior_year_total_salary_krw', params: {}, basis_rule_ids: [] });
    }
  } else if (accounts.isa.exists && accounts.isa.account_type == null) {
    notices.push({ code: 'isa_type_not_declared', severity: 'info', field: 'accounts.isa.account_type', params: {}, basis_rule_ids: [] });
  }

  // -- ISA 연간 납입 가능액 -----------------------------------------------
  const isaRequirementsRule = use('isa.account.requirements', 'scenarios[].limits.by_account[isa]');
  const totalLimit = isaRequirementsRule ? isaRequirementsRule.value.total_contribution_limit_krw : 100000000;
  const otherSavings = accounts.isa.other_savings_contract_krw ?? 0;
  // other_savings_contract_krw == null인 경우는 notice가 아니라 top-level
  // compute()의 assumptions에 other_savings_zero_assumed로 실린다(8.3절).
  const effectiveTotalLimit = Math.max(0, totalLimit - otherSavings);

  let isaAnnualRoom = 0;
  if (accounts.isa.exists) {
    if (scenario === 'proposed') {
      const proposedAnnualRule = use('proposed.isa.annual_contribution_limit', 'scenarios[].limits.by_account[isa]');
      const flatAnnual = proposedAnnualRule ? proposedAnnualRule.value.amount_krw : 20000000;
      isaAnnualRoom = Math.max(0, Math.min(flatAnnual, effectiveTotalLimit - accounts.isa.cumulative_contribution_krw));
    } else {
      const annualRule = use('isa.contribution.annual_limit', 'scenarios[].limits.by_account[isa]');
      const base = annualRule ? annualRule.value.base_amount_krw : 20000000;
      const yearsSinceOpening = accounts.isa.years_since_opening;
      if (yearsSinceOpening == null) {
        notices.push({ code: 'isa_tenure_missing', severity: 'warning', field: 'accounts.isa.years_since_opening', params: {}, basis_rule_ids: annualRule ? [annualRule.id] : [] });
      }
      const years = Math.min(yearsSinceOpening ?? 0, 4);
      const lifetimeAllowance = base * (1 + years);
      isaAnnualRoom = Math.max(
        0,
        Math.min(lifetimeAllowance - accounts.isa.cumulative_contribution_krw, effectiveTotalLimit - accounts.isa.cumulative_contribution_krw),
      );
    }
  }
  if (!isaEligible) isaAnnualRoom = 0;

  // -- 배분 가능한 예산과 연금계좌 공유 풀 ---------------------------------
  const budget = profile.monthly_capacity_krw * months;
  const sharedPensionPoolBase = Math.max(
    0,
    pensionContributionCap - accounts.annuity_savings.ytd_contribution_krw - accounts.retirement_pension.ytd_contribution_krw,
  );
  const existingOverLimit =
    accounts.annuity_savings.ytd_contribution_krw + accounts.retirement_pension.ytd_contribution_krw > pensionContributionCap;
  if (existingOverLimit) {
    notices.push({ code: 'existing_contribution_over_limit', severity: 'warning', field: null, params: {}, basis_rule_ids: pensionContributionLimitRule ? [pensionContributionLimitRule.id] : [] });
  }

  // -- 배분안 3종 계산 ------------------------------------------------------
  const fillSequences = {
    max_tax_credit: ['annuity_savings', 'retirement_pension', 'isa'],
    annuity_savings_first: ['annuity_savings', 'retirement_pension', 'isa'],
    isa_first: ['isa', 'annuity_savings', 'retirement_pension'],
  };
  // annuity_savings_first는 신용 최적화를 위해 600만원에서 멈추지 않고 계속 채운다.
  const annuityCapByPlan = {
    max_tax_credit: annuityCreditCap,
    annuity_savings_first: Infinity,
    isa_first: annuityCreditCap,
  };

  const rawPlans = PLAN_ORDER.map((planId) => {
    const sequence = fillSequences[planId];
    let remainingBudget = budget;
    let pensionPool = sharedPensionPoolBase;
    let isaPool = isaAnnualRoom;
    const allocByAccount = {};
    const limitedBy = {};
    let order = 1;
    const fillOrderByAccount = {};

    for (const account of sequence) {
      let cap;
      let eligible = true;
      if (account === 'isa') {
        cap = isaPool;
        eligible = isaEligible;
      } else if (account === 'annuity_savings') {
        cap = Math.min(pensionPool, annuityCapByPlan[planId]);
      } else {
        cap = pensionPool;
      }
      if (!eligible) {
        allocByAccount[account] = 0;
        limitedBy[account] = 'not_eligible';
        continue;
      }
      const want = remainingBudget;
      const allocated = Math.max(0, Math.min(want, cap));
      allocByAccount[account] = allocated;
      if (allocated > 0) fillOrderByAccount[account] = order++;
      if (allocated < want) limitedBy[account] = cap <= want ? 'contribution_limit' : 'budget';
      else limitedBy[account] = null;
      remainingBudget -= allocated;
      if (account === 'isa') isaPool -= allocated;
      else pensionPool -= allocated;
    }

    const unallocated = remainingBudget;
    if (unallocated > 0 && Object.values(limitedBy).every((v) => v !== 'budget')) {
      // 세 계좌 모두 한도를 채우고 남은 경우
    }

    return { planId, sequence, allocByAccount, limitedBy, fillOrderByAccount, unallocated };
  });

  // -- 계좌별 세액공제 계산 -------------------------------------------------
  function creditFor(annuityAllocated, retirementAllocated) {
    let annuityBase = accounts.annuity_savings.ytd_contribution_krw + annuityAllocated;
    let retirementBase = accounts.retirement_pension.ytd_contribution_krw + retirementAllocated;
    if (transferDestination === 'annuity_savings') annuityBase += isaTransfer.amount_krw;
    if (transferDestination === 'retirement_pension') retirementBase += isaTransfer.amount_krw;

    const annuityCreditCapEffective = annuityCreditCap + (transferDestination === 'annuity_savings' ? extraCreditLimit : 0);
    const combinedCreditCapEffective = baseCombinedCreditCap + extraCreditLimit;

    const annuityCreditEligible = Math.min(annuityBase, annuityCreditCapEffective);
    const combinedCreditEligible = Math.min(annuityCreditEligible + retirementBase, combinedCreditCapEffective);
    return Math.max(0, combinedCreditEligible);
  }

  const plans = rawPlans.map((p) => {
    const creditEligible = creditFor(p.allocByAccount.annuity_savings, p.allocByAccount.retirement_pension);
    const incomeTaxKrw = Math.floor(creditEligible * incomeTaxRate);
    const localTaxKrw = Math.floor(creditEligible * localTaxRate);
    const totalCreditKrw = incomeTaxKrw + localTaxKrw;

    const allocations = ACCOUNTS.map((account) => {
      const annualKrw = p.allocByAccount[account] ?? 0;
      const monthlyKrw = months > 0 ? Math.floor(annualKrw / months) : 0;
      return {
        account,
        monthly_krw: monthlyKrw,
        annual_krw: annualKrw,
        fill_order: p.fillOrderByAccount[account] ?? null,
        limited_by: annualKrw === 0 ? p.limitedBy[account] ?? null : p.limitedBy[account] ?? null,
        basis_rule_ids:
          account === 'isa'
            ? [isaRequirementsRule?.id, scenario === 'proposed' ? 'proposed.isa.annual_contribution_limit' : 'isa.contribution.annual_limit'].filter(Boolean)
            : [pensionContributionLimitRule?.id].filter(Boolean),
      };
    });

    const totalAnnual = allocations.reduce((s, a) => s + a.annual_krw, 0);
    const totalMonthly = allocations.reduce((s, a) => s + a.monthly_krw, 0);
    const residual = months > 0 ? totalAnnual - totalMonthly * months : 0;

    const warnings = [];
    for (const a of allocations) {
      if (a.annual_krw <= 0) continue;
      if (a.account === 'isa') {
        if (profile.fund_use_horizon === 'within_isa_lock_in') {
          warnings.push(mkWarning('early_termination_clawback_isa', 'isa', 'warning', 'declared_horizon', use('isa.early_termination.clawback')?.id, use('isa.account.requirements')?.id));
        } else if (profile.fund_use_horizon === 'unknown') {
          warnings.push(mkWarning('early_termination_clawback_isa', 'isa', 'info', 'horizon_unknown', use('isa.early_termination.clawback')?.id, use('isa.account.requirements')?.id));
        }
      } else {
        if (profile.fund_use_horizon === 'within_isa_lock_in' || profile.fund_use_horizon === 'before_pension_age') {
          warnings.push(
            mkWarning(
              'early_withdrawal_penalty_pension',
              a.account,
              'warning',
              'declared_horizon',
              use('pension.withdrawal.eligibility')?.id,
              use('pension.early_withdrawal.other_income_rate')?.id,
            ),
          );
        } else if (profile.fund_use_horizon === 'unknown') {
          warnings.push(
            mkWarning(
              'early_withdrawal_penalty_pension',
              a.account,
              'info',
              'horizon_unknown',
              use('pension.withdrawal.eligibility')?.id,
              use('pension.early_withdrawal.other_income_rate')?.id,
            ),
          );
        }
      }
    }
    warnings.sort((a, b) => (ACCOUNTS.indexOf(a.account) - ACCOUNTS.indexOf(b.account)) || a.code.localeCompare(b.code));

    const priorityBasisCode = {
      max_tax_credit: 'tax_credit_maximization',
      annuity_savings_first: 'annuity_savings_limit_first',
      isa_first: 'isa_liquidity_first',
    }[p.planId];

    const nonQuantified = [];
    if (taxFreeLimit != null) {
      nonQuantified.push({
        code: 'isa_tax_free_headroom',
        account: 'isa',
        headroom_krw: taxFreeLimit,
        quantifiable: false,
        reason_code: 'depends_on_investment_return_not_in_ruleset',
        basis_rule_ids: isaTaxFreeRule ? [isaTaxFreeRule.id] : [],
      });
    }

    return {
      plan_id: p.planId,
      is_baseline: false,
      warnings,
      priority_basis: {
        code: priorityBasisCode,
        fill_sequence: p.sequence,
        basis_rule_ids:
          p.planId === 'isa_first'
            ? [use('pension.withdrawal.eligibility')?.id, use('isa.account.requirements')?.id].filter(Boolean)
            : [],
      },
      allocations: ACCOUNTS.map((a) => allocations.find((x) => x.account === a)),
      total_allocated_monthly_krw: totalMonthly,
      total_allocated_annual_krw: totalAnnual,
      unallocated_monthly_krw: months > 0 ? Math.floor(p.unallocated / months) : 0,
      unallocated_annual_krw: p.unallocated,
      monthly_rounding_residual_krw: residual,
      deterministic_benefit: {
        pension_credit_income_tax_krw: incomeTaxKrw,
        pension_credit_local_tax_krw: localTaxKrw,
        pension_credit_total_krw: totalCreditKrw,
        credit_eligible_contribution_krw: creditEligible,
        basis_rule_ids: [creditRateRule?.id, annuityCreditLimitRule?.id, combinedCreditLimitRule?.id, surtaxRule?.id].filter(Boolean),
      },
      delta_vs_baseline_krw: 0, // baseline 선정 후 채운다
      non_quantified_effects: nonQuantified,
      _allocationVector: ACCOUNTS.map((a) => p.allocByAccount[a] ?? 0).join('|'),
      _totalCredit: totalCreditKrw,
    };
  });

  // -- 배분 벡터가 같은 안 합치기 -------------------------------------------
  const seen = new Map();
  const collapsed = [];
  for (const plan of plans) {
    if (seen.has(plan._allocationVector)) continue;
    seen.set(plan._allocationVector, true);
    collapsed.push(plan);
  }

  // -- 기본안 선정 (fund_use_horizon이 정한다) ------------------------------
  function warningCount(plan) {
    return plan.warnings.filter((w) => w.severity === 'warning').length;
  }
  let baselineIndex = 0;
  if (profile.fund_use_horizon === 'within_isa_lock_in' || profile.fund_use_horizon === 'before_pension_age') {
    let best = 0;
    for (let i = 1; i < collapsed.length; i++) {
      if (warningCount(collapsed[i]) < warningCount(collapsed[best])) best = i;
    }
    baselineIndex = best;
  } else {
    const mtcIndex = collapsed.findIndex((p) => p.plan_id === 'max_tax_credit');
    baselineIndex = mtcIndex >= 0 ? mtcIndex : 0;
  }

  const baseline = collapsed[baselineIndex];
  const rest = collapsed.filter((_, i) => i !== baselineIndex);
  rest.sort((a, b) => PLAN_ORDER.indexOf(a.plan_id) - PLAN_ORDER.indexOf(b.plan_id));
  const orderedPlans = [baseline, ...rest];
  orderedPlans.forEach((p, i) => {
    p.is_baseline = i === 0;
    p.delta_vs_baseline_krw = i === 0 ? 0 : Math.min(0, p._totalCredit - baseline._totalCredit);
    delete p._allocationVector;
    delete p._totalCredit;
  });

  const comparisonNoteCodes = [];
  if (collapsed.length === 1) comparisonNoteCodes.push('plans_collapsed_single');
  if (profile.fund_use_horizon === 'within_isa_lock_in') {
    const allExposed = ACCOUNTS.every((account) => {
      const alloc = baseline.allocations.find((a) => a.account === account);
      if (!alloc || alloc.annual_krw <= 0) return true;
      return baseline.warnings.some((w) => w.account === account);
    });
    if (allExposed) comparisonNoteCodes.push('all_accounts_have_early_exit_penalty');
  }
  if (orderedPlans[0].plan_id !== 'max_tax_credit') comparisonNoteCodes.push('baseline_reordered_by_fund_use_horizon');
  if (orderedPlans.some((p) => !p.is_baseline && p.delta_vs_baseline_krw === 0)) comparisonNoteCodes.push('alternatives_have_equal_tax_credit');

  if (profile.fund_use_horizon === 'unknown') {
    notices.push({ code: 'fund_use_horizon_not_declared', severity: 'info', field: 'profile.fund_use_horizon', params: {}, basis_rule_ids: [] });
  }
  if (budget === 0) notices.push({ code: 'zero_capacity', severity: 'info', field: 'profile.monthly_capacity_krw', params: {}, basis_rule_ids: [] });
  const totalRemainingLimits = sharedPensionPoolBase + isaAnnualRoom;
  if (budget > totalRemainingLimits) notices.push({ code: 'budget_exceeds_all_limits', severity: 'info', field: null, params: {}, basis_rule_ids: [] });
  notices.push({ code: 'pension_holding_period_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });
  if (profile.declared_youth == null) {
    notices.push({ code: 'youth_status_not_declared', severity: 'info', field: 'profile.declared_youth', params: {}, basis_rule_ids: [] });
  }
  if (scenario === 'proposed') {
    const proposedRuleIds = [...usedRules.keys()].filter((id) => id.startsWith('proposed.'));
    notices.push({ code: 'proposed_not_enacted', severity: 'warning', field: null, params: {}, basis_rule_ids: proposedRuleIds });
  }

  // -- FundUseHorizonBoundaries ---------------------------------------------
  const boundaries = computeBoundariesInternal(
    { age_years: profile.age_years, isa_exists: accounts.isa.exists, isa_years_since_opening: accounts.isa.years_since_opening },
    rulesets,
    files,
  );

  // -- legal_basis -----------------------------------------------------------
  const legalBasis = [...usedRules.values()]
    .map(({ rule, appliedTo }) => toLegalBasisEntry(rule, [...appliedTo]))
    .sort((a, b) => {
      const statusOrder = (s) => (s === '확정' ? 0 : 1);
      const so = statusOrder(a.status) - statusOrder(b.status);
      return so !== 0 ? so : a.rule_id.localeCompare(b.rule_id);
    });

  const billStages = [...new Set(legalBasis.filter((l) => l.bill_stage).map((l) => l.bill_stage))];

  // -- unapplied_proposed_rules -----------------------------------------------
  const unapplied = [];
  if (scenario === 'proposed' && rulesets['2027-proposed.json']) {
    const appliedIds = new Set(usedRules.keys());
    const reasonFor = {
      'proposed.productive_isa.introduction': 'out_of_product_scope',
      'proposed.productive_isa.eligibility': 'out_of_product_scope',
      'proposed.productive_isa.account_requirements': 'out_of_product_scope',
      'proposed.productive_isa.contribution_limit': 'out_of_product_scope',
      'proposed.productive_isa.youth_income_deduction': 'requires_input_not_collected',
      'proposed.productive_isa.pension_transfer.additional_contribution': 'out_of_product_scope',
      'proposed.productive_isa.pension_transfer.credit_extra_limit': 'out_of_product_scope',
      'proposed.pension.credit.youth_irp_rate': 'requires_input_not_collected',
      'proposed.productive_isa.rural_special_tax_exemption': 'out_of_product_scope',
      'proposed.isa.contract_period': 'affects_multi_year_only',
      'proposed.isa.sunset': 'affects_multi_year_only',
    };
    for (const rule of rulesets['2027-proposed.json'].rules) {
      if (appliedIds.has(rule.id)) continue;
      unapplied.push({ rule_id: rule.id, title: rule.title, reason_code: reasonFor[rule.id] ?? 'out_of_product_scope' });
    }
  }

  return {
    scenario_id: scenario,
    is_enacted: isEnacted,
    bill_stages: billStages,
    ruleset: {
      files,
      tax_year: rulesets[files[0]]?.tax_year ?? request.tax_year,
      status: rulesets['2026.json']?.status ?? '확정',
      effective_from: rulesets['2026.json']?.effective_from ?? '2026-01-01',
    },
    account_eligibility: accountEligibility,
    limits: {
      by_account: ACCOUNTS.map((account) => {
        if (account === 'isa') {
          return {
            account,
            contribution_limit_remaining_krw: isaAnnualRoom,
            credit_eligible_limit_remaining_krw: null,
            tax_free_limit_krw: taxFreeLimit,
            clamped_to_zero: accounts.isa.cumulative_contribution_krw > effectiveTotalLimit,
            basis_rule_ids: [isaRequirementsRule?.id].filter(Boolean),
          };
        }
        const ytd = accounts[account].ytd_contribution_krw;
        const cap = account === 'annuity_savings' ? annuityCreditCap : baseCombinedCreditCap + extraCreditLimit;
        return {
          account,
          contribution_limit_remaining_krw: sharedPensionPoolBase,
          credit_eligible_limit_remaining_krw: Math.max(0, cap - ytd),
          tax_free_limit_krw: null,
          clamped_to_zero: ytd > pensionContributionCap,
          basis_rule_ids: [pensionContributionLimitRule?.id].filter(Boolean),
        };
      }),
      pension_combined_credit_limit_krw: baseCombinedCreditCap + extraCreditLimit,
      pension_combined_credit_remaining_krw: Math.max(
        0,
        baseCombinedCreditCap +
          extraCreditLimit -
          Math.min(accounts.annuity_savings.ytd_contribution_krw, annuityCreditCap) -
          accounts.retirement_pension.ytd_contribution_krw,
      ),
      pension_contribution_limit_remaining_krw: sharedPensionPoolBase,
      basis_rule_ids: [combinedCreditLimitRule?.id, pensionContributionLimitRule?.id].filter(Boolean),
    },
    isa_transfer_extra_limit: isaTransferExtraLimit,
    fund_use_horizon_boundaries: boundaries.boundaries,
    plans: orderedPlans,
    comparison_note_codes: comparisonNoteCodes,
    legal_basis: legalBasis,
    unapplied_proposed_rules: unapplied,
    notices,
    _missingRules: missingRules,
  };
}

function mkWarning(code, account, severity, trigger, ruleId1, ruleId2) {
  return {
    code,
    account,
    severity,
    trigger,
    basis_rule_ids: [ruleId1, ruleId2].filter(Boolean),
    params: {},
  };
}

// ---------------------------------------------------------------------------
// 경계값 계산 (공용 — compute와 computeFundUseHorizonBoundaries가 함께 쓴다)
// ---------------------------------------------------------------------------

function computeBoundariesInternal(input, rulesets, files) {
  const isaRule = findRule(rulesets, 'isa.account.requirements', files)?.rule;
  const pensionRule = findRule(rulesets, 'pension.withdrawal.eligibility', files)?.rule;
  const clawbackRule = findRule(rulesets, 'isa.early_termination.clawback', files)?.rule;

  const lockInYears = isaRule ? isaRule.value.min_contract_years : null;
  const yearsSince = input.isa_years_since_opening;
  const lockInRemaining =
    lockInYears == null ? null : Math.max(0, lockInYears - (yearsSince ?? 0));

  const minAge = pensionRule ? pensionRule.value.requirements.find((r) => r.id === 'age')?.min_age ?? null : null;
  const pensionRemaining = minAge == null ? null : Math.max(0, minAge - input.age_years);

  const notices = [];
  if (input.isa_exists && yearsSince == null) {
    notices.push({ code: 'isa_tenure_missing', severity: 'warning', field: 'accounts.isa.years_since_opening', params: {}, basis_rule_ids: isaRule ? [isaRule.id] : [] });
  }
  notices.push({ code: 'pension_holding_period_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });

  const legalBasis = [isaRule, pensionRule, clawbackRule]
    .filter(Boolean)
    .map((r) => toLegalBasisEntry(r, ['fund_use_horizon_boundaries']));

  return {
    boundaries: {
      isa_lock_in_years: lockInYears,
      isa_lock_in_years_remaining: lockInRemaining,
      pension_min_age_years: minAge,
      pension_years_remaining: pensionRemaining,
      pension_holding_period_evaluated: false,
      basis_rule_ids: [isaRule?.id, clawbackRule?.id, pensionRule?.id].filter(Boolean),
    },
    legal_basis: legalBasis,
    notices,
  };
}

// ---------------------------------------------------------------------------
// 공개 진입점
// ---------------------------------------------------------------------------

export function compute(request, rulesets) {
  const errors = validateRequest(request);
  if (errors.length > 0) {
    return { ok: false, schema_version: request?.schema_version ?? '2.1.0', errors };
  }

  const months = request.profile.months_remaining_in_tax_year ?? 12;
  const req = { ...request, months_remaining_effective: months };

  const uniqueScenarios = SCENARIO_ORDER.filter((s) => request.scenarios.includes(s));
  const scenarios = uniqueScenarios.map((s) => computeScenario(s, req, rulesets));

  const missing = scenarios.flatMap((s) => s._missingRules || []);
  if (missing.length > 0) {
    return {
      ok: false,
      schema_version: request.schema_version,
      errors: [...new Set(missing)].map((ruleId) => err('rule_missing', null, { rule_id: ruleId })),
    };
  }
  scenarios.forEach((s) => delete s._missingRules);

  const assumptions = [];
  const applyAll = uniqueScenarios;
  if (request.profile.months_remaining_in_tax_year == null) {
    assumptions.push({ code: 'months_remaining_defaulted', params: { months: 12 }, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (!request.accounts.isa.exists) {
    assumptions.push({ code: 'isa_new_account_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (request.accounts.isa.exists && request.accounts.isa.years_since_opening == null) {
    assumptions.push({ code: 'isa_tenure_zero_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (request.accounts.isa.other_savings_contract_krw == null) {
    assumptions.push({ code: 'other_savings_zero_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (request.isa_transfer && request.isa_transfer.prior_year_applied_extra_credit_krw == null) {
    assumptions.push({ code: 'prior_transfer_credit_zero_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  assumptions.push({ code: 'single_tax_year_only', params: { tax_year: request.tax_year }, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'other_deductions_excluded', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'rounding_floor_to_won', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'isa_benefit_not_quantified', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'fund_use_horizon_excluded_from_amounts', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'early_exit_penalty_not_quantified', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'pension_holding_period_not_evaluated', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });

  // echo.credit_rate_bracket은 확정 룰셋(2026.json) 기준으로 채운다 — 개정예고가
  // 있어도 echo는 요청 자체(해당 과세연도 소득)에서 결정되는 값이라 시나리오와 무관하다.
  const creditRateRule = findRule(rulesets, 'pension.credit.rate', ['2026.json']).rule;
  const surtaxRule = findRule(rulesets, 'tax.local.personal_income_surtax', ['2026.json']).rule;
  const bracket = creditRateRule.value.brackets.find(
    (b) => b.total_salary_only_max_krw == null || request.profile.current_year_total_salary_krw <= b.total_salary_only_max_krw,
  );
  const incomeTaxRate = bracket.rate;
  const localTaxRate = incomeTaxRate * surtaxRule.value.rate_of_income_tax;

  return {
    ok: true,
    schema_version: request.schema_version,
    echo: {
      tax_year: request.tax_year,
      monthly_capacity_krw: request.profile.monthly_capacity_krw,
      months_remaining_in_tax_year: months,
      annual_budget_krw: request.profile.monthly_capacity_krw * months,
      fund_use_horizon: request.profile.fund_use_horizon,
      fund_use_horizon_affects: {
        allocation_amounts: false,
        tax_credit_amounts: false,
        limits: false,
        plan_ordering: true,
        baseline_selection: true,
        warnings: true,
      },
      credit_rate_bracket: {
        income_tax_rate: incomeTaxRate,
        local_tax_rate: localTaxRate,
        effective_rate: incomeTaxRate + localTaxRate,
        basis_rule_ids: [creditRateRule.id, surtaxRule.id],
      },
    },
    scenarios,
    assumptions,
  };
}

export function computeFundUseHorizonBoundaries(request, rulesets) {
  const errors = [];
  if (request?.schema_version == null) errors.push(err('missing_required', 'schema_version', {}));
  else if (String(request.schema_version).split('.')[0] !== KNOWN_SCHEMA_MAJOR)
    errors.push(err('schema_version_mismatch', 'schema_version', {}));
  if (request?.tax_year == null) errors.push(err('missing_required', 'tax_year', {}));
  if (request?.age_years == null) errors.push(err('missing_required', 'age_years', {}));
  else if (!isInt(request.age_years) || request.age_years < 0) errors.push(err('negative_value', 'age_years', {}));
  if (request?.isa_exists == null) errors.push(err('missing_required', 'isa_exists', {}));
  if (request?.isa_years_since_opening != null && !isInt(request.isa_years_since_opening)) {
    errors.push(err('not_integer', 'isa_years_since_opening', {}));
  }
  if (request?.scenario != null && !SCENARIO_ORDER.includes(request.scenario)) {
    errors.push(err('unknown_scenario', 'scenario', {}));
  }

  if (errors.length > 0) return { ok: false, schema_version: request?.schema_version ?? '2.1.0', errors };

  const scenario = request.scenario ?? 'current';
  const files = fileKeysForScenario(scenario).filter((k) => rulesets[k]);
  const result = computeBoundariesInternal(
    { age_years: request.age_years, isa_exists: request.isa_exists, isa_years_since_opening: request.isa_years_since_opening },
    rulesets,
    files,
  );

  return {
    ok: true,
    schema_version: request.schema_version,
    boundaries: result.boundaries,
    legal_basis: result.legal_basis,
    notices: result.notices,
  };
}
