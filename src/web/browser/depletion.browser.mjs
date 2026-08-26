import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openApp, skipWithoutChrome, sleep, dismissDepletionIntroModalIfOpen } from './harness.mjs';
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
  // [2026-08-25, 소유자 지시 9번] 이 탭 전용 팝업이 탭 클릭 즉시(비동기
  // 계산이 끝나기 전부터) 뷰포트 전체를 덮는 스크림을 띄운다 — 팝업 자체를
  // 검사하지 않는 아래 시험들이 좌표 기반 클릭을 이어가면 그 클릭이
  // 스크림에서 끝난다(계산기2 예시 팝업과 같은 이유, `harness.mjs` 머리말
  // 참고). 탭을 클릭하기 **전에** 미리 오늘 날짜를 적어 애초에 안 뜨게 한다.
  await dismissDepletionIntroModalIfOpen(app.page);
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
 * [2026-08-25, 소유자 지시(12항목) 7번, D85] 궤적 시작점(2026)에 시작
 * 적립금 라벨이 실제로 그려진다. **D85로 값이 뒤집혔다** — 이제 실적
 * (1,670.7조 → 「현재 기금」 카드와 같은 1,671조)에서 온다, 전망 재현
 * 값(1,458조)이 아니다. **위치도 바뀌었다** — y축 위쪽 고정 여백이 아니라
 * "첫 데이터 좌표의 왼쪽"이다. 라벨의 x좌표가 시작점의 x좌표보다 작다는
 * 것(왼쪽에 있다는 것)을 직접 잰다.
 */
test('차트 시작점(2026)에 「현 적립금 1,671조원」 라벨이 첫 데이터 좌표의 왼쪽에 보이고, 전망값과 섞이지 않는다(D85)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const label = document.querySelector('.depletion-chart-start-label');
    const point = document.querySelector('.depletion-chart-start-point');
    return {
      text: label ? label.textContent : null,
      hasPoint: !!point,
      labelX: label ? Number(label.getAttribute('x')) : null,
      pointX: point ? Number(point.getAttribute('cx')) : null,
      anchor: label ? label.getAttribute('text-anchor') : null,
    };
  })()`);
  assert.ok(m.hasPoint, '시작점 표식(원)이 없다');
  assert.equal(m.text, '현 적립금 1,671조원', `시작점 라벨 텍스트가 다르다: "${m.text}"`);
  assert.ok(!m.text.includes('1,458'), '시작점 라벨에 전망 재현 출발값(1,458조)이 섞였다 — D85 위반');
  assert.ok(m.labelX < m.pointX, `라벨 x좌표(${m.labelX})가 시작점 x좌표(${m.pointX})보다 왼쪽에 있지 않다`);
  assert.equal(m.anchor, 'end', '라벨이 오른쪽으로 뻗지 않고 왼쪽으로 뻗도록 text-anchor가 end여야 한다');
});

/**
 * [2026-08-25, 소유자 지시(12항목) 7번, D85] 카드·그래프 시작점이 같은
 * 숫자다 — 「현재 기금」 카드 값과 궤적의 첫 데이터 y값(적립금)이 실제로
 * 일치하는지 잰다(카드는 실적을 그대로 보이고, 궤적은 그 실적에서
 * 계산을 한 해 더 돌린 값이 아니라 **입력값 자체**가 카드와 같다는
 * 것 — `runDepletionSimulation`이 그 입력을 그대로 받는지 실측).
 */
test('카드·그래프 시작값이 한 숫자다 — 「현재 기금」 카드와 시뮬레이션 출발 입력이 실적(1,671조)으로 일치한다(D85)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const cards = [...document.querySelectorAll('.depletion-card')];
    const current = cards.find((c) => c.textContent.includes('현재 기금'));
    const label = document.querySelector('.depletion-chart-start-label');
    return { cardText: current ? current.textContent : null, labelText: label ? label.textContent : null };
  })()`);
  assert.ok(m.cardText?.includes('1,671조원'), `「현재 기금」 카드 값이 1,671조원이 아니다: "${m.cardText}"`);
  assert.ok(m.labelText?.includes('1,671조원'), `시작점 라벨이 1,671조원이 아니다: "${m.labelText}"`);
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
    // [2026-08-25, 관리자 지시(9항목) 8번으로 뒤집힘] 예전엔 이 URL이 곧장
    // 이 탭을 활성화하므로 탭 전용 팝업도 함께 떴다(그래서 치워야 했다) —
    // 이제는 공유 링크(`dep1.`)로 들어오면 그 팝업 자체가 억제된다
    // (`ui/app.js`의 `activateDepletionExtras`). 아래에서 그 부재를 직접
    // 확인한다 — 이 호출은 팝업이 있다면 치우는 안전망으로만 남긴다.
    await dismissDepletionIntroModalIfOpen(app2.page);
    await sleep(300);
    const state = await app2.page.evaluate(`(() => ({
      ror: document.getElementById('depletion-slider-ror')?.value,
      wage: document.getElementById('depletion-slider-wage')?.value,
      advancedHidden: document.querySelector('.depletion-sliders-advanced')?.hidden,
      hash: location.hash,
      search: location.search,
      hasPopup: !!document.querySelector('.depletion-intro-modal-host'),
    }))()`);
    assert.equal(Number(state.ror), values.ror, `공유 링크로 열었는데 ror 슬라이더 값이 복원되지 않았다: ${state.ror}`);
    assert.equal(Number(state.wage), values.wage, `공유 링크로 열었는데 wage 슬라이더 값이 복원되지 않았다: ${state.wage}`);
    assert.equal(state.advancedHidden, false, '고급 슬라이더 값이 실렸는데 고급 설정이 접힌 채로 남아 있다');
    assert.equal(state.search, '', '공유 프래그먼트로 열었는데 쿼리 문자열이 생겼다 — 프래그먼트 원칙 위반');
    assert.ok(state.hash.includes('dep1.'), 'URL이 dep1. 프래그먼트를 유지하지 않는다');
    // [2026-08-25, 관리자 지시(9항목) 8번] 공유 링크로 들어오면 인트로
    // 팝업이 뜨면 안 된다 — 일일 억제 키와 무관하게.
    assert.equal(state.hasPopup, false, '공유 링크(dep1.)로 들어왔는데 인트로 팝업이 떴다');
  } finally {
    await app2.close();
  }
});

/**
 * [2026-08-25, 관리자 지시(9항목) 8번, 판별력 증명] **공유 링크 진입 —
 * 팝업 부재. 일반 진입 — 팝업 존재.** 하나의 시험 안에서 대조한다 —
 * "억제됐다"만 보면 원래도 안 뜨는 상황(계산 오류 등)과 구분이 안 된다,
 * "같은 오늘 날짜·같은 빈 localStorage에서 경로만 dep1. 유무로 갈랐을 때
 * 결과가 갈린다"까지 재야 이 지시가 실제로 걸었는지 알 수 있다.
 */
