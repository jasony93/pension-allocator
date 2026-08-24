import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

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
 * 라벨-고리 겹침 + [2026-08-23, 소유자 지시 1번] 라벨이 카드(svg 자신의
 * 렌더 상자) 안에 온전히 들어가는지(잘리지 않는지)를 함께 잰다. `svg`
 * 자신의 `getBoundingClientRect()`는 `overflow: visible`이어도 SVG
 * 원소 자신의 상자만 낸다(넘친 내용은 포함하지 않는다) — 그 상자를
 * "카드"의 대리로 쓴다. `rootExpr`은 evaluate에 그대로 붙는 JS 식이다. */
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
    const svgBox = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('.donut-slice-label')].map((el) => {
      const b = el.getBoundingClientRect();
      const overlaps = b.left < ring.right && b.right > ring.left && b.top < ring.bottom && b.bottom > ring.top;
      const clipped = b.left < svgBox.left || b.right > svgBox.right || b.top < svgBox.top || b.bottom > svgBox.bottom;
      // [2026-08-23, 소유자 지시 1·2번(신규 회차)] 이름 줄 글자 크기 —
      // "라벨 폰트 하한을 같이 점검하라"는 지시대로 뒤에서 최저치를 잰다.
      const nameEl = el.querySelector('.donut-slice-label-name');
      const nameFontPx = nameEl ? parseFloat(getComputedStyle(nameEl).fontSize) : null;
      return { text: el.textContent, overlaps, clipped, nameFontPx, box: { left: b.left, right: b.right, top: b.top, bottom: b.bottom }, ring, svgBox: { left: svgBox.left, right: svgBox.right, top: svgBox.top, bottom: svgBox.bottom } };
    });
    const leaderCount = svg.querySelectorAll('.donut-slice-label-leader, .donut-leader').length;
    return { hasRing: true, labelCount: labels.length, labels, leaderCount };
  });
  return { found: svgs.length > 0, donuts };
})()`;

function assertNoOverlap(result, where) {
  assert.ok(result.found, `${where} — .chart-donut을 찾지 못했다`);
  for (const donut of result.donuts) {
    assert.ok(donut.hasRing, `${where} — 도넛 고리(path[role="img"])가 없다`);
    for (const label of donut.labels) {
      assert.equal(label.overlaps, false, `${where} — 라벨 "${label.text}"이 도넛 고리와 겹친다: ${JSON.stringify(label)}`);
      // [2026-08-23, 소유자 지시 1번] 라벨이 카드 밖으로 잘리지 않는다.
      assert.equal(label.clipped, false, `${where} — 라벨 "${label.text}"이 카드 밖으로 잘린다: ${JSON.stringify(label)}`);
    }
  }
}

/**
 * [2026-08-23, 소유자 지시 1·2번(신규 회차)] "폴백으로 다시 줄이는 방향
 * 금지" — 이름 줄 글자 크기가 바닥값(`SLICE_LABEL_MIN_FONT_PX`=9.9px)
 * 근처까지 떨어지면 안 된다. 기본값(16.5px)의 90% 이상이면 사실상 축소
 * 폴백을 타지 않은 것으로 본다 — 아주 드문 극단(가장 넓은 라벨 + 가장
 * 작은 카드)까지 완전히 막지는 못해도, "대부분 기본 크기로 보인다"는
 * 소유자 지시의 핵심을 기계로 확인한다.
 */
function assertFontFloor(result, where, minPx = 14.85 /* 16.5 × 0.9 */) {
  for (const donut of result.donuts) {
    for (const label of donut.labels) {
      assert.ok(
        label.nameFontPx == null || label.nameFontPx >= minPx,
        `${where} — 라벨 "${label.text}" 이름 글자(${label.nameFontPx}px)가 바닥값(${minPx}px) 밑으로 줄었다`,
      );
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

test('D83 판정 1, 소유자 지시 1번 — 계산기2 예시 팝업 도넛 라벨이 고리와 겹치지 않고, 잘리지 않고, 지시선이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 팝업은 새 로드에서 스스로 뜬다(D81) — 미리 치우지 않는다.
  await page.waitFor(`!!document.querySelector('.calc2-example-modal-host')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(200);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.calc2-example-modal-host')?.shadowRoot`));
  assertNoOverlap(result, '계산기2 예시 팝업');
  assertFontFloor(result, '계산기2 예시 팝업');
  // [2026-08-23, 소유자 지시 1번] 지시선(리더선) 제거.
  for (const donut of result.donuts) {
    assert.equal(donut.leaderCount, 0, `팝업 도넛에 지시선이 남아 있다: ${donut.leaderCount}개`);
  }
});

// [2026-08-24, D84 정리] 원래 여기 있던 두 검사("첫 탭 예시 두 인물 도넛"·
// "역산기 예시 도넛")를 지운다 — 「절세계좌 계산기2(근거판)」와 「연금
// 역산기」 탭이 지워지며 `.example-showcase-slot`·`.reverse-example-
// showcase-slot` 둘 다 앱 어디에도 마운트되지 않는다. 이 파일이 재던
// "다섯 화면" 상설 규칙은 이제 셋(계산기2 예시 팝업·계산기2 결과 데스크톱·
// 계산기2 결과 모바일)이다 — 모바일 자리는 첫 탭의 것을 계산기2로 옮겨
// 아래에 다시 세운다(계산기2 도넛도 뷰포트별 실측 가치가 있다,
// `donut-geometry.browser.mjs`가 이미 같은 판단을 내렸다).
test('D83 판정 1 — 계산기2 결과 도넛 라벨이 고리와 겹치지 않는다(레전드 모드, 209px)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(300);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.calc2-result-slot')`));
  assertNoOverlap(result, '계산기2 결과');
  assertFontFloor(result, '계산기2 결과');
});

test('D83 판정 1 — 계산기2 결과 도넛(모바일 375px)도 라벨이 고리와 겹치지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(400);
  const result = await page.evaluate(overlapCheck(`document.querySelector('.calc2-result-slot .chart-area')`));
  assertNoOverlap(result, '계산기2 결과(모바일)');
  await page.send('Emulation.clearDeviceMetricsOverride');
});
