import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAnnuityStartedFromBoundaries } from './annuity-start-derivation.js';

test('D79 판정 3 — 남은 개시연령 연수가 있으면(양수) 확실히 미개시다', () => {
  assert.equal(deriveAnnuityStartedFromBoundaries({ pension_years_remaining: 25 }), false);
  assert.equal(deriveAnnuityStartedFromBoundaries({ pension_years_remaining: 1 }), false);
});

test('D79 판정 3 — 잔여가 0이면 판단할 수 없다(개시 연령에 닿았거나 지났다) — 물어야 한다', () => {
  assert.equal(deriveAnnuityStartedFromBoundaries({ pension_years_remaining: 0 }), null);
});

test('D79 판정 3 — boundaries가 아직 없으면(생년월일 미입력·형식 오류) 물어야 한다', () => {
  assert.equal(deriveAnnuityStartedFromBoundaries(null), null);
  assert.equal(deriveAnnuityStartedFromBoundaries(undefined), null);
  assert.equal(deriveAnnuityStartedFromBoundaries({}), null);
  assert.equal(deriveAnnuityStartedFromBoundaries({ pension_years_remaining: null }), null);
  assert.equal(deriveAnnuityStartedFromBoundaries({ pension_years_remaining: NaN }), null);
});

test('D79 판정 3 — 이 함수는 절대 true(개시했다)를 내지 않는다', () => {
  for (const remaining of [-5, -1, 0, 1, 10, 60]) {
    assert.notEqual(deriveAnnuityStartedFromBoundaries({ pension_years_remaining: remaining }), true);
  }
});

// 판별력 증명 준비 — 이 값이 실제로 쓰이는지는 `browser/calc2-input-panel.browser.mjs`가
// 화면에서 물음 자체가 사라지는지까지 실측한다(단위 시험은 순수 함수 경계만 고정한다).
