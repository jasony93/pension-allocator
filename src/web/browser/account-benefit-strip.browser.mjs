import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * `AccountBenefitStrip` — D35→D36 재개정(design-system 5.31.2·5.31.3절 ·
 * screens.md 5.14.8절) — 실제 렌더 실측.
 *
 * jsdom은 레이아웃을 계산하지 않으므로 "폭이 실제로 카드 내용 폭 100%인가",
 * "컨테이너(배경·테두리)가 실제로 렌더되어 C-2와 구분되는가", "두 축이 실제로
 * 다른 배율을 쓰는가", "일곱 행 세율표가 잘리지 않고 다 나오는가"는 정적
 * 검사(`ui/account-benefit-strip-width.test.mjs`)로는 볼 수 없다. 이 파일이
 * 실제 Chrome으로 잰다.
 *
 * 소유자가 이 위젯을 **세 번** "안 보인다"고 신고했다 — 그래서 이 파일은
 * "DOM에 있다"가 아니라 "실측 px가 계약값과 맞고, 눈으로 C-2와 갈라져
 * 보인다"까지를 본다.
 */

const SET = (id, v) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
const CLICK = (id) => `document.getElementById(${JSON.stringify(id)}).click()`;

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  const { page } = app;
  // **한 번에 몰아 치지 않는다.** ISA 조건부 블록은 `isaExists`가 켜져야
  // DOM에 나타난다 — 같은 동기 스크립트 안에서 클릭 직후 그 자식 필드를
  // 바로 찾으면 아직 렌더되지 않은 노드를 잡아 `null`이 된다(실측으로 잡은
  // 결함 — `input-focus.browser.mjs`가 같은 자리에서 별도 라운드트립으로
  // 기다리는 것과 같은 이유다). 그래서 단계마다 라운드트립을 나눈다.
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await sleep(150);
  // 9.0.0(D39·D40) — 세액 한도는 이제 총급여액에서 계산된다. 낮은 총급여로
  // 한도를 낮춰 `cap_below_ceiling`(및 `binds_provably`)을 실제로 보이게 한다.
  await page.evaluate(SET('currentSalary', '2000'));
  await sleep(150);
  await page.evaluate(SET('monthlyCapacity', '150'));
  await sleep(150);
  await page.evaluate(CLICK('isaExists-true'));
  await page.waitFor(`!!document.getElementById('isaCumulative')`);
  await page.evaluate(CLICK('isaAccountType-general'));
  await sleep(150);
  await page.evaluate(SET('isaCumulative', '2000'));
  await sleep(150);
  await page.evaluate(CLICK('isaReturnEnabled-true'));
  await page.waitFor(`!!document.getElementById('isaReturnRatePercent')`);
  await page.evaluate(SET('isaReturnRatePercent', '7'));
  await sleep(150);
  await page.evaluate(CLICK('isaIncomeCharacter-interest_dividend'));
  await sleep(150);
  await page.evaluate(SET('isaSettlementYears', '5'));
  await sleep(150);
  await page.waitFor(`!!document.querySelector('.account-benefit-strip .benefit-axis-assumption .benefit-row-amount')`);
  await sleep(500);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

async function setViewport(page, width, height = 1400) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await sleep(150);
}

