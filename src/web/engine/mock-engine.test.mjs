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
      // 5.0.0(D27) — 공제율 판정 축의 첫 물음. 대다수 사용자가 여기다: `false`면
      // 두 번째 물음(종합소득금액)을 아예 묻지 않는다.
      has_non_wage_global_income_current_year: false,
      current_year_global_income_krw: null,
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
  assert.ok(scenario.plans.length >= 1 && scenario.plans.length <= 4);
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
  // `isa_first`·`pension_contribution_limit_fill`은 목적함수가 무너지지 않는다 —
  // 두 안의 근거(인출 가능성 / 납입 한도)는 세액 한도와 무관하게 그대로 성립한다.
  const degenerateNamedPlans = new Set(['max_tax_credit', 'annuity_savings_first']);
  for (const plan of zero.plans) {
    assert.equal(plan.priority_basis.objective_degenerate, degenerateNamedPlans.has(plan.plan_id));
  }
});

// ---------------------------------------------------------------------------
// 어디까지가 "목이 계약을 따른다"이고, 어디부터가 "목이 엔진을 베낀다"인가
//
// 관리자가 물었다. 위 형태 대조가 **키 집합과 값 타입**만 보기 때문에 빈 배열과
// 비지 않은 배열이 같아 보여, 엔진이 `age.reckoning.reference_date`를 실제로 읽기
// 시작한 변화를 잡지 못했다. 넓힐지 말지에 선을 긋는다.
//
// **선을 긋는 기준은 "그 값을 누가 정하는가"다.**
//
// - **계약이 정하는 것 → 대조한다.** 필드 이름, 자료형, 열거형 값, 계약이 "항상
//   이 값"이라고 못박은 고정값, 그리고 **계약이 그 자리에 무엇을 담으라고 정한
//   약속**. `basis_rule_ids`가 여기 든다 — 계약 4.3절이 "룰셋 근거가 없는 순수
//   표시 규칙이면 빈 배열"이라고 정했으므로, **빈 배열은 타입이 아니라 주장이다.**
//   "이 문장에는 법령 근거가 없다"는 주장이고, 그것이 사실과 다르면 화면이 근거
//   있는 문장을 근거 없는 것처럼 다룬다(고지 요소 3이 걸리는 자리다).
//   `params`의 키도 같다 — 문구 사전이 그 키로 문장을 만들기 때문에, 키가 늘거나
//   빠지면 화면 문구가 조용히 낡는다. 이번에 실제로 그렇게 됐다.
//
// - **알고리즘이 정하는 것 → 대조하지 않는다.** 금액·비율·연수·배분 벡터, 그리고
//   **어떤 규칙을 읽었는가**. 이 파일 머리말이 목의 배분 알고리즘을 근사치라고
//   이미 선언했고, 읽는 규칙 목록은 그 알고리즘의 함수다. 실제로 두 구현의
//   `legal_basis` 구성원은 서로 두 건씩 다르다(목은 연금 개시·전환 특례 규칙을
//   읽고, 실제 엔진은 ISA 과세 규칙 둘을 더 읽는다). 그것을 같게 만들라고 요구하면
//   목은 알고리즘까지 같아져야 하고, 그 순간 **목은 두 번째 엔진이지 대조 기준이
//   아니다.** 두 벌을 유지하는 비용만 남고 잡히는 결함은 없다.
//
// 그래서 넓히되 **`assumptions`의 세 술어만** 넓힌다 — 코드 집합, 각 코드의 params
// 키 집합, `basis_rule_ids`가 비었는가. 셋 다 계약이 정한 것이고 셋 다 금액이 아니다.
// 이 셋이 이번 변화를 정확히 잡는다(params 키가 늘었고 basis가 비었다가 찼다).
// ---------------------------------------------------------------------------

/** 배열이 비었는가 / 안 비었는가. **내용이 아니라 주장만 본다.** */
const claimsBasis = (arr) => (Array.isArray(arr) ? arr.length > 0 : null);

