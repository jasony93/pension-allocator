import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * 결과 도넛의 **실제 기하** 실측 — 회귀 재발 방지.
 *
 * 관리자가 잡은 결함은 라벨·지시선·가운데 값은 다 나오는데 **고리만 없는**
 * 것이었다. 상자(`svg`)의 바깥 크기, 라벨 텍스트, 막대 폭만 재고 "도넛이
 * 그려졌다"고 판정한 이전 검증이 놓쳤다 — 조각의 실제 호(arc) 기하를 한 번도
 * 재지 않았다. 그래서 이 파일은 오직 그것만 본다.
 *
 * 원인은 `patch()`(dom.js)가 구조가 같은 트리를 다시 그릴 때 새로 만든 노드를
 * 버리고 **기존 노드에 속성만 복사**하는 데 있었다. `donutChart` 안에서 진입
 * 애니메이션을 돌리면, 애니메이션이 붙잡은 노드는 `patch`가 속성을 한 번
 * 복사하고 버리는 사본이라 — 화면에 실제로 남는 노드는 복사되는 순간의
 * 값(0°)에서 멈췄다. 지금은 애니메이션이 `patch` 이후 실제 DOM을 다시
 * 조회해서 돈다(`runDonutEntrance`), 그리고 조각의 `d`는 애초에 항상 최종
 * 각도로 그려진다 — 애니메이션은 그 위에 얹히는 장식일 뿐이다.
 */

/** `.chart-donut` 안의 조각(top면)의 실제 bbox와 각도 데이터를 잰다. */
const MEASURE_SLICES = `(() => {
  const svg = document.querySelector('.result-slot .chart-donut');
  if (!svg) return null;
  // top면만 — role="img"가 top에만 붙는다(옆면은 장식이라 없다).
  const tops = [...svg.querySelectorAll('path[role="img"]')];
  const boxes = tops.map((p) => {
    const b = p.getBBox();
    return {
      x: b.x, y: b.y, width: b.width, height: b.height,
      start: Number(p.dataset.arcStart), end: Number(p.dataset.arcEnd),
      fill: getComputedStyle(p).fill,
    };
  });
  const rect = svg.getBoundingClientRect();
  return { count: boxes.length, boxes, svgRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    viewBox: { w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height },
    cx: Number(svg.dataset.cx), cy: Number(svg.dataset.cx) };
})()`;

/**
 * 조각 중간 각도의 실제 화면 좌표(스크린 픽셀)에서 `elementFromPoint`로
 * 무엇이 그려져 있는지 확인한다. `getBBox()`는 SVG 좌표계의 기하만 보므로,
 * CSS로 실제 화면에서 가려지거나 안 보이는 경우까지는 못 잡는다 — 스크린샷
 * 대신 코드로 "화면에 실제로 그 픽셀이 칠해져 있는가"를 재는 방법이다.
 */
const HIT_TEST_MIDPOINTS = `(() => {
  const svg = document.querySelector('.result-slot .chart-donut');
  const tops = [...svg.querySelectorAll('path[role="img"]')];
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const scaleX = rect.width / vb.width;
  const scaleY = rect.height / vb.height;
  const cx = Number(svg.dataset.cx);
  const rOuter = Number(svg.dataset.rOuter);
  const rInner = Number(svg.dataset.rInner);
  const ry = Number(svg.dataset.ry);
  return tops.map((p) => {
    const start = Number(p.dataset.arcStart);
    const end = Number(p.dataset.arcEnd);
    const mid = (start + end) / 2;
    const rMid = (rOuter + rInner) / 2;
    const rad = (mid * Math.PI) / 180;
    const svgX = cx + rMid * Math.sin(rad);
    const svgY = Number(p.dataset.cy) - rMid * ry * Math.cos(rad);
    const screenX = rect.left + svgX * scaleX;
    const screenY = rect.top + svgY * scaleY;
    const hit = document.elementFromPoint(screenX, screenY);
    return { hitsThisSlice: hit === p, hitTag: hit ? hit.tagName : null, hitClass: hit ? hit.getAttribute('class') : null };
  });
})()`;