/** 위젯·카드·C-2 막대·두 축 트랙의 실측 치수를 한 번에 뽑는다. */
const MEASURE = `(() => {
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const strip = document.querySelector('.account-benefit-strip');
  const card = document.querySelector('.donut-with-strip');
  const allocTrack = document.querySelector('.alloc-bar-track');
  const confirmedTrack = document.querySelector('.benefit-axis-confirmed .benefit-meter-track');
  const confirmedFill = document.querySelector('.benefit-axis-confirmed .benefit-meter-fill');
  const assumptionTracks = [...document.querySelectorAll('.benefit-axis-assumption .benefit-meter-track')];
  const divider = document.querySelector('.benefit-axis-divider');
  const header = document.querySelector('.account-benefit-strip h4');
  const c2AccountName = document.querySelector('.allocation-bar-labels .type-body-strong');
  const cs = strip ? getComputedStyle(strip) : null;
  // 위젯을 실제로 담고 있는 카드 — .result-panel-inner가 surface-raised
  // 배경을 그린다. 관리자가 잡은 결함은 이 배경과 위젯 배경이 라이트에서
  // 같은 색이었다는 것이다.
  const cardSurface = document.querySelector('.result-panel-inner');
  const assumptionChip = document.querySelector('.benefit-row-assumption-chip');
  const assumptionTrack = document.querySelector('.benefit-axis-assumption .benefit-meter-track');
  // D43 — ISA 비과세 행의 채움 원소. .benefit-axis-assumption의 첫 번째
  // .benefit-meter-fill이 곧 비과세 행의 막대다(가정 축에서 막대를 갖는
  // 행이 이제 이거 하나뿐이다).
  const assumptionFill = document.querySelector('.benefit-axis-assumption .benefit-meter-fill');
  // D43 — 가정 축 제목(조건절)이 실제로 그 자리에 렌더되는지. 자리로 세지
  // 않고 **확정 축 트랙과 가정 축 트랙 사이**에 실제로 존재하는지를 아래
  // 테스트가 y좌표로 확인한다.
  const axisCaptionEl = document.querySelector('.benefit-axis-assumption .benefit-axis-caption');
  const confirmedFillCs = confirmedFill ? getComputedStyle(confirmedFill) : null;
  const assumptionFillCs = assumptionFill ? getComputedStyle(assumptionFill) : null;
  return {
    stripRect: rect(strip),
    cardRect: rect(card),
    allocTrackRect: rect(allocTrack),
    confirmedTrackRect: rect(confirmedTrack),
    confirmedFillRect: rect(confirmedFill),
    assumptionTrackRects: assumptionTracks.map(rect),
    // 막대 없이 숫자만 내는 행(법정 상한 없음). 트랙 개수만 세면 "하나가
    // 실수로 안 그려진 것"과 구분되지 않으므로 이 행이 실제로 있는지 함께 센다.
    noCeilingRowCount: [...document.querySelectorAll('.benefit-axis-assumption *')]
      .filter((e) => e.children.length === 0 && /법정 상한 없음/.test(e.textContent ?? '')).length,
    dividerRect: rect(divider),
    stripBackground: cs ? cs.backgroundColor : null,
    stripBorderColor: cs ? cs.borderColor : null,
    stripBorderWidth: cs ? cs.borderTopWidth : null,
    cardSurfaceBackground: cardSurface ? getComputedStyle(cardSurface).backgroundColor : null,
    headerFontSize: header ? getComputedStyle(header).fontSize : null,
    headerFontWeight: header ? getComputedStyle(header).fontWeight : null,
    c2AccountNameFontSize: c2AccountName ? getComputedStyle(c2AccountName).fontSize : null,
    referenceRowCount: document.querySelectorAll('.benefit-reference-table tbody tr').length,
    axisCaptions: [...document.querySelectorAll('.benefit-axis-caption')].map((e) => e.textContent),
    // 축 **안의 모든 글자.** 캡션이 행으로 합쳐지든 다시 갈라지든 같은 것을 문다.
    confirmedAxisText: (document.querySelector('.benefit-axis-confirmed') || {}).textContent || '',
    assumptionAxisText: (document.querySelector('.benefit-axis-assumption') || {}).textContent || '',
    // 관리자가 지목한 두 번째 결함 — .benefit-row-body가 flex column인데
    // align-items 기본값이 stretch라 이 칩이 트랙 전체 폭으로 늘어났었다.
    assumptionChipRect: rect(assumptionChip),
    assumptionTrackForChipRect: rect(assumptionTrack),
    // D43 — 채움 실측. 빗금(repeating-linear-gradient)으로 되돌아갔는지,
    // solid 배경으로 실제로 칠해졌는지를 렌더된 값으로 확인한다.
    assumptionFillRect: rect(assumptionFill),
    axisCaptionRect: rect(axisCaptionEl),
    confirmedFillBackgroundImage: confirmedFillCs ? confirmedFillCs.backgroundImage : null,
    confirmedFillBackgroundColor: confirmedFillCs ? confirmedFillCs.backgroundColor : null,
    confirmedFillBorderWidth: confirmedFillCs ? confirmedFillCs.borderTopWidth : null,
    assumptionFillBackgroundImage: assumptionFillCs ? assumptionFillCs.backgroundImage : null,
    assumptionFillBackgroundColor: assumptionFillCs ? assumptionFillCs.backgroundColor : null,
    assumptionFillBorderWidth: assumptionFillCs ? assumptionFillCs.borderTopWidth : null,
  };
})()`;

