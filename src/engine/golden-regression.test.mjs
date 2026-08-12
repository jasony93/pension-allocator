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
  birthDateForAge,
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
      birth_date: birthDateForAge(30),
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
  // **D32 — `credit_limit`이 계약에서 사라졌다.** 어떤 안도 세액공제 대상 한도에서
  // 멈추지 않으므로 그 값은 어느 계좌의 상한도 아니게 됐다. **금액은 한 원도 바뀌지
  // 않았다** — 바뀐 것은 "무엇이 막았는가"의 이름뿐이고, 예산이 다 쓰인 것이 사실이다.
  assert.equal(allocationOf(plan, 'retirement_pension').limited_by, 'budget');
  assert.equal(allocationOf(plan, 'isa').limited_by, 'budget');

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
  assert.equal(allocationOf(plan, 'annuity_savings').annual_krw, 0);
  assert.equal(allocationOf(plan, 'isa').annual_krw, 0);
  assert.equal(allocationOf(plan, 'retirement_pension').limited_by, 'budget');
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 1_386_000);
});

test('M1 / GC-19 — 확정 시나리오는 값이 바뀌지 않는다', () => {
  const response = compute(
    youthRequest({ scenarios: ['current', 'proposed'] }),
    rulesets,
  );

  // 두 계좌의 공제율이 같으므로 귀속이 세액을 바꾸지 않는다 — 치환도 하지 않는다.
  const current = planOf(scenarioOf(response, 'current'), 'max_tax_credit');
  assert.equal(current.deterministic_benefit.pension_credit_total_krw, 1_188_000);
  assert.equal(allocationOf(current, 'retirement_pension').annual_krw, 3_000_000);
  // D32에서 사라진 값이다. 금액은 그대로이고 이름만 사실을 따라간다(위 주석).
  assert.equal(allocationOf(current, 'retirement_pension').limited_by, 'budget');
  assert.equal(allocationOf(current, 'isa').annual_krw, 3_000_000);

  const proposed = planOf(scenarioOf(response, 'proposed'), 'max_tax_credit');
  assert.equal(proposed.deterministic_benefit.pension_credit_total_krw, 1_386_000);
  assert.equal(allocationOf(proposed, 'retirement_pension').annual_krw, 6_000_000);
  assert.equal(allocationOf(proposed, 'isa').annual_krw, 0);
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
  assert.equal(allocationOf(plan, 'isa').annual_krw, 9_000_000);
  // **D32 — `credit_limit`이 계약에서 사라졌다.** 어떤 안도 세액공제 대상 한도에서
  // 멈추지 않으므로 그 값은 어느 계좌의 상한도 아니게 됐다. **금액은 한 원도 바뀌지
  // 않았다** — 바뀐 것은 "무엇이 막았는가"의 이름뿐이고, 예산이 다 쓰인 것이 사실이다.
  assert.equal(allocationOf(plan, 'retirement_pension').limited_by, 'budget');
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 1_485_000);
});

test('M1 / GC-25·GC-26 — 금액이 같아도 배분이 정반대인 경계 쌍', () => {
  // `tax-domain`이 짚은 회귀 테스트의 함정. 두 케이스의 개정안 공제액이 **우연히 같고**
  // 배분만 정반대다. 금액만 비교하면 조건이 뒤집혀도 통과한다.
  const at = (salary) => {
    const scenario = scenarioOf(
      compute(
        youthRequest({
          scenarios: ['current', 'proposed'],
          profile: {
            current_year_total_salary_krw: salary,
            prior_year_total_salary_krw: salary,
            monthly_capacity_krw: 1_000_000,
          },
        }),
        rulesets,
      ),
      'proposed',
    );
    const plan = planOf(scenario, 'max_tax_credit');
    return {
      credit: plan.deterministic_benefit.pension_credit_total_krw,
      irp: allocationOf(plan, 'retirement_pension').annual_krw,
      isa: allocationOf(plan, 'isa').annual_krw,
      limitedBy: allocationOf(plan, 'retirement_pension').limited_by,
    };
  };

  // 두 율이 같아지는 마지막 지점 — 치환하지 않는다.
  const boundary = at(55_000_000);
  // 두 율이 갈리는 첫 지점 — 치환한다.
  const overBoundary = at(55_000_001);

  assert.equal(boundary.credit, overBoundary.credit, '이 쌍의 요지는 금액이 같다는 것이다');
  assert.deepStrictEqual([boundary.irp, boundary.isa], [3_000_000, 9_000_000]);
  assert.deepStrictEqual([overBoundary.irp, overBoundary.isa], [9_000_000, 3_000_000]);
  // D32에서 사라진 값이다. **두 배분 벡터는 그대로이고** 이름만 사실을 따라간다 —
  // 이 쌍이 잡으려던 것(금액이 같아도 배분이 정반대)은 위 두 줄이 그대로 지킨다.
  assert.equal(boundary.limitedBy, 'budget');
  assert.equal(overBoundary.limitedBy, 'budget');
});

