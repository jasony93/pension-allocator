// 확정 축의 최댓값(D36)과 연금 저율과세 세율표의 동작 고정.
//
// **여기의 기대값은 룰셋에서 읽어 만든다.** 세법 수치를 옮겨 적으면 이 파일이 두 번째
// 진실 원천이 되고, 룰셋이 바뀌어도 조용히 통과한다.
//
// 이 파일이 실제로 무는 것은 셋이다.
//   1. 축의 끝이 **총급여에 따라 달라진다**(공제율 구간 둘로 못 박는다).
//   2. 축의 끝이 **소득세분이 아니라 합계**다 — 아니면 막대가 트랙 밖으로 나간다(I39).
//   3. 세율표가 **입력에 반응하지 않고**(I40) 금액 칸을 갖지 않는다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  CONFIRMED_FILE,
  PROPOSED_FILE,
  baseRequest,
  cloneRulesets,
  findRule,
  loadRulesets,
  noticeCodes,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const confirmedRule = (id) => findRule(rulesets, CONFIRMED_FILE, id);

const RATE_BRACKETS = confirmedRule('pension.credit.rate').value.brackets;
/** 우대 구간 = 총급여 상한이 있는 쪽. 본문 구간 = 상한이 없는 쪽. */
const PREFERRED = RATE_BRACKETS.find((b) => b.total_salary_only_max_krw !== null);
const DEFAULT_BRACKET = RATE_BRACKETS.find((b) => b.total_salary_only_max_krw === null);
const SURTAX_RATE = confirmedRule('tax.local.personal_income_surtax').value.rate_of_income_tax;
const COMBINED_LIMIT = confirmedRule('pension.credit.limit.combined').value.amount_krw;
const TRANSFER_RULE = confirmedRule('pension.credit.isa_transfer.extra_limit').value;
const YOUTH_RATE = findRule(rulesets, PROPOSED_FILE, 'proposed.pension.credit.youth_irp_rate').value
  .rate;

/** 세액공제액을 만드는 두 단계. 엔진과 **같은 절사 규율**이라야 대조가 뜻을 갖는다. */
function creditOf(baseKrw, incomeTaxRate) {
  const incomeTax = Math.floor(baseKrw * incomeTaxRate);
  const localTax = Math.floor(incomeTax * SURTAX_RATE);
  return { incomeTax, localTax, total: incomeTax + localTax };
}

/** 우대 구간 경계 바로 아래·바로 위. 두 좌표가 서로 다른 공제율 구간에 든다. */
const SALARY_IN_PREFERRED = PREFERRED.total_salary_only_max_krw;
const SALARY_ABOVE_PREFERRED = PREFERRED.total_salary_only_max_krw + 1;

function ceilingFor(overrides = {}) {
  return scenarioOf(compute(baseRequest(overrides), rulesets)).pension_credit_ceiling;
}

// ── 1. 축의 끝이 총급여에 따라 달라진다 ────────────────────────────────────────

test('공제율 구간이 갈리면 확정 축의 최댓값도 갈린다 — 경계 위아래 두 좌표', () => {
  const inside = ceilingFor({ profile: { current_year_total_salary_krw: SALARY_IN_PREFERRED } });
  const above = ceilingFor({ profile: { current_year_total_salary_krw: SALARY_ABOVE_PREFERRED } });

  assert.equal(inside.income_tax_rate, PREFERRED.rate);
  assert.equal(above.income_tax_rate, DEFAULT_BRACKET.rate);

  assert.equal(inside.ceiling_krw, creditOf(COMBINED_LIMIT, PREFERRED.rate).total);
  assert.equal(above.ceiling_krw, creditOf(COMBINED_LIMIT, DEFAULT_BRACKET.rate).total);

  // 경계값 자체는 우대 구간에 든다(법문이 '이하'다). 1원 넘으면 본문 구간이다.
  assert.ok(inside.ceiling_krw > above.ceiling_krw, '우대 구간의 상한이 더 커야 한다');
});

