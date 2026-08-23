/**
 * 연금 역산기 탭의 예시 블록. `screens.md` 14.1.1절 · `design-system.md`
 * 5.32.1절(게이트 5 D78 ②) — `ExampleShowcase`(첫 탭, `example-showcase.js`)를
 * **컴포넌트 그대로 재사용**하고 탭별로 내용만 바꾼다는 원칙에 따라, 이
 * 파일은 그 파일의 자산(man-icon·화살표·shadow root 부착 방식)을 그대로
 * 가져다 쓰되 계산·본문은 이 탭 전용으로 새로 짠다 — 두 탭이 서로 다른
 * 엔진 진입점(`compute` vs `computePensionReverse`)을 쓰고 산출물의 모양이
 * 다르기 때문에(단일 헤드라인 금액이 없다) 완전히 같은 함수로 합칠 수 없다.
 *
 * **표시 조건 — 「절세계좌 계산기」 탭이 활성일 때는 숨긴다.** 첫 탭의
 * 예시(김철수씨·소득 4,000만원 구도)가 역산기 탭 위에 그대로 보이는 회귀를
 * 관리자가 번들 실측에서 잡았다(`ui/app.js`의 `exampleSlot`/`reverseExampleSlot`
 * 표시 전환 참고) — 이 블록은 그 반대(연금 역산기 탭 전용)다.
 */

import { el, svgEl } from './dom.js';
import {
  donutChart,
  donutLegend,
  applyDonutSliceInlineLabels,
  watchDonutThemeChange,
  prefersReducedMotion,
} from './charts.js';
import { sourceAllocations } from './reverse-shared.js';
import { MAN_ICON_DATA_URI, MAN_ICON_INTRINSIC_WIDTH, MAN_ICON_INTRINSIC_HEIGHT } from '../assets/man-icon.js';
import { exampleBirthDate, EXAMPLE_PERSONA_NAME } from './example-showcase.js';
import { TAX_YEAR } from '../state/store.js';
import { todayIsoDate } from '../state/reverse-store.js';
import { SCHEMA_VERSION } from '../engine/engine-client.js';

/** 게이트 5 D78 ② — 소유자가 고정한 세 값. 하드코딩하는 것은 **입력**뿐이다 — 결과값은 전부 엔진이 낸다. */
export const REVERSE_EXAMPLE_AGE_YEARS = 30;
export const REVERSE_EXAMPLE_ANNUITY_START_AGE_YEARS = 60;
export const REVERSE_EXAMPLE_TARGET_MONTHLY_KRW = 2000000;
/**
 * `payout_years`(연금 필요 기간)는 D78 ②가 명시한 세 줄에 없다 — 그러나
 * `computePensionReverse`는 이 값 없이는 계산할 수 없는 필수 입력이다
 * (`engine-interface.md` 12.2절). 화면에 표시하지 않는 계산 전용 상수로
 * 둔다 — `screens.md` 14.2절 입력 폼의 예시 값(20년)과 같은 수를 골라
 * 근거 없는 임의의 수로 보이지 않게 했다. **`open_questions`에 남긴다**
 * (design-system 5.32.1절이 이 값을 다루지 않는다).
 */
export const REVERSE_EXAMPLE_PAYOUT_YEARS = 20;

/** 무성장(연 0%) 기준 — 사용자 입력 필드의 기본값 금지(D77 판정 1)와는 다른 자리다. 예시 전용 상수다. */
export const REVERSE_EXAMPLE_RETURN_RATE = 0;

export function reverseExampleRequest() {
  return {
    schema_version: SCHEMA_VERSION,
    tax_year: TAX_YEAR,
    as_of_date: todayIsoDate(),
    profile: {
      birth_date: exampleBirthDate(TAX_YEAR),
      target_monthly_income_krw: REVERSE_EXAMPLE_TARGET_MONTHLY_KRW,
      annuity_start: { kind: 'age', age_years: REVERSE_EXAMPLE_ANNUITY_START_AGE_YEARS },
      payout_years: REVERSE_EXAMPLE_PAYOUT_YEARS,
      average_annual_return_rate: REVERSE_EXAMPLE_RETURN_RATE,
      public_pension: { plan: 'unknown', expected_monthly_krw: null },
      other_income: { state: 'unknown', annual_krw: null },
      deferred_retirement: { present: null, amount_krw: null },
    },
    accounts: {
      annuity_savings: { balance_krw: 0 },
      retirement_pension: { balance_krw: 0 },
      isa: { balance_krw: 0, years_since_opening: null, cumulative_contribution_krw: null, conversion_planned: null },
    },
  };
}

/** 실제 엔진 호출. 예시 전용 엔진도, 별도 목도 없다 — `example-showcase.js`의 `computeExampleScenario`와 같은 원칙. */
export async function computeReverseExampleScenario(engineClient) {
  const response = await engineClient.computePensionReverse(reverseExampleRequest());
  if (!response.ok) {
    throw new Error(`reverse_example_showcase_compute_failed:${response.errors?.[0]?.code ?? 'unknown'}`);
  }
  if (!response.contribution_scenario) {
    throw new Error('reverse_example_showcase_no_scenario');
  }
  return response;
}

