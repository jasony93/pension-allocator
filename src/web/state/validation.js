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
 * `RequirementChecklist`의 분모는 **무조건 필수인 일곱 항목**으로 고정한다
 * (`screens.md` 3.6절, 계약 5.0.0으로 D27의 첫 물음이 추가됐다) — 생년월일 ·
 * 총급여액 · 근로소득 외 다른 종합소득 여부 · 직전 과세연도 결정세액 · 월 납입
 * 여력 · 연금 수령 여부 · 자금 사용 시점. 이 중 넷(다른 종합소득 여부·결정세액·
 * 연금 수령 여부·자금 사용 시점)은 **클릭 한 번으로 유효한 답이 되는 형태**라
 * 숫자 입력을 강제하지 않는다. 종합소득금액(둘째 물음)은 **예**를 고른 사람에게만
 * 나타나고 그때도 선택이라 분모에 넣지 않는다 — 모르면 본문 구간으로 계산된다.
 * 기납입액은 진행을 막지 않고, 조건부 필수 항목(전환 금액)은 분모에 넣지 않는다.
 *
 * ---------------------------------------------------------------------------
 * 금액 입력 단위 — **만원**(소유자 지시). "5000"을 입력하면 5,000만원으로
 * 받는다. 계약(`engine-interface.md`)이 받는 단위는 여전히 **원**이므로,
 * 화면 경계(이 파일 · `state/store.js`)에서만 변환한다 — `parseManwonToWon`이
 * 그 경계다.
 *
 * **왜 소수를 허용하는가.** 결정세액처럼 만원으로 딱 떨어지지 않는 금액이
 * 있다(예: 1,234,567원). 만원 정수만 받으면 그 값을 반올림하게 되고, 그 값이
 * 세액공제 한도를 정하므로 사용자가 실제로 받을 금액이 입력 단위 때문에
 * 달라진다 — 이 조직의 "추정하지 않는다" 원칙에 어긋난다. 그래서 정수 대신
 * **소수 넷째 자리(=1원)까지** 받는다. 1원 = 0.0001만원이므로 넷째 자리까지면
 * 어떤 원 단위 금액도 반올림 없이 표현할 수 있다 — 1,234,567원은
 * "123.4567"이고, 원래 값의 마지막 네 자리 앞에 점 하나를 찍는 것과 같다.
 * 결정세액만 예외로 두지 않고 **모든 금액 입력에 같은 규칙을 적용한다** —
 * 다른 금액(기납입액 등)도 만원의 배수가 아닐 수 있고, 그때도 반올림해
 * 계산에 넣으면 같은 문제가 재발한다.
 *
 * **부동소수점을 쓰지 않는다.** `parseFloat(v) * 10000` 같은 계산은 이진
 * 부동소수점 오차로 정확한 원 단위를 보장하지 않는다(`0.1 * 10000`이
 * 정확히 `1000`이 아닐 수 있다). 그래서 문자열을 직접 자르고 이어 붙이는
 * 고정소수점 방식을 쓴다 — 정수 연산만 하므로 오차가 없다.
 * ---------------------------------------------------------------------------
 */

/**
 * 만원 단위 입력 문자열 → 원 단위 정수. 형식이 아니면 `NaN`.
 *
 * 소수 넷째 자리까지만 받는다(`\d{1,4}`) — 다섯째 자리부터는 원 단위보다
 * 더 잘게 쪼개는 것이라 의미가 없고, 정규식이 통째로 실패해 `NaN`을 낸다
 * (호출부가 "너무 정밀하다"는 구체적 오류로 구분해 알린다).
 */
export function parseManwonToWon(v) {
  if (typeof v !== 'string' || v.trim() === '') return NaN;
  const m = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(v.trim());
  if (!m) return NaN;
  const [, sign, intPart, fracPart = ''] = m;
  const won = Number.parseInt(intPart + fracPart.padEnd(4, '0'), 10);
  return sign === '-' ? -won : won;
}

/** 소수점 다섯째 자리 이상 — `parseManwonToWon`이 `NaN`을 내는 이유 중 이 경우만 따로 알린다. */
function isOverPrecise(v) {
  return typeof v === 'string' && /^-?\d+\.\d{5,}$/.test(v.trim());
}

/**
 * D28 수익률 입력 — **퍼센트 문자열 → 비율(0~1)**. `annual_return_rate`는 계약상
 * 0 이상이면 되고 상한이 없다(100% 초과도 형식상 유효). 음수는 형식 자체가
 * 받지 않는다 — 계약이 "음의 수익률이 아니라 `loss_amount_krw`가 손실을
 * 받는다"고 정했으므로 부호 입력란을 아예 만들지 않는다.
 *
 * **나눗셈을 쓰지 않는다.** `parseManwonToWon`과 같은 규율 — 소수점을 문자열
 * 그대로 두 칸 옮겨 짓고 `Number()`를 **한 번만** 부른다. `Number(v) / 100`은
 * 이진 부동소수점 나눗셈을 거치므로, 결과를 `String()`으로 되돌릴 때(엔진의
 * `toRatio`가 그렇게 한다) 다른 자릿수가 새어 나올 여지가 남는다.
 */
