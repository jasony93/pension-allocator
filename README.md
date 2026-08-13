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

## 배포 — 단일 HTML 빌드 (D66)

`src/web/`는 여러 ESM 모듈과 `data/tax-rules/`의 룰셋 JSON을 `fetch`로 읽는 구조라 정적 호스팅 서버가 필요하다. GitHub Pages에 그대로 올리려면 이 전부를 **자기완결적인 단일 HTML 파일**로 묶어야 한다.

```bash
node scripts/build.mjs                 # dist/index.html 생성
node scripts/build.mjs --with-note     # 아티팩트 안내문을 포함해 생성 (아래 참고)
node scripts/build.mjs out/other.html  # 출력 경로를 바꾼다
```

빌드는 `src/web/main.js`부터 시작해 의존하는 모든 모듈을 위상 정렬해 **하나의 모듈 스코프**로 이어붙이고, `data/tax-rules/2026.json`·`2027-proposed.json`을 파일 안에 인라인한다. 산출물 하나만 있으면 서버 없이(더블클릭으로 열어도) 계산기가 동작한다.

**이름 충돌.** 모듈을 하나의 스코프로 합치므로 최상위 이름이 파일 간에 겹치면 빌드가 예외를 던지고 멈춘다(조용히 깨진 산출물을 내지 않는다). 오류 메시지가 충돌한 이름과 두 파일을 알려준다 — 그 이름을 `scripts/build.mjs`의 `RENAME` 표에 추가하면 된다. 지금까지 엔진에 파일이 늘 때마다 여기서 몇 차례 걸렸다.

**아티팩트 안내문(`--with-note`).** 기본 빌드에는 소유자 미리보기용 배너("동작하는 프로토타입 — 마지막 커밋 기준" 등)가 **빠져 있다.** 공개 배포본은 불특정 방문자를 향하는데 그 배너는 내부 진행 상황을 설명하는 문구이고 화면이 바뀔 때마다 다시 낡는다(실제로 이 저장소에서 두 번 낡았다 — 이미 사라진 입력을 설명하고 있었다). 소유자에게 다시 미리보기를 보여줘야 하면 `--with-note`로 켠다.

**계측(analytics-config.js).** `src/web/analytics-config.js`의 `collectUrl`·`websiteId`가 비어 있으면(기본 상태) 빌드가 그 사실을 콘솔에 경고로 출력한다. 계산 기능 자체는 그대로 동작하지만 계측 이벤트는 어디로도 나가지 않는다. 방문자 통계를 수집하려면 자체 호스팅 Umami(D18) 인스턴스 정보를 이 파일에 채우고 다시 빌드해야 한다.

**검사.** `node --test src/web/browser/artifact-build.browser.mjs`가 빌드를 새로 돌리고 실제 Chrome으로 `dist/index.html`을 열어 입력을 채우고 결과가 그려지는지까지 확인한다. `src/`의 나머지 테스트가 전부 통과해도 이름 충돌이나 빠진 모듈로 번들 자체가 깨질 수 있어서(Node 테스트는 이걸 원리상 못 본다) 배포 전 마지막 안전망이다. Chrome을 찾지 못하면 건너뛴다(`CHROME_PATH`로 지정 가능).

### `dist/`는 이 저장소에 커밋하지 않는다

`.gitignore`에 있다. D66 판정으로 이 저장소는 공개하지 않고(내부 판정·세무사법 노출 분석·사업 계획이 함께 있다), **`dist/index.html` 하나만 별도 공개 저장소로 옮겨 GitHub Pages로 띄운다.** 소스에서 언제든 다시 만들 수 있는 산출물을 이 저장소에 커밋하면 두 파일이 갈라질 뿐이라 판단했다.

**GitHub Pages에 올리는 절차** (다음 사람이 이 세션 대화 없이도 할 수 있게):

1. `node scripts/build.mjs` → `dist/index.html` 생성
2. `node --test src/web/browser/artifact-build.browser.mjs` → 실제로 뜨는지 확인
3. 공개 저장소(이 저장소와 별개)에 `dist/index.html`을 `index.html`로 복사해 커밋·푸시
4. 그 공개 저장소의 GitHub Pages를 켠다(Settings → Pages → 브랜치 지정)
5. 계측을 켜려면 1번 전에 `src/web/analytics-config.js`를 채운다
