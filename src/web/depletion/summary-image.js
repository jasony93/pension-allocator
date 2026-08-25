/**
 * 「연금고갈 시뮬레이션」 탭의 이미지 저장(소유자 지시 5번) — 계산기2 요약
 * 이미지(`ui/summary-image.js`, D74·D75)와 **같은 관행**: 단일 SVG
 * 문자열 조립 → `<canvas>` → PNG, **의존성 0**, **라이트 고정**(뷰어의
 * 현재 테마와 무관하게 항상 같은 모양). 래스터라이즈·다운로드 함수 자체는
 * 그 파일의 것을 그대로 재사용한다(`rasterizeSvgToPngDataUrl`·
 * `downloadDataUrl` — 이 탭 데이터에 의존하지 않는 범용 함수라 새로 짤
 * 이유가 없다).
 *
 * **이 파일이 새로 잇는 것은 "무엇을 SVG로 그리는가"뿐이다** — 카드 값
 * (기금 소진·현재 기금·최대 적립금) + 궤적 차트(선+영역, 화면 SVG와 같은
 * 기하) + 핵심 가정 값(코어 슬라이더는 항상, 고급 슬라이더는 기본값과
 * 다를 때만 — "입력 안 한 가정은 줄 없음" 원칙, D75 선 ①과 같은 정신을
 * 이 탭의 "손대지 않은 슬라이더"에 적용한다) + 출처 줄(대조 앵커·실적
 * 고지 각각 제 출처를 단다, D84 출처 분리).
 *
 * **`foreignObject`는 쓰지 않는다**(계산기2와 같은 이유 — 캔버스 오염
 * 방지). 리터럴 hex만 쓴다(`DEPLETION_SUMMARY_COLORS`) — `Image.src`에
 * 넣는 `data:image/svg+xml,...`는 이 문서의 `:root`와 연결되지 않은 별도
 * 문서로 취급되어 `var(--accent-warm)` 같은 CSS 커스텀 프로퍼티가 풀리지
 * 않는다(`ui/summary-image.js` 머리말과 같은 근거).
 */

import { rasterizeSvgToPngDataUrl, svgMarkupToDataUri, downloadDataUrl } from '../ui/summary-image.js';
import {
  DEPLETION_SLIDER_PARAMS,
  ACTUAL_FUND_BALANCE,
  OFFICIAL_2030_CHECK,
} from './constants.js';
import {
  DEPLETION_SUMMARY_TITLE,
  DEPLETION_CARD_DEPLETION_LABEL,
  DEPLETION_CARD_CURRENT_FUND_LABEL,
  DEPLETION_CARD_MAX_FUND_LABEL,
  DEPLETION_SUMMARY_ASSUMPTIONS_HEADING,
  DEPLETION_SUMMARY_SOURCE_HEADING,
  DEPLETION_CHART_START_LABEL_PREFIX,
  DEPLETION_CHART_START_LABEL_SUFFIX,
} from '../depletion-copy.js';

/** `styles.css` `:root`(라이트)에서 그대로 옮긴 리터럴 값 — 계산기2의
 * `SUMMARY_EXPORT_COLORS`와 같은 이유(이 파일 머리말). */
export const DEPLETION_SUMMARY_COLORS = {
  surface: '#ffffff',
  border: '#e1e5ea',
  textPrimary: '#14181c',
  textSecondary: '#4a535c',
  textMuted: '#7c858e',
  accentWarm: '#e67300',
  accentWarmSubtle: '#fceee0',
};

