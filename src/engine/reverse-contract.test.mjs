// 역산 진입점의 계약 시험 — `requirements.md` 9.4절의 AC-R 가운데 **엔진이 지는 것**을 문다.
//
// 화면 쪽 AC(AC-R1·R2·R4·R21·R22·R23·R26 등)는 여기서 다루지 않는다. 엔진에는 탭도
// 레이아웃도 없다. 엔진이 지는 것은 「그 값이 나오는가/안 나오는가」와 「무엇을 단정하지
// 않는가」이고, 그 둘만 여기서 잰다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadRulesets } from './test-helpers.mjs';
import { computePensionReverse } from './reverse.mjs';
import { ERROR, REVERSE_ASSUMPTION, REVERSE_NOTICE, SCHEMA_VERSION } from './constants.mjs';

const RULESETS = loadRulesets();

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
      isa: { balance_krw: 0, years_since_opening: null, cumulative_contribution_krw: null },
    },
  };
  return {
    ...base,
    ...patch,
    profile: { ...base.profile, ...(patch.profile ?? {}) },
    accounts: { ...base.accounts, ...(patch.accounts ?? {}) },
  };
}

const run = (patch) => computePensionReverse(request(patch), RULESETS);
const codes = (list) => list.map((item) => item.code);

// ── 형태 ────────────────────────────────────────────────────────────────

test('AC-R3 — 필수 넷이 채워지면 법정 사실 블록이 나온다. 별도 제출 동작이 없다', () => {
  const res = run({});
  assert.equal(res.ok, true);
  assert.ok(res.statutory_facts !== null);
  assert.ok(Number.isSafeInteger(res.statutory_facts.minimum_start_balance.required_krw));
});

test('예외를 던지지 않는다 — 입력이 통째로 비어도 반환값으로 답한다', () => {
  const res = computePensionReverse(null, RULESETS);
  assert.equal(res.ok, false);
  assert.ok(res.errors.length > 0);
});

test('오류는 첫 건에서 멈추지 않고 발견한 것을 전부 담는다', () => {
  const res = computePensionReverse(
    request({
      profile: { target_monthly_income_krw: 0, payout_years: 0, birth_date: '1980-02-31' },
    }),
    RULESETS,
  );
  assert.equal(res.ok, false);
  const fields = res.errors.map((e) => e.field);
  assert.ok(fields.includes('profile.target_monthly_income_krw'));
  assert.ok(fields.includes('profile.payout_years'));
  assert.ok(fields.includes('profile.birth_date'));
});

test('같은 입력은 같은 응답을 낸다 — 시계도 난수도 읽지 않는다', () => {
  assert.deepEqual(run({}), run({}));
});

test('major가 다른 요청은 계산하지 않는다', () => {
  const res = computePensionReverse({ ...request({}), schema_version: '1.0.0' }, RULESETS);
  assert.equal(res.ok, false);
  assert.ok(codes(res.errors).includes(ERROR.SCHEMA_VERSION_MISMATCH));
});

// ── AC-R5 개시 연령 하한 ────────────────────────────────────────────────

test('AC-R5 — 개시 나이가 룰셋의 최소 개시 연령 미만이면 오류이고 법정 사실 블록이 없다', () => {
  const res = run({ profile: { annuity_start: { kind: 'age', age_years: 54 } } });
  assert.equal(res.ok, false);
  const error = res.errors.find((e) => e.code === ERROR.ANNUITY_START_BELOW_MIN_AGE);
  assert.ok(error, '전용 오류 코드가 나가야 한다');
  assert.equal(error.field, 'profile.annuity_start');
  assert.equal(error.params.minimum_age_years, 55);
  assert.equal(res.statutory_facts, undefined);
});

test('경계 — 정확히 최소 개시 연령이면 통과한다', () => {
  const ok = run({ profile: { annuity_start: { kind: 'age', age_years: 55 } } });
  assert.equal(ok.ok, true);
  assert.equal(ok.echo.annuity_start_age_years, 55);
});

