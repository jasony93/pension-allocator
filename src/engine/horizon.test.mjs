// 자금 사용 시점이 무엇을 바꾸고 무엇을 바꾸지 않는가.
//
// **D10이 D52 2번으로 뒤집혔다.** 「자금 사용 시점은 금액을 바꾸지 않는다」는 이제
// **세 값에서만** 참이다 — `within_isa_lock_in`이면 전액 미배분이다. 그래서 이 파일의
// 금액 불변 시험은 그 값을 빼고 돌고, 뺀 값에 대해서는 **전액 미배분이라는 사실 자체**를
// 따로 잠근다. **잠금을 푼 것이 아니라 옮긴 것이다.**

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { loadRulesets, baseRequest, scenarioOf, planOf, allocationOf } from './test-helpers.mjs';

const rulesets = loadRulesets();

const HORIZONS = ['within_isa_lock_in', 'before_pension_age', 'at_or_after_pension_age', 'unknown'];

/** 금액이 서로 같아야 하는 값들. `within_isa_lock_in`만 그 밖이다(D52 2번). */
const AMOUNT_STABLE_HORIZONS = HORIZONS.filter((horizon) => horizon !== 'within_isa_lock_in');

/** 금액만 뽑는다. 순서·경고·기본안 표시는 일부러 제외한다. */
function amountsOf(scenario) {
  return {
    plans: scenario.plans.map((plan) => ({
      allocations: plan.allocations.map((a) => [
        a.account,
        a.annual_krw,
        a.monthly_krw,
        a.fill_order,
        a.limited_by,
      ]),
      benefit: plan.deterministic_benefit,
      total_allocated_annual_krw: plan.total_allocated_annual_krw,
      unallocated_annual_krw: plan.unallocated_annual_krw,
      monthly_rounding_residual_krw: plan.monthly_rounding_residual_krw,
    })),
    limits: scenario.limits,
  };
}

test('세 값에서 배분 금액과 세액공제액이 동일하다 — 전액 미배분 시점만 그 밖이다', () => {
  const budgets = [0, 300_000, 900_000, 5_000_000];
  const planIds = ['max_tax_credit', 'annuity_savings_first', 'isa_first'];

  // 배분안을 하나씩 요청한다. 그래야 "같은 벡터를 합치는" 동작이 끼어들지 않고
  // 같은 배분안끼리 금액을 직접 맞대볼 수 있다.
  for (const planId of planIds) {
    for (const monthly of budgets) {
      const results = AMOUNT_STABLE_HORIZONS.map((horizon) =>
        amountsOf(
          scenarioOf(
            compute(
              baseRequest({
                profile: { monthly_capacity_krw: monthly, fund_use_horizon: horizon },
                options: { plan_variants: [planId] },
              }),
              rulesets,
            ),
          ),
        ),
      );

      for (let i = 1; i < results.length; i += 1) {
        assert.deepStrictEqual(
          results[i],
          results[0],
          `${planId} / 월 여력 ${monthly}원에서 ${AMOUNT_STABLE_HORIZONS[i]}의 금액이 ` +
            `${AMOUNT_STABLE_HORIZONS[0]}과 다르다`,
        );
      }
    }
  }
});

test('세 배분안을 함께 요청해도 금액의 집합이 자금 사용 시점에 흔들리지 않는다', () => {
  const canonical = (scenario) =>
    scenario.plans
      .map((plan) =>
        JSON.stringify([
          plan.allocations.map((a) => [a.account, a.annual_krw]),
          plan.deterministic_benefit.pension_credit_total_krw,
        ]),
      )
      .sort();

  for (const monthly of [300_000, 5_000_000]) {
    const sets = AMOUNT_STABLE_HORIZONS.map((horizon) =>
      canonical(
        scenarioOf(
          compute(
            baseRequest({ profile: { monthly_capacity_krw: monthly, fund_use_horizon: horizon } }),
            rulesets,
          ),
        ),
      ),
    );
    for (let i = 1; i < sets.length; i += 1) {
      assert.deepStrictEqual(
        sets[i],
        sets[0],
        `월 여력 ${monthly}원에서 ${AMOUNT_STABLE_HORIZONS[i]}의 금액 집합이 다르다`,
      );
    }
  }
});

