import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  buildEngineRequest,
  initialForm,
  buildPriorYearTax,
  annuityStartStatus,
  buildIsaReturnAssumption,
  ASSUMPTION_BASED_ISA_ESTIMATE_DISPLAY,
} from './store.js';
import { SCHEMA_VERSION } from '../engine/engine-client.js';

/**
 * **목이 계약 4.0.0을 따르는지가 이 파일의 전제다.** 목이 낡으면 테스트가
 * 통과해도 아무것도 증명하지 않는다 — 실제 페이지는 `schema_version_mismatch`로
 * 멈춰 있는데 테스트만 초록이 되는 상태가 정확히 그것이었다. 그래서 아래
 * `fakeScenario`는 계약 5절의 새 필드(`pension_credit_tax_liability_cap`,
 * `pension_withdrawal_start`, `DeterministicBenefit`의 자르기 전 금액)를 전부
 * 갖고 있고, `fakeEngine`은 **요청이 계약 4.0.0인지 스스로 확인한다.**
 */

function fakeEngine({ compute, computeFundUseHorizonBoundaries } = {}) {
  return {
    compute: compute ?? (async () => okResponse()),
    computeFundUseHorizonBoundaries:
      computeFundUseHorizonBoundaries ??
      (async () => ({ ok: true, schema_version: SCHEMA_VERSION, boundaries: {}, legal_basis: [], notices: [] })),
    loadProvisionalYouthRule: async () => null,
  };
}

function okResponse(overrides = {}) {
  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    echo: { derived_age: { age_years: 38, reference_date: '2026-12-31', reference_date_from_ruleset: false } },
    scenarios: [fakeScenario()],
    assumptions: [],
    ...overrides,
  };
}

export function fakeTaxLiabilityCap(overrides = {}) {
  return {
    known: true,
    cap_krw: 3000000,
    applied: false,
    reduced_income_tax_krw: 0,
    reduced_local_tax_krw: 0,
    reduced_total_krw: 0,
    threshold_income_tax_krw: 1080000,
    credit_carryforward: false,
    contribution_carryover_available: false,
    error_direction_code: null,
    basis_rule_ids: ['pension.credit.tax_liability_cap'],
    ...overrides,
  };
}

export function fakePlan(overrides = {}) {
  return {
    plan_id: 'max_tax_credit',
    is_baseline: true,
    warnings: [],
    priority_basis: {
      code: 'tax_credit_maximization',
      fill_sequence: ['annuity_savings', 'retirement_pension', 'isa'],
      basis_rule_ids: [],
      tie_break: { code: 'not_applicable', basis_rule_ids: [] },
      objective_degenerate: false,
    },
    allocations: [],
    total_allocated_monthly_krw: 0,
    total_allocated_annual_krw: 0,
    unallocated_monthly_krw: 0,
    unallocated_annual_krw: 0,
    monthly_rounding_residual_krw: 0,
    deterministic_benefit: {
      pension_credit_income_tax_krw: 1080000,
      pension_credit_local_tax_krw: 108000,
      pension_credit_total_krw: 1188000,
      pension_credit_income_tax_before_cap_krw: 1080000,
      pension_credit_local_tax_before_cap_krw: 108000,
      pension_credit_total_before_cap_krw: 1188000,
      credit_eligible_contribution_krw: 9000000,
      tax_liability_cap: fakeTaxLiabilityCap(),
      basis_rule_ids: [],
    },
    delta_vs_baseline_krw: 0,
    non_quantified_effects: [],
    ...overrides,
  };
}