test('축의 끝은 소득세분이 아니라 소득세분 + 지방소득세분이다', () => {
  const ceiling = ceilingFor({ profile: { current_year_total_salary_krw: SALARY_IN_PREFERRED } });
  const expected = creditOf(COMBINED_LIMIT, PREFERRED.rate);

  assert.equal(ceiling.income_tax_krw, expected.incomeTax);
  assert.equal(ceiling.local_tax_krw, expected.localTax);
  assert.equal(ceiling.ceiling_krw, ceiling.income_tax_krw + ceiling.local_tax_krw);

  // **이 한 줄이 designer의 정의를 기각한 근거다.** 소득세분으로 축을 만들면
  // 한도를 채운 사람의 막대 길이가 1을 넘는다.
  assert.ok(
    ceiling.ceiling_krw / ceiling.income_tax_krw > 1,
    '소득세분으로 축을 만들면 막대가 트랙 밖으로 나간다',
  );
});

test('ISA 전환 추가한도가 붙으면 축의 끝이 그만큼 커진다', () => {
  const transferKrw = Math.floor(TRANSFER_RULE.cap_krw / TRANSFER_RULE.rate);
  const request = {
    profile: { current_year_total_salary_krw: SALARY_IN_PREFERRED },
    accounts: { isa: { cumulative_contribution_krw: transferKrw } },
    isa_transfer: {
      amount_krw: transferKrw,
      destination: 'retirement_pension',
      prior_year_applied_krw: 0,
    },
  };
  const withTransfer = ceilingFor(request);
  const without = ceilingFor({ profile: { current_year_total_salary_krw: SALARY_IN_PREFERRED } });

  assert.ok(withTransfer.isa_transfer_extra_limit_krw > 0);
  assert.equal(
    withTransfer.credit_limit_krw,
    COMBINED_LIMIT + withTransfer.isa_transfer_extra_limit_krw,
  );
  assert.equal(
    withTransfer.ceiling_krw,
    creditOf(withTransfer.credit_limit_krw, PREFERRED.rate).total,
  );
  assert.ok(withTransfer.ceiling_krw > without.ceiling_krw);
});

// ── 2. 막대가 축을 넘지 않는다 (I39) ──────────────────────────────────────────

/** 한도를 다 채우고도 남을 예산. 세액 한도는 넉넉히 둬 자르기 전 값을 본다. */
const FILL_BUDGET = {
  profile: {
    monthly_capacity_krw: 3_000_000,
    prior_year_tax: { state: 'amount', determined_tax_krw: 9_000_000, pension_credit_applied_krw: 0 },
  },
};

test('I39 — 어떤 배분안의 자르기 전 공제액도 축의 끝을 넘지 않는다', () => {
  for (const salary of [SALARY_IN_PREFERRED, SALARY_ABOVE_PREFERRED]) {
    const scenario = scenarioOf(
      compute(
        baseRequest({
          ...FILL_BUDGET,
          profile: { ...FILL_BUDGET.profile, current_year_total_salary_krw: salary },
        }),
        rulesets,
      ),
    );
    const ceiling = scenario.pension_credit_ceiling.ceiling_krw;
    for (const plan of scenario.plans) {
      assert.ok(
        plan.deterministic_benefit.pension_credit_total_before_cap_krw <= ceiling,
        `${plan.plan_id}: 자르기 전 공제액이 축의 끝을 넘었다`,
      );
    }
  }
});

test('한도를 전액 채운 배분안의 공제액이 축의 끝과 정확히 같다 — 축이 도달 가능하다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        ...FILL_BUDGET,
        profile: { ...FILL_BUDGET.profile, current_year_total_salary_krw: SALARY_IN_PREFERRED },
      }),
      rulesets,
    ),
  );
  const plan = scenario.plans.find(
    (p) => p.deterministic_benefit.credit_eligible_contribution_krw === COMBINED_LIMIT,
  );
  assert.ok(plan, '합산 한도를 전액 채운 안이 있어야 이 시험이 뜻을 갖는다');
  assert.equal(
    plan.deterministic_benefit.pension_credit_total_before_cap_krw,
    scenario.pension_credit_ceiling.ceiling_krw,
  );
});

