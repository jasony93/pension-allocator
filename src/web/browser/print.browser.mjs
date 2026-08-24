import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, dismissCalc2ExampleModalIfOpen } from './harness.mjs';
import { EXAMPLE_SALARY_MANWON } from '../ui/example-showcase.js';
import { TAX_YEAR } from '../state/store.js';
import { EXAMPLE_AGE_YEARS } from '../ui/example-showcase.js';

// [2026-08-24, D84] 「절세계좌 계산기2(근거판)」(첫 탭)이 지워져 이 파일이
// 재는 대상도 calc2 하나다. 옛 `FILL_REQUIRED_FIELDS` 픽스처(생년월일
// 1980-01-01·총급여 6,000만원)는 그 탭 전용이었다 — 이제는 calc2가 로드와
// 동시에 채우는 김철수씨 프리필 값(`ui/calc2-prefill.js`)을 그대로 쓴다.
// 생년월일은 과세연도에 따라 달라지는 계산값이라(`exampleBirthDate`) 여기서
// 새로 하드코딩하지 않고 같은 계산식으로 다시 낸다.
const CALC2_PREFILL_BIRTH_DATE = `${TAX_YEAR - EXAMPLE_AGE_YEARS}-01-01`;
const CALC2_PREFILL_SALARY_DISPLAY = `${EXAMPLE_SALARY_MANWON.toLocaleString('ko-KR')}만원`;

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
 *
 * **[2026-08-18, 관리자 지시(6차) 2·3번, D75] 두 번째 뒤집힘 — 입력값이
 * 요약에 들어가고, PDF가 PNG와 같은 SVG 조립기 하나에서 나온다.** 소유자가
 * D74의 "요약에는 원시 입력이 없다"는 유보를 명시로 덮어(D75) 도넛 오른쪽에
 * 입력값(생년월일·총급여액·월 납입액 등)을 적으라고 지시했다 — "[뒤집힘,
 * D75]"를 단 검사들이 그것을 확인한다. 같은 회차에 `ui/result-panel.js`의
 * `summarySheet`가 더는 `donutChart`/`<table>` DOM을 직접 조립하지 않고
 * `ui/summary-image.js`의 `buildSummarySvgMarkup`(PNG 내보내기가 쓰는 바로
 * 그 조립기)이 낸 SVG를 그대로 삽입한다 — PDF·PNG가 갈릴 자리가 구조로
 * 없어졌다는 것을 "[신설, D75]" 검사들이 실측(`Page.printToPDF` 포함)으로
 * 확인한다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  // [2026-08-24, D84] calc2가 유일한 계산 탭이자 기본 활성 탭이라 명시
  // 탭 전환·필드 채움이 더는 필요 없다 — 로드와 동시에 프리필로 결과가
  // 선다(D79 판정 2).
  await dismissCalc2ExampleModalIfOpen(app.page);
  await app.page.waitFor(`!!document.querySelector('.calc2-result-slot .save-share button')`, { timeoutMs: 8000 });
  await sleep(400);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

// [2026-08-24, D84 정리] 원래 여기 있던 "「요약 저장」 버튼 둘(이미지·PDF)
// + 「내 결과 공유하기」가 있다" 검사를 지운다 — D82 판정 2가 PDF 버튼을
// calc2에서 화면 분기로 뺐고(조립기 자체는 남는다), D82 판정 4가 남은
// 두 버튼(이미지·공유)의 글자를 아이콘+aria-label로 바꿨다 — 둘 다
// `calc2.browser.mjs`의 "D82 판정 2"·"D82 판정 4" 검사가 이미 고정한다.
// 이 파일에서 같은 것을 다시 재는 것은 중복이다.

