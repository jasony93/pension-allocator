import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { STATUTORY_RATE_CEILING_PERCENT } from '../depletion/constants.js';

/**
 * 「연금고갈 시뮬레이션」 탭(D84 판정 2·3) — 실제 렌더 실측.
 *
 * 계산 자체(소진 연도·2030 대조 등)는 `depletion/simulate.test.mjs`(순수
 * 함수, jsdom 없이)가 이미 잠근다 — 이 파일은 jsdom 없이는 볼 수 없는 것만
 * 본다: (1) 카드·SVG 차트·슬라이더가 실제로 화면에 렌더되는가, (2) 슬라이더를
 * 조작하면 차트·카드가 실제로 다시 그려지는가, (3) 다크 모드에서도 차트가
 * 색을 입는가, (4) **자기완결 원칙(D84 판정 3)** — Chart.js 등 외부 CDN
 * 요청이 정말 0건인가, (5) 보험료율 슬라이더가 법정 상한(13%)을 넘으면
 * 경고 배너가 뜨는가, (6) 첫 탭(calc2)으로 가는 다리 링크가 실제로 탭을
 * 전환하는가.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-pension-depletion')`);
  await app.page.waitFor(`!!document.querySelector('.depletion-panel')`, { timeoutMs: 8000 });
  await sleep(300);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('탭 렌더 — 카드 3장·SVG 차트·핵심 가정 슬라이더가 실제로 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const panel = document.querySelector('.depletion-panel');
    const cards = [...panel.querySelectorAll('.depletion-card')];
    const svg = panel.querySelector('.depletion-chart');
    const svgRect = svg ? svg.getBoundingClientRect() : null;
    const coreSliders = [...panel.querySelectorAll('.depletion-sliders-core input[type="range"]')];
    return {
      cardCount: cards.length,
      cardTexts: cards.map((c) => c.textContent.trim()),
      hasSvg: !!svg,
      svgHasPath: !!svg?.querySelector('.depletion-chart-line'),
      svgWidth: svgRect ? svgRect.width : 0,
      svgHeight: svgRect ? svgRect.height : 0,
      coreSliderCount: coreSliders.length,
    };
  })()`);
  assert.equal(m.cardCount, 3, `카드가 3장이 아니다: ${m.cardCount} (${JSON.stringify(m.cardTexts)})`);
  assert.ok(m.hasSvg, 'SVG 차트를 찾지 못했다');
  assert.ok(m.svgHasPath, '차트 선(궤적)이 없다');
  assert.ok(m.svgWidth > 0 && m.svgHeight > 0, `SVG 차트가 0크기로 렌더됐다: ${m.svgWidth}x${m.svgHeight}`);
  assert.ok(m.coreSliderCount >= 1, '핵심 가정 슬라이더를 하나도 찾지 못했다');
});

test('빈 자리표시자·오류 상태 없이 로드와 동시에 계산된 값이 바로 선다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const panel = document.querySelector('.depletion-panel');
    const cardValues = [...panel.querySelectorAll('.depletion-card-value')].map((el) => el.textContent.trim());
    return { cardValues, hasErrorAlert: !!panel.querySelector('.inline-alert-error') };
  })()`);
  assert.ok(m.cardValues.every((v) => v.length > 0), `빈 카드 값이 있다: ${JSON.stringify(m.cardValues)}`);
  assert.equal(m.hasErrorAlert, false, '로드 직후 오류 상태가 떴다');
});

/**
 * [판별력 증명 대상 1] 슬라이더를 조작하면 차트 선(d 속성)과 카드 값이
 * 실제로 달라져야 한다 — `depletion-panel.js`의 `onSliderInput` → `values`
 * 갱신 → `rerenderComputed()` 재호출 배선이 실제로 도는지, jsdom 없이
 * 렌더된 DOM에서 직접 잰다(순수 함수 자체는 이미 단위 시험이 잠근다 —
 * 여기서 재는 것은 "화면이 그 순수 함수를 실제로 다시 부르는가"다).
 */
