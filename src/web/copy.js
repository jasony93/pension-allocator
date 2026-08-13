/**
 * 문구 사전. `engine-interface.md` 7절: "엔진은 사용자에게 보이는 문장을 만들지
 * 않는다. `web-dev`는 code를 키로 하는 문구 사전을 화면 쪽에 두고 params로
 * 채운다." — 이 파일이 그 사전이다.
 *
 * 헌장의 세무사법 문구 정책(쓸 수 없는/조건부/쓸 수 있는 어휘)과
 * `screens.md`·`design-system.md` 7절의 문구 규약을 여기서 지킨다. 세법 수치는
 * 어디에도 하드코딩하지 않는다 — 금액·연수가 필요한 문구는 전부 `params`에서
 * 채운다(엔진의 `fund_use_horizon_boundaries`, `legal_basis`, 각 필드의 실제 값).
 */

import { formatKrw, formatKrwAbbreviated, formatPercent, formatPercentTrimmed, formatYears } from './format.js';

export const SERVICE_NAME = '[가칭] 납입배분 계산기';

// ---------------------------------------------------------------------------
// 계좌 이름 · 배분안 이름
// ---------------------------------------------------------------------------

export const ACCOUNT_LABEL = {
  annuity_savings: '연금저축',
  retirement_pension: 'IRP',
  isa: 'ISA',
};

/**
 * 계좌 이름에 붙는 조사. 이름에서 받침을 계산하지 않고 계좌 id마다 표로 둔다 —
 * `IRP`·`ISA`는 로마자 표기라 글자만 보고는 받침을 알 수 없고(읽기로는 각각
 * "아이알피"·"아이에스에이"로 끝나 받침이 없다), 이름이 바뀌면 표만 고치면 된다.
 * 실측에서 `연금저축로 갑니다`가 화면에 그대로 떠 있었다.
 */
const ACCOUNT_PARTICLE = {
  annuity_savings: { topic: '은', object: '을', subject: '이', direction: '으로', and: '과' },
  retirement_pension: { topic: '는', object: '를', subject: '가', direction: '로', and: '와' },
  isa: { topic: '는', object: '를', subject: '가', direction: '로', and: '와' },
};

/** `연금저축` + `object` → `연금저축을`. 모르는 계좌면 이름만 낸다. */
export function accountWithParticle(account, kind) {
  const name = ACCOUNT_LABEL[account] ?? account;
  const particle = ACCOUNT_PARTICLE[account]?.[kind];
  return particle ? `${name}${particle}` : name;
}

/** 도넛·범례·표에서 미배분 조각을 부르는 이름. 계좌가 아니므로 `ACCOUNT_LABEL`에 넣지 않는다. */
export const UNALLOCATED_LABEL = '미배분';

export const PLAN_LABEL = {
  max_tax_credit: '세액공제액이 가장 큰 배분',
  annuity_savings_first: '연금저축을 먼저 채우는 배분',
  isa_first: 'ISA를 먼저 채우는 배분',
  // D26 — 이름이 "추천"으로 읽히지 않게 한다. 세법이 유불리를 정하지 않으므로
  // 이 배분안은 다른 셋과 같은 자리에서 선택지로만 낸다.
  //
  // **D32에서 개명됐다**(옛 id `pension_contribution_limit_fill`, 계약 0.11절).
  // 「납입 한도까지 채운다」는 이제 네 안 전부가 하므로 더 이상 이 안을
  // 가르는 사실이 아니다 — 남은 차이는 ISA와의 **선후**뿐이라, 라벨도 그
  // 사실만 말한다.
  pension_contribution_before_isa: '연금계좌를 ISA보다 먼저 채우는 배분',
};

export const FUND_USE_HORIZON_LABEL = {
  within_isa_lock_in: '비교적 이른 시기에 쓸 수도 있다',
  before_pension_age: '중간에 쓸 계획이다',
  at_or_after_pension_age: '연금 수령 나이까지 둘 수 있다',
  unknown: '아직 모르겠다',
};

/**
 * 지평 선택지의 **라벨 자체**에 범위를 명시한다(소유자 3번 · D52 3번).
 *
 * **아래 끝(ISA 의무가입기간)은 고정이지만 하드코딩하지 않는다** — 룰셋에서
 * 나온 `fund_use_horizon_boundaries.isa_lock_in_years`를 읽는다. 두 계좌
 * 선택지가 같은 경계(그 기간이 끝나는 시점)를 공유하므로 같은 값을 쓴다.
 *
 * **위 끝(연금 수령 개시 나이까지 남은 해)은 사람마다 다르다** — 쉰 살이면
 * 5년 뒤다. `pension_years_remaining`이 그 값이고, **모두에게 같은 수를
 * 적으면 그 사람에게 거짓이 된다**(D52 3번). 그래서 값이 없으면(생년월일을
 * 아직 넣지 않았으면) 숫자를 지어내지 않고 일반적인 말로만 적는다 —
 * `boundariesInfo`가 `null`이면 `FUND_USE_HORIZON_LABEL`의 원래 문구로
 * 떨어진다.
 */
export function fundUseHorizonLabel(value, boundariesInfo) {
  if (value === 'within_isa_lock_in') {
    return boundariesInfo?.isa_lock_in_years != null
      ? `${formatYears(boundariesInfo.isa_lock_in_years)} 안에 쓸 수도 있다`
      : FUND_USE_HORIZON_LABEL.within_isa_lock_in;
  }
  if (value === 'before_pension_age') {
    return boundariesInfo?.isa_lock_in_years != null && boundariesInfo?.pension_years_remaining != null
      ? `${formatYears(boundariesInfo.isa_lock_in_years)} 후 ~ ${formatYears(boundariesInfo.pension_years_remaining)} 이내 쓸 계획이다`
      : FUND_USE_HORIZON_LABEL.before_pension_age;
  }
  return FUND_USE_HORIZON_LABEL[value] ?? value;
}

export const FUND_USE_HORIZON_DESCRIPTION = {
  // 12.2(c) — 같은 사실을 더 짧게.
  within_isa_lock_in: 'ISA 의무가입기간 안에 해지할 수도 있다',
  before_pension_age: '연금 수령 개시 나이 전에 쓸 생각이다',
  at_or_after_pension_age: '',
  unknown: '중도 인출 규칙 판정 없이 참고만 보여줍니다',
};

// ---------------------------------------------------------------------------
// 오류 코드 (8.1)
// ---------------------------------------------------------------------------

const ERROR_MESSAGE = {
  schema_version_mismatch: () => '계산 엔진 버전이 맞지 않습니다. 새로고침 후 다시 시도해 주세요.',
  missing_required: () => '값이 필요합니다.',
  not_integer: () => '정수 값이 필요합니다.',
  negative_value: () => '0 이상의 값이 필요합니다.',
  out_of_range: () => '허용 범위를 벗어난 값입니다.',
  invalid_enum: () => '유효하지 않은 선택지입니다.',
  // 오류 params에 입력값을 되풀이하지 않는다(D21이 유지한 여섯 못 중 하나) —
  // 계약도 `invalid_date`의 params에 입력값을 싣지 않는다(8.1절).
  invalid_date: () => '달력에 없는 날짜입니다. 월과 일을 확인해 주세요.',
  isa_transfer_exceeds_cumulative: () => 'ISA 만기 전환 금액이 ISA 누적 납입액을 초과합니다.',
  isa_ytd_exceeds_cumulative: () => 'ISA 당해연도 납입액이 누적 납입액을 초과합니다.',
  empty_scenarios: () => '계산할 시나리오가 없습니다.',
  unknown_scenario: () => '알 수 없는 시나리오입니다.',
  unknown_plan_variant: () => '알 수 없는 배분안입니다.',
  ruleset_load_failed: () => '계산에 필요한 세법 규칙을 불러오지 못했습니다.',
  rule_missing: (params) => `계산에 필요한 규칙(${params.rule_id})을 찾을 수 없습니다.`,
};

export function errorMessage(error) {
  const fn = ERROR_MESSAGE[error.code];
  return fn ? fn(error.params ?? {}) : '입력값을 확인해 주세요.';
}

// ---------------------------------------------------------------------------
// 안내 코드 (8.2) — Notice
// ---------------------------------------------------------------------------

