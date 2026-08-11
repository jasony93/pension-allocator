// 소유자가 직접 만든 케이스 표와의 대조 (D43 2번).
//
// **이 파일의 기대값은 우리 엔진에서 나온 것이 아니다.** `data/test-set/절세계좌_케이스별_배분표.xlsx`의
// 시트 1(배분표)·2(판단근거_상세)·3(제도_기준값)·4(검증)에서 옮겨 적었고, 소유자가 만들고
// 소유자가 확인한 값이다. **그래서 골든 케이스와 성질이 다르다** — 골든 케이스는 우리가 조문에서
// 뽑은 것이라 우리가 조문을 잘못 읽으면 정답지도 함께 틀리지만, 이 표는 바깥에서 왔으므로 그
// 눈먼 자리를 비춘다.
//
// **어긋남을 자동으로 맞추지 않는다.** D43이 세 갈래를 정했고 각 케이스가 자기 갈래를 값으로
// 들고 있다(`VERDICT`). 갈래가 `DIVERGES_*`인 케이스는 **엔진의 어느 배분안도 표와 같지 않다는
// 것**을 어서션으로 잠근다 — 나중에 누군가 엔진을 바꿔 우연히 표와 같아지면 이 시험이 실패하고,
// 그때 사람이 갈래 판정을 다시 읽게 된다. **일치를 잠그는 것만큼 불일치를 잠그는 것이 중요하다.**
//
// **소유자가 받아 준 축소 하나** — 기타 계좌(노란우산·주택청약저축·청년도약계좌·해외주식
// 일반계좌·일반 위탁계좌)를 전부 **일반계좌 한 갈래**로 본다. 우리 엔진에서 그 자리는
// `unallocated_annual_krw`다. 그러므로 표의 「기타」와 엔진의 「미배분」을 같은 칸으로 놓는다.
//
// **표가 모델링하고 우리가 모델링하지 않는 것**(D43 셋째 갈래) — 노란우산 소득공제, 주택청약
// 종합저축 소득공제, 청년도약계좌 정부기여금, 해외주식 양도소득 기본공제, 증여재산공제,
// IRP 가입자격(근로자퇴직급여보장법), 이미 수령 중인 연금액의 종합과세 한도 잠식. **룰셋에
// 규칙이 없으면 없는 것이므로 「틀렸다」가 아니라 「우리 축이 아니다」다.**

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  loadRulesets,
  baseRequest,
  birthDateForAge,
  scenarioOf,
  planOf,
  allocationOf,
  noticeCodes,
  CONFIRMED_FILE,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

function rule(id) {
  const found = rulesets[CONFIRMED_FILE].rules.find((r) => r.id === id);
  if (!found) throw new Error(`룰셋에 규칙이 없다: ${id}`);
  return found;
}

/** 표의 단위(만원)를 원으로 옮기는 배율. 세법 수치가 아니라 표기 단위다. */
const MAN = 10_000;

/** 개월수. 세법 수치가 아니라 과세기간의 달 수다. */
const MONTHS = 12;

/**
 * 계좌별 비교에 허용하는 오차. **세법에서 온 값이 아니다.**
 *
 * 표는 연 단위 만원으로 적혀 있고 요청은 **월 납입 여력**을 받는다. 연 여력이 12로 나누어
 * 떨어지지 않는 케이스(2,000만·1,000만·4,000만·5,000만)에서 `floor`가 최대 11원을 깎으므로
 * 그만큼은 어긋난 것이 아니다. 12원 이상 벌어지면 실제 차이다.
 */
const MONTH_TRUNCATION_KRW = MONTHS - 1;

