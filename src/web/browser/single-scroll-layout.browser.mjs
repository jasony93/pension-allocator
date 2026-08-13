import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

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
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(300);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

async function setViewport(width, height = 1000) {
  await app.page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await sleep(150);
}

test('데스크톱 — `.result-slot`이 자체 스크롤 상자가 아니다(스크롤 막대가 하나다)', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440);
  const cs = await app.page.evaluate(`(() => {
    const el = document.querySelector('.result-slot');
    const s = getComputedStyle(el);
    return { position: s.position, overflowY: s.overflowY, maxHeight: s.maxHeight };
  })()`);
  assert.notEqual(cs.position, 'sticky', '.result-slot이 여전히 sticky면 자체 스크롤 상자로 남아 있을 수 있다');
  assert.notEqual(cs.overflowY, 'auto', '.result-slot이 overflow-y:auto면 스크롤 막대가 둘이다');
  // max-height가 뷰포트에 묶여 있으면(예: calc(100vh - 96px)) 내용이 넘칠 때
  // 결국 내부 스크롤이 생긴다. 'none'이거나 뷰포트보다 훨씬 큰 값이어야 한다.
  assert.ok(
    cs.maxHeight === 'none' || Number.parseFloat(cs.maxHeight) > 100000,
    `.result-slot의 max-height(${cs.maxHeight})가 뷰포트에 묶여 있다`,
  );
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

test('`[4-A]` DisclosureBanner가 스크롤 후에도 실제로 헤더 바로 아래에 붙어 있다 — 속성이 아니라 위치로 잰다', { skip: skipWithoutChrome }, async () => {
  await setViewport(1440, 900);
  await app.page.evaluate('window.scrollTo(0, 0)');
  await sleep(100);
  const before = await app.page.evaluate(`(() => {
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const banner = document.querySelector('.disclosure-banner').getBoundingClientRect();
    return { headerBottom: header.bottom, bannerTop: banner.top };
  })()`);
  // 스크롤 전에는 배너가 문서 흐름상 헤더 아래(카드 패딩만큼 떨어져)에 있다
  // — 정확히 붙어 있을 필요는 없다. sticky는 스크롤이 그 위치를 넘어설 때만
  // 작동을 시작한다. 여기서는 "헤더보다 아래에 있다"만 확인해 둔다.
  assert.ok(before.bannerTop >= before.headerBottom, `스크롤 전 배너가 헤더보다 위에 있다 — 초기 배치 자체가 이상하다`);

  await app.page.evaluate('window.scrollTo(0, 600)');
  await sleep(150);
  const after = await app.page.evaluate(`(() => {
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const banner = document.querySelector('.disclosure-banner').getBoundingClientRect();
    return { headerBottom: header.bottom, bannerTop: banner.top };
  })()`);
  // **핵심 단언** — 600px 스크롤한 뒤에도 배너가 헤더 바로 밑에 그대로 있어야
  // 한다. `overflow: hidden` 결함이 있으면 배너가 스크롤량만큼 함께 밀려
  // 올라가 `bannerTop`이 크게 음수가 된다(문서 밖으로 나간다).
  assert.ok(
    Math.abs(after.bannerTop - after.headerBottom) < 4,
    `스크롤 후 배너가 헤더 아래에 붙어 있지 않다 — gap ${after.bannerTop - after.headerBottom}px (기존 overflow:hidden 결함이 재발했을 수 있다)`,
  );
  assert.ok(after.bannerTop >= 0, '배너가 뷰포트 위로 올라가 있다 — sticky가 실제로 작동하지 않는다');
});

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

test('.input-slot 실측 폭이 1024~1439px 사이에서 440~640px 범위 안에 있다', { skip: skipWithoutChrome }, async () => {
  for (const width of [1024, 1200, 1439]) {
    await setViewport(width, 900);
    const w = await app.page.evaluate(`document.querySelector('.input-slot').getBoundingClientRect().width`);
    assert.ok(w >= 440 - 1 && w <= 640 + 1, `뷰포트 ${width}px에서 .input-slot 폭이 ${w}px — 440~640 범위 밖이다`);
  }
});

test('산문 텍스트 블록이 --prose-max-width(640px)를 넘지 않는다 — 넓은 뷰포트에서도', { skip: skipWithoutChrome }, async () => {
  await setViewport(1920, 1080);
  // 접힌 <details>도 max-width는 유지한다(레이아웃 폭은 열림 여부와 무관하다).
  // D46 2·3번(관리자 판정) — 「법령 조항」 disclosure(`.basis-block`)를 화면에서
  // 걷어냈다. 이 검사에서도 뺀다 — 존재하지 않는 요소를 찾으면 아래 루프가
  // "찾지 못했다"로 실패하는데, 그것은 이 검사가 재는 회귀(폭 초과)가 아니다.
  const widths = await app.page.evaluate(`(() => {
    const w = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().width : null; };
    return {
      assumptionBlock: w('.assumption-block'),
      limitNote: w('.limit-note'),
      disclosureBody: w('.disclosure-banner-body'),
    };
  })()`);
  for (const [name, width] of Object.entries(widths)) {
    assert.ok(width != null, `${name}을 찾지 못했다`);
    assert.ok(width <= 641, `${name} 폭이 ${width}px — --prose-max-width(640px)를 넘는다`);
  }
});

test('도넛도 넓은 데스크톱에서 함께 커지되, 옆의 AccountBenefitStrip(전체 폭)보다는 여전히 좁다 — 위계가 유지된다', { skip: skipWithoutChrome }, async () => {
  await setViewport(1024, 900);
  const narrowWidth = await app.page.evaluate(`Number(document.querySelector('.result-slot .chart-donut').getAttribute('width'))`);

  await setViewport(1920, 1080);
  await sleep(200);
  const wide = await app.page.evaluate(`(() => {
    const donut = document.querySelector('.result-slot .chart-donut');
    const strip = document.querySelector('.account-benefit-strip');
    return {
      donutIntrinsicWidth: Number(donut.getAttribute('width')),
      donutRenderedWidth: donut.getBoundingClientRect().width,
      stripWidth: strip ? strip.getBoundingClientRect().width : null,
    };
  })()`);

  assert.ok(wide.donutIntrinsicWidth > narrowWidth, `넓은 데스크톱(${wide.donutIntrinsicWidth})이 좁은 데스크톱(${narrowWidth})보다 커야 한다`);
  // 320px 상한에서 유도된 값(260 → 320, gutter 176 → 182)과 대략 일치하는지도 본다.
  assert.equal(narrowWidth, 612, '1024px에서는 labelled 모드(지름 260, gutter 176)여야 한다');
  assert.equal(wide.donutIntrinsicWidth, 684, '1920px에서는 labelledWide 모드(지름 320, gutter 182)여야 한다');

  assert.ok(wide.stripWidth != null, '.account-benefit-strip을 찾지 못했다');
  assert.ok(
    wide.donutRenderedWidth < wide.stripWidth,
    `도넛 렌더 폭(${wide.donutRenderedWidth})이 AccountBenefitStrip 폭(${wide.stripWidth})보다 크거나 같다 — 위계가 뒤집혔다`,
  );
});
