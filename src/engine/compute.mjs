// 진입점 조립. engine-design.md 5절의 계산 순서를 그대로 따른다.

import {
  ACCOUNT,
  ASSUMPTION,
  CREDIT_RATE_BASIS,
  CREDIT_RATE_FALLBACK_DIRECTION,
  DEFAULT_UNAPPLIED_REASON,
  HORIZON,
  ISA_ESTIMATE,
  ISA_ESTIMATE_DISPLAY,
  ISA_ESTIMATE_STATE,
  NOTICE,
  RATE_GAP_ZERO_REASON,
  REASON_INPUT_MISSING,
  RULE,
  RULESET_STATUS,
  SCENARIO,
  SCHEMA_VERSION,
  UNAPPLIED_REASON,
} from './constants.mjs';
import { boundariesFrom, boundariesSource, dedupeErrors } from './boundaries.mjs';
import { resolveHorizonSuppression } from './fund-use-horizon.mjs';
import { buildPlans } from './plans.mjs';
import { resolveTaxLiabilityCap } from './liability-cap.mjs';
import { resolveHeadlineRule } from './headline.mjs';
import { resolveIsaReturn } from './isa-return.mjs';
import { resolvePensionWithdrawalTaxReference } from './pension-reference.mjs';
import { buildLegalBasis, byCodeUnit, createAccess, selectRulesets } from './ruleset.mjs';
import {
  resolveAnnuitySavingsEligibility,
  resolveIrpEligibility,
  resolvePensionCreditEligibility,
} from './statutory-eligibility.mjs';
import { effectiveRate } from './ratio.mjs';
import {
  notice,
  resolveAgeReckoning,
  resolveEligibility,
  resolveLimits,
  resolvePensionCreditCeiling,
  resolvePensionStartDates,
  resolvePensionWithoutCreditFacts,
  resolveRates,
  resolveTransfer,
  resolveWithdrawalOrder,
} from './limits.mjs';
import { ageOn, endOfTaxYear, formatIsoDate } from './dates.mjs';
import { validateBoundariesRequest, validateRequest } from './validate.mjs';

export function compute(request, rulesets) {
  // 1. 입력 검증 — 발견한 오류를 전부 담는다.
  const { errors: validationErrors, normalized } = validateRequest(request);
  if (validationErrors.length > 0) return failure(request, validationErrors);

  const scenarioResults = [];
  const errors = [];
  let creditRateBracket = null;
  let ageReckoning = null;
  let isaReturn = null;
  let horizonSuppression = null;

  for (const scenarioId of normalized.scenarios) {
    const outcome = computeScenario(scenarioId, normalized, rulesets);
    if (outcome.errors) {
      errors.push(...outcome.errors);
      continue;
    }
    scenarioResults.push(outcome.scenario);
    creditRateBracket ??= outcome.creditRateBracket;
    // 나이 계산 규칙은 개정 대상이 아니므로 두 시나리오에서 같다.
    ageReckoning ??= outcome.ageReckoning;
    // 정산 기간·계약기간 하한도 개정 대상이 아니다. 가정 목록은 응답 단위이므로 하나만 쓴다.
    isaReturn ??= outcome.isaReturn;
    // 전액 미배분 판정도 개정 대상이 아니다(두 룰셋의 의무가입기간·기타소득세율이 같다).
    // **가정 목록이 이 판정을 읽어야 한다** — 「시점은 금액에 반영하지 않는다」는 가정이
    // 걸리는 시점과 걸리지 않는 시점을 이 값 하나가 가른다. 조건을 두 번 적지 않는다.
    horizonSuppression ??= outcome.horizonSuppression;
  }

  if (errors.length > 0) return failure(request, dedupeErrors(errors));

  const months = normalized.profile.months_remaining_in_tax_year;
  const referenceDate = endOfTaxYear(normalized.tax_year);
  return {
    ok: true,
    schema_version: normalized.schema_version,
    echo: {
      tax_year: normalized.tax_year,
      monthly_capacity_krw: normalized.profile.monthly_capacity_krw,
      months_remaining_in_tax_year: months,
      annual_budget_krw: normalized.profile.monthly_capacity_krw * months,
      fund_use_horizon: normalized.profile.fund_use_horizon,
      // 계약이 스스로 선언한다. **`12.0.0`에서 앞의 두 값이 뒤집혔다**(D52 2번) —
      // `within_isa_lock_in`이면 연금 두 계좌를 비우므로 이 입력이 금액을 바꾼다.
      // **`13.0.0`에서 그 판정이 계좌별로 갈렸고**(D53 1번) 이 선언은 그대로다 —
      // 의무가입기간이 지난 ISA가 살아남아도 연금 쪽 금액은 여전히 이 입력이 바꾼다.
      //
      // **고정 객체를 유지한다.** 이 객체가 말하는 것은 「이 요청에서 무엇이 달라졌는가」가
      // 아니라 **「이 입력이 무엇을 바꿀 수 있는가」**이고, 그래야 qa가 선언과 동작을
      // 요청에 상관없이 대조할 수 있다. 이 요청에서 실제로 걸렸는지는
      // `unallocated_breakdown.reason_code`가 값으로 말한다.
      fund_use_horizon_affects: {
        allocation_amounts: true,
        tax_credit_amounts: true,
        limits: false,
        plan_ordering: true,
        baseline_selection: true,
        warnings: true,
      },
      credit_rate_bracket: creditRateBracket,
      // 사용자가 준 가정을 **그대로** 되돌린다. 헌장 고지 요소 4(가정을 값과 같은 화면에)를
      // 화면이 지킬 재료다. 실제로 적용된 정산 기간은 여기가 아니라 정산액 객체에 있다 —
      // "무엇을 주었는가"와 "무엇을 썼는가"를 한 칸에 뭉치지 않는다.
      isa_return_assumption: echoIsaReturnAssumption(normalized.profile.isa_return_assumption),
      // **네 값이 전부 `false`인 고정 객체다.** D28이 그은 선 ①(확정 세액공제와 가정 기반
      // 추정치를 한 목적함수에 더하지 않는다)을 규약이 아니라 **자료형과 회귀 테스트로**
      // 강제한다. `fund_use_horizon_affects`가 D18 때 같은 일을 해 설계를 바로잡았다.
      isa_return_affects: {
        allocation_amounts: false,
        tax_credit_amounts: false,
        plan_ordering: false,
        warnings: false,
      },
      // 화면이 만 나이를 만들지 않는다(D21). 환산 결과와 **그 기준일**을 함께 되돌려 주어
      // 무엇을 기준으로 센 나이인지가 응답만 보고도 드러나게 한다.
      derived_age: {
        age_years: ageOn(normalized.profile.birth_date, referenceDate),
        reference_date: formatIsoDate(referenceDate),
        // 룰셋 규칙 `age.reckoning.reference_date`가 **단일 기준일은 존재하지 않는다**고
        // 정한다. 그래서 이 값은 여전히 `false`이고, 그 `false`는 이제 규칙의 부재가
        // 아니라 규칙의 내용이다. 값은 그 규칙에서 읽는다.
        reference_date_from_ruleset: ageReckoning.reference_date_from_ruleset,
      },
      // 세액 한도가 무엇을 바꾸고 무엇을 바꾸지 않는지. fund_use_horizon과 같은 형태의
      // 자기 선언이고, 값이 고정이라 qa가 실제 동작과 대조할 수 있다.
      //
      // **`12.0.0`에서 첫 값이 뒤집혔다**(D52 1번). 한도는 이제 IRP 배분의 상한을 정한다 —
      // 한도를 넘어서는 IRP 납입은 공제를 한 원도 낳지 않으면서 중도인출 제한만 지기
      // 때문이다. **연금저축과 ISA에는 여전히 닿지 않는다**(5.12절의 판정은 그대로다).
      tax_liability_cap_affects: {
        allocation_amounts: true,
        tax_credit_amounts: true,
        limits: false,
        plan_ordering: false,
        baseline_selection: false,
        warnings: false,
      },
    },
    scenarios: scenarioResults,
    assumptions: buildAssumptions(normalized, ageReckoning, isaReturn, horizonSuppression),
  };
}

