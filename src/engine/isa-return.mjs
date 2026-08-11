// 가정 기반 ISA 정산액 (D28·D29·D31).
//
// **이 파일이 내는 값은 확정된 세액공제와 성질이 다르다.** 연금계좌 세액공제는 조문이
// 그 과세기간에 대해 정하는 금액이고, 여기 나오는 값은 **사용자가 제시한 수익률·소득
// 성격·정산 기간이라는 가정 위의 계산**이다. 그래서 이름에 `benefit`을 쓰지 않고
// `assumption_based`를 넣었다 — 자료형이 스스로 성질을 말해야 화면이 두 값을 같은 축에
// 놓지 않는다.
//
// **D28이 그은 선 ①이 이 파일의 경계다.** 여기서 나온 금액은 목적함수에 들어가지 않는다.
// 배분·세액공제액·배분안 순서·경고는 이 파일을 한 번도 읽지 않으며, 그 사실을
// `echo.isa_return_affects`가 선언하고 불변식 I37이 회귀로 강제한다.
//
// **세법 수치는 하나도 없다.** 두 세율(계좌 밖 원천징수율·ISA 초과분 세율), 지방소득세
// 부가율, 비과세 한도금액, 계약기간 하한, 소득 성격별 과세 비율 구간이 전부 룰셋에서 온다.

import {
  AXIS_BOUND,
  AXIS_CEILING_PERIOD,
  ISA_ESTIMATE,
  ISA_ESTIMATE_DISPLAY,
  ISA_ESTIMATE_NOT_COMPUTABLE,
  ISA_ESTIMATE_STATE,
  RATE_GAP_ZERO_REASON,
  RULE,
} from './constants.mjs';
import { applyRate, clampToZero } from './ratio.mjs';

const APPLIED_TO = 'plans[].assumption_based_isa_estimate';

/**
 * 소득 성격이 정하는 과세 비율 `s`의 구간을 룰셋 문자열에서 읽는다.
 *
 * **선택지가 정하는 것은 `s`의 값이 아니라 구간이다**(D29 1절). 혜택이 `s`에 단조
 * 증가하므로 구간의 양 끝이 조문에서 나오고, **구간을 내는 것은 추정이 아니다.**
 * 구간 안의 한 점을 고르는 것만이 추정이므로 점은 `point`가 참일 때만 낸다.
 *
 * 형식을 읽지 못하면 `null`을 돌려 계산을 멈춘다 — 비율을 코드에서 지어내지 않는다.
 * (`limits.mjs`의 `readTenureCap`이 룰셋 산식에서 숫자를 읽는 것과 같은 형태다.)
 */
export function parseTaxableShareRange(text) {
  if (typeof text !== 'string') return null;
  // 선택지에 따라 뒤에 설명이 붙는다. 첫 문장만 남긴다.
  const head = text.split(/\.(?:\s|$)/)[0].trim();
  const NUM = String.raw`(\d+(?:\.\d+)?)`;

  const point = new RegExp(`^s\\s*=\\s*${NUM}$`).exec(head);
  if (point) return { min: Number(point[1]), max: Number(point[1]), point: true };

  const range = new RegExp(`^${NUM}\\s*[≤<]\\s*s\\s*[≤<]\\s*${NUM}$`).exec(head);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { min, max, point: false } : null;
  }
  return null;
}

/** 계좌 밖 이자·배당의 원천징수율. 룰셋의 세율 대비표에서 읽는다. */
function readGeneralWithholdingRate(access) {
  const items = access.value(RULE.ISA_BENEFIT_QUANTIFICATION, ['value', 'statable_amounts'], APPLIED_TO);
  if (items === undefined) return undefined;

  const gap = Array.isArray(items) ? items.find((item) => item?.id === 'rate_gap') : undefined;
  if (typeof gap?.income_tax?.general !== 'number') {
    // 없는 값을 기본값으로 메우지 않는다. 경로를 다시 읽어 rule_missing을 남긴다.
    access.value(
      RULE.ISA_BENEFIT_QUANTIFICATION,
      ['value', 'statable_amounts', 'rate_gap', 'income_tax', 'general'],
      APPLIED_TO,
    );
    return undefined;
  }
  return gap.income_tax.general;
}

