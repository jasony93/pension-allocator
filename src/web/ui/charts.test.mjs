import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrackScalePercent, allocationSegments, annulusSlicePath, sliceAngles, MIN_SLICE_DEG } from './charts.js';

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

// --- 배제된 계좌의 조각 (4단계 관찰 O1) ------------------------------------

const ALLOCATIONS = [
  { account: 'retirement_pension', annual_krw: 9000000 },
  { account: 'annuity_savings', annual_krw: 0 },
  { account: 'isa', annual_krw: 0 },
];

test('C-1 and C-3 draw no slice for an account the engine excluded', () => {
  const segments = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 0, excludedAccounts: ['isa'] });
  assert.equal(
    segments.some((s) => s.account === 'isa'),
    false,
    '배제된 계좌는 조각 후보에도 오르지 않는다',
  );
});

test('excluding one account never removes the others', () => {
  const segments = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 0, excludedAccounts: ['isa'] });
  assert.deepEqual(
    segments.map((s) => s.account),
    ['annuity_savings', 'retirement_pension'],
    '조각 순서(연금저축 → IRP)는 A3 규약대로 고정이다',
  );
});

test('an excluded account carrying a nonzero amount is still not drawn — the amount cannot be spent there', () => {
  const contradictory = [
    { account: 'retirement_pension', annual_krw: 9000000 },
    { account: 'annuity_savings', annual_krw: 0 },
    { account: 'isa', annual_krw: 3000000 }, // 계약 위반(배제 계좌는 limited_by: not_eligible로 0이다)
  ];
  const segments = allocationSegments({ allocations: contradictory, unallocatedAnnualKrw: 0, excludedAccounts: ['isa'] });
  assert.equal(segments.some((s) => s.account === 'isa'), false);
});

test('with nothing excluded every account keeps its segment, including zero-amount ones', () => {
  const segments = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 600000 });
  assert.deepEqual(
    segments.map((s) => s.account),
    ['annuity_savings', 'retirement_pension', 'isa', 'unallocated'],
  );
});

test('the unallocated segment appears only when there is an unallocated amount', () => {
  const none = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 0 });
  assert.equal(none.some((s) => s.isUnallocated), false);
});

// --- 조각 하나가 원 전체를 차지할 때 (브라우저 실측으로 잡은 폭 0 렌더) -------

test('a slice covering the whole circle is drawn as two arcs, not one that collapses to a line', () => {
  const full = annulusSlicePath(120, 120, 112, 61.6, 0.966, 0, 360);
  const arcs = full.match(/A /g) ?? [];
  assert.equal(arcs.length, 4, '반원 두 개 × 안팎 두 링. 호 하나로 그리면 시작점=끝점이라 아무것도 안 그려진다');
});

test('a partial slice keeps the original single-arc form', () => {
  const partial = annulusSlicePath(120, 120, 112, 61.6, 0.966, 0, 90);
  assert.equal((partial.match(/A /g) ?? []).length, 2);
});

test('the full-ring path spans both sides of the centre, so its bounding box cannot be zero-width', () => {
  const cx = 120;
  const full = annulusSlicePath(cx, 120, 112, 61.6, 0.966, 0, 360);
  const xs = [...full.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)|A [\d.]+ [\d.]+ 0 [01] [01] (-?[\d.]+) (-?[\d.]+)/g)]
    .map((m) => Number(m[1] ?? m[3]))
    .filter((n) => Number.isFinite(n));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0, '좌우로 벌어진 점이 없으면 폭 0으로 렌더된다');
});

// --- 조각 각도 (design-system 5.20절 확정 규약) ------------------------------

const seg = (account, amount) => ({ account, amount, isUnallocated: false });

test('a slice with a nonzero amount is never smaller than the minimum visible angle', () => {
  const arcs = sliceAngles([seg('retirement_pension', 100000000), seg('isa', 1)]);
  const isa = arcs.find((a) => a.account === 'isa');
  assert.ok(isa.end - isa.start >= MIN_SLICE_DEG, '보이지 않는 조각보다 약간 부정확한 조각이 낫다');
});

test('widening the tiny slice still leaves the ring closed at exactly 360°', () => {
  const arcs = sliceAngles([seg('retirement_pension', 100000000), seg('annuity_savings', 1), seg('isa', 1)]);
  assert.ok(Math.abs(arcs[arcs.length - 1].end - 360) < 1e-9);
});

test('a zero-amount account gets no arc at all', () => {
  const arcs = sliceAngles([seg('retirement_pension', 9000000), seg('annuity_savings', 0), seg('isa', 0)]);
  assert.deepEqual(arcs.map((a) => a.account), ['retirement_pension']);
});

test('a single account fills the whole ring — 0° to 360°', () => {
  const arcs = sliceAngles([seg('isa', 9600000)]);
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].start, 0);
  assert.equal(arcs[0].end, 360);
});

test('slices stay contiguous and in the fixed account order (A3)', () => {
  const arcs = sliceAngles([seg('annuity_savings', 3000000), seg('retirement_pension', 6000000), seg('isa', 1000000)]);
  assert.deepEqual(arcs.map((a) => a.account), ['annuity_savings', 'retirement_pension', 'isa']);
  for (let i = 1; i < arcs.length; i++) assert.equal(arcs[i].start, arcs[i - 1].end);
});

test('proportions are untouched when every slice is already above the minimum', () => {
  const arcs = sliceAngles([seg('annuity_savings', 1), seg('retirement_pension', 1)]);
  assert.equal(arcs[0].end - arcs[0].start, 180);
});

test('never exceeds 100% even if remaining somehow equals maxRemaining exactly at the boundary', () => {
  assert.equal(computeTrackScalePercent(18000000, 18000000), 100);
  assert.ok(computeTrackScalePercent(20000000, 18000000) <= 100); // 방어적 클램프 — remaining이 max를 넘는 입력은 없어야 하지만 클램프로 안전하게 막는다
});
