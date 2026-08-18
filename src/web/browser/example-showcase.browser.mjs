import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep } from './harness.mjs';

/**
 * ExampleShowcase(관리자 지시 2026-08-14 4·5번, D70, [2026-08-17] 소유자
 * 지시 여섯 + D71) — 헤더와 입력/결과 사이의 간략한 예시(도넛 + 절세액)가
 * **실제 Chrome에서** 엔진으로 계산되어 렌더되는지, 그리고 소유자가 지시한
 * 구조(물음 → 입력 세 줄 → 절세액 → 도넛/범례(퍼센티지 포함) → 화살표)가
 * 정확히 그 문구·크기·형태로 나오는지 잰다.
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
  const donut = root.querySelector('.chart-donut');
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  const centerXOf = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
  const centerYOf = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
  const textCol = q('.example-showcase-text-col');
  const visualCol = q('.example-showcase-visual-col');
  const inputLines = qa('.example-showcase-input-line');
  const inputBlock = q('.example-showcase-input-block');
  const inputIconCol = q('.example-showcase-input-icon-col');
  const inputIcon = q('.example-showcase-input-icon');
  const inputName = q('.example-showcase-input-name');
  const question = q('.example-showcase-question');
  const amountCard = q('.amount-card');
  const legend = q('.donut-legend');
  const arrowBtn = q('.example-showcase-scroll-arrow');
  const arrowWrap = q('.example-showcase-arrow-wrap');
  const labelEls = qa('.donut-slice-label');
  const labelNameEls = qa('.donut-slice-label-name');
  const labelPctEls = qa('.donut-slice-label-pct');
  const leaderEls = qa('.donut-slice-label-leader');
  const tops = donut ? [...donut.querySelectorAll('path[role="img"]')] : [];
  return {
    // [2026-08-17, 소유자 지시 1·4번] 물음이 먼저, 입력 세 줄이 그 아래 —
    // DOM 순서 자체를 그대로 배열로 낸다(순서가 곧 판정 대상이다).
    dom0Tag: section.children[0]?.tagName ?? null,
    textColChildTags: textCol ? [...textCol.children].map((c) => c.tagName) : [],
    // [2026-08-17, 관리자 지시(3차) 2번] man-icon이 입력 세 줄과 한 블록
    // (.example-showcase-input-block, DIV)을 이룬다 — 그 블록의 자식 태그
    // (아이콘 열 DIV + 세 줄 DIV)와 아이콘 자체의 렌더 크기를 함께 잰다.
    // [2026-08-18, 관리자 지시(4차) 1번] 아이콘 열 자체가 DIV(아이콘 열,
    // .example-showcase-input-icon-col)로 한 겹 더 감싸졌다 — 그 열의
    // 자식 태그(IMG + P)와 이름표 텍스트도 함께 잰다.
    inputBlockChildTags: inputBlock ? [...inputBlock.children].map((c) => c.tagName) : [],
    inputIconColChildTags: inputIconCol ? [...inputIconCol.children].map((c) => c.tagName) : [],
    inputIconColRect: inputIconCol ? rectOf(inputIconCol) : null,
    inputNameText: inputName?.textContent ?? null,
    inputIconRect: inputIcon ? rectOf(inputIcon) : null,
    inputIconAlt: inputIcon ? inputIcon.getAttribute('alt') : null,
    inputLineTexts: inputLines.map((el) => el.textContent),
    questionText: question?.textContent ?? null,
    inputLineFontSizes: inputLines.map((el) => getComputedStyle(el).fontSize),
    questionFontSize: question ? getComputedStyle(question).fontSize : null,
    amountValueFontSize: q('.amount-card-value') ? getComputedStyle(q('.amount-card-value')).fontSize : null,
    amountLabelFontSize: q('.amount-card-label') ? getComputedStyle(q('.amount-card-label')).fontSize : null,
    amountLabelFontWeight: q('.amount-card-label') ? getComputedStyle(q('.amount-card-label')).fontWeight : null,
    legendItemFontSize: q('.donut-legend-item') ? getComputedStyle(q('.donut-legend-item')).fontSize : null,
    legendItemFontWeight: q('.donut-legend-item') ? getComputedStyle(q('.donut-legend-item')).fontWeight : null,
    hasCaption: !!q('.amount-card-caption'),
    amountLabel: q('.amount-card-label')?.textContent ?? null,
    amountValue: q('.amount-card-value')?.textContent ?? null,
    hasComposition: !!q('.amount-card-composition'),
    donutPathCount: donut ? donut.querySelectorAll('path').length : 0,
    donutWidth: donut ? donut.getBoundingClientRect().width : 0,
    legendItemRects: [...root.querySelectorAll('.donut-legend-item')].map(rectOf),
    sliceTopBBoxes: donut
      ? [...donut.querySelectorAll('path[role="img"]')].map((p) => { const b = p.getBBox(); return { width: b.width, height: b.height }; })
      : [],
    amountCardRect: amountCard ? rectOf(amountCard) : null,
    amountValueRect: q('.amount-card-value') ? rectOf(q('.amount-card-value')) : null,
    amountCardOverflowsCard: (() => {
      const v = q('.amount-card-value'); const c = amountCard;
      if (!v || !c) return null;
      const vr = v.getBoundingClientRect(); const cr = c.getBoundingClientRect();
      return vr.width > cr.width + 1;
    })(),
    amountValueChunkRectCounts: [...root.querySelectorAll('.amount-value-chunk')].map((c) => c.getClientRects().length),
    sectionRect: rectOf(section),
    textColRect: textCol ? rectOf(textCol) : null,
    visualColRect: visualCol ? rectOf(visualCol) : null,
    questionRect: question ? rectOf(question) : null,
    inputLineRects: inputLines.map(rectOf),
    centerXOfAmountCard: amountCard ? centerXOf(amountCard) : null,
    centerXOfDonut: donut ? centerXOf(donut) : null,
    centerXOfVisualCol: visualCol ? centerXOf(visualCol) : null,
    centerXOfLegend: legend ? centerXOf(legend) : null,
    centerXOfArrow: arrowBtn ? centerXOf(arrowBtn) : null,
    sliceRenderVsArc: donut
      ? [...donut.querySelectorAll('.chart-donut-slice')].map((p) => ({
          arcStart: Number(p.dataset.arcStart), arcEnd: Number(p.dataset.arcEnd),
          renderStart: Number(p.dataset.renderStart), renderEnd: Number(p.dataset.renderEnd),
        }))
      : [],
    // [2026-08-17, D72] 도넛 조각 위 이름+비율 라벨(옛 퍼센티지 전용 라벨을
    // 대체한다 — charts.js의 applyDonutSliceInlineLabels).
    sliceLabelNameTexts: labelNameEls.map((el) => el.textContent),
    sliceLabelPctTexts: labelPctEls.map((el) => el.textContent),
    sliceLabelFills: labelEls.map((el) => el.getAttribute('fill')),
    sliceLabelRects: labelEls.map(rectOf),
    sliceLabelLeaderCount: leaderEls.length,
    sliceTopFills: tops.map((p) => getComputedStyle(p).fill),
    // [2026-08-17, 소유자 지시 6번] 화살표 애니메이션 실측.
    arrowWrapAnimationName: arrowWrap ? getComputedStyle(arrowWrap).animationName : null,
    arrowWrapAnimationDuration: arrowWrap ? getComputedStyle(arrowWrap).animationDuration : null,
    arrowRect: arrowBtn ? rectOf(arrowBtn) : null,
  };
})()`;

test('헤더와 입력/결과 사이에 예시 섹션이 실제로 렌더된다(Shadow DOM 안)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data, '예시 섹션(shadow root)을 찾지 못했다');

  // [2026-08-17, 소유자 지시 1번 + 관리자 지시(2차) 3·5번] 입력 세 줄 —
  // 「예시)」 접두사 없이. 「여유 자금」은 「월 납입금」으로 라벨이 바뀌었다
  // (값은 그대로). 물음 문장도 두 번째로 바뀌었다.
  assert.deepEqual(data.inputLineTexts, ['나이: 만 30세', '소득: 4,000만원', '월 납입금 : 월 150만원']);
  assert.equal(data.questionText, '당신의 소중한 월급, 어디에 넣어야 세금이 가장 적을까요?');

  // [2026-08-17, 소유자 지시 4번] DOM 순서 — 물음(h2)이 맨 앞, 입력 세 줄이
  // 그 뒤. 옛(2026-08-14) 검사는 반대 순서(입력 줄 → 물음)를 전제했다 —
  // 지우지 않고 뒤집는다.
  //
  // [2026-08-17, 관리자 지시(3차) 2번으로 다시 뒤집혔다] 옛 검사는 물음
  // 다음에 <p> 셋이 바로 온다고 기대했다 — 이제는 man-icon과 세 줄을 감싼
  // 블록(DIV, `.example-showcase-input-block`) 하나가 온다. 세 <p> 자체는
  // 여전히 DOM에 있다(그 블록 안, `inputLineTexts`가 그대로 확인한다) —
  // 지우지 않고 뒤집는다.
  assert.equal(data.textColChildTags[0], 'H2', '물음이 텍스트 칸의 첫 자식이어야 한다(맨 위)');
  assert.deepEqual(data.textColChildTags.slice(1), ['DIV'], '물음 다음에 입력 블록(man-icon + 세 줄을 감싼 DIV) 하나가 와야 한다');
  assert.equal(data.inputBlockChildTags.length, 2, '입력 블록 자식 수가 2(아이콘 열+줄 열)가 아니다');
  // [2026-08-18, 관리자 지시(4차) 1번으로 뒤집혔다] 옛 검사는 입력 블록의
  // 첫 자식이 man-icon(IMG) 그 자체라고 기대했다 — 이제는 아이콘과
  // 이름표(「김철수씨」)를 함께 담는 DIV(`.example-showcase-input-icon-col`)
  // 하나가 온다. IMG는 그 DIV 안, 첫 자식으로 그대로 남는다 — 지우지 않고
  // 뒤집는다.
  assert.equal(data.inputBlockChildTags[0], 'DIV', '입력 블록의 첫 자식이 아이콘 열(DIV)이 아니다');
  assert.equal(data.inputBlockChildTags[1], 'DIV', '입력 블록의 둘째 자식이 세 줄을 감싼 DIV가 아니다');
  assert.equal(data.inputIconColChildTags.length, 2, '아이콘 열 자식 수가 2(아이콘+이름표)가 아니다');
  assert.equal(data.inputIconColChildTags[0], 'IMG', '아이콘 열의 첫 자식이 man-icon(IMG)이 아니다');
  assert.equal(data.inputIconColChildTags[1], 'P', '아이콘 열의 둘째 자식이 이름표(P)가 아니다');
  assert.equal(data.inputNameText, '김철수씨', '아이콘 밑 이름표가 「김철수씨」가 아니다');
  assert.ok(data.inputIconRect, 'man-icon을 찾지 못했다');
  assert.ok(data.inputIconRect.width > 0 && data.inputIconRect.height > 0, `man-icon이 0크기로 렌더됐다: ${JSON.stringify(data.inputIconRect)}`);
  assert.equal(data.inputIconAlt, '', 'man-icon은 장식용이므로 alt=""여야 한다');

  // 도넛이 자리표시자가 아니라 실제 결과 조각으로 그려졌다.
  assert.ok(data.donutPathCount > 0, '도넛에 조각(path)이 없다');
  assert.ok(data.donutWidth > 0, '도넛이 0폭으로 렌더됐다');

  // [2026-08-17, D71] **뒤집힌 기대값** — 옛 검사는 구성 두 줄이 없고 구간
  // (~) 값을 기대했다. ISA 수익률 옵트인이 빠지면서 가정 성분 자체가 없어져
  // (`includes_assumption_component: false`) 라벨은 「세액공제액」(구성이
  // 아니라 크레딧 단독 분기)이 되고, 값은 구간이 아니라 점(단일 확정 수)이다.
  assert.equal(data.amountLabel, '이 배분으로 계산된 세액공제액', 'D71 — 가정 성분이 없으므로 라벨이 「세액공제액」이어야 한다');
  assert.ok(!data.hasComposition, '가정 성분이 없으므로 구성 두 줄이 없어야 한다');
  assert.ok(!data.hasCaption, 'D70 — 예시에는 캡션이 없어야 하는데 남아 있다');
  assert.equal(data.amountValue, '1,485,000원', 'D71 판정문이 인용한 확정 세액공제 값과 다르다');
  assert.ok(!data.amountValue.includes('~'), 'D71 — 헤드라인이 더는 구간(~) 모양이 아니어야 한다');
});

/**
 * [2026-08-17, 소유자 지시 3·5번] 글자 크기(축소)·행간(확대)을 함께 잰다.
 * 절대 크기는 옛값(40px)보다 작아야 하고(5번), 줄간격 **배수**는 옛값
 * (1.15)보다 커야 한다(3번) — 5번이 3번을 무효로 만들지 않았는지 이 검사가
 * 확인한다.
 */
