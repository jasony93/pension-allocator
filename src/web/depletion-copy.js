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

// [2026-08-25, 소유자 지시 8번] **다리(문구+버튼)를 지운다** — 절세계좌
// 탭으로의 연결은 이제 이 탭 전용 팝업(`ui/depletion-intro-modal.js`,
// 소유자 지시 9번)의 하단 버튼이 대신 진다. 옛 `DEPLETION_BRIDGE_NOTE`·
// `DEPLETION_BRIDGE_LINK_LABEL`은 여기서 완전히 지운다(죽은 문구를 사전에
// 남기지 않는다) — 팝업의 대응 버튼 문구는 아래 `DEPLETION_POPUP_*`에 있다.

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

/**
 * [2026-08-25, 소유자 지시(12항목) 7번, D85] 화면의 2030 검증줄 — 옛
 * (소진 연도·수지 적자·연도별 궤적 전부 전망 기준으로 계산하던 시절의)
 * 상세 대조 문장을 한 줄로 줄인다. **두 출처가 각자 제 자리에 남는다**
 * (D85 원문) — 이 모델 자신의 정확성 증명(전망 기준 재현)과, 화면이
 * 실제로 보이는 출발값(실적)이 다른 사실이라는 것을 한 문장 안에서
 * 갈라 말한다. 숫자(1,458조·오차 1% 미만)는 `simulate.test.mjs`가 잠근
 * 값이다 — 모델이 바뀌어 오차가 달라지면 이 문구도 함께 봐야 한다
 * (TODO(tax-domain 정정 시): 오차가 1%를 넘으면 이 문구부터 고친다).
 * `{forecastLabel}`·`{actualLabel}`·`{sourceLabel}`은
 * `ui/depletion-panel.js`가 `depletion/constants.js`의 값으로 채운다 —
 * 숫자 자체는 이 사전에 직접 적지 않는다(출처가 상수 모듈 한 곳에
 * 모여야 한다는 이 탭의 원칙 그대로).
 */
export const DEPLETION_VALIDATION_LINE_PREFIX = '이 모델은 전망 기준(';
export const DEPLETION_VALIDATION_LINE_MID = ' 출발)으로 2030년 공식 전망을 1% 미만 오차로 재현합니다 — 이 화면은 최신 실적(';
export const DEPLETION_VALIDATION_LINE_SUFFIX = ')에서 출발합니다.';

// ---------------------------------------------------------------------------
// [2026-08-24, 소유자 지시 5항목] 그래프 시작점 라벨·저장/공유.
// ---------------------------------------------------------------------------

/** [2026-08-25, 소유자 지시 1번 → 12항목 7번(D85)로 값 출처 정정] 궤적
 * 시작점 라벨 — "현 적립금 {값}조원". **D85로 값이 바뀌었다** — 전망
 * 재현 출발값(`INITIAL_FUND_TRILLION_KRW`, 1,458조)이 아니라 실적
 * (`ACTUAL_FUND_BALANCE`, 1,671조)에서 온다 — 이제 「현재 기금」 카드·
 * 그래프 시작점·이 라벨이 전부 같은 숫자다(D85 원문 "카드·그래프
 * 시작점·라벨이 한 숫자"). 전망 재현 값은 단위시험으로만 남는다. 위치는
 * "첫 데이터 좌표의 왼쪽"이다(소유자 지시 12항목 7번 — y축 위쪽 고정
 * 여백이던 지난 회차 위치를 다시 옮겼다, `ui/depletion-panel.js`의
 * `buildDepletionChart`). */
export const DEPLETION_CHART_START_LABEL_PREFIX = '현 적립금';
export const DEPLETION_CHART_START_LABEL_SUFFIX = '';

/** [소유자 지시 5번] 요약 이미지 시트 제목·핵심 가정 구획 제목 — 계산기2의
 * `SUMMARY_INPUTS_HEADING`("입력값")과 같은 자리, 이 탭 어휘로 맞춘다. */
export const DEPLETION_SUMMARY_TITLE = '연금고갈 시뮬레이션 요약';
export const DEPLETION_SUMMARY_ASSUMPTIONS_HEADING = '핵심 가정';
export const DEPLETION_SUMMARY_SOURCE_HEADING = '출처';

/** [소유자 지시 5번] 공유 링크 — D74 관행(계산기2와 같은 문구)을 그대로
 * 쓴다("여기 값은 거시 가정이지만 관행 일관 유지", 관리자 지시 원문). */
export const DEPLETION_SHARE_INVALID_NOTE =
  '공유 링크를 읽지 못했습니다 — 이전 버전이거나 손상된 링크입니다. 값을 직접 조작해 주세요.';

