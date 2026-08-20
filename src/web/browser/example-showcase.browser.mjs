import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep } from './harness.mjs';

/**
 * ExampleShowcase(관리자 지시 2026-08-14 4·5번, D70, [2026-08-17] 소유자
 * 지시 여섯 + D71, [2026-08-18] 관리자 지시(2~6차)) — 헤더와 입력/결과 사이의
 * 간략한 예시가 **실제 Chrome에서** 엔진으로 계산되어 렌더되는지, 그리고
 * 소유자가 지시한 구조·문구·크기·형태로 나오는지 잰다.
 *
 * **[2026-08-20, 관리자 지시 — 첫 탭 예시 블록 개편] 이 파일을 큰 폭으로
 * 다시 짰다.** 예시가 한 사람(김철수씨)에서 두 사람(김철수씨·이승은씨)으로
 * 늘고, 옛 좌우 2열(`grid-template-areas`) 배치가 "물음(왼쪽 상단) → 인물
 * 행 두 개(기본 정보 → 도넛 → 세액공제액, 가로) → 화살표"로 바뀌면서 —
 * (1) 옛 칸 클래스(`.example-showcase-text-col`·`-visual-col`·`-input-*`)를
 *     전제한 검사들은 그 요소 자체가 이제 tab1 shadow root에 없다 —
 *     걷어내고 새 클래스(`.example-persona-*`) 기준으로 다시 짰다.
 * (2) 옛 배치 실측(오른쪽 열 40px 이동, man-icon 10ch 이동, 「이렇게
 *     배분해보세요」 캡션 5px 여백 등)은 그 배치 자체가 없어져 검사 대상이
 *     사라졌다 — 지우고, 그 자리를 새 배치가 실제로 지키는 것(두 행·구분선·
 *     물음 위치·화살표 색)에 대한 검사로 채웠다.
 * (3) "절세액이 예시 구역에서 가장 크다"는 옛 위계는 소유자가 이번 회차에
 *     뒤집었다("세액공제액 칸은 줄여도 된다") — 그 위계를 전제한 검사는
 *     지웠다.
 * (4) `.chart-donut`·`.amount-card` 등을 **첫 매치 하나**만 겨눈 검사(도넛
 *     기하 실측, 조각 라벨 33/17/50%, 대비 등)는 DOM 순서상 항상 1행
 *     (김철수씨)을 가리키므로 — 예시가 둘로 늘어도 **그 검사들의 주장 자체는
 *     그대로 참이다.** 다만 라벨류(`root.querySelectorAll` 전역 질의)는 이제
 *     두 도넛의 라벨이 섞여 나오므로, 1행 도넛(`donut` 변수)에 스코프를
 *     좁혀 다시 짰다 — 안 그러면 6개(3+3)가 나와 "정확히 3개" 가정이 깨진다.
 *
 * 예시는 Shadow DOM(열림 모드) 안에 그려진다 — 이 파일의 검사는 `.shadowRoot`를
 * 직접 뚫어서 읽는다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

const READ_SHOWCASE = `(() => {
  const host = document.querySelector('.example-showcase-slot');
  if (!host || !host.shadowRoot) return null;
  const root = host.shadowRoot;
  const section = root.querySelector('.example-showcase');
  if (!section) return null;
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];
  const donuts = qa('.chart-donut');
  // 1행(김철수씨) 도넛 — DOM 순서상 항상 첫 매치(examplePersonaRow가
  // 두 번 호출되는 순서, ui/example-showcase.js의 exampleShowcaseSection).
  const donut = donuts[0] ?? null;
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const centerXOf = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
  const question = q('.example-showcase-question-top');
  const rows = qa('.example-persona-row');
  const divider = q('.example-persona-divider');
  const infoCols = qa('.example-persona-info');
  const donutCols = qa('.example-persona-donut-col');
  const amountCols = qa('.example-persona-amount');
  const row1Lines = rows.length ? [...rows[0].querySelectorAll('.example-persona-line')] : [];
  const row2Lines = rows.length > 1 ? [...rows[1].querySelectorAll('.example-persona-line')] : [];
  const nameEls = qa('.example-persona-name');
  const iconEls = qa('.example-persona-icon');
  const amountCards = qa('.amount-card');
  const amountValues = qa('.amount-card-value');
  const amountLabels = qa('.amount-card-label');
  // 1행 「이렇게 배분해보세요」 캡션은 관리자 지시로 지웠다 — 0개여야 한다.
  const visualHeadings = qa('.example-showcase-visual-heading');
  const arrowBtn = q('.example-showcase-scroll-arrow');
  const arrowWrap = q('.example-showcase-arrow-wrap');
  // 조각 라벨(이름+비율) — 1행 도넛에만 스코프한다(위 머리말 (4) 참고).
  const labelEls = donut ? [...donut.querySelectorAll('.donut-slice-label')] : [];
  const labelNameEls = donut ? [...donut.querySelectorAll('.donut-slice-label-name')] : [];
  const labelPctEls = donut ? [...donut.querySelectorAll('.donut-slice-label-pct')] : [];
  const leaderEls = donut ? [...donut.querySelectorAll('.donut-slice-label-leader')] : [];
  const tops = donut ? [...donut.querySelectorAll('path[role="img"]')] : [];
  return {
    questionText: question?.textContent ?? null,
    questionRect: question ? rectOf(question) : null,
    questionFontSize: question ? getComputedStyle(question).fontSize : null,
    rowCount: rows.length,
    rowRects: rows.map(rectOf),
    infoRects: infoCols.map(rectOf),
    donutColRects: donutCols.map(rectOf),
    amountColRects: amountCols.map(rectOf),
    dividerRect: divider ? rectOf(divider) : null,
    row1LineTexts: row1Lines.map((el) => el.textContent),
    row2LineTexts: row2Lines.map((el) => el.textContent),
    row1LineFontSizes: row1Lines.map((el) => getComputedStyle(el).fontSize),
    nameTexts: nameEls.map((el) => el.textContent),
    iconRects: iconEls.map(rectOf),
    iconAlts: iconEls.map((el) => el.getAttribute('alt')),
    amountCardCount: amountCards.length,
    amountValueTexts: amountValues.map((el) => el.textContent),
    amountLabelTexts: amountLabels.map((el) => el.textContent),
    amountValueFontSizes: amountValues.map((el) => getComputedStyle(el).fontSize),
    amountLabelFontSizes: amountLabels.map((el) => getComputedStyle(el).fontSize),
    amountLabelFontWeights: amountLabels.map((el) => getComputedStyle(el).fontWeight),
    hasCaption: !!q('.amount-card-caption'),
    hasComposition: !!q('.amount-card-composition'),
    visualHeadingCount: visualHeadings.length,
    donutCount: donuts.length,
    donutPathCount: donut ? donut.querySelectorAll('path').length : 0,
    donutWidth: donut ? donut.getBoundingClientRect().width : 0,
    legendItemRects: [...root.querySelectorAll('.donut-legend-item')].map(rectOf),
    sliceTopBBoxes: tops.map((p) => { const b = p.getBBox(); return { width: b.width, height: b.height }; }),
    amountCardRects: amountCards.map(rectOf),
    amountOverflowsCard: amountCards.map((card, i) => {
      const v = amountValues[i];
      if (!v) return null;
      const vr = v.getBoundingClientRect(); const cr = card.getBoundingClientRect();
      return vr.width > cr.width + 1;
    }),
    amountValueChunkRectCounts: [...root.querySelectorAll('.amount-value-chunk')].map((c) => c.getClientRects().length),
    sectionRect: rectOf(section),
    centerXOfArrow: arrowBtn ? centerXOf(arrowBtn) : null,
    sliceRenderVsArc: donut
      ? [...donut.querySelectorAll('.chart-donut-slice')].map((p) => ({
          arcStart: Number(p.dataset.arcStart), arcEnd: Number(p.dataset.arcEnd),
          renderStart: Number(p.dataset.renderStart), renderEnd: Number(p.dataset.renderEnd),
        }))
      : [],
    sliceLabelNameTexts: labelNameEls.map((el) => el.textContent),
    sliceLabelPctTexts: labelPctEls.map((el) => el.textContent),
    sliceLabelFills: labelEls.map((el) => el.getAttribute('fill')),
    sliceLabelRects: labelEls.map(rectOf),
    sliceLabelLeaderCount: leaderEls.length,
    sliceTopFills: tops.map((p) => getComputedStyle(p).fill),
    arrowWrapAnimationName: arrowWrap ? getComputedStyle(arrowWrap).animationName : null,
    arrowWrapAnimationDuration: arrowWrap ? getComputedStyle(arrowWrap).animationDuration : null,
    arrowRect: arrowBtn ? rectOf(arrowBtn) : null,
  };
})()`;

test('헤더와 입력/결과 사이에 예시 섹션이 실제로 렌더된다(Shadow DOM 안) — 두 행·물음·구분선', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data, '예시 섹션(shadow root)을 찾지 못했다');

  // [2026-08-20, 관리자 지시 1번] 물음 — "돈" 문구.
  assert.equal(data.questionText, '당신의 소중한 돈, 어디에 넣어야 세금이 가장 적을까요?');

  // [2026-08-20, 관리자 지시 2번] 두 행 — 1행(김철수씨) 네 줄, 2행(이승은씨)
  // 네 줄. 「직업」 줄이 맨 위에 더해졌다(옛 세 줄 기대값을 뒤집는다).
  assert.equal(data.rowCount, 2, `인물 행이 정확히 2개여야 한다: ${data.rowCount}`);
  assert.deepEqual(data.row1LineTexts, ['직업 : 직장인', '나이: 만 30세', '소득: 4,000만원', '월 납입금 : 월 150만원']);
  assert.deepEqual(data.row2LineTexts, ['직업 : 자영업자', '나이 : 만 45세', '소득 : 8,000만원 (사업소득)', '월 납입액 : 200만원']);
  assert.deepEqual(data.nameTexts, ['김철수씨', '이승은씨']);
  assert.deepEqual(data.iconAlts, ['', ''], '두 아이콘 모두 장식용(alt="")이어야 한다');
  assert.equal(data.iconRects.length, 2);
  for (const [i, r] of data.iconRects.entries()) {
    assert.ok(r.width > 0 && r.height > 0, `${i}번 아이콘이 0크기로 렌더됐다: ${JSON.stringify(r)}`);
  }

  // 두 행 사이 구분선.
  assert.ok(data.dividerRect, '두 행 사이 구분선(.example-persona-divider)을 찾지 못했다');
  assert.ok(data.dividerRect.width > 0, '구분선이 0폭이다');
  assert.ok(
    data.dividerRect.top > data.rowRects[0].bottom - 2 && data.dividerRect.top < data.rowRects[1].top + 2,
    `구분선(top ${data.dividerRect.top})이 1행(bottom ${data.rowRects[0].bottom})과 2행(top ${data.rowRects[1].top}) 사이에 있지 않다`,
  );

  // [2026-08-20, 관리자 지시 2번] 1행 캡션(「이렇게 배분해보세요」)은 지웠다.
  assert.equal(data.visualHeadingCount, 0, '1행 캡션(「이렇게 배분해보세요」)이 남아 있다 — 지우라는 지시였다');

  // 도넛 둘 다 실제 결과 조각으로 그려졌다(자리표시자가 아니다).
  assert.equal(data.donutCount, 2, '도넛이 정확히 2개(두 행 각각)여야 한다');
  assert.ok(data.donutPathCount > 0, '1행 도넛에 조각(path)이 없다');
  assert.ok(data.donutWidth > 0, '1행 도넛이 0폭으로 렌더됐다');

  // 세액공제액 카드 둘 다 렌더됐고, 캡션·구성 두 줄은 여전히 없다(D70).
  assert.equal(data.amountCardCount, 2, '세액공제액 카드가 정확히 2개여야 한다');
  assert.ok(!data.hasComposition, '가정 성분이 없으므로 구성 두 줄이 없어야 한다');
  assert.ok(!data.hasCaption, 'D70 — 예시에는 캡션이 없어야 하는데 남아 있다');
  // [2026-08-17, D71] 1행은 여전히 확정 단일 값(구간이 아니다).
  assert.equal(data.amountLabelTexts[0], '이 배분으로 계산된 세액공제액');
  assert.equal(data.amountValueTexts[0], '1,485,000원');
  assert.ok(!data.amountValueTexts[0].includes('~'));
});

/**
 * [2026-08-20, 관리자 지시] 행 안 가로 순서 — 왼쪽부터 기본 정보 → 도넛 →
 * 세액공제액(관리자 지시 원문 그대로). 두 행 모두에서 확인한다.
 */
