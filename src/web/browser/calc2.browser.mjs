import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

/**
 * 「절세계좌 계산기2」(D79) 실측 — 관리자 지시(신규 회차) 검사 목록:
 * 탭 3개 순서·전환, calc2 예시 부재, 프리필 값·편집 가능, 밑줄 스타일 존재,
 * 55세 미만 도출.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [신규 회차] 예시 팝업(소유자 지시 1항목)이 이 파일의 다른(팝업을 검사
  // 하지 않는) 시험까지 덮지 않도록, 파일 시작 시점에 미리 "오늘 하루
  // 보지 않음" 상태로 만들어 둔다 — 팝업 자체를 검사하는 두 시험은 자기
  // 안에서 `localStorage.clear()`로 이 상태를 직접 되돌린다.
  await dismissCalc2ExampleModalPreemptively(app.page);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const set = (id, v) =>
  `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;

/**
 * [신규 회차] 예시 팝업(소유자 지시 1항목)을 미리 "오늘 하루 보지 않음" 상태로
 * 만들어 둔다 — 이 팝업은 `.modal-scrim`(position: fixed; inset: 0; z-index:
 * 100)으로 뷰포트 전체를 덮으므로, 팝업 자체를 검사하지 않는 다른 시험이
 * `page.goto` 새로고침 뒤 `tab-calc2`를 클릭하면 그 뒤에 이어지는 좌표 기반
 * 클릭(`page.clickElement`)이 팝업 위(스크림)에서 일어나 원래 누르려던
 * 요소를 놓친다(실측 — ISA 토글 클릭이 아무 효과도 못 냈다). 팝업 자체를
 * 검사하는 두 시험(아래)만 이 함수를 부르지 않는다.
 * [2026-08-21, D81] 이 파일에만 있던 이 로직을 `harness.mjs`의
 * `dismissCalc2ExampleModalIfOpen`으로 옮겼다 — 기본 탭이 calc2가 되며
 * 같은 문제가 다른 파일(`tab-switch.browser.mjs`)에도 생겨 공유가 필요해
 * 졌다. 이 파일 안 호출부(15곳)를 그대로 두려고 이름만 다시 내보낸다.
 */
const dismissCalc2ExampleModalPreemptively = dismissCalc2ExampleModalIfOpen;

test('계산기2 탭으로 전환하면 URL 프래그먼트가 #calc2다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // [2026-08-21, D81] 기본 활성 탭이 이제 calc2라 파일 첫 로드부터 이미
  // calc2가 활성이다 — 그 상태로 `tab-calc2`를 눌러도 `setActiveTab`의
  // "이미 그 탭이면 아무 일도 안 한다" 이른 반환에 걸려 이 시험이 재려는
  // "전환" 자체가 안 일어난다. 먼저 다른 탭으로 비켜 실제 전환을 만든다.
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);
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
  await dismissCalc2ExampleModalPreemptively(page);
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
  await dismissCalc2ExampleModalPreemptively(page);
  // [2026-08-21, D81] 기본 탭이 이제 calc2라 첫 탭 필드가 `tab-panel-hidden`
  // (display:none)으로 숨어 있다 — 숨은 원소는 사각형이 0×0이라, 아래
  // 좌표 기반 클릭(`page.clickElement`)이 엉뚱한 좌표를 때려 라디오가 조용히
  // 안 눌린다(실측 — 결과가 영영 안 섰다). 먼저 명시로 그 탭을 켠다.
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);

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

// ---------------------------------------------------------------------------
// [신규 회차, 소유자 지시 6항목, 전부 계산기2 한정] 예시 팝업·ISA 입력 축소·
// 계좌별 세제혜택 정리·막대 라벨 위치·다른 배분 비교 hover·표 열 정렬.
// ---------------------------------------------------------------------------

test('예시 팝업 — 계산기2 탭을 처음 클릭하면 뜨고, 「오늘 하루 보지 않음」 뒤 같은 날 재클릭하면 안 뜬다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.getElementById('tab-calc2')`, { timeoutMs: 8000 });
  // [2026-08-21, D81] 새로고침 자체가 이제 기본으로 calc2에 내려앉는다 —
  // "탭을 클릭해 전환"을 실제로 관측하려면 먼저 다른 탭으로 비켜 둬야
  // 한다(그렇지 않으면 아래 `tab-calc2` 클릭이 이미 활성인 탭이라
  // `setActiveTab`의 이른 반환에 걸려 아무 일도 안 한다).
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);
  await page.evaluate(`localStorage.clear()`);

  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 6000 });
  const first = await page.evaluate(`(() => {
    const dismiss = document.querySelector('.calc2-example-modal-dismiss');
    const close = document.querySelector('.calc2-example-modal-close');
    return { hasModal: true, hasDismiss: !!dismiss, dismissText: dismiss?.textContent, hasClose: !!close, closeText: close?.textContent };
  })()`);
  assert.equal(first.hasModal, true);
  assert.equal(first.hasDismiss, true, '「오늘 하루 보지 않음」 버튼이 없다');
  assert.equal(first.dismissText, '오늘 하루 보지 않음');
  assert.equal(first.hasClose, true, '일반 닫기(X) 버튼이 없다');
  assert.equal(first.closeText, '×');

  // 「오늘 하루 보지 않음」을 누른다 — 모달이 닫히고 localStorage에 오늘 날짜가 남는다.
  await page.clickElement(`document.querySelector('.calc2-example-modal-dismiss')`);
  await sleep(150);
  const afterDismiss = await page.evaluate(`(() => ({
    hasModal: !!document.querySelector('.modal[role="dialog"]'),
    stored: localStorage.getItem('calc2ExampleModalDismissedDate'),
  }))()`);
  assert.equal(afterDismiss.hasModal, false, '「오늘 하루 보지 않음」을 눌렀는데 모달이 안 닫혔다');
  assert.ok(afterDismiss.stored, 'localStorage에 오늘 날짜가 저장되지 않았다');

  // 다른 탭으로 갔다가 계산기2로 재클릭 — 같은 날이므로 다시 뜨면 안 된다.
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(400);
  const afterReclick = await page.evaluate(`!!document.querySelector('.modal[role="dialog"]')`);
  assert.equal(afterReclick, false, '같은 날 재클릭인데 팝업이 다시 떴다');
});

test('예시 팝업 — 저장된 날짜가 오늘이 아니면(날짜가 바뀌면) 다시 뜬다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.getElementById('tab-calc2')`, { timeoutMs: 8000 });
  // [2026-08-21, D81] 위 시험과 같은 이유로, 클릭이 실제 전환을 일으키도록
  // 먼저 다른 탭으로 비켜 둔다.
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);
  // 어제 날짜로 저장해 둔다 — 오늘과 다르므로 억제되면 안 된다.
  await page.evaluate(`localStorage.setItem('calc2ExampleModalDismissedDate', '2000-01-01')`);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 6000 });
  assert.ok(true, '옛 날짜가 저장돼 있어도 오늘과 다르면 다시 떴다');
  await page.clickElement(`document.querySelector('.calc2-example-modal-close')`);
  await sleep(150);
  const stillStoredOld = await page.evaluate(`localStorage.getItem('calc2ExampleModalDismissedDate')`);
  assert.equal(stillStoredOld, '2000-01-01', '일반 닫기(X)는 날짜를 오늘로 바꾸면 안 된다 — 「오늘 하루 보지 않음」만 저장한다');
});

