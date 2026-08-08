// 필수 테스트 3 — 경계값. 오류는 대부분 경계에서 나온다.
// 기대값은 전부 룰셋에서 읽어 만든다. 테스트에도 세법 수치를 적지 않는다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  loadRulesets,
  baseRequest,
  scenarioOf,
  planOf,
  allocationOf,
  noticeCodes,
  CONFIRMED_FILE,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

function rule(id) {
  const found = rulesets[CONFIRMED_FILE].rules.find((r) => r.id === id);
  if (!found) throw new Error(`룰셋에 규칙이 없다: ${id}`);
  return found;
}

const CREDIT_RATE = rule('pension.credit.rate');
const ANNUITY_LIMIT = rule('pension.credit.limit.annuity_savings').value.amount_krw;
const COMBINED_LIMIT = rule('pension.credit.limit.combined').value.amount_krw;
const SURTAX = rule('tax.local.personal_income_surtax').value.rate_of_income_tax;

const HIGH_BRACKET = CREDIT_RATE.value.brackets[0];
const LOW_BRACKET = CREDIT_RATE.value.brackets[CREDIT_RATE.value.brackets.length - 1];
const SALARY_BOUNDARY = HIGH_BRACKET.total_salary_only_max_krw;

/** 룰셋 비율을 정수 연산으로 적용한다. 부동소수점 누적을 피한다. */
function applyRate(amount, rate) {
  const decimals = (String(rate).split('.')[1] ?? '').length;
  const den = 10 ** decimals;
  return Math.floor((amount * Math.round(rate * den)) / den);
}

test('공제율 경계 — 법문이 "이하"이므로 경계값 정확히는 높은 구간이다', () => {
  const atBoundary = compute(
    baseRequest({ profile: { current_year_total_salary_krw: SALARY_BOUNDARY } }),
    rulesets,
  );
  const overBoundary = compute(
    baseRequest({ profile: { current_year_total_salary_krw: SALARY_BOUNDARY + 1 } }),
    rulesets,
  );

  assert.equal(atBoundary.echo.credit_rate_bracket.income_tax_rate, HIGH_BRACKET.rate);
  assert.equal(overBoundary.echo.credit_rate_bracket.income_tax_rate, LOW_BRACKET.rate);
});

test('경계 하나 차이로 세액공제액이 실제로 갈린다', () => {
  const monthly = 1_000_000;
  const at = scenarioOf(
    compute(
      baseRequest({
        profile: { current_year_total_salary_krw: SALARY_BOUNDARY, monthly_capacity_krw: monthly },
      }),
      rulesets,
    ),
  );
  const over = scenarioOf(
    compute(
      baseRequest({
        profile: { current_year_total_salary_krw: SALARY_BOUNDARY + 1, monthly_capacity_krw: monthly },
      }),
      rulesets,
    ),
  );

  const atBenefit = planOf(at, 'max_tax_credit').deterministic_benefit;
  const overBenefit = planOf(over, 'max_tax_credit').deterministic_benefit;

  assert.equal(atBenefit.credit_eligible_contribution_krw, overBenefit.credit_eligible_contribution_krw);
  assert.ok(atBenefit.pension_credit_total_krw > overBenefit.pension_credit_total_krw);

  const expectedIncomeTax = applyRate(atBenefit.credit_eligible_contribution_krw, HIGH_BRACKET.rate);
  assert.equal(atBenefit.pension_credit_income_tax_krw, expectedIncomeTax);
  assert.equal(atBenefit.pension_credit_local_tax_krw, applyRate(expectedIncomeTax, SURTAX));
  assert.equal(
    atBenefit.pension_credit_total_krw,
    atBenefit.pension_credit_income_tax_krw + atBenefit.pension_credit_local_tax_krw,
  );
});

test('한도를 정확히 채운다 — 남는 금액이 0이다', () => {
  const months = 12;
  const monthly = COMBINED_LIMIT / months;
  assert.equal(Number.isInteger(monthly), true, '이 테스트는 나누어떨어지는 예산을 전제로 한다');

  const scenario = scenarioOf(
    compute(baseRequest({ profile: { monthly_capacity_krw: monthly } }), rulesets),
  );
  const plan = planOf(scenario, 'max_tax_credit');

  assert.equal(plan.deterministic_benefit.credit_eligible_contribution_krw, COMBINED_LIMIT);
  assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, COMBINED_LIMIT);
  assert.equal(allocationOf(plan, 'annuity_savings').annual_krw, 0);
  assert.equal(plan.unallocated_annual_krw, 0);
  assert.equal(plan.monthly_rounding_residual_krw, 0);
});

test('IRP 우선 충당이 약우월이다 — 같은 예산에서 세액공제액이 낮아지지 않는다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 } }), rulesets),
  );

  const max = planOf(scenario, 'max_tax_credit').deterministic_benefit.pension_credit_total_krw;
  for (const plan of scenario.plans) {
    assert.ok(
      plan.deterministic_benefit.pension_credit_total_krw <= max,
      `${plan.plan_id}가 세액공제 최대안보다 크다`,
    );
  }

  // 연금저축 우선안은 단독 한도를 넘는 구간에서 엄격히 불리해진다.
  const annuityFirst = planOf(scenario, 'annuity_savings_first');
  assert.equal(allocationOf(annuityFirst, 'annuity_savings').annual_krw, ANNUITY_LIMIT);
});

