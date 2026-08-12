// 세액 한도·연금수령 개시·개시 가능 시점·퇴직급여 입금의 동작 고정.
//
// **한도가 입력에서 계산으로 바뀌었다**(D39·D40). 소유자가 직전 과세연도 결정세액 입력을
// 없애라고 했고, 대체 경로는 해당 과세기간 총급여액에서 §47 → §50①1 → §55① → §59를
// 밟아 §61②③의 한도를 **추정**한다. 나온 값은 하한이 아니라 **상한**이다.
//
// **이 파일이 무는 것 셋.**
//   1. 관리자가 조문으로 검산한 세 좌표(`CAP_COORDINATES`)를 값으로 못 박는다.
//   2. 그 위(약 3,414만원 초과)에서는 한도가 **아무것도 자르지 않는다** — 자르지 않는 것이
//      결함이 아니라 설계라는 것이 다음 사람에게 보이도록 좌표로 남긴다.
//   3. 상한 성질에서 나오는 두 진술을 가른다 — 「걸린다」는 증명되고 「안 걸린다」는
//      증명되지 않는다.
//
// **기대값은 룰셋과 D40에서 온다.** 세법 수치를 이 파일이 스스로 적으면 두 번째 진실
// 원천이 되고, 룰셋이 바뀌어도 조용히 통과한다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { SCHEMA_VERSION } from './constants.mjs';
import {
  CAP_COORDINATES,
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
const MAX_CREDIT_RATE = Math.max(
  ...confirmedRule('pension.credit.rate').value.brackets.map((b) => b.rate),
);
const SURTAX_RATE = confirmedRule('tax.local.personal_income_surtax').value.rate_of_income_tax;
const COMBINED_LIMIT = confirmedRule('pension.credit.limit.combined').value.amount_krw;
/** 연금저축 단독 공제한도. **`12.0.0`부터 자르기 좌표의 자르기 전 금액이 여기서 나온다**(D52 1번). */
const ANNUITY_LIMIT = confirmedRule('pension.credit.limit.annuity_savings').value.amount_krw;
const CONTRIBUTION_LIMIT = confirmedRule('pension.contribution.annual_limit').value.amount_krw;
const PENSION_REQUIREMENTS = confirmedRule('pension.withdrawal.eligibility').value.requirements;
const MIN_AGE = PENSION_REQUIREMENTS.find((r) => r.id === 'age').min_age;
const HOLDING_YEARS = PENSION_REQUIREMENTS.find((r) => r.id === 'holding_period').min_years;

/**
 * 전환 추가한도가 없을 때 이 룰셋이 낼 수 있는 **최대 세액공제 소득세분.**
 * 합산 인정한도를 이 사람에게 걸릴 수 있는 가장 높은 율로 전부 채운 값이다.
 */
const MAX_CREDIT_INCOME_TAX = Math.floor(COMBINED_LIMIT * MAX_CREDIT_RATE);

/** 총급여를 우대 구간 안에 두어 공제율이 CREDIT_RATE로 판정되게 한다. */
const LOW_SALARY = 50_000_000;

/** 총급여만 갈아 끼운 요청. 한도는 이제 이 값 하나에서 나온다. */
function withSalary(salary, patch = {}) {
  return baseRequest(
    deepMerge(
      {
        profile: {
          current_year_total_salary_krw: salary,
          // ISA 유형 교차확인은 직전 연도 값이 따로 정한다 — 한도 축과 섞지 않는다.
          prior_year_total_salary_krw: 60_000_000,
        },
      },
      patch,
    ),
  );
}

/** 합산 인정한도를 전부 채우는 예산. 한도가 자를 여지가 실제로 생긴다. */
const FULL_PENSION = { profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 } };

const capOf = (salary, patch = {}) =>
  scenarioOf(compute(withSalary(salary, patch), rulesets)).pension_credit_tax_liability_cap;

// ── 관리자가 조문으로 검산한 세 좌표 (D40) ───────────────────────

test('총급여 5,000,000원 이하의 한도는 정확히 0이다 — 추정이 아니라 등식', () => {
  const scenario = scenarioOf(
    compute(withSalary(CAP_COORDINATES.ZERO_EXACT.total_salary_krw), rulesets),
  );
  const cap = scenario.pension_credit_tax_liability_cap;

  // 근로소득공제 뒤 근로소득금액이 본인 기본공제와 같아 과세표준이 정확히 0이 된다.
  assert.equal(cap.tax_base_krw, 0);
  assert.equal(cap.computed_tax_krw, 0);
  assert.equal(cap.cap_krw, CAP_COORDINATES.ZERO_EXACT.cap_krw);
  // 상한이 0이면 실제 한도도 0보다 클 수 없다. 이 구간에서만 등식이 성립한다.
  assert.equal(cap.is_exact, true);
  assert.equal(
    scenario.notices.find((n) => n.code === 'tax_liability_cap_zero').params.is_exact,
    true,
  );
});