export function fakeScenario(overrides = {}) {
  return {
    scenario_id: 'current',
    is_enacted: true,
    bill_stages: [],
    ruleset: { files: [], tax_year: 2026, status: '확정', effective_from: '2026-01-01' },
    account_eligibility: [
      { account: 'retirement_pension', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'annuity_savings', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'isa', eligible: true, reason_codes: [], basis_rule_ids: [] },
    ],
    limits: {
      by_account: [],
      pension_combined_credit_limit_krw: 0,
      pension_combined_credit_remaining_krw: 0,
      pension_contribution_limit_remaining_krw: 0,
      retirement_transfer_in_krw: 0,
      basis_rule_ids: [],
    },
    pension_credit_tax_liability_cap: {
      known: true,
      cap_krw: 3000000,
      determined_tax_krw: 3000000,
      prior_pension_credit_krw: 0,
      source_code: 'determined_tax_add_back',
      declared_nonzero: true,
      error_direction_code: null,
      credit_carryforward: false,
      basis_rule_ids: [],
    },
    pension_withdrawal_start: [
      {
        account: 'retirement_pension',
        computable: false,
        earliest_start_date: null,
        years_until_earliest_start: null,
        age_requirement_date: '2043-03-15',
        holding_requirement_date: null,
        holding_requirement_waived: false,
        bound_by_holding_period: false,
        reason_code: 'opened_on_missing',
        basis_rule_ids: [],
      },
    ],
    isa_transfer_extra_limit: null,
    fund_use_horizon_boundaries: {
      isa_lock_in_years: 3,
      isa_lock_in_years_remaining: 3,
      pension_min_age_years: 55,
      pension_years_remaining: 17,
      pension_holding_period_evaluated: false,
      basis_rule_ids: [],
    },
    plans: [fakePlan()],
    comparison_note_codes: [],
    legal_basis: [],
    unapplied_proposed_rules: [],
    notices: [],
    ...overrides,
  };
}

function fakeAnalytics() {
  const events = [];
  return { events, track: (name, props) => events.push({ name, props }) };
}

function validForm(store) {
  store.setField('birthDate', '1988-03-15');
  store.setField('currentSalary', '62000000');
  store.setField('hasNonWageIncome', false);
  store.setField('priorTax', { state: 'unknown', amount: '' });
  store.setField('monthlyCapacity', '800000');
  store.setField('annuityStarted', false);
  store.setField('fundUseHorizon', 'unknown');
}

// ---------------------------------------------------------------------------
// 계약 4.0.0 — 요청의 형태
// ---------------------------------------------------------------------------

test('the request carries the contract version the engine actually supports', () => {
  const req = buildEngineRequest(initialForm(), ['current']);
  assert.equal(req.schema_version, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION.split('.')[0], '6', '계약이 6.0.0(major)으로 올랐다(D32)');
});

test('the request sends the raw birth date and no derived age at all (D21)', () => {
  const form = { ...initialForm(), birthDate: '1988-03-15' };
  const req = buildEngineRequest(form, ['current']);
  assert.equal(req.profile.birth_date, '1988-03-15');
  assert.ok(!('age_years' in req.profile), '`age_years`는 4.0.0에서 사라졌다');
  // 화면이 나이를 만들지 않는다 — 어느 날짜 기준인지는 세법 판단이다.
  assert.ok(!JSON.stringify(req).includes('age_years'));
});

test('prior-year tax is sent as an explicit state, never inferred from a blank field', () => {
  // 폼의 결정세액은 만원 단위다(소유자 지시, 6절) — `buildPriorYearTax`가
  // 원 단위로 바꿔 계약에 싣는다.
  assert.deepEqual(buildPriorYearTax({ priorTaxState: 'amount', priorTaxAmount: '300' }), {
    state: 'amount',
    determined_tax_krw: 3000000,
    pension_credit_applied_krw: null,
  });
  assert.deepEqual(buildPriorYearTax({ priorTaxState: 'unknown', priorTaxAmount: '' }), {
    state: 'unknown',
    determined_tax_krw: null,
    pension_credit_applied_krw: null,
  });
  // `0`은 유효한 값이고 `모름`과 다르다(계약 3.5절).
  assert.deepEqual(buildPriorYearTax({ priorTaxState: 'amount', priorTaxAmount: '0' }), {
    state: 'amount',
    determined_tax_krw: 0,
    pension_credit_applied_krw: null,
  });
  // 결정세액은 만원으로 딱 떨어지지 않을 수 있다(예: 1,234,567원) — 소수
  // 넷째 자리(1원)까지 정확히 원 단위로 변환된다. 반올림이 없다.
  assert.deepEqual(buildPriorYearTax({ priorTaxState: 'amount', priorTaxAmount: '123.4567' }), {
    state: 'amount',
    determined_tax_krw: 1234567,
    pension_credit_applied_krw: null,
  });
});

