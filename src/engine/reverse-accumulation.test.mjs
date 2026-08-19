// 적립기 역산(블록 2)의 시험. **수익률이 있을 때만 서는 블록이다.**
//
// 여기서 검사하는 것은 세법이 아니라 산술 두 가지다 — 월 복리 역산이 목표에 닿는가,
// 그리고 그 몫이 **법정 상한 안에서** 계좌에 어떻게 앉는가. 상한은 전부 룰셋에서 온다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadRulesets } from './test-helpers.mjs';
import { loadReverseRules } from './reverse-rules.mjs';
import {
  allocateMonthlyContribution,
  futureValueOfMonthlyPlan,
  isaSourceMonthlyCap,
  monthlyContributionCeilings,
  requiredMonthlyContribution,
} from './reverse-accumulation.mjs';

const RULESETS = loadRulesets();

function rules() {
  const loaded = loadReverseRules(RULESETS, 2026);
  assert.deepEqual(loaded.errors, []);
  return loaded.rules;
}

// ── 월 복리 역산 ────────────────────────────────────────────────────────

test('수익률 0이면 역산은 나눗셈 하나다 — 목표 ÷ 개월수', () => {
  const r = rules();
  const result = requiredMonthlyContribution(r, {
    targetKrw: 120_000_000,
    currentBalanceKrw: 0,
    lumpSumAtStartKrw: 0,
    annualReturnRate: 0,
    months: 120,
  });
  assert.equal(result.monthly_krw, 1_000_000);
  assert.equal(result.future_value_of_existing_krw, 0);
  assert.equal(result.gap_krw, 120_000_000);
});

test('역산한 월 납입액은 목표에 닿고, 1원을 빼면 닿지 않는다 (하한의 최소성)', () => {
  const r = rules();
  const args = {
    targetKrw: 200_000_000,
    currentBalanceKrw: 12_345_678,
    lumpSumAtStartKrw: 0,
    annualReturnRate: 0.05,
    months: 241, // 12의 배수가 아닌 개월수도 함께 문다
  };
  const result = requiredMonthlyContribution(r, args);

  const reached = futureValueOfMonthlyPlan(r, { ...args, monthlyKrw: result.monthly_krw });
  const oneWonShort = futureValueOfMonthlyPlan(r, { ...args, monthlyKrw: result.monthly_krw - 1 });

  assert.ok(reached >= args.targetKrw, '역산값으로 목표에 닿아야 한다');
  assert.ok(oneWonShort < args.targetKrw, '1원을 빼면 목표에 못 닿아야 한다 — 하한이어야 한다');
});

test('현재 잔액이 이미 목표를 넘으면 월 납입액은 0이다 — 음수를 내지 않는다', () => {
  const r = rules();
  const result = requiredMonthlyContribution(r, {
    targetKrw: 100_000_000,
    currentBalanceKrw: 100_000_000,
    lumpSumAtStartKrw: 0,
    annualReturnRate: 0.03,
    months: 120,
  });
  assert.equal(result.monthly_krw, 0);
  assert.ok(result.gap_krw <= 0);
  assert.equal(result.already_funded, true);
});

test('퇴직금 재원은 성장 없이 개시 시점 금액 그대로 목표에서 빠진다', () => {
  const r = rules();
  const withLump = requiredMonthlyContribution(r, {
    targetKrw: 200_000_000,
    currentBalanceKrw: 0,
    lumpSumAtStartKrw: 50_000_000,
    annualReturnRate: 0,
    months: 100,
  });
  assert.equal(withLump.gap_krw, 150_000_000);
  assert.equal(withLump.monthly_krw, 1_500_000);
});

test('개월수가 0 이하면 계산하지 않는다 — 0으로 나누지 않는다', () => {
  const r = rules();
  assert.equal(
    requiredMonthlyContribution(r, {
      targetKrw: 100_000_000,
      currentBalanceKrw: 0,
      lumpSumAtStartKrw: 0,
      annualReturnRate: 0.05,
      months: 0,
    }),
    null,
  );
});

// ── 법정 상한 ───────────────────────────────────────────────────────────

