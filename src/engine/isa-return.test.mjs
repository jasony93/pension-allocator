// 가정 기반 ISA 정산액 (D28·D29·D31).
//
// **여기 있는 숫자는 전부 룰셋에서 읽거나 룰셋 값으로 계산한 것이다.** 세율·한도·계약기간
// 하한을 이 파일에 적으면 두 번째 진실 원천이 생기고, 룰셋이 바뀌어도 테스트가 옛 답을
// 계속 옳다고 말한다.
//
// 세 층으로 나눈다.
//   1. 순수 산술(`settlementAt`)의 경계값 — 한도선 정확히·1원 위·통산이 구간을 바꾸는 자리.
//   2. 계약 표면 — 안 주면 안 낸다, 못 내면 못 낸다고 적는다, 표시를 끄면 금액이 없다.
//   3. 룰셋 결합 — 룰셋을 비틀면 답이 따라 움직이는가(안 움직이면 값이 코드에 박힌 것이다).

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { parseTaxableShareRange, settlementAt } from './isa-return.mjs';
import {
  CONFIRMED_FILE,
  baseRequest,
  cloneRulesets,
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

// ── 룰셋에서 읽는 값 ─────────────────────────────────────────────────────────

const GENERAL_RATE = confirmedRule('isa.benefit.quantification').value.statable_amounts.find(
  (item) => item.id === 'rate_gap',
).income_tax.general;
const ISA_RATE = confirmedRule('isa.excess.separate_tax_rate').value.rate;
const SURTAX_RATE = confirmedRule('tax.local.personal_income_surtax').value.rate_of_income_tax;
const TAX_FREE_BRACKETS = confirmedRule('isa.tax_free_limit').value.brackets;
const hasCeiling = (b) =>
  (b.prev_total_salary_max_krw ?? null) !== null || (b.prev_global_income_max_krw ?? null) !== null;
const TAX_FREE_GENERAL = TAX_FREE_BRACKETS.find((b) => !hasCeiling(b)).limit_krw;
const TAX_FREE_LOW = TAX_FREE_BRACKETS.find(hasCeiling).limit_krw;
const MIN_CONTRACT_YEARS = confirmedRule('isa.account.requirements').value.min_contract_years;

/** 소득세 + 지방소득세. 엔진이 다른 곳에서 쓰는 두 단계와 같은 순서다. */
const withSurtax = (amount, rate) => {
  const incomeTax = Math.floor(amount * rate);
  return incomeTax + Math.floor(incomeTax * SURTAX_RATE);
};

const settle = (grossKrw, lossKrw = 0, limitKrw = TAX_FREE_GENERAL) =>
  settlementAt({
    totalReturnKrw: grossKrw,
    taxableShare: 1,
    lossKrw,
    taxFreeLimitKrw: limitKrw,
    generalRate: GENERAL_RATE,
    isaRate: ISA_RATE,
    surtaxRate: SURTAX_RATE,
  });

// ── 1. 순수 산술의 경계값 ────────────────────────────────────────────────────

test('비교 기준의 과세표준은 통산 후(N)가 아니라 통산 전 이익(G)이다', () => {
  // **손익통산 축이 통째로 사라지는 자리다.** 계좌 밖에는 손실 차감 규정이 없으므로
  // 비교 기준은 G에 걸린다. N을 쓰면 아래 두 값이 같아진다.
  const withLoss = settle(TAX_FREE_GENERAL * 2, TAX_FREE_GENERAL);
  const withoutLoss = settle(TAX_FREE_GENERAL, 0);

  assert.equal(withLoss.netKrw, withoutLoss.grossKrw, '통산 후 순소득이 같은 두 입력을 골랐다');
  assert.ok(
    withLoss.settlementKrw > withoutLoss.settlementKrw,
    '손실이 있는 쪽의 혜택이 더 커야 한다 — 손익통산 축이 사라졌다',
  );
  assert.equal(withLoss.axes.loss_offset_krw, withSurtax(TAX_FREE_GENERAL, GENERAL_RATE));
});

test('비과세 한도선 정확히 — 초과분이 0이라 ISA 쪽 세액이 없다', () => {
  const result = settle(TAX_FREE_GENERAL);
  assert.equal(result.excessKrw, 0);
  assert.equal(result.isaTaxKrw, 0);
  assert.equal(result.settlementKrw, withSurtax(TAX_FREE_GENERAL, GENERAL_RATE));
  assert.equal(result.axes.rate_gap_krw, 0);
});

test('한도 1원 위 — 그 1원부터 세율차 축이 열린다', () => {
  const atLimit = settle(TAX_FREE_GENERAL);
  const overLimit = settle(TAX_FREE_GENERAL + 1);

  assert.equal(atLimit.axes.rate_gap_krw, 0);
  assert.equal(overLimit.excessKrw, 1);
  assert.ok(
    overLimit.settlementKrw >= atLimit.settlementKrw,
    '한도를 넘겨도 혜택이 줄어들 수 없다 — 세율차가 양수이기 때문이다',
  );
});

test('통산이 순소득을 한도 아래로 내리면 세율차 축이 닫힌다', () => {
  const above = settle(TAX_FREE_GENERAL * 2, TAX_FREE_GENERAL / 2);
  const below = settle(TAX_FREE_GENERAL * 2, TAX_FREE_GENERAL * 1.5);

  assert.ok(above.excessKrw > 0 && above.axes.rate_gap_krw > 0);
  assert.equal(below.excessKrw, 0);
  assert.equal(below.axes.rate_gap_krw, 0);
});

test('서민형과 일반형이 갈리는 것은 한도금액뿐이다', () => {
  const gross = TAX_FREE_LOW;
  const general = settle(gross, 0, TAX_FREE_GENERAL);
  const low = settle(gross, 0, TAX_FREE_LOW);

  assert.ok(TAX_FREE_LOW > TAX_FREE_GENERAL, '룰셋의 두 한도가 갈린다는 전제');
  assert.ok(low.settlementKrw > general.settlementKrw, '한도가 큰 쪽의 혜택이 더 커야 한다');
  assert.equal(low.axes.tax_free_krw, withSurtax(TAX_FREE_LOW, GENERAL_RATE));
});

test('과세 비율이 0이면 혜택이 0이다 — 감쌀 세금이 없다', () => {
  const result = settlementAt({
    totalReturnKrw: TAX_FREE_GENERAL,
    taxableShare: 0,
    lossKrw: 0,
    taxFreeLimitKrw: TAX_FREE_GENERAL,
    generalRate: GENERAL_RATE,
    isaRate: ISA_RATE,
    surtaxRate: SURTAX_RATE,
  });
  assert.equal(result.grossKrw, 0);
  assert.equal(result.settlementKrw, 0);
});

test('세 축과 절사 잔차의 합은 언제나 정산액과 같다', () => {
  // 절사가 축마다 따로 걸리므로 큰 금액만 골라 보면 잔차가 늘 0이라 검사가 무의미해진다.
  // 작은 금액과 나누어떨어지지 않는 금액을 함께 돌린다.
  const inputs = [0, 1, 7, 15, 999, 1_000_003, TAX_FREE_GENERAL - 1, TAX_FREE_GENERAL, TAX_FREE_GENERAL * 3 + 7];
  for (const gross of inputs) {
    for (const loss of [0, 1, Math.floor(gross / 3)]) {
      const result = settle(gross, loss);
      const sum =
        result.axes.loss_offset_krw +
        result.axes.tax_free_krw +
        result.axes.rate_gap_krw +
        result.axes.rounding_residual_krw;
      assert.equal(sum, result.settlementKrw, `G=${gross} L=${loss}에서 축의 합이 어긋났다`);
    }
  }
});

test('혜택은 음수가 될 수 없다 — 조문에서 나오는 부등식', () => {
  for (const gross of [0, 1, 12_345, TAX_FREE_GENERAL, TAX_FREE_GENERAL * 10]) {
    for (const loss of [0, 1, gross, gross * 2]) {
      assert.ok(settle(gross, loss).settlementKrw >= 0, `G=${gross} L=${loss}에서 음수가 나왔다`);
    }
  }
});

test('과세 비율의 구간을 룰셋 문자열에서 읽는다 — 못 읽으면 null이다', () => {
  assert.deepStrictEqual(parseTaxableShareRange('s = 1'), { min: 1, max: 1, point: true });
  assert.deepStrictEqual(parseTaxableShareRange('0 ≤ s ≤ 1'), { min: 0, max: 1, point: false });
  // 선택지에 따라 뒤에 설명이 붙는다. 첫 문장만 읽는다.
  assert.deepStrictEqual(
    parseTaxableShareRange('0 ≤ s < 1. 가격 상승분은 s에 들어가지 않는다.'),
    { min: 0, max: 1, point: false },
  );
  for (const unreadable of ['비율은 경우에 따라 다르다', '', null, undefined, 's는 1이다', '1 ≤ s ≤ 0']) {
    assert.equal(parseTaxableShareRange(unreadable), null, `읽을 수 없어야 한다: ${unreadable}`);
  }
});

// ── 2. 계약 표면 ─────────────────────────────────────────────────────────────

const RETURN_RATE = 0.05;
const YEARS = 2;
/** 이 원금·수익률·기간이면 총수익이 정확히 비과세 한도금액이 된다. */
const PRINCIPAL = TAX_FREE_GENERAL / (RETURN_RATE * YEARS);

const withAssumption = (assumption, patch = {}) =>
  baseRequest(
    deepMerge(
      {
        // 배분을 0으로 두어 원금이 누적 납입액 하나로 정해지게 한다.
        profile: { monthly_capacity_krw: 0, isa_return_assumption: assumption },
        accounts: { isa: { cumulative_contribution_krw: PRINCIPAL, years_since_opening: 5 } },
      },
      patch,
    ),
  );

const POINT_ASSUMPTION = {
  annual_return_rate: RETURN_RATE,
  income_character: 'interest_dividend',
  settlement_years: YEARS,
  loss_amount_krw: null,
};

const estimateOf = (request, rules = rulesets) =>
  planOf(scenarioOf(compute(request, rules)), 'max_tax_credit').assumption_based_isa_estimate;

test('가정을 주지 않으면 금액을 내지 않고, 그 사실이 조용하지 않다', () => {
  const scenario = scenarioOf(compute(baseRequest(), rulesets));
  for (const plan of scenario.plans) {
    assert.equal(plan.assumption_based_isa_estimate, null);
  }
  assert.ok(noticeCodes(scenario).includes('isa_return_assumption_not_supplied'));
  // 예전 서술이 그대로 참이다 — 금액을 낼 수 없다는 가정과 비정량 효과가 살아 있다.
  const response = compute(baseRequest(), rulesets);
  assert.ok(response.assumptions.some((a) => a.code === 'isa_benefit_not_quantified'));
});

test('가정을 주면 「금액으로 낼 수 없다」는 선언이 사라진다 — 응답이 자기와 어긋나지 않는다', () => {
  const response = compute(withAssumption(POINT_ASSUMPTION), rulesets);
  assert.equal(response.ok, true);
  assert.equal(
    response.assumptions.some((a) => a.code === 'isa_benefit_not_quantified'),
    false,
    '금액이 나가는데 "금액으로 낼 수 없다"는 가정이 함께 나갔다',
  );
  for (const plan of scenarioOf(response).plans) {
    assert.equal(
      plan.non_quantified_effects.some((e) => e.code === 'isa_tax_free_headroom'),
      false,
      '금액이 나가는데 같은 효과가 "정량 불가"로도 나갔다',
    );
  }
});

test('소득 성격이 확정적일 때만 점을 낸다', () => {
  const point = estimateOf(withAssumption(POINT_ASSUMPTION));
  assert.equal(point.state, 'computed');
  assert.equal(point.point_estimate_krw, withSurtax(TAX_FREE_GENERAL, GENERAL_RATE));
  assert.equal(point.lower_bound_krw, point.point_estimate_krw);
  assert.equal(point.upper_bound_krw, point.point_estimate_krw);

  for (const character of ['listed_equity_capital_gain', 'mixed_or_unknown']) {
    const ranged = estimateOf(
      withAssumption({ ...POINT_ASSUMPTION, income_character: character }),
    );
    assert.equal(ranged.point_estimate_krw, null, `${character}에서 점을 냈다`);
    assert.equal(ranged.lower_bound_krw, 0);
    assert.equal(ranged.upper_bound_krw, point.upper_bound_krw, '구간의 위쪽 끝은 s = 1일 때의 값이다');
  }
});

test('구간으로 낼 때 그 사실이 안내로 나간다', () => {
  const scenario = scenarioOf(
    compute(withAssumption({ ...POINT_ASSUMPTION, income_character: 'mixed_or_unknown' }), rulesets),
  );
  assert.ok(noticeCodes(scenario).includes('isa_return_estimate_reported_as_range'));

  const pointScenario = scenarioOf(compute(withAssumption(POINT_ASSUMPTION), rulesets));
  assert.equal(noticeCodes(pointScenario).includes('isa_return_estimate_reported_as_range'), false);
});

test('연간 금액을 내지 않는다 — 연 환산은 계약 단위 정산보다 크다', () => {
  const years = MIN_CONTRACT_YEARS;
  const multiYear = estimateOf(
    withAssumption({ ...POINT_ASSUMPTION, settlement_years: years }),
  );
  const oneYear = estimateOf(withAssumption({ ...POINT_ASSUMPTION, settlement_years: 1 }));

  assert.equal(multiYear.is_annual, false);
  assert.equal(multiYear.settlement_years, years);
  // 비과세 한도가 계약 단위라 한 해치를 곱하면 그 한도를 해마다 새로 주는 셈이 된다.
  assert.ok(
    multiYear.upper_bound_krw < oneYear.upper_bound_krw * years,
    `연 환산(${oneYear.upper_bound_krw * years})이 계약 단위 정산(${multiYear.upper_bound_krw})보다 크지 않다 — ` +
      '비과세 한도가 여러 번 걸리고 있다',
  );
  assert.ok(noticeCodes(scenarioOf(compute(withAssumption(POINT_ASSUMPTION), rulesets))).includes(
    'isa_return_estimate_is_not_annual',
  ));
});

test('정산 기간을 주지 않으면 룰셋의 계약기간 하한을 쓰고 그 사실을 가정으로 낸다', () => {
  const response = compute(
    withAssumption({ ...POINT_ASSUMPTION, settlement_years: null }),
    rulesets,
  );
  const estimate = planOf(scenarioOf(response), 'max_tax_credit').assumption_based_isa_estimate;

  assert.equal(estimate.settlement_years, MIN_CONTRACT_YEARS);
  assert.equal(estimate.settlement_years_source, 'ruleset_min_contract_years');
  assert.ok(
    response.assumptions.some((a) => a.code === 'isa_settlement_years_defaulted_to_min_contract_years'),
  );

  const given = compute(withAssumption(POINT_ASSUMPTION), rulesets);
  assert.equal(
    given.assumptions.some((a) => a.code === 'isa_settlement_years_defaulted_to_min_contract_years'),
    false,
    '사용자가 기간을 줬는데 대체값 가정이 나갔다',
  );
});

test('손실을 주지 않으면 0으로 두고 그 사실을 가정으로 낸다 — 지어내면 과대가 된다', () => {
  const response = compute(withAssumption(POINT_ASSUMPTION), rulesets);
  assert.ok(response.assumptions.some((a) => a.code === 'isa_loss_assumed_zero'));

  const withLoss = estimateOf(
    withAssumption({ ...POINT_ASSUMPTION, loss_amount_krw: TAX_FREE_GENERAL }),
  );
  assert.equal(withLoss.loss_offset_applied_krw, TAX_FREE_GENERAL);
  assert.equal(withLoss.net_income_krw, 0);
  assert.equal(
    compute(
      withAssumption({ ...POINT_ASSUMPTION, loss_amount_krw: TAX_FREE_GENERAL }),
      rulesets,
    ).assumptions.some((a) => a.code === 'isa_loss_assumed_zero'),
    false,
  );
});

test('원금은 누적 납입액과 이 배분안의 ISA 배분액의 합이다', () => {
  const allocated = 1_200_000;
  const response = compute(
    withAssumption(POINT_ASSUMPTION, {
      profile: { monthly_capacity_krw: allocated / 12, fund_use_horizon: 'before_pension_age' },
      // 경과연수를 넉넉히 두어 ISA 잔여 한도가 실제로 남게 한다(연 한도가 경과연수의 함수다).
      accounts: { isa: { cumulative_contribution_krw: PRINCIPAL, years_since_opening: 4 } },
    }),
    rulesets,
  );
  const scenario = scenarioOf(response);
  const isaFirst = planOf(scenario, 'isa_first');
  const isaAmount = isaFirst.allocations.find((a) => a.account === 'isa').annual_krw;

  assert.ok(isaAmount > 0, 'ISA 우선안이 실제로 ISA를 채우는 입력이어야 한다');
  assert.equal(isaFirst.assumption_based_isa_estimate.principal_krw, PRINCIPAL + isaAmount);
  assert.equal(
    isaFirst.assumption_based_isa_estimate.principal_basis_code,
    'cumulative_contribution_plus_plan_allocation',
  );
  assert.ok(response.assumptions.some((a) => a.code === 'isa_return_principal_from_contributions'));
});

test('ISA 유형을 모르면 금액을 지어내지 않고 못 낸다고 적는다', () => {
  const response = compute(
    withAssumption(POINT_ASSUMPTION, { accounts: { isa: { account_type: null } } }),
    rulesets,
  );
  const scenario = scenarioOf(response);
  const estimate = planOf(scenario, 'max_tax_credit').assumption_based_isa_estimate;

  assert.equal(estimate.state, 'not_computable');
  assert.equal(estimate.not_computable_reason_code, 'isa_tax_free_limit_unknown');
  for (const [key, value] of Object.entries(estimate)) {
    if (key.endsWith('_krw') || key === 'axis_breakdown') {
      assert.equal(value, null, `못 내는 상태인데 ${key}에 금액이 있다`);
    }
  }
  assert.ok(noticeCodes(scenario).includes('isa_return_estimate_not_computable'));
});

test('표시를 끄면 계산은 그대로 돌고 금액만 사라진다 (D31)', () => {
  const included = estimateOf(withAssumption(POINT_ASSUMPTION));
  const response = compute(
    withAssumption(POINT_ASSUMPTION, { options: { assumption_based_isa_estimate: 'suppress' } }),
    rulesets,
  );
  const scenario = scenarioOf(response);
  const suppressed = planOf(scenario, 'max_tax_credit').assumption_based_isa_estimate;

  assert.equal(included.state, 'computed');
  assert.equal(suppressed.state, 'display_suppressed');
  // 껍데기의 모양은 같다 — 화면이 "값이 없다"와 "값을 감췄다"를 구별할 수 있어야 한다.
  assert.deepStrictEqual(Object.keys(suppressed).sort(), Object.keys(included).sort());
  assert.equal(suppressed.upper_bound_krw, null);
  assert.ok(noticeCodes(scenario).includes('isa_return_estimate_display_suppressed'));
  // 근거는 그대로 실린다. 계산이 돌았기 때문이다.
  assert.ok(scenario.legal_basis.some((entry) => entry.rule_id === 'isa.benefit.formula'));
});

test('연금계좌 쪽 효과를 금액으로 낼 수 없다는 사실이 함께 나간다', () => {
  const scenario = scenarioOf(compute(withAssumption(POINT_ASSUMPTION), rulesets));
  assert.ok(noticeCodes(scenario).includes('pension_tax_deferral_not_quantified'));
  assert.ok(
    scenario.legal_basis.some((entry) => entry.rule_id === 'pension.tax_deferral.with_return_rate'),
  );
});

test('객체를 보냈으면 수익률과 소득 성격은 필수다', () => {
  const missingRate = compute(
    withAssumption({ income_character: 'interest_dividend', settlement_years: null, loss_amount_krw: null }),
    rulesets,
  );
  assert.equal(missingRate.ok, false);
  assert.ok(errorCodes(missingRate).includes('missing_required'));

  const missingCharacter = compute(
    withAssumption({ annual_return_rate: 0.05, settlement_years: null, loss_amount_krw: null }),
    rulesets,
  );
  assert.equal(missingCharacter.ok, false);
  assert.ok(errorCodes(missingCharacter).includes('missing_required'));

  const badCharacter = compute(
    withAssumption({ ...POINT_ASSUMPTION, income_character: '해외주식' }),
    rulesets,
  );
  assert.equal(badCharacter.ok, false);
  assert.ok(errorCodes(badCharacter).includes('invalid_enum'));
});

test('음의 수익률과 0년 기간은 되돌려준다 — 손실은 손실 칸이 받는다', () => {
  const negative = compute(withAssumption({ ...POINT_ASSUMPTION, annual_return_rate: -0.05 }), rulesets);
  assert.equal(negative.ok, false);
  assert.ok(errorCodes(negative).includes('negative_value'));

  const zeroYears = compute(withAssumption({ ...POINT_ASSUMPTION, settlement_years: 0 }), rulesets);
  assert.equal(zeroYears.ok, false);
  assert.ok(errorCodes(zeroYears).includes('out_of_range'));
});

test('정수 연산으로 낼 수 없는 수익률은 지어내지 않고 못 낸다고 적는다', () => {
  // 이진 부동소수점 꼬리가 붙은 값(예: 0.05 × 3의 결과)은 정수 분수로 옮길 수 없다.
  // 이 엔진은 **틀린 근사값 대신 「못 낸다」**를 낸다 — 다른 금액들과 같은 규율이다.
  const estimate = estimateOf(
    withAssumption({ ...POINT_ASSUMPTION, annual_return_rate: 0.05 * 3 }),
  );
  assert.equal(estimate.state, 'not_computable');
  assert.equal(estimate.not_computable_reason_code, 'amount_not_representable');
  assert.equal(estimate.upper_bound_krw, null);

  // 같은 크기라도 사용자가 그대로 적은 값은 낸다.
  assert.equal(estimateOf(withAssumption({ ...POINT_ASSUMPTION, annual_return_rate: 0.15 })).state, 'computed');
});

test('수익률 0은 유효한 입력이고 결과는 0이다', () => {
  const estimate = estimateOf(withAssumption({ ...POINT_ASSUMPTION, annual_return_rate: 0 }));
  assert.equal(estimate.state, 'computed');
  assert.equal(estimate.total_return_krw, 0);
  assert.equal(estimate.point_estimate_krw, 0);
});

// ── 3. 룰셋 결합 — 비틀면 답이 따라 움직이는가 ───────────────────────────────
//
// "이 값이 룰셋에서 온 것이 아니라면 이 변형으로도 답이 그대로일 것이다."

const withMutation = (mutate) => {
  const clone = cloneRulesets(rulesets);
  mutate(clone);
  return clone;
};

test('산식 규칙이 없으면 멈춘다 — 대체값을 만들지 않는다', () => {
  for (const ruleId of [
    'isa.benefit.formula',
    'isa.benefit.income_character',
    'isa.benefit.settlement_period',
    'isa.benefit.quantification',
    'isa.excess.separate_tax_rate',
  ]) {
    const mutated = withMutation((clone) => {
      const doc = clone[CONFIRMED_FILE];
      doc.rules = doc.rules.filter((r) => r.id !== ruleId);
    });
    const response = compute(withAssumption(POINT_ASSUMPTION), mutated);
    assert.equal(response.ok, false, `${ruleId}이 없는데 계산이 끝났다 — 값이 코드에 박혀 있다`);
    assert.ok(errorCodes(response).includes('rule_missing'));
  }
});

test('가정을 주지 않았으면 산식 규칙이 없어도 계산이 끝난다 — 읽지 않은 규칙을 요구하지 않는다', () => {
  const mutated = withMutation((clone) => {
    const doc = clone[CONFIRMED_FILE];
    doc.rules = doc.rules.filter((r) => r.id !== 'isa.benefit.formula');
  });
  assert.equal(compute(baseRequest(), mutated).ok, true);
});

test('ISA 초과분 세율을 비틀면 정산액이 따라 움직인다', () => {
  const overLimit = { ...POINT_ASSUMPTION, annual_return_rate: 0.15 };
  const base = estimateOf(withAssumption(overLimit));

  const mutated = withMutation((clone) => {
    // 초과분 세율을 일반 원천징수율과 같게 만든다 → 세율차 축이 닫힌다.
    findRule(clone, CONFIRMED_FILE, 'isa.excess.separate_tax_rate').value.rate = GENERAL_RATE;
  });
  const changed = estimateOf(withAssumption(overLimit), mutated);

  assert.ok(base.axis_breakdown.rate_gap_krw > 0, '한도를 넘기는 입력이어야 한다');
  assert.equal(changed.axis_breakdown.rate_gap_krw, 0);
  assert.ok(changed.upper_bound_krw < base.upper_bound_krw);
});

test('계좌 밖 원천징수율을 비틀면 비교 기준이 따라 움직인다', () => {
  const mutated = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'isa.benefit.quantification').value.statable_amounts.find(
      (item) => item.id === 'rate_gap',
    ).income_tax.general = GENERAL_RATE / 2;
  });
  const changed = estimateOf(withAssumption(POINT_ASSUMPTION), mutated);
  assert.equal(changed.comparison_side_tax_krw, withSurtax(TAX_FREE_GENERAL, GENERAL_RATE / 2));
});

