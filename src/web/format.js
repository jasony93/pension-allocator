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

/** 기본안 대비 차액 표기. 0 이하 값만 온다는 계약 전제를 그대로 반영한다. */
export function formatDelta(amount) {
  if (amount === 0) return '기본';
  return `${formatKrw(amount)}`;
}
