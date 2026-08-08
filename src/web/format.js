/**
 * 표시 형식 헬퍼. 세법 수치를 다루지 않는다 — 오직 숫자를 사람이 읽는 문자열로
 * 바꾸는 순수 함수만 있다(design-system.md 2.3절 텍스트 규칙).
 */

const WON_FORMATTER = new Intl.NumberFormat('ko-KR');

/** 천 단위 쉼표 + "원". 계좌별 상세·근거 블록 등 전체 표기가 필요한 곳에 쓴다. */
export function formatKrw(amount) {
  return `${WON_FORMATTER.format(Math.round(amount))}원`;
}

/**
 * 만원 단위 축약. design-system 2.3절: "헤드라인에서만 허용"하고 계좌별 상세·근거
 * 블록에서는 항상 원 단위 전체 표기를 병기한다. 이 함수는 헤드라인 전용이다.
 */
export function formatKrwAbbreviated(amount) {
  const won = Math.round(amount);
  const man = Math.floor(won / 10000);
  const remainder = won % 10000;
  if (man === 0) return formatKrw(won);
  if (remainder === 0) return `${WON_FORMATTER.format(man)}만원`;
  return `${WON_FORMATTER.format(man)}.${String(Math.round((remainder / 10000) * 10)).padStart(1, '0')}만원`;
}

export function formatPercent(ratio, digits = 0) {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatYears(n) {
  return `${n}년`;
}

/**
 * 기본안 대비 차액 표기.
 *
 * `engine-interface.md` 3.0.0(0.1절)부터 `delta_vs_baseline_krw`는 더 이상
 * "0 이하"가 보장이 아니다 — `fund_use_horizon`이 기본안을 `max_tax_credit`이
 * 아닌 안으로 옮기면(`comparison_note_codes`의
 * `baseline_reordered_by_fund_use_horizon`) 이 값이 양수가 될 수 있다. 그 경위:
 * 원래는 기본안이 항상 세액공제 최댓값이라 다른 안이 그보다 클 수 없다는
 * 정리(theorem)였는데, 게이트 2 D10이 기본안을 자금 사용 시점의 함수로 바꾸며
 * 그 정리가 깨졌다. 부호를 "포기한 금액"으로 미리 가정해 마이너스만 그리면
 * 이득을 손실로 표시하는 오류가 난다 — 그래서 부호를 명시적으로 붙인다.
 */
export function formatDelta(amount) {
  if (amount === 0) return '기본';
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatKrw(amount)}`;
}