test('소유자 지시 3·5번 — 문구 글자 크기는 옛값보다 작고, 줄간격 배수는 옛값보다 크다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const px = (s) => Number((s ?? '0px').replace('px', ''));

  assert.equal(data.inputLineFontSizes.length, 3, '입력 줄이 정확히 셋이어야 한다');
  for (const size of data.inputLineFontSizes) {
    assert.ok(px(size) < 40, `입력 줄 글자 크기(${size})가 옛값(40px)보다 작아야 한다(5번 지시)`);
  }
  assert.ok(px(data.questionFontSize) < 40, `물음 줄 글자 크기(${data.questionFontSize})가 옛값(40px)보다 작아야 한다`);

  const lineHeight = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const q = root.querySelector('.example-showcase-question');
    return getComputedStyle(q).lineHeight; // px 절대값으로 나온다
  })()`);
  const questionFontPx = px(data.questionFontSize);
  const lineHeightRatio = Number(lineHeight.replace('px', '')) / questionFontPx;
  assert.ok(lineHeightRatio > 1.15, `줄간격 배수(${lineHeightRatio.toFixed(3)})가 옛값(1.15)보다 커야 한다(3번 지시)`);
});

test('절세액이 예시 구역에서 가장 크고(카드 폭 안에서), 문구·범례가 그 아래 위계로 이어진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const px = (s) => Number(s.replace('px', ''));
  assert.ok(px(data.amountValueFontSize) > px(data.questionFontSize), '절세액이 물음 줄보다 커야 한다');
  assert.ok(px(data.questionFontSize) > px(data.legendItemFontSize), '물음 줄이 범례보다 커야 한다');
  assert.ok(!data.amountCardOverflowsCard, `절세액이 카드 폭을 넘는다: valueRect=${JSON.stringify(data.amountValueRect)}, cardRect=${JSON.stringify(data.amountCardRect)}`);
});

test('절세액 라벨과 범례가 굵다(font-weight 700), 값이 여전히 가장 크다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.amountLabelFontWeight, '700', `절세액 라벨이 굵지 않다(font-weight): ${data.amountLabelFontWeight}`);
  assert.equal(data.legendItemFontWeight, '700', `범례가 굵지 않다(font-weight): ${data.legendItemFontWeight}`);
  const px = (s) => Number(s.replace('px', ''));
  assert.ok(px(data.amountValueFontSize) > px(data.amountLabelFontSize), '값이 라벨보다 커야 한다 — 위계 1위는 여전히 값이다');
});

test('절세액 금액 덩어리는 정확히 한 줄이다 — 중간에서 줄이 꺾이지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  // [2026-08-17, D71] 헤드라인이 점(단일 확정 수)이 되면서 덩어리도 정확히
  // 하나다 — 옛(구간) 기대값(2개 이상)을 뒤집는다.
  assert.equal(data.amountValueChunkRectCounts.length, 1, `D71 — 금액 덩어리가 정확히 1개여야 한다(구간이 아니다): ${data.amountValueChunkRectCounts.length}`);
  assert.equal(data.amountValueChunkRectCounts[0], 1, '금액 덩어리가 줄이 꺾였다');
});

/**
 * [2026-08-17, 소유자 지시 5번] 도넛이 D70(396px)보다 작아야 한다. 정확한
 * 값(300px)과, "전체 20% 축소" 지시보다 더 줄었다는 사실(단순 396×0.8=317px
 * 보다도 작다 — 세로 예산이 그만큼 더 필요했다, 최종 보고 참고)을 함께 잰다.
 */
test('소유자 지시 5번 — 도넛이 D70 크기(396px)보다 작다(300px)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.equal(data.donutWidth, 300, `도넛 렌더 폭이 300px가 아니다: ${data.donutWidth}`);
  assert.ok(data.donutWidth < 396, '도넛이 D70 크기(396px)보다 작지 않다');
});

/**
 * [2026-08-18, 관리자 지시(5차) 1번] **물음이 1440px에서 한 줄이다.**
 *
 * `.example-showcase-question`(h2)은 `display: flex` 컨테이너다 —
 * `getClientRects()`를 h2나 그 안의 `<span>`(플렉스 아이템, 그 자체로 block
 * 수준 박스가 된다)에 걸면 안의 텍스트가 몇 줄로 꺾이든 박스 하나(rect
 * 1개)만 돌아와 줄 수를 알려주지 않는다(실측으로 확인 — 이 오판이 처음
 * "이미 한 줄이다"라는 잘못된 결론을 냈었다). **`Range`를 텍스트 노드
 * 자체에 걸어야** 줄마다 별도 rect가 나온다 — 이 검사가 재는 것이 그것이다.
 */
test('관리자 지시(5차) 1번 — 1440×900에서 물음이 한 줄이다(Range 실측), 문서 가로 스크롤이 없다', { skip: skipWithoutChrome }, async () => {
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
  assert.equal(m.docOverflowsX, false, '1440px — 물음이 한 줄이 되며 페이지 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-18, 관리자 지시(5차) 2번] man-icon + 나이/소득/월납입금 블록을
 * 옛(관리자 지시(3차) 2번, `--space-7` 48px) 위치에서 오른쪽으로 10ch 더
 * 옮긴다 — 물음(`.example-showcase-question`) 자신의 왼쪽 시작 위치는
 * 그대로다. 그래서 이 검사는 (1) 입력 블록의 왼쪽 끝이 옛 자리(48px)보다
 * 10ch만큼 더 안쪽인지, (2) 그 사이 물음의 왼쪽 끝은 전혀 움직이지 않았는지
 * 둘을 함께 잰다.
 */
test('관리자 지시(5차) 2번 — man-icon+입력 세 줄 블록이 옛 위치에서 오른쪽으로 10ch 더 밀렸고, 물음 위치는 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const textCol = root.querySelector('.example-showcase-text-col');
    const inputBlock = root.querySelector('.example-showcase-input-block');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute; visibility:hidden; white-space:pre;';
    probe.textContent = '0123456789';
    document.body.appendChild(probe);
    const tenChPx = probe.getBoundingClientRect().width;
    probe.remove();
    return {
      textColLeft: textCol.getBoundingClientRect().left,
      inputBlockLeft: inputBlock.getBoundingClientRect().left,
      tenChPx,
    };
  })()`);

  // 옛 위치(관리자 지시(3차) 2번) — 텍스트 칸 왼쪽 끝에서 `--space-7`(48px)만큼
  // 들여져 있었다. 지금은 거기서 10ch(대략 `m.tenChPx`px, 본문 기준 폰트로
  // 근사)만큼 더 들여져 있어야 한다 — 정확한 ch 환산은 이 블록 자신의
  // 폰트(본문 상속, 16px)를 기준으로 하므로, 같은 폰트로 만든 프로브
  // (`probe`)의 10글자 폭과 대략 같은 크기여야 한다(여유 6px — 폰트 폭
  // 근사 오차).
  const OLD_INDENT_PX = 48;
  const actualIndent = m.inputBlockLeft - m.textColLeft;
  const extra = actualIndent - OLD_INDENT_PX;
  assert.ok(
    Math.abs(extra - m.tenChPx) <= 6,
    `추가 이동량(${extra}px)이 10ch 근사값(${m.tenChPx}px)과 6px 넘게 어긋난다(옛 48px 기준 실제 들여쓰기 ${actualIndent}px)`,
  );
  assert.ok(
    Math.abs(data.questionRect.left - data.textColRect.left) <= 2,
    `물음 왼쪽 끝(${data.questionRect.left})이 여전히 왼쪽 칸 왼쪽 끝(${data.textColRect.left}) 근처여야 하는데 벗어났다 — 물음 위치가 함께 움직였다`,
  );
});

