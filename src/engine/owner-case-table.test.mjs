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
// 이미 수령 중인 연금액의 종합과세 한도 잠식. **룰셋에 규칙이 없으면 없는 것이므로
// 「틀렸다」가 아니라 「우리 축이 아니다」다.**
//
// **이 목록에서 하나가 빠졌다 — IRP 가입자격이다**(D44). 그것은 「우리 축이 아닌 것」이
// 아니라 **룰셋에 있어야 했는데 없던 것**이었고, 소유자 표가 그 구멍을 찾아냈다.
// 지금은 `irp.eligibility`가 룰셋에 있고 케이스 7·13의 기본안이 표와 같아진다.
// **표가 바깥에서 왔기 때문에 우리 눈먼 자리를 비춘다는 이 파일의 전제가 실증된 자리다.**

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
    // **D52 2번으로 이 케이스가 표 쪽으로 크게 움직였다.** 표는 2년 뒤 쓸 돈이라는 이유로
    // 계좌를 비웠고, 우리는 D10을 근거로 「시점은 금액을 바꾸지 않는다」며 세 계좌를
    // 채우고 있었다. **소유자가 D10을 뒤집었다** — 3년 안에 쓸 돈이면 전액 미배분이다.
    //
    // **그래도 완전히 같지는 않다.** 표에는 연금저축 300만이 남아 있고 그 옆에
    // 「노후 전용 자금에 한정」이라는 단서가 붙어 있다. **이번 지시가 그것보다 나중이고
    // 더 명확하므로 이번 것을 따른다** — 사용자가 「이 돈을 3년 안에 쓴다」고 답한 이상
    // 그 돈에 대해서는 전액 미배분이다. 남은 어긋남은 그 한 칸뿐이고, 아래 전용 시험이
    // 무엇이 같아졌고 무엇이 남았는지를 값으로 못 박는다. **관리자에게 보고했다.**
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
    // **D52 1번으로 IRP 칸이 표와 같아졌다.** 총급여 2,500만의 세액 한도는 연금저축
    // 600만만으로 이미 넘으므로 그 위의 IRP는 세액공제를 한 원도 낳지 않는다 — 소유자가
    // 그것을 짚었고 표는 처음부터 0을 적고 있었다. 아래 전용 시험이 그 칸을 못 박는다.
    //
    // **남은 어긋남은 축 하나다** — 우리 한도는 총급여액에서 산출한 **상한**이라 표가
    // 쓴 결정세액(36.7만)보다 크고, 그래서 「공제를 낳는 납입액」의 경계가 표의 200만보다
    // 위에 있다. 그 축은 D39·D40이 소유자와 함께 택한 거래이고 아래 두 시험이 크기를 잰다.
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
    // **이 케이스가 룰셋의 구멍을 찾아냈고, D44가 그것을 조문으로 메웠다.**
    //
    // 전에는 갈래가 `MATCH_OTHER_PLAN`이었다 — 표의 배분이 `isa_first`로만 나오고
    // 기본안은 IRP에 300만을 권했다. 근거는 「IRP 가입자격 규칙이 룰셋에 없다」였는데,
    // 그것이 사실이 아니라 **3차 조사가 「우리 타깃은 근로소득자뿐」이라고 보아 규칙을
    // 넣지 않은 것**이었다(리포트 25.1절). 규칙이 들어오면서 두 가지가 함께 움직였다.
    //
    //   · 근퇴법 §24②의 한정 열거 밖이라 **IRP가 배분에서 빠진다**(`irp.eligibility`).
    //   · 종합소득이 없어 §59조의3①의 요건이 서지 않으므로 **공제를 낳는 여력이 0**이다
    //     (`pension.credit.taxpayer_eligibility`). 연금저축은 그대로 열려 있지만,
    //     공제를 낳지 않는 납입을 「세액공제 최대」라는 이름으로 앞세우지 않는다.
    //
    // **잠금을 푼 것이 아니라 옮겼다.** 「기본안은 표와 다르다」를 잠그던 자리가
    // 「기본안이 표와 같다」로 바뀌었고, 우연히 같아지는 것이 아니라 소유자 표가 옳았다는
    // 것이 이번 변경의 요지다. 아래 별도 시험이 IRP 0의 **경로**까지 못 박는다.
    verdict: VERDICT.MATCH_BASELINE,
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
    // ISA 쪽은 엔진도 같은 결론을 낸다(연령 배제). IRP도 이제 같은 결론이다 — 열거 밖이라
    // 0이다. **연금저축 쪽은 여전히 갈린다**: 세법에 연금저축 가입 연령 하한이 **없다는
    // 것이 판정**이고(`pension_savings.eligibility`), 요건이 서지 않아 공제가 0이어도
    // 납입 자체를 막는 조문은 없다(계약 5.12절). 예산이 ISA 없이 남으므로 연금저축이
    // 납입 한도까지 받는다.
    //
    // **공제 0의 경로가 이번에 바뀌었다.** 소유자는 「결정세액 0이라 잘렸다」로 적었고
    // 조문상 경로는 「종합소득이 없어 요건이 서지 않는다」다 — 금액은 같고 화면이 쓸
    // 문장이 다르다(D44). 아래 별도 시험이 그 구분을 못 박는다.
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
    // 케이스 7과 같은 자리다. 육아휴직으로 그 해 총급여가 0이고 합산되는 다른 소득이
    // 없으므로 IRP는 열거 밖이고 연금 세액공제의 요건도 서지 않는다. **소유자가 이
    // 케이스에 대해서도 옳았고, D44 이후 기본안이 표와 같아진다.**
    verdict: VERDICT.MATCH_BASELINE,
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