test('슬라이더를 조작하면 차트 선과 카드 값이 실제로 다시 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const before = await page.evaluate(`(() => ({
    lineD: document.querySelector('.depletion-chart-line')?.getAttribute('d'),
    depletionCardValue: document.querySelectorAll('.depletion-card-value')[0]?.textContent,
  }))()`);
  // 기금운용수익률 슬라이더를 최솟값으로 끌어내린다 — 소진 연도가 당겨져야
  // 하므로 궤적·카드 값이 둘 다 바뀔 것으로 기대한다.
  await page.evaluate(`(() => {
    const input = document.getElementById('depletion-slider-ror');
    input.value = input.min;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(150);
  const after = await page.evaluate(`(() => ({
    lineD: document.querySelector('.depletion-chart-line')?.getAttribute('d'),
    depletionCardValue: document.querySelectorAll('.depletion-card-value')[0]?.textContent,
    sliderValueLabel: document.getElementById('depletion-slider-ror-value')?.textContent,
  }))()`);
  assert.notEqual(after.lineD, before.lineD, '수익률 슬라이더를 바꿨는데 차트 선(d 속성)이 그대로다 — 재렌더가 안 걸렸다');
  assert.notEqual(after.depletionCardValue, before.depletionCardValue, '수익률 슬라이더를 바꿨는데 「기금 소진」 카드 값이 그대로다');
  assert.ok(after.sliderValueLabel && after.sliderValueLabel.length > 0, '슬라이더 값 표시가 비어 있다');
});

test('고급 설정을 펼치면 나머지 슬라이더가 나타나고, 값을 바꾸면 즉시 반영된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const beforeOpen = await page.evaluate(`document.querySelector('.depletion-sliders-advanced').hidden`);
  assert.equal(beforeOpen, true, '고급 설정이 기본으로 펼쳐져 있다');
  await page.clickElement(`document.querySelector('.depletion-advanced-toggle')`);
  await sleep(150);
  const afterOpen = await page.evaluate(`(() => ({
    hidden: document.querySelector('.depletion-sliders-advanced').hidden,
    ariaExpanded: document.querySelector('.depletion-advanced-toggle').getAttribute('aria-expanded'),
    advancedSliderCount: document.querySelectorAll('.depletion-sliders-advanced input[type="range"]').length,
  }))()`);
  assert.equal(afterOpen.hidden, false, '고급 설정 토글을 눌렀는데 여전히 접혀 있다');
  assert.equal(afterOpen.ariaExpanded, 'true', 'aria-expanded가 갱신되지 않았다');
  assert.ok(afterOpen.advancedSliderCount >= 1, '고급 슬라이더를 하나도 찾지 못했다');
});