const VERDICT = {
  /** 엔진의 **기본안**이 표와 같다. */
  MATCH_BASELINE: 'match_baseline',
  /** 표의 배분이 엔진의 배분안 중 하나로 나오지만 **기본안은 아니다.** */
  MATCH_OTHER_PLAN: 'match_other_plan',
  /** 표가 우리가 모델링하지 않는 계좌·제도를 쓴다 (D43 셋째 갈래). */
  DIVERGES_OUT_OF_SCOPE: 'diverges_out_of_scope',
  /** 세법이 정하지 않는 것을 엔진이 결론으로 내지 않기로 한 자리 (계약 5.12절·D10). */
  DIVERGES_BY_DESIGN: 'diverges_by_design',
};

/**
 * 시트 1의 14행. `owner`는 **표에 적힌 배분**이고 `other`는 「기타」 열이다.
 *
 * `horizon`은 「자금계획」 열을 계약 3.1절의 네 값으로 옮긴 것이다. **이 값은 금액을 바꾸지
 * 않는다**(계약이 그것을 보장한다) — 기본안이 무엇이 되는지와 경고만 바꾼다. 그래서 아래
 * 어서션은 기본안뿐 아니라 **네 배분안 전부**를 본다.
 */
const CASES = [
  {
    n: 1,
    name: '사회초년생 표준형',
    age: 30,
    salaryMan: 4000,
    capacityMan: 2000,
    horizon: 'unknown',
    owner: { annuity: 600, pension: 300, isa: 1100, other: 0 },
    verdict: VERDICT.MATCH_BASELINE,
  },
  {
    n: 2,
    name: '초단기 목돈 (2년)',
    age: 35,
    salaryMan: 6000,
    capacityMan: 3000,
    horizon: 'within_isa_lock_in',
    owner: { annuity: 300, pension: 0, isa: 0, other: 2700 },
    // 표는 2년 뒤 쓸 돈이라는 이유로 계좌를 **비운다.** 우리 엔진은 자금 사용 시점으로 금액을
    // 바꾸지 않고 **경고만** 낸다(D10, 계약 3.1절의 보장). 세법이 정하는 것은 중도해지 시의
    // 과세이지 「넣지 마라」가 아니다.
    verdict: VERDICT.DIVERGES_BY_DESIGN,
  },
  {
    n: 3,
    name: '은퇴 임박 러시',
    age: 45,
    salaryMan: 6000,
    capacityMan: 3000,
    horizon: 'before_pension_age',
    owner: { annuity: 1500, pension: 300, isa: 1200, other: 0 },
    // 표의 배분이 `pension_contribution_before_isa`와 정확히 같다. 그 안은 **결코 기본안이
    // 되지 않는다**(계약 6.1절 — 소유자가 정한 순서가 ISA 먼저다).
    verdict: VERDICT.MATCH_OTHER_PLAN,
  },
  {
    n: 4,
    name: '결정세액 부족',
    age: 28,
    salaryMan: 2500,
    capacityMan: 1000,
    horizon: 'unknown',
    owner: { annuity: 200, pension: 0, isa: 800, other: 0 },
    // 축이 둘 겹친다 — (가) 세액 한도의 값이 다르고(아래 별도 시험), (나) 한도가 배분을
    // 줄이지 않는다는 계약 5.12절의 판정이다.
    verdict: VERDICT.DIVERGES_BY_DESIGN,
  },
  {
    n: 5,
    name: '이미 사적연금 수령 중',
    age: 60,
    salaryMan: 10000,
    capacityMan: 5000,
    horizon: 'unknown',
    annuityStarted: true,
    owner: { annuity: 0, pension: 0, isa: 2000, other: 3000 },
    verdict: VERDICT.MATCH_BASELINE,
  },
  {
    n: 6,
    name: 'ISA 가입 불가',
    age: 45,
    salaryMan: 8000,
    capacityMan: 4000,
    horizon: 'unknown',
    financialIncomeTaxpayer: true,
    owner: { annuity: 1500, pension: 300, isa: 0, other: 2200 },
    verdict: VERDICT.MATCH_BASELINE,
  },
  {
    n: 7,
    name: '소득 없는 배우자',
    age: 35,
    salaryMan: 0,
    capacityMan: 1500,
    horizon: 'unknown',
    owner: { annuity: 0, pension: 0, isa: 1500, other: 0 },
    // 표는 두 근거로 연금계좌를 비운다 — IRP 가입자격(근퇴법, **룰셋에 없다**)과 결정세액 0.
    // 뒤엣것에 대한 엔진의 처리는 계약 5.12절이 정한다. 표의 배분은 `isa_first`로 나온다.
    verdict: VERDICT.MATCH_OTHER_PLAN,
  },
  {
    n: 8,
    name: '프리랜서·자영업',
    age: 38,
    incomeKind: 'business',
    salaryMan: 0,
    globalIncomeMan: 8000,
    capacityMan: 3000,
    horizon: 'unknown',
    owner: { annuity: 600, pension: 300, isa: 1700, other: 400 },
    // **갈래가 둘 섞였다. 셋째 갈래로 밀지 않는다.**
    // (가) 「기타 400만」이 노란우산공제(조특법 §86의3)다 — 우리 룰셋에 그 규칙이 없다.
    // (나) 남는 100만을 엔진은 **연금저축의 공제 없는 납입**으로 보낸다(D32 — 네 안이 전부
    //     납입 한도까지 채운다). 그것은 범위 밖이 아니라 설계 판정이다.
    verdict: VERDICT.DIVERGES_OUT_OF_SCOPE,
  },
  {
    n: 9,
    name: '무주택 청약 대기',
    age: 32,
    salaryMan: 5000,
    capacityMan: 1500,
    horizon: 'unknown',
    owner: { annuity: 600, pension: 0, isa: 600, other: 300 },
    // 「기타 300만」이 주택청약종합저축(조특법 §87)이다. 시트 4가 스스로 「IRP 0은 조건부」라
    // 적었고 그 대안이 엔진의 기본안과 같다(아래 별도 시험이 49.5만을 확인한다).
    verdict: VERDICT.DIVERGES_OUT_OF_SCOPE,
  },
  {
    n: 10,
    name: '해외주식 직접투자',
    age: 33,
    salaryMan: 7000,
    capacityMan: 3000,
    horizon: 'unknown',
    owner: { annuity: 600, pension: 300, isa: 1000, other: 1100 },
    // **갈래가 둘 섞였다.** (가) 「기타 1,100만」이 해외주식 일반계좌이고 연 250만원 양도소득
    // 기본공제는 우리 룰셋에 없다. (나) 케이스 8과 같은 100만(공제 없는 연금 납입)이 여기도 있다.
    verdict: VERDICT.DIVERGES_OUT_OF_SCOPE,
  },
  {
    n: 11,
    name: '미성년 자녀 명의',
    age: 10,
    salaryMan: 0,
    capacityMan: 2000,
    horizon: 'at_or_after_pension_age',
    owner: { annuity: 0, pension: 0, isa: 0, other: 2000 },
    // ISA 쪽은 엔진도 같은 결론을 낸다(연령 배제). 연금계좌 쪽은 갈린다 — 룰셋에 연금계좌
    // **가입** 연령 규칙이 없고, 한도 0이 배분을 줄이지도 않는다(계약 5.12절).
    verdict: VERDICT.DIVERGES_BY_DESIGN,
  },
  {
    n: 12,
    name: '공제율 경계선',
    age: 34,
    salaryMan: 5400,
    capacityMan: 2000,
    horizon: 'unknown',
    owner: { annuity: 600, pension: 300, isa: 1100, other: 0 },
    verdict: VERDICT.MATCH_BASELINE,
  },
  {
    n: 13,
    name: '육아휴직 연도',
    age: 32,
    salaryMan: 0,
    capacityMan: 2000,
    horizon: 'unknown',
    owner: { annuity: 0, pension: 0, isa: 2000, other: 0 },
    verdict: VERDICT.MATCH_OTHER_PLAN,
  },
  {
    n: 14,
    name: '퇴직금 수령 예정',
    age: 55,
    salaryMan: 8000,
    capacityMan: 3000,
    horizon: 'unknown',
    owner: { annuity: 600, pension: 300, isa: 2000, other: 100 },
    // **갈래 판정에 확신이 가장 낮은 케이스다.** 시트가 「기타 100만」을 일반계좌로 둔 이유는
    // 퇴직금 유입이 **연금소득 1,500만 종합과세 한도**를 압박한다는 것인데, 그 축은 우리 룰셋에
    // 규칙은 있어도(`pension.income.separate_taxation.threshold`) **배분 제약으로 쓰는 입력이
    // 없다**(이미 수령 중인 연금액을 묻지 않는다). 그러므로 「범위 밖」과 「설계 판정」의 어느
    // 쪽으로도 단정하지 않는다 — 관리자에게 그대로 올린다.
    verdict: VERDICT.DIVERGES_OUT_OF_SCOPE,
  },
];

