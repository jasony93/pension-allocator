/**
 * 「연금고갈 시뮬레이션」 탭 — D84 판정 2·3. 소유자 초안
 * (`src/design/연금고갈_시뮬레이션.html`)을 돈길 디자인으로 옮긴다.
 *
 * **이 화면은 개인 세액 계산이 아니다** — 공적 기금의 시나리오 교육
 * 도구다(D84 판정 2). 그래서 이 파일은 `state/store.js`의 엔진·계측
 * 파이프라인을 쓰지 않는다 — 계산은 `../depletion/simulate.js`(순수
 * 함수)가 슬라이더 값만 받아 그 자리에서 낸다. **엔진에도, 서버에도
 * 아무것도 나가지 않는다**(계산이 전부 이 함수 호출 하나로 끝난다).
 *
 * **Chart.js를 쓰지 않는다**(D84 판정 3, 자기완결·의존성 0 원칙) — 적립금
 * 궤적은 이 파일이 직접 그리는 SVG 선그래프다.
 *
 * **다리(D84 판정 2b).** 결과 아래에 절세계좌 계산기 탭으로 가는 링크
 * 하나를 둔다 — "사적연금 배분으로 대비하기"류 사실 문장 + 링크이지,
 * "당신은 얼마를 넣으세요"를 말하지 않는다(개인 지시형 출력 금지 유지).
 */

import { el, svgEl, patch } from './dom.js';
import { runDepletionSimulation } from '../depletion/simulate.js';
import {
  DEPLETION_SLIDER_PARAMS,
  OFFICIAL_2030_CHECK,
  ACTUAL_FUND_BALANCE,
  INITIAL_FUND_TRILLION_KRW,
  STATUTORY_RATE_CEILING_PERCENT,
  STATUTORY_AGE_CEILING_YEARS,
} from '../depletion/constants.js';
import { exportDepletionSummaryPng, downloadDataUrl } from '../depletion/summary-image.js';
import { buildDepletionShareUrl } from '../depletion/share-link.js';
import {
  DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL,
  DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL,
  DEPLETION_CARD_DEPLETION_LABEL,
  DEPLETION_CARD_CURRENT_FUND_LABEL,
  DEPLETION_CARD_MAX_FUND_LABEL,
  DEPLETION_CORE_ASSUMPTIONS_HEADING,
  DEPLETION_RECIPIENTS_CURVE_NOTE,
  DEPLETION_RATE_ASSUMPTION_NOTE,
  DEPLETION_AGE_ASSUMPTION_NOTE,
  DEPLETION_CHART_START_LABEL_PREFIX,
  DEPLETION_CHART_START_LABEL_SUFFIX,
  DEPLETION_VALIDATION_LINE_PREFIX,
  DEPLETION_VALIDATION_LINE_MID,
  DEPLETION_VALIDATION_LINE_SUFFIX,
} from '../depletion-copy.js';
import {
  IMAGE_EXPORT_LABEL,
  SHARE_LINK_LABEL,
  SHARE_LINK_COPIED_NOTE,
  SHARE_LINK_COPY_BLOCKED_NOTE,
  IMAGE_EXPORT_BLOCKED_NOTE,
} from '../copy.js';
import { SAVE_SHARE_IMAGE_ICON_DATA_URI } from '../assets/save-share-image-icon.js';
import { SAVE_SHARE_SHARE_ICON_DATA_URI } from '../assets/save-share-share-icon.js';

const CORE_PARAMS = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'core');
const ADVANCED_PARAMS = DEPLETION_SLIDER_PARAMS.filter((p) => p.group === 'advanced');

function formatTrillion(value) {
  return `${Math.round(value).toLocaleString('ko-KR')}조원`;
}

function formatSliderValue(param, value) {
  return `${value.toFixed(param.decimals)}${param.unit}`;
}

/**
 * 슬라이더 한 줄 — 라벨 + `<input type="range">` + 값 표시. 네이티브
 * range 컨트롤이라 방향키(←→)로 `step` 단위로 움직이고(키보드 스텝),
 * 터치 드래그도 브라우저가 기본으로 지원한다(모바일 터치) — 이 파일이
 * 새로 만들 접근성 배선은 `label[for]` 연결과 `aria-valuetext` 하나뿐이다
 * (숫자만으로는 단위가 안 들려서 스크린 리더가 "13"이라고만 읽는다).
 */
function sliderRow(param, value, onInput) {
  const inputId = `depletion-slider-${param.id}`;
  const valueNode = el('span', { class: 'depletion-slider-value', id: `${inputId}-value` }, [formatSliderValue(param, value)]);
  const input = el('input', {
    type: 'range',
    id: inputId,
    class: 'depletion-slider-input',
    min: String(param.min),
    max: String(param.max),
    step: String(param.step),
    value: String(value),
    'aria-valuetext': formatSliderValue(param, value),
    oninput: (event) => {
      const next = parseFloat(event.target.value);
      valueNode.textContent = formatSliderValue(param, next);
      input.setAttribute('aria-valuetext', formatSliderValue(param, next));
      onInput(param.id, next);
    },
  });
  return el('div', { class: 'depletion-slider-row' }, [
    el('label', { for: inputId, class: 'depletion-slider-label' }, [param.label]),
    input,
    valueNode,
  ]);
}

