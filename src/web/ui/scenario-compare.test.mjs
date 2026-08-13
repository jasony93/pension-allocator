import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioDisplaySnapshot, scenarioDisplaysEqual } from './scenario-compare.js';

/**
 * D46 4번 — 개정안 탭이 확정 탭과 화면상 결과가 같은지를 잰다. 정체성
 * 필드(`scenario_id`·`is_enacted`·`ruleset`)와 화면이 더 이상 렌더하지 않는
 * 조항·개정 단계 필드(`legal_basis`·`bill_stages`·`unapplied_proposed_rules`)는
 * 비교에서 뺀다 — 넣으면 항상 다르다고 나와 비교 자체가 무의미해진다.
 */

function baseScenario(overrides = {}) {
  return {
    scenario_id: 'current',
    is_enacted: true,
    ruleset: { tax_year: 2026, status: '확정' },
    bill_stages: [],
    account_eligibility: [{ account: 'isa', eligible: true, reason_codes: [], basis_rule_ids: [] }],
    limits: { by_account: [{ account: 'isa', contribution_limit_remaining_krw: 20000000 }] },
    pension_credit_tax_liability_cap: { cap_krw: 1000000 },
    pension_credit_ceiling: { ceiling_krw: 1485000 },
    pension_withdrawal_tax_reference: { rate_gap_cases: [] },
    pension_withdrawal_start: [],
    isa_transfer_extra_limit: null,
    fund_use_horizon_boundaries: { within_isa_lock_in_years: 3 },
    plans: [{ plan_id: 'max_tax_credit', is_baseline: true, allocations: [] }],
    comparison_note_codes: [],
    legal_basis: [{ rule_id: 'isa.eligibility', law: '조특법 §91조의18' }],
    unapplied_proposed_rules: [],
    notices: [],
    ...overrides,
  };
}

test('identical display fields with different identity fields are still equal', () => {
  const current = baseScenario();
  const proposed = baseScenario({
    scenario_id: 'proposed',
    is_enacted: false,
    ruleset: { tax_year: 2027, status: '개정예고' },
    bill_stages: ['government_bill'],
    legal_basis: [{ rule_id: 'proposed.isa.something', law: '조특법 §91조의29(안)' }],
    notices: [{ code: 'proposed_not_enacted', severity: 'info', params: {} }],
  });
  assert.equal(scenarioDisplaysEqual(current, proposed), true);
});

test('a real plan amount difference is caught', () => {
  const current = baseScenario();
  const proposed = baseScenario({
    scenario_id: 'proposed',
    is_enacted: false,
    plans: [{ plan_id: 'max_tax_credit', is_baseline: true, allocations: [{ account: 'isa', annual_krw: 1 }] }],
  });
  assert.equal(scenarioDisplaysEqual(current, proposed), false);
});

test('a comparison_note_codes difference is caught', () => {
  const current = baseScenario();
  const proposed = baseScenario({
    scenario_id: 'proposed',
    is_enacted: false,
    comparison_note_codes: ['tax_credit_axis_not_discriminating'],
  });
  assert.equal(scenarioDisplaysEqual(current, proposed), false);
});

test('a non-proposed_not_enacted notice difference is caught', () => {
  const current = baseScenario();
  const proposed = baseScenario({
    scenario_id: 'proposed',
    is_enacted: false,
    notices: [{ code: 'credit_rate_global_income_missing', severity: 'info', params: {} }],
  });
  assert.equal(scenarioDisplaysEqual(current, proposed), false);
});

test('youth_status_not_declared alone does not block equality — it is always present on the proposed side regardless of input', () => {
  const current = baseScenario();
  const proposed = baseScenario({
    scenario_id: 'proposed',
    is_enacted: false,
    notices: [{ code: 'youth_status_not_declared', severity: 'info', field: 'profile.declared_youth', params: {}, basis_rule_ids: [] }],
  });
  assert.equal(scenarioDisplaysEqual(current, proposed), true);
});

test('isa_tenure_missing alone does not block equality — this product never asks years_since_opening', () => {
  // 실측(src/engine/compute.mjs 직접 호출)으로 확인했다 — 이 안내만 다르고
  // limits.by_account[isa]의 실제 금액은 두 시나리오가 같았다.
  const current = baseScenario({
    notices: [{ code: 'isa_tenure_missing', severity: 'warning', field: 'accounts.isa.years_since_opening', params: {}, basis_rule_ids: ['isa.contribution.annual_limit'] }],
  });
  const proposed = baseScenario({ scenario_id: 'proposed', is_enacted: false });
  assert.equal(scenarioDisplaysEqual(current, proposed), true);
});

test('basis_rule_ids differing alone (same rule-set-relative citation, same values) does not block equality', () => {
  const current = baseScenario({
    limits: { by_account: [{ account: 'isa', contribution_limit_remaining_krw: 20000000, basis_rule_ids: ['isa.contribution.annual_limit'] }] },
    plans: [
      {
        plan_id: 'max_tax_credit',
        is_baseline: true,
        allocations: [{ account: 'isa', annual_krw: 1000000, basis_rule_ids: ['isa.contribution.annual_limit'] }],
      },
    ],
  });
  const proposed = baseScenario({
    scenario_id: 'proposed',
    is_enacted: false,
    limits: { by_account: [{ account: 'isa', contribution_limit_remaining_krw: 20000000, basis_rule_ids: ['proposed.isa.annual_contribution_limit'] }] },
    plans: [
      {
        plan_id: 'max_tax_credit',
        is_baseline: true,
        allocations: [{ account: 'isa', annual_krw: 1000000, basis_rule_ids: ['proposed.isa.annual_contribution_limit'] }],
      },
    ],
  });
  assert.equal(scenarioDisplaysEqual(current, proposed), true);
});

test('missing scenarios are never equal', () => {
  assert.equal(scenarioDisplaysEqual(null, baseScenario()), false);
  assert.equal(scenarioDisplaysEqual(baseScenario(), undefined), false);
});

test('snapshot excludes identity and citation fields', () => {
  const snap = scenarioDisplaySnapshot(baseScenario());
  assert.equal('scenario_id' in snap, false);
  assert.equal('is_enacted' in snap, false);
  assert.equal('ruleset' in snap, false);
  assert.equal('bill_stages' in snap, false);
  assert.equal('legal_basis' in snap, false);
  assert.equal('unapplied_proposed_rules' in snap, false);
});
