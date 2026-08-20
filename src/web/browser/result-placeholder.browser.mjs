import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * 결과 자리표시자의 **실측** — design-system 5.29절 · screens.md 8.1절.
 *
 * 순수 함수 쪽은 `ui/charts.test.mjs`가 고정한다(조각 수·각·평면·상자). 여기서
 * 보는 것은 그 값들이 **실제로 화면에 그렇게 나오는가**와, Node 안에서는 원리상
 * 볼 수 없는 것 둘이다 —
 *
 * - `data-placeholder`가 실제로 칠해진 색과 카드 표면의 대비(장치 B4).
 * - 자리표시자와 결과 도넛이 **같은 프레임에 함께 있지 않은가.** 이건 DOM 변화를
 *   프레임 단위로 지켜봐야만 보인다. 겹치면 12등분이 결과로 변형되는 것처럼
 *   보이고, 그러면 "자리표시자가 답이었다"는 인상이 남는다.
 */

const CONTRAST_FN = `
  const __rgb = (v) => { const m = String(v).match(/-?[\\d.]+/g) || []; return [Number(m[0]) || 0, Number(m[1]) || 0, Number(m[2]) || 0]; };
  const __lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const __lum = (v) => { const [r, g, b] = __rgb(v); return 0.2126 * __lin(r) + 0.7152 * __lin(g) + 0.0722 * __lin(b); };
  const contrast = (a, b) => { const x = __lum(a), y = __lum(b); const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); };
`;

/** 자리표시자 링을 실제로 재서 장치 넷을 하나씩 확인한다. */
const MEASURE_RING = `(() => {
  ${CONTRAST_FN}
  const svg = document.querySelector('.result-placeholder .placeholder-ring');
  if (!svg) return null;
  const paths = [...svg.querySelectorAll('path')];
  const boxes = paths.map((p) => p.getBBox());
  const union = boxes.reduce((acc, b) => ({
    x: Math.min(acc.x, b.x), y: Math.min(acc.y, b.y),
    r: Math.max(acc.r, b.x + b.width), b2: Math.max(acc.b2, b.y + b.height),
  }), { x: Infinity, y: Infinity, r: -Infinity, b2: -Infinity });
  const card = getComputedStyle(document.querySelector('.result-panel-inner')).backgroundColor;
  const fills = [...new Set(paths.map((p) => getComputedStyle(p).fill))];
  const centerTspans = [...svg.querySelectorAll('tspan')].map((t) => t.textContent);
  return {
    sliceCount: paths.length,
    fills,
    contrastVsCard: contrast(fills[0], card),
    // 평면이면 링의 가로와 세로가 같다. 결과 도넛은 15° 기울기 + 압출이라 다르다.
    ringWidth: union.r - union.x,
    ringHeight: union.b2 - union.y,
    ariaHidden: svg.getAttribute('aria-hidden'),
    animationName: getComputedStyle(paths[0]).animationName,
    svgAnimationName: getComputedStyle(svg).animationName,
    centerTspans,
    // 눈금·범례·지시선이 없다.
    hasLeader: !!svg.querySelector('.donut-leader, polyline, line'),
    text: document.querySelector('.result-placeholder').textContent,
    boxWidth: svg.viewBox.baseVal.width,
    boxHeight: svg.viewBox.baseVal.height,
  };
})()`;

/**
 * 결과 자리에 도형이 둘 있는 프레임이 있었는지 프레임 단위로 지켜본다.
 *
 * [2026-08-18, D74] **`.summary-sheet` 안의 도넛은 세지 않는다.** 요약
 * 시트(`ui/result-panel.js`의 `summarySheet`, 화면에서는 `display: none`)도
 * 실제 결과가 나오는 즉시 `donutChart`를 그대로 재사용해 자기 도넛을
 * 그린다 — 인쇄 전용이라 "자리(도넛이 실제로 보이는 자리)"에는 참여하지
 * 않는데도, `.chart-donut`을 그냥 세면 그 사본까지 함께 잡혀 "도넛이 2개"
 * 로 오판한다(실측으로 확인 — 전환 순간 rings=1·donuts=1 프레임이 새로
 * 생겼다. 자리표시자가 채 사라지기 전에 요약 시트의 도넛이 이미 그려지기
 * 때문이다). `.closest('.summary-sheet')`로 걸러내면 이 자리 세기가 화면에
 * 실제로 "보이는" 도형만 다시 정확히 잰다.
 */
