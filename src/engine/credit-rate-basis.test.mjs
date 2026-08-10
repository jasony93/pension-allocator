// 공제율 판정 축 — D27이 결함으로 판정한 자리.
//
// 엔진이 공제율을 **총급여액만으로** 판정했다. 사업소득 등이 있어 종합소득금액이
// 우대 구간을 넘는 사람도 총급여가 낮으면 우대율을 받았고, 그 오차는 **과대**다 —
// 받을 수 없는 금액을 보고 인출이 어려운 계좌에 돈을 묶게 만든다.
//
// **환산으로 고치면 새 결함이 된다.** 소괄호의 총급여 기준은 환산 편의가 아니라
// 그 구간에서 **더 엄격한** 규정이다. 총급여를 근로소득금액으로 환산하면 5,500만원
// 바로 위 구간의 순수 근로소득자에게 우대율을 잘못 준다. 아래 마지막 테스트가
// 그 경계를 기계로 고정한다.
//
// **이 파일에는 세법 수치가 없다.** 경계값·비율은 전부 룰셋에서 읽는다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { CONFIRMED_FILE, baseRequest, errorCodes, loadRulesets, scenarioOf, planOf } from './test-helpers.mjs';

const rulesets = loadRulesets();
const CREDIT_RATE = rulesets[CONFIRMED_FILE].rules.find((r) => r.id === 'pension.credit.rate');
const BRACKETS = CREDIT_RATE.value.brackets;

/** 우대 구간(상한이 있는 쪽)과 본문 구간(상한이 없는 쪽). 이름이 아니라 구조로 고른다. */
const PREFERRED = BRACKETS.find(
  (b) => (b.global_income_max_krw ?? null) !== null || (b.total_salary_only_max_krw ?? null) !== null,
);
const DEFAULT_BRACKET = BRACKETS.find(
  (b) => (b.global_income_max_krw ?? null) === null && (b.total_salary_only_max_krw ?? null) === null,
);

const rateOf = (response) => response.echo.credit_rate_bracket.income_tax_rate;
const bracketOf = (response) => response.echo.credit_rate_bracket;

/** 공제 한도를 꽉 채우는 예산. 두 비율의 차이가 금액으로 드러나게 하기 위한 것이다. */
const FULL_BUDGET = { monthly_capacity_krw: 1_000_000 };

function run(profile) {
  const response = compute(baseRequest({ profile: { ...FULL_BUDGET, ...profile } }), rulesets);
  assert.equal(response.ok, true, JSON.stringify(response.errors));
  return response;
}

// ── 결함 자체 ────────────────────────────────────────────────────

test('총급여가 낮아도 종합소득금액이 우대 구간을 넘으면 우대율을 주지 않는다', () => {
  const salary = PREFERRED.total_salary_only_max_krw;
  const globalIncome = PREFERRED.global_income_max_krw + 1;

  const wageOnly = run({ current_year_total_salary_krw: salary });
  const withOther = run({
    current_year_total_salary_krw: salary,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: globalIncome,
  });

  assert.equal(rateOf(wageOnly), PREFERRED.rate, '근로소득만 있으면 총급여 기준 그대로다');
  assert.equal(rateOf(withOther), DEFAULT_BRACKET.rate, '합산되는 다른 소득이 있으면 본문 기준이다');

  // 결함이 금액으로 얼마였는지를 값으로 고정한다. 두 비율의 비만큼 갈린다.
  const creditOf = (response) =>
    planOf(scenarioOf(response), 'max_tax_credit').deterministic_benefit.pension_credit_total_krw;
  assert.ok(creditOf(wageOnly) > creditOf(withOther), '옛 동작은 과대였다');
  assert.equal(
    creditOf(withOther),
    Math.floor(creditOf(wageOnly) * (DEFAULT_BRACKET.rate / PREFERRED.rate)),
    '두 결과의 차이는 공제율의 차이 그대로여야 한다',
  );
});

test('종합소득금액이 경계값과 정확히 같으면 우대 구간에 든다 — 법문이 "이하"다', () => {
  const salary = PREFERRED.total_salary_only_max_krw;
  const atBoundary = run({
    current_year_total_salary_krw: salary,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: PREFERRED.global_income_max_krw,
  });
  const overBoundary = run({
    current_year_total_salary_krw: salary,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: PREFERRED.global_income_max_krw + 1,
  });

  assert.equal(rateOf(atBoundary), PREFERRED.rate);
  assert.equal(rateOf(overBoundary), DEFAULT_BRACKET.rate);
});

test('총급여 경계값은 "이하"이고, 1원 넘으면 본문 구간이다', () => {
  assert.equal(rateOf(run({ current_year_total_salary_krw: PREFERRED.total_salary_only_max_krw })), PREFERRED.rate);
  assert.equal(
    rateOf(run({ current_year_total_salary_krw: PREFERRED.total_salary_only_max_krw + 1 })),
    DEFAULT_BRACKET.rate,
  );
});

// ── 환산으로 고치면 안 된다는 것 ──────────────────────────────────

