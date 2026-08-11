// 헤드라인 합계 (D38, `benefit.headline.composite_total`).
//
// **이 파일이 지키는 항등식 하나가 설계 전체를 떠받친다** — 합계 구간의 아래 끝이
// 확정된 세액공제액과 **같은 수**다. 그래야 「최소 ○원 ~ 최대 ○원」에서 아래 끝이
// 조문만으로 정해지는 수가 되고, 확정과 가정의 구분이 부기가 아니라 숫자에 들어간다.
//
// **여기 적힌 금액은 손으로 검산한 값이다.** 산출 근거를 각 자리에 적어 두었으므로
// 엔진이 내놓은 값을 옮겨 적은 것이 아니다. 어긋나면 엔진이 틀린 것이다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { headlineCompositeTotalFor } from './headline.mjs';
import { HEADLINE_TOTAL_BOUND, ISA_ESTIMATE_STATE } from './constants.mjs';
import {
  CONFIRMED_FILE,
  baseRequest,
  findRule,
  loadRulesets,
  planOf,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

/** 합계 객체가 실을 수 있는 것의 **전부**. 이 목록 자체가 계약이다(아래 구조 시험). */
const HEADLINE_KEYS = [
  'lower_bound_krw',
  'upper_bound_krw',
  'point_estimate_krw',
  'bound_code',
  'includes_assumption_component',
  'determined_component_krw',
  'determined_component_period_code',
  'assumption_component_krw',
  'assumption_settlement_years',
  'assumption_settlement_years_source',
  'is_annual',
  'has_statutory_ceiling',
  'basis_rule_ids',
];

const assumption = (character, overrides = {}) => ({
  annual_return_rate: 0.07,
  income_character: character,
  settlement_years: 3,
  loss_amount_krw: null,
  ...overrides,
});

/**
 * 세 배분안이 서로 다른 갈래를 밟는 요청.
 *
 * 예산 1,200만이면 기본안이 연금 공제한도 900만을 채우고 ISA에 300만을 넣으며,
 * `pension_contribution_before_isa`는 **ISA에 한 푼도 넣지 않는다.** 뒤쪽이
 * 「정산액은 계산됐는데 이 안이 ISA에 넣은 돈은 없다」는 갈래이고, 이 저장소에서
 * 그 갈래를 실제로 밟는 좌표는 여기뿐이다.
 */
function request(character, overrides = {}) {
  return baseRequest({
    profile: {
      monthly_capacity_krw: 1_000_000,
      isa_return_assumption: assumption(character),
      ...overrides.profile,
    },
    accounts: {
      isa: { cumulative_contribution_krw: 20_000_000, years_since_opening: 2 },
      ...overrides.accounts,
    },
    options: overrides.options ?? null,
  });
}

const headlineOf = (character, planId, overrides) =>
  planOf(scenarioOf(compute(request(character, overrides), rulesets)), planId)
    .headline_composite_total;

// ── 골든 좌표 ────────────────────────────────────────────────────────────────

test('구간 분기 — 아래 끝이 확정된 세액공제액과 같은 수다', () => {
  const plan = planOf(
    scenarioOf(compute(request('mixed_or_unknown'), rulesets)),
    'max_tax_credit',
  );
  const credit = plan.deterministic_benefit.pension_credit_total_krw;
  const headline = plan.headline_composite_total;

  // 확정 성분 — 인정 납입액 9,000,000 × 15% = 1,350,000, 지방소득세 10%를 더해 1,485,000.
  assert.equal(credit, 1_485_000);
  // 가정 성분의 위 끝 — 원금 (20,000,000 + 3,000,000) × 3년 × 7% = 4,830,000이 전부
  // 이자·배당일 때. 계좌 밖 세액 4,830,000 × 14% × 1.1 = 743,820, 계좌 안 세액
  // (4,830,000 − 2,000,000) × 9% × 1.1 = 280,170. 차이가 463,650이다.
  assert.equal(plan.assumption_based_isa_estimate.upper_bound_krw, 463_650);

  assert.deepStrictEqual(
    {
      lower_bound_krw: headline.lower_bound_krw,
      upper_bound_krw: headline.upper_bound_krw,
      point_estimate_krw: headline.point_estimate_krw,
      bound_code: headline.bound_code,
      includes_assumption_component: headline.includes_assumption_component,
      determined_component_krw: headline.determined_component_krw,
      assumption_component_krw: headline.assumption_component_krw,
      assumption_settlement_years: headline.assumption_settlement_years,
      assumption_settlement_years_source: headline.assumption_settlement_years_source,
    },
    {
      lower_bound_krw: 1_485_000,
      upper_bound_krw: 1_948_650,
      point_estimate_krw: null,
      bound_code: HEADLINE_TOTAL_BOUND.RANGE,
      includes_assumption_component: true,
      determined_component_krw: 1_485_000,
      assumption_component_krw: 463_650,
      assumption_settlement_years: 3,
      assumption_settlement_years_source: 'user',
    },
  );

  // **항등식.** 위 좌표가 우연히 맞은 것이 아니라 관계로 성립한다는 것을 함께 문다.
  assert.equal(
    headline.lower_bound_krw,
    credit,
    '구간의 아래 끝이 확정된 세액공제액과 다르다 — 이 항등식이 이 설계 전체를 떠받친다',
  );
});

test('ISA 성분이 없으면 합계가 확정 성분과 같다 — 정산액이 계산돼 있어도 그렇다', () => {
  const scenario = scenarioOf(compute(request('mixed_or_unknown'), rulesets));
  const plan = planOf(scenario, 'pension_contribution_before_isa');
  const headline = plan.headline_composite_total;

  // **이 안은 ISA에 한 푼도 넣지 않는다.** 그런데도 정산액 자체는 계산돼 있다 —
  // 기존 누적 납입액 20,000,000이 원금이기 때문이다(4,200,000 × 14% × 1.1 = 646,800에서
  // (4,200,000 − 2,000,000) × 9% × 1.1 = 217,800을 뺀 429,000).
  assert.equal(plan.allocations.find((a) => a.account === 'isa').annual_krw, 0);
  assert.equal(plan.assumption_based_isa_estimate.state, ISA_ESTIMATE_STATE.COMPUTED);
  assert.equal(plan.assumption_based_isa_estimate.upper_bound_krw, 429_000);

  // 그래도 합계는 확정 성분과 같은 한 수다 — 그 정산액은 **이 배분안이 만든 것이 아니다.**
  assert.deepStrictEqual(
    [
      headline.lower_bound_krw,
      headline.upper_bound_krw,
      headline.point_estimate_krw,
      headline.bound_code,
      headline.includes_assumption_component,
      headline.assumption_component_krw,
      headline.assumption_settlement_years,
      headline.assumption_settlement_years_source,
    ],
    [1_485_000, 1_485_000, 1_485_000, HEADLINE_TOTAL_BOUND.POINT, false, null, null, null],
  );
  assert.equal(headline.lower_bound_krw, plan.deterministic_benefit.pension_credit_total_krw);
});

test('점 분기 — 소득 성격이 확정적이면 합계도 한 수다', () => {
  const headline = headlineOf('interest_dividend', 'max_tax_credit');

  assert.deepStrictEqual(
    [
      headline.lower_bound_krw,
      headline.upper_bound_krw,
      headline.point_estimate_krw,
      headline.bound_code,
      headline.includes_assumption_component,
      headline.assumption_component_krw,
    ],
    [1_948_650, 1_948_650, 1_948_650, HEADLINE_TOTAL_BOUND.POINT, true, 463_650],
  );

  // **이 갈래에서는 아래 끝이 세액공제액보다 크다.** 규칙이 점을 낼 수 있다고 정한
  // 자리이고(`when_the_isa_point_estimate_exists`), 그때 합계는 구간이 아니다.
  // 그 사실을 `includes_assumption_component`가 진다 — 확정 등급이 아니라는 뜻이다.
  assert.ok(headline.lower_bound_krw > 1_485_000);
});

test('가정을 보내지 않으면 합계는 올해 확정된 세액공제액 하나다', () => {
  const plan = planOf(
    scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: 1_000_000 } }), rulesets)),
    'max_tax_credit',
  );
  assert.equal(plan.assumption_based_isa_estimate, null);
  assert.deepStrictEqual(
    [
      plan.headline_composite_total.lower_bound_krw,
      plan.headline_composite_total.upper_bound_krw,
      plan.headline_composite_total.point_estimate_krw,
      plan.headline_composite_total.includes_assumption_component,
    ],
    [1_485_000, 1_485_000, 1_485_000, false],
  );
});

