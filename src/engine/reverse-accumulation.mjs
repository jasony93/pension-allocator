// 적립기 역산(블록 2) — 「필요 개시 평가액」에서 「월 납입액」으로 되돌아간다.
//
// **이 블록은 사용자가 준 수익률 위에 통째로 서 있다.** 그래서 수익률이 없으면 이 블록이
// **없다**(0으로 계산하지 않는다 — D77). 그 판정은 진입점이 하고, 이 파일은 수익률을
// 받았을 때의 산술만 안다.
//
// **복리는 월 복리로 통일한다.** 세법이 복리·단리도, 복리 주기도 정하지 않는다. 납입이
// 월 단위이므로 이자 계산 주기도 월로 맞추는 것이 관행이고, 그 관행이 계약 문서에 적혀
// 있다. **부동소수점을 쓰지 않는다** — `(1 + r/12)^N`을 정확한 분수의 거듭제곱으로 낸다.
//
// **세법 수치가 이 파일에 없다.** 납입 한도·공제 한도·ISA 연간 한도는 전부 `rules`에서
// 오고, 여기 있는 숫자는 개월수(12)와 배열 첨자뿐이다. 12는 「1년이 12개월」이라는 달력의
// 사실이지 세법이 정한 값이 아니다.

import {
  EXACT_ZERO,
  addExact,
  cmpExact,
  divExact,
  exactOf,
  mulExact,
  subExact,
} from './exact.mjs';
import { ceilExactToWon, powExact } from './reverse-exact.mjs';
import { toRatio } from './ratio.mjs';
import { ACCOUNT, MONTHS_IN_TAX_YEAR, RULE } from './constants.mjs';

/** 월 이율 i = r ÷ 12 를 정확값으로. 읽을 수 없으면 `null`. */
function monthlyRate(annualReturnRate) {
  const ratio = toRatio(annualReturnRate);
  if (ratio === null) return null;
  return { n: BigInt(ratio.num), d: BigInt(ratio.den) * BigInt(MONTHS_IN_TAX_YEAR) };
}

/** (1 + i)^N. */
function growthFactor(rate, months) {
  const one = exactOf(1);
  return powExact(addExact(one, rate), months);
}

/**
 * 월 납입 m을 N개월 넣었을 때의 개시 시점 평가액(현재 잔액과 개시 시점 일시금 포함).
 *
 * 시험이 역산값의 **최소성**을 확인할 때 쓴다 — 역산은 「닿는가」로 검산해야 한다.
 */
export function futureValueOfMonthlyPlan(
  rules,
  { monthlyKrw, currentBalanceKrw, lumpSumAtStartKrw, annualReturnRate, months },
) {
  void rules;
  const rate = monthlyRate(annualReturnRate);
  if (rate === null || !Number.isSafeInteger(months) || months <= 0) return null;

  const base = addExact(compoundedBalance(currentBalanceKrw, rate, months), exactOf(lumpSumAtStartKrw));
  const contributions = annuityFactor(rate, months);
  if (contributions === null) return null;

  const total = addExact(base, mulExact(exactOf(monthlyKrw), contributions));
  // BigInt 나눗셈으로 내림한다. 목표가 정수 원이므로 내림 비교가 정확한 비교와 같다.
  return Number(total.n / total.d);
}

function compoundedBalance(balanceKrw, rate, months) {
  return mulExact(exactOf(balanceKrw), growthFactor(rate, months));
}

/** ((1+i)^N − 1) ÷ i. i가 0이면 N이다(극한이 아니라 정의상 그렇다). */
function annuityFactor(rate, months) {
  if (cmpExact(rate, EXACT_ZERO) === 0) return exactOf(months);
  const grown = growthFactor(rate, months);
  return divExact(subExact(grown, exactOf(1)), rate);
}

/**
 * 목표 개시 평가액에 닿기 위한 **최소** 월 납입액.
 *
 * 원 미만을 **올린다** — 버리면 그 값을 따른 사용자가 목표에 못 닿는다(`reverse-exact.mjs`).
 * 그래서 이 함수가 내는 값은 「닿는 가장 작은 정수」이고, 시험이 그 최소성을 문다.
 */
