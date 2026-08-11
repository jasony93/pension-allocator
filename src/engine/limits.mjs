// 한도와 비율 산출. 모든 수치는 access를 통해 룰셋에서만 온다.
// 납입할 수 있는 한도와 세액공제를 받을 수 있는 한도는 다른 것이고,
// 룰셋도 두 규칙군으로 나눠 두었다(engine-interface.md 5.3절).

import {
  ACCOUNT,
  ACCOUNT_TYPE_IN_RULESET,
  ANNUITY_START,
  CEILING_CAP_RELATION,
  CEILING_MEANING,
  CEILING_PERIOD,
  CEILING_RATE_SOURCE,
  CREDIT_RATE_BASIS,
  CREDIT_RATE_FALLBACK_DIRECTION,
  ERROR,
  NOTICE,
  PENSION_ACCOUNT_KEYS,
  RULE,
  SCENARIO,
  START_DATE_REASON,
} from './constants.mjs';
import {
  addYears,
  ageOn,
  compareDates,
  endOfTaxYear,
  formatIsoDate,
  maxDate,
  yearsUntil,
} from './dates.mjs';
import { applyRate, clampToZero, effectiveRate } from './ratio.mjs';

/** 룰셋 산식에서 경과연수 상한을 읽는다. 숫자를 코드에 박지 않기 위한 것이다. */
function readTenureCap(formula) {
  const match = /min\([^,]*,\s*(\d+)\s*\)/.exec(formula);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/** 상한이 하나도 없는 구간 = 조문 본문의 구간. 대괄호 안의 예외가 아닌 쪽이다. */
const isDefaultBracket = (b) =>
  (b?.global_income_max_krw ?? null) === null && (b?.total_salary_only_max_krw ?? null) === null;

/**
 * 공제율 구간을 **무엇으로 판정할지**를 고른다.
 *
 * 이 함수가 하는 일은 값을 만드는 것이 아니라 **축을 고르는 것**이다. 축은
 * `pension.credit.rate.basis_determination`이 정하고, 그 규칙의 `required_inputs.decision_order`가
 * 두 단계임을 스스로 선언한다 — 선언이 없거나 형태가 다르면 계산을 멈춘다(대체값을 만들지 않는다).
 *
 * **총급여액을 종합소득금액으로 환산하지 않는다.** 소괄호의 총급여 기준은 환산 편의가
 * 아니라 그 구간에서 더 엄격한 규정이고, 환산하면 순수 근로소득자에게 우대 구간을
 * 잘못 준다(규칙의 `parenthetical_is_stricter_not_a_conversion`).
 */
function resolveCreditRateBasis(access, profile) {
  const appliedTo = 'echo.credit_rate_bracket.basis_code';
  const order = access.value(
    RULE.CREDIT_RATE_BASIS,
    ['value', 'required_inputs', 'decision_order'],
    appliedTo,
  );
  if (order === undefined) return null;

  // 규칙이 "두 물음이 모두 필요하다"고 선언한 그 구조에 엔진이 실제로 매여 있는지 본다.
  const boolean = order.find((step) => step?.type === 'boolean');
  const amount = order.find((step) => typeof step?.type === 'string' && step.type.startsWith('integer'));
  if (boolean === undefined || amount === undefined) {
    access.value(
      RULE.CREDIT_RATE_BASIS,
      ['value', 'required_inputs', 'decision_order', 'two_steps'],
      appliedTo,
    );
    return null;
  }

  if (profile.has_non_wage_global_income_current_year !== true) {
    return { code: CREDIT_RATE_BASIS.TOTAL_SALARY, amount: profile.current_year_total_salary_krw };
  }
  if (profile.current_year_global_income_krw !== null) {
    return { code: CREDIT_RATE_BASIS.GLOBAL_INCOME, amount: profile.current_year_global_income_krw };
  }

  // 금액을 모른다. **지어내지 않는다.** 대괄호 안의 예외를 적용하지 않고 본문으로 간다.
  // 규칙이 그 정책과 근거를 스스로 적고 있으므로 그 자리를 읽어 근거로 삼는다.
  const policy = access.value(
    RULE.CREDIT_RATE_BASIS,
    ['value', 'unknown_value_policy', 'recommended_fallback'],
    appliedTo,
  );
  if (policy === undefined) return null;
  return { code: CREDIT_RATE_BASIS.STATUTORY_DEFAULT, amount: null };
}

/** 고른 축으로 구간을 고른다. 법문이 '이하'이므로 경계값은 그 구간에 든다. */
function selectBracket(brackets, basis) {
  if (basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT) {
    return brackets.find(isDefaultBracket);
  }
  const ceiling =
    basis.code === CREDIT_RATE_BASIS.TOTAL_SALARY
      ? (b) => b?.total_salary_only_max_krw ?? null
      : (b) => b?.global_income_max_krw ?? null;

  return brackets.find((b) => ceiling(b) === null || basis.amount <= ceiling(b));
}

export function resolveRates(access, { profile, scenarioId }) {
  const notices = [];

  const brackets = access.value(RULE.CREDIT_RATE, ['value', 'brackets'], 'echo.credit_rate_bracket');
  const basis = resolveCreditRateBasis(access, profile);

  let incomeTaxRate;
  if (brackets !== undefined && basis !== null) {
    const bracket = selectBracket(brackets, basis);
    if (bracket === undefined || typeof bracket.rate !== 'number') {
      access.value(RULE.CREDIT_RATE, ['value', 'brackets', 'rate'], 'echo.credit_rate_bracket');
    } else {
      incomeTaxRate = bracket.rate;
    }
  }

  if (basis !== null && basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT) {
    // 이 사실이 금액과 같은 화면에 붙어야 한다(규칙의 required_display).
    notices.push(
      notice(
        NOTICE.CREDIT_RATE_GLOBAL_INCOME_MISSING,
        'warning',
        'profile.current_year_global_income_krw',
        { error_direction: CREDIT_RATE_FALLBACK_DIRECTION },
        [RULE.CREDIT_RATE, RULE.CREDIT_RATE_BASIS].sort(),
      ),
    );
  }

  const surtaxRate = access.value(
    RULE.LOCAL_SURTAX,
    ['value', 'rate_of_income_tax'],
    'plans[].deterministic_benefit.pension_credit_local_tax_krw',
  );

  let youthIrpRate = null;
  if (scenarioId === SCENARIO.PROPOSED) {
    if (profile.declared_youth === true) {
      const rate = access.value(
        RULE.PROPOSED_YOUTH_IRP_RATE,
        ['value', 'rate'],
        'plans[].deterministic_benefit.pension_credit_income_tax_krw',
      );
      if (rate !== undefined) youthIrpRate = rate;
      notices.push(notice(NOTICE.YOUTH_AGE_UNDETERMINED, 'warning', 'profile.declared_youth', {}, [
        RULE.PROPOSED_YOUTH_IRP_RATE,
      ]));
    } else {
      // 엔진이 나이로 청년 여부를 판정하지 않는다. 연령 범위가 시행령 위임이고 미공개다.
      notices.push(notice(NOTICE.YOUTH_NOT_DECLARED, 'info', 'profile.declared_youth', {}, []));
    }
  }

  return {
    notices,
    rates: {
      basis,
      incomeTaxRate: incomeTaxRate ?? null,
      surtaxRate: surtaxRate ?? null,
      youthIrpRate,
      effective:
        incomeTaxRate !== undefined && surtaxRate !== undefined
          ? effectiveRate(incomeTaxRate, surtaxRate)
          : null,
    },
  };
}

/**
 * 세제상 동점일 때 쓸 연금계좌 순서를 룰셋에서 읽는다.
 *
 * `pension.withdrawal.midterm_restriction`이 두 계좌의 **인출 가능성 비대칭**을 사실로
 * 정한다 — 퇴직연금은 시행령이 열거한 사유에만 부분 인출이 되고, 연금저축에는 그런
 * 제한이 없다. 과세는 두 계좌가 같으므로 이 규칙은 세액을 바꾸지 않는다.
 *
 * **결론(어느 쪽을 먼저 채울지)은 룰셋이 정하지 않는다**(규칙의 product_note).
 * 엔진이 읽는 것은 `partial_withdrawal_without_statutory_cause`라는 사실이고,
 * "동점이면 덜 묶이는 쪽을 먼저"라는 판단은 제품 결정이다(engine-design.md 3.3절).
 *
 * 사유 '목록'은 미확정이므로 목록에 의존하지 않는다. 쓰는 것은 열거주의라는 구조뿐이다.
 */
export function resolveWithdrawalOrder(access) {
  const appliedTo = 'plans[].priority_basis';
  const byAccount = access.value(
    RULE.PENSION_MIDTERM_RESTRICTION,
    ['value', 'by_account'],
    appliedTo,
  );
  if (byAccount === undefined) return null;

  const flexible = {};
  for (const account of [ACCOUNT.PENSION, ACCOUNT.ANNUITY]) {
    const node = byAccount[ACCOUNT_TYPE_IN_RULESET[account]];
    if (node === undefined || typeof node.partial_withdrawal_without_statutory_cause !== 'boolean') {
      access.value(
        RULE.PENSION_MIDTERM_RESTRICTION,
        ['value', 'by_account', ACCOUNT_TYPE_IN_RULESET[account], 'partial_withdrawal_without_statutory_cause'],
        appliedTo,
      );
      return null;
    }
    flexible[account] = node.partial_withdrawal_without_statutory_cause;
  }

  // 인출이 자유로운 계좌를 앞에 둔다. 정렬이 안정적이므로 두 계좌의 조건이 같으면
  // 기존 고정 순서가 그대로 유지된다 — 결정성이 깨지지 않는다.
  return [ACCOUNT.PENSION, ACCOUNT.ANNUITY].sort(
    (a, b) => Number(flexible[b]) - Number(flexible[a]),
  );
}

/**
 * 만 나이의 계산 방법과 그 기준일 — 규칙이 주는 것은 **날짜가 아니라 판정 시점**이다.
 *
 * **규칙이 생겼다고 가정이 사라지지 않는다.** 규칙의 결론은 "단일 기준일이 존재하지
 * 않는다"이고, 그러므로 엔진이 쓰는 과세기간 종료일은 여전히 룰셋에서 나온 값이 아니다.
 * 달라진 것은 `false`의 뿌리다 — 전에는 규칙의 **부재**였고 지금은 규칙의 **내용**이다.
 *
 * **어느 요건이 기준일을 필요로 하는지는 응답에 싣는다.** 나이를 정수로 환산해 비교하는
 * 경로에만 이 가정이 걸리고, 연금 쪽은 날짜 대 날짜로 비교하므로 걸리지 않는다 —
 * 그 사실은 `pension_withdrawal_start`가 이미 날짜로 말하고 있다. 가정이 전체 계산에
 * 걸리는 것처럼 보이지 않게 하려면 **걸리는 요건의 이름**이 값으로 나가야 한다.
 * 목록은 룰셋에서 읽는다 — 엔진이 세어 두면 요건이 늘 때 조용히 낡는다.
 */
export function resolveAgeReckoning(access) {
  const appliedTo = 'echo.derived_age.reference_date';
  const perRule = access.value(
    RULE.AGE_RECKONING,
    ['value', 'no_single_reference_date', 'per_rule'],
    appliedTo,
  );
  if (perRule === undefined) return null;

  return {
    // 규칙은 있고, 그 규칙이 기준일을 하나로 정해 주지 않는다.
    reference_date_from_ruleset: false,
    requires_reference_date_rule_ids: perRule
      .filter((entry) => entry?.needs_reference_date === true)
      .map((entry) => entry.rule_id)
      .sort(),
    basis_rule_ids: [RULE.AGE_RECKONING],
  };
}

/**
 * 확정 축(세액공제)의 **최댓값** — 이 사람이 올해 받을 수 있는 세액공제의 상한.
 *
 * D36이 막대의 축을 둘로 가르면서 확정 축에 자기 눈금이 필요해졌다. 그 눈금의 끝이
 * 이 값이고, **합산 인정한도를 전액 채웠을 때의 세액공제액**이다.
 *
 * **소득세분만 내지 않는다.** 막대에 실리는 금액은 `pension_credit_total_krw`
 * (소득세분 + 개인지방소득세분)이므로, 축의 끝도 같은 자로 재야 한다. 소득세분만으로
 * 축을 만들면 한도를 채운 사람의 막대가 트랙 밖으로 나간다(부가율만큼 길어진다).
 *
 * **공제율은 이 사람에게 걸릴 수 있는 것 중 가장 높은 것이다.** 확정 시나리오에서는
 * 계좌에 따라 율이 갈리지 않아 `credit_rate_bracket`의 율 하나뿐이다. 개정안 시나리오의
 * 청년 우대는 퇴직연금 납입분에만 걸리는데 **그 계좌에는 단독 한도가 없어**(합산 한도
 * 규칙의 `asymmetry_is_statutory`) 합산 한도 전액을 그 율로 채울 수 있다. 낮은 쪽으로
 * 축을 만들면 실제 공제액이 축을 넘는다.
 *
 * **산출세액 한도(`pension.credit.tax_liability_cap`)를 이 값에 반영하지 않는다.**
 * 근거는 engine-design.md 9.2절이고, 걸리는지 여부는 `tax_liability_cap_relation_code`로
 * 따로 낸다.
 */
export function resolvePensionCreditCeiling(access, { rates, combinedLimit, extraCreditLimitKrw, cap }) {
  const appliedTo = 'pension_credit_ceiling.ceiling_krw';
  // 한도와 율은 이미 읽은 규칙에서 나오지만, **이 값이 무엇에 매여 있는지**가 근거로
  // 함께 나가야 한다. 읽은 자리를 다시 등록해 legal_basis의 applied_to에 이 축을 남긴다.
  access.markUsed(RULE.CREDIT_LIMIT_COMBINED, appliedTo);
  access.markUsed(RULE.CREDIT_RATE, appliedTo);
  access.markUsed(RULE.LOCAL_SURTAX, appliedTo);

  const useYouthRate = rates.youthIrpRate !== null && rates.youthIrpRate > rates.incomeTaxRate;
  const incomeTaxRate = useYouthRate ? rates.youthIrpRate : rates.incomeTaxRate;
  const basisRuleIds = [RULE.CREDIT_LIMIT_COMBINED, RULE.CREDIT_RATE, RULE.LOCAL_SURTAX];
  if (useYouthRate) {
    access.markUsed(RULE.PROPOSED_YOUTH_IRP_RATE, appliedTo);
    basisRuleIds.push(RULE.PROPOSED_YOUTH_IRP_RATE);
  }

  // 배분안이 쓰는 것과 **같은 두 단계**다. 다른 산술을 쓰면 한도를 채운 사람에게서
  // 축과 막대가 1원 어긋난다.
  const incomeTaxKrw = applyRate(combinedLimit, incomeTaxRate);
  const localTaxKrw = incomeTaxKrw === null ? null : applyRate(incomeTaxKrw, rates.surtaxRate);
  if (incomeTaxKrw === null || localTaxKrw === null) return null;

  // **소득세분끼리 비교한다.** 한도는 산출세액에서 나온 소득세의 값이고 상한의 합계는
  // 지방소득세를 포함하므로, 둘을 그대로 비교하면 단위가 다른 두 수를 재는 것이 된다.
  //
  // **`cap_at_or_above_ceiling`은 「걸리지 않는다」가 아니다.** 한도가 상한이므로 실제
  // 한도는 이보다 작을 수 있다. 이 코드로 화면이 「여유가 있습니다」를 적으면 거짓이 될
  // 수 있고, 그 구분은 배분안의 `binding_code`가 낸다(D40).
  const capRelation =
    cap.cap_krw < incomeTaxKrw ? CEILING_CAP_RELATION.BELOW : CEILING_CAP_RELATION.AT_OR_ABOVE;

  return {
    ceiling_krw: incomeTaxKrw + localTaxKrw,
    income_tax_krw: incomeTaxKrw,
    local_tax_krw: localTaxKrw,
    credit_limit_krw: combinedLimit,
    isa_transfer_extra_limit_krw: extraCreditLimitKrw,
    income_tax_rate: incomeTaxRate,
    local_tax_rate: rates.surtaxRate,
    effective_rate: effectiveRate(incomeTaxRate, rates.surtaxRate),
    rate_source_code: useYouthRate
      ? CEILING_RATE_SOURCE.PROPOSED_YOUTH_IRP_RATE
      : CEILING_RATE_SOURCE.CREDIT_RATE_BRACKET,
    // 공제율 구간의 불확실성을 그대로 물려받는다. 구간을 모른 채 본문 구간을 쓴
    // 사람에게 이 상한이 단일 수로 나가면 안 된다 — 실제 상한은 이보다 높을 수 있다.
    basis_code: rates.basis.code,
    measured_amount_krw: rates.basis.amount,
    fallback_applied: rates.basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT,
    fallback_direction_code:
      rates.basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT
        ? CREDIT_RATE_FALLBACK_DIRECTION
        : null,
    tax_liability_cap_relation_code: capRelation,
    // 축의 끝이 0이면 눈금이 성립하지 않는다(모든 막대가 0/0이 된다).
    // 화면이 나눗셈 앞에서 이 값을 먼저 보게 한다.
    is_axis_degenerate: incomeTaxKrw + localTaxKrw === 0,
    period_code: CEILING_PERIOD,
    meaning_code: CEILING_MEANING,
    basis_rule_ids: [...new Set(basisRuleIds)].sort(),
  };
}

/**
 * 연금으로 꺼낼 수 있는 가장 이른 시점 = max(만 55세가 되는 날, 가입일부터 5년이 되는 날).
 * 이연퇴직소득이 있는 계좌는 5년 요건이 면제되므로 나이 요건만으로 정해진다.
 *
 * **남은 기간을 배분 비율로 옮기지 않는다.** 세법이 정하는 것은 시점과 그 전에 꺼낼 때의
 * 세율뿐이고, 그 둘을 비율로 옮기는 것은 제품의 설계 결정이라고 규칙이 명시한다.
 * 엔진은 시점만 낸다.
 */
export function resolvePensionStartDates(access, { birthDate, taxYear, accounts }) {
  const notices = [];
  const appliedTo = 'pension_withdrawal_start[].earliest_start_date';

  const requirements = access.value(
    RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
    ['value', 'requirements'],
    appliedTo,
  );
  // 두 요건 중 늦은 쪽이 시점을 정한다는 것 자체가 규칙이다. 엔진이 세운 해석이 아니다.
  const formula = access.value(RULE.PENSION_EARLIEST_START, ['value', 'formula'], appliedTo);
  if (requirements === undefined || formula === undefined) return { entries: null, notices };

  const ageRequirement = requirements.find((r) => r?.id === 'age');
  const holdingRequirement = requirements.find((r) => r?.id === 'holding_period');
  if (typeof ageRequirement?.min_age !== 'number' || typeof holdingRequirement?.min_years !== 'number') {
    access.value(
      RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
      ['value', 'requirements', 'holding_period', 'min_years'],
      appliedTo,
    );
    return { entries: null, notices };
  }

  const referenceDate = endOfTaxYear(taxYear);
  const ageDate = addYears(birthDate, ageRequirement.min_age);
  const basisRuleIds = [RULE.PENSION_EARLIEST_START, RULE.PENSION_WITHDRAWAL_ELIGIBILITY].sort();

  const entries = PENSION_ACCOUNT_KEYS.map((account) => {
    const state = accounts[account];
    const waived = state.has_deferred_retirement_income === true;
    const holdingDate = state.opened_on === null ? null : addYears(state.opened_on, holdingRequirement.min_years);

    let earliest = null;
    let reasonCode = null;
    if (waived) {
      earliest = ageDate;
    } else if (holdingDate !== null) {
      earliest = maxDate(ageDate, holdingDate);
    } else {
      // 가입일을 모르면 시점을 계산할 수 없다. 남은 기간을 추정하지 않는다.
      reasonCode = START_DATE_REASON.OPENED_ON_MISSING;
    }

    return {
      account,
      computable: earliest !== null,
      earliest_start_date: formatIsoDate(earliest),
      years_until_earliest_start: earliest === null ? null : yearsUntil(referenceDate, earliest),
      age_requirement_date: formatIsoDate(ageDate),
      holding_requirement_date: formatIsoDate(holdingDate),
      holding_requirement_waived: waived,
      // 나이 요건은 이미 충족했는데 5년 요건이 시점을 늦추는 상태. 55세에 가까운 사람이
      // 계좌를 처음 열 때 실질 잠금기간이 5년이 되는 것이 이 값으로 드러난다.
      bound_by_holding_period:
        earliest !== null && holdingDate !== null && compareDates(holdingDate, ageDate) > 0,
      reason_code: reasonCode,
      basis_rule_ids: basisRuleIds,
    };
  });

  if (entries.some((entry) => !entry.computable)) {
    notices.push(
      notice(NOTICE.PENSION_START_DATE_NOT_COMPUTABLE, 'info', 'accounts.*.opened_on', {}, basisRuleIds),
    );
  }

  return { entries, notices };
}

/**
 * 세액공제를 낳지 않는 연금계좌 납입에 **반드시 함께 붙어야 하는 사실들**(D26).
 *
 * 셋 중 하나라도 빠지면 화면 문장이 거짓이 된다.
 *   (1) 그 원금은 인출 시 과세되지 않는다 — 과세제외금액이다.
 *   (2) 다만 합산한도에서 잘린 몫은 **세무서 확인서를 금융회사에 내야** 그 성격을
 *       인정받고, **확인받은 날부터** 적용된다(소급하지 않는다).
 *   (3) 그 원금이 번 **운용수익에는** 인출 시 세금이 붙는다.
 *
 * **값은 전부 룰셋에서 읽는다.** 참·거짓을 코드에 박으면 조문이 바뀌어도 화면이
 * 같은 말을 계속하게 된다. 규칙이 열거한 `effects`의 id 유무와 확인 절차의
 * `automatic`·`prospective_only`가 그 자리다.
 */
export function resolvePensionWithoutCreditFacts(access) {
  const appliedTo = 'plans[].non_quantified_effects';

  const effects = access.value(RULE.PENSION_BEYOND_CREDIT_LIMIT, ['value', 'effects'], appliedTo);
  const procedure = access.value(
    RULE.PENSION_NON_DEDUCTED_PRINCIPAL,
    ['value', 'confirmation_procedure'],
    appliedTo,
  );
  if (effects === undefined || procedure === undefined) return null;

  const has = (id) => effects.some((effect) => effect?.id === id && effect.determined_by_law === true);
  if (
    !has('no_credit_this_year') ||
    !has('principal_not_taxed_on_withdrawal') ||
    !has('returns_taxed_on_withdrawal')
  ) {
    access.value(RULE.PENSION_BEYOND_CREDIT_LIMIT, ['value', 'effects', 'required_ids'], appliedTo);
    return null;
  }
  if (typeof procedure.automatic !== 'boolean' || procedure.prospective_only === undefined) {
    access.value(
      RULE.PENSION_NON_DEDUCTED_PRINCIPAL,
      ['value', 'confirmation_procedure', 'automatic'],
      appliedTo,
    );
    return null;
  }

  return {
    // 이 납입이 올해 낳는 공제액. 세법 수치가 아니라 "없다"는 사실의 표현이다.
    credit_this_year_krw: 0,
    principal_taxed_on_withdrawal: false,
    principal_tax_free_requires_confirmation: !procedure.automatic,
    // "나중에 비과세로 돌아옵니다"를 절차 없이 쓰지 못하게 하는 두 번째 못.
    principal_tax_free_confirmation_prospective_only: procedure.prospective_only !== null,
    returns_taxed_on_withdrawal: true,
    basis_rule_ids: [RULE.PENSION_BEYOND_CREDIT_LIMIT, RULE.PENSION_NON_DEDUCTED_PRINCIPAL].sort(),
  };
}

/**
 * 전환 특례에 붙은 **조건 둘**. `contribution_carryover_available`이라는 이름 하나가
 * 이 조건들을 감추고 있었다(D26) — 화면이 "다음 해에 이월해 받을 수 있다"로 읽으면
 * 매년 한도를 채우는 사용자에게 거짓이 된다.
 */
export function resolveCarryoverConditions(access) {
  const appliedTo = 'plans[].deterministic_benefit.tax_liability_cap';
  const sharesLimit = access.value(
    RULE.CREDIT_UNUSED_CARRYOVER,
    ['value', 'subject_to_conversion_year_credit_limits', 'value'],
    appliedTo,
  );
  const automatic = access.value(RULE.CREDIT_UNUSED_CARRYOVER, ['value', 'automatic'], appliedTo);
  if (sharesLimit === undefined || typeof automatic !== 'boolean') return null;

  return {
    shares_future_year_credit_limit: sharesLimit,
    requires_application: !automatic,
  };
}

export function resolveTransfer(access, { request, scenarioId }) {
  const transfer = request.isa_transfer;
  if (transfer === null) return { transfer: null, notices: [] };

  const notices = [];
  const appliedTo = 'isa_transfer_extra_limit.extra_credit_limit_krw';

  // 개정안은 추가한도 규칙을 대체한다(PROPOSED_SUPERSEDES).
  const ruleId =
    scenarioId === SCENARIO.PROPOSED ? RULE.PROPOSED_TRANSFER_EXTRA : RULE.CREDIT_TRANSFER_EXTRA;

  const rate = access.value(ruleId, ['value', 'rate'], appliedTo);
  const cap = access.value(ruleId, ['value', 'cap_krw'], appliedTo);

  let priorApplied = transfer.prior_year_applied_extra_credit_krw;
  if (scenarioId === SCENARIO.PROPOSED) {
    if (transfer.prior_multi_year_applied_extra_credit_krw !== null) {
      priorApplied = transfer.prior_multi_year_applied_extra_credit_krw;
    } else {
      // 넓어진 차감 기간에 대응하는 입력이 없다. 직전 1개 과세기간 값으로 대신하면
      // 추가한도가 과대 산출될 수 있으므로 그 사실을 드러낸다.
      notices.push(
        notice(
          NOTICE.PROPOSED_TRANSFER_PERIOD_MISSING,
          'warning',
          'isa_transfer.prior_multi_year_applied_extra_credit_krw',
          {},
          [ruleId],
        ),
      );
    }
  }

  if (rate === undefined || cap === undefined) {
    return { transfer: null, notices };
  }

  const byRate = applyRate(transfer.amount_krw, rate);
  if (byRate === null) {
    access.value(ruleId, ['value', 'rate', 'unreadable'], appliedTo);
    return { transfer: null, notices };
  }

  const capRemaining = clampToZero(cap - priorApplied);
  const extra = clampToZero(Math.min(byRate, capRemaining));

  return {
    notices,
    transfer: {
      amount_krw: transfer.amount_krw,
      destination: transfer.destination,
      extra_credit_limit_krw: extra,
      prior_applied_deducted_krw: Math.min(priorApplied, cap),
      basis_rule_ids: [ruleId],
    },
  };
}

export function resolveEligibility(access, { profile, accounts, taxYear }) {
  const notices = [];
  // 만 나이는 생년월일에서 여기서 만든다. 화면이 환산하지 않는다(D21).
  const ageYears = ageOn(profile.birth_date, endOfTaxYear(taxYear));
  const isaReasons = [];
  const isaBasis = [];

  const appliedTo = 'account_eligibility[isa]';
  const anyOf = access.value(RULE.ISA_ELIGIBILITY, ['value', 'any_of'], appliedTo);
  if (anyOf !== undefined) {
    isaBasis.push(RULE.ISA_ELIGIBILITY);
    const hasPriorEmploymentIncome =
      profile.prior_year_total_salary_krw !== null && profile.prior_year_total_salary_krw > 0;

    const qualifies = anyOf.some((option) => {
      if (typeof option?.min_age !== 'number') return false;
      if (ageYears < option.min_age) return false;
      // `requires`가 있는 선택지는 직전 과세기간 근로소득을 함께 요구한다.
      if (option.requires) return hasPriorEmploymentIncome;
      return true;
    });

    if (!qualifies) {
      isaReasons.push(NOTICE.ISA_EXCLUDED_AGE);
      notices.push(notice(NOTICE.ISA_EXCLUDED_AGE, 'warning', 'profile.birth_date', {}, [RULE.ISA_ELIGIBILITY]));
    }
  }

  if (profile.financial_income_taxpayer_last_3_years === true) {
    access.use(RULE.ISA_EXCLUSION_FINANCIAL, appliedTo);
    isaBasis.push(RULE.ISA_EXCLUSION_FINANCIAL);
    isaReasons.push(NOTICE.ISA_EXCLUDED_FINANCIAL);
    notices.push(
      notice(NOTICE.ISA_EXCLUDED_FINANCIAL, 'warning', 'profile.financial_income_taxpayer_last_3_years', {}, [
        RULE.ISA_EXCLUSION_FINANCIAL,
      ]),
    );
  } else if (profile.financial_income_taxpayer_last_3_years === null) {
    // 모르는 것을 아니라고 단정하지 않는다. 배제를 적용하지 않았다는 사실만 알린다.
    notices.push(
      notice(NOTICE.FINANCIAL_INCOME_UNKNOWN, 'info', 'profile.financial_income_taxpayer_last_3_years', {}, []),
    );
  }

  // 연금계좌의 최소 가입 연령 규칙은 룰셋에 없다. 없으면 없는 것이므로 판정하지 않는다.
  notices.push(notice(NOTICE.PENSION_AGE_NOT_EVALUATED, 'info', null, {}, []));

  // 연금수령 개시를 신청한 계좌에는 납입할 수 없다. **두 계좌를 구분하지 않는다** —
  // 조문이 대상을 '연금계좌'로 쓰고 연금저축과 퇴직연금을 가르지 않는다.
  // 중도인출이 비대칭이었다고 이 항목도 그럴 것이라 보아서는 안 된다(규칙의 asymmetry_finding).
  const pensionEligibility = PENSION_ACCOUNT_KEYS.map((account) => {
    const status = accounts[account].annuity_start_status;
    if (status === ANNUITY_START.NOT_STARTED) {
      return { account, eligible: true, reason_codes: [], basis_rule_ids: [] };
    }

    const appliedToAccount = `account_eligibility[${account}]`;
    access.use(RULE.CONTRIBUTION_AFTER_ANNUITY_START, appliedToAccount);

    // 모름은 아니오가 아니다. 수령 중인 사람에게 납입 가능액을 주는 방향이 과대이므로
    // 모르는 동안에는 이 계좌의 배분을 보류한다.
    const code =
      status === ANNUITY_START.STARTED ? NOTICE.ANNUITY_STARTED : NOTICE.ANNUITY_START_UNKNOWN;
    notices.push(
      notice(code, 'warning', `accounts.${account}.annuity_start_status`, { account }, [
        RULE.CONTRIBUTION_AFTER_ANNUITY_START,
      ]),
    );

    return {
      account,
      eligible: false,
      reason_codes: [code],
      basis_rule_ids: [RULE.CONTRIBUTION_AFTER_ANNUITY_START],
    };
  });

  // PENSION_ACCOUNT_KEYS가 계약 6.1절의 계좌 순서 앞 두 칸과 같으므로 순서가 그대로 유지된다.
  const eligibility = [
    ...pensionEligibility,
    {
      account: ACCOUNT.ISA,
      eligible: isaReasons.length === 0,
      reason_codes: isaReasons,
      basis_rule_ids: [...new Set(isaBasis)].sort(),
    },
  ];

  return { eligibility, notices };
}

export function resolveLimits(access, { request, scenarioId, transfer, isaEligible }) {
  const { accounts, profile } = request;
  const notices = [];

  const annuityLimit = access.value(
    RULE.CREDIT_LIMIT_ANNUITY,
    ['value', 'amount_krw'],
    'limits.by_account[annuity_savings].credit_eligible_limit_remaining_krw',
  );
  const combinedAmount = access.value(
    RULE.CREDIT_LIMIT_COMBINED,
    ['value', 'amount_krw'],
    'limits.pension_combined_credit_limit_krw',
  );
  const pensionContributionLimit = access.value(
    RULE.PENSION_CONTRIBUTION_LIMIT,
    ['value', 'amount_krw'],
    'limits.pension_contribution_limit_remaining_krw',
  );

  const isa = resolveIsaLimits(access, { accounts, scenarioId });
  notices.push(...isa.notices);

  if (
    annuityLimit === undefined ||
    combinedAmount === undefined ||
    pensionContributionLimit === undefined ||
    isa.remaining === null
  ) {
    return { notices, limits: null };
  }

  const transferToAnnuity =
    transfer && transfer.destination === ACCOUNT.ANNUITY ? transfer.amount_krw : 0;
  const transferToPension =
    transfer && transfer.destination === ACCOUNT.PENSION ? transfer.amount_krw : 0;

  // 퇴직급여 입금액·계약이전액은 **세액공제 대상 납입액이 아니다**(소득세법 §59의3 ①1·2).
  // 그러므로 아래 두 합계에 섞지 않는다 — 섞으면 세액공제액이 과대 계산된다.
  const retirementTransferIn =
    accounts.annuity_savings.retirement_transfer_in_krw +
    accounts.retirement_pension.retirement_transfer_in_krw;
  if (retirementTransferIn > 0) {
    access.use(RULE.CREDIT_EXCLUDED_CONTRIBUTIONS, 'limits.retirement_transfer_in_krw');
    notices.push(
      notice(
        NOTICE.RETIREMENT_TRANSFER_EXCLUDED,
        'info',
        'accounts.*.retirement_transfer_in_krw',
        { amount_krw: retirementTransferIn },
        [RULE.CREDIT_EXCLUDED_CONTRIBUTIONS],
      ),
    );
  }

  const annuityTotal = accounts.annuity_savings.ytd_contribution_krw + transferToAnnuity;
  const pensionTotal = accounts.retirement_pension.ytd_contribution_krw + transferToPension;

  // 세액공제 대상 한도는 단독 한도를 먼저 적용한 뒤 합산 한도를 적용한다.
  // 순서를 뒤집으면 연금저축 단독 납입자에게 과대한 공제액이 나온다.
  const annuityCounted = Math.min(annuityTotal, annuityLimit);
  const combinedLimit = combinedAmount + (transfer ? transfer.extra_credit_limit_krw : 0);
  const combinedRemainingRaw = combinedLimit - (annuityCounted + pensionTotal);

  // 전환금액은 납입 자체의 한도와 별개다(규칙의 excluded_from_limit).
  //
  // 퇴직급여 입금액은 다르다. 룰셋이 정한 것은 그 금액이 **세액공제 대상에서** 빠진다는 것뿐이고,
  // 연간 납입한도(pension.contribution.annual_limit)를 쓰는지는 규칙이 말하지 않는다.
  // 지어내지 않되 한쪽을 골라야 하므로 **한도를 쓰는 쪽**으로 본다 — 이쪽으로 틀리면 배분이
  // 작아져 절세액이 과소로 나오고, 반대로 골라 틀리면 실제로 넣을 수 없는 금액을 권하게 된다.
  // 이 선택은 assumptions에 실려 나가고 engine-interface.md의 open_questions로 tax-domain에 넘겼다.
  const pensionContributionUsed =
    accounts.annuity_savings.ytd_contribution_krw +
    accounts.retirement_pension.ytd_contribution_krw +
    retirementTransferIn;
  const pensionContributionRemainingRaw = pensionContributionLimit - pensionContributionUsed;

  const overLimit =
    combinedRemainingRaw < 0 ||
    pensionContributionRemainingRaw < 0 ||
    annuityTotal > annuityLimit ||
    isa.clamped;

  if (overLimit) {
    notices.push(notice(NOTICE.EXISTING_OVER_LIMIT, 'warning', null, {}, []));
  }

  const combinedRemaining = clampToZero(combinedRemainingRaw);
  const annuityCreditRemaining = clampToZero(Math.min(annuityLimit - annuityCounted, combinedRemaining));
  const pensionContributionRemaining = clampToZero(pensionContributionRemainingRaw);

  const taxFree = resolveIsaTaxFreeLimit(access, { accounts, profile });
  notices.push(...taxFree.notices);

  // 연금저축과 퇴직연금은 납입 한도도 세액공제 한도도 **같은 풀**을 본다.
  // 두 값을 더하면 이중계상이므로, 그 사실을 문서가 아니라 데이터로 드러낸다.
  const limits = {
    by_account: [
      {
        account: ACCOUNT.PENSION,
        contribution_limit_remaining_krw: pensionContributionRemaining,
        contribution_limit_shared_with: [ACCOUNT.ANNUITY],
        credit_eligible_limit_remaining_krw: combinedRemaining,
        credit_limit_shared_with: [ACCOUNT.ANNUITY],
        tax_free_limit_krw: null,
        clamped_to_zero: pensionContributionRemainingRaw < 0 || combinedRemainingRaw < 0,
        basis_rule_ids: [RULE.CREDIT_LIMIT_COMBINED, RULE.PENSION_CONTRIBUTION_LIMIT].sort(),
      },
      {
        account: ACCOUNT.ANNUITY,
        contribution_limit_remaining_krw: pensionContributionRemaining,
        contribution_limit_shared_with: [ACCOUNT.PENSION],
        credit_eligible_limit_remaining_krw: annuityCreditRemaining,
        credit_limit_shared_with: [ACCOUNT.PENSION],
        tax_free_limit_krw: null,
        clamped_to_zero: pensionContributionRemainingRaw < 0 || annuityTotal > annuityLimit,
        basis_rule_ids: [
          RULE.CREDIT_LIMIT_ANNUITY,
          RULE.CREDIT_LIMIT_COMBINED,
          RULE.PENSION_CONTRIBUTION_LIMIT,
        ].sort(),
      },
      {
        account: ACCOUNT.ISA,
        contribution_limit_remaining_krw: isaEligible ? isa.remaining : 0,
        // ISA 한도는 이 계좌 전용이다. 빈 배열이 그 사실을 말한다.
        contribution_limit_shared_with: [],
        credit_eligible_limit_remaining_krw: null,
        credit_limit_shared_with: [],
        tax_free_limit_krw: taxFree.limit,
        clamped_to_zero: isa.clamped,
        basis_rule_ids: isa.basisRuleIds,
      },
    ],
    pension_combined_credit_limit_krw: combinedLimit,
    pension_combined_credit_remaining_krw: combinedRemaining,
    pension_contribution_limit_remaining_krw: pensionContributionRemaining,
    // 세액공제 대상이 아닌 입금액. 납입 여력과 분리해 받은 값을 분리한 채로 되돌려준다.
    retirement_transfer_in_krw: retirementTransferIn,
    basis_rule_ids: [
      RULE.CREDIT_LIMIT_ANNUITY,
      RULE.CREDIT_LIMIT_COMBINED,
      RULE.PENSION_CONTRIBUTION_LIMIT,
    ].sort(),
  };

  return {
    notices,
    limits,
    state: {
      annuityLimit,
      combinedLimit,
      annuityCounted,
      pensionCounted: pensionTotal,
      pensionContributionRemaining,
      isaRemaining: isaEligible ? isa.remaining : 0,
      taxFreeLimit: taxFree.limit,
      isaBasisRuleIds: isa.basisRuleIds,
    },
  };
}

function resolveIsaLimits(access, { accounts, scenarioId }) {
  const notices = [];
  const isa = accounts.isa;
  const appliedTo = 'limits.by_account[isa].contribution_limit_remaining_krw';
  const basisRuleIds = [RULE.ISA_ACCOUNT_REQUIREMENTS];

  const totalLimit = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'total_contribution_limit_krw'],
    appliedTo,
  );

  let annualRemainingRaw;
  if (scenarioId === SCENARIO.PROPOSED) {
    // 개정안은 이월 계산식을 없애고 정액 한도로 바꾼다. 기존 가입자에게도 적용된다.
    basisRuleIds.push(RULE.PROPOSED_ISA_ANNUAL_LIMIT);
    const amount = access.value(RULE.PROPOSED_ISA_ANNUAL_LIMIT, ['value', 'amount_krw'], appliedTo);
    if (amount === undefined) return { remaining: null, clamped: false, notices, basisRuleIds };
    annualRemainingRaw = amount - isa.ytd_contribution_krw;
  } else {
    basisRuleIds.push(RULE.ISA_ANNUAL_LIMIT);
    const base = access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'base_amount_krw'], appliedTo);
    const formula = access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'formula'], appliedTo);
    if (base === undefined || formula === undefined) {
      return { remaining: null, clamped: false, notices, basisRuleIds };
    }

    // 연 한도를 상수로 박으면 안 된다 — 경과연수의 함수다(룰셋 engine_note).
    const tenureCap = readTenureCap(formula);
    if (tenureCap === null) {
      access.value(RULE.ISA_ANNUAL_LIMIT, ['value', 'formula', 'tenure_cap'], appliedTo);
      return { remaining: null, clamped: false, notices, basisRuleIds };
    }

    const tenure = isa.years_since_opening ?? 0;
    if (!isa.years_since_opening_provided) {
      notices.push(notice(NOTICE.ISA_TENURE_MISSING, 'warning', 'accounts.isa.years_since_opening', {}, [
        RULE.ISA_ANNUAL_LIMIT,
      ]));
    }
    annualRemainingRaw =
      base * (1 + Math.min(tenure, tenureCap)) - isa.cumulative_contribution_krw;
  }

  if (totalLimit === undefined) return { remaining: null, clamped: false, notices, basisRuleIds };

  const otherSavings = isa.other_savings_contract_krw ?? 0;
  const totalRemainingRaw = totalLimit - otherSavings - isa.cumulative_contribution_krw;

  return {
    remaining: clampToZero(Math.min(annualRemainingRaw, totalRemainingRaw)),
    clamped: annualRemainingRaw < 0 || totalRemainingRaw < 0,
    notices,
    basisRuleIds: [...new Set(basisRuleIds)].sort(),
  };
}

