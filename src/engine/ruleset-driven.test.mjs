// 필수 테스트 5 — 룰셋을 바꾸면 결과가 따라 바뀐다.
// 수치가 코드가 아니라 데이터에서 온다는 것의 실증이다.
// 원본 파일은 건드리지 않는다. 전부 사본 위에서만 바꾼다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute, computeFundUseHorizonBoundaries, SCHEMA_VERSION } from './index.mjs';
import {
  loadRulesets,
  cloneRulesets,
  findRule,
  baseRequest,
  scenarioOf,
  planOf,
  allocationOf,
  CONFIRMED_FILE,
  birthDateForAge,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

const BIG_BUDGET = { profile: { monthly_capacity_krw: 5_000_000 } };

// 동점 구간에서는 최대공제안이 연금저축을 먼저 채우므로 두 안의 배분 벡터가 같아져
// 하나로 합쳐진다. 연금저축 우선안 자체를 보려면 명시적으로 요청한다.
const ANNUITY_FIRST_ONLY = {
  ...BIG_BUDGET,
  options: { plan_variants: ['annuity_savings_first'] },
};

test('연금저축 단독 한도를 바꾸면 연금저축 우선안의 배분이 따라 바뀐다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'pension.credit.limit.annuity_savings');
  const combined = findRule(patched, CONFIRMED_FILE, 'pension.credit.limit.combined').value.amount_krw;
  const halved = Math.floor(rule.value.amount_krw / 2);
  rule.value.amount_krw = halved;

  const beforeScenario = scenarioOf(compute(baseRequest(ANNUITY_FIRST_ONLY), rulesets));
  const afterScenario = scenarioOf(compute(baseRequest(ANNUITY_FIRST_ONLY), patched));
  const before = planOf(beforeScenario, 'annuity_savings_first');
  const after = planOf(afterScenario, 'annuity_savings_first');

  assert.notEqual(
    allocationOf(after, 'annuity_savings').annual_krw,
    allocationOf(before, 'annuity_savings').annual_krw,
  );

  // **D32로 관측 지점이 바뀌었다.** 예전에는 이 안이 단독 한도에서 멈춰 배분액이 곧
  // 그 한도였다. 지금은 납입 한도까지 가므로 단독 한도가 정하는 것은 **연금저축의
  // 총 배분액이 아니라 두 계좌의 쪼개기**다 — IRP가 받는 몫이 정확히
  // `합산한도 − 단독한도`이고, 나머지를 연금저축이 가져간다(D30의 경계).
  const pool = afterScenario.limits.pension_contribution_limit_remaining_krw;
  assert.equal(
    allocationOf(after, 'retirement_pension').annual_krw,
    combined - halved,
    'IRP는 연금저축이 단독 한도 때문에 흡수하지 못하는 몫만 받는다',
  );
  assert.equal(allocationOf(after, 'annuity_savings').annual_krw, pool - (combined - halved));
});

test('합산 공제한도를 바꾸면 세액공제 대상액이 따라 바뀐다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'pension.credit.limit.combined');
  rule.value.amount_krw = Math.floor(rule.value.amount_krw / 2);

  const before = planOf(scenarioOf(compute(baseRequest(BIG_BUDGET), rulesets)), 'max_tax_credit');
  const after = planOf(scenarioOf(compute(baseRequest(BIG_BUDGET), patched)), 'max_tax_credit');

  assert.equal(
    after.deterministic_benefit.credit_eligible_contribution_krw,
    rule.value.amount_krw,
  );
  assert.ok(
    after.deterministic_benefit.credit_eligible_contribution_krw <
      before.deterministic_benefit.credit_eligible_contribution_krw,
  );
});

