// 4단계 독립 교차검증(`docs/stage-4-verification/`)이 잡은 결함의 회귀 테스트.
//
// 골든 케이스는 `tax-domain`이 엔진 코드를 보지 않고 세법에서 직접 산출한 값이다.
// 여기 적힌 기대값은 그 문서에서 그대로 옮긴 것이며, **엔진에 맞춰 고치지 않는다.**
// 값이 어긋나면 엔진이 틀린 것이다.
//
// 같은 버그가 다시 들어오면 교차검증까지 가기 전에 여기서 걸려야 한다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  loadRulesets,
  baseRequest,
  deepMerge,
  scenarioOf,
  planOf,
  allocationOf,
  noticeCodes,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

const benefitOf = (scenario, planId = 'max_tax_credit') => planOf(scenario, planId).deterministic_benefit;

// ── M1 — 개정안 시나리오에서 최대공제안이 세액공제를 최대화하지 못했다 ──────────
//
// 조건: 청년 자기신고 · 소득이 공제율 경계 위 · 연금저축 기납입 있음.
// 추가 IRP 납입이 기납입 연금저축분을 공제 풀에서 밀어내 낮은 율에서 높은 율로
// 갈아태우는데, 배분 탐색이 "남은 합산 room"에서 멈춰 그 치환을 놓쳤다.

/** GC-19 · GC-19c · GC-23의 공통 프로필. 총급여는 공제율 경계 위다. */
function youthRequest(overrides = {}) {
  return baseRequest(deepMerge({
    scenarios: ['proposed'],
    profile: {
      age_years: 30,
      current_year_total_salary_krw: 60_000_000,
      prior_year_total_salary_krw: 60_000_000,
      declared_youth: true,
      monthly_capacity_krw: 500_000,
    },
    accounts: {
      annuity_savings: { ytd_contribution_krw: 6_000_000 },
      retirement_pension: { ytd_contribution_krw: 0 },
      isa: { years_since_opening: 0 },
    },
  }, overrides));
}

test('M1 / GC-23 — 최대 격차 케이스. IRP를 잔여 공제한도에서 멈추지 않는다', () => {
  const scenario = scenarioOf(
    compute(youthRequest({ profile: { monthly_capacity_krw: 1_000_000 } }), rulesets),
    'proposed',
  );
  const plan = planOf(scenario, 'max_tax_credit');

  // 골든 케이스: IRP 9,000,000 + ISA 3,000,000
  assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, 9_000_000);
  assert.equal(allocationOf(plan, 'annuity_savings').annual_krw, 0);
  assert.equal(allocationOf(plan, 'isa').annual_krw, 3_000_000);

  assert.deepStrictEqual(
    [
      plan.deterministic_benefit.pension_credit_income_tax_krw,
      plan.deterministic_benefit.pension_credit_local_tax_krw,
      plan.deterministic_benefit.pension_credit_total_krw,
    ],
    [1_350_000, 135_000, 1_485_000],
  );

  // 결함이 있을 때 나오던 값. 다시 나오면 안 된다.
  assert.notEqual(plan.deterministic_benefit.pension_credit_total_krw, 1_287_000);
});

test('M1 / GC-19c — ISA라는 대안 목적지가 없어도 같은 결론이다', () => {
  const scenario = scenarioOf(
    compute(
      youthRequest({ accounts: { isa: { exists: false, years_since_opening: null } } }),
      rulesets,
    ),
    'proposed',
  );
  const plan = planOf(scenario, 'max_tax_credit');

  assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, 6_000_000);
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 1_386_000);
});

test('M1 / GC-19 — 확정 시나리오는 값이 바뀌지 않는다', () => {
  const response = compute(
    youthRequest({ scenarios: ['current', 'proposed'] }),
    rulesets,
  );

  // 두 계좌의 공제율이 같으므로 귀속이 세액을 바꾸지 않는다.
  assert.equal(benefitOf(scenarioOf(response, 'current')).pension_credit_total_krw, 1_188_000);
  assert.equal(benefitOf(scenarioOf(response, 'proposed')).pension_credit_total_krw, 1_386_000);
});

test('M1 / GC-19b · GC-23-oracle — 인정 로직은 처음부터 옳았고 지금도 옳다', () => {
  // 목표 상태를 기납입으로 직접 주어 배분 탐색을 배제한다.
  const oracle = (irpYtd, expected) => {
    const scenario = scenarioOf(
      compute(
        youthRequest({
          profile: { monthly_capacity_krw: 0 },
          accounts: { retirement_pension: { ytd_contribution_krw: irpYtd } },
        }),
        rulesets,
      ),
      'proposed',
    );
    assert.equal(benefitOf(scenario).pension_credit_total_krw, expected);
    assert.equal(benefitOf(scenario).credit_eligible_contribution_krw, 9_000_000);
  };

  oracle(6_000_000, 1_386_000); // GC-19b
  oracle(9_000_000, 1_485_000); // GC-23-oracle
});

test('M1 / 치환은 공제율이 실제로 갈릴 때만 일어난다', () => {
  // 청년 미신고면 우대가 적용되지 않으므로 두 율이 같고, 치환할 이유가 없다.
  // 이때까지 IRP를 밀어 넣으면 공제는 그대로인 채 인출 제약만 지게 된다.
  const scenario = scenarioOf(
    compute(
      youthRequest({
        profile: { declared_youth: null, monthly_capacity_krw: 1_000_000 },
      }),
      rulesets,
    ),
    'proposed',
  );
  const plan = planOf(scenario, 'max_tax_credit');

  assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, 3_000_000);
  assert.equal(allocationOf(plan, 'isa').annual_krw, 9_000_000);
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 1_188_000);
  assert.ok(noticeCodes(scenario).includes('youth_status_not_declared'));
});