// ── M3 — 사실이 아닌 비교 안내가 배분 비교보다 앞섰다 ─────────────────────────
//
// M2로 ISA 추징 경고가 사라지자 `isa_first` 안의 warnings가 빈 배열이 됐는데,
// `all_accounts_have_early_exit_penalty`는 horizon 값만 보고 그대로 나갔다.
// "어느 안도 피하지 못한다"고 말하면서 실제로는 피하는 안이 목록에 있었다.

//
// **D52 2번이 이 자리를 다시 건드렸다.** 그 시점의 배분이 전부 0이 되면서 경고가 붙을
// 자리가 사라졌고, 「모든 안이 경고를 진다」로는 더 이상 잴 수 없다. 그래서 엔진이
// **가상의 배분**을 같은 경고 판정 함수에 물어 세 계좌가 빠짐없이 걸릴 때만 이 안내를
// 낸다. **M3이 잡은 진술은 그대로다** — 성립하지 않는 불이익을 주장하지 않는다.

test('M3 / GC-21 — 성립할 수 없는 불이익이 있으면 그 안내를 내지 않는다', () => {
  const scenario = scenarioOf(compute(elapsedLockInRequest(), rulesets));

  assert.equal(scenario.fund_use_horizon_boundaries.isa_lock_in_years_remaining, 0);
  // 같은 프로필을 `unknown`으로 물으면 ISA에는 경고가 붙지 않는다 — 추징 요건이
  // 성립하지 않기 때문이고, 그것이 이 안내를 내지 않는 이유다.
  const asUnknown = scenarioOf(
    compute(elapsedLockInRequest({ profile: { fund_use_horizon: 'unknown' } }), rulesets),
  );
  assert.equal(
    asUnknown.plans[0].warnings.some((w) => w.code === 'early_termination_clawback_isa'),
    false,
    '불이익이 성립하지 않는 계좌가 실제로 있어야 의미 있는 검증이다',
  );

  assert.equal(
    scenario.comparison_note_codes.includes('all_accounts_have_early_exit_penalty'),
    false,
  );
});

test('M3 / 세 계좌가 전부 불이익을 지면 그 안내는 그대로 나간다', () => {
  const overrides = {
    accounts: { isa: { years_since_opening: 0, cumulative_contribution_krw: 0 } },
  };
  const scenario = scenarioOf(compute(elapsedLockInRequest(overrides), rulesets));

  // 전제 — 같은 프로필을 `unknown`으로 물으면 세 계좌 전부에 경고가 붙는다.
  const asUnknown = scenarioOf(
    compute(
      elapsedLockInRequest({ ...overrides, profile: { fund_use_horizon: 'unknown' } }),
      rulesets,
    ),
  );
  const covered = new Set(asUnknown.plans[0].warnings.map((w) => w.account));
  assert.deepStrictEqual(
    [...covered].sort(),
    ['annuity_savings', 'isa', 'retirement_pension'],
    '세 계좌 전부가 불이익을 지는 상황이어야 의미 있는 검증이다',
  );

  assert.ok(scenario.comparison_note_codes.includes('all_accounts_have_early_exit_penalty'));
});

