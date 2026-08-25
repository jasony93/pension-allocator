/**
 * 「연금고갈 시뮬레이션」 계산 모델 — 순수 함수. `src/design/연금고갈_
 * 시뮬레이션.html`(소유자 초안)의 `run2()`를 그대로 옮기되, 상수는 전부
 * `./constants.js`에서 가져온다(D84 판정 2·4 — 출처가 상수 모듈 한 곳에
 * 모여야 검증·정정이 그 한 파일에서 갈린다).
 *
 * **DOM을 모르는 함수다.** 초안은 계산과 `document.getElementById(...)`
 * 갱신이 한 함수(`run2`) 안에 섞여 있었다 — 이 파일은 계산만 하고, 값을
 * 어디에 적을지는 `ui/depletion-panel.js`가 진다(이 저장소의 다른 계산
 * 모듈이 전부 그렇듯, 계산과 렌더를 같은 함수에 두지 않는다).
 */

import {
  BASE_RECIPIENTS_BREAKPOINTS_10K,
  SUBSCRIBER_SHOCK_WINDOWS,
  AGE_PHASE_IN_START_YEAR,
  AGE_PHASE_IN_END_YEAR,
  LIFE_PHASE_IN_START_YEAR,
  LIFE_PHASE_IN_END_YEAR,
  RECIPIENTS_PER_AGE_YEAR_DELTA,
  RECIPIENTS_PER_LIFE_YEAR_DELTA,
  INCOME_PER_AGE_YEAR_DELTA,
  OUTGO_PER_AGE_YEAR_DELTA,
  MATURATION_EFFECT_START_YEAR,
  MATURATION_EFFECT_END_YEAR,
  MATURATION_EFFECT_ANNUAL_RATE,
  BENEFIT_WAGE_BLEND_SHARE,
  INITIAL_FUND_TRILLION_KRW,
  INITIAL_SUBSCRIBERS_10K,
  EFFECTIVE_WAGE_BASE_PER_SUBSCRIBER,
  EFFECTIVE_BENEFIT_BASE_PER_RECIPIENT,
  SIMULATION_START_YEAR,
  SIMULATION_END_YEAR,
  YEARS_TO_DRAW_AFTER_DEPLETION,
  CONTRIBUTION_RATE_BASE_PERCENT,
  CONTRIBUTION_RATE_ANNUAL_STEP_PERCENT,
  CONTRIBUTION_RATE_BASE_YEAR,
  OFFICIAL_2030_CHECK,
  STATUTORY_AGE_CEILING_YEARS,
  LIFE_EXPECTANCY_BASELINE_YEARS,
} from './constants.js';

/** 수급자 수 기준 곡선 — 꺾은선 구간 보간(선형). 범위 밖은 양 끝값으로 고정한다. */
export function baseRecipients(year) {
  const points = BASE_RECIPIENTS_BREAKPOINTS_10K;
  if (year <= points[0][0]) return points[0][1];
  if (year >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [y0, v0] = points[i];
    const [y1, v1] = points[i + 1];
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0);
      return v0 + t * (v1 - v0);
    }
  }
  return points[points.length - 1][1];
}

/** 가입자 증감률에 얹는 충격 배수 — 해당 연도가 속하는 첫 구간의 배수. */
export function subscriberShockMultiplier(year) {
  for (const window of SUBSCRIBER_SHOCK_WINDOWS) {
    if (year < window.beforeYear) return window.multiplier;
  }
  return SUBSCRIBER_SHOCK_WINDOWS[SUBSCRIBER_SHOCK_WINDOWS.length - 1].multiplier;
}

/** 선형 전이(phase-in) — start 이전 0, end 이후 1, 사이는 선형. */
export function phaseIn(year, start, end) {
  if (year <= start) return 0;
  if (year >= end) return 1;
  return (year - start) / (end - start);
}

/** 제도 성숙 효과 — start까지 최댓값, end 이후 0으로 선형 감소. */
export function maturationRate(year) {
  if (year <= MATURATION_EFFECT_START_YEAR) return MATURATION_EFFECT_ANNUAL_RATE;
  if (year >= MATURATION_EFFECT_END_YEAR) return 0;
  return (
    MATURATION_EFFECT_ANNUAL_RATE *
    ((MATURATION_EFFECT_END_YEAR - year) / (MATURATION_EFFECT_END_YEAR - MATURATION_EFFECT_START_YEAR))
  );
}