test('annuity_start_status never defaults to not_started', () => {
  // 접는 방향의 오류가 과대다 — 연금 수령 중인 사용자에게 납입 가능액을 준다.
  assert.equal(annuityStartStatus({ annuityStarted: null }), 'unknown');
  assert.equal(annuityStartStatus({ annuityStarted: false }), 'not_started');
  assert.equal(annuityStartStatus({ annuityStarted: true }), 'started');
  const req = buildEngineRequest(initialForm(), ['current']);
  assert.equal(req.accounts.annuity_savings.annuity_start_status, 'unknown');
  assert.equal(req.accounts.retirement_pension.annuity_start_status, 'unknown');
});

// ---------------------------------------------------------------------------
// 계약 5.0.0(D27) — 공제율 판정 축의 두 물음
// ---------------------------------------------------------------------------

test('the first question defaults to false and never leaks a second answer past it', () => {
  // 답하지 않은 상태에서도 요청을 만들면(방어적으로) false를 보낸다 — `null`을
  // 그대로 보내면 계약이 요구하는 boolean이 아니다.
  const blankReq = buildEngineRequest(initialForm(), ['current']);
  assert.equal(blankReq.profile.has_non_wage_global_income_current_year, false);
  assert.equal(blankReq.profile.current_year_global_income_krw, null);

  // `아니오`를 명시적으로 골라도 둘째 물음의 값은 실리지 않는다 — 계약이
  // `false`인데 금액이 실리면 `invalid_enum`으로 되돌린다(3.1절).
  const noForm = { ...initialForm(), hasNonWageIncome: false, globalIncomeAmount: '4500' };
  const noReq = buildEngineRequest(noForm, ['current']);
  assert.equal(noReq.profile.has_non_wage_global_income_current_year, false);
  assert.equal(noReq.profile.current_year_global_income_krw, null);
});

test('the second question only sends an amount when the first is yes, and null when left blank (unknown)', () => {
  const yesUnknownForm = { ...initialForm(), hasNonWageIncome: true, globalIncomeAmount: '' };
  const yesUnknownReq = buildEngineRequest(yesUnknownForm, ['current']);
  assert.equal(yesUnknownReq.profile.has_non_wage_global_income_current_year, true);
  assert.equal(yesUnknownReq.profile.current_year_global_income_krw, null);

  const yesAmountForm = { ...initialForm(), hasNonWageIncome: true, globalIncomeAmount: '4500' };
  const yesAmountReq = buildEngineRequest(yesAmountForm, ['current']);
  assert.equal(yesAmountReq.profile.has_non_wage_global_income_current_year, true);
  assert.equal(yesAmountReq.profile.current_year_global_income_krw, 45000000);
});

test('the request keeps retirement transfers out of the contribution field', () => {
  // 여력에 섞여 들어오면 세액공제액이 과대 계산된다(계약 3.2절, 10절).
  // 입력은 만원 단위다 — '100'은 1,000,000원이다.
  const form = { ...initialForm(), annuitySavingsYtd: '100' };
  const req = buildEngineRequest(form, ['current']);
  assert.equal(req.accounts.annuity_savings.ytd_contribution_krw, 1000000);
  assert.equal(req.accounts.annuity_savings.retirement_transfer_in_krw, null);
});

// ---------------------------------------------------------------------------
// 6절 — 금액 입력은 만원 단위, 계약에는 원 단위로 나간다
// ---------------------------------------------------------------------------

