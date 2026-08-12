// 원 미만 끝수 — **조문이 정한 자리와 우리가 정한 자리** (D46 1번 · 검증 20절).
//
// 이 파일이 지키는 것은 셋이다.
//
//   1. **좌표.** 「국고금 관리법」 §47②가 과세표준에서 1원 미만을 버리게 하고, 그 한 번이
//      `tax_liability_cap.applied`를 뒤집는 총급여가 실재한다. 여섯 단계의 값이 전부
//      `verification-report.md` 20.3절의 것이고 **저자는 `tax-domain`이다.**
//   2. **데이터에서 온다.** 연산(`operation_code`)과 단위(`unit_krw`)를 룰셋에서 바꾸면
//      결과가 따라 움직인다. 코드에는 「버림」도 「1원」도 없다.
//   3. **두 자리가 섞이지 않는다.** `determined_by_law`가 뒤집히면 엔진은 값을 지어내지
//      않고 멈춘다. 조문 자리에서 우리 규약을 쓰거나 그 반대로 쓰는 것도 같다.
//
// **왜 이 셋인가.** 같은 형태의 결함이 이 조직에서 네 번 나왔다 — 하나의 사실을 두 곳에
// 적고 한쪽만 갱신하는 형태다. 여기서 그 사실은 **「어느 단계가 조문이고 어느 단계가
// 우리 규약인가」**이고, 두 곳은 룰셋과 엔진이다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  CAP_COORDINATES,
  CONFIRMED_FILE,
  baseRequest,
  cloneRulesets,
  errorCodes,
  findRule,
  loadRulesets,
  planOf,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const ROUNDING_RULE = 'tax.rounding.won_fraction';

/** GC-32a~d와 같은 사람. 해당연도 총급여 한 칸만 움직인다. */
const withSalary = (salary) =>
  baseRequest({
    profile: {
      birth_date: '1986-06-15',
      current_year_total_salary_krw: salary,
      monthly_capacity_krw: 750_000,
      months_remaining_in_tax_year: 12,
    },
  });

const capOf = (bundle, salary) =>
  scenarioOf(compute(withSalary(salary), bundle)).pension_credit_tax_liability_cap;

const benefitOf = (bundle, salary) =>
  planOf(scenarioOf(compute(withSalary(salary), bundle)), 'max_tax_credit').deterministic_benefit;

/** 사본 위에서 원 미만 규칙의 단계 하나를 바꾼다. 원본은 건드리지 않는다. */
function withStage(stageCode, mutate) {
  const clone = cloneRulesets(rulesets);
  const rule = findRule(clone, CONFIRMED_FILE, ROUNDING_RULE);
  const stage = rule.value.stages.find((s) => s.stage_code === stageCode);
  assert.ok(stage, `룰셋에 ${stageCode} 단계가 없다 — 이 시험이 겨눈 자리가 사라졌다`);
  mutate(stage, rule);
  return clone;
}

// ── 1. 조문이 정한 한 번의 버림이 boolean을 뒤집는 좌표 ────────────────────────

test('§47②의 한 번 버림 — 총급여 34,143,911원에서 여섯 단계가 조문과 같다', () => {
  const { total_salary_krw: salary, cap_krw: expected } = CAP_COORDINATES.BINDS_BY_ONE_WON;
  const cap = capOf(rulesets, salary);

  // `verification-report.md` 20.3절의 표를 그대로 옮긴 것이다. 엔진에서 얻은 수가 아니다.
  //   근로소득공제 10,371,586.65 → 근로소득금액 23,772,324.35 → **과세표준 22,272,324**(§47②)
  //   → 산출세액 2,080,848.6 → 근로소득세액공제 730,848.712 → 한도 1,349,999.888
  assert.equal(cap.wage_income_deduction_krw, 10_371_586);
  assert.equal(cap.wage_income_amount_krw, 23_772_324);
  assert.equal(cap.tax_base_krw, 22_272_324);
  assert.equal(cap.computed_tax_krw, 2_080_848);
  assert.equal(cap.wage_income_credit_krw, 730_848);
  assert.equal(cap.cap_krw, expected);

  // **1원이 문장을 바꾼다.** 한도가 최대 공제액보다 1원 작으므로 자르고, 그 자름은
  // 상한 분기라 증명된다 — 화면이 D37의 문장을 쓸 수 있는 유일한 상태다.
  const benefit = benefitOf(rulesets, salary);
  assert.equal(benefit.pension_credit_income_tax_before_cap_krw, 1_350_000);
  assert.equal(benefit.pension_credit_income_tax_krw, 1_349_999);
  assert.equal(benefit.pension_credit_local_tax_krw, 134_999);
  assert.equal(benefit.pension_credit_total_krw, 1_484_998);
  assert.equal(benefit.tax_liability_cap.applied, true);
  assert.equal(benefit.tax_liability_cap.binding_code, 'binds_provably');
  assert.equal(benefit.tax_liability_cap.reduced_income_tax_krw, 1);
});