test('공제율을 바꾸면 절세액이 따라 바뀐다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'pension.credit.rate');
  rule.value.brackets[0].rate = 0.5;
  rule.value.brackets[rule.value.brackets.length - 1].rate = 0.5;

  const response = compute(baseRequest(BIG_BUDGET), patched);
  assert.equal(response.echo.credit_rate_bracket.income_tax_rate, 0.5);

  const before = planOf(scenarioOf(compute(baseRequest(BIG_BUDGET), rulesets)), 'max_tax_credit');
  const after = planOf(scenarioOf(response), 'max_tax_credit');
  assert.ok(
    after.deterministic_benefit.pension_credit_income_tax_krw >
      before.deterministic_benefit.pension_credit_income_tax_krw,
  );
});

test('공제율 구간 경계를 바꾸면 같은 소득의 판정이 뒤집힌다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'pension.credit.rate');
  const salary = 50_000_000;
  rule.value.brackets[0].total_salary_only_max_krw = salary - 1;

  const before = compute(
    baseRequest({ profile: { current_year_total_salary_krw: salary } }),
    rulesets,
  );
  const after = compute(
    baseRequest({ profile: { current_year_total_salary_krw: salary } }),
    patched,
  );

  assert.notEqual(
    after.echo.credit_rate_bracket.income_tax_rate,
    before.echo.credit_rate_bracket.income_tax_rate,
  );
});

test('지방소득세 부가율을 바꾸면 실효 절세액이 따라 바뀐다 — 실효율 상수가 없다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'tax.local.personal_income_surtax');
  rule.value.rate_of_income_tax = 0.5;

  const plan = planOf(scenarioOf(compute(baseRequest(BIG_BUDGET), patched)), 'max_tax_credit');
  const benefit = plan.deterministic_benefit;

  assert.equal(
    benefit.pension_credit_local_tax_krw,
    Math.floor(benefit.pension_credit_income_tax_krw / 2),
  );
});

test('ISA 연간 한도 산식의 경과연수 상한을 바꾸면 결과가 따라 바뀐다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'isa.contribution.annual_limit');
  rule.value.formula = rule.value.formula.replace(/,\s*4\)/, ', 1)');

  const request = baseRequest({ accounts: { isa: { years_since_opening: 3 } } });
  const isaOf = (bundle) =>
    scenarioOf(compute(request, bundle)).limits.by_account.find((l) => l.account === 'isa');

  assert.ok(isaOf(patched).contribution_limit_remaining_krw < isaOf(rulesets).contribution_limit_remaining_krw);
});

test('ISA 의무가입기간과 연금 개시 연령을 바꾸면 경계값이 따라 바뀐다', () => {
  const patched = cloneRulesets(rulesets);
  findRule(patched, CONFIRMED_FILE, 'isa.account.requirements').value.min_contract_years = 7;
  findRule(patched, CONFIRMED_FILE, 'pension.withdrawal.eligibility').value.requirements.find(
    (r) => r.id === 'age',
  ).min_age = 60;

  const response = computeFundUseHorizonBoundaries(
    { schema_version: SCHEMA_VERSION, tax_year: 2026, birth_date: birthDateForAge(40), isa_exists: true, isa_years_since_opening: 1 },
    patched,
  );

  assert.equal(response.boundaries.isa_lock_in_years, 7);
  assert.equal(response.boundaries.isa_lock_in_years_remaining, 6);
  assert.equal(response.boundaries.pension_min_age_years, 60);
  assert.equal(response.boundaries.pension_years_remaining, 20);
});

test('필요한 규칙이 없으면 대체값을 만들지 않고 중단한다', () => {
  const patched = cloneRulesets(rulesets);
  patched[CONFIRMED_FILE].rules = patched[CONFIRMED_FILE].rules.filter(
    (r) => r.id !== 'pension.credit.limit.combined',
  );

  const response = compute(baseRequest(), patched);
  assert.equal(response.ok, false);
  const missing = response.errors.filter((e) => e.code === 'rule_missing');
  assert.equal(missing.length > 0, true);
  assert.equal(missing[0].params.rule_id, 'pension.credit.limit.combined');
});

