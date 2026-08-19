// **역산기의 어느 수도 코드에 있지 않다는 것을 두 방향으로 잠근다.**
//
//  ① **결함 주입** — 룰셋의 값을 바꾸면 응답이 **따라 움직인다.** 안 움직이면 그 수가
//     코드 어딘가에 박혀 있다는 뜻이다. 이것이 「하드코딩이 없다」의 유일한 실증이다.
//  ② **소스 훑기** — 역산 모듈의 소스에서 주석과 문자열을 걷어 내고 남은 숫자 낱말이
//     **세법과 무관한 것뿐**인지 본다. ①이 못 보는 자리(쓰이지 않는 상수)를 막는다.
//
// 룰셋 파일은 **고치지 않는다.** 사본을 만들어 그 사본을 주입한다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIRMED_FILE, PROPOSED_FILE, loadRulesets } from './test-helpers.mjs';
import { computePensionReverse } from './reverse.mjs';
import { loadReverseRules } from './reverse-rules.mjs';
import { ERROR, SCHEMA_VERSION } from './constants.mjs';

const RULESETS = loadRulesets();

/** 확정 룰셋의 규칙 하나를 바꾼 **사본**을 만든다. 원본은 건드리지 않는다. */
function mutate(ruleId, patch) {
  const copy = structuredClone(RULESETS);
  const rule = copy[CONFIRMED_FILE].rules.find((item) => item.id === ruleId);
  assert.ok(rule, `${ruleId}가 룰셋에 있어야 이 시험이 성립한다`);
  patch(rule);
  return copy;
}

function drop(ruleId) {
  const copy = structuredClone(RULESETS);
  copy[CONFIRMED_FILE].rules = copy[CONFIRMED_FILE].rules.filter((item) => item.id !== ruleId);
  return copy;
}

function request(patch = {}) {
  const base = {
    schema_version: SCHEMA_VERSION,
    tax_year: 2026,
    as_of_date: '2026-08-19',
    profile: {
      birth_date: '1980-05-10',
      target_monthly_income_krw: 2_000_000,
      annuity_start: { kind: 'age', age_years: 65 },
      payout_years: 20,
      average_annual_return_rate: 0.05,
      public_pension: { plan: 'unknown', expected_monthly_krw: null },
      other_income: { state: 'known', annual_krw: 0 },
      deferred_retirement: { present: true, amount_krw: 10_000_000 },
    },
    accounts: {
      annuity_savings: { balance_krw: 0 },
      retirement_pension: { balance_krw: 0 },
      isa: { balance_krw: 10_000_000, years_since_opening: 2, cumulative_contribution_krw: 10_000_000 },
    },
  };
  return {
    ...base,
    ...patch,
    profile: { ...base.profile, ...(patch.profile ?? {}) },
    accounts: { ...base.accounts, ...(patch.accounts ?? {}) },
  };
}

const baseline = () => computePensionReverse(request(), RULESETS);

// ── ① 결함 주입 ─────────────────────────────────────────────────────────

test('한도 산식의 계수를 바꾸면 필요 최소 평가액이 따라 움직인다', () => {
  const before = computePensionReverse(request({ profile: { payout_years: 5 } }), RULESETS);
  const rulesets = mutate('pension.withdrawal.annual_cap', (rule) => {
    rule.value.expression = '연금수령한도 = 연금계좌의 평가액 ÷ (11 − 연금수령연차) × 240/100';
  });
  const after = computePensionReverse(request({ profile: { payout_years: 5 } }), rulesets);

  assert.notEqual(
    before.statutory_facts.minimum_start_balance.annual_cap_floor_krw,
    after.statutory_facts.minimum_start_balance.annual_cap_floor_krw,
  );
  // 비율이 두 배가 되면 하한이 절반이 된다.
  assert.equal(
    after.statutory_facts.minimum_start_balance.first_year_floor_krw * 2,
    before.statutory_facts.minimum_start_balance.first_year_floor_krw,
  );
});

test('산식의 모양이 어긋나면 계산을 멈춘다 — 계수를 지어내지 않는다', () => {
  const rulesets = mutate('pension.withdrawal.annual_cap', (rule) => {
    rule.value.expression = '연금수령한도는 시행령이 정하는 바에 따른다';
  });
  const res = computePensionReverse(request(), rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === ERROR.RULE_MISSING));
});