test('연도로 답해도 같은 판정을 받는다 — 개시 시점은 그 해의 생일이다', () => {
  const byYear = run({ profile: { annuity_start: { kind: 'year', year: 2045 } } });
  const byAge = run({ profile: { annuity_start: { kind: 'age', age_years: 65 } } });
  assert.equal(byYear.echo.annuity_start_date, '2045-05-10');
  assert.equal(byYear.echo.annuity_start_date, byAge.echo.annuity_start_date);
  assert.equal(byYear.echo.annuity_start_age_years, 65);
});

// ── AC-R6 · D77 판정 1 — 수익률이 없으면 블록 ②가 통째로 없다 ──────────

test('AC-R6 — 수익률이 없으면 계좌별 시나리오가 없고, 법정 사실 블록은 남는다', () => {
  const res = run({ profile: { average_annual_return_rate: null } });
  assert.equal(res.ok, true);
  assert.equal(res.contribution_scenario, null);
  assert.equal(res.contribution_scenario_absent_reason_code, 'return_rate_not_supplied');
  assert.ok(codes(res.notices).includes(REVERSE_NOTICE.RETURN_RATE_NOT_SUPPLIED));
  assert.ok(res.statutory_facts.minimum_start_balance.required_krw > 0);
});

test('수익률이 없을 때 0으로 계산하지 않는다 — 수익률 0인 요청과 응답이 다르다', () => {
  const absent = run({ profile: { average_annual_return_rate: null } });
  const zero = run({ profile: { average_annual_return_rate: 0 } });
  assert.equal(absent.contribution_scenario, null);
  assert.ok(zero.contribution_scenario !== null, '0은 사용자가 준 값이므로 계산한다');
  assert.ok(zero.contribution_scenario.required_monthly_total_krw > 0);
});

test('AC-R16 · 층 4 금지 — 수익률을 바꿔도 법정 사실과 전략 비교는 한 원도 안 움직인다', () => {
  const low = run({ profile: { average_annual_return_rate: 0.01 } });
  const high = run({ profile: { average_annual_return_rate: 0.09 } });

  assert.deepEqual(low.statutory_facts, high.statutory_facts);
  assert.deepEqual(low.payout_strategies, high.payout_strategies);
  assert.notDeepEqual(low.contribution_scenario, high.contribution_scenario);
  assert.equal(low.echo.return_rate_affects.statutory_facts, false);
  assert.equal(low.echo.return_rate_affects.payout_strategies, false);
  assert.equal(low.echo.return_rate_affects.contribution_scenario, true);
});

test('개시일이 이미 지난 사용자에게는 적립 기간이 없으므로 블록 ②가 없다', () => {
  const res = run({
    as_of_date: '2050-01-01',
    profile: { annuity_start: { kind: 'age', age_years: 65 } },
  });
  assert.equal(res.ok, true);
  assert.equal(res.contribution_scenario, null);
  assert.equal(res.contribution_scenario_absent_reason_code, 'accumulation_period_not_positive');
});

// ── AC-R12 — 한도가 잔액보다 먼저 무는 자리 ─────────────────────────────

test('AC-R12 — 수령 기간이 문턱보다 짧으면 「한도가 먼저 문다」가 나가고, 길면 안 나간다', () => {
  const short = run({ profile: { payout_years: 5 } });
  assert.equal(short.statutory_facts.minimum_start_balance.binding_code, 'annual_cap');
  assert.equal(short.statutory_facts.minimum_start_balance.cap_binds_before_balance, true);
  assert.ok(codes(short.notices).includes(REVERSE_NOTICE.ANNUAL_CAP_BINDS_FIRST));

  const long = run({ profile: { payout_years: 20 } });
  assert.equal(long.statutory_facts.minimum_start_balance.binding_code, 'remaining_balance');
  assert.ok(!codes(long.notices).includes(REVERSE_NOTICE.ANNUAL_CAP_BINDS_FIRST));
});