let app;
const measurements = {};

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
  if (!skipWithoutChrome) console.log('\n[도넛 기하 실측]', JSON.stringify(measurements, null, 1));
});

test('필수 입력을 채우고 2.5초 뒤 — 조각마다 bbox가 0이 아니다 (회귀 재현 조건 그대로)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(2500);
  const m = await page.evaluate(MEASURE_SLICES);
  measurements.afterFill = m;
  assert.ok(m, '도넛 svg 자체가 없습니다');
  assert.ok(m.count > 0, '조각이 하나도 없습니다');
  for (const b of m.boxes) {
    assert.ok(b.width > 1, `조각 하나의 bbox 폭이 0에 가깝습니다: ${JSON.stringify(b)}`);
    assert.ok(b.height > 1, `조각 하나의 bbox 높이가 0에 가깝습니다: ${JSON.stringify(b)}`);
  }
});

test('조각 각도의 합이 360°다 — 원 전체를 채운다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(MEASURE_SLICES);
  const totalSweep = m.boxes.reduce((sum, b) => sum + (b.end - b.start), 0);
  assert.ok(Math.abs(totalSweep - 360) < 0.5, `조각 각도 합이 360°가 아닙니다: ${totalSweep}`);
});

test('조각 중간 각도의 실제 화면 픽셀에 그 조각이 그려져 있다 (스크린샷 대신 좌표로 확인)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const hits = await page.evaluate(HIT_TEST_MIDPOINTS);
  measurements.hitTest = hits;
  assert.ok(hits.length > 0, '조각이 없습니다');
  for (const h of hits) {
    assert.equal(h.hitsThisSlice, true, `조각 중앙 픽셀에서 그 조각이 히트되지 않았습니다: ${JSON.stringify(h)}`);
  }
});

test('`requestAnimationFrame`이 없어도 도넛은 즉시 최종 모양이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(`window.requestAnimationFrame = undefined;`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  // 대기 없이 즉시 잰다 — 장식(rAF)이 없어도 내용(조각)은 그 자리에 있어야 한다.
  const m = await page.evaluate(MEASURE_SLICES);
  measurements.noRaf = m;
  assert.ok(m.count > 0);
  for (const b of m.boxes) assert.ok(b.width > 1 && b.height > 1, `rAF 없이도 조각이 비어 있습니다: ${JSON.stringify(b)}`);
});

test('prefers-reduced-motion이면 진입 표시 없이 바로 최종 모양이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  const m = await page.evaluate(`(() => {
    const svg = document.querySelector('.result-slot .chart-donut');
    return { entering: svg.classList.contains('chart-donut-entering'), boxes: [...svg.querySelectorAll('path[role="img"]')].map((p) => p.getBBox().width) };
  })()`);
  measurements.reducedMotion = m;
  assert.equal(m.entering, false, 'reduced-motion인데 진입 표시가 남아 있습니다');
  for (const w of m.boxes) assert.ok(w > 1, `reduced-motion에서 조각이 비어 있습니다: ${w}`);
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
});

test('진입 애니메이션 도중 값이 다시 계산돼 끊겨도 최종 도넛이 비지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  // 진입(240ms) 도중에 값을 한 번 더 바꿔 디바운스 재계산을 건다 — 재렌더가
  // rAF 체인을 끊는 경로를 실측으로 때린다.
  await page.evaluate(`(() => { const el = document.getElementById('monthlyCapacity'); el.focus(); el.value = '600000'; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1200); // 디바운스(400ms) + 재계산 + 진입까지 넉넉히
  const m = await page.evaluate(MEASURE_SLICES);
  measurements.interruptedEntrance = m;
  assert.ok(m.count > 0);
  for (const b of m.boxes) assert.ok(b.width > 1 && b.height > 1, `끊긴 뒤 조각이 비어 있습니다: ${JSON.stringify(b)}`);
});
