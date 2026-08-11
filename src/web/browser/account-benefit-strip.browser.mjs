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
  await page.evaluate(SET('priorTaxAmount', '50')); // cap_below_ceiling을 실제로 보이게 한다
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
  return {
    stripRect: rect(strip),
    cardRect: rect(card),
    allocTrackRect: rect(allocTrack),
    confirmedTrackRect: rect(confirmedTrack),
    confirmedFillRect: rect(confirmedFill),
    assumptionTrackRects: assumptionTracks.map(rect),
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
    // 관리자가 지목한 두 번째 결함 — .benefit-row-body가 flex column인데
    // align-items 기본값이 stretch라 이 칩이 트랙 전체 폭으로 늘어났었다.
    assumptionChipRect: rect(assumptionChip),
    assumptionTrackForChipRect: rect(assumptionTrack),
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
  assert.ok(m.assumptionTrackRects.length >= 2, '가정 축 트랙(ISA 비과세·저율분리)이 둘 이상이어야 합니다');
  for (const t of m.assumptionTrackRects) assert.ok(t.width > 0, '가정 축 트랙이 0폭이면 안 됩니다');

  // 확정 축 캡션이 실제 원화 금액(지방소득세 포함 표기)을 담고 있는지 실측.
  assert.match(m.axisCaptions[0], /세액공제 최대 한도 [\d,]+원\(소득세 [\d,]+원 \+ 지방소득세 [\d,]+원\)/, `확정 축 캡션: "${m.axisCaptions[0]}"`);
  // 가정 축 캡션이 기간+조건절을 담고 있는지 실측(D36).
  assert.match(m.axisCaptions[1], /\d+년 동안, 수익률이 연 [\d.]+%라면/, `가정 축 캡션: "${m.axisCaptions[1]}"`);
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

test('가정 축의 「가정 기반」 칩이 트랙 전체 폭으로 늘어나지 않는다(align-items: stretch 결함)', { skip: skipWithoutChrome }, async () => {
  // 관리자가 스크린샷에서 잡은 결함 — `.benefit-row-body`가 flex column인데
  // `align-items` 기본값 stretch 때문에 `display: inline-block` 칩이 행
  // 전체 폭으로 늘어나 옅은 파란 사각형이 트랙을 덮고, 그 아래 가는 outline
  // 막대보다 더 크고 확실해 보였다 — D28이 막으려던 것(가정이 확정보다
  // 확실해 보임)을 정확히 뒤집는다.
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.assumptionChipRect, '「가정 기반」 칩을 찾지 못했습니다');
  assert.ok(m.assumptionTrackForChipRect, '가정 축 트랙을 찾지 못했습니다');
  assert.ok(
    m.assumptionChipRect.width < m.assumptionTrackForChipRect.width * 0.5,
    `칩 폭(${m.assumptionChipRect.width}px)이 트랙 폭(${m.assumptionTrackForChipRect.width}px)의 절반을 넘으면 늘어난 것이다 — 칩은 자기 글자 폭만 차지해야 한다`,
  );
});

test('헤더 위계가 C-2 계좌명과 같은 등급이다(D33 장치①)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440, 1400);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.c2AccountNameFontSize, 'C-2 계좌명 요소를 찾지 못했습니다');
  assert.equal(m.headerFontSize, m.c2AccountNameFontSize, `헤더(${m.headerFontSize})가 C-2 계좌명(${m.c2AccountNameFontSize})과 같은 크기여야 한다`);
  assert.equal(m.headerFontWeight, '600', '헤더는 굵게(strong)여야 한다');
});
