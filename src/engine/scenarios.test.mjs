// 시나리오 처리, ISA 만기 전환, 계좌 자격.
// engine-design.md 4.3·4.4절과 헌장 고지 요소 3·6이 대상이다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  loadRulesets,
  baseRequest,
  scenarioOf,
  planOf,
  noticeCodes,
  CONFIRMED_FILE,
  PROPOSED_FILE,
  birthDateForAge,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

function confirmedRule(id) {
  return rulesets[CONFIRMED_FILE].rules.find((r) => r.id === id);
}

const COMBINED_LIMIT = confirmedRule('pension.credit.limit.combined').value.amount_krw;
const ANNUITY_LIMIT = confirmedRule('pension.credit.limit.annuity_savings').value.amount_krw;
const TRANSFER_RULE = confirmedRule('pension.credit.isa_transfer.extra_limit');

// ── ISA 만기 전환 ────────────────────────────────────────────────

test('전환금액은 예산이 아니다 — 월 여력을 잠식하지 않는다', () => {
  const withoutTransfer = scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: 100_000 } }), rulesets));
  const withTransfer = scenarioOf(
    compute(
      baseRequest({
        profile: { monthly_capacity_krw: 100_000 },
        accounts: { isa: { cumulative_contribution_krw: 20_000_000 } },
        isa_transfer: { amount_krw: 10_000_000 },
      }),
      rulesets,
    ),
  );

  const budgetOf = (s) => planOf(s, 'max_tax_credit').total_allocated_annual_krw + planOf(s, 'max_tax_credit').unallocated_annual_krw;
  assert.equal(budgetOf(withTransfer), budgetOf(withoutTransfer));
});

test('전환 추가한도는 규칙 산식으로 산출되고 합산 한도를 확장한다', () => {
  const transfer = 10_000_000;
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { monthly_capacity_krw: 5_000_000 },
        accounts: { isa: { cumulative_contribution_krw: 20_000_000 } },
        isa_transfer: { amount_krw: transfer },
      }),
      rulesets,
    ),
  );

  const expectedExtra = Math.min(
    Math.floor((transfer * Math.round(TRANSFER_RULE.value.rate * 100)) / 100),
    TRANSFER_RULE.value.cap_krw,
  );

  assert.equal(scenario.isa_transfer_extra_limit.extra_credit_limit_krw, expectedExtra);
  assert.equal(scenario.isa_transfer_extra_limit.destination, 'retirement_pension');
  assert.equal(scenario.limits.pension_combined_credit_limit_krw, COMBINED_LIMIT + expectedExtra);
});

test('직전 과세기간 적용액이 상한에서 차감된다', () => {
  const cap = TRANSFER_RULE.value.cap_krw;
  const scenario = scenarioOf(
    compute(
      baseRequest({
        accounts: { isa: { cumulative_contribution_krw: 100_000_000 } },
        isa_transfer: { amount_krw: 90_000_000, prior_year_applied_extra_credit_krw: cap },
      }),
      rulesets,
    ),
  );

  assert.equal(scenario.isa_transfer_extra_limit.extra_credit_limit_krw, 0, '음수로 내려가지 않는다');
  assert.equal(scenario.isa_transfer_extra_limit.prior_applied_deducted_krw, cap);
});

test('전환 목적지가 연금저축이면 단독 한도 판정에 먼저 걸린다', () => {
  const transfer = ANNUITY_LIMIT;
  const toAnnuity = scenarioOf(
    compute(
      baseRequest({
        profile: { monthly_capacity_krw: 5_000_000 },
        accounts: { isa: { cumulative_contribution_krw: 50_000_000 } },
        isa_transfer: { amount_krw: transfer, destination: 'annuity_savings' },
      }),
      rulesets,
    ),
  );

  const annuityLimit = toAnnuity.limits.by_account.find((l) => l.account === 'annuity_savings');
  assert.equal(annuityLimit.credit_eligible_limit_remaining_krw, 0, '전환금이 단독 한도를 이미 채웠다');
});

test('전환이 없으면 관련 출력이 통째로 빠진다', () => {
  const scenario = scenarioOf(compute(baseRequest(), rulesets));
  assert.equal(scenario.isa_transfer_extra_limit, null);
});

// ── 계좌 자격 ────────────────────────────────────────────────────