test('개정안의 청년 우대가 본문 구간보다 높으면 그 율이 축을 정한다', () => {
  // 소득이 경계 위인 청년. 본문 구간(낮은 율)으로 축을 만들면 실제 공제액이 축을 넘는다.
  const response = compute(
    baseRequest({
      ...FILL_BUDGET,
      scenarios: ['proposed'],
      profile: {
        ...FILL_BUDGET.profile,
        current_year_total_salary_krw: SALARY_ABOVE_PREFERRED,
        declared_youth: true,
      },
    }),
    rulesets,
  );
  const scenario = scenarioOf(response, 'proposed');
  const ceiling = scenario.pension_credit_ceiling;

  assert.ok(YOUTH_RATE > DEFAULT_BRACKET.rate, '이 시험은 우대율이 본문 구간보다 높을 때만 뜻이 있다');
  assert.equal(ceiling.income_tax_rate, YOUTH_RATE);
  assert.equal(ceiling.rate_source_code, 'proposed_youth_irp_rate');
  assert.equal(ceiling.ceiling_krw, creditOf(COMBINED_LIMIT, YOUTH_RATE).total);

  for (const plan of scenario.plans) {
    assert.ok(
      plan.deterministic_benefit.pension_credit_total_before_cap_krw <= ceiling.ceiling_krw,
      `${plan.plan_id}: 청년 우대 좌표에서 막대가 축을 넘었다`,
    );
  }
});

test('청년이 아니면 개정안에서도 축을 정하는 율이 공제율 구간 그대로다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        scenarios: ['proposed'],
        profile: { current_year_total_salary_krw: SALARY_ABOVE_PREFERRED, declared_youth: false },
      }),
      rulesets,
    ),
    'proposed',
  );
  assert.equal(scenario.pension_credit_ceiling.rate_source_code, 'credit_rate_bracket');
  assert.equal(scenario.pension_credit_ceiling.income_tax_rate, DEFAULT_BRACKET.rate);
});

// ── 3. 불확실성 규약을 물려받는다 ─────────────────────────────────────────────

test('공제율 구간을 모르면 축의 끝도 과소 방향임을 함께 낸다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          has_non_wage_global_income_current_year: true,
          current_year_global_income_krw: null,
        },
      }),
      rulesets,
    ),
  );
  const ceiling = scenario.pension_credit_ceiling;
  const bracket = compute(
    baseRequest({
      profile: {
        has_non_wage_global_income_current_year: true,
        current_year_global_income_krw: null,
      },
    }),
    rulesets,
  ).echo.credit_rate_bracket;

  assert.equal(ceiling.fallback_applied, true);
  assert.equal(ceiling.fallback_direction_code, 'understated_or_equal');
  // **같은 값이어야 한다.** 두 자리가 갈리면 화면이 금액과 캡션에 다른 표기를 붙인다.
  assert.equal(ceiling.fallback_applied, bracket.fallback_applied);
  assert.equal(ceiling.basis_code, bracket.basis_code);
  assert.equal(ceiling.measured_amount_krw, bracket.measured_amount_krw);
  assert.equal(ceiling.income_tax_rate, bracket.income_tax_rate);
});

test('공제율 구간이 갈려도 막대 길이의 비는 거의 움직이지 않는다 — 흔들리는 것은 캡션의 금액이다', () => {
  const ratios = [SALARY_IN_PREFERRED, SALARY_ABOVE_PREFERRED].map((salary) => {
    const scenario = scenarioOf(
      compute(
        baseRequest({
          ...FILL_BUDGET,
          profile: { ...FILL_BUDGET.profile, current_year_total_salary_krw: salary },
        }),
        rulesets,
      ),
    );
    const plan = scenario.plans[0];
    return (
      plan.deterministic_benefit.pension_credit_total_before_cap_krw /
      scenario.pension_credit_ceiling.ceiling_krw
    );
  });
  // 분자와 분모가 같은 율로 함께 움직이므로 실수 산술에서는 정확히 상쇄되고
  // 정수에서는 절사만큼만 어긋난다.
  assert.ok(Math.abs(ratios[0] - ratios[1]) < 1e-6, `비가 크게 갈렸다: ${ratios}`);
});

// ── 4. 산출세액 한도와의 관계 ─────────────────────────────────────────────────

