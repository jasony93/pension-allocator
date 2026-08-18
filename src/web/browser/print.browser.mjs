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
 *
 * **[2026-08-18, 관리자 지시(4차) 6번, D74] 규약이 뒤집혔다 — 지우지 않고
 * 뒤집는다.** 옛 규약은 "인쇄물에는 결과와 고지 전부가 남는다, 입력값만
 * 뺀다"였다. D74는 그 범위를 요약 다섯 항목(도넛·계좌별 월 납입액·총
 * 절세액·계좌별 납입 잔여 한도·연 환산)으로 좁혔다 — 가정 사항·다른 배분
 * 비교·계좌별 세제혜택 막대(`AccountBenefitStrip`)는 이제 인쇄에 **없다.**
 * 아래에서 옛 검사 이름 옆에 "[뒤집힘]"을 달아 어떤 것이 방향을 바꿨는지
 * 표시한다 — 검사 자체는 지우지 않았고, 단언(assert)의 방향만 반대다.
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

test('[뒤집힘, D74] 「요약 저장」 버튼 둘(이미지·PDF) + 「내 결과 공유하기」가 있다 — 옛 단언은 PDF 하나뿐이었다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사(2026-08-10)는 [PDF로 저장] 하나만 요구했다 — 그때는 "공유용
  // 이미지 만들기"를 걷어낸 직후였다. D74로 이미지가 요약 전용으로
  // 되돌아왔고, 공유 링크(관리자 지시 7번)도 이 블록에 함께 붙는다.
  const { page } = app;
  const labels = await page.evaluate(`[...document.querySelectorAll('.save-share button')].map((b) => b.textContent.trim())`);
  assert.deepEqual(labels, ['이미지로 저장', 'PDF로 저장', '내 결과 공유하기']);
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
  // [2026-08-18, D74] 이 SVG는 이제 화면용 `chartArea`의 도넛이 아니라
  // `.summary-sheet`(요약 시트) 안의 도넛이다 — 나머지는 전부 숨었으므로
  // `.result-slot svg`가 가리키는 대상 자체가 바뀌었다(단언 자체는 그대로
  // 유효하다: "도넛이 인쇄에서 0×0이 아니다"). 선택자를 `.summary-sheet`로
  // 명시해 그 사실을 코드로도 남긴다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const svg = await page.evaluate(`(() => {
      const s = document.querySelector('.summary-sheet svg');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { width: r.width, height: r.height, paths: s.querySelectorAll('path').length };
    })()`);
    assert.ok(svg, '요약 시트에 SVG가 있어야 한다');
    assert.ok(svg.width > 0 && svg.height > 0, `도넛이 인쇄 미디어에서 0×0입니다: ${JSON.stringify(svg)}`);
    assert.ok(svg.paths > 0, '도넛 조각 path가 없습니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('[뒤집힘, D74] 인쇄 미디어에서 `AccountBenefitStrip`이 더 이상 보이지 않는다 — 요약 다섯 항목 밖이다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사(D35·D36)는 이 위젯이 인쇄에서 카드 폭 그대로 보이는 것을
  // 요구했다. D74가 정한 요약 구성(도넛·계좌별 월 납입액·총 절세액·계좌별
  // 납입 잔여 한도·연 환산) 안에 `AccountBenefitStrip`이 없으므로, 이제는
  // 그 반대 — **인쇄에 아예 나타나지 않아야** 정상이다. 화면(스크린 미디어)
  // 에서는 여전히 보인다는 것도 함께 확인해, "결과 화면에서 지운 것이
  // 아니라 인쇄 범위에서만 뺐다"는 사실을 구분한다.
  //
  // **`getComputedStyle(strip).display`로 재지 않는다.** `.account-benefit-
  // strip`은 `.result-body`의 직계 자식이 아니라 `.chart-area` 안의
  // 손자다 — `.result-body > *:not(.summary-sheet)`가 `.chart-area`를
  // `display: none`으로 지워도, **후손 자신의 `display` computed 값은 그
  // 영향을 받지 않는다**(브라우저가 후손에도 자기 CSS 규칙대로 값을
  // 계산해 두고, 실제로 그리지만 않을 뿐이다 — 실측으로 확인했다: 조상이
  // `display:none`인데 `.account-benefit-strip`의 computed display는
  // 여전히 `flex`였다). **실제로 렌더되는지는 `getBoundingClientRect()`
  // (레이아웃을 강제로 계산한다)로 재야 한다** — 조상이 `display:none`이면
  // 후손의 렌더 박스는 0×0이다.
  const { page } = app;
  const screenState = await page.evaluate(`(() => {
    const strip = document.querySelector('.account-benefit-strip');
    return strip ? strip.getBoundingClientRect().height : null;
  })()`);
  assert.notEqual(screenState, null, '화면(스크린)에는 .account-benefit-strip이 있어야 한다 — 결과 화면 자체에서 지운 것이 아니다');
  assert.ok(screenState > 0, '화면에서는 실제 높이를 가져야 한다');

  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const printHeight = await page.evaluate(`(() => {
      const strip = document.querySelector('.account-benefit-strip');
      return strip ? strip.getBoundingClientRect().height : -1;
    })()`);
    assert.equal(printHeight, 0, `인쇄에서 .account-benefit-strip이 여전히 렌더 높이(${printHeight}px)를 갖습니다 — D74가 요약 범위 밖으로 뺐다`);
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('[뒤집힘, D74] 인쇄 미디어에서 헤드라인 카드(`.amount-card`, 사용자 자신의 실제 결과)는 숨고, 요약 시트의 총 절세액 블록이 대신 보인다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사("남은 고지 요소가 모두 실제로 렌더된다")는 `.amount-card`가
  // 인쇄에서 보이는 것을 요구했다 — 그때는 인쇄물이 결과 패널 전체였다.
  // 지금은 `.amount-card`가 `.result-body`의 요약 시트 밖 자식이라 숨고,
  // 같은 값을 담은 `.summary-sheet-total`이 대신 그 자리를 진다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const state = await page.evaluate(`(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { display: getComputedStyle(el).display, width: r.width, height: r.height };
      };
      return { amountCard: box('.amount-card'), summaryTotal: box('.summary-sheet-total') };
    })()`);
    assert.ok(state.amountCard, '.amount-card가 DOM에 없습니다 — 검사 전제가 깨졌습니다');
    assert.equal(state.amountCard.display, 'none', '.amount-card가 인쇄에서 여전히 보입니다 — D74가 요약 범위 밖으로 뺐다');
    assert.ok(state.summaryTotal, '.summary-sheet-total이 인쇄 레이아웃에 없습니다');
    assert.notEqual(state.summaryTotal.display, 'none', '.summary-sheet-total이 인쇄에서 숨어 있습니다');
    assert.ok(state.summaryTotal.height > 0, '.summary-sheet-total이 0 높이입니다');
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

test('[뒤집힘, D74] printBackground:false에서 옛 위젯 배경은 더 이상 나타나지 않고, 요약 시트의 범례 스와치만 살아남는다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사(관리자 지시 2026-08-13)는 `.account-benefit-strip` 등 다섯
  // 선택자가 `print-color-adjust: exact`를 갖고 실제 PDF 화소에도 그
  // 배경이 남는 것을 요구했다. D74로 그 요소들 전부가 인쇄 범위 밖으로
  // 빠졌으므로(위 "AccountBenefitStrip이 더 이상 보이지 않는다" 검사),
  // **`print-color-adjust: exact` 선언 자체도 `styles.css`에서 지웠다**
  // (안 보이는 요소에 색 보존 규칙을 남겨 둘 이유가 없다) — 여기서는 그
  // 부재를 계산값으로 확인한다. **남는 것은 요약 시트 자신의 범례 스와치
  // (`.donut-legend-swatch`)뿐**이다.
  const { page } = app;

  // (a) print-color-adjust 계산값.
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
        allocBarTrack: sel('.alloc-bar-track'),
        summaryLegendSwatch: sel('.summary-sheet .donut-legend-swatch'),
      };
    })()`);
    // 옛 위젯 셋 — 요소 자체는 여전히 DOM에 있다(화면에서는 보이므로),
    // 하지만 `print-color-adjust: exact` 선언은 더 이상 걸리지 않는다.
    for (const name of ['accountBenefitStrip', 'benefitDot', 'allocBarTrack']) {
      const row = rows[name];
      assert.ok(!row.missing, `${name}을 찾지 못했습니다 — 검사 전제가 깨졌습니다`);
      assert.notEqual(row.value, 'exact', `${name}의 print-color-adjust가 여전히 "exact"입니다 — D74로 인쇄 범위 밖이라 더 이상 걸릴 이유가 없다`);
    }
    // 요약 시트의 범례 스와치 — 여기는 여전히 exact여야 한다(살아남는 값).
    assert.ok(!rows.summaryLegendSwatch.missing, '.summary-sheet .donut-legend-swatch를 찾지 못했습니다');
    assert.equal(rows.summaryLegendSwatch.value, 'exact', '요약 시트 범례 스와치의 print-color-adjust가 exact가 아닙니다');
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
  // **옛 위젯의 부재는 여기서 화소로 다시 증명하지 않는다.** 위
  // "AccountBenefitStrip이 더 이상 보이지 않는다" 검사가 `getBoundingClientRect()`
  // (실제 레이아웃)로 이미 0×0임을 구조적으로 확인했다 — 렌더되지 않는
  // 요소의 배경색이 화소에 없다는 것은 그로부터 따라오는 결과이지 별도로
  // 화소를 뒤져 "안 보인다"를 증명할 필요가 없다(부재를 화소 스캔으로
  // 증명하려면 허용 오차 안에서 종이 흰색·안티에일리어싱 회색과 옛 위젯
  // 배경색이 겹칠 위험이 있어 오탐이 쉽다 — 실측으로 이 위험을 확인했다).
  // **화소 스캔은 "살아남아야 하는 것"(도넛 색)에만 쓴다** — 그것이 이
  // 검사의 원래 목적(printBackground:false에서도 값이 나르는 색이
  // 실제로 남는가)에 더 가깝다.
  try {
    const chrome = await launchChrome();
    try {
      let foundDonutColor = false;
      // 몇 페이지에 요약이 떨어질지는 콘텐츠 길이에 따라 달라진다 — 여러
      // 페이지를 스캔한다(한 페이지만 가정하면 페이지 나눔이 바뀔 때 이
      // 검사가 조용히 무의미해진다).
      for (let pageNo = 1; pageNo <= 3 && !foundDonutColor; pageNo += 1) {
        const fileUrl = `file:///${tmpPdf.replace(/\\/g, '/')}#page=${pageNo}&zoom=150`;
        const pdfPage = await openPage(chrome.browserWsUrl, fileUrl);
        await sleep(1200);
        const { data: shotB64 } = await pdfPage.send('Page.captureScreenshot', { format: 'png' });
        foundDonutColor = await pdfPage.evaluate(`(async () => {
          const img = new Image();
          const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          img.src = 'data:image/png;base64,${shotB64}';
          await loaded;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // 요약 도넛의 계좌 색 셋(라이트) — 어느 계좌가 실제로 배분을
          // 받는지는 입력 픽스처(월 여력 50만원, 세액 한도 등)에 따라
          // 갈린다(실측: FILL_REQUIRED_FIELDS 기준으로는 ISA 100%였다) —
          // 그래서 셋 중 **어느 것이든** 하나만 찾으면 된다. --data-pension
          // rgb(10,154,150) · --data-irp rgb(218,113,52) · --data-isa
          // rgb(135,88,193).
          const targets = [[10, 154, 150], [218, 113, 52], [135, 88, 193]];
          for (let i = 0; i < data.length; i += 4 * 11) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            for (const [tr, tg, tb] of targets) {
              if (Math.abs(r - tr) <= 6 && Math.abs(g - tg) <= 6 && Math.abs(b - tb) <= 6) return true;
            }
          }
          return false;
        })()`);
        pdfPage.close();
      }
      assert.ok(
        foundDonutColor,
        '실제 PDF 화소(1~3페이지)에서 요약 도넛 색(연금저축, rgb(10,154,150))을 찾지 못했습니다 — printBackground:false에서도 SVG fill은 살아남아야 한다',
      );
    } finally {
      await chrome.close();
    }
  } finally {
    await fs.rm(tmpPdf, { force: true });
  }
});

