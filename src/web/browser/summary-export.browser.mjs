import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep } from './harness.mjs';

/**
 * PNG 요약 내보내기(관리자 지시 6번, D74) — 실제 Chrome의 `Image`·`<canvas>`로
 * SVG를 래스터라이즈하는 경로는 jsdom도 없는 `node --test`로는 잴 수 없다
 * (`summary-image.test.mjs`는 "브라우저 환경이 없으면 명시로 실패한다"만
 * 확인한다). 여기서 **실제로 열리는 PNG 파일인지**를 실측한다 —
 * `exportSummaryPng`가 낸 data URL의 base64를 Node에서 디코드해 PNG
 * 시그니처(8바이트)와 IHDR의 width/height를 직접 읽는다.
 *
 * **테마 — 라이트로 고정된 한 가지 모양.** `summary-image.js`가 CSS 변수를
 * 전혀 읽지 않고 리터럴 hex만 쓰므로, 페이지가 라이트든 다크든 결과가
 * 달라지지 않아야 한다(그 근거는 `summary-image.js` 머리말). 라이트·다크
 * 각각에서 PNG를 만들어 **둘 다 유효한 PNG이고 크기가 같다**는 것을 실측해
 * "어느 테마에서든 읽히는 한 가지 모양"이라는 D74의 요구를 확인한다.
 */

let app;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  await sleep(200);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

/** `summary-data.js`·`summary-image.js`를 UI 없이 직접 불러 쓴다 — PNG
 * 래스터라이즈 자체는 store·엔진과 무관한 순수 경로이므로, 실제 결과 화면을
 * 몰지 않아도 같은 코드 경로(같은 모듈)를 실측할 수 있다. */
const FIXTURE = `(async () => {
  const { buildSummaryData } = await import('./ui/summary-data.js');
  const { exportSummaryPng } = await import('./ui/summary-image.js');
  const scenario = {
    ruleset: { tax_year: 2026 },
    account_eligibility: [
      { account: 'annuity_savings', eligible: true },
      { account: 'retirement_pension', eligible: true },
      { account: 'isa', eligible: true },
    ],
    limits: {
      by_account: [
        { account: 'annuity_savings', contribution_limit_remaining_krw: 6000000 },
        { account: 'retirement_pension', contribution_limit_remaining_krw: 3000000 },
        { account: 'isa', contribution_limit_remaining_krw: 20000000 },
      ],
    },
  };
  const plan = {
    is_baseline: true,
    plan_id: 'max_tax_credit',
    allocations: [
      { account: 'annuity_savings', monthly_krw: 100000, annual_krw: 1200000 },
      { account: 'retirement_pension', monthly_krw: 50000, annual_krw: 600000 },
      { account: 'isa', monthly_krw: 200000, annual_krw: 2400000 },
    ],
    unallocated_annual_krw: 0,
    unallocated_monthly_krw: 0,
    total_allocated_monthly_krw: 350000,
    total_allocated_annual_krw: 4200000,
    headline_composite_total: {
      bound_code: 'point',
      point_estimate_krw: 1485000,
      lower_bound_krw: 1485000,
      upper_bound_krw: 1485000,
      includes_assumption_component: false,
      determined_component_krw: 1485000,
      assumption_component_krw: null,
      assumption_settlement_years: null,
    },
  };
  const data = buildSummaryData(plan, scenario, null);
  return exportSummaryPng(data);
})()`;

/** PNG 시그니처(8바이트) + IHDR(width/height, big-endian)를 직접 읽는다.
 * 외부 이미지 라이브러리를 새로 들이지 않는다 — PNG 헤더 스펙은 고정이다. */
function readPngHeader(dataUrl) {
  const prefix = 'data:image/png;base64,';
  assert.ok(dataUrl.startsWith(prefix), `PNG data URL 접두어가 아닙니다: ${dataUrl.slice(0, 40)}`);
  const buf = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i++) {
    assert.equal(buf[i], signature[i], `PNG 시그니처가 어긋납니다 (byte ${i})`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { byteLength: buf.length, width, height };
}

test('[실측, D74] 라이트 테마 — PNG가 실제로 열리는 파일이다(시그니처·크기 확인)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  const dataUrl = await page.evaluate(FIXTURE);
  const header = readPngHeader(dataUrl);
  assert.ok(header.width > 0 && header.height > 0, `PNG 크기가 0입니다: ${JSON.stringify(header)}`);
  assert.ok(header.byteLength > 1000, `PNG가 너무 작습니다(${header.byteLength}바이트) — 빈 이미지일 위험`);
});

test('[실측, D74] 다크 테마에서 열어도 같은 PNG(같은 크기)가 나온다 — 내보내기는 뷰어 테마와 무관한 한 가지 모양이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'dark')`);
  const dataUrl = await page.evaluate(FIXTURE);
  const header = readPngHeader(dataUrl);
  assert.ok(header.width > 0 && header.height > 0, `다크 테마에서 PNG 크기가 0입니다: ${JSON.stringify(header)}`);

  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  const lightDataUrl = await page.evaluate(FIXTURE);
  const lightHeader = readPngHeader(lightDataUrl);
  assert.equal(header.width, lightHeader.width, '다크·라이트에서 PNG 폭이 다릅니다');
  assert.equal(header.height, lightHeader.height, '다크·라이트에서 PNG 높이가 다릅니다');
});

test('[실측, D74] PNG가 SVG 문자열에 없던 foreignObject·CSS 변수 문제로 손상되지 않는다 — 디코드 즉시 실패 없이 헤더를 읽는다', { skip: skipWithoutChrome }, async () => {
  // 위 두 검사가 이미 헤더를 읽지만, 이 검사는 실패 시 메시지를 더 구체적으로
  // 남긴다 — `Image.onerror`(SVG 파싱 실패)나 `canvas.toDataURL`의
  // `SecurityError`(캔버스 오염)가 나면 `exportSummaryPng` 자체가 reject되어
  // 이 지점에서 예외로 드러난다.
  const { page } = app;
  await assert.doesNotReject(async () => {
    const dataUrl = await page.evaluate(FIXTURE);
    readPngHeader(dataUrl);
  });
});
