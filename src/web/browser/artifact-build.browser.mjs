import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  openApp,
  skipWithoutChrome,
  sleep,
  FILL_REQUIRED_FIELDS,
  startStaticServer,
  launchChrome,
  openPage,
} from './harness.mjs';

/**
 * 배포 아티팩트(`dist/index.html`)의 실측 — `scripts/build.mjs`가 도는 것만으로는
 * 부족하다. **번들이 실제 Chrome에서 뜨는지**를 봐야 한다(D66).
 *
 * 이 저장소에서 세 번 겪은 것 — 모듈을 하나의 스코프로 합치는 번들러는 이름
 * 충돌이나 빠진 모듈이 있어도 Node의 나머지 검사에는 전혀 나타나지 않는다.
 * `src/`의 개별 테스트는 여전히 전부 통과하는데 산출물은 빈 화면일 수 있다 —
 * 실제로 이름 충돌로 세 번 막혔고, 한 번은 실패한 줄 모르고 옛 빌드를 발행할
 * 뻔했다. 그래서 이 검사가 배포 전 마지막 안전망이다.
 *
 * **먼저 빌드를 새로 돌린다.** 이 파일이 보는 것은 "지금 소스가 만드는 산출물"
 * 이지 디스크에 남아 있을지 모르는 옛 `dist/index.html`이 아니다.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let app;
let buildResult;

before(async () => {
  buildResult = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts/build.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (skipWithoutChrome) return;
  app = await openApp({ url: '/dist/index.html' });
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('빌드 스크립트가 성공한다(exit 0)', () => {
  assert.equal(
    buildResult.status,
    0,
    `scripts/build.mjs가 실패했습니다:\n${buildResult.stdout}\n${buildResult.stderr}`,
  );
});

test('빌드 출력이 이름 충돌 0을 보고한다', () => {
  assert.match(buildResult.stdout, /이름 충돌 0/, `빌드 출력에 충돌 0 보고가 없습니다:\n${buildResult.stdout}`);
});

test('아티팩트를 열어도 boot-fail이 비어 있다 — 부팅 중 예외가 없었다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await sleep(300); // 모듈 스크립트 평가 + mountApp이 끝날 시간
  const failText = await page.evaluate(`document.getElementById('boot-fail').textContent`);
  assert.equal(failText, '', `아티팩트가 부팅 중 죽었습니다: ${failText}`);
  assert.deepEqual(page.pageErrors, [], `페이지에서 처리되지 않은 예외가 있었습니다: ${JSON.stringify(page.pageErrors)}`);
});

test('입력 패널과 초기 자리표시자가 실제로 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(await page.evaluate(`!!document.getElementById('birthDate')`), true, '입력 폼이 렌더되지 않았습니다');
  assert.equal(
    await page.evaluate(`!!document.querySelector('.result-placeholder .placeholder-ring')`),
    true,
    '입력 전 자리표시자가 렌더되지 않았습니다',
  );
});

test('필수 입력을 채우면 아티팩트 안에서 실제로 계산 결과가 렌더된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(600);

  const donut = await page.evaluate(`(() => {
    const svg = document.querySelector('.result-slot svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const paths = [...svg.querySelectorAll('path')].map((p) => (p.getAttribute('d') || '').length);
    return { width: r.width, height: r.height, paths };
  })()`);
  assert.ok(donut, '결과 도넛 SVG가 없습니다 — 엔진 룰셋 인라인이 깨졌을 수 있습니다');
  assert.ok(donut.width > 0 && donut.height > 0, `도넛이 0×0으로 그려졌습니다: ${JSON.stringify(donut)}`);
  assert.ok(donut.paths.length > 0 && donut.paths.every((len) => len > 0), '조각 path가 비어 있습니다');

  const amountText = await page.evaluate(`document.querySelector('.result-slot').textContent`);
  assert.match(amountText, /\d/, '결과 영역에 계산된 숫자가 없습니다');

  // 부팅 후에도 boot-fail이 비어 있어야 한다 — 계산 도중 예외가 나면 여기 남는다.
  assert.equal(await page.evaluate(`document.getElementById('boot-fail').textContent`), '');
});

test('공개 배포 기본값 — 아티팩트 안내문(artifact-note)이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(
    await page.evaluate(`!!document.querySelector('.artifact-note')`),
    false,
    '기본 빌드에 내부 미리보기 안내문이 남아 있습니다 — scripts/build.mjs 기본값을 확인하세요',
  );
});

// **뒤집힌 검사.** 요구사항 템플릿은 "자문이 아님 고지가 결과 화면에 표시된다"를
// 완료 기준으로 든다. 그러나 이 저장소의 실제 판정(D59~D61)은 그 반대다 —
// 소유자가 세 회차에 걸쳐 성격·자격·유보 문구를 전부 지우라고 명시했고,
// D60은 「고지 배너가 렌더된다」를 요구하는 검사가 있으면 지우지 말고 **뒤집어**
// 「그 문구가 없다」로 두라고 못 박았다(낡은 체크리스트가 올바른 구현을 결함으로
// 잡는 것을 막기 위해서). 그래서 여기서도 뒤집는다 — 다만 이 충돌은 조용히
// 넘기지 않고 최종 보고에 그대로 올린다.
// 정확한 지운 문장(gate-decisions.md D64가 인용한 원문)만 짚는다. "세무사법"
// 단어 자체는 배제 사유의 조항 근거(예: 시행령 제33조)로 정당하게 남아 있을 수
// 있으므로(D61 "배제 사유의 조항 칩은 남긴다"), 넓게 그 단어를 금지하면 오탐이다.
const REMOVED_DISCLOSURE_PHRASES = [
  '상담·자문이나 신고 대리', // DISCLOSURE.nature
  '세무사법 제6조', // DISCLOSURE.qualification — 등록 세무대리인 관련 조항
  '세무대리인이 아닙니다',
  '세무사 등 자격자 확인이 필요합니다', // DISCLOSURE.limit
];
test('D60/D61 — 성격·자격·유보 고지 세 문장이 화면에 없다(소유자 지시로 전부 삭제됨)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(await page.evaluate(`!!document.querySelector('.disclosure-banner, [class*="disclosure"], .limit-note')`), false);
  // **`textContent`가 아니라 `innerText`를 쓴다.** 이 페이지는 `<script type="module">`
  // 안에 번들된 소스 전체(주석 포함)를 담고 있고, `textContent`는 렌더되지 않는
  // `<script>` 텍스트까지 훑는다 — 실제로 지워진 문장을 "왜 지웠는가"를 설명하는
  // 주석(`result-panel.js` 1422행)이 그대로 걸려 거짓 실패가 났다. `innerText`는
  // 실제로 화면에 그려지는 것만 본다.
  const bodyText = await page.evaluate(`document.body.innerText`);
  for (const phrase of REMOVED_DISCLOSURE_PHRASES) {
    assert.equal(bodyText.includes(phrase), false, `지워졌어야 할 고지 문구가 화면에 남아 있습니다: "${phrase}"`);
  }
});

/**
 * [2026-08-14, 관리자 지시 — 배포 번들 실측 회귀] "배포 번들을 실제로
 * 렌더해 보니 줄바꿈이 흉하게 깨진다. 네 실측과 산출물이 다르다."
 *
 * **왜 여기(번들 대상 검사)에 있어야 하는가.** 개발 서버(`<link>` 스타일
 * 복제)만 재고 통과 판정을 내린 것이 이번 회귀의 직접 원인이다 — 번들은
 * `<style>` 인라인 복제 경로를 타고, `.example-showcase-amount .amount-card`
 * 의 `align-items: center`가 `.amount-card-value`의 실제 사용 가능 폭을
 * 카드 폭보다 크게 잡히게 만드는 결함(원인, `styles.css`의 `.amount-card`
 * 규칙 주석 참고)은 두 경로 모두에서 재현됐지만, "네 실측과 산출물이
 * 다르다"는 관리자 지적을 다시 만들지 않으려면 **번들을 직접 열어** 잰다.
 *
 * 1440px(관리자가 실측한 폭)에서 (1) 절세액의 각 금액 덩어리
 * (`.amount-value-chunk`)가 정확히 한 줄이고 — "1,713,690원"의 "원"이
 * 혼자 떨어지는 결함이 재발하지 않는다는 뜻이다 — (2) 물음 문장·입력 줄이
 * 예시 구역 폭을 넘지 않는다(가로 스크롤을 만들지 않는다)는 것을 실측한다.
 *
 * **[2026-08-17, D71 + 소유자 지시 1번] 뒤집힌 기대값 둘.** 헤드라인이
 * 구간(최대 두 덩어리)에서 확정 단일 값(정확히 한 덩어리)으로 줄었다(D71)
 * — 옛 "2개 이상"을 "정확히 1개"로 뒤집는다. 입력도 한 줄(`.example-
 * showcase-inputs-line`)에서 세 줄(`.example-showcase-input-line`, 공유
 * 클래스)로 갈렸다 — 셋 다 넘치지 않는지 잰다.
 */
