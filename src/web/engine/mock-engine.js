/**
 * 엔진 목(mock) — `docs/stage-2-design/engine-interface.md` (schema_version 11.0.0)의
 * `compute` / `computeFundUseHorizonBoundaries` 계약을 그대로 구현한다.
 *
 * **왜 아직 있는가.** 실행 경로는 이미 실제 엔진(`src/engine/`)이다(`engine-client.js`).
 * 이 파일은 계약을 화면 쪽에서 어떻게 읽었는지를 남긴 대조 기준이고, **계약이
 * major로 오를 때 함께 오르지 않으면 그 순간 거짓말이 된다** — 목이 낡으면
 * 테스트가 통과해도 아무것도 증명하지 않는다. 그래서 `11.0.0`으로 맞췄다.
 *
 * **11.0.0에서 따라온 것(D46 1번·D49, major — 요청은 한 글자도 바뀌지 않았다).**
 * 세액 한도·연금계좌 세액공제가 **단계마다** 원 미만을 버리고 있었다 — 근로소득공제를
 * 먼저 버리고 총급여에서 빼서, 과세표준이 「국고금 관리법」 §47②(과세표준액 1원 미만
 * 절사)보다 **항상 정확히 1원 컸다.** 이제 금액을 정수 분수(`exactOf`/`scaleExact`/
 * `cmpExact` 등, `src/engine/exact.mjs`와 같은 방식을 이 목이 독립적으로 다시 구현한
 * 것)로 들고 다니다가 조문이 지목한 §47② 한 자리(`ROUNDING_STAGE_MOCK.TAX_BASE`)에서만
 * 버린다. 원 미만 처리 규약(`tax.rounding.won_fraction`)을 산문이 아니라 룰셋의
 * `stage_code`·`operation_code`·`unit_krw`·`determined_by_law` 네 칸에서 읽고
 * (`createRoundingPolicyMock`), 조문이 정한 자리와 이 조직이 정한 자리를 다른 손잡이
 * (`rounding.statutory`/`rounding.convention`)로 갈라 뒤바꿔 부르면 값이 나오지 않고
 * 멈춘다. §47①(10원, 국고금의 수입·지출)은 룰셋의 `binds_engine_output`이 `false`가
 * 아니면 이 엔진의 출력에 10원 단위를 걸지 않고 멈춘다.
 *
 * **`PlanTaxLiabilityCap.applied`의 판정이 정확값끼리의 대소로 바뀐다.** 그 결과
 * `applied === (reduced_total_krw > 0)`이 더 이상 성립하지 않는다 — 잘린 양이 1원에
 * 못 미치면 `applied`가 `true`인데 표시 금액은 한 원도 줄지 않는다. D37이 정한 「이
 * 막대가 짧은 것은…」 문장은 **눈에 보이는 짧음에 대한 진술**이므로 이제 `applied`가
 * 아니라 `reduced_total_krw > 0`에 매단다(`ACCOUNT_BENEFIT_CAP_BELOW_CEILING_NOTE`,
 * `result-panel.js`) — `applied`가 참이라는 사실 자체는 여전히 유효하고 지우지 않는다.
 *
 * **10.0.0에서 따라온 것(D44, major — 새 입력 때문이 아니다).** 사람 쪽 자격이
 * 둘로 갈렸다 — **계좌를 열 수 있는가**(`irp.eligibility`, 근퇴법 §24②+시행령
 * §17의 한정 열거)와 **그 납입액으로 공제를 받을 수 있는가**(`pension.credit.
 * taxpayer_eligibility`, 소득세법 §59조의3① 「종합소득이 있는 거주자」)는 다른
 * 축이고 어긋나는 자리가 있다 — 이자·배당소득만 있는 사람은 IRP를 못 열지만
 * 연금저축으로는 공제를 받는다. 두 규칙 모두 산문 대신 `engine_evaluation.
 * branches[].{when,outcome_code,direction_code}` 코드 칸을 두었고(계약 8.8절),
 * 이 목도 실제 엔진(`statutory-eligibility.mjs`)과 같이 그 칸만 읽는다 — 산문
 * (`basis`)은 읽지 않는다(`firstMatchingEligibilityBranch`).
 *
 * `AccountEligibility`에 `determination_code`·`determination_direction_code`가
 * 붙는다(계약 5.2절). IRP는 `irp_eligible`/`irp_not_eligible`/
 * `irp_eligibility_undetermined` 셋 중 하나이고, **미정은 배제가 아니다** —
 * `irp_eligibility_undetermined`는 `eligible: true`와 함께 나가고 배제 코드는
 * 응답 어디에도 없다(D44 판정 1). 연금저축·ISA는 언제나 `null`이다.
 * `ScenarioResult`에 `pension_credit_taxpayer_eligibility`가 붙는다(계약 5.18절)
 * — `requirement_met: false`면 두 연금계좌의 세액공제액이 0이고, **그 0은
 * 한도에 잘린 것이 아니다.** `tax_liability_cap.applied`가 그 분기에서
 * `true`→`false`로 바뀐다 — 금액은 둘 다 0으로 같고 **화면이 쓸 수 있는
 * 문장만 다르다**(「낼 세금이 적어 잘렸습니다」가 아니라 「종합소득이 없어
 * 요건이 서지 않습니다」).
 *
 * 새 입력 둘(`profile.has_business_income_current_year`·
 * `profile.received_retirement_lumpsum_ever`)은 요청 형태로만 받는다 — **오늘의
 * 확정 룰셋은 어느 분기의 `when`에서도 이 필드를 가리키지 않으므로 답을 보내도
 * 응답이 한 원도 바뀌지 않는다**(계약 3.1절). 화면은 이 두 칸을 띄우지 않는다.
 *
 * `legal_basis`·`plans[].warnings`의 「사전순」이 `localeCompare`에서 코드 단위
 * 비교(`byCodeUnit`)로 바뀐다(계약 6.1절) — `.`와 `_`의 앞뒤가 반대이고
 * `localeCompare`는 실행 환경의 ICU 데이터에 달려 결정성 보장과 어긋난다.
 *
 * **9.0.0에서 따라온 것(D39·D40·D41·D42, major).** 소유자가 직전 과세연도
 * 결정세액 입력·문구를 전부 없애라고 지시했다(D39). `profile.prior_year_tax`가
 * 요청에서 사라졌다 — 이 목의 `PRIOR_TAX_STATES`·`validatePriorYearTax`도 함께
 * 걷어냈다. **한도는 없어지지 않았다. 상한이 됐다**(D40) — 엔진이 해당
 * 과세기간 총급여액에서 §47(근로소득공제)→§50①1(기본공제)→§55①(기본세율)→
 * §59(근로소득세액공제)를 밟아 §61②③의 세액 한도를 산출한다. 그 값은 그
 * 사람의 실제 한도가 **아니라 상한**이고(`cap_krw`가 결코 `null`이 아니다),
 * `PlanTaxLiabilityCap.applied`의 `false`가 이제 「잘리지 않았다」가 아니라
 * 「우리가 아는 상한으로는 잘리지 않았다」를 뜻한다 — 그 구분을
 * `binding_code`(`binds_provably` / `binding_not_determined`)가 낸다. 종합소득이
 * 있는데 금액을 모르는 분기는 오차 방향조차 정해지지 않아
 * `error_direction_code`가 `direction_indeterminate`이고, 그 분기에서는 「최대」도
 * 「적어도」도 쓸 수 없다(D41). 분기 판정은 룰셋의 산문(`direction`)이 상한
 * 코드로 시작하는지만 본다 — 산문을 다시 해석하지 않는다. 안내
 * `tax_liability_cap_unknown`이 없어지고 `tax_liability_cap_estimated_from_total_salary`가
 * **언제나** 나가며, 미정 분기에서는 `tax_liability_cap_direction_indeterminate`가
 * 함께 나간다. **세법 수치는 이 파일에 없다** — 구간·세율·기본공제액은 전부
 * `resolveTaxLiabilityCapMock`이 룰셋에서 읽는다.
 *
 * **8.2.0에서 따라온 것(D38, minor).** 헤드라인이 「올해 세액공제 + 앞으로 N년
 * ISA」의 합계를 낼 수 있게 됐다. `Plan`에 `headline_composite_total`이 새로
 * 붙고(5.17절 — 확정 성분·가정 성분을 화면이 더하지 않도록 계약이 이미 더한
 * 값이다), `AssumptionBasedIsaEstimate`에 `axis_ceilings`가 붙는다(축마다
 * 상한의 유무가 다르다 — 비과세 축에만 계약 단위 상한이 있다, D38 6번·7번).
 * 값이 한 원도 움직이지 않는 추가뿐이라 minor다.
 *
 * **8.0.0에서 따라온 것(0.12·0.13절, major).** `7.0.0`이 적은 월 환산 이탈의
 * 위쪽 끝 `±(개월수 − 1)`이 산술로 틀렸다 — 실제는 **−(개월수 − 1) 이상
 * (갈래 수 − 1) × (개월수 − 1) 이하**다. **필드도 산식도 값도 하나도 바뀌지
 * 않는다** — `apportionMonthly`는 그대로다. 이 대조 기준이 옛 서술을 숫자로
 * 옮겨 적어 둔 곳이 없는지 훑었고, 없었다(`0`~`3`으로 적은 곳들은 갈래가 넷일
 * 때의 `remaining`/`roundingAdjustmentMonthlyKrw` 실제 상한이지 `7.0.0`이 잘못
 * 적었던 서술을 옮긴 것이 아니다). 고칠 것은 버전 문자열뿐이었다.
 *
 * **7.0.0에서 따라온 것(0.12절, major).** 월 납입 여력에 250만원을 넣었는데
 * 도넛 가운데가 `2,499,999원`으로 나온 신고가 원인이다 — 이 목이 계좌별
 * 월 금액을 각각 순수하게 내림(`floor(annual/months)`)했고, 그때 버려지는
 * 최대 3원/월이 화면에서 사라졌다. `Allocation.monthly_krw`가 `내림 +
 * monthly_rounding_adjustment_krw`로 바뀌고, `Allocation`에
 * `monthly_annualized_krw`·`monthly_rounding_adjustment_krw`가,
 * `Plan`에 `unallocated_monthly_rounding_adjustment_krw`·
 * `monthly_unassigned_krw`·`monthly_unassigned_reason_code`가 새로 붙는다
 * (`apportionMonthly` 함수가 이 산식이다). 도넛 가운데 "월 배분 총액"도
 * 이제 **네 조각의 합**(`allocations[].monthly_krw` 셋 + `unallocated_monthly_krw`)
 * 이어야 정확히 `echo.monthly_capacity_krw`와 같아진다(10절 — 이 부분은 화면
 * 쪽 수정이라 `result-panel.js`/`charts.js`가 진다).
 *
 * **4.0.0에서 따라온 것.** 요청에 `profile.birth_date`·`profile.prior_year_tax`·
 * `accounts.*.annuity_start_status`가 필수로 들어오고 `profile.age_years`가
 * 사라졌다. 응답에 `pension_credit_tax_liability_cap`·`pension_withdrawal_start`·
 * `DeterministicBenefit`의 자르기 전 금액이 들어왔다.
 *
 * **5.0.0에서 따라온 것(D26·D27).** 요청에
 * `profile.has_non_wage_global_income_current_year`가 필수로 들어오고(선택인
 * `current_year_global_income_krw`가 짝이다) 공제율 판정 축이 총급여/종합소득금액
 * 둘로 나뉜다(0.7절). 배분안이 셋에서 넷으로 늘고(`pension_contribution_limit_fill`,
 * 6.0.0에서 `pension_contribution_before_isa`로 개명됨),
 * `Plan`에 `unallocated_breakdown`·`pension_combined_credit_remaining_after_plan_krw`가,
 * `NonQuantifiedEffect`에 `facts`·`headroom_shared_with`가 붙는다.
 *
 * **5.1.0에서 따라온 것(D28·D29·D31, minor).** 요청에 선택 필드
 * `profile.isa_return_assumption`과 `options.assumption_based_isa_estimate`가
 * 붙는다. 둘 다 보내지 않으면(=`null`) 기존 필드가 한 원도 달라지지 않는다 — 그래서
 * minor다(0.9절). 응답에는 `echo.isa_return_assumption`·`echo.isa_return_affects`
 * (네 값이 전부 `false`인 고정 객체 — D28이 그은 선 ①을 자료형으로 강제한다)와
 * `Plan.assumption_based_isa_estimate`가 새로 붙는다. **이 화면(`web-dev`)은
 * 수익률을 제안하거나 미리 채우지 않는다** — 목이 기본값을 만들지 않는 것이
 * 그 방어선의 절반이고, 나머지 절반은 입력 폼이 진다(0.10절).
 *
 * **6.0.0에서 따라온 것(D32, major).** 소유자가 기본안의 배분을 바꿨다 — 네 안
 * 전부의 충당 순서에 "연금계좌를 **납입** 한도까지" 단계가 붙는다(연금 공제한도
 * → ISA 납입한도 → 연금 납입한도 → 미배분). `plan_id` 열거형에서
 * `pension_contribution_limit_fill`이 빠지고 `pension_contribution_before_isa`가
 * 들어오며, `priority_basis.code`도 `pension_contribution_limit_before_isa`로
 * 바뀐다. `Allocation.limited_by`에서 `credit_limit`이 사라진다(애초에 이 목은
 * 그 값을 낸 적이 없다 — 신용 한도로 멈추는 것도 `contribution_limit`으로
 * 냈다). `NonQuantifiedEffect`의 `pension_contribution_without_credit`이
 * **기본안을 포함한 어느 안에서도** 나올 수 있다 — 더 이상 넷째 안의 전유물이
 * 아니다(0.11절). `unallocated_breakdown`의 두 여력 갈래는 네 안 모두 미배분이
 * 남으면 사실상 항상 0이 된다 — 미배분이 남았다는 것 자체가 세 한도가 모두
 * 찼다는 뜻이기 때문이다(5.13절).
 *
 * 이 파일은 `calc-engine-dev`의 실제 엔진(`src/engine/`)이 나오기 전까지 UI를
 * 독립적으로 확인하기 위한 대체물이다. 세법 수치는 전부 인자로 주입되는
 * `rulesets`(= data/tax-rules/*.json을 파싱한 객체)에서 읽으며 이 파일 어디에도
 * 하드코딩하지 않는다 — 제품 원칙 1을 목에도 그대로 적용한다.
 *
 * **배분 알고리즘은 근사치다.** 네 배분안(`max_tax_credit` / `annuity_savings_first`
 * / `isa_first` / `pension_contribution_before_isa`)의 우선순위를 반영하는 합리적인
 * 순차 충당 규칙을 구현했지만,
 * 이는 `calc-engine-dev`가 `engine-design.md`에서 확정할 실제 알고리즘을
 * 대신하는 것이 아니다. 목의 책임은 계약의 타입·필드·코드를 정확히 지키고
 * UI가 다섯 상태를 모두 확인할 수 있는 그럴듯한 값을 내는 것까지다.
 *
 * 순수 함수다 — 네트워크·파일 I/O·현재 시각을 읽지 않는다. 예외를 던지지 않는다.
 */

const ACCOUNTS = ['retirement_pension', 'annuity_savings', 'isa'];
const SCENARIO_ORDER = ['current', 'proposed'];
// 6.0.0 (D32) — 넷째 안의 이름이 `pension_contribution_limit_fill`에서
// `pension_contribution_before_isa`로 바뀌었다. 네 안 모두 이제 연금 **납입**
// 한도까지 채우므로(0.11절), 이 안을 다른 셋과 가르는 것은 더 이상 "납입
// 한도까지 채운다"는 사실이 아니라 "ISA보다 먼저"라는 순서뿐이다. 세법이
// 유불리를 정하지 않으므로 이 안은 여전히 기본안이 되지 않는다.
const PLAN_ORDER = ['max_tax_credit', 'annuity_savings_first', 'isa_first', 'pension_contribution_before_isa'];
const PENSION_ACCOUNTS = ['retirement_pension', 'annuity_savings'];
const KNOWN_SCHEMA_MAJOR = '11';
export const MOCK_SCHEMA_VERSION = '11.0.0';
const ANNUITY_START_VALUES = ['not_started', 'started', 'unknown'];
// 9.0.0(D39·D40) — 세액 한도를 총급여액에서 산출한다. `profile.prior_year_tax`가
// 요청에서 사라졌으므로 그 값의 상태 열거형(`PRIOR_TAX_STATES`)도 함께 없앤다.
// **한도의 정의 자리는 룰셋** — 아래 넷은 값의 정의 자리가 계약인 자리만 옮겨 적는다
// (계약 8.7절). `CAP_BASIS`는 값이 하나뿐이라 계약이 정의한다(D39의 결과).
const CAP_BASIS = 'current_year_total_salary';
// 룰셋 `pension.credit.tax_liability_cap.current_year_estimate.branches`의 **키**.
// 정의 자리는 룰셋이고 여기는 전사다.
const CAP_BRANCH = {
  WAGE_ONLY: 'wage_income_only',
  GLOBAL_INCOME_SUPPLIED: 'global_income_amount_supplied',
  GLOBAL_INCOME_MISSING: 'global_income_amount_missing',
};
// 오차 방향이 정해지지 않은 분기의 코드. 이 문자열의 정의 자리는 계약이다(8.7절) —
// 상한 쪽 코드(`overstated_or_equal`)는 룰셋이 값으로 적어 두므로 그것을 읽는다.
const CAP_DIRECTION_INDETERMINATE = 'direction_indeterminate';
// 이 배분안에서 한도가 걸린다는 것이 **증명되는가**(D40). 정의 자리는 계약이다.
const CAP_BINDING = { PROVABLE: 'binds_provably', NOT_DETERMINED: 'binding_not_determined' };
// 5.1.0(D28·D29) — 수익이 어떤 형태로 들어오는가. 자산군이 아니다(계약 3.6절).
const ISA_INCOME_CHARACTERS = ['interest_dividend', 'listed_equity_capital_gain', 'mixed_or_unknown'];
// 5.1.0(D31) — 되돌리는 길. 계산과 입력은 그대로 두고 표시만 끈다(0.11절).
const ISA_ESTIMATE_DISPLAYS = ['include', 'suppress'];

