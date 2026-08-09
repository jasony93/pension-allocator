// 세액 한도·연금수령 개시·개시 가능 시점·퇴직급여 입금의 동작 고정.
//
// **이 파일이 왜 필요한가.** 골든 케이스 36건은 프로필에 결정세액이 없는 채로 산출됐고,
// 그것은 "세액 한도가 충분하다"는 암묵적 전제 위에서만 성립한다. 즉 골든 케이스와
// 엔진이 같은 누락을 공유하고 있어서 대조가 그 누락을 잡아내지 못한다. 그 전제 밖의
// 동작은 여기서 고정한다 — 기대값 재산출과 경계 케이스 추가는 `tax-domain`의 몫이다.
//
// **여기의 기대값은 룰셋에서 읽어 만든다.** 세법 수치를 옮겨 적으면 이 파일이 두 번째
// 진실 원천이 되고, 룰셋이 바뀌어도 조용히 통과한다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { SCHEMA_VERSION } from './constants.mjs';
import {
  CONFIRMED_FILE,
  allocationOf,
  baseRequest,
  deepMerge,
  errorCodes,
  findRule,
  loadRulesets,
  noticeCodes,
  planOf,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const confirmedRule = (id) => findRule(rulesets, CONFIRMED_FILE, id);

/** 룰셋에서 읽은 값으로 기대값을 만든다. 숫자를 이 파일에 적지 않기 위한 것이다. */
const CREDIT_RATE = confirmedRule('pension.credit.rate').value.brackets.find(
  (b) => b.total_salary_only_max_krw !== null,
).rate;
const SURTAX_RATE = confirmedRule('tax.local.personal_income_surtax').value.rate_of_income_tax;
const COMBINED_LIMIT = confirmedRule('pension.credit.limit.combined').value.amount_krw;
const CONTRIBUTION_LIMIT = confirmedRule('pension.contribution.annual_limit').value.amount_krw;
const PENSION_REQUIREMENTS = confirmedRule('pension.withdrawal.eligibility').value.requirements;
const MIN_AGE = PENSION_REQUIREMENTS.find((r) => r.id === 'age').min_age;
const HOLDING_YEARS = PENSION_REQUIREMENTS.find((r) => r.id === 'holding_period').min_years;

/** 총급여를 우대 구간 안에 두어 공제율이 CREDIT_RATE로 판정되게 한다. */
const LOW_SALARY = 50_000_000;

/**
 * 한도만 갈아 끼운 요청. `baseRequest`가 깊은 병합을 하므로 짝의 두 칸을 매번
 * 명시적으로 비운다 — 비우지 않으면 기본 요청의 값이 살아남아 "그 칸이 없는 상태"를
 * 시험한다고 믿으면서 실제로는 값이 있는 상태를 시험하게 된다.
 */
function withCap(prior, patch = {}) {
  return baseRequest(
    deepMerge(
      {
        profile: {
          current_year_total_salary_krw: LOW_SALARY,
          prior_year_total_salary_krw: 60_000_000,
          prior_year_tax: {
            determined_tax_krw: null,
            pension_credit_applied_krw: null,
            ...prior,
          },
        },
      },
      patch,
    ),
  );
}

// ── 되더하기 ─────────────────────────────────────────────────────

test('한도는 결정세액과 연금계좌 세액공제액의 합이다 — 근사가 아니라 등식', () => {
  const scenario = scenarioOf(
    compute(
      withCap({ state: 'amount', determined_tax_krw: 400_000, pension_credit_applied_krw: 250_000 }),
      rulesets,
    ),
  );

  const cap = scenario.pension_credit_tax_liability_cap;
  assert.equal(cap.known, true);
  assert.equal(cap.cap_krw, 650_000);
  assert.equal(cap.source_code, 'determined_tax_add_back');
  // 이미 받은 공제를 되더하지 않으면 한도가 그만큼 작아 보이는 순환이 생긴다.
  assert.equal(cap.prior_pension_credit_krw, 250_000);
  assert.equal(cap.error_direction_code, null);
});

test('결정세액이 0이어도 되더하기는 그대로 성립한다', () => {
  const scenario = scenarioOf(
    compute(
      withCap({ state: 'amount', determined_tax_krw: 0, pension_credit_applied_krw: 180_000 }),
      rulesets,
    ),
  );

  // 결정세액 0 + 연금계좌 세액공제 18만원 = 잔여가 정확히 18만원이었다는 뜻이다.
  assert.equal(scenario.pension_credit_tax_liability_cap.cap_krw, 180_000);
  assert.equal(
    planOf(scenario, 'max_tax_credit').deterministic_benefit.pension_credit_income_tax_krw,
    180_000,
  );
});

test('결정세액과 연금계좌 세액공제액은 짝으로 받는다', () => {
  // 금액을 답하겠다고 해 놓고 결정세액이 없으면 되더하기의 출발점이 없다.
  const missing = compute(
    withCap({ state: 'amount', pension_credit_applied_krw: 100_000 }),
    rulesets,
  );
  assert.equal(missing.ok, false);
  assert.ok(
    missing.errors.some(
      (e) => e.code === 'missing_required' && e.field === 'profile.prior_year_tax.determined_tax_krw',
    ),
  );

  // 짝 자체가 빠진 것과 "모르겠습니다"는 다르다. 빈 칸을 모름으로 간주하지 않는다.
  const absent = compute(baseRequest({ profile: { prior_year_tax: null } }), rulesets);
  assert.equal(absent.ok, false);
  assert.ok(errorCodes(absent).includes('missing_required'));
});

// ── 자르기 ───────────────────────────────────────────────────────

test('자르기 전 금액과 자른 뒤 금액을 둘 다 낸다', () => {
  // 예산을 합산 한도까지 채워 공제액을 최대로 만든 뒤, 그보다 낮은 한도를 준다.
  const request = withCap(
    { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
    { profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 } },
  );
  const scenario = scenarioOf(compute(request, rulesets));
  const benefit = planOf(scenario, 'max_tax_credit').deterministic_benefit;

  const uncappedIncomeTax = Math.floor(COMBINED_LIMIT * CREDIT_RATE);
  assert.equal(benefit.pension_credit_income_tax_before_cap_krw, uncappedIncomeTax);
  assert.equal(benefit.pension_credit_income_tax_krw, 300_000);
  assert.equal(benefit.tax_liability_cap.applied, true);
  assert.equal(benefit.tax_liability_cap.reduced_income_tax_krw, uncappedIncomeTax - 300_000);

  // 지방소득세는 **인정된 소득세분**을 따라간다. 인정되지 않은 공제에 붙는 지방세를
  // 남겨 두면 근거가 사라진 금액이 결과에 남는다.
  assert.equal(benefit.pension_credit_local_tax_krw, Math.floor(300_000 * SURTAX_RATE));
  assert.equal(
    benefit.pension_credit_local_tax_before_cap_krw,
    Math.floor(uncappedIncomeTax * SURTAX_RATE),
  );

  // 인정된 **납입액**은 잘리지 않는다. 잘리는 것은 공제액이다.
  assert.equal(benefit.credit_eligible_contribution_krw, COMBINED_LIMIT);
  // 그리고 그 납입액은 전환 신청의 대상으로 살아남는다 — "돈이 사라진다"가 아니다.
  assert.equal(benefit.tax_liability_cap.contribution_carryover_available, true);
  assert.equal(benefit.tax_liability_cap.credit_carryforward, false);
  assert.ok(
    benefit.tax_liability_cap.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'),
  );
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_applied'));
});

test('임계값이 실제 경계다 — 그 아래로 1원만 내려가도 결과가 달라진다', () => {
  const budget = { profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 } };
  const probe = scenarioOf(
    compute(
      withCap({ state: 'amount', determined_tax_krw: 100_000_000, pension_credit_applied_krw: 0 }, budget),
      rulesets,
    ),
  );
  const threshold = planOf(probe, 'max_tax_credit').deterministic_benefit.tax_liability_cap
    .threshold_income_tax_krw;

  const at = scenarioOf(
    compute(
      withCap({ state: 'amount', determined_tax_krw: threshold, pension_credit_applied_krw: 0 }, budget),
      rulesets,
    ),
  );
  const below = scenarioOf(
    compute(
      withCap(
        { state: 'amount', determined_tax_krw: threshold - 1, pension_credit_applied_krw: 0 },
        budget,
      ),
      rulesets,
    ),
  );

  // 임계값 위에서는 잘리지 않고, 1원 아래에서는 정확히 1원 잘린다.
  assert.equal(planOf(at, 'max_tax_credit').deterministic_benefit.tax_liability_cap.applied, false);
  const cut = planOf(below, 'max_tax_credit').deterministic_benefit.tax_liability_cap;
  assert.equal(cut.applied, true);
  assert.equal(cut.reduced_income_tax_krw, 1);
});

