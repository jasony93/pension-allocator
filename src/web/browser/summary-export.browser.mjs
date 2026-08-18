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

/**
 * [2026-08-18, 관리자 지시(6차) 2번, D75] `form`을 실어(생년월일·총급여액·
 * 월 납입액) PNG를 만든다 — 위 `FIXTURE`와 같은 plan/scenario를 쓰지만
 * `buildSummaryData`의 4번째 인자로 `form`을 넘긴다. 이 값이 실제 래스터라이즈
 * 파이프라인(SVG → `Image` → `<canvas>` → `toDataURL`)을 무사히 통과하는지
 * (더 넓어진 콘텐츠가 PNG 자체를 깨뜨리지 않는지) 여기서 확인한다.
 */
const FIXTURE_WITH_INPUTS = `(async () => {
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
  const form = {
    birthDate: '1980-01-01',
    currentSalary: '6000',
    monthlyCapacity: '50',
    isaReturnEnabled: true,
    isaReturnRatePercent: '5.5',
    isaIncomeCharacter: 'interest_dividend',
    isaSettlementYears: '3',
  };
  const data = buildSummaryData(plan, scenario, null, form);
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

/**
 * [신설, 2026-08-18, 관리자 지시(6차) 2번, D75] 입력값 블록(도넛 조각 라벨 +
 * 도넛 오른쪽 입력값)이 붙은 더 넓은 SVG도 여전히 유효한 PNG로 래스터라이즈
 * 된다 — 바이트를 다시 실측한다(시그니처·크기).
 */
test('[실측, D75] 입력값 블록이 실린 PNG도 실제로 열리는 파일이다(시그니처·크기 재확인)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  const dataUrl = await page.evaluate(FIXTURE_WITH_INPUTS);
  const header = readPngHeader(dataUrl);
  assert.ok(header.width > 0 && header.height > 0, `입력값 블록이 실린 PNG 크기가 0입니다: ${JSON.stringify(header)}`);
  assert.ok(header.byteLength > 1000, `입력값 블록이 실린 PNG가 너무 작습니다(${header.byteLength}바이트) — 빈 이미지일 위험`);
});

/**
 * [신설, D75] **판별력 확인.** `FIXTURE`(입력값 없음)와
 * `FIXTURE_WITH_INPUTS`(여섯 줄 입력값)를 **같은 실행에서** 비교한다.
 *
 * **높이가 아니라 바이트 길이를 비교한다.** 이 픽스처(계좌 셋 모두 배분,
 * 미배분 없음)에서는 범례가 3줄이라 도넛+범례 열이 이미 입력값 6줄
 * 열보다 세로로 길다(직접 계산해 확인했다 — 범례 시작 y가 468, 3줄이면
 * 바닥 624, 반면 입력값 열은 제목+6줄이면 바닥 434) — 그래서 **전체 SVG
 * 높이는 입력값 유무와 무관하게 같다.** 그래도 입력값 블록이 실제로
 * 그려졌다면 화소 내용(도넛 오른쪽에 글자가 더 생긴다)이 달라지므로,
 * PNG로 구운 뒤의 **바이트 길이**는 달라야 한다 — 이 검사가 "항상 통과하는
 * 검사"가 아니라 실제로 콘텐츠 차이를 구분한다는 것을 이 비교로 증명한다.
 * (`buildSummaryData`에 `form`을 넘기지 않으면 `inputs`가 빈 배열이라
 * `inputsBlockMarkup`이 아무것도 그리지 않는다 — `ui/summary-image.js`의
 * `inputsBlockMarkup` 참고.)
 */
test('[실측, D75, 판별력 확인] 입력값 블록이 있는 PNG가 없는 PNG와 바이트 길이가 다르다(같은 plan/scenario, 같은 크기)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme', 'light')`);
  const withoutInputs = readPngHeader(await page.evaluate(FIXTURE));
  const withInputs = readPngHeader(await page.evaluate(FIXTURE_WITH_INPUTS));
  assert.equal(withoutInputs.width, withInputs.width, 'CANVAS_WIDTH는 입력값 블록 유무와 무관하게 고정이어야 한다');
  assert.equal(withoutInputs.height, withInputs.height, '이 픽스처에서는 도넛+범례 열이 이미 입력값 열보다 길어 SVG 전체 높이가 같아야 한다(위 계산 참고)');
  assert.notEqual(
    withInputs.byteLength,
    withoutInputs.byteLength,
    `입력값 블록이 있는 PNG(${withInputs.byteLength}바이트)와 없는 PNG(${withoutInputs.byteLength}바이트)의 바이트 길이가 같습니다 — 블록이 실제로 그려지지 않았을 위험`,
  );
});
