import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForm, validateBirthDate, formDerivedAssumptionCodes, CORE_REQUIREMENTS, parseManwonToWon } from './validation.js';
import { assumptionMessage } from '../copy.js';
import { initialForm } from './store.js';

/** 오늘을 고정한다 — 미래 날짜 판정이 달력 날짜에 흔들리면 안 된다. */
const TODAY = new Date(2026, 7, 9);

function baseForm(overrides = {}) {
  return {
    ...initialForm(),
    birthDate: '1988-03-15',
    currentSalary: '62000000',
    priorTaxState: 'amount',
    priorTaxAmount: '3000000',
    annuityStarted: false,
    fundUseHorizon: 'unknown',
    monthlyCapacity: '800000',
    annuitySavingsYtd: '0',
    retirementPensionYtd: '0',
    isaCumulative: '0',
    isaYtd: '0',
    isaTransferPriorApplied: '0',
    ...overrides,
  };
}

const validate = (form) => validateForm(form, { today: TODAY });

test('a fully valid core form is ready to compute', () => {
  const result = validate(baseForm());
  assert.equal(result.readyToCompute, true);
  assert.equal(result.hasErrors, false);
  // 분모는 4에서 6이 됐다 — 생년월일 · 총급여액 · 결정세액 · 월 납입 여력 ·
  // 연금 수령 여부 · 자금 사용 시점(screens.md 3.6절).
  assert.equal(result.requiredFilledCount, 6);
  assert.equal(result.requiredTotal, 6);
});

test('missing any of the core fields blocks computation without erroring the others', () => {
  const result = validate(baseForm({ monthlyCapacity: '' }));
  assert.equal(result.readyToCompute, false);
  assert.equal(result.coreComplete, false);
  assert.ok(!result.errors.birthDate);
});

// --- 생년월일 (screens.md 3.7절 · D21) --------------------------------------

test('the birth date field takes a whole date, not an age — and the form has no age field at all', () => {
  assert.ok(!('age' in initialForm()), '나이는 생년월일로 대체됐다(계약 4.0.0에서 age_years가 사라졌다)');
  assert.ok(CORE_REQUIREMENTS.some((r) => r.key === 'birthDate'));
  assert.ok(!CORE_REQUIREMENTS.some((r) => r.key === 'age'));
});

test('an incomplete birth date asks for eight digits and does not guess', () => {
  assert.equal(validateBirthDate('1988-03', TODAY).code, 'incomplete');
  assert.equal(validateBirthDate('19880315', TODAY).code, 'incomplete');
});

test('a date that is not on the calendar is rejected rather than rolled over', () => {
  // `2월 30일`을 Date에 넘기면 조용히 3월로 넘어간다 — 넘어간 값으로 계산하면
  // 사용자가 넣지 않은 날짜로 결과가 나온다.
  assert.equal(validateBirthDate('2026-02-30', TODAY).code, 'not_a_date');
  assert.equal(validateBirthDate('1988-13-01', TODAY).code, 'not_a_date');
  assert.equal(validateBirthDate('2024-02-29', TODAY), undefined, '윤년 2월 29일은 달력에 있는 날짜다');
});

test('a future birth date is rejected', () => {
  assert.equal(validateBirthDate('2026-08-10', TODAY).code, 'future');
  assert.equal(validateBirthDate('2026-08-09', TODAY), undefined, '오늘은 미래가 아니다');
});

test('no birth date error message repeats what the user typed', () => {
  // D21이 유지한 여섯 못 중 하나. 값을 되풀이하면 DOM에 한 번 더 복제되고
  // `aria-live`로 읽혀 나가며 스크린샷에도 남는다.
  for (const value of ['1988-13-45', '2026-02-30', '2099-01-01', '1988-0', '0500-01-01']) {
    const err = validateBirthDate(value, TODAY);
    if (!err) continue;
    assert.ok(!err.message.includes(value), `오류 문구가 입력값을 되풀이한다: ${err.message}`);
    for (const fragment of value.split('-')) {
      assert.ok(!err.message.includes(fragment), `오류 문구가 입력값 조각을 되풀이한다: ${err.message}`);
    }
  }
});

test('validation never derives an age — the reference date is a tax judgement (D21)', () => {
  const result = validate(baseForm({ birthDate: '1988-03-15' }));
  assert.equal(result.readyToCompute, true);
  for (const key of Object.keys(result)) {
    assert.ok(!/age/i.test(key), `검증 결과에 나이 파생값이 있다: ${key}`);
  }
});

// --- 직전 과세연도 결정세액 (screens.md 3.8절) -------------------------------

