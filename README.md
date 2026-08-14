# 절세 계좌 최적화 서비스

ISA·IRP·연금저축에 얼마를 어떤 비중으로 납입해야 세금을 가장 많이 아끼는지 계산해 보여주는 웹 서비스.

## 조직

이 저장소는 Claude Code 서브에이전트로 구성된 조직이 운영한다. 관리자는 메인 세션이고, 8개 유닛이 `.claude/agents/`에 정의되어 있다.

- 조직 운영 규약: `docs/org/charter.md`
- 설계 근거: `docs/superpowers/specs/2026-08-07-agent-org-design.md`

## 조직 규약 검증

조직 규약은 문서상의 다짐이 아니라 실행되는 검사다.

```bash
node scripts/org/validate.mjs        # 규약 위반 시 exit 1
node --test "tests/org/*.test.mjs"   # 검증기 자체의 테스트
```

검사 항목:

| 검사 | 무엇을 막는가 |
|---|---|
| 에이전트 정의 | 유닛이 명세표보다 넓은 도구 권한을 갖는 것, 명세표에 없는 유닛이 몰래 생기는 것 |
| 조직 헌장 | 유닛이나 게이트가 헌장에서 누락되는 것 |
| 세법 룰셋 | 법령 출처 없는 숫자, 확정/개정예고 혼재, `id` 중복 |
| 산출물 머리말 | 작성 주체와 승인 상태를 알 수 없는 문서, 자기 쓰기 범위 밖에 놓인 문서 |

## 디렉터리

| 경로 | 내용 |
|---|---|
| `.claude/agents/` | 유닛 정의 |
| `docs/org/` | 조직 헌장 |
| `docs/stage-*/` | 단계별 산출물 |
| `data/tax-rules/` | 연도별 세법 룰셋 (출처 필수) |
| `src/engine/` | 계산 엔진 |
| `src/web/` | 웹 UI |
| `scripts/org/` | 조직 규약 검증기 |
| `scripts/build.mjs` | 배포용 단일 HTML 빌드 (아래 "배포" 절) |

## 원칙

세법 수치는 코드에 없다. 전부 `data/tax-rules/`에서 읽는다. 계산은 브라우저 안에서 끝나며 사용자 입력값은 외부로 나가지 않는다. 전체 목록은 헌장의 "제품 원칙"에 있다.

## 개발 중 실행

서버 없이 `file://`로 열면 룰셋 `fetch`가 막힌다. 저장소 뿌리를 서빙하는 개발 서버를 쓴다.

```bash
node scripts/dev-server.mjs           # http://127.0.0.1:5173/src/web/index.html
```

## 배포 — 단일 HTML 빌드 (D66·D67)

`src/web/`는 여러 ESM 모듈과 `data/tax-rules/`의 룰셋 JSON을 `fetch`로 읽는 구조라 정적 호스팅 서버가 필요하다. GitHub Pages에 그대로 올리려면 이 전부를 **자기완결적인 단일 HTML 파일**로 묶어야 한다.

```bash
node scripts/build.mjs                 # dist/index.html 생성
node scripts/build.mjs --with-note     # 아티팩트 안내문을 포함해 생성 (아래 참고)
node scripts/build.mjs out/other.html  # 출력 경로를 바꾼다
```

빌드는 `src/web/main.js`부터 시작해 의존하는 모든 모듈을 위상 정렬해 **하나의 모듈 스코프**로 이어붙이고, `data/tax-rules/2026.json`·`2027-proposed.json`을 파일 안에 인라인한다. 산출물 하나만 있으면 서버 없이(더블클릭으로 열어도) 계산기가 동작한다.

**이름 충돌.** 모듈을 하나의 스코프로 합치므로 최상위 이름이 파일 간에 겹치면 빌드가 예외를 던지고 멈춘다(조용히 깨진 산출물을 내지 않는다). 오류 메시지가 충돌한 이름과 두 파일을 알려준다 — 그 이름을 `scripts/build.mjs`의 `RENAME` 표에 추가하면 된다. 지금까지 엔진에 파일이 늘 때마다 여기서 몇 차례 걸렸다.

**아티팩트 안내문(`--with-note`).** 기본 빌드에는 소유자 미리보기용 배너("동작하는 프로토타입 — 마지막 커밋 기준" 등)가 **빠져 있다.** 공개 배포본은 불특정 방문자를 향하는데 그 배너는 내부 진행 상황을 설명하는 문구이고 화면이 바뀔 때마다 다시 낡는다(실제로 이 저장소에서 두 번 낡았다 — 이미 사라진 입력을 설명하고 있었다). 소유자에게 다시 미리보기를 보여줘야 하면 `--with-note`로 켠다.

