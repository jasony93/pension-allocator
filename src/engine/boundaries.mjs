// fund_use_horizon 선택지의 경계 연수.
// compute와 computeFundUseHorizonBoundaries가 **같은 함수**를 쓴다 —
// engine-interface.md 9절이 "바이트 단위로 같아야 한다"를 구현 조건으로 박았다.
// 두 곳에서 따로 조립하면 키 순서 하나로 캡션이 어긋난다.

import { ERROR, RULE, SCENARIO_ORDER } from './constants.mjs';
import { clampToZero } from './ratio.mjs';
import { createAccess, selectRulesets, buildLegalBasis } from './ruleset.mjs';

const APPLIED_TO = 'fund_use_horizon_boundaries';

/**
 * 경계값 본체. 이 함수 하나가 두 진입점의 유일한 출처다.
 * 규칙을 읽으면서 access에 근거를 등록하므로, 호출한 쪽의 legal_basis에 그대로 실린다.
 */
export function boundariesFrom(access, { ageYears, isaExists, isaYearsSinceOpening }) {
  const lockInYears = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'min_contract_years'],
    APPLIED_TO,
  );
  // 의무가입기간이 왜 경계인지의 근거는 추징 규칙이다. 읽었으므로 근거에 남긴다.
  access.use(RULE.ISA_CLAWBACK, APPLIED_TO);

  const minAge = readPensionMinAge(access);

  const tenure = isaYearsSinceOpening ?? 0;
  const lockInRemaining =
    lockInYears === undefined
      ? null
      : isaExists
        ? clampToZero(lockInYears - tenure)
        : lockInYears;

  return {
    isa_lock_in_years: lockInYears ?? null,
    isa_lock_in_years_remaining: lockInRemaining,
    pension_min_age_years: minAge ?? null,
    pension_years_remaining: minAge === undefined ? null : clampToZero(minAge - ageYears),
    // 연금계좌 가입 경과연수를 입력으로 받지 않아 보유기간 요건은 판정하지 않는다.
    // 추정으로 메우지 않고 판정하지 않았다는 사실을 값으로 내보낸다.
    pension_holding_period_evaluated: false,
    basis_rule_ids: [RULE.ISA_ACCOUNT_REQUIREMENTS, RULE.ISA_CLAWBACK, RULE.PENSION_WITHDRAWAL_ELIGIBILITY].sort(),
  };
}

function readPensionMinAge(access) {
  const requirements = access.value(
    RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
    ['value', 'requirements'],
    APPLIED_TO,
  );
  if (requirements === undefined) return undefined;

  const age = requirements.find((r) => r?.id === 'age');
  if (!age || typeof age.min_age !== 'number') {
    access.value(RULE.PENSION_WITHDRAWAL_ELIGIBILITY, ['value', 'requirements', 'age', 'min_age'], APPLIED_TO);
    return undefined;
  }
  return age.min_age;
}

/**
 * 읽기 전용 진입점의 본체. 자체 access를 만들어 근거까지 함께 낸다.
 * 소득·납입액·예산을 받지 않는다.
 */
export function boundariesSource(input, rulesets, scenarioId, taxYear) {
  const selection = selectRulesets(rulesets, taxYear, scenarioId ?? SCENARIO_ORDER[0]);
  if (selection.errors) return { ok: false, errors: selection.errors };

  const access = createAccess(selection);
  const boundaries = boundariesFrom(access, input);

  const missing = access.missing();
  if (missing.length > 0) return { ok: false, errors: dedupeErrors(missing) };

  return { ok: true, boundaries, access };
}

export function dedupeErrors(errors) {
  const seen = new Set();
  const out = [];
  for (const error of errors) {
    const key = `${error.code}|${error.field}|${JSON.stringify(error.params)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(error);
  }
  return out;
}

export { buildLegalBasis, ERROR };