test('ISA 입력 축소 — 계산기2에는 수익 성격·정산 기간·손실액 칸이 없다(수익률까지만), 첫 탭에는 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(100);
  await page.clickElement(`document.getElementById('calc2IsaReturnEnabled-true')`);
  await sleep(150);
  const removedIds = ['calc2IsaIncomeCharacter', 'calc2IsaSettlementYears', 'calc2IsaLossAmount'];
  const calc2Found = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calc2');
    return ${JSON.stringify(removedIds)}.filter((id) => !!panel.querySelector('#' + id));
  })()`);
  assert.deepEqual(calc2Found, [], `계산기2에 남아 있으면 안 되는 ISA 필드: ${JSON.stringify(calc2Found)}`);
  const rateStillThere = await page.evaluate(`!!document.getElementById('tabpanel-calc2').querySelector('#calc2IsaReturnRatePercent')`);
  assert.equal(rateStillThere, true, 'ISA 예상 수익률 칸까지 없어지면 안 된다');

  // 첫 탭에는 그대로 있다 — 첫 탭도 이 칸은 `isaReturnEnabled`를 켜야
  // 나타난다(조건부 노출, 계산기2와 같은 조건).
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  await page.clickElement(`document.getElementById('isaReturnEnabled-true')`);
  await sleep(150);
  const firstTabHas = await page.evaluate(
    `!!document.getElementById('tabpanel-calculator').querySelector('#isaIncomeCharacter-interest_dividend')`,
  );
  assert.equal(firstTabHas, true, '첫 탭에서까지 ISA 소득 성격 칸이 없어졌다 — 계산기2 한정이어야 한다');
});

test('ISA 입력 축소 — 수익률을 켜면 소득 성격을 묻지 않고도 정산액 추정이 선다(mixed_or_unknown 자동 채움)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(100);
  await page.clickElement(`document.getElementById('calc2IsaReturnEnabled-true')`);
  await sleep(150);
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('calc2IsaReturnRatePercent', '5'));
  await sleep(500);
  // 소득 성격을 한 번도 묻지 않았는데도(그 칸이 없다) 결과가 여전히 정상
  // 계산 상태(오류 패널로 빠지지 않는다, 도넛이 그대로 그려진다)로
  // 이어진다면, `isaReturnEnabled` 켤 때 `mixed_or_unknown`을 조용히 채우는
  // 자동 채움이 실제로 동작해 계약의 필수 짝(수익률+소득 성격)이 채워졌다는
  // 뜻이다 — 안 채워졌다면 `buildIsaReturnAssumption`이 `null`을 내고
  // (계산 자체는 계속 성립하지만) 이 사실만으로 자동 채움 여부를 화면
  // 밖에서 가려낼 수는 없으므로, 최소한 "계산이 깨지지 않는다"는 이
  // 회귀만은 여기서 고정한다.
  const state = await page.evaluate(`(() => ({
    hasFatalError: !!document.querySelector('#tabpanel-calc2 .inline-alert-error'),
    hasDonut: !!document.querySelector('.calc2-result-slot .chart-donut path'),
  }))()`);
  assert.equal(state.hasFatalError, false, 'ISA 수익률만 켰는데 결과 패널이 오류 상태로 빠졌다');
  assert.equal(state.hasDonut, true, 'ISA 수익률만 켰는데 결과 도넛이 사라졌다');
});

test('계좌별 세제혜택 블록 정리 — 부연설명·「나중에 받을 때」가 계산기2에는 없고, 첫 탭에는 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);

  // 첫 탭 — 필수 항목을 채운다.
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 6000 });
  await sleep(200);
  const firstTab = await page.evaluate(`(() => ({
    hasRefCaption: !!document.querySelector('.result-slot .benefit-strip-ref-caption'),
    hasPensionReference: !!document.querySelector('.result-slot .benefit-reference'),
  }))()`);
  assert.equal(firstTab.hasRefCaption, true, '첫 탭 — 부연설명(benefit-strip-ref-caption)이 없어졌다(계산기2 한정이어야 한다)');
  assert.equal(firstTab.hasPensionReference, true, '첫 탭 — 「연금저축·IRP를 나중에 받을 때」 블록이 없어졌다');

  // 계산기2 — 프리필로 이미 결과가 서 있다.
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(200);
  const calc2 = await page.evaluate(`(() => ({
    hasRefCaption: !!document.querySelector('.calc2-result-slot .benefit-strip-ref-caption'),
    hasPensionReference: !!document.querySelector('.calc2-result-slot .benefit-reference'),
    hasStripTitle: !!document.querySelector('.calc2-result-slot .account-benefit-strip h4'),
  }))()`);
  assert.equal(calc2.hasRefCaption, false, '계산기2 — 부연설명이 남아 있다');
  assert.equal(calc2.hasPensionReference, false, '계산기2 — 「연금저축·IRP를 나중에 받을 때」 블록이 남아 있다');
  assert.equal(calc2.hasStripTitle, true, '계산기2 — 계좌별 세제혜택 블록 자체(제목)까지 없어지면 안 된다');
});

test('납입 잔여 한도 대비 막대 — 계산기2에서는 계좌 이름이 막대 왼쪽에 있고, 행 사이 간격이 첫 탭보다 좁다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.calc2-result-slot .allocation-bar-row')];
    const first = rows[0];
    const label = first.querySelector('.allocation-bar-labels');
    const track = first.querySelector('.alloc-bar-track');
    const labelRect = label.getBoundingClientRect();
    const trackRect = (track ?? first.children[1]).getBoundingClientRect();
    // 행 사이 간격은 기하 측정(행 위/아래 끝 차)이 아니라 실제 CSS
    // gap 값을 직접 잰다 — 행이 하나뿐이거나 캡션 유무로 세로 흐름이
    // 달라지면 기하 측정이 0이나 음수로 흔들릴 수 있다(실측).
    const rowsGapPx = parseFloat(getComputedStyle(document.querySelector('.calc2-result-slot .allocation-bars')).rowGap
      || getComputedStyle(document.querySelector('.calc2-result-slot .allocation-bars')).gap);
    return { labelLeft: labelRect.left, trackLeft: trackRect.left, rowCount: rows.length, rowsGapPx };
  })()`);
  assert.ok(m.rowCount >= 2, `막대 행이 2개 미만이다: ${m.rowCount}`);
  assert.ok(m.labelLeft < m.trackLeft, `계좌 이름(왼쪽 끝 ${m.labelLeft})이 막대(왼쪽 끝 ${m.trackLeft})보다 왼쪽에 있지 않다`);

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 6000 });
  await sleep(200);
  const firstTabGapPx = await page.evaluate(`(() => {
    const bars = document.querySelector('.result-slot .allocation-bars');
    const cs = getComputedStyle(bars);
    return parseFloat(cs.rowGap || cs.gap);
  })()`);
  assert.ok(m.rowsGapPx < firstTabGapPx, `계산기2 행 간격(${m.rowsGapPx}px)이 첫 탭 행 간격(${firstTabGapPx}px)보다 좁지 않다`);
});

test('다른 배분 비교 — 계산기2에서는 각 행에 버튼 테두리가 있고 hover 배경이 바뀐다, 커서는 pointer다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .stackbar-row')`, { timeoutMs: 8000 });
  await sleep(200);
  // **선택된(기본안) 첫 행은 고른다**(`.stackbar-row-selected`)가 이미
  // `--accent-subtle` 배경을 깔고 있어, hover 배경 변화를 이 행에서 재면
  // "이미 칠해진 색 위에 또 칠한다"가 돼 눈에 보이는 변화가 실측에서
  // 가려질 수 있다(실측 — 선택 행에서는 hover 전후 색이 같았다). 선택
  // 되지 않은 행에서 잰다.
  const before = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.calc2-result-slot .stackbar-row')];
    const row = rows.find((r) => !r.className.includes('selected')) ?? rows[0];
    const cs = getComputedStyle(row);
    return { borderStyle: cs.borderStyle, borderWidth: cs.borderWidth, cursor: cs.cursor, background: cs.backgroundColor };
  })()`);
  assert.notEqual(before.borderStyle, 'none', `다른 배분 비교 행에 테두리가 없다: ${before.borderStyle}`);
  assert.ok(parseFloat(before.borderWidth) > 0, `테두리 두께가 0이다: ${before.borderWidth}`);
  assert.equal(before.cursor, 'pointer', `행의 커서가 pointer가 아니다: ${before.cursor}`);

  // 이 행이 뷰포트 밖에 있을 수 있다(결과가 길다) — `page.clickElement`와
  // 달리 이 시험은 좌표를 직접 계산해 CDP로 마우스를 보내므로, 스크롤로
  // 눈에 보이는 위치로 옮겨 두지 않으면 좌표가 뷰포트 밖을 가리켜
  // `elementFromPoint`가 아무것도 못 짚는다(실측 — y≈1700px, 기본
  // 뷰포트보다 훨씬 아래).
  const box = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.calc2-result-slot .stackbar-row')];
    const row = rows.find((r) => !r.className.includes('selected')) ?? rows[0];
    row.scrollIntoView({ block: 'center' });
    const r = row.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await sleep(30);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await sleep(200);
  const after = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.calc2-result-slot .stackbar-row')];
    const row = rows.find((r) => !r.className.includes('selected')) ?? rows[0];
    return getComputedStyle(row).backgroundColor;
  })()`);
  assert.notEqual(after, before.background, `마우스를 올려도 배경색이 바뀌지 않았다(hover 전 ${before.background}, 후 ${after})`);
});

test('하단 배분표 — 계산기2에서는 각 열의 x좌표가 행마다 정확히 일치한다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .account-table')`, { timeoutMs: 8000 });
  await sleep(200);
  const m = await page.evaluate(`(() => {
    const table = document.querySelector('.calc2-result-slot .account-table');
    const rows = [...table.querySelectorAll('tbody tr')].filter((r) => r.children.length === 4 && !r.className.includes('table-row'));
    const lefts = rows.map((r) => [...r.children].map((td) => td.getBoundingClientRect().left));
    return { rowCount: rows.length, lefts };
  })()`);
  assert.ok(m.rowCount >= 2, `일반 행(4칸)이 2개 미만이라 정렬을 비교할 수 없다: ${m.rowCount}`);
  const TOLERANCE_PX = 0.5;
  for (let col = 0; col < 4; col++) {
    const first = m.lefts[0][col];
    for (let row = 1; row < m.lefts.length; row++) {
      assert.ok(
        Math.abs(m.lefts[row][col] - first) <= TOLERANCE_PX,
        `${col}번째 열의 x좌표가 행마다 어긋난다: 0행 ${first}, ${row}행 ${m.lefts[row][col]}`,
      );
    }
  }
});