// ── D44 — IRP 가입 자격이 룰셋에 들어온 자리 ─────────────────────

test('소유자 표 / 케이스 7 — 무소득자에게 IRP를 권하지 않는다. 그리고 그 이유가 조문의 이유다', () => {
  // **이 회차의 요지다.** 엔진이 이 사람에게 IRP 300만을 권하고 있었고 소유자 표는 0을
  // 적고 있었다. 표가 옳았다.
  const scenario = scenarioOf(compute(requestFor(CASES[6]), rulesets));
  const entry = scenario.account_eligibility.find((e) => e.account === 'retirement_pension');

  assert.equal(entry.eligible, false, 'IRP가 여전히 배분 대상이다');
  // **결론이 「소득이 없어서」가 아니다.** 근퇴법 §24②이 여섯 갈래를 한정 열거하고
  // 열거 밖을 허용하는 문언이 없다는 것이 이유이며, 그 구분이 결론 코드로 나간다.
  assert.equal(entry.determination_code, 'irp_not_eligible');
  assert.deepStrictEqual(entry.reason_codes, ['irp_excluded_no_qualifying_status']);
  assert.deepStrictEqual(entry.basis_rule_ids, ['irp.eligibility']);
  // 이 배제가 잘못될 수 있는 방향까지 룰셋이 코드로 정해 두었다 — 과거에 퇴직급여
  // 일시금을 받은 사실이 입력에 남지 않은 사람을 잘못 막을 수 있고, 그것은 과소 방향이다.
  assert.equal(entry.determination_direction_code, 'understated_or_equal');

  const irpNotice = scenario.notices.find((n) => n.code === 'irp_excluded_no_qualifying_status');
  assert.ok(irpNotice !== undefined, '배제 사실이 안내로 나가지 않는다');
  assert.equal(irpNotice.severity, 'warning');
  // 이 배제를 닫을 수 있는 입력이 무엇인지까지 값으로 나간다. 화면이 **이 분기에서만**
  // 그 물음을 띄우게 하는 값이고, 대다수 사용자에게는 분기 자체가 걸리지 않는다.
  assert.deepStrictEqual(irpNotice.params.closing_input_ids, ['received_retirement_lumpsum_ever']);

  // 어느 배분안도 IRP에 한 원도 넣지 않는다. 「기본안만」이 아니다.
  for (const plan of scenario.plans) {
    assert.equal(allocationOf(plan, 'retirement_pension').annual_krw, 0, plan.plan_id);
    assert.equal(allocationOf(plan, 'retirement_pension').limited_by, 'not_eligible', plan.plan_id);
  }
});

