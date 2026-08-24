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

// [2026-08-24, 소유자 지시 3번] 「고급 설정 펼치기」 → 「추가 정보 기입」 —
// 접힌 상태의 문구다. 펼친 뒤 다시 접는 문구는 같은 동사 계열로 맞춘다.
export const DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL = '추가 정보 기입';
export const DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL = '추가 정보 접기';

export const DEPLETION_CARD_DEPLETION_LABEL = '기금 소진';
// [2026-08-24, 소유자 지시 4번] 「수지 적자 전환」 카드를 빼고 「현재 기금」
// 카드로 — 값은 모델 계산치가 아니라 실적(ACTUAL_FUND_BALANCE, 아래
// depletion-panel.js). 출처 표기는 카드 자신의 작은 캡션이 진다.
export const DEPLETION_CARD_CURRENT_FUND_LABEL = '현재 기금';
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

// ---------------------------------------------------------------------------
// [2026-08-24, 소유자 지시 5항목] 그래프 시작점 라벨·저장/공유.
// ---------------------------------------------------------------------------

/** 궤적 시작점(2026) 라벨 — "적립금 {값}조원(전망 기준)". 값 자체는
 * `depletion/constants.js`의 `INITIAL_FUND_TRILLION_KRW`(전망 재현
 * 출발값)에서만 온다 — 실적(`ACTUAL_FUND_BALANCE`)과 섞지 않는다(D84
 * 출처 분리, 소유자 지시 2번 원문). */
export const DEPLETION_CHART_START_LABEL_PREFIX = '적립금';
export const DEPLETION_CHART_START_LABEL_SUFFIX = '(전망 기준)';

/** [소유자 지시 5번] 요약 이미지 시트 제목·핵심 가정 구획 제목 — 계산기2의
 * `SUMMARY_INPUTS_HEADING`("입력값")과 같은 자리, 이 탭 어휘로 맞춘다. */
export const DEPLETION_SUMMARY_TITLE = '연금고갈 시뮬레이션 요약';
export const DEPLETION_SUMMARY_ASSUMPTIONS_HEADING = '핵심 가정';
export const DEPLETION_SUMMARY_SOURCE_HEADING = '출처';

/** [소유자 지시 5번] 공유 링크 — D74 관행(계산기2와 같은 문구)을 그대로
 * 쓴다("여기 값은 거시 가정이지만 관행 일관 유지", 관리자 지시 원문). */
export const DEPLETION_SHARE_INVALID_NOTE =
  '공유 링크를 읽지 못했습니다 — 이전 버전이거나 손상된 링크입니다. 값을 직접 조작해 주세요.';