test('한도가 상한보다 낮으면 그 사실을 코드로 내되 축의 끝은 내리지 않는다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        ...FILL_BUDGET,
        profile: {
          ...FILL_BUDGET.profile,
          current_year_total_salary_krw: SALARY_IN_PREFERRED,
          prior_year_tax: {
            state: 'amount',
            determined_tax_krw: 1,
            pension_credit_applied_krw: 0,
          },
        },
      }),
      rulesets,
    ),
  );
  const ceiling = scenario.pension_credit_ceiling;
  assert.equal(ceiling.tax_liability_cap_relation_code, 'cap_below_ceiling');
  // **축은 그대로다.** 한도로 축을 줄이면 잘린 몫이 그림에서 사라진다(9.2절).
  assert.equal(ceiling.ceiling_krw, creditOf(COMBINED_LIMIT, PREFERRED.rate).total);
  assert.equal(ceiling.is_axis_degenerate, false);

  const plan = scenario.plans[0];
  assert.equal(plan.deterministic_benefit.tax_liability_cap.applied, true);
  // 빈 트랙의 길이가 「낼 세금 때문에 반영되지 않은 몫」을 그대로 보인다.
  assert.ok(plan.deterministic_benefit.pension_credit_total_krw < ceiling.ceiling_krw);
});

test('한도가 0이어도 축은 무너지지 않는다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        ...FILL_BUDGET,
        profile: {
          ...FILL_BUDGET.profile,
          current_year_total_salary_krw: SALARY_IN_PREFERRED,
          prior_year_tax: {
            state: 'zero',
            determined_tax_krw: null,
            pension_credit_applied_krw: 0,
          },
        },
      }),
      rulesets,
    ),
  );
  const ceiling = scenario.pension_credit_ceiling;
  assert.equal(scenario.pension_credit_tax_liability_cap.cap_krw, 0);
  assert.equal(ceiling.tax_liability_cap_relation_code, 'cap_below_ceiling');
  assert.ok(ceiling.ceiling_krw > 0, '한도가 0이어도 축의 끝은 조문이 정하는 값이다');
  assert.equal(ceiling.is_axis_degenerate, false);
});

test('한도를 모르면 관계도 모른다고 적는다 — 지어내지 않는다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          prior_year_tax: {
            state: 'unknown',
            determined_tax_krw: null,
            pension_credit_applied_krw: null,
          },
        },
      }),
      rulesets,
    ),
  );
  assert.equal(scenario.pension_credit_ceiling.tax_liability_cap_relation_code, 'cap_unknown');
});

test('한도와의 비교는 소득세분끼리 한다 — 합계와 비교하면 경계가 어긋난다', () => {
  const expected = creditOf(COMBINED_LIMIT, PREFERRED.rate);
  // 한도를 소득세분과 정확히 같게 둔다. 합계와 비교하는 구현이라면 여기서 below가 나온다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          current_year_total_salary_krw: SALARY_IN_PREFERRED,
          prior_year_tax: {
            state: 'amount',
            determined_tax_krw: expected.incomeTax,
            pension_credit_applied_krw: 0,
          },
        },
      }),
      rulesets,
    ),
  );
  assert.equal(
    scenario.pension_credit_ceiling.tax_liability_cap_relation_code,
    'cap_at_or_above_ceiling',
  );
});

// ── 5. 룰셋을 바꾸면 축이 따라 움직인다 ───────────────────────────────────────

test('합산 한도를 바꾸면 축의 끝이 따라 바뀐다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'pension.credit.limit.combined');
  rule.value.amount_krw = Math.floor(rule.value.amount_krw / 2);

  const after = scenarioOf(compute(baseRequest(), patched)).pension_credit_ceiling;
  assert.equal(after.credit_limit_krw, rule.value.amount_krw);
  assert.equal(after.ceiling_krw, creditOf(rule.value.amount_krw, PREFERRED.rate).total);
});

test('지방소득세 부가율을 바꾸면 축의 끝이 따라 바뀐다 — 실효율 상수가 없다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'tax.local.personal_income_surtax');
  rule.value.rate_of_income_tax = 0.2;

  const after = scenarioOf(compute(baseRequest(), patched)).pension_credit_ceiling;
  const incomeTax = Math.floor(COMBINED_LIMIT * PREFERRED.rate);
  assert.equal(after.local_tax_krw, Math.floor(incomeTax * 0.2));
  assert.equal(after.ceiling_krw, incomeTax + after.local_tax_krw);
});

// ── 6. 연금 저율과세 세율표 ───────────────────────────────────────────────────

const reference = () => scenarioOf(compute(baseRequest(), rulesets)).pension_withdrawal_tax_reference;

