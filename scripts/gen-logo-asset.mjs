// 로고·man-icon 데이터 URI 모듈 재생성.
//
//   node scripts/gen-logo-asset.mjs
//
// `src/design/돈길-로고-가로형-투명.png`(라이트 모드용 원본) ·
// `src/design/돈길-로고-가로형-다크모드-투명.png`(다크 모드용 원본) ·
// `src/design/man-icon.png`(사람 아이콘 원본)을 각각 base64로 인코딩해
// `src/web/assets/logo.js`(로고 둘)와 `src/web/assets/man-icon.js`(아이콘 하나)를
// 다시 쓴다. **원본 PNG가 바뀌면(로고 교체·재출력, 아이콘 교체) 이 스크립트만
// 다시 돌리면 된다** — 데이터 URI 문자열을 손으로 고치지 않는다.
//
// 왜 이미지 파일을 직접 `import`하지 않고 데이터 URI 모듈로 임베드하는가
// (D72, 관리자 판정) — 이 저장소에는 번들러가 **둘** 있다(`scripts/build.mjs`의
// 배포용 단일 파일 빌드, 그리고 아티팩트 발행 시스템이 `index.html`을 감싸는
// 경로). 이미지 파일을 `<img src="./logo.png">`로 참조하면 각 번들러가 "이
// 상대경로 자산을 어떻게 산출물에 담을 것인가"를 **각자** 풀어야 하고, 그러면
// 같은 결함(예: 아티팩트 뷰어에서 상대경로가 깨지는 것 — `example-showcase.js`
// 머리말이 이미 겪은 종류의 문제)이 두 곳에 따로 생길 수 있다. 데이터 URI로
// 박은 JS 모듈은 **평범한 문자열 상수**이므로 두 번들러 모두 기존 모듈
// 이어붙이기 경로를 그대로 타면서 아무 특별 처리도 필요 없다. man-icon도
// 같은 이유로 같은 방식을 쓴다(관리자 지시, 2026-08-17 세 번째 회차 2번).
//
// [2026-08-17, 관리자 지시(3차) 1번] **로고가 테마별로 갈린다.** 라이트 원본이
// 1064×528에서 1272×528로 갱신되며 다크 전용 원본이 새로 생겼다 — 옛
// `LOGO_DATA_URI` 단일 export를 `LOGO_LIGHT_DATA_URI`/`LOGO_DARK_DATA_URI`
// 둘로 가른다. 이제 다크 헤더에서 로고를 읽히게 하려고 흰 알약 배경
// (`--logo-plate`)을 씌우던 처리는 이유가 사라졌다 — 다크 전용 로고 자체가
// 다크 배경에서 읽히도록 그려졌기 때문이다(그 토큰·CSS는 `styles.css`에서
// 직접 없앤다, 이 스크립트가 진 일이 아니다).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function toBase64(relPath) {
  return readFileSync(join(ROOT, relPath)).toString('base64');
}

// ---------------------------------------------------------------------------
// 로고 — 라이트/다크 두 원본, 둘 다 1272×528.
// ---------------------------------------------------------------------------
const LOGO_LIGHT_SRC = 'src/design/돈길-로고-가로형-투명.png';
const LOGO_DARK_SRC = 'src/design/돈길-로고-가로형-다크모드-투명.png';
const LOGO_OUT = join(ROOT, 'src/web/assets/logo.js');

const logoLightB64 = toBase64(LOGO_LIGHT_SRC);
const logoDarkB64 = toBase64(LOGO_DARK_SRC);

const logoOut = `/**
 * 「돈길」 브랜드 로고(가로형, 투명 배경) — 데이터 URI 모듈(D72, 관리자 판정).
 *
 * **[2026-08-17, 관리자 지시(3차) 1번] 라이트/다크 두 변형이 됐다.** 옛
 * 단일 \`LOGO_DATA_URI\`(라이트 원본 1064×528 하나만 있었고, 다크 헤더에서는
 * 흰 알약 배경(\`--logo-plate\`)으로 눈속임했다)를 대체한다 — 이제 테마마다
 * **원본 자체가 다른 파일**이다.
 *
 * **원본** —
 * \`src/design/돈길-로고-가로형-투명.png\`(라이트 모드용, 1272×528, 투명 배경)
 * \`src/design/돈길-로고-가로형-다크모드-투명.png\`(다크 모드용, 1272×528, 투명 배경)
 *
 * **재생성** — \`node scripts/gen-logo-asset.mjs\`. 원본 PNG를 바꾼 뒤 이 명령만
 * 다시 돌리면 아래 문자열이 새로 갱신된다. **이 파일을 손으로 고치지 않는다.**
 *
 * 왜 데이터 URI인가 — \`scripts/gen-logo-asset.mjs\` 머리말 참고(번들러 둘이
 * 이미지 인라인을 각자 구현하지 않게 하려는 것).
 *
 * 헤더(\`ui/app.js\`)가 이 값 둘을 \`<img src>\`로 나란히 그려 넣고, CSS
 * (\`styles.css\`의 \`.app-logo-light\`/\`.app-logo-dark\`)가 표시를 테마별로 가른다
 * — 라이트 이미지는 라이트에서만, 다크 이미지는 다크에서만 \`display: block\`이다.
 * 둘 다 \`alt="돈길"\`.
 */
export const LOGO_LIGHT_DATA_URI = 'data:image/png;base64,${logoLightB64}';
export const LOGO_DARK_DATA_URI = 'data:image/png;base64,${logoDarkB64}';

/** 두 원본의 실제 픽셀 치수(둘 다 같다) — 헤더가 표시 크기를 정할 때 가로세로 비율을 이 값에서 뗀다. */
export const LOGO_INTRINSIC_WIDTH = 1272;
export const LOGO_INTRINSIC_HEIGHT = 528;
`;

