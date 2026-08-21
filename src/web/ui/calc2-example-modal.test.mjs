import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldShowCalc2ExampleModal,
  dismissCalc2ExampleModalForToday,
  localDateKey,
  CALC2_EXAMPLE_MODAL_STORAGE_KEY,
} from './calc2-example-modal.js';

/** 실제 `localStorage` 없이 같은 계약(getItem/setItem)만 흉내 낸다. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test('처음 방문(저장된 날짜 없음)에는 팝업을 보여준다', () => {
  const storage = fakeStorage();
  assert.equal(shouldShowCalc2ExampleModal(new Date('2026-08-21T09:00:00'), storage), true);
});

test('「오늘 하루 보지 않음」을 누른 뒤 같은 날 재클릭하면 뜨지 않는다', () => {
  const storage = fakeStorage();
  const now = new Date('2026-08-21T09:00:00');
  dismissCalc2ExampleModalForToday(now, storage);
  // 같은 날 안의 다른 시각(자정 넘지 않음).
  assert.equal(shouldShowCalc2ExampleModal(new Date('2026-08-21T23:59:00'), storage), false);
});

/** [소유자 지시] 자정이 지나면(날짜가 바뀌면) 다시 뜬다 — 실제 시계 대신 주입한 `Date`로 잰다. */
test('자정이 지나 날짜가 바뀌면 다시 뜬다(시계 주입)', () => {
  const storage = fakeStorage();
  dismissCalc2ExampleModalForToday(new Date('2026-08-21T23:59:59'), storage);
  assert.equal(shouldShowCalc2ExampleModal(new Date('2026-08-21T23:59:59'), storage), false, '같은 날 마지막 순간에는 아직 억제돼야 한다');
  assert.equal(shouldShowCalc2ExampleModal(new Date('2026-08-22T00:00:01'), storage), true, '자정을 넘으면 다시 떠야 한다');
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
  assert.equal(shouldShowCalc2ExampleModal(new Date(), throwingStorage), true);
  // dismiss도 예외 없이 조용히 넘어가야 한다(호출 자체가 던지면 안 된다).
  assert.doesNotThrow(() => dismissCalc2ExampleModalForToday(new Date(), throwingStorage));
});

test('저장은 오늘 날짜 하나뿐이다(값이 아니라 UI 상태) — localDateKey 형식(YYYY-MM-DD)', () => {
  const storage = fakeStorage();
  dismissCalc2ExampleModalForToday(new Date('2026-01-05T12:00:00'), storage);
  assert.equal(storage.getItem(CALC2_EXAMPLE_MODAL_STORAGE_KEY), '2026-01-05');
  assert.equal(localDateKey(new Date('2026-01-05T12:00:00')), '2026-01-05');
});
