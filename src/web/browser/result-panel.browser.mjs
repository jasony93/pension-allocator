import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * 결과 패널의 실측 — 클릭이 삼켜지던 자리와, 노드를 고쳐 쓰는 렌더가 내용을
 * 제대로 갱신하는지.
 *
 * **입력 칸과 같은 뿌리의 결함이 결과 패널에도 있었다.** 값을 친 직후 결과
 * 패널의 버튼을 누르면 첫 클릭이 통째로 삼켜졌다 — `mousedown`이 이전 칸의
 * `blur`를 일으키고, 그 `blur`가 재계산·재렌더를 걸어 **버튼 노드를 바꿔치기**
 * 하므로 `mouseup`이 다른 노드에 걸리고, 그러면 브라우저가 `click`을 만들지
 * 않는다. 브라우저에서 `mousedown`·`mouseup`은 오는데 `click`이 오지 않는 것을
 * 직접 확인했다.
 *
 * 저장·공유 모달은 원래 자기 뼈대를 따로 갖고 있었고 design-system 5.18절이
 * 요구한 **포커스 트랩·배경 스크롤 잠금·트리거로 포커스 복귀**가 셋 다 빠져
 * 있었다. 뼈대를 `ui/modal.js` 하나로 모았으므로 그 과정에서 깨지지 않았는지도
 * 여기서 본다 — 이 모듈에는 그전까지 어떤 검사도 없었다.
 */

const SHARE_TRIGGER = `[...document.querySelectorAll('.save-share button')].find((b) => b.textContent.trim() === '공유용 이미지 만들기')`;

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  await app.page.evaluate(FILL_REQUIRED_FIELDS);
  // 디바운스(400ms) + 계산 + 경계값 조회가 끝나 결과 패널이 안정될 때까지 기다린다.
  await app.page.waitFor(`!!document.querySelector('.save-share button')`);
  await sleep(600);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('값을 친 직후 눌러도 결과 패널의 첫 클릭이 삼켜지지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 입력 칸에 초점이 남아 있는 상태 — 클릭이 blur → 재계산 → 재렌더를 부른다.
  // 예전에는 이 상황에서 버튼 노드가 press와 release 사이에 바뀌어 click이 사라졌다.
  assert.equal(
    await page.evaluate(`document.activeElement.tagName`),
    'INPUT',
    '이 검사는 입력 칸에 초점이 남아 있어야 뜻이 있다',
  );
  await page.clickElement(SHARE_TRIGGER);
  await page.waitFor(`!!document.querySelector('.modal-scrim [role="dialog"]')`, { timeoutMs: 2000 });
  await page.pressKey('Escape', 'Escape', 27);
  await sleep(250);
});

test('결과 패널의 도넛이 실제 크기를 갖고 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const donut = await page.evaluate(`(() => {
    const svg = document.querySelector('.result-slot svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const paths = [...svg.querySelectorAll('path')].map((p) => (p.getAttribute('d') || '').length);
    return { width: r.width, height: r.height, paths };
  })()`);
  assert.ok(donut, '결과 패널에 SVG가 있어야 한다');
  assert.ok(donut.width > 0 && donut.height > 0, `도넛이 0×0으로 그려졌습니다: ${JSON.stringify(donut)}`);
  assert.ok(donut.paths.length > 0 && donut.paths.every((len) => len > 0), '조각 path가 비어 있습니다');
});

test('입력을 바꾸면 결과 숫자가 실제로 갱신된다 — 노드를 고쳐 써도 내용이 남지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const readAmount = `document.querySelector('.result-slot').textContent`;
  const before = await page.evaluate(readAmount);
  await page.evaluate(`(() => {
    const el = document.getElementById('monthlyCapacity');
    el.focus(); el.value = '1200000'; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur();
  })()`);
  await page.waitFor(`${readAmount} !== ${JSON.stringify(before)}`, { timeoutMs: 4000 });
  const after = await page.evaluate(readAmount);
  assert.notEqual(after, before);
  // 도넛도 함께 갱신됐는지 — SVG는 네임스페이스가 달라 고쳐 쓰기가 가장 위험한 자리다.
  assert.equal(await page.evaluate(`!!document.querySelector('.result-slot svg path')`), true);
});

test('공유 미리보기가 열리고 Esc로 닫히며 트리거로 포커스가 돌아온다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(await page.evaluate(`!!document.querySelector('.save-share')`), true, '결과가 나와야 공유 버튼이 있다');

  await page.clickElement(SHARE_TRIGGER);
  await page.waitFor(`!!document.querySelector('.modal-scrim [role="dialog"]')`);
  const open = await page.evaluate(`(() => ({
    dialog: !!document.querySelector('.modal-scrim [role="dialog"]'),
    label: document.querySelector('.modal-scrim [role="dialog"]').getAttribute('aria-label'),
    focus: document.activeElement ? document.activeElement.textContent.trim() : null,
    bodyOverflow: document.body.style.overflow,
  }))()`);
  assert.equal(open.dialog, true);
  assert.equal(open.label, '결과 저장·공유 미리보기');
  assert.equal(open.focus, '이미지로 저장', '열리면 첫 동작 버튼에 포커스가 간다');
  assert.equal(open.bodyOverflow, 'hidden', '배경 스크롤이 잠긴다');

  await page.pressKey('Escape', 'Escape', 27);
  await sleep(250);
  const closed = await page.evaluate(`(() => ({
    dialog: !!document.querySelector('.modal-scrim'),
    focus: document.activeElement ? document.activeElement.textContent.trim() : null,
    bodyOverflow: document.body.style.overflow,
  }))()`);
  assert.equal(closed.dialog, false);
  assert.equal(closed.bodyOverflow, '');
  assert.equal(closed.focus, '공유용 이미지 만들기', 'design-system 5.18절 — 트리거로 포커스 복귀');
});

test('미리보기에는 입력값이 실려 있지 않다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(SHARE_TRIGGER);
  await page.waitFor(`!!document.querySelector('.modal-scrim [role="dialog"]')`);
  const text = await page.evaluate(`document.querySelector('.modal-scrim [role="dialog"]').textContent`);
  // screens.md 9절 — 생년월일·총급여액·월 납입 여력은 이미지에도 미리보기에도 없다.
  for (const secret of ['1980', '19800101', '60000000', '500000']) {
    assert.ok(!text.includes(secret), `미리보기에 입력값이 보입니다: ${secret}`);
  }
  await page.pressKey('Escape', 'Escape', 27);
  await sleep(200);
});

test('닫기 버튼으로도 닫힌다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(SHARE_TRIGGER);
  await page.waitFor(`!!document.querySelector('.modal-scrim [role="dialog"]')`);
  await page.clickElement(`[...document.querySelectorAll('.modal-actions button')].find((b) => b.textContent.trim() === '닫기')`);
  await sleep(250);
  assert.equal(await page.evaluate(`!!document.querySelector('.modal-scrim')`), false);
});