function outcomeCard(label, valueText, sourceText) {
  return el('div', { class: 'depletion-card' }, [
    el('div', { class: 'depletion-card-label' }, [label]),
    el('div', { class: 'depletion-card-value' }, [valueText]),
    sourceText ? el('div', { class: 'depletion-card-source type-caption' }, [sourceText]) : null,
  ]);
}

/**
 * [2026-08-25, 소유자 지시(12항목) 7번, D85] **한 줄로 고쳐 쓴다.** 옛
 * 버전은 모델의 2030년 값(보험료수입·급여지출·적립금)을
 * `OFFICIAL_2030_CHECK`와 나란히 대조했다 — 그 대조는 **전망 기준
 * (1,458조 출발)일 때만 뜻이 있다**(제5차·중기전망 문서 자체가 전망
 * 출발을 전제한다). 화면이 이제 실적 출발로 계산하므로(아래
 * `rerenderComputed`) 그 상세 대조를 화면에 그대로 유지하면 실적 출발
 * 궤적을 전망 대조값과 비교하는 것처럼 오해를 살 수 있다 — 그래서
 * **화면은 한 줄**(모델 자체의 정확성 증명 + 이 화면의 실제 출발값, 두
 * 사실을 갈라 말한다)로 줄이고, 상세 대조(전망 기준 1,458조 출발 →
 * 2030 오차 ≤1.5%)는 `simulate.test.mjs`가 회귀 lock으로 보존한다(D85
 * 원문 "전망 기준 검증은 단위시험으로 보존"). 이 함수는 더는
 * `checkpoint2030`을 받지 않는다 — 슬라이더 값과 무관한 상시 문장이다.
 */
function validationLine() {
  return el('div', { class: 'depletion-validation' }, [
    `${DEPLETION_VALIDATION_LINE_PREFIX}${formatTrillion(INITIAL_FUND_TRILLION_KRW)}${DEPLETION_VALIDATION_LINE_MID}${formatTrillion(ACTUAL_FUND_BALANCE.trillionKrw)}${DEPLETION_VALIDATION_LINE_SUFFIX}`,
    el('div', { class: 'depletion-validation-source type-caption' }, [`전망 기준 대조 출처 — ${OFFICIAL_2030_CHECK.source} · 실적 출처 — ${ACTUAL_FUND_BALANCE.source}`]),
  ]);
}

/**
 * 수급자 곡선의 출처 한계를 밝히는 상시 고지(33.8 #21) — 슬라이더와
 * 무관하게 항상 보인다.
 *
 * [2026-08-24, 소유자 지시 4번] **실제 적립금 실적 고지 줄은 여기서
 * 뺐다** — 「현재 기금」 카드(출처 캡션 포함, 아래 `rerenderComputed`)가
 * 이제 같은 사실(실적값·출처)을 카드 자리에서 밝히므로, 같은 사실을 두
 * 자리에서 중복해 말하지 않는다(관리자 지시 원문 "기존 실적 고지 줄과
 * 중복되면 고지 줄 쪽을 정리").
 */
function staticSourceNotes() {
  return el('div', { class: 'depletion-static-notes' }, [
    el('p', { class: 'depletion-static-note type-caption' }, [DEPLETION_RECIPIENTS_CURVE_NOTE]),
  ]);
}

/**
 * 슬라이더가 법정 상한을 넘어 "가정" 구간에 들어갔을 때만 뜨는 경고 줄
 * (33.5 (1)·(3)) — 법정 스케줄인지 순수 시나리오인지 화면이 스스로 밝힌다.
 */
function assumptionBoundaryNotes(values) {
  const notes = [];
  if (values.rate > STATUTORY_RATE_CEILING_PERCENT) notes.push(DEPLETION_RATE_ASSUMPTION_NOTE);
  if (values.age > STATUTORY_AGE_CEILING_YEARS) notes.push(DEPLETION_AGE_ASSUMPTION_NOTE);
  if (notes.length === 0) return el('div', { class: 'depletion-assumption-notes', hidden: true });
  return el(
    'div',
    { class: 'depletion-assumption-notes' },
    notes.map((note) => el('p', { class: 'depletion-assumption-note type-caption' }, [note])),
  );
}

// ---------------------------------------------------------------------------
// SVG 선그래프 — viewBox 좌표계, CSS 토큰 색, hover 시 <title> 네이티브
// 툴팁(기존 도넛 라벨의 aria-label 수준 관행 — 별도 오버레이 컴포넌트를
// 새로 짓지 않는다).
// ---------------------------------------------------------------------------