test('소득 성격의 과세 비율 구간을 비틀면 점과 구간이 뒤바뀐다', () => {
  const mutated = withMutation((clone) => {
    const options = findRule(clone, CONFIRMED_FILE, 'isa.benefit.income_character').value
      .what_to_ask_instead.options;
    // 확정적이던 선택지를 구간으로 바꾼다.
    options.find((option) => option.id === 'interest_dividend').s_range = '0 ≤ s ≤ 1';
  });
  const changed = estimateOf(withAssumption(POINT_ASSUMPTION), mutated);
  assert.equal(changed.point_estimate_krw, null, '비율이 코드에 박혀 있으면 점이 그대로 남는다');
  assert.equal(changed.lower_bound_krw, 0);
});

test('구간 문자열을 읽을 수 없으면 비율을 지어내지 않고 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const options = findRule(clone, CONFIRMED_FILE, 'isa.benefit.income_character').value
      .what_to_ask_instead.options;
    options.find((option) => option.id === 'interest_dividend').s_range = '경우에 따라 다르다';
  });
  const response = compute(withAssumption(POINT_ASSUMPTION), mutated);
  assert.equal(response.ok, false);
  assert.ok(errorCodes(response).includes('rule_missing'));
});

test('계약기간 하한을 비틀면 대체 정산 기간이 따라 움직인다', () => {
  const mutated = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'isa.account.requirements').value.min_contract_years =
      MIN_CONTRACT_YEARS + 4;
  });
  const changed = estimateOf(
    withAssumption({ ...POINT_ASSUMPTION, settlement_years: null }),
    mutated,
  );
  assert.equal(changed.settlement_years, MIN_CONTRACT_YEARS + 4);
});

test('비과세 한도금액을 비틀면 한도 축이 따라 움직인다', () => {
  const mutated = withMutation((clone) => {
    const brackets = findRule(clone, CONFIRMED_FILE, 'isa.tax_free_limit').value.brackets;
    brackets.find((b) => !hasCeiling(b)).limit_krw = Math.floor(TAX_FREE_GENERAL / 2);
  });
  const changed = estimateOf(withAssumption(POINT_ASSUMPTION), mutated);
  assert.equal(changed.tax_free_limit_krw, Math.floor(TAX_FREE_GENERAL / 2));
  assert.ok(changed.axis_breakdown.rate_gap_krw > 0, '한도가 내려가면 초과분이 생긴다');
});

test('정산 기간 규칙이 「계약 단위 정산액을 낼 수 있다」를 거두면 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'isa.benefit.settlement_period');
    rule.value.what_can_be_produced_instead = rule.value.what_can_be_produced_instead.filter(
      (item) => item.id !== 'contract_settlement_amount',
    );
  });
  const response = compute(withAssumption(POINT_ASSUMPTION), mutated);
  assert.equal(response.ok, false);
  assert.ok(errorCodes(response).includes('rule_missing'));
});