const NOTICE_MESSAGE = {
  zero_capacity: () => '월 납입 여력이 0원으로 입력되어 배분할 금액이 없습니다.',
  budget_exceeds_all_limits: () =>
    '입력한 월 납입 여력이 이번 계산에서 배분할 수 있는 금액보다 많습니다. 남는 금액은 어느 계좌에도 배분되지 않았습니다.',
  existing_contribution_over_limit: () =>
    '이미 입력한 기납입액이 관련 한도를 넘어, 그 항목의 남은 금액을 0으로 계산했습니다.',
  prior_year_income_missing: () => '직전 과세기간 총급여액을 받지 않아 ISA 비과세 한도 구간의 교차확인을 하지 않았습니다.',
  isa_type_conflicts_with_prior_income: () => '입력한 ISA 계좌 유형이 직전 과세기간 소득 기준 판정과 다릅니다. 계산은 입력한 유형을 그대로 따랐습니다.',
  // 4단계 게이트4 재소집(11.2절) 결함 — 등록만 되고 문구가 없어 코드 문자열이
  // 그대로 뜨던 자리. `isa_type_conflicts_with_prior_income`의 반대 방향이다 —
  // 이쪽은 결론 자체를 내지 못했다는 사실 통지이고, 선언이 틀렸다는 뜻이 아니다
  // (`engine-interface.md` 5.9절·8.2절, `limits.mjs:987`의 `crossCheckIsaType`).
  isa_type_cross_check_inconclusive: () =>
    '입력한 직전 과세기간 총급여액만으로는 ISA 서민형 요건을 확인할 수 있는 조문 항목이 모두 확인되지 않아, 계좌 유형 교차확인을 하지 않았습니다. 계산은 입력한 유형을 그대로 따랐습니다.',
  isa_type_not_declared: () => 'ISA 계좌 유형을 입력하지 않아 비과세 한도 표시를 생략했습니다.',
  // [게이트 6 D46] 이 코드는 `isa.contribution.annual_limit`(연간 납입 한도의
  // 미납분 이월 산식) 근거로만 사용자에게 노출된다 — 의무가입기간이 아니다.
  // 예전 문구가 근거 규칙과 다른 사실(락업)을 말하고 있었다.
  isa_tenure_missing: () => 'ISA 가입 후 경과연수를 받지 않아 연간 납입 한도의 이월분을 0년 기준으로 계산했습니다.',
  // 계약 3.1.0에서 들어온 코드인데 사전에 빠져 있었다 — 그대로 두면 화면에
  // 코드 문자열이 그대로 뜬다. **경고가 아니라 사실 통지다**(계약 0.2절):
  // 법적 불이익이 아니라 입력과 현실이 어긋난다는 정보다.
  isa_lock_in_already_elapsed: () =>
    'ISA 의무가입기간이 이미 지난 것으로 계산됐습니다. 그 기간 안에 쓸 수 있다고 고르셨지만 중도해지 추징 규칙은 걸리지 않습니다.',
  financial_income_status_unknown: () => '금융소득종합과세 대상 여부를 받지 않아 ISA 배제 규칙을 적용하지 않았습니다.',
  isa_excluded_financial_income_taxpayer: () => '금융소득종합과세 대상자에 해당해 ISA를 배분 대상에서 제외했습니다.',
  isa_excluded_age: () => 'ISA 가입에 필요한 연령 요건에 해당하지 않아 ISA를 배분 대상에서 제외했습니다.',
  pension_age_not_evaluated: () => '연금계좌의 최소 가입 연령 요건은 판정 대상 규칙이 없어 확인하지 않았습니다.',
  youth_status_not_declared: () => '청년 우대 대상 여부를 받지 않아 개정안 시나리오의 청년 우대를 적용하지 않았습니다.',
  youth_age_range_undetermined: () => '청년 우대 연령 범위가 시행령 미공개로 확정되지 않았습니다.',
  proposed_transfer_cap_period_input_missing: () => '개정안의 넓어진 차감 기간에 해당하는 금액을 받지 않아 직전 1개 과세기간 값으로 대신했습니다.',
  proposed_not_enacted: () => '이 시나리오는 아직 국회를 통과하지 않은 개정안을 반영한 계산입니다.',
  plans_collapsed_single: () => '입력한 조건에서는 비교할 다른 배분이 나오지 않았습니다.',
  fund_use_horizon_not_declared: () => '자금 사용 시점을 밝히지 않아 중도 인출 관련 규칙이 걸리는지 판정하지 않았습니다.',
  pension_holding_period_not_evaluated: () => '연금계좌 가입 경과연수를 받지 않아 보유기간 요건은 판정하지 않았습니다.',

  // -- 9.0.0(D39·D40·D41)으로 들어온 안내 코드 -------------------------------
  // 문구에 세법 수치가 없다. 금액이 필요한 자리는 전부 엔진이 준 `params`나
  // 응답 필드에서 채우고, 이 사전은 문장만 갖는다.
  //
  // **`tax_liability_cap_unknown`이 여기 있었다**(D39로 폐기). 직전 과세연도
  // 결정세액을 묻지 않으므로 「모름」이라는 상태가 없다 — 세액 한도가
  // **언제나** 계산된다. 아래가 그 자리를 대신한다.
  //
  // **언제나 나간다.** 이 한도가 총급여액에서 계산한 상한이고 다른 소득공제·
  // 세액공제를 반영하지 않았다는 사실이 금액과 같은 화면에 있어야 한다
  // (계약 8.7절 `required_display`).
  tax_liability_cap_estimated_from_total_salary: () =>
    '이 세액 한도는 총급여액에서 계산한 상한입니다. 다른 소득공제·세액공제를 반영하면 실제 한도는 이보다 적을 수 있습니다.',
  // D41 — 종합소득이 있는데 금액을 모르면 오차 방향조차 정해지지 않는다.
  // 「최대」도 「적어도」도 쓸 수 없다 — 그래서 이 문장은 방향을 주장하지 않는다.
  tax_liability_cap_direction_indeterminate: () =>
    '종합소득금액을 받지 않아, 이 한도가 실제보다 큰지 작은지도 확인하지 못했습니다.',
  // **오류가 아니라 결과다** — `is_exact`가 참이면 상한이 곧 등식이므로 이
  // 사용자에게는 0이 정확한 답이다. 오류·경고 색을 쓰지 않는다(계약 8.2절).
  tax_liability_cap_zero: (params) =>
    params.is_exact
      ? '계산한 총급여액 기준으로 이번 과세연도의 연금계좌 세액공제는 정확히 0원입니다.'
      : '계산한 총급여액 기준으로는 이번 과세연도의 연금계좌 세액공제가 0원입니다. 다만 방향이 확정되지 않아 실제 값은 다를 수 있습니다.',
  // 사용자 입력을 언급하지 않으므로 D39와 무관하게 그대로 쓴다.
  tax_liability_cap_applied: () =>
    '계산된 세액공제액의 일부가 이번 과세연도의 낼 세금을 넘어 이 결과에 들어 있지 않습니다.',
  pension_contribution_blocked_annuity_started: () =>
    '연금 수령을 이미 개시한 계좌에는 납입액이 연금보험료로 인정되지 않아, 그 계좌를 배분 대상에서 제외했습니다.',
  pension_annuity_start_unknown: () => '연금 수령 개시 여부를 받지 않아 그 계좌의 배분을 보류했습니다.',
  pension_start_date_not_computable: () =>
    '연금계좌 가입일을 받지 않아 연금으로 받을 수 있는 가장 이른 시점을 계산하지 않고 연령 요건만 확인했습니다.',
  retirement_transfer_excluded_from_credit: () =>
    '퇴직급여 입금액·계약이전액은 세액공제 대상 납입액에서 제외하고 계산했습니다.',

  // -- 10.0.0(D44)으로 들어온 안내 코드 — 사람 쪽 자격 두 축 -------------------
  // **가입 자격(irp.eligibility)과 세액공제 요건(pension.credit.taxpayer_
  // eligibility)은 다른 축이고 문구도 다르다.** 이자·배당소득만 있는 사람은
  // IRP를 못 열어도 연금저축 공제는 받는다 — 두 문구를 하나로 뭉개면 그 통로가
  // 화면에서 사라진다.
  irp_excluded_no_qualifying_status: () =>
    '이번 과세기간에 근로소득이 없고 합산되는 다른 소득도 확인되지 않아 IRP를 설정할 수 있는 지위에 해당하는 사실이 없습니다. 그래서 이번 계산의 배분 대상이 아닙니다.',
  // **미정은 배제가 아니다**(D44 판정 1). 「가입할 수 없습니다」도 「가입할 수
  // 있습니다」도 적지 않는다 — 이 분기에는 조문상 자격이 확실한 사람(사업소득자)
  // 이 섞여 있고, 어느 쪽으로도 결론이 나 있지 않다. 그래서 배분에서 빼지 않고
  // 「확인이 필요하다」는 사실만 말한다.
  irp_eligibility_not_determined: () =>
    '근로소득은 없고 합산되는 다른 소득이 있다고 답한 경우입니다. IRP를 설정할 수 있는 지위인지 이 입력만으로는 확인되지 않아 배분에서 빼지 않았습니다. 가입 자격 확인이 별도로 필요합니다.',
  // **「낼 세금이 적어 잘렸습니다」와 다른 문장이다**(계약 5.18절, D44). 저
  // 문장은 "소득이 늘면 그만큼 더 공제받는다"를 함의하는데, 이 사용자에게는 그
  // 함의가 성립하지 않는다 — 요건이 서는 것과 세금을 내는 것은 다른 조건이다.
  pension_credit_zero_no_global_income: (params) =>
    params.is_exact
      ? '그 해에 종합소득이 없어 연금계좌 세액공제의 요건이 서지 않습니다. 낼 세금이 적어 잘린 것이 아닙니다.'
      : '그 해에 종합소득이 확인되지 않아 연금계좌 세액공제의 요건이 서지 않는 것으로 계산했습니다.',

  // -- 계약 5.0.0(D27)으로 들어온 안내 코드 -----------------------------------
  // **금액 경계를 문구에 적지 않는다** — 구간을 가르는 숫자는 룰셋의 값이고
  // 화면 코드에 박으면 제품 원칙 1을 어긴다. "적어도"라는 방향만 말한다.
  credit_rate_global_income_missing: () =>
    '해당 과세기간 종합소득금액을 받지 않아, 우대 공제율 구간을 적용하지 않고 계산했습니다. 종합소득금액이 우대 구간에 들면 세액공제액은 이보다 클 수 있습니다.',

  // -- 계약 5.1.0(D28·D29·D31)으로 들어온 안내 코드 — 수익률 가정 ---------------
  // **이 서비스는 수익률을 제시하지 않는다.** 아래 문구는 전부 "무엇을 입력받아
  // 무엇을 했는가"만 말하고, 수익률을 권하거나 전망하는 문장을 쓰지 않는다(0.10절).
  isa_return_assumption_not_supplied: () =>
    'ISA 계좌의 예상 수익률을 입력하지 않아 ISA의 가정 기반 정산액을 계산하지 않았습니다.',
  isa_return_estimate_is_not_annual: (params) =>
    `이 금액은 ${
      params.settlement_years != null ? formatYears(params.settlement_years) : '입력한 정산 기간'
    } 전체의 값이며, 1년치 금액이 아닙니다.`,
  isa_return_estimate_reported_as_range: () =>
    '입력한 소득 성격으로는 단일 금액을 정할 수 없어, 구간으로 계산했습니다.',
  isa_return_estimate_not_computable: (params) =>
    params.reason_code === 'isa_tax_free_limit_unknown'
      ? 'ISA 계좌 유형을 입력하지 않아 가정 기반 정산액을 계산하지 못했습니다.'
      : '입력한 값으로는 가정 기반 정산액을 계산할 수 없었습니다.',
  isa_return_estimate_display_suppressed: () =>
    'ISA 가정 기반 정산액의 계산은 그대로 두고, 화면에는 금액을 표시하지 않았습니다.',

  // -- 계약 8.1.0(D36)으로 들어온 안내 코드 — 확정 축 도입 --------------------
  // 4단계 게이트4 재소집(11.2절) 결함 — 등록만 되고 문구가 없어 코드 문자열이
  // 그대로 뜨던 자리. **세율차 축이 0인 것은 「혜택 없음」이 아니다** — D36이
  // 직접 챙긴 사실: 계약기간 순소득이 비과세 한도를 넘지 않아 9%가 아니라
  // 0%로 과세되고 있다는 **더 유리한** 사실이다(`compute.mjs:489`,
  // `engine-interface.md` 5.14·8.1.0절). 세율 수치는 코드에 적지 않는다 —
  // `account-benefit-strip.js`의 `ACCOUNT_BENEFIT_RATE_GAP_FAVORABLE_ZERO_NOTE`가
  // 이미 같은 사실을 배분안 단위로 말하고 있고, 이 안내는 그 시나리오 단위
  // 메아리다(어느 배분안에서 그런지는 배분안 단위 필드로 판정한다, 5.14절).
  isa_rate_gap_axis_zero_because_within_tax_free_limit: () =>
    '배분안 중 적어도 하나는 ISA 저율 분리과세 세율차 축이 0으로 계산됩니다. 저율 분리과세 혜택이 없다는 뜻이 아니라, 계좌 안 순소득이 아직 비과세 한도를 넘지 않아 그만큼이 저율 분리과세가 아니라 비과세로 적용되고 있다는 더 유리한 사실입니다. 어느 배분안에서 그런지는 아래 계좌별 표에서 확인할 수 있습니다.',

  pension_tax_deferral_not_quantified: () =>
    '연금계좌의 과세이연 효과는 인출 시점에 따라 달라져 금액으로 계산하지 않았습니다. ISA 칸에만 금액이 보이는 것이 ISA가 더 유리하다는 뜻은 아닙니다.',
};

export function noticeMessage(notice) {
  const fn = NOTICE_MESSAGE[notice.code];
  return fn ? fn(notice.params ?? {}) : notice.code;
}

// ---------------------------------------------------------------------------
// 가정 코드 (8.3) — `[4-E]` AssumptionBlock. screens.md 4.5절의 문구를 그대로 쓴다.
// "무엇을 묻지 않았는가 → 그래서 어떻게 계산했는가" 형태를 유지한다.
// ---------------------------------------------------------------------------

const ASSUMPTION_MESSAGE = {
  months_remaining_defaulted: () => '과세연도 전체를 납입한다고 보고 연간 예산을 계산했습니다. 연중에 시작하면 실제 납입액은 이보다 적습니다.',
  isa_new_account_assumed: () => 'ISA 계좌가 없다고 하셔서 신규 가입을 전제로 납입 잔여 한도를 계산했습니다.',
  // [게이트 6 D46] 근거 규칙은 `isa.contribution.annual_limit`(연간 한도의
  // 미납분 이월 산식)이지 의무가입기간이 아니다. 방향도 함께 고쳤다 —
  // 경과연수를 0으로 보면 이월분이 최소로 잡히므로 한도는 과소, 즉 실제
  // 한도가 이보다 **클** 수 있다(예전 문구는 반대 항목인 락업 잔여기간의
  // 방향을 말하고 있었다).
  isa_tenure_zero_assumed: () =>
    'ISA 가입 후 경과연수를 받지 않아, 연간 납입 한도의 이월분을 0년으로 보고 계산했습니다. 실제 한도는 이보다 클 수 있습니다.',
  other_savings_zero_assumed: () => '재형저축·장기집합투자증권저축을 보유하지 않은 것으로 보고 ISA 총 납입한도를 계산했습니다.',
  prior_transfer_credit_zero_assumed: () => '직전 과세기간에 받은 전환 추가공제를 0으로 보았습니다. 실제로 받은 금액이 있으면 추가 한도가 결과보다 줄어듭니다.',
  // **없는 `params`에 기대지 않는다.** 엔진은 이 코드에 파라미터를 싣지 않는데
  // 문구가 `params.tax_year`를 쓰고 있어, 실측 화면에 `" 과세연도 하나만
  // 계산했습니다"`가 앞이 빈 채로 떠 있었다. 연도는 있으면 쓰고 없으면 문장이
  // 스스로 완결된다 — 호출부가 응답의 `echo.tax_year`를 채워 준다.
  single_tax_year_only: (params) =>
    `${params.tax_year ? `${params.tax_year} 과세연도` : '이 과세연도'} 하나만 계산했습니다. 다음 해 이후는 반영하지 않았습니다.`,
  other_deductions_excluded: () => '연말정산의 다른 소득공제·세액공제(부양가족 등)는 반영하지 않았습니다.',
  rounding_floor_to_won: () => '원 미만은 버려서 계산했습니다.',
  isa_benefit_not_quantified: () => '투자 수익률과 계좌 운용 결과는 계산에 포함되지 않았습니다.',
  fund_use_horizon_excluded_from_amounts: () => '자금 사용 시점은 배분 금액과 세액공제액에 반영하지 않았습니다. 배분안의 순서와 안내에만 쓰였습니다.',
  early_exit_penalty_not_quantified: () => '중도 인출·해지 시의 세부담은 금액으로 계산하지 않았습니다.',
  pension_holding_period_not_evaluated: () => '연금계좌 가입 경과연수를 받지 않아 보유기간 요건은 판정하지 않았습니다.',

  // -- 계약 4.0.0으로 들어온 가정 코드 ---------------------------------------
  // **값이 아니라 처리 방식을 말한다**(점검표 11.6). 만 나이 자체를 여기 적으면
  // 이 항목이 공유 이미지에 실릴 때 나이가 함께 나간다 — designer가 박은 못이다.
  //
  // **문구를 고쳤다.** 코드 이름은 여전히 `..._not_in_ruleset`이지만, 엔진이
  // `age.reckoning.reference_date`를 실제로 읽기 시작하면서 "규칙이 룰셋에 없다"는
  // 옛 문장이 **사실과 달라졌다.** 룰셋에 규칙은 있고, 그 규칙이 말하는 것이
  // "단일 기준일은 존재하지 않는다"이다 — 요건마다 판정 시점이 다르기 때문이다.
  // 코드 이름은 엔진의 것이라 화면이 고치지 않고, 문구는 화면의 것이라 고친다
  // (계약 7절). 이름과 뜻이 어긋난 상태는 보고에 올렸다.
  // 12.2(c) — 같은 사실을 더 짧은 문장으로.
  // D46 2·3번 — 조항 표기를 화면에서 뗐다. **더 뗄 것도 함께 뗐다** — 이 자리는
  // 아래에 `LawChip`이 있다는 것을 전제로 "아래 조항"이라고 가리켰는데, 그 칩이
  // 없어지면 가리킬 대상이 없는 문장이 된다("빈 곳을 가리키지 않는다" 규약,
  // `wording.test.mjs`). 요건이 걸린다는 사실 자체는 그대로 남긴다 — 근거
  // 조항이 사라진 것이 아니라 화면 표시만 빠졌을 뿐이다(`source`는 룰셋에 그대로).
  age_reference_date_not_in_ruleset: (params) => {
    const affected = params.requires_reference_date_rule_ids ?? [];
    const head = `만 나이 기준일은 요건마다 달라 하나로 정해져 있지 않습니다. 과세기간 종료일${
      params.reference_date ? `(${params.reference_date})` : ''
    } 기준으로 환산했습니다.`;
    // 걸리는 요건이 없으면 그 문장을 붙이지 않는다 — 값이 없으면 그 줄을 그리지
    // 않는 규약과 같다. 연금 쪽은 날짜 대 날짜 비교라 애초에 걸리지 않는다.
    return affected.length === 0
      ? `${head} 다른 요건에서는 결과가 달라질 수 있습니다.`
      : `${head} 이 판정에 걸리는 요건에서는 결과가 달라질 수 있습니다.`;
  },
  // **`prior_pension_credit_zero_assumed`가 여기 있었다**(D39로 폐기). 되더하기의
  // 가산항을 0으로 보던 가정인데, 되더할 입력 자체가 사라졌다.
  retirement_transfer_counted_in_contribution_limit: () =>
    '퇴직급여 입금액·계약이전액이 연간 납입한도를 쓰는지 세법 룰셋이 정하지 않아, 쓰는 쪽으로 보고 계산했습니다. 실제로 쓰지 않는다면 배분할 수 있는 금액이 결과보다 큽니다.',
  deferred_retirement_income_absent_assumed: () =>
    '이연퇴직소득 유무를 받지 않아 없는 것으로 보고 계산했습니다. 실제로 있으면 연금으로 받을 수 있는 시점이 결과보다 이릅니다.',
  local_tax_follows_income_tax_cap: () =>
    '개인지방소득세에도 같은 낼 세금 한도가 걸리는지 세법 룰셋이 확인하지 않아, 한도 안에서 인정된 소득세분에만 부가율을 적용해 계산했습니다.',

  // -- 계약 5.0.0(D27)으로 들어온 가정 코드 -----------------------------------
  credit_rate_wage_only_excludes_separately_taxed_income: () =>
    '근로소득 외에 다른 종합소득이 없다고 답하셔서 총급여액 기준으로 공제율을 판정했습니다. 분리과세로 끝난 소득만 따로 있는 경우도 이 판정에 포함됩니다.',

  // -- 계약 5.1.0(D28·D29)으로 들어온 가정 코드 — 수익률 가정 위의 계산 --------
  // **값을 지어내지 않는다.** 아래 문구는 무엇을 입력받았고 그 위에서 무엇을
  // 가정했는지만 말한다 — 수익률의 크기나 전망은 어디에도 없다.
  isa_return_rate_user_supplied: (params) =>
    params.annual_return_rate != null
      ? `입력한 연 수익률 ${formatPercent(params.annual_return_rate)}을 그대로 세법 산식에 넣어 계산했습니다. 이 수익률은 이 서비스가 제시한 값이 아닙니다.`
      : '입력한 연 수익률을 그대로 세법 산식에 넣어 계산했습니다. 이 수익률은 이 서비스가 제시한 값이 아닙니다.',
  isa_return_simple_interest: () => '수익률에서 총수익을 계산할 때 복리가 아니라 단리로 계산했습니다.',
  isa_return_principal_from_contributions: () =>
    '원금은 계좌 잔액이 아니라 지금까지의 누적 납입액과 이 배분의 ISA 배분액을 더한 값으로 보고 계산했습니다.',
  isa_settlement_years_defaulted_to_min_contract_years: (params) =>
    `정산 기간을 입력하지 않아 세법이 정한 계약기간 하한${
      params.settlement_years != null ? `(${formatYears(params.settlement_years)})` : ''
    }으로 계산했습니다.`,
  isa_loss_assumed_zero: () => '통산 대상 손실 금액을 입력하지 않아 0으로 보고 계산했습니다.',
  isa_comparison_baseline_is_withholding_only: () =>
    '비교 기준은 같은 소득을 ISA 밖에서 얻어 원천징수로 끝나는 경우로 보고 계산했습니다.',
  isa_return_assumes_contract_held_to_settlement: () =>
    '정산 시점까지 계약을 유지하는 것을 전제로 계산했습니다. 의무가입기간 안에 해지하면 결과가 달라집니다.',

  // 화면이 직접 만드는 조건부 항목(엔진 notice가 아니라 입력 상태에서 파생) —
  // screens.md 4.5절 표의 나머지 행.
  isa_account_type_defaulted: () => 'ISA 계좌 유형을 일반형으로 두고 계산했습니다. 서민형이면 비과세 한도가 달라집니다.',
  // `isa_not_held_excluded`는 지웠다(2026-08-10) — `validation.js`의
  // `formDerivedAssumptionCodes` 주석 참고. "ISA를 배분 대상에서 제외하고
  // 계산했습니다"는 거짓이었다 — 실제로는 신규 가입을 전제로 배분한다
  // (`isa_new_account_assumed`).
  transfer_destination_defaulted: () => '전환한 자금을 받을 계좌를 IRP로 두고 계산했습니다. 연금저축으로 받으면 적용되는 단독 한도가 달라 결과가 바뀝니다.',
  existing_contribution_untouched: () => '올해 이 계좌들에 이미 넣은 금액을 0으로 두고 계산했습니다. 이미 납입한 금액이 있으면 납입 잔여 한도가 줄어 배분이 결과와 달라집니다.',
};