test('[뒤집힘, D75] 인쇄 미디어에서 입력 패널(`.calc2-input-slot`) 자체는 여전히 사라지지만, 요약 시트에는 이제 생년월일·총급여액이 보인다', { skip: skipWithoutChrome }, async () => {
  // 옛(D74) 검사 이름은 "입력 패널이 통째로 사라진다 — 입력값이 인쇄물에
  // 실릴 방법이 없다"였다. **D75가 그 마지막 절반을 명시로 뒤집었다** —
  // 소유자가 도넛 오른쪽에 입력값을 적으라고 지시했고(관리자 지시(6차)
  // 2번), 받아들이는 근거는 "요약은 사용자가 자기 기기에 저장하는 자기
  // 파일"이라는 것이다(D75). **`.calc2-input-slot`(원본 `<input>`이 실제로
  // 담긴 자리) 자체가 사라진다는 것은 여전히 참이다** — D75가 뒤집은 것은
  // "값이 어디에도 없다"이지 "입력 패널이 안 보인다"가 아니다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const layout = await page.evaluate(`(() => {
      const inputSlot = document.querySelector('.calc2-input-slot');
      const resultSlot = document.querySelector('.calc2-result-slot');
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
    assert.equal(layout.saveShareDisplay, 'none', '인쇄된 종이 위의 저장·공유 버튼은 뜻이 없다');

    // [뒤집힘, D75] `.calc2-result-slot`의 나머지(요약 시트 밖)는 여전히 안
    // 보이므로, `.calc2-result-slot`에 실제로 렌더된 텍스트는 곧 요약
    // 시트의 텍스트다. 생년월일(calc2 프리필의 계산값)과 총급여액(같은
    // 프리필의 `EXAMPLE_SALARY_MANWON`만원 → `ui/summary-data.js`의
    // `manwonDisplayText`로 표시)이 **이제는 있어야 한다.**
    const resultText = await page.evaluate(`document.querySelector('.calc2-result-slot').innerText`);
    assert.ok(resultText.includes(CALC2_PREFILL_BIRTH_DATE), `요약 시트에 생년월일이 보이지 않습니다: ${JSON.stringify(resultText)}`);
    assert.ok(resultText.includes(CALC2_PREFILL_SALARY_DISPLAY), `요약 시트에 총급여액이 보이지 않습니다: ${JSON.stringify(resultText)}`);
    // **원 단위로 환산한 총급여(40,000,000원, calc2 프리필 4,000만원의
    // 원화 환산)는 여전히 어디에도 없다** — D75가 되비추는 것은 사용자가
    // 화면에서 본 것과 같은 단위(만원)이지, 계산에 쓰인 원 단위 값이
    // 아니다(`ui/summary-data.js`의 `manwonDisplayText` 머리말).
    assert.ok(!resultText.includes('40,000,000'), `요약 시트에 원 단위로 환산한 총급여가 보입니다: ${JSON.stringify(resultText)}`);
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

test('인쇄 미디어에서도 도넛(SVG)이 실제 크기를 유지한다', { skip: skipWithoutChrome }, async () => {
  // [2026-08-18, D74] 이 SVG는 이제 화면용 `chartArea`의 도넛이 아니라
  // `.summary-sheet`(요약 시트) 안의 도넛이다 — 나머지는 전부 숨었으므로
  // `.calc2-result-slot svg`가 가리키는 대상 자체가 바뀌었다(단언 자체는 그대로
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

/**
 * [신설, 2026-08-18, 관리자 지시(6차) 2·3번, D75] 인쇄 미디어에서 도넛 조각
 * 라벨(이름+비율)과 입력값 블록이 **실제로 렌더된 위치·크기**를 갖는지
 * 잰다. `ui/print.js` 머리말이 경계하는 "화면에서 통과하는 것과 실제
 * 산출물이 다르다" 부류의 결함은 대부분 **print 시점에 DOM을 다시
 * 바꾸는 로직**(`beforeprint`에서 `<details>`를 여는 것 같은)에서
 * 났었다 — 이 SVG는 정적으로(스토어가 렌더할 때 이미) DOM에 붙으므로
 * 그 위험이 구조적으로 없지만, 그래도 `Emulation.setEmulatedMedia`가
 * 실제 인쇄 CSS를 그대로 적용한 상태에서 잰다는 점에서 이 파일의 다른
 * 인쇄 검사들과 같은 신뢰 수준이다.
 */
test('[신설, D75] 인쇄 미디어에서 도넛 조각 라벨(이름+비율)과 입력값 블록이 실제 위치·크기를 갖는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const m = await page.evaluate(`(() => {
      const svg = document.querySelector('.summary-sheet svg');
      if (!svg) return null;
      const texts = [...svg.querySelectorAll('text')].map((t) => ({
        text: t.textContent,
        rect: (() => { const r = t.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left }; })(),
      }));
      return {
        allText: texts.map((t) => t.text),
        // 조각 라벨은 이름+비율 두 tspan을 한 text 노드에 담으므로 textContent가
        // "ISA100%"처럼 붙어 나온다(summary-image.js의 sliceInlineLabelsMarkup,
        // 이름과 숫자 사이에 공백이 없다). [2026-08-24, D84] calc2 프리필이
        // ISA 예상 수익률을 기본으로 켜(D83 소유자 지시 9번) 입력값 블록에도
        // "연 5%"(이름과 숫자 사이에 공백이 있다) 줄이 생겼다 — 느슨한 부분
        // 일치(\\d+%)로는 이 줄까지 조각 라벨로 잘못 집는다. 공백이 전혀
        // 없는 문자열 전체가 %로 끝나는 것만 조각 라벨로 좁힌다.
        pctLabelRects: texts.filter((t) => /^\\S+%$/.test(t.text)).map((t) => t.rect),
        inputsHeadingRect: texts.find((t) => t.text === '입력값')?.rect ?? null,
        birthDateRect: texts.find((t) => t.text === ${JSON.stringify(CALC2_PREFILL_BIRTH_DATE)})?.rect ?? null,
      };
    })()`);
    assert.ok(m, '요약 시트 SVG를 찾지 못했습니다');
    assert.ok(m.pctLabelRects.length > 0, `도넛 조각 비율 라벨(예: "25%")이 SVG 안에 없습니다: ${JSON.stringify(m.allText)}`);
    for (const r of m.pctLabelRects) {
      assert.ok(r.width > 0 && r.height > 0, `조각 비율 라벨이 0크기로 렌더됐습니다: ${JSON.stringify(r)}`);
    }
    assert.ok(m.inputsHeadingRect, '입력값 블록 제목("입력값")이 SVG 안에 없습니다');
    assert.ok(m.inputsHeadingRect.width > 0 && m.inputsHeadingRect.height > 0, `입력값 블록 제목이 0크기로 렌더됐습니다: ${JSON.stringify(m.inputsHeadingRect)}`);
    assert.ok(m.birthDateRect, `생년월일 값("${CALC2_PREFILL_BIRTH_DATE}")이 SVG 안에 없습니다`);
    // 입력값 블록이 도넛 **오른쪽**에 있다 — 도넛 라벨(조각 안/밖)보다
    // 항상 더 오른쪽 x좌표에서 시작해야 한다(관리자 지시 원문 "도넛
    // 오른쪽에 사용자가 입력한 값을 적어라").
    const donutLabelsMaxLeft = Math.max(...m.pctLabelRects.map((r) => r.left));
    assert.ok(
      m.inputsHeadingRect.left > donutLabelsMaxLeft,
      `입력값 블록(x=${m.inputsHeadingRect.left})이 도넛 조각 라벨(최댓값 x=${donutLabelsMaxLeft})보다 오른쪽에 있지 않습니다`,
    );
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

/**
 * [신설, 2026-08-18, 관리자 지시(6차) 3번, D75] **실제 `Page.printToPDF`
 * 산출물**에서 입력값 블록이 그려진 자리(도넛 오른쪽, `.summary-sheet
 * svg`의 라이브 좌표를 그대로 페이지 좌표로 스케일한 영역)에 실제로 잉크
 * (흰 배경이 아닌 화소)가 있는지 화소로 확인한다. computed style·
 * `getBoundingClientRect()`는 `Page.printToPDF`가 실제로 무엇을 그리는지
 * 보증하지 않는다는 것이 이 파일의 핵심 경계 대상이다(머리말 ①·②) —
 * 그래서 여기서는 실제 PDF를 뽑아 스크린샷으로 화소를 읽는다(위
 * "printBackground:false" 검사와 같은 우회 기법).
 */
test('[신설, D75, Page.printToPDF 실측] 실제 PDF 화소에도 입력값 블록 자리에 잉크가 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;

  const { data: pdfB64 } = await page.send('Page.printToPDF', {
    printBackground: true,
    landscape: false,
    paperWidth: 8.27,
    paperHeight: 11.7,
  });
  const { launchChrome, openPage } = await import('./harness.mjs');
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmpPdf = path.join(os.tmpdir(), `print-inputs-block-check-${Date.now()}.pdf`);
  await fs.writeFile(tmpPdf, Buffer.from(pdfB64, 'base64'));
  try {
    const chrome = await launchChrome();
    try {
      let foundInk = false;
      // 요약 시트는 첫 페이지에 시작한다(짧은 픽스처 — 계좌 셋 + 입력값
      // 여섯 줄이라도 A4 한 장을 넘기지 않는다) — 그래도 페이지 나눔이
      // 바뀔 여지를 두어 3페이지까지 본다(위 "printBackground:false"
      // 검사와 같은 방어).
      for (let pageNo = 1; pageNo <= 3 && !foundInk; pageNo += 1) {
        const fileUrl = `file:///${tmpPdf.replace(/\\/g, '/')}#page=${pageNo}&zoom=150`;
        const pdfPage = await openPage(chrome.browserWsUrl, fileUrl);
        await sleep(1200);
        const { data: shotB64 } = await pdfPage.send('Page.captureScreenshot', { format: 'png' });
        foundInk = await pdfPage.evaluate(`(async () => {
          const img = new Image();
          const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          img.src = 'data:image/png;base64,${shotB64}';
          await loaded;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          // 스크린샷 전체 폭 중 오른쪽 55~95% 대역(입력값 블록이 도넛
          // 오른쪽에 있으므로 왼쪽 절반은 건너뛴다)에서, 흰색(배경)이
          // 아닌 화소가 있는지 훑는다 — "이 대역에 아무것도 안 그려지지
          // 않았다"만 아니면 된다(정확한 글자를 픽셀로 읽지는 않는다,
          // 그건 이 검사의 목적이 아니다 — 구조적 위치 확인이 목적이다).
          const { width, height, data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const xStart = Math.floor(width * 0.55);
          const xEnd = Math.floor(width * 0.95);
          const yStart = Math.floor(height * 0.05);
          const yEnd = Math.floor(height * 0.55);
          for (let y = yStart; y < yEnd; y += 3) {
            for (let x = xStart; x < xEnd; x += 3) {
              const i = (y * width + x) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              if (!(r > 250 && g > 250 && b > 250)) return true; // 흰 배경이 아닌 화소를 찾았다
            }
          }
          return false;
        })()`);
        pdfPage.close();
      }
      assert.ok(
        foundInk,
        '실제 PDF 화소(1~3페이지)의 오른쪽 대역(도넛 오른쪽, 입력값 블록이 있어야 할 자리)에서 흰 배경이 아닌 화소를 찾지 못했습니다',
      );
    } finally {
      await chrome.close();
    }
  } finally {
    await fs.rm(tmpPdf, { force: true });
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

test('[뒤집힘, D74·D75] 인쇄 미디어에서 헤드라인 카드(`.amount-card`, 사용자 자신의 실제 결과)는 숨고, 요약 SVG 안의 총 절세액 텍스트가 대신 보인다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사("남은 고지 요소가 모두 실제로 렌더된다")는 `.amount-card`가
  // 인쇄에서 보이는 것을 요구했다 — 그때는 인쇄물이 결과 패널 전체였다.
  // D74로 `.amount-card`가 `.result-body`의 요약 시트 밖 자식이라 숨고,
  // 같은 값을 담은 `.summary-sheet-total`(DOM 요소)이 대신 그 자리를 졌다.
  //
  // **[2026-08-18, 관리자 지시(6차) 3번, D75로 다시 뒤집힌다]** `.summary-sheet-total`
  // 이라는 DOM 요소 자체가 없어졌다 — `summarySheet`가 이제
  // `buildSummarySvgMarkup`이 낸 SVG를 통째로 삽입하고, 총 절세액은 그
  // SVG 안의 `<text font-size="44">`(`ui/summary-image.js`의
  // `totalTaxSavingsMarkup`, `valueText` 크기)다. class가 아니라 SVG
  // 속성으로 그 자리를 찾는다.
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const state = await page.evaluate(`(() => {
      const amountCard = document.querySelector('.amount-card');
      const amountCardBox = amountCard ? { display: getComputedStyle(amountCard).display } : null;
      const valueText = document.querySelector('.summary-sheet svg text[font-size="44"]');
      const r = valueText ? valueText.getBoundingClientRect() : null;
      return { amountCardBox, summaryValueRect: r ? { width: r.width, height: r.height } : null, summaryValueText: valueText?.textContent ?? null };
    })()`);
    assert.ok(state.amountCardBox, '.amount-card가 DOM에 없습니다 — 검사 전제가 깨졌습니다');
    assert.equal(state.amountCardBox.display, 'none', '.amount-card가 인쇄에서 여전히 보입니다 — D74가 요약 범위 밖으로 뺐다');
    assert.ok(state.summaryValueRect, '요약 SVG 안에서 총 절세액 텍스트(font-size 44)를 찾지 못했습니다');
    assert.ok(state.summaryValueRect.width > 0 && state.summaryValueRect.height > 0, `총 절세액 텍스트가 0크기입니다: ${JSON.stringify(state.summaryValueRect)}`);
    assert.ok(state.summaryValueText && state.summaryValueText.includes('원'), `총 절세액 텍스트 내용이 금액처럼 보이지 않습니다: ${state.summaryValueText}`);
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
      resultText: document.querySelector('.calc2-result-slot').innerText,
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
      resultText: document.querySelector('.calc2-result-slot').innerText,
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

test('[뒤집힘, D74·D75] printBackground:false에서 옛 위젯 배경은 나타나지 않고, `print-color-adjust: exact` 예외 자체가 이제 하나도 없다', { skip: skipWithoutChrome }, async () => {
  // 옛 검사(관리자 지시 2026-08-13)는 `.account-benefit-strip` 등 다섯
  // 선택자가 `print-color-adjust: exact`를 갖고 실제 PDF 화소에도 그
  // 배경이 남는 것을 요구했다. D74로 그 요소들 전부가 인쇄 범위 밖으로
  // 빠졌고(위 "AccountBenefitStrip이 더 이상 보이지 않는다" 검사),
  // **`print-color-adjust: exact` 선언 자체도 `styles.css`에서 지웠다.**
  //
  // **[2026-08-18, 관리자 지시(6차) 3번, D75로 한 번 더 뒤집힌다]** D74
  // 시절 이 검사는 "요약 시트의 범례 스와치(`.donut-legend-swatch`)만은
  // 여전히 `exact`여야 한다"고 기대했다 — 그때는 `summarySheet`가 실제
  // 결과 화면과 같은 `donutLegend` DOM 컴포넌트(CSS `background`로 칠하는
  // `<div>` 스와치)를 재사용했기 때문이다. 지금은 `summarySheet`가
  // `buildSummarySvgMarkup`(PNG와 공유하는 조립기)이 낸 SVG를 그대로
  // 삽입한다 — 범례 스와치도 `<rect fill="#...">`(SVG 속성)로 바뀌었고,
  // 도넛 조각과 마찬가지로 `economy`(기본값)에서도 살아남는다(아래 (b)가
  // 화소로 확인한다) — **그 값을 지키려고 걸어 둘 CSS 예외 자체가
  // 필요 없어졌다.** `.donut-legend-swatch` 클래스는 이제 `.summary-sheet`
  // 안 어디에도 없다.
  const { page } = app;

  // (a) print-color-adjust 계산값 — 옛 위젯 셋은 여전히 `exact`가 아니어야
  // 하고, `.summary-sheet` 안에는 `.donut-legend-swatch` 클래스 자체가 없다.
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
        summaryLegendSwatchExists: !!document.querySelector('.summary-sheet .donut-legend-swatch'),
        summarySvgRectCount: document.querySelectorAll('.summary-sheet svg rect').length,
      };
    })()`);
    // 옛 위젯 셋 — 요소 자체는 여전히 DOM에 있다(화면에서는 보이므로),
    // 하지만 `print-color-adjust: exact` 선언은 더 이상 걸리지 않는다.
    for (const name of ['accountBenefitStrip', 'benefitDot', 'allocBarTrack']) {
      const row = rows[name];
      assert.ok(!row.missing, `${name}을 찾지 못했습니다 — 검사 전제가 깨졌습니다`);
      assert.notEqual(row.value, 'exact', `${name}의 print-color-adjust가 여전히 "exact"입니다 — D74로 인쇄 범위 밖이라 더 이상 걸릴 이유가 없다`);
    }
    assert.equal(rows.summaryLegendSwatchExists, false, 'D75 — .summary-sheet 안에 옛 DOM 범례 스와치(.donut-legend-swatch)가 여전히 있습니다');
    assert.ok(rows.summarySvgRectCount > 0, '요약 시트 SVG 안에 <rect>(범례 스와치·배경)가 하나도 없습니다 — 검사 전제가 깨졌습니다');
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

test('[뒤집힘, D75] 요약 시트 자신에 이제 입력값이 있다 — 도넛 오른쪽 입력값 블록', { skip: skipWithoutChrome }, async () => {
  // 옛 이름은 "[신설, D74] 요약 시트 자신에도 원시 입력(생년월일·총급여)이
  // 없다"였다. 소유자가 D75로 그 유보를 명시로 덮었다 — 이 검사는 그
  // 뒤집힘을 확인한다: (1) 입력값 블록 제목("입력값")과 생년월일·총급여액이
  // 요약 시트에 실제로 있고, (2) `form`에 켜지 않은 값(정산 기간 — calc2
  // 프리필은 이 값을 채우지 않는다, D80 판정 1로 그 칸 자체가 calc2에
  // 없다)은 여전히 줄 자체가 없다(D75 선 ①).
  //
  // [2026-08-24, D84] 옛(D42) 픽스처(FILL_REQUIRED_FIELDS)는 ISA 예상
  // 수익률을 켜지 않았지만, calc2 프리필(`ui/calc2-prefill.js`, D83
  // 소유자 지시 9번)은 **켠 채로** 시작한다(연 5%, 소득 성격
  // `mixed_or_unknown`) — 그래서 "수익 성격"·"예상 수익률" 두 줄은 이제
  // **있어야** 정상이고, "정산 기간"만 여전히 없어야 정상이다(D75 선 ①이
  // 항목별로 개별 판정하는 것을 그대로 보여준다).
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const summaryText = await page.evaluate(`document.querySelector('.summary-sheet').innerText`);
    assert.ok(summaryText.length > 0, '요약 시트가 비어 있습니다 — 검사 전제가 깨졌습니다');
    assert.ok(summaryText.includes('입력값'), '요약 시트에 입력값 블록 제목이 없습니다');
    assert.ok(summaryText.includes(CALC2_PREFILL_BIRTH_DATE), '요약 시트에 생년월일이 없습니다');
    assert.ok(summaryText.includes(CALC2_PREFILL_SALARY_DISPLAY), '요약 시트에 총급여액이 없습니다');
    assert.ok(summaryText.includes('수익 성격'), 'calc2 프리필이 ISA 수익률을 켠 채로 시작하는데 수익 성격 줄이 없습니다');
    assert.ok(summaryText.includes('연 수익률'), 'calc2 프리필이 ISA 수익률을 켠 채로 시작하는데 연 수익률 줄이 없습니다');
    assert.ok(!summaryText.includes('정산 기간'), 'calc2에는 정산 기간 입력 칸 자체가 없는데(D80 판정 1) 그 줄이 있습니다');
    // 원 단위 환산값은 여전히 없다 — D75가 되비추는 것은 화면에서 입력한
    // 단위(만원)이지 계산에 쓰인 원 단위가 아니다.
    assert.ok(!summaryText.includes('40,000,000'), '요약 시트에 원 단위로 환산한 총급여가 보입니다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

// [2026-08-24, D84] 「PDF로 저장」 버튼 자체가 calc2 DOM에서 완전히
// 빠졌다(D82 판정 2 — `ui/result-panel.js`의 `saveShareBlock`,
// `hideConditionalCopy`가 참이면 `pdfButton`을 배열에 아예 넣지 않는다.
// 화면에서 숨긴 것이 아니라 그릴 대상 자체가 없다) — 이제 클릭할 PDF
// 버튼이 없다. `reportSaveShare(method)`가 `method`만 다르고 나머지
// 배선(`store.reportSaveShare` → `analytics.track('save_share_action', …)`)
// 은 이미지 버튼과 같은 함수이므로, 남아 있는 「이미지로 저장」 버튼으로
// 같은 배선(계측이 실제로 `track()`까지 도달하는가)을 겨눈다.
test('버튼을 누르면 save_share_action(method: image)이 나간다', { skip: skipWithoutChrome }, async () => {
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
  await page.clickElement(`[...document.querySelectorAll('.calc2-result-slot .save-share button')].find((b) => b.getAttribute('aria-label') === '이미지로 저장')`);
  await sleep(200);
  const calls = await page.evaluate(`window.__warnCalls`);
  assert.ok(
    calls.some((args) => args.some((a) => a.includes('save_share_action'))),
    `save_share_action 계측이 track()까지 도달하지 않았습니다: ${JSON.stringify(calls)}`,
  );
});

// [2026-08-24, D84 정리, 알려진 빈 자리] 원래 여기 있던 "아티팩트
// 샌드박스에서는 window.print()가 조용히 막히고, 화면이 그 사실을 알린다"
// 검사를 지운다 — D82 판정 2로 「PDF로 저장」 버튼이 calc2 DOM에서
// 완전히 빠져(위 주석 참고) 이 검사가 누르던 클릭 대상이 없다.
// `exportToPdf`(`ui/print.js`)는 여전히 있지만 어떤 버튼에도 물려 있지
// 않아 이 파일 안에서 프로그램적으로 부를 창구도 없다(모듈 스코프 함수라
// `window`에 노출되지 않는다). **이 검사가 지키던 실제 동작(샌드박스에서
// `window.print()`가 막히면 화면이 대체 안내로 알린다)은 여전히
// `ui/print.js`의 코드 경로로 남아 있으나, 지금 이 저장소 어떤 화면에도
// 그 경로로 가는 버튼이 없어 브라우저 검사로 회귀를 잠글 방법이 없다** —
// PDF 버튼이 되살아나거나(D82 게이트 기록의 삼항 되돌리기) 다른 트리거가
// 생기면 이 검사를 다시 세워야 한다(관리자 보고에 후속 과제로 남긴다).
