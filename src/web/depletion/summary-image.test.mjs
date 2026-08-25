import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildDepletionSummarySvgMarkup, DEPLETION_SUMMARY_COLORS } from './summary-image.js';
import { runDepletionSimulation } from './simulate.js';
import { DEPLETION_SLIDER_PARAMS, INITIAL_FUND_TRILLION_KRW, ACTUAL_FUND_BALANCE } from './constants.js';
import { DEPLETION_CHART_START_LABEL_PREFIX, DEPLETION_CHART_START_LABEL_SUFFIX } from '../depletion-copy.js';
import { computeDepletionChartLayout } from './chart-layout.js';

const DEFAULTS = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const CSS = readFileSync(path.join(webRoot, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** `:root`에서 토큰 값을 hex로 읽는다 — hex 리터럴(`#rrggbb`)과
 * `rgb(r, g, b)` 둘 다 받는다(`--accent-warm`은 rgb() 표기다). */
function rootTokenHex(name) {
  const rootBlock = /(?:^|\n)\s*:root\s*\{([\s\S]*?)\n\}/.exec(CSS);
  if (!rootBlock) return null;
  const hexMatch = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(rootBlock[1]);
  if (hexMatch) return hexMatch[1].toLowerCase();
  const rgbMatch = new RegExp(`${name}\\s*:\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`).exec(rootBlock[1]);
  if (!rgbMatch) return null;
  const toHex = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
}

test('요약 이미지 색 상수가 styles.css의 라이트(:root) 토큰과 어긋나지 않는다', () => {
  const pairs = [
    ['surface', '--surface-raised'],
    ['border', '--border-subtle'],
    ['textPrimary', '--text-primary'],
    ['textSecondary', '--text-secondary'],
    ['textMuted', '--text-muted'],
    ['accentWarm', '--accent-warm'],
    ['accentWarmSubtle', '--accent-warm-subtle'],
  ];
  for (const [key, token] of pairs) {
    const cssValue = rootTokenHex(token);
    assert.ok(cssValue, `styles.css :root에서 ${token}을 읽지 못했습니다`);
    assert.equal(
      DEPLETION_SUMMARY_COLORS[key].toLowerCase(),
      cssValue,
      `DEPLETION_SUMMARY_COLORS.${key}(${DEPLETION_SUMMARY_COLORS[key]})가 styles.css의 ${token}(${cssValue})와 다릅니다 — 값이 바뀌면 이 상수도 함께 고쳐야 한다`,
    );
  }
});

test('완결된 SVG 문서 — width·height 속성을 가진 <svg>로 시작한다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  assert.ok(svg.startsWith('<svg'), 'SVG 문서로 시작하지 않는다');
  assert.match(svg, /width="\d+"/);
  assert.match(svg, /height="\d+"/);
  assert.ok(svg.endsWith('</svg>'));
});

test('카드 값 셋(기금 소진·현재 기금·최대 적립금)이 실제로 담긴다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  assert.ok(svg.includes('기금 소진'));
  assert.ok(svg.includes('현재 기금'));
  assert.ok(svg.includes('최대 적립금'));
  // 현재 기금 카드 값은 실적(ACTUAL_FUND_BALANCE)이지 모델 계산치가 아니다.
  assert.ok(svg.includes(`${Math.round(ACTUAL_FUND_BALANCE.trillionKrw).toLocaleString('ko-KR')}조원`), '현재 기금 카드에 실적값이 없다');
});

/**
 * [2026-08-25, 소유자 지시(12항목) 7번, D85] 시작점 라벨은 이제 실적
 * (ACTUAL_FUND_BALANCE=1,671조)에서 온다 — 「현재 기금」 카드와 같은
 * 숫자다(D85 "카드·그래프 시작점·라벨이 한 숫자"). 전망 재현 출발값
 * (1,458조)은 더는 이 라벨에 나오지 않는다(그 값의 정확성 증명은
 * `simulate.test.mjs`로 내려갔다).
 */
test('시작점 라벨 — 실적(1,671조원)에서 오고, 「현재 기금」 카드와 같은 숫자다(D85)', () => {
  const result = runDepletionSimulation({ ...DEFAULTS, initialFundTrillionKrw: ACTUAL_FUND_BALANCE.trillionKrw });
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  const actualText = `${DEPLETION_CHART_START_LABEL_PREFIX} ${Math.round(ACTUAL_FUND_BALANCE.trillionKrw).toLocaleString('ko-KR')}조원${DEPLETION_CHART_START_LABEL_SUFFIX}`;
  assert.ok(svg.includes(actualText), `시작점 라벨을 찾지 못했다: ${actualText}`);
  // 전망 재현 출발값(1,458조)이 시작점 라벨 접두사와 나란히 나오면 안
  // 된다(D85로 뒤집힌 방향 — 옛 값이 되살아나면 여기서 잡힌다).
  const forecastMixedText = `${DEPLETION_CHART_START_LABEL_PREFIX} ${Math.round(INITIAL_FUND_TRILLION_KRW).toLocaleString('ko-KR')}조원`;
  assert.ok(!svg.includes(forecastMixedText), '시작점 라벨에 전망 재현 출발값(1,458조)이 섞였다 — D85 위반');
});

