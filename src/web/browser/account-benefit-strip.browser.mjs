import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * `AccountBenefitStrip` 폭 재정의(D33, design-system 5.31.1절 · screens.md
 * 5.14.6절) — 실제 렌더 실측.
 *
 * jsdom은 레이아웃을 계산하지 않으므로 "폭이 카드 내용 폭의 50%를 따라가는가",
 * "최소 240px 하한이 좁은 데스크톱에서 실제로 개입하는가", "네 오독 방지
 * 장치가 실제로 화면에 나오는가"는 정적 검사(`ui/account-benefit-strip-width.
 * test.mjs`)로는 볼 수 없다. 이 파일이 실제 Chrome으로 잰다.
 *
 * 뷰포트 넷 — 1440(운영 기준) · 1024(데스크톱 하한, 최소폭 안전판이 개입하는
 * 자리) · 768(태블릿 하한) · 375(모바일, 전체 폭 + 네 장치만으로 방어).
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  await app.page.evaluate(FILL_REQUIRED_FIELDS);
  await app.page.waitFor(`!!document.querySelector('.account-benefit-strip')`);
  await sleep(500);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

/** 위젯·카드·C-2 막대의 실측 치수를 한 번에 뽑는다. */
const MEASURE = `(() => {
  const strip = document.querySelector('.account-benefit-strip');
  const card = document.querySelector('.donut-with-strip');
  const track = document.querySelector('.account-benefit-strip .benefit-meter-track');
  const fill = document.querySelector('.account-benefit-strip .benefit-meter-fill');
  const allocTrack = document.querySelector('.alloc-bar-track');
  const axisCaption = document.querySelector('.benefit-meter-axis-caption');
  const header = document.querySelector('.account-benefit-strip h4');
  const refCaption = document.querySelector('.benefit-strip-ref-caption');
  // C-2(AllocationBar)의 계좌명 — 헤더 위계(장치①)가 낮아졌다면 이것과
  // 같은 폰트 크기·굵기여야 한다(design-system 5.31.1절 "C-2의 계좌명과
  // 같은 등급").
  const c2AccountName = document.querySelector('.allocation-bar-labels .type-body-strong');
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  return {
    stripWidth: rect(strip)?.width ?? null,
    cardWidth: rect(card)?.width ?? null,
    trackWidth: rect(track)?.width ?? null,
    fillWidth: rect(fill)?.width ?? null,
    trackHeight: rect(track)?.height ?? null,
    allocTrackWidth: rect(allocTrack)?.width ?? null,
    axisCaptionText: axisCaption ? axisCaption.textContent : null,
    axisCaptionVisible: axisCaption ? getComputedStyle(axisCaption).display !== 'none' : false,
    headerFontSize: header ? getComputedStyle(header).fontSize : null,
    headerFontWeight: header ? getComputedStyle(header).fontWeight : null,
    c2AccountNameFontSize: c2AccountName ? getComputedStyle(c2AccountName).fontSize : null,
    c2AccountNameFontWeight: c2AccountName ? getComputedStyle(c2AccountName).fontWeight : null,
    refCaptionText: refCaption ? refCaption.textContent : null,
  };
})()`;

async function setViewport(page, width, height = 1000) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await sleep(150);
}

test('1440px(운영 기준) — 폭이 카드 내용 폭의 50%를 따라가고 트랙이 막대로 읽힐 만큼 넓다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.cardWidth > 0, '.donut-with-strip이 렌더되지 않았습니다');
  const expected = Math.max(m.cardWidth * 0.5, 240);
  assert.ok(
    Math.abs(m.stripWidth - expected) <= 2,
    `위젯 폭 ${m.stripWidth}px이 기대값(카드 ${m.cardWidth}px의 50%=${expected}px)과 다릅니다`,
  );
  assert.ok(m.trackWidth > 200, `트랙이 진행바로 보일 만큼 넓지 않습니다(실측 ${m.trackWidth}px, D33 판정 기준 ~300px)`);
  assert.ok(
    m.trackWidth < m.allocTrackWidth,
    `이 트랙(${m.trackWidth}px)이 C-2 막대(${m.allocTrackWidth}px)보다 짧아 시각적으로 종속돼야 한다(D33)`,
  );
});

test('1024px(데스크톱 하한) — 최소 240px 안전판이 실제로 개입한다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1024);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.cardWidth > 0);
  // 카드 폭의 50%가 240px 미만이어야 안전판이 실제로 시험된다(design-system
  // 5.31.1절 실측 — 1024px 뷰포트에서 카드 내용 폭 432px, 50%=216px<240px).
  if (m.cardWidth * 0.5 < 240) {
    assert.ok(
      Math.abs(m.stripWidth - 240) <= 2,
      `카드 50%(${(m.cardWidth * 0.5).toFixed(1)}px)가 240px 미만인데 위젯이 최소값에 고정되지 않았습니다(실측 ${m.stripWidth}px)`,
    );
  }
  assert.ok(m.stripWidth >= 238, `어떤 경우에도 위젯 폭이 최소 240px 아래로 내려가면 안 됩니다(실측 ${m.stripWidth}px)`);
});

test('768px(태블릿 하한) — 데스크톱과 같은 공식이고 옛 고정값(120px)으로 돌아가지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 768);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.stripWidth > 130, `옛 고정값(120px) 근방으로 되돌아간 것으로 보입니다(실측 ${m.stripWidth}px)`);
  const expected = Math.max(m.cardWidth * 0.5, 240);
  assert.ok(Math.abs(m.stripWidth - expected) <= 2, `768px에서도 카드 폭 50%(최소 240px) 공식을 따라야 합니다`);
});

test('375px(모바일) — 전체 폭이고, C-2 막대와 나란히 있어도 네 장치가 서 있다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 375);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.stripWidth > 0 && m.cardWidth > 0);
  assert.ok(m.stripWidth >= m.cardWidth - 2, `모바일에서는 전체 폭이어야 합니다(위젯 ${m.stripWidth}px, 카드 ${m.cardWidth}px)`);
  // 모바일은 이미 전체 폭이라 C-2 막대와 폭이 거의 같다 — 그래서 크기가 아닌
  // 네 장치가 실제로 서 있는지가 여기서 더 중요하다(design-system 5.31.1절
  // "모바일 재검토").
  assert.notEqual(m.headerFontSize, '17px', '헤더가 옛 type-title-s(17px) 위계로 남아 있으면 안 된다(장치①)');
  assert.equal(m.headerFontWeight, '600', '헤더는 굵게(strong)여야 한다');
  assert.ok(m.c2AccountNameFontSize, 'C-2 계좌명 요소를 찾지 못했습니다 — 비교 기준이 없습니다');
  assert.equal(
    m.headerFontSize,
    m.c2AccountNameFontSize,
    `헤더가 C-2 계좌명과 같은 등급이어야 한다(헤더 ${m.headerFontSize} vs C-2 ${m.c2AccountNameFontSize})`,
  );
  assert.equal(m.headerFontWeight, m.c2AccountNameFontWeight, '헤더와 C-2 계좌명의 굵기가 같아야 한다');
  assert.ok(m.refCaptionText.includes('새로 계산한 값이 아닙니다'), '장치②(새 계산이 아님을 명시하는 캡션)가 모바일에도 있어야 한다');
  assert.ok(m.trackHeight <= 8, `트랙 굵기(장치④)가 모바일에서도 6px 근방을 유지해야 합니다(실측 ${m.trackHeight}px)`);
});

test('막대 아래 축 캡션(장치③)이 aria-label과 같은 값을 화면에도 보이는 글자로 낸다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await setViewport(page, 1440);
  const m = await page.evaluate(MEASURE);
  assert.ok(m.axisCaptionText, '막대 아래 축 캡션이 렌더되지 않았습니다');
  assert.match(m.axisCaptionText, /세액공제 인정 한도 대비 \d+%/, `축 캡션 문구가 기대 형식과 다릅니다: "${m.axisCaptionText}"`);
  assert.ok(m.axisCaptionVisible, '축 캡션이 화면에서 숨겨져 있으면 안 된다(aria-label 전용이면 안 된다)');

  const ariaLabel = await page.evaluate(
    `document.querySelector('.account-benefit-strip .benefit-row[aria-label]')?.getAttribute('aria-label')`,
  );
  assert.ok(ariaLabel, 'aria-label을 가진 행을 찾지 못했습니다');
  assert.ok(
    ariaLabel.includes(m.axisCaptionText),
    `aria-label("${ariaLabel}")이 화면에 보이는 축 캡션("${m.axisCaptionText}")과 같은 값을 담아야 한다`,
  );
});