export function requiredMonthlyContribution(
  rules,
  { targetKrw, currentBalanceKrw, lumpSumAtStartKrw, annualReturnRate, months },
) {
  void rules;
  const rate = monthlyRate(annualReturnRate);
  if (rate === null || !Number.isSafeInteger(months) || months <= 0) return null;

  const grownBalance = compoundedBalance(currentBalanceKrw, rate, months);
  const available = addExact(grownBalance, exactOf(lumpSumAtStartKrw));
  const gap = subExact(exactOf(targetKrw), available);

  const futureValueOfExisting = ceilExactToWon(grownBalance);
  const gapKrw = ceilExactToWon(gap);

  if (cmpExact(gap, EXACT_ZERO) <= 0) {
    return {
      monthly_krw: 0,
      future_value_of_existing_krw: futureValueOfExisting,
      gap_krw: gapKrw,
      already_funded: true,
    };
  }

  const factor = annuityFactor(rate, months);
  if (factor === null) return null;

  return {
    monthly_krw: ceilExactToWon(divExact(gap, factor)),
    future_value_of_existing_krw: futureValueOfExisting,
    gap_krw: gapKrw,
    already_funded: false,
  };
}

// ── 법정 상한과 계좌 배분 ───────────────────────────────────────────────

const perMonth = (annualKrw) => Math.floor(annualKrw / MONTHS_IN_TAX_YEAR);

/**
 * ISA 그 해의 납입 한도. **연 2,000만원을 상수로 쓰면 안 된다** — 경과연수의 함수이고
 * 총 납입한도에서 멈춘다(룰셋 `engine_note`·`cap_behavior`).
 *
 * 경과연수의 상한(4년)을 산식 문자열에서 다시 꺼내지 않고 **총 납입한도와의 최솟값**으로
 * 같은 값을 낸다 — 룰셋이 `cap_behavior`로 두 값이 정확히 맞물린다고 적어 두었다.
 */
function isaAnnualLimit(rules, { isaYearsSinceOpening, isaCumulativeKrw }) {
  const tenure = isaYearsSinceOpening ?? 0;
  const used = isaCumulativeKrw ?? 0;
  const accrued = rules.isaBaseAmountKrw * (1 + tenure);
  const ceiling = Math.min(accrued, rules.isaTotalLimitKrw);
  return Math.max(0, ceiling - used);
}

/** 세 계좌의 월 납입 상한. 연 한도를 12로 나눠 버린 값이라 그 곱이 연 한도를 넘지 않는다. */
export function monthlyContributionCeilings(rules, { isaYearsSinceOpening, isaCumulativeKrw }) {
  const pensionPool = perMonth(rules.pensionContributionLimitKrw);
  const isa = perMonth(isaAnnualLimit(rules, { isaYearsSinceOpening, isaCumulativeKrw }));
  return {
    pension_pool_monthly_krw: pensionPool,
    pension_pool_annual_krw: rules.pensionContributionLimitKrw,
    isa_monthly_krw: isa,
    isa_annual_krw: isaAnnualLimit(rules, { isaYearsSinceOpening, isaCumulativeKrw }),
    total_monthly_krw: pensionPool + isa,
  };
}

/**
 * **어느 계좌에 얼마씩인가, 그리고 그 근거가 무엇인가.**
 *
 * 순서는 넷이고 근거가 전부 룰셋에 있다.
 *  1. **연금저축 — 단독 공제 한도까지.** 그 한도가 연금저축을 이름으로 지목하고,
 *     이 계좌는 중도인출 제약을 받지 않는다.
 *  2. **IRP — 합산 공제 한도의 잔여까지.** 합산 한도(900만)가 단독 한도(600만)보다 크므로
 *     그 차이는 **IRP가 아니면 채울 수 없다.**
 *  3. **연금저축 — 남은 납입 한도까지.** 이 몫은 공제를 낳지 않으므로, 얻는 것이 없는데
 *     중도인출만 묶이는 계좌에 넣지 않는다(`pension.withdrawal.midterm_restriction`).
 *  4. **ISA — 그 해의 한도까지.**
 *
 * **계좌를 나누는 것이 1,500만원 문턱을 바꾸지 않는다.** 문턱은 사람 단위 합계이고
 * (`per_person_not_per_account`), 우회 가능한 것은 계좌가 아니라 재원이다. 이 순서가
 * 주장하는 것은 그것이 아니라 **공제 한도의 계좌별 구조와 중도인출 제약**뿐이다.
 */
