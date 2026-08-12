// 계약 상수. **세법 수치는 하나도 없다.**
// 여기 있는 숫자는 스키마 버전과 개월수 상한처럼 세법과 무관한 것뿐이다.
// 한도·비율·구간 경계는 전부 data/tax-rules/에서 읽는다.

export const SCHEMA_VERSION = '13.0.0';
export const SUPPORTED_MAJOR = 13;

export const ACCOUNT = {
  ANNUITY: 'annuity_savings',
  PENSION: 'retirement_pension',
  ISA: 'isa',
};

/** engine-interface.md 6.1절의 고정 계좌 순서. */
export const ACCOUNT_ORDER = [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA];

export const SCENARIO = { CURRENT: 'current', PROPOSED: 'proposed' };
export const SCENARIO_ORDER = [SCENARIO.CURRENT, SCENARIO.PROPOSED];

export const PLAN = {
  MAX_CREDIT: 'max_tax_credit',
  ANNUITY_FIRST: 'annuity_savings_first',
  ISA_FIRST: 'isa_first',
  /**
   * D32 — 연금계좌 납입 한도 몫을 **ISA보다 먼저** 채우는 안.
   *
   * D26의 `pension_contribution_limit_fill`이 이 이름으로 바뀌었다. 그 이름이 말하던
   * "납입 한도를 채운다"는 이제 **모든 안이 한다**(소유자 지시, D32). 그래서 그 이름은
   * 더 이상 이 안을 다른 안과 구별하지 못한다 — 남은 차이는 **ISA와의 선후**뿐이고,
   * 이름이 실제 차이를 말해야 한다는 원칙(D17·`tie_break`)이 개명을 요구한다.
   *
   * 이름과 `priority_basis.code`가 세액공제를 말하지 않는 것은 그대로다. 이 안의 근거는
   * `pension.contribution.annual_limit`·`pension.contribution.beyond_credit_limit`이고,
   * 세법은 ISA와 이 몫의 선후를 정하지 않는다. **기본안이 되지 않는다.**
   */
  PENSION_BEFORE_ISA: 'pension_contribution_before_isa',
};

/**
 * 기본안을 뺀 나머지가 따르는 표준 순서.
 * `PENSION_BEFORE_ISA`가 마지막인 것도 의도다 — `BASELINE_BY_HORIZON`이 어떤 값에서도
 * 이 안을 가리키지 않고, 기본안 후보가 하나도 계산되지 않았을 때의 대체 선택에서도
 * 마지막으로 밀린다.
 */
export const PLAN_ORDER = [PLAN.MAX_CREDIT, PLAN.ANNUITY_FIRST, PLAN.ISA_FIRST, PLAN.PENSION_BEFORE_ISA];

export const FILL_SEQUENCE = {
  [PLAN.MAX_CREDIT]: [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA],
  [PLAN.ANNUITY_FIRST]: [ACCOUNT.ANNUITY, ACCOUNT.PENSION, ACCOUNT.ISA],
  [PLAN.ISA_FIRST]: [ACCOUNT.ISA, ACCOUNT.PENSION, ACCOUNT.ANNUITY],
  [PLAN.PENSION_BEFORE_ISA]: [ACCOUNT.PENSION, ACCOUNT.ANNUITY, ACCOUNT.ISA],
};

/**
 * 연금 납입 한도 몫(3단계)을 **ISA보다 먼저** 채우는 안의 집합.
 *
 * **D32 전에는 이 자리에 `CREDIT_BOUNDED_PLANS`가 있었다** — 연금계좌를 세액공제 대상
 * 한도까지만 채우는 안의 집합이고, 거기 없는 안만 납입 한도까지 채웠다. 소유자가 기본안도
 * 납입 한도까지 채우도록 정했으므로 그 집합은 **공집합이 되어 뜻을 잃었다.** 지금 안들을
 * 가르는 축은 상한이 아니라 **ISA와 3단계의 선후**이고, 이 상수가 그 축이다.
 *
 * 여기 없는 안은 ISA를 먼저 채운다 — 소유자가 못 박은 순서다.
 */
export const PENSION_EXTRA_BEFORE_ISA = new Set([PLAN.PENSION_BEFORE_ISA]);

export const HORIZON = {
  WITHIN_ISA_LOCK_IN: 'within_isa_lock_in',
  BEFORE_PENSION_AGE: 'before_pension_age',
  AT_OR_AFTER_PENSION_AGE: 'at_or_after_pension_age',
  UNKNOWN: 'unknown',
};

export const HORIZONS = Object.values(HORIZON);

export const ISA_ACCOUNT_TYPES = ['general', 'low_income'];
export const TRANSFER_DESTINATIONS = [ACCOUNT.PENSION, ACCOUNT.ANNUITY];

/** 두 연금계좌만 대상이다. ISA에는 연금수령 개시라는 상태가 없다. */
export const PENSION_ACCOUNT_KEYS = [ACCOUNT.PENSION, ACCOUNT.ANNUITY];

/**
 * 연금수령 개시 여부. **boolean이 아니라 세 값짜리 열거형이다.**
 * `unknown`을 `not_started`로 접으면 수령 중인 사용자에게 납입 가능액을 주게 되고,
 * 그 오류의 방향이 과대다(tax-rules-report.md 13.12절 주의 2).
 */
export const ANNUITY_START = {
  NOT_STARTED: 'not_started',
  STARTED: 'started',
  UNKNOWN: 'unknown',
};

export const ANNUITY_START_VALUES = Object.values(ANNUITY_START);

/**
 * 세액 한도를 **무엇에서** 계산했는가. 값이 하나뿐이다 — 해당 과세기간 총급여액이다.
 *
 * D39로 직전 과세연도 결정세액 입력이 사라졌고, 그 자리를 대체한 것이
 * `pension.credit.tax_liability_cap.current_year_estimate`다. 「모름」이라는 상태가
 * 더 이상 없다는 것이 이 상수가 하나뿐인 이유다.
 */
export const CAP_BASIS = 'current_year_total_salary';

/**
 * 룰셋 `...current_year_estimate.branches`의 **키**. 정의 자리는 룰셋이고 여기는 전사다.
 * 두 목록이 갈라지면 `ruleset-driven.test.mjs`가 실패한다.
 */
export const CAP_BRANCH = {
  WAGE_ONLY: 'wage_income_only',
  GLOBAL_INCOME_SUPPLIED: 'global_income_amount_supplied',
  GLOBAL_INCOME_MISSING: 'global_income_amount_missing',
};

export const CAP_BRANCHES = Object.values(CAP_BRANCH);

/**
 * 분기를 고르는 순서. **룰셋이 값으로 적는다**(`engine_evaluation.evaluation_order`).
 * 엔진이 아는 순서가 아니면 임의로 돌리지 않고 멈춘다 — 순서를 정하는 것은 룰셋이다.
 */
export const EVALUATION_ORDER_FIRST_MATCH = 'first_match_wins';

/**
 * IRP **가입 자격** 판정의 결론 코드 (D44).
 *
 * 정의 자리는 룰셋이다 — `irp.eligibility.value.engine_evaluation.allowed_outcome_codes`.
 * 여기 있는 것은 **전사**이고, 두 목록이 갈라지면 `statutory-eligibility.mjs`가 계산을
 * 멈춘다(집합으로 대조한다). 전사가 필요한 이유는 하나뿐이다 — **어느 결론이 배제이고
 * 어느 것이 미정인지**를 룰셋이 코드 칸으로 적어 두지 않았기 때문이다. 룰셋이 그 대응을
 * 값으로 적게 되면 이 상수는 사라져야 한다.
 *
 * **`irp_eligibility_undetermined`는 배제가 아니다.** 막았는데 자격이 있었던 오류는
 * 스스로 드러나지 않고, 안 막았는데 자격이 없었던 오류는 계좌를 열러 간 자리에서
 * 드러난다. D44가 드러나지 않는 쪽을 피하기로 정했다.
 */