test('배포 번들, 1440px — 예시의 절세액 금액 덩어리가 중간에서 줄이 꺾이지 않는다("원" 고아 회귀 방지)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.amount-value-chunk'));
  })()`, { timeoutMs: 8000 });
  await sleep(300);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const chunks = [...root.querySelectorAll('.amount-value-chunk')];
    const section = root.querySelector('.example-showcase');
    const question = root.querySelector('.example-showcase-question-top');
    const questionText = root.querySelector('.example-showcase-question-text');
    // [2026-08-20, 관리자 지시] 옛 .example-showcase-input-line(단일 인물,
    // 세 줄)은 두 행(각 네 줄)의 .example-persona-line으로 바뀌었다 — 8개.
    const inputLines = [...root.querySelectorAll('.example-persona-line')];
    const sectionRect = section.getBoundingClientRect();
    // [2026-08-18, 관리자 지시(5차) 1번] 줄 수를 요소 자체가 아니라 Range로
    // 잰다 — .example-showcase-question은 flex 컨테이너(h2)라
    // getClientRects()가 내부 줄바꿈과 무관하게 항상 박스 하나(rect 1개)를
    // 낸다 — 안의 텍스트가 몇 줄로 꺾이든 속지 않으려면 실제 텍스트 조각을
    // 감싼 Range로 재야 한다(줄마다 별도 rect가 나온다).
    const range = document.createRange();
    range.selectNodeContents(questionText);
    return {
      chunkCount: chunks.length,
      chunkRectCounts: chunks.map((c) => c.getClientRects().length),
      chunkTexts: chunks.map((c) => c.textContent),
      questionOverflows: question.getBoundingClientRect().width > sectionRect.width + 1,
      questionLineCount: range.getClientRects().length,
      inputLineCount: inputLines.length,
      inputLineOverflows: inputLines.map((el) => el.getBoundingClientRect().width > sectionRect.width + 1),
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);

  // [2026-08-20, 관리자 지시로 뒤집힌 기대값] 예시가 두 사람(김철수씨·
  // 이승은씨)으로 늘어 카드도 2개, 덩어리도 카드당 하나씩 2개다.
  assert.equal(m.chunkCount, 2, `D71 — 배포 번들에서 금액 덩어리가 정확히 2개(카드 2개 × 1덩이)여야 한다: ${m.chunkCount}`);
  for (const [i, count] of m.chunkRectCounts.entries()) {
    assert.equal(
      count,
      1,
      `배포 번들 1440px — 금액 덩어리 ${i}("${m.chunkTexts[i]}")이 ${count}개 줄로 쪼개졌다 — "원"이 혼자 떨어지는 결함이 재발했다`,
    );
  }
  assert.equal(m.questionOverflows, false, '배포 번들 1440px — 물음 문장이 예시 구역 폭을 넘는다');
  // [2026-08-18, 관리자 지시(5차) 1번] 물음이 1440px에서 한 줄이다.
  assert.equal(m.questionLineCount, 1, `배포 번들 1440px — 물음이 한 줄이 아니다(${m.questionLineCount}줄로 꺾였다)`);
  assert.equal(m.inputLineCount, 8, `배포 번들 1440px — 입력 줄이 정확히 8개(두 행 × 네 줄)여야 한다: ${m.inputLineCount}`);
  for (const [i, overflows] of m.inputLineOverflows.entries()) {
    assert.equal(overflows, false, `배포 번들 1440px — 입력 줄 ${i}이 예시 구역 폭을 넘는다`);
  }
  assert.equal(m.docOverflowsX, false, '배포 번들 1440px — 가로 스크롤이 생겼다');

  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * 위 검사와 같은 것을 375px(모바일)에서도 잰다 — 관리자가 두 폭 모두
 * 확인하라고 명시했다.
 */
test('배포 번들, 375px — 예시의 절세액 금액 덩어리가 중간에서 줄이 꺾이지 않고, 카드 폭을 넘지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.amount-value-chunk'));
  })()`, { timeoutMs: 8000 });
  await sleep(300);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const chunks = [...root.querySelectorAll('.amount-value-chunk')];
    const cards = [...root.querySelectorAll('.amount-card')];
    const valueOverflowsCard = cards.map((card) => {
      const value = card.querySelector('.amount-card-value');
      const vr = value.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      return vr.width > cr.width + 1;
    });
    return {
      chunkCount: chunks.length,
      chunkRectCounts: chunks.map((c) => c.getClientRects().length),
      valueOverflowsCard,
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);

  // [2026-08-20, 관리자 지시로 뒤집힌 기대값] 두 카드 × 한 덩이씩 = 2.
  assert.equal(m.chunkCount, 2, `D71 — 배포 번들 375px에서 금액 덩어리가 정확히 2개(카드 2개 × 1덩이)여야 한다: ${m.chunkCount}`);
  for (const [i, count] of m.chunkRectCounts.entries()) {
    assert.equal(count, 1, `배포 번들 375px — 금액 덩어리 ${i}이 ${count}개 줄로 쪼개졌다`);
  }
  for (const [i, overflows] of m.valueOverflowsCard.entries()) {
    assert.equal(overflows, false, `배포 번들 375px — ${i}번 카드에서 절세액이 카드 폭을 넘는다`);
  }
  assert.equal(m.docOverflowsX, false, '배포 번들 375px — 가로 스크롤이 생겼다');

  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-16, D70로 재작업] **좌우 2열 배치의 정렬을 번들 대상으로 세운다.**
 *
 * **왜 여기(번들)에 다시 세우는가.** `example-showcase.browser.mjs`에 같은
 * 종류의 정렬 검사가 이미 있지만, 그 파일은 기본 `openApp()`으로 **개발
 * 서버**(`<link rel="stylesheet">`)를 연다. 관리자가 실제로 크롭해 어긋남을
 * 발견한 전례가 있는 것은 **번들**(`dist/index.html`, 인라인 `<style>`)
 * 이었다 — 두 경로가 이번에도 다를 수 있다는 것이 그 지적의 핵심이라, 같은
 * 수치를 번들에서 별도로 다시 잰다.
 *
 * **D70로 판정 기준이 뒤집혔다.** 옛(세 번째 정정) 검사는 "모든 콘텐츠가
 * 카드 한가운데 축에 있다"였다 — 그때는 세로 흐름(문구→절세액→도넛→범례→
 * 화살표) 배치였기 때문이다. D70는 좌우 2열로 다시 짰으므로, 이제는
 *
 * - **1440px(2열)**: 문구는 왼쪽 칸의 왼쪽 가장자리에 붙어야 하고(카드
 *   중심이 아니다), 도넛/범례는 오른쪽 칸 안에서 가로 가운데, 절세액/화살표는
 *   두 열을 합친 카드 전체에서 가로 가운데.
 * - **375px(1열로 붕괴)**: 이 폭에서는 `.example-showcase`가
 *   `grid-template-columns: 1fr` 하나뿐이라(모바일 미디어쿼리, `styles.css`)
 *   왼쪽 칸도 카드 전체 폭을 그대로 쓴다 — 이 폭에서는 문구도 가운데
 *   정렬로 보인다(모바일 미디어쿼리가 `.example-showcase-text-col`에
 *   `text-align: center`를 준다). 그래서 375px에서는 옛 방식대로 전부
 *   카드 중심과 일치하는지를 잰다.
 *
 * **허용 오차 2px** — 서브픽셀 반올림 여유(`example-showcase.browser.mjs`의
 * 개발 서버 검사와 같은 값).
 */