/** 요청에 실린 가정 그대로. 없으면 `null`이고, 그때 화면에 붙일 가정 자체가 없다. */
function echoIsaReturnAssumption(assumption) {
  if (assumption === null) return null;
  return {
    annual_return_rate: assumption.annual_return_rate,
    income_character: assumption.income_character,
    settlement_years: assumption.settlement_years,
    loss_amount_krw: assumption.loss_amount_krw,
  };
}

function computeScenario(scenarioId, request, rulesets) {
  // 2. 룰셋 로드
  const selection = selectRulesets(rulesets, request.tax_year, scenarioId);
  if (selection.errors) return { errors: selection.errors };

  const access = createAccess(selection);
  const notices = [];

  // 2.5. 나이·기간 계산 규칙. 값이 아니라 판정 시점을 주는 규칙이고,
  //      그 결론이 "단일 기준일은 없다"이므로 기준일은 여전히 엔진이 고른다.
  const ageReckoning = resolveAgeReckoning(access);

  // 3. 파생 비율
  const { rates, notices: rateNotices } = resolveRates(access, { profile: request.profile, scenarioId });
  notices.push(...rateNotices);

  // 3.5. 사람 쪽 자격 둘 (D44). **계좌 자격보다 앞에 온다** — IRP 가입 자격이 계좌
  //      자격의 한 축이고, 세액공제 요건은 배분 단계의 목적함수가 서는 자리이기 때문이다.
  //      **두 물음을 섞지 않는다**: 이자·배당소득만 있는 사람은 IRP를 못 열지만
  //      연금저축으로는 공제를 받는다.
  const irpEligibility = resolveIrpEligibility(access, {
    profile: request.profile,
    accounts: request.accounts,
  });
  const annuitySavingsEligibility = resolveAnnuitySavingsEligibility(access);
  const creditEligibilityResult = resolvePensionCreditEligibility(access, { profile: request.profile });

  if (irpEligibility === null || annuitySavingsEligibility === null || creditEligibilityResult === null) {
    return { errors: dedupeErrors(access.missing().length > 0 ? access.missing() : [ruleMissingFallback()]) };
  }
  notices.push(...irpEligibility.notices);
  notices.push(...creditEligibilityResult.notices);

  // 4. 계좌 자격
  const eligibilityResult = resolveEligibility(access, {
    profile: request.profile,
    accounts: request.accounts,
    taxYear: request.tax_year,
    irp: irpEligibility,
    annuitySavings: annuitySavingsEligibility,
  });
  notices.push(...eligibilityResult.notices);
  const isaEligible = eligibilityResult.eligibility.find((e) => e.account === ACCOUNT.ISA).eligible;

  // 4.5. 세액 한도. **마지막에 걸리는 상한이 아니라 계산 전체의 전제다**(규칙의 engine_note).
  //      D39로 직전 과세연도 결정세액 입력이 사라졌고, 이제 해당 과세기간 총급여액에서
  //      산출한다. **나온 값은 상한이다** — 방향은 룰셋이 증명과 함께 정한다(D40).
  const capResult = resolveTaxLiabilityCap(access, { profile: request.profile });
  notices.push(...capResult.notices);

  // 4.6. 연금으로 꺼낼 수 있는 가장 이른 시점. 배분 비율을 바꾸지 않는다 — 시점만 낸다.
  const startDateResult = resolvePensionStartDates(access, {
    birthDate: request.profile.birth_date,
    taxYear: request.tax_year,
    accounts: request.accounts,
  });
  notices.push(...startDateResult.notices);

  // 5~6. 전환 추가한도와 계좌별 한도
  const transferResult = resolveTransfer(access, { request, scenarioId });
  notices.push(...transferResult.notices);

  const limitResult = resolveLimits(access, {
    request,
    scenarioId,
    transfer: transferResult.transfer,
    isaEligible,
  });
  notices.push(...limitResult.notices);

  // 6.5. 세액공제를 낳지 않는 연금계좌 납입에 붙는 사실 셋(D26). 금액을 바꾸지 않는다.
  //      **읽기를 여기서 하는 것이 중요하다** — 아래 미확인 검사보다 뒤에서 읽으면
  //      규칙이 없어도 그 사실이 조용히 빠진 채 계산이 끝난다.
  const withoutCreditFacts = resolvePensionWithoutCreditFacts(access);

  // 6.6. 수익률 가정이 있을 때만 산식 규칙군을 읽는다(D28·D29). 없으면 규칙을 한 건도
  //      건드리지 않으므로 근거 목록도 예전과 같다 — 읽지 않은 규칙을 싣지 않는다.
  const isaReturn = resolveIsaReturn(access, {
    assumption: request.profile.isa_return_assumption,
  });

  // 6.65. 헤드라인 합계의 형태(D38). **가정이 없어도 읽는다** — ISA 성분이 없는
  //       사용자에게도 합계는 나가고, 그때 「합계 = 확정 성분」이라는 것도 이 규칙이 정한다.
  const headlineRule = resolveHeadlineRule(access);

  // 6.7. 연금계좌를 나중에 받을 때의 세율표(D36). **요청의 어떤 값에도 반응하지 않는다** —
  //      새 입력 0개·가정 0개가 이 표가 성립하는 조건이다. 금액은 없다.
  const pensionRateReference = resolvePensionWithdrawalTaxReference(access);

  const boundaries = boundariesFrom(access, {
    birthDate: request.profile.birth_date,
    taxYear: request.tax_year,
    isaExists: request.accounts.isa.exists,
    isaYearsSinceOpening: request.accounts.isa.years_since_opening,
  });

  // 6.75. **자금 사용 시점이 금액에 닿는 유일한 판정**(D52 2번). 3년 안에 쓸 돈이면
  //       연금 두 계좌는 55세 전 인출이라 기타소득세가 붙어 이롭지 않다. **ISA는
  //       남은 의무가입기간이 있을 때만이다**(D53 1번) — 그 기간이 지난 사용자에게는
  //       추징 요건 자체가 성립하지 않는다. **연수도 세율도 룰셋에서 읽는다.**
  //       걸리지 않는 시점에서는 규칙을 한 건도 읽지 않는다.
  //
  //       **경계값을 먼저 만들어야 한다** — 그 판정의 재료가 남은 의무가입기간이고,
  //       그 값은 룰셋의 `min_contract_years`에서 `boundaries.mjs`가 만든다.
  //       같은 뺄셈을 여기서 다시 하면 두 벌이 되고, 두 벌이 갈리는 날
  //       화면의 캡션과 배분이 서로 다른 잔여 연수 위에 서게 된다.
  const horizonSuppression = resolveHorizonSuppression(access, {
    horizon: request.profile.fund_use_horizon,
    isaLockInYearsRemaining: boundaries.isa_lock_in_years_remaining,
  });

  // 6.8. 확정 축의 최댓값. 한도와 율을 다 읽은 뒤라야 만들 수 있다.
  const creditCeiling =
    limitResult.limits === null || rates.incomeTaxRate === null || capResult.cap === null
      ? null
      : resolvePensionCreditCeiling(access, {
          rates,
          combinedLimit: limitResult.limits.pension_combined_credit_limit_krw,
          extraCreditLimitKrw: transferResult.transfer
            ? transferResult.transfer.extra_credit_limit_krw
            : 0,
          cap: capResult.cap,
          // 축과 한도의 대소는 **정확값끼리** 잰다. 절사한 값으로 비교하면 1원 미만의
          // 차이가 사라져 관계 코드가 뒤집힌다(룰셋 `comparison` 단계).
          capExact: capResult.capExact,
          rounding: capResult.rounding,
        });

  // 필요한 규칙이나 값을 하나라도 읽지 못했으면 중단한다. 대체값을 만들지 않는다.
  const missing = access.missing();
  if (
    missing.length > 0 ||
    limitResult.limits === null ||
    rates.incomeTaxRate === null ||
    capResult.cap === null ||
    startDateResult.entries === null ||
    ageReckoning === null ||
    withoutCreditFacts === null ||
    isaReturn === null ||
    headlineRule === null ||
    pensionRateReference === null ||
    horizonSuppression === null ||
    creditCeiling === null
  ) {
    return { errors: dedupeErrors(missing.length > 0 ? missing : [ruleMissingFallback()]) };
  }

  // 7. 예산
  const months = request.profile.months_remaining_in_tax_year;
  const budget = request.profile.monthly_capacity_krw * months;

  // 8~10. 배분안 생성·평가·합치기, 그리고 11~12. 경고와 기본안 선택
  const eligible = Object.fromEntries(
    eligibilityResult.eligibility.map((e) => [e.account, e.eligible]),
  );
  // 세제상 동점 구간에서 쓸 연금계좌 순서. 사실은 룰셋에서 읽고 판단은 제품이 한다.
  const withdrawalOrder = resolveWithdrawalOrder(access);

  const { plans, comparisonNotes } = buildPlans({
    access,
    withdrawalOrder,
    withoutCreditFacts,
    isaReturn,
    headlineRule,
    isaEstimateDisplay: request.options.assumption_based_isa_estimate,
    isaCumulativeContributionKrw: request.accounts.isa.cumulative_contribution_krw,
    options: request.options,
    horizon: request.profile.fund_use_horizon,
    horizonSuppression,
    months,
    budget,
    // 월 표시 금액의 합이 맞춰야 할 값. `budget / months`로 되돌려 계산하지 않는다 —
    // 나눗셈을 다시 하면 그 자리에서 또 반올림이 생긴다.
    capacity: request.profile.monthly_capacity_krw,
    state: limitResult.state,
    rates,
    eligible,
    // **요건이 서지 않으면 어떤 배분도 공제를 낳지 않는다**(소득세법 §59조의3① 1단계).
    // 그 사실이 배분 단계에 들어가야 「세액공제 최대」라는 이름이 거짓말을 하지 않는다.
    creditEligibility: creditEligibilityResult.eligibility,
    boundaries,
    cap: capResult.cap,
    // 자르기 판정은 정확값으로 한다. 표시 금액은 그 뒤에 한 번 버려서 만든다.
    capExact: capResult.capExact,
    rounding: capResult.rounding,
    startDates: startDateResult.entries,
  });

  if (plans.some((plan) => plan.deterministic_benefit.tax_liability_cap.applied)) {
    notices.push(
      notice(NOTICE.TAX_CAP_APPLIED, 'info', null, {}, capResult.cap.basis_rule_ids),
    );
  }

  // 13~14. 안내·근거·메타
  if (request.profile.monthly_capacity_krw === 0) {
    notices.push(notice(NOTICE.ZERO_CAPACITY, 'info', 'profile.monthly_capacity_krw'));
  }
  // **이 안내는 「한도가 모자란다」고 말한다.** 전액 미배분이 자금 사용 시점에서 나온
  // 경우에는 한도가 멀쩡히 남아 있으므로 그 말이 거짓이 된다(D52 2번). 같은 사실을
  // `unallocated_breakdown.reason_code`가 갈라서 말한다.
  const maxFillable = Math.max(...plans.map((p) => p.total_allocated_annual_krw));
  if (budget > maxFillable && !horizonSuppression.applies) {
    notices.push(notice(NOTICE.BUDGET_EXCEEDS_ALL_LIMITS, 'info', null, { unallocated_krw: budget - maxFillable }));
  }
  if (plans.length === 1) {
    notices.push(notice(NOTICE.PLANS_COLLAPSED_SINGLE, 'info', null));
  }
  if (request.profile.fund_use_horizon === HORIZON.UNKNOWN) {
    notices.push(notice(NOTICE.HORIZON_NOT_DECLARED, 'info', 'profile.fund_use_horizon'));
  }
  // 사용자가 "의무가입기간 안에 쓸 수 있다"를 골랐는데 그 기간이 이미 지났다.
  // ISA 추징 경고는 성립하지 않아 끄지만(M2), 입력이 현실과 어긋난다는 사실 자체는
  // 화면이 알아야 다시 물어보든 문구를 바꾸든 할 수 있다. 경고가 아니라 사실 통지다.
  if (
    request.profile.fund_use_horizon === HORIZON.WITHIN_ISA_LOCK_IN &&
    boundaries.isa_lock_in_years_remaining === 0
  ) {
    notices.push(
      notice(NOTICE.ISA_LOCK_IN_ELAPSED, 'info', 'profile.fund_use_horizon', {}, [
        RULE.ISA_CLAWBACK,
        RULE.ISA_ACCOUNT_REQUIREMENTS,
      ]),
    );
  }
  notices.push(
    notice(NOTICE.PENSION_HOLDING_NOT_EVALUATED, 'info', null, {}, [RULE.PENSION_WITHDRAWAL_ELIGIBILITY]),
  );
  notices.push(...isaReturnNotices(isaReturn, plans, request.options));

  const isProposed = scenarioId === SCENARIO.PROPOSED;
  if (isProposed) {
    notices.push(notice(NOTICE.PROPOSED_NOT_ENACTED, 'warning', null));
  }

  const legalBasis = request.options.include_legal_basis ? buildLegalBasis(access) : [];

  return {
    ageReckoning,
    isaReturn,
    horizonSuppression,
    creditRateBracket: {
      income_tax_rate: rates.incomeTaxRate,
      local_tax_rate: rates.surtaxRate,
      effective_rate: effectiveRate(rates.incomeTaxRate, rates.surtaxRate),
      // **무엇으로 판정했는가.** 비율만 되돌려주면 화면은 그 비율이 총급여에서 나왔는지
      // 종합소득금액에서 나왔는지, 아니면 금액을 몰라 본문 구간으로 갔는지 알 수 없다.
      // D27이 고친 결함이 정확히 그 구분의 부재였다.
      basis_code: rates.basis.code,
      measured_amount_krw: rates.basis.amount,
      // 대체값을 적용했으면 그 사실과 오차 방향이 금액과 같은 화면에 붙어야 한다.
      fallback_applied: rates.basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT,
      fallback_direction_code:
        rates.basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT
          ? CREDIT_RATE_FALLBACK_DIRECTION
          : null,
      basis_rule_ids: [RULE.CREDIT_RATE, RULE.CREDIT_RATE_BASIS, RULE.LOCAL_SURTAX].sort(),
    },
    scenario: {
      scenario_id: scenarioId,
      is_enacted: !isProposed,
      ruleset: {
        files: selection.files,
        tax_year: selection.base.doc.tax_year,
        status: (isProposed ? selection.proposed : selection.base).doc.status,
        effective_from: (isProposed ? selection.proposed : selection.base).doc.effective_from,
      },
      // 룰셋 값을 그대로 읽는다. 엔진도 화면도 이 문자열을 코드에 박지 않는다.
      bill_stages: collectBillStages(access),
      account_eligibility: eligibilityResult.eligibility,
      // **가입 자격과 다른 축이다**(D44). 공제액 0의 경로가 「산출세액이 0이라 잘렸다」인지
      // 「종합소득이 없어 요건이 서지 않는다」인지를 화면이 여기서 읽는다 — 금액은 같고
      // 쓸 수 있는 문장이 다르다. 요건 미충족 쪽은 추정이 아니라 조문에서 나오는 등식이다.
      pension_credit_taxpayer_eligibility: creditEligibilityResult.eligibility,
      limits: limitResult.limits,
      pension_credit_tax_liability_cap: capResult.cap,
      // D36 — 확정 축의 눈금 끝. 배분안이 아니라 시나리오에 둔다: 축은 배분안을 바꿔도
      // 움직이지 않아야 하고, 움직이면 같은 길이가 안마다 다른 금액을 뜻하게 된다.
      pension_credit_ceiling: creditCeiling,
      // D36 — 막대에 올릴 수 없는 것을 표로 낸다. 금액이 한 칸도 없다.
      pension_withdrawal_tax_reference: pensionRateReference,
      pension_withdrawal_start: startDateResult.entries,
      isa_transfer_extra_limit: transferResult.transfer
        ? {
            transfer_amount_krw: transferResult.transfer.amount_krw,
            destination: transferResult.transfer.destination,
            extra_credit_limit_krw: transferResult.transfer.extra_credit_limit_krw,
            prior_applied_deducted_krw: transferResult.transfer.prior_applied_deducted_krw,
            counted_as_contribution_krw: transferResult.transfer.amount_krw,
            basis_rule_ids: transferResult.transfer.basis_rule_ids,
          }
        : null,
      fund_use_horizon_boundaries: boundaries,
      plans,
      comparison_note_codes: comparisonNotes,
      legal_basis: legalBasis,
      unapplied_proposed_rules: isProposed ? collectUnapplied(access, selection, request) : [],
      notices,
    },
  };
}