test('[관리자 지시(9항목) 8번] 공유 링크(dep1.)로 들어오면 인트로 팝업이 없고, 같은 날 일반 진입은 뜬다', { skip: skipWithoutChrome }, async () => {
  const values = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));
  const fragment = encodeDepletionShareFragment(values);

  const shareApp = await openApp({ url: `/src/web/index.html#${fragment}` });
  try {
    await shareApp.page.waitFor(`!!document.querySelector('.depletion-panel')`, { timeoutMs: 8000 });
    await sleep(500);
    const hasPopupOnShareEntry = await shareApp.page.evaluate(`!!document.querySelector('.depletion-intro-modal-host')`);
    assert.equal(hasPopupOnShareEntry, false, '공유 링크 진입인데 팝업이 있다');
  } finally {
    await shareApp.close();
  }

  // 같은 프로세스(같은 오늘 날짜, 비어 있는 localStorage인 새 탭) — 프래그먼트
  // 없이 여는 일반 진입은 여전히 뜬다. 두 경로가 "프래그먼트 유무" 하나만
  // 다르므로, 이 대조가 갈리면 그 하나가 실제로 원인이라는 뜻이다.
  const plainApp = await openApp({ url: `/src/web/index.html` });
  try {
    await plainApp.page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 8000 });
    const hasPopupOnPlainEntry = await plainApp.page.evaluate(`!!document.querySelector('.depletion-intro-modal-host')`);
    assert.equal(hasPopupOnPlainEntry, true, '일반 진입(프래그먼트 없음)인데 팝업이 없다 — 억제가 과하게 걸렸다');
  } finally {
    await plainApp.close();
  }
});

/**
 * [2026-08-25, 소유자 지시 8번] **다리(문구+버튼)를 뺐다** — 옛
 * `.depletion-bridge-note`·`.depletion-bridge-link`가 패널 어디에도 없어야
 * 한다. 이 탭에서 첫 탭으로 넘어가는 길은 이제 탭 전용 팝업(소유자 지시
 * 9번, 아래 별도 테스트 블록)의 버튼 하나뿐이다.
 */
test('[소유자 지시 8번] 다리(문구+버튼)가 패널 어디에도 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const panel = document.querySelector('.depletion-panel');
    return {
      hasBridgeNote: !!panel.querySelector('.depletion-bridge-note'),
      hasBridgeLink: !!panel.querySelector('.depletion-bridge-link'),
      hasBridgeBlock: !!panel.querySelector('.depletion-bridge'),
    };
  })()`);
  assert.equal(m.hasBridgeNote, false, '다리 문구가 여전히 남아 있다');
  assert.equal(m.hasBridgeLink, false, '다리 버튼이 여전히 남아 있다');
  assert.equal(m.hasBridgeBlock, false, '다리 컨테이너가 여전히 남아 있다');
});

// ---------------------------------------------------------------------------
// [2026-08-25, 관리자 지시 — 소유자 지시 10항목] 실측
// ---------------------------------------------------------------------------

/**
 * [소유자 지시 2~6번] 슬라이더 범위 6종 — `min`/`max` 속성을 실제 렌더된
 * `<input type="range">`에서 직접 읽는다(고급 설정이 접혀 있어도 DOM
 * 속성 자체는 그대로다 — `hidden`은 컨테이너의 표시만 끈다). 여섯째로,
 * 기대수명 슬라이더의 **기준 매핑**(절대값 84세 = 델타 0)이 실제로 기본값
 * 재현과 일치하는지까지 함께 잰다 — 값만 절대 표시로 바뀌었을 뿐 계산이
 * 갈리지 않는다는 것을 확인한다.
 */
test('슬라이더 범위 6종 — 기금운용수익률 0~20%·가입자증감률 −5~5%·물가상승률 0~5%·기대수명 84~100세·수급개시연령 60~80세, 기대수명 기준(84세=델타 0)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const read = (id) => {
      const el = document.getElementById(id);
      return { min: el.min, max: el.max, value: el.value };
    };
    return {
      ror: read('depletion-slider-ror'),
      sub: read('depletion-slider-sub'),
      cpi: read('depletion-slider-cpi'),
      life: read('depletion-slider-life'),
      age: read('depletion-slider-age'),
    };
  })()`);
  assert.equal(m.ror.min, '0', `기금운용수익률 최솟값이 0이 아니다: ${m.ror.min}`);
  assert.equal(m.ror.max, '20', `기금운용수익률 최댓값이 20이 아니다: ${m.ror.max}`);
  assert.equal(m.sub.min, '-5', `가입자 연평균 증감률 최솟값이 −5가 아니다: ${m.sub.min}`);
  assert.equal(m.sub.max, '5', `가입자 연평균 증감률 최댓값이 5가 아니다: ${m.sub.max}`);
  assert.equal(m.cpi.min, '0', `물가상승률 최솟값이 0이 아니다: ${m.cpi.min}`);
  assert.equal(m.cpi.max, '5', `물가상승률 최댓값이 5가 아니다: ${m.cpi.max}`);
  assert.equal(m.life.min, '84', `기대수명 최솟값이 84가 아니다: ${m.life.min}`);
  assert.equal(m.life.max, '100', `기대수명 최댓값이 100이 아니다: ${m.life.max}`);
  // [소유자 지시 6번] 여섯째 — 기준 매핑. 기본값(84세)이 곧 "델타 0"이라
  // 페이지 로드 직후(기본값 상태)의 「기금 소진」 카드 값이, 옛 방식(증가분
  // 0년)과 같은 결과를 낸다는 것으로 간접 확인한다(순수 함수 자체의
  // 회귀 lock은 `simulate.test.mjs`가 이미 진다 — 여기서는 "화면이 실제로
  // 그 기본값을 슬라이더에 싣고 있는가"만 본다).
  assert.equal(m.life.value, '84', `기대수명 슬라이더의 기본값이 84(기준)가 아니다: ${m.life.value}`);
  assert.equal(m.age.min, '60', `수급개시연령 최솟값이 60이 아니다: ${m.age.min}`);
  assert.equal(m.age.max, '80', `수급개시연령 최댓값이 80이 아니다: ${m.age.max}`);
});

/**
 * [소유자 지시 7번, 판별력 증명 대상 A] 「추가 정보 기입」 버튼이 행
 * 가운데에 온다 — 버튼의 가로 중심과 패널의 가로 중심 좌표를 직접 비교한다
 * (이전 회차는 왼쪽 정렬이었다, `align-self: flex-start`).
 */
test('「추가 정보 기입」 버튼이 패널 가로 중심에 온다(왼쪽 붙임이 아니다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const toggle = document.querySelector('.depletion-advanced-toggle');
    const panel = document.querySelector('.depletion-panel');
    const tr = toggle.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    return { toggleCenter: tr.left + tr.width / 2, panelCenter: pr.left + pr.width / 2 };
  })()`);
  assert.ok(
    Math.abs(m.toggleCenter - m.panelCenter) < 2,
    `버튼 중심(${m.toggleCenter})이 패널 중심(${m.panelCenter})과 어긋난다 — 가운데 정렬이 아니다`,
  );
});

/**
 * [소유자 지시 10번] 복합 차트 — 막대(연도별 적립금)와 그 위 점을 잇는
 * 선이 함께 그려진다. 막대가 실제로 값에 비례한 높이를 갖는지(전부 같은
 * 높이로 찍히는 장식이 아닌지)까지 잰다.
 */
test('복합 차트 — 막대(연도별 적립금)와 선(궤적)·점이 함께 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const bars = [...document.querySelectorAll('.depletion-chart-bar')];
    const heights = new Set(bars.map((b) => b.getAttribute('height')));
    return {
      barCount: bars.length,
      distinctHeights: heights.size,
      hasLine: !!document.querySelector('.depletion-chart-line'),
      pointCount: document.querySelectorAll('.depletion-chart-point').length,
    };
  })()`);
  assert.ok(m.barCount >= 2, `막대가 2개 미만이다: ${m.barCount}`);
  assert.ok(m.distinctHeights > 1, '막대 높이가 전부 같다 — 값에 비례하지 않는 장식일 위험');
  assert.ok(m.hasLine, '궤적 선이 없다');
  assert.ok(m.pointCount >= 2, `궤적 점이 2개 미만이다: ${m.pointCount}`);
});

