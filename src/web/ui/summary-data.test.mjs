import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummaryData, buildSummaryInputs } from './summary-data.js';

/**
 * D74 6번 — 절세액이 가정 성분을 담으면 조건절이 함께 있어야 한다는 D38
 * 계열 조건을 여기서 검사로 물린다.
 *
 * **[2026-08-18, 관리자 지시(6차) 2번, D75] 원시 입력 검사가 뒤집혔다.** 옛
 * 검사(맨 아래, 이름 그대로 남겨 두었다)는 "원시 입력(생년월일·총급여)이
 * 반환값 어디에도 없다"를 요구했다 — `form`을 받지 않던 시절의 계약이다.
 * 소유자가 D75로 그 유보를 명시로 덮어 도넛 오른쪽에 입력값을 적으라고
 * 지시했으므로, 이제는 그 반대(「입력값이 `inputs` 블록에 있고, 입력 안
 * 한 값은 없다」)가 참이어야 한다 — 새 테스트들이 그것을 확인한다. 옛
 * 검사는 `form`을 넘기지 않는 호출(`form` 생략, 인자 3개)에서는 여전히
 * 참이다 — 그 경로가 D74 시절의 안전을 그대로 보존한다는 뜻이므로 지우지
 * 않고 그 조건을 명시한 이름으로 남긴다.
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

test('[뒤집힘, D75] buildSummaryData가 이제 4번째 인자 form을 받는다 — .length 자체는 그대로다(둘 다 기본값이 있어서다)', () => {
  // `Function.length`는 기본값 있는 매개변수를 세지 않는다(언어 스펙) — 옛
  // `annualReturnRate = null`도 이미 세지 않았고, D75로 추가된 `form = null`도
  // 마찬가지로 기본값이 있어 이 숫자를 움직이지 않는다. **그래서 이 검사가
  // 지키던 옛 전제("함수 시그니처 자체가 원시 프로필 접근을 막는다")는 더는
  // 참이 아니다** — `form`을 넘기면 실제로 원시 입력(생년월일·총급여 등)이
  // 반환값(`inputs`)에 실린다. 그 사실은 아래 "D75 —" 이름의 검사들이
  // 직접 확인한다. 이 검사가 남기는 것은 오직 "인자 개수가 2로 유지된다"는
  // 사실 하나뿐이다 — 다섯 번째 인자가 기본값 없이 새로 생기면 이 값이
  // 비로소 바뀐다.
  assert.equal(buildSummaryData.length, 2);
});

test('반환값 최상위 키가 D74가 정한 다섯 항목 + D75의 inputs에 정확히 대응한다 — 다른 것이 몰래 붙지 않는다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null);
  assert.deepEqual(Object.keys(data).sort(), ['accounts', 'donut', 'inputs', 'taxYear', 'totalTaxSavings']);
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

test('form을 넘기지 않으면(옛 D74 호출부) 여전히 원시 입력이 반환값 어디에도 없다 — inputs는 빈 배열이다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null);
  assert.deepEqual(data.inputs, []);
  const serialized = JSON.stringify(data);
  for (const forbidden of ['birth', 'salary', 'profile', '생년월일', '총급여']) {
    assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()), `요약 데이터에 금지어 "${forbidden}"가 있습니다`);
  }
});

// ---------------------------------------------------------------------------
// [2026-08-18, 관리자 지시(6차) 2번, D75] 도넛 오른쪽 입력값 블록 —
// `buildSummaryInputs`. 여기서부터가 D74의 "원시 입력 없음" 검사를
// 뒤집는 자리다: 이제 `form`을 넘기면 D75가 지정한 여섯 항목이 실제로
// `inputs`에 실려야 하고, **입력하지 않은 항목은 줄 자체가 없어야 한다.**
// ---------------------------------------------------------------------------

function baseFilledForm(overrides = {}) {
  return {
    birthDate: '1980-01-01',
    currentSalary: '6000',
    monthlyCapacity: '50',
    isaReturnEnabled: false,
    isaReturnRatePercent: '',
    isaIncomeCharacter: null,
    isaSettlementYears: '',
    ...overrides,
  };
}

test('D75 — form이 없으면 buildSummaryInputs는 빈 배열을 낸다', () => {
  assert.deepEqual(buildSummaryInputs(null), []);
  assert.deepEqual(buildSummaryInputs(undefined), []);
});

test('D75 — 생년월일·총급여액·월 납입액 셋을 채우면(ISA 수익률은 안 켠 채) 그 셋만 정확히 순서대로 나온다', () => {
  const inputs = buildSummaryInputs(baseFilledForm());
  assert.deepEqual(
    inputs.map((i) => i.key),
    ['birth_date', 'current_salary', 'monthly_capacity'],
  );
  assert.equal(inputs.find((i) => i.key === 'birth_date').valueText, '1980-01-01');
  assert.equal(inputs.find((i) => i.key === 'current_salary').valueText, '6,000만원');
  assert.equal(inputs.find((i) => i.key === 'monthly_capacity').valueText, '월 50만원');
  for (const i of inputs) assert.ok(i.label && i.label.length > 0, `${i.key} 줄에 라벨이 없습니다`);
});

test('D75 — 입력하지 않은 값은 줄 자체가 없다(빈 문자열·null 모두)', () => {
  const inputs = buildSummaryInputs(baseFilledForm({ currentSalary: '', monthlyCapacity: null }));
  assert.deepEqual(
    inputs.map((i) => i.key),
    ['birth_date'],
    '총급여액·월 납입액을 비웠는데 그 줄이 남아 있습니다',
  );
});

test('D75 — ISA 예상 수익률을 켜고 셋을 모두 채우면 여섯 줄 전부가, 순서대로 나온다', () => {
  const inputs = buildSummaryInputs(
    baseFilledForm({
      isaReturnEnabled: true,
      isaReturnRatePercent: '5.5',
      isaIncomeCharacter: 'interest_dividend',
      isaSettlementYears: '3',
    }),
  );
  assert.deepEqual(
    inputs.map((i) => i.key),
    ['birth_date', 'current_salary', 'monthly_capacity', 'isa_return_rate', 'isa_income_character', 'isa_settlement_years'],
  );
  assert.equal(inputs.find((i) => i.key === 'isa_return_rate').valueText, '연 5.5%');
  assert.equal(inputs.find((i) => i.key === 'isa_income_character').valueText, '이자·배당처럼 받는 형태');
  assert.equal(inputs.find((i) => i.key === 'isa_settlement_years').valueText, '3년');
});

test('D75 — ISA 예상 수익률을 켰어도 정산 기간을 비웠으면 그 줄만 빠진다(항목별 판정, 토글 단위가 아니다)', () => {
  const inputs = buildSummaryInputs(
    baseFilledForm({ isaReturnEnabled: true, isaReturnRatePercent: '5.5', isaIncomeCharacter: 'interest_dividend', isaSettlementYears: '' }),
  );
  assert.deepEqual(
    inputs.map((i) => i.key),
    ['birth_date', 'current_salary', 'monthly_capacity', 'isa_return_rate', 'isa_income_character'],
    '정산 기간을 비웠는데 그 줄이 남아 있습니다',
  );
});

test('D75 — ISA 예상 수익률을 켜지 않았으면 수익률·수익 성격·정산 기간을 채워도 세 줄 모두 나오지 않는다', () => {
  const inputs = buildSummaryInputs(
    baseFilledForm({
      isaReturnEnabled: false,
      isaReturnRatePercent: '5.5',
      isaIncomeCharacter: 'interest_dividend',
      isaSettlementYears: '3',
    }),
  );
  assert.deepEqual(
    inputs.map((i) => i.key),
    ['birth_date', 'current_salary', 'monthly_capacity'],
    'ISA 수익률 토글이 꺼져 있는데 그 아래 세 항목이 나왔습니다',
  );
});

test('D75 — 화이트리스트 밖의 폼 필드(예: isaCumulative·priorSalary)는 아무리 채워도 inputs에 나타나지 않는다', () => {
  const inputs = buildSummaryInputs(baseFilledForm({ isaCumulative: '9999', priorSalary: '5000', isaExists: true }));
  const serialized = JSON.stringify(inputs);
  assert.ok(!serialized.includes('9999'), 'isaCumulative 값이 새어 나왔습니다');
  assert.ok(!serialized.includes('5000'), 'priorSalary 값이 새어 나왔습니다');
});

test('D75 — buildSummaryData(plan, scenario, rate, form)에 form을 넘기면 inputs가 채워진다', () => {
  const data = buildSummaryData(basePlan(), baseScenario, null, baseFilledForm());
  assert.deepEqual(
    data.inputs.map((i) => i.key),
    ['birth_date', 'current_salary', 'monthly_capacity'],
  );
});