test('the mock and the engine make the same assumptions, with the same params keys and the same basis claim', () => {
  const req = baseRequest({ scenarios: ['current'] });
  req.accounts.isa.exists = true;
  req.accounts.isa.account_type = 'general';
  req.accounts.isa.cumulative_contribution_krw = 5000000;

  const mockRes = compute(req, rulesets);
  const realRes = realCompute(req, rulesets);

  const digest = (res) =>
    Object.fromEntries(
      res.assumptions.map((a) => [
        a.code,
        { paramKeys: Object.keys(a.params ?? {}).sort(), claimsBasis: claimsBasis(a.basis_rule_ids) },
      ]),
    );

  const m = digest(mockRes);
  const r = digest(realRes);
  assert.deepEqual(Object.keys(m).sort(), Object.keys(r).sort(), '가정 코드 집합이 다르다');
  for (const code of Object.keys(r)) {
    assert.deepEqual(m[code].paramKeys, r[code].paramKeys, `${code}: params 키가 다르다 — 문구 사전이 조용히 낡는 자리다`);
    assert.equal(m[code].claimsBasis, r[code].claimsBasis, `${code}: 법령 근거가 있다/없다는 주장이 다르다`);
  }
});

test('the age-reference assumption now claims a legal basis, and that rule is in legal_basis with a path back', () => {
  // 이 테스트가 이번 변화 자체를 고정한다. 엔진이 규칙을 읽기 전에는 이 주장이
  // 빈 배열이었고, 그때 화면 문구는 "규칙이 룰셋에 없어"라고 말하고 있었다.
  const res = compute(baseRequest({ scenarios: ['current'] }), rulesets);
  const assumption = res.assumptions.find((a) => a.code === 'age_reference_date_not_in_ruleset');
  assert.ok(assumption.basis_rule_ids.length > 0, '읽은 규칙이 있으면 빈 배열로 두지 않는다');

  const entry = res.scenarios[0].legal_basis.find((l) => l.rule_id === assumption.basis_rule_ids[0]);
  assert.ok(entry, 'basis_rule_ids가 가리키는 규칙이 legal_basis에 없으면 화면이 근거를 붙일 수 없다');
  assert.ok(entry.applied_to.includes('echo.derived_age.reference_date'), '두 방향 연결(계약 5.7절)이 끊긴다');

  // 걸리는 요건만 드러난다. **목록이 룰셋에서 온다는 것을 grep이 아니라 행동으로
  // 확인한다** — 규칙 id 문자열은 다른 목적으로도 코드에 정당하게 등장하므로
  // (`isa.eligibility`는 ISA 자격 판정에도 쓰인다) 문자열 검사로는 가릴 수 없다.
  // 룰셋의 `needs_reference_date`를 뒤집으면 출력이 따라 뒤집혀야 한다.
  const affected = assumption.params.requires_reference_date_rule_ids;
  assert.deepEqual(affected, ['isa.eligibility'], '지금 룰셋이 지목하는 요건');

  const flipped = JSON.parse(JSON.stringify(rulesets));
  for (const entry of flipped['2026.json'].rules.find((r) => r.id === 'age.reckoning.reference_date').value
    .no_single_reference_date.per_rule) {
    entry.needs_reference_date = !entry.needs_reference_date;
  }
  const after = compute(baseRequest({ scenarios: ['current'] }), flipped).assumptions.find(
    (a) => a.code === 'age_reference_date_not_in_ruleset',
  );
  assert.deepEqual(
    after.params.requires_reference_date_rule_ids,
    ['pension.withdrawal.earliest_start'],
    '룰셋을 바꿨는데 목록이 그대로면 코드가 목록을 들고 있는 것이다',
  );
});

