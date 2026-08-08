import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store.js';

function fakeEngine({ compute, computeFundUseHorizonBoundaries } = {}) {
  return {
    compute: compute ?? (async () => ({ ok: true, schema_version: '2.1.0', echo: {}, scenarios: [fakeScenario()], assumptions: [] })),
    computeFundUseHorizonBoundaries:
      computeFundUseHorizonBoundaries ??
      (async () => ({ ok: true, schema_version: '2.1.0', boundaries: {}, legal_basis: [], notices: [] })),
  };
}

function fakeScenario(overrides = {}) {
  return {
    scenario_id: 'current',
    is_enacted: true,
    bill_stages: [],
    ruleset: { files: [], tax_year: 2026, status: '확정', effective_from: '2026-01-01' },
    account_eligibility: [
      { account: 'retirement_pension', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'annuity_savings', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'isa', eligible: true, reason_codes: [], basis_rule_ids: [] },
    ],
    limits: { by_account: [], pension_combined_credit_limit_krw: 0, pension_combined_credit_remaining_krw: 0, pension_contribution_limit_remaining_krw: 0, basis_rule_ids: [] },
    isa_transfer_extra_limit: null,
    fund_use_horizon_boundaries: { isa_lock_in_years: 3, isa_lock_in_years_remaining: 3, pension_min_age_years: 55, pension_years_remaining: 17, pension_holding_period_evaluated: false, basis_rule_ids: [] },
    plans: [{ plan_id: 'max_tax_credit', is_baseline: true, warnings: [], priority_basis: { code: 'tax_credit_maximization', fill_sequence: [], basis_rule_ids: [] }, allocations: [], total_allocated_monthly_krw: 0, total_allocated_annual_krw: 0, unallocated_monthly_krw: 0, unallocated_annual_krw: 0, monthly_rounding_residual_krw: 0, deterministic_benefit: { pension_credit_income_tax_krw: 0, pension_credit_local_tax_krw: 0, pension_credit_total_krw: 0, credit_eligible_contribution_krw: 0, basis_rule_ids: [] }, delta_vs_baseline_krw: 0, non_quantified_effects: [] }],
    comparison_note_codes: [],
    legal_basis: [],
    unapplied_proposed_rules: [],
    notices: [],
    ...overrides,
  };
}

function fakeAnalytics() {
  const events = [];
  return { events, track: (name, props) => events.push({ name, props }) };
}

function validForm(store) {
  store.setField('age', '38');
  store.setField('currentSalary', '62000000');
  store.setField('monthlyCapacity', '800000');
  store.setField('fundUseHorizon', 'unknown');
}

test('starts blank and moves to input_incomplete as soon as one field is touched', () => {
  const states = [];
  const store = createStore({ engineClient: fakeEngine(), analytics: fakeAnalytics(), onChange: (s) => states.push(s.status) });
  assert.equal(store.getState().status, 'blank');
  store.setField('age', '38');
  assert.equal(store.getState().status, 'input_incomplete');
});

test('never calls compute until all four core fields are valid, then computes on the trailing field', async () => {
  let calls = 0;
  const engine = fakeEngine({ compute: async () => { calls++; return { ok: true, schema_version: '2.1.0', echo: {}, scenarios: [fakeScenario()], assumptions: [] }; } });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  store.setField('age', '38');
  store.setField('currentSalary', '62000000');
  store.setField('monthlyCapacity', '800000');
  assert.equal(calls, 0);
  store.setField('fundUseHorizon', 'unknown', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls, 1);
  assert.equal(store.getState().status, 'result');
});

test('result_shown fires exactly once even after repeated recomputation', async () => {
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  store.setField('monthlyCapacity', '900000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(analytics.events.filter((e) => e.name === 'result_shown').length, 1);
});

test('has_alternatives passed to analytics reflects plans.length, never raw form values', async () => {
  const analytics = fakeAnalytics();
  const engine = fakeEngine({
    compute: async () => ({
      ok: true,
      schema_version: '2.1.0',
      echo: {},
      scenarios: [fakeScenario({ plans: [fakeScenario().plans[0], { ...fakeScenario().plans[0], plan_id: 'isa_first', is_baseline: false }] })],
      assumptions: [],
    }),
  });
  const store = createStore({ engineClient: engine, analytics, onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  const evt = analytics.events.find((e) => e.name === 'result_shown');
  assert.deepEqual(Object.keys(evt.props), ['has_alternatives']);
  assert.equal(evt.props.has_alternatives, true);
});

test('a stale in-flight request never clobbers a newer one', async () => {
  let resolveFirst;
  let call = 0;
  const engine = fakeEngine({
    compute: async () => {
      call++;
      if (call === 1) {
        await new Promise((r) => (resolveFirst = r));
        return { ok: true, schema_version: '2.1.0', echo: {}, scenarios: [fakeScenario({ ruleset: { files: ['first'], tax_year: 2026, status: '확정', effective_from: '2026-01-01' } })], assumptions: [] };
      }
      return { ok: true, schema_version: '2.1.0', echo: {}, scenarios: [fakeScenario({ ruleset: { files: ['second'], tax_year: 2026, status: '확정', effective_from: '2026-01-01' } })], assumptions: [] };
    },
  });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true }); // 1차 요청 (지연됨)
  store.setField('monthlyCapacity', '900000', { immediate: true }); // 2차 요청 (먼저 끝남)
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().result.scenarios[0].ruleset.files[0], 'second');
  resolveFirst();
  await new Promise((r) => setTimeout(r, 10));
  // 1차 응답이 늦게 도착해도 2차 결과를 덮어쓰지 않는다.
  assert.equal(store.getState().result.scenarios[0].ruleset.files[0], 'second');
});

test('a fatal ruleset_load_failed error clears any prior result and sets fatal_error', async () => {
  const engine = fakeEngine({ compute: async () => ({ ok: false, schema_version: '2.1.0', errors: [{ code: 'ruleset_load_failed', field: null, params: {} }] }) });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'fatal_error');
  assert.equal(store.getState().result, null);
});

test('reset() returns to blank and clears the cached result', async () => {
  const store = createStore({ engineClient: fakeEngine(), analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'result');
  store.reset();
  assert.equal(store.getState().status, 'blank');
  assert.equal(store.getState().result, null);
  assert.equal(store.getState().form.fundUseHorizon, null);
});

test('input_start fires once for the very first touched field only', () => {
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  store.setField('age', '38');
  store.setField('currentSalary', '1');
  assert.equal(analytics.events.filter((e) => e.name === 'input_start').length, 1);
  assert.equal(analytics.events[0].props.field_name, 'age');
});
