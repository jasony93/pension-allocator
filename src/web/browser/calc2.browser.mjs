import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

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
    };
  })()`);
  assert.equal(values.currentSalary, '4000', `총급여액 프리필이 4000이 아니다: ${values.currentSalary}`);
  assert.equal(values.monthlyCapacity, '150', `월 납입 여력 프리필이 150이 아니다: ${values.monthlyCapacity}`);
  assert.ok(/^\d{4}-01-01$/.test(values.birthDate), `생년월일 프리필 형식이 이상하다: ${values.birthDate}`);
  assert.ok(values.hasDonutSlice, '프리필만으로 결과 도넛이 이미 그려져 있어야 한다(D79 판정 2)');
});

// [2026-08-21, D80 판정 2] 프리필 안내줄은 소유자가 명시로 지웠다 — 아래
// "D80 — 조건절·근거 문구 넷" 시험 블록이 그 부재를 함께 검사한다.

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
});

// ---------------------------------------------------------------------------
// [2026-08-21, D80] 소유자 지시 셋, 전부 계산기2 한정(첫 탭·역산기는 그대로).
// 아래 시험군은 깨끗한 상태에서 시작하려 페이지를 다시 연다 — 위 시험이
// 이미 생년월일을 1950-01-01로 바꿔 둔 채였다.
// ---------------------------------------------------------------------------

test('D80 판정 3 — 계산기2 필드 라벨이 굵다(font-weight 700), 스타일 스코프 밖(첫 탭)은 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  const m = await page.evaluate(`(() => {
    const calc2Label = document.getElementById('tabpanel-calc2').querySelector('label.field-label, span.field-label');
    const firstTabLabel = document.getElementById('tabpanel-calculator').querySelector('label.field-label, span.field-label');
    return {
      calc2Weight: calc2Label ? getComputedStyle(calc2Label).fontWeight : null,
      firstTabWeight: firstTabLabel ? getComputedStyle(firstTabLabel).fontWeight : null,
    };
  })()`);
  assert.equal(m.calc2Weight, '700', `계산기2 필드 라벨 굵기가 700이 아니다: ${m.calc2Weight}`);
  assert.notEqual(m.firstTabWeight, '700', `첫 탭 라벨까지 굵어졌다(스코프가 샜다): ${m.firstTabWeight}`);
});

test('D80 판정 1 — 계산기2에 올해 납입액/누적액 입력이 전부 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 「추가 정보」를 펼쳐 접힌 필드까지 전부 DOM에 있는지 본다.
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(100);
  // ISA를 켜서 그 조건부 블록도 펼친다.
  await page.clickElement(`[...document.querySelectorAll('#tabpanel-calc2 [role="radiogroup"]')].find((g) => g.getAttribute('aria-label') === 'ISA 계좌가 있나요?').querySelector('[role="radio"]:last-child')`);
  await sleep(150);
  const removedIds = [
    'calc2AnnuitySavingsYtd',
    'calc2RetirementPensionYtd',
    'calc2IsaCumulative',
    'calc2IsaYtd',
    'calc2IsaYearsSinceOpening',
    'calc2IsaTransferEnabled',
    'calc2IsaTransferAmount',
  ];
  const found = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calc2');
    return ${JSON.stringify(removedIds)}.filter((id) => !!panel.querySelector('#' + id));
  })()`);
  assert.deepEqual(found, [], `계산기2에 남아 있으면 안 되는 누적액류 필드: ${JSON.stringify(found)}`);
  // 첫 탭에는 그대로 있다(같은 컴포넌트를 공유하므로 이 부재가 calc2 전용
  // 스코프임을 함께 확인한다).
  const stillOnFirstTab = await page.evaluate(
    `!!document.getElementById('tabpanel-calculator').querySelector('#annuitySavingsYtd')`,
  );
  assert.equal(stillOnFirstTab, true, '첫 탭에서까지 연금저축 누적 필드가 없어졌다 — 계산기2 한정이어야 한다');
});

