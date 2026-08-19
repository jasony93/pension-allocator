/**
 * 연금 역산기 탭의 상태 저장소. 첫 탭(`state/store.js`)과 **상태를 공유하지
 * 않는다**(`engine-interface.md` 12절 머리말 — "두 진입점이 함께 쓰는 것은
 * 룰셋 접근·원 미만 규약·날짜 산술뿐"). 그래서 이 파일은 `store.js`를
 * import하지 않고, 갱신 규약(design-system 6.1절 — 디바운스 400ms·blur
 * 우선·직전 결과 유지)만 같은 형태로 다시 둔다.
 *
 * `requirements.md` 9.1절의 최신 확정(2026-08-19, 관리자 재소집)을 반영한다 —
 * ISA 세 항목(잔액·경과연수·누적 납입액)의 노출 조건은 「ISA 계좌 보유
 * 여부」라는 명시 질문 하나이지, 잔액 금액에서 추론하지 않는다(AC-R9).
 *
 * **입력값은 store 밖으로 나가지 않는다.** 이 파일은 계측을 만들지 않는다
 * (D77 "계측·지표" 절 — 역산기 계측은 다음 회차).
 */

import { validateReverseForm, validateCalendarDate } from './reverse-validation.js';
import { parseManwonToWon, parsePercentToRate } from './validation.js';
import { SCHEMA_VERSION } from '../engine/engine-client.js';
import { TAX_YEAR } from './store.js';

const REVERSE_DEBOUNCE_MS = 400;

export function initialReverseForm() {
  return {
    birthDate: '',
    // 원하는 연금 수령액(월). 다른 금액 입력과 같은 화면 관습 — **만원 단위**로
    // 받고 경계(이 파일)에서만 원으로 바꾼다(첫 탭과 같은 컴포넌트 언어).
    targetMonthlyIncome: '',
    // 연금 개시일 — `BirthDateField`와 같은 한 칸 마스킹(YYYY-MM-DD). "모름"
    // 선택지는 없다(screens.md 14.2절 규약 1 — 반드시 아는 값을 사용자가
    // 스스로 정하는 계획 값이기 때문이다).
    annuityStartDate: '',
    payoutYears: '',
    // D77 판정 1 — **기본값·자리표시자·힌트 금지.** 빈 문자열로만 시작한다.
    averageReturnRatePercent: '',
    annuitySavingsBalance: '',
    retirementPensionBalance: '',
    // ISA 계좌 보유 여부 — 명시 질문(2026-08-19 확정, AC-R9). 첫 탭의
    // `isaExists`와 같은 관례로 기본값 `false`("아니오")를 미리 선택해 둔다.
    isaExists: false,
    isaBalance: '',
    isaYearsSinceOpening: '',
    // AC-R29(2026-08-19 신설) — 미입력이면 엔진이 해지 의제 판정을 내지 않는다.
    isaCumulativeContribution: '',
    deferredRetirementPresent: false,
    deferredRetirementAmount: '',
    // '예' | '아니오' | 'unknown' — 기본 "모름"(접힘, screens.md 14.2절 규약 4).
    publicPensionPlan: 'unknown',
    publicPensionExpectedMonthly: '',
    // 연금 수령 시기 예상 연금 외 소득 — `KnownOrUnknownField`. 기본은 "모름".
    otherIncomeKnown: false,
    otherIncomeAnnual: '',
  };
}

function reverseManwonToWonOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const won = parseManwonToWon(v);
  return Number.isNaN(won) ? null : won;
}
function reverseManwonToWonOrZero(v) {
  return reverseManwonToWonOrNull(v) ?? 0;
}

/**
 * 원 → 만원 입력 문자열. `parseManwonToWon`의 역함수다(첫 탭 `state/store.js`의
 * 화면 경계 규약과 같은 자리 — 이 파일이 원 단위로 계산한 프리필 값을
 * 첫 탭의 「월 납입 여력」 만원 입력칸에 되돌려 넣을 때 쓴다, AC-R21).
 * 소수 넷째 자리(=1원)까지 표현하고, 끝의 불필요한 0은 잘라낸다.
 */
export function wonToManwonInputString(won) {
  const intPart = Math.trunc(won / 10000);
  const remainder = Math.abs(won % 10000);
  if (remainder === 0) return String(intPart);
  const frac = String(remainder).padStart(4, '0').replace(/0+$/, '');
  return `${intPart}.${frac}`;
}

