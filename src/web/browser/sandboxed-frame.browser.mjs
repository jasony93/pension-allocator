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

const RESET_TRIGGER = `[...document.querySelectorAll('.input-panel-header button')].find((b) => b.textContent.trim() === '초기화')`;
const modalButton = (label) => `[...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;

let app;
let frame;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  frame = await attachSandboxedFrame(app.page);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('이 환경에서 window.confirm()은 조용히 false를 돌려준다 — 결함의 원인 자체를 못박는다', { skip: skipWithoutChrome }, async () => {
  assert.equal(await frame.evaluate(`window.confirm('probe')`), false);
});

test('그런 환경에서도 앱이 뜬다 — 계측의 storage 접근이 화면을 죽이지 않는다', { skip: skipWithoutChrome }, async () => {
  assert.equal(await frame.evaluate(`!!document.getElementById('birthDate')`), true, '#app이 비어 있으면 계측이 계산을 막은 것이다');
  assert.equal(await frame.evaluate(`!!document.querySelector('.input-panel')`), true);
});

test('초기화가 화면 안 확인을 거쳐 실제로 값을 지운다', { skip: skipWithoutChrome }, async () => {
  await frame.evaluate(`(() => {
    const set = (id, v) => { const el = document.getElementById(id); el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('birthDate', '19800101');
    set('currentSalary', '60000000');
  })()`);
  await sleep(200);

  await frame.click(RESET_TRIGGER);
  await sleep(250);

  assert.equal(await frame.evaluate(`!!document.querySelector('.modal-scrim [role="dialog"]')`), true, '화면 안 확인이 떠야 한다');
  assert.equal(await frame.evaluate(`document.activeElement.textContent.trim()`), '취소', '기본 포커스는 취소에 둔다');

  await frame.click(modalButton('모두 지우기'));
  await sleep(400);

  const after = await frame.evaluate(`(() => ({
    birth: document.getElementById('birthDate').value,
    salary: document.getElementById('currentSalary').value,
    dialogOpen: !!document.querySelector('.modal-scrim'),
    bodyOverflow: document.body.style.overflow,
  }))()`);
  assert.equal(after.birth, '', '초기화가 값을 지워야 한다');
  assert.equal(after.salary, '');
  assert.equal(after.dialogOpen, false, '확인 뒤 대화상자가 닫혀야 한다');
  assert.equal(after.bodyOverflow, '', '배경 스크롤 잠금이 풀려야 한다');
});

test('취소하면 값이 남는다 — 확인이 형식이 아니다', { skip: skipWithoutChrome }, async () => {
  await frame.evaluate(`(() => {
    const el = document.getElementById('birthDate');
    el.focus(); el.value = '19800101'; el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  await frame.click(RESET_TRIGGER);
  await sleep(250);
  await frame.click(modalButton('취소'));
  await sleep(300);

  const after = await frame.evaluate(`(() => ({
    birth: document.getElementById('birthDate').value,
    dialogOpen: !!document.querySelector('.modal-scrim'),
    focus: document.activeElement ? document.activeElement.textContent.trim() : null,
  }))()`);
  assert.equal(after.birth, '1980-01-01', '취소했는데 값이 지워지면 안 된다');
  assert.equal(after.dialogOpen, false);
  assert.equal(after.focus, '초기화', 'design-system 5.18절 — 닫히면 트리거로 포커스 복귀');
});

test('Esc로도 닫히고 값이 남는다', { skip: skipWithoutChrome }, async () => {
  await frame.click(RESET_TRIGGER);
  await sleep(250);
  assert.equal(await frame.evaluate(`!!document.querySelector('.modal-scrim')`), true);
  await app.page.pressKey('Escape', 'Escape', 27);
  await sleep(300);

  const after = await frame.evaluate(`(() => ({
    birth: document.getElementById('birthDate').value,
    dialogOpen: !!document.querySelector('.modal-scrim'),
    bodyOverflow: document.body.style.overflow,
  }))()`);
  assert.equal(after.birth, '1980-01-01');
  assert.equal(after.dialogOpen, false);
  assert.equal(after.bodyOverflow, '');
});

test('확인 중에는 탭이 대화상자 밖으로 새지 않는다 (design-system 5.18절 포커스 트랩)', { skip: skipWithoutChrome }, async () => {
  await frame.click(RESET_TRIGGER);
  await sleep(250);
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await app.page.pressKey('Tab', 'Tab', 9);
    await sleep(60);
    seen.push(await frame.evaluate(`document.activeElement ? document.activeElement.textContent.trim() : null`));
  }
  assert.ok(
    seen.every((label) => label === '취소' || label === '모두 지우기'),
    `대화상자 밖으로 초점이 새었습니다: ${JSON.stringify(seen)}`,
  );
  await app.page.pressKey('Escape', 'Escape', 27);
  await sleep(200);
});
