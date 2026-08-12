import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { taxCreditHeadlineView, anyPlanCapApplied, showsCapBelowCeilingNote, HEADLINE_MODE } from './tax-credit-view.js';

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
        cap_krw: 3000000,
        applied: false,
        binding_code: 'binding_not_determined',
        reduced_income_tax_krw: 0,
        reduced_local_tax_krw: 0,
        reduced_total_krw: 0,
        threshold_income_tax_krw: 1080000,
        credit_carryforward: false,
        contribution_carryover_available: false,
        error_direction_code: 'overstated_or_equal',
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

// 9.0.0(D39·D40) — "모름" 상태가 사라졌다. 한도는 언제나 계산된 값이다.
test('cap_krw is never null now — the view carries it and the upper-bound flag', () => {
  const view = taxCreditHeadlineView(
    plan({ cap: { cap_krw: 1350000, applied: false, error_direction_code: 'overstated_or_equal', binding_code: 'binding_not_determined' } }),
  );
  assert.equal(view.mode, HEADLINE_MODE.PLAIN);
  assert.equal(view.capKrw, 1350000);
  assert.equal(view.isUpperBound, true);
  assert.equal(view.directionIndeterminate, false);
});

// D41 — 종합소득이 있는데 금액을 모르면 방향조차 정해지지 않는다. 이 분기에서는
// binding_code가 언제나 `binding_not_determined`다(applied가 참이어도).
test('a direction-indeterminate branch never claims the cap is provably binding', () => {
  const view = taxCreditHeadlineView(
    plan({
      total: 500000,
      beforeCap: 1188000,
      cap: {
        cap_krw: 500000,
        applied: true,
        error_direction_code: 'direction_indeterminate',
        binding_code: 'binding_not_determined',
        reduced_total_krw: 688000,
      },
    }),
  );
  assert.equal(view.mode, HEADLINE_MODE.REDUCED);
  assert.equal(view.directionIndeterminate, true);
  assert.equal(view.isUpperBound, false);
  assert.equal(view.bindingCode, 'binding_not_determined');
});

test('a cap of exactly zero is absorbed into the reduced state, not a separate one', () => {
  // 계약 5.10절 — 총급여 5,000,000원은 상한이자 등식인 검산 좌표다(D40).
  const zero = taxCreditHeadlineView(
    plan({
      total: 0,
      beforeCap: 1188000,
      cap: { cap_krw: 0, applied: true, reduced_total_krw: 1188000, binding_code: 'binds_provably' },
    }),
  );
  assert.equal(zero.mode, HEADLINE_MODE.REDUCED);
  assert.equal(zero.totalKrw, 0);
});

test('a cap that bit is the reduced state and exposes both the before and the cut amount', () => {
  const view = taxCreditHeadlineView(
    plan({
      total: 900000,
      beforeCap: 1188000,
      cap: { cap_krw: 900000, applied: true, reduced_total_krw: 288000, contribution_carryover_available: true, binding_code: 'binds_provably' },
    }),
  );
  assert.equal(view.mode, HEADLINE_MODE.REDUCED);
  assert.equal(view.totalKrw, 900000);
  assert.equal(view.beforeCapKrw, 1188000);
  assert.equal(view.reducedTotalKrw, 288000);
  assert.equal(view.contributionCarryoverAvailable, true);
  assert.equal(view.bindingCode, 'binds_provably');
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
  assert.equal(view.capKrw, null);
});

test('the scenario-level helper reads every plan, because the cut can differ per plan', () => {
  // 계약 3.5절 E3 — 잘림은 배분안 단위로 나온다. 첫 안만 보면 놓친다.
  const scenario = { plans: [plan(), plan({ cap: { applied: true } })] };
  assert.equal(anyPlanCapApplied(scenario), true);
  assert.equal(anyPlanCapApplied({ plans: [plan(), plan()] }), false);
});

