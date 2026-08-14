/**
 * 계측 수집기 설정 — 사람이 값을 채우는 단일 지점.
 *
 * 관리자 결정 D18: 커스텀 이벤트(`analytics.js`의 `EVENT_SCHEMA`) 수집기는
 * 자체 호스팅 Umami로 확정됐다 (게이트 5). 이유는
 * `docs/stage-2-design/analytics-plan.md` 6-1절이 남긴 미확정을 해소하기
 * 위해서다 — Umami의 커스텀 이벤트 속성으로 `anon_id`를 실어 보낼 수 있어
 * 지표 2(재방문율, Tier A)의 7일 코호트를 직접 낼 수 있다.
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
 *
 * **자체 호스팅 서버를 아직 세우지 않았어도 괜찮다.** 아래 `EXTERNAL_VISITOR_SNIPPET`가
 * 그 공백을 메운다.
 */
export const ANALYTICS_CONFIG = {
  collectUrl: '',
  websiteId: '',
};

/**
 * 외부 방문자수 스니펫 — 관리자 결정 D67. 사람이 값을 채우는 두 번째 지점.
 *
 * 배경: 소유자가 저장소를 GitHub Pages로 전부 공개 배포하기로 했다(D67) — 서버를
 * 띄우지 않으므로 위 `ANALYTICS_CONFIG`(자체 호스팅 Umami)가 아직 없어도 방문자
 * 수만은 알고 싶다고 했다. Cloudflare Web Analytics 같은 서버리스 외부 서비스를
 * 붙이는 것이 그 방법이다.
 *
 * **왜 토큰이 아니라 스니펫 전체(HTML 문자열)를 받는가.** Cloudflare 공식 문서는
 * 스니펫의 정확한 형태(태그 속성 이름, 스크립트 URL)를 문서 본문에 신지 않고
 * "대시보드의 Manage site에서 JS 스니펫을 복사해 `</body>` 앞에 넣으라"고만
 * 안내한다 — 그래서 이 저장소가 그 형태를 기억해 재구성하면(예: 토큰만 받아
 * `<script>` 태그를 여기서 조립하면) Cloudflare가 속성 이름이나 스크립트 URL을
 * 바꿨을 때 **여기서 조용히 어긋난다.** 스니펫 전체를 받아 그대로 삽입하면 그
 * 형태가 바뀌어도 이 파일은 깨지지 않는다 — 소유자가 대시보드에서 다시 복사해
 * 붙여넣기만 하면 된다.
 *
 * 값을 채우는 법:
 *
 *   1. https://dash.cloudflare.com 에서 이 사이트를 추가한다(도메인이 없다면
 *      Cloudflare Web Analytics만 붙이는 것도 가능하다 — Cloudflare 대시보드의
 *      "Web Analytics" 메뉴에서 사이트 없이 스니펫만 발급받을 수 있다).
 *   2. 그 사이트의 **Manage site**로 들어가 **JS 스니펫을 그대로 복사**한다.
 *   3. 아래 백틱(`) 사이에 **한 글자도 고치지 말고** 붙여넣는다.
 *
 * 비어 있으면(기본값) 빌드가 아무것도 삽입하지 않는다 — 페이지가 열려도 외부로
 * 나가는 요청이 0건인 지금 성질이 그대로 유지된다(`node scripts/build.mjs`가
 * 콘솔에 이 사실을 경고로 남긴다). 채워지면 `scripts/build.mjs`가 이 문자열을
 * **그대로**(한 글자도 가공하지 않고) 산출물의 `</body>` 직전에 넣는다.
 *
 * **내부 미리보기(`--with-note`) 빌드에는 채워져 있어도 삽입되지 않는다** —
 * 그 빌드를 여는 미리보기 환경이 외부 스크립트를 CSP로 막아 콘솔 오류만 남기고,
 * 애초에 내부 미리보기는 공개 방문자를 향하지 않으므로 방문자수를 잴 이유가
 * 없다(`scripts/build.mjs` 참고).
 *
 * 이 값이 사용자 입력값(생년월일·소득 등)을 실어 보내는 일은 없다 — Cloudflare
 * Web Analytics는 페이지 로드 자체만 신호로 보내는 방문자수 집계용 스크립트이고,
 * 우리 폼 데이터를 참조하지 않는다. 다만 그 스크립트가 현재 페이지 URL을 함께
 * 보낼 수 있으므로, 이 서비스가 입력값을 URL에 싣지 않는다는 것과 함께 성립한다
 * (`state/store.js`가 URL을 쓰지 않는다).
 */
export const EXTERNAL_VISITOR_SNIPPET = ``;
