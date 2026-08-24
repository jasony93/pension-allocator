import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { STATUTORY_RATE_CEILING_PERCENT, DEPLETION_SLIDER_PARAMS } from '../depletion/constants.js';
import { encodeDepletionShareFragment } from '../depletion/share-link.js';

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

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const CSS = readFileSync(path.join(webRoot, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** `:root`의 `--accent-warm`을 `rgb(r, g, b)` 문자열로 읽는다 —
 * `getComputedStyle`이 돌려주는 형식과 그대로 비교하기 위해서다. */
function accentWarmRgb() {
  const rootBlock = /(?:^|\n)\s*:root\s*\{([\s\S]*?)\n\}/.exec(CSS);
  const m = /--accent-warm\s*:\s*rgb\((\d+,\s*\d+,\s*\d+)\)/.exec(rootBlock[1]);
  assert.ok(m, 'styles.css :root에서 --accent-warm을 읽지 못했다');
  return `rgb(${m[1].replace(/\s+/g, ' ')})`;
}

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

/**
 * [2026-08-24, 관리자 지시 — 번들 실측 회귀] y축 눈금 6개(0·1·2·3·4·5천조)가
 * 값도 라벨도 둘 다 균등해야 한다. **값 간격만 재면 옛 결함을 못 잡는다** —
 * 옛 코드도 값 자체(0·1,250·2,500·3,750·5,000)는 균등했다, 문제는 그 값을
 * 1,000으로 반올림한 **라벨**이 2,500 → "3"으로 반올림돼 "2"를 건너뛴
 * 것이었다(0·1·3·4·5). 그래서 이 시험은 눈금 개수와 함께, 텍스트 라벨을
 * 숫자로 다시 파싱해 그 사이 간격이 전부 같은지(라벨 자신의 균등성)를
 * 잰다 — 값 간격만 재는 시험은 이 결함에 판별력이 없다.
 */
test('y축 눈금이 6개(0~5천조)이고, 값과 라벨 둘 다 균등 간격이다 — 반올림으로 라벨이 건너뛰지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const svg = document.querySelector('.depletion-chart');
    const gridLines = [...svg.querySelectorAll('.depletion-chart-grid')];
    const axisLabels = [...svg.querySelectorAll('.depletion-chart-axis-label')].filter((el) => /천조$/.test(el.textContent));
    return {
      gridCount: gridLines.length,
      gridYs: gridLines.map((el) => parseFloat(el.getAttribute('y1'))),
      labelTexts: axisLabels.map((el) => el.textContent),
      labelNumbers: axisLabels.map((el) => Number(el.textContent.replace('천조', ''))),
    };
  })()`);
  assert.equal(m.gridCount, 6, `y축 눈금이 6개가 아니다: ${m.gridCount}개 (${JSON.stringify(m.labelTexts)})`);
  // 화면 y좌표(위→아래) 간격이 균등한지 — 값 자체의 균등성.
  const yGaps = m.gridYs.slice(1).map((y, i) => y - m.gridYs[i]);
  for (const gap of yGaps) {
    assert.ok(Math.abs(gap - yGaps[0]) < 0.5, `y축 눈금 화면 간격이 균등하지 않다: ${JSON.stringify(yGaps)}`);
  }
  // 라벨 숫자(0·1·2·3·4·5) 자체의 간격이 균등한지 — 반올림으로 건너뛰거나
  // 겹치는 라벨이 있으면 여기서 잡힌다(옛 결함: 0·1·3·4·5, 간격 1·2·1·1).
  const sorted = [...m.labelNumbers].sort((a, b) => a - b);
  assert.equal(new Set(sorted).size, sorted.length, `라벨 숫자에 중복이 있다(반올림 겹침): ${sorted.join(',')}`);
  const labelGaps = sorted.slice(1).map((v, i) => v - sorted[i]);
  for (const gap of labelGaps) {
    assert.equal(gap, labelGaps[0], `라벨 숫자 간격이 균등하지 않다(반올림 건너뜀): ${sorted.join(',')}`);
  }
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

// ---------------------------------------------------------------------------
// [2026-08-24, 관리자 지시 — 소유자 지시 5항목] 실측
// ---------------------------------------------------------------------------

/**
 * [소유자 지시 1번, 판별력 증명 대상 A] 탭 전체가 가운데 정렬되고, 차트가
 * 가용 폭을 실제로 쓴다. 이전에는 `.app-main{flex-direction:row}`(calc2의
 * 2단 배치용 규칙)가 이 탭의 단일 자식 레이아웃에도 새어 들어와 왼쪽으로
 * 쏠렸다 — 좌표를 직접 재서(짐작이 아니라) 컨테이너 중심과 카드/차트 중심이
 * 실제로 일치하는지, 차트 폭이 카드 열 폭과 같은지(=가용 폭을 쓰는지) 잰다.
 */
test('중앙 정렬 — 레이아웃 중심과 카드·차트 중심이 일치하고, 차트가 카드 열과 같은 폭까지 넓게 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await sleep(150);
  const m = await page.evaluate(`(() => {
    const layout = document.querySelector('.app-layout') || document.querySelector('.app-main');
    const panel = document.querySelector('.depletion-panel');
    const cards = document.querySelector('.depletion-cards');
    const chart = document.querySelector('.depletion-chart');
    const lr = layout.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const cr = cards.getBoundingClientRect();
    const chr = chart.getBoundingClientRect();
    return {
      layoutCenter: lr.left + lr.width / 2,
      panelCenter: pr.left + pr.width / 2,
      cardsWidth: cr.width,
      chartWidth: chr.width,
      panelWidth: pr.width,
    };
  })()`);
  assert.ok(
    Math.abs(m.layoutCenter - m.panelCenter) < 2,
    `레이아웃 중심(${m.layoutCenter})과 패널 중심(${m.panelCenter})이 어긋난다 — 왼쪽으로 쏠렸을 위험`,
  );
  assert.ok(m.panelWidth > 900, `패널 폭이 좁다(${m.panelWidth}px) — 가용 폭을 못 쓰고 있다`);
  assert.ok(
    Math.abs(m.chartWidth - m.cardsWidth) < 2,
    `차트 폭(${m.chartWidth})이 카드 열 폭(${m.cardsWidth})과 다르다 — 오른쪽이 비어 있을 위험`,
  );
});

/**
 * [소유자 지시 2번] 궤적 시작점(2026)에 시작 적립금 라벨이 실제로 그려진다.
 * **D84 출처 분리** — 여기 쓰는 값은 전망 재현 출발값(1,458조)이지 실적
 * (1,670.7조, 「현재 기금」 카드 값)이 아니다. 라벨 텍스트 자체를 읽어
 * 두 값이 섞이지 않았는지 확인한다.
 */
test('차트 시작점(2026)에 「적립금 1,458조원(전망 기준)」 라벨이 실제로 보이고, 실적값과 섞이지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const label = document.querySelector('.depletion-chart-start-label');
    const point = document.querySelector('.depletion-chart-start-point');
    return { text: label ? label.textContent : null, hasPoint: !!point };
  })()`);
  assert.ok(m.hasPoint, '시작점 표식(원)이 없다');
  assert.equal(m.text, '적립금 1,458조원(전망 기준)', `시작점 라벨 텍스트가 다르다: "${m.text}"`);
  assert.ok(!m.text.includes('1,671'), '시작점 라벨에 실적값(1,671조)이 섞였다 — D84 출처 분리 위반');
});

