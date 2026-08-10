/**
 * 상태 저장소 — 입력 폼, 검증 결과, 엔진 호출을 한 곳에서 오케스트레이션한다.
 *
 * `design-system.md` 6.1절의 갱신 규약을 구현한다.
 * - 필수 항목이 모두 유효해지기 전에는 계산하지 않는다.
 * - 그 뒤로는 값 변경 시 디바운스 400ms 뒤 자동 재계산.
 * - 재계산 중에도 직전 결과를 화면에 남긴다.
 *
 * 입력값(생년월일·소득·결정세액·납입액 등)은 store 밖으로, 특히 계측 모듈로
 * 나가지 않는다 — `notifyResult`가 넘기는 것은 has_alternatives(불리언)뿐이다.
 *
 * **생년월일은 엔진 요청에 원본 그대로 실린다**(D21). 엔진 호출은 같은 페이지
 * 안의 함수 호출이지 전송이 아니고, 만 나이 환산은 **어느 날짜 기준인지**를
 * 정해야 하는 세법 판단이라 화면이 하지 않는다. 프라이버시 경계는 계측 전송로와
 * 저장소·URL이지 함수 호출이 아니다 — 그 경계는 아래 `analytics.track` 호출과
 * `analytics.js`의 화이트리스트가 지킨다.
 */

import { validateForm, parseManwonToWon, parsePercentToRate, ISA_INCOME_CHARACTERS } from './validation.js';
import { SCHEMA_VERSION } from '../engine/engine-client.js';

const DEBOUNCE_MS = 400;

/** 계약이 정한 기준 과세연도. 세법 수치가 아니라 어느 룰셋을 읽을지 고르는 값이다. */
const TAX_YEAR = 2026;

export function initialForm() {
  return {
    birthDate: '',
    currentSalary: '',
    // 5.0.0(D27) — 공제율 판정 축의 첫 물음. 기본 선택 없음(예/아니오 어느 쪽도
    // 미리 고르지 않는다) — `false`로 접으면 결함이 걸리는 사람에게 조용히
    // 틀린 답을 준다(계약 0.6절).
    hasNonWageIncome: null,
    // 예일 때만 묻는 금액. 비어 있으면(=모른다) 엔진이 본문 구간을 적용하고
    // 그 사실을 notice로 낸다 — 화면이 지어내지 않는다.
    globalIncomeAmount: '',
    priorSalaryEnabled: false,
    priorSalary: '',
    // 직전 과세연도 결정세액 — `빈`(null) · `amount` · `unknown` 세 상태.
    // 비어 있음과 모름이 다른 상태다(D14, screens.md 3.8.3절).
    priorTaxState: null,
    priorTaxAmount: '',
    // 현재 연금 수령 여부 — 기본 선택 없음(screens.md 3.10.1절).
    annuityStarted: null,
    // 청년 자기신고. 화면이 대신 켜지 않는다(screens.md 3.9.5절).
    declaredYouth: false,
    fundUseHorizon: null,
    monthlyCapacity: '',
    annuitySavingsYtd: '',
    retirementPensionYtd: '',
    isaExists: false,
    isaAccountType: 'general',
    isaCumulative: '',
    isaYtd: '',
    // 금융소득종합과세 대상 여부 — 3택('yes'/'no'/'unknown'), 기본 선택 없음.
    isaFinancialIncomeTaxpayer: null,
    isaTransferEnabled: false,
    isaTransferAmount: '',
    isaTransferDestination: 'retirement_pension',
    isaTransferPriorApplied: '',
    // D28·D29·D31 — 수익률 가정. **기본값도, 미리 채운 값도 없다.** 꺼진
    // 상태로 시작하고, 사용자가 스스로 켜고 스스로 숫자를 적어야 한다 — 이
    // 서비스가 수익률을 제안하지 않는다는 구분이 D31 이후 남은 방어선
    // 전부다(계약 0.10절). `field_name`은 어디서도 값을 담지 않는다.
    isaReturnEnabled: false,
    isaReturnRatePercent: '',
    isaIncomeCharacter: null,
    isaSettlementYears: '',
    isaLossAmount: '',
  };
}