/**
 * 축마다 **상한이 있는지**를 룰셋에서 읽는다 (D38 6번·7번, `isa.benefit.axis_ceiling`).
 *
 * **없다는 것이 조문의 판정이지 우리가 못 낸 것이 아니다.** 그래서 세 축의 유무를 전부
 * 읽고, 있다고 적힌 축에만 금액을 만든다. 없다고 적힌 축에 분모를 지어내면 그 막대는
 * 거짓말을 하고, 있다고 적힌 축에 금액을 안 내면 「한도 중 얼마」를 화면이 만들게 된다.
 *
 * **셋 중 하나라도 이 계약이 낼 수 있는 형태를 벗어나면 멈춘다.** 예컨대 룰셋이 저율
 * 분리과세 축에 상한이 생겼다고 적으면 그 금액을 만들 산식이 이 계약에 없다 —
 * 그때 조용히 `false`로 내보내면 룰셋이 바뀐 사실이 응답에서 사라진다.
 * (`pension-reference.mjs`의 `crossCheckRates`가 쓰는 것과 같은 형태의 중단이다.)
 *
 * @returns `{ taxFree: true }` 형태의 판정 · 낼 수 없으면 `null`
 */
function readAxisCeilingFlags(access) {
  const at = (axis) =>
    access.value(RULE.ISA_BENEFIT_AXIS_CEILING, ['value', axis, 'has_a_ceiling'], APPLIED_TO);

  const taxFree = at('tax_free_axis');
  const rateGap = at('rate_gap_axis');
  const lossOffset = at('loss_offset_axis');
  // 이 상한이 **한 해가 아니라 계약 한 건**의 값이라는 판정. 이 자리가 비면 화면이
  // 기간 없이 「최대 ○원 중 ○원」을 적게 되고, 옆의 세액공제 축이 연간이라 오독이 난다.
  const unit = access.value(
    RULE.ISA_BENEFIT_AXIS_CEILING,
    ['value', 'tax_free_axis', 'the_unit_of_this_ceiling'],
    APPLIED_TO,
  );
  if (taxFree === undefined || rateGap === undefined || lossOffset === undefined) return null;
  if (typeof unit !== 'string') return null;

  if (taxFree !== true || rateGap !== false || lossOffset !== false) {
    // 값을 고르지 않는다. 룰셋이 바뀐 것인지 계약이 낡은 것인지는 엔진이 정하지 않는다.
    access.value(
      RULE.ISA_BENEFIT_AXIS_CEILING,
      ['value', 'axis_ceilings_this_contract_can_express'],
      APPLIED_TO,
    );
    return null;
  }
  return { taxFree, rateGap, lossOffset };
}

/**
 * 이 시나리오에서 정산액을 낼 재료를 룰셋에서 모은다.
 *
 * 요청에 가정이 없으면 **규칙을 한 건도 읽지 않는다** — 읽지 않은 규칙을 근거로 싣지
 * 않는다는 규약이 여기에도 그대로 걸린다.
 *
 * @returns `{ supplied: false }` · 재료가 담긴 객체 · 규칙을 읽지 못했으면 `null`(계산 중단)
 */
