// ISA 연금 전환 여부(D78 ④)의 시험.
//
// **무엇이 걸려 있나.** 소유자가 「ISA 계좌가 있다고 기입해도 ISA 납입액이 없다」를 지적했고,
// 관리자가 전환 여부를 입력으로 올렸다. 그래서 이 파일이 무는 것은 하나다 —
// **전환한다고 답했을 때만 ISA가 개시 시점 평가액의 재원이 된다.**
//
// 재원이 아닌 ISA에 「목표를 채우기 위한 월 납입」을 앉히면 **닿을 수 없는 목표를 닿는다고
// 적는 것**이 된다. 그 자리를 세 갈래(예·아니오·미응답) × 두 경계(의무가입기간 3년,
// 총 납입한도 잔여 0)로 문다.
//
// **세법 수치를 시험이 직접 적지 않는다.** 의무가입기간도 총 납입한도도 룰셋에서 읽어
// 그 값으로 좌표를 만든다 — 룰셋이 바뀌면 시험이 따라 움직이고, 안 움직이면 그 수가
// 코드나 시험에 박혀 있다는 뜻이다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIRMED_FILE, loadRulesets } from './test-helpers.mjs';
import { computePensionReverse } from './reverse.mjs';
import { loadReverseRules } from './reverse-rules.mjs';
import { allocateMonthlyContribution, futureValueOfMonthlyPlan } from './reverse-accumulation.mjs';
import { ACCOUNT, ERROR, REVERSE_ASSUMPTION, REVERSE_NOTICE, SCHEMA_VERSION } from './constants.mjs';

const RULESETS = loadRulesets();
const RULES = (() => {
  const loaded = loadReverseRules(RULESETS, 2026);
  assert.deepEqual(loaded.errors, []);
  return loaded.rules;
})();

const MIN_CONTRACT_YEARS = RULES.isaMinContractYears;
const TOTAL_LIMIT_KRW = RULES.isaTotalLimitKrw;
const MONTHS_PER_YEAR = 12;

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
      other_income: { state: 'unknown', annual_krw: null },
      deferred_retirement: { present: false, amount_krw: null },
    },
    accounts: {
      annuity_savings: { balance_krw: 0 },
      retirement_pension: { balance_krw: 0 },
      isa: {
        balance_krw: 30_000_000,
        years_since_opening: MIN_CONTRACT_YEARS,
        cumulative_contribution_krw: 30_000_000,
        conversion_planned: null,
      },
    },
  };
  return {
    ...base,
    ...patch,
    profile: { ...base.profile, ...(patch.profile ?? {}) },
    accounts: {
      ...base.accounts,
      ...(patch.accounts ?? {}),
      isa: { ...base.accounts.isa, ...(patch.accounts?.isa ?? {}) },
    },
  };
}

const run = (patch) => computePensionReverse(request(patch), RULESETS);
const codes = (list) => list.map((item) => item.code);
const isaRow = (res) =>
  res.contribution_scenario.allocations.find((item) => item.account === ACCOUNT.ISA);
const isaCard = (res) => res.payout_strategies.find((s) => s.strategy_code === 'isa_supplement');

/** 확정 룰셋의 규칙 하나를 바꾼 **사본**. 원본 파일은 건드리지 않는다. */
function mutate(ruleId, patch) {
  const copy = structuredClone(RULESETS);
  const rule = copy[CONFIRMED_FILE].rules.find((item) => item.id === ruleId);
  assert.ok(rule, `${ruleId}가 룰셋에 있어야 이 시험이 성립한다`);
  patch(rule);
  return copy;
}

// ── 입력의 형태 ─────────────────────────────────────────────────────────

test('전환 여부는 참·거짓·미응답 셋뿐이다 — 그 밖의 값은 엔진이 읽지 않는다', () => {
  const res = computePensionReverse(
    request({ accounts: { isa: { conversion_planned: 'yes' } } }),
    RULESETS,
  );
  assert.equal(res.ok, false);
  const error = res.errors.find((e) => e.field === 'accounts.isa.conversion_planned');
  assert.ok(error, '어느 칸이 잘못됐는지가 오류에 실려야 한다');
  assert.equal(error.code, ERROR.INVALID_ENUM);
});