/**
 * D31이 남긴 되돌리는 길. 규제 검토를 나중에 하기로 하면 `'suppress'`로
 * 바꾼다 — 계산과 입력은 그대로 두고 표시만 끈다(0.11절). 사용자에게 노출된
 * 토글이 아니라 조직이 되돌릴 자리이므로 코드에 상수 하나로 둔다.
 */
export const ASSUMPTION_BASED_ISA_ESTIMATE_DISPLAY = 'include';

/**
 * 화면 경계의 단위 변환 — **모든 금액 입력란은 만원 단위다**(소유자 지시).
 * 계약이 받는 단위는 원이므로 여기서만 바꾼다. 변환 자체(고정소수점, 소수
 * 넷째 자리=1원까지)는 `validation.js`의 `parseManwonToWon` 하나뿐이다 —
 * 화면 쪽에 변환 로직을 두 번 적지 않는다. 형식이 아니면(검증을 통과했어야
 * 정상이지만 방어적으로) `null`/`0`으로 접는다.
 */
function manwonToWonOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const won = parseManwonToWon(v);
  return Number.isNaN(won) ? null : won;
}
function manwonToWonOrZero(v) {
  return manwonToWonOrNull(v) ?? 0;
}

/**
 * 계약 3.5절 `PriorYearTax`. 화면의 세 상태를 계약의 열거형으로 옮긴다.
 *
 * 계약이 `designer`의 E1(정수 하나 + null)을 그대로 받지 않았다 — `null` 하나로는
 * **빈**과 **모름**을 구분할 수 없고, 되더하기가 두 칸을 짝으로 요구하기 때문이다.
 * 화면은 `모르겠습니다`를 `state: "unknown"`으로 **명시해서** 보낸다. 침묵을
 * 모름으로 추론하지 않는다.
 *
 * `pension_credit_applied_krw`는 묻지 않는다(D13 기준 3 — 값이 없어도 틀릴 방향과
 * 크기를 `[4-E]`가 한 문장으로 말할 수 있다). 계약이 `null`을 0으로 보고 그 사실을
 * `prior_pension_credit_zero_assumed` 가정으로 낸다. 한도가 과소로 나오는 방향이고
 * 과소한 한도는 절세액을 과대로 만들지 않는다.
 */
export function buildPriorYearTax(form) {
  if (form.priorTaxState === 'amount') {
    return {
      state: 'amount',
      determined_tax_krw: manwonToWonOrZero(form.priorTaxAmount),
      pension_credit_applied_krw: null,
    };
  }
  // 아직 답하지 않았으면 계산 자체가 돌지 않는다(필수 항목이다). 그래도 요청을
  // 만들게 되면 `unknown`을 보낸다 — 접는 방향의 오류가 과대이므로.
  return { state: 'unknown', determined_tax_krw: null, pension_credit_applied_krw: null };
}

/**
 * 계약 3.2절 `annuity_start_status`. **기본값을 `not_started`로 두지 않는다**
 * (계약 10절) — 연금 수령 중인 사용자에게 납입 가능액을 주는 방향, 즉 과대로
 * 틀린다. 사용자가 답하지 않았으면 `unknown`을 보낸다.
 *
 * 화면은 이 값을 **한 번만 묻고 두 연금계좌에 같이 적용한다**(screens.md 3.10.1절).
 * 계좌별로 다른 상태를 묻는 화면은 설계에 없다.
 */
export function annuityStartStatus(form) {
  if (form.annuityStarted === true) return 'started';
  if (form.annuityStarted === false) return 'not_started';
  return 'unknown';
}

/**
 * 계약 3.6절 `IsaReturnAssumption`. **객체 자체가 선택이고, 값을 지어내지
 * 않는다.** 켜지 않았거나 필수 짝(수익률·소득 성격)이 온전하지 않으면
 * `null`을 보낸다 — 그러면 엔진은 이 규칙군을 한 건도 읽지 않는다(계약
 * 0.9절). `validateForm`이 이 상태를 막아 `readyToCompute`를 꺼뜨리므로
 * 실제로는 이 함수가 반쪽짜리 객체를 만들 일이 없지만, 방어적으로도 반쪽을
 * 보내지 않는다.
 */
