// D26 — 공제한도를 넘은 연금 납입: 「미배분」의 갈래와 납입한도 충당안.
//
// 소유자가 지적한 것은 배분이 아니라 **이름**이었다. 연금 공제한도와 ISA 한도가 다 차면
// 나머지가 「미배분」으로 빠지는데, 사용자는 그것을 "갈 곳이 없다"로 읽는다. 세법상 사실은
// **"갈 곳은 있고, 다만 올해 공제는 늘지 않는다"**이다.
//
// 그래서 둘을 한다. (1) 미배분을 갈래로 나눠 이름을 준다. (2) 선택지를 하나 더 준다 —
// **다만 기본안으로 삼지 않는다.** 세법이 유불리를 정하지 않으므로 엔진이 고르면
// 그것이 곧 자문이다.
//
// **이 파일에는 세법 수치가 없다.** 한도는 전부 응답과 룰셋에서 읽는다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { HORIZONS } from './constants.mjs';
import { splitUnallocated } from './plans.mjs';
import {
  allocationOf,
  baseRequest,
  deepMerge,
  loadRulesets,
  planOf,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const FILL = 'pension_contribution_limit_fill';

/** 공제한도를 넘기고 ISA 한도까지 채우고도 남는 예산. 소유자가 재현한 상태다. */
const OVERFLOW = { profile: { monthly_capacity_krw: 5_000_000 } };

function scenarioFor(patch = {}) {
  const response = compute(baseRequest(deepMerge(OVERFLOW, patch)), rulesets);
  assert.equal(response.ok, true, JSON.stringify(response.errors));
  return scenarioOf(response);
}

const pensionTotal = (plan) =>
  allocationOf(plan, 'retirement_pension').annual_krw + allocationOf(plan, 'annuity_savings').annual_krw;

// ── (1) 미배분의 갈래 ────────────────────────────────────────────

test('미배분이 연금 여력 · ISA 여력 · 갈 곳 없는 몫으로 갈린다', () => {
  const scenario = scenarioFor();
  const baseline = planOf(scenario, 'max_tax_credit');
  const breakdown = baseline.unallocated_breakdown;

  assert.ok(baseline.unallocated_annual_krw > 0, '이 예산에서는 미배분이 실제로 생긴다');
  assert.equal(breakdown.total_annual_krw, baseline.unallocated_annual_krw);

  // 소유자가 본 문제의 본체 — 연금 납입 잔여한도가 남아 있는데 "갈 곳이 없다"로 읽혔다.
  assert.ok(breakdown.pension_contribution_headroom_krw > 0, '연금 납입 여력이 이름을 갖는다');
  assert.equal(
    breakdown.pension_contribution_headroom_krw,
    scenario.limits.pension_contribution_limit_remaining_krw - pensionTotal(baseline),
    '연금 여력은 배분 후 남은 납입 한도다',
  );
  assert.ok(breakdown.no_headroom_krw > 0, '정말로 갈 곳 없는 몫도 따로 이름을 갖는다');
  assert.equal(
    breakdown.pension_contribution_headroom_krw +
      breakdown.isa_contribution_headroom_krw +
      breakdown.no_headroom_krw,
    breakdown.total_annual_krw,
    '겹치지 않는 상태에서는 세 갈래의 합이 총액이다',
  );
  assert.equal(breakdown.headrooms_overlap, false);
});

test('두 여력이 같은 돈을 가리키면 겹침을 값으로 말한다 — 더하면 이중계상이다', () => {
  // **응답만으로는 이 갈래가 돌지 않는다.** 네 충당 순서가 모두 ISA를 채우므로,
  // 예산이 남았다는 것은 ISA 한도가 이미 찼다는 뜻이고 그러면 겹칠 수가 없다.
  // 돌지 않는 분기를 응답으로 시험하면 통과하면서 아무것도 막지 못하므로,
  // 산술을 직접 시험한다.
  const overlapping = splitUnallocated({ unallocated: 5, pensionRoom: 9, isaRoom: 4 });

  assert.equal(overlapping.headrooms_overlap, true);
  assert.equal(overlapping.pension_contribution_headroom_krw, 5, '미배분 전액이 연금으로 갈 수 있다');
  assert.equal(overlapping.isa_contribution_headroom_krw, 4, '같은 돈의 일부가 ISA로도 갈 수 있다');
  assert.equal(overlapping.no_headroom_krw, 0);
  assert.ok(
    overlapping.pension_contribution_headroom_krw + overlapping.isa_contribution_headroom_krw >
      overlapping.total_annual_krw,
    '두 값을 더하면 실제 돈보다 커진다 — 그래서 화면이 더하면 안 된다',
  );

  const disjoint = splitUnallocated({ unallocated: 11, pensionRoom: 9, isaRoom: 0 });
  assert.equal(disjoint.headrooms_overlap, false);
  assert.equal(disjoint.no_headroom_krw, 2);
  assert.equal(
    disjoint.pension_contribution_headroom_krw +
      disjoint.isa_contribution_headroom_krw +
      disjoint.no_headroom_krw,
    disjoint.total_annual_krw,
    '겹치지 않으면 세 갈래의 합이 총액이다',
  );

  // 여력이 아예 없으면 전부 "갈 곳 없는 몫"이다 — 그때만 「미배분」이 옛 뜻 그대로다.
  const nowhere = splitUnallocated({ unallocated: 7, pensionRoom: 0, isaRoom: 0 });
  assert.equal(nowhere.no_headroom_krw, 7);
  assert.equal(nowhere.headrooms_overlap, false);
});

test('지금의 네 충당 순서에서는 겹침이 생기지 않는다 — 그 사실을 못 박아 둔다', () => {
  // 이 진술이 깨지면 위 테스트의 전제가 낡은 것이고, 그때는 응답으로도 겹침을 시험해야 한다.
  for (const monthly of [500_000, 1_000_000, 1_500_000, 5_000_000, 30_000_000]) {
    const scenario = scenarioFor({ profile: { monthly_capacity_krw: monthly } });
    for (const plan of scenario.plans) {
      assert.equal(plan.unallocated_breakdown.headrooms_overlap, false, `${monthly} / ${plan.plan_id}`);
    }
  }
});

test('막힌 계좌의 잔여 한도를 "여력"이라고 부르지 않는다', () => {
  const scenario = scenarioFor({
    accounts: {
      retirement_pension: { annuity_start_status: 'started' },
      annuity_savings: { annuity_start_status: 'started' },
    },
  });
  for (const plan of scenario.plans) {
    assert.equal(
      plan.unallocated_breakdown.pension_contribution_headroom_krw,
      0,
      '연금수령을 개시한 계좌에는 납입할 수 없다',
    );
  }
});

// ── (2) 납입한도 충당안 ──────────────────────────────────────────

test('납입한도 충당안이 연금계좌 납입 잔여한도를 끝까지 쓴다', () => {
  const scenario = scenarioFor();
  const fill = planOf(scenario, FILL);

  assert.equal(
    pensionTotal(fill),
    scenario.limits.pension_contribution_limit_remaining_krw,
    '이 안이 채우는 것은 세액공제 한도가 아니라 납입 한도다',
  );
  assert.equal(fill.unallocated_breakdown.pension_contribution_headroom_krw, 0, '연금 여력을 남기지 않는다');
  assert.ok(
    pensionTotal(fill) > pensionTotal(planOf(scenario, 'max_tax_credit')),
    '기본안보다 연금계좌에 더 넣는다 — 그것이 이 안의 존재 이유다',
  );
});

test('이 안의 근거 이름이 세액공제를 말하지 않는다', () => {
  const fill = planOf(scenarioFor(), FILL);

  assert.equal(fill.priority_basis.code, 'pension_contribution_limit_first');
  assert.ok(
    !/credit|tax/.test(fill.priority_basis.code),
    '이름이 실제 근거를 말해야 한다 — 이 안의 근거는 납입 한도다(D17·tie_break의 연장)',
  );
  assert.deepStrictEqual(
    [...fill.priority_basis.basis_rule_ids].sort(),
    ['pension.contribution.annual_limit', 'pension.contribution.beyond_credit_limit'],
  );
  // 공제 한도가 상한이 아니었으므로 그렇게 보고해서도 안 된다.
  for (const allocation of fill.allocations) {
    assert.notEqual(allocation.limited_by, 'credit_limit');
  }
});

test('납입한도 충당안은 어떤 자금 사용 시점에서도 기본안이 되지 않는다', () => {
  for (const horizon of HORIZONS) {
    const scenario = scenarioFor({ profile: { fund_use_horizon: horizon } });
    assert.notEqual(scenario.plans[0].plan_id, FILL, horizon);
    assert.equal(planOf(scenario, FILL).is_baseline, false, horizon);
  }
});

test('더 넣는다고 올해 세액공제가 늘지는 않는다 — 그 사실이 값으로 드러난다', () => {
  const scenario = scenarioFor();
  const baseline = planOf(scenario, 'max_tax_credit');
  const fill = planOf(scenario, FILL);

  assert.equal(
    fill.deterministic_benefit.pension_credit_total_krw,
    baseline.deterministic_benefit.pension_credit_total_krw,
    '납입을 늘려도 올해의 공제는 그대로다',
  );
  assert.equal(fill.delta_vs_baseline_krw, 0);
  assert.equal(
    fill.pension_combined_credit_remaining_after_plan_krw,
    0,
    '배분 후 잔여 공제 한도가 0이라는 사실이 "더 넣어도 공제는 안 는다"의 근거다',
  );
});

test('인출 편의를 위해 확정 세액을 깎지 않는다', () => {
  // 동점 규칙은 "비용이 0"일 때만 옳다. 이 안은 연금저축 단독 공제한도를 넘겨 채우므로
  // 연금저축을 앞세우면 인정 납입액이 실제로 줄어든다 — 동점이 아니다.
  const scenario = scenarioFor();
  const fill = planOf(scenario, FILL);

  assert.equal(fill.priority_basis.tie_break.code, 'not_applicable');
  assert.deepStrictEqual(fill.priority_basis.fill_sequence, [
    'retirement_pension',
    'annuity_savings',
    'isa',
  ]);
  assert.equal(
    fill.deterministic_benefit.pension_credit_total_krw,
    planOf(scenario, 'max_tax_credit').deterministic_benefit.pension_credit_total_krw,
  );
});

// ── (3) 함께 나가야 하는 세 사실 ─────────────────────────────────

test('공제 없는 납입에는 세 사실이 반드시 함께 나간다', () => {
  const fill = planOf(scenarioFor(), FILL);
  const effect = fill.non_quantified_effects.find((e) => e.code === 'pension_contribution_without_credit');

  assert.ok(effect, '납입 한도까지 채웠으면 공제를 낳지 않는 몫이 있다');
  assert.equal(effect.quantifiable, false);
  assert.equal(effect.reason_code, 'benefit_depends_on_return_horizon_and_withdrawal_form_not_in_ruleset');

  // ① 공제 안 받은 원금은 인출 시 비과세다.
  assert.equal(effect.facts.principal_taxed_on_withdrawal, false);
  // ② 다만 세무서 확인서를 금융회사에 내야 하고 확인받은 날부터 적용된다(소급 안 됨).
  //    이것이 빠지면 화면이 "나중에 비과세로 돌아옵니다"를 쓰게 되고 그 문장은 거짓이다.
  assert.equal(effect.facts.principal_tax_free_requires_confirmation, true);
  assert.equal(effect.facts.principal_tax_free_confirmation_prospective_only, true);
  // ③ 그 돈이 번 수익에는 인출 시 세금이 붙는다.
  assert.equal(effect.facts.returns_taxed_on_withdrawal, true);

  assert.equal(effect.facts.credit_this_year_krw, 0);
  assert.ok(effect.facts.contribution_without_credit_krw > 0);
  assert.deepStrictEqual([...effect.basis_rule_ids].sort(), [
    'pension.contribution.beyond_credit_limit',
    'pension.withdrawal.non_deducted_principal',
  ]);
});

test('이월 전환특례를 이 안의 근거로 쓰지 않는다', () => {
  // 전환금액이 전환 연도의 공제한도를 그 해 새 납입액과 나눠 쓰므로, 매년 한도를
  // 채우는 사람에게는 전환할 자리가 없다. 근거로 인용하면 거짓 권유가 된다.
  const fill = planOf(scenarioFor(), FILL);
  const effect = fill.non_quantified_effects.find((e) => e.code === 'pension_contribution_without_credit');

  assert.equal(effect.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'), false);
  assert.equal(
    fill.priority_basis.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'),
    false,
  );
});

test('공제 한도까지만 채우는 안에는 이 효과가 붙지 않는다', () => {
  const scenario = scenarioFor();
  for (const planId of ['max_tax_credit', 'annuity_savings_first', 'isa_first']) {
    const plan = scenario.plans.find((p) => p.plan_id === planId);
    if (!plan) continue;
    assert.equal(
      plan.non_quantified_effects.some((e) => e.code === 'pension_contribution_without_credit'),
      false,
      planId,
    );
  }
});

// ── (4) 전환 특례에 붙은 조건 둘 ─────────────────────────────────

test('전환 가능 표시에 조건 둘이 함께 나간다', () => {
  // 세액 한도가 공제액을 자르는 상태를 만든다.
  const scenario = scenarioFor({
    profile: {
      monthly_capacity_krw: 1_000_000,
      prior_year_tax: { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
    },
  });
  const cap = planOf(scenario, 'max_tax_credit').deterministic_benefit.tax_liability_cap;

  assert.equal(cap.applied, true);
  assert.equal(cap.contribution_carryover_available, true);
  assert.equal(
    cap.carryover_shares_future_year_credit_limit,
    true,
    '전환금액도 전환한 해의 공제한도를 그 해 새 납입액과 나눠 쓴다',
  );
  assert.equal(cap.carryover_requires_application, true, '신청주의다 — 자동이 아니다');
});

test('전환이 걸리지 않는 안에서는 조건을 주장하지 않는다', () => {
  const cap = planOf(scenarioFor(), 'max_tax_credit').deterministic_benefit.tax_liability_cap;

  assert.equal(cap.applied, false);
  assert.equal(cap.contribution_carryover_available, false);
  assert.equal(cap.carryover_shares_future_year_credit_limit, null, '읽지 않은 규칙을 주장하지 않는다');
  assert.equal(cap.carryover_requires_application, null);
});
