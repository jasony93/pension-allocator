// 진입점 조립. engine-design.md 5절의 계산 순서를 그대로 따른다.

import {
  ACCOUNT,
  ASSUMPTION,
  DEFAULT_UNAPPLIED_REASON,
  HORIZON,
  NOTICE,
  REASON_INPUT_MISSING,
  RULE,
  RULESET_STATUS,
  SCENARIO,
  SCHEMA_VERSION,
  UNAPPLIED_REASON,
} from './constants.mjs';
import { boundariesFrom, boundariesSource, dedupeErrors } from './boundaries.mjs';
import { buildPlans } from './plans.mjs';
import { buildLegalBasis, createAccess, selectRulesets } from './ruleset.mjs';
import { effectiveRate } from './ratio.mjs';
import {
  notice,
  resolveEligibility,
  resolveLimits,
  resolvePensionStartDates,
  resolveRates,
  resolveTaxLiabilityCap,
  resolveTransfer,
  resolveWithdrawalOrder,
} from './limits.mjs';
import { ageOn, endOfTaxYear, formatIsoDate } from './dates.mjs';
import { validateBoundariesRequest, validateRequest } from './validate.mjs';

export function compute(request, rulesets) {
  // 1. 입력 검증 — 발견한 오류를 전부 담는다.
  const { errors: validationErrors, normalized } = validateRequest(request);
  if (validationErrors.length > 0) return failure(request, validationErrors);

  const scenarioResults = [];
  const errors = [];
  let creditRateBracket = null;

  for (const scenarioId of normalized.scenarios) {
    const outcome = computeScenario(scenarioId, normalized, rulesets);
    if (outcome.errors) {
      errors.push(...outcome.errors);
      continue;
    }
    scenarioResults.push(outcome.scenario);
    creditRateBracket ??= outcome.creditRateBracket;
  }

  if (errors.length > 0) return failure(request, dedupeErrors(errors));

  const months = normalized.profile.months_remaining_in_tax_year;
  const referenceDate = endOfTaxYear(normalized.tax_year);
  return {
    ok: true,
    schema_version: normalized.schema_version,
    echo: {
      tax_year: normalized.tax_year,
      monthly_capacity_krw: normalized.profile.monthly_capacity_krw,
      months_remaining_in_tax_year: months,
      annual_budget_krw: normalized.profile.monthly_capacity_krw * months,
      fund_use_horizon: normalized.profile.fund_use_horizon,
      // 계약이 스스로 선언한다 — 이 입력은 금액을 바꾸지 않는다.
      fund_use_horizon_affects: {
        allocation_amounts: false,
        tax_credit_amounts: false,
        limits: false,
        plan_ordering: true,
        baseline_selection: true,
        warnings: true,
      },
      credit_rate_bracket: creditRateBracket,
      // 화면이 만 나이를 만들지 않는다(D21). 환산 결과와 **그 기준일**을 함께 되돌려 주어
      // 무엇을 기준으로 센 나이인지가 응답만 보고도 드러나게 한다.
      derived_age: {
        age_years: ageOn(normalized.profile.birth_date, referenceDate),
        reference_date: formatIsoDate(referenceDate),
        // 기준일을 정하는 규칙이 룰셋에 없다. 엔진이 만들지 않았다는 사실을 값으로 낸다.
        reference_date_from_ruleset: false,
      },
      // 세액 한도가 무엇을 바꾸고 무엇을 바꾸지 않는지. fund_use_horizon과 같은 형태의
      // 자기 선언이고, 값이 고정이라 qa가 실제 동작과 대조할 수 있다.
      tax_liability_cap_affects: {
        allocation_amounts: false,
        tax_credit_amounts: true,
        limits: false,
        plan_ordering: false,
        baseline_selection: false,
        warnings: false,
      },
    },
    scenarios: scenarioResults,
    assumptions: buildAssumptions(normalized),
  };
}

