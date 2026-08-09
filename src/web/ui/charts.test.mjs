import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrackScalePercent } from './charts.js';

test('the account with the largest remaining limit always scales to exactly 100%', () => {
  assert.equal(computeTrackScalePercent(18000000, 18000000), 100);
});

test('a proportionally smaller remaining limit scales down by the same ratio', () => {
  assert.equal(computeTrackScalePercent(9000000, 18000000), 50);
});

test('an account with zero remaining limit gets the distinct "exhausted" floor, not zero width', () => {
  const pct = computeTrackScalePercent(0, 18000000);
  assert.ok(pct > 0, 'a 0-width track disappears entirely, per D16');
  assert.ok(pct < 8, 'the exhausted floor must read as visibly smaller than the small-but-nonzero floor');
});

test('an extremely small but nonzero remaining limit is floored so it stays visible/clickable', () => {
  const pct = computeTrackScalePercent(1000, 18000000); // 0.0056% raw
  assert.ok(pct >= 8, 'raw ratio would be imperceptible; the floor keeps it readable');
});

test('the floor never inflates a small value past a larger one — relative order is preserved', () => {
  const small = computeTrackScalePercent(100, 18000000);
  const medium = computeTrackScalePercent(9000000, 18000000);
  const large = computeTrackScalePercent(18000000, 18000000);
  const zero = computeTrackScalePercent(0, 18000000);
  assert.ok(zero < small, 'exhausted must read smaller than a merely-tiny-but-real remainder');
  assert.ok(small < medium, 'floor must not let a tiny value catch up to a genuinely mid-sized one');
  assert.ok(medium < large);
});

test('all three accounts exhausted (maxRemaining = 0) renders all tracks at the same exhausted floor, not NaN/Infinity', () => {
  const pct = computeTrackScalePercent(0, 0);
  assert.ok(Number.isFinite(pct));
  assert.ok(pct > 0 && pct < 8);
});

test('never exceeds 100% even if remaining somehow equals maxRemaining exactly at the boundary', () => {
  assert.equal(computeTrackScalePercent(18000000, 18000000), 100);
  assert.ok(computeTrackScalePercent(20000000, 18000000) <= 100); // 방어적 클램프 — remaining이 max를 넘는 입력은 없어야 하지만 클램프로 안전하게 막는다
});