const WATCH_SEAT = `(() => {
  window.__seatSamples = [];
  window.__seatWatching = true;
  // [2026-08-20, D79] **첫 탭(.result-slot) 안으로 스코프를 좁힌다.**
  // 계산기2(D79)가 생기면서 그 결과 슬롯(.calc2-result-slot)도 항상
  // 문서에 있다 — 아직 그 탭을 연 적이 없으면 그 자리도 자리표시자
  // (.placeholder-ring)를 그리고 있다(입력 미완성 상태의 기본 화면).
  // 전역 querySelectorAll은 그 자리표시자까지 같이 세어, 첫 탭 쪽 전환이
  // 끝난 뒤에도 "링이 남아 있다"는 오탐을 낸다(실측 — 마지막 프레임이
  // [1,1]로 멈췄다, 1은 계산기2의 자리표시자다). 이 시험의 관심사는
  // 처음부터 첫 탭 하나였다(.result-slot을 스코프로 이미 관찰하던
  // MutationObserver와 같은 전제) — 세는 자리도 같은 스코프로 맞춘다.
  const scope = () => document.querySelector('.result-slot');
  const visibleDonutCount = () =>
    [...scope().querySelectorAll('.chart-donut')].filter((el) => !el.closest('.summary-sheet')).length;
  const ringCount = () => scope().querySelectorAll('.placeholder-ring').length;
  const sample = () => {
    const rings = ringCount();
    const donuts = visibleDonutCount();
    const last = window.__seatSamples[window.__seatSamples.length - 1];
    if (!last || last[0] !== rings || last[1] !== donuts) window.__seatSamples.push([rings, donuts]);
    if (window.__seatWatching) requestAnimationFrame(sample);
  };
  // DOM이 바뀌는 순간마다도 본다 — rAF 사이에 끼어든 교체를 놓치지 않는다.
  window.__seatObserver = new MutationObserver(() => {
    window.__seatSamples.push([ringCount(), visibleDonutCount()]);
  });
  window.__seatObserver.observe(document.querySelector('.result-slot'), { childList: true, subtree: true });
  requestAnimationFrame(sample);
  return true;
})()`;

let app;
const measurements = {};

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
  if (!skipWithoutChrome) console.log('\n[자리표시자 실측]', JSON.stringify(measurements, null, 1));
});

test('B1·B2 — 화면에 실제로 12조각이 같은 각으로 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const ring = await page.evaluate(MEASURE_RING);
  assert.ok(ring, '첫 진입은 언제나 입력 부족 상태이고 그 자리에 링이 있어야 한다');
  measurements.ring = ring;
  assert.equal(ring.sliceCount, 12, '결과 도넛은 최대 4조각이다 — 12는 결과가 만들 수 없는 수다');
});

test('B3 — 평면이다. 링의 가로와 세로가 같다 (결과 도넛은 기울기 15°라 다르다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const ring = await page.evaluate(MEASURE_RING);
  assert.ok(Math.abs(ring.ringWidth - ring.ringHeight) < 1, `기울어져 있습니다: ${ring.ringWidth} × ${ring.ringHeight}`);
});

test('B4 — 칠해진 색이 하나뿐이고 카드 대비가 2:1 미만이다 — 값의 잉크를 입을 수 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const ring = await page.evaluate(MEASURE_RING);
  assert.equal(ring.fills.length, 1, '조각마다 다르게 칠하지 않는다');
  assert.ok(ring.contrastVsCard < 2, `대비 ${ring.contrastVsCard.toFixed(2)} — 2:1을 넘으면 값으로 읽힌다`);
  // 값을 나르는 색은 전부 3:1 이상이고 2:1~3:1 사이는 비어 있다(3.5.3절).
  assert.ok(ring.contrastVsCard > 1, '표면과 같은 색이면 도형 자체가 안 보인다');
});

test('움직이지 않는다 — 회전·맥동·shimmer가 없다', { skip: skipWithoutChrome }, async () => {
  // shimmer는 `Skeleton`의 것이고 "요청했고 오는 중"을 뜻한다. 자리표시자는 아직
  // 아무것도 요청하지 않은 상태다. 움직이면 "곧 온다"로 읽힌다.
  const { page } = app;
  const ring = await page.evaluate(MEASURE_RING);
  assert.equal(ring.animationName, 'none');
  assert.equal(ring.svgAnimationName, 'none');
});