test('[뒤집힘, D74] 인쇄 미디어에서 가정 사항(`.assumption-block`)이 이제 통째로 숨는다 — 옛 검사는 펼쳐서 보이는 것을 요구했다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사(이름 그대로)는 화면에서 접힌 `.assumption-block`이 인쇄에서는
  // `::details-content` CSS로 펼쳐져 실제 레이아웃 높이를 갖는 것을
  // 요구했다 — "인쇄물에는 결과와 고지 전부가 남는다"는 옛 규약의 사례다.
  // D74가 가정 사항을 요약에서 명시로 뺐으므로("빼는 것 — 가정 사항 ·
  // 다른 배분 비교"), 이제는 **펼쳐지는지 잴 필요조차 없다 — 애초에
  // 안 보인다.** `::details-content` 펼침 CSS 자체는 지우지 않았다(다른
  // `<details>`가 생기면 여전히 유효한 안전장치다) — 다만 `.assumption-block`
  // 은 그 CSS가 적용되기도 전에 조상(`.result-body > *:not(.summary-sheet)`)
  // 에서 이미 `display: none`이 걸린다.
  //
  // D46 2·3번(관리자 판정)으로 「법령 조항」 블록(`.basis-block`)이 결과
  // 화면에서 없어졌다 — 이 검사에서도 화면 쪽 전제 확인에 그대로 남긴다.
  const { page } = app;
  const screenState = await page.evaluate(`(() => ({
    assumptionOpen: document.querySelector('.assumption-block').open,
    basisBlockExists: !!document.querySelector('.basis-block'),
  }))()`);
  assert.equal(screenState.assumptionOpen, false, '화면에서는 기본으로 접혀 있어야 한다(D25)');
  assert.equal(screenState.basisBlockExists, false, 'D46 2·3번 — 법령 조항 블록이 다시 렌더됩니다');

  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const printState = await page.evaluate(`(() => ({
      assumptionBlockDisplay: getComputedStyle(document.querySelector('.assumption-block')).display,
    }))()`);
    assert.equal(
      printState.assumptionBlockDisplay,
      'none',
      `가정 사항 블록이 인쇄에서 여전히 보입니다(display: ${printState.assumptionBlockDisplay}) — D74로 요약 범위 밖이어야 한다`,
    );
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('[신설, D74] 인쇄 미디어에서 「다른 배분 비교」(`.stackbar`)도 숨는다 — D74가 요약에서 빼기로 한 둘째 항목', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const screenDisplay = await page.evaluate(`(() => {
    const el = document.querySelector('.stackbar');
    return el ? getComputedStyle(el).display : null;
  })()`);
  assert.notEqual(screenDisplay, null, '화면에 .stackbar가 있어야 한다 — 결과 화면 자체에서 지운 것이 아니다');
  assert.notEqual(screenDisplay, 'none', '화면에서는 보여야 한다');

  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const printDisplay = await page.evaluate(`getComputedStyle(document.querySelector('.stackbar')).display`);
    assert.equal(printDisplay, 'none', `인쇄에서 .stackbar가 여전히 보입니다(display: ${printDisplay})`);
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('[신설, D74] 요약 시트 자신에도 원시 입력(생년월일·총급여)이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const summaryText = await page.evaluate(`document.querySelector('.summary-sheet').innerText`);
    assert.ok(summaryText.length > 0, '요약 시트가 비어 있습니다 — 검사 전제가 깨졌습니다');
    for (const secret of ['1980', '19800101', '60,000,000']) {
      assert.ok(!summaryText.includes(secret), `요약 시트에 입력값이 보입니다: ${secret}`);
    }
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
