/**
 * 「연금고갈 시뮬레이션」 탭(D84) 전용 문구. 계산기2·역산기가 각자 문구
 * 사전을 나눴던 것과 같은 이유(계약 8.11절) — 이 탭은 세액 계산이 아니라
 * 공적 기금 시나리오 도구라 세법 어휘 규약과는 별개의 사전이 맞다.
 *
 * **개인 지시형 금지(D84 판정 2 (b))** — 「사적연금으로 대처」 연결은
 * 절세계좌 계산기 탭으로 가는 다리(링크)까지다. "당신은 얼마를 넣으세요"
 * 를 말하지 않는다.
 */

export const DEPLETION_TAB_LABEL = '연금고갈 시뮬레이션';

export const DEPLETION_BRIDGE_NOTE =
  '공적연금 급여만으로는 이 궤적처럼 재정 상태가 흔들릴 수 있습니다 — 절세계좌(ISA·IRP·연금저축)로 사적연금을 함께 준비하는 방법도 있습니다.';
export const DEPLETION_BRIDGE_LINK_LABEL = '절세계좌 계산기로';

export const DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL = '고급 설정 펼치기';
export const DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL = '고급 설정 접기';

export const DEPLETION_CARD_DEPLETION_LABEL = '기금 소진';
export const DEPLETION_CARD_DEFICIT_LABEL = '수지 적자 전환';
export const DEPLETION_CARD_MAX_FUND_LABEL = '최대 적립금';

export const DEPLETION_CORE_ASSUMPTIONS_HEADING = '핵심 가정';

// ---------------------------------------------------------------------------
// [2026-08-24, tax-rules-report.md 33절] 출처 정정 뒤 추가한 문구 —
// 출처를 정확히 부르고(「공식」 한 단어로 뭉치지 않고), 이 모델이 못 다루는
// 구간·전제를 화면이 스스로 밝힌다.
// ---------------------------------------------------------------------------

/** [33.7, 33.10 6번] 전망 재현 출발값(1,458조) 옆에 실적을 밝히는 고지. */
export const DEPLETION_ACTUAL_FUND_NOTE_PREFIX = '실제 적립금은 전망보다 앞서 있습니다';

/** [33.8 #21] 2031년 이후 수급자수 곡선의 출처 한계 고지. */
export const DEPLETION_RECIPIENTS_CURVE_NOTE =
  '2031년 이후는 공식 전망이 공개되지 않아, 제5차 재정추계의 부과방식비용률에 맞도록 보정한 곡선입니다.';

/** [33.5 (1)] 보험료율 슬라이더가 법정 스케줄 종료치(13%)를 넘었을 때. */
export const DEPLETION_RATE_ASSUMPTION_NOTE =
  '13%를 넘는 구간은 법정 스케줄이 아닌 가정입니다 — 「국민연금법」 개정은 2033년 13%에서 멈춥니다.';

/** [33.5 (3)] 수급개시연령 슬라이더가 법정 최종 상한(65세)을 넘었을 때. */
export const DEPLETION_AGE_ASSUMPTION_NOTE =
  '65세를 넘는 값은 법·개정안이 아닌 가정입니다 — 현행법상 최종 상한은 65세(1969년생부터)입니다.';
