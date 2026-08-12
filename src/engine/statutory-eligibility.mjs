// 사람 쪽 자격 판정 두 가지 — **계좌를 열 수 있는가**와 **그 납입액으로 공제를 받을 수
// 있는가**. 두 물음은 다른 법이 정하고 답이 어긋나는 자리가 넷이다(D44).
//
//   · `irp.eligibility` — 근로자퇴직급여 보장법 §24② + 시행령 §17의 **한정 열거**.
//   · `pension.credit.taxpayer_eligibility` — 소득세법 §59조의3① 「종합소득이 있는 거주자」.
//
// **이 파일은 조문을 해석하지 않는다.** 두 규칙이 `engine_evaluation`에 분기를 코드 칸으로
// 적어 두었고, 이 파일이 하는 일은 그 칸을 읽어 분기를 고르는 것뿐이다.
//
// **산문 칸을 읽지 않는다** (D41 1번·D42 5절 (나)). 두 규칙이 `branches_reading_rule`로
// `engine_must_not_read: "basis"`를 명시한다. `basis`는 사람이 읽는 산문이고, 앞에 한
// 단어가 붙는 것만으로 판정이 뒤집히는 자리를 만들면 금액을 보는 어떤 검사도 그것을 잡지
// 못한다. **지난 회차에 `liability-cap.mjs`가 바로 그 형태의 결함을 갖고 있었다.**
// `ruleset-driven.test.mjs`가 이 파일에도 같은 검사를 건다.
//
// **분기 조건도 코드에 적지 않는다.** `when`은 `{field, op, value}` 꼴의 값이고 이 파일은
// 그것을 **일반적으로** 평가한다. 그래서 룰셋이 분기를 늘리거나 조건을 바꾸면 엔진을
// 고치지 않고도 판정이 따라 움직인다 — `tax-domain`이 요청한 새 입력 둘
// (`has_business_income_current_year`·`received_retirement_lumpsum_ever`)도 평가 문맥에
// 들어 있으므로, 룰셋이 그 필드를 `when`에 넣는 순간 값이 판정에 반영된다. **엔진이
// 그 입력의 뜻을 스스로 정하지 않는다.**
//
// **읽지 못한 칸이 있으면 값을 지어내지 않고 멈춘다.** 그것이 `rule_missing`이다.

import {
  ACCOUNT,
  EVALUATION_ORDER_FIRST_MATCH,
  IRP_OUTCOME,
  IRP_OUTCOMES,
  IRP_UNDETERMINED_TREATMENT,
  NOTICE,
  RULE,
} from './constants.mjs';
import { notice } from './limits.mjs';

/** `when` 안에서 쓸 수 있는 비교 연산. 목록에 없는 연산이 오면 판정을 지어내지 않고 멈춘다. */
const OPERATORS = {
  eq: (actual, expected) => actual === expected,
  gt: (actual, expected) => typeof actual === 'number' && typeof expected === 'number' && actual > expected,
  not_null: (actual) => actual !== null && actual !== undefined,
};

/**
 * 점으로 이은 경로를 평가 문맥에서 읽는다.
 *
 * **값이 없는 것과 필드가 없는 것을 가른다.** 룰셋이 계약에 없는 필드를 가리키면
 * `undefined`가 조용히 `null`처럼 다뤄지는 것이 가장 위험하다 — `not_null` 하나로
 * 판정이 뒤집힌다. 그래서 키의 **존재**를 보고, 없으면 `{ found: false }`를 돌린다.
 */
function readPath(context, path) {
  const keys = String(path).split('.');
  let node = context;
  for (const key of keys) {
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, key)) {
      return { found: false, value: undefined };
    }
    node = node[key];
  }
  return { found: true, value: node };
}

/** 조건 하나. 형태가 맞지 않으면 `null`(= 판정 불가)이고 그때 계산이 멈춘다. */
function testCondition(condition, context) {
  if (condition === null || typeof condition !== 'object') return null;
  const operator = OPERATORS[condition.op];
  if (operator === undefined) return null;

  const read = readPath(context, condition.field);
  if (!read.found) return null;

  return operator(read.value, condition.value);
}

/**
 * `when` 절. `all_of`는 전부, `any_of`는 하나라도 참이면 참이다.
 * 둘 다 없으면 형태가 아니므로 `null`이다 — 「조건이 없으니 언제나 참」으로 읽지 않는다.
 */