test('두 행 모두 왼쪽부터 기본 정보 → 도넛 → 세액공제액 순으로 가로 배치된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.infoRects.length, 2);
  assert.equal(data.donutColRects.length, 2);
  assert.equal(data.amountColRects.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.ok(
      data.infoRects[i].right <= data.donutColRects[i].left + 1,
      `${i}행 — 기본 정보(오른쪽 끝 ${data.infoRects[i].right})가 도넛(왼쪽 끝 ${data.donutColRects[i].left})보다 왼쪽에 있지 않다`,
    );
    assert.ok(
      data.donutColRects[i].right <= data.amountColRects[i].left + 1,
      `${i}행 — 도넛(오른쪽 끝 ${data.donutColRects[i].right})이 세액공제액(왼쪽 끝 ${data.amountColRects[i].left})보다 왼쪽에 있지 않다`,
    );
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-20, 관리자 지시 1번] 물음이 예시칸 왼쪽 상단에 있다 — 두 행 중
 * 어디에도 속하지 않고, 섹션 안에서 가장 위에 있으며 왼쪽 가장자리에
 * 붙는다.
 */
test('물음이 예시칸 왼쪽 상단에 있다 — 두 행보다 위, 왼쪽 정렬', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data.questionRect, '물음을 찾지 못했다');
  assert.ok(
    data.questionRect.bottom <= data.rowRects[0].top + 1,
    `물음(아래 끝 ${data.questionRect.bottom})이 1행(위 끝 ${data.rowRects[0].top})보다 위에 있지 않다`,
  );
  const TOLERANCE_PX = 2;
  assert.ok(
    Math.abs(data.questionRect.left - data.sectionRect.left) <= 40,
    `물음 왼쪽 끝(${data.questionRect.left})이 섹션 왼쪽 끝(${data.sectionRect.left})에서 너무 멀다 — 왼쪽 정렬이 아니다`,
  );
  // 물음의 텍스트 정렬 자체도 왼쪽이다(가운데가 아니다).
  const textAlign = await page.evaluate(`getComputedStyle(document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-question-top')).textAlign`);
  assert.equal(textAlign, 'left', `물음의 text-align이 left가 아니다: ${textAlign}`);
  void TOLERANCE_PX;
});

