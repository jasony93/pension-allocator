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
  PRIOR_TAX_LABEL,
  PRIOR_TAX_EFFECT_CAPTION,
  BOUNDED_AMOUNT_PREFIX,
  boundedDirectionNote,
  capReducedNote,
  CAP_CARRYOVER_NOTE,
  AMOUNT_CARD_LABEL_ZERO,
  BIRTH_DATE_HELP,
  YOUTH_DECLARED_RANGE_NOTE,
  YOUTH_AGE_UNDETERMINED_LINE,
  YOUTH_DECLARE_LABEL,
  ANNUITY_STARTED_HORIZON_NOTE,
  SOURCE_GUIDE_ITEMS,
  noticeMessage,
  assumptionMessage,
  comparisonNoteMessage,
  exclusionReasonMessage,
} from './copy.js';

test('the label for the determined tax is the name on the form, not a colloquial one', () => {
  // design-system 7.1절 — 사용자가 서류에서 찾아야 하는 값이므로 서류에 적힌
  // 이름과 같아야 한다. `낼 세금` 같은 구어를 라벨로 쓰지 않는다.
  assert.equal(PRIOR_TAX_LABEL, '직전 과세연도 결정세액');
  assert.ok(!/^낼 세금$/.test(PRIOR_TAX_LABEL));
});

test('the effect caption of the determined tax says what it changes, and is not empty', () => {
  // R1 — 효과 고지 캡션은 비울 수 없는 슬롯이다.
  assert.ok(PRIOR_TAX_EFFECT_CAPTION.length > 0);
  assert.match(PRIOR_TAX_EFFECT_CAPTION, /세액공제/);
});

test('the bounded headline uses 최대 and nothing else as a hedge', () => {
  // `최대`는 상한 변형에서만 쓰는 유일한 완화어다. `약`·`예상`과 섞어 쓰지 않는다.
  assert.equal(BOUNDED_AMOUNT_PREFIX, '최대');
  for (const banned of ['약', '예상']) {
    assert.ok(!BOUNDED_AMOUNT_PREFIX.includes(banned));
  }
});