test('계약이 스스로 선언한다 — echo.fund_use_horizon_affects', () => {
  for (const horizon of HORIZONS) {
    const response = compute(baseRequest({ profile: { fund_use_horizon: horizon } }), rulesets);
    assert.equal(response.ok, true);
    assert.equal(response.echo.fund_use_horizon, horizon);
    assert.deepStrictEqual(response.echo.fund_use_horizon_affects, {
      // **`12.0.0`에서 앞의 두 값이 뒤집혔다**(D52 2번). 이 객체는 「이 요청에서
      // 달라졌는가」가 아니라 **「이 입력이 무엇을 바꿀 수 있는가」**를 말한다.
      allocation_amounts: true,
      tax_credit_amounts: true,
      limits: false,
      plan_ordering: true,
      baseline_selection: true,
      warnings: true,
    });
  }
});

test('기본안은 자금 사용 시점이 정하고 언제나 plans[0]이다', () => {
  const expected = {
    at_or_after_pension_age: 'max_tax_credit',
    unknown: 'max_tax_credit',
    before_pension_age: 'isa_first',
    within_isa_lock_in: 'max_tax_credit',
  };

  for (const [horizon, planId] of Object.entries(expected)) {
    const scenario = scenarioOf(
      compute(
        baseRequest({ profile: { fund_use_horizon: horizon, monthly_capacity_krw: 300_000 } }),
        rulesets,
      ),
    );

    assert.equal(scenario.plans[0].plan_id, planId, `${horizon}의 기본안이 다르다`);
    assert.equal(scenario.plans[0].is_baseline, true);
    assert.equal(scenario.plans.filter((p) => p.is_baseline).length, 1);
  }
});

test('within_isa_lock_in — 전액 미배분이고, 그 이유가 값으로 나간다 (D52 2번)', () => {
  const request = baseRequest({
    profile: { fund_use_horizon: 'within_isa_lock_in', monthly_capacity_krw: 300_000 },
  });
  const locked = scenarioOf(compute(request, rulesets));

  // 벡터가 전부 같아지므로 안이 하나로 합쳐진다 — 비교할 것이 남지 않는다.
  assert.equal(locked.plans.length, 1);
  const plan = locked.plans[0];
  assert.equal(plan.plan_id, 'max_tax_credit');

  for (const allocation of plan.allocations) {
    assert.equal(allocation.annual_krw, 0, `${allocation.account}에 돈이 들어갔다`);
    assert.equal(allocation.monthly_krw, 0, `${allocation.account}의 월 금액이 0이 아니다`);
    assert.equal(allocation.fill_order, null);
    assert.equal(
      allocation.limited_by,
      'fund_use_horizon',
      `${allocation.account}: 막은 것이 자금 사용 시점이라고 말하지 않는다`,
    );
  }

  assert.equal(plan.unallocated_annual_krw, 300_000 * 12);
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 0);

  // **「한도가 없어서」가 아니다.** 그 구분이 이 회차의 요지다.
  assert.equal(
    plan.unallocated_breakdown.reason_code,
    'no_account_beneficial_within_fund_use_horizon',
  );
  // 한도는 멀쩡히 남아 있고, 그 사실이 값으로 함께 나간다 — 두 여력이 겹친다.
  assert.ok(plan.unallocated_breakdown.pension_contribution_headroom_krw > 0);
  assert.ok(plan.unallocated_breakdown.isa_contribution_headroom_krw > 0);
  assert.equal(plan.unallocated_breakdown.headrooms_overlap, true);
  assert.equal(plan.unallocated_breakdown.no_headroom_krw, 0);

  // 판정의 근거가 근거 목록에 실린다. 세 계좌 각각의 불이익 조문이다.
  for (const ruleId of [
    'isa.account.requirements',
    'isa.early_termination.clawback',
    'pension.early_withdrawal.other_income_rate',
  ]) {
    assert.ok(
      plan.unallocated_breakdown.basis_rule_ids.includes(ruleId),
      `근거에 ${ruleId}가 없다`,
    );
  }

  assert.ok(locked.comparison_note_codes.includes('all_accounts_have_early_exit_penalty'));
  assert.equal(locked.comparison_note_codes.includes('baseline_reordered_by_fund_use_horizon'), false);
  // **「예산이 한도를 넘는다」고 말하지 않는다.** 한도는 남아 있다.
  assert.equal(
    locked.notices.some((n) => n.code === 'budget_exceeds_all_limits'),
    false,
  );
});

