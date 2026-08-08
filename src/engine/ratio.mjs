// 룰셋의 비율은 십진 소수다. 그대로 곱하면 이진 부동소수점 오차가
// 원 단위 절사에서 1원씩 어긋난다 — 정확한 정수가 나와야 할 곱이 미세하게
// 작게 나와 floor에서 1원이 사라진다.
// 그래서 비율을 정수 분수로 바꿔 정수 연산만으로 처리한다.
// engine-design.md 5.1절 "부동소수점 누적을 쓰지 않는다"의 구현이다.

/** 십진 소수를 {num, den} 정수 분수로 바꾼다. 읽을 수 없으면 null. */
export function toRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;

  const text = String(value);
  if (/e/i.test(text)) return null; // 지수 표기는 룰셋이 쓰지 않는다. 추측하지 않는다.

  const decimals = (text.split('.')[1] ?? '').length;
  const den = 10 ** decimals;
  const num = Math.round(value * den);

  if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) return null;
  return { num, den };
}

/** 금액에 비율을 적용하고 원 미만을 버린다. 비율을 읽을 수 없으면 null. */
export function applyRate(amountKrw, rate) {
  const ratio = toRatio(rate);
  if (ratio === null) return null;

  const product = amountKrw * ratio.num;
  if (!Number.isSafeInteger(product)) return null;
  return Math.floor(product / ratio.den);
}

/**
 * 소득세율에 지방소득세 부가율을 얹은 실효율.
 * 표시용 숫자이므로 분수를 합쳐 한 번에 나눈다 — 소수를 두 번 곱하면
 * 꼬리에 오차가 붙어 화면에 그대로 새어 나간다.
 */
export function effectiveRate(incomeTaxRate, surtaxRate) {
  const income = toRatio(incomeTaxRate);
  const surtax = toRatio(surtaxRate);
  if (income === null || surtax === null) return null;

  const num = income.num * (surtax.den + surtax.num);
  const den = income.den * surtax.den;
  return num / den;
}

export const clampToZero = (value) => (value < 0 ? 0 : value);
