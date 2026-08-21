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