/**
 * 수익률 가정에 딸린 안내들.
 *
 * **가정을 받지 않았다는 사실도 안내로 낸다.** 조용히 빈 자리를 남기면 화면은
 * "ISA 효과가 없다"와 "묻지 않았다"를 구별할 수 없다(D19).
 */
function isaReturnNotices(isaReturn, plans, options) {
  if (!isaReturn.supplied) {
    return [notice(NOTICE.ISA_RETURN_NOT_SUPPLIED, 'info', 'profile.isa_return_assumption')];
  }

  const out = [];
  const estimates = plans.map((plan) => plan.assumption_based_isa_estimate);

  if (options.assumption_based_isa_estimate === ISA_ESTIMATE_DISPLAY.SUPPRESS) {
    // 표시가 꺼진 상태가 조용하면 안 된다 — 계산은 돌았고 금액만 감춘 것이다.
    out.push(
      notice(NOTICE.ISA_RETURN_ESTIMATE_SUPPRESSED, 'info', 'options.assumption_based_isa_estimate'),
    );
  }

  const notComputable = estimates.find(
    (estimate) => estimate.state === ISA_ESTIMATE_STATE.NOT_COMPUTABLE,
  );
  if (notComputable) {
    out.push(
      notice(NOTICE.ISA_RETURN_ESTIMATE_NOT_COMPUTABLE, 'warning', 'profile.isa_return_assumption', {
        reason_code: notComputable.not_computable_reason_code,
      }),
    );
  }

  if (estimates.some((estimate) => estimate.state === ISA_ESTIMATE_STATE.COMPUTED)) {
    // 이 금액은 정산 기간 전체의 값이다. 연 환산은 비과세 한도를 해마다 새로 주는
    // 계산이 되어 **적어도** 1.75배 과대다(계약 3년). 계약이 길수록 과대율이 커져
    // 2.8배에 수렴하므로 1.75는 상한이 아니라 하한이다(`isa.benefit.settlement_period`).
    out.push(
      notice(NOTICE.ISA_RETURN_ESTIMATE_NOT_ANNUAL, 'info', null, {
        settlement_years: estimates.find((e) => e.state === ISA_ESTIMATE_STATE.COMPUTED)
          .settlement_years,
      }, [RULE.ISA_BENEFIT_SETTLEMENT_PERIOD]),
    );
    if (estimates.some((estimate) => estimate.point_estimate_krw === null)) {
      out.push(
        notice(NOTICE.ISA_RETURN_ESTIMATE_RANGE, 'info', 'profile.isa_return_assumption', {}, [
          RULE.ISA_BENEFIT_INCOME_CHARACTER,
        ]),
      );
    }
    // 세율차 축이 0인 것이 「혜택 없음」이 아니라 「아직 비과세 한도 안이라 9%가 아니라
    // 0%로 과세되고 있다」는 더 유리한 사실임을 말한다(D36). **배분안마다 원금이 달라
    // 갈릴 수 있으므로** 시나리오 단위 안내는 「어느 안에서 그렇다」까지만 말하고,
    // 행을 그리는 판정은 배분안 단위 `rate_gap_axis_zero_reason_code`가 낸다.
    if (
      estimates.some(
        (estimate) =>
          estimate.rate_gap_axis_zero_reason_code === RATE_GAP_ZERO_REASON.WITHIN_TAX_FREE_LIMIT,
      )
    ) {
      out.push(
        notice(NOTICE.ISA_RATE_GAP_AXIS_ZERO, 'info', null, {}, [RULE.ISA_TAX_FREE_LIMIT]),
      );
    }
  }

  // ISA 칸에만 금액이 보이는 것을 "ISA가 더 낫다"로 읽으면 안 된다. 연금계좌 쪽 효과는
  // 꺼내는 시점에 정해지므로 지금 계산할 수 없고, 부호까지 가정에 달려 있다.
  out.push(
    notice(NOTICE.PENSION_TAX_DEFERRAL_NOT_QUANTIFIED, 'info', null, {}, [
      RULE.PENSION_TAX_DEFERRAL_WITH_RETURN,
    ]),
  );

  return out;
}