test('경계 — 한도가 마지막으로 무는 해와 그 다음 해', () => {
  const nine = run({ profile: { payout_years: 9 } });
  const ten = run({ profile: { payout_years: 10 } });
  assert.equal(nine.statutory_facts.minimum_start_balance.cap_binds_before_balance, true);
  assert.equal(ten.statutory_facts.minimum_start_balance.cap_binds_before_balance, false);
  assert.equal(nine.statutory_facts.minimum_start_balance.min_payout_years_without_cap_binding, 10);
});

test('5년 수령의 필요 평가액은 잔액이 요구하는 것보다 크다 — 조문 때문이다', () => {
  // 월 200만원(연 2,400만원)을 5년: 산술은 1억 4,400만원, 조문은 2억 1,600만원.
  const res = run({ profile: { payout_years: 5 } });
  const floors = res.statutory_facts.minimum_start_balance;
  assert.equal(floors.remaining_balance_floor_krw, 120_000_000);
  assert.equal(floors.annual_cap_floor_krw, 216_000_000);
  assert.equal(floors.required_krw, 216_000_000);
});

// ── AC-R13 · R14 — 재원별 문턱 소모 ─────────────────────────────────────

test('AC-R13 — 재원별로 문턱을 쓰는지 안 쓰는지가 표로 나간다', () => {
  const rows = run({}).statutory_facts.threshold_consumption.rows;
  const bySource = Object.fromEntries(rows.map((row) => [row.source_code, row]));
  assert.equal(bySource.tax_credited_contribution_and_return.consumes_threshold, true);
  assert.equal(bySource.isa_conversion_amount.consumes_threshold, false);
  for (const row of rows) assert.ok(row.basis_rule_ids.length > 0);
});

test('AC-R14 — 퇴직금을 「예」로 입력하지 않으면 이연퇴직소득 행이 없다', () => {
  const without = run({});
  assert.ok(
    !without.statutory_facts.threshold_consumption.rows.some(
      (row) => row.source_code === 'deferred_retirement_income',
    ),
  );

  const withDeferred = run({
    profile: { deferred_retirement: { present: true, amount_krw: 50_000_000 } },
  });
  const row = withDeferred.statutory_facts.threshold_consumption.rows.find(
    (item) => item.source_code === 'deferred_retirement_income',
  );
  assert.ok(row, '「예」면 행이 나와야 한다');
  assert.equal(row.consumes_threshold, false);

  // 감면 비율은 내되 **밑세율은 내지 않는다** — 이 룰셋의 범위 밖이다.
  const ratio = withDeferred.statutory_facts.threshold_consumption.deferred_retirement_ratio;
  assert.equal(ratio.base_rate_in_scope, false);
  assert.equal(ratio.income_tax_krw, null);
  assert.ok(codes(withDeferred.notices).includes(REVERSE_NOTICE.DEFERRED_BASE_RATE_OUT_OF_SCOPE));
});

// ── AC-R17 — 세 계좌 법정 상한 ──────────────────────────────────────────

test('AC-R17 — 필요 월 납입액이 세 계좌 법정 상한을 넘으면 그 사실이 나간다', () => {
  const res = run({
    profile: {
      target_monthly_income_krw: 20_000_000,
      annuity_start: { kind: 'age', age_years: 56 },
      average_annual_return_rate: 0.01,
    },
  });
  assert.equal(res.contribution_scenario.exceeds_statutory_contribution_ceiling, true);
  assert.ok(res.contribution_scenario.unallocatable_monthly_krw > 0);
  assert.ok(codes(res.notices).includes(REVERSE_NOTICE.EXCEEDS_CONTRIBUTION_CEILING));
});

// ── AC-R10 · R18 · R20 — 수령 전략 비교 ─────────────────────────────────

test('AC-R18 — 두 전략은 항상 나란히 나오고, ISA 잔액이 0보다 클 때만 셋이 된다', () => {
  const withoutIsa = run({});
  assert.deepEqual(
    withoutIsa.payout_strategies.map((s) => s.strategy_code),
    ['within_threshold', 'exceed_threshold'],
  );

  const withIsa = run({
    accounts: { isa: { balance_krw: 30_000_000, years_since_opening: 4, cumulative_contribution_krw: 30_000_000 } },
  });
  assert.deepEqual(
    withIsa.payout_strategies.map((s) => s.strategy_code),
    ['within_threshold', 'exceed_threshold', 'isa_supplement'],
  );
});