function computeScenario(scenarioId, request, rulesets) {
  // 2. 룰셋 로드
  const selection = selectRulesets(rulesets, request.tax_year, scenarioId);
  if (selection.errors) return { errors: selection.errors };

  const access = createAccess(selection);
  const notices = [];

  // 3. 파생 비율
  const { rates, notices: rateNotices } = resolveRates(access, { profile: request.profile, scenarioId });
  notices.push(...rateNotices);

  // 4. 계좌 자격
  const eligibilityResult = resolveEligibility(access, {
    profile: request.profile,
    accounts: request.accounts,
    taxYear: request.tax_year,
  });
  notices.push(...eligibilityResult.notices);
  const isaEligible = eligibilityResult.eligibility.find((e) => e.account === ACCOUNT.ISA).eligible;

  // 4.5. 세액 한도. **마지막에 걸리는 상한이 아니라 계산 전체의 전제다**(규칙의 engine_note).
  const capResult = resolveTaxLiabilityCap(access, { priorYearTax: request.profile.prior_year_tax });
  notices.push(...capResult.notices);

  // 4.6. 연금으로 꺼낼 수 있는 가장 이른 시점. 배분 비율을 바꾸지 않는다 — 시점만 낸다.
  const startDateResult = resolvePensionStartDates(access, {
    birthDate: request.profile.birth_date,
    taxYear: request.tax_year,
    accounts: request.accounts,
  });
  notices.push(...startDateResult.notices);

  // 5~6. 전환 추가한도와 계좌별 한도
  const transferResult = resolveTransfer(access, { request, scenarioId });
  notices.push(...transferResult.notices);

  const limitResult = resolveLimits(access, {
    request,
    scenarioId,
    transfer: transferResult.transfer,
    isaEligible,
  });
  notices.push(...limitResult.notices);

  const boundaries = boundariesFrom(access, {
    birthDate: request.profile.birth_date,
    taxYear: request.tax_year,
    isaExists: request.accounts.isa.exists,
    isaYearsSinceOpening: request.accounts.isa.years_since_opening,
  });

  // 필요한 규칙이나 값을 하나라도 읽지 못했으면 중단한다. 대체값을 만들지 않는다.
  const missing = access.missing();
  if (
    missing.length > 0 ||
    limitResult.limits === null ||
    rates.incomeTaxRate === null ||
    capResult.cap === null ||
    startDateResult.entries === null
  ) {
    return { errors: dedupeErrors(missing.length > 0 ? missing : [ruleMissingFallback()]) };
  }

  // 7. 예산
  const months = request.profile.months_remaining_in_tax_year;
  const budget = request.profile.monthly_capacity_krw * months;

  // 8~10. 배분안 생성·평가·합치기, 그리고 11~12. 경고와 기본안 선택
  const eligible = Object.fromEntries(
    eligibilityResult.eligibility.map((e) => [e.account, e.eligible]),
  );
  // 세제상 동점 구간에서 쓸 연금계좌 순서. 사실은 룰셋에서 읽고 판단은 제품이 한다.
  const withdrawalOrder = resolveWithdrawalOrder(access);

  const { plans, comparisonNotes } = buildPlans({
    access,
    withdrawalOrder,
    options: request.options,
    horizon: request.profile.fund_use_horizon,
    months,
    budget,
    state: limitResult.state,
    rates,
    eligible,
    boundaries,
    cap: capResult.cap,
    startDates: startDateResult.entries,
  });

  if (plans.some((plan) => plan.deterministic_benefit.tax_liability_cap.applied)) {
    notices.push(
      notice(NOTICE.TAX_CAP_APPLIED, 'info', null, {}, capResult.cap.basis_rule_ids),
    );
  }

  // 13~14. 안내·근거·메타
  if (request.profile.monthly_capacity_krw === 0) {
    notices.push(notice(NOTICE.ZERO_CAPACITY, 'info', 'profile.monthly_capacity_krw'));
  }
  const maxFillable = Math.max(...plans.map((p) => p.total_allocated_annual_krw));
  if (budget > maxFillable) {
    notices.push(notice(NOTICE.BUDGET_EXCEEDS_ALL_LIMITS, 'info', null, { unallocated_krw: budget - maxFillable }));
  }
  if (plans.length === 1) {
    notices.push(notice(NOTICE.PLANS_COLLAPSED_SINGLE, 'info', null));
  }
  if (request.profile.fund_use_horizon === HORIZON.UNKNOWN) {
    notices.push(notice(NOTICE.HORIZON_NOT_DECLARED, 'info', 'profile.fund_use_horizon'));
  }
  // 사용자가 "의무가입기간 안에 쓸 수 있다"를 골랐는데 그 기간이 이미 지났다.
  // ISA 추징 경고는 성립하지 않아 끄지만(M2), 입력이 현실과 어긋난다는 사실 자체는
  // 화면이 알아야 다시 물어보든 문구를 바꾸든 할 수 있다. 경고가 아니라 사실 통지다.
  if (
    request.profile.fund_use_horizon === HORIZON.WITHIN_ISA_LOCK_IN &&
    boundaries.isa_lock_in_years_remaining === 0
  ) {
    notices.push(
      notice(NOTICE.ISA_LOCK_IN_ELAPSED, 'info', 'profile.fund_use_horizon', {}, [
        RULE.ISA_CLAWBACK,
        RULE.ISA_ACCOUNT_REQUIREMENTS,
      ]),
    );
  }
  notices.push(
    notice(NOTICE.PENSION_HOLDING_NOT_EVALUATED, 'info', null, {}, [RULE.PENSION_WITHDRAWAL_ELIGIBILITY]),
  );

  const isProposed = scenarioId === SCENARIO.PROPOSED;
  if (isProposed) {
    notices.push(notice(NOTICE.PROPOSED_NOT_ENACTED, 'warning', null));
  }

  const legalBasis = request.options.include_legal_basis ? buildLegalBasis(access) : [];

  return {
    creditRateBracket: {
      income_tax_rate: rates.incomeTaxRate,
      local_tax_rate: rates.surtaxRate,
      effective_rate: effectiveRate(rates.incomeTaxRate, rates.surtaxRate),
      basis_rule_ids: [RULE.CREDIT_RATE, RULE.LOCAL_SURTAX].sort(),
    },
    scenario: {
      scenario_id: scenarioId,
      is_enacted: !isProposed,
      ruleset: {
        files: selection.files,
        tax_year: selection.base.doc.tax_year,
        status: (isProposed ? selection.proposed : selection.base).doc.status,
        effective_from: (isProposed ? selection.proposed : selection.base).doc.effective_from,
      },
      // 룰셋 값을 그대로 읽는다. 엔진도 화면도 이 문자열을 코드에 박지 않는다.
      bill_stages: collectBillStages(access),
      account_eligibility: eligibilityResult.eligibility,
      limits: limitResult.limits,
      pension_credit_tax_liability_cap: capResult.cap,
      pension_withdrawal_start: startDateResult.entries,
      isa_transfer_extra_limit: transferResult.transfer
        ? {
            transfer_amount_krw: transferResult.transfer.amount_krw,
            destination: transferResult.transfer.destination,
            extra_credit_limit_krw: transferResult.transfer.extra_credit_limit_krw,
            prior_applied_deducted_krw: transferResult.transfer.prior_applied_deducted_krw,
            counted_as_contribution_krw: transferResult.transfer.amount_krw,
            basis_rule_ids: transferResult.transfer.basis_rule_ids,
          }
        : null,
      fund_use_horizon_boundaries: boundaries,
      plans,
      comparison_note_codes: comparisonNotes,
      legal_basis: legalBasis,
      unapplied_proposed_rules: isProposed ? collectUnapplied(access, selection, request) : [],
      notices,
    },
  };
}