/**
 * [2026-08-18, 관리자 지시(5차) 4번] 「이렇게 배분해보세요」를 5px 아래로 —
 * 캡션의 `margin-top`이 5px이어야 한다(옛값은 0이었다).
 */
test('관리자 지시(5차) 4번 — 「이렇게 배분해보세요」 캡션의 위쪽 여백이 5px이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const marginTop = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const heading = host.shadowRoot.querySelector('.example-showcase-visual-heading');
    return getComputedStyle(heading).marginTop;
  })()`);
  assert.equal(marginTop, '5px', `「이렇게 배분해보세요」 위쪽 여백이 5px가 아니다: ${marginTop}`);
});

test('문구는 왼쪽 칸에서 왼쪽 정렬·세로 가운데, 도넛/범례는 오른쪽 칸에서 가로 가운데, 절세액/화살표는 섹션 전체에서 가로 가운데', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const TOLERANCE_PX = 2;

  // ---- 왼쪽 칸: 물음은 칸의 왼쪽 가장자리에 붙어 있다 ----------------------
  assert.ok(data.textColRect && data.questionRect && data.inputLineRects.length === 3, '왼쪽 문구 칸 요소를 찾지 못했다');
  assert.ok(
    Math.abs(data.questionRect.left - data.textColRect.left) <= TOLERANCE_PX,
    `물음 줄 왼쪽 끝(${data.questionRect.left})이 왼쪽 칸 왼쪽 끝(${data.textColRect.left})과 ${TOLERANCE_PX}px 넘게 어긋난다 — 왼쪽 정렬이 아니다`,
  );
  // [2026-08-17, 관리자 지시(3차) 2번으로 뒤집혔다] **입력 세 줄은 더 이상
  // 왼쪽 칸 가장자리에 붙지 않는다.** man-icon과 한 블록을 이루며 "가운데가
  // 비어 보인다"를 완화하려고 안쪽(오른쪽)으로 들여졌다(`.example-showcase-
  // input-block`의 `margin-left`) — 옛 기대(칸 가장자리와 일치)를 지우지
  // 않고 뒤집는다. 지금 참인 것 — (1) man-icon 자체가 물음보다 안쪽에서
  // 시작하고, (2) 세 줄은 아이콘 오른쪽에서 서로 같은 왼쪽 좌표를 공유한다.
  assert.ok(data.inputIconRect, '입력 줄과 나란한 man-icon을 찾지 못했다');
  assert.ok(
    data.inputIconRect.left > data.textColRect.left + TOLERANCE_PX,
    `man-icon 왼쪽 끝(${data.inputIconRect.left})이 왼쪽 칸 왼쪽 끝(${data.textColRect.left})보다 안쪽으로 들여지지 않았다`,
  );
  for (const [i, r] of data.inputLineRects.entries()) {
    assert.ok(
      Math.abs(r.left - data.inputLineRects[0].left) <= TOLERANCE_PX,
      `입력 줄 ${i} 왼쪽 끝(${r.left})이 다른 입력 줄과 왼쪽 정렬이 맞지 않는다`,
    );
    assert.ok(r.left > data.inputIconRect.left, `입력 줄 ${i}이 man-icon보다 왼쪽에 있다`);
  }

  // ---- 왼쪽 칸: 물음 + 입력 세 줄 블록이 칸의 세로 가운데에 있다 -----------
  const contentTop = data.questionRect.top;
  const contentBottom = data.inputLineRects[data.inputLineRects.length - 1].bottom;
  const contentCenterY = (contentTop + contentBottom) / 2;
  const colCenterY = (data.textColRect.top + data.textColRect.bottom) / 2;
  assert.ok(
    Math.abs(contentCenterY - colCenterY) <= TOLERANCE_PX + 1,
    `문구 블록 세로 중심(${contentCenterY})이 왼쪽 칸 세로 중심(${colCenterY})과 어긋난다 — 세로 가운데 정렬이 아니다`,
  );

  // ---- 오른쪽 칸: 도넛·범례가 칸 안에서 가로 가운데 ----------------------
  assert.ok(data.centerXOfDonut != null && data.centerXOfVisualCol != null, '도넛/오른쪽 칸의 가로 중심을 재지 못했다');
  assert.ok(
    Math.abs(data.centerXOfDonut - data.centerXOfVisualCol) <= TOLERANCE_PX,
    `도넛 가로 중심(${data.centerXOfDonut})이 오른쪽 칸 가로 중심(${data.centerXOfVisualCol})과 어긋난다`,
  );
  assert.ok(data.centerXOfLegend != null, '범례의 가로 중심을 재지 못했다');
  assert.ok(
    Math.abs(data.centerXOfLegend - data.centerXOfVisualCol) <= TOLERANCE_PX,
    `범례 가로 중심(${data.centerXOfLegend})이 오른쪽 칸 가로 중심(${data.centerXOfVisualCol})과 어긋난다`,
  );

  // ---- 섹션 전체: 절세액·화살표가 두 열을 합친 섹션 가로 중심에 있다 -----
  const sectionCenterX = data.sectionRect.left + (data.sectionRect.right - data.sectionRect.left) / 2;
  assert.ok(data.centerXOfAmountCard != null, '절세액 카드의 가로 중심을 재지 못했다');
  assert.ok(
    Math.abs(data.centerXOfAmountCard - sectionCenterX) <= TOLERANCE_PX,
    `절세액 카드 가로 중심(${data.centerXOfAmountCard})이 섹션 중심(${sectionCenterX})과 어긋난다`,
  );
  assert.ok(data.centerXOfArrow != null, '화살표의 가로 중심을 재지 못했다');
  assert.ok(
    Math.abs(data.centerXOfArrow - sectionCenterX) <= TOLERANCE_PX,
    `화살표 가로 중심(${data.centerXOfArrow})이 섹션 중심(${sectionCenterX})과 어긋난다`,
  );
});

