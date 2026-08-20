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

/** [2026-08-20, D79] 탭이 셋으로 늘었다 — 「절세계좌 계산기 | 절세계좌 계산기2 | 연금 역산기」. */
test('탭 바에 세 탭이 있고, 순서가 「절세계좌 계산기 | 절세계좌 계산기2 | 연금 역산기」다(D79)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const tabs = await page.evaluate(`[...document.querySelectorAll('[role="tab"]')].map((t) => t.innerText.trim())`);
  assert.deepEqual(tabs, ['절세계좌 계산기', '절세계좌 계산기2', '연금 역산기']);
});

test('세 탭 패널이 동시에 DOM에 있다 — 표시 전환이지 마운트/언마운트가 아니다(2.1.2절 (3), D79로 셋)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const count = await page.evaluate(`document.querySelectorAll('.app-main').length`);
  assert.equal(count, 3, '.app-main이 정확히 셋 있어야 한다(탭마다 하나씩, 동시 마운트)');
  const initial = await page.evaluate(`(() => ({
    calculatorHidden: document.getElementById('tabpanel-calculator').classList.contains('tab-panel-hidden'),
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
    reverseHidden: document.getElementById('tabpanel-pension-reverse').classList.contains('tab-panel-hidden'),
  }))()`);
  assert.equal(initial.calculatorHidden, false, '첫 진입 기본 탭은 절세계좌 계산기다');
  assert.equal(initial.calc2Hidden, true);
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

/**
 * [2026-08-19, 관리자 지시 — 번들 실측 결함] 예시 블록(고정 페르소나 도넛)이
 * 탭 패널 밖에 있어 「연금 역산기」 탭에서도 그대로 보이던 결함. **"있다 ≠
 * 보인다"** — `getBoundingClientRect`로 실제 0×0인지까지 확인한다(`display:
 * none`이 걸렸는지는 존재 여부만으로는 알 수 없다).
 */
test('예시 블록은 「절세계좌 계산기」 탭에서만 보이고, 「연금 역산기」 탭에서는 0×0이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.example-showcase-slot')`);

  const onCalculator = await page.evaluate(
    `(() => { const r = document.querySelector('.example-showcase-slot').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`,
  );
  assert.ok(onCalculator.width > 0 && onCalculator.height > 0, `절세계좌 계산기 탭에서는 예시 블록이 보여야 한다: ${JSON.stringify(onCalculator)}`);

  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(200);
  const onReverse = await page.evaluate(
    `(() => { const r = document.querySelector('.example-showcase-slot').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`,
  );
  assert.deepEqual(onReverse, { width: 0, height: 0 }, `연금 역산기 탭에서는 예시 블록이 실제로 0×0이어야 한다(있다 ≠ 보인다): ${JSON.stringify(onReverse)}`);

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(200);
  const backOnCalculator = await page.evaluate(
    `(() => { const r = document.querySelector('.example-showcase-slot').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`,
  );
  assert.ok(backOnCalculator.width > 0 && backOnCalculator.height > 0, `첫 탭으로 돌아오면 예시 블록이 다시 보여야 한다: ${JSON.stringify(backOnCalculator)}`);
});

/**
 * [2026-08-20, 관리자 지시(2차) 6번] 로고를 누르면 첫 랜딩(첫 탭 활성 +
 * 페이지 맨 위)으로 돌아간다 — **입력값은 지우지 않는다.** 연금 역산기
 * 탭에 값을 채운 채로 로고를 누르고, (1) 활성 탭이 절세계좌 계산기로
 * 바뀌고 (2) 스크롤이 맨 위로 오고 (3) 역산기 탭에 채운 값이 그대로
 * 남아 있는지(탭을 다시 눌러 확인) 잰다.
 */
test('로고를 누르면 첫 탭이 활성화되고 페이지 맨 위로 스크롤된다(입력값은 지우지 않는다)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.app-header-logo-button')`, { timeoutMs: 8000 });

  // 역산기 탭에 값을 채우고, 그 탭이 활성인 채로 아래로 스크롤한다.
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('reverseBirthDate', '19800101'));
  await page.evaluate(set('targetMonthlyIncome', '250'));
  await page.evaluate(`window.scrollTo(0, 600)`);
  await sleep(100);
  const beforeScroll = await page.evaluate('window.scrollY');
  assert.ok(beforeScroll > 200, `로고 클릭 전 스크롤 위치(${beforeScroll})가 이미 맨 위다 — 이 검사가 스크롤 이동을 관측할 수 없다`);

  await page.clickElement(`document.querySelector('.app-header-logo-button')`);
  await page.waitFor(`document.getElementById('tab-calculator').getAttribute('aria-selected') === 'true'`, { timeoutMs: 3000 });
  // smooth 스크롤이 멈출 때까지 폴링한다 — 고정 sleep은 예시영역 폰트 50%
  // 확대(관리자 지시(3차) 5번)로 페이지가 훨씬 길어지며 이따금 300ms 안에
  // 완전히 안 멎는 것을 실측으로 확인했다(스크롤 자체는 정상 — 속도 문제일
  // 뿐이다).
  await page.waitFor(`window.scrollY < 50`, { timeoutMs: 3000 });

  const after = await page.evaluate(`(() => ({
    activeTab: document.getElementById('tab-calculator').getAttribute('aria-selected'),
    calculatorHidden: document.getElementById('tabpanel-calculator').classList.contains('tab-panel-hidden'),
    scrollY: window.scrollY,
  }))()`);
  assert.equal(after.activeTab, 'true', '로고를 눌러도 첫 탭이 활성화되지 않았다');
  assert.equal(after.calculatorHidden, false, '로고를 눌러도 첫 탭 패널이 여전히 숨어 있다');
  assert.ok(after.scrollY < 50, `로고를 눌렀는데 페이지가 맨 위로 스크롤되지 않았다(scrollY=${after.scrollY})`);

  // 입력값은 지워지지 않았다 — 역산기 탭으로 돌아가 확인한다.
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const preserved = await page.evaluate(`document.getElementById('targetMonthlyIncome').value`);
  assert.equal(preserved, '250', '로고 클릭이 역산기 탭에 채운 입력값을 지웠다 — 지우지 않는다는 지시였다');
});

/** [2026-08-20, 관리자 지시(2차) 6번] 커서·접근성 시맨틱 — 버튼이고, 커서가 포인터다. */
test('로고 버튼이 <button> 시맨틱이고, 커서가 pointer다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => {
    const btn = document.querySelector('.app-header-logo-button');
    return {
      tagName: btn ? btn.tagName : null,
      type: btn ? btn.getAttribute('type') : null,
      ariaLabel: btn ? btn.getAttribute('aria-label') : null,
      cursor: btn ? getComputedStyle(btn).cursor : null,
    };
  })()`);
  assert.equal(m.tagName, 'BUTTON', '로고가 버튼 시맨틱이 아니다');
  assert.equal(m.type, 'button');
  assert.ok(m.ariaLabel, '로고 버튼에 접근성 레이블(aria-label)이 없다');
  assert.equal(m.cursor, 'pointer', `로고 버튼 커서가 pointer가 아니다: ${m.cursor}`);
});

/** [2026-08-20, 관리자 지시(2차) 7번] 활성 탭 밑줄 색 — `rgb(230, 115, 0)`. */
test('활성 탭 밑줄 색이 rgb(230, 115, 0)이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const borderColor = await page.evaluate(`getComputedStyle(document.querySelector('.app-tab-active')).borderBottomColor`);
  assert.equal(borderColor, 'rgb(230, 115, 0)', `활성 탭 밑줄 색이 rgb(230, 115, 0)이 아니다: ${borderColor}`);
});
