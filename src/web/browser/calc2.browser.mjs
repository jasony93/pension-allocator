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
 */
async function dismissCalc2ExampleModalPreemptively(page) {
  await page.evaluate(`localStorage.setItem('calc2ExampleModalDismissedDate', (() => {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  })())`);
}

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

test('예시 팝업 재배치 — 히어로 카피가 위, 김철수씨 한 행만 아래, 두 버튼이 900px 높이에서도 스크롤 없이 보인다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(`localStorage.clear()`);
  await page.clickElement(`document.getElementById('tab-calc2')`);
  await page.waitFor(`!!document.querySelector('.modal[role="dialog"]')`, { timeoutMs: 8000 });
  await sleep(1200);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.calc2-example-modal-host');
    const root = host.shadowRoot;
    const body = root.querySelector('.calc2-example-modal-body');
    const heroCopy = body.querySelector('.example-hero-copy');
    const rows = [...body.querySelectorAll('.example-persona-row')];
    const names = [...root.querySelectorAll('.example-persona-name')].map((n) => n.textContent);
    const dismiss = document.querySelector('.calc2-example-modal-dismiss');
    const close = document.querySelector('.calc2-example-modal-close');
    // DOMRect는 구조화 복제로 직렬화되지 않는 값이 있어(returnByValue) 필요한
    // 필드만 뽑아 평범한 객체로 만든다.
    const asRect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    return {
      heroTop: heroCopy ? heroCopy.getBoundingClientRect().top : null,
      rowTop: rows[0] ? rows[0].getBoundingClientRect().top : null,
      rowCount: rows.length,
      names,
      dismissRect: asRect(dismiss),
      closeRect: asRect(close),
      viewportH: window.innerHeight,
    };
  })()`);
  assert.equal(m.rowCount, 1, `예시 행이 정확히 1개(김철수씨만)여야 한다: ${m.rowCount}`);
  assert.deepEqual(m.names, ['김철수씨'], `이승은씨 행이 남아 있다: ${JSON.stringify(m.names)}`);
  assert.ok(m.heroTop != null && m.rowTop != null, '히어로 카피 또는 예시 행을 찾지 못했다');
  assert.ok(m.heroTop < m.rowTop, `히어로 카피(위 끝 ${m.heroTop})가 예시 행(위 끝 ${m.rowTop})보다 위에 있지 않다`);
  for (const [label, rect] of [['「오늘 하루 보지 않음」', m.dismissRect], ['닫기(X)', m.closeRect]]) {
    assert.ok(rect.bottom <= m.viewportH && rect.top >= 0, `${label} 버튼이 900px 뷰포트 안에 없다(스크롤 필요): ${JSON.stringify(rect)}`);
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
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
