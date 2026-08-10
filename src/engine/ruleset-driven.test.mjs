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