test('핵심 가정 — 코어 슬라이더는 기본값이어도 항상 나온다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  const coreLabels = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'core').map((p) => p.label);
  for (const label of coreLabels) {
    assert.ok(svg.includes(label), `코어 슬라이더 "${label}"이 요약에 없다`);
  }
});

test('핵심 가정 — 손대지 않은(기본값 그대로인) 고급 슬라이더는 줄이 없다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  const advancedLabels = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'advanced').map((p) => p.label);
  for (const label of advancedLabels) {
    assert.ok(!svg.includes(label), `손대지 않은 고급 슬라이더 "${label}"이 요약에 나온다 — "입력 안 한 가정은 줄 없음" 위반`);
  }
});

test('핵심 가정 — 고급 슬라이더를 기본값에서 바꾸면 그 줄만 나온다', () => {
  const wageParam = DEPLETION_SLIDER_PARAMS.find((p) => p.id === 'wage');
  const values = { ...DEFAULTS, wage: wageParam.default + 1 };
  const result = runDepletionSimulation(values);
  const svg = buildDepletionSummarySvgMarkup(result, values);
  assert.ok(svg.includes(wageParam.label), '값을 바꾼 고급 슬라이더가 요약에 없다');
  const untouchedLabels = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'advanced' && p.id !== 'wage').map((p) => p.label);
  for (const label of untouchedLabels) {
    assert.ok(!svg.includes(label), `여전히 손대지 않은 "${label}"이 나온다`);
  }
});

test('출처 줄 — 기본가정 출처와 2030 대조 출처가 각각 다른 문장으로 나온다(한 문장으로 뭉치지 않는다)', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  assert.ok(svg.includes('제5차 국민연금 재정추계'), '기본가정 출처가 없다');
  assert.ok(svg.includes('국민연금연구원 중기재정전망(2026~2030)'), '2030 대조 출처가 없다');
  assert.ok(svg.includes('기금운용본부'), '실적(현재 기금) 출처가 없다');
});

test('foreignObject를 쓰지 않는다 — 캔버스 오염 회피 원칙', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  assert.ok(!svg.includes('foreignObject'));
});

/**
 * [2026-08-25, 관리자 지시(9항목) 6번, 판별력 증명 필수] **이미지 저장
 * 결과가 실제 그래프와 다르다는 소유자 지적의 핵심 — 구성 요소 존재
 * 검사.** PNG 픽셀 비교까지는 불요(관리자 지시 원문) — 대신 화면과 같은
 * 계산(`computeDepletionChartLayout`, `chart-layout.js`)이 낸 막대 개수·
 * 점 개수·소진 마커·시작 라벨이 SVG 문자열 안에 실제로 있는지 센다.
 * 옛 버전(이 회차 이전)은 `<rect ... opacity="0.35">`(막대)·
 * `stroke-dasharray`(소진 마커 점선)가 전혀 없었다 — 아래 판별력 증명이
 * 그 회귀를 재현해 이 시험이 실제로 잡는지 확인한다.
 */
