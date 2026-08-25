/**
 * [2026-08-25, 관리자 지시(9항목) 6번] 「연금고갈 시뮬레이션」 탭의 궤적
 * 차트 — **기하 계산을 한 곳에 모은다.** 소유자가 "이미지 저장 결과가
 * 실제 그래프와 다르다"고 지적했다 — `depletion/summary-image.js`가 옛
 * 선그래프(선+영역)만 그리고 있었고, 화면(`ui/depletion-panel.js`)은
 * 이미 복합 차트(막대+점+선·연도 라벨·소진 마커·시작 라벨, 소유자 지시
 * 10~12번)로 개편된 뒤였다 — 두 코드가 각자 따로 자라며 벌어졌다.
 *
 * **이 파일이 "무엇을 어디에 그리는가"(막대 위치, 눈금 값, 선의 점,
 * 마커 x좌표)를 순수 함수로 낸다.** 화면은 이 결과를 `svgEl`(DOM)로,
 * 이미지 저장은 SVG 문자열로 각자 그리지만(계산기2 요약(D75)과 같은
 * 관행 — 내보내기는 CSS 커스텀 프로퍼티가 안 풀리는 별도 문서라 리터럴
 * hex를 직접 쓴다, `depletion/summary-image.js` 머리말), **어디에 무엇이
 * 있는지는 이제 한 코드에서만 나온다** — 화면과 이미지가 다시 벌어질
 * 방법이 없다.
 *
 * **왜 `ui/depletion-panel.js`가 아니라 `depletion/` 아래 새 파일인가.**
 * `depletion-panel.js`는 이미 `depletion/summary-image.js`를 가져다
 * 쓴다(PNG 내보내기 버튼) — 그 반대 방향으로 `summary-image.js`가
 * `depletion-panel.js`를 가져오면 순환 의존이 된다(`scripts/build.mjs`가
 * "순환 0"을 검사한다). 둘 다 이 새 파일 하나만 가져오면 순환이 생기지
 * 않는다.
 */

export const CHART_VIEW_WIDTH = 640;
export const CHART_VIEW_HEIGHT = 260;
// [2026-08-25, 소유자 지시(12항목) 7번] 시작 라벨이 "첫 데이터 좌표의
// 왼쪽"에 서므로 왼쪽 여백이 넓어야 한다(56→150).
export const CHART_PAD_LEFT = 150;
export const CHART_PAD_RIGHT = 16;
export const CHART_PAD_TOP = 16;
export const CHART_PAD_BOTTOM = 30;

export const AXIS_TICK_INTERVAL_COUNT = 5;
/** y축 라벨이 표시하는 최소 단위 — "천조"(1,000조원). 축 간격도 반드시
 * 이 단위의 정수배여야 라벨이 겹치거나 건너뛰지 않는다(`niceAxisStep`
 * 머리말, `ui/depletion-panel.js`에 있던 원래 설명 그대로). */
export const LABEL_UNIT_TRILLION_KRW = 1000;

export function niceAxisStep(rawMax, targetIntervalCount = AXIS_TICK_INTERVAL_COUNT) {
  const rawStepInUnits = Math.max(rawMax / LABEL_UNIT_TRILLION_KRW / targetIntervalCount, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStepInUnits));
  const steps = [1, 2, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= rawStepInUnits) return candidate * LABEL_UNIT_TRILLION_KRW;
  }
  return 10 * magnitude * LABEL_UNIT_TRILLION_KRW;
}

// [2026-08-25, 소유자 지시 10번] 막대 사이 간격 — 도넛 조각 사이 2px
// 관행과 같은 값(`ui/charts.js`의 `SLICE_GAP_PX`). 그 파일을 통째로
// 끌어오는 대신 값만 다시 적는다(옛 근거 그대로).
export const CHART_BAR_GAP_PX = 2;

/** [2026-08-25, 소유자 지시 10번] 막대 밀도 — 5년 단위(연 단위는 90년
 * 구간에서 막대가 너무 가늘어진다). */
export const CHART_BAR_YEAR_STEP = 5;

/** 해당 연도가 막대로 그려지는가 — 막대·점·선·x축 라벨이 전부 이 판정
 * 하나를 공유한다(단일 데이터 원천 원칙). */
export function isDepletionBarYear(year, index, lastIndex) {
  return year % CHART_BAR_YEAR_STEP === 0 || index === 0 || index === lastIndex;
}

/** 막대가 하나뿐이거나 양 끝인데 이웃이 없을 때의 대체 슬롯 폭. */
function innerBarFallback(xOf, year) {
  return Math.max(1, xOf(year + CHART_BAR_YEAR_STEP) - xOf(year));
}

/**
 * 막대 하나하나의 사각형 — 순수 데이터(DOM도 SVG 문자열도 아니다).
 * `{ x, y, width, height, year, value }[]`를 낸다. 히스토그램 슬롯
 * 계산(이웃과의 중간점, 양 끝 clamp)은 `ui/depletion-panel.js`에 있던
 * 원래 유도 그대로다(소유자 지시(12항목) 12번 — 첫 막대가 y축 왼쪽으로
 * 번지던 결함의 처방).
 */