test('금액이 아니라 세율만 낸다 — 혜택 금액을 실을 칸이 없다', () => {
  const ref = reference();
  assert.equal(ref.computability_code, 'not_computable_by_design');

  // 이 객체 전체에서 `_krw`로 끝나는 칸은 조문의 기준금액 하나뿐이다.
  const amountKeys = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((item, i) => walk(item, `${path}[${i}]`));
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.endsWith('_krw')) amountKeys.push(`${path}.${key}`);
      walk(value, `${path}.${key}`);
    }
  };
  walk(ref, 'reference');
  assert.deepStrictEqual(amountKeys, ['reference.separate_taxation_threshold_krw']);
  assert.equal(
    ref.separate_taxation_threshold_krw,
    confirmedRule('pension.income.separate_taxation.threshold').value.amount_krw,
  );
});

test('I40 — 세율표는 요청의 어떤 값에도 반응하지 않는다', () => {
  // **좌표를 고를 때 「값이 갈리는 축」을 일부러 넣는다.** 비슷한 요청만 늘어놓으면
  // 입력에 반응하는 구현을 넣어도 전부 같은 답이 나와 검사가 아무것도 증명하지 못한다.
  // 실제로 그런 상태였고 결함 주입이 잡았다 — 납입 여력 0과 한도를 다 채우는 좌표를
  // 함께 두어야 「반응한다」가 값으로 드러난다.
  const variants = [
    ['납입 여력 0', baseRequest({ profile: { monthly_capacity_krw: 0 } }), 'current'],
    ['한도를 다 채움', baseRequest({ profile: { monthly_capacity_krw: 3_000_000 } }), 'current'],
    [
      '사용 시점 미상 · ISA 없음',
      baseRequest({
        profile: { fund_use_horizon: 'unknown' },
        accounts: { isa: { exists: false, account_type: null } },
      }),
      'current',
    ],
    [
      '고령·고소득·수익률 가정',
      baseRequest({
        profile: {
          birth_date: '1950-01-02',
          current_year_total_salary_krw: 200_000_000,
          isa_return_assumption: {
            annual_return_rate: 0.07,
            income_character: 'interest_dividend',
            settlement_years: 5,
            loss_amount_krw: 0,
          },
        },
      }),
      'current',
    ],
    [
      '세액 한도를 모름',
      baseRequest({
        profile: {
          prior_year_tax: {
            state: 'unknown',
            determined_tax_krw: null,
            pension_credit_applied_krw: null,
          },
        },
      }),
      'current',
    ],
    // **시나리오가 갈려도 같아야 한다.** 이 표를 만드는 규칙은 전부 확정 룰셋에 있다.
    [
      '개정안 시나리오 · 청년',
      baseRequest({ scenarios: ['proposed'], profile: { declared_youth: true } }),
      'proposed',
    ],
  ];

  const first = JSON.stringify(reference());
  for (const [label, request, scenarioId] of variants) {
    assert.equal(
      JSON.stringify(
        scenarioOf(compute(request, rulesets), scenarioId).pension_withdrawal_tax_reference,
      ),
      first,
      `${label}: 입력에 반응하면 「새 입력 0개·가정 0개」가 깨진다`,
    );
  }
});

test('세율표의 실효율은 부가율 규칙에서 산출된다 — 룰셋의 참고 칸을 읽지 않는다', () => {
  const patched = cloneRulesets(rulesets);
  findRule(patched, CONFIRMED_FILE, 'tax.local.personal_income_surtax').value.rate_of_income_tax = 0.2;

  const after = scenarioOf(compute(baseRequest(), patched)).pension_withdrawal_tax_reference;
  for (const row of after.rate_table) {
    if (row.income_tax_rate === null) {
      assert.equal(row.effective_rate, null);
      continue;
    }
    assert.ok(
      Math.abs(row.effective_rate - row.income_tax_rate * 1.2) < 1e-9,
      `${row.situation_code}: 실효율이 부가율을 따라오지 않았다`,
    );
  }
});

