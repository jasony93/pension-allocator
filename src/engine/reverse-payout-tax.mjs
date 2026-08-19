// 수령 단계의 세액 계산. **정답지 18절(GC-P1~P9)이 이 파일의 정답이다.**
//
// **세법 수치가 이 파일에 없다.** 세율·구간 경계·문턱·공제 한도는 전부 `rules`로 들어오고,
// 그 `rules`는 `reverse-rules.mjs`가 룰셋에서 읽는다. 여기 나오는 숫자는 배열 첨자와
// 「0」(음수를 자르는 바닥)뿐이다.
//
// **두 경계를 같은 규칙으로 처리하지 않는다**(정답지 18.6절). 1,500만원 문턱은
// 「해당/미해당」을 가르는 **요건**이라 넘으면 **전액**이 밖으로 나가고, 연금수령한도는
// 금액의 **상한**이라 넘으면 **초과분만** 성격이 바뀐다. 방향이 정반대다.
//
// **미확정 자리에서는 결론을 내지 않는다.** §64조의4 제2호 가목의 곱셈 대상이 총연금액인지
// 연금소득금액인지가 룰셋에서 미확정이므로, 두 읽기를 **둘 다** 내고 두 읽기가 같은 쪽을
// 가리킬 때만 유불리를 말한다.

import { EXACT_ZERO, addExact, cmpExact, exactOf, maxExact, minExact, mulExact, subExact } from './exact.mjs';
import { toRatio } from './ratio.mjs';
import { ROUNDING_STAGE } from './constants.mjs';

/** 비율(십진 소수)을 정확값 곱셈에 쓸 수 있는 분수로. 읽지 못하면 `null`. */
function rateExact(rate) {
  const ratio = toRatio(rate);
  if (ratio === null) return null;
  return { n: BigInt(ratio.num), d: BigInt(ratio.den) };
}

const scaleBy = (exact, rate) => mulExact(exact, rateExact(rate));

/** 소득세분에 개인지방소득세를 얹는다. **실효율을 상수로 쓰지 않고 두 규칙을 곱한다.** */
function withLocalSurtax(rules, incomeTaxKrw) {
  const local = rules.rounding.displayLocal(scaleBy(exactOf(incomeTaxKrw), rules.surtaxRate));
  if (local === null || incomeTaxKrw === null) return { local_tax_krw: null, total_krw: null };
  return { local_tax_krw: local, total_krw: incomeTaxKrw + local };
}

// ── 1,500만원 문턱 ──────────────────────────────────────────────────────

/**
 * 문턱의 합계액에 **들어가는 재원만** 더한다.
 *
 * 이연퇴직소득분(§14③9 가목)·부득이한 사유 인출분(나목)·과세제외금액·ISA 전환금액분은
 * 들어가지 않는다. **네 재원을 합산하면 그 사람에게 없는 종합과세를 만들어 낸다**
 * (정답지 GC-P7 — 총 수령액 2,500만원인데 문턱 판정은 1,500만원으로 한다).
 *
 * **이 분류는 룰셋이 산문으로만 적어 두어 엔진이 들고 있다.** 룰셋이 `not_counted`를
 * 값 칸으로 열면 이 함수의 인자 이름이 그 칸을 가리켜야 한다 — `open_questions`에 있다.
 */
export function thresholdCountedAmount(rules, sources) {
  void rules;
  return sources.taxCreditedAndReturnKrw;
}

/**
 * 그 해의 사적연금소득이 분리과세 문턱 안인가, 그리고 §64조의4의 선택이 열리는가.
 *
 * **넘으면 초과분이 아니라 전액이 밖으로 나간다**(`all_or_nothing`). 문언이
 * 「합계액이 … 이하인 경우 **그 연금소득**」이므로 조건이 깨지면 다목에 해당하는 소득
 * 자체가 없어진다.
 */
export function separateTaxationStatus(rules, { privatePensionAnnualKrw }) {
  const within = privatePensionAnnualKrw <= rules.thresholdKrw;
  return {
    threshold_krw: rules.thresholdKrw,
    counted_krw: privatePensionAnnualKrw,
    within_threshold: within,
    elective_opens: !within,
    // 밖으로 나가는 금액. 「초과분」이 아니라 전액이다.
    elective_base_krw: within ? null : privatePensionAnnualKrw,
  };
}