// [D80 판정 1] "buildEngineRequest가 계산기2가 실제로 낼 수 있는 폼에서
// 네 계좌 누적값을 항상 0으로 싣는다"는 브라우저 없이도 고정할 수 있는
// 계약이다(엔진 요청을 가로챌 채널이 없는 브라우저 검사보다 정확하다) —
// `ui/calc2-prefill.test.mjs`(단위 시험)가 진다.

/**
 * [D80 판정 2] 조건절·근거 문구 넷 — 계산기2에서는 없고, 첫 탭에는 그대로
 * 있다. **공유 결과 패널이라 조심하라**는 지시대로, 이 시험이 두 탭을
 * 모두 잰다 — `resultKey`(`ui/result-panel.js`)가 실제로 계산기2 마운트
 * 에서만 문구를 죽였는지, 첫 탭 쪽 회귀는 없는지 한 시험 안에서 함께
 * 고정한다.
 */
test('D80 판정 2 — 조건절 문구 넷이 계산기2에는 없고, 첫 탭에는 그대로 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);

  // 첫 탭 — 「두 연금계좌 중 왜 이 순서인가」는 두 연금계좌가 동점 배분일
  // 때만 뜬다(`fillOrderTieBreak`). 계산기2의 김철수씨 프리필 값(만 30세·
  // 총급여 4,000만원·월 150만원)이 바로 그 조건을 실제로 낸다는 것을
  // D80 이전 회차 스크린샷으로 이미 확인했다 — 같은 값을 첫 탭에도 그대로
  // 채워 같은 동점 조건을 재현한다(FILL_REQUIRED_FIELDS의 임의 값 대신).
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('birthDate', '19960101'));
  await page.evaluate(set('currentSalary', '4000'));
  await page.evaluate(set('monthlyCapacity', '150'));
  await page.clickElement(`document.getElementById('hasNonWageIncome-false')`);
  await page.clickElement(`document.getElementById('annuityStarted-false')`);
  await page.clickElement(`document.getElementById('fundUseHorizon-unknown')`);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 6000 });
  await sleep(200);
  const firstTabText = await page.evaluate(`document.querySelector('.result-slot').innerText`);
  assert.ok(firstTabText.includes('국세 + 개인지방소득세 합산'), '첫 탭 — 헤드라인 밑 조건절이 없어졌다(계산기2 한정이어야 한다)');
  assert.ok(firstTabText.includes('두 연금계좌 중 왜 이 순서인가'), '첫 탭 — 「두 연금계좌 중 왜 이 순서인가」 블록이 없어졌다');
  // 이월 개정안 경고·프리필 안내줄은 조건(이월 갈림·프리필 화면)이 갖춰져야
  // 나타나는 문구라 이 최소 채움만으로는 첫 탭에서도 안 뜬다 — 강제로
  // 재현하지 않는다(사실만 기록). 계산기2 쪽 부재만 아래에서 함께 잰다.

  // 계산기2 — 프리필로 이미 결과가 서 있다.
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(200);
  const calc2Text = await page.evaluate(`document.querySelector('.calc2-result-slot').innerText`);
  const calc2PanelText = await page.evaluate(`document.getElementById('tabpanel-calc2').innerText`);
  assert.ok(!calc2Text.includes('국세 + 개인지방소득세 합산'), '계산기2 — 헤드라인 밑 조건절이 남아 있다(D80 판정 2)');
  assert.ok(!calc2Text.includes('이 한도에는 미납입분 이월이 포함돼 있는데'), '계산기2 — 이월 개정안 경고가 남아 있다(D80 판정 2)');
  assert.ok(!calc2Text.includes('두 연금계좌 중 왜 이 순서인가'), '계산기2 — 「두 연금계좌 중 왜 이 순서인가」 블록이 남아 있다(D80 판정 2)');
  assert.ok(!calc2PanelText.includes('김철수씨의 예시 값으로 시작합니다'), '계산기2 — 프리필 안내줄이 남아 있다(D80 판정 2)');
});
