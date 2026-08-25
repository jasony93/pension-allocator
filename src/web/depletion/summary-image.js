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

import { rasterizeSvgToPngDataUrl, svgMarkupToDataUri, downloadDataUrl, estimateTextWidthPx } from '../ui/summary-image.js';
import {
  DEPLETION_SLIDER_PARAMS,
  ACTUAL_FUND_BALANCE,
  OFFICIAL_2030_CHECK,
} from './constants.js';
import {
  CHART_VIEW_WIDTH as SCREEN_CHART_VIEW_WIDTH,
  CHART_VIEW_HEIGHT as SCREEN_CHART_VIEW_HEIGHT,
  CHART_PAD_LEFT,
  CHART_PAD_RIGHT,
  CHART_PAD_TOP,
  CHART_PAD_BOTTOM,
  computeDepletionChartLayout,
  formatTrillion as sharedFormatTrillion,
} from './chart-layout.js';
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
  // [2026-08-25, 관리자 지시(9항목) 6번] 소진 마커 — 화면
  // (`.depletion-chart-marker-depletion`, styles.css)의 `--state-error`
  // 라이트 값을 그대로 리터럴로 옮긴다(이 파일은 항상 라이트 고정,
  // 머리말 참고).
  stateError: '#b3261e',
};

function depletionXmlEscape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function depletionSvgText(x, y, text, { size = 16, weight = 400, color = DEPLETION_SUMMARY_COLORS.textPrimary, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${depletionXmlEscape(
    text,
  )}</text>`;
}

const DEPLETION_SUMMARY_CANVAS_WIDTH = 960;
const DEPLETION_SUMMARY_PADDING = 56;

function cardsMarkup(result, top) {
  const cards = [
    [DEPLETION_CARD_DEPLETION_LABEL, result.depletionYear ? `${result.depletionYear}년` : '소진 없음'],
    [DEPLETION_CARD_CURRENT_FUND_LABEL, `${sharedFormatTrillion(ACTUAL_FUND_BALANCE.trillionKrw)}`],
    [DEPLETION_CARD_MAX_FUND_LABEL, sharedFormatTrillion(result.maxFundTrillionKrw)],
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

/**
 * [2026-08-25, 관리자 지시(9항목) 6번] 궤적 차트 — **화면
 * (`ui/depletion-panel.js`)과 같은 기하 계산**(`chart-layout.js`의
 * `computeDepletionChartLayout`)에서 나온 좌표를 그대로 쓴다. 옛
 * 버전은 이 파일이 독자적으로 계산한 선+영역뿐이었다(소유자 지적 —
 * "이미지 저장 결과가 실제 그래프와 다르다") — 이제 막대·점·선·연도
 * 라벨·소진 마커·시작 라벨까지 화면과 같은 구성 요소를 전부 그린다.
 * 좌표계 자체(640×260, `CHART_VIEW_WIDTH/HEIGHT`)는 화면과 동일하게
 * 유지하고 `<g transform="translate(...)">`로 이 요약 캔버스의 자리로만
 * 옮긴다(스케일은 걸지 않는다 — 비율을 그대로 지키기 위해서다, 원·점선
 * 등은 비균일 스케일에 약하다).
 */
function chartMarkup(result, top) {
  const layout = computeDepletionChartLayout(result);
  const { yTicks, xTicks, vertexPoints, lineD, areaD, barRects, startPoint, marker } = layout;
  const tx = DEPLETION_SUMMARY_PADDING;
  const ty = top;

  const rows = [];
  rows.push(`<g transform="translate(${tx},${ty})">`);

  // y축 눈금 — 화면과 같은 값(1,000조 단위 정수배 step).
  for (const { y, label } of yTicks) {
    rows.push(`<line x1="${CHART_PAD_LEFT}" y1="${y.toFixed(1)}" x2="${SCREEN_CHART_VIEW_WIDTH - CHART_PAD_RIGHT}" y2="${y.toFixed(1)}" stroke="${DEPLETION_SUMMARY_COLORS.border}" stroke-width="1" />`);
    rows.push(depletionSvgText(CHART_PAD_LEFT - 8, y + 4, label, { size: 11, color: DEPLETION_SUMMARY_COLORS.textMuted, anchor: 'end' }));
  }

  // 영역(area) — 막대 아래 바탕.
  rows.push(`<path d="${areaD}" fill="${DEPLETION_SUMMARY_COLORS.accentWarm}" opacity="0.12" />`);

  // 막대(연도별 적립금, 5년 단위) — 화면과 같은 히스토그램 슬롯
  // (`computeDepletionChartBarRects`, `chart-layout.js`).
  for (const { x, y, width, height } of barRects) {
    rows.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${DEPLETION_SUMMARY_COLORS.accentWarm}" opacity="0.35" />`);
  }

  // 선(막대 꼭짓점을 잇는다) + 점.
  rows.push(`<path d="${lineD}" fill="none" stroke="${DEPLETION_SUMMARY_COLORS.accentWarm}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`);
  for (const { x, y } of vertexPoints) {
    rows.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${DEPLETION_SUMMARY_COLORS.accentWarm}" stroke="${DEPLETION_SUMMARY_COLORS.surface}" stroke-width="1.5" />`);
  }

  // 소진 마커 — 최대 적립금 점선은 화면과 같은 이유로 뺀다(소유자
  // 지시(12항목) 8번).
  if (marker) {
    rows.push(`<line x1="${marker.x.toFixed(1)}" y1="${CHART_PAD_TOP}" x2="${marker.x.toFixed(1)}" y2="${SCREEN_CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM}" stroke="${DEPLETION_SUMMARY_COLORS.stateError}" stroke-width="1.5" stroke-dasharray="4 3" />`);
    rows.push(
      depletionSvgText(marker.x + marker.dx, CHART_PAD_TOP + 12, `소진 ${marker.depletionYear}년`, {
        size: 11, weight: 600, color: DEPLETION_SUMMARY_COLORS.stateError, anchor: marker.anchor,
      }),
    );
  }

  // x축 연도 라벨 — 막대 자리와 같은 부분집합(겹침 제거 포함).
  for (const { year, x } of xTicks) {
    rows.push(depletionSvgText(x, SCREEN_CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM + 18, String(year), { size: 11, color: DEPLETION_SUMMARY_COLORS.textMuted, anchor: 'middle' }));
  }

  // [2026-08-25, 소유자 지시(12항목) 7번, D85] 시작점 라벨 — 실적
  // (ACTUAL_FUND_BALANCE)에서 온다. 화면(`ui/depletion-panel.js`)이 이제
  // 실적 출발로 계산하므로, 이 요약 이미지도 「현재 기금」 카드(위,
  // ACTUAL_FUND_BALANCE.trillionKrw)와 같은 숫자를 시작점 라벨에 쓴다 —
  // 둘이 어긋나면 이 한 장의 이미지 안에서 카드와 그래프가 서로 다른
  // 숫자를 말하게 된다.
  const { x: startX, y: startY } = startPoint;
  rows.push(`<circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="4" fill="${DEPLETION_SUMMARY_COLORS.accentWarm}" />`);
  rows.push(
    depletionSvgText(startX - 10, startY + 4, `${DEPLETION_CHART_START_LABEL_PREFIX} ${sharedFormatTrillion(ACTUAL_FUND_BALANCE.trillionKrw)}${DEPLETION_CHART_START_LABEL_SUFFIX}`, {
      size: 11.5,
      weight: 700,
      color: DEPLETION_SUMMARY_COLORS.textPrimary,
      anchor: 'end',
    }),
  );
  rows.push(depletionSvgText(CHART_PAD_LEFT, -8, `${layout.firstYear}~${layout.lastYear}년 적립금 궤적`, { size: 13, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
  rows.push('</g>');

  return { markup: rows.join(''), bottom: ty + SCREEN_CHART_VIEW_HEIGHT + 24 };
}

/**
 * 핵심 가정 값 — 코어 슬라이더는 항상, 고급 슬라이더는 기본값과 다를
 * 때만(D75 선 ①과 같은 정신 — 손대지 않은 가정은 줄이 없다).
 *
 * [2026-08-25, 관리자 지시(9항목) 7번] **문구 왼쪽 정렬·숫자 오른쪽
 * 정렬, 두 열을 가깝게.** 옛 코드는 값(숫자) 열을 캔버스 오른쪽 끝
 * (`DEPLETION_SUMMARY_CANVAS_WIDTH - PADDING`, 904px)에 고정해, 짧은
 * 문구·짧은 숫자 사이에 캔버스 폭 대부분(848px)이 빈 채로 벌어져
 * 보였다. **표 자체의 폭을 "가장 긴 문구 실제 폭 + 가장 넓은 값의 폭 +
 * 여유"로 실측(`estimateTextWidthPx`, 계산기2 요약과 같은 근사식)해
 * 정하고, 그 좁은 폭 안에서만** 문구는 왼쪽, 값은 오른쪽에 붙인다 —
 * 정렬 자체(문구 왼쪽·숫자 오른쪽)는 그대로 지키되 두 열의 거리만
 * 줄어든다.
 */
function assumptionsMarkup(values, top) {
  const rows = [];
  let y = top;
  rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, DEPLETION_SUMMARY_ASSUMPTIONS_HEADING, { size: 15, weight: 700, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
  y += 28;
  const shown = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'core' || values[p.id] !== p.default);
  const LABEL_FONT = 13;
  const VALUE_FONT = 13;
  const COLUMN_GAP = 24; // 문구 끝 ~ 값 시작 사이 여유(px).
  const labelColumnWidth = Math.max(0, ...shown.map((p) => estimateTextWidthPx(p.label, LABEL_FONT)));
  const valueColumnWidth = Math.max(0, ...shown.map((p) => estimateTextWidthPx(`${values[p.id].toFixed(p.decimals)}${p.unit}`, VALUE_FONT)));
  const valueX = DEPLETION_SUMMARY_PADDING + labelColumnWidth + COLUMN_GAP + valueColumnWidth;
  for (const p of shown) {
    rows.push(depletionSvgText(DEPLETION_SUMMARY_PADDING, y, p.label, { size: LABEL_FONT, color: DEPLETION_SUMMARY_COLORS.textSecondary }));
    rows.push(depletionSvgText(valueX, y, `${values[p.id].toFixed(p.decimals)}${p.unit}`, { size: VALUE_FONT, weight: 700, anchor: 'end' }));
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
  const { markup: chartSvg, bottom: chartBottom } = chartMarkup(result, chartTop);
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
