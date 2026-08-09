// 골든 블록의 **형식**과 **대조 절차**. 기대값은 여기에 한 개도 없다.
//
// `golden-cases.test.mjs`가 이 모듈로 문서를 읽어 전건을 돌리고,
// `golden-block-format.test.mjs`가 같은 모듈에 합성 블록을 넣어 **형식 자체가 무는지**를
// 시험한다. 두 파일이 같은 코드를 쓰기 때문에 형식 시험이 실제 실행기를 시험한 것이 된다.
//
// **왜 실행기에서 떼어냈나.** 실행기 파일은 "기대값을 적을 자리를 두지 않는다"는 것이
// 그 파일의 규약이다. 형식이 도는지 보이려면 어딘가에 값이 있어야 하므로, 값을 그 파일에
// 들이는 대신 형식 기계를 밖으로 내보냈다.
//
// 이 파일은 테스트 전용이다 — `index.mjs`가 내보내지 않으므로 제품 번들에 들어가지 않는다.
// `test-helpers.mjs`와 같이 확장자가 `.test.mjs`가 아닌 이유는 러너가 테스트 파일로
// 잡지 않게 하기 위해서다. **여기 있는 숫자는 세법 수치가 아니라 실행기의 픽스처다**
// (기본 과세연도와 "한도가 걸리지 않는 결정세액" 하나뿐이고, 둘 다 아래에 이유를 적었다).

import assert from 'node:assert/strict';

import {
  ACCOUNT_ORDER,
  PENSION_ACCOUNT_KEYS,
  PLAN_ORDER,
  SCENARIO_ORDER,
  SCHEMA_VERSION,
} from './constants.mjs';

// ── 블록 형식 ────────────────────────────────────────────────────────────────
//
// 허용 키를 전부 열거한다. 오타 난 키를 조용히 무시하면 그 항목은 검사되지 않는데도
// 검사된 것처럼 보인다 — 이 저장소가 세 번 밟은 침묵과 같은 형태다.

const ACCOUNTS = [...ACCOUNT_ORDER];
export const CASE_KEYS = ['case', 'request', 'credit_rate', 'expect'];
export const CREDIT_RATE_KEYS = ['income_tax', 'local_tax', 'effective'];
export const SCENARIO_KEYS = [
  'plans',
  'plan_count',
  'baseline_plan',
  'isa_eligible',
  'isa_reason_codes',
  'limits',
  'boundaries',
  // 6차에 계약 4.0.0이 낸 축. 배분 비율이 아니라 **시점**이라 시나리오 단위에 둔다.
  'pension_withdrawal_start',
  'notice_codes',
  'notice_codes_absent',
  'comparison_note_codes',
  'comparison_note_codes_absent',
];
export const PLAN_KEYS = [
  'allocation',
  'tax_credit',
  // 계약 4.0.0에서 `tax_credit`이 한도 적용 **후** 값이 됐다. 자르기 전 금액은
  // 별도 축이고, 둘 다 적어야 "얼마가 잘렸는가"가 블록의 주장이 된다.
  'tax_credit_before_cap',
  'tax_liability_cap',
  'warning_count',
  'warning_codes',
  'limited_by',
  'fill_order',
  'monthly_krw',
  'unallocated_krw',
  'monthly_rounding_residual_krw',
  'delta_vs_baseline_krw',
  'credit_eligible_krw',
  'tie_break',
  // 목적함수가 이 입력에서 순위를 정하지 못한다는 자기 신고(계약 5.12절).
  'objective_degenerate',
  'is_baseline',
];
export const TAX_CREDIT_KEYS = ['income_tax', 'local_tax', 'total'];
export const LIMIT_KEYS = [
  'pension_combined_credit_limit_krw',
  'pension_combined_credit_remaining_krw',
  'pension_contribution_limit_remaining_krw',
  'annuity_savings_credit_remaining_krw',
  'isa_contribution_remaining_krw',
  'isa_tax_free_limit_krw',
  'isa_transfer_extra_credit_limit_krw',
];
export const BOUNDARY_KEYS = [
  'isa_lock_in_years',
  'isa_lock_in_years_remaining',
  'pension_min_age_years',
  'pension_years_remaining',
  'pension_holding_period_evaluated',
];
/** 배분안 단위 세액 한도. D22가 이름으로 지목한 넷이다. */
export const PLAN_TAX_CAP_KEYS = ['known', 'cap_krw', 'applied', 'threshold_income_tax_krw'];
export const PENSION_START_KEYS = [
  'computable',
  'earliest_start_date',
  'years_until_earliest_start',
  'age_requirement_date',
  'holding_requirement_date',
  'holding_requirement_waived',
  'bound_by_holding_period',
  'reason_code',
];

