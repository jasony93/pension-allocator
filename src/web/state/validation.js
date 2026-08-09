/**
 * 입력 폼의 클라이언트 측 유효성 검사. `requirements.md` 6절 수용 기준의
 * 허용 범위를 그대로 구현한다. 여기서 계산은 하지 않는다 — "이 값을 계산에
 * 쓸 수 있는가"만 판정한다.
 *
 * **만 나이를 만들지 않는다**(D21). 생년월일은 "달력에 있는 날짜인가 / 오늘보다
 * 뒤인가"까지만 본다. 그 날짜에서 만 나이를 얻으려면 **어느 날짜 기준인지**를
 * 정해야 하고 그것은 세법 판단이다 — 화면이 정하면 세무 유닛의 검증을 우회한다.
 * 그래서 요청은 생년월일 원본을 싣고 환산은 엔진이 한다.
 *
 * `RequirementChecklist`의 분모는 **무조건 필수인 여섯 항목**으로 고정한다
 * (`screens.md` 3.6절) — 생년월일 · 총급여액 · 직전 과세연도 결정세액 ·
 * 월 납입 여력 · 연금 수령 여부 · 자금 사용 시점. 늘어난 둘(결정세액·연금 수령
 * 여부)은 **클릭 한 번으로 유효한 답이 되는 형태**라 숫자 입력을 강제하지 않는다.
 * 기납입액은 진행을 막지 않고, 조건부 필수 항목(전환 금액)은 분모에 넣지 않는다.
 */

/**
 * 필수 항목의 정의 자리. 라벨·초점 대상·충족 판정이 한 곳에 모여 있어야
 * 항목이 하나 늘거나 빠져도 체크리스트·진행 막대·검증이 함께 움직인다
 * (`screens.md` 0.4절이 이번 개정에서 세운 규약).
 */
export const CORE_REQUIREMENTS = [
  { key: 'birthDate', label: '생년월일', fieldId: 'birthDate', isFilled: (f) => f.birthDate !== '' },
  { key: 'currentSalary', label: '총급여액', fieldId: 'currentSalary', isFilled: (f) => f.currentSalary !== '' },
  {
    key: 'priorTax',
    label: '직전 과세연도 결정세액',
    fieldId: 'priorTaxAmount',
    // **빈 상태와 `모름` 상태를 구분한다**(D14 · `screens.md` 3.8.3절). 비어 있는
    // 것을 모름으로 간주하면 사용자의 침묵에서 답을 추론하는 것이 된다.
    isFilled: (f) => f.priorTaxState === 'unknown' || (f.priorTaxState === 'amount' && f.priorTaxAmount !== ''),
    hint: '모르면 "모르겠습니다"를 고르면 됩니다. 결과는 나옵니다.',
  },
  { key: 'monthlyCapacity', label: '월 납입 여력', fieldId: 'monthlyCapacity', isFilled: (f) => f.monthlyCapacity !== '' },
  {
    key: 'annuityStarted',
    label: '연금 수령 여부',
    fieldId: 'annuityStarted-false',
    isFilled: (f) => f.annuityStarted === true || f.annuityStarted === false,
  },
  { key: 'fundUseHorizon', label: '자금 사용 시점', fieldId: 'fundUseHorizon-unknown', isFilled: (f) => Boolean(f.fundUseHorizon) },
];

export const CORE_REQUIRED_FIELDS = CORE_REQUIREMENTS.map((r) => r.key);

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function parseIntStrict(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  if (typeof v !== 'string' || v.trim() === '') return NaN;
  if (!/^-?\d+$/.test(v.trim())) return NaN; // 소수점·문자 거부
  return Number.parseInt(v.trim(), 10);
}

/**
 * 생년월일 — `screens.md` 3.7.4절의 네 상태와 오류 문구.
 *
 * **오류 문구에 사용자가 입력한 값을 되풀이하지 않는다**(D21이 유지한 여섯 못 중
 * 하나). 값을 되풀이하면 DOM에 한 번 더 복제되고 `aria-live`로 읽혀 나가며,
 * 스크린샷에도 남는다. 사용자는 자기가 방금 친 값을 필드에서 이미 보고 있다.
 *
 * `today`는 인자로 받는다 — 순수하게 유지해 테스트가 날짜를 고정할 수 있게 한다.
 */
export function validateBirthDate(value, today = new Date()) {
  if (isBlank(value)) return { code: 'missing', message: '생년월일을 입력해 주세요.' };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { code: 'incomplete', message: '여덟 자리(연 4 · 월 2 · 일 2)가 필요합니다.' };

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  // 달력에 있는 날짜인가. `2월 30일`처럼 넘겨 만들면 Date가 조용히 다음 달로 넘어간다.
  const asDate = new Date(Date.UTC(year, month - 1, day));
  const existsInCalendar =
    asDate.getUTCFullYear() === year && asDate.getUTCMonth() === month - 1 && asDate.getUTCDate() === day;
  if (!existsInCalendar) return { code: 'not_a_date', message: '달력에 없는 날짜입니다. 월과 일을 확인해 주세요.' };

  // 네 자리 연도 형식이 담을 수 있는 범위 밖. 세법 수치가 아니라 표기 형식의 경계다.
  if (year < 1000) return { code: 'out_of_range', message: '계산할 수 있는 범위를 벗어난 날짜입니다.' };

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (asDate.getTime() > todayUtc) return { code: 'future', message: '오늘보다 뒤의 날짜는 넣을 수 없습니다.' };

  return undefined;
}