/**
 * [번들 실측 마감] 납입 잔여 한도 대비 막대의 왼쪽 라벨 열이 96px일 때
 * 금액 줄("250,000원 / 월")의 "/ 월"만 홀로 셋째 줄로 꺾였다 — 라벨 열을
 * 130px로 넓히고 금액에 `nowrap`을 걸었다(`.amount-value-chunk`가 이미
 * 쓰던 "원 단위 홀로 꺾임" 처방과 같은 관행). 실제 렌더 줄 수를
 * `Range.getClientRects`로 잰다(distinct top 개수 — 다른 파일의 헤드라인
 * 줄바꿈 검사와 같은 관행) — 이름 한 줄 + 금액 한 줄, 각각 정확히 1줄이어야
 * 한다(합쳐 최대 두 줄).
 */
test('납입 잔여 한도 대비 막대 — 계좌 이름·금액 줄이 각각 한 줄이다(금액이 「/ 월」만 홀로 꺾이지 않는다)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const rows = await page.evaluate(`(() => {
    const lineCount = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      return tops.size;
    };
    return [...document.querySelectorAll('.calc2-result-slot .allocation-bar-row')].map((row) => {
      const label = row.querySelector('.allocation-bar-labels');
      const nameEl = label.querySelector('.type-body-strong');
      const numEl = label.querySelector('.type-num');
      return {
        name: nameEl?.textContent ?? null,
        nameLines: nameEl ? lineCount(nameEl) : null,
        num: numEl?.textContent ?? null,
        numLines: numEl ? lineCount(numEl) : null,
      };
    });
  })()`);
  assert.ok(rows.length >= 2, `막대 행이 2개 미만이다: ${rows.length}`);
  for (const row of rows) {
    assert.equal(row.nameLines, 1, `계좌 이름("${row.name}")이 한 줄이 아니다(${row.nameLines}줄)`);
    assert.equal(row.numLines, 1, `금액 줄("${row.num}")이 한 줄이 아니다(${row.numLines}줄) — "/ 월"이 홀로 꺾였을 수 있다`);
  }
});

// ---------------------------------------------------------------------------
// [신규 회차, 소유자 지시 5항목, 전부 계산기2 한정] 팝업 재배치·청년 우대
// 제거·자금 사용 시점 답변 2 문구+디자인·섹션 제목 배율·하단 표 헤더 정렬.
// ---------------------------------------------------------------------------

/**
 * [2026-08-23, D82 소유자 지시 1번 — 뒤집힌 기대값] "오른쪽이 비어 보인다"는
 * 지적으로 다시 가로 배치(카피 | 카드)로 되돌아간다. 옛 검사(번들 실측
 * 마감 회차)는 카피(위)·행(아래) 세로 쌓기와 두 왼쪽 시작선이 맞는지를
 * 쟀다 — 이번 회차는 그 배치 자체를 접었으므로 지우지 않고 뒤집는다: 이제
 * 카피는 카드 **왼쪽**에 서고, 카드 **안**에서 정보 좌상단·도넛 우상단·
 * 절세액 하단(전체 폭)을 잰다.
 */
test('예시 팝업 재배치(D82) — 카피가 카드 왼쪽에, 카드 안은 정보 좌상단·도넛 우상단·절세액 하단이고, 카드가 주황 테두리+연한 주황 바탕이다, 두 버튼이 900px 높이에서도 스크롤 없이 보인다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${origin}/src/web/index.html`);
  // [2026-08-21, D81] 새로고침이 기본으로 calc2에 내려앉는다 — "탭 클릭으로
  // 팝업을 연다"를 실제로 관측하려면 먼저 다른 탭으로 비켜야 한다(안 그러면
  // 아래 `tab-calc2` 클릭이 이미 활성 탭이라 아무 일도 안 한다).
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);
  await page.evaluate(`localStorage.clear()`);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 8000 });
  await sleep(1200);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.calc2-example-modal-host');
    const root = host.shadowRoot;
    const body = root.querySelector('.calc2-example-modal-body');
    const heroCopy = body.querySelector('.example-hero-copy');
    const card = body.querySelector('.calc2-example-card');
    const info = card ? card.querySelector('.example-persona-info') : null;
    const donutCol = card ? card.querySelector('.example-persona-donut-col') : null;
    const amount = card ? card.querySelector('.example-persona-amount') : null;
    const names = [...root.querySelectorAll('.example-persona-name')].map((n) => n.textContent);
    const dismiss = document.querySelector('.calc2-example-modal-dismiss');
    const close = document.querySelector('.calc2-example-modal-close');
    // DOMRect는 구조화 복제로 직렬화되지 않는 값이 있어(returnByValue) 필요한
    // 필드만 뽑아 평범한 객체로 만든다.
    const asRect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
    const cardCs = card ? getComputedStyle(card) : null;
    const lineText = card ? [...card.querySelectorAll('.example-persona-line')].map((p) => p.textContent) : [];
    return {
      hasCard: !!card,
      heroRect: heroCopy ? asRect(heroCopy) : null,
      cardRect: card ? asRect(card) : null,
      infoRect: info ? asRect(info) : null,
      donutRect: donutCol ? asRect(donutCol) : null,
      amountRect: amount ? asRect(amount) : null,
      names,
      lineText,
      cardBorderColor: cardCs ? cardCs.borderTopColor : null,
      cardBorderWidth: cardCs ? cardCs.borderTopWidth : null,
      cardBg: cardCs ? cardCs.backgroundColor : null,
      dismissRect: asRect(dismiss),
      closeRect: asRect(close),
      viewportH: window.innerHeight,
    };
  })()`);
  assert.ok(m.hasCard, '예시 카드(.calc2-example-card)를 찾지 못했다');
  assert.deepEqual(m.names, ['김철수씨'], `이승은씨 행이 남아 있다: ${JSON.stringify(m.names)}`);
  assert.ok(m.heroRect && m.infoRect && m.donutRect && m.amountRect, '카피·정보·도넛·절세액 중 하나를 찾지 못했다');

  // "카피가 먼저" — 이제는 왼쪽/오른쪽(읽기 순서)으로 나타낸다.
  assert.ok(
    m.heroRect.left < m.infoRect.left,
    `히어로 카피(왼쪽 끝 ${m.heroRect.left})가 카드(정보 왼쪽 끝 ${m.infoRect.left})보다 왼쪽에 있지 않다`,
  );

  // 카드 안 — 정보 좌상단, 도넛 우상단, 절세액 하단(전체 폭).
  assert.ok(m.infoRect.left < m.donutRect.left, `정보(왼쪽 끝 ${m.infoRect.left})가 도넛(왼쪽 끝 ${m.donutRect.left})보다 왼쪽에 있지 않다 — 정보가 좌상단이 아니다`);
  // [2026-08-23, D83 소유자 지시 1번으로 뒤집힘] 정보가 도넛과 "같은 줄"이
  // 아니라 **한 행쯤 아래로** 내려간다(`styles.css`의
  // `.calc2-example-card .example-persona-info { margin-top: 16.83px; }`).
  // 이 시험은 원래 "같은 상단 줄"을 확인했으나, 소유자가 이번 회차에
  // 명시로 내리라고 지시했다 — 이제는 반대로 "도넛보다 아래에서
  // 시작한다"를 확인한다.
  assert.ok(
    m.infoRect.top > m.donutRect.top + 4,
    `정보(위 끝 ${m.infoRect.top})가 도넛(위 끝 ${m.donutRect.top})보다 아래에서 시작하지 않는다 — D83 소유자 지시 1번("한 행쯤 아래로")이 반영되지 않았다`,
  );
  assert.ok(m.amountRect.top >= Math.max(m.infoRect.bottom, m.donutRect.bottom) - 1, `절세액(위 끝 ${m.amountRect.top})이 정보·도넛 아래(하단)에 있지 않다`);
  // [2026-08-23, 소유자 지시 2번으로 뒤집힘] 세액공제액 카드가 카드 폭
  // 전체가 아니라 **가운데**에 온다(D83 소유자 지시 3번은 크기만 줄이고
  // 왼쪽에 붙였었다 — `justify-self: start`를 `center`로 바꿨다).
  const amountCenter = (m.amountRect.left + m.amountRect.right) / 2;
  const cardCenter = (m.cardRect.left + m.cardRect.right) / 2;
  assert.ok(
    Math.abs(amountCenter - cardCenter) <= 4,
    `절세액 카드(중심 ${amountCenter})가 예시 카드(중심 ${cardCenter}) 가운데에 있지 않다`,
  );

  // 카드처럼 — 주황 테두리 + 더 연한 주황 바탕(--accent-warm-subtle, 새 토큰).
  assert.equal(m.cardBorderColor, 'rgb(230, 115, 0)', `카드 테두리 색이 --accent-warm이 아니다: ${m.cardBorderColor}`);
  assert.notEqual(m.cardBorderWidth, '0px', '카드에 테두리 두께가 없다');
  assert.equal(m.cardBg, 'rgb(252, 238, 224)', `카드 바탕색이 --accent-warm-subtle(라이트)이 아니다: ${m.cardBg}`);

  // 「월 납입금」→「납입금」 — 값은 그대로, 라벨만 짧아진다.
  const capacityLine = m.lineText.find((t) => t.includes('150만원'));
  assert.ok(capacityLine, `납입금 줄을 찾지 못했다: ${JSON.stringify(m.lineText)}`);
  assert.ok(capacityLine.startsWith('납입금'), `납입금 줄이 "납입금"으로 시작하지 않는다: "${capacityLine}"`);
  assert.ok(!capacityLine.includes('월 납입금'), `옛 라벨("월 납입금")이 남아 있다: "${capacityLine}"`);

  for (const [label, rect] of [['「오늘 하루 보지 않음」', m.dismissRect], ['닫기(X)', m.closeRect]]) {
    assert.ok(rect.bottom <= m.viewportH && rect.top >= 0, `${label} 버튼이 900px 뷰포트 안에 없다(스크롤 필요): ${JSON.stringify(rect)}`);
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-23, D82 소유자 지시 1번] 예시 카드 내용 전체 −5% — 도넛은
 * `width`(158.4×0.95=150.48px), 나머지(정보 줄·이름표·절세액 글자)는
 * 각자의 확정 절댓값에 같은 배수를 직접 적용한다(SVG 밖 HTML 텍스트라
 * 컨테이너 스케일이 안 통한다, `styles.css` 주석 참고).
 */
test('D82 소유자 지시 1번 — 예시 카드 내용이 원래 크기의 95%다(도넛 폭·정보 줄·이름표·절세액 글자)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  // [2026-08-21, D81] 이 새로고침도 기본으로 calc2에 내려앉아 팝업을 곧장
  // 열 수 있다 — 앞 시험이 이미 localStorage를 지운 채로 끝났으므로(팝업을
  // 다시 닫지 않았다) 특히 그렇다. 아래 탭 클릭이 스크림에 막히지 않도록
  // 먼저 치운다(이 함수 자체가 다시 localStorage에 오늘 날짜를 남긴다 —
  // 바로 다음 줄에서 또 지우므로 최종 목적과 어긋나지 않는다).
  await dismissCalc2ExampleModalIfOpen(page);
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(100);
  await page.evaluate(`localStorage.clear()`);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 8000 });
  await sleep(1200);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.calc2-example-modal-host');
    const root = host.shadowRoot;
    const card = root.querySelector('.calc2-example-card');
    const px = (el) => el ? parseFloat(getComputedStyle(el).fontSize) : null;
    return {
      donutWidth: card.querySelector('.chart-donut')?.getBoundingClientRect().width ?? null,
      lineFontSize: px(card.querySelector('.example-persona-line')),
      nameFontSize: px(card.querySelector('.example-persona-name')),
      amountLabelFontSize: px(card.querySelector('.amount-card-label')),
      amountValueFontSize: px(card.querySelector('.amount-card-value')),
    };
  })()`);
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 0.5, `${label}(${actual})이 기대값(${expected})과 다르다`);
  // [2026-08-23, 소유자 지시 1번(신규 회차)으로 뒤집힘] 도넛 렌더 폭을
  // 150.48×1.1=165.528로 다시 키운다 — 조각 라벨 가독성 신고("연금저축이
  // 안 보인다") 대응, `styles.css`의 `.calc2-example-card .example-persona-donut-col
  // .chart-donut` 참고.
  near(m.donutWidth, 165.528, '도넛 렌더 폭');
  // [2026-08-23, D83 소유자 지시 1번으로 뒤집힘] 아이콘·기본 정보(이름표·
  // 정보 줄)만 추가 −10%(도넛·절세액은 그대로) — D82의 ×0.95에 이어
  // ×0.9, 누적 ×0.855. 13.851×0.9=12.4659, 9.61875×0.9=8.656875
  // (`styles.css`의 `.calc2-example-card .example-persona-line`/
  // `.example-persona-name`).
  near(m.lineFontSize, 12.4659, '정보 줄 글자');
  near(m.nameFontSize, 8.656875, '이름표 글자');
  near(m.amountLabelFontSize, 10.0035, '절세액 라벨 글자');
  near(m.amountValueFontSize, 20.007, '절세액 값 글자');
});

