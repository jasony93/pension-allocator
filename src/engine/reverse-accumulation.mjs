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
import {
  ACCOUNT,
  MONTHS_IN_TAX_YEAR,
  REVERSE_FILL_BASIS,
  REVERSE_FILL_ORDER_VARIANT,
  RULE,
} from './constants.mjs';

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
  { monthlyKrw, currentBalanceKrw, isaBalanceKrw = 0, lumpSumAtStartKrw, annualReturnRate, months },
) {
  void rules;
  const rate = monthlyRate(annualReturnRate);
  if (rate === null || !Number.isSafeInteger(months) || months <= 0) return null;

  const base = addExact(
    compoundedBalance(currentBalanceKrw + isaBalanceKrw, rate, months),
    exactOf(lumpSumAtStartKrw),
  );
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
  { targetKrw, currentBalanceKrw, isaBalanceKrw = 0, lumpSumAtStartKrw, annualReturnRate, months },
) {
  void rules;
  const rate = monthlyRate(annualReturnRate);
  if (rate === null || !Number.isSafeInteger(months) || months <= 0) return null;

  const grownBalance = compoundedBalance(currentBalanceKrw, rate, months);
  // **개시 시점에 연금계좌로 전환되는 ISA 잔액**(D78 ④). 부르는 쪽이 전환을 「예」로 읽었을
  // 때만 0이 아니다 — 이 함수는 그 판정을 하지 않고 받은 금액을 불릴 뿐이다.
  const grownIsa = compoundedBalance(isaBalanceKrw, rate, months);
  const available = addExact(addExact(grownBalance, grownIsa), exactOf(lumpSumAtStartKrw));
  const gap = subExact(exactOf(targetKrw), available);

  const futureValueOfExisting = ceilExactToWon(grownBalance);
  const futureValueOfIsa = ceilExactToWon(grownIsa);
  const gapKrw = ceilExactToWon(gap);

  if (cmpExact(gap, EXACT_ZERO) <= 0) {
    return {
      monthly_krw: 0,
      future_value_of_existing_krw: futureValueOfExisting,
      future_value_of_existing_isa_krw: futureValueOfIsa,
      gap_krw: gapKrw,
      already_funded: true,
    };
  }

  const factor = annuityFactor(rate, months);
  if (factor === null) return null;

  return {
    monthly_krw: ceilExactToWon(divExact(gap, factor)),
    future_value_of_existing_krw: futureValueOfExisting,
    future_value_of_existing_isa_krw: futureValueOfIsa,
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

/** 총 납입한도의 **잔여**. 누적 납입액을 모르면 0으로 보고(한도를 크게 잡는 방향) 뺀다. */
function isaRemainingTotalLimit(rules, { isaCumulativeKrw }) {
  return Math.max(0, rules.isaTotalLimitKrw - (isaCumulativeKrw ?? 0));
}

/**
 * **ISA를 개시 재원으로 쓸 때 그 계좌에 앉힐 수 있는 월 몫**(D78 ④).
 *
 * 두 한도가 함께 문다.
 *  · **그 해의 납입 한도** — 경과연수의 함수(위 `isaAnnualLimit`)를 12로 나눈 값.
 *  · **총 납입한도의 잔여** — 적립기 전체에 걸쳐 넣는 총액이 잔여를 넘을 수 없다. 그래서
 *    잔여를 **적립 개월수로 나눈다.** 이 나눗셈은 조문이 정한 것이 아니라 균등 납입을
 *    보는 이 탭의 관행이고, 가정 코드로 응답에 실린다.
 *
 * **작은 쪽이 답이다.** 적립기가 열두 달을 넘으면 대개 총 납입한도 쪽이 물고, 잔여가
 * 0이면 몫도 0이다 — 「ISA에 넣을 수 있는 것이 없다」가 그 자리의 사실이다.
 */
export function isaSourceMonthlyCap(
  rules,
  { isaYearsSinceOpening, isaCumulativeKrw, accumulationMonths },
) {
  const annualRoomMonthly = perMonth(isaAnnualLimit(rules, { isaYearsSinceOpening, isaCumulativeKrw }));
  const remainingTotal = isaRemainingTotalLimit(rules, { isaCumulativeKrw });
  const usableMonths = Number.isSafeInteger(accumulationMonths) && accumulationMonths > 0 ? accumulationMonths : null;
  const totalRoomMonthly = usableMonths === null ? annualRoomMonthly : Math.floor(remainingTotal / usableMonths);

  return {
    monthly_krw: Math.min(annualRoomMonthly, totalRoomMonthly),
    annual_limit_monthly_krw: annualRoomMonthly,
    total_limit_monthly_krw: totalRoomMonthly,
    remaining_total_limit_krw: remainingTotal,
    // **「총 납입한도가 정했다」는 그것이 실제로 작거나 같을 때만 참이다.**
    capped_by_total_contribution_limit: totalRoomMonthly <= annualRoomMonthly,
  };
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
 * **어느 계좌에 얼마씩인가, 그리고 그 몫이 그 자리에 놓인 근거가 무엇인가.**
 *
 * **세법이 이 순서를 정하지 않는다.** 조문이 정하는 것은 각 한도의 크기와 **소멸 여부**이고,
 * 순서는 그 위에 선 제품 결정이다(`tax-rules-report.md` 32.5절·32.6절 1번). 그러므로 아래
 * 각 단계가 주장하는 것은 「법이 그렇게 하라고 했다」가 아니라 **「조문이 고정한 사실 하나가
 * 이 방향을 지지한다」**뿐이다.
 *
 * 단계는 셋이다.
 *  1. **연금계좌 — 세액공제 한도까지**(연금저축 단독 한도 → IRP로 합산 한도의 잔여).
 *     근거는 공제율이 아니라 **소멸성**이다 — 미사용 공제 한도를 다음 해로 나르는 규정이
 *     **없어** 그 해에 사라지는 반면, ISA 연 한도는 경과연수 산식이 이월시킨다(32.2절).
 *     **소멸하는 자원을 먼저 쓴다.**
 *  2. **ISA — 전환 재원일 때만 이 자리에.** 전환 경로에서만 §59조의3③④의 **추가한도**가
 *     열리고(전환금액의 10%·최대 300만원), 연금계좌 초과 납입에는 그 자리가 열리지 않는다.
 *     **이것이 2·3단계의 상대 순서를 가르는 유일한 방향 근거다**(32.4절).
 *  3. **연금계좌 나머지 — 연 납입 한도까지.** 그 해의 **세액공제를 낳지 않는다.** 다만
 *     「혜택이 없다」는 거짓이다(32.3절) — 과세이연과 **인출 시 원금 비과세**가 남는다.
 *
 * **전환 근거가 서지 않으면 2와 3이 뒤집힌다.** 전환 계획이 「아니오」·미응답이거나 개시
 * 시점에 의무가입기간이 안 차면 32.4절의 근거가 사라지고, 그때 ISA를 앞세우면 **조문에 없는
 * 이득을 계산에 넣는 것**이 된다. 이 함수에서 그 조건은 `isaSource`가 진다 — **재원인 자리와
 * 근거가 서는 자리가 같은 조건**이기 때문이다(둘 다 「전환 계획 ∧ 개시 시점 경과연수」).
 *
 * **계좌를 나누는 것이 1,500만원 문턱을 바꾸지 않는다.** 문턱은 사람 단위 합계이고
 * (`per_person_not_per_account`), 우회 가능한 것은 계좌가 아니라 재원이다. **그리고 그 축은
 * 순서를 가르지 못한다** — 연금계좌 초과 납입분도 미공제 원금이라 문턱을 쓰지 않는다(32.4절).
 *
 * `isaSource`가 `null`이면 ISA는 재원이 아니라 방이 0이고 순서도 뒤다. **키를 아예 주지
 * 않으면 그 해 한도가 방이고 자리는 뒤다** — 재원 여부의 판정은 이 산술 함수가 아니라
 * 진입점이 지며, 그때는 근거 코드도 서지 않는다(`basis_code: null`).
 */
export function allocateMonthlyContribution(
  rules,
  { requiredMonthlyKrw, isaYearsSinceOpening, isaCumulativeKrw, isaSource },
) {
  const ceilings = monthlyContributionCeilings(rules, { isaYearsSinceOpening, isaCumulativeKrw });
  const isaIsSource = isaSource === undefined || isaSource !== null;
  const isaRoom = isaSource === undefined ? ceilings.isa_monthly_krw : (isaSource?.monthly_krw ?? 0);
  // **재원인 자리와 추가한도 근거가 서는 자리는 같은 조건이다**(32.4절).
  const isaFillsFirst = isaSource !== undefined && isaSource !== null;
  const annuityCreditMonthly = perMonth(rules.annuityCreditLimitKrw);
  const combinedCreditMonthly = perMonth(rules.combinedCreditLimitKrw);

  const state = { [ACCOUNT.ANNUITY]: 0, [ACCOUNT.PENSION]: 0, [ACCOUNT.ISA]: 0 };
  const order = { [ACCOUNT.ANNUITY]: null, [ACCOUNT.PENSION]: null, [ACCOUNT.ISA]: null };
  const steps = { [ACCOUNT.ANNUITY]: [], [ACCOUNT.PENSION]: [], [ACCOUNT.ISA]: [] };

  let remaining = Math.max(0, requiredMonthlyKrw);
  let step = 0;

  const place = (account, room, basisCode, basisRuleIds) => {
    const amount = Math.max(0, Math.min(remaining, room));
    if (amount > 0) {
      step += 1;
      if (order[account] === null) order[account] = step;
      state[account] += amount;
      remaining -= amount;
      steps[account].push({
        order: step,
        monthly_krw: amount,
        room_monthly_krw: Math.max(0, room),
        basis_code: basisCode,
        basis_rule_ids: [...basisRuleIds].sort(),
      });
    }
    return amount;
  };

  const CREDIT_BASIS_ANNUITY = [
    RULE.CREDIT_LIMIT_ANNUITY,
    RULE.CREDIT_UNUSED_CARRYOVER,
    RULE.PENSION_MIDTERM_RESTRICTION,
  ];
  const CREDIT_BASIS_IRP = [
    RULE.CREDIT_LIMIT_COMBINED,
    RULE.CREDIT_UNUSED_CARRYOVER,
    RULE.PENSION_MIDTERM_RESTRICTION,
  ];
  const SURPLUS_BASIS = [
    RULE.PENSION_CONTRIBUTION_LIMIT,
    RULE.PENSION_BEYOND_CREDIT_LIMIT,
    RULE.PENSION_NON_DEDUCTED_PRINCIPAL,
    RULE.PENSION_MIDTERM_RESTRICTION,
  ];
  // ISA 자리의 근거는 **전환 추가한도**다. 전환금액이 연 납입 한도를 잠식하지 않는다는
  // 사실(시행령 §40조의2②1의 병렬 구조)도 같은 자리에서 딛는다.
  const ISA_BASIS = [
    RULE.CREDIT_TRANSFER_EXTRA,
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    RULE.ISA_ANNUAL_LIMIT,
    RULE.PENSION_CONTRIBUTION_LIMIT,
  ];

  // 1 — 연금저축, 단독 공제 한도까지 (납입 한도 풀 안에서)
  const stage1 = place(
    ACCOUNT.ANNUITY,
    Math.min(annuityCreditMonthly, ceilings.pension_pool_monthly_krw),
    REVERSE_FILL_BASIS.CREDIT_LIMIT_EXPIRES,
    CREDIT_BASIS_ANNUITY,
  );
  // 1 — IRP, 합산 공제 한도의 잔여까지 (같은 풀 안에서)
  const irpRoom = Math.min(
    Math.max(0, combinedCreditMonthly - stage1),
    ceilings.pension_pool_monthly_krw - stage1,
  );
  place(ACCOUNT.PENSION, irpRoom, REVERSE_FILL_BASIS.CREDIT_LIMIT_EXPIRES, CREDIT_BASIS_IRP);

  const fillIsa = () =>
    place(
      ACCOUNT.ISA,
      isaRoom,
      isaFillsFirst ? REVERSE_FILL_BASIS.ISA_TRANSFER_EXTRA_LIMIT : null,
      isaFillsFirst ? ISA_BASIS : [RULE.ISA_ANNUAL_LIMIT, RULE.ISA_ACCOUNT_REQUIREMENTS],
    );
  const fillPensionSurplus = () =>
    place(
      ACCOUNT.ANNUITY,
      ceilings.pension_pool_monthly_krw - state[ACCOUNT.ANNUITY] - state[ACCOUNT.PENSION],
      REVERSE_FILL_BASIS.NO_CREDIT_THIS_YEAR,
      SURPLUS_BASIS,
    );

  if (isaFillsFirst) {
    fillIsa();
    fillPensionSurplus();
  } else {
    fillPensionSurplus();
    fillIsa();
  }

  const rooms = {
    [ACCOUNT.ANNUITY]: ceilings.pension_pool_monthly_krw - state[ACCOUNT.PENSION],
    [ACCOUNT.PENSION]: irpRoom,
    [ACCOUNT.ISA]: isaRoom,
  };
  const allocated = state[ACCOUNT.ANNUITY] + state[ACCOUNT.PENSION] + state[ACCOUNT.ISA];

  const build = (account, basisRuleIds) => ({
    account,
    monthly_krw: state[account],
    annual_krw: state[account] * MONTHS_IN_TAX_YEAR,
    room_monthly_krw: rooms[account],
    fill_order: order[account],
    // **한 계좌가 두 자리에서 채워질 수 있다**(연금저축은 1단계와 3단계 둘 다). 그래서
    // 근거를 행 하나에 접지 않고 **놓인 자리마다** 낸다 — 두 몫의 근거가 서로 다르다.
    fill_steps: steps[account],
    limited_by:
      account === ACCOUNT.ISA && !isaIsSource
        ? 'not_a_source'
        : limitedByOf(state[account], rooms[account], remaining),
    basis_rule_ids: unionSorted(steps[account], basisRuleIds),
  });

  return {
    ceilings,
    isa_is_source: isaIsSource,
    fill_order_variant_code: isaFillsFirst
      ? REVERSE_FILL_ORDER_VARIANT.ISA_FIRST
      : REVERSE_FILL_ORDER_VARIANT.PENSION_SURPLUS_FIRST,
    // **넘었는지를 재는 자는 「세 계좌 법정 상한」이 아니라 「재원으로 쓸 수 있는 상한」이다.**
    source_ceiling_monthly_krw: ceilings.pension_pool_monthly_krw + (isaIsSource ? isaRoom : 0),
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
 * 그 계좌의 근거 규칙 목록. **실제로 놓인 자리의 근거를 모으고**, 한 자리도 못 받은 계좌는
 * 그 계좌를 규율하는 한도 규칙을 낸다 — 0원에도 근거가 있어야 화면이 이유를 댈 수 있다.
 */
function unionSorted(placedSteps, fallbackRuleIds) {
  const ids = placedSteps.length === 0 ? [...fallbackRuleIds] : placedSteps.flatMap((s) => s.basis_rule_ids);
  return [...new Set(ids)].sort();
}

/**
 * 그 계좌에서 멈춘 이유. **「한도가 막았다」는 실제로 더 넣을 것이 남았을 때만 참이다** —
 * 필요액을 다 채우고 멈춘 것을 한도 탓으로 적으면 사용자가 없는 벽을 본다.
 *
 * **0원에도 두 가지가 있다**(D78 ④에서 드러났다). 필요액을 앞 계좌가 다 받아서 0인 것과,
 * **방이 0이라 한 원도 못 받은 것**은 다른 사실이다 — ISA 총 납입한도를 다 쓴 사람의
 * ISA 행이 후자다. 앉히지 못한 몫이 남아 있는데 0이면 그것은 한도가 막은 것이다.
 */
function limitedByOf(amount, room, remaining) {
  if (amount === 0) return remaining > 0 && room <= 0 ? 'contribution_limit' : 'not_needed';
  if (amount >= room && remaining > 0) return 'contribution_limit';
  return 'required_amount_met';
}
