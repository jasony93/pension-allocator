// 연금 역산기(D77)의 진입점 — `computePensionReverse`.
//
// **순수 함수다.** 네트워크·파일 I/O·현재 시각을 읽지 않는다. 「오늘」조차 인자로 받는다
// (`as_of_date`) — 적립 기간이 오늘에 달려 있는데 시계를 읽으면 같은 입력이 다른 답을 낸다.
//
// **출력은 세 블록이고 성격이 다르다**(D77 판정 3 · requirements 9.2절).
//   ① 법정 사실 — **가정 0.** 수익률이 없어도 나온다. 조문의 계수와 나눗셈에서만 나온다.
//   ② 계좌별 월 납입 시나리오 — **사용자가 준 수익률 위에 통째로 선다.** 수익률이 없으면
//      이 블록 자체가 **없다.** 0으로 계산하지 않는다.
//   ③ 수령 전략 비교 — 서로 다른 법정 경로를 나란히 놓는다. **어느 것도 권하지 않는다.**
//
// **층 4를 열지 않는다.** 수령기 수익률은 입력에 없고, ①의 판정은 무성장 기준으로 고정된다.
// 그래서 ②의 수익률을 바꿔도 ①과 ③의 값은 한 원도 움직이지 않는다 —
// `echo.return_rate_affects`가 그 선언이고 시험이 그것을 문다.

import {
  ACCOUNT,
  ERROR,
  MONTHS_IN_TAX_YEAR,
  REVERSE_ASSUMPTION,
  REVERSE_NOTICE,
  RULE,
  SCHEMA_VERSION,
  SUPPORTED_MAJOR,
} from './constants.mjs';
import { addYears, ageOn, compareDates, parseIsoDate } from './dates.mjs';
import { buildLegalBasis } from './ruleset.mjs';
import { REVERSE_RULE, loadReverseRules } from './reverse-rules.mjs';
import { annualWithdrawalCap, minimumStartBalance } from './reverse-cap.mjs';
import {
  allocateMonthlyContribution,
  isaSourceMonthlyCap,
  monthlyContributionCeilings,
  requiredMonthlyContribution,
} from './reverse-accumulation.mjs';
import {
  comprehensiveOption,
  deferredRetirementRatio,
  electiveSeparateOption,
  isaDeemedTerminationOnWithdrawal,
  isaPensionConversionPath,
  isaPensionConversionPathAtStart,
  separateTaxationStatus,
  thresholdCountedAmount,
  withholdingOnPrivatePension,
} from './reverse-payout-tax.mjs';

/** 「1년은 12개월」. 달력의 사실이고 세법이 정한 값이 아니다. */
const MONTHS_PER_YEAR = MONTHS_IN_TAX_YEAR;

const PUBLIC_PENSION_PLANS = ['yes', 'no', 'unknown'];
const OTHER_INCOME_STATES = ['known', 'unknown'];
const START_KINDS = ['age', 'year'];

const err = (code, field, params = {}) => ({ code, field, params });
const notice = (code, severity, field, params = {}, basisRuleIds = []) => ({
  code,
  severity,
  field,
  params,
  basis_rule_ids: [...basisRuleIds].sort(),
});
const assume = (code, params = {}, basisRuleIds = []) => ({
  code,
  params,
  basis_rule_ids: [...basisRuleIds].sort(),
});

/**
 * 역산 진입점. 예외를 던지지 않는다 — 오류도 반환값이다.
 *
 * @param {object} request `engine-interface.md` 12절의 `PensionReverseRequest`
 * @param {object} rulesets 파일명 → 파싱된 룰셋
 */
export function computePensionReverse(request, rulesets) {
  const shape = validate(request);
  if (shape.errors.length > 0) {
    return { ok: false, schema_version: SCHEMA_VERSION, errors: shape.errors };
  }

  const loaded = loadReverseRules(rulesets, request.tax_year);
  if (loaded.errors.length > 0) {
    return { ok: false, schema_version: SCHEMA_VERSION, errors: loaded.errors };
  }
  const rules = loaded.rules;

  const derived = deriveTiming(shape.input, rules);
  if (derived.errors.length > 0) {
    return { ok: false, schema_version: SCHEMA_VERSION, errors: derived.errors };
  }

  const notices = [];
  const assumptions = [];
  const input = shape.input;

  // ── ISA 전환 판정 — 세 블록이 함께 쓴다 (D78 ④) ─────────────────────
  // **수익률을 읽지 않는다.** 그래서 이 판정이 블록 ①에 실려도 층 4가 열리지 않는다.
  const conversion = resolveIsaConversion(rules, input, derived, notices, assumptions);

  // ── 블록 ① 법정 사실 ────────────────────────────────────────────────
  const statutory = buildStatutoryFacts(rules, input, derived, conversion, notices, assumptions);

  // ── 블록 ② 계좌별 월 납입 시나리오 ──────────────────────────────────
  const scenario = buildContributionScenario(
    rules,
    input,
    derived,
    statutory,
    conversion,
    notices,
    assumptions,
  );

  // ── 블록 ③ 수령 전략 비교 ───────────────────────────────────────────
  const strategies = buildPayoutStrategies(rules, input, derived, statutory, conversion, notices);

  addStandingAssumptions(assumptions, input);

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    echo: {
      as_of_date: input.as_of_date,
      annuity_start_date: derived.startDateIso,
      annuity_start_age_years: derived.startAge,
      accumulation_months: derived.accumulationMonths,
      payout_years: input.payout_years,
      average_annual_return_rate: input.average_annual_return_rate,
      /**
       * **수익률이 무엇을 바꾸고 무엇을 안 바꾸는가의 선언.** 층 4 금지의 기계가 읽을 수
       * 있는 표현이고, 불변식 시험이 두 응답을 맞대어 이 선언이 참인지 확인한다.
       */
      return_rate_affects: {
        statutory_facts: false,
        payout_strategies: false,
        contribution_scenario: true,
      },
    },
    statutory_facts: statutory.block,
    contribution_scenario: scenario.block,
    contribution_scenario_absent_reason_code: scenario.absentReasonCode,
    payout_strategies: strategies,
    assumptions,
    notices,
    legal_basis: buildLegalBasis(rules.access),
  };
}

