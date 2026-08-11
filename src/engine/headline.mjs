// 헤드라인 합계 — **점이 아니라 구간이다** (D38, `benefit.headline.composite_total`).
//
// 소유자가 헤드라인에 세액공제와 ISA 혜택을 합치라고 했고 게이트가 그것을 승인했다.
// 그런데 **두 수의 단위 기간이 다르다** — 세액공제는 한 과세기간의 값이고(소득세법
// §59조의3 ①의 「해당 과세기간에 연금계좌에 납입한 금액」) ISA는 한 계약의 값이다
// (조특법 §91조의18 ②의 「가입일 또는 연장일을 기준으로」). 그래서 합계 자체는 낼 수
// 있어도 **그 합계에 기간 이름을 붙이면 그 줄이 틀린 수가 된다.**
//
// **이 파일이 지는 항등식 하나.** 두 성분의 오차 방향이 반대라 합계는 구간이 되고,
// 그 구간의 아래 끝이 확정된 세액공제액과 **정확히 같은 수**가 된다.
//
//   - 확정 성분은 하한이다 — 장래 과세기간의 세액공제액은 공제액이므로 0 이상이고,
//     따라서 올해만 세는 것이 과소 방향임을 조문이 보장한다.
//   - 가정 성분의 아래 끝도 조문에서 나온다 — 소액주주가 증권시장에서 양도하는 국내
//     상장주식의 양도차익은 애초에 양도소득 과세대상이 아니므로(소득세법 §94조 ① 3호 가목)
//     계좌 안팎의 세금 차이가 0이다. 그것이 `taxable_share_min`이 0인 이유다.
//
// **그러므로 확정과 가정의 구분이 부기가 아니라 숫자 자체에 들어간다.** 「최소 ○원 ~
// 최대 ○원」에서 아래 끝은 조문만으로 정해지는 수이고 위 끝만 가정 위에 선다.
//
// **엔진이 아래 끝에 0을 박아 넣지 않는다.** 아래 끝은 `estimate.lower_bound_krw`를
// 그대로 더한 값이고, 그 0은 룰셋의 `s_range`가 정한다. 룰셋이 그 구간의 아래 끝을
// 옮기면 합계의 아래 끝도 따라 옮겨진다 — 항등식은 코드의 규약이 아니라 **조문의 귀결**이며,
// 그 사실을 `fault-injection.test.mjs`가 구간을 옮겨 확인한다.
//
// **세법 수치는 하나도 없다.** 이 파일에 있는 것은 덧셈과 분기 이름뿐이다.

import {
  HEADLINE_DETERMINED_PERIOD,
  HEADLINE_TOTAL_BOUND,
  ISA_ESTIMATE_STATE,
  RULE,
} from './constants.mjs';

const APPLIED_TO = 'plans[].headline_composite_total';

/**
 * 규칙이 정한 **분기 세 갈래**. 이름은 룰셋의 키 그대로다.
 *
 * 셋을 집합으로 대조하는 이유는 `pension-reference.mjs`의 세율 대조와 같다 — 갈래가
 * 늘거나 이름이 바뀌면 엔진이 그 갈래를 모르는 채 계산을 이어 가고, 그러면 규칙이
 * 개정된 사실이 응답에서 조용히 사라진다.
 */
const SHAPE_BRANCHES = [
  'when_the_isa_point_estimate_exists',
  'when_it_does_not',
  'when_there_is_no_isa_component',
];

/**
 * 합계를 낼 근거를 룰셋에서 읽는다.
 *
 * **이 규칙은 언제나 읽는다** — ISA 성분이 없는 사용자에게도 헤드라인 합계는 나가고
 * (그때는 확정 성분과 같은 수다), 그 「같은 수」도 이 규칙의 세 번째 갈래가 정한 것이다.
 *
 * @returns `{ basisRuleIds }` · 규칙을 읽지 못했으면 `null`(계산 중단)
 */
export function resolveHeadlineRule(access) {
  const shape = access.value(
    RULE.BENEFIT_HEADLINE_COMPOSITE_TOTAL,
    ['value', 'the_rule', 'shape'],
    APPLIED_TO,
  );
  // **금지 목록이 사라지면 멈춘다.** 이 계약이 합계에 기간 이름도 상한도 붙이지 않는
  // 근거가 그 목록이고, 목록 없이 같은 형태를 계속 내면 그것은 엔진의 취향이 된다.
  const forbidden = access.value(
    RULE.BENEFIT_HEADLINE_COMPOSITE_TOTAL,
    ['value', 'the_rule', 'forbidden'],
    APPLIED_TO,
  );
  if (shape === undefined || forbidden === undefined) return null;

  const known = SHAPE_BRANCHES.every((branch) => typeof shape[branch] === 'string');
  const same = Object.keys(shape).length === SHAPE_BRANCHES.length;
  if (!known || !same || !Array.isArray(forbidden) || forbidden.length === 0) {
    // 어느 갈래가 맞는지는 엔진이 정하지 않는다. 경로를 다시 읽어 rule_missing을 남긴다.
    access.value(
      RULE.BENEFIT_HEADLINE_COMPOSITE_TOTAL,
      ['value', 'the_rule', 'shape', 'branches_this_contract_can_express'],
      APPLIED_TO,
    );
    return null;
  }

  return {
    basisRuleIds: [
      RULE.BENEFIT_HEADLINE_COMPOSITE_TOTAL,
      RULE.CREDIT_RATE,
      RULE.ISA_BENEFIT_SETTLEMENT_PERIOD,
    ].sort(),
  };
}