/**
 * [2026-08-20, 관리자 지시로 뒤집힌 기대값] **옛(D70~5차) 검사는 좌우 2열
 * 배치(왼쪽 문구 칸·오른쪽 도넛 칸)를 전제했다.** 예시가 두 사람으로 늘며
 * 그 grid 자체를 걷어내고 "물음(왼쪽 상단) → 인물 행 두 개(기본 정보 →
 * 도넛 → 세액공제액, 가로)"로 다시 짰다(`ui/example-showcase.js`,
 * `styles.css`의 `.example-showcase-multi-persona`). 지우지 않고 뒤집는다 —
 * 이제 확인할 것은 (1) 물음이 왼쪽 정렬이고 두 행보다 위에 있다, (2) 두 행
 * 모두 왼쪽부터 기본 정보 → 도넛 → 세액공제액 순으로 선다, (3) 문서 가로
 * 스크롤이 없다.
 */
test('관리자 지시 — 배포 번들, 1440px — 물음은 왼쪽 상단, 두 행 모두 기본 정보 → 도넛 → 세액공제액 순으로 가로 배치된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const READ_LAYOUT = `(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const section = root.querySelector('.example-showcase');
    const question = root.querySelector('.example-showcase-question-top');
    const rows = [...root.querySelectorAll('.example-persona-row')];
    const infoCols = [...root.querySelectorAll('.example-persona-info')];
    const donutCols = [...root.querySelectorAll('.example-persona-donut-col')];
    const amountCols = [...root.querySelectorAll('.example-persona-amount')];
    const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    return {
      sectionLeft: rectOf(section).left,
      questionRect: question ? rectOf(question) : null,
      rowCount: rows.length,
      rowTops: rows.map((r) => rectOf(r).top),
      infoRects: infoCols.map(rectOf),
      donutRects: donutCols.map(rectOf),
      amountRects: amountCols.map(rectOf),
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`;
  const TOLERANCE_PX = 2;

  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.example-showcase-scroll-arrow'));
  })()`, { timeoutMs: 8000 });
  await sleep(300);
  const data = await page.evaluate(READ_LAYOUT);

  assert.ok(data.questionRect, '배포 번들 1440px — 물음을 찾지 못했다');
  assert.ok(
    Math.abs(data.questionRect.left - data.sectionLeft) <= 40,
    `배포 번들 1440px — 물음(${data.questionRect.left})이 예시칸 왼쪽(${data.sectionLeft})에서 너무 멀다`,
  );
  assert.equal(data.rowCount, 2, '배포 번들 1440px — 인물 행이 2개여야 한다');
  assert.ok(
    data.questionRect.bottom <= data.rowTops[0] + 1,
    `배포 번들 1440px — 물음(${data.questionRect.bottom})이 1행(${data.rowTops[0]})보다 위에 있지 않다`,
  );

  for (let i = 0; i < 2; i++) {
    assert.ok(
      data.infoRects[i].right <= data.donutRects[i].left + TOLERANCE_PX,
      `배포 번들 1440px — ${i}행 기본 정보(오른쪽 ${data.infoRects[i].right})가 도넛(왼쪽 ${data.donutRects[i].left})보다 왼쪽에 있지 않다`,
    );
    assert.ok(
      data.donutRects[i].right <= data.amountRects[i].left + TOLERANCE_PX,
      `배포 번들 1440px — ${i}행 도넛(오른쪽 ${data.donutRects[i].right})이 세액공제액(왼쪽 ${data.amountRects[i].left})보다 왼쪽에 있지 않다`,
    );
  }
  assert.equal(data.docOverflowsX, false, '배포 번들 1440px — 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('배포 번들, 375px — 1열로 붕괴한 뒤에도 두 행이 온전히 렌더되고, 가로 스크롤이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const READ_MOBILE = `(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const section = root.querySelector('.example-showcase');
    const rows = [...root.querySelectorAll('.example-persona-row')];
    const donuts = [...root.querySelectorAll('.chart-donut')];
    const amountCards = [...root.querySelectorAll('.amount-card')];
    const sectionRect = section.getBoundingClientRect();
    return {
      rowCount: rows.length,
      donutCount: donuts.length,
      amountCardCount: amountCards.length,
      rowOverflows: rows.map((r) => r.getBoundingClientRect().right > sectionRect.right + 1),
    };
  })()`;

  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1200, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.example-showcase-scroll-arrow'));
  })()`, { timeoutMs: 8000 });
  await sleep(300);
  const data = await page.evaluate(READ_MOBILE);
  assert.equal(data.rowCount, 2, '배포 번들 375px — 인물 행이 2개여야 한다');
  assert.equal(data.donutCount, 2, '배포 번들 375px — 도넛이 2개여야 한다');
  assert.equal(data.amountCardCount, 2, '배포 번들 375px — 세액공제액 카드가 2개여야 한다');
  for (const [i, overflows] of data.rowOverflows.entries()) {
    assert.equal(overflows, false, `배포 번들 375px — ${i}행이 예시 카드 오른쪽 경계를 넘는다`);
  }
  const docOverflowsX = await page.evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
  assert.equal(docOverflowsX, false, '배포 번들 375px — 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-16, D70 → 2026-08-17, 소유자 지시 5번 → 2026-08-17, 관리자
 * 지시(2차) 7번 → 2026-08-17, 관리자 지시(3차) 4번으로 다시 줄었다] 옛(D70)
 * "3배 정도"(192px)는 소유자 지시 5번의 세로 예산을 맞추려고 140px로,
 * 헤더가 다시 sticky가 되며 112px로, 그리고 **로고가 +30%(관리자 지시
 * (3차) 1번) 되며 헤더 바 높이가 다시 바뀌어 100px로 줄었다**(−10%, 정확한
 * 값과 근거는 `styles.css`의 `.example-showcase-scroll-arrow` 주석).
 * **지우지 않고 뒤집는다** — 옛 64px의 1.5배(96px)는 넘지만 2배(128px)에는
 * 못 미치고, D70의 192px보다는 여전히 작다는 것이 지금의 사실이다. 여전히
 * (1) 카드(섹션) 폭을 넘지 않는다, (2) 문서 가로 스크롤을 만들지 않는다,
 * (3) 카드 가로 중심에 있다를 함께 확인한다.
 */
test('관리자 지시(3차) 4번 — 배포 번들, 1440px — 이동 화살표가 옛 64px의 1.5배(100px)이고 D70의 192px보다는 작다, 카드를 넘지 않으며, 카드 가로 중심에 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.example-showcase-scroll-arrow'));
  })()`, { timeoutMs: 8000 });
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const section = root.querySelector('.example-showcase');
    const arrow = root.querySelector('.example-showcase-scroll-arrow');
    const ar = arrow.getBoundingClientRect();
    const sr = section.getBoundingClientRect();
    return {
      width: ar.width, height: ar.height,
      arrowCenterX: ar.left + ar.width / 2, cardCenterX: sr.left + sr.width / 2,
      overflowsCard: ar.width > sr.width + 1,
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);
  const OLD_SIZE_PX = 64;
  const D70_SIZE_PX = 192;
  assert.equal(m.width, 100, `배포 번들 — 화살표 폭이 100px가 아니다: ${m.width}`);
  assert.ok(m.width >= OLD_SIZE_PX * 1.5, `배포 번들 — 화살표 폭(${m.width}px)이 옛 64px의 1.5배에도 못 미친다`);
  assert.ok(m.width < D70_SIZE_PX, `배포 번들 — 화살표 폭(${m.width}px)이 D70의 192px보다 작아야 한다`);
  assert.ok(m.height >= OLD_SIZE_PX * 1.5, `배포 번들 — 화살표 높이(${m.height}px)가 옛 64px의 1.5배에도 못 미친다`);
  assert.equal(m.overflowsCard, false, `배포 번들 — 화살표(${m.width}px)가 카드 폭(${m.width > 0 ? '위 값' : ''})을 넘는다`);
  assert.equal(m.docOverflowsX, false, '배포 번들 — 화살표 때문에 문서 가로 스크롤이 생겼다');
  assert.ok(
    Math.abs(m.arrowCenterX - m.cardCenterX) <= 2,
    `배포 번들 — 화살표 가로 중심(${m.arrowCenterX})이 카드 중심(${m.cardCenterX})과 2px 넘게 어긋난다`,
  );
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-17, 소유자 지시 5번] **수용 기준 그 자체 — "화살표 버튼이 첫
 * 랜딩 화면 맨 아래에 보이는 것".** 20%는 수단이고 이것이 목표다. 스크롤
 * 없이(`window.scrollTo(0, 0)` 이후, 첫 페인트 그대로) 화살표 전체가
 * 1440×900 뷰포트 안에 있는지를 `getBoundingClientRect().bottom <=
 * 뷰포트 높이`로 잰다 — **번들**(`dist/index.html`)에서, 개발 서버가 아니라.
 */
