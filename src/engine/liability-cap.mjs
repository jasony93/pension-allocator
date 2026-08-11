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
// 엔진이 정하지 않는다 — 분기의 `direction` 문자열이 규칙의 상한 코드로 시작하는지만 본다.
//
// **세법 수치는 한 개도 이 파일에 없다.** 구간 경계·비율·기본공제액·근로소득세액공제
// 한도는 전부 룰셋에서 온다. 제2항 한도는 룰셋이 산식을 **문자열**로 적어 두었으므로
// 그 문자열을 기계적으로 읽는다(`limits.mjs`의 `readTenureCap`과 같은 방식이다).

import {
  CAP_BASIS,
  CAP_BRANCH,
  CAP_BINDING,
  CAP_DIRECTION_INDETERMINATE,
  NOTICE,
  RULE,
} from './constants.mjs';
import { notice } from './limits.mjs';
import { applyRate, clampToZero } from './ratio.mjs';

/** 이 계산이 읽는 규칙 전부. 근거 목록에 이 다섯이 함께 실린다. */
export const CAP_ESTIMATE_RULE_IDS = [
  RULE.BASIC_DEDUCTION_SELF,
  RULE.BASIC_TAX_RATE,
  RULE.CREDIT_TAX_CAP,
  RULE.CREDIT_TAX_CAP_ESTIMATE,
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
 * 원 미만은 버린다. `base_krw`가 정수이므로 `base + floor(excess × rate)`가 곧
 * `floor(base + excess × rate)`다.
 */
function bracketAmount(brackets, maxKey, x) {
  if (!Array.isArray(brackets)) return null;
  const bracket = brackets.find((b) => (b?.[maxKey] ?? null) === null || x <= b[maxKey]);
  if (bracket === undefined) return null;
  if (typeof bracket.base_krw !== 'number' || typeof bracket.threshold_krw !== 'number') return null;

  const excess = applyRate(clampToZero(x - bracket.threshold_krw), bracket.rate_on_excess);
  if (excess === null) return null;
  return bracket.base_krw + excess;
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
  if (typeof bracket.limit_krw === 'number') return bracket.limit_krw;

  const match = LIMIT_FORMULA.exec(String(bracket.formula ?? '').trim());
  if (match === null || typeof bracket.floor_krw !== 'number') return null;

  const [base, threshold, numerator, denominator] = match.slice(1).map(Number);
  if (denominator === 0) return null;

  // 산식 전체를 한 번에 절사한다. 빼는 항을 먼저 절사하면 한도가 1원 커지고,
  // 한도가 커지면 공제가 커져 **한도가 작아진다** — 방향이 있는 자리다.
  const limit = Math.floor((base * denominator - clampToZero(totalSalary - threshold) * numerator) / denominator);
  return Math.max(limit, bracket.floor_krw);
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
 * 분기의 `direction`이 규칙의 상한 코드로 시작하면 상한이고, 아니면 미정이다. 산문을
 * 파싱해 코드를 **만들지** 않는다 — 상한이라고 읽을 근거가 없으면 상한이 아닌 쪽으로 둔다.
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

  if (Object.values(input).some((value) => value === undefined)) return { cap: null, notices };

  const branch = branchOf(profile);
  const branchNode = input.branches[branch];
  if (branchNode === undefined || typeof branchNode.direction !== 'string') {
    access.value(RULE.CREDIT_TAX_CAP_ESTIMATE, ['value', 'branches', branch, 'direction'], appliedTo);
    return { cap: null, notices };
  }

  const isUpperBound = branchNode.direction.startsWith(input.upperBoundCode);
  const totalSalary = profile.current_year_total_salary_krw;

  // 1단계. 공제액이 총급여액을 넘지 못하고(§47③) 2천만원 상한이 걸린다(§47① 단서).
  const bracketDeduction = bracketAmount(input.deductionBrackets, 'total_salary_max_krw', totalSalary);
  if (bracketDeduction === null) {
    access.value(RULE.WAGE_INCOME_DEDUCTION, ['value', 'brackets', 'base_krw'], appliedTo);
    return { cap: null, notices };
  }
  const wageDeduction = Math.min(bracketDeduction, input.deductionCap, totalSalary);
  const wageIncome = totalSalary - wageDeduction;

  // 2단계. 종합소득금액을 받았으면 그것이 조문상의 합산 기준 그 자체다 — 근로소득공제를
  // 다시 빼지 않는다.
  const globalIncome =
    branch === CAP_BRANCH.GLOBAL_INCOME_SUPPLIED ? profile.current_year_global_income_krw : wageIncome;
  const taxBase = clampToZero(globalIncome - input.basicDeduction);

  // 3단계.
  const computedTax = bracketAmount(input.rateBrackets, 'tax_base_max_krw', taxBase);
  if (computedTax === null) {
    access.value(RULE.BASIC_TAX_RATE, ['value', 'brackets', 'base_krw'], appliedTo);
    return { cap: null, notices };
  }

  // 4단계. 제1항이 재는 것은 **그 근로소득에 대한** 산출세액이다. 근로소득 외의 소득이
  // 있으면 근로소득금액이 종합소득금액에서 차지하는 비율로 안분한다. 근로소득금액은
  // 종합소득금액의 구성요소이므로 그 비율은 1을 넘지 않는다.
  const wagePortionTax =
    globalIncome > 0 ? Math.floor((computedTax * Math.min(wageIncome, globalIncome)) / globalIncome) : 0;

  const creditByAmount = bracketAmount(
    input.creditAmountBrackets,
    'wage_income_tax_max_krw',
    wagePortionTax,
  );
  const creditLimit = wageCreditLimit(input.creditLimitBrackets, totalSalary);
  if (creditByAmount === null || creditLimit === null) {
    access.value(RULE.WAGE_INCOME_CREDIT, ['value', 'limit_brackets', 'formula'], appliedTo);
    return { cap: null, notices };
  }
  // 제1항으로 공제액을 구한 뒤 제2항의 한도로 자른다(규칙의 `apply_order`).
  const wageCredit = Math.min(creditByAmount, creditLimit);

  const capKrw = clampToZero(computedTax - wageCredit);
  const errorDirection = isUpperBound ? input.upperBoundCode : CAP_DIRECTION_INDETERMINATE;
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
      wage_income_deduction_krw: wageDeduction,
      wage_income_amount_krw: wageIncome,
      basic_deduction_krw: input.basicDeduction,
      tax_base_krw: taxBase,
      computed_tax_krw: computedTax,
      wage_income_credit_krw: wageCredit,
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