test('the mock stops rather than inventing a reference date when the rule is absent', () => {
  // 실제 엔진과 같은 자리에서 같게 멈춘다 — 대체값을 만들지 않는다(계약 8.1절).
  const base = rulesets['2026.json'];
  const stripped = { '2026.json': { ...base, rules: base.rules.filter((r) => r.id !== 'age.reckoning.reference_date') } };
  const mockRes = compute(baseRequest({ scenarios: ['current'] }), stripped);
  const realRes = realCompute(baseRequest({ scenarios: ['current'] }), stripped);
  assert.equal(mockRes.ok, false);
  assert.equal(realRes.ok, false);
  assert.ok(mockRes.errors.some((e) => e.code === 'rule_missing' && e.params.rule_id === 'age.reckoning.reference_date'));
  assert.ok(realRes.errors.some((e) => e.code === 'rule_missing' && e.params.rule_id === 'age.reckoning.reference_date'));
});

// ---------------------------------------------------------------------------
// 계약 5.1.0 — 수익률 가정 (D28·D29·D31). 목적함수를 오염시키지 않는다는 선언과
// 확정/구간/가정의 구분이 자료형으로 지켜지는지를 본다.
// ---------------------------------------------------------------------------

function isaReturnRequest(assumption, overrides = {}) {
  return baseRequest({
    scenarios: ['current'],
    profile: {
      ...baseRequest().profile,
      isa_return_assumption: assumption,
    },
    accounts: {
      ...baseRequest().accounts,
      isa: {
        exists: true,
        account_type: 'general',
        cumulative_contribution_krw: 5000000,
        ytd_contribution_krw: 0,
        years_since_opening: 2,
        other_savings_contract_krw: null,
      },
    },
    ...overrides,
  });
}

test('without isa_return_assumption, the estimate is null everywhere and the screen is told nothing was asked', () => {
  const res = compute(isaReturnRequest(null), rulesets);
  assert.equal(res.ok, true);
  assert.equal(res.echo.isa_return_assumption, null);
  assert.deepEqual(res.echo.isa_return_affects, {
    allocation_amounts: false,
    tax_credit_amounts: false,
    plan_ordering: false,
    warnings: false,
  });
  const scenario = res.scenarios[0];
  for (const plan of scenario.plans) {
    assert.equal(plan.assumption_based_isa_estimate, null);
  }
  assert.ok(scenario.notices.some((n) => n.code === 'isa_return_assumption_not_supplied'));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_benefit_not_quantified'));
});

test('a supplied assumption never moves allocation, tax credit, plan ordering, or warnings — I37', () => {
  const withoutAssumption = compute(isaReturnRequest(null), rulesets);
  const withAssumption = compute(
    isaReturnRequest({ annual_return_rate: 0.07, income_character: 'interest_dividend', settlement_years: null, loss_amount_krw: null }),
    rulesets,
  );
  assert.equal(withoutAssumption.ok, true);
  assert.equal(withAssumption.ok, true);
  const a = withoutAssumption.scenarios[0];
  const b = withAssumption.scenarios[0];
  assert.deepEqual(
    a.plans.map((p) => ({ id: p.plan_id, allocations: p.allocations.map((x) => x.annual_krw), credit: p.deterministic_benefit.pension_credit_total_krw, warnings: p.warnings.length })),
    b.plans.map((p) => ({ id: p.plan_id, allocations: p.allocations.map((x) => x.annual_krw), credit: p.deterministic_benefit.pension_credit_total_krw, warnings: p.warnings.length })),
  );
});