test('소유자 지시 5번 — 배포 번들, 1440×900에서 화살표 전체가 스크롤 없이 첫 화면 안에 보인다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.example-showcase-scroll-arrow'));
  })()`, { timeoutMs: 8000 });
  await page.evaluate(`window.scrollTo(0, 0)`);
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const arrow = host.shadowRoot.querySelector('.example-showcase-scroll-arrow');
    const r = arrow.getBoundingClientRect();
    return { bottom: r.bottom, top: r.top, viewportH: window.innerHeight };
  })()`);
  assert.ok(
    m.bottom <= m.viewportH,
    `배포 번들 1440×900 — 화살표 아래쪽(${m.bottom})이 뷰포트 높이(${m.viewportH})를 넘는다 — 스크롤해야 보인다`,
  );
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-17, 소유자 지시 5번] **1366×768(흔한 노트북 해상도)에서도 재
 * 보고 결과를 보고하라는 지시.** 이 폭에서는 통과를 강제하지 않는다 —
 * 관리자 보고에 사실만 적는다(owner 지시 원문: "안 들어가면 사실만
 * 적어라"). 그래서 이 검사는 **던지지 않는다** — `assert`가 아니라 실측값을
 * 그대로 콘솔에 남기고 통과시킨다. 값 자체는 `after()` 훅에서 다시 한번
 * 모아 로그로 남긴다(사람이 스크롤하지 않고도 결과를 볼 수 있게).
 */
let measured1366x768 = null;
test('소유자 지시 5번 — 배포 번들, 1366×768 실측(강제하지 않는다, 사실만 기록)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.example-showcase-scroll-arrow'));
  })()`, { timeoutMs: 8000 });
  await page.evaluate(`window.scrollTo(0, 0)`);
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const arrow = host.shadowRoot.querySelector('.example-showcase-scroll-arrow');
    const r = arrow.getBoundingClientRect();
    return { bottom: r.bottom, top: r.top, viewportH: window.innerHeight };
  })()`);
  measured1366x768 = { ...m, fits: m.bottom <= m.viewportH, overflowPx: Math.max(0, m.bottom - m.viewportH) };
  console.log(`[1366×768 실측] 화살표 bottom=${m.bottom.toFixed(1)}px, 뷰포트=${m.viewportH}px, ${measured1366x768.fits ? '들어간다' : `넘친다(${measured1366x768.overflowPx.toFixed(1)}px)`}`);
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-17, 소유자 스크린샷 회귀] **아티팩트 뷰어처럼 "감싸인" 조건을
 * 그대로 재현해 예시 구역이 실제로 스타일을 입는지 실측한다.**
 *
 * **왜 이 검사가 필요한가.** 위의 다른 모든 검사는 `dist/index.html`을
 * *그대로*(감싸지 않고) 연다 — 개발 서버(`<link>`)든 번들(`<style>`)이든
 * "첫 스타일이 곧 우리 스타일"인 조건에서만 잰다. 그런데 소유자가 실제로
 * 보는 아티팩트 발행 시스템은 우리 산출물(콘텐츠만, doctype 없음)을 **자기
 * skeleton으로 감싸면서 최소 CSS reset을 그 skeleton의 `<head>`에 먼저
 * 주입한다** — 그러면 우리 번들 안에 있던 `<head><style>…</style></head>`는
 * 중첩된 `<head>`가 되어(HTML 파싱 규칙상 이미 `<body>` 안에 들어간 뒤
 * 만나는 `<head>` 시작 태그는 무시된다) 그 안의 우리 `<style>`이
 * `<body>`의 자식으로 재배치된다. 이 조건은 위 검사들 어디서도 만들어지지
 * 않으므로, 여기서 별도로 만든다.
 *
 * **주입 reset은 실제 아티팩트 reset을 흉내 낸 몇 줄이면 충분하다** —
 * `ul { list-style: disc; }`만으로도 목록 점 결함이 그대로 드러난다(다른
 * 결함들 — 검은 배지·빈 네모 버튼·그리드 붕괴 — 은 reset이 무엇을 하든
 * 안 하든, 우리 스타일이 전혀 안 실린 것 자체가 원인이라 이 reset의
 * 내용과 무관하게 재현된다).
 *
 * **판별력을 직접 깨서 확인했다(관리자 실측, 2026-08-17).**
 * `example-showcase.js`의 `attachHostStyles`를 고치기 전 코드(`document.
 * querySelector('head > style')`로 첫 번째만 복제)로 되돌리고 이 검사를
 * 돌리면, 아래 다섯 단언이 정확히 소유자가 스크린샷으로 보낸 증상 그대로
 * 실패한다 — 범례 `list-style: disc`(목록 점), 범례 색 견본이 크기 없는
 * 인라인 `<span>`(스타일이 안 실리면 `width`가 CSS 지정값 14px이 아니라
 * 0에 가깝다 — [2026-08-17, D72] 배지가 없어져 옛 "검은 점" 신호를 대신한다,
 * 아래 주석), 화살표 버튼이 16px 안팎의 브라우저 기본 버튼 테두리(빈 네모),
 * `.example-showcase`의 `display: block`(2열 그리드 붕괴). 고친 코드로
 * 되돌리면 다섯 다 통과한다 — 이 검사는 결함이 있을 때만 빨갛다.
 */
