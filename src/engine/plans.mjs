// 배분안 산출. 우선순위 기반 순차 충당이다.
//
// 중요: 이 파일에서 fund_use_horizon은 buildPlans 안의 **금액 계산이 끝난 뒤에만**
// 쓰인다(경고 판정과 기본안 선택). engine-design.md 5절의 9단계와 11~12단계 분리가
// "이 입력이 금액을 바꾸지 않는다"를 코드 구조로 보장한다.

import {
  ACCOUNT,
  ACCOUNT_ORDER,
  BASELINE_BY_HORIZON,
  COMPARISON_NOTE,
  FILL_SEQUENCE,
  HORIZON,
  LIMITED_BY,
  NON_QUANTIFIED,
  PLAN,
  PLAN_ORDER,
  PRIORITY_BASIS,
  RULE,
  TIE_BREAK,
  WARNING,
} from './constants.mjs';
import { applyRate, clampToZero } from './ratio.mjs';

const PENSION_ACCOUNTS = new Set([ACCOUNT.PENSION, ACCOUNT.ANNUITY]);

/**
 * 세제상 동점인가 — 두 연금계좌의 한계 공제율이 같은가.
 * 동점이면 어느 쪽에 넣어도 세액이 같으므로 순서를 다른 기준으로 정할 수 있다.
 * 동점이 아니면 **세액공제 최대화가 앞선다.** 인출 편의로 세액을 깎지 않는다.
 */
function creditRatesAreTied(rates) {
  return (rates.youthIrpRate ?? rates.incomeTaxRate) <= rates.incomeTaxRate;
}

/**
 * 이 배분안이 실제로 쓰는 충당 순서.
 *
 * `annuity_savings_first`는 이름이 순서를 이미 고정하므로 손대지 않는다.
 * 나머지 둘은 연금 쌍의 순서가 이름에 매여 있지 않으므로, **세제상 동점 구간에서만**
 * 인출이 자유로운 계좌를 앞세운다(engine-design.md 3.3절).
 */
function fillSequenceFor(planId, { rates, withdrawalOrder }) {
  const standard = FILL_SEQUENCE[planId];
  if (planId === PLAN.ANNUITY_FIRST || withdrawalOrder === null) return standard;
  if (!creditRatesAreTied(rates)) return standard;

  const pensionPart = [...withdrawalOrder];
  return standard.map((account) =>
    account === ACCOUNT.ISA ? account : pensionPart.shift(),
  );
}

function tieBreakOf(planId, ctx) {
  const applied =
    planId !== PLAN.ANNUITY_FIRST &&
    ctx.withdrawalOrder !== null &&
    creditRatesAreTied(ctx.rates);

  return applied
    ? { code: TIE_BREAK.WITHDRAWAL_FLEXIBILITY, basis_rule_ids: [RULE.PENSION_MIDTERM_RESTRICTION] }
    : { code: TIE_BREAK.NOT_APPLICABLE, basis_rule_ids: [] };
}

