// 한도와 비율 산출. 모든 수치는 access를 통해 룰셋에서만 온다.
// 납입할 수 있는 한도와 세액공제를 받을 수 있는 한도는 다른 것이고,
// 룰셋도 두 규칙군으로 나눠 두었다(engine-interface.md 5.3절).

import {
  ACCOUNT,
  ACCOUNT_TYPE_IN_RULESET,
  ERROR,
  NOTICE,
  RULE,
  SCENARIO,
} from './constants.mjs';
import { applyRate, clampToZero, effectiveRate } from './ratio.mjs';

/** 룰셋 산식에서 경과연수 상한을 읽는다. 숫자를 코드에 박지 않기 위한 것이다. */
function readTenureCap(formula) {
  const match = /min\([^,]*,\s*(\d+)\s*\)/.exec(formula);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function resolveRates(access, { profile, scenarioId }) {
  const notices = [];

  const brackets = access.value(RULE.CREDIT_RATE, ['value', 'brackets'], 'echo.credit_rate_bracket');
  let incomeTaxRate;
  if (brackets !== undefined) {
    // 근로소득자만 다룬다(게이트 1 D2). 법문이 '이하'이므로 경계값은 그 구간에 든다.
    const bracket = brackets.find(
      (b) =>
        b.total_salary_only_max_krw === null ||
        b.total_salary_only_max_krw === undefined ||
        profile.current_year_total_salary_krw <= b.total_salary_only_max_krw,
    );
    if (bracket === undefined || typeof bracket.rate !== 'number') {
      access.value(RULE.CREDIT_RATE, ['value', 'brackets', 'rate'], 'echo.credit_rate_bracket');
    } else {
      incomeTaxRate = bracket.rate;
    }
  }

  const surtaxRate = access.value(
    RULE.LOCAL_SURTAX,
    ['value', 'rate_of_income_tax'],
    'plans[].deterministic_benefit.pension_credit_local_tax_krw',
  );

  let youthIrpRate = null;
  if (scenarioId === SCENARIO.PROPOSED) {
    if (profile.declared_youth === true) {
      const rate = access.value(
        RULE.PROPOSED_YOUTH_IRP_RATE,
        ['value', 'rate'],
        'plans[].deterministic_benefit.pension_credit_income_tax_krw',
      );
      if (rate !== undefined) youthIrpRate = rate;
      notices.push(notice(NOTICE.YOUTH_AGE_UNDETERMINED, 'warning', 'profile.declared_youth', {}, [
        RULE.PROPOSED_YOUTH_IRP_RATE,
      ]));
    } else {
      // 엔진이 나이로 청년 여부를 판정하지 않는다. 연령 범위가 시행령 위임이고 미공개다.
      notices.push(notice(NOTICE.YOUTH_NOT_DECLARED, 'info', 'profile.declared_youth', {}, []));
    }
  }

  return {
    notices,
    rates: {
      incomeTaxRate: incomeTaxRate ?? null,
      surtaxRate: surtaxRate ?? null,
      youthIrpRate,
      effective:
        incomeTaxRate !== undefined && surtaxRate !== undefined
          ? effectiveRate(incomeTaxRate, surtaxRate)
          : null,
    },
  };
}

/**
 * 세제상 동점일 때 쓸 연금계좌 순서를 룰셋에서 읽는다.
 *
 * `pension.withdrawal.midterm_restriction`이 두 계좌의 **인출 가능성 비대칭**을 사실로
 * 정한다 — 퇴직연금은 시행령이 열거한 사유에만 부분 인출이 되고, 연금저축에는 그런
 * 제한이 없다. 과세는 두 계좌가 같으므로 이 규칙은 세액을 바꾸지 않는다.
 *
 * **결론(어느 쪽을 먼저 채울지)은 룰셋이 정하지 않는다**(규칙의 product_note).
 * 엔진이 읽는 것은 `partial_withdrawal_without_statutory_cause`라는 사실이고,
 * "동점이면 덜 묶이는 쪽을 먼저"라는 판단은 제품 결정이다(engine-design.md 3.3절).
 *
 * 사유 '목록'은 미확정이므로 목록에 의존하지 않는다. 쓰는 것은 열거주의라는 구조뿐이다.
 */
export function resolveWithdrawalOrder(access) {
  const appliedTo = 'plans[].priority_basis';
  const byAccount = access.value(
    RULE.PENSION_MIDTERM_RESTRICTION,
    ['value', 'by_account'],
    appliedTo,
  );
  if (byAccount === undefined) return null;

  const flexible = {};
  for (const account of [ACCOUNT.PENSION, ACCOUNT.ANNUITY]) {
    const node = byAccount[ACCOUNT_TYPE_IN_RULESET[account]];
    if (node === undefined || typeof node.partial_withdrawal_without_statutory_cause !== 'boolean') {
      access.value(
        RULE.PENSION_MIDTERM_RESTRICTION,
        ['value', 'by_account', ACCOUNT_TYPE_IN_RULESET[account], 'partial_withdrawal_without_statutory_cause'],
        appliedTo,
      );
      return null;
    }
    flexible[account] = node.partial_withdrawal_without_statutory_cause;
  }

  // 인출이 자유로운 계좌를 앞에 둔다. 정렬이 안정적이므로 두 계좌의 조건이 같으면
  // 기존 고정 순서가 그대로 유지된다 — 결정성이 깨지지 않는다.
  return [ACCOUNT.PENSION, ACCOUNT.ANNUITY].sort(
    (a, b) => Number(flexible[b]) - Number(flexible[a]),
  );
}

export function resolveTransfer(access, { request, scenarioId }) {
  const transfer = request.isa_transfer;
  if (transfer === null) return { transfer: null, notices: [] };

  const notices = [];
  const appliedTo = 'isa_transfer_extra_limit.extra_credit_limit_krw';

  // 개정안은 추가한도 규칙을 대체한다(PROPOSED_SUPERSEDES).
  const ruleId =
    scenarioId === SCENARIO.PROPOSED ? RULE.PROPOSED_TRANSFER_EXTRA : RULE.CREDIT_TRANSFER_EXTRA;

  const rate = access.value(ruleId, ['value', 'rate'], appliedTo);
  const cap = access.value(ruleId, ['value', 'cap_krw'], appliedTo);

  let priorApplied = transfer.prior_year_applied_extra_credit_krw;
  if (scenarioId === SCENARIO.PROPOSED) {
    if (transfer.prior_multi_year_applied_extra_credit_krw !== null) {
      priorApplied = transfer.prior_multi_year_applied_extra_credit_krw;
    } else {
      // 넓어진 차감 기간에 대응하는 입력이 없다. 직전 1개 과세기간 값으로 대신하면
      // 추가한도가 과대 산출될 수 있으므로 그 사실을 드러낸다.
      notices.push(
        notice(
          NOTICE.PROPOSED_TRANSFER_PERIOD_MISSING,
          'warning',
          'isa_transfer.prior_multi_year_applied_extra_credit_krw',
          {},
          [ruleId],
        ),
      );
    }
  }

  if (rate === undefined || cap === undefined) {
    return { transfer: null, notices };
  }

  const byRate = applyRate(transfer.amount_krw, rate);
  if (byRate === null) {
    access.value(ruleId, ['value', 'rate', 'unreadable'], appliedTo);
    return { transfer: null, notices };
  }

  const capRemaining = clampToZero(cap - priorApplied);
  const extra = clampToZero(Math.min(byRate, capRemaining));

  return {
    notices,
    transfer: {
      amount_krw: transfer.amount_krw,
      destination: transfer.destination,
      extra_credit_limit_krw: extra,
      prior_applied_deducted_krw: Math.min(priorApplied, cap),
      basis_rule_ids: [ruleId],
    },
  };
}

export function resolveEligibility(access, { profile, accounts }) {
  const notices = [];
  const isaReasons = [];
  const isaBasis = [];

  const appliedTo = 'account_eligibility[isa]';
  const anyOf = access.value(RULE.ISA_ELIGIBILITY, ['value', 'any_of'], appliedTo);
  if (anyOf !== undefined) {
    isaBasis.push(RULE.ISA_ELIGIBILITY);
    const hasPriorEmploymentIncome =
      profile.prior_year_total_salary_krw !== null && profile.prior_year_total_salary_krw > 0;

    const qualifies = anyOf.some((option) => {
      if (typeof option?.min_age !== 'number') return false;
      if (profile.age_years < option.min_age) return false;
      // `requires`가 있는 선택지는 직전 과세기간 근로소득을 함께 요구한다.
      if (option.requires) return hasPriorEmploymentIncome;
      return true;
    });

    if (!qualifies) {
      isaReasons.push(NOTICE.ISA_EXCLUDED_AGE);
      notices.push(notice(NOTICE.ISA_EXCLUDED_AGE, 'warning', 'profile.age_years', {}, [RULE.ISA_ELIGIBILITY]));
    }
  }

  if (profile.financial_income_taxpayer_last_3_years === true) {
    access.use(RULE.ISA_EXCLUSION_FINANCIAL, appliedTo);
    isaBasis.push(RULE.ISA_EXCLUSION_FINANCIAL);
    isaReasons.push(NOTICE.ISA_EXCLUDED_FINANCIAL);
    notices.push(
      notice(NOTICE.ISA_EXCLUDED_FINANCIAL, 'warning', 'profile.financial_income_taxpayer_last_3_years', {}, [
        RULE.ISA_EXCLUSION_FINANCIAL,
      ]),
    );
  } else if (profile.financial_income_taxpayer_last_3_years === null) {
    // 모르는 것을 아니라고 단정하지 않는다. 배제를 적용하지 않았다는 사실만 알린다.
    notices.push(
      notice(NOTICE.FINANCIAL_INCOME_UNKNOWN, 'info', 'profile.financial_income_taxpayer_last_3_years', {}, []),
    );
  }

  // 연금계좌의 최소 가입 연령 규칙은 룰셋에 없다. 없으면 없는 것이므로 판정하지 않는다.
  notices.push(notice(NOTICE.PENSION_AGE_NOT_EVALUATED, 'info', null, {}, []));

  const eligibility = [
    { account: ACCOUNT.PENSION, eligible: true, reason_codes: [], basis_rule_ids: [] },
    { account: ACCOUNT.ANNUITY, eligible: true, reason_codes: [], basis_rule_ids: [] },
    {
      account: ACCOUNT.ISA,
      eligible: isaReasons.length === 0,
      reason_codes: isaReasons,
      basis_rule_ids: [...new Set(isaBasis)].sort(),
    },
  ];

  return { eligibility, notices, accountsUnused: accounts };
}

export function resolveLimits(access, { request, scenarioId, transfer, isaEligible }) {
  const { accounts, profile } = request;
  const notices = [];

  const annuityLimit = access.value(
    RULE.CREDIT_LIMIT_ANNUITY,
    ['value', 'amount_krw'],
    'limits.by_account[annuity_savings].credit_eligible_limit_remaining_krw',
  );
  const combinedAmount = access.value(
    RULE.CREDIT_LIMIT_COMBINED,
    ['value', 'amount_krw'],
    'limits.pension_combined_credit_limit_krw',
  );
  const pensionContributionLimit = access.value(
    RULE.PENSION_CONTRIBUTION_LIMIT,
    ['value', 'amount_krw'],
    'limits.pension_contribution_limit_remaining_krw',
  );

  const isa = resolveIsaLimits(access, { accounts, scenarioId });
  notices.push(...isa.notices);

  if (
    annuityLimit === undefined ||
    combinedAmount === undefined ||
    pensionContributionLimit === undefined ||
    isa.remaining === null
  ) {
    return { notices, limits: null };
  }

  const transferToAnnuity =
    transfer && transfer.destination === ACCOUNT.ANNUITY ? transfer.amount_krw : 0;
  const transferToPension =
    transfer && transfer.destination === ACCOUNT.PENSION ? transfer.amount_krw : 0;

  const annuityTotal = accounts.annuity_savings.ytd_contribution_krw + transferToAnnuity;
  const pensionTotal = accounts.retirement_pension.ytd_contribution_krw + transferToPension;

  // 세액공제 대상 한도는 단독 한도를 먼저 적용한 뒤 합산 한도를 적용한다.
  // 순서를 뒤집으면 연금저축 단독 납입자에게 과대한 공제액이 나온다.
  const annuityCounted = Math.min(annuityTotal, annuityLimit);
  const combinedLimit = combinedAmount + (transfer ? transfer.extra_credit_limit_krw : 0);
  const combinedRemainingRaw = combinedLimit - (annuityCounted + pensionTotal);

  // 전환금액은 납입 자체의 한도와 별개다(규칙의 excluded_from_limit).
  const pensionContributionUsed =
    accounts.annuity_savings.ytd_contribution_krw + accounts.retirement_pension.ytd_contribution_krw;
  const pensionContributionRemainingRaw = pensionContributionLimit - pensionContributionUsed;

  const overLimit =
    combinedRemainingRaw < 0 ||
    pensionContributionRemainingRaw < 0 ||
    annuityTotal > annuityLimit ||
    isa.clamped;

  if (overLimit) {
    notices.push(notice(NOTICE.EXISTING_OVER_LIMIT, 'warning', null, {}, []));
  }

  const combinedRemaining = clampToZero(combinedRemainingRaw);
  const annuityCreditRemaining = clampToZero(Math.min(annuityLimit - annuityCounted, combinedRemaining));
  const pensionContributionRemaining = clampToZero(pensionContributionRemainingRaw);

  const taxFree = resolveIsaTaxFreeLimit(access, { accounts, profile });
  notices.push(...taxFree.notices);

  // 연금저축과 퇴직연금은 납입 한도도 세액공제 한도도 **같은 풀**을 본다.
  // 두 값을 더하면 이중계상이므로, 그 사실을 문서가 아니라 데이터로 드러낸다.
  const limits = {
    by_account: [
      {
        account: ACCOUNT.PENSION,
        contribution_limit_remaining_krw: pensionContributionRemaining,
        contribution_limit_shared_with: [ACCOUNT.ANNUITY],
        credit_eligible_limit_remaining_krw: combinedRemaining,
        credit_limit_shared_with: [ACCOUNT.ANNUITY],
        tax_free_limit_krw: null,
        clamped_to_zero: pensionContributionRemainingRaw < 0 || combinedRemainingRaw < 0,
        basis_rule_ids: [RULE.CREDIT_LIMIT_COMBINED, RULE.PENSION_CONTRIBUTION_LIMIT].sort(),
      },
      {
        account: ACCOUNT.ANNUITY,
        contribution_limit_remaining_krw: pensionContributionRemaining,
        contribution_limit_shared_with: [ACCOUNT.PENSION],
        credit_eligible_limit_remaining_krw: annuityCreditRemaining,
        credit_limit_shared_with: [ACCOUNT.PENSION],
        tax_free_limit_krw: null,
        clamped_to_zero: pensionContributionRemainingRaw < 0 || annuityTotal > annuityLimit,
        basis_rule_ids: [
          RULE.CREDIT_LIMIT_ANNUITY,
          RULE.CREDIT_LIMIT_COMBINED,
          RULE.PENSION_CONTRIBUTION_LIMIT,
        ].sort(),
      },
      {
        account: ACCOUNT.ISA,
        contribution_limit_remaining_krw: isaEligible ? isa.remaining : 0,
        // ISA 한도는 이 계좌 전용이다. 빈 배열이 그 사실을 말한다.
        contribution_limit_shared_with: [],
        credit_eligible_limit_remaining_krw: null,
        credit_limit_shared_with: [],
        tax_free_limit_krw: taxFree.limit,
        clamped_to_zero: isa.clamped,
        basis_rule_ids: isa.basisRuleIds,
      },
    ],
    pension_combined_credit_limit_krw: combinedLimit,
    pension_combined_credit_remaining_krw: combinedRemaining,
    pension_contribution_limit_remaining_krw: pensionContributionRemaining,
    basis_rule_ids: [
      RULE.CREDIT_LIMIT_ANNUITY,
      RULE.CREDIT_LIMIT_COMBINED,
      RULE.PENSION_CONTRIBUTION_LIMIT,
    ].sort(),
  };

  return {
    notices,
    limits,
    state: {
      annuityLimit,
      combinedLimit,
      annuityCounted,
      pensionCounted: pensionTotal,
      pensionContributionRemaining,
      isaRemaining: isaEligible ? isa.remaining : 0,
      taxFreeLimit: taxFree.limit,
      isaBasisRuleIds: isa.basisRuleIds,
    },
  };
}

function resolveIsaLimits(access, { accounts, scenarioId }) {
  const notices = [];
  const isa = accounts.isa;
  const appliedTo = 'limits.by_account[isa].contribution_limit_remaining_krw';
  const basisRuleIds = [RULE.ISA_ACCOUNT_REQUIREMENTS];

  const totalLimit = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'total_contribution_limit_krw'],
    appliedTo,
  );

  let annualRemainingRaw;
  if (scenarioId === SCENARIO.PROPOSED) {
    // 개정안은 이월 계산식을 없애고 정액 한도로 바꾼다. 기존 가입자에게도 적용된다.
    basisRuleIds.push(RULE.PROPOSED_ISA_ANNUAL_LIMIT);
    const amount = access.value(RULE.PROPOSED_ISA_ANNUAL_LIMIT, ['value', 'amount_krw'], appliedTo);
    if (amount === undefined) return { remaining: null, clamped: false, notices, basisRuleIds };
    annualRemainingRaw = amount - isa.ytd_contribution_krw;
  } else {
    basisRuleIds.push(RULE.ISA_ANNUAL_LIMIT);
    const base = access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'base_amount_krw'], appliedTo);
    const formula = access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'formula'], appliedTo);
    if (base === undefined || formula === undefined) {
      return { remaining: null, clamped: false, notices, basisRuleIds };
    }

    // 연 한도를 상수로 박으면 안 된다 — 경과연수의 함수다(룰셋 engine_note).
    const tenureCap = readTenureCap(formula);
    if (tenureCap === null) {
      access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'formula', 'tenure_cap'], appliedTo);
      return { remaining: null, clamped: false, notices, basisRuleIds };
    }

    const tenure = isa.years_since_opening ?? 0;
    if (!isa.years_since_opening_provided) {
      notices.push(notice(NOTICE.ISA_TENURE_MISSING, 'warning', 'accounts.isa.years_since_opening', {}, [
        RULE.ISA_ANNUAL_LIMIT,
      ]));
    }
    annualRemainingRaw =
      base * (1 + Math.min(tenure, tenureCap)) - isa.cumulative_contribution_krw;
  }

  if (totalLimit === undefined) return { remaining: null, clamped: false, notices, basisRuleIds };

  const otherSavings = isa.other_savings_contract_krw ?? 0;
  const totalRemainingRaw = totalLimit - otherSavings - isa.cumulative_contribution_krw;

  return {
    remaining: clampToZero(Math.min(annualRemainingRaw, totalRemainingRaw)),
    clamped: annualRemainingRaw < 0 || totalRemainingRaw < 0,
    notices,
    basisRuleIds: [...new Set(basisRuleIds)].sort(),
  };
}