test('총급여 30,686,275원의 한도는 899,999원이고 그 한도가 공제를 자른다', () => {
  const { total_salary_krw: salary, cap_krw: expected } = CAP_COORDINATES.BINDS;
  const scenario = scenarioOf(compute(withSalary(salary, FULL_PENSION), rulesets));

  assert.equal(scenario.pension_credit_tax_liability_cap.cap_krw, expected);
  // 상한이지 등식이 아니다 — 0이 아닌 값에는 등식 구간이 없다.
  assert.equal(scenario.pension_credit_tax_liability_cap.is_exact, false);

  const benefit = planOf(scenario, 'max_tax_credit').deterministic_benefit;
  assert.ok(
    benefit.pension_credit_income_tax_before_cap_krw > expected,
    '이 좌표에서 자르지 않으면 아래 검사들이 아무것도 증명하지 못한다',
  );
  assert.equal(benefit.pension_credit_income_tax_krw, expected);
  assert.equal(benefit.tax_liability_cap.applied, true);
});

test('총급여 34,143,912원의 한도는 정확히 1,350,000원 — 최대 공제액과 같아지는 지점', () => {
  const { total_salary_krw: salary, cap_krw: expected } = CAP_COORDINATES.NO_LONGER_BINDS;

  assert.equal(capOf(salary).cap_krw, expected);
  // **이 수가 우연이 아니다.** 합산 인정한도를 최고 공제율로 전부 채운 소득세분과 같다.
  assert.equal(expected, MAX_CREDIT_INCOME_TAX);
});

// ── 자르지 않는 것이 결함이 아니라 설계다 (D40) ──────────────────

test('약 3,414만원 위에서는 이 한도가 아무것도 자르지 않는다 — 결함이 아니라 설계다', () => {
  const boundary = CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw;

  // 경계 위쪽. 예산을 합산 한도까지 채워 자를 여지를 최대로 만들어도 자르지 않는다.
  for (const salary of [boundary, boundary + 1, 40_000_000, LOW_SALARY, 100_000_000]) {
    const scenario = scenarioOf(compute(withSalary(salary, FULL_PENSION), rulesets));
    const cap = scenario.pension_credit_tax_liability_cap;
    assert.ok(
      cap.cap_krw >= MAX_CREDIT_INCOME_TAX,
      `총급여 ${salary}: 한도(${cap.cap_krw})가 최대 공제액(${MAX_CREDIT_INCOME_TAX})보다 작다`,
    );
    for (const plan of scenario.plans) {
      assert.equal(
        plan.deterministic_benefit.tax_liability_cap.applied,
        false,
        `총급여 ${salary} / ${plan.plan_id}: 자르지 않아야 할 좌표에서 잘렸다`,
      );
    }
    assert.equal(noticeCodes(scenario).includes('tax_liability_cap_applied'), false);
  }

  // 경계 아래에서는 실제로 자른다. 위 검사가 "언제나 자르지 않는다"를 시험한 것이
  // 되지 않게 하는 짝이다.
  const below = scenarioOf(
    compute(withSalary(CAP_COORDINATES.BINDS.total_salary_krw, FULL_PENSION), rulesets),
  );
  assert.ok(below.pension_credit_tax_liability_cap.cap_krw < MAX_CREDIT_INCOME_TAX);
  assert.ok(noticeCodes(below).includes('tax_liability_cap_applied'));
});

// ── 값이 어디서 나왔는가 ─────────────────────────────────────────

test('한도는 총급여액에서 네 단계로 나온다 — 그 중간값이 전부 값으로 나간다', () => {
  const cap = capOf(LOW_SALARY);
  const basicDeduction = confirmedRule('income.deduction.basic.self').value.amount_krw;

  // 1. 총급여 → 근로소득금액, 2. 본인 기본공제, 3. 산출세액, 4. 근로소득세액공제 차감.
  assert.equal(cap.measured_total_salary_krw, LOW_SALARY);
  assert.equal(cap.wage_income_amount_krw, LOW_SALARY - cap.wage_income_deduction_krw);
  assert.equal(cap.basic_deduction_krw, basicDeduction);
  assert.equal(cap.tax_base_krw, cap.wage_income_amount_krw - basicDeduction);
  assert.equal(cap.cap_krw, cap.computed_tax_krw - cap.wage_income_credit_krw);
  assert.equal(cap.basis_code, 'current_year_total_salary');

  // 근거 규칙 다섯이 전부 실린다. 하나라도 빠지면 화면이 그 조문을 보이지 못한다.
  for (const ruleId of [
    'income.wage.deduction',
    'income.deduction.basic.self',
    'tax.rate.basic',
    'credit.wage_income',
    'pension.credit.tax_liability_cap.current_year_estimate',
  ]) {
    assert.ok(cap.basis_rule_ids.includes(ruleId), `근거에 ${ruleId}이 없다`);
  }
});

