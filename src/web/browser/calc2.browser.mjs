import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep } from './harness.mjs';

/**
 * 「절세계좌 계산기2」(D79) 실측 — 관리자 지시(신규 회차) 검사 목록:
 * 탭 3개 순서·전환, calc2 예시 부재, 프리필 값·편집 가능, 밑줄 스타일 존재,
 * 55세 미만 도출.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const set = (id, v) =>
  `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;

test('계산기2 탭으로 전환하면 URL 프래그먼트가 #calc2다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  const state = await page.evaluate(`(() => ({
    hash: location.hash,
    calc2Hidden: document.getElementById('tabpanel-calc2').classList.contains('tab-panel-hidden'),
    ariaSelected: document.getElementById('tab-calc2').getAttribute('aria-selected'),
  }))()`);
  assert.equal(state.hash, '#calc2');
  assert.equal(state.calc2Hidden, false);
  assert.equal(state.ariaSelected, 'true');
});

test('D79 판정 2 — 계산기2에는 예시 블록이 없다(두 예시 슬롯 모두 0×0)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 이전 테스트가 이미 calc2 탭으로 전환해 뒀다 — 그대로 잰다.
  const rects = await page.evaluate(`(() => {
    const ex = document.querySelector('.example-showcase-slot')?.getBoundingClientRect();
    const rex = document.querySelector('.reverse-example-showcase-slot')?.getBoundingClientRect();
    return {
      example: ex ? { w: ex.width, h: ex.height } : null,
      reverseExample: rex ? { w: rex.width, h: rex.height } : null,
    };
  })()`);
  assert.deepEqual(rects.example, { w: 0, h: 0 }, `계산기2 탭에서 첫 탭 예시가 보이면 안 된다: ${JSON.stringify(rects.example)}`);
  assert.deepEqual(rects.reverseExample, { w: 0, h: 0 }, `계산기2 탭에서 역산기 예시가 보이면 안 된다: ${JSON.stringify(rects.reverseExample)}`);
  // 계산기2 패널 자신 안에도 예시류 컴포넌트 클래스가 없다.
  const hasExampleInsidePanel = await page.evaluate(
    `!!document.getElementById('tabpanel-calc2').querySelector('.example-showcase, .example-persona-row')`,
  );
  assert.equal(hasExampleInsidePanel, false, '계산기2 패널 안에 예시 컴포넌트가 있으면 안 된다');
});

test('D79 판정 2 — 김철수씨 값으로 프리필되어 있고, 결과가 바로 서 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  const values = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calc2');
    return {
      birthDate: panel.querySelector('#calc2BirthDate').value,
      currentSalary: panel.querySelector('#calc2CurrentSalary').value,
      monthlyCapacity: panel.querySelector('#calc2MonthlyCapacity').value,
      hasDonutSlice: !!panel.querySelector('.calc2-result-slot .chart-donut path'),
      hasPrefillNote: !!panel.querySelector('.calc2-prefill-note'),
    };
  })()`);
  assert.equal(values.currentSalary, '4000', `총급여액 프리필이 4000이 아니다: ${values.currentSalary}`);
  assert.equal(values.monthlyCapacity, '150', `월 납입 여력 프리필이 150이 아니다: ${values.monthlyCapacity}`);
  assert.ok(/^\d{4}-01-01$/.test(values.birthDate), `생년월일 프리필 형식이 이상하다: ${values.birthDate}`);
  assert.ok(values.hasDonutSlice, '프리필만으로 결과 도넛이 이미 그려져 있어야 한다(D79 판정 2)');
  assert.ok(values.hasPrefillNote, '프리필 안내 문구가 없다');
});

test('D79 판정 2 — 프리필 값은 편집 가능하다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(set('calc2CurrentSalary', '5000'));
  await sleep(100);
  const value = await page.evaluate(`document.getElementById('calc2CurrentSalary').value`);
  assert.equal(value, '5000', '프리필된 총급여액 필드를 고칠 수 없다');
  // 되돌린다 — 다음 시험이 원래 프리필 상태를 전제하지 않게 방어적으로.
  await page.evaluate(set('calc2CurrentSalary', '4000'));
  await sleep(100);
});

test('D79 판정 1 — 밑줄만 있는 입력칸이다(상자 테두리가 없다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const style = await page.evaluate(`(() => {
    const control = document.getElementById('calc2CurrentSalary').closest('.field-control');
    const cs = getComputedStyle(control);
    return {
      borderTopStyle: cs.borderTopStyle,
      borderLeftStyle: cs.borderLeftStyle,
      borderBottomWidth: parseFloat(cs.borderBottomWidth),
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
    };
  })()`);
  assert.equal(style.borderTopStyle, 'none', `위 테두리가 있으면 안 된다: ${style.borderTopStyle}`);
  assert.equal(style.borderLeftStyle, 'none', `옆 테두리가 있으면 안 된다: ${style.borderLeftStyle}`);
  assert.ok(style.borderBottomWidth > 0, `아래 밑줄이 없다: ${style.borderBottomWidth}`);
});

test('D79 판정 1 — 필수 최소 입력만 처음부터 보이고, 나머지는 「추가 정보」 접힘 안에 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const state = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calc2');
    return {
      essentialVisible: panel.querySelector('.calc2-essential-group')?.getBoundingClientRect().height > 0,
      moreInfoClosed: !panel.querySelector('.calc2-more-info').open,
      // 접힌 details 안의 필드는 DOM에는 있어도(무조건 원칙과 달리 이 화면은
      // 명시적으로 접는다 — D79 판정 1) 화면에 보이지 않는다.
      // getBoundingClientRect().height로 재지 않는다 — 최신 Chromium은 닫힌
      // details 본문을 내부 의사요소의 content-visibility: hidden으로
      // 숨기는데, 이 처리는 안쪽 자손의 레이아웃 박스 자체는 남겨 둬
      // getBoundingClientRect()가 0이 아닌 값을 계속 낸다(실측 — 359px,
      // 스크린샷으로는 실제로 안 보임을 확인했다). checkVisibility()가 이
      // 상태(요소 자신뿐 아니라 content-visibility로 숨긴 조상까지)를
      // 정확히 본다.
      horizonHiddenWhileClosed:
        typeof document.body.checkVisibility === 'function'
          ? !panel.querySelector('[role="radiogroup"][aria-label="이 돈을 언제 쓸 계획인가요?"]')?.checkVisibility()
          : true,
    };
  })()`);
  assert.equal(state.essentialVisible, true, '필수 최소 입력 그룹이 보이지 않는다');
  assert.equal(state.moreInfoClosed, true, '「추가 정보」가 기본으로 열려 있으면 안 된다');
  assert.equal(state.horizonHiddenWhileClosed, true, '접힌 상태에서 「자금 사용 시점」이 보이면 안 된다');
});

test('D79 판정 3 — 만 30세(프리필)에는 연금 수령 여부 물음이 아예 없다(도출: 확실히 미개시)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const hasQuestion = await page.evaluate(
    `!!document.getElementById('tabpanel-calc2').querySelector('[data-key="calc2AnnuityStartGroup"]')`,
  );
  assert.equal(hasQuestion, false, '만 55세 미만인데 연금 수령 여부 물음이 보이면 안 된다(D79 판정 3)');
});

test('D79 판정 3 — 만 55세 이상으로 생년월일을 바꾸면 「추가 정보」 안에 그 물음이 나타난다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 1950년생 — 어느 룰셋 값(연금 개시 가능 연령)을 넣어도 2026년 기준 이미
  // 한참 지난 나이다. 55라는 숫자를 이 시험에도 박지 않는다 — 충분히 옛
  // 생년월일이면 어떤 개시연령 값이든 이미 넘어선다는 사실만 쓴다.
  await page.evaluate(set('calc2BirthDate', '1950-01-01'));
  await sleep(300);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(150);
  const state = await page.evaluate(`(() => {
    const group = document.getElementById('tabpanel-calc2').querySelector('[data-key="calc2AnnuityStartGroup"]');
    return { present: !!group, visible: group ? group.getBoundingClientRect().height > 0 : false };
  })()`);
  assert.ok(state.present, '만 55세 이상인데 연금 수령 여부 물음이 「추가 정보」 안에 없다(D79 판정 3)');
  assert.ok(state.visible, '「추가 정보」를 펼쳤는데 물음이 실제로 보이지 않는다');
  // 이 파일의 마지막 시험이라 상태를 되돌릴 필요가 없다 — `after()`가 이
  // 앱 인스턴스를 통째로 닫는다(harness.mjs, 다른 시험 파일과 상태를 공유하지 않는다).
});
