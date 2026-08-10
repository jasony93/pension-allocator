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

import { formatKrw, formatPercent, formatYears } from './format.js';

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
  // D26 — 이름이 "추천"으로 읽히지 않게, 그리고 세액공제가 아니라 납입 한도가
  // 기준이라는 사실이 이름에 그대로 드러나게 한다. 세법이 유불리를 정하지
  // 않으므로 이 배분안은 다른 셋과 같은 자리에서 선택지로만 낸다.
  pension_contribution_limit_fill: '연금계좌 납입 한도까지 채우는 배분',
};

export const FUND_USE_HORIZON_LABEL = {
  within_isa_lock_in: '비교적 이른 시기에 쓸 수도 있다',
  before_pension_age: '중간에 쓸 계획이다',
  at_or_after_pension_age: '연금 수령 나이까지 둘 수 있다',
  unknown: '아직 모르겠다',
};

export const FUND_USE_HORIZON_DESCRIPTION = {
  within_isa_lock_in: 'ISA 의무가입기간 안에 해지할 가능성이 있다',
  before_pension_age: '연금 수령을 시작할 수 있는 나이 전에 쓸 생각이다',
  at_or_after_pension_age: '',
  unknown: '이 경우 중도 인출 관련 규칙을 판정하지 않고 참고로만 보여줍니다',
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
  isa_type_not_declared: () => 'ISA 계좌 유형을 입력하지 않아 비과세 한도 표시를 생략했습니다.',
  isa_tenure_missing: () => 'ISA 가입 시기를 받지 않아 남은 의무가입기간을 가장 길게 잡았습니다.',
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

  // -- 계약 4.0.0으로 들어온 안내 코드 ---------------------------------------
  // 문구에 세법 수치가 없다. 금액이 필요한 자리는 전부 엔진이 준 `params`나
  // 응답 필드에서 채우고, 이 사전은 문장만 갖는다.
  tax_liability_cap_unknown: () =>
    '직전 과세연도 결정세액을 받지 않아 연금계좌 세액공제가 낼 세금에 걸리는지 확인하지 못했습니다. 위 금액은 상한이며 실제 금액은 이보다 작을 수 있습니다.',
  // **오류가 아니라 결과다** — 이 사용자에게는 0이 정확한 답이므로 오류·경고
  // 색을 쓰지 않는다(계약 8.2절).
  tax_liability_cap_zero: () =>
    '입력한 직전 과세연도 결정세액이 0원이어서, 연금계좌 세액공제로 계산되는 금액이 이번 과세연도에 없습니다.',
  tax_liability_cap_applied: () =>
    '계산된 세액공제액의 일부가 이번 과세연도의 낼 세금을 넘어 이 결과에 들어 있지 않습니다.',
  pension_contribution_blocked_annuity_started: () =>
    '연금 수령을 이미 개시한 계좌에는 납입액이 연금보험료로 인정되지 않아, 그 계좌를 배분 대상에서 제외했습니다.',
  pension_annuity_start_unknown: () => '연금 수령 개시 여부를 받지 않아 그 계좌의 배분을 보류했습니다.',
  pension_start_date_not_computable: () =>
    '연금계좌 가입일을 받지 않아 연금으로 받을 수 있는 가장 이른 시점을 계산하지 않고 연령 요건만 확인했습니다.',
  retirement_transfer_excluded_from_credit: () =>
    '퇴직급여 입금액·계약이전액은 세액공제 대상 납입액에서 제외하고 계산했습니다.',

  // -- 계약 5.0.0(D27)으로 들어온 안내 코드 -----------------------------------
  // **금액 경계를 문구에 적지 않는다** — 구간을 가르는 숫자는 룰셋의 값이고
  // 화면 코드에 박으면 제품 원칙 1을 어긴다. "적어도"라는 방향만 말한다.
  credit_rate_global_income_missing: () =>
    '해당 과세기간 종합소득금액을 받지 않아, 우대 공제율 구간을 적용하지 않고 계산했습니다. 종합소득금액이 우대 구간에 들면 세액공제액은 이보다 클 수 있습니다.',
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
  isa_tenure_zero_assumed: () => 'ISA 가입 시기를 받지 않아, 남은 의무가입기간을 가장 길게 잡았습니다. 실제로는 이보다 짧을 수 있습니다.',
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
  age_reference_date_not_in_ruleset: (params) => {
    const affected = params.requires_reference_date_rule_ids ?? [];
    const head = `만 나이를 어느 날짜 기준으로 볼지는 요건마다 달라 하나로 정해져 있지 않습니다. 그래서 과세기간 종료일${
      params.reference_date ? `(${params.reference_date})` : ''
    }을 기준으로 환산해 계산했습니다.`;
    // 걸리는 요건이 없으면 그 문장을 붙이지 않는다 — 값이 없으면 그 줄을 그리지
    // 않는 규약과 같다. 연금 쪽은 날짜 대 날짜 비교라 애초에 걸리지 않는다.
    return affected.length === 0
      ? `${head} 판정 시점이 다른 요건에서는 결과가 달라질 수 있습니다.`
      : `${head} 아래 조항이 정한 요건은 판정 시점이 이 기준일과 달라, 그 요건에서는 결과가 달라질 수 있습니다.`;
  },
  prior_pension_credit_zero_assumed: () =>
    '직전 과세연도에 이미 받은 연금계좌 세액공제액을 받지 않아 0으로 보고 계산했습니다. 실제로 받은 금액이 있으면 낼 세금의 한도가 결과보다 커집니다.',
  retirement_transfer_counted_in_contribution_limit: () =>
    '퇴직급여 입금액·계약이전액이 연간 납입한도를 쓰는지 세법 룰셋이 정하지 않아, 쓰는 쪽으로 보고 계산했습니다. 실제로 쓰지 않는다면 배분할 수 있는 금액이 결과보다 큽니다.',
  deferred_retirement_income_absent_assumed: () =>
    '이연퇴직소득 유무를 받지 않아 없는 것으로 보고 계산했습니다. 실제로 있으면 연금으로 받을 수 있는 시점이 결과보다 이릅니다.',
  local_tax_follows_income_tax_cap: () =>
    '개인지방소득세에도 같은 낼 세금 한도가 걸리는지 세법 룰셋이 확인하지 않아, 한도 안에서 인정된 소득세분에만 부가율을 적용해 계산했습니다.',

  // -- 계약 5.0.0(D27)으로 들어온 가정 코드 -----------------------------------
  credit_rate_wage_only_excludes_separately_taxed_income: () =>
    '근로소득 외에 다른 종합소득이 없다고 답하셔서 총급여액 기준으로 공제율을 판정했습니다. 분리과세로 끝난 소득만 따로 있는 경우도 이 판정에 포함됩니다.',

  // 화면이 직접 만드는 조건부 항목(엔진 notice가 아니라 입력 상태에서 파생) —
  // screens.md 4.5절 표의 나머지 행.
  isa_account_type_defaulted: () => 'ISA 계좌 유형을 일반형으로 두고 계산했습니다. 서민형이면 비과세 한도가 달라집니다.',
  isa_not_held_excluded: () => 'ISA 계좌가 없다고 하셔서 ISA를 배분 대상에서 제외하고 계산했습니다.',
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
// `screens.md` 8.4(b) "차단 사유에 반드시 LawChip을 붙인다").
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

/** ISA 비과세 한도 (5.11절) — 한도이지 절감액이 아니다. 헤드라인 절세액에 더하지 않는다. */
export function isaTaxFreeCaption(limitKrw) {
  return `이 계좌의 비과세 한도 ${formatKrw(limitKrw)} — 계좌에서 생긴 수익에 적용됩니다. 수익은 계산하지 않으므로 위 절세액에 들어 있지 않습니다.`;
}

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
  credit_limit: (names) => `${names}는 세액공제 대상 납입액을 모두 채웠습니다(납입 잔여 한도는 남아 있습니다)`,
  not_eligible: (names) => `${names}는 이번 계산의 배분 대상이 아닙니다`,
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

export function unallocatedBreakdownMessage(breakdown) {
  if (!breakdown) return null;
  const { pension_contribution_headroom_krw: pension, isa_contribution_headroom_krw: isa, no_headroom_krw: none, headrooms_overlap: overlap } = breakdown;
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
      '다만 그 성격을 인정받으려면 세무서에서 확인서를 발급받아 금융회사에 제출해야 하고,' +
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
export const NOT_ALLOCATED_IN_PLAN_CAPTION = '이 배분에서는 배분하지 않음';

/** 조각이 하나뿐인 도넛의 캡션 (5.12절). */
export function donutSingleSliceCaption(account) {
  return `이번 배분은 전액이 ${accountWithParticle(account, 'direction')} 갑니다. 계좌별 한도와 남은 여력은 아래에서 볼 수 있습니다.`;
}

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
export function fillOrderFactMessage(flexible, restricted) {
  const flexibleTopic = accountWithParticle(flexible, 'topic');
  const restrictedTopic = accountWithParticle(restricted, 'topic');
  const restrictedName = ACCOUNT_LABEL[restricted] ?? restricted;
  return (
    `이 계산에서 ${accountWithParticle(flexible, 'and')} ${restrictedName}의 세액공제액은 같습니다 — 두 계좌에 적용되는 공제율이 같아, ` +
    `어느 쪽을 먼저 채워도 계산되는 세액공제액이 달라지지 않습니다. ` +
    `다만 ${restrictedTopic} 법령이 열거한 사유에 해당할 때만 중도인출이 되고, ${flexibleTopic} 그 제한을 받지 않습니다.`
  );
}

/** 제품 판단 절. 지시형·권유형을 쓰지 않고 "이 계산기가 무엇을 했는가"로 끝낸다. */
export function fillOrderDecisionMessage(flexible) {
  return (
    `세액공제액이 같은 구간에서는 이 계산기가 중도인출 제한을 받지 않는 ${accountWithParticle(flexible, 'object')} 먼저 채웁니다. ` +
    `세법이 정한 순서가 아니라 이 계산기의 배분 기준이며, 이 선택으로 계산되는 세액공제액이 줄지는 않습니다.`
  );
}

export const PROPOSED_BADGE_LABEL = '정부안 · 국회 통과 전';

// ---------------------------------------------------------------------------
// 배분안 비교 안내 (8.5)
// ---------------------------------------------------------------------------

const COMPARISON_NOTE_MESSAGE = {
  plans_collapsed_single: () => '입력한 조건에서는 비교할 다른 배분이 나오지 않았습니다.',
  all_accounts_have_early_exit_penalty: () =>
    '세 계좌 모두 중도 인출·해지 시 적용되는 규칙이 있습니다. 선택하신 자금 사용 시점에서는 어떤 배분으로 나누어도 이 규칙을 피할 수 없습니다. 아래 배분안 비교는 세액공제액 기준이며, 중도 인출 규칙은 배분안에 따라 달라지지 않습니다.',
  baseline_reordered_by_fund_use_horizon: () =>
    '세액공제액이 가장 큰 배분이 기본안이 아닙니다. 자금 사용 시점 선택에 따라 순서가 바뀌었습니다.',
  alternatives_have_equal_tax_credit: () => '둘 이상의 배분안이 같은 세액공제액을 냅니다.',
  // 계약 8.5절 — `alternatives_have_equal_tax_credit`와 달리 **그 동률이 앞으로
  // 어떤 배분에서도 깨지지 않는다**는 사실까지 말한다(5.12절). 그래서 문장이
  // "지금 같다"가 아니라 "이 축으로는 갈리지 않는다"이다.
  tax_credit_axis_not_discriminating: () =>
    '입력한 직전 과세연도 결정세액이 0원이어서 세액공제액으로는 배분안이 갈리지 않습니다. 아래는 계좌 구성의 차이입니다.',
};

export function comparisonNoteMessage(code) {
  const fn = COMPARISON_NOTE_MESSAGE[code];
  return fn ? fn() : code;
}

// ---------------------------------------------------------------------------
// 고정 문구 — 고지 여섯 요소, 안내, 입력 도움말
// ---------------------------------------------------------------------------

export const DISCLOSURE = {
  nature: '이 화면은 공개된 세법 규칙을 입력값에 적용한 자동 계산 결과이며, 조세에 관한 상담·자문이나 신고 대리가 아닙니다.',
  qualification: '이 서비스의 제공자는 세무사법 제6조에 따른 등록을 한 세무대리인이 아닙니다.',
  limit: [
    '개별 사정(다른 소득·공제 항목, 계좌 개설 시기, 금융기관별 조건 등)에 따라 실제 결과는 달라질 수 있습니다.',
    '실제 신고·납부는 세무사 등 자격을 갖춘 사람에게 확인하시기 바랍니다.',
    '이 계산기는 특정 금융상품이나 금융회사를 다루지 않습니다. 현재 제휴나 광고가 없습니다.',
  ],
};

export const ENTRY_COPY = [
  '왼쪽에 값을 넣으면 ISA · IRP · 연금저축에 각각 얼마씩 넣는 배분을 세법 규칙으로 계산해 오른쪽에 보여줍니다.',
  '계산은 이 브라우저 안에서만 이루어지고 입력값은 어디로도 전송되지 않습니다.',
];

export const EXPECTATION_COPY = [
  'ISA · IRP · 연금저축 세 계좌의 배분안과 대안 비교',
  '각 배분으로 계산된 연간 절세액',
  '계산에 사용한 법령 조항과 기준 과세연도',
];

export const HORIZON_EFFECT_CAPTION = '이 선택은 계산되는 금액을 바꾸지 않습니다. 어떤 배분안을 먼저 보여줄지와 중도 인출 관련 안내만 달라집니다.';

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
  sub: '계좌별 배분 · 계산된 절세액 · 적용한 법령 조항',
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
export const BIRTH_DATE_HELP = '만 나이를 계산에 씁니다. 이 값은 브라우저 밖으로 나가지 않습니다.';

// ---------------------------------------------------------------------------
// 직전 과세연도 결정세액 (screens.md 3.8절 · design-system 5.26절)
//
// **항목명은 세법 서식이 쓰는 이름을 그대로 쓴다**(design-system 7.1절). `낼 세금`
// 같은 구어를 라벨로 쓰지 않는다 — 사용자가 서류에서 찾아야 하는 값이므로
// 서류에 적힌 이름과 같아야 한다. 계약 3.5절이 이 항목을 근로소득 원천징수영수증
// **Ⅲ 세액명세**의 「결정세액」 칸으로 지목한다.
// ---------------------------------------------------------------------------

export const PRIOR_TAX_LABEL = '직전 과세연도 결정세액';
export const PRIOR_TAX_UNKNOWN_LABEL = '모르겠습니다';
/** 효과 고지 캡션 — **비울 수 없는 슬롯**(R1). */
export const PRIOR_TAX_EFFECT_CAPTION = '이 값이 0이면 연금계좌 세액공제로 계산되는 금액이 없습니다.';
export const PRIOR_TAX_CHECKLIST_HINT = '모르면 "모르겠습니다"를 고르면 됩니다. 결과는 나옵니다.';

/**
 * `SourceGuide` — "이 값을 어디서 찾나요"(3.8.4절).
 *
 * **화면이 항목명·경로를 지어내지 않는다.** 종이 서식의 위치는 계약 3.5절이
 * 지목한 그대로다. 홈택스 메뉴 경로는 아직 확정된 출처가 없으므로 **자리표시자를
 * 남기고, 남아 있다는 사실을 개발 빌드가 드러낸다**(D19 — 미설정 상태는 조용하면
 * 안 된다).
 */
export const SOURCE_GUIDE_TRIGGER = '이 값을 어디서 찾나요';
export const SOURCE_GUIDE_ITEMS = [
  {
    heading: '① 종이·PDF로 갖고 있다면',
    body: '근로소득 원천징수영수증 「Ⅲ 세액명세」의 「결정세액」 칸',
    placeholder: false,
  },
  {
    heading: '② 온라인으로 확인한다면',
    body: '{홈택스 메뉴 경로}',
    placeholder: true,
  },
  {
    heading: '③ 지금 확인할 수 없다면',
    body: '위의 "모르겠습니다"를 고르면 계산은 그대로 나옵니다. 다만 결과가 어느 방향으로 틀릴 수 있는지 함께 표시됩니다.',
    placeholder: false,
  },
];
export const SOURCE_GUIDE_PLACEHOLDER_NOTICE = '[개발 빌드] 이 줄의 경로가 아직 확정되지 않았습니다.';

// ---------------------------------------------------------------------------
// 공제율 판정 축 — 두 물음 (계약 5.0.0 · D27)
//
// **아니오면 입력이 하나도 안 늘어난다.** 대다수 사용자가 여기다 — 이 경로에서
// 화면이 조금도 무거워지지 않아야 한다. `예`를 고른 사람에게만 둘째 물음이
// 나타난다.
// ---------------------------------------------------------------------------

export const HAS_NON_WAGE_INCOME_LABEL = '근로소득 외에 다른 종합소득이 있나요?';
export const HAS_NON_WAGE_INCOME_HELP =
  '사업·부동산임대·종합과세되는 이자·배당·연금·기타소득처럼 종합소득세 신고서에 합산되는 소득을 말합니다. 분리과세로 끝난 소득은 포함하지 않습니다.';
export const GLOBAL_INCOME_LABEL = '해당 과세기간 종합소득금액';
export const GLOBAL_INCOME_HELP =
  '「종합소득세 과세표준확정신고 및 납부계산서」의 「종합소득금액」 칸. 수입금액이 아니라 근로소득금액을 포함한 합계입니다. 모르면 비워 두면 됩니다 — 그 경우 우대 공제율 구간을 적용하지 않고 계산합니다.';

// ---------------------------------------------------------------------------
// 현재 연금 수령 여부 (screens.md 3.10.1절)
// ---------------------------------------------------------------------------

export const ANNUITY_START_LABEL = '지금 연금을 받고 계신가요?';
export const ANNUITY_START_EFFECT_CAPTION =
  '연금 수령을 개시한 계좌에는 납입액이 연금보험료로 인정되지 않아, 그 계좌가 배분 대상에서 빠집니다.';
/** `예`일 때 선택지 그룹 위에 두는 사실 통지. **조치를 지시하지 않는다**(5.9절 규약). */
export const ANNUITY_STARTED_HORIZON_NOTE =
  '연금을 이미 받고 계신 경우, 아래 선택지의 "연금 수령 나이"를 기준으로 한 구분은 이미 지난 시점을 가리킵니다.';

// ---------------------------------------------------------------------------
// 금융소득종합과세 대상 여부 (screens.md 3.6절 — ISA 조건부 블록 안)
// ---------------------------------------------------------------------------

export const FINANCIAL_INCOME_LABEL = '직전 3개 과세기간 중 금융소득종합과세 대상이었던 적이 있나요?';
export const FINANCIAL_INCOME_EFFECT_CAPTION =
  '해당하면 ISA 과세특례가 적용되지 않아 ISA가 배분 대상에서 빠집니다. 모르겠으면 이 규칙을 적용하지 않고 계산합니다.';

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
export const YOUTH_DECLARE_LABEL = '개정안의 청년 우대 대상이라고 보고 계산에 반영합니다';
export const YOUTH_AGE_UNDETERMINED_LINE = '대상 연령은 아직 시행령으로 정해지지 않았습니다.';
export const YOUTH_SCENARIO_SCOPE_CAPTION =
  '개정안 시나리오에만 적용됩니다. 확정 세법 기준 시나리오의 결과는 달라지지 않습니다.';
/**
 * 룰셋에 연령 범위가 실려 있고 엔진이 낸 만 나이가 그 안에 들어올 때만 나타나는
 * 줄. **주어는 발표·법령이지 사용자가 아니다**(design-system 5.28절) —
 * `고객님은 청년에 해당합니다` 형태를 쓰지 않는다. 숫자는 여기에도 없다.
 */
export const YOUTH_DECLARED_RANGE_NOTE =
  '정부가 발표한 개정안 기준으로는 청년 우대 대상 연령에 들어갑니다. 다만 대상 연령은 아직 시행령으로 정해지지 않았습니다.';

// ---------------------------------------------------------------------------
// 출처가 같은 입력을 인접시킨다 (screens.md 3.11.4절 (c))
// ---------------------------------------------------------------------------

export const WITHHOLDING_RECEIPT_DIVIDER = '원천징수영수증에서 오는 값';

// ---------------------------------------------------------------------------
// 낼 세금이 결과를 바꾸는 세 상태 (screens.md 4.8절 · design-system 5.6절)
//
// **화면이 뺄셈을 하지 않는다.** 자르기 전 금액과 잘린 금액을 엔진이 둘 다 내고
// (계약 5.6절), 임계값도 엔진이 낸다(E4). 아래 함수들은 받은 금액을 문장에
// 끼우기만 한다 — 어떤 산술도 하지 않는다.
// ---------------------------------------------------------------------------

export const AMOUNT_CARD_LABEL = '이 배분으로 계산된 연간 절세액';
/** 한도가 0으로 확정된 상태의 라벨. 주어가 세액공제액이다(P3). */
export const AMOUNT_CARD_LABEL_ZERO = '이 배분에서 계산되는 세액공제액';
/** 상한 접두 — `최대`는 상한 변형에서만 쓴다(design-system 7.1절). */
export const BOUNDED_AMOUNT_PREFIX = '최대';

/** 슬롯4 — **임계값과 틀릴 방향을 한 문장에** 담는다. 비울 수 없다. */
export function boundedDirectionNote(thresholdIncomeTaxKrw) {
  return `이 배분의 세액공제액은 ${formatKrw(thresholdIncomeTaxKrw)}입니다. 직전 과세연도 결정세액이 그보다 적으면 절세액은 그만큼 줄어듭니다. 늘지는 않습니다.`;
}

/** 되돌아갈 경로 — **버튼이 아니라 텍스트 링크**다(design-system 5.6절). */
export const BOUNDED_BACK_LINK = `▸ ${PRIOR_TAX_LABEL} 넣기`;

/** 잘림 상태의 한 줄. **이후 처리를 단정하지 않는다**(4.8절 (2)). */
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

export const AMOUNT_CARD_CAPTION_BOUNDED_CLAUSE = `${PRIOR_TAX_LABEL}을 받지 않아 전액 적용된다고 보고 계산`;
export const AMOUNT_CARD_CAPTION_REDUCED_CLAUSE = `입력한 ${PRIOR_TAX_LABEL}까지만 반영`;
export const AMOUNT_CARD_CAPTION_ZERO_CLAUSE = `입력한 ${PRIOR_TAX_LABEL}이 0원 · 연금계좌 세액공제는 낼 세금의 범위에서 적용됩니다`;

/** C-3 위 한 줄 — 잘림이 배분안마다 다를 수 있다(4.8절 (2) 마지막 항목). */
export const STACKBAR_CAP_APPLIED_NOTE = '아래 금액은 낼 세금까지만 반영한 값입니다.';
/** C-3 위 한 줄 — 한 화면에서 같은 성격의 금액이 한쪽만 상한 표기이면 안 된다(4.8절 (1) 규칙). */
export const STACKBAR_BOUNDED_NOTE = `${PRIOR_TAX_LABEL}을 받지 않아 아래 금액도 상한으로 계산된 값입니다.`;

// ---------------------------------------------------------------------------
// `AccountBenefitStrip` — 계좌별 세제혜택 (design-system 5.31절 · screens.md
// 5.14절 · tax-rules-report.md 15절)
//
// **화면이 계좌별 숫자를 나누어 만들지 않는다.** 연금 두 계좌는 계약이 합산
// 값만 내므로 `pooled`로 묶고, ISA는 세액공제 대상이 아니라는 사실을 서술로
// 전한다 — 15.4.5절이 그대로 쓸 수 있다고 확인한 문장이다.
// ---------------------------------------------------------------------------

export const ACCOUNT_BENEFIT_STRIP_TITLE = '계좌별 세제혜택';
/** `[4-B]`가 같은 화면 위쪽에 전체 캡션을 이미 갖고 있으므로 전문을 다시 적지 않는다(P1). */
export function accountBenefitStripRefCaption(taxYear) {
  return `위 절세액과 같은 조건 — ${taxYear ? `${taxYear} 과세연도` : '이 과세연도'} 기준`;
}
/** 연금 두 계좌가 묶여 있다는 사실 자체를 문구가 메운다(`open_questions`). */
export const ACCOUNT_BENEFIT_POOLED_NOTE = '합산 세액공제';
export const ACCOUNT_BENEFIT_ZERO_DIFFERENCE_NOTE = '세액공제액으로는 계좌 간 차이가 없음';
export const ACCOUNT_BENEFIT_REDUCED_NOTE = '일부는 낼 세금 한도로 반영되지 않음';

/**
 * ISA 행 서술. **금액이 아니다.** tax-rules-report.md 15.4.1·15.4.2절의 근거를
 * 그대로 옮긴다 — 세액공제 대상이 아니라는 사실과 혜택이 놓인 축(비과세·저율
 * 분리과세)을 함께 적어, "빈칸 = 혜택 없음"으로 오독되지 않게 한다(15.4.5절).
 */
export const ACCOUNT_BENEFIT_ISA_NARRATIVE = '비과세 한도 적용';
/** 절세액과 구분됨을 항상 병기한다 — 이 괄호를 빼면 서술도 금액이라고 오독한다. */
export const ACCOUNT_BENEFIT_ISA_SUFFIX = '(세액공제 아님)';

export const ACCOUNT_BENEFIT_EXCLUDED_LABEL = '배분 대상 아님';