export function assumptionMessage(code, params) {
  const fn = ASSUMPTION_MESSAGE[code];
  return fn ? fn(params ?? {}) : code;
}

// ---------------------------------------------------------------------------
// 경고 코드 (8.4) — Plan.warnings. screens.md 4.7절: 사실 서술, 2인칭 지시·느낌표
// ·"손해"·"위험" 금지. `info`는 문두가 붙는다.
// ---------------------------------------------------------------------------

const WARNING_BODY = {
  early_withdrawal_penalty_pension: (params) =>
    `이 계좌에서 연금 수령 개시 연령 전에 인출하면 연금외수령으로 기타소득세가 적용되는 규칙이 있습니다.${
      params.pension_years_remaining != null ? ` 그 나이까지 ${formatYears(params.pension_years_remaining)}.` : ''
    }`,
  early_termination_clawback_isa: (params) =>
    `이 계좌를 의무가입기간 안에 해지하면 감면받은 세액을 추징하는 규칙이 있습니다.${
      params.isa_lock_in_years_remaining != null ? ` 남은 의무가입기간 ${formatYears(params.isa_lock_in_years_remaining)}.` : ''
    }`,
};

const INFO_PREFIX = '자금 사용 시점을 밝히지 않아 판정하지 않았습니다 — ';

export function warningMessage(warning, boundaries) {
  const params = { ...warning.params, ...boundaries };
  const body = WARNING_BODY[warning.code] ? WARNING_BODY[warning.code](params) : warning.code;
  return warning.trigger === 'horizon_unknown' ? `${INFO_PREFIX}${body}` : body;
}

// ---------------------------------------------------------------------------
// 계좌 배제 사유 (`AccountEligibility.reason_codes`)
//
// 4단계 검증 관찰 O1의 화면 처리. 배제된 계좌에는 한도·혜택 금액 대신 이 문장이
// 들어간다. 문구 규약은 `screens.md` 4.7절의 중도 불이익 안내와 같다 —
// **주어는 사용자가 아니라 법령이고, 사실 서술로 끝낸다.** "가입하세요"·"다른
// 계좌를 고려하세요" 같은 지시형, "손해"·"위험"·느낌표를 쓰지 않는다.
// 사유 옆에는 호출부가 `basis_rule_ids`의 `LawChip`을 붙인다(헌장 고지 요소 3,
// `screens.md` 8.4(b) "차단 사유에 반드시 LawChip을 붙인다"). **D46 2·3번으로
// 한 차례 뗐으나 D59(관리자 판정)로 되돌렸다** — `tax-domain`이 재서 이 자리는
// 소유자가 지목한 "나열"이 아니라 "차단·배제 사유의 근거"로 분류했다.
// ---------------------------------------------------------------------------

const EXCLUSION_REASON_MESSAGE = {
  isa_excluded_age: () => 'ISA 가입에 필요한 연령 요건에 해당하지 않아 이번 계산의 배분 대상이 아닙니다.',
  isa_excluded_financial_income_taxpayer: () =>
    '직전 3개 과세기간 중 금융소득종합과세 대상이었던 경우 ISA 과세특례가 적용되지 않습니다. 그래서 이번 계산의 배분 대상이 아닙니다.',
  // 계약 4.0.0 — 연금 수령을 개시한 계좌는 납입액이 연금보험료로 인정되지 않는다.
  // 주어가 법령 요건이고 조치를 지시하지 않는다(screens.md 5.9절 규약).
  pension_contribution_blocked_annuity_started: () =>
    '연금 수령을 개시한 계좌에는 납입액이 연금보험료로 인정되지 않아 이번 계산의 배분 대상이 아닙니다.',
  pension_annuity_start_unknown: () =>
    '연금 수령 개시 여부를 받지 않아 이 계좌의 배분을 보류했습니다. 값을 고르면 이 계좌가 계산에 들어갑니다.',
  // 10.0.0(D44) — IRP 가입 자격(근퇴법 §24②+시행령 §17의 한정 열거) 밖으로
  // 확인된 경우다. **미정 분기와 다른 문구다** — 이 코드는 배제가 확정된
  // 분기에서만 나가고(계약 5.2절), 「가입할 수 없습니다」처럼 사용자에게 결론을
  // 대신 내려 주는 말은 쓰지 않는다. 주어는 법령 요건이고 사실만 서술한다.
  irp_excluded_no_qualifying_status: () =>
    '이번 과세기간에 근로소득이 없고 합산되는 다른 소득도 확인되지 않아 IRP를 설정할 수 있는 지위에 해당하는 사실이 없습니다. 그래서 이번 계산의 배분 대상이 아닙니다.',
};

export function exclusionReasonMessage(code) {
  const fn = EXCLUSION_REASON_MESSAGE[code];
  return fn ? fn() : code;
}

/** 배제 사유 코드가 하나도 없을 때의 대체 문장(계약상 있어야 하지만 비어 올 수 있다). */
export const EXCLUDED_ACCOUNT_FALLBACK_REASON = '이 계좌는 입력한 조건에서 배분 대상이 아닙니다.';

/** 한도·혜택 금액이 있어야 할 자리에 대신 들어가는 문장. */
export const EXCLUDED_ACCOUNT_AMOUNT_PLACEHOLDER = '배분 대상 아님';

/** C-3 스택바 영역 위 한 줄 — 배제는 배분안마다 달라지지 않고 시나리오 전체에 걸린다(5.9절). */
export function excludedFromComparisonMessage(accounts) {
  const names = accounts.map((a) => ACCOUNT_LABEL[a] ?? a).join(' · ');
  return `${names}는 이번 계산에서 배분 대상이 아니어서 아래 비교에 나타나지 않습니다.`;
}

// ---------------------------------------------------------------------------
// 두 종류의 한도 (screens.md 5.10절 · design-system 7.1절)
//
// **"잔여 한도"를 수식어 없이 쓰지 않는다.** 성격이 다른 한도가 둘이다 —
// 넘을 수 없는 `납입 잔여 한도`(`contribution_limit_remaining_krw`)와, 넘을 수
// 있는 `세액공제 인정 여지`(`credit_eligible_limit_remaining_krw` ·
// `pension_combined_credit_remaining_krw`)다. 후자에 "한도"를 붙이면 사실과
// 어긋난다 — 개정안 청년 우대에서 배분액이 그 값을 넘을 수 있다.
// ---------------------------------------------------------------------------

export function contributionRemainingCaption(remainingKrw, usedRatio) {
  return `납입 잔여 한도 ${formatKrw(remainingKrw)} · 이 중 ${formatPercent(usedRatio)} 사용`;
}

/**
 * **소유자가 문제를 짚었다 — "세액공제가 더 인정될 수 있는 금액 …" 줄을 없앤다.**
 *
 * 그 줄이 실었던 값(`pension_combined_credit_remaining_krw`)은 `scenario.limits`에
 * 있는 **배분 전** 잔여 여지다 — 어느 배분안을 보고 있는지와 무관한 같은 값이다.
 * 그런데 그 줄이 놓인 자리는 **이 배분안의 결과**(월 배분액·연 환산액)들 바로
 * 옆이었다. 배분이 그 여지를 정확히 다 채우는 흔한 경우(예: 월 80만원 예시에서
 * 연금 배분이 정확히 900만원), "더 인정될 수 있는 금액 900만원"이 그 옆에
 * 나란히 서서 이미 다 쓴 한도를 아직 남은 것처럼 읽히게 만든다. **틀(같은 줄에
 * 배분 전 사실과 배분 결과를 섞은 것)이 어긋난 것이지 숫자 자체는 틀리지
 * 않았다.**
 *
 * **그래도 이 숫자가 필요한 자리가 하나 남는다.** 개정안 청년 우대에서는 배분액이
 * 이 여지를 **넘을 수 있다**(계약 5.3절 — 이 값은 상한이 아니다). 그 경우
 * "왜 배분액이 이 여지보다 큰가"를 설명하려면 여지의 크기와 이유를 **같은
 * 문장**에서 함께 말해야 한다 — 그래서 이 함수는 지우지 않고 `exceeded` 절과
 * 합쳐 한 문장으로만 쓴다(`creditHeadroomExceededMessage`). 넘지 않는 보통의
 * 경우에는 이 사실을 말할 자리가 없다 — 배분 결과가 이미 그 여지 안에서 계산된
 * 값이므로, 여지를 다시 적으면 그 값과 나란히 서서 위 혼동이 재발한다.
 */
export function creditHeadroomExceededMessage(amountKrw) {
  return (
    `이 배분은 세액공제 인정 여지 ${formatKrw(amountKrw)}(연금저축·IRP 합산)를 넘습니다 — ` +
    '추가 납입이 이미 인정된 다른 계좌의 납입분을 공제 대상에서 밀어내고, 밀려난 만큼에 더 높은 공제율이 적용되기 때문입니다.'
  );
}

/** ISA 비과세 한도 (5.11절) — 한도이지 절감액이 아니다. 헤드라인 절세액에 더하지 않는다. `[4-D]` 표에서만 쓴다(12.2(a)). */
export function isaTaxFreeCaption(limitKrw) {
  return `이 계좌의 비과세 한도 ${formatKrw(limitKrw)} — 계좌에서 생긴 수익에 적용됩니다. 수익은 계산하지 않으므로 위 절세액에 들어 있지 않습니다.`;
}

/**
 * 12.2(a) — 같은 문장이 글자 그대로 두 번(C-2 한도 트랙 막대, `[4-D]` 표) 있던
 * 자리. `[4-D]`만 전문(`isaTaxFreeCaption` + `LawChip`)을 남기고 C-2는 이
 * 짧은 문구로 줄인다 — 금액은 아래 표에서 찾는다.
 */
export const ISA_TAX_FREE_SHORT_CAPTION = '비과세 한도 적용 — 아래 표(계좌별 상세)에서 금액';

// ---------------------------------------------------------------------------
// 미배분 금액의 사유 (4단계 qa 결함 Q1)
//
// **왜 멈췄는지에 따라 문장이 달라야 한다.** 납입 잔여 한도를 다 채워 멈춘 것과
// 세액공제가 더 붙지 않아 멈춘 것은 사용자에게 전혀 다른 사실이다 — 전자는 더
// 넣을 곳이 없다는 뜻이고, 후자는 넣을 수는 있으나 이번 계산 기준으로 공제
// 이득이 없다는 뜻이다. 한 문장으로 뭉뚱그리면 후자의 사용자는 **더 넣을 수
// 있는데 못 넣는다.**
//
// 문구는 잠정안이다 — 문구 소유권은 `designer`에게 있고 `qa`가 그 사실을
// 리포트에 적었다. 대체 문구가 확정되면 이 사전만 바꾸면 된다.
// ---------------------------------------------------------------------------

