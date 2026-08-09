/**
 * 세액공제액 헤드라인이 어느 상태인가 — `screens.md` 4.8절의 세 상태를 **고르기만**
 * 하는 순수 함수.
 *
 * **뺄셈을 하지 않는다.** 계약 5.6절이 자르기 전 금액(`*_before_cap_krw`)과 잘린
 * 금액(`tax_liability_cap.reduced_*_krw`)을 **둘 다** 내보내는 이유가 이것이다 —
 * 화면이 두 값을 빼기 시작하면 그 순간 세법 판단이 화면 코드로 들어온다(계약
 * 3.5절 E2·E4, 10절). 이 모듈은 필드를 고르기만 하고 산술을 하지 않는다.
 *
 * **`cap_krw: 0`과 `cap_krw: null`을 같게 다루지 않는다**(계약 10절). 앞은 "낼
 * 세금이 없다"는 확정 사실이고 뒤는 "얼마인지 모른다"는 사실이다. 두 상태의
 * 결과 화면이 다르다.
 *
 * 상태를 고르는 순서가 곧 우선순위다.
 *  1. `known: false`  → `bounded` — 상한 표기(`최대`)와 임계값 한 줄 (4.8절 (1))
 *  2. `cap_krw === 0` → `zero`    — `0 원`을 크게, 오류 색을 쓰지 않는다 (4.8절 (3))
 *  3. `applied: true` → `reduced` — 자른 뒤 금액 + 자르기 전 금액 + 잘린 금액 (4.8절 (2))
 *  4. 그 외          → `plain`   — 이 절이 걸리지 않는 지금까지의 화면
 *
 * `zero`가 `reduced`보다 앞인 이유: 한도가 0이면 `applied`도 참이 되지만, 그때
 * 사용자에게 정확한 답은 "잘렸다"가 아니라 "이 배분에서 계산되는 세액공제액이
 * 없다"이다(4.8절 (3)).
 */

export const HEADLINE_MODE = {
  PLAIN: 'plain',
  BOUNDED: 'bounded',
  REDUCED: 'reduced',
  ZERO: 'zero',
};

/**
 * @param {object} plan 계약 5.5절 `Plan`
 * @returns {{mode: string, totalKrw: number, beforeCapKrw: number|null,
 *            reducedTotalKrw: number|null, thresholdIncomeTaxKrw: number|null,
 *            errorDirectionCode: string|null, contributionCarryoverAvailable: boolean,
 *            basisRuleIds: string[]}}
 */
export function taxCreditHeadlineView(plan) {
  const benefit = plan?.deterministic_benefit ?? {};
  const cap = benefit.tax_liability_cap ?? null;
  const base = {
    totalKrw: benefit.pension_credit_total_krw ?? 0,
    beforeCapKrw: benefit.pension_credit_total_before_cap_krw ?? null,
    reducedTotalKrw: cap ? (cap.reduced_total_krw ?? null) : null,
    thresholdIncomeTaxKrw: cap ? (cap.threshold_income_tax_krw ?? null) : null,
    errorDirectionCode: cap ? (cap.error_direction_code ?? null) : null,
    contributionCarryoverAvailable: Boolean(cap?.contribution_carryover_available),
    basisRuleIds: cap?.basis_rule_ids ?? [],
  };

  // 한도 블록이 아예 없는 응답(옛 목·부분 fixture)에서도 화면이 죽지 않게 한다.
  // 없는 것을 "잘리지 않았다"로 읽는 것이 아니라 "이 절이 걸리지 않는다"로 읽는다.
  if (!cap) return { ...base, mode: HEADLINE_MODE.PLAIN };

  if (cap.known === false) return { ...base, mode: HEADLINE_MODE.BOUNDED };
  if (cap.cap_krw === 0) return { ...base, mode: HEADLINE_MODE.ZERO };
  if (cap.applied === true) return { ...base, mode: HEADLINE_MODE.REDUCED };
  return { ...base, mode: HEADLINE_MODE.PLAIN };
}

/** 헤드라인이 상한 표기인가 — 공유 이미지와 C-3가 같은 판정을 쓰게 하는 통로. */
export function isBoundedHeadline(plan) {
  return taxCreditHeadlineView(plan).mode === HEADLINE_MODE.BOUNDED;
}

/**
 * 반환된 배분안 중 하나라도 잘렸는가. C-3 위에 `아래 금액은 낼 세금까지만 반영한
 * 값입니다`를 둘지 정한다(4.8절 (2) 마지막 항목) — 잘림이 배분안마다 다를 수
 * 있으므로 시나리오 단위로 본다.
 */
export function anyPlanCapApplied(scenario) {
  return (scenario?.plans ?? []).some((p) => p?.deterministic_benefit?.tax_liability_cap?.applied === true);
}