export function resolveIsaReturn(access, { assumption }) {
  if (assumption === null) return { supplied: false };

  const generalRate = readGeneralWithholdingRate(access);
  const isaRate = access.value(RULE.ISA_EXCESS_RATE, ['value', 'rate'], APPLIED_TO);
  const minContractYears = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'min_contract_years'],
    APPLIED_TO,
  );
  const options = access.value(
    RULE.ISA_BENEFIT_INCOME_CHARACTER,
    ['value', 'what_to_ask_instead', 'options'],
    APPLIED_TO,
  );
  // 세 축의 항등 분해가 규칙에 살아 있는지 확인하고 근거로 싣는다. 이 자리가 비면
  // 화면의 「손익통산」 축이 근거를 잃는다.
  const axes = access.value(
    RULE.ISA_BENEFIT_FORMULA,
    ['value', 'axis_decomposition'],
    APPLIED_TO,
  );
  // 「계약기간 전체의 정산액」을 낼 수 있다고 정한 자리. 규칙이 그 판단을 거두면 멈춘다.
  const producible = access.value(
    RULE.ISA_BENEFIT_SETTLEMENT_PERIOD,
    ['value', 'what_can_be_produced_instead'],
    APPLIED_TO,
  );
  // 축마다 상한의 유무가 다르다는 판정(D38). 축 금액을 낼 때만 읽는다.
  const axisCeilings = readAxisCeilingFlags(access);
  // 손익통산의 근거 규칙. `L`을 빼는 자리가 어느 조문인지가 화면에 붙어야 한다.
  access.use(RULE.ISA_LOSS_OFFSET, APPLIED_TO);
  // 연금계좌 쪽 칸이 비어 있는 것을 "효과가 없다"로 읽지 않게 하는 규칙(18.5절).
  access.use(RULE.PENSION_TAX_DEFERRAL_WITH_RETURN, 'notices[pension_tax_deferral_not_quantified]');

  if (
    generalRate === undefined ||
    isaRate === undefined ||
    minContractYears === undefined ||
    options === undefined ||
    axes === undefined ||
    producible === undefined ||
    axisCeilings === null
  ) {
    return null;
  }

  const option = Array.isArray(options)
    ? options.find((item) => item?.id === assumption.income_character)
    : undefined;
  const share = parseTaxableShareRange(option?.s_range);
  if (share === null) {
    access.value(
      RULE.ISA_BENEFIT_INCOME_CHARACTER,
      ['value', 'what_to_ask_instead', 'options', assumption.income_character, 's_range'],
      APPLIED_TO,
    );
    return null;
  }

  for (const key of ['loss_offset_axis', 'tax_free_axis', 'rate_gap_axis']) {
    if (typeof axes[key] !== 'string') {
      access.value(RULE.ISA_BENEFIT_FORMULA, ['value', 'axis_decomposition', key], APPLIED_TO);
      return null;
    }
  }
  if (
    !Array.isArray(producible) ||
    !producible.some((item) => item?.id === 'contract_settlement_amount')
  ) {
    access.value(
      RULE.ISA_BENEFIT_SETTLEMENT_PERIOD,
      ['value', 'what_can_be_produced_instead', 'contract_settlement_amount'],
      APPLIED_TO,
    );
    return null;
  }

  const settlementFromUser = assumption.settlement_years !== null;
  return {
    supplied: true,
    assumption,
    share,
    generalRate,
    isaRate,
    minContractYears,
    axisCeilings,
    settlementYears: settlementFromUser ? assumption.settlement_years : minContractYears,
    settlementSource: settlementFromUser
      ? ISA_ESTIMATE.SETTLEMENT_SOURCE_USER
      : ISA_ESTIMATE.SETTLEMENT_SOURCE_RULESET,
    basisRuleIds: [
      RULE.ISA_ACCOUNT_REQUIREMENTS,
      RULE.ISA_BENEFIT_AXIS_CEILING,
      RULE.ISA_BENEFIT_FORMULA,
      RULE.ISA_BENEFIT_INCOME_CHARACTER,
      RULE.ISA_BENEFIT_QUANTIFICATION,
      RULE.ISA_BENEFIT_SETTLEMENT_PERIOD,
      RULE.ISA_EXCESS_RATE,
      RULE.ISA_LOSS_OFFSET,
      RULE.ISA_TAX_FREE_LIMIT,
      RULE.LOCAL_SURTAX,
    ].sort(),
  };
}

/** 소득세를 매기고 지방소득세 부가율을 얹는다. 엔진이 다른 곳에서 쓰는 두 단계 그대로다. */
function taxOf(amountKrw, rate, surtaxRate) {
  const incomeTax = applyRate(amountKrw, rate);
  if (incomeTax === null) return null;
  const localTax = applyRate(incomeTax, surtaxRate);
  if (localTax === null) return null;
  return incomeTax + localTax;
}