test('표시를 끄거나 낼 수 없으면 가정 성분이 합계에 들어가지 않는다', () => {
  const suppressed = headlineOf('mixed_or_unknown', 'max_tax_credit', {
    options: { assumption_based_isa_estimate: 'suppress' },
  });
  assert.equal(suppressed.includes_assumption_component, false);
  assert.equal(suppressed.upper_bound_krw, 1_485_000);

  // ISA 유형 미선언 → 비과세 한도 `C`를 몰라 정산액을 낼 수 없다.
  const notComputable = headlineOf('mixed_or_unknown', 'max_tax_credit', {
    accounts: { isa: { account_type: null, cumulative_contribution_krw: 20_000_000, years_since_opening: 2 } },
  });
  assert.equal(notComputable.includes_assumption_component, false);
  assert.equal(notComputable.upper_bound_krw, 1_485_000);
});

// ── 경계값 ──────────────────────────────────────────────────────────────────

test('납입 여력이 0이면 합계도 0이고, 그 0은 구간이 아니다', () => {
  const headline = headlineOf('mixed_or_unknown', 'max_tax_credit', {
    profile: { monthly_capacity_krw: 0, isa_return_assumption: assumption('mixed_or_unknown') },
  });

  assert.deepStrictEqual(
    [
      headline.lower_bound_krw,
      headline.upper_bound_krw,
      headline.point_estimate_krw,
      headline.bound_code,
      headline.includes_assumption_component,
    ],
    [0, 0, 0, HEADLINE_TOTAL_BOUND.POINT, false],
  );
});

