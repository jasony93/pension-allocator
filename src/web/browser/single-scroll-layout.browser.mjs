import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissDepletionIntroModalIfOpen } from './harness.mjs';

/**
 * 단일 페이지 스크롤 · 컨테이너 확대 (2026-08-12, D48) — 실제 렌더 실측.
 *
 * `docs/org/gate-decisions.md` D48·screens.md 11.9절 점검표를 코드로 고정한다.
 * **속성 검사가 아니라 위치 검사다** — `position: sticky`가 CSS에 있는지가
 * 아니라, 스크롤한 뒤 실제로 거기 있는지를 `getBoundingClientRect()`로 잰다.
 * 관리자가 잡은 기존 결함(`.result-panel-inner`의 `overflow: hidden`이 배너의
 * sticky 기준 컨테이너를 가로채, 문서가 "고정된다"고 적고 코드가
 * `position: sticky`를 가진 상태에서도 실제로는 고정되지 않던 것)이 바로 이
 * 형태였다 — CSS 속성이 있는지만 보는 검사는 이 결함을 통과시켰을 것이다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  // [2026-08-24, D84] calc2가 유일한 계산 탭이라 명시 필드 채움이 더는
  // 필요 없다 — 로드와 동시에 프리필로 결과가 선다(D79 판정 2).
  // [2026-08-25, D86] 다만 기본 랜딩 탭이 다시 시뮬레이터로 바뀌어 그
  // 프리필·결과가 그려지려면 이 탭으로 직접 전환해야 한다.
  await dismissDepletionIntroModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(300);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

async function setViewport(width, height = 1000) {
  await app.page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await sleep(150);
}

test('데스크톱 — `.calc2-result-slot`이 자체 스크롤 상자가 아니다(스크롤 막대가 하나다)', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440);
  const cs = await app.page.evaluate(`(() => {
    const el = document.querySelector('.calc2-result-slot');
    const s = getComputedStyle(el);
    return { position: s.position, overflowY: s.overflowY, maxHeight: s.maxHeight };
  })()`);
  assert.notEqual(cs.position, 'sticky', '.calc2-result-slot이 여전히 sticky면 자체 스크롤 상자로 남아 있을 수 있다');
  assert.notEqual(cs.overflowY, 'auto', '.calc2-result-slot이 overflow-y:auto면 스크롤 막대가 둘이다');
  // max-height가 뷰포트에 묶여 있으면(예: calc(100vh - 96px)) 내용이 넘칠 때
  // 결국 내부 스크롤이 생긴다. 'none'이거나 뷰포트보다 훨씬 큰 값이어야 한다.
  assert.ok(
    cs.maxHeight === 'none' || Number.parseFloat(cs.maxHeight) > 100000,
    `.calc2-result-slot의 max-height(${cs.maxHeight})가 뷰포트에 묶여 있다`,
  );
});

// **이 검사의 이력 — 같은 이름 아래 방향이 두 번 바뀌었다.**
//   1) 게이트 6(D33) — 헤더가 `position: sticky`로 처음 세워졌다.
//   2) 관리자 지시(2026-08-14) 3번 — 소유자 지시로 sticky를 풀었다. 이
//      자리는 그때 "헤더가 고정되지 **않는다**"를 확인하도록 뒤집혔었다.
//   3) [2026-08-17, 관리자 지시(2차) 1번, D72] — 소유자가 참조 사이트
//      (snowball72.com/pension-calculator)의 상단 고정 탭 바 방식을
//      지시하며 다시 고정하라고 했다. **나중 지시가 이긴다** — 검사를
//      지우지 않고 다시 뒤집는다. 다음에 이 자리를 보는 사람이 "왜 검사
//      이름과 내용이 어긋나 보이지"라고 어리둥절하지 않도록 이 이력을
//      남긴다.
// **속성 검사가 아니라 위치 검사다**(이 파일 머리말과 같은 원칙 — CSS 속성이
// 있는지가 아니라, 스크롤한 뒤 실제로 헤더가 뷰포트 위쪽에 계속 붙어 있는지를
// 잰다 — 관리자가 전에 잡은 실제 결함이 "문서는 sticky라고 적고 코드도
// `position: sticky`를 가졌는데 조상의 `overflow: hidden`이 sticky 기준
// 컨테이너를 가로채 실제로는 고정되지 않던 것"이었다. 속성만 보는 검사는 그
// 결함을 통과시켰을 것이다).
test('헤더가 고정된다 — 스크롤해도 헤더는 뷰포트 위쪽에 그대로 붙어 있다(D72)', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440, 900);
  const cs = await app.page.evaluate(`getComputedStyle(document.querySelector('.app-header')).position`);
  assert.equal(cs, 'sticky', `.app-header의 position이 sticky가 아니다: ${cs}`);

  await app.page.evaluate('window.scrollTo(0, 0)');
  await sleep(100);
  const before = await app.page.evaluate(`document.querySelector('.app-header').getBoundingClientRect().top`);
  assert.ok(Math.abs(before) < 2, `스크롤 맨 위에서 헤더 top(${before})이 0 근처가 아니다`);
  const inputPanelTopBefore = await app.page.evaluate(`document.querySelector('.input-panel')?.getBoundingClientRect().top ?? null`);

  await app.page.evaluate('window.scrollTo(0, 500)');
  await sleep(150);
  const after = await app.page.evaluate(`document.querySelector('.app-header').getBoundingClientRect().top`);
  // 고정됐다면 500px 스크롤해도 헤더의 뷰포트 기준 top은 여전히 0 근처여야 한다.
  assert.ok(Math.abs(after) < 2, `500px 스크롤 후 헤더 top(${after})이 0 근처가 아니다 — 고정되지 않은 것으로 보인다`);

  // 본문(입력 패널)은 실제로 스크롤되어 헤더 아래로 지나가야 한다 — "헤더만
  // 고정, 나머지는 그 아래로 흐른다"는 sticky의 정의 자체를 잰다. 절대
  // 위치(< 0)가 아니라 **이동량**을 본다 — 예시 구역 카드가 입력 패널
  // 위에 있어 스크롤 전 입력 패널 상단이 이미 뷰포트 훨씬 아래(양수, 500px
  // 넘게)일 수 있으므로, 500px 스크롤 뒤에도 여전히 양수(뷰포트 안)일 수
  // 있다 — 그 자체는 결함이 아니다. 결함은 "안 움직였다"이다.
  const inputPanelTopAfter = await app.page.evaluate(`document.querySelector('.input-panel')?.getBoundingClientRect().top ?? null`);
  if (inputPanelTopBefore != null && inputPanelTopAfter != null) {
    const moved = inputPanelTopBefore - inputPanelTopAfter;
    assert.ok(moved > 400, `500px 스크롤 후 입력 패널이 거의 움직이지 않았다(이동량 ${moved}px) — 본문이 스크롤되지 않은 것으로 보인다`);
  }
});

test('문서를 끝까지 스크롤하면 푸터가 실제로 뷰포트 안에 들어온다', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440, 1000);
  await app.page.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
  await sleep(150);
  const rect = await app.page.evaluate(`(() => { const r = document.querySelector('.app-footer').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })()`);
  const viewportHeight = await app.page.evaluate('window.innerHeight');
  assert.ok(rect.bottom <= viewportHeight + 2, `푸터 아래쪽(${rect.bottom})이 뷰포트(${viewportHeight}) 밖에 있다 — 도달 불가`);
  assert.ok(rect.top >= 0, `푸터 위쪽(${rect.top})이 이미 뷰포트 위로 올라갔다 — 문서 길이 측정이 잘못됐을 수 있다`);
});

// D60(관리자 판정, 소유자 지시) — 이 자리에는 `[4-A]` `DisclosureBanner`(성격·
// 자격 문구, 옛 요소 ①②)가 스크롤 후에도 헤더 아래 붙어 있는지 재는 검사가
// 있었다. **지우지 않고 뒤집는다** — 배너 자체가 화면에서 없어졌으므로 이제
// "그 배너가 어디에도 없다"가 이 자리에서 지켜야 할 사실이다. 되살아나는
// 회귀(문구 재도입)를 여기서 잡는다.
test('D60 — `.disclosure-banner`도 그 두 문장도 스크롤 전후 어디에도 없다', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440, 900);
  const read = () =>
    app.page.evaluate(`(() => ({
      bannerExists: !!document.querySelector('.disclosure-banner'),
      bodyText: document.body.innerText,
    }))()`);

  await app.page.evaluate('window.scrollTo(0, 0)');
  await sleep(100);
  const before = await read();

  await app.page.evaluate('window.scrollTo(0, 600)');
  await sleep(150);
  const after = await read();

  for (const [label, snapshot] of [['스크롤 전', before], ['스크롤 후', after]]) {
    assert.equal(snapshot.bannerExists, false, `${label}: .disclosure-banner가 다시 렌더됩니다`);
    assert.ok(!snapshot.bodyText.includes('세무사법 제6조'), `${label}: 자격 문장이 화면에 남아 있습니다`);
    assert.ok(!snapshot.bodyText.includes('신고 대리가 아닙니다'), `${label}: 성격 문장이 화면에 남아 있습니다`);
  }
});

// D60(관리자 판정, 소유자 지시) — 이 값의 원래 유일한 소비자였던
// `.disclosure-banner`(고지 ①②)가 삭제되어, 지금은 이 CSS 변수를 읽는 규칙이
// `styles.css`에 없다. 그래도 이 검사는 유지한다 — `ui/app.js`가 여전히 값을
// 채우고, design-system 5.19.1절이 같은 토큰을 `LiveSummaryStrip`(미구현)의
// 위치로 이미 지정해 뒀다. 값을 채우는 쪽이 살아 있는 한 정확성은 계속 잰다.
test('헤더 높이가 하드코딩된 56px이 아니라 실측값으로 CSS 변수에 실린다', { skip: skipWithoutChrome }, async () => {
  const heights = await app.page.evaluate(`(() => {
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const varValue = getComputedStyle(document.documentElement).getPropertyValue('--layout-header-height').trim();
    return { headerHeight: header.height, varValue };
  })()`);
  const varPx = Number.parseFloat(heights.varValue);
  assert.ok(Number.isFinite(varPx) && varPx > 0, `--layout-header-height가 실제 px 값이 아니다: ${heights.varValue}`);
  assert.ok(
    Math.abs(varPx - heights.headerHeight) < 1,
    `--layout-header-height(${varPx})가 헤더 실측 높이(${heights.headerHeight})와 다르다 — 하드코딩된 값을 쓰고 있을 수 있다`,
  );
});

test('1920px에서 .app-layout 렌더 폭이 뷰포트의 약 87%대다(design-system 4.4.1절 실측과 10%p 이상 어긋나면 회귀)', { skip: skipWithoutChrome }, async () => {
  await setViewport(1920, 1080);
  const ratio = await app.page.evaluate(`document.querySelector('.app-layout').getBoundingClientRect().width / window.innerWidth`);
  assert.ok(ratio > 0.775 && ratio < 0.975, `1920px 비율이 ${(ratio * 100).toFixed(1)}%다 — 설계 실측(87.5%)과 10%p 이상 어긋난다`);
  // 옛 상한(1360px)으로 되돌아가면 비율이 70.8%대로 떨어진다 — 그 값역이
  // 아님을 직접 확인한다.
  assert.ok(ratio > 0.75, `옛 컨테이너 상한(1360px, 비율 약 70.8%)으로 되돌아간 것처럼 보인다`);
});

test('1440px에서도 컨테이너 확대가 걸린다(≈99%)', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440, 900);
  const ratio = await app.page.evaluate(`document.querySelector('.app-layout').getBoundingClientRect().width / window.innerWidth`);
  assert.ok(ratio > 0.9, `1440px 비율이 ${(ratio * 100).toFixed(1)}%다 — 설계 실측(99.0%)에 크게 못 미친다`);
});

test('1280px는 이번 개정의 영향을 받지 않는다(옛 상한에도 안 걸리던 폭)', { skip: skipWithoutChrome }, async () => {
  await setViewport(1280, 900);
  const ratio = await app.page.evaluate(`document.querySelector('.app-layout').getBoundingClientRect().width / window.innerWidth`);
  assert.ok(ratio > 0.95, `1280px 비율이 ${(ratio * 100).toFixed(1)}%다 — 설계 실측(98.8%)과 크게 다르다`);
});

test('.calc2-input-slot 실측 폭이 1024~1439px 사이에서 440~640px 범위 안에 있다', { skip: skipWithoutChrome }, async () => {
  for (const width of [1024, 1200, 1439]) {
    await setViewport(width, 900);
    const w = await app.page.evaluate(`document.querySelector('.calc2-input-slot').getBoundingClientRect().width`);
    assert.ok(w >= 440 - 1 && w <= 640 + 1, `뷰포트 ${width}px에서 .calc2-input-slot 폭이 ${w}px — 440~640 범위 밖이다`);
  }
});

test('산문 텍스트 블록이 --prose-max-width(640px)를 넘지 않는다 — 넓은 뷰포트에서도', { skip: skipWithoutChrome }, async () => {
  await setViewport(1920, 1080);
  // 접힌 <details>도 max-width는 유지한다(레이아웃 폭은 열림 여부와 무관하다).
  // D46 2·3번(관리자 판정) — 「법령 조항」 disclosure(`.basis-block`)를 화면에서
  // 걷어냈다. 이 검사에서도 뺀다 — 존재하지 않는 요소를 찾으면 아래 루프가
  // "찾지 못했다"로 실패하는데, 그것은 이 검사가 재는 회귀(폭 초과)가 아니다.
  // D60(관리자 판정) — 같은 이유로 `.disclosure-banner-body`(성격·자격 배너의
  // 본문)도 뺐다. 그 배너 자체가 화면에서 없어졌다.
  // D61(관리자 판정, 소유자 지시) — 같은 이유로 `.limit-note`(`LimitNote`,
  // 고지 ⑤)도 뺐다. 그 칸 자체가 화면에서 없어졌다 — 부재는 아래 D61
  // 검사(`theme.browser.mjs`)가 직접 확인한다.
  const widths = await app.page.evaluate(`(() => {
    const w = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().width : null; };
    return {
      assumptionBlock: w('.assumption-block'),
    };
  })()`);
  for (const [name, width] of Object.entries(widths)) {
    assert.ok(width != null, `${name}을 찾지 못했다`);
    assert.ok(width <= 641, `${name} 폭이 ${width}px — --prose-max-width(640px)를 넘는다`);
  }
});

/**
 * [2026-08-24, D84] 원래 이 검사는 첫 탭(계산기2 근거판)의 반응형 도넛
 * (좁은 데스크톱에서 labelled 모드 지름 260 → 넓은 데스크톱에서
 * labelledWide 모드 지름 320으로 뷰포트에 맞춰 커지는 로직)을 겨눴다 —
 * 그 로직 자체가 첫 탭 전용이었다(D79 판정 2 — 계산기2 도넛은 뷰포트와
 * 무관하게 고정 폭, `styles.css`의 `.calc2-result-slot .chart-donut` —
 * 그 고정폭 자체는 D86으로 257.77px로 다시 바뀌었지만 "뷰포트 무관 고정"
 * 이라는 사실은 그대로다).
 * "넓어지면 커진다"는 더는 calc2에 해당하지 않으므로 그 절반은 뺀다 —
 * "도넛이 AccountBenefitStrip(전체 폭)보다 좁다"는 위계만, 도넛이 고정
 * 크기인 지금도 여전히 지켜야 할 사실이라 남긴다.
 */
test('도넛이 넓은 데스크톱에서도 옆의 AccountBenefitStrip(전체 폭)보다 좁다 — 위계가 유지된다', { skip: skipWithoutChrome }, async () => {
  await setViewport(1920, 1080);
  await sleep(200);
  const wide = await app.page.evaluate(`(() => {
    const donut = document.querySelector('.calc2-result-slot .chart-donut');
    const strip = document.querySelector('.account-benefit-strip');
    return {
      donutRenderedWidth: donut.getBoundingClientRect().width,
      stripWidth: strip ? strip.getBoundingClientRect().width : null,
    };
  })()`);

  assert.ok(wide.stripWidth != null, '.account-benefit-strip을 찾지 못했다');
  assert.ok(
    wide.donutRenderedWidth < wide.stripWidth,
    `도넛 렌더 폭(${wide.donutRenderedWidth})이 AccountBenefitStrip 폭(${wide.stripWidth})보다 크거나 같다 — 위계가 뒤집혔다`,
  );
});