export const IRP_OUTCOME = {
  ELIGIBLE: 'irp_eligible',
  NOT_ELIGIBLE: 'irp_not_eligible',
  UNDETERMINED: 'irp_eligibility_undetermined',
};

export const IRP_OUTCOMES = Object.values(IRP_OUTCOME);

/**
 * 미정 분기에서 룰셋이 적어 둔 처리 방침(`branches[].default_treatment`).
 * 다른 값이 오면 배제/비배제를 엔진이 고르지 않고 멈춘다.
 */
export const IRP_UNDETERMINED_TREATMENT = { DO_NOT_EXCLUDE: 'do_not_exclude' };

/**
 * 연금계좌 **세액공제 요건** 판정의 결론 코드 (소득세법 §59조의3①).
 *
 * 정의 자리는 룰셋이다 — `pension.credit.taxpayer_eligibility`의
 * `allowed_outcome_codes`. **어느 결론이 「0」인지도 엔진이 알지 않는다** — 같은 규칙의
 * `requested_notice_code`가 그 문자열을 가리키고, 엔진은 그것과 견주기만 한다.
 * 그래서 이 상수에는 「공제를 받을 수 있다」 쪽만 있고, 그것도 계약 표면에 싣는
 * 용도가 아니라 시험이 두 목록을 견줄 때 쓰는 이름이다.
 */
export const CREDIT_ELIGIBILITY_OUTCOME = {
  AVAILABLE: 'pension_credit_available',
};

/**
 * **오차 방향 코드는 이 파일에 없다** — 상한 쪽도 미정 쪽도 룰셋에서 온다 (D41 1번·D42 5절 (나)).
 *
 * 전에는 미정 쪽 문자열(`direction_indeterminate`)이 여기 상수로 있었다. 룰셋이 그 분기의
 * 방향을 **산문으로만** 적고 있었기 때문이고, 엔진이 산문을 파싱해 코드를 만들지 않으려면
 * 어딘가에는 그 문자열이 있어야 했다. 이제 룰셋이 분기마다 `direction_code` 칸을 두었고
 * `branches_reading_rule.code_definition_sites`가 정의 자리를 스스로 밝혔으므로, 상한 쪽
 * 코드(`overstated_or_equal`)와 **같은 취급**을 한다 — 엔진은 읽어서 그대로 싣는다.
 *
 * **여기에 다시 적지 마라.** 엔진 상수에 그 문자열이 있으면 룰셋이 방향을 바꿔도 응답이
 * 따라가지 않는다. `ruleset-driven.test.mjs`가 두 문자열의 부재를 본다.
 */

/**
 * 이 배분안에서 **한도가 걸린다는 것이 증명되는가.**
 *
 * D40 — 추정 한도는 상한이므로 그것이 자르면 실제 한도도 반드시 자른다. 반대는 성립하지
 * 않는다. **자르지 않았다는 사실은 「걸리지 않는다」를 뜻하지 않는다.** 화면이 그 반대
 * 진술("한도에 걸리지 않았습니다"·"여유가 있습니다")을 적으면 거짓이 될 수 있으므로,
 * 두 상태를 값으로 갈라 낸다.
 */
export const CAP_BINDING = {
  PROVABLE: 'binds_provably',
  NOT_DETERMINED: 'binding_not_determined',
};

/**
 * 원 미만 끝수를 없애는 **단계의 이름**과 그 자리에서 하는 **연산의 이름** (D46 1번).
 *
 * 정의 자리는 룰셋이다 — `tax.rounding.won_fraction`의 `engine_contract`가
 * `stage_codes`·`operation_codes`를 값으로 선언한다. 여기 있는 것은 **전사**이고 두 목록이
 * 갈라지면 `ruleset-driven.test.mjs`가 실패한다.
 *
 * **왜 이름만은 코드에 있어야 하는가.** 엔진은 「지금 어느 단계에 서 있는가」를 스스로
 * 알아야 한다 — 과세표준을 구하는 자리인지, 화면에 실을 금액을 만드는 자리인지는 코드의
 * 구조이지 데이터가 정해 줄 수 있는 것이 아니다. **대신 연산과 단위는 한 개도 여기 없다.**
 * 무엇을 버리는지(`floor`/`none`)와 얼마 단위로 버리는지(`unit_krw`)는 전부 룰셋에서
 * 읽는다. 「1원」도 「10원」도 이 파일에 없다 — 그 둘은 조문이 정한 세법 수치다.
 */
export const ROUNDING_STAGE = {
  /** §47② — 국세의 과세표준액. **조문이 지목한 자리다.** */
  TAX_BASE: 'tax_base',
  /** §47① — 국고금의 수입·지출. 조문이 지목했으나 **우리 출력은 여기가 아니다.** */
  TREASURY: 'treasury_receipt_or_payment',
  /** 조문이 지목하지 않은 계산 중간값. 규약으로 절사하지 않는다. */
  INTERMEDIATE: 'intermediate_amount',
  /** 참·거짓을 내는 자리. 규약으로 정확값끼리 비교한다. */
  COMPARISON: 'comparison',
  /** 응답에 정수 원으로 실리는 금액. 규약으로 마지막에 한 번 버린다. */
  DISPLAYED: 'displayed_amount',
};

export const ROUNDING_STAGES = Object.values(ROUNDING_STAGE);

/** 엔진이 실제로 할 줄 아는 연산. 룰셋이 다른 이름을 적으면 지어내지 않고 멈춘다. */
export const ROUNDING_OP = {
  FLOOR: 'floor',
  NONE: 'none',
};

export const ROUNDING_OPS = Object.values(ROUNDING_OP);

/**
 * 공제율 구간을 **무엇으로** 판정했는가.
 *
 * `pension.credit.rate.basis_determination`이 정한다 — 본문 기준은 종합소득금액이고
 * 총급여액은 '근로소득만 있는 경우'에만 쓰는 **조건부 대체 기준**이다. 두 기준은
 * 유리한 쪽을 고를 수 있는 관계가 아니고, 총급여액을 종합소득금액으로 환산하는 것도
 * 아니다(환산하면 소괄호가 더 엄격한 구간에서 틀린다).
 */
export const CREDIT_RATE_BASIS = {
  /** 근로소득 외에 합산되는 소득이 없다고 답했다 → 총급여액으로 판정 */
  TOTAL_SALARY: 'total_salary',
  /** 합산되는 다른 소득이 있다고 답했고 금액도 받았다 → 종합소득금액으로 판정 */
  GLOBAL_INCOME: 'global_income',
  /** 금액을 모른다 → 대괄호 안의 예외를 적용하지 않고 본문 구간을 쓴다 */
  STATUTORY_DEFAULT: 'statutory_default',
};

/**
 * 본문 구간을 대체값으로 적용했을 때 결과가 어느 쪽으로 틀리는가.
 * 예외(우대 구간)를 적용하지 않은 것이므로 공제액은 과소이거나 같다.
 */
export const CREDIT_RATE_FALLBACK_DIRECTION = 'understated_or_equal';