test('아티팩트 뷰어처럼 감싼 조건에서도 예시 구역이 실제로 스타일을 입는다(소유자 스크린샷 회귀)', { skip: skipWithoutChrome }, async () => {
  const distHtml = readFileSync(path.join(REPO_ROOT, 'dist/index.html'), 'utf8');
  // "우리 파일(콘텐츠만, doctype 없음)" — 첫 줄의 <!doctype html>만 뗀다.
  const contentOnly = distHtml.replace(/^<!doctype html>\s*/i, '');
  // 실제 아티팩트 reset을 흉내 낸 몇 줄 — 목록 점·기본 fill이 드러나게 한다.
  const FAKE_ARTIFACT_RESET = 'ul { list-style: disc; } * { box-sizing: border-box; }';
  const wrapped =
    `<!doctype html>\n<html><head><style>${FAKE_ARTIFACT_RESET}</style></head><body>\n` +
    `${contentOnly}\n</body></html>\n`;

  const siteDir = mkdtempSync(path.join(tmpdir(), 'artifact-wrap-'));
  writeFileSync(path.join(siteDir, 'index.html'), wrapped, 'utf8');

  const server = await startStaticServer(siteDir);
  const chrome = await launchChrome();
  try {
    const page = await openPage(chrome.browserWsUrl, `${server.origin}/index.html`);
    try {
      await page.waitFor(
        `(() => {
          const host = document.querySelector('.example-showcase-slot');
          return !!(host && host.shadowRoot && host.shadowRoot.querySelector('.example-showcase-scroll-arrow'));
        })()`,
        { timeoutMs: 10000 },
      );
      await sleep(400);

      const m = await page.evaluate(`(() => {
        const host = document.querySelector('.example-showcase-slot');
        const root = host.shadowRoot;
        const section = root.querySelector('.example-showcase');
        const arrowBtn = root.querySelector('.example-showcase-scroll-arrow');
        const arrowWrap = root.querySelector('.example-showcase-arrow-wrap');
        const labelGroup = root.querySelector('.donut-slice-label-group');
        // [2026-08-20] 도넛이 둘(두 행)이므로 라벨을 1행 도넛에 스코프한다 —
        // 안 그러면 6개(3+3)가 나와 "3개" 기대값이 깨진다.
        const donut = root.querySelector('.chart-donut');
        const labelEls = donut ? [...donut.querySelectorAll('.donut-slice-label')] : [];
        const heroCopy = root.querySelector('.example-hero-copy');
        return {
          sectionDisplay: section ? getComputedStyle(section).display : null,
          // [2026-08-20, 관리자 지시(2차) 1번] 레전드를 통째로 뺐다 — 그
          // 스타일 로드 신호(list-style: none·스와치 크기)도 함께 없어졌다.
          // 대신 도넛 자체의 렌더 폭(176px, .example-persona-donut-col
          // .chart-donut)을 신호로 쓴다 — 스타일이 안 실리면 SVG 고유
          // viewBox 크기(220px 안팎)로 남아 이 값과 다르다.
          donutWidth: donut ? donut.getBoundingClientRect().width : null,
          heroCopyGap: heroCopy ? getComputedStyle(heroCopy).gap : null,
          arrowBtnWidth: arrowBtn ? arrowBtn.getBoundingClientRect().width : null,
          // [2026-08-20, 관리자 지시(2차) 5번 — 뒤집힌 기대값] 화살표 색이
          // rgb(0, 255, 153)(형광 민트, 지난 회차)에서 rgb(230, 115, 0)
          // (주황)로 다시 바뀌었다 — 브라우저 기본 버튼 글자색은 둘 다 될
          // 수 없으므로 여전히 "우리 <style>이 실렸는가"의 신호로 쓴다.
          arrowBtnColor: arrowBtn ? getComputedStyle(arrowBtn).color : null,
          // [2026-08-17, D72] 새 구조도 감싼 조건에서 스타일을 입는지 함께
          // 확인한다 — 조각 이름+비율 라벨 그룹의 pointer-events(CSS 규칙
          // 적용 여부의 대리 지표)와 화살표 칸의 애니메이션(감싼 조건도
          // 우리 <style>을 그대로 복제하므로 걸려 있어야 한다).
          labelGroupPointerEvents: labelGroup ? getComputedStyle(labelGroup).pointerEvents : null,
          labelTextCount: labelEls.length,
          arrowWrapAnimationName: arrowWrap ? getComputedStyle(arrowWrap).animationName : null,
        };
      })()`);

      // [2026-08-20, 관리자 지시(2차) 1번 — 뒤집힌 기대값] 옛 검사는 범례
      // 스타일(list-style: none·스와치 크기)로 CSS 로드를 확인했다 — 레전드
      // 자체가 없어졌으므로 도넛 렌더 폭(176px)으로 신호를 바꾼다.
      assert.equal(
        m.donutWidth,
        176,
        `아티팩트처럼 감싼 조건 — 도넛 렌더 폭이 176px가 아니다(width: ${m.donutWidth}px) — 스타일이 실리지 않았을 수 있다`,
      );
      assert.ok(
        m.heroCopyGap && m.heroCopyGap !== '0px',
        `아티팩트처럼 감싼 조건 — 히어로 카피 블록 간격이 0이다(gap: ${m.heroCopyGap}) — 스타일이 실리지 않았다`,
      );
      // [2026-08-17, 관리자 지시(3차) 4번] 화살표 실제 크기가 112px→100px로
      // 줄어(−10%) 옛 문턱값(>100)이 새 정상 크기(정확히 100px)를 걸러내게
      // 됐다 — 50px로 낮춘다. 여전히 브라우저 기본 버튼 크기(16px 안팎)의
      // 3배가 넘어 "스타일이 안 실렸다"는 신호와 "정상 크기(100px)"를
      // 가르는 판별력은 그대로다.
      assert.ok(
        m.arrowBtnWidth > 50,
        `아티팩트처럼 감싼 조건 — 이동 화살표가 브라우저 기본 버튼 크기(${m.arrowBtnWidth}px)로 그려진다 — 스타일이 실리지 않았다`,
      );
      assert.equal(
        m.arrowBtnColor,
        'rgb(230, 115, 0)',
        `아티팩트처럼 감싼 조건 — 화살표 색이 rgb(230, 115, 0)이 아니다(color: ${m.arrowBtnColor}) — 스타일이 실리지 않았다`,
      );
      // [2026-08-20, 관리자 지시] 옛(단일 인물, 2열 grid) 배치는 이제
      // .example-showcase-multi-persona 수정자가 flex로 바꾼다 — 뒤집힌
      // 기대값.
      assert.equal(
        m.sectionDisplay,
        'flex',
        `아티팩트처럼 감싼 조건 — 예시 구역이 flex(두 행 세로 배치)로 배치되지 않았다(display: ${m.sectionDisplay}) — 정렬이 무너졌다`,
      );
      // [2026-08-17, D72] 조각 이름+비율 라벨이 감싼 조건에서도 실제로
      // 그려지고(1행 도넛에 스코프해 3개), 그 스타일(pointer-events: none)이
      // 실린다.
      assert.equal(m.labelTextCount, 3, `아티팩트처럼 감싼 조건 — 1행 조각 위 이름+비율 라벨이 3개가 아니다: ${m.labelTextCount}`);
      assert.equal(
        m.labelGroupPointerEvents,
        'none',
        `아티팩트처럼 감싼 조건 — 조각 라벨 그룹의 pointer-events 규칙이 실리지 않았다: ${m.labelGroupPointerEvents}`,
      );
      // [2026-08-17, 소유자 지시 6번] 화살표 애니메이션도 감싼 조건에서
      // 걸려 있어야 한다 — 우리 <style>이 통째로 복제되므로 예외가 아니다.
      assert.notEqual(
        m.arrowWrapAnimationName,
        'none',
        '아티팩트처럼 감싼 조건 — 화살표 애니메이션이 걸려 있지 않다',
      );

      // [2026-08-17, 관리자 지시(3차) 1·2번] 로고(테마별)·man-icon도 감싼
      // 조건에서 실제로 스타일을 입는지 함께 확인한다. 로고는 빛 DOM
      // (shadow 경계 밖)이라 이 감싼 조건이 원래 겨눈 결함(예시의 shadow
      // DOM 스타일 유실)의 영향권 밖이어야 정상이고, man-icon은 예시와
      // 같은 shadow DOM 안에 있어 그 결함의 영향권 안에 있다 — 둘 다
      // 실측으로 직접 확인한다(짐작하지 않는다).
      const READ_LOGO_AND_ICON = `(() => {
        const light = document.querySelector('.app-logo-light');
        const dark = document.querySelector('.app-logo-dark');
        const icon = document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-persona-icon');
        const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        return {
          lightVisible: vis(light),
          darkVisible: vis(dark),
          iconWidth: icon ? icon.getBoundingClientRect().width : null,
          iconFilter: icon ? getComputedStyle(icon).filter : null,
          iconBackground: icon ? getComputedStyle(icon).backgroundColor : null,
        };
      })()`;

      const wrappedLight = await page.evaluate(READ_LOGO_AND_ICON);
      assert.equal(wrappedLight.lightVisible, true, '아티팩트처럼 감싼 조건(라이트) — 라이트 로고가 보이지 않는다');
      assert.equal(wrappedLight.darkVisible, false, '아티팩트처럼 감싼 조건(라이트) — 다크 로고가 보인다(테마 분기가 실리지 않았다)');
      assert.ok(
        wrappedLight.iconWidth > 5,
        `아티팩트처럼 감싼 조건 — man-icon이 크기 없이 그려진다(width: ${wrappedLight.iconWidth}px) — 스타일이 실리지 않았다`,
      );
      assert.ok(
        wrappedLight.iconFilter === 'none' || !wrappedLight.iconFilter,
        `아티팩트처럼 감싼 조건(라이트) — man-icon에 filter가 걸려 있다: ${wrappedLight.iconFilter}`,
      );

      // [2026-08-18, 관리자 지시(5차) 1번] **감싼 조건 + 1440×900 실측.**
      // 위(감싸지 않은 번들)에 있는 같은 종류의 실측(물음 한 줄·화살표
      // 첫 화면)을, 스타일 유실 결함이 실제로 일어나는 이 감싼 조건에서도
      // 반복한다 — 그리드 비율(`.example-showcase` 열 비율) 자체가 여기서
      // 안 실리면 물음 폭이 옛(1:1) 값으로 되돌아가 다시 두 줄로 꺾인다.
      await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(200);
      const wrapped1440 = await page.evaluate(`(() => {
        const host = document.querySelector('.example-showcase-slot');
        const root = host.shadowRoot;
        const questionText = root.querySelector('.example-showcase-question-text');
        const arrow = root.querySelector('.example-showcase-scroll-arrow');
        const range = document.createRange();
        range.selectNodeContents(questionText);
        return {
          questionLineCount: range.getClientRects().length,
          arrowBottom: arrow ? arrow.getBoundingClientRect().bottom : null,
          viewportH: window.innerHeight,
          docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()`);
      assert.equal(
        wrapped1440.questionLineCount,
        1,
        `아티팩트처럼 감싼 조건, 1440px — 물음이 한 줄이 아니다(${wrapped1440.questionLineCount}줄로 꺾였다)`,
      );
      assert.ok(
        wrapped1440.arrowBottom != null && wrapped1440.arrowBottom <= wrapped1440.viewportH,
        `아티팩트처럼 감싼 조건, 1440×900 — 화살표 아래쪽(${wrapped1440.arrowBottom}px)이 뷰포트 높이(${wrapped1440.viewportH}px)를 넘는다`,
      );
      assert.equal(wrapped1440.docOverflowsX, false, '아티팩트처럼 감싼 조건, 1440px — 가로 스크롤이 생겼다');
      await page.send('Emulation.clearDeviceMetricsOverride');

      await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`);
      await sleep(150);
      const wrappedDark = await page.evaluate(READ_LOGO_AND_ICON);
      assert.equal(wrappedDark.lightVisible, false, '아티팩트처럼 감싼 조건(다크) — 라이트 로고가 보인다');
      assert.equal(wrappedDark.darkVisible, true, '아티팩트처럼 감싼 조건(다크) — 다크 로고가 보이지 않는다');
      // [2026-08-20, 관리자 지시로 뒤집힌 기대값] 옛 검사는 다크에서 invert
      // filter를 기대했다 — 컬러 일러스트로 바뀌며 그 처방이 색을 뒤집는
      // 결함이 됐다. 지우지 않고 뒤집는다 — 다크에서도 filter가 없어야 하고,
      // 대신 옅은 원형 판(background)이 감싼 조건에서도 실려야 한다.
      assert.ok(
        wrappedDark.iconFilter === 'none' || !wrappedDark.iconFilter,
        `아티팩트처럼 감싼 조건(다크) — man-icon에 filter가 걸려 있다(색이 뒤집힐 수 있다): ${wrappedDark.iconFilter}`,
      );
      assert.notEqual(
        wrappedDark.iconBackground,
        'rgba(0, 0, 0, 0)',
        `아티팩트처럼 감싼 조건(다크) — man-icon 원형 판(background)이 실리지 않았다`,
      );
      await page.evaluate(`document.documentElement.removeAttribute('data-theme')`);
    } finally {
      page.close();
    }
  } finally {
    await chrome.close();
    await server.close();
    rmSync(siteDir, { recursive: true, force: true });
  }
});