// ---------------------------------------------------------------------------
// 날짜 — 순수 함수다. 현재 시각을 읽지 않는다(계약 1절).
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD`이고 달력에 있는 날짜면 `{y,m,d}`, 아니면 null. */
function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/**
 * 만 나이. **기준일 규칙이 룰셋에 없다** — 엔진은 규칙을 만들지 않고 과세기간
 * 종료일로 환산한 뒤 그 사실을 `age_reference_date_not_in_ruleset` 가정으로 낸다
 * (계약 3.1절). 화면이 이 판단을 대신하지 않는 것이 D21의 요점이다.
 */
function ageAtReferenceDate(birth, referenceDate) {
  const ref = parseIsoDate(referenceDate);
  let age = ref.y - birth.y;
  if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) age -= 1;
  return age;
}

function referenceDateFor(taxYear) {
  return `${taxYear}-12-31`;
}

/** `birth`에서 n년 뒤 같은 날. 2월 29일은 그 달의 마지막 날로 맞춘다. */
function datePlusYears(date, years) {
  const y = date.y + years;
  const lastDay = new Date(Date.UTC(y, date.m, 0)).getUTCDate();
  const d = Math.min(date.d, lastDay);
  return `${String(y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 룰셋 조회 헬퍼
// ---------------------------------------------------------------------------

function ruleFiles(rulesets) {
  return Object.keys(rulesets || {});
}

/**
 * 「사전순」은 코드 단위 비교다(계약 6.1절, `10.0.0`). `localeCompare`가 아니다 —
 * 그 함수의 순서는 실행 환경의 ICU 데이터에 달려 있어 결정성 보장과 어긋나고,
 * `.`가 `_`보다 앞이냐 뒤냐가 기본 순서와 반대다.
 */
function byCodeUnit(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function findRule(rulesets, ruleId, fileKeys) {
  for (const key of fileKeys) {
    const file = rulesets[key];
    if (!file || !Array.isArray(file.rules)) continue;
    const rule = file.rules.find((r) => r.id === ruleId);
    if (rule) return { rule, fileKey: key };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 10.0.0(D44) — 사람 쪽 자격 두 규칙(`irp.eligibility`·
// `pension.credit.taxpayer_eligibility`)이 산문 대신 `engine_evaluation.branches`
// 코드 칸을 두었다(계약 8.8절). **이 목도 산문(`basis`)을 읽지 않는다** — 실제
// 엔진(`statutory-eligibility.mjs`)과 같은 규약이다. `when`은 `{field, op, value}`
// 꼴의 값이고 여기서 일반적으로 평가한다 — 조건을 코드에 다시 적지 않으므로
// 룰셋이 분기를 늘리거나 조건을 바꿔도 이 파일을 고치지 않고 판정이 따라간다.
// ---------------------------------------------------------------------------

const ELIGIBILITY_WHEN_OPERATORS = {
  eq: (actual, expected) => actual === expected,
  gt: (actual, expected) => typeof actual === 'number' && typeof expected === 'number' && actual > expected,
  not_null: (actual) => actual !== null && actual !== undefined,
};

/** 점으로 이은 경로. 값이 없는 것과 필드가 없는 것을 가른다(D44와 같은 이유). */
function readEligibilityPath(context, path) {
  const keys = String(path).split('.');
  let node = context;
  for (const key of keys) {
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, key)) {
      return { found: false, value: undefined };
    }
    node = node[key];
  }
  return { found: true, value: node };
}

function testEligibilityCondition(condition, context) {
  if (condition === null || typeof condition !== 'object') return null;
  const operator = ELIGIBILITY_WHEN_OPERATORS[condition.op];
  if (operator === undefined) return null;
  const read = readEligibilityPath(context, condition.field);
  if (!read.found) return null;
  return operator(read.value, condition.value);
}

function testEligibilityWhen(when, context) {
  if (when === null || typeof when !== 'object') return null;
  const groups = [
    ['all_of', (results) => results.every(Boolean)],
    ['any_of', (results) => results.some(Boolean)],
  ].filter(([key]) => Array.isArray(when[key]));
  if (groups.length === 0) return null;
  let matched = true;
  for (const [key, combine] of groups) {
    const results = when[key].map((condition) => testEligibilityCondition(condition, context));
    if (results.some((result) => result === null)) return null;
    matched = matched && combine(results);
  }
  return matched;
}

/**
 * 룰셋의 `engine_evaluation.branches`에서 첫 매치를 고른다(D44/계약 8.8절).
 * 읽는 칸은 셋뿐이다 — `when` · `outcome_code` · `direction_code`. 산문(`basis`)은
 * 읽지 않는다. 형태가 어긋나거나 어느 분기도 맞지 않으면 `null`(= rule_missing)이다.
 */
function firstMatchingEligibilityBranch(rule, context, allowedOutcomeCodes) {
  const evaluation = rule?.value?.engine_evaluation;
  if (
    !evaluation ||
    evaluation.evaluation_order !== 'first_match_wins' ||
    !Array.isArray(evaluation.branches) ||
    !Array.isArray(evaluation.allowed_outcome_codes) ||
    evaluation.allowed_outcome_codes.length !== allowedOutcomeCodes.length ||
    !allowedOutcomeCodes.every((code) => evaluation.allowed_outcome_codes.includes(code))
  ) {
    return null;
  }
  for (const branch of evaluation.branches) {
    const matched = testEligibilityWhen(branch?.when, context);
    if (matched === null) return null;
    if (!matched) continue;
    if (
      typeof branch.outcome_code !== 'string' ||
      typeof branch.direction_code !== 'string' ||
      !allowedOutcomeCodes.includes(branch.outcome_code)
    ) {
      return null;
    }
    return branch;
  }
  return null;
}

/** 그 분기를 닫을 수 있는 입력의 id(계약 8.8절 · 3.1절). 화면이 언제 물어야 하는지를 값으로 낸다. */
function closingInputIdsForBranch(requestedInputs, branchId) {
  if (!Array.isArray(requestedInputs)) return [];
  return requestedInputs
    .filter((input) => input?.closes_branch === branchId && typeof input.id === 'string')
    .map((input) => input.id)
    .sort();
}

/**
 * 5.0.0(5.7.1절) — 유무(boolean)가 아니라 **목록**이다. "일부 해소"가 유무로는
 * 보이지 않기 때문이다. 목의 근사는 룰셋 전체를 훑는 실제 엔진의 분류기만큼
 * 정교하지 않다 — 표시가 있다는 사실 하나를 한 항목으로 낸다(합성 항목).
 * `has_uncertainty_note === (uncertainty_notes.length > 0)`이라는 계약의 등식은
 * 그대로 지킨다.
 */
function collectUncertaintyNotes(v) {
  if (v.unverified) return [{ path: 'value.unverified', kind: 'unverified' }];
  if (v.confidence === 'corroborated') return [{ path: 'value.confidence', kind: 'confidence_not_verified' }];
  if (v.age_range === null) return [{ path: 'value.age_range', kind: 'value_absent' }];
  return [];
}

function toLegalBasisEntry(rule, appliedTo) {
  const v = rule.value || {};
  const uncertaintyNotes = collectUncertaintyNotes(v);
  return {
    rule_id: rule.id,
    title: rule.title,
    law: rule.source.law,
    law_version: rule.source.law_version ?? null,
    url: rule.source.url,
    corroborating_url: rule.source.corroborating_url ?? null,
    status: rule.status,
    bill_stage: rule.bill_stage ?? null,
    effective_from: rule.effective_from,
    verified_on: rule.source.verified_on,
    applied_to: appliedTo,
    has_uncertainty_note: uncertaintyNotes.length > 0,
    uncertainty_notes: uncertaintyNotes,
  };
}

// ---------------------------------------------------------------------------
// 가정 기반 ISA 정산액 (5.1.0, D28·D29·D31 / 계약 3.6·5.14절)
//
// **이 값은 확정된 세액공제와 성질이 다르다.** 사용자가 제시한 수익률·소득 성격·
// 정산 기간이라는 가정 위의 계산이고, 이름에 `benefit`을 쓰지 않고
// `assumption_based`를 넣은 이유가 그것이다. 목적함수(배분·세액공제·순서·경고)는
// 이 절을 한 번도 읽지 않는다 — `echo.isa_return_affects`의 네 `false`가 그 선언이다.
// 세법 수치는 하나도 코드에 없다. 전부 룰셋에서 읽는다.
// ---------------------------------------------------------------------------

/** 십진 소수를 정수 분수로 바꾼다. 부동소수점 오차 없이 원 미만을 버리기 위해서다. */
function toRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const text = String(value);
  if (/e/i.test(text)) return null;
  const decimals = (text.split('.')[1] ?? '').length;
  const den = 10 ** decimals;
  const num = Math.round(value * den);
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) return null;
  return { num, den };
}

/** 금액에 비율을 적용하고 원 미만을 버린다. */
function applyRate(amountKrw, rate) {
  const ratio = toRatio(rate);
  if (ratio === null) return null;
  const product = amountKrw * ratio.num;
  if (!Number.isSafeInteger(product)) return null;
  return Math.floor(product / ratio.den);
}

const clampToZero = (value) => (value < 0 ? 0 : value);

/**
 * 소득세율에 지방소득세 부가율을 얹은 실효율. 분수를 합쳐 한 번에 나눈다 —
 * 소수를 두 번 곱하면 꼬리 오차가 화면까지 새어 나간다(`src/engine/ratio.mjs`의
 * `effectiveRate`와 같은 규율을 이 목이 독립적으로 다시 옮겨 적은 것이다).
 */
function effectiveRateOf(incomeTaxRate, surtaxRate) {
  const income = toRatio(incomeTaxRate);
  const surtax = toRatio(surtaxRate);
  if (income === null || surtax === null) return null;
  return (income.num * (surtax.den + surtax.num)) / (income.den * surtax.den);
}

// ---------------------------------------------------------------------------
// 연금저축·IRP를 나중에 받을 때의 세율표 (계약 5.16절, D36). 금액은 한 칸도
// 없다 — 세율만 낸다. **요청의 어떤 입력에도 반응하지 않는다**(새 입력
// 0개·가정 0개가 이 표의 성립 조건이다). 세법 수치는 전부 룰셋에서 읽고,
// 이 파일에 있는 문자열은 상황 이름(situation_code)을 가르는 접두사뿐이다.
// ---------------------------------------------------------------------------

const PENSION_OUTSIDE_PREFIX = 'outside_account_';
const PENSION_OUTSIDE_CHARACTER = {
  outside_account_interest_dividend: 'interest_dividend',
  outside_account_listed_equity_capital_gain: 'listed_equity_capital_gain',
};
const PENSION_OVER_THRESHOLD_CODE = 'pension_annuity_over_separate_threshold';
const PENSION_NON_ANNUITY_CODE = 'pension_non_annuity';
const PENSION_ANNUITY_PREFIX = 'pension_annuity_';

/** 세율표의 상황 이름을 계좌 밖(`null`)/계좌 안 갈래로 나눈다. 분류할 수 없으면 `undefined`. */
function pensionWithdrawalBranchOf(situationCode) {
  if (situationCode.startsWith(PENSION_OUTSIDE_PREFIX)) return null;
  if (situationCode === PENSION_OVER_THRESHOLD_CODE) return 'annuity_over_threshold';
  if (situationCode === PENSION_NON_ANNUITY_CODE) return 'non_annuity';
  if (situationCode.startsWith(PENSION_ANNUITY_PREFIX)) return 'annuity_within_threshold';
  return undefined;
}

/** 소득 성격 × 인출 갈래 — 세율표를 두 축으로 갈라 낼 조합. 이름만 있고 수치는 없다. */
const PENSION_GAP_COMBINATIONS = [
  { character: 'interest_dividend', branch: 'annuity_within_threshold' },
  { character: 'interest_dividend', branch: 'non_annuity' },
  { character: 'interest_dividend', branch: 'annuity_over_threshold' },
  { character: 'listed_equity_capital_gain', branch: 'annuity_within_threshold' },
  { character: 'listed_equity_capital_gain', branch: 'non_annuity' },
  { character: 'listed_equity_capital_gain', branch: 'annuity_over_threshold' },
  { character: 'mixed_or_unknown', branch: 'any' },
];

/** 두 실효율의 차. 정수 분수로 바꿔 빼고 마지막에 한 번만 나눈다. */
function subtractRatesForPensionGap(a, b) {
  const left = toRatio(a);
  const right = toRatio(b);
  if (left === null || right === null) return null;
  return (left.num * right.den - right.num * left.den) / (left.den * right.den);
}

function pensionGapSignOf(minGap, maxGap) {
  if (minGap === null || maxGap === null) return 'not_determined';
  if (minGap > 0) return 'positive';
  if (maxGap < 0) return 'negative';
  return 'crosses_zero';
}

/**
 * 참고 구역 전체를 만든다(계약 5.16절). `use`는 `computeScenario`의 규칙
 * 조회 헬퍼다 — 규칙을 찾지 못하면 `missingRules`에 기록하고 여기서는
 * `null`을 돌려준다(대체값을 만들지 않는다. 상위에서 `ok:false`로 조기
 * 반환된다).
 */
function resolvePensionWithdrawalTaxReferenceMock(use, surtaxRateRuleId, surtaxRate) {
  const gapRule = use('pension.rate_gap.quantifiability', 'pension_withdrawal_tax_reference');
  const thresholdRule = use('pension.income.separate_taxation.threshold', 'pension_withdrawal_tax_reference');
  const earlyWithdrawalRule = use('pension.early_withdrawal.other_income_rate', 'pension_withdrawal_tax_reference');
  const byAgeRule = use('pension.income.withholding_rate.by_age', 'pension_withdrawal_tax_reference');
  const lifetimeRule = use('pension.income.withholding_rate.lifetime_annuity', 'pension_withdrawal_tax_reference');
  const electiveRule = use('pension.income.separate_taxation.elective_rate', 'pension_withdrawal_tax_reference');
  if (!gapRule || !thresholdRule || !earlyWithdrawalRule || !byAgeRule || !lifetimeRule || !electiveRule) return null;

  const rows = gapRule.value?.rate_table?.rows;
  const unresolved = gapRule.value?.what_remains_unknown_even_with_all_of_them;
  const minimumInputs = gapRule.value?.minimum_input_set?.items;
  const thresholdKrw = thresholdRule.value?.amount_krw;
  if (!Array.isArray(rows) || !Array.isArray(unresolved) || !Array.isArray(minimumInputs) || typeof thresholdKrw !== 'number') {
    return null;
  }

  const table = [];
  const outside = new Map();
  const inside = new Map();

  for (const row of rows) {
    const code = row?.situation_code;
    if (typeof code !== 'string' || typeof row.law !== 'string') return null;
    const incomeTaxRate = typeof row.income_tax_rate === 'number' ? row.income_tax_rate : null;
    const rowEffective = incomeTaxRate === null ? null : effectiveRateOf(incomeTaxRate, surtaxRate);
    if (incomeTaxRate !== null && rowEffective === null) return null;
    const branch = pensionWithdrawalBranchOf(code);
    if (branch === undefined) return null;

    table.push({
      situation_code: code,
      description: typeof row['설명'] === 'string' ? row['설명'] : null,
      side_code: branch === null ? 'outside_account' : 'inside_account',
      withdrawal_branch_code: branch,
      income_tax_rate: incomeTaxRate,
      effective_rate: rowEffective,
      law: row.law,
      note: typeof row.note === 'string' ? row.note : null,
    });

    const bucket = branch === null ? outside : inside;
    const key = branch === null ? PENSION_OUTSIDE_CHARACTER[code] : branch;
    if (key === undefined) return null;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push({ situation_code: code, effective_rate: rowEffective });
  }

  const gapCases = PENSION_GAP_COMBINATIONS.map(({ character, branch }) => {
    const outsideRows = character === 'mixed_or_unknown' ? [...outside.values()].flat() : (outside.get(character) ?? []);
    const insideRows = branch === 'any' ? [...inside.values()].flat() : (inside.get(branch) ?? []);
    const determinedInside = insideRows.filter((row) => row.effective_rate !== null);
    const undetermined = insideRows
      .filter((row) => row.effective_rate === null)
      .map((row) => row.situation_code)
      .sort();

    let minGap = null;
    let maxGap = null;
    if (outsideRows.length > 0 && determinedInside.length > 0) {
      const gaps = [];
      for (const out of outsideRows) {
        for (const inRow of determinedInside) {
          gaps.push(subtractRatesForPensionGap(out.effective_rate, inRow.effective_rate));
        }
      }
      minGap = Math.min(...gaps);
      maxGap = Math.max(...gaps);
    }

    return {
      income_character_code: character,
      withdrawal_branch_code: branch,
      outside_situation_codes: outsideRows.map((row) => row.situation_code).sort(),
      inside_situation_codes: insideRows.map((row) => row.situation_code).sort(),
      undetermined_situation_codes: undetermined,
      gap_min_rate: minGap,
      gap_max_rate: maxGap,
      sign_code: pensionGapSignOf(minGap, maxGap),
      basis_rule_ids: [gapRule.id],
    };
  });

  return {
    // **0원이 아니다.** 계산했더니 0인 것과 계산 자체를 못 하는 것은 다른 사실이다.
    computability_code: 'not_computable_by_design',
    unresolved_codes: unresolved.map((item) => item?.id).filter((id) => typeof id === 'string').sort(),
    minimum_input_count: minimumInputs.length,
    unresolved_count: unresolved.length,
    separate_taxation_threshold_krw: thresholdKrw,
    rate_table: table,
    rate_gap_cases: gapCases,
    principal_retaxed_on_withdrawal: true,
    basis_rule_ids: [earlyWithdrawalRule.id, byAgeRule.id, lifetimeRule.id, gapRule.id, electiveRule.id, thresholdRule.id, surtaxRateRuleId]
      .filter(Boolean)
      .sort(),
  };
}

/**
 * 연간 금액을 월 표시 금액으로 나눈다 — `engine-interface.md` 0.12절의 산식을
 * 그대로 옮긴 것이다. **세법 수치가 한 줄도 없는 순수 산술**이라 룰셋을 읽지
 * 않는다(`src/engine/monthly.mjs`가 실제 엔진 쪽의 같은 산식이다. 이 목은 그
 * 파일을 불러 쓰지 않고 계약 문서에서 독립적으로 다시 옮겨 적었다 — 목의
 * 역할이 "계약을 이 유닛이 어떻게 읽었는지"를 남기는 대조 기준이기 때문이다).
 *
 * 문제: 연간 예산 B = 월 여력 C × 개월수 m이고, 네 갈래(세 계좌 + 미배분)의
 * 연 금액 합이 정확히 B다. 각 갈래를 그냥 내림하면(`floor(a_i/m)`) 합이 C보다
 * 최대 3원 적어진다 — 그 3원을, 얹어도 납입 한도를 넘지 않는 갈래 중 가장 싸게
 * (연 기준 벗어남이 가장 작게) 얹는다. 얹을 곳이 없으면 `unassignedMonthlyKrw`로
 * 낸다 — 삼키지 않는다.
 *
 * @param {object} input
 * @param {number} input.months 개월수. 1 이상의 정수(0이면 전부 0으로 낸다).
 * @param {number} input.capacityMonthlyKrw 월 납입 여력(원/월).
 * @param {Array<{id: string, annualKrw: number, poolId: string|null, orderIndex: number}>} input.buckets
 *        `poolId`가 `null`이면 한도가 없는 갈래(미배분)다. `orderIndex`는 값이
 *        같을 때의 순서이고 작을수록 먼저다.
 * @param {Record<string, number>} input.poolHeadroomKrw 풀별 납입 잔여 한도(원/연,
 *        이 배분안을 실행한 **뒤** 남는 값이어야 한다 — 배분 전 값을 주면 이미
 *        배분된 몫을 두 번 세게 된다).
 */
function apportionMonthly({ months, capacityMonthlyKrw, buckets, poolHeadroomKrw }) {
  const parts = buckets.map((bucket) => {
    const floorMonthlyKrw = months > 0 ? Math.floor(bucket.annualKrw / months) : 0;
    return {
      ...bucket,
      floorMonthlyKrw,
      remainderKrw: months > 0 ? bucket.annualKrw - floorMonthlyKrw * months : 0,
      roundingAdjustmentMonthlyKrw: 0,
    };
  });

  // 얹어야 할 1원/월의 개수. 예산이 정확히 C·m이므로 정수다(months가 0이면
  // 애초에 모든 annualKrw도 0이라 아래 루프가 돌지 않는다).
  const assignedFloorTotal = parts.reduce((sum, part) => sum + part.floorMonthlyKrw, 0);
  let remaining = capacityMonthlyKrw - assignedFloorTotal;

  // 풀별 여유를 깎아 가며 배정한다. 인자를 변형하지 않는다.
  const headroom = { ...poolHeadroomKrw };

  /** 이 갈래에 1원/월을 더 얹으면 연 기준으로 얼마를 더 벗어나는가. */
  const costOf = (part) => (part.roundingAdjustmentMonthlyKrw === 0 ? months - part.remainderKrw : months);

  // k ≤ 3이고 갈래가 넷이라 한 원씩 도는 것으로 충분하다.
  while (remaining > 0) {
    let chosen = null;
    for (const part of parts) {
      // 「넣지 않는다」고 말한 갈래에는 월 금액을 붙이지 않는다.
      if (part.annualKrw <= 0) continue;
      const cost = costOf(part);
      if (part.poolId !== null && (headroom[part.poolId] ?? 0) < cost) continue;
      if (chosen === null || cost < chosen.cost || (cost === chosen.cost && part.orderIndex < chosen.part.orderIndex)) {
        chosen = { part, cost };
      }
    }
    if (chosen === null) break;
    if (chosen.part.poolId !== null) headroom[chosen.part.poolId] -= chosen.cost;
    chosen.part.roundingAdjustmentMonthlyKrw += 1;
    remaining -= 1;
  }

  return {
    buckets: parts.map((part) => {
      const monthlyKrw = part.floorMonthlyKrw + part.roundingAdjustmentMonthlyKrw;
      return {
        id: part.id,
        monthlyKrw,
        remainderKrw: part.remainderKrw,
        roundingAdjustmentMonthlyKrw: part.roundingAdjustmentMonthlyKrw,
        monthlyAnnualizedKrw: monthlyKrw * months,
      };
    }),
    // 끝내 얹지 못한 몫(원/월). 0이 아니면 월 표시 금액 넷의 합이 월 여력에
    // 못 미친다 — 삼키지 않고 그대로 낸다.
    unassignedMonthlyKrw: remaining < 0 ? 0 : remaining,
  };
}

/**
 * 소득 성격이 정하는 과세 비율 `s`의 구간을 룰셋 문자열에서 읽는다(계약 3.6절).
 * **선택지가 정하는 것은 값이 아니라 구간이다** — 점을 낼 수 있는 것은 `point`가
 * 참일 때뿐이다. 형식을 읽지 못하면 `null`을 돌려 계산을 멈춘다.
 */
function parseTaxableShareRange(text) {
  if (typeof text !== 'string') return null;
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

/** 계좌 밖 이자·배당의 원천징수율. `isa.benefit.quantification.statable_amounts`에서 읽는다. */
function readGeneralWithholdingRate(quantRule) {
  const items = quantRule?.value?.statable_amounts;
  if (!Array.isArray(items)) return undefined;
  const gap = items.find((item) => item?.id === 'rate_gap');
  return typeof gap?.income_tax?.general === 'number' ? gap.income_tax.general : undefined;
}

/** 소득세를 매기고 지방소득세 부가율을 얹는다. `settlementAt` 안의 계산과 같은 두 단계다. */
function taxOf(amountKrw, rate, surtaxRate) {
  const incomeTax = applyRate(amountKrw, rate);
  if (incomeTax === null) return null;
  const localTax = applyRate(incomeTax, surtaxRate);
  if (localTax === null) return null;
  return incomeTax + localTax;
}

/**
 * 축마다 **상한이 있는지**를 룰셋에서 읽는다(D38 6번·7번, `isa.benefit.axis_ceiling`).
 * **없다는 것이 조문의 판정이지 우리가 못 낸 것이 아니다.** 이 계약이 낼 수 있는 형태
 * (비과세 축에만 상한, 나머지 둘엔 없음)를 벗어나면 값을 고르지 않고 멈춘다 — 조용히
 * `false`를 내보내면 룰셋이 바뀐 사실이 응답에서 사라진다.
 */
function readAxisCeilingFlags(rule) {
  if (!rule) return null;
  const taxFree = rule.value?.tax_free_axis?.has_a_ceiling;
  const rateGap = rule.value?.rate_gap_axis?.has_a_ceiling;
  const lossOffset = rule.value?.loss_offset_axis?.has_a_ceiling;
  const unit = rule.value?.tax_free_axis?.the_unit_of_this_ceiling;
  if (taxFree === undefined || rateGap === undefined || lossOffset === undefined) return null;
  if (typeof unit !== 'string') return null;
  if (taxFree !== true || rateGap !== false || lossOffset !== false) return null;
  return { taxFree, rateGap, lossOffset };
}

/**
 * 배분안 하나의 헤드라인 합계(D38, 계약 5.17절). **`DeterministicBenefit`과
 * `AssumptionBasedIsaEstimate`를 화면이 더하지 않게, 그 덧셈을 여기서 대신 한다.**
 *
 * 가정 성분이 합계에 들어가려면 정산액을 실제로 냈어야 하고(`state === 'computed'`)
 * **이 배분안이 ISA에 넣은 돈이 있어야 한다** — 없으면 그 정산액은 이 배분안이 만든
 * 것이 아니므로 "이 배분으로 계산된"이라는 한정 밖이다.
 */
function headlineCompositeTotalFor({ determinedCreditKrw, estimate, isaAllocatedKrw, basisRuleIds }) {
  const hasAssumption = estimate !== null && estimate.state === 'computed' && isaAllocatedKrw > 0;

  if (!hasAssumption) {
    return {
      lower_bound_krw: determinedCreditKrw,
      upper_bound_krw: determinedCreditKrw,
      point_estimate_krw: determinedCreditKrw,
      bound_code: 'point',
      includes_assumption_component: false,
      determined_component_krw: determinedCreditKrw,
      determined_component_period_code: 'current_tax_year',
      assumption_component_krw: null,
      assumption_settlement_years: null,
      assumption_settlement_years_source: null,
      is_annual: false,
      has_statutory_ceiling: false,
      basis_rule_ids: basisRuleIds,
    };
  }

  const point = estimate.point_estimate_krw;
  const isPoint = point !== null;

  return {
    // 아래 끝 = 확정 성분 + 가정 성분의 아래 끝. 소득 성격이 확정적이지 않은 요청에서는
    // 뒤 항이 0이고, 그래서 이 값이 확정된 세액공제액과 같은 수가 된다(항등식, 계약 5.17절).
    lower_bound_krw: determinedCreditKrw + estimate.lower_bound_krw,
    upper_bound_krw: determinedCreditKrw + estimate.upper_bound_krw,
    point_estimate_krw: isPoint ? determinedCreditKrw + point : null,
    bound_code: isPoint ? 'point' : 'range',
    includes_assumption_component: true,
    determined_component_krw: determinedCreditKrw,
    determined_component_period_code: 'current_tax_year',
    assumption_component_krw: isPoint ? point : estimate.upper_bound_krw,
    assumption_settlement_years: estimate.settlement_years,
    assumption_settlement_years_source: estimate.settlement_years_source,
    is_annual: false,
    has_statutory_ceiling: false,
    basis_rule_ids: basisRuleIds,
  };
}

/**
 * 과세 비율 `s` 하나에 대한 정산. `혜택 = G×일반세율×(1+부가율) − max(0,N−C)×ISA세율×(1+부가율)`.
 * 비교 기준의 과세표준이 `N`이 아니라 `G`인 것이 손익통산 축을 살리는 알맹이다.
 */
function settlementAt({ totalReturnKrw, taxableShare, lossKrw, taxFreeLimitKrw, generalRate, isaRate, surtaxRate }) {
  const grossKrw = applyRate(totalReturnKrw, taxableShare);
  if (grossKrw === null) return null;
  const netKrw = clampToZero(grossKrw - lossKrw);
  const excessKrw = clampToZero(netKrw - taxFreeLimitKrw);

  const taxOf = (amountKrw, rate) => {
    const incomeTax = applyRate(amountKrw, rate);
    if (incomeTax === null) return null;
    const localTax = applyRate(incomeTax, surtaxRate);
    if (localTax === null) return null;
    return incomeTax + localTax;
  };

  const comparisonTax = taxOf(grossKrw, generalRate);
  const isaTax = taxOf(excessKrw, isaRate);
  const lossOffsetAxis = taxOf(grossKrw - netKrw, generalRate);
  const taxFreeAxis = taxOf(Math.min(netKrw, taxFreeLimitKrw), generalRate);
  const excessAtGeneral = taxOf(excessKrw, generalRate);
  if ([comparisonTax, isaTax, lossOffsetAxis, taxFreeAxis, excessAtGeneral].includes(null)) return null;

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

/** 상태만 다르고 형태는 같은 껍데기 — 금액 칸이 조용히 사라지지 않게 전부 적는다. */
function isaEstimateShell(state, ctx, extra = {}) {
  return {
    state,
    not_computable_reason_code: null,
    // **상수다.** 이 금액은 정산 기간 전체의 값이고 1년치가 아니다(계약 5.14절).
    is_annual: false,
    settlement_years: ctx.settlementYears,
    settlement_years_source: ctx.settlementSource,
    taxable_share_min: ctx.share.min,
    taxable_share_max: ctx.share.max,
    principal_krw: null,
    principal_basis_code: 'cumulative_contribution_plus_plan_allocation',
    return_accrual_code: 'simple_interest',
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
    // 8.2.0(D38 6번·7번) — 축마다 상한의 유무. 금액이 없으면 분모도 없다 —
    // 축 금액이 없는데 「한도 중 얼마」를 적을 자리를 만들지 않는다.
    axis_ceilings: null,
    // 8.1.0(D36) — 세 축 금액이 점인가 구간의 위 끝인가, 세율차 축이 0인
    // 것이 결핍이 아닌 자리인가. `state`가 `computed`가 아니면 둘 다 null이다
    // (계약 5.14절).
    axis_breakdown_bound_code: null,
    rate_gap_axis_zero_reason_code: null,
    comparison_baseline_code: 'withholding_at_general_rate',
    is_lower_bound_for_aggregate_taxpayer: true,
    assumes_contract_held_to_settlement: true,
    basis_rule_ids: ctx.basisRuleIds,
    ...extra,
  };
}

/**
 * 배분안 하나에 붙는 가정 기반 ISA 정산액. **원금은 「가입 이후 누적 납입액 + 이
 * 배분안의 ISA 배분액」이다** — 잔액이 아니라 납입액이므로 이미 난 운용수익이
 * 빠져 과소 방향이다(계약 5.14절).
 */
function isaEstimateFor({ context, display, taxFreeLimitKrw, principalKrw, surtaxRate }) {
  if (!context.supplied) return null;
  // D31 — 계산과 입력은 그대로 두고 표시만 끈다. state가 "값이 없다"가 아니라
  // "값을 감췄다"를 말한다(D19).
  if (display === 'suppress') {
    return isaEstimateShell('display_suppressed', context);
  }
  if (taxFreeLimitKrw == null) {
    return isaEstimateShell('not_computable', context, { not_computable_reason_code: 'isa_tax_free_limit_unknown' });
  }

  const exposure = principalKrw * context.settlementYears;
  const totalReturnKrw = Number.isSafeInteger(exposure) ? applyRate(exposure, context.assumption.annual_return_rate) : null;
  if (totalReturnKrw === null) {
    return isaEstimateShell('not_computable', context, { not_computable_reason_code: 'amount_not_representable' });
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
  // 비과세 축의 상한 = `C × 일반세율 × (1+부가율)`. 축의 정의가 `min(N, C) × …`이고
  // `min(N, C) ≤ C`이므로 이 값이 그 축이 넘을 수 없는 값이다(D38 6번, isa.benefit.axis_ceiling).
  const taxFreeCeiling = taxOf(taxFreeLimitKrw, context.generalRate, surtaxRate);
  if (upper === null || lower === null || taxFreeCeiling === null) {
    return isaEstimateShell('not_computable', context, { not_computable_reason_code: 'amount_not_representable' });
  }

  return isaEstimateShell('computed', context, {
    principal_krw: principalKrw,
    total_return_krw: totalReturnKrw,
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
    // **축마다 상한의 유무가 다르다**(D38 6번·7번). 있다고 룰셋이 적은 축(비과세)에만
    // 금액을 만든다 — 나머지 둘에 칸을 두면 언젠가 값이 들어가고, 조문에 없는 분모는
    // 지어낸 분모다.
    axis_ceilings: {
      tax_free_krw: taxFreeCeiling,
      // **계약 1건당이다.** 옆의 세액공제 축은 연간이므로 기간이 값으로 나가지 않으면
      // 두 축을 나란히 둔 배치가 이 값을 연간으로 읽게 만든다.
      tax_free_period_code: 'contract_settlement_period',
      tax_free_settlement_years: context.settlementYears,
      // **이 값은 「법이 정한 최대 절세액」이 아니라 이 계산이 낼 수 있는 값의
      // 최댓값이다.** 비교 세율이 14%보다 높아질 여지가 있고 그 여지는 실제 값을
      // 키우는 방향이라, 오차 방향은 과소다.
      tax_free_is_lower_bound: true,
      rate_gap_has_ceiling: context.axisCeilings.rateGap,
      loss_offset_has_ceiling: context.axisCeilings.lossOffset,
    },
    // D36 — 세 축은 언제나 `upper`(taxable_share_max)의 분해다. 점 추정이
    // 있으면(share.point) 그 분해가 점이고, 없으면 구간의 위 끝이다. 화면이
    // `point_estimate_krw === null`로 스스로 판정하지 않게 값으로 낸다.
    axis_breakdown_bound_code: context.share.point ? 'point' : 'upper_bound',
    // D36 — 세율차 축이 0인 것이 「혜택 없음」이 아니라 「9%가 아니라 0%로
    // 과세되고 있다」는 더 유리한 사실인 자리. 판정 축은 순소득과 비과세
    // 한도의 비교 하나이고(원 미만 절사로 rate_gap_krw만 보면 근소 초과
    // 구간을 놓친다), 그 판정을 여기서 한다.
    rate_gap_axis_zero_reason_code: upper.netKrw <= taxFreeLimitKrw ? 'within_tax_free_limit' : null,
  });
}

// ---------------------------------------------------------------------------
// 공제율 판정 축 (5.0.0, D27 / 계약 0.7절)
//
// 값을 지어내지 않는다 — 두 물음의 답에서 **축을 고르기만** 한다. 총급여액을
// 종합소득금액으로 환산하지 않는다(소괄호는 환산 편의가 아니라 더 엄격한 규정).
// ---------------------------------------------------------------------------

const CREDIT_RATE_BASIS = {
  TOTAL_SALARY: 'total_salary',
  GLOBAL_INCOME: 'global_income',
  STATUTORY_DEFAULT: 'statutory_default',
};

/** 상한이 하나도 없는 구간 = 조문 본문의 구간(대괄호 안 예외가 아닌 쪽). */
function isDefaultCreditRateBracket(b) {
  return (b?.global_income_max_krw ?? null) === null && (b?.total_salary_only_max_krw ?? null) === null;
}

/** 계약 0.7절 표. profile의 두 물음에서 판정 축을 고른다 — 값을 만들지 않는다. */
function resolveCreditRateBasisCode(profile) {
  if (profile.has_non_wage_global_income_current_year !== true) {
    return { code: CREDIT_RATE_BASIS.TOTAL_SALARY, amount: profile.current_year_total_salary_krw };
  }
  if (profile.current_year_global_income_krw != null) {
    return { code: CREDIT_RATE_BASIS.GLOBAL_INCOME, amount: profile.current_year_global_income_krw };
  }
  // 금액을 모른다. 지어내지 않는다 — 대괄호 안의 예외를 적용하지 않고 본문으로 간다.
  return { code: CREDIT_RATE_BASIS.STATUTORY_DEFAULT, amount: null };
}

/** 고른 축으로 구간을 고른다. 법문이 '이하'이므로 경계값은 그 구간에 든다. */
function selectCreditRateBracket(brackets, basis) {
  if (basis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT) {
    return brackets.find(isDefaultCreditRateBracket);
  }
  const ceiling =
    basis.code === CREDIT_RATE_BASIS.TOTAL_SALARY
      ? (b) => b?.total_salary_only_max_krw ?? null
      : (b) => b?.global_income_max_krw ?? null;
  return brackets.find((b) => ceiling(b) === null || basis.amount <= ceiling(b));
}

// ---------------------------------------------------------------------------
// 세액 한도 — 해당 과세기간 총급여액에서 산출한다 (9.0.0, D39·D40)
//
// **실제 엔진의 `src/engine/liability-cap.mjs`를 그대로 옮겨 적은 것이다.** 세법
// 수치는 한 개도 여기에 없다 — 구간 경계·비율·기본공제액·근로소득세액공제 한도는
// 전부 룰셋에서 읽는다. 제2항 한도는 룰셋이 산식을 **문자열**로 적어 두었으므로
// 그 문자열을 기계적으로 읽는다.
//
// **11.0.0(D46 1번·D49) — 단계마다 버리지 않는다.** 전에는 이 절이 구간 산식마다
// `Math.floor`로 원 미만을 버렸고, 그래서 근로소득공제의 끝수가 위로 밀려 과세표준이
// 조문보다 항상 정확히 1원 컸다. 「국고금 관리법」 §47조가 끝수를 없애라고 지목한
// 자리는 과세표준(제2항) 하나뿐이므로, 이 절은 이제 **정확값(정수 분수)으로 계산하고
// 그 자리에서만 버린다.** 어디서 무엇을 얼마 단위로 버리는지는 산문이 아니라 룰셋의
// `stage_code`·`operation_code`·`unit_krw`·`determined_by_law` 네 칸에서 읽는다
// (아래 `createRoundingPolicyMock`) — `src/engine/exact.mjs`·`rounding.mjs`와 같은
// 방식을 이 목이 (실제 엔진을 임포트하지 않고) 독립적으로 다시 구현한 것이다.
// §47①(10원, 국고금의 수입·지출)은 이 엔진의 출력에 걸리지 않는다 — 룰셋의
// `binds_engine_output`이 `false`가 아니면 10원 단위를 아무 데나 걸지 않고 멈춘다.
// ---------------------------------------------------------------------------

/**
 * 세액 한도 산출에 쓰는 규칙 id — 정렬해 `basis_rule_ids`에 싣는다.
 * **11.0.0부터 일곱이다**(D46 1번·D49) — 이제 이 계산이 원 미만 처리 규약도
 * 실제로 읽으므로(`tax.rounding.won_fraction`), 그 규칙도 근거에 실려야 한다.
 * `src/engine/liability-cap.mjs`의 `CAP_ESTIMATE_RULE_IDS`와 같은 목록이다.
 */
const CAP_ESTIMATE_RULE_IDS = [
  'income.deduction.basic.self',
  'tax.rate.basic',
  'pension.credit.tax_liability_cap',
  'pension.credit.tax_liability_cap.current_year_estimate',
  'tax.rounding.won_fraction',
  'credit.wage_income',
  'income.wage.deduction',
].sort();

// -- 원 미만을 정확히 들고 다니는 정수 분수 (D46 1번·D49) --------------------
//
// `src/engine/exact.mjs`와 같은 방식이다 — 분모를 없애지 않고 그대로 BigInt로
// 들고 다닌다. 부동소수점을 쓰지 않는 이유도 같다: 십진 소수를 이진 부동소수점으로
// 곱하면 정확히 정수여야 할 곱이 미세하게 작게 나와 절사에서 1원이 사라진다.
// **세법 수치는 여기 없다** — 「분수를 어떻게 더하고 비교하고 버리는가」만 안다.

const EXACT_ZERO = { n: 0n, d: 1n };

/** 정수 원을 정확값으로. 정수가 아니면 `null` — 값을 지어내지 않는다. */
function exactOf(krw) {
  if (typeof krw !== 'number' || !Number.isSafeInteger(krw)) return null;
  return { n: BigInt(krw), d: 1n };
}
function isExactValue(v) {
  return v !== null && typeof v === 'object' && typeof v.n === 'bigint' && typeof v.d === 'bigint';
}
function guardExact(...values) {
  return values.every(isExactValue);
}
function addExact(a, b) {
  if (!guardExact(a, b)) return null;
  return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
}
function subExact(a, b) {
  if (!guardExact(a, b)) return null;
  return { n: a.n * b.d - b.n * a.d, d: a.d * b.d };
}
function mulExact(a, b) {
  if (!guardExact(a, b)) return null;
  return { n: a.n * b.n, d: a.d * b.d };
}
function divExact(a, b) {
  if (!guardExact(a, b) || b.n === 0n) return null;
  const n = a.n * b.d;
  const d = a.d * b.n;
  return d < 0n ? { n: -n, d: -d } : { n, d };
}
/** `{num, den}` 꼴의 비율(`toRatio`의 결과)을 곱한다. */
function scaleExact(a, ratio) {
  if (!guardExact(a) || ratio === null || typeof ratio !== 'object') return null;
  const { num, den } = ratio;
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den === 0) return null;
  const scaled = { n: a.n * BigInt(num), d: a.d * BigInt(den) };
  return scaled.d < 0n ? { n: -scaled.n, d: -scaled.d } : scaled;
}
/** −1 / 0 / +1. **비교는 언제나 정확값으로 한다** — 룰셋의 `comparison` 단계. */
function cmpExact(a, b) {
  if (!guardExact(a, b)) return null;
  const left = a.n * b.d;
  const right = b.n * a.d;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
function minExact(a, b) {
  const order = cmpExact(a, b);
  if (order === null) return null;
  return order <= 0 ? a : b;
}
function maxExact(a, b) {
  const order = cmpExact(a, b);
  if (order === null) return null;
  return order >= 0 ? a : b;
}
/** 음수를 0으로. */
function clampExactToZero(a) {
  return maxExact(a, EXACT_ZERO);
}
/**
 * `unit` 배수로 **버린다**. 단위도 연산도 이 함수가 정하지 않는다 — 부르는 쪽이
 * 룰셋의 `unit_krw`를 그대로 넘긴다. 음수에서도 「내림」이다(0 방향 절단이 아니다).
 */
function floorExactToUnit(a, unitKrw) {
  if (!guardExact(a)) return null;
  if (!Number.isSafeInteger(unitKrw) || unitKrw <= 0) return null;
  const unit = BigInt(unitKrw);
  const n = a.n;
  const d = a.d * unit;
  const quotient = n >= 0n || n % d === 0n ? n / d : n / d - 1n;
  return { n: quotient * unit, d: 1n };
}
function isExactInteger(a) {
  if (!guardExact(a)) return false;
  return a.n % a.d === 0n;
}
/**
 * 정수 원으로 꺼낸다. **정수가 아니면 `null`** — 여기서 몰래 버리면 이 함수가 있는
 * 이유가 사라진다. 버리는 것은 언제나 아래 `createRoundingPolicyMock`이 룰셋을 읽고
 * 하는 일이다.
 */
function exactToInteger(a) {
  if (!isExactInteger(a)) return null;
  const value = Number(a.n / a.d);
  return Number.isSafeInteger(value) ? value : null;
}

// -- 원 미만 처리 규약을 룰셋에서 읽는다 (D46 1번·D49) ------------------------
//
// `src/engine/rounding.mjs`와 같은 방식이다. **산문을 읽지 않는다** — 룰셋 자신이
// 그렇게 정했다(`tax.rounding.won_fraction`의 `engine_contract`). `stage_code`·
// `operation_code`·`unit_krw`·`determined_by_law` 네 칸만 읽고, 조문이 정한 자리
// (`statutory`)와 이 조직이 정한 자리(`convention`)를 뒤바꿔 부르면 값이 나오지
// 않는다 — 룰셋에서 그 칸이 뒤집혀도 같은 일이 일어난다.

const ROUNDING_STAGE_MOCK = {
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
const ROUNDING_STAGES_MOCK = Object.values(ROUNDING_STAGE_MOCK);
/** 엔진이 실제로 할 줄 아는 연산. 룰셋이 다른 이름을 적으면 지어내지 않고 멈춘다. */
const ROUNDING_OP_MOCK = { FLOOR: 'floor', NONE: 'none' };

/** 단계 노드가 이 목이 쓸 수 있는 형태인가. 아니면 `null` — 지어내지 않는다. */
function readRoundingStageMock(node) {
  if (node === null || typeof node !== 'object') return null;
  if (typeof node.operation_code !== 'string') return null;
  if (typeof node.determined_by_law !== 'boolean') return null;
  const unit = node.unit_krw ?? null;
  if (unit !== null && !Number.isSafeInteger(unit)) return null;
  if (node.operation_code !== ROUNDING_OP_MOCK.FLOOR && node.operation_code !== ROUNDING_OP_MOCK.NONE) return null;
  // 버리는 연산인데 단위가 없으면 얼마 단위로 버릴지 알 수 없다. 1원으로 가정하지 않는다.
  if (node.operation_code === ROUNDING_OP_MOCK.FLOOR && unit === null) return null;
  return { operationCode: node.operation_code, unitKrw: unit, determinedByLaw: node.determined_by_law };
}

/**
 * 원 미만 처리 규약을 룰셋에서 읽어 손잡이로 만든다. 읽지 못하면(또는 룰셋의 칸이
 * 뒤집혀 있으면) `null` — 부르는 쪽이 계산을 멈춘다. `missingRules`가 있으면 규칙이
 * 발견됐는데도 쓸 수 없는 형태였다는 사실을 그 배열에 남긴다(`use()`는 규칙 자체가
 * 없을 때만 기록하지, 있는데 못 쓰는 형태인 경우는 기록하지 않는다).
 */
function createRoundingPolicyMock(use, appliedTo, missingRules) {
  const ruleId = 'tax.rounding.won_fraction';
  const rule = use(ruleId, appliedTo);
  if (!rule) return null;

  const fail = () => {
    if (Array.isArray(missingRules)) missingRules.push(ruleId);
    return null;
  };

  const value = rule.value ?? {};
  const declared = value.stages;
  if (!Array.isArray(declared)) return fail();

  const stages = new Map();
  for (const node of declared) {
    if (node === null || typeof node !== 'object' || typeof node.stage_code !== 'string') continue;
    const stage = readRoundingStageMock(node);
    if (stage === null) return fail();
    stages.set(node.stage_code, stage);
  }
  // 이 목이 서는 다섯 단계가 전부 선언되어 있어야 한다.
  for (const stageCode of ROUNDING_STAGES_MOCK) {
    if (!stages.has(stageCode)) return fail();
  }

  // §47①이 우리에게 걸리는가. **룰셋이 값으로 답한다** — 산문이 아니라
  // `binds_engine_output` 칸이다. 이 엔진이 내는 것은 세액공제로 줄어드는 세액과
  // 그 한도이므로 오늘의 답은 `false`다. `false`가 아니면 어느 출력이 국고금의
  // 수입·지출인지 룰셋이 말해 주지 않으므로 10원 단위를 아무 데나 걸지 않고 멈춘다.
  const treasuryBinds = declared.find((node) => node?.stage_code === ROUNDING_STAGE_MOCK.TREASURY)?.binds_engine_output;
  if (treasuryBinds !== false) return fail();

  // 개인지방소득세분은 `stages` 밖에 따로 있다(§47③이 「준용할 수 있다」는 임의규정).
  const localStage = readRoundingStageMock(value.local_income_tax_stage ?? null);
  if (localStage === null) return fail();

  /** 단계의 연산을 정확값에 적용한다. 연산도 단위도 룰셋의 칸에서 온다. */
  function apply(stage, exact) {
    if (stage === undefined || exact === null) return null;
    if (stage.operationCode === ROUNDING_OP_MOCK.NONE) return exact;
    return floorExactToUnit(exact, stage.unitKrw);
  }
  /** 조문이 정한 자리인지 우리가 정한 자리인지를 부르는 쪽이 **선언하고** 들어온다. */
  function at(stageCode, exact, requiredDeterminedByLaw) {
    const stage = stages.get(stageCode);
    if (stage === undefined || stage.determinedByLaw !== requiredDeterminedByLaw) return null;
    return apply(stage, exact);
  }

  return {
    /** 조문이 정한 자리(§47②). `determined_by_law`가 `true`가 아니면 값을 내지 않는다. */
    statutory: (stageCode, exact) => at(stageCode, exact, true),
    /** 이 조직이 정한 자리. `determined_by_law`가 `false`가 아니면 값을 내지 않는다. */
    convention: (stageCode, exact) => at(stageCode, exact, false),
    /** 개인지방소득세분. 조문이 정하지 않았으므로 규약 쪽이다. */
    localSurtax: (exact) => (localStage.determinedByLaw === false ? apply(localStage, exact) : null),
    /** 응답에 정수 원으로 싣는다. 표시 단계는 **우리가 정한 자리**다. */
    display: (exact) => exactToInteger(at(ROUNDING_STAGE_MOCK.DISPLAYED, exact, false)),
    /** 개인지방소득세분을 정수 원으로. */
    displayLocal: (exact) =>
      exactToInteger(localStage.determinedByLaw === false ? apply(localStage, exact) : null),
  };
}

/**
 * `base_krw + (x − threshold_krw) × rate_on_excess` 꼴의 구간표를 **정확값**으로
 * 읽는다. 근로소득공제·기본세율·근로소득세액공제 제1항이 같은 모양을 쓴다. 경계값은
 * 아래 구간에 속한다(문언이 '이하'). **원 미만을 여기서 버리지 않는다** — 조문이 이
 * 값들을 끝수 계산의 대상으로 지목하지 않았다(룰셋 `intermediate_amount`).
 */
function capBracketAmountExact(brackets, maxKey, xExact) {
  if (!Array.isArray(brackets) || xExact === null) return null;
  const bracket = brackets.find((b) => {
    const max = b?.[maxKey] ?? null;
    if (max === null) return true;
    const order = cmpExact(xExact, exactOf(max));
    return order !== null && order <= 0;
  });
  if (bracket === undefined) return null;
  if (typeof bracket.base_krw !== 'number' || typeof bracket.threshold_krw !== 'number') return null;
  const excess = clampExactToZero(subExact(xExact, exactOf(bracket.threshold_krw)));
  const scaled = scaleExact(excess, toRatio(bracket.rate_on_excess));
  if (scaled === null) return null;
  return addExact(exactOf(bracket.base_krw), scaled);
}

/** 근로소득세액공제 제2항의 한도. 첫 구간만 금액이고 나머지 셋은 룰셋에 문자열로 있다. */
const CAP_LIMIT_FORMULA = /^(\d+)\s*[−-]\s*\(\s*총급여액\s*[−-]\s*(\d+)\s*\)\s*[×x*]\s*(\d+)\s*\/\s*(\d+)$/;

/** 위와 같은 이유로 정확값을 낸다 — 감액률이 8/1000이라 총급여가 1,000의 배수가
 * 아니면 여기서 끝수가 나고, 버리면 한도가 커져 세액 한도가 작아진다(방향이 있는
 * 자리이므로 정확값 그대로 넘긴다).
 */
function capWageCreditLimitExact(brackets, totalSalary) {
  if (!Array.isArray(brackets)) return null;
  const bracket = brackets.find((b) => (b?.total_salary_max_krw ?? null) === null || totalSalary <= b.total_salary_max_krw);
  if (bracket === undefined) return null;
  if (typeof bracket.limit_krw === 'number') return exactOf(bracket.limit_krw);

  const match = CAP_LIMIT_FORMULA.exec(String(bracket.formula ?? '').trim());
  if (match === null || typeof bracket.floor_krw !== 'number') return null;
  const [base, threshold, numerator, denominator] = match.slice(1).map(Number);
  if (denominator === 0) return null;
  const reduction = scaleExact(
    clampExactToZero(subExact(exactOf(totalSalary), exactOf(threshold))),
    { num: numerator, den: denominator },
  );
  const limit = subExact(exactOf(base), reduction);
  const floorAmount = exactOf(bracket.floor_krw);
  const order = cmpExact(limit, floorAmount);
  if (order === null) return null;
  return order >= 0 ? limit : floorAmount;
}

/**
 * 어느 분기인가. **엔진이 판정하는 것은 분기뿐이고 그 분기의 오차 방향은 룰셋이
 * 정한다.** 분기의 `direction`이 규칙의 상한 코드로 시작하면 상한이고, 아니면
 * 미정이다 — 산문을 파싱해 코드를 만들지 않는다.
 */
function capBranchOf(profile) {
  if (profile.has_non_wage_global_income_current_year !== true) return CAP_BRANCH.WAGE_ONLY;
  if (profile.current_year_global_income_krw != null) return CAP_BRANCH.GLOBAL_INCOME_SUPPLIED;
  return CAP_BRANCH.GLOBAL_INCOME_MISSING;
}

/**
 * 세액 한도를 총급여액에서 산출한다(네 단계, 규칙의 `statutory_path`). `use`는
 * `computeScenario`의 규칙 조회 헬퍼다 — 규칙을 찾지 못하면 이미 `missingRules`에
 * 기록되고 여기서는 `null`을 돌려준다(대체값을 만들지 않는다). `missingRules`는
 * 원 미만 처리 규약이 룰셋에서 malformed로 읽힐 때(칸이 뒤집혔을 때 포함) 그 사실을
 * 기록하는 용도로만 `createRoundingPolicyMock`에 전달한다.
 */
function resolveTaxLiabilityCapMock(use, profile, missingRules) {
  const appliedTo = 'pension_credit_tax_liability_cap.cap_krw';
  const deductionRule = use('income.wage.deduction', appliedTo);
  const basicDeductionRule = use('income.deduction.basic.self', appliedTo);
  const rateRule = use('tax.rate.basic', appliedTo);
  const creditRule = use('credit.wage_income', appliedTo);
  const capRule = use('pension.credit.tax_liability_cap', appliedTo);
  const estimateRule = use('pension.credit.tax_liability_cap.current_year_estimate', appliedTo);
  // 사용자가 서식에서 값을 읽던 경로가 이 계산으로 대체됐다는 사실이 그 규칙에 적혀 있다.
  const sourceRule = use('pension.credit.tax_liability_cap.source_form', appliedTo);
  // 원 미만을 어디서 어떻게 없애는지. 읽지 못하면 계산하지 않는다 — 규약 없이
  // 계산을 이어 가면 어디선가 `Math.floor`를 다시 쓰게 되고, 그것이 조문에 없는
  // 세 번째 절사 자리다(D46 1번·D49).
  const rounding = createRoundingPolicyMock(use, appliedTo, missingRules);
  if (!deductionRule || !basicDeductionRule || !rateRule || !creditRule || !capRule || !estimateRule || !sourceRule || !rounding) {
    return null;
  }

  // 아래에서 `null`을 돌려주는 모든 자리는 **규칙이 발견됐는데도 쓸 수 없는
  // 형태였다는 뜻**이다(`use()`는 규칙 자체가 없을 때만 자동으로 기록한다).
  // 실제 엔진에서는 `capResult.cap === null`이 계산 전체를 세운다(compute.mjs
  // 4.5절) — 대체값을 만들지 않고 조용히 "한도 모름"으로 넘어가지 않는다. 이
  // 목도 같은 형태를 지키려면 이 지점들이 `missingRules`에 남아야 한다.
  const fail = (ruleId) => {
    if (Array.isArray(missingRules)) missingRules.push(ruleId);
    return null;
  };

  const branch = capBranchOf(profile);
  const branchNode = estimateRule.value?.branches?.[branch];
  const upperBoundCode = estimateRule.value?.error_direction?.code;
  if (branchNode === undefined || typeof branchNode.direction !== 'string' || typeof upperBoundCode !== 'string') {
    return fail(estimateRule.id);
  }
  const isUpperBound = branchNode.direction.startsWith(upperBoundCode);
  const totalSalary = profile.current_year_total_salary_krw;

  // 1단계. 공제액이 총급여액을 넘지 못하고(§47③) 2천만원 상한이 걸린다(§47① 단서).
  const bracketDeduction = capBracketAmountExact(deductionRule.value.brackets, 'total_salary_max_krw', exactOf(totalSalary));
  if (bracketDeduction === null || typeof deductionRule.value.overall_cap_krw !== 'number') return fail(deductionRule.id);
  // **여기서 버리지 않는다**(D46 1번) — 전에는 이 값을 먼저 버리고 총급여에서 빼서
  // 과세표준이 조문보다 1원 컸다.
  const wageDeduction = minExact(minExact(bracketDeduction, exactOf(deductionRule.value.overall_cap_krw)), exactOf(totalSalary));
  const wageIncome = subExact(exactOf(totalSalary), wageDeduction);

  // 2단계. 종합소득금액을 받았으면 그것이 조문상의 합산 기준 그 자체다.
  const basicDeduction = basicDeductionRule.value?.amount_krw;
  if (typeof basicDeduction !== 'number') return fail(basicDeductionRule.id);
  const globalIncome =
    branch === CAP_BRANCH.GLOBAL_INCOME_SUPPLIED ? exactOf(profile.current_year_global_income_krw) : wageIncome;
  // **조문이 지목한 유일한 자리다**(국고금 관리법 §47②). 1원 미만을 여기서 한 번
  // 버린다. `statutory()`가 `null`을 돌려주는 것은 `determined_by_law`가 뒤집혀
  // 있을 때도 포함한다 — 그것이 바로 이 자리에서 「값이 나오지 않고 멈춘다」의 뜻이다.
  const taxBaseExact = rounding.statutory(
    ROUNDING_STAGE_MOCK.TAX_BASE,
    clampExactToZero(subExact(globalIncome, exactOf(basicDeduction))),
  );
  if (taxBaseExact === null) return fail('tax.rounding.won_fraction');

  // 3단계.
  const computedTaxExact = capBracketAmountExact(rateRule.value.brackets, 'tax_base_max_krw', taxBaseExact);
  if (computedTaxExact === null) return fail(rateRule.id);

  // 4단계. 근로소득 외 소득이 있으면 근로소득금액 비율로 안분한 산출세액을 제1항에 넣는다.
  const globalIncomePositive = cmpExact(globalIncome, EXACT_ZERO) > 0;
  const wagePortionTaxExact = globalIncomePositive
    ? divExact(mulExact(computedTaxExact, minExact(wageIncome, globalIncome)), globalIncome)
    : EXACT_ZERO;
  const creditByAmountExact = capBracketAmountExact(
    creditRule.value.amount_brackets,
    'wage_income_tax_max_krw',
    wagePortionTaxExact,
  );
  const creditLimitExact = capWageCreditLimitExact(creditRule.value.limit_brackets, totalSalary);
  if (creditByAmountExact === null || creditLimitExact === null) return fail(creditRule.id);
  const wageCreditExact = minExact(creditByAmountExact, creditLimitExact);

  // **한도의 정확값.** 응답에는 정수 원으로 실리지만(표시 단계에서 한 번 버린다),
  // 공제액과의 대소 판정은 이 값으로 한다 — 절사한 값으로 비교하면 1원 미만의 차이가
  // 사라져 `applied`가 뒤집힌다(룰셋 `comparison` 단계).
  const capExact = clampExactToZero(subExact(computedTaxExact, wageCreditExact));
  const capKrw = rounding.display(capExact);
  const wageDeductionKrw = rounding.display(wageDeduction);
  const wageIncomeKrw = rounding.display(wageIncome);
  // §47②가 이미 정수로 만든 값이지만 표시 단계를 한 번 더 지난다 — 응답에 실리는
  // 정수는 전부 같은 문을 통과한다는 규약이고, 조문 단계가 정수를 내는 한 이 통과는
  // 값을 바꾸지 않는다.
  const taxBaseKrw = rounding.display(taxBaseExact);
  const computedTaxKrw = rounding.display(computedTaxExact);
  const wageCreditKrw = rounding.display(wageCreditExact);
  if ([capKrw, wageDeductionKrw, wageIncomeKrw, taxBaseKrw, computedTaxKrw, wageCreditKrw].some((v) => v === null)) {
    return fail('tax.rounding.won_fraction');
  }

  const errorDirection = isUpperBound ? upperBoundCode : CAP_DIRECTION_INDETERMINATE;
  const basisRuleIds = [...CAP_ESTIMATE_RULE_IDS, sourceRule.id].sort();
  const carryforward = capRule.value?.excess_treatment?.credit_carryforward ?? false;

  return {
    branch,
    isUpperBound,
    errorDirection,
    basisRuleIds,
    // 같은 규약을 배분안과 축도 쓴다 — 한 번 읽어 넘긴다. 두 번 읽으면 두 규약이 된다.
    rounding,
    // **응답에 실리지 않는 정확값.** 대소 판정을 하는 자리(배분안의 자르기, 축과의
    // 비교)가 이 값을 쓴다.
    capExact,
    cap: {
      // **`null`이 아니다.** 총급여액이 있으면 값이 하나로 정해진다.
      cap_krw: capKrw,
      basis_code: CAP_BASIS,
      branch_code: branch,
      error_direction_code: errorDirection,
      is_upper_bound: isUpperBound,
      // 상한이 0이면 실제 한도도 0 이하일 수 없으므로 정확히 0이다. 그 구간에서만 등식이다.
      is_exact: isUpperBound && capKrw === 0,
      measured_total_salary_krw: totalSalary,
      measured_global_income_krw: branch === CAP_BRANCH.GLOBAL_INCOME_SUPPLIED ? profile.current_year_global_income_krw : null,
      wage_income_deduction_krw: wageDeductionKrw,
      wage_income_amount_krw: wageIncomeKrw,
      basic_deduction_krw: basicDeduction,
      tax_base_krw: taxBaseKrw,
      computed_tax_krw: computedTaxKrw,
      wage_income_credit_krw: wageCreditKrw,
      credit_carryforward: carryforward,
      basis_rule_ids: basisRuleIds,
    },
  };
}

/**
 * 이 배분안에서 **한도가 걸린다는 것이 증명되는가**(D40). 추정 한도가 잘랐고 그
 * 추정이 상한이면 실제 한도는 그보다 작거나 같으므로 반드시 잘린다. 자르지 않은
 * 경우는 아무것도 증명하지 못한다 — 문장의 부재가 「안 걸림」을 뜻하지 않는다.
 */
function capBindingCodeFor(applied, isUpperBound) {
  return applied && isUpperBound ? CAP_BINDING.PROVABLE : CAP_BINDING.NOT_DETERMINED;
}

// ---------------------------------------------------------------------------
// 요청 검증 (7.1 / 8.1)
// ---------------------------------------------------------------------------

function err(code, field, params) {
  return { code, field: field ?? null, params: params ?? {} };
}

function isInt(v) {
  return typeof v === 'number' && Number.isInteger(v);
}

function validateRequest(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    return [err('missing_required', null, {})];
  }

  if (request.schema_version == null) {
    errors.push(err('missing_required', 'schema_version', {}));
  } else if (String(request.schema_version).split('.')[0] !== KNOWN_SCHEMA_MAJOR) {
    errors.push(
      err('schema_version_mismatch', 'schema_version', {
        received: request.schema_version,
        known_major: KNOWN_SCHEMA_MAJOR,
      }),
    );
  }

  if (request.tax_year == null) errors.push(err('missing_required', 'tax_year', {}));
  else if (!isInt(request.tax_year)) errors.push(err('not_integer', 'tax_year', {}));

  if (request.scenarios == null) {
    errors.push(err('missing_required', 'scenarios', {}));
  } else if (!Array.isArray(request.scenarios) || request.scenarios.length === 0) {
    errors.push(err('empty_scenarios', 'scenarios', {}));
  } else {
    for (const s of request.scenarios) {
      if (!SCENARIO_ORDER.includes(s)) errors.push(err('unknown_scenario', 'scenarios', { value: s }));
    }
  }

  if (request.profile == null) {
    errors.push(err('missing_required', 'profile', {}));
  } else {
    errors.push(...validateProfile(request.profile));
  }

  if (request.accounts == null) {
    errors.push(err('missing_required', 'accounts', {}));
  } else {
    errors.push(...validateAccounts(request.accounts));
  }

  if (request.isa_transfer != null) {
    errors.push(...validateIsaTransfer(request.isa_transfer, request.accounts));
  }

  if (request.options != null) {
    errors.push(...validateOptions(request.options));
  }

  return errors;
}

function validateProfile(p) {
  const errors = [];
  // 만 나이가 아니라 생년월일을 받는다(D21). 환산은 엔진이 한다.
  if (p.birth_date == null) errors.push(err('missing_required', 'profile.birth_date', {}));
  // 오류 params에 입력값을 되풀이하지 않는다(계약 8.1절).
  else if (parseIsoDate(p.birth_date) === null) errors.push(err('invalid_date', 'profile.birth_date', { format: 'YYYY-MM-DD' }));

  if (p.current_year_total_salary_krw == null)
    errors.push(err('missing_required', 'profile.current_year_total_salary_krw', {}));
  else if (!isInt(p.current_year_total_salary_krw))
    errors.push(err('not_integer', 'profile.current_year_total_salary_krw', {}));
  else if (p.current_year_total_salary_krw < 0)
    errors.push(err('negative_value', 'profile.current_year_total_salary_krw', {}));

  if (p.prior_year_total_salary_krw != null) {
    if (!isInt(p.prior_year_total_salary_krw))
      errors.push(err('not_integer', 'profile.prior_year_total_salary_krw', {}));
    else if (p.prior_year_total_salary_krw < 0)
      errors.push(err('negative_value', 'profile.prior_year_total_salary_krw', {}));
  }

  // 5.0.0(D27) — 공제율 판정 축의 첫 물음. **필수다** — 선택으로 두면 null일 때의
  // 기본값이 둘 다 틀린다(0.6절). `false`면 두 번째 물음을 묻지 않는다.
  if (p.has_non_wage_global_income_current_year == null) {
    errors.push(err('missing_required', 'profile.has_non_wage_global_income_current_year', {}));
  } else if (typeof p.has_non_wage_global_income_current_year !== 'boolean') {
    errors.push(err('invalid_enum', 'profile.has_non_wage_global_income_current_year', {}));
  }

  if (p.current_year_global_income_krw != null) {
    if (!isInt(p.current_year_global_income_krw))
      errors.push(err('not_integer', 'profile.current_year_global_income_krw', {}));
    else if (p.current_year_global_income_krw < 0)
      errors.push(err('negative_value', 'profile.current_year_global_income_krw', {}));
    // `false`인데 금액이 실려 오면 둘 중 무엇이 사용자의 답인지 엔진이 고르지 않는다.
    if (p.has_non_wage_global_income_current_year === false) {
      errors.push(
        err('invalid_enum', 'profile.has_non_wage_global_income_current_year', {
          reason: 'current_year_global_income_krw_present',
        }),
      );
    }
  }

  if (p.fund_use_horizon == null) {
    errors.push(err('missing_required', 'profile.fund_use_horizon', {}));
  } else if (
    !['within_isa_lock_in', 'before_pension_age', 'at_or_after_pension_age', 'unknown'].includes(
      p.fund_use_horizon,
    )
  ) {
    errors.push(err('invalid_enum', 'profile.fund_use_horizon', { value: p.fund_use_horizon }));
  }

  if (p.monthly_capacity_krw == null)
    errors.push(err('missing_required', 'profile.monthly_capacity_krw', {}));
  else if (!isInt(p.monthly_capacity_krw))
    errors.push(err('not_integer', 'profile.monthly_capacity_krw', {}));
  else if (p.monthly_capacity_krw < 0)
    errors.push(err('negative_value', 'profile.monthly_capacity_krw', {}));

  if (p.months_remaining_in_tax_year != null) {
    if (!isInt(p.months_remaining_in_tax_year))
      errors.push(err('not_integer', 'profile.months_remaining_in_tax_year', {}));
    else if (p.months_remaining_in_tax_year < 1 || p.months_remaining_in_tax_year > 12)
      errors.push(err('out_of_range', 'profile.months_remaining_in_tax_year', {}));
  }

  if (
    p.financial_income_taxpayer_last_3_years != null &&
    typeof p.financial_income_taxpayer_last_3_years !== 'boolean'
  ) {
    errors.push(err('invalid_enum', 'profile.financial_income_taxpayer_last_3_years', {}));
  }
  if (p.declared_youth != null && typeof p.declared_youth !== 'boolean') {
    errors.push(err('invalid_enum', 'profile.declared_youth', {}));
  }

  // 10.0.0(D44) — 새 입력 둘. **오늘의 확정 룰셋은 어느 분기의 `when`에서도 이
  // 두 필드를 가리키지 않으므로 답을 보내도 응답이 한 원도 바뀌지 않는다**
  // (계약 3.1절). 그래도 요청에서 받고 형태만 검증한다 — 룰셋이 `when`에 그
  // 필드를 넣는 순간 엔진을 고치지 않고도 값이 판정에 반영되어야 하기 때문이다.
  // **화면은 이 두 칸을 아직 띄우지 않는다**(관리자 D47 이전 판정).
  if (p.has_business_income_current_year != null && typeof p.has_business_income_current_year !== 'boolean') {
    errors.push(err('invalid_enum', 'profile.has_business_income_current_year', {}));
  }
  if (p.received_retirement_lumpsum_ever != null && typeof p.received_retirement_lumpsum_ever !== 'boolean') {
    errors.push(err('invalid_enum', 'profile.received_retirement_lumpsum_ever', {}));
  }

  if (p.isa_return_assumption != null) {
    errors.push(...validateIsaReturnAssumption(p.isa_return_assumption));
  }

  return errors;
}

/**
 * 계약 3.6절 `IsaReturnAssumption` (D28·D29). **객체 자체가 선택이다** — 여기 없으면
 * ISA 금액을 한 원도 내지 않는다. **보냈으면 수익률과 소득 성격은 둘 다 필수다** —
 * 성격 없이 수익률만 받으면 없는 혜택을 있다고 말하게 된다(과대 방향).
 */
function validateIsaReturnAssumption(node) {
  const errors = [];
  const field = 'profile.isa_return_assumption';
  if (node == null || typeof node !== 'object' || Array.isArray(node)) {
    errors.push(err('invalid_enum', field, { value: String(node) }));
    return errors;
  }

  const rate = node.annual_return_rate;
  if (rate == null) {
    errors.push(err('missing_required', `${field}.annual_return_rate`, {}));
  } else if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    errors.push(err('not_integer', `${field}.annual_return_rate`, { value: String(rate) }));
  } else if (rate < 0) {
    // 음(−)의 수익률은 손실이고, 손실은 loss_amount_krw가 받는다.
    errors.push(err('negative_value', `${field}.annual_return_rate`, { value: rate }));
  }

  if (node.income_character == null) {
    errors.push(err('missing_required', `${field}.income_character`, {}));
  } else if (!ISA_INCOME_CHARACTERS.includes(node.income_character)) {
    errors.push(err('invalid_enum', `${field}.income_character`, { value: node.income_character }));
  }

  if (node.settlement_years != null) {
    if (!isInt(node.settlement_years)) errors.push(err('not_integer', `${field}.settlement_years`, {}));
    else if (node.settlement_years < 1) errors.push(err('out_of_range', `${field}.settlement_years`, {}));
  }
  if (node.loss_amount_krw != null) {
    if (!isInt(node.loss_amount_krw)) errors.push(err('not_integer', `${field}.loss_amount_krw`, {}));
    else if (node.loss_amount_krw < 0) errors.push(err('negative_value', `${field}.loss_amount_krw`, {}));
  }

  return errors;
}

function validatePensionAccount(a, field, errors) {
  if (!a || a.ytd_contribution_krw == null) {
    errors.push(err('missing_required', `${field}.ytd_contribution_krw`, {}));
    if (!a) return;
  } else if (!isInt(a.ytd_contribution_krw)) errors.push(err('not_integer', `${field}.ytd_contribution_krw`, {}));
  else if (a.ytd_contribution_krw < 0) errors.push(err('negative_value', `${field}.ytd_contribution_krw`, {}));

  // **기본값을 두지 않는다.** 이 항목의 기본값 실수는 연금 수령 중인 사용자에게
  // 납입 가능액을 주는 방향, 즉 과대 방향으로 틀린다(계약 0.5절 (1)).
  if (a.annuity_start_status == null) errors.push(err('missing_required', `${field}.annuity_start_status`, {}));
  else if (!ANNUITY_START_VALUES.includes(a.annuity_start_status)) {
    errors.push(err('invalid_enum', `${field}.annuity_start_status`, { value: a.annuity_start_status }));
  }

  if (a.opened_on != null && parseIsoDate(a.opened_on) === null) {
    errors.push(err('invalid_date', `${field}.opened_on`, { format: 'YYYY-MM-DD' }));
  }
  if (a.has_deferred_retirement_income != null && typeof a.has_deferred_retirement_income !== 'boolean') {
    errors.push(err('invalid_enum', `${field}.has_deferred_retirement_income`, {}));
  }
  if (a.retirement_transfer_in_krw != null) {
    if (!isInt(a.retirement_transfer_in_krw)) errors.push(err('not_integer', `${field}.retirement_transfer_in_krw`, {}));
    else if (a.retirement_transfer_in_krw < 0) errors.push(err('negative_value', `${field}.retirement_transfer_in_krw`, {}));
  }
}

function validateAccounts(accounts) {
  const errors = [];
  validatePensionAccount(accounts.annuity_savings, 'accounts.annuity_savings', errors);
  validatePensionAccount(accounts.retirement_pension, 'accounts.retirement_pension', errors);

  const isa = accounts.isa;
  if (!isa) {
    errors.push(err('missing_required', 'accounts.isa', {}));
    return errors;
  }
  if (isa.exists == null) errors.push(err('missing_required', 'accounts.isa.exists', {}));
  else if (typeof isa.exists !== 'boolean') errors.push(err('invalid_enum', 'accounts.isa.exists', {}));

  if (isa.account_type != null && !['general', 'low_income'].includes(isa.account_type)) {
    errors.push(err('invalid_enum', 'accounts.isa.account_type', { value: isa.account_type }));
  }

  if (isa.cumulative_contribution_krw == null)
    errors.push(err('missing_required', 'accounts.isa.cumulative_contribution_krw', {}));
  else if (!isInt(isa.cumulative_contribution_krw))
    errors.push(err('not_integer', 'accounts.isa.cumulative_contribution_krw', {}));
  else if (isa.cumulative_contribution_krw < 0)
    errors.push(err('negative_value', 'accounts.isa.cumulative_contribution_krw', {}));

  if (isa.ytd_contribution_krw == null)
    errors.push(err('missing_required', 'accounts.isa.ytd_contribution_krw', {}));
  else if (!isInt(isa.ytd_contribution_krw))
    errors.push(err('not_integer', 'accounts.isa.ytd_contribution_krw', {}));
  else if (isa.ytd_contribution_krw < 0)
    errors.push(err('negative_value', 'accounts.isa.ytd_contribution_krw', {}));
  else if (
    isInt(isa.cumulative_contribution_krw) &&
    isa.ytd_contribution_krw > isa.cumulative_contribution_krw
  ) {
    errors.push(err('isa_ytd_exceeds_cumulative', 'accounts.isa.ytd_contribution_krw', {}));
  }

  if (isa.years_since_opening != null) {
    if (!isInt(isa.years_since_opening))
      errors.push(err('not_integer', 'accounts.isa.years_since_opening', {}));
    else if (isa.years_since_opening < 0)
      errors.push(err('negative_value', 'accounts.isa.years_since_opening', {}));
  }
  if (isa.other_savings_contract_krw != null) {
    if (!isInt(isa.other_savings_contract_krw))
      errors.push(err('not_integer', 'accounts.isa.other_savings_contract_krw', {}));
    else if (isa.other_savings_contract_krw < 0)
      errors.push(err('negative_value', 'accounts.isa.other_savings_contract_krw', {}));
  }

  return errors;
}

function validateIsaTransfer(t, accounts) {
  const errors = [];
  if (t.amount_krw == null) errors.push(err('missing_required', 'isa_transfer.amount_krw', {}));
  else if (!isInt(t.amount_krw)) errors.push(err('not_integer', 'isa_transfer.amount_krw', {}));
  else if (t.amount_krw < 1) errors.push(err('out_of_range', 'isa_transfer.amount_krw', {}));
  else if (accounts?.isa && isInt(accounts.isa.cumulative_contribution_krw) && t.amount_krw > accounts.isa.cumulative_contribution_krw) {
    errors.push(err('isa_transfer_exceeds_cumulative', 'isa_transfer.amount_krw', {}));
  }

  if (t.destination != null && !['retirement_pension', 'annuity_savings'].includes(t.destination)) {
    errors.push(err('invalid_enum', 'isa_transfer.destination', { value: t.destination }));
  }
  if (t.prior_year_applied_extra_credit_krw != null) {
    if (!isInt(t.prior_year_applied_extra_credit_krw))
      errors.push(err('not_integer', 'isa_transfer.prior_year_applied_extra_credit_krw', {}));
    else if (t.prior_year_applied_extra_credit_krw < 0)
      errors.push(err('negative_value', 'isa_transfer.prior_year_applied_extra_credit_krw', {}));
  }
  if (t.prior_multi_year_applied_extra_credit_krw != null) {
    if (!isInt(t.prior_multi_year_applied_extra_credit_krw))
      errors.push(err('not_integer', 'isa_transfer.prior_multi_year_applied_extra_credit_krw', {}));
    else if (t.prior_multi_year_applied_extra_credit_krw < 0)
      errors.push(err('negative_value', 'isa_transfer.prior_multi_year_applied_extra_credit_krw', {}));
  }
  return errors;
}

function validateOptions(o) {
  const errors = [];
  if (o.plan_variants != null) {
    if (!Array.isArray(o.plan_variants)) {
      errors.push(err('invalid_enum', 'options.plan_variants', {}));
    } else {
      for (const id of o.plan_variants) {
        if (!PLAN_ORDER.includes(id)) errors.push(err('unknown_plan_variant', 'options.plan_variants', { value: id }));
      }
    }
  }
  if (o.include_legal_basis != null && typeof o.include_legal_basis !== 'boolean') {
    errors.push(err('invalid_enum', 'options.include_legal_basis', {}));
  }
  if (o.assumption_based_isa_estimate != null && !ISA_ESTIMATE_DISPLAYS.includes(o.assumption_based_isa_estimate)) {
    errors.push(err('invalid_enum', 'options.assumption_based_isa_estimate', { value: o.assumption_based_isa_estimate }));
  }
  return errors;
}

// ---------------------------------------------------------------------------
// 시나리오 단위 계산
// ---------------------------------------------------------------------------

function fileKeysForScenario(scenario) {
  return scenario === 'proposed' ? ['2027-proposed.json', '2026.json'] : ['2026.json'];
}

function computeScenario(scenario, request, rulesets) {
  const files = fileKeysForScenario(scenario).filter((k) => rulesets[k]);
  const isEnacted = scenario === 'current';
  const profile = request.profile;
  const accounts = request.accounts;
  const isaTransfer = request.isa_transfer ?? null;
  const months = request.months_remaining_effective;
  const birth = parseIsoDate(profile.birth_date);
  const referenceDate = referenceDateFor(request.tax_year);
  const ageYears = ageAtReferenceDate(birth, referenceDate);
  const notices = [];
  const usedRules = new Map(); // ruleId -> { rule, appliedTo: Set }
  const missingRules = [];

  function use(ruleId, appliedTo) {
    const found = findRule(rulesets, ruleId, files);
    if (!found) {
      missingRules.push(ruleId);
      return null;
    }
    if (!usedRules.has(ruleId)) usedRules.set(ruleId, { rule: found.rule, appliedTo: new Set() });
    if (appliedTo) usedRules.get(ruleId).appliedTo.add(appliedTo);
    return found.rule;
  }

  // -- 연금계좌 세액공제율 구간 --------------------------------------------
  // -- 만 나이의 기준일 -----------------------------------------------------
  //
  // **이 규칙을 실제로 읽는다.** 지금까지는 아무도 읽지 않으면서 나이를 환산하고
  // 있었다 — 그러면 `legal_basis`가 "실제로 읽은 규칙만 담는다"(계약 5.7절)를
  // 지키는 대신, 읽지 않은 근거 위에서 계산한 값을 근거 없이 내보내는 것이 된다.
  // 규칙이 없으면 `rule_missing`으로 멈춘다(`use`가 그렇게 동작한다) — 대체값을
  // 만들지 않는다.
  //
  // 규칙이 주는 것은 값이 아니라 **판정 시점**이다. 단일 기준일이 존재하지
  // 않는다는 것이 이 규칙의 결론이고, 그래서 기준일을 하나 고른 사실이
  // 가정으로 나가야 한다.
  use('age.reckoning.reference_date', 'echo.derived_age.reference_date');

  const creditRateRule = use('pension.credit.rate', 'echo.credit_rate_bracket');
  // 5.0.0(D27) — 비율만으로는 화면이 어느 축에서 나왔는지 알 수 없다. 그 구분의
  // 부재가 결함이었다(0.7절).
  const creditRateBasisRule = use('pension.credit.rate.basis_determination', 'echo.credit_rate_bracket.basis_code');
  const surtaxRule = use('tax.local.personal_income_surtax', 'echo.credit_rate_bracket');
  const creditRateBasis = resolveCreditRateBasisCode(profile);
  // 기본값 0 — creditRateRule이 없으면(=rule_missing) 아래에서 이미 missingRules에
  // 실려 compute()가 ok:false로 조기 반환하므로, 이 0은 응답에 실릴 일이 없는
  // 방어적 자리표시자일 뿐 세법 수치를 대신하지 않는다.
  let incomeTaxRate = 0;
  if (creditRateRule) {
    const bracket = selectCreditRateBracket(creditRateRule.value.brackets, creditRateBasis);
    incomeTaxRate = bracket ? bracket.rate : creditRateRule.value.brackets[creditRateRule.value.brackets.length - 1].rate;
  }
  const localRateOfIncomeTax = surtaxRule ? surtaxRule.value.rate_of_income_tax : 0;
  const localTaxRate = incomeTaxRate * localRateOfIncomeTax;
  const effectiveRate = incomeTaxRate + localTaxRate;
  const creditRateFallbackApplied = creditRateBasis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT;
  if (creditRateFallbackApplied) {
    // **덜 말하는 쪽이 안전한 방향이다** — 우대 구간을 적용하지 않았으므로 결과는
    // "적어도 이만큼"이다. 세액 한도의 "최대 이만큼"과 방향이 반대다(0.7절).
    notices.push({
      code: 'credit_rate_global_income_missing',
      severity: 'warning',
      field: 'profile.current_year_global_income_krw',
      params: { error_direction: 'understated_or_equal' },
      basis_rule_ids: [creditRateRule?.id, creditRateBasisRule?.id].filter(Boolean).sort(),
    });
  }

  // -- 연금계좌 한도 --------------------------------------------------------
  const annuityCreditLimitRule = use('pension.credit.limit.annuity_savings');
  const combinedCreditLimitRule = use('pension.credit.limit.combined');
  const pensionContributionLimitRule = use('pension.contribution.annual_limit');
  const annuityCreditCap = annuityCreditLimitRule ? annuityCreditLimitRule.value.amount_krw : 0;
  const baseCombinedCreditCap = combinedCreditLimitRule ? combinedCreditLimitRule.value.amount_krw : 0;
  const pensionContributionCap = pensionContributionLimitRule ? pensionContributionLimitRule.value.amount_krw : 0;

  // -- ISA 전환 추가한도 ------------------------------------------------
  let isaTransferExtraLimit = null;
  let extraCreditLimit = 0;
  let transferDestination = null;
  if (isaTransfer) {
    const transferRule =
      scenario === 'proposed'
        ? use('proposed.productive_isa.pension_transfer.credit_extra_limit', 'scenarios[].isa_transfer_extra_limit') ||
          use('pension.credit.isa_transfer.extra_limit', 'scenarios[].isa_transfer_extra_limit')
        : use('pension.credit.isa_transfer.extra_limit', 'scenarios[].isa_transfer_extra_limit');
    transferDestination = isaTransfer.destination ?? 'retirement_pension';
    if (transferRule) {
      // ?? 0 — 아래 fallback도 마찬가지로 규칙 필드가 실제로 비어 있을 때만
      // 닿는 방어적 값이다. 두 규칙(pension.credit.isa_transfer.extra_limit /
      // proposed.productive_isa.pension_transfer.credit_extra_limit) 모두
      // rate·cap_krw를 항상 채워 두므로 정상 경로에서는 쓰이지 않는다.
      const rate = transferRule.value.rate ?? 0;
      const cap = transferRule.value.cap_krw ?? 0;
      let priorApplied;
      if (scenario === 'proposed') {
        if (isaTransfer.prior_multi_year_applied_extra_credit_krw != null) {
          priorApplied = isaTransfer.prior_multi_year_applied_extra_credit_krw;
        } else {
          priorApplied = isaTransfer.prior_year_applied_extra_credit_krw ?? 0;
          notices.push({
            code: 'proposed_transfer_cap_period_input_missing',
            severity: 'warning',
            field: 'isa_transfer.prior_multi_year_applied_extra_credit_krw',
            params: {},
            basis_rule_ids: [transferRule.id],
          });
        }
      } else {
        // prior_year_applied_extra_credit_krw가 null인 경우는 8.2절에 별도 notice가
        // 없다 — top-level compute()의 assumptions에 prior_transfer_credit_zero_assumed로
        // 실린다(8.3절). 여기서는 notice를 내지 않는다.
        priorApplied = isaTransfer.prior_year_applied_extra_credit_krw ?? 0;
      }
      const rawExtra = Math.round(isaTransfer.amount_krw * rate);
      extraCreditLimit = Math.max(0, Math.min(rawExtra, cap - priorApplied));
      isaTransferExtraLimit = {
        transfer_amount_krw: isaTransfer.amount_krw,
        destination: transferDestination,
        extra_credit_limit_krw: extraCreditLimit,
        prior_applied_deducted_krw: priorApplied,
        counted_as_contribution_krw: isaTransfer.amount_krw,
        basis_rule_ids: [transferRule.id],
      };
    }
  }

  // -- 사람 쪽 자격 둘 (10.0.0, D44) -----------------------------------------
  // **계좌 자격보다 앞에 온다** — IRP 가입 자격이 계좌 자격의 한 축이고, 세액공제
  // 요건은 배분 단계의 목적함수가 서는 자리이기 때문이다(실제 엔진과 같은 순서).
  // **두 물음을 섞지 않는다**: 이자·배당소득만 있는 사람은 IRP를 못 열지만
  // 연금저축으로는 공제를 받는다.
  const IRP_OUTCOME_CODES = ['irp_eligible', 'irp_not_eligible', 'irp_eligibility_undetermined'];
  const irpEligibilityRule = use('irp.eligibility', 'account_eligibility[retirement_pension]');
  let irpBranch = null;
  if (irpEligibilityRule) {
    irpBranch = firstMatchingEligibilityBranch(irpEligibilityRule, { profile, accounts }, IRP_OUTCOME_CODES);
    if (irpBranch === null) missingRules.push('irp.eligibility');
  }
  const irpExcluded = irpBranch?.outcome_code === 'irp_not_eligible';
  // **미정은 배제가 아니다**(D44 판정 1). 조문상 자격이 확실한 사람(사업소득자)이
  // 섞여 있고, 막으면 그 사람은 화면이 「불가」라고 했으므로 확인하러 가지도
  // 않는다 — 스스로 드러나지 않는 오류다. 그래서 배분에서 빼지 않는다.
  const irpUndetermined = irpBranch?.outcome_code === 'irp_eligibility_undetermined';
  if (irpBranch && (irpExcluded || irpUndetermined)) {
    const closingInputIds = closingInputIdsForBranch(
      irpEligibilityRule.value.engine_evaluation.requested_inputs,
      irpBranch.id,
    );
    const irpParams = {
      account: 'retirement_pension',
      branch: irpBranch.id,
      error_direction: irpBranch.direction_code,
      // 이 분기를 닫는 입력. 화면이 **이 분기에서만** 그 물음을 띄우게 하는 값이다.
      closing_input_ids: closingInputIds,
    };
    if (irpExcluded) {
      notices.push({
        code: 'irp_excluded_no_qualifying_status',
        severity: 'warning',
        field: 'profile.current_year_total_salary_krw',
        params: irpParams,
        basis_rule_ids: [irpEligibilityRule.id],
      });
    } else {
      // **침묵하면 안 된다.** 빼지 않는다는 것은 「자격이 있다」가 아니다(D44).
      notices.push({
        code: 'irp_eligibility_not_determined',
        severity: 'warning',
        field: 'profile.has_non_wage_global_income_current_year',
        params: irpParams,
        basis_rule_ids: [irpEligibilityRule.id],
      });
    }
  }

  // 연금저축계좌는 나이·소득으로 배분에서 빼지 않는다는 것이 판정이다 — 부재도
  // 판정이므로 근거가 있어야 한다(D44).
  const annuitySavingsEligibilityRule = use('pension_savings.eligibility', 'account_eligibility[annuity_savings]');
  if (annuitySavingsEligibilityRule && annuitySavingsEligibilityRule.value?.engine_evaluation?.excludes_account !== false) {
    // 규칙이 빼라고 말하기 시작했는데 무엇으로 빼는지는 적혀 있지 않다. 지어내지 않는다.
    missingRules.push('pension_savings.eligibility');
  }

  // -- 연금계좌 세액공제 요건 (소득세법 §59조의3①, 계약 5.18절) ----------------
  // **가입 자격과 다른 축이다.** 이 판정은 현재 입력만으로 완전히 끝난다 —
  // 요건을 갖추지 못한 사람의 공제액 0은 추정이 아니라 조문에서 나오는 등식이다.
  const CREDIT_OUTCOME_CODES = ['pension_credit_available', 'pension_credit_zero_no_global_income'];
  const creditEligibilityRule = use(
    'pension.credit.taxpayer_eligibility',
    'pension_credit_taxpayer_eligibility.outcome_code',
  );
  let creditBranch = null;
  if (creditEligibilityRule) {
    creditBranch = firstMatchingEligibilityBranch(creditEligibilityRule, { profile }, CREDIT_OUTCOME_CODES);
    if (creditBranch === null) missingRules.push('pension.credit.taxpayer_eligibility');
  }
  const creditRequirementMet = creditBranch ? creditBranch.outcome_code === 'pension_credit_available' : true;
  const pensionCreditTaxpayerEligibility = creditBranch
    ? {
        outcome_code: creditBranch.outcome_code,
        branch_code: creditBranch.id,
        direction_code: creditBranch.direction_code,
        requirement_met: creditRequirementMet,
        is_exact: creditBranch.is_exact === true,
        basis_rule_ids: [creditEligibilityRule.id],
      }
    : null;
  if (creditBranch && !creditRequirementMet) {
    // **오류가 아니라 그 해에 대한 사실이다**(계약 8.2절) — 오류·경고 색을 쓰지 않는다.
    notices.push({
      code: 'pension_credit_zero_no_global_income',
      severity: 'info',
      field: 'profile.has_non_wage_global_income_current_year',
      params: { branch: creditBranch.id, is_exact: creditBranch.is_exact === true },
      basis_rule_ids: [creditEligibilityRule.id],
    });
  }

  // -- ISA 자격 --------------------------------------------------------
  const isaEligibilityRule = use('isa.eligibility', 'scenarios[].account_eligibility');
  let isaEligible = true;
  const isaReasonCodes = [];
  if (isaEligibilityRule) {
    // 연령 경계는 코드에 적지 않고 룰셋의 any_of 조건에서 읽는다(제품 원칙 1).
    const anyOf = isaEligibilityRule.value.any_of || [];
    const unconditionalMinAge = anyOf.find((c) => !c.requires)?.min_age;
    const conditionalEntry = anyOf.find((c) => c.requires);
    if (unconditionalMinAge != null && ageYears >= unconditionalMinAge) {
      // age19 요건을 그대로 충족 — 자격 있음
    } else if (
      conditionalEntry &&
      ageYears >= conditionalEntry.min_age &&
      unconditionalMinAge != null &&
      ageYears < unconditionalMinAge
    ) {
      // age15_employed 요건은 '직전 과세기간 근로소득 보유' 확인이 필요하나 이
      // 입력을 받지 않는다(requirements.md 2절 — 1차 출시에서 묻지 않는 선택
      // 입력). 확인할 수 없는 조건이므로 보수적으로 배제한다.
      isaEligible = false;
      isaReasonCodes.push('isa_excluded_age');
      notices.push({ code: 'isa_excluded_age', severity: 'warning', field: 'profile.birth_date', params: {}, basis_rule_ids: [isaEligibilityRule.id] });
    } else {
      isaEligible = false;
      isaReasonCodes.push('isa_excluded_age');
      notices.push({ code: 'isa_excluded_age', severity: 'warning', field: 'profile.birth_date', params: {}, basis_rule_ids: [isaEligibilityRule.id] });
    }
  }
  if (profile.financial_income_taxpayer_last_3_years === true) {
    const excl = use('isa.exclusion.financial_income_taxpayer', 'scenarios[].account_eligibility');
    isaEligible = false;
    isaReasonCodes.push('isa_excluded_financial_income_taxpayer');
    notices.push({
      code: 'isa_excluded_financial_income_taxpayer',
      severity: 'warning',
      field: 'profile.financial_income_taxpayer_last_3_years',
      params: {},
      basis_rule_ids: excl ? [excl.id] : [],
    });
  } else if (profile.financial_income_taxpayer_last_3_years == null) {
    notices.push({
      code: 'financial_income_status_unknown',
      severity: 'info',
      field: 'profile.financial_income_taxpayer_last_3_years',
      params: {},
      basis_rule_ids: [],
    });
  }

  // -- 연금 수령 개시 여부 (계약 3.2절 `annuity_start_status`) ---------------
  // `started`면 그 계좌에 납입할 수 없어 배분 대상에서 빠지고, `unknown`이면
  // 그 계좌의 배분을 **보류한다.** `unknown`을 `not_started`로 접으면 연금 수령
  // 중인 사용자에게 납입 가능액을 주게 되고 오류의 방향이 과대다.
  const annuityStartRule = use('pension.contribution.after_annuity_start', 'scenarios[].account_eligibility');
  const pensionEligibility = {};
  for (const account of PENSION_ACCOUNTS) {
    // **축이 둘 이상 동시에 걸릴 수 있고 그때는 둘 다 실린다**(계약 5.2절).
    const reasonCodes = [];
    if (account === 'retirement_pension' && irpExcluded) {
      reasonCodes.push('irp_excluded_no_qualifying_status');
    }
    const status = accounts[account].annuity_start_status;
    if (status === 'started') {
      reasonCodes.push('pension_contribution_blocked_annuity_started');
      notices.push({
        code: 'pension_contribution_blocked_annuity_started',
        severity: 'warning',
        field: `accounts.${account}.annuity_start_status`,
        params: { account },
        basis_rule_ids: annuityStartRule ? [annuityStartRule.id] : [],
      });
    } else if (status === 'unknown') {
      reasonCodes.push('pension_annuity_start_unknown');
      notices.push({
        code: 'pension_annuity_start_unknown',
        severity: 'warning',
        field: `accounts.${account}.annuity_start_status`,
        params: { account },
        basis_rule_ids: [],
      });
    }
    pensionEligibility[account] = { eligible: reasonCodes.length === 0, reasonCodes };
  }

  const retirementTransferTotal = PENSION_ACCOUNTS.reduce(
    (sum, account) => sum + (accounts[account].retirement_transfer_in_krw ?? 0),
    0,
  );
  if (retirementTransferTotal > 0) {
    const excludedRule = use('pension.credit.excluded_contributions', 'scenarios[].limits.retirement_transfer_in_krw');
    notices.push({
      code: 'retirement_transfer_excluded_from_credit',
      severity: 'info',
      field: null,
      params: { amount_krw: retirementTransferTotal },
      basis_rule_ids: excludedRule ? [excludedRule.id] : [],
    });
  }

  const accountEligibility = [
    ...PENSION_ACCOUNTS.map((account) => {
      const basisRuleIds = [];
      if (account === 'retirement_pension' && irpEligibilityRule) basisRuleIds.push(irpEligibilityRule.id);
      if (account === 'annuity_savings' && annuitySavingsEligibilityRule) basisRuleIds.push(annuitySavingsEligibilityRule.id);
      if (pensionEligibility[account].reasonCodes.includes('pension_contribution_blocked_annuity_started') && annuityStartRule) {
        basisRuleIds.push(annuityStartRule.id);
      }
      return {
        account,
        eligible: pensionEligibility[account].eligible,
        reason_codes: pensionEligibility[account].reasonCodes,
        // **가입 자격 축의 결론.** 연금저축은 언제나 `null`이다 — 결론 어휘를 가진
        // 가입 자격 규칙이 룰셋에 없다(계약 5.2절).
        determination_code: account === 'retirement_pension' && irpBranch ? irpBranch.outcome_code : null,
        determination_direction_code: account === 'retirement_pension' && irpBranch ? irpBranch.direction_code : null,
        basis_rule_ids: [...new Set(basisRuleIds)].sort(),
      };
    }),
    {
      account: 'isa',
      eligible: isaEligible,
      reason_codes: isaReasonCodes,
      // ISA에는 결론 코드 어휘를 가진 가입 자격 규칙이 없다. 없는 것을 지어내지 않는다.
      determination_code: null,
      determination_direction_code: null,
      basis_rule_ids: isaEligibilityRule ? [isaEligibilityRule.id] : [],
    },
  ];
  notices.push({ code: 'pension_age_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });

  // -- ISA 비과세 한도 --------------------------------------------------
  // **`accounts.isa.exists`를 조건에 넣지 않는다(2026-08-10 수정).** 계약
  // 3.2절에서 `tax_free_limit_krw`는 `account_type`에만 걸린다 — "null이면
  // ISA도 null"이라고 적을 뿐 `exists`를 언급하지 않는다. 엔진은 ISA 미보유
  // 사용자에게도 신규 가입을 전제로 배분하므로(`isa_new_account_assumed`),
  // 유형을 선언했는데 계좌가 없다는 이유로 한도를 내지 않으면 그 배분의
  // 비과세 한도를 영영 보일 수 없다. (이전에는 `exists &&`가 앞에 있었다 —
  // `isaAccountType` 게이트와 같은 뿌리의 결함이었다.)
  const isaTaxFreeRule = use('isa.tax_free_limit', 'scenarios[].limits.by_account[isa].tax_free_limit_krw');
  let taxFreeLimit = null;
  if (accounts.isa.account_type != null && isaTaxFreeRule) {
    const bracket = isaTaxFreeRule.value.brackets.find((b) => b.id === (accounts.isa.account_type === 'low_income' ? '서민형' : '일반형'));
    taxFreeLimit = bracket ? bracket.limit_krw : null;

    if (profile.prior_year_total_salary_krw != null) {
      const lowIncomeBracket = isaTaxFreeRule.value.brackets.find((b) => b.id === '서민형');
      const qualifiesLowIncome =
        lowIncomeBracket && profile.prior_year_total_salary_krw <= lowIncomeBracket.prev_total_salary_max_krw;
      const declaredLowIncome = accounts.isa.account_type === 'low_income';
      if (qualifiesLowIncome !== declaredLowIncome) {
        notices.push({
          code: 'isa_type_conflicts_with_prior_income',
          severity: 'warning',
          field: 'accounts.isa.account_type',
          params: {},
          basis_rule_ids: [isaTaxFreeRule.id],
        });
      }
    } else {
      notices.push({ code: 'prior_year_income_missing', severity: 'info', field: 'profile.prior_year_total_salary_krw', params: {}, basis_rule_ids: [] });
    }
  } else if (accounts.isa.account_type == null) {
    notices.push({ code: 'isa_type_not_declared', severity: 'info', field: 'accounts.isa.account_type', params: {}, basis_rule_ids: [] });
  }

  // -- 가정 기반 ISA 정산액의 재료 (5.1.0, D28·D29 / 계약 3.6절) -------------
  //
  // **객체를 보내지 않으면 규칙을 한 건도 읽지 않는다** — 읽지 않은 규칙을 근거로
  // 싣지 않는다는 규약이 여기에도 걸린다. 룰셋이 실제로 읽히지 않으면(개발 서버
  // 데이터 결함 등) `use()`가 이미 missingRules에 기록하므로 이 시나리오는
  // ok:false로 조기 반환된다 — 대체값을 만들지 않는다.
  const isaReturnAssumptionInput = profile.isa_return_assumption ?? null;
  const isaEstimateDisplay = request.options?.assumption_based_isa_estimate ?? 'include';
  let isaReturnContext = { supplied: false };
  if (isaReturnAssumptionInput != null) {
    const quantRule = use('isa.benefit.quantification', 'plans[].assumption_based_isa_estimate');
    const isaExcessRule = use('isa.excess.separate_tax_rate', 'plans[].assumption_based_isa_estimate');
    const accountReqRuleForReturn = use('isa.account.requirements', 'plans[].assumption_based_isa_estimate');
    const incomeCharacterRule = use('isa.benefit.income_character', 'plans[].assumption_based_isa_estimate');
    const formulaRule = use('isa.benefit.formula', 'plans[].assumption_based_isa_estimate');
    const settlementPeriodRule = use('isa.benefit.settlement_period', 'plans[].assumption_based_isa_estimate');
    const lossOffsetRule = use('isa.net_income.loss_offset', 'plans[].assumption_based_isa_estimate');
    // D38 6번·7번 — 축마다 상한의 유무가 다르다는 판정. 축 금액을 낼 때만 읽는다.
    const axisCeilingRule = use('isa.benefit.axis_ceiling', 'plans[].assumption_based_isa_estimate');
    // 연금계좌 칸이 비어 있는 것을 "효과가 없다"로 읽지 않게 하는 근거(D28 18.5절).
    use('pension.tax_deferral.with_return_rate', 'notices[pension_tax_deferral_not_quantified]');

    if (quantRule && isaExcessRule && accountReqRuleForReturn && incomeCharacterRule && formulaRule && settlementPeriodRule && lossOffsetRule && axisCeilingRule) {
      const generalRate = readGeneralWithholdingRate(quantRule);
      const isaRate = isaExcessRule.value.rate;
      const minContractYears = accountReqRuleForReturn.value.min_contract_years;
      const options = incomeCharacterRule.value?.what_to_ask_instead?.options ?? [];
      const option = options.find((item) => item?.id === isaReturnAssumptionInput.income_character);
      const share = parseTaxableShareRange(option?.s_range);
      const axisCeilings = readAxisCeilingFlags(axisCeilingRule);

      if (generalRate !== undefined && isaRate != null && minContractYears != null && share !== null && axisCeilings !== null) {
        const settlementFromUser = isaReturnAssumptionInput.settlement_years != null;
        isaReturnContext = {
          supplied: true,
          assumption: isaReturnAssumptionInput,
          share,
          generalRate,
          isaRate,
          axisCeilings,
          settlementYears: settlementFromUser ? isaReturnAssumptionInput.settlement_years : minContractYears,
          settlementSource: settlementFromUser ? 'user' : 'ruleset_min_contract_years',
          basisRuleIds: [
            accountReqRuleForReturn.id,
            axisCeilingRule.id,
            formulaRule.id,
            incomeCharacterRule.id,
            quantRule.id,
            settlementPeriodRule.id,
            isaExcessRule.id,
            lossOffsetRule.id,
            ...(isaTaxFreeRule ? [isaTaxFreeRule.id] : []),
            ...(surtaxRule ? [surtaxRule.id] : []),
          ].sort(),
        };
      }
    }
  }

  // -- 헤드라인 합계의 근거 (D38, 계약 5.17절) ------------------------------
  //
  // **가정이 없어도 읽는다** — ISA 성분이 없는 사용자에게도 헤드라인 합계는
  // 나가고, 그때 「합계 = 확정 성분」이라는 것도 이 규칙이 정한다. 규칙이 없으면
  // `use()`가 missingRules에 기록해 ok:false로 조기 반환한다 — 대체값을 만들지 않는다.
  const headlineRule = use('benefit.headline.composite_total', 'plans[].headline_composite_total');
  const headlineSettlementPeriodRule = use('isa.benefit.settlement_period', 'plans[].headline_composite_total');
  const headlineBasisRuleIds = [headlineRule?.id, creditRateRule?.id, headlineSettlementPeriodRule?.id]
    .filter(Boolean)
    .sort();

  // -- ISA 연간 납입 가능액 -----------------------------------------------
  const isaRequirementsRule = use('isa.account.requirements', 'scenarios[].limits.by_account[isa]');
  // 0 — isaRequirementsRule이 없으면 missingRules로 잡혀 ok:false로 조기 반환된다.
  const totalLimit = isaRequirementsRule ? isaRequirementsRule.value.total_contribution_limit_krw : 0;
  const otherSavings = accounts.isa.other_savings_contract_krw ?? 0;
  // other_savings_contract_krw == null인 경우는 notice가 아니라 top-level
  // compute()의 assumptions에 other_savings_zero_assumed로 실린다(8.3절).
  const effectiveTotalLimit = Math.max(0, totalLimit - otherSavings);

  let isaAnnualRoom = 0;
  if (accounts.isa.exists) {
    if (scenario === 'proposed') {
      const proposedAnnualRule = use('proposed.isa.annual_contribution_limit', 'scenarios[].limits.by_account[isa]');
      const flatAnnual = proposedAnnualRule ? proposedAnnualRule.value.amount_krw : 0;
      isaAnnualRoom = Math.max(0, Math.min(flatAnnual, effectiveTotalLimit - accounts.isa.cumulative_contribution_krw));
    } else {
      const annualRule = use('isa.contribution.annual_limit', 'scenarios[].limits.by_account[isa]');
      const base = annualRule ? annualRule.value.base_amount_krw : 0;
      const yearsSinceOpening = accounts.isa.years_since_opening;
      if (yearsSinceOpening == null) {
        notices.push({ code: 'isa_tenure_missing', severity: 'warning', field: 'accounts.isa.years_since_opening', params: {}, basis_rule_ids: annualRule ? [annualRule.id] : [] });
      }
      const years = Math.min(yearsSinceOpening ?? 0, 4);
      const lifetimeAllowance = base * (1 + years);
      isaAnnualRoom = Math.max(
        0,
        Math.min(lifetimeAllowance - accounts.isa.cumulative_contribution_krw, effectiveTotalLimit - accounts.isa.cumulative_contribution_krw),
      );
    }
  }
  if (!isaEligible) isaAnnualRoom = 0;

  // -- 배분 가능한 예산과 연금계좌 공유 풀 ---------------------------------
  const budget = profile.monthly_capacity_krw * months;
  const sharedPensionPoolBase = Math.max(
    0,
    pensionContributionCap - accounts.annuity_savings.ytd_contribution_krw - accounts.retirement_pension.ytd_contribution_krw,
  );
  const existingOverLimit =
    accounts.annuity_savings.ytd_contribution_krw + accounts.retirement_pension.ytd_contribution_krw > pensionContributionCap;
  if (existingOverLimit) {
    notices.push({ code: 'existing_contribution_over_limit', severity: 'warning', field: null, params: {}, basis_rule_ids: pensionContributionLimitRule ? [pensionContributionLimitRule.id] : [] });
  }

  // -- 배분안 4종 계산 ------------------------------------------------------ (6.0.0 D32)
  //
  // **네 안 모두 연금 쌍을 두 단계로 돈다**(계약 5.6절) — 1차는 세액공제 대상
  // 한도까지(그 안의 이름이나 동점 규칙이 순서를 정한다), 2차는 ISA 납입 한도,
  // 3차는 남은 연금 납입 한도(1,800만)까지다. 3차는 공제를 낳지 않는 몫이라
  // 세액이 순서를 정하지 못하므로 **언제나** 인출이 자유로운 계좌(확정 룰셋에서는
  // 연금저축)부터 채운다 — `pension.withdrawal.midterm_restriction`이 그 근거다.
  //
  // `annuity_savings_first`·`pension_contribution_before_isa`는 한 계좌를 신용
  // 한도에서 멈추지 않고 완전히 채운 뒤 다음 계좌로 넘어가는 것이 이름의 의도라
  // 1차·3차가 사실상 한 단계로 합쳐진다(`fillPensionMerged`). `max_tax_credit`·
  // `isa_first`만 두 단계가 실제로 갈린다 — 1차에서 두 계좌 모두 신용 한도로
  // 멈추고 ISA를 채운 뒤, 3차가 남은 예산을 연금저축부터 납입 한도까지 채운다.
  const PENSION_FLEXIBLE_FIRST = ['annuity_savings', 'retirement_pension'];
  function eligibleFor(account) {
    return account === 'isa' ? isaEligible : pensionEligibility[account].eligible;
  }
  const annuityCreditCapEffective = annuityCreditCap + (transferDestination === 'annuity_savings' ? extraCreditLimit : 0);
  const combinedCreditCapEffective = baseCombinedCreditCap + extraCreditLimit;
  const annuitySubRemainingBase = Math.max(0, annuityCreditCapEffective - accounts.annuity_savings.ytd_contribution_krw);
  const creditPoolRemainingBase = Math.max(
    0,
    combinedCreditCapEffective -
      Math.min(accounts.annuity_savings.ytd_contribution_krw, annuityCreditCapEffective) -
      accounts.retirement_pension.ytd_contribution_krw,
  );

  const rawPlans = PLAN_ORDER.map((planId) => {
    let remainingBudget = budget;
    let pensionPool = sharedPensionPoolBase;
    let isaPool = isaAnnualRoom;
    let creditPool = creditPoolRemainingBase;
    let annuitySub = annuitySubRemainingBase;
    const allocByAccount = { retirement_pension: 0, annuity_savings: 0, isa: 0 };
    const limitedBy = {};
    let order = 1;
    const fillOrderByAccount = {};

    // 계좌 하나에 대한 한 걸음. `cap`은 이 걸음이 볼 수 있는 상한(신용 한도든
    // 납입 한도든 호출부가 고른다). **`limited_by`는 마지막 걸음이 이긴다** —
    // 같은 계좌가 1차·3차 두 번 걸리면 3차의 판정이 화면에 남는 판정이다.
    function step(account, cap) {
      if (!eligibleFor(account)) {
        limitedBy[account] = 'not_eligible';
        return 0;
      }
      const want = remainingBudget;
      const allocated = Math.max(0, Math.min(want, cap));
      if (allocated > 0) {
        allocByAccount[account] += allocated;
        if (fillOrderByAccount[account] == null) fillOrderByAccount[account] = order++;
      }
      remainingBudget -= allocated;
      // **`credit_limit`은 6.0.0에서 사라졌다** — 신용 한도로 멈추든 납입
      // 한도로 멈추든 같은 값 `contribution_limit`으로 낸다(계약 5.5절).
      if (allocated < want) limitedBy[account] = cap <= want ? 'contribution_limit' : 'budget';
      else limitedBy[account] = null;
      return allocated;
    }

    function fillIsa() {
      const allocated = step('isa', isaPool);
      isaPool -= allocated;
    }

    // 신용 한도를 보지 않고 계좌 하나를 납입 한도까지 채운다 — 이름이 "이
    // 계좌를 먼저·완전히 채운다"를 뜻하는 두 안(`annuity_savings_first`·
    // `pension_contribution_before_isa`)에 쓴다.
    function fillPensionMerged(seq) {
      for (const account of seq) {
        const allocated = step(account, pensionPool);
        pensionPool -= allocated;
        creditPool -= Math.min(allocated, creditPool);
        if (account === 'annuity_savings') annuitySub -= Math.min(allocated, annuitySub);
      }
    }

    // 1차 — 세액공제 대상 한도까지. 확정 룰셋에서는 두 계좌의 한계 공제율이
    // 언제나 같아 인출이 자유로운 계좌가 항상 먼저다(0.4절). 개정안 청년 우대로
    // 공제율이 갈리는 재정렬은 이 목의 근사치가 다루지 않는다.
    function fillPensionStageOne() {
      for (const account of PENSION_FLEXIBLE_FIRST) {
        const creditCapForAccount = account === 'annuity_savings' ? Math.min(annuitySub, creditPool) : creditPool;
        const allocated = step(account, Math.min(creditCapForAccount, pensionPool));
        pensionPool -= allocated;
        creditPool -= allocated;
        if (account === 'annuity_savings') annuitySub -= allocated;
      }
    }

    // 3차 — 남은 납입 한도까지. **언제나** 인출이 자유로운 계좌부터(계약 5.6절).
    function fillPensionStageThree() {
      for (const account of PENSION_FLEXIBLE_FIRST) {
        const allocated = step(account, pensionPool);
        pensionPool -= allocated;
      }
    }

    if (planId === 'isa_first') {
      fillIsa();
      fillPensionStageOne();
      fillPensionStageThree();
    } else if (planId === 'annuity_savings_first') {
      fillPensionMerged(['annuity_savings', 'retirement_pension']);
      fillIsa();
    } else if (planId === 'pension_contribution_before_isa') {
      fillPensionMerged(PENSION_FLEXIBLE_FIRST);
      fillIsa();
    } else {
      // max_tax_credit
      fillPensionStageOne();
      fillIsa();
      fillPensionStageThree();
    }

    const unallocated = remainingBudget;

    // **실제로 쓴 순서**(계약 5.6절 `fill_sequence`) — 첫 배분이 일어난 순서를
    // 그대로 관측한다. 이 안에서는(두 단계로 갈리는 안) 계좌가 1차에서 0원을
    // 받고 3차에서 처음 받을 수도 있어, 고정 배열이 아니라 실측값이어야 한다.
    const observedSequence = [...ACCOUNTS].sort((a, b) => {
      const oa = fillOrderByAccount[a] ?? Infinity;
      const ob = fillOrderByAccount[b] ?? Infinity;
      return oa !== ob ? oa - ob : ACCOUNTS.indexOf(a) - ACCOUNTS.indexOf(b);
    });

    // 이 배분을 실행한 뒤 남는 두 여력. **6.0.0부터 네 안 모두 ISA·연금 납입
    // 한도까지 채우므로**, 예산이 그 둘의 합을 넘지 않는 한 이 값은 0이다
    // (계약 5.13절 — 「미배분」이 갈 곳이 없다는 뜻이 되는 것이 이제 정상이다).
    return {
      planId,
      sequence: observedSequence,
      allocByAccount,
      limitedBy,
      fillOrderByAccount,
      unallocated,
      pensionPoolRemaining: pensionPool,
      isaPoolRemaining: isaPool,
    };
  });

  // -- 계좌별 세액공제 계산 -------------------------------------------------
  function creditFor(annuityAllocated, retirementAllocated) {
    let annuityBase = accounts.annuity_savings.ytd_contribution_krw + annuityAllocated;
    let retirementBase = accounts.retirement_pension.ytd_contribution_krw + retirementAllocated;
    if (transferDestination === 'annuity_savings') annuityBase += isaTransfer.amount_krw;
    if (transferDestination === 'retirement_pension') retirementBase += isaTransfer.amount_krw;

    const annuityCreditCapEffective = annuityCreditCap + (transferDestination === 'annuity_savings' ? extraCreditLimit : 0);
    const combinedCreditCapEffective = baseCombinedCreditCap + extraCreditLimit;

    const annuityCreditEligible = Math.min(annuityBase, annuityCreditCapEffective);
    const combinedCreditEligible = Math.min(annuityCreditEligible + retirementBase, combinedCreditCapEffective);
    return Math.max(0, combinedCreditEligible);
  }

  // -- 세액 한도 (계약 5.10절, D39·D40) --------------------------------------
  //
  // 직전 과세연도 결정세액을 묻던 자리가 사라졌다(D39). 대신 **해당 과세기간
  // 총급여액**에서 §47→§50①1→§55①→§59를 밟아 §61②③의 한도를 산출한다
  // (`resolveTaxLiabilityCapMock`, 실제 엔진의 `liability-cap.mjs`를 그대로 옮겼다).
  //
  // **나온 값은 상한이다(D40).** `cap_krw`는 결코 `null`이 아니다 — 「모름」이라는
  // 상태가 없다. 종합소득이 있는데 금액을 모르는 분기에서는 오차 방향조차 정해지지
  // 않는다(`error_direction_code === 'direction_indeterminate'`, D41).
  const capResolved = resolveTaxLiabilityCapMock(use, profile, missingRules);
  const capKnown = capResolved !== null;
  const capKrw = capResolved?.cap.cap_krw ?? null;
  const capIsUpperBound = capResolved?.isUpperBound ?? false;
  const capErrorDirection = capResolved?.errorDirection ?? null;
  const capBasisRuleIds = capResolved?.basisRuleIds ?? [];
  // 배분안의 자르기와 확정 축의 눈금이 같은 규약·같은 정확값을 써야 한도를 채운
  // 사람에게서 1원이 어긋나지 않는다(D46 1번·D49) — 한 번 읽어 아래로 넘긴다.
  const rounding = capResolved?.rounding ?? null;
  const capExactValue = capResolved?.capExact ?? null;

  if (capResolved) {
    // **언제나 나간다.** 이 한도가 총급여액에서 계산한 값이고 다른 소득공제·
    // 세액공제를 반영하지 않았으며, 그래서 실제 공제는 이보다 적을 수 있다는
    // 사실이 금액과 같은 화면에 있어야 한다(규칙의 `required_display`).
    notices.push({
      code: 'tax_liability_cap_estimated_from_total_salary',
      severity: 'warning',
      field: 'profile.current_year_total_salary_krw',
      params: {
        error_direction: capErrorDirection,
        branch: capResolved.branch,
        is_upper_bound: capIsUpperBound,
        cap_krw: capKrw,
      },
      basis_rule_ids: capBasisRuleIds,
    });
    if (!capIsUpperBound) {
      // 다른 소득을 세지 않은 것은 산출세액을 작게 잡는 방향이고 공제를 세지
      // 않은 것은 크게 잡는 방향이라 합의 부호가 정해지지 않는다.
      notices.push({
        code: 'tax_liability_cap_direction_indeterminate',
        severity: 'warning',
        field: 'profile.current_year_global_income_krw',
        params: { branch: capResolved.branch },
        basis_rule_ids: capBasisRuleIds,
      });
    }
    if (capKrw === 0) {
      // **오류가 아니라 결과다** — 상한이 0이면 실제 한도도 0인 등식이 되지만,
      // 미정 분기에서는 0이 실제 한도를 가두지 못한다.
      notices.push({
        code: 'tax_liability_cap_zero',
        severity: 'info',
        field: 'profile.current_year_total_salary_krw',
        params: { is_exact: capIsUpperBound },
        basis_rule_ids: capBasisRuleIds,
      });
    }
  }

  const carryoverRule = use('pension.credit.unused.contribution_carryover');
  const creditCarryforward = capResolved?.cap.credit_carryforward ?? false;

  // -- 확정 축의 최댓값 (계약 5.15절, D36) -----------------------------------
  // 연금계좌 합산 인정한도를 전액 채웠을 때의 세액공제액. **소득세분만 내지
  // 않는다** — 막대에 실리는 금액(`pension_credit_total_krw`)은 소득세분 +
  // 개인지방소득세분이므로 축의 끝도 같은 자로 재야 한다.
  const combinedCreditLimitForCeiling = baseCombinedCreditCap + extraCreditLimit;
  // 배분안이 쓰는 것과 **같은 규약**이다(D46 1번·D49) — 정확값으로 계산하고 표시
  // 직전에 한 번 버린다. 다른 산술을 쓰면 한도를 채운 사람에게서 축과 막대가
  // 1원 어긋난다. 지방소득세분은 소득세분에 부가율(`localRateOfIncomeTax`)을
  // 다시 적용해 낸다 — 배분안의 `applyCap`과 같은 자리를 같은 방식으로 잰다.
  const ceilingIncomeTaxExact = rounding ? scaleExact(exactOf(combinedCreditLimitForCeiling), toRatio(incomeTaxRate)) : null;
  const ceilingLocalTaxExact = ceilingIncomeTaxExact ? scaleExact(ceilingIncomeTaxExact, toRatio(localRateOfIncomeTax)) : null;
  const ceilingIncomeTaxKrw = rounding && ceilingIncomeTaxExact ? rounding.display(ceilingIncomeTaxExact) ?? 0 : 0;
  const ceilingLocalTaxKrw = rounding && ceilingLocalTaxExact ? rounding.displayLocal(ceilingLocalTaxExact) ?? 0 : 0;
  // 이 목은 청년 우대(개정안 `proposed.pension.credit.youth_irp_rate`)를 입력
  //으로 받지 않는다 — `unapplied_proposed_rules`에 `requires_input_not_collected`
  // 로 실린다. 언제나 본문 구간(`credit_rate_bracket`)에서 온다.
  // 9.0.0부터 `cap_unknown`이 없다 — 한도가 결코 null이 아니므로 이 관계는 언제나
  // 값을 갖는다. **`cap_at_or_above_ceiling`은 「걸리지 않는다」가 아니다** — 한도가
  // 상한이므로 실제 한도는 이보다 작을 수 있다. 그 구분은 `binding_code`가 낸다(D40).
  //
  // **소득세분끼리, 정확값으로 비교한다**(D46 1번·D49) — 한도는 산출세액에서 나온
  // 소득세의 값이고 상한의 합계는 지방소득세를 포함하므로, 그대로 비교하면 단위가
  // 다른 두 수를 재는 것이 된다. 절사한 값으로 비교하면 1원 미만의 차이가 사라져
  // 이 관계 코드가 뒤집힌다(룰셋 `comparison` 단계).
  const ceilingCmp =
    capExactValue && ceilingIncomeTaxExact ? cmpExact(capExactValue, ceilingIncomeTaxExact) : null;
  const ceilingCapRelation =
    ceilingCmp !== null
      ? ceilingCmp < 0
        ? 'cap_below_ceiling'
        : 'cap_at_or_above_ceiling'
      : capKrw < ceilingIncomeTaxKrw
        ? 'cap_below_ceiling'
        : 'cap_at_or_above_ceiling';
  const pensionCreditCeiling = {
    ceiling_krw: ceilingIncomeTaxKrw + ceilingLocalTaxKrw,
    income_tax_krw: ceilingIncomeTaxKrw,
    local_tax_krw: ceilingLocalTaxKrw,
    credit_limit_krw: combinedCreditLimitForCeiling,
    isa_transfer_extra_limit_krw: extraCreditLimit,
    income_tax_rate: incomeTaxRate,
    local_tax_rate: localTaxRate,
    effective_rate: effectiveRate,
    rate_source_code: 'credit_rate_bracket',
    basis_code: creditRateBasis.code,
    measured_amount_krw: creditRateBasis.amount,
    fallback_applied: creditRateFallbackApplied,
    fallback_direction_code: creditRateFallbackApplied ? 'understated_or_equal' : null,
    tax_liability_cap_relation_code: ceilingCapRelation,
    // 축의 끝이 0이면 눈금이 성립하지 않는다 — 화면이 나눗셈 앞에서 먼저 본다.
    is_axis_degenerate: ceilingIncomeTaxKrw + ceilingLocalTaxKrw === 0,
    period_code: 'current_tax_year',
    meaning_code: 'full_pension_combined_credit_limit_at_this_persons_rate',
    basis_rule_ids: [combinedCreditLimitRule?.id, creditRateRule?.id, surtaxRule?.id].filter(Boolean).sort(),
  };

  // -- 연금저축·IRP를 나중에 받을 때의 세율표 (계약 5.16절, D36) -------------
  // 요청의 어떤 값에도 반응하지 않는다 — 새 입력 0개·가정 0개가 성립 조건이다.
  const pensionWithdrawalTaxReference = resolvePensionWithdrawalTaxReferenceMock(use, surtaxRule?.id, localRateOfIncomeTax);

  // 월 환산 잔차를 얹을 수 있는 풀이 열려 있는가(0.12절) — 두 연금계좌 중
  // 하나라도 배분 대상이면 연금 풀이 열려 있다. 계좌별 여유가 아니라 안마다
  // 「이 배분을 실행한 뒤 남는 값」(`p.pensionPoolRemaining`/`p.isaPoolRemaining`)을
  // 쓴다 — 배분 전 값을 쓰면 이미 배분된 몫을 두 번 세게 된다.
  const pensionOpen = pensionEligibility.annuity_savings.eligible || pensionEligibility.retirement_pension.eligible;
  const monthlyLastOrder = ACCOUNTS.length;

  const plans = rawPlans.map((p) => {
    // **1단계가 서지 않으면 2단계(세액 한도)는 돌지 않는다**(계약 5.18절). 요건
    // 미충족이면 인정된 납입액 자체가 0이다 — 한도가 자른 것이 아니라 애초에
    // 자를 것이 없다.
    const creditEligible = creditRequirementMet
      ? creditFor(p.allocByAccount.annuity_savings, p.allocByAccount.retirement_pension)
      : 0;
    // **정확값으로 계산하고 표시 직전에 한 번 버린다**(D46 1번·D49) — 배분안마다
    // 원 미만을 각각 버리면 조문에 없는 절사 자리가 늘어난다. `src/engine/plans.mjs`의
    // `benefitOf`/`applyCap`과 같은 방식이다.
    const incomeTaxExact = rounding ? scaleExact(exactOf(creditEligible), toRatio(incomeTaxRate)) : null;
    const localTaxExact = incomeTaxExact ? scaleExact(incomeTaxExact, toRatio(localRateOfIncomeTax)) : null;
    const incomeTaxBeforeCapKrw = rounding && incomeTaxExact ? rounding.display(incomeTaxExact) ?? 0 : 0;
    const localTaxBeforeCapKrw = rounding && localTaxExact ? rounding.displayLocal(localTaxExact) ?? 0 : 0;
    // 한도는 **소득세분에** 걸린다. 지방소득세분은 **인정된 소득세분에** 부가율을
    // 다시 적용해 낸다 — 인정되지 않은 공제에 붙는 지방세를 남기지 않기 위해서다
    // (`local_tax_follows_income_tax_cap` 가정). **비교와 자르기는 정확값으로
    // 한다**(룰셋 `comparison` 단계) — 표시 금액끼리 비교하면 1원 미만의 차이가
    // 사라져 `applied`가 뒤집힌다(D46 1번).
    const recognizedIncomeTaxExact =
      capKnown && incomeTaxExact ? minExact(incomeTaxExact, capExactValue) : incomeTaxExact;
    const recognizedLocalTaxExact = recognizedIncomeTaxExact
      ? scaleExact(recognizedIncomeTaxExact, toRatio(localRateOfIncomeTax))
      : null;
    const incomeTaxKrw =
      rounding && recognizedIncomeTaxExact ? rounding.display(recognizedIncomeTaxExact) ?? incomeTaxBeforeCapKrw : incomeTaxBeforeCapKrw;
    const localTaxKrw =
      rounding && recognizedLocalTaxExact ? rounding.displayLocal(recognizedLocalTaxExact) ?? localTaxBeforeCapKrw : localTaxBeforeCapKrw;
    const totalCreditKrw = incomeTaxKrw + localTaxKrw;
    const totalBeforeCapKrw = incomeTaxBeforeCapKrw + localTaxBeforeCapKrw;
    // **잘렸는가는 정확값의 대소가 정한다** — 표시 금액의 차이가 아니다(D46 1번·
    // D49). 그 둘이 갈리는 좌표가 실재한다(끝수만 잘린 경우) — `applied: true`인데
    // 표시 금액이 한 원도 줄지 않을 수 있다. 화면이 「잘렸다」는 문장을 쓸 때는
    // `reduced_total_krw > 0`을 함께 봐야 하는 이유가 이것이다(계약 5.5절).
    const capApplied = capKnown && incomeTaxExact ? cmpExact(capExactValue, incomeTaxExact) < 0 : false;
    const planCap = {
      cap_krw: capKrw,
      applied: capApplied,
      // **잘렸다는 사실과 「걸린다는 것이 증명된다」는 사실은 다르다**(D40). 추정
      // 한도가 상한인 분기에서만 잘림이 실제 한도의 잘림을 증명한다.
      binding_code: capBindingCodeFor(capApplied, capIsUpperBound),
      reduced_income_tax_krw: incomeTaxBeforeCapKrw - incomeTaxKrw,
      reduced_local_tax_krw: localTaxBeforeCapKrw - localTaxKrw,
      reduced_total_krw: totalBeforeCapKrw - totalCreditKrw,
      // **임계값.** 화면이 배분액에 공제율을 곱해 만들지 않는다 — 사용자가 나중에
      // 영수증을 보고 스스로 대조할 수 있게 하는 값이다.
      threshold_income_tax_krw: incomeTaxBeforeCapKrw,
      credit_carryforward: creditCarryforward,
      contribution_carryover_available: capApplied,
      // **이름 하나(`contribution_carryover_available`)가 조건 둘을 감추고
      // 있었다**(D26) — 전환금액도 전환한 해의 600만·900만 한도를 그 해의 새
      // 납입액과 나눠 쓰고(그래서 매년 한도를 채우는 사용자에게는 전환할 자리가
      // 없다), 신청주의라 자동이 아니다. 전환이 걸리지 않으면 읽지 않은 규칙을
      // 근거로 싣지 않는다 — `null`이다.
      carryover_shares_future_year_credit_limit:
        capApplied && carryoverRule ? (carryoverRule.value.subject_to_conversion_year_credit_limits?.value ?? null) : null,
      carryover_requires_application:
        capApplied && carryoverRule ? carryoverRule.value.automatic !== true : null,
      error_direction_code: capErrorDirection,
      basis_rule_ids: capApplied && carryoverRule ? [...capBasisRuleIds, carryoverRule.id].sort() : capBasisRuleIds,
    };

    // -- 7.0.0(0.12절) — 월 환산 잔차를 네 갈래(세 계좌 + 미배분)에 나눈다 ------
    // **이 배분안을 실행한 뒤 남는 값**을 풀 여유로 준다 — 배분 전 값을 주면
    // 이미 배분된 몫을 두 번 세게 된다.
    const monthlyBuckets = [
      ...ACCOUNTS.map((account) => ({
        id: account,
        annualKrw: p.allocByAccount[account] ?? 0,
        poolId: account === 'isa' ? 'isa' : 'pension',
        // 돈을 받지 못한 계좌는 `fillOrderByAccount`에 없다 — 나머지가 0이라
        // 후보가 되지 않지만, 순서를 미정으로 두지 않기 위해 고정 계좌 순서로
        // 뒤에 세운다.
        orderIndex: p.fillOrderByAccount[account] ?? monthlyLastOrder + ACCOUNTS.indexOf(account),
      })),
      {
        id: 'unallocated',
        annualKrw: p.unallocated,
        // 한도가 없는 갈래 — 어느 계좌에도 들어가지 않는 돈이다.
        poolId: null,
        orderIndex: monthlyLastOrder * 2,
      },
    ];
    const monthlySplit = apportionMonthly({
      months,
      capacityMonthlyKrw: profile.monthly_capacity_krw,
      buckets: monthlyBuckets,
      poolHeadroomKrw: {
        // 두 연금계좌가 모두 막혀 있으면 납입 여력이 남아 있어도 얹을 수 없다
        // (`unallocatedBreakdown`과 같은 판정이다).
        pension: pensionOpen ? clampToZero(p.pensionPoolRemaining) : 0,
        isa: isaEligible ? clampToZero(p.isaPoolRemaining) : 0,
      },
    });
    const monthlyById = new Map(monthlySplit.buckets.map((b) => [b.id, b]));

    const allocations = ACCOUNTS.map((account) => {
      const annualKrw = p.allocByAccount[account] ?? 0;
      const m = monthlyById.get(account);
      return {
        account,
        // 7.0.0에서 산식이 바뀌었다 — `내림 + monthly_rounding_adjustment_krw`
        // (계약 0.12·5.5절). 순수한 내림만 쓰면 계좌별 금액을 더해도 월 납입
        // 여력이 되지 않는다(소유자가 신고한 결함).
        monthly_krw: m.monthlyKrw,
        // 7.0.0 신규 — `monthly_krw × 개월수`. 화면이 직접 곱하지 않도록 미리
        // 낸다(둘은 다를 수 있고, 다른 것이 정상이다).
        monthly_annualized_krw: m.monthlyAnnualizedKrw,
        // 7.0.0 신규 — 이 계좌가 떠안은 월 환산 잔차(0 이상 3 이하).
        monthly_rounding_adjustment_krw: m.roundingAdjustmentMonthlyKrw,
        annual_krw: annualKrw,
        fill_order: p.fillOrderByAccount[account] ?? null,
        limited_by: annualKrw === 0 ? p.limitedBy[account] ?? null : p.limitedBy[account] ?? null,
        basis_rule_ids:
          account === 'isa'
            ? [isaRequirementsRule?.id, scenario === 'proposed' ? 'proposed.isa.annual_contribution_limit' : 'isa.contribution.annual_limit'].filter(Boolean)
            : [pensionContributionLimitRule?.id].filter(Boolean),
      };
    });

    const totalAnnual = allocations.reduce((s, a) => s + a.annual_krw, 0);
    const totalMonthly = allocations.reduce((s, a) => s + a.monthly_krw, 0);
    // **뜻은 1.0.0 이래 그대로**(연 배분을 개월수로 내림할 때 버려지는 몫의
    // 합·계좌만 센다) — 다만 `총 연 − 총 월 × 개월수`로는 더 이상 이 값이
    // 나오지 않는다(0.12절). 계좌별 나머지(annual mod months)를 직접 더한다.
    const residual = months > 0 ? ACCOUNTS.reduce((s, account) => s + ((p.allocByAccount[account] ?? 0) % months), 0) : 0;
    const unallocatedMonthly = monthlyById.get('unallocated');
    const monthlyUnassignedKrw = monthlySplit.unassignedMonthlyKrw;

    const warnings = [];
    for (const a of allocations) {
      if (a.annual_krw <= 0) continue;
      if (a.account === 'isa') {
        if (profile.fund_use_horizon === 'within_isa_lock_in') {
          warnings.push(mkWarning('early_termination_clawback_isa', 'isa', 'warning', 'declared_horizon', use('isa.early_termination.clawback')?.id, use('isa.account.requirements')?.id));
        } else if (profile.fund_use_horizon === 'unknown') {
          warnings.push(mkWarning('early_termination_clawback_isa', 'isa', 'info', 'horizon_unknown', use('isa.early_termination.clawback')?.id, use('isa.account.requirements')?.id));
        }
      } else {
        if (profile.fund_use_horizon === 'within_isa_lock_in' || profile.fund_use_horizon === 'before_pension_age') {
          warnings.push(
            mkWarning(
              'early_withdrawal_penalty_pension',
              a.account,
              'warning',
              'declared_horizon',
              use('pension.withdrawal.eligibility')?.id,
              use('pension.early_withdrawal.other_income_rate')?.id,
            ),
          );
        } else if (profile.fund_use_horizon === 'unknown') {
          warnings.push(
            mkWarning(
              'early_withdrawal_penalty_pension',
              a.account,
              'info',
              'horizon_unknown',
              use('pension.withdrawal.eligibility')?.id,
              use('pension.early_withdrawal.other_income_rate')?.id,
            ),
          );
        }
      }
    }
    warnings.sort((a, b) => (ACCOUNTS.indexOf(a.account) - ACCOUNTS.indexOf(b.account)) || byCodeUnit(a.code, b.code));

    const priorityBasisCode = {
      max_tax_credit: 'tax_credit_maximization',
      annuity_savings_first: 'annuity_savings_limit_first',
      isa_first: 'isa_liquidity_first',
      // **이름이 세액공제를 말하지 않는다** — 이 안이 채우는 것은 납입 한도이고
      // 그 납입이 유리한지는 세법이 정하지 않는다(D26). 6.0.0에서
      // `pension_contribution_limit_first`에서 `pension_contribution_limit_before_isa`로
      // 바뀌었다 — 남은 차이가 "납입 한도까지 채운다"(이제 네 안 전부가 한다)가
      // 아니라 "ISA보다 먼저"뿐이라는 사실을 이름이 말해야 한다(0.11절).
      pension_contribution_before_isa: 'pension_contribution_limit_before_isa',
    }[p.planId];

    const nonQuantified = [];
    // 5.1.0(D28) — **수익률 가정이 들어오면 이 효과는 더 이상 "금액으로 낼 수
    // 없는 것"이 아니다.** 가정이 있는데도 이 항목을 그대로 내보내면 응답이
    // 자기 자신과 어긋난다 — `assumption_based_isa_estimate`가 그 자리를 대신한다
    // (계약 4.2절 "두 곳에서 기존 출력이 줄어든다").
    if (taxFreeLimit != null && !isaReturnContext.supplied) {
      nonQuantified.push({
        code: 'isa_tax_free_headroom',
        account: 'isa',
        headroom_krw: taxFreeLimit,
        headroom_shared_with: [],
        quantifiable: false,
        reason_code: 'depends_on_investment_return_not_in_ruleset',
        basis_rule_ids: isaTaxFreeRule ? [isaTaxFreeRule.id] : [],
      });
    }

    // -- 6.0.0(D32) — 세액공제를 낳지 않는 연금계좌 납입 -----------------------
    // **더 이상 `pension_contribution_before_isa`의 전유물이 아니다.** 네 안
    // 모두 이제 연금 납입 한도(1,800만)까지 채우므로, 이 배분안이 실제로 그
    // 계좌에 신용 한도 너머를 넣었으면(= 위 2단계 fill이 3차 단계를 밟았으면)
    // 어느 안이든 이 효과가 붙는다. `plan.plan_id`로 걸지 않는다 — 아래
    // `withoutCreditByAccount`가 이 배분안의 실제 배분액에서 직접 계산한다.
    {
      const beyondCreditLimitRule = use('pension.contribution.beyond_credit_limit', 'plans[].non_quantified_effects');
      const nonDeductedPrincipalRule = use('pension.withdrawal.non_deducted_principal', 'plans[].non_quantified_effects');
      if (beyondCreditLimitRule && nonDeductedPrincipalRule) {
        const effects = beyondCreditLimitRule.value.effects ?? [];
        const has = (id) => effects.some((e) => e?.id === id && e.determined_by_law === true);
        const procedure = nonDeductedPrincipalRule.value.confirmation_procedure ?? {};
        if (has('no_credit_this_year') && has('principal_not_taxed_on_withdrawal') && has('returns_taxed_on_withdrawal')) {
          const factsBasis = [beyondCreditLimitRule.id, nonDeductedPrincipalRule.id].sort();
          // 어느 계좌의 납입이 공제를 낳지 않는가 — 퇴직연금분을 먼저 인정한다
          // (D17과 같은 우선순위). 이 배분안의 **새 납입액**만 본다(기납입분이
          // 이미 한도를 넘는 것은 `existing_contribution_over_limit`이 따로 말한다).
          const annuityBaseForFacts = accounts.annuity_savings.ytd_contribution_krw + p.allocByAccount.annuity_savings + (transferDestination === 'annuity_savings' ? isaTransfer.amount_krw : 0);
          const retirementBaseForFacts = accounts.retirement_pension.ytd_contribution_krw + p.allocByAccount.retirement_pension + (transferDestination === 'retirement_pension' ? isaTransfer.amount_krw : 0);
          const annuityCreditCapEffectiveForFacts = annuityCreditCap + (transferDestination === 'annuity_savings' ? extraCreditLimit : 0);
          const combinedCreditCapEffectiveForFacts = baseCombinedCreditCap + extraCreditLimit;
          const annuityCreditEligibleForFacts = Math.min(annuityBaseForFacts, annuityCreditCapEffectiveForFacts);
          const retirementCreditEligibleForFacts = Math.max(
            0,
            Math.min(annuityCreditEligibleForFacts + retirementBaseForFacts, combinedCreditCapEffectiveForFacts) - annuityCreditEligibleForFacts,
          );
          const withoutCreditByAccount = {
            annuity_savings: Math.min(p.allocByAccount.annuity_savings, Math.max(0, annuityBaseForFacts - annuityCreditEligibleForFacts)),
            retirement_pension: Math.min(p.allocByAccount.retirement_pension, Math.max(0, retirementBaseForFacts - retirementCreditEligibleForFacts)),
          };
          for (const account of ['retirement_pension', 'annuity_savings']) {
            const withoutCredit = withoutCreditByAccount[account];
            if (withoutCredit <= 0) continue;
            nonQuantified.push({
              code: 'pension_contribution_without_credit',
              account,
              // 두 계좌가 **같은 풀**을 나눠 쓴다 — 더하면 이중계상이다.
              headroom_krw: p.pensionPoolRemaining,
              headroom_shared_with: [account === 'retirement_pension' ? 'annuity_savings' : 'retirement_pension'],
              quantifiable: false,
              reason_code: 'benefit_depends_on_return_horizon_and_withdrawal_form_not_in_ruleset',
              facts: {
                credit_this_year_krw: 0,
                contribution_without_credit_krw: withoutCredit,
                principal_taxed_on_withdrawal: false,
                principal_tax_free_requires_confirmation: procedure.automatic !== true,
                principal_tax_free_confirmation_prospective_only: procedure.prospective_only != null,
                returns_taxed_on_withdrawal: true,
              },
              basis_rule_ids: factsBasis,
            });
          }
        }
      }
    }

    // 5.0.0(D26) — 미배분액을 갈래로 나눈다. 「미배분」이 "갈 곳이 없다"로 읽히지
    // 않게, 두 계좌 여력과 정말 갈 곳 없는 몫을 나눠 낸다(5.13절). **겹치면
    // 더하지 않는다** — `headrooms_overlap`이 그 사실을 값으로 말한다.
    // (`pensionOpen`은 위 월 환산 잔차 배정에서 이미 계산했다 — 같은 판정이다.)
    const pensionRoom = pensionOpen ? Math.max(0, p.pensionPoolRemaining) : 0;
    const isaRoom = isaEligible ? Math.max(0, p.isaPoolRemaining) : 0;
    const pensionHeadroomKrw = Math.min(p.unallocated, pensionRoom);
    const isaHeadroomKrw = Math.min(p.unallocated, isaRoom);
    const unallocatedBreakdown = {
      total_annual_krw: p.unallocated,
      pension_contribution_headroom_krw: pensionHeadroomKrw,
      isa_contribution_headroom_krw: isaHeadroomKrw,
      no_headroom_krw: Math.max(0, p.unallocated - (pensionRoom + isaRoom)),
      headrooms_overlap: pensionHeadroomKrw + isaHeadroomKrw > p.unallocated,
      basis_rule_ids: [
        pensionContributionLimitRule?.id,
        use('pension.contribution.beyond_credit_limit')?.id,
        ...(isaRequirementsRule ? [isaRequirementsRule.id] : []),
      ].filter(Boolean),
    };

    // 5.1.0(D28·D29·D31) — 원금은 「가입 이후 누적 납입액 + 이 배분안의 ISA
    // 배분액」이다. 헤드라인 합계(아래)가 이 값을 다시 필요로 하므로 먼저 뽑아 둔다.
    const planIsaEstimate = isaEstimateFor({
      context: isaReturnContext,
      display: isaEstimateDisplay,
      taxFreeLimitKrw: taxFreeLimit,
      principalKrw: accounts.isa.cumulative_contribution_krw + (p.allocByAccount.isa ?? 0),
      surtaxRate: localRateOfIncomeTax,
    });

    return {
      plan_id: p.planId,
      is_baseline: false,
      warnings,
      priority_basis: {
        code: priorityBasisCode,
        fill_sequence: p.sequence,
        // 6.0.0(D32, 0.11절) — **네 안 전부**가 이제 3차(연금 납입 한도까지)를
        // 밟을 수 있으므로, 그 근거 셋(연금 납입 한도 · 신용 한도 너머 취급 ·
        // 인출 자유 순서)이 네 안 전부의 근거 목록에 들어간다.
        // `priority_basis.code`는 여전히 각 안의 이름(`tax_credit_maximization`
        // 등)을 그대로 쓴다 — 3차 몫의 근거는 이름이 아니라 이 목록이 말한다.
        basis_rule_ids: [
          ...new Set(
            [
              pensionContributionLimitRule?.id,
              use('pension.contribution.beyond_credit_limit')?.id,
              use('pension.withdrawal.midterm_restriction')?.id,
              ...(p.planId === 'isa_first'
                ? [use('pension.withdrawal.eligibility')?.id, use('isa.account.requirements')?.id]
                : []),
            ].filter(Boolean),
          ),
        ].sort(),
        // 확정 룰셋에는 계좌에 따라 공제율이 갈리는 규칙이 없어 두 연금계좌의
        // 한계 공제율이 언제나 같다 — 그래서 확정 시나리오는 언제나
        // `withdrawal_flexibility_first`다(계약 5.6절). `annuity_savings_first`만
        // 순서가 이름/설계로 고정된 안이라 동점 규칙을 적용하지 않는다
        // (계약 5.6절 — "동점의 전제가 이 안에서 무너진다"). **6.0.0에서
        // `pension_contribution_before_isa`는 이 예외에서 빠졌다** — 이 안의
        // 1차(연금 공제한도까지) 순서도 이제 다른 두 안과 같은 동점 규칙을 따른다.
        // `tie_break.code`는 **1차의 판정**이다(5.6절) — 3차는 동점 여부와
        // 무관하게 언제나 인출 자유 계좌부터 채운다.
        tie_break:
          p.planId === 'annuity_savings_first' || scenario === 'proposed'
            ? { code: 'not_applicable', basis_rule_ids: [] }
            : {
                code: 'withdrawal_flexibility_first',
                basis_rule_ids: [use('pension.withdrawal.midterm_restriction')?.id].filter(Boolean),
              },
        // **이 안이 이름으로 내세운 목적함수가 이 입력에서 순위를 정하지 못하는가.**
        // 한도가 0이면 연금계좌에 얼마를 넣든 공제액이 0이라 최대값이 유일하지 않다.
        // `isa_first`·`pension_contribution_before_isa`는 언제나 false다 — 두 안의
        // 근거(인출 가능성 / ISA와의 선후)는 세액 한도와 무관하게 그대로 성립한다(5.12절).
        objective_degenerate:
          (p.planId === 'max_tax_credit' || p.planId === 'annuity_savings_first') && capKnown && capKrw === 0,
      },
      allocations: ACCOUNTS.map((a) => allocations.find((x) => x.account === a)),
      total_allocated_monthly_krw: totalMonthly,
      total_allocated_annual_krw: totalAnnual,
      // 7.0.0부터 순수한 내림이 아니다 — 잔차를 떠안을 수 있다(0.12절).
      unallocated_monthly_krw: unallocatedMonthly.monthlyKrw,
      // 7.0.0 신규 — 미배분이 떠안은 월 환산 잔차.
      unallocated_monthly_rounding_adjustment_krw: unallocatedMonthly.roundingAdjustmentMonthlyKrw,
      unallocated_annual_krw: p.unallocated,
      unallocated_breakdown: unallocatedBreakdown,
      // **배분 후** 남는 연금계좌 합산 세액공제 대상 한도. 배분 전 값
      // (`limits.pension_combined_credit_remaining_krw`)과는 다르다(5.13.1절) —
      // 화면이 뺄셈으로 만들지 않도록 여기서 낸다.
      pension_combined_credit_remaining_after_plan_krw: Math.max(0, baseCombinedCreditCap + extraCreditLimit - creditEligible),
      monthly_rounding_residual_krw: residual,
      // 7.0.0 신규 — 잔차 중 어느 갈래에도 얹지 못한 몫. 0이면 `null`이다.
      monthly_unassigned_krw: monthlyUnassignedKrw,
      monthly_unassigned_reason_code: monthlyUnassignedKrw > 0 ? 'no_destination_within_contribution_limit' : null,
      deterministic_benefit: {
        // 4.0.0 — 앞의 세 필드는 한도 적용 **후** 값이다.
        pension_credit_income_tax_krw: incomeTaxKrw,
        pension_credit_local_tax_krw: localTaxKrw,
        pension_credit_total_krw: totalCreditKrw,
        pension_credit_income_tax_before_cap_krw: incomeTaxBeforeCapKrw,
        pension_credit_local_tax_before_cap_krw: localTaxBeforeCapKrw,
        pension_credit_total_before_cap_krw: totalBeforeCapKrw,
        // **세액 한도로 잘리지 않는다** — 잘리는 것은 공제액이고 납입액은
        // 전환 신청의 대상으로 살아남는다.
        credit_eligible_contribution_krw: creditEligible,
        tax_liability_cap: planCap,
        basis_rule_ids: [creditRateRule?.id, creditRateBasisRule?.id, annuityCreditLimitRule?.id, combinedCreditLimitRule?.id, surtaxRule?.id, 'pension.credit.tax_liability_cap'].filter(Boolean),
      },
      delta_vs_baseline_krw: 0, // baseline 선정 후 채운다
      non_quantified_effects: nonQuantified,
      // 5.1.0(D28·D29·D31) — **`DeterministicBenefit`과 같은 축에 놓거나 더하지
      // 않는다.** 원금이 이 안의 ISA 배분액을 포함하므로 안마다 값이 다를 수
      // 있다(계약 5.14절). 가정을 보내지 않았으면 `null`이다.
      assumption_based_isa_estimate: planIsaEstimate,
      // 8.2.0(D38) — **위 두 값을 더해도 되는 자리는 여기 하나뿐이고, 그 덧셈은
      // 이미 했다.** 화면이 다시 더하지 않는다(계약 5.17절).
      headline_composite_total: headlineCompositeTotalFor({
        determinedCreditKrw: totalCreditKrw,
        estimate: planIsaEstimate,
        isaAllocatedKrw: p.allocByAccount.isa ?? 0,
        basisRuleIds: headlineBasisRuleIds,
      }),
      _allocationVector: ACCOUNTS.map((a) => p.allocByAccount[a] ?? 0).join('|'),
      _totalCredit: totalCreditKrw,
    };
  });

  // -- 배분 벡터가 같은 안 합치기 -------------------------------------------
  const seen = new Map();
  const collapsed = [];
  for (const plan of plans) {
    if (seen.has(plan._allocationVector)) continue;
    seen.set(plan._allocationVector, true);
    collapsed.push(plan);
  }

  // -- 기본안 선정 (fund_use_horizon이 정한다) ------------------------------
  function warningCount(plan) {
    return plan.warnings.filter((w) => w.severity === 'warning').length;
  }
  // `pension_contribution_before_isa`는 기본안 후보에서 뺀다(계약 5.5·10절 —
  // "언제나 `is_baseline: false`이고 화면도 그 판단을 대신하지 않는다"). 세법이
  // 유불리를 정하지 않는 안을 엔진이 기본으로 고르면 그것이 곧 자문이다(D26·D32).
  const baselineCandidates = collapsed
    .map((plan, index) => ({ plan, index }))
    .filter(({ plan }) => plan.plan_id !== 'pension_contribution_before_isa');
  let baselineIndex = baselineCandidates[0]?.index ?? 0;
  if (profile.fund_use_horizon === 'within_isa_lock_in' || profile.fund_use_horizon === 'before_pension_age') {
    let best = baselineCandidates[0];
    for (const candidate of baselineCandidates) {
      if (warningCount(candidate.plan) < warningCount(best.plan)) best = candidate;
    }
    baselineIndex = best.index;
  } else {
    const mtc = baselineCandidates.find(({ plan }) => plan.plan_id === 'max_tax_credit');
    baselineIndex = mtc ? mtc.index : baselineCandidates[0].index;
  }

  const baseline = collapsed[baselineIndex];
  // 반드시 forEach 루프 전에 값을 붙잡아 둔다 — baseline도 orderedPlans의 한
  // 원소(i===0)라서 루프 중에 baseline._totalCredit 자체가 delete되고, 그 뒤로
  // 처리되는 다른 안들이 이미 지워진 값을 참조해 NaN을 내는 버그가 있었다
  // (브라우저로 직접 확인해서 잡았다).
  const baselineCreditKrw = baseline._totalCredit;
  const rest = collapsed.filter((_, i) => i !== baselineIndex);
  rest.sort((a, b) => PLAN_ORDER.indexOf(a.plan_id) - PLAN_ORDER.indexOf(b.plan_id));
  const orderedPlans = [baseline, ...rest];
  orderedPlans.forEach((p, i) => {
    p.is_baseline = i === 0;
    p.delta_vs_baseline_krw = i === 0 ? 0 : Math.min(0, p._totalCredit - baselineCreditKrw);
    delete p._allocationVector;
    delete p._totalCredit;
  });

  const comparisonNoteCodes = [];
  if (collapsed.length === 1) comparisonNoteCodes.push('plans_collapsed_single');
  if (profile.fund_use_horizon === 'within_isa_lock_in') {
    const allExposed = ACCOUNTS.every((account) => {
      const alloc = baseline.allocations.find((a) => a.account === account);
      if (!alloc || alloc.annual_krw <= 0) return true;
      return baseline.warnings.some((w) => w.account === account);
    });
    if (allExposed) comparisonNoteCodes.push('all_accounts_have_early_exit_penalty');
  }
  if (orderedPlans[0].plan_id !== 'max_tax_credit') comparisonNoteCodes.push('baseline_reordered_by_fund_use_horizon');
  if (orderedPlans.some((p) => !p.is_baseline && p.delta_vs_baseline_krw === 0)) comparisonNoteCodes.push('alternatives_have_equal_tax_credit');
  // **세액공제액으로는 배분안이 갈리지 않는다** — `alternatives_have_equal_tax_credit`와
  // 달리 그 동률이 앞으로 어떤 배분에서도 깨지지 않는다는 사실까지 말한다(계약 8.5절).
  if (capKnown && capKrw === 0) comparisonNoteCodes.push('tax_credit_axis_not_discriminating');
  if (orderedPlans.some((p) => p.deterministic_benefit.tax_liability_cap.applied)) {
    notices.push({ code: 'tax_liability_cap_applied', severity: 'info', field: null, params: {}, basis_rule_ids: capBasisRuleIds });
  }

  // -- 가정 기반 ISA 정산액에 딸린 안내 (5.1.0, D28·D29·D31 / 계약 8.2절) --------
  //
  // **가정을 받지 않았다는 사실도 안내로 낸다.** 조용히 빈 자리를 남기면 화면은
  // "ISA 효과가 없다"와 "묻지 않았다"를 구별할 수 없다(D19).
  if (!isaReturnContext.supplied) {
    notices.push({
      code: 'isa_return_assumption_not_supplied',
      severity: 'info',
      field: 'profile.isa_return_assumption',
      params: {},
      basis_rule_ids: [],
    });
  } else {
    if (isaEstimateDisplay === 'suppress') {
      // 표시가 꺼진 상태가 조용하면 안 된다 — 계산은 돌았고 금액만 감춘 것이다.
      notices.push({
        code: 'isa_return_estimate_display_suppressed',
        severity: 'info',
        field: 'options.assumption_based_isa_estimate',
        params: {},
        basis_rule_ids: [],
      });
    }
    const estimates = orderedPlans.map((p) => p.assumption_based_isa_estimate).filter(Boolean);
    const notComputable = estimates.find((e) => e.state === 'not_computable');
    if (notComputable) {
      notices.push({
        code: 'isa_return_estimate_not_computable',
        severity: 'warning',
        field: 'profile.isa_return_assumption',
        params: { reason_code: notComputable.not_computable_reason_code },
        basis_rule_ids: [],
      });
    }
    const computedEstimate = estimates.find((e) => e.state === 'computed');
    if (computedEstimate) {
      // 이 금액은 정산 기간 전체의 값이다. 연 환산은 비과세 한도를 해마다 새로
      // 주는 계산이 되어 **적어도** 1.75배 과대다(계약 3년) — 계약이 길수록
      // 커져 2.8배에 수렴한다. **1.75는 상한이 아니라 하한이다**
      // (`isa.benefit.settlement_period`, 계약 0.16절 정정).
      notices.push({
        code: 'isa_return_estimate_is_not_annual',
        severity: 'info',
        field: null,
        params: { settlement_years: computedEstimate.settlement_years },
        basis_rule_ids: [use('isa.benefit.settlement_period')?.id].filter(Boolean),
      });
      if (estimates.some((e) => e.state === 'computed' && e.point_estimate_krw === null)) {
        notices.push({
          code: 'isa_return_estimate_reported_as_range',
          severity: 'info',
          field: 'profile.isa_return_assumption',
          params: {},
          basis_rule_ids: [use('isa.benefit.income_character')?.id].filter(Boolean),
        });
      }
    }
    // ISA 칸에만 금액이 보이는 것을 "ISA가 더 낫다"로 읽으면 안 된다 — 연금계좌
    // 쪽 과세이연 효과는 꺼내는 시점에 정해지므로 지금 계산할 수 없다.
    notices.push({
      code: 'pension_tax_deferral_not_quantified',
      severity: 'info',
      field: null,
      params: {},
      basis_rule_ids: [use('pension.tax_deferral.with_return_rate')?.id].filter(Boolean),
    });
  }

  if (profile.fund_use_horizon === 'unknown') {
    notices.push({ code: 'fund_use_horizon_not_declared', severity: 'info', field: 'profile.fund_use_horizon', params: {}, basis_rule_ids: [] });
  }
  if (budget === 0) notices.push({ code: 'zero_capacity', severity: 'info', field: 'profile.monthly_capacity_krw', params: {}, basis_rule_ids: [] });
  const totalRemainingLimits = sharedPensionPoolBase + isaAnnualRoom;
  if (budget > totalRemainingLimits) notices.push({ code: 'budget_exceeds_all_limits', severity: 'info', field: null, params: {}, basis_rule_ids: [] });
  notices.push({ code: 'pension_holding_period_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });
  if (profile.declared_youth == null) {
    notices.push({ code: 'youth_status_not_declared', severity: 'info', field: 'profile.declared_youth', params: {}, basis_rule_ids: [] });
  }
  if (scenario === 'proposed') {
    const proposedRuleIds = [...usedRules.keys()].filter((id) => id.startsWith('proposed.'));
    notices.push({ code: 'proposed_not_enacted', severity: 'warning', field: null, params: {}, basis_rule_ids: proposedRuleIds });
  }

  // -- FundUseHorizonBoundaries ---------------------------------------------
  const boundaries = computeBoundariesInternal(
    { age_years: ageYears, isa_exists: accounts.isa.exists, isa_years_since_opening: accounts.isa.years_since_opening },
    rulesets,
    files,
  );

  // -- 연금 개시 가능 시점 (계약 5.11절) -------------------------------------
  //
  // **남은 기간을 배분 비율로 옮기지 않는다.** 세법이 정하는 것은 언제부터 연금으로
  // 나올 수 있는가와 그 전에 꺼내면 얼마가 과세되는가뿐이고, 그 둘을 비율로 옮기는
  // 것은 제품의 설계 결정이라고 규칙이 명시한다. 엔진은 시점만 낸다.
  const earliestStartRule = use('pension.withdrawal.earliest_start', 'scenarios[].pension_withdrawal_start');
  const withdrawalEligibilityRule = use('pension.withdrawal.eligibility', 'scenarios[].pension_withdrawal_start');
  const requirements = withdrawalEligibilityRule?.value?.requirements ?? [];
  const minAgeForStart = requirements.find((r) => r.id === 'age')?.min_age ?? null;
  const holdingYears = requirements.find((r) => r.min_years != null)?.min_years ?? null;
  let anyStartNotComputable = false;
  const pensionWithdrawalStart = PENSION_ACCOUNTS.map((account) => {
    const ageRequirementDate = minAgeForStart == null ? null : datePlusYears(birth, minAgeForStart);
    const openedOn = accounts[account].opened_on ? parseIsoDate(accounts[account].opened_on) : null;
    const waived = accounts[account].has_deferred_retirement_income === true;
    const holdingRequirementDate =
      openedOn && holdingYears != null && !waived ? datePlusYears(openedOn, holdingYears) : null;
    // **가입일을 모르면 시점을 계산할 수 없고, 그때 남은 기간을 추정해서는 안 된다**
    // (규칙의 `engine_note`). 나이 요건만 낸다.
    const computable = ageRequirementDate != null && (waived || openedOn != null);
    if (!computable) anyStartNotComputable = true;
    const earliest = !computable
      ? null
      : holdingRequirementDate && holdingRequirementDate > ageRequirementDate
        ? holdingRequirementDate
        : ageRequirementDate;
    // 과세기간 종료일부터 남은 햇수(**올림**) — 짧게 보이는 쪽이 위험하다.
    const yearsUntil =
      earliest == null
        ? null
        : Math.max(0, Math.ceil((Date.parse(earliest) - Date.parse(referenceDate)) / (365.2425 * 24 * 3600 * 1000)));
    return {
      account,
      computable,
      earliest_start_date: earliest,
      years_until_earliest_start: yearsUntil,
      age_requirement_date: ageRequirementDate,
      holding_requirement_date: holdingRequirementDate,
      holding_requirement_waived: waived,
      bound_by_holding_period: Boolean(earliest && holdingRequirementDate && earliest === holdingRequirementDate),
      reason_code: computable ? null : 'opened_on_missing',
      basis_rule_ids: [earliestStartRule?.id, withdrawalEligibilityRule?.id].filter(Boolean),
    };
  });
  if (anyStartNotComputable) {
    notices.push({ code: 'pension_start_date_not_computable', severity: 'info', field: null, params: {}, basis_rule_ids: [] });
  }

  // -- legal_basis -----------------------------------------------------------
  const legalBasis = [...usedRules.values()]
    .map(({ rule, appliedTo }) => toLegalBasisEntry(rule, [...appliedTo]))
    .sort((a, b) => {
      const statusOrder = (s) => (s === '확정' ? 0 : 1);
      const so = statusOrder(a.status) - statusOrder(b.status);
      return so !== 0 ? so : byCodeUnit(a.rule_id, b.rule_id);
    });

  const billStages = [...new Set(legalBasis.filter((l) => l.bill_stage).map((l) => l.bill_stage))];

  // -- unapplied_proposed_rules -----------------------------------------------
  const unapplied = [];
  if (scenario === 'proposed' && rulesets['2027-proposed.json']) {
    const appliedIds = new Set(usedRules.keys());
    const reasonFor = {
      'proposed.productive_isa.introduction': 'out_of_product_scope',
      'proposed.productive_isa.eligibility': 'out_of_product_scope',
      'proposed.productive_isa.account_requirements': 'out_of_product_scope',
      'proposed.productive_isa.contribution_limit': 'out_of_product_scope',
      'proposed.productive_isa.youth_income_deduction': 'requires_input_not_collected',
      'proposed.productive_isa.pension_transfer.additional_contribution': 'out_of_product_scope',
      'proposed.productive_isa.pension_transfer.credit_extra_limit': 'out_of_product_scope',
      'proposed.pension.credit.youth_irp_rate': 'requires_input_not_collected',
      'proposed.productive_isa.rural_special_tax_exemption': 'out_of_product_scope',
      'proposed.isa.contract_period': 'affects_multi_year_only',
      'proposed.isa.sunset': 'affects_multi_year_only',
    };
    for (const rule of rulesets['2027-proposed.json'].rules) {
      if (appliedIds.has(rule.id)) continue;
      unapplied.push({ rule_id: rule.id, title: rule.title, reason_code: reasonFor[rule.id] ?? 'out_of_product_scope' });
    }
  }

  return {
    scenario_id: scenario,
    is_enacted: isEnacted,
    bill_stages: billStages,
    ruleset: {
      files,
      tax_year: rulesets[files[0]]?.tax_year ?? request.tax_year,
      status: rulesets['2026.json']?.status ?? '확정',
      effective_from: rulesets['2026.json']?.effective_from ?? '2026-01-01',
    },
    account_eligibility: accountEligibility,
    // **가입 자격과 다른 축이다**(계약 5.18절, D44). 공제액 0의 경로가 「산출세액이
    // 0이라 잘렸다」인지 「종합소득이 없어 요건이 서지 않는다」인지를 화면이
    // 여기서 읽는다 — 금액은 같고 쓸 수 있는 문장이 다르다.
    pension_credit_taxpayer_eligibility: pensionCreditTaxpayerEligibility,
    // 세액 한도와 **그것을 어떻게 계산했는지.** 두 시나리오에서 같은 값이다 —
    // 한도는 개정예고 규칙의 대상이 아니다(계약 5.10절, D39·D40).
    pension_credit_tax_liability_cap: capResolved?.cap ?? null,
    // 5.15절. 확정 축의 최댓값(D36) — 이 사람이 올해 받을 수 있는 세액공제의 상한.
    pension_credit_ceiling: pensionCreditCeiling,
    // 5.16절. 연금계좌를 나중에 받을 때의 세율표(D36). 금액은 한 칸도 없다.
    pension_withdrawal_tax_reference: pensionWithdrawalTaxReference,
    pension_withdrawal_start: pensionWithdrawalStart,
    limits: {
      by_account: ACCOUNTS.map((account) => {
        if (account === 'isa') {
          return {
            account,
            contribution_limit_remaining_krw: isaAnnualRoom,
            // 이 한도를 함께 쓰는 다른 계좌 — 비어 있으면 이 계좌 전용이다(계약 5.3절).
            contribution_limit_shared_with: [],
            credit_eligible_limit_remaining_krw: null,
            credit_limit_shared_with: [],
            tax_free_limit_krw: taxFreeLimit,
            clamped_to_zero: accounts.isa.cumulative_contribution_krw > effectiveTotalLimit,
            basis_rule_ids: [isaRequirementsRule?.id].filter(Boolean),
          };
        }
        const ytd = accounts[account].ytd_contribution_krw;
        const cap = account === 'annuity_savings' ? annuityCreditCap : baseCombinedCreditCap + extraCreditLimit;
        // **계좌별 한도를 더하면 안 된다** — 연금저축과 퇴직연금은 같은 풀을 본다.
        // 합계가 필요하면 아래 `pension_*` 필드를 쓴다(계약 5.3절).
        const other = PENSION_ACCOUNTS.filter((a) => a !== account);
        return {
          account,
          contribution_limit_remaining_krw: sharedPensionPoolBase,
          contribution_limit_shared_with: other,
          credit_eligible_limit_remaining_krw: Math.max(0, cap - ytd),
          credit_limit_shared_with: other,
          tax_free_limit_krw: null,
          clamped_to_zero: ytd > pensionContributionCap,
          basis_rule_ids: [pensionContributionLimitRule?.id].filter(Boolean),
        };
      }),
      pension_combined_credit_limit_krw: baseCombinedCreditCap + extraCreditLimit,
      pension_combined_credit_remaining_krw: Math.max(
        0,
        baseCombinedCreditCap +
          extraCreditLimit -
          Math.min(accounts.annuity_savings.ytd_contribution_krw, annuityCreditCap) -
          accounts.retirement_pension.ytd_contribution_krw,
      ),
      pension_contribution_limit_remaining_krw: sharedPensionPoolBase,
      // **세액공제 대상이 아니다.** 분리해 받은 값을 분리한 채로 되돌려 준다 —
      // 화면이 이 금액을 절세액과 같은 축에 놓지 않게 하기 위해서다(계약 5.3절).
      retirement_transfer_in_krw: retirementTransferTotal,
      basis_rule_ids: [combinedCreditLimitRule?.id, pensionContributionLimitRule?.id].filter(Boolean),
    },
    isa_transfer_extra_limit: isaTransferExtraLimit,
    fund_use_horizon_boundaries: boundaries.boundaries,
    plans: orderedPlans,
    comparison_note_codes: comparisonNoteCodes,
    legal_basis: legalBasis,
    unapplied_proposed_rules: unapplied,
    notices,
    _missingRules: missingRules,
  };
}

function mkWarning(code, account, severity, trigger, ruleId1, ruleId2) {
  return {
    code,
    account,
    severity,
    trigger,
    basis_rule_ids: [ruleId1, ruleId2].filter(Boolean),
    params: {},
  };
}

// ---------------------------------------------------------------------------
// 경계값 계산 (공용 — compute와 computeFundUseHorizonBoundaries가 함께 쓴다)
// ---------------------------------------------------------------------------

function computeBoundariesInternal(input, rulesets, files) {
  const isaRule = findRule(rulesets, 'isa.account.requirements', files)?.rule;
  const pensionRule = findRule(rulesets, 'pension.withdrawal.eligibility', files)?.rule;
  const clawbackRule = findRule(rulesets, 'isa.early_termination.clawback', files)?.rule;

  const lockInYears = isaRule ? isaRule.value.min_contract_years : null;
  const yearsSince = input.isa_years_since_opening;
  const lockInRemaining =
    lockInYears == null ? null : Math.max(0, lockInYears - (yearsSince ?? 0));

  const minAge = pensionRule ? pensionRule.value.requirements.find((r) => r.id === 'age')?.min_age ?? null : null;
  const pensionRemaining = minAge == null ? null : Math.max(0, minAge - input.age_years);

  const notices = [];
  if (input.isa_exists && yearsSince == null) {
    notices.push({ code: 'isa_tenure_missing', severity: 'warning', field: 'accounts.isa.years_since_opening', params: {}, basis_rule_ids: isaRule ? [isaRule.id] : [] });
  }
  notices.push({ code: 'pension_holding_period_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });

  const legalBasis = [isaRule, pensionRule, clawbackRule]
    .filter(Boolean)
    .map((r) => toLegalBasisEntry(r, ['fund_use_horizon_boundaries']));

  return {
    boundaries: {
      isa_lock_in_years: lockInYears,
      isa_lock_in_years_remaining: lockInRemaining,
      pension_min_age_years: minAge,
      pension_years_remaining: pensionRemaining,
      pension_holding_period_evaluated: false,
      basis_rule_ids: [isaRule?.id, clawbackRule?.id, pensionRule?.id].filter(Boolean),
    },
    legal_basis: legalBasis,
    notices,
  };
}

// ---------------------------------------------------------------------------
// 공개 진입점
// ---------------------------------------------------------------------------

export function compute(request, rulesets) {
  const errors = validateRequest(request);
  if (errors.length > 0) {
    return { ok: false, schema_version: request?.schema_version ?? MOCK_SCHEMA_VERSION, errors };
  }

  const months = request.profile.months_remaining_in_tax_year ?? 12;
  const req = { ...request, months_remaining_effective: months };

  const uniqueScenarios = SCENARIO_ORDER.filter((s) => request.scenarios.includes(s));
  const scenarios = uniqueScenarios.map((s) => computeScenario(s, req, rulesets));

  const missing = scenarios.flatMap((s) => s._missingRules || []);
  if (missing.length > 0) {
    return {
      ok: false,
      schema_version: request.schema_version,
      errors: [...new Set(missing)].map((ruleId) => err('rule_missing', null, { rule_id: ruleId })),
    };
  }
  scenarios.forEach((s) => delete s._missingRules);

  const assumptions = [];
  const applyAll = uniqueScenarios;
  if (request.profile.months_remaining_in_tax_year == null) {
    assumptions.push({ code: 'months_remaining_defaulted', params: { months: 12 }, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (!request.accounts.isa.exists) {
    assumptions.push({ code: 'isa_new_account_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (request.accounts.isa.exists && request.accounts.isa.years_since_opening == null) {
    assumptions.push({ code: 'isa_tenure_zero_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (request.accounts.isa.other_savings_contract_krw == null) {
    assumptions.push({ code: 'other_savings_zero_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  if (request.isa_transfer && request.isa_transfer.prior_year_applied_extra_credit_krw == null) {
    assumptions.push({ code: 'prior_transfer_credit_zero_assumed', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  }
  // 만 나이를 **어느 날짜 기준으로** 환산했는가. 규칙은 나이 세는 방법과 각 요건의
  // 판정 시점을 주지만 **단일 기준일은 주지 않는다** — 그래서 엔진이 과세기간
  // 종료일을 골랐다는 사실이 가정으로 나간다(계약 3.1절 · D21).
  //
  // `requires_reference_date_rule_ids`는 **걸리는 요건만** 드러낸다. 목록을 코드에
  // 적지 않고 룰셋에서 읽는다 — 연금 쪽은 날짜 대 날짜 비교라 안 걸리고, 그
  // 사실은 `pension_withdrawal_start`가 이미 날짜로 말하고 있다.
  const ageReckoningRule = findRule(rulesets, 'age.reckoning.reference_date', ['2026.json']).rule;
  const requiresReferenceDate = (ageReckoningRule.value?.no_single_reference_date?.per_rule ?? [])
    .filter((entry) => entry.needs_reference_date === true)
    .map((entry) => entry.rule_id);
  assumptions.push({
    code: 'age_reference_date_not_in_ruleset',
    params: {
      reference_date: referenceDateFor(request.tax_year),
      requires_reference_date_rule_ids: requiresReferenceDate,
    },
    applies_to_scenarios: applyAll,
    basis_rule_ids: [ageReckoningRule.id],
  });
  // **`prior_pension_credit_zero_assumed`가 여기 있었다**(D39에 폐기). 되더하기의
  // 가산항을 0으로 보던 가정인데, 되더할 입력 자체가 사라졌다.
  assumptions.push({
    code: 'local_tax_follows_income_tax_cap',
    params: {},
    applies_to_scenarios: applyAll,
    basis_rule_ids: ['pension.credit.tax_liability_cap', 'tax.local.personal_income_surtax'],
  });
  if (['annuity_savings', 'retirement_pension'].some((k) => request.accounts[k].has_deferred_retirement_income == null)) {
    assumptions.push({
      code: 'deferred_retirement_income_absent_assumed',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: ['pension.withdrawal.earliest_start'],
    });
  }
  const retirementTransferSum = ['annuity_savings', 'retirement_pension'].reduce(
    (sum, k) => sum + (request.accounts[k].retirement_transfer_in_krw ?? 0),
    0,
  );
  if (retirementTransferSum > 0) {
    assumptions.push({
      code: 'retirement_transfer_counted_in_contribution_limit',
      params: { amount_krw: retirementTransferSum },
      applies_to_scenarios: applyAll,
      basis_rule_ids: [],
    });
  }
  // **`basis_rule_ids`를 비워 두는 것도 주장이다** — 계약 4.3절이 빈 배열을 "룰셋
  // 근거가 없는 순수 표시 규칙"으로 정했다. 아래 셋은 실제로 표시 규칙이라 비어 있고,
  // 위의 것들은 근거가 있어 채워져 있다.
  assumptions.push({ code: 'single_tax_year_only', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  // 9.0.0부터 이 가정에 룰셋 근거가 붙는다 — 세액 한도를 총급여액에서 산출하는
  // 경로가 세지 않은 공제를 규칙이 `excluded_items`로 열거하고, 그것을 세지 않은
  // 결과가 어느 방향인지(과대)까지 같은 규칙이 적는다. 전에는 근거 없는 표시 규칙이었다.
  assumptions.push({
    code: 'other_deductions_excluded',
    params: {},
    applies_to_scenarios: applyAll,
    basis_rule_ids: ['pension.credit.tax_liability_cap.current_year_estimate'],
  });
  assumptions.push({ code: 'rounding_floor_to_won', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  // 5.1.0(D28, 계약 0.9절) — **가정을 보내면 이 진술이 거짓이 된다.** 그 계산에서는
  // ISA 효과가 실제로 금액으로 나가므로(`Plan.assumption_based_isa_estimate`), 선언과
  // 동작이 어긋나지 않게 가정을 보내지 않은 요청에서만 낸다.
  const isaReturnAssumptionSupplied = request.profile.isa_return_assumption != null;
  if (!isaReturnAssumptionSupplied) {
    assumptions.push({ code: 'isa_benefit_not_quantified', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: ['isa.tax_free_limit'] });
  }
  assumptions.push({ code: 'fund_use_horizon_excluded_from_amounts', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({
    code: 'early_exit_penalty_not_quantified',
    params: {},
    applies_to_scenarios: applyAll,
    basis_rule_ids: ['isa.early_termination.clawback', 'pension.early_withdrawal.other_income_rate'],
  });
  assumptions.push({
    code: 'pension_holding_period_not_evaluated',
    params: {},
    applies_to_scenarios: applyAll,
    basis_rule_ids: ['pension.withdrawal.eligibility'],
  });

  // echo.credit_rate_bracket은 확정 룰셋(2026.json) 기준으로 채운다 — 개정예고가
  // 있어도 echo는 요청 자체(해당 과세연도 소득)에서 결정되는 값이라 시나리오와 무관하다.
  const creditRateRule = findRule(rulesets, 'pension.credit.rate', ['2026.json']).rule;
  const creditRateBasisRule = findRule(rulesets, 'pension.credit.rate.basis_determination', ['2026.json']).rule;
  const surtaxRule = findRule(rulesets, 'tax.local.personal_income_surtax', ['2026.json']).rule;
  const creditRateBasis = resolveCreditRateBasisCode(request.profile);
  const bracket = selectCreditRateBracket(creditRateRule.value.brackets, creditRateBasis);
  const incomeTaxRate = bracket.rate;
  const localTaxRate = incomeTaxRate * surtaxRule.value.rate_of_income_tax;
  const creditRateFallbackApplied = creditRateBasis.code === CREDIT_RATE_BASIS.STATUTORY_DEFAULT;

  // 5.0.0(D27) — 1단계 질문을 "합산되는 소득이 있는가"로 좁혀 물으면 분리과세로
  // 종결된 소득만 더 있는 사람도 총급여 기준으로 온다. 그것이 두 해석 중 하나를
  // 채택하는 것이므로 조문이 정한 것처럼 표시하지 않고 가정으로 드러낸다(0.7절).
  if (request.profile.has_non_wage_global_income_current_year !== true) {
    assumptions.push({
      code: 'credit_rate_wage_only_excludes_separately_taxed_income',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: [creditRateBasisRule.id],
    });
  }

  // -- 수익률 가정 위의 계산이 서 있는 가정들 (5.1.0, D28의 선 ②·③) -----------
  // 가정을 받지 않았으면 이 계산 자체가 없으므로 한 건도 붙지 않는다.
  if (isaReturnAssumptionSupplied) {
    const isaReturnAssumption = request.profile.isa_return_assumption;
    // **이 서비스는 수익률을 제시하지 않는다.** 그 구분이 D31이 남긴 방어선 전부다.
    assumptions.push({
      code: 'isa_return_rate_user_supplied',
      params: { annual_return_rate: isaReturnAssumption.annual_return_rate },
      applies_to_scenarios: applyAll,
      basis_rule_ids: [],
    });
    // 복리·단리를 세법이 정하지 않는다. 혜택이 수익률에 단조 증가하므로 단리가 과소 방향이다.
    assumptions.push({
      code: 'isa_return_simple_interest',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: ['isa.benefit.settlement_period'],
    });
    // 원금을 잔액이 아니라 납입액으로 본다 — 이미 난 운용수익이 빠져 과소 방향이다.
    assumptions.push({
      code: 'isa_return_principal_from_contributions',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: ['isa.benefit.formula'],
    });
    if (isaReturnAssumption.settlement_years == null) {
      // 수익률에는 조문에 닻이 없어 기본값을 만들 수 없지만, 계약기간 하한은
      // 조문이 정한 값이다. 실제 계약기간이 더 길면 결과가 달라지므로 대체값을
      // 썼다는 사실이 나가야 한다.
      const accountReqRuleTop = findRule(rulesets, 'isa.account.requirements', ['2026.json']).rule;
      assumptions.push({
        code: 'isa_settlement_years_defaulted_to_min_contract_years',
        params: { settlement_years: accountReqRuleTop.value.min_contract_years },
        applies_to_scenarios: applyAll,
        basis_rule_ids: ['isa.account.requirements', 'isa.benefit.settlement_period'],
      });
    }
    if (isaReturnAssumption.loss_amount_krw == null) {
      // `L`을 지어내면 과대가 된다. 0으로 두면 손익통산 축이 0이 되어 과소 방향이다.
      assumptions.push({
        code: 'isa_loss_assumed_zero',
        params: {},
        applies_to_scenarios: applyAll,
        basis_rule_ids: ['isa.benefit.formula', 'isa.net_income.loss_offset'],
      });
    }
    // 비교 기준을 14% 원천징수 종결(case A)로 둔다. 금융소득종합과세 대상이면
    // 실제 혜택이 더 크므로 이 값은 하한이다 — 서비스의 편의가 아니라 조문에서
    // 나오는 귀결이다.
    assumptions.push({
      code: 'isa_comparison_baseline_is_withholding_only',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: ['isa.benefit.formula', 'isa.benefit.quantification'],
    });
    // 정산 시점까지 계약을 유지하는 것을 전제한다. 중도해지 추징은 미래의 선택이고
    // 요청에 그 입력이 없으므로, 선언한 자금 사용 시점에서 추론하지 않는다.
    assumptions.push({
      code: 'isa_return_assumes_contract_held_to_settlement',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: ['isa.early_termination.clawback'],
    });
  }

  return {
    ok: true,
    schema_version: request.schema_version,
    echo: {
      tax_year: request.tax_year,
      monthly_capacity_krw: request.profile.monthly_capacity_krw,
      months_remaining_in_tax_year: months,
      annual_budget_krw: request.profile.monthly_capacity_krw * months,
      fund_use_horizon: request.profile.fund_use_horizon,
      fund_use_horizon_affects: {
        allocation_amounts: false,
        tax_credit_amounts: false,
        limits: false,
        plan_ordering: true,
        baseline_selection: true,
        warnings: true,
      },
      credit_rate_bracket: {
        income_tax_rate: incomeTaxRate,
        local_tax_rate: localTaxRate,
        effective_rate: incomeTaxRate + localTaxRate,
        basis_code: creditRateBasis.code,
        // statutory_default면 지어낸 금액을 되돌려주지 않는다 — null이다.
        measured_amount_krw: creditRateBasis.amount,
        fallback_applied: creditRateFallbackApplied,
        // 우대 구간을 적용하지 않은 것이므로 결과는 과소이거나 같다.
        fallback_direction_code: creditRateFallbackApplied ? 'understated_or_equal' : null,
        basis_rule_ids: [creditRateRule.id, creditRateBasisRule.id, surtaxRule.id].sort(),
      },
      // **화면은 이 나이를 사용자에게 되비추지 않는다**(designer가 박은 프라이버시 못).
      // `reference_date_from_ruleset`은 항상 false다 — 기준일 규칙이 룰셋에 없다는
      // 사실을 값으로 낸다.
      derived_age: {
        age_years: ageAtReferenceDate(parseIsoDate(request.profile.birth_date), referenceDateFor(request.tax_year)),
        reference_date: referenceDateFor(request.tax_year),
        reference_date_from_ruleset: false,
      },
      // 5.1.0(D28) — 사용자가 준 가정을 **그대로** 되돌린다. 실제로 적용된 정산
      // 기간은 여기가 아니라 `Plan.assumption_based_isa_estimate.settlement_years`에
      // 있다 — "무엇을 주었는가"와 "무엇을 썼는가"를 한 칸에 뭉치지 않는다.
      isa_return_assumption: isaReturnAssumptionSupplied
        ? {
            annual_return_rate: request.profile.isa_return_assumption.annual_return_rate,
            income_character: request.profile.isa_return_assumption.income_character,
            settlement_years: request.profile.isa_return_assumption.settlement_years ?? null,
            loss_amount_krw: request.profile.isa_return_assumption.loss_amount_krw ?? null,
          }
        : null,
      // **네 값이 전부 `false`인 고정 객체다.** D28이 그은 선 ①(확정 세액공제와
      // 가정 기반 추정치를 한 목적함수에 더하지 않는다)을 규약이 아니라 자료형과
      // 회귀 테스트로 강제한다(계약 4.2절).
      isa_return_affects: {
        allocation_amounts: false,
        tax_credit_amounts: false,
        plan_ordering: false,
        warnings: false,
      },
      // 세액 한도가 무엇을 바꾸고 무엇을 바꾸지 않는지 — 값이 고정이라 `qa`가
      // 실제 동작과 대조할 수 있다(계약 4.2절).
      tax_liability_cap_affects: {
        allocation_amounts: false,
        tax_credit_amounts: true,
        limits: false,
        plan_ordering: false,
        baseline_selection: false,
        warnings: false,
      },
    },
    scenarios,
    assumptions,
  };
}

export function computeFundUseHorizonBoundaries(request, rulesets) {
  const errors = [];
  if (request?.schema_version == null) errors.push(err('missing_required', 'schema_version', {}));
  else if (String(request.schema_version).split('.')[0] !== KNOWN_SCHEMA_MAJOR)
    errors.push(err('schema_version_mismatch', 'schema_version', {}));
  if (request?.tax_year == null) errors.push(err('missing_required', 'tax_year', {}));
  // compute와 같은 이유로 만 나이가 아니라 생년월일을 받는다(계약 9.1절 · D21).
  if (request?.birth_date == null) errors.push(err('missing_required', 'birth_date', {}));
  else if (parseIsoDate(request.birth_date) === null) errors.push(err('invalid_date', 'birth_date', { format: 'YYYY-MM-DD' }));
  if (request?.isa_exists == null) errors.push(err('missing_required', 'isa_exists', {}));
  if (request?.isa_years_since_opening != null && !isInt(request.isa_years_since_opening)) {
    errors.push(err('not_integer', 'isa_years_since_opening', {}));
  }
  if (request?.scenario != null && !SCENARIO_ORDER.includes(request.scenario)) {
    errors.push(err('unknown_scenario', 'scenario', {}));
  }

  if (errors.length > 0) return { ok: false, schema_version: request?.schema_version ?? MOCK_SCHEMA_VERSION, errors };

  const scenario = request.scenario ?? 'current';
  const files = fileKeysForScenario(scenario).filter((k) => rulesets[k]);
  // 만 나이 환산은 `compute`와 **같은 내부 함수**가 한다(계약 9.1절).
  const result = computeBoundariesInternal(
    {
      age_years: ageAtReferenceDate(parseIsoDate(request.birth_date), referenceDateFor(request.tax_year)),
      isa_exists: request.isa_exists,
      isa_years_since_opening: request.isa_years_since_opening,
    },
    rulesets,
    files,
  );

  return {
    ok: true,
    schema_version: request.schema_version,
    boundaries: result.boundaries,
    legal_basis: result.legal_basis,
    notices: result.notices,
  };
}
