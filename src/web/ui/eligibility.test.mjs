import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountExclusion,
  accountLimitView,
  accountBenefitRows,
  excludedAccounts,
  fillOrderTieBreak,
  lawEntriesFor,
  lawEntriesForPath,
  pensionCreditHeadroomView,
  unallocatedBlockers,
} from './eligibility.js';
import { CHART_ACCOUNT_ORDER } from './charts.js';
import { exclusionReasonMessage, unallocatedReasonMessage, EXCLUDED_ACCOUNT_FALLBACK_REASON } from '../copy.js';

/**
 * 4단계 검증 관찰 O1의 회귀 테스트 — **ISA가 배제된 사용자에게 비과세 한도가
 * 표시되던 결함.** 엔진은 계약대로 `eligible: false`와 `tax_free_limit_krw`를
 * 함께 보낸다(계약 5.3절). 화면이 둘을 함께 읽어야 한다는 것이 이 테스트가
 * 고정하는 사실이다.
 */

// GC-13/GC-14가 관측한 형태를 그대로 옮긴 응답 조각.
function scenarioWithExcludedIsa(reasonCodes = ['isa_excluded_financial_income_taxpayer']) {
  return {
    account_eligibility: [
      { account: 'retirement_pension', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'annuity_savings', eligible: true, reason_codes: [], basis_rule_ids: [] },
      {
        account: 'isa',
        eligible: false,
        reason_codes: reasonCodes,
        basis_rule_ids: ['isa.eligibility', 'isa.exclusion.financial_income_taxpayer'],
      },
    ],
    limits: {
      by_account: [
        {
          account: 'retirement_pension',
          contribution_limit_remaining_krw: 18000000,
          credit_eligible_limit_remaining_krw: 9000000,
          tax_free_limit_krw: null,
          basis_rule_ids: ['pension.contribution.annual_limit'],
        },
        {
          account: 'annuity_savings',
          contribution_limit_remaining_krw: 18000000,
          credit_eligible_limit_remaining_krw: 6000000,
          tax_free_limit_krw: null,
          basis_rule_ids: ['pension.contribution.annual_limit'],
        },
        {
          // 결함의 핵심 — 배제됐는데 비과세 한도가 실려 온다. 엔진은 계약대로다.
          account: 'isa',
          contribution_limit_remaining_krw: 0,
          credit_eligible_limit_remaining_krw: null,
          tax_free_limit_krw: 4000000,
          basis_rule_ids: ['isa.account.requirements'],
        },
      ],
    },
    legal_basis: [
      { rule_id: 'isa.eligibility', law: '조세특례제한법 제91조의18 제1항 제1호·제2호' },
      { rule_id: 'isa.exclusion.financial_income_taxpayer', law: '조세특례제한법 제91조의18 제1항 각 호 외의 부분 단서' },
      { rule_id: 'pension.contribution.annual_limit', law: '소득세법 시행령 제40조의2 제2항 제1호 가목' },
    ],
  };
}

test('an excluded account never hands the screen a tax-free limit amount', () => {
  const scenario = scenarioWithExcludedIsa();
  const view = accountLimitView(scenario, 'isa');
  assert.equal(view.excluded, true);
  assert.equal(view.taxFreeLimitKrw, null, '엔진이 4,000,000을 보내도 화면으로는 넘어가지 않는다');
  assert.equal(view.remainingLimitKrw, null, 'null은 0원이 아니라 "표시할 값이 없다"는 뜻이다');
});

test('an eligible account still gets its limit amounts through the same gate', () => {
  const scenario = scenarioWithExcludedIsa();
  const view = accountLimitView(scenario, 'retirement_pension');
  assert.equal(view.excluded, false);
  assert.equal(view.remainingLimitKrw, 18000000);
  assert.equal(view.taxFreeLimitKrw, null); // 연금계좌는 원래 null이다(계약 5.3절)
});

