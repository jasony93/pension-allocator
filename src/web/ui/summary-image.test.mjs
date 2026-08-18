import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SUMMARY_EXPORT_COLORS,
  buildSummarySvgMarkup,
  svgMarkupToDataUri,
  rasterizeSvgToPngDataUrl,
} from './summary-image.js';
import { buildSummaryData } from './summary-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const CSS = readFileSync(path.join(webRoot, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function rootTokenValue(name) {
  const rootBlock = /(?:^|\n)\s*:root\s*\{([\s\S]*?)\n\}/.exec(CSS);
  if (!rootBlock) return null;
  const re = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`);
  const m = re.exec(rootBlock[1]);
  return m ? m[1].toLowerCase() : null;
}

test('D74 — PNG 내보내기 색 상수가 styles.css의 라이트(:root) 토큰과 어긋나지 않는다', () => {
  const pairs = [
    ['surfaceRaised', '--surface-raised'],
    ['surfaceOverlay', '--surface-overlay'],
    ['borderSubtle', '--border-subtle'],
    ['textPrimary', '--text-primary'],
    ['textSecondary', '--text-secondary'],
    ['dataPension', '--data-pension'],
    ['dataIrp', '--data-irp'],
    ['dataIsa', '--data-isa'],
    ['dataUnallocated', '--data-unallocated'],
  ];
  for (const [key, token] of pairs) {
    const cssValue = rootTokenValue(token);
    assert.ok(cssValue, `styles.css :root에서 ${token}을 읽지 못했습니다`);
    assert.equal(
      SUMMARY_EXPORT_COLORS[key].toLowerCase(),
      cssValue,
      `SUMMARY_EXPORT_COLORS.${key}(${SUMMARY_EXPORT_COLORS[key]})가 styles.css의 ${token}(${cssValue})와 다릅니다 — 값이 바뀌면 이 상수도 함께 고쳐야 한다`,
    );
  }
});

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

function plan() {
  return {
    is_baseline: true,
    plan_id: 'max_tax_credit',
    allocations: [
      { account: 'annuity_savings', monthly_krw: 100000, annual_krw: 1200000 },
      { account: 'retirement_pension', monthly_krw: 50000, annual_krw: 600000 },
      { account: 'isa', monthly_krw: 200000, annual_krw: 2400000 },
    ],
    unallocated_annual_krw: 600000,
    unallocated_monthly_krw: 50000,
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
}

test('buildSummarySvgMarkup — foreignObject를 쓰지 않는다(D74)', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  assert.ok(!svg.includes('foreignObject'), 'SVG에 foreignObject가 있습니다 — 캔버스 오염 위험(D74가 금지)');
});

test('buildSummarySvgMarkup — CSS 커스텀 프로퍼티(var(--...))를 참조하지 않는다 — 독립 문서라 상속되지 않는다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  assert.ok(!svg.includes('var(--'), 'SVG가 CSS 변수를 참조합니다 — 별도 문서(Image.src)에서는 풀리지 않습니다');
});

test('buildSummarySvgMarkup — 완결된 <svg> 문서이고 width/height가 양수다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
  const width = Number(/width="(\d+)"/.exec(svg)[1]);
  const height = Number(/height="(\d+)"/.exec(svg)[1]);
  assert.ok(width > 0 && height > 0, `width/height가 0 이하입니다: ${width}x${height}`);
});

test('buildSummarySvgMarkup — 요약 다섯 항목(계좌명·금액·총 절세액 라벨)이 문자열에 실제로 있다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  assert.ok(svg.includes('연금저축'), '계좌 이름이 없습니다');
  assert.ok(svg.includes('1,200,000원'), '계좌별 연 환산 금액이 없습니다');
  assert.ok(svg.includes('6,000,000원'), '계좌별 납입 잔여 한도가 없습니다');
  assert.ok(svg.includes('이 배분으로 계산된 세액공제액'), '총 절세액 라벨이 없습니다');
  assert.ok(svg.includes('1,485,000원'), '총 절세액 값이 없습니다');
});

test('buildSummarySvgMarkup — 가정 성분이 있으면 조건절이 SVG 문자열 안에 함께 있다(D74·D38)', () => {
  const p = plan();
  p.headline_composite_total = {
    bound_code: 'range',
    point_estimate_krw: null,
    lower_bound_krw: 1485000,
    upper_bound_krw: 1785000,
    includes_assumption_component: true,
    determined_component_krw: 1485000,
    assumption_component_krw: 300000,
    assumption_settlement_years: 3,
    assumption_settlement_years_source: 'ruleset_min_contract_years',
  };
  const svg = buildSummarySvgMarkup(buildSummaryData(p, scenario, 0.055));
  assert.match(svg, /연 5\.5% 가정/, '가정 성분이 있는데 조건절이 SVG에 없습니다');
});

test('form을 넘기지 않으면(옛 D74 호출부) 여전히 원시 입력을 나타내는 문자열이 SVG에 없다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  for (const forbidden of ['생년월일', '총급여', 'birth', 'salary']) {
    assert.ok(!svg.toLowerCase().includes(forbidden.toLowerCase()), `SVG에 금지어 "${forbidden}"가 있습니다`);
  }
});

// ---------------------------------------------------------------------------
// [2026-08-18, 관리자 지시(6차) 2·3번, D75] 뒤집힌 검사 — 이제 `form`을
// 넘기면 도넛 오른쪽 입력값 블록에 실제로 값이 실려야 하고, 입력하지 않은
// 항목은 SVG 안 어디에도 없어야 한다.
// ---------------------------------------------------------------------------

function filledForm(overrides = {}) {
  return {
    birthDate: '1980-01-01',
    currentSalary: '6000',
    monthlyCapacity: '50',
    isaReturnEnabled: false,
    isaReturnRatePercent: '',
    isaIncomeCharacter: null,
    isaSettlementYears: '',
    ...overrides,
  };
}

test('D75 — form을 넘기면 생년월일·총급여액·월 납입액이 SVG 문자열에 실제로 있다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null, filledForm()));
  assert.ok(svg.includes('입력값'), 'D75 입력값 블록 제목이 없습니다');
  assert.ok(svg.includes('1980-01-01'), '생년월일 값이 SVG에 없습니다');
  assert.ok(svg.includes('6,000만원'), '총급여액 값이 SVG에 없습니다');
  assert.ok(svg.includes('월 50만원'), '월 납입액 값이 SVG에 없습니다');
});

test('D75 — ISA 예상 수익률을 켜지 않으면 수익률·수익 성격·정산 기간 줄이 SVG에 없다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null, filledForm()));
  assert.ok(!svg.includes('수익 성격'), 'ISA 수익률을 안 켰는데 수익 성격 줄이 있습니다');
  assert.ok(!svg.includes('정산 기간'), 'ISA 수익률을 안 켰는데 정산 기간 줄이 있습니다');
});

test('D75 — ISA 예상 수익률을 켜고 세 값을 채우면 SVG에 셋 다 있다', () => {
  const svg = buildSummarySvgMarkup(
    buildSummaryData(
      plan(),
      scenario,
      null,
      filledForm({ isaReturnEnabled: true, isaReturnRatePercent: '5.5', isaIncomeCharacter: 'interest_dividend', isaSettlementYears: '3' }),
    ),
  );
  assert.ok(svg.includes('연 5.5%'), 'ISA 예상 수익률 값이 SVG에 없습니다');
  assert.ok(svg.includes('이자·배당처럼 받는 형태'), 'ISA 수익 성격 값이 SVG에 없습니다');
  assert.ok(svg.includes('3년'), 'ISA 정산 기간 값이 SVG에 없습니다');
});

test('D75 — 총급여액을 비우면(생년월일·월 납입액만 채움) 총급여액 줄이 SVG에 없다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null, filledForm({ currentSalary: '' })));
  assert.ok(svg.includes('1980-01-01'), '생년월일은 여전히 있어야 합니다');
  assert.ok(!svg.includes('총급여액'), '총급여액을 비웠는데 그 라벨이 SVG에 남아 있습니다');
});

test('D75 — 도넛 조각 위에 계좌 이름 + 배분 비율(연금저축 25%·IRP 13%·ISA 50%·미배분 13%)이 그려진다', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  // `plan()` 픽스처 — annuity_savings 1,200,000 · retirement_pension 600,000 ·
  // isa 2,400,000 · unallocated 600,000, 합 4,800,000. `formatPercent`(반올림,
  // `toFixed(0)`)로 25% / 13% / 50% / 13%가 나온다(node -e로 직접 확인했다 —
  // (0.125*100).toFixed(0) === '13').
  assert.ok(svg.includes('연금저축'), '연금저축 이름이 SVG에 없습니다');
  assert.ok(svg.includes('25%'), '연금저축 조각 비율(25%)이 SVG에 없습니다');
  assert.ok(svg.includes('50%'), 'ISA 조각 비율(50%)이 SVG에 없습니다');
  const thirteenPctCount = (svg.match(/13%/g) ?? []).length;
  assert.ok(thirteenPctCount >= 2, `IRP·미배분 두 조각(13%)이 모두 있어야 하는데 ${thirteenPctCount}개만 찾았습니다`);
});

test('rasterizeSvgToPngDataUrl — 브라우저 환경(document/Image)이 없으면 조용히 실패하지 않고 명시로 reject한다', async () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  await assert.rejects(() => rasterizeSvgToPngDataUrl(svg, { width: 100, height: 100 }), /summary_image_no_browser_environment/);
});

test('svgMarkupToDataUri — 한글이 섞인 SVG도 예외 없이 인코딩된다(btoa였다면 여기서 깨졌을 것이다)', () => {
  const svg = buildSummarySvgMarkup(buildSummaryData(plan(), scenario, null));
  const uri = svgMarkupToDataUri(svg);
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.equal(decodeURIComponent(uri.slice('data:image/svg+xml;charset=utf-8,'.length)), svg);
});