function collectBillStages(access) {
  const stages = new Set();
  for (const [, { rule }] of access.usedEntries()) {
    if (rule.status === RULESET_STATUS.PROPOSED && rule.bill_stage) stages.add(rule.bill_stage);
  }
  return [...stages].sort();
}

/**
 * 반영하지 않은 개정예고 규칙. 무엇을 빼고 계산했는지가 드러나지 않으면
 * 사용자는 개정안 전부가 반영된 결과로 읽는다.
 */
function collectUnapplied(access, selection, request) {
  const used = new Set(access.usedEntries().map(([id]) => id));

  return selection.proposed.doc.rules
    .filter((rule) => !used.has(rule.id))
    .map((rule) => ({
      rule_id: rule.id,
      title: rule.title,
      reason_code: unappliedReason(rule.id, request),
    }))
    .sort((a, b) => byCodeUnit(a.rule_id, b.rule_id));
}

function unappliedReason(ruleId, request) {
  if (ruleId === RULE.PROPOSED_YOUTH_IRP_RATE && request.profile.declared_youth !== true) {
    return REASON_INPUT_MISSING;
  }
  if (ruleId === RULE.PROPOSED_TRANSFER_EXTRA && request.isa_transfer === null) {
    return REASON_INPUT_MISSING;
  }
  return UNAPPLIED_REASON[ruleId] ?? DEFAULT_UNAPPLIED_REASON;
}