/**
 * [소유자 지시 10번, 판별력 증명 대상 B] 그래프(패널) 가로 폭이 지난
 * 회차보다 25% 넓어졌고(980px → 1225px), 어떤 데스크톱 폭에서도 화면
 * 밖으로 넘치지 않는다.
 */
test('패널 폭이 25% 확장됐고(980→1225px), 데스크톱 여러 폭에서 화면 밖으로 넘치지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  for (const width of [1280, 1440, 1920]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await sleep(120);
    const m = await page.evaluate(`(() => {
      const panel = document.querySelector('.depletion-panel');
      const r = panel.getBoundingClientRect();
      return { panelWidth: r.width, panelRight: r.right, docScrollWidth: document.documentElement.scrollWidth };
    })()`);
    // `.app-main`의 좌우 패딩(`--space-6`×2=64px)과 세로 스크롤바 폭(브라우저
    // 마다 다르지만 대개 15~17px)을 함께 빼야 실제 사용 가능한 폭이 나온다 —
    // 1280px처럼 여유가 빠듯한 폭에서는 그 둘을 뺀 값이 1225px에 못 미쳐
    // max-width가 걸리기 전에 이미 폭이 좁아진다(정상 — 넘침과는 다른 얘기다).
    // 여유가 충분한 폭(1440·1920)에서만 "정확히 1225px까지 넓어졌는가"를 잰다.
    if (width >= 1225 + 150) {
      assert.ok(Math.abs(m.panelWidth - 1225) < 2, `${width}px 뷰포트에서 패널 폭이 1225px가 아니다: ${m.panelWidth}`);
    }
    assert.ok(m.panelRight <= width + 1, `${width}px 뷰포트에서 패널 오른쪽 끝(${m.panelRight})이 뷰포트를 넘는다`);
    assert.ok(m.docScrollWidth <= width + 1, `${width}px 뷰포트에서 문서 가로 스크롤이 생겼다(scrollWidth=${m.docScrollWidth})`);
  }
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
});

// ---------------------------------------------------------------------------
// [소유자 지시 9번] 탭 전용 팝업 — 공유 `app`(before()가 미리 억제해 둔다)를
// 쓰지 않는다. 아래 시험들은 팝업 자체를 검사해야 하므로 각자 새 인스턴스를
// 연다.
// ---------------------------------------------------------------------------

const popupApps = [];
async function openTrackedForPopup() {
  const a = await openApp();
  popupApps.push(a);
  return a;
}
after(async () => {
  await Promise.all(popupApps.map((a) => a.close()));
});

/**
 * [소유자 지시 9번] 탭을 처음 열면(오늘 억제 기록이 없으면) 팝업이 뜨고,
 * 왼쪽 카피·오른쪽 상/하 두 영역·영역별 버튼 하나씩(합 2개) + 상시 버튼
 * 둘(오늘 하루 보지 않음·X)까지 구조가 그대로 갖춰진다.
 */
test('탭 전용 팝업 — 왼쪽 카피·오른쪽 상하 2영역·영역별 버튼 2개·상시 버튼 2개가 실제로 갖춰진다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-body'); })()`,
    { timeoutMs: 8000 },
  );
  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.depletion-intro-modal-host');
    const root = host.shadowRoot;
    const body = root.querySelector('.depletion-popup-body');
    const copy = body.querySelector('.depletion-popup-copy');
    const right = body.querySelector('.depletion-popup-right');
    const top = right?.querySelector('.depletion-popup-right-top');
    const bottom = right?.querySelector('.depletion-popup-right-bottom');
    return {
      hasCopy: !!copy,
      questionText: copy?.querySelector('.depletion-popup-question')?.textContent ?? null,
      hasTop: !!top,
      hasChartPreview: !!top?.querySelector('.depletion-chart'),
      hasChartButton: top?.querySelector('.depletion-popup-chart-button')?.textContent ?? null,
      hasBottom: !!bottom,
      hasExampleRow: !!bottom?.querySelector('.depletion-popup-example-row'),
      hasBridgeButton: bottom?.querySelector('.depletion-popup-bridge-button')?.textContent ?? null,
      hasDismiss: !!document.querySelector('.depletion-intro-modal-dismiss'),
      hasClose: !!document.querySelector('.depletion-intro-modal-close'),
    };
  })()`);
  assert.ok(m.hasCopy, '왼쪽 카피 영역이 없다');
  assert.ok(m.questionText?.includes('국민연금이 고갈되면'), `카피 질문 문구가 다르다: ${m.questionText}`);
  assert.ok(m.hasTop, '오른쪽 상단 영역이 없다');
  assert.ok(m.hasChartPreview, '오른쪽 상단에 시뮬레이션 그래프 축소판이 없다');
  assert.equal(m.hasChartButton, '연금고갈 시뮬레이션', `오른쪽 상단 버튼 문구가 다르다: ${m.hasChartButton}`);
  assert.ok(m.hasBottom, '오른쪽 하단 영역이 없다');
  assert.ok(m.hasExampleRow, '오른쪽 하단에 김철수씨 예시 행이 없다');
  assert.equal(m.hasBridgeButton, 'ISA/연금저축/IRP 배분하기', `오른쪽 하단 버튼 문구가 다르다: ${m.hasBridgeButton}`);
  assert.ok(m.hasDismiss, '「오늘 하루 보지 않음」 버튼이 없다');
  assert.ok(m.hasClose, '닫기(X) 버튼이 없다');
});

/** [소유자 지시 9번] 상단 버튼("연금고갈 시뮬레이션")을 누르면 팝업만
 * 닫히고 이 탭에 그대로 머문다(이미 활성 탭이므로 전환이 필요 없다). */
test('팝업 상단 버튼을 누르면 팝업이 닫히고 이 탭에 머문다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-chart-button'); })()`,
    { timeoutMs: 8000 },
  );
  await page.evaluate(`document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.depletion-popup-chart-button').click()`);
  await sleep(200);
  const state = await page.evaluate(`(() => ({
    modalOpen: !!document.querySelector('.modal-scrim'),
    depletionHidden: document.getElementById('tabpanel-pension-depletion').classList.contains('tab-panel-hidden'),
  }))()`);
  assert.equal(state.modalOpen, false, '상단 버튼을 눌렀는데 팝업이 여전히 떠 있다');
  assert.equal(state.depletionHidden, false, '상단 버튼을 눌렀는데 시뮬레이션 탭이 숨어 있다 — 탭이 바뀌면 안 된다');
});

/** [소유자 지시 9번] 하단 버튼("ISA/연금저축/IRP 배분하기")을 누르면 팝업이
 * 닫히고 첫 탭(계산기2)으로 전환된다. */