test('칸이 아예 없어도 계산은 돈다 — 미응답과 같이 다룬다', () => {
  const withoutKey = computePensionReverse(
    request({
      accounts: {
        isa: {
          balance_krw: 30_000_000,
          years_since_opening: MIN_CONTRACT_YEARS,
          cumulative_contribution_krw: 30_000_000,
        },
      },
    }),
    RULESETS,
  );
  const explicitNull = run({});
  assert.equal(withoutKey.ok, true);
  assert.deepEqual(withoutKey, explicitNull);
});

test('같은 입력은 같은 응답을 낸다 — 전환을 켜도 시계를 읽지 않는다', () => {
  assert.deepEqual(
    run({ accounts: { isa: { conversion_planned: true } } }),
    run({ accounts: { isa: { conversion_planned: true } } }),
  );
});

// ── 예 — ISA가 재원이 된다 ──────────────────────────────────────────────

test('D78 ④ — 「예」면 ISA 잔액과 월 납입이 개시 시점 필요 평가액의 재원이 된다', () => {
  const planned = run({ accounts: { isa: { conversion_planned: true } } });
  const not = run({ accounts: { isa: { conversion_planned: false } } });

  const a = planned.contribution_scenario;
  const b = not.contribution_scenario;

  assert.equal(a.isa_counted_as_start_source, true);
  assert.equal(a.isa_source_excluded_reason_code, null);
  assert.equal(a.existing_isa_balance_krw, 30_000_000);
  assert.ok(a.future_value_of_existing_isa_krw > 30_000_000, 'ISA 잔액도 개시 시점까지 불어난다');

  // 같은 목표를 같은 기간에 채우는데 재원이 하나 더 있으니 **덜 넣어도 닿는다.**
  assert.equal(a.target_balance_krw, b.target_balance_krw);
  assert.ok(a.gap_krw < b.gap_krw);
  assert.ok(a.required_monthly_total_krw < b.required_monthly_total_krw);

  // ISA 행에 **방이 생긴다** — 소유자가 지적한 「ISA 납입액이 없다」의 자리다.
  assert.ok(isaRow(planned).room_monthly_krw > 0);
  assert.equal(isaRow(not).room_monthly_krw, 0);
  assert.equal(isaRow(not).limited_by, 'not_a_source');
});

test('재원이 들어간 만큼만 줄어든다 — 목표에서 뺀 것이 ISA의 개시 시점 평가액이다', () => {
  const planned = run({ accounts: { isa: { conversion_planned: true } } }).contribution_scenario;
  const gapFromParts =
    planned.target_balance_krw -
    planned.future_value_of_existing_krw -
    planned.future_value_of_existing_isa_krw -
    planned.deferred_retirement_krw;

  // 원 미만 올림이 세 항에 걸리므로 정확히 같지는 않고, **한 원 안**이어야 한다.
  assert.ok(Math.abs(planned.gap_krw - gapFromParts) <= 1, '재원의 합이 그 자리에서 설명돼야 한다');
});

test('역산한 월 납입액은 ISA를 재원에 넣고도 목표에 닿고, 1원을 빼면 닿지 않는다', () => {
  const planned = run({ accounts: { isa: { conversion_planned: true } } }).contribution_scenario;
  const args = {
    currentBalanceKrw: planned.existing_pension_balance_krw,
    isaBalanceKrw: planned.existing_isa_balance_krw,
    lumpSumAtStartKrw: planned.deferred_retirement_krw,
    annualReturnRate: planned.condition_clause.annual_return_rate,
    months: planned.accumulation_months,
  };
  const reached = futureValueOfMonthlyPlan(RULES, {
    ...args,
    monthlyKrw: planned.required_monthly_total_krw,
  });
  const short = futureValueOfMonthlyPlan(RULES, {
    ...args,
    monthlyKrw: planned.required_monthly_total_krw - 1,
  });
  assert.ok(reached >= planned.target_balance_krw);
  assert.ok(short < planned.target_balance_krw, '하한이어야 한다');
});

