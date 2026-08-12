// 연금계좌 세액공제의 **세액 한도**를 해당 과세기간 총급여액에서 산출한다 (D39·D40).
//
// **무엇이 바뀌었나.** 전에는 직전 과세연도 결정세액을 물어 되더했다. 소유자가 그 입력을
// 없애라고 지시했고(D39), `tax-domain`이 대체 경로를 조문으로 닫았다
// (`pension.credit.tax_liability_cap.current_year_estimate`). 한도의 **정의**는 여전히
// `pension.credit.tax_liability_cap`이 정하고, 이 파일이 하는 것은 그 한도를 총급여액에서
// **추정**하는 것뿐이다.
//
// **나온 값은 하한이 아니라 상한이다.** 이 경로가 세지 않은 종합소득공제·세액공제를 실제
// 납세자는 더 빼므로 실제 한도는 이 값보다 작거나 같다. **방향을 다시 유도하지 않는다** —
// 규칙의 `error_direction`이 증명과 함께 코드를 값으로 적어 두었고 엔진은 그것을 읽는다
// (`do_not_re_derive`). 방향이 뒤집히면 서비스가 조용히 과대로 간다.
//
// **분기마다 방향이 다르다.** 근로소득만 있는 경우와 종합소득금액을 받은 경우는 상한이고,
// 종합소득이 있는데 금액을 모르는 경우는 **미정**이다(두 힘의 부호가 반대다). 그 판정도
// 엔진이 정하지 않는다 — 분기의 **`direction_code` 칸**을 그대로 읽는다.
//
// **산문을 해석하는 자리를 남기지 않는다** (D41 1번, D42 5절 (나)). 전에는 분기의 `direction`
// 문자열이 상한 코드로 **시작하는지**를 보았다. 그 칸은 사람이 읽는 산문이고, 앞에 한 단어가
// 붙는 것만으로 방향 판정이 뒤집힌다. 룰셋이 `branches_reading_rule`로 그것을 명시로 금지하며
// (`engine_must_not_read: "direction"`) 분기마다 코드 칸을 따로 두었다. 이 파일은 그 칸만 본다.
//
// **미정 쪽 코드도 이제 룰셋에서 온다.** 전에는 엔진 상수(`CAP_DIRECTION_INDETERMINATE`)가
// 그 문자열을 들고 있었다. 룰셋이 `code_definition_sites`로 정의 자리를 스스로 밝혔으므로
// (`global_income_amount_missing.direction_code`) 상한 코드와 **같은 취급**을 한다 — 엔진
// 상수에 두 문자열 어느 것도 없다. `ruleset-driven.test.mjs`가 그 부재를 본다.
//
// **세법 수치는 한 개도 이 파일에 없다.** 구간 경계·비율·기본공제액·근로소득세액공제
// 한도는 전부 룰셋에서 온다. 제2항 한도는 룰셋이 산식을 **문자열**로 적어 두었으므로
// 그 문자열을 기계적으로 읽는다(`limits.mjs`의 `readTenureCap`과 같은 방식이다).
//
// **단계마다 버리지 않는다** (D46 1번 · 검증 20절). 전에는 구간 산식마다 원 미만을
// 버렸고, 그래서 근로소득공제의 끝수가 위로 밀려 **과세표준이 조문보다 항상 정확히 1원
// 컸다.** 조문이 끝수를 없애라고 지목한 자리는 과세표준 하나뿐이므로(국고금 관리법
// §47②), 이 파일은 **정확값으로 계산하고 그 자리에서만 버린다.** 어느 자리에서 무엇을
// 얼마 단위로 버리는지는 `rounding.mjs`가 룰셋에서 읽는다 — 이 파일에 `Math.floor`가
// 한 번도 나오지 않는 것이 그 규약의 증거다.

