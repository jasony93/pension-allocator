/**
 * 「절세계좌 계산기2」(D79) 탭 전용 문구 사전. `reverse-copy.js`가 역산기
 * 탭을 첫 탭 사전(`copy.js`)에서 분리한 것과 같은 이유(engine-interface.md
 * 8.11절 — "다른 탭의 코드를 그 목록에 섞으면 첫 탭의 사전이 두 번째 탭의
 * 문장을 지게 된다")로, 이 탭이 새로 여는 문구만 따로 둔다.
 *
 * **오류·안내·가정 코드(`ERROR_MESSAGE`·`NOTICE_MESSAGE`·`ASSUMPTION_MESSAGE`)는
 * 나누지 않는다** — 이 탭은 첫 탭과 **같은 엔진, 같은 요청 스키마**를 쓰므로
 * (D79 머리말 "엔진·계산·결과는 첫 탭과 같고, 입력 화면만 다르다") 같은 코드가
 * 같은 뜻이다. `copy.js`의 기존 사전을 그대로 재사용한다
 * (`ui/calc2-input-panel.js`가 `copy.js`에서 직접 가져다 쓴다).
 *
 * 헌장의 문구 규약(세무 상담·자문 어휘 금지, 지시형·단정형 금지, 세법 수치
 * 하드코딩 금지)을 그대로 지킨다.
 */

import { SERVICE_NAME } from './copy.js';

/** 탭 라벨 — 소유자 지시 원문 "절세계좌 계산기2". `SERVICE_NAME`을 재사용해
 * 첫 탭 이름이 바뀌면 이 라벨도 같이 따라간다. */
export const CALC2_TAB_LABEL = `${SERVICE_NAME}2`;

// **`CALC2_PREFILL_NOTE`가 여기 있었다**(D79 판정 2로 도입, D80 판정 2로
// 폐기). 소유자가 프리필 안내줄을 조건절·근거 문구 넷 중 하나로 명시 지목해
// 지웠다(D59~D61 계보와 같은 성질) — 부르는 곳이 더는 없다.

/** [D79 판정 1·3] 필수 최소 입력 뒤, 조건부·선택 입력을 접어 두는 자리의 트리거. */
export const CALC2_MORE_INFO_TRIGGER = '▸ 추가 정보 (선택)';

/** 필수 최소 입력 그룹 제목. */
export const CALC2_ESSENTIAL_GROUP_TITLE = '기본 정보';

/**
 * [신규 회차 — 소유자 지시 3번] 「이 돈을 언제 쓸 계획인가요?」 답변 2번
 * (`fund_use_horizon: 'before_pension_age'`)의 계산기2 전용 문구 — 첫 탭은
 * `copy.js`의 `fundUseHorizonLabel(value, boundariesInfo)`가 계산한 문구
 * (경계값을 알면 "N년 후 ~ M년 이내 쓸 계획이다", 모르면 "중간에 쓸
 * 계획이다")를 그대로 쓰지만, 계산기2는 경계값 유무와 무관하게 **항상**
 * 이 고정 문장 하나로 바꾼다(`ui/calc2-input-panel.js`의
 * `fundUseHorizonGroup({ labelOverrides })` 호출).
 *
 * **엔진 매핑은 그대로다.** 이 답을 고르면 여전히 같은 `fund_use_horizon:
 * 'before_pension_age'`가 요청에 실리고, 엔진은 여전히 같은 로직대로
 * IRP 배분을 피한다 — 소유자가 로직 유지까지 명시했다. 이 문구-값
 * 매핑(「10년 안에 쓸 계획이다」 = `before_pension_age`)은 **계산기2
 * 사전에만 있다** — 첫 탭·역산기는 옛 문구를 그대로 쓴다.
 *
 * **주의(관리자 판정).** 이 답은 원래 "연금 개시 전"이라는 뜻이라 실제
 * 연금 개시까지 10년이 채 안 남은 고령 사용자에게는 "10년 안에"라는
 * 새 문구가 그 사람의 실제 시점과 어긋날 수 있다 — 그래도 소유자가
 * 문구만 바꾸고 로직은 유지하라고 명시했으므로 그대로 시행한다. 계산기2가
 * "간결한 판"이라는 실험 축(D80 판정 2 계보)이라는 것이 그 판단의 근거다.
 */
export const CALC2_FUND_USE_HORIZON_BEFORE_PENSION_LABEL = '10년 안에 쓸 계획이다';

/**
 * [2026-08-23, D82 소유자 지시 1번] 계산기2 일일 팝업 예시의 입력 네 줄 중
 * 마지막 줄 라벨 — 「월 납입금」→「납입금」. 값(콜론 뒤 "월 150만원")은
 * 그대로다, 라벨 한 낱말만 짧아진다. `ui/example-showcase.js`의
 * `exampleCapacityLineText()`(첫 탭 예시·팝업이 원래 공유하던 그 문구)는
 * 손대지 않는다 — 이 상수는 계산기2 팝업 한 자리에서만, 그 문구를 받아
 * 라벨만 바꿔 쓴다(`ui/calc2-example-modal.js`).
 */
export const CALC2_EXAMPLE_CAPACITY_LABEL = '납입금';

/**
 * [2026-08-23, D83 소유자 지시 4번 / 판정 3] 결과의 도넛+배분표 머리말 —
 * 「최적 월 배분표」→「최적 월 배분」, 계산기2 한정. 같은 자리가 이제
 * 시나리오 탭보다 위로 옮겨졌으므로(`ui/result-panel.js`의
 * `resultPanelForScenario`가 반환하는 `extractedChartArea`) 표라기보다
 * 첫 결과 문장에 가깝다는 것이 소유자의 이유였다 — "표"를 떼어 더 짧게.
 * 첫 탭은 `copy.js`의 `DONUT_OPTIMAL_KICKER_LABEL`(「최적 월 배분표」)을
 * 그대로 쓴다.
 */
export const CALC2_DONUT_OPTIMAL_KICKER_LABEL = '최적 월 배분';

/**
 * [2026-08-23, D83 소유자 지시 8번 / 판정 2] ISA 예상 수익률 절의 제목 —
 * 「④ ISA 예상 수익률 (선택)」에서 "(선택)"을 뗀다, 계산기2 한정. 방어
 * 문구(`copy.js`의 `ISA_RETURN_SECTION_HELP` — "직접 예상한 수익률을
 * 넣어야 합니다(제시·전망하지 않습니다).")도 계산기2에서는 붙이지 않는다
 * (`ui/calc2-input-panel.js`가 `help`를 아예 넘기지 않는다 — 대체 문구가
 * 없다, 문장 자체를 없앤다).
 *
 * **번복 이유와 위험.** 이 절 전체(선택 표기·방어 문구)는 스타일이 아니라
 * 자본시장법 인접 노출(서비스가 수익률을 제시·전망하는 것으로 읽힐 위험,
 * 30절) 때문에 세워졌다 — D77 판정 1, D79 판정 2. 소유자가 명시로
 * 뒤집었고(D83 판정 2), 대신 김철수씨 프리필의 기본값 5%로 "서비스가
 * 아니라 예시 인물이 정한 값"이라는 성격을 유지한다(`ui/calc2-prefill.js`).
 * 위험은 소유자에게 보고됐다 — 법적 우려가 실제 문제로 커지면 이 항목이
 * 첫 복원 대상이다. 첫 탭·역산기는 원래 문구·무기본값 그대로.
 */
export const CALC2_ISA_RETURN_SECTION_TITLE = '④ ISA 예상 수익률';
