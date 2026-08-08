/**
 * 상태 저장소 — 입력 폼, 검증 결과, 엔진 호출을 한 곳에서 오케스트레이션한다.
 *
 * `design-system.md` 6.1절의 갱신 규약을 구현한다.
 * - 필수 항목이 모두 유효해지기 전에는 계산하지 않는다.
 * - 그 뒤로는 값 변경 시 디바운스 400ms 뒤 자동 재계산.
 * - 재계산 중에도 직전 결과를 화면에 남긴다.
 *
 * 입력값(나이·소득·납입액 등)은 store 밖으로, 특히 계측 모듈로 나가지 않는다 —
 * `notifyResult`가 넘기는 것은 has_alternatives(불리언)뿐이다.
 */

import { validateForm } from './validation.js';
import { SCHEMA_VERSION } from '../engine/engine-client.js';

const DEBOUNCE_MS = 400;

export function initialForm() {
  return {
    age: '',
    currentSalary: '',
    priorSalaryEnabled: false,
    priorSalary: '',
    fundUseHorizon: null,
    monthlyCapacity: '',
    annuitySavingsYtd: '',
    retirementPensionYtd: '',
    isaExists: false,
    isaAccountType: 'general',
    isaCumulative: '',
    isaYtd: '',
    isaTransferEnabled: false,
    isaTransferAmount: '',
    isaTransferDestination: 'retirement_pension',
    isaTransferPriorApplied: '',
  };
}

function toIntOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
function toIntOrZero(v) {
  return toIntOrNull(v) ?? 0;
}

export function buildEngineRequest(form, scenarios) {
  return {
    schema_version: SCHEMA_VERSION,
    tax_year: 2026,
    scenarios,
    profile: {
      age_years: toIntOrZero(form.age),
      current_year_total_salary_krw: toIntOrZero(form.currentSalary),
      prior_year_total_salary_krw: form.priorSalaryEnabled ? toIntOrNull(form.priorSalary) : null,
      financial_income_taxpayer_last_3_years: null, // 1차 출시에서 묻지 않는 선택 입력 (requirements.md 2절)
      declared_youth: null, // 위와 동일
      fund_use_horizon: form.fundUseHorizon ?? 'unknown',
      monthly_capacity_krw: toIntOrZero(form.monthlyCapacity),
      months_remaining_in_tax_year: null, // 사용자에게 묻지 않는다 — 엔진이 12로 기본 처리
    },
    accounts: {
      annuity_savings: { ytd_contribution_krw: toIntOrZero(form.annuitySavingsYtd) },
      retirement_pension: { ytd_contribution_krw: toIntOrZero(form.retirementPensionYtd) },
      isa: {
        exists: form.isaExists,
        account_type: form.isaExists ? form.isaAccountType : null,
        cumulative_contribution_krw: form.isaExists ? toIntOrZero(form.isaCumulative) : 0,
        ytd_contribution_krw: form.isaExists ? toIntOrZero(form.isaYtd) : 0,
        years_since_opening: null, // 1차 출시에서 묻지 않는 선택 입력
        other_savings_contract_krw: null, // 위와 동일
      },
    },
    isa_transfer:
      form.isaExists && form.isaTransferEnabled
        ? {
            amount_krw: toIntOrZero(form.isaTransferAmount),
            destination: form.isaTransferDestination ?? null,
            prior_year_applied_extra_credit_krw: toIntOrNull(form.isaTransferPriorApplied),
            prior_multi_year_applied_extra_credit_krw: null,
          }
        : null,
    options: null,
  };
}

export function createStore({ engineClient, analytics, onChange }) {
  let form = initialForm();
  let status = 'blank'; // blank | input_incomplete | loading | result | field_error | blocked | fatal_error
  let validation = validateForm(form);
  let result = null; // 마지막 성공 응답 (EngineResponse, scenarios 포함)
  let boundaries = null;
  let fatalError = null;
  let debounceHandle = null;
  let requestSeq = 0;
  let hasReportedResultShown = false;
  let touchedAnyField = false;

  function notify() {
    onChange(getState());
  }

  function getState() {
    return { form, status, validation, result, boundaries, fatalError };
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
      const fatalCodes = new Set(['ruleset_load_failed', 'rule_missing']);
      if (response.errors.some((e) => fatalCodes.has(e.code))) {
        fatalError = { errors: response.errors };
        status = 'fatal_error';
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
    const age = toIntOrNull(form.age);
    if (age == null) return;
    try {
      const res = await engineClient.computeFundUseHorizonBoundaries({
        schema_version: SCHEMA_VERSION,
        tax_year: 2026,
        age_years: age,
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

  function reportInputStartIfNeeded(fieldName) {
    if (touchedAnyField) return;
    touchedAnyField = true;
    analytics.track('input_start', { field_name: fieldName });
  }

  function setField(name, value, { immediate = false } = {}) {
    reportInputStartIfNeeded(name);
    form = { ...form, [name]: value };
    validation = validateForm(form);
    notify();
    scheduleCompute({ immediate });
    if (name === 'age' || name === 'isaExists') maybeFetchBoundaries();
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
