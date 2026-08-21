import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

/**
 * [2026-08-19, 관리자 지시 — 번들 실측 결함] 1440px에서 역산기 결과 영역이
 * 문서 밖(가로 스크롤 1896px)으로 밀려나던 결함의 회귀 방지.
 *
 * 원인 둘 — (1) `.reverse-result-slot`가 플렉스 항목인데 `min-width`가
 * `auto`(기본값)라 안의 내용 크기만큼 자동 최소 크기를 가져 컨테이너보다
 * 커질 수 있었다. (2) `ContributionAmountBar`의 도넛이 첫 탭 전용 넓은
 * 모드(`labelledWide`, 상자 684px)로 그려져 옆의 배분표(최소 560px)와
 * 한 행에 나란히 설 수 없었다. 이 파일은 1440px·375px 두 폭에서
 * "문서 가로 스크롤 없음"과 "배분표 오른쪽 끝이 뷰포트 안"을 잰다.
 */

let app;

async function fillReverseCore(page) {
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — 첫 로드(또는 재로드)부터
  // 예시 팝업이 뜰 수 있어(스크림이 아래 좌표 클릭을 가릴 수 있다) 먼저
  // 치운다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(200);
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('reverseBirthDate', '19800101'));
  await page.evaluate(set('targetMonthlyIncome', '200'));
  await page.evaluate(set('annuityStartDate', '20450101'));
  await page.evaluate(set('payoutYears', '20'));
  await page.evaluate(set('averageReturnRatePercent', '5'));
  await page.waitFor(`!!document.querySelector('.contribution-amount-bar .account-table')`, { timeoutMs: 6000 });
  await sleep(400);
}

const READ_LAYOUT = `(() => {
  const table = document.querySelector('.contribution-amount-bar .account-table');
  const donut = document.querySelector('.contribution-amount-bar .chart-donut');
  const tableRect = table ? table.getBoundingClientRect() : null;
  const donutRect = donut ? donut.getBoundingClientRect() : null;
  return {
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    tableRight: tableRect ? Math.round(tableRect.right) : null,
    donutWidth: donutRect ? Math.round(donutRect.width) : null,
  };
})()`;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

for (const width of [1440, 375]) {
  test(`${width}px — 문서에 가로 스크롤이 생기지 않고, 배분표 오른쪽 끝이 뷰포트 안에 있다`, { skip: skipWithoutChrome }, async () => {
    const { page } = app;
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await page.goto(`${app.origin}/src/web/index.html`);
    await fillReverseCore(page);

    const state = await page.evaluate(READ_LAYOUT);
    assert.equal(
      state.docScrollWidth,
      state.docClientWidth,
      `${width}px에서 문서 가로 스크롤이 생겼다(scrollWidth=${state.docScrollWidth}, clientWidth=${state.docClientWidth})`,
    );
    assert.ok(state.tableRight !== null, '배분표가 실제로 그려져야 한다');
    assert.ok(
      state.tableRight <= state.docClientWidth,
      `배분표 오른쪽 끝(${state.tableRight})이 뷰포트 폭(${state.docClientWidth}) 밖에 있다`,
    );

    await page.send('Emulation.clearDeviceMetricsOverride');
  });
}

test('1440px에서 도넛은 첫 탭의 넓은 모드(684px 상자)가 아니라 배분표와 나란히 설 수 있는 크기로 줄어든다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${app.origin}/src/web/index.html`);
  await fillReverseCore(page);

  const state = await page.evaluate(READ_LAYOUT);
  assert.ok(state.donutWidth !== null && state.donutWidth > 0, '도넛이 실제로 그려져야 한다');
  assert.ok(
    state.donutWidth < 400,
    `도넛 상자가 ${state.donutWidth}px다 — 첫 탭의 labelledWide 크기(684px 안팎)를 그대로 쓰면 배분표와 한 행에 서지 못한다`,
  );

  await page.send('Emulation.clearDeviceMetricsOverride');
});