test('규칙은 있으나 필요한 값을 읽을 수 없으면 그것도 중단 사유다', () => {
  const patched = cloneRulesets(rulesets);
  delete findRule(patched, CONFIRMED_FILE, 'isa.contribution.annual_limit').value.formula;

  const response = compute(baseRequest(), patched);
  assert.equal(response.ok, false);
  assert.ok(response.errors.some((e) => e.code === 'rule_missing'));
});

test('룰셋 파일이 없으면 ruleset_load_failed로 끝난다', () => {
  const response = compute(baseRequest({ tax_year: 1999 }), rulesets);
  assert.equal(response.ok, false);
  assert.ok(response.errors.some((e) => e.code === 'ruleset_load_failed'));
});

test('법령 조항은 룰셋 문자열 그대로 실린다', () => {
  const scenario = scenarioOf(compute(baseRequest(BIG_BUDGET), rulesets));

  for (const entry of scenario.legal_basis) {
    const source = rulesets[CONFIRMED_FILE].rules.find((r) => r.id === entry.rule_id);
    assert.ok(source, `근거에 실린 규칙이 룰셋에 없다: ${entry.rule_id}`);
    assert.equal(entry.law, source.source.law, '한 글자도 바꾸지 않는다');
    assert.equal(entry.title, source.title);
    assert.equal(entry.url, source.source.url);
    assert.equal(entry.verified_on, source.source.verified_on);
  }
});

// ── 소득 성격 열거형이 룰셋과 어긋나지 않는가 (D29) ──────────────────────────
//
// **계약이 고정하는 것은 문자열이고, 각 값이 뜻하는 과세 비율은 룰셋이 정한다.** 두 목록이
// 갈라지면 사용자가 고를 수 있는 선택지와 엔진이 비율을 찾을 수 있는 선택지가 달라져,
// 어떤 값은 언제나 `rule_missing`으로 끝난다. 그 상태는 조용하다 — 계약도 룰셋도 각자
// 옳아 보이고 어긋난 것은 둘 사이뿐이다.
test('계약의 소득 성격 목록이 룰셋의 선택지와 정확히 같다', async () => {
  const { ISA_INCOME_CHARACTERS } = await import('./constants.mjs');
  const options = findRule(rulesets, CONFIRMED_FILE, 'isa.benefit.income_character').value
    .what_to_ask_instead.options;

  assert.deepStrictEqual(
    [...ISA_INCOME_CHARACTERS].sort(),
    options.map((option) => option.id).sort(),
    '계약의 열거형과 룰셋 `isa.benefit.income_character`의 선택지 id가 갈라졌다',
  );
});

// **분기 코드도 같은 형태다** (D39·D40, 계약 8.7절이 정의 자리를 룰셋으로 지정했다).
// 계약과 엔진이 고정하는 것은 문자열 셋이고, 그 문자열의 정의 자리는 룰셋의 `branches`
// 키다. 갈라지면 엔진이 없는 분기를 찾다 `rule_missing`으로 끝나거나 — 더 나쁘게 —
// 룰셋이 분기를 하나 늘렸는데 엔진이 그것을 영영 고르지 않는 상태가 된다. **그 상태는
// 조용하다:** 계약도 룰셋도 각자 옳아 보이고 어긋난 것은 둘 사이뿐이다.
test('계약의 세액 한도 분기 목록이 룰셋의 분기 키와 정확히 같다', async () => {
  const { CAP_BRANCHES } = await import('./constants.mjs');
  const branches = findRule(
    rulesets,
    CONFIRMED_FILE,
    'pension.credit.tax_liability_cap.current_year_estimate',
  ).value.branches;

  assert.deepStrictEqual(
    [...CAP_BRANCHES].sort(),
    Object.keys(branches).sort(),
    '계약의 분기 열거형과 룰셋 `...current_year_estimate.branches`의 키가 갈라졌다',
  );
});

