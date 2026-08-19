// 역산기(D77)가 룰셋에서 읽는 값을 **한 곳에서** 읽는다.
//
// **세법 수치가 이 파일에 하나도 없다.** 한도·비율·구간 경계·연차 마디·최소 연령은 전부
// `data/tax-rules/`에서 읽고, 읽지 못하면 대체값을 만들지 않고 `rule_missing`으로 멈춘다.
// 이 파일에 나오는 숫자는 배열 첨자와 「1」(연차의 첫 값) 같은 산술 상수뿐이다.
//
// **왜 별도 모듈인가.** 기존 계산기(적립 단계)와의 결합을 최소로 두라는 지시가 있었고,
// 수령 단계의 규칙은 적립 단계가 한 번도 읽지 않던 것들이다. 읽는 자리를 섞으면 어느
// 규칙이 어느 화면을 먹이는지 갈라 볼 수 없게 된다.
//
// **산문에서 수를 꺼내는 자리가 하나 있다**(연금수령한도의 계수 둘). 룰셋이 그 계수를
// `expression` 문자열 안에만 두고 값 칸으로 열어 두지 않았기 때문이다. 같은 형태의
// 선례가 이미 있다 — `limits.mjs`의 `readTenureCap`이 ISA 연간한도 산식에서 경과연수
// 상한을 꺼낸다. **지어내지 않고, 형태가 어긋나면 멈춘다.** 룰셋이 값 칸을 열면 이
// 함수는 사라져야 하고, 그 요청은 `engine-interface.md`의 `open_questions`에 있다.

import { createAccess, selectRulesets } from './ruleset.mjs';
import { createRoundingPolicy } from './rounding.mjs';
import { ERROR, RULE, SCENARIO } from './constants.mjs';

/** 이 회차에 역산기가 새로 읽는 규칙. 이름일 뿐 수치가 아니다. */
export const REVERSE_RULE = {
  ANNUAL_CAP: 'pension.withdrawal.annual_cap',
  INCOME_DEDUCTION: 'pension.income.deduction',
  DEFERRED_RETIREMENT_RATE: 'pension.income.withholding_rate.deferred_retirement',
};

const APPLIED_TO = 'pension_reverse';

/**
 * `평가액 ÷ (B − 연금수령연차) × R` 의 B와 R을 룰셋의 산식 문자열에서 꺼낸다.
 *
 * **꺼내는 것은 두 수뿐이고, 이 함수가 아는 것은 산식의 모양뿐이다.** 모양이 어긋나면
 * `null`을 돌려주고 부르는 쪽이 멈춘다 — 11이나 1.2를 대신 적어 넣지 않는다.
 */
function readCapCoefficients(expression) {
  if (typeof expression !== 'string') return null;
  const match = /÷\s*\(\s*(\d+)\s*[−\-]\s*연금수령연차\s*\)\s*×\s*(\d+)\s*\/\s*(\d+)/u.exec(expression);
  if (!match) return null;

  const base = Number.parseInt(match[1], 10);
  const rateNum = Number.parseInt(match[2], 10);
  const rateDen = Number.parseInt(match[3], 10);
  if (!Number.isSafeInteger(base) || base <= 1) return null;
  if (!Number.isSafeInteger(rateNum) || !Number.isSafeInteger(rateDen) || rateDen <= 0) return null;

  return { base, rateNum, rateDen };
}

/** 산식에서 꺼낸 B가 룰셋이 스스로 적은 연차 표와 맞물리는가. 어긋나면 멈춘다. */
function capTableAgreesWithBase(table, base) {
  if (!Array.isArray(table) || table.length === 0) return false;
  const years = table.map((row) => row?.연금수령연차).filter((y) => Number.isSafeInteger(y));
  if (years.length !== table.length) return false;
  return Math.max(...years) === base - 1;
}

function missing(ruleId, path) {
  return { code: ERROR.RULE_MISSING, field: null, params: { rule_id: ruleId, path } };
}