const CHART_VIEW_WIDTH = 640;
const CHART_VIEW_HEIGHT = 260;
// [2026-08-25, 소유자 지시(12항목) 7번] 시작 라벨이 이제 "y축 위쪽
// 고정 여백"이 아니라 "첫 데이터 좌표의 왼쪽"에 선다 — 그만큼 왼쪽 여백이
// 넓어야 텍스트가 잘리지 않는다(56→150). y축 위쪽 여백은 더 이상 라벨
// 전용 공간이 필요 없으므로 원래 값(16)으로 되돌린다.
const CHART_PAD_LEFT = 150;
const CHART_PAD_RIGHT = 16;
const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 30;

/**
 * [2026-08-24, 관리자 지시 — 번들 실측 회귀] y축 눈금 간격이 실제로는
 * 균등(1250조씩)한데 **라벨이 불균등해 보이던** 결함의 원인 — 옛
 * `niceMaxScale`은 "축의 최댓값"만 1,2,2.5,5,10 배수 중에서 골랐고, 그
 * 최댓값을 **4등분**(0·0.25·0.5·0.75·1)해 눈금을 냈다. 최댓값이 5,000(조)
 * 로 골리면 눈금값은 0·1,250·2,500·3,750·5,000이 되고, 화면 라벨은 그 값을
 * 1,000으로 나눠 반올림한다 — 2,500 ÷ 1,000 = 2.5는 **반올림하면 3**이 되어
 * "2천조" 라벨이 통째로 건너뛰어졌다(0·1·3·4·5). 값 자체의 간격은 고른데
 * 표시 라벨이 홀수 자리를 건너뛰어 "1→3" 구간만 두 배로 벌어져 보인 것이다.
 *
 * **고친 방법 — "최댓값을 고르고 4등분"이 아니라 "눈금 간격(step)을 먼저
 * 고르고, 그 step을 그대로 쌓아 최댓값을 낸다".** 다만 이것만으로는
 * 부족하다 — step 후보를 1·2·5·10배수로 순진하게 고르면 좁은 축(예: 수익률
 * 슬라이더 최솟값 시나리오, 최대 적립금 약 1,970조)에서 step=500(조)이
 * 나올 수 있고, 500과 1,000 두 눈금이 **같은 "1천조" 라벨로 반올림돼
 * 겹친다** — 처음 결함과 증상은 다르지만 뿌리(라벨의 반올림 단위 1,000조와
 * 축 간격 단위가 어긋난다)는 같다. 그래서 step 후보를 **1,000조 단위
 * 자체에서** 고른다(`LABEL_UNIT_TRILLION_KRW`) — step이 항상 1,000조의
 * 정수배로만 떨어지므로, 어떤 시나리오(슬라이더 극값 포함)에서도 눈금값을
 * 1,000으로 나눈 라벨이 반올림 손실 없이 정수로 딱 떨어진다.
 */
const AXIS_TICK_INTERVAL_COUNT = 5;
/** y축 라벨이 표시하는 최소 단위 — "천조"(1,000조원). `formatTrillion`이
 * 아니라 이 파일의 y축 라벨 자체가 `Math.round(value / 1000)`로 이 단위로
 * 반올림한다(아래 `yTickNodes`) — 축 간격도 반드시 이 단위의 정수배여야
 * 라벨이 겹치거나 건너뛰지 않는다. */
const LABEL_UNIT_TRILLION_KRW = 1000;

function niceAxisStep(rawMax, targetIntervalCount = AXIS_TICK_INTERVAL_COUNT) {
  const rawStepInUnits = Math.max(rawMax / LABEL_UNIT_TRILLION_KRW / targetIntervalCount, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStepInUnits));
  const steps = [1, 2, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= rawStepInUnits) return candidate * LABEL_UNIT_TRILLION_KRW;
  }
  return 10 * magnitude * LABEL_UNIT_TRILLION_KRW;
}

// [2026-08-25, 소유자 지시 10번] 막대(연도별 적립금) 간격 — 도넛 조각
// 사이 간격과 같은 2px 관행을 그대로 쓴다(`ui/charts.js`의
// `SLICE_GAP_PX = 2`가 이 저장소의 그 관행 자체다 — 여기서 값만 다시
// 적고, 상수를 새로 만들어 두 곳이 각자 값을 들고 있게 하지 않는다. 이
// 파일이 `charts.js`를 더 끌어오지 않는 이유는 이 값 하나 때문에 SVG
// 도넛 모듈 전체를 의존성으로 들이는 것이 과하기 때문이다 — 값 자체는
// 2px로 고정해 두 곳이 항상 같은 수를 쓴다).
const CHART_BAR_GAP_PX = 2;

/**
 * [2026-08-25, 소유자 지시 10번] **막대 밀도 — 연 단위가 아니라 5년
 * 단위로 솎는다.** 시뮬레이션 구간은 최대 90년 안팎(2026~2115)이라
 * 연 단위 막대는 폭이 800px대 차트에서 막대 하나당 9px 미만이 되어
 * 2px 간격을 지키면 막대 자체가 거의 안 남는다(판단 근거). 국민연금
 * 재정추계 보고서 자신도 5년 단위 표를 쓴다(`OFFICIAL_2030_CHECK` 등
 * 이 파일이 참고하는 문서들의 관행과도 맞다). **시작·끝 연도는 5의
 * 배수가 아니어도 항상 포함한다** — 궤적의 시작·끝이 막대에서도 보이게
 * 한다.
 */