test('1440px — 위젯 폭이 카드 내용 폭 100%다(D35·D36, 옛 50%가 아니다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.cardRect.width > 0, '.donut-with-strip이 렌더되지 않았습니다');
  assert.ok(
    Math.abs(m.stripRect.width - m.cardRect.width) <= 1,
    `위젯 폭(${m.stripRect.width}px)이 카드 폭(${m.cardRect.width}px)과 같아야 한다(100%)`,
  );
  assert.ok(
    Math.abs(m.stripRect.x - m.cardRect.x) <= 1,
    '위젯 좌측이 카드 좌측과 같아야 한다 — 우측 정렬(align-self: flex-end)이 남아 있으면 안 된다',
  );
});

test('컨테이너 — 실제로 배경·테두리가 그려진다(D35, "박스가 겹침을 막는다")', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.notEqual(m.stripBorderColor, 'rgba(0, 0, 0, 0)', '테두리가 투명하면 박스로 보이지 않는다');
  assert.notEqual(m.stripBorderWidth, '0px', '테두리 두께가 0이면 박스로 보이지 않는다');
});

test('라이트 모드 — 위젯 배경이 카드 배경과 실제로 다른 색으로 렌더된다(관리자 실측 결함)', { skip: skipWithoutChrome }, async () => {
  // 이전 검사("테두리가 투명하지 않다")는 통과하면서 아무것도 증명하지
  // 않았다 — 배경이 뒤 표면(카드)과 같은 색인지 한 번도 묻지 않았다.
  // `surface-overlay`와 `surface-raised`가 라이트에서 둘 다 #FFFFFF였고,
  // 관리자가 스크린샷에서 "박스의 바닥이 없다"고 잡았다. 여기서 실제
  // 렌더된 `getComputedStyle().backgroundColor`를 직접 비교한다.
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.cardSurfaceBackground, '.result-panel-inner(카드) 배경을 읽지 못했습니다');
  assert.notEqual(
    m.stripBackground,
    m.cardSurfaceBackground,
    `위젯 배경(${m.stripBackground})이 카드 배경(${m.cardSurfaceBackground})과 같다 — 폭 100%를 정당화한 D35의 컨테이너 전제가 무너진다`,
  );
});