test('every money field in the request is converted from 만원 (screen unit) to 원 (contract unit)', () => {
  const form = {
    ...initialForm(),
    currentSalary: '6200', // 62,000,000원
    priorSalaryEnabled: true,
    priorSalary: '5800', // 58,000,000원
    monthlyCapacity: '80', // 800,000원
    annuitySavingsYtd: '300', // 3,000,000원
    retirementPensionYtd: '250.5', // 2,505,000원
    isaExists: true,
    isaCumulative: '1200', // 12,000,000원
    isaYtd: '400', // 4,000,000원
    isaTransferEnabled: true,
    isaTransferAmount: '500', // 5,000,000원
    isaTransferPriorApplied: '10', // 100,000원
  };
  const req = buildEngineRequest(form, ['current']);
  assert.equal(req.profile.current_year_total_salary_krw, 62000000);
  assert.equal(req.profile.prior_year_total_salary_krw, 58000000);
  assert.equal(req.profile.monthly_capacity_krw, 800000);
  assert.equal(req.accounts.annuity_savings.ytd_contribution_krw, 3000000);
  assert.equal(req.accounts.retirement_pension.ytd_contribution_krw, 2505000);
  assert.equal(req.accounts.isa.cumulative_contribution_krw, 12000000);
  assert.equal(req.accounts.isa.ytd_contribution_krw, 4000000);
  assert.equal(req.isa_transfer.amount_krw, 5000000);
  assert.equal(req.isa_transfer.prior_year_applied_extra_credit_krw, 100000);
});

test('an unparsable money field falls back the same way a blank one does — never NaN reaching the engine', () => {
  const req = buildEngineRequest({ ...initialForm(), currentSalary: 'not a number' }, ['current']);
  assert.equal(req.profile.current_year_total_salary_krw, 0);
  assert.ok(!Number.isNaN(req.profile.current_year_total_salary_krw));
});

test('declared_youth stays null until the user checks it — the screen never fills it from an age', () => {
  assert.equal(buildEngineRequest(initialForm(), ['current']).profile.declared_youth, null);
  assert.equal(buildEngineRequest({ ...initialForm(), declaredYouth: true }, ['current']).profile.declared_youth, true);
});

test('the financial-income answer maps to a tri-state, with unknown staying null', () => {
  const withIsa = (v) => buildEngineRequest({ ...initialForm(), isaExists: true, isaFinancialIncomeTaxpayer: v }, ['current']);
  assert.equal(withIsa('yes').profile.financial_income_taxpayer_last_3_years, true);
  assert.equal(withIsa('no').profile.financial_income_taxpayer_last_3_years, false);
  assert.equal(withIsa('unknown').profile.financial_income_taxpayer_last_3_years, null);
  assert.equal(withIsa(null).profile.financial_income_taxpayer_last_3_years, null);
});

// ---------------------------------------------------------------------------
// D28·D29·D31 — 수익률 가정. 화면이 제안하거나 미리 채우지 않는다는 것이
// 계약이 막을 수 없고 이 유닛이 지는 방어선이다(0.10절).
// ---------------------------------------------------------------------------

test('the screen never proposes or prefills a return rate — the form starts empty and off', () => {
  const form = initialForm();
  assert.equal(form.isaReturnEnabled, false);
  assert.equal(form.isaReturnRatePercent, '', '예시 숫자를 입력칸에 넣지 않는다');
  assert.equal(form.isaIncomeCharacter, null);
  assert.equal(form.isaSettlementYears, '');
  assert.equal(form.isaLossAmount, '');
});

test('untouched or turned-off, the request carries no assumption at all — the engine reads zero return rules', () => {
  assert.equal(buildEngineRequest(initialForm(), ['current']).profile.isa_return_assumption, null);
  const filledButOff = {
    ...initialForm(),
    isaExists: true,
    isaReturnEnabled: false,
    isaReturnRatePercent: '7',
    isaIncomeCharacter: 'interest_dividend',
  };
  assert.equal(
    buildEngineRequest(filledButOff, ['current']).profile.isa_return_assumption,
    null,
    '토글이 꺼져 있으면 나머지 값이 있어도 보내지 않는다',
  );
});

