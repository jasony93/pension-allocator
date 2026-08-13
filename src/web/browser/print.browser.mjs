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

test('인쇄 미디어에서도 `AccountBenefitStrip`이 카드 내용 폭 그대로(100%) 나오고 컨테이너 테두리를 유지한다', { skip: skipWithoutChrome }, async () => {
  // D35·D36 재개정 — 폭 공식이 "카드 폭의 50%"에서 "카드 폭 그대로(100%)"로
  // 바뀌었고, 오독 방지는 폭이 아니라 컨테이너(배경·테두리)가 진다. 인쇄
  // 레이아웃에서 이 두 가지가 실제로 살아 있는가가 회귀 지점이다 —
  // `@media print`가 폭·컨테이너 규칙을 건드리지 않는다는 것을 실측으로 고정한다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const m = await page.evaluate(`(() => {
      const strip = document.querySelector('.account-benefit-strip');
      const card = document.querySelector('.donut-with-strip');
      if (!strip || !card) return null;
      const r = strip.getBoundingClientRect();
      const cs = getComputedStyle(strip);
      return {
        stripWidth: r.width,
        cardWidth: card.getBoundingClientRect().width,
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderColor,
      };
    })()`);
    assert.ok(m, '인쇄 레이아웃에서 .account-benefit-strip 또는 .donut-with-strip을 찾지 못했습니다');
    assert.ok(
      Math.abs(m.stripWidth - m.cardWidth) <= 2,
      `인쇄에서 위젯 폭(${m.stripWidth}px)이 카드 폭(${m.cardWidth}px)과 같아야 한다(D35·D36, 100%)`,
    );
    assert.notEqual(m.borderWidth, '0px', '인쇄에서도 컨테이너 테두리가 있어야 한다 — 오독 방지는 폭이 아니라 컨테이너가 진다(D35)');
    assert.notEqual(m.borderColor, 'rgba(0, 0, 0, 0)', '인쇄에서 테두리 색이 투명하면 박스로 보이지 않는다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('인쇄 미디어에서 남은 고지 요소가 모두 실제로 렌더된다', { skip: skipWithoutChrome }, async () => {
  // D60(관리자 판정, 소유자 지시) 이전에는 `.disclosure-banner`(고지 ①②)도
  // 이 목록에 있었다. 배너 자체가 화면에서 없어졌으므로 뺐다 — 남기면
  // 언제나 `box === null`로 실패하는 죽은 검사가 된다.
  // D61(관리자 판정, 소유자 지시, 세 번째 같은 방향) — 같은 이유로
  // `.limit-note`(고지 ⑤)도 뺐다. 부재는 아래 D61 검사가 직접 확인한다.
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
        amountCard: box('.amount-card'),
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

test('D60 — 인쇄 레이아웃에도 `.disclosure-banner`도 그 두 문장도 없다', { skip: skipWithoutChrome }, async () => {
  // 낡은 검사를 뒤집었다 — 바로 위 검사의 옛 버전은 이 배너가 인쇄에서도
  // 보이는 것을 요구했다. 지금은 그 반대가 참이어야 한다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const state = await page.evaluate(`(() => ({
      bannerExists: !!document.querySelector('.disclosure-banner'),
      resultText: document.querySelector('.result-slot').innerText,
    }))()`);
    assert.equal(state.bannerExists, false, '.disclosure-banner가 인쇄 레이아웃에 남아 있습니다');
    assert.ok(!state.resultText.includes('신고 대리가 아닙니다'), '성격 문장이 인쇄 레이아웃에 있습니다');
    assert.ok(!state.resultText.includes('세무사법 제6조'), '자격 문장이 인쇄 레이아웃에 있습니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('D61(관리자 판정, 소유자 지시, 세 번째 같은 방향) — 인쇄 레이아웃에도 `.limit-note`도 두 이름표도 없다', { skip: skipWithoutChrome }, async () => {
  // 낡은 검사를 뒤집었다 — D48이 세운 옛 버전은 `.limit-note`가 인쇄에서도
  // 보이는 것을 요구했다. 지금은 그 반대가 참이어야 한다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const state = await page.evaluate(`(() => ({
      limitNoteExists: !!document.querySelector('.limit-note'),
      factTagExists: !!document.querySelector('.note-tag-fact'),
      productTagExists: !!document.querySelector('.note-tag-product'),
      resultText: document.querySelector('.result-slot').innerText,
    }))()`);
    assert.equal(state.limitNoteExists, false, '.limit-note가 인쇄 레이아웃에 남아 있습니다');
    assert.equal(state.factTagExists, false, '.note-tag-fact가 인쇄 레이아웃에 남아 있습니다');
    assert.equal(state.productTagExists, false, '.note-tag-product가 인쇄 레이아웃에 남아 있습니다');
    assert.ok(!state.resultText.includes('실제 신고·납부는'), '한계 고지 2번 문장이 인쇄 레이아웃에 있습니다');
    assert.ok(!state.resultText.includes('법령이 정한 것'), '「법령이 정한 것」 태그 문구가 인쇄 레이아웃에 있습니다');
    assert.ok(!state.resultText.includes('이 계산기가 정한 것'), '「이 계산기가 정한 것」 태그 문구가 인쇄 레이아웃에 있습니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('관리자 지시(2026-08-13) — 값을 나르는 배경이 printBackground:false에서도 실제로 살아남는다', { skip: skipWithoutChrome }, async () => {
  // designer가 Page.printToPDF({ printBackground: false })(인쇄 대화상자의
  // "배경 그래픽" 체크가 기본으로 꺼진 상태와 같다 — 대다수 사용자가 이
  // 상태로 인쇄한다)로 실제 PDF를 뽑아, .account-benefit-strip 위젯 박스의
  // 배경이 완전히 사라지고 1px 테두리만 남는 것을 찾았다(대비 실측 1.265 —
  // 사실상 안 보인다). 원인은 print-color-adjust의 기본값 economy가
  // 배경색(인라인 background 포함)을 인쇄에서 지우는 것이었다.
  //
  // **getComputedStyle만으로는 부족하다.** 스타일 선언이 있는지는
  // computed style로 재지만, "실제로 인쇄됐는지"는 이 파일 머리말이 이미
  // 경고한 대로 별도로 확인해야 한다 — 그래서 이 검사는 (a) 값을 나르는
  // 요소마다 print-color-adjust: exact가 실제로 계산됐는지, 그리고 (b)
  // Page.printToPDF(printBackground:false)로 뽑은 실제 PDF를 페이지
  // 스크린샷으로 렌더해 위젯 박스 배경이 화소로 실제로 나타나는지 둘 다 잰다.
  const { page } = app;

  // (a) print-color-adjust 계산값 — 값을 나르는 자리만 겨눈다. 장식
  // 표면(.input-panel 등)은 이 목록에 없다 — 전부 넣으면 인쇄가 무거워진다.
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const rows = await page.evaluate(`(() => {
      const sel = (s) => {
        const el = document.querySelector(s);
        if (!el) return { missing: true };
        const v = getComputedStyle(el).printColorAdjust || getComputedStyle(el).webkitPrintColorAdjust;
        return { missing: false, value: v };
      };
      return {
        accountBenefitStrip: sel('.account-benefit-strip'),
        benefitDot: sel('.benefit-dot'),
        benefitMeterTrack: sel('.benefit-meter-track'),
        allocBarTrack: sel('.alloc-bar-track'),
        allocBarFill: sel('.alloc-bar-fill'),
      };
    })()`);
    for (const [name, row] of Object.entries(rows)) {
      assert.ok(!row.missing, `${name}을 찾지 못했습니다 — 검사 전제가 깨졌습니다`);
      assert.equal(row.value, 'exact', `${name}의 print-color-adjust가 "${row.value}"입니다 — economy면 인쇄에서 배경이 사라집니다`);
    }

    // 장식 표면은 그대로 economy다 — 전부에 걸지 않았다는 것을 값으로 못박는다.
    const decorative = await page.evaluate(`(() => {
      const el = document.querySelector('.input-panel') || document.querySelector('.amount-card');
      if (!el) return null;
      return getComputedStyle(el).printColorAdjust;
    })()`);
    if (decorative) assert.notEqual(decorative, 'exact', '장식 표면까지 exact가 번졌습니다 — 인쇄가 무거워집니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }

  // (b) 실제 PDF 렌더 — computed style이 실제 인쇄 산출물과 같은지 화소로 확인한다.
  //
  // **`document.querySelectorAll('canvas')`로 PDF.js 캔버스를 직접 읽으려 했으나
  // 캔버스가 하나도 안 잡혔다** — 헤드리스 Chrome이 PDF를 자체 뷰어(별도
  // 렌더러로 떨어지는 내장 확장 페이지)로 여는 것으로 보인다. `harness.mjs`가
  // 이미 경계하는 것과 같은 부류의 문제다(불투명 출처 iframe이 OOPIF로
  // 떨어져 부모 세션의 `Runtime.evaluate`로 안이 안 보이는 것). 우회 —
  // **`Page.captureScreenshot`로 실제로 화면에 그려진 화소를 PNG로 받고,
  // 그 PNG를 우리 앱 페이지 안에서 `<img>` → `<canvas>`로 그려 다시 읽는다.**
  // Node 쪽에 PNG 디코더를 새로 두지 않고 브라우저의 디코더를 그대로 쓴다.
  const { data: pdfB64 } = await page.send('Page.printToPDF', {
    printBackground: false,
    landscape: false,
    paperWidth: 8.27,
    paperHeight: 11.7,
  });
  const { launchChrome, openPage } = await import('./harness.mjs');
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmpPdf = path.join(os.tmpdir(), `print-color-adjust-check-${Date.now()}.pdf`);
  await fs.writeFile(tmpPdf, Buffer.from(pdfB64, 'base64'));
  try {
    const chrome = await launchChrome();
    try {
      let found = false;
      // 몇 페이지에 위젯이 떨어질지는 콘텐츠 길이에 따라 달라진다 — 여러
      // 페이지를 스캔한다(한 페이지만 가정하면 페이지 나눔이 바뀔 때 이
      // 검사가 조용히 무의미해진다).
      for (let pageNo = 1; pageNo <= 3 && !found; pageNo += 1) {
        const fileUrl = `file:///${tmpPdf.replace(/\\/g, '/')}#page=${pageNo}&zoom=150`;
        const pdfPage = await openPage(chrome.browserWsUrl, fileUrl);
        await sleep(1200);
        const { data: shotB64 } = await pdfPage.send('Page.captureScreenshot', { format: 'png' });
        found = await pdfPage.evaluate(`(async () => {
          const img = new Image();
          const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          img.src = 'data:image/png;base64,${shotB64}';
          await loaded;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // --surface-overlay(라이트) = rgb(244,246,248) — 위젯 박스 배경.
          for (let i = 0; i < data.length; i += 4 * 11) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (Math.abs(r - 244) <= 3 && Math.abs(g - 246) <= 3 && Math.abs(b - 248) <= 3) return true;
          }
          return false;
        })()`);
        pdfPage.close();
      }
      assert.ok(found, '실제 PDF 화소(1~3페이지)에서 위젯 박스 배경색(rgb(244,246,248))을 찾지 못했습니다 — printBackground:false에서 배경이 사라집니다');
    } finally {
      await chrome.close();
    }
  } finally {
    await fs.rm(tmpPdf, { force: true });
  }
});

