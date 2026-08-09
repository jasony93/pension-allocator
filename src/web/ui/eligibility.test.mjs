import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountExclusion, accountLimitView, excludedAccounts, lawEntriesFor } from './eligibility.js';
import { exclusionReasonMessage, EXCLUDED_ACCOUNT_FALLBACK_REASON } from '../copy.js';

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