export function reverseExampleInputLineTexts() {
  return [
    `나이: 만 ${REVERSE_EXAMPLE_AGE_YEARS}세`,
    `연금개시일: 만 ${REVERSE_EXAMPLE_ANNUITY_START_AGE_YEARS}세`,
    `월 연금 수령액: ${(REVERSE_EXAMPLE_TARGET_MONTHLY_KRW / 10000).toLocaleString('ko-KR')}만원`,
  ];
}

/** 물음 줄 — screens.md 14.1.1절 다이어그램의 문구 그대로. */
export const REVERSE_EXAMPLE_QUESTION_TEXT = `${EXAMPLE_PERSONA_NAME}가 만 ${REVERSE_EXAMPLE_ANNUITY_START_AGE_YEARS}세부터 매달 ${(REVERSE_EXAMPLE_TARGET_MONTHLY_KRW / 10000).toLocaleString('ko-KR')}만원을 받으려면, 지금부터 계좌마다 얼마씩 넣어야 할까요?`;

/** 무성장 조건절 — 접지 않고 항상 표시한다(design-system 5.32.1절, screens.md 14.1.1절 규약 2). */
export const REVERSE_EXAMPLE_ZERO_GROWTH_NOTE = '연 0%(무성장) 기준으로 계산했습니다';

function scrollToReverseInput() {
  if (typeof document === 'undefined') return;
  // `document.querySelector('.app-main')`은 DOM 순서상 항상 첫 탭(절세계좌
  // 계산기)의 패널을 먼저 찾는다 — 이 예시는 역산기 탭 전용이므로 id로
  // 그 탭의 패널을 직접 겨눈다(`ui/app.js`의 `tabpanel-pension-reverse`).
  const target = document.getElementById('tabpanel-pension-reverse');
  if (!target || typeof target.scrollIntoView !== 'function') return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/**
 * 첫 탭 화살표(`example-showcase.js`의 `exampleShowcaseScrollArrowIcon`)와
 * **정확히 같은 SVG 마크업**을 다시 짠다 — `svgEl`(네임스페이스 있는 DOM
 * 생성자)이 필요해 `innerHTML` 문자열 삽입으로 대신할 수 없다(SVG는
 * `document.createElement`로 만들면 그려지지 않는다). 시각 문법은 같은
 * CSS 클래스(`example-showcase-scroll-arrow*`)가 보증한다.
 */
function reverseExampleScrollArrowIcon() {
  return svgEl(
    'svg',
    { viewBox: '0 0 100 100', class: 'example-showcase-scroll-arrow-icon', 'aria-hidden': 'true', focusable: 'false' },
    [
      svgEl('circle', {
        class: 'example-showcase-scroll-arrow-ring',
        cx: 50, cy: 50, r: 42,
        fill: 'none', stroke: 'currentColor', 'stroke-width': 7,
      }),
      svgEl('path', {
        class: 'example-showcase-scroll-arrow-glyph',
        d: 'M50,27 L50,64 M34,45 L50,64 L66,45',
        fill: 'none', stroke: 'currentColor', 'stroke-width': 9,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }),
    ],
  );
}

function reverseExampleScrollArrow() {
  const icon = reverseExampleScrollArrowIcon();
  const button = el(
    'button',
    { type: 'button', class: 'example-showcase-scroll-arrow', 'aria-label': '아래 입력·결과 구역으로 이동' },
    [icon],
  );
  button.addEventListener('click', scrollToReverseInput);
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    scrollToReverseInput();
  });
  return button;
}

