import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatKrw, formatKrwAbbreviated, formatDelta, formatPlanRowAmount, formatPercent, formatPercentTrimmed } from './format.js';

test('formatKrw adds thousands separators and the 원 suffix', () => {
  assert.equal(formatKrw(1234567), '1,234,567원');
  assert.equal(formatKrw(0), '0원');
});

test('formatKrw prints negative amounts with a minus sign, not parentheses or a hidden sign', () => {
  assert.equal(formatKrw(-396000), '-396,000원');
});

test('formatKrwAbbreviated only appears in headline contexts and rounds to 만원', () => {
  assert.equal(formatKrwAbbreviated(1188000), '118.8만원');
  assert.equal(formatKrwAbbreviated(6000000), '600만원');
  assert.equal(formatKrwAbbreviated(5000), '5,000원');
});

test('formatDelta is purely numeric — a delta of 0 reads "동일", never "기본"', () => {
  // formatDelta는 baseline 여부를 모른다(인자로 받지도 않는다). "기본"이라는
  // 단어는 formatPlanRowAmount 쪽, plan.is_baseline을 실제로 확인한 뒤에만
  // 나온다 — 관리자가 브라우저 실측에서 잡은 버그(델타==0인 비기본안 행이
  // "기본"으로 표시됨)가 이 분리로 구조적으로 재발할 수 없게 했다.
  assert.equal(formatDelta(0), '동일');
});

test('formatDelta shows a minus sign for a plan that raises less credit than baseline', () => {
  assert.equal(formatDelta(-831600), '-831,600원');
});

test('formatDelta shows an explicit plus sign for a plan that raises MORE credit than baseline', () => {
  // engine-interface.md 3.0.0(0.1절) — fund_use_horizon이 기본안을 재정렬하면
  // delta_vs_baseline_krw가 양수일 수 있다. 부호를 숨기면 이득이 손실처럼 읽힌다.
  assert.equal(formatDelta(200000), '+200,000원');
});

test('formatPlanRowAmount: the baseline row always reads "기본", regardless of its delta value', () => {
  assert.equal(formatPlanRowAmount({ is_baseline: true, delta_vs_baseline_krw: 0 }), '기본');
});

test('formatPlanRowAmount: a NON-baseline row whose delta happens to be 0 reads "동일", never "기본"', () => {
  // 이것이 정확히 관리자가 잡은 버그의 재발 방지 테스트다. 세액공제액이
  // 우연히 기본안과 같은 대안(예: 합산 한도가 같은 값으로 걸리는 경우)이
  // 흔한데, 이전 구현은 두 행 모두 "기본"이라고 표시했다.
  assert.equal(formatPlanRowAmount({ is_baseline: false, delta_vs_baseline_krw: 0 }), '동일');
});

test('formatPlanRowAmount: a non-baseline row with a real difference shows the signed delta', () => {
  assert.equal(formatPlanRowAmount({ is_baseline: false, delta_vs_baseline_krw: -831600 }), '-831,600원');
  assert.equal(formatPlanRowAmount({ is_baseline: false, delta_vs_baseline_krw: 200000 }), '+200,000원');
});

test('formatPlanRowAmount: with two non-baseline rows sharing delta 0, both read "동일" and neither reads "기본"', () => {
  // 이 케이스가 관리자가 실측한 정확한 화면 상태를 재현한다: row0=기본,
  // row1=기본 아닌데 델타 0. 고친 뒤에는 row1이 "기본"을 말하면 안 된다.
  const plans = [
    { plan_id: 'max_tax_credit', is_baseline: true, delta_vs_baseline_krw: 0 },
    { plan_id: 'annuity_savings_first', is_baseline: false, delta_vs_baseline_krw: 0 },
    { plan_id: 'isa_first', is_baseline: false, delta_vs_baseline_krw: -1485000 },
  ];
  const labels = plans.map(formatPlanRowAmount);
  assert.deepEqual(labels, ['기본', '동일', '-1,485,000원']);
  assert.equal(labels.filter((l) => l === '기본').length, 1, '정확히 한 행만 "기본"이어야 한다');
});

test('formatPercent renders a ratio as a whole-number percentage by default', () => {
  assert.equal(formatPercent(0.3333), '33%');
  assert.equal(formatPercent(1), '100%');
});

test('formatPercentTrimmed drops trailing zeros instead of printing false precision', () => {
  assert.equal(formatPercentTrimmed(0.07), '7%');
  assert.equal(formatPercentTrimmed(0.055), '5.5%');
  assert.equal(formatPercentTrimmed(0.0225), '2.25%');
  assert.equal(formatPercentTrimmed(0), '0%');
  assert.equal(formatPercentTrimmed(1), '100%');
});