/**
 * [2026-08-20, 관리자 지시 3번] 화살표 색이 `rgb(0, 255, 153)`이고, 라이트
 * 모드에서는 대비 부족을 보완하는 회색 테두리가 감싸며, 다크 모드에서는
 * (대비가 이미 충분하므로) 테두리가 없다.
 */
test('관리자 지시 3번 — 화살표 색이 rgb(0, 255, 153)이고, 라이트에서는 회색 테두리로 감싸며 다크에서는 테두리가 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const READ_ARROW_STYLE = `(() => {
    const host = document.querySelector('.example-showcase-slot');
    const btn = host.shadowRoot.querySelector('.example-showcase-scroll-arrow');
    const cs = getComputedStyle(btn);
    return { color: cs.color, borderStyle: cs.borderTopStyle };
  })()`;

  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const light = await page.evaluate(READ_ARROW_STYLE);
  assert.equal(light.color, 'rgb(0, 255, 153)', `라이트 모드 화살표 색이 rgb(0, 255, 153)이 아니다: ${light.color}`);
  assert.equal(light.borderStyle, 'solid', `라이트 모드에서 화살표에 테두리(대비 보완)가 없다: ${light.borderStyle}`);

  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`);
  await sleep(150);
  const dark = await page.evaluate(READ_ARROW_STYLE);
  assert.equal(dark.color, 'rgb(0, 255, 153)', `다크 모드 화살표 색이 rgb(0, 255, 153)이 아니다: ${dark.color}`);
  assert.equal(dark.borderStyle, 'none', `다크 모드에서는 테두리가 없어야 하는데 있다: ${dark.borderStyle}`);
  await page.evaluate(`document.documentElement.removeAttribute('data-theme')`);
});

/**
 * 문구 글자 크기 — 입력 네 줄은 여전히 옛 상한(40px)보다 작다. (D71 이후
 * 유지되어 온 위생 검사, 새 클래스로 이름만 바꿔 이어간다.)
 */
test('1행 입력 네 줄 글자 크기가 40px보다 작다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const px = (s) => Number((s ?? '0px').replace('px', ''));
  assert.equal(data.row1LineFontSizes.length, 4, '입력 줄이 정확히 넷이어야 한다');
  for (const size of data.row1LineFontSizes) {
    assert.ok(px(size) < 40, `입력 줄 글자 크기(${size})가 40px보다 작아야 한다`);
  }
});

/**
 * 세액공제액 라벨·값 위계 — [2026-08-20, 관리자 지시로 뒤집힌 기대값]
 * 옛 검사는 "절세액이 예시 구역에서 가장 크다"(물음 줄보다도 크다)를
 * 기대했다 — 소유자가 이번 회차에 그 카드를 명시로 축소했으므로("줄여도
 * 된다") 그 전제가 깨졌다. 지우지 않고 뒤집는다 — 카드 **안에서**는
 * 여전히 값 > 라벨(위계 1위는 값)이라는 것과, 라벨 굵기(700)만 남긴다.
 */
test('세액공제액 라벨이 굵고(700), 카드 안에서는 값이 라벨보다 크다(두 카드 모두)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const px = (s) => Number(s.replace('px', ''));
  assert.equal(data.amountLabelFontWeights.length, 2);
  for (const [i, w] of data.amountLabelFontWeights.entries()) {
    assert.equal(w, '700', `${i}번 카드 라벨이 굵지 않다(font-weight): ${w}`);
  }
  for (let i = 0; i < 2; i++) {
    assert.ok(
      px(data.amountValueFontSizes[i]) > px(data.amountLabelFontSizes[i]),
      `${i}번 카드 — 값이 라벨보다 커야 한다`,
    );
  }
});

/**
 * 세액공제액이 자기 카드 폭을 넘지 않는다 — 두 카드 모두. [2026-08-20]
 * 카드가 작아졌으므로(옛 61px → 26px, 바닥값 32px → 18px) 이 위생 검사를
 * 다시 확인한다.
 */
test('세액공제액이 자기 카드 폭을 넘지 않는다(두 카드 모두), 금액 덩어리는 각각 한 줄이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.amountOverflowsCard.length, 2);
  for (const [i, overflows] of data.amountOverflowsCard.entries()) {
    assert.equal(overflows, false, `${i}번 카드 — 절세액이 카드 폭을 넘는다: ${JSON.stringify(data.amountCardRects[i])}`);
  }
  // D71 — 헤드라인이 점(단일 확정 수)이므로 카드마다 덩어리가 정확히
  // 하나다(두 카드 합쳐 2개).
  assert.equal(data.amountValueChunkRectCounts.length, 2, `금액 덩어리 수가 2(카드 2개 × 1덩이)가 아니다: ${data.amountValueChunkRectCounts.length}`);
  for (const count of data.amountValueChunkRectCounts) {
    assert.equal(count, 1, '금액 덩어리가 줄이 꺾였다');
  }
});