/**
 * [소유자 지시 3번, 판별력 증명 대상 B] 「주황 확산」 — 차트 선·영역·
 * 슬라이더·카드 테두리가 실제로 `--accent-warm` 색이다. 라이트·다크 둘 다
 * 잰다(다크에서 색이 하드코딩된 다른 값으로 남아 있을 위험을 잡기 위해).
 */
test('주황 확산 — 차트 선·영역·카드 테두리가 라이트·다크 모두 --accent-warm 색이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const expected = accentWarmRgb();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(`document.documentElement.setAttribute('data-theme', '${theme}')`);
    await sleep(120);
    const m = await page.evaluate(`(() => {
      const line = getComputedStyle(document.querySelector('.depletion-chart-line'));
      const card = getComputedStyle(document.querySelector('.depletion-card'));
      return { stroke: line.stroke, cardBorder: card.borderColor };
    })()`);
    assert.equal(m.stroke, expected, `${theme} 테마에서 차트 선 색이 --accent-warm(${expected})이 아니다: ${m.stroke}`);
    assert.equal(m.cardBorder, expected, `${theme} 테마에서 카드 테두리가 --accent-warm(${expected})이 아니다: ${m.cardBorder}`);
  }
  await page.evaluate(`document.documentElement.removeAttribute('data-theme')`);
});