/**
 * ISA 수익의 **성격** — 자산군이 아니라 "수익이 어떤 형태로 들어오는가"다(D29 1절).
 *
 * **이 목록은 계약이 고정하는 문자열이고, 각 값이 뜻하는 과세 비율 `s`는 룰셋이 정한다.**
 * `isa.benefit.income_character`의 `what_to_ask_instead.options[].s_range`가 그 자리이고,
 * 엔진은 그 문자열을 읽어 구간을 만든다 — 여기에 비율을 적으면 세법 수치가 코드에 박힌다.
 * 두 목록이 어긋나는 것은 `ruleset-driven.test.mjs`가 본다.
 */
export const ISA_INCOME_CHARACTER = {
  /** 이자·분배금·배당처럼 **받는 형태**로 들어온다 */
  INTEREST_DIVIDEND: 'interest_dividend',
  /** 국내 상장주식의 가격 상승으로 들어온다 */
  LISTED_EQUITY_CAPITAL_GAIN: 'listed_equity_capital_gain',
  /** 섞여 있거나 아직 정하지 않았다. `fund_use_horizon`의 `unknown`과 같은 이유로 둔다 */
  MIXED_OR_UNKNOWN: 'mixed_or_unknown',
};

export const ISA_INCOME_CHARACTERS = Object.values(ISA_INCOME_CHARACTER);

/**
 * 가정 기반 ISA 정산액의 상태. `prior_year_tax.state`와 같은 형태다 —
 * **`null` 하나로 "묻지 않았다"와 "물었으나 낼 수 없다"와 "표시를 껐다"를 뭉치지 않는다.**
 */
export const ISA_ESTIMATE_STATE = {
  COMPUTED: 'computed',
  /** D31 — 계산과 입력은 그대로 두고 **표시만** 끈 상태. 금액이 전부 `null`이 된다 */
  DISPLAY_SUPPRESSED: 'display_suppressed',
  NOT_COMPUTABLE: 'not_computable',
};

/** 표시 스위치. 호스트가 정한다 — 엔진이 규제 판단을 지어내지 않는다(D31). */
export const ISA_ESTIMATE_DISPLAY = { INCLUDE: 'include', SUPPRESS: 'suppress' };
export const ISA_ESTIMATE_DISPLAYS = Object.values(ISA_ESTIMATE_DISPLAY);

/** 금액을 낼 수 없는 이유. **모르는 것을 0으로 적지 않기 위한 자리다.** */
export const ISA_ESTIMATE_NOT_COMPUTABLE = {
  /** ISA 유형 미선언 → 비과세 한도금액 `C`를 모른다 */
  TAX_FREE_LIMIT_UNKNOWN: 'isa_tax_free_limit_unknown',
  /** 입력이 커서 정수 연산으로 값을 낼 수 없다. 추정하지 않고 멈춘다 */
  AMOUNT_NOT_REPRESENTABLE: 'amount_not_representable',
};

/** 가정 기반 ISA 정산액에 붙는 고정 코드. 세법 수치가 아니라 이름이다. */
export const ISA_ESTIMATE = {
  /** 원금을 무엇으로 보았는가 — 누적 납입액 + 이 배분안의 ISA 배분액 */
  PRINCIPAL_BASIS: 'cumulative_contribution_plus_plan_allocation',
  /** 수익률에서 총수익을 만드는 방법. 복리·단리는 세법이 정하지 않고 단리가 과소 방향이다 */
  RETURN_ACCRUAL: 'simple_interest',
  /** 비교 기준 — 원천징수로 종결되는 경우(case A) */
  COMPARISON_BASELINE: 'withholding_at_general_rate',
  SETTLEMENT_SOURCE_USER: 'user',
  SETTLEMENT_SOURCE_RULESET: 'ruleset_min_contract_years',
};

/**
 * 세 축 금액이 **점인가 구간의 위 끝인가**(D36, tax-rules-report 23.3절).
 *
 * `IsaAxisBreakdown`은 `upper_bound_krw`의 분해다. 소득 성격이 확정적이지 않으면
 * 세 축 금액도 전부 위 끝이고, 그것을 점처럼 적으면 실제보다 크게 말하는 것이 된다.
 * **화면이 `point_estimate_krw === null`로 이 판단을 스스로 하게 두면 세법 판단이
 * 화면 코드로 샌다** — 그래서 값으로 낸다.
 */
export const AXIS_BOUND = { POINT: 'point', UPPER_BOUND: 'upper_bound' };

/**
 * 세율차 축이 0인 것이 **결핍이 아니라 더 유리한 사실**임을 말하는 코드(D36).
 *
 * 계약기간 순소득이 비과세 한도를 넘지 않으면 초과분이 없어 이 축이 정확히 0이다.
 * 그 0의 뜻은 "저율 분리과세 혜택이 없다"가 아니라 **"9%가 아니라 0%로 과세되고 있다"**이다.
 *
 * **`rate_gap_krw === 0`으로 이 상태를 판정하면 안 된다.** 초과분이 있어도 그것이 아주
 * 작으면 원 미만 절사로 0이 나오는 좌표가 실재하고(순소득이 한도를 근소하게 넘는 구간),
 * 그 0은 여기 해당하지 않는다. 판정 축은 **순소득과 비과세 한도의 비교** 하나다.
 */
export const RATE_GAP_ZERO_REASON = { WITHIN_TAX_FREE_LIMIT: 'within_tax_free_limit' };

/**
 * 헤드라인 합계가 **점인가 구간인가**(D38, `benefit.headline.composite_total`).
 *
 * **`AXIS_BOUND`와 다른 집합이고 다른 것을 가린다.** 저쪽은 「세 축 금액이 점인가 위
 * 끝인가」이고 이쪽은 「합계를 한 수로 적는가 두 끝으로 적는가」다. 값 이름도 `range`로
 * 달리 둔다 — 같은 낱말을 쓰면 화면이 한쪽 코드로 다른 쪽을 판정하게 된다.
 *
 * **화면이 `point_estimate_krw === null`로 이 판단을 대신하게 두지 않는다.** 규칙이
 * `requested_contract_fields`에서 이 칸을 이름으로 요청했고, 그 이유가 「합계가 점인가
 * 구간인가라는 세법 판단이 화면 코드로 새는 것」이다.
 */
export const HEADLINE_TOTAL_BOUND = { POINT: 'point', RANGE: 'range' };

/**
 * 헤드라인 합계의 **확정 성분이 재는 기간**. `PensionCreditCeiling.period_code`와 같은 값이고
 * 같은 이유로 상수다 — 그 성분에만 「올해」를 붙일 수 있다.
 *
 * **합계 자체에는 어느 기간도 붙지 않는다.** 두 성분의 단위 기간이 달라 합계에 기간
 * 이름을 붙이면 그 줄이 틀린 수가 되기 때문이고, 그 사실은 `is_annual: false`가 진다.
 */
export const HEADLINE_DETERMINED_PERIOD = 'current_tax_year';

/**
 * 비과세 축 상한이 재는 기간(D38 6번, `isa.benefit.axis_ceiling`).
 *
 * **계약 1건당이고 해마다 반복되지 않는다** — 기준 시점이 「가입일 또는 연장일」이기
 * 때문이다. 옆에 놓이는 세액공제 축은 연간 값이므로, 기간이 값으로 나가지 않으면
 * 화면이 두 축을 나란히 둔 배치 때문에 이 값도 연간으로 읽힌다.
 */
export const AXIS_CEILING_PERIOD = 'contract_settlement_period';

/**
 * 확정 축(세액공제)의 최댓값을 만든 공제율이 어디서 왔는가(D36).
 * 개정안 시나리오의 청년 우대가 본문 구간보다 높으면 그쪽이 상한을 정한다 —
 * 그 우대에는 계좌 단독 한도가 걸리지 않아 합산 한도 전액을 그 율로 채울 수 있다.
 */