/**
 * [2026-08-20, 관리자 지시로 뒤집힌 기대값] 도넛 크기 — 옛 검사는 D70
 * 크기(396px)보다 작은 300px을 기대했다. 이제 도넛이 인물 행 한 줄 안에서
 * 정보 열·세액공제액과 자리를 나눠 쓰므로 더 작다(160px, `styles.css`
 * `.example-persona-donut-col .chart-donut`) — 지우지 않고 뒤집는다.
 */
test('도넛이 한 행 안에 배분표·정보 열과 나란히 설 수 있는 작은 크기(160px)다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.donutWidth, 160, `1행 도넛 렌더 폭이 160px가 아니다: ${data.donutWidth}`);
  assert.ok(data.donutWidth < 300, '도넛이 옛(D70 이후) 단일 인물 크기(300px)보다 작지 않다');
});

/**
 * [2026-08-18, 관리자 지시(5차) 1번] **물음이 1440px에서 한 줄이다.** 배치가
 * 바뀌어도 이 요구(넓은 화면에서 물음이 꺾이지 않는다)는 그대로 유효하다 —
 * 이제는 예시칸 전체 폭을 쓰므로 옛(2/3 트랙, ~700px) 때보다 오히려 여유가
 * 커졌다.
 */
test('1440×900에서 물음이 한 줄이다(Range 실측), 문서 가로 스크롤이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await sleep(200);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const questionText = root.querySelector('.example-showcase-question-text');
    const range = document.createRange();
    range.selectNodeContents(questionText);
    return {
      questionLineCount: range.getClientRects().length,
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);

  assert.equal(m.questionLineCount, 1, `1440px — 물음이 한 줄이 아니다(${m.questionLineCount}줄로 꺾였다)`);
  assert.equal(m.docOverflowsX, false, '1440px — 문서 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * 화살표가 1440×900 첫 화면 안에 스크롤 없이 보인다는 기준(2026-08-17
 * 소유자 지시 5번이 세운 기준) — [2026-08-20, 관리자 지시] "두 행으로 늘며
 * 깨질 수 있다, 깨지면 비례를 줄여서라도 유지하라"는 이번 회차 지시대로
 * 실측해 다시 고정한다. 실측(별도 스크립트) 결과 화살표 아래 끝이 y≈778px로
 * 900px 안에 있었다 — 두 행으로 늘어도 예산이 깨지지 않았다.
 */
test('1440×900 첫 화면 안에 화살표가 스크롤 없이 보인다(두 행으로 늘어도 예산이 유지된다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await sleep(200);
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data.arrowRect, '화살표를 찾지 못했다');
  assert.ok(
    data.arrowRect.bottom <= 900,
    `화살표 아래 끝(${data.arrowRect.bottom})이 900px 첫 화면을 벗어난다 — 스크롤해야 보인다`,
  );
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('예시 절세액 카드에 캡션 요소가 없다(과세연도 문구도 남지 않는다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(!data.hasCaption, '예시 절세액 카드에 캡션 요소(.amount-card-caption)가 남아 있다');
  const cardTexts = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    return [...host.shadowRoot.querySelectorAll('.amount-card')].map((c) => c.textContent);
  })()`);
  assert.equal(cardTexts.length, 2, '절세액 카드가 2개여야 한다');
  for (const text of cardTexts) {
    assert.ok(!text.includes('과세연도 기준'), `카드 텍스트에 캡션 흔적이 남아 있다: "${text}"`);
  }
});

test('예시 범례·조각 라벨(이름+비율)·조각 자체가 DOM에만 있는 게 아니라 실제로 화면에 보인다(0크기가 아니다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);

  // 두 도넛(3개씩) 합쳐 6개.
  assert.ok(data.legendItemRects.length >= 6, `범례 항목이 6개 미만이다: ${JSON.stringify(data.legendItemRects)}`);
  for (const [i, r] of data.legendItemRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `범례 항목 ${i}이 0크기다(DOM에는 있어도 안 보인다): ${JSON.stringify(r)}`);
  }

  // 1행 도넛에 스코프한 조각 라벨 — 3개.
  assert.ok(data.sliceLabelRects.length >= 3, `1행 도넛 조각 라벨이 3개 미만이다: ${JSON.stringify(data.sliceLabelRects)}`);
  for (const [i, r] of data.sliceLabelRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `조각 라벨 ${i}이 0크기다: ${JSON.stringify(r)}`);
  }

  for (const [i, b] of data.sliceTopBBoxes.entries()) {
    assert.ok(b.width > 1 && b.height > 1, `도넛 조각 ${i} 자체가 0크기다: ${JSON.stringify(b)}`);
  }

  assert.equal(data.amountCardRects.length, 2);
  for (const [i, r] of data.amountCardRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `절세액 카드 ${i}가 0크기다: ${JSON.stringify(r)}`);
  }
});

test('예시 섹션이 문서 전체 질의(.amount-card, .chart-donut)와 충돌하지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const count = await page.evaluate(`document.querySelectorAll('.chart-donut').length`);
  assert.equal(count, 0, 'Shadow DOM 밖에서 .chart-donut이 보인다 — 예시가 문서 전체 질의에 새고 있다');
  const amountCount = await page.evaluate(`document.querySelectorAll('.amount-card').length`);
  assert.equal(amountCount, 0, 'Shadow DOM 밖에서 .amount-card가 보인다 — 예시가 문서 전체 질의에 새고 있다');
});

/**
 * 화면에 렌더된 두 카드의 값이, 지금 이 순간 각자의 엔진 호출을 다시 불러
 * 얻은 값과 정확히 같다 — [2026-08-20, 관리자 지시] **2행(이승은씨)도
 * 값을 하드코딩하지 않는다는 것을 이 방식으로 증명한다.**
 */
test('화면에 렌더된 두 카드의 값이, 지금 이 순간 엔진을 다시 불러 얻은 값과 정확히 같다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const rendered = await page.evaluate(READ_SHOWCASE);

  const recomputed = await page.evaluate(`(async () => {
    const mod = await import('/src/web/ui/example-showcase.js');
    const engineClient = await import('/src/web/engine/engine-client.js');
    const copy = await import('/src/web/copy.js');
    const [p1, p2] = await Promise.all([
      mod.computeExampleScenario(engineClient),
      mod.computeExamplePersona2Scenario(engineClient),
    ]);
    const textFor = ({ plan }) => {
      const headline = plan.headline_composite_total;
      return {
        valueText: copy.headlineValueText(headline),
        label: headline.includes_assumption_component ? copy.AMOUNT_CARD_LABEL_COMPOSITE : copy.AMOUNT_CARD_LABEL_CREDIT_ONLY,
      };
    };
    return [textFor(p1), textFor(p2)];
  })()`);

  assert.equal(rendered.amountValueTexts.length, 2);
  assert.equal(rendered.amountValueTexts[0], recomputed[0].valueText, '1행 화면 값이 지금 다시 계산한 엔진 결과와 다르다');
  assert.equal(rendered.amountLabelTexts[0], recomputed[0].label);
  assert.equal(rendered.amountValueTexts[1], recomputed[1].valueText, '2행 화면 값이 지금 다시 계산한 엔진 결과와 다르다');
  assert.equal(rendered.amountLabelTexts[1], recomputed[1].label);
});

test('예시 도넛의 기하를 실측한다(1행) — 각도 합 360°, 조각별 각도가 배분액 비율과 일치, 중앙값·라벨·색 짝', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });

  const measured = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const donut = root.querySelector('.chart-donut'); // 1행(김철수씨) — 첫 매치.
    const donutCol = donut.closest('.example-persona-donut-col');
    const tops = [...donut.querySelectorAll('path[role="img"]')];
    const slices = tops.map((p) => ({
      start: Number(p.dataset.arcStart),
      end: Number(p.dataset.arcEnd),
      fill: getComputedStyle(p).fill,
      ariaLabel: p.getAttribute('aria-label'),
    }));
    // [2026-08-20] 범례를 1행 도넛 열(donutCol)에 스코프한다 — 두 도넛이
    // 있으므로 root 전체 질의는 6개(3+3)를 낸다.
    const legendItems = [...donutCol.querySelectorAll('.donut-legend-item')].map((li) => ({
      name: li.querySelector('.donut-legend-name').textContent,
      amountText: li.querySelector('.donut-legend-amount').textContent,
      swatchColor: getComputedStyle(li.querySelector('.donut-legend-swatch')).backgroundColor,
    }));
    const centerValueText = donut.querySelector('.donut-center-value')?.textContent ?? null;

    const resolve = (varExpr) => {
      const probe = document.createElement('div');
      probe.style.color = varExpr;
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const tokenColor = {
      annuity_savings: resolve('var(--data-pension)'),
      retirement_pension: resolve('var(--data-irp)'),
      isa: resolve('var(--data-isa)'),
    };

    return { slices, legendItems, centerValueText, tokenColor };
  })()`);

  const recomputed = await page.evaluate(`(async () => {
    const mod = await import('/src/web/ui/example-showcase.js');
    const engineClient = await import('/src/web/engine/engine-client.js');
    const { scenario, plan } = await mod.computeExampleScenario(engineClient);
    const format = await import('/src/web/format.js');
    return {
      allocations: plan.allocations.map((a) => ({
        account: a.account,
        annual_krw: a.annual_krw,
        monthly_krw: a.monthly_krw,
        monthlyText: format.formatKrw(a.monthly_krw),
      })),
      unallocatedAnnualKrw: plan.unallocated_annual_krw,
      unallocatedMonthlyKrw: plan.unallocated_monthly_krw,
      unallocatedMonthlyText: format.formatKrw(plan.unallocated_monthly_krw),
      centerValueText: format.formatKrw(plan.total_allocated_monthly_krw + plan.unallocated_monthly_krw),
    };
  })()`);

  const totalSweep = measured.slices.reduce((sum, s) => sum + (s.end - s.start), 0);
  assert.ok(Math.abs(totalSweep - 360) < 0.1, `조각 각도 합이 360°가 아니다: ${totalSweep}`);

  const order = ['annuity_savings', 'retirement_pension', 'isa'];
  const drawable = order
    .map((account) => recomputed.allocations.find((a) => a.account === account))
    .filter((a) => a && a.annual_krw > 0);
  if (recomputed.unallocatedAnnualKrw > 0) {
    drawable.push({
      account: 'unallocated',
      annual_krw: recomputed.unallocatedAnnualKrw,
      monthly_krw: recomputed.unallocatedMonthlyKrw,
      monthlyText: recomputed.unallocatedMonthlyText,
    });
  }

  assert.equal(measured.slices.length, drawable.length, `조각 수(${measured.slices.length})가 배분액이 있는 계좌 수(${drawable.length})와 다르다`);

  const total = drawable.reduce((sum, a) => sum + a.annual_krw, 0);
  let expectedStart = 0;
  for (let i = 0; i < drawable.length; i++) {
    const expectedSweep = (drawable[i].annual_krw / total) * 360;
    const actualSweep = measured.slices[i].end - measured.slices[i].start;
    assert.ok(
      Math.abs(actualSweep - expectedSweep) < 0.1,
      `조각 ${i}(${drawable[i].account}) 각도가 배분액 비율과 다르다 — 기대 ${expectedSweep.toFixed(3)}°, 실측 ${actualSweep.toFixed(3)}°`,
    );
    assert.ok(
      Math.abs(measured.slices[i].start - expectedStart) < 0.1,
      `조각 ${i}(${drawable[i].account}) 시작각이 어긋난다 — 기대 ${expectedStart.toFixed(3)}°, 실측 ${measured.slices[i].start.toFixed(3)}°`,
    );
    expectedStart += expectedSweep;

    assert.ok(
      measured.slices[i].ariaLabel.includes(`월 ${drawable[i].monthlyText}`),
      `조각 ${i}(${drawable[i].account}) aria-label에 월 ${drawable[i].monthlyText}이 없다: ${measured.slices[i].ariaLabel}`,
    );

    if (drawable[i].account !== 'unallocated') {
      assert.equal(
        measured.slices[i].fill,
        measured.tokenColor[drawable[i].account],
        `조각 ${i}(${drawable[i].account}) 색이 --data-${drawable[i].account} 토큰과 다르다`,
      );
    }
  }

  assert.equal(measured.centerValueText, recomputed.centerValueText, '도넛 가운데 값이 월 배분 합과 다르다');

  assert.equal(measured.legendItems.length, measured.slices.length, '1행 범례 항목 수가 1행 조각 수와 다르다');
  for (let i = 0; i < drawable.length; i++) {
    if (drawable[i].account === 'unallocated') continue;
    assert.equal(
      measured.legendItems[i].swatchColor,
      measured.tokenColor[drawable[i].account],
      `범례 ${i}번(${drawable[i].account}) 스와치 색이 조각 색과 다르다`,
    );
  }
});

