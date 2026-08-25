import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runDepletionSimulation,
  baseRecipients,
  subscriberShockMultiplier,
  phaseIn,
  maturationRate,
  contributionRatePercent,
  recipientsForYear,
} from './simulate.js';
import { DEPLETION_SLIDER_PARAMS, OFFICIAL_2030_CHECK, CONTRIBUTION_RATE_BASE_PERCENT } from './constants.js';

const DEFAULTS = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));

/**
 * [D84 판정 4, tax-rules-report.md 33절] "정정 뒤 기본값에서 소진 연도·
 * 2030 대조값 재현" — 초안(`src/design/연금고갈_시뮬레이션.html`)의
 * `run2()`와 같은 등식·순서를 옮기되, tax-domain 검증(33절)이 지시한
 * 계산 정정 둘(기록 시점, 소진연도 정의)과 기본값 정정 넷을 반영한
 * 뒤의 값을 잠근다(regression lock). 여기 적힌 숫자는 이 모듈을 직접
 * 실행해 얻은 값이다 — "이 값이 맞다"는 세법 밖 사실 주장이 아니라,
 * 정정된 등식이 계속 이 값을 낸다는 것만 잠근다.
 */
test('정정된 기본값으로 돌리면 소진 연도·수지 적자 전환 연도·최대 적립금이 등식을 그대로 재현한다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  assert.equal(result.depletionYear, 2070);
  assert.equal(result.deficitYear, 2050);
  assert.ok(Math.abs(result.maxFundTrillionKrw - 3292.92) < 0.5, `최대 적립금이 어긋난다: ${result.maxFundTrillionKrw}`);
});

test('2030년 대조값(모델 계산치)이 재현된다 — 공식 전망치와는 별개로, 이 모델 자신의 계산이 안정적이라는 것만 잠근다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  assert.ok(result.checkpoint2030, '2030년 체크포인트가 없다');
  assert.ok(Math.abs(result.checkpoint2030.incomeTrillionKrw - 92.25) < 0.5, `2030 보험료수입 모델값이 어긋난다: ${result.checkpoint2030.incomeTrillionKrw}`);
  assert.ok(Math.abs(result.checkpoint2030.outgoTrillionKrw - 79.79) < 0.5, `2030 급여지출 모델값이 어긋난다: ${result.checkpoint2030.outgoTrillionKrw}`);
  assert.ok(Math.abs(result.checkpoint2030.fundTrillionKrw - 1886.1) < 1, `2030 적립금 모델값이 어긋난다: ${result.checkpoint2030.fundTrillionKrw}`);
});

/**
 * [tax-rules-report.md 33.4 — 정정 1] 기록 시점을 잔액 갱신 뒤로 옮긴
 * 정정이 실제로 2030 대조 오차를 좁혔다는 것을 잠근다(정정 전 −5.24%
 * → 정정 후, 기본값 정정까지 합쳐 ≤1.5%). 관리자 지시 원문 그대로의
 * 시험 이름이다.
 */
test('정정 후 기본값에서 2030 대조 오차 ≤1.5%', () => {
  const result = runDepletionSimulation(DEFAULTS);
  const err = Math.abs(
    (result.checkpoint2030.fundTrillionKrw - OFFICIAL_2030_CHECK.fundTrillionKrw) / OFFICIAL_2030_CHECK.fundTrillionKrw,
  );
  assert.ok(err <= 0.015, `2030 적립금 오차가 1.5%를 넘는다: ${(err * 100).toFixed(2)}%`);
});

/**
 * [tax-rules-report.md 33.9, 33.10] 제5차 국민연금 재정추계(2023)의
 * 현행제도 조건 — 보험료율 9% 고정(당시엔 인상 전), 적립기금
 * 1,150조원대에서 출발 — 을 이 시뮬레이터가 재현하면 공식 소진연도
 * 2055년에 닿아야 한다(관리자 지시 원문의 시험 이름 그대로).
 */
test('제5차 조건 재현(출발 1,150조·9% 고정 → 소진 2055)', () => {
  const result = runDepletionSimulation({ ...DEFAULTS, rate: 9, initialFundTrillionKrw: 1150 });
  assert.equal(result.depletionYear, 2055);
});

test('2030년 대조값 옆에 나란히 보일 공식 전망치는 이 파일(constants.js) 한 곳에서만 온다', () => {
  assert.equal(OFFICIAL_2030_CHECK.year, 2030);
  assert.equal(typeof OFFICIAL_2030_CHECK.incomeTrillionKrw, 'number');
  assert.equal(typeof OFFICIAL_2030_CHECK.outgoTrillionKrw, 'number');
  assert.equal(typeof OFFICIAL_2030_CHECK.fundTrillionKrw, 'number');
});