export function parsePercentToRate(v) {
  if (typeof v !== 'string' || v.trim() === '') return NaN;
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(v.trim());
  if (!m) return NaN;
  const [, intPart, fracPart = ''] = m;
  const digits = intPart + fracPart;
  const pointPos = intPart.length - 2; // 퍼센트→비율은 소수점을 왼쪽으로 두 칸.
  const text = pointPos <= 0 ? `0.${'0'.repeat(-pointPos)}${digits}` : `${digits.slice(0, pointPos)}.${digits.slice(pointPos)}`;
  return Number(text);
}

/**
 * 필수 항목의 정의 자리. 라벨·초점 대상·충족 판정이 한 곳에 모여 있어야
 * 항목이 하나 늘거나 빠져도 체크리스트·진행 막대·검증이 함께 움직인다
 * (`screens.md` 0.4절이 이번 개정에서 세운 규약).
 */
export const CORE_REQUIREMENTS = [
  { key: 'birthDate', label: '생년월일', fieldId: 'birthDate', isFilled: (f) => f.birthDate !== '' },
  { key: 'currentSalary', label: '총급여액', fieldId: 'currentSalary', isFilled: (f) => f.currentSalary !== '' },
  {
    key: 'hasNonWageIncome',
    label: '근로소득 외 다른 종합소득 여부',
    fieldId: 'hasNonWageIncome-false',
    // 5.0.0(D27) — 예/아니오 어느 쪽도 기본으로 고르지 않는다. `false`로 접으면
    // 결함이 걸리는 바로 그 사람들에게 조용히 틀린 답을 준다(계약 0.6절).
    isFilled: (f) => f.hasNonWageIncome === true || f.hasNonWageIncome === false,
  },
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

/**
 * D29 — 「수익이 어떤 형태로 들어오는가」의 세 답. 계약 3.6절이 고정한 문자열
 * 그대로다. **자산군으로 묻지 않는다** — 한 자산군 안에도 매매차익(혜택 0)과
 * 배당금(혜택 있음)이 섞인다.
 */
export const ISA_INCOME_CHARACTERS = ['interest_dividend', 'listed_equity_capital_gain', 'mixed_or_unknown'];

function isBlank(v) {
  return v === '' || v === null || v === undefined;
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

/** 금액 입력(만원 단위, 소수 넷째 자리까지) 검증. `parseManwonToWon`이 단위 변환의 유일한 통로다. */
function validateNonNegativeAmount(value, { required } = { required: true }) {
  if (isBlank(value)) return required ? { code: 'missing', message: '값을 입력해 주세요.' } : undefined;
  if (isOverPrecise(value)) {
    return { code: 'too_precise', message: '소수점 넷째 자리(1원 단위)까지만 입력할 수 있습니다.' };
  }
  const n = parseManwonToWon(value);
  if (Number.isNaN(n)) return { code: 'not_integer', message: '만원 단위 숫자로 넣어 주세요.' };
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
  const tax = parseManwonToWon(form.priorTaxAmount);
  const salary = parseManwonToWon(form.currentSalary);
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

  if (form.hasNonWageIncome !== true && form.hasNonWageIncome !== false) {
    errors.hasNonWageIncome = { code: 'missing', message: '해당 여부를 선택해 주세요.' };
  }
  // 금액은 **예일 때만** 나타나고, 그때도 선택이다(계약 3.1절) — 비우면 모름으로
  // 취급되고 결과는 본문 구간(우대가 아닌 쪽)으로 계산된다. 값을 입력했다면
  // 형식만 확인한다.
  if (form.hasNonWageIncome === true) {
    const globalIncomeErr = validateNonNegativeAmount(form.globalIncomeAmount, { required: false });
    if (globalIncomeErr) errors.globalIncomeAmount = globalIncomeErr;
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
      parseManwonToWon(form.isaYtd || '0') > parseManwonToWon(form.isaCumulative || '0')
    ) {
      errors.isaYtd = { code: 'exceeds_cumulative', message: 'ISA 당해연도 납입액은 누적 납입액을 넘을 수 없습니다.' };
    }

    if (form.isaTransferEnabled) {
      if (isBlank(form.isaTransferAmount)) {
        errors.isaTransferAmount = { code: 'missing', message: '전환 금액을 입력해 주세요.' };
      } else if (isOverPrecise(form.isaTransferAmount)) {
        errors.isaTransferAmount = { code: 'too_precise', message: '소수점 넷째 자리(1원 단위)까지만 입력할 수 있습니다.' };
      } else {
        const n = parseManwonToWon(form.isaTransferAmount);
        if (Number.isNaN(n)) errors.isaTransferAmount = { code: 'not_integer', message: '만원 단위 숫자로 넣어 주세요.' };
        else if (n <= 0) errors.isaTransferAmount = { code: 'out_of_range', message: '0보다 큰 값이 필요합니다.' };
        else if (!cumulativeErr && n > parseManwonToWon(form.isaCumulative || '0')) {
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

  // D28·D31 — 수익률 가정은 전부 선택이다. 객체를 보내려면 수익률과 소득
  // 성격이 **둘 다** 있어야 한다는 계약 3.6절의 짝 요구를 화면도 지킨다.
  // **여기서 막힌다고 나머지 계산이 막히지 않는다** — `buildIsaReturnAssumption`
  // (state/store.js)이 이 값들이 전부 유효할 때만 요청에 싣고, 그렇지 않으면
  // 조용히 `null`을 보내 주 계산과 분리한다.
  //
  // **`isaExists` 블록 밖으로 뺐다(2026-08-10).** 엔진은 ISA 미보유자에게도
  // 신규 가입을 전제로 배분하므로(`isa_new_account_assumed`), 수익률 가정은
  // 계좌 보유 여부와 무관하게 유효하다(계약 3.6절 — `IsaReturnAssumption`은
  // `accounts.isa.exists`를 읽지 않는다). 이 블록이 `isaExists`에 묶여 있으면
  // ISA가 없는 사용자는 토글을 켜고 값을 넣어도 검사를 거치지 않고
  // `buildIsaReturnAssumption`이 조용히 `null`을 보내 — 화면은 받은 것처럼
  // 보이는데 아무 일도 일어나지 않는 상태가 된다.
  if (form.isaReturnEnabled) {
    if (isBlank(form.isaReturnRatePercent)) {
      errors.isaReturnRatePercent = { code: 'missing', message: '값을 입력해 주세요.' };
    } else {
      const rate = parsePercentToRate(form.isaReturnRatePercent);
      if (Number.isNaN(rate)) {
        errors.isaReturnRatePercent = { code: 'not_a_number', message: '0 이상의 숫자로 넣어 주세요.' };
      }
      // 음수는 형식 자체가 만들 수 없다(정규식이 부호를 받지 않는다) — 별도
      // "negative" 분기가 없는 이유다.
    }
    if (!ISA_INCOME_CHARACTERS.includes(form.isaIncomeCharacter)) {
      errors.isaIncomeCharacter = { code: 'missing', message: '수익이 어떤 형태로 들어오는지 선택해 주세요.' };
    }
    if (!isBlank(form.isaSettlementYears)) {
      if (!/^\d+$/.test(form.isaSettlementYears.trim()) || Number(form.isaSettlementYears) < 1) {
        errors.isaSettlementYears = { code: 'out_of_range', message: '1 이상의 정수(년)가 필요합니다.' };
      }
    }
    const lossErr = validateNonNegativeAmount(form.isaLossAmount, { required: false });
    if (lossErr) errors.isaLossAmount = lossErr;
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
  const zero = (v) => isBlank(v) || parseManwonToWon(v) === 0;

  if (zero(form.annuitySavingsYtd) && zero(form.retirementPensionYtd) && (!form.isaExists || zero(form.isaYtd))) {
    codes.push('existing_contribution_untouched');
  }
  // **`isa_not_held_excluded`를 지웠다(2026-08-10).** "ISA 계좌가 없다고
  // 하셔서 ISA를 배분 대상에서 제외하고 계산했습니다"는 거짓이다 — 엔진은
  // ISA 미보유 사용자에게 신규 가입을 전제로 배분한다(`isa_new_account_assumed`,
  // 계약 3.2절 `IsaAccountState.exists`). 이 코드가 `isa_new_account_assumed`와
  // 나란히 같은 가정 목록에 뜨면 두 문장이 서로 반대되는 사실을 말한다.
  // `screens.md` 4.5절 표(1125행)가 이 문구를 명시하지만, 계약이 실제로 하는
  // 일과 어긋나므로 화면은 엔진이 실제로 한 일(`isa_new_account_assumed`)을
  // 말한다 — 문서 갱신은 최종 보고에 남긴다.
  //
  // **`isa_account_type_defaulted`도 `isaExists`에서 뗐다** — 유형 토글 자체가
  // 보유 여부와 무관해졌으므로(`input-panel.js` 참고), 신규 가입 전제 사용자가
  // 유형을 기본값(일반형)으로 둔 채 계산해도 같은 사실을 말해야 한다.
  if (form.isaAccountType === 'general') codes.push('isa_account_type_defaulted');
  if (form.isaExists && form.isaTransferEnabled && form.isaTransferDestination === 'retirement_pension') {
    codes.push('transfer_destination_defaulted');
  }
  return codes;
}