writeFileSync(LOGO_OUT, logoOut, 'utf8');
console.log(
  `로고 데이터 URI 모듈을 다시 썼습니다: ${LOGO_OUT} (라이트 ${(logoLightB64.length / 1024).toFixed(1)}KB · 다크 ${(logoDarkB64.length / 1024).toFixed(1)}KB base64)`,
);

// ---------------------------------------------------------------------------
// man-icon — 예시 구역 입력 줄들 왼쪽에 놓는 사람 아이콘. 512×512.
// [2026-08-20, 소유자 지시] 김철수씨 아이콘 원본이 free-icon-man-3040730.png로
// 교체됐다 — 같은 export 이름을 유지하므로 소비처는 그대로다.
// ---------------------------------------------------------------------------
const MAN_ICON_SRC = 'src/design/free-icon-man-3040730.png';
const MAN_ICON_OUT = join(ROOT, 'src/web/assets/man-icon.js');

const manIconB64 = toBase64(MAN_ICON_SRC);

const manIconOut = `/**
 * 사람 아이콘 — 예시 구역(\`ui/example-showcase.js\`) 「나이/소득/월 납입금」
 * 입력 세 줄 왼쪽에 놓는다(관리자 지시, 2026-08-17 세 번째 회차 2번).
 *
 * **원본** — \`src/design/man-icon.png\`(512×512, 투명 배경, 검정 선화).
 *
 * **재생성** — \`node scripts/gen-logo-asset.mjs\`(로고와 같은 스크립트,
 * 로고 규약을 그대로 잇는다). 원본 PNG를 바꾼 뒤 이 명령만 다시 돌리면
 * 아래 문자열이 새로 갱신된다. **이 파일을 손으로 고치지 않는다.**
 *
 * 왜 데이터 URI인가 — \`scripts/gen-logo-asset.mjs\` 머리말(로고와 같은 이유,
 * 번들러 둘이 이미지 인라인을 각자 구현하지 않게 하려는 것).
 *
 * **다크 모드 반전** — 원본이 검정 선화라 다크 배경에서 묻힌다(실측,
 * 관리자 최종 보고). 새 파일을 추가하지 않고 \`styles.css\`의
 * \`.example-showcase-input-icon\`이 다크에서 \`filter: invert(1)\`을 건다.
 */
export const MAN_ICON_DATA_URI = 'data:image/png;base64,${manIconB64}';

/** 원본 자산의 실제 픽셀 치수(정사각형) — 표시 크기를 정할 때 가로세로 비율을 이 값에서 뗀다. */
export const MAN_ICON_INTRINSIC_WIDTH = 512;
export const MAN_ICON_INTRINSIC_HEIGHT = 512;
`;

writeFileSync(MAN_ICON_OUT, manIconOut, 'utf8');
console.log(`man-icon 데이터 URI 모듈을 다시 썼습니다: ${MAN_ICON_OUT} (${(manIconB64.length / 1024).toFixed(1)}KB base64)`);

// ---------------------------------------------------------------------------
// female-icon — 둘째 예시(이승은씨) 아이콘. 512×512.
// [2026-08-20, 소유자 지시] 예시가 두 행이 되며 새로 생겼다. man-icon과 같은
// 규약(데이터 URI 모듈, 손으로 안 고침, 다크 반전은 CSS 몫).
// ---------------------------------------------------------------------------
const FEMALE_ICON_SRC = 'src/design/free-icon-female-5740242.png';
const FEMALE_ICON_OUT = join(ROOT, 'src/web/assets/female-icon.js');

const femaleIconB64 = toBase64(FEMALE_ICON_SRC);

const femaleIconOut = `/**
 * 여성 아이콘 — 예시 구역 둘째 행(이승은씨, \`ui/example-showcase.js\`) 기본
 * 정보 줄들 왼쪽에 놓는다(소유자 지시, 2026-08-20).
 *
 * **원본** — \`src/design/free-icon-female-5740242.png\`(512×512, 투명 배경).
 *
 * **재생성** — \`node scripts/gen-logo-asset.mjs\`. 원본 PNG를 바꾼 뒤 이 명령만
 * 다시 돌리면 아래 문자열이 새로 갱신된다. **이 파일을 손으로 고치지 않는다.**
 *
 * 왜 데이터 URI인가 — \`scripts/gen-logo-asset.mjs\` 머리말(man-icon과 같은 이유).
 * 다크 모드에서 묻히면 man-icon처럼 CSS \`filter: invert(1)\`가 처리한다.
 */
export const FEMALE_ICON_DATA_URI = 'data:image/png;base64,${femaleIconB64}';

/** 원본 자산의 실제 픽셀 치수(정사각형). */
export const FEMALE_ICON_INTRINSIC_WIDTH = 512;
export const FEMALE_ICON_INTRINSIC_HEIGHT = 512;
`;

writeFileSync(FEMALE_ICON_OUT, femaleIconOut, 'utf8');
console.log(`female-icon 데이터 URI 모듈을 다시 썼습니다: ${FEMALE_ICON_OUT} (${(femaleIconB64.length / 1024).toFixed(1)}KB base64)`);
