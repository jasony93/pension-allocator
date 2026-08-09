import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { taxCreditHeadlineView, isBoundedHeadline, anyPlanCapApplied, HEADLINE_MODE } from './tax-credit-view.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function plan({ total = 1188000, beforeCap = 1188000, cap = {} } = {}) {
  return {
    deterministic_benefit: {
      pension_credit_income_tax_krw: Math.round(total / 1.1),
      pension_credit_local_tax_krw: total - Math.round(total / 1.1),
      pension_credit_total_krw: total,
      pension_credit_income_tax_before_cap_krw: Math.round(beforeCap / 1.1),
      pension_credit_local_tax_before_cap_krw: beforeCap - Math.round(beforeCap / 1.1),
      pension_credit_total_before_cap_krw: beforeCap,
      credit_eligible_contribution_krw: 9000000,
      tax_liability_cap: {
        known: true,
        cap_krw: 3000000,
        applied: false,
        reduced_income_tax_krw: 0,
        reduced_local_tax_krw: 0,
        reduced_total_krw: 0,
        threshold_income_tax_krw: 1080000,
        credit_carryforward: false,
        contribution_carryover_available: false,
        error_direction_code: null,
        basis_rule_ids: ['pension.credit.tax_liability_cap'],
        ...cap,
      },
      basis_rule_ids: [],
    },
  };
}

test('a plan with room to spare is the plain state — 4.8절이 걸리지 않는다', () => {
  assert.equal(taxCreditHeadlineView(plan()).mode, HEADLINE_MODE.PLAIN);
});

test('an unknown cap is the bounded state and carries the engine threshold', () => {
  const view = taxCreditHeadlineView(
    plan({ cap: { known: false, cap_krw: null, error_direction_code: 'overstated_or_equal', threshold_income_tax_krw: 1080000 } }),
  );
  assert.equal(view.mode, HEADLINE_MODE.BOUNDED);
  assert.equal(view.thresholdIncomeTaxKrw, 1080000);
  assert.equal(view.errorDirectionCode, 'overstated_or_equal');
});

test('a cap of exactly zero is the zero state, never the same as unknown', () => {
  // 계약 10절 — `cap_krw: 0`과 `cap_krw: null`을 같게 다루지 않는다.
  const zero = taxCreditHeadlineView(plan({ total: 0, beforeCap: 1188000, cap: { cap_krw: 0, applied: true, reduced_total_krw: 1188000 } }));
  assert.equal(zero.mode, HEADLINE_MODE.ZERO);
  const unknown = taxCreditHeadlineView(plan({ cap: { known: false, cap_krw: null } }));
  assert.equal(unknown.mode, HEADLINE_MODE.BOUNDED);
  assert.notEqual(zero.mode, unknown.mode);
});

test('a cap that bit is the reduced state and exposes both the before and the cut amount', () => {
  const view = taxCreditHeadlineView(
    plan({ total: 900000, beforeCap: 1188000, cap: { cap_krw: 900000, applied: true, reduced_total_krw: 288000, contribution_carryover_available: true } }),
  );
  assert.equal(view.mode, HEADLINE_MODE.REDUCED);
  assert.equal(view.totalKrw, 900000);
  assert.equal(view.beforeCapKrw, 1188000);
  assert.equal(view.reducedTotalKrw, 288000);
  assert.equal(view.contributionCarryoverAvailable, true);
});

test('the view never subtracts — the cut amount comes from the engine, not from the two totals', () => {
  // 계약 5.6절·10절: **두 값의 뺄셈을 화면이 하지 않는다.** 엔진이 어긋난 값을
  // 보내면 화면은 엔진 값을 그대로 보인다(그래야 어긋남이 드러난다).
  const view = taxCreditHeadlineView(
    plan({ total: 900000, beforeCap: 1188000, cap: { applied: true, reduced_total_krw: 111111 } }),
  );
  assert.equal(view.reducedTotalKrw, 111111, '288000을 계산해 내면 화면이 뺄셈을 한 것이다');

  const source = readFileSync(path.join(here, 'tax-credit-view.js'), 'utf8');
  const body = source.slice(source.indexOf('export function taxCreditHeadlineView'));
  assert.ok(!/[^/*\s]\s-\s/.test(body.replace(/\/\/.*$/gm, '')), `산술 연산이 들어 있다:\n${body}`);
});

test('a response without a cap block does not crash the screen', () => {
  const view = taxCreditHeadlineView({ deterministic_benefit: { pension_credit_total_krw: 5 } });
  assert.equal(view.mode, HEADLINE_MODE.PLAIN);
  assert.equal(view.totalKrw, 5);
});

test('the scenario-level helpers read every plan, because the cut can differ per plan', () => {
  // 계약 3.5절 E3 — 잘림은 배분안 단위로 나온다. 첫 안만 보면 놓친다.
  const scenario = { plans: [plan(), plan({ cap: { applied: true } })] };
  assert.equal(anyPlanCapApplied(scenario), true);
  assert.equal(anyPlanCapApplied({ plans: [plan(), plan()] }), false);
  assert.equal(isBoundedHeadline(plan({ cap: { known: false } })), true);
  assert.equal(isBoundedHeadline(plan()), false);
});

test('no tax figure is hardcoded in this module', () => {
  const source = readFileSync(path.join(here, 'tax-credit-view.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const numbers = source.match(/\b\d{3,}\b/g) ?? [];
  assert.deepEqual(numbers, [], `세법 수치로 읽힐 수 있는 리터럴이 있다: ${numbers.join(', ')}`);
});
