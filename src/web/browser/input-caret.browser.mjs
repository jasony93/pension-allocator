import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissDepletionIntroModalIfOpen } from './harness.mjs';

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
  // [2026-08-24, D84] 「절세계좌 계산기2(근거판)」(첫 탭)이 지워져 calc2가
  // 유일한 계산 탭이다.
  // [2026-08-25, D86] 기본 랜딩 탭이 다시 시뮬레이터로 바뀌었다 —
  // `#calc2BirthDate`가 실제로 보이고 포커스를 받으려면(숨은 탭 패널
  // 안에서는 `.focus()`가 조용히 실패한다) 이 탭으로 먼저 전환해야 한다.
  await dismissDepletionIntroModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-calc2')`);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('19930417을 한 자씩 치면 1993-04-17이 된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`(() => { const el = document.getElementById('calc2BirthDate'); el.value = ''; el.focus(); })()`);
  await page.typeText('19930417');
  await sleep(150);
  assert.equal(await page.evaluate(`document.getElementById('calc2BirthDate').value`), '1993-04-17');
});

test('값 가운데에 끼워 넣어도 커서가 방금 친 글자 뒤에 남는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // `1993|-04-17` — 하이픈 앞에 커서를 두고 한 글자 친다. 마스크가 자리를 다시
  // 짜므로 문자 인덱스로는 어긋나고, 유효문자 개수로는 어긋나지 않는다.
  await page.evaluate(`(() => { const el = document.getElementById('calc2BirthDate'); el.focus(); el.setSelectionRange(4, 4); })()`);
  await page.typeText('5');
  await sleep(150);
  const state = await page.evaluate(
    `(() => { const el = document.getElementById('calc2BirthDate'); return { value: el.value, caret: el.selectionStart }; })()`,
  );
  assert.equal(state.value, '1993-50-41');
  assert.equal(state.caret, 6, '방금 친 5 바로 뒤여야 한다');
});

test('타이핑 중에도 입력 노드가 교체되지 않는다 — 초점을 잃을 일 자체가 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`(() => {
    const el = document.getElementById('calc2BirthDate');
    el.value = ''; el.focus();
    window.__watchedNode = el;
  })()`);
  await page.typeText('19930417');
  await sleep(150);
  const same = await page.evaluate(`window.__watchedNode === document.getElementById('calc2BirthDate')`);
  assert.equal(same, true, '재렌더가 입력 노드를 갈아치우면 커서·초점 복원 문제가 되살아난다');
  assert.equal(await page.evaluate(`document.activeElement.id`), 'calc2BirthDate');
});

test('여덟 자리를 넘겨 쳐도 잘린 값 끝에 커서가 남는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`(() => { const el = document.getElementById('calc2BirthDate'); el.value = ''; el.focus(); })()`);
  await page.typeText('199304179999');
  await sleep(150);
  const state = await page.evaluate(
    `(() => { const el = document.getElementById('calc2BirthDate'); return { value: el.value, caret: el.selectionStart }; })()`,
  );
  assert.equal(state.value, '1993-04-17');
  assert.equal(state.caret, 10);
});
