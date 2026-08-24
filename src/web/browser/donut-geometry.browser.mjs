import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

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
  const svg = document.querySelector('.calc2-result-slot .chart-donut');
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
  const svg = document.querySelector('.calc2-result-slot .chart-donut');
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
  // [2026-08-24, D84] calc2가 유일한 계산 탭이자 기본 활성 탭이라 명시
  // 탭 전환·필드 채움이 더는 필요 없다 — 로드와 동시에 프리필로 결과가
  // 선다(D79 판정 2).
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut')`, { timeoutMs: 8000 });
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
  if (!skipWithoutChrome) console.log('\n[도넛 기하 실측]', JSON.stringify(measurements, null, 1));
});

test('결과가 선 뒤 2.5초 — 조각마다 bbox가 0이 아니다 (회귀 재현 조건 그대로)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
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
  // [2026-08-24, D84] calc2는 필드를 채워야 렌더되던 첫 탭과 달리 로드와
  // 동시에(모듈 스크립트 평가 중) 프리필로 렌더된다(D79 판정 2) — 그래서
  // `goto()` 뒤에 `requestAnimationFrame`을 지우면 이미 늦을 수 있다(그
  // 시점엔 이미 첫 렌더가 끝나 있을 수 있다). 문서가 파싱되기 **전**에
  // 미리 지워 두는 CDP 훅(`Page.addScriptToEvaluateOnNewDocument`,
  // `theme.browser.mjs`의 "저장된 테마" 검사와 같은 기법)으로 바꾼다.
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.requestAnimationFrame = undefined;`,
  });
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
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
      const svg = document.querySelector('.calc2-result-slot .chart-donut');
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
  // [2026-08-24, D84] calc2가 로드와 동시에 프리필로 결과를 낸다(D79
  // 판정 2) — 명시 탭 전환·필드 채움이 더는 필요 없다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut')`, { timeoutMs: 8000 });
  const m = await page.evaluate(`(() => {
    const svg = document.querySelector('.calc2-result-slot .chart-donut');
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
  // [2026-08-24, D84] calc2가 로드와 동시에 프리필로 결과를 낸다(D79
  // 판정 2) — 명시 탭 전환·필드 채움이 더는 필요 없다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut')`, { timeoutMs: 8000 });
  // 진입(240ms) 도중에 값을 한 번 더 바꿔 디바운스 재계산을 건다 — 재렌더가
  // rAF 체인을 끊는 경로를 실측으로 때린다.
  // 만원 단위다(6절) — '60'은 600,000원.
  await page.evaluate(`(() => { const el = document.getElementById('calc2MonthlyCapacity'); el.focus(); el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
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
/**
 * [2026-08-24, D84 정리] 원래 이 자리는 뷰포트로 갈리는 두 검사였다 —
 * 데스크톱(labelled 모드, 도넛 옆 직접 라벨·범례 없음)과 모바일(legend
 * 모드, 범례+조각 안 라벨 둘 다). **SVG의 내부 label-mode 자체는 더는
 * 뷰포트로 갈리지 않는다** — calc2는 `preferredDonutSizeMode()`의 반응형
 * 계산을 타지 않고 D79/D83 판정으로 **뷰포트와 무관하게 언제나 legend
 * 모드**로 고정된 209px 도넛을 그린다(실측 확인 — 1440px에서도
 * `data-label-mode`가 "legend", `.donut-labels`도 없다). 조각 안 라벨은
 * 그래서 두 뷰포트 모두 항상 보인다. **다만 `.donut-legend` 목록 자체의
 * CSS 표시 규칙(`styles.css`의 767px 미디어쿼리)은 그대로 남아 있다** —
 * 실측해 보니 375px에서는 범례 목록도 함께 보이고(옛 모바일 검사와
 * 같은 사실), 1440px에서는 범례가 여전히 감춰진다(옛 데스크톱 검사의
 * "직접 라벨" 절반만 이제 성립하지 않는다). 그 실측값 그대로 기대값을
 * 적는다 — 두 검사를 완전히 합치지 않고, 너비별 기대값을 명시한다.
 */
for (const [label, width, expectLegendVisible] of [
  ['데스크톱(1440px)', 1440, false],
  ['모바일(375px)', 375, true],
]) {
  test(`실제 결과 도넛 — ${label}에서 조각 안 이름+비율 라벨이 실제로 보이고, 범례는 767px 규칙대로 갈린다`, { skip: skipWithoutChrome }, async () => {
    const { page, origin } = app;
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await page.goto(`${origin}/src/web/index.html`);
    await dismissCalc2ExampleModalIfOpen(page);
    await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut')`, { timeoutMs: 8000 });
    await sleep(400);
    // [2026-08-18, D74] `.chart-area`로 범위를 좁힌다 — `.calc2-result-slot`
    // 안에는 인쇄 전용 요약 시트(`.summary-sheet`, 화면에서는 display:none)
    // 가 도넛·범례 사본을 하나 더 담고 있다(`ui/result-panel.js`의
    // `summarySheet`) — 전체를 뒤지면 그 숨은 사본이 섞여 개수·크기 판정을
    // 오염시킨다. 화면에 실제로 보이는 도넛은 언제나 `.chart-area` 안에 있다.
    const m = await page.evaluate(`(() => {
      const scope = document.querySelector('.calc2-result-slot .chart-area');
      const svg = scope.querySelector('.chart-donut');
      const legendItems = [...scope.querySelectorAll('.donut-legend-item')].map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
      const sliceLabels = [...scope.querySelectorAll('.donut-slice-label')].map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
      const directLabels = scope.querySelector('.donut-labels');
      return { labelMode: svg?.dataset.labelMode, hasDirectLabels: !!directLabels, legendItems, sliceLabels };
    })()`);
    measurements[`labelVisibility_${width}`] = m;
    assert.equal(m.labelMode, 'legend', `${label} — 도넛 label-mode가 legend가 아니다: ${m.labelMode}`);
    assert.equal(m.hasDirectLabels, false, `${label} — 직접 라벨(.donut-labels) 노드가 생겼다 — calc2는 언제나 legend 모드다`);
    assert.ok(m.sliceLabels.length > 0, `${label} — 조각 안 이름+비율 라벨이 하나도 없다`);
    for (const b of m.sliceLabels) {
      assert.ok(b.width > 1 && b.height > 1, `${label} — 조각 안 이름+비율 라벨이 0크기다: ${JSON.stringify(b)}`);
    }
    assert.ok(m.legendItems.length > 0, `${label} — 범례 항목 자체가 DOM에 없다`);
    for (const item of m.legendItems) {
      const visible = item.width > 1 && item.height > 1;
      assert.equal(
        visible,
        expectLegendVisible,
        `${label} — 범례 항목 표시 상태가 767px 규칙과 어긋난다(기대: ${expectLegendVisible ? '보임' : '숨음'}): ${JSON.stringify(item)}`,
      );
    }
    await page.send('Emulation.clearDeviceMetricsOverride');
  });
}