test('금융소득종합과세 대상자는 ISA가 배제된다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { financial_income_taxpayer_last_3_years: true, monthly_capacity_krw: 5_000_000 },
      }),
      rulesets,
    ),
  );

  const isa = scenario.account_eligibility.find((a) => a.account === 'isa');
  assert.equal(isa.eligible, false);
  assert.ok(isa.reason_codes.includes('isa_excluded_financial_income_taxpayer'));
  assert.ok(isa.basis_rule_ids.includes('isa.exclusion.financial_income_taxpayer'));

  for (const plan of scenario.plans) {
    const allocation = plan.allocations.find((a) => a.account === 'isa');
    assert.equal(allocation.annual_krw, 0);
    assert.equal(allocation.limited_by, 'not_eligible');
  }
});

test('모르는 것을 아니라고 단정하지 않는다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ profile: { financial_income_taxpayer_last_3_years: null } }), rulesets),
  );
  assert.equal(scenario.account_eligibility.find((a) => a.account === 'isa').eligible, true);
  assert.ok(noticeCodes(scenario).includes('financial_income_status_unknown'));
});

test('ISA 연령 요건 미달이면 ISA만 빠지고 연금계좌 계산은 계속된다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { birth_date: birthDateForAge(14), prior_year_total_salary_krw: null, monthly_capacity_krw: 500_000 },
      }),
      rulesets,
    ),
  );

  assert.equal(scenario.account_eligibility.find((a) => a.account === 'isa').eligible, false);
  assert.ok(noticeCodes(scenario).includes('isa_excluded_age'));
  assert.ok(planOf(scenario, 'max_tax_credit').deterministic_benefit.pension_credit_total_krw > 0);
  assert.ok(noticeCodes(scenario).includes('pension_age_not_evaluated'));
});

test('ISA 유형 선언이 직전 과세기간 소득 판정과 어긋나면 경고하되 선언을 따른다', () => {
  const brackets = confirmedRule('isa.tax_free_limit').value.brackets;
  const lowIncome = brackets.find((b) => b.id === '서민형');

  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: { prior_year_total_salary_krw: lowIncome.prev_total_salary_max_krw },
        accounts: { isa: { account_type: 'general' } },
      }),
      rulesets,
    ),
  );

  assert.ok(noticeCodes(scenario).includes('isa_type_conflicts_with_prior_income'));
  const isa = scenario.limits.by_account.find((l) => l.account === 'isa');
  assert.equal(
    isa.tax_free_limit_krw,
    brackets.find((b) => b.id === '일반형').limit_krw,
    '계산은 사용자 선언을 따른다',
  );
});

test('직전 과세기간 소득이 없으면 교차확인을 건너뛰고 추정하지 않는다', () => {
  const scenario = scenarioOf(
    compute(baseRequest({ profile: { prior_year_total_salary_krw: null } }), rulesets),
  );
  assert.ok(noticeCodes(scenario).includes('prior_year_income_missing'));
  assert.equal(noticeCodes(scenario).includes('isa_type_conflicts_with_prior_income'), false);
});

// ── 개정예고 시나리오 ─────────────────────────────────────────────

test('개정안 시나리오는 bill_stage를 룰셋에서 읽어 함께 낸다', () => {
  const response = compute(baseRequest({ scenarios: ['current', 'proposed'] }), rulesets);
  const current = scenarioOf(response, 'current');
  const proposed = scenarioOf(response, 'proposed');

  assert.equal(current.is_enacted, true);
  assert.deepStrictEqual(current.bill_stages, []);

  assert.equal(proposed.is_enacted, false);
  assert.ok(proposed.bill_stages.length > 0);
  const known = new Set(rulesets[PROPOSED_FILE].rules.map((r) => r.bill_stage));
  for (const stage of proposed.bill_stages) {
    assert.ok(known.has(stage), '엔진이 문자열을 지어내지 않는다');
  }
  assert.ok(noticeCodes(proposed).includes('proposed_not_enacted'));
  assert.deepStrictEqual(proposed.ruleset.files, [CONFIRMED_FILE, PROPOSED_FILE]);
});