test('가운데 라벨 줄은 `월 배분`이고 값 줄만 `?`다. 숫자가 하나도 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const ring = await page.evaluate(MEASURE_RING);
  assert.deepEqual(ring.centerTspans, ['월 배분', '?']);
  // 예시 금액·평균 금액·`0원`·남은 항목 수 전부 금지. **숫자는 체크리스트에만 있다** —
  // 자리표시자에 적으면 조건부 필수 항목 때문에 두 곳의 수가 실제로 어긋난다.
  assert.equal(/[0-9]/.test(ring.text), false, `자리표시자에 숫자가 있습니다: ${ring.text}`);
  assert.equal(ring.hasLeader, false, '눈금·지시선이 없다');
});

test('`?`가 금액과 같은 메트릭이라 교체될 때 레이아웃이 밀리지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const same = await page.evaluate(`(() => {
    const q = getComputedStyle(document.querySelector('.placeholder-center-value'));
    // \`type-display\` — 40px / 700. 결과에서 이 자리에 들어오는 금액과 같은 크기·굵기다.
    return { fontSize: q.fontSize, fontWeight: q.fontWeight };
  })()`);
  assert.equal(same.fontSize, '40px');
  assert.equal(same.fontWeight, '700');
});

test('링은 `aria-hidden`이고, 그 자리를 시각적으로 숨긴 문장 하나가 대신한다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const a11y = await page.evaluate(`(() => {
    const hidden = document.querySelector('.result-placeholder .visually-hidden');
    const r = hidden.getBoundingClientRect();
    return {
      ringHidden: document.querySelector('.placeholder-ring').getAttribute('aria-hidden'),
      text: hidden.textContent,
      live: hidden.getAttribute('aria-live'),
      visualWidth: r.width, visualHeight: r.height,
    };
  })()`);
  assert.equal(a11y.ringHidden, 'true');
  assert.ok(a11y.text.startsWith('아직 계산 결과가 없습니다'));
  // **`aria-live`를 걸지 않는다** — 빈 상태는 갱신이 아니다.
  assert.equal(a11y.live, null);
  assert.ok(a11y.visualWidth <= 1 && a11y.visualHeight <= 1, '시각적으로는 숨겨져 있어야 한다');
});

test('강조 문구 두 줄이 링 아래에 있고 크기·굵기·색으로만 강조한다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const copy = await page.evaluate(`(() => {
    const lead = document.querySelector('.placeholder-copy-lead');
    const sub = document.querySelector('.placeholder-copy-sub');
    const ring = document.querySelector('.placeholder-ring');
    const cs = getComputedStyle(lead);
    const rootCs = getComputedStyle(document.documentElement);
    return {
      leadText: lead.textContent, subText: sub.textContent,
      leadSize: cs.fontSize, leadWeight: cs.fontWeight, leadColor: cs.color,
      subSize: getComputedStyle(sub).fontSize, subColor: getComputedStyle(sub).color,
      belowRing: lead.getBoundingClientRect().top >= ring.getBoundingClientRect().bottom,
      textPrimary: rootCs.getPropertyValue('--text-primary').trim(),
      accent: rootCs.getPropertyValue('--accent').trim(),
    };
  })()`);
  measurements.copy = copy;
  assert.equal(copy.leadText, '값을 모두 넣으면 여기에 결과가 표시됩니다');
  // D46 2·3번(관리자 판정) — 결과 화면에서 조항 표기를 뗀 것과 짝을 맞춰 문구를
  // 바꿨다("적용한 법령 조항" → "가정 사항").
  assert.equal(copy.subText, '계좌별 배분 · 계산된 절세액 · 가정 사항');
  assert.equal(copy.belowRing, true, '문구는 링 아래에 있다');
  assert.equal(copy.leadSize, '17px', 'type-title-s');
  assert.equal(copy.leadWeight, '600');
  assert.equal(copy.subSize, '14px', 'type-body-s');
  // `accent`는 누를 수 있는 것의 색이고 이 문구는 누를 수 없다.
  assert.equal(copy.leadColor, 'rgb(20, 24, 28)', '1행은 text-primary');
  assert.notEqual(copy.leadColor, copy.accent);
  // 느낌표·화살표를 쓰지 않는다.
  assert.equal(/[!！→▸➜]/.test(copy.leadText + copy.subText), false);
});

test('자리표시자가 남은 항목 수를 말하지 않는다 — 숫자는 체크리스트에만 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const both = await page.evaluate(`(() => ({
    checklist: document.querySelector('.req-progress-label').textContent,
    placeholder: document.querySelector('.result-placeholder').textContent,
  }))()`);
  assert.ok(/\d+\s*\/\s*\d+/.test(both.checklist), '진행 표시는 체크리스트가 갖는다');
  assert.equal(/\d/.test(both.placeholder), false);
});

// ---------------------------------------------------------------------------
// 전환 (5.29절)
// ---------------------------------------------------------------------------

test('자리표시자 → 결과 전환에서 두 도형이 함께 있는 순간이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(WATCH_SEAT);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(600);
  const samples = await page.evaluate(`(() => { window.__seatWatching = false; window.__seatObserver.disconnect(); return window.__seatSamples; })()`);
  measurements.seatSamples = samples;
  const overlaps = samples.filter(([rings, donuts]) => rings > 0 && donuts > 0);
  assert.deepEqual(overlaps, [], `자리표시자와 도넛이 함께 보인 프레임이 있습니다: ${JSON.stringify(samples)}`);
  // 마지막에는 도넛만 남는다.
  assert.deepEqual(samples[samples.length - 1], [0, 1]);
});

test('결과 → 자리표시자 복귀가 즉시 교체다 — 역재생하지 않는다', { skip: skipWithoutChrome }, async () => {
  // 역방향 애니메이션은 "결과가 자리표시자로 줄어든다"로 읽혀 금액이 감소한 것처럼
  // 보인다. 그래서 사라지는 링(`placeholder-ring-leaving`)이 이 방향에는 없다.
  const { page } = app;
  await page.evaluate(`window.__leavingSeen = 0;
    window.__revObserver = new MutationObserver(() => {
      if (document.querySelector('.placeholder-ring-leaving')) window.__leavingSeen++;
    });
    window.__revObserver.observe(document.querySelector('.result-slot'), { childList: true, subtree: true, attributes: true });`);
  // 되돌아가는 길은 초기화다. **필수 칸을 비우는 것만으로는 결과가 사라지지
  // 않는다** — 직전 결과를 지우지 않는다는 규약(6.1절 4번) 때문에 store가
  // `readyToCompute`가 아니어도 이미 있는 결과의 상태를 유지한다.
  await page.clickElement(`[...document.querySelectorAll('.input-panel-header button')].find((b) => b.textContent.includes('초기화'))`);
  await page.waitFor(`!!document.querySelector('.modal-scrim [role="dialog"]')`, { timeoutMs: 4000 });
  await page.clickElement(`[...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent.includes('모두 지우기'))`);
  await page.waitFor(`!!document.querySelector('.result-placeholder .placeholder-ring')`, { timeoutMs: 6000 });
  const seen = await page.evaluate(`(() => { window.__revObserver.disconnect(); return window.__leavingSeen; })()`);
  assert.equal(seen, 0, '복귀 방향에 사라지는 링이 나타났습니다 — 역재생입니다');
  assert.equal(await page.evaluate(`!!document.querySelector('.chart-donut')`), false, '도넛은 즉시 사라진다');
});

test('prefers-reduced-motion이면 전환이 0ms다 — 사라지는 링 단계가 아예 없다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.placeholder-ring')`);
  await page.evaluate(`window.__leavingSeen = 0;
    window.__rmObserver = new MutationObserver(() => {
      if (document.querySelector('.placeholder-ring-leaving')) window.__leavingSeen++;
    });
    window.__rmObserver.observe(document.querySelector('.result-slot'), { childList: true, subtree: true, attributes: true });`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  const seen = await page.evaluate(`(() => { window.__rmObserver.disconnect(); return window.__leavingSeen; })()`);
  assert.equal(seen, 0, 'reduced-motion에서 페이드 단계가 실행됐습니다');
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
});

test('결과 도넛이 들어와도 자리가 밀리지 않는다 — 상자 크기가 같다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.placeholder-ring')`);
  const before = await page.evaluate(`(() => {
    const r = document.querySelector('.placeholder-ring').getBoundingClientRect();
    return { width: r.width, height: r.height };
  })()`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(600);
  const after = await page.evaluate(`(() => {
    const r = document.querySelector('.result-slot .chart-donut').getBoundingClientRect();
    return { width: r.width, height: r.height };
  })()`);
  measurements.seat = { before, after };
  assert.ok(Math.abs(before.width - after.width) < 1, `자리 폭이 ${before.width} → ${after.width}로 바뀌었습니다`);
  assert.ok(Math.abs(before.height - after.height) < 1, `자리 높이가 ${before.height} → ${after.height}로 바뀌었습니다`);
});