test('부호는 뺄셈의 결과다 — 룰셋의 부호 서술과 일치한다', () => {
  const ref = reference();
  const caseOf = (character, branch) =>
    ref.rate_gap_cases.find(
      (row) => row.income_character_code === character && row.withdrawal_branch_code === branch,
    );

  // 룰셋 `the_sign.cases`가 스스로 적은 결론. **이 파일이 세운 답이 아니다.**
  const signCases = confirmedRule('pension.rate_gap.quantifiability').value.the_sign.cases;
  const byWidth = (width) => signCases.find((row) => row['폭'] === width);

  const annuity = caseOf('interest_dividend', 'annuity_within_threshold');
  assert.equal(annuity.sign_code, 'positive');
  assert.ok(
    byWidth(
      `+${(annuity.gap_min_rate * 100).toFixed(1)}%p ~ +${(annuity.gap_max_rate * 100).toFixed(1)}%p`,
    ),
    '계산한 폭이 룰셋이 적은 폭과 다르다',
  );

  const nonAnnuity = caseOf('interest_dividend', 'non_annuity');
  assert.equal(nonAnnuity.sign_code, 'negative');
  assert.ok(
    byWidth(`−${Math.abs(nonAnnuity.gap_min_rate * 100).toFixed(1)}%p`),
    '계산한 폭이 룰셋이 적은 폭과 다르다',
  );

  // 계좌 밖 세율이 0인 성격은 어느 인출 방식에서도 음수다.
  for (const branch of ['annuity_within_threshold', 'non_annuity']) {
    assert.equal(caseOf('listed_equity_capital_gain', branch).sign_code, 'negative');
  }

  // 기준금액 초과 갈래는 조문이 하한을 닫지 않는다. 지어내지 않는다.
  const over = caseOf('interest_dividend', 'annuity_over_threshold');
  assert.equal(over.sign_code, 'not_determined');
  assert.equal(over.gap_min_rate, null);
  assert.deepStrictEqual(over.undetermined_situation_codes, [
    'pension_annuity_over_separate_threshold',
  ]);

  // 성격이 섞이면 구간이 0을 가로지른다 — D36이 막대를 기각한 근거다.
  const mixed = caseOf('mixed_or_unknown', 'any');
  assert.equal(mixed.sign_code, 'crosses_zero');
  assert.ok(mixed.gap_min_rate < 0 && mixed.gap_max_rate > 0);
});

test('세율표가 옮겨 적은 원 규칙과 세율 집합이 어긋나면 계산을 멈춘다', () => {
  const patched = cloneRulesets(rulesets);
  const byAge = findRule(patched, CONFIRMED_FILE, 'pension.income.withholding_rate.by_age');
  byAge.value.brackets[0].rate = 0.07; // 표에 없는 율

  const response = compute(baseRequest(), patched);
  assert.equal(response.ok, false);
  assert.ok(
    response.errors.some((error) => error.code === 'rule_missing'),
    '전사가 낡은 것을 조용히 통과시키면 화면이 낡은 세율을 그린다',
  );
});

test('분류할 수 없는 상황 이름이 생기면 지어내지 않고 멈춘다', () => {
  const patched = cloneRulesets(rulesets);
  const rule = findRule(patched, CONFIRMED_FILE, 'pension.rate_gap.quantifiability');
  rule.value.rate_table.rows[0].situation_code = 'something_new';

  assert.equal(compute(baseRequest(), patched).ok, false);
});

test('세율표의 조문 인용은 룰셋에서 온다 — 화면이 지어낼 자리가 없다', () => {
  const rows = confirmedRule('pension.rate_gap.quantifiability').value.rate_table.rows;
  for (const row of reference().rate_table) {
    const source = rows.find((r) => r.situation_code === row.situation_code);
    assert.equal(row.law, source.law);
    assert.equal(row.description, source['설명']);
  }
});

// ── 7. 세율차 축의 0 ─────────────────────────────────────────────────────────

/** 순소득이 비과세 한도를 정확히 `excess`원 넘도록 맞춘 요청. */
function estimateWithExcess(excessKrw) {
  const taxFreeLimit = confirmedRule('isa.tax_free_limit').value.brackets.find(
    (bracket) => bracket.prev_total_salary_max_krw === null,
  ).limit_krw;
  const settlementYears = confirmedRule('isa.account.requirements').value.min_contract_years;
  const rate = 0.1;
  const target = taxFreeLimit + excessKrw;

  // 순소득이 정확히 `target`이 되는 원금을 찾는다. 엔진과 같은 정수 산술을 쓴다 —
  // 나눗셈으로 되돌려 계산하면 그 자리에서 또 절사가 생겨 좌표가 어긋난다.
  let principal = Math.ceil((target * 10) / settlementYears);
  const netOf = (p) => Math.floor((p * settlementYears) / 10);
  while (netOf(principal) < target) principal += 1;
  assert.equal(netOf(principal), target, '원하는 순소득에 정확히 닿는 원금을 찾지 못했다');

  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          monthly_capacity_krw: 0,
          isa_return_assumption: {
            annual_return_rate: rate,
            income_character: 'interest_dividend',
            settlement_years: settlementYears,
            loss_amount_krw: 0,
          },
        },
        accounts: { isa: { cumulative_contribution_krw: principal, account_type: 'general' } },
      }),
      rulesets,
    ),
  );
  return { scenario, estimate: scenario.plans[0].assumption_based_isa_estimate };
}