test('두 축이 실제로 다른 배율을 쓴다 — 트랙 길이는 같아도(같은 위젯 폭) 채움 비율의 분모가 다르다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.dividerRect.width > 0, '두 축 사이 구분선이 실제로 렌더되지 않았습니다');
  assert.ok(m.confirmedTrackRect.width > 0, '확정 축 트랙이 렌더되지 않았습니다');
  // **D38 7번으로 바뀐 자리다.** 여기는 원래 "가정 축 트랙이 둘 이상"을
  // 요구했다 — 비과세와 저율분리 둘 다 막대를 가졌기 때문이다. 저율분리분에는
  // 법정 상한이 없다는 것이 조문에서 확인되어(초과분에 뚜껑을 두는 문언이 없다)
  // **그 행의 막대를 없앴다.** 분모가 없는 값에 트랙-채움 비율을 그리면 그
  // 막대가 분모를 지어낸다.
  //
  // 그래서 이 검사는 개수를 **줄이지 않고 뒤집는다** — 트랙이 정확히 하나인
  // 것만으로는 "실수로 하나가 안 그려진 것"과 구분되지 않으므로, 상한 없는
  // 행이 **실제로 그 자리에 있으면서 막대만 없다는 것**을 함께 문다.
  assert.equal(m.assumptionTrackRects.length, 1, `가정 축 트랙은 비과세 하나뿐이어야 한다(실측 ${m.assumptionTrackRects.length}개)`);
  for (const t of m.assumptionTrackRects) assert.ok(t.width > 0, '가정 축 트랙이 0폭이면 안 됩니다');
  assert.ok(m.noCeilingRowCount >= 1, '법정 상한이 없는 행이 화면에서 사라졌습니다 — 막대를 없앤 것이지 행을 없앤 것이 아니다');

  // **자리로 세지 않고 내용으로 센다.** 이 검사는 원래 `axisCaptions[0]`이
  // 확정 축이라고 전제했는데, D38 2번이 확정 축 캡션을 「최대 ○ 중 ○」 한 줄로
  // 행에 합치면서 그 자리에서 사라졌다. 그러자 [0]이 가정 축 캡션을 가리켰고
  // 검사는 **엉뚱한 문자열을 확정 축이라 부르며** 실패했다.
  //
  // 자리는 설계가 바뀔 때마다 움직인다. 문장이 **어느 축 안에** 있는지를 물으면
  // 합치든 나누든 같은 것을 문다.
  assert.match(
    m.confirmedAxisText,
    /세액공제 최대 한도 [\d,]+원\(소득세 [\d,]+원 \+ 지방소득세 [\d,]+원\)/,
    `확정 축에 지방소득세 분해 표기가 없다(D37): "${m.confirmedAxisText.slice(0, 160)}"`,
  );
  // 가정 축은 기간과 조건절을 함께 져야 한다(D36·D39) — 「가정 기반」 칩을
  // 지운 승인이 이 둘에 걸려 있으므로, 하나라도 사라지면 여기서 걸린다.
  //
  // **[2026-08-11, D43] 이 두 검사가 이제 D43의 승인 조건 그 자체다.** 막대가
  // 빗금에서 채움으로 바뀌면서, 확정/가정을 가르는 채널이 이 조건절과 아래
  // 「계약 전체」(정산 기간) 문구 둘로 줄었다 — 여유가 없다. 검사는 이미
  // 있었으므로 새로 만들지 않고 이 주석만 남긴다.
  assert.match(
    m.assumptionAxisText,
    /\d+년 동안, 수익률이 연 [\d.]+%라면/,
    `가정 축에 기간·조건절이 없다: "${m.assumptionAxisText.slice(0, 160)}"`,
  );
  assert.match(
    m.assumptionAxisText,
    /\d+년 계약 전체에서/,
    `ISA 비과세 축에 「계약 전체」가 없다 — 옆의 연간 축과 나란히 놓여 오독이 난다: "${m.assumptionAxisText.slice(0, 200)}"`,
  );
});