export const CEILING_RATE_SOURCE = {
  CREDIT_RATE_BRACKET: 'credit_rate_bracket',
  PROPOSED_YOUTH_IRP_RATE: 'proposed_youth_irp_rate',
};

/**
 * 산출세액 한도가 이 상한에 걸리는가.
 *
 * **걸려도 상한 자체는 내려가지 않는다**(engine-design.md 9.2절). 한도는 축의 눈금이
 * 아니라 그 사람이 실제로 받는 금액을 자르는 것이고, 축을 한도로 줄이면 잘린 몫이
 * 그림에서 사라진다. 대신 걸리는지를 코드로 낸다.
 */
export const CEILING_CAP_RELATION = {
  AT_OR_ABOVE: 'cap_at_or_above_ceiling',
  BELOW: 'cap_below_ceiling',
};

/** 확정 축이 재는 기간. ISA 가정 축의 「계약기간」과 뭉개지 않기 위한 자리다(D36). */
export const CEILING_PERIOD = 'current_tax_year';

/** 이 상한이 무엇인지. 화면이 캡션에 그 뜻을 적을 때 쓰는 안정적 이름이다(D36). */
export const CEILING_MEANING = 'full_pension_combined_credit_limit_at_this_persons_rate';

/**
 * 연금계좌 저율과세 — **금액이 아니라 세율만** 낸다(D36).
 *
 * `0`으로 적으면 "계산했더니 0이었다"가 되고 그것은 사실이 아니다. 계산 자체를 하지
 * 않았고 할 수도 없다(`pension.rate_gap.quantifiability`). 그 사실을 코드로 낸다.
 */
export const PENSION_RATE_GAP_COMPUTABILITY = 'not_computable_by_design';

/** 인출 갈래. 세율표의 행을 묶는 축이고 세법 수치가 아니라 이름이다. */
export const WITHDRAWAL_BRANCH = {
  ANNUITY_WITHIN_THRESHOLD: 'annuity_within_threshold',
  ANNUITY_OVER_THRESHOLD: 'annuity_over_threshold',
  NON_ANNUITY: 'non_annuity',
  ANY: 'any',
};

/** 계좌 밖 세율에서 계좌 안 세율을 뺀 값의 **부호**. 산술로 정해지고 해석이 없다. */
export const RATE_GAP_SIGN = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  CROSSES_ZERO: 'crosses_zero',
  NOT_DETERMINED: 'not_determined',
};

/** 개시 가능 시점을 계산하지 못한 이유. */
export const START_DATE_REASON = {
  OPENED_ON_MISSING: 'opened_on_missing',
};

export const MONTHS_IN_TAX_YEAR = 12;

/**
 * 월 환산에서 잔차를 얹는 갈래. 세 계좌 밖에 하나가 더 있다 — **미배분**이다.
 * 어느 계좌에도 들어가지 않는 돈이라 납입 한도가 걸릴 자리가 없고, 그래서 한도 검사 없이
 * 잔차를 받을 수 있다(`monthly.mjs` 머리말).
 */
export const MONTHLY_BUCKET = { UNALLOCATED: 'unallocated' };

/** 월 환산 잔차를 나눠 담는 한도 풀. 두 연금계좌가 납입 한도를 공유한다는 사실의 표현이다. */
export const HEADROOM_POOL = { PENSION: 'pension', ISA: 'isa' };

/**
 * 월 표시 금액의 합이 월 납입 여력에 못 미치는 이유.
 *
 * **값이 하나뿐인 것은 갈래가 하나뿐이기 때문이다.** 잔차를 얹을 수 있는 곳은 납입 한도
 * 여유가 남은 계좌와 미배분 둘인데, 둘 다 없으면 남는 이유는 「어느 계좌도 1원을 더
 * 받을 수 없다」 하나다.
 */
export const MONTHLY_UNASSIGNED_REASON = {
  NO_DESTINATION_WITHIN_CONTRIBUTION_LIMIT: 'no_destination_within_contribution_limit',
};

/**
 * 룰셋 어휘. 세법 수치가 아니라 data/tax-rules/ 파일이 스스로 쓰는 status 값이고
 * scripts/org/validate-rules.mjs가 같은 목록을 강제한다.
 */
export const RULESET_STATUS = { CONFIRMED: '확정', PROPOSED: '개정예고' };

/**
 * 룰셋이 계좌를 가리킬 때 쓰는 이름. 이것도 룰셋 어휘이지 세법 수치가 아니다.
 * 여러 규칙의 `conditions`와 `value.by_account`가 이 표기를 쓴다.
 */
export const ACCOUNT_TYPE_IN_RULESET = {
  [ACCOUNT.ANNUITY]: '연금저축계좌',
  [ACCOUNT.PENSION]: '퇴직연금계좌',
};