export function buildIsaReturnAssumption(form) {
  if (!form.isaExists || !form.isaReturnEnabled) return null;
  const rate = parsePercentToRate(form.isaReturnRatePercent);
  if (Number.isNaN(rate) || rate < 0) return null;
  if (!ISA_INCOME_CHARACTERS.includes(form.isaIncomeCharacter)) return null;

  const yearsText = (form.isaSettlementYears ?? '').trim();
  const settlementYears = /^\d+$/.test(yearsText) && Number(yearsText) >= 1 ? Number(yearsText) : null;

  return {
    annual_return_rate: rate,
    income_character: form.isaIncomeCharacter,
    // 모르면 채우지 않는다 — 룰셋의 계약기간 하한을 엔진이 가정으로 세운다.
    settlement_years: settlementYears,
    // 모르면 0으로 본다(과소 방향) — 지어내면 과대가 된다(계약 3.6절).
    loss_amount_krw: manwonToWonOrNull(form.isaLossAmount),
  };
}

function financialIncomeTaxpayer(form) {
  if (!form.isaExists) return null;
  if (form.isaFinancialIncomeTaxpayer === 'yes') return true;
  if (form.isaFinancialIncomeTaxpayer === 'no') return false;
  // `모르겠음`과 미접촉은 둘 다 null — 계약이 null일 때 배제를 적용하지 않고
  // `financial_income_status_unknown` notice를 낸다.
  return null;
}

export function buildEngineRequest(form, scenarios) {
  const annuityStart = annuityStartStatus(form);
  const pensionAccount = (ytd) => ({
    // **본인이 새로 넣는 돈만이다.** 퇴직급여 입금액·계약이전액은 별도 칸이고
    // 화면이 그것을 묻지 않으므로 null을 보낸다 — 합치면 세액공제액이 과대
    // 계산된다(계약 3.2절, 10절).
    ytd_contribution_krw: manwonToWonOrZero(ytd),
    annuity_start_status: annuityStart,
    opened_on: null, // 묻지 않는다 — 계약이 개시 가능 시점을 "계산할 수 없음"으로 둔다
    has_deferred_retirement_income: null,
    retirement_transfer_in_krw: null,
  });

  return {
    schema_version: SCHEMA_VERSION,
    tax_year: TAX_YEAR,
    scenarios,
    profile: {
      // 생년월일 원본을 그대로 넘긴다. 만 나이 환산은 엔진이 한다(D21).
      birth_date: form.birthDate || null,
      prior_year_tax: buildPriorYearTax(form),
      current_year_total_salary_krw: manwonToWonOrZero(form.currentSalary),
      // 5.0.0(D27) — 공제율 판정 축의 첫 물음은 **필수**다. `false`(또는 아직
      // 답하지 않음)면 두 번째 물음을 보내지 않는다 — 계약이 `false`인데
      // 금액이 실리면 `invalid_enum`으로 되돌린다(3.1절).
      has_non_wage_global_income_current_year: form.hasNonWageIncome === true,
      current_year_global_income_krw: form.hasNonWageIncome === true ? manwonToWonOrNull(form.globalIncomeAmount) : null,
      prior_year_total_salary_krw: form.priorSalaryEnabled ? manwonToWonOrNull(form.priorSalary) : null,
      financial_income_taxpayer_last_3_years: financialIncomeTaxpayer(form),
      // 화면이 만 나이로 자동 판정해 채워 보내지 않는다(screens.md 3.9.1·3.9.5절).
      // 사용자가 누르지 않으면 null이다.
      declared_youth: form.declaredYouth ? true : null,
      fund_use_horizon: form.fundUseHorizon ?? 'unknown',
      monthly_capacity_krw: manwonToWonOrZero(form.monthlyCapacity),
      months_remaining_in_tax_year: null, // 사용자에게 묻지 않는다 — 엔진이 12로 기본 처리
      // D28·D31 — 객체 자체가 선택이다. 켜지 않았으면(또는 짝이 온전하지
      // 않으면) `null`을 보낸다. **이 화면은 수익률을 제안하거나 미리 채우지
      // 않는다** — `initialForm`이 빈 문자열로 시작하는 것이 그 방어선의 절반이다.
      isa_return_assumption: buildIsaReturnAssumption(form),
    },
    accounts: {
      annuity_savings: pensionAccount(form.annuitySavingsYtd),
      retirement_pension: pensionAccount(form.retirementPensionYtd),
      isa: {
        exists: form.isaExists,
        account_type: form.isaExists ? form.isaAccountType : null,
        cumulative_contribution_krw: form.isaExists ? manwonToWonOrZero(form.isaCumulative) : 0,
        ytd_contribution_krw: form.isaExists ? manwonToWonOrZero(form.isaYtd) : 0,
        years_since_opening: null, // 1차 출시에서 묻지 않는 선택 입력
        other_savings_contract_krw: null, // 위와 동일
      },
    },
    isa_transfer:
      form.isaExists && form.isaTransferEnabled
        ? {
            amount_krw: manwonToWonOrZero(form.isaTransferAmount),
            destination: form.isaTransferDestination ?? null,
            prior_year_applied_extra_credit_krw: manwonToWonOrNull(form.isaTransferPriorApplied),
            prior_multi_year_applied_extra_credit_krw: null,
          }
        : null,
    // D31 — 되돌리는 길. 표시를 끌 때는 이 상수 하나만 `"suppress"`로 바꾼다
    // (계산과 입력은 그대로 두고 표시만 끈다, 0.11절).
    options: { assumption_based_isa_estimate: ASSUMPTION_BASED_ISA_ESTIMATE_DISPLAY },
  };
}

