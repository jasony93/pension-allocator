/**
 * 연금 역산기 탭의 클라이언트 측 유효성 검사. `requirements.md` 9.1·9.4절
 * (AC-R1~AC-R29)의 허용 범위를 구현한다. 첫 탭의 `state/validation.js`와 같은
 * 원칙 — 여기서 계산은 하지 않는다, "이 값을 계산에 쓸 수 있는가"만 판정한다.
 *
 * **만 나이를 만들지 않는다**(D21과 같은 이유). 생년월일·연금 개시일 모두
 * 날짜 형식과 달력상 존재 여부만 이 파일이 본다. 개시일이 최소 개시 연령
 * 미만인지(AC-R5)는 **엔진이 판정**한다(`annuity_start_below_minimum_age`) —
 * 최소 개시 연령이라는 세법 수치를 화면이 알 필요가 없다.
 *
 * 금액 단위는 첫 탭과 같다 — **화면 입력은 만원, 계약은 원**
 * (`parseManwonToWon`을 그대로 가져다 쓴다. 이 파일이 다시 만들지 않는다).
 */

import { parseManwonToWon, parsePercentToRate, validateBirthDate } from './validation.js';

// 첫 탭의 생년월일 검증을 그대로 다시 내보낸다 — 규칙이 같다(과거 또는 오늘,
// 미래는 오류). 이 파일 안에서도 이 이름으로 그대로 쓴다.
export { validateBirthDate };

function isBlankValue(v) {
  return v === '' || v === null || v === undefined;
}

/**
 * `validateBirthDate`와 달리 **미래 날짜를 오류로 보지 않는다.** 연금 개시일은
 * 통상 수십 년 뒤의 미래이고, 이미 수령 중인 사용자를 위해 과거 날짜도 허용해야
 * 한다(9.1절) — 이 필드에는 "오늘보다 미래면 안 된다"는 제약 자체가 없다.
 */
export function validateCalendarDate(value) {
  if (isBlankValue(value)) return { code: 'missing', message: '값을 입력해 주세요.' };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { code: 'incomplete', message: '여덟 자리(연 4 · 월 2 · 일 2)가 필요합니다.' };
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  const existsInCalendar =
    asDate.getUTCFullYear() === year && asDate.getUTCMonth() === month - 1 && asDate.getUTCDate() === day;
  if (!existsInCalendar) return { code: 'not_a_date', message: '달력에 없는 날짜입니다. 월과 일을 확인해 주세요.' };
  if (year < 1000) return { code: 'out_of_range', message: '계산할 수 있는 범위를 벗어난 날짜입니다.' };
  return undefined;
}

function validateReverseNonNegativeAmount(value, { required } = { required: true }) {
  if (isBlankValue(value)) return required ? { code: 'missing', message: '값을 입력해 주세요.' } : undefined;
  const n = parseManwonToWon(value);
  if (Number.isNaN(n)) return { code: 'not_integer', message: '만원 단위 숫자로 넣어 주세요.' };
  if (n < 0) return { code: 'negative', message: '0 이상의 값이 필요합니다.' };
  return undefined;
}

function validatePositiveInteger(value) {
  if (isBlankValue(value)) return { code: 'missing', message: '값을 입력해 주세요.' };
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw) || Number(raw) < 1) return { code: 'out_of_range', message: '1 이상의 정수(년)가 필요합니다.' };
  return undefined;
}

/**
 * 필수 항목 정의 — AC-R3이 못박은 넷(생년월일·원하는 연금 수령액(월)·연금
 * 개시일·연금 필요 기간)만 「법정 사실 블록」의 표시를 가른다. 평균 수익률은
 * 이 목록에 없다 — 9.1절 "첫 탭과 다른 점 하나"가 못박은 대로, 없어도 블록
 * 자체는 완전히 서 있는다(AC-R6).
 */
export const REVERSE_CORE_REQUIREMENTS = [
  { key: 'birthDate', label: '생년월일', fieldId: 'reverseBirthDate' },
  { key: 'targetMonthlyIncome', label: '원하는 연금 수령액(월)', fieldId: 'targetMonthlyIncome' },
  { key: 'annuityStartDate', label: '연금 개시일', fieldId: 'annuityStartDate' },
  { key: 'payoutYears', label: '연금 필요 기간', fieldId: 'payoutYears' },
];