/** 엔진이 참조하는 규칙 id. 문자열일 뿐 수치가 아니다. */
export const RULE = {
  CREDIT_RATE: 'pension.credit.rate',
  // 10차 조사(D27). 12%/15% 구간을 **무엇으로** 판정하는지를 정하는 규칙이다.
  // 값(비율)은 CREDIT_RATE가 주고, 이 규칙은 그 값을 고르는 축과 순서를 준다.
  CREDIT_RATE_BASIS: 'pension.credit.rate.basis_determination',
  CREDIT_LIMIT_ANNUITY: 'pension.credit.limit.annuity_savings',
  CREDIT_LIMIT_COMBINED: 'pension.credit.limit.combined',
  CREDIT_TRANSFER_EXTRA: 'pension.credit.isa_transfer.extra_limit',
  PENSION_CONTRIBUTION_LIMIT: 'pension.contribution.annual_limit',
  PENSION_WITHDRAWAL_ELIGIBILITY: 'pension.withdrawal.eligibility',
  PENSION_EARLY_WITHDRAWAL_RATE: 'pension.early_withdrawal.other_income_rate',
  PENSION_MIDTERM_RESTRICTION: 'pension.withdrawal.midterm_restriction',
  ISA_ELIGIBILITY: 'isa.eligibility',
  ISA_EXCLUSION_FINANCIAL: 'isa.exclusion.financial_income_taxpayer',
  ISA_TAX_FREE_LIMIT: 'isa.tax_free_limit',
  ISA_EXCESS_RATE: 'isa.excess.separate_tax_rate',
  ISA_LOSS_OFFSET: 'isa.net_income.loss_offset',
  ISA_ACCOUNT_REQUIREMENTS: 'isa.account.requirements',
  ISA_ANNUAL_LIMIT: 'isa.contribution.annual_limit',
  ISA_CLAWBACK: 'isa.early_termination.clawback',
  LOCAL_SURTAX: 'tax.local.personal_income_surtax',

  // 11차 조사(D28·D29). 수익률을 입력으로 받은 뒤 **무엇을 곱하는가**를 정하는 규칙군.
  // 배분 금액과 세액공제액은 한 원도 바꾸지 않는다 — echo.isa_return_affects가 그 선언이다.
  ISA_BENEFIT_FORMULA: 'isa.benefit.formula',
  ISA_BENEFIT_SETTLEMENT_PERIOD: 'isa.benefit.settlement_period',
  ISA_BENEFIT_INCOME_CHARACTER: 'isa.benefit.income_character',
  ISA_BENEFIT_QUANTIFICATION: 'isa.benefit.quantification',
  PENSION_TAX_DEFERRAL_WITH_RETURN: 'pension.tax_deferral.with_return_rate',

  // 18차 조사(D38). 헤드라인 합계가 **어떤 형태일 때 거짓이 아닌가**를 정하는 규칙과,
  // 축마다 상한의 유무가 다르다는 판정. 배분 금액도 세액공제액도 한 원 바꾸지 않는다.
  BENEFIT_HEADLINE_COMPOSITE_TOTAL: 'benefit.headline.composite_total',
  ISA_BENEFIT_AXIS_CEILING: 'isa.benefit.axis_ceiling',

  // 17차 조사(D36). **금액이 아니라 세율만** 내는 규칙군. 연금계좌 저율과세를 막대에
  // 올릴 수 없다는 판정과, 그 대신 낼 수 있는 것(조문 그대로의 세율표)이 여기 있다.
  PENSION_RATE_GAP_QUANTIFIABILITY: 'pension.rate_gap.quantifiability',
  // 위 표가 옮겨 적은 원 규칙들. **값을 옮겨 쓰는 것이 아니라 대조한다** —
  // 전사가 낡으면 조용히 어긋나므로, 세율 집합이 같은지 확인하고 그 사실로 근거를 삼는다.
  PENSION_INCOME_RATE_BY_AGE: 'pension.income.withholding_rate.by_age',
  PENSION_INCOME_RATE_LIFETIME: 'pension.income.withholding_rate.lifetime_annuity',
  PENSION_SEPARATE_TAXATION_THRESHOLD: 'pension.income.separate_taxation.threshold',
  PENSION_SEPARATE_TAXATION_ELECTIVE: 'pension.income.separate_taxation.elective_rate',

  // 6차 조사(tax-rules-report.md 13절)로 들어온 확정 규칙 6건.
  CREDIT_TAX_CAP: 'pension.credit.tax_liability_cap',
  CREDIT_TAX_CAP_SOURCE: 'pension.credit.tax_liability_cap.source_form',
  CREDIT_UNUSED_CARRYOVER: 'pension.credit.unused.contribution_carryover',

  // 19차 조사(D39·D40). 직전 과세연도 결정세액 입력이 사라진 자리를 대체하는 규칙과,
  // 그 계산이 밟는 네 조문. **값은 상한이고 하한은 존재하지 않는다.**
  CREDIT_TAX_CAP_ESTIMATE: 'pension.credit.tax_liability_cap.current_year_estimate',
  WAGE_INCOME_DEDUCTION: 'income.wage.deduction',
  BASIC_DEDUCTION_SELF: 'income.deduction.basic.self',
  BASIC_TAX_RATE: 'tax.rate.basic',
  WAGE_INCOME_CREDIT: 'credit.wage_income',

  // 20차 조사(D46 1번). **원 미만 끝수를 어느 단계에서 어떻게 없애는가.**
  // 조문(국고금 관리법 §47)이 지목한 단계와 이 조직이 규약으로 정한 단계가
  // 한 규칙 안에서 `determined_by_law`로 갈려 있다.
  ROUNDING_WON_FRACTION: 'tax.rounding.won_fraction',

  // 9차 조사(D26). 세액공제 한도를 넘는 연금계좌 납입의 세법상 취급과
  // 그 원금이 인출될 때의 과세. 배분 금액을 바꾸지 않고 **사실**만 준다.
  PENSION_BEYOND_CREDIT_LIMIT: 'pension.contribution.beyond_credit_limit',
  PENSION_NON_DEDUCTED_PRINCIPAL: 'pension.withdrawal.non_deducted_principal',

  // 19차 조사(D44). **사람 쪽 자격** 규칙 셋. 계좌를 열 수 있는가와 그 납입액으로
  // 공제를 받을 수 있는가는 다른 물음이고 다른 법이 정한다 — 두 자격이 어긋나는
  // 자리가 넷이라 화면이 둘을 섞으면 한쪽이 거짓이 된다.
  IRP_ELIGIBILITY: 'irp.eligibility',
  PENSION_SAVINGS_ELIGIBILITY: 'pension_savings.eligibility',
  CREDIT_TAXPAYER_ELIGIBILITY: 'pension.credit.taxpayer_eligibility',

  CREDIT_EXCLUDED_CONTRIBUTIONS: 'pension.credit.excluded_contributions',
  CONTRIBUTION_AFTER_ANNUITY_START: 'pension.contribution.after_annuity_start',
  PENSION_EARLIEST_START: 'pension.withdrawal.earliest_start',

  // 7차 조사로 들어온 규칙. **값이 아니라 판정 시점을 주는 규칙이고, 그 내용은
  // "단일 기준일은 존재하지 않는다"이다.** 엔진은 이 규칙을 읽어 (a) 기준일이
  // 룰셋에서 나오지 않는다는 사실의 근거로 삼고, (b) 어느 요건이 실제로 기준일을
  // 필요로 하는지를 응답에 싣는다.
  AGE_RECKONING: 'age.reckoning.reference_date',

  PROPOSED_ISA_ANNUAL_LIMIT: 'proposed.isa.annual_contribution_limit',
  PROPOSED_YOUTH_IRP_RATE: 'proposed.pension.credit.youth_irp_rate',
  PROPOSED_TRANSFER_EXTRA: 'proposed.productive_isa.pension_transfer.credit_extra_limit',
};

/**
 * 확정 규칙 ↔ 개정예고 규칙의 대응표 (engine-design.md 5.3절).
 * 룰셋에 supersedes 필드가 없어 엔진이 들고 있는 것이고, **세법 수치는 없다.**
 * 각 쌍은 룰셋이 스스로 적어 둔 상호 참조에서만 도출했다:
 *  - PROPOSED_ISA_ANNUAL_LIMIT.value.current_text / engine_note
 *  - PROPOSED_YOUTH_IRP_RATE.value.contrast_with_current
 *  - PROPOSED_TRANSFER_EXTRA.value.related_confirmed_rule
 */
export const PROPOSED_SUPERSEDES = {
  [RULE.PROPOSED_ISA_ANNUAL_LIMIT]: RULE.ISA_ANNUAL_LIMIT,
  [RULE.PROPOSED_YOUTH_IRP_RATE]: RULE.CREDIT_RATE,
  [RULE.PROPOSED_TRANSFER_EXTRA]: RULE.CREDIT_TRANSFER_EXTRA,
};

/**
 * 개정안 시나리오에서 반영하지 않는 규칙의 사유.
 * 목록에 없는 개정예고 규칙은 out_of_product_scope로 본다 — 새 규칙이 조용히
 * 사라지지 않고 출력에 드러나게 하기 위해서다.
 */
export const UNAPPLIED_REASON = {
  'proposed.productive_isa.youth_income_deduction': 'requires_rule_not_in_ruleset',
  'proposed.isa.contract_period': 'affects_multi_year_only',
  'proposed.isa.sunset': 'affects_multi_year_only',
};

export const DEFAULT_UNAPPLIED_REASON = 'out_of_product_scope';
export const REASON_INPUT_MISSING = 'requires_input_not_collected';

/**
 * **모든 안이 3단계(연금 납입 한도 몫)를 갖게 되면서 함께 실려야 하는 근거**(D32).
 *
 * 그 몫은 올해의 세액공제를 낳지 않으므로 **세액공제 규칙이 그 몫의 근거가 될 수 없다.**
 * 근거로 서는 것은 셋이다 — 얼마까지 넣을 수 있는가(`annual_limit`), 넘겨 넣은 돈이
 * 세법상 어떻게 되는가(`beyond_credit_limit`), 그리고 두 연금계좌 중 어디에 먼저 넣는가
 * (`midterm_restriction`). **`priority_basis.code`는 이 몫을 말하지 않는다** — 코드는
 * 그 안이 **첫째로** 무엇을 앞세우는지의 이름이고, 소유자가 배분을 정했다고 해서 그 이름이
 * "유리하다"로 바뀌지 않는다(D32). 근거가 실제 근거를 말하는 자리는 이 목록이다.
 */