function resolveIsaTaxFreeLimit(access, { accounts, profile }) {
  const notices = [];
  const isa = accounts.isa;

  if (isa.account_type === null) {
    notices.push(notice(NOTICE.ISA_TYPE_NOT_DECLARED, 'info', 'accounts.isa.account_type', {}, []));
  }
  if (profile.prior_year_total_salary_krw === null) {
    notices.push(
      notice(NOTICE.PRIOR_YEAR_INCOME_MISSING, 'info', 'profile.prior_year_total_salary_krw', {}, []),
    );
  }

  if (isa.account_type === null) return { limit: null, notices };

  const appliedTo = 'limits.by_account[isa].tax_free_limit_krw';
  const brackets = access.value(RULE.ISA_TAX_FREE_LIMIT, ['value', 'brackets'], appliedTo);
  if (brackets === undefined) return { limit: null, notices };

  // 구간을 한글 id가 아니라 구조로 고른다 — 소득 상한이 있는 쪽이 우대 구간이고,
  // 상한이 전부 null인 쪽이 그 밖의 구간이다.
  const hasCeiling = (b) =>
    (b.prev_total_salary_max_krw ?? null) !== null || (b.prev_global_income_max_krw ?? null) !== null;
  const qualifying = brackets.find(hasCeiling);
  const fallback = brackets.find((b) => !hasCeiling(b));

  const selected = isa.account_type === 'low_income' ? qualifying : fallback;
  if (!selected || typeof selected.limit_krw !== 'number') {
    access.value(RULE.ISA_TAX_FREE_LIMIT, ['value', 'brackets', 'limit_krw'], appliedTo);
    return { limit: null, notices };
  }

  notices.push(...crossCheckIsaType(access, { isa, profile, qualifying }));

  return { limit: selected.limit_krw, notices };
}

