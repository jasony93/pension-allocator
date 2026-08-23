import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * [2026-08-23, D83 판정 1 — 상설 규칙] 「도넛 차트의 계좌별 라벨은 어떤
 * 화면에서도 차트와 겹치지 않는다.」 이 파일은 그 규칙을 화면마다 기계로
 * 강제한다 — 라벨 텍스트 사각형(`getBoundingClientRect`)과 도넛 고리
 * 사각형(고리를 이루는 조각 path들의 합집합 사각형)의 교집합이 0인지를
 * 잰다. 요약 이미지(`ui/summary-image.js`)는 화면 도넛이 아니라 별도의
 * SVG 문자열 조립 경로라 이 규칙의 적용 대상에서 소유자가 명시로 뺐다
 * (`ui/charts.js`의 `applyDonutSliceInlineLabelsToSvg`를 공유하지 않는다).
 *
 * **왜 한 파일로 모으나.** 대상 화면이 다섯 군데(팝업·첫 탭 예시·결과·
 * 역산기 예시·계산기2 결과)로 흩어져 있고 화면마다 이미 자기 파일이 있다
 * (`calc2.browser.mjs`·`example-showcase.browser.mjs`·`reverse-example-
 * showcase.browser.mjs`·`donut-geometry.browser.mjs`). 그 파일들에 흩어
 * 넣으면 "다섯 화면 전부를 쟀다"는 사실 자체가 흩어져 안 보인다 — 상설
 * 규칙 하나를 화면 다섯 곳에서 재확인한다는 것을 한 파일, 한 헬퍼로
 * 드러낸다.
 */

/** 주어진(문서 또는 shadowRoot) 스코프 표현식 안의 `.chart-donut` svg마다
 * 라벨-고리 겹침을 잰다. `rootExpr`은 evaluate에 그대로 붙는 JS 식이다. */
const overlapCheck = (rootExpr) => `(() => {
  const root = ${rootExpr};
  if (!root) return { found: false, donuts: [] };
  const svgs = [...root.querySelectorAll('.chart-donut')];
  const donuts = svgs.map((svg) => {
    const ringBoxes = [...svg.querySelectorAll('path[role="img"]')].map((p) => p.getBoundingClientRect());
    if (ringBoxes.length === 0) return { hasRing: false, labels: [] };
    const ring = {
      left: Math.min(...ringBoxes.map((b) => b.left)),
      right: Math.max(...ringBoxes.map((b) => b.right)),
      top: Math.min(...ringBoxes.map((b) => b.top)),
      bottom: Math.max(...ringBoxes.map((b) => b.bottom)),
    };
    const labels = [...svg.querySelectorAll('.donut-slice-label')].map((el) => {
      const b = el.getBoundingClientRect();
      const overlaps = b.left < ring.right && b.right > ring.left && b.top < ring.bottom && b.bottom > ring.top;
      return { text: el.textContent, overlaps, box: { left: b.left, right: b.right, top: b.top, bottom: b.bottom }, ring };
    });
    return { hasRing: true, labelCount: labels.length, labels };
  });
  return { found: svgs.length > 0, donuts };
})()`;

function assertNoOverlap(result, where) {
  assert.ok(result.found, `${where} — .chart-donut을 찾지 못했다`);
  for (const donut of result.donuts) {
    assert.ok(donut.hasRing, `${where} — 도넛 고리(path[role="img"])가 없다`);
    for (const label of donut.labels) {
      assert.equal(label.overlaps, false, `${where} — 라벨 "${label.text}"이 도넛 고리와 겹친다: ${JSON.stringify(label)}`);
    }
  }
}

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('D83 판정 1 — 계산기2 예시 팝업 도넛 라벨이 고리와 겹치지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 팝업은 새 로드에서 스스로 뜬다(D81) — 미리 치우지 않는다.
  await page.waitFor(`!!document.querySelector('.calc2-example-modal-host')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(200);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.calc2-example-modal-host')?.shadowRoot`));
  assertNoOverlap(result, '계산기2 예시 팝업');
});

test('D83 판정 1 — 첫 탭 예시 두 인물 도넛 라벨이 고리와 겹치지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.waitFor(`!!document.querySelector('.example-showcase-slot')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(200);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.example-showcase-slot')?.shadowRoot`));
  assertNoOverlap(result, '첫 탭 예시');
  assert.ok(result.donuts.length >= 2, `첫 탭 예시 도넛이 두 인물분(2개) 이상이어야 한다: ${result.donuts.length}`);
});

test('D83 판정 1 — 역산기 예시 도넛 라벨이 고리와 겹치지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await page.waitFor(`!!document.querySelector('.reverse-example-showcase-slot')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(200);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.reverse-example-showcase-slot')?.shadowRoot`));
  assertNoOverlap(result, '역산기 예시');
});

test('D83 판정 1 — 계산기2 결과 도넛 라벨이 고리와 겹치지 않는다(레전드 모드, 190px)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(300);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.calc2-result-slot')`));
  assertNoOverlap(result, '계산기2 결과');
});

test('D83 판정 1 — 첫 탭 결과 도넛(모바일 375px, 레전드 모드) 라벨이 고리와 겹치지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(150);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(400);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.result-slot .chart-area')`));
  assertNoOverlap(result, '첫 탭 결과(모바일)');
  await page.send('Emulation.clearDeviceMetricsOverride');
});
