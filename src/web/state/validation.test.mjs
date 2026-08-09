import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForm, formDerivedAssumptionCodes } from './validation.js';
import { assumptionMessage } from '../copy.js';

function baseForm(overrides = {}) {
  return {
    age: '38',
    currentSalary: '62000000',
    priorSalaryEnabled: false,
    priorSalary: '',
    fundUseHorizon: 'unknown',
    monthlyCapacity: '800000',
    annuitySavingsYtd: '0',
    retirementPensionYtd: '0',
    isaExists: false,
    isaAccountType: 'general',
    isaCumulative: '0',
    isaYtd: '0',
    isaTransferEnabled: false,
    isaTransferAmount: '',
    isaTransferDestination: 'retirement_pension',
    isaTransferPriorApplied: '0',
    ...overrides,
  };
}

test('a fully valid core form is ready to compute', () => {
  const result = validateForm(baseForm());
  assert.equal(result.readyToCompute, true);
  assert.equal(result.hasErrors, false);
  assert.equal(result.requiredFilledCount, 4);
});

test('missing any of the four core fields blocks computation without erroring the others', () => {
  const result = validateForm(baseForm({ monthlyCapacity: '' }));
  assert.equal(result.readyToCompute, false);
  assert.equal(result.coreComplete, false);
  assert.ok(!result.errors.age);
});

test('non-integer age is rejected', () => {
  const result = validateForm(baseForm({ age: '38.5' }));
  assert.equal(result.errors.age.code, 'not_integer');
});

test('non-numeric age is rejected', () => {
  const result = validateForm(baseForm({ age: 'abc' }));
  assert.equal(result.errors.age.code, 'not_integer');
});

test('negative salary, capacity, and ytd contributions are all rejected', () => {
  const result = validateForm(baseForm({ currentSalary: '-1', monthlyCapacity: '-1', annuitySavingsYtd: '-1' }));
  assert.equal(result.errors.currentSalary.code, 'negative');
  assert.equal(result.errors.monthlyCapacity.code, 'negative');
  assert.equal(result.errors.annuitySavingsYtd.code, 'negative');
});

test('ytd contributions default to 0 and do not block computation when left blank', () => {
  const result = validateForm(baseForm({ annuitySavingsYtd: '', retirementPensionYtd: '' }));
  assert.equal(result.readyToCompute, true);
  assert.equal(result.hasErrors, false);
});

test('fund_use_horizon has no default — leaving it unselected blocks computation', () => {
  const result = validateForm(baseForm({ fundUseHorizon: null }));
  assert.equal(result.readyToCompute, false);
  assert.equal(result.errors.fundUseHorizon.code, 'missing');
});

test('ISA fields are not evaluated at all when ISA is not held', () => {
  const result = validateForm(baseForm({ isaExists: false, isaCumulative: '-999' }));
  assert.equal(result.hasErrors, false, 'isaCumulative should be ignored while isaExists is false');
});

test('enabling ISA transfer without an amount blocks computation even though core fields are valid', () => {
  const result = validateForm(baseForm({ isaExists: true, isaCumulative: '5000000', isaTransferEnabled: true, isaTransferAmount: '' }));
  assert.equal(result.coreComplete, true);
  assert.equal(result.conditionalPending, true);
  assert.equal(result.readyToCompute, false);
});

test('ISA transfer amount exceeding cumulative contribution is rejected', () => {
  const result = validateForm(
    baseForm({ isaExists: true, isaCumulative: '1000000', isaTransferEnabled: true, isaTransferAmount: '2000000' }),
  );
  assert.equal(result.errors.isaTransferAmount.code, 'exceeds_cumulative');
});

test('ISA transfer amount of exactly the cumulative contribution is valid (boundary)', () => {
  const result = validateForm(
    baseForm({ isaExists: true, isaCumulative: '1000000', isaTransferEnabled: true, isaTransferAmount: '1000000' }),
  );
  assert.equal(result.readyToCompute, true);
});