test('turning the toggle on without ISA held still sends the assumption — the engine allocates to ISA either way (2026-08-10)', () => {
  // 예전엔 여기서 null을 기대했다. 그런데 계약은 `IsaReturnAssumption`을
  // `accounts.isa.exists`와 엮지 않는다 — ISA 미보유자에게도 신규 가입을
  // 전제로 배분하므로(`isa_new_account_assumed`), 수익률 가정은 계좌 보유
  // 여부와 무관하게 유효하다. `isaReturnEnabled` 토글도 이제 `isaExists`
  // 조건부 블록 밖에 있어(`ui/input-panel.js`) 이 상태에 실제로 도달할 수
  // 있다 — 그러니 이 함수가 조용히 null을 돌려주면 안 된다.
  const form = { ...initialForm(), isaExists: false, isaReturnEnabled: true, isaReturnRatePercent: '7', isaIncomeCharacter: 'interest_dividend' };
  const assumption = buildIsaReturnAssumption(form);
  assert.notEqual(assumption, null, 'ISA 미보유자도 수익률 가정을 보낼 수 있어야 한다');
  assert.equal(assumption.annual_return_rate, 0.07);
  assert.equal(assumption.income_character, 'interest_dividend');
});

test('a fully answered toggle sends the rate as a ratio, not a percent, and the exact character id', () => {
  const form = {
    ...initialForm(),
    isaExists: true,
    isaReturnEnabled: true,
    isaReturnRatePercent: '5.5',
    isaIncomeCharacter: 'mixed_or_unknown',
  };
  const assumption = buildIsaReturnAssumption(form);
  assert.equal(assumption.annual_return_rate, 0.055, '퍼센트가 아니라 비율(0~1)이다');
  assert.equal(assumption.income_character, 'mixed_or_unknown');
  assert.equal(assumption.settlement_years, null, '입력하지 않으면 null — 엔진이 계약기간 하한을 가정으로 세운다');
  assert.equal(assumption.loss_amount_krw, null, '입력하지 않으면 null — 엔진이 0으로 본다');
});

test('settlement years and loss amount pass through when the user actually supplies them', () => {
  const form = {
    ...initialForm(),
    isaExists: true,
    isaReturnEnabled: true,
    isaReturnRatePercent: '5',
    isaIncomeCharacter: 'interest_dividend',
    isaSettlementYears: '5',
    isaLossAmount: '10', // 100,000원
  };
  const assumption = buildIsaReturnAssumption(form);
  assert.equal(assumption.settlement_years, 5);
  assert.equal(assumption.loss_amount_krw, 100000);
});

test('an incomplete pair (rate without a declared character, or vice versa) sends nothing rather than half an object', () => {
  const rateOnly = { ...initialForm(), isaExists: true, isaReturnEnabled: true, isaReturnRatePercent: '5', isaIncomeCharacter: null };
  assert.equal(buildIsaReturnAssumption(rateOnly), null);
  const characterOnly = { ...initialForm(), isaExists: true, isaReturnEnabled: true, isaReturnRatePercent: '', isaIncomeCharacter: 'interest_dividend' };
  assert.equal(buildIsaReturnAssumption(characterOnly), null);
});

test('the display-suppress switch is a single code-level constant, not a per-request user toggle, and defaults to shown', () => {
  assert.equal(ASSUMPTION_BASED_ISA_ESTIMATE_DISPLAY, 'include');
  assert.equal(buildEngineRequest(initialForm(), ['current']).options.assumption_based_isa_estimate, 'include');
});

// ---------------------------------------------------------------------------
// 갱신 규약 (design-system 6.1절)
// ---------------------------------------------------------------------------

test('starts blank and moves to input_incomplete as soon as one field is touched', () => {
  const store = createStore({ engineClient: fakeEngine(), analytics: fakeAnalytics(), onChange: () => {} });
  assert.equal(store.getState().status, 'blank');
  store.setField('birthDate', '1988-03-15');
  assert.equal(store.getState().status, 'input_incomplete');
});

