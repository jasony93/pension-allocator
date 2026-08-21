import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

/**
 * 연금 역산기 탭의 예시 블록(게이트 5 D78 ②, `screens.md` 14.1.1절,
 * `design-system.md` 5.32.1절) 실측.
 *
 * **"있다 ≠ 보인다"** — 절세계좌 계산기 탭이 활성일 때 이 예시는 DOM에서
 * 지워지지 않는다(2.1.2절 (3) 표시 전환 원칙) — `getBoundingClientRect`가
 * 실제로 0×0인지까지 잰다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — 첫 로드부터 예시 팝업이
  // 뜰 수 있어(스크림이 아래 좌표 클릭을 가릴 수 있다) 먼저 치운다.
  await dismissCalc2ExampleModalIfOpen(app.page);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const READ_REVERSE_EXAMPLE = `(() => {
  const host = document.querySelector('.reverse-example-showcase-slot');
  const r = host.getBoundingClientRect();
  const sr = host.shadowRoot;
  const donut = sr?.querySelector('.chart-donut');
  const donutBox = donut ? donut.getBoundingClientRect() : null;
  return {
    hostVisible: r.width > 0 && r.height > 0,
    hasDonut: !!donut,
    donutVisible: donutBox ? donutBox.width > 0 && donutBox.height > 0 : false,
    questionText: sr?.querySelector('.example-showcase-question-text')?.textContent ?? null,
    conditionText: sr?.querySelector('.reverse-example-showcase-condition p')?.textContent ?? null,
    inputLines: sr ? [...sr.querySelectorAll('.example-showcase-input-line')].map((p) => p.textContent) : [],
  };
})()`;

test('절세계좌 계산기 탭에서는 역산기 예시가 실제로 0×0이다(있다 ≠ 보인다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!document.querySelector('.reverse-example-showcase-slot')`);
  await sleep(500);
  const state = await page.evaluate(READ_REVERSE_EXAMPLE);
  assert.equal(state.hostVisible, false, '첫 탭이 활성일 때 역산기 예시는 화면에 그려지지 않아야 한다');
});

test('연금 역산기 탭에서는 예시가 보이고, 무성장 캡션이 접히지 않고 항상 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(300);
  const state = await page.evaluate(READ_REVERSE_EXAMPLE);
  assert.equal(state.hostVisible, true, '역산기 탭이 활성이면 예시가 보여야 한다');
  assert.equal(state.hasDonut, true, '엔진으로 계산한 AccountDonut이 있어야 한다');
  assert.equal(state.donutVisible, true, '도넛이 실제로 0×0이 아니어야 한다');
  assert.match(state.questionText ?? '', /김철수씨가 만 60세부터 매달 200만원을/);
  assert.deepEqual(state.inputLines, ['나이: 만 30세', '연금개시일: 만 60세', '월 연금 수령액: 200만원']);
  assert.equal(state.conditionText, '연 0%(무성장) 기준으로 계산했습니다', '무성장 조건절이 항상 보여야 한다(design-system 5.32.1절)');
});

test('다시 절세계좌 계산기 탭으로 돌아오면 역산기 예시는 다시 0×0, 첫 탭 예시는 정상 노출된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(300);
  const state = await page.evaluate(READ_REVERSE_EXAMPLE);
  assert.equal(state.hostVisible, false);

  const firstTabExampleBox = await page.evaluate(
    `(() => { const r = document.querySelector('.example-showcase-slot').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`,
  );
  assert.ok(firstTabExampleBox.width > 0 && firstTabExampleBox.height > 0, '첫 탭 예시는 그대로 정상 노출되어야 한다(회귀 확인)');
});