/**
 * [2026-08-17, D72(관리자 지시 4번)] 도넛 조각 위 이름+비율 라벨 — 1행
 * (김철수씨)의 실제 배분(33%/17%/50%, `example-showcase.test.mjs`가 계산
 * 값으로 고정한 그 비율)이 정확히 그려지는지, **특히 최소값인 17%(IRP)
 * 조각에 이름+비율이 실제로 들어가는지**를 잰다. READ_SHOWCASE가 이 라벨
 * 필드를 1행 도넛에 스코프하므로(위 머리말 (4)) 2행(이승은씨) 라벨과 섞이지
 * 않는다.
 */
test('D72 4번 — 1행 도넛 조각 위에 계좌 이름 + 실제 배분 비율(연금저축 33%·IRP 17%·ISA 50%)이 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);

  const pctTexts = [...data.sliceLabelPctTexts].sort();
  assert.deepEqual(pctTexts, ['17%', '33%', '50%'], `1행 조각 위 비율이 실제 배분(33/17/50%)과 다르다: ${JSON.stringify(data.sliceLabelPctTexts)}`);
  const nameTexts = [...data.sliceLabelNameTexts].sort();
  assert.deepEqual(nameTexts, ['IRP', 'ISA', '연금저축'], `1행 조각 위 이름이 계좌 셋과 다르다: ${JSON.stringify(data.sliceLabelNameTexts)}`);

  const irpIndex = data.sliceLabelNameTexts.findIndex((t) => t === 'IRP');
  assert.ok(irpIndex >= 0, `"IRP" 이름 라벨을 찾지 못했다: ${JSON.stringify(data.sliceLabelNameTexts)}`);
  assert.equal(data.sliceLabelPctTexts[irpIndex], '17%', `IRP와 같은 자리(인덱스 ${irpIndex})의 비율이 17%가 아니다: ${data.sliceLabelPctTexts[irpIndex]}`);

  assert.equal(data.sliceLabelLeaderCount, 0, '이 예시의 실제 조각(최소 17%)에서는 리더선 폴백이 걸리지 않아야 하는데 걸렸다');

  for (const [i, r] of data.sliceLabelRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `조각 라벨 ${i}이 0크기다: ${JSON.stringify(r)}`);
  }

  for (let i = 0; i < data.sliceLabelRects.length; i++) {
    for (let j = i + 1; j < data.sliceLabelRects.length; j++) {
      const a = data.sliceLabelRects[i];
      const b = data.sliceLabelRects[j];
      const overlaps = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      assert.ok(!overlaps, `조각 라벨 ${i}과 ${j}이 서로 겹친다: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
    }
  }
});

/**
 * [2026-08-17, D72(관리자 지시 4번)] 글자 색 대비 — 1행 도넛에 스코프해
 * (두 도넛이 있으므로 라벨을 도넛 자신의 서브트리로 좁혀 잰다 — 안 그러면
 * 2행 라벨까지 섞여 `tops[i]`(1행 3개)와 `labelEls[i]`(옛날엔 root 전역
 * 질의라 이제 6개)의 인덱스가 어긋나 엉뚱한 배경·글자색을 짝짓는다).
 */
test('D72 4번 — 1행 도넛 조각 위 이름+비율 라벨 글자색이 배경과 최소 4.5:1 대비를 낸다(실측)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const svg = root.querySelector('.chart-donut'); // 1행 — 첫 매치.
    const tops = [...svg.querySelectorAll('path[role="img"]')];
    const labelEls = [...svg.querySelectorAll('.donut-slice-label')]; // 1행 도넛에 스코프.
    function srgbToLinear(c) { c/=255; return c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4; }
    function luminance([r,g,b]) { return 0.2126*srgbToLinear(r)+0.7152*srgbToLinear(g)+0.0722*srgbToLinear(b); }
    function parseRgb(s) { const m = /rgba?\\(([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)/.exec(s); return m ? [+m[1],+m[2],+m[3]] : [0,0,0]; }
    function contrast(l1,l2) { const [hi,lo] = l1>=l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); }
    return labelEls.map((el, i) => {
      const bg = getComputedStyle(tops[i]).fill;
      const fg = getComputedStyle(el).fill;
      const ratio = contrast(luminance(parseRgb(bg)), luminance(parseRgb(fg)));
      return { text: el.textContent, bg, fg, ratio };
    });
  })()`);

  assert.ok(m.length >= 3, `1행 조각 라벨이 3개 미만이다: ${JSON.stringify(m)}`);
  for (const row of m) {
    assert.ok(row.ratio >= 4.5, `퍼센티지 "${row.text}" 대비가 4.5:1 미만이다(fg=${row.fg}, bg=${row.bg}): ${row.ratio.toFixed(2)}`);
  }
});