test('an eligible ISA keeps its tax-free limit — the gate blocks exclusion, not the field', () => {
  const scenario = scenarioWithExcludedIsa();
  scenario.account_eligibility.find((e) => e.account === 'isa').eligible = true;
  const view = accountLimitView(scenario, 'isa');
  assert.equal(view.excluded, false);
  assert.equal(view.taxFreeLimitKrw, 4000000);
});

test('exclusion carries the reason codes and their basis rules, so the screen can say why', () => {
  const exclusion = accountExclusion(scenarioWithExcludedIsa(['isa_excluded_age']), 'isa');
  assert.deepEqual(exclusion.reasonCodes, ['isa_excluded_age']);
  assert.ok(exclusion.basisRuleIds.includes('isa.eligibility'));
});

test('every exclusion reason code the engine can emit has a screen sentence', () => {
  // 계약 8.2절의 ISA 배제 코드 둘. 코드가 늘면 이 테스트가 먼저 깨진다.
  for (const code of ['isa_excluded_age', 'isa_excluded_financial_income_taxpayer']) {
    const message = exclusionReasonMessage(code);
    assert.notEqual(message, code, `${code}에 대응하는 문구가 사전에 없다`);
    assert.ok(message.length > 10);
  }
});

test('exclusion sentences stay factual — no second-person instruction, no scare words', () => {
  const messages = [
    exclusionReasonMessage('isa_excluded_age'),
    exclusionReasonMessage('isa_excluded_financial_income_taxpayer'),
    EXCLUDED_ACCOUNT_FALLBACK_REASON,
  ];
  // 헌장 문구 정책 + screens.md 4.7절: 지시형·"손해"·"위험"·느낌표를 쓰지 않고,
  // 세무사법이 금지한 어휘도 들어가지 않는다.
  const forbidden = [
    '하세요', '하십시오', '가입하', '고려하', '권장', '추천', '손해', '위험', '주의하', '!',
    '세무 상담', '세무 자문', '세무 대리', '세무 진단', '신고 대행', '환급 신청', '컨설팅',
  ];
  for (const message of messages) {
    for (const word of forbidden) {
      assert.ok(!message.includes(word), `배제 사유 문구에 "${word}"가 들어 있다: ${message}`);
    }
  }
});

test('missing reason codes still produce a sentence rather than an empty cell', () => {
  const scenario = scenarioWithExcludedIsa([]);
  const view = accountLimitView(scenario, 'isa');
  assert.equal(view.reasonCodes.length, 0);
  assert.ok(EXCLUDED_ACCOUNT_FALLBACK_REASON.length > 0);
});

test('an account absent from account_eligibility is not treated as excluded', () => {
  const scenario = { account_eligibility: [], limits: { by_account: [] }, legal_basis: [] };
  assert.equal(accountExclusion(scenario, 'isa'), null);
  assert.equal(accountLimitView(scenario, 'isa').excluded, false);
});

test('excludedAccounts lists exactly the accounts the engine excluded', () => {
  assert.deepEqual(excludedAccounts(scenarioWithExcludedIsa()), ['isa']);
  const noneExcluded = scenarioWithExcludedIsa();
  noneExcluded.account_eligibility.find((e) => e.account === 'isa').eligible = true;
  assert.deepEqual(excludedAccounts(noneExcluded), []);
});

test('the exclusion reason comes with its law chips, in legal_basis order and deduplicated', () => {
  const scenario = scenarioWithExcludedIsa();
  const entries = lawEntriesFor(scenario, ['isa.exclusion.financial_income_taxpayer', 'isa.eligibility', 'isa.eligibility']);
  assert.deepEqual(
    entries.map((e) => e.rule_id),
    ['isa.eligibility', 'isa.exclusion.financial_income_taxpayer'],
  );
});

test('unknown rule ids never invent a law chip', () => {
  assert.deepEqual(lawEntriesFor(scenarioWithExcludedIsa(), ['not.a.rule']), []);
  assert.deepEqual(lawEntriesFor(scenarioWithExcludedIsa(), []), []);
});