function reverseExampleShowcaseSection(response) {
  const includedAllocations = sourceAllocations(response.contribution_scenario.allocations);
  const totalMonthlyKrw = includedAllocations.reduce((sum, a) => sum + a.monthly_krw, 0);
  const donutArgs = { allocations: includedAllocations, unallocatedAnnualKrw: 0, unallocatedMonthlyKrw: 0 };
  const donut = donutChart({
    ...donutArgs,
    totalAllocatedMonthlyKrw: totalMonthlyKrw,
    labelMode: 'legend',
  });

  const iconCol = el('div', { class: 'example-showcase-input-icon-col' }, [
    el('img', {
      class: 'example-showcase-input-icon',
      src: MAN_ICON_DATA_URI,
      alt: '',
      width: MAN_ICON_INTRINSIC_WIDTH,
      height: MAN_ICON_INTRINSIC_HEIGHT,
      'aria-hidden': 'true',
    }),
    el('p', { class: 'example-showcase-input-name' }, [EXAMPLE_PERSONA_NAME]),
  ]);
  const inputBlock = el('div', { class: 'example-showcase-input-block' }, [
    iconCol,
    el(
      'div',
      { class: 'example-showcase-input-lines' },
      reverseExampleInputLineTexts().map((line) => el('p', { class: 'example-showcase-input-line' }, [line])),
    ),
  ]);
  const textCol = el('div', { class: 'example-showcase-text-col' }, [
    el('h2', { class: 'example-showcase-question', id: 'reverse-example-showcase-question' }, [
      el('span', { class: 'example-showcase-question-text' }, [REVERSE_EXAMPLE_QUESTION_TEXT]),
    ]),
    inputBlock,
  ]);

  // "amount" 그리드 영역을 그대로 쓰되(design-system 5.32.1절 — 새 그리드를
  // 만들지 않는다), `AmountCard` 대신 무성장 조건절을 놓는다 — 이 탭에는
  // 단일 헤드라인 금액이 없다(`requirements.md` 9.0절).
  const conditionBlock = el('div', { class: 'example-showcase-amount reverse-example-showcase-condition' }, [
    el('p', { class: 'type-body-strong' }, [REVERSE_EXAMPLE_ZERO_GROWTH_NOTE]),
  ]);

  const visualCol = el('div', { class: 'example-showcase-visual-col' }, [
    el('p', { class: 'example-showcase-visual-heading' }, ['이렇게 넣어보세요']),
    donut,
    donutLegend(donutArgs),
  ]);

  const arrowWrap = el('div', { class: 'example-showcase-arrow-wrap' }, [
    reverseExampleScrollArrow(),
    el('p', { class: 'example-showcase-arrow-caption' }, ['나는 어떻게 넣지?']),
  ]);

  return el('section', { class: 'example-showcase', 'aria-labelledby': 'reverse-example-showcase-question' }, [
    textCol,
    conditionBlock,
    visualCol,
    arrowWrap,
  ]);
}

/**
 * 마운트 지점. `attachReverseExampleHostStyles`(shadow root에 메인 문서 스타일을 복제하는
 * 로직)를 이 파일이 다시 두지 않고, 호출부(`ui/app.js`)가 첫 탭과 같은
 * `mountExampleShowcase`의 shadow-root 부착 패턴을 재사용하도록 이 함수
 * 자신이 그 작업을 진다 — `example-showcase.js`의 `attachReverseExampleHostStyles`는
 * 모듈 비공개라 그대로 가져다 쓸 수 없어, 같은 셀렉터·같은 순서로 다시
 * 짠다(로직은 그 파일과 바이트 단위로 같다 — 두 파일이 갈라지면
 * `qa`가 잡아야 한다는 사실을 여기 남긴다).
 */
function attachReverseExampleHostStyles(shadowRoot) {
  const nodes = [...document.querySelectorAll('style, link[rel="stylesheet"]')];
  const loadWaits = [];
  for (const node of nodes) {
    if (node.tagName === 'STYLE') {
      const clone = document.createElement('style');
      clone.textContent = node.textContent;
      shadowRoot.appendChild(clone);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href;
      shadowRoot.appendChild(link);
      loadWaits.push(
        new Promise((resolve) => {
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', resolve, { once: true });
        }),
      );
    }
  }
  if (nodes.length === 0) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './styles.css';
    shadowRoot.appendChild(link);
    loadWaits.push(
      new Promise((resolve) => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      }),
    );
  }
  return Promise.all(loadWaits);
}

export async function mountReverseExampleShowcase(hostEl, { engineClient }) {
  if (!hostEl || typeof hostEl.attachShadow !== 'function') return;
  const shadowRoot = hostEl.shadowRoot ?? hostEl.attachShadow({ mode: 'open' });
  shadowRoot.replaceChildren();
  const stylesReady = attachReverseExampleHostStyles(shadowRoot);
  try {
    const [response] = await Promise.all([computeReverseExampleScenario(engineClient), stylesReady]);
    shadowRoot.appendChild(reverseExampleShowcaseSection(response));
    // [2026-08-23, D83 판정 1] `forceOutside: true` — 상설 규칙("라벨은 어떤
    // 화면에서도 차트와 겹치지 않는다")이 이 화면을 명시로 짚었다(소유자
    // 지시 "역산기 예시"). 조각 안에 들어가면 안에 그리던 예전 동작(옵션
    // 없이 호출)은 큰 조각(예: "연금저축82%")에서 라벨이 고리 안쪽에
    // 놓여 규칙과 충돌한다 — 첫 탭 예시(`example-showcase.js`, D79 판정 4)가
    // 이미 같은 이유로 이 옵션을 쓴다. 두 "예시" 화면을 같은 규칙으로
    // 맞춘다.
    applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true });
    watchDonutThemeChange(() => applyDonutSliceInlineLabels(shadowRoot, { forceOutside: true }));
  } catch (err) {
    console.error('[reverse-example-showcase] 예시를 계산하지 못했습니다', err);
  }
}
