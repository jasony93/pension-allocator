// 월 환산 — 산술과 응답 둘 다 시험한다.
//
// **왜 산술을 따로 시험하는가.** 「얹을 곳이 하나도 없다」는 갈래는 확정 룰셋에서 예산이
// 남은 한도의 합과 정확히 같을 때만 나온다. 응답만 시험하면 그 갈래가 거의 돌지 않고,
// 돌지 않는 분기는 통과하면서 아무것도 막지 못한다. `splitUnallocated`를 떼어낸 것과
// 같은 이유다.
//
// **여기 있는 숫자는 세법 수치가 아니다.** 개월수·한도 여유·연 배분을 전부 인자로 주는
// 함수이므로 이 파일의 값은 산술을 고정하는 입력일 뿐이다. 응답 쪽 시험은 한도를 룰셋에서
// 읽은 응답 자신에게서 가져온다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { ACCOUNT, MONTHLY_BUCKET, MONTHLY_UNASSIGNED_REASON } from './constants.mjs';
import { apportionMonthly } from './monthly.mjs';
import { baseRequest, loadRulesets, planOf, scenarioOf } from './test-helpers.mjs';

const rulesets = loadRulesets();

// ── 1부. 산술 ────────────────────────────────────────────────────

const PENSION_POOL = 'pension';
const ISA_POOL = 'isa';

/** 세 계좌 + 미배분. `poolId: null`이 미배분이다. */
function bucketsOf({ pension = 0, annuity = 0, isa = 0, unallocated = 0 }) {
  return [
    { id: 'retirement_pension', annualKrw: pension, poolId: PENSION_POOL, orderIndex: 1 },
    { id: 'annuity_savings', annualKrw: annuity, poolId: PENSION_POOL, orderIndex: 2 },
    { id: 'isa', annualKrw: isa, poolId: ISA_POOL, orderIndex: 3 },
    { id: 'unallocated', annualKrw: unallocated, poolId: null, orderIndex: 4 },
  ];
}

const WIDE = { [PENSION_POOL]: 1_000_000, [ISA_POOL]: 1_000_000 };
const NONE = { [PENSION_POOL]: 0, [ISA_POOL]: 0 };

const monthlyOf = (result, id) => result.buckets.find((b) => b.id === id).monthlyKrw;
const totalMonthly = (result) => result.buckets.reduce((sum, b) => sum + b.monthlyKrw, 0);

test('나누어떨어지면 아무것도 얹지 않는다', () => {
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 6_000_000, isa: 6_000_000 }),
    poolHeadroomKrw: WIDE,
  });

  assert.equal(totalMonthly(result), 1_000_000);
  assert.equal(result.unassignedMonthlyKrw, 0);
  assert.deepEqual(result.carriers, []);
  for (const bucket of result.buckets) {
    assert.equal(bucket.roundingAdjustmentMonthlyKrw, 0);
    assert.equal(bucket.monthlyAnnualizedKrw, bucket.floorMonthlyKrw * 12);
  }
});

test('나머지가 있으면 합이 월 여력과 정확히 같아진다', () => {
  // 연 합 = 12 × 1,000,000. 나머지 합은 반드시 개월수의 배수다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 3_000_005, annuity: 4_000_003, isa: 4_999_992 }),
    poolHeadroomKrw: WIDE,
  });

  assert.equal(totalMonthly(result) + result.unassignedMonthlyKrw, 1_000_000);
  assert.equal(result.unassignedMonthlyKrw, 0);
});

test('벗어남이 가장 작은 갈래부터 받는다 — 나머지가 큰 쪽이다', () => {
  // 나머지: 연금 5, 연금저축 7, ISA 0. 합 12 = 1 × 12 이므로 한 원만 얹는다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 3_000_005, annuity: 4_000_003, isa: 4_999_992 }),
    poolHeadroomKrw: WIDE,
  });

  assert.deepEqual(result.carriers, ['annuity_savings'], '나머지 7(값 5)이 나머지 5(값 7)보다 싸다');
  assert.equal(monthlyOf(result, 'annuity_savings'), Math.floor(4_000_003 / 12) + 1);
  assert.equal(monthlyOf(result, 'retirement_pension'), Math.floor(3_000_005 / 12));
});