test('한도가 상한이라는 사실이 금액과 같은 응답에 실린다', () => {
  const scenario = scenarioOf(compute(withSalary(LOW_SALARY), rulesets));
  const cap = scenario.pension_credit_tax_liability_cap;

  assert.equal(cap.error_direction_code, 'overstated_or_equal');
  assert.equal(cap.is_upper_bound, true);
  assert.equal(cap.branch_code, 'wage_income_only');

  // 「모름」 상태가 사라졌으므로 값은 언제나 정수다. `null`을 내지 않는다.
  assert.equal(Number.isInteger(cap.cap_krw), true);

  const estimated = scenario.notices.find(
    (n) => n.code === 'tax_liability_cap_estimated_from_total_salary',
  );
  assert.ok(estimated, '이 값이 총급여액에서 계산한 상한이라는 사실이 안내로 나가야 한다');
  assert.equal(estimated.severity, 'warning');
  assert.equal(estimated.params.error_direction, 'overstated_or_equal');
  assert.equal(estimated.params.is_upper_bound, true);
  assert.ok(
    estimated.basis_rule_ids.includes('pension.credit.tax_liability_cap.current_year_estimate'),
  );

  // 폐기된 코드가 되살아나지 않는다.
  assert.equal(noticeCodes(scenario).includes('tax_liability_cap_unknown'), false);
});

test('오차 방향은 룰셋에서 읽는다 — 엔진이 스스로 정하지 않는다', () => {
  const fromRuleset = confirmedRule('pension.credit.tax_liability_cap.current_year_estimate').value
    .error_direction.code;
  assert.equal(capOf(LOW_SALARY).error_direction_code, fromRuleset);
});

// ── 분기마다 방향이 다르다 ───────────────────────────────────────

test('종합소득금액을 받으면 그 금액이 과세표준의 기준이 되고 방향은 그대로 상한이다', () => {
  const cap = capOf(LOW_SALARY, {
    profile: {
      has_non_wage_global_income_current_year: true,
      current_year_global_income_krw: 40_000_000,
    },
  });

  assert.equal(cap.branch_code, 'global_income_amount_supplied');
  assert.equal(cap.measured_global_income_krw, 40_000_000);
  // 근로소득공제는 종합소득금액 안에서 이미 빠져 있다 — 다시 빼지 않는다.
  assert.equal(cap.tax_base_krw, 40_000_000 - cap.basic_deduction_krw);
  assert.equal(cap.is_upper_bound, true);
  assert.equal(cap.error_direction_code, 'overstated_or_equal');
});

test('종합소득이 있는데 금액을 모르면 방향이 미정이다 — 상한 코드로 내지 않는다', () => {
  const scenario = scenarioOf(
    compute(
      withSalary(LOW_SALARY, {
        profile: {
          has_non_wage_global_income_current_year: true,
          current_year_global_income_krw: null,
        },
      }),
      rulesets,
    ),
  );
  const cap = scenario.pension_credit_tax_liability_cap;

  // 다른 소득을 세지 않은 것은 산출세액을 작게 잡는 방향이고 공제를 세지 않은 것은
  // 크게 잡는 방향이다. 두 힘의 부호가 반대라 합의 부호가 정해지지 않는다.
  assert.equal(cap.branch_code, 'global_income_amount_missing');
  assert.equal(cap.is_upper_bound, false);
  assert.equal(cap.error_direction_code, 'direction_indeterminate');
  assert.notEqual(cap.error_direction_code, 'overstated_or_equal');
  // 값이 0이어도 등식이 아니다 — 상한이 아니면 0이 실제 한도를 가두지 못한다.
  assert.equal(cap.is_exact, false);
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_direction_indeterminate'));
});

test('미정 분기에서는 잘려도 「걸린다」가 증명되지 않는다', () => {
  const indeterminate = scenarioOf(
    compute(
      withSalary(CAP_COORDINATES.BINDS.total_salary_krw, {
        profile: {
          has_non_wage_global_income_current_year: true,
          current_year_global_income_krw: null,
          monthly_capacity_krw: COMBINED_LIMIT / 12,
        },
      }),
      rulesets,
    ),
  );
  const benefit = planOf(indeterminate, 'max_tax_credit').deterministic_benefit;

  // 자르기는 한다 — 엔진이 낸 금액은 이 한도로 잘린 값이다.
  assert.equal(benefit.tax_liability_cap.applied, true);
  // 그러나 그 자름이 실제 한도의 자름을 증명하지는 못한다. 방향이 미정이기 때문이다.
  assert.equal(benefit.tax_liability_cap.binding_code, 'binding_not_determined');
});