function buildAssumptions(request, ageReckoning, isaReturn, horizonSuppression) {
  const scenarios = request.scenarios;
  const out = [];
  const add = (code, params = {}, basisRuleIds = []) =>
    out.push({ code, params, applies_to_scenarios: scenarios, basis_rule_ids: basisRuleIds });

  if (request.profile.months_defaulted) {
    add(ASSUMPTION.MONTHS_DEFAULTED, { months: request.profile.months_remaining_in_tax_year });
  }

  // 만 나이의 **기준일**은 여전히 엔진이 고른다. 룰셋 규칙이 생겼지만 그 규칙의 결론이
  // "단일 기준일은 존재하지 않는다"이기 때문이다 — 규칙이 생겼다고 이 가정을 지우면
  // 그것이 거짓이 된다. 코드 문자열은 낡았고(constants.mjs) 뜻은 계약 8.3절이 정의한다.
  //
  // **어느 요건에 이 가정이 걸리는지를 함께 낸다.** 나이를 정수로 환산해 비교하는 경로만
  // 이 가정 위에 서 있고, 연금 쪽은 날짜 대 날짜로 비교해 걸리지 않는다. 그 구분이
  // 값으로 나가지 않으면 화면은 계산 전체가 이 가정 위에 있다고 읽는다.
  add(
    ASSUMPTION.AGE_REFERENCE_DATE,
    {
      reference_date: formatIsoDate(endOfTaxYear(request.tax_year)),
      requires_reference_date_rule_ids: ageReckoning.requires_reference_date_rule_ids,
    },
    ageReckoning.basis_rule_ids,
  );

  // 1단계 질문을 "근로소득 외에 **합산되는** 소득이 있는가"로 좁혀 물었으므로,
  // 분리과세로 종결된 소득만 더 있는 사람은 '아니오'로 답해 총급여 기준으로 간다.
  // 규칙의 `open_interpretation`이 그 쟁점을 **미확정**으로 남겼고, 좁혀 묻는 것은
  // 그 두 해석 중 하나(reading_b)를 채택한 것이 된다. 조문이 정한 것처럼 표시하지 않는다.
  if (request.profile.has_non_wage_global_income_current_year !== true) {
    add(ASSUMPTION.CREDIT_RATE_WAGE_ONLY_READING, {}, [RULE.CREDIT_RATE_BASIS]);
  }

  add(ASSUMPTION.LOCAL_TAX_FOLLOWS_CAP, {}, [RULE.CREDIT_TAX_CAP, RULE.LOCAL_SURTAX]);

  const retirementTransferIn =
    request.accounts.annuity_savings.retirement_transfer_in_krw +
    request.accounts.retirement_pension.retirement_transfer_in_krw;
  if (retirementTransferIn > 0) {
    add(ASSUMPTION.RETIREMENT_TRANSFER_IN_CONTRIBUTION_LIMIT, { amount_krw: retirementTransferIn }, [
      RULE.CREDIT_EXCLUDED_CONTRIBUTIONS,
      RULE.PENSION_CONTRIBUTION_LIMIT,
    ]);
  }
  if (
    [ACCOUNT.ANNUITY, ACCOUNT.PENSION].some(
      (account) => request.accounts[account].has_deferred_retirement_income === null,
    )
  ) {
    // 없다고 보면 5년 요건이 살아 있어 잠금기간을 길게 본다 = 보수적이다.
    add(ASSUMPTION.DEFERRED_RETIREMENT_INCOME_ABSENT, {}, [RULE.PENSION_EARLIEST_START]);
  }
  if (!request.accounts.isa.exists) add(ASSUMPTION.ISA_NEW_ACCOUNT);
  if (!request.accounts.isa.years_since_opening_provided) add(ASSUMPTION.ISA_TENURE_ZERO);
  if (!request.accounts.isa.other_savings_provided) add(ASSUMPTION.OTHER_SAVINGS_ZERO);
  if (request.isa_transfer !== null && !request.isa_transfer.prior_year_provided) {
    add(ASSUMPTION.PRIOR_TRANSFER_CREDIT_ZERO);
  }

  add(ASSUMPTION.SINGLE_TAX_YEAR);
  // **이 가정에 이제 룰셋 근거가 붙는다.** 세액 한도를 총급여액에서 산출하는 경로가
  // 세지 않은 공제를 규칙이 `excluded_items`로 열거하고, 그것을 세지 않은 결과가
  // 어느 방향인지(과대)까지 같은 규칙이 적는다. 전에는 근거 없는 표시 규칙이었다.
  add(ASSUMPTION.OTHER_DEDUCTIONS_EXCLUDED, {}, [RULE.CREDIT_TAX_CAP_ESTIMATE]);
  // 원 미만 버림은 룰셋 근거가 아니라 엔진의 표시 규칙이다. 그래서 근거 규칙이 비어 있다.
  add(ASSUMPTION.ROUNDING_FLOOR);
  // 수익률 가정이 들어오면 이 가정은 거짓이 된다 — 그때는 금액이 실제로 나간다.
  // 선언과 동작이 어긋나는 것을 막는 자리이고, 같은 조건이 `isa_tax_free_headroom`에도 걸린다.
  if (isaReturn === null || !isaReturn.supplied) {
    add(ASSUMPTION.ISA_BENEFIT_NOT_QUANTIFIED, {}, [RULE.ISA_TAX_FREE_LIMIT]);
  }
  // **이 가정에 조건이 붙었다**(`12.0.0`, D52 2번). 세 시점에서는 여전히 참이다 —
  // 자금 사용 시점이 순서와 경고만 바꾼다. `within_isa_lock_in`에서는 **거짓**이므로
  // 내지 않는다. 거짓이 된 가정을 계속 싣는 것이 이 저장소가 반복해 밟은 결함이다.
  //
  // **ISA가 살아남아도 내지 않는다**(`13.0.0`, D53 1번). `applies`가 재는 것은
  // 「이 입력이 금액을 바꿨는가」이고, 연금 두 계좌가 비었으면 답은 「바꿨다」다.
  if (!horizonSuppression.applies) add(ASSUMPTION.HORIZON_EXCLUDED_FROM_AMOUNTS);
  add(ASSUMPTION.EARLY_EXIT_NOT_QUANTIFIED, {}, [
    RULE.ISA_CLAWBACK,
    RULE.PENSION_EARLY_WITHDRAWAL_RATE,
  ]);
  add(ASSUMPTION.PENSION_HOLDING_NOT_EVALUATED, {}, [RULE.PENSION_WITHDRAWAL_ELIGIBILITY]);

  // ── 수익률 가정 위의 계산이 서 있는 가정들 (D28 지켜야 할 선 ②·③) ──
  // 가정을 받지 않았으면 이 계산 자체가 없으므로 한 건도 붙지 않는다.
  if (isaReturn !== null && isaReturn.supplied) {
    // **이 서비스는 수익률을 제시하지 않는다.** 그 구분이 D31이 남긴 방어선 전부다.
    add(ASSUMPTION.ISA_RETURN_RATE_USER_SUPPLIED, {
      annual_return_rate: request.profile.isa_return_assumption.annual_return_rate,
    });
    // 복리·단리를 세법이 정하지 않는다. 혜택이 수익률에 단조 증가하므로 단리가 과소 방향이다.
    add(ASSUMPTION.ISA_RETURN_SIMPLE_INTEREST, {}, [RULE.ISA_BENEFIT_SETTLEMENT_PERIOD]);
    // 원금을 잔액이 아니라 납입액으로 본다 — 이미 난 운용수익이 빠져 과소 방향이다.
    add(ASSUMPTION.ISA_RETURN_PRINCIPAL_FROM_CONTRIBUTIONS, {}, [RULE.ISA_BENEFIT_FORMULA]);
    if (isaReturn.settlementSource === ISA_ESTIMATE.SETTLEMENT_SOURCE_RULESET) {
      // 수익률에는 조문에 닻이 없어 기본값을 만들 수 없지만 계약기간 하한은 조문이 정한 값이다.
      // 실제 계약기간이 더 길면 결과가 달라지므로 대체값을 썼다는 사실이 나가야 한다.
      add(ASSUMPTION.ISA_SETTLEMENT_YEARS_DEFAULTED, { settlement_years: isaReturn.settlementYears }, [
        RULE.ISA_ACCOUNT_REQUIREMENTS,
        RULE.ISA_BENEFIT_SETTLEMENT_PERIOD,
      ]);
    }
    if (!request.profile.isa_return_assumption.loss_provided) {
      // `L`을 지어내면 과대가 된다. 0으로 두면 손익통산 축이 0이 되어 과소 방향이다.
      add(ASSUMPTION.ISA_LOSS_ZERO, {}, [RULE.ISA_BENEFIT_FORMULA, RULE.ISA_LOSS_OFFSET]);
    }
    // 비교 기준을 14% 원천징수 종결(case A)로 둔다. 금융소득종합과세 대상이면 실제
    // 혜택이 더 크므로 이 값은 **하한**이다 — 조문에서 나오는 귀결이고 서비스의 편의가 아니다.
    add(ASSUMPTION.ISA_COMPARISON_BASELINE_WITHHOLDING, {}, [
      RULE.ISA_BENEFIT_FORMULA,
      RULE.ISA_BENEFIT_QUANTIFICATION,
    ]);
    // 정산 시점까지 계약을 유지하는 것을 전제한다. 중도해지 추징은 미래의 선택이고
    // 요청에 그 입력이 없으므로, 선언한 자금 사용 시점에서 추론하지 않는다.
    add(ASSUMPTION.ISA_RETURN_HELD_TO_SETTLEMENT, {}, [RULE.ISA_CLAWBACK]);
  }

  return out;
}