test('소유자 표 / 케이스 8 — 프리랜서는 여전히 IRP를 받는다. 다만 「자격 있음」이라고 말하지 않는다', () => {
  // **막지 않는 것이 판정이다**(D44 판정 1). 사업소득이면 시행령 §17조 제1호로 자격이
  // 있고 이자·배당뿐이면 없는데, 우리 입력이 그 둘을 가르지 못한다. 막았는데 자격이
  // 있었던 오류는 스스로 드러나지 않으므로 막지 않는다.
  const scenario = scenarioOf(compute(requestFor(CASES[7]), rulesets));
  const entry = scenario.account_eligibility.find((e) => e.account === 'retirement_pension');

  assert.equal(entry.eligible, true, '미정을 배제로 옮겼다 — D44가 금지한 방향이다');
  // **그러나 「자격 있음」도 아니다.** 셋째 상태가 값으로 나가지 않으면 화면은 미정을
  // 확정으로 읽는다.
  assert.equal(entry.determination_code, 'irp_eligibility_undetermined');
  assert.equal(entry.determination_direction_code, 'direction_indeterminate');
  assert.deepStrictEqual(entry.reason_codes, [], '배제가 아닌데 사유 코드가 붙었다');

  const undetermined = scenario.notices.find((n) => n.code === 'irp_eligibility_not_determined');
  assert.ok(undetermined !== undefined, '**침묵했다.** 빼지 않는 것과 아무 말도 하지 않는 것은 다르다');
  assert.deepStrictEqual(undetermined.params.closing_input_ids, ['has_business_income_current_year']);
  // 배제 코드는 나가지 않는다. 화면이 「불가」를 적을 근거가 응답 어디에도 없어야 한다.
  assert.equal(noticeCodes(scenario).includes('irp_excluded_no_qualifying_status'), false);

  // 그리고 실제로 IRP를 받는다 — 케이스 8의 기본안은 D44 전과 같은 수다.
  const baseline = scenario.plans.find((plan) => plan.is_baseline);
  assert.ok(allocationOf(baseline, 'retirement_pension').annual_krw > 0, '미정 분기에서 IRP가 비었다');
});

test('세 상태가 실제로 갈린다 — 같은 요청에서 소득 답만 바꾸면 결론이 셋으로 나뉜다', () => {
  // 한 좌표만 보면 「어느 분기든 늘 같은 답」인 코드도 통과한다. 셋이 갈리는 것을 본다.
  const outcomeFor = (patch) => {
    const scenario = scenarioOf(compute(baseRequest({ profile: patch }), rulesets));
    return scenario.account_eligibility.find((e) => e.account === 'retirement_pension')
      .determination_code;
  };

  assert.equal(
    outcomeFor({ current_year_total_salary_krw: 50_000_000 }),
    'irp_eligible',
    '근로소득이 있으면 여섯 갈래 중 하나에 반드시 든다(닫힘 논증)',
  );
  assert.equal(
    outcomeFor({
      current_year_total_salary_krw: 0,
      has_non_wage_global_income_current_year: false,
    }),
    'irp_not_eligible',
  );
  assert.equal(
    outcomeFor({
      current_year_total_salary_krw: 0,
      has_non_wage_global_income_current_year: true,
      current_year_global_income_krw: 80_000_000,
    }),
    'irp_eligibility_undetermined',
  );
});

test('가입 자격과 세액공제 자격은 다른 축이다 — 한쪽이 다른 쪽을 따라가지 않는다', () => {
  // **D44가 화면에 요구한 구분이 이것이다.** 이자·배당소득만 있는 사람은 IRP를 못 열
  // 수도 있지만 연금저축으로는 공제를 받는다. 두 값이 같은 요청에서 갈리는 것을 본다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          current_year_total_salary_krw: 0,
          has_non_wage_global_income_current_year: true,
          current_year_global_income_krw: 80_000_000,
        },
      }),
      rulesets,
    ),
  );

  const irp = scenario.account_eligibility.find((e) => e.account === 'retirement_pension');
  const credit = scenario.pension_credit_taxpayer_eligibility;

  // 가입 자격은 미정인데 공제 자격은 **확정**이다. 두 축이 붙어 있으면 낼 수 없는 조합이다.
  assert.equal(irp.determination_code, 'irp_eligibility_undetermined');
  assert.equal(credit.outcome_code, 'pension_credit_available');
  assert.equal(credit.requirement_met, true);
  assert.equal(noticeCodes(scenario).includes('pension_credit_zero_no_global_income'), false);
});

test('소유자 표 / 케이스 11 — 공제 0의 경로가 「잘렸다」가 아니라 「요건이 서지 않는다」다', () => {
  // **금액은 같고 화면이 쓸 문장이 다르다**(D44). 「소득이 늘면 그만큼 공제받는다」를
  // 함의하는 앞엣것과, 그 과세기간에 대한 사실의 진술인 뒤엣것을 코드가 갈라야 한다.
  const scenario = scenarioOf(compute(requestFor(CASES[10]), rulesets));
  const credit = scenario.pension_credit_taxpayer_eligibility;

  assert.equal(credit.outcome_code, 'pension_credit_zero_no_global_income');
  assert.equal(credit.requirement_met, false);
  // 추정이 아니라 조문에서 나오는 등식이다. 룰셋이 그 사실을 값으로 적어 두었다.
  assert.equal(credit.is_exact, true);
  assert.deepStrictEqual(credit.basis_rule_ids, ['pension.credit.taxpayer_eligibility']);
  assert.ok(noticeCodes(scenario).includes('pension_credit_zero_no_global_income'));

  for (const plan of scenario.plans) {
    const benefit = plan.deterministic_benefit;
    assert.equal(benefit.pension_credit_total_krw, 0, plan.plan_id);
    // **1단계가 서지 않으면 2단계는 돌지 않는다**(룰셋의 `two_stages_and_why_the_order_matters`).
    // 자르기 **전** 금액도 0이고, 그래서 한도가 자른 것이 아니다 — 화면이 「낼 세금이 적어
    // 잘렸습니다」를 적을 근거가 응답에 없다.
    assert.equal(benefit.pension_credit_total_before_cap_krw, 0, plan.plan_id);
    assert.equal(benefit.tax_liability_cap.applied, false, plan.plan_id);
    assert.equal(benefit.tax_liability_cap.binding_code, 'binding_not_determined', plan.plan_id);
    assert.equal(benefit.credit_eligible_contribution_krw, 0, plan.plan_id);
  }
});