// ── 한도를 모를 때 ───────────────────────────────────────────────

test('한도를 모르면 지어내지 않고 오차의 방향을 낸다', () => {
  const scenario = scenarioOf(
    compute(withCap({ state: 'unknown', determined_tax_krw: null }), rulesets),
  );
  const cap = scenario.pension_credit_tax_liability_cap;

  assert.equal(cap.known, false);
  assert.equal(cap.cap_krw, null);
  assert.equal(cap.source_code, null);
  // 값이 아니라 방향을 낸다. 이 값이 "이만큼"이 아니라 "최대 이만큼"이라는 근거다.
  assert.equal(cap.error_direction_code, 'overstated_or_equal');
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_unknown'));

  const capNotice = scenario.notices.find((n) => n.code === 'tax_liability_cap_unknown');
  assert.equal(capNotice.severity, 'warning');
  assert.ok(capNotice.basis_rule_ids.includes('pension.credit.tax_liability_cap'));
});

test('"0은 아니었다"만 답해도 한도의 크기는 여전히 모른다', () => {
  const scenario = scenarioOf(
    compute(withCap({ state: 'nonzero_amount_unknown', determined_tax_krw: null }), rulesets),
  );
  const cap = scenario.pension_credit_tax_liability_cap;

  // 최악의 오류(한도 0인 사용자에게 절세액을 제시하는 것)는 걸러지지만
  // 크기를 주지 않으므로 결과는 여전히 상한이다.
  assert.equal(cap.known, false);
  assert.equal(cap.declared_nonzero, true);
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_unknown'));
});

