// 계약 자체의 검증 — 입력 검증, 오류 표현, 고정 순서, 응답 형태.
// engine-interface.md 2·6·7·8절이 대상이다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute, SCHEMA_VERSION } from './index.mjs';
import { PLAN_ORDER } from './constants.mjs';
import {
  loadRulesets,
  baseRequest,
  scenarioOf,
  errorCodes,
  noticeCodes,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

test('예외를 던지지 않는다 — 무엇을 넣어도 반환값으로 표현한다', () => {
  for (const bad of [null, undefined, 42, 'x', {}, []]) {
    const response = compute(bad, rulesets);
    assert.equal(response.ok, false);
    assert.ok(Array.isArray(response.errors));
    assert.ok(response.errors.length > 0);
  }
  assert.equal(compute(baseRequest(), null).ok, false);
});

test('major가 다른 schema_version은 거부한다. minor 차이는 받는다', () => {
  const major = Number.parseInt(SCHEMA_VERSION.split('.')[0], 10);

  for (const rejected of [`${major - 1}.0.0`, `${major + 1}.0.0`]) {
    assert.ok(
      errorCodes(compute(baseRequest({ schema_version: rejected }), rulesets)).includes(
        'schema_version_mismatch',
      ),
      `${rejected}이 거부되지 않았다`,
    );
  }
  assert.equal(compute(baseRequest({ schema_version: `${major}.0.0` }), rulesets).ok, true);
  assert.equal(compute(baseRequest({ schema_version: `${major}.9.9` }), rulesets).ok, true);
});

test('오류는 첫 번째에서 멈추지 않고 전부 담는다', () => {
  const request = baseRequest();
  request.profile.current_year_total_salary_krw = -1;
  request.profile.monthly_capacity_krw = -1;
  request.accounts.retirement_pension.ytd_contribution_krw = -1;

  const response = compute(request, rulesets);
  assert.equal(response.ok, false);
  assert.equal(response.errors.filter((e) => e.code === 'negative_value').length, 3);
  assert.ok(response.errors.every((e) => typeof e.field === 'string'));
  assert.equal('scenarios' in response, false, '부분 결과를 내지 않는다');
});

test('필수 필드 누락은 missing_required다 — 기본값을 만들지 않는다', () => {
  const request = baseRequest();
  delete request.profile.fund_use_horizon;
  delete request.accounts.isa;

  const codes = errorCodes(compute(request, rulesets));
  assert.equal(codes.filter((c) => c === 'missing_required').length >= 2, true);
});

test('자료형 위반의 코드가 구분된다', () => {
  assert.ok(
    errorCodes(compute(baseRequest({ profile: { current_year_total_salary_krw: 40.5 } }), rulesets)).includes(
      'not_integer',
    ),
  );
  assert.ok(errorCodes(compute(baseRequest({ profile: { fund_use_horizon: 'someday' } }), rulesets)).includes('invalid_enum'));
  assert.ok(errorCodes(compute(baseRequest({ profile: { months_remaining_in_tax_year: 13 } }), rulesets)).includes('out_of_range'));
  assert.ok(errorCodes(compute(baseRequest({ profile: { months_remaining_in_tax_year: 0 } }), rulesets)).includes('out_of_range'));
  assert.ok(errorCodes(compute(baseRequest({ scenarios: [] }), rulesets)).includes('empty_scenarios'));
  assert.ok(errorCodes(compute(baseRequest({ scenarios: ['later'] }), rulesets)).includes('unknown_scenario'));
  assert.ok(errorCodes(compute(baseRequest({ options: { plan_variants: ['nope'] } }), rulesets)).includes('unknown_plan_variant'));
});

test('상호 제약 — ISA 당해연도 납입액이 누적을 넘을 수 없다', () => {
  const codes = errorCodes(
    compute(
      baseRequest({
        accounts: { isa: { cumulative_contribution_krw: 1_000_000, ytd_contribution_krw: 2_000_000 } },
      }),
      rulesets,
    ),
  );
  assert.ok(codes.includes('isa_ytd_exceeds_cumulative'));
});

test('상호 제약 — 전환금액이 ISA 누적 납입액을 넘을 수 없다', () => {
  const codes = errorCodes(
    compute(
      baseRequest({
        accounts: { isa: { cumulative_contribution_krw: 1_000_000 } },
        isa_transfer: { amount_krw: 2_000_000 },
      }),
      rulesets,
    ),
  );
  assert.ok(codes.includes('isa_transfer_exceeds_cumulative'));
});

test('선택 필드를 생략한 것과 null을 보낸 것은 같다', () => {
  const withNull = compute(baseRequest({ profile: { prior_year_total_salary_krw: null } }), rulesets);
  const request = baseRequest();
  delete request.profile.prior_year_total_salary_krw;
  const omitted = compute(request, rulesets);

  assert.deepStrictEqual(omitted, withNull);
});

test('남은 개월수는 null이면 과세연도 전체로 보고 그 사실을 가정에 담는다', () => {
  const response = compute(baseRequest({ profile: { months_remaining_in_tax_year: null } }), rulesets);
  assert.equal(response.echo.months_remaining_in_tax_year, 12);
  assert.equal(response.echo.annual_budget_krw, response.echo.monthly_capacity_krw * 12);
  assert.ok(response.assumptions.some((a) => a.code === 'months_remaining_defaulted'));
});

test('남은 개월수가 줄면 예산이 줄고 월 배분과 연 배분이 맞물린다', () => {
  const months = 5;
  const response = compute(
    baseRequest({ profile: { months_remaining_in_tax_year: months, monthly_capacity_krw: 400_000 } }),
    rulesets,
  );
  assert.equal(response.echo.annual_budget_krw, 400_000 * months);

  for (const plan of scenarioOf(response).plans) {
    let residual = 0;
    for (const allocation of plan.allocations) {
      assert.equal(allocation.monthly_krw, Math.floor(allocation.annual_krw / months));
      residual += allocation.annual_krw - allocation.monthly_krw * months;
    }
    assert.equal(plan.monthly_rounding_residual_krw, residual, '잔차를 삼키지 않는다');
  }
});

test('고정 순서 — 시나리오·배분·한도·근거', () => {
  const response = compute(
    baseRequest({ scenarios: ['proposed', 'current', 'current'] }),
    rulesets,
  );
  assert.deepStrictEqual(response.scenarios.map((s) => s.scenario_id), ['current', 'proposed']);

  const scenario = scenarioOf(response);
  const order = ['retirement_pension', 'annuity_savings', 'isa'];
  assert.deepStrictEqual(scenario.account_eligibility.map((a) => a.account), order);
  assert.deepStrictEqual(scenario.limits.by_account.map((a) => a.account), order);
  for (const plan of scenario.plans) {
    assert.deepStrictEqual(plan.allocations.map((a) => a.account), order);
  }

  const ids = scenario.legal_basis.map((e) => e.rule_id);
  assert.deepStrictEqual(ids, [...ids].sort(), '확정 구간 안에서는 rule_id 사전순이다');
});

test('결정적이다 — 같은 입력이면 같은 출력', () => {
  const a = compute(baseRequest({ scenarios: ['current', 'proposed'] }), rulesets);
  const b = compute(baseRequest({ scenarios: ['current', 'proposed'] }), rulesets);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('배분안은 언제나 세 계좌 전부를 담고 1~4개다', () => {
  for (const monthly of [200_000, 1_000_000, 5_000_000]) {
    const scenario = scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: monthly } }), rulesets));
    assert.ok(scenario.plans.length >= 1 && scenario.plans.length <= PLAN_ORDER.length, `${monthly}`);
    for (const plan of scenario.plans) {
      assert.equal(plan.allocations.length, 3);
      assert.equal(plan.priority_basis.fill_sequence.length, 3);
      assert.ok(plan.priority_basis.code.length > 0);
      assert.ok(PLAN_ORDER.includes(plan.plan_id));
    }
  }
});