export function createStore({ engineClient, analytics, onChange }) {
  let form = initialForm();
  let status = 'blank'; // blank | input_incomplete | loading | result | field_error | blocked | fatal_error
  let validation = validateForm(form);
  let result = null; // 마지막 성공 응답 (EngineResponse, scenarios 포함)
  let boundaries = null;
  let provisionalYouth = null; // 룰셋에서 읽은 청년 규칙(있으면). 3.9절
  let fatalError = null;
  let debounceHandle = null;
  let requestSeq = 0;
  let hasReportedResultShown = false;
  let touchedAnyField = false;

  function notify() {
    onChange(getState());
  }

  function getState() {
    return { form, status, validation, result, boundaries, provisionalYouth, fatalError };
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
    else debounceHandle = setTimeout(run, DEBOUNCE_MS);
  }

  async function runCompute() {
    const seq = ++requestSeq;
    status = 'loading';
    notify();
    const request = buildEngineRequest(form, ['current', 'proposed']);
    let response;
    try {
      response = await engineClient.compute(request);
    } catch (e) {
      if (seq !== requestSeq) return;
      fatalError = { message: String(e && e.message) };
      status = 'fatal_error';
      notify();
      return;
    }
    if (seq !== requestSeq) return; // 더 최신 요청이 이미 처리됨

    if (!response.ok) {
      const fatalCodes = new Set(['ruleset_load_failed', 'rule_missing', 'schema_version_mismatch']);
      if (response.errors.some((e) => fatalCodes.has(e.code))) {
        fatalError = { errors: response.errors };
        status = 'fatal_error';
        result = null;
        notify();
        return;
      }
      // 그 외 오류는 클라이언트 측 검증이 이미 걸렀어야 하는 값이다 — 방어적으로
      // field_error로 처리하고 직전 결과를 유지한다.
      status = result ? 'field_error' : 'blocked';
      fatalError = { errors: response.errors };
      notify();
      return;
    }

    const anyScenarioFullyBlocked = response.scenarios.some((s) => s.account_eligibility.every((a) => !a.eligible));
    result = response;
    status = anyScenarioFullyBlocked ? 'blocked' : 'result';
    fatalError = anyScenarioFullyBlocked
      ? { errors: [], reasonNotices: response.scenarios[0].notices.filter((n) => n.severity === 'warning') }
      : null;
    notify();

    if (status === 'result' && !hasReportedResultShown) {
      hasReportedResultShown = true;
      const primary = response.scenarios.find((s) => s.scenario_id === 'current') ?? response.scenarios[0];
      analytics.track('result_shown', { has_alternatives: primary.plans.length > 1 });
    }
  }

  async function maybeFetchBoundaries() {
    // 경계값 조회도 생년월일을 그대로 보낸다(계약 9.1절). 화면은 나이를 만들지
    // 않으므로, 날짜가 아직 유효하지 않으면 조회 자체를 하지 않는다.
    if (validation.errors.birthDate) return;
    try {
      const res = await engineClient.computeFundUseHorizonBoundaries({
        schema_version: SCHEMA_VERSION,
        tax_year: TAX_YEAR,
        birth_date: form.birthDate,
        isa_exists: form.isaExists,
        isa_years_since_opening: null,
        scenario: 'current',
      });
      if (res.ok) {
        boundaries = res.boundaries;
        notify();
      }
    } catch {
      // 경계값 조회 실패는 결과 패널에 아무 영향을 주지 않는다(screens.md 8.3(c)) —
      // 라벨은 숫자 없이도 완결되므로 조용히 무시한다.
    }
  }

  /**
   * 청년 블록이 그릴 문자열(`LawChip`)과 연령 범위 유무를 룰셋에서 한 번 읽는다.
   * 값이 없으면 `null`이고, 그러면 발표 기준 해당 여부를 말하는 줄이 그려지지
   * 않는다 — 시행령이 공개돼 룰셋에 값이 들어오면 그날 저절로 켜진다(3.9.2절).
   */
  async function loadProvisionalRules() {
    if (typeof engineClient.loadProvisionalYouthRule !== 'function') return;
    try {
      const rule = await engineClient.loadProvisionalYouthRule();
      if (rule) {
        provisionalYouth = rule;
        notify();
      }
    } catch {
      /* 룰셋을 못 읽으면 이 블록을 그리지 않는다. 계산 경로에는 영향이 없다. */
    }
  }

  /**
   * `input_start`의 `field_name`으로 내보내지 않는 필드.
   *
   * `screens.md` 3.7.5절 못 3이 필드 *이름*은 값이 아니라고 정했고 그 판단은
   * 그대로 유효하다. **청년 체크만 예외로 둔다** — 이 체크를 **가장 먼저**
   * 만졌다는 사실은 "본인이 대상이라고 생각한다"를 거의 그대로 뜻하고,
   * 3.9.5절이 그 상태를 만 나이 구간의 1:1 대리변수로 보아 어떤 이벤트에도
   * 싣지 못하게 했다. 이 필드가 먼저 만져지면 이벤트를 내지 않고 미뤄 두었다가
   * 다음 필드에서 낸다 — 이름을 지어내지 않고 그냥 세지 않는다.
   */
  const FIELDS_NOT_REPORTED = new Set(['declaredYouth']);

  function reportInputStartIfNeeded(fieldName) {
    if (touchedAnyField) return;
    if (FIELDS_NOT_REPORTED.has(fieldName)) return;
    touchedAnyField = true;
    // **필드 이름만 나간다. 값은 어떤 형태로도 나가지 않는다**
    // (analytics-plan.md 1절 · screens.md 3.7.5절 못 3).
    analytics.track('input_start', { field_name: fieldName });
  }

  /**
   * `KnownOrUnknownField`는 **두 값이 한 묶음으로 움직인다**(design-system 5.26절).
   * 금액을 치면 `모르겠습니다`가 풀리고, `모르겠습니다`를 누르면 금액 칸이
   * 비워진다 — 값을 남겨 두고 숨기지 않는다. 두 필드를 따로 세팅하면 그 사이에
   * "금액도 있고 모름도 켜진" 상태가 잠깐 생기고, 그 상태는 계약에 없다.
   */
  const COMPOSITE = {
    priorTax: (v) => ({ priorTaxState: v.state, priorTaxAmount: v.amount ?? '' }),
  };

  function setField(name, value, { immediate = false } = {}) {
    reportInputStartIfNeeded(name);
    const patch = COMPOSITE[name] ? COMPOSITE[name](value) : { [name]: value };
    form = { ...form, ...patch };
    validation = validateForm(form);
    notify();
    scheduleCompute({ immediate });
    if (name === 'birthDate' || name === 'isaExists') maybeFetchBoundaries();
  }

  function reset() {
    form = initialForm();
    validation = validateForm(form);
    result = null;
    boundaries = null;
    fatalError = null;
    status = 'blank';
    hasReportedResultShown = false;
    touchedAnyField = false;
    if (debounceHandle) clearTimeout(debounceHandle);
    notify();
  }

  function reportSaveShare(method) {
    analytics.track('save_share_action', { method });
  }

  function reportAlternativeClick() {
    analytics.track('alternative_row_click', {});
  }

  loadProvisionalRules();

  return {
    getState,
    setField,
    reset,
    reportSaveShare,
    reportAlternativeClick,
    // 테스트/디버깅에서 디바운스를 기다리지 않고 즉시 계산을 트리거할 때 쓴다.
    flush: () => scheduleCompute({ immediate: true }),
  };
}
