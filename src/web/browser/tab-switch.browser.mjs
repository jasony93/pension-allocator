import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * 탭 확장(게이트 5 D77) — `screens.md` 2.1.2절의 세 못을 실측한다.
 *
 * - AC-R1: 탭 바에 「연금 역산기」가 「절세계좌 계산기」 오른쪽에 있다.
 * - 2.1.2절 (3): 탭 전환은 **표시 전환**이다 — 패널을 없앴다 새로 만들지
 *   않는다. 그래서 한 탭에 입력을 채운 뒤 다른 탭으로 넘어갔다 돌아와도
 *   값이 남아 있어야 한다.
 * - 2.1.2절 (4): URL 프래그먼트는 탭 id만 담는다.
 * - 첫 탭 회귀 — 탭 구조가 들어온 뒤에도 첫 탭(예시 블록·도넛·결과 패널)이
 *   그대로 동작한다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('탭 바에 두 탭이 있고, 「연금 역산기」가 「절세계좌 계산기」 오른쪽이다(AC-R1)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const tabs = await page.evaluate(`[...document.querySelectorAll('[role="tab"]')].map((t) => t.innerText.trim())`);
  assert.deepEqual(tabs, ['절세계좌 계산기', '연금 역산기']);
});

test('두 탭 패널이 동시에 DOM에 있다 — 표시 전환이지 마운트/언마운트가 아니다(2.1.2절 (3))', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const count = await page.evaluate(`document.querySelectorAll('.app-main').length`);
  assert.equal(count, 2, '.app-main이 정확히 둘 있어야 한다(탭마다 하나씩, 동시 마운트)');
  const initial = await page.evaluate(`(() => ({
    calculatorHidden: document.getElementById('tabpanel-calculator').classList.contains('tab-panel-hidden'),
    reverseHidden: document.getElementById('tabpanel-pension-reverse').classList.contains('tab-panel-hidden'),
  }))()`);
  assert.equal(initial.calculatorHidden, false, '첫 진입 기본 탭은 절세계좌 계산기다');
  assert.equal(initial.reverseHidden, true);
});

test('탭을 전환하면 URL 프래그먼트가 탭 id로 바뀐다(2.1.2절 (4))', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const state = await page.evaluate(`(() => ({
    hash: location.hash,
    calculatorHidden: document.getElementById('tabpanel-calculator').classList.contains('tab-panel-hidden'),
    reverseHidden: document.getElementById('tabpanel-pension-reverse').classList.contains('tab-panel-hidden'),
    ariaSelected: document.getElementById('tab-pension-reverse').getAttribute('aria-selected'),
  }))()`);
  assert.equal(state.hash, '#pension-reverse');
  assert.equal(state.calculatorHidden, true);
  assert.equal(state.reverseHidden, false);
  assert.equal(state.ariaSelected, 'true');

  // 되돌아간다 — 다음 시험이 기본 탭에서 시작하도록.
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  assert.equal(await page.evaluate(`location.hash`), '#calculator');
});

test('절세계좌 계산기 탭에 값을 채우고 연금 역산기로 넘어갔다 돌아와도 값이 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 6000 });
  const before = await page.evaluate(`document.getElementById('currentSalary').value`);
  assert.equal(before, '6000');

  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  // 비활성 탭이어도 DOM에서 지워지지 않았으므로 값을 여전히 읽을 수 있다.
  const whileHidden = await page.evaluate(`document.getElementById('currentSalary').value`);
  assert.equal(whileHidden, '6000', '탭이 숨어 있는 동안에도 입력 노드가 값을 그대로 갖고 있어야 한다(지우지 않았다)');

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  const after = await page.evaluate(`document.getElementById('currentSalary').value`);
  assert.equal(after, '6000', '탭을 넘어갔다 돌아와도 재입력 없이 값이 남아 있어야 한다');
  // 결과도 다시 계산할 필요 없이 그대로 남아 있다.
  assert.ok(await page.evaluate(`!!document.querySelector('.result-slot .chart-donut path')`));
});

test('연금 역산기 탭에 값을 채우고 절세계좌 계산기로 넘어갔다 돌아와도 값이 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('reverseBirthDate', '19800101'));
  await page.evaluate(set('targetMonthlyIncome', '200'));
  await page.evaluate(set('annuityStartDate', '20450101'));
  await page.evaluate(set('payoutYears', '20'));
  await page.waitFor(`!!document.querySelector('.statutory-fact-block')`, { timeoutMs: 6000 });

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  const whileHidden = await page.evaluate(`document.getElementById('targetMonthlyIncome').value`);
  assert.equal(whileHidden, '200');

  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const after = await page.evaluate(`(() => ({
    targetMonthlyIncome: document.getElementById('targetMonthlyIncome').value,
    hasStatutoryBlock: !!document.querySelector('.statutory-fact-block'),
  }))()`);
  assert.equal(after.targetMonthlyIncome, '200');
  assert.equal(after.hasStatutoryBlock, true, '결과도 재계산 없이 그대로 남아 있어야 한다');
});

test('첫 탭 회귀 — 탭 구조가 들어온 뒤에도 예시 블록·도넛·결과 패널이 그대로 동작한다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.example-showcase-slot')`);
  const exampleVisible = await page.evaluate(
    `document.querySelector('.example-showcase-slot').getBoundingClientRect().height > 0`,
  );
  assert.equal(exampleVisible, true, '예시 블록이 탭 구조 도입 후에도 렌더된다');

  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 6000 });
  await sleep(400);
  const donutBox = await page.evaluate(`(() => { const r = document.querySelector('.result-slot .chart-donut').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
  assert.ok(donutBox.width > 0 && donutBox.height > 0, `결과 도넛이 실제 크기를 갖고 그려진다: ${JSON.stringify(donutBox)}`);
});
