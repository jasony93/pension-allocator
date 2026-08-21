import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

/**
 * 생년월일 입력 순서가 뒤집히던 결함의 실측.
 *
 * **값 대입으로는 재현되지 않는다.** `el.value = '19930417'`에는 커서가 없고,
 * 버그는 커서를 되돌려 놓는 자리에 있었다. 한 자씩 실제로 쳐야 나타난다.
 *
 * 고치기 전 이 검사는 `1993-41-70`을 받았다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌어 `#birthDate`(첫 탭 전용)가
  // 기본으로 숨어 있다 — 숨은(`display:none`) 원소는 실제 브라우저에서
  // `focus()`가 먹지 않는다(이 파일의 모든 시험이 그 초점에 기대므로 안
  // 켜면 전부 깨진다). 명시로 첫 탭을 켠다.
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-calculator')`);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('19930417을 한 자씩 치면 1993-04-17이 된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`(() => { const el = document.getElementById('birthDate'); el.value = ''; el.focus(); })()`);
  await page.typeText('19930417');
  await sleep(150);
  assert.equal(await page.evaluate(`document.getElementById('birthDate').value`), '1993-04-17');
});

test('값 가운데에 끼워 넣어도 커서가 방금 친 글자 뒤에 남는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // `1993|-04-17` — 하이픈 앞에 커서를 두고 한 글자 친다. 마스크가 자리를 다시
  // 짜므로 문자 인덱스로는 어긋나고, 유효문자 개수로는 어긋나지 않는다.
  await page.evaluate(`(() => { const el = document.getElementById('birthDate'); el.focus(); el.setSelectionRange(4, 4); })()`);
  await page.typeText('5');
  await sleep(150);
  const state = await page.evaluate(
    `(() => { const el = document.getElementById('birthDate'); return { value: el.value, caret: el.selectionStart }; })()`,
  );
  assert.equal(state.value, '1993-50-41');
  assert.equal(state.caret, 6, '방금 친 5 바로 뒤여야 한다');
});

test('타이핑 중에도 입력 노드가 교체되지 않는다 — 초점을 잃을 일 자체가 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`(() => {
    const el = document.getElementById('birthDate');
    el.value = ''; el.focus();
    window.__watchedNode = el;
  })()`);
  await page.typeText('19930417');
  await sleep(150);
  const same = await page.evaluate(`window.__watchedNode === document.getElementById('birthDate')`);
  assert.equal(same, true, '재렌더가 입력 노드를 갈아치우면 커서·초점 복원 문제가 되살아난다');
  assert.equal(await page.evaluate(`document.activeElement.id`), 'birthDate');
});

test('여덟 자리를 넘겨 쳐도 잘린 값 끝에 커서가 남는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`(() => { const el = document.getElementById('birthDate'); el.value = ''; el.focus(); })()`);
  await page.typeText('199304179999');
  await sleep(150);
  const state = await page.evaluate(
    `(() => { const el = document.getElementById('birthDate'); return { value: el.value, caret: el.selectionStart }; })()`,
  );
  assert.equal(state.value, '1993-04-17');
  assert.equal(state.caret, 10);
});