test('never calls compute until all seven core fields are valid, then computes on the trailing field', async () => {
  let calls = 0;
  let seen = null;
  const engine = fakeEngine({
    compute: async (req) => {
      calls++;
      seen = req;
      return okResponse();
    },
  });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  store.setField('birthDate', '1988-03-15');
  store.setField('currentSalary', '62000000');
  store.setField('hasNonWageIncome', false);
  store.setField('priorTax', { state: 'unknown', amount: '' });
  store.setField('monthlyCapacity', '800000');
  store.setField('annuityStarted', false);
  assert.equal(calls, 0, '일곱 항목이 다 차기 전에는 계산하지 않는다');
  store.setField('fundUseHorizon', 'unknown', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls, 1);
  assert.equal(store.getState().status, 'result');
  assert.equal(seen.profile.prior_year_tax.state, 'unknown');
  assert.equal(seen.profile.has_non_wage_global_income_current_year, false);
});

test('the unknown determined tax still produces a result — it does not block the screen', async () => {
  const store = createStore({ engineClient: fakeEngine(), analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.flush();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'result');
});

test('result_shown fires exactly once even after repeated recomputation', async () => {
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  store.setField('monthlyCapacity', '900000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(analytics.events.filter((e) => e.name === 'result_shown').length, 1);
});

test('has_alternatives passed to analytics reflects plans.length, never raw form values', async () => {
  const analytics = fakeAnalytics();
  const engine = fakeEngine({
    compute: async () =>
      okResponse({
        scenarios: [fakeScenario({ plans: [fakePlan(), fakePlan({ plan_id: 'isa_first', is_baseline: false })] })],
      }),
  });
  const store = createStore({ engineClient: engine, analytics, onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  const evt = analytics.events.find((e) => e.name === 'result_shown');
  assert.deepEqual(Object.keys(evt.props), ['has_alternatives']);
  assert.equal(evt.props.has_alternatives, true);
});

test('a stale in-flight request never clobbers a newer one', async () => {
  let resolveFirst;
  let call = 0;
  const engine = fakeEngine({
    compute: async () => {
      call++;
      const files = call === 1 ? ['first'] : ['second'];
      if (call === 1) await new Promise((r) => (resolveFirst = r));
      return okResponse({
        scenarios: [fakeScenario({ ruleset: { files, tax_year: 2026, status: '확정', effective_from: '2026-01-01' } })],
      });
    },
  });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true }); // 1차 요청 (지연됨)
  store.setField('monthlyCapacity', '900000', { immediate: true }); // 2차 요청 (먼저 끝남)
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().result.scenarios[0].ruleset.files[0], 'second');
  resolveFirst();
  await new Promise((r) => setTimeout(r, 10));
  // 1차 응답이 늦게 도착해도 2차 결과를 덮어쓰지 않는다.
  assert.equal(store.getState().result.scenarios[0].ruleset.files[0], 'second');
});

test('a fatal ruleset_load_failed error clears any prior result and sets fatal_error', async () => {
  const engine = fakeEngine({
    compute: async () => ({ ok: false, schema_version: SCHEMA_VERSION, errors: [{ code: 'ruleset_load_failed', field: null, params: {} }] }),
  });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'fatal_error');
  assert.equal(store.getState().result, null);
});

test('a schema_version_mismatch is fatal and never shows a stale result as if it were current', async () => {
  // 이번 회차가 시작된 자리다. 조용히 옛 숫자를 계속 내보내는 것보다 멈추는 것이
  // 낫다는 판단이므로, 화면도 그 오류를 결과로 감싸지 않는다.
  let first = true;
  const engine = fakeEngine({
    compute: async () => {
      if (first) {
        first = false;
        return okResponse();
      }
      return { ok: false, schema_version: SCHEMA_VERSION, errors: [{ code: 'schema_version_mismatch', field: 'schema_version', params: {} }] };
    },
  });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'result');
  store.setField('monthlyCapacity', '900000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'fatal_error');
  assert.equal(store.getState().result, null, '멈춰야 할 때 옛 결과를 남기면 조용히 틀린 값을 보인다');
});