test('연금 두 계좌의 한도가 차면 그때 ISA에 실제 금액이 앉는다', () => {
  const planned = run({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: { isa: { balance_krw: 0, cumulative_contribution_krw: 0, conversion_planned: true } },
  });
  const row = isaRow(planned);
  const pension = planned.statutory_facts.contribution_ceiling.pension_pool_monthly_krw;

  assert.ok(planned.contribution_scenario.required_monthly_total_krw > pension);
  assert.ok(row.monthly_krw > 0, '연금 계좌가 다 차면 ISA가 받는다');
  assert.equal(row.annual_krw, row.monthly_krw * MONTHS_PER_YEAR);
  assert.ok(row.fill_order !== null);

  // 같은 좌표에서 「아니오」면 그 몫은 **어느 계좌에도 앉지 못한다.**
  const not = run({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: { isa: { balance_krw: 0, cumulative_contribution_krw: 0, conversion_planned: false } },
  });
  assert.equal(isaRow(not).monthly_krw, 0);
  assert.ok(not.contribution_scenario.unallocatable_monthly_krw > 0);
});

// ── 아니오 · 미응답 ─────────────────────────────────────────────────────

test('「아니오」와 「미응답」은 같은 수를 내고 이유 코드로 갈린다', () => {
  const no = run({ accounts: { isa: { conversion_planned: false } } });
  const unknown = run({ accounts: { isa: { conversion_planned: null } } });

  assert.equal(
    no.contribution_scenario.required_monthly_total_krw,
    unknown.contribution_scenario.required_monthly_total_krw,
  );
  assert.equal(no.contribution_scenario.isa_counted_as_start_source, false);
  assert.equal(unknown.contribution_scenario.isa_counted_as_start_source, false);
  assert.equal(no.contribution_scenario.isa_source_excluded_reason_code, 'conversion_not_planned');
  assert.equal(
    unknown.contribution_scenario.isa_source_excluded_reason_code,
    'conversion_not_declared',
  );

  // **미응답에만 알림이 붙는다** — 「물었는데 아니라고 했다」와 「묻지 않았다」는 다르다.
  assert.ok(codes(unknown.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_NOT_DECLARED));
  assert.ok(!codes(no.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_NOT_DECLARED));
});

test('ISA가 아예 없는 사람에게는 전환 알림을 내지 않는다 — 없는 계좌 이야기다', () => {
  const noIsa = run({
    accounts: {
      isa: {
        balance_krw: 0,
        years_since_opening: null,
        cumulative_contribution_krw: null,
        conversion_planned: null,
      },
    },
  });
  assert.ok(!codes(noIsa.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_NOT_DECLARED));

  // 잔액이 0이어도 경과연수를 적었으면 계좌가 있는 것이다.
  const tenureOnly = run({
    accounts: {
      isa: { balance_krw: 0, years_since_opening: 0, cumulative_contribution_krw: null, conversion_planned: null },
    },
  });
  assert.ok(codes(tenureOnly.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_NOT_DECLARED));
});

test('미응답이어도 블록 ②가 없으면 그 사실이 먼저다 — 알림은 여전히 나간다', () => {
  const noRate = run({ profile: { average_annual_return_rate: null } });
  assert.equal(noRate.contribution_scenario, null);
  assert.ok(codes(noRate.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_NOT_DECLARED));
  assert.equal(noRate.statutory_facts.contribution_ceiling.isa_counted_as_start_source, false);
});

// ── 경계 ① 의무가입기간 3년 (개시 시점 기준) ────────────────────────────

/** 오늘 이미 개시 연령을 넘긴 사람. 개시까지의 남은 기간을 짧게 만들 수 있는 유일한 길이다. */
const NEAR_START = { birth_date: '1969-05-10' };

test('오늘은 아직 열리지 않았어도 개시 시점에 열리면 재원이다 — 두 시점은 다른 사실이다', () => {
  const later = run({
    accounts: { isa: { years_since_opening: 0, conversion_planned: true } },
  });
  assert.ok(later.echo.accumulation_months / MONTHS_PER_YEAR > MIN_CONTRACT_YEARS);
  assert.equal(later.contribution_scenario.isa_counted_as_start_source, true);

  // 오늘 기준의 경로는 **닫힌 채로 남는다** — 그 사실을 지우지 않는다.
  assert.equal(isaCard(later).pension_conversion_path.path_open, false);
  assert.equal(isaCard(later).pension_conversion_path_at_annuity_start.path_open, true);
});

