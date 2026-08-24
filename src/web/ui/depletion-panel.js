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
  STATUTORY_RATE_CEILING_PERCENT,
  STATUTORY_AGE_CEILING_YEARS,
} from '../depletion/constants.js';
import {
  DEPLETION_BRIDGE_NOTE,
  DEPLETION_BRIDGE_LINK_LABEL,
  DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL,
  DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL,
  DEPLETION_CARD_DEPLETION_LABEL,
  DEPLETION_CARD_DEFICIT_LABEL,
  DEPLETION_CARD_MAX_FUND_LABEL,
  DEPLETION_CORE_ASSUMPTIONS_HEADING,
  DEPLETION_ACTUAL_FUND_NOTE_PREFIX,
  DEPLETION_RECIPIENTS_CURVE_NOTE,
  DEPLETION_RATE_ASSUMPTION_NOTE,
  DEPLETION_AGE_ASSUMPTION_NOTE,
} from '../depletion-copy.js';

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

function outcomeCard(label, valueText) {
  return el('div', { class: 'depletion-card' }, [
    el('div', { class: 'depletion-card-label' }, [label]),
    el('div', { class: 'depletion-card-value' }, [valueText]),
  ]);
}

/**
 * 2030년 검증 줄 — 모델이 낸 2030년 값과 대조 전망치를 나란히 보인다
 * (D84 판정 4). 대조 값은 `depletion/constants.js`의 `OFFICIAL_2030_CHECK`
 * 하나에서만 온다 — 이 파일이 숫자를 다시 쓰지 않는다.
 *
 * [2026-08-24, tax-rules-report.md 33절 관리자 판정] **"공식"이라는 뭉뚱그린
 * 라벨을 쓰지 않는다.** 이 대조 앵커의 출처는 국민연금연구원 중기재정전망
 * (2026~2030)이지 제5차 재정추계가 아니다 — 핵심 가정(수익률·임금 등)의
 * 출처인 제5차와 한 화면에서 섞이지 않도록 출처를 문장으로 명시한다.
 */
function validationLine(checkpoint2030) {
  if (!checkpoint2030) return el('div', { class: 'depletion-validation' }, ['2030년 검증 — 시뮬레이션이 그 해를 지나지 않았습니다.']);
  return el('div', { class: 'depletion-validation' }, [
    el('span', { class: 'depletion-validation-heading' }, ['2030년 검증']),
    ' · 보험료수입 ',
    `${checkpoint2030.incomeTrillionKrw.toFixed(1)}조`,
    ' ',
    el('span', { class: 'depletion-validation-official' }, [`(전망 ${OFFICIAL_2030_CHECK.incomeTrillionKrw}조)`]),
    ' · 급여지출 ',
    `${checkpoint2030.outgoTrillionKrw.toFixed(1)}조`,
    ' ',
    el('span', { class: 'depletion-validation-official' }, [`(전망 ${OFFICIAL_2030_CHECK.outgoTrillionKrw}조)`]),
    ' · 적립금 ',
    formatTrillion(checkpoint2030.fundTrillionKrw),
    ' ',
    el('span', { class: 'depletion-validation-official' }, [`(전망 ${OFFICIAL_2030_CHECK.fundTrillionKrw.toLocaleString('ko-KR')}조)`]),
    el('div', { class: 'depletion-validation-source type-caption' }, [`대조 출처 — ${OFFICIAL_2030_CHECK.source}`]),
  ]);
}

/**
 * 출발값·수급자 곡선의 한계를 밝히는 상시 고지 두 줄(33.7, 33.8 #21) —
 * 슬라이더와 무관하게 항상 보인다.
 */