**계측(analytics-config.js) — 사람이 값을 채우는 두 지점.** 둘 다 비어 있으면(기본 상태) 빌드가 콘솔에 각각 경고를 출력한다. 계산 기능 자체는 두 값과 무관하게 정상 동작한다.

- **`collectUrl`·`websiteId`** — 커스텀 이벤트(`analytics-plan.md`의 `page_view`·`result_shown` 등)를 자체 호스팅 Umami(D18)로 보내는 설정이다. 아직 서버를 세우지 않았다면 비워 둔다.
- **`EXTERNAL_VISITOR_SNIPPET`** — 서버 없이 방문자수만 얻는 외부 스니펫(D67, 예: Cloudflare Web Analytics)을 **가공 없이 그대로** 붙여넣는 자리다. 채우면 빌드가 그 문자열을 산출물의 `</body>` 직전에 그대로 삽입한다. **받는 곳과 넣는 곳:**
  1. https://dash.cloudflare.com 의 **Web Analytics**에서 이 사이트를 등록하고, **Manage site**에서 **JS 스니펫을 그대로 복사**한다(대시보드 문구가 안내하는 방식 그대로 — 스니펫의 정확한 형태는 이 저장소가 기억해 재구성하지 않는다).
  2. `src/web/analytics-config.js`의 `EXTERNAL_VISITOR_SNIPPET` 백틱 사이에 **한 글자도 고치지 말고** 붙여넣는다.
  3. `node scripts/build.mjs`를 다시 돌린다.
  - **내부 미리보기(`--with-note`) 빌드에는 채워져 있어도 삽입되지 않는다** — 그 환경이 외부 스크립트를 CSP로 막기 때문이다. 공개 배포 기본 빌드에는 그대로 들어간다.

**검사.** `node --test src/web/browser/artifact-build.browser.mjs`가 빌드를 새로 돌리고 실제 Chrome으로 `dist/index.html`을 열어 입력을 채우고 결과가 그려지는지까지 확인한다. `src/`의 나머지 테스트가 전부 통과해도 이름 충돌이나 빠진 모듈로 번들 자체가 깨질 수 있어서(Node 테스트는 이걸 원리상 못 본다) 배포 전 마지막 안전망이다. Chrome을 찾지 못하면 건너뛴다(`CHROME_PATH`로 지정 가능). `EXTERNAL_VISITOR_SNIPPET`을 채운 뒤에는 자동 검사가 없다 — `dist/index.html`을 직접 열어 개발자 도구 Network 탭에서 그 스니펫이 부른 요청 하나만 나가는지 눈으로 확인한다(정확한 스니펫 형태를 이 저장소가 가정하지 않으므로, 자동 검사도 그 형태를 가정할 수 없다).

### 배포 — `gh-pages` 브랜치에 단일 파일 (D67)

이 저장소는 소유자 판정(D67)으로 **전부 공개한다.** D66이 세워 둔 "저장소를 둘로 나눈다"는 대비는 필요 없어졌다. `dist/`는 그래도 이 저장소에 커밋하지 않는다(`.gitignore`) — 소스에서 언제든 다시 만들 수 있는 산출물을 커밋하면 두 파일이 갈라질 뿐이다.

GitHub Pages는 서빙 위치를 저장소 루트(`/`) 또는 `/docs`로만 고를 수 있고, 이 저장소의 `docs/`는 문서라 쓸 수 없다 — 그래서 빌드 산출물은 **작업 브랜치가 아니라 `gh-pages` 브랜치**에 둔다.

**GitHub Pages에 올리는 절차** (다음 사람이 이 세션 대화 없이도 할 수 있게):

1. 방문자수를 재려면 위 "계측" 절의 순서대로 `EXTERNAL_VISITOR_SNIPPET`을 먼저 채운다(자체 호스팅 Umami를 이미 세웠다면 `collectUrl`·`websiteId`도 함께).
2. `node scripts/build.mjs` → `dist/index.html` 생성
3. `node --test src/web/browser/artifact-build.browser.mjs` → 실제로 뜨는지 확인
4. `gh-pages` 브랜치에 `dist/index.html`을 `index.html`로, 빈 `.nojekyll` 파일을 함께 올린다(`.nojekyll`이 없으면 GitHub이 Jekyll로 처리하려 들고 밑줄로 시작하는 이름을 건너뛴다)
5. 그 브랜치를 GitHub Pages 소스로 켠다(Settings → Pages → Branch: `gh-pages`)