export function computeDepletionChartBarRects({ barIndices, fundsTrillionKrw, xOf, yOf, baselineY }) {
  const plotLeft = CHART_PAD_LEFT;
  const plotRight = CHART_VIEW_WIDTH - CHART_PAD_RIGHT;
  return barIndices.map(({ year, i }, order) => {
    const x = xOf(year);
    const prevX = order === 0 ? x - (barIndices[1] ? xOf(barIndices[1].year) - x : innerBarFallback(xOf, year)) : (x + xOf(barIndices[order - 1].year)) / 2;
    const nextX =
      order === barIndices.length - 1
        ? x + (barIndices[order - 1] ? x - xOf(barIndices[order - 1].year) : innerBarFallback(xOf, year))
        : (x + xOf(barIndices[order + 1].year)) / 2;
    const left = Math.max(plotLeft, prevX + CHART_BAR_GAP_PX / 2);
    const right = Math.min(plotRight, nextX - CHART_BAR_GAP_PX / 2);
    const width = Math.max(1, right - left);
    const value = fundsTrillionKrw[i];
    const y = yOf(value);
    const height = Math.max(0, baselineY - y);
    return { x: left, y, width, height, year, value };
  });
}

/** "YYYY"(4자리) 글자폭 + 여백 실측 근사 — x축 라벨 겹침 판정에 쓴다. */
const X_LABEL_MIN_GAP = 30;

/**
 * `result`(`depletion/simulate.js`의 `runDepletionSimulation` 반환값)
 * 하나로 이 차트가 그릴 모든 것(눈금·막대·선·점·마커·시작 라벨)의 좌표를
 * 낸다 — 순수 함수, DOM도 SVG 문자열도 만들지 않는다. 화면
 * (`ui/depletion-panel.js`)과 이미지 저장(`depletion/summary-image.js`)이
 * 이 결과 하나를 각자의 방식으로만 그린다.
 */
export function computeDepletionChartLayout(result) {
  const { years, fundsTrillionKrw, depletionYear } = result;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const axisStep = niceAxisStep(Math.max(...fundsTrillionKrw) * 1.05);
  const maxScale = axisStep * AXIS_TICK_INTERVAL_COUNT;
  const innerWidth = CHART_VIEW_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const innerHeight = CHART_VIEW_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const xOf = (year) => CHART_PAD_LEFT + (lastYear === firstYear ? 0 : ((year - firstYear) / (lastYear - firstYear)) * innerWidth);
  const yOf = (value) => CHART_PAD_TOP + (1 - value / maxScale) * innerHeight;
  const baselineY = yOf(0);

  const barIndices = years.map((year, i) => ({ year, i })).filter(({ year, i }) => isDepletionBarYear(year, i, years.length - 1));
  const vertexPoints = barIndices.map(({ year, i }) => ({ x: xOf(year), y: yOf(fundsTrillionKrw[i]), year, value: fundsTrillionKrw[i] }));
  const lineD = vertexPoints.map(({ x, y }, idx) => `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${vertexPoints[vertexPoints.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} L${vertexPoints[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`;
  const barRects = computeDepletionChartBarRects({ barIndices, fundsTrillionKrw, xOf, yOf, baselineY });

  const yTicks = Array.from({ length: AXIS_TICK_INTERVAL_COUNT + 1 }, (_, i) => i * axisStep).map((value) => ({
    value,
    y: yOf(value),
    label: `${Math.round(value / 1000)}천조`,
  }));

  // [2026-08-25, 관리자 지시 — 잔마감] 꼬리 구간 라벨 겹침 — 오른쪽(마지막)
  // 에서 왼쪽으로 훑으며 최소 간격보다 가까우면 생략한다.
  const xTickKeep = new Array(barIndices.length).fill(true);
  let lastKeptLabelX = null;
  for (let i = barIndices.length - 1; i >= 0; i--) {
    const x = xOf(barIndices[i].year);
    if (lastKeptLabelX === null || lastKeptLabelX - x >= X_LABEL_MIN_GAP) {
      lastKeptLabelX = x;
    } else {
      xTickKeep[i] = false;
    }
  }
  const xTicks = barIndices.filter((_, i) => xTickKeep[i]).map(({ year }) => ({ year, x: xOf(year) }));

  const startPoint = vertexPoints[0];

  let marker = null;
  if (depletionYear != null && depletionYear <= lastYear) {
    const x = xOf(depletionYear);
    const anchorEnd = depletionYear > (firstYear + lastYear) / 2;
    marker = { x, depletionYear, anchor: anchorEnd ? 'end' : 'start', dx: anchorEnd ? -4 : 4 };
  }

  return {
    firstYear, lastYear, depletionYear,
    axisStep, maxScale, xOf, yOf, baselineY,
    barIndices, vertexPoints, lineD, areaD, barRects,
    yTicks, xTicks, startPoint, marker,
  };
}

/** `${반올림값}조원` — 화면·이미지 저장이 공유하는 유일한 서식 함수(옛
 * 코드는 두 파일에 거의 같은 한 줄을 각자 갖고 있었다, `formatTrillion`
 * (depletion-panel.js)·`depletionFormatTrillionSummary`(summary-image.js)
 * — 이제 하나로 합친다). */
export function formatTrillion(value) {
  return `${Math.round(value).toLocaleString('ko-KR')}조원`;
}