import { CAP_BASIS, CAP_BRANCH, CAP_BINDING, NOTICE, ROUNDING_STAGE, RULE } from './constants.mjs';
import {
  addExact,
  clampExactToZero,
  cmpExact,
  divExact,
  exactOf,
  exactToInteger,
  minExact,
  mulExact,
  scaleExact,
  subExact,
} from './exact.mjs';
import { notice } from './limits.mjs';
import { toRatio } from './ratio.mjs';
import { createRoundingPolicy } from './rounding.mjs';

/** 이 계산이 읽는 규칙 전부. 근거 목록에 이 여섯이 함께 실린다. */
export const CAP_ESTIMATE_RULE_IDS = [
  RULE.BASIC_DEDUCTION_SELF,
  RULE.BASIC_TAX_RATE,
  RULE.CREDIT_TAX_CAP,
  RULE.CREDIT_TAX_CAP_ESTIMATE,
  RULE.ROUNDING_WON_FRACTION,
  RULE.WAGE_INCOME_CREDIT,
  RULE.WAGE_INCOME_DEDUCTION,
].sort();

/**
 * `base_krw + (x − threshold_krw) × rate_on_excess` 꼴의 구간표를 읽는다.
 *
 * 세 규칙이 같은 모양을 쓴다 — 근로소득공제·기본세율·근로소득세액공제 제1항. 상한 키의
 * 이름만 다르므로 그것을 인자로 받는다. **경계값은 아래 구간에 속한다**(문언이 '이하'이고
 * 두 산식이 경계에서 같은 값을 내므로 이 판정이 결과를 바꾸지 않는다 — 세 규칙의
 * `boundary_rule`).
 *
 * **원 미만을 버리지 않는다.** 조문이 이 세 값을 끝수 계산의 대상으로 지목하지 않았다
 * (룰셋 `intermediate_amount`: `operation_code: none`). 들어오고 나가는 값이 둘 다
 * 정확값(`Exact`)인 이유다. 구간을 고르는 비교도 정확값으로 한다 — 경계에서 끝수를
 * 먼저 버리면 한 칸 아래 구간으로 떨어질 수 있다.
 */
function bracketAmount(brackets, maxKey, x) {
  if (!Array.isArray(brackets) || x === null) return null;
  const bracket = brackets.find((b) => {
    const max = b?.[maxKey] ?? null;
    if (max === null) return true;
    const order = cmpExact(x, exactOf(max));
    return order !== null && order <= 0;
  });
  if (bracket === undefined) return null;
  if (typeof bracket.base_krw !== 'number' || typeof bracket.threshold_krw !== 'number') return null;

  const excess = clampExactToZero(subExact(x, exactOf(bracket.threshold_krw)));
  const scaled = scaleExact(excess, toRatio(bracket.rate_on_excess));
  if (scaled === null) return null;
  return addExact(exactOf(bracket.base_krw), scaled);
}

/**
 * 근로소득세액공제 제2항의 한도. 룰셋이 산식을 **문자열**로 적은 자리다.
 *
 * 첫 구간만 금액(`limit_krw`)이고 나머지 셋은 `"740000 − (총급여액 − 33000000) × 8/1000"`
 * 꼴이다. 그 숫자를 코드로 옮겨 적으면 룰셋이 단일 진실 원천이 아니게 되므로 **읽는다.**
 * 형태가 맞지 않으면 값을 지어내지 않고 `null`을 돌려 계산을 멈춘다.
 */
const LIMIT_FORMULA = /^(\d+)\s*[−-]\s*\(\s*총급여액\s*[−-]\s*(\d+)\s*\)\s*[×x*]\s*(\d+)\s*\/\s*(\d+)$/;