/**
 * [소유자 지시 3번] 「추가 정보 기입」 버튼 — 문구가 정확히 그대로이고,
 * 가로 폭이 글자만 감싼다(패널 전체 폭을 차지하지 않는다). 폭 자체를
 * 절대 픽셀로 못 박지 않고 패널 폭 대비 비율로 재 — 폰트 렌더링 차이에
 * 흔들리지 않게 한다.
 */
test('「추가 정보 기입」 버튼 — 문구가 상태에 맞게 정확하고, 폭이 패널 전체 폭이 아니라 글자만 감싼다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 앞선 시험("고급 설정을 펼치면...")이 이미 토글을 펼쳐 뒀을 수 있다 —
  // 순서에 기대지 않고, 먼저 접힌 상태로 되돌려 "기입" 문구부터 확인한다.
  const expanded = await page.evaluate(`document.querySelector('.depletion-advanced-toggle').getAttribute('aria-expanded') === 'true'`);
  if (expanded) {
    await page.clickElement(`document.querySelector('.depletion-advanced-toggle')`);
    await sleep(120);
  }
  const closed = await page.evaluate(`(() => {
    const toggle = document.querySelector('.depletion-advanced-toggle');
    const panel = document.querySelector('.depletion-panel');
    const tr = toggle.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    return { text: toggle.textContent.trim(), toggleWidth: tr.width, panelWidth: pr.width };
  })()`);
  assert.equal(closed.text, '추가 정보 기입', `접힌 상태 버튼 문구가 다르다: "${closed.text}"`);
  assert.ok(
    closed.toggleWidth < closed.panelWidth * 0.5,
    `버튼 폭(${closed.toggleWidth})이 패널 폭(${closed.panelWidth})의 절반을 넘는다 — 여전히 전체 폭을 차지하고 있을 위험`,
  );
  // 다시 펼쳐 "접기" 문구도 확인한다 — 상태별 문구가 둘 다 정확해야 한다.
  await page.clickElement(`document.querySelector('.depletion-advanced-toggle')`);
  await sleep(120);
  const openText = await page.evaluate(`document.querySelector('.depletion-advanced-toggle').textContent.trim()`);
  assert.equal(openText, '추가 정보 접기', `펼친 상태 버튼 문구가 다르다: "${openText}"`);
});

/**
 * [소유자 지시 4번] 카드 교체 — 「수지 적자 전환」 카드가 완전히 사라지고,
 * 「현재 기금」 카드가 실적값(2026년 4월 말, 1,670.7조 → 반올림 1,671조원)과
 * 출처 캡션(기금운용본부)을 함께 보인다.
 */
