import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  creditHeadroomExceededMessage,
  contributionRemainingCaption,
  isaTaxFreeCaption,
  fillOrderFactMessage,
  fillOrderDecisionMessage,
  donutSingleSliceCaption,
  PLAN_LABEL,
  unallocatedBreakdownMessage,
  pensionWithoutCreditMessage,
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

test('the credit headroom message never calls itself a limit, and only speaks when the allocation exceeds it', () => {
  // 이 값은 배분 상한이 아니다(계약 5.3절). "한도"라는 이름이 들어가면 그 사실이 무너진다.
  // 소유자 지시로 "세액공제가 더 인정될 수 있는 금액 …" 단독 캡션은 없앴다 — 배분
  // 전 잔여 여지를 배분 결과 옆에 나란히 두면 이미 다 쓴 한도가 남은 것처럼 읽힌다.
  // 남는 자리는 배분액이 이 여지를 **넘는** 예외뿐이고, 그 경우에도 "한도"라고
  // 부르지 않는다.
  const message = creditHeadroomExceededMessage(9000000);
  assert.ok(!message.includes('한도'), message);
  assert.ok(message.includes('세액공제 인정 여지'));
  assert.ok(message.includes('(연금저축·IRP 합산)'), '계좌마다 적으면 사용자가 둘을 더한다');
  assert.ok(message.includes('넘습니다'), '이 문장은 초과 사실을 스스로 담아야 한다 — 앞줄이 사라졌기 때문이다');
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

test('the donut centre is the sum of all four slices, not just the three accounts (7.0.0)', () => {
  // 6.0.0까지는 `total_allocated_monthly_krw`(계좌 셋의 합)만 썼다 — 도넛이
  // 실제로 그리는 네 조각(계좌 셋 + 미배분) 중 하나가 가운데 값에서 빠져,
  // 100% 배분이 아닌 배분에서는 가운데 값이 조각들의 합과 어긋났다. 월 250만원을
  // 넣었는데 가운데가 `2,499,999원`으로 뜨던 신고의 뿌리였다(engine-interface.md
  // 0.12·10절 — "도넛 가운데의 「월 배분 총액」은 네 조각의 합이다"). 지금은
  // `result-panel.js`가 `total_allocated_monthly_krw + unallocated_monthly_krw`를
  // 한 번만 더해 넘기고, `charts.js`는 그 값을 그대로 찍는다 — 두 곳에서
  // 더하지 않는다.
  const charts = stripComments(readFileSync(path.join(here, 'ui', 'charts.js'), 'utf8'));
  const centre = charts.slice(charts.indexOf("class: 'donut-center'"), charts.indexOf("class: 'donut-center'") + 400);
  assert.match(centre, /totalAllocatedMonthlyKrw/);
  const panel = stripComments(readFileSync(path.join(here, 'ui', 'result-panel.js'), 'utf8'));
  assert.match(
    panel,
    /totalAllocatedMonthlyKrw: plan\.total_allocated_monthly_krw \+ plan\.unallocated_monthly_krw/,
  );
});

// ---------------------------------------------------------------------------
// 이번 개정으로 늘어난 문구 (screens.md 3.7~3.11 · 4.8절)
//
// 화면이 새로 말하게 된 것이 많고, 그중 둘은 헌장이 가장 조심하는 자리에 있다 —
// **개인의 세법상 지위를 단정하지 않는가**와 **출처 없는 숫자를 말하지 않는가**.
// 사람이 매번 기억하는 대신 여기서 고정한다.
// ---------------------------------------------------------------------------

import {
  BOUNDED_AMOUNT_PREFIX,
  capReducedNote,
  CAP_CARRYOVER_NOTE,
  TAX_CAP_ESTIMATE_NOTE,
  BIRTH_DATE_HELP,
  YOUTH_DECLARED_RANGE_NOTE,
  YOUTH_AGE_UNDETERMINED_LINE,
  YOUTH_DECLARE_LABEL,
  ANNUITY_STARTED_HORIZON_NOTE,
  noticeMessage,
  assumptionMessage,
  warningMessage,
  comparisonNoteMessage,
  exclusionReasonMessage,
} from './copy.js';
// 4단계 게이트4 재소집(qa-report.md 11.2절) — 코드 레지스트리는 `src/engine/
// constants.mjs`가 "단일 진실 원천"이다. 아래 커버리지 테스트가 이걸 직접
// import해서 전건을 돈다(11.4절 R6) — 손으로 옮겨 적은 부분집합이 다시
// 생기지 않게 한다.
import { NOTICE, ASSUMPTION, WARNING, COMPARISON_NOTE } from '../engine/constants.mjs';

// **직전 과세연도 결정세액의 라벨·효과 캡션을 검증하던 테스트가 여기 있었다**
// (D39로 폐기). 그 입력·문구가 전부 없어졌다. `SourceGuide`(「이 값을 어디서
// 찾나요」)를 검증하던 테스트도 함께 사라졌다 — 유일한 용례가 없어졌다.

test('the bounded headline uses 최대 and nothing else as a hedge', () => {
  // `최대`는 ISA 구간 표기에서만 쓰는 유일한 완화어다. `약`·`예상`과 섞어 쓰지 않는다.
  assert.equal(BOUNDED_AMOUNT_PREFIX, '최대');
  for (const banned of ['약', '예상']) {
    assert.ok(!BOUNDED_AMOUNT_PREFIX.includes(banned));
  }
});

test('the tax-cap estimate note always states the direction — it may be less, never more', () => {
  // D40 — 문구를 줄이라는 지시 한가운데서 늘어난 문장. 상한을 확정값으로
  // 말하지 않는다는 것이 이 문장의 유일한 일이다.
  assert.match(TAX_CAP_ESTIMATE_NOTE, /총급여/);
  assert.match(TAX_CAP_ESTIMATE_NOTE, /적을 수 있습니다/);
  for (const banned of ['걸리지 않았습니다', '여유가 있습니다', '전액 공제']) {
    assert.ok(!TAX_CAP_ESTIMATE_NOTE.includes(banned), banned);
  }
});

test('the reduced note states the fact and stops before deciding what happens next', () => {
  const note = capReducedNote(1188000, 288000);
  assert.match(note, /1,188,000원/);
  assert.match(note, /288,000원/);
  assert.match(note, /이 결과에 들어 있지 않습니다/);
  for (const banned of ['소멸', '사라집니다', '환급']) assert.ok(!note.includes(banned), banned);
});

test('the carryover note never says the money disappears', () => {
  // 계약 10절 — 소멸하는 것은 그해의 세액공제액이고 납입액은 **신청을 통해**
  // 이후 과세기간으로 넘길 수 있다.
  assert.match(CAP_CARRYOVER_NOTE, /신청/);
  for (const banned of ['사라', '소멸', '없어집니다']) assert.ok(!CAP_CARRYOVER_NOTE.includes(banned), banned);
});

// **`AMOUNT_CARD_LABEL_ZERO`를 검증하던 테스트가 여기 있었다**(D39로 폐기).
// 세액공제가 0원이 되는 것은 이제 「잘림」 상태의 극단일 뿐이라 별도 라벨이
// 없다 — `AMOUNT_CARD_LABEL_CREDIT_ONLY`/`_COMPOSITE`를 그대로 쓴다(4.8절).

test('the youth copy never states the user is a youth, and never prints an age', () => {
  for (const line of [YOUTH_DECLARED_RANGE_NOTE, YOUTH_AGE_UNDETERMINED_LINE, YOUTH_DECLARE_LABEL]) {
    assert.ok(!/\d/.test(line), `청년 문구에 숫자가 들어 있다: ${line}`);
    assert.ok(!/고객님|당신/.test(line), `서비스가 개인의 세법상 지위를 단정한다: ${line}`);
  }
  assert.match(YOUTH_DECLARED_RANGE_NOTE, /정부가 발표한 개정안 기준으로는/, '주어는 발표·법령이지 사용자가 아니다');
  assert.match(YOUTH_DECLARED_RANGE_NOTE, /아직 시행령으로 정해지지 않았습니다/, '②만 빠지면 확정된 것으로 읽힌다');
});

test('the birth date help states what the value is used for (12.2(b) — the "does not leave the browser" clause moved to the entry-wide disclosure)', () => {
  assert.match(BIRTH_DATE_HELP, /만 나이/);
  assert.ok(BIRTH_DATE_HELP.length < 20, '입력 캡션 하나가 진입 안내·PDF 고지가 이미 말하는 것을 되풀이하지 않는다');
});

test('the annuity-started note tells a fact and does not tell the user what to do', () => {
  assert.ok(!/하세요|해 주세요|권|추천/.test(ANNUITY_STARTED_HORIZON_NOTE), ANNUITY_STARTED_HORIZON_NOTE);
});

// **`SourceGuide`("이 값을 어디서 찾나요")를 검증하던 테스트가 여기 있었다**
// (D39로 폐기). 유일한 용례(직전 과세연도 결정세액)가 없어져 그릴 자리가 없다.

test('every code the contract can send has a sentence — no raw code reaches the screen', () => {
  // **이 테스트가 예전에는 손으로 옮겨 적은 부분집합만 돌았다**(qa-report.md
  // 11.2절) — NOTICE 39개 중 16개, ASSUMPTION 24개 중 12개뿐이었다. 이름은
  // "모든 코드"라고 주장했지만 실제로는 절반 이하만 봤고, 그래서 문구가
  // 통째로 빠진 두 코드(`isa_type_cross_check_inconclusive`·
  // `isa_rate_gap_axis_zero_because_within_tax_free_limit`)를 놓쳤다 — 화면에
  // 코드 문자열이 그대로 뜰 자리였다. 이제 손으로 옮긴 목록을 버리고
  // `src/engine/constants.mjs`(레지스트리의 단일 진실 원천)를 직접 돈다 —
  // 새 코드가 문구 없이 늘어나면 이 테스트가 자동으로 붉어진다.
  for (const code of Object.values(NOTICE)) {
    assert.notEqual(
      noticeMessage({ code, params: {} }),
      code,
      `NOTICE.${code}에 대응하는 문구가 copy.js의 NOTICE_MESSAGE에 없다 — fallback으로 코드 문자열이 그대로 화면에 뜬다`,
    );
  }
  for (const code of Object.values(ASSUMPTION)) {
    assert.notEqual(
      assumptionMessage(code, {}),
      code,
      `ASSUMPTION.${code}에 대응하는 문구가 copy.js의 ASSUMPTION_MESSAGE에 없다`,
    );
  }
  for (const code of Object.values(WARNING)) {
    assert.notEqual(
      warningMessage({ code, params: {}, trigger: 'declared' }, {}),
      code,
      `WARNING.${code}에 대응하는 문구가 copy.js의 WARNING_BODY에 없다`,
    );
  }
  for (const code of Object.values(COMPARISON_NOTE)) {
    assert.notEqual(
      comparisonNoteMessage(code),
      code,
      `COMPARISON_NOTE.${code}에 대응하는 문구가 copy.js의 COMPARISON_NOTE_MESSAGE에 없다`,
    );
  }
  // `exclusionReasonMessage`는 `NOTICE`의 부분집합만 쓰고 전용 레지스트리가
  // 없어(qa-report.md 11.2절이 적어 둔 한계) 자동 전건 대조를 못 한다 — 실제
  // 호출부(`eligibility.js`)가 쓰는 코드만 손으로 확인한다.
  for (const code of [
    'pension_contribution_blocked_annuity_started',
    'pension_annuity_start_unknown',
    'irp_excluded_no_qualifying_status',
    'isa_excluded_age',
    'isa_excluded_financial_income_taxpayer',
  ]) {
    assert.notEqual(exclusionReasonMessage(code), code);
  }
});

// ---------------------------------------------------------------------------
// **소유자가 지목해 지운 경고** — `early_withdrawal_penalty_pension`
// (2026-08-13). **이 절이 예전에는 반대 방향을 요구했다** — "이 경고가 렌더
// 된다"는 검사였다. 지금은 뒤집는다: "렌더되지 않는다"를 요구한다. 지우지
// 않고 뒤집은 이유는 `wording.test.mjs` 자체의 규약(11.2절 재소집 결함이
// 반복된 자리 — 검사를 지우면 회귀를 잡을 사람이 없다) 때문이다. 엔진은
// 계약대로 이 코드를 계속 낸다(`src/engine/constants.mjs`의 `WARNING`
// 레지스트리, `mock-engine.js`) — 여기서 잠그는 것은 **화면이 그것을
// 그리지 않는다**는 사실이다.
// ---------------------------------------------------------------------------

test('early_withdrawal_penalty_pension renders nothing — neither the declared warning nor the horizon_unknown info variant', () => {
  const declared = warningMessage(
    { code: 'early_withdrawal_penalty_pension', params: { pension_years_remaining: 19 }, trigger: 'declared_horizon' },
    {},
  );
  assert.equal(declared, null, `지운 경고가 다시 렌더된다: ${declared}`);

  const infoVariant = warningMessage(
    { code: 'early_withdrawal_penalty_pension', params: {}, trigger: 'horizon_unknown' },
    { pension_years_remaining: 19 },
  );
  assert.equal(infoVariant, null, `info 접두사가 붙은 채로 되살아났다: ${infoVariant}`);
});

test('early_termination_clawback_isa is untouched — the owner named only one warning, not the other', () => {
  // 지시 범위를 넓히지 않는다(이 세션의 규약). ISA 추징 경고는 그대로 뜬다.
  const text = warningMessage(
    { code: 'early_termination_clawback_isa', params: { isa_lock_in_years_remaining: 2 }, trigger: 'declared_horizon' },
    {},
  );
  assert.match(text, /의무가입기간 안에 해지하면 감면받은 세액을 추징하는 규칙이 있습니다/);
  assert.match(text, /남은 의무가입기간/);
});

test('an unrecognized WARNING code never leaks its raw code string to the screen', () => {
  // `WARNING_BODY[code] ? ... : warning.code`이던 옛 fallback이 위험한
  // 자리였다 — 새 코드가 문구 없이 늘어나면 영문 코드가 그대로 화면에 떴다
  // (D47 후속이 우려한 것과 같은 결). 지금은 사전에 없는 코드도 `null`을
  // 돌려준다 — 아무것도 그리지 않는 쪽이, 사용자에게 영문 코드를 보여주는
  // 쪽보다 안전하다.
  const text = warningMessage({ code: 'made_up_code_that_will_never_exist', params: {}, trigger: 'declared_horizon' }, {});
  assert.equal(text, null);
});

test('reviving the removed sentence in copy.js would turn this test red', () => {
  // "문자열을 되살려 붉어지는지 확인하라"는 지시의 실측 — copy.js 소스에
  // 그 문장의 핵심 어구가 남아 있지 않은지 직접 스캔한다. `WARNING_BODY`
  // 안에서 다시 함수로 바뀌면(=화면에 다시 그려지면) 위 렌더 검사가 이미
  // 잡지만, 이 검사는 소유자가 지목한 **문장 자체**가 소스에서 지워졌는지를
  // 한 번 더 확인한다.
  const source = stripComments(readFileSync(path.join(here, 'copy.js'), 'utf8'));
  const body = source.slice(source.indexOf('const WARNING_BODY'), source.indexOf('const INFO_PREFIX'));
  assert.ok(!body.includes('연금 수령 개시 연령 전에 인출하면'), '지운 경고 문장이 WARNING_BODY에 되살아났다');
  assert.ok(!body.includes('그 나이까지'), '지운 경고 문장의 꼬리가 WARNING_BODY에 되살아났다');
});

test('the return-rate assumption sentence echoes the user\'s own number and disclaims that the service does not propose one — D28/D31', () => {
  // 0.10절 — "이 서비스는 수익률을 제시하지 않는다"가 남은 방어선 전부다.
  // 문구가 사용자 값을 그대로 되비추는지(하드코딩된 숫자가 아닌지)를 본다.
  const seven = assumptionMessage('isa_return_rate_user_supplied', { annual_return_rate: 0.07 });
  const three = assumptionMessage('isa_return_rate_user_supplied', { annual_return_rate: 0.03 });
  assert.notEqual(seven, three, '문구가 실제 입력이 아니라 고정된 숫자를 말하고 있다');
  assert.match(seven, /제시한 값이 아닙니다/);
});

test('isa_return_estimate_is_not_annual never says "연" — the amount is a settlement-period total, not annual', () => {
  const text = noticeMessage({ code: 'isa_return_estimate_is_not_annual', params: { settlement_years: 3 } });
  assert.ok(!/연\s*\d/.test(text), text);
  assert.match(text, /1년치 금액이 아닙니다/);
});

test('the age-reference assumption states how it computed, not what the age is', () => {
  // 점검표 11.6 — `[4-E]`의 그 항목은 **값이 아니라 처리 방식**을 말한다.
  // 값을 적으면 이 항목이 공유 이미지에 들어갈 때 나이가 함께 나간다.
  const text = assumptionMessage('age_reference_date_not_in_ruleset', { reference_date: '2026-12-31', age_years: 38 });
  assert.ok(!text.includes('38'), `가정 문구에 만 나이가 실렸다: ${text}`);
  assert.match(text, /과세기간 종료일/);
});

// ---------------------------------------------------------------------------
// 엔진이 넓어질 때 조용히 낡는 문구 — 두 자리를 고정한다
// ---------------------------------------------------------------------------

test('no assumption sentence claims a rule is missing from the ruleset when it is not', () => {
  // 엔진이 `age.reckoning.reference_date`를 실제로 읽기 시작하면서, "규칙이 룰셋에
  // 없어"라고 말하던 옛 문장이 사실과 달라졌다. 코드 이름(`..._not_in_ruleset`)은
  // 엔진의 것이라 화면이 고치지 않지만, **문구는 화면의 것이라 사실을 따라야 한다.**
  const text = assumptionMessage('age_reference_date_not_in_ruleset', {
    reference_date: '2026-12-31',
    requires_reference_date_rule_ids: ['isa.eligibility'],
  });
  assert.ok(!/룰셋에 없/.test(text), `사실과 다른 문장이다: ${text}`);
  assert.ok(!/규칙이 없/.test(text), text);
  assert.match(text, /하나로 정해져 있지 않습니다/, '단일 기준일이 없다는 것이 이 규칙의 결론이다');
  assert.match(text, /2026-12-31/, '어느 날짜로 환산했는지가 사라지면 사용자가 대조할 수 없다');
  // 규칙 id를 사용자에게 그대로 보이지 않는다 — 근거 조항은 화면에 인쇄하지
  // 않는다(D46 2·3번, 관리자 판정). 근거 자체는 여전히 룰셋의 `source`에 있다.
  assert.ok(!text.includes('isa.eligibility'), text);
});

test('the affected-requirement clause appears only when the engine names one', () => {
  // D46 2·3번(관리자 판정) 이후 이 문장은 더 이상 "아래 조항"(=LawChip)을
  // 가리키지 않는다 — 그 칩이 화면에서 없어졌기 때문이다. 대신 "이 판정에
  // 걸리는 요건"이라는 사실 자체를 가리키고, 그 사실은 여전히 엔진이 특정
  // 요건을 지목했을 때만 나온다.
  const withNone = assumptionMessage('age_reference_date_not_in_ruleset', {
    reference_date: '2026-12-31',
    requires_reference_date_rule_ids: [],
  });
  assert.ok(!/아래 조항/.test(withNone), '이제 어디서도 가리키지 않는 문구다 — "아래 조항"이 남아 있으면 안 된다');
  assert.ok(!/이 판정에 걸리는 요건/.test(withNone), '가리킬 요건이 없는데 "이 판정에 걸리는 요건"이라고 말하면 빈 곳을 가리킨다');
  const withSome = assumptionMessage('age_reference_date_not_in_ruleset', {
    reference_date: '2026-12-31',
    requires_reference_date_rule_ids: ['isa.eligibility'],
  });
  assert.ok(!/아래 조항/.test(withSome), '"아래 조항"이라는 문구 자체가 이제 없어야 한다 — 가리킬 LawChip이 없다');
  assert.match(withSome, /이 판정에 걸리는 요건/);
});

test('a sentence never opens with a hole where a missing param used to be', () => {
  // 실측 화면에 `" 과세연도 하나만 계산했습니다"`가 앞이 빈 채로 떠 있었다 —
  // 엔진이 싣지 않는 `params.tax_year`를 문구가 기대하고 있었다.
  const withoutYear = assumptionMessage('single_tax_year_only', {});
  assert.ok(!/^\s/.test(withoutYear), `문장이 공백으로 시작한다: ${JSON.stringify(withoutYear)}`);
  assert.match(withoutYear, /^이 과세연도 하나만/);
  const withYear = assumptionMessage('single_tax_year_only', { tax_year: 2026 });
  assert.match(withYear, /^2026 과세연도 하나만/);
});

test('every assumption sentence survives an empty params object without leaving a gap', () => {
  // 같은 부류의 결함을 한 번에 막는다 — 엔진이 params를 줄이거나 늘려도 문장이
  // 스스로 완결되어야 한다.
  const codes = [
    'months_remaining_defaulted',
    'age_reference_date_not_in_ruleset',
    'local_tax_follows_income_tax_cap',
    'deferred_retirement_income_absent_assumed',
    'retirement_transfer_counted_in_contribution_limit',
    'single_tax_year_only',
    'other_deductions_excluded',
    'rounding_floor_to_won',
    'isa_benefit_not_quantified',
    'fund_use_horizon_excluded_from_amounts',
    'early_exit_penalty_not_quantified',
    'pension_holding_period_not_evaluated',
    'isa_new_account_assumed',
    'isa_tenure_zero_assumed',
    'other_savings_zero_assumed',
    'prior_transfer_credit_zero_assumed',
    // 계약 5.1.0 — 수익률 가정 위의 계산.
    'isa_return_rate_user_supplied',
    'isa_return_simple_interest',
    'isa_return_principal_from_contributions',
    'isa_settlement_years_defaulted_to_min_contract_years',
    'isa_loss_assumed_zero',
    'isa_comparison_baseline_is_withholding_only',
    'isa_return_assumes_contract_held_to_settlement',
  ];
  for (const code of codes) {
    const text = assumptionMessage(code, {});
    assert.notEqual(text, code, `${code}에 대응하는 문구가 없다`);
    assert.ok(!/^\s/.test(text), `${code}: 공백으로 시작한다 — ${JSON.stringify(text)}`);
    assert.ok(!/\(\)/.test(text), `${code}: 빈 괄호가 남았다 — ${text}`);
    assert.ok(!/undefined|null|NaN/.test(text), `${code}: 값이 없는 자리가 그대로 새어 나왔다 — ${text}`);
    assert.ok(!/\s{2,}/.test(text), `${code}: 값이 빠진 자리에 공백이 두 칸 남았다 — ${JSON.stringify(text)}`);
  }

  const noticeCodesForRobustness = [
    'isa_return_estimate_is_not_annual',
    'isa_return_estimate_not_computable',
    'tax_liability_cap_estimated_from_total_salary',
    'tax_liability_cap_direction_indeterminate',
    'tax_liability_cap_zero',
  ];
  for (const code of noticeCodesForRobustness) {
    const text = noticeMessage({ code, params: {} });
    assert.notEqual(text, code, `${code}에 대응하는 문구가 없다`);
    assert.ok(!/^\s/.test(text), `${code}: 공백으로 시작한다 — ${JSON.stringify(text)}`);
    assert.ok(!/undefined|null|NaN/.test(text), `${code}: 값이 없는 자리가 그대로 새어 나왔다 — ${text}`);
    assert.ok(!/\s{2,}/.test(text), `${code}: 값이 빠진 자리에 공백이 두 칸 남았다 — ${JSON.stringify(text)}`);
  }
});

// ---------------------------------------------------------------------------
// 계약 5.0.0 — D26의 넷째 배분안(6.0.0·D32에서 `pension_contribution_before_isa`로
// 개명). requirements.md 6절 AC: "어떤 배분안에도 추천·최적·권장 같은 단정적
// 표현을 쓰지 않는다. 기본안은 '기본'이라는 표시만 단다." 이 안은 세법이
// 유불리를 정하지 않으므로 특히 더 엄격하다.
// ---------------------------------------------------------------------------

test('every plan id the contract can send has a label, and none of them reads as a recommendation', () => {
  const planIds = ['max_tax_credit', 'annuity_savings_first', 'isa_first', 'pension_contribution_before_isa'];
  for (const id of planIds) {
    const label = PLAN_LABEL[id];
    assert.ok(label, `${id}에 대응하는 라벨이 없다`);
    for (const forbidden of ['추천', '최적', '권장']) {
      assert.ok(!label.includes(forbidden), `${id}의 라벨 "${label}"이 단정적 표현("${forbidden}")을 쓴다`);
    }
  }
});

test('the D26 unallocated breakdown never sums two headrooms that overlap', () => {
  const withOverlap = unallocatedBreakdownMessage({
    total_annual_krw: 1000,
    pension_contribution_headroom_krw: 800,
    isa_contribution_headroom_krw: 800,
    no_headroom_krw: 0,
    headrooms_overlap: true,
  });
  // 겹치면 두 금액을 더한 합계(1,600원)를 문장에 내지 않는다.
  assert.ok(!withOverlap.includes('1,600'));
  assert.ok(withOverlap.includes('800'));

  const onlyNoHeadroom = unallocatedBreakdownMessage({
    total_annual_krw: 500,
    pension_contribution_headroom_krw: 0,
    isa_contribution_headroom_krw: 0,
    no_headroom_krw: 500,
    headrooms_overlap: false,
  });
  // 「갈 곳이 없다」는 이 몫에 대해서만 참이다(계약 5.13절) — "500"이 그 뜻으로만 나온다.
  assert.ok(onlyNoHeadroom.includes('500'));
  assert.ok(onlyNoHeadroom.includes('넣을 수 없습니다'));
});

test('the pension-without-credit sentence never drops one of the three required facts', () => {
  const effect = {
    account: 'retirement_pension',
    facts: {
      credit_this_year_krw: 0,
      contribution_without_credit_krw: 3000000,
      principal_taxed_on_withdrawal: false,
      principal_tax_free_requires_confirmation: true,
      principal_tax_free_confirmation_prospective_only: true,
      returns_taxed_on_withdrawal: true,
    },
  };
  const text = pensionWithoutCreditMessage(effect);
  // (1) 원금은 비과세다.
  assert.ok(text.includes('과세되지 않습니다'));
  // (2) 다만 세무서 확인서가 필요하고 소급하지 않는다 — "세무서"라는 말 그대로(D29).
  assert.ok(text.includes('세무서'));
  assert.ok(text.includes('소급하지 않습니다'));
  // (3) 수익에는 인출 시 세금이 붙는다.
  assert.ok(text.includes('수익에는 인출 시 세금이 붙습니다'));
  // 금지된 문장 — 계약 5.6절이 명시적으로 막는다.
  assert.ok(!text.includes('이월해서 공제받을 수 있'));
  assert.ok(!text.includes('손해'));
  assert.ok(!text.includes('유리합니다'));
});

test('the pension-without-credit sentence returns null rather than guessing when facts are absent', () => {
  assert.equal(pensionWithoutCreditMessage({ account: 'retirement_pension', facts: null }), null);
});