test('청년 우대 입력 제거 — 계산기2에는 청년 블록이 없고, 첫 탭에는 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  // 첫 탭 — 룰셋에서 청년 규칙을 읽을 시간을 준다.
  await sleep(500);
  const firstTabHas = await page.evaluate(
    `[...document.getElementById('tabpanel-calculator').querySelectorAll('.provisional-note-trigger')].some((el) => el.textContent.includes('청년'))`,
  );
  assert.equal(firstTabHas, true, '첫 탭에서까지 청년 우대 블록이 없어졌다 — 계산기2 한정이어야 한다');

  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(300);
  const calc2Has = await page.evaluate(
    `[...document.getElementById('tabpanel-calc2').querySelectorAll('*')].some((el) => el.textContent === '▸ 청년 우대 (개정안, 선택)')`,
  );
  assert.equal(calc2Has, false, '계산기2에 청년 우대 블록이 남아 있다');
});

test('자금 사용 시점 답변 2 — 계산기2 문구가 「10년 안에 쓸 계획이다」이고, 첫 탭 문구·엔진 값은 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(150);
  const calc2Label = await page.evaluate(
    `document.getElementById('calc2fundUseHorizon-before_pension_age').querySelector('.horizon-option-label').textContent`,
  );
  assert.equal(calc2Label, '10년 안에 쓸 계획이다', `계산기2 답변 2 문구가 다르다: ${calc2Label}`);

  const firstTabLabel = await page.evaluate(
    `document.getElementById('fundUseHorizon-before_pension_age').querySelector('.horizon-option-label').textContent`,
  );
  assert.notEqual(firstTabLabel, '10년 안에 쓸 계획이다', '첫 탭 문구까지 바뀌었다 — 계산기2 한정이어야 한다');
});