test('예시 절세액 캡션이 완전히 사라졌다(과세연도 한 줄도 남지 않는다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(!data.hasCaption, '예시 절세액 카드에 캡션 요소(.amount-card-caption)가 남아 있다');
  const cardText = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const card = host.shadowRoot.querySelector('.amount-card');
    return card ? card.textContent : null;
  })()`);
  assert.ok(cardText, '예시 절세액 카드를 찾지 못했다');
  assert.ok(!cardText.includes('과세연도 기준'), `카드 텍스트에 캡션 흔적이 남아 있다: "${cardText}"`);
});

test('예시 범례·조각 라벨(이름+비율)·조각 자체가 DOM에만 있는 게 아니라 실제로 화면에 보인다(0크기가 아니다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);

  assert.ok(data.legendItemRects.length >= 3, `범례 항목이 3개 미만이다: ${JSON.stringify(data.legendItemRects)}`);
  for (const [i, r] of data.legendItemRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `범례 항목 ${i}이 0크기다(DOM에는 있어도 안 보인다): ${JSON.stringify(r)}`);
  }

  // [2026-08-17, D72] ①②③ 배지는 없어졌다 — 조각 라벨(이름+비율) 자체가
  // 실제로 화면에 보이는지를 대신 잰다.
  assert.ok(data.sliceLabelRects.length >= 3, `도넛 조각 라벨이 3개 미만이다: ${JSON.stringify(data.sliceLabelRects)}`);
  for (const [i, r] of data.sliceLabelRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `조각 라벨 ${i}이 0크기다: ${JSON.stringify(r)}`);
  }

  for (const [i, b] of data.sliceTopBBoxes.entries()) {
    assert.ok(b.width > 1 && b.height > 1, `도넛 조각 ${i} 자체가 0크기다: ${JSON.stringify(b)}`);
  }

  assert.ok(data.amountCardRect && data.amountCardRect.width > 1 && data.amountCardRect.height > 1, `절세액 카드가 0크기다: ${JSON.stringify(data.amountCardRect)}`);
});

test('예시 섹션이 문서 전체 질의(.amount-card, .chart-donut)와 충돌하지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const count = await page.evaluate(`document.querySelectorAll('.chart-donut').length`);
  assert.equal(count, 0, 'Shadow DOM 밖에서 .chart-donut이 보인다 — 예시가 문서 전체 질의에 새고 있다');
  const amountCount = await page.evaluate(`document.querySelectorAll('.amount-card').length`);
  assert.equal(amountCount, 0, 'Shadow DOM 밖에서 .amount-card가 보인다 — 예시가 문서 전체 질의에 새고 있다');
});

test('화면에 렌더된 예시 값이, 지금 이 순간 엔진을 다시 불러 얻은 값과 정확히 같다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const rendered = await page.evaluate(READ_SHOWCASE);

  const recomputed = await page.evaluate(`(async () => {
    const mod = await import('/src/web/ui/example-showcase.js');
    const engineClient = await import('/src/web/engine/engine-client.js');
    const { plan } = await mod.computeExampleScenario(engineClient);
    const copy = await import('/src/web/copy.js');
    const headline = plan.headline_composite_total;
    return {
      valueText: copy.headlineValueText(headline),
      label: headline.includes_assumption_component ? copy.AMOUNT_CARD_LABEL_COMPOSITE : copy.AMOUNT_CARD_LABEL_CREDIT_ONLY,
    };
  })()`);

  assert.equal(rendered.amountValue, recomputed.valueText, '화면 값이 지금 다시 계산한 엔진 결과와 다르다');
  assert.equal(rendered.amountLabel, recomputed.label);
});

test('예시 도넛의 기하를 실측한다 — 각도 합 360°, 조각별 각도가 배분액 비율과 일치, 중앙값·라벨·색 짝', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });

  const measured = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const donut = root.querySelector('.chart-donut');
    const tops = [...donut.querySelectorAll('path[role="img"]')];
    const slices = tops.map((p) => ({
      start: Number(p.dataset.arcStart),
      end: Number(p.dataset.arcEnd),
      fill: getComputedStyle(p).fill,
      ariaLabel: p.getAttribute('aria-label'),
    }));
    // [2026-08-17, D72] 범례에서 비율 열이 빠졌다(조각 라벨이 이미 비율을
    // 말한다, charts.js donutLegend 머리말) — 이름+금액만 남는다.
    const legendItems = [...root.querySelectorAll('.donut-legend-item')].map((li) => ({
      name: li.querySelector('.donut-legend-name').textContent,
      amountText: li.querySelector('.donut-legend-amount').textContent,
      swatchColor: getComputedStyle(li.querySelector('.donut-legend-swatch')).backgroundColor,
    }));
    const centerValueText = root.querySelector('.donut-center-value')?.textContent ?? null;

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

  assert.equal(measured.legendItems.length, measured.slices.length, '범례 항목 수가 조각 수와 다르다');
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
 * [2026-08-17, D72(관리자 지시 4번)] 도넛 조각 위 이름+비율 라벨 — ①②③
 * 배지를 대신해 조각 위에 계좌 이름을 직접 쓰고, 지난 회차의 퍼센티지도
 * 함께 그린다. 이 예시의 실제 배분(33%/17%/50%, `example-showcase.test.mjs`
 * 가 계산 값으로 고정한 그 비율)이 정확히 그려지는지, **특히 최소값인
 * 17%(IRP) 조각에 이름+비율이 실제로 들어가는지**(들어가지 않으면 리더선
 * 폴백으로 밀려나야 한다는 것이 계약)를 잰다.
 */
test('D72 4번 — 도넛 조각 위에 계좌 이름 + 실제 배분 비율(연금저축 33%·IRP 17%·ISA 50%)이 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);

  const pctTexts = [...data.sliceLabelPctTexts].sort();
  assert.deepEqual(pctTexts, ['17%', '33%', '50%'], `조각 위 비율이 실제 배분(33/17/50%)과 다르다: ${JSON.stringify(data.sliceLabelPctTexts)}`);
  const nameTexts = [...data.sliceLabelNameTexts].sort();
  assert.deepEqual(nameTexts, ['IRP', 'ISA', '연금저축'], `조각 위 이름이 계좌 셋과 다르다: ${JSON.stringify(data.sliceLabelNameTexts)}`);

  // **17% 조각(IRP)을 특정해 실측한다** — 소유자 지시("17% 조각에
  // 이름+퍼센트가 들어가는지 실측하라")의 핵심 조건이다. 이름·비율 배열이
  // 같은 인덱스로 짝지어 그려지므로(`charts.js`의 `applyDonutSliceInlineLabelsToSvg`
  // 가 조각마다 정확히 하나의 `<text>`를 만들고, 그 안에 이름·비율 tspan
  // 둘을 순서대로 넣는다) 같은 인덱스에서 "IRP"와 "17%"가 함께 나와야 한다.
  const irpIndex = data.sliceLabelNameTexts.findIndex((t) => t === 'IRP');
  assert.ok(irpIndex >= 0, `"IRP" 이름 라벨을 찾지 못했다: ${JSON.stringify(data.sliceLabelNameTexts)}`);
  assert.equal(data.sliceLabelPctTexts[irpIndex], '17%', `IRP와 같은 자리(인덱스 ${irpIndex})의 비율이 17%가 아니다: ${data.sliceLabelPctTexts[irpIndex]}`);

  // 이 예시(33/17/50%, 최소 17% ≈ 61° 스윕)에서는 실측상 리더선 폴백이
  // 걸리지 않는다 — 이름+비율 두 줄이 조각 안에 들어간다는 뜻이다. 걸렸다면
  // (즉 `sliceLabelLeaderCount > 0`) 규약대로 IRP 조각만 고리 밖으로 빠져
  // 있어야 하고, 이 검사는 그 사실 자체(0개)를 실측으로 고정한다.
  assert.equal(data.sliceLabelLeaderCount, 0, '이 예시의 실제 조각(최소 17%)에서는 리더선 폴백이 걸리지 않아야 하는데 걸렸다 — 17% 조각에 이름+비율이 안 들어간다는 뜻이다');

  for (const [i, r] of data.sliceLabelRects.entries()) {
    assert.ok(r.width > 1 && r.height > 1, `조각 라벨 ${i}이 0크기다: ${JSON.stringify(r)}`);
  }

  // **조각 라벨끼리 서로 겹치지 않는다** — 배지가 없어졌으므로 배지와의
  // 겹침 검사는 대상 자체가 사라졌다. 대신 세 라벨(AABB)이 서로 겹치지
  // 않는지를 잰다 — 조각이 3개뿐이고 서로 다른 각도에 있어 라벨도 서로
  // 떨어져 있어야 한다.
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
 * [2026-08-17, D72(관리자 지시 4번)] 글자 색 대비 — 흰/검 중 실제로 대비가
 * 서는 쪽을 골랐는지 WCAG 상대 휘도 공식으로 다시 계산해 대조한다(이 검사가
 * `bestTextColorOn`을 다시 부르지 않고 독립적으로 계산한다 — 화면이 쓰는
 * 함수 안의 결함은 그 함수를 다시 불러서는 못 잡는다). 전부 4.5:1(WCAG AA
 * 본문 기준) 이상이어야 한다.
 */
test('D72 4번 — 조각 위 이름+비율 라벨 글자색이 배경과 최소 4.5:1 대비를 낸다(실측)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });

  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const svg = root.querySelector('.chart-donut');
    const tops = [...svg.querySelectorAll('path[role="img"]')];
    const labelEls = [...root.querySelectorAll('.donut-slice-label')];
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

  assert.ok(m.length >= 3, `조각 라벨이 3개 미만이다: ${JSON.stringify(m)}`);
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

test('모바일 폭(375px)에서도 예시 도넛과 절세액이 함께 렌더된다(레이아웃이 세로로 쌓인다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data.donutPathCount > 0);
  const overflowsX = await page.evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
  assert.equal(overflowsX, false, '375px에서 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('375px에서 절세액이 카드·문서 어느 쪽도 넘치지 않고, 축소 바닥값 아래로 내려가지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const px = Number((data.amountValueFontSize ?? '0px').replace('px', ''));
  assert.ok(px >= 32, `375px에서 절세액 글자 크기(${data.amountValueFontSize})가 축소 바닥값(32px)보다 작다`);
  const m = await page.evaluate(`(() => {
    const host = document.querySelector('.example-showcase-slot');
    const value = host.shadowRoot.querySelector('.amount-card-value');
    const card = host.shadowRoot.querySelector('.amount-card');
    const vr = value.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    return { overflowsCard: vr.width > cr.width + 1, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  })()`);
  assert.equal(m.overflowsCard, false, '375px에서 절세액이 카드 폭을 넘는다');
  assert.equal(m.docOverflow, false, '375px에서 절세액이 문서 가로 스크롤을 만든다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('예시 도넛 조각 사이에 실제 간격이 있다 — 검은 점(경계 어두운 쐐기) 결함이 되돌아오지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  const tops = data.sliceRenderVsArc.filter((_, i) => i < 3 || true);
  assert.ok(tops.length >= 3, `조각 데이터가 3개 미만이다(연금저축·IRP·ISA 셋을 기대): ${tops.length}`);
  for (const s of tops) {
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
 * 이 그것을 막는다. 이 검사는 **"뷰포트 top 근처"가 아니라 "헤더 아래에
 * 실제로 가려지지 않는지"**를 직접 잰다 — 입력 패널의 첫 줄이 헤더의 아래
 * 경계보다 위에 있으면(겹치면) 실패한다.
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
  // 여유 2px — 서브픽셀 반올림 대비. 이 값이 음수면(panelTitleBottom <
  // headerBottom) 제목 전체가 헤더 뒤에 완전히 숨은 것이고, 여기서는 최소한
  // "완전히 숨지는 않는다"(제목의 아래쪽 절반이라도 보인다)까지 확인한다.
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
// [2026-08-17, 관리자 지시(3차) 2번] man-icon — 입력 세 줄 왼쪽, 세 줄
// 전체 높이만큼, 다크에서는 반전(invert)한다.
// ---------------------------------------------------------------------------

/**
 * [2026-08-18, 관리자 지시(4차) 1·2번] **뒤집힌 기대값.** 옛 검사는
 * 아이콘 자신의 높이가 세 줄 전체 높이(당시 28px 기준)와 정확히 같기를
 * 기대했다 — 그때는 아이콘 열에 아이콘 하나뿐이었다. 이제 아이콘 밑에
 * 이름표(「김철수씨」)가 붙어 **아이콘 열 전체**(아이콘+gap+이름표)가 세
 * 줄 전체 높이와 같아야 하고, 아이콘 자신은 그 몫에서 이름표 자리를 뺀
 * 값이어야 한다 — 계산 근거는 `styles.css`의 `.example-showcase-input-icon`
 * 주석과 같다(입력 줄 25px 기준 3줄 + gap 둘 = 117.25px, 거기서 이름표
 * (12.5px × 1.4 + gap 4px = 21.5px)를 뺀 95.75px).
 */
test('관리자 지시(3차) 2번 — man-icon 높이가 입력 세 줄 전체 높이와 같다(데스크톱)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data.inputIconRect, 'man-icon을 찾지 못했다');
  const LINES_HEIGHT = 25 * 1.35 * 3 + 8 * 2;
  const NAME_TAG_SHARE = 12.5 * 1.4 + 4;
  const EXPECTED = LINES_HEIGHT - NAME_TAG_SHARE;
  assert.ok(
    Math.abs(data.inputIconRect.height - EXPECTED) <= 1,
    `man-icon 높이(${data.inputIconRect.height}px)가 계산값(${EXPECTED}px)과 1px 넘게 어긋난다`,
  );
  // 정사각형 원본(512×512)이므로 표시 비율도 1:1에 가까워야 한다(스케일만
  // 달라졌지 원본을 눌러 찌그러뜨리지 않았다).
  assert.ok(
    Math.abs(data.inputIconRect.width - data.inputIconRect.height) <= 1,
    `man-icon이 정사각형 원본 비율을 잃었다(width ${data.inputIconRect.width}px, height ${data.inputIconRect.height}px)`,
  );
});

/**
 * [2026-08-17, 관리자 지시(3차) 2번] 375px(<768px)에서는 man-icon을 뺀다 —
 * `.example-showcase-input-block`이 겨눈 문제("가운데가 비어 보인다")가
 * 2열 데스크톱 배치 한정이고, 375px 1열 스택은 이미 폭 전체를 쓰므로 그
 * 문제 자체가 없다(`styles.css` 모바일 미디어쿼리 주석).
 */
test('관리자 지시(3차) 2번 — 375px에서는 man-icon이 숨겨지고 입력 세 줄이 옛(아이콘 이전) 구조처럼 카드 중심에 정렬된다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1200, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const data = await page.evaluate(READ_SHOWCASE);
  assert.ok(data.inputIconRect, 'man-icon 요소 자체(DOM)는 여전히 있어야 한다');
  assert.equal(data.inputIconRect.width, 0, `375px에서 man-icon이 여전히 폭을 차지한다: ${data.inputIconRect.width}px`);
  const centerXOfInputLines = data.inputLineRects.map((r) => r.left + r.width / 2);
  const cardCenterX = data.sectionRect.left + data.sectionRect.width / 2;
  for (const [i, cx] of centerXOfInputLines.entries()) {
    assert.ok(
      Math.abs(cx - cardCenterX) <= 2,
      `375px — 입력 줄 ${i}의 가로 중심(${cx})이 카드 중심(${cardCenterX})과 2px 넘게 어긋난다(man-icon이 자리를 차지하고 있을 수 있다)`,
    );
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [2026-08-17, 관리자 지시(3차) 2번] 다크에서 원본(검정 선화)이 다크 카드
 * 배경에 묻히는 문제를 `filter: invert(1)`로 반전한다 — 실측(관리자 최종
 * 보고). **판별력을 직접 깨서 확인했다** — `.example-showcase-input-icon`의
 * 다크 반전 규칙(미디어쿼리·`[data-theme="dark"]` 둘 다)을 임시로 지우고
 * 돌리면 `filterApplied`가 `false`로 이 검사가 빨갛다 — 되돌리면 통과한다.
 */
test('관리자 지시(3차) 2번 — 다크 모드에서 man-icon이 반전(invert)된다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  const READ_ICON_FILTER = `(() => {
    const host = document.querySelector('.example-showcase-slot');
    if (!host || !host.shadowRoot) return null;
    const icon = host.shadowRoot.querySelector('.example-showcase-input-icon');
    return icon ? getComputedStyle(icon).filter : null;
  })()`;

  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  const lightFilter = await page.evaluate(READ_ICON_FILTER);
  assert.ok(lightFilter === 'none' || !lightFilter, `라이트에서 man-icon에 filter가 걸려 있다: ${lightFilter}`);

  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`);
  await sleep(100);
  const darkFilter = await page.evaluate(READ_ICON_FILTER);
  assert.notEqual(darkFilter, 'none', `다크에서 man-icon에 반전 filter가 걸려 있지 않다: ${darkFilter}`);
  assert.match(darkFilter ?? '', /invert/, `다크 man-icon filter가 invert를 쓰지 않는다: ${darkFilter}`);

  await page.evaluate(`document.documentElement.removeAttribute('data-theme')`);
});

