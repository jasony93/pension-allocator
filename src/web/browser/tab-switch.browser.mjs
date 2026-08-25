import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissDepletionIntroModalIfOpen } from './harness.mjs';

/**
 * [2026-08-23, D84 판정 1·2] **탭 둘을 지운다.** 「절세계좌 계산기2」(내부
 * id `calculator`, 옛 근거판)와 「연금 역산기」(`pension-reverse`) 관련
 * 시험을 이 파일에서 전부 지웠다 — 그 화면 배선 자체가 사라졌다(엔진
 * `src/engine/reverse-*`와 그 시험은 보관 자산으로 남는다, 이 파일과
 * 무관). 새 탭 「연금고갈 시뮬레이션」(`pension-depletion`)의 구조·라우팅
 * 검사를 이 파일이 새로 진다.
 *
 * [2026-08-25, D86] **표시 순서·기본 랜딩이 뒤집힌다.** 남는 탭 구조:
 * [연금고갈 시뮬레이션(id `pension-depletion`)] [절세계좌 계산기(id
 * `calc2`)] — 내부 id·프래그먼트 문자열은 그대로다(D86 원문 "내부 탭
 * id·프래그먼트 유지"), 표시 순서와 기본 활성 탭만 바뀐다. 계산기2 예시
 * 팝업(`ui/calc2-example-modal.js`)은 D86으로 완전히 지워졌다 — 시뮬레이터
 * 탭 팝업(`ui/depletion-intro-modal.js`)이 유일한 일일 인사가 된다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-25, D86] 기본 탭이 이제 시뮬레이터라 첫 로드부터 그 탭 전용
  // 팝업이 뜰 수 있다 — 좌표 기반 탭 클릭이 스크림에 막히지 않도록 미리
  // 치운다. 계산기2 예시 팝업은 D86으로 지워져 더는 대비할 대상이 아니다.
  await dismissDepletionIntroModalIfOpen(app.page);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const APP_TABS_QUERY = `document.querySelector('.app-tabs[role="tablist"]').querySelectorAll('[role="tab"]')`;

test('탭이 정확히 둘, 순서가 [연금고갈 시뮬레이션, 절세계좌 계산기]이다(D84 판정 1·2, D86)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const tabs = await page.evaluate(`[...${APP_TABS_QUERY}].map((t) => ({ id: t.id, label: t.innerText.trim() }))`);
  assert.deepEqual(tabs, [
    { id: 'tab-pension-depletion', label: '연금고갈 시뮬레이션' },
    { id: 'tab-calc2', label: '절세계좌 계산기' },
  ]);
});

test('삭제된 탭 — id·패널·라벨 어디에도 옛 탭(calculator·pension-reverse)의 흔적이 없다(D84 판정 1)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const m = await page.evaluate(`(() => ({
    calculatorTab: !!document.getElementById('tab-calculator'),
    reverseTab: !!document.getElementById('tab-pension-reverse'),
    calculatorPanel: !!document.getElementById('tabpanel-calculator'),
    reversePanel: !!document.getElementById('tabpanel-pension-reverse'),
    labelHasStray2: [...${APP_TABS_QUERY}].some((t) => t.innerText.includes('계산기2')),
  }))()`);
  assert.equal(m.calculatorTab, false, '옛 계산기2(근거판) 탭 버튼이 아직 있다');
  assert.equal(m.reverseTab, false, '옛 연금 역산기 탭 버튼이 아직 있다');
  assert.equal(m.calculatorPanel, false, '옛 계산기2(근거판) 패널이 아직 있다');
  assert.equal(m.reversePanel, false, '옛 연금 역산기 패널이 아직 있다');
  assert.equal(m.labelHasStray2, false, '탭 라벨 어디에도 "계산기2" 문자열이 남아 있으면 안 된다');
});

test('.app-main이 정확히 둘 있다 — 탭마다 하나씩, 동시 마운트(2.1.2절 (3)), 기본 활성은 시뮬레이터(D86)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const count = await page.evaluate(`document.querySelectorAll('.app-main').length`);
  assert.equal(count, 2);
  const initial = await page.evaluate(`(() => ({
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
    depletionHidden: document.getElementById('tabpanel-pension-depletion').classList.contains('tab-panel-hidden'),
  }))()`);
  assert.equal(initial.depletionHidden, false, '기본 탭(시뮬레이터, D86)은 처음부터 보여야 한다');
  assert.equal(initial.calc2Hidden, true);
});

test('탭을 전환하면 URL 프래그먼트가 탭 id로 바뀐다(2.1.2절 (4))', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // [2026-08-25, D86] 기본 탭이 이미 시뮬레이터라, 먼저 calc2로 전환해야
  // 실제 "전환"이 일어난다(같은 탭을 다시 누르면 `setActiveTab`이 이른
  // 반환한다).
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  let state = await page.evaluate(`(() => ({
    hash: location.hash,
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
    depletionHidden: document.getElementById('tabpanel-pension-depletion').classList.contains('tab-panel-hidden'),
    ariaSelected: document.getElementById('tab-calc2').getAttribute('aria-selected'),
  }))()`);
  assert.equal(state.hash, '#calc2');
  assert.equal(state.calc2Hidden, false);
  assert.equal(state.depletionHidden, true);
  assert.equal(state.ariaSelected, 'true');

  await page.clickElement(`document.getElementById('tab-pension-depletion')`);
  await sleep(150);
  assert.equal(await page.evaluate(`location.hash`), '#pension-depletion');
});

test('계산기2 탭에 값을 채우고 시뮬레이션 탭으로 넘어갔다 돌아와도 값이 그대로다(표시 전환, 마운트/언마운트 아님)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // [2026-08-25, D86] calc2 프리필(D79 판정 2)은 이제 그 탭을 **열 때**
  // 일어난다(기본 탭이 아니게 됐으므로) — 먼저 명시로 전환한다.
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(200); // 일일 프리필이 먼저 서게(D79 판정 2)
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('calc2CurrentSalary', '7000'));
  await sleep(200);
  const before = await page.evaluate(`document.getElementById('calc2CurrentSalary').value`);
  assert.equal(before, '7000');

  await page.clickElement(`document.getElementById('tab-pension-depletion')`);
  await sleep(150);
  const whileHidden = await page.evaluate(`document.getElementById('calc2CurrentSalary').value`);
  assert.equal(whileHidden, '7000', '탭이 숨어 있는 동안에도 입력 노드가 값을 그대로 갖고 있어야 한다');

  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  const after = await page.evaluate(`document.getElementById('calc2CurrentSalary').value`);
  assert.equal(after, '7000', '탭을 넘어갔다 돌아와도 재입력 없이 값이 남아 있어야 한다');
  assert.ok(await page.evaluate(`!!document.querySelector('.calc2-result-slot .chart-donut path')`));
});

test('시뮬레이션 탭 슬라이더 값도 다른 탭으로 넘어갔다 돌아와도 그대로다(같은 DOM, 표시만 전환)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 기본 탭이 이미 시뮬레이터다(D86) — 명시 클릭은 상태를 보장하는
  // 방어일 뿐, 실제 전환이 아니어도 무해하다.
  await page.clickElement(`document.getElementById('tab-pension-depletion')`);
  await sleep(150);
  await page.evaluate(`(() => { const el = document.getElementById('depletion-slider-ror'); el.focus(); el.value = '2'; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(150);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.clickElement(`document.getElementById('tab-pension-depletion')`);
  await sleep(150);
  const value = await page.evaluate(`document.getElementById('depletion-slider-ror').value`);
  assert.equal(value, '2', '슬라이더 값이 탭을 넘나든 뒤에도 남아 있어야 한다');
});

/**
 * [2026-08-20, 관리자 지시(2차) 6번, 2026-08-25 D86으로 랜딩 목적지 갱신]
 * 로고 클릭 — 첫 랜딩(D86로 시뮬레이터 탭 활성 + 맨 위)으로. 입력값은
 * 지우지 않는다.
 */