/**
 * 케이스를 요청으로 옮긴다.
 *
 * **ISA는 언제나 신규(가입 0년차)로 둔다.** 표가 ISA를 연 2,000만원 위로 올린 적이 없으므로
 * 표는 미납분 이월이 없는 상태를 전제한다. 가입 연차를 넣으면 엔진의 연 한도가 이월분만큼
 * 커져 **표가 재려던 것과 다른 것을 재게 된다.**
 *
 * **직전 과세기간 총급여액은 보내지 않는다.** 표에 그 칸이 없다. 엔진은 ISA 유형 교차확인을
 * 건너뛰고 그 사실을 notice로 낸다 — 없는 값을 지어내지 않는 쪽이다.
 */
function requestFor(testCase) {
  const isBusiness = testCase.incomeKind === 'business';
  return baseRequest({
    profile: {
      birth_date: birthDateForAge(testCase.age),
      current_year_total_salary_krw: testCase.salaryMan * MAN,
      has_non_wage_global_income_current_year: isBusiness,
      current_year_global_income_krw: isBusiness ? testCase.globalIncomeMan * MAN : null,
      prior_year_total_salary_krw: null,
      financial_income_taxpayer_last_3_years: testCase.financialIncomeTaxpayer === true,
      declared_youth: null,
      fund_use_horizon: testCase.horizon,
      monthly_capacity_krw: Math.floor((testCase.capacityMan * MAN) / MONTHS),
      months_remaining_in_tax_year: MONTHS,
    },
    accounts: {
      annuity_savings: {
        ytd_contribution_krw: 0,
        annuity_start_status: testCase.annuityStarted ? 'started' : 'not_started',
      },
      retirement_pension: {
        ytd_contribution_krw: 0,
        annuity_start_status: testCase.annuityStarted ? 'started' : 'not_started',
      },
      isa: {
        exists: false,
        account_type: 'general',
        cumulative_contribution_krw: 0,
        ytd_contribution_krw: 0,
        years_since_opening: 0,
        other_savings_contract_krw: 0,
      },
    },
    isa_transfer: null,
    options: null,
  });
}