function depletionXmlEscape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function depletionSvgText(x, y, text, { size = 16, weight = 400, color = DEPLETION_SUMMARY_COLORS.textPrimary, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${depletionXmlEscape(
    text,
  )}</text>`;
}

function depletionFormatTrillionSummary(value) {
  return `${Math.round(value).toLocaleString('ko-KR')}조원`;
}

const DEPLETION_SUMMARY_CANVAS_WIDTH = 960;
const DEPLETION_SUMMARY_PADDING = 56;

function cardsMarkup(result, top) {
  const cards = [
    [DEPLETION_CARD_DEPLETION_LABEL, result.depletionYear ? `${result.depletionYear}년` : '소진 없음'],
    [DEPLETION_CARD_CURRENT_FUND_LABEL, `${depletionFormatTrillionSummary(ACTUAL_FUND_BALANCE.trillionKrw)}`],
    [DEPLETION_CARD_MAX_FUND_LABEL, depletionFormatTrillionSummary(result.maxFundTrillionKrw)],
  ];
  const cardWidth = (DEPLETION_SUMMARY_CANVAS_WIDTH - DEPLETION_SUMMARY_PADDING * 2 - 32) / 3;
  const rows = [];
  cards.forEach(([label, value], i) => {
    const x = DEPLETION_SUMMARY_PADDING + i * (cardWidth + 16);
    rows.push(`<rect x="${x}" y="${top}" width="${cardWidth}" height="96" rx="12" fill="${DEPLETION_SUMMARY_COLORS.surface}" stroke="${DEPLETION_SUMMARY_COLORS.border}" stroke-width="1" />`);
    rows.push(depletionSvgText(x + 20, top + 34, label, { size: 13, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
    rows.push(depletionSvgText(x + 20, top + 68, value, { size: 22, weight: 700 }));
  });
  return { markup: rows.join(''), bottom: top + 96 };
}

/** 궤적 차트 — 화면 SVG(`ui/depletion-panel.js`)와 같은 기하(선형 y=0
 * 바닥, 색은 `--accent-warm` 계열). 시작점(2026)에 전망 재현 출발값
 * 라벨을 단다(소유자 지시 2번) — 실적과 섞지 않는다(D84 출처 분리). */
function chartMarkup(result, top, height) {
  const { years, fundsTrillionKrw } = result;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const rawMax = Math.max(...fundsTrillionKrw) * 1.05;
  const rawStepInUnits = Math.max(rawMax / 1000 / 5, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStepInUnits));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= rawStepInUnits) ?? 10;
  const maxScale = step * magnitude * 1000 * 5;

  const innerLeft = DEPLETION_SUMMARY_PADDING + 56;
  const innerRight = DEPLETION_SUMMARY_CANVAS_WIDTH - DEPLETION_SUMMARY_PADDING;
  const innerTop = top;
  const innerBottom = top + height;
  const xOf = (year) => innerLeft + (lastYear === firstYear ? 0 : ((year - firstYear) / (lastYear - firstYear)) * (innerRight - innerLeft));
  const yOf = (value) => innerTop + (1 - value / maxScale) * (innerBottom - innerTop);

  const points = years.map((year, i) => [xOf(year), yOf(fundsTrillionKrw[i])]);
  const lineD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const baselineY = yOf(0);
  const areaD = `${lineD} L${points[points.length - 1][0].toFixed(1)},${baselineY.toFixed(1)} L${points[0][0].toFixed(1)},${baselineY.toFixed(1)} Z`;

  const rows = [];
  rows.push(`<line x1="${innerLeft}" y1="${innerBottom}" x2="${innerRight}" y2="${innerBottom}" stroke="${DEPLETION_SUMMARY_COLORS.border}" stroke-width="1" />`);
  rows.push(`<path d="${areaD}" fill="${DEPLETION_SUMMARY_COLORS.accentWarm}" opacity="0.12" />`);
  rows.push(`<path d="${lineD}" fill="none" stroke="${DEPLETION_SUMMARY_COLORS.accentWarm}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`);

  // [2026-08-25, 소유자 지시(12항목) 7번, D85] 시작점 라벨 — 실적
  // (ACTUAL_FUND_BALANCE)에서 온다. 화면(`ui/depletion-panel.js`)이 이제
  // 실적 출발로 계산하므로, 이 요약 이미지도 「현재 기금」 카드(위,
  // ACTUAL_FUND_BALANCE.trillionKrw)와 같은 숫자를 시작점 라벨에 쓴다 —
  // 둘이 어긋나면 이 한 장의 이미지 안에서 카드와 그래프가 서로 다른
  // 숫자를 말하게 된다.
  const [startX, startY] = points[0];
  rows.push(`<circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="4" fill="${DEPLETION_SUMMARY_COLORS.accentWarm}" />`);
  rows.push(
    depletionSvgText(startX + 10, startY - 10, `${DEPLETION_CHART_START_LABEL_PREFIX} ${depletionFormatTrillionSummary(ACTUAL_FUND_BALANCE.trillionKrw)}${DEPLETION_CHART_START_LABEL_SUFFIX}`, {
      size: 13,
      weight: 700,
      color: DEPLETION_SUMMARY_COLORS.textPrimary,
    }),
  );
  rows.push(depletionSvgText(innerLeft, innerTop - 8, `${firstYear}~${lastYear}년 적립금 궤적`, { size: 13, color: DEPLETION_SUMMARY_COLORS.textSecondary }));

  return { markup: rows.join(''), bottom: innerBottom + 24 };
}

/** 핵심 가정 값 — 코어 슬라이더는 항상, 고급 슬라이더는 기본값과 다를
 * 때만(D75 선 ①과 같은 정신 — 손대지 않은 가정은 줄이 없다). */
function assumptionsMarkup(values, top) {
  const rows = [];
  let y = top;
  rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, DEPLETION_SUMMARY_ASSUMPTIONS_HEADING, { size: 15, weight: 700, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
  y += 28;
  const shown = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'core' || values[p.id] !== p.default);
  for (const p of shown) {
    rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, p.label, { size: 13, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
    rows.push(depletionSvgText(DEPLETION_SUMMARY_CANVAS_WIDTH - DEPLETION_SUMMARY_PADDING, y, `${values[p.id].toFixed(p.decimals)}${p.unit}`, { size: 13, weight: 700, anchor: 'end' }));
    y += 22;
  }
  return { markup: rows.join(''), bottom: y + 8 };
}

/** 출처 줄 — [D84 출처 분리] 기본가정 출처(제5차)와 2030 대조 앵커 출처
 * (중기재정전망)를 한 문장으로 뭉치지 않는다. */
function sourceMarkup(top) {
  const rows = [];
  let y = top;
  rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, DEPLETION_SUMMARY_SOURCE_HEADING, { size: 13, weight: 700, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
  y += 20;
  rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, `전망 재현 출발값·기본가정 — 제5차 국민연금 재정추계(2023), 국민연금연구원 중기재정전망(2026~2030)`, { size: 11.5, color: DEPLETION_SUMMARY_COLORS.textMuted }));
  y += 18;
  rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, `2030 대조 — ${OFFICIAL_2030_CHECK.source}`, { size: 11.5, color: DEPLETION_SUMMARY_COLORS.textMuted }));
  y += 18;
  rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, `현재 기금(실적) — ${ACTUAL_FUND_BALANCE.asOf}, ${ACTUAL_FUND_BALANCE.source}`, { size: 11.5, color: DEPLETION_SUMMARY_COLORS.textMuted }));
  y += 12;
  return { markup: rows.join(''), bottom: y };
}