test('reset() returns to blank and clears the cached result', async () => {
  const store = createStore({ engineClient: fakeEngine(), analytics: fakeAnalytics(), onChange: () => {} });
  validForm(store);
  store.setField('monthlyCapacity', '800000', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(store.getState().status, 'result');
  store.reset();
  assert.equal(store.getState().status, 'blank');
  assert.equal(store.getState().result, null);
  assert.equal(store.getState().form.fundUseHorizon, null);
  assert.equal(store.getState().form.birthDate, '');
  assert.equal(store.getState().form.priorTaxState, null);
  assert.equal(store.getState().form.annuityStarted, null);
});

test('input_start fires once for the very first touched field only', () => {
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  store.setField('birthDate', '1988-03-15');
  store.setField('currentSalary', '1');
  assert.equal(analytics.events.filter((e) => e.name === 'input_start').length, 1);
  assert.equal(analytics.events[0].props.field_name, 'birthDate');
  // **필드 이름이지 값이 아니다**(analytics-plan.md 1절 · screens.md 3.7.5절 못 3).
  assert.deepEqual(Object.keys(analytics.events[0].props), ['field_name']);
});

test('the boundaries lookup also sends the birth date, and waits until it is a real date', async () => {
  const seen = [];
  const engine = fakeEngine({
    computeFundUseHorizonBoundaries: async (req) => {
      seen.push(req);
      return { ok: true, schema_version: SCHEMA_VERSION, boundaries: {}, legal_basis: [], notices: [] };
    },
  });
  const store = createStore({ engineClient: engine, analytics: fakeAnalytics(), onChange: () => {} });
  store.setField('birthDate', '1988-03'); // 아직 여덟 자리가 아니다
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(seen.length, 0);
  store.setField('birthDate', '1988-03-15');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].birth_date, '1988-03-15');
  assert.ok(!('age_years' in seen[0]));
});

// ---------------------------------------------------------------------------
// 계측 경계 — 늘어난 입력이 새지 않는가
// ---------------------------------------------------------------------------

test('no analytics event ever carries a value the user typed', async () => {
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  store.setField('birthDate', '1988-03-15');
  store.setField('currentSalary', '62000000');
  store.setField('priorTax', { state: 'amount', amount: '3141592' });
  store.setField('monthlyCapacity', '800000');
  store.setField('annuityStarted', true);
  store.setField('declaredYouth', true);
  store.setField('fundUseHorizon', 'within_isa_lock_in', { immediate: true });
  await new Promise((r) => setTimeout(r, 10));
  store.reportSaveShare('screenshot');
  store.reportAlternativeClick();

  const serialized = JSON.stringify(analytics.events);
  for (const secret of ['1988-03-15', '1988', '03-15', '62000000', '3141592', '800000', 'within_isa_lock_in']) {
    assert.ok(!serialized.includes(secret), `계측 이벤트에 입력값이 실렸다: ${secret}\n${serialized}`);
  }
  assert.ok(!serialized.includes('declaredYouth'), serialized);
});

test('the return-rate assumption fields never leak a value into analytics either — same mechanism, D28 does not get a carve-out', () => {
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  store.setField('isaExists', true, { immediate: true });
  store.setField('isaReturnEnabled', true, { immediate: true });
  store.setField('isaReturnRatePercent', '7.25');
  store.setField('isaIncomeCharacter', 'mixed_or_unknown', { immediate: true });
  store.setField('isaSettlementYears', '5');
  store.setField('isaLossAmount', '300');

  const serialized = JSON.stringify(analytics.events);
  for (const secret of ['7.25', 'mixed_or_unknown', '300']) {
    assert.ok(!serialized.includes(secret), `계측 이벤트에 입력값이 실렸다: ${secret}\n${serialized}`);
  }
});

test('touching the youth checkbox first does not become an analytics event', () => {
  // 이 체크를 가장 먼저 만졌다는 사실은 "본인이 대상이라고 생각한다"를 거의 그대로
  // 뜻한다 — 3.9.5절이 그 상태를 만 나이 구간의 1:1 대리변수로 보아 금지했다.
  const analytics = fakeAnalytics();
  const store = createStore({ engineClient: fakeEngine(), analytics, onChange: () => {} });
  store.setField('declaredYouth', true);
  assert.equal(analytics.events.length, 0);
  store.setField('currentSalary', '1');
  assert.equal(analytics.events.length, 1);
  assert.equal(analytics.events[0].props.field_name, 'currentSalary');
});