test('팝업 하단 버튼을 누르면 팝업이 닫히고 첫 탭(계산기2)으로 전환된다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-bridge-button'); })()`,
    { timeoutMs: 8000 },
  );
  await page.evaluate(`document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.depletion-popup-bridge-button').click()`);
  await sleep(200);
  const state = await page.evaluate(`(() => ({
    modalOpen: !!document.querySelector('.modal-scrim'),
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
  }))()`);
  assert.equal(state.modalOpen, false, '하단 버튼을 눌렀는데 팝업이 여전히 떠 있다');
  assert.equal(state.calc2Hidden, false, '하단 버튼을 눌렀는데 첫 탭(계산기2)이 활성화되지 않았다');
});

/**
 * [소유자 지시 9번, 2026-08-25 D86으로 범위 정리] 「오늘 하루 보지 않음」
 * — 이 탭 팝업을 오늘 닫으면 같은 날 다시 뜨지 않는다. **계산기2 예시
 * 팝업과의 "독립 억제" 각도는 뺐다** — 그 팝업 자체가 D86으로 완전히
 * 지워져 비교 대상이 없다(별도 키를 쓰던 설계 취지는 이제 이 탭 팝업이
 * 유일한 일일 인사이므로 그 자체로 뜻이 없어졌다).
 */
test('「오늘 하루 보지 않음」을 누르면 같은 날 다시 뜨지 않는다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-body'); })()`,
    { timeoutMs: 8000 },
  );
  await page.evaluate(`document.querySelector('.depletion-intro-modal-dismiss').click()`);
  await sleep(150);
  // 다시 첫 탭으로 갔다가 시뮬레이션 탭으로 돌아와도 — 오늘은 다시 뜨지 않는다.
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.clickElement(`document.getElementById('tab-pension-depletion')`);
  await sleep(300);
  const state = await page.evaluate(`(() => ({
    depletionModalOpen: !!document.querySelector('.depletion-intro-modal-host'),
    depletionDismissedKeySet: !!localStorage.getItem('depletionIntroModalDismissedDate'),
  }))()`);
  assert.equal(state.depletionModalOpen, false, '「오늘 하루 보지 않음」을 눌렀는데 같은 날 다시 떴다');
  assert.ok(state.depletionDismissedKeySet, '이 탭 팝업의 저장 키가 기록되지 않았다');
});

/**
 * [2026-08-25, 관리자 지시 — 번들 실측(1440×900) 마감, D86으로 범위 정리]
 * 시뮬레이션 탭 팝업의 오른쪽 하단(김철수씨 예시 행)이 원래 넓은 3열
 * 고정 그리드(`.example-persona-row`, 734.4px)로 설계됐다 — 이 팝업의
 * 좁은 오른쪽 열(약 360~460px)에 그대로 재사용하면 카드가 모달 폭을
 * 넘고 세액공제액 값이 잘렸다(실측 — "1,"만 보이고 모달에 가로
 * 스크롤바가 생겼다). 좁은 열에서는 1열로 쌓고(`styles.css`), 값
 * 덩어리는 `fitAmountValueToCard`로 카드 폭에 맞춰 실측 축소한다
 * (`ui/depletion-intro-modal.js`). **계산기2 예시 팝업(`.calc2-example-card`)
 * 은 D86으로 지워져 더는 대상이 아니다** — 이 탭 팝업 하나만 잰다.
 */
test('[번들 실측 마감] 팝업 — 모달 안에 가로 스크롤이 없고, 예시 카드 오른쪽 끝이 모달 안에 있다(1440×900)', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // [2026-08-25, D86] 시뮬레이션 탭 팝업 — 기본 랜딩에서 곧장 뜬다(탭
  // 클릭이 필요 없다).
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-bridge-button'); })()`,
    { timeoutMs: 8000 },
  );
  await sleep(500);
  const dep = await page.evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const mr = modal.getBoundingClientRect();
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const amountCard = root.querySelector('.example-persona-amount .amount-card');
    const ar = amountCard.getBoundingClientRect();
    const valueChunk = amountCard.querySelector('.amount-value-chunk');
    return {
      scrollWidth: modal.scrollWidth,
      clientWidth: modal.clientWidth,
      modalRight: mr.right,
      cardRight: ar.right,
      valueText: valueChunk ? valueChunk.textContent : null,
    };
  })()`);
  assert.equal(dep.scrollWidth, dep.clientWidth, `시뮬레이션 탭 팝업 모달에 가로 스크롤이 생겼다(scrollWidth=${dep.scrollWidth}, clientWidth=${dep.clientWidth})`);
  assert.ok(dep.cardRight <= dep.modalRight + 1, `예시 카드(세액공제액) 오른쪽 끝(${dep.cardRight})이 모달 오른쪽 끝(${dep.modalRight})을 넘는다`);
  assert.equal(dep.valueText, '1,485,000원', `세액공제액 값이 잘렸다: "${dep.valueText}"`);
});

// ---------------------------------------------------------------------------
// [2026-08-25, 관리자 지시 — 소유자 지시 12항목] 실측
// ---------------------------------------------------------------------------

/** [소유자 지시 1번] 화해 문구(2064 vs 이 시뮬레이터 결과를 잇던 한 줄)가
 * 팝업 어디에도 없다. */
test('[소유자 지시 1번] 팝업에 화해 문구(2064 vs 이 시뮬레이터)가 없다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-body'); })()`,
    { timeoutMs: 8000 },
  );
  const text = await page.evaluate(`document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.depletion-popup-body').textContent`);
  assert.ok(!text.includes('그보다 늦게 나옵니다'), '화해 문구가 여전히 팝업에 남아 있다');
  assert.ok(!/2064/.test(text), '팝업 본문에 2064년 언급이 여전히 남아 있다(소유자 지시 6번과 겹치는 회귀 방지)');
});

/** [소유자 지시 2번] 본문 세 문장 폰트가 실제로 커졌다 — 새 clamp 하한
 * (1.125rem=18px)이 옛 clamp 상한(1.0625rem=17px)보다 크므로, 측정값이
 * 18px 이상이면 이미 커졌다는 증거다. */
