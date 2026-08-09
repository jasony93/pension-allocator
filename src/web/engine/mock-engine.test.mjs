import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compute, computeFundUseHorizonBoundaries, MOCK_SCHEMA_VERSION as SCHEMA_VERSION } from './mock-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..', '..');

function loadRulesets() {
  const dir = path.join(rootDir, 'data', 'tax-rules');
  return {
    '2026.json': JSON.parse(readFileSync(path.join(dir, '2026.json'), 'utf8')),
    '2027-proposed.json': JSON.parse(readFileSync(path.join(dir, '2027-proposed.json'), 'utf8')),
  };
}

const rulesets = loadRulesets();

/** 계약 3.2절 `PensionAccountState`. `annuity_start_status`는 **필수**이고 기본값이 없다. */
function pensionAccount(overrides = {}) {
  return {
    ytd_contribution_krw: 0,
    annuity_start_status: 'not_started',
    opened_on: null,
    has_deferred_retirement_income: null,
    retirement_transfer_in_krw: null,
    ...overrides,
  };
}

function baseRequest(overrides = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    tax_year: 2026,
    scenarios: ['current'],
    profile: {
      // 4.0.0 — 만 나이가 아니라 생년월일을 보낸다(D21). 환산은 엔진이 한다.
      birth_date: '1988-03-15',
      // 세액 한도의 재료. 두 값을 짝으로 받는다(계약 3.5절).
      prior_year_tax: { state: 'unknown', determined_tax_krw: null, pension_credit_applied_krw: null },
      current_year_total_salary_krw: 62000000,
      prior_year_total_salary_krw: null,
      financial_income_taxpayer_last_3_years: null,
      declared_youth: null,
      fund_use_horizon: 'unknown',
      monthly_capacity_krw: 800000,
      months_remaining_in_tax_year: null,
    },
    accounts: {
      annuity_savings: pensionAccount(),
      retirement_pension: pensionAccount(),
      isa: {
        exists: false,
        account_type: null,
        cumulative_contribution_krw: 0,
        ytd_contribution_krw: 0,
        years_since_opening: null,
        other_savings_contract_krw: null,
      },
    },
    isa_transfer: null,
    options: null,
    ...overrides,
  };
}

test('missing required fields collects all errors, not just the first', () => {
  const res = compute(
    { schema_version: SCHEMA_VERSION, tax_year: 2026, scenarios: ['current'], profile: {}, accounts: {} },
    rulesets,
  );
  assert.equal(res.ok, false);
  const codes = res.errors.map((e) => e.code);
  assert.ok(codes.includes('missing_required'));
  assert.ok(res.errors.length > 1, 'should report multiple missing fields at once');
});

test('unknown schema major triggers schema_version_mismatch', () => {
  const res = compute(baseRequest({ schema_version: '9.0.0' }), rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'schema_version_mismatch'));
});

test('negative monthly capacity is rejected', () => {
  const req = baseRequest();
  req.profile.monthly_capacity_krw = -1;
  const res = compute(req, rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'negative_value' && e.field === 'profile.monthly_capacity_krw'));
});

test('zero monthly capacity is a valid input, not an error', () => {
  const req = baseRequest();
  req.profile.monthly_capacity_krw = 0;
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  const notices = res.scenarios[0].notices.map((n) => n.code);
  assert.ok(notices.includes('zero_capacity'));
});

test('a basic successful request returns three accounts in every plan, in fixed order', () => {
  const res = compute(baseRequest(), rulesets);
  assert.equal(res.ok, true);
  assert.equal(res.scenarios.length, 1);
  const scenario = res.scenarios[0];
  assert.ok(scenario.plans.length >= 1 && scenario.plans.length <= 3);
  for (const plan of scenario.plans) {
    assert.deepEqual(
      plan.allocations.map((a) => a.account),
      ['retirement_pension', 'annuity_savings', 'isa'],
    );
  }
  assert.equal(scenario.plans.filter((p) => p.is_baseline).length, 1);
  assert.equal(scenario.plans[0].is_baseline, true);
});

