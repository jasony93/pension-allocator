import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';

/**
 * 배분안이 넷일 때의 비교 UI·표를 좁은 화면에서 실측한다 (계약 5.0.0 · D26,
 * 넷째 안 개명은 6.0.0 · D32).
 *
 * **왜 실측인가.** 넷째 안(옛 id `pension_contribution_limit_fill`, 지금은
 * `pension_contribution_before_isa`)이 비교 목록에 들어오면서 `PLAN_LABEL`의
 * 라벨 길이가 기존 셋보다 길어졌다. jsdom 기반 단위 검사는 레이아웃을
 * 계산하지 않으므로 고정폭 열이 좁은 화면에서 잘려 나가는 것을 잡지 못한다
 * — 실제로 이 실측에서 스택바 금액이 화면 밖으로 잘리고 `AccountTable`의
 * 헤더 글자가 한 자씩 세로로 쪼개지는 결함을 잡았다.
 *
 * 넷을 모두 서로 다른 배분으로 만들려면 개정안 청년 우대(계좌마다 공제율이
 * 갈려 `max_tax_credit`·`annuity_savings_first`의 세제상 동점 전제가 무너진다,
 * 계약 0.4절)를 켠다 — 그래야 네 안이 하나로 합쳐지지 않는다.
 */

let app;

// [2026-08-24, D84] 「절세계좌 계산기2(근거판)」(첫 탭)이 지워져 청년 우대
// 블록 자체가 앱에서 사라졌다(D80 판정 — "계산기2에는 청년 블록이 없다").
// 원래 이 파일은 청년 우대를 켜 계좌마다 공제율이 갈리게 만들어 네 배분안이
// 전부 다르게(동점 없이) 나오는 조건을 만들었다 — 그 손잡이가 이제 UI
// 어디에도 없어 그 정확한 조건은 재현할 수 없다. calc2의 기본 프리필
// 상태에서 자연히 서는 배분안 수(현재 3개 — 청년 우대 없이는 한 쌍이
// 동점이라 화면이 합친다, 계약 0.4절)로 같은 구조 시험(좁은 화면 넘침·
// 금액 잘림·표 가로 스크롤)을 잇는다.
const CALC_SCOPE = `document.getElementById('tabpanel-calc2')`;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await dismissCalc2ExampleModalIfOpen(page);
  await page.waitFor(`!!${CALC_SCOPE}.querySelector('.stackbar')`, { timeoutMs: 8000 });
  await sleep(300);
  await page.evaluate(`(() => {
    const set = (id, v) => { const el = document.getElementById(id); el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('calc2MonthlyCapacity', '150');
  })()`);
  await sleep(300);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('배분안 라벨이 서로 겹치지 않는다 — 넷째 안이 조용히 다른 안에 합쳐지지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const labels = await page.evaluate(
    `Array.from(document.getElementById('tabpanel-calc2').querySelectorAll('.stackbar-row-label')).map((e) => e.textContent.trim())`,
  );
  // [2026-08-24, D84] 청년 우대 손잡이가 없어 네 안을 전부 갈라놓을 수
  // 없다 — 지금 계약 0.4절의 동점 규칙대로 자연히 3개로 합쳐진다. "넷"을
  // 강제하는 대신 라벨에 중복이 없는지(조용히 합쳐지는 결함이면 라벨
  // 개수보다 실제 고유 라벨 수가 적게 나온다)를 잠근다.
  assert.ok(labels.length >= 3, `배분안이 3개 미만이다: ${JSON.stringify(labels)}`);
  assert.equal(new Set(labels).size, labels.length, `배분안 라벨에 중복이 있다: ${JSON.stringify(labels)}`);
  assert.ok(labels.some((l) => l.includes('ISA보다 먼저')), '넷째 안(D32에서 개명)이 비교 목록에 있다');
  // 넷째 안은 언제나 `is_baseline: false`다 — "(기본)" 표시가 붙지 않는다.
  const beforeIsaLabel = labels.find((l) => l.includes('ISA보다 먼저'));
  assert.ok(!beforeIsaLabel.includes('기본'), '연금계좌를 ISA보다 먼저 채우는 안은 추천으로 보이면 안 된다(D26·D32)');
});

test('375px 너비에서도 스택바 행이 뷰포트를 벗어나지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const overflow = await page.evaluate(`(() => {
    const rows = Array.from(document.getElementById('tabpanel-calc2').querySelectorAll('.stackbar-row'));
    return rows.map((r) => r.getBoundingClientRect().right - window.innerWidth);
  })()`);
  for (const over of overflow) {
    assert.ok(over <= 1, `스택바 행이 뷰포트 오른쪽으로 ${over}px 잘려 나간다`);
  }
});

test('금액이 라벨·막대에 가려지지 않고 화면 안에서 읽힌다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const amounts = await page.evaluate(`(() => {
    const els = Array.from(document.getElementById('tabpanel-calc2').querySelectorAll('.stackbar-row-amount'));
    return els.map((e) => ({ text: e.textContent.trim(), right: e.getBoundingClientRect().right, width: window.innerWidth }));
  })()`);
  assert.ok(amounts.length >= 3);
  for (const a of amounts) {
    if (a.text === '기본') continue; // 기본안 슬롯은 뱃지 텍스트다.
    assert.ok(a.right <= a.width + 1, `금액 "${a.text}"이 화면 밖으로 잘렸다`);
  }
});

test('계좌별 표는 좁은 화면에서 잘리지 않고 가로 스크롤로 근거 조항까지 닿는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const info = await page.evaluate(`(() => {
    const scope = document.getElementById('tabpanel-calc2');
    const wrap = scope.querySelector('.account-table-scroll');
    const table = scope.querySelector('.account-table');
    if (!wrap || !table) return null;
    return {
      scrollable: wrap.scrollWidth > wrap.clientWidth,
      pageOverflowsX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  })()`);
  assert.ok(info, '.account-table-scroll이 표를 감싸고 있어야 한다');
  assert.ok(info.scrollable, '표가 좁은 화면에서 가로로 스크롤될 수 있어야 한다(열을 지우지 않는다)');
  assert.ok(!info.pageOverflowsX, '표 때문에 페이지 전체가 가로로 넘치면 안 된다');
});