function testWhen(when, context) {
  if (when === null || typeof when !== 'object') return null;

  const groups = [
    ['all_of', (results) => results.every(Boolean)],
    ['any_of', (results) => results.some(Boolean)],
  ].filter(([key]) => Array.isArray(when[key]));

  if (groups.length === 0) return null;

  let matched = true;
  for (const [key, combine] of groups) {
    const results = when[key].map((condition) => testCondition(condition, context));
    if (results.some((result) => result === null)) return null;
    matched = matched && combine(results);
  }
  return matched;
}

/**
 * 한 규칙의 `engine_evaluation`에서 **처음 맞는 분기**를 고른다.
 *
 * 순서는 룰셋이 정한다(`evaluation_order`). 엔진이 정하지 않으므로, 그 값이 우리가 아는
 * 순서가 아니면 임의로 돌리지 않고 멈춘다.
 *
 * 읽는 칸은 셋뿐이다 — `when` · `outcome_code` · `direction_code`.
 */
function firstMatchingBranch(access, ruleId, appliedTo, context, allowedOutcomeCodes) {
  const at = (...path) => access.value(ruleId, ['value', 'engine_evaluation', ...path], appliedTo);

  const order = at('evaluation_order');
  const branches = at('branches');
  if (order === undefined || branches === undefined) return null;

  if (order !== EVALUATION_ORDER_FIRST_MATCH || !Array.isArray(branches)) {
    at('evaluation_order', 'unsupported');
    return null;
  }

  for (const branch of branches) {
    const matched = testWhen(branch?.when, context);
    if (matched === null) {
      at('branches', String(branch?.id ?? '?'), 'when');
      return null;
    }
    if (!matched) continue;

    // **코드 칸 둘이 곧 결론이다.** 하나라도 없으면 산문에서 만들어 내지 않고 멈춘다.
    if (
      typeof branch.outcome_code !== 'string' ||
      typeof branch.direction_code !== 'string' ||
      !allowedOutcomeCodes.includes(branch.outcome_code)
    ) {
      at('branches', String(branch?.id ?? '?'), 'outcome_code');
      return null;
    }
    return branch;
  }

  // 어느 분기도 맞지 않는다. 분기 밖의 답을 엔진이 만들지 않는다.
  at('branches', 'no_matching_branch');
  return null;
}

/** 두 집합이 같은가. 순서는 보지 않는다. */
function sameCodeSet(fromRuleset, transcribed) {
  if (!Array.isArray(fromRuleset) || fromRuleset.length !== transcribed.length) return false;
  return transcribed.every((code) => fromRuleset.includes(code));
}

/**
 * 그 분기를 닫을 수 있는 입력의 id. 룰셋의 `requested_inputs[].closes_branch`가 코드 칸이다.
 *
 * **화면이 언제 물어야 하는지를 값으로 낸다.** 이 목록이 비어 있지 않은 분기에서만 그
 * 물음이 뜨고, 대다수 사용자에게는 분기 자체가 걸리지 않아 입력이 늘지 않는다.
 */
function closingInputIdsFor(requestedInputs, branchId) {
  if (!Array.isArray(requestedInputs)) return [];
  return requestedInputs
    .filter((input) => input?.closes_branch === branchId && typeof input.id === 'string')
    .map((input) => input.id)
    .sort();
}

/**
 * IRP를 **설정할 수 있는 사람인가**.
 *
 * 결론은 세 갈래다(룰셋의 `allowed_outcome_codes`).
 *
 *   · 자격 있음 — 배분에서 아무것도 하지 않는다.
 *   · 자격 없음 — 배분에서 뺀다. 사유 코드를 함께 낸다.
 *   · **미정** — **빼지 않는다.** 이 분기에는 조문상 자격이 확실한 사람(사업소득자)이
 *     섞여 있고, 막았는데 자격이 있었다면 사용자는 화면이 「불가」라고 했으므로 확인하러
 *     가지도 않는다 — **스스로 드러나지 않는 오류**다. 안 막았는데 자격이 없으면 계좌를
 *     열러 갔다가 그 자리에서 드러난다. 드러나지 않는 쪽을 피한다(D44 판정 1).
 *     화면이 적어야 하는 것은 「불가」가 아니라 **「확인이 필요하다」**이고, 그 구분이
 *     `irp_eligibility_not_determined` 코드로 나간다.
 */
