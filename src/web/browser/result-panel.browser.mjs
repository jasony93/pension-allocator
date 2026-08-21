import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

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
 * **저장·공유 모달 관련 검사는 이 파일에서 걷어냈다(2026-08-10).** 소유자
 * 지시로 "공유용 이미지 만들기"(캔버스 PNG + 미리보기 모달)가 PDF 내보내기
 * (`window.print()`)로 바뀌면서 모달 자체가 없어졌다 — 그 검사들은
 * `browser/print.browser.mjs`가 인쇄 레이아웃(`@media print`) 검사로
 * 대신한다. `ui/modal.js`는 여전히 초기화 확인 대화상자가 쓰므로
 * `browser/sandboxed-frame.browser.mjs`가 계속 본다.
 */

const PDF_TRIGGER = `[...document.querySelectorAll('.save-share button')].find((b) => b.textContent.trim() === 'PDF로 저장')`;

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — 첫 탭(`calculator`)이
  // 숨어 있으면 (1) 이 탭 필드에 좌표 클릭이 안 먹고, (2) `.save-share
  // button`을 문서 전체로 찾을 때 계산기2 쪽(프리필로 이미 결과가 서
  // 있다)이 먼저 걸릴 수 있다. 먼저 명시로 켠다.
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-calculator')`);
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
  // 클릭이 실제로 버튼에 도달했는지는 `window.print()`가 불렸는지로 잰다 —
  // 헤드리스·비샌드박스 최상위 프레임에서는 `window.print()`가 `beforeprint`를
  // 동기로 낸다(`ui/print.js` 머리말이 실측해 둔 그대로).
  await page.evaluate(`(() => { window.__printed = false; window.addEventListener('beforeprint', () => { window.__printed = true; }, { once: true }); })()`);
  await page.clickElement(PDF_TRIGGER);
  await page.waitFor(`window.__printed === true`, { timeoutMs: 2000 });
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
    // 만원 단위다(6절) — '120'은 1,200,000원. FILL_REQUIRED_FIELDS의 기본값
    // 500,000원과 다른 값이면 충분하다.
    el.focus(); el.value = '120'; el.dispatchEvent(new Event('input', { bubbles: true })); el.blur();
  })()`);
  await page.waitFor(`${readAmount} !== ${JSON.stringify(before)}`, { timeoutMs: 4000 });
  const after = await page.evaluate(readAmount);
  assert.notEqual(after, before);
  // 도넛도 함께 갱신됐는지 — SVG는 네임스페이스가 달라 고쳐 쓰기가 가장 위험한 자리다.
  assert.equal(await page.evaluate(`!!document.querySelector('.result-slot svg path')`), true);
});

test('결과가 나와야 PDF로 저장 버튼이 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(await page.evaluate(`!!document.querySelector('.save-share')`), true);
  assert.equal(await page.evaluate(`!!(${PDF_TRIGGER})`), true);
});