/** 한 배분안의 금액. 자금 사용 시점을 읽지 않는다. */
function allocate(planId, ctx) {
  const { state, budget, eligible, rates } = ctx;
  let remainingBudget = budget;
  let annuityCounted = state.annuityCounted;
  let pensionCounted = state.pensionCounted;
  let pensionPool = state.pensionContributionRemaining;
  let isaPool = state.isaRemaining;

  const amounts = { [ACCOUNT.PENSION]: 0, [ACCOUNT.ANNUITY]: 0, [ACCOUNT.ISA]: 0 };
  const limitedBy = {};
  const fillOrder = {};
  let order = 0;

  // ⚠ D17(합산 한도 절단 시 IRP 우선 인정)이 코드에 새겨지는 두 번째 지점이다.
  //   첫 번째는 benefitOf()의 인정 로직이고, 여기는 그 인정 구조를 아는 배분 탐색이다.
  //   D17은 조문이 정하지 않아 소유자가 판정한 해석이며 **법안 통과 시 재검토 대상**이다.
  //   전말과 재검토 절차는 engine-design.md 6.4절 표에 있다.
  //
  //   퇴직연금 공제율이 연금저축보다 높으면(개정안 청년 우대) 추가 IRP 납입은
  //   잔여 공제한도를 채우는 데 그치지 않는다. D17의 IRP 우선 인정 아래에서
  //   **이미 인정된 연금저축분을 공제 풀에서 밀어내고 그만큼이 높은 율로 갈아탄다.**
  //   따라서 상한은 "남은 합산 room"이 아니라 "IRP 인정액이 합산 한도에 닿는 지점"이다.
  //   4단계 교차검증 M1이 잡아낸 결함이 정확히 이 구분을 놓친 것이었다.
  const pensionRateIsHigher = !creditRatesAreTied(rates);

  const creditCapacity = (account) => {
    const combinedRoom = clampToZero(state.combinedLimit - (annuityCounted + pensionCounted));
    if (account === ACCOUNT.PENSION) {
      // 두 율이 같으면 치환해도 세액이 그대로다. 공제를 늘리지 못하는 납입을
      // 연금계좌에 밀어 넣지 않는다 — 인출 제약만 지게 된다.
      if (!pensionRateIsHigher) return combinedRoom;
      return clampToZero(state.combinedLimit - pensionCounted);
    }
    // 연금저축 추가분은 IRP를 밀어내지 못한다(D17). 남은 room이 그대로 상한이다.
    return clampToZero(Math.min(state.annuityLimit - annuityCounted, combinedRoom));
  };

  for (const account of fillSequenceFor(planId, ctx)) {
    if (!eligible[account]) {
      limitedBy[account] = LIMITED_BY.NOT_ELIGIBLE;
      continue;
    }

    // 순서가 곧 우선순위다. budget → credit_limit → contribution_limit 순으로
    // 무엇이 막았는지를 판정한다.
    const caps = PENSION_ACCOUNTS.has(account)
      ? [
          [LIMITED_BY.BUDGET, remainingBudget],
          [LIMITED_BY.CREDIT_LIMIT, creditCapacity(account)],
          [LIMITED_BY.CONTRIBUTION_LIMIT, pensionPool],
        ]
      : [
          [LIMITED_BY.BUDGET, remainingBudget],
          [LIMITED_BY.CONTRIBUTION_LIMIT, isaPool],
        ];

    const amount = Math.min(...caps.map(([, value]) => value));
    limitedBy[account] = caps.find(([, value]) => value === amount)[0];

    if (amount > 0) {
      order += 1;
      fillOrder[account] = order;
      amounts[account] = amount;
      remainingBudget -= amount;

      if (account === ACCOUNT.ISA) {
        isaPool -= amount;
      } else {
        pensionPool -= amount;
        if (account === ACCOUNT.ANNUITY) annuityCounted += amount;
        else pensionCounted += amount;
      }
    }
  }

  return { amounts, limitedBy, fillOrder, annuityCounted, pensionCounted, remainingBudget };
}

/**
 * 세액 한도를 적용한다. **자르기 전 금액과 자른 뒤 금액을 둘 다 낸다** —
 * 화면이 "최대 이만큼인데 낼 세금 때문에 이만큼이 된다"를 말하려면 뺄셈의 두 항이 다 필요하고,
 * 그 뺄셈을 화면이 하게 두면 세법 판단이 화면 코드로 새어 들어간다.
 *
 * **자르는 대상은 소득세분이다.** 사용자가 답하는 결정세액이 소득세이고 §61 ②③도 소득세의
 * 조문이다. 개인지방소득세는 그 소득세액의 10%로 산출되므로, 인정되지 않은 소득세 공제에
 * 붙는 지방세를 남겨 두면 근거가 사라진 금액이 남는다. 그래서 **인정된 소득세분에 부가율을
 * 다시 적용한다.** 지방세 쪽에 같은 한도 구조가 있는지는 룰셋이 미확인으로 남겨 두었고,
 * 그 사실은 assumptions로 나간다.
 */
