// 골든 케이스 전건 실행기.
//
// `docs/stage-4-verification/golden-cases.md` 안의 ```golden 펜스 블록을 읽어
// 케이스마다 compute()를 돌리고 대조한다.
//
// **이 파일에는 기대값이 한 개도 없다.** 값은 전부 그 문서에서 온다.
// 기대값의 저자는 `tax-domain`이고, 엔진 코드를 보지 않고 세법·룰셋에서 산출한다.
// 값을 이 파일로 옮겨 적는 순간 "옮기는 김에 엔진이 내놓은 값을 적는" 여지가 생기므로
// 옮겨 적을 자리 자체를 두지 않았다. `golden-regression.test.mjs` 머리말이 주석으로
// 부탁하던 것("엔진에 맞춰 고치지 않는다")을 이 구조가 대신 강제한다.
//
// 세 가지가 실패 사유다.
//   1. 대조 불일치 — 어느 케이스가 깨졌는지 이름이 나온다.
//   2. **커버리지** — 문서에 `GC-XX`로 등장하는데 블록이 없으면 실패한다.
//      이 검사가 이 장치의 핵심이다. 없으면 다음에 케이스를 추가한 사람이
//      블록을 빠뜨려도 아무도 모르고 골든 케이스는 다시 문서로만 남는다.
//   3. **파싱·형식 오류** — 블록이 있는데 읽히지 않으면 조용히 건너뛰지 않고 실패한다.
//      조용히 건너뛰면 커버리지 검사가 통과하면서 케이스는 안 돌아가는,
//      가장 나쁜 상태가 된다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compute } from './index.mjs';
import { ACCOUNT_ORDER, PLAN_ORDER, SCENARIO_ORDER, SCHEMA_VERSION } from './constants.mjs';
import { loadRulesets } from './test-helpers.mjs';

const DOC_RELATIVE = 'docs/stage-4-verification/golden-cases.md';
const DOC_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', ...DOC_RELATIVE.split('/'));

const rulesets = loadRulesets();
const markdown = readFileSync(DOC_PATH, 'utf8');

// ── 블록 형식 ────────────────────────────────────────────────────────────────
//
// 허용 키를 전부 열거한다. 오타 난 키를 조용히 무시하면 그 항목은 검사되지 않는데도
// 검사된 것처럼 보인다 — 지금 문제와 같은 형태의 침묵이다.

const ACCOUNTS = [...ACCOUNT_ORDER];
const CASE_KEYS = ['case', 'request', 'credit_rate', 'expect'];
const CREDIT_RATE_KEYS = ['income_tax', 'local_tax', 'effective'];
const SCENARIO_KEYS = [
  'plans',
  'plan_count',
  'baseline_plan',
  'isa_eligible',
  'isa_reason_codes',
  'limits',
  'boundaries',
  'notice_codes',
  'notice_codes_absent',
  'comparison_note_codes',
  'comparison_note_codes_absent',
];
const PLAN_KEYS = [
  'allocation',
  'tax_credit',
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
  'is_baseline',
];
const TAX_CREDIT_KEYS = ['income_tax', 'local_tax', 'total'];
const LIMIT_KEYS = [
  'pension_combined_credit_limit_krw',
  'pension_combined_credit_remaining_krw',
  'pension_contribution_limit_remaining_krw',
  'annuity_savings_credit_remaining_krw',
  'isa_contribution_remaining_krw',
  'isa_tax_free_limit_krw',
  'isa_transfer_extra_credit_limit_krw',
];
const BOUNDARY_KEYS = [
  'isa_lock_in_years',
  'isa_lock_in_years_remaining',
  'pension_min_age_years',
  'pension_years_remaining',
  'pension_holding_period_evaluated',
];

const CASE_ID = /^GC-\d{2}[a-z]?(-oracle)?$/;

// ── 문서 파싱 ────────────────────────────────────────────────────────────────

