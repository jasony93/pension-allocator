import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * 입력 칸 클릭이 한 번에 먹지 않던 결함의 실측.
 *
 * **합성 `MouseEvent`로는 재현되지 않는다** — 합성 이벤트는 브라우저가 초점을
 * 옮기지 않으므로 `blur`가 나지 않고, 그러면 문제의 연쇄가 시작되지 않는다.
 * 진짜 마우스 입력(`Input.dispatchMouseEvent`)이라야 나타난다.
 *
 * 고치기 전 이 검사는 25회 중 12회 실패했고, 실패는 **한 번 걸러 하나꼴로**
 * 났다 — 이전 칸에 초점이 있을 때만 `blur → 재계산 → 재렌더`가 방금 클릭한
 * 노드를 갈아치웠기 때문이다.
 */

const FIELDS = ['birthDate', 'currentSalary', 'monthlyCapacity', 'annuitySavingsYtd', 'retirementPensionYtd'];
const byId = (id) => `document.getElementById(${JSON.stringify(id)})`;

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

async function clickAndReadFocus(page, id) {
  await page.clickElement(byId(id));
  await sleep(70);
  return page.evaluate(`document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'null'`);
}

test('진짜 마우스로 입력 칸을 25회 눌러 초점 실패 0건', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const failures = [];
  for (let i = 0; i < 25; i++) {
    const id = FIELDS[i % FIELDS.length];
    const active = await clickAndReadFocus(page, id);
    if (active !== id) failures.push(`${i}: ${id} -> ${active}`);
  }
  assert.deepEqual(failures, [], `클릭 25회 중 ${failures.length}회 초점이 붙지 않았습니다`);
});

test('클릭과 타이핑을 섞어도 초점이 붙어 있다 — blur가 실제로 재계산을 거는 경로', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const failures = [];
  for (let i = 0; i < 12; i++) {
    const id = FIELDS[i % FIELDS.length];
    await page.clickElement(byId(id));
    await sleep(60);
    await page.typeText('1');
    await sleep(80);
    const active = await page.evaluate(`document.activeElement ? (document.activeElement.id || '') : 'null'`);
    if (active !== id) failures.push(`${i}: ${id} -> ${active}`);
  }
  assert.deepEqual(failures, [], '타이핑 뒤 재렌더가 초점을 떨어뜨렸습니다');
});

test('결과가 나온 뒤에도 클릭이 한 번에 먹는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await sleep(900);
  assert.equal(await page.evaluate(`!!document.querySelector('.result-panel-inner')`), true, '결과 패널이 나와야 한다');

  const failures = [];
  for (let i = 0; i < 10; i++) {
    const id = FIELDS[i % FIELDS.length];
    const active = await clickAndReadFocus(page, id);
    if (active !== id) failures.push(`${i}: ${id} -> ${active}`);
  }
  assert.deepEqual(failures, [], '결과가 있는 상태에서 실패했습니다');
});

/**
 * `renderGuard`가 막고 있던 것 — "렌더 → 초점 노드 제거 → blur → 재계산 →
 * 재렌더 → …" 무한 루프다. 노드를 재사용하게 바꿔도 **교체 경로는 남아 있으므로**
 * 가드는 그대로 있어야 하고, 그 시나리오가 되살아나지 않았는지 여기서 확인한다.
 */
test('조건부 블록을 켜고 끄며 blur를 연쇄시켜도 무한 루프·크래시가 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const before = page.pageErrors.length;
  for (let round = 0; round < 12; round++) {
    await page.evaluate(`document.getElementById('isaExists-${round % 2 === 0 ? 'true' : 'false'}').click()`);
    await sleep(50);
    await page.evaluate(`(() => {
      const el = document.getElementById('currentSalary');
      el.focus();
      el.value = '6000000${round % 10}';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.blur();
    })()`);
    await sleep(50);
  }
  await sleep(600);
  // 페이지가 아직 살아 있고 응답한다 = 렌더 루프에 갇히지 않았다.
  assert.equal(await page.evaluate(`document.readyState`), 'complete');
  assert.equal(await page.evaluate(`!!document.querySelector('.input-panel')`), true);
  assert.deepEqual(page.pageErrors.slice(before), [], '렌더 중 예외가 발생했습니다');
});

test('체크박스·세그먼트 버튼을 눌러도 조건부 블록이 즉시 나타난다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.getElementById('isaExists-false').click()`);
  await sleep(120);
  assert.equal(await page.evaluate(`!!document.getElementById('isaCumulative')`), false);
  await page.clickElement(`document.getElementById('isaExists-true')`);
  await sleep(150);
  assert.equal(await page.evaluate(`!!document.getElementById('isaCumulative')`), true, '조건부 노출이 즉시 반영되어야 한다');
  // 실시간 반영은 소유자가 정한 화면 구성이다 — 오른쪽 결과도 같은 상호작용으로 갱신된다.
  assert.equal(await page.evaluate(`!!document.querySelector('.result-panel-inner')`), true);
});