test('fund_use_horizon never changes allocation amounts or tax credit, only ordering/warnings', () => {
  const horizons = ['within_isa_lock_in', 'before_pension_age', 'at_or_after_pension_age', 'unknown'];
  const vectors = horizons.map((h) => {
    const req = baseRequest();
    req.profile.fund_use_horizon = h;
    req.accounts.isa.exists = true;
    req.accounts.isa.account_type = 'general';
    req.accounts.isa.cumulative_contribution_krw = 1000000;
    req.accounts.isa.ytd_contribution_krw = 0;
    const res = compute(req, rulesets);
    assert.equal(res.ok, true);
    const byId = {};
    for (const plan of res.scenarios[0].plans) {
      byId[plan.plan_id] = {
        allocations: plan.allocations.map((a) => a.annual_krw),
        credit: plan.deterministic_benefit.pension_credit_total_krw,
      };
    }
    return byId;
  });
  for (let i = 1; i < vectors.length; i++) {
    assert.deepEqual(vectors[i], vectors[0], `fund_use_horizon=${horizons[i]} changed amounts`);
  }
});

test('echo.fund_use_horizon_affects is always the fixed contract shape', () => {
  const res = compute(baseRequest(), rulesets);
  assert.deepEqual(res.echo.fund_use_horizon_affects, {
    allocation_amounts: false,
    tax_credit_amounts: false,
    limits: false,
    plan_ordering: true,
    baseline_selection: true,
    warnings: true,
  });
});

test('within_isa_lock_in with allocations produces warnings with LawChip-able basis_rule_ids', () => {
  const req = baseRequest();
  req.profile.fund_use_horizon = 'within_isa_lock_in';
  req.accounts.isa.exists = true;
  req.accounts.isa.account_type = 'general';
  req.accounts.isa.cumulative_contribution_krw = 5000000;
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  const baseline = res.scenarios[0].plans[0];
  const withAlloc = baseline.allocations.filter((a) => a.annual_krw > 0);
  for (const a of withAlloc) {
    const warning = baseline.warnings.find((w) => w.account === a.account);
    assert.ok(warning, `expected a warning for ${a.account}`);
    assert.ok(warning.basis_rule_ids.length > 0);
    assert.equal(warning.severity, 'warning');
    assert.equal(warning.trigger, 'declared_horizon');
  }
});

test('at_or_after_pension_age produces no warnings at all', () => {
  const req = baseRequest();
  req.profile.fund_use_horizon = 'at_or_after_pension_age';
  req.accounts.isa.exists = true;
  req.accounts.isa.account_type = 'general';
  req.accounts.isa.cumulative_contribution_krw = 5000000;
  const res = compute(req, rulesets);
  for (const plan of res.scenarios[0].plans) {
    assert.equal(plan.warnings.length, 0);
  }
});

test('ISA transfer exceeding cumulative contribution is rejected', () => {
  const req = baseRequest();
  req.accounts.isa.exists = true;
  req.accounts.isa.cumulative_contribution_krw = 1000000;
  req.isa_transfer = { amount_krw: 2000000, destination: null, prior_year_applied_extra_credit_krw: null, prior_multi_year_applied_extra_credit_krw: null };
  const res = compute(req, rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'isa_transfer_exceeds_cumulative'));
});

test('ISA transfer with null destination defaults to retirement_pension and raises the combined credit cap', () => {
  const req = baseRequest();
  req.accounts.isa.exists = true;
  req.accounts.isa.cumulative_contribution_krw = 10000000;
  req.isa_transfer = { amount_krw: 5000000, destination: null, prior_year_applied_extra_credit_krw: null, prior_multi_year_applied_extra_credit_krw: null };
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  const scenario = res.scenarios[0];
  assert.ok(scenario.isa_transfer_extra_limit);
  assert.equal(scenario.isa_transfer_extra_limit.destination, 'retirement_pension');
  assert.equal(scenario.isa_transfer_extra_limit.extra_credit_limit_krw, 500000); // min(5M*0.10, 3M-0)
  assert.equal(scenario.limits.pension_combined_credit_limit_krw, 9000000 + 500000);
});

test('isa_transfer=null omits isa_transfer_extra_limit entirely', () => {
  const res = compute(baseRequest(), rulesets);
  assert.equal(res.scenarios[0].isa_transfer_extra_limit, null);
});