function applyCap(incomeTax, localTax, { cap, rates, access }) {
  const known = cap.known;
  const recognizedIncomeTax = known ? Math.min(incomeTax, cap.cap_krw) : incomeTax;
  const recognizedLocalTax =
    recognizedIncomeTax === incomeTax ? localTax : applyRate(recognizedIncomeTax, rates.surtaxRate) ?? 0;

  const reducedIncomeTax = incomeTax - recognizedIncomeTax;
  const applied = known && reducedIncomeTax > 0;

  if (applied) {
    // 잘린 것은 공제액이고 납입액이 아니다. 그 납입액은 전환 신청의 대상이 된다 —
    // "넣은 돈이 사라진다"가 아니라 "올해의 공제는 0이고 납입액은 넘길 수 있다"가 정확한 서술이다.
    access.markUsed(RULE.CREDIT_UNUSED_CARRYOVER, 'plans[].deterministic_benefit.tax_liability_cap');
  }

  return {
    recognizedIncomeTax,
    recognizedLocalTax,
    cap: {
      known,
      cap_krw: cap.cap_krw,
      applied,
      reduced_income_tax_krw: reducedIncomeTax,
      reduced_local_tax_krw: localTax - recognizedLocalTax,
      reduced_total_krw: incomeTax + localTax - (recognizedIncomeTax + recognizedLocalTax),
      // 임계값. 낼 세금이 이 값보다 적으면 결과가 달라진다 — 사용자가 나중에
      // 영수증을 보고 스스로 대조할 수 있게 하는 값이고, 화면이 만들지 않는다.
      threshold_income_tax_krw: incomeTax,
      // 초과분의 세액공제액은 이월되지 않는다. 다만 그 납입액은 신청으로 넘길 수 있다.
      credit_carryforward: cap.credit_carryforward,
      contribution_carryover_available: applied,
      error_direction_code: cap.error_direction_code,
      basis_rule_ids: [
        ...cap.basis_rule_ids,
        ...(applied ? [RULE.CREDIT_UNUSED_CARRYOVER] : []),
      ].sort(),
    },
  };
}

/** 세액공제액. 대상액을 계좌별 공제율로 나눠 적용한다. */
function benefitOf({ annuityCounted, pensionCounted }, { state, rates, cap, access }) {
  const eligibleTotal = Math.min(annuityCounted + pensionCounted, state.combinedLimit);

  // ⚠ 조문이 정하지 않아 엔진이 정한 지점. engine-design.md 6.4절에 전말이 있고
  //   tax-domain의 확인을 기다리는 중이다.
  //   합산 한도가 걸릴 때 어느 쪽 납입분이 잘리는지를 조문이 말하지 않는다.
  //   퇴직연금분을 먼저 인정하고 남는 만큼을 연금저축분으로 본다.
  //   **답이 달라지면 고칠 곳은 아래 두 줄뿐이다.** 다른 파일은 손대지 않는다.
  //   두 공제율이 같은 현행 기준에서는 총액에 영향이 없다 — 갈리는 것은 개정안의
  //   청년 우대(퇴직연금분만 다른 공제율)가 적용될 때뿐이다.
  const pensionEligible = Math.min(pensionCounted, state.combinedLimit);
  const annuityEligible = clampToZero(eligibleTotal - pensionEligible);

  const pensionRate = rates.youthIrpRate ?? rates.incomeTaxRate;
  const groups = new Map();
  const add = (rate, amount) => groups.set(rate, (groups.get(rate) ?? 0) + amount);
  add(pensionRate, pensionEligible);
  add(rates.incomeTaxRate, annuityEligible);

  let incomeTax = 0;
  for (const [rate, amount] of groups) incomeTax += applyRate(amount, rate) ?? 0;
  const localTax = applyRate(incomeTax, rates.surtaxRate) ?? 0;

  const capped = applyCap(incomeTax, localTax, { cap, rates, access });

  return {
    pension_credit_income_tax_krw: capped.recognizedIncomeTax,
    pension_credit_local_tax_krw: capped.recognizedLocalTax,
    pension_credit_total_krw: capped.recognizedIncomeTax + capped.recognizedLocalTax,
    // 자르기 전 금액. 화면이 "계산된 공제액 중 얼마가 이번 과세연도에 쓰이지 않는지"를
    // 말하려면 이 값이 함께 있어야 한다.
    pension_credit_income_tax_before_cap_krw: incomeTax,
    pension_credit_local_tax_before_cap_krw: localTax,
    pension_credit_total_before_cap_krw: incomeTax + localTax,
    // 세액공제 대상으로 **인정된 납입액**은 한도로 잘리지 않는다. 잘리는 것은 공제액이고
    // 납입액은 살아남아 전환 신청의 대상이 된다(시행령 §118의3).
    credit_eligible_contribution_krw: eligibleTotal,
    tax_liability_cap: capped.cap,
    basis_rule_ids: [
      RULE.CREDIT_RATE,
      RULE.CREDIT_LIMIT_ANNUITY,
      RULE.CREDIT_LIMIT_COMBINED,
      RULE.CREDIT_TAX_CAP,
      RULE.LOCAL_SURTAX,
      ...(rates.youthIrpRate !== null ? [RULE.PROPOSED_YOUTH_IRP_RATE] : []),
    ].sort(),
  };
}