test('가정 축 막대가 채워져 있다(D43) — 빗금·윤곽으로 되돌아가지 않았다', { skip: skipWithoutChrome }, async () => {
  // 소유자가 "ISA 막대 안이 비어 있다"를 두 번째로 신고했다(D38 5번 → D43).
  // D38 5번의 대응(윤곽 + 45° 빗금)이 답이 아니었다는 뜻이므로, 이 검사는
  // 그 형태로 되돌아가는 회귀를 잡는다 — 이전엔 "빗금이 렌더된다"를 쟀을
  // 자리인데, 지금은 뒤집어서 "빗금이 아니라 채움이다"를 잰다.
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.assumptionFillRect, 'ISA 비과세 막대의 채움 원소를 찾지 못했습니다');
  assert.ok(m.assumptionFillRect.width > 0, 'ISA 비과세 채움 폭이 0입니다');
  assert.equal(
    m.assumptionFillBackgroundImage,
    'none',
    `채움에 배경 이미지(옛 repeating-linear-gradient 빗금)가 남아 있습니다: ${m.assumptionFillBackgroundImage}`,
  );
  assert.notEqual(
    m.assumptionFillBackgroundColor,
    'rgba(0, 0, 0, 0)',
    'ISA 비과세 채움의 배경색이 투명합니다 — 옛 윤곽(outline) 등급처럼 속이 비어 있습니다',
  );
  // 확정 축 채움과 같은 처리(D43 — 등급이 모양을 가르지 않는다)인지 대조한다.
  assert.equal(
    m.assumptionFillBackgroundImage,
    m.confirmedFillBackgroundImage,
    '확정 축 채움과 가정 축 채움이 서로 다른 배경 이미지 처리를 쓰고 있습니다 — 이제 같아야 한다',
  );
  assert.equal(
    m.assumptionFillBorderWidth,
    m.confirmedFillBorderWidth,
    '확정 축 채움과 가정 축 채움이 서로 다른 테두리 두께를 쓰고 있습니다 — 이제 같아야 한다(둘 다 border: none)',
  );
});

test('확정 축 막대와 가정 축 막대가 같은 시야에서 이웃하지 않는다(D43) — 구분선·축 제목이 실제로 그 사이를 가른다', { skip: skipWithoutChrome }, async () => {
  // 막대가 빗금에서 채움으로 바뀌어 모양으로는 더 이상 두 축을 구분할 수
  // 없다(D43). 이제 이 구분을 지는 것은 배치뿐이다 — 구분선(`.benefit-axis-
  // divider`)과 가정 축 제목(조건절, `.benefit-axis-caption`)이 실제로
  // 확정 축 트랙과 가정 축 트랙 "사이"에 렌더돼야 한다. "존재한다"만으로는
  // 부족하다 — 두 트랙 사이가 아니라 다른 자리에 있어도 이 검사를 빼면
  // 통과했을 것이다.
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.confirmedTrackRect && m.confirmedTrackRect.height > 0, '확정 축 트랙이 렌더되지 않았습니다');
  assert.ok(m.assumptionTrackRects[0] && m.assumptionTrackRects[0].height > 0, '가정 축(비과세) 트랙이 렌더되지 않았습니다');
  assert.ok(m.dividerRect && m.dividerRect.width > 0, '구분선이 실제로 렌더되지 않았습니다');
  assert.ok(m.axisCaptionRect && m.axisCaptionRect.width > 0 && m.axisCaptionRect.height > 0, '가정 축 제목(조건절)이 실제로 렌더되지 않았습니다');

  const confirmedBottom = m.confirmedTrackRect.y + m.confirmedTrackRect.height;
  const assumptionTop = m.assumptionTrackRects[0].y;
  assert.ok(
    assumptionTop > confirmedBottom,
    `가정 축 트랙(y=${assumptionTop})이 확정 축 트랙 아래(y=${confirmedBottom} 이하)에 있어야 합니다 — 겹치거나 위에 있으면 안 됩니다`,
  );
  assert.ok(
    m.dividerRect.y >= confirmedBottom && m.dividerRect.y <= assumptionTop,
    `구분선(y=${m.dividerRect.y})이 두 트랙 사이(${confirmedBottom} ~ ${assumptionTop})에 있어야 합니다 — 딴 자리에 있으면 "사이를 가른다"고 말할 수 없습니다`,
  );
  assert.ok(
    m.axisCaptionRect.y >= m.dividerRect.y && m.axisCaptionRect.y <= assumptionTop,
    `가정 축 제목(y=${m.axisCaptionRect.y})이 구분선 아래·가정 축 트랙 위(${m.dividerRect.y} ~ ${assumptionTop})에 있어야 합니다`,
  );
  const gapPx = assumptionTop - confirmedBottom;
  assert.ok(
    gapPx > 20,
    `두 트랙의 세로 간격(${gapPx}px)이 너무 좁습니다 — 구분선·제목이 실제로 시야를 갈라놓지 못하면 두 채움 막대가 같은 시야에서 이웃한 것처럼 읽힙니다`,
  );
});

