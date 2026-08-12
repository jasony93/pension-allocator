// 원 미만이 있는 금액을 **정확히** 들고 다니는 정수 분수.
//
// **왜 필요해졌나.** 「국고금 관리법」 제47조는 끝수를 없애는 자리를 **두 곳만** 지목한다
// (제2항 과세표준 1원, 제1항 국고금의 수입·지출 10원). 그 사이의 중간값에서 절사하면
// 조문에 없는 세 번째 절사 자리를 만드는 것이 되고, 그 1원이 위로 전파되어 세액 한도의
// 절단 여부(`applied`)를 뒤집는다. 그래서 **끝수를 없애도 되는 자리에 닿기 전까지는
// 정확값을 그대로 들고 가야 한다.**
//
// **부동소수점을 쓰지 않는 이유는 그대로다**(`ratio.mjs` 머리말). 십진 소수를 이진
// 부동소수점으로 곱하면 정확히 정수여야 할 곱이 미세하게 작게 나와 절사에서 1원이 사라진다.
// 여기서는 **분모를 없애지 않고 그대로 들고 다닌다** — 곱셈이 이어지면 분자가
// `Number.MAX_SAFE_INTEGER`를 넘으므로 `BigInt`를 쓴다. 금액과 분모가 커져도 정확도가
// 떨어지지 않는 유일한 방법이다.
//
// **여기에 세법 수치는 없다.** 비율·한도·단위는 전부 룰셋에서 온다. 이 파일이 아는 것은
// 「분수를 어떻게 더하고 비교하고 버리는가」뿐이다.

/** @typedef {{ n: bigint, d: bigint }} Exact 분모는 항상 양수다. */

const ZERO_N = 0n;
const ONE_N = 1n;

/** 0원. */
export const EXACT_ZERO = { n: ZERO_N, d: ONE_N };

/** 정수 원을 정확값으로. 정수가 아니면 `null` — 값을 지어내지 않는다. */
export function exactOf(krw) {
  if (typeof krw !== 'number' || !Number.isSafeInteger(krw)) return null;
  return { n: BigInt(krw), d: ONE_N };
}

const isExact = (value) =>
  value !== null && typeof value === 'object' && typeof value.n === 'bigint' && typeof value.d === 'bigint';

/** 인자 중 하나라도 읽을 수 없으면 계산을 멈춘다. `null`이 그 신호다. */
function guard(...values) {
  return values.every((value) => isExact(value));
}

export function addExact(a, b) {
  if (!guard(a, b)) return null;
  return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
}

export function subExact(a, b) {
  if (!guard(a, b)) return null;
  return { n: a.n * b.d - b.n * a.d, d: a.d * b.d };
}

export function mulExact(a, b) {
  if (!guard(a, b)) return null;
  return { n: a.n * b.n, d: a.d * b.d };
}

/**
 * 정확값을 정확값으로 나눈다. 0으로 나누면 `null`.
 * 안분(근로소득금액 ÷ 종합소득금액)이 쓰는 유일한 나눗셈이다.
 */
export function divExact(a, b) {
  if (!guard(a, b) || b.n === ZERO_N) return null;
  const n = a.n * b.d;
  const d = a.d * b.n;
  return d < ZERO_N ? { n: -n, d: -d } : { n, d };
}

/** `{num, den}` 꼴의 비율(ratio.mjs의 `toRatio` 결과)을 곱한다. */
export function scaleExact(a, ratio) {
  if (!guard(a) || ratio === null || typeof ratio !== 'object') return null;
  const { num, den } = ratio;
  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || den === 0) return null;
  const scaled = { n: a.n * BigInt(num), d: a.d * BigInt(den) };
  return scaled.d < ZERO_N ? { n: -scaled.n, d: -scaled.d } : scaled;
}

/** −1 / 0 / +1. **비교는 언제나 정확값으로 한다** — 룰셋의 `comparison` 단계. */
export function cmpExact(a, b) {
  if (!guard(a, b)) return null;
  const left = a.n * b.d;
  const right = b.n * a.d;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function minExact(a, b) {
  const order = cmpExact(a, b);
  if (order === null) return null;
  return order <= 0 ? a : b;
}

export function maxExact(a, b) {
  const order = cmpExact(a, b);
  if (order === null) return null;
  return order >= 0 ? a : b;
}

/** 음수를 0으로. `ratio.mjs`의 `clampToZero`와 같은 일을 정확값에서 한다. */
export function clampExactToZero(a) {
  return maxExact(a, EXACT_ZERO);
}

/**
 * `unit` 배수로 **버린다**. 단위도 연산도 이 파일이 정하지 않는다 —
 * 부르는 쪽이 룰셋의 `unit_krw`를 그대로 넘긴다.
 *
 * 음수에서도 「내림」이다(0 방향 절단이 아니다). 금액은 0 이하로 내려가지 않도록
 * 따로 막고 있지만, 부호에 따라 뜻이 달라지는 함수를 남겨 두지 않는다.
 */
export function floorExactToUnit(a, unitKrw) {
  if (!guard(a)) return null;
  if (!Number.isSafeInteger(unitKrw) || unitKrw <= 0) return null;

  const unit = BigInt(unitKrw);
  const n = a.n;
  const d = a.d * unit;
  // BigInt 나눗셈은 0 방향 절단이므로 음수에서 한 칸 내린다.
  const quotient = n >= ZERO_N || n % d === ZERO_N ? n / d : n / d - ONE_N;
  return { n: quotient * unit, d: ONE_N };
}

/** 정확히 정수인가. */
export function isExactInteger(a) {
  if (!guard(a)) return false;
  return a.n % a.d === ZERO_N;
}

/**
 * 정수 원으로 꺼낸다. **정수가 아니면 `null`** — 여기서 몰래 버리면 이 파일이 존재하는
 * 이유가 사라진다. 버리는 것은 언제나 `rounding.mjs`가 룰셋을 읽고 하는 일이다.
 */
export function exactToInteger(a) {
  if (!isExactInteger(a)) return null;
  const value = Number(a.n / a.d);
  return Number.isSafeInteger(value) ? value : null;
}