/**
 * 역산에 필요한 값을 전부 읽어 하나의 `rules` 객체로 만든다.
 *
 * 읽지 못한 것이 하나라도 있으면 `errors`가 비어 있지 않고 `rules`는 `null`이다.
 * **부분적으로 계산하지 않는다** — 한 값을 못 읽었는데 나머지로 화면을 채우면
 * 사용자는 무엇이 빠졌는지 알 수 없다.
 */
export function loadReverseRules(rulesetBundle, taxYear) {
  const selected = selectRulesets(rulesetBundle, taxYear, SCENARIO.CURRENT);
  if (selected.errors) return { rules: null, access: null, errors: selected.errors };

  const access = createAccess(selected);
  const errors = [];

  const capValue = access.value(REVERSE_RULE.ANNUAL_CAP, ['value'], APPLIED_TO);
  const coefficients = capValue === undefined ? null : readCapCoefficients(capValue.expression);
  if (coefficients === null) {
    errors.push(missing(REVERSE_RULE.ANNUAL_CAP, 'value.expression'));
  } else if (!capTableAgreesWithBase(capValue.derived_ratios?.table, coefficients.base)) {
    // 산식과 룰셋이 스스로 적은 연차 표가 갈리면 어느 쪽이 조문인지 엔진이 고르지 않는다.
    errors.push(missing(REVERSE_RULE.ANNUAL_CAP, 'value.derived_ratios.table'));
  }

  const thresholdKrw = access.value(
    RULE.PENSION_SEPARATE_TAXATION_THRESHOLD,
    ['value', 'amount_krw'],
    APPLIED_TO,
  );
  const electiveValue = access.value(RULE.PENSION_SEPARATE_TAXATION_ELECTIVE, ['value'], APPLIED_TO);
  const withholdingBrackets = access.value(
    RULE.PENSION_INCOME_RATE_BY_AGE,
    ['value', 'brackets'],
    APPLIED_TO,
  );
  const deductionValue = access.value(REVERSE_RULE.INCOME_DEDUCTION, ['value'], APPLIED_TO);
  const basicRateBrackets = access.value(RULE.BASIC_TAX_RATE, ['value', 'brackets'], APPLIED_TO);
  const basicDeductionKrw = access.value(RULE.BASIC_DEDUCTION_SELF, ['value', 'amount_krw'], APPLIED_TO);
  const surtaxRate = access.value(RULE.LOCAL_SURTAX, ['value', 'rate_of_income_tax'], APPLIED_TO);
  const otherIncomeRate = access.value(
    RULE.PENSION_EARLY_WITHDRAWAL_RATE,
    ['value', 'rate'],
    APPLIED_TO,
  );
  const deferredBrackets = access.value(
    REVERSE_RULE.DEFERRED_RETIREMENT_RATE,
    ['value', 'brackets'],
    APPLIED_TO,
  );
  const eligibilityRequirements = access.value(
    RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
    ['value', 'requirements'],
    APPLIED_TO,
  );
  const pensionContributionLimitKrw = access.value(
    RULE.PENSION_CONTRIBUTION_LIMIT,
    ['value', 'amount_krw'],
    APPLIED_TO,
  );
  // 계좌 배분의 **순서**가 딛는 두 한도. 이 탭은 세액공제액을 계산하지 않지만
  // (총급여를 묻지 않는다) 「공제 대상이 될 수 있는 자리」가 계좌별로 다르다는 사실은
  // 조문이 정하고, 그것이 연금저축과 IRP를 가르는 근거다.
  const annuityCreditLimitKrw = access.value(
    RULE.CREDIT_LIMIT_ANNUITY,
    ['value', 'amount_krw'],
    APPLIED_TO,
  );
  const combinedCreditLimitKrw = access.value(
    RULE.CREDIT_LIMIT_COMBINED,
    ['value', 'amount_krw'],
    APPLIED_TO,
  );
  const isaBaseAmountKrw = access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'base_amount_krw'], APPLIED_TO);
  const isaTotalLimitKrw = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'total_contribution_limit_krw'],
    APPLIED_TO,
  );
  const isaMinContractYears = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'min_contract_years'],
    APPLIED_TO,
  );

  // 인출 순서·과세제외금액·중도인출 제약·전환 추가한도는 **사실**로만 쓰지만,
  // 근거 목록에 실려야 하므로 여기서 함께 읽는다. 읽지 않은 규칙을 근거로 싣지 않는다.
  access.use(RULE.PENSION_NON_DEDUCTED_PRINCIPAL, APPLIED_TO);
  access.use(RULE.PENSION_MIDTERM_RESTRICTION, APPLIED_TO);
  access.use(RULE.CREDIT_TRANSFER_EXTRA, APPLIED_TO);
  // 배분 순서의 근거 둘(32.2절·32.3절). **한도의 크기가 아니라 그 성질**을 딛는다 —
  // 미사용 공제 한도에 이월 규정이 없다는 것과, 공제 한도를 넘는 납입에도 남는 것이
  // 있다는 것이다. 근거로 실리므로 여기서 읽는다.
  access.use(RULE.CREDIT_UNUSED_CARRYOVER, APPLIED_TO);
  access.use(RULE.PENSION_BEYOND_CREDIT_LIMIT, APPLIED_TO);
  access.use(RULE.ISA_CLAWBACK, APPLIED_TO);
  access.use(RULE.PENSION_EARLIEST_START, APPLIED_TO);

  const rounding = createRoundingPolicy(access, APPLIED_TO);
  if (rounding === null) errors.push(missing(RULE.ROUNDING_WON_FRACTION, 'value.stages'));

  const minStartAge = Array.isArray(eligibilityRequirements)
    ? (eligibilityRequirements.find((item) => item?.id === 'age')?.min_age ?? null)
    : null;
  if (minStartAge === null) {
    errors.push(missing(RULE.PENSION_WITHDRAWAL_ELIGIBILITY, 'value.requirements[age].min_age'));
  }

  const electiveRate = Array.isArray(electiveValue?.options)
    ? (electiveValue.options.find((option) => option?.id === 'separate')?.rate ?? null)
    : null;
  if (electiveValue !== undefined && electiveRate === null) {
    errors.push(missing(RULE.PENSION_SEPARATE_TAXATION_ELECTIVE, 'value.options[separate].rate'));
  }

  // **어느 자리가 미확정인지도 룰셋이 값으로 말한다.** 엔진이 「여기가 갈린다」를 스스로
  // 알지 않는다 — 룰셋의 `status` 칸이 「미확정」이면 갈리는 것이고, 그 칸이 확정으로
  // 바뀌는 날 엔진을 고치지 않아도 판정이 따라 움직인다.
  const electiveBasisStatus =
    electiveValue?.what_the_15_percent_is_multiplied_by?.status ?? null;
  if (electiveValue !== undefined && typeof electiveBasisStatus !== 'string') {
    errors.push(
      missing(
        RULE.PENSION_SEPARATE_TAXATION_ELECTIVE,
        'value.what_the_15_percent_is_multiplied_by.status',
      ),
    );
  }

  errors.push(...access.missing());
  if (errors.length > 0) return { rules: null, access, errors: dedupe(errors) };

  return {
    access,
    errors: [],
    rules: {
      access,
      rounding,
      files: selected.files,
      taxYear,
      cap: {
        base: coefficients.base,
        rateNum: coefficients.rateNum,
        rateDen: coefficients.rateDen,
        // 연차가 이 값 이상이면 산식을 적용하지 아니한다(§40조의2④). 산식의 B와 같은 수다.
        ceasesAtYearIndex: coefficients.base,
      },
      thresholdKrw,
      electiveRate,
      electiveBasisIsUndetermined: electiveBasisStatus === '미확정',
      withholdingBrackets,
      deduction: { brackets: deductionValue.brackets, capKrw: deductionValue.cap_krw },
      basicRateBrackets,
      basicDeductionKrw,
      surtaxRate,
      otherIncomeRate,
      deferredBrackets,
      minStartAge,
      pensionContributionLimitKrw,
      annuityCreditLimitKrw,
      combinedCreditLimitKrw,
      isaBaseAmountKrw,
      isaTotalLimitKrw,
      isaMinContractYears,
    },
  };
}

function dedupe(errors) {
  const seen = new Set();
  const out = [];
  for (const error of errors) {
    const key = `${error.code}|${error.params?.rule_id ?? ''}|${error.params?.path ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(error);
  }
  return out;
}