// ── 「걸린다」와 「안 걸린다」는 대칭이 아니다 (D40) ──────────────

test('상한이 자르면 실제 한도도 반드시 자른다 — 그 사실만 코드로 낸다', () => {
  const binds = scenarioOf(
    compute(withSalary(CAP_COORDINATES.BINDS.total_salary_krw, FULL_PENSION), rulesets),
  );
  const benefit = planOf(binds, 'max_tax_credit').deterministic_benefit;

  assert.equal(benefit.tax_liability_cap.applied, true);
  assert.equal(benefit.tax_liability_cap.binding_code, 'binds_provably');
});

test('자르지 않은 결과는 「걸리지 않는다」를 증명하지 않는다 — 문장의 부재가 답이 아니다', () => {
  const ample = scenarioOf(compute(withSalary(LOW_SALARY, FULL_PENSION), rulesets));

  for (const plan of ample.plans) {
    const cap = plan.deterministic_benefit.tax_liability_cap;
    assert.equal(cap.applied, false);
    // **여기가 이 회차의 핵심이다.** 실제 한도는 이 상한보다 작을 수 있으므로
    // 「한도에 걸리지 않았습니다」는 증명되지 않는다. 화면이 그 반대 진술을 지어내지
    // 못하도록 계약이 두 상태를 값으로 가른다.
    assert.equal(cap.binding_code, 'binding_not_determined');
  }
  // 축 쪽 관계 코드도 「여유가 있다」는 뜻이 아니다 — 두 수의 비교일 뿐이다.
  assert.equal(
    ample.pension_credit_ceiling.tax_liability_cap_relation_code,
    'cap_at_or_above_ceiling',
  );
});

// ── 자르기 ───────────────────────────────────────────────────────

test('자르기 전 금액과 자른 뒤 금액을 둘 다 낸다', () => {
  const salary = CAP_COORDINATES.BINDS.total_salary_krw;
  const expected = CAP_COORDINATES.BINDS.cap_krw;
  const scenario = scenarioOf(compute(withSalary(salary, FULL_PENSION), rulesets));
  const benefit = planOf(scenario, 'max_tax_credit').deterministic_benefit;

  // **`12.0.0`에서 자르기 전 금액의 출처가 바뀌었다**(D52 1번). 이 좌표의 한도는
  // 연금저축 자기 한도만으로 나오는 공제액보다 **작으므로**, 그 위에 IRP를 채워도
  // 세액공제가 한 원도 늘지 않는다. 기본안은 그 몫을 내지 않고 예산은 ISA로 간다.
  // 그래서 인정 납입액이 합산 한도가 아니라 **연금저축 한도**다.
  //
  // **자르는 것은 그대로 있다** — 잘리는 것이 IRP가 아니라 연금저축의 공제액이기
  // 때문이고, 이 시험이 재려던 「자르기 전과 후가 갈린다」는 그대로 성립한다.
  const uncappedIncomeTax = Math.floor(ANNUITY_LIMIT * CREDIT_RATE);
  assert.equal(benefit.pension_credit_income_tax_before_cap_krw, uncappedIncomeTax);
  assert.ok(uncappedIncomeTax > expected, '자르지 않는 좌표에서는 이 시험이 아무것도 재지 않는다');
  assert.equal(benefit.pension_credit_income_tax_krw, expected);
  assert.equal(benefit.tax_liability_cap.applied, true);
  assert.equal(benefit.tax_liability_cap.reduced_income_tax_krw, uncappedIncomeTax - expected);

  // 지방소득세는 **인정된 소득세분**을 따라간다. 인정되지 않은 공제에 붙는 지방세를
  // 남겨 두면 근거가 사라진 금액이 결과에 남는다.
  assert.equal(benefit.pension_credit_local_tax_krw, Math.floor(expected * SURTAX_RATE));
  assert.equal(
    benefit.pension_credit_local_tax_before_cap_krw,
    Math.floor(uncappedIncomeTax * SURTAX_RATE),
  );

  // 인정된 **납입액**은 잘리지 않는다. 잘리는 것은 공제액이다.
  assert.equal(benefit.credit_eligible_contribution_krw, ANNUITY_LIMIT);
  // 그리고 그 납입액은 전환 신청의 대상으로 살아남는다 — "돈이 사라진다"가 아니다.
  assert.equal(benefit.tax_liability_cap.contribution_carryover_available, true);
  assert.equal(benefit.tax_liability_cap.credit_carryforward, false);
  assert.ok(
    benefit.tax_liability_cap.basis_rule_ids.includes(
      'pension.credit.unused.contribution_carryover',
    ),
  );
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_applied'));
});