test('산식과 룰셋이 스스로 적은 연차 표가 갈리면 어느 쪽이 조문인지 고르지 않는다', () => {
  const rulesets = mutate('pension.withdrawal.annual_cap', (rule) => {
    rule.value.derived_ratios.table.push({ 연금수령연차: 12, '평가액 대비 한도 비율': '가짜' });
  });
  const res = computePensionReverse(request(), rulesets);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === ERROR.RULE_MISSING));
});

test('규칙이 통째로 없으면 대체값을 만들지 않고 멈춘다', () => {
  for (const ruleId of [
    'pension.withdrawal.annual_cap',
    'pension.income.separate_taxation.threshold',
    'pension.income.deduction',
    'pension.income.withholding_rate.by_age',
    'pension.income.withholding_rate.deferred_retirement',
    'tax.local.personal_income_surtax',
    'pension.contribution.annual_limit',
  ]) {
    const res = computePensionReverse(request(), drop(ruleId));
    assert.equal(res.ok, false, `${ruleId}가 없으면 멈춰야 한다`);
    assert.ok(
      res.errors.some((e) => e.code === ERROR.RULE_MISSING || e.code === ERROR.RULESET_LOAD_FAILED),
      `${ruleId}: rule_missing이 나가야 한다`,
    );
  }
});

test('분리과세 문턱 금액을 바꾸면 문턱 판정이 따라 움직인다', () => {
  const before = baseline();
  assert.equal(before.statutory_facts.threshold_consumption.within_threshold, false);

  const rulesets = mutate('pension.income.separate_taxation.threshold', (rule) => {
    rule.value.amount_krw = 30_000_000;
  });
  const after = computePensionReverse(request(), rulesets);
  assert.equal(after.statutory_facts.threshold_consumption.threshold_krw, 30_000_000);
  assert.equal(after.statutory_facts.threshold_consumption.within_threshold, true);
});

test('연령별 원천징수세율을 바꾸면 전략의 원천징수액이 따라 움직인다', () => {
  const before = baseline().payout_strategies[0].first_year_withholding;
  const rulesets = mutate('pension.income.withholding_rate.by_age', (rule) => {
    rule.value.brackets[0].rate = 0.5;
  });
  const after = computePensionReverse(request(), rulesets).payout_strategies[0].first_year_withholding;
  assert.equal(after.rate, 0.5);
  assert.ok(after.income_tax_krw > before.income_tax_krw);
});

test('지방소득세 부가율을 바꾸면 지방세분이 따라 움직인다 — 실효율이 박혀 있지 않다', () => {
  const before = baseline().payout_strategies[0].first_year_withholding;
  const rulesets = mutate('tax.local.personal_income_surtax', (rule) => {
    rule.value.rate_of_income_tax = 0.2;
  });
  const after = computePensionReverse(request(), rulesets).payout_strategies[0].first_year_withholding;
  assert.equal(before.local_tax_krw * 2, after.local_tax_krw);
});

test('연금소득공제의 한도를 바꾸면 종합과세 세액이 따라 움직인다', () => {
  const args = request({ profile: { target_monthly_income_krw: 5_000_000 } });
  const before = computePensionReverse(args, RULESETS).payout_strategies[1].comprehensive;
  const rulesets = mutate('pension.income.deduction', (rule) => {
    rule.value.cap_krw = 1_000_000;
  });
  const after = computePensionReverse(args, rulesets).payout_strategies[1].comprehensive;
  assert.equal(after.deduction_krw, 1_000_000);
  assert.ok(after.income_tax_krw > before.income_tax_krw);
});

test('기본세율표와 본인 기본공제를 바꾸면 과세표준·세액이 따라 움직인다', () => {
  const args = request({ profile: { target_monthly_income_krw: 5_000_000 } });
  const before = computePensionReverse(args, RULESETS).payout_strategies[1].comprehensive;

  // 이 프로필의 과세표준이 실제로 떨어지는 구간을 비튼다 — 쓰이지 않는 구간을 비틀면
  // 값이 안 움직이는 것이 당연해져서 이 검사가 아무것도 재지 못한다.
  const rateChanged = mutate('tax.rate.basic', (rule) => {
    for (const bracket of rule.value.brackets) bracket.rate_on_excess = 0.5;
  });
  assert.ok(
    computePensionReverse(args, rateChanged).payout_strategies[1].comprehensive.income_tax_krw >
      before.income_tax_krw,
  );

  const deductionChanged = mutate('income.deduction.basic.self', (rule) => {
    rule.value.amount_krw = 3_000_000;
  });
  assert.equal(
    computePensionReverse(args, deductionChanged).payout_strategies[1].comprehensive.tax_base_krw,
    before.tax_base_krw - 1_500_000,
  );
});