test('legal_basis entries copy law text verbatim from the ruleset file, never invented', () => {
  const res = compute(baseRequest(), rulesets);
  const entry = res.scenarios[0].legal_basis.find((l) => l.rule_id === 'pension.credit.rate');
  assert.ok(entry);
  const original = rulesets['2026.json'].rules.find((r) => r.id === 'pension.credit.rate');
  assert.equal(entry.law, original.source.law);
  assert.equal(entry.url, original.source.url);
});

test('proposed scenario carries bill_stages and a proposed_not_enacted warning notice', () => {
  const req = baseRequest({ scenarios: ['current', 'proposed'] });
  req.accounts.isa.exists = true;
  req.accounts.isa.cumulative_contribution_krw = 5000000;
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  assert.equal(res.scenarios.map((s) => s.scenario_id).join(','), 'current,proposed');
  const current = res.scenarios[0];
  const proposed = res.scenarios[1];
  assert.deepEqual(current.bill_stages, []);
  assert.ok(proposed.bill_stages.includes('정부안'));
  assert.ok(proposed.notices.some((n) => n.code === 'proposed_not_enacted'));
  assert.equal(current.is_enacted, true);
  assert.equal(proposed.is_enacted, false);
});

test('proposed ISA annual limit has no years-since-opening carry-forward bonus', () => {
  const req = baseRequest({ scenarios: ['current', 'proposed'] });
  req.accounts.isa.exists = true;
  req.accounts.isa.years_since_opening = 4;
  req.accounts.isa.cumulative_contribution_krw = 0;
  req.profile.monthly_capacity_krw = 20000000;
  req.profile.months_remaining_in_tax_year = 1;
  const res = compute(req, rulesets);
  const currentIsaRoom = res.scenarios[0].limits.by_account.find((a) => a.account === 'isa').contribution_limit_remaining_krw;
  const proposedIsaRoom = res.scenarios[1].limits.by_account.find((a) => a.account === 'isa').contribution_limit_remaining_krw;
  // 현재: 20M * (1+4) - 0 = 100M (총한도로 클램프됨 100M). 개정안: 20M 정액.
  assert.equal(currentIsaRoom, 100000000);
  assert.equal(proposedIsaRoom, 20000000);
});

test('unapplied_proposed_rules lists productive-ISA rules as out of scope', () => {
  const res = compute(baseRequest({ scenarios: ['proposed'] }), rulesets);
  const ids = res.scenarios[0].unapplied_proposed_rules.map((r) => r.rule_id);
  assert.ok(ids.includes('proposed.productive_isa.introduction'));
});

test('missing rule in an incomplete ruleset bundle returns rule_missing, not a thrown error', () => {
  const partial = { '2026.json': { ...rulesets['2026.json'], rules: rulesets['2026.json'].rules.filter((r) => r.id !== 'pension.credit.rate') } };
  const res = compute(baseRequest(), partial);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'rule_missing' && e.params.rule_id === 'pension.credit.rate'));
});

test('computeFundUseHorizonBoundaries matches the boundaries embedded in compute() byte-for-byte', () => {
  const req = baseRequest();
  req.accounts.isa.exists = true;
  req.accounts.isa.years_since_opening = 1;
  const full = compute(req, rulesets);
  const boundariesOnly = computeFundUseHorizonBoundaries(
    { schema_version: SCHEMA_VERSION, tax_year: 2026, birth_date: '1988-03-15', isa_exists: true, isa_years_since_opening: 1, scenario: 'current' },
    rulesets,
  );
  assert.equal(boundariesOnly.ok, true);
  assert.deepEqual(boundariesOnly.boundaries, full.scenarios[0].fund_use_horizon_boundaries);
});

test('computeFundUseHorizonBoundaries never emits fund_use_horizon_not_declared — it does not ask that question', () => {
  const res = computeFundUseHorizonBoundaries(
    { schema_version: SCHEMA_VERSION, tax_year: 2026, birth_date: '1996-05-05', isa_exists: false, isa_years_since_opening: null, scenario: 'current' },
    rulesets,
  );
  assert.equal(res.ok, true);
  assert.ok(!res.notices.some((n) => n.code === 'fund_use_horizon_not_declared'));
});