// ── 입력 검증 ───────────────────────────────────────────────────────────

function validate(request) {
  const errors = [];
  if (request === null || typeof request !== 'object') {
    return { errors: [err(ERROR.MISSING_REQUIRED, null)], input: null };
  }

  const major = String(request.schema_version ?? '').split('.')[0];
  if (request.schema_version === undefined || request.schema_version === null) {
    errors.push(err(ERROR.MISSING_REQUIRED, 'schema_version'));
  } else if (major !== String(SUPPORTED_MAJOR)) {
    errors.push(err(ERROR.SCHEMA_VERSION_MISMATCH, 'schema_version', { supported_major: SUPPORTED_MAJOR }));
  }
  if (!Number.isSafeInteger(request.tax_year)) errors.push(err(ERROR.MISSING_REQUIRED, 'tax_year'));

  const asOf = parseIsoDate(request.as_of_date);
  if (request.as_of_date === undefined || request.as_of_date === null) {
    errors.push(err(ERROR.MISSING_REQUIRED, 'as_of_date'));
  } else if (asOf === null) {
    errors.push(err(ERROR.INVALID_DATE, 'as_of_date'));
  }

  const profile = request.profile ?? null;
  if (profile === null || typeof profile !== 'object') {
    errors.push(err(ERROR.MISSING_REQUIRED, 'profile'));
    return { errors, input: null };
  }

  const birth = parseIsoDate(profile.birth_date);
  if (profile.birth_date === undefined || profile.birth_date === null) {
    errors.push(err(ERROR.MISSING_REQUIRED, 'profile.birth_date'));
  } else if (birth === null) {
    errors.push(err(ERROR.INVALID_DATE, 'profile.birth_date'));
  } else if (asOf !== null && compareDates(birth, asOf) > 0) {
    errors.push(err(ERROR.OUT_OF_RANGE, 'profile.birth_date'));
  }

  requireInteger(errors, profile.target_monthly_income_krw, 'profile.target_monthly_income_krw', {
    minimum: 1,
  });
  requireInteger(errors, profile.payout_years, 'profile.payout_years', { minimum: 1 });

  const start = profile.annuity_start ?? null;
  if (start === null || typeof start !== 'object') {
    errors.push(err(ERROR.MISSING_REQUIRED, 'profile.annuity_start'));
  } else if (!START_KINDS.includes(start.kind)) {
    errors.push(err(ERROR.INVALID_ENUM, 'profile.annuity_start.kind', { allowed: START_KINDS }));
  } else if (start.kind === 'age') {
    requireInteger(errors, start.age_years, 'profile.annuity_start.age_years', { minimum: 0 });
  } else {
    requireInteger(errors, start.year, 'profile.annuity_start.year', { minimum: 0 });
  }

  const rate = profile.average_annual_return_rate ?? null;
  if (rate !== null) {
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      errors.push(err(ERROR.NOT_INTEGER, 'profile.average_annual_return_rate'));
    } else if (rate < 0) {
      errors.push(err(ERROR.NEGATIVE_VALUE, 'profile.average_annual_return_rate'));
    }
  }

  const publicPension = profile.public_pension ?? { plan: 'unknown', expected_monthly_krw: null };
  if (!PUBLIC_PENSION_PLANS.includes(publicPension.plan)) {
    errors.push(err(ERROR.INVALID_ENUM, 'profile.public_pension.plan', { allowed: PUBLIC_PENSION_PLANS }));
  } else if (publicPension.plan === 'yes') {
    requireInteger(errors, publicPension.expected_monthly_krw, 'profile.public_pension.expected_monthly_krw', {
      minimum: 0,
    });
  } else if ((publicPension.expected_monthly_krw ?? null) !== null) {
    // 「예」가 아닌데 금액이 실려 오면 둘 중 무엇이 사용자의 답인지 엔진이 고르지 않는다.
    errors.push(err(ERROR.INVALID_ENUM, 'profile.public_pension.expected_monthly_krw'));
  }

  const otherIncome = profile.other_income ?? { state: 'unknown', annual_krw: null };
  if (!OTHER_INCOME_STATES.includes(otherIncome.state)) {
    errors.push(err(ERROR.INVALID_ENUM, 'profile.other_income.state', { allowed: OTHER_INCOME_STATES }));
  } else if (otherIncome.state === 'known') {
    requireInteger(errors, otherIncome.annual_krw, 'profile.other_income.annual_krw', { minimum: 0 });
  } else if ((otherIncome.annual_krw ?? null) !== null) {
    errors.push(err(ERROR.INVALID_ENUM, 'profile.other_income.annual_krw'));
  }

  const deferred = profile.deferred_retirement ?? { present: null, amount_krw: null };
  if (deferred.present !== null && typeof deferred.present !== 'boolean') {
    errors.push(err(ERROR.INVALID_ENUM, 'profile.deferred_retirement.present'));
  } else if (deferred.present === true) {
    requireInteger(errors, deferred.amount_krw, 'profile.deferred_retirement.amount_krw', { minimum: 0 });
  } else if ((deferred.amount_krw ?? null) !== null) {
    errors.push(err(ERROR.INVALID_ENUM, 'profile.deferred_retirement.amount_krw'));
  }

  const accounts = request.accounts ?? null;
  if (accounts === null || typeof accounts !== 'object') {
    errors.push(err(ERROR.MISSING_REQUIRED, 'accounts'));
    return { errors, input: null };
  }
  for (const key of [ACCOUNT.ANNUITY, ACCOUNT.PENSION, ACCOUNT.ISA]) {
    requireInteger(errors, accounts[key]?.balance_krw, `accounts.${key}.balance_krw`, { minimum: 0 });
  }
  optionalInteger(errors, accounts[ACCOUNT.ISA]?.years_since_opening, 'accounts.isa.years_since_opening');
  optionalInteger(
    errors,
    accounts[ACCOUNT.ISA]?.cumulative_contribution_krw,
    'accounts.isa.cumulative_contribution_krw',
  );

  // **전환 계획은 예·아니오·미응답의 셋이다**(D78 ④). `null`은 「아니오」가 아니라
  // **답하지 않았다**이고, 둘을 같은 값으로 접으면 「물었는데 아니라고 했다」와
  // 「묻지 않았다」를 구별할 수 없게 된다.
  const conversionPlanned = accounts[ACCOUNT.ISA]?.conversion_planned ?? null;
  if (conversionPlanned !== null && typeof conversionPlanned !== 'boolean') {
    errors.push(err(ERROR.INVALID_ENUM, 'accounts.isa.conversion_planned'));
  }

  if (errors.length > 0) return { errors, input: null };

  return {
    errors,
    input: {
      as_of_date: request.as_of_date,
      asOf,
      birth,
      tax_year: request.tax_year,
      target_monthly_income_krw: profile.target_monthly_income_krw,
      payout_years: profile.payout_years,
      annuity_start: start,
      average_annual_return_rate: rate,
      public_pension: {
        plan: publicPension.plan,
        expected_monthly_krw: publicPension.plan === 'yes' ? publicPension.expected_monthly_krw : null,
      },
      other_income: {
        state: otherIncome.state,
        annual_krw: otherIncome.state === 'known' ? otherIncome.annual_krw : null,
      },
      deferred_retirement: {
        present: deferred.present === true,
        amount_krw: deferred.present === true ? deferred.amount_krw : 0,
      },
      accounts: {
        [ACCOUNT.ANNUITY]: { balance_krw: accounts[ACCOUNT.ANNUITY].balance_krw },
        [ACCOUNT.PENSION]: { balance_krw: accounts[ACCOUNT.PENSION].balance_krw },
        [ACCOUNT.ISA]: {
          balance_krw: accounts[ACCOUNT.ISA].balance_krw,
          years_since_opening: accounts[ACCOUNT.ISA].years_since_opening ?? null,
          cumulative_contribution_krw: accounts[ACCOUNT.ISA].cumulative_contribution_krw ?? null,
          conversion_planned: conversionPlanned,
        },
      },
    },
  };
}