test('§64조의4의 세율을 바꾸면 분리과세 쪽 값이 따라 움직인다', () => {
  const args = request({ profile: { target_monthly_income_krw: 5_000_000 } });
  const before = computePensionReverse(args, RULESETS).payout_strategies[1].separate;
  const rulesets = mutate('pension.income.separate_taxation.elective_rate', (rule) => {
    rule.value.options.find((option) => option.id === 'separate').rate = 0.3;
  });
  const after = computePensionReverse(args, rulesets).payout_strategies[1].separate;
  assert.equal(after.rate, 0.3);
  assert.equal(before.reading_a.gamok_total_krw * 2, after.reading_a.gamok_total_krw);
});

test('미확정 표시도 룰셋에서 읽는다 — 확정으로 바뀌면 엔진의 판정이 따라 움직인다', () => {
  const args = request({ profile: { target_monthly_income_krw: 5_000_000 } });
  assert.equal(computePensionReverse(args, RULESETS).payout_strategies[1].separate.basis_is_undetermined, true);

  const rulesets = mutate('pension.income.separate_taxation.elective_rate', (rule) => {
    rule.value.what_the_15_percent_is_multiplied_by.status = '확정';
  });
  assert.equal(
    computePensionReverse(args, rulesets).payout_strategies[1].separate.basis_is_undetermined,
    false,
  );
});

test('최소 개시 연령을 바꾸면 오류 경계가 따라 움직인다', () => {
  const rulesets = mutate('pension.withdrawal.eligibility', (rule) => {
    rule.value.requirements.find((item) => item.id === 'age').min_age = 60;
  });
  const at58 = request({ profile: { annuity_start: { kind: 'age', age_years: 58 } } });
  assert.equal(computePensionReverse(at58, RULESETS).ok, true);

  const blocked = computePensionReverse(at58, rulesets);
  assert.equal(blocked.ok, false);
  assert.equal(
    blocked.errors.find((e) => e.code === ERROR.ANNUITY_START_BELOW_MIN_AGE).params.minimum_age_years,
    60,
  );
});

test('납입 한도와 ISA 한도를 바꾸면 세 계좌 법정 상한이 따라 움직인다', () => {
  const before = baseline().statutory_facts.contribution_ceiling;

  const pensionChanged = mutate('pension.contribution.annual_limit', (rule) => {
    rule.value.amount_krw = 36_000_000;
  });
  assert.equal(
    computePensionReverse(request(), pensionChanged).statutory_facts.contribution_ceiling
      .pension_pool_monthly_krw,
    before.pension_pool_monthly_krw * 2,
  );

  const isaChanged = mutate('isa.contribution.annual_limit', (rule) => {
    rule.value.base_amount_krw = 10_000_000;
  });
  assert.notEqual(
    computePensionReverse(request(), isaChanged).statutory_facts.contribution_ceiling.isa_monthly_krw,
    before.isa_monthly_krw,
  );
});

test('연금저축 단독 공제 한도를 바꾸면 계좌 배분의 경계가 따라 움직인다', () => {
  const args = request({ profile: { target_monthly_income_krw: 3_000_000 } });
  const before = computePensionReverse(args, RULESETS).contribution_scenario.allocations;
  const rulesets = mutate('pension.credit.limit.annuity_savings', (rule) => {
    rule.value.amount_krw = 1_200_000;
  });
  const after = computePensionReverse(args, rulesets).contribution_scenario.allocations;

  const annuityOf = (list) => list.find((item) => item.account === 'annuity_savings').monthly_krw;
  const irpOf = (list) => list.find((item) => item.account === 'retirement_pension').monthly_krw;
  assert.notEqual(annuityOf(before), annuityOf(after));
  assert.notEqual(irpOf(before), irpOf(after));
});

