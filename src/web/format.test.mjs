import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatKrw, formatKrwAbbreviated, formatDelta, formatPercent } from './format.js';

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

test('formatDelta shows the baseline row as "기본", not "0원"', () => {
  assert.equal(formatDelta(0), '기본');
});

test('formatDelta shows a minus sign for a plan that raises less credit than baseline', () => {
  assert.equal(formatDelta(-831600), '-831,600원');
});

test('formatDelta shows an explicit plus sign for a plan that raises MORE credit than baseline', () => {
  // engine-interface.md 3.0.0(0.1절) — fund_use_horizon이 기본안을 재정렬하면
  // delta_vs_baseline_krw가 양수일 수 있다. 부호를 숨기면 이득이 손실처럼 읽힌다.
  assert.equal(formatDelta(200000), '+200,000원');
});

test('formatPercent renders a ratio as a whole-number percentage by default', () => {
  assert.equal(formatPercent(0.3333), '33%');
  assert.equal(formatPercent(1), '100%');
});