/** 오늘 날짜, `YYYY-MM-DD`. AC-R28 — 사용자에게 묻지 않고 화면이 채운다. */
export function todayIsoDate(now = new Date()) {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * `annuityStartDate`(YYYY-MM-DD, 한 칸 입력)를 계약의 `annuity_start`로
 * 옮긴다. 계약은 `{kind:"age"}` 또는 `{kind:"year"}` 중 하나만 받고, 어느
 * 쪽이든 엔진이 "그 해의 생일"로 정규화한다(계약 12.2절 · 가정
 * `reverse_annuity_start_date_derived_from_birthday`) — 그래서 화면이 받은
 * 전체 날짜 중 **연도**만 계약에 실어도 정보 손실이 없다. 월·일은 사용자가
 * 스스로 "그 나이가 되는 생일"을 적었다는 사실을 화면에 보여주는 것 이상의
 * 계산 역할이 없다.
 */
export function annuityStartFromDate(value) {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(String(value ?? ''));
  if (!match) return null;
  return { kind: 'year', year: Number(match[1]) };
}

export function buildPensionReverseRequest(form, { asOfDate } = {}) {
  const rate = (() => {
    if (form.averageReturnRatePercent === '' || form.averageReturnRatePercent == null) return null;
    const r = parsePercentToRate(form.averageReturnRatePercent);
    return Number.isNaN(r) ? null : r;
  })();

  return {
    schema_version: SCHEMA_VERSION,
    tax_year: TAX_YEAR,
    as_of_date: asOfDate ?? todayIsoDate(),
    profile: {
      birth_date: form.birthDate || null,
      target_monthly_income_krw: reverseManwonToWonOrZero(form.targetMonthlyIncome),
      annuity_start: annuityStartFromDate(form.annuityStartDate),
      payout_years: /^\d+$/.test(String(form.payoutYears ?? '').trim()) ? Number(form.payoutYears) : null,
      average_annual_return_rate: rate,
      public_pension: {
        plan: form.publicPensionPlan ?? 'unknown',
        expected_monthly_krw: form.publicPensionPlan === 'yes' ? reverseManwonToWonOrNull(form.publicPensionExpectedMonthly) : null,
      },
      other_income: {
        state: form.otherIncomeKnown ? 'known' : 'unknown',
        annual_krw: form.otherIncomeKnown ? reverseManwonToWonOrNull(form.otherIncomeAnnual) : null,
      },
      deferred_retirement: {
        present: Boolean(form.deferredRetirementPresent),
        amount_krw: form.deferredRetirementPresent ? reverseManwonToWonOrZero(form.deferredRetirementAmount) : null,
      },
    },
    accounts: {
      annuity_savings: { balance_krw: reverseManwonToWonOrZero(form.annuitySavingsBalance) },
      retirement_pension: { balance_krw: reverseManwonToWonOrZero(form.retirementPensionBalance) },
      isa: {
        balance_krw: form.isaExists ? reverseManwonToWonOrZero(form.isaBalance) : 0,
        years_since_opening:
          form.isaExists && /^\d+$/.test(String(form.isaYearsSinceOpening ?? '').trim())
            ? Number(form.isaYearsSinceOpening)
            : null,
        cumulative_contribution_krw: form.isaExists ? reverseManwonToWonOrNull(form.isaCumulativeContribution) : null,
      },
    },
  };
}

export function createReverseStore({ engineClient, onChange }) {
  let form = initialReverseForm();
  let status = 'blank'; // blank | input_incomplete | loading | result | error | fatal_error
  let validation = validateReverseForm(form);
  let result = null; // 마지막 성공 응답(PensionReverseResponse)
  // AC-R5 — 개시일이 최소 개시 연령 미만이면 엔진이 이 필드에 오류를 낸다.
  // 클라이언트 형식 검증(`validation.errors`)과 자리가 다르므로 따로 둔다.
  let engineFieldError = null; // { field: 'annuityStartDate', message } | null
  let fatalError = null;
  let debounceHandle = null;
  let requestSeq = 0;

  function notify() {
    onChange(getState());
  }

  function getState() {
    return { form, status, validation, result, engineFieldError, fatalError };
  }

  function scheduleCompute({ immediate = false } = {}) {
    if (debounceHandle) clearTimeout(debounceHandle);
    if (!validation.readyToCompute) {
      status = result ? status : 'input_incomplete';
      notify();
      return;
    }
    const run = () => runCompute();
    if (immediate) run();
    else debounceHandle = setTimeout(run, REVERSE_DEBOUNCE_MS);
  }

  async function runCompute() {
    const seq = ++requestSeq;
    status = 'loading';
    notify();
    const request = buildPensionReverseRequest(form);
    let response;
    try {
      response = await engineClient.computePensionReverse(request);
    } catch (e) {
      if (seq !== requestSeq) return;
      fatalError = { message: String(e && e.message) };
      status = 'fatal_error';
      notify();
      return;
    }
    if (seq !== requestSeq) return;

    if (!response.ok) {
      const belowMinAge = response.errors.find((e) => e.code === 'annuity_start_below_minimum_age');
      if (belowMinAge) {
        engineFieldError = { field: 'annuityStartDate', code: belowMinAge.code, params: belowMinAge.params ?? {} };
        result = null;
        status = 'error';
        notify();
        return;
      }
      fatalError = { errors: response.errors };
      status = 'fatal_error';
      result = null;
      notify();
      return;
    }

    engineFieldError = null;
    result = response;
    status = 'result';
    notify();
  }

  function setField(name, value, { immediate = false } = {}) {
    form = { ...form, [name]: value };
    validation = validateReverseForm(form);
    notify();
    scheduleCompute({ immediate });
  }

  /**
   * 둘 이상의 필드를 한 번에 바꾼다. **`KnownOrUnknownField`(design-system
   * 5.26절)의 배타 규약** — "값을 치면 모르겠습니다가 풀리고, 모르겠습니다를
   * 누르면 값 칸이 비워진다" — 을 위한 자리다. 두 필드를 `setField`로
   * 나눠 부르면 중간 상태(예: 값은 들어왔는데 아직 `known`이 아닌 상태)가
   * 잠깐이라도 `notify()`를 타 화면이 한 프레임 어긋난 상태를 그릴 수 있다.
   */
  function setFields(patch, { immediate = false } = {}) {
    form = { ...form, ...patch };
    validation = validateReverseForm(form);
    notify();
    scheduleCompute({ immediate });
  }

  function reset() {
    form = initialReverseForm();
    validation = validateReverseForm(form);
    result = null;
    engineFieldError = null;
    fatalError = null;
    status = 'blank';
    if (debounceHandle) clearTimeout(debounceHandle);
    notify();
  }

  return {
    getState,
    setField,
    setFields,
    reset,
    flush: () => scheduleCompute({ immediate: true }),
  };
}

// 재노출 — 화면(`ui/reverse-input-panel.js`)이 개시일 형식만 검증할 때 쓴다
// (연금 개시일 필드는 미래 날짜를 허용하므로 생년월일 검증과 다르다).
export { validateCalendarDate };
