import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildDepletionSummarySvgMarkup, DEPLETION_SUMMARY_COLORS } from './summary-image.js';
import { runDepletionSimulation } from './simulate.js';
import { DEPLETION_SLIDER_PARAMS, INITIAL_FUND_TRILLION_KRW, ACTUAL_FUND_BALANCE } from './constants.js';
import { DEPLETION_CHART_START_LABEL_PREFIX, DEPLETION_CHART_START_LABEL_SUFFIX } from '../depletion-copy.js';

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