// **오차 방향 코드의 정의 자리는 룰셋이다 — 이제 두 값 모두 그렇다** (D41 1번·D42 5절 (나)).
// 엔진이 이 문자열을 코드에 적으면 룰셋이 방향을 바꿔도 응답이 따라가지 않는다 —
// `fault-injection.test.mjs`가 그 방향을 실제로 뒤집어 확인하고, 여기서는 **엔진 상수에
// 그 문자열이 아예 없다**는 것을 본다.
//
// **미정 쪽이 이번에 옮겨 왔다.** 전에는 룰셋이 그 분기의 방향을 산문으로만 적어 두어
// 계약이 문자열을 정하고 엔진 상수가 그것을 들고 있었다. 룰셋이 `direction_code` 칸과
// `code_definition_sites`를 두면서 그 근거가 사라졌다.
test('오차 방향 코드 두 값 모두 엔진 상수에 없다 — 룰셋에서만 온다', async () => {
  const constants = await import('./constants.mjs');
  const rule = findRule(
    rulesets,
    CONFIRMED_FILE,
    'pension.credit.tax_liability_cap.current_year_estimate',
  ).value;

  const values = Object.values(constants)
    .flatMap((value) => (typeof value === 'object' && value !== null ? Object.values(value) : [value]))
    .filter((value) => typeof value === 'string');

  const allowed = rule.branches_reading_rule.allowed_direction_codes;
  assert.ok(allowed.includes(rule.error_direction.code), '상한 코드가 허용 목록에 없다');
  assert.ok(
    allowed.includes(rule.branches.global_income_amount_missing.direction_code),
    '미정 분기의 코드가 허용 목록에 없다',
  );

  for (const code of allowed) {
    assert.equal(
      values.includes(code),
      false,
      `엔진 상수에 "${code}"가 적혀 있다 — 룰셋이 방향을 바꿔도 응답이 따라가지 않는다`,
    );
  }
});

// **엔진이 읽는 칸의 이름도 룰셋이 정한다.** 룰셋이 `engine_must_not_read`로 산문 칸을
// 명시로 금지했다. 그 금지가 코드에서 실제로 지켜지는지를 파일 내용으로 본다 —
// 주입 시험은 "지금 결과가 같다"를 보고, 이 시험은 "그 칸을 읽는 문장이 없다"를 본다.
test('세액 한도 계산이 룰셋의 산문 칸을 읽지 않는다 — 금지가 파일에서 지켜진다', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const rule = findRule(
    rulesets,
    CONFIRMED_FILE,
    'pension.credit.tax_liability_cap.current_year_estimate',
  ).value;
  const forbidden = rule.branches_reading_rule.engine_must_not_read;
  const required = rule.branches_reading_rule.engine_reads;

  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'liability-cap.mjs'), 'utf8');
  // 주석에는 그 이름이 나온다(왜 읽지 않는지를 적고 있다). 코드에서 값을 꺼내는 형태만 본다.
  const reads = (name) =>
    new RegExp(`(\\.${name}\\b|['"\`]${name}['"\`])`).test(
      source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''),
    );

  assert.equal(reads(forbidden), false, `liability-cap.mjs가 금지된 칸 "${forbidden}"을 읽고 있다`);
  assert.equal(reads(required), true, `liability-cap.mjs가 읽어야 할 칸 "${required}"을 읽지 않는다`);
});