// ── M2 — 의무가입기간이 경과했는데도 중도해지 추징 경고가 나갔다 ──────────────
//
// 조특법 §91조의18⑦은 "3년이 되는 날 전" 해지에만 추징을 건다.
// 계약 8.4절에 잔여 기간 조건이 없어 성립할 수 없는 불이익을 고지하고 있었다.

/** GC-21 프로필. ISA 의무가입기간과 연금 개시연령이 모두 경과했다. */
function elapsedLockInRequest(overrides = {}) {
  return baseRequest(deepMerge({
    profile: {
      birth_date: birthDateForAge(56),
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

// **D52 2번 이후 이 프로필을 `within_isa_lock_in`으로 물으면 배분이 없다.** 경고가 붙을
// 자리가 없으므로 그 시점으로는 M2를 잴 수 없고, 잴 수 있는 자리는 배분이 살아 있는
// `unknown`이다(아래 두 시험과 「unknown horizon에서도」 시험). **잠금을 옮긴 것이지 푼
// 것이 아니다** — 조건은 계약 8.4절 한 곳에 그대로 있고 세 시험이 양방향으로 문다.

test('M2 / GC-21 — 의무가입기간이 지났으면 추징 경고를 내지 않는다', () => {
  const scenario = scenarioOf(
    compute(elapsedLockInRequest({ profile: { fund_use_horizon: 'unknown' } }), rulesets),
  );

  assert.equal(scenario.fund_use_horizon_boundaries.isa_lock_in_years_remaining, 0);

  for (const plan of scenario.plans) {
    const isaAllocated = allocationOf(plan, 'isa').annual_krw > 0;
    assert.equal(
      plan.warnings.some((w) => w.code === 'early_termination_clawback_isa'),
      false,
      `${plan.plan_id}에 성립할 수 없는 추징 경고가 붙었다 (ISA 배분 ${isaAllocated})`,
    );
  }
  assert.ok(
    scenario.plans.some((plan) => allocationOf(plan, 'isa').annual_krw > 0),
    'ISA에 실제로 배분된 상태여야 경고의 부재가 뜻을 갖는다',
  );

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

test('M2 / GC-21을 원래 시점으로 물으면 배분 자체가 없다 (D52 2번)', () => {
  const scenario = scenarioOf(compute(elapsedLockInRequest(), rulesets));

  assert.equal(scenario.plans.length, 1);
  for (const allocation of scenario.plans[0].allocations) {
    assert.equal(allocation.annual_krw, 0);
  }
  assert.deepStrictEqual(scenario.plans[0].warnings, [], '넣지 않은 돈에 경고가 붙었다');
  assert.equal(
    scenario.plans[0].unallocated_breakdown.reason_code,
    'no_account_beneficial_within_fund_use_horizon',
  );
  // 입력과 현실이 어긋난다는 통지는 그대로 나간다 — 화면이 그 예외를 읽을 수 있어야 한다.
  assert.ok(noticeCodes(scenario).includes('isa_lock_in_already_elapsed'));
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
  const overrides = {
    accounts: { isa: { years_since_opening: 0, cumulative_contribution_krw: 0 } },
  };
  // 경고는 배분이 살아 있는 시점에서 잰다(위 머리말).
  const scenario = scenarioOf(
    compute(
      elapsedLockInRequest({ ...overrides, profile: { fund_use_horizon: 'unknown' } }),
      rulesets,
    ),
  );

  assert.ok(scenario.fund_use_horizon_boundaries.isa_lock_in_years_remaining > 0);
  const plan = planOf(scenario, 'max_tax_credit');
  assert.ok(allocationOf(plan, 'isa').annual_krw > 0);
  assert.ok(plan.warnings.some((w) => w.code === 'early_termination_clawback_isa'));

  // 비교 안내는 그 시점의 것이므로 원래 시점에서 잰다.
  const locked = scenarioOf(compute(elapsedLockInRequest(overrides), rulesets));
  assert.ok(locked.comparison_note_codes.includes('all_accounts_have_early_exit_penalty'));
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
