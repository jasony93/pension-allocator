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
  CHART_VIEW_WIDTH,
  CHART_VIEW_HEIGHT,
  CHART_PAD_LEFT,
  CHART_PAD_RIGHT,
  CHART_PAD_TOP,
  CHART_PAD_BOTTOM,
  computeDepletionChartLayout,
  formatTrillion,
} from '../depletion/chart-layout.js';
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

// [2026-08-25, 관리자 지시(9항목) 6번] `formatTrillion`은 이제
// `depletion/chart-layout.js`에서 온다(화면·이미지 저장이 공유하는 유일한
// 서식 함수) — 이 파일 안에 있던 거의 같은 정의를 지웠다.

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
//
// [2026-08-25, 관리자 지시(9항목) 6번] **기하 계산 전부를
// `depletion/chart-layout.js`(`computeDepletionChartLayout`)로 옮겼다** —
// 이미지 저장(`depletion/summary-image.js`)이 이 화면과 다른(옛) 모양을
// 그리고 있던 것이 원인이었다(소유자 지적). 이 파일은 이제 그 결과를
// DOM(`svgEl`)으로 그리기만 한다 — "어디에 무엇이 있는가"는 그 파일
// 하나에서만 나온다.
// ---------------------------------------------------------------------------

/**
 * [2026-08-25, 관리자 지시(9항목) 5번] **네이티브 `<title>` 대신 커스텀
 * 말풍선** — 막대는 `<title>` 없이 `aria-label`만 진다(같은 텍스트,
 * 스크린리더 대체 경로). 시각적 툴팁은 `depletionBarTooltip`(아래)이
 * hover 이벤트로 띄운다. 히스토그램 슬롯 계산 자체는
 * `chart-layout.js`의 `computeDepletionChartBarRects`(공유)에 있다.
 */
function buildDepletionChartBars(layout) {
  return layout.barRects.map(({ x, y, width, height, year, value }) =>
    svgEl('rect', {
      class: 'depletion-chart-bar',
      x: x.toFixed(1),
      y: y.toFixed(1),
      width: width.toFixed(1),
      height: height.toFixed(1),
      tabindex: '0',
      'aria-label': `${year}년: ${formatTrillion(value)}`,
      'data-year': year,
      'data-fund': formatTrillion(value),
    }),
  );
}

function buildDepletionChart(result) {
  const layout = computeDepletionChartLayout(result);
  const { firstYear, lastYear, depletionYear, yTicks, xTicks, vertexPoints, lineD, areaD, startPoint, marker } = layout;

  const yTickNodes = yTicks.flatMap(({ y, label }) => [
    svgEl('line', {
      class: 'depletion-chart-grid',
      x1: CHART_PAD_LEFT, x2: CHART_VIEW_WIDTH - CHART_PAD_RIGHT, y1: y.toFixed(1), y2: y.toFixed(1),
    }),
    svgEl('text', { class: 'depletion-chart-axis-label', x: CHART_PAD_LEFT - 8, y: (y + 4).toFixed(1), 'text-anchor': 'end' }, [label]),
  ]);

  // [2026-08-25, 소유자 지시(12항목) 11번] x축 연도 라벨 — 막대 위치와
  // 정확히 같은 자리에, 겹침 없는 부분집합(`xTicks`, `chart-layout.js`)을
  // 그대로 쓴다.
  const xTickNodes = xTicks.map(({ year, x }) =>
    svgEl('text', { class: 'depletion-chart-axis-label', x: x.toFixed(1), y: CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM + 18, 'text-anchor': 'middle' }, [
      String(year),
    ]),
  );

  // [2026-08-25, 소유자 지시(12항목) 10번] 데이터 점 — 막대 하나마다
  // 하나씩(=막대 꼭짓점), 매년이 아니다. hover 시 <title>(네이티브
  // 툴팁, 막대와 같은 관행)만 낸다.
  const pointNodes = vertexPoints.map(({ x, y, year, value }) =>
    svgEl('circle', { class: 'depletion-chart-point', cx: x.toFixed(1), cy: y.toFixed(1), r: 5 }, [
      svgEl('title', {}, [`${year}년: ${formatTrillion(value)}`]),
    ]),
  );

  // [2026-08-25, 소유자 지시(12항목) 7번] D85 적용 — 궤적은 실적
  // (`ACTUAL_FUND_BALANCE`)에서 출발한다. 점은 실제 시작점에, 글자는 그
  // 왼쪽(`text-anchor: end`)에 붙는다.
  const startLabelNode = svgEl('g', { class: 'depletion-chart-start' }, [
    svgEl('circle', { class: 'depletion-chart-start-point', cx: startPoint.x.toFixed(1), cy: startPoint.y.toFixed(1), r: 4 }),
    svgEl('text', { class: 'depletion-chart-start-label', x: (startPoint.x - 10).toFixed(1), y: (startPoint.y + 4).toFixed(1), 'text-anchor': 'end' }, [
      `${DEPLETION_CHART_START_LABEL_PREFIX} ${formatTrillion(ACTUAL_FUND_BALANCE.trillionKrw)}${DEPLETION_CHART_START_LABEL_SUFFIX}`,
    ]),
  ]);

  // [2026-08-25, 소유자 지시(12항목) 8번] 최대 적립금 시기의 세로 점선은
  // 뺀다 — 소진 점선만 남긴다.
  const markers = marker
    ? [
        svgEl('g', { class: 'depletion-chart-marker depletion-chart-marker-depletion' }, [
          svgEl('line', { x1: marker.x.toFixed(1), x2: marker.x.toFixed(1), y1: CHART_PAD_TOP, y2: CHART_VIEW_HEIGHT - CHART_PAD_BOTTOM }),
          svgEl('text', { x: marker.x.toFixed(1), y: CHART_PAD_TOP + 12, 'text-anchor': marker.anchor, dx: marker.dx }, [
            `소진 ${marker.depletionYear}년`,
          ]),
        ]),
      ]
    : [];

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
      ...buildDepletionChartBars(layout),
      svgEl('path', { class: 'depletion-chart-line', d: lineD, fill: 'none' }),
      ...markers,
      ...pointNodes,
      ...xTickNodes,
      startLabelNode,
    ],
  );
}