function ruleMissingFallback() {
  return { code: 'rule_missing', field: null, params: {} };
}

function failure(request, errors) {
  return {
    ok: false,
    schema_version: typeof request?.schema_version === 'string' ? request.schema_version : SCHEMA_VERSION,
    errors,
  };
}

/** 읽기 전용 조회. 배분을 계산하지 않는다. */
export function computeFundUseHorizonBoundaries(request, rulesets) {
  const { errors, normalized } = validateBoundariesRequest(request);
  if (errors.length > 0) return failure(request, errors);

  const outcome = boundariesSource(
    {
      birthDate: normalized.birthDate,
      isaExists: normalized.isaExists,
      isaYearsSinceOpening: normalized.isaYearsSinceOpening,
    },
    rulesets,
    normalized.scenario,
    normalized.taxYear,
  );

  if (!outcome.ok) return failure(request, outcome.errors);

  const notices = [];
  if (!normalized.isaTenureProvided) {
    notices.push(notice(NOTICE.ISA_TENURE_MISSING, 'warning', 'isa_years_since_opening', {}, [
      RULE.ISA_ACCOUNT_REQUIREMENTS,
    ]));
  }
  notices.push(
    notice(NOTICE.PENSION_HOLDING_NOT_EVALUATED, 'info', null, {}, [RULE.PENSION_WITHDRAWAL_ELIGIBILITY]),
  );

  return {
    ok: true,
    schema_version: normalized.schema_version,
    boundaries: outcome.boundaries,
    legal_basis: buildLegalBasis(outcome.access),
    notices,
  };
}