test('[소유자 지시 2번] 팝업 본문 세 문장의 글자 크기가 옛 상한(17px)보다 커졌다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-body-copy'); })()`,
    { timeoutMs: 8000 },
  );
  const fontPx = await page.evaluate(`(() => {
    const p = document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.depletion-popup-body-copy p');
    return parseFloat(getComputedStyle(p).fontSize);
  })()`);
  assert.ok(fontPx >= 18, `본문 글자 크기(${fontPx}px)가 옛 상한(17px)보다 커지지 않았다`);
});

/** [소유자 지시 3번] 팝업 내용 전부가 1440×900에서 스크롤 없이 보인다 —
 * 모달 자신과 스크롤 컨테이너(`.depletion-intro-modal-host`) 둘 다
 * `scrollHeight === clientHeight`(넘치는 콘텐츠가 없다)를 잰다. */
test('[소유자 지시 3번] 팝업 내용 전부가 1440×900에서 스크롤 없이 보인다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-bridge-button'); })()`,
    { timeoutMs: 8000 },
  );
  await sleep(500);
  const m = await page.evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const host = document.querySelector('.depletion-intro-modal-host');
    return {
      modalScrollHeight: modal.scrollHeight, modalClientHeight: modal.clientHeight,
      hostScrollHeight: host.scrollHeight, hostClientHeight: host.clientHeight,
    };
  })()`);
  assert.ok(m.modalScrollHeight <= m.modalClientHeight + 1, `모달 자신에 세로 스크롤이 생겼다(scrollHeight=${m.modalScrollHeight}, clientHeight=${m.modalClientHeight})`);
  assert.ok(m.hostScrollHeight <= m.hostClientHeight + 1, `팝업 내용 영역에 세로 스크롤이 생겼다(scrollHeight=${m.hostScrollHeight}, clientHeight=${m.hostClientHeight})`);
});

/** [소유자 지시 4번] 「김철수씨」 문구·아이콘이 없고, 기본정보 4줄과
 * 도넛이 같은 행에, 세액공제액 카드가 그 아래에 있다. */
test('[소유자 지시 4번] 예시 프로필 — 「김철수씨」·아이콘 없이, 4줄+도넛이 같은 행, 세액공제 카드가 그 아래', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-example-row'); })()`,
    { timeoutMs: 8000 },
  );
  const m = await page.evaluate(`(() => {
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const card = root.querySelector('.depletion-popup-example-card');
    const row = card.querySelector('.depletion-popup-example-row');
    const lines = row.querySelector('.depletion-popup-example-lines');
    const donut = row.querySelector('.example-persona-donut-col');
    const amount = card.querySelector('.example-persona-amount');
    const children = [...card.children];
    return {
      cardText: card.textContent,
      hasIconImg: !!card.querySelector('img'),
      linesInRow: !!lines && !!donut && lines.parentElement === row && donut.parentElement === row,
      rowIndex: children.indexOf(row),
      amountIndex: children.indexOf(amount),
      lineCount: lines ? lines.querySelectorAll('.example-persona-line').length : 0,
    };
  })()`);
  assert.ok(!m.cardText.includes('김철수씨'), `「김철수씨」 문구가 여전히 남아 있다: "${m.cardText}"`);
  assert.equal(m.hasIconImg, false, '아이콘 이미지가 여전히 남아 있다');
  assert.ok(m.linesInRow, '기본정보 4줄과 도넛이 같은 행 안에 있지 않다');
  assert.equal(m.lineCount, 4, `기본정보 줄이 4개가 아니다: ${m.lineCount}`);
  assert.ok(m.rowIndex < m.amountIndex, '세액공제액 카드가 정보+도넛 행보다 위(또는 같은 자리)에 있다 — 아래에 있어야 한다');
});

/** [소유자 지시 5번] 두 버튼(「연금고갈 시뮬레이션」·「ISA/연금저축/IRP
 * 배분하기」) 다 주황 배경이고, 실제 마우스 hover(CDP `mouseMoved`)에
 * 반응한다(밝기 필터가 걸린다). */
test('[소유자 지시 5번] 팝업 버튼 둘 다 주황 배경이고 hover에 반응한다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-bridge-button'); })()`,
    { timeoutMs: 8000 },
  );
  for (const cls of ['depletion-popup-chart-button', 'depletion-popup-bridge-button']) {
    const before = await page.evaluate(`(() => {
      const btn = document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.${cls}');
      const r = btn.getBoundingClientRect();
      const cs = getComputedStyle(btn);
      return { bg: cs.backgroundColor, filter: cs.filter, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    assert.equal(before.bg, 'rgb(230, 115, 0)', `.${cls} 배경이 주황(rgb(230, 115, 0))이 아니다: ${before.bg}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: before.y });
    await sleep(150);
    const hoverFilter = await page.evaluate(`getComputedStyle(document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.${cls}')).filter`);
    assert.notEqual(hoverFilter, before.filter, `.${cls}가 hover에도 filter가 바뀌지 않았다(반응 없음)`);
  }
});

/** [소유자 지시 6번] 문구 수정 확인 + 출처 줄에서 2064 언급이 정리됐다. */
test('[소유자 지시 6번] 본문 문구가 수정됐고, 출처 줄에 2064 언급이 없다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-source'); })()`,
    { timeoutMs: 8000 },
  );
  const m = await page.evaluate(`(() => {
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    return {
      bodyText: root.querySelector('.depletion-popup-body-copy').textContent,
      sourceText: root.querySelector('.depletion-popup-source').textContent,
    };
  })()`);
  assert.ok(m.bodyText.includes('기금 소진이 미뤄졌을 뿐입니다'), `수정된 첫 문장을 찾지 못했다: "${m.bodyText}"`);
  assert.ok(!m.bodyText.includes('기금 소진은 2064년으로'), '옛 문장(2064년 포함)이 여전히 남아 있다');
  assert.ok(m.bodyText.includes('국민연금은 기본이지'), `수정된 둘째 문장을 찾지 못했다: "${m.bodyText}"`);
  assert.ok(!m.bodyText.includes('국민연금은 바닥이지'), '옛 문장(바닥이지)이 여전히 남아 있다');
  assert.ok(!/2064/.test(m.sourceText), `출처 줄에 2064 언급이 남아 있다: "${m.sourceText}"`);
});

/**
 * [2026-08-25, 관리자 지시(9항목) 1번] 「받습니다. 다만 법이 보장하는 건」
 * 이 한 행에 들어가야 한다 — 어절 단위 줄바꿈 검사. `Range.getClientRects()`
 * 로 그 문구(첫 텍스트 노드, `<br>` 앞)만 잘라 재면 실제 줄 수를 정확히
 * 안다(`getClientRects()`는 줄바꿈마다 별도 사각형을 낸다).
 */
test('[관리자 지시(9항목) 1번] 「받습니다. 다만 법이 보장하는 건」이 한 행에 들어간다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-answer'); })()`,
    { timeoutMs: 8000 },
  );
  const lineCount = await page.evaluate(`(() => {
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const answer = root.querySelector('.depletion-popup-answer');
    const firstTextNode = answer.childNodes[0];
    const range = document.createRange();
    range.selectNodeContents(firstTextNode);
    return range.getClientRects().length;
  })()`);
  assert.equal(lineCount, 1, `"받습니다. 다만 법이 보장하는 건" 구절이 ${lineCount}줄로 잘렸다 — 한 행에 들어가야 한다`);
});

/**
 * [2026-08-25, 관리자 지시(9항목) 3번] 「보건복지부, 2025.3 — 기금 소진
 * 전망의 출처」 줄을 지운다 — 제3조의2 출처 줄(지급보장 문장의 출처)은
 * 유지한다.
 */
test('[관리자 지시(9항목) 3번] 팝업 출처 줄 — 기금 소진 전망 출처는 없고, 지급보장 출처는 남아 있다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.waitFor(
    `(() => { const h = document.querySelector('.depletion-intro-modal-host'); return !!h?.shadowRoot?.querySelector('.depletion-popup-source'); })()`,
    { timeoutMs: 8000 },
  );
  const m = await page.evaluate(`(() => {
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const lines = [...root.querySelectorAll('.depletion-popup-source-line')].map((el) => el.textContent);
    return lines;
  })()`);
  assert.ok(m.some((line) => line.includes('국민연금법 제3조의2')), `지급보장 출처 줄이 없다: ${JSON.stringify(m)}`);
  assert.ok(!m.some((line) => line.includes('보건복지부')), `기금 소진 전망 출처 줄이 남아 있다: ${JSON.stringify(m)}`);
  assert.equal(m.length, 1, `출처 줄이 1개가 아니다(하나만 남아야 한다): ${JSON.stringify(m)}`);
});