// ── 한도가 0일 때 ────────────────────────────────────────────────

test('한도가 0이면 공제액은 0이지만 연금계좌 배분을 0으로 만들지 않는다', () => {
  const zero = scenarioOf(compute(withCap({ state: 'zero', determined_tax_krw: null }), rulesets));
  const ample = scenarioOf(
    compute(
      withCap({ state: 'amount', determined_tax_krw: 100_000_000, pension_credit_applied_krw: 0 }),
      rulesets,
    ),
  );

  assert.equal(zero.pension_credit_tax_liability_cap.cap_krw, 0);

  for (const plan of zero.plans) {
    assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 0);
    // 연금계좌에 배분한 안은 자르기 전 금액이 남아 있다 — 화면이 "계산된 공제액 중
    // 얼마가 이번 과세연도에 쓰이지 않았는지"를 말할 수 있어야 한다.
    if (allocationOf(plan, 'retirement_pension').annual_krw + allocationOf(plan, 'annuity_savings').annual_krw > 0) {
      assert.ok(plan.deterministic_benefit.pension_credit_total_before_cap_krw > 0);
    }

    // 배분은 한도가 넉넉한 경우와 **완전히 같다.** 납입액은 소멸하지 않고
    // 이후 과세기간으로 전환 신청할 수 있으므로, 배분을 0으로 만드는 것은
    // 세법의 결론이 아니라 엔진이 지어낸 선호가 된다.
    const same = planOf(ample, plan.plan_id);
    assert.deepStrictEqual(
      plan.allocations.map((a) => [a.account, a.annual_krw]),
      same.allocations.map((a) => [a.account, a.annual_krw]),
    );
  }
  // 공제액이 0이라는 이유로 연금계좌 배분이 사라지지 않는다는 것이 이 검사의 요지다.
  assert.ok(
    zero.plans.some(
      (p) =>
        allocationOf(p, 'retirement_pension').annual_krw +
          allocationOf(p, 'annuity_savings').annual_krw >
        0,
    ),
  );
});

