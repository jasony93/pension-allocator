import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { DONUT_OPTIMAL_KICKER_LABEL } from '../copy.js';

/**
 * 「최적 월 배분표」 kicker — D45 5번(관리자, 2026-08-11) 실측.
 *
 * **왜 실측인가.** 이 낱말은 헌장이 조건부로만 허용한다("계산 대상이 명시될
 * 때만"). 조건을 지키는 것은 정적 문자열이 아니라 **kicker가 배분안 이름
 * 캡션과 실제로 같은 화면에 함께 렌더된다는 사실**이다 — jsdom 없이 순수
 * Node로는(`ui/donut-optimal-kicker.test.mjs`) 캡션이 **비어 있을 때 던지는지**
 * 만 볼 수 있고, 캡션이 **있을 때 실제로 함께 그려지는지**는 실제 렌더가
 * 있어야 본다. 이 파일이 그 절반을 잰다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — calc2도 프리필로 같은
  // 클래스(`.donut-optimal-kicker` 등, 공유 컴포넌트)를 곧장 그리므로, 이
  // 시험이 첫 탭(calculator) 것을 재려면 먼저 그 탭을 켜야 뜻이 맞는다
  // (DOM 순서상 calculator가 먼저라 querySelector 자체는 계속 그쪽을
  // 잡지만, 숨어 있으면 레이아웃 기반 실측이 위험하다).
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-calculator')`);
  await app.page.evaluate(FILL_REQUIRED_FIELDS);
  await app.page.waitFor(`!!document.querySelector('.donut-optimal-kicker')`);
  await sleep(400);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const READ = `(() => {
  const kicker = document.querySelector('.donut-optimal-kicker');
  const planName = document.querySelector('.donut-plan-name');
  const header = document.querySelector('.donut-section-header');
  return {
    kickerText: kicker ? kicker.textContent : null,
    planNameText: planName ? planName.textContent : null,
    // 자리로만 세지 않고 실제 DOM 순서로 "짝"을 확인한다 — kicker가 헤더
    // 안에, 배분안 이름 캡션과 같은 컨테이너 안에 있어야 "같은 화면에 함께"
    // 라고 말할 수 있다.
    kickerInHeader: header ? Array.from(header.children).includes(kicker) : false,
    planNameInHeader: header ? Array.from(header.children).includes(planName) : false,
  };
})()`;

test('kicker가 실제로 렌더되고 정확히 「최적 월 배분표」다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const r = await page.evaluate(READ);
  assert.equal(r.kickerText, DONUT_OPTIMAL_KICKER_LABEL, 'kicker 텍스트가 헌장이 조건부로 허용한 그 문자열과 정확히 같아야 한다');
});

test('바로 아래 배분안 이름 캡션이 "무엇에 대해 최적인지"를 진술하며 실제로 함께 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const r = await page.evaluate(READ);
  assert.ok(r.planNameText && r.planNameText.length > 0, '배분안 이름 캡션이 비어 있으면 D45 5번의 조건이 서지 않는다');
  assert.ok(r.kickerInHeader && r.planNameInHeader, 'kicker와 배분안 이름 캡션이 같은 도넛 섹션 헤더 안에 있어야 "같은 화면에 함께"라고 말할 수 있다');
});

test('대안 배분안을 미리 볼 때도 kicker는 그 배분안의 이름과 함께 남는다 — 조건이 선택마다 다시 선다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const hasAlt = await page.evaluate(`document.querySelectorAll('.stackbar-row').length >= 2`);
  if (!hasAlt) return; // 대안이 없는 픽스처면 이 검사는 뜻이 없다(다른 파일이 4안 픽스처를 쓴다).
  await page.clickElement(
    `Array.from(document.querySelectorAll('.stackbar-row')).find((r) => !r.querySelector('.stackbar-row-label').textContent.includes('기본'))`,
  );
  await sleep(300);
  const r = await page.evaluate(READ);
  assert.equal(r.kickerText, DONUT_OPTIMAL_KICKER_LABEL);
  assert.ok(r.planNameText && !r.planNameText.includes('기본'), '대안을 보고 있으므로 캡션에 "기본" 표시가 없어야 한다');
});