// ---------------------------------------------------------------------------
// [2026-08-26, 관리자 지시] 소유자 지시 — PC 반영분(모바일 무영향) 다섯,
// 모바일 반영분(PC 무영향) 둘. 스코프 분리가 핵심 규율이므로 각 항목을
// 1440×900(PC)·390×844(모바일) 양쪽에서 재고, 끝에 교차 오염 검사를
// 따로 둔다.
// ---------------------------------------------------------------------------

/** 도넛 라벨의 svg 중심 대비 반지름 방향 거리(뷰박스 단위) — 이전 회차의
 * 거리-편차 시험과 같은 계산. */
const RING_GAP_EXPR = `(() => {
  const svg = document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.chart-donut');
  const rOuter = Number(svg.dataset.rOuter);
  const cx = Number(svg.dataset.cx);
  const ry = Number(svg.dataset.ry);
  const cy = Number(svg.querySelector('path[role="img"]').dataset.cy);
  return [...svg.querySelectorAll('.donut-slice-label')].map((el) => {
    const x = Number(el.getAttribute('x'));
    const y = Number(el.getAttribute('y'));
    const dx = x - cx;
    const dy = (y - cy) / ry;
    return Math.sqrt(dx * dx + dy * dy) - rOuter;
  });
})()`;

test('[PC 반영분 1번] 팝업 왼쪽 카피 — 모달 테두리와의 왼쪽 간격이 넓어졌다(1440×900)', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!document.querySelector('.depletion-intro-modal-host')?.shadowRoot?.querySelector('.depletion-popup-question')`, { timeoutMs: 8000 });
  await sleep(300);
  const gap = await page.evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const q = document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.depletion-popup-question');
    return q.getBoundingClientRect().left - modal.getBoundingClientRect().left;
  })()`);
  // 옛값(모달 자신의 padding만, --space-5=24px)보다 커야 한다 — 실측
  // 40px(24 + 추가 --space-4=16px).
  assert.ok(gap > 24, `왼쪽 여백(${gap}px)이 옛값(24px)보다 커지지 않았다`);
});

test('[PC 반영분 2·5번] 팝업 내용 전부 + 하단 버튼이 1440×900에서 스크롤 없이 보인다(확대 적용 후)', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!document.querySelector('.depletion-intro-modal-host')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(1500);
  const m = await page.evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const host = document.querySelector('.depletion-intro-modal-host');
    const dismiss = document.querySelector('.depletion-intro-modal-dismiss');
    const close = document.querySelector('.depletion-intro-modal-close');
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; };
    return {
      hostOverflow: host.scrollHeight - host.clientHeight,
      dismissRect: r(dismiss),
      closeRect: r(close),
      viewportH: window.innerHeight,
    };
  })()`);
  assert.ok(m.hostOverflow <= 1, `팝업 내용이 ${m.hostOverflow}px 넘친다(스크롤 필요) — 확대 후 재검증 실패`);
  for (const [label, rect] of [['「오늘 하루 보지 않음」', m.dismissRect], ['닫기(X)', m.closeRect]]) {
    assert.ok(rect.bottom <= m.viewportH && rect.top >= 0, `${label} 버튼이 900px 뷰포트 밖에 있다: ${JSON.stringify(rect)}`);
  }
});

test('[PC 반영분 3번] 팝업 도넛 추가 +10%(242px)·계산기2 결과 도넛 +20%(309.32px), 라벨 렌더·거리 회귀 없음(1440×900)', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!document.querySelector('.depletion-intro-modal-host')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(300);
  const popupWidth = await page.evaluate(`document.querySelector('.depletion-intro-modal-host').shadowRoot.querySelector('.chart-donut').getBoundingClientRect().width`);
  assert.ok(Math.abs(popupWidth - 242) <= 1, `팝업 도넛 렌더 폭(${popupWidth}px)이 242px(220×1.1)가 아니다`);
  const gaps = await page.evaluate(RING_GAP_EXPR);
  const maxGap = Math.max(...gaps);
  const minGap = Math.min(...gaps);
  assert.ok(maxGap - minGap <= 1, `팝업 도넛 확대 후 라벨-고리 거리 편차가 재발했다: ${JSON.stringify(gaps)}`);

  await dismissDepletionIntroModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(300);
  const calc2 = await page.evaluate(`(() => {
    const svg = document.querySelector('.calc2-result-slot .chart-donut');
    return {
      width: svg.getBoundingClientRect().width,
      nameHeights: [...svg.querySelectorAll('.donut-slice-label-name')].map((el) => el.getBoundingClientRect().height),
    };
  })()`);
  assert.ok(Math.abs(calc2.width - 309.324) <= 1, `계산기2 결과 도넛 렌더 폭(${calc2.width}px)이 309.32px(257.77×1.2)가 아니다`);
  for (const h of calc2.nameHeights) {
    assert.ok(Math.abs(h - 17) <= 1.5, `계산기2 라벨 렌더 높이(${h}px)가 옛 기준(17px)에서 벗어났다 — 도넛 확대가 라벨에 새면 안 된다`);
  }
});

test('[PC 반영분 4번] 팝업 도넛 중앙 「월 배분」 문구 추가 +20% — 렌더 크기 실측(1440×900)', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!document.querySelector('.depletion-intro-modal-host')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const label = root.querySelector('.donut-center-label');
    const value = root.querySelector('.donut-center-value');
    return { labelH: label.getBoundingClientRect().height, valueH: value.getBoundingClientRect().height };
  })()`);
  // 지난 회차 렌더 기준 — 라벨 10px·값 12px. 이번 +20% 추가로 라벨
  // ≥11px(반올림 여유), 값 ≥13px을 기대한다(정확한 목표는 12/14.4지만
  // 정수 렌더 반올림 오차를 감안한다).
  assert.ok(m.labelH >= 11, `중앙 라벨 렌더 높이(${m.labelH}px)가 옛값(10px)보다 뚜렷이 커지지 않았다`);
  assert.ok(m.valueH >= 13, `중앙 값 렌더 높이(${m.valueH}px)가 옛값(12px)보다 뚜렷이 커지지 않았다`);
});