/**
 * [신설, 2026-08-18, 관리자 지시(6차) 1번] **오른쪽 열(「이렇게 배분해보세요」
 * 캡션 + 도넛 + 범례)을 정확히 40px 왼쪽으로 옮기고, 왼쪽 열(물음·아이콘·
 * 입력 세 줄)의 x좌표는 전혀 건드리지 않는다.**
 *
 * **실측 방법 — `transform`을 토글해 델타를 직접 잰다.** `.example-showcase-visual-col`
 * 의 `transform: translateX(-40px)`(`styles.css`)를 켠 상태와
 * `transform: none`으로 되돌린 상태 각각에서 같은 요소의
 * `getBoundingClientRect().left`를 재고 차이를 계산한다 — CSS 값을 다시
 * 읽는 것(`getComputedStyle(...).transform`을 문자열로 파싱하는 것)보다
 * **실제 렌더 좌표의 차이**를 재는 쪽이 "정확히 40px 이동했다"를 더
 * 직접적으로 증명한다(행렬 문자열 파싱은 부호·단위 실수가 검사 자체에
 * 숨어들 위험이 있다).
 */
test('관리자 지시(6차) 1번 — 오른쪽 열(캡션+도넛)이 정확히 40px 왼쪽으로 옮겨졌고, 왼쪽 열(물음·아이콘·입력 세 줄) x좌표는 그대로다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await sleep(200);

  const READ_POSITIONS = `(() => {
    const host = document.querySelector('.example-showcase-slot');
    const root = host.shadowRoot;
    const visualCol = root.querySelector('.example-showcase-visual-col');
    const heading = root.querySelector('.example-showcase-visual-heading');
    const donut = root.querySelector('.chart-donut');
    const legend = root.querySelector('.donut-legend');
    const textCol = root.querySelector('.example-showcase-text-col');
    const question = root.querySelector('.example-showcase-question');
    const inputIcon = root.querySelector('.example-showcase-input-icon');
    return {
      visualColLeft: visualCol.getBoundingClientRect().left,
      headingLeft: heading.getBoundingClientRect().left,
      donutLeft: donut.getBoundingClientRect().left,
      legendLeft: legend.getBoundingClientRect().left,
      textColLeft: textCol.getBoundingClientRect().left,
      questionLeft: question.getBoundingClientRect().left,
      inputIconLeft: inputIcon.getBoundingClientRect().left,
      docOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`;

  // (1) 현재(이동된) 상태 — 실제 배포 CSS 그대로.
  const shifted = await page.evaluate(READ_POSITIONS);
  assert.equal(shifted.docOverflowsX, false, '오른쪽 열을 옮긴 뒤에도 문서 가로 스크롤이 없어야 한다');

  // (2) `transform`을 꺼서(=옛 위치) 다시 잰다 — 같은 프레임 안에서 토글하므로
  // 다른 레이아웃 변화(리사이즈·리렌더)가 끼어들 여지가 없다.
  await page.evaluate(`(() => {
    const visualCol = document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-visual-col');
    visualCol.style.transform = 'none';
  })()`);
  const unshifted = await page.evaluate(READ_POSITIONS);

  // (3) 되돌린다 — 이 검사 뒤에 오는 다른 검사(정렬 등)에 영향을 주지 않는다.
  await page.evaluate(`(() => {
    const visualCol = document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-visual-col');
    visualCol.style.transform = '';
  })()`);

  const TOLERANCE_PX = 0.5;
  for (const [label, shiftedLeft, unshiftedLeft] of [
    ['오른쪽 열 자체', shifted.visualColLeft, unshifted.visualColLeft],
    ['「이렇게 배분해보세요」 캡션', shifted.headingLeft, unshifted.headingLeft],
    ['도넛', shifted.donutLeft, unshifted.donutLeft],
    ['범례', shifted.legendLeft, unshifted.legendLeft],
  ]) {
    const delta = shiftedLeft - unshiftedLeft;
    assert.ok(
      Math.abs(delta - -40) <= TOLERANCE_PX,
      `${label}의 이동량(${delta.toFixed(2)}px)이 -40px과 ${TOLERANCE_PX}px 넘게 어긋난다(이동 전 ${unshiftedLeft}, 이동 후 ${shiftedLeft})`,
    );
  }

  // 왼쪽 열(물음·man-icon)은 오른쪽 열의 transform 토글과 완전히 무관한
  // 별도 grid 영역이다 — x좌표가 조금도 움직이지 않아야 한다.
  assert.ok(
    Math.abs(shifted.textColLeft - unshifted.textColLeft) <= TOLERANCE_PX,
    `왼쪽 칸(.example-showcase-text-col) 왼쪽 끝이 움직였다: 이동 전 ${unshifted.textColLeft}, 이동 후 ${shifted.textColLeft}`,
  );
  assert.ok(
    Math.abs(shifted.questionLeft - unshifted.questionLeft) <= TOLERANCE_PX,
    `물음 줄 왼쪽 끝이 움직였다: 이동 전 ${unshifted.questionLeft}, 이동 후 ${shifted.questionLeft}`,
  );
  assert.ok(
    Math.abs(shifted.inputIconLeft - unshifted.inputIconLeft) <= TOLERANCE_PX,
    `man-icon 왼쪽 끝이 움직였다: 이동 전 ${unshifted.inputIconLeft}, 이동 후 ${shifted.inputIconLeft}`,
  );

  await page.send('Emulation.clearDeviceMetricsOverride');
});

