import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowDepletionIntroModal,
  dismissDepletionIntroModalForToday,
  DEPLETION_INTRO_MODAL_STORAGE_KEY,
} from './depletion-intro-modal.js';
import { CALC2_EXAMPLE_MODAL_STORAGE_KEY } from './calc2-example-modal.js';

/** 실제 `localStorage` 없이 같은 계약(getItem/setItem)만 흉내 낸다 —
 * `calc2-example-modal.test.mjs`와 같은 패턴. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test('[소유자 지시 9번] 계산기2 예시 팝업과 별도 저장 키를 쓴다 — 일일 억제가 서로 간섭하지 않는다', () => {
  assert.notEqual(DEPLETION_INTRO_MODAL_STORAGE_KEY, CALC2_EXAMPLE_MODAL_STORAGE_KEY);
});

test('계산기2 예시 팝업을 오늘 닫아도 이 탭 팝업은 여전히 뜬다(별도 키 — 독립 억제)', () => {
  const storage = fakeStorage();
  const now = new Date('2026-08-25T09:00:00');
  storage.setItem(CALC2_EXAMPLE_MODAL_STORAGE_KEY, '2026-08-25'); // 계산기2 쪽만 오늘 닫힘.
  assert.equal(shouldShowDepletionIntroModal(now, storage), true, '계산기2 팝업의 억제가 이 팝업에 새어 들어왔다');
});

test('처음 방문(저장된 날짜 없음)에는 팝업을 보여준다', () => {
  const storage = fakeStorage();
  assert.equal(shouldShowDepletionIntroModal(new Date('2026-08-25T09:00:00'), storage), true);
});

test('「오늘 하루 보지 않음」을 누른 뒤 같은 날 재방문하면 뜨지 않는다', () => {
  const storage = fakeStorage();
  const now = new Date('2026-08-25T09:00:00');
  dismissDepletionIntroModalForToday(now, storage);
  assert.equal(shouldShowDepletionIntroModal(new Date('2026-08-25T23:59:00'), storage), false);
});

test('자정이 지나 날짜가 바뀌면 다시 뜬다(시계 주입)', () => {
  const storage = fakeStorage();
  dismissDepletionIntroModalForToday(new Date('2026-08-25T23:59:59'), storage);
  assert.equal(shouldShowDepletionIntroModal(new Date('2026-08-25T23:59:59'), storage), false, '같은 날 마지막 순간에는 아직 억제돼야 한다');
  assert.equal(shouldShowDepletionIntroModal(new Date('2026-08-26T00:00:01'), storage), true, '자정을 넘으면 다시 떠야 한다');
});

test('localStorage 접근이 예외를 던지면(프라이빗 모드 등) 안전한 쪽(보여준다)으로 접는다', () => {
  const throwingStorage = {
    getItem: () => {
      throw new Error('access denied');
    },
    setItem: () => {
      throw new Error('access denied');
    },
  };
  assert.equal(shouldShowDepletionIntroModal(new Date(), throwingStorage), true);
  assert.doesNotThrow(() => dismissDepletionIntroModalForToday(new Date(), throwingStorage));
});

test('저장은 오늘 날짜 하나뿐이다(값이 아니라 UI 상태) — YYYY-MM-DD 형식', () => {
  const storage = fakeStorage();
  dismissDepletionIntroModalForToday(new Date('2026-01-05T12:00:00'), storage);
  assert.equal(storage.getItem(DEPLETION_INTRO_MODAL_STORAGE_KEY), '2026-01-05');
});
