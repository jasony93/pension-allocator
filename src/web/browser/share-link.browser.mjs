import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissDepletionIntroModalIfOpen } from './harness.mjs';
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
  // [2026-08-24, D84, 2026-08-25 D86으로 랜딩이 바뀌며 갱신] calc2가
  // 유일한 계산 탭이다 — 그 탭을 **열면** 프리필로 결과가 선다(D79 판정
  // 2). D86으로 기본 랜딩이 시뮬레이터가 되며, calc2 결과를 보려면 이제
  // 명시 전환이 필요하다.
  await dismissDepletionIntroModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .save-share button')`, { timeoutMs: 8000 });
  await sleep(400);

  const before = await page.evaluate(`document.querySelector('.share-link-note').textContent`);
  assert.equal(before, '', '클릭 전에는 공유 안내가 비어 있어야 한다');

  await page.clickElement(`[...document.querySelectorAll('.calc2-result-slot .save-share button')].find((b) => b.getAttribute('aria-label') === '내 결과 공유하기')`);
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
  await dismissDepletionIntroModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .save-share button')`, { timeoutMs: 8000 });
  await sleep(400);
  await page.clickElement(`[...document.querySelectorAll('.calc2-result-slot .save-share button')].find((b) => b.getAttribute('aria-label') === '내 결과 공유하기')`);
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

  // [2026-08-24, D84 판정 1] `encodeShareFragment`(v2/현행)도 v1과 같은
  // 탭 없는 데이터 블롭이라 `ui/app.js`가 같은 경로로 calc2에 싣는다 —
  // calc2 필드 id로 확인한다.
  await page.waitFor(`!!document.querySelector('.calc2-result-slot .save-share button')`, { timeoutMs: 5000 });
  const birthDateValue = await page.evaluate(`document.getElementById('calc2BirthDate').value`);
  assert.ok(birthDateValue.includes('1993'), `birthDate 입력이 채워지지 않았습니다: "${birthDateValue}"`);

  // **만 나이를 되비추는 새 표시가 생기지 않았다** — 기존 규칙("만 나이를
  // 필드 옆에 되비추지 않는다")이 공유 링크 경로에서도 그대로 유지되는지
  // 확인한다. 도움말 문구("만 나이 계산에만 씁니다")는 숫자가 없으므로
  // 통과하고, "만 33세"처럼 숫자+세가 붙은 새 문구가 생기면 잡는다.
  const inputSlotText = await page.evaluate(`document.querySelector('.calc2-input-slot').innerText`);
  assert.doesNotMatch(inputSlotText, /만\s*\d+\s*세/, '입력 패널에 만 나이를 되비추는 문구가 생겼습니다 — 기존 규칙 위반');
});

/**
 * [2026-08-23, D82 판정 3, 2026-08-24 D84 판정 1로 라우팅 정정] **v1
 * 링크는 계속 열린다** — 이미 공유된 옛 링크(위치 기반 v2 이전,
 * JSON+base64url)를 실제 브라우저로 열어 실측한다(`state/share-
 * link.test.mjs`는 디코더 함수만 단위로 잰다 — 이 파일은 "URL을 실제로
 * 열면 앱이 그 값으로 뜨는가"까지 확인한다). **`encodeShareFragmentV1`을
 * 직접 써서 v2 인코더를 거치지 않는다** — 지금(v2를 내는) `buildShareUrl`
 * 을 쓰면 이 시험이 실은 v2를 열어 보는 시험이 돼 버린다.
 *
 * **[2026-08-24, D84 판정 1] 라우팅 목적지가 바뀌었다.** v1 링크가
 * 가리키던 「절세계좌 계산기2(근거판)」 탭(`calculator`)이 지워졌다 —
 * `ui/app.js`가 이제 그 값을 **간결판(calc2)에 싣는다**(링크가 죽는
 * 것보다 낫다는 판단, `CALC2_UNSUPPORTED_SHARE_FIELDS` 주석 참고). 이
 * 픽스처의 필드(생년월일·총급여·월 납입액 등)는 전부 calc2가 그리는
 * 값이라 못 실은 값 안내(`.shared-fragment-notice`)는 뜨지 않아야
 * 정상이다 — 그 배너는 별도 시험이 진다(아래).
 */
test('D82 판정 3, D84 판정 1 — v1(옛 JSON+base64url) 공유 링크를 실제로 열면 calc2에 값이 채워지고 계산까지 실행된다', { skip: skipWithoutChrome }, async () => {
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

  await page.waitFor(`!!document.querySelector('.calc2-result-slot .save-share button')`, { timeoutMs: 5000 });
  const state = await page.evaluate(`(() => ({
    birthDate: document.getElementById('calc2BirthDate').value,
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
    hasPartialNotice: !!document.querySelector('.shared-fragment-notice'),
  }))()`);
  assert.ok(state.birthDate.includes('1993'), `v1 링크로 열었는데 calc2의 birthDate가 채워지지 않았다: "${state.birthDate}"`);
  assert.equal(state.calc2Hidden, false, 'v1 링크로 열었는데 calc2 탭이 숨어 있다');
  assert.equal(state.hasPartialNotice, false, '이 픽스처는 calc2가 못 싣는 값이 없는데 부분 안내 배너가 떴다');
});

/**
 * [2026-08-24, D84 판정 1] **못 싣는 값이 있으면 조용히 버리지 않고
 * 안내한다.** v1 링크가 calc2가 화면에 묻지 않는 값(청년 자기신고)을
 * 실었을 때, 그 값 자체는 (표시할 곳이 없으니) 반영되지 않지만 배너
 * (`.shared-fragment-notice`)가 그 사실을 알려야 한다 — `ui/app.js`의
 * `CALC2_UNSUPPORTED_SHARE_FIELDS`·`sharedFormHasCalc2UnsupportedValues`
 * 가 실제로 이 판정까지 이어지는지 실측한다(단위 시험은 이 판정 함수만
 * 순수 호출로 잰다 — 여기서는 실제 URL을 열어 배너가 화면에 뜨는지까지
 * 본다).
 */
test('D84 판정 1 — v1 링크가 calc2에 없는 값(청년 자기신고)을 실었으면 부분 안내가 뜬다', { skip: skipWithoutChrome }, async () => {
  const form = {
    ...initialForm(),
    birthDate: '1993-04-17',
    currentSalary: '4000',
    hasNonWageIncome: false,
    monthlyCapacity: '50',
    annuityStarted: false,
    fundUseHorizon: 'before_pension_age',
    declaredYouth: true,
  };
  const v1Fragment = encodeShareFragmentV1(form);
  const app = await openTracked({ url: `/src/web/index.html#${v1Fragment}` });
  const { page } = app;

  await page.waitFor(`!!document.querySelector('.shared-fragment-notice')`, { timeoutMs: 5000 });
  const state = await page.evaluate(`(() => ({
    birthDate: document.getElementById('calc2BirthDate').value,
    noticeText: document.querySelector('.shared-fragment-notice').textContent,
  }))()`);
  assert.ok(state.birthDate.includes('1993'), `실을 수 있는 값(생년월일)까지 함께 빠졌다: "${state.birthDate}"`);
  assert.ok(state.noticeText.length > 0, '부분 안내 배너에 문구가 없다');
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