/**
 * [2026-08-25, 관리자 지시 — 소유자 지시(6항목) 5번] 본판 막대 hover
 * 툴팁 — 네이티브 `<title>`을 걷어내고(위 `buildDepletionChartBars`) 이
 * 커스텀 말풍선으로 바꾼다. **막대 위 고정**(마우스를 따라다니는 대신,
 * 소유자 지시 원문 "마우스 따라다니거나 막대 위 고정" 중 후자를 택했다
 * — 좌표를 매 `mousemove`마다 다시 잴 필요가 없어 더 단순하고 결정적
 * 이다). 흰 배경 + 주황 테두리, 다크에서는 표면 토큰(`--surface-raised`
 * — 라이트에서 이 토큰 자체가 흰색이라 별도 리터럴 없이 한 규칙으로
 * 두 요구를 함께 만족한다, `styles.css`).
 */
function depletionBarTooltip() {
  return el('div', { class: 'depletion-bar-tooltip', hidden: true, 'aria-hidden': 'true' }, ['']);
}

/**
 * 막대마다 hover(마우스)·focus(키보드) 이벤트를 걸어 `tooltip`을 그 막대
 * 위에 띄운다. `chartSlot`이 `patch`로 실제 DOM에 붙은 **뒤에** 불러야
 * `getBoundingClientRect()`가 뜻이 있다(0×0을 재는 D83 판정 1의 교훈과
 * 같은 종류의 함정 — "숨어 있거나 아직 안 붙은 요소"를 재면 항상 틀린
 * 값이 나온다).
 */
function wireDepletionBarTooltips(chartSlot, tooltip) {
  const bars = [...chartSlot.querySelectorAll('.depletion-chart-bar')];
  for (const bar of bars) {
    const show = () => {
      const rect = bar.getBoundingClientRect();
      tooltip.textContent = bar.getAttribute('aria-label');
      tooltip.hidden = false;
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.top = `${rect.top}px`;
    };
    const hide = () => {
      tooltip.hidden = true;
    };
    bar.addEventListener('mouseenter', show);
    bar.addEventListener('mouseleave', hide);
    bar.addEventListener('focus', show);
    bar.addEventListener('blur', hide);
  }
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
    const tooltipNode = depletionBarTooltip();
    patch(chartSlot, el('div', { class: 'depletion-chart-wrap' }, [buildDepletionChart(result), tooltipNode, chartActionsRow(), shareNote]));
    // [소유자 지시(6항목) 5번] `patch`가 방금 `chartSlot`을 실제 DOM에
    // 새로 붙였다 — 그 뒤에야 막대의 `getBoundingClientRect()`가 뜻이
    // 있으므로, 배선도 그 다음에 한다.
    wireDepletionBarTooltips(chartSlot, tooltipNode);
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