test('a certain income character (interest/dividend) produces a point estimate, never an annual one', () => {
  const res = compute(
    isaReturnRequest({ annual_return_rate: 0.07, income_character: 'interest_dividend', settlement_years: 3, loss_amount_krw: null }),
    rulesets,
  );
  assert.equal(res.ok, true);
  assert.deepEqual(res.echo.isa_return_assumption, {
    annual_return_rate: 0.07,
    income_character: 'interest_dividend',
    settlement_years: 3,
    loss_amount_krw: null,
  });
  const scenario = res.scenarios[0];
  const estimate = scenario.plans[0].assumption_based_isa_estimate;
  assert.equal(estimate.state, 'computed');
  assert.equal(estimate.is_annual, false, 'D28 — 정산 기간 전체의 값이지 연간이 아니다');
  assert.equal(estimate.settlement_years, 3);
  assert.equal(estimate.settlement_years_source, 'user');
  assert.notEqual(estimate.point_estimate_krw, null, '확정적 성격은 점을 낸다');
  assert.equal(estimate.lower_bound_krw, estimate.upper_bound_krw);
  assert.ok(scenario.notices.some((n) => n.code === 'isa_return_estimate_is_not_annual'));
  assert.ok(!scenario.notices.some((n) => n.code === 'isa_return_estimate_reported_as_range'), '점을 낼 수 있으면 구간 안내를 내지 않는다');
  assert.ok(scenario.notices.some((n) => n.code === 'pension_tax_deferral_not_quantified'));
  // 가정을 보내면 이 진술은 거짓이 된다 — 그 계산에서 나가지 않는다.
  assert.ok(!res.assumptions.some((a) => a.code === 'isa_benefit_not_quantified'));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_return_rate_user_supplied' && a.params.annual_return_rate === 0.07));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_return_simple_interest'));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_return_principal_from_contributions'));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_comparison_baseline_is_withholding_only'));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_return_assumes_contract_held_to_settlement'));
  // 정산 기간을 사용자가 줬으므로 계약기간 하한 대체 가정은 나가지 않는다.
  assert.ok(!res.assumptions.some((a) => a.code === 'isa_settlement_years_defaulted_to_min_contract_years'));
  // ISA 배분액이 있으면 narrative 효과는 이 값으로 대체되어야 한다.
  const isaPlanWithAllocation = scenario.plans.find((p) => p.allocations.find((a) => a.account === 'isa').annual_krw > 0);
  if (isaPlanWithAllocation) {
    assert.ok(!isaPlanWithAllocation.non_quantified_effects.some((e) => e.code === 'isa_tax_free_headroom'));
  }
});

test('a mixed or unlisted income character produces a range, never a picked point', () => {
  const res = compute(
    isaReturnRequest({ annual_return_rate: 0.07, income_character: 'mixed_or_unknown', settlement_years: null, loss_amount_krw: null }),
    rulesets,
  );
  assert.equal(res.ok, true);
  const scenario = res.scenarios[0];
  const estimate = scenario.plans[0].assumption_based_isa_estimate;
  assert.equal(estimate.state, 'computed');
  assert.equal(estimate.point_estimate_krw, null, '구간만 정할 수 있을 때 점을 만들지 않는다');
  assert.notEqual(estimate.lower_bound_krw, null);
  assert.notEqual(estimate.upper_bound_krw, null);
  assert.ok(estimate.lower_bound_krw <= estimate.upper_bound_krw);
  assert.ok(scenario.notices.some((n) => n.code === 'isa_return_estimate_reported_as_range'));
  // 정산 기간을 주지 않았으므로 계약기간 하한을 썼다는 가정이 함께 나간다.
  assert.equal(estimate.settlement_years_source, 'ruleset_min_contract_years');
  assert.ok(res.assumptions.some((a) => a.code === 'isa_settlement_years_defaulted_to_min_contract_years'));
  assert.ok(res.assumptions.some((a) => a.code === 'isa_loss_assumed_zero'));
});