// **같은 검사를 새 파일에도 건다** (D44). 지난 회차의 결함이 「산문 칸을 읽는다」였고,
// 이번 회차에 같은 형태의 규칙이 둘 더 들어왔다. 주입 시험은 "지금 결과가 같다"를 보고
// 이 시험은 "그 칸을 읽는 문장이 파일에 없다"를 본다 — 뒤엣것이 없으면, 산문을 읽되
// 오늘의 룰셋에서는 우연히 같은 답이 나오는 구현이 통과한다.
test('사람 쪽 자격 판정이 룰셋의 산문 칸을 읽지 않는다 — 두 규칙 모두', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'statutory-eligibility.mjs'),
    'utf8',
  ).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // 주석에는 그 이름이 나온다(왜 읽지 않는지를 적고 있다). 코드에서 값을 꺼내는 형태만 본다.
  const reads = (name) => new RegExp(`(\\.${name}\\b|['"\`]${name}['"\`])`).test(source);

  for (const ruleId of ['irp.eligibility', 'pension.credit.taxpayer_eligibility']) {
    const rule = findRule(rulesets, CONFIRMED_FILE, ruleId).value.engine_evaluation;
    const forbidden = rule.engine_must_not_read;

    // **금지 칸의 이름을 먼저 붙잡는다.** `undefined`를 그대로 정규식에 넣으면 이 검사는
    // 통과하면서 아무것도 막지 못한다 — 이 저장소가 여러 번 겪은 형태다.
    assert.equal(typeof forbidden, 'string', `${ruleId}: 금지 칸의 이름을 읽지 못했다`);
    assert.ok(forbidden.length > 0, `${ruleId}: 금지 칸의 이름이 비어 있다`);
    assert.equal(reads(forbidden), false, `${ruleId}: 금지된 칸 "${forbidden}"을 읽고 있다`);

    // 읽어야 할 칸은 `branches[].outcome_code` 꼴로 적혀 있다. 마지막 마디가 칸 이름이다.
    assert.ok(Array.isArray(rule.engine_reads) && rule.engine_reads.length > 0, ruleId);
    for (const path of rule.engine_reads) {
      const field = String(path).split('.').pop();
      assert.equal(reads(field), true, `${ruleId}: 읽어야 할 칸 "${field}"을 읽지 않는다`);
    }
  }
});

// 결론 어휘의 정의 자리는 룰셋이고 엔진 상수는 **전사**다. 두 목록이 갈라지면 엔진이
// 옛 뜻으로 계속 돌 수 있으므로, 갈라지는 순간 여기서 먼저 걸린다(런타임에서도 멈춘다).
test('IRP 결론 코드 목록이 룰셋과 엔진에서 같다 — 전사가 낡으면 여기서 걸린다', async () => {
  const { IRP_OUTCOMES, CREDIT_ELIGIBILITY_OUTCOME, NOTICE, EVALUATION_ORDER_FIRST_MATCH } =
    await import('./constants.mjs');

  const irp = findRule(rulesets, CONFIRMED_FILE, 'irp.eligibility').value.engine_evaluation;
  assert.deepStrictEqual([...irp.allowed_outcome_codes].sort(), [...IRP_OUTCOMES].sort());
  assert.equal(irp.evaluation_order, EVALUATION_ORDER_FIRST_MATCH);
  // 코드 **이름**의 정의 자리는 계약이고 룰셋은 요청만 한다(규칙의 `code_ownership_note`).
  assert.equal(irp.requested_reason_code, NOTICE.IRP_EXCLUDED_NO_QUALIFYING_STATUS);
  assert.equal(irp.requested_notice_code, NOTICE.IRP_ELIGIBILITY_NOT_DETERMINED);

  const credit = findRule(rulesets, CONFIRMED_FILE, 'pension.credit.taxpayer_eligibility').value
    .engine_evaluation;
  assert.deepStrictEqual(
    [...credit.allowed_outcome_codes].sort(),
    [CREDIT_ELIGIBILITY_OUTCOME.AVAILABLE, NOTICE.PENSION_CREDIT_ZERO_NO_GLOBAL_INCOME].sort(),
  );
  // 「0」인 결론이 어느 것인지를 룰셋이 스스로 가리킨다. 엔진은 그 대응을 따로 알지 않는다.
  assert.ok(credit.allowed_outcome_codes.includes(credit.requested_notice_code));
});