test('경계 — 개시 시점에 의무가입기간이 모자라면 전환할 수 없고 ISA는 재원에서 빠진다', () => {
  const short = run({
    profile: { ...NEAR_START, annuity_start: { kind: 'age', age_years: 59 } },
    accounts: {
      isa: { years_since_opening: 0, cumulative_contribution_krw: 0, conversion_planned: true },
    },
  });

  const monthsToStart = short.echo.accumulation_months;
  const yearsToStart = Math.floor(monthsToStart / MONTHS_PER_YEAR);
  assert.ok(yearsToStart < MIN_CONTRACT_YEARS, '이 좌표는 개시까지 의무가입기간이 못 찬다');

  assert.equal(short.contribution_scenario.isa_counted_as_start_source, false);
  assert.equal(
    short.contribution_scenario.isa_source_excluded_reason_code,
    'conversion_not_eligible_at_annuity_start',
  );
  assert.equal(short.contribution_scenario.existing_isa_balance_krw, 0);
  assert.equal(isaRow(short).room_monthly_krw, 0);

  const alert = short.notices.find(
    (n) => n.code === REVERSE_NOTICE.ISA_CONVERSION_NOT_ELIGIBLE_AT_START,
  );
  assert.ok(alert, '전환할 수 없다는 사실이 알림으로 나가야 한다');
  assert.equal(alert.severity, 'warning');
  assert.equal(alert.params.min_contract_years, MIN_CONTRACT_YEARS);
  assert.equal(alert.params.years_since_opening_at_annuity_start, yearsToStart);
});

test('경계 — 열두 달이 차야 한 해다. 열한 달은 아니다', () => {
  // 개시일은 생일이므로 `as_of_date`를 생일 하루 전후로 옮겨 개월수를 가른다.
  const atYearEnd = computePensionReverse(
    {
      ...request({
        profile: { annuity_start: { kind: 'age', age_years: 55 } },
        accounts: { isa: { years_since_opening: MIN_CONTRACT_YEARS - 1, conversion_planned: true } },
      }),
      as_of_date: '2034-05-10',
    },
    RULESETS,
  );
  const oneMonthShort = computePensionReverse(
    {
      ...request({
        profile: { annuity_start: { kind: 'age', age_years: 55 } },
        accounts: { isa: { years_since_opening: MIN_CONTRACT_YEARS - 1, conversion_planned: true } },
      }),
      as_of_date: '2034-06-10',
    },
    RULESETS,
  );

  assert.equal(atYearEnd.echo.accumulation_months, MONTHS_PER_YEAR);
  assert.equal(oneMonthShort.echo.accumulation_months, MONTHS_PER_YEAR - 1);
  assert.equal(atYearEnd.contribution_scenario.isa_counted_as_start_source, true);
  assert.equal(oneMonthShort.contribution_scenario.isa_counted_as_start_source, false);
});

test('경과연수를 모르면 0으로 본다 — 전환 가능을 과장하지 않는다', () => {
  const unknownTenure = run({
    profile: { ...NEAR_START, annuity_start: { kind: 'age', age_years: 59 } },
    accounts: { isa: { years_since_opening: null, conversion_planned: true } },
  });
  assert.equal(
    isaCard(unknownTenure).pension_conversion_path_at_annuity_start.tenure_assumed_zero,
    true,
  );
  assert.ok(codes(unknownTenure.notices).includes(REVERSE_NOTICE.ISA_TENURE_MISSING));
});

test('의무가입기간을 룰셋에서 바꾸면 개시 시점 판정이 따라 움직인다', () => {
  const args = request({
    profile: { ...NEAR_START, annuity_start: { kind: 'age', age_years: 59 } },
    accounts: {
      isa: { years_since_opening: 0, cumulative_contribution_krw: 0, conversion_planned: true },
    },
  });
  const before = computePensionReverse(args, RULESETS);
  assert.equal(before.contribution_scenario.isa_counted_as_start_source, false);

  const relaxed = mutate('isa.account.requirements', (rule) => {
    rule.value.min_contract_years = 0;
  });
  const after = computePensionReverse(args, relaxed);
  assert.equal(after.contribution_scenario.isa_counted_as_start_source, true);
});

// ── 경계 ② 총 납입한도의 잔여 ───────────────────────────────────────────