test('[관리자 지시(9항목) 6번] 요약 이미지가 화면과 같은 구성 요소(막대·점·소진 마커·시작 라벨)를 전부 담는다', () => {
  const values = { ...DEFAULTS, age: 70 }; // 소진 마커가 확실히 뜨는 시나리오.
  const result = runDepletionSimulation(values);
  const svg = buildDepletionSummarySvgMarkup(result, values);
  const layout = computeDepletionChartLayout(result);

  // 막대 — 화면과 같은 개수(`barRects`, 5년 단위 히스토그램).
  const barMatches = svg.match(/fill="#e67300" opacity="0\.35"/g) ?? [];
  assert.equal(barMatches.length, layout.barRects.length, `막대 개수가 화면 계산(${layout.barRects.length})과 다르다: ${barMatches.length}`);
  assert.ok(barMatches.length > 5, '막대가 5개 이하다 — 옛(막대 없는) 선그래프로 되돌아갔을 수 있다');

  // 점 — 막대 꼭짓점마다 하나(`vertexPoints`).
  const pointMatches = svg.match(/<circle cx="[\d.]+" cy="[\d.]+" r="5"/g) ?? [];
  assert.equal(pointMatches.length, layout.vertexPoints.length, `점 개수가 화면 계산(${layout.vertexPoints.length})과 다르다: ${pointMatches.length}`);

  // 선 — 막대 꼭짓점을 잇는 path 하나(2px, 옛 요약의 2.5px가 아니다 —
  // 화면 `.depletion-chart-line`과 같은 두께).
  assert.ok(svg.includes('stroke-width="2" stroke-linejoin="round" stroke-linecap="round"'), '막대 꼭짓점을 잇는 선을 찾지 못했다(화면과 같은 두께 2px)');

  // 소진 마커 — 세로 점선(빨강 계열, 4 3 대시).
  assert.ok(layout.marker, '이 시나리오는 소진 마커가 있어야 하는데 계산 결과에 없다 — 픽스처를 다시 본다');
  assert.ok(svg.includes(`stroke="${DEPLETION_SUMMARY_COLORS.stateError}" stroke-width="1.5" stroke-dasharray="4 3"`), '소진 마커(세로 점선)를 찾지 못했다');
  assert.ok(svg.includes(`소진 ${layout.marker.depletionYear}년`), '소진 마커 라벨(연도)을 찾지 못했다');

  // 시작 라벨 — 실적 출발점 표시(이미 위 시험이 문구를 확인한다, 여기서는
  // "존재" 자체와 y축 그리드·x축 연도 라벨까지 한 번에 센다).
  assert.ok(svg.includes(DEPLETION_CHART_START_LABEL_PREFIX), '시작 라벨을 찾지 못했다');
  const gridMatches = svg.match(/stroke="#e1e5ea" stroke-width="1" \/>/g) ?? [];
  assert.ok(gridMatches.length >= layout.yTicks.length, `y축 그리드 선이 부족하다(기대 ≥${layout.yTicks.length}): ${gridMatches.length}`);
  for (const { year } of layout.xTicks) {
    assert.ok(svg.includes(`>${year}</text>`), `x축 연도 라벨 "${year}"을 찾지 못했다`);
  }
});

/**
 * [2026-08-25, 관리자 지시(9항목) 7번] 핵심 가정 표 — 문구는 왼쪽,
 * 숫자는 오른쪽 정렬을 유지하되 **두 열이 가깝다.** 옛 코드는 값 열을
 * 캔버스 오른쪽 끝(904px)에 고정해, 짧은 문구·짧은 숫자 사이에도 캔버스
 * 폭 대부분이 비어 보였다(실측 — 기본 시나리오에서 라벨 끝(약 195px)과
 * 값(904px) 사이 700px 가까이 비었다). 이제는 표 폭 자체를 내용에 맞춰
 * 좁힌다 — 그 간격이 눈에 띄게 좁아졌는지(캔버스 전체 폭의 훨씬 안쪽)를
 * 직접 잰다.
 */
test('[관리자 지시(9항목) 7번] 핵심 가정 표 — 값 열이 캔버스 오른쪽 끝에 붙지 않고 문구 가까이에 있다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const svg = buildDepletionSummarySvgMarkup(result, DEFAULTS);
  // 코어 슬라이더 첫 줄("기금운용수익률")의 라벨 x(56, 왼쪽 정렬 시작)와
  // 그 값("4.5%")의 x(오른쪽 정렬 끝)를 문자열에서 그대로 읽는다.
  const labelMatch = /<text x="56" y="(\d+)"[^>]*>기금운용수익률<\/text>/.exec(svg);
  assert.ok(labelMatch, '기금운용수익률 라벨을 찾지 못했다');
  const rowY = labelMatch[1];
  const valueMatch = new RegExp(`<text x="([\\d.]+)" y="${rowY}"[^>]*text-anchor="end">4\\.5%</text>`).exec(svg);
  assert.ok(valueMatch, '기금운용수익률 값(4.5%)을 같은 줄에서 찾지 못했다');
  const valueX = Number(valueMatch[1]);
  // 캔버스 폭(960)의 오른쪽 끝 부근(예전 904)이 아니라, 라벨 폭에 맞는
  // 좁은 범위 안에 있어야 한다 — 넉넉히 잡아도 캔버스 왼쪽 절반 안.
  assert.ok(valueX < 480, `값 열 x좌표(${valueX})가 여전히 캔버스 오른쪽에 치우쳐 있다(옛 904 근처면 이 회귀가 되살아난 것)`);
  assert.ok(valueX > 56 + 40, `값 열이 라벨과 겹칠 만큼 붙었다(x=${valueX})`);
});