const CASE_ID = /^GC-\d{2}[a-z]?(-oracle)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── 문서 파싱 ────────────────────────────────────────────────────────────────

/** ```golden 펜스 블록을 본문에서 떼어낸다. 줄 번호는 오류 메시지용이다. */
export function extractBlocks(text) {
  // 정보 문자열이 정확히 `golden`인 블록만 잡는다. 형식을 설명하는 예시 블록이
  // 실제 케이스로 오인되면 안 된다.
  const fence = /^```golden[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;
  const blocks = [];
  let stripped = '';
  let cursor = 0;

  for (let match = fence.exec(text); match !== null; match = fence.exec(text)) {
    blocks.push({
      body: match[1],
      line: text.slice(0, match.index).split('\n').length,
    });
    stripped += text.slice(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  stripped += text.slice(cursor);

  return { blocks, prose: stripped };
}

/**
 * 산문에 등장하는 케이스 ID를 전부 모은다. `GC-15~17`·`GC-18a~d` 같은 범위 표기를
 * 펼치므로, 표에 범위로만 적힌 케이스도 블록을 요구받는다.
 */
export function caseIdsIn(text) {
  const token = /GC-(\d{2})([a-z]?)(-oracle)?(?:~(\d{2})?([a-z])?)?/g;
  const ids = new Set();
  const problems = [];

  for (let match = token.exec(text); match !== null; match = token.exec(text)) {
    const [raw, num, suffix, oracle, tailNum, tailSuffix] = match;

    if (tailNum === undefined && tailSuffix === undefined) {
      ids.add(`GC-${num}${suffix}${oracle ?? ''}`);
      continue;
    }
    if (oracle) {
      problems.push(`범위 표기를 읽을 수 없다: ${raw}`);
      continue;
    }
    if (tailNum === undefined) {
      // `GC-18a~d` — 같은 번호 안에서 접미사가 이어진다.
      if (!suffix || tailSuffix < suffix) {
        problems.push(`범위 표기를 읽을 수 없다: ${raw}`);
        continue;
      }
      for (let c = suffix.charCodeAt(0); c <= tailSuffix.charCodeAt(0); c += 1) {
        ids.add(`GC-${num}${String.fromCharCode(c)}`);
      }
      continue;
    }
    // `GC-15~17` — 번호가 이어진다.
    if (suffix || tailSuffix || Number(tailNum) < Number(num)) {
      problems.push(`범위 표기를 읽을 수 없다: ${raw}`);
      continue;
    }
    for (let n = Number(num); n <= Number(tailNum); n += 1) {
      ids.add(`GC-${String(n).padStart(2, '0')}`);
    }
  }

  return { ids, problems };
}

// ── 블록 검증 ────────────────────────────────────────────────────────────────

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function unknownKeys(object, allowed, where, errors) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      errors.push(`${where}: 모르는 키 "${key}" (허용: ${allowed.join(', ')})`);
    }
  }
}

function requireObject(value, where, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${where}: 객체여야 한다`);
    return false;
  }
  return true;
}

/**
 * 빈 객체를 거절한다. `tax_liability_cap: {}`처럼 적으면 키는 있는데 주장은 없어서
 * "적혔으니 검사됐다"고 보이면서 실제로는 아무것도 보지 않는다 — 이 장치가 막으려는
 * 상태 그 자체다.
 */
function requireNonEmptyObject(value, where, errors) {
  if (!requireObject(value, where, errors)) return false;
  if (Object.keys(value).length === 0) {
    errors.push(`${where}: 빈 객체는 아무것도 주장하지 않는다 — 적을 것이 없으면 키째로 빼라`);
    return false;
  }
  return true;
}

function requireInt(value, where, errors) {
  if (!Number.isInteger(value)) errors.push(`${where}: 정수여야 한다 (받은 값: ${JSON.stringify(value)})`);
}

