import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

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
  // 뷰포트 안으로 스크롤한 뒤 좌표를 잰다 — \`elementFromPoint\`는 뷰포트 밖
  // 좌표에서 항상 null을 낸다(관리자 지시 2026-08-14 4번으로 헤더 위에 예시
  // 구역이 생기면서 페이지가 길어졌고, 기본 스크롤 위치에서는 도넛이 뷰포트
  // 아래로 밀릴 수 있다는 것을 실측으로 확인했다). 이 상자는 이 검사가 재려는
  // 것(조각의 실제 기하)과 무관하므로, 스크롤 위치에 좌우되지 않게 먼저 맞춘다.
  svg.scrollIntoView({ block: 'center' });
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
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — 첫 로드부터 예시 팝업이
  // 뜰 수 있어 먼저 치운다. 그 다음 `.result-slot`(첫 탭 전용)이 숨어
  // 있으면 SVG `getBBox()`가 0을 내므로 명시로 켠다.
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-calculator')`);
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
  // [2026-08-21, D81] 새로고침은 기본 탭(calc2)으로 되돌아간다 — 첫 탭
  // (calculator)의 `.result-slot`을 재려면 먼저 그 탭을 켜야 한다. 켜기
  // 전에, 이 로드가 곧장 열 수 있는 예시 팝업(스크림)부터 치운다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(`window.requestAnimationFrame = undefined;`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  // [2026-08-18, D74] **단순 존재 확인에서 실제 bbox 확인으로 좁혔다.** 옛
  // 검사는 `.chart-donut`이 DOM에 존재하는 순간 곧바로(추가 대기 없이)
  // 재는 것으로 "장식(rAF) 없이도 내용은 그 자리에 있다"를 확인했다 —
  // D74로 결과 패널에 인쇄 전용 요약 시트(`.summary-sheet`)가 추가되며 매
  // 렌더가 두 번째 `donutChart()`(요약용)까지 함께 그리게 됐고, 그만큼
  // 늘어난 동기 렌더 작업이 실측에서 간헐적 타이밍 편차(수백 ms 안에서
  // `getBBox()`가 아직 0을 내는 프레임을 잡는 경우)를 드러냈다 — 값 자체는
  // 여전히 항상 최종 각도다(`donutChart`가 만드는 `d`는 처음부터 최종
  // 각도라는 사실은 바뀌지 않았다, 위 파일 머리말). **여기서는 조건을
  // 완화하지 않고 검사 시점만 정확하게 만든다** — "조각이 존재한다"가
  // 아니라 "조각이 실제 크기를 갖는다"를 `page.waitFor`로 직접 기다린다.
  // 원래 결함(patch()가 0°에서 멈춘 사본을 화면에 남기는 것)이 재발하면
  // 이 조건은 타임아웃까지 영영 참이 되지 않으므로 여전히 실패로 잡는다 —
  // 회귀 탐지력은 그대로다.
  await page.waitFor(
    `(() => {
      const svg = document.querySelector('.result-slot .chart-donut');
      const p = svg && svg.querySelector('path[role="img"]');
      return !!p && p.getBBox().width > 1;
    })()`,
    { timeoutMs: 4000 },
  );
  const m = await page.evaluate(MEASURE_SLICES);
  measurements.noRaf = m;
  assert.ok(m.count > 0);
  for (const b of m.boxes) assert.ok(b.width > 1 && b.height > 1, `rAF 없이도 조각이 비어 있습니다: ${JSON.stringify(b)}`);
});