const CHART_BAR_YEAR_STEP = 5;

/** [2026-08-25, 소유자 지시(10항목) — 해당 연도가 막대로 그려지는가.
 * 막대·막대 위 점·그 점을 잇는 선·x축 연도 라벨(소유자 지시 10·11번)이
 * 전부 이 판정 하나를 공유한다 — 넷 중 하나만 따로 계산하면 서로 어긋난
 * 자리에 그려질 위험이 있다(단일 데이터 원천 원칙). */
function isDepletionBarYear(year, index, lastIndex) {
  return year % CHART_BAR_YEAR_STEP === 0 || index === 0 || index === lastIndex;
}

/**
 * [2026-08-25, 소유자 지시(12항목) 12번] **첫 막대가 y축 왼쪽으로 번지는
 * 결함.** 히스토그램 슬롯 경계를 "이웃 막대와의 중간점"으로 재는 방식은
 * 양 끝(첫째·마지막 막대)에 이웃이 한쪽밖에 없어, 반대쪽 경계를 "이웃까지
 * 거리만큼 대칭으로 미러링"해서 냈다 — 첫 막대의 왼쪽 경계가 `x −
 * (다음 막대까지 거리)`가 되어, x가 이미 플롯 왼쪽 끝(`CHART_PAD_LEFT`,
 * y축 자리)인 첫 해에는 이 미러링이 y축보다 왼쪽(플롯 밖, y축 라벨
 * 자리)까지 밀고 나간다(실측 확인). **원인은 클리핑 부재가 아니라 슬롯
 * 계산 자체가 플롯 경계를 모르는 것** — 그래서 처방도 클리핑(자르기)이
 * 아니라 슬롯 경계를 플롯 경계로 못 박는 clamp다: 왼쪽 경계는 절대
 * `CHART_PAD_LEFT`보다 왼쪽으로, 오른쪽 경계는 절대 플롯 오른쪽 끝보다
 * 오른쪽으로 나갈 수 없다. */
function buildDepletionChartBars({ barIndices, fundsTrillionKrw, xOf, yOf, baselineY }) {
  const plotLeft = CHART_PAD_LEFT;
  const plotRight = CHART_VIEW_WIDTH - CHART_PAD_RIGHT;
  return barIndices.map(({ year, i }, order) => {
    const x = xOf(year);
    // 히스토그램 슬롯 — 이웃 막대와의 중간점을 경계로 삼는다(막대 간격이
    // 불균일해도 — 시작·끝 연도가 5년 배수가 아닐 수 있다 — 겹치거나
    // 비지 않는다). `prevX`·`nextX`는 항상 `x`(막대 자신의 데이터 좌표)를
    // 기준으로 대칭이다 — 안쪽 막대는 이웃과의 중간점이 정의상 그렇고,
    // 양 끝 막대는 반대쪽 경계를 `x` 기준으로 미러링해서 낸다(`2x −
    // 이웃`) — 그래서 아래 `halfWidth`도 `x`를 중심으로 대칭이다.
    const prevX = order === 0 ? x - (barIndices[1] ? xOf(barIndices[1].year) - x : innerBarFallback(xOf, year)) : (x + xOf(barIndices[order - 1].year)) / 2;
    const nextX =
      order === barIndices.length - 1
        ? x + (barIndices[order - 1] ? x - xOf(barIndices[order - 1].year) : innerBarFallback(xOf, year))
        : (x + xOf(barIndices[order + 1].year)) / 2;
    // [2026-08-25, 소유자 지시(12항목) 12번] **첫 막대가 y축 왼쪽으로
    // 번지는 결함 — 관리자 지시 원문의 처방("첫 막대 오프셋") 그대로
    // 적용한다.** 첫 해의 데이터 좌표 `x`는 정의상 y축 자리(`plotLeft`)와
    // 정확히 같다 — 그 좌표를 중심으로 폭이 있는 막대를 그리면 절반은
    // 반드시 y축 왼쪽(플롯 밖)으로 나간다(기하적으로 피할 수 없다,
    // 대칭을 유지한 채로는 왼쪽 경계를 지킬 수 없다). 그래서 대칭 중심
    // 정렬 대신 **각 경계를 플롯 영역 안으로 독립적으로 clamp**한다 — 첫
    // 막대는 왼쪽 경계가 `plotLeft`에서 시작해 오른쪽으로만 넓어지고
    // (오프셋), 마지막 막대는 반대로 오른쪽 경계가 `plotRight`에서
    // 멈춘다. 안쪽 막대는 이웃과의 대칭 슬롯이 이미 플롯 안에 들어오므로
    // 이 clamp가 걸리지 않는다(값이 그대로 나온다).
    const left = Math.max(plotLeft, prevX + CHART_BAR_GAP_PX / 2);
    const right = Math.min(plotRight, nextX - CHART_BAR_GAP_PX / 2);
    const width = Math.max(1, right - left);
    const value = fundsTrillionKrw[i];
    const y = yOf(value);
    const height = Math.max(0, baselineY - y);
    return svgEl(
      'rect',
      { class: 'depletion-chart-bar', x: left.toFixed(1), y: y.toFixed(1), width: width.toFixed(1), height: height.toFixed(1) },
      [svgEl('title', {}, [`${year}년: ${formatTrillion(value)}`])],
    );
  });
}