const UNALLOCATED_REASON_CLAUSE = {
  contribution_limit: (names) => `${names}는 납입 잔여 한도를 모두 채웠습니다`,
  // 이 절이 Q1의 핵심 — 납입 여지가 남아 있다는 사실을 같은 문장 안에서 말한다.
  // **6.0.0(D32)부터 엔진이 이 값을 내지 않는다** — 어떤 배분안도 더 이상
  // 세액공제 대상 한도에서 멈추지 않는다(`engine-interface.md` 0.11절). 자리는
  // `eligibility.js`의 `UNALLOCATED_REASON_ORDER`와 같은 이유로 남겨 둔다.
  credit_limit: (names) => `${names}는 세액공제 대상 납입액을 모두 채웠습니다(납입 잔여 한도는 남아 있습니다)`,
  not_eligible: (names) => `${names}는 이번 계산의 배분 대상이 아닙니다`,
  // **`12.0.0`(D52 2번)** — 지금 밝히신 자금 사용 시점(의무가입기간 안에 쓸
  // 가능성)에서는 이 계좌가 이롭지 않다. 이유는 이 계좌의 경고에 이미 적혀
  // 있으므로 여기서 다시 적지 않는다(계약 8.0절 — 조건은 한 곳에만).
  fund_use_horizon: (names) => `${names}는 지금 밝히신 자금 사용 시점에는 이롭지 않아 넣지 않았습니다`,
  // **`13.0.0`(D52 1번·D53 2번)** — IRP 트림. 더 넣어도 **표시되는** 세액공제액이
  // 한 원도 늘지 않아 거기서 멈췄다. 「예산이 모자랍니다」·「한도가 찼습니다」로
  // 적으면 거짓이다 — 더 넣으면 채워질 것처럼 읽힌다(계약 8.9절).
  no_additional_tax_credit: (names) =>
    `${names}는 더 넣어도 세액공제액이 늘지 않아 넣지 않았습니다(중도인출 제한만 지게 됩니다)`,
};

const UNALLOCATED_LEAD = '이 배분에 들어가지 않은 금액입니다.';

/** `groups`는 `unallocatedBlockers()`가 낸 `{ reason, accounts }[]`. */
export function unallocatedReasonMessage(groups) {
  const clauses = (groups ?? [])
    .map(({ reason, accounts }) => {
      const clause = UNALLOCATED_REASON_CLAUSE[reason];
      if (!clause || !accounts?.length) return null;
      return clause(accounts.map((a) => ACCOUNT_LABEL[a] ?? a).join('·'));
    })
    .filter(Boolean);
  return clauses.length ? `${UNALLOCATED_LEAD} ${clauses.join(', ')}.` : UNALLOCATED_LEAD;
}

// ---------------------------------------------------------------------------
// 「미배분」을 갈래로 나눈다 (계약 5.13절 · D26)
//
// **사용자가 "갈 곳이 없다"로 읽던 것이 문제였다.** 세법상 사실은 "갈 곳은
// 있고, 다만 올해 공제는 늘지 않는다"이다. `no_headroom_krw`에 대해서만 옛
// 뜻(정말 갈 곳이 없다)이 참이다.
//
// **두 여력이 겹치면 더하지 않는다.** `headrooms_overlap`이 `true`면 같은 돈을
// 두 번 세는 것이므로, 그럴 때는 각 여력을 따로 말하고 합계를 만들지 않는다.
// ---------------------------------------------------------------------------

/**
 * **`12.0.0`(D52 2번)** — 「한도가 남지 않아서」와 「그 시점에는 어느 계좌도
 * 이롭지 않아서」는 다른 사실이다. 뒤엣것에서는 `pension_contribution_headroom_krw`·
 * `isa_contribution_headroom_krw`가 크게 남아 있다 — 한도가 멀쩡하기 때문이다.
 * **그 두 칸을 아래 일반 절처럼 "더 넣을 수 있습니다"로 읽으면, 화면이 방금
 * `limited_by: fund_use_horizon`으로 "넣지 마세요"라고 판정한 돈을 다시
 * 권하는 것이 된다.** 그래서 이 이유일 때는 여력 금액을 권유 문장에 쓰지 않고,
 * 별도의 문장으로 「자리는 있지만 지금 시점에는 넣지 않았다」는 사실만 말한다.
 */
const NO_ACCOUNT_BENEFICIAL_REASON = 'no_account_beneficial_within_fund_use_horizon';

export function unallocatedBreakdownMessage(breakdown) {
  if (!breakdown || !breakdown.total_annual_krw) return null;
  const {
    reason_code: reason,
    pension_contribution_headroom_krw: pension,
    isa_contribution_headroom_krw: isa,
    no_headroom_krw: none,
    headrooms_overlap: overlap,
    total_annual_krw: total,
  } = breakdown;

  if (reason === NO_ACCOUNT_BENEFICIAL_REASON) {
    return (
      `${formatKrw(total)}은 이번에 넣지 않았습니다. 납입 한도는 남아 있지만, ` +
      `지금 밝히신 자금 사용 시점에는 어느 계좌도 이롭지 않기 때문입니다 — 이유는 위 경고에 있습니다.`
    );
  }

  const clauses = [];
  if (pension > 0) {
    clauses.push(
      `연금계좌에는 ${formatKrw(pension)}을 법적으로 더 납입할 수 있습니다(다만 올해의 세액공제는 늘지 않습니다)`,
    );
  }
  if (isa > 0) {
    clauses.push(`ISA에는 ${formatKrw(isa)}을 더 납입할 수 있습니다`);
  }
  if (clauses.length === 0) {
    return none > 0 ? `이 중 ${formatKrw(none)}은 이번 계산의 세 계좌 어디에도 넣을 수 없습니다.` : null;
  }
  const overlapNote = overlap ? ' 두 여력은 같은 돈을 가리킬 수 있어 더하지 않습니다.' : '';
  const noneNote = none > 0 ? ` 나머지 ${formatKrw(none)}은 세 계좌 어디에도 넣을 수 없습니다.` : '';
  return `${clauses.join(' ')}.${overlapNote}${noneNote}`;
}

// ---------------------------------------------------------------------------
// 세액공제를 낳지 않는 연금계좌 납입 (계약 5.6절 · D26)
//
// **셋 중 하나라도 빠지면 문장이 거짓이 된다** — 원금은 비과세이지만 확인
// 절차가 필요하고 소급하지 않으며, 수익에는 인출 시 세금이 붙는다. 엔진이
// 낸 `facts`를 그대로 옮긴다. "세무서"라는 말은 관공서 이름이고, 이 서비스가
// 대신할 수 없는 절차가 있다는 표시라 그대로 쓴다(D29).
//
// **[게이트 6 D46] "세무서에서 확인서를 발급받아"가 방문을 함의해 고쳤다.**
// 「연금보험료 등 소득·세액 공제확인서」는 인터넷·모바일로 신청할 수 있고
// 수수료가 없다(`tax-domain` 확인). 관공서 이름(세무서)은 그대로 쓰되
// "…에서"(장소)를 빼고 "온라인으로"를 넣어 방문을 함의하지 않게 한다.
// ---------------------------------------------------------------------------

export const PENSION_WITHOUT_CREDIT_HEADING = '세액공제 없이 더 넣는 금액';

/** `effect`는 `NonQuantifiedEffect`(code: `pension_contribution_without_credit`). */
export function pensionWithoutCreditMessage(effect) {
  const facts = effect?.facts;
  if (!facts) return null;
  const amount = formatKrw(facts.contribution_without_credit_krw);
  const account = accountWithParticle(effect.account, 'topic');
  const lines = [`${account} ${amount}만큼 세액공제 대상 한도를 넘겨 납입합니다 — 올해의 세액공제는 늘지 않습니다.`];
  lines.push(
    facts.principal_taxed_on_withdrawal
      ? '이 원금은 인출 시 과세됩니다.'
      : '이 원금은 인출 시 과세되지 않습니다(과세제외금액).',
  );
  if (facts.principal_tax_free_requires_confirmation) {
    lines.push(
      '다만 그 성격을 인정받으려면 세무서 확인서를 온라인으로 발급받아 금융회사에 제출해야 하고,' +
        (facts.principal_tax_free_confirmation_prospective_only
          ? ' 확인받은 날부터 적용됩니다(소급하지 않습니다).'
          : ''),
    );
  }
  lines.push(
    facts.returns_taxed_on_withdrawal
      ? '이 원금이 계좌 안에서 번 수익에는 인출 시 세금이 붙습니다.'
      : '이 원금이 번 수익에는 인출 시 세금이 붙지 않습니다.',
  );
  return lines.join(' ');
}

// ---------------------------------------------------------------------------
// 초기화 확인 (screens.md 3.2절 "`초기화`는 확인 모달을 거친다")
// ---------------------------------------------------------------------------

/**
 * **`window.confirm()`을 쓰지 않는다.** 아티팩트처럼 `sandbox="allow-scripts"`만
 * 걸린 iframe 안에서는 `allow-modals`가 없으면 `confirm()`이 아무것도 띄우지 않고
 * 곧바로 `false`를 돌려준다 — 사용자 눈에는 버튼이 죽은 것으로 보이고, 테스트
 * 환경에서는 막히지 않으므로 실패가 드러나지도 않는다. 확인은 화면 안에서 받는다.
 */
export const RESET_CONFIRM_TITLE = '입력한 값을 모두 지울까요?';
export const RESET_CONFIRM_BODY = '지운 값은 되돌릴 수 없습니다. 계산 결과도 함께 사라집니다.';
export const RESET_CONFIRM_ACCEPT = '모두 지우기';
export const RESET_CONFIRM_CANCEL = '취소';

// ---------------------------------------------------------------------------
// 조건부 필수 항목이 비어 있을 때 (4단계 qa 결함 Q2 · screens.md 3.5절)
// ---------------------------------------------------------------------------

export const CONDITIONAL_PENDING_ALERT =
  'ISA 만기 전환을 선택하셨습니다. 전환 금액을 입력하면 추가 공제 한도를 반영해 다시 계산합니다.';

/** 아래 결과가 아직 전환을 반영하지 않았다는 표시(3.5절) — 금액 바로 옆에 둔다. */
export const CONDITIONAL_PENDING_STALE_CAPTION = '아래 결과에는 ISA 만기 전환이 아직 반영되지 않았습니다.';

/**
 * 배분액이 0인 계좌의 C-2 캡션(screens.md 5.4절). 도넛에는 조각이 없으므로
 * (design-system 5.20절 비활성 상태) "그 계좌가 어디 갔는지"를 말하는 자리가
 * 여기와 `[4-D]` 표다. 배분 대상이 아닌 것과는 다른 사실이다 — 이 계좌는
 * 대상이지만 이 배분안이 넣지 않았을 뿐이다.
 */
// 12.2(c) — 같은 사실을 더 짧게.
export const NOT_ALLOCATED_IN_PLAN_CAPTION = '배분 없음';

/**
 * **`12.0.0`·`13.0.0`(D52·D53)** — 위 `NOT_ALLOCATED_IN_PLAN_CAPTION`만으로는
 * 부족한 자리가 생겼다. 이 계좌가 이 배분안에서 0원인 이유가 **자금 사용
 * 시점** 때문인지 **IRP 트림**(더 넣어도 표시 세액공제가 늘지 않아 멈췄다)
 * 때문인지를, 그 사실이 "미배분" 요약 행(전체가 남아야만 뜨는 자리)에
 * 도달하지 않아도 **이 계좌의 행 자체에서** 알 수 있어야 한다. 다른 이유
 * (`budget`·`contribution_limit`·`null`)는 여전히 "배분 없음"으로 충분하다 —
 * 그 자리는 이미 위 예산·한도 줄이 사실을 말하고 있다.
 */
const NOT_ALLOCATED_REASON_CAPTION = {
  fund_use_horizon: '지금 밝히신 자금 사용 시점에는 이롭지 않아 배분하지 않았습니다',
  no_additional_tax_credit: '더 넣어도 세액공제액이 늘지 않아 배분하지 않았습니다(중도인출 제한만 지게 됩니다)',
};

/** 배분액 0인 계좌 한 행의 캡션. `limited_by`를 읽어 이유가 있으면 이유를, 없으면 원래 캡션을 낸다. */
export function notAllocatedInPlanCaption(limitedBy) {
  return NOT_ALLOCATED_REASON_CAPTION[limitedBy] ?? NOT_ALLOCATED_IN_PLAN_CAPTION;
}

/** 조각이 하나뿐인 도넛의 캡션 (5.12절). 12.2(c) — 더 짧게. */
export function donutSingleSliceCaption(account) {
  return `전액이 ${accountWithParticle(account, 'direction')} 갑니다 — 계좌별 한도는 아래 참고.`;
}

/** 도넛 위 섹션 제목 (screens.md 5.14.9절 3번). 월 납입 여력을 그대로 되비춘다. 12.2(c). */
export function donutSectionTitle(monthlyCapacityKrw) {
  return `월 납입 여력 ${formatKrw(monthlyCapacityKrw)}을 나눕니다`;
}

/**
 * D38 소유자 3번(screens.md 5.14.9절) — 도넛이 "무엇의" 배분인지 이름으로
 * 답한다. **이 캡션 자체에는 「최적」을 쓰지 않는다** — design-system 5.8절
 * 배분안 이름 규약이 여전히 막는다. 기존 배분안 이름 규약을 그대로 재사용해
 * 새 어휘를 만들지 않는다.
 *
 * **[2026-08-11, D45 5번] 그런데 이 함수의 반환값이 바로 옆 `DONUT_OPTIMAL_
 * KICKER_LABEL`의 "무엇에 대해 최적인지" 조건을 채우는 문장이 됐다.** 관리자가
 * 헌장의 "최적화" 조건부 허용(계산 대상 명시)을 재확인해 「최적 월 배분표」를
 * 도넛 위에 한 자리만 쓰도록 승인했고, 그 승인의 전제가 이 캡션이 항상 함께
 * 렌더되는 것이다(`result-panel.js`의 `donutOptimalKicker`가 이 문자열이 비면
 * 던진다).
 */
export function donutPlanNameCaption(planId, isBaseline) {
  const name = PLAN_LABEL[planId] ?? planId;
  return isBaseline ? `${name} · 기본` : name;
}

/**
 * D45 5번(관리자, 2026-08-11) — 「최적」은 이 한 자리에만 쓴다. **조건이 있다:
 * 바로 아래 `donutPlanNameCaption`이 "무엇에 대해 최적인지"(계산 대상 = 이
 * 배분안이 우선한 기준)를 진술할 때만 참이다** — 기준 없이 쓰면 화면이 순위를
 * 매기는 것이 된다(`tax-rules-report.md` 15.5절). 헌장의 "최적화" 조건부
 * 허용("계산 대상이 명시될 때만")을 이 라벨의 계산 대상(월 배분)이 채운다.
 *
 * **다른 화면 요소나 서비스 이름에는 쓰지 않는다** — 조건이 자리마다 다시
 * 판정되어야 한다(D45).
 */
export const DONUT_OPTIMAL_KICKER_LABEL = '최적 월 배분표';

