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
  resolveRates,
  resolveTransfer,
} from './limits.mjs';
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
  });
  notices.push(...eligibilityResult.notices);
  const isaEligible = eligibilityResult.eligibility.find((e) => e.account === ACCOUNT.ISA).eligible;

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
    ageYears: request.profile.age_years,
    isaExists: request.accounts.isa.exists,
    isaYearsSinceOpening: request.accounts.isa.years_since_opening,
  });

  // 필요한 규칙이나 값을 하나라도 읽지 못했으면 중단한다. 대체값을 만들지 않는다.
  const missing = access.missing();
  if (missing.length > 0 || limitResult.limits === null || rates.incomeTaxRate === null) {
    return { errors: dedupeErrors(missing.length > 0 ? missing : [ruleMissingFallback()]) };
  }

  // 7. 예산
  const months = request.profile.months_remaining_in_tax_year;
  const budget = request.profile.monthly_capacity_krw * months;

  // 8~10. 배분안 생성·평가·합치기, 그리고 11~12. 경고와 기본안 선택
  const eligible = Object.fromEntries(
    eligibilityResult.eligibility.map((e) => [e.account, e.eligible]),
  );
  const { plans, comparisonNotes } = buildPlans({
    access,
    options: request.options,
    horizon: request.profile.fund_use_horizon,
    months,
    budget,
    state: limitResult.state,
    rates,
    eligible,
    boundaries,
  });

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
      ageYears: normalized.ageYears,
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