function requireInteger(errors, value, field, { minimum }) {
  if (value === undefined || value === null) {
    errors.push(err(ERROR.MISSING_REQUIRED, field));
    return;
  }
  if (!Number.isSafeInteger(value)) {
    errors.push(err(ERROR.NOT_INTEGER, field));
    return;
  }
  if (value < 0) errors.push(err(ERROR.NEGATIVE_VALUE, field));
  else if (value < minimum) errors.push(err(ERROR.OUT_OF_RANGE, field, { minimum }));
}

function optionalInteger(errors, value, field) {
  if (value === undefined || value === null) return;
  if (!Number.isSafeInteger(value)) errors.push(err(ERROR.NOT_INTEGER, field));
  else if (value < 0) errors.push(err(ERROR.NEGATIVE_VALUE, field));
}

// ── 개시 시점과 적립 기간 ───────────────────────────────────────────────

/**
 * 개시 시점을 하나의 날짜로 정한다.
 *
 * **나이로 답한 경우**는 그 나이가 되는 생일이고, **연도로 답한 경우**는 그 해의 생일이다.
 * 생일을 고른 것은 만 나이가 생일에 오르기 때문이고(이 저장소의 `ageOn`이 그렇게 센다),
 * 그러면 **개시가 속한 과세기간 안에서 연령 구간을 넘는 일이 생기지 않는다** — 룰셋이
 * 미확정으로 남긴 「과세기간 중 생일을 지나는 해의 세율」 물음을 피해 가는 자리다.
 * 이 선택은 세법이 정한 것이 아니므로 가정으로 응답에 실린다.
 */
function deriveTiming(input, rules) {
  const errors = [];
  const start =
    input.annuity_start.kind === 'age'
      ? addYears(input.birth, input.annuity_start.age_years)
      : addYears(input.birth, input.annuity_start.year - input.birth.year);

  const startAge = ageOn(input.birth, start);
  if (startAge < rules.minStartAge) {
    errors.push(
      err(ERROR.ANNUITY_START_BELOW_MIN_AGE, 'profile.annuity_start', {
        minimum_age_years: rules.minStartAge,
        start_age_years: startAge,
        basis_rule_ids: [RULE.PENSION_WITHDRAWAL_ELIGIBILITY],
      }),
    );
  }

  let months =
    (start.year - input.asOf.year) * MONTHS_PER_YEAR + (start.month - input.asOf.month);
  if (start.day < input.asOf.day) months -= 1;

  return {
    errors,
    start,
    startDateIso: `${String(start.year).padStart(4, '0')}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}`,
    startAge,
    accumulationMonths: months,
  };
}

// ── ISA 전환 판정 (D78 ④) ───────────────────────────────────────────────