test('law chips can be looked up by the output field the engine says the rule was applied to', () => {
  const scenario = {
    legal_basis: [
      { rule_id: 'isa.tax_free_limit', law: '조세특례제한법 제91조의18 제2항', applied_to: ['limits.by_account[isa].tax_free_limit_krw'] },
      { rule_id: 'pension.credit.limit.combined', law: '소득세법 제59조의3 제1항 단서', applied_to: ['limits.pension_combined_credit_limit_krw'] },
    ],
  };
  assert.deepEqual(
    lawEntriesForPath(scenario, 'limits.by_account[isa].tax_free_limit_krw').map((e) => e.rule_id),
    ['isa.tax_free_limit'],
  );
  assert.deepEqual(lawEntriesForPath(scenario, 'limits.by_account[isa].contribution_limit_remaining_krw'), []);
});

// --- 세액공제 인정 여지 (screens.md 5.10절) ---------------------------------

function scenarioWithCreditHeadroom(remaining) {
  return { limits: { pension_combined_credit_remaining_krw: remaining, by_account: [] }, account_eligibility: [], legal_basis: [] };
}
const planWithPension = (annuity, pension) => ({
  allocations: [
    { account: 'retirement_pension', annual_krw: pension },
    { account: 'annuity_savings', annual_krw: annuity },
    { account: 'isa', annual_krw: 5000000 },
  ],
});

test('the credit headroom is reported for the pension pair as one number, not per account', () => {
  const view = pensionCreditHeadroomView(scenarioWithCreditHeadroom(9000000), planWithPension(3000000, 3000000));
  assert.equal(view.remainingKrw, 9000000, '합산값을 그대로 쓴다 — 계좌별 값을 더하지 않는다(계약 5.3절)');
  assert.equal(view.allocatedKrw, 6000000, 'ISA 배분은 이 축에 들어가지 않는다');
  assert.equal(view.exceeded, false);
});

test('an allocation above the credit headroom is reported as exceeded, not clamped or hidden', () => {
  // GC-23 형태 — 개정안 청년 우대에서 IRP 9,000,000이 잔여 인정 여지 3,000,000을 넘는다.
  const view = pensionCreditHeadroomView(scenarioWithCreditHeadroom(3000000), planWithPension(0, 9000000));
  assert.equal(view.exceeded, true, '이 값은 상한이 아니므로 넘는 것이 정상이다 — 화면은 그 사실을 말해야 한다');
  assert.equal(view.allocatedKrw, 9000000);
});

test('exactly meeting the headroom is not "exceeded"', () => {
  assert.equal(pensionCreditHeadroomView(scenarioWithCreditHeadroom(9000000), planWithPension(0, 9000000)).exceeded, false);
});

// --- Q1: 미배분 금액의 사유는 `limited_by` 값마다 달라야 한다 -----------------
//
// 4단계 qa가 잡은 결함. 화면이 "세 계좌의 납입 잔여 한도를 모두 채우고 남은
// 금액"을 무조건 출력해, 배분이 공제한도·배제로 멈춘 경우 거짓을 말했다.
// `limited_by`의 값마다 문장을 고정해 같은 부류가 네 번째로 나오지 않게 한다.

const planLimitedBy = (pension, annuity, isa) => ({
  allocations: [
    { account: 'retirement_pension', annual_krw: 0, limited_by: pension },
    { account: 'annuity_savings', annual_krw: 0, limited_by: annuity },
    { account: 'isa', annual_krw: 0, limited_by: isa },
  ],
});
const FALSE_CLAIM = '모두 채우고';

test('limited_by=contribution_limit — the sentence may say the contribution room is full', () => {
  const text = unallocatedReasonMessage(unallocatedBlockers(planLimitedBy('contribution_limit', 'contribution_limit', 'contribution_limit')));
  assert.match(text, /납입 잔여 한도를 모두 채웠습니다/);
  assert.match(text, /연금저축·IRP·ISA/);
});