/** 자금 사용 시점에 따라 걸리는 중도 불이익. 금액은 내지 않는다. */
function warningsOf(amounts, { horizon, boundaries, startDates }) {
  if (horizon === HORIZON.AT_OR_AFTER_PENSION_AGE) return [];

  const unknown = horizon === HORIZON.UNKNOWN;
  const severity = unknown ? 'info' : 'warning';
  const trigger = unknown ? 'horizon_unknown' : 'declared_horizon';
  const out = [];

  // 의무가입기간이 이미 지났으면 추징 요건 자체가 성립할 수 없다 —
  // `isa.early_termination.clawback`은 "3년이 되는 날 전" 해지에만 걸린다.
  // 성립할 수 없는 불이익을 고지하면 하지 않아도 될 걱정을 시켜 옳은 행동을 막는다.
  // 4단계 교차검증 M2. 계약 8.4절을 함께 고쳤다.
  const isaLockInRemaining = boundaries.isa_lock_in_years_remaining ?? 0;

  for (const account of ACCOUNT_ORDER) {
    if (amounts[account] <= 0) continue;

    if (PENSION_ACCOUNTS.has(account)) {
      // 나이 요건만이 아니라 **가입 후 5년 요건까지 반영된 시점**을 함께 싣는다.
      // 55세에 가까운 사람이 계좌를 처음 여는 경우 실질 잠금기간은 5년이고,
      // 나이만 보고 만든 문구는 그 사람에게 틀린다.
      const startDate = startDates?.find((entry) => entry.account === account) ?? null;
      out.push({
        code: WARNING.PENSION_EARLY_WITHDRAWAL,
        account,
        severity,
        trigger,
        basis_rule_ids: [
          RULE.PENSION_EARLIEST_START,
          RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
          RULE.PENSION_EARLY_WITHDRAWAL_RATE,
        ].sort(),
        params: {
          pension_min_age_years: boundaries.pension_min_age_years,
          pension_years_remaining: boundaries.pension_years_remaining,
          earliest_start_date: startDate?.earliest_start_date ?? null,
          years_until_earliest_start: startDate?.years_until_earliest_start ?? null,
          earliest_start_computable: startDate?.computable ?? false,
        },
      });
    } else if ((unknown || horizon === HORIZON.WITHIN_ISA_LOCK_IN) && isaLockInRemaining > 0) {
      out.push({
        code: WARNING.ISA_CLAWBACK,
        account,
        severity,
        trigger,
        basis_rule_ids: [RULE.ISA_CLAWBACK, RULE.ISA_ACCOUNT_REQUIREMENTS].sort(),
        params: {
          isa_lock_in_years: boundaries.isa_lock_in_years,
          isa_lock_in_years_remaining: boundaries.isa_lock_in_years_remaining,
        },
      });
    }
  }

  return out;
}

function nonQuantifiedOf(amounts, { state }) {
  if (amounts[ACCOUNT.ISA] <= 0) return [];
  return [
    {
      code: NON_QUANTIFIED.ISA_HEADROOM,
      account: ACCOUNT.ISA,
      headroom_krw: state.taxFreeLimit,
      quantifiable: false,
      // 수익률은 세법 값이 아니고 룰셋에 없다. 가정을 만들지 않는다.
      reason_code: NON_QUANTIFIED.REASON_RETURN_UNKNOWN,
      basis_rule_ids: [RULE.ISA_TAX_FREE_LIMIT, RULE.ISA_EXCESS_RATE, RULE.ISA_LOSS_OFFSET].sort(),
    },
  ];
}