function staticSourceNotes() {
  return el('div', { class: 'depletion-static-notes' }, [
    el('p', { class: 'depletion-static-note type-caption' }, [
      `${DEPLETION_ACTUAL_FUND_NOTE_PREFIX}(${ACTUAL_FUND_BALANCE.asOf} ${Math.round(ACTUAL_FUND_BALANCE.trillionKrw).toLocaleString('ko-KR')}조원, ${ACTUAL_FUND_BALANCE.source.split(' · ')[0]}).`,
    ]),
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
const CHART_PAD_LEFT = 56;
const CHART_PAD_RIGHT = 16;
const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 30;

function niceMaxScale(rawMax) {
  if (rawMax <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(rawMax));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= rawMax) return candidate;
  }
  return 10 * magnitude;
}

function buildDepletionChart(result) {
  const { years, fundsTrillionKrw, depletionYear, deficitYear } = result;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const maxScale = niceMaxScale(Math.max(...fundsTrillionKrw) * 1.05);
  const innerWidth = CHART_VIEW_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT;
  const innerHeight = CHART_VIEW_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const xOf = (year) => CHART_PAD_LEFT + (lastYear === firstYear ? 0 : ((year - firstYear) / (lastYear - firstYear)) * innerWidth);
  const yOf = (value) => CHART_PAD_TOP + (1 - value / maxScale) * innerHeight;
  const baselineY = yOf(0);

  const points = years.map((year, i) => [xOf(year), yOf(fundsTrillionKrw[i])]);
  const lineD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${points[points.length - 1][0].toFixed(1)},${baselineY.toFixed(1)} L${points[0][0].toFixed(1)},${baselineY.toFixed(1)} Z`;

  // y축 눈금 — 0부터 maxScale까지 4등분.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxScale);
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

  // x축 눈금 — 최대 8개, 균등 간격(정수 연도로 반올림).
  const xTickCount = Math.min(8, years.length);
  const xTickNodes = [];
  for (let i = 0; i < xTickCount; i++) {
    const year = Math.round(firstYear + ((lastYear - firstYear) * i) / Math.max(1, xTickCount - 1));
    const x = xOf(year);
    xTickNodes.push(
      svgEl('text', { class: 'depletion-chart-axis-label', x: x.toFixed(1), y: CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM + 18, 'text-anchor': 'middle' }, [
        String(year),
      ]),
    );
  }

  // 데이터 점 — hover 시 <title>(네이티브 툴팁)만 낸다. 전부 그리면
  // 촘촘해 보이므로 3년 간격으로만 그린다(선 자체는 전부 그린다 — 눈금이
  // 성긴 것과 궤적이 성긴 것은 다르다).
  const hoverPoints = points
    .map((p, i) => ({ p, year: years[i], fund: fundsTrillionKrw[i] }))
    .filter((_, i) => i % 3 === 0 || i === points.length - 1);
  const pointNodes = hoverPoints.map(({ p, year, fund }) =>
    svgEl('circle', { class: 'depletion-chart-point', cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 7 }, [
      svgEl('title', {}, [`${year}년: ${formatTrillion(fund)}`]),
    ]),
  );

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
  if (deficitYear != null && deficitYear <= lastYear && deficitYear !== depletionYear) {
    const x = xOf(deficitYear);
    markers.push(
      svgEl('g', { class: 'depletion-chart-marker depletion-chart-marker-deficit' }, [
        svgEl('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: CHART_PAD_TOP, y2: CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM }),
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
      svgEl('path', { class: 'depletion-chart-line', d: lineD, fill: 'none' }),
      ...markers,
      ...pointNodes,
      ...xTickNodes,
    ],
  );
}

// ---------------------------------------------------------------------------
// 마운트
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {{ onBridgeToCalc2: () => void }} options
 */
export function mountDepletionPanel(container, { onBridgeToCalc2 } = {}) {
  const values = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));
  const cardsSlot = el('div', { class: 'depletion-cards' });
  const validationSlot = el('div', { class: 'depletion-validation-slot' });
  const chartSlot = el('div', { class: 'depletion-chart-wrap' });
  const assumptionNotesSlot = el('div', { class: 'depletion-assumption-notes-slot' });
  let advancedOpen = false;

  function rerenderComputed() {
    const result = runDepletionSimulation(values);
    patch(
      cardsSlot,
      el('div', { class: 'depletion-cards' }, [
        outcomeCard(DEPLETION_CARD_DEPLETION_LABEL, result.depletionYear ? `${result.depletionYear}년` : '소진 없음'),
        outcomeCard(DEPLETION_CARD_DEFICIT_LABEL, result.deficitYear ? `${result.deficitYear}년` : '없음'),
        outcomeCard(DEPLETION_CARD_MAX_FUND_LABEL, formatTrillion(result.maxFundTrillionKrw)),
      ]),
    );
    patch(validationSlot, el('div', { class: 'depletion-validation-slot' }, [validationLine(result.checkpoint2030)]));
    patch(chartSlot, el('div', { class: 'depletion-chart-wrap' }, [buildDepletionChart(result)]));
    patch(assumptionNotesSlot, el('div', { class: 'depletion-assumption-notes-slot' }, [assumptionBoundaryNotes(values)]));
  }

  function onSliderInput(id, value) {
    values[id] = value;
    rerenderComputed();
  }

  const advancedSlot = el('div', { class: 'depletion-sliders depletion-sliders-advanced', hidden: true }, ADVANCED_PARAMS.map((p) => sliderRow(p, values[p.id], onSliderInput)));
  const advancedToggle = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary depletion-advanced-toggle',
      'aria-expanded': 'false',
      onclick: () => {
        advancedOpen = !advancedOpen;
        advancedSlot.hidden = !advancedOpen;
        advancedToggle.setAttribute('aria-expanded', String(advancedOpen));
        advancedToggle.textContent = advancedOpen ? DEPLETION_ADVANCED_TOGGLE_CLOSE_LABEL : DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL;
      },
    },
    [DEPLETION_ADVANCED_TOGGLE_OPEN_LABEL],
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
    // [D84 판정 2b] 다리 — 사실 문장 + 링크. "당신은 얼마를 넣으세요"를
    // 말하지 않는다, 개인 금액을 계산하지 않는다.
    el('div', { class: 'depletion-bridge' }, [
      el('p', { class: 'depletion-bridge-note type-body-s' }, [
        DEPLETION_BRIDGE_NOTE,
      ]),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary depletion-bridge-link',
          onclick: () => onBridgeToCalc2?.(),
        },
        [DEPLETION_BRIDGE_LINK_LABEL],
      ),
    ]),
  ]);

  rerenderComputed();
  container.append(section);
}