/** 표의 네 칸과 같은 모양으로 배분안을 편다. 「기타」 자리는 미배분이다. */
function vectorOf(plan) {
  return {
    annuity: allocationOf(plan, 'annuity_savings').annual_krw,
    pension: allocationOf(plan, 'retirement_pension').annual_krw,
    isa: allocationOf(plan, 'isa').annual_krw,
    other: plan.unallocated_annual_krw,
  };
}

function ownerVectorOf(testCase) {
  return {
    annuity: testCase.owner.annuity * MAN,
    pension: testCase.owner.pension * MAN,
    isa: testCase.owner.isa * MAN,
    other: testCase.owner.other * MAN,
  };
}

/** 월 환산 절사(최대 11원)만큼은 어긋난 것이 아니다. 그 위는 실제 차이다. */
function sameVector(actual, expected) {
  return ['annuity', 'pension', 'isa', 'other'].every(
    (key) => Math.abs(actual[key] - expected[key]) <= MONTH_TRUNCATION_KRW,
  );
}

function describe(vector) {
  return ['annuity', 'pension', 'isa', 'other']
    .map((key) => `${key}=${(vector[key] / MAN).toFixed(2)}만`)
    .join(' ');
}

// ── 케이스별 대조 ────────────────────────────────────────────────

for (const testCase of CASES) {
  test(`소유자 표 / 케이스 ${testCase.n} — ${testCase.name} (${testCase.verdict})`, () => {
    const response = compute(requestFor(testCase), rulesets);
    assert.equal(response.ok, true, `계산이 실패했다: ${JSON.stringify(response.errors)}`);

    const scenario = scenarioOf(response);
    const expected = ownerVectorOf(testCase);
    const baseline = scenario.plans.find((plan) => plan.is_baseline);
    assert.ok(baseline !== undefined, '기본안이 없다');

    const matching = scenario.plans.filter((plan) => sameVector(vectorOf(plan), expected));
    const report =
      `표: ${describe(expected)}\n` +
      scenario.plans
        .map((plan) => `  ${plan.is_baseline ? '*' : ' '} ${plan.plan_id}: ${describe(vectorOf(plan))}`)
        .join('\n');

    switch (testCase.verdict) {
      case VERDICT.MATCH_BASELINE:
        assert.ok(
          sameVector(vectorOf(baseline), expected),
          `기본안이 표와 같다고 판정했는데 갈렸다.\n${report}`,
        );
        break;

      case VERDICT.MATCH_OTHER_PLAN:
        assert.equal(
          sameVector(vectorOf(baseline), expected),
          false,
          `기본안이 아니라고 판정했는데 기본안이 표와 같아졌다 — 판정을 다시 읽어야 한다.\n${report}`,
        );
        assert.ok(
          matching.length > 0,
          `표의 배분이 배분안 중 하나로 나온다고 판정했는데 어디에도 없다.\n${report}`,
        );
        break;

      // **불일치도 잠근다.** 우연히 같아지면 갈래 판정이 낡은 것이므로 사람이 다시 봐야 한다.
      default:
        assert.equal(
          matching.length,
          0,
          `어긋난다고 판정한 케이스인데 배분안 하나가 표와 같아졌다 — 판정을 다시 읽어야 한다.\n${report}`,
        );
        break;
    }
  });
}