function collectBillStages(access) {
  const stages = new Set();
  for (const [, { rule }] of access.usedEntries()) {
    if (rule.status === RULESET_STATUS.PROPOSED && rule.bill_stage) stages.add(rule.bill_stage);
  }
  return [...stages].sort();
}

/**
 * 반영하지 않은 개정예고 규칙. 무엇을 빼고 계산했는지가 드러나지 않으면
 * 사용자는 개정안 전부가 반영된 결과로 읽는다.
 */
function collectUnapplied(access, selection, request) {
  const used = new Set(access.usedEntries().map(([id]) => id));

  return selection.proposed.doc.rules
    .filter((rule) => !used.has(rule.id))
    .map((rule) => ({
      rule_id: rule.id,
      title: rule.title,
      reason_code: unappliedReason(rule.id, request),
    }))
    .sort((a, b) => a.rule_id.localeCompare(b.rule_id));
}

function unappliedReason(ruleId, request) {
  if (ruleId === RULE.PROPOSED_YOUTH_IRP_RATE && request.profile.declared_youth !== true) {
    return REASON_INPUT_MISSING;
  }
  if (ruleId === RULE.PROPOSED_TRANSFER_EXTRA && request.isa_transfer === null) {
    return REASON_INPUT_MISSING;
  }
  return UNAPPLIED_REASON[ruleId] ?? DEFAULT_UNAPPLIED_REASON;
}

