// **시험 자료다. 엔진 본체가 이 파일을 임포트하지 않는다.**
//
// 무엇을 담고 있나 — D32(소유자의 기본안 배분 변경) **직전**의 엔진이 낸 기본안의
// 세액공제액이다. 관리자가 요구한 불변식 하나가 "기본안의 세액공제액이 이 변경 전과
// 같다"이고, 그 진술은 **변경 전의 값이 어딘가에 얼어 있어야만** 기계로 확인된다.
//
// **여기 있는 금액은 세법 수치가 아니라 엔진의 출력이다.** 한도·비율·구간 경계를 적은
// 것이 아니라, 룰셋을 읽어 계산한 결과를 그대로 받아 적었다. 그래서 룰셋이 바뀌면
// 이 값도 함께 바뀌어야 하고, 그때는 `freeze` 표를 다시 만들어야 한다 —
// **그 재생성이 필요하다는 사실 자체가 이 표가 무는 지점이다.**
//
// 어떻게 다시 만드나 — `freezeCases()`가 만드는 요청을 그 시점의 엔진에 넣고
// `[plan_id, 소득세, 지방세, 합계, 자르기 전 합계, 인정 납입액, ISA 배분액]` 일곱 값을
// 시나리오별로 받아 적는다. **사람이 손으로 고치는 표가 아니다.**

import { baseRequest } from './test-helpers.mjs';

/**
 * 격자. 세법 수치가 아니라 **입력 좌표**다 — 사용자가 답할 수 있는 값의 범위에서 골랐고,
 * 공제 한도·납입 한도·ISA 한도의 어느 쪽이 먼저 걸리는지가 갈리도록 예산을 넓게 벌렸다.
 */
const MONTHLY = [
  0, 100_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
  10_000_000,
];

const HORIZONS = [
  'at_or_after_pension_age',
  'before_pension_age',
  'within_isa_lock_in',
  'unknown',
];

/** 이미 납입한 금액. 공제 여력이 남았는가 / 납입 여력만 남았는가를 가른다. */
const YTD = [
  [0, 0],
  [6_000_000, 0],
  [0, 3_000_000],
  [3_000_000, 3_000_000],
];

const SALARIES = [40_000_000, 60_000_000];
const ISA_KINDS = [
  ['general', true],
  ['low_income', true],
  [null, false],
];