/**
 * [신설, 2026-08-18, 관리자 지시(6차) 1번] 모바일(1열 스택)에서는 "오른쪽
 * 열"이라는 개념 자체가 없다 — 이동이 0으로 되돌려져 있어야 한다
 * (`styles.css` 모바일 미디어쿼리의 `.example-showcase-visual-col { transform:
 * none; }`).
 */
test('관리자 지시(6차) 1번 — 375px(모바일 1열 스택)에서는 오른쪽 열 이동이 0으로 되돌려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1200, deviceScaleFactor: 1, mobile: true });
  await page.waitFor(`!!${READ_SHOWCASE}`, { timeoutMs: 8000 });
  await sleep(200);
  const transformValue = await page.evaluate(`(() => {
    const visualCol = document.querySelector('.example-showcase-slot').shadowRoot.querySelector('.example-showcase-visual-col');
    return getComputedStyle(visualCol).transform;
  })()`);
  assert.ok(
    transformValue === 'none' || transformValue === '',
    `375px에서 오른쪽 열에 여전히 transform이 걸려 있다: ${transformValue}`,
  );
  const overflowsX = await page.evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
  assert.equal(overflowsX, false, '375px에서 가로 스크롤이 생겼다');
  await page.send('Emulation.clearDeviceMetricsOverride');
});