test('순소득이 한도 이하면 세율차 축의 0이 「더 유리한 사실」로 표시된다', () => {
  const { scenario, estimate } = estimateWithExcess(0);
  assert.equal(estimate.net_income_krw, estimate.tax_free_limit_krw);
  assert.equal(estimate.axis_breakdown.rate_gap_krw, 0);
  assert.equal(estimate.rate_gap_axis_zero_reason_code, 'within_tax_free_limit');
  assert.ok(noticeCodes(scenario).includes('isa_rate_gap_axis_zero_because_within_tax_free_limit'));
});

// **경계는 `N = C + 1`이다.** `tax-domain`이 든 예(`N = C + 1`원인 사용자의 축은 여전히
// 0원이다)를 그대로 좌표로 쓴다. 그 사람은 이미 저율 분리과세 구간에 들어와 있으므로
// 「한도 안이라 0%로 과세된다」가 거짓이고, 축의 0으로 판정하면 화면이 거기서 거짓말한다.
test('경계 — 한도를 1원 넘으면 축은 여전히 0이지만 그 0은 다른 사실이다', () => {
  const { scenario, estimate } = estimateWithExcess(1);
  assert.ok(estimate.net_income_krw > estimate.tax_free_limit_krw);
  // 절사 때문에 축은 아직 0이다. **화면이 `rate_gap_krw === 0`으로 판정하면 여기서 거짓말한다.**
  assert.equal(estimate.axis_breakdown.rate_gap_krw, 0);
  assert.equal(estimate.rate_gap_axis_zero_reason_code, null);
  assert.equal(
    noticeCodes(scenario).includes('isa_rate_gap_axis_zero_because_within_tax_free_limit'),
    false,
  );
});

test('초과분이 커져 축이 실제로 열려도 코드는 그대로 null이다', () => {
  const { estimate } = estimateWithExcess(200);
  assert.ok(estimate.axis_breakdown.rate_gap_krw > 0);
  assert.equal(estimate.rate_gap_axis_zero_reason_code, null);
});

test('세 축이 점인지 위 끝인지를 값으로 낸다', () => {
  const requestFor = (character) =>
    baseRequest({
      profile: {
        monthly_capacity_krw: 500_000,
        isa_return_assumption: {
          annual_return_rate: 0.05,
          income_character: character,
          settlement_years: 3,
          loss_amount_krw: 0,
        },
      },
    });

  const point = scenarioOf(compute(requestFor('interest_dividend'), rulesets)).plans[0]
    .assumption_based_isa_estimate;
  assert.equal(point.point_estimate_krw !== null, true);
  assert.equal(point.axis_breakdown_bound_code, 'point');

  const range = scenarioOf(compute(requestFor('mixed_or_unknown'), rulesets)).plans[0]
    .assumption_based_isa_estimate;
  assert.equal(range.point_estimate_krw, null);
  assert.equal(range.axis_breakdown_bound_code, 'upper_bound');
});

test('가정을 보내지 않으면 두 새 칸이 조용히 사라지지 않고 null로 남는다', () => {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        options: { assumption_based_isa_estimate: 'suppress' },
        profile: {
          isa_return_assumption: {
            annual_return_rate: 0.05,
            income_character: 'interest_dividend',
            settlement_years: 3,
            loss_amount_krw: 0,
          },
        },
      }),
      rulesets,
    ),
  );
  const estimate = scenario.plans[0].assumption_based_isa_estimate;
  assert.equal(estimate.state, 'display_suppressed');
  assert.ok('axis_breakdown_bound_code' in estimate);
  assert.ok('rate_gap_axis_zero_reason_code' in estimate);
  assert.equal(estimate.axis_breakdown_bound_code, null);
  assert.equal(estimate.rate_gap_axis_zero_reason_code, null);
});