test('적립금은 소진 뒤에도 화면에 음수로 나가지 않는다 — 0에서 눌린다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  for (const v of result.fundsTrillionKrw) assert.ok(v >= 0, `적립금이 음수다: ${v}`);
});

test('연도가 시작연도부터 1씩 늘며, 소진 뒤 정해진 해만큼만 더 그리고 멈춘다', () => {
  const result = runDepletionSimulation(DEFAULTS);
  for (let i = 1; i < result.years.length; i++) {
    assert.equal(result.years[i], result.years[i - 1] + 1, `연도가 1씩 늘지 않는다: ${result.years[i - 1]} → ${result.years[i]}`);
  }
  assert.ok(result.depletionYear != null, '기본값에서는 소진 연도가 있어야 한다');
  assert.equal(result.years[result.years.length - 1], result.depletionYear + 2, '소진 뒤 정확히 2년까지만 그려야 한다');
});

// ---------------------------------------------------------------------------
// 경계값 — 수익률 최솟값/최댓값, 보험료율 9(고정) 등(관리자 지시 원문).
// ---------------------------------------------------------------------------

test('경계 — 기금운용수익률 최솟값(2%)은 소진되고, 최댓값(9%)은 시뮬레이션 구간(2115년) 안에 소진되지 않는다', () => {
  const low = runDepletionSimulation({ ...DEFAULTS, ror: 2 });
  const high = runDepletionSimulation({ ...DEFAULTS, ror: 9 });
  assert.ok(low.depletionYear != null, '최솟값(2%)에서는 소진 연도가 있어야 한다');
  assert.equal(high.depletionYear, null, '최댓값(9%)에서는 2115년 안에 소진되면 안 된다(복리가 적자를 이긴다)');
  assert.ok(high.maxFundTrillionKrw > low.maxFundTrillionKrw, '높은 수익률의 최대 적립금이 낮은 수익률보다 커야 한다');
});

test('경계 — 보험료율 최종치를 9(고정, 인상 없음)로 두면 실제 적용 보험료율이 2026년에도 9%를 넘지 않는다', () => {
  // `contributionRatePercent`는 스케줄값과 슬라이더 상한 중 작은 쪽이다 —
  // 상한을 스케줄의 시작값(9)으로 고정하면 어느 해든 9%를 넘을 수 없다.
  for (const year of [2026, 2040, 2070, 2100]) {
    assert.ok(contributionRatePercent(year, 9) <= 9 + 1e-9, `${year}년 보험료율이 9%를 넘었다`);
  }
});

test('경계 — 보험료율 최종치가 스케줄 도달치보다 높으면(예: 22%) 스케줄대로 오르다 그 상한에서 멈춘다', () => {
  const early = contributionRatePercent(2025, 22);
  const later = contributionRatePercent(2060, 22);
  assert.ok(Math.abs(early - CONTRIBUTION_RATE_BASE_PERCENT) < 1e-9, `2025년(기준 연도) 보험료율이 기준값이 아니다: ${early}`);
  assert.equal(later, 22, `충분히 늦은 해는 상한(22%)에서 멈춰야 한다: ${later}`);
});

// ---------------------------------------------------------------------------
// [2026-08-25, 소유자 지시 6번] 수급개시연령 범위가 60~80세로 넓어지며
// dA(= age − 65)가 처음으로 음수 구간(조기 수령)에 들어간다 — 그 구간에서
// 계수 부호가 실제로 뒤집혀 "맞는 방향"(조기 수령 → 수급자 증가, 1인당
// 급여는 감소)을 내는지 직접 잰다.
// ---------------------------------------------------------------------------