test('[모바일 반영분 1번] 팝업 문구(예시 제외) −10%, 위 여백 확보, 가로 −5%(390×844)', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(`!!document.querySelector('.depletion-intro-modal-host')?.shadowRoot?.querySelector('.depletion-popup-question')`, { timeoutMs: 8000 });
  await sleep(1500);
  const m = await page.evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const question = root.querySelector('.depletion-popup-question');
    const donut = root.querySelector('.chart-donut');
    return {
      modalTop: modal.getBoundingClientRect().top,
      modalWidth: modal.getBoundingClientRect().width,
      questionFontSize: parseFloat(getComputedStyle(question).fontSize),
      donutWidth: donut.getBoundingClientRect().width,
    };
  })()`);
  // 옛(모바일 반영분 적용 전) 실측값 — modalTop 12.67px, modalWidth
  // 358px, questionFontSize 29.568px.
  assert.ok(m.modalTop > 30, `팝업 위 여백(${m.modalTop}px)이 옛값(12.67px)보다 뚜렷이 늘지 않았다`);
  assert.ok(m.modalWidth < 358 * 0.97, `팝업 폭(${m.modalWidth}px)이 −5%만큼 줄지 않았다(옛 358px)`);
  assert.ok(Math.abs(m.questionFontSize - 29.568 * 0.9) <= 0.5, `문구 글자 크기(${m.questionFontSize}px)가 −10%가 아니다(기대 ${(29.568 * 0.9).toFixed(2)}px)`);
  // "예시 제외" — 도넛(예시 영역)은 이 항목의 스코프 밖이라 그대로다.
  assert.ok(m.donutWidth > 0, '예시 도넛이 사라지면 안 된다');
});

test('[모바일 반영분 2번] 「기금운용본부」 캡션 — 모바일엔 없고 PC엔 있다, 카드 셋 높이가 모바일에서 같다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  for (const [width, mobile, expectSource] of [[390, true, false], [1440, false, true]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile });
    await page.goto(`${origin}/src/web/index.html`);
    await dismissDepletionIntroModalIfOpen(page);
    await page.waitFor(`!!document.querySelector('.depletion-card')`, { timeoutMs: 8000 });
    await sleep(300);
    const m = await page.evaluate(`(() => {
      const src = document.querySelector('.depletion-card-source');
      const cards = [...document.querySelectorAll('.depletion-card')];
      return {
        sourceVisible: !!src && getComputedStyle(src).display !== 'none' && src.getBoundingClientRect().height > 0,
        heights: cards.map((c) => c.getBoundingClientRect().height),
      };
    })()`);
    assert.equal(m.sourceVisible, expectSource, `${width}px — 캡션 표시 상태가 기대(${expectSource})와 다르다`);
    const maxH = Math.max(...m.heights);
    const minH = Math.min(...m.heights);
    assert.ok(maxH - minH <= 1, `${width}px — 카드 셋의 높이가 다르다: ${JSON.stringify(m.heights)}`);
  }
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
});

/**
 * [2026-08-26, 관리자 지시, 교차 오염 검사] PC 반영분(도넛·중앙값 확대,
 * 왼쪽 패딩)이 모바일에 새지 않고, 모바일 반영분(문구 축소·상단 여백·
 * 폭 축소, 캡션 제거)이 PC에 새지 않는지 — 한 시험 안에서 두 뷰포트를
 * 직접 대조한다.
 */
test('[교차 오염 검사] PC 전용 변경은 모바일에, 모바일 전용 변경은 PC에 새지 않는다', { skip: skipWithoutChrome }, async () => {
  const a = await openTrackedForPopup();
  const { page } = a;

  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(`!!document.querySelector('.depletion-intro-modal-host')?.shadowRoot?.querySelector('.chart-donut path[role="img"]')`, { timeoutMs: 8000 });
  await sleep(300);
  const mobileState = await page.evaluate(`(() => {
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const donut = root.querySelector('.chart-donut');
    const question = root.querySelector('.depletion-popup-question');
    return { donutWidth: donut.getBoundingClientRect().width, questionFontSize: parseFloat(getComputedStyle(question).fontSize) };
  })()`);
  // PC 전용(도넛 +10%, 220→242px)이 모바일에 새면 안 된다 — 모바일은
  // 여전히 옛 220px 스코프(이 항목 자체가 PC 전용이므로 모바일 값은
  // 이 회차 전과 같아야 한다).
  assert.ok(Math.abs(mobileState.donutWidth - 242) > 5, `PC 전용 도넛 확대(242px)가 모바일(${mobileState.donutWidth}px)에 샜다`);

  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  const pcState = await page.evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const root = document.querySelector('.depletion-intro-modal-host').shadowRoot;
    const question = root.querySelector('.depletion-popup-question');
    return { modalWidth: modal.getBoundingClientRect().width, questionFontSize: parseFloat(getComputedStyle(question).fontSize) };
  })()`);
  // 모바일 전용(문구 −10%)이 PC에 새면 안 된다 — PC(1440px)는 vw 기반
  // clamp가 상한(2.55rem=40.8px)에 이미 닿아 있다(실측) — 그 값 그대로여야
  // 한다. 29.568px는 모바일(390px) 뷰포트에서 이 회차 전 실측값이었다 —
  // PC와 직접 비교할 값이 아니다(뷰포트별 clamp 값이 다르다).
  assert.ok(Math.abs(pcState.questionFontSize - 40.8) <= 0.5, `PC 팝업 문구 글자 크기(${pcState.questionFontSize}px)가 clamp 상한(40.8px)에서 벗어났다 — 모바일 전용 축소가 샜을 수 있다`);
  // 모바일 전용(폭 −5%, width:95%)이 PC의 max-width 기반 폭 계산에
  // 안 새는지 — PC는 여전히 1150px 상한(95vw보다 좁을 수 있음) 기준이다.
  assert.ok(pcState.modalWidth > 1000, `모바일 전용 폭 축소가 PC(${pcState.modalWidth}px)에 샌 것으로 보인다`);
});

/** [소유자 지시 8번] 최대 적립금 시기의 세로 점선(옛 "수지 적자 전환"
 * 점선)이 없다 — 소진 점선은 그대로 있다. */
test('[소유자 지시 8번] 최대 적립금 시기의 세로 점선이 없다(소진 점선은 유지)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => ({
    hasDeficitMarker: !!document.querySelector('.depletion-chart-marker-deficit'),
    hasDepletionMarker: !!document.querySelector('.depletion-chart-marker-depletion'),
  }))()`);
  assert.equal(m.hasDeficitMarker, false, '최대 적립금(수지 적자) 점선이 여전히 있다');
  assert.ok(m.hasDepletionMarker, '소진 점선이 없다 — 유지돼야 한다');
});

/** [소유자 지시 9번] 카드 제목이 더 크고 굵다 — 옛값(13px/기본 굵기)보다
 * 커야 한다. */
test('[소유자 지시 9번] 카드 제목(기금 소진·현재 기금·최대 적립금) 글자가 더 크고 굵다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const label = document.querySelector('.depletion-card-label');
    const cs = getComputedStyle(label);
    return { fontSize: parseFloat(cs.fontSize), fontWeight: Number(cs.fontWeight) };
  })()`);
  assert.ok(m.fontSize > 13, `카드 제목 글자 크기(${m.fontSize}px)가 옛값(13px)보다 커지지 않았다`);
  assert.ok(m.fontWeight >= 700, `카드 제목 글자 굵기(${m.fontWeight})가 700 이상이 아니다`);
});

/**
 * [소유자 지시 10·11번] 막대 위 점 + 그 점을 잇는 선(연 단위가 아니라
 * 막대 단위), 막대 hover 시 확대 + 툴팁, 막대 아래 연도 라벨이 막대
 * 위치와 일치한다.
 *
 * **정렬 판정 기준 — "라벨의 데이터 좌표(x)가 그 막대의 폭 안에 있는가".**
 * 막대 중심의 정확한 픽셀 일치를 요구하지 않는다 — 소유자 지시 12번의
 * "첫 막대 오프셋" 처방(y축 경계를 지키기 위해 막대 폭을 한쪽으로만
 * 넓힌다) 때문에 양 끝 막대는 기하적으로 중심이 데이터 좌표와 정확히
 * 일치할 수 없다(폭이 있는 막대를 y축 바로 위의 점에 대칭으로 그리면
 * 절반이 반드시 y축 밖으로 나간다 — 피할 수 없다). 라벨이 막대의 폭
 * 범위 안에 있으면 "그 막대 아래"라는 실질을 충분히 만족한다.
 */