/** 막대가 하나뿐이거나 양 끝인데 이웃이 없을 때의 대체 슬롯 폭(연 5년치
 * x축 간격을 근사) — 실제로는 시뮬레이션 구간이 최소 수 년이라 이 경로를
 * 거의 타지 않지만, 경계 시나리오(소진이 시작 직후인 극단값)에서도 폭이
 * 0이 되지 않게 하는 방어다. */
function innerBarFallback(xOf, year) {
  return Math.max(1, xOf(year + CHART_BAR_YEAR_STEP) - xOf(year));
}

function buildDepletionChart(result) {
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

  // [2026-08-25, 소유자 지시(12항목) 10·11번] 막대·점·선·x축 연도 라벨이
  // 전부 이 하나의 연도 집합(5년 단위 + 시작·끝)을 공유한다 — "연 단위
  // 선 대신 막대 꼭짓점 연결"(관리자 지시 원문)이 뜻하는 바가 바로 이것:
  // 선·점을 매년이 아니라 막대가 실제로 서는 해에만 찍는다.
  const barIndices = years.map((year, i) => ({ year, i })).filter(({ year, i }) => isDepletionBarYear(year, i, years.length - 1));

  const vertexPoints = barIndices.map(({ year, i }) => [xOf(year), yOf(fundsTrillionKrw[i])]);
  const lineD = vertexPoints.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${vertexPoints[vertexPoints.length - 1][0].toFixed(1)},${baselineY.toFixed(1)} L${vertexPoints[0][0].toFixed(1)},${baselineY.toFixed(1)} Z`;
  const barNodes = buildDepletionChartBars({ barIndices, fundsTrillionKrw, xOf, yOf, baselineY });

  // y축 눈금 — 0부터 maxScale까지 axisStep(항상 1,000조의 정수배)을 그대로
  // 쌓는다. 4등분 나눗셈이 아니라서 반올림 라벨이 절대 건너뛰지 않는다.
  const yTicks = Array.from({ length: AXIS_TICK_INTERVAL_COUNT + 1 }, (_, i) => i * axisStep);
  const yTickNodes = yTicks.flatMap((value) => {
    const y = yOf(value);
    return [
      svgEl('line', {
        class: 'depletion-chart-grid',
        x1: CHART_PAD_LEFT, x2: CHART_VIEW_WIDTH - CHART_PAD_RIGHT, y1: y.toFixed(1), y2: y.toFixed(1),
      }),
      svgEl('text', { class: 'depletion-chart-axis-label', x: CHART_PAD_LEFT - 8, y: (y + 4).toFixed(1), 'text-anchor': 'end' }, [
        `${Math.round(value / 1000)}천조`,
      ]),
    ];
  });

  // [2026-08-25, 소유자 지시(12항목) 11번] x축 연도 라벨 — 막대 위치와
  // 정확히 같은 자리(각 막대 아래)에, `barIndices`(위)를 그대로 쓴다.
  // 옛 "최대 8개, 균등 간격" 독립 로직은 막대 자리와 어긋날 수 있어 뺐다.
  const xTickNodes = barIndices.map(({ year }) =>
    svgEl('text', { class: 'depletion-chart-axis-label', x: xOf(year).toFixed(1), y: CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM + 18, 'text-anchor': 'middle' }, [
      String(year),
    ]),
  );

  // [2026-08-25, 소유자 지시(12항목) 10번] 데이터 점 — 막대 하나마다
  // 하나씩(=막대 꼭짓점), 매년이 아니다. hover 시 <title>(네이티브
  // 툴팁, 막대와 같은 관행)만 낸다.
  const pointNodes = barIndices.map(({ year, i }, order) => {
    const [x, y] = vertexPoints[order];
    return svgEl('circle', { class: 'depletion-chart-point', cx: x.toFixed(1), cy: y.toFixed(1), r: 5 }, [
      svgEl('title', {}, [`${year}년: ${formatTrillion(fundsTrillionKrw[i])}`]),
    ]);
  });

  // [2026-08-25, 소유자 지시(12항목) 7번] **D85 적용** — 화면의 궤적은
  // 이제 실적(`ACTUAL_FUND_BALANCE`, 1,670.7조)에서 출발한다(카드·그래프
  // 시작점·라벨이 한 숫자 — `mountDepletionPanel`의 `rerenderComputed`가
  // `initialFundTrillionKrw: ACTUAL_FUND_BALANCE.trillionKrw`를 넘긴다,
  // 아래). 전망 재현 출발값(1,458조) 자체의 정확성 증명은 화면에서 빠지고
  // 단위시험(`simulate.test.mjs`)으로 내려간다(D85 원문).
  //
  // **위치도 바뀐다 — y축 위쪽 고정 여백이 아니라 "첫 데이터 좌표의
  // 왼쪽"이다**(소유자 지시 원문). 점은 실제 시작점에, 글자는 그 점의
  // 왼쪽(`text-anchor: end`)에 붙는다 — `CHART_PAD_LEFT`를 넓혀(150) 그
  // 글자가 y축 왼쪽 여백 안에 들어가게 했다(위 상수 선언 참고).
  const [startX, startY] = vertexPoints[0];
  const startLabelNode = svgEl('g', { class: 'depletion-chart-start' }, [
    svgEl('circle', { class: 'depletion-chart-start-point', cx: startX.toFixed(1), cy: startY.toFixed(1), r: 4 }),
    svgEl('text', { class: 'depletion-chart-start-label', x: (startX - 10).toFixed(1), y: (startY + 4).toFixed(1), 'text-anchor': 'end' }, [
      `${DEPLETION_CHART_START_LABEL_PREFIX} ${formatTrillion(ACTUAL_FUND_BALANCE.trillionKrw)}${DEPLETION_CHART_START_LABEL_SUFFIX}`,
    ]),
  ]);

  // [2026-08-25, 소유자 지시(12항목) 8번] **최대 적립금 시기의 세로 점선을
  // 뺀다** — 소진 점선(아래)만 남긴다. 옛 "수지 적자 전환" 점선
  // (`depletion-chart-marker-deficit`)이 시각적으로 최대 적립금 시점과
  // 가까워 그렇게 보였다 — 통째로 지운다(`deficitYear` 자체는
  // `runDepletionSimulation`이 여전히 계산하지만 이 차트는 더는 안 쓴다).
  const markers = [];
  if (depletionYear != null && depletionYear <= lastYear) {
    const x = xOf(depletionYear);
    markers.push(
      svgEl('g', { class: 'depletion-chart-marker depletion-chart-marker-depletion' }, [
        svgEl('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: CHART_PAD_TOP, y2: CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM }),
        svgEl('text', { x: x.toFixed(1), y: CHART_PAD_TOP + 12, 'text-anchor': depletionYear > (firstYear + lastYear) / 2 ? 'end' : 'start', dx: depletionYear > (firstYear + lastYear) / 2 ? -4 : 4 }, [
          `소진 ${depletionYear}년`,
        ]),
      ]),
    );
  }

  return svgEl(
    'svg',
    {
      class: 'depletion-chart',
      viewBox: `0 0 ${CHART_VIEW_WIDTH} ${CHART_VIEW_HEIGHT}`,
      role: 'img',
      'aria-label': `연도별 국민연금 적립금 궤적 — ${firstYear}년부터 ${lastYear}년까지, 적립금이 늘다가 줄어 ${depletionYear != null ? depletionYear + '년에 소진됩니다' : '시뮬레이션 구간 안에서는 소진되지 않습니다'}.`,
    },
    [
      ...yTickNodes,
      svgEl('path', { class: 'depletion-chart-area', d: areaD }),
      // [2026-08-25, 소유자 지시 10번] 복합 차트 — 막대(연도별 적립금, 5년
      // 단위)를 영역(area) 위, 선(line) 아래에 둔다. "막대 + 그 위 점을
      // 연결하는 선"(관리자 지시 원문) — 막대가 바탕, 선·점이 그 위 얹힌다.
      ...barNodes,
      svgEl('path', { class: 'depletion-chart-line', d: lineD, fill: 'none' }),
      ...markers,
      ...pointNodes,
      ...xTickNodes,
      startLabelNode,
    ],
  );
}

/**
 * [2026-08-25, 소유자 지시 9번] 시뮬레이션 탭 팝업의 오른쪽 상단 —
 * "시뮬레이션 그래프 + 기본 슬라이더의 디자인 구성만"(관리자 지시 원문).
 * **정적 축소 렌더다 — 실제 조작이 안 된다.** 기본값 하나로 한 번만
 * 계산해(사용자 입력과 무관, 팝업을 열 때마다 같은 그림) 기존 SVG 차트
 * (`buildDepletionChart`)를 그대로 재사용한 축소판 + 핵심 가정 슬라이더
 * 세 줄(비활성 `disabled`, 탭 순서에서 제외)을 함께 낸다. 이 함수가 만드는
 * `<input>`은 `mountDepletionPanel`의 진짜 슬라이더와 달리 `oninput`
 * 배선이 아예 없다 — "이렇게 생겼다"만 보여주면 되므로 상태를 갖지 않는다.
 */
export function depletionChartAndSlidersPreview() {
  const defaults = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));
  // [2026-08-25, D85] 축소 미리보기도 본판과 같은 출발값(실적)을 쓴다 —
  // 팝업의 그림이 본판과 다른 궤적을 보이면 안 된다.
  const result = runDepletionSimulation({ ...defaults, initialFundTrillionKrw: ACTUAL_FUND_BALANCE.trillionKrw });
  const chart = buildDepletionChart(result);
  const sliderRows = CORE_PARAMS.map((p) =>
    el('div', { class: 'depletion-slider-row depletion-preview-slider-row' }, [
      el('span', { class: 'depletion-slider-label' }, [p.label]),
      el('input', {
        type: 'range',
        class: 'depletion-slider-input',
        min: String(p.min),
        max: String(p.max),
        step: String(p.step),
        value: String(p.default),
        disabled: true,
        tabindex: -1,
        'aria-hidden': 'true',
      }),
      el('span', { class: 'depletion-slider-value' }, [formatSliderValue(p, p.default)]),
    ]),
  );
  return el('div', { class: 'depletion-preview' }, [chart, el('div', { class: 'depletion-sliders depletion-preview-sliders' }, sliderRows)]);
}

// ---------------------------------------------------------------------------
// 마운트
// ---------------------------------------------------------------------------

/** 아이콘 하나만 남는 저장/공유 버튼 — 계산기2가 이미 쓰는 범용 CSS
 * 클래스(`.save-share-icon-btn`·`.save-share-icon`)를 그대로 재사용한다
 * (`ui/result-panel.js`의 `saveShareIconButton`과 같은 모양, 이 탭
 * 전용으로 다시 짤 이유가 없다 — 소유자 지시 원문 "첫 탭 관행 그대로"). */
function depletionIconButton({ extraClass, dataUri, ariaLabel, onclick }) {
  return el(
    'button',
    { type: 'button', class: `btn btn-secondary save-share-icon-btn ${extraClass}`, 'aria-label': ariaLabel, onclick },
    [el('span', { class: 'save-share-icon', 'aria-hidden': 'true', style: `mask-image:url(${dataUri});-webkit-mask-image:url(${dataUri});width:22px;height:22px;` })],
  );
}

/**
 * [2026-08-25, 소유자 지시 8번] `onBridgeToCalc2`는 더는 이 함수의
 * 관심사가 아니다 — 다리(문구+버튼)를 통째로 지웠다(아래). 절세계좌
 * 탭으로의 연결은 이제 이 탭 전용 팝업(`ui/depletion-intro-modal.js`)이
 * 진다 — 그 팝업은 `app.js`가 직접 마운트하고 자기만의
 * `onBridgeToCalc2`를 받는다(이 함수와는 별개 배선).
 *
 * @param {HTMLElement} container
 * @param {{ initialValues?: Record<string, number> }} options
 */
export function mountDepletionPanel(container, { initialValues } = {}) {
  const values = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));
  if (initialValues) {
    for (const p of DEPLETION_SLIDER_PARAMS) {
      if (typeof initialValues[p.id] === 'number' && Number.isFinite(initialValues[p.id])) values[p.id] = initialValues[p.id];
    }
  }
  const cardsSlot = el('div', { class: 'depletion-cards' });
  const validationSlot = el('div', { class: 'depletion-validation-slot' });
  const chartSlot = el('div', { class: 'depletion-chart-wrap' });
  const assumptionNotesSlot = el('div', { class: 'depletion-assumption-notes-slot' });
  // [소유자 지시 5번] 공유 링크로 복원된 값이 고급 설정 안에 있으면(예:
  // 임금상승률을 바꾼 링크) 그 값이 어디서 왔는지 보이도록 처음부터
  // 펼쳐 둔다 — "열면 복원"이 눈에 보이는 복원이어야 뜻이 있다.
  let advancedOpen = ADVANCED_PARAMS.some((p) => values[p.id] !== p.default);

  function rerenderComputed() {
    // [2026-08-25, 소유자 지시(12항목) 7번, D85] 화면 계산은 이제 실적
    // (`ACTUAL_FUND_BALANCE.trillionKrw`, 1,670.7조)에서 출발한다 —
    // 「현재 기금」 카드가 보이는 값과 정확히 같은 숫자를 시뮬레이션
    // 입력으로도 넘겨, 카드·그래프 시작점·시작 라벨이 한 숫자가 되게
    // 한다(D85 원문). 전망 재현(1,458조 출발)은 `simulate.test.mjs`에서만
    // 계속 돈다 — 화면 경로는 이 한 곳만 실적으로 바뀐다.
    const result = runDepletionSimulation({ ...values, initialFundTrillionKrw: ACTUAL_FUND_BALANCE.trillionKrw });
    patch(
      cardsSlot,
      el('div', { class: 'depletion-cards' }, [
        outcomeCard(DEPLETION_CARD_DEPLETION_LABEL, result.depletionYear ? `${result.depletionYear}년` : '소진 없음'),
        // [소유자 지시 4번] 「현재 기금」 카드 — 값은 모델 계산치가 아니라
        // 실적(ACTUAL_FUND_BALANCE)이다. 카드 자신이 작은 캡션으로 출처를
        // 단다 — 다른 곳(핵심 가정 출처)과 섞이지 않는다.
        outcomeCard(
          DEPLETION_CARD_CURRENT_FUND_LABEL,
          formatTrillion(ACTUAL_FUND_BALANCE.trillionKrw),
          `${ACTUAL_FUND_BALANCE.asOf} · ${ACTUAL_FUND_BALANCE.source}`,
        ),
        outcomeCard(DEPLETION_CARD_MAX_FUND_LABEL, formatTrillion(result.maxFundTrillionKrw)),
      ]),
    );
    patch(validationSlot, el('div', { class: 'depletion-validation-slot' }, [validationLine()]));
    patch(chartSlot, el('div', { class: 'depletion-chart-wrap' }, [buildDepletionChart(result), chartActionsRow(), shareNote]));
    patch(assumptionNotesSlot, el('div', { class: 'depletion-assumption-notes-slot' }, [assumptionBoundaryNotes(values)]));
  }

  function onSliderInput(id, value) {
    values[id] = value;
    rerenderComputed();
  }

  // [소유자 지시 5번] 이미지 저장 — 요약 시트(카드+궤적+핵심 가정+출처)
  // 를 하나의 SVG로 조립해 PNG로 내려받는다(`depletion/summary-image.js`,
  // 계산기2와 같은 의존성 0 관행).
  const imageOnClick = async () => {
    try {
      // [2026-08-25, D85] 저장 이미지도 화면과 같은 출발값(실적)을 쓴다.
      const result = runDepletionSimulation({ ...values, initialFundTrillionKrw: ACTUAL_FUND_BALANCE.trillionKrw });
      const dataUrl = await exportDepletionSummaryPng(result, values);
      downloadDataUrl(dataUrl, '연금고갈-시뮬레이션-요약.png');
    } catch {
      shareNote.textContent = IMAGE_EXPORT_BLOCKED_NOTE;
    }
  };
  // [소유자 지시 5번] 공유 — 슬라이더 값을 URL 프래그먼트에 실어(쿼리
  // 금지, `depletion/share-link.js`) 클립보드에 복사한다. D74 관행 그대로
  // "이 링크에는 입력하신 값이 들어 있습니다"를 반드시 먼저 보인다.
  const shareOnClick = async () => {
    const url = buildDepletionShareUrl(values);
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(url);
      shareNote.textContent = SHARE_LINK_COPIED_NOTE;
    } catch {
      shareNote.textContent = `${SHARE_LINK_COPY_BLOCKED_NOTE} ${url}`;
    }
  };
  const shareNote = el('p', { class: 'type-caption depletion-share-note' }, ['']);
  function chartActionsRow() {
    return el('div', { class: 'depletion-chart-actions' }, [
      depletionIconButton({ extraClass: 'depletion-image-btn', dataUri: SAVE_SHARE_IMAGE_ICON_DATA_URI, ariaLabel: IMAGE_EXPORT_LABEL, onclick: imageOnClick }),
      depletionIconButton({ extraClass: 'depletion-share-btn', dataUri: SAVE_SHARE_SHARE_ICON_DATA_URI, ariaLabel: SHARE_LINK_LABEL, onclick: shareOnClick }),
    ]);
  }

  const advancedSlot = el('div', { class: 'depletion-sliders depletion-sliders-advanced', hidden: !advancedOpen }, ADVANCED_PARAMS.map((p) => sliderRow(p, values[p.id], onSliderInput)));
  const advancedToggle = el(
    'button',
    {
      type: 'button',
      class: 'btn depletion-advanced-toggle',
      'aria-expanded': String(advancedOpen),
      onclick: () => {
        advancedOpen = !advancedOpen;
        advancedSlot.hidden = !advancedOpen;
        advancedToggle.setAttribute('aria-expanded', String(advancedOpen));
        advancedToggle.textContent = advancedOpen ? DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL : DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL;
      },
    },
    [advancedOpen ? DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL : DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL],
  );

  const section = el('section', { class: 'depletion-panel' }, [
    cardsSlot,
    validationSlot,
    staticSourceNotes(),
    chartSlot,
    el('p', { class: 'depletion-sliders-heading type-body-strong' }, [DEPLETION_CORE_ASSUMPTIONS_HEADING]),
    el('div', { class: 'depletion-sliders depletion-sliders-core' }, CORE_PARAMS.map((p) => sliderRow(p, values[p.id], onSliderInput))),
    advancedToggle,
    advancedSlot,
    assumptionNotesSlot,
    // [2026-08-25, 소유자 지시 8번] **다리(문구+버튼)를 뺐다** — 절세계좌
    // 탭으로의 연결은 이제 이 탭 전용 팝업(`ui/depletion-intro-modal.js`,
    // 소유자 지시 9번)의 하단 버튼이 대신 진다(탭이 활성화될 때 한 번,
    // `app.js`가 그 팝업을 띄운다). "당신은 얼마를 넣으세요"를 말하지
    // 않는다는 D84 판정 2 (b)의 원칙은 그 팝업 버튼 문구에도 그대로다
    // (`DEPLETION_POPUP_BRIDGE_BUTTON_LABEL` — 계좌 이름만 나열한다).
  ]);

  rerenderComputed();
  container.append(section);
}