test('plans collapse to one when allocation vectors are identical', () => {
  const req = baseRequest();
  req.profile.monthly_capacity_krw = 0; // 예산이 0이면 세 안 모두 전부 0 배분으로 수렴한다
  const res = compute(req, rulesets);
  assert.equal(res.scenarios[0].plans.length, 1);
  assert.ok(res.scenarios[0].comparison_note_codes.includes('plans_collapsed_single'));
});

test('ISA age eligibility reads its threshold from the injected ruleset, not a hardcoded literal', () => {
  const req = baseRequest();
  req.accounts.isa.exists = true;
  req.accounts.isa.cumulative_contribution_krw = 1000000;
  // 만 나이는 과세기간 종료일(2026-12-31) 기준이다 — 생년월일로 경계를 만든다.
  req.profile.birth_date = '2007-12-31'; // 2026-12-31에 만 19세 (경계값)
  const res19 = compute(req, rulesets);
  assert.equal(res19.scenarios[0].account_eligibility.find((a) => a.account === 'isa').eligible, true);

  req.profile.birth_date = '2008-12-31'; // 만 18세 — age19 미달, age15_employed는 미확인 입력이라 보수적으로 배제
  const res18 = compute(req, rulesets);
  const isa18 = res18.scenarios[0].account_eligibility.find((a) => a.account === 'isa');
  assert.equal(isa18.eligible, false);
  assert.ok(isa18.reason_codes.includes('isa_excluded_age'));

  // 룰셋의 age19 min_age를 다른 값으로 바꿔도 목이 그 값을 그대로 따라가는지 —
  // 코드에 19가 하드코딩되어 있지 않다는 것을 이 방식으로 확인한다.
  const mutated = JSON.parse(JSON.stringify(rulesets));
  mutated['2026.json'].rules.find((r) => r.id === 'isa.eligibility').value.any_of.find((a) => a.id === 'age19').min_age = 21;
  req.profile.birth_date = '2006-12-31'; // 만 20세
  const resMutated = compute(req, mutated);
  assert.equal(resMutated.scenarios[0].account_eligibility.find((a) => a.account === 'isa').eligible, false);
});

test('delta_vs_baseline_krw is never NaN across every non-baseline plan, even after multiple plans collapse', () => {
  // 회귀 테스트 — baseline의 임시 _totalCredit 필드가 자기 자신을 먼저 지운 뒤
  // 다른 안이 그 지워진 값을 참조해 NaN을 내던 버그를 브라우저에서 실제로
  // 잡았다(연금저축을 먼저 채우는 배분 행이 "NaN원"으로 표시됨).
  const req = baseRequest();
  req.profile.current_year_total_salary_krw = 62000000; // 12% 구간
  req.profile.monthly_capacity_krw = 800000;
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  for (const scenario of res.scenarios) {
    for (const plan of scenario.plans) {
      assert.ok(Number.isFinite(plan.delta_vs_baseline_krw), `${plan.plan_id}.delta_vs_baseline_krw was ${plan.delta_vs_baseline_krw}`);
      assert.ok(plan.delta_vs_baseline_krw <= 0);
    }
  }
  // 이 입력에서는 실제로 2개 이상의 서로 다른 배분안이 나와야 회귀를 검증한다.
  assert.ok(res.scenarios[0].plans.length >= 2);
});

test('no plan ever contains a negative allocation or a negative credit amount', () => {
  const req = baseRequest();
  req.accounts.annuity_savings.ytd_contribution_krw = 999999999; // 이미 한도 초과
  req.accounts.retirement_pension.ytd_contribution_krw = 999999999;
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  for (const plan of res.scenarios[0].plans) {
    for (const a of plan.allocations) assert.ok(a.annual_krw >= 0);
    assert.ok(plan.deterministic_benefit.pension_credit_total_krw >= 0);
  }
  assert.ok(res.scenarios[0].notices.some((n) => n.code === 'existing_contribution_over_limit'));
});