test('엔진이 단계마다 버리면 과세표준이 정확히 1원 커진다 — 그 항등식을 값으로 고정한다', () => {
  // 20.3절이 적은 항등식이다.
  //   단계마다 버리는 엔진의 과세표준 = 총급여 − floor(근로소득공제) − 종합소득공제
  //                                  = 조문의 과세표준 + frac(근로소득공제)
  // 근로소득공제에 끝수가 있으면 그 차이가 **정확히 1원**이고, 없으면 0이다.
  const fractional = CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw; // 15% 구간 · 20의 배수가 아니다
  const whole = 34_142_000; // GC-32d — §59②의 8/1000까지 정수로 떨어지는 좌표

  for (const [salary, expectedGap] of [[fractional, 1], [whole, 0]]) {
    const cap = capOf(rulesets, salary);
    const flooredFirst = salary - cap.wage_income_deduction_krw - cap.basic_deduction_krw;
    assert.equal(
      flooredFirst - cap.tax_base_krw,
      expectedGap,
      `총급여 ${salary}: 단계마다 버린 과세표준과 조문의 과세표준 차이가 ${expectedGap}원이 아니다`,
    );
  }
});

// ── 2. 버림과 반올림이 갈리는 경계 둘 — 단계가 서로 다르다 ────────────────────

test('경계 (가) 표시 단계 — 한도 1,349,999.888은 버리면 자르고 반올림하면 자르지 않는다', () => {
  const below = CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw; // 34,143,911
  const at = CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw; // 34,143,912

  // 총급여 1원 차이로 한도의 정확값이 1,349,999.888 → 1,350,000.046으로 넘어간다.
  // **버림이면 1,349,999 / 1,350,000이 되어 `applied`가 갈리고, 반올림이면 둘 다
  // 1,350,000이 되어 갈리지 않는다.** 조문은 「계산하지 아니한다」이므로 버림이다.
  assert.equal(capOf(rulesets, below).cap_krw, 1_349_999);
  assert.equal(capOf(rulesets, at).cap_krw, 1_350_000);
  assert.equal(benefitOf(rulesets, below).tax_liability_cap.applied, true);
  assert.equal(benefitOf(rulesets, at).tax_liability_cap.applied, false);
});

test('경계 (나) 과세표준 단계 — 19,333,333.75는 버리면 한도가 899,999, 반올림하면 900,000이다', () => {
  const { total_salary_krw: salary, cap_krw: expected } = CAP_COORDINATES.BINDS;
  const cap = capOf(rulesets, salary);

  // 여기서 갈리는 것은 **표시가 아니라 §47②의 자리**다. 과세표준의 소수부 0.75가
  // 세율 15%를 지나며 산출세액의 정수 자리를 넘긴다(1,640,000.06 → 1,639,999.95).
  // 17차 정답지가 「반올림해도 같은 값이라 규약에 걸리지 않는다」고 적은 좌표이고,
  // 실제로는 걸린다 — 20.5절이 「갈릴 수 있다」고만 적은 두 번째 좌표가 이것이다.
  assert.equal(cap.tax_base_krw, 19_333_333);
  assert.equal(cap.cap_krw, expected);
  assert.equal(expected, 899_999);

  const benefit = benefitOf(rulesets, salary);
  assert.equal(benefit.pension_credit_income_tax_krw, 899_999);
  assert.equal(benefit.pension_credit_local_tax_krw, 89_999);
  assert.equal(benefit.pension_credit_total_krw, 989_998);
});