test('예산이 모든 한도를 넘으면 남는 금액을 명시한다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ profile: { monthly_capacity_krw: 50_000_000 } }), rulesets),
  );

  for (const plan of scenario.plans) {
    assert.ok(plan.unallocated_annual_krw > 0, '한도를 넘는 금액은 배분되지 않는다는 사실을 명시한다');
  }
  assert.ok(noticeCodes(scenario).includes('budget_exceeds_all_limits'));

  // 세액공제 대상 한도를 넘겨도 납입 한도가 남아 있으면 그 초과분은 충당하지 않는다.
  // 그래서 예산이 아무리 커도 연금계좌 배분은 공제 대상 한도에서 멈춘다.
  const maxCredit = planOf(scenario, 'max_tax_credit');
  assert.equal(
    allocationOf(maxCredit, 'retirement_pension').annual_krw +
      allocationOf(maxCredit, 'annuity_savings').annual_krw,
    COMBINED_LIMIT,
  );
  assert.equal(allocationOf(maxCredit, 'retirement_pension').limited_by, 'credit_limit');

  // 같은 절세액을 내는 다른 배분이 남는다 — 헌장이 요구하는 선택지 비교의 형태다.
  const equalCredit = scenario.plans.filter((p) => p.delta_vs_baseline_krw === 0);
  assert.ok(equalCredit.length >= 2);
  assert.ok(scenario.comparison_note_codes.includes('alternatives_have_equal_tax_credit'));
});

test('납입 여력 0 — 오류가 아니다. 한도 정보는 그대로 나온다', () => {
  const response = compute(baseRequest({ profile: { monthly_capacity_krw: 0 } }), rulesets);
  assert.equal(response.ok, true);

  const scenario = scenarioOf(response);
  // 세 안의 배분 벡터가 모두 0으로 같아지므로 하나로 합쳐진다.
  // 같은 숫자를 세 번 보여 비교인 척하지 않는다.
  assert.equal(scenario.plans.length, 1);
  assert.equal(scenario.plans[0].is_baseline, true);
  assert.ok(scenario.comparison_note_codes.includes('plans_collapsed_single'));
  for (const plan of scenario.plans) {
    for (const allocation of plan.allocations) {
      assert.equal(allocation.annual_krw, 0);
      assert.equal(allocation.fill_order, null);
    }
  }
  assert.ok(noticeCodes(scenario).includes('zero_capacity'));
  assert.ok(
    scenario.limits.pension_combined_credit_remaining_krw > 0,
    '여력이 0이어도 한도가 얼마나 비어 있는지는 유효한 정보다',
  );
});

test('기납입액이 이미 한도를 넘으면 잔여를 0으로 클램프하고 경고한다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        accounts: {
          annuity_savings: { ytd_contribution_krw: ANNUITY_LIMIT * 2 },
          retirement_pension: { ytd_contribution_krw: COMBINED_LIMIT * 2 },
        },
      }),
      rulesets,
    ),
  );

  assert.equal(scenario.limits.pension_combined_credit_remaining_krw, 0);
  for (const limit of scenario.limits.by_account) {
    assert.ok(limit.contribution_limit_remaining_krw >= 0, '음수 잔여 한도를 만들지 않는다');
    if (limit.credit_eligible_limit_remaining_krw !== null) {
      assert.ok(limit.credit_eligible_limit_remaining_krw >= 0);
    }
  }
  assert.ok(noticeCodes(scenario).includes('existing_contribution_over_limit'));
});

test('기납입액을 뺀 잔여 한도 안에서만 배분한다', () => {
  const half = ANNUITY_LIMIT;
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 },
        accounts: { retirement_pension: { ytd_contribution_krw: half } },
      }),
      rulesets,
    ),
  );

  const plan = planOf(scenario, 'max_tax_credit');
  assert.equal(
    plan.deterministic_benefit.credit_eligible_contribution_krw,
    COMBINED_LIMIT,
    '기납입분을 포함해 합산 한도를 넘지 않는다',
  );
});

test('ISA 연간 한도는 상수가 아니라 산식이다 — 가입경과연수에 따라 달라진다', () => {
  const early = scenarioOf(
    compute(baseRequest({ accounts: { isa: { years_since_opening: 0 } } }), rulesets),
  );
  const later = scenarioOf(
    compute(baseRequest({ accounts: { isa: { years_since_opening: 3 } } }), rulesets),
  );

  const isaOf = (s) => s.limits.by_account.find((l) => l.account === 'isa');
  assert.ok(
    isaOf(later).contribution_limit_remaining_krw > isaOf(early).contribution_limit_remaining_krw,
    '경과연수가 늘면 그 해에 넣을 수 있는 금액이 커진다',
  );
});

test('ISA 총 납입한도에서 재형저축·장기펀드 계약금액이 차감된다', () => {
  const totalLimit = rule('isa.account.requirements').value.total_contribution_limit_krw;
  const withOther = scenarioOf(
    compute(
      baseRequest({
        accounts: {
          isa: { years_since_opening: 9, other_savings_contract_krw: Math.floor(totalLimit / 2) },
        },
      }),
      rulesets,
    ),
  );
  const withoutOther = scenarioOf(
    compute(baseRequest({ accounts: { isa: { years_since_opening: 9 } } }), rulesets),
  );

  const isaOf = (s) => s.limits.by_account.find((l) => l.account === 'isa');
  assert.ok(isaOf(withOther).contribution_limit_remaining_krw < isaOf(withoutOther).contribution_limit_remaining_krw);
});

test('모든 금액이 정수 원이다', () => {
  const response = compute(baseRequest({ profile: { monthly_capacity_krw: 333_333 } }), rulesets);
  const scenario = scenarioOf(response);

  const walk = (node, path) => {
    if (typeof node === 'number') {
      assert.equal(Number.isInteger(node) || !path.endsWith('_krw'), true, `${path}가 정수가 아니다: ${node}`);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
    }
  };

  walk(scenario, 'scenario');
});