/**
 * [2026-08-17, 소유자 지시 6번] 화살표에 움직임 — 위아래 반복 애니메이션이
 * 실제로 걸려 있고, `prefers-reduced-motion: reduce`면 꺼진다.
 */
test('소유자 지시 6번 — 화살표 칸에 위아래 반복 애니메이션이 걸려 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.notEqual(data.arrowWrapAnimationName, 'none', '화살표 칸에 애니메이션이 걸려 있지 않다');
  assert.notEqual(data.arrowWrapAnimationDuration, '0s', '화살표 애니메이션 지속시간이 0이다');
});

test('소유자 지시 6번 — prefers-reduced-motion이면 화살표 애니메이션이 꺼진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const animationName = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const wrap = host.shadowRoot.querySelector('.example-showcase-arrow-wrap');
    return getComputedStyle(wrap).animationName;
  })()`);
  assert.equal(animationName, 'none', 'reduced-motion인데 화살표 애니메이션이 여전히 걸려 있다');
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [] });
});

test('예시 카드가 점선이 아니라 입력·결과 칸과 같은 카드 표면(흰 배경·옅은 테두리·그림자)이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const style = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const section = host.shadowRoot.querySelector('.example-showcase');
    const cs = getComputedStyle(section);
    const inputPanel = document.querySelector('.input-panel');
    const inputCs = inputPanel ? getComputedStyle(inputPanel) : null;
    return {
      borderStyle: cs.borderTopStyle,
      borderColor: cs.borderTopColor,
      background: cs.backgroundColor,
      boxShadow: cs.boxShadow,
      inputBorderStyle: inputCs ? inputCs.borderTopStyle : null,
      inputBorderColor: inputCs ? inputCs.borderTopColor : null,
      inputBackground: inputCs ? inputCs.backgroundColor : null,
      inputBoxShadow: inputCs ? inputCs.boxShadow : null,
    };
  })()`);
  assert.equal(style.borderStyle, 'solid', '예시 카드 테두리가 점선이다 — 옛 규약(형태로 "남의 값"을 표시)이 되살아났다');
  assert.notEqual(style.boxShadow, 'none', '예시 카드에 그림자가 없다 — 카드로 보이지 않는다');
  assert.equal(style.borderColor, style.inputBorderColor, '예시 카드 테두리 색이 입력 칸과 다르다 — 카드 스타일을 재사용하지 않았다');
  assert.equal(style.background, style.inputBackground, '예시 카드 배경이 입력 칸과 다르다 — 카드 스타일을 재사용하지 않았다');
  assert.equal(style.boxShadow, style.inputBoxShadow, '예시 카드 그림자가 입력 칸과 다르다 — 카드 스타일을 재사용하지 않았다');
});