test('the direction note names the threshold and opens in exactly one direction', () => {
  const note = boundedDirectionNote(1080000);
  assert.match(note, /1,080,000원/, '임계값이 문장에 있어야 사용자가 나중에 스스로 대조할 수 있다');
  assert.match(note, /줄어듭니다/);
  assert.match(note, /늘지는 않습니다/, '방향이 양쪽으로 열리면 상한 표기 자체가 성립하지 않는다');
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

test('the zero-cap headline puts the verb on the amount, not on the user', () => {
  // `세액공제로 받을 수 있는 금액이 없습니다`는 주어가 사용자다(P3).
  assert.equal(AMOUNT_CARD_LABEL_ZERO, '이 배분에서 계산되는 세액공제액');
  assert.ok(!AMOUNT_CARD_LABEL_ZERO.includes('받'));
});

test('the youth copy never states the user is a youth, and never prints an age', () => {
  for (const line of [YOUTH_DECLARED_RANGE_NOTE, YOUTH_AGE_UNDETERMINED_LINE, YOUTH_DECLARE_LABEL]) {
    assert.ok(!/\d/.test(line), `청년 문구에 숫자가 들어 있다: ${line}`);
    assert.ok(!/고객님|당신/.test(line), `서비스가 개인의 세법상 지위를 단정한다: ${line}`);
  }
  assert.match(YOUTH_DECLARED_RANGE_NOTE, /정부가 발표한 개정안 기준으로는/, '주어는 발표·법령이지 사용자가 아니다');
  assert.match(YOUTH_DECLARED_RANGE_NOTE, /아직 시행령으로 정해지지 않았습니다/, '②만 빠지면 확정된 것으로 읽힌다');
});

test('the birth date help promises what the code actually does', () => {
  assert.match(BIRTH_DATE_HELP, /브라우저 밖으로 나가지 않습니다/);
});

test('the annuity-started note tells a fact and does not tell the user what to do', () => {
  assert.ok(!/하세요|해 주세요|권|추천/.test(ANNUITY_STARTED_HORIZON_NOTE), ANNUITY_STARTED_HORIZON_NOTE);
});

test('the source guide has the third way out, so it is not a dead end', () => {
  // ①②만 두면 이 블록이 "가서 찾아오라"는 지시가 되고, 못 찾는 사용자에게는
  // 막다른 길이다. 세 번째 줄이 그 사용자를 결과로 돌려보낸다(3.8.4절).
  assert.equal(SOURCE_GUIDE_ITEMS.length, 3);
  assert.match(SOURCE_GUIDE_ITEMS[2].heading, /지금 확인할 수 없다면/);
  assert.match(SOURCE_GUIDE_ITEMS[2].body, /모르겠습니다/);
  for (const banned of ['준비해 주세요', '진단']) {
    for (const item of SOURCE_GUIDE_ITEMS) assert.ok(!item.body.includes(banned), banned);
  }
  // D19 — 자리표시자가 남아 있으면 그 사실이 드러나야 한다.
  assert.ok(SOURCE_GUIDE_ITEMS.some((i) => i.placeholder), '확정되지 않은 경로가 조용히 확정된 척하고 있다');
});

test('every code the 4.0.0 contract can send has a sentence — no raw code reaches the screen', () => {
  const noticeCodes = [
    'tax_liability_cap_unknown',
    'tax_liability_cap_zero',
    'tax_liability_cap_applied',
    'pension_contribution_blocked_annuity_started',
    'pension_annuity_start_unknown',
    'pension_start_date_not_computable',
    'retirement_transfer_excluded_from_credit',
    'isa_lock_in_already_elapsed',
    // 계약 5.0.0(D27) — 공제율 판정 축의 대체값 적용 notice.
    'credit_rate_global_income_missing',
    // 계약 5.1.0(D28·D29·D31) — 수익률 가정.
    'isa_return_assumption_not_supplied',
    'isa_return_estimate_is_not_annual',
    'isa_return_estimate_reported_as_range',
    'isa_return_estimate_not_computable',
    'isa_return_estimate_display_suppressed',
    'pension_tax_deferral_not_quantified',
  ];
  for (const code of noticeCodes) {
    assert.notEqual(noticeMessage({ code, params: {} }), code, `${code}에 대응하는 문구가 없다`);
  }
  const assumptionCodes = [
    'age_reference_date_not_in_ruleset',
    'prior_pension_credit_zero_assumed',
    'retirement_transfer_counted_in_contribution_limit',
    'deferred_retirement_income_absent_assumed',
    'local_tax_follows_income_tax_cap',
    // 계약 5.0.0(D27) — 1단계 질문을 좁혀 물은 것이 채택한 해석.
    'credit_rate_wage_only_excludes_separately_taxed_income',
    // 계약 5.1.0(D28·D29) — 수익률 가정 위의 계산이 서 있는 가정들.
    'isa_return_rate_user_supplied',
    'isa_return_simple_interest',
    'isa_return_principal_from_contributions',
    'isa_settlement_years_defaulted_to_min_contract_years',
    'isa_loss_assumed_zero',
    'isa_comparison_baseline_is_withholding_only',
    'isa_return_assumes_contract_held_to_settlement',
  ];
  for (const code of assumptionCodes) {
    assert.notEqual(assumptionMessage(code, {}), code, `${code}에 대응하는 문구가 없다`);
  }
  assert.notEqual(comparisonNoteMessage('tax_credit_axis_not_discriminating'), 'tax_credit_axis_not_discriminating');
  for (const code of ['pension_contribution_blocked_annuity_started', 'pension_annuity_start_unknown']) {
    assert.notEqual(exclusionReasonMessage(code), code);
  }
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
  // 규칙 id를 사용자에게 그대로 보이지 않는다 — 조항은 `LawChip`이 담는다.
  assert.ok(!text.includes('isa.eligibility'), text);
});

test('the affected-requirement clause appears only when the engine names one', () => {
  const withNone = assumptionMessage('age_reference_date_not_in_ruleset', {
    reference_date: '2026-12-31',
    requires_reference_date_rule_ids: [],
  });
  assert.ok(!/아래 조항/.test(withNone), '가리킬 조항이 없는데 "아래 조항"이라고 말하면 빈 곳을 가리킨다');
  const withSome = assumptionMessage('age_reference_date_not_in_ruleset', {
    reference_date: '2026-12-31',
    requires_reference_date_rule_ids: ['isa.eligibility'],
  });
  assert.match(withSome, /아래 조항/);
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
    'prior_pension_credit_zero_assumed',
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