export function validateReverseForm(form, { today } = {}) {
  const errors = {};

  const birthErr = validateBirthDate(form.birthDate, today ?? new Date());
  if (birthErr) errors.birthDate = birthErr;

  if (isBlankValue(form.targetMonthlyIncome)) {
    errors.targetMonthlyIncome = { code: 'missing', message: '값을 입력해 주세요.' };
  } else {
    const n = parseManwonToWon(form.targetMonthlyIncome);
    if (Number.isNaN(n)) errors.targetMonthlyIncome = { code: 'not_integer', message: '만원 단위 숫자로 넣어 주세요.' };
    else if (n <= 0) errors.targetMonthlyIncome = { code: 'out_of_range', message: '0보다 큰 값이 필요합니다.' };
  }

  const startErr = validateCalendarDate(form.annuityStartDate);
  if (startErr) errors.annuityStartDate = startErr;

  const payoutErr = validatePositiveInteger(form.payoutYears);
  if (payoutErr) errors.payoutYears = payoutErr;

  // D77 판정 1 — 기본값·힌트 없음. 비어 있으면 오류가 아니라(선택 필드) 그냥
  // 계좌별 시나리오(②)가 없다(AC-R6). 형식이 틀렸을 때만 오류다.
  if (!isBlankValue(form.averageReturnRatePercent)) {
    const rate = parsePercentToRate(form.averageReturnRatePercent);
    if (Number.isNaN(rate) || rate < 0) {
      errors.averageReturnRatePercent = { code: 'not_a_number', message: '0 이상의 숫자로 넣어 주세요.' };
    }
  }

  const savingsErr = validateReverseNonNegativeAmount(form.annuitySavingsBalance, { required: false });
  if (savingsErr) errors.annuitySavingsBalance = savingsErr;
  const pensionErr = validateReverseNonNegativeAmount(form.retirementPensionBalance, { required: false });
  if (pensionErr) errors.retirementPensionBalance = pensionErr;

  // AC-R9 — ISA 세 항목은 「ISA 계좌 보유 여부」라는 명시 질문 뒤에서만 나타난다.
  if (form.isaExists) {
    const isaBalanceErr = validateReverseNonNegativeAmount(form.isaBalance, { required: true });
    if (isaBalanceErr) errors.isaBalance = isaBalanceErr;
    if (!isBlankValue(form.isaYearsSinceOpening)) {
      const raw = String(form.isaYearsSinceOpening).trim();
      if (!/^\d+$/.test(raw)) errors.isaYearsSinceOpening = { code: 'not_integer', message: '0 이상의 정수(년)로 넣어 주세요.' };
    }
    // AC-R29 — 미입력이면 엔진이 해지 의제 판정을 내지 않을 뿐, 오류는 아니다.
    const cumulativeErr = validateReverseNonNegativeAmount(form.isaCumulativeContribution, { required: false });
    if (cumulativeErr) errors.isaCumulativeContribution = cumulativeErr;
  }

  if (form.deferredRetirementPresent) {
    const deferredErr = validateReverseNonNegativeAmount(form.deferredRetirementAmount, { required: true });
    if (deferredErr) errors.deferredRetirementAmount = deferredErr;
  }

  if (form.publicPensionPlan === 'yes') {
    const publicErr = validateReverseNonNegativeAmount(form.publicPensionExpectedMonthly, { required: true });
    if (publicErr) errors.publicPensionExpectedMonthly = publicErr;
  }

  if (form.otherIncomeKnown) {
    const otherErr = validateReverseNonNegativeAmount(form.otherIncomeAnnual, { required: true });
    if (otherErr) errors.otherIncomeAnnual = otherErr;
  }

  const filled = REVERSE_CORE_REQUIREMENTS.filter((r) => !errors[r.key] && !isBlankValue(form[r.key]));
  const coreComplete = filled.length === REVERSE_CORE_REQUIREMENTS.length;
  const conditionalPending =
    (form.isaExists && (errors.isaBalance || isBlankValue(form.isaBalance))) ||
    (form.deferredRetirementPresent && (errors.deferredRetirementAmount || isBlankValue(form.deferredRetirementAmount))) ||
    (form.publicPensionPlan === 'yes' && (errors.publicPensionExpectedMonthly || isBlankValue(form.publicPensionExpectedMonthly))) ||
    (form.otherIncomeKnown && (errors.otherIncomeAnnual || isBlankValue(form.otherIncomeAnnual)));

  return {
    errors,
    hasErrors: Object.keys(errors).length > 0,
    coreComplete,
    conditionalPending: Boolean(conditionalPending),
    readyToCompute: coreComplete && !conditionalPending && Object.keys(errors).length === 0,
    requiredFilledCount: filled.length,
    requiredTotal: REVERSE_CORE_REQUIREMENTS.length,
  };
}