/**
 * 선언한 ISA 유형과 직전 과세기간 소득의 교차확인 — **`any_of`로 읽지 않는다**(D27).
 *
 * `brackets`의 `match: "any_of"`는 단순화이고, 규칙 스스로 그렇게 적어 두었다
 * (`brackets_are_a_simplification`). 조문(조특법 §91조의18 ② 1호)의 가·나·다목은
 * **서로를 막는 구조**다 — 가목은 근로소득만(또는 합산되지 않는 소득만) 있는 사람으로,
 * 나목은 총급여 5,000만원 이하인 사람으로 한정되고, 다목은 농어민 여부가 시행령 위임이다.
 *
 * **그래서 두 방향의 결론이 성립하는 조건이 다르다.**
 *
 * - **"당신은 서민형이다"** — 어느 목도 엔진이 **확인할 수 없다.** 세 목 전부에
 *   엔진이 입력을 갖지 못한 한정(`restriction`)이나 위임(`delegated`)이 붙어 있다.
 *   그러므로 직전 총급여가 낮다는 이유만으로 **일반형 선언을 정정하지 않는다.**
 *   이것이 D27이 지적한 "올바로 선언한 사용자를 잘못 정정한다"의 자리다.
 * - **"당신은 서민형이 아니다"** — 직전 총급여가 가목의 금액 요건을 넘으면 가목이 닫히고,
 *   같은 사실이 나목의 한정("총급여 5,000만원 초과자 제외")으로 나목도 닫는다. 규칙의
 *   `reverse_direction`이 그 읽기를 적고 있다. 남는 것은 다목뿐이므로 **결론은 내되
 *   확인하지 못한 목의 id를 함께 싣는다.**
 *
 * 어느 쪽이든 **계산은 사용자 선언을 따른다.** 실제 유형은 가입·연장 시점에 금융회사가
 * 심사해 확정한 것이다.
 */