/**
 * **ISA를 개시 시점 필요 평가액의 재원으로 세는가, 세지 않는다면 왜인가.**
 *
 * ISA에 있는 돈은 그 자체로 연금계좌의 평가액이 아니다 — 개시 시점에 **연금계좌로
 * 전환**돼야 비로소 연금수령한도가 딛는 평가액이 된다. 그래서 재원 여부를 가르는 것은
 * 잔액이 아니라 **사용자의 전환 계획**이고, 그 계획이 서려면 조문의 요건도 서야 한다.
 *
 * 셋 중 하나다.
 *  · **예 + 개시 시점에 의무가입기간 충족** → 재원이다. 잔액도 월 납입도 목표를 채운다.
 *  · **예 + 개시 시점에도 미충족** → 재원이 **아니다.** 그때 전환할 수 없기 때문이고,
 *    그 사실을 안내로 낸다. **「전환하면 됩니다」라고 적지 않는다.**
 *  · **아니오 · 미응답** → 재원이 아니다. 미응답은 「아니오」와 같은 수를 내되 **답하지
 *    않았다는 사실**을 안내로 남긴다 — 답이 바뀌면 금액이 바뀌기 때문이다.
 *
 * **수익률을 읽지 않는다.** 이 판정이 블록 ①에 실려도 층 4는 열리지 않는다.
 */
function resolveIsaConversion(rules, input, derived, notices, assumptions) {
  const isa = input.accounts[ACCOUNT.ISA];
  const planned = isa.conversion_planned;
  const pathAtStart = isaPensionConversionPathAtStart(rules, {
    yearsSinceOpening: isa.years_since_opening,
    monthsUntilStart: derived.accumulationMonths,
  });
  // **ISA 보유의 신호.** 잔액도 경과연수도 누적 납입액도 없는 사람에게 전환을 묻는 안내는
  // 없는 계좌 이야기가 된다 — 이 저장소가 「없는 제약을 말하지 않는다」로 지켜 온 선이다.
  const present =
    isa.balance_krw > 0 ||
    isa.years_since_opening !== null ||
    isa.cumulative_contribution_krw !== null;

  let excludedReasonCode = null;
  if (planned !== true) {
    excludedReasonCode = planned === false ? 'conversion_not_planned' : 'conversion_not_declared';
  } else if (!pathAtStart.path_open) {
    excludedReasonCode = 'conversion_not_eligible_at_annuity_start';
  }
  const counted = excludedReasonCode === null;

  if (planned === null && present) {
    notices.push(
      notice(REVERSE_NOTICE.ISA_CONVERSION_NOT_DECLARED, 'info', 'accounts.isa.conversion_planned', {}, [
        RULE.CREDIT_TRANSFER_EXTRA,
        RULE.ISA_ACCOUNT_REQUIREMENTS,
      ]),
    );
  }
  if (excludedReasonCode === 'conversion_not_eligible_at_annuity_start') {
    notices.push(
      notice(
        REVERSE_NOTICE.ISA_CONVERSION_NOT_ELIGIBLE_AT_START,
        'warning',
        'accounts.isa.years_since_opening',
        {
          min_contract_years: pathAtStart.min_contract_years,
          years_since_opening: isa.years_since_opening,
          years_since_opening_at_annuity_start: pathAtStart.years_since_opening_at_annuity_start,
        },
        [RULE.ISA_ACCOUNT_REQUIREMENTS, RULE.CREDIT_TRANSFER_EXTRA],
      ),
    );
  }
  if (counted) {
    assumptions.push(
      assume(REVERSE_ASSUMPTION.ISA_CONTRACT_HELD_TO_START, {}, [RULE.ISA_ACCOUNT_REQUIREMENTS]),
    );
  }

  return {
    planned,
    present,
    counted,
    path_at_start: pathAtStart,
    excluded_reason_code: excludedReasonCode,
  };
}

// ── 블록 ① ─────────────────────────────────────────────────────────────

