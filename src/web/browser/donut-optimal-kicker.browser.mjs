import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { CALC2_DONUT_OPTIMAL_KICKER_LABEL } from '../calc2-copy.js';

/**
 * 「최적 월 배분」 kicker — D45 5번(관리자, 2026-08-11) 실측.
 *
 * **왜 실측인가.** 이 낱말은 헌장이 조건부로만 허용한다("계산 대상이 명시될
 * 때만"). 조건을 지키는 것은 정적 문자열이 아니라 **kicker가 배분안 이름
 * 캡션과 실제로 같은 화면에 함께 렌더된다는 사실**이다 — jsdom 없이 순수
 * Node로는(`ui/donut-optimal-kicker.test.mjs`) 캡션이 **비어 있을 때 던지는지**
 * 만 볼 수 있고, 캡션이 **있을 때 실제로 함께 그려지는지**는 실제 렌더가
 * 있어야 본다. 이 파일이 그 절반을 잰다.
 *
 * **[2026-08-24, D84] 열린 물음 — 이 파일이 원래 재던 "같은 화면에 함께"는
 * 첫 탭(계산기2 근거판, `defaultDonutHeader`)의 것이었다.** 그 탭이 지워져
 * 이제 유일한 소비자는 calc2다. `ui/result-panel.js`(845~858행)의 코드 주석이
 * 이미 이 긴장을 명시로 적어 뒀다 — **calc2는 `donutOptimalKicker`의 가드
 * (배분안 이름 캡션 없이는 던진다)는 그대로 지키지만, 그 캡션 문단 자체를
 * 화면에서 지웠다**(관리자 지시(신규 회차) 3번을 그대로 따른 결과, tax-domain
 * 판정 대상 밖). 즉 "무엇에 대해 최적인지"는 calc2 어디에도 문장으로 남지
 * 않는다 — 가드가 여전히 무는 것("계산 대상이 있다는 사실")은 참이지만,
 * 그 계산 대상 이름이 화면에 보이지는 않는다. **이 회차(D84)가 새로 만든
 * 긴장이 아니다** — D82-era 구현이 이미 자기 보고에 열린 물음으로 올려
 * 뒀던 것이, 첫 탭 삭제로 "앱 전체에서 이 조건을 시각적으로 충족하는 화면이
 * 하나도 안 남았다"는 형태로 다시 떠올랐다. 아래 시험은 **지금 실제로 참인
 * 것**(가드가 물고, kicker 문구가 정확하다)만 잠그고, 아직 안 참인 것(캡션이
 * 화면에 보인다)은 강제로 통과시키지 않는다 — 관리자 보고에 그대로 다시
 * 올린다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-24, D84] calc2가 유일한 계산 탭이자 기본 활성 탭이라 명시
  // 탭 전환·필드 채움이 더는 필요 없다 — 로드와 동시에 프리필로 결과가
  // 선다(D79 판정 2), 이 컴포넌트(`.donut-optimal-kicker` 등, 공유
  // 컴포넌트)도 함께 곧장 그려진다.
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.waitFor(`!!document.querySelector('.donut-optimal-kicker')`);
  await sleep(400);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const READ = `(() => {
  const kicker = document.querySelector('.donut-optimal-kicker');
  return { kickerText: kicker ? kicker.textContent : null };
})()`;

test('kicker가 실제로 렌더되고 정확히 「최적 월 배분」(calc2 문구)이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const r = await page.evaluate(READ);
  assert.equal(
    r.kickerText,
    CALC2_DONUT_OPTIMAL_KICKER_LABEL,
    'kicker 텍스트가 calc2 전용 라벨(CALC2_DONUT_OPTIMAL_KICKER_LABEL)과 정확히 같아야 한다',
  );
});

/**
 * [2026-08-24, D84] 렌더가 이 자리까지 도달했다는 것 자체가 이미
 * `donutOptimalKicker`의 가드(캡션 없이는 예외를 던진다)를 실제로 통과했다는
 * 증거다 — 렌더가 죽지 않고 kicker가 화면에 서 있다는 사실이 "계산 대상이
 * 명시됐다"(가드가 확인하는 조건)를 실측으로 증명한다. **그 계산 대상
 * 이름이 화면에 문장으로 보이는지는 별개다** — 위 파일 머리말의 열린 물음
 * 그대로, calc2는 그 문단을 지웠다. 이 시험은 "안 보인다"는 사실 자체를
 * 잠근다(회귀가 반대 방향—즉 다시 보이기 시작하는 것—으로 조용히 나면
 * 이 시험이 실패해 알려준다. 그때는 이 시험도 다시 뒤집어야 한다).
 */
test('D84 열린 물음 — calc2는 kicker 가드를 통과하지만, 배분안 이름 캡션 문장은 화면에 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const r = await page.evaluate(`(() => ({
    kickerExists: !!document.querySelector('.donut-optimal-kicker'),
    planNameExists: !!document.querySelector('.donut-plan-name'),
  }))()`);
  assert.equal(r.kickerExists, true, 'kicker가 렌더되지 않았다 — 가드를 통과하지 못했다는 뜻이다(계산 대상이 없다는 것과 같다)');
  assert.equal(
    r.planNameExists,
    false,
    'calc2 화면에 배분안 이름 캡션(.donut-plan-name)이 다시 생겼다 — D45 5번을 시각적으로 다시 충족하게 됐다면 이 시험을 뒤집고 열린 물음을 닫아라',
  );
});

test('대안 배분안을 미리 볼 때도 kicker는 화면에서 사라지지 않는다 — 재렌더가 가드를 다시 통과한다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const hasAlt = await page.evaluate(`document.querySelectorAll('.stackbar-row').length >= 2`);
  if (!hasAlt) return; // 대안이 없는 픽스처면 이 검사는 뜻이 없다.
  await page.clickElement(
    `Array.from(document.querySelectorAll('.stackbar-row')).find((r) => !r.querySelector('.stackbar-row-label').textContent.includes('기본'))`,
  );
  await sleep(300);
  const r = await page.evaluate(READ);
  assert.equal(r.kickerText, CALC2_DONUT_OPTIMAL_KICKER_LABEL, '대안을 미리 보는 동안 kicker가 사라지거나 문구가 바뀌었다');
});