test('한도 여유가 값보다 작으면 그 계좌를 건너뛰고 다음으로 간다', () => {
  // 연금 쌍의 여유가 0이다. 가장 싼 갈래는 연금저축이지만 얹을 수 없다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 3_000_005, annuity: 4_000_003, isa: 4_999_992 }),
    poolHeadroomKrw: { [PENSION_POOL]: 0, [ISA_POOL]: 1_000_000 },
  });

  assert.deepEqual(result.carriers, ['isa'], '여유가 있는 곳으로 갔다');
  assert.equal(totalMonthly(result), 1_000_000);
  // ISA는 나머지가 0이라 값이 12원 통째다. 그래도 여유 안이므로 얹을 수 있다.
  assert.equal(result.buckets.find((b) => b.id === 'isa').monthlyAnnualizedKrw, 4_999_992 + 12);
});

test('여유가 값보다 1원 모자라면 얹지 못한다 — 경계', () => {
  const tight = (pensionHeadroom, isaHeadroom) =>
    apportionMonthly({
      months: 12,
      capacityMonthlyKrw: 1_000_000,
      buckets: bucketsOf({ pension: 3_000_005, annuity: 4_000_003, isa: 4_999_992 }),
      poolHeadroomKrw: { [PENSION_POOL]: pensionHeadroom, [ISA_POOL]: isaHeadroom },
    });

  // 연금저축의 값은 12 − 7 = 5원, ISA의 값은 12 − 0 = 12원이다.
  assert.deepEqual(tight(5, 0).carriers, ['annuity_savings']);
  assert.deepEqual(tight(4, 12).carriers, ['isa'], '5원을 못 내면 다음으로 싼 곳으로 간다');
  assert.deepEqual(tight(4, 11).carriers, [], '12원을 못 내면 거기도 못 얹는다');
  assert.equal(tight(4, 11).unassignedMonthlyKrw, 1);
  assert.deepEqual(tight(0, 0).carriers, []);
  assert.equal(tight(0, 0).unassignedMonthlyKrw, 1);
});

test('두 연금계좌는 여유를 나눠 쓴다 — 한쪽이 쓰면 다른 쪽이 못 쓴다', () => {
  // 나머지: 연금 11, 연금저축 11, ISA 2. 합 24 = 2 × 12 → 두 원을 얹어야 한다.
  const buckets = bucketsOf({ pension: 3_000_011, annuity: 3_000_011, isa: 5_999_978 });
  // 값은 각각 1원·1원. 여유가 1원뿐이면 한쪽만 받는다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets,
    poolHeadroomKrw: { [PENSION_POOL]: 1, [ISA_POOL]: 0 },
  });

  assert.deepEqual(result.carriers, ['retirement_pension'], '값이 같으면 충당 순서로 깬다');
  assert.equal(result.unassignedMonthlyKrw, 1, '나머지 한 원은 갈 곳이 없다');

  const roomy = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets,
    poolHeadroomKrw: { [PENSION_POOL]: 2, [ISA_POOL]: 0 },
  });
  assert.deepEqual(roomy.carriers, ['retirement_pension', 'annuity_savings']);
  assert.equal(roomy.unassignedMonthlyKrw, 0);
});

test('미배분은 한도 검사 없이 받는다 — 어느 계좌에도 들어가지 않는 돈이다', () => {
  // 세 계좌가 한도까지 찼고(여유 0) 미배분이 남았다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 3_000_005, isa: 4_000_003, unallocated: 4_999_992 }),
    poolHeadroomKrw: NONE,
  });

  assert.deepEqual(result.carriers, ['unallocated']);
  assert.equal(totalMonthly(result), 1_000_000);
  assert.equal(result.unassignedMonthlyKrw, 0);
});

test('미배분이 0이면 미배분도 받지 못한다 — 남길 것이 없다', () => {
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 3_000_005, annuity: 4_000_003, isa: 4_999_992 }),
    poolHeadroomKrw: NONE,
  });

  assert.deepEqual(result.carriers, []);
  assert.equal(result.unassignedMonthlyKrw, 1, '합이 모자라는 것이 사실이고 그 사실을 값으로 낸다');
  assert.equal(totalMonthly(result) + result.unassignedMonthlyKrw, 1_000_000);
});

test('배분이 0인 갈래에는 월 금액을 붙이지 않는다', () => {
  // ISA 배분이 0인데 여유는 넓다. 여기 얹으면 「넣지 않는다」는 보고가 거짓이 된다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 6_000_005, annuity: 5_999_995 }),
    poolHeadroomKrw: { [PENSION_POOL]: 0, [ISA_POOL]: 10_000_000 },
  });

  assert.equal(monthlyOf(result, 'isa'), 0);
  assert.equal(result.unassignedMonthlyKrw, 1);
});