test('blank and unknown are different states — blank blocks, unknown computes', () => {
  const blank = validate(baseForm({ priorTaxState: null, priorTaxAmount: '' }));
  assert.equal(blank.readyToCompute, false, '비어 있는 것을 모름으로 간주하면 침묵에서 답을 추론하는 것이다(D14)');
  assert.ok(!blank.errors.priorTaxAmount, '빈 상태는 오류가 아니다 — 체크리스트가 말한다');

  const unknown = validate(baseForm({ priorTaxState: 'unknown', priorTaxAmount: '' }));
  assert.equal(unknown.readyToCompute, true, '모름은 결과를 막지 않는다');
});

test('zero is a valid answer and is not the same as unknown', () => {
  const zero = validate(baseForm({ priorTaxState: 'amount', priorTaxAmount: '0' }));
  assert.equal(zero.readyToCompute, true);
  assert.equal(zero.hasErrors, false);
});

test('a negative determined tax is an error; a decimal one is not — 만원 단위는 소수를 허용한다(6절)', () => {
  assert.equal(validate(baseForm({ priorTaxAmount: '-1' })).errors.priorTaxAmount.code, 'negative');
  // '3.5'만원 = 35,000원 — 만원으로 딱 떨어지지 않는 결정세액을 반올림 없이
  // 받기 위한 것이므로 오류가 아니다.
  assert.equal(validate(baseForm({ priorTaxAmount: '3.5' })).errors.priorTaxAmount, undefined);
  assert.equal(validate(baseForm({ priorTaxAmount: 'abc' })).errors.priorTaxAmount.code, 'not_integer');
  // 소수 넷째 자리(1원)까지만 받는다 — 다섯째 자리부터는 원 단위보다 잘게
  // 쪼개는 것이라 의미가 없다.
  assert.equal(validate(baseForm({ priorTaxAmount: '3.55555' })).errors.priorTaxAmount.code, 'too_precise');
});

test('a determined tax above the salary is a confirmation request, not a block', () => {
  // 차단이 아니라 확인 요청이다(3.8.3절) — 이론적으로 불가능하다고 단정할 근거를
  // 화면이 갖고 있지 않으므로 계산은 진행한다.
  const result = validate(baseForm({ currentSalary: '10000000', priorTaxAmount: '20000000' }));
  assert.equal(result.readyToCompute, true);
  assert.ok(!result.errors.priorTaxAmount);
  assert.equal(result.warnings.priorTaxAmount.code, 'exceeds_salary');
});

// --- 현재 연금 수령 여부 (screens.md 3.10.1절) -------------------------------

test('the annuity-start question has no preselected answer and blocks until answered', () => {
  assert.equal(initialForm().annuityStarted, null, '`아니오`를 미리 채우면 미접촉과 구분되지 않는다(D14)');
  const untouched = validate(baseForm({ annuityStarted: null }));
  assert.equal(untouched.readyToCompute, false);
  assert.equal(untouched.errors.annuityStarted.code, 'missing');
  assert.equal(validate(baseForm({ annuityStarted: true })).readyToCompute, true);
});

test('negative salary, capacity, and ytd contributions are all rejected', () => {
  const result = validate(baseForm({ currentSalary: '-1', monthlyCapacity: '-1', annuitySavingsYtd: '-1' }));
  assert.equal(result.errors.currentSalary.code, 'negative');
  assert.equal(result.errors.monthlyCapacity.code, 'negative');
  assert.equal(result.errors.annuitySavingsYtd.code, 'negative');
});

test('ytd contributions default to 0 and do not block computation when left blank', () => {
  const result = validate(baseForm({ annuitySavingsYtd: '', retirementPensionYtd: '' }));
  assert.equal(result.readyToCompute, true);
  assert.equal(result.hasErrors, false);
});

test('fund_use_horizon has no default — leaving it unselected blocks computation', () => {
  const result = validate(baseForm({ fundUseHorizon: null }));
  assert.equal(result.readyToCompute, false);
  assert.equal(result.errors.fundUseHorizon.code, 'missing');
});

test('ISA fields are not evaluated at all when ISA is not held', () => {
  const result = validate(baseForm({ isaExists: false, isaCumulative: '-999' }));
  assert.equal(result.hasErrors, false, 'isaCumulative should be ignored while isaExists is false');
});

test('enabling ISA transfer without an amount blocks computation even though core fields are valid', () => {
  const result = validate(baseForm({ isaExists: true, isaCumulative: '5000000', isaTransferEnabled: true, isaTransferAmount: '' }));
  assert.equal(result.coreComplete, true);
  assert.equal(result.conditionalPending, true);
  assert.equal(result.readyToCompute, false);
});

test('ISA transfer amount exceeding cumulative contribution is rejected', () => {
  const result = validate(
    baseForm({ isaExists: true, isaCumulative: '1000000', isaTransferEnabled: true, isaTransferAmount: '2000000' }),
  );
  assert.equal(result.errors.isaTransferAmount.code, 'exceeds_cumulative');
});