test('AC-R10 — 연금 외 소득이 「모름」이면 유불리를 판정하지 않는다', () => {
  const res = run({
    profile: {
      target_monthly_income_krw: 2_000_000,
      other_income: { state: 'unknown', annual_krw: null },
    },
  });
  const exceed = res.payout_strategies.find((s) => s.strategy_code === 'exceed_threshold');
  assert.equal(exceed.comparison_code, 'other_income_unknown');
  assert.equal(exceed.lower_option_code, null);
  assert.equal(exceed.comprehensive, null);
  assert.equal(exceed.separate, null);
  assert.equal(exceed.first_year_after_tax_krw, null);
  assert.ok(codes(res.notices).includes(REVERSE_NOTICE.OTHER_INCOME_UNKNOWN));
});

test('연금 외 소득을 주고 두 읽기가 같은 쪽을 가리키면 그때만 유불리가 나간다 (GC-P4 좌표)', () => {
  const res = run({
    profile: {
      // 사적연금 연 1,600만원 = 월 1,333,334 × 12에 가까운 값 대신 정확히 맞춘다.
      target_monthly_income_krw: 1_500_000,
      other_income: { state: 'known', annual_krw: 0 },
    },
  });
  const exceed = res.payout_strategies.find((s) => s.strategy_code === 'exceed_threshold');
  assert.equal(exceed.private_pension_annual_krw, 18_000_000);
  assert.equal(exceed.elective_opens, true);
  assert.equal(exceed.comparison_code, 'determined');
  assert.equal(exceed.lower_option_code, 'comprehensive');
  assert.ok(exceed.comprehensive.total_krw > 0);
  assert.equal(exceed.separate.basis_is_undetermined, true);
});

test('문턱을 넘지 않으면 §64조의4의 선택이 열리지 않는다 — 그 사실을 코드로 낸다', () => {
  const res = run({
    profile: {
      target_monthly_income_krw: 1_000_000,
      other_income: { state: 'known', annual_krw: 0 },
    },
  });
  const exceed = res.payout_strategies.find((s) => s.strategy_code === 'exceed_threshold');
  assert.equal(exceed.elective_opens, false);
  assert.equal(exceed.comparison_code, 'threshold_not_exceeded');
  assert.equal(exceed.lower_option_code, null);
});

test('AC-R20 — ISA 경과연수가 최소 연수 미만이면 전환 경로가 열리지 않았다는 사실만 낸다', () => {
  const res = run({
    accounts: { isa: { balance_krw: 10_000_000, years_since_opening: 2, cumulative_contribution_krw: 10_000_000 } },
  });
  const isa = res.payout_strategies.find((s) => s.strategy_code === 'isa_supplement');
  assert.equal(isa.pension_conversion_path.path_open, false);
  assert.equal(isa.pension_conversion_path.min_contract_years, 3);
  assert.equal(isa.conversion_consumes_threshold, false);
  assert.ok(codes(res.notices).includes(REVERSE_NOTICE.ISA_CONVERSION_PATH_NOT_OPEN));

  const open = run({
    accounts: { isa: { balance_krw: 10_000_000, years_since_opening: 3, cumulative_contribution_krw: 10_000_000 } },
  });
  const isaOpen = open.payout_strategies.find((s) => s.strategy_code === 'isa_supplement');
  assert.equal(isaOpen.pension_conversion_path.path_open, true);
  // 계약을 유지한 채 인출하는 경로는 3년 뒤를 조문이 규율하지 않는다 — 참도 거짓도 내지 않는다.
  assert.equal(isaOpen.contract_held_withdrawal.deemed_terminated, null);
});

// ── 사적연금 몫 ────────────────────────────────────────────────────────