test('M1 / 소득이 공제율 경계 아래면 치환 이득이 없다', () => {
  // 경계 아래에서는 두 계좌 모두 우대율과 같은 율이므로 갈리지 않는다.
  const scenario = scenarioOf(
    compute(
      youthRequest({
        profile: { current_year_total_salary_krw: 45_000_000, monthly_capacity_krw: 1_000_000 },
      }),
      rulesets,
    ),
    'proposed',
  );
  const plan = planOf(scenario, 'max_tax_credit');

  assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, 3_000_000);
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 1_485_000);
});

// ── M2 — 의무가입기간이 경과했는데도 중도해지 추징 경고가 나갔다 ──────────────
//
// 조특법 §91조의18⑦은 "3년이 되는 날 전" 해지에만 추징을 건다.
// 계약 8.4절에 잔여 기간 조건이 없어 성립할 수 없는 불이익을 고지하고 있었다.

/** GC-21 프로필. ISA 의무가입기간과 연금 개시연령이 모두 경과했다. */
function elapsedLockInRequest(overrides = {}) {
  return baseRequest(deepMerge({
    profile: {
      age_years: 56,
      current_year_total_salary_krw: 45_000_000,
      prior_year_total_salary_krw: 45_000_000,
      monthly_capacity_krw: 1_000_000,
      fund_use_horizon: 'within_isa_lock_in',
    },
    accounts: {
      isa: { account_type: 'low_income', cumulative_contribution_krw: 20_000_000, years_since_opening: 3 },
    },
  }, overrides));
}

test('M2 / GC-21 — 의무가입기간이 지났으면 추징 경고를 내지 않는다', () => {
  const scenario = scenarioOf(compute(elapsedLockInRequest(), rulesets));

  assert.equal(scenario.fund_use_horizon_boundaries.isa_lock_in_years_remaining, 0);

  for (const plan of scenario.plans) {
    const isaAllocated = allocationOf(plan, 'isa').annual_krw > 0;
    assert.equal(
      plan.warnings.some((w) => w.code === 'early_termination_clawback_isa'),
      false,
      `${plan.plan_id}에 성립할 수 없는 추징 경고가 붙었다 (ISA 배분 ${isaAllocated})`,
    );
  }

  // 연금 쪽 경고는 오답이 아니다 — 5년 보유요건은 입력이 없어 판정되지 않았다.
  assert.ok(scenario.plans[0].warnings.some((w) => w.code === 'early_withdrawal_penalty_pension'));
  assert.equal(scenario.fund_use_horizon_boundaries.pension_holding_period_evaluated, false);
  assert.ok(noticeCodes(scenario).includes('pension_holding_period_not_evaluated'));

  // 금액은 M2 이전과 같아야 한다. 경고만 달라진다.
  assert.equal(benefitOf(scenario).pension_credit_total_krw, 1_485_000);
  assert.equal(
    scenario.limits.by_account.find((l) => l.account === 'isa').contribution_limit_remaining_krw,
    60_000_000,
  );
});

test('M2 / 입력과 현실이 어긋나면 경고를 끄되 그 사실을 알린다', () => {
  const elapsed = scenarioOf(compute(elapsedLockInRequest(), rulesets));
  assert.ok(noticeCodes(elapsed).includes('isa_lock_in_already_elapsed'));

  // 기간이 남아 있으면 이 안내는 나가지 않는다.
  const remaining = scenarioOf(
    compute(elapsedLockInRequest({
      accounts: { isa: { years_since_opening: 0, cumulative_contribution_krw: 0 } },
    }), rulesets),
  );
  assert.equal(noticeCodes(remaining).includes('isa_lock_in_already_elapsed'), false);
});

test('M2 / 기간이 남아 있으면 추징 경고는 그대로 나간다', () => {
  const scenario = scenarioOf(
    compute(elapsedLockInRequest({
      accounts: { isa: { years_since_opening: 0, cumulative_contribution_krw: 0 } },
    }), rulesets),
  );

  assert.ok(scenario.fund_use_horizon_boundaries.isa_lock_in_years_remaining > 0);
  const plan = planOf(scenario, 'max_tax_credit');
  assert.ok(allocationOf(plan, 'isa').annual_krw > 0);
  assert.ok(plan.warnings.some((w) => w.code === 'early_termination_clawback_isa'));
  assert.ok(scenario.comparison_note_codes.includes('all_accounts_have_early_exit_penalty'));
});

test('M2 / unknown horizon에서도 잔여 기간 조건이 함께 걸린다', () => {
  const elapsed = scenarioOf(
    compute(elapsedLockInRequest({ profile: { fund_use_horizon: 'unknown' } }), rulesets),
  );
  assert.equal(
    elapsed.plans[0].warnings.some((w) => w.code === 'early_termination_clawback_isa'),
    false,
  );

  const remaining = scenarioOf(
    compute(
      elapsedLockInRequest({
        profile: { fund_use_horizon: 'unknown' },
        accounts: { isa: { years_since_opening: 0, cumulative_contribution_krw: 0 } },
      }),
      rulesets,
    ),
  );
  const isaWarning = remaining.plans[0].warnings.find((w) => w.code === 'early_termination_clawback_isa');
  assert.ok(isaWarning);
  assert.equal(isaWarning.severity, 'info');
  assert.equal(isaWarning.trigger, 'horizon_unknown');
});