// ---------------------------------------------------------------------------
// [2026-08-25, 소유자 지시 9번] 시뮬레이션 탭 전용 팝업(왼쪽 카피) —
// `src/design/popup-copy.html`의 `.popup-copy` 내용을 그대로 옮긴다
// (Pretendard CDN·자체 색 토큰은 `ui/depletion-intro-modal.js`가 걷어내고
// 우리 토큰으로 바꾼다 — **문구 자체는 원문 그대로**).
//
// **왜 사전 모듈인가 — 관리자 지시 원문.** 「2064년」 수치·「국민연금법
// 제3조의2」 인용은 tax-domain이 병렬 검증 중이었다 — 정정이 오면 이 한
// 곳(아래 상수들)에서만 갈리게 미리 뺐다.
//
// [2026-08-25, 관리자 지시 — 카피 검증(33.11절) 결과 반영, 소유자 지시
// 12항목 1·6번으로 갱신] 카피 검증(33.11절)이 확인한 원칙은 유지한다 —
// 지급보장 문장(제3조의2)과 소진 전망 문장은 서로 다른 문서에서 온
// 출처라 한 줄로 뭉치지 않는다, 제3조의2를 「신설」로 읽히게 하지 않는다
// (2014년 신설·2025년 개정 — 카피 원문에 "신설" 표현 자체가 없다, 부연을
// 달게 되면 주의). **다만 소유자가 이후 회차(12항목)에서 본문 문구를 직접
// 고쳤다** — 「2064년」 수치를 본문에서 뺐고(「기금 소진은 2064년으로
// 미뤄졌을 뿐입니다」→「기금 소진이 미뤄졌을 뿐입니다」), 그래서 2064를
// 잇던 화해 문구·출처의 "2064년" 언급도 함께 정리했다(아래 각 상수 주석).
// ---------------------------------------------------------------------------

export const DEPLETION_POPUP_QUESTION_LINES = ['국민연금이 고갈되면', '연금 받을 수 있나요?'];

// 답 문단 — "받습니다. 다만 법이 보장하는 건<br>지급이지 금액이 아닙니다."
// 줄바꿈·강조 위치를 그대로 살리려 조각으로 나눈다(`ui/depletion-
// intro-modal.js`가 DOM 요소로 다시 조립한다, 강조 스타일은
// `depletion-popup-mark` 클래스가 진다). **조문 문언 그대로다 — 손대지
// 않는다**(관리자 지시 원문).
export const DEPLETION_POPUP_ANSWER_PREFIX = '받습니다. 다만 법이 보장하는 건';
export const DEPLETION_POPUP_ANSWER_MARK_1 = '지급';
export const DEPLETION_POPUP_ANSWER_MIDDLE = '이지';
export const DEPLETION_POPUP_ANSWER_MARK_2 = '금액';
export const DEPLETION_POPUP_ANSWER_SUFFIX = '이 아닙니다.';

// [2026-08-25, 소유자 지시 6번] 본문 두 문장 문구 수정 —
// 「기금 소진은 2064년으로 미뤄졌을 뿐입니다」→「기금 소진이 미뤄졌을
// 뿐입니다」(연도 수치를 뺀다), 「국민연금은 바닥이지,」→「국민연금은
// 기본이지,」. 셋째 문장(나머지는…)은 그대로다.
export const DEPLETION_POPUP_BODY_LINE_1 = '기금 소진이 미뤄졌을 뿐입니다.';
export const DEPLETION_POPUP_BODY_STRONG = '국민연금은 기본이지, 전부가 아닙니다.';
export const DEPLETION_POPUP_BODY_TAIL_PREFIX = '나머지는 ';
export const DEPLETION_POPUP_ACCOUNT_1 = 'ISA';
export const DEPLETION_POPUP_ACCOUNT_2 = '연금저축';
export const DEPLETION_POPUP_ACCOUNT_3 = 'IRP';
export const DEPLETION_POPUP_BODY_TAIL_SUFFIX = '로 채워야 합니다.';

// [2026-08-25, 소유자 지시 1번] **화해 문구(2064 vs 이 시뮬레이터의 소진
// 연도를 잇던 한 줄)를 지운다** — 소유자 지시. 이전 회차(카피 검증 3번)가
// 붙인 `DEPLETION_POPUP_RECONCILIATION_NOTE`는 완전히 삭제한다(죽은 문구를
// 사전에 남기지 않는다).

/** [관리자 지시 — 카피 검증 1번, 2026-08-25 소유자 지시 6번으로 정리]
 * 출처 두 줄 — 지급보장 문장과 소진 전망 문장은 서로 다른 문서에서 왔다.
 * 하나로 뭉치지 않는다. **2064년 언급을 뺀다** — 본문에서 2064가 빠졌으니
 * (위 `DEPLETION_POPUP_BODY_LINE_1`) 이 줄이 가리키던 대상 자체가 없다. */
export const DEPLETION_POPUP_SOURCE_GUARANTEE = '국민연금법 제3조의2 (2026.1.1 시행) — 지급보장 문장의 출처';
export const DEPLETION_POPUP_SOURCE_PROJECTION = '보건복지부, 2025.3 — 기금 소진 전망의 출처';

// 오른쪽 상단(정적 축소 렌더) 아래 버튼 — 팝업을 닫고 이 탭(이미 활성)에
// 머문다.
export const DEPLETION_POPUP_CHART_BUTTON_LABEL = '연금고갈 시뮬레이션';
// 오른쪽 하단(김철수씨 예시) 아래 버튼 — 팝업을 닫고 첫 탭(계산기2)으로.
// "당신은 얼마를 넣으세요"를 말하지 않는 사실형 문구(D84 판정 2 (b) 그대로
// 유지) — 계좌 세 가지 이름만 나열한다.
export const DEPLETION_POPUP_BRIDGE_BUTTON_LABEL = 'ISA/연금저축/IRP 배분하기';