const PRIORS = [
  { state: 'amount', determined_tax_krw: 5_000_000, pension_credit_applied_krw: 0 },
  { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
  { state: 'zero', determined_tax_krw: null, pension_credit_applied_krw: null },
];

/** 청년 우대는 개정안에서만 갈리므로 생년월일을 함께 옮긴다. */
const YOUTHS = [
  [null, '1986-03-02'],
  [true, '1998-03-02'],
];

/**
 * 연금수령 개시 여부. **이 축이 격자에 반드시 있어야 한다.**
 *
 * 연금저축이 자기 단독 공제한도를 넘겨 채워지며 공제액이 과대로 나오던 결함은
 * **합산 한도가 묶고 있지 않을 때만** 드러난다. 두 계좌가 다 열려 있으면 IRP가
 * 합산 한도의 나머지를 가져가 그 한도가 묶어 버리고, 결함이 있어도 금액이 같다.
 * 한쪽 계좌가 막혀야 단독 한도가 실제로 묶는 자리가 되고 그때 결함이 보인다.
 *
 * **처음 만든 격자에는 이 축이 없었고, 그래서 결함 주입이 통과했다.**
 * 그 사실을 여기 적어 둔다 — 격자를 좁히면 얼린 표가 조용히 눈을 감는다.
 */
const ANNUITY_STARTS = [
  ['not_started', 'not_started'],
  ['not_started', 'started'],
  ['started', 'not_started'],
];

function caseFor({ monthly, horizon, ytd, salary, isaKind, prior, youth, starts }) {
  const [annuityStart, pensionStart] = starts ?? ANNUITY_STARTS[0];
  const [annuityYtd, pensionYtd] = ytd;
  const [isaType, isaExists] = isaKind;
  const [declaredYouth, birthDate] = youth;
  const key = [
    `m${monthly}`,
    horizon,
    `ytd${annuityYtd}/${pensionYtd}`,
    `sal${salary}`,
    `isa${isaType ?? 'none'}`,
    `cap${prior.state}${prior.determined_tax_krw ?? ''}`,
    `youth${declaredYouth ?? 'null'}`,
    `start${annuityStart}/${pensionStart}`,
  ].join('|');

  return {
    key,
    request: baseRequest({
      scenarios: ['current', 'proposed'],
      profile: {
        monthly_capacity_krw: monthly,
        fund_use_horizon: horizon,
        current_year_total_salary_krw: salary,
        prior_year_total_salary_krw: salary,
        prior_year_tax: prior,
        declared_youth: declaredYouth,
        birth_date: birthDate,
      },
      accounts: {
        annuity_savings: {
          ytd_contribution_krw: annuityYtd,
          annuity_start_status: annuityStart,
        },
        retirement_pension: {
          ytd_contribution_krw: pensionYtd,
          annuity_start_status: pensionStart,
        },
        isa: {
          exists: isaExists,
          account_type: isaType,
          years_since_opening: isaExists ? 1 : 0,
        },
      },
    }),
  };
}

/**
 * 얼려 둘 입력 좌표. 두 덩어리다.
 *
 *  A. 예산 × 자금 사용 시점 × 기존 납입액 — 배분이 갈리는 축을 전부 돈다.
 *  B. 소득 × ISA 유형 × 세액 한도 × 청년 — 공제액이 갈리는 축을, 예산 셋에서 돈다.
 *
 * 전체 곱집합을 돌지 않는 것은 의도다. 표가 커지면 아무도 읽지 않고, 읽히지 않는
 * 표는 깨졌을 때 무엇이 깨졌는지를 말해 주지 못한다.
 */
export function freezeCases() {
  const out = [];
  const seen = new Set();
  const push = (spec) => {
    const built = caseFor({ starts: ANNUITY_STARTS[0], ...spec });
    if (seen.has(built.key)) return;
    seen.add(built.key);
    out.push(built);
  };

  for (const monthly of MONTHLY) {
    for (const horizon of HORIZONS) {
      for (const ytd of YTD) {
        push({
          monthly,
          horizon,
          ytd,
          salary: SALARIES[1],
          isaKind: ISA_KINDS[0],
          prior: PRIORS[0],
          youth: YOUTHS[0],
        });
      }
    }
  }

  for (const monthly of [500_000, 1_500_000, 5_000_000]) {
    for (const salary of SALARIES) {
      for (const isaKind of ISA_KINDS) {
        for (const prior of PRIORS) {
          for (const youth of YOUTHS) {
            push({
              monthly,
              horizon: HORIZONS[0],
              ytd: YTD[0],
              salary,
              isaKind,
              prior,
              youth,
            });
          }
        }
      }
    }
  }

  // C. 한쪽 연금계좌가 막힌 상태 — **단독 공제한도가 실제로 묶는 유일한 자리다.**
  //    예산을 넓게 돌아 3단계 몫의 크기가 달라지는 구간을 전부 지난다.
  for (const starts of ANNUITY_STARTS.slice(1)) {
    for (const monthly of MONTHLY) {
      for (const ytd of YTD) {
        push({
          monthly,
          horizon: HORIZONS[0],
          ytd,
          salary: SALARIES[1],
          isaKind: ISA_KINDS[0],
          prior: PRIORS[0],
          youth: YOUTHS[0],
          starts,
        });
      }
    }
  }

  return out;
}

/**
 * 변경 **전**의 기본안 값. 한 행이
 * `[key, 확정 시나리오 일곱 값, 개정안 시나리오 일곱 값]`이고 일곱 값의 순서는
 * `[plan_id, 소득세, 지방세, 합계, 자르기 전 합계, 인정 납입액, ISA 배분액]`이다.
 *
 * **ISA 배분액이 함께 얼어 있는 것이 중요하다.** 3단계 몫이 ISA보다 앞에 끼어들면
 * 공제액은 그대로여도 ISA 배분이 줄어든다 — 소유자가 순서를 못 박은 바로 그 지점이고,
 * 공제액만 얼려 두면 그 뒤집힘이 이 표를 그냥 통과한다.
 */
export const BASELINE_CREDIT_FREEZE = [
  ['m0|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,0,0,0], ["max_tax_credit",0,0,0,0,0,0]],
  ['m0|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m0|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,0], ["isa_first",0,0,0,0,0,0]],
  ['m0|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,0], ["isa_first",720000,72000,792000,792000,6000000,0]],
  ['m0|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,0], ["isa_first",360000,36000,396000,396000,3000000,0]],
  ['m0|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,0], ["isa_first",720000,72000,792000,792000,6000000,0]],
  ['m0|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,0,0,0], ["max_tax_credit",0,0,0,0,0,0]],
  ['m0|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m0|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,0,0,0], ["max_tax_credit",0,0,0,0,0,0]],
  ['m0|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m0|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m100000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",144000,14400,158400,158400,1200000,0], ["max_tax_credit",144000,14400,158400,158400,1200000,0]],
  ['m100000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m100000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",504000,50400,554400,554400,4200000,0], ["max_tax_credit",504000,50400,554400,554400,4200000,0]],
  ['m100000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m100000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,1200000], ["isa_first",0,0,0,0,0,1200000]],
  ['m100000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,1200000], ["isa_first",720000,72000,792000,792000,6000000,1200000]],
  ['m100000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,1200000], ["isa_first",360000,36000,396000,396000,3000000,1200000]],
  ['m100000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,1200000], ["isa_first",720000,72000,792000,792000,6000000,1200000]],
  ['m100000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",144000,14400,158400,158400,1200000,0], ["max_tax_credit",144000,14400,158400,158400,1200000,0]],
  ['m100000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m100000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",504000,50400,554400,554400,4200000,0], ["max_tax_credit",504000,50400,554400,554400,4200000,0]],
  ['m100000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m100000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",144000,14400,158400,158400,1200000,0], ["max_tax_credit",144000,14400,158400,158400,1200000,0]],
  ['m100000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m100000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",504000,50400,554400,554400,4200000,0], ["max_tax_credit",504000,50400,554400,554400,4200000,0]],
  ['m100000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m250000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m250000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m250000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m250000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m250000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,3000000], ["isa_first",0,0,0,0,0,3000000]],
  ['m250000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,3000000], ["isa_first",720000,72000,792000,792000,6000000,3000000]],
  ['m250000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,3000000], ["isa_first",360000,36000,396000,396000,3000000,3000000]],
  ['m250000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,3000000], ["isa_first",720000,72000,792000,792000,6000000,3000000]],
  ['m250000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m250000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m250000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m250000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m250000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m250000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m250000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m250000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m500000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m500000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,6000000], ["isa_first",0,0,0,0,0,6000000]],
  ['m500000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,6000000], ["isa_first",720000,72000,792000,792000,6000000,6000000]],
  ['m500000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,6000000], ["isa_first",360000,36000,396000,396000,3000000,6000000]],
  ['m500000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,6000000], ["isa_first",720000,72000,792000,792000,6000000,6000000]],
  ['m500000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m500000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m500000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m500000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m750000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m750000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m750000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,9000000], ["isa_first",0,0,0,0,0,9000000]],
  ['m750000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,9000000], ["isa_first",720000,72000,792000,792000,6000000,9000000]],
  ['m750000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,9000000], ["isa_first",360000,36000,396000,396000,3000000,9000000]],
  ['m750000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,9000000], ["isa_first",720000,72000,792000,792000,6000000,9000000]],
  ['m750000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m750000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m750000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m750000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m750000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m750000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m1000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1000000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,12000000], ["isa_first",0,0,0,0,0,12000000]],
  ['m1000000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,12000000], ["isa_first",720000,72000,792000,792000,6000000,12000000]],
  ['m1000000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,12000000], ["isa_first",360000,36000,396000,396000,3000000,12000000]],
  ['m1000000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,12000000], ["isa_first",720000,72000,792000,792000,6000000,12000000]],
  ['m1000000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m1000000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1000000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1000000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m1000000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1000000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m1500000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000]],
  ['m1500000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m1500000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,18000000], ["isa_first",0,0,0,0,0,18000000]],
  ['m1500000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,18000000], ["isa_first",720000,72000,792000,792000,6000000,18000000]],
  ['m1500000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,18000000], ["isa_first",360000,36000,396000,396000,3000000,18000000]],
  ['m1500000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,18000000], ["isa_first",720000,72000,792000,792000,6000000,18000000]],
  ['m1500000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m1500000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000]],
  ['m1500000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m1500000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m1500000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000]],
  ['m1500000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000]],
  ['m2000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,24000000], ["isa_first",480000,48000,528000,528000,4000000,20000000]],
  ['m2000000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,24000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,24000000], ["isa_first",840000,84000,924000,924000,7000000,20000000]],
  ['m2000000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,24000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000]],
  ['m2000000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000]],
  ['m2000000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,27000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,30000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",0,0,0,0,0,36000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,36000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",360000,36000,396000,396000,3000000,36000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",720000,72000,792000,792000,6000000,36000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,27000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,30000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,27000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,30000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|before_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|before_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|before_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|before_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["isa_first",1080000,108000,1188000,1188000,9000000,40000000], ["isa_first",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|within_isa_lock_in|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|within_isa_lock_in|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|within_isa_lock_in|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|within_isa_lock_in|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|unknown|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|unknown|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|unknown|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|unknown|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",900000,90000,990000,990000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",900000,90000,990000,990000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,990000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,990000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,990000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,990000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",900000,90000,990000,990000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",900000,90000,990000,990000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,990000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,990000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,990000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,990000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",900000,90000,990000,990000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",900000,90000,990000,990000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,990000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,990000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,990000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,990000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,792000,6000000,0], ["max_tax_credit",300000,30000,330000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,792000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,792000,6000000,0], ["max_tax_credit",0,0,0,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,792000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,792000,6000000,0], ["max_tax_credit",300000,30000,330000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,792000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,792000,6000000,0], ["max_tax_credit",0,0,0,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,792000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",900000,90000,990000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,792000,6000000,0], ["max_tax_credit",300000,30000,330000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,792000,6000000,0], ["max_tax_credit",300000,30000,330000,990000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,792000,6000000,0], ["max_tax_credit",0,0,0,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,792000,6000000,0], ["max_tax_credit",0,0,0,990000,6000000,0]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,9000000], ["max_tax_credit",0,0,0,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,9000000], ["max_tax_credit",0,0,0,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,9000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,9000000], ["max_tax_credit",0,0,0,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,9000000], ["max_tax_credit",0,0,0,1485000,9000000,9000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,40000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,40000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,40000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isageneral|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,40000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,40000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,40000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,40000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isalow_income|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,40000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,20000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal40000000|isanone|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1485000,9000000,20000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,40000000], ["max_tax_credit",0,0,0,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,40000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,40000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,40000000], ["max_tax_credit",0,0,0,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isalow_income|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,40000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount5000000|youthnull|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount5000000|youthtrue|startnot_started/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000], ["max_tax_credit",1350000,135000,1485000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount300000|youthnull|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,20000000], ["max_tax_credit",300000,30000,330000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capamount300000|youthtrue|startnot_started/not_started', ["max_tax_credit",300000,30000,330000,1188000,9000000,20000000], ["max_tax_credit",300000,30000,330000,1485000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capzero|youthnull|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,20000000], ["max_tax_credit",0,0,0,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isanone|capzero|youthtrue|startnot_started/not_started', ["max_tax_credit",0,0,0,1188000,9000000,20000000], ["max_tax_credit",0,0,0,1485000,9000000,20000000]],
  ['m0|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",0,0,0,0,0,0], ["max_tax_credit",0,0,0,0,0,0]],
  ['m0|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m0|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m100000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",144000,14400,158400,158400,1200000,0], ["max_tax_credit",144000,14400,158400,158400,1200000,0]],
  ['m100000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,1200000], ["max_tax_credit",720000,72000,792000,792000,6000000,1200000]],
  ['m100000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",504000,50400,554400,554400,4200000,0], ["max_tax_credit",504000,50400,554400,554400,4200000,0]],
  ['m100000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m250000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m250000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,3000000], ["max_tax_credit",720000,72000,792000,792000,6000000,3000000]],
  ['m250000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m250000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,6000000], ["max_tax_credit",720000,72000,792000,792000,6000000,6000000]],
  ['m500000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,3000000], ["max_tax_credit",720000,72000,792000,792000,6000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,9000000], ["max_tax_credit",720000,72000,792000,792000,6000000,9000000]],
  ['m750000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,6000000], ["max_tax_credit",720000,72000,792000,792000,6000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,12000000], ["max_tax_credit",720000,72000,792000,792000,6000000,12000000]],
  ['m1000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,12000000], ["max_tax_credit",720000,72000,792000,792000,6000000,12000000]],
  ['m1500000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,18000000], ["max_tax_credit",720000,72000,792000,792000,6000000,18000000]],
  ['m1500000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000]],
  ['m1500000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,18000000], ["max_tax_credit",720000,72000,792000,792000,6000000,18000000]],
  ['m2000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,24000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m2000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000]],
  ['m2000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,30000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,36000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,30000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,40000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,40000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,40000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",720000,72000,792000,792000,6000000,40000000], ["max_tax_credit",720000,72000,792000,792000,6000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startnot_started/started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m0|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",0,0,0,0,0,0], ["max_tax_credit",0,0,0,0,0,0]],
  ['m0|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m0|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m0|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m100000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",144000,14400,158400,158400,1200000,0], ["max_tax_credit",144000,14400,158400,158400,1200000,0]],
  ['m100000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m100000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",504000,50400,554400,554400,4200000,0], ["max_tax_credit",504000,50400,554400,554400,4200000,0]],
  ['m100000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",864000,86400,950400,950400,7200000,0], ["max_tax_credit",864000,86400,950400,950400,7200000,0]],
  ['m250000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",360000,36000,396000,396000,3000000,0], ["max_tax_credit",360000,36000,396000,396000,3000000,0]],
  ['m250000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m250000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m250000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",720000,72000,792000,792000,6000000,0], ["max_tax_credit",720000,72000,792000,792000,6000000,0]],
  ['m500000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m500000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m500000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,0]],
  ['m750000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m750000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m750000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,3000000]],
  ['m1000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,6000000]],
  ['m1000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,9000000]],
  ['m1500000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m1500000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,12000000]],
  ['m1500000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,15000000]],
  ['m2000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m2000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,18000000]],
  ['m2000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,21000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,27000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,30000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m3000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,33000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m5000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd0/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd6000000/0|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd0/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
  ['m10000000|at_or_after_pension_age|ytd3000000/3000000|sal60000000|isageneral|capamount5000000|youthnull|startstarted/not_started', ["max_tax_credit",1080000,108000,1188000,1188000,9000000,40000000], ["max_tax_credit",1080000,108000,1188000,1188000,9000000,20000000]],
];