// ── 관리자가 짚은 자리들 ─────────────────────────────────────────

test('소유자 표 / 케이스 5 — 연금수령을 개시한 계좌는 배분에서 빠진다', () => {
  const scenario = scenarioOf(compute(requestFor(CASES[4]), rulesets));
  const plan = scenario.plans[0];

  for (const account of ['annuity_savings', 'retirement_pension']) {
    assert.equal(allocationOf(plan, account).annual_krw, 0);
    assert.equal(allocationOf(plan, account).limited_by, 'not_eligible');
  }
  assert.ok(noticeCodes(scenario).includes('pension_contribution_blocked_annuity_started'));
});

test('소유자 표 / 케이스 5 — 수령 중인 것이 사적연금이 아니면 답이 뒤집힌다 (시트 4의 분기)', () => {
  // 시트 4 「초안 대비 수정된 항목」이 적은 분기다. 같은 월 100만원이 국민연금이면 연금계좌가
  // 열려 있고 배분이 정반대가 된다. **엔진에서 그 분기를 정하는 것은 `annuity_start_status`다.**
  const opened = { ...CASES[4], annuityStarted: false };
  const plan = scenarioOf(compute(requestFor(opened), rulesets)).plans[0];

  assert.ok(
    allocationOf(plan, 'annuity_savings').annual_krw > 0 &&
      allocationOf(plan, 'retirement_pension').annual_krw > 0,
    '개시하지 않았다고 답했는데도 연금계좌가 닫혀 있다',
  );
});