/**
 * 과세 비율 `s` 하나에 대한 정산. **순수 산술이라 밖으로 내보내 따로 시험한다.**
 *
 * `혜택 = G × 일반세율 × (1+부가율) − max(0, N − C) × ISA세율 × (1+부가율)`
 *
 * **비교 기준의 과세표준이 `N`이 아니라 `G`인 것이 이 산식의 알맹이다** — 계좌 밖에는
 * 손실 차감 규정이 없다. `N`을 쓰면 손익통산 축이 통째로 사라진다.
 */
export function settlementAt({
  totalReturnKrw,
  taxableShare,
  lossKrw,
  taxFreeLimitKrw,
  generalRate,
  isaRate,
  surtaxRate,
}) {
  const grossKrw = applyRate(totalReturnKrw, taxableShare);
  if (grossKrw === null) return null;

  const netKrw = clampToZero(grossKrw - lossKrw);
  const excessKrw = clampToZero(netKrw - taxFreeLimitKrw);

  const comparisonTax = taxOf(grossKrw, generalRate, surtaxRate);
  const isaTax = taxOf(excessKrw, isaRate, surtaxRate);
  // 세 축. 합이 혜택과 **항등적으로** 같은 것은 실수 산술에서이고, 원 미만 절사가
  // 축마다 따로 걸리므로 정수에서는 몇 원이 어긋날 수 있다. 그 몫을 삼키지 않고
  // `rounding_residual_krw`로 내보낸다 — `monthly_rounding_residual_krw`와 같은 규율이다.
  const lossOffsetAxis = taxOf(grossKrw - netKrw, generalRate, surtaxRate);
  const taxFreeAxis = taxOf(Math.min(netKrw, taxFreeLimitKrw), generalRate, surtaxRate);
  const excessAtGeneral = taxOf(excessKrw, generalRate, surtaxRate);

  if ([comparisonTax, isaTax, lossOffsetAxis, taxFreeAxis, excessAtGeneral].includes(null)) {
    return null;
  }

  const rateGapAxis = excessAtGeneral - isaTax;
  const settlementKrw = comparisonTax - isaTax;

  return {
    grossKrw,
    netKrw,
    excessKrw,
    comparisonTaxKrw: comparisonTax,
    isaTaxKrw: isaTax,
    settlementKrw,
    axes: {
      loss_offset_krw: lossOffsetAxis,
      tax_free_krw: taxFreeAxis,
      rate_gap_krw: rateGapAxis,
      rounding_residual_krw: settlementKrw - (lossOffsetAxis + taxFreeAxis + rateGapAxis),
    },
  };
}

/** 상태만 다르고 형태는 같은 껍데기. 금액 칸이 조용히 사라지지 않게 전부 적어 둔다. */
function shell(state, context, extra = {}) {
  return {
    state,
    not_computable_reason_code: null,
    // **상수다.** 다른 모든 금액이 연간인 화면에서 이 값만 성질이 다르다는 것을
    // 자료형으로 못박는다. 비과세 한도가 계약 단위라 연 환산은 **적어도** 1.75배 과대이고
    // (계약 3년), 계약이 길수록 커져 2.8배에 수렴한다 — 1.75는 상한이 아니라 하한이다
    // (`isa.benefit.settlement_period`의 `correction_1_75_is_the_floor_not_the_ceiling`).
    is_annual: false,
    settlement_years: context.settlementYears,
    settlement_years_source: context.settlementSource,
    taxable_share_min: context.share.min,
    taxable_share_max: context.share.max,
    principal_krw: null,
    principal_basis_code: ISA_ESTIMATE.PRINCIPAL_BASIS,
    return_accrual_code: ISA_ESTIMATE.RETURN_ACCRUAL,
    total_return_krw: null,
    taxable_income_krw: null,
    loss_offset_applied_krw: null,
    net_income_krw: null,
    tax_free_limit_krw: null,
    comparison_side_tax_krw: null,
    isa_side_tax_krw: null,
    point_estimate_krw: null,
    lower_bound_krw: null,
    upper_bound_krw: null,
    axis_breakdown: null,
    // 축마다 **상한이 있는지**와 그 상한이 재는 기간(D38 6번·7번). 금액이 없으면
    // 분모도 없다 — 축 금액이 없는데 「한도 중 얼마」를 적을 자리를 만들지 않는다.
    axis_ceilings: null,
    // 세 축 금액이 점인가 구간의 위 끝인가(D36). 금액이 없으면 이 판단도 없다.
    axis_breakdown_bound_code: null,
    // 세율차 축의 0이 「한도 안이라 0%로 과세된다」는 뜻인가(D36).
    rate_gap_axis_zero_reason_code: null,
    comparison_baseline_code: ISA_ESTIMATE.COMPARISON_BASELINE,
    is_lower_bound_for_aggregate_taxpayer: true,
    // 정산 시점까지 계약을 유지하는 것을 전제한다. 중도해지로 감면세액이 추징되면
    // 이 값은 0이 되지만(`isa.early_termination.clawback`), **해지는 사실이 아니라
    // 미래의 선택이고 요청에 그 입력이 없다.** 선언한 자금 사용 시점에서 추론하지 않는다.
    assumes_contract_held_to_settlement: true,
    basis_rule_ids: context.basisRuleIds,
    ...extra,
  };
}

