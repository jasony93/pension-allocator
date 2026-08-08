/**
 * 입력 폼의 클라이언트 측 유효성 검사. `requirements.md` 6절 수용 기준의
 * 허용 범위를 그대로 구현한다. 여기서 계산은 하지 않는다 — "이 값을 계산에
 * 쓸 수 있는가"만 판정한다.
 *
 * `RequirementChecklist`의 분모는 무조건 필수인 네 항목으로 고정한다
 * (`screens.md` 3.5절) — 나이 · 총급여액 · 월 납입 여력 · 자금 사용 시점.
 * 기납입액은 진행을 막지 않고, 조건부 필수 항목(전환 금액)은 분모에 넣지 않는다.
 */

export const CORE_REQUIRED_FIELDS = ['age', 'currentSalary', 'monthlyCapacity', 'fundUseHorizon'];

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function parseIntStrict(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  if (typeof v !== 'string' || v.trim() === '') return NaN;
  if (!/^-?\d+$/.test(v.trim())) return NaN; // 소수점·문자 거부
  return Number.parseInt(v, 10);
}

/**
 * 필드 하나를 검사한다. 반환값이 없으면(undefined) 유효하다는 뜻이다.
 */
function validateAge(form) {
  if (isBlank(form.age)) return { code: 'missing', message: '나이를 입력해 주세요.' };
  const n = parseIntStrict(form.age);
  if (Number.isNaN(n)) return { code: 'not_integer', message: '정수(만 나이)로 입력해 주세요.' };
  if (n < 0) return { code: 'negative', message: '0 이상의 값이 필요합니다.' };
  return undefined;
}

function validateNonNegativeAmount(value, { required } = { required: true }) {
  if (isBlank(value)) return required ? { code: 'missing', message: '값을 입력해 주세요.' } : undefined;
  const n = parseIntStrict(value);
  if (Number.isNaN(n)) return { code: 'not_integer', message: '숫자로 입력해 주세요.' };
  if (n < 0) return { code: 'negative', message: '0 이상의 값이 필요합니다.' };
  return undefined;
}

export function validateForm(form) {
  const errors = {};

  const ageErr = validateAge(form);
  if (ageErr) errors.age = ageErr;

  const salaryErr = validateNonNegativeAmount(form.currentSalary);
  if (salaryErr) errors.currentSalary = salaryErr;

  if (form.priorSalaryEnabled) {
    const priorErr = validateNonNegativeAmount(form.priorSalary);
    if (priorErr) errors.priorSalary = priorErr;
  }

  if (!form.fundUseHorizon) {
    errors.fundUseHorizon = { code: 'missing', message: '자금 사용 시점을 선택해 주세요.' };
  }

  const capacityErr = validateNonNegativeAmount(form.monthlyCapacity);
  if (capacityErr) errors.monthlyCapacity = capacityErr;

  const annuityErr = validateNonNegativeAmount(form.annuitySavingsYtd, { required: false });
  if (annuityErr) errors.annuitySavingsYtd = annuityErr;
  const retirementErr = validateNonNegativeAmount(form.retirementPensionYtd, { required: false });
  if (retirementErr) errors.retirementPensionYtd = retirementErr;

  if (form.isaExists) {
    const cumulativeErr = validateNonNegativeAmount(form.isaCumulative, { required: false });
    if (cumulativeErr) errors.isaCumulative = cumulativeErr;
    const ytdErr = validateNonNegativeAmount(form.isaYtd, { required: false });
    if (ytdErr) errors.isaYtd = ytdErr;
    if (
      !ytdErr &&
      !cumulativeErr &&
      parseIntStrict(form.isaYtd || '0') > parseIntStrict(form.isaCumulative || '0')
    ) {
      errors.isaYtd = { code: 'exceeds_cumulative', message: 'ISA 당해연도 납입액은 누적 납입액을 넘을 수 없습니다.' };
    }

    if (form.isaTransferEnabled) {
      if (isBlank(form.isaTransferAmount)) {
        errors.isaTransferAmount = { code: 'missing', message: '전환 금액을 입력해 주세요.' };
      } else {
        const n = parseIntStrict(form.isaTransferAmount);
        if (Number.isNaN(n)) errors.isaTransferAmount = { code: 'not_integer', message: '숫자로 입력해 주세요.' };
        else if (n < 1) errors.isaTransferAmount = { code: 'out_of_range', message: '1원 이상이어야 합니다.' };
        else if (!cumulativeErr && n > parseIntStrict(form.isaCumulative || '0')) {
          errors.isaTransferAmount = {
            code: 'exceeds_cumulative',
            message: 'ISA 누적 납입액을 넘을 수 없습니다.',
          };
        }
      }
      const priorAppliedErr = validateNonNegativeAmount(form.isaTransferPriorApplied, { required: false });
      if (priorAppliedErr) errors.isaTransferPriorApplied = priorAppliedErr;
    }
  }

  const coreComplete = CORE_REQUIRED_FIELDS.every((f) => !errors[f] && !isBlank(form[f]));
  const conditionalPending =
    form.isaExists && form.isaTransferEnabled && (errors.isaTransferAmount || isBlank(form.isaTransferAmount));

  const requiredFilledCount = CORE_REQUIRED_FIELDS.filter((f) => !errors[f] && !isBlank(form[f])).length;

  return {
    errors,
    hasErrors: Object.keys(errors).length > 0,
    coreComplete,
    conditionalPending: Boolean(conditionalPending),
    // 계산을 실행할 수 있는가 — 핵심 네 항목이 유효하고, 조건부 필수(활성화된 경우
    // 전환 금액)도 채워져 있어야 한다.
    readyToCompute: coreComplete && !conditionalPending && !Object.keys(errors).length,
    requiredFilledCount,
    requiredTotal: CORE_REQUIRED_FIELDS.length,
  };
}

export { parseIntStrict };