const PENSION_EXTRA_BASIS = [
  RULE.PENSION_CONTRIBUTION_LIMIT,
  RULE.PENSION_BEYOND_CREDIT_LIMIT,
  RULE.PENSION_MIDTERM_RESTRICTION,
];

export const PRIORITY_BASIS = {
  [PLAN.MAX_CREDIT]: {
    code: 'tax_credit_maximization',
    basis_rule_ids: [RULE.CREDIT_LIMIT_ANNUITY, RULE.CREDIT_LIMIT_COMBINED, ...PENSION_EXTRA_BASIS],
  },
  [PLAN.ANNUITY_FIRST]: {
    code: 'annuity_savings_limit_first',
    basis_rule_ids: [RULE.CREDIT_LIMIT_ANNUITY, ...PENSION_EXTRA_BASIS],
  },
  [PLAN.ISA_FIRST]: {
    code: 'isa_liquidity_first',
    basis_rule_ids: [
      RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
      RULE.PENSION_EARLY_WITHDRAWAL_RATE,
      ...PENSION_EXTRA_BASIS,
    ],
  },
  // **이름이 세액공제를 말하지 않는다.** D17·tie_break 때 세운 "이름이 실제 근거를
  // 말해야 한다"의 연장이다 — 이 안이 앞세우는 것은 ISA보다 먼저 채우는 연금 납입이고,
  // 그 선후가 유리한지는 세법이 정하지 않는다(규칙의 not_determined_by_tax_law).
  [PLAN.PENSION_BEFORE_ISA]: {
    code: 'pension_contribution_limit_before_isa',
    basis_rule_ids: [...PENSION_EXTRA_BASIS],
  },
};

/** engine-design.md 3.1절 — 기본안은 자금 사용 시점이 정한다. */
export const BASELINE_BY_HORIZON = {
  [HORIZON.AT_OR_AFTER_PENSION_AGE]: PLAN.MAX_CREDIT,
  [HORIZON.UNKNOWN]: PLAN.MAX_CREDIT,
  [HORIZON.BEFORE_PENSION_AGE]: PLAN.ISA_FIRST,
  // 세 계좌 모두 불이익이 걸려 어느 안도 피하지 못한다. 순서로 푼 척하지 않는다.
  // **D52 2번 이후로 이 자리에서는 어느 안도 금액을 내지 않는다** — 전액 미배분이므로
  // 네 안의 벡터가 같아지고 하나로 합쳐진다. 그때 남는 것이 이 값이다.
  [HORIZON.WITHIN_ISA_LOCK_IN]: PLAN.MAX_CREDIT,
};

/**
 * **아무것도 낳지 않는 IRP 배분을 내지 않는 안**(D52 1번).
 *
 * 소유자가 지적한 것은 이것이다 — 세액 한도가 이미 다 찼는데 IRP를 더 채우면
 * **세액공제를 한 원도 더 낳지 않으면서 중도인출 제한만 진다**
 * (`pension.withdrawal.midterm_restriction` — 연금저축은 그 제한을 받지 않는다).
 * 얻는 것이 0이고 잃는 것이 0보다 크므로 **엄격하게 나쁘다.**
 *
 * **연금저축에는 걸지 않는다.** 공제를 낳지 않아도 과세이연과 인출 자유가 남고,
 * §61③이 초과분을 「받지 아니한 것으로」 보아 시행령 §118의3의 이월 전환 신청을
 * 예정한다. 두 계좌를 가르는 것은 세법이 실제로 가르는 축(중도인출 제한)뿐이다.
 *
 * **왜 「기본안」이 아니라 이 집합인가.** 소유자 지시는 「기본안에서 내지 않는다」이고
 * 기본안은 `BASELINE_BY_HORIZON`이 자금 사용 시점으로 고른다. 그런데 「기본안일 때만」
 * 잘라 내면 **같은 안의 금액이 자금 사용 시점에 따라 달라진다** — 그 축은 D52 2번
 * 하나로 충분하고, 여기까지 번지면 어느 변경이 금액을 움직였는지 갈라 볼 수 없게 된다.
 * 그래서 **기본안이 될 수 있는 안 전부**에 건다. 이 집합은 그 표에서 파생되므로
 * 기본안 표가 바뀌면 함께 움직인다 — 두 곳에 적어 어긋날 자리를 만들지 않는다.
 *
 * 여기 없는 안(`annuity_savings_first`·`pension_contribution_before_isa`)은 **그대로 둔다.**
 * 사용자가 다른 목적으로 고를 수 있고, 기본안이 그것을 앞세우지 않는 것이 이 변경이다.
 */
export const IRP_CREDIT_PRODUCTIVE_ONLY_PLANS = new Set(Object.values(BASELINE_BY_HORIZON));

export const ERROR = {
  SCHEMA_VERSION_MISMATCH: 'schema_version_mismatch',
  MISSING_REQUIRED: 'missing_required',
  NOT_INTEGER: 'not_integer',
  NEGATIVE_VALUE: 'negative_value',
  OUT_OF_RANGE: 'out_of_range',
  INVALID_ENUM: 'invalid_enum',
  INVALID_DATE: 'invalid_date',
  ISA_TRANSFER_EXCEEDS_CUMULATIVE: 'isa_transfer_exceeds_cumulative',
  ISA_YTD_EXCEEDS_CUMULATIVE: 'isa_ytd_exceeds_cumulative',
  EMPTY_SCENARIOS: 'empty_scenarios',
  UNKNOWN_SCENARIO: 'unknown_scenario',
  UNKNOWN_PLAN_VARIANT: 'unknown_plan_variant',
  RULESET_LOAD_FAILED: 'ruleset_load_failed',
  RULE_MISSING: 'rule_missing',
};

