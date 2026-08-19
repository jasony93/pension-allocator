// 역산이 쓰는 정확값 산술 — `exact.mjs`에 없는 두 가지만 더한다.
//
// **왜 `exact.mjs`를 고치지 않았나.** 그 파일은 적립 단계 계산 전체가 딛고 있는 자리이고,
// 이 회차의 지시가 「기존 계산기 코드와의 결합 최소화」다. 더하는 것이 둘뿐이라 새 파일이
// 싸다.
//
// **세법 수치가 없다.** 이 파일이 아는 것은 「분수를 어떻게 올리고 거듭제곱하는가」뿐이다.

import { EXACT_ZERO, cmpExact, exactOf, mulExact } from './exact.mjs';

const ONE_N = 1n;

/**
 * 원 미만을 **올린다.**
 *
 * **왜 버리지 않는가.** 이 연산이 걸리는 자리는 전부 **하한**이다 — 「개시 시점에 최소
 * 얼마가 있어야 하는가」와 「매달 최소 얼마를 넣어야 하는가」. 하한을 버림으로 내면
 * 그 값을 그대로 따른 사용자가 하한에 1원 못 미친다. 즉 **버리면 하한이 하한이 아니게 된다.**
 *
 * 조문이 정한 자리가 아니다. `tax.rounding.won_fraction`이 지목한 두 단계(과세표준·국고금)
 * 어느 쪽도 아니고, 그 규칙이 「우리가 정한 자리」로 남겨 둔 표시 단계에 해당한다.
 * 그 사실은 가정 코드로 응답에 실린다.
 */
export function ceilExactToWon(value) {
  if (value === null || typeof value !== 'object') return null;
  const { n, d } = value;
  if (typeof n !== 'bigint' || typeof d !== 'bigint' || d <= 0n) return null;
  const quotient = n % d === 0n ? n / d : n / d + (n > 0n ? ONE_N : 0n);
  const result = Number(quotient);
  return Number.isSafeInteger(result) ? result : null;
}

/** 정확값의 거듭제곱. 지수는 0 이상의 정수여야 한다. 복리 계산이 유일한 쓰임이다. */
export function powExact(value, exponent) {
  if (!Number.isSafeInteger(exponent) || exponent < 0) return null;
  if (value === null || typeof value !== 'object') return null;

  let result = exactOf(1);
  let square = value;
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) {
      result = mulExact(result, square);
      if (result === null) return null;
    }
    remaining = Math.floor(remaining / 2);
    if (remaining > 0) {
      square = mulExact(square, square);
      if (square === null) return null;
    }
  }
  return result;
}

/** 정확값이 0보다 큰가. */
export const isPositiveExact = (value) => cmpExact(value, EXACT_ZERO) === 1;