function requireIntOrNull(value, where, errors) {
  if (value !== null && !Number.isInteger(value)) {
    errors.push(`${where}: 정수 또는 null이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireBoolean(value, where, errors) {
  if (typeof value !== 'boolean') {
    errors.push(`${where}: 참/거짓이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireDateOrNull(value, where, errors) {
  if (value !== null && !(typeof value === 'string' && ISO_DATE.test(value))) {
    errors.push(`${where}: YYYY-MM-DD 또는 null이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireStringOrNull(value, where, errors) {
  if (value !== null && typeof value !== 'string') {
    errors.push(`${where}: 문자열 또는 null이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireStringArray(value, where, errors) {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    errors.push(`${where}: 문자열 배열이어야 한다`);
  }
}

function validateAmountMap(value, where, allowed, errors, { exact = false } = {}) {
  if (!requireObject(value, where, errors)) return;
  unknownKeys(value, allowed, where, errors);
  if (exact) {
    for (const key of allowed) {
      if (!(key in value)) errors.push(`${where}: "${key}"가 빠졌다 — 세 계좌를 모두 적는다`);
    }
  }
  for (const [key, amount] of Object.entries(value)) {
    if (allowed.includes(key)) requireInt(amount, `${where}.${key}`, errors);
  }
}

/** 소득세 + 지방세 = 합계. 옮겨 적다 어긋나는 자리라 형식 단계에서 본다. */
function validateTaxCredit(value, where, errors) {
  validateAmountMap(value, where, TAX_CREDIT_KEYS, errors, { exact: true });
  const { income_tax: income, local_tax: local, total } = value ?? {};
  if ([income, local, total].every(Number.isInteger) && income + local !== total) {
    errors.push(
      `${where}: 소득세 ${income} + 지방세 ${local} ≠ 합계 ${total} — 옮겨 적으면서 어긋났다`,
    );
  }
}

function validatePlanTaxCap(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, PLAN_TAX_CAP_KEYS, where, errors);

  if ('known' in value) requireBoolean(value.known, `${where}.known`, errors);
  if ('applied' in value) requireBoolean(value.applied, `${where}.applied`, errors);
  // 한도 `0`은 유효한 값이고 `null`(모름)과 다르다(계약 5.10절).
  if ('cap_krw' in value) requireIntOrNull(value.cap_krw, `${where}.cap_krw`, errors);
  if ('threshold_income_tax_krw' in value) {
    requireInt(value.threshold_income_tax_krw, `${where}.threshold_income_tax_krw`, errors);
  }
  // 모르는 한도로 자를 수는 없다. 블록이 그렇게 적었으면 옮겨 적다 어긋난 것이다.
  if (value.known === false && value.applied === true) {
    errors.push(`${where}: known:false인데 applied:true다 — 모르는 한도로 자를 수 없다`);
  }
  if (value.known === false && 'cap_krw' in value && value.cap_krw !== null) {
    errors.push(`${where}: known:false인데 cap_krw가 null이 아니다`);
  }
}

function validatePensionStart(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, PENSION_ACCOUNT_KEYS, where, errors);

  for (const [account, entry] of Object.entries(value)) {
    if (!PENSION_ACCOUNT_KEYS.includes(account)) continue;
    const at = `${where}.${account}`;
    if (!requireNonEmptyObject(entry, at, errors)) continue;
    unknownKeys(entry, PENSION_START_KEYS, at, errors);

    for (const key of ['computable', 'holding_requirement_waived', 'bound_by_holding_period']) {
      if (key in entry) requireBoolean(entry[key], `${at}.${key}`, errors);
    }
    for (const key of ['earliest_start_date', 'age_requirement_date', 'holding_requirement_date']) {
      if (key in entry) requireDateOrNull(entry[key], `${at}.${key}`, errors);
    }
    if ('years_until_earliest_start' in entry) {
      requireIntOrNull(entry.years_until_earliest_start, `${at}.years_until_earliest_start`, errors);
    }
    if ('reason_code' in entry) requireStringOrNull(entry.reason_code, `${at}.reason_code`, errors);

    // 계산하지 못했다면 날짜가 있을 수 없다. 형식 단계에서 자기모순을 잡는다.
    if (entry.computable === false && entry.earliest_start_date != null) {
      errors.push(`${at}: computable:false인데 earliest_start_date가 있다`);
    }
    if (entry.computable === true && 'earliest_start_date' in entry && entry.earliest_start_date === null) {
      errors.push(`${at}: computable:true인데 earliest_start_date가 null이다`);
    }
  }
}

function validatePlan(plan, where, errors) {
  if (!requireObject(plan, where, errors)) return;
  unknownKeys(plan, PLAN_KEYS, where, errors);

  for (const key of ['allocation', 'tax_credit', 'warning_count']) {
    if (!(key in plan)) errors.push(`${where}: 필수 항목 "${key}"가 없다`);
  }

  if ('allocation' in plan) {
    validateAmountMap(plan.allocation, `${where}.allocation`, ACCOUNTS, errors, { exact: true });
  }
  if ('monthly_krw' in plan) {
    validateAmountMap(plan.monthly_krw, `${where}.monthly_krw`, ACCOUNTS, errors);
  }
  if ('tax_credit' in plan) validateTaxCredit(plan.tax_credit, `${where}.tax_credit`, errors);
  if ('tax_credit_before_cap' in plan) {
    validateTaxCredit(plan.tax_credit_before_cap, `${where}.tax_credit_before_cap`, errors);
  }
  if ('tax_liability_cap' in plan) {
    validatePlanTaxCap(plan.tax_liability_cap, `${where}.tax_liability_cap`, errors);
  }
  if ('warning_count' in plan) requireInt(plan.warning_count, `${where}.warning_count`, errors);
  if ('warning_codes' in plan) requireStringArray(plan.warning_codes, `${where}.warning_codes`, errors);
  if ('limited_by' in plan) {
    if (requireObject(plan.limited_by, `${where}.limited_by`, errors)) {
      unknownKeys(plan.limited_by, ACCOUNTS, `${where}.limited_by`, errors);
    }
  }
  if ('fill_order' in plan) {
    if (requireObject(plan.fill_order, `${where}.fill_order`, errors)) {
      unknownKeys(plan.fill_order, ACCOUNTS, `${where}.fill_order`, errors);
    }
  }
  for (const key of [
    'unallocated_krw',
    'monthly_rounding_residual_krw',
    'delta_vs_baseline_krw',
    'credit_eligible_krw',
  ]) {
    if (key in plan) requireInt(plan[key], `${where}.${key}`, errors);
  }
  if ('tie_break' in plan && typeof plan.tie_break !== 'string') {
    errors.push(`${where}.tie_break: 문자열이어야 한다`);
  }
  if ('objective_degenerate' in plan) {
    requireBoolean(plan.objective_degenerate, `${where}.objective_degenerate`, errors);
  }
  if ('is_baseline' in plan && typeof plan.is_baseline !== 'boolean') {
    errors.push(`${where}.is_baseline: 참/거짓이어야 한다`);
  }
}

function validateScenario(expectation, where, errors) {
  if (!requireObject(expectation, where, errors)) return;
  unknownKeys(expectation, SCENARIO_KEYS, where, errors);

  if (!isPlainObject(expectation.plans) || Object.keys(expectation.plans).length === 0) {
    errors.push(`${where}.plans: 배분안을 최소 하나 적어야 한다`);
  } else {
    for (const [planId, plan] of Object.entries(expectation.plans)) {
      if (!PLAN_ORDER.includes(planId)) {
        errors.push(`${where}.plans: 모르는 배분안 "${planId}" (허용: ${PLAN_ORDER.join(', ')})`);
        continue;
      }
      validatePlan(plan, `${where}.plans.${planId}`, errors);
    }
  }

  if ('plan_count' in expectation) requireInt(expectation.plan_count, `${where}.plan_count`, errors);
  if ('baseline_plan' in expectation && !PLAN_ORDER.includes(expectation.baseline_plan)) {
    errors.push(`${where}.baseline_plan: 모르는 배분안 "${expectation.baseline_plan}"`);
  }
  if ('isa_eligible' in expectation && typeof expectation.isa_eligible !== 'boolean') {
    errors.push(`${where}.isa_eligible: 참/거짓이어야 한다`);
  }
  for (const key of [
    'isa_reason_codes',
    'notice_codes',
    'notice_codes_absent',
    'comparison_note_codes',
    'comparison_note_codes_absent',
  ]) {
    if (key in expectation) requireStringArray(expectation[key], `${where}.${key}`, errors);
  }
  if ('limits' in expectation && requireNonEmptyObject(expectation.limits, `${where}.limits`, errors)) {
    unknownKeys(expectation.limits, LIMIT_KEYS, `${where}.limits`, errors);
  }
  if (
    'boundaries' in expectation &&
    requireNonEmptyObject(expectation.boundaries, `${where}.boundaries`, errors)
  ) {
    unknownKeys(expectation.boundaries, BOUNDARY_KEYS, `${where}.boundaries`, errors);
  }
  if ('pension_withdrawal_start' in expectation) {
    validatePensionStart(
      expectation.pension_withdrawal_start,
      `${where}.pension_withdrawal_start`,
      errors,
    );
  }
}

export function validateBlock(parsed, where) {
  const errors = [];
  if (!requireObject(parsed, where, errors)) return errors;

  unknownKeys(parsed, CASE_KEYS, where, errors);

  if (typeof parsed.case !== 'string' || !CASE_ID.test(parsed.case)) {
    errors.push(`${where}: "case"가 GC-XX 형태의 케이스 ID여야 한다 (받은 값: ${JSON.stringify(parsed.case)})`);
  }
  if (!isPlainObject(parsed.request)) {
    errors.push(`${where}: "request"가 없다 — compute()에 그대로 넘길 요청이다`);
  }
  if ('credit_rate' in parsed && requireNonEmptyObject(parsed.credit_rate, `${where}.credit_rate`, errors)) {
    unknownKeys(parsed.credit_rate, CREDIT_RATE_KEYS, `${where}.credit_rate`, errors);
  }

  if (!isPlainObject(parsed.expect) || Object.keys(parsed.expect).length === 0) {
    errors.push(`${where}: "expect"에 시나리오를 최소 하나 적어야 한다`);
  } else {
    for (const [scenarioId, expectation] of Object.entries(parsed.expect)) {
      if (!SCENARIO_ORDER.includes(scenarioId)) {
        errors.push(`${where}.expect: 모르는 시나리오 "${scenarioId}" (허용: ${SCENARIO_ORDER.join(', ')})`);
        continue;
      }
      validateScenario(expectation, `${where}.expect.${scenarioId}`, errors);
    }
  }

  return errors;
}

// ── 어휘 사용량 ──────────────────────────────────────────────────────────────
//
// `qa`가 지적한 "블록이 얼마나 많이 주장하는가"를 기계로 세는 자리다.
// 세는 단위는 **허용 키 하나**다. 응답의 필드 전체가 아니라 어휘를 세는 이유는
// `golden-cases.test.mjs` 검사 4의 주석에 적었다.

/** 허용 키 하나하나에 이름을 붙인 것. 이 목록이 "블록이 주장할 수 있는 것"의 전부다. */
export const VOCABULARY = [
  ...CREDIT_RATE_KEYS.map((k) => `credit_rate.${k}`),
  ...SCENARIO_KEYS.filter((k) => k !== 'plans').map((k) => `scenario.${k}`),
  ...LIMIT_KEYS.map((k) => `limits.${k}`),
  ...BOUNDARY_KEYS.map((k) => `boundaries.${k}`),
  ...PENSION_START_KEYS.map((k) => `pension_withdrawal_start.${k}`),
  ...PLAN_KEYS.map((k) => `plan.${k}`),
  ...PLAN_TAX_CAP_KEYS.map((k) => `tax_liability_cap.${k}`),
];

/** 블록 하나가 실제로 주장한 어휘. 값이 아니라 **적혔는가**만 본다. */
export function vocabularyUsedBy(parsed) {
  const used = new Set();
  for (const key of Object.keys(parsed.credit_rate ?? {})) used.add(`credit_rate.${key}`);

  for (const expectation of Object.values(parsed.expect ?? {})) {
    for (const key of Object.keys(expectation)) {
      if (key !== 'plans') used.add(`scenario.${key}`);
    }
    for (const key of Object.keys(expectation.limits ?? {})) used.add(`limits.${key}`);
    for (const key of Object.keys(expectation.boundaries ?? {})) used.add(`boundaries.${key}`);
    for (const entry of Object.values(expectation.pension_withdrawal_start ?? {})) {
      for (const key of Object.keys(entry ?? {})) used.add(`pension_withdrawal_start.${key}`);
    }
    for (const plan of Object.values(expectation.plans ?? {})) {
      for (const key of Object.keys(plan)) used.add(`plan.${key}`);
      for (const key of Object.keys(plan.tax_liability_cap ?? {})) {
        used.add(`tax_liability_cap.${key}`);
      }
    }
  }
  return used;
}

// ── 요청 조립 ────────────────────────────────────────────────────────────────

/**
 * 골든 블록에 없는 새 필수 입력을 채운다. **이 함수는 골든 케이스가 지금까지 무엇을
 * 암묵적으로 전제하고 있었는지를 코드로 적어 둔 것이다.**
 *
 * 36건은 프로필에 결정세액이 없는 채로 산출됐고, 그것은 "세액 한도가 절세액을 자르지
 * 않을 만큼 충분하다"는 전제 위에서만 성립한다. 계약 4.0.0이 그 값을 필수로 만들었으므로
 * 실행기가 어떤 값이든 넣어야 하는데, **아무 값이나 넣으면 전제가 다시 보이지 않는 곳으로
 * 숨는다.** 그래서 (a) 한도를 자르지 않는 값을 명시적으로 넣고, (b) 그것이 문서가 아니라
 * 실행기가 세운 전제임을 여기에 적는다.
 *
 * **기대값을 다시 세우는 것은 이 유닛의 일이 아니다.** 세액공제액이 0이 아닌 케이스의
 * 기대값 재산출과 한도 경계 케이스 추가는 `tax-domain`이 한다(tax-rules-report.md 13.11절).
 * 그때 블록이 `profile.prior_year_tax`를 직접 실으면 아래 기본값은 덮어써지고 이 함수는
 * 아무 일도 하지 않는다.
 *
 * 생년월일도 같다. 블록은 `age_years`로 나이를 적었고 계약은 이제 생년월일을 받는다.
 * 나이를 생년월일로 되옮기는 것은 이 실행기가 하며, 기준일은 엔진이 정한다.
 */
export function fillContractDefaults(raw, taxYear) {
  const profile = { ...raw.profile };
  const accounts = { ...raw.accounts };

  if (profile.birth_date === undefined && typeof profile.age_years === 'number') {
    profile.birth_date = `${taxYear - profile.age_years}-03-02`;
  }
  delete profile.age_years;

  if (profile.prior_year_tax === undefined) {
    profile.prior_year_tax = {
      state: 'amount',
      // 어떤 케이스의 공제액보다도 큰 값. 한도가 걸리지 않는 상태를 뜻한다.
      determined_tax_krw: 100_000_000,
      pension_credit_applied_krw: 0,
    };
  }

  for (const key of ['annuity_savings', 'retirement_pension']) {
    if (accounts[key] === undefined) continue;
    accounts[key] = {
      annuity_start_status: 'not_started',
      ...accounts[key],
    };
  }

  return { ...raw, profile, accounts };
}

/** 블록의 `request`를 compute()에 넘길 요청으로 만든다. */
export function buildRequest(parsed) {
  const taxYear = parsed.request.tax_year ?? 2026;
  return {
    schema_version: SCHEMA_VERSION,
    tax_year: taxYear,
    ...fillContractDefaults(parsed.request, taxYear),
  };
}

// ── 대조 ─────────────────────────────────────────────────────────────────────
//
// 실패 메시지에는 **케이스 ID · 시나리오 · 배분안 · 항목**이 전부 나와야 한다.
// 라벨을 위에서 아래로 이어 붙여 그것을 보장한다.

function planOf(scenario, planId, label) {
  const plan = scenario.plans.find((p) => p.plan_id === planId);
  assert.ok(plan, `${label}: 배분안 "${planId}"이 응답에 없다 (있는 것: ${scenario.plans.map((p) => p.plan_id).join(', ')})`);
  return plan;
}

function allocationOf(plan, account) {
  return plan.allocations.find((a) => a.account === account);
}

function limitValue(scenario, key) {
  const byAccount = (account) => scenario.limits.by_account.find((l) => l.account === account);
  switch (key) {
    case 'annuity_savings_credit_remaining_krw':
      return byAccount('annuity_savings').credit_eligible_limit_remaining_krw;
    case 'isa_contribution_remaining_krw':
      return byAccount('isa').contribution_limit_remaining_krw;
    case 'isa_tax_free_limit_krw':
      return byAccount('isa').tax_free_limit_krw;
    case 'isa_transfer_extra_credit_limit_krw':
      return scenario.isa_transfer_extra_limit === null
        ? null
        : scenario.isa_transfer_extra_limit.extra_credit_limit_krw;
    default:
      return scenario.limits[key];
  }
}

/** 배분안 단위 세액 한도. **적힌 키는 하나도 건너뛰지 않는다.** */
function checkPlanTaxCap(plan, expected, label) {
  const actual = plan.deterministic_benefit.tax_liability_cap;
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${label} 세액 한도(${key})`);
  }
}

function checkPlan(plan, expected, label) {
  for (const account of ACCOUNTS) {
    assert.equal(
      allocationOf(plan, account).annual_krw,
      expected.allocation[account],
      `${label} 배분(${account})`,
    );
  }
  if (expected.monthly_krw) {
    for (const [account, amount] of Object.entries(expected.monthly_krw)) {
      assert.equal(allocationOf(plan, account).monthly_krw, amount, `${label} 월 배분(${account})`);
    }
  }

  const benefit = plan.deterministic_benefit;
  assert.deepStrictEqual(
    {
      income_tax: benefit.pension_credit_income_tax_krw,
      local_tax: benefit.pension_credit_local_tax_krw,
      total: benefit.pension_credit_total_krw,
    },
    expected.tax_credit,
    `${label} 세액공제(한도 적용 후)`,
  );
  if (expected.tax_credit_before_cap) {
    assert.deepStrictEqual(
      {
        income_tax: benefit.pension_credit_income_tax_before_cap_krw,
        local_tax: benefit.pension_credit_local_tax_before_cap_krw,
        total: benefit.pension_credit_total_before_cap_krw,
      },
      expected.tax_credit_before_cap,
      `${label} 세액공제(자르기 전)`,
    );
  }
  if (expected.tax_liability_cap) {
    checkPlanTaxCap(plan, expected.tax_liability_cap, label);
  }

  assert.equal(plan.warnings.length, expected.warning_count, `${label} 경고 건수`);
  if (expected.warning_codes) {
    assert.deepStrictEqual(
      [...new Set(plan.warnings.map((w) => w.code))].sort(),
      [...expected.warning_codes].sort(),
      `${label} 경고 코드`,
    );
  }
  if (expected.limited_by) {
    for (const [account, value] of Object.entries(expected.limited_by)) {
      assert.equal(allocationOf(plan, account).limited_by, value, `${label} limited_by(${account})`);
    }
  }
  if (expected.fill_order) {
    for (const [account, value] of Object.entries(expected.fill_order)) {
      assert.equal(allocationOf(plan, account).fill_order, value, `${label} 충당 순서(${account})`);
    }
  }
  if ('unallocated_krw' in expected) {
    assert.equal(plan.unallocated_annual_krw, expected.unallocated_krw, `${label} 미배분`);
  }
  if ('monthly_rounding_residual_krw' in expected) {
    assert.equal(
      plan.monthly_rounding_residual_krw,
      expected.monthly_rounding_residual_krw,
      `${label} 월 반올림 잔차`,
    );
  }
  if ('delta_vs_baseline_krw' in expected) {
    assert.equal(plan.delta_vs_baseline_krw, expected.delta_vs_baseline_krw, `${label} 기본안 대비 차이`);
  }
  if ('credit_eligible_krw' in expected) {
    assert.equal(benefit.credit_eligible_contribution_krw, expected.credit_eligible_krw, `${label} 인정액`);
  }
  if ('tie_break' in expected) {
    assert.equal(plan.priority_basis.tie_break.code, expected.tie_break, `${label} 동점 처리`);
  }
  if ('objective_degenerate' in expected) {
    assert.equal(
      plan.priority_basis.objective_degenerate,
      expected.objective_degenerate,
      `${label} 목적함수 무력화 여부`,
    );
  }
  if ('is_baseline' in expected) {
    assert.equal(plan.is_baseline, expected.is_baseline, `${label} 기본안 여부`);
  }
}

/** 연금계좌별 개시 가능 시점. **적힌 키는 하나도 건너뛰지 않는다.** */
function checkPensionStart(scenario, expected, label) {
  for (const [account, entry] of Object.entries(expected)) {
    const actual = scenario.pension_withdrawal_start.find((e) => e.account === account);
    assert.ok(
      actual,
      `${label} 개시 가능 시점: 계좌 "${account}"가 응답에 없다 (있는 것: ${scenario.pension_withdrawal_start.map((e) => e.account).join(', ')})`,
    );
    for (const [key, value] of Object.entries(entry)) {
      assert.equal(actual[key], value, `${label} 개시 가능 시점(${account}.${key})`);
    }
  }
}

function checkScenario(scenario, expected, label) {
  if ('plan_count' in expected) {
    assert.equal(
      scenario.plans.length,
      expected.plan_count,
      `${label} 배분안 수 (나온 것: ${scenario.plans.map((p) => p.plan_id).join(', ')})`,
    );
  }
  if ('baseline_plan' in expected) {
    assert.equal(scenario.plans.find((p) => p.is_baseline).plan_id, expected.baseline_plan, `${label} 기본안`);
  }

  const isa = scenario.account_eligibility.find((e) => e.account === 'isa');
  if ('isa_eligible' in expected) assert.equal(isa.eligible, expected.isa_eligible, `${label} ISA 자격`);
  if (expected.isa_reason_codes) {
    assert.deepStrictEqual([...isa.reason_codes].sort(), [...expected.isa_reason_codes].sort(), `${label} ISA 자격 사유`);
  }

  for (const [key, value] of Object.entries(expected.limits ?? {})) {
    assert.equal(limitValue(scenario, key), value, `${label} 한도(${key})`);
  }
  for (const [key, value] of Object.entries(expected.boundaries ?? {})) {
    assert.equal(scenario.fund_use_horizon_boundaries[key], value, `${label} 경계값(${key})`);
  }
  if (expected.pension_withdrawal_start) {
    checkPensionStart(scenario, expected.pension_withdrawal_start, label);
  }

  const notices = scenario.notices.map((n) => n.code);
  for (const code of expected.notice_codes ?? []) {
    assert.ok(notices.includes(code), `${label} 안내 "${code}"가 나와야 한다 (나온 것: ${notices.join(', ')})`);
  }
  for (const code of expected.notice_codes_absent ?? []) {
    assert.equal(notices.includes(code), false, `${label} 안내 "${code}"는 나오면 안 된다`);
  }
  for (const code of expected.comparison_note_codes ?? []) {
    assert.ok(
      scenario.comparison_note_codes.includes(code),
      `${label} 비교 안내 "${code}"가 나와야 한다 (나온 것: ${scenario.comparison_note_codes.join(', ')})`,
    );
  }
  for (const code of expected.comparison_note_codes_absent ?? []) {
    assert.equal(
      scenario.comparison_note_codes.includes(code),
      false,
      `${label} 비교 안내 "${code}"는 나오면 안 된다`,
    );
  }

  for (const [planId, plan] of Object.entries(expected.plans)) {
    checkPlan(planOf(scenario, planId, label), plan, `${label} [${planId}]`);
  }
}

/** 블록 하나를 응답과 대조한다. 실패하면 AssertionError를 던진다. */
export function checkCase(parsed, response) {
  const caseId = parsed.case;
  assert.ok(response.ok, `${caseId}: 계산이 실패했다 — ${JSON.stringify(response.errors)}`);

  if (parsed.credit_rate) {
    const bracket = response.echo.credit_rate_bracket;
    for (const [key, value] of Object.entries(parsed.credit_rate)) {
      assert.equal(bracket[`${key}_rate`], value, `${caseId} 공제율(${key})`);
    }
  }

  for (const [scenarioId, expectation] of Object.entries(parsed.expect)) {
    const scenario = response.scenarios.find((s) => s.scenario_id === scenarioId);
    assert.ok(
      scenario,
      `${caseId}: 시나리오 "${scenarioId}"가 응답에 없다 — request.scenarios에 넣었는지 본다`,
    );
    checkScenario(scenario, expectation, `${caseId}/${scenarioId}`);
  }
}