function validateNonNegativeAmount(value, { required } = { required: true }) {
  if (isBlank(value)) return required ? { code: 'missing', message: '값을 입력해 주세요.' } : undefined;
  const n = parseIntStrict(value);
  if (Number.isNaN(n)) return { code: 'not_integer', message: '원 단위 정수로 넣어 주세요.' };
  if (n < 0) return { code: 'negative', message: '0 이상의 값이 필요합니다.' };
  return undefined;
}

/**
 * 직전 과세연도 결정세액 — `screens.md` 3.8.3절.
 *
 * **`0`은 유효한 입력이고 `모름`과 다르다.** `0원`은 "낼 세금이 없다"는 사실이고
 * `모름`은 "얼마인지 모른다"는 사실이다. 두 상태의 결과 화면이 다르다(4.8절).
 */
function validatePriorTax(form) {
  if (form.priorTaxState !== 'amount') return undefined; // 빈·모름은 이 칸의 오류가 될 수 없다
  return validateNonNegativeAmount(form.priorTaxAmount, { required: false });
}

/**
 * **차단이 아니라 확인 요청**(`screens.md` 3.8.3절). 이론적으로 불가능하다고
 * 단정할 근거를 화면이 갖고 있지 않으므로 계산은 그대로 진행하고, 결과를 막는
 * 오류(`state-error`)와 구분해 `state-warning`으로 표시한다.
 */
function priorTaxWarning(form) {
  if (form.priorTaxState !== 'amount') return undefined;
  const tax = parseIntStrict(form.priorTaxAmount);
  const salary = parseIntStrict(form.currentSalary);
  if (Number.isNaN(tax) || Number.isNaN(salary)) return undefined;
  if (tax > salary) return { code: 'exceeds_salary', message: '총급여액보다 큰 값입니다. 두 값을 확인해 주세요.' };
  return undefined;
}

export function validateForm(form, { today } = {}) {
  const errors = {};
  const warnings = {};

  const birthErr = validateBirthDate(form.birthDate, today ?? new Date());
  if (birthErr) errors.birthDate = birthErr;

  const salaryErr = validateNonNegativeAmount(form.currentSalary);
  if (salaryErr) errors.currentSalary = salaryErr;

  const priorTaxErr = validatePriorTax(form);
  if (priorTaxErr) errors.priorTaxAmount = priorTaxErr;
  const priorTaxWarn = priorTaxWarning(form);
  if (priorTaxWarn) warnings.priorTaxAmount = priorTaxWarn;

  if (form.priorSalaryEnabled) {
    const priorErr = validateNonNegativeAmount(form.priorSalary);
    if (priorErr) errors.priorSalary = priorErr;
  }

  if (!form.fundUseHorizon) {
    errors.fundUseHorizon = { code: 'missing', message: '자금 사용 시점을 선택해 주세요.' };
  }
  if (form.annuityStarted !== true && form.annuityStarted !== false) {
    errors.annuityStarted = { code: 'missing', message: '연금 수령 여부를 선택해 주세요.' };
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
        if (Number.isNaN(n)) errors.isaTransferAmount = { code: 'not_integer', message: '원 단위 정수로 넣어 주세요.' };
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

  const errorKeyFor = { priorTax: 'priorTaxAmount' };
  const filled = CORE_REQUIREMENTS.filter((r) => {
    const errorKey = errorKeyFor[r.key] ?? r.key;
    return !errors[errorKey] && r.isFilled(form);
  });
  const coreComplete = filled.length === CORE_REQUIREMENTS.length;
  const conditionalPending =
    form.isaExists && form.isaTransferEnabled && (errors.isaTransferAmount || isBlank(form.isaTransferAmount));

  return {
    errors,
    warnings,
    hasErrors: Object.keys(errors).length > 0,
    coreComplete,
    conditionalPending: Boolean(conditionalPending),
    // 계산을 실행할 수 있는가 — 필수 여섯 항목이 유효하고, 조건부 필수(활성화된
    // 경우 전환 금액)도 채워져 있어야 한다.
    readyToCompute: coreComplete && !conditionalPending && !Object.keys(errors).length,
    requiredFilledCount: filled.length,
    requiredTotal: CORE_REQUIREMENTS.length,
  };
}

/**
 * `[4-E]`에 들어갈 **화면 파생 가정 코드**. 엔진 notice가 아니라 입력 상태에서
 * 나오는 항목들이며 `screens.md` 4.5절 표의 나머지 행이다.
 *
 * 왜 여기 있나 — 문구 사전에는 이 넷이 있는데 **화면이 한 번도 목록에 넣지
 * 않고 있었다.** 그래서 입력 부족 화면의 `기납입액은 … 그 사실을 아래 가정에
 * 적습니다`가 지키지 못할 약속이 되어 있었다. `qa`가 잡은 Q1과 같은 부류다 —
 * 조건부 사실을 말하는 표현이 그 조건을 읽지 않은 자리.
 *
 * 판정하지 않는다. 폼에 무엇이 들어 있는지만 본다. 각 문장은 "무엇을 그대로
 * 두고 계산했는가"를 말하므로 사용자가 그 값을 직접 골랐더라도 참이다.
 */
export function formDerivedAssumptionCodes(form) {
  const codes = [];
  const zero = (v) => isBlank(v) || parseIntStrict(v) === 0;

  if (zero(form.annuitySavingsYtd) && zero(form.retirementPensionYtd) && (!form.isaExists || zero(form.isaYtd))) {
    codes.push('existing_contribution_untouched');
  }
  if (!form.isaExists) codes.push('isa_not_held_excluded');
  if (form.isaExists && form.isaAccountType === 'general') codes.push('isa_account_type_defaulted');
  if (form.isaExists && form.isaTransferEnabled && form.isaTransferDestination === 'retirement_pension') {
    codes.push('transfer_destination_defaulted');
  }
  return codes;
}

export { parseIntStrict };