test('ISA transfer amount of exactly the cumulative contribution is valid (boundary)', () => {
  const result = validate(
    baseForm({ isaExists: true, isaCumulative: '1000000', isaTransferEnabled: true, isaTransferAmount: '1000000' }),
  );
  assert.equal(result.readyToCompute, true);
});

test('ISA ytd contribution exceeding cumulative contribution is rejected', () => {
  const result = validate(baseForm({ isaExists: true, isaCumulative: '1000000', isaYtd: '2000000' }));
  assert.equal(result.errors.isaYtd.code, 'exceeds_cumulative');
});

test('turning ISA transfer off does not require an amount even if ISA is held', () => {
  const result = validate(baseForm({ isaExists: true, isaTransferEnabled: false }));
  assert.equal(result.readyToCompute, true);
});

// --- Q2: 조건부 필수 항목이 비면 화면이 그 사실을 말할 수 있어야 한다 ---------
//
// 4단계 qa 결함 Q2. 검증은 원래도 정확했다 — 문제는 그 판정을 **표시할 자리가
// 없었던 것**이다. 여기서는 판정이 그대로임을 고정하고, 표시 쪽은
// `input-panel`의 `showMissing`과 결과 패널의 `conditionalPending` 배너가 맡는다.

test('a blank conditional-required field is flagged as missing and blocks computing', () => {
  const result = validate(baseForm({ isaExists: true, isaTransferEnabled: true, isaTransferAmount: '' }));
  assert.equal(result.errors.isaTransferAmount.code, 'missing');
  assert.equal(result.conditionalPending, true);
  assert.equal(result.readyToCompute, false);
  assert.ok(result.errors.isaTransferAmount.message.length > 0, '표시할 문장이 없으면 화면이 침묵한다');
});

test('conditionalPending clears as soon as the amount is filled', () => {
  const result = validate(baseForm({ isaExists: true, isaTransferEnabled: true, isaTransferAmount: '10000000', isaCumulative: '20000000' }));
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

// ---------------------------------------------------------------------------
// 6절 — 금액 입력은 만원 단위다. `parseManwonToWon`이 화면 경계의 유일한 변환이다.
// ---------------------------------------------------------------------------

test('a whole 만원 amount converts to the exact won amount', () => {
  assert.equal(parseManwonToWon('5000'), 50000000);
  assert.equal(parseManwonToWon('0'), 0);
});

test('결정세액처럼 만원으로 딱 떨어지지 않는 금액도 반올림 없이 정확한 원으로 변환된다', () => {
  // 1,234,567원을 만원으로 표시하면 소수점을 마지막 네 자리 앞에 찍은 것과
  // 같다 — 사용자는 서류의 숫자에 점 하나만 찍으면 된다.
  assert.equal(parseManwonToWon('123.4567'), 1234567);
  assert.equal(parseManwonToWon('0.0001'), 1);
  assert.equal(parseManwonToWon('80.5'), 805000, '월 납입액처럼 만원 미만 자투리가 있는 값');
});

test('부동소수점을 쓰지 않는다 — 이진 오차가 나는 값에서도 정확하다', () => {
  // `0.1 * 10000`은 부동소수점 연산에서 정확히 1000이 아닐 수 있다(고전적
  // 부동소수점 함정). 문자열 기반 고정소수점 변환이라 이 값에서도 정확하다.
  assert.equal(parseManwonToWon('0.1'), 1000);
  assert.equal(parseManwonToWon('0.0001') + parseManwonToWon('0.0001') + parseManwonToWon('0.0001'), 3);
});

test('다섯째 소수 자리부터는 형식 오류다 — 1원보다 잘게 쪼갤 수 없다', () => {
  assert.ok(Number.isNaN(parseManwonToWon('1.23456')));
});

test('음수·문자·빈 문자열은 형식 오류이거나 형식대로 처리된다', () => {
  assert.ok(Number.isNaN(parseManwonToWon('')));
  assert.ok(Number.isNaN(parseManwonToWon('abc')));
  assert.ok(Number.isNaN(parseManwonToWon('1,000'))); // 쉼표는 표시 형식이지 입력 형식이 아니다
  assert.equal(parseManwonToWon('-5'), -50000, '음수 형식 자체는 파싱되고, 범위 검증은 validateForm이 한다');
});

test('the too_precise error is distinct from a plain format error, so the message can be specific', () => {
  const result = validate(baseForm({ monthlyCapacity: '80.12345' }));
  assert.equal(result.errors.monthlyCapacity.code, 'too_precise');
});

test('ISA 비교(당해연도 vs 누적)는 소수 만원 입력에서도 원 단위로 정확히 비교된다', () => {
  const result = validate(
    baseForm({ isaExists: true, isaCumulative: '100.5', isaYtd: '100.5001' }),
  );
  assert.equal(result.errors.isaYtd.code, 'exceeds_cumulative', '1,005,001원 > 1,005,000원');
});