test('임계값이 실제 경계다 — 한도가 그 아래로 내려가면 결과가 달라진다', () => {
  const probe = scenarioOf(compute(withSalary(LOW_SALARY, FULL_PENSION), rulesets));
  const threshold = planOf(probe, 'max_tax_credit').deterministic_benefit.tax_liability_cap
    .threshold_income_tax_krw;

  // 임계값은 자르기 전 소득세분이다. 한도가 그보다 크거나 같으면 자르지 않는다.
  assert.ok(probe.pension_credit_tax_liability_cap.cap_krw >= threshold);
  assert.equal(
    planOf(probe, 'max_tax_credit').deterministic_benefit.tax_liability_cap.applied,
    false,
  );

  // 총급여를 낮춰 한도를 임계값 아래로 내리면 그 차이만큼 정확히 잘린다.
  const below = scenarioOf(
    compute(withSalary(CAP_COORDINATES.BINDS.total_salary_krw, FULL_PENSION), rulesets),
  );
  const cut = planOf(below, 'max_tax_credit').deterministic_benefit.tax_liability_cap;
  assert.equal(cut.applied, true);
  assert.equal(cut.reduced_income_tax_krw, cut.threshold_income_tax_krw - cut.cap_krw);
});

test('1원에 못 미치게 잘리면 잘림 표시는 참이고 잘린 금액은 0이다 — 두 값이 다른 자를 쓴다', () => {
  // **손으로 세운 좌표다.** 총급여 24,795,208원이면 과세표준이 14,325,926(§47② 적용)이고
  // 한도의 정확값이 **400,000.005**다. 예산 2,666,667원의 공제액은 **400,000.05**이므로
  // 한도가 0.045원만큼 자른다 — 두 값의 표시 금액은 둘 다 400,000이다.
  //
  // **어느 쪽도 결함이 아니다.** `applied`는 룰셋 `tax.rounding.won_fraction`의 `comparison`
  // 단계가 정한 대로 **정확값**으로 판정하고(절사하고 비교하면 1원 미만의 차이가 사라져
  // 판정이 뒤집힌다 — D46 1번이 고친 결함이 그 형태다), 표시되는 잘린 금액은 화면에
  // 나란히 놓이는 세 수가 서로 맞도록 **표시 금액끼리** 뺀다.
  //
  // **그래서 화면은 「잘렸다」를 `applied`로 쓰면 안 되고 금액이 실제로 줄었는지를 함께
  // 봐야 한다.** 이 좌표가 그 사실을 값으로 고정한다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          birth_date: '1986-06-15',
          current_year_total_salary_krw: 24_795_208,
          monthly_capacity_krw: 2_666_667,
          months_remaining_in_tax_year: 1,
        },
      }),
      rulesets,
    ),
  );
  const benefit = planOf(scenario, 'max_tax_credit').deterministic_benefit;
  const cap = benefit.tax_liability_cap;

  assert.equal(scenario.pension_credit_tax_liability_cap.tax_base_krw, 14_325_926);
  assert.equal(cap.cap_krw, 400_000);
  assert.equal(benefit.pension_credit_income_tax_before_cap_krw, 400_000);
  assert.equal(benefit.pension_credit_income_tax_krw, 400_000);
  assert.equal(cap.applied, true);
  assert.equal(cap.reduced_income_tax_krw, 0);
  assert.equal(cap.reduced_local_tax_krw, 0);
  assert.equal(cap.reduced_total_krw, 0);
  // 자름이 증명되는 분기이므로 표시가 있는 쪽 코드가 나간다.
  assert.equal(cap.binding_code, 'binds_provably');
});

