import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { AMOUNT_CARD_LABEL_CREDIT_ONLY, AMOUNT_CARD_LABEL_COMPOSITE, AMOUNT_CARD_LABEL_DELTA } from '../copy.js';

/**
 * 합계 헤드라인은 기본안일 때만 — D45 3번(관리자, 2026-08-11) 실측.
 *
 * 소유자가 대안(「ISA를 먼저 채우는 배분」) 미리보기에서 확정 성분이 0인
 * 합계 구간(「최소 0원 ~ 최대 567,600원」)을 보고 "기본안만 붙여줘"라고
 * 답했다. **판정: 대안을 미리 보는 동안 헤드라인 자리에는 스택바 비교 행이
 * 이미 낸 「기본안 대비 차이」가 오고, 화면은 그 값을 새로 계산하지 않는다.**
 *
 * 이 검사는 세 가지를 실측한다 — (1) 기본안 렌더 시 정상 헤드라인, (2) 대안을
 * 눌렀을 때 라벨·값이 델타로 바뀌고 **그 값이 스택바 행의 값과 글자 그대로
 * 같다**, (3) 기본으로 되돌리면 원래 헤드라인이 복원된다. jsdom 없이 실제
 * 클릭·재렌더를 거쳐야만 나는 결함(예: 이전 플랜의 값이 남는 고쳐쓰기 버그)
 * 을 여기서만 잡을 수 있다.
 */

const SET = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const CLICK = (id) => `document.getElementById(${JSON.stringify(id)}).click()`;

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  const { page } = app;
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — 이 시험은 첫 탭 안에서
  // 좌표 기반 클릭을 쓰는데(대안 미리보기 스택바 행), 그 탭이 숨어 있으면
  // 클릭이 빗나간다. 먼저 켠다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  // 구성 두 줄(슬롯5)까지 함께 검사하려면 헤드라인이 구간 변형(가정 성분 포함)
  // 이어야 한다 — ISA 계좌를 켜서 그 상태를 만든다(account-benefit-strip.browser.mjs
  // 와 같은 픽스처).
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await sleep(150);
  await page.evaluate(CLICK('isaExists-true'));
  await page.waitFor(`!!document.getElementById('isaCumulative')`);
  await page.evaluate(CLICK('isaAccountType-general'));
  await sleep(150);
  await page.evaluate(SET('isaCumulative', '0'));
  await sleep(150);
  await page.evaluate(CLICK('isaReturnEnabled-true'));
  await page.waitFor(`!!document.getElementById('isaReturnRatePercent')`);
  await page.evaluate(SET('isaReturnRatePercent', '7'));
  await sleep(150);
  await page.evaluate(CLICK('isaIncomeCharacter-interest_dividend'));
  await sleep(150);
  await page.evaluate(SET('isaSettlementYears', '5'));
  await sleep(150);
  await page.waitFor(`document.querySelectorAll('.stackbar-row').length >= 2`);
  await sleep(500);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const READ_HEADLINE = `(() => {
  return {
    label: document.querySelector('.amount-card-label')?.textContent ?? null,
    value: document.querySelector('.amount-card-value')?.textContent ?? null,
    hasComposition: !!document.querySelector('.amount-card-composition'),
  };
})()`;

test('기본안이 그려질 때 헤드라인은 합계(세액공제액/절세액)를 보이고, 가정 성분이 있으면 구성 두 줄이 함께 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const h = await page.evaluate(READ_HEADLINE);
  assert.ok(
    h.label === AMOUNT_CARD_LABEL_CREDIT_ONLY || h.label === AMOUNT_CARD_LABEL_COMPOSITE,
    `기본안 헤드라인 라벨이 예상 밖입니다: ${h.label}`,
  );
  assert.notEqual(h.label, AMOUNT_CARD_LABEL_DELTA, '기본안을 보고 있는데 대안 델타 라벨이 나오면 안 된다');
  assert.ok(h.value && h.value.length > 0, '헤드라인 값이 비어 있다');
  if (h.label === AMOUNT_CARD_LABEL_COMPOSITE) {
    assert.ok(h.hasComposition, '절세액(구성 성분 포함) 라벨인데 구성 두 줄이 없다 — design-system 5.6절 "구간 변형" 위반');
  }
});

test('대안 행을 누르면 헤드라인이 「기본안 대비 세액공제액 차이」로 바뀌고, 그 값은 스택바 행의 값과 글자 그대로 같다 — 새로 계산하지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const altRowAmount = await page.evaluate(`(() => {
    const row = Array.from(document.querySelectorAll('.stackbar-row')).find((r) => !r.querySelector('.stackbar-row-label').textContent.includes('기본'));
    return row ? row.querySelector('.stackbar-row-amount').textContent.trim() : null;
  })()`);
  assert.ok(altRowAmount, '대안 행을 찾지 못했다 — 픽스처가 최소 2개의 배분안을 내야 한다');
  assert.notEqual(altRowAmount, '기본', '대안 행이 "기본"이면 클릭 대상 선택이 잘못됐다');

  await page.clickElement(
    `Array.from(document.querySelectorAll('.stackbar-row')).find((r) => !r.querySelector('.stackbar-row-label').textContent.includes('기본'))`,
  );
  await page.waitFor(`document.querySelector('.amount-card-label')?.textContent === ${JSON.stringify(AMOUNT_CARD_LABEL_DELTA)}`, { timeoutMs: 3000 });

  const h = await page.evaluate(READ_HEADLINE);
  assert.equal(h.label, AMOUNT_CARD_LABEL_DELTA);
  assert.equal(h.value, altRowAmount, `헤드라인 값(${h.value})이 스택바 행 값(${altRowAmount})과 글자 그대로 같아야 한다 — 화면이 새로 계산하면 안 된다`);
  assert.ok(!h.hasComposition, '합계가 없는데 구성 두 줄이 남아 있으면 안 된다 — 합계가 없으면 그 두 줄이 무엇의 구성인지 말할 대상이 없다(D45 3번)');
});

test('다시 기본안 행을 누르면 원래 헤드라인이 복원된다 — 대안 상태가 남지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(
    `Array.from(document.querySelectorAll('.stackbar-row')).find((r) => r.querySelector('.stackbar-row-label').textContent.includes('기본'))`,
  );
  await page.waitFor(`document.querySelector('.amount-card-label')?.textContent !== ${JSON.stringify(AMOUNT_CARD_LABEL_DELTA)}`, { timeoutMs: 3000 });
  const h = await page.evaluate(READ_HEADLINE);
  assert.notEqual(h.label, AMOUNT_CARD_LABEL_DELTA);
  assert.ok(
    h.label === AMOUNT_CARD_LABEL_CREDIT_ONLY || h.label === AMOUNT_CARD_LABEL_COMPOSITE,
    `기본안으로 되돌아갔는데 라벨이 예상 밖입니다: ${h.label}`,
  );
});