// ---------------------------------------------------------------------------
// 계약 4.0.0 — 목이 낡으면 테스트가 통과해도 아무것도 증명하지 않는다
//
// 그래서 목을 **실제 엔진과 대조한다.** 값이 아니라 **형태**를 본다 — 배분
// 알고리즘은 근사치라고 이 파일 머리말이 밝혔고, 목의 책임은 계약의 타입·필드·
// 코드를 정확히 지키는 것까지다. 계약이 또 major로 오르면 이 테스트가 먼저 깨진다.
// ---------------------------------------------------------------------------

import { compute as realCompute, SCHEMA_VERSION as REAL_SCHEMA_VERSION } from '../../engine/index.mjs';

test('the mock speaks the same contract major as the real engine', () => {
  assert.equal(SCHEMA_VERSION.split('.')[0], REAL_SCHEMA_VERSION.split('.')[0]);
});

test('a 3.x request is rejected outright — the mock does not quietly keep computing', () => {
  const res = compute(baseRequest({ schema_version: '3.3.1' }), rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'schema_version_mismatch'));
});

test('the three fields 4.0.0 made required are actually required', () => {
  for (const drop of [
    (r) => delete r.profile.birth_date,
    (r) => delete r.profile.prior_year_tax,
    (r) => delete r.accounts.annuity_savings.annuity_start_status,
  ]) {
    const req = baseRequest();
    drop(req);
    const res = compute(req, rulesets);
    assert.equal(res.ok, false, '없으면 부분 결과를 내지 않는다');
    assert.ok(res.errors.some((e) => e.code === 'missing_required'));
  }
});

test('an invalid birth date never repeats the value back in the error params', () => {
  const req = baseRequest();
  req.profile.birth_date = '1988-13-45';
  const res = compute(req, rulesets);
  assert.equal(res.ok, false);
  const e = res.errors.find((x) => x.code === 'invalid_date');
  assert.ok(e);
  assert.ok(!JSON.stringify(e.params).includes('1988'), JSON.stringify(e.params));
});

function shape(value, depth = 0) {
  if (Array.isArray(value)) return depth > 4 ? '[]' : [shape(value[0], depth + 1)];
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = depth > 4 ? '…' : shape(value[k], depth + 1);
    return out;
  }
  return typeof value;
}

test('the mock response has exactly the shape the real engine produces', () => {
  const req = baseRequest({ scenarios: ['current'] });
  req.accounts.isa.exists = true;
  req.accounts.isa.account_type = 'general';
  req.accounts.isa.cumulative_contribution_krw = 5000000;
  req.profile.prior_year_tax = { state: 'amount', determined_tax_krw: 3000000, pension_credit_applied_krw: null };

  const mockRes = compute(req, rulesets);
  const realRes = realCompute(req, rulesets);
  assert.equal(mockRes.ok, true);
  assert.equal(realRes.ok, true, JSON.stringify(realRes.errors));

  assert.deepEqual(Object.keys(mockRes).sort(), Object.keys(realRes).sort());
  assert.deepEqual(Object.keys(mockRes.echo).sort(), Object.keys(realRes.echo).sort());
  assert.deepEqual(shape(mockRes.echo.derived_age), shape(realRes.echo.derived_age));
  assert.deepEqual(shape(mockRes.echo.tax_liability_cap_affects), shape(realRes.echo.tax_liability_cap_affects));

  const m = mockRes.scenarios[0];
  const r = realRes.scenarios[0];
  assert.deepEqual(Object.keys(m).sort(), Object.keys(r).sort());
  assert.deepEqual(shape(m.pension_credit_tax_liability_cap), shape(r.pension_credit_tax_liability_cap));
  assert.deepEqual(shape(m.pension_withdrawal_start[0]), shape(r.pension_withdrawal_start[0]));
  assert.deepEqual(Object.keys(m.limits).sort(), Object.keys(r.limits).sort());
  assert.deepEqual(Object.keys(m.limits.by_account[0]).sort(), Object.keys(r.limits.by_account[0]).sort());
  assert.deepEqual(Object.keys(m.plans[0]).sort(), Object.keys(r.plans[0]).sort());
  assert.deepEqual(Object.keys(m.plans[0].deterministic_benefit).sort(), Object.keys(r.plans[0].deterministic_benefit).sort());
  assert.deepEqual(
    Object.keys(m.plans[0].deterministic_benefit.tax_liability_cap).sort(),
    Object.keys(r.plans[0].deterministic_benefit.tax_liability_cap).sort(),
  );
  assert.deepEqual(Object.keys(m.plans[0].priority_basis).sort(), Object.keys(r.plans[0].priority_basis).sort());
});