test('밀려난 납입액이 0이면 전환 가능 표시가 false다 — applied와 갈리는 것이 설계다', () => {
  // **같은 좌표를 두 번째 자로 다시 잰다**(D54 후속). 총급여 24,795,208 · 월 2,666,667은
  // `applied: true`이면서 **표시 초과분이 0**인 자리이고, `13.0.0`까지 이 칸이 `applied`에
  // 직결돼 있어 **밀려난 납입액이 없는 사용자에게 `true`가 나갔다.**
  //
  // **두 칸은 다른 물음에 답한다.**
  //   · `applied` — 「한도가 물었는가」. 트림 전 금액에 대고 **정확값**으로 잰다.
  //   · `contribution_carryover_available` — 「밀려난 납입액이 있는가」. **표시 금액**으로 잰다.
  //
  // **자가 표시 금액인 근거는 조문이다** — 시행령 §118의3①의 대상이 「세액공제를 받지
  // 아니한 **금액**」이고 구조가 **의제인출 + 의제재납입**이라 그 금액이 계좌에 남아
  // 있어야 한다. **원 미만의 연금보험료를 「가장 먼저 인출하여 다시 납입한 것으로 본다」는
  // 처분은 실행될 수 없다.** 그 단계를 정하는 조문은 없고(국고금관리법 §47②가 지목하는
  // 것은 과세표준 하나다) 이 조직이 정한 자다 — 계약 5.5절이 그렇게 명시한다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          birth_date: '1986-06-15',
          current_year_total_salary_krw: 24_795_208,
          monthly_capacity_krw: 2_666_667,
          months_remaining_in_tax_year: 1,
        },
      }),
      rulesets,
    ),
  );

  // **`applied: true`이면서 `false`인 자리가 실제로 서는지를 먼저 확인한다.** 이 좌표에서
  // 한도가 물지 않으면 아래 반복문은 통과하면서 아무것도 재지 않는다.
  assert.equal(
    planOf(scenario, 'max_tax_credit').deterministic_benefit.tax_liability_cap.applied,
    true,
    '이 좌표에서 한도가 물지 않으면 두 자가 갈리는 자리가 아니다',
  );

  // **모든 배분안에서 성립한다.** 한 안에서만 재면 다른 안이 조용히 갈릴 수 있다.
  // (`isa_first`는 연금 공제액 자체가 한도 아래라 `applied`가 `false`다 — 그 안에서도
  //  밀려난 납입액은 없으므로 이 칸은 같은 `false`다.)
  for (const plan of scenario.plans) {
    const cap = plan.deterministic_benefit.tax_liability_cap;
    assert.equal(cap.reduced_total_krw, 0, plan.plan_id);
    assert.equal(
      cap.contribution_carryover_available,
      false,
      `${plan.plan_id}: 인출을 의제할 대상이 계좌에 없는데 전환 가능하다고 적었다`,
    );
    // 읽지 않은 규칙을 주장하지 않는다 — 조건 둘도 근거도 함께 빠진다.
    assert.equal(cap.carryover_shares_future_year_credit_limit, null, plan.plan_id);
    assert.equal(cap.carryover_requires_application, null, plan.plan_id);
    assert.ok(
      !cap.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'),
      `${plan.plan_id}: 읽지 않은 전환 특례 규칙이 근거로 실렸다`,
    );
  }
});