test('경계 — 총 납입한도를 다 쓴 ISA에는 한 원도 앉지 않는다', () => {
  const exhausted = run({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: {
      isa: {
        balance_krw: TOTAL_LIMIT_KRW,
        years_since_opening: MIN_CONTRACT_YEARS,
        cumulative_contribution_krw: TOTAL_LIMIT_KRW,
        conversion_planned: true,
      },
    },
  });
  const row = isaRow(exhausted);
  assert.equal(row.room_monthly_krw, 0);
  assert.equal(row.monthly_krw, 0);
  // **잔액은 그대로 재원이다** — 막힌 것은 「더 넣는 것」이지 「가진 것」이 아니다.
  assert.equal(exhausted.contribution_scenario.isa_counted_as_start_source, true);
  assert.equal(exhausted.contribution_scenario.existing_isa_balance_krw, TOTAL_LIMIT_KRW);

  const capped = exhausted.notices.find(
    (n) => n.code === REVERSE_NOTICE.ISA_SOURCE_CAPPED_BY_TOTAL_LIMIT,
  );
  assert.ok(capped);
  assert.equal(capped.params.remaining_total_limit_krw, 0);
  assert.equal(capped.params.isa_source_monthly_krw, 0);

  // 앉히지 못한 몫이 남아 있는데 0원이면 그것은 **한도가 막은 것**이다.
  assert.ok(exhausted.contribution_scenario.unallocatable_monthly_krw > 0);
  assert.equal(row.limited_by, 'contribution_limit');
});

test('경계 — 잔여가 1원이라도 남으면 0이 아닌 다른 사실이다', () => {
  const nearlyExhausted = run({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: {
      isa: {
        balance_krw: TOTAL_LIMIT_KRW,
        years_since_opening: MIN_CONTRACT_YEARS,
        cumulative_contribution_krw: TOTAL_LIMIT_KRW - 1,
        conversion_planned: true,
      },
    },
  });
  const capped = nearlyExhausted.notices.find(
    (n) => n.code === REVERSE_NOTICE.ISA_SOURCE_CAPPED_BY_TOTAL_LIMIT,
  );
  assert.equal(capped.params.remaining_total_limit_krw, 1);
  // 1원을 적립 개월수로 나누면 월 몫은 0원이다 — **없는 여유를 만들어 내지 않는다.**
  assert.equal(isaRow(nearlyExhausted).room_monthly_krw, 0);
});

test('총 납입한도의 잔여가 적립 개월수로 나뉜다 — 그 사실이 가정으로 나간다', () => {
  const planned = run({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: {
      isa: { balance_krw: 0, cumulative_contribution_krw: 0, conversion_planned: true },
    },
  });
  const months = planned.contribution_scenario.accumulation_months;
  assert.equal(isaRow(planned).room_monthly_krw, Math.floor(TOTAL_LIMIT_KRW / months));
  assert.ok(codes(planned.assumptions).includes(REVERSE_ASSUMPTION.ISA_TOTAL_LIMIT_SPREAD));
  assert.ok(codes(planned.assumptions).includes(REVERSE_ASSUMPTION.ISA_CONTRACT_HELD_TO_START));

  // 재원이 아니면 그 가정 둘이 서지 않는다 — 서지 않은 계산의 가정을 적지 않는다.
  const not = run({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: { isa: { balance_krw: 0, cumulative_contribution_krw: 0, conversion_planned: false } },
  });
  assert.ok(!codes(not.assumptions).includes(REVERSE_ASSUMPTION.ISA_TOTAL_LIMIT_SPREAD));
  assert.ok(!codes(not.assumptions).includes(REVERSE_ASSUMPTION.ISA_CONTRACT_HELD_TO_START));
});

test('총 납입한도를 룰셋에서 바꾸면 ISA에 앉는 몫이 따라 움직인다', () => {
  const args = request({
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: {
      isa: { balance_krw: 0, cumulative_contribution_krw: 0, conversion_planned: true },
    },
  });
  const before = computePensionReverse(args, RULESETS);
  const halved = mutate('isa.account.requirements', (rule) => {
    rule.value.total_contribution_limit_krw = Math.floor(TOTAL_LIMIT_KRW / 2);
  });
  const after = computePensionReverse(args, halved);

  assert.ok(isaRow(after).room_monthly_krw < isaRow(before).room_monthly_krw);
});

// ── 법정 상한과 「달성할 수 없습니다」 ──────────────────────────────────

