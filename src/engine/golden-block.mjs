// 골든 블록의 **형식**과 **대조 절차**. 기대값은 여기에 한 개도 없다.
//
// `golden-cases.test.mjs`가 이 모듈로 문서를 읽어 전건을 돌리고,
// `golden-block-format.test.mjs`가 같은 모듈에 합성 블록을 넣어 **형식 자체가 무는지**를
// 시험한다. 두 파일이 같은 코드를 쓰기 때문에 형식 시험이 실제 실행기를 시험한 것이 된다.
//
// **왜 실행기에서 떼어냈나.** 실행기 파일은 "기대값을 적을 자리를 두지 않는다"는 것이
// 그 파일의 규약이다. 형식이 도는지 보이려면 어딘가에 값이 있어야 하므로, 값을 그 파일에
// 들이는 대신 형식 기계를 밖으로 내보냈다.
//
// 이 파일은 테스트 전용이다 — `index.mjs`가 내보내지 않으므로 제품 번들에 들어가지 않는다.
// `test-helpers.mjs`와 같이 확장자가 `.test.mjs`가 아닌 이유는 러너가 테스트 파일로
// 잡지 않게 하기 위해서다. **여기 있는 숫자는 세법 수치가 아니라 실행기의 픽스처다**
// (기본 과세연도 하나뿐이고 아래에 이유를 적었다).

import assert from 'node:assert/strict';

import {
  ACCOUNT_ORDER,
  CAP_BINDING,
  NON_QUANTIFIED,
  PENSION_ACCOUNT_KEYS,
  PLAN,
  PLAN_ORDER,
  RULE,
  SCENARIO_ORDER,
  SCHEMA_VERSION,
  UNCERTAINTY_KIND,
} from './constants.mjs';

// ── 블록 형식 ────────────────────────────────────────────────────────────────
//
// 허용 키를 전부 열거한다. 오타 난 키를 조용히 무시하면 그 항목은 검사되지 않는데도
// 검사된 것처럼 보인다 — 이 저장소가 세 번 밟은 침묵과 같은 형태다.

const ACCOUNTS = [...ACCOUNT_ORDER];
const CAP_BINDING_CODES = Object.values(CAP_BINDING);
export const CASE_KEYS = ['case', 'request', 'credit_rate', 'expect'];
/**
 * `basis`·`fallback_applied`는 계약 5.0.0의 새 축이다(D27). 비율만 주장하면 그 비율이
 * **무엇으로** 판정됐는지는 아무도 보지 않는데, 이번에 고친 결함이 정확히 그 자리였다 —
 * 총급여만 보고 15%를 준 값과 종합소득금액으로 판정한 12%가 **같은 비율 필드**에 실린다.
 */
export const CREDIT_RATE_KEYS = [
  'income_tax',
  'local_tax',
  'effective',
  'basis',
  'measured_amount',
  'fallback_applied',
  'fallback_direction',
];
const CREDIT_RATE_FIELD = {
  income_tax: 'income_tax_rate',
  local_tax: 'local_tax_rate',
  effective: 'effective_rate',
  basis: 'basis_code',
  measured_amount: 'measured_amount_krw',
  fallback_applied: 'fallback_applied',
  fallback_direction: 'fallback_direction_code',
};
/** `basis_code`가 가질 수 있는 값. 오타를 값이 아니라 형식 단계에서 잡는다. */
const CREDIT_RATE_BASIS_VALUES = ['total_salary', 'global_income', 'statutory_default'];
export const SCENARIO_KEYS = [
  'plans',
  'plan_count',
  'baseline_plan',
  'isa_eligible',
  'isa_reason_codes',
  'limits',
  'boundaries',
  /**
   * D36 — **확정 축의 최댓값.** 배분안이 아니라 시나리오 단위다: 축은 배분안을 바꿔도
   * 움직이지 않아야 하고, 움직이면 같은 길이가 안마다 다른 금액을 뜻하게 된다.
   */
  'pension_credit_ceiling',
  // 6차에 계약 4.0.0이 낸 축. 배분 비율이 아니라 **시점**이라 시나리오 단위에 둔다.
  'pension_withdrawal_start',
  'notice_codes',
  'notice_codes_absent',
  'comparison_note_codes',
  'comparison_note_codes_absent',
  /**
   * D30 — **계약 5.7.1절이 첫 번째 방어선으로 지목한 축.** 룰셋 작성자가 지워서는 안 될
   * 불확실성 표시를 지운 경우를 엔진은 잡지 못한다(엔진은 룰셋을 그대로 비출 뿐이다).
   * 그 자리를 무는 것이 「정답지가 규칙별 미확인 건수를 주장한다」인데, 여태 그것을
   * 적을 어휘가 어느 층에도 없었다. 규칙 id를 키로 하는 객체다.
   */
  'legal_basis',
  /**
   * 반영하지 **않은** 개정예고 규칙과 사유(D32 후속). 규칙 id를 키로 하는 객체다.
   *
   * **왜 필요한가.** 반영하지 않은 규칙은 근거가 아니므로 `legal_basis`에 실리지 않고,
   * 그러면 그 규칙에 남은 미확인 표시를 정답지가 주장할 자리가 어디에도 없다. 다만
   * 주장할 수 있는 것은 **표시 건수가 아니라 「빠졌다는 사실과 그 사유」**다 — 근거가
   * 아닌 규칙의 불확실성은 사용자에게 고지되지 않으므로 셀 대상이 아니다.
   */
  'unapplied_proposed_rules',
];
/** 반영하지 않은 규칙 하나에 대해 주장할 수 있는 것. */
export const UNAPPLIED_KEYS = ['present', 'reason_code'];
/** 비정량 효과 하나(코드 × 계좌)에 대해 주장할 수 있는 것. */
export const NON_QUANTIFIED_KEYS = [
  /** 이 계좌에 이 효과가 붙었는가. `false`면 나머지를 적을 수 없다 */
  'present',
  /** 왜 금액을 못 내는가. 「과세이연으로 ○○원 이득」을 대신 쓰지 못하게 하는 자리다 */
  'reason_code',
  /** 이 효과에 딸린 참·거짓 사실들. `null`은 「이 코드에는 붙지 않는다」는 주장이다 */
  'facts',
];
/** 알려진 비정량 효과 코드. 오타를 값이 아니라 형식 단계에서 잡는다. */
const NON_QUANTIFIED_CODES = [NON_QUANTIFIED.ISA_HEADROOM, NON_QUANTIFIED.PENSION_WITHOUT_CREDIT];
/** `facts`가 붙는 코드. 계약 5.6절이 이 하나로 한정한다. */
const CODE_WITH_FACTS = NON_QUANTIFIED.PENSION_WITHOUT_CREDIT;
/**
 * `facts`가 실을 수 있는 것. 계약 5.6절의 여섯 키 그대로다.
 *
 * **아래 넷은 함께 적어야 한다**(`NON_QUANTIFIED_REQUIRED_FACTS`). 계약이 「셋 중 하나라도
 * 빠지면 화면 문장이 거짓이 된다」고 적은 그 셋이 이 넷으로 표현되기 때문이다 —
 * 원금 비과세 · 확인서 절차와 그 불소급 · 수익 과세. 하나만 적을 수 있게 두면
 * 「facts를 적었으니 검사됐다」로 보이면서 정작 그 문장을 떠받치는 사실이 빠질 수 있다.
 */
export const NON_QUANTIFIED_FACT_KEYS = [
  'credit_this_year_krw',
  'contribution_without_credit_krw',
  'principal_taxed_on_withdrawal',
  'principal_tax_free_requires_confirmation',
  'principal_tax_free_confirmation_prospective_only',
  'returns_taxed_on_withdrawal',
];
const NON_QUANTIFIED_REQUIRED_FACTS = [
  'principal_taxed_on_withdrawal',
  'principal_tax_free_requires_confirmation',
  'principal_tax_free_confirmation_prospective_only',
  'returns_taxed_on_withdrawal',
];
const NON_QUANTIFIED_FACT_AMOUNTS = ['credit_this_year_krw', 'contribution_without_credit_krw'];
/** `legal_basis` 항목 하나가 주장할 수 있는 것. */
export const LEGAL_BASIS_KEYS = [
  /** 이 규칙이 근거 목록에 실렸는가. `false`면 나머지를 적을 수 없다 */
  'present',
  'status',
  'bill_stage',
  'has_uncertainty_note',
  /** **몇 건 남아 있는가.** 일부 해소가 값으로 드러나는 자리다(계약 5.7.1절) */
  'uncertainty_note_count',
  'uncertainty_kinds',
  /** 어디에 남아 있는가. 건수가 같은 채로 자리가 바뀌는 것까지 잡는다 */
  'uncertainty_paths',
  'applied_to',
];
const UNCERTAINTY_KINDS = Object.values(UNCERTAINTY_KIND);
export const PLAN_KEYS = [
  'allocation',
  'tax_credit',
  // 계약 4.0.0에서 `tax_credit`이 한도 적용 **후** 값이 됐다. 자르기 전 금액은
  // 별도 축이고, 둘 다 적어야 "얼마가 잘렸는가"가 블록의 주장이 된다.
  'tax_credit_before_cap',
  'tax_liability_cap',
  'warning_count',
  'warning_codes',
  'limited_by',
  'fill_order',
  'monthly_krw',
  'unallocated_krw',
  // D26 — 미배분액의 갈래. `unallocated_krw` 하나만으로는 "갈 곳이 없다"와
  // "갈 곳은 있으나 공제가 없다"가 구별되지 않는다.
  'unallocated_breakdown',
  // 이 배분을 실행한 **뒤** 남는 공제 대상 한도. 배분 전 잔여 한도와 다른 값이다.
  'credit_remaining_after_plan_krw',
  // 이 안이 어떤 비정량 효과를 달고 나가는가. 공제 없는 연금 납입이 그 자리다.
  'non_quantified_codes',
  /**
   * D32 후속 — **효과 하나의 속살.** 코드 목록만으로는 그 효과에 딸린 사실들이 실제로
   * 나가는지 아무도 보지 않는다. `pension_contribution_without_credit`의 `facts`가 그 자리다.
   *
   * **왜 이번에 열었나.** D32가 이 효과를 기본안으로 옮겨 대다수 사용자가 보게 됐고,
   * 계약 5.6절은 **셋 중 하나라도 빠지면 화면 문장이 거짓이 된다**고 적는다. 특히
   * `principal_tax_free_requires_confirmation`이 빠지면 「나중에 비과세로 돌아옵니다」가
   * 절차를 말하지 않는 거짓 문장이 된다. 그런데 그 사실이 응답에서 값을 바꿔도
   * **정답지가 그것을 주장할 어휘가 없었다.**
   *
   * 두 겹으로 연다 — **효과 코드 → 계좌**. 같은 코드가 두 연금계좌에 각각 붙고
   * 계좌마다 금액이 다르므로, 한 겹으로 접으면 그 구분이 사라진다.
   */
  'non_quantified_effects',
  'monthly_rounding_residual_krw',
  'delta_vs_baseline_krw',
  'credit_eligible_krw',
  'tie_break',
  // 목적함수가 이 입력에서 순위를 정하지 못한다는 자기 신고(계약 5.12절).
  'objective_degenerate',
  'is_baseline',
  // D28·D29 — 가정 기반 ISA 정산액. **`DeterministicBenefit`과 다른 축이다.**
  'assumption_based_isa_estimate',
  /**
   * D38 — 헤드라인 합계. **위 둘을 더한 자리는 응답에서 여기 하나뿐이고**, 그 합계의
   * 아래 끝이 확정 세액공제액과 같은 수라는 항등식이 이 회차의 알맹이다.
   * 정답지가 그 관계를 주장할 수 있어야 「일관되지만 틀린」 합계가 걸린다.
   */
  'headline_composite_total',
];
/**
 * 가정 기반 ISA 정산액이 주장할 수 있는 것. 응답 필드 이름을 그대로 쓴다.
 *
 * **구간을 적을 수 있어야 한다는 것이 이 목록의 요점이다**(`tax-domain`이 7차 머리말에
 * 적은 요구). 소득 성격이 확정적이지 않으면 정답이 점이 아니라 구간이므로, 점만 적을 수
 * 있는 어휘로는 그 회차의 결론이 검사받지 못한다.
 */