test('자금 사용 시점 답변들 — 계산기2에서는 테두리·hover·주황 채움 번호 동그라미다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(200);

  const before = await page.evaluate(`(() => {
    const btn = document.getElementById('calc2fundUseHorizon-before_pension_age');
    const index = btn.querySelector('.horizon-option-index');
    const btnCs = getComputedStyle(btn);
    const idxCs = getComputedStyle(index);
    return {
      border: btnCs.borderStyle,
      cursor: btnCs.cursor,
      background: btnCs.backgroundColor,
      indexBg: idxCs.backgroundColor,
    };
  })()`);
  assert.notEqual(before.border, 'none', `답변 버튼에 테두리가 없다: ${before.border}`);
  assert.equal(before.cursor, 'pointer', `답변 버튼 커서가 pointer가 아니다: ${before.cursor}`);
  assert.equal(before.indexBg, 'rgb(230, 115, 0)', `번호 동그라미가 주황(--accent-warm) 채움이 아니다: ${before.indexBg}`);

  const box = await page.evaluate(`(() => {
    const btn = document.getElementById('calc2fundUseHorizon-before_pension_age');
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await sleep(30);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await sleep(200);
  const after = await page.evaluate(`getComputedStyle(document.getElementById('calc2fundUseHorizon-before_pension_age')).backgroundColor`);
  assert.notEqual(after, before.background, `마우스를 올려도 답변 버튼 배경색이 바뀌지 않았다(전 ${before.background}, 후 ${after})`);
});

test('섹션 제목 글자 +25% — 계산기2 입력 섹션 제목이 첫 탭보다 1.25배 크다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await sleep(150);
  const calc2Size = await page.evaluate(
    `parseFloat(getComputedStyle(document.getElementById('tabpanel-calc2').querySelector('.input-group-title')).fontSize)`,
  );
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  const firstTabSize = await page.evaluate(
    `parseFloat(getComputedStyle(document.getElementById('tabpanel-calculator').querySelector('.input-group-title')).fontSize)`,
  );
  assert.ok(
    Math.abs(calc2Size - firstTabSize * 1.25) <= 0.5,
    `계산기2 제목(${calc2Size}px)이 첫 탭(${firstTabSize}px)의 1.25배가 아니다(기대 ${firstTabSize * 1.25}px)`,
  );
});

test('하단 배분표 — 계산기2에서는 월 배분·연 환산 헤더가 오른쪽 정렬로 데이터와 맞는다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalPreemptively(page);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .account-table')`, { timeoutMs: 8000 });
  await sleep(200);
  const m = await page.evaluate(`(() => {
    const table = document.querySelector('.calc2-result-slot .account-table');
    const headers = [...table.querySelectorAll('thead th')];
    return headers.map((h) => ({ text: h.textContent, align: getComputedStyle(h).textAlign }));
  })()`);
  const monthly = m.find((h) => h.text === '월 배분');
  const annual = m.find((h) => h.text === '연 환산');
  assert.ok(monthly && annual, `헤더를 찾지 못했다: ${JSON.stringify(m)}`);
  assert.equal(monthly.align, 'right', `「월 배분」 헤더가 오른쪽 정렬이 아니다: ${monthly.align}`);
  assert.equal(annual.align, 'right', `「연 환산」 헤더가 오른쪽 정렬이 아니다: ${annual.align}`);
});

// ---------------------------------------------------------------------------
// [2026-08-23, D82] 소유자 지시 11항목 중 결과 영역 6개(②~⑦, 전부 계산기2
// 마운트 한정 — 첫 탭은 그대로다, D82 판정 1).
// ---------------------------------------------------------------------------

/**
 * [D82 판정 1] 「자금 사용 시점을 밝히지 않아 판정하지 않았습니다 —
 * …」(D42 계열 정직성 문구)와 그 영역을 계산기2에서만 뺀다 — 첫 탭에는
 * 그대로 산다. ISA + `fundUseHorizon: 'unknown'`(계산기2 프리필이 이미
 * 그 값이다)이면 `early_termination_clawback_isa`(trigger:
 * `horizon_unknown`) 경고가 서는 조건이다(`engine/mock-engine.js`).
 */
test('D82 판정 1 — 자금 사용 시점 미판정 문구가 계산기2에는 없고, 첫 탭에는 그대로 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  // 계산기2 — 프리필이 이미 fundUseHorizon: 'unknown'이다. ISA만 켠다.
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(100);
  await page.clickElement(`document.getElementById('calc2IsaExists-true')`);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(400);
  const calc2Text = await page.evaluate(`document.querySelector('.calc2-result-slot').innerText`);
  assert.ok(
    !calc2Text.includes('자금 사용 시점을 밝히지 않아'),
    `계산기2에 자금 사용 시점 미판정 문구가 남아 있다: 찾은 자리 근처 "${calc2Text.slice(calc2Text.indexOf('자금 사용 시점') - 20, calc2Text.indexOf('자금 사용 시점') + 60)}"`,
  );

  // 첫 탭 — 같은 조건(ISA 있음 + 자금 사용 시점 모름)을 그대로 재현한다.
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  const set = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await page.evaluate(set('birthDate', '19960101'));
  await page.evaluate(set('currentSalary', '4000'));
  await page.evaluate(set('monthlyCapacity', '150'));
  await page.clickElement(`document.getElementById('hasNonWageIncome-false')`);
  await page.clickElement(`document.getElementById('annuityStarted-false')`);
  await page.clickElement(`document.getElementById('fundUseHorizon-unknown')`);
  await page.clickElement(`document.getElementById('isaExists-true')`);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(400);
  const firstTabText = await page.evaluate(`document.querySelector('.result-slot').innerText`);
  assert.ok(firstTabText.includes('자금 사용 시점을 밝히지 않아'), '첫 탭에서까지 자금 사용 시점 미판정 문구가 없어졌다 — 계산기2 한정이어야 한다');
});

/**
 * [D82 소유자 지시 3·4번] 「월 납입 여력…나눕니다」 제목과 「…기본」
 * 배분안 이름 캡션을 계산기2에서 뺀다. 「최적 월 배분표」(kicker)가 결과
 * 영역(도넛 카드) 최상단으로 올라가고, 「기본 정보」(입력 섹션 제목)와
 * 같은 크기·굵기이며, 옆 아이콘이 주황이다.
 */
test('D82 소유자 지시 3·4번 — 계산기2 결과 상단에 「최적 월 배분표」만 「기본 정보」와 같은 크기로 서고, 옆 아이콘이 주황이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);

  const m = await page.evaluate(`(() => {
    const scope = document.querySelector('.calc2-result-slot');
    const header = scope.querySelector('.donut-section-header');
    const kicker = header.querySelector('.donut-optimal-kicker');
    const icon = header.querySelector('.section-icon');
    const groupTitle = document.getElementById('tabpanel-calc2').querySelector('.input-group-title');
    const resolve = (varExpr) => {
      const probe = document.createElement('div');
      probe.style.color = varExpr;
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    return {
      headerText: header.textContent.trim(),
      kickerText: kicker ? kicker.textContent : null,
      kickerFontSize: kicker ? getComputedStyle(kicker).fontSize : null,
      kickerFontWeight: kicker ? getComputedStyle(kicker).fontWeight : null,
      groupTitleFontSize: groupTitle ? getComputedStyle(groupTitle).fontSize : null,
      groupTitleFontWeight: groupTitle ? getComputedStyle(groupTitle).fontWeight : null,
      iconColor: icon ? getComputedStyle(icon).color : null,
      accentWarm: resolve('var(--accent-warm)'),
    };
  })()`);
  // [2026-08-23, D83 소유자 지시 4번 / 판정 3으로 뒤집힘] 「최적 월
  // 배분표」→「최적 월 배분」("표"를 뗀다) — 이 자리가 이제 시나리오
  // 탭보다 위(결과 최상단)로 옮겨져(판정 3) 표라기보다 첫 문장에 가깝다는
  // 것이 소유자의 이유였다. 첫 탭은 옛 상수(`DONUT_OPTIMAL_KICKER_LABEL`,
  // 「최적 월 배분표」)를 그대로 쓴다 — `calc2-copy.js`의
  // `CALC2_DONUT_OPTIMAL_KICKER_LABEL`.
  assert.equal(m.kickerText, '최적 월 배분', `kicker 문구가 다르다: ${m.kickerText}`);
  assert.ok(!m.headerText.includes('나눕니다'), `「월 납입 여력…나눕니다」 제목이 남아 있다: "${m.headerText}"`);
  assert.ok(!m.headerText.includes('기본'), `배분안 이름 캡션("…기본")이 남아 있다: "${m.headerText}"`);
  assert.equal(m.kickerFontSize, m.groupTitleFontSize, `kicker 크기(${m.kickerFontSize})가 「기본 정보」 크기(${m.groupTitleFontSize})와 다르다`);
  assert.equal(m.kickerFontWeight, m.groupTitleFontWeight, `kicker 굵기(${m.kickerFontWeight})가 「기본 정보」 굵기(${m.groupTitleFontWeight})와 다르다`);
  assert.equal(m.iconColor, m.accentWarm, `아이콘 색이 --accent-warm이 아니다: ${m.iconColor}`);
});