test('세 계좌 월 상한은 전부 룰셋에서 온다', () => {
  const r = rules();
  const ceilings = monthlyContributionCeilings(r, { isaYearsSinceOpening: 0, isaCumulativeKrw: 0 });

  // 연금 두 계좌가 나눠 쓰는 납입 한도(연 1,800만) ÷ 12
  assert.equal(ceilings.pension_pool_monthly_krw, Math.floor(18_000_000 / 12));
  // ISA 연간 한도(가입 첫 해 2,000만) ÷ 12
  assert.equal(ceilings.isa_monthly_krw, Math.floor(20_000_000 / 12));
  assert.equal(ceilings.total_monthly_krw, ceilings.pension_pool_monthly_krw + ceilings.isa_monthly_krw);
});

test('ISA 연간 한도는 경과연수의 함수이고 총 납입한도에서 멈춘다', () => {
  const r = rules();
  const first = monthlyContributionCeilings(r, { isaYearsSinceOpening: 0, isaCumulativeKrw: 0 });
  const fourth = monthlyContributionCeilings(r, { isaYearsSinceOpening: 4, isaCumulativeKrw: 0 });
  const tenth = monthlyContributionCeilings(r, { isaYearsSinceOpening: 10, isaCumulativeKrw: 0 });

  assert.ok(fourth.isa_monthly_krw > first.isa_monthly_krw, '경과연수가 늘면 그 해 한도가 는다');
  assert.equal(tenth.isa_monthly_krw, fourth.isa_monthly_krw, '총 납입한도에서 멈춘다');

  // 이미 넣은 만큼은 빠진다.
  const used = monthlyContributionCeilings(r, {
    isaYearsSinceOpening: 4,
    isaCumulativeKrw: 100_000_000,
  });
  assert.equal(used.isa_monthly_krw, 0);
});

// ── 계좌 배분 ───────────────────────────────────────────────────────────

test('배분은 연금저축 단독 공제 한도 → IRP(합산까지) → 연금저축(납입 한도까지) → ISA 순이다', () => {
  const r = rules();
  const allocation = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: 3_000_000,
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
  });

  const by = Object.fromEntries(allocation.allocations.map((a) => [a.account, a]));
  assert.equal(by.annuity_savings.monthly_krw, Math.floor(6_000_000 / 12) + Math.floor(18_000_000 / 12) - Math.floor(9_000_000 / 12));
  assert.equal(by.retirement_pension.monthly_krw, Math.floor(9_000_000 / 12) - Math.floor(6_000_000 / 12));
  assert.equal(
    by.annuity_savings.monthly_krw + by.retirement_pension.monthly_krw,
    Math.floor(18_000_000 / 12),
  );
  assert.equal(by.isa.monthly_krw, 3_000_000 - Math.floor(18_000_000 / 12));
  assert.equal(allocation.unallocatable_monthly_krw, 0);
  assert.equal(allocation.exceeds_statutory_ceiling, false);

  // 어느 계좌에 얼마인지의 **근거**가 값으로 나간다.
  for (const item of allocation.allocations) {
    assert.ok(item.basis_rule_ids.length > 0, `${item.account}에 근거가 실려야 한다`);
    assert.ok(item.fill_order === null || Number.isSafeInteger(item.fill_order));
  }
});

test('적은 금액은 연금저축 하나로 끝난다 — IRP를 이유 없이 묶지 않는다', () => {
  const r = rules();
  const allocation = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: 300_000,
    isaYearsSinceOpening: null,
    isaCumulativeKrw: null,
  });
  const by = Object.fromEntries(allocation.allocations.map((a) => [a.account, a]));
  assert.equal(by.annuity_savings.monthly_krw, 300_000);
  assert.equal(by.retirement_pension.monthly_krw, 0);
  assert.equal(by.isa.monthly_krw, 0);
  assert.equal(by.retirement_pension.limited_by, 'not_needed');
});

test('법정 상한을 넘는 몫은 어느 계좌에도 앉지 않고 사실로 남는다 (AC-R17)', () => {
  const r = rules();
  const ceilings = monthlyContributionCeilings(r, { isaYearsSinceOpening: 0, isaCumulativeKrw: 0 });
  const over = ceilings.total_monthly_krw + 100_000;

  const allocation = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: over,
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
  });
  assert.equal(allocation.unallocatable_monthly_krw, 100_000);
  assert.equal(allocation.exceeds_statutory_ceiling, true);
  assert.equal(allocation.allocated_monthly_total_krw, ceilings.total_monthly_krw);
});

// ── ISA를 재원으로 쓸 때의 몫 (D78 ④) ──────────────────────────────────