// ---------------------------------------------------------------------------
// 왜 이 순서로 채웠는가 — 세제상 동점의 순서 (계약 0.4·5.6절 `PriorityBasis.tie_break`)
//
// 소유자가 프로토타입에서 "왜 IRP를 먼저 채우는지 알려달라"고 물었고 그 물음이
// 맞았다. 화면은 이제 **묻기 전에** 답해야 한다.
//
// **사실과 제품 판단을 한 문장에 섞지 않는다.** 두 가지가 섞이면 "연금저축을
// 먼저 채우는 것이 세법이 정한 결론"으로 읽히는데, 그것은 사실이 아니다 —
// 근거 규칙(`pension.withdrawal.midterm_restriction`)의 `product_note`가
// "어느 계좌를 먼저 채울지는 이 규칙이 정하지 않는다"고 명시한다. 그래서
// 문장을 둘로 끊고 각각에 무엇이 정한 것인지 이름표를 붙인다.
//
// 계좌 이름을 문장에 박지 않는다. 어느 쪽이 인출이 자유로운지는 룰셋이 정하고
// 엔진이 `fill_sequence`(실제로 쓴 순서)로 실어 보내므로, 룰셋이 바뀌면 문장도
// 따라 바뀐다. 여기 `IRP`를 적어 두면 그 순간 문장이 룰셋과 갈라선다.
// ---------------------------------------------------------------------------

export const FILL_ORDER_NOTE_HEADING = '두 연금계좌 중 왜 이 순서인가';
export const FILL_ORDER_TAG_FACT = '법령이 정한 것';
export const FILL_ORDER_TAG_PRODUCT = '이 계산기가 정한 것';

/**
 * 사실 절. `flexible`은 중도인출에 법령상 제한이 없는 계좌, `restricted`는 열거된
 * 사유에 해당해야 인출이 되는 계좌다. 둘 다 엔진의 `fill_sequence`에서 온다.
 * **금액도 연수도 넣지 않는다** — 이 절이 말하는 것은 두 계좌의 과세가 같다는
 * 사실과 인출 제한의 유무뿐이고, 둘 다 숫자가 아니다.
 */
// 12.2(c) — 같은 사실을 더 짧은 문장으로(뜻은 그대로다).
export function fillOrderFactMessage(flexible, restricted) {
  const flexibleTopic = accountWithParticle(flexible, 'topic');
  const restrictedTopic = accountWithParticle(restricted, 'topic');
  const restrictedName = ACCOUNT_LABEL[restricted] ?? restricted;
  return (
    `이 계산에서 ${accountWithParticle(flexible, 'and')} ${restrictedName}의 세액공제액은 같습니다 — 공제율이 같기 때문입니다. ` +
    `다만 ${restrictedTopic} 법령이 열거한 사유가 있어야 중도인출이 되고, ${flexibleTopic} 그 제한이 없습니다.`
  );
}

/** 제품 판단 절. 지시형·권유형을 쓰지 않고 "이 계산기가 무엇을 했는가"로 끝낸다. 12.2(c) — 더 짧게. */
export function fillOrderDecisionMessage(flexible) {
  return (
    `세액공제액이 같은 구간에서는 이 계산기가 중도인출 제한이 없는 ${accountWithParticle(flexible, 'object')} 먼저 채웁니다. ` +
    `세법이 정한 순서가 아니라 이 계산기의 배분 기준이며, 세액공제액은 줄지 않습니다.`
  );
}

export const PROPOSED_BADGE_LABEL = '정부안 · 국회 통과 전';

// ---------------------------------------------------------------------------
// 시나리오 탭 (D46 4·5번, 관리자 판정)
//
// **5번 — 「확정」은 룰셋 `status` 값이 화면으로 새어 나온 말이다.** 사용자에게는
// 「확정된 것」이 아니라 「지금 시행 중인 것」이 뜻이므로 「현 세법 기준」이 맞다.
//
// **4번 — 「개정안(정부안) 반영」 → 「개정안 반영 예정」.** 라벨만 바꾼다. 탭
// 안의 내용까지 통째로 "2027년 반영 예정" 한 줄로 바꾸지 않는다 — 그건 소유자
// 입력이 우연히 개정예고 규칙 12건 중 어디에도 안 걸렸을 때만 참인 관찰이었다
// (`scenario-compare.js`가 실제로 같은지 비교한다).
// ---------------------------------------------------------------------------

export const CURRENT_SCENARIO_TAB_LABEL = '현 세법 기준';
export const PROPOSED_SCENARIO_TAB_LABEL = '개정안 반영 예정';

/**
 * 개정안 시나리오가 확정 시나리오와 **화면에 보이는 결과**에서 같을 때만 쓴다
 * (`scenarioDisplaysEqual`이 그 판정을 낸다 — 새 세법 판단이 아니라 두 응답의
 * 대조다). 소유자가 본 중복이 이 문장 하나로 준다.
 *
 * `effectiveYear`는 `scenario.ruleset.tax_year`가 아니라 `ruleset.effective_from`
 * (개정예고 룰셋의 시행일)에서 뽑은 연도다 — `tax_year`는 두 시나리오 모두
 * 요청한 과세연도를 그대로 되비출 뿐이라 "언제 반영되는지"를 말하지 못한다
 * (`result-panel.js` `proposedEffectiveYear` 주석). 연도를 못 뽑으면(형식이
 * 예상과 다르면) 숫자를 지어내지 않고 자리만 비운다.
 */
export function proposedSameAsCurrentNotice(effectiveYear) {
  return effectiveYear
    ? `현 세법 기준과 결과가 같습니다 · ${effectiveYear}년 반영 예정`
    : '현 세법 기준과 결과가 같습니다 · 개정안 반영 예정';
}

// ---------------------------------------------------------------------------
// 배분안 비교 안내 (8.5)
// ---------------------------------------------------------------------------

const COMPARISON_NOTE_MESSAGE = {
  plans_collapsed_single: () => '입력한 조건에서는 비교할 다른 배분이 나오지 않았습니다.',
  all_accounts_have_early_exit_penalty: () =>
    '세 계좌 모두 중도 인출·해지 시 적용되는 규칙이 있습니다. 선택하신 자금 사용 시점에서는 어떤 배분으로 나누어도 이 규칙을 피할 수 없습니다. 아래 배분안 비교는 세액공제액 기준이며, 중도 인출 규칙은 배분안에 따라 달라지지 않습니다.',
  // 12.2(c) — 같은 사실을 더 짧게.
  baseline_reordered_by_fund_use_horizon: () =>
    '세액공제액이 가장 큰 배분이 기본안이 아닙니다 — 자금 사용 시점에 따라 순서가 바뀌었습니다.',
  alternatives_have_equal_tax_credit: () => '둘 이상의 배분안이 같은 세액공제액을 냅니다.',
  // 계약 8.5절 — `alternatives_have_equal_tax_credit`와 달리 **그 동률이 앞으로
  // 어떤 배분에서도 깨지지 않는다**는 사실까지 말한다(5.12절). 그래서 문장이
  // "지금 같다"가 아니라 "이 축으로는 갈리지 않는다"이다.
  //
  // **9.0.0(D39·D40)으로 근거가 바뀌었다.** 옛 문구는 "입력한 직전 과세연도
  // 결정세액이 0원이어서"였다 — 그 입력이 없어졌으므로 거짓이 된다. 이제
  // 한도는 총급여액에서 계산한 값이다.
  tax_credit_axis_not_discriminating: () =>
    '총급여액 기준으로 계산한 세액 한도가 0원이어서 세액공제액으로는 배분안이 갈리지 않습니다. 아래는 계좌 구성의 차이입니다.',
};

export function comparisonNoteMessage(code) {
  const fn = COMPARISON_NOTE_MESSAGE[code];
  return fn ? fn() : code;
}

// ---------------------------------------------------------------------------
// 고정 문구 — 고지 여섯 요소, 안내, 입력 도움말
// ---------------------------------------------------------------------------

// D60(관리자 판정, 소유자 재확인) — `nature`·`qualification` 두 문장과 그것을
// 담던 `disclosureBanner()`를 지웠다. 게시 의무가 있는 문구가 아니라 이
// 서비스가 스스로 세운 방어였고(D59), 소유자가 위험의 크기를 확인한 뒤
// 두 번째로 같은 결정을 내렸다("한 글자도 남기지 마"). `limit`(고지 ⑤)은
// 소유자가 인용한 대상이 아니므로 그대로 남긴다 — 지시 범위를 넓히지 않는다.
// 되돌려야 하는 조건: 자격자 관여를 시사하는 표시가 화면에 하나라도 생기면
// 이 두 문장이 다시 필요해진다(`open_questions`).
export const DISCLOSURE = {
  // 12.2(c) — 같은 사실을 더 짧게.
  limit: [
    '개별 사정(다른 소득·공제, 계좌 개설 시기, 금융기관 조건 등)에 따라 실제 결과는 달라질 수 있습니다.',
    '실제 신고·납부는 세무사 등 자격자 확인이 필요합니다.',
    '이 계산기는 특정 금융상품·금융회사를 다루지 않고, 현재 제휴·광고도 없습니다.',
  ],
};

/**
 * `[4-H]` 저장·공유 — 2026-08-10 소유자 지시로 "공유용 이미지 만들기"를 걷어내고
 * PDF 내보내기(브라우저 인쇄)로 바꿨다(`ui/print.js`). 문구는 무엇이 실리고
 * 실리지 않는지를 화면과 같은 자리에서 말한다(P2·9절의 원칙을 그대로 옮김).
 */
export const PDF_EXPORT_LABEL = 'PDF로 저장';
// 12.2(c) — 같은 사실을 더 짧게. 「낼 세금」 언급도 D39로 함께 없앤다 — 그
// 입력 자체가 없다.
export const PDF_EXPORT_NOTE = '인쇄 대화상자의 "PDF로 저장"으로 저장됩니다. 입력값은 포함되지 않습니다.';
// **`window.print()`가 조용히 막히는 환경에서만 보인다** — `ui/print.js`가 판정한다.
export const PDF_EXPORT_BLOCKED_NOTE =
  '이 화면에서는 인쇄 대화상자가 자동으로 열리지 않았습니다. 이 페이지를 새 브라우저 탭에서 열어 다시 시도하거나, 키보드로 인쇄(Windows/Linux: Ctrl+P, macOS: Cmd+P)를 실행해 주세요.';

export const ENTRY_COPY = [
  '왼쪽에 값을 넣으면 ISA · IRP · 연금저축에 각각 얼마씩 넣는 배분을 세법 규칙으로 계산해 오른쪽에 보여줍니다.',
  '계산은 이 브라우저 안에서만 이루어지고 입력값은 어디로도 전송되지 않습니다.',
];

export const EXPECTATION_COPY = [
  'ISA · IRP · 연금저축 세 계좌의 배분안과 대안 비교',
  '각 배분으로 계산된 연간 절세액',
  // D46 2·3번 → D59 — 결과 화면에서 나열형 조항 표기를 뗀 것과 짝을 맞춘다.
  // 더 이상 화면에 일반적으로 나타나지 않는 것을 여기서 약속하지 않는다
  // (근거 자체는 룰셋에 그대로 있고, 계산에 쓰인다는 사실은 바뀌지 않았다 —
  // 화면 표시만 뺐다). D59로 배제 사유·법정 순서 두 자리에는 조항이 남았지만
  // 둘 다 예외 상황에서만 뜨는 자리라 "이 계산기가 보여주는 것" 요약에는
  // 넣지 않는다.
  '계산에 사용한 기준 과세연도',
];

// 12.2(c) — 같은 사실을 더 짧게.
export const HORIZON_EFFECT_CAPTION = '이 선택은 계산 금액을 바꾸지 않습니다 — 배분안 순서와 중도 인출 안내만 달라집니다.';

/**
 * 선택지 캡션(잔여 연수) 앞에 붙는 말머리 — **"예시"라고 적지 않는다.**
 *
 * 소유자가 "예시라고 적어 달라"고 했지만 실측하면 그 숫자는 예시가 아니다.
 * 입력 전에는 이 줄 자체가 없고, 생년월일과 ISA 정보를 넣은 **뒤에만** 나타나며
 * 값은 그 입력에서 엔진이 계산한 것이다(`fund_use_horizon_boundaries`). "예시"라고
 * 적으면 실제 값을 가상의 값이라고 말하는 것이 되어 반대 방향의 거짓말이 된다.
 *
 * 소유자가 예시로 오해했을 만한 이유는 따로 있다 — **아직 고르지 않은
 * 선택지에도 같은 형식의 숫자가 붙어** 있어서 "몇 가지 가상의 경우를 보여주는
 * 표"처럼 읽혔을 수 있다. 그래서 말을 지어내는 대신, 그 숫자가 **입력한 값에서
 * 계산됐다는 사실**을 캡션 자체에 새긴다.
 */
export const HORIZON_CAPTION_BASIS_PREFIX = '입력하신 값 기준';

// ---------------------------------------------------------------------------
// 도넛 중앙 · 결과 자리표시자 (design-system 5.20·5.29절 · screens.md 8.1절)
// ---------------------------------------------------------------------------

/**
 * 도넛 중앙 라벨 줄. **자리표시자와 결과가 같은 문자열을 같은 자리에서 쓴다** —
 * 그래서 상수가 하나뿐이다. 두 곳에 따로 적으면 한쪽만 고쳐지고, 그러면 물음표가
 * 무엇의 자리인지 스스로 말하지 못한다(design-system 5.29절).
 */
export const DONUT_CENTER_LABEL = '월 배분';

/** 값 줄이 비었을 때 그 자리를 맡는 기호. 금액과 같은 메트릭으로 놓인다. */
export const PLACEHOLDER_VALUE_MARK = '?';

/**
 * 링 아래 두 줄. **강조는 크기·굵기·색으로만 한다** — 느낌표·화살표를 쓰지
 * 않는다(screens.md 8.1절 2번). 2행의 `계산된 절세액`은 결과 라벨 `[4-B]`와 같은
 * 어휘다: 자리표시자가 약속한 이름과 실제 결과의 이름이 어긋나면 안 된다.
 *
 * **남은 항목 수·항목명을 쓰지 않는다.** 숫자는 `RequirementChecklist`에만 있다 —
 * 두 곳에 적으면 조건부 필수 항목 때문에 두 수가 실제로 어긋난다.
 */
export const RESULT_PLACEHOLDER_COPY = {
  lead: '값을 모두 넣으면 여기에 결과가 표시됩니다',
  // D46 2·3번 → D59 — 나열형 조항 표기를 화면에서 뗀 것과 짝을 맞춘다.
  sub: '계좌별 배분 · 계산된 절세액 · 가정 사항',
  /** 링과 `?`가 `aria-hidden`이므로 스크린리더에는 이 문장 하나가 나간다. */
  screenReader: '아직 계산 결과가 없습니다. 위 목록의 남은 항목을 채우면 결과가 여기에 표시됩니다.',
};

// ---------------------------------------------------------------------------
// ThemeControl (design-system 5.30절)
// ---------------------------------------------------------------------------