test('한도가 0이면 세액공제로는 배분안이 갈리지 않는다는 사실이 값으로 나간다', () => {
  const scenario = scenarioOf(compute(withCap({ state: 'zero', determined_tax_krw: null }), rulesets));

  assert.ok(scenario.comparison_note_codes.includes('tax_credit_axis_not_discriminating'));
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_zero'));
  assert.equal(
    scenario.notices.find((n) => n.code === 'tax_liability_cap_zero').severity,
    'info',
    '사용자가 무언가를 잘못해서 생긴 상태가 아니다 — 이 사용자에게는 0이 정확한 답이다',
  );

  // `max_tax_credit`이라는 이름이 이 입력에서 아무것도 가르지 못한다는 사실을 스스로 밝힌다.
  assert.equal(planOf(scenario, 'max_tax_credit').priority_basis.objective_degenerate, true);
  // `isa_first`의 근거는 세액공제가 아니라 인출 가능성이므로 그대로 성립한다.
  assert.equal(planOf(scenario, 'isa_first').priority_basis.objective_degenerate, false);
});

test('한도가 0이어도 기본안을 옮기지 않는다', () => {
  // 세액이 같아졌다는 이유로 유동성 우선안을 기본으로 올리면, 그것은 엔진이
  // 세금 밖의 선호를 지어낸 것이다. 기본안은 여전히 자금 사용 시점이 정한다.
  const zero = scenarioOf(compute(withCap({ state: 'zero', determined_tax_krw: null }), rulesets));
  const ample = scenarioOf(
    compute(
      withCap({ state: 'amount', determined_tax_krw: 100_000_000, pension_credit_applied_krw: 0 }),
      rulesets,
    ),
  );

  assert.equal(zero.plans[0].plan_id, ample.plans[0].plan_id);
  assert.equal(
    zero.comparison_note_codes.includes('baseline_reordered_by_fund_use_horizon'),
    ample.comparison_note_codes.includes('baseline_reordered_by_fund_use_horizon'),
  );
});

// ── 연금 수령 개시 ───────────────────────────────────────────────

test('연금수령을 개시한 계좌에는 배분하지 않는다 — 두 계좌가 대칭이다', () => {
  for (const account of ['retirement_pension', 'annuity_savings']) {
    const scenario = scenarioOf(
      compute(
        baseRequest({ accounts: { [account]: { annuity_start_status: 'started' } } }),
        rulesets,
      ),
    );

    const entry = scenario.account_eligibility.find((e) => e.account === account);
    assert.equal(entry.eligible, false, `${account}: 개시한 계좌에 자격이 남아 있다`);
    assert.deepStrictEqual(entry.reason_codes, ['pension_contribution_blocked_annuity_started']);
    assert.deepStrictEqual(entry.basis_rule_ids, ['pension.contribution.after_annuity_start']);

    for (const plan of scenario.plans) {
      assert.equal(allocationOf(plan, account).annual_krw, 0);
      assert.equal(allocationOf(plan, account).limited_by, 'not_eligible');
    }
  }
});

test('개시 여부를 모르면 아니오로 접지 않고 그 계좌를 보류한다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({ accounts: { retirement_pension: { annuity_start_status: 'unknown' } } }),
      rulesets,
    ),
  );

  const entry = scenario.account_eligibility.find((e) => e.account === 'retirement_pension');
  assert.equal(entry.eligible, false);
  assert.deepStrictEqual(entry.reason_codes, ['pension_annuity_start_unknown']);
  assert.ok(noticeCodes(scenario).includes('pension_annuity_start_unknown'));
  // 모름을 아니오로 접으면 수령 중인 사용자에게 납입 가능액을 주게 된다 — 과대 방향이다.
  for (const plan of scenario.plans) {
    assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, 0);
  }
});

// ── 개시 가능 시점 ───────────────────────────────────────────────

test('개시 가능 시점은 만 55세 도달일과 가입 후 5년 중 늦은 쪽이다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        // 만 54세. 나이 요건은 곧 충족되지만 계좌를 올해 열면 5년이 새로 시작된다.
        profile: { birth_date: '1972-06-15' },
        accounts: {
          retirement_pension: { opened_on: '2026-01-10' },
          annuity_savings: { opened_on: '2000-01-10' },
        },
      }),
      rulesets,
    ),
  );

  const irp = scenario.pension_withdrawal_start.find((e) => e.account === 'retirement_pension');
  const annuity = scenario.pension_withdrawal_start.find((e) => e.account === 'annuity_savings');

  assert.equal(irp.age_requirement_date, `${1972 + MIN_AGE}-06-15`);
  assert.equal(irp.holding_requirement_date, `${2026 + HOLDING_YEARS}-01-10`);
  // 새로 연 계좌는 5년 요건이 시점을 정한다 — 이 사람의 실질 잠금기간이 5년이다.
  assert.equal(irp.earliest_start_date, `${2026 + HOLDING_YEARS}-01-10`);
  assert.equal(irp.bound_by_holding_period, true);

  // 오래 보유한 계좌는 나이 요건만 남는다. 두 계좌에 같은 답을 주지 않는다.
  assert.equal(annuity.earliest_start_date, `${1972 + MIN_AGE}-06-15`);
  assert.equal(annuity.bound_by_holding_period, false);
});

