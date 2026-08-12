/**
 * 세액공제액 헤드라인이 어느 상태인가 — `screens.md` 4.8절(2026-08-11 D39 전면
 * 개정)의 **두** 상태를 **고르기만** 하는 순수 함수.
 *
 * **왜 셋에서 둘로 줄었나(D39·D40).** 직전 과세연도 결정세액 입력이 없어지면서
 * "모름"이 성립하던 전제(*사용자가 몰라서 못 답했다*)가 사라졌다. 세액 한도를
 * 이제 엔진이 해당 과세기간 총급여액에서 **항상** 계산해 내므로, 화면에는
 * "사용자가 답하지 않은" 경로가 없다. `cap_krw`는 계약 9.0.0부터 결코 `null`이
 * 아니다.
 *
 * **뺄셈을 하지 않는다.** 계약 5.6절이 자르기 전 금액(`*_before_cap_krw`)과 잘린
 * 금액(`tax_liability_cap.reduced_*_krw`)을 **둘 다** 내보내는 이유가 이것이다 —
 * 화면이 두 값을 빼기 시작하면 그 순간 세법 판단이 화면 코드로 들어온다(계약
 * 5.10절, 10절). 이 모듈은 필드를 고르기만 하고 산술을 하지 않는다.
 *
 * 상태를 고르는 순서가 곧 우선순위다.
 *  1. `applied: true` → `reduced` — 자른 뒤 금액 + 자르기 전 금액 + 잘린 금액
 *     (4.8절 (2)). **전부 잘려 0원이 되는 경우도 이 상태의 극단으로 흡수한다**
 *     — 별도 "0" 상태를 두지 않는다.
 *  2. 그 외          → `plain`   — 이 절이 걸리지 않는다.
 *
 * **한도가 상한이라는 사실은 상태와 별개로 항상 실린다.** `capKrw`·
 * `isUpperBound`·`bindingCode`·`directionIndeterminate`를 함께 낸다 —
 * 새로 금지되는 진술("한도에 걸리지 않았습니다"·"여유가 있습니다")을 화면이
 * 적지 않으려면 그 자리들이 값으로 있어야 한다(계약 8.7절, D40). **화면이
 * 판단하지 않는다** — `binding_code`를 읽을 뿐이다.
 */

export const HEADLINE_MODE = {
  PLAIN: 'plain',
  REDUCED: 'reduced',
};

/**
 * D37 2번의 문장(「이 막대가 짧은 것은…」)을 이 안에서 보여줄 수 있는가.
 *
 * **계약 11.0.0부터 `binding_code`만으로는 부족하다**(D46 1번·D49). `applied`가
 * 이제 원 미만을 버리기 전의 정확값끼리 판정하므로, 잘린 양이 1원에 못 미치면
 * `applied: true`(그래서 `binding_code`도 `binds_provably`)인데 표시 금액은
 * 한 원도 줄지 않는 좌표가 실재한다(총급여 24,795,208원·예산 2,666,667원). 이
 * 문장은 **눈에 보이는 짧음에 대한 진술**이므로, `binding_code === 'binds_provably'`
 * **그리고** `reduced_total_krw > 0`(실제로 줄어든 표시 금액이 있는가)일 때만
 * 참이다(계약 5.5절). 아무것도 짧아지지 않았는데 왜 짧은지 설명하면 사용자가
 * 없는 것을 찾는다. **화면이 판단하지 않는다** — 두 칸을 그대로 읽을 뿐이다.
 */
export function showsCapBelowCeilingNote(plan) {
  const cap = plan?.deterministic_benefit?.tax_liability_cap ?? null;
  if (!cap) return false;
  return cap.binding_code === 'binds_provably' && (cap.reduced_total_krw ?? 0) > 0;
}

/**
 * @param {object} plan 계약 5.5절 `Plan`
 * @returns {{mode: string, totalKrw: number, beforeCapKrw: number|null,
 *            reducedTotalKrw: number|null, thresholdIncomeTaxKrw: number|null,
 *            errorDirectionCode: string|null, contributionCarryoverAvailable: boolean,
 *            basisRuleIds: string[], capKrw: number|null, isUpperBound: boolean,
 *            bindingCode: string|null, directionIndeterminate: boolean}}
 */
export function taxCreditHeadlineView(plan) {
  const benefit = plan?.deterministic_benefit ?? {};
  const cap = benefit.tax_liability_cap ?? null;
  const directionIndeterminate = cap ? cap.error_direction_code === 'direction_indeterminate' : false;
  const base = {
    totalKrw: benefit.pension_credit_total_krw ?? 0,
    beforeCapKrw: benefit.pension_credit_total_before_cap_krw ?? null,
    reducedTotalKrw: cap ? (cap.reduced_total_krw ?? null) : null,
    thresholdIncomeTaxKrw: cap ? (cap.threshold_income_tax_krw ?? null) : null,
    errorDirectionCode: cap ? (cap.error_direction_code ?? null) : null,
    contributionCarryoverAvailable: Boolean(cap?.contribution_carryover_available),
    basisRuleIds: cap?.basis_rule_ids ?? [],
    // **`cap_krw`는 결코 `null`이 아니다**(계약 5.10절). 한도 블록이 아예 없는
    // 응답(옛 목·부분 fixture)에서만 `null`로 남는다.
    capKrw: cap ? (cap.cap_krw ?? null) : null,
    // 이 값이 그 사람의 실제 한도에 대해 상한임이 보장되는가. `false`면
    // (종합소득이 있는데 금액을 모르는 분기) 방향조차 정해지지 않는다(D41).
    isUpperBound: cap ? cap.error_direction_code !== 'direction_indeterminate' : false,
    // **화면이 판단하지 않는다.** 이 값을 그대로 읽어 D37 문장을 쓸 수 있는지를
    // 가른다 — `binds_provably`일 때만 쓸 수 있다(계약 8.7절, D40).
    bindingCode: cap ? (cap.binding_code ?? null) : null,
    directionIndeterminate,
  };

  // 한도 블록이 아예 없는 응답(옛 목·부분 fixture)에서도 화면이 죽지 않게 한다.
  // 없는 것을 "잘리지 않았다"로 읽는 것이 아니라 "이 절이 걸리지 않는다"로 읽는다.
  if (!cap) return { ...base, mode: HEADLINE_MODE.PLAIN };

  if (cap.applied === true) return { ...base, mode: HEADLINE_MODE.REDUCED };
  return { ...base, mode: HEADLINE_MODE.PLAIN };
}

/**
 * 반환된 배분안 중 하나라도 잘렸는가. C-3 위에 `아래 금액은 낼 세금까지만 반영한
 * 값입니다`를 둘지 정한다(4.8절 (2) 마지막 항목) — 잘림이 배분안마다 다를 수
 * 있으므로 시나리오 단위로 본다.
 */
export function anyPlanCapApplied(scenario) {
  return (scenario?.plans ?? []).some((p) => p?.deterministic_benefit?.tax_liability_cap?.applied === true);
}