// ── 원천징수 ────────────────────────────────────────────────────────────

/**
 * 연령별 원천징수세율. **경계는 아래 구간이 아니라 위 구간에 붙는다** —
 * 조문의 표가 「70세 미만 / 70세 이상 80세 미만 / 80세 이상」이기 때문이다.
 */
export function withholdingRateForAge(rules, ageYears) {
  const bracket = rules.withholdingBrackets.find(
    (item) =>
      ((item?.age_min ?? null) === null || ageYears >= item.age_min) &&
      ((item?.age_max_exclusive ?? null) === null || ageYears < item.age_max_exclusive),
  );
  return bracket?.rate ?? null;
}

export function withholdingOnPrivatePension(rules, { annualKrw, ageYears }) {
  const rate = withholdingRateForAge(rules, ageYears);
  if (rate === null) return null;
  const incomeTax = rules.rounding.display(scaleBy(exactOf(annualKrw), rate));
  return { rate, income_tax_krw: incomeTax, ...withLocalSurtax(rules, incomeTax) };
}

/**
 * 연금수령한도를 넘겨 인출한 **초과분**에 걸리는 기타소득세.
 * 이연퇴직소득분은 이 세율이 아니다 — 그 재원은 감면 자체를 잃는다(아래 주석).
 */
export function excessWithdrawalOtherIncome(rules, { excessKrw }) {
  const rate = rules.otherIncomeRate;
  const incomeTax = rules.rounding.display(scaleBy(exactOf(excessKrw), rate));
  return { rate, income_tax_krw: incomeTax, ...withLocalSurtax(rules, incomeTax) };
}

// ── 연금소득공제 ────────────────────────────────────────────────────────

/** 공제액의 **정확값**. 표시용으로 버리기 전의 값이고 다음 단계가 이것을 쓴다. */
function deductionExact(rules, totalPensionKrw) {
  const total = exactOf(totalPensionKrw);
  const bracket = rules.deduction.brackets.find(
    (item) => (item?.total_pension_max_krw ?? null) === null || totalPensionKrw <= item.total_pension_max_krw,
  );
  if (bracket === undefined) return null;

  const excess = subExact(total, exactOf(bracket.threshold_krw));
  const formula = addExact(exactOf(bracket.base_krw), scaleBy(excess, bracket.excess_rate));
  return minExact(formula, exactOf(rules.deduction.capKrw));
}

/**
 * 연금소득공제. **공적연금과 사적연금을 합산한 총연금액에 한 번 걸린다.**
 * 사적연금에 대해 따로 계산하면 잔여 공제의 몇 배가 나온다(정답지 GC-P8).
 */
export function pensionIncomeDeduction(rules, { totalPensionKrw }) {
  return rules.rounding.display(deductionExact(rules, totalPensionKrw));
}

// ── §64조의4 — 두 선택지 ────────────────────────────────────────────────

/** 기본세율표를 과세표준(정수 원)에 적용한다. */
function basicTaxExact(rules, taxBaseKrw) {
  const bracket = rules.basicRateBrackets.find(
    (item) => (item?.tax_base_max_krw ?? null) === null || taxBaseKrw <= item.tax_base_max_krw,
  );
  if (bracket === undefined) return null;
  const excess = subExact(exactOf(taxBaseKrw), exactOf(bracket.threshold_krw));
  return addExact(exactOf(bracket.base_krw), scaleBy(excess, bracket.rate_on_excess));
}

/** 종합소득금액 → 과세표준. **§47②가 지목한 자리에서만 1원 미만을 버린다.** */
function taxBaseFrom(rules, globalIncomeExact) {
  const afterDeduction = maxExact(subExact(globalIncomeExact, exactOf(rules.basicDeductionKrw)), EXACT_ZERO);
  const floored = rules.rounding.statutory(ROUNDING_STAGE.TAX_BASE, afterDeduction);
  return floored === null ? null : Number(floored.n / floored.d);
}

/** 과세표준에서 소득세·지방소득세·합계를 낸다. */
function taxOn(rules, taxBaseKrw) {
  const incomeTax = rules.rounding.display(basicTaxExact(rules, taxBaseKrw));
  return { tax_base_krw: taxBaseKrw, income_tax_krw: incomeTax, ...withLocalSurtax(rules, incomeTax) };
}