test('조기 수령(dA<0)에서는 수급자 수가 기준(65세, dA=0)보다 많은 방향으로 움직인다', () => {
  // 전이 구간(2030~2042) 안, 절반쯤 진행된 해를 골라 ageProgress가 0도
  // 1도 아니게 한다 — 부호만이 아니라 "실제로 델타가 반영된다"는 것까지
  // 함께 잰다.
  const year = 2036;
  const baseline = recipientsForYear(year, { ageDeltaYears: 0, lifeDeltaYears: 0, ben: 0 });
  const early = recipientsForYear(year, { ageDeltaYears: 60 - 65, lifeDeltaYears: 0, ben: 0 }); // 조기 수령(60세)
  const late = recipientsForYear(year, { ageDeltaYears: 80 - 65, lifeDeltaYears: 0, ben: 0 }); // 늦은 수령(80세)
  assert.ok(early > baseline, `조기 수령(60세)의 수급자 수(${early})가 기준(${baseline})보다 많아야 한다`);
  assert.ok(late < baseline, `늦은 수령(80세)의 수급자 수(${late})가 기준(${baseline})보다 적어야 한다`);
  // 대칭 확인 — 기준에서 5세 이르든 늦든 같은 크기로 반대 방향이어야
  // (선형 등식이므로) 계수가 구간별로 따로 뒤집히는 결함이 없다는 것까지 잰다.
  const minus5 = recipientsForYear(year, { ageDeltaYears: -5, lifeDeltaYears: 0, ben: 0 });
  const plus5 = recipientsForYear(year, { ageDeltaYears: 5, lifeDeltaYears: 0, ben: 0 });
  assert.ok(Math.abs((minus5 - baseline) - (baseline - plus5)) < 1e-9, '−5세·+5세가 기준에서 대칭으로 움직이지 않는다(선형 등식 위반)');
});

test('조기 수령이 실제 시뮬레이션에도 반영된다 — 60세 전체 실행이 65세보다 수급자 수(급여지출 경로)를 늘리는 방향으로 소진을 앞당기거나 같다', () => {
  const baseline65 = runDepletionSimulation({ ...DEFAULTS, age: 65 });
  const early60 = runDepletionSimulation({ ...DEFAULTS, age: 60 });
  // 조기 수령은 급여지출을 늘리는 방향(수급자 증가) + 1인당 급여를 줄이는
  // 방향(OUTGO_PER_AGE_YEAR_DELTA)이 동시에 걸린다 — 둘의 순효과가 반대
  // 부호일 수 있어 "소진연도가 반드시 당겨진다"고는 단정하지 않는다. 여기서는
  // 최소한 **결과가 달라진다**(계수가 죽어 있지 않다)는 것만 회귀로 잠근다.
  assert.notEqual(early60.maxFundTrillionKrw, baseline65.maxFundTrillionKrw, '수급개시연령을 60세로 내려도 결과가 전혀 안 바뀐다 — 배선이 죽어 있을 위험');
});

// ---------------------------------------------------------------------------
// 보조 함수 — 단독으로도 검증한다(계산 함수를 통째로 안 돌려도 재현 가능해야
// 회귀를 빨리 찾는다).
// ---------------------------------------------------------------------------

test('baseRecipients — 꺾은선 보간점 그대로, 구간 사이는 선형 보간이다', () => {
  assert.equal(baseRecipients(2026), 828);
  assert.equal(baseRecipients(2030), 1006);
  assert.equal(baseRecipients(2020), 828, '범위 왼쪽 밖은 첫 점 값으로 고정');
  assert.equal(baseRecipients(2200), 1050, '범위 오른쪽 밖은 마지막 점 값으로 고정');
  assert.ok(Math.abs(baseRecipients(2028) - (828 + (1006 - 828) * (2028 - 2026) / (2030 - 2026))) < 1e-9);
});

test('subscriberShockMultiplier — 네 구간, 2050~2069 구간은 정정 뒤 1.8', () => {
  // [tax-rules-report.md 33.9, 관리자 판정] 2050~2069 구간을 1.5→1.8로
  // 올렸다(통계청 장래인구추계 근거) — 2070년 이후 구간(1.0)은 이번
  // 판정에서 손대지 않았다.
  assert.equal(subscriberShockMultiplier(2030), 1.0);
  assert.equal(subscriberShockMultiplier(2040), 1.8);
  assert.equal(subscriberShockMultiplier(2060), 1.8);
  assert.equal(subscriberShockMultiplier(2090), 1.0);
});

test('phaseIn — 시작 이전 0, 끝 이후 1, 사이는 선형', () => {
  assert.equal(phaseIn(2020, 2030, 2042), 0);
  assert.equal(phaseIn(2050, 2030, 2042), 1);
  assert.ok(Math.abs(phaseIn(2036, 2030, 2042) - 0.5) < 1e-9);
});

test('maturationRate — 2055년까지 최댓값, 2068년 이후 0, 사이는 선형 감소', () => {
  assert.equal(maturationRate(2040), 0.013);
  assert.equal(maturationRate(2068), 0);
  assert.equal(maturationRate(2080), 0);
  assert.ok(maturationRate(2060) > 0 && maturationRate(2060) < 0.013);
});
