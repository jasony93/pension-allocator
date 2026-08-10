/**
 * 엔진 목(mock) — `docs/stage-2-design/engine-interface.md` (schema_version 6.0.0)의
 * `compute` / `computeFundUseHorizonBoundaries` 계약을 그대로 구현한다.
 *
 * **왜 아직 있는가.** 실행 경로는 이미 실제 엔진(`src/engine/`)이다(`engine-client.js`).
 * 이 파일은 계약을 화면 쪽에서 어떻게 읽었는지를 남긴 대조 기준이고, **계약이
 * major로 오를 때 함께 오르지 않으면 그 순간 거짓말이 된다** — 목이 낡으면
 * 테스트가 통과해도 아무것도 증명하지 않는다. 그래서 `6.0.0`으로 맞췄다.
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
const KNOWN_SCHEMA_MAJOR = '6';
export const MOCK_SCHEMA_VERSION = '6.0.0';
const ANNUITY_START_VALUES = ['not_started', 'started', 'unknown'];
const PRIOR_TAX_STATES = ['amount', 'zero', 'nonzero_amount_unknown', 'unknown'];
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

function findRule(rulesets, ruleId, fileKeys) {
  for (const key of fileKeys) {
    const file = rulesets[key];
    if (!file || !Array.isArray(file.rules)) continue;
    const rule = file.rules.find((r) => r.id === ruleId);
    if (rule) return { rule, fileKey: key };
  }
  return null;
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
  if (upper === null || lower === null) {
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

  errors.push(...validatePriorYearTax(p.prior_year_tax));

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

/**
 * 계약 3.5절 `PriorYearTax` — 세액 한도의 재료. **결정세액과 연금계좌 세액공제액을
 * 짝으로 받는다.** 짝이라는 사실을 규약이 아니라 자료형이 강제한다.
 */