test('사적연금이 채울 몫은 목표에서 국민연금을 뺀 것이고, 음수면 0과 사실 문구다', () => {
  const partial = run({
    profile: { public_pension: { plan: 'yes', expected_monthly_krw: 800_000 } },
  });
  assert.equal(partial.statutory_facts.target.private_pension_required_monthly_krw, 1_200_000);
  assert.equal(partial.statutory_facts.target.public_pension_covers_target, false);

  const covered = run({
    profile: { public_pension: { plan: 'yes', expected_monthly_krw: 3_000_000 } },
  });
  assert.equal(covered.statutory_facts.target.private_pension_required_monthly_krw, 0);
  assert.equal(covered.statutory_facts.target.public_pension_covers_target, true);
  assert.ok(codes(covered.notices).includes(REVERSE_NOTICE.PUBLIC_PENSION_COVERS_TARGET));
});

test('공적연금 개시 연령 규칙이 룰셋에 없으므로 공백 구간을 계산하지 않는다', () => {
  const res = run({ profile: { public_pension: { plan: 'yes', expected_monthly_krw: 800_000 } } });
  assert.equal(res.statutory_facts.target.public_pension_start_gap_evaluated, false);
  assert.ok(codes(res.notices).includes(REVERSE_NOTICE.PUBLIC_PENSION_START_AGE_NOT_IN_RULESET));
});

test('국민연금을 「예」로 답하지 않았는데 금액이 실려 오면 엔진이 고르지 않는다', () => {
  const res = computePensionReverse(
    request({ profile: { public_pension: { plan: 'no', expected_monthly_krw: 500_000 } } }),
    RULESETS,
  );
  assert.equal(res.ok, false);
  assert.ok(codes(res.errors).includes(ERROR.INVALID_ENUM));
});

// ── 가정 ────────────────────────────────────────────────────────────────

test('층 4를 열지 않았다는 사실과 기산연차 가정이 언제나 응답에 실린다', () => {
  const res = run({});
  const list = codes(res.assumptions);
  assert.ok(list.includes(REVERSE_ASSUMPTION.ZERO_GROWTH_FOR_CAP));
  assert.ok(list.includes(REVERSE_ASSUMPTION.LEVEL_ANNUAL_WITHDRAWAL));
  assert.ok(list.includes(REVERSE_ASSUMPTION.FIRST_WITHDRAWAL_YEAR_INDEX));
  assert.ok(list.includes(REVERSE_ASSUMPTION.TODAY_CURRENCY));
  assert.ok(list.includes(REVERSE_ASSUMPTION.LOWER_BOUNDS_ROUNDED_UP));
});

test('수익률 위의 가정은 그 블록이 있을 때만 실린다', () => {
  const withRate = codes(run({}).assumptions);
  assert.ok(withRate.includes(REVERSE_ASSUMPTION.RETURN_RATE_USER_SUPPLIED));
  assert.ok(withRate.includes(REVERSE_ASSUMPTION.MONTHLY_COMPOUNDING));

  const without = codes(run({ profile: { average_annual_return_rate: null } }).assumptions);
  assert.ok(!without.includes(REVERSE_ASSUMPTION.RETURN_RATE_USER_SUPPLIED));
  assert.ok(!without.includes(REVERSE_ASSUMPTION.MONTHLY_COMPOUNDING));
});

test('근거 목록에는 실제로 읽은 규칙만 실린다', () => {
  const res = run({});
  const ids = res.legal_basis.map((entry) => entry.rule_id);
  assert.ok(ids.includes('pension.withdrawal.annual_cap'));
  assert.ok(ids.includes('pension.income.separate_taxation.threshold'));
  assert.ok(ids.includes('pension.income.deduction'));
  // 적립 단계 전용 규칙(공제율)은 이 탭이 읽지 않으므로 근거에도 없다.
  assert.ok(!ids.includes('pension.credit.rate'));
  // 정렬은 코드 단위 비교이고 결정적이다.
  assert.deepEqual(ids, [...ids].sort());
});
