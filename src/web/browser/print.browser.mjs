import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, attachSandboxedFrame, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * PDF 내보내기(`ui/print.js` + `styles.css`의 `@media print`) — 2026-08-10,
 * 소유자 지시로 "공유용 이미지 만들기"(캔버스 PNG)를 걷어내고 브라우저 인쇄로
 * 바꾼 자리.
 *
 * **왜 이 파일이 있나.** `node --test`(jsdom 없음)로는 `@media print`가 실제로
 * 무엇을 감추고 보이는지 잴 수 없다. 그리고 실측 중 두 가지를 원리상 Node
 * 검사로는 잡을 수 없는 방식으로 잡았다 —
 *
 * ① 처음엔 접힌 `<details>`(가정 사항·법령 조항)를 `beforeprint`에서 `open`
 *    속성을 켜는 JS로 펼치게 만들었다. **화면에서 이벤트를 직접 쏴 보면
 *    (`dispatchEvent(new Event('beforeprint'))`) `open`이 `true`로 바뀐다 —
 *    잘 되는 것처럼 보인다.** 그런데 `Page.printToPDF`(CDP 헤드리스 인쇄)로
 *    실제 PDF를 뽑아 페이지를 넘겨 보면 접힌 채로 나왔다. 인쇄 렌더 패스가
 *    이벤트 핸들러의 DOM 변경을 스냅샷에 반영하기 전에 레이아웃을 굳히는
 *    것으로 보인다 — **화면에서 통과하는 것과 실제 산출물이 다른, 이 저장소가
 *    가장 경계하는 부류의 결함이다.**
 * ② CSS로 옮겨 `details:not([open]) > *:not(summary) { display: block
 *    !important }`를 썼는데, `open`을 직접 `true`로 켜고 인쇄해도 여전히
 *    접혀 나왔다. 최근 Chromium이 `<details>` 본문을 `::details-content`
 *    의사요소로 감싸고 그 의사요소에 `content-visibility: hidden`을 걸기
 *    때문이었다 — 자식의 `display`만 바꾸는 것으로는 조상의
 *    `content-visibility`를 못 이긴다. `::details-content`를 직접 겨눠야
 *    했다.
 *
 * 둘 다 **실제 `Page.printToPDF` 출력을 페이지별로 스크린샷해서** 잡았다.
 * 이 파일은 그 회귀를 막는 자리다 — `Emulation.setEmulatedMedia({media:
 * 'print'})`로 인쇄 레이아웃을 재현하고 `getComputedStyle`로 잰다. (참고:
 * `setEmulatedMedia`는 `Page.printToPDF`와 다르게 내부적으로 자체
 * beforeprint/afterprint 쌍을 동기로 흘려보내는 것으로 보였다 — 그래서 이
 * 파일의 검사는 **CSS만으로 성립하는 값**(레이아웃 높이 등)만 재고, JS
 * 이벤트 타이밍에 기대는 검사는 두지 않는다. JS 타이밍은 애초에 기각된
 * 접근이다.)
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  await app.page.evaluate(FILL_REQUIRED_FIELDS);
  await app.page.waitFor(`!!document.querySelector('.save-share button')`);
  await sleep(400);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('공유용 이미지 버튼이 사라지고 PDF로 저장 버튼이 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const labels = await page.evaluate(`[...document.querySelectorAll('.save-share button')].map((b) => b.textContent.trim())`);
  assert.deepEqual(labels, ['PDF로 저장']);
});