test('소유자 표 / 케이스 6 — 금융소득종합과세 대상자는 ISA가 배분에서 빠진다', () => {
  const scenario = scenarioOf(compute(requestFor(CASES[5]), rulesets));
  assert.ok(noticeCodes(scenario).includes('isa_excluded_financial_income_taxpayer'));
  assert.equal(allocationOf(scenario.plans[0], 'isa').limited_by, 'not_eligible');
});

test('소유자 표 / 케이스 11 — 미성년자는 ISA 연령 요건에서 빠진다', () => {
  const scenario = scenarioOf(compute(requestFor(CASES[10]), rulesets));
  assert.ok(noticeCodes(scenario).includes('isa_excluded_age'));
  assert.equal(allocationOf(scenario.plans[0], 'isa').annual_krw, 0);
});

test('소유자 표 / 케이스 7·11·13 — 결정세액 0이 「등식으로」 나오고 세액 축이 무너진 사실이 값으로 나간다', () => {
  // 표는 이 셋에서 「연금계좌 무의미」를 결론으로 적었다. **엔진은 그 결론을 내지 않는다**
  // (계약 5.12절). 대신 결론을 낼 재료를 값으로 전부 내고, 그것이 여기서 확인된다.
  for (const testCase of [CASES[6], CASES[10], CASES[12]]) {
    const scenario = scenarioOf(compute(requestFor(testCase), rulesets));
    const cap = scenario.pension_credit_tax_liability_cap;
    const label = `케이스 ${testCase.n}`;

    assert.equal(cap.cap_krw, 0, `${label}: 한도가 0이 아니다`);
    // 상한이 0이면 실제 한도도 0보다 클 수 없다 — 추정이 아니라 등식이다.
    assert.equal(cap.is_exact, true, `${label}: 0인데 등식이라고 말하지 않는다`);
    assert.ok(noticeCodes(scenario).includes('tax_liability_cap_zero'), label);
    assert.ok(scenario.comparison_note_codes.includes('tax_credit_axis_not_discriminating'), label);

    for (const plan of scenario.plans) {
      assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 0, `${label}: ${plan.plan_id}`);
    }
    // 이름이 세액공제를 근거로 든 안은 그 근거가 아무것도 가르지 못한다는 사실을 스스로 밝힌다.
    assert.equal(planOf(scenario, 'max_tax_credit').priority_basis.objective_degenerate, true, label);
  }
});

test('소유자 표 / 케이스 7·11·13 — 그런데도 연금계좌 배분을 0으로 만들지는 않는다 (계약 5.12절)', () => {
  // **이것이 표와 갈리는 자리이고, 갈리는 것이 판정이다.** §61③이 초과분을 「받지 아니한
  // 것으로」 의제하고 시행령 §118의3이 그 납입액의 전환 신청을 예정하므로, 「한도가 0이면 넣을
  // 이유가 없다」는 세법의 결론이 아니다. 엔진이 그것을 결론으로 내면 조문에 없는 선호를
  // 지어내는 것이 된다.
  for (const testCase of [CASES[6], CASES[10], CASES[12]]) {
    const plan = planOf(scenarioOf(compute(requestFor(testCase), rulesets)), 'max_tax_credit');
    const pensionTotal =
      allocationOf(plan, 'annuity_savings').annual_krw + allocationOf(plan, 'retirement_pension').annual_krw;
    assert.ok(pensionTotal > 0, `케이스 ${testCase.n}: 한도 0을 이유로 연금계좌를 비웠다`);
  }
});