test('요건이 서지 않는 분기에서는 세액 한도도 0이다 — 룰셋이 그 겹침을 스스로 적었다', () => {
  // 룰셋의 `no_global_income.edge_case_note`가 「그 경우에도 산출세액이 0이라 공제액은
  // 같은 0이고 결과가 갈리지 않는다」고 적는다. **그 겹침이 실제로 성립하는지 잰다** —
  // 성립하지 않으면 두 경로가 서로 다른 금액을 내고 있다는 뜻이다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          current_year_total_salary_krw: 0,
          has_non_wage_global_income_current_year: false,
          monthly_capacity_krw: 1_000_000,
        },
      }),
      rulesets,
    ),
  );

  assert.equal(scenario.pension_credit_taxpayer_eligibility.requirement_met, false);
  assert.equal(scenario.pension_credit_tax_liability_cap.cap_krw, 0);
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

test('소유자 표 / 케이스 7·11·13 — 한도 0을 이유로 연금저축을 배분에서 빼지는 않는다 (계약 5.12절)', () => {
  // **이 시험이 무엇을 잠그는지가 D44로 정밀해졌다.**
  //
  // 전에는 「기본안의 연금계좌 배분액 > 0」을 보았다. 그 형태는 이제 성립하지 않는다 —
  // 세액공제 요건이 서지 않는 사용자에게는 공제를 낳는 여력이 0이라 기본안이 ISA부터
  // 채우고, 예산이 ISA 한도 안에서 끝나면 연금계좌가 0이 된다. **그것은 「빼는 것」이
  // 아니라 「앞세우지 않는 것」이다.**
  //
  // 잠가야 하는 진술은 그대로다 — §61③이 초과분을 「받지 아니한 것으로」 의제하고 시행령
  // §118의3이 그 납입액의 전환 신청을 예정하므로, 「한도가 0이면 넣을 이유가 없다」는
  // 세법의 결론이 아니다. 그래서 **연금저축은 여전히 배분 대상이고**, 예산이 남으면
  // 실제로 돈이 들어간다. 그 둘을 따로 확인한다.
  for (const testCase of [CASES[6], CASES[10], CASES[12]]) {
    const scenario = scenarioOf(compute(requestFor(testCase), rulesets));
    const label = `케이스 ${testCase.n}`;

    // (가) 자격 자체를 빼앗지 않았다. 연금저축에는 세법상 연령·소득 요건이 없다.
    const annuity = scenario.account_eligibility.find((e) => e.account === 'annuity_savings');
    assert.equal(annuity.eligible, true, `${label}: 연금저축을 배분 대상에서 뺐다`);
    assert.equal(annuity.determination_code, null, `${label}: 없는 가입 자격 규칙을 지어냈다`);
    assert.ok(
      annuity.basis_rule_ids.includes('pension_savings.eligibility'),
      `${label}: 「요건이 없다」는 판정의 근거가 근거 목록에 없다`,
    );

    // (나) 어느 배분안에서도 `not_eligible`로 막히지 않는다.
    for (const plan of scenario.plans) {
      assert.notEqual(
        allocationOf(plan, 'annuity_savings').limited_by,
        'not_eligible',
        `${label}: ${plan.plan_id}에서 연금저축이 자격으로 막혔다`,
      );
    }

    // (다) 그리고 실제로 돈이 들어가는 배분안이 있다 — 「넣을 수 없다」가 아니다.
    assert.ok(
      scenario.plans.some((plan) => allocationOf(plan, 'annuity_savings').annual_krw > 0),
      `${label}: 어느 배분안도 연금저축에 한 원도 넣지 않는다`,
    );
  }
});