export function resolveIrpEligibility(access, { profile, accounts }) {
  const appliedTo = 'account_eligibility[retirement_pension]';
  const at = (...path) => access.value(RULE.IRP_ELIGIBILITY, ['value', 'engine_evaluation', ...path], appliedTo);

  const allowed = at('allowed_outcome_codes');
  if (allowed === undefined) return null;
  if (!sameCodeSet(allowed, IRP_OUTCOMES)) {
    // 룰셋이 결론 어휘를 바꿨는데 엔진이 그 뜻을 모른다. 옛 뜻으로 계속 도는 것이
    // 가장 나쁜 결과이므로 멈춘다.
    at('allowed_outcome_codes', 'unknown_vocabulary');
    return null;
  }

  // **코드 이름의 정의 자리는 계약이다** — 룰셋이 스스로 그렇게 적었다(`code_ownership_note`).
  // 그래서 엔진이 내는 것은 계약 상수이고, 룰셋이 요청한 이름과 갈라지면 조용히 다른
  // 코드를 내보내지 않고 멈춘다. 이 대조가 없으면 이름이 어긋난 채로 화면에 나간다.
  const reasonCode = at('requested_reason_code');
  const noticeCode = at('requested_notice_code');
  const requestedInputs = at('requested_inputs');
  if (reasonCode === undefined || noticeCode === undefined || requestedInputs === undefined) return null;
  if (
    reasonCode !== NOTICE.IRP_EXCLUDED_NO_QUALIFYING_STATUS ||
    noticeCode !== NOTICE.IRP_ELIGIBILITY_NOT_DETERMINED
  ) {
    at('requested_reason_code', 'diverged_from_contract');
    return null;
  }

  const branch = firstMatchingBranch(access, RULE.IRP_ELIGIBILITY, appliedTo, { profile, accounts }, allowed);
  if (branch === null) return null;

  // 미정 분기에는 룰셋이 처리 방침을 코드로 적어 두었다. 그 값이 우리가 아는 것이
  // 아니면 배제/비배제를 엔진이 고르지 않고 멈춘다.
  if (
    branch.default_treatment !== undefined &&
    branch.default_treatment !== IRP_UNDETERMINED_TREATMENT.DO_NOT_EXCLUDE
  ) {
    at('branches', String(branch.id), 'default_treatment');
    return null;
  }

  const excluded = branch.outcome_code === IRP_OUTCOME.NOT_ELIGIBLE;
  const undetermined = branch.outcome_code === IRP_OUTCOME.UNDETERMINED;
  const closingInputIds = closingInputIdsFor(requestedInputs, branch.id);
  const params = {
    account: ACCOUNT.PENSION,
    branch: branch.id,
    error_direction: branch.direction_code,
    // 이 분기를 닫는 입력. 화면이 **이 분기에서만** 그 물음을 띄우게 하는 값이다.
    closing_input_ids: closingInputIds,
  };

  const notices = [];
  if (excluded) {
    notices.push(
      notice(
        NOTICE.IRP_EXCLUDED_NO_QUALIFYING_STATUS,
        'warning',
        'profile.current_year_total_salary_krw',
        params,
        [RULE.IRP_ELIGIBILITY],
      ),
    );
  } else if (undetermined) {
    // **침묵하면 안 된다.** 빼지 않는다는 것은 「자격이 있다」가 아니다.
    notices.push(
      notice(
        NOTICE.IRP_ELIGIBILITY_NOT_DETERMINED,
        'warning',
        'profile.has_non_wage_global_income_current_year',
        params,
        [RULE.IRP_ELIGIBILITY],
      ),
    );
  }

  return {
    notices,
    outcomeCode: branch.outcome_code,
    directionCode: branch.direction_code,
    branchId: branch.id,
    excluded,
    undetermined,
    reasonCode: excluded ? NOTICE.IRP_EXCLUDED_NO_QUALIFYING_STATUS : null,
    closingInputIds,
    basisRuleIds: [RULE.IRP_ELIGIBILITY],
  };
}

/**
 * 그 납입액으로 **세액공제를 받을 수 있는 사람인가**. 소득세법 §59조의3①.
 *
 * **가입 자격과 다른 축이다.** 이자·배당소득만 있는 사람은 IRP를 못 열지만 연금저축으로는
 * 공제를 받는다. 반대로 그 해에 퇴직소득만 있는 사람은 IRP를 열 수 있어도 공제는 0이다.
 *
 * **이 판정은 현재 입력만으로 완전히 끝난다**(`decidable_from_current_inputs: true`).
 * 요건을 갖추지 못한 사람의 공제액 0은 추정이 아니라 **조문에서 나오는 등식**이고, 그것이
 * 「산출세액이 0이라 잘렸다」와 다른 사실이다. **금액은 같고 화면이 쓸 문장이 다르다**(D44).
 *
 * **어느 결론이 「0」인지는 룰셋이 가리킨다** — 이 규칙에서는 `requested_notice_code`가 곧
 * 그 분기의 결론 코드이고, 엔진은 그 대응을 따로 들고 있지 않다. **다만 코드 이름 자체의
 * 정의 자리는 계약이므로**(룰셋의 `code_ownership_note`) 계약 상수와도 견주고, 갈라지면
 * 다른 코드를 조용히 내보내지 않고 멈춘다. 두 대조가 막는 것이 다르다 — 앞은 **구조**가
 * 바뀌는 것을, 뒤는 **이름**이 갈라지는 것을 막는다.
 */