function resolveIsaTaxFreeLimit(access, { accounts, profile }) {
  const notices = [];
  const isa = accounts.isa;

  if (isa.account_type === null) {
    notices.push(notice(NOTICE.ISA_TYPE_NOT_DECLARED, 'info', 'accounts.isa.account_type', {}, []));
  }
  if (profile.prior_year_total_salary_krw === null) {
    notices.push(
      notice(NOTICE.PRIOR_YEAR_INCOME_MISSING, 'info', 'profile.prior_year_total_salary_krw', {}, []),
    );
  }

  if (isa.account_type === null) return { limit: null, notices };

  const appliedTo = 'limits.by_account[isa].tax_free_limit_krw';
  const brackets = access.value(RULE.ISA_TAX_FREE_LIMIT, ['value', 'brackets'], appliedTo);
  if (brackets === undefined) return { limit: null, notices };

  // 구간을 한글 id가 아니라 구조로 고른다 — 소득 상한이 있는 쪽이 우대 구간이고,
  // 상한이 전부 null인 쪽이 그 밖의 구간이다.
  const hasCeiling = (b) =>
    (b.prev_total_salary_max_krw ?? null) !== null || (b.prev_global_income_max_krw ?? null) !== null;
  const qualifying = brackets.find(hasCeiling);
  const fallback = brackets.find((b) => !hasCeiling(b));

  const selected = isa.account_type === 'low_income' ? qualifying : fallback;
  if (!selected || typeof selected.limit_krw !== 'number') {
    access.value(RULE.ISA_TAX_FREE_LIMIT, ['value', 'brackets', 'limit_krw'], appliedTo);
    return { limit: null, notices };
  }

  // 선언과 소득 판정이 어긋나면 알리되, 계산은 사용자 선언을 따른다.
  // 실제 유형은 가입·연장 시점에 금융회사가 심사해 확정한 것이다.
  if (profile.prior_year_total_salary_krw !== null && qualifying) {
    const qualifiesByIncome =
      (qualifying.prev_total_salary_max_krw ?? null) !== null &&
      profile.prior_year_total_salary_krw <= qualifying.prev_total_salary_max_krw;
    if (qualifiesByIncome !== (isa.account_type === 'low_income')) {
      notices.push(
        notice(NOTICE.ISA_TYPE_CONFLICT, 'warning', 'accounts.isa.account_type', {}, [
          RULE.ISA_TAX_FREE_LIMIT,
        ]),
      );
    }
  }

  return { limit: selected.limit_krw, notices };
}

export function notice(code, severity, field, params = {}, basisRuleIds = []) {
  return { code, severity, field, params, basis_rule_ids: basisRuleIds };
}

export { ERROR };
