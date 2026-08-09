import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  creditHeadroomCaption,
  contributionRemainingCaption,
  isaTaxFreeCaption,
  fillOrderFactMessage,
  fillOrderDecisionMessage,
  donutSingleSliceCaption,
} from './copy.js';

/**
 * 문구 규약의 정적 검사 — `design-system.md` 7.1절이 확정한 것:
 * **"잔여 한도"를 수식어 없이 쓰지 않는다.**
 *
 * 이 제품에는 성격이 다른 한도가 둘 있다. 넘을 수 없는 **납입 잔여 한도**
 * (`contribution_limit_remaining_krw`)와, **넘을 수 있는** 세액공제 인정 여지
 * (`credit_eligible_limit_remaining_krw` · `pension_combined_credit_remaining_krw`)다.
 * 후자에 "한도"라고 이름을 붙이면 개정안 청년 우대에서 배분액이 그 값을 넘는
 * 순간 화면이 사실과 어긋난다 — 4단계가 잡은 M1과 같은 뿌리다.
 *
 * 사람이 매번 기억하는 대신 테스트가 잡는다.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

/** 주석을 걷어낸 소스 — 규약은 화면에 나가는 문구에 걸린다. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('no screen string says "잔여 한도" without saying which limit it is', () => {
  const offenders = [];
  for (const file of walk(here)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const line of code.split('\n')) {
      let index = line.indexOf('잔여 한도');
      while (index !== -1) {
        const qualified = line.slice(Math.max(0, index - 3), index) === '납입 ';
        if (!qualified) offenders.push({ file: path.relative(here, file), line: line.trim().slice(0, 100) });
        index = line.indexOf('잔여 한도', index + 1);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `수식어 없는 "잔여 한도"가 남아 있습니다:\n${offenders.map((o) => `  ${o.file}: ${o.line}`).join('\n')}`,
  );
});

test('the credit headroom caption never calls itself a limit', () => {
  // 이 값은 배분 상한이 아니다(계약 5.3절). 이름에 "한도"가 들어가면 그 사실이 무너진다.
  const caption = creditHeadroomCaption(9000000);
  assert.ok(!caption.includes('한도'), caption);
  assert.ok(caption.includes('세액공제가 더 인정될 수 있는 금액'));
  assert.ok(caption.includes('(연금저축·IRP 합산)'), '계좌마다 적으면 사용자가 둘을 더한다');
});

test('the contribution caption names the limit it means, and the ISA caption stays a limit', () => {
  assert.ok(contributionRemainingCaption(18000000, 0.5).startsWith('납입 잔여 한도'));
  // 비과세 한도는 진짜 한도이므로 그렇게 부른다. 다만 절감액이 아니라는 것을 문장이 말한다.
  const isa = isaTaxFreeCaption(4000000);
  assert.ok(isa.includes('비과세 한도'));
  assert.ok(isa.includes('위 절세액에 들어 있지 않습니다'));
});

// ---------------------------------------------------------------------------
// 왜 이 순서로 채웠는가 — 사실과 제품 판단의 분리 (계약 0.4절, 헌장 문구 정책)
//
// 소유자가 화면을 보고 "왜 IRP를 먼저 채우는지 알려달라"고 물었다. 답을 화면에
// 적기로 했으므로, **무엇이 법령이 정한 것이고 무엇이 이 계산기가 정한 것인지**
// 문장이 스스로 갈라야 한다. 근거 규칙의 `product_note`가 "어느 계좌를 먼저
// 채울지는 이 규칙이 정하지 않는다"고 명시하는 이상, 둘을 뭉뚱그리면 제품 결정을
// 세법 결론으로 파는 것이 된다.
// ---------------------------------------------------------------------------

const FACT = fillOrderFactMessage('annuity_savings', 'retirement_pension');
const DECISION = fillOrderDecisionMessage('annuity_savings');

test('the fact clause states the tax equality and the withdrawal restriction, and stops there', () => {
  assert.match(FACT, /세액공제액은 같습니다/);
  assert.match(FACT, /중도인출/);
  assert.ok(!/먼저 채(웁|운)/.test(FACT), '제품이 내린 결정이 사실 절에 섞이면 세법이 순서를 정한 것처럼 읽힌다');
});

test('the product clause owns the decision and does not dress it as law', () => {
  assert.match(DECISION, /이 계산기/);
  assert.match(DECISION, /세법이 정한 순서가 아니라/);
  assert.ok(!/법령이 열거/.test(DECISION), '법령 사실은 사실 절의 몫이다');
});

test('neither clause carries a number — no tax figure, no year, no amount', () => {
  // 세법 수치를 화면 코드에 두지 않는다(제품 원칙). 이 문장들이 말하는 것은
  // "같다"와 "제한이 있다/없다"뿐이라 애초에 숫자가 필요 없다.
  assert.ok(!/\d/.test(FACT), `사실 절에 숫자가 들어 있다: ${FACT}`);
  assert.ok(!/\d/.test(DECISION), `제품 판단 절에 숫자가 들어 있다: ${DECISION}`);
});

test('the clauses take their account names from the engine, so swapping the order swaps the sentence', () => {
  const flipped = fillOrderFactMessage('retirement_pension', 'annuity_savings');
  assert.notEqual(flipped, FACT);
  assert.match(fillOrderDecisionMessage('retirement_pension'), /IRP를 먼저 채웁니다/);
  assert.match(DECISION, /연금저축을 먼저 채웁니다/);
});

test('the fill-order copy hardcodes no account name — the ruleset decides which side is which', () => {
  const source = stripComments(readFileSync(path.join(here, 'copy.js'), 'utf8'));
  const block = source.slice(source.indexOf('export function fillOrderFactMessage'));
  for (const literal of ["'IRP'", "'연금저축'", "'ISA'", '"IRP"', '"연금저축"']) {
    assert.ok(!block.includes(literal), `계좌 이름을 문장에 박으면 룰셋이 바뀔 때 화면만 틀린다: ${literal}`);
  }
});

test('the fill-order copy uses none of the vocabulary the charter forbids', () => {
  for (const banned of ['세무 상담', '세무 자문', '세무 대리', '세무 진단', '컨설팅', '권해', '추천합니다', '하세요', '넣으세요', '손해', '위험', '!']) {
    assert.ok(!FACT.includes(banned), `사실 절: "${banned}"`);
    assert.ok(!DECISION.includes(banned), `제품 판단 절: "${banned}"`);
  }
});

test('a single-slice caption takes the right particle for the account it names', () => {
  // 실측에서 화면에 `전액이 연금저축로 갑니다`가 그대로 떠 있었다 — 받침을
  // 글자에서 계산하지 않고 계좌마다 표로 두어 고쳤다.
  assert.match(donutSingleSliceCaption('annuity_savings'), /연금저축으로 갑니다/);
  assert.match(donutSingleSliceCaption('retirement_pension'), /IRP로 갑니다/);
  assert.match(donutSingleSliceCaption('isa'), /ISA로 갑니다/);
});

test('the donut centre reads the engine total instead of adding up the slices', () => {
  // 조각을 더하면 **미배분 조각까지** 더해져 `월 배분`이라는 라벨과 값이
  // 어긋난다. 계약의 `total_allocated_monthly_krw`가 이미 그 값을 준다.
  const charts = stripComments(readFileSync(path.join(here, 'ui', 'charts.js'), 'utf8'));
  const centre = charts.slice(charts.indexOf("class: 'donut-center'"), charts.indexOf("class: 'donut-center'") + 400);
  assert.match(centre, /totalAllocatedMonthlyKrw/);
  const panel = stripComments(readFileSync(path.join(here, 'ui', 'result-panel.js'), 'utf8'));
  assert.match(panel, /totalAllocatedMonthlyKrw: plan\.total_allocated_monthly_krw/);
});