test('the mock agrees with the real engine on the three states the screen branches on', () => {
  const cases = [
    { label: '모름', prior: { state: 'unknown', determined_tax_krw: null, pension_credit_applied_krw: null } },
    { label: '0', prior: { state: 'amount', determined_tax_krw: 0, pension_credit_applied_krw: null } },
    { label: '잘림', prior: { state: 'amount', determined_tax_krw: 500000, pension_credit_applied_krw: null } },
    { label: '넉넉', prior: { state: 'amount', determined_tax_krw: 5000000, pension_credit_applied_krw: null } },
  ];
  for (const { label, prior } of cases) {
    const req = baseRequest({ scenarios: ['current'] });
    req.profile.prior_year_tax = prior;
    const m = compute(req, rulesets).scenarios[0].plans[0].deterministic_benefit.tax_liability_cap;
    const r = realCompute(req, rulesets).scenarios[0].plans[0].deterministic_benefit.tax_liability_cap;
    // 화면이 상태를 고르는 데 쓰는 세 값이 일치해야 한다(tax-credit-view.js).
    assert.equal(m.known, r.known, label + ': known');
    assert.equal(m.cap_krw, r.cap_krw, label + ': cap_krw');
    assert.equal(m.applied, r.applied, label + ': applied');
  }
});

test('a started annuity takes that account out of the allocation, with a reason the screen can print', () => {
  const req = baseRequest();
  req.accounts.annuity_savings.annuity_start_status = 'started';
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  const entry = res.scenarios[0].account_eligibility.find((e) => e.account === 'annuity_savings');
  assert.equal(entry.eligible, false);
  assert.deepEqual(entry.reason_codes, ['pension_contribution_blocked_annuity_started']);
  for (const plan of res.scenarios[0].plans) {
    assert.equal(plan.allocations.find((a) => a.account === 'annuity_savings').annual_krw, 0);
  }
});

test('an unknown annuity status holds that account back rather than assuming not_started', () => {
  const req = baseRequest();
  req.accounts.retirement_pension.annuity_start_status = 'unknown';
  const res = compute(req, rulesets);
  const entry = res.scenarios[0].account_eligibility.find((e) => e.account === 'retirement_pension');
  assert.equal(entry.eligible, false);
  assert.deepEqual(entry.reason_codes, ['pension_annuity_start_unknown']);
});

test('a zero cap flattens the tax-credit axis and says so, without moving the allocations', () => {
  const withCap = baseRequest();
  withCap.profile.prior_year_tax = { state: 'amount', determined_tax_krw: 0, pension_credit_applied_krw: null };
  const plentiful = baseRequest();
  plentiful.profile.prior_year_tax = { state: 'amount', determined_tax_krw: 9000000, pension_credit_applied_krw: null };

  const zero = compute(withCap, rulesets).scenarios[0];
  const rich = compute(plentiful, rulesets).scenarios[0];

  assert.ok(zero.comparison_note_codes.includes('tax_credit_axis_not_discriminating'));
  assert.ok(!rich.comparison_note_codes.includes('tax_credit_axis_not_discriminating'));
  // **배분은 그대로다** — 한도는 공제액만 자른다(계약 4.2절의 자기 선언).
  assert.deepEqual(
    zero.plans[0].allocations.map((a) => a.annual_krw),
    rich.plans[0].allocations.map((a) => a.annual_krw),
  );
  assert.equal(zero.plans[0].deterministic_benefit.pension_credit_total_krw, 0);
  assert.ok(zero.plans[0].deterministic_benefit.pension_credit_total_before_cap_krw > 0);
  // `isa_first`만 목적함수가 무너지지 않는다 — 그 안의 근거는 인출 가능성이다.
  for (const plan of zero.plans) {
    assert.equal(plan.priority_basis.objective_degenerate, plan.plan_id !== 'isa_first');
  }
});