test('within_isa_lock_in — 「시점은 금액에 반영하지 않는다」는 가정을 더는 싣지 않는다', () => {
  const codesFor = (horizon) =>
    compute(
      baseRequest({ profile: { fund_use_horizon: horizon, monthly_capacity_krw: 300_000 } }),
      rulesets,
    ).assumptions.map((a) => a.code);

  assert.equal(
    codesFor('within_isa_lock_in').includes('fund_use_horizon_excluded_from_amounts'),
    false,
  );
  for (const horizon of AMOUNT_STABLE_HORIZONS) {
    assert.ok(
      codesFor(horizon).includes('fund_use_horizon_excluded_from_amounts'),
      `${horizon}에서 여전히 참인 가정이 사라졌다`,
    );
  }
});

test('전액 미배분 판정은 룰셋에서 온다 — 근거 규칙을 지우면 계산이 멈춘다', () => {
  // **주입.** 판정의 근거를 코드가 들고 있으면 룰셋을 지워도 답이 그대로 나온다.
  // 그 상태에서는 「조문에서 왔다」가 거짓이다.
  for (const ruleId of [
    'isa.account.requirements',
    'isa.early_termination.clawback',
    'pension.early_withdrawal.other_income_rate',
  ]) {
    const stripped = structuredClone(rulesets);
    for (const doc of Object.values(stripped)) {
      doc.rules = doc.rules.filter((r) => r.id !== ruleId);
    }
    const response = compute(
      baseRequest({ profile: { fund_use_horizon: 'within_isa_lock_in' } }),
      stripped,
    );
    assert.equal(response.ok, false, `${ruleId}를 지웠는데도 계산이 끝났다`);
    assert.ok(
      response.errors.some((e) => e.code === 'rule_missing' && e.params.rule_id === ruleId),
      `${ruleId}가 없는데 다른 이유로 멈췄다`,
    );
  }
});

test('before_pension_age — 기본안이 바뀌었다는 사실이 안내 코드로 나간다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { fund_use_horizon: 'before_pension_age', monthly_capacity_krw: 300_000 },
      }),
      rulesets,
    ),
  );

  assert.ok(scenario.comparison_note_codes.includes('baseline_reordered_by_fund_use_horizon'));
  assert.equal(scenario.comparison_note_codes.includes('all_accounts_have_early_exit_penalty'), false);
});