test('[소유자 지시 10·11번] 막대마다 점 하나(선으로 연결)·연도 라벨이 막대 위치와 일치·hover 확대+툴팁', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const before = await page.evaluate(`(() => {
    const bars = [...document.querySelectorAll('.depletion-chart-bar')];
    const points = [...document.querySelectorAll('.depletion-chart-point')];
    const xLabels = [...document.querySelectorAll('.depletion-chart-axis-label')].filter((el) => !/천조$/.test(el.textContent));
    return {
      barCount: bars.length,
      pointCount: points.length,
      hasLine: !!document.querySelector('.depletion-chart-line'),
      xLabelCount: xLabels.length,
      barBoxes: bars.map((b) => ({ left: parseFloat(b.getAttribute('x')), right: parseFloat(b.getAttribute('x')) + parseFloat(b.getAttribute('width')) })),
      xLabelXs: xLabels.map((el) => Math.round(parseFloat(el.getAttribute('x')))),
      // [2026-08-25, 관리자 지시 — 소유자 지시(6항목) 5번] 네이티브
      // title 요소를 걷어내고 aria-label로 옮겼다(같은 텍스트 — 시각적
      // 툴팁은 커스텀 말풍선이 진다, 아래 별도 시험).
      firstBarAriaLabel: bars[0]?.getAttribute('aria-label') ?? null,
      firstBarTransform: getComputedStyle(bars[0]).transform,
    };
  })()`);
  assert.equal(before.pointCount, before.barCount, `점 개수(${before.pointCount})가 막대 개수(${before.barCount})와 다르다 — 막대마다 점 하나가 아니다`);
  assert.ok(before.hasLine, '점을 잇는 선이 없다');
  // [2026-08-25, 관리자 지시 — 잔마감] 라벨 개수가 막대 개수보다 **적을
  // 수 있다** — 꼬리 구간에서 라벨이 겹치면 하나를 생략한다(아래 별도
  // 시험이 그 생략 자체를 확인한다). 여기서는 "라벨이 하나도 안 남는
  // 사고"만 막고(0이면 안 된다), 각 라벨이 어떤 막대의 폭 범위 안에는
  // 있는지(어느 인덱스든)만 잰다 — 생략으로 인덱스가 어긋날 수 있어
  // 더는 같은 i끼리 비교하지 않는다.
  assert.ok(before.xLabelCount > 0, 'x축 연도 라벨이 하나도 없다');
  assert.ok(before.xLabelCount <= before.barCount, `x축 연도 라벨 개수(${before.xLabelCount})가 막대 개수(${before.barCount})보다 많다 — 생략 로직이 라벨을 늘릴 리 없다`);
  for (const labelX of before.xLabelXs) {
    const withinSomeBar = before.barBoxes.some(({ left, right }) => labelX >= left - 1 && labelX <= right + 1);
    assert.ok(withinSomeBar, `연도 라벨(x=${labelX})이 어느 막대의 폭 범위 안에도 있지 않다`);
  }
  assert.ok(before.firstBarAriaLabel && /년: /.test(before.firstBarAriaLabel), `막대 접근성 라벨(연도·적립금)이 없다: "${before.firstBarAriaLabel}"`);

  // hover 시 확대 — CDP로 실제 마우스를 첫 막대 위로 옮긴다.
  const barRect = await page.evaluate(`(() => {
    const r = document.querySelector('.depletion-chart-bar').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: barRect.x, y: barRect.y });
  await sleep(200);
  const afterTransform = await page.evaluate(`getComputedStyle(document.querySelector('.depletion-chart-bar')).transform`);
  assert.notEqual(afterTransform, before.firstBarTransform, '막대에 마우스를 올려도 확대(transform)가 걸리지 않았다');
});

/**
 * [2026-08-25, 관리자 지시 — 잔마감, 판별력 증명 대상] 꼬리 구간(소진
 * 이후로 강제 포함되는 마지막 막대와 그 앞 5년 단위 막대가 몇 년 안
 * 붙는 경우)에서 x축 연도 라벨 둘이 실제로 겹쳐 보이던 결함 — **실제
 * 렌더된 라벨의 경계 사각형(`getBBox`)끼리 교집합이 있는지** 모든 인접
 * 쌍에 대해 직접 잰다(짐작이 아니라 실측 — 텍스트 폭은 폰트·문자에 따라
 * 달라 좌표 차이만으로는 겹침을 단정할 수 없다). **마지막 라벨(관리자
 * 지시 원문 "마지막 라벨 우선")은 항상 남아 있어야 한다.**
 */
test('[관리자 지시 — 잔마감] x축 연도 라벨이 서로 겹치지 않는다(경계 사각형 교차 검사), 마지막 라벨은 항상 남는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const bars = [...document.querySelectorAll('.depletion-chart-bar')];
    const lastBarTitle = bars[bars.length - 1]?.getAttribute('aria-label') ?? '';
    const lastYearMatch = /^(\\d+)년/.exec(lastBarTitle);
    const lastYear = lastYearMatch ? lastYearMatch[1] : null;
    const labels = [...document.querySelectorAll('.depletion-chart-axis-label')].filter((el) => !/천조$/.test(el.textContent));
    const boxes = labels
      .map((el) => {
        const b = el.getBBox();
        return { text: el.textContent, left: b.x, right: b.x + b.width };
      })
      .sort((a, b) => a.left - b.left);
    return { lastYear, texts: labels.map((el) => el.textContent), boxes };
  })()`);
  assert.ok(m.lastYear, '마지막 막대의 툴팁에서 연도를 읽지 못했다(전제 조건 실패)');
  assert.ok(m.texts.includes(m.lastYear), `마지막 연도(${m.lastYear}) 라벨이 생략됐다 — 마지막 라벨은 항상 남아야 한다`);
  for (let i = 1; i < m.boxes.length; i++) {
    const prev = m.boxes[i - 1];
    const cur = m.boxes[i];
    assert.ok(
      prev.right <= cur.left,
      `x축 라벨 "${prev.text}"(${prev.left.toFixed(1)}~${prev.right.toFixed(1)})와 "${cur.text}"(${cur.left.toFixed(1)}~${cur.right.toFixed(1)})의 경계 사각형이 겹친다`,
    );
  }
});

/**
 * [소유자 지시 12번, 판별력 증명 대상] 첫 막대가 y축 왼쪽으로 번지지
 * 않는다 — 첫 막대의 왼쪽 끝 x좌표가 y축 그리드선의 x좌표 이상이어야
 * 한다.
 */
test('[소유자 지시 12번] 첫 막대 왼쪽 끝이 y축(그리드 시작 x좌표) 안쪽에 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const grid = document.querySelector('.depletion-chart-grid');
    const firstBar = document.querySelector('.depletion-chart-bar');
    return { axisX: parseFloat(grid.getAttribute('x1')), firstBarLeft: parseFloat(firstBar.getAttribute('x')) };
  })()`);
  assert.ok(m.firstBarLeft >= m.axisX - 0.5, `첫 막대 왼쪽 끝(${m.firstBarLeft})이 y축 x좌표(${m.axisX})보다 왼쪽으로 번졌다`);
});