function wageCreditLimit(brackets, totalSalary) {
  if (!Array.isArray(brackets)) return null;
  const bracket = brackets.find(
    (b) => (b?.total_salary_max_krw ?? null) === null || totalSalary <= b.total_salary_max_krw,
  );
  if (bracket === undefined) return null;
  if (typeof bracket.limit_krw === 'number') return exactOf(bracket.limit_krw);

  const match = LIMIT_FORMULA.exec(String(bracket.formula ?? '').trim());
  if (match === null || typeof bracket.floor_krw !== 'number') return null;

  const [base, threshold, numerator, denominator] = match.slice(1).map(Number);
  if (denominator === 0) return null;

  // **산식을 절사하지 않는다.** 전에는 전체를 한 번에 버렸는데, 그 자리도 조문이 지목한
  // 단계가 아니다(`intermediate_amount`). 감액률이 8/1000이라 총급여가 1,000의 배수가
  // 아니면 여기서 끝수가 나고, 그 끝수를 버리면 한도가 커져 **세액 한도가 작아진다** —
  // 방향이 있는 자리이므로 정확값 그대로 넘긴다.
  const reduction = scaleExact(
    clampExactToZero(subExact(exactOf(totalSalary), exactOf(threshold))),
    { num: numerator, den: denominator },
  );
  const limit = subExact(exactOf(base), reduction);
  const floor = exactOf(bracket.floor_krw);
  const order = cmpExact(limit, floor);
  if (order === null) return null;
  return order >= 0 ? limit : floor;
}

/** 규칙이 요구하는 값을 전부 읽는다. 하나라도 없으면 계산을 멈춘다(대체값을 만들지 않는다). */
function readInputs(access, appliedTo) {
  const value = (ruleId, path) => access.value(ruleId, path, appliedTo);

  return {
    deductionBrackets: value(RULE.WAGE_INCOME_DEDUCTION, ['value', 'brackets']),
    deductionCap: value(RULE.WAGE_INCOME_DEDUCTION, ['value', 'overall_cap_krw']),
    basicDeduction: value(RULE.BASIC_DEDUCTION_SELF, ['value', 'amount_krw']),
    rateBrackets: value(RULE.BASIC_TAX_RATE, ['value', 'brackets']),
    creditAmountBrackets: value(RULE.WAGE_INCOME_CREDIT, ['value', 'amount_brackets']),
    creditLimitBrackets: value(RULE.WAGE_INCOME_CREDIT, ['value', 'limit_brackets']),
    upperBoundCode: value(RULE.CREDIT_TAX_CAP_ESTIMATE, ['value', 'error_direction', 'code']),
    branches: value(RULE.CREDIT_TAX_CAP_ESTIMATE, ['value', 'branches']),
    carryforward: value(RULE.CREDIT_TAX_CAP, ['value', 'excess_treatment', 'credit_carryforward']),
  };
}

/**
 * 어느 분기인가. **엔진이 판정하는 것은 분기뿐이고 그 분기의 오차 방향은 룰셋이 정한다.**
 *
 * 방향은 분기의 `direction_code` 칸에서 그대로 온다. 산문(`direction`)은 읽지 않는다 —
 * 룰셋의 `branches_reading_rule`이 그것을 금지하고, 그 칸이 없으면 방향을 **지어내지 않고**
 * 계산을 멈춘다.
 */
function branchOf(profile) {
  if (profile.has_non_wage_global_income_current_year !== true) return CAP_BRANCH.WAGE_ONLY;
  if (profile.current_year_global_income_krw !== null) return CAP_BRANCH.GLOBAL_INCOME_SUPPLIED;
  return CAP_BRANCH.GLOBAL_INCOME_MISSING;
}

/**
 * 세액 한도를 총급여액에서 산출한다.
 *
 * 네 단계다(규칙의 `statutory_path`).
 *   1. 총급여액 → 근로소득금액 (근로소득공제, 소득세법 §47)
 *   2. 근로소득금액 → 과세표준 (본인 기본공제, §50①1)
 *   3. 과세표준 → 산출세액 (기본세율, §55①)
 *   4. 산출세액 − 근로소득세액공제 = 한도 (§59, §61②③)
 *
 * 종합소득금액을 받은 분기는 1·2단계를 그 금액으로 대신하고(근로소득공제가 이미 그 안에서
 * 빠져 있다) 4단계의 근로소득세액공제를 근로소득금액 비율로 안분한다.
 */