function buildStatutoryFacts(rules, input, derived, conversion, notices, assumptions) {
  const targetAnnual = input.target_monthly_income_krw * MONTHS_PER_YEAR;
  const publicMonthly = input.public_pension.expected_monthly_krw;
  const privateMonthly = publicMonthly === null ? input.target_monthly_income_krw : Math.max(0, input.target_monthly_income_krw - publicMonthly);
  const privateAnnual = privateMonthly * MONTHS_PER_YEAR;

  if (publicMonthly === null) {
    notices.push(
      notice(REVERSE_NOTICE.PUBLIC_PENSION_NOT_SUPPLIED, 'info', 'profile.public_pension.plan', {
        plan: input.public_pension.plan,
      }),
    );
  } else if (privateMonthly === 0) {
    notices.push(
      notice(REVERSE_NOTICE.PUBLIC_PENSION_COVERS_TARGET, 'info', 'profile.public_pension.expected_monthly_krw', {
        public_monthly_krw: publicMonthly,
        target_monthly_krw: input.target_monthly_income_krw,
      }),
    );
    // 공적연금 개시 연령을 정한 규칙이 룰셋에 없다. **없으면 없는 것이다** — 공백 구간을
    // 계산하지 않고, 계산하지 않았다는 사실을 낸다.
    notices.push(
      notice(REVERSE_NOTICE.PUBLIC_PENSION_START_AGE_NOT_IN_RULESET, 'info', 'profile.public_pension', {}),
    );
  } else {
    notices.push(
      notice(REVERSE_NOTICE.PUBLIC_PENSION_START_AGE_NOT_IN_RULESET, 'info', 'profile.public_pension', {}),
    );
  }

  const floors = minimumStartBalance(rules, {
    annualWithdrawalKrw: privateAnnual,
    payoutYears: input.payout_years,
  });

  if (floors.cap_binds_before_balance) {
    notices.push(
      notice(
        REVERSE_NOTICE.ANNUAL_CAP_BINDS_FIRST,
        'warning',
        'profile.payout_years',
        {
          payout_years: input.payout_years,
          min_payout_years_without_cap_binding: floors.min_payout_years_without_cap_binding,
          annual_cap_floor_krw: floors.annual_cap_floor_krw,
          remaining_balance_floor_krw: floors.remaining_balance_floor_krw,
        },
        [REVERSE_RULE.ANNUAL_CAP],
      ),
    );
  }

  assumptions.push(
    assume(REVERSE_ASSUMPTION.ZERO_GROWTH_FOR_CAP, {}, [REVERSE_RULE.ANNUAL_CAP]),
    assume(REVERSE_ASSUMPTION.LEVEL_ANNUAL_WITHDRAWAL, {}, [REVERSE_RULE.ANNUAL_CAP]),
    assume(
      REVERSE_ASSUMPTION.FIRST_WITHDRAWAL_YEAR_INDEX,
      { withdrawal_year_index: 1 },
      [REVERSE_RULE.ANNUAL_CAP],
    ),
    assume(REVERSE_ASSUMPTION.LOWER_BOUNDS_ROUNDED_UP, {}, []),
  );

  const pensionBalance =
    input.accounts[ACCOUNT.ANNUITY].balance_krw + input.accounts[ACCOUNT.PENSION].balance_krw;

  const ceilings = monthlyContributionCeilings(rules, {
    isaYearsSinceOpening: input.accounts[ACCOUNT.ISA].years_since_opening,
    isaCumulativeKrw: input.accounts[ACCOUNT.ISA].cumulative_contribution_krw,
  });
  if (input.accounts[ACCOUNT.ISA].cumulative_contribution_krw === null) {
    assumptions.push(assume(REVERSE_ASSUMPTION.ISA_CUMULATIVE_ZERO, {}, [RULE.ISA_ANNUAL_LIMIT]));
  }
  if (input.accounts[ACCOUNT.ISA].years_since_opening === null) {
    notices.push(notice(REVERSE_NOTICE.ISA_TENURE_MISSING, 'warning', 'accounts.isa.years_since_opening', {}, [
      RULE.ISA_ANNUAL_LIMIT,
    ]));
  }

  // **전환금은 문턱을 쓰지 않는데, 그것이 수령액의 어느 몫인지를 정한 규칙이 없다.**
  // 인출 순서(과세제외금액이 먼저)는 룰셋에 있지만 그것을 연차별 수령액에 나누는 규칙은
  // 없다. **없으면 없는 것이므로** 문턱에 세어지는 금액을 줄이지 않고, 줄이지 않았다는
  // 사실을 낸다 — 문턱을 크게 잡는 방향이다.
  if (conversion.counted && (input.accounts[ACCOUNT.ISA].balance_krw > 0 || ceilings.isa_monthly_krw > 0)) {
    notices.push(
      notice(
        REVERSE_NOTICE.ISA_CONVERSION_THRESHOLD_SHARE_NOT_APPORTIONED,
        'info',
        'accounts.isa.conversion_planned',
        {},
        [RULE.PENSION_NON_DEDUCTED_PRINCIPAL, RULE.PENSION_SEPARATE_TAXATION_THRESHOLD],
      ),
    );
  }

  const counted = thresholdCountedAmount(rules, {
    taxCreditedAndReturnKrw: privateAnnual,
    deferredRetirementKrw: input.deferred_retirement.amount_krw,
    nonTaxablePrincipalKrw: 0,
    isaConversionKrw: 0,
  });
  const thresholdStatus = separateTaxationStatus(rules, { privatePensionAnnualKrw: counted });

  const rows = [
    {
      source_code: 'tax_credited_contribution_and_return',
      consumes_threshold: true,
      in_plan: true,
      basis_rule_ids: [RULE.PENSION_SEPARATE_TAXATION_THRESHOLD].sort(),
    },
    {
      source_code: 'isa_conversion_amount',
      consumes_threshold: false,
      // **이 계획에 전환금이 실제로 들어가는가.** 「문턱을 안 쓴다」는 언제나 참이고,
      // 「이 사람의 계획에 있다」는 전환을 예로 답했고 그때 전환할 수 있을 때만 참이다.
      in_plan: conversion.counted,
      basis_rule_ids: [RULE.PENSION_NON_DEDUCTED_PRINCIPAL, RULE.CREDIT_TRANSFER_EXTRA].sort(),
    },
  ];
  if (input.deferred_retirement.present) {
    rows.push({
      source_code: 'deferred_retirement_income',
      consumes_threshold: false,
      in_plan: true,
      basis_rule_ids: [REVERSE_RULE.DEFERRED_RETIREMENT_RATE, RULE.PENSION_SEPARATE_TAXATION_THRESHOLD].sort(),
    });
    notices.push(
      notice(
        REVERSE_NOTICE.DEFERRED_BASE_RATE_OUT_OF_SCOPE,
        'info',
        'profile.deferred_retirement.amount_krw',
        {},
        [REVERSE_RULE.DEFERRED_RETIREMENT_RATE],
      ),
    );
  }

  const deferredRatio = input.deferred_retirement.present
    ? deferredRetirementRatio(rules, { actualPayoutYearIndex: input.payout_years })
    : null;

  return {
    privateAnnual,
    privateMonthly,
    publicAnnual: publicMonthly === null ? 0 : publicMonthly * MONTHS_PER_YEAR,
    ceilings,
    thresholdStatus,
    block: {
      ruleset: { tax_year: rules.taxYear, files: [...rules.files].sort() },
      target: {
        target_monthly_krw: input.target_monthly_income_krw,
        target_annual_krw: targetAnnual,
        public_pension_monthly_krw: publicMonthly,
        private_pension_required_monthly_krw: privateMonthly,
        private_pension_required_annual_krw: privateAnnual,
        public_pension_covers_target: publicMonthly === null ? null : privateMonthly === 0,
        public_pension_start_gap_evaluated: false,
      },
      minimum_start_balance: {
        ...floors,
        withdrawal_year_index: 1,
        basis_rule_ids: [REVERSE_RULE.ANNUAL_CAP, RULE.PENSION_WITHDRAWAL_ELIGIBILITY].sort(),
      },
      target_feasibility: {
        holds_if_start_balance_at_least_krw: floors.required_krw,
        binding_code: floors.binding_code,
        cap_binds_before_balance: floors.cap_binds_before_balance,
        min_payout_years_without_cap_binding: floors.min_payout_years_without_cap_binding,
        current_pension_balance_krw: pensionBalance,
        deferred_retirement_krw: input.deferred_retirement.amount_krw,
        // 지금 잔액만으로 첫해에 연금수령할 수 있는 최대 금액. **가정이 하나도 없다.**
        max_first_year_withdrawal_at_current_balance_krw: annualWithdrawalCap(rules, {
          balanceKrw: pensionBalance + input.deferred_retirement.amount_krw,
          withdrawalYearIndex: 1,
        }),
      },
      threshold_consumption: {
        threshold_krw: thresholdStatus.threshold_krw,
        counted_annual_krw: thresholdStatus.counted_krw,
        within_threshold: thresholdStatus.within_threshold,
        elective_opens: thresholdStatus.elective_opens,
        rows,
        deferred_retirement_ratio: deferredRatio,
      },
      contribution_ceiling: {
        ...ceilings,
        // **한도는 셋 다 법정 사실이지만, 그중 ISA가 이 계획의 재원인지는 따로 적는다**
        // (D78 ④). 화면이 그 둘을 섞으면 「넣을 수 있다」와 「넣으면 목표에 닿는다」가
        // 한 문장이 된다.
        isa_counted_as_start_source: conversion.counted,
        isa_source_excluded_reason_code: conversion.excluded_reason_code,
        basis_rule_ids: [RULE.PENSION_CONTRIBUTION_LIMIT, RULE.ISA_ANNUAL_LIMIT, RULE.ISA_ACCOUNT_REQUIREMENTS].sort(),
      },
    },
  };
}