/**
 * 배분안 하나의 헤드라인 합계.
 *
 * **가정 성분이 들어가는 조건이 둘이다**(규칙의 `when_there_is_no_isa_component`).
 * 정산액을 실제로 냈어야 하고(`state`가 `computed`), **이 배분안이 ISA에 넣은 돈이
 * 있어야 한다.** 뒤쪽이 없으면 그 정산액은 이 배분안이 만든 것이 아니므로 「이 배분으로
 * 계산된」이라는 한정 안에 들어오지 않는다.
 *
 * @param determinedCreditKrw 올해 확정된 세액공제액(세액 한도 적용 **후**). 구간의 아래 끝이다
 * @param estimate 이 배분안의 `AssumptionBasedIsaEstimate` (없으면 `null`)
 * @param isaAllocatedKrw 이 배분안이 ISA에 넣은 금액(원/연)
 */
export function headlineCompositeTotalFor({
  determinedCreditKrw,
  estimate,
  isaAllocatedKrw,
  rule,
}) {
  const hasAssumption =
    estimate !== null && estimate.state === ISA_ESTIMATE_STATE.COMPUTED && isaAllocatedKrw > 0;

  // 가정 성분이 없으면 합계는 확정 성분과 같은 한 수다. **이 갈래에서만 합계가 확정
  // 등급이고, 이 갈래에서만 합계에 「올해」를 단독으로 붙일 수 있다.**
  if (!hasAssumption) {
    return {
      lower_bound_krw: determinedCreditKrw,
      upper_bound_krw: determinedCreditKrw,
      point_estimate_krw: determinedCreditKrw,
      bound_code: HEADLINE_TOTAL_BOUND.POINT,
      includes_assumption_component: false,
      determined_component_krw: determinedCreditKrw,
      determined_component_period_code: HEADLINE_DETERMINED_PERIOD,
      assumption_component_krw: null,
      assumption_settlement_years: null,
      assumption_settlement_years_source: null,
      is_annual: false,
      has_statutory_ceiling: false,
      basis_rule_ids: rule.basisRuleIds,
    };
  }

  const point = estimate.point_estimate_krw;
  const isPoint = point !== null;

  return {
    // **아래 끝 = 확정 성분 + 가정 성분의 아래 끝.** 소득 성격이 확정적이지 않은 요청에서
    // 뒤 항이 0이고, 그래서 이 값이 확정된 세액공제액과 같은 수가 된다. 0을 여기 박지
    // 않는 이유는 이 파일 머리말에 적었다.
    lower_bound_krw: determinedCreditKrw + estimate.lower_bound_krw,
    upper_bound_krw: determinedCreditKrw + estimate.upper_bound_krw,
    point_estimate_krw: isPoint ? determinedCreditKrw + point : null,
    // 점이 있으면 한 수로, 없으면 두 끝으로 적는다. **화면이 이 판정을 대신하지 않는다.**
    bound_code: isPoint ? HEADLINE_TOTAL_BOUND.POINT : HEADLINE_TOTAL_BOUND.RANGE,
    includes_assumption_component: true,
    // 구성 두 줄의 재료. 화면이 더하지도 빼지도 않게 두 성분을 그대로 낸다 —
    // 규칙이 「두 성분을 화면이 더하게 하지 않는다」고 적은 자리다.
    determined_component_krw: determinedCreditKrw,
    determined_component_period_code: HEADLINE_DETERMINED_PERIOD,
    // 위 끝에 실제로 들어간 ISA 금액. 점이 있으면 그 점, 없으면 구간의 위 끝이다.
    assumption_component_krw: isPoint ? point : estimate.upper_bound_krw,
    // 그 성분이 걸친 기간과 그 기간이 어디서 왔는가. 「앞으로 ○년 동안」이 합계 옆에
    // 붙어야 하므로 같은 객체에 싣는다 — 화면이 다른 객체를 뒤져 기간을 맞추게 두면
    // 그 조립이 곧 어긋난다.
    assumption_settlement_years: estimate.settlement_years,
    assumption_settlement_years_source: estimate.settlement_years_source,
    // **상수다.** 합계에는 어느 기간도 붙지 않는다 — 두 기간에 걸친 누적액이지
    // 「올해의 세금」도 「N년치 평균」도 아니다.
    is_annual: false,
    // **상수다.** 합계에 법정 상한이 없다 — ISA 세 축 중 둘에 뚜껑이 없다
    // (`isa.benefit.axis_ceiling`). 「최대 ○원 중 ○원」 형태는 세액공제 축 전용이고,
    // 그 축의 눈금은 `pension_credit_ceiling`이 따로 낸다.
    has_statutory_ceiling: false,
    basis_rule_ids: rule.basisRuleIds,
  };
}