test('소유자 표 / 케이스 2 — 3년 안에 쓸 돈이면 전액 미배분이다 (D52 2번)', () => {
  // **표가 옳았고 우리가 D10을 근거로 반대편에 서 있었다.** 그 판정이 뒤집혔다.
  const scenario = scenarioOf(compute(requestFor(CASES[1]), rulesets));
  const boundaries = scenario.fund_use_horizon_boundaries;

  // 표가 쓴 근거(2년 < 의무보유 3년)를 엔진도 값으로 낸다.
  assert.ok(boundaries.isa_lock_in_years_remaining > 0);

  // 세 계좌 전부가 비었다 — 표의 「기타」 열이 뜻하던 것이다.
  assert.equal(scenario.plans.length, 1);
  const baseline = scenario.plans[0];
  assert.deepStrictEqual(vectorOf(baseline), {
    annuity: 0,
    pension: 0,
    isa: 0,
    other: CASES[1].capacityMan * MAN - (CASES[1].capacityMan * MAN) % MONTHS,
  });

  // **그리고 그 이유가 「한도가 없어서」가 아니라는 것이 값으로 나간다.**
  assert.equal(
    baseline.unallocated_breakdown.reason_code,
    'no_account_beneficial_within_fund_use_horizon',
  );

  // **표와 남은 어긋남은 연금저축 한 칸이다.** 표는 300만을 두고 「노후 전용 자금에
  // 한정」이라는 단서를 달았고, 이번 지시가 더 나중이고 더 명확하므로 이번 것을 따른다.
  // 그 어긋남을 값으로 고정해 둔다 — 나중에 누가 다시 볼 때 크기를 알 수 있어야 한다.
  assert.equal(ownerVectorOf(CASES[1]).annuity, 3_000_000);
  assert.equal(vectorOf(baseline).annuity, 0);

  // 같은 요청을 다른 시점으로 물으면 금액이 돌아온다 — 이 시점만 다르다는 것의 확인이다.
  const asLongTerm = { ...CASES[1], horizon: 'at_or_after_pension_age' };
  const other = scenarioOf(compute(requestFor(asLongTerm), rulesets));
  assert.ok(
    other.plans.every((plan) => plan.total_allocated_annual_krw > 0),
    '다른 시점에서도 배분이 비었다 — 이 변경이 시점 밖으로 번졌다',
  );
});

test('소유자 표 / 케이스 4 — 결정세액이 낮으면 IRP를 권하지 않는다 (D52 1번)', () => {
  // **표가 옳았다.** 총급여 2,500만의 세액 한도는 연금저축 600만이 낳는 공제액보다
  // 작으므로, 그 위의 IRP 300만은 세액공제를 한 원도 더 낳지 않으면서 중도인출 제한만
  // 진다. 엔진은 그 배분을 내고 있었고 소유자가 짚었다.
  const scenario = scenarioOf(compute(requestFor(CASES[3]), rulesets));
  const baseline = scenario.plans.find((plan) => plan.is_baseline);

  assert.equal(allocationOf(baseline, 'retirement_pension').annual_krw, 0);
  assert.equal(ownerVectorOf(CASES[3]).pension, 0, '표의 IRP 칸이 0이 아니면 이 시험의 전제가 다르다');
  assert.equal(
    allocationOf(baseline, 'retirement_pension').limited_by,
    'no_additional_tax_credit',
  );
  // 그 판정이 IRP에만 걸리는 근거가 함께 나간다 — 연금저축은 같은 제한을 받지 않는다.
  assert.ok(
    allocationOf(baseline, 'retirement_pension').basis_rule_ids.includes(
      'pension.withdrawal.midterm_restriction',
    ),
  );

  // **연금저축은 건드리지 않았다**(소유자가 그은 선). 공제를 낳지 않아도 과세이연과
  // 인출 자유가 남고 조문이 이월 신청을 예정한다.
  assert.ok(allocationOf(baseline, 'annuity_savings').annual_krw > 0);

  // **그리고 그 대가는 0이다** — 손대지 않은 안과 공제액이 같다.
  const untouched = scenario.plans.find((plan) => plan.plan_id === 'annuity_savings_first');
  if (untouched) {
    assert.equal(
      baseline.deterministic_benefit.pension_credit_total_krw,
      untouched.deterministic_benefit.pension_credit_total_krw,
      'IRP를 잘라 세액공제를 잃었다 — 그러면 이 변경의 전제가 거짓이다',
    );
    assert.ok(
      allocationOf(untouched, 'retirement_pension').annual_krw > 0,
      '비교 대상 안이 IRP를 채우지 않으면 「대가가 0」이 아무것도 재지 않는다',
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