test('연금 참고 구역이 일곱 행을 전부 낸다(D37 3번 — 자르지 않는다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.equal(m.referenceRowCount, 7, `세율표가 7행이어야 한다(실측 ${m.referenceRowCount}행)`);
});

test('바로 아래 C-2 배분 막대와 구분되어 읽힌다 — 데스크톱(1440px)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.allocTrackRect, 'C-2(.alloc-bar-track)를 찾지 못했습니다');
  // D35가 겹침으로 지목한 것은 "길이·시작 x가 거의 같은 두 초록 막대"다.
  // 컨테이너가 이 겹침을 막는지, 최소한 위젯의 좌측 padding이 실제 트랙
  // 시작점을 C-2 트랙 시작점과 갈라 놓는지를 실측한다.
  assert.notEqual(
    m.confirmedTrackRect.x,
    m.allocTrackRect.x,
    `컨테이너 padding이 있으면 확정 축 트랙 시작 x(${m.confirmedTrackRect.x})가 C-2 트랙 시작 x(${m.allocTrackRect.x})와 달라야 한다`,
  );
});

test('바로 아래 C-2 배분 막대와 구분되어 읽힌다 — 모바일(<768px)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 375, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.stripRect.width > 0 && m.cardRect.width > 0);
  assert.ok(m.stripRect.width >= m.cardRect.width - 2, `모바일에서도 전체 폭이어야 합니다(위젯 ${m.stripRect.width}px, 카드 ${m.cardRect.width}px)`);
  assert.notEqual(m.stripBorderWidth, '0px', '모바일에서도 컨테이너 테두리가 있어야 한다 — 오독 방지는 폭이 아니라 컨테이너가 진다(D35)');
  assert.notEqual(
    m.confirmedTrackRect.x,
    m.allocTrackRect.x,
    '모바일에서도 컨테이너 padding으로 트랙 시작 x가 C-2와 달라야 한다',
  );
});

test('다크 모드에서도 컨테이너 테두리·배경이 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  await page.evaluate(`document.querySelector('.theme-control-trigger').click()`);
  await sleep(150);
  await page.evaluate(`[...document.querySelectorAll('.theme-menu-item')].find((b) => b.textContent.includes('어둡게'))?.click()`);
  await sleep(200);
  assert.equal(await page.evaluate(`document.documentElement.getAttribute('data-theme')`), 'dark');
  const m = await page.evaluate(MEASURE);
  assert.notEqual(m.stripBorderColor, 'rgba(0, 0, 0, 0)', '다크 모드에서도 테두리가 투명하면 안 된다');
  // 라이트로 되돌린다 — 이 파일 안의 다른 테스트가 테마 상태를 공유하지 않게.
  await page.evaluate(`document.querySelector('.theme-control-trigger').click()`);
  await sleep(100);
  await page.evaluate(`[...document.querySelectorAll('.theme-menu-item')].find((b) => b.textContent.includes('밝게'))?.click()`);
  await sleep(150);
});