test('상한을 넘었는지는 **재원으로 쓸 수 있는 상한**과 견준다', () => {
  const args = {
    profile: { target_monthly_income_krw: 8_000_000, annuity_start: { kind: 'age', age_years: 60 } },
    accounts: { isa: { balance_krw: 0, cumulative_contribution_krw: 0 } },
  };
  const planned = run({ ...args, accounts: { isa: { ...args.accounts.isa, conversion_planned: true } } });
  const not = run({ ...args, accounts: { isa: { ...args.accounts.isa, conversion_planned: false } } });

  const pension = planned.statutory_facts.contribution_ceiling.pension_pool_monthly_krw;
  assert.equal(not.contribution_scenario.source_ceiling_monthly_krw, pension);
  assert.equal(
    planned.contribution_scenario.source_ceiling_monthly_krw,
    pension + isaRow(planned).room_monthly_krw,
  );
  assert.ok(
    not.contribution_scenario.unallocatable_monthly_krw >
      planned.contribution_scenario.unallocatable_monthly_krw,
    'ISA를 재원으로 쓰면 못 앉히는 몫이 줄어야 한다',
  );

  // 이 좌표는 양쪽 다 상한을 넘는다 — **넘었다는 알림의 상한 값이 그 자를 그대로 쓴다.**
  const alert = planned.notices.find((n) => n.code === REVERSE_NOTICE.EXCEEDS_CONTRIBUTION_CEILING);
  const alertNot = not.notices.find((n) => n.code === REVERSE_NOTICE.EXCEEDS_CONTRIBUTION_CEILING);
  assert.ok(alert && alertNot);
  assert.equal(
    alert.params.ceiling_monthly_krw,
    planned.contribution_scenario.source_ceiling_monthly_krw,
  );
  assert.equal(alertNot.params.ceiling_monthly_krw, pension);

  // 세 계좌의 **법정** 상한 자체는 전환 여부와 무관한 사실이라 움직이지 않는다.
  assert.equal(
    planned.statutory_facts.contribution_ceiling.total_monthly_krw,
    not.statutory_facts.contribution_ceiling.total_monthly_krw,
  );
});

// ── 배분 순서 (32절) ────────────────────────────────────────────────────

test('전환 근거가 서면 ISA가 연금계좌 초과분보다 앞이고, 안 서면 뒤다 (32.5절)', () => {
  const planned = run({
    profile: { target_monthly_income_krw: 3_000_000 },
    accounts: { isa: { conversion_planned: true } },
  });
  const not = run({
    profile: { target_monthly_income_krw: 3_000_000 },
    accounts: { isa: { conversion_planned: false } },
  });

  assert.equal(planned.contribution_scenario.fill_order.variant_code, 'isa_before_pension_surplus');
  assert.equal(not.contribution_scenario.fill_order.variant_code, 'pension_surplus_before_isa');

  // **세법이 정한 순서가 아니라는 사실이 값으로 나간다**(32.6절 1번).
  assert.equal(planned.contribution_scenario.fill_order.is_statutory_order, false);
  assert.ok(planned.contribution_scenario.fill_order.basis_rule_ids.length > 0);

  // ISA가 앞이면 그 자리의 순번이 연금계좌 초과분보다 **작다.**
  const isaStep = isaRow(planned).fill_steps[0];
  const surplusStep = planned.contribution_scenario.allocations
    .find((a) => a.account === ACCOUNT.ANNUITY)
    .fill_steps.find((s) => s.basis_code === 'reverse_fill_no_credit_this_year_but_principal_untaxed_on_withdrawal');
  assert.ok(isaStep.order < surplusStep.order, 'ISA가 연금계좌 초과분보다 먼저 채워져야 한다');
});