// ── 블록 ② ─────────────────────────────────────────────────────────────

function buildContributionScenario(rules, input, derived, statutory, conversion, notices, assumptions) {
  if (input.average_annual_return_rate === null) {
    notices.push(
      notice(REVERSE_NOTICE.RETURN_RATE_NOT_SUPPLIED, 'info', 'profile.average_annual_return_rate', {}),
    );
    return { block: null, absentReasonCode: 'return_rate_not_supplied' };
  }
  if (derived.accumulationMonths <= 0) {
    notices.push(
      notice(REVERSE_NOTICE.ACCUMULATION_PERIOD_NOT_POSITIVE, 'info', 'profile.annuity_start', {
        accumulation_months: derived.accumulationMonths,
      }),
    );
    return { block: null, absentReasonCode: 'accumulation_period_not_positive' };
  }

  const targetKrw = statutory.block.minimum_start_balance.required_krw;
  const isa = input.accounts[ACCOUNT.ISA];
  const pensionBalance =
    input.accounts[ACCOUNT.ANNUITY].balance_krw + input.accounts[ACCOUNT.PENSION].balance_krw;
  // **전환하지 않을 ISA 잔액은 목표를 채우지 않는다.** 0으로 넣는 것이 그 사실이다.
  const isaSourceBalance = conversion.counted ? isa.balance_krw : 0;

  const required = requiredMonthlyContribution(rules, {
    targetKrw,
    currentBalanceKrw: pensionBalance,
    isaBalanceKrw: isaSourceBalance,
    lumpSumAtStartKrw: input.deferred_retirement.amount_krw,
    annualReturnRate: input.average_annual_return_rate,
    months: derived.accumulationMonths,
  });

  if (required.already_funded) {
    notices.push(notice(REVERSE_NOTICE.TARGET_ALREADY_FUNDED, 'info', null, { target_krw: targetKrw }));
  }

  // ISA에 앉힐 수 있는 월 몫. **재원이 아니면 자리 자체가 없다**(`null`).
  const isaCap = conversion.counted
    ? isaSourceMonthlyCap(rules, {
        isaYearsSinceOpening: isa.years_since_opening,
        isaCumulativeKrw: isa.cumulative_contribution_krw,
        accumulationMonths: derived.accumulationMonths,
      })
    : null;

  const allocation = allocateMonthlyContribution(rules, {
    requiredMonthlyKrw: required.monthly_krw,
    isaYearsSinceOpening: isa.years_since_opening,
    isaCumulativeKrw: isa.cumulative_contribution_krw,
    isaSource: isaCap === null ? null : { monthly_krw: isaCap.monthly_krw },
  });

  if (isaCap !== null) {
    assumptions.push(assume(REVERSE_ASSUMPTION.ISA_TOTAL_LIMIT_SPREAD, {}, [RULE.ISA_ACCOUNT_REQUIREMENTS]));
    if (isaCap.capped_by_total_contribution_limit) {
      notices.push(
        notice(
          REVERSE_NOTICE.ISA_SOURCE_CAPPED_BY_TOTAL_LIMIT,
          'info',
          'accounts.isa.cumulative_contribution_krw',
          {
            remaining_total_limit_krw: isaCap.remaining_total_limit_krw,
            isa_source_monthly_krw: isaCap.monthly_krw,
            accumulation_months: derived.accumulationMonths,
          },
          [RULE.ISA_ACCOUNT_REQUIREMENTS, RULE.ISA_ANNUAL_LIMIT],
        ),
      );
    }
  }

  if (allocation.exceeds_statutory_ceiling) {
    notices.push(
      notice(
        REVERSE_NOTICE.EXCEEDS_CONTRIBUTION_CEILING,
        'warning',
        null,
        {
          required_monthly_krw: required.monthly_krw,
          ceiling_monthly_krw: allocation.source_ceiling_monthly_krw,
          unallocatable_monthly_krw: allocation.unallocatable_monthly_krw,
        },
        [RULE.PENSION_CONTRIBUTION_LIMIT, RULE.ISA_ANNUAL_LIMIT],
      ),
    );
  }

  assumptions.push(
    assume(REVERSE_ASSUMPTION.RETURN_RATE_USER_SUPPLIED, {
      annual_return_rate: input.average_annual_return_rate,
    }),
    assume(REVERSE_ASSUMPTION.MONTHLY_COMPOUNDING, { periods_per_year: MONTHS_PER_YEAR }),
    // **1단계의 상한이 조문이 정한 상한보다 클 수 있다.** 조문의 상한은 「공제 한도와
    // §61③ 세액 한도 중 실제로 공제를 낳는 쪽」인데 세액 한도는 산출세액의 함수이고
    // **이 탭은 총급여를 받지 않는다.** 입력을 늘리는 대신 적용하지 않았고, 그 사실을
    // **적용하지 않은 규칙의 이름과 함께** 낸다 — 근거 목록에는 싣지 않는다(읽지 않았다).
    assume(REVERSE_ASSUMPTION.TAX_LIABILITY_CAP_NOT_APPLIED, {
      rule_id_not_applied: RULE.CREDIT_TAX_CAP,
    }),
  );
  if (input.deferred_retirement.present) {
    assumptions.push(assume(REVERSE_ASSUMPTION.DEFERRED_NOT_GROWN, {}));
  }

  return {
    absentReasonCode: null,
    block: {
      condition_clause: {
        annual_return_rate: input.average_annual_return_rate,
        is_user_supplied: true,
        compounding_code: 'monthly',
      },
      accumulation_months: derived.accumulationMonths,
      target_balance_krw: targetKrw,
      existing_pension_balance_krw: pensionBalance,
      future_value_of_existing_krw: required.future_value_of_existing_krw,
      // ── ISA 전환 재원 (D78 ④) ──
      // **재원이 아니면 두 칸이 0이다.** 「ISA 잔액이 0원이다」가 아니라 「이 계획에서
      // 목표를 채우는 몫이 0원이다」이고, 잔액 자체는 블록 ③의 카드가 그대로 낸다.
      isa_counted_as_start_source: conversion.counted,
      isa_source_excluded_reason_code: conversion.excluded_reason_code,
      existing_isa_balance_krw: isaSourceBalance,
      future_value_of_existing_isa_krw: required.future_value_of_existing_isa_krw,
      deferred_retirement_krw: input.deferred_retirement.amount_krw,
      gap_krw: required.gap_krw,
      required_monthly_total_krw: required.monthly_krw,
      allocations: allocation.allocations,
      // **순서가 조건에 따라 뒤집힌다**(32.5절). 전환 근거가 서면 ISA가 연금계좌 초과분보다
      // 앞이고, 서지 않으면 뒤다. **세법이 정한 순서가 아니라는 사실을 값으로 낸다** —
      // 화면이 「법이 이 순서를 정한다」로 적으면 32.6절 1번을 어긴다.
      fill_order: {
        variant_code: allocation.fill_order_variant_code,
        is_statutory_order: false,
        basis_rule_ids: [
          RULE.CREDIT_LIMIT_ANNUITY,
          RULE.CREDIT_LIMIT_COMBINED,
          RULE.CREDIT_UNUSED_CARRYOVER,
          RULE.CREDIT_TRANSFER_EXTRA,
          RULE.PENSION_BEYOND_CREDIT_LIMIT,
          RULE.PENSION_NON_DEDUCTED_PRINCIPAL,
        ].sort(),
      },
      allocated_monthly_total_krw: allocation.allocated_monthly_total_krw,
      unallocatable_monthly_krw: allocation.unallocatable_monthly_krw,
      // **넘었는지를 재는 자.** 재원으로 쓸 수 있는 계좌의 상한 합계이고, ISA가 재원이
      // 아니면 연금 두 계좌의 몫뿐이다.
      source_ceiling_monthly_krw: allocation.source_ceiling_monthly_krw,
      exceeds_statutory_contribution_ceiling: allocation.exceeds_statutory_ceiling,
    },
  };
}