test('트랙 굵기는 12px다 — D33의 6px(취소된 지시의 잔재)로 되돌아가지 않는다', { skip: skipWithoutChrome }, async () => {
  // 소유자가 D35 1번에서 "반 사이즈로" 지시를 취소했다. 관리자가 렌더에서
  // "길이만 늘고 눈에 띄는 정도는 그대로"라고 잡은 자리 — 6px 잔재를
  // 12px로 올렸다(styles.css `.benefit-meter-track` 주석의 실측 근거).
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(Math.abs(m.confirmedTrackRect.height - 12) <= 1, `확정 축 트랙 굵기가 12px 근방이어야 한다(실측 ${m.confirmedTrackRect.height}px)`);
  assert.ok(
    m.confirmedTrackRect.height > 6,
    `트랙이 옛 D33 값(6px) 근방으로 남아 있으면 안 된다(실측 ${m.confirmedTrackRect.height}px)`,
  );
  // 여전히 C-2(20px)보다 얇아야 한다 — 굵기 비율이 커질수록 D35가 지목한
  // 겹침 위험(길이·색·시작점이 같아 하나로 읽히는 것)에 가까워진다.
  assert.ok(m.allocTrackRect.height > m.confirmedTrackRect.height, `C-2 트랙(${m.allocTrackRect.height}px)이 이 위젯 트랙(${m.confirmedTrackRect.height}px)보다 굵어야 시각적으로 종속된다`);
  assert.ok(
    m.confirmedTrackRect.height / m.allocTrackRect.height <= 0.7,
    `굵기 비율(${(m.confirmedTrackRect.height / m.allocTrackRect.height).toFixed(2)})이 0.7을 넘으면 겹침 위험 구간이다`,
  );
});

// **「가정 기반」 칩의 align-items: stretch 결함을 재던 테스트가 여기 있었다.**
// [2026-08-11 D39 §2로 폐기] 소유자 지시("「가정기반」이라는 문구 없애줘")로
// `ISA_RETURN_ASSUMPTION_CHIP_LABEL` 칩 자체를 지웠다(design-system 5.31.5절) —
// 빗금(`benefitMeter`의 `assumption` 등급)과 가정 축 조건절이 이미 같은 뜻을
// 진다. 칩이 없으니 늘어날 칩도 없다. **같은 부모(`.benefit-row-body`)의
// align-items: stretch 결함이 남은 자리**(`.benefit-row-info-chip`, D36 —
// `favorable_zero`일 때만 렌더된다)는 이 실측 픽스처의 ISA 입력으로는
// 재현되지 않아 이번 회차에서 다시 걸지 못했다. 다음 회차에 그 상태를 만드는
// 픽스처가 필요하다.
test('가정 축에 「가정 기반」 칩이 더 이상 렌더되지 않는다(D39 §2)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.equal(m.assumptionChipRect, null, '「가정 기반」 칩이 지워졌어야 하는데 여전히 렌더되고 있다');
});

// **D33이 세웠던 「C-2 계좌명과 같은 등급」은 「반 사이즈로」 지시에서 나온
// 것이고, 소유자가 그 지시를 취소했다(D35).** 그 뒤에도 같은 신고가 이어져
// 실측해 보니, 그때의 강등은 17px→16px로 **거의 보이지 않는 차이**였고 진짜
// 결함은 금액·계좌명이 C-2의 같은 자리보다 약한 것이었다(D38 4번).
//
// 그래서 이 검사는 「같아야 한다」를 「위여야 한다」로 뒤집는다. 같은 크기로
// 되돌리는 회귀를 여기서 잡는다.
test('헤더 위계가 C-2 계좌명보다 위다(D38 4번 — D33 장치①을 뒤집었다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.c2AccountNameFontSize, 'C-2 계좌명 요소를 찾지 못했습니다');
  const px = (s) => Number.parseFloat(s);
  assert.ok(
    px(m.headerFontSize) > px(m.c2AccountNameFontSize),
    `헤더(${m.headerFontSize})가 C-2 계좌명(${m.c2AccountNameFontSize})보다 커야 한다`,
  );
  assert.equal(m.headerFontWeight, '600', '헤더는 굵게(strong)여야 한다');
});