test('이연퇴직소득이 있으면 5년 요건이 면제된다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { birth_date: '1972-06-15' },
        accounts: {
          retirement_pension: { opened_on: '2026-01-10', has_deferred_retirement_income: true },
        },
      }),
      rulesets,
    ),
  );

  const irp = scenario.pension_withdrawal_start.find((e) => e.account === 'retirement_pension');
  assert.equal(irp.holding_requirement_waived, true);
  assert.equal(irp.earliest_start_date, `${1972 + MIN_AGE}-06-15`);
});

test('가입일을 모르면 시점을 계산하지 않는다 — 남은 기간을 추정하지 않는다', () => {
  const scenario = scenarioOf(compute(baseRequest(), rulesets));

  for (const entry of scenario.pension_withdrawal_start) {
    assert.equal(entry.computable, false);
    assert.equal(entry.earliest_start_date, null);
    assert.equal(entry.reason_code, 'opened_on_missing');
    // 나이 요건만은 계산할 수 있으므로 그것만 낸다.
    assert.ok(entry.age_requirement_date !== null);
  }
  assert.ok(noticeCodes(scenario).includes('pension_start_date_not_computable'));
});

test('계산된 개시 시점이 인출 경고에 실려 나간다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { birth_date: '1972-06-15', fund_use_horizon: 'before_pension_age' },
        accounts: { annuity_savings: { opened_on: '2026-01-10' } },
      }),
      rulesets,
    ),
  );

  const warning = planOf(scenario, 'max_tax_credit').warnings.find(
    (w) => w.account === 'annuity_savings' && w.code === 'early_withdrawal_penalty_pension',
  );
  assert.equal(warning.params.earliest_start_date, `${2026 + HOLDING_YEARS}-01-10`);
  assert.equal(warning.params.earliest_start_computable, true);
  assert.ok(warning.basis_rule_ids.includes('pension.withdrawal.earliest_start'));
});

// ── 퇴직급여 입금 ────────────────────────────────────────────────

test('퇴직급여 입금액은 세액공제 대상이 아니다 — 두 계좌 모두', () => {
  const plain = scenarioOf(compute(baseRequest(), rulesets));
  const before = planOf(plain, 'max_tax_credit').deterministic_benefit;

  // **두 계좌를 다 본다.** 한쪽만 시험하면 다른 쪽에서 여력과 섞여도 아무도 모른다.
  for (const account of ['retirement_pension', 'annuity_savings']) {
    const withTransfer = scenarioOf(
      compute(
        baseRequest({ accounts: { [account]: { retirement_transfer_in_krw: 5_000_000 } } }),
        rulesets,
      ),
    );
    const after = planOf(withTransfer, 'max_tax_credit').deterministic_benefit;

    // 계좌 잔액은 늘지만 공제 대상 납입액도 공제액도 한 원도 늘거나 줄지 않는다.
    assert.equal(
      after.credit_eligible_contribution_krw,
      before.credit_eligible_contribution_krw,
      `${account}: 퇴직급여 입금액이 공제 대상 납입액에 섞였다`,
    );
    assert.equal(
      after.pension_credit_total_krw,
      before.pension_credit_total_krw,
      `${account}: 퇴직급여 입금액이 공제액을 바꿨다`,
    );
    assert.equal(withTransfer.limits.retirement_transfer_in_krw, 5_000_000);
    assert.ok(noticeCodes(withTransfer).includes('retirement_transfer_excluded_from_credit'));
  }
});

