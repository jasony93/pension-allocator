import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compute, computeFundUseHorizonBoundaries } from './mock-engine.js';

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

function baseRequest(overrides = {}) {
  return {
    schema_version: '2.1.0',
    tax_year: 2026,
    scenarios: ['current'],
    profile: {
      age_years: 38,
      current_year_total_salary_krw: 62000000,
      prior_year_total_salary_krw: null,
      financial_income_taxpayer_last_3_years: null,
      declared_youth: null,
      fund_use_horizon: 'unknown',
      monthly_capacity_krw: 800000,
      months_remaining_in_tax_year: null,
    },
    accounts: {
      annuity_savings: { ytd_contribution_krw: 0 },
      retirement_pension: { ytd_contribution_krw: 0 },
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
    { schema_version: '2.1.0', tax_year: 2026, scenarios: ['current'], profile: {}, accounts: {} },
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
    { schema_version: '2.1.0', tax_year: 2026, age_years: 38, isa_exists: true, isa_years_since_opening: 1, scenario: 'current' },
    rulesets,
  );
  assert.equal(boundariesOnly.ok, true);
  assert.deepEqual(boundariesOnly.boundaries, full.scenarios[0].fund_use_horizon_boundaries);
});

test('computeFundUseHorizonBoundaries never emits fund_use_horizon_not_declared — it does not ask that question', () => {
  const res = computeFundUseHorizonBoundaries(
    { schema_version: '2.1.0', tax_year: 2026, age_years: 30, isa_exists: false, isa_years_since_opening: null, scenario: 'current' },
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