function validatePriorYearTax(node) {
  const errors = [];
  const field = 'profile.prior_year_tax';
  if (node == null || typeof node !== 'object') {
    errors.push(err('missing_required', field, {}));
    return errors;
  }
  if (node.state == null) errors.push(err('missing_required', `${field}.state`, {}));
  else if (!PRIOR_TAX_STATES.includes(node.state)) errors.push(err('invalid_enum', `${field}.state`, { value: node.state }));

  if (node.state === 'amount') {
    if (node.determined_tax_krw == null) errors.push(err('missing_required', `${field}.determined_tax_krw`, {}));
    else if (!isInt(node.determined_tax_krw)) errors.push(err('not_integer', `${field}.determined_tax_krw`, {}));
    else if (node.determined_tax_krw < 0) errors.push(err('negative_value', `${field}.determined_tax_krw`, {}));
  } else if (node.determined_tax_krw != null) {
    // 금액을 실었는데 state가 금액을 뜻하지 않는다. 둘 중 무엇이 사용자의 답인지
    // 엔진이 고르면 그것이 추론이다. 고르지 않고 되돌려준다.
    errors.push(err('invalid_enum', `${field}.state`, { reason: 'determined_tax_krw_present' }));
  }

  if (node.pension_credit_applied_krw != null) {
    if (!isInt(node.pension_credit_applied_krw)) errors.push(err('not_integer', `${field}.pension_credit_applied_krw`, {}));
    else if (node.pension_credit_applied_krw < 0) errors.push(err('negative_value', `${field}.pension_credit_applied_krw`, {}));
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
    const status = accounts[account].annuity_start_status;
    if (status === 'started') {
      pensionEligibility[account] = { eligible: false, code: 'pension_contribution_blocked_annuity_started' };
      notices.push({
        code: 'pension_contribution_blocked_annuity_started',
        severity: 'warning',
        field: `accounts.${account}.annuity_start_status`,
        params: { account },
        basis_rule_ids: annuityStartRule ? [annuityStartRule.id] : [],
      });
    } else if (status === 'unknown') {
      pensionEligibility[account] = { eligible: false, code: 'pension_annuity_start_unknown' };
      notices.push({
        code: 'pension_annuity_start_unknown',
        severity: 'warning',
        field: `accounts.${account}.annuity_start_status`,
        params: { account },
        basis_rule_ids: [],
      });
    } else {
      pensionEligibility[account] = { eligible: true, code: null };
    }
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
    ...PENSION_ACCOUNTS.map((account) => ({
      account,
      eligible: pensionEligibility[account].eligible,
      reason_codes: pensionEligibility[account].code ? [pensionEligibility[account].code] : [],
      basis_rule_ids:
        pensionEligibility[account].code === 'pension_contribution_blocked_annuity_started' && annuityStartRule
          ? [annuityStartRule.id]
          : [],
    })),
    {
      account: 'isa',
      eligible: isaEligible,
      reason_codes: isaReasonCodes,
      basis_rule_ids: isaEligibilityRule ? [isaEligibilityRule.id] : [],
    },
  ];
  notices.push({ code: 'pension_age_not_evaluated', severity: 'info', field: null, params: {}, basis_rule_ids: [] });

  // -- ISA 비과세 한도 --------------------------------------------------
  const isaTaxFreeRule = use('isa.tax_free_limit', 'scenarios[].limits.by_account[isa].tax_free_limit_krw');
  let taxFreeLimit = null;
  if (accounts.isa.exists && accounts.isa.account_type != null && isaTaxFreeRule) {
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
  } else if (accounts.isa.exists && accounts.isa.account_type == null) {
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
    // 연금계좌 칸이 비어 있는 것을 "효과가 없다"로 읽지 않게 하는 근거(D28 18.5절).
    use('pension.tax_deferral.with_return_rate', 'notices[pension_tax_deferral_not_quantified]');

    if (quantRule && isaExcessRule && accountReqRuleForReturn && incomeCharacterRule && formulaRule && settlementPeriodRule && lossOffsetRule) {
      const generalRate = readGeneralWithholdingRate(quantRule);
      const isaRate = isaExcessRule.value.rate;
      const minContractYears = accountReqRuleForReturn.value.min_contract_years;
      const options = incomeCharacterRule.value?.what_to_ask_instead?.options ?? [];
      const option = options.find((item) => item?.id === isaReturnAssumptionInput.income_character);
      const share = parseTaxableShareRange(option?.s_range);

      if (generalRate !== undefined && isaRate != null && minContractYears != null && share !== null) {
        const settlementFromUser = isaReturnAssumptionInput.settlement_years != null;
        isaReturnContext = {
          supplied: true,
          assumption: isaReturnAssumptionInput,
          share,
          generalRate,
          isaRate,
          settlementYears: settlementFromUser ? isaReturnAssumptionInput.settlement_years : minContractYears,
          settlementSource: settlementFromUser ? 'user' : 'ruleset_min_contract_years',
          basisRuleIds: [
            accountReqRuleForReturn.id,
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

  // -- 세액 한도 (계약 3.5·5.10절) ------------------------------------------
  //
  // **한도 = 결정세액 + 연금계좌 세액공제액.** 소득세법 §61 ③이 산출세액이 모자랄
  // 때 밀려나는 공제로 연금계좌세액공제를 이름으로 지목하므로, 되더한 값이 곧
  // 법정 한도와 **일치한다.** 근사가 아니라 등식이다.
  //
  // 모를 때 **지어내지 않는다.** 대신 오차의 방향을 낸다 — 한도가 공제액을 늘리는
  // 경로가 조문에 없으므로 한도를 무시한 값은 언제나 과대이거나 같다.
  const capRule = use('pension.credit.tax_liability_cap', 'scenarios[].pension_credit_tax_liability_cap');
  const capSourceRule = use('pension.credit.tax_liability_cap.source_form', 'scenarios[].pension_credit_tax_liability_cap');
  const capBasisRuleIds = [capRule?.id, capSourceRule?.id].filter(Boolean);
  const priorTax = profile.prior_year_tax;
  const priorPensionCredit = priorTax.pension_credit_applied_krw ?? 0;
  let capKnown = false;
  let capKrw = null;
  let capSourceCode = null;
  if (priorTax.state === 'amount') {
    capKnown = true;
    capKrw = priorTax.determined_tax_krw + priorPensionCredit;
    capSourceCode = 'determined_tax_add_back';
  } else if (priorTax.state === 'zero') {
    capKnown = true;
    capKrw = priorPensionCredit;
    capSourceCode = 'declared_zero';
  }
  const capDeclaredNonzero = priorTax.state === 'nonzero_amount_unknown' || (capKnown && capKrw > 0);
  const capErrorDirection = capKnown ? null : 'overstated_or_equal';

  if (!capKnown) {
    notices.push({
      code: 'tax_liability_cap_unknown',
      severity: 'warning',
      field: 'profile.prior_year_tax',
      params: { error_direction: capErrorDirection, declared_nonzero: capDeclaredNonzero },
      basis_rule_ids: capBasisRuleIds,
    });
  } else if (capKrw === 0) {
    // **오류가 아니라 결과다** — 이 사용자에게는 0이 정확한 답이다.
    notices.push({ code: 'tax_liability_cap_zero', severity: 'info', field: null, params: {}, basis_rule_ids: capBasisRuleIds });
  }

  const carryoverRule = use('pension.credit.unused.contribution_carryover');
  const creditCarryforward = capRule?.value?.credit_carryforward ?? false;

  const plans = rawPlans.map((p) => {
    const creditEligible = creditFor(p.allocByAccount.annuity_savings, p.allocByAccount.retirement_pension);
    const incomeTaxBeforeCapKrw = Math.floor(creditEligible * incomeTaxRate);
    const localTaxBeforeCapKrw = Math.floor(creditEligible * localTaxRate);
    // 한도는 **소득세분에** 걸린다. 지방소득세분은 **인정된 소득세분에** 부가율을
    // 다시 적용해 낸다 — 인정되지 않은 공제에 붙는 지방세를 남기지 않기 위해서다
    // (`local_tax_follows_income_tax_cap` 가정).
    const incomeTaxKrw = capKnown ? Math.min(incomeTaxBeforeCapKrw, capKrw) : incomeTaxBeforeCapKrw;
    const localTaxKrw =
      incomeTaxBeforeCapKrw > 0 ? Math.floor((localTaxBeforeCapKrw * incomeTaxKrw) / incomeTaxBeforeCapKrw) : 0;
    const totalCreditKrw = incomeTaxKrw + localTaxKrw;
    const totalBeforeCapKrw = incomeTaxBeforeCapKrw + localTaxBeforeCapKrw;
    const capApplied = capKnown && incomeTaxKrw < incomeTaxBeforeCapKrw;
    const planCap = {
      known: capKnown,
      cap_krw: capKrw,
      applied: capApplied,
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
      basis_rule_ids: capApplied && carryoverRule ? [...capBasisRuleIds, carryoverRule.id] : capBasisRuleIds,
    };

    const allocations = ACCOUNTS.map((account) => {
      const annualKrw = p.allocByAccount[account] ?? 0;
      const monthlyKrw = months > 0 ? Math.floor(annualKrw / months) : 0;
      return {
        account,
        monthly_krw: monthlyKrw,
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
    const residual = months > 0 ? totalAnnual - totalMonthly * months : 0;

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
    warnings.sort((a, b) => (ACCOUNTS.indexOf(a.account) - ACCOUNTS.indexOf(b.account)) || a.code.localeCompare(b.code));

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
    const pensionOpen = pensionEligibility.annuity_savings.eligible || pensionEligibility.retirement_pension.eligible;
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
      unallocated_monthly_krw: months > 0 ? Math.floor(p.unallocated / months) : 0,
      unallocated_annual_krw: p.unallocated,
      unallocated_breakdown: unallocatedBreakdown,
      // **배분 후** 남는 연금계좌 합산 세액공제 대상 한도. 배분 전 값
      // (`limits.pension_combined_credit_remaining_krw`)과는 다르다(5.13.1절) —
      // 화면이 뺄셈으로 만들지 않도록 여기서 낸다.
      pension_combined_credit_remaining_after_plan_krw: Math.max(0, baseCombinedCreditCap + extraCreditLimit - creditEligible),
      monthly_rounding_residual_krw: residual,
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
        basis_rule_ids: [creditRateRule?.id, creditRateBasisRule?.id, annuityCreditLimitRule?.id, combinedCreditLimitRule?.id, surtaxRule?.id, capRule?.id].filter(Boolean),
      },
      delta_vs_baseline_krw: 0, // baseline 선정 후 채운다
      non_quantified_effects: nonQuantified,
      // 5.1.0(D28·D29·D31) — **`DeterministicBenefit`과 같은 축에 놓거나 더하지
      // 않는다.** 원금이 이 안의 ISA 배분액을 포함하므로 안마다 값이 다를 수
      // 있다(계약 5.14절). 가정을 보내지 않았으면 `null`이다.
      assumption_based_isa_estimate: isaEstimateFor({
        context: isaReturnContext,
        display: isaEstimateDisplay,
        taxFreeLimitKrw: taxFreeLimit,
        principalKrw: accounts.isa.cumulative_contribution_krw + (p.allocByAccount.isa ?? 0),
        surtaxRate: localRateOfIncomeTax,
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
      // 주는 계산이 되어 최대 1.75배 과대다(`isa.benefit.settlement_period`).
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
      return so !== 0 ? so : a.rule_id.localeCompare(b.rule_id);
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
    // 세액 한도와 **그것을 어떻게 알았는지.** 두 시나리오에서 같은 값이다 —
    // 한도는 개정예고 규칙의 대상이 아니다(계약 5.10절).
    pension_credit_tax_liability_cap: {
      known: capKnown,
      // **`0`은 유효한 값이고 `null`(모름)과 다르다.**
      cap_krw: capKrw,
      determined_tax_krw: priorTax.state === 'amount' ? priorTax.determined_tax_krw : null,
      prior_pension_credit_krw: capKnown ? priorPensionCredit : null,
      source_code: capSourceCode,
      declared_nonzero: capDeclaredNonzero,
      error_direction_code: capErrorDirection,
      credit_carryforward: creditCarryforward,
      basis_rule_ids: capBasisRuleIds,
    },
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
  if (request.profile.prior_year_tax.pension_credit_applied_krw == null) {
    assumptions.push({
      code: 'prior_pension_credit_zero_assumed',
      params: {},
      applies_to_scenarios: applyAll,
      basis_rule_ids: ['pension.credit.tax_liability_cap.source_form'],
    });
  }
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
  // 근거가 없는 순수 표시 규칙"으로 정했다. 아래 넷은 실제로 표시 규칙이라 비어 있고,
  // 위의 것들은 근거가 있어 채워져 있다.
  assumptions.push({ code: 'single_tax_year_only', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
  assumptions.push({ code: 'other_deductions_excluded', params: {}, applies_to_scenarios: applyAll, basis_rule_ids: [] });
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