/**
 * 이 배분안이 이름으로 내세운 목적함수가 이 입력에서 순위를 정하지 못하는가.
 *
 * 한도가 0이면 연금계좌에 얼마를 넣든 공제액이 0이라 **최대값이 유일하지 않다.**
 * 그때 엔진이 조용히 아무 배분이나 고르고 `max_tax_credit`이라는 이름을 그대로 달면,
 * 근거 없는 답을 근거 있는 답처럼 내놓는 것이 된다. 이름이 실제 근거를 말해야 한다는
 * 원칙(D17·tie_break)이 여기서도 그대로 걸리므로, 이름을 유지하되 **그 이름이 이 입력에서
 * 아무것도 가르지 못한다는 사실을 값으로** 낸다.
 *
 * `isa_first`는 해당하지 않는다. 그 안의 근거는 세액공제가 아니라 인출 가능성이고
 * (`pension.withdrawal.eligibility`·`early_withdrawal.other_income_rate`), 한도가 0이어도
 * 그 사실은 그대로 성립한다.
 */
function objectiveDegenerate(planId, { cap }) {
  return cap.known && cap.cap_krw === 0 && planId !== PLAN.ISA_FIRST;
}

export function buildPlans(ctx) {
  const { options, horizon, months, budget, access, cap } = ctx;
  const requested = options.plan_variants ?? PLAN_ORDER;

  // ── 금액 계산. 자금 사용 시점을 읽지 않는다. ──────────────────────
  const computed = new Map();
  for (const planId of PLAN_ORDER) {
    if (!requested.includes(planId)) continue;
    const result = allocate(planId, ctx);
    computed.set(planId, { result, benefit: benefitOf(result, ctx) });
  }

  // ── 여기서부터 자금 사용 시점이 쓰인다. 금액은 이미 확정됐다. ──────
  let baselineId = BASELINE_BY_HORIZON[horizon];
  if (!computed.has(baselineId)) {
    baselineId = PLAN_ORDER.find((id) => computed.has(id));
  }
  const orderedIds = [baselineId, ...PLAN_ORDER.filter((id) => id !== baselineId && computed.has(id))];

  const plans = [];
  const seenVectors = new Set();
  for (const planId of orderedIds) {
    const { result, benefit } = computed.get(planId);
    const vector = ACCOUNT_ORDER.map((a) => result.amounts[a]).join('|');
    if (seenVectors.has(vector)) continue;
    seenVectors.add(vector);

    access.markUsed(RULE.CREDIT_RATE, 'plans[].deterministic_benefit');
    for (const ruleId of PRIORITY_BASIS[planId].basis_rule_ids) {
      access.markUsed(ruleId, 'plans[].priority_basis');
    }
    // 순서를 이 규칙으로 정했으면 화면이 근거를 보여줄 수 있어야 한다(헌장 고지 요소 3).
    for (const ruleId of tieBreakOf(planId, ctx).basis_rule_ids) {
      access.markUsed(ruleId, 'plans[].priority_basis');
    }

    const warnings = warningsOf(result.amounts, ctx);
    for (const warning of warnings) {
      for (const ruleId of warning.basis_rule_ids) access.markUsed(ruleId, 'plans[].warnings');
    }

    const allocations = ACCOUNT_ORDER.map((account) => ({
      account,
      monthly_krw: Math.floor(result.amounts[account] / months),
      annual_krw: result.amounts[account],
      fill_order: result.fillOrder[account] ?? null,
      limited_by: result.limitedBy[account] ?? null,
      basis_rule_ids: basisForAccount(account, ctx),
    }));

    const totalAnnual = allocations.reduce((sum, a) => sum + a.annual_krw, 0);
    const totalMonthly = allocations.reduce((sum, a) => sum + a.monthly_krw, 0);
    const unallocatedAnnual = clampToZero(budget - totalAnnual);

    const nonQuantified = nonQuantifiedOf(result.amounts, ctx);
    for (const effect of nonQuantified) {
      for (const ruleId of effect.basis_rule_ids) access.markUsed(ruleId, 'plans[].non_quantified_effects');
    }

    plans.push({
      plan_id: planId,
      is_baseline: false,
      warnings,
      priority_basis: {
        code: PRIORITY_BASIS[planId].code,
        // 표준 순서가 아니라 **실제로 쓴 순서**를 낸다. 순서 보고가 거짓말하면
        // 화면이 근거를 잘못 설명한다.
        fill_sequence: fillSequenceFor(planId, ctx),
        basis_rule_ids: [
          ...PRIORITY_BASIS[planId].basis_rule_ids,
          ...tieBreakOf(planId, ctx).basis_rule_ids,
        ].sort(),
        tie_break: tieBreakOf(planId, ctx),
        objective_degenerate: objectiveDegenerate(planId, ctx),
      },
      allocations,
      total_allocated_monthly_krw: totalMonthly,
      total_allocated_annual_krw: totalAnnual,
      unallocated_monthly_krw: Math.floor(unallocatedAnnual / months),
      unallocated_annual_krw: unallocatedAnnual,
      // 월 환산에서 버려진 잔차를 삼키지 않는다.
      monthly_rounding_residual_krw: totalAnnual - totalMonthly * months,
      deterministic_benefit: benefit,
      delta_vs_baseline_krw: 0,
      non_quantified_effects: nonQuantified,
    });
  }

  plans[0].is_baseline = true;
  const baselineCredit = plans[0].deterministic_benefit.pension_credit_total_krw;
  for (const plan of plans) {
    plan.delta_vs_baseline_krw = plan.deterministic_benefit.pension_credit_total_krw - baselineCredit;
  }

  const comparisonNotes = [];
  if (plans.length === 1) comparisonNotes.push(COMPARISON_NOTE.PLANS_COLLAPSED_SINGLE);
  // 이 안내의 뜻은 "어느 배분안도 불이익을 피하지 못한다"이고, 계약은 이것을
  // 배분 비교보다 앞세우라고 지시한다. 그러므로 **실제로 모든 안이 경고를 지고 있을 때만**
  // 낸다. horizon 값만 보고 내면 피할 수 있는 선택지가 있는데 없다고 말하게 된다.
  //
  // ⚠ 이 조건은 8.4절 경고 조건과 같은 사실에 의존한다(M2가 ISA 경고에 잔여
  //   의무가입기간 조건을 붙이자 이 안내가 그 파급을 놓쳐 M3이 됐다).
  //   경고 조건을 건드리면 여기도 함께 본다 — 불변식 테스트가 그 연결을 강제한다.
  if (
    horizon === HORIZON.WITHIN_ISA_LOCK_IN &&
    plans.length > 0 &&
    plans.every((plan) => plan.warnings.length > 0)
  ) {
    comparisonNotes.push(COMPARISON_NOTE.ALL_ACCOUNTS_PENALTY);
  }
  if (plans[0].plan_id !== PLAN.MAX_CREDIT) comparisonNotes.push(COMPARISON_NOTE.BASELINE_REORDERED);
  if (plans.length > 1 && plans.slice(1).some((p) => p.delta_vs_baseline_krw === 0)) {
    comparisonNotes.push(COMPARISON_NOTE.EQUAL_TAX_CREDIT);
  }
  // 한도가 0이면 모든 안의 공제액이 0이라 비교의 축이 사라진다. `alternatives_have_equal_tax_credit`
  // 만으로는 부족하다 — 그것은 "동률"이라고만 말하고 **왜** 동률인지, 그리고 그 동률이
  // 앞으로도 어떤 배분에서든 깨지지 않는다는 사실을 말하지 않는다.
  if (cap.known && cap.cap_krw === 0) {
    comparisonNotes.push(COMPARISON_NOTE.TAX_CREDIT_AXIS_FLAT);
  }

  return { plans, comparisonNotes };
}

function basisForAccount(account, { state }) {
  if (account === ACCOUNT.ISA) return state.isaBasisRuleIds;
  if (account === ACCOUNT.ANNUITY) {
    return [RULE.CREDIT_LIMIT_ANNUITY, RULE.CREDIT_LIMIT_COMBINED, RULE.PENSION_CONTRIBUTION_LIMIT].sort();
  }
  return [RULE.CREDIT_LIMIT_COMBINED, RULE.PENSION_CONTRIBUTION_LIMIT].sort();
}