// ⚠ 계약과 구현이 어긋나는 지점. 관리자에게 보고했다.
// engine-interface.md 5.5절은 delta_vs_baseline_krw를 "기본안 대비 세액공제액 차이,
// 0 이하"로 적었다. 그 문장은 기본안이 언제나 max_tax_credit이던 1.0.0 시점의 것이고,
// 게이트 2 D10이 기본안을 자금 사용 시점의 함수로 바꾸면서 성립하지 않게 됐다.
// 필드 이름과 주된 정의("기본안 대비")를 따라 구현했고, 그 결과 양수가 나올 수 있다.
// 승인된 계약을 임의로 고치지 않고 실제 동작을 여기에 고정해 둔다.
test('기본안이 재정렬되면 delta_vs_baseline_krw가 양수가 될 수 있다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { fund_use_horizon: 'before_pension_age', monthly_capacity_krw: 300_000 },
      }),
      rulesets,
    ),
  );

  assert.equal(scenario.plans[0].plan_id, 'isa_first');
  assert.equal(scenario.plans[0].delta_vs_baseline_krw, 0, '기본안은 언제나 0이다');
  assert.ok(
    scenario.plans.some((p) => p.delta_vs_baseline_krw > 0),
    '유동성을 우선한 기본안보다 세액공제가 큰 대안이 존재한다',
  );

  // 기본안이 max_tax_credit일 때는 계약 문장대로 전부 0 이하다.
  const neutral = scenarioOf(
    compute(baseRequest({ profile: { monthly_capacity_krw: 300_000 } }), rulesets),
  );
  assert.equal(neutral.plans[0].plan_id, 'max_tax_credit');
  assert.ok(neutral.plans.every((p) => p.delta_vs_baseline_krw <= 0));
});

test('경고는 배분액이 0보다 큰 계좌에만 붙는다', () => {
  // **`within_isa_lock_in`으로는 이제 이것을 잴 수 없다** — 그 시점에는 배분이 없어
  // 경고도 없다. 경고가 실제로 붙는 시점에서 잰다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { fund_use_horizon: 'before_pension_age', monthly_capacity_krw: 100_000 },
      }),
      rulesets,
    ),
  );

  for (const plan of scenario.plans) {
    const zeroAccounts = plan.allocations.filter((a) => a.annual_krw === 0).map((a) => a.account);
    for (const warning of plan.warnings) {
      assert.equal(
        zeroAccounts.includes(warning.account),
        false,
        `배분액 0인 ${warning.account}에 경고가 붙었다`,
      );
      assert.equal(warning.severity, 'warning');
      assert.equal(warning.trigger, 'declared_horizon');
      assert.ok(warning.basis_rule_ids.length > 0, '경고에도 근거 조항이 붙어야 한다');
      assert.equal('amount_krw' in warning, false, '경고에 금액은 없다');
    }
  }
});

test('at_or_after_pension_age — 경고를 내지 않는다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ profile: { monthly_capacity_krw: 300_000 } }), rulesets),
  );

  for (const plan of scenario.plans) {
    assert.deepStrictEqual(plan.warnings, []);
  }
});

test('before_pension_age — 연금계좌만 경고하고 ISA는 경고하지 않는다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { fund_use_horizon: 'before_pension_age', monthly_capacity_krw: 3_000_000 },
      }),
      rulesets,
    ),
  );

  const plan = planOf(scenario, 'max_tax_credit');
  const codes = new Set(plan.warnings.map((w) => w.code));

  assert.ok(codes.has('early_withdrawal_penalty_pension'));
  assert.equal(codes.has('early_termination_clawback_isa'), false);
  assert.ok(allocationOf(plan, 'isa').annual_krw > 0, 'ISA에 실제로 배분된 상태여야 의미 있는 검증이다');
});

test('unknown — 경고를 숨기지 않되 단정하지도 않는다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({ profile: { fund_use_horizon: 'unknown', monthly_capacity_krw: 3_000_000 } }),
      rulesets,
    ),
  );

  const plan = scenario.plans[0];
  assert.ok(plan.warnings.length > 0, '확정 규칙이므로 숨기지 않는다');
  for (const warning of plan.warnings) {
    assert.equal(warning.severity, 'info', '밝히지 않은 사정을 엔진이 단정하지 않는다');
    assert.equal(warning.trigger, 'horizon_unknown');
  }
  assert.ok(scenario.notices.some((n) => n.code === 'fund_use_horizon_not_declared'));
});