// ── 블록 ③ ─────────────────────────────────────────────────────────────

function buildPayoutStrategies(rules, input, derived, statutory, conversion, notices) {
  const privateAnnual = statutory.privateAnnual;
  const publicAnnual = statutory.publicAnnual;
  const strategies = [];

  const crossings = bracketCrossingsWithin(rules, derived.startAge, input.payout_years);
  if (crossings.length > 0) {
    notices.push(
      notice(
        REVERSE_NOTICE.WITHHOLDING_RATE_VARIES,
        'info',
        null,
        { crossing_ages: crossings },
        [RULE.PENSION_INCOME_RATE_BY_AGE],
      ),
    );
  }

  // ① 문턱 이내 유지
  const withinAmount = Math.min(privateAnnual, rules.thresholdKrw);
  const withinWithholding = withholdingOnPrivatePension(rules, {
    annualKrw: withinAmount,
    ageYears: derived.startAge,
  });
  strategies.push({
    strategy_code: 'within_threshold',
    private_pension_annual_krw: withinAmount,
    uncovered_annual_krw: Math.max(0, privateAnnual - rules.thresholdKrw),
    first_year_withholding: withinWithholding,
    settles_with_withholding: true,
    first_year_after_tax_krw: withinAmount - withinWithholding.total_krw,
    basis_rule_ids: [RULE.PENSION_SEPARATE_TAXATION_THRESHOLD, RULE.PENSION_INCOME_RATE_BY_AGE, RULE.LOCAL_SURTAX].sort(),
  });

  // ② 문턱 초과 감수
  const exceedWithholding = withholdingOnPrivatePension(rules, {
    annualKrw: privateAnnual,
    ageYears: derived.startAge,
  });
  const status = separateTaxationStatus(rules, { privatePensionAnnualKrw: privateAnnual });
  const exceed = {
    strategy_code: 'exceed_threshold',
    private_pension_annual_krw: privateAnnual,
    elective_opens: status.elective_opens,
    elective_base_krw: status.elective_base_krw,
    first_year_withholding: exceedWithholding,
    comprehensive: null,
    separate: null,
    comparison_code: null,
    lower_option_code: null,
    first_year_after_tax_krw: null,
    basis_rule_ids: [
      RULE.PENSION_SEPARATE_TAXATION_THRESHOLD,
      RULE.PENSION_SEPARATE_TAXATION_ELECTIVE,
      REVERSE_RULE.INCOME_DEDUCTION,
      RULE.BASIC_TAX_RATE,
      RULE.BASIC_DEDUCTION_SELF,
      RULE.LOCAL_SURTAX,
    ].sort(),
  };

  if (!status.elective_opens) {
    exceed.comparison_code = 'threshold_not_exceeded';
  } else if (input.other_income.state !== 'known') {
    // **유불리를 판정하지 않는다.** 이 갈림의 축은 연금 총액이 아니라 연금 외 종합소득이고,
    // 그 값을 받지 않은 화면은 어느 쪽이 유리한지 말할 수 없다.
    exceed.comparison_code = 'other_income_unknown';
    notices.push(
      notice(REVERSE_NOTICE.OTHER_INCOME_UNKNOWN, 'info', 'profile.other_income.state', {}, [
        RULE.PENSION_SEPARATE_TAXATION_ELECTIVE,
      ]),
    );
  } else {
    const args = {
      privateAnnualKrw: privateAnnual,
      publicAnnualKrw: publicAnnual,
      otherGlobalIncomeKrw: input.other_income.annual_krw,
    };
    exceed.comprehensive = comprehensiveOption(rules, args);
    exceed.separate = electiveSeparateOption(rules, args);

    const decidable =
      exceed.separate.readings_agree_on_lower_option &&
      !exceed.separate.public_pension_share_not_apportioned &&
      !exceed.separate.remainder_is_undetermined;

    if (decidable) {
      exceed.comparison_code = 'determined';
      exceed.lower_option_code = exceed.separate.lower_option_code;
      const lower =
        exceed.lower_option_code === 'comprehensive'
          ? exceed.comprehensive.total_krw
          : exceed.separate.reading_a.total_krw;
      exceed.first_year_after_tax_krw = privateAnnual - lower;
    } else {
      // **미확정 좌표다.** 두 읽기가 다른 쪽을 가리키거나 공적연금 안분이 조문에 없다.
      exceed.comparison_code = 'elective_basis_undetermined';
      notices.push(
        notice(REVERSE_NOTICE.ELECTIVE_BASIS_UNDETERMINED, 'warning', null, {}, [
          RULE.PENSION_SEPARATE_TAXATION_ELECTIVE,
        ]),
      );
    }
  }
  strategies.push(exceed);

  // ③ ISA 충당 — ISA 잔액이 0보다 클 때만
  const isa = input.accounts[ACCOUNT.ISA];
  if (isa.balance_krw > 0) {
    const path = isaPensionConversionPath(rules, { yearsSinceOpening: isa.years_since_opening });
    if (path.path_open === false) {
      notices.push(
        notice(
          REVERSE_NOTICE.ISA_CONVERSION_PATH_NOT_OPEN,
          'info',
          'accounts.isa.years_since_opening',
          { min_contract_years: path.min_contract_years, years_since_opening: isa.years_since_opening },
          [RULE.ISA_ACCOUNT_REQUIREMENTS],
        ),
      );
    }
    strategies.push({
      strategy_code: 'isa_supplement',
      isa_balance_krw: isa.balance_krw,
      pension_conversion_path: path,
      // **사용자의 답과 개시 시점 판정**(D78 ④). 위 `pension_conversion_path`는 **오늘**을
      // 재고 이 셋은 **개시 시점**을 잰다 — 재원 판정이 딛는 것은 이쪽이다.
      conversion_planned: conversion.planned,
      counted_as_start_source: conversion.counted,
      pension_conversion_path_at_annuity_start: {
        path_open: conversion.path_at_start.path_open,
        min_contract_years: conversion.path_at_start.min_contract_years,
        years_since_opening_at_annuity_start:
          conversion.path_at_start.years_since_opening_at_annuity_start,
        tenure_assumed_zero: conversion.path_at_start.tenure_assumed_zero,
      },
      // 전환금액은 과세제외금액이 되어 **문턱을 한 원도 쓰지 않는다.**
      conversion_consumes_threshold: false,
      // 계약을 유지한 채 인출하는 경로는 조문이 규율하지 않는 자리가 남아 있다.
      // **확정적 가능·불가능 문장을 내지 않는다.**
      contract_held_withdrawal: isaDeemedTerminationOnWithdrawal(rules, {
        yearsSinceOpening: isa.years_since_opening,
        cumulativeContributionKrw: isa.cumulative_contribution_krw,
        withdrawalKrw: isa.balance_krw,
      }),
      basis_rule_ids: [
        RULE.ISA_ACCOUNT_REQUIREMENTS,
        RULE.ISA_CLAWBACK,
        RULE.PENSION_NON_DEDUCTED_PRINCIPAL,
        RULE.CREDIT_TRANSFER_EXTRA,
      ].sort(),
    });
  }

  return strategies;
}

/** 수령 기간 안에서 연령별 세율 구간의 경계를 넘는 나이들. 넘으면 단일 세율을 단정하지 않는다. */
function bracketCrossingsWithin(rules, startAge, payoutYears) {
  const lastAge = startAge + payoutYears - 1;
  return rules.withholdingBrackets
    .map((bracket) => bracket?.age_min ?? null)
    .filter((age) => age !== null && age > startAge && age <= lastAge)
    .sort((a, b) => a - b);
}

// ── 언제나 서는 가정 ────────────────────────────────────────────────────

function addStandingAssumptions(assumptions, input) {
  assumptions.push(
    assume(REVERSE_ASSUMPTION.TODAY_CURRENCY, {}),
    assume(REVERSE_ASSUMPTION.START_DATE_DERIVED, { kind: input.annuity_start.kind }),
  );
}
