import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donutOptimalKicker } from './result-panel.js';

/**
 * D45 5번(관리자, 2026-08-11) — 「최적」을 도넛 kicker 한 자리에 쓰는 조건은
 * 바로 아래 배분안 이름 캡션(`donutPlanNameCaption`)이 "무엇에 대해
 * 최적인지"를 진술하는 것이다. **이 파일은 그 조건을 실제로 지워 보고
 * 가드가 정말 무는지 확인한다** — "지웠는데도 통과하는" 검사는 통과하되
 * 아무것도 증명하지 않는다(D42).
 *
 * `document`가 필요 없다 — `donutOptimalKicker`는 인자가 비어 있으면 `el()`을
 * 부르기 **전에** 던진다. 그래서 이 저장소가 갖지 않은 jsdom 없이도, 실패
 * 경로(캡션이 사라진 상태)를 순수 Node로 재현해 확인할 수 있다. **성공
 * 경로(`el()`이 실제로 만드는 노드, 캡션이 있을 때 던지지 않는지)는 `el()`이
 * `document`를 요구해 여기서 확인할 수 없다** — `browser/donut-optimal-
 * kicker.browser.mjs`가 실제 Chrome으로 그 절반을 잰다. 이 파일과 그 파일은
 * 서로 다른 절반을 본다 — 어느 한쪽만으로는 "가드가 실제로 짝을 묶는다"는
 * 것을 증명하지 못한다.
 */

test('캡션 문자열이 빈 문자열이면(캡션이 지워진 것과 같다) donutOptimalKicker가 던진다', () => {
  assert.throws(() => donutOptimalKicker(''), /donutOptimalKicker/, 'D45 5번 조건 — 캡션 없이 "최적"을 만들면 안 된다');
});

test('캡션 문자열이 null/undefined여도 던진다 — falsy 전부를 막는다', () => {
  assert.throws(() => donutOptimalKicker(null), /donutOptimalKicker/);
  assert.throws(() => donutOptimalKicker(undefined), /donutOptimalKicker/);
});

test('에러 메시지가 D45 조건을 가리킨다 — 다른 이유로 우연히 던진 것과 구별된다', () => {
  assert.throws(() => donutOptimalKicker(''), /D45 5번 조건/);
});