/**
 * 배분안 하나에 붙는 가정 기반 ISA 정산액.
 *
 * **원금은 「가입 이후 누적 납입액 + 이 배분안의 ISA 배분액」이다.** 잔액이 아니라
 * 납입액이므로 이미 난 운용수익을 포함하지 않고, 그만큼 결과가 **과소** 방향이다.
 * 이 조직이 감수하기로 한 방향이며 그 사실이 가정으로 나간다.
 */
export function isaEstimateFor({ context, display, taxFreeLimitKrw, principalKrw, surtaxRate }) {
  if (!context.supplied) return null;
  // D31 — 계산과 입력은 그대로 두고 **표시만** 끈다. 껍데기는 그대로 나가되 금액이
  // 하나도 실리지 않으므로, 화면이 실수로 렌더링할 값 자체가 없다. 동시에 `state`가
  // "값이 없다"가 아니라 "값을 감췄다"를 말한다 — 조용한 빈 자리를 만들지 않는다(D19).
  if (display === ISA_ESTIMATE_DISPLAY.SUPPRESS) {
    return shell(ISA_ESTIMATE_STATE.DISPLAY_SUPPRESSED, context);
  }

  if (taxFreeLimitKrw === null) {
    return shell(ISA_ESTIMATE_STATE.NOT_COMPUTABLE, context, {
      not_computable_reason_code: ISA_ESTIMATE_NOT_COMPUTABLE.TAX_FREE_LIMIT_UNKNOWN,
    });
  }

  const exposure = principalKrw * context.settlementYears;
  const totalReturnKrw = Number.isSafeInteger(exposure)
    ? applyRate(exposure, context.assumption.annual_return_rate)
    : null;
  if (totalReturnKrw === null) {
    return shell(ISA_ESTIMATE_STATE.NOT_COMPUTABLE, context, {
      not_computable_reason_code: ISA_ESTIMATE_NOT_COMPUTABLE.AMOUNT_NOT_REPRESENTABLE,
    });
  }

  const at = (taxableShare) =>
    settlementAt({
      totalReturnKrw,
      taxableShare,
      lossKrw: context.assumption.loss_amount_krw ?? 0,
      taxFreeLimitKrw,
      generalRate: context.generalRate,
      isaRate: context.isaRate,
      surtaxRate,
    });

  const upper = at(context.share.max);
  const lower = context.share.point ? upper : at(context.share.min);
  // 비과세 축의 상한 = `C × 일반세율 × (1+부가율)`. **축의 정의가 `min(N, C) × …`이고
  // `min(N, C) ≤ C`이므로** 이 값이 그 축이 넘을 수 없는 값이다. 새 세법 수치가 없다 —
  // `C`도 두 율도 이미 이 계산이 쓰고 있는 값이다.
  const taxFreeCeiling = taxOf(taxFreeLimitKrw, context.generalRate, surtaxRate);
  if (upper === null || lower === null || taxFreeCeiling === null) {
    return shell(ISA_ESTIMATE_STATE.NOT_COMPUTABLE, context, {
      not_computable_reason_code: ISA_ESTIMATE_NOT_COMPUTABLE.AMOUNT_NOT_REPRESENTABLE,
    });
  }

  return shell(ISA_ESTIMATE_STATE.COMPUTED, context, {
    principal_krw: principalKrw,
    total_return_krw: totalReturnKrw,
    // 아래 넷은 **상한(`taxable_share_max`)에 대응하는 값**이다. 구간으로 내는 입력에서
    // `G`는 하나로 정해지지 않으므로, 어느 끝의 값인지를 이름이 아니라 이 문장과
    // `taxable_share_max`가 말한다.
    taxable_income_krw: upper.grossKrw,
    loss_offset_applied_krw: context.assumption.loss_amount_krw ?? 0,
    net_income_krw: upper.netKrw,
    tax_free_limit_krw: taxFreeLimitKrw,
    comparison_side_tax_krw: upper.comparisonTaxKrw,
    isa_side_tax_krw: upper.isaTaxKrw,
    // **점은 소득 성격이 확정적일 때만 낸다.** 구간 안의 한 점을 고르는 근거가 조문에 없다.
    point_estimate_krw: context.share.point ? upper.settlementKrw : null,
    lower_bound_krw: lower.settlementKrw,
    upper_bound_krw: upper.settlementKrw,
    axis_breakdown: upper.axes,
    // **축마다 상한의 유무가 다르다**(D38). 유무는 룰셋에서 읽고, 있다고 적힌 축에만
    // 금액을 만든다. 나머지 둘에 `*_krw` 칸을 두지 않은 것이 이 객체의 요점이다 —
    // 칸이 있으면 언젠가 값이 들어가고, 조문에 없는 분모는 지어낸 분모다.
    axis_ceilings: {
      tax_free_krw: taxFreeCeiling,
      // **계약 1건당이다.** 옆의 세액공제 축은 연간이므로 기간이 값으로 나가지 않으면
      // 두 축을 나란히 둔 배치가 이 값을 연간으로 읽게 만든다.
      tax_free_period_code: AXIS_CEILING_PERIOD,
      tax_free_settlement_years: context.settlementYears,
      // **이 값은 「법이 정한 최대 절세액」이 아니라 이 계산이 낼 수 있는 값의 최댓값이다.**
      // 비교 세율이 14%보다 높아질 여지가 둘 있고 둘 다 실제 값을 키우는 방향이라,
      // 오차 방향은 과소다(`isa.benefit.axis_ceiling`의 `is_0_14_the_right_comparison_rate`).
      tax_free_is_lower_bound: true,
      rate_gap_has_ceiling: context.axisCeilings.rateGap,
      loss_offset_has_ceiling: context.axisCeilings.lossOffset,
    },
    // **세 축은 `upper_bound_krw`의 분해다.** 점이 없는 입력에서 그 값을 점처럼 적으면
    // 실제보다 크게 말하는 것이 된다. 화면이 `point_estimate_krw === null`로 이 판단을
    // 대신하게 두지 않고 값으로 낸다(D36, tax-rules-report 23.3절).
    axis_breakdown_bound_code: context.share.point ? AXIS_BOUND.POINT : AXIS_BOUND.UPPER_BOUND,
    // **`rate_gap_krw === 0`으로 판정하지 않는다.** 순소득이 한도를 근소하게 넘으면
    // 초과분이 있는데도 원 미만 절사로 이 축이 0이 되는 좌표가 있고, 그 0은 여기
    // 해당하지 않는다. 판정 축은 순소득과 비과세 한도의 비교 하나다(D36).
    rate_gap_axis_zero_reason_code:
      upper.netKrw <= taxFreeLimitKrw ? RATE_GAP_ZERO_REASON.WITHIN_TAX_FREE_LIMIT : null,
  });
}