test('1단계는 세액공제 한도까지다 — 그 경계에서 다음 몫이 갈린다', () => {
  const creditMonthly = Math.floor(RULES.combinedCreditLimitKrw / MONTHS_PER_YEAR);
  const atLimit = allocateMonthlyContribution(RULES, {
    requiredMonthlyKrw: creditMonthly,
    isaYearsSinceOpening: MIN_CONTRACT_YEARS,
    isaCumulativeKrw: 0,
    isaSource: { monthly_krw: 500_000 },
  });
  const byLimit = Object.fromEntries(atLimit.allocations.map((a) => [a.account, a]));
  // 공제 한도까지는 연금계좌 둘이 전부 가져간다 — ISA도 초과분도 아직 서지 않는다.
  assert.equal(byLimit.annuity_savings.monthly_krw + byLimit.retirement_pension.monthly_krw, creditMonthly);
  assert.equal(byLimit.isa.monthly_krw, 0);
  assert.deepEqual(
    byLimit.annuity_savings.fill_steps.map((s) => s.basis_code),
    ['reverse_fill_credit_limit_expires_with_tax_year'],
  );

  // **1원을 더하면 그 1원은 ISA로 간다** — 전환 근거가 선 좌표이기 때문이다.
  const overByOne = allocateMonthlyContribution(RULES, {
    requiredMonthlyKrw: creditMonthly + 1,
    isaYearsSinceOpening: MIN_CONTRACT_YEARS,
    isaCumulativeKrw: 0,
    isaSource: { monthly_krw: 500_000 },
  });
  const byOver = Object.fromEntries(overByOne.allocations.map((a) => [a.account, a]));
  assert.equal(byOver.isa.monthly_krw, 1);
  assert.equal(
    byOver.annuity_savings.monthly_krw + byOver.retirement_pension.monthly_krw,
    creditMonthly,
  );

  // 근거가 서지 않으면 그 1원은 **연금계좌 초과분**으로 간다.
  const swapped = allocateMonthlyContribution(RULES, {
    requiredMonthlyKrw: creditMonthly + 1,
    isaYearsSinceOpening: MIN_CONTRACT_YEARS,
    isaCumulativeKrw: 0,
    isaSource: null,
  });
  const bySwapped = Object.fromEntries(swapped.allocations.map((a) => [a.account, a]));
  assert.equal(bySwapped.isa.monthly_krw, 0);
  assert.equal(bySwapped.annuity_savings.monthly_krw, Math.floor(RULES.annuityCreditLimitKrw / MONTHS_PER_YEAR) + 1);
});