test('limited_by=credit_limit — the sentence says contribution room is LEFT, never that it is full', () => {
  // qa 재현 케이스: 연금 납입 잔여 한도 9,000,000이 그대로 남아 있는데 멈춘 상태.
  const text = unallocatedReasonMessage(unallocatedBlockers(planLimitedBy('credit_limit', 'credit_limit', 'not_eligible')));
  assert.match(text, /세액공제 대상 납입액을 모두 채웠습니다\(납입 잔여 한도는 남아 있습니다\)/);
  assert.ok(!text.includes(FALSE_CLAIM), `사실이 아닌 문장이 남아 있다: ${text}`);
});

test('limited_by=not_eligible — the sentence names exclusion, not a limit', () => {
  const text = unallocatedReasonMessage(unallocatedBlockers(planLimitedBy('not_eligible', 'not_eligible', 'not_eligible')));
  assert.match(text, /이번 계산의 배분 대상이 아닙니다/);
  assert.ok(!text.includes('한도'), text);
});

test('mixed reasons are reported side by side with the right accounts under each', () => {
  const text = unallocatedReasonMessage(unallocatedBlockers(planLimitedBy('credit_limit', 'contribution_limit', 'not_eligible')));
  assert.match(text, /연금저축는 납입 잔여 한도를 모두 채웠습니다/);
  assert.match(text, /IRP는 세액공제 대상 납입액을 모두 채웠습니다/);
  assert.match(text, /ISA는 이번 계산의 배분 대상이 아닙니다/);
});

test('limited_by=budget or null never claims a limit was reached — leftover money contradicts it', () => {
  for (const reason of ['budget', null]) {
    const text = unallocatedReasonMessage(unallocatedBlockers(planLimitedBy(reason, reason, reason)));
    assert.equal(text, '이 배분에 들어가지 않은 금액입니다.');
    assert.ok(!text.includes(FALSE_CLAIM));
  }
});

test('no limited_by value can produce the old unconditional claim unless every account really is contribution-limited', () => {
  const values = ['budget', 'contribution_limit', 'credit_limit', 'not_eligible', null];
  for (const a of values) {
    for (const b of values) {
      for (const c of values) {
        const text = unallocatedReasonMessage(unallocatedBlockers(planLimitedBy(a, b, c)));
        const allContribution = [a, b, c].every((v) => v === 'contribution_limit');
        if (!allContribution) {
          assert.ok(
            !/연금저축·IRP·ISA는 납입 잔여 한도를 모두 채웠습니다/.test(text),
            `세 계좌가 전부 납입 한도로 멈춘 것이 아닌데 그렇게 말한다: ${a}/${b}/${c} → ${text}`,
          );
        }
      }
    }
  }
});

test('accounts are named in the fixed screen order, matching the charts', () => {
  const groups = unallocatedBlockers(planLimitedBy('contribution_limit', 'contribution_limit', 'contribution_limit'));
  assert.deepEqual(groups[0].accounts, CHART_ACCOUNT_ORDER, '문장과 차트가 계좌를 다른 순서로 부르면 대조가 깨진다');
});

test('a missing headroom value yields null and never a phantom zero', () => {
  const view = pensionCreditHeadroomView({ limits: {} }, planWithPension(0, 0));
  assert.equal(view.remainingKrw, null);
  assert.equal(view.exceeded, false);
});

// --- 왜 이 순서로 채웠는가 (계약 0.4·5.6절 `tie_break`) -----------------------
//
// 소유자가 "왜 IRP를 먼저 채우는지 알려달라"고 물었고, 그 물음이 엔진의 순서를
// 바꿨다. 화면은 이제 묻기 전에 답해야 한다 — 다만 **동점일 때만** 그 답이
// 사실이다. 공제율이 갈리는 구간에서 순서를 정한 것은 인출 유연성이 아니라
// 세액공제 최대화다.

