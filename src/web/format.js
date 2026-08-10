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

/**
 * 비율 → 백분율, 불필요한 소수 0을 잘라낸다("5.50%"가 아니라 "5.5%"). D28
 * 수익률처럼 사용자가 소수로 입력할 수 있는 값에 쓴다 — `formatPercent`의
 * 고정 자릿수는 "7.00%"처럼 없는 정밀도를 만들어낸다.
 */
export function formatPercentTrimmed(ratio) {
  const text = (ratio * 100).toFixed(4).replace(/\.?0+$/, '');
  return `${text}%`;
}

export function formatYears(n) {
  return `${n}년`;
}

/**
 * `delta_vs_baseline_krw` 표기 — **순수하게 숫자만 본다.**
 *
 * "이 값이 0이다"와 "이 배분안이 기본안이다"는 다른 사실이다. 세액공제액이
 * 우연히 같은 대안은 흔하다(합산 한도에 같은 값으로 걸리면 그렇게 된다).
 * 이 함수가 델타==0을 "기본"으로 표시하면, 기본안이 아닌 행도 "기본"이라고
 * 말하게 된다 — 실제로 관리자가 브라우저 실측에서 잡은 버그다. 기본안 여부는
 * `plan.is_baseline`으로만 판정하고, 이 함수는 그 판정과 완전히 분리해
 * 호출부(`result-panel.js`)가 `is_baseline`을 먼저 확인한 뒤에만 이 함수를
 * 쓰게 한다. 델타가 0이면 "동일"(세액공제액이 기본안과 같다는 사실)만 말한다.
 *
 * 부호도 명시한다 — `engine-interface.md` 3.0.0(0.1절)부터
 * `delta_vs_baseline_krw`는 "0 이하"가 보장이 아니다. `fund_use_horizon`이
 * 기본안을 `max_tax_credit`이 아닌 안으로 옮기면 이 값이 양수일 수 있다.
 * 부호를 "포기한 금액"으로 미리 가정해 마이너스만 그리면 이득을 손실로
 * 표시하는 오류가 난다.
 */
export function formatDelta(amount) {
  if (amount === 0) return '동일';
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatKrw(amount)}`;
}

/**
 * 스택바 비교 행의 금액 칸에 쓸 문구. `formatDelta`와 분리된 이유는 위 주석과
 * 같다 — `is_baseline`을 여기서 먼저 확인해야 "기본안이 아닌데 기본이라고
 * 말하는" 버그가 구조적으로 재발하지 않는다. DOM 없이 순수 함수로 뽑아 둔
 * 것은 이 판정을 자동 테스트로 고정하기 위해서다.
 */
export function formatPlanRowAmount(plan) {
  return plan.is_baseline ? '기본' : formatDelta(plan.delta_vs_baseline_krw);
}