test('연금저축은 두 자리에서 채워지고 두 몫의 근거가 다르다 (32.3절)', () => {
  const planned = run({
    profile: { target_monthly_income_krw: 3_000_000 },
    accounts: { isa: { conversion_planned: true } },
  });
  const annuity = planned.contribution_scenario.allocations.find((a) => a.account === ACCOUNT.ANNUITY);
  assert.equal(annuity.fill_steps.length, 2);
  assert.deepEqual(annuity.fill_steps.map((s) => s.basis_code), [
    'reverse_fill_credit_limit_expires_with_tax_year',
    'reverse_fill_no_credit_this_year_but_principal_untaxed_on_withdrawal',
  ]);
  assert.equal(
    annuity.fill_steps.reduce((sum, s) => sum + s.monthly_krw, 0),
    annuity.monthly_krw,
  );
  // 근거 규칙이 두 자리에서 합쳐져 행에 실린다 — 초과분 자리는 원금 비과세를 딛는다.
  assert.ok(annuity.basis_rule_ids.includes('pension.withdrawal.non_deducted_principal'));
  assert.ok(annuity.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'));
});

test('세액 한도(§61③)를 적용하지 않았다는 사실이 가정으로 나간다 — 입력을 늘리지 않았다', () => {
  const res = run({ accounts: { isa: { conversion_planned: true } } });
  const assumption = res.assumptions.find(
    (a) => a.code === REVERSE_ASSUMPTION.TAX_LIABILITY_CAP_NOT_APPLIED,
  );
  assert.ok(assumption);
  assert.equal(assumption.params.rule_id_not_applied, 'pension.credit.tax_liability_cap');
  // **적용하지 않은 규칙을 근거 목록에 싣지 않는다** — 읽지 않았기 때문이다.
  assert.ok(!res.legal_basis.map((e) => e.rule_id).includes('pension.credit.tax_liability_cap'));
  // 반면 순서의 근거로 실제로 읽은 둘은 근거 목록에 있다.
  const ids = res.legal_basis.map((e) => e.rule_id);
  assert.ok(ids.includes('pension.credit.unused.contribution_carryover'));
  assert.ok(ids.includes('pension.contribution.beyond_credit_limit'));
});

test('세액공제 한도를 룰셋에서 바꾸면 1단계의 경계가 따라 움직인다', () => {
  const args = request({
    profile: { target_monthly_income_krw: 3_000_000 },
    accounts: { isa: { conversion_planned: true } },
  });
  const before = computePensionReverse(args, RULESETS).contribution_scenario.allocations;
  const changed = mutate('pension.credit.limit.combined', (rule) => {
    rule.value.amount_krw = 18_000_000;
  });
  const after = computePensionReverse(args, changed).contribution_scenario.allocations;

  const irp = (list) => list.find((a) => a.account === ACCOUNT.PENSION).monthly_krw;
  const isa = (list) => list.find((a) => a.account === ACCOUNT.ISA).monthly_krw;
  assert.ok(irp(after) > irp(before), '합산 공제 한도가 커지면 1단계가 더 담는다');
  assert.ok(isa(after) < isa(before), '그만큼 ISA 자리로 흘러가는 몫이 준다');
});

// ── 문턱 표와 전략 카드의 일관성 (30절) ─────────────────────────────────

test('전환금은 문턱을 쓰지 않는다 — 전환 여부와 무관하게, 그리고 계획 여부는 따로 적는다', () => {
  for (const planned of [true, false, null]) {
    const res = run({ accounts: { isa: { conversion_planned: planned } } });
    const row = res.statutory_facts.threshold_consumption.rows.find(
      (item) => item.source_code === 'isa_conversion_amount',
    );
    assert.equal(row.consumes_threshold, false, '과세제외금액은 언제나 문턱 밖이다');
    assert.equal(row.in_plan, planned === true);
    assert.equal(isaCard(res).conversion_consumes_threshold, false);
    assert.equal(isaCard(res).counted_as_start_source, planned === true);
    assert.equal(isaCard(res).conversion_planned, planned);
  }
});

test('전환금이 수령액의 어느 몫인지는 룰셋이 정하지 않는다 — 문턱을 줄이지 않고 그 사실을 낸다', () => {
  const planned = run({ accounts: { isa: { conversion_planned: true } } });
  const not = run({ accounts: { isa: { conversion_planned: false } } });

  assert.equal(
    planned.statutory_facts.threshold_consumption.counted_annual_krw,
    not.statutory_facts.threshold_consumption.counted_annual_krw,
  );
  assert.ok(
    codes(planned.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_THRESHOLD_SHARE_NOT_APPORTIONED),
  );
  assert.ok(
    !codes(not.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_THRESHOLD_SHARE_NOT_APPORTIONED),
  );
});

test('전략 카드는 ISA 잔액이 0보다 클 때만 나온다 — 전환을 켜도 그 규칙은 그대로다', () => {
  const noBalance = run({
    accounts: { isa: { balance_krw: 0, conversion_planned: true } },
  });
  assert.deepEqual(
    noBalance.payout_strategies.map((s) => s.strategy_code),
    ['within_threshold', 'exceed_threshold'],
  );
});

// ── 층 4를 열지 않는다 ──────────────────────────────────────────────────

test('전환을 켜도 수익률이 블록 ①·③을 움직이지 않는다 (AC-R16)', () => {
  const low = run({
    profile: { average_annual_return_rate: 0.01 },
    accounts: { isa: { conversion_planned: true } },
  });
  const high = run({
    profile: { average_annual_return_rate: 0.09 },
    accounts: { isa: { conversion_planned: true } },
  });

  assert.deepEqual(low.statutory_facts, high.statutory_facts);
  assert.deepEqual(low.payout_strategies, high.payout_strategies);
  assert.notDeepEqual(low.contribution_scenario, high.contribution_scenario);
  assert.equal(low.echo.return_rate_affects.statutory_facts, false);
});

test('수익률이 없어도 전환 판정은 선다 — 블록 ①과 카드가 그 사실을 낸다', () => {
  const res = run({
    profile: { average_annual_return_rate: null },
    accounts: { isa: { conversion_planned: true } },
  });
  assert.equal(res.contribution_scenario, null);
  assert.equal(res.statutory_facts.contribution_ceiling.isa_counted_as_start_source, true);
  assert.equal(res.statutory_facts.contribution_ceiling.isa_source_excluded_reason_code, null);
  assert.equal(isaCard(res).counted_as_start_source, true);
});