// ── 3. 연산도 단위도 룰셋에서 온다 ────────────────────────────────────────────

test('과세표준 단계의 연산을 없애면(none) 한도가 따라 올라간다 — 버림이 코드에 없다', () => {
  const { total_salary_krw: salary } = CAP_COORDINATES.BINDS;
  const noFloor = withStage('tax_base', (stage) => {
    stage.operation_code = 'none';
    stage.unit_krw = null;
  });

  assert.equal(capOf(rulesets, salary).cap_krw, 899_999);
  // 절사가 사라지면 과세표준이 19,333,333.75로 남아 산출세액이 1,640,000.06이 되고
  // 한도가 900,000으로 올라간다. **그 값이 17차 정답지가 적었던 수다.**
  assert.equal(capOf(noFloor, salary).cap_krw, 900_000);
});

test('과세표준 단계의 단위를 바꾸면 과세표준이 그 단위로 내려간다 — 「1원」이 코드에 없다', () => {
  const salary = CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw;
  const tenWon = withStage('tax_base', (stage) => {
    stage.unit_krw = 10;
  });

  assert.equal(capOf(rulesets, salary).tax_base_krw, 22_272_324);
  assert.equal(capOf(tenWon, salary).tax_base_krw, 22_272_320);
});

test('표시 단계의 단위를 바꾸면 응답 금액이 그 단위로 내려간다', () => {
  const salary = CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw;
  const tenWon = withStage('displayed_amount', (stage) => {
    stage.unit_krw = 10;
  });

  assert.equal(capOf(tenWon, salary).cap_krw, 1_349_990);
  // **오늘 우리 출력은 10원 단위가 아니다.** §47①(국고금의 수입·지출)이 이 엔진의
  // 출력에 걸리지 않는다는 룰셋의 답이 값으로 보이는 자리다 — 확정 룰셋에서 이
  // 금액은 10의 배수가 아니다.
  assert.notEqual(capOf(rulesets, salary).cap_krw % 10, 0);
});

test('개인지방소득세분의 단계는 따로 있다 — 그 단위를 바꾸면 지방세분만 움직인다', () => {
  const salary = CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw;
  const clone = cloneRulesets(rulesets);
  findRule(clone, CONFIRMED_FILE, ROUNDING_RULE).value.local_income_tax_stage.unit_krw = 10;

  const before = benefitOf(rulesets, salary);
  const after = benefitOf(clone, salary);
  assert.equal(before.pension_credit_local_tax_krw, 134_999);
  assert.equal(after.pension_credit_local_tax_krw, 134_990);
  // 소득세분은 다른 단계를 타므로 움직이지 않는다.
  assert.equal(after.pension_credit_income_tax_krw, before.pension_credit_income_tax_krw);
});

// ── 4. 결함 주입 — 조문 자리와 우리 자리를 뒤섞으면 멈춘다 ────────────────────

/** 계산이 멈추고 규칙 부재로 되돌아오는가. 값을 지어내지 않았는가. */
function assertStops(bundle, label) {
  const response = compute(withSalary(CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw), bundle);
  assert.equal(response.ok, false, `${label}: 계산이 끝났다 — 규약이 코드에 박혀 있다는 뜻이다`);
  assert.ok(errorCodes(response).includes('rule_missing'), `${label}: 오류 코드가 rule_missing이 아니다`);
}