test('소유자 표 / 케이스 2 — ISA 의무가입기간이 남았다는 사실은 경고로 나가고 금액은 바꾸지 않는다', () => {
  const scenario = scenarioOf(compute(requestFor(CASES[1]), rulesets));
  const boundaries = scenario.fund_use_horizon_boundaries;

  // 표가 쓴 근거(2년 < 의무보유 3년)를 엔진도 값으로 낸다.
  assert.ok(boundaries.isa_lock_in_years_remaining > 0);
  const isaWarnings = scenario.plans
    .flatMap((plan) => plan.warnings)
    .filter((warning) => warning.code === 'early_termination_clawback_isa');
  assert.ok(isaWarnings.length > 0, 'ISA 중도해지 경고가 하나도 없다');
  assert.ok(
    isaWarnings.every((warning) => warning.severity === 'warning' && warning.trigger === 'declared_horizon'),
    '사용자가 시점을 밝혔는데 경고가 info로 나간다',
  );

  // 그러나 금액은 바뀌지 않는다 — 같은 요청에서 horizon만 바꾸면 배분 벡터가 같아야 한다.
  const asLongTerm = { ...CASES[1], horizon: 'at_or_after_pension_age' };
  const other = scenarioOf(compute(requestFor(asLongTerm), rulesets));
  const byId = new Map(other.plans.map((plan) => [plan.plan_id, vectorOf(plan)]));
  for (const plan of scenario.plans) {
    assert.deepStrictEqual(
      vectorOf(plan),
      byId.get(plan.plan_id),
      `${plan.plan_id}: 자금 사용 시점이 금액을 바꿨다 — 계약 3.1절의 보장이 깨졌다`,
    );
  }
});

test('소유자 표 / 케이스 12 — 총급여 5,400만은 룰셋의 우대 구간 안쪽이고 경계 바로 위에서 뒤집힌다', () => {
  const brackets = rule('pension.credit.rate').value.brackets;
  const boundary = brackets[0].total_salary_only_max_krw;
  assert.ok(CASES[11].salaryMan * MAN < boundary, '케이스 12가 경계 위로 올라갔다');

  const creditAt = (salary) =>
    planOf(
      scenarioOf(
        compute(
          requestFor({ ...CASES[11], salaryMan: salary / MAN }),
          rulesets,
        ),
      ),
      'max_tax_credit',
    ).deterministic_benefit.pension_credit_total_krw;

  // 시트 2가 「5,500만은 연속이 아니라 절벽」이라 적었다. 경계값 정확히는 우대 구간이고
  // (법문이 '이하') 1원 위에서 떨어진다.
  assert.equal(creditAt(CASES[11].salaryMan * MAN), creditAt(boundary), '경계 아래에서 값이 갈렸다');
  assert.ok(creditAt(boundary) > creditAt(boundary + 1), '경계 1원 위에서 공제액이 떨어지지 않는다');
});

test('소유자 표 / 케이스 9 — 시트가 적은 「IRP 300만을 넣으면 49.5만 유리」가 엔진에서 같은 수로 나온다', () => {
  // 시트 4 「초안 대비 수정된 항목」의 케이스 9 단서다. **표의 배분이 아니라 표가 스스로 적은
  // 대안**을 확인하는 것이고, 그 대안이 엔진의 기본안과 같다.
  const OWNER_STATED_GAIN_KRW = 495_000; // 시트 2 케이스 9 ③ · 시트 4 28행에 적힌 값이다.

  const scenario = scenarioOf(compute(requestFor(CASES[8]), rulesets));
  const withIrp = planOf(scenario, 'max_tax_credit').deterministic_benefit.pension_credit_total_krw;

  // 표의 배분(IRP 0)을 그대로 재현한다 — 연금계좌 여력을 연금저축 몫만큼으로 좁힌다.
  const ownerShaped = compute(
    requestFor({ ...CASES[8], capacityMan: CASES[8].owner.annuity }),
    rulesets,
  );
  const withoutIrp = planOf(scenarioOf(ownerShaped), 'max_tax_credit').deterministic_benefit
    .pension_credit_total_krw;

  assert.equal(withIrp - withoutIrp, OWNER_STATED_GAIN_KRW);
});

// ── 케이스 4 — 없앤 입력이 남긴 거래의 값 (D39·D40·D43) ──────────