export const NOTICE = {
  ZERO_CAPACITY: 'zero_capacity',
  BUDGET_EXCEEDS_ALL_LIMITS: 'budget_exceeds_all_limits',
  EXISTING_OVER_LIMIT: 'existing_contribution_over_limit',
  PRIOR_YEAR_INCOME_MISSING: 'prior_year_income_missing',
  ISA_TYPE_CONFLICT: 'isa_type_conflicts_with_prior_income',
  ISA_TYPE_CROSS_CHECK_INCONCLUSIVE: 'isa_type_cross_check_inconclusive',
  CREDIT_RATE_GLOBAL_INCOME_MISSING: 'credit_rate_global_income_missing',
  ISA_TYPE_NOT_DECLARED: 'isa_type_not_declared',
  ISA_TENURE_MISSING: 'isa_tenure_missing',
  ISA_LOCK_IN_ELAPSED: 'isa_lock_in_already_elapsed',
  FINANCIAL_INCOME_UNKNOWN: 'financial_income_status_unknown',
  ISA_EXCLUDED_FINANCIAL: 'isa_excluded_financial_income_taxpayer',
  ISA_EXCLUDED_AGE: 'isa_excluded_age',
  PENSION_AGE_NOT_EVALUATED: 'pension_age_not_evaluated',

  // ── 사람 쪽 자격 (D44) ──
  // **두 코드가 다른 말을 한다.** 앞은 「열거 밖이라 설정할 수 없다」이고 뒤는
  // 「우리 입력으로는 갈리지 않는다」다. 뒤엣것을 「불가」로 옮겨 적으면 조문상 자격이
  // 있는 사업소득자를 스스로 드러나지 않는 방식으로 막게 된다.
  IRP_EXCLUDED_NO_QUALIFYING_STATUS: 'irp_excluded_no_qualifying_status',
  IRP_ELIGIBILITY_NOT_DETERMINED: 'irp_eligibility_not_determined',
  // 공제액 0의 **경로**를 가른다. 「산출세액이 0이라 잘렸다」가 아니라
  // 「종합소득이 없어 요건이 서지 않는다」다. 금액은 같고 문장이 다르다.
  PENSION_CREDIT_ZERO_NO_GLOBAL_INCOME: 'pension_credit_zero_no_global_income',
  YOUTH_NOT_DECLARED: 'youth_status_not_declared',
  YOUTH_AGE_UNDETERMINED: 'youth_age_range_undetermined',
  PROPOSED_TRANSFER_PERIOD_MISSING: 'proposed_transfer_cap_period_input_missing',
  PROPOSED_NOT_ENACTED: 'proposed_not_enacted',
  PLANS_COLLAPSED_SINGLE: 'plans_collapsed_single',
  HORIZON_NOT_DECLARED: 'fund_use_horizon_not_declared',
  PENSION_HOLDING_NOT_EVALUATED: 'pension_holding_period_not_evaluated',
  // **`tax_liability_cap_unknown`이 여기 있었다**(D39·D40에 폐기). 「모름」이라는 상태가
  // 사라졌으므로 그 코드가 뜻하던 것이 없다. 대체하는 것은 아래 둘이다 — 한도가 여전히
  // 추정값이라는 사실과, 그 추정의 방향이 정해지지 않은 분기가 하나 있다는 사실.
  TAX_CAP_ESTIMATED: 'tax_liability_cap_estimated_from_total_salary',
  TAX_CAP_DIRECTION_INDETERMINATE: 'tax_liability_cap_direction_indeterminate',
  TAX_CAP_ZERO: 'tax_liability_cap_zero',
  TAX_CAP_APPLIED: 'tax_liability_cap_applied',
  ANNUITY_STARTED: 'pension_contribution_blocked_annuity_started',
  ANNUITY_START_UNKNOWN: 'pension_annuity_start_unknown',
  PENSION_START_DATE_NOT_COMPUTABLE: 'pension_start_date_not_computable',
  RETIREMENT_TRANSFER_EXCLUDED: 'retirement_transfer_excluded_from_credit',

  // ── 수익률 기반 ISA 정산액 (D28·D29·D31) ──
  // **이름에 `benefit`을 쓰지 않는다.** 가정 위의 계산을 확정된 혜택과 같은 말로 부르면
  // 화면이 두 값을 같은 축에 놓는다(D29 4절). `tax-domain`이 제안한 코드 이름 둘
  // (`isa_benefit_is_not_annual`·`isa_benefit_reported_as_range`)을 같은 이유로 바꿨다.
  ISA_RETURN_NOT_SUPPLIED: 'isa_return_assumption_not_supplied',
  ISA_RETURN_ESTIMATE_NOT_ANNUAL: 'isa_return_estimate_is_not_annual',
  ISA_RETURN_ESTIMATE_RANGE: 'isa_return_estimate_reported_as_range',
  ISA_RETURN_ESTIMATE_NOT_COMPUTABLE: 'isa_return_estimate_not_computable',
  ISA_RETURN_ESTIMATE_SUPPRESSED: 'isa_return_estimate_display_suppressed',
  PENSION_TAX_DEFERRAL_NOT_QUANTIFIED: 'pension_tax_deferral_not_quantified',

  // ── D36 ──
  // 세율차 축의 0이 「혜택 없음」이 아니라는 사실. `tax-domain`이 이름까지 지정했다
  // (tax-rules-report 23.2절). 배분안 단위 판정은 같은 회차에 붙은
  // `assumption_based_isa_estimate.rate_gap_axis_zero_reason_code`가 낸다 —
  // 이 안내는 그것의 시나리오 단위 메아리다.
  ISA_RATE_GAP_AXIS_ZERO: 'isa_rate_gap_axis_zero_because_within_tax_free_limit',
};

export const COMPARISON_NOTE = {
  PLANS_COLLAPSED_SINGLE: 'plans_collapsed_single',
  ALL_ACCOUNTS_PENALTY: 'all_accounts_have_early_exit_penalty',
  BASELINE_REORDERED: 'baseline_reordered_by_fund_use_horizon',
  EQUAL_TAX_CREDIT: 'alternatives_have_equal_tax_credit',
  TAX_CREDIT_AXIS_FLAT: 'tax_credit_axis_not_discriminating',
};

export const WARNING = {
  PENSION_EARLY_WITHDRAWAL: 'early_withdrawal_penalty_pension',
  ISA_CLAWBACK: 'early_termination_clawback_isa',
};

export const ASSUMPTION = {
  MONTHS_DEFAULTED: 'months_remaining_defaulted',
  ISA_NEW_ACCOUNT: 'isa_new_account_assumed',
  ISA_TENURE_ZERO: 'isa_tenure_zero_assumed',
  OTHER_SAVINGS_ZERO: 'other_savings_zero_assumed',
  PRIOR_TRANSFER_CREDIT_ZERO: 'prior_transfer_credit_zero_assumed',
  SINGLE_TAX_YEAR: 'single_tax_year_only',
  OTHER_DEDUCTIONS_EXCLUDED: 'other_deductions_excluded',
  ROUNDING_FLOOR: 'rounding_floor_to_won',
  ISA_BENEFIT_NOT_QUANTIFIED: 'isa_benefit_not_quantified',
  HORIZON_EXCLUDED_FROM_AMOUNTS: 'fund_use_horizon_excluded_from_amounts',
  EARLY_EXIT_NOT_QUANTIFIED: 'early_exit_penalty_not_quantified',
  PENSION_HOLDING_NOT_EVALUATED: 'pension_holding_period_not_evaluated',
  // **이름이 낡았다.** 7차에 룰셋 규칙 `age.reckoning.reference_date`가 생겼으므로
  // "룰셋에 규칙이 없다"는 더는 사실이 아니다. 사실인 것은 **그 규칙이 기준일을
  // 하나로 정해 주지 않는다**는 것이고(단일 기준일은 존재하지 않는다), 그래서 엔진이
  // 고른 과세기간 종료일은 여전히 룰셋에서 나온 값이 아니다. 뜻은 계약 8.3절이
  // 정의하며 코드 문자열은 그대로 둔다 — 코드를 바꾸면 계약이 깨지고
  // `web-dev`가 `4.0.0`에 맞춰 구현 중인 화면이 낡는다(D22). 개명은 다음 회차에
  // 계산 기준일 입력과 함께 처리한다.
  AGE_REFERENCE_DATE: 'age_reference_date_not_in_ruleset',
  // **`prior_pension_credit_zero_assumed`가 여기 있었다**(D39에 폐기). 되더하기의
  // 가산항을 0으로 보던 가정인데, 되더할 입력 자체가 사라졌다.
  RETIREMENT_TRANSFER_IN_CONTRIBUTION_LIMIT: 'retirement_transfer_counted_in_contribution_limit',
  DEFERRED_RETIREMENT_INCOME_ABSENT: 'deferred_retirement_income_absent_assumed',
  LOCAL_TAX_FOLLOWS_CAP: 'local_tax_follows_income_tax_cap',
  // 규칙의 open_interpretation이 미확정으로 남긴 쟁점. 1단계 질문을 "합산되는 소득이
  // 있는가"로 좁혀 물으면 분리과세로 종결된 소득만 더 있는 사람이 총급여 기준으로
  // 가게 되고, 그것은 reading_b를 채택한 것이 된다. 조문이 정한 것처럼 표시하지 않는다.
  CREDIT_RATE_WAGE_ONLY_READING: 'credit_rate_wage_only_excludes_separately_taxed_income',

  // ── 수익률 기반 ISA 정산액이 서 있는 가정들 (D28 지켜야 할 선 ②·③) ──
  // 이 값은 조문이 정한 금액이 아니라 **사용자가 준 가정 위의 계산**이고,
  // 그 가정이 금액과 같은 화면에 붙어야 한다. 코드마다 무엇을 가정했는지는 계약 8.3절이 정의한다.
  ISA_RETURN_RATE_USER_SUPPLIED: 'isa_return_rate_user_supplied',
  ISA_RETURN_SIMPLE_INTEREST: 'isa_return_simple_interest',
  ISA_RETURN_PRINCIPAL_FROM_CONTRIBUTIONS: 'isa_return_principal_from_contributions',
  ISA_SETTLEMENT_YEARS_DEFAULTED: 'isa_settlement_years_defaulted_to_min_contract_years',
  ISA_LOSS_ZERO: 'isa_loss_assumed_zero',
  ISA_COMPARISON_BASELINE_WITHHOLDING: 'isa_comparison_baseline_is_withholding_only',
  ISA_RETURN_HELD_TO_SETTLEMENT: 'isa_return_assumes_contract_held_to_settlement',
};