/**
 * `result`(`depletion/simulate.js`의 `runDepletionSimulation` 반환값),
 * `values`(현재 슬라이더 값) → 완결된 SVG 문서 문자열.
 */
export function buildDepletionSummarySvgMarkup(result, values) {
  const titleTop = DEPLETION_SUMMARY_PADDING;
  const cardsTop = titleTop + 24;
  const { markup: cardsSvg, bottom: cardsBottom } = cardsMarkup(result, cardsTop);
  const chartTop = cardsBottom + 40;
  const { markup: chartSvg, bottom: chartBottom } = chartMarkup(result, chartTop, 260);
  const { markup: assumptionsSvg, bottom: assumptionsBottom } = assumptionsMarkup(values, chartBottom + 16);
  const { markup: sourceSvg, bottom: sourceBottom } = sourceMarkup(assumptionsBottom + 16);

  const height = Math.ceil(sourceBottom + DEPLETION_SUMMARY_PADDING);
  const body = [
    `<rect x="0" y="0" width="${DEPLETION_SUMMARY_CANVAS_WIDTH}" height="${height}" fill="${DEPLETION_SUMMARY_COLORS.surface}" />`,
    depletionSvgText(DEPLETION_SUMMARY_PADDING, titleTop, DEPLETION_SUMMARY_TITLE, { size: 22, weight: 700 }),
    cardsSvg,
    chartSvg,
    `<line x1="${DEPLETION_SUMMARY_PADDING}" y1="${chartBottom}" x2="${DEPLETION_SUMMARY_CANVAS_WIDTH - DEPLETION_SUMMARY_PADDING}" y2="${chartBottom}" stroke="${DEPLETION_SUMMARY_COLORS.border}" stroke-width="1" />`,
    assumptionsSvg,
    sourceSvg,
  ].join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DEPLETION_SUMMARY_CANVAS_WIDTH}" height="${height}" viewBox="0 0 ${DEPLETION_SUMMARY_CANVAS_WIDTH} ${height}">${body}</svg>`;
}

/** `result`/`values` → PNG data URL. 계산기2와 같은 래스터라이저를 그대로 쓴다. */
export async function exportDepletionSummaryPng(result, values) {
  const svgMarkup = buildDepletionSummarySvgMarkup(result, values);
  const widthMatch = /width="(\d+)"/.exec(svgMarkup);
  const heightMatch = /height="(\d+)"/.exec(svgMarkup);
  return rasterizeSvgToPngDataUrl(svgMarkup, { width: Number(widthMatch[1]), height: Number(heightMatch[1]) });
}

export { svgMarkupToDataUri, downloadDataUrl };