test('반영하지 않은 개정예고 규칙이 사유와 함께 드러난다', () => {
  const proposed = scenarioOf(compute(baseRequest({ scenarios: ['proposed'] }), rulesets), 'proposed');

  const appliedIds = new Set(proposed.legal_basis.filter((e) => e.bill_stage !== null).map((e) => e.rule_id));
  const unappliedIds = new Set(proposed.unapplied_proposed_rules.map((r) => r.rule_id));

  for (const rule of rulesets[PROPOSED_FILE].rules) {
    assert.ok(
      appliedIds.has(rule.id) || unappliedIds.has(rule.id),
      `${rule.id}가 적용도 미적용도 아닌 상태로 사라졌다`,
    );
  }
  for (const entry of proposed.unapplied_proposed_rules) {
    assert.ok(entry.reason_code.length > 0);
    assert.ok(entry.title.length > 0);
  }
});

test('개정안의 ISA 이월 폐지가 잔여 한도를 줄인다', () => {
  const request = baseRequest({
    scenarios: ['current', 'proposed'],
    accounts: { isa: { years_since_opening: 4 } },
  });
  const response = compute(request, rulesets);

  const isaOf = (id) =>
    scenarioOf(response, id).limits.by_account.find((l) => l.account === 'isa')
      .contribution_limit_remaining_krw;

  assert.ok(isaOf('proposed') < isaOf('current'), '이월이 사라지면 그 해에 넣을 수 있는 금액이 준다');
});

test('청년 여부는 엔진이 판정하지 않는다', () => {
  const notDeclared = scenarioOf(
    compute(baseRequest({ scenarios: ['proposed'], profile: { birth_date: birthDateForAge(25) } }), rulesets),
    'proposed',
  );
  assert.ok(noticeCodes(notDeclared).includes('youth_status_not_declared'));

  const declared = scenarioOf(
    compute(
      baseRequest({ scenarios: ['proposed'], profile: { birth_date: birthDateForAge(25), declared_youth: true } }),
      rulesets,
    ),
    'proposed',
  );
  assert.ok(noticeCodes(declared).includes('youth_age_range_undetermined'));
});

test('청년 우대는 소득 경계 위에서 IRP 절세액을 실제로 올린다', () => {
  const overBoundary =
    confirmedRule('pension.credit.rate').value.brackets[0].total_salary_only_max_krw + 1;
  const patch = {
    scenarios: ['proposed'],
    profile: {
      current_year_total_salary_krw: overBoundary,
      monthly_capacity_krw: 5_000_000,
      birth_date: birthDateForAge(25),
    },
  };

  const plain = planOf(
    scenarioOf(compute(baseRequest(patch), rulesets), 'proposed'),
    'max_tax_credit',
  ).deterministic_benefit;
  const youth = planOf(
    scenarioOf(
      compute(baseRequest({ ...patch, profile: { ...patch.profile, declared_youth: true } }), rulesets),
      'proposed',
    ),
    'max_tax_credit',
  ).deterministic_benefit;

  assert.equal(youth.credit_eligible_contribution_krw, plain.credit_eligible_contribution_krw);
  assert.ok(youth.pension_credit_total_krw > plain.pension_credit_total_krw);
});

test('확정 시나리오에는 개정예고 규칙이 한 건도 실리지 않는다', () => {
  const current = scenarioOf(compute(baseRequest({ scenarios: ['current'] }), rulesets));

  assert.deepStrictEqual(current.unapplied_proposed_rules, []);
  for (const entry of current.legal_basis) {
    assert.equal(entry.bill_stage, null);
    assert.equal(entry.status, rulesets[CONFIRMED_FILE].status);
  }
  assert.equal(current.ruleset.files.length, 1);
});

test('불확실성 표시가 있는 규칙은 근거에 그 사실이 붙는다', () => {
  const scenario = scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: 5_000_000 } }), rulesets));
  const taxFree = scenario.legal_basis.find((e) => e.rule_id === 'isa.tax_free_limit');

  assert.ok(taxFree, '비과세 한도를 표시했으면 그 근거가 실려야 한다');
  assert.equal(taxFree.has_uncertainty_note, true);
});

test('근거에는 실제로 읽은 규칙만 담긴다', () => {
  const scenario = scenarioOf(compute(baseRequest({ profile: { monthly_capacity_krw: 100_000 } }), rulesets));
  const ids = scenario.legal_basis.map((e) => e.rule_id);

  assert.equal(ids.includes('pension.credit.isa_transfer.extra_limit'), false, '전환이 없으면 읽지 않는다');
  assert.ok(ids.includes('pension.credit.rate'));
  for (const entry of scenario.legal_basis) {
    assert.ok(entry.applied_to.length > 0, `${entry.rule_id}이 어디에 쓰였는지가 없다`);
  }
});