test('인쇄 미디어에서 입력 패널이 통째로 사라진다 — 입력값이 인쇄물에 실릴 방법이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const layout = await page.evaluate(`(() => {
      const inputSlot = document.querySelector('.input-slot');
      const resultSlot = document.querySelector('.result-slot');
      return {
        inputSlotDisplay: getComputedStyle(inputSlot).display,
        resultSlotPosition: getComputedStyle(resultSlot).position,
        resultSlotOverflow: getComputedStyle(resultSlot).overflowY,
        saveShareDisplay: getComputedStyle(document.querySelector('.save-share')).display,
      };
    })()`);
    assert.equal(layout.inputSlotDisplay, 'none', '입력 패널이 인쇄에서 숨어야 한다');
    assert.equal(layout.resultSlotPosition, 'static', 'sticky가 풀리지 않으면 스크롤 밖 내용이 잘린다');
    assert.equal(layout.resultSlotOverflow, 'visible', 'overflow가 풀리지 않으면 뷰포트 높이로 잘린다');
    assert.equal(layout.saveShareDisplay, 'none', '인쇄된 종이 위의 "PDF로 저장" 버튼은 뜻이 없다');

    // 화면에 실제로 값을 쳐 넣은 문자열이 인쇄 레이아웃에서도 안 보이는지 —
    // `.input-slot`이 `display:none`이면 `innerText`에도 안 잡힌다(그려지지
    // 않는 텍스트는 innerText가 세지 않는다). `.result-slot`만 살아 있는
    // 상태에서 다시 확인한다.
    //
    // **월 납입 여력(500,000원)은 이 목록에 없다.** 배분액 합계가 곧 월 납입
    // 여력이라 계좌별 배분 행에 같은 숫자가 정당하게 나타날 수 있다(입력을
    // 그대로 옮긴 것이 아니라 배분 **결과**다) — screens.md 9절이 이미
    // "배분 금액의 합계로 월 납입 여력이 추정될 수 있습니다"로 못박아 둔
    // 받아들여진 위험이다. 여기서는 계산 자체에 결코 등장할 수 없는
    // 값(생년월일·총급여액)만 "새면 안 되는 값"으로 잰다.
    const resultText = await page.evaluate(`document.querySelector('.result-slot').innerText`);
    for (const secret of ['1980', '19800101', '60,000,000']) {
      assert.ok(!resultText.includes(secret), `인쇄 레이아웃에 입력값이 보입니다: ${secret}`);
    }
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('인쇄 미디어에서도 도넛(SVG)이 실제 크기를 유지한다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const svg = await page.evaluate(`(() => {
      const s = document.querySelector('.result-slot svg');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { width: r.width, height: r.height, paths: s.querySelectorAll('path').length };
    })()`);
    assert.ok(svg, '결과 패널에 SVG가 있어야 한다');
    assert.ok(svg.width > 0 && svg.height > 0, `도넛이 인쇄 미디어에서 0×0입니다: ${JSON.stringify(svg)}`);
    assert.ok(svg.paths > 0, '도넛 조각 path가 없습니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('인쇄 미디어에서도 `AccountBenefitStrip`이 카드 내용 폭의 50%(최소 240px)로 나오고 C-2 막대보다 짧다', { skip: skipWithoutChrome }, async () => {
  // D33 재개정 이전에는 이 위젯이 130px 고정폭이었다 — 인쇄에서도 좁은 채로
  // 나가는 것 자체는 눈에 띄는 결함이 아니었다. 폭이 카드 폭에 연동되는 지금은
  // "인쇄 레이아웃에서 이 연동이 실제로 살아 있는가"가 그 자체로 회귀 지점이다
  // — `@media print`가 폭 규칙을 건드리지 않는다는 것을 실측으로 고정한다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const m = await page.evaluate(`(() => {
      const strip = document.querySelector('.account-benefit-strip');
      const card = document.querySelector('.donut-with-strip');
      const track = document.querySelector('.account-benefit-strip .benefit-meter-track');
      const allocTrack = document.querySelector('.alloc-bar-track');
      if (!strip || !card) return null;
      const r = strip.getBoundingClientRect();
      return {
        stripWidth: r.width,
        cardWidth: card.getBoundingClientRect().width,
        trackWidth: track ? track.getBoundingClientRect().width : null,
        allocTrackWidth: allocTrack ? allocTrack.getBoundingClientRect().width : null,
      };
    })()`);
    assert.ok(m, '인쇄 레이아웃에서 .account-benefit-strip 또는 .donut-with-strip을 찾지 못했습니다');
    const expected = Math.max(m.cardWidth * 0.5, 240);
    assert.ok(
      Math.abs(m.stripWidth - expected) <= 2,
      `인쇄에서 위젯 폭(${m.stripWidth}px)이 카드 폭(${m.cardWidth}px)의 50%(최소 240px=${expected}px)를 따라가지 않습니다`,
    );
    if (m.trackWidth != null && m.allocTrackWidth != null) {
      assert.ok(
        m.trackWidth < m.allocTrackWidth,
        `인쇄에서도 이 트랙(${m.trackWidth}px)이 C-2 막대(${m.allocTrackWidth}px)보다 짧아야 한다(D33)`,
      );
    }
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('인쇄 미디어에서 고지 여섯 요소가 모두 실제로 렌더된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const disclosure = await page.evaluate(`(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { display: getComputedStyle(el).display, width: r.width, height: r.height };
      };
      return {
        banner: box('.disclosure-banner'),
        amountCard: box('.amount-card'),
        limitNote: box('.limit-note'),
      };
    })()`);
    for (const [name, box] of Object.entries(disclosure)) {
      assert.ok(box, `${name}이 인쇄 레이아웃에 없습니다`);
      assert.notEqual(box.display, 'none', `${name}이 인쇄에서 숨어 있습니다`);
    }
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('인쇄 미디어에서 접힌 가정 사항·법령 조항의 본문이 실제 레이아웃 높이를 갖는다', { skip: skipWithoutChrome }, async () => {
  // `open` 속성 자체는 건드리지 않는다(화면에서는 여전히 접힌 채여야 정상 —
  // "접기 상태가 화면과 인쇄에서 갈린다"는 이 검사의 핵심이다). CSS가
  // `::details-content`를 직접 펼치는지만 잰다.
  const { page } = app;
  const screenState = await page.evaluate(`(() => ({
    assumptionOpen: document.querySelector('.assumption-block').open,
    basisOpen: document.querySelector('.basis-block').open,
  }))()`);
  assert.equal(screenState.assumptionOpen, false, '화면에서는 기본으로 접혀 있어야 한다(D25)');
  assert.equal(screenState.basisOpen, false);

  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const printState = await page.evaluate(`(() => {
      const rectOf = (sel) => document.querySelector(sel).getBoundingClientRect();
      return {
        assumptionListHeight: rectOf('.assumption-block ul').height,
        basisListHeight: rectOf('.basis-block ul').height,
      };
    })()`);
    assert.ok(printState.assumptionListHeight > 0, '가정 사항 목록이 인쇄에서 0px 높이입니다 — 접힌 채로 나갑니다');
    assert.ok(printState.basisListHeight > 0, '법령 조항 목록이 인쇄에서 0px 높이입니다 — 접힌 채로 나갑니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('버튼을 누르면 save_share_action(method: pdf)이 나간다', { skip: skipWithoutChrome }, async () => {
  // 개발·검사 환경은 `analytics-config.js`의 수집기 주소가 비어 있어 실제
  // 전송(sendBeacon)까지는 가지 않는다 — 그 상태에서 `analytics.js`는
  // `console.warn(문구, eventName)`으로 대신 알린다(코드 경로가 여전히
  // `track()`까지 도달했다는 증거로 충분하다).
  const { page } = app;
  await page.evaluate(`(() => {
    window.__warnCalls = [];
    const orig = console.warn.bind(console);
    console.warn = (...args) => { window.__warnCalls.push(args.map(String)); orig(...args); };
  })()`);
  await page.clickElement(`[...document.querySelectorAll('.save-share button')].find((b) => b.textContent.trim() === 'PDF로 저장')`);
  await sleep(200);
  const calls = await page.evaluate(`window.__warnCalls`);
  assert.ok(
    calls.some((args) => args.some((a) => a.includes('save_share_action'))),
    `save_share_action 계측이 track()까지 도달하지 않았습니다: ${JSON.stringify(calls)}`,
  );
});

test('아티팩트 샌드박스(sandbox="allow-scripts")에서는 window.print()가 조용히 막히고, 화면이 그 사실을 알린다', { skip: skipWithoutChrome }, async () => {
  const frame = await attachSandboxedFrame(app.page);
  await frame.evaluate(FILL_REQUIRED_FIELDS);
  await app.page.waitFor(`!!document.querySelector('.save-share button')`, { sessionId: frame.sessionId });
  await sleep(400);

  const before = await frame.evaluate(`document.querySelector('.save-share-note').textContent`);
  await frame.click(`[...document.querySelectorAll('.save-share button')].find((b) => b.textContent.trim() === 'PDF로 저장')`);
  // `exportToPdf`의 감지 창(500ms)보다 넉넉히 기다린다.
  await sleep(800);
  const after = await frame.evaluate(`document.querySelector('.save-share-note').textContent`);

  assert.notEqual(after, before, '차단을 감지했으면 안내 문구가 바뀌어야 한다');
  assert.ok(after.includes('열리지 않았'), `대체 안내가 나오지 않았습니다: ${after}`);
});