test('ISA ytd contribution exceeding cumulative contribution is rejected', () => {
  const result = validateForm(baseForm({ isaExists: true, isaCumulative: '1000000', isaYtd: '2000000' }));
  assert.equal(result.errors.isaYtd.code, 'exceeds_cumulative');
});

test('turning ISA transfer off does not require an amount even if ISA is held', () => {
  const result = validateForm(baseForm({ isaExists: true, isaTransferEnabled: false }));
  assert.equal(result.readyToCompute, true);
});

// --- Q2: 조건부 필수 항목이 비면 화면이 그 사실을 말할 수 있어야 한다 ---------
//
// 4단계 qa 결함 Q2. 검증은 원래도 정확했다 — 문제는 그 판정을 **표시할 자리가
// 없었던 것**이다. 여기서는 판정이 그대로임을 고정하고, 표시 쪽은
// `input-panel`의 `showMissing`과 결과 패널의 `conditionalPending` 배너가 맡는다.

test('a blank conditional-required field is flagged as missing and blocks computing', () => {
  const result = validateForm(baseForm({ isaExists: true, isaTransferEnabled: true, isaTransferAmount: '' }));
  assert.equal(result.errors.isaTransferAmount.code, 'missing');
  assert.equal(result.conditionalPending, true);
  assert.equal(result.readyToCompute, false);
  assert.ok(result.errors.isaTransferAmount.message.length > 0, '표시할 문장이 없으면 화면이 침묵한다');
});

test('conditionalPending clears as soon as the amount is filled', () => {
  const result = validateForm(baseForm({ isaExists: true, isaTransferEnabled: true, isaTransferAmount: '10000000', isaCumulative: '20000000' }));
  assert.equal(result.conditionalPending, false);
  assert.equal(result.readyToCompute, true);
});

// --- 화면 파생 가정 항목 (screens.md 4.5절) ----------------------------------

test('untouched year-to-date contributions produce the assumption item that the checklist promises', () => {
  const codes = formDerivedAssumptionCodes(baseForm());
  assert.ok(codes.includes('existing_contribution_untouched'), '입력 부족 화면이 "아래 가정에 적습니다"라고 약속한 항목이다');
});

test('a nonzero prior contribution removes that item', () => {
  const codes = formDerivedAssumptionCodes(baseForm({ annuitySavingsYtd: '3000000' }));
  assert.ok(!codes.includes('existing_contribution_untouched'));
});

test('not holding an ISA is recorded as an assumption, holding one is not', () => {
  assert.ok(formDerivedAssumptionCodes(baseForm({ isaExists: false })).includes('isa_not_held_excluded'));
  assert.ok(!formDerivedAssumptionCodes(baseForm({ isaExists: true })).includes('isa_not_held_excluded'));
});

test('the ISA type and transfer destination items appear only when those inputs are in play', () => {
  const noIsa = formDerivedAssumptionCodes(baseForm({ isaExists: false }));
  assert.ok(!noIsa.includes('isa_account_type_defaulted'));
  assert.ok(!noIsa.includes('transfer_destination_defaulted'));

  const withIsa = formDerivedAssumptionCodes(baseForm({ isaExists: true, isaTransferEnabled: true }));
  assert.ok(withIsa.includes('isa_account_type_defaulted'));
  assert.ok(withIsa.includes('transfer_destination_defaulted'));

  const lowIncomeToAnnuity = formDerivedAssumptionCodes(
    baseForm({ isaExists: true, isaAccountType: 'low_income', isaTransferEnabled: true, isaTransferDestination: 'annuity_savings' }),
  );
  assert.ok(!lowIncomeToAnnuity.includes('isa_account_type_defaulted'));
  assert.ok(!lowIncomeToAnnuity.includes('transfer_destination_defaulted'));
});

test('every screen-derived assumption code has a sentence in the dictionary', () => {
  const codes = formDerivedAssumptionCodes(baseForm({ isaExists: true, isaTransferEnabled: true }));
  assert.ok(codes.length > 0);
  for (const code of codes) assert.notEqual(assumptionMessage(code, {}), code, `${code}에 대응하는 문구가 없다`);
});