/** ```golden 펜스 블록을 본문에서 떼어낸다. 줄 번호는 오류 메시지용이다. */
function extractBlocks(text) {
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
function caseIdsIn(text) {
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

function requireInt(value, where, errors) {
  if (!Number.isInteger(value)) errors.push(`${where}: 정수여야 한다 (받은 값: ${JSON.stringify(value)})`);
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
  if ('tax_credit' in plan) {
    validateAmountMap(plan.tax_credit, `${where}.tax_credit`, TAX_CREDIT_KEYS, errors, { exact: true });
    const { income_tax: income, local_tax: local, total } = plan.tax_credit;
    if ([income, local, total].every(Number.isInteger) && income + local !== total) {
      errors.push(
        `${where}.tax_credit: 소득세 ${income} + 지방세 ${local} ≠ 합계 ${total} — 옮겨 적으면서 어긋났다`,
      );
    }
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
  if ('limits' in expectation && requireObject(expectation.limits, `${where}.limits`, errors)) {
    unknownKeys(expectation.limits, LIMIT_KEYS, `${where}.limits`, errors);
  }
  if ('boundaries' in expectation && requireObject(expectation.boundaries, `${where}.boundaries`, errors)) {
    unknownKeys(expectation.boundaries, BOUNDARY_KEYS, `${where}.boundaries`, errors);
  }
}

function validateBlock(parsed, where) {
  const errors = [];
  if (!requireObject(parsed, where, errors)) return errors;

  unknownKeys(parsed, CASE_KEYS, where, errors);

  if (typeof parsed.case !== 'string' || !CASE_ID.test(parsed.case)) {
    errors.push(`${where}: "case"가 GC-XX 형태의 케이스 ID여야 한다 (받은 값: ${JSON.stringify(parsed.case)})`);
  }
  if (!isPlainObject(parsed.request)) {
    errors.push(`${where}: "request"가 없다 — compute()에 그대로 넘길 요청이다`);
  }
  if ('credit_rate' in parsed && requireObject(parsed.credit_rate, `${where}.credit_rate`, errors)) {
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

// ── 읽기 ─────────────────────────────────────────────────────────────────────

const { blocks, prose } = extractBlocks(markdown);
const { ids: declaredIds, problems: rangeProblems } = caseIdsIn(prose);

/** @type {Map<string, {parsed: object, line: number}>} */
const cases = new Map();
/** @type {string[]} */
const blockProblems = [...rangeProblems];

for (const { body, line } of blocks) {
  const where = `${DOC_RELATIVE}:${line}`;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    blockProblems.push(`${where}: JSON을 읽을 수 없다 — ${error.message}`);
    continue;
  }

  const errors = validateBlock(parsed, where);
  if (errors.length > 0) {
    blockProblems.push(...errors);
    continue;
  }
  if (cases.has(parsed.case)) {
    blockProblems.push(`${where}: ${parsed.case}의 블록이 두 개다 (앞선 블록 ${DOC_RELATIVE}:${cases.get(parsed.case).line})`);
    continue;
  }
  cases.set(parsed.case, { parsed, line });
}

// ── 검사 1. 블록이 있는데 읽히지 않는 경우 ───────────────────────────────────

test('골든 케이스 블록이 전부 형식에 맞는다', () => {
  assert.deepStrictEqual(
    blockProblems,
    [],
    `읽을 수 없는 블록이 ${blockProblems.length}건이다. 조용히 건너뛰면 커버리지 검사가 통과하면서 ` +
      `케이스는 돌지 않는다.\n${blockProblems.map((p) => `  - ${p}`).join('\n')}`,
  );
});

// ── 검사 2. 커버리지 ─────────────────────────────────────────────────────────
//
// 이 검사가 장치의 핵심이다. 문서가 이름을 대는 케이스는 전부 블록을 가져야 한다.

test('문서의 모든 골든 케이스에 기계가 읽는 블록이 있다', () => {
  const missing = [...declaredIds].filter((id) => !cases.has(id)).sort();
  const orphan = [...cases.keys()].filter((id) => !declaredIds.has(id)).sort();

  const report = [];
  if (missing.length > 0) {
    report.push(
      `${DOC_RELATIVE}에 있으나 \`\`\`golden 블록이 없는 케이스 ${missing.length}건 ` +
        `(전체 ${declaredIds.size}건 중 ${cases.size}건만 채워졌다):`,
      ...missing.map((id) => `  - ${id}`),
      '',
      '이 케이스들은 문서일 뿐 테스트가 아니다. 기대값의 저자는 `tax-domain`이며,',
      '각 케이스 절 끝에 ```golden 펜스 블록을 하나씩 넣어 채운다(형식은 문서 1-A절).',
    );
  }
  if (orphan.length > 0) {
    report.push(
      `문서 산문에 등장하지 않는 케이스의 블록 ${orphan.length}건:`,
      ...orphan.map((id) => `  - ${id}`),
    );
  }

  assert.equal(report.length, 0, report.join('\n'));
});

// ── 검사 3. 전건 대조 ────────────────────────────────────────────────────────

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
    `${label} 세액공제`,
  );

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
  if ('is_baseline' in expected) {
    assert.equal(plan.is_baseline, expected.is_baseline, `${label} 기본안 여부`);
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

for (const [caseId, { parsed, line }] of cases) {
  test(`골든 케이스 ${caseId} (${DOC_RELATIVE}:${line})`, () => {
    const request = { schema_version: SCHEMA_VERSION, tax_year: 2026, ...parsed.request };
    const response = compute(request, rulesets);

    assert.ok(
      response.ok,
      `${caseId}: 계산이 실패했다 — ${JSON.stringify(response.errors)}`,
    );

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
  });
}