/**
 * 그 해 수급자 수(만 명) — 수급개시연령·기대수명·수급자수 보정 세 손잡이가
 * 기준 곡선(`baseRecipients`)에 얹히는 몫을 한 곳에 모은다. `runDepletionSimulation`
 * 안에 인라인으로 있던 식을 그대로 뗀 것뿐, 등식은 바뀌지 않았다 — **단독
 * `export`로 여는 이유는 부호 검증**(소유자 지시 6번)이다. `ageDeltaYears`가
 * 음수(조기 수령, `age < STATUTORY_AGE_CEILING_YEARS`)일 때도 이 식 하나가
 * 그대로 방향을 뒤집어 맞게 낸다는 것을(수급자 수 증가) `simulate.test.mjs`가
 * 전체 시뮬레이션을 다시 돌리지 않고 이 함수만 불러 직접 잰다.
 *
 * @param {number} year
 * @param {{ ageDeltaYears: number, lifeDeltaYears: number, ben: number }} deltas
 */
export function recipientsForYear(year, { ageDeltaYears, lifeDeltaYears, ben }) {
  const ageProgress = phaseIn(year, AGE_PHASE_IN_START_YEAR, AGE_PHASE_IN_END_YEAR);
  const lifeProgress = phaseIn(year, LIFE_PHASE_IN_START_YEAR, LIFE_PHASE_IN_END_YEAR);
  return (
    baseRecipients(year) *
    (1 - RECIPIENTS_PER_AGE_YEAR_DELTA * ageDeltaYears * ageProgress) *
    (1 + RECIPIENTS_PER_LIFE_YEAR_DELTA * lifeDeltaYears * lifeProgress) *
    (1 + ben / 100)
  );
}

/**
 * 보험료율(%) — `CONTRIBUTION_RATE_BASE_PERCENT`에서 매년
 * `CONTRIBUTION_RATE_ANNUAL_STEP_PERCENT`씩 올라 슬라이더가 정한 최종치
 * (`finalRatePercent`)에서 멈춘다.
 */
export function contributionRatePercent(year, finalRatePercent) {
  const scheduled = CONTRIBUTION_RATE_BASE_PERCENT + CONTRIBUTION_RATE_ANNUAL_STEP_PERCENT * (year - CONTRIBUTION_RATE_BASE_YEAR);
  return Math.min(scheduled, finalRatePercent);
}

/**
 * @typedef {object} DepletionSimulationParams
 * @property {number} ror 기금운용수익률(%)
 * @property {number} rate 보험료율 최종치(%)
 * @property {number} sub 가입자 연평균 증감률(%)
 * @property {number} wage 임금상승률(%)
 * @property {number} cpi 물가상승률(%)
 * @property {number} life 기대수명 증가(년, 2070년까지)
 * @property {number} age 수급개시연령(세)
 * @property {number} ben 수급자수 보정(%)
 * @property {number} [initialFundTrillionKrw] 시작 적립기금(조원) — 생략하면
 *   `INITIAL_FUND_TRILLION_KRW`(전망 재현 기준값). 다른 재정추계 조건을
 *   재현하는 시험 전용 손잡이 — UI 슬라이더에는 없다.
 */

/**
 * 시뮬레이션을 한 번 돈다. 초안 `run2()`와 같은 등식·같은 반복 순서를
 * 그대로 따른다 — 등식의 방향·크기 검증은 tax-domain의 몫이다(D84 판정 4).
 *
 * @param {DepletionSimulationParams} params
 * @returns {{
 *   years: number[], fundsTrillionKrw: number[],
 *   depletionYear: number|null, deficitYear: number|null,
 *   maxFundTrillionKrw: number, checkpoint2030: {incomeTrillionKrw:number, outgoTrillionKrw:number, fundTrillionKrw:number}|null,
 * }}
 */