test('인쇄 레이아웃에는 예시 섹션이 없다 — 인쇄물에는 결과와 고지만 남는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  try {
    const display = await page.evaluate(`getComputedStyle(document.querySelector('.example-showcase-slot')).display`);
    assert.equal(display, 'none', '인쇄 레이아웃에서도 예시 섹션이 보인다');
  } finally {
    await page.send('Emulation.setEmulatedMedia', { media: '' });
  }
});

// [2026-08-17, 관리자 지시(2차) 1번, D72] 옛 `.app-title`(가명칭 텍스트)이
// 로고+탭 바로 바뀌면서 없어졌다 — 서비스 이름은 이제 활성 탭의 글자다.
test('활성 탭 문구가 "절세계좌 계산기"이고 [가칭]이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const title = await page.evaluate(`document.querySelector('.app-tab-active').textContent`);
  assert.equal(title, '절세계좌 계산기');
});

test('모바일 폭(375px)에서도 두 행의 도넛·절세액이 함께 렌더된다(레이아웃이 세로로 쌓인다), 가로 스크롤이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.donutCount, 2);
  assert.ok(data.donutPathCount > 0);
  const overflowsX = await page.evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
  assert.equal(overflowsX, false, '375px에서 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('375px에서 절세액이 카드·문서 어느 쪽도 넘치지 않고, 축소 바닥값(18px) 아래로 내려가지 않는다(두 카드 모두)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const cards = [...host.shadowRoot.querySelectorAll('.amount-card')];
    const overflowsCard = cards.map((card) => {
      const value = card.querySelector('.amount-card-value');
      const vr = value.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      return vr.width > cr.width + 1;
    });
    const fontSizes = cards.map((card) => getComputedStyle(card.querySelector('.amount-card-value')).fontSize);
    return { overflowsCard, fontSizes, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  })()`);
  for (const [i, overflows] of m.overflowsCard.entries()) {
    assert.equal(overflows, false, `375px — ${i}번 카드에서 절세액이 카드 폭을 넘는다`);
  }
  for (const [i, size] of m.fontSizes.entries()) {
    const px = Number(size.replace('px', ''));
    assert.ok(px >= 18, `375px — ${i}번 카드 절세액 글자 크기(${size})가 축소 바닥값(18px)보다 작다`);
  }
  assert.equal(m.docOverflow, false, '375px에서 절세액이 문서 가로 스크롤을 만든다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('예시 도넛(1행) 조각 사이에 실제 간격이 있다 — 검은 점(경계 어두운 쐐기) 결함이 되돌아오지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data.sliceRenderVsArc.length >= 3, `1행 조각 데이터가 3개 미만이다(연금저축·IRP·ISA 셋을 기대): ${data.sliceRenderVsArc.length}`);
  for (const s of data.sliceRenderVsArc) {
    assert.ok(s.renderStart > s.arcStart, `조각의 렌더 시작각(${s.renderStart})이 참 시작각(${s.arcStart})보다 안쪽(더 큼)이어야 한다 — 간격이 없다`);
    assert.ok(s.renderEnd < s.arcEnd, `조각의 렌더 끝각(${s.renderEnd})이 참 끝각(${s.arcEnd})보다 안쪽(더 작음)이어야 한다 — 간격이 없다`);
  }
});

test('화살표를 누르면 입력/결과 구역이 뷰포트 안 잘 보이는 위치로 스크롤된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await page.evaluate(`window.scrollTo(0, 0)`);
  await sleep(100);
  const before = await page.evaluate(`document.querySelector('.input-slot').getBoundingClientRect().top`);
  assert.ok(before > 200, `클릭 전 입력 패널이 이미 뷰포트 위쪽에 있다(${before}) — 이 검사가 스크롤을 관측할 수 없다`);

  await page.clickElement(
    `document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-scroll-arrow')`,
  );
  await page.waitFor(
    `(() => { const r = document.querySelector('.input-slot').getBoundingClientRect(); return Math.abs(r.top) < 120; })()`,
    { timeoutMs: 3000 },
  );
  const after = await page.evaluate(`document.querySelector('.input-slot').getBoundingClientRect().top`);
  assert.ok(Math.abs(after) < 120, `클릭 후 입력 패널 상단(${after})이 뷰포트 위쪽 적절한 위치에 오지 않았다`);
});

/**
 * [2026-08-17, 관리자 지시(2차) 1번, D72] **고정 바가 스크롤 목적지 위쪽을
 * 가리는 고전 결함.** 헤더가 다시 sticky가 되면서 `scrollIntoView({ block:
 * 'start' })`(예시의 화살표가 부르는 `scrollToInputResult`)만으로는 스크롤이
 * 끝난 자리의 맨 위(입력 패널 제목)가 정확히 헤더 바로 뒤에 깔릴 수 있다 —
 * `.app-main`의 `scroll-margin-top: var(--layout-header-height)`(`styles.css`)
 * 이 그것을 막는다.
 */
test('D72 1번 — 화살표를 누른 뒤 입력 패널이 고정 헤더에 가려지지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await page.evaluate(`window.scrollTo(0, 0)`);
  await sleep(100);

  await page.clickElement(
    `document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-scroll-arrow')`,
  );
  await page.waitFor(
    `(() => { const r = document.querySelector('.input-slot').getBoundingClientRect(); return Math.abs(r.top) < 200; })()`,
    { timeoutMs: 3000 },
  );
  await sleep(200); // smooth 스크롤이 완전히 멈출 시간

  const m = await page.evaluate(`(() => {
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const panelTitle = document.querySelector('.input-panel-header')?.getBoundingClientRect() ?? null;
    return {
      headerBottom: header.bottom,
      panelTitleTop: panelTitle ? panelTitle.top : null,
      panelTitleBottom: panelTitle ? panelTitle.bottom : null,
    };
  })()`);
  assert.ok(m.panelTitleTop != null, '입력 패널 제목(.input-panel-header)을 찾지 못했다');
  assert.ok(
    m.panelTitleBottom > m.headerBottom - 2,
    `입력 패널 제목(아래쪽 ${m.panelTitleBottom})이 고정 헤더(아래쪽 ${m.headerBottom})에 완전히 가려졌다`,
  );
});