test('값이 같으면 충당 순서가 정한다 — 같은 입력에 같은 답', () => {
  const run = () =>
    apportionMonthly({
      months: 12,
      capacityMonthlyKrw: 1_000_000,
      buckets: [
        // 나머지 5·5·2 → 값 7·7·10. 앞의 둘이 같은 값이고 orderIndex만 다르다.
        { id: 'retirement_pension', annualKrw: 4_000_001, poolId: PENSION_POOL, orderIndex: 3 },
        { id: 'annuity_savings', annualKrw: 4_000_001, poolId: PENSION_POOL, orderIndex: 1 },
        { id: 'isa', annualKrw: 3_999_998, poolId: ISA_POOL, orderIndex: 2 },
        { id: 'unallocated', annualKrw: 0, poolId: null, orderIndex: 4 },
      ],
      poolHeadroomKrw: { [PENSION_POOL]: 7, [ISA_POOL]: 0 },
    });

  assert.deepEqual(run().carriers, ['annuity_savings'], 'orderIndex가 작은 쪽');
  assert.deepEqual(run().carriers, run().carriers);
});

test('한 갈래가 두 원을 받을 수 있다 — 다른 곳이 다 막혔을 때', () => {
  // 나머지: 연금 11, 연금저축 11, ISA 2 → 두 원. 연금 쌍이 막혀 ISA만 남는다.
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 1_000_000,
    buckets: bucketsOf({ pension: 3_000_011, annuity: 3_000_011, isa: 5_999_978 }),
    poolHeadroomKrw: { [PENSION_POOL]: 0, [ISA_POOL]: 1_000_000 },
  });

  assert.deepEqual(result.carriers, ['isa']);
  assert.equal(result.buckets.find((b) => b.id === 'isa').roundingAdjustmentMonthlyKrw, 2);
  assert.equal(totalMonthly(result), 1_000_000);
  assert.equal(result.unassignedMonthlyKrw, 0);
});

test('개월수가 1이면 나머지가 없다 — 경계', () => {
  const result = apportionMonthly({
    months: 1,
    capacityMonthlyKrw: 12_345_678,
    buckets: bucketsOf({ pension: 5_000_000, isa: 7_345_678 }),
    poolHeadroomKrw: WIDE,
  });

  assert.equal(totalMonthly(result), 12_345_678);
  assert.deepEqual(result.carriers, []);
  assert.equal(result.unassignedMonthlyKrw, 0);
});

test('납입 여력이 0이면 전부 0이다 — 경계', () => {
  const result = apportionMonthly({
    months: 12,
    capacityMonthlyKrw: 0,
    buckets: bucketsOf({}),
    poolHeadroomKrw: WIDE,
  });

  assert.equal(totalMonthly(result), 0);
  assert.equal(result.unassignedMonthlyKrw, 0);
});

test('인자를 변형하지 않는다 — 같은 인자로 두 번 부르면 같은 답', () => {
  const buckets = bucketsOf({ pension: 3_000_005, annuity: 4_000_003, isa: 4_999_992 });
  const headroom = { [PENSION_POOL]: 5, [ISA_POOL]: 0 };
  const snapshot = JSON.stringify({ buckets, headroom });

  const first = apportionMonthly({ months: 12, capacityMonthlyKrw: 1_000_000, buckets, poolHeadroomKrw: headroom });
  const second = apportionMonthly({ months: 12, capacityMonthlyKrw: 1_000_000, buckets, poolHeadroomKrw: headroom });

  assert.equal(JSON.stringify({ buckets, headroom }), snapshot, '인자가 바뀌었다');
  assert.deepEqual(first, second);
});

test('어느 갈래도 연 배분에서 개월수 이상 벗어나지 않는다', () => {
  const months = 12;
  for (let offset = 0; offset < 60; offset += 1) {
    const pension = 3_000_000 + offset;
    const annuity = 4_000_000 + offset * 2;
    const isa = 12 * 1_000_000 - pension - annuity;
    const result = apportionMonthly({
      months,
      capacityMonthlyKrw: 1_000_000,
      buckets: bucketsOf({ pension, annuity, isa }),
      poolHeadroomKrw: WIDE,
    });

    assert.equal(totalMonthly(result) + result.unassignedMonthlyKrw, 1_000_000, `offset=${offset}`);
    for (const bucket of result.buckets) {
      const annual = { retirement_pension: pension, annuity_savings: annuity, isa, unallocated: 0 }[bucket.id];
      assert.ok(bucket.monthlyAnnualizedKrw - annual < months, `offset=${offset} ${bucket.id}`);
    }
  }
});

// ── 2부. 응답 ────────────────────────────────────────────────────