function crossCheckIsaType(access, { isa, profile, qualifying }) {
  const appliedTo = 'limits.by_account[isa].tax_free_limit_krw';
  if (profile.prior_year_total_salary_krw === null || !qualifying) return [];

  const salaryCeiling = qualifying.prev_total_salary_max_krw ?? null;
  if (salaryCeiling === null) return [];

  // 조문 구조를 읽는다. 없으면 교차확인 자체를 하지 않는다 — `any_of`로 되돌아가지 않는다.
  const items = access.value(
    RULE.ISA_TAX_FREE_LIMIT,
    ['value', 'brackets_statutory', 'items'],
    appliedTo,
  );
  if (items === undefined) return [];

  // 엔진이 입력을 갖지 못해 확인할 수 없는 목. 하나라도 있으면 "서민형이다"라고
  // 결론지을 수 없다 — 그 목들이 열려 있는지 닫혀 있는지를 모르기 때문이다.
  const unverifiable = items
    .filter((item) => item?.restriction !== undefined || item?.delegated !== undefined)
    .map((item) => item.id);

  const declaredLowIncome = isa.account_type === 'low_income';
  const aboveSalaryCeiling = profile.prior_year_total_salary_krw > salaryCeiling;

  // **확인할 수 없는 한정이 하나도 없다면** 총급여만으로 두 방향 다 결론이 난다.
  // 지금 룰셋에서는 성립하지 않지만 조건을 이렇게 적어 두어야, 조문이 정비되어
  // 한정이 사라졌을 때 엔진이 저절로 결론을 회복한다 — 그리고 이 조건이 실제로
  // 무는지를 결함 주입으로 확인할 수 있다.
  const canConcludeQualifies = unverifiable.length === 0;

  if (!aboveSalaryCeiling && !canConcludeQualifies) {
    // 금액만으로는 아무 목도 확인되지 않는다. 결론을 내지 않고 그 사실을 낸다.
    return [
      notice(
        NOTICE.ISA_TYPE_CROSS_CHECK_INCONCLUSIVE,
        'info',
        'accounts.isa.account_type',
        { unverifiable_bracket_ids: unverifiable },
        [RULE.ISA_TAX_FREE_LIMIT],
      ),
    ];
  }

  // 소득 기준 판정과 선언이 일치하면 할 말이 없다.
  if (!aboveSalaryCeiling === declaredLowIncome) return [];

  return [
    notice(
      NOTICE.ISA_TYPE_CONFLICT,
      'warning',
      'accounts.isa.account_type',
      { unverifiable_bracket_ids: unverifiable },
      [RULE.ISA_TAX_FREE_LIMIT],
    ),
  ];
}

export function notice(code, severity, field, params = {}, basisRuleIds = []) {
  return { code, severity, field, params, basis_rule_ids: basisRuleIds };
}

export { ERROR };