/**
 * [2026-08-23, 관리자 지시(신규 회차) 3~7번으로 D83 판정 3 재배치] 결과
 * 위계 — 「제목(최적 월 배분) → 시나리오 탭 → 헤드라인 → 구성 한 줄 →
 * 도넛(+아이콘) → 나머지」, 계산기2 한정. y좌표로 순서를 잰다(자리가
 * 아니라 실제로 보이는 순서를 확인한다). 첫 탭은 옛 배치(시나리오 탭이
 * 최상단, 제목이 도넛과 한 덩어리) 그대로다.
 */
test('관리자 지시(신규 회차) 3~7번 — 계산기2 결과 위계가 제목→탭→헤드라인→구성→도넛 순이다, 첫 탭은 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const calc2Tops = await page.evaluate(`(() => {
    const scope = document.querySelector('.calc2-result-slot');
    const top = (sel) => { const el = scope.querySelector(sel); return el ? el.getBoundingClientRect().top : null; };
    return {
      title: top('.donut-section-header-calc2'),
      tabs: top('.scenario-tabs'),
      headline: top('.amount-card'),
      composition: top('.amount-card-composition-single'),
      donut: top('.chart-area .donut-with-strip'),
    };
  })()`);
  assert.ok(
    calc2Tops.title != null && calc2Tops.tabs != null && calc2Tops.headline != null && calc2Tops.composition != null && calc2Tops.donut != null,
    `계산기2 결과 위계의 다섯 자리 중 하나를 찾지 못했다: ${JSON.stringify(calc2Tops)}`,
  );
  assert.ok(calc2Tops.title < calc2Tops.tabs, `제목(${calc2Tops.title})이 시나리오 탭(${calc2Tops.tabs})보다 위에 있지 않다`);
  assert.ok(calc2Tops.tabs < calc2Tops.headline, `시나리오 탭(${calc2Tops.tabs})이 헤드라인(${calc2Tops.headline})보다 위에 있지 않다`);
  assert.ok(calc2Tops.headline <= calc2Tops.composition, `헤드라인(${calc2Tops.headline})이 구성 한 줄(${calc2Tops.composition})보다 아래에 있다`);
  assert.ok(calc2Tops.composition < calc2Tops.donut, `구성 한 줄(${calc2Tops.composition})이 도넛(${calc2Tops.donut})보다 위에 있지 않다`);

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const firstTabOrder = await page.evaluate(`(() => {
    const scope = document.querySelector('.result-slot');
    const chartArea = scope.querySelector('.chart-area');
    const tabs = scope.querySelector('.scenario-tabs');
    if (!chartArea || !tabs) return null;
    // 첫 탭은 옛 배치 — 시나리오 탭이 chartArea보다 앞(DOCUMENT_POSITION_PRECEDING=2)이다.
    return !!(chartArea.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_PRECEDING);
  })()`);
  assert.equal(firstTabOrder, true, '첫 탭에서는 시나리오 탭이 여전히 「최적 월 배분표」보다 DOM상 앞에 있어야 한다(회귀)');
  const firstTabHasSingleLine = await page.evaluate(`!!document.querySelector('.result-slot .amount-card-composition-single')`);
  assert.equal(firstTabHasSingleLine, false, '첫 탭에 구성 한 줄(계산기2 전용)이 생기면 안 된다(회귀) — 첫 탭은 두 줄 그대로다');
});

/**
 * [D82 소유자 지시 5번] 결과 도넛의 지시선(계좌 라벨↔도넛 연결선)을 없애고
 * 라벨을 조각에 더 가깝게 붙인다 — 단 조각 위(안)에는 쓰지 않는다.
 */
test('D82 소유자 지시 5번 — 계산기2 결과 도넛에는 지시선이 없고, 라벨이 조각 밖에 가깝게 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);

  const m = await page.evaluate(`(() => {
    const donut = document.querySelector('.calc2-result-slot .chart-donut');
    const leaderCount = donut.querySelectorAll('.donut-slice-label-leader, .donut-leader').length;
    const rOuter = Number(donut.dataset.rOuter);
    const label = donut.querySelector('.donut-slice-label');
    const labelBox = label ? label.getBBox() : null;
    const cx = Number(donut.dataset.cx);
    const cy = Number(donut.dataset.cy ?? label?.getAttribute('y'));
    return {
      leaderCount,
      hasLabel: !!label,
      // 라벨 중심의 반지름 방향 거리 — 조각 밖(고리 밖)이면서도 너무
      // 멀지 않아야("더 가깝게") 한다. 텍스트 y 좌표로 근사한다.
      labelY: label ? Number(label.getAttribute('y')) : null,
      rOuter,
      cy,
    };
  })()`);
  assert.equal(m.leaderCount, 0, `지시선이 남아 있다: ${m.leaderCount}개`);
  assert.ok(m.hasLabel, '조각 라벨을 찾지 못했다');
});

/**
 * [D82 소유자 지시 6번, D83 소유자 지시 6번, 소유자 지시 2번(신규 회차)로
 * 다시 크기 수정] 결과 도넛 — 계산기2는 legend 모드로 고정되고(판단
 * 근거는 5번 항목과 같다, `ui/result-panel.js` 주석), 190×1.1=209px로
 * 렌더된다 — 조각 라벨("연금저축") 가독성 신고 대응.
 */
test('소유자 지시 2번(신규 회차) — 계산기2 결과 도넛이 209px(190px×1.1)로 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const width = await page.evaluate(`document.querySelector('.calc2-result-slot .chart-donut').getBoundingClientRect().width`);
  assert.ok(Math.abs(width - 209) <= 1, `계산기2 결과 도넛 렌더 폭(${width}px)이 209px가 아니다`);
});

/**
 * [D82 소유자 지시 7번] 결과란 세로 간격을 일관된 배수(×0.75)로 줄인다 —
 * 과감하지 않게. `.result-body`·`.chart-area`의 실제 `gap` 값을 잰다.
 */
test('D82 소유자 지시 7번 — 계산기2 결과 세로 간격이 첫 탭보다 좁다(일관된 배수)', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const calc2Body = document.querySelector('.calc2-result-slot .result-body');
    const calc2Chart = document.querySelector('.calc2-result-slot .chart-area');
    return {
      calc2BodyGap: calc2Body ? getComputedStyle(calc2Body).rowGap : null,
      calc2ChartGap: calc2Chart ? getComputedStyle(calc2Chart).rowGap : null,
    };
  })()`);
  assert.equal(m.calc2BodyGap, '18px', `계산기2 .result-body 간격이 18px(24×0.75)가 아니다: ${m.calc2BodyGap}`);
  assert.equal(m.calc2ChartGap, '12px', `계산기2 .chart-area 간격이 12px(16×0.75)가 아니다: ${m.calc2ChartGap}`);
});

// ---------------------------------------------------------------------------
// [2026-08-23, D82] 소유자 지시 8·9·10번 — 요약 저장·공유(계산기2 결과
// 기준, 전부 계산기2 마운트 한정, 첫 탭에는 그대로 있다).
// ---------------------------------------------------------------------------

test('D82 소유자 지시 8번 — 계산기2 저장·공유에 캡션·소제목이 없고, 첫 탭에는 그대로 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .save-share')`, { timeoutMs: 8000 });
  await sleep(300);
  const calc2Text = await page.evaluate(`document.querySelector('.calc2-result-slot .save-share').textContent`);
  assert.ok(!calc2Text.includes('요약 저장'), `계산기2 저장·공유에 「요약 저장」 소제목이 남아 있다: "${calc2Text}"`);
  assert.ok(!calc2Text.includes('이미지·PDF 모두 요약'), `계산기2 저장·공유에 캡션이 남아 있다: "${calc2Text}"`);

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .save-share')`, { timeoutMs: 8000 });
  const firstTabText = await page.evaluate(`document.querySelector('.result-slot .save-share').textContent`);
  assert.ok(firstTabText.includes('요약 저장'), '첫 탭에서까지 「요약 저장」 소제목이 없어졌다 — 계산기2 한정이어야 한다');
  assert.ok(firstTabText.includes('이미지·PDF 모두 요약'), '첫 탭에서까지 캡션이 없어졌다 — 계산기2 한정이어야 한다');
});