test('인쇄 미디어에서 접힌 가정 사항의 본문이 실제 레이아웃 높이를 갖는다', { skip: skipWithoutChrome }, async () => {
  // `open` 속성 자체는 건드리지 않는다(화면에서는 여전히 접힌 채여야 정상 —
  // "접기 상태가 화면과 인쇄에서 갈린다"는 이 검사의 핵심이다). CSS가
  // `::details-content`를 직접 펼치는지만 잰다.
  //
  // D46 2·3번(관리자 판정)으로 「법령 조항」 블록(`.basis-block`)이 결과
  // 화면에서 없어졌다 — 이 검사에서도 뺀다. 가정 사항만 남는다.
  const { page } = app;
  const screenState = await page.evaluate(`(() => ({
    assumptionOpen: document.querySelector('.assumption-block').open,
    basisBlockExists: !!document.querySelector('.basis-block'),
  }))()`);
  assert.equal(screenState.assumptionOpen, false, '화면에서는 기본으로 접혀 있어야 한다(D25)');
  assert.equal(screenState.basisBlockExists, false, 'D46 2·3번 — 법령 조항 블록이 다시 렌더됩니다');

  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const printState = await page.evaluate(`(() => {
      const rectOf = (sel) => document.querySelector(sel).getBoundingClientRect();
      return {
        assumptionListHeight: rectOf('.assumption-block ul').height,
      };
    })()`);
    assert.ok(printState.assumptionListHeight > 0, '가정 사항 목록이 인쇄에서 0px 높이입니다 — 접힌 채로 나갑니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('버튼을 누르면 save_share_action(method: pdf)이 나간다', { skip: skipWithoutChrome }, async () => {
  // 개발·검사 환경은 `analytics-config.js`의 수집기 주소가 비어 있어 실제
  // 전송(fetch)까지는 가지 않는다 — 그 상태에서 `analytics.js`는
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