function planWithTieBreak({ code, sequence, annuityAnnual = 6000000, retirementAnnual = 3000000, ruleIds = ['pension.withdrawal.midterm_restriction'] }) {
  return {
    plan_id: 'max_tax_credit',
    priority_basis: {
      code: 'tax_credit_maximization',
      fill_sequence: sequence,
      basis_rule_ids: ruleIds,
      tie_break: { code, basis_rule_ids: code === 'withdrawal_flexibility_first' ? ruleIds : [] },
    },
    allocations: [
      { account: 'retirement_pension', annual_krw: retirementAnnual },
      { account: 'annuity_savings', annual_krw: annuityAnnual },
      { account: 'isa', annual_krw: 0 },
    ],
  };
}

test('the tie-break explanation names the account the engine actually filled first, not a hardcoded one', () => {
  const view = fillOrderTieBreak(
    planWithTieBreak({ code: 'withdrawal_flexibility_first', sequence: ['annuity_savings', 'retirement_pension', 'isa'] }),
  );
  assert.deepEqual(
    { flexible: view.flexible, restricted: view.restricted },
    { flexible: 'annuity_savings', restricted: 'retirement_pension' },
  );
});

test('if the ruleset ever flips which account is flexible, the explanation flips with it', () => {
  // 계약 5.6절: "고정 배열로 가정하지 말고 이 값을 읽어라". 화면이 순서를 알고
  // 있다고 가정하는 순간, 룰셋이 바뀌면 화면만 조용히 틀린다.
  const view = fillOrderTieBreak(
    planWithTieBreak({
      code: 'withdrawal_flexibility_first',
      sequence: ['retirement_pension', 'annuity_savings', 'isa'],
      retirementAnnual: 9000000,
      annuityAnnual: 0,
    }),
  );
  assert.equal(view.flexible, 'retirement_pension');
  assert.equal(view.restricted, 'annuity_savings');
});

test('no explanation when the rates are not tied — then it was tax credit maximisation that set the order', () => {
  assert.equal(
    fillOrderTieBreak(planWithTieBreak({ code: 'not_applicable', sequence: ['retirement_pension', 'annuity_savings', 'isa'] })),
    null,
  );
});

test('no explanation when the account filled first got nothing — there is no order on screen to explain', () => {
  const view = fillOrderTieBreak(
    planWithTieBreak({
      code: 'withdrawal_flexibility_first',
      sequence: ['annuity_savings', 'retirement_pension', 'isa'],
      annuityAnnual: 0,
      retirementAnnual: 0,
    }),
  );
  assert.equal(view, null);
});

test('the explanation carries the rule ids the engine cited, so the screen can show the statute beside it', () => {
  const view = fillOrderTieBreak(
    planWithTieBreak({ code: 'withdrawal_flexibility_first', sequence: ['annuity_savings', 'retirement_pension', 'isa'] }),
  );
  assert.deepEqual(view.basisRuleIds, ['pension.withdrawal.midterm_restriction']);
});

test('a plan with no priority_basis at all does not crash the screen', () => {
  assert.equal(fillOrderTieBreak({ allocations: [] }), null);
  assert.equal(fillOrderTieBreak(null), null);
});

// --- `AccountBenefitStrip` 행 (design-system 5.31절 · screens.md 5.14절) -----
//
// 계좌별 세제혜택 위젯이 5개 상태 중 무엇을 고르는지. **화면이 계좌별 세액공제를
// 계산하지 않는다** — 계약이 이미 낸 값(합산 `deterministic_benefit`,
// `non_quantified_effects`)을 고르기만 한다.