export function resolvePensionCreditEligibility(access, { profile }) {
  const appliedTo = 'pension_credit_taxpayer_eligibility.outcome_code';
  const at = (...path) =>
    access.value(RULE.CREDIT_TAXPAYER_ELIGIBILITY, ['value', 'engine_evaluation', ...path], appliedTo);

  // **어느 결론이 「0」인가를 룰셋이 가리킨다.** 이 규칙에서는 요청한 안내 코드가 곧 그
  // 분기의 결론 코드이고(`requested_notice_code` ∈ `allowed_outcome_codes`), 엔진은 그
  // 대응을 따로 알고 있지 않다. 이름 자체의 정의 자리는 계약이므로 계약 상수와도 견준다.
  const allowed = at('allowed_outcome_codes');
  const zeroCode = at('requested_notice_code');
  if (allowed === undefined || zeroCode === undefined) return null;
  if (
    !Array.isArray(allowed) ||
    !allowed.includes(zeroCode) ||
    zeroCode !== NOTICE.PENSION_CREDIT_ZERO_NO_GLOBAL_INCOME
  ) {
    at('requested_notice_code', 'not_in_allowed_outcome_codes');
    return null;
  }

  const branch = firstMatchingBranch(
    access,
    RULE.CREDIT_TAXPAYER_ELIGIBILITY,
    appliedTo,
    { profile },
    allowed,
  );
  if (branch === null) return null;

  const requirementMet = branch.outcome_code !== zeroCode;
  const notices = [];
  if (!requirementMet) {
    notices.push(
      notice(
        NOTICE.PENSION_CREDIT_ZERO_NO_GLOBAL_INCOME,
        'info',
        'profile.has_non_wage_global_income_current_year',
        {
          branch: branch.id,
          // 룰셋이 이 분기에 `is_exact`를 적어 두었다. 추정이 아니라 등식이라는 뜻이고,
          // 그 구분이 화면 문장을 가른다.
          is_exact: branch.is_exact === true,
        },
        [RULE.CREDIT_TAXPAYER_ELIGIBILITY],
      ),
    );
  }

  return {
    notices,
    eligibility: {
      outcome_code: branch.outcome_code,
      branch_code: branch.id,
      direction_code: branch.direction_code,
      requirement_met: requirementMet,
      is_exact: branch.is_exact === true,
      basis_rule_ids: [RULE.CREDIT_TAXPAYER_ELIGIBILITY],
    },
  };
}

/**
 * 연금저축계좌를 **연령·소득으로 빼지 않는다**는 사실을 규칙에서 읽는다.
 *
 * 이 규칙이 기록하는 것은 **부재**다 — 세법에 가입 연령 하한도 소득 요건도 없다. 부재를
 * 코드에 「아무것도 하지 않음」으로만 두면 근거 목록에 그 사실이 남지 않고, 나중에 규칙이
 * 생겨도 엔진이 조용히 옛 동작을 이어 간다. 그래서 **읽고**, 값이 우리가 아는 것이
 * 아니면 멈춘다.
 */
export function resolveAnnuitySavingsEligibility(access) {
  const appliedTo = 'account_eligibility[annuity_savings]';
  const excludes = access.value(
    RULE.PENSION_SAVINGS_ELIGIBILITY,
    ['value', 'engine_evaluation', 'excludes_account'],
    appliedTo,
  );
  if (excludes === undefined) return null;
  if (excludes !== false) {
    // 규칙이 빼라고 말하기 시작했는데 무엇으로 빼는지는 적혀 있지 않다. 지어내지 않는다.
    access.value(RULE.PENSION_SAVINGS_ELIGIBILITY, ['value', 'engine_evaluation', 'exclusion_code'], appliedTo);
    return null;
  }
  return { excludes: false, basisRuleIds: [RULE.PENSION_SAVINGS_ELIGIBILITY] };
}