test('화살표는 키보드로도 동작한다 — 포커스 후 Enter로 같은 스크롤이 일어난다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await page.evaluate(`window.scrollTo(0, 0)`);
  await sleep(100);
  const focused = await page.evaluate(`(() => {
    const btn = document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-scroll-arrow');
    btn.focus();
    return document.querySelector('.example-showcase-slot').shadowRoot.activeElement === btn;
  })()`);
  assert.ok(focused, '화살표 버튼에 포커스가 가지 않았다 — 키보드로 도달할 수 없다');

  await page.pressKey('Enter', 'Enter', 13);
  await page.waitFor(
    `(() => { const r = document.querySelector('.input-slot').getBoundingClientRect(); return Math.abs(r.top) < 120; })()`,
    { timeoutMs: 3000 },
  );
  const after = await page.evaluate(`document.querySelector('.input-slot').getBoundingClientRect().top`);
  assert.ok(Math.abs(after) < 120, `Enter 뒤 입력 패널 상단(${after})이 뷰포트 위쪽 적절한 위치에 오지 않았다`);
});

test('화살표에 마우스를 올리면 배경색이 실제로 바뀐다(hover 반응)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const box = await page.evaluate(`(() => {
    const btn = document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-scroll-arrow');
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await sleep(100);
  const before = await page.evaluate(`getComputedStyle(document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-scroll-arrow')).backgroundColor`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await sleep(30);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await sleep(200);
  const after = await page.evaluate(`getComputedStyle(document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-scroll-arrow')).backgroundColor`);
  assert.notEqual(after, before, `마우스를 올려도 화살표 배경색이 바뀌지 않았다(hover 전 ${before}, 후 ${after})`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
});

// ---------------------------------------------------------------------------
// [2026-08-20, 관리자 지시] man-icon·female-icon — 각 행의 기본 정보 열
// 왼쪽, 네 줄 전체 높이만큼, 다크에서는 반전(invert)한다.
// ---------------------------------------------------------------------------

/**
 * [2026-08-20, 관리자 지시로 뒤집힌 기대값] 옛 검사는 아이콘 열이 세 줄
 * (25px 기준)과 같은 높이이길 기대했다 — 이제 네 줄(18px 기준)이라 상수가
 * 다르다(`styles.css` `.example-persona-icon` 주석의 calc와 같은 산식).
 * 두 행 모두에서 확인한다.
 */
test('관리자 지시 — man-icon·female-icon 높이가 각 행의 입력 네 줄 전체 높이와 같다(데스크톱)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.iconRects.length, 2, '아이콘이 2개(행마다 하나)여야 한다');

  const LINES_HEIGHT = 18 * 1.35 * 4 + 4 * 3;
  const NAME_TAG_SHARE = 12.5 * 1.4 + 4;
  const EXPECTED = LINES_HEIGHT - NAME_TAG_SHARE;
  for (const [i, r] of data.iconRects.entries()) {
    assert.ok(
      Math.abs(r.height - EXPECTED) <= 1,
      `${i}번 아이콘 높이(${r.height}px)가 계산값(${EXPECTED}px)과 1px 넘게 어긋난다`,
    );
    // 정사각형 원본(512×512)이므로 표시 비율도 1:1에 가까워야 한다.
    assert.ok(
      Math.abs(r.width - r.height) <= 1,
      `${i}번 아이콘이 정사각형 원본 비율을 잃었다(width ${r.width}px, height ${r.height}px)`,
    );
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-20, 관리자 지시로 뒤집힌 기대값] **옛(관리자 지시(3차) 2번) 검사는
 * 다크에서 `filter: invert(1)`이 걸리길 기대했다** — 그때는 원본이 검정
 * 선화였다. 아이콘이 컬러 일러스트로 재생성되며 그 전제가 깨졌다 — invert를
 * 그대로 두면 색상환이 통째로 뒤집힌다(관리자 실측: 셔츠 초록→보라, 피부
 * 톤→파랑). **지우지 않고 뒤집는다** — 다크에서도 `filter`가 없어야(색이
 * 원본 그대로여야) 하고, 대신 검정 윤곽선이 다크 배경에 묻히지 않도록
 * `background`(옅은 원형 판, `--example-icon-plate-bg`)가 걸려 있어야 한다.
 */
test('관리자 지시 — 다크 모드에서도 두 아이콘(man·female) 색이 반전되지 않고, 대신 옅은 원형 판이 깔린다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  const READ_ICON_STYLE = `(() => {
    const host = document.querySelector('.example-showcase-slot');
    if (!host || !host.shadowRoot) return null;
    return [...host.shadowRoot.querySelectorAll('.example-persona-icon')].map((icon) => {
      const cs = getComputedStyle(icon);
      return { filter: cs.filter, background: cs.backgroundColor, borderRadius: cs.borderRadius };
    });
  })()`;

  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const light = await page.evaluate(READ_ICON_STYLE);
  assert.equal(light.length, 2);
  for (const s of light) {
    assert.ok(s.filter === 'none' || !s.filter, `라이트에서 아이콘에 filter가 걸려 있다(색이 왜곡될 수 있다): ${s.filter}`);
  }

  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`);
  await sleep(100);
  const dark = await page.evaluate(READ_ICON_STYLE);
  for (const [i, s] of dark.entries()) {
    assert.ok(
      s.filter === 'none' || !s.filter,
      `${i}번 아이콘 — 다크에서도 filter가 없어야 한다(컬러 일러스트라 invert하면 색이 뒤집힌다): ${s.filter}`,
    );
    // 검정 윤곽선을 구제하는 옅은 원형 판 — 배경이 투명이 아니고(라이트와
    // 달라진 값), 원형(50%)으로 잘린다.
    assert.notEqual(s.background, 'rgba(0, 0, 0, 0)', `${i}번 아이콘 — 다크에서 원형 판(background)이 없다`);
    assert.match(s.borderRadius, /50%|9999px|999px/, `${i}번 아이콘 — 원형 판이 원형이 아니다(border-radius: ${s.borderRadius})`);
  }

  await page.evaluate(`document.documentElement.removeAttribute('data-theme')`);
});