/**
 * §64조의4 **제1호 — 종합과세.**
 *
 * 총연금액은 공적연금과 사적연금의 합이고(§20조의3③), 연금소득공제가 그 합에 한 번 걸린다.
 * 종합소득공제는 **본인 기본공제만** 센다 — 다른 인적공제·특별공제는 입력에 없고
 * 지어내면 과세표준이 실제보다 작아진다.
 */
export function comprehensiveOption(rules, { privateAnnualKrw, publicAnnualKrw, otherGlobalIncomeKrw }) {
  const totalPensionKrw = privateAnnualKrw + publicAnnualKrw;
  const deduction = deductionExact(rules, totalPensionKrw);
  const pensionIncome = subExact(exactOf(totalPensionKrw), deduction);
  const globalIncome = addExact(pensionIncome, exactOf(otherGlobalIncomeKrw));
  const taxBase = taxBaseFrom(rules, globalIncome);
  if (taxBase === null) return null;

  return {
    option_code: 'comprehensive',
    total_pension_krw: totalPensionKrw,
    deduction_krw: rules.rounding.display(deduction),
    pension_income_krw: rules.rounding.display(pensionIncome),
    ...taxOn(rules, taxBase),
  };
}

/**
 * §64조의4 **제2호 — 15% 분리과세.** 가목(그 연금소득 × 15%)과 나목(가목 외의 종합소득
 * 결정세액)의 합이다.
 *
 * **곱하는 대상이 미확정이라 두 읽기를 둘 다 낸다.**
 *  · 읽기 A — 총연금액(정확히는 그 사적연금분). 조문이 정의된 용어 「연금소득금액」을
 *    쓰지 않았다는 것이 근거다.
 *  · 읽기 B — 연금소득금액(총연금액 − 연금소득공제). 세액 계산이 소득금액 단계를 거친다는
 *    체계 해석이다.
 *
 * **한쪽으로 확정하지 않는다.** 두 읽기가 같은 쪽을 가리킬 때만 유불리를 말한다
 * (`readings_agree_on_lower_option`).
 */
export function electiveSeparateOption(rules, { privateAnnualKrw, publicAnnualKrw, otherGlobalIncomeKrw }) {
  const comprehensive = comprehensiveOption(rules, {
    privateAnnualKrw,
    publicAnnualKrw,
    otherGlobalIncomeKrw,
  });
  if (comprehensive === null) return null;

  // 나목 — 「가목 외의 종합소득 결정세액」. 공적연금이 있으면 **그것을 뺀 총연금액으로
  // 연금소득공제를 다시 계산하는지**를 정한 조문을 찾지 못했으므로(정답지 18.10절 2번)
  // 그 자리를 미확정으로 표시한다. 공적연금이 없으면 그 물음이 생기지 않는다.
  const remainderIsUndetermined = publicAnnualKrw > 0;
  const remainderBase = taxBaseFrom(rules, exactOf(otherGlobalIncomeKrw));
  const remainder = remainderBase === null ? null : taxOn(rules, remainderBase);

  const compose = (baseKrw) => {
    const incomeTax = rules.rounding.display(scaleBy(exactOf(baseKrw), rules.electiveRate));
    const gamok = { income_tax_krw: incomeTax, ...withLocalSurtax(rules, incomeTax) };
    return {
      multiplied_base_krw: baseKrw,
      gamok_total_krw: gamok.total_krw,
      namok_total_krw: remainder?.total_krw ?? null,
      total_krw:
        gamok.total_krw === null || remainder === null ? null : gamok.total_krw + remainder.total_krw,
    };
  };

  const readingA = compose(privateAnnualKrw);
  // 읽기 B의 밑은 연금소득금액이다. 공적연금이 섞여 있으면 그중 사적연금 몫을 가르는
  // 조문이 없어 `public_pension_share_not_apportioned`가 함께 선다.
  const readingB = compose(comprehensive.pension_income_krw);

  const lowerUnder = (reading) =>
    reading.total_krw === null ? null : reading.total_krw < comprehensive.total_krw ? 'separate' : 'comprehensive';
  const underA = lowerUnder(readingA);
  const underB = lowerUnder(readingB);

  return {
    option_code: 'separate',
    rate: rules.electiveRate,
    basis_is_undetermined: rules.electiveBasisIsUndetermined,
    public_pension_share_not_apportioned: publicAnnualKrw > 0,
    remainder_is_undetermined: remainderIsUndetermined,
    reading_a: readingA,
    reading_b: readingB,
    readings_agree_on_lower_option: underA !== null && underA === underB,
    lower_option_code: underA !== null && underA === underB ? underA : null,
  };
}