test('ISA 의무가입기간을 바꾸면 전환 경로의 개폐가 따라 움직인다', () => {
  const before = baseline().payout_strategies.find((s) => s.strategy_code === 'isa_supplement');
  assert.equal(before.pension_conversion_path.path_open, false);

  const rulesets = mutate('isa.account.requirements', (rule) => {
    rule.value.min_contract_years = 1;
  });
  const after = computePensionReverse(request(), rulesets).payout_strategies.find(
    (s) => s.strategy_code === 'isa_supplement',
  );
  assert.equal(after.pension_conversion_path.path_open, true);
  assert.equal(after.pension_conversion_path.min_contract_years, 1);
});

test('이연퇴직소득 감면 비율을 바꾸면 그 비율이 따라 움직인다', () => {
  const before = baseline().statutory_facts.threshold_consumption.deferred_retirement_ratio;
  const rulesets = mutate('pension.income.withholding_rate.deferred_retirement', (rule) => {
    rule.value.brackets[1].ratio_of_base_rate = 0.42;
  });
  const after = computePensionReverse(request(), rulesets).statutory_facts.threshold_consumption
    .deferred_retirement_ratio;
  assert.equal(before.ratio_of_base_rate, 0.6);
  assert.equal(after.ratio_of_base_rate, 0.42);
});

test('연금외수령 기타소득 세율을 바꾸면 초과 인출의 세액이 따라 움직인다', () => {
  const { rules } = loadReverseRules(RULESETS, 2026);
  const mutated = loadReverseRules(
    mutate('pension.early_withdrawal.other_income_rate', (rule) => {
      rule.value.rate = 0.3;
    }),
    2026,
  ).rules;
  assert.equal(rules.otherIncomeRate, 0.15);
  assert.equal(mutated.otherIncomeRate, 0.3);
});

test('개정예고 룰셋이 없어도 역산은 돈다 — 확정 룰셋만 읽는다', () => {
  const confirmedOnly = { [CONFIRMED_FILE]: structuredClone(RULESETS[CONFIRMED_FILE]) };
  const res = computePensionReverse(request(), confirmedOnly);
  assert.equal(res.ok, true);
  assert.deepEqual(res.statutory_facts.ruleset.files, [CONFIRMED_FILE]);
  assert.ok(PROPOSED_FILE.length > 0);
});

// ── ② 소스 훑기 ─────────────────────────────────────────────────────────

/**
 * 세법과 무관한 숫자만 남긴 허용 목록.
 *
 *  · `0`·`1`·`2` — 0, 항등원, 이진 거듭제곱의 밑
 *  · `4` — `padStart`의 자릿수(연도 네 자리)
 *  · `10` — `parseInt`의 진법
 *  · `12` — 1년의 개월 수. **달력의 사실이고 세법이 정한 값이 아니다**
 *
 * 이 목록에 없는 숫자가 나오면 그것은 세법 수치일 가능성이 높고, **아니라면 이 주석에
 * 왜 아닌지가 적혀야 한다.** 목록을 조용히 늘리는 것이 이 검사를 무력화하는 유일한 길이다.
 */
const ALLOWED_LITERALS = new Set(['0', '1', '2', '4', '10', '12']);

const REVERSE_SOURCES = [
  'reverse.mjs',
  'reverse-rules.mjs',
  'reverse-cap.mjs',
  'reverse-payout-tax.mjs',
  'reverse-accumulation.mjs',
  'reverse-exact.mjs',
];

/**
 * 주석·문자열·정규식을 걷어 낸다 — 그 안의 숫자는 사람이 읽는 설명이거나 룰셋 문자열의
 * 모양이지 계산이 아니다. **배열 첨자도 걷어 낸다** — 지시가 예외로 이름을 댄 자리다.
 */
function strippedSource(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[gimsuy]*/g, ' ')
    .replace(/\[\s*\d+\s*\]/g, '[]');
}

test('역산 모듈의 소스에 세법 수치가 없다', () => {
  const offenders = [];
  for (const file of REVERSE_SOURCES) {
    const source = strippedSource(readFileSync(join(process.cwd(), 'src', 'engine', file), 'utf8'));
    for (const match of source.matchAll(/\b\d[\d_]*(?:\.\d+)?n?\b/g)) {
      const literal = match[0].replace(/[_n]/g, '');
      if (!ALLOWED_LITERALS.has(literal)) offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], '허용 목록 밖의 숫자 낱말이 역산 모듈에 있다');
});