test('퇴직급여 입금액을 납입한도 소진으로 본 사실이 가정으로 나간다', () => {
  const response = compute(
    baseRequest({
      accounts: { retirement_pension: { retirement_transfer_in_krw: 5_000_000 } },
    }),
    rulesets,
  );
  const scenario = scenarioOf(response);

  assert.equal(
    scenario.limits.pension_contribution_limit_remaining_krw,
    CONTRIBUTION_LIMIT - 5_000_000,
  );
  // 룰셋이 정한 것은 세액공제 대상에서 빠진다는 것뿐이다. 납입한도 취급은 엔진이 고른
  // 쪽이고, 고른 쪽과 그 이유가 가정으로 드러나야 한다.
  assert.ok(
    response.assumptions.some((a) => a.code === 'retirement_transfer_counted_in_contribution_limit'),
  );
});

// ── 생년월일 ─────────────────────────────────────────────────────

test('만 나이 환산은 엔진이 하고, 기준일이 룰셋 근거가 아니라는 사실을 함께 낸다', () => {
  const response = compute(baseRequest({ profile: { birth_date: '1986-03-02' } }), rulesets);

  assert.equal(response.echo.derived_age.age_years, 40);
  assert.equal(response.echo.derived_age.reference_date, '2026-12-31');
  assert.equal(response.echo.derived_age.reference_date_from_ruleset, false);

  const assumption = response.assumptions.find((a) => a.code === 'age_reference_date_not_in_ruleset');
  assert.ok(assumption, '기준일 규칙이 룰셋에 없다는 사실이 가정에 실려야 한다');
  assert.equal(assumption.params.reference_date, '2026-12-31');
  assert.deepStrictEqual(assumption.basis_rule_ids, [], '룰셋 근거가 없으므로 근거 규칙도 없다');
});

test('생년월일 하루 차이가 실제로 판정을 바꾼다', () => {
  const minAge = confirmedRule('isa.eligibility').value.any_of
    .filter((o) => !o.requires)
    .reduce((min, o) => Math.min(min, o.min_age), Infinity);

  const eligibleAt = (birthDate) =>
    scenarioOf(
      compute(
        baseRequest({ profile: { birth_date: birthDate, prior_year_total_salary_krw: null } }),
        rulesets,
      ),
    ).account_eligibility.find((e) => e.account === 'isa').eligible;

  // 기준일(과세기간 종료일)에 생일이 지난 사람과 하루 늦은 사람이 갈린다.
  assert.equal(eligibleAt(`${2026 - minAge}-12-31`), true);
  assert.equal(eligibleAt(`${2026 - minAge + 1}-01-01`), false);
});

test('달력에 없는 날짜는 오류로 되돌려준다', () => {
  const response = compute(baseRequest({ profile: { birth_date: '1986-02-30' } }), rulesets);

  assert.equal(response.ok, false);
  assert.ok(
    response.errors.some((e) => e.code === 'invalid_date' && e.field === 'profile.birth_date'),
  );
  // 오류 params에 입력값을 되풀이하지 않는다(생년월일 프라이버시 못).
  const error = response.errors.find((e) => e.field === 'profile.birth_date');
  assert.equal(JSON.stringify(error.params).includes('1986'), false);
});

// ── 계약 버전 ────────────────────────────────────────────────────

test('새 필수 입력이 없는 옛 요청은 조용히 통과하지 않는다', () => {
  // major를 올린 근거가 이것이다. 새 입력을 선택으로 두고 기본값을 만들면
  // 옛 소비자는 아무 신호 없이 예전 숫자를 계속 내보내게 된다.
  const legacy = {
    schema_version: '3.3.1',
    tax_year: 2026,
    scenarios: ['current'],
    profile: {
      age_years: 40,
      current_year_total_salary_krw: LOW_SALARY,
      prior_year_total_salary_krw: 60_000_000,
      financial_income_taxpayer_last_3_years: false,
      declared_youth: null,
      fund_use_horizon: 'at_or_after_pension_age',
      monthly_capacity_krw: 500_000,
      months_remaining_in_tax_year: 12,
    },
    accounts: {
      annuity_savings: { ytd_contribution_krw: 0 },
      retirement_pension: { ytd_contribution_krw: 0 },
      isa: {
        exists: true,
        account_type: 'general',
        cumulative_contribution_krw: 0,
        ytd_contribution_krw: 0,
        years_since_opening: 1,
        other_savings_contract_krw: 0,
      },
    },
    isa_transfer: null,
    options: null,
  };

  const response = compute(legacy, rulesets);
  assert.equal(response.ok, false);
  assert.ok(errorCodes(response).includes('schema_version_mismatch'));
  assert.equal(SCHEMA_VERSION.split('.')[0], '4');
});