/** 3택이다. 2택 토글은 `자동`을 표현할 수 없어 운영체제 설정으로 돌아갈 길이 없다. */
export const THEME_CONTROL = {
  label: '화면 밝기',
  options: [
    { value: 'system', label: '자동' },
    { value: 'light', label: '밝게' },
    { value: 'dark', label: '어둡게' },
  ],
};

// ---------------------------------------------------------------------------
// 생년월일 (screens.md 3.7절 · design-system 5.25절)
//
// **만 나이를 필드 옆에 되비추지 않는다.** 확인 텍스트가 화면에 상주하면
// 스크린샷·화면 녹화·공유 이미지에 함께 실린다. 되비추기의 이득(오타 확인)은
// 오류 메시지가 이미 담당한다.
// ---------------------------------------------------------------------------

export const BIRTH_DATE_LABEL = '생년월일';
export const BIRTH_DATE_PLACEHOLDER = 'YYYY-MM-DD';
// 12.2(b) — 브라우저 밖으로 안 나간다는 사실은 진입 안내·PDF 내보내기 고지가
// 이미 말하고 있다(제품 원칙 4). 필드 캡션은 "무엇에 쓰는지"만 남긴다.
export const BIRTH_DATE_HELP = '만 나이 계산에만 씁니다.';

// ---------------------------------------------------------------------------
// [2026-08-11 D39로 전량 폐기] 직전 과세연도 결정세액 (옛 screens.md 3.8절)
//
// 소유자 지시로 이 입력·문구를 전부 없앴다. 법정 한도(`pension.credit.
// tax_liability_cap`)는 사라지지 않는다 — 엔진이 해당 과세기간 총급여액에서
// 직접 산출한다(D40, `resolveTaxLiabilityCapMock`). 이 자리에 있던 `PRIOR_TAX_*`·
// `SOURCE_GUIDE_*`(「이 값을 어디서 찾나요」)·`WITHHOLDING_RECEIPT_DIVIDER`가
// 전부 없어졌다 — 그 물음 자체가 없으므로 명세할 문구가 없다.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 공제율 판정 축 — 두 물음 (계약 5.0.0 · D27)
//
// **아니오면 입력이 하나도 안 늘어난다.** 대다수 사용자가 여기다 — 이 경로에서
// 화면이 조금도 무거워지지 않아야 한다. `예`를 고른 사람에게만 둘째 물음이
// 나타난다.
// ---------------------------------------------------------------------------

export const HAS_NON_WAGE_INCOME_LABEL = '근로소득 외에 다른 종합소득이 있나요?';
// 12.2(c) — 같은 사실을 더 짧게.
export const HAS_NON_WAGE_INCOME_HELP =
  '사업·부동산임대·종합과세 이자·배당·연금·기타소득 등 종합소득세 신고서에 합산되는 소득입니다(분리과세 소득 제외).';
export const GLOBAL_INCOME_LABEL = '해당 과세기간 종합소득금액';
export const GLOBAL_INCOME_HELP =
  '「종합소득세 과세표준확정신고 및 납부계산서」의 「종합소득금액」 칸. 수입금액이 아니라 근로소득금액을 포함한 합계입니다. 모르면 비워 두면 됩니다 — 그 경우 우대 공제율 구간을 적용하지 않고 계산합니다.';

// ---------------------------------------------------------------------------
// 현재 연금 수령 여부 (screens.md 3.10.1절)
// ---------------------------------------------------------------------------

export const ANNUITY_START_LABEL = '지금 연금을 받고 계신가요?';
// 12.2(c) — 같은 사실을 더 짧게.
export const ANNUITY_START_EFFECT_CAPTION = '연금 수령 개시 계좌는 납입액이 연금보험료로 인정되지 않아 배분 대상에서 빠집니다.';
/** `예`일 때 선택지 그룹 위에 두는 사실 통지. **조치를 지시하지 않는다**(5.9절 규약). */
export const ANNUITY_STARTED_HORIZON_NOTE =
  '연금을 이미 받고 계신 경우, 아래 선택지의 "연금 수령 나이"를 기준으로 한 구분은 이미 지난 시점을 가리킵니다.';

// ---------------------------------------------------------------------------
// ISA 계좌 유형 (screens.md 3.6절 — 2026-08-10, ISA 보유 여부와 무관하게 뗐다)
//
// **엔진은 ISA 미보유 사용자에게도 신규 가입을 전제로 배분한다**
// (`isa_new_account_assumed`, 계약 3.2절 `IsaAccountState.exists`). 일반형/
// 서민형은 소득 요건이지 계좌 보유 여부가 아니다(계약 3.2절 `account_type`이
// `exists`와 독립된 필드인 이유) — 그래서 이 토글은 ISA 보유 여부 토글 밖으로
// 뗀다. 다만 **묻는 말은 달라야 한다.** ISA가 없는 사람에게 "계좌 유형"을
// 그대로 물으면 이미 가진 계좌의 속성을 묻는 것처럼 읽힌다 — 아직 없는
// 계좌이므로 "가입할" 유형을 묻는다.
// ---------------------------------------------------------------------------

export const isaAccountTypeLabel = (isaExists) => (isaExists ? 'ISA 계좌 유형' : '가입할 ISA 계좌 유형');

// ---------------------------------------------------------------------------
// ISA 가입 후 경과연수 (게이트 6 D46)
//
// **누적 납입액 칸이 채워졌을 때만 나타난다.** 0이면 이 값이 연간 납입 한도의
// 이월분 계산에 아무 영향을 주지 않는다 — 묻는 것 자체가 불필요한 질문이다
// (`isaYearsSinceOpeningVisible`, state/validation.js). 비워 두면 계약이
// 가장 보수적인 0으로 계산한다(engine-interface.md 3.2절) — 이 서비스는
// 경과연수를 지어내지 않는다.
// ---------------------------------------------------------------------------

export const ISA_YEARS_SINCE_OPENING_LABEL = 'ISA 가입 후 경과연수 (선택)';
export const ISA_YEARS_SINCE_OPENING_HELP = '연간 납입 한도의 이월분 계산에 쓰입니다. 비워 두면 0년(이월 없음)으로 계산합니다.';

// ---------------------------------------------------------------------------
// 금융소득종합과세 대상 여부 (screens.md 3.6절 — ISA 조건부 블록 안)
// ---------------------------------------------------------------------------

export const FINANCIAL_INCOME_LABEL = '직전 3개 과세기간 중 금융소득종합과세 대상이었던 적이 있나요?';
// 12.2(c) — 같은 사실을 더 짧게.
export const FINANCIAL_INCOME_EFFECT_CAPTION = '해당하면 ISA가 배분 대상에서 빠집니다(과세특례 미적용). 모르겠으면 이 규칙 없이 계산합니다.';

// ---------------------------------------------------------------------------
// 청년 자기신고 (screens.md 3.9절 · design-system 5.28절)
//
// **연령 범위 숫자를 화면이 쓰지 않는다.** 청년 우대 규칙의 연령 범위는 시행령
// 위임이고 시행령 개정안이 아직 공개되지 않아 룰셋에 값이 없다. 화면이 정부
// 발표의 숫자를 적으면 **출처 없는 숫자를 말하는 것**이 된다(제품 원칙 1·2).
// 아래 문장 어디에도 연령 숫자가 없고, 룰셋에 값이 실릴 때만 켜지는 줄은
// `YOUTH_DECLARED_RANGE_NOTE` 하나뿐이며 그것도 숫자를 인쇄하지 않는다.
// ---------------------------------------------------------------------------

export const YOUTH_BLOCK_TITLE = '청년 우대 (개정안)';
/**
 * [2026-08-11 D39 §2] 이 블록을 기본 접힘 `<details>` 안에 둔다(screens.md
 * 3.9.3.1절) — 필수가 아니고, 답이 없어도 결과가 정상으로 나오고, 아직 국회를
 * 통과하지 않은 개정안에만 뜻이 있는 항목이라 R3(입력을 접지 않는다)의 새 예외
 * 기준에 해당한다. **트리거 한 줄은 항상 보인다** — "존재를 모르게 만든다"는
 * R3의 우려가 여전히 성립하지 않는다.
 */
export const YOUTH_BLOCK_TRIGGER = '▸ 청년 우대 (개정안, 선택)';
export const YOUTH_DECLARE_LABEL = '개정안의 청년 우대 대상이라고 보고 계산에 반영합니다';
export const YOUTH_AGE_UNDETERMINED_LINE = '대상 연령은 아직 시행령으로 정해지지 않았습니다.';
export const YOUTH_SCENARIO_SCOPE_CAPTION =
  '개정안 시나리오에만 적용됩니다. 현 세법 기준 시나리오의 결과는 달라지지 않습니다.';
/**
 * 룰셋에 연령 범위가 실려 있고 엔진이 낸 만 나이가 그 안에 들어올 때만 나타나는
 * 줄. **주어는 발표·법령이지 사용자가 아니다**(design-system 5.28절) —
 * `고객님은 청년에 해당합니다` 형태를 쓰지 않는다. 숫자는 여기에도 없다.
 */
export const YOUTH_DECLARED_RANGE_NOTE =
  '정부가 발표한 개정안 기준으로는 청년 우대 대상 연령에 들어갑니다. 다만 대상 연령은 아직 시행령으로 정해지지 않았습니다.';

// ---------------------------------------------------------------------------
// [2026-08-11 D39/§12.2(d)로 폐기] 「원천징수영수증에서 오는 값」 구분선
//
// 낼 세금 입력이 없어지면서 이 구분선 아래 필드가 사실상 하나(총급여액,
// 조건부로 둘)만 남아 그룹핑의 값이 옅어졌다. 지운다 — screens.md 12.2(d).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 낼 세금 한도가 결과를 바꾸는 두 상태 (screens.md 4.8절 2026-08-11 D39 전면
// 개정 · design-system 5.6절)
//
// **셋에서 둘로 줄었다.** "모름" 상태의 전제(사용자가 몰라서 못 답했다)가 D39로
// 사라졌다 — 세액 한도를 이제 엔진이 총급여액에서 항상 계산한다(D40). 남는
// 것은 (1) 정상 (2) 잘림뿐이고, 잘려서 0원이 되는 극단도 (2)에 흡수된다.
//
// **화면이 뺄셈을 하지 않는다.** 자르기 전 금액과 잘린 금액을 엔진이 둘 다 내고
// (계약 5.6절), 임계값도 엔진이 낸다(E4). 아래 함수들은 받은 금액을 문장에
// 끼우기만 한다 — 어떤 산술도 하지 않는다.
// ---------------------------------------------------------------------------

/**
 * D38 — 소유자가 제품의 목적을 다시 정의했다("세액공제가 얼마냐가 아니라 얼마나
 * 아꼈냐"). 헤드라인이 세액공제와 ISA 혜택의 합계를 낸다.
 *
 * **「연간」을 지운다.** 합계는 「올해 세액공제 + 앞으로 N년 ISA」라 어느 한 해의
 * 값도, N년치 평균도 아니다 — 기간 이름을 붙이면 그 줄이 틀린 수가 된다
 * (`headline_composite_total.is_annual === false`, 계약 5.17절). **「이 배분으로
 * 계산된」은 그대로 남긴다** — 합계에 못 들어간 성분이 있고(연금 저율과세) 그중
 * 하나는 부호가 반대(재과세)라, 이 한정이 실제로 필요하다.
 *
 * **「절세액」은 가정 성분이 합계에 들어 있을 때만 쓴다**(`includes_assumption_
 * component === true`, design-system 7.1절 어휘 규약). 가정 성분이 없으면(ISA를
 * 이 배분에 넣지 않았거나 가정을 아예 주지 않은 경우) 합계는 확정된 세액공제액과
 * 같은 수이고, 그때는 「세액공제액」이라는 정직한 이름을 쓴다.
 */
export const AMOUNT_CARD_LABEL_CREDIT_ONLY = '이 배분으로 계산된 세액공제액';
export const AMOUNT_CARD_LABEL_COMPOSITE = '이 배분으로 계산된 절세액';

/**
 * D45 3번(관리자, 2026-08-11) — 대안을 미리 보는 동안 헤드라인 자리에 오는
 * 라벨. **합계 헤드라인은 기본안이 그려질 때만 있다.** 대안 행을 눌렀을 때
 * 세액공제와 ISA 성분을 새로 합치면 확정 성분이 0인 대안에서 아래 끝이
 * 0원으로 내려가는 조합이 나온다 — 소유자가 그것을 보고 "기본안만"이라고
 * 답했다. **화면이 여기서 새로 계산하지 않는다** — `formatPlanRowAmount`가
 * 스택바 비교 행에서 이미 낸 값(`delta_vs_baseline_krw`, 세액공제액 기준)을
 * 그대로 옮긴다.
 */
export const AMOUNT_CARD_LABEL_DELTA = '기본안 대비 세액공제액 차이';
// **`AMOUNT_CARD_LABEL_ZERO`가 여기 있었다**(D39로 폐기). 한도가 0으로 잘려
// 세액공제액이 0원이 되는 것은 이제 「잘림」 상태의 극단일 뿐 별도 상태가
// 아니고, 라벨도 잘림과 같은 것을 쓴다(screens.md 4.8절 "극단").
/** 상한 접두 — `최대`는 구간 변형·「최대 X 중 Y」에서만 쓴다(design-system 7.1절). ISA 축에서 쓴다 */
export const BOUNDED_AMOUNT_PREFIX = '최대';

/**
 * D38 — 헤드라인 구간 변형의 슬롯5(구성 두 줄). **화면이 조립하지 않는다** —
 * `headline_composite_total`이 이미 낸 값만 문장에 끼운다(design-system 5.6절
 * "구간 변형"). 줄①은 슬롯2'의 {최소}와 항상 같은 수다(항등식, 계약 5.17절).
 */
export function headlineComponentDeterminedLine(headline) {
  return `올해 세액공제 ${formatKrw(headline.determined_component_krw)}`;
}

/**
 * 줄② — ISA 성분. **`bound_code`가 `range`일 때만 `최대`를 붙인다** — 구간의 위
 * 끝을 적는 것이므로 상한 접두가 맞다. `point`(소득 성격이 확정적)면 그 자체가
 * 점 추정이므로 접두를 붙이지 않는다(design-system 5.6절 슬롯5 줄②).
 */
export function headlineComponentAssumptionLine(headline, annualReturnRate) {
  const yearsText = headline.assumption_settlement_years != null ? formatYears(headline.assumption_settlement_years) : '';
  const rateText = annualReturnRate != null ? formatPercentTrimmed(annualReturnRate) : null;
  const amountText = formatKrw(headline.assumption_component_krw);
  const amountWithPrefix = headline.bound_code === 'range' ? `${BOUNDED_AMOUNT_PREFIX} ${amountText}` : amountText;
  const rateClause = rateText != null ? ` (연 ${rateText} 가정)` : '';
  return `+ 앞으로 ${yearsText} 동안 ISA ${amountWithPrefix}${rateClause}`;
}