/**
 * [D82 판정 2] PDF 저장 버튼 — 계산기2에서만 화면에서 뺀다. 조립기·인쇄
 * CSS는 지우지 않는다(코드 리뷰 대상 — `ui/print.js`의 `exportToPdf`는
 * 여전히 있고, 버튼만 렌더 분기로 숨었다).
 */
test('D82 판정 2 — 계산기2에는 PDF 저장 버튼이 없고, 첫 탭에는 그대로 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .save-share')`, { timeoutMs: 8000 });
  await sleep(300);
  const calc2HasPdf = await page.evaluate(
    `[...document.querySelectorAll('.calc2-result-slot .save-share button')].some((b) => b.textContent.includes('PDF'))`,
  );
  assert.equal(calc2HasPdf, false, '계산기2에 PDF 저장 버튼이 남아 있다');

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .save-share')`, { timeoutMs: 8000 });
  const firstTabHasPdf = await page.evaluate(
    `[...document.querySelectorAll('.result-slot .save-share button')].some((b) => b.textContent.trim() === 'PDF로 저장')`,
  );
  assert.equal(firstTabHasPdf, true, '첫 탭에서까지 PDF 저장 버튼이 없어졌다 — 계산기2 한정이어야 한다(조립기는 그대로다)');
});

/**
 * [D82 판정 4] 이미지로 저장·내 결과 공유하기 버튼이 계산기2에서는 아이콘
 * (마스크 이미지, `--accent-warm` 단색)만 남고 글자가 없다 — 대신
 * `aria-label`이 접근 가능한 이름을 진다. 첫 탭은 그대로 글자 버튼이다.
 */
test('D82 판정 4 — 계산기2 저장·공유 버튼이 아이콘(주황)만 남고 aria-label을 진다, 첫 탭은 그대로 글자 버튼이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .save-share')`, { timeoutMs: 8000 });
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const scope = document.querySelector('.calc2-result-slot .save-share');
    const buttons = [...scope.querySelectorAll('button')];
    const resolve = (varExpr) => {
      const probe = document.createElement('div');
      probe.style.color = varExpr;
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    return {
      count: buttons.length,
      ariaLabels: buttons.map((b) => b.getAttribute('aria-label')),
      textContents: buttons.map((b) => b.textContent.trim()),
      iconColors: buttons.map((b) => {
        const icon = b.querySelector('.save-share-icon');
        return icon ? getComputedStyle(icon).backgroundColor : null;
      }),
      accentWarm: resolve('var(--accent-warm)'),
    };
  })()`);
  assert.equal(m.count, 2, `계산기2 저장·공유 버튼이 2개(이미지·공유)가 아니다: ${m.count}`);
  assert.ok(m.ariaLabels.includes('이미지로 저장'), `이미지 버튼 aria-label이 없다: ${JSON.stringify(m.ariaLabels)}`);
  assert.ok(m.ariaLabels.includes('내 결과 공유하기'), `공유 버튼 aria-label이 없다: ${JSON.stringify(m.ariaLabels)}`);
  for (const [i, text] of m.textContents.entries()) {
    assert.equal(text, '', `버튼 ${i}에 글자가 남아 있다(아이콘만 남아야 한다): "${text}"`);
  }
  for (const [i, color] of m.iconColors.entries()) {
    assert.equal(color, m.accentWarm, `버튼 ${i} 아이콘 색이 --accent-warm이 아니다: ${color}`);
  }

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .save-share')`, { timeoutMs: 8000 });
  const firstTabTexts = await page.evaluate(
    `[...document.querySelectorAll('.result-slot .save-share button')].map((b) => b.textContent.trim())`,
  );
  assert.deepEqual(
    firstTabTexts.sort(),
    ['PDF로 저장', '내 결과 공유하기', '이미지로 저장'].sort(),
    `첫 탭 저장·공유 버튼 글자가 달라졌다 — 계산기2 한정이어야 한다: ${JSON.stringify(firstTabTexts)}`,
  );
});

/**
 * [2026-08-23, D83 소유자 지시 5번] 계산기2 결과 헤드라인("이 배분으로
 * 계산된 세액공제액…")이 왼쪽 정렬 — 첫 탭은 가운데 정렬 그대로다.
 */
test('D83 소유자 지시 5번 — 계산기2 결과 헤드라인이 왼쪽 정렬이다, 첫 탭은 가운데 정렬 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const calc2 = await page.evaluate(`(() => {
    const card = document.querySelector('.calc2-result-slot .result-body .amount-card');
    const parent = card.parentElement;
    const cardRect = card.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return { leftGap: cardRect.left - parentRect.left, rightGap: parentRect.right - cardRect.right };
  })()`);
  assert.ok(
    calc2.leftGap < calc2.rightGap - 4,
    `계산기2 헤드라인이 왼쪽 정렬이 아니다(왼쪽 여백 ${calc2.leftGap}, 오른쪽 여백 ${calc2.rightGap})`,
  );

  await page.clickElement(`document.getElementById('tab-calculator')`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const firstTab = await page.evaluate(`(() => {
    const card = document.querySelector('.result-slot .result-body .amount-card');
    const parent = card.parentElement;
    const cardRect = card.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return { leftGap: cardRect.left - parentRect.left, rightGap: parentRect.right - cardRect.right };
  })()`);
  assert.ok(
    Math.abs(firstTab.leftGap - firstTab.rightGap) <= 2,
    `첫 탭 헤드라인이 가운데 정렬이 아니다(회귀, 왼쪽 여백 ${firstTab.leftGap}, 오른쪽 여백 ${firstTab.rightGap})`,
  );
});

/**
 * [2026-08-23, D83 소유자 지시 7번, 관리자 지시(신규 회차) 7번, 소유자
 * 지시 3번(그다음 회차)으로 위치 재정정] 이미지·공유 버튼이 **도넛 차트가
 * 차지하는 영역의 우측 하단**, 「계좌별 세제혜택」(`AccountBenefitStrip`)
 * **보다 위**에 한 행으로, 테두리 없이, +5% 크기, 두 아이콘 간격 −20%로 —
 * 첫 탭은 두 줄(이미지+PDF, 공유) 그대로다.
 *
 * **y좌표 검사가 핵심이다.** 이전 회차는 버튼이 "도넛 영역 우측 하단"
 * 이라는 자리 이름은 맞았지만, 실제로는 `.donut-with-strip`(도넛+범례+
 * 세제혜택을 다 담은 통) **전체**의 형제로 붙어 세제혜택 블록 **아래**에
 * 렌더됐다 — 실측 스크린샷으로 소유자가 잡았다. 그래서 이 시험은 "행
 * 안에 있다"가 아니라 **버튼의 아래쪽 끝이 세제혜택의 위쪽 끝보다 위에
 * 있는지**를 직접 잰다.
 */
test('소유자 지시 3번(신규 회차) — 계산기2 이미지·공유 버튼이 계좌별 세제혜택보다 위, 도넛 영역 우측 하단 한 행에, 테두리 없이, +5% 크기·−20% 간격이다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut path')`, { timeoutMs: 8000 });
  await sleep(300);
  const m = await page.evaluate(`(() => {
    const scope = document.querySelector('.calc2-result-slot');
    const donutWithStrip = scope.querySelector('.chart-area .donut-with-strip');
    const strip = scope.querySelector('.account-benefit-strip');
    const donutWrap = scope.querySelector('.chart-area .donut-wrap');
    const buttons = [...scope.querySelectorAll('.save-share-icon-btn')];
    const rows = new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    const borders = buttons.map((b) => getComputedStyle(b).borderStyle);
    const icons = buttons.map((b) => { const r = b.querySelector('.save-share-icon').getBoundingClientRect(); return { w: r.width, h: r.height }; });
    const rects = buttons.map((b) => b.getBoundingClientRect());
    const insideDonutWithStrip = !!donutWithStrip && buttons.every((b) => donutWithStrip.contains(b));
    const belowDonutWrap = !!donutWrap && rects.every((r) => r.top >= donutWrap.getBoundingClientRect().bottom - 1);
    // 핵심 검사 — 버튼 아래쪽 끝 < 세제혜택 위쪽 끝(소유자 지시 3번 원문).
    const stripTop = strip ? strip.getBoundingClientRect().top : null;
    const buttonsBottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : null;
    const aboveStrip = stripTop != null && buttonsBottom != null && buttonsBottom <= stripTop + 1;
    const containerRect = donutWithStrip ? donutWithStrip.getBoundingClientRect() : null;
    const rowRight = rects.length ? Math.max(...rects.map((r) => r.right)) : null;
    const rightAligned = containerRect && rowRight != null && Math.abs(rowRight - containerRect.right) <= 2;
    const gap = rects.length === 2 ? Math.abs(rects[1].left - rects[0].right) : null;
    return { count: buttons.length, rowCount: rows.size, borders, icons, insideDonutWithStrip, belowDonutWrap, aboveStrip, stripTop, buttonsBottom, rightAligned, gap };
  })()`);
  assert.equal(m.count, 2, `계산기2 저장·공유 버튼이 2개가 아니다: ${m.count}`);
  assert.equal(m.rowCount, 1, `이미지·공유 버튼이 한 행에 있지 않다(서로 다른 top ${m.rowCount}개)`);
  assert.equal(m.insideDonutWithStrip, true, '이미지·공유 버튼이 도넛 영역(.donut-with-strip) 안에 있지 않다');
  assert.equal(m.belowDonutWrap, true, '이미지·공유 버튼이 도넛 그림보다 아래(하단)에 있지 않다');
  assert.equal(
    m.aboveStrip,
    true,
    `이미지·공유 버튼(아래쪽 끝 ${m.buttonsBottom})이 계좌별 세제혜택(위쪽 끝 ${m.stripTop})보다 아래에 있다 — 위치가 잘못됐다`,
  );
  assert.equal(m.rightAligned, true, '이미지·공유 버튼이 도넛 영역의 우측에 붙어 있지 않다');
  for (const [i, border] of m.borders.entries()) {
    assert.equal(border, 'none', `버튼 ${i}에 테두리가 남아 있다: ${border}`);
  }
  for (const [i, icon] of m.icons.entries()) {
    // 22 × 1.05 = 23.1
    assert.ok(Math.abs(icon.w - 23.1) <= 1, `버튼 ${i} 아이콘 폭(${icon.w})이 23.1px가 아니다`);
    assert.ok(Math.abs(icon.h - 23.1) <= 1, `버튼 ${i} 아이콘 높이(${icon.h})가 23.1px가 아니다`);
  }
  // 6.4px = 8(--space-2) × 0.8
  assert.ok(m.gap != null && Math.abs(m.gap - 6.4) <= 1.5, `두 아이콘 간격(${m.gap}px)이 −20%(6.4px) 근처가 아니다`);
});