test('주입 / 과세표준 단계가 조문이 아니라고 적히면 멈춘다 — 엔진이 그 자리를 안다', () => {
  // **조문 자리에서 우리 규약을 쓰는 것과 같다.** 엔진은 `statutory()`로만 그 자리에
  // 서 있으므로 `determined_by_law`가 뒤집히면 값을 내지 않는다.
  assertStops(
    withStage('tax_base', (stage) => {
      stage.determined_by_law = false;
    }),
    'tax_base.determined_by_law = false',
  );
});

test('주입 / 표시 단계가 조문이라고 적히면 멈춘다 — 반대 방향도 같다', () => {
  assertStops(
    withStage('displayed_amount', (stage) => {
      stage.determined_by_law = true;
    }),
    'displayed_amount.determined_by_law = true',
  );
});

test('주입 / 모르는 연산 이름이 오면 아무것도 하지 않는 쪽으로 넘어가지 않는다', () => {
  assertStops(
    withStage('tax_base', (stage) => {
      stage.operation_code = 'round_half_up';
    }),
    'operation_code = round_half_up',
  );
});

test('주입 / 버리라면서 단위가 없으면 1원으로 가정하지 않는다', () => {
  assertStops(
    withStage('tax_base', (stage) => {
      stage.unit_krw = null;
    }),
    'floor + unit_krw 없음',
  );
});

test('주입 / 엔진이 서는 단계가 룰셋에서 사라지면 멈춘다', () => {
  const clone = cloneRulesets(rulesets);
  const rule = findRule(clone, CONFIRMED_FILE, ROUNDING_RULE);
  rule.value.stages = rule.value.stages.filter((s) => s.stage_code !== 'tax_base');
  assertStops(clone, 'stages에서 tax_base 제거');
});

test('주입 / §47①이 우리 출력에 걸린다고 적히면 10원 단위를 아무 데나 걸지 않고 멈춘다', () => {
  // **이 판정은 룰셋이 값으로 한다** — `binds_engine_output`. `true`가 되면 어느 출력이
  // 국고금의 수입·지출인지를 룰셋이 말해 주지 않으므로 엔진이 고를 수 없다.
  assertStops(
    withStage('treasury_receipt_or_payment', (stage) => {
      stage.binds_engine_output = true;
    }),
    'treasury.binds_engine_output = true',
  );
});

test('주입 / 개인지방소득세 단계가 사라지면 멈춘다', () => {
  const clone = cloneRulesets(rulesets);
  delete findRule(clone, CONFIRMED_FILE, ROUNDING_RULE).value.local_income_tax_stage;
  assertStops(clone, 'local_income_tax_stage 제거');
});

test('주입 / 규칙 자체가 없으면 옛 방식으로 조용히 되돌아가지 않는다', () => {
  const clone = cloneRulesets(rulesets);
  const doc = clone[CONFIRMED_FILE];
  doc.rules = doc.rules.filter((r) => r.id !== ROUNDING_RULE);
  assertStops(clone, '규칙 제거');
});

// ── 5. 어휘가 룰셋과 같은가 ──────────────────────────────────────────────────

test('엔진이 아는 단계·연산 이름이 룰셋의 선언과 같다', async () => {
  const { ROUNDING_OPS, ROUNDING_STAGES } = await import('./constants.mjs');
  const contract = findRule(cloneRulesets(rulesets), CONFIRMED_FILE, ROUNDING_RULE).value.engine_contract;

  assert.deepEqual([...ROUNDING_STAGES].sort(), [...contract.stage_codes].sort());
  assert.deepEqual([...ROUNDING_OPS].sort(), [...contract.operation_codes].sort());
});

test('이 계산이 그 규칙을 근거로 싣는다 — 어느 출력에 걸렸는지까지', () => {
  const response = compute(
    withSalary(CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw),
    rulesets,
  );
  const entry = response.scenarios[0].legal_basis.find((e) => e.rule_id === ROUNDING_RULE);

  assert.ok(entry, '원 미만 규칙이 근거 목록에 없다 — 읽고도 적지 않았다');
  assert.ok(entry.applied_to.includes('pension_credit_tax_liability_cap.cap_krw'));
  assert.ok(entry.applied_to.includes('pension_credit_ceiling.ceiling_krw'));
});