test('소유자 표 / 케이스 4 — 우리 추정 한도가 표의 결정세액보다 크다. 그 방향이 D40이 예고한 방향이다', () => {
  /**
   * 시트 2·4가 적은 값이다. **우리 값이 아니다.**
   *
   *   · 시트 2 케이스 4 ①: 「총급여 2,500만의 결정세액은 지방세 포함 약 37만원」
   *   · 시트 4 27행: 「결정세액 36.7만 ÷ 16.5% = 약 222만이 실제 상한」
   *
   * 우리는 D39로 이 값을 **묻는 입력을 없앴고**, 대신 해당 과세기간 총급여액에서 §47 → §50①1
   * → §55① → §59 → §61②③을 밟아 한도를 산출한다. 룰셋이 그 값을 **상한**이라고 적었으므로
   * (`error_direction.code`) 우리 값이 표보다 **커야** 한다. 작으면 상한 보장이 깨진 것이다.
   */
  const OWNER_LIABILITY_INCLUDING_SURTAX_KRW = 367_000;

  const scenario = scenarioOf(compute(requestFor(CASES[3]), rulesets));
  const cap = scenario.pension_credit_tax_liability_cap;
  const surtax = rule('tax.local.personal_income_surtax').value.rate_of_income_tax;

  // 표의 값은 지방소득세를 포함한 수이고 `cap_krw`는 소득세분이다. 같은 자로 만든 뒤 비교한다.
  const ourCapIncludingSurtax = cap.cap_krw + Math.floor(cap.cap_krw * surtax);

  assert.equal(cap.branch_code, 'wage_income_only');
  assert.equal(cap.error_direction_code, rule('pension.credit.tax_liability_cap.current_year_estimate').value.error_direction.code);
  assert.equal(cap.is_upper_bound, true);
  assert.ok(
    ourCapIncludingSurtax > OWNER_LIABILITY_INCLUDING_SURTAX_KRW,
    `상한이어야 하는 값이 표의 결정세액보다 작다 — ${ourCapIncludingSurtax} ≤ ${OWNER_LIABILITY_INCLUDING_SURTAX_KRW}`,
  );

  // 한도가 실제로 자르고, 상한이 잘랐으므로 실제 한도도 반드시 자른다.
  const benefit = planOf(scenario, 'max_tax_credit').deterministic_benefit;
  assert.equal(benefit.tax_liability_cap.applied, true);
  assert.equal(benefit.tax_liability_cap.binding_code, 'binds_provably');
  assert.equal(benefit.pension_credit_total_krw, ourCapIncludingSurtax);
});

test('소유자 표 / 케이스 4 — 한도 차이가 「공제를 낳는 납입액」을 얼마나 부풀리는지', () => {
  // D40이 「상한이라 과대 방향」이라 적은 자리가 실제 케이스로 나타난 것이다. **결함이 아니라
  // 소유자가 택한 거래의 값이고, 이 시험이 그 크기가 0이 아님을 붙잡는다.**
  const scenario = scenarioOf(compute(requestFor(CASES[3]), rulesets));
  const cap = scenario.pension_credit_tax_liability_cap;
  const rate = scenario.pension_credit_ceiling.income_tax_rate;

  // 이 한도 아래에서 공제를 낳는 납입액의 상한. 표는 같은 산식을 자기 결정세액으로 계산해
  // 「약 222만」을 적었다.
  const ourProductiveContribution = Math.floor(cap.cap_krw / rate);
  const ownerProductiveContribution = CASES[3].owner.annuity * MAN;

  assert.ok(
    ourProductiveContribution > ownerProductiveContribution,
    '과대 방향이 뒤집혔다 — 룰셋의 error_direction과 어긋난다',
  );
  // 표가 실제로 배정한 금액(200만)과 우리가 「여기까지는 공제가 붙는다」고 보는 금액의 차이가
  // 0이 아니라는 것이 이 회차에 처음 수로 보이는 것이다.
  assert.ok(ourProductiveContribution - ownerProductiveContribution > 0);
});