export function allocateMonthlyContribution(
  rules,
  { requiredMonthlyKrw, isaYearsSinceOpening, isaCumulativeKrw },
) {
  const ceilings = monthlyContributionCeilings(rules, { isaYearsSinceOpening, isaCumulativeKrw });
  const annuityCreditMonthly = perMonth(rules.annuityCreditLimitKrw);
  const combinedCreditMonthly = perMonth(rules.combinedCreditLimitKrw);

  const state = { [ACCOUNT.ANNUITY]: 0, [ACCOUNT.PENSION]: 0, [ACCOUNT.ISA]: 0 };
  const order = { [ACCOUNT.ANNUITY]: null, [ACCOUNT.PENSION]: null, [ACCOUNT.ISA]: null };

  let remaining = Math.max(0, requiredMonthlyKrw);
  let step = 0;

  const place = (account, room) => {
    const amount = Math.max(0, Math.min(remaining, room));
    if (amount > 0) {
      step += 1;
      if (order[account] === null) order[account] = step;
      state[account] += amount;
      remaining -= amount;
    }
    return amount;
  };

  // 1 — 연금저축, 단독 공제 한도까지 (납입 한도 풀 안에서)
  const stage1 = place(ACCOUNT.ANNUITY, Math.min(annuityCreditMonthly, ceilings.pension_pool_monthly_krw));
  // 2 — IRP, 합산 공제 한도의 잔여까지 (같은 풀 안에서)
  const irpRoom = Math.min(
    Math.max(0, combinedCreditMonthly - stage1),
    ceilings.pension_pool_monthly_krw - stage1,
  );
  place(ACCOUNT.PENSION, irpRoom);
  // 3 — 연금저축, 남은 납입 한도까지
  place(
    ACCOUNT.ANNUITY,
    ceilings.pension_pool_monthly_krw - state[ACCOUNT.ANNUITY] - state[ACCOUNT.PENSION],
  );
  // 4 — ISA, 그 해의 한도까지
  place(ACCOUNT.ISA, ceilings.isa_monthly_krw);

  const rooms = {
    [ACCOUNT.ANNUITY]: ceilings.pension_pool_monthly_krw - state[ACCOUNT.PENSION],
    [ACCOUNT.PENSION]: irpRoom,
    [ACCOUNT.ISA]: ceilings.isa_monthly_krw,
  };
  const allocated = state[ACCOUNT.ANNUITY] + state[ACCOUNT.PENSION] + state[ACCOUNT.ISA];

  const build = (account, basisRuleIds) => ({
    account,
    monthly_krw: state[account],
    annual_krw: state[account] * MONTHS_IN_TAX_YEAR,
    room_monthly_krw: rooms[account],
    fill_order: order[account],
    limited_by: limitedByOf(state[account], rooms[account], remaining),
    basis_rule_ids: [...basisRuleIds].sort(),
  });

  return {
    ceilings,
    allocations: [
      build(ACCOUNT.ANNUITY, [
        RULE.CREDIT_LIMIT_ANNUITY,
        RULE.PENSION_CONTRIBUTION_LIMIT,
        RULE.PENSION_MIDTERM_RESTRICTION,
      ]),
      build(ACCOUNT.PENSION, [
        RULE.CREDIT_LIMIT_COMBINED,
        RULE.PENSION_CONTRIBUTION_LIMIT,
        RULE.PENSION_MIDTERM_RESTRICTION,
      ]),
      build(ACCOUNT.ISA, [RULE.ISA_ANNUAL_LIMIT, RULE.ISA_ACCOUNT_REQUIREMENTS]),
    ],
    allocated_monthly_total_krw: allocated,
    unallocatable_monthly_krw: remaining,
    exceeds_statutory_ceiling: remaining > 0,
  };
}

/**
 * 그 계좌에서 멈춘 이유. **「한도가 막았다」는 실제로 더 넣을 것이 남았을 때만 참이다** —
 * 필요액을 다 채우고 멈춘 것을 한도 탓으로 적으면 사용자가 없는 벽을 본다.
 */
function limitedByOf(amount, room, remaining) {
  if (amount === 0) return 'not_needed';
  if (amount >= room && remaining > 0) return 'contribution_limit';
  return 'required_amount_met';
}