function planWithBenefit({ pooledIncomeTax = 900000, isaHeadroom = 2000000, isaBasisRuleIds = ['isa.tax_free_limit'] } = {}) {
  return {
    deterministic_benefit: {
      pension_credit_income_tax_krw: pooledIncomeTax,
      pension_credit_local_tax_krw: 0,
      pension_credit_total_krw: pooledIncomeTax,
      basis_rule_ids: ['pension.credit.rate'],
      tax_liability_cap: { known: true, cap_krw: 50000000, applied: false },
    },
    non_quantified_effects: isaHeadroom == null
      ? []
      : [
          {
            code: 'isa_tax_free_headroom',
            account: 'isa',
            headroom_krw: isaHeadroom,
            quantifiable: false,
            reason_code: 'depends_on_investment_return_not_in_ruleset',
            basis_rule_ids: isaBasisRuleIds,
          },
        ],
  };
}

function scenarioAllEligible() {
  return {
    account_eligibility: [
      { account: 'retirement_pension', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'annuity_savings', eligible: true, reason_codes: [], basis_rule_ids: [] },
      { account: 'isa', eligible: true, reason_codes: [], basis_rule_ids: [] },
    ],
  };
}

test('the pension pair is always pooled — the contract has no per-account split', () => {
  const rows = accountBenefitRows(scenarioAllEligible(), planWithBenefit());
  assert.equal(rows.pension.state, 'pooled');
  assert.deepEqual(rows.pension.accounts, ['annuity_savings', 'retirement_pension']);
});

test('ISA is narrative, never a bare amount — the report bars a "0원" cell', () => {
  const rows = accountBenefitRows(scenarioAllEligible(), planWithBenefit());
  assert.equal(rows.isa.state, 'narrative');
  assert.equal(rows.isa.headroomKrw, 2000000);
});

test('ISA stays narrative even when the engine has not sent a headroom amount yet (type undeclared)', () => {
  // ISA는 세액공제 대상이 아닐 뿐 혜택이 없는 것이 아니다(tax-rules-report.md
  // 15.4.5절) — 한도 금액이 없어도 서술 자체는 성립하므로 행을 감추지 않는다.
  const rows = accountBenefitRows(scenarioAllEligible(), planWithBenefit({ isaHeadroom: null }));
  assert.equal(rows.isa.state, 'narrative');
  assert.equal(rows.isa.headroomKrw, null);
});

test('an excluded ISA becomes the excluded row, with its reason and law carried through', () => {
  const scenario = scenarioAllEligible();
  scenario.account_eligibility.find((e) => e.account === 'isa').eligible = false;
  scenario.account_eligibility.find((e) => e.account === 'isa').reason_codes = ['isa_excluded_age'];
  scenario.account_eligibility.find((e) => e.account === 'isa').basis_rule_ids = ['isa.eligibility'];
  const rows = accountBenefitRows(scenario, planWithBenefit());
  assert.equal(rows.isa.state, 'excluded');
  assert.deepEqual(rows.isa.reasonCodes, ['isa_excluded_age']);
  assert.deepEqual(rows.isa.basisRuleIds, ['isa.eligibility']);
});

test('both pension accounts excluded collapses the pooled row to excluded, not a pooled zero', () => {
  const scenario = scenarioAllEligible();
  for (const account of ['retirement_pension', 'annuity_savings']) {
    const entry = scenario.account_eligibility.find((e) => e.account === account);
    entry.eligible = false;
    entry.reason_codes = ['pension_contribution_blocked_annuity_started'];
  }
  const rows = accountBenefitRows(scenario, planWithBenefit());
  assert.equal(rows.pension.state, 'excluded');
  assert.deepEqual(rows.pension.accounts, ['annuity_savings', 'retirement_pension']);
});

test('one pension account excluded still pools the remaining one — no phantom split', () => {
  const scenario = scenarioAllEligible();
  scenario.account_eligibility.find((e) => e.account === 'retirement_pension').eligible = false;
  const rows = accountBenefitRows(scenario, planWithBenefit());
  assert.equal(rows.pension.state, 'pooled');
  assert.deepEqual(rows.pension.accounts, ['annuity_savings']);
});