/** 그 배분안의 네 갈래를 다 더한 값. 도넛이 그리는 것과 같은 집합이다. */
function donutTotal(plan) {
  return plan.allocations.reduce((sum, a) => sum + a.monthly_krw, 0) + plan.unallocated_monthly_krw;
}

test('소유자 신고 — 월 250만을 넣으면 월 배분 총액이 정확히 250만이다', () => {
  // 신고된 형태를 그대로 만든다. 연금저축에 12로 나누어떨어지지 않는 기납입액이 있어
  // 잔여 한도가 12의 배수가 아니게 되고, 그래서 계좌별 내림이 1원을 버렸다.
  const request = baseRequest({
    profile: { monthly_capacity_krw: 2_500_000 },
    accounts: { annuity_savings: { ytd_contribution_krw: 1_111_111 } },
  });
  const scenario = scenarioOf(compute(request, rulesets));

  for (const plan of scenario.plans) {
    assert.equal(donutTotal(plan) + plan.monthly_unassigned_krw, 2_500_000, plan.plan_id);
    assert.equal(plan.monthly_unassigned_krw, 0, `${plan.plan_id}: 얹을 곳이 있었다`);
    assert.equal(donutTotal(plan), 2_500_000, `${plan.plan_id}: 도넛 가운데 값`);
  }
});

test('12로 나누어떨어지지 않는 여러 여력에서도 합이 맞는다', () => {
  const capacities = [333_333, 700_001, 1_000_000, 1_234_567, 2_500_000, 4_166_667];
  for (const capacity of capacities) {
    for (const months of [3, 7, 11, 12]) {
      const request = baseRequest({
        profile: { monthly_capacity_krw: capacity, months_remaining_in_tax_year: months },
        accounts: {
          annuity_savings: { ytd_contribution_krw: 1_111_111 },
          isa: { ytd_contribution_krw: 5_555_555, cumulative_contribution_krw: 5_555_555 },
        },
      });
      const scenario = scenarioOf(compute(request, rulesets));
      for (const plan of scenario.plans) {
        assert.equal(
          donutTotal(plan) + plan.monthly_unassigned_krw,
          capacity,
          `${capacity}원/${months}개월 ${plan.plan_id}`,
        );
      }
    }
  }
});

test('월 환산이 연 배분과 세액공제액에 되먹임하지 않는다', () => {
  // **같은 예산을 개월수만 다르게 준다.** 연 배분은 예산과 한도만으로 정해지므로 같아야
  // 하고, 월 환산의 나머지는 개월수가 다르므로 달라진다. 그런데도 연 기준 값이 전부
  // 같으면, 월 금액이 연 계산으로 되돌아가지 않는다는 것이 값으로 증명된다.
  const of = (capacity, months) =>
    planOf(
      scenarioOf(
        compute(
          baseRequest({
            profile: { monthly_capacity_krw: capacity, months_remaining_in_tax_year: months },
            accounts: { annuity_savings: { ytd_contribution_krw: 1_111_111 } },
          }),
          rulesets,
        ),
      ),
      'max_tax_credit',
    );

  const twelve = of(2_500_000, 12);
  const six = of(5_000_000, 6);

  assert.deepEqual(
    twelve.allocations.map((a) => [a.account, a.annual_krw]),
    six.allocations.map((a) => [a.account, a.annual_krw]),
    '같은 예산인데 연 배분이 달라졌다',
  );
  assert.deepEqual(twelve.deterministic_benefit, six.deterministic_benefit, '세액공제액이 움직였다');
  assert.notDeepEqual(
    twelve.allocations.map((a) => a.monthly_rounding_adjustment_krw),
    six.allocations.map((a) => a.monthly_rounding_adjustment_krw),
    '두 입력의 월 환산이 같으면 이 시험이 아무것도 가르지 못한다',
  );

  // 그리고 잔차를 떠안은 계좌의 연 환산은 연 배분보다 크다 — 그것이 이번 변경의 실체다.
  const carried = twelve.allocations.filter((a) => a.monthly_rounding_adjustment_krw > 0);
  assert.ok(carried.length > 0, '이 입력에서는 잔차가 얹혀야 한다');
  for (const allocation of carried) {
    assert.ok(allocation.annual_krw % 12 > 0, '나머지가 있는 계좌에 얹혔다');
    assert.ok(allocation.monthly_annualized_krw > allocation.annual_krw);
  }
});