test('한 원이라도 밀려나면 전환 가능 표시가 true다 — 대조군', () => {
  // **위 좌표의 대조군이다.** 자가 표시 금액이라는 것은 「언제나 false」가 아니다.
  // 표시로 1원이라도 잘리면 그 금액에 대응하는 납입액이 계좌에 실제로 남아 있고,
  // 의제인출이 실행될 수 있다.
  const cap = planOf(
    scenarioOf(compute(withSalary(CAP_COORDINATES.BINDS.total_salary_krw, FULL_PENSION), rulesets)),
    'max_tax_credit',
  ).deterministic_benefit.tax_liability_cap;

  assert.ok(cap.reduced_income_tax_krw > 0, '이 좌표가 자르지 않으면 대조군이 아니다');
  assert.equal(cap.applied, true);
  assert.equal(cap.contribution_carryover_available, true);
  assert.equal(cap.carryover_shares_future_year_credit_limit, true);
  assert.equal(cap.carryover_requires_application, true);
  assert.ok(cap.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'));
});

// ── 한도가 0일 때 ────────────────────────────────────────────────

test('한도가 0이면 공제액은 0이지만 연금계좌 배분을 0으로 만들지 않는다', () => {
  const zero = scenarioOf(
    compute(withSalary(CAP_COORDINATES.ZERO_EXACT.total_salary_krw), rulesets),
  );
  const ample = scenarioOf(compute(withSalary(LOW_SALARY), rulesets));

  assert.equal(zero.pension_credit_tax_liability_cap.cap_krw, 0);

  for (const plan of zero.plans) {
    assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 0);
    // 연금계좌에 배분한 안은 자르기 전 금액이 남아 있다 — 화면이 "계산된 공제액 중
    // 얼마가 이번 과세연도에 쓰이지 않았는지"를 말할 수 있어야 한다.
    if (
      allocationOf(plan, 'retirement_pension').annual_krw +
        allocationOf(plan, 'annuity_savings').annual_krw >
      0
    ) {
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
  const scenario = scenarioOf(
    compute(withSalary(CAP_COORDINATES.ZERO_EXACT.total_salary_krw), rulesets),
  );

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
  const zero = scenarioOf(
    compute(withSalary(CAP_COORDINATES.ZERO_EXACT.total_salary_krw), rulesets),
  );
  const ample = scenarioOf(compute(withSalary(LOW_SALARY), rulesets));

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
    // **자격의 축이 계좌마다 다르다**(D44). 개시 여부는 두 계좌에 대칭으로 걸리지만,
    // 가입 자격 규칙은 IRP에만 있고 연금저축 쪽 규칙이 기록하는 것은 **요건의 부재**다.
    // 근거 목록이 그 비대칭을 그대로 비춘다 — 대칭인 것은 결론이지 근거가 아니다.
    assert.deepStrictEqual(
      entry.basis_rule_ids,
      account === 'retirement_pension'
        ? ['irp.eligibility', 'pension.contribution.after_annuity_start']
        : ['pension.contribution.after_annuity_start', 'pension_savings.eligibility'],
    );
    // 이 사용자는 근로소득이 있어 가입 자격 축에서는 걸리지 않는다. 배분에서 빠진 이유는
    // 개시 하나뿐이고, 두 축이 값으로 갈려 있다.
    assert.equal(
      entry.determination_code,
      account === 'retirement_pension' ? 'irp_eligible' : null,
    );

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

test('만 나이 환산은 엔진이 하고, 기준일이 룰셋에서 나온 값이 아니라는 사실을 함께 낸다', () => {
  const response = compute(baseRequest({ profile: { birth_date: '1986-03-02' } }), rulesets);

  assert.equal(response.echo.derived_age.age_years, 40);
  assert.equal(response.echo.derived_age.reference_date, '2026-12-31');
  // 규칙은 생겼지만 그 결론이 "단일 기준일은 존재하지 않는다"이므로 값은 그대로 false다.
  // 달라진 것은 false의 뿌리다 — 규칙의 부재가 아니라 규칙의 내용이다.
  assert.equal(response.echo.derived_age.reference_date_from_ruleset, false);

  const assumption = response.assumptions.find((a) => a.code === 'age_reference_date_not_in_ruleset');
  assert.ok(assumption, '기준일을 엔진이 골랐다는 사실이 가정에 실려야 한다');
  assert.equal(assumption.params.reference_date, '2026-12-31');
  assert.deepStrictEqual(
    assumption.basis_rule_ids,
    ['age.reckoning.reference_date'],
    '이제 근거 규칙이 있다 — 그 규칙이 "기준일을 하나로 정할 수 없다"고 말한다',
  );
});

test('이 가정이 어느 요건에 걸리는지가 값으로 나간다 — 룰셋에서 읽는다', () => {
  const response = compute(baseRequest(), rulesets);
  const assumption = response.assumptions.find((a) => a.code === 'age_reference_date_not_in_ruleset');

  // 목록을 엔진이 세어 두지 않는다. 룰셋의 per_rule에서 needs_reference_date인 것만 낸다.
  const expected = confirmedRule('age.reckoning.reference_date')
    .value.no_single_reference_date.per_rule.filter((entry) => entry.needs_reference_date === true)
    .map((entry) => entry.rule_id)
    .sort();

  assert.deepStrictEqual(assumption.params.requires_reference_date_rule_ids, expected);
  assert.ok(expected.length > 0, '기준일이 필요한 요건이 하나도 없으면 이 가정 자체가 필요 없다');

  // 연금 쪽은 날짜 대 날짜로 비교하므로 이 목록에 없어야 한다 — 그 사실은
  // pension_withdrawal_start가 이미 날짜로 말하고 있다.
  assert.equal(assumption.params.requires_reference_date_rule_ids.includes('pension.withdrawal.earliest_start'), false);

  // 근거로 실었으면 legal_basis에서도 찾을 수 있어야 한다. 읽지 않은 규칙을 근거로 대지 않는다.
  const entry = scenarioOf(response).legal_basis.find((e) => e.rule_id === 'age.reckoning.reference_date');
  assert.ok(entry, '가정이 근거로 든 규칙이 근거 목록에 없다');
  assert.ok(entry.applied_to.includes('echo.derived_age.reference_date'));
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
  // D32에서 6으로, 월 환산 잔차 처리에서 7로 올렸고, 8은 **값이 아니라 서술**이었다
  // (계약 0.13절 — `7.0.0`이 적은 월 환산 이탈 범위가 산술로 틀렸고, 그 범위를 믿은
  // 소비자는 값이 유효 범위 안이라 어떤 검증에도 걸리지 않는 채로 틀린다).
  //
  // **9로 올린 것은 요청에서 필수 필드가 사라졌기 때문만이 아니다**(계약 0.17절).
  // `profile.prior_year_tax`를 지운 것은 요청 쪽 변경이지만, 같은 변경이 **응답 쪽
  // 보장을 거둔다** — `cap_krw`가 그 사람의 실제 한도와 일치한다는 등식 보장이 사라지고
  // 상한이 되며, `applied: false`의 뜻이 「잘리지 않았다」에서 **「잘리는지 알 수 없다」**로
  // 바뀐다. 규약과 0.1절이 「계약이 보장하던 성질을 거두는 것」을 major로 정한다.
  //
  // **10으로 올린 것은 같은 요청이 다른 금액을 내기 때문이다**(계약 0.18절, D44).
  // 무소득자에게 IRP를 권하던 배분이 사라진다 — 새 입력이 늘어서가 아니라(둘 다 선택이다)
  // **응답의 금액이 실제로 움직이기** 때문이고, 그것이 `6.0.0`을 major로 만든 것과 같은
  // 근거다. `AccountEligibility`에 필드 둘이 늘고 `reason_codes`에 값이 하나 늘며
  // 시나리오에 `pension_credit_taxpayer_eligibility`가 붙는다.
  //
  // **11로 올린 것은 1원이 boolean을 뒤집기 때문이다**(계약 0.19절, D46 1번). 엔진이
  // 단계마다 원 미만을 버려 **과세표준이 조문(국고금 관리법 §47②)보다 항상 정확히 1원
  // 컸다.** 금액 차이는 1원인데 세액공제 상한이 정확히 900만 × 15%라, 한도가 그 절단선의
  // 1원 안에 놓인 사용자에게 `tax_liability_cap.applied`가 뒤집힌다 — **그 하나가 화면
  // 문구를 통째로 바꾼다.** 같은 요청이 다른 금액을 내고 기존 필드의 뜻이 바뀌므로
  // 규약의 두 범주에 동시에 걸린다.
  //
  // **12로 올린 것은 같은 요청이 다시 다른 금액을 내기 때문이다**(계약 0.20절, D52).
  // 둘이 겹쳤다 — (1) 세액공제를 한 원도 더 낳지 않는 IRP 배분을 기본안 후보가 내지
  // 않는다(그 판정의 재료가 **세액 한도**라 `tax_liability_cap_affects.allocation_amounts`가
  // `false`에서 `true`로 뒤집힌다), (2) 자금 사용 시점이 `within_isa_lock_in`이면
  // **전액 미배분**이다(D10이 뒤집혔고 `fund_use_horizon_affects`의 두 칸이 함께 뒤집힌다).
  // `limited_by`에 값이 둘 늘고 `unallocated_breakdown`에 `reason_code`가 붙는다.
  //
  // **13으로 올린 것은 `12.0.0`이 스스로 적은 보장 셋을 거두기 때문이다**(계약 0.21절, D53).
  // (1) 「`within_isa_lock_in`이면 **모든** 배분안의 세 계좌 금액이 0이고 예산 전액이
  // 미배분이다」가 거짓이 된다 — 의무가입기간이 이미 지난 ISA는 배분을 유지한다.
  // (2) 트림의 기준이 정확값에서 **표시되는 세액공제액**으로 옮겨져 끝수가 있는 한도의
  // 사용자마다 IRP 금액이 몇 원 움직이고, `tax_credit_before_cap`·`threshold_income_tax_krw`가
  // 따라 내려간다. (3) **표시 공제액이 같고 IRP만 더 묶인 안이 `plans`에서 빠진다** —
  // 배열의 길이와 `plan_id` 구성이 같은 요청에서 달라진다. 셋 다 「응답 쪽 보장을
  // 거두는 것」이고 0.1절이 그것을 major로 정한다.
  //
  // **14로 올린 것은 금액이 한 원도 안 바뀌기 때문이다**(계약 0.22절, D54 후속).
  // `contribution_carryover_available`이 `applied`에 직결돼 있던 것을 끊고 **실제
  // 잘림(표시 금액)**에 매달았다. 뒤집히는 것은 참·거짓 한 칸과 그것에 딸린 셋뿐이고
  // **금액은 하나도 움직이지 않는다** — 그래서 **금액을 보는 어떤 검사에도 걸리지
  // 않는다.** minor로 내면 목은 계속 돌면서 이 칸을 옛 뜻으로 읽고, 화면은 **넘길
  // 금액이 한 원도 없는 사용자**에게 이월 신청을 계속 안내한다. 규약의 「기존 필드의
  // 의미 변경」이고, `8.0.0`이 **값이 하나도 안 바뀌는데도** major를 고른 선례가 있다.
  assert.equal(SCHEMA_VERSION.split('.')[0], '14');
});