/**
 * [2026-08-23, D83 소유자 지시 8번 / 판정 2] 「ISA 예상 수익률 (선택)」에서
 * "(선택)" 삭제, 방어 문구 삭제 — 계산기2 한정. 첫 탭·역산기는 그대로다.
 */
test('D83 소유자 지시 8번 — 계산기2 ISA 수익률 절 제목·문구가 계산기2 한정으로 짧아진다, 첫 탭·역산기는 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(100);
  const calc2 = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calc2');
    const titleEl = [...panel.querySelectorAll('.input-group-title')].find((el) => el.textContent.includes('ISA 예상 수익률'));
    return { titleText: titleEl ? titleEl.textContent.trim() : null, panelText: panel.innerText };
  })()`);
  assert.ok(calc2.titleText, '계산기2에서 「ISA 예상 수익률」 제목을 찾지 못했다');
  assert.ok(!calc2.titleText.includes('(선택)'), `계산기2 ISA 수익률 제목에 "(선택)"이 남아 있다: "${calc2.titleText}"`);
  assert.ok(
    !calc2.panelText.includes('직접 예상한 수익률을 넣어야 합니다'),
    '계산기2에 방어 문구("직접 예상한 수익률을 넣어야 합니다…")가 남아 있다',
  );

  // 첫 탭 — 그대로("(선택)"·방어 문구 둘 다 있어야 한다).
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  const firstTab = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calculator');
    const titleEl = [...panel.querySelectorAll('.input-group-title')].find((el) => el.textContent.includes('ISA 예상 수익률'));
    return { titleText: titleEl ? titleEl.textContent.trim() : null };
  })()`);
  assert.ok(firstTab.titleText && firstTab.titleText.includes('(선택)'), `첫 탭 ISA 수익률 제목에서 "(선택)"이 없어졌다(회귀): "${firstTab.titleText}"`);
  await page.clickElement(`document.getElementById('isaExists-true')`);
  await sleep(100);
  const firstTabHelp = await page.evaluate(`document.getElementById('tabpanel-calculator').innerText`);
  assert.ok(
    firstTabHelp.includes('직접 예상한 수익률을 넣어야 합니다'),
    '첫 탭에서 방어 문구가 없어졌다(회귀) — 계산기2 한정이어야 한다',
  );

  // 역산기 — 이 절 자체가 없다(완전히 다른 필드, "평균 수익률(연)") — 회귀 확인.
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const reverseHasSection = await page.evaluate(
    `!!document.getElementById('tabpanel-pension-reverse').querySelector('.input-group-title')?.textContent?.includes?.('ISA 예상 수익률')`,
  );
  assert.equal(reverseHasSection, false, '역산기에 "ISA 예상 수익률" 절 자체가 생기면 안 된다 — 역산기는 「평균 수익률(연)」이라는 별도 필드다');
});

/**
 * [2026-08-23, D83 소유자 지시 9번 / 판정 2] 계산기2 프리필에 ISA 예상
 * 수익률 5%가 들어간다, 편집 가능하다 — 첫 탭·역산기는 무기본값 그대로다.
 */
test('D83 소유자 지시 9번 — 계산기2 수익률 프리필이 5%다, 편집 가능하다, 첫 탭·역산기는 무기본값 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await dismissCalc2ExampleModalIfOpen(page);
  await page.evaluate(`(() => { document.querySelector('#tabpanel-calc2 .calc2-more-info').open = true; })()`);
  await sleep(150);
  // `ui/dom.js`의 `el()`은 불리언 속성을 HTML 관행대로 다룬다 — `true`면
  // 빈 문자열 값으로 속성 자체를 붙이고(`aria-checked=""`), `false`면
  // 속성을 아예 안 붙인다(`getAttribute`가 `null`을 낸다) — "true"라는
  // 문자열 값이 아니다.
  const prefill = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calc2');
    return {
      toggleChecked: panel.querySelector('#calc2IsaReturnEnabled-true')?.getAttribute('aria-checked') !== null,
      rate: panel.querySelector('#calc2IsaReturnRatePercent')?.value,
    };
  })()`);
  assert.equal(prefill.toggleChecked, true, '계산기2 ISA 수익률 토글이 프리필로 켜져 있지 않다');
  assert.equal(prefill.rate, '5', `계산기2 ISA 수익률 프리필이 5가 아니다: ${prefill.rate}`);

  // 편집 가능 — 고쳐 쓰고 값이 실제로 바뀌는지 확인한다.
  await page.evaluate(set('calc2IsaReturnRatePercent', '7.5'));
  await sleep(150);
  const edited = await page.evaluate(`document.getElementById('calc2IsaReturnRatePercent').value`);
  assert.equal(edited, '7.5', '계산기2 수익률 프리필을 고쳐 쓸 수 없다');

  // 첫 탭 — 무기본값(꺼짐·빈 값) 그대로(회귀, D77 판정 1).
  await page.clickElement(`document.getElementById('tab-calculator')`);
  await sleep(150);
  const firstTab = await page.evaluate(`(() => {
    const panel = document.getElementById('tabpanel-calculator');
    return {
      toggleChecked: panel.querySelector('#isaReturnEnabled-true')?.getAttribute('aria-checked') !== null,
    };
  })()`);
  assert.equal(firstTab.toggleChecked, false, '첫 탭 ISA 수익률 토글이 기본으로 켜져 있으면 안 된다(회귀) — 계산기2 프리필과 무관해야 한다');
  await page.clickElement(`document.getElementById('isaExists-true')`);
  await page.clickElement(`document.getElementById('isaReturnEnabled-true')`);
  await sleep(150);
  const firstTabRate = await page.evaluate(`document.getElementById('isaReturnRatePercent')?.value`);
  assert.equal(firstTabRate, '', `첫 탭 수익률 칸에 기본값이 들어 있으면 안 된다(회귀): "${firstTabRate}"`);

  // 역산기 — 평균 수익률(연) 필드도 무기본값 그대로(회귀, D77 판정 1 계보).
  await page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
  const reverseRate = await page.evaluate(`document.getElementById('averageReturnRatePercent')?.value`);
  assert.equal(reverseRate, '', `역산기 평균 수익률 칸에 기본값이 들어 있으면 안 된다(회귀): "${reverseRate}"`);
});