/**
 * 그 계좌의 배분을 **마지막에 실제로 막은 것**.
 *
 * **D32에서 `credit_limit`이 사라졌다.** 이제 어떤 안도 세액공제 대상 한도에서 멈추지
 * 않고 납입 한도까지 간다 — 공제 한도는 어느 계좌의 상한도 아니게 되었고, 그런데도
 * `credit_limit`을 남겨 두면 **아무 입력에서도 나오지 않는 값**이 계약에 남는다. 화면은
 * 결코 실행되지 않는 갈래를 만들고, `qa`는 그 갈래가 설계상 죽은 것인지 결함으로 죽은
 * 것인지 가릴 수 없다.
 *
 * **그 사실이 사라지는 것은 아니다.** "공제 한도를 넘겨 넣은 몫이 있다"는
 * `pension_combined_credit_remaining_after_plan_krw`(배분 후 잔여 공제 한도)와
 * `pension_contribution_without_credit` 효과가 말한다 — 자리를 옮긴 것이지 잃은 것이 아니다.
 */
export const LIMITED_BY = {
  BUDGET: 'budget',
  CONTRIBUTION_LIMIT: 'contribution_limit',
  NOT_ELIGIBLE: 'not_eligible',
  /**
   * **`12.0.0` 신규 (D52 1번).** 더 넣어도 **표시되는 세액공제액이 한 원도 늘지 않아**
   * 거기서 멈췄다. **`13.0.0`에서 기준이 정확값에서 표시 금액으로 옮겨졌다**(D53 2번) —
   * 세액 한도에 소수부가 있으면 정확값 기준은 어느 화면에도 안 나타나는 0.1원을
   * 「늘었다」로 센다.
   * `retirement_pension`에만, 그리고 `IRP_CREDIT_PRODUCTIVE_ONLY_PLANS`의 안에서만 나온다.
   *
   * **`credit_limit`의 부활이 아니다.** 옛 값은 「세액공제 대상 **한도**가 막았다」였고
   * 이 값은 「낼 세금이 모자라 그 납입이 공제를 못 낳는다」다 — 막는 것이 다르고, 그래서
   * 연금저축에는 이 값이 붙지 않는다(연금저축은 공제를 못 낳아도 계속 채운다).
   */
  NO_ADDITIONAL_CREDIT: 'no_additional_tax_credit',
  /**
   * **`12.0.0` 신규 (D52 2번).** 자금 사용 시점이 `within_isa_lock_in`이라 그 계좌를 비웠다.
   * 연금 두 계좌에는 언제나 붙고, **ISA에는 남은 의무가입기간이 있을 때만** 붙는다
   * (`13.0.0` · D53 1번 — 기간이 지났으면 추징 요건이 성립하지 않아 배분을 유지한다).
   * 자격이 없는 계좌는 `not_eligible`이 이긴다.
   */
  FUND_USE_HORIZON: 'fund_use_horizon',
};

/**
 * **미배분이 왜 미배분인가**(`UnallocatedBreakdown.reason_code`, `12.0.0` · D52 2번).
 *
 * **두 이유는 화면에서 다른 문장이 된다.** 앞은 「더 넣을 자리가 없다」이고 뒤는
 * 「자리는 있는데 그 시점에는 어느 계좌도 이롭지 않다」다. 지금까지 미배분은 앞의 뜻으로만
 * 쓰였고, 뒤의 뜻이 같은 이름으로 나가면 화면이 둘을 구별하지 못한다.
 */
export const UNALLOCATED_REASON = {
  CONTRIBUTION_ROOM_EXHAUSTED: 'contribution_room_exhausted',
  /**
   * **뒤엣값은 정말로 이로운 계좌가 하나도 없을 때만이다**(`13.0.0` · D53 1번).
   * 의무가입기간이 지난 ISA가 살아남아 실제로 돈을 받는 사용자에게 이 코드를 내면
   * 화면은 **방금 돈을 넣은 계좌를 가리키며 「이로운 계좌가 없습니다」**라고 말한다.
   */
  NO_ACCOUNT_BENEFICIAL: 'no_account_beneficial_within_fund_use_horizon',
};

/**
 * 세제상 동점일 때 순서를 무엇으로 깼는지. 이름이 거짓말하지 않게 하려고 둔다 —
 * `max_tax_credit`은 공제를 최대화하되, 동점 구간에서는 이 기준으로 순서를 정한다.
 */
export const TIE_BREAK = {
  WITHDRAWAL_FLEXIBILITY: 'withdrawal_flexibility_first',
  NOT_APPLICABLE: 'not_applicable',
};

export const NON_QUANTIFIED = {
  ISA_HEADROOM: 'isa_tax_free_headroom',
  REASON_RETURN_UNKNOWN: 'depends_on_investment_return_not_in_ruleset',
  // D26 — 세액공제를 낳지 않는 연금계좌 납입. 이 효과에 딸린 사실들은 문구가 아니라
  // `facts`로 나간다. 셋 중 하나라도 빠지면 화면 문장이 거짓이 된다.
  PENSION_WITHOUT_CREDIT: 'pension_contribution_without_credit',
  REASON_DEFERRAL_UNKNOWN: 'benefit_depends_on_return_horizon_and_withdrawal_form_not_in_ruleset',
};

/**
 * 근거 안의 불확실성 표시가 어떤 형태인가. `LegalBasisEntry.uncertainty_notes[].kind`.
 * **유무가 아니라 목록으로 내는 이유**는 계약 5.7절에 있다 — 불확실을 일부 해소하며
 * 표시 하나를 지우면, 유무만 보는 구조에서는 남은 불확실까지 조용히 사라진다.
 */
export const UNCERTAINTY_KIND = {
  /** 규칙이 `unverified` 키로 스스로 적어 둔 것 */
  UNVERIFIED: 'unverified',
  /** `confidence`가 `verified`가 아니다 */
  CONFIDENCE_NOT_VERIFIED: 'confidence_not_verified',
  /** 시행령 위임 등으로 값 자체가 비어 있다 */
  VALUE_ABSENT: 'value_absent',
  /** 본문에 '미확인'이라고 적혀 있다 */
  TEXT_MARKER: 'text_marker',
};