test('ISA 몫은 그 해의 한도와 총 납입한도의 잔여 가운데 작은 쪽이다', () => {
  const r = rules();
  const long = isaSourceMonthlyCap(r, {
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
    accumulationMonths: 240,
  });
  // 적립기가 스무 해면 총 납입한도 쪽이 문다 — 그 해의 한도보다 훨씬 작다.
  assert.equal(long.monthly_krw, Math.floor(r.isaTotalLimitKrw / 240));
  assert.equal(long.capped_by_total_contribution_limit, true);
  assert.ok(long.monthly_krw < long.annual_limit_monthly_krw);

  // 열두 달만 남았고 경과연수가 0이면 그 해의 한도가 문다.
  const short = isaSourceMonthlyCap(r, {
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
    accumulationMonths: 12,
  });
  assert.equal(short.monthly_krw, short.annual_limit_monthly_krw);
  assert.equal(short.capped_by_total_contribution_limit, false);
});

test('경계 — 총 납입한도를 다 쓰면 ISA 몫은 0이고 잔여도 0이다', () => {
  const r = rules();
  const exhausted = isaSourceMonthlyCap(r, {
    isaYearsSinceOpening: 4,
    isaCumulativeKrw: r.isaTotalLimitKrw,
    accumulationMonths: 120,
  });
  assert.equal(exhausted.remaining_total_limit_krw, 0);
  assert.equal(exhausted.monthly_krw, 0);

  // 1원이 남아도 「없다」와 「있다」는 다른 사실이다. 다만 그 1원이 월 몫을 만들지는 않는다.
  const nearly = isaSourceMonthlyCap(r, {
    isaYearsSinceOpening: 4,
    isaCumulativeKrw: r.isaTotalLimitKrw - 1,
    accumulationMonths: 120,
  });
  assert.equal(nearly.remaining_total_limit_krw, 1);
  assert.equal(nearly.monthly_krw, 0);
});

test('재원이 아니면 ISA에는 방이 없다 — 이유가 배분에 값으로 남는다', () => {
  const r = rules();
  const notSource = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: 3_000_000,
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
    isaSource: null,
  });
  const by = Object.fromEntries(notSource.allocations.map((a) => [a.account, a]));
  assert.equal(by.isa.room_monthly_krw, 0);
  assert.equal(by.isa.monthly_krw, 0);
  assert.equal(by.isa.limited_by, 'not_a_source');
  assert.equal(notSource.isa_is_source, false);
  assert.equal(notSource.source_ceiling_monthly_krw, notSource.ceilings.pension_pool_monthly_krw);
  // 세 계좌의 법정 상한 자체는 사실이므로 그대로 실려 나간다.
  assert.ok(notSource.ceilings.isa_monthly_krw > 0);
  assert.ok(notSource.unallocatable_monthly_krw > 0);
});

test('재원이면 부르는 쪽이 정한 몫까지만 앉는다', () => {
  const r = rules();
  const bounded = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: 3_000_000,
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
    isaSource: { monthly_krw: 100_000 },
  });
  const by = Object.fromEntries(bounded.allocations.map((a) => [a.account, a]));
  assert.equal(by.isa.room_monthly_krw, 100_000);
  assert.equal(by.isa.monthly_krw, 100_000);
  assert.equal(by.isa.limited_by, 'contribution_limit');
  assert.equal(
    bounded.source_ceiling_monthly_krw,
    bounded.ceilings.pension_pool_monthly_krw + 100_000,
  );
});

test('경계 — 상한과 정확히 같으면 넘지 않은 것이다', () => {
  const r = rules();
  const ceilings = monthlyContributionCeilings(r, { isaYearsSinceOpening: 0, isaCumulativeKrw: 0 });

  const exact = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: ceilings.total_monthly_krw,
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
  });
  assert.equal(exact.exceeds_statutory_ceiling, false);
  assert.equal(exact.unallocatable_monthly_krw, 0);

  const overByOne = allocateMonthlyContribution(r, {
    requiredMonthlyKrw: ceilings.total_monthly_krw + 1,
    isaYearsSinceOpening: 0,
    isaCumulativeKrw: 0,
  });
  assert.equal(overByOne.exceeds_statutory_ceiling, true);
  assert.equal(overByOne.unallocatable_monthly_krw, 1);
});
