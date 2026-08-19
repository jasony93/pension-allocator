// 연금수령한도(시행령 §40조의2③3·④)와 그 **역산**.
//
// **세법 수치가 이 파일에 없다.** 산식의 계수 둘(분모의 밑수와 120/100)은 `reverse-rules.mjs`가
// 룰셋의 산식에서 꺼내 `rules.cap`으로 넘긴다. 이 파일은 그 계수로 대수를 풀 뿐이다.
//
// **무성장이 이 파일의 전제다.** D77 판정 1이 「법정 한도 판정은 무성장 기준으로 고정하고
// 그 사실을 명시한다」로 정했고(층 4 금지), 룰셋의 `inverse_use.assumption_stated_once`가
// 같은 말을 한다. 그래서 이 파일은 수익률을 **인자로도 받지 않는다** — 받을 자리가 없으면
// 실수로 쓸 수도 없다.

import {
  addExact,
  cmpExact,
  divExact,
  exactOf,
  maxExact,
  mulExact,
  subExact,
} from './exact.mjs';
import { ceilExactToWon } from './reverse-exact.mjs';

/** 한도 산식의 비율 R = rateNum / rateDen 을 정확값으로. */
const capRate = (cap) => divExact(exactOf(cap.rateNum), exactOf(cap.rateDen));

/**
 * 그 해의 연금수령한도. **연차가 산식이 사라지는 마디 이상이면 `null`** —
 * 「한도가 0이다」가 아니라 「한도라는 것이 없다」이므로 0을 내지 않는다.
 */
export function annualWithdrawalCap(rules, { balanceKrw, withdrawalYearIndex }) {
  const { cap, rounding } = rules;
  if (!Number.isSafeInteger(withdrawalYearIndex) || withdrawalYearIndex < 1) return null;
  if (withdrawalYearIndex >= cap.ceasesAtYearIndex) return null;

  const balance = exactOf(balanceKrw);
  const denominator = exactOf(cap.base - withdrawalYearIndex);
  const scaled = mulExact(balance, capRate(cap));
  return rounding.display(divExact(scaled, denominator));
}

/**
 * k년차의 제약이 요구하는 개시 시점 평가액의 하한을 W의 배수로 낸다.
 *
 * 유도 — k년차 제약은 `W ≤ (V₀ − (k−1)W) × R ÷ (B−k)` 이고, V₀에 대해 풀면
 * `V₀ ≥ W × [(B−k) ÷ R + (k−1)]` 이다. **k에 대해 증가하므로 가장 센 것은 마지막 해다.**
 * 이 유도는 룰셋 `inverse_use.n_year_floor.derivation`이 적어 둔 것과 같고,
 * 계수는 여기서 만들지 않고 산식의 B·R에서 나온다.
 */
function multiplierAtYear(cap, yearIndex) {
  const rate = capRate(cap);
  const head = divExact(exactOf(cap.base - yearIndex), rate);
  return addExact(head, exactOf(yearIndex - 1));
}

/**
 * 목표 연 수령액을 **전부 연금수령으로** 받으려면 개시 시점에 최소 얼마가 있어야 하는가.
 *
 * 두 제약을 함께 본다.
 *  · **한도** — 위 `multiplierAtYear`의 최댓값. 산식이 사라지는 마디 뒤에는 제약이 없으므로
 *    마지막으로 한도가 걸리는 해(`B − 1`)에서 멈춘다.
 *  · **잔액** — 매년 W를 n년 꺼내려면 nW가 있어야 한다. 이것은 세법이 아니라 산수다.
 *
 * **둘이 같으면 잔액 쪽으로 적는다.** 「법정 한도 때문에 더 필요하다」는 문장은 실제로
 * 더 필요할 때만 참이고, 같은 값에서 그 문장을 쓰면 사용자에게 없는 제약을 말하게 된다.
 */
export function minimumStartBalance(rules, { annualWithdrawalKrw, payoutYears }) {
  const { cap } = rules;
  const w = exactOf(annualWithdrawalKrw);
  if (w === null || !Number.isSafeInteger(payoutYears) || payoutYears < 1) return null;

  const lastCappedYear = Math.min(payoutYears, cap.base - 1);
  const capMultiplier = multiplierAtYear(cap, lastCappedYear);
  const capFloor = mulExact(w, capMultiplier);
  const firstYearFloor = mulExact(w, multiplierAtYear(cap, 1));
  const balanceFloor = mulExact(w, exactOf(payoutYears));

  const capBinds = cmpExact(capFloor, balanceFloor) === 1;
  const required = maxExact(capFloor, balanceFloor);

  return {
    required_krw: ceilExactToWon(required),
    first_year_floor_krw: ceilExactToWon(firstYearFloor),
    annual_cap_floor_krw: ceilExactToWon(capFloor),
    remaining_balance_floor_krw: ceilExactToWon(balanceFloor),
    binding_code: capBinds ? 'annual_cap' : 'remaining_balance',
    cap_binds_before_balance: capBinds,
    last_year_the_cap_binds: lastCappedYear,
    cap_ceases_at_year_index: cap.ceasesAtYearIndex,
    min_payout_years_without_cap_binding: minPayoutYearsWithoutCapBinding(cap),
  };
}

/**
 * 수령 기간이 **몇 년 이상**이면 한도가 잔액보다 먼저 물지 않는가.
 *
 * 조건은 `(B−n) ÷ R ≤ 1`, 즉 `n ≥ B − R`이다. 그 값을 올림한 것이 답이고,
 * **이 수는 조문에 적혀 있지 않다** — 산식의 두 계수에서 나오는 산술이다.
 */
function minPayoutYearsWithoutCapBinding(cap) {
  const threshold = subExact(exactOf(cap.base), divExact(exactOf(cap.rateNum), exactOf(cap.rateDen)));
  return ceilExactToWon(threshold);
}