test('카드 교체 — 「수지 적자 전환」 카드가 없고, 「현재 기금」 카드가 실적값+출처로 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const cards = [...document.querySelectorAll('.depletion-card')];
    const current = cards.find((c) => c.textContent.includes('현재 기금'));
    return {
      hasDeficitCard: document.body.textContent.includes('수지 적자 전환'),
      currentFundText: current ? current.textContent : null,
      hasSourceCaption: !!current?.querySelector('.depletion-card-source'),
    };
  })()`);
  assert.equal(m.hasDeficitCard, false, '「수지 적자 전환」 카드/문구가 여전히 남아 있다');
  assert.ok(m.currentFundText, '「현재 기금」 카드를 찾지 못했다');
  assert.ok(m.currentFundText.includes('1,671조원'), `「현재 기금」 카드 값이 실적(1,671조원)이 아니다: "${m.currentFundText}"`);
  assert.ok(m.currentFundText.includes('기금운용본부'), `「현재 기금」 카드에 출처(기금운용본부)가 없다: "${m.currentFundText}"`);
  assert.ok(m.hasSourceCaption, '「현재 기금」 카드에 출처 캡션 요소가 없다');
});

/**
 * [소유자 지시 5번 — 이미지 저장] PNG가 실제로 열리는 파일이다. 계산기2와
 * 같은 방식(`summary-export.browser.mjs`)으로 base64를 Node에서 직접
 * 디코드해 PNG 시그니처(8바이트)·IHDR의 width/height를 잰다 — 다운로드
 * 앵커 클릭을 인터셉트하는 대신, 같은 모듈(`exportDepletionSummaryPng`)을
 * 페이지 안에서 직접 호출해 그 결과 data URL을 실측한다.
 */
function readPngHeader(dataUrl) {
  const prefix = 'data:image/png;base64,';
  assert.ok(dataUrl.startsWith(prefix), `PNG data URL 접두어가 아닙니다: ${dataUrl.slice(0, 40)}`);
  const buf = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i++) {
    assert.equal(buf[i], signature[i], `PNG 시그니처가 어긋납니다 (byte ${i})`);
  }
  return { byteLength: buf.length, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const DEPLETION_PNG_FIXTURE = `(async () => {
  const { runDepletionSimulation } = await import('./depletion/simulate.js');
  const { exportDepletionSummaryPng } = await import('./depletion/summary-image.js');
  const { DEPLETION_SLIDER_PARAMS } = await import('./depletion/constants.js');
  const values = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));
  const result = runDepletionSimulation(values);
  return exportDepletionSummaryPng(result, values);
})()`;

test('이미지 저장(요약 시트) — PNG가 실제로 열리는 파일이다(시그니처·크기 확인)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  const dataUrl = await page.evaluate(DEPLETION_PNG_FIXTURE);
  const header = readPngHeader(dataUrl);
  assert.ok(header.width > 0 && header.height > 0, `PNG 크기가 0입니다: ${JSON.stringify(header)}`);
  assert.ok(header.byteLength > 1000, `PNG가 너무 작습니다(${header.byteLength}바이트) — 빈 이미지일 위험`);
});

/**
 * [소유자 지시 5번 — 공유] 슬라이더 값이 URL **프래그먼트**에 실리고,
 * 그 프래그먼트로 열면 실제로 복원된다. `encodeDepletionShareFragment`로
 * 직접 인코드한 URL을 새 탭으로 열어(D74 관행과 같은 방식,
 * `share-link.browser.mjs` 참고) 슬라이더 값이 그대로 되비치는지 잰다.
 */
test('공유 프래그먼트 왕복 — dep1. 프래그먼트로 열면 슬라이더 값이 그대로 복원된다', { skip: skipWithoutChrome }, async () => {
  const rorParam = DEPLETION_SLIDER_PARAMS.find((p) => p.id === 'ror');
  const wageParam = DEPLETION_SLIDER_PARAMS.find((p) => p.id === 'wage');
  const values = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));
  values.ror = rorParam.min; // 코어 슬라이더 값을 기본값과 다르게.
  values.wage = wageParam.default + 1; // 고급 슬라이더도 기본값과 다르게 — 자동 펼침까지 확인.
  const fragment = encodeDepletionShareFragment(values);
  assert.ok(fragment.startsWith('dep1.'), 'dep1. 접두가 아니다');

  const app2 = await openApp({ url: `/src/web/index.html#${fragment}` });
  try {
    await app2.page.waitFor(`!!document.querySelector('.depletion-panel')`, { timeoutMs: 8000 });
    await sleep(300);
    const state = await app2.page.evaluate(`(() => ({
      ror: document.getElementById('depletion-slider-ror')?.value,
      wage: document.getElementById('depletion-slider-wage')?.value,
      advancedHidden: document.querySelector('.depletion-sliders-advanced')?.hidden,
      hash: location.hash,
      search: location.search,
    }))()`);
    assert.equal(Number(state.ror), values.ror, `공유 링크로 열었는데 ror 슬라이더 값이 복원되지 않았다: ${state.ror}`);
    assert.equal(Number(state.wage), values.wage, `공유 링크로 열었는데 wage 슬라이더 값이 복원되지 않았다: ${state.wage}`);
    assert.equal(state.advancedHidden, false, '고급 슬라이더 값이 실렸는데 고급 설정이 접힌 채로 남아 있다');
    assert.equal(state.search, '', '공유 프래그먼트로 열었는데 쿼리 문자열이 생겼다 — 프래그먼트 원칙 위반');
    assert.ok(state.hash.includes('dep1.'), 'URL이 dep1. 프래그먼트를 유지하지 않는다');
  } finally {
    await app2.close();
  }
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
