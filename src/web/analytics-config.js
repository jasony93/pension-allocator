/**
 * 계측 수집기 설정 — 사람이 값을 채우는 단일 지점.
 *
 * 관리자 결정 D18: 수집기는 자체 호스팅 Umami로 확정됐다 (게이트 5).
 * 이유는 `docs/stage-2-design/analytics-plan.md` 6-1절이 남긴 미확정을
 * 해소하기 위해서다 — Umami의 커스텀 이벤트 속성으로 `anon_id`를 실어
 * 보낼 수 있어 지표 2(재방문율, Tier A)의 7일 코호트를 직접 낼 수 있다.
 *
 * 이 파일이 빌드 단계 없이 런타임에 읽히는 유일한 설정 지점이다.
 * 배포 전 아래 두 값을 자체 호스팅 Umami 인스턴스 정보로 채워라:
 *
 *   - collectUrl: Umami 인스턴스의 이벤트 수집 엔드포인트.
 *                 예: 'https://umami.example.com/api/send'
 *   - websiteId : Umami 관리자 화면에서 이 사이트를 등록하고 받은 website ID(UUID).
 *
 * 두 값 중 하나라도 비어 있으면 계측은 전송되지 않고 `console.warn`으로
 * 알린다 — 계산 기능 자체는 계측과 무관하게 정상 동작한다
 * (`analytics.js`의 `isAnalyticsConfigured` 참고).
 */
export const ANALYTICS_CONFIG = {
  collectUrl: '',
  websiteId: '',
};