// ---------------------------------------------------------------------------
// D46 1번·D49 — `applied: true`인데 표시 금액이 한 원도 줄지 않는 좌표를
// 값으로 못 박는다. 관리자가 조문으로 검산한 실제 좌표다(총급여 24,795,208원·
// 예산 2,666,667원, 과세표준 14,325,926, 한도의 정확값 400,000.005, 예산의
// 공제액 400,000.05 — `tax-liability-cap.test.mjs`). 표시 금액은 둘 다
// 400,000으로 같아 `reduced_total_krw`가 0인데 `applied`는 참이고
// `binding_code`는 `binds_provably`다.
// ---------------------------------------------------------------------------

test('D49 좌표 — applied: true·binds_provably인데 잘린 표시 금액이 0이면 「짧다」 문장을 보이지 않는다', () => {
  const underOneWon = plan({
    total: 400000,
    beforeCap: 400000,
    cap: { cap_krw: 400000, applied: true, reduced_total_krw: 0, binding_code: 'binds_provably' },
  });
  // `applied`가 여전히 참이라는 사실 자체는 지워지지 않는다 — 다만 그 사실이
  // 「짧다」는 문장의 근거는 아니다.
  assert.equal(underOneWon.deterministic_benefit.tax_liability_cap.applied, true);
  assert.equal(
    showsCapBelowCeilingNote(underOneWon),
    false,
    'applied가 참이어도 reduced_total_krw가 0이면 눈에 보이는 짧음이 없다 — 문장을 보이면 사용자가 없는 것을 찾는다',
  );
});

test('실제로 표시 금액이 줄었고 binds_provably면 「짧다」 문장을 보인다', () => {
  const actuallyCut = plan({
    total: 900000,
    beforeCap: 1188000,
    cap: { cap_krw: 900000, applied: true, reduced_total_krw: 288000, binding_code: 'binds_provably' },
  });
  assert.equal(showsCapBelowCeilingNote(actuallyCut), true);
});

test('binding_not_determined이면 표시 금액이 줄었어도 「짧다」 문장을 보이지 않는다(D40)', () => {
  const notProvable = plan({
    total: 500000,
    beforeCap: 1188000,
    cap: {
      cap_krw: 500000,
      applied: true,
      reduced_total_krw: 688000,
      error_direction_code: 'direction_indeterminate',
      binding_code: 'binding_not_determined',
    },
  });
  assert.equal(showsCapBelowCeilingNote(notProvable), false);
});

// **실제로 깨서 무는지 확인한다**(D42 — "통과만 하는 테스트는 아무것도
// 증명하지 않는다"). `reduced_total_krw > 0` 조건을 빼면 첫 좌표에서
// 게이트가 다시 참을 내야 한다 — 즉 이 세 테스트가 실제로 그 결함을 잡는다.
test('D49 회귀 — reduced_total_krw 조건을 빼면 위 첫 좌표에서 게이트가 다시 참이 된다(결함 재현)', () => {
  const underOneWon = plan({
    total: 400000,
    beforeCap: 400000,
    cap: { cap_krw: 400000, applied: true, reduced_total_krw: 0, binding_code: 'binds_provably' },
  });
  const cap = underOneWon.deterministic_benefit.tax_liability_cap;
  const oldGate = cap.binding_code === 'binds_provably'; // D49 이전 게이트 — reduced_total_krw를 보지 않는다
  assert.equal(oldGate, true, '옛 게이트라면 여기서 참이 나와야 이 테스트가 실제로 결함을 재현한 것이다');
  assert.equal(showsCapBelowCeilingNote(underOneWon), false, '새 게이트는 같은 좌표에서 거짓을 낸다 — 옛 게이트와 실제로 갈린다');
});

test('no tax figure is hardcoded in this module', () => {
  const source = readFileSync(path.join(here, 'tax-credit-view.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const numbers = source.match(/\b\d{3,}\b/g) ?? [];
  assert.deepEqual(numbers, [], `세법 수치로 읽힐 수 있는 리터럴이 있다: ${numbers.join(', ')}`);
});