// ── 이연퇴직소득 ────────────────────────────────────────────────────────

/**
 * 이연퇴직소득을 연금수령할 때의 **감면 비율.** 세율이 아니라 다른 세율에 대한 비율이다.
 *
 * **경계가 아래 구간에 붙는다** — 「10년 이하 / 10년 초과 20년 이하 / 20년 초과」이므로
 * 정확히 10년째면 70%, 정확히 20년째면 60%다. 연령별 세율의 경계가 위 구간에 붙는 것과
 * **방향이 반대**이고, 두 경계를 같은 방향으로 처리하면 반드시 한쪽이 틀린다.
 *
 * **밑세율(퇴직소득세)은 이 룰셋의 범위 밖이다.** 엔진은 스스로 계산하지 않고 금액도 내지
 * 않는다 — `base_rate_in_scope: false`가 그 선언이다.
 */
export function deferredRetirementRatio(rules, { actualPayoutYearIndex }) {
  const bracket = rules.deferredBrackets.find((item) => {
    const lowerOk =
      (item?.years_min_exclusive ?? null) !== null
        ? actualPayoutYearIndex > item.years_min_exclusive
        : (item?.years_min ?? null) === null || actualPayoutYearIndex >= item.years_min;
    const upperOk =
      (item?.years_max_inclusive ?? null) === null || actualPayoutYearIndex <= item.years_max_inclusive;
    return lowerOk && upperOk;
  });
  if (bracket === undefined) return null;

  return {
    actual_payout_year_index: actualPayoutYearIndex,
    ratio_of_base_rate: bracket.ratio_of_base_rate,
    statutory: bracket.statutory,
    base_rate_in_scope: false,
    income_tax_krw: null,
    consumes_separate_taxation_threshold: false,
  };
}

// ── ISA ─────────────────────────────────────────────────────────────────

/**
 * ISA에서 꺼내는 것이 **중도해지로 의제되는가.**
 *
 * 의제의 요건은 「의무가입기간이 되는 날 **전**」 × 「납입원금 **초과**」의 **교집합**이다.
 * 원금 범위 내 인출은 걸리지 않는다 — 다만 그것은 반대해석이지 조문이 「허용한다」고
 * 적은 것이 아니다.
 *
 * **기간이 지난 뒤의 원금 초과 인출은 조문이 규율하지 않는다.** 읽기가 둘로 갈리고
 * 룰셋이 확정하지 않았으므로 **참도 거짓도 내지 않는다**(`null` + 사유 코드).
 */
export function isaDeemedTerminationOnWithdrawal(
  rules,
  { yearsSinceOpening, cumulativeContributionKrw, withdrawalKrw },
) {
  if (yearsSinceOpening === null || yearsSinceOpening === undefined) {
    return { deemed_terminated: null, reason_code: 'isa_tenure_missing' };
  }
  if (yearsSinceOpening >= rules.isaMinContractYears) {
    return { deemed_terminated: null, reason_code: 'after_min_contract_years_not_settled' };
  }
  if (cumulativeContributionKrw === null || cumulativeContributionKrw === undefined) {
    return { deemed_terminated: null, reason_code: 'cumulative_contribution_missing' };
  }
  return {
    deemed_terminated: withdrawalKrw > cumulativeContributionKrw,
    reason_code: null,
  };
}

/** ISA 잔액을 연금계좌로 옮기는 경로가 열려 있는가. 열리는 마디는 룰셋의 의무가입기간이다. */
export function isaPensionConversionPath(rules, { yearsSinceOpening }) {
  if (yearsSinceOpening === null || yearsSinceOpening === undefined) {
    return { path_open: null, min_contract_years: rules.isaMinContractYears, reason_code: 'isa_tenure_missing' };
  }
  return {
    path_open: yearsSinceOpening >= rules.isaMinContractYears,
    min_contract_years: rules.isaMinContractYears,
    reason_code: null,
  };
}

/** 두 정확값의 대소. 전략 비교가 쓰는 유일한 비교다. */
export const compareExact = cmpExact;