export function resolveTaxLiabilityCap(access, { profile }) {
  const notices = [];
  const appliedTo = 'pension_credit_tax_liability_cap.cap_krw';
  const input = readInputs(access, appliedTo);
  // 사용자가 서식에서 값을 읽던 경로가 이 계산으로 대체됐다는 사실이 그 규칙에 적혀 있다.
  access.use(RULE.CREDIT_TAX_CAP_SOURCE, appliedTo);
  // 원 미만을 어디서 어떻게 없애는지. 읽지 못하면 계산하지 않는다 — 규약 없이 계산하면
  // 어딘가에서 임의로 버리게 되고 그것이 조문에 없는 절사 자리다.
  const rounding = createRoundingPolicy(access, appliedTo);

  if (rounding === null) return { cap: null, capExact: null, notices };
  if (Object.values(input).some((value) => value === undefined)) {
    return { cap: null, capExact: null, notices };
  }

  const branch = branchOf(profile);
  const branchNode = input.branches[branch];
  // **읽는 칸은 `direction_code` 하나다.** 산문 칸(`direction`)이 무엇이든 보지 않는다.
  if (branchNode === undefined || typeof branchNode.direction_code !== 'string') {
    access.value(RULE.CREDIT_TAX_CAP_ESTIMATE, ['value', 'branches', branch, 'direction_code'], appliedTo);
    return { cap: null, capExact: null, notices };
  }

  const directionCode = branchNode.direction_code;
  const isUpperBound = directionCode === input.upperBoundCode;
  const totalSalary = profile.current_year_total_salary_krw;
  const stop = () => ({ cap: null, capExact: null, notices });

  // 1단계. 공제액이 총급여액을 넘지 못하고(§47③) 2천만원 상한이 걸린다(§47① 단서).
  const bracketDeduction = bracketAmount(
    input.deductionBrackets,
    'total_salary_max_krw',
    exactOf(totalSalary),
  );
  if (bracketDeduction === null) {
    access.value(RULE.WAGE_INCOME_DEDUCTION, ['value', 'brackets', 'base_krw'], appliedTo);
    return stop();
  }
  // **여기서 버리지 않는다.** 전에는 이 값을 먼저 버리고 총급여에서 뺐고, 그 한 줄이
  // 과세표준을 조문보다 1원 크게 만들었다(D46 1번).
  const wageDeduction = minExact(
    minExact(bracketDeduction, exactOf(input.deductionCap)),
    exactOf(totalSalary),
  );
  const wageIncome = subExact(exactOf(totalSalary), wageDeduction);

  // 2단계. 종합소득금액을 받았으면 그것이 조문상의 합산 기준 그 자체다 — 근로소득공제를
  // 다시 빼지 않는다.
  const globalIncome =
    branch === CAP_BRANCH.GLOBAL_INCOME_SUPPLIED
      ? exactOf(profile.current_year_global_income_krw)
      : wageIncome;
  // **조문이 지목한 유일한 자리다** — 국고금 관리법 §47②. 1원 미만을 여기서 한 번 버린다.
  // 연산도 단위도 룰셋에서 오고, 이 자리가 조문 자리(`determined_by_law: true`)가 아니면
  // 값이 나오지 않는다.
  const taxBase = rounding.statutory(
    ROUNDING_STAGE.TAX_BASE,
    clampExactToZero(subExact(globalIncome, exactOf(input.basicDeduction))),
  );
  if (taxBase === null) return stop();

  // 3단계.
  const computedTax = bracketAmount(input.rateBrackets, 'tax_base_max_krw', taxBase);
  if (computedTax === null) {
    access.value(RULE.BASIC_TAX_RATE, ['value', 'brackets', 'base_krw'], appliedTo);
    return stop();
  }

  // 4단계. 제1항이 재는 것은 **그 근로소득에 대한** 산출세액이다. 근로소득 외의 소득이
  // 있으면 근로소득금액이 종합소득금액에서 차지하는 비율로 안분한다. 근로소득금액은
  // 종합소득금액의 구성요소이므로 그 비율은 1을 넘지 않는다.
  const globalIncomePositive = cmpExact(globalIncome, exactOf(0)) > 0;
  const wagePortionTax = globalIncomePositive
    ? divExact(mulExact(computedTax, minExact(wageIncome, globalIncome)), globalIncome)
    : exactOf(0);

  const creditByAmount = bracketAmount(
    input.creditAmountBrackets,
    'wage_income_tax_max_krw',
    wagePortionTax,
  );
  const creditLimit = wageCreditLimit(input.creditLimitBrackets, totalSalary);
  if (creditByAmount === null || creditLimit === null) {
    access.value(RULE.WAGE_INCOME_CREDIT, ['value', 'limit_brackets', 'formula'], appliedTo);
    return stop();
  }
  // 제1항으로 공제액을 구한 뒤 제2항의 한도로 자른다(규칙의 `apply_order`).
  const wageCredit = minExact(creditByAmount, creditLimit);

  // **한도의 정확값.** 응답에는 정수 원으로 실리지만(표시 단계에서 한 번 버린다),
  // 공제액과의 대소 판정은 이 값으로 한다 — 절사한 값으로 비교하면 1원 미만의 차이가
  // 사라져 `applied`가 뒤집힌다(룰셋 `comparison` 단계).
  const capExact = clampExactToZero(subExact(computedTax, wageCredit));
  const display = (exact) => exactToInteger(rounding.convention(ROUNDING_STAGE.DISPLAYED, exact));
  const capKrw = display(capExact);
  const wageDeductionKrw = display(wageDeduction);
  const wageIncomeKrw = display(wageIncome);
  // **§47②가 이미 정수로 만든 값이지만 표시 단계를 한 번 더 지난다.** 응답에 실리는
  // 정수는 전부 같은 문을 통과한다는 규약이고, 조문 단계가 정수를 내는 한 이 통과는
  // 값을 바꾸지 않는다. 룰셋이 §47②의 연산을 거두면(가정) 그때는 표시 규약이 그 자리를
  // 대신하고, **그 사실이 `tax_base_krw`와 `cap_krw`에 함께 나타난다.**
  const taxBaseKrw = display(taxBase);
  const computedTaxKrw = display(computedTax);
  const wageCreditKrw = display(wageCredit);
  if (
    [capKrw, wageDeductionKrw, wageIncomeKrw, taxBaseKrw, computedTaxKrw, wageCreditKrw].some(
      (value) => value === null,
    )
  ) {
    return stop();
  }
  // 상한 쪽도 미정 쪽도 룰셋이 값으로 적어 둔 코드를 그대로 싣는다. 엔진이 만들지 않는다.
  const errorDirection = directionCode;
  const basisRuleIds = [...CAP_ESTIMATE_RULE_IDS, RULE.CREDIT_TAX_CAP_SOURCE].sort();

  // 이 값이 총급여액에서 계산한 것이고 다른 공제를 반영하지 않았다는 사실은 **금액과 같은
  // 화면에** 있어야 한다(규칙의 `required_display`). 그래서 언제나 나간다.
  notices.push(
    notice(NOTICE.TAX_CAP_ESTIMATED, 'warning', 'profile.current_year_total_salary_krw', {
      error_direction: errorDirection,
      branch,
      is_upper_bound: isUpperBound,
      cap_krw: capKrw,
    }, basisRuleIds),
  );
  if (!isUpperBound) {
    // 다른 소득을 세지 않은 것은 산출세액을 작게 잡는 방향이고 공제를 세지 않은 것은 크게
    // 잡는 방향이다. 두 힘의 부호가 반대라 합의 부호가 정해지지 않는다.
    notices.push(
      notice(NOTICE.TAX_CAP_DIRECTION_INDETERMINATE, 'warning', 'profile.current_year_global_income_krw', {
        branch,
      }, basisRuleIds),
    );
  }
  if (capKrw === 0) {
    // 오류가 아니라 결과다. 그리고 상한이 0이면 실제 한도도 0이므로 이 구간에서는
    // 추정이 아니라 등식이다(규칙의 `exactly_provable_region`).
    notices.push(
      notice(NOTICE.TAX_CAP_ZERO, 'info', 'profile.current_year_total_salary_krw', {
        is_exact: isUpperBound,
      }, basisRuleIds),
    );
  }

  return {
    notices,
    // 같은 규약을 배분안과 축도 쓴다. 한 번 읽어 넘긴다 — 두 번 읽으면 두 규약이 된다.
    rounding,
    // **응답에 실리지 않는 정확값.** 대소 판정을 하는 자리(배분안의 자르기, 축과의 비교)가
    // 이 값을 쓴다. 응답에 싣지 않는 이유는 계약이 모든 금액을 정수 원으로 정하기 때문이고,
    // 그래서 판정과 표시가 서로 다른 값을 본다 — 그것이 §47②와 표시 규약이 다른 단계라는
    // 사실의 코드 쪽 모습이다.
    capExact,
    cap: {
      // **`null`이 없다.** 총급여액이 있으면 값이 하나로 정해진다.
      cap_krw: capKrw,
      basis_code: CAP_BASIS,
      branch_code: branch,
      // 상한 쪽 코드는 룰셋이 값으로 적어 두었고 엔진은 읽어서 낸다.
      error_direction_code: errorDirection,
      is_upper_bound: isUpperBound,
      // 상한이 0이면 실제 한도도 0 이하일 수 없으므로 정확히 0이다. 그 구간에서만 등식이다.
      is_exact: isUpperBound && capKrw === 0,
      measured_total_salary_krw: totalSalary,
      measured_global_income_krw:
        branch === CAP_BRANCH.GLOBAL_INCOME_SUPPLIED ? profile.current_year_global_income_krw : null,
      // 네 단계의 중간값. 화면이 뺄셈을 하지 않고도 「무엇에서 나온 값인지」를 말할 수 있고,
      // 정답지가 단계마다 대조할 수 있다 — 한도가 이제 **받은 값이 아니라 계산한 값**이다.
      //
      // **네 값은 표시 규약으로 버린 값이고 `tax_base_krw`만 조문으로 버린 값이다**(§47②).
      // 같은 정수처럼 보이지만 버린 근거가 다르다 — 그 구분은 `rounding.mjs`가 진다.
      wage_income_deduction_krw: wageDeductionKrw,
      wage_income_amount_krw: wageIncomeKrw,
      basic_deduction_krw: input.basicDeduction,
      tax_base_krw: taxBaseKrw,
      computed_tax_krw: computedTaxKrw,
      wage_income_credit_krw: wageCreditKrw,
      // 초과분의 세액공제액은 이월되지 않는다. 룰셋에서 읽은 사실이다.
      credit_carryforward: input.carryforward,
      basis_rule_ids: basisRuleIds,
    },
  };
}

/**
 * 이 배분안에서 **한도가 걸린다는 것이 증명되는가.**
 *
 * 추정 한도가 잘랐고 그 추정이 상한이면, 실제 한도는 그보다 작거나 같으므로 **반드시**
 * 잘린다. 자르지 않은 경우는 아무것도 증명하지 못한다 — 실제 한도는 더 작을 수 있다.
 * **문장의 부재가 「안 걸림」을 뜻하지 않는다**(D40).
 */
export function bindingCodeFor(applied, isUpperBound) {
  return applied && isUpperBound ? CAP_BINDING.PROVABLE : CAP_BINDING.NOT_DETERMINED;
}
