import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, attachSandboxedFrame, skipWithoutChrome, sleep } from './harness.mjs';

/**
 * 아티팩트가 실제로 도는 자리 — `sandbox="allow-scripts"` iframe 안 — 에서의 실측.
 *
 * 이 환경이 조용히 막는 것이 둘 있었고 둘 다 Node 검사로는 드러나지 않았다.
 *
 * ① `allow-modals`가 없으면 `window.confirm()`이 **아무것도 띄우지 않고 `false`**를
 *    돌려준다. 그래서 `store.reset()`이 불리지 않았고 초기화 버튼이 죽어 보였다.
 * ② `allow-same-origin`이 없으면 `window.sessionStorage`를 **읽는 것만으로**
 *    SecurityError가 난다. 그 예외가 `main.js` 첫 줄에서 터져 화면 전체가
 *    뜨지 않았다.
 */

let app;
let frame;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  frame = await attachSandboxedFrame(app.page);
  // [2026-08-24, D84] calc2가 유일한 계산 탭이라 탭 전환이 더는 필요
  // 없다. [2026-08-25, D86] 기본 활성 탭은 이제 `pension-depletion`이지만
  // — 둘 다 처음부터 동시에 마운트되므로(screens.md 2.1.2절 (3)) 아래
  // `calc2BirthDate` 존재 확인은 그대로 유효하다.
  // **탭 전용 팝업(시뮬레이터, 기본 랜딩)도 여기서 따로 치울 필요가
  // 없다** — 이 iframe은 `allow-same-origin`이 없는 불투명 출처라
  // `localStorage` 접근 자체가 SecurityError를 던진다(위 첫 시험이 그
  // 사실 자체를 못박는다). 모달을 띄우는 코드(`depletionSafeLocalStorage()`)
  // 가 그 예외를 이미 삼키고 `null`을 돌려주므로, 이 환경에서는 애초에
  // 모달이 뜨지 않는다 — `dismissDepletionIntroModalIfOpen`을 불렀다가는
  // 그 함수 자신의 `localStorage.setItem` 호출이 여기서 대신 던져 이
  // 훅을 깬다.
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('이 환경에서 window.confirm()은 조용히 false를 돌려준다 — 결함의 원인 자체를 못박는다', { skip: skipWithoutChrome }, async () => {
  assert.equal(await frame.evaluate(`window.confirm('probe')`), false);
});

test('그런 환경에서도 앱이 뜬다 — 계측의 storage 접근이 화면을 죽이지 않는다', { skip: skipWithoutChrome }, async () => {
  assert.equal(await frame.evaluate(`!!document.getElementById('calc2BirthDate')`), true, '#app이 비어 있으면 계측이 계산을 막은 것이다');
  assert.equal(await frame.evaluate(`!!document.querySelector('.input-panel')`), true);
});

// [2026-08-24, D84 정리, 알려진 빈 자리] 원래 여기 있던 네 검사(초기화 →
// 화면 안 확인 → 실제로 값을 지운다 / 취소하면 남는다 / Esc로 닫힌다 /
// 포커스 트랩)를 지운다 — 그 넷이 겨누던 「초기화」 버튼(`.input-panel-
// header button`, `ui/print.js`가 아니라 첫 탭 전용 UI)이 calc2에는
// 아예 없다(calc2-input-panel.js에 그 버튼·확인 대화상자 배선이 없다).
// `ui/modal.js`의 확인 대화상자(포커스 트랩·Esc·취소/확인) 컴포넌트
// 자체는 여전히 있지만, calc2 화면 안에서 그것을 여는 다른 트리거가
// 없다(calc2의 유일한 모달은 예시 팝업 — 확인/취소 쌍이 아니라 단순
// 닫기 팝업이라 같은 성격이 아니다). **이 저장소 어딘가에 초기화(또는
// 다른 확인 필요 동작)가 calc2에도 생기면 이 네 검사를 다시 세워야
// 한다** — 관리자 보고에 후속 과제로 남긴다.
