import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { encodeShareFragment, encodeShareFragmentV1 } from '../state/share-link.js';
import { initialForm } from '../state/store.js';

/**
 * 결과 공유 링크(관리자 지시 7번, D74) — 실제 브라우저 실측.
 *
 * `node --test`(jsdom 없음)로는 페이지 로드 시점의 프래그먼트 처리
 * (`ui/app.js`)·클립보드 API·실제 URL(`location.hash`)을 잴 수 없다. 이
 * 파일은 그 셋을 실제 Chrome으로 확인한다.
 */

const apps = [];
async function openTracked(opts) {
  const app = await openApp(opts);
  apps.push(app);
  return app;
}

after(async () => {
  await Promise.all(apps.map((a) => a.close()));
});

test('D74 — 「내 결과 공유하기」를 누르면 「이 링크에는 입력하신 값이 들어 있습니다」가 반드시 함께 보인다', { skip: skipWithoutChrome }, async () => {
  const app = await openTracked();
  const { page } = app;
  // [2026-08-21, D81] 기본 탭이 이제 calc2다 — `FILL_REQUIRED_FIELDS`는
  // 첫 탭(`calculator`) 필드를 채우지만, 그 탭 패널이 숨어 있으면(D81 전
  // 에는 기본이라 숨을 일이 없었다) `.save-share button`을 문서 전체
  // 질의로 찾을 때 계산기2 쪽(이미 프리필로 결과가 서 있다)이 먼저 걸리거나,
  // 첫 탭 버튼이 숨은 채(0×0) 좌표 클릭을 놓친다. 첫 로드부터 뜰 수 있는
  // 예시 팝업(스크림)도 먼저 치운 뒤, 명시로 이 탭을 켠다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.save-share button')`);
  await sleep(400);

  const before = await page.evaluate(`document.querySelector('.share-link-note').textContent`);
  assert.equal(before, '', '클릭 전에는 공유 안내가 비어 있어야 한다');

  await page.clickElement(`[...document.querySelectorAll('.save-share button')].find((b) => b.textContent.trim() === '내 결과 공유하기')`);
  await page.waitFor(`document.querySelector('.share-link-note').textContent !== ''`, { timeoutMs: 3000 });
  const after = await page.evaluate(`document.querySelector('.share-link-note').textContent`);
  // D74의 조건 자체 — 성공(복사됨)이든 실패(자동 복사 실패)든 이 문구가
  // 먼저 온다. 어느 경로를 탔는지는 환경(클립보드 권한)에 따라 갈리므로
  // 문구 앞부분만 고정해서 잰다.
  assert.ok(
    after.startsWith('이 링크에는 입력하신 값이 들어 있습니다'),
    `공유 안내에 D74가 요구하는 문구가 없습니다: "${after}"`,
  );
});

test('D74 — 공유 URL은 프래그먼트(#)에 실린다. 네트워크 쿼리로 나갈 방법이 없다(location.search가 비어 있다)', { skip: skipWithoutChrome }, async () => {
  const app = await openTracked();
  const { page } = app;
  // [2026-08-21, D81] 위 시험과 같은 이유로 먼저 팝업을 치우고 첫 탭을 켠다.
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.save-share button')`);
  await sleep(400);
  await page.clickElement(`[...document.querySelectorAll('.save-share button')].find((b) => b.textContent.trim() === '내 결과 공유하기')`);
  await page.waitFor(`document.querySelector('.share-link-note').textContent !== ''`, { timeoutMs: 3000 });

  const location = await page.evaluate(`({ search: location.search, hash: location.hash })`);
  // 버튼이 URL을 페이지 자신에 반영하지는 않는다(클립보드로만 나간다) —
  // 그래서 이 검사는 "이 페이지의 현재 위치가 쿼리로 오염되지 않았다"만
  // 확인한다(구조적 보장). 프래그먼트 인코딩 자체는 아래(로드) 검사와
  // `state/share-link.test.mjs`가 왕복까지 확인한다.
  assert.equal(location.search, '', '공유 버튼을 눌러도 현재 페이지의 쿼리 문자열이 생기면 안 된다');
});