export const ISA_ESTIMATE_KEYS = [
  'state',
  'not_computable_reason_code',
  'is_annual',
  'settlement_years',
  'settlement_years_source',
  'taxable_share_min',
  'taxable_share_max',
  /**
   * **아래 넷은 계약이 상수로 고정한 값이다** — 그래서 오히려 어휘에 있어야 한다.
   * 상수는 아무도 주장하지 않으면 조용히 달라지고, 달라져도 어떤 금액도 틀리지 않아
   * 다른 검사에 걸리지 않는다. `tax-domain`이 `is_lower_bound_for_aggregate_taxpayer`를
   * "우회로가 없다"고 짚었고, 같은 성질을 가진 셋을 함께 연다.
   */
  'principal_basis_code',
  'return_accrual_code',
  'is_lower_bound_for_aggregate_taxpayer',
  'assumes_contract_held_to_settlement',
  'principal_krw',
  'total_return_krw',
  'taxable_income_krw',
  'loss_offset_applied_krw',
  'net_income_krw',
  'tax_free_limit_krw',
  'comparison_side_tax_krw',
  'isa_side_tax_krw',
  'point_estimate_krw',
  'lower_bound_krw',
  'upper_bound_krw',
  'axis_breakdown',
  /**
   * D38 6번·7번 — **축마다 상한의 유무가 다르다.** 비과세 축에만 상한이 있고 그 상한은
   * 계약 1건당이다. 정답지가 이 자리를 주장할 수 있어야 「기간 없이 최댓값만 적는」
   * 회귀를 무는 층이 생긴다 — 값은 맞는데 기간이 빠지는 형태는 금액 검사에 걸리지 않는다.
   */
  'axis_ceilings',
  'comparison_baseline_code',
];
/** 세 축 + 절사 잔차. 넷의 합이 `upper_bound_krw`와 같아야 한다. */
export const ISA_AXIS_KEYS = [
  'loss_offset_krw',
  'tax_free_krw',
  'rate_gap_krw',
  'rounding_residual_krw',
];
/**
 * 축의 상한(D38). **금액 칸이 하나뿐인 것이 이 목록의 요점이다** — 나머지 두 축에는
 * 상한이 없고, 없다는 것이 조문의 판정이므로 유무만 적을 수 있다.
 */
export const ISA_AXIS_CEILING_KEYS = [
  'tax_free_krw',
  'tax_free_period_code',
  'tax_free_settlement_years',
  'tax_free_is_lower_bound',
  'rate_gap_has_ceiling',
  'loss_offset_has_ceiling',
];
/**
 * 헤드라인 합계(D38). **`lower_bound_krw`가 이 목록에서 가장 무거운 칸이다** —
 * `bound_code`가 `range`이면 그 값이 같은 안의 확정 세액공제액과 **같은 수**여야 한다.
 * 정답지가 그 항등식을 스스로 주장할 수 있도록 두 끝과 두 성분을 함께 연다.
 */
export const HEADLINE_KEYS = [
  'lower_bound_krw',
  'upper_bound_krw',
  'point_estimate_krw',
  'bound_code',
  'includes_assumption_component',
  'determined_component_krw',
  'assumption_component_krw',
  'assumption_settlement_years',
  'assumption_settlement_years_source',
];
const HEADLINE_BOUNDS = ['point', 'range'];
const ISA_ESTIMATE_STATES = ['computed', 'display_suppressed', 'not_computable'];
/** 상태가 `computed`가 아니면 이 칸들은 전부 `null`이다. 주장하면 자기모순이다. */
const ISA_ESTIMATE_AMOUNT_KEYS = ISA_ESTIMATE_KEYS.filter(
  // `axis_ceilings`는 이름이 `_krw`로 끝나지 않지만 **안에 금액을 담는다**(D38).
  (key) => key.endsWith('_krw') || key === 'axis_breakdown' || key === 'axis_ceilings',
);
export const TAX_CREDIT_KEYS = ['income_tax', 'local_tax', 'total'];
export const LIMIT_KEYS = [
  'pension_combined_credit_limit_krw',
  'pension_combined_credit_remaining_krw',
  'pension_contribution_limit_remaining_krw',
  'annuity_savings_credit_remaining_krw',
  'isa_contribution_remaining_krw',
  'isa_tax_free_limit_krw',
  'isa_transfer_extra_credit_limit_krw',
];
/**
 * 확정 축의 최댓값(D36). **정답지가 「축의 끝이 소득세분이 아니라 합계」임을 스스로
 * 주장할 수 있어야 한다** — 셋을 다 적을 수 있으므로 정답지가 그 관계를 진다.
 */
export const CEILING_KEYS = [
  'ceiling_krw',
  'income_tax_krw',
  'local_tax_krw',
  'credit_limit_krw',
  'rate_source_code',
  'tax_liability_cap_relation_code',
  'fallback_applied',
  'is_axis_degenerate',
];
export const BOUNDARY_KEYS = [
  'isa_lock_in_years',
  'isa_lock_in_years_remaining',
  'pension_min_age_years',
  'pension_years_remaining',
  'pension_holding_period_evaluated',
];
/**
 * 배분안 단위 세액 한도. D22가 이름으로 지목한 넷 + D26이 드러내라고 한 조건 둘 +
 * D54가 갈라 놓은 이월 판정 + **D55 후속이 연 근거 목록의 유무 둘**이다.
 */
export const PLAN_TAX_CAP_KEYS = [
  // **`known`이 여기 있었다**(D39·D40에 폐기). 한도를 「모르는」 상태가 사라졌다 —
  // 총급여액이 있으면 값이 하나로 정해진다. 그 자리를 대신하는 것이 `binding_code`이고,
  // 뜻이 다르다: 전자는 「값을 아는가」였고 후자는 **「걸린다는 것이 증명되는가」**다.
  'cap_krw',
  'applied',
  'binding_code',
  'threshold_income_tax_krw',
  // **`applied`와 다른 자를 쓰는 칸이다**(`14.0.0` · D54). `applied`는 「한도가 물었는가」를
  // 정확값으로 재고, 이 칸은 「**밀려난 납입액이 있는가**」를 **표시 금액**으로 잰다 —
  // 의제인출의 대상이 계좌에 남아 있어야 하는데 원 미만은 남을 수 없기 때문이다.
  // **둘이 갈리는 자리가 실재하므로 정답지가 이 칸을 따로 주장할 수 있어야 한다** —
  // `applied`만 주장하면 그 갈림은 어느 케이스에서도 보이지 않는다.
  'contribution_carryover_available',
  'carryover_shares_future_year_credit_limit',
  'carryover_requires_application',
  /**
   * **딸린 셋 중 마지막 하나**(D55 후속). 위 칸이 `false`이면 조건 둘이 `null`이 되고
   * **전환 특례 규칙이 근거 목록에서 빠진다** — 읽지 않은 규칙을 근거로 싣지 않는다는
   * 규약 때문이다(계약 5.5절). 그 빠짐이 여태 어느 층에서도 주장되지 않았다.
   *
   * **왜 목록 전체가 아니라 포함/불포함인가.** 이 칸의 근거 목록은 한도 산출이 읽은
   * 규칙 일곱에 전환 특례 하나가 붙었다 뗐다 하는 형태다. 전부 열거하게 하면 정답지가
   * 여덟 줄을 옮겨 적으면서 정작 재려는 **한 줄의 유무**는 나머지에 묻힌다.
   * `notice_codes` / `notice_codes_absent`와 같은 규약을 쓴다.
   */
  'basis_rule_ids',
  'basis_rule_ids_absent',
];
/** 전환 특례 규칙 하나. 이 배열의 유일한 세법 값이 아니라 **규칙 이름**이다. */
const CARRYOVER_RULE_ID = RULE.CREDIT_UNUSED_CARRYOVER;
/** 미배분 갈래(D26). `headrooms_overlap`이 true면 두 여력을 더하면 안 된다. */
export const UNALLOCATED_KEYS = [
  'total_annual_krw',
  'pension_contribution_headroom_krw',
  'isa_contribution_headroom_krw',
  'no_headroom_krw',
  'headrooms_overlap',
];
export const PENSION_START_KEYS = [
  'computable',
  'earliest_start_date',
  'years_until_earliest_start',
  'age_requirement_date',
  'holding_requirement_date',
  'holding_requirement_waived',
  'bound_by_holding_period',
  'reason_code',
];

const CASE_ID = /^GC-\d{2}[a-z]?(-oracle)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── 문서 파싱 ────────────────────────────────────────────────────────────────

/** ```golden 펜스 블록을 본문에서 떼어낸다. 줄 번호는 오류 메시지용이다. */
export function extractBlocks(text) {
  // 정보 문자열이 정확히 `golden`인 블록만 잡는다. 형식을 설명하는 예시 블록이
  // 실제 케이스로 오인되면 안 된다.
  const fence = /^```golden[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;
  const blocks = [];
  let stripped = '';
  let cursor = 0;

  for (let match = fence.exec(text); match !== null; match = fence.exec(text)) {
    blocks.push({
      body: match[1],
      line: text.slice(0, match.index).split('\n').length,
    });
    stripped += text.slice(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  stripped += text.slice(cursor);

  return { blocks, prose: stripped };
}

/**
 * 산문에 등장하는 케이스 ID를 전부 모은다. `GC-15~17`·`GC-18a~d` 같은 범위 표기를
 * 펼치므로, 표에 범위로만 적힌 케이스도 블록을 요구받는다.
 */
export function caseIdsIn(text) {
  const token = /GC-(\d{2})([a-z]?)(-oracle)?(?:~(\d{2})?([a-z])?)?/g;
  const ids = new Set();
  const problems = [];

  for (let match = token.exec(text); match !== null; match = token.exec(text)) {
    const [raw, num, suffix, oracle, tailNum, tailSuffix] = match;

    if (tailNum === undefined && tailSuffix === undefined) {
      ids.add(`GC-${num}${suffix}${oracle ?? ''}`);
      continue;
    }
    if (oracle) {
      problems.push(`범위 표기를 읽을 수 없다: ${raw}`);
      continue;
    }
    if (tailNum === undefined) {
      // `GC-18a~d` — 같은 번호 안에서 접미사가 이어진다.
      if (!suffix || tailSuffix < suffix) {
        problems.push(`범위 표기를 읽을 수 없다: ${raw}`);
        continue;
      }
      for (let c = suffix.charCodeAt(0); c <= tailSuffix.charCodeAt(0); c += 1) {
        ids.add(`GC-${num}${String.fromCharCode(c)}`);
      }
      continue;
    }
    // `GC-15~17` — 번호가 이어진다.
    if (suffix || tailSuffix || Number(tailNum) < Number(num)) {
      problems.push(`범위 표기를 읽을 수 없다: ${raw}`);
      continue;
    }
    for (let n = Number(num); n <= Number(tailNum); n += 1) {
      ids.add(`GC-${String(n).padStart(2, '0')}`);
    }
  }

  return { ids, problems };
}

// ── 블록 검증 ────────────────────────────────────────────────────────────────

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function unknownKeys(object, allowed, where, errors) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      errors.push(`${where}: 모르는 키 "${key}" (허용: ${allowed.join(', ')})`);
    }
  }
}

function requireObject(value, where, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${where}: 객체여야 한다`);
    return false;
  }
  return true;
}