test('세액 한도가 공제액을 자르면 합계의 아래 끝도 잘린 뒤의 값이다', () => {
  // 헤드라인이 말하는 것은 **이 사람이 실제로 아끼는 금액**이다. 자르기 전 금액을
  // 실으면 낼 세금이 적은 사람에게 받지 못할 금액을 약속하게 된다.
  const plan = planOf(
    scenarioOf(
      compute(
        request('mixed_or_unknown', {
          profile: {
            monthly_capacity_krw: 1_000_000,
            isa_return_assumption: assumption('mixed_or_unknown'),
            prior_year_tax: { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
          },
        }),
        rulesets,
      ),
    ),
    'max_tax_credit',
  );

  const benefit = plan.deterministic_benefit;
  assert.equal(benefit.tax_liability_cap.applied, true, '이 좌표에서는 한도가 실제로 걸려야 한다');
  assert.ok(benefit.pension_credit_total_krw < benefit.pension_credit_total_before_cap_krw);
  assert.equal(plan.headline_composite_total.lower_bound_krw, benefit.pension_credit_total_krw);
  assert.equal(plan.headline_composite_total.determined_component_krw, benefit.pension_credit_total_krw);
});

// ── 구조 — 합계에 상한 칸이 없다 ────────────────────────────────────────────

test('합계에 법정 상한 칸이 없다 — 없다는 것이 조문의 판정이다', () => {
  for (const character of ['mixed_or_unknown', 'interest_dividend', 'listed_equity_capital_gain']) {
    for (const plan of scenarioOf(compute(request(character), rulesets)).plans) {
      const headline = plan.headline_composite_total;
      assert.deepStrictEqual(
        Object.keys(headline).sort(),
        [...HEADLINE_KEYS].sort(),
        `${plan.plan_id}: 합계 객체의 칸이 계약과 다르다 — 새 칸이 생겼다면 그것이 분모가 될 수 있다`,
      );
      // 금액 칸 넷은 합계의 두 끝·점·구성뿐이다. 「최대 ○원 중 ○원」의 분모가 될 칸이 없다.
      assert.deepStrictEqual(
        Object.keys(headline).filter((key) => key.endsWith('_krw')).sort(),
        [
          'assumption_component_krw',
          'determined_component_krw',
          'lower_bound_krw',
          'point_estimate_krw',
          'upper_bound_krw',
        ],
        `${plan.plan_id}: 합계에 새 금액 칸이 생겼다`,
      );
      assert.equal(headline.has_statutory_ceiling, false, plan.plan_id);
      // 합계에는 어느 기간도 붙지 않는다. 「연간 절세액」이 그 순간 틀린 수가 된다.
      assert.equal(headline.is_annual, false, plan.plan_id);
      assert.equal(headline.determined_component_period_code, 'current_tax_year', plan.plan_id);
      assert.ok(headline.basis_rule_ids.includes('benefit.headline.composite_total'), plan.plan_id);
    }
  }
});

// ── 순수 함수 — 응답으로는 세우기 어려운 좌표까지 직접 넣는다 ────────────────

test('합계를 만드는 산술은 두 성분의 덧셈 하나다', () => {
  const rule = { basisRuleIds: ['x'] };
  const estimate = (extra) => ({
    state: ISA_ESTIMATE_STATE.COMPUTED,
    settlement_years: 5,
    settlement_years_source: 'ruleset_min_contract_years',
    lower_bound_krw: 0,
    upper_bound_krw: 100,
    point_estimate_krw: null,
    ...extra,
  });

  const range = headlineCompositeTotalFor({
    determinedCreditKrw: 70,
    estimate: estimate({}),
    isaAllocatedKrw: 1,
    rule,
  });
  assert.deepStrictEqual(
    [range.lower_bound_krw, range.upper_bound_krw, range.point_estimate_krw, range.bound_code],
    [70, 170, null, HEADLINE_TOTAL_BOUND.RANGE],
  );
  assert.equal(range.assumption_settlement_years_source, 'ruleset_min_contract_years');

  // **아래 끝이 0으로 박혀 있지 않다.** 룰셋이 구간의 아래 끝을 올리면 합계의 아래 끝도
  // 따라 올라간다 — 항등식은 코드의 규약이 아니라 조문의 귀결이다.
  const raised = headlineCompositeTotalFor({
    determinedCreditKrw: 70,
    estimate: estimate({ lower_bound_krw: 40 }),
    isaAllocatedKrw: 1,
    rule,
  });
  assert.equal(raised.lower_bound_krw, 110);

  const point = headlineCompositeTotalFor({
    determinedCreditKrw: 70,
    estimate: estimate({ lower_bound_krw: 100, point_estimate_krw: 100 }),
    isaAllocatedKrw: 1,
    rule,
  });
  assert.deepStrictEqual(
    [point.lower_bound_krw, point.upper_bound_krw, point.point_estimate_krw, point.bound_code],
    [170, 170, 170, HEADLINE_TOTAL_BOUND.POINT],
  );

  // ISA 배분이 0이면 정산액이 아무리 커도 합계에 들어가지 않는다.
  const noAllocation = headlineCompositeTotalFor({
    determinedCreditKrw: 70,
    estimate: estimate({}),
    isaAllocatedKrw: 0,
    rule,
  });
  assert.deepStrictEqual(
    [noAllocation.upper_bound_krw, noAllocation.includes_assumption_component],
    [70, false],
  );

  // 정산액을 내지 못한 상태도 같다.
  for (const state of ['display_suppressed', 'not_computable']) {
    const shell = headlineCompositeTotalFor({
      determinedCreditKrw: 70,
      estimate: estimate({ state, lower_bound_krw: null, upper_bound_krw: null }),
      isaAllocatedKrw: 1,
      rule,
    });
    assert.deepStrictEqual([shell.upper_bound_krw, shell.includes_assumption_component], [70, false]);
  }
});

// ── 비과세 축의 상한 (D38 6번) ──────────────────────────────────────────────

test('비과세 축의 상한이 유형에 따라 갈리고 룰셋의 값과 일치한다', () => {
  // **독립 오라클.** 엔진은 `C × 일반세율 × (1+부가율)`로 계산하고, 룰셋은 그 결과를
  // `amounts_krw`에 따로 적어 두었다. 둘을 대조하면 세율을 잘못 쓴 구현이 걸린다.
  const stated = findRule(rulesets, CONFIRMED_FILE, 'isa.benefit.axis_ceiling').value.tax_free_axis
    .amounts_krw;

  const ceilingOf =(accountType, priorSalary) =>
    planOf(
      scenarioOf(
        compute(
          request('mixed_or_unknown', {
            profile: {
              monthly_capacity_krw: 1_000_000,
              isa_return_assumption: assumption('mixed_or_unknown'),
              prior_year_total_salary_krw: priorSalary,
            },
            accounts: {
              isa: {
                account_type: accountType,
                cumulative_contribution_krw: 20_000_000,
                years_since_opening: 2,
              },
            },
          }),
          rulesets,
        ),
      ),
      'max_tax_credit',
    ).assumption_based_isa_estimate.axis_ceilings;

  const general = ceilingOf('general', 52_000_000);
  const lowIncome = ceilingOf('low_income', 40_000_000);

  assert.equal(general.tax_free_krw, stated['일반형']);
  assert.equal(lowIncome.tax_free_krw, stated['서민형']);
  assert.ok(lowIncome.tax_free_krw > general.tax_free_krw);

  // **기간이 값으로 나간다.** 옆의 세액공제 축은 연간이므로 기간이 없으면 이 값도
  // 연간으로 읽힌다 — 그것이 규칙이 라벨 요건을 따로 적은 이유다.
  assert.equal(general.tax_free_period_code, 'contract_settlement_period');
  assert.equal(general.tax_free_settlement_years, 3);
  // 이 값은 「법이 정한 최대 절세액」이 아니라 이 계산이 낼 수 있는 값의 최댓값이다.
  assert.equal(general.tax_free_is_lower_bound, true);
});

test('저율분리과세 축과 손익통산 축에는 상한 칸 자체가 없다', () => {
  const ceilings = planOf(
    scenarioOf(compute(request('mixed_or_unknown'), rulesets)),
    'max_tax_credit',
  ).assumption_based_isa_estimate.axis_ceilings;

  assert.deepStrictEqual(Object.keys(ceilings).sort(), [
    'loss_offset_has_ceiling',
    'rate_gap_has_ceiling',
    'tax_free_is_lower_bound',
    'tax_free_krw',
    'tax_free_period_code',
    'tax_free_settlement_years',
  ]);
  // **없어서 못 낸 것이 아니라 없다는 것이 판정이다.** 그래서 유무는 값으로 나가고
  // 금액 칸은 만들지 않는다 — 칸이 있으면 언젠가 지어낸 분모가 들어간다.
  assert.equal(ceilings.rate_gap_has_ceiling, false);
  assert.equal(ceilings.loss_offset_has_ceiling, false);
});

test('정산액을 내지 못하면 축의 상한도 함께 사라진다', () => {
  const estimateOf = (overrides) =>
    planOf(scenarioOf(compute(request('mixed_or_unknown', overrides), rulesets)), 'max_tax_credit')
      .assumption_based_isa_estimate;

  assert.equal(
    estimateOf({ options: { assumption_based_isa_estimate: 'suppress' } }).axis_ceilings,
    null,
    '표시를 껐는데 분모가 남아 있다',
  );
  assert.equal(
    estimateOf({
      accounts: { isa: { account_type: null, cumulative_contribution_krw: 20_000_000, years_since_opening: 2 } },
    }).axis_ceilings,
    null,
    '한도 `C`를 모르는데 그 한도로 만든 분모가 나갔다',
  );
});
