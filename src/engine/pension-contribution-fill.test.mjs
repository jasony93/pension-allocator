// D26·D32 — 공제한도를 넘은 연금 납입: 「미배분」의 갈래와 ISA와의 선후.
//
// **D26에서 소유자가 지적한 것은 배분이 아니라 이름이었다.** 연금 공제한도와 ISA 한도가
// 다 차면 나머지가 「미배분」으로 빠지는데, 사용자는 그것을 "갈 곳이 없다"로 읽는다.
// 세법상 사실은 **"갈 곳은 있고, 다만 올해 공제는 늘지 않는다"**이다. 그래서 미배분을
// 갈래로 나누고, 납입 한도까지 채우는 배분안을 **선택지로** 하나 더 주었다.
//
// **D32에서 소유자가 배분 자체를 바꿨다.** 기본안의 충당 순서에 3단계(연금 납입 한도)가
// 붙어 이제 네 안이 전부 납입 한도까지 채운다. 그러므로 이 파일이 검사하는 것도 바뀐다 —
// "그 안만 납입 한도를 채운다"가 아니라 **"기본안도 채우고, ISA와의 선후만 갈린다"**이다.
//
// 관리자 판정이 못 박은 두 가지를 여기서 함께 지킨다.
//   · **ISA가 3단계보다 앞이다.** 뒤집으면 사용자가 실제로 잃는다.
//   · **이름이 "유리하다"로 바뀌지 않는다.** 소유자가 배분을 정한 것이지
//     세법이 유불리를 정한 것이 아니다.
//
// **이 파일에는 세법 수치가 없다.** 한도는 전부 응답과 룰셋에서 읽는다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { HORIZONS } from './constants.mjs';
import { splitUnallocated } from './plans.mjs';
import {
  CAP_COORDINATES,
  allocationOf,
  baseRequest,
  deepMerge,
  loadRulesets,
  planOf,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const BEFORE_ISA = 'pension_contribution_before_isa';

/**
 * 연금 공제한도와 ISA 한도를 채우고도 **3단계가 받을 몫이 남는** 예산.
 *
 * **D32로 이 값을 낮췄다.** 예전 값(월 500만)에서는 네 안이 전부 같은 곳에 도달해
 * 하나로 합쳐지므로, 안들이 갈리는 것을 시험할 수가 없다. 여기서는 기본안이
 * 3단계 몫을 실제로 받으면서(관리자가 요구한 상태) 반대 순서 안과 갈린다.
 */
const OVERFLOW = { profile: { monthly_capacity_krw: 4_500_000 } };

function scenarioFor(patch = {}) {
  const response = compute(baseRequest(deepMerge(OVERFLOW, patch)), rulesets);
  assert.equal(response.ok, true, JSON.stringify(response.errors));
  return scenarioOf(response);
}

const pensionTotal = (plan) =>
  allocationOf(plan, 'retirement_pension').annual_krw + allocationOf(plan, 'annuity_savings').annual_krw;

// ── (1) 미배분의 갈래 ────────────────────────────────────────────

test('D32 — 응답의 미배분에는 이제 여력 갈래가 남지 않는다. 그 사실을 못 박는다', () => {
  // **D26의 갈래 나누기가 응답에서 어떻게 바뀌었는지를 기록한다.**
  //
  // 소유자가 본 문제는 "연금 납입 여력이 남았는데 미배분으로 빠진다"였다. D32의
  // 충당 순서는 그 여력을 먼저 쓰므로, **미배분이 남았다는 것은 곧 모든 한도가 찼다는
  // 뜻**이 됐다. 그래서 응답에서는 두 여력 갈래가 언제나 0이고 전액이
  // `no_headroom_krw`다 — 소유자가 본 상태가 실제로 사라진 것이다.
  //
  // **필드를 지우지 않는 이유는 계약 5.13절과 같다.** 화면은 두 값을 더해도 되는지를
  // 규약이 아니라 데이터로 알아야 하고, 충당 순서가 다시 바뀌면 이 값들은 그날부터
  // 다시 참이 된다. 산술 자체는 아래 `splitUnallocated` 시험이 직접 본다.
  for (const monthly of [500_000, 1_500_000, 3_000_000, 4_500_000, 10_000_000, 30_000_000]) {
    const scenario = scenarioFor({ profile: { monthly_capacity_krw: monthly } });
    for (const plan of scenario.plans) {
      const breakdown = plan.unallocated_breakdown;
      const at = `${monthly} / ${plan.plan_id}`;
      assert.equal(breakdown.total_annual_krw, plan.unallocated_annual_krw, at);
      assert.equal(
        breakdown.pension_contribution_headroom_krw +
          breakdown.isa_contribution_headroom_krw +
          breakdown.no_headroom_krw,
        breakdown.total_annual_krw,
        `${at}: 겹치지 않는 상태에서는 세 갈래의 합이 총액이다`,
      );
      assert.equal(breakdown.headrooms_overlap, false, at);
      assert.equal(
        breakdown.no_headroom_krw,
        breakdown.total_annual_krw,
        `${at}: 미배분이 남았는데 갈 곳이 있다고 말한다 — 충당 순서가 여력을 안 쓴 것이다`,
      );
    }
  }
});

test('D32 — 정말로 갈 곳이 없는 미배분은 결함이 아니다', () => {
  // 예산이 **연금 납입 한도 + ISA 한도**를 전부 넘으면 그때의 미배분은 진짜다.
  // 소유자의 지시는 "미배분이 **최대한** 없도록"이지 "0으로 만들라"가 아니고,
  // 갈래 나누기가 그 상태를 정직하게 말한다.
  const scenario = scenarioFor({ profile: { monthly_capacity_krw: 10_000_000 } });
  const baseline = scenario.plans[0];
  const breakdown = baseline.unallocated_breakdown;

  assert.equal(
    pensionTotal(baseline),
    scenario.limits.pension_contribution_limit_remaining_krw,
    '연금은 납입 한도까지 찼다',
  );
  assert.ok(breakdown.total_annual_krw > 0, '그러고도 남는 돈이 있다');
  assert.equal(breakdown.pension_contribution_headroom_krw, 0);
  assert.equal(breakdown.isa_contribution_headroom_krw, 0);
  assert.equal(
    breakdown.no_headroom_krw,
    breakdown.total_annual_krw,
    '남은 전액이 갈 곳 없는 몫이다 — 없는 여력을 지어내지 않는다',
  );
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

// ── (2) 기본안이 연금 납입 한도까지 채운다 (D32) ─────────────────

test('D32 — 기본안이 연금계좌 납입 잔여한도를 끝까지 쓴다', () => {
  // 예산이 **연금 공제한도 + ISA 한도 + 남은 연금 납입 한도**를 모두 덮는 구간에서만
  // 3단계가 끝까지 간다. ISA가 앞이므로 그 아래 구간에서는 ISA가 먼저 가져간다 —
  // 그것이 소유자가 정한 순서이고, 여기서 확인하려는 것은 **3단계가 실재한다**는 것이다.
  const scenario = scenarioFor({ profile: { monthly_capacity_krw: 5_000_000 } });
  const baseline = scenario.plans[0];

  assert.equal(baseline.plan_id, 'max_tax_credit');
  assert.equal(
    pensionTotal(baseline),
    scenario.limits.pension_contribution_limit_remaining_krw,
    '기본안의 상한이 세액공제 한도에서 납입 한도로 옮겨졌다 — 소유자 결정(D32)',
  );
  assert.equal(
    baseline.unallocated_breakdown.pension_contribution_headroom_krw,
    0,
    '연금 여력을 남기지 않는다',
  );
});

test('D32 — ISA가 3단계보다 먼저다. 뒤집으면 사용자가 잃는다', () => {
  // 예산이 연금 공제한도 + ISA 한도 + 연금 납입 잔여를 다 채우지 못하는 구간에서만
  // 이 순서가 결과를 바꾼다. 그 구간을 골라 **ISA가 먼저 찼는지**를 본다.
  const scenario = scenarioFor({ profile: { monthly_capacity_krw: 3_000_000 } });
  const baseline = scenario.plans[0];
  const isaLimit = scenario.limits.by_account.find((l) => l.account === 'isa')
    .contribution_limit_remaining_krw;
  const combined = scenario.limits.pension_combined_credit_limit_krw;
  const budget = scenario.plans[0].total_allocated_annual_krw + baseline.unallocated_annual_krw;

  assert.ok(
    budget > combined && budget < combined + isaLimit + scenario.limits.pension_contribution_limit_remaining_krw,
    '이 예산이 순서가 실제로 갈리는 구간 안에 있어야 이 검사가 무언가를 막는다',
  );
  assert.equal(
    allocationOf(baseline, 'isa').annual_krw,
    Math.min(isaLimit, budget - combined),
    'ISA가 3단계보다 먼저 찬다 — 순서를 뒤집으면 이 값이 줄어든다',
  );

  // 반대 순서의 안은 같은 예산에서 ISA에 덜 넣는다. 그것이 두 안의 유일한 차이다.
  const beforeIsa = planOf(scenario, BEFORE_ISA);
  assert.ok(
    allocationOf(beforeIsa, 'isa').annual_krw < allocationOf(baseline, 'isa').annual_krw,
    '두 안이 갈리는 지점은 ISA 배분액이다',
  );
  assert.equal(
    beforeIsa.deterministic_benefit.pension_credit_total_krw,
    baseline.deterministic_benefit.pension_credit_total_krw,
    '선후를 바꿔도 올해의 공제는 같다 — 그래서 세법이 이 선후를 정하지 못한다',
  );
});

test('반대 순서 안의 이름이 무엇이 다른지를 말한다 — 세액공제를 말하지 않는다', () => {
  const beforeIsa = planOf(scenarioFor(), BEFORE_ISA);

  assert.equal(beforeIsa.plan_id, 'pension_contribution_before_isa');
  assert.equal(beforeIsa.priority_basis.code, 'pension_contribution_limit_before_isa');
  // **개명의 이유가 이것이다.** 옛 이름(`pension_contribution_limit_fill`)이 말하던
  // "납입 한도를 채운다"는 이제 네 안이 전부 한다. 남은 차이는 ISA와의 선후뿐이고,
  // 이름이 실제 차이를 말하지 않으면 선택지가 있는 척하는 것이 된다.
  assert.ok(
    /before_isa/.test(beforeIsa.priority_basis.code),
    '이름이 다른 안과의 실제 차이(ISA와의 선후)를 말해야 한다',
  );
  assert.ok(
    !/credit|tax/.test(beforeIsa.priority_basis.code),
    '소유자가 배분을 정한 것이지 세법이 유불리를 정한 것이 아니다',
  );
  assert.deepStrictEqual([...beforeIsa.priority_basis.basis_rule_ids].sort(), [
    'pension.contribution.annual_limit',
    'pension.contribution.beyond_credit_limit',
    // 무엇을 채우는가가 아니라 **그 안에서 어느 계좌를 먼저 채우는가**의 근거다.
    'pension.withdrawal.midterm_restriction',
  ]);
  assert.equal(
    beforeIsa.priority_basis.basis_rule_ids.includes('pension.credit.limit.combined'),
    false,
    '세액공제 한도를 이 안의 근거로 들지 않는다',
  );
});

test('D32 — 기본안의 근거가 3단계 몫의 실제 근거를 함께 싣는다', () => {
  // 관리자 판정: **3단계 몫의 근거는 세액공제가 아니다.** 그 몫이 기본안에 실렸으므로
  // 기본안의 `priority_basis`도 그 근거를 말해야 한다. `code`는 그대로 둔다 —
  // 기본안이 됐다고 이름이 "유리하다"로 바뀌면 안 된다.
  const baseline = scenarioFor().plans[0];

  assert.equal(baseline.priority_basis.code, 'tax_credit_maximization', '이름을 바꾸지 않는다');
  for (const ruleId of [
    'pension.contribution.annual_limit',
    'pension.contribution.beyond_credit_limit',
    'pension.withdrawal.midterm_restriction',
  ]) {
    assert.ok(
      baseline.priority_basis.basis_rule_ids.includes(ruleId),
      `기본안이 3단계 몫의 근거 ${ruleId}를 싣지 않는다 — 화면이 근거를 보일 수 없다`,
    );
  }
});

test('ISA를 뒤로 미루는 안은 어떤 자금 사용 시점에서도 기본안이 되지 않는다', () => {
  // 소유자가 정한 순서는 ISA가 먼저다. 그 반대 순서를 엔진이 기본으로 올리면
  // 소유자가 정하지 않은 것을 엔진이 고른 것이 된다.
  for (const horizon of HORIZONS) {
    const scenario = scenarioFor({ profile: { fund_use_horizon: horizon } });
    assert.notEqual(scenario.plans[0].plan_id, BEFORE_ISA, horizon);
    assert.equal(planOf(scenario, BEFORE_ISA).is_baseline, false, horizon);
  }
});

test('더 넣는다고 올해 세액공제가 늘지는 않는다 — 그 사실이 값으로 드러난다', () => {
  const scenario = scenarioFor();
  const baseline = planOf(scenario, 'max_tax_credit');
  const beforeIsa = planOf(scenario, BEFORE_ISA);

  assert.equal(
    beforeIsa.deterministic_benefit.pension_credit_total_krw,
    baseline.deterministic_benefit.pension_credit_total_krw,
    '납입을 늘려도, 순서를 바꿔도 올해의 공제는 그대로다',
  );
  assert.equal(beforeIsa.delta_vs_baseline_krw, 0);
  for (const plan of [baseline, beforeIsa]) {
    assert.equal(
      plan.pension_combined_credit_remaining_after_plan_krw,
      0,
      '배분 후 잔여 공제 한도가 0이라는 사실이 "더 넣어도 공제는 안 는다"의 근거다',
    );
  }
});

test('비용이 0인 구간에서는 인출이 자유로운 계좌를 먼저 채운다', () => {
  // **비용이 0인 구간이 실재하고 그 폭이 넓다.** 조문 산식
  // `대상액 = min( min(연금저축, 단독한도) + 퇴직연금, 합산한도 )`에서, 퇴직연금이
  // `합산한도 − 단독한도`만큼만 받으면 나머지를 전부 연금저축에 넣어도 인정액이 최대다.
  // 그 구간에서는 세액이 순서를 정하지 못하므로 D18의 원칙(인출 자유 우선)이 선다.
  //
  // **D32로 이 검사의 대상이 기본안이 됐다.** 예전에는 배분안 하나만 이 구간에 들어갔고
  // 지금은 대다수 사용자가 기본안에서 그 몫을 받는다.
  const scenario = scenarioFor();
  const baseline = planOf(scenario, 'max_tax_credit');
  const beforeIsa = planOf(scenario, BEFORE_ISA);

  for (const plan of [baseline, beforeIsa]) {
    assert.equal(plan.priority_basis.tie_break.code, 'withdrawal_flexibility_first');
    // 3단계 몫이 인출이 자유로운 계좌로 갔는지는 **어느 계좌에 그 몫이 있는가**로 본다.
    // `fill_sequence`는 실제로 돈이 들어간 순서라 1차에 공제 여력이 0이던 계좌가
    // 3차에 더 받으면서도 뒤에 올 수 있다.
    const effects = plan.non_quantified_effects.filter(
      (e) => e.code === 'pension_contribution_without_credit',
    );
    assert.ok(effects.length > 0, `${plan.plan_id}: 이 예산에서는 공제를 낳지 않는 몫이 있다`);
    for (const effect of effects) {
      assert.equal(
        effect.account,
        'annuity_savings',
        `${plan.plan_id}: 비용이 0인데 인출이 어려운 쪽을 고르면 아무 대가 없이 나쁜 선택이다`,
      );
    }
  }

  // 두 안의 세액이 같다 — 인출 편의를 위해서도, ISA와의 선후 때문에도 확정 세액을 깎지 않았다.
  assert.equal(
    beforeIsa.deterministic_benefit.pension_credit_total_krw,
    baseline.deterministic_benefit.pension_credit_total_krw,
  );
  assert.equal(
    beforeIsa.deterministic_benefit.credit_eligible_contribution_krw,
    baseline.deterministic_benefit.credit_eligible_contribution_krw,
    '인정 납입액도 같아야 비용이 0이다',
  );

  // 두 연금계좌 중 인출이 자유로운 쪽이 더 많이 받는다.
  assert.ok(
    allocationOf(baseline, 'annuity_savings').annual_krw >
      allocationOf(baseline, 'retirement_pension').annual_krw,
    '동점 구간에서 더 묶이는 계좌를 앞세우면 대가 없이 나쁜 선택이다',
  );
});

test('비용이 0인 구간의 경계를 조문 산식으로 다시 잰다', () => {
  // 경계는 연금저축 단독 공제한도가 아니라 **납입한도 − (합산한도 − 단독한도)**다.
  // 엔진이 그 경계를 정확히 짚는지, 그리고 한 원만 넘겨도 세액이 깎이는지 본다.
  // 연금 납입 한도가 실제로 다 차는 예산에서 재야 경계가 드러난다.
  const scenario = scenarioFor({ profile: { monthly_capacity_krw: 5_000_000 } });
  const limits = scenario.limits;
  const annuityCreditLimit = limits.by_account.find((l) => l.account === 'annuity_savings')
    .credit_eligible_limit_remaining_krw;
  const combined = limits.pension_combined_credit_limit_krw;
  const pool = limits.pension_contribution_limit_remaining_krw;

  const plan = scenario.plans[0];
  const annuity = allocationOf(plan, 'annuity_savings').annual_krw;
  const irp = allocationOf(plan, 'retirement_pension').annual_krw;

  assert.equal(annuity + irp, pool, '연금 납입 총액은 순서와 무관하게 납입 한도다');
  assert.equal(
    irp,
    combined - annuityCreditLimit,
    'IRP는 연금저축이 단독 한도 때문에 흡수하지 못하는 몫만 받는다',
  );
  assert.equal(annuity, pool - (combined - annuityCreditLimit), '나머지는 전부 연금저축이다');

  // 경계 밖 — 조문 산식으로 직접 계산해 세액이 실제로 깎이는 것을 확인한다.
  const eligibleFor = (a) => Math.min(Math.min(a, annuityCreditLimit) + (pool - a), combined);
  assert.equal(eligibleFor(annuity), combined, '경계 위에서는 인정액이 최대다');
  assert.ok(eligibleFor(annuity + 1) < combined, '경계를 한 원 넘기면 인정액이 줄어든다');
  assert.equal(
    plan.deterministic_benefit.credit_eligible_contribution_krw,
    combined,
    '엔진이 낸 인정액이 그 최대값과 같다',
  );
});

// ── (3) 함께 나가야 하는 세 사실 ─────────────────────────────────

test('D32 — 공제 없는 납입에는 세 사실이 반드시 함께 나간다. 이제 기본안에서도', () => {
  // **관리자 판정이 명시한 자리다.** 예전엔 별도 배분안에만 붙던 사실 셋인데
  // 대다수 사용자가 그 몫을 기본안에서 받게 되므로, 기본안에서도 나와야 한다.
  const baseline = scenarioFor().plans[0];
  const effect = baseline.non_quantified_effects.find(
    (e) => e.code === 'pension_contribution_without_credit',
  );

  assert.ok(effect, '기본안이 납입 한도까지 채웠으면 공제를 낳지 않는 몫이 있다');
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

test('이월 전환특례를 이 몫의 근거로 쓰지 않는다 — 네 안 어디에서도', () => {
  // 전환금액이 전환 연도의 공제한도를 그 해 새 납입액과 나눠 쓰므로, 매년 한도를
  // 채우는 사람에게는 전환할 자리가 없다. 근거로 인용하면 거짓 권유가 된다.
  for (const plan of scenarioFor().plans) {
    for (const effect of plan.non_quantified_effects) {
      assert.equal(
        effect.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'),
        false,
        plan.plan_id,
      );
    }
    assert.equal(
      plan.priority_basis.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'),
      false,
      plan.plan_id,
    );
  }
});

test('D32 — 세 사실이 네 안 전부에 붙는다. 어느 안에서도 빠지지 않는다', () => {
  const scenario = scenarioFor();
  assert.ok(scenario.plans.length > 1, '이 예산에서는 배분안이 여럿 남는다');

  for (const plan of scenario.plans) {
    const pension = pensionTotal(plan);
    const eligible = plan.deterministic_benefit.credit_eligible_contribution_krw;
    const effects = plan.non_quantified_effects.filter(
      (e) => e.code === 'pension_contribution_without_credit',
    );
    // 공제를 낳지 않는 몫이 실제로 있는 안에서만 붙어야 하고, 있으면 반드시 붙어야 한다.
    if (pension > eligible) {
      assert.ok(effects.length > 0, `${plan.plan_id}: 공제 없는 납입이 있는데 사실이 안 나간다`);
      for (const effect of effects) {
        assert.equal(effect.facts.principal_taxed_on_withdrawal, false, plan.plan_id);
        assert.equal(effect.facts.principal_tax_free_requires_confirmation, true, plan.plan_id);
        assert.equal(
          effect.facts.principal_tax_free_confirmation_prospective_only,
          true,
          plan.plan_id,
        );
        assert.equal(effect.facts.returns_taxed_on_withdrawal, true, plan.plan_id);
      }
    }
  }
});

// ── (4) 전환 특례에 붙은 조건 둘 ─────────────────────────────────

test('전환 가능 표시에 조건 둘이 함께 나간다', () => {
  // 세액 한도가 공제액을 자르는 상태를 만든다.
  const scenario = scenarioFor({
    profile: {
      monthly_capacity_krw: 1_000_000,
      // 추정 한도가 공제액을 자르는 총급여(D40의 검산 좌표).
      current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
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