test('prefers-reduced-motion이면 진입 표시 없이 바로 최종 모양이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto(`${origin}/src/web/index.html`);
  // [2026-08-21, D81] 새로고침은 기본 탭(calc2)으로 되돌아간다 — 첫 탭
  // (calculator)의 `.result-slot`을 재려면 먼저 그 탭을 켜야 한다. 켜기
  // 전에, 이 로드가 곧장 열 수 있는 예시 팝업(스크림)부터 치운다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
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
  // [2026-08-21, D81] 새로고침은 기본 탭(calc2)으로 되돌아간다 — 첫 탭
  // (calculator)의 `.result-slot`을 재려면 먼저 그 탭을 켜야 한다. 켜기
  // 전에, 이 로드가 곧장 열 수 있는 예시 팝업(스크림)부터 치운다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  // 진입(240ms) 도중에 값을 한 번 더 바꿔 디바운스 재계산을 건다 — 재렌더가
  // rAF 체인을 끊는 경로를 실측으로 때린다.
  // 만원 단위다(6절) — '60'은 600,000원.
  await page.evaluate(`(() => { const el = document.getElementById('monthlyCapacity'); el.focus(); el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(1200); // 디바운스(400ms) + 재계산 + 진입까지 넉넉히
  const m = await page.evaluate(MEASURE_SLICES);
  measurements.interruptedEntrance = m;
  assert.ok(m.count > 0);
  for (const b of m.boxes) assert.ok(b.width > 1 && b.height > 1, `끊긴 뒤 조각이 비어 있습니다: ${JSON.stringify(b)}`);
});

/**
 * 관리자 지시(2026-08-14, 예시 도넛 회귀 뒤 3번) — **실제 결과 화면의 도넛도
 * 같은 문제(DOM에는 있지만 `w:0, h:0`으로 안 보이는 조각 식별 수단)가 있는지
 * 확인한다.** "라벨이 보였으니 예시만의 문제로 보인다"는 짐작에서 멈추지
 * 않고 `getBoundingClientRect()`로 잰다.
 *
 * 결과 패널의 도넛은 `preferredDonutSizeMode()`(뷰포트를 실제로 재는 함수)로
 * `labelMode`를 고르고, `.donut-legend`·`.donut-labels`의 CSS 표시 규칙은
 * **같은 767px 경계**로 갈린다(`styles.css` `@media (max-width: 767px)`) —
 * SVG가 어떤 모드로 그려졌는지와 CSS가 무엇을 보이게 하는지가 같은 축을
 * 탄다. 이것이 예시(뷰포트와 무관하게 항상 legend 모드로 고정)에서 깨졌던
 * 짝이다 — 실제 결과는 이 짝이 유지되는지를 데스크톱·모바일 양쪽에서
 * 실측한다.
 *
 * **[2026-08-17, D72]** ①②③ 배지(`.donut-slice-index-badge`)는 없어졌다 —
 * 아래 두 검사는 그 자리를 `.donut-slice-label-group`(조각 안 이름+비율
 * 라벨, `charts.js`의 `applyDonutSliceInlineLabels`가 실제 결과 패널
 * (모바일)에도 적용한다)로 대신한다.
 */
test('실제 결과 도넛 — 데스크톱에서는 도넛 옆 직접 라벨이 실제로 보인다(범례가 아니라)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  // [2026-08-21, D81] 새로고침은 기본 탭(calc2)으로 되돌아간다 — 첫 탭
  // (calculator)의 `.result-slot`을 재려면 먼저 그 탭을 켜야 한다. 켜기
  // 전에, 이 로드가 곧장 열 수 있는 예시 팝업(스크림)부터 치운다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(400);
  // [2026-08-18, D74] **`.chart-area`로 범위를 좁혔다** — 옛 검사는
  // `.result-slot` 전체를 뒤졌다. D74로 `.result-slot` 안에 인쇄 전용 요약
  // 시트(`.summary-sheet`, 화면에서는 `display: none`)가 하나 더 생겼고,
  // 그 시트도 항상 legend 모드 도넛+범례를 담는다(도넛/범례 자체를 그대로
  // 재사용한다, `ui/result-panel.js`의 `summarySheet`) — `.result-slot`
  // 전체를 뒤지면 화면에 보이지 않는 그 사본까지 함께 잡혀 "중복이다"로
  // 오판하거나(존재 여부만 보는 질의) "0크기다"로 오판한다(크기를 보는
  // 질의 — 숨은 사본은 실제로 0×0이 맞다). **화면에 실제로 보이는 도넛은
  // 언제나 `.chart-area` 안에 있다** — 요약 시트는 그 밖에 있으므로,
  // `.chart-area`로 좁히면 이 충돌이 구조적으로 사라진다.
  const m = await page.evaluate(`(() => {
    const scope = document.querySelector('.result-slot .chart-area');
    const rect = (sel) => { const el = scope.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; };
    const legendItems = [...scope.querySelectorAll('.donut-legend-item')].map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
    return { labels: rect('.donut-labels'), sliceLabelGroup: !!scope.querySelector('.donut-slice-label-group'), legendItems };
  })()`);
  measurements.desktopLabelVisibility = m;
  assert.ok(m.labels, '데스크톱에서 .donut-labels 노드 자체가 없다');
  assert.ok(m.labels.width > 1 && m.labels.height > 1, `데스크톱 직접 라벨이 0크기다(안 보인다): ${JSON.stringify(m.labels)}`);
  // 데스크톱(labelled 모드)의 도넛 svg는 `data-label-mode="legend"`가 아니므로
  // `applyDonutSliceInlineLabels`가 조용히 아무것도 하지 않는다 — 조각 안
  // 이름+비율 라벨 그룹 자체가 생기지 않아야 한다(직접 라벨과 중복되면 안 된다).
  assert.equal(m.sliceLabelGroup, false, '데스크톱에서도 조각 안 이름+비율 라벨 그룹이 생겼다 — 직접 라벨과 중복이다');
  // 범례는 이 폭에서 DOM에 있어도 됨(범례는 `chartArea`가 언제나 만든다) —
  // 하지만 **보이면 안 된다**(라벨과 범례가 동시에 보이면 중복이다).
  for (const item of m.legendItems) {
    assert.ok(item.width === 0 || item.height === 0, `데스크톱에서 범례 항목이 보인다(라벨과 중복): ${JSON.stringify(item)}`);
  }
});

test('실제 결과 도넛 — 모바일(375px)에서는 범례·조각 안 이름+비율 라벨이 실제로 보인다(0크기가 아니다)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  // [2026-08-21, D81] 새로고침은 기본 탭(calc2)으로 되돌아간다 — 첫 탭
  // (calculator)의 `.result-slot`을 재려면 먼저 그 탭을 켜야 한다. 켜기
  // 전에, 이 로드가 곧장 열 수 있는 예시 팝업(스크림)부터 치운다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(150);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(400);
  // [2026-08-18, D74] 위 데스크톱 검사와 같은 이유로 `.chart-area`로 좁힌다.
  const m = await page.evaluate(`(() => {
    const scope = document.querySelector('.result-slot .chart-area');
    const legendItems = [...scope.querySelectorAll('.donut-legend-item')].map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
    const sliceLabels = [...scope.querySelectorAll('.donut-slice-label')].map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
    return { legendItems, sliceLabels };
  })()`);
  measurements.mobileLegendVisibility = m;
  assert.ok(m.legendItems.length > 0, '모바일에서 범례 항목이 하나도 없다');
  for (const item of m.legendItems) {
    assert.ok(item.width > 1 && item.height > 1, `모바일 범례 항목이 0크기다(관리자가 예시에서 잡은 것과 같은 결함): ${JSON.stringify(item)}`);
  }
  assert.ok(m.sliceLabels.length > 0, '모바일에서 조각 안 이름+비율 라벨이 하나도 없다');
  for (const b of m.sliceLabels) {
    assert.ok(b.width > 1 && b.height > 1, `모바일 조각 안 이름+비율 라벨이 0크기다: ${JSON.stringify(b)}`);
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
});