test('suppressing the display keeps the computation and the input, but blanks every amount', () => {
  const included = compute(
    isaReturnRequest(
      { annual_return_rate: 0.07, income_character: 'interest_dividend', settlement_years: 3, loss_amount_krw: null },
      { options: { assumption_based_isa_estimate: 'include' } },
    ),
    rulesets,
  );
  const suppressed = compute(
    isaReturnRequest(
      { annual_return_rate: 0.07, income_character: 'interest_dividend', settlement_years: 3, loss_amount_krw: null },
      { options: { assumption_based_isa_estimate: 'suppress' } },
    ),
    rulesets,
  );
  assert.equal(included.ok, true);
  assert.equal(suppressed.ok, true);
  const estimate = suppressed.scenarios[0].plans[0].assumption_based_isa_estimate;
  assert.equal(estimate.state, 'display_suppressed');
  for (const key of ['principal_krw', 'total_return_krw', 'point_estimate_krw', 'lower_bound_krw', 'upper_bound_krw', 'axis_breakdown']) {
    assert.equal(estimate[key], null, `${key}는 표시를 끄면 null이어야 한다`);
  }
  assert.ok(suppressed.scenarios[0].notices.some((n) => n.code === 'isa_return_estimate_display_suppressed'));
  // 계산은 그대로 돈다 — 배분·세액공제액은 표시 여부와 무관하다(0.11절).
  assert.deepEqual(
    included.scenarios[0].plans.map((p) => p.deterministic_benefit.pension_credit_total_krw),
    suppressed.scenarios[0].plans.map((p) => p.deterministic_benefit.pension_credit_total_krw),
  );
});

test('an undeclared ISA type cannot price the estimate — not_computable, never a silent zero', () => {
  const req = isaReturnRequest({ annual_return_rate: 0.07, income_character: 'interest_dividend', settlement_years: 3, loss_amount_krw: null });
  req.accounts.isa.account_type = null;
  const res = compute(req, rulesets);
  assert.equal(res.ok, true);
  const estimate = res.scenarios[0].plans[0].assumption_based_isa_estimate;
  assert.equal(estimate.state, 'not_computable');
  assert.equal(estimate.not_computable_reason_code, 'isa_tax_free_limit_unknown');
  assert.ok(res.scenarios[0].notices.some((n) => n.code === 'isa_return_estimate_not_computable' && n.params.reason_code === 'isa_tax_free_limit_unknown'));
});

test('the annual_return_rate is required and cannot be negative — the screen must not float a default', () => {
  const missingRate = isaReturnRequest({ income_character: 'interest_dividend' });
  const resMissing = compute(missingRate, rulesets);
  assert.equal(resMissing.ok, false);
  assert.ok(resMissing.errors.some((e) => e.code === 'missing_required' && e.field === 'profile.isa_return_assumption.annual_return_rate'));

  const negativeRate = isaReturnRequest({ annual_return_rate: -0.01, income_character: 'interest_dividend' });
  const resNegative = compute(negativeRate, rulesets);
  assert.equal(resNegative.ok, false);
  assert.ok(resNegative.errors.some((e) => e.code === 'negative_value' && e.field === 'profile.isa_return_assumption.annual_return_rate'));
});

test('income_character is required when a rate is supplied — the screen cannot ask for a rate without asking what kind of income it is', () => {
  const req = isaReturnRequest({ annual_return_rate: 0.05 });
  const res = compute(req, rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === 'missing_required' && e.field === 'profile.isa_return_assumption.income_character'));
});

test('the mock and the real engine agree on the estimate shape for a supplied assumption', () => {
  const req = isaReturnRequest({ annual_return_rate: 0.07, income_character: 'interest_dividend', settlement_years: 3, loss_amount_krw: 100000 });
  const mockRes = compute(req, rulesets);
  const realRes = realCompute(req, rulesets);
  assert.equal(mockRes.ok, true);
  assert.equal(realRes.ok, true, JSON.stringify(realRes.errors));
  assert.deepEqual(
    Object.keys(mockRes.echo.isa_return_assumption).sort(),
    Object.keys(realRes.echo.isa_return_assumption).sort(),
  );
  assert.deepEqual(Object.keys(mockRes.echo.isa_return_affects).sort(), Object.keys(realRes.echo.isa_return_affects).sort());
  assert.deepEqual(
    Object.keys(mockRes.scenarios[0].plans[0].assumption_based_isa_estimate).sort(),
    Object.keys(realRes.scenarios[0].plans[0].assumption_based_isa_estimate).sort(),
  );
});
