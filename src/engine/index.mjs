// 절세 계좌 납입 배분 계산 엔진 — 공개 진입점.
//
// 빌드 단계 없이 그대로 임포트할 수 있는 ESM 모듈이다. 의존성이 없다.
// 두 함수 모두 순수 함수이고 예외를 던지지 않는다. 룰셋은 인자로 주입한다.
//
// 계약: docs/stage-2-design/engine-interface.md (schema_version 14.1.0)
// 설계: docs/stage-2-design/engine-design.md

export { compute, computeFundUseHorizonBoundaries } from './compute.mjs';
// 연금 역산기(D77)의 세 번째 진입점. **첫 탭의 계산과 상태를 공유하지 않는다** —
// 새 모듈이고, 같이 쓰는 것은 룰셋 접근·원 미만 규약·날짜 산술뿐이다.
export { computePensionReverse } from './reverse.mjs';
export { SCHEMA_VERSION } from './constants.mjs';
