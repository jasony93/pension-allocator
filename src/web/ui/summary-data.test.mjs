import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummaryData } from './summary-data.js';

/**
 * D74 6번 — 요약 내보내기에는 원시 입력(생년월일·총급여)이 없어야 한다는
 * 조건과, 절세액이 가정 성분을 담으면 조건절이 함께 있어야 한다는 D38
 * 계열 조건을 여기서 검사로 물린다.
 */

const baseScenario = {
  ruleset: { tax_year: 2026 },
  account_eligibility: [
    { account: 'annuity_savings', eligible: true },
    { account: 'retirement_pension', eligible: true },
    { account: 'isa', eligible: true },
  ],
  limits: {
    by_account: [
      { account: 'annuity_savings', contribution_limit_remaining_krw: 6000000 },
      { account: 'retirement_pension', contribution_limit_remaining_krw: 3000000 },
      { account: 'isa', contribution_limit_remaining_krw: 20000000 },
    ],
  },
};

function basePlan(overrides = {}) {
  return {
    is_baseline: true,
    plan_id: 'max_tax_credit',
    allocations: [
      { account: 'annuity_savings', monthly_krw: 100000, annual_krw: 1200000 },
      { account: 'retirement_pension', monthly_krw: 50000, annual_krw: 600000 },
      { account: 'isa', monthly_krw: 200000, annual_krw: 2400000 },
    ],
    unallocated_annual_krw: 0,
    unallocated_monthly_krw: 0,
    total_allocated_monthly_krw: 350000,
    total_allocated_annual_krw: 4200000,
    headline_composite_total: {
      bound_code: 'point',
      point_estimate_krw: 1485000,
      lower_bound_krw: 1485000,
      upper_bound_krw: 1485000,
      includes_assumption_component: false,
      determined_component_krw: 1485000,
      assumption_component_krw: null,
      assumption_settlement_years: null,
    },
    ...overrides,
  };
}

test('buildSummaryData의 함수 시그니처 자체가 원시 프로필(생년월일·총급여)에 접근할 길을 막는다 — 인자가 plan·scenario·annualReturnRate 셋뿐이다', () => {
  // `Function.length`는 기본값 있는 매개변수(annualReturnRate = null)를 세지 않는다
  // (언어 스펙) — 그래서 여기서는 2(plan·scenario)가 맞다. 네 번째 인자
  // (예: response 전체나 profile)가 새로 생기면 이 값이 바뀐다.
  assert.equal(buildSummaryData.length, 2, 'response/profile 전체를 받는 새 인자가 생기면 이 검사가 깨진다');
});

test('반환값 최상위 키가 D74가 정한 다섯 항목(도넛·계좌·총 절세액·과세연도)에 정확히 대응한다 — 다른 것이 몰래 붙지 않는다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null);
  assert.deepEqual(Object.keys(data).sort(), ['accounts', 'donut', 'taxYear', 'totalTaxSavings']);
});

test('계좌별 행에 월 납입액·연 환산·납입 잔여 한도가 모두 있다 — 다른 키가 없다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null);
  assert.equal(data.accounts.length, 3);
  for (const row of data.accounts) {
    assert.deepEqual(Object.keys(row).sort(), ['account', 'annualKrw', 'label', 'monthlyKrw', 'remainingLimitKrw']);
  }
  const isa = data.accounts.find((a) => a.account === 'isa');
  assert.equal(isa.monthlyKrw, 200000);
  assert.equal(isa.annualKrw, 2400000);
  assert.equal(isa.remainingLimitKrw, 20000000);
});

test('배제된 계좌는 요약 표에서 빠진다', () => {
  const scenario = {
    ...baseScenario,
    account_eligibility: [
      { account: 'annuity_savings', eligible: true },
      { account: 'retirement_pension', eligible: true },
      { account: 'isa', eligible: false, reason_codes: ['isa_excluded_age'], basis_rule_ids: [] },
    ],
  };
  const data = buildSummaryData(basePlan(), scenario, null);
  assert.deepEqual(
    data.accounts.map((a) => a.account),
    ['annuity_savings', 'retirement_pension'],
  );
});

test('가정 성분이 없으면(확정 성분만) 조건절도 구성 두 줄도 없다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null);
  assert.equal(data.totalTaxSavings.includesAssumption, false);
  assert.equal(data.totalTaxSavings.determinedLine, null);
  assert.equal(data.totalTaxSavings.assumptionLine, null);
  assert.equal(data.totalTaxSavings.label, '이 배분으로 계산된 세액공제액');
});

test('D74·D38 — 가정 성분이 있으면 조건절(「연 ○% 가정」)이 요약 안에 함께 있다', () => {
  const plan = basePlan({
    headline_composite_total: {
      bound_code: 'range',
      point_estimate_krw: null,
      lower_bound_krw: 1485000,
      upper_bound_krw: 1785000,
      includes_assumption_component: true,
      determined_component_krw: 1485000,
      assumption_component_krw: 300000,
      assumption_settlement_years: 3,
      assumption_settlement_years_source: 'ruleset_min_contract_years',
    },
  });
  const data = buildSummaryData(plan, baseScenario, 0.055);
  assert.equal(data.totalTaxSavings.includesAssumption, true);
  assert.equal(data.totalTaxSavings.label, '이 배분으로 계산된 절세액');
  assert.ok(data.totalTaxSavings.determinedLine, '확정 성분 줄이 있어야 한다');
  assert.ok(data.totalTaxSavings.assumptionLine, '가정 성분 줄이 있어야 한다');
  assert.match(data.totalTaxSavings.assumptionLine, /연 5\.5% 가정/, '조건절에 사용자가 준 수익률이 담겨야 한다');
});

test('대안 미리보기(is_baseline: false)는 기본안 대비 차이를 담고, 가정 조건절은 없다', () => {
  const plan = basePlan({ is_baseline: false, delta_vs_baseline_krw: -50000 });
  const data = buildSummaryData(plan, baseScenario, null);
  assert.equal(data.totalTaxSavings.label, '기본안 대비 세액공제액 차이');
  assert.equal(data.totalTaxSavings.valueText, '-50,000원');
  assert.equal(data.totalTaxSavings.includesAssumption, false);
});

test('원시 입력(생년월일·총급여)을 나타내는 키·문자열이 반환값 어디에도 없다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null);
  const serialized = JSON.stringify(data);
  for (const forbidden of ['birth', 'salary', 'profile', '생년월일', '총급여']) {
    assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()), `요약 데이터에 금지어 "${forbidden}"가 있습니다`);
  }
});