test('보험료율 슬라이더가 법정 상한(13%)을 넘으면 "법정 스케줄이 아닌 가정" 경고가 뜬다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 보험료율 슬라이더는 「고급 설정」 안에 있다 — 앞 시험이 이미 펼쳐 뒀다.
  const beforeSet = await page.evaluate(`document.querySelector('.depletion-assumption-notes').hidden !== false`);
  assert.equal(beforeSet, true, '아직 슬라이더를 안 건드렸는데 경고가 떠 있다');
  await page.evaluate(`(() => {
    const input = document.getElementById('depletion-slider-rate');
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(150);
  const state = await page.evaluate(`(() => {
    const notesEl = document.querySelector('.depletion-assumption-notes');
    return { hidden: notesEl.hidden, text: notesEl.textContent };
  })()`);
  assert.equal(state.hidden, false, '보험료율을 상한 넘게 올렸는데 경고 배너가 뜨지 않았다');
  assert.ok(
    state.text.includes(`${STATUTORY_RATE_CEILING_PERCENT}%`),
    `경고 문구에 법정 상한(${STATUTORY_RATE_CEILING_PERCENT}%) 언급이 없다: ${state.text}`,
  );
  // 되돌린다 — 이후 시험(다크 모드 등)이 이 상태에 영향받지 않게 한다.
  await page.evaluate(`(() => {
    const input = document.getElementById('depletion-slider-rate');
    input.value = ${STATUTORY_RATE_CEILING_PERCENT};
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(150);
});

test('다크 모드에서도 차트 선·영역이 실제로 색을 입는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`);
  await sleep(150);
  const m = await page.evaluate(`(() => {
    const line = document.querySelector('.depletion-chart-line');
    const area = document.querySelector('.depletion-chart-area');
    const cs = getComputedStyle(line);
    const csArea = getComputedStyle(area);
    return { stroke: cs.stroke, areaFill: csArea.fill, areaOpacity: parseFloat(csArea.opacity) };
  })()`);
  assert.ok(m.stroke && m.stroke !== 'none' && m.stroke !== 'rgba(0, 0, 0, 0)', `다크 모드에서 차트 선에 색이 없다: ${m.stroke}`);
  assert.ok(m.areaFill && m.areaFill !== 'none' && m.areaFill !== 'rgba(0, 0, 0, 0)', `다크 모드에서 차트 영역에 색이 없다: ${m.areaFill}`);
  await page.evaluate(`document.documentElement.removeAttribute('data-theme')`);
});

/**
 * [D84 판정 3 — 자기완결 원칙] Chart.js 등 외부 CDN에 요청이 하나도
 * 나가지 않는다. `performance.getEntriesByType('resource')`는 이 문서가
 * 로드된 뒤 실제로 브라우저가 낸 모든 리소스 요청(스크립트·스타일시트·
 * 폰트·이미지 등)을 담는다 — 코드를 읽어 "CDN import가 없다"고 짐작하는
 * 대신, 실제 네트워크 계층에서 아무 요청도 나가지 않았다는 것을 잰다.
 */
test('D84 판정 3 — 외부 CDN(Chart.js 등)에 네트워크 요청이 0건이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const external = await page.evaluate(`(() => {
    const entries = performance.getEntriesByType('resource');
    const isExternal = (name) => {
      try {
        const u = new URL(name);
        return u.origin !== location.origin;
      } catch {
        return false;
      }
    };
    return entries.filter((e) => isExternal(e.name)).map((e) => e.name);
  })()`);
  assert.deepEqual(external, [], `외부 오리진으로 나간 리소스 요청이 있다(자기완결 원칙 위반): ${JSON.stringify(external)}`);
  // 스크립트·링크 태그 자체에도 외부 CDN 참조가 없어야 한다 — 요청이 아직
  // 안 나갔더라도(예: lazy) 태그 자체가 CDN을 겨누면 안 된다.
  const externalTags = await page.evaluate(`(() => {
    const urls = [...document.querySelectorAll('script[src], link[href]')].map((el) => el.src || el.href);
    return urls.filter((u) => { try { return new URL(u).origin !== location.origin; } catch { return false; } });
  })()`);
  assert.deepEqual(externalTags, [], `외부 CDN을 가리키는 <script>/<link> 태그가 있다: ${JSON.stringify(externalTags)}`);
});

/**
 * [D84 판정 2b — 다리] 결과 아래 「사적연금 배분으로 대비하기」류 링크를
 * 누르면 실제로 첫 탭(calc2)이 활성화된다. 지시형 문장·개인 금액 계산이
 * 없다는 것은 `depletion-copy.js`의 문구 자체가 정적으로 고정한다(단위
 * 시험 대상) — 여기서는 "링크가 실제로 탭을 전환하는가"만 잰다.
 */
test('다리 링크를 누르면 실제로 첫 탭(절세계좌 계산기)으로 전환된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.querySelector('.depletion-bridge-link')`);
  await sleep(200);
  const state = await page.evaluate(`(() => ({
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
    depletionHidden: document.getElementById('tabpanel-pension-depletion').classList.contains('tab-panel-hidden'),
    hash: location.hash,
  }))()`);
  assert.equal(state.calc2Hidden, false, '다리 링크를 눌렀는데 calc2 탭이 여전히 숨어 있다');
  assert.equal(state.depletionHidden, true, '다리 링크를 눌렀는데 시뮬레이션 탭이 여전히 보인다');
});