function buildAssumptions(request) {
  const scenarios = request.scenarios;
  const out = [];
  const add = (code, params = {}, basisRuleIds = []) =>
    out.push({ code, params, applies_to_scenarios: scenarios, basis_rule_ids: basisRuleIds });

  if (request.profile.months_defaulted) {
    add(ASSUMPTION.MONTHS_DEFAULTED, { months: request.profile.months_remaining_in_tax_year });
  }

  // 만 나이의 기준일을 정하는 규칙이 룰셋에 없다. **엔진이 규칙을 만들지 않는다** —
  // 쓴 값과 그것이 룰셋 근거가 아니라는 사실을 가정으로 내보내고 tax-domain에 넘긴다.
  // 근거 규칙이 비어 있는 것은 rounding_floor_to_won과 같은 이유다.
  add(ASSUMPTION.AGE_REFERENCE_DATE, {
    reference_date: formatIsoDate(endOfTaxYear(request.tax_year)),
  });

  if (!request.profile.prior_year_tax.pension_credit_provided) {
    // 되더하기의 가산항을 0으로 두었다. 한도가 과소로 나오는 방향이고,
    // 과소한 한도는 절세액을 과대로 만들지 않는다.
    add(ASSUMPTION.PRIOR_PENSION_CREDIT_ZERO, {}, [RULE.CREDIT_TAX_CAP_SOURCE]);
  }
  add(ASSUMPTION.LOCAL_TAX_FOLLOWS_CAP, {}, [RULE.CREDIT_TAX_CAP, RULE.LOCAL_SURTAX]);

  const retirementTransferIn =
    request.accounts.annuity_savings.retirement_transfer_in_krw +
    request.accounts.retirement_pension.retirement_transfer_in_krw;
  if (retirementTransferIn > 0) {
    add(ASSUMPTION.RETIREMENT_TRANSFER_IN_CONTRIBUTION_LIMIT, { amount_krw: retirementTransferIn }, [
      RULE.CREDIT_EXCLUDED_CONTRIBUTIONS,
      RULE.PENSION_CONTRIBUTION_LIMIT,
    ]);
  }
  if (
    [ACCOUNT.ANNUITY, ACCOUNT.PENSION].some(
      (account) => request.accounts[account].has_deferred_retirement_income === null,
    )
  ) {
    // 없다고 보면 5년 요건이 살아 있어 잠금기간을 길게 본다 = 보수적이다.
    add(ASSUMPTION.DEFERRED_RETIREMENT_INCOME_ABSENT, {}, [RULE.PENSION_EARLIEST_START]);
  }
  if (!request.accounts.isa.exists) add(ASSUMPTION.ISA_NEW_ACCOUNT);
  if (!request.accounts.isa.years_since_opening_provided) add(ASSUMPTION.ISA_TENURE_ZERO);
  if (!request.accounts.isa.other_savings_provided) add(ASSUMPTION.OTHER_SAVINGS_ZERO);
  if (request.isa_transfer !== null && !request.isa_transfer.prior_year_provided) {
    add(ASSUMPTION.PRIOR_TRANSFER_CREDIT_ZERO);
  }

  add(ASSUMPTION.SINGLE_TAX_YEAR);
  add(ASSUMPTION.OTHER_DEDUCTIONS_EXCLUDED);
  // 원 미만 버림은 룰셋 근거가 아니라 엔진의 표시 규칙이다. 그래서 근거 규칙이 비어 있다.
  add(ASSUMPTION.ROUNDING_FLOOR);
  add(ASSUMPTION.ISA_BENEFIT_NOT_QUANTIFIED, {}, [RULE.ISA_TAX_FREE_LIMIT]);
  add(ASSUMPTION.HORIZON_EXCLUDED_FROM_AMOUNTS);
  add(ASSUMPTION.EARLY_EXIT_NOT_QUANTIFIED, {}, [
    RULE.ISA_CLAWBACK,
    RULE.PENSION_EARLY_WITHDRAWAL_RATE,
  ]);
  add(ASSUMPTION.PENSION_HOLDING_NOT_EVALUATED, {}, [RULE.PENSION_WITHDRAWAL_ELIGIBILITY]);

  return out;
}

function ruleMissingFallback() {
  return { code: 'rule_missing', field: null, params: {} };
}

function failure(request, errors) {
  return {
    ok: false,
    schema_version: typeof request?.schema_version === 'string' ? request.schema_version : SCHEMA_VERSION,
    errors,
  };
}

/** 읽기 전용 조회. 배분을 계산하지 않는다. */
export function computeFundUseHorizonBoundaries(request, rulesets) {
  const { errors, normalized } = validateBoundariesRequest(request);
  if (errors.length > 0) return failure(request, errors);

  const outcome = boundariesSource(
    {
      birthDate: normalized.birthDate,
      isaExists: normalized.isaExists,
      isaYearsSinceOpening: normalized.isaYearsSinceOpening,
    },
    rulesets,
    normalized.scenario,
    normalized.taxYear,
  );

  if (!outcome.ok) return failure(request, outcome.errors);

  const notices = [];
  if (!normalized.isaTenureProvided) {
    notices.push(notice(NOTICE.ISA_TENURE_MISSING, 'warning', 'isa_years_since_opening', {}, [
      RULE.ISA_ACCOUNT_REQUIREMENTS,
    ]));
  }
  notices.push(
    notice(NOTICE.PENSION_HOLDING_NOT_EVALUATED, 'info', null, {}, [RULE.PENSION_WITHDRAWAL_ELIGIBILITY]),
  );

  return {
    ok: true,
    schema_version: normalized.schema_version,
    boundaries: outcome.boundaries,
    legal_basis: buildLegalBasis(outcome.access),
    notices,
  };
}