test('plan_variants로 배분안을 골라 받을 수 있다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { monthly_capacity_krw: 200_000 },
        options: { plan_variants: ['max_tax_credit', 'isa_first'] },
      }),
      rulesets,
    ),
  );
  assert.ok(scenario.plans.every((p) => ['max_tax_credit', 'isa_first'].includes(p.plan_id)));
});

test('include_legal_basis: false는 테스트용이며 근거를 비운다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ options: { include_legal_basis: false } }), rulesets),
  );
  assert.deepStrictEqual(scenario.legal_basis, []);
});

test('ISA는 세액공제 대상이 아니고 연금계좌는 비과세 한도가 없다', () => {
  const scenario = scenarioOf(compute(baseRequest(), rulesets));
  for (const limit of scenario.limits.by_account) {
    if (limit.account === 'isa') {
      assert.equal(limit.credit_eligible_limit_remaining_krw, null);
      assert.ok(limit.tax_free_limit_krw !== null);
    } else {
      assert.equal(limit.tax_free_limit_krw, null);
      assert.ok(limit.credit_eligible_limit_remaining_krw !== null);
    }
  }
});

test('공유 한도를 계약이 스스로 드러낸다 — 더하면 이중계상이다', () => {
  const scenario = scenarioOf(compute(baseRequest(), rulesets));
  const byAccount = Object.fromEntries(scenario.limits.by_account.map((l) => [l.account, l]));

  // 연금 두 계좌는 납입 한도도 세액공제 한도도 같은 풀을 본다.
  assert.deepStrictEqual(byAccount.retirement_pension.contribution_limit_shared_with, ['annuity_savings']);
  assert.deepStrictEqual(byAccount.annuity_savings.contribution_limit_shared_with, ['retirement_pension']);
  assert.deepStrictEqual(byAccount.retirement_pension.credit_limit_shared_with, ['annuity_savings']);
  assert.deepStrictEqual(byAccount.annuity_savings.credit_limit_shared_with, ['retirement_pension']);

  // ISA 한도는 전용이다. 빈 배열이 그 사실을 말한다.
  assert.deepStrictEqual(byAccount.isa.contribution_limit_shared_with, []);
  assert.deepStrictEqual(byAccount.isa.credit_limit_shared_with, []);

  // 공유 표시가 가리키는 대로, 두 계좌의 값은 같은 풀이므로 서로 같고
  // 합계는 LimitBreakdown 쪽에 이미 있다.
  assert.equal(
    byAccount.retirement_pension.contribution_limit_remaining_krw,
    byAccount.annuity_savings.contribution_limit_remaining_krw,
  );
  assert.equal(
    scenario.limits.pension_contribution_limit_remaining_krw,
    byAccount.retirement_pension.contribution_limit_remaining_krw,
  );
  assert.equal(
    scenario.limits.pension_combined_credit_remaining_krw,
    byAccount.retirement_pension.credit_eligible_limit_remaining_krw,
  );

  // 공유 표시는 실재하는 계좌만 가리켜야 한다.
  const known = new Set(scenario.limits.by_account.map((l) => l.account));
  for (const limit of scenario.limits.by_account) {
    for (const account of [...limit.contribution_limit_shared_with, ...limit.credit_limit_shared_with]) {
      assert.ok(known.has(account));
      assert.notEqual(account, limit.account, '자기 자신을 공유 대상으로 적지 않는다');
    }
  }
});

test('ISA 유형 미선언이면 비과세 한도를 표시하지 않는다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ accounts: { isa: { account_type: null } } }), rulesets),
  );
  const isa = scenario.limits.by_account.find((l) => l.account === 'isa');
  assert.equal(isa.tax_free_limit_krw, null);
  assert.ok(noticeCodes(scenario).includes('isa_type_not_declared'));
});

test('ISA의 효과는 금액으로 내지 않는다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ profile: { monthly_capacity_krw: 5_000_000 } }), rulesets),
  );
  const plan = scenario.plans[0];
  const effects = plan.non_quantified_effects;

  assert.ok(effects.length > 0);
  for (const effect of effects) {
    assert.equal(effect.quantifiable, false);
    assert.ok(effect.reason_code.length > 0);
    assert.ok(effect.basis_rule_ids.length > 0);
  }
  assert.ok(scenario.notices.length >= 0);
});