test('로고를 누르면 첫 탭(시뮬레이터, D86)이 활성화되고 페이지 맨 위로 스크롤된다(입력값은 지우지 않는다)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissDepletionIntroModalIfOpen(page);
  await page.waitFor(`!!document.querySelector('.app-header-logo-button')`, { timeoutMs: 8000 });

  // 기본 탭이 이미 시뮬레이터다 — 그 자리에서 곧장 슬라이더 값을 바꾼다
  // (다른 탭으로 옮겨갈 필요가 없다).
  await page.evaluate(`(() => { const el = document.getElementById('depletion-slider-ror'); el.focus(); el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  // 먼저 calc2로 옮겨 갔다가 로고를 눌러야 "첫 랜딩으로 돌아온다"는 사실
  // 자체를 관측할 수 있다(이미 그 탭이면 `setActiveTab`이 이른 반환한다).
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  // 문서 전체 높이의 절반만큼 내려간다 — 탭마다 콘텐츠 길이가 달라
  // 고정 픽셀 값은 짧은 탭에서 "이미 바닥"이 될 수 있다(실측).
  await page.evaluate(`window.scrollTo(0, Math.max(100, document.documentElement.scrollHeight / 2))`);
  await sleep(100);
  const beforeScroll = await page.evaluate('window.scrollY');
  assert.ok(beforeScroll > 50, `로고 클릭 전 스크롤 위치(${beforeScroll})가 이미 맨 위다 — 이 검사가 스크롤 이동을 관측할 수 없다`);

  await page.clickElement(`document.querySelector('.app-header-logo-button')`);
  await page.waitFor(`document.getElementById('tab-pension-depletion').getAttribute('aria-selected') === 'true'`, { timeoutMs: 3000 });
  await page.waitFor(`window.scrollY < 50`, { timeoutMs: 3000 });

  const after = await page.evaluate(`(() => ({
    activeTab: document.getElementById('tab-pension-depletion').getAttribute('aria-selected'),
    depletionHidden: document.getElementById('tabpanel-pension-depletion').classList.contains('tab-panel-hidden'),
    scrollY: window.scrollY,
  }))()`);
  assert.equal(after.activeTab, 'true');
  assert.equal(after.depletionHidden, false);
  assert.ok(after.scrollY < 50, `로고를 눌렀는데 페이지가 맨 위로 스크롤되지 않았다(scrollY=${after.scrollY})`);

  const preserved = await page.evaluate(`document.getElementById('depletion-slider-ror').value`);
  assert.equal(preserved, '3', '로고 클릭이 시뮬레이션 탭 슬라이더 값을 지웠다 — 지우지 않는다는 지시였다');
});

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
  assert.equal(m.tagName, 'BUTTON');
  assert.equal(m.type, 'button');
  assert.ok(m.ariaLabel);
  assert.equal(m.cursor, 'pointer', `로고 버튼 커서가 pointer가 아니다: ${m.cursor}`);
});

test('활성 탭 밑줄 색이 rgb(230, 115, 0)이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const borderColor = await page.evaluate(`getComputedStyle(document.querySelector('.app-tab-active')).borderBottomColor`);
  assert.equal(borderColor, 'rgb(230, 115, 0)', `활성 탭 밑줄 색이 rgb(230, 115, 0)이 아니다: ${borderColor}`);
});

// ---------------------------------------------------------------------------
// [2026-08-23, D84 판정 1] 옛 링크 라우팅 — 삭제된 탭을 가리키던 링크가
// 죽지 않고 지금 남은 탭으로 돌아온다.
// ---------------------------------------------------------------------------

test('D84 판정 1 — 옛 탭 id 프래그먼트(#calculator, #pension-reverse)가 지금 남은 계산 탭(calc2)으로 돌아온다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  for (const [i, legacyHash] of ['calculator', 'pension-reverse'].entries()) {
    // [2026-08-25, D86] 이 경로는 URL 탭 id 프래그먼트가 곧장 `calc2`로
    // 리다이렉트하므로(기본 랜딩 분기 자체를 타지 않는다) 시뮬레이터
    // 팝업이 뜰 일이 없다 — 별도 치움이 필요 없다.
    await page.goto(`${origin}/src/web/index.html?_d84=${i}#${legacyHash}`);
    await page.waitFor(`!!document.getElementById('tab-calc2')`, { timeoutMs: 8000 });
    await sleep(150);
    const state = await page.evaluate(`(() => ({
      calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
      calc2Selected: document.getElementById('tab-calc2').getAttribute('aria-selected'),
    }))()`);
    assert.equal(state.calc2Hidden, false, `#${legacyHash} 링크가 calc2 탭을 열지 않았다`);
    assert.equal(state.calc2Selected, 'true', `#${legacyHash} 링크로 들어왔는데 calc2 탭이 활성이 아니다`);
  }
});

/**
 * [2026-08-23, D84 판정 1, 2026-08-25 D86으로 대상 갱신] **계산기2 예시
 * 팝업은 D86으로 완전히 지워졌다** — 이 시험이 재는 "기본 랜딩에서도
 * 팝업이 뜬다"는 사실 자체는 그대로 유효하다(이제 그 팝업이 시뮬레이터
 * 탭 전용 팝업이다, D86 원문 "시뮬레이터 팝업은 랜딩 첫 로드부터 같은
 * 일일 규칙"). 선택자는 원래도 계산기2에 매인 것이 아니라 범용
 * `.modal[role="dialog"]`였다 — 대상만 자연히 바뀐다.
 */
test('D86 — 탭 전용 팝업이 기본 랜딩(프래그먼트 없는 첫 로드)에서도 뜬다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(`localStorage.clear()`);
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 8000 });
  const host = await page.evaluate(`!!document.querySelector('.depletion-intro-modal-host')`);
  assert.ok(host, '프래그먼트 없는 기본 랜딩에서 시뮬레이터 탭 팝업이 뜨지 않았다');
});