test('D74 — 공유 링크로 열면 입력이 채워지고 계산까지 실행된다(입력을 다시 치지 않아도 결과가 뜬다)', { skip: skipWithoutChrome }, async () => {
  const form = {
    ...initialForm(),
    birthDate: '1993-04-17',
    currentSalary: '4000',
    hasNonWageIncome: false,
    monthlyCapacity: '50',
    annuityStarted: false,
    fundUseHorizon: 'before_pension_age',
  };
  const fragment = encodeShareFragment(form);
  const app = await openTracked({ url: `/src/web/index.html#${fragment}` });
  const { page } = app;

  // 입력을 전혀 치지 않았는데 결과가 떠야 한다 — 프래그먼트가 폼을 채우고
  // 즉시 계산(immediate: true)까지 실행했다는 뜻이다.
  await page.waitFor(`!!document.querySelector('.save-share button')`, { timeoutMs: 5000 });
  const birthDateValue = await page.evaluate(`document.getElementById('birthDate').value`);
  assert.ok(birthDateValue.includes('1993'), `birthDate 입력이 채워지지 않았습니다: "${birthDateValue}"`);

  // **만 나이를 되비추는 새 표시가 생기지 않았다** — 기존 규칙("만 나이를
  // 필드 옆에 되비추지 않는다")이 공유 링크 경로에서도 그대로 유지되는지
  // 확인한다. 도움말 문구("만 나이 계산에만 씁니다")는 숫자가 없으므로
  // 통과하고, "만 33세"처럼 숫자+세가 붙은 새 문구가 생기면 잡는다.
  const inputSlotText = await page.evaluate(`document.querySelector('.input-slot').innerText`);
  assert.doesNotMatch(inputSlotText, /만\s*\d+\s*세/, '입력 패널에 만 나이를 되비추는 문구가 생겼습니다 — 기존 규칙 위반');
});

/**
 * [2026-08-23, D82 판정 3] **v1 링크는 계속 열린다** — 이미 공유된 옛
 * 링크(위치 기반 v2 이전, JSON+base64url)를 실제 브라우저로 열어
 * 실측한다(`state/share-link.test.mjs`는 디코더 함수만 단위로 잰다 — 이
 * 파일은 "URL을 실제로 열면 앱이 그 값으로 뜨는가"까지 확인한다).
 * **`encodeShareFragmentV1`을 직접 써서 v2 인코더를 거치지 않는다** —
 * 지금(v2를 내는) `buildShareUrl`을 쓰면 이 시험이 실은 v2를 열어 보는
 * 시험이 돼 버린다.
 */
test('D82 판정 3 — v1(옛 JSON+base64url) 공유 링크를 실제로 열면 입력이 채워지고 계산까지 실행된다', { skip: skipWithoutChrome }, async () => {
  const form = {
    ...initialForm(),
    birthDate: '1993-04-17',
    currentSalary: '4000',
    hasNonWageIncome: false,
    monthlyCapacity: '50',
    annuityStarted: false,
    fundUseHorizon: 'before_pension_age',
  };
  const v1Fragment = encodeShareFragmentV1(form);
  assert.ok(!v1Fragment.startsWith('v2.'), 'v1 프래그먼트가 우연히 v2 접두와 겹치면 이 시험 자체가 뜻을 잃는다');
  const app = await openTracked({ url: `/src/web/index.html#${v1Fragment}` });
  const { page } = app;

  // [2026-08-21, D81] 기본 탭이 이제 calc2다 — 옛(탭 id가 없는) 공유
  // 링크가 성공으로 디코드되면 `ui/app.js`가 활성 탭을 명시로
  // `calculator`로 돌린다(공유받은 결과가 실제로 보이도록) — 그래서 여기
  // 명시 탭 클릭 없이도 결과가 이 탭에서 바로 떠야 한다.
  await page.waitFor(`!!document.querySelector('.save-share button')`, { timeoutMs: 5000 });
  const state = await page.evaluate(`(() => ({
    birthDate: document.getElementById('birthDate').value,
    calculatorHidden: document.getElementById('tabpanel-calculator').classList.contains('tab-panel-hidden'),
  }))()`);
  assert.ok(state.birthDate.includes('1993'), `v1 링크로 열었는데 birthDate가 채워지지 않았다: "${state.birthDate}"`);
  assert.equal(state.calculatorHidden, false, 'v1 링크로 열었는데 그 결과가 있는 탭이 숨어 있다');
});

test('D74 — 깨진·이전 버전 공유 링크는 조용히 무시되지 않고 짧게 알려준다', { skip: skipWithoutChrome }, async () => {
  const app = await openTracked({ url: '/src/web/index.html#this-is-not-a-valid-fragment' });
  const { page } = app;
  await page.waitFor(`!!document.querySelector('.shared-fragment-notice')`, { timeoutMs: 3000 });
  const text = await page.evaluate(`document.querySelector('.shared-fragment-notice').textContent`);
  assert.ok(text.includes('공유 링크를 읽지 못했습니다'), `깨진 링크 안내 문구가 없습니다: "${text}"`);
});

test('일반 방문(프래그먼트 없음)에는 공유 링크 안내 배너가 뜨지 않는다', { skip: skipWithoutChrome }, async () => {
  const app = await openTracked();
  const { page } = app;
  await sleep(300);
  const exists = await page.evaluate(`!!document.querySelector('.shared-fragment-notice')`);
  assert.equal(exists, false, '프래그먼트가 없는데도 공유 링크 오류 배너가 떴습니다');
});