/**
 * 슬롯2/슬롯2' — 헤드라인 금액. `bound_code`가 `range`면 두 끝을, `point`면 한
 * 수를 적는다(design-system 5.6절). **같은 헤드라인이 `bound_code`에 따라
 * 「최소~최대」와 「한 수」로 갈리므로, 그 둘은 이 값 하나로만 구분되고 부가
 * 어휘를 새로 만들지 않는다** — 가정 성분이 섞여 있다는 사실은 값이 아니라
 * 슬롯5(구성 두 줄)의 유무가 진다(`amountCard`).
 */
export function headlineValueText(headline, { boundedPrefix = false } = {}) {
  const prefix = boundedPrefix ? `${BOUNDED_AMOUNT_PREFIX} ` : '';
  if (headline.bound_code === 'range') {
    return `${prefix}${formatKrw(headline.lower_bound_krw)} ~ ${formatKrw(headline.upper_bound_krw)}`;
  }
  return `${prefix}${formatKrw(headline.point_estimate_krw)}`;
}

// **`boundedDirectionNote`·`BOUNDED_BACK_LINK`가 여기 있었다**(D39로 폐기). 둘 다
// "직전 과세연도 결정세액을 입력하면 더 정확해진다"는 전제 위에 있었는데 그
// 입력 자체가 없어졌다 — 되돌아갈 필드가 없다.

/** 잘림 상태의 한 줄. **이후 처리를 단정하지 않는다**(4.8절 (2)). 사용자 입력을
 * 언급하지 않으므로 D39와 무관하게 그대로 쓴다(screens.md 4.8절 문구 등급). */
export function capReducedNote(beforeCapKrw, reducedKrw) {
  return `계산된 세액공제액 ${formatKrw(beforeCapKrw)} 중 ${formatKrw(
    reducedKrw,
  )}은 이번 과세연도의 낼 세금을 넘어 이 결과에 들어 있지 않습니다.`;
}

/**
 * **"넣은 돈이 사라진다"고 쓰지 않는다**(계약 10절). 소멸하는 것은 그해의
 * 세액공제액이고 납입액은 **신청을 통해** 이후 과세기간으로 넘길 수 있다.
 */
export const CAP_CARRYOVER_NOTE =
  '이 결과에 들어 있지 않은 금액에 해당하는 납입액은 신청을 통해 이후 과세기간으로 넘길 수 있습니다.';

/**
 * D40 — **문구를 줄이라는 지시 한가운데서 문장을 하나 늘리는 것이고, 승인됐다.**
 * 세액 한도가 이제 그 사람의 서류가 아니라 해당 과세기간 총급여액에서 계산한
 * **상한**이라, 이 문장이 없으면 화면이 상한을 확정값으로 말하게 된다(계약
 * 8.7절 — 룰셋의 `required_display`). **언제나** 금액과 같은 화면에 둔다 —
 * 잘렸든 안 잘렸든 관계없다. **금지되는 진술**("한도에 걸리지 않았습니다"·
 * "여유가 있습니다")은 이 문장으로 대체하지 않는다 — 침묵을 그 문장으로
 * 번역하면 거짓이 될 수 있다(D40).
 */
export const TAX_CAP_ESTIMATE_NOTE = '이 한도는 총급여로 계산한 값이라 실제 공제는 이보다 적을 수 있습니다.';

// 정확한 근거 문구는 `pension.credit.tax_liability_cap.current_year_estimate`의
// `basis_code`("current_year_total_salary")에서 나온다 — 총급여 기준으로
// 계산한 한도라는 사실이다.
export const AMOUNT_CARD_CAPTION_REDUCED_CLAUSE = '총급여 기준으로 계산한 한도까지만 반영';

/** C-3 위 한 줄 — 잘림이 배분안마다 다를 수 있다(4.8절 (2) 마지막 항목). */
export const STACKBAR_CAP_APPLIED_NOTE = '아래 금액은 낼 세금까지만 반영한 값입니다.';

/**
 * D47 — 확정 탭의 ISA 연간 납입한도에 이월 가산이 실려 있는데, 아직 국회를
 * 통과하지 않은 개정안(정부안)이 통과되면 그 이월분이 **기존 가입자에게도**
 * 폐지된다(부칙 §27②). 「못 채워도 나중에 몰아 넣으면 된다」는 계획이 그
 * 시점에 깨진다는 사실을 확정 탭이 말하지 못하면 사용자가 알 방법이 없다
 * (D46 3번 판정을 뒤집는 이유가 여기 있다).
 *
 * **한 문장에 셋을 담는다** — ①이월분이 있다는 사실, ②개정안이 통과되면
 * 기존 가입자도 잃는다는 사실, ③아직 정부안이고 국회를 통과하지 않았다는
 * 사실. `ProposedBadge`·`proposed_not_enacted`와 같은 사실을 가리키되 배지를
 * 새로 만들지 않는다 — 확정 탭에는 배지가 없다.
 */
export const ISA_CARRYOVER_REPEAL_DIVERGENCE_NOTE =
  '이 한도에는 미납입분 이월이 포함돼 있는데, 아직 국회를 통과하지 않은 개정안(정부안)이 시행되면 기존 가입자도 이 이월분을 더 이상 쓸 수 없게 됩니다.';

// ---------------------------------------------------------------------------
// `AccountBenefitStrip` — 계좌별 세제혜택 (design-system 5.31절 · screens.md
// 5.14절 · tax-rules-report.md 15절)
//
// **화면이 계좌별 숫자를 나누어 만들지 않는다.** 연금 두 계좌는 계약이 합산
// 값만 내므로 `pooled`로 묶고, ISA는 세액공제 대상이 아니라는 사실을 서술로
// 전한다 — 15.4.5절이 그대로 쓸 수 있다고 확인한 문장이다.
// ---------------------------------------------------------------------------

export const ACCOUNT_BENEFIT_STRIP_TITLE = '계좌별 세제혜택';
/**
 * D36 재개정(design-system 5.31.3절) — 위젯이 이제 세액공제만이 아니라 이
 * 결과에서 새로 계산한 다른 절세 효과(ISA 비과세·저율분리과세)도 담으므로
 * "위 절세액"만 가리키던 옛 문구로는 부족하다. "새로 계산한 값이 아니다"는
 * 세액공제 쪽에만, "이 결과에서 계산된"은 ISA 쪽에도 걸리게 넓혔다.
 */
// 12.2(c) — 같은 사실을 더 짧게.
export const ACCOUNT_BENEFIT_STRIP_REF_CAPTION = '계좌·성격별로 나눈 요약입니다 — 새로 계산한 값이 아닙니다.';
/** 연금 두 계좌가 묶여 있다는 사실 자체를 문구가 메운다(`open_questions`). */
export const ACCOUNT_BENEFIT_POOLED_NOTE = '합산 세액공제';
/**
 * D33(design-system 5.31.1절 장치③) → D36(5.31.3절)에서 축 중립 문구로 다시
 * 쓴다. **축이 둘로 갈렸으므로** 모든 행에 "세액공제 인정 한도 대비"를 쓰면
 * ISA·저율분리 행에서 성립하지 않는 비교("ISA 비과세액이 세액공제 한도의
 * 몇 %")로 읽힌다. "이 축"이 가리키는 실제 값은 소구획 캡션(confirmedAxisCaption
 * ·assumptionAxisCaption)이 이미 밝히므로, 행 캡션은 그 캡션을 다시 가리키기만
 * 한다. `fillPercent`는 0~100 스케일이다.
 */
export function benefitMeterAxisCaption(fillPercent) {
  return `이 축 기준 ${formatPercent(fillPercent / 100)}`;
}
export const ACCOUNT_BENEFIT_ZERO_DIFFERENCE_NOTE = '세액공제액으로는 계좌 간 차이가 없음';
export const ACCOUNT_BENEFIT_REDUCED_NOTE = '일부는 낼 세금 한도로 반영되지 않음';

/**
 * D37 2번, D39·D40으로 근거 갱신, D46 1번·D49로 다시 갱신 — 짧은 막대에 붙는
 * 이유. **「덜 넣어서」가 아니라 「낼 세금이 적어서」**다 — 안 쓰면 사용자가
 * "더 넣어야겠다"고 오해하는데, 세금이 한도인 사람은 더 넣어도 공제가 늘지
 * 않으므로 그것은 틀린 권유가 된다. **강도는 낮게** — 경고가 아니라 설명이므로
 * `.benefit-row-subnote`(무색)에만 쓴다.
 *
 * **D39로 문장이 살아남았지만 게이트가 바뀌었다.** 옛 게이트는
 * `tax_liability_cap_relation_code === 'cap_below_ceiling'`이었다. 이제 한도가
 * 그 사람의 서류가 아니라 총급여액에서 계산한 **상한**이므로, 자르지 않았다는
 * 사실만으로는 "걸린다"를 증명하지 못한다. `binding_code === 'binds_provably'`일
 * 때만 이 문장을 쓴다(계약 8.7절) — 자르지 않은 상태·방향이 미정인 상태
 * (`direction_indeterminate`)에서는 쓰지 않는다. **화면이 판단하지 않는다** —
 * `binding_code`를 그대로 읽는다.
 *
 * **계약 11.0.0으로 게이트가 다시 갈렸다(D46 1번·D49).** `applied`가 이제
 * 원 미만을 버리기 전의 정확값끼리 판정하므로, 잘린 양이 1원에 못 미치면
 * `applied: true`(그래서 `binding_code`도 `binds_provably`)인데 표시 금액은
 * 한 원도 줄지 않는 좌표가 실재한다. 이 문장은 **「이 막대가 짧은 것은…」 —
 * 눈에 보이는 짧음에 대한 진술**이므로, `binding_code === 'binds_provably'`
 * **그리고** `reduced_total_krw > 0`(실제로 줄어든 표시 금액이 있는가)일 때만
 * 쓴다(계약 5.5절). 아무것도 짧아지지 않았는데 왜 짧은지 설명하면 사용자가
 * 없는 것을 찾는다. `applied`가 참이라는 사실 자체는 지우지 않는다 — 다만
 * 「짧다」를 말하는 이 문장의 근거는 아니다.
 */
export const ACCOUNT_BENEFIT_CAP_BELOW_CEILING_NOTE =
  '이 막대가 짧은 것은 덜 넣어서가 아니라, 낼 세금이 이 한도보다 적기 때문입니다.';

/**
 * D36·D37 — 확정 축 소구획의 캡션. **지방소득세를 포함한 값임을 밝힌다**
 * (D37 1번) — 사용자의 연말정산 서류는 소득세분과 지방소득세분을 따로
 * 적으므로, 합계만 적으면 사용자가 자기 서류에서 그 수를 못 찾는다. 기간
 * 표기는 **「올해」**로 고정하고 조건절을 붙이지 않는다(D36 "문구" 절) — 이
 * 축은 조문이 당해 연도에 하나로 확정하는 값이기 때문이다.
 */
/**
 * D38 재개정(design-system 5.31.4절) — **한 줄로 합친다.** 이 행이 위젯에서
 * 유일하게 "행 하나 = 소구획 전체"인 자리라 위쪽 별도 캡션이 애초에 중복이었다.
 * `actualAmountText`는 이미 조립된 문자열을 그대로 받는다 — 이 함수는 뺄셈도
 * 접두 판단도 하지 않는다.
 */
export function confirmedAxisAmountSentence(ceiling, actualAmountText) {
  return `세액공제 최대 한도 ${formatKrw(ceiling.ceiling_krw)}(소득세 ${formatKrw(
    ceiling.income_tax_krw,
  )} + 지방소득세 ${formatKrw(ceiling.local_tax_krw)}) 중 ${actualAmountText}`;
}

const CONFIRMED_AXIS_BASIS_SENTENCE = {
  total_salary: '총급여 기준으로 계산한 값입니다.',
  global_income: '종합소득금액 기준으로 계산한 값입니다.',
};

/**
 * D38 재개정 — 판정 축이 셋(`basis_code`)이므로 캡션이 하나로 못 박지 않는다
 * (design-system 5.31.4절). `statutory_default`(=`fallback_applied`)는 기존
 * `credit_rate_global_income_missing` 안내 문구를 그대로 재사용한다 — 새
 * 표기를 만들지 않는다. **금액을 되비추지 않는다** — 판정 축의 이름만 밝힌다.
 */
export function confirmedAxisBasisSentence(ceiling) {
  if (ceiling.fallback_applied) return noticeMessage({ code: 'credit_rate_global_income_missing', params: {} });
  return CONFIRMED_AXIS_BASIS_SENTENCE[ceiling.basis_code] ?? null;
}

/**
 * D38 재개정(design-system 5.31.4절) — 가정 축 섹션의 공통 머리글. **공통
 * 최댓값을 더 이상 적지 않는다** — 셋 중 둘(저율분리·손익통산)에 법정 상한이
 * 없어 "가정 축의 최댓값"이라는 개념 자체가 성립하지 않는다(세법 재판정,
 * 커밋 `13c42e4`). 조건절만 남긴다.
 */
export function assumptionAxisCaption({ estimate, annualReturnRate }) {
  const yearsText = estimate.settlement_years != null ? `${formatYears(estimate.settlement_years)} 동안` : '정산 기간 동안';
  const rateText = annualReturnRate != null ? formatPercentTrimmed(annualReturnRate) : null;
  const conditionClause = rateText != null ? `, 수익률이 연 ${rateText}라면` : '';
  return `${yearsText}${conditionClause}`;
}

/** 가정 축 머리글 바로 아래에 한 번만 두는 설명 — 행마다 반복하지 않는다(design-system 5.31.4절). 12.2(c) — 더 짧게. */
export const ASSUMPTION_AXIS_CEILING_EXPLAINER = '비과세분은 계약 전체 한도가 있고(아래), 저율분리·손익통산분은 법정 상한이 없습니다.';

/**
 * D38 6번·7번(design-system 5.31.4절) — ISA 비과세 행. **기간을 문장 맨 앞에
 * 못박는다** — 기간이 없으면 옆(위) 소구획인 확정 축(연 단위)과 나란한 배치가
 * "같은 기간의 두 수"로 읽힌다. 분자가 구간의 위 끝이면 분모에 이미 있는
 * `최대`와 겹치지 않게 접두 대신 괄호 부기(`구간 위 끝`)를 쓴다 — 이 자리
 * 하나만의 예외다(design-system 7.1절).
 */