test('얹을 곳이 하나도 없으면 모자라는 사실을 값으로 낸다', () => {
  // 예산을 **남은 한도의 합과 정확히 같게** 만든다. 그러면 미배분이 0이면서 세 계좌가
  // 모두 한도에 닿아 여유가 사라진다. 한도는 응답에서 읽는다 — 코드에 적지 않는다.
  const probe = scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: 10_000_000 } }), rulesets));
  const isaLimit = probe.limits.by_account.find((l) => l.account === ACCOUNT.ISA)
    .contribution_limit_remaining_krw;
  const pensionLimit = probe.limits.pension_contribution_limit_remaining_krw;

  const months = 12;
  // 합이 개월수의 배수가 되도록 연금 기납입액으로 미세 조정한다.
  const ytd = (pensionLimit + isaLimit) % months;
  const budget = pensionLimit + isaLimit - ytd;
  assert.equal(budget % months, 0);

  const request = baseRequest({
    profile: { monthly_capacity_krw: budget / months, months_remaining_in_tax_year: months },
    accounts: { annuity_savings: { ytd_contribution_krw: ytd } },
  });
  const scenario = scenarioOf(compute(request, rulesets));
  const plan = planOf(scenario, 'max_tax_credit');

  assert.equal(plan.unallocated_annual_krw, 0, '미배분이 없어야 이 갈래가 돈다');
  assert.ok(plan.monthly_unassigned_krw > 0, '이 입력에서는 얹을 곳이 없다');
  assert.equal(
    plan.monthly_unassigned_reason_code,
    MONTHLY_UNASSIGNED_REASON.NO_DESTINATION_WITHIN_CONTRIBUTION_LIMIT,
  );
  // **모자라는 것을 숨기지 않는다.** 넷의 합 + 담지 못한 몫 = 월 여력.
  assert.equal(donutTotal(plan) + plan.monthly_unassigned_krw, budget / months);
  // 그리고 그때에도 한도는 한 원도 넘지 않는다.
  const pensionAnnualized = plan.allocations
    .filter((a) => a.account !== ACCOUNT.ISA)
    .reduce((sum, a) => sum + a.monthly_annualized_krw, 0);
  assert.ok(pensionAnnualized <= pensionLimit);
});

test('잔차가 없으면 담지 못한 몫도 이유도 없다', () => {
  const scenario = scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: 500_000 } }), rulesets));
  for (const plan of scenario.plans) {
    assert.equal(plan.monthly_unassigned_krw, 0);
    assert.equal(plan.monthly_unassigned_reason_code, null);
    for (const allocation of plan.allocations) {
      assert.equal(allocation.monthly_rounding_adjustment_krw, 0);
    }
  }
});

test('잔차 필드는 여전히 「내림으로 버려지는 몫」이다 — 값이 바뀌지 않았다', () => {
  const months = 7;
  const request = baseRequest({
    profile: { monthly_capacity_krw: 1_428_571, months_remaining_in_tax_year: months },
  });
  const scenario = scenarioOf(compute(request, rulesets));

  for (const plan of scenario.plans) {
    const flooringLoss = plan.allocations.reduce((sum, a) => sum + (a.annual_krw % months), 0);
    assert.equal(plan.monthly_rounding_residual_krw, flooringLoss, plan.plan_id);
  }
});

test('미배분이 있는 배분안에서는 잔차가 미배분으로 간다', () => {
  // 예산이 모든 한도를 넘으면 세 계좌가 한도까지 차고 미배분이 남는다.
  const months = 12;
  const request = baseRequest({
    profile: { monthly_capacity_krw: 8_333_333, months_remaining_in_tax_year: months },
    accounts: { annuity_savings: { ytd_contribution_krw: 1 } },
  });
  const scenario = scenarioOf(compute(request, rulesets));
  const plan = planOf(scenario, 'max_tax_credit');

  assert.ok(plan.unallocated_annual_krw > 0, '이 입력에는 미배분이 있어야 한다');
  assert.equal(donutTotal(plan) + plan.monthly_unassigned_krw, 8_333_333);
  if (plan.monthly_rounding_residual_krw > 0) {
    assert.equal(
      plan.unallocated_monthly_rounding_adjustment_krw > 0,
      true,
      '한도가 다 찼으면 잔차는 미배분이 받는다',
    );
    for (const allocation of plan.allocations) {
      assert.equal(allocation.monthly_rounding_adjustment_krw, 0, '한도가 찬 계좌는 받지 않는다');
    }
  }
});

test('미배분 갈래의 id는 계좌 id와 겹치지 않는다', () => {
  assert.equal(Object.values(ACCOUNT).includes(MONTHLY_BUCKET.UNALLOCATED), false);
});