/**
 * 빈 객체를 거절한다. `tax_liability_cap: {}`처럼 적으면 키는 있는데 주장은 없어서
 * "적혔으니 검사됐다"고 보이면서 실제로는 아무것도 보지 않는다 — 이 장치가 막으려는
 * 상태 그 자체다.
 */
function requireNonEmptyObject(value, where, errors) {
  if (!requireObject(value, where, errors)) return false;
  if (Object.keys(value).length === 0) {
    errors.push(`${where}: 빈 객체는 아무것도 주장하지 않는다 — 적을 것이 없으면 키째로 빼라`);
    return false;
  }
  return true;
}

function requireInt(value, where, errors) {
  if (!Number.isInteger(value)) errors.push(`${where}: 정수여야 한다 (받은 값: ${JSON.stringify(value)})`);
}

function requireIntOrNull(value, where, errors) {
  if (value !== null && !Number.isInteger(value)) {
    errors.push(`${where}: 정수 또는 null이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireBoolean(value, where, errors) {
  if (typeof value !== 'boolean') {
    errors.push(`${where}: 참/거짓이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireDateOrNull(value, where, errors) {
  if (value !== null && !(typeof value === 'string' && ISO_DATE.test(value))) {
    errors.push(`${where}: YYYY-MM-DD 또는 null이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireStringOrNull(value, where, errors) {
  if (value !== null && typeof value !== 'string') {
    errors.push(`${where}: 문자열 또는 null이어야 한다 (받은 값: ${JSON.stringify(value)})`);
  }
}

function requireStringArray(value, where, errors) {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    errors.push(`${where}: 문자열 배열이어야 한다`);
  }
}

function validateAmountMap(value, where, allowed, errors, { exact = false } = {}) {
  if (!requireObject(value, where, errors)) return;
  unknownKeys(value, allowed, where, errors);
  if (exact) {
    for (const key of allowed) {
      if (!(key in value)) errors.push(`${where}: "${key}"가 빠졌다 — 세 계좌를 모두 적는다`);
    }
  }
  for (const [key, amount] of Object.entries(value)) {
    if (allowed.includes(key)) requireInt(amount, `${where}.${key}`, errors);
  }
}

/** 소득세 + 지방세 = 합계. 옮겨 적다 어긋나는 자리라 형식 단계에서 본다. */
function validateTaxCredit(value, where, errors) {
  validateAmountMap(value, where, TAX_CREDIT_KEYS, errors, { exact: true });
  const { income_tax: income, local_tax: local, total } = value ?? {};
  if ([income, local, total].every(Number.isInteger) && income + local !== total) {
    errors.push(
      `${where}: 소득세 ${income} + 지방세 ${local} ≠ 합계 ${total} — 옮겨 적으면서 어긋났다`,
    );
  }
}

function validatePlanTaxCap(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, PLAN_TAX_CAP_KEYS, where, errors);

  if ('applied' in value) requireBoolean(value.applied, `${where}.applied`, errors);
  // 한도 `0`은 유효한 값이고 「모름」이 아니다 — 이 경로에서는 **등식**이다(계약 5.10절).
  if ('cap_krw' in value) requireInt(value.cap_krw, `${where}.cap_krw`, errors);
  if ('threshold_income_tax_krw' in value) {
    requireInt(value.threshold_income_tax_krw, `${where}.threshold_income_tax_krw`, errors);
  }
  if ('binding_code' in value && !CAP_BINDING_CODES.includes(value.binding_code)) {
    errors.push(
      `${where}.binding_code: 계약 8.7절의 두 값이 아니다 (받은 값: ${value.binding_code})`,
    );
  }
  // **자르지 않은 것은 「걸리지 않는다」를 증명하지 않는다**(D40). 잘리지 않았는데
  // 걸림이 증명된다고 적었으면 옮겨 적다 방향이 뒤집힌 것이다.
  if (value.applied === false && value.binding_code === CAP_BINDING.PROVABLE) {
    errors.push(
      `${where}: applied:false인데 binding_code가 ${CAP_BINDING.PROVABLE}다 — ` +
        '자르지 않은 결과는 한도가 걸린다는 것을 증명하지 못한다',
    );
  }

  if ('contribution_carryover_available' in value) {
    requireBoolean(
      value.contribution_carryover_available,
      `${where}.contribution_carryover_available`,
      errors,
    );
    // **한 방향만 참이다**(`14.0.0` · D54). 이월할 납입액이 있으면 한도가 물었다.
    // 반대는 성립하지 않는다 — 정확값으로만 잘린 좌표에서는 `applied`가 참인데
    // 밀려난 납입액이 0이다. 그 방향을 형식 단계에서 막으면 갈리는 자리를 적을 수 없게 된다.
    if (value.applied === false && value.contribution_carryover_available === true) {
      errors.push(
        `${where}: applied:false인데 contribution_carryover_available:true다 — ` +
          '자르지 않았으면 밀려난 납입액이 없다',
      );
    }
  }

  validateCarryoverChain(value, where, errors);
}

/**
 * **이월 판정에 딸린 셋이 그 판정을 따라갔는가**(D55 후속). 계약 5.5절이 적는 연쇄다 —
 * `contribution_carryover_available`이 거짓이면 조건 둘이 `null`이고 전환 특례 규칙이
 * 근거 목록에서 빠진다.
 *
 * **형식 단계에서 무는 이유는 옮겨 적다 한쪽만 고치는 자리이기 때문이다.** 이월을
 * `false`로 고치면서 조건 둘을 참으로 남겨 두면, 대조는 그 둘에서 실패하겠지만 실패
 * 메시지가 「값이 다르다」라서 **연쇄가 깨졌다는 사실**은 읽는 사람이 다시 유도해야 한다.
 * 여기서 걸면 어긋난 짝의 이름이 그대로 나온다.
 */
function validateCarryoverChain(value, where, errors) {
  const CONDITIONS = ['carryover_shares_future_year_credit_limit', 'carryover_requires_application'];
  for (const key of CONDITIONS) {
    if (!(key in value)) continue;
    if (value[key] !== null && typeof value[key] !== 'boolean') {
      errors.push(`${where}.${key}: 참/거짓 또는 null이어야 한다`);
      continue;
    }
    if (value.contribution_carryover_available === false && value[key] !== null) {
      errors.push(
        `${where}.${key}: contribution_carryover_available:false인데 값이 있다 — ` +
          '전환이 걸리지 않는 안에서는 조건을 읽지 않으므로 null이다',
      );
    }
    if (value.contribution_carryover_available === true && value[key] === null) {
      errors.push(
        `${where}.${key}: contribution_carryover_available:true인데 null이다 — ` +
          '전환이 걸리면 조건 둘을 읽는다',
      );
    }
  }

  for (const key of ['basis_rule_ids', 'basis_rule_ids_absent']) {
    if (key in value) requireStringArray(value[key], `${where}.${key}`, errors);
  }
  const present = Array.isArray(value.basis_rule_ids) ? value.basis_rule_ids : [];
  const absent = Array.isArray(value.basis_rule_ids_absent) ? value.basis_rule_ids_absent : [];

  const both = present.filter((id) => absent.includes(id)).sort();
  if (both.length > 0) {
    errors.push(
      `${where}: 같은 규칙을 실렸다고도 빠졌다고도 적었다 — ${both.join(', ')}`,
    );
  }
  // 이월 판정과 전환 특례 규칙의 유무는 **같은 사실의 두 얼굴이다.** 한쪽만 뒤집으면
  // 그 블록은 스스로 모순이므로 대조 전에 거절한다.
  if (value.contribution_carryover_available === false && present.includes(CARRYOVER_RULE_ID)) {
    errors.push(
      `${where}: contribution_carryover_available:false인데 basis_rule_ids에 ` +
        `${CARRYOVER_RULE_ID}가 있다 — 읽지 않은 규칙은 근거로 실리지 않는다`,
    );
  }
  if (value.contribution_carryover_available === true && absent.includes(CARRYOVER_RULE_ID)) {
    errors.push(
      `${where}: contribution_carryover_available:true인데 basis_rule_ids_absent에 ` +
        `${CARRYOVER_RULE_ID}가 있다 — 전환이 걸리면 그 규칙을 읽는다`,
    );
  }
}

/**
 * 미배분 갈래. **합이 맞는지를 형식 단계에서 본다** — 갈래가 미배분 총액을 넘으면
 * 옮겨 적다 어긋난 것이거나, 겹침을 표시하지 않은 것이다.
 */
function validateUnallocated(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, UNALLOCATED_KEYS, where, errors);

  for (const key of UNALLOCATED_KEYS) {
    if (!(key in value)) continue;
    if (key === 'headrooms_overlap') requireBoolean(value[key], `${where}.${key}`, errors);
    else requireInt(value[key], `${where}.${key}`, errors);
  }

  const { total_annual_krw: total, pension_contribution_headroom_krw: pension } = value;
  const { isa_contribution_headroom_krw: isa, headrooms_overlap: overlap } = value;
  if ([total, pension, isa].every(Number.isInteger) && typeof overlap === 'boolean') {
    if (pension + isa > total !== overlap) {
      errors.push(
        `${where}: 두 여력의 합(${pension + isa})과 미배분 총액(${total})의 관계가 ` +
          `headrooms_overlap(${overlap})과 어긋난다`,
      );
    }
  }
  if ([total, pension].every(Number.isInteger) && pension > total) {
    errors.push(`${where}: 연금 여력이 미배분 총액보다 크다`);
  }
  if ([total, isa].every(Number.isInteger) && isa > total) {
    errors.push(`${where}: ISA 여력이 미배분 총액보다 크다`);
  }
}

/**
 * 규칙별 근거·미확인 건수(D30). **자기모순은 대조 전에 거절한다** — 옮겨 적다 한쪽만
 * 고친 블록이 대조까지 가면 어느 쪽이 사실인지 실패 메시지가 말해 주지 못한다.
 */
function validateLegalBasis(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;

  for (const [ruleId, entry] of Object.entries(value)) {
    const at = `${where}.${ruleId}`;
    if (!requireNonEmptyObject(entry, at, errors)) continue;
    unknownKeys(entry, LEGAL_BASIS_KEYS, at, errors);

    for (const key of ['present', 'has_uncertainty_note']) {
      if (key in entry) requireBoolean(entry[key], `${at}.${key}`, errors);
    }
    if ('uncertainty_note_count' in entry) {
      requireInt(entry.uncertainty_note_count, `${at}.uncertainty_note_count`, errors);
    }
    for (const key of ['uncertainty_kinds', 'uncertainty_paths', 'applied_to']) {
      if (key in entry) requireStringArray(entry[key], `${at}.${key}`, errors);
    }
    for (const key of ['status', 'bill_stage']) {
      if (key in entry) requireStringOrNull(entry[key], `${at}.${key}`, errors);
    }
    for (const kind of entry.uncertainty_kinds ?? []) {
      if (!UNCERTAINTY_KINDS.includes(kind)) {
        errors.push(`${at}.uncertainty_kinds: 모르는 표시 "${kind}" (허용: ${UNCERTAINTY_KINDS.join(', ')})`);
      }
    }

    // 실리지 않았다고 적어 놓고 그 규칙에 대해 무엇을 더 주장할 수는 없다.
    if (entry.present === false && Object.keys(entry).length > 1) {
      errors.push(`${at}: present:false인데 다른 항목을 주장한다 — 없는 근거의 내용을 적을 수 없다`);
    }
    const count = entry.uncertainty_note_count;
    if (typeof entry.has_uncertainty_note === 'boolean' && Number.isInteger(count)) {
      if (entry.has_uncertainty_note !== count > 0) {
        errors.push(
          `${at}: has_uncertainty_note(${entry.has_uncertainty_note})와 ` +
            `uncertainty_note_count(${count})가 어긋난다 — 언제나 count > 0과 같다`,
        );
      }
    }
    if (Number.isInteger(count) && Array.isArray(entry.uncertainty_paths)) {
      if (entry.uncertainty_paths.length !== count) {
        errors.push(
          `${at}: uncertainty_paths ${entry.uncertainty_paths.length}건인데 ` +
            `uncertainty_note_count는 ${count}다 — 한쪽만 고쳤다`,
        );
      }
    }
    if (count === 0 && (entry.uncertainty_kinds ?? []).length > 0) {
      errors.push(`${at}: 건수가 0인데 uncertainty_kinds가 비어 있지 않다`);
    }
  }
}

/** 반영하지 않은 개정예고 규칙(D32 후속). */
function validateUnapplied(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;

  for (const [ruleId, entry] of Object.entries(value)) {
    const at = `${where}.${ruleId}`;
    if (!requireNonEmptyObject(entry, at, errors)) continue;
    unknownKeys(entry, UNAPPLIED_KEYS, at, errors);

    if ('present' in entry) requireBoolean(entry.present, `${at}.present`, errors);
    if ('reason_code' in entry) requireStringOrNull(entry.reason_code, `${at}.reason_code`, errors);
    // 목록에 없다고 적어 놓고 그 항목의 사유를 적을 수는 없다.
    if (entry.present === false && 'reason_code' in entry) {
      errors.push(`${at}: present:false인데 reason_code를 주장한다 — 없는 항목의 사유를 적을 수 없다`);
    }
  }
}

/**
 * 비정량 효과와 그 사실들(D32 후속). **자기모순은 대조 전에 거절한다.**
 *
 * 여기서 값을 단정하지 않는 것이 중요하다 — 네 사실의 참·거짓은 **룰셋에서 읽는 값**이고
 * (`limits.mjs`의 `resolvePensionWithoutCreditFacts`), 조문이 바뀌면 따라 바뀐다.
 * 형식이 잡는 것은 **구조**뿐이다. 단정하는 둘(`credit_this_year_krw`가 0이라는 것,
 * 금액이 0보다 크다는 것)은 세법 수치가 아니라 이 효과의 정의 자체다 —
 * 「공제를 낳지 않는 납입」이 올해 공제를 낳는다고 적으면 그것은 이름과의 모순이다.
 */
function validateNonQuantified(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, NON_QUANTIFIED_CODES, where, errors);

  for (const [code, byAccount] of Object.entries(value)) {
    if (!NON_QUANTIFIED_CODES.includes(code)) continue;
    const atCode = `${where}.${code}`;
    if (!requireNonEmptyObject(byAccount, atCode, errors)) continue;
    unknownKeys(byAccount, ACCOUNTS, atCode, errors);

    for (const [account, entry] of Object.entries(byAccount)) {
      if (!ACCOUNTS.includes(account)) continue;
      const at = `${atCode}.${account}`;
      if (!requireNonEmptyObject(entry, at, errors)) continue;
      unknownKeys(entry, NON_QUANTIFIED_KEYS, at, errors);

      if ('present' in entry) requireBoolean(entry.present, `${at}.present`, errors);
      if ('reason_code' in entry) requireStringOrNull(entry.reason_code, `${at}.reason_code`, errors);
      // 붙지 않았다고 적어 놓고 그 효과의 내용을 적을 수는 없다.
      if (entry.present === false && Object.keys(entry).length > 1) {
        errors.push(`${at}: present:false인데 다른 항목을 주장한다 — 없는 효과의 내용을 적을 수 없다`);
      }

      if (!('facts' in entry) || entry.facts === null) {
        // `facts: null`은 「이 코드에는 사실이 붙지 않는다」는 주장이다. 붙는 코드에 적으면 모순이다.
        if (entry.facts === null && code === CODE_WITH_FACTS) {
          errors.push(`${at}.facts: 이 코드에는 언제나 facts가 붙는다 — null로 적을 수 없다(계약 5.6절)`);
        }
        continue;
      }
      if (code !== CODE_WITH_FACTS) {
        errors.push(
          `${at}.facts: "${code}"에는 facts가 붙지 않는다 — 계약 5.6절이 "${CODE_WITH_FACTS}" 하나로 한정한다`,
        );
        continue;
      }

      const atFacts = `${at}.facts`;
      if (!requireNonEmptyObject(entry.facts, atFacts, errors)) continue;
      unknownKeys(entry.facts, NON_QUANTIFIED_FACT_KEYS, atFacts, errors);

      // **함께 나가야 하는 사실을 하나만 적을 수 없다.** 하나만 적히면 "facts를 주장했다"로
      // 보이면서 정작 화면 문장을 떠받치는 사실이 검사되지 않는다.
      const missing = NON_QUANTIFIED_REQUIRED_FACTS.filter((key) => !(key in entry.facts));
      if (missing.length > 0 && missing.length < NON_QUANTIFIED_REQUIRED_FACTS.length) {
        errors.push(
          `${atFacts}: 함께 나가야 하는 사실이 빠졌다 (${missing.join(', ')}) — ` +
            '셋 중 하나라도 빠지면 화면 문장이 거짓이 된다(계약 5.6절). 넷을 함께 적는다',
        );
      }
      if (missing.length === NON_QUANTIFIED_REQUIRED_FACTS.length) {
        errors.push(
          `${atFacts}: 금액만 적고 사실을 하나도 적지 않았다 — ` +
            '이 키가 열린 이유가 그 사실들이므로 넷을 함께 적는다(계약 5.6절)',
        );
      }
      for (const key of NON_QUANTIFIED_REQUIRED_FACTS) {
        if (key in entry.facts) requireBoolean(entry.facts[key], `${atFacts}.${key}`, errors);
      }
      for (const key of NON_QUANTIFIED_FACT_AMOUNTS) {
        if (key in entry.facts) requireInt(entry.facts[key], `${atFacts}.${key}`, errors);
      }
      // 이름과의 모순. 「공제를 낳지 않는 납입」이 올해 공제를 낳을 수는 없다.
      if ('credit_this_year_krw' in entry.facts && entry.facts.credit_this_year_krw !== 0) {
        errors.push(
          `${atFacts}.credit_this_year_krw: 언제나 0이다 — ` +
            '이 효과는 「올해의 세액공제를 낳지 않는 납입」이고, 그것이 이 값의 뜻이다',
        );
      }
      if (Number.isInteger(entry.facts.contribution_without_credit_krw)) {
        if (entry.facts.contribution_without_credit_krw <= 0) {
          errors.push(
            `${atFacts}.contribution_without_credit_krw: 0보다 커야 한다 — ` +
              '그 몫이 0이면 이 효과 자체가 붙지 않는다. 붙지 않는다고 적으려면 present:false다',
          );
        }
      }
    }
  }
}

/** 가정 기반 ISA 정산액. 상태와 금액이 어긋나면 대조 전에 거절한다. */
function validateIsaEstimate(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, ISA_ESTIMATE_KEYS, where, errors);

  if ('state' in value && !ISA_ESTIMATE_STATES.includes(value.state)) {
    errors.push(`${where}.state: 모르는 상태 "${value.state}" (허용: ${ISA_ESTIMATE_STATES.join(', ')})`);
  }
  for (const key of [
    'not_computable_reason_code',
    'settlement_years_source',
    'comparison_baseline_code',
    'principal_basis_code',
    'return_accrual_code',
  ]) {
    if (key in value) requireStringOrNull(value[key], `${where}.${key}`, errors);
  }
  // 계약이 `true`로 고정한 둘. `false`로 적으면 계약이 하지 않은 선언을 하는 것이다.
  for (const key of ['is_lower_bound_for_aggregate_taxpayer', 'assumes_contract_held_to_settlement']) {
    if (key in value) requireBoolean(value[key], `${where}.${key}`, errors);
  }
  if (value.is_lower_bound_for_aggregate_taxpayer === false) {
    errors.push(
      `${where}.is_lower_bound_for_aggregate_taxpayer: 언제나 true다 — ` +
        '금융소득종합과세 대상자에게는 실제 혜택이 이보다 크므로 이 값은 하한이다',
    );
  }
  if (value.assumes_contract_held_to_settlement === false) {
    errors.push(
      `${where}.assumes_contract_held_to_settlement: 언제나 true다 — ` +
        '중도해지는 요청에 입력이 없어 엔진이 판정하지 않는다(계약 5.14절)',
    );
  }
  for (const key of ['settlement_years', ...ISA_ESTIMATE_AMOUNT_KEYS]) {
    // 객체를 담는 둘은 아래에서 따로 본다.
    if (key in value && key !== 'axis_breakdown' && key !== 'axis_ceilings') {
      requireIntOrNull(value[key], `${where}.${key}`, errors);
    }
  }
  for (const key of ['taxable_share_min', 'taxable_share_max']) {
    if (key in value && typeof value[key] !== 'number') {
      errors.push(`${where}.${key}: 수여야 한다 (받은 값: ${JSON.stringify(value[key])})`);
    }
  }

  // **상수다.** `true`로 적으면 그 블록은 연 환산을 정답으로 주장하는 것이고,
  // 비과세 한도가 계약 단위라 그 주장은 **적어도** 1.75배 과대다(계약 3년). 계약이
  // 길수록 커져 2.8배에 수렴하므로 1.75는 상한이 아니라 하한이다(계약 0.16절).
  if ('is_annual' in value && value.is_annual !== false) {
    errors.push(`${where}.is_annual: 언제나 false다 — 이 금액은 정산 기간 전체의 값이지 1년치가 아니다`);
  }

  if ('axis_breakdown' in value && value.axis_breakdown !== null) {
    const at = `${where}.axis_breakdown`;
    if (requireNonEmptyObject(value.axis_breakdown, at, errors)) {
      unknownKeys(value.axis_breakdown, ISA_AXIS_KEYS, at, errors);
      for (const key of ISA_AXIS_KEYS) {
        if (key in value.axis_breakdown) requireInt(value.axis_breakdown[key], `${at}.${key}`, errors);
      }
      const parts = ISA_AXIS_KEYS.map((key) => value.axis_breakdown[key]);
      if (parts.every(Number.isInteger) && Number.isInteger(value.upper_bound_krw)) {
        const sum = parts.reduce((total, part) => total + part, 0);
        if (sum !== value.upper_bound_krw) {
          errors.push(
            `${at}: 네 축의 합(${sum})이 upper_bound_krw(${value.upper_bound_krw})와 다르다 — ` +
              '세 축의 합은 혜택과 항등적으로 같고 남는 것은 절사 잔차뿐이다',
          );
        }
      }
    }
  }

  const { lower_bound_krw: lower, upper_bound_krw: upper, point_estimate_krw: point } = value;
  if (Number.isInteger(lower) && Number.isInteger(upper) && lower > upper) {
    errors.push(`${where}: lower_bound_krw(${lower})가 upper_bound_krw(${upper})보다 크다`);
  }
  // 점을 낸다는 것은 구간의 두 끝이 같다는 뜻이다. 어긋나면 근거 없는 점을 고른 것이다.
  if (Number.isInteger(point)) {
    for (const [key, bound] of [['lower_bound_krw', lower], ['upper_bound_krw', upper]]) {
      if (Number.isInteger(bound) && bound !== point) {
        errors.push(
          `${where}: point_estimate_krw(${point})가 ${key}(${bound})와 다르다 — ` +
            '점은 구간의 두 끝이 같을 때만 낼 수 있다',
        );
      }
    }
  }

  if ('axis_ceilings' in value && value.axis_ceilings !== null) {
    const at = `${where}.axis_ceilings`;
    if (requireNonEmptyObject(value.axis_ceilings, at, errors)) {
      unknownKeys(value.axis_ceilings, ISA_AXIS_CEILING_KEYS, at, errors);
      for (const key of ['tax_free_krw', 'tax_free_settlement_years']) {
        if (key in value.axis_ceilings) requireInt(value.axis_ceilings[key], `${at}.${key}`, errors);
      }
      for (const key of ['tax_free_is_lower_bound', 'rate_gap_has_ceiling', 'loss_offset_has_ceiling']) {
        if (key in value.axis_ceilings) requireBoolean(value.axis_ceilings[key], `${at}.${key}`, errors);
      }
      if ('tax_free_period_code' in value.axis_ceilings) {
        requireStringOrNull(value.axis_ceilings.tax_free_period_code, `${at}.tax_free_period_code`, errors);
      }
      // **없다는 것이 조문의 판정이다.** 있다고 적는 블록은 그 상한의 금액을 낼 산식이
      // 계약에 없다는 사실과 어긋나므로 대조 전에 거절한다.
      for (const key of ['rate_gap_has_ceiling', 'loss_offset_has_ceiling']) {
        if (value.axis_ceilings[key] === true) {
          errors.push(
            `${at}.${key}: 언제나 false다 — 조특법 §91조의18 ①이 초과분에 상한을 두지 않는다. ` +
              '상한이 없는 축에 분모를 적으면 그 막대는 거짓말을 한다',
          );
        }
      }
      // 이 상한은 「법이 정한 최대 절세액」이 아니라 이 계산이 낼 수 있는 값의 최댓값이다.
      if (value.axis_ceilings.tax_free_is_lower_bound === false) {
        errors.push(
          `${at}.tax_free_is_lower_bound: 언제나 true다 — 비교 세율이 14%보다 높아질 여지가 ` +
            '둘 있고 둘 다 실제 값을 키우는 방향이라 오차 방향이 과소다',
        );
      }
    }
  }

  if ('state' in value && value.state !== 'computed') {
    for (const key of ISA_ESTIMATE_AMOUNT_KEYS) {
      if (key in value && value[key] !== null) {
        errors.push(`${where}: state가 "${value.state}"인데 ${key}에 금액을 주장한다`);
      }
    }
  }
  if (value.state === 'computed' && (value.not_computable_reason_code ?? null) !== null) {
    errors.push(`${where}: state:computed인데 not_computable_reason_code가 있다`);
  }
}

/**
 * 헤드라인 합계(D38). **자기모순은 대조 전에 거절한다.**
 *
 * 특히 두 자리를 본다 — (a) 점을 적었으면 두 끝이 그 점과 같아야 하고, (b) 가정 성분이
 * 없다고 적었으면 성분 칸과 기간 칸이 전부 `null`이어야 한다. 어긋난 블록은 통과하면서
 * 아무것도 주장하지 않는 상태가 된다.
 */
function validateHeadline(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, HEADLINE_KEYS, where, errors);

  for (const key of [
    'lower_bound_krw',
    'upper_bound_krw',
    'point_estimate_krw',
    'determined_component_krw',
    'assumption_component_krw',
    'assumption_settlement_years',
  ]) {
    if (key in value) requireIntOrNull(value[key], `${where}.${key}`, errors);
  }
  if ('includes_assumption_component' in value) {
    requireBoolean(value.includes_assumption_component, `${where}.includes_assumption_component`, errors);
  }
  if ('assumption_settlement_years_source' in value) {
    requireStringOrNull(
      value.assumption_settlement_years_source,
      `${where}.assumption_settlement_years_source`,
      errors,
    );
  }
  if ('bound_code' in value && !HEADLINE_BOUNDS.includes(value.bound_code)) {
    errors.push(
      `${where}.bound_code: 모르는 분기 "${value.bound_code}" (허용: ${HEADLINE_BOUNDS.join(', ')})`,
    );
  }

  const { lower_bound_krw: lower, upper_bound_krw: upper, point_estimate_krw: point } = value;
  if (Number.isInteger(lower) && Number.isInteger(upper) && lower > upper) {
    errors.push(`${where}: lower_bound_krw(${lower})가 upper_bound_krw(${upper})보다 크다`);
  }
  if (Number.isInteger(point)) {
    for (const [key, bound] of [['lower_bound_krw', lower], ['upper_bound_krw', upper]]) {
      if (Number.isInteger(bound) && bound !== point) {
        errors.push(
          `${where}: point_estimate_krw(${point})가 ${key}(${bound})와 다르다 — ` +
            '합계를 한 수로 적는 것은 두 끝이 같을 때뿐이다',
        );
      }
    }
  }
  if (value.bound_code === 'range' && (value.point_estimate_krw ?? null) !== null) {
    errors.push(`${where}: bound_code가 range인데 점을 주장한다`);
  }
  if (value.includes_assumption_component === false) {
    for (const key of [
      'assumption_component_krw',
      'assumption_settlement_years',
      'assumption_settlement_years_source',
    ]) {
      if (key in value && value[key] !== null) {
        errors.push(`${where}: 가정 성분이 없다고 적고 ${key}에 값을 주장한다`);
      }
    }
    if (value.bound_code === 'range') {
      errors.push(`${where}: 가정 성분이 없는데 구간으로 적었다 — 그 합계는 확정 세액공제액 한 수다`);
    }
  }
}

function validatePensionStart(value, where, errors) {
  if (!requireNonEmptyObject(value, where, errors)) return;
  unknownKeys(value, PENSION_ACCOUNT_KEYS, where, errors);

  for (const [account, entry] of Object.entries(value)) {
    if (!PENSION_ACCOUNT_KEYS.includes(account)) continue;
    const at = `${where}.${account}`;
    if (!requireNonEmptyObject(entry, at, errors)) continue;
    unknownKeys(entry, PENSION_START_KEYS, at, errors);

    for (const key of ['computable', 'holding_requirement_waived', 'bound_by_holding_period']) {
      if (key in entry) requireBoolean(entry[key], `${at}.${key}`, errors);
    }
    for (const key of ['earliest_start_date', 'age_requirement_date', 'holding_requirement_date']) {
      if (key in entry) requireDateOrNull(entry[key], `${at}.${key}`, errors);
    }
    if ('years_until_earliest_start' in entry) {
      requireIntOrNull(entry.years_until_earliest_start, `${at}.years_until_earliest_start`, errors);
    }
    if ('reason_code' in entry) requireStringOrNull(entry.reason_code, `${at}.reason_code`, errors);

    // 계산하지 못했다면 날짜가 있을 수 없다. 형식 단계에서 자기모순을 잡는다.
    if (entry.computable === false && entry.earliest_start_date != null) {
      errors.push(`${at}: computable:false인데 earliest_start_date가 있다`);
    }
    if (entry.computable === true && 'earliest_start_date' in entry && entry.earliest_start_date === null) {
      errors.push(`${at}: computable:true인데 earliest_start_date가 null이다`);
    }
  }
}

function validatePlan(plan, where, errors) {
  if (!requireObject(plan, where, errors)) return;
  unknownKeys(plan, PLAN_KEYS, where, errors);

  for (const key of ['allocation', 'tax_credit', 'warning_count']) {
    if (!(key in plan)) errors.push(`${where}: 필수 항목 "${key}"가 없다`);
  }

  if ('allocation' in plan) {
    validateAmountMap(plan.allocation, `${where}.allocation`, ACCOUNTS, errors, { exact: true });
  }
  if ('monthly_krw' in plan) {
    validateAmountMap(plan.monthly_krw, `${where}.monthly_krw`, ACCOUNTS, errors);
  }
  if ('tax_credit' in plan) validateTaxCredit(plan.tax_credit, `${where}.tax_credit`, errors);
  if ('tax_credit_before_cap' in plan) {
    validateTaxCredit(plan.tax_credit_before_cap, `${where}.tax_credit_before_cap`, errors);
  }
  if ('tax_liability_cap' in plan) {
    validatePlanTaxCap(plan.tax_liability_cap, `${where}.tax_liability_cap`, errors);
  }
  if ('unallocated_breakdown' in plan) {
    validateUnallocated(plan.unallocated_breakdown, `${where}.unallocated_breakdown`, errors);
  }
  if ('credit_remaining_after_plan_krw' in plan) {
    requireInt(plan.credit_remaining_after_plan_krw, `${where}.credit_remaining_after_plan_krw`, errors);
  }
  if ('non_quantified_codes' in plan) {
    requireStringArray(plan.non_quantified_codes, `${where}.non_quantified_codes`, errors);
  }
  if ('non_quantified_effects' in plan) {
    validateNonQuantified(plan.non_quantified_effects, `${where}.non_quantified_effects`, errors);
  }
  if ('warning_count' in plan) requireInt(plan.warning_count, `${where}.warning_count`, errors);
  if ('warning_codes' in plan) requireStringArray(plan.warning_codes, `${where}.warning_codes`, errors);
  if ('limited_by' in plan) {
    if (requireObject(plan.limited_by, `${where}.limited_by`, errors)) {
      unknownKeys(plan.limited_by, ACCOUNTS, `${where}.limited_by`, errors);
    }
  }
  if ('fill_order' in plan) {
    if (requireObject(plan.fill_order, `${where}.fill_order`, errors)) {
      unknownKeys(plan.fill_order, ACCOUNTS, `${where}.fill_order`, errors);
    }
  }
  for (const key of [
    'unallocated_krw',
    'monthly_rounding_residual_krw',
    'delta_vs_baseline_krw',
    'credit_eligible_krw',
  ]) {
    if (key in plan) requireInt(plan[key], `${where}.${key}`, errors);
  }
  if ('tie_break' in plan && typeof plan.tie_break !== 'string') {
    errors.push(`${where}.tie_break: 문자열이어야 한다`);
  }
  if ('objective_degenerate' in plan) {
    requireBoolean(plan.objective_degenerate, `${where}.objective_degenerate`, errors);
  }
  if ('is_baseline' in plan && typeof plan.is_baseline !== 'boolean') {
    errors.push(`${where}.is_baseline: 참/거짓이어야 한다`);
  }
  if ('assumption_based_isa_estimate' in plan) {
    validateIsaEstimate(
      plan.assumption_based_isa_estimate,
      `${where}.assumption_based_isa_estimate`,
      errors,
    );
  }
  if ('headline_composite_total' in plan) {
    validateHeadline(plan.headline_composite_total, `${where}.headline_composite_total`, errors);
  }
}

function validateScenario(expectation, where, errors) {
  if (!requireObject(expectation, where, errors)) return;
  unknownKeys(expectation, SCENARIO_KEYS, where, errors);

  if (!isPlainObject(expectation.plans) || Object.keys(expectation.plans).length === 0) {
    errors.push(`${where}.plans: 배분안을 최소 하나 적어야 한다`);
  } else {
    for (const [planId, plan] of Object.entries(expectation.plans)) {
      if (!PLAN_ORDER.includes(planId)) {
        errors.push(`${where}.plans: 모르는 배분안 "${planId}" (허용: ${PLAN_ORDER.join(', ')})`);
        continue;
      }
      validatePlan(plan, `${where}.plans.${planId}`, errors);
    }
  }

  if ('plan_count' in expectation) requireInt(expectation.plan_count, `${where}.plan_count`, errors);
  if ('baseline_plan' in expectation && !PLAN_ORDER.includes(expectation.baseline_plan)) {
    errors.push(`${where}.baseline_plan: 모르는 배분안 "${expectation.baseline_plan}"`);
  }
  if ('isa_eligible' in expectation && typeof expectation.isa_eligible !== 'boolean') {
    errors.push(`${where}.isa_eligible: 참/거짓이어야 한다`);
  }
  for (const key of [
    'isa_reason_codes',
    'notice_codes',
    'notice_codes_absent',
    'comparison_note_codes',
    'comparison_note_codes_absent',
  ]) {
    if (key in expectation) requireStringArray(expectation[key], `${where}.${key}`, errors);
  }
  if ('limits' in expectation && requireNonEmptyObject(expectation.limits, `${where}.limits`, errors)) {
    unknownKeys(expectation.limits, LIMIT_KEYS, `${where}.limits`, errors);
  }
  if (
    'pension_credit_ceiling' in expectation &&
    requireNonEmptyObject(
      expectation.pension_credit_ceiling,
      `${where}.pension_credit_ceiling`,
      errors,
    )
  ) {
    unknownKeys(
      expectation.pension_credit_ceiling,
      CEILING_KEYS,
      `${where}.pension_credit_ceiling`,
      errors,
    );
  }
  if (
    'boundaries' in expectation &&
    requireNonEmptyObject(expectation.boundaries, `${where}.boundaries`, errors)
  ) {
    unknownKeys(expectation.boundaries, BOUNDARY_KEYS, `${where}.boundaries`, errors);
  }
  if ('pension_withdrawal_start' in expectation) {
    validatePensionStart(
      expectation.pension_withdrawal_start,
      `${where}.pension_withdrawal_start`,
      errors,
    );
  }
  if ('legal_basis' in expectation) {
    validateLegalBasis(expectation.legal_basis, `${where}.legal_basis`, errors);
  }
  if ('unapplied_proposed_rules' in expectation) {
    validateUnapplied(
      expectation.unapplied_proposed_rules,
      `${where}.unapplied_proposed_rules`,
      errors,
    );
  }
}

/**
 * 공제율과 **그것을 무엇으로 쟀는가**(D27·D30).
 *
 * 비율만 주장하면 그 비율이 총급여에서 나왔는지 종합소득금액에서 나왔는지가 검사되지
 * 않는다. **25% 과대였던 결함이 정확히 그 축이었고**, 1원 경계 케이스는 그것을 간접적으로만
 * 잡는다. 세 값(`basis`·`measured_amount`·`fallback_applied`)은 서로를 규정하므로
 * 어긋나면 대조 전에 거절한다.
 */
function validateCreditRate(value, where, errors) {
  unknownKeys(value, CREDIT_RATE_KEYS, where, errors);

  for (const key of ['income_tax', 'local_tax', 'effective']) {
    if (key in value && typeof value[key] !== 'number') {
      errors.push(`${where}.${key}: 비율(수)이어야 한다 (받은 값: ${JSON.stringify(value[key])})`);
    }
  }
  if ('basis' in value && !CREDIT_RATE_BASIS_VALUES.includes(value.basis)) {
    errors.push(
      `${where}.basis: 모르는 판정 축 "${value.basis}" (허용: ${CREDIT_RATE_BASIS_VALUES.join(', ')})`,
    );
  }
  if ('measured_amount' in value) requireIntOrNull(value.measured_amount, `${where}.measured_amount`, errors);
  if ('fallback_applied' in value) requireBoolean(value.fallback_applied, `${where}.fallback_applied`, errors);
  if ('fallback_direction' in value) {
    requireStringOrNull(value.fallback_direction, `${where}.fallback_direction`, errors);
  }

  const isDefault = value.basis === 'statutory_default';
  if ('basis' in value && 'fallback_applied' in value && value.fallback_applied !== isDefault) {
    errors.push(
      `${where}: basis("${value.basis}")와 fallback_applied(${value.fallback_applied})가 어긋난다 — ` +
        'fallback_applied는 basis가 statutory_default인 것과 같은 값이다',
    );
  }
  // 재지 않은 금액을 되돌려주지 않는다. 대체 구간을 적용했다면 측정한 금액이 없다.
  if (isDefault && 'measured_amount' in value && value.measured_amount !== null) {
    errors.push(`${where}: basis가 statutory_default인데 measured_amount가 null이 아니다`);
  }
  if ('basis' in value && !isDefault && value.measured_amount === null) {
    errors.push(`${where}: basis가 "${value.basis}"인데 measured_amount가 null이다 — 무엇을 쟀는지가 없다`);
  }
  if ('fallback_direction' in value && (value.fallback_direction !== null) !== isDefault && 'basis' in value) {
    errors.push(
      `${where}: basis("${value.basis}")와 fallback_direction(${JSON.stringify(value.fallback_direction)})이 어긋난다`,
    );
  }
}

export function validateBlock(parsed, where) {
  const errors = [];
  if (!requireObject(parsed, where, errors)) return errors;

  unknownKeys(parsed, CASE_KEYS, where, errors);

  if (typeof parsed.case !== 'string' || !CASE_ID.test(parsed.case)) {
    errors.push(`${where}: "case"가 GC-XX 형태의 케이스 ID여야 한다 (받은 값: ${JSON.stringify(parsed.case)})`);
  }
  if (!isPlainObject(parsed.request)) {
    errors.push(`${where}: "request"가 없다 — compute()에 그대로 넘길 요청이다`);
  }
  if ('credit_rate' in parsed && requireNonEmptyObject(parsed.credit_rate, `${where}.credit_rate`, errors)) {
    validateCreditRate(parsed.credit_rate, `${where}.credit_rate`, errors);
  }

  if (!isPlainObject(parsed.expect) || Object.keys(parsed.expect).length === 0) {
    errors.push(`${where}: "expect"에 시나리오를 최소 하나 적어야 한다`);
  } else {
    for (const [scenarioId, expectation] of Object.entries(parsed.expect)) {
      if (!SCENARIO_ORDER.includes(scenarioId)) {
        errors.push(`${where}.expect: 모르는 시나리오 "${scenarioId}" (허용: ${SCENARIO_ORDER.join(', ')})`);
        continue;
      }
      validateScenario(expectation, `${where}.expect.${scenarioId}`, errors);
    }
  }

  return errors;
}

// ── 어휘 사용량 ──────────────────────────────────────────────────────────────
//
// `qa`가 지적한 "블록이 얼마나 많이 주장하는가"를 기계로 세는 자리다.
// 세는 단위는 **허용 키 하나**다. 응답의 필드 전체가 아니라 어휘를 세는 이유는
// `golden-cases.test.mjs` 검사 4의 주석에 적었다.

/** 허용 키 하나하나에 이름을 붙인 것. 이 목록이 "블록이 주장할 수 있는 것"의 전부다. */
export const VOCABULARY = [
  ...CREDIT_RATE_KEYS.map((k) => `credit_rate.${k}`),
  ...SCENARIO_KEYS.filter((k) => k !== 'plans').map((k) => `scenario.${k}`),
  ...LIMIT_KEYS.map((k) => `limits.${k}`),
  ...BOUNDARY_KEYS.map((k) => `boundaries.${k}`),
  ...CEILING_KEYS.map((k) => `pension_credit_ceiling.${k}`),
  ...PENSION_START_KEYS.map((k) => `pension_withdrawal_start.${k}`),
  ...LEGAL_BASIS_KEYS.map((k) => `legal_basis.${k}`),
  ...UNAPPLIED_KEYS.map((k) => `unapplied_proposed_rules.${k}`),
  ...NON_QUANTIFIED_KEYS.map((k) => `non_quantified_effect.${k}`),
  ...NON_QUANTIFIED_FACT_KEYS.map((k) => `non_quantified_facts.${k}`),
  ...PLAN_KEYS.map((k) => `plan.${k}`),
  ...PLAN_TAX_CAP_KEYS.map((k) => `tax_liability_cap.${k}`),
  ...UNALLOCATED_KEYS.map((k) => `unallocated_breakdown.${k}`),
  ...ISA_ESTIMATE_KEYS.map((k) => `assumption_based_isa_estimate.${k}`),
  ...ISA_AXIS_KEYS.map((k) => `isa_axis_breakdown.${k}`),
  ...ISA_AXIS_CEILING_KEYS.map((k) => `isa_axis_ceilings.${k}`),
  ...HEADLINE_KEYS.map((k) => `headline_composite_total.${k}`),
];

/** 블록 하나가 실제로 주장한 어휘. 값이 아니라 **적혔는가**만 본다. */
export function vocabularyUsedBy(parsed) {
  const used = new Set();
  for (const key of Object.keys(parsed.credit_rate ?? {})) used.add(`credit_rate.${key}`);

  for (const expectation of Object.values(parsed.expect ?? {})) {
    for (const key of Object.keys(expectation)) {
      if (key !== 'plans') used.add(`scenario.${key}`);
    }
    for (const key of Object.keys(expectation.limits ?? {})) used.add(`limits.${key}`);
    for (const key of Object.keys(expectation.boundaries ?? {})) used.add(`boundaries.${key}`);
    for (const key of Object.keys(expectation.pension_credit_ceiling ?? {})) {
      used.add(`pension_credit_ceiling.${key}`);
    }
    for (const entry of Object.values(expectation.pension_withdrawal_start ?? {})) {
      for (const key of Object.keys(entry ?? {})) used.add(`pension_withdrawal_start.${key}`);
    }
    for (const entry of Object.values(expectation.legal_basis ?? {})) {
      for (const key of Object.keys(entry ?? {})) used.add(`legal_basis.${key}`);
    }
    for (const entry of Object.values(expectation.unapplied_proposed_rules ?? {})) {
      for (const key of Object.keys(entry ?? {})) used.add(`unapplied_proposed_rules.${key}`);
    }
    for (const plan of Object.values(expectation.plans ?? {})) {
      for (const key of Object.keys(plan)) used.add(`plan.${key}`);
      for (const key of Object.keys(plan.tax_liability_cap ?? {})) {
        used.add(`tax_liability_cap.${key}`);
      }
      for (const key of Object.keys(plan.unallocated_breakdown ?? {})) {
        used.add(`unallocated_breakdown.${key}`);
      }
      for (const byAccount of Object.values(plan.non_quantified_effects ?? {})) {
        for (const entry of Object.values(byAccount ?? {})) {
          for (const key of Object.keys(entry ?? {})) used.add(`non_quantified_effect.${key}`);
          for (const key of Object.keys(entry?.facts ?? {})) used.add(`non_quantified_facts.${key}`);
        }
      }
      for (const key of Object.keys(plan.assumption_based_isa_estimate ?? {})) {
        used.add(`assumption_based_isa_estimate.${key}`);
      }
      for (const key of Object.keys(plan.assumption_based_isa_estimate?.axis_breakdown ?? {})) {
        used.add(`isa_axis_breakdown.${key}`);
      }
      for (const key of Object.keys(plan.assumption_based_isa_estimate?.axis_ceilings ?? {})) {
        used.add(`isa_axis_ceilings.${key}`);
      }
      for (const key of Object.keys(plan.headline_composite_total ?? {})) {
        used.add(`headline_composite_total.${key}`);
      }
    }
  }
  return used;
}

// ── 요청 조립 ────────────────────────────────────────────────────────────────

/**
 * 골든 블록에 없는 새 필수 입력을 채운다.
 *
 * **세액 한도를 채우던 자리가 여기서 사라졌다**(D39·D40). 계약 `9.0.0` 이전에는 블록에
 * 없는 `profile.prior_year_tax`를 실행기가 "한도가 자르지 않는 값"으로 채웠고, 그 채움이
 * 곧 골든 케이스의 암묵적 전제였다. 이제 한도는 입력이 아니라 **총급여액에서 계산되는
 * 값**이므로 채울 것이 없다 — 블록이 이미 싣고 있는 `current_year_total_salary_krw`가
 * 한도를 정한다. 전제를 실행기가 세우지 않게 된 것이 이 변경의 부수 효과다.
 *
 * 생년월일은 그대로다. 블록은 `age_years`로 나이를 적었고 계약은 생년월일을 받는다.
 * 나이를 생년월일로 되옮기는 것은 이 실행기가 하며, 기준일은 엔진이 정한다.
 */
export function fillContractDefaults(raw, taxYear) {
  const profile = { ...raw.profile };
  const accounts = { ...raw.accounts };
  const options = { ...raw.options };

  if (profile.birth_date === undefined && typeof profile.age_years === 'number') {
    profile.birth_date = `${taxYear - profile.age_years}-03-02`;
  }
  delete profile.age_years;

  // 계약 5.0.0이 공제율 판정 축을 두 물음으로 나눴다(D27). 47건은 **근로소득만 있는**
  // 사용자를 전제로 산출됐고 — 1차 출시 대상이 근로소득자다(게이트 1 D2) — 그 전제에서
  // 판정 축은 총급여액 그대로다. 그래서 기대값이 한 원도 움직이지 않는다.
  // **종합소득이 있는 분기의 정답지는 아직 없다.** 그 케이스는 `tax-domain`이 산출한다.
  if (profile.has_non_wage_global_income_current_year === undefined) {
    profile.has_non_wage_global_income_current_year = false;
  }

  // 계약 5.0.0이 배분안을 넷으로 늘렸다(D26). 47건은 **세 안 체제**에서 산출됐고,
  // 네 번째 안은 `plan_count`를 바꾼다. 블록이 스스로 요청하지 않는 한 실행기는 기존
  // 세 안만 요청한다 — **기대값을 구현에 맞춰 고치지 않기 위한 조치다.**
  //
  // 이 조치가 감추지 않는 것과 감추는 것을 분명히 적는다.
  //   감추지 않는다 — 세 안의 배분·공제액은 네 번째 안이 있든 없든 같다(각 안은 독립으로
  //   충당하고 기본안 선택도 바뀌지 않는다). 47건이 지금까지 주장해 온 것은 그대로 검사된다.
  //   감춘다 — 네 번째 안의 배분·공제액·`plan_count` 변화는 이 실행기가 보지 않는다.
  //   그 축의 정답지는 `tax-domain`이 산출하고, 블록이 `options.plan_variants`에
  //   그 안의 id를 실으면 이 기본값은 덮어써진다.
  //
  // **D32가 이 조치의 범위를 좁혔다.** 소유자가 기본안의 충당 순서를 바꿨으므로 세 안의
  // 배분도 함께 움직인다 — 위의 "감추지 않는다"가 더는 참이 아니다. 네 번째 안을 빼는
  // 것은 `plan_count`만 지킬 뿐이고, **47건의 배분·공제액 기대값은 `tax-domain`이 다시
  // 산출해야 한다.** 실행기가 그 사실을 감추지 않도록 여기 적어 둔다.
  if (options.plan_variants === undefined || options.plan_variants === null) {
    options.plan_variants = PLAN_ORDER.filter((id) => id !== PLAN.PENSION_BEFORE_ISA);
  }

  for (const key of ['annuity_savings', 'retirement_pension']) {
    if (accounts[key] === undefined) continue;
    accounts[key] = {
      annuity_start_status: 'not_started',
      ...accounts[key],
    };
  }

  return { ...raw, profile, accounts, options };
}

/** 블록의 `request`를 compute()에 넘길 요청으로 만든다. */
export function buildRequest(parsed) {
  const taxYear = parsed.request.tax_year ?? 2026;
  return {
    schema_version: SCHEMA_VERSION,
    tax_year: taxYear,
    ...fillContractDefaults(parsed.request, taxYear),
  };
}

// ── 대조 ─────────────────────────────────────────────────────────────────────
//
// 실패 메시지에는 **케이스 ID · 시나리오 · 배분안 · 항목**이 전부 나와야 한다.
// 라벨을 위에서 아래로 이어 붙여 그것을 보장한다.

function planOf(scenario, planId, label) {
  const plan = scenario.plans.find((p) => p.plan_id === planId);
  assert.ok(plan, `${label}: 배분안 "${planId}"이 응답에 없다 (있는 것: ${scenario.plans.map((p) => p.plan_id).join(', ')})`);
  return plan;
}

function allocationOf(plan, account) {
  return plan.allocations.find((a) => a.account === account);
}

function limitValue(scenario, key) {
  const byAccount = (account) => scenario.limits.by_account.find((l) => l.account === account);
  switch (key) {
    case 'annuity_savings_credit_remaining_krw':
      return byAccount('annuity_savings').credit_eligible_limit_remaining_krw;
    case 'isa_contribution_remaining_krw':
      return byAccount('isa').contribution_limit_remaining_krw;
    case 'isa_tax_free_limit_krw':
      return byAccount('isa').tax_free_limit_krw;
    case 'isa_transfer_extra_credit_limit_krw':
      return scenario.isa_transfer_extra_limit === null
        ? null
        : scenario.isa_transfer_extra_limit.extra_credit_limit_krw;
    default:
      return scenario.limits[key];
  }
}

/**
 * 배분안 단위 세액 한도. **적힌 키는 하나도 건너뛰지 않는다.**
 *
 * 근거 목록 둘만 자가 다르다 — **포함 / 불포함**이다(D55 후속). 나머지는 값 비교다.
 */
function checkPlanTaxCap(plan, expected, label) {
  const actual = plan.deterministic_benefit.tax_liability_cap;
  const basis = Array.isArray(actual.basis_rule_ids) ? actual.basis_rule_ids : [];

  for (const [key, value] of Object.entries(expected)) {
    if (key === 'basis_rule_ids') {
      const missing = value.filter((id) => !basis.includes(id)).sort();
      assert.deepStrictEqual(
        missing,
        [],
        `${label} 세액 한도 근거에 실려야 할 규칙이 없다 (있는 것: ${basis.join(', ')})`,
      );
      continue;
    }
    if (key === 'basis_rule_ids_absent') {
      const found = value.filter((id) => basis.includes(id)).sort();
      assert.deepStrictEqual(
        found,
        [],
        `${label} 세액 한도 근거에서 빠져야 할 규칙이 실렸다 (있는 것: ${basis.join(', ')})`,
      );
      continue;
    }
    assert.equal(actual[key], value, `${label} 세액 한도(${key})`);
  }
}

function checkPlan(plan, expected, label) {
  for (const account of ACCOUNTS) {
    assert.equal(
      allocationOf(plan, account).annual_krw,
      expected.allocation[account],
      `${label} 배분(${account})`,
    );
  }
  if (expected.monthly_krw) {
    for (const [account, amount] of Object.entries(expected.monthly_krw)) {
      assert.equal(allocationOf(plan, account).monthly_krw, amount, `${label} 월 배분(${account})`);
    }
  }

  const benefit = plan.deterministic_benefit;
  assert.deepStrictEqual(
    {
      income_tax: benefit.pension_credit_income_tax_krw,
      local_tax: benefit.pension_credit_local_tax_krw,
      total: benefit.pension_credit_total_krw,
    },
    expected.tax_credit,
    `${label} 세액공제(한도 적용 후)`,
  );
  if (expected.tax_credit_before_cap) {
    assert.deepStrictEqual(
      {
        income_tax: benefit.pension_credit_income_tax_before_cap_krw,
        local_tax: benefit.pension_credit_local_tax_before_cap_krw,
        total: benefit.pension_credit_total_before_cap_krw,
      },
      expected.tax_credit_before_cap,
      `${label} 세액공제(자르기 전)`,
    );
  }
  if (expected.tax_liability_cap) {
    checkPlanTaxCap(plan, expected.tax_liability_cap, label);
  }

  assert.equal(plan.warnings.length, expected.warning_count, `${label} 경고 건수`);
  if (expected.warning_codes) {
    assert.deepStrictEqual(
      [...new Set(plan.warnings.map((w) => w.code))].sort(),
      [...expected.warning_codes].sort(),
      `${label} 경고 코드`,
    );
  }
  if (expected.limited_by) {
    for (const [account, value] of Object.entries(expected.limited_by)) {
      assert.equal(allocationOf(plan, account).limited_by, value, `${label} limited_by(${account})`);
    }
  }
  if (expected.fill_order) {
    for (const [account, value] of Object.entries(expected.fill_order)) {
      assert.equal(allocationOf(plan, account).fill_order, value, `${label} 충당 순서(${account})`);
    }
  }
  if ('unallocated_krw' in expected) {
    assert.equal(plan.unallocated_annual_krw, expected.unallocated_krw, `${label} 미배분`);
  }
  for (const [key, value] of Object.entries(expected.unallocated_breakdown ?? {})) {
    assert.equal(plan.unallocated_breakdown[key], value, `${label} 미배분 갈래(${key})`);
  }
  if ('credit_remaining_after_plan_krw' in expected) {
    assert.equal(
      plan.pension_combined_credit_remaining_after_plan_krw,
      expected.credit_remaining_after_plan_krw,
      `${label} 배분 후 잔여 공제 한도`,
    );
  }
  if (expected.non_quantified_codes) {
    assert.deepStrictEqual(
      [...new Set(plan.non_quantified_effects.map((e) => e.code))].sort(),
      [...expected.non_quantified_codes].sort(),
      `${label} 비정량 효과 코드`,
    );
  }
  if (expected.non_quantified_effects) {
    checkNonQuantified(plan, expected.non_quantified_effects, label);
  }
  if ('monthly_rounding_residual_krw' in expected) {
    assert.equal(
      plan.monthly_rounding_residual_krw,
      expected.monthly_rounding_residual_krw,
      `${label} 월 반올림 잔차`,
    );
  }
  if ('delta_vs_baseline_krw' in expected) {
    assert.equal(plan.delta_vs_baseline_krw, expected.delta_vs_baseline_krw, `${label} 기본안 대비 차이`);
  }
  if ('credit_eligible_krw' in expected) {
    assert.equal(benefit.credit_eligible_contribution_krw, expected.credit_eligible_krw, `${label} 인정액`);
  }
  if ('tie_break' in expected) {
    assert.equal(plan.priority_basis.tie_break.code, expected.tie_break, `${label} 동점 처리`);
  }
  if ('objective_degenerate' in expected) {
    assert.equal(
      plan.priority_basis.objective_degenerate,
      expected.objective_degenerate,
      `${label} 목적함수 무력화 여부`,
    );
  }
  if ('is_baseline' in expected) {
    assert.equal(plan.is_baseline, expected.is_baseline, `${label} 기본안 여부`);
  }
  if (expected.assumption_based_isa_estimate) {
    checkIsaEstimate(plan, expected.assumption_based_isa_estimate, label);
  }
  if (expected.headline_composite_total) {
    checkHeadline(plan, expected.headline_composite_total, label);
  }
}

/**
 * 비정량 효과와 그 사실들. **적힌 키는 하나도 건너뛰지 않는다.**
 *
 * 이것이 계약 5.6절의 「셋 중 하나라도 빠지면 화면 문장이 거짓이 된다」를 정답지가 무는
 * 자리다. 응답에서 사실 하나가 사라지거나 값이 뒤집히면 여기서 **그 사실의 이름과 함께**
 * 실패한다 — 라벨에 케이스·시나리오·배분안이 이미 실려 있고, 여기서 코드·계좌·항목이 붙는다.
 */
function checkNonQuantified(plan, expected, label) {
  for (const [code, byAccount] of Object.entries(expected)) {
    for (const [account, entry] of Object.entries(byAccount)) {
      const actual = plan.non_quantified_effects.find(
        (effect) => effect.code === code && effect.account === account,
      );
      const seen = plan.non_quantified_effects.map((e) => `${e.code}/${e.account}`).join(', ');

      if ('present' in entry) {
        assert.equal(
          actual !== undefined,
          entry.present,
          `${label} 비정량 효과 실림 여부(${code}/${account}) (나온 것: ${seen || '없음'})`,
        );
        if (entry.present === false) continue;
      }
      assert.ok(actual, `${label} 비정량 효과에 "${code}/${account}"가 없다 (있는 것: ${seen || '없음'})`);

      if ('reason_code' in entry) {
        assert.equal(actual.reason_code, entry.reason_code, `${label} 비정량 효과 사유(${code}/${account})`);
      }
      if (entry.facts === null) {
        assert.equal(actual.facts, null, `${label} 비정량 효과 사실(${code}/${account})이 null이 아니다`);
        continue;
      }
      for (const [key, value] of Object.entries(entry.facts ?? {})) {
        assert.equal(
          actual.facts?.[key],
          value,
          `${label} 비정량 효과 사실(${code}/${account}.${key})` +
            (actual.facts === null ? ' — 응답의 facts가 null이다' : ''),
        );
      }
    }
  }
}

/** 가정 기반 ISA 정산액. **적힌 키는 하나도 건너뛰지 않는다.** */
function checkIsaEstimate(plan, expected, label) {
  const actual = plan.assumption_based_isa_estimate;
  assert.ok(
    actual,
    `${label} 가정 기반 ISA 정산액: 응답이 null이다 — request.profile.isa_return_assumption을 실었는지 본다`,
  );

  for (const [key, value] of Object.entries(expected)) {
    if (key === 'axis_breakdown' || key === 'axis_ceilings') continue;
    assert.equal(actual[key], value, `${label} 가정 기반 ISA 정산액(${key})`);
  }
  for (const [key, value] of Object.entries(expected.axis_breakdown ?? {})) {
    assert.equal(actual.axis_breakdown?.[key], value, `${label} ISA 정산액 축(${key})`);
  }
  for (const [key, value] of Object.entries(expected.axis_ceilings ?? {})) {
    assert.equal(actual.axis_ceilings?.[key], value, `${label} ISA 축의 상한(${key})`);
  }
}

/** 헤드라인 합계. **적힌 키는 하나도 건너뛰지 않는다.** */
function checkHeadline(plan, expected, label) {
  const actual = plan.headline_composite_total;
  assert.ok(actual, `${label} 헤드라인 합계: 응답이 null이다`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key], value, `${label} 헤드라인 합계(${key})`);
  }
}

/** 연금계좌별 개시 가능 시점. **적힌 키는 하나도 건너뛰지 않는다.** */
function checkPensionStart(scenario, expected, label) {
  for (const [account, entry] of Object.entries(expected)) {
    const actual = scenario.pension_withdrawal_start.find((e) => e.account === account);
    assert.ok(
      actual,
      `${label} 개시 가능 시점: 계좌 "${account}"가 응답에 없다 (있는 것: ${scenario.pension_withdrawal_start.map((e) => e.account).join(', ')})`,
    );
    for (const [key, value] of Object.entries(entry)) {
      assert.equal(actual[key], value, `${label} 개시 가능 시점(${account}.${key})`);
    }
  }
}

/**
 * 규칙별 근거와 미확인 건수(D30). **적힌 키는 하나도 건너뛰지 않는다.**
 *
 * 이것이 계약 5.7.1절이 첫 번째 방어선으로 지목한 자리다 — 룰셋에서 표시가 조용히
 * 사라지면 여기서 건수가 어긋나 대조가 문다.
 */
function checkLegalBasis(scenario, expected, label) {
  for (const [ruleId, entry] of Object.entries(expected)) {
    const actual = scenario.legal_basis.find((item) => item.rule_id === ruleId);

    if ('present' in entry) {
      assert.equal(actual !== undefined, entry.present, `${label} 근거 실림 여부(${ruleId})`);
      if (entry.present === false) continue;
    }
    assert.ok(
      actual,
      `${label} 근거에 규칙 "${ruleId}"이 없다 (있는 것: ${scenario.legal_basis.map((i) => i.rule_id).join(', ')})`,
    );

    for (const key of ['status', 'bill_stage', 'has_uncertainty_note']) {
      if (key in entry) assert.equal(actual[key], entry[key], `${label} 근거(${ruleId}.${key})`);
    }
    if ('uncertainty_note_count' in entry) {
      assert.equal(
        actual.uncertainty_notes.length,
        entry.uncertainty_note_count,
        `${label} 근거(${ruleId}) 미확인 건수 — 남은 것: ${JSON.stringify(actual.uncertainty_notes)}`,
      );
    }
    if (entry.uncertainty_kinds) {
      assert.deepStrictEqual(
        [...new Set(actual.uncertainty_notes.map((note) => note.kind))].sort(),
        [...entry.uncertainty_kinds].sort(),
        `${label} 근거(${ruleId}) 미확인 표시의 종류`,
      );
    }
    if (entry.uncertainty_paths) {
      assert.deepStrictEqual(
        actual.uncertainty_notes.map((note) => note.path),
        [...entry.uncertainty_paths],
        `${label} 근거(${ruleId}) 미확인 표시의 위치`,
      );
    }
    if (entry.applied_to) {
      assert.deepStrictEqual(
        actual.applied_to,
        [...entry.applied_to].sort(),
        `${label} 근거(${ruleId})가 쓰인 출력 경로`,
      );
    }
  }
}

function checkScenario(scenario, expected, label) {
  if ('plan_count' in expected) {
    assert.equal(
      scenario.plans.length,
      expected.plan_count,
      `${label} 배분안 수 (나온 것: ${scenario.plans.map((p) => p.plan_id).join(', ')})`,
    );
  }
  if ('baseline_plan' in expected) {
    assert.equal(scenario.plans.find((p) => p.is_baseline).plan_id, expected.baseline_plan, `${label} 기본안`);
  }

  const isa = scenario.account_eligibility.find((e) => e.account === 'isa');
  if ('isa_eligible' in expected) assert.equal(isa.eligible, expected.isa_eligible, `${label} ISA 자격`);
  if (expected.isa_reason_codes) {
    assert.deepStrictEqual([...isa.reason_codes].sort(), [...expected.isa_reason_codes].sort(), `${label} ISA 자격 사유`);
  }

  for (const [key, value] of Object.entries(expected.limits ?? {})) {
    assert.equal(limitValue(scenario, key), value, `${label} 한도(${key})`);
  }
  for (const [key, value] of Object.entries(expected.boundaries ?? {})) {
    assert.equal(scenario.fund_use_horizon_boundaries[key], value, `${label} 경계값(${key})`);
  }
  for (const [key, value] of Object.entries(expected.pension_credit_ceiling ?? {})) {
    assert.equal(scenario.pension_credit_ceiling[key], value, `${label} 확정 축 최댓값(${key})`);
  }
  if (expected.pension_withdrawal_start) {
    checkPensionStart(scenario, expected.pension_withdrawal_start, label);
  }
  if (expected.legal_basis) {
    checkLegalBasis(scenario, expected.legal_basis, label);
  }
  for (const [ruleId, entry] of Object.entries(expected.unapplied_proposed_rules ?? {})) {
    const actual = scenario.unapplied_proposed_rules.find((item) => item.rule_id === ruleId);
    if ('present' in entry) {
      assert.equal(
        actual !== undefined,
        entry.present,
        `${label} 미반영 규칙 실림 여부(${ruleId}) (나온 것: ${scenario.unapplied_proposed_rules.map((i) => i.rule_id).join(', ')})`,
      );
      if (entry.present === false) continue;
    }
    assert.ok(actual, `${label} 미반영 규칙에 "${ruleId}"이 없다`);
    if ('reason_code' in entry) {
      assert.equal(actual.reason_code, entry.reason_code, `${label} 미반영 사유(${ruleId})`);
    }
  }

  const notices = scenario.notices.map((n) => n.code);
  for (const code of expected.notice_codes ?? []) {
    assert.ok(notices.includes(code), `${label} 안내 "${code}"가 나와야 한다 (나온 것: ${notices.join(', ')})`);
  }
  for (const code of expected.notice_codes_absent ?? []) {
    assert.equal(notices.includes(code), false, `${label} 안내 "${code}"는 나오면 안 된다`);
  }
  for (const code of expected.comparison_note_codes ?? []) {
    assert.ok(
      scenario.comparison_note_codes.includes(code),
      `${label} 비교 안내 "${code}"가 나와야 한다 (나온 것: ${scenario.comparison_note_codes.join(', ')})`,
    );
  }
  for (const code of expected.comparison_note_codes_absent ?? []) {
    assert.equal(
      scenario.comparison_note_codes.includes(code),
      false,
      `${label} 비교 안내 "${code}"는 나오면 안 된다`,
    );
  }

  for (const [planId, plan] of Object.entries(expected.plans)) {
    checkPlan(planOf(scenario, planId, label), plan, `${label} [${planId}]`);
  }
}

/** 블록 하나를 응답과 대조한다. 실패하면 AssertionError를 던진다. */
export function checkCase(parsed, response) {
  const caseId = parsed.case;
  assert.ok(response.ok, `${caseId}: 계산이 실패했다 — ${JSON.stringify(response.errors)}`);

  if (parsed.credit_rate) {
    const bracket = response.echo.credit_rate_bracket;
    for (const [key, value] of Object.entries(parsed.credit_rate)) {
      assert.equal(bracket[CREDIT_RATE_FIELD[key]], value, `${caseId} 공제율(${key})`);
    }
  }

  for (const [scenarioId, expectation] of Object.entries(parsed.expect)) {
    const scenario = response.scenarios.find((s) => s.scenario_id === scenarioId);
    assert.ok(
      scenario,
      `${caseId}: 시나리오 "${scenarioId}"가 응답에 없다 — request.scenarios에 넣었는지 본다`,
    );
    checkScenario(scenario, expectation, `${caseId}/${scenarioId}`);
  }
}
