import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowDepletionIntroModal,
  dismissDepletionIntroModalForToday,
  DEPLETION_INTRO_MODAL_STORAGE_KEY,
} from './depletion-intro-modal.js';

/** 실제 `localStorage` 없이 같은 계약(getItem/setItem)만 흉내 낸다. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

// [D86] 계산기2 예시 팝업(`ui/calc2-example-modal.js`) 자체가 지워지며,
// 여기 있던 두 시험("별도 저장 키를 쓴다"·"계산기2 팝업을 닫아도 이 탭
// 팝업은 뜬다")이 재던 "서로 다른 두 팝업의 독립 억제"라는 전제가 사라졌다
// — 이제 이 탭이 앱의 유일한 일일 팝업이라 그 전제 자체가 무의미해져 함께
// 지운다(`CALC2_EXAMPLE_MODAL_STORAGE_KEY`를 내보내던 모듈이 없다).

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