export function isaTaxFreeCeilingSentence(estimate) {
  const ceiling = estimate.axis_ceilings;
  const breakdown = estimate.axis_breakdown;
  const yearsText = formatYears(ceiling.tax_free_settlement_years);
  const numeratorPlain = formatKrw(breakdown.tax_free_krw);
  const numeratorText =
    estimate.axis_breakdown_bound_code === 'upper_bound' ? `${numeratorPlain}(구간 위 끝)` : numeratorPlain;
  const sourceNote =
    ceiling.tax_free_settlement_years_source === 'ruleset_min_contract_years'
      ? ' (계약기간을 입력하지 않아 최소 기간으로 계산 — 실제 계약기간이 더 길면 결과가 달라집니다)'
      : '';
  return `${yearsText} 계약 전체에서 최대 ${formatKrw(ceiling.tax_free_krw)} 중 ${numeratorText}${sourceNote}`;
}

/** D38 6번·7번 — 법정 상한이 없는 두 행(저율분리·손익통산)에 붙는 접미사. */
export const ACCOUNT_BENEFIT_NO_STATUTORY_CEILING_SUFFIX = '법정 상한 없음';

/**
 * `axis_breakdown_bound_code`가 `upper_bound`면 금액 앞에 `최대`를 붙인다
 * (design-system 5.6절 상한 변형, D36). `point`거나 `null`이면 그대로 적는다.
 */
export function boundedAxisAmountText(amountKrw, boundCode) {
  const text = formatKrw(amountKrw);
  return boundCode === 'upper_bound' ? `${BOUNDED_AMOUNT_PREFIX} ${text}` : text;
}

/**
 * ISA 행 서술(narrative — 정산액을 아직 낼 수 없을 때). **금액이 아니다.**
 * tax-rules-report.md 15.4.1·15.4.2절의 근거를 그대로 옮긴다 — 세액공제
 * 대상이 아니라는 사실과 혜택이 놓인 축(비과세·저율분리과세)을 함께 적어,
 * "빈칸 = 혜택 없음"으로 오독되지 않게 한다(15.4.5절).
 *
 * **D35 3번 — 「(세액공제 아님)」 괄호를 지운다.** 이 괄호가 하던 일("무엇이
 * 아닌지" 말하기)은 이제 두 소구획으로 나뉜 배치와 기간 표기·조건절이 대신
 * 한다("무엇인지" 말하기) — `tax-domain`이 지적했듯 후자가 조문에서 나오므로
 * 더 강한 근거다. 이 서술 행은 가정 축 소구획 안에 놓이므로 소구획 캡션이
 * 이미 그 구분을 지고 있다.
 */
export const ACCOUNT_BENEFIT_ISA_NARRATIVE = '비과세 한도 적용';

export const ACCOUNT_BENEFIT_EXCLUDED_LABEL = '배분 대상 아님';

// ---------------------------------------------------------------------------
// D36 — 가정 축의 ISA 세 행(`AssumptionBasedIsaEstimate.axis_breakdown`).
// 손익통산·절사 잔차는 소유자가 요청한 둘(비과세·저율분리)과 같은 무게로
// 두지 않고 보조 행 하나로 낮춘다(design-system 5.31.3절).
// ---------------------------------------------------------------------------

export const ACCOUNT_BENEFIT_ISA_TAX_FREE_LABEL = 'ISA 비과세로 아낀 금액';
export const ACCOUNT_BENEFIT_ISA_RATE_GAP_LABEL = 'ISA 저율 분리과세로 아낀 금액';
export const ACCOUNT_BENEFIT_ISA_RESIDUAL_LABEL = 'ISA 손익통산·절사 잔차 반영분';

/**
 * D36 — 세율차 축(`rate_gap_krw`)이 0인 것은 「혜택 없음」이 아니다. 계약기간
 * 순소득이 비과세 한도를 넘지 않아 정확히 0인 경우, 그것은 **9%가 아니라
 * 0%로 과세되고 있다는 더 유리한 사실**이다(대다수 사용자가 여기다). 빈
 * 막대만 두면 "혜택이 없다"로 읽히므로 사실을 문장으로 적는다. **세율
 * 수치를 코드에 박지 않는다** — "9%" 같은 숫자를 적지 않고 방향만 말한다.
 */
// 12.2(c) — 보호 대상(뜻은 그대로), 더 짧게.
export const ACCOUNT_BENEFIT_RATE_GAP_FAVORABLE_ZERO_NOTE = '0원 · 한도를 넘지 않아 비과세로 적용됩니다 — 혜택이 없는 게 아닙니다.';
/** 위 문장 옆에 붙는 짧은 배지 — 결핍이 아니라 사실 확인이라는 것을 형태로도 보인다. */
export const ACCOUNT_BENEFIT_FAVORABLE_ZERO_CHIP_LABEL = '한도 안';

// ---------------------------------------------------------------------------
// D36 — 연금저축·IRP를 나중에 받을 때(참고 구역). 축도 등급도 없다 — 금액이
// 없기 때문이다(`PensionWithdrawalTaxReference`, 계약 5.16절). 조항 번호와
// 상황 설명은 전부 계약이 낸 값을 쓰고 이 파일에서 지어내지 않는다.
// ---------------------------------------------------------------------------

export const PENSION_REFERENCE_TITLE = '참고 — 연금저축·IRP를 나중에 받을 때';
/** 계약 5.16절 `principal_retaxed_on_withdrawal`이 근거인 고정 문장. 표보다 먼저 온다. */
export const PENSION_REFERENCE_RETAX_SENTENCE =
  '세액공제를 받은 납입액은 나중에 연금으로 받을 때 다시 과세됩니다.';
export const PENSION_REFERENCE_NOT_COMPUTABLE_SENTENCE =
  '지금 계산할 수 없음 — 인출 시점·방식·소득 성격에 따라 세율이 달라지고, 그 셋은 전부 아직 정해지지 않은 미래의 선택입니다.';
export const PENSION_REFERENCE_TABLE_HEADERS = ['소득 성격', '인출 방식', '종전 대비 세율'];
export const PENSION_REFERENCE_SUMMARY_LABEL = '연금저축·IRP를 나중에 받을 때 (참고)';

/** `PensionRateGapCase.income_character_code` — 자산군이 아니라 수익의 성격(계약 5.16절). */
const PENSION_INCOME_CHARACTER_LABEL = {
  interest_dividend: '이자·배당',
  listed_equity_capital_gain: '국내 상장주식 차익',
  mixed_or_unknown: '성격 혼재·미정',
};

/** `PensionRateGapCase.withdrawal_branch_code` — 이름만 있고 세율은 없다. */
const PENSION_WITHDRAWAL_BRANCH_LABEL = {
  annuity_within_threshold: '연금 수령',
  annuity_over_threshold: '연금 수령(기준금액 초과)',
  non_annuity: '연금 외 수령',
  any: '수령 방식 미정',
};

/**
 * `sign_code`는 계좌 밖·안 실효율의 뺄셈에서 **산술로만** 정해진다(계약 5.16절
 * "해석이 아니라 산술이다") — 엔진이 유불리를 판단하지 않는다. 화면이 그 산술
 * 결과를 짧게 표기하는 것도 같은 이유로 평가가 아니라 부호의 요약이다.
 */
const PENSION_GAP_SIGN_LABEL = {
  positive: '유리',
  negative: '불리',
  crosses_zero: '성격에 따라 갈림',
  not_determined: '세율 미정',
};

/** 백분율포인트(%p) 표기. 부호를 명시하고 불필요한 소수 0을 잘라낸다. */
function formatRateGapPercentPoint(rate) {
  const pct = Math.round(rate * 100 * 1000) / 1000; // 부동소수점 꼬리 제거
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const text = String(Math.abs(pct)).replace(/\.0+$/, '');
  return `${sign}${text}%p`;
}

/** 세율표 한 행의 「종전 대비 세율」 칸. 폭이 정해지지 않으면(`not_determined`) 값 대신 사실을 말한다. */
export function pensionRateGapRangeText(row) {
  if (row.gap_min_rate == null || row.gap_max_rate == null) return '조문으로 닫히지 않음';
  if (row.gap_min_rate === row.gap_max_rate) return formatRateGapPercentPoint(row.gap_min_rate);
  return `${formatRateGapPercentPoint(row.gap_min_rate)} ~ ${formatRateGapPercentPoint(row.gap_max_rate)}`;
}

export function pensionIncomeCharacterLabel(code) {
  return PENSION_INCOME_CHARACTER_LABEL[code] ?? code;
}
export function pensionWithdrawalBranchLabel(code) {
  return PENSION_WITHDRAWAL_BRANCH_LABEL[code] ?? code;
}
export function pensionGapSignLabel(code) {
  return PENSION_GAP_SIGN_LABEL[code] ?? code;
}

// ---------------------------------------------------------------------------
// D28·D29·D31 — 수익률 가정 입력 · `AccountBenefitStrip`의 가정 등급
//
// **이 서비스는 수익률을 제시하지 않는다.** 아래 문구 어디에도 예시 숫자·
// 기본값·"보통 ○%" 같은 힌트가 없다 — 그 구분이 D31 이후 남은 방어선
// 전부다(0.10절).
// ---------------------------------------------------------------------------

export const ISA_RETURN_SECTION_TITLE = '⑤ ISA 예상 수익률 (선택)';
export const ISA_RETURN_TOGGLE_LABEL = '예상 수익률로 ISA 정산액을 계산합니다';
// 12.2(c) — 같은 사실을 더 짧게.
export const ISA_RETURN_SECTION_HELP = '직접 예상한 수익률을 넣어야 합니다(제시·전망하지 않습니다).';
export const ISA_RETURN_RATE_LABEL = '연 수익률';
export const ISA_RETURN_INCOME_CHARACTER_LABEL = '수익이 들어오는 형태';
export const ISA_RETURN_INCOME_CHARACTER_HELP = '자산군이 아니라 수익 성격을 묻습니다 — 같은 종목도 매매차익과 배당금은 세제상 취급이 다릅니다.';
export const ISA_RETURN_SETTLEMENT_YEARS_LABEL = '정산 기간 (선택)';
export const ISA_RETURN_SETTLEMENT_YEARS_HELP = '비워 두면 계약기간 하한으로 계산합니다.';
export const ISA_RETURN_LOSS_LABEL = '통산 대상 손실액 (선택)';
export const ISA_RETURN_LOSS_HELP = '비워 두면 0으로 봅니다.';

/**
 * 「수익이 어떤 형태로 들어오는가」— 자산군이 아니다(계약 3.6절 · D29 1절).
 * **버튼 라벨은 짧게 두고 예시는 `ISA_INCOME_CHARACTER_EXAMPLE`로 뺀다** —
 * `segmentToggle`은 "예/아니오" 길이의 라벨을 전제로 만들어졌고, 문장 전체를
 * 버튼 안에 넣으면 줄바꿈이 아래 도움말과 겹친다(실측으로 잡았다).
 * **「해외주식」이라는 낱말을 쓰지 않는다** — ISA에 담을 수 있는 자산의 범위를
 * 정하는 조문을 1차 출처로 확인하지 못했다(`tax-rules-report.md` 18.8절 3).
 */
export const ISA_INCOME_CHARACTER_LABEL = {
  interest_dividend: '이자·배당처럼 받는 형태',
  listed_equity_capital_gain: '국내 상장주식 가격 상승',
  mixed_or_unknown: '섞여 있거나 모르겠음',
};

/** 위 라벨 아래에 붙는 한 줄 예시 — 버튼 밖에서 자산 범주를 구체화한다. */
export const ISA_INCOME_CHARACTER_EXAMPLE = {
  interest_dividend: '예: 예금·적금 이자, 채권 이자, 펀드·ETF 분배금, 주식 배당금',
  listed_equity_capital_gain: '가격 상승분만이며, 같은 종목의 배당금은 위 항목이 답입니다',
  mixed_or_unknown: '위 둘이 섞여 있거나 아직 정하지 않은 경우',
};

/** 금액 옆 캡션에 쓸 짧은 이름 — 위 라벨은 입력 화면용으로 길다. */
const ISA_INCOME_CHARACTER_SHORT_LABEL = {
  interest_dividend: '이자·배당 성격',
  listed_equity_capital_gain: '국내 상장주식 시세차익 성격',
  mixed_or_unknown: '성격 혼재·미정',
};

// **`ISA_RETURN_ASSUMPTION_CHIP_LABEL`(「가정 기반」)이 여기 있었다.**
// [2026-08-11 D39 #2로 폐기] 소유자 지시("「가정기반」이라는 문구 없애줘")로
// 지운다. `BenefitMeter`의 빗금(확정=단색, 가정=45° 빗금)과 가정 축 소구획의
// 조건절(`{정산기간}년 동안, 수익률이 연 {n}%라면`)이 이미 같은 뜻을 진다 —
// 칩은 세 번째 사본이었다(design-system 5.31.5절). **조건절은 지우지 않는다**
// — 지우면 이 폐기의 승인 자체가 무효가 된다(같은 절).

/**
 * 가정 기반 ISA 정산액의 금액 표시. **점을 낼 수 없으면 구간을 그대로 보인다**
 * — 가운데값을 만드는 순간 조문에 없는 점을 고르는 것이다(D28·D31).
 */
export function isaReturnEstimateAmountText(estimate) {
  if (estimate.point_estimate_krw != null) return formatKrwAbbreviated(estimate.point_estimate_krw);
  return `${formatKrwAbbreviated(estimate.lower_bound_krw)} ~ ${formatKrwAbbreviated(estimate.upper_bound_krw)}`;
}

/**
 * 가정을 금액과 같은 화면에 붙인다(D28 선 ②). **12.2(b)로 줄었다** — 수익률·
 * 정산 기간은 바로 위 가정 축 캡션(`{n}년 동안, 수익률이 연 {n}%라면`)이 이미
 * 말한다. 여기서는 **아직 안 말한 것**(소득 성격, 정산 기간 출처)만 남긴다.
 */
export function isaReturnAssumptionCaption({ incomeCharacter, settlementYearsSource }) {
  const characterLabel = ISA_INCOME_CHARACTER_SHORT_LABEL[incomeCharacter] ?? incomeCharacter;
  const sourceNote = settlementYearsSource === 'ruleset_min_contract_years' ? ' · 정산 기간 미입력, 계약기간 하한 적용' : '';
  return `가정 — ${characterLabel}${sourceNote}`;
}

/** 계산은 돌았으나 필요한 값을 얻지 못했을 때(`not_computable`)의 짧은 서술. */
export const ISA_RETURN_NOT_COMPUTABLE_NOTE = '예상 수익률 정산액을 계산하지 못함';
/** 계산과 입력은 그대로 두고 표시만 껐을 때(`display_suppressed`)의 짧은 서술 — 조용한 빈칸을 만들지 않는다(D19). */
export const ISA_RETURN_SUPPRESSED_NOTE = '예상 수익률 정산액 표시를 껐음';
