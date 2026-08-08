import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForm } from './validation.js';

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