export function runDepletionSimulation(params) {
  const r = params.ror / 100;
  const wg = params.wage / 100;
  const cp = params.cpi / 100;
  // [2026-08-25, 소유자 지시 5·6번] **기준에서의 델타로 변환한다.** 화면
  // 슬라이더는 이제 절대값(수급개시연령 60~80세, 기대수명 84~100세)을
  // 보이지만, 아래 등식은 그대로 "기준에서 얼마나 벗어났는가"만 받는다 —
  // 등식 자체는 이 정정 전과 완전히 같다(기준값에서는 델타가 0이라 옛
  // 기본값과 결과가 그대로 재현된다, `simulate.test.mjs` regression lock).
  const ageDeltaYears = params.age - STATUTORY_AGE_CEILING_YEARS;
  const lifeDeltaYears = params.life - LIFE_EXPECTANCY_BASELINE_YEARS;

  let fund = params.initialFundTrillionKrw ?? INITIAL_FUND_TRILLION_KRW;
  let subscribers10k = INITIAL_SUBSCRIBERS_10K;
  let wageBase = EFFECTIVE_WAGE_BASE_PER_SUBSCRIBER;
  let benefitBase = EFFECTIVE_BENEFIT_BASE_PER_RECIPIENT;

  const years = [];
  const fundsTrillionKrw = [];
  let depletionYear = null;
  let deficitYear = null;
  let maxFundTrillionKrw = fund;
  let checkpoint2030 = null;

  for (let year = SIMULATION_START_YEAR; year <= SIMULATION_END_YEAR; year++) {
    const contributionRate = contributionRatePercent(year, params.rate) / 100;
    // [2026-08-25] `ageProgress`는 아래 소득·지출 식에도 그대로 쓰인다 —
    // `lifeProgress`는 `recipientsForYear`가 자기 안에서 다시 구하므로(위
    // 함수 정의) 여기서는 더 이상 따로 두지 않는다(중복 계산 하나뿐이라
    // 성능에 영향 없다, 이 루프는 최대 90회 안팎이다).
    const ageProgress = phaseIn(year, AGE_PHASE_IN_START_YEAR, AGE_PHASE_IN_END_YEAR);

    const recipients10k = recipientsForYear(year, { ageDeltaYears, lifeDeltaYears, ben: params.ben });
    const incomeTrillionKrw = subscribers10k * (1 + INCOME_PER_AGE_YEAR_DELTA * ageDeltaYears * ageProgress) * wageBase * 12 * contributionRate * 0.01;
    const outgoTrillionKrw = recipients10k * benefitBase * (1 + OUTGO_PER_AGE_YEAR_DELTA * ageDeltaYears * ageProgress) * 12 * 0.01;

    // [2026-08-24, tax-rules-report.md 33.4 — 정정 1] 수지 적자 전환은 **그
    // 해 시작 잔액**(아직 갱신 전인 `fund`)의 운용수익을 근거로 판정한다 —
    // 제5차 재정추계 각주("당년도 지출이 총수입(보험료수입+기금투자수익)
    // 보다 커지는 시점")와 같은 정의다. 이 판정은 잔액 갱신 **앞**에서 해야
    // 옳다(33.4 "다섯째 — defY는 맞다").
    if (deficitYear === null && outgoTrillionKrw > incomeTrillionKrw + fund * r) deficitYear = year;

    // [2026-08-24, tax-rules-report.md 33.4 — 정정 1] **기록을 갱신 뒤로
    // 옮긴다.** 초안은 `fund`를 "그 해 시작(=전년도 말) 잔액"인 채로
    // 차트·최대적립금·2030 검증에 기록했다 — 세 표시 전부 실제보다 1년
    // 이르게 보였다(2030년 표시가 실제로는 2029년 말, 검증 오차 −5.24%로
    // 보이던 것의 정체). 갱신을 먼저 하면 `fund`가 "그 해 **말**" 잔액이
    // 되어 세 표시가 동시에 맞는다(2030 오차가 −0.27%로 준다).
    fund = fund * (1 + r) + incomeTrillionKrw - outgoTrillionKrw;

    years.push(year);
    fundsTrillionKrw.push(Math.max(fund, 0));
    if (fund > maxFundTrillionKrw) maxFundTrillionKrw = fund;
    if (year === OFFICIAL_2030_CHECK.year) {
      checkpoint2030 = { incomeTrillionKrw, outgoTrillionKrw, fundTrillionKrw: fund };
    }

    // [2026-08-24, tax-rules-report.md 33.4 — 정정 2] **소진연도 관례.**
    // 초안은 `year + 1`로 적어 공식 관례("연말 잔액이 음수인 그 해")보다
    // 일관되게 1년 늦게 불렀다(제5차 재정추계 "기금소진 시점 2055년(△47조)"
    // — 괄호 안이 그 해의 적립기금 규모, 즉 연말 잔액이 음수인 해 자체가
    // 소진연도). 갱신을 먼저 했으므로 이 시점의 `fund`는 이미 `year`년
    // 말 값이다 — `depletionYear = year`.
    if (fund < 0 && depletionYear === null) depletionYear = year;
    if (depletionYear !== null && year >= depletionYear + YEARS_TO_DRAW_AFTER_DEPLETION) break;

    subscribers10k *= 1 + (params.sub / 100) * subscriberShockMultiplier(year);
    wageBase *= 1 + wg;
    benefitBase *= 1 + cp + BENEFIT_WAGE_BLEND_SHARE * (wg - cp) + maturationRate(year);
  }

  return { years, fundsTrillionKrw, depletionYear, deficitYear, maxFundTrillionKrw, checkpoint2030 };
}