test('총급여 경계 바로 위의 순수 근로소득자에게 우대율을 주지 않는다 — 환산 금지', () => {
  // §47 ① 산식으로 환산하면 이 구간의 근로소득금액은 종합소득금액 경계 **아래**다.
  // 그래도 조문은 근로소득만 있는 사람을 총급여로 판정하므로 답은 본문 구간이다.
  // 환산해 고치면 여기서 우대율이 나오고, 그것이 새 결함이 된다.
  const justOver = run({ current_year_total_salary_krw: PREFERRED.total_salary_only_max_krw + 1 });

  assert.equal(bracketOf(justOver).basis_code, 'total_salary');
  assert.equal(rateOf(justOver), DEFAULT_BRACKET.rate);
  assert.equal(
    bracketOf(justOver).measured_amount_krw,
    PREFERRED.total_salary_only_max_krw + 1,
    '판정에 쓴 금액은 환산값이 아니라 총급여액 그 자체여야 한다',
  );
});

// ── 모를 때 ──────────────────────────────────────────────────────

test('금액을 모르면 본문 구간을 적용하고 그 사실과 오차 방향을 함께 낸다', () => {
  const unknown = run({
    current_year_total_salary_krw: PREFERRED.total_salary_only_max_krw,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: null,
  });

  assert.equal(rateOf(unknown), DEFAULT_BRACKET.rate, '예외의 요건이 확인되지 않으면 본문이다');
  assert.equal(bracketOf(unknown).basis_code, 'statutory_default');
  assert.equal(bracketOf(unknown).measured_amount_krw, null, '지어낸 금액을 되돌려주지 않는다');
  assert.equal(bracketOf(unknown).fallback_applied, true);
  assert.equal(bracketOf(unknown).fallback_direction_code, 'understated_or_equal');

  const scenario = scenarioOf(unknown);
  const notice = scenario.notices.find((n) => n.code === 'credit_rate_global_income_missing');
  assert.ok(notice, '화면이 말할 수 있으려면 그 사실이 값으로 나가야 한다');
  assert.equal(notice.severity, 'warning');
  assert.equal(notice.params.error_direction, 'understated_or_equal');
  assert.ok(notice.basis_rule_ids.includes('pension.credit.rate.basis_determination'));
});

test('모른다는 답이 총급여 기준으로 되돌아가지 않는다', () => {
  // 이 자리가 결함의 본체였다. "모르겠다"를 총급여 판정으로 접으면 결함이 그대로 남는다.
  const salary = PREFERRED.total_salary_only_max_krw;
  const unknown = run({
    current_year_total_salary_krw: salary,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: null,
  });
  assert.notEqual(rateOf(unknown), PREFERRED.rate);
});

// ── 계약 ─────────────────────────────────────────────────────────

test('1단계 답이 필수다 — 없으면 계산하지 않는다', () => {
  const request = baseRequest();
  delete request.profile.has_non_wage_global_income_current_year;
  const response = compute(request, rulesets);

  assert.equal(response.ok, false);
  assert.ok(
    response.errors.some(
      (e) => e.code === 'missing_required' && e.field === 'profile.has_non_wage_global_income_current_year',
    ),
  );
});

test('"없다"고 답하고 금액을 함께 실으면 오류다 — 엔진이 둘 중 하나를 고르지 않는다', () => {
  const codes = errorCodes(
    compute(
      baseRequest({
        profile: {
          has_non_wage_global_income_current_year: false,
          current_year_global_income_krw: 30_000_000,
        },
      }),
      rulesets,
    ),
  );
  assert.ok(codes.includes('invalid_enum'));
});

test('근로소득만 있는 사용자에게는 입력이 늘지 않는다 — 생략과 null이 같다', () => {
  const withNull = compute(
    baseRequest({ profile: { current_year_global_income_krw: null } }),
    rulesets,
  );
  const request = baseRequest();
  delete request.profile.current_year_global_income_krw;

  assert.deepStrictEqual(compute(request, rulesets), withNull);
});

test('좁혀 물은 1단계 질문이 채택한 해석이 가정으로 나간다', () => {
  // 규칙의 open_interpretation이 미확정으로 남긴 쟁점이다. 조문이 정한 것처럼
  // 표시하면 안 되므로 가정으로 드러내고 근거 규칙을 함께 단다.
  const wageOnly = run({ current_year_total_salary_krw: PREFERRED.total_salary_only_max_krw });
  const assumption = wageOnly.assumptions.find(
    (a) => a.code === 'credit_rate_wage_only_excludes_separately_taxed_income',
  );
  assert.ok(assumption);
  assert.ok(assumption.basis_rule_ids.includes('pension.credit.rate.basis_determination'));

  const withOther = run({
    current_year_total_salary_krw: PREFERRED.total_salary_only_max_krw,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: 10_000_000,
  });
  assert.equal(
    withOther.assumptions.some(
      (a) => a.code === 'credit_rate_wage_only_excludes_separately_taxed_income',
    ),
    false,
    '총급여 기준으로 가지 않은 사용자에게는 이 가정이 걸리지 않는다',
  );
});
