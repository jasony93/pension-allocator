// 결함 주입 — **새 검사가 실제로 무는지**를 확인한다.
//
// 이 저장소는 "통과만 하는 테스트는 아무것도 증명하지 않는다"를 두 번 실증했다.
// 지난 회차들에서 통과하면서 아무것도 막지 못하는 테스트를 두 번 찾아냈고, 게이트 4의
// `qa`는 불변식을 고의로 깨뜨려 확인했다. 여기서는 같은 절차를 **룰셋 사본을 변형해**
// 수행한다 — `data/tax-rules/`의 원본은 한 글자도 건드리지 않는다.
//
// 각 테스트의 형태는 하나다. **"이 값이 룰셋에서 온 것이 아니라면 이 변형으로도
// 답이 그대로일 것이다."** 답이 그대로면 실패한다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { uncertaintyNotesIn } from './ruleset.mjs';
import {
  CONFIRMED_FILE,
  baseRequest,
  cloneRulesets,
  errorCodes,
  findRule,
  loadRulesets,
  noticeCodes,
  planOf,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const FULL = { profile: { monthly_capacity_krw: 5_000_000 } };

function withMutation(mutate) {
  const clone = cloneRulesets(rulesets);
  mutate(clone);
  return clone;
}

// ── 공제율 판정 축 (D27) ─────────────────────────────────────────

test('판정 기준 규칙이 없으면 총급여로 조용히 되돌아가지 않고 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const doc = clone[CONFIRMED_FILE];
    doc.rules = doc.rules.filter((r) => r.id !== 'pension.credit.rate.basis_determination');
  });

  const response = compute(baseRequest(), mutated);
  assert.equal(response.ok, false, '규칙이 없는데 계산이 끝났다 — 판정 축이 코드에 박혀 있다는 뜻이다');
  assert.ok(errorCodes(response).includes('rule_missing'));
});

test('규칙이 두 단계를 선언하지 않으면 멈춘다 — 구조에 실제로 매여 있다', () => {
  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.rate.basis_determination');
    // 금액 단계를 지운다. "예/아니오만으로 충분하다"는 룰셋이 되는 셈이다.
    rule.value.required_inputs.decision_order = rule.value.required_inputs.decision_order.filter(
      (step) => step.type === 'boolean',
    );
  });

  assert.equal(compute(baseRequest(), mutated).ok, false);
});

test('구간 경계를 옮기면 판정도 따라 옮겨진다 — 경계가 코드에 없다', () => {
  const original = compute(
    baseRequest({ profile: { current_year_total_salary_krw: 40_000_000 } }),
    rulesets,
  );
  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.rate');
    rule.value.brackets[0].total_salary_only_max_krw = 39_999_999;
  });
  const after = compute(
    baseRequest({ profile: { current_year_total_salary_krw: 40_000_000 } }),
    mutated,
  );

  assert.notEqual(
    after.echo.credit_rate_bracket.income_tax_rate,
    original.echo.credit_rate_bracket.income_tax_rate,
  );
});

test('금액을 모를 때의 대체 정책이 규칙에서 사라지면 멈춘다', () => {
  const request = baseRequest({
    profile: { has_non_wage_global_income_current_year: true, current_year_global_income_krw: null },
  });
  assert.equal(compute(request, rulesets).ok, true);

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.rate.basis_determination');
    delete rule.value.unknown_value_policy;
  });
  assert.equal(compute(request, mutated).ok, false, '대체값 정책을 엔진이 스스로 지어냈다');
});

// ── ISA 유형 교차확인 (D27의 "번지는 곳") ────────────────────────

test('조문 구조가 없으면 any_of로 되돌아가지 않고 멈춘다', () => {
  const request = baseRequest({
    profile: { prior_year_total_salary_krw: 60_000_000 },
    accounts: { isa: { account_type: 'low_income' } },
  });
  assert.ok(noticeCodes(scenarioOf(compute(request, rulesets))).includes('isa_type_conflicts_with_prior_income'));

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'isa.tax_free_limit');
    delete rule.value.brackets_statutory;
  });
  const response = compute(request, mutated);

  // `brackets`의 `match: "any_of"`는 여전히 그 자리에 있다. 옛 코드는 그것으로
  // 계산을 이어 갔고, 그래서 잘못된 결론을 냈다. 이제는 멈춘다.
  assert.equal(response.ok, false, 'any_of가 남아 있어도 그것으로 되돌아가지 않는다');
  assert.ok(errorCodes(response).includes('rule_missing'));
});

test('한정 문구가 사라지면 결론을 회복한다 — 결론 보류가 그 문구에 실제로 매여 있다', () => {
  // 지금은 세 목 전부에 확인할 수 없는 한정·위임이 붙어 있어 "당신은 서민형이다"를
  // 결론짓지 못한다. 그 한정을 지운 룰셋에서는 결론이 되살아나야 한다.
  const request = baseRequest({
    profile: { prior_year_total_salary_krw: 40_000_000 },
    accounts: { isa: { account_type: 'general' } },
  });
  assert.ok(
    noticeCodes(scenarioOf(compute(request, rulesets))).includes('isa_type_cross_check_inconclusive'),
  );

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'isa.tax_free_limit');
    for (const item of rule.value.brackets_statutory.items) {
      delete item.restriction;
      delete item.delegated;
    }
  });
  const codes = noticeCodes(scenarioOf(compute(request, mutated)));

  assert.ok(codes.includes('isa_type_conflicts_with_prior_income'), '한정이 없으면 결론을 낼 수 있다');
  assert.equal(codes.includes('isa_type_cross_check_inconclusive'), false);
});

// ── 공제 없는 납입에 붙는 사실 (D26) ─────────────────────────────

test('확인 절차가 자동이라고 적힌 룰셋에서는 그 사실이 따라 바뀐다', () => {
  const factsOf = (bundle) => {
    const plan = planOf(scenarioOf(compute(baseRequest(FULL), bundle)), 'pension_contribution_limit_fill');
    return plan.non_quantified_effects.find((e) => e.code === 'pension_contribution_without_credit').facts;
  };

  assert.equal(factsOf(rulesets).principal_tax_free_requires_confirmation, true);

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.withdrawal.non_deducted_principal');
    rule.value.confirmation_procedure.automatic = true;
  });
  assert.equal(
    factsOf(mutated).principal_tax_free_requires_confirmation,
    false,
    '이 사실이 코드에 박혀 있으면 룰셋을 바꿔도 true로 남는다',
  );
});

test('조문이 정한 효과 목록이 불완전하면 사실을 지어내지 않고 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.contribution.beyond_credit_limit');
    rule.value.effects = rule.value.effects.filter((e) => e.id !== 'returns_taxed_on_withdrawal');
  });

  assert.equal(compute(baseRequest(FULL), mutated).ok, false);
});

test('전환 특례의 조건이 룰셋에서 바뀌면 응답도 따라 바뀐다', () => {
  const capOf = (bundle) => {
    const request = baseRequest({
      profile: {
        monthly_capacity_krw: 1_000_000,
        prior_year_tax: { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
      },
    });
    return planOf(scenarioOf(compute(request, bundle)), 'max_tax_credit').deterministic_benefit
      .tax_liability_cap;
  };

  assert.equal(capOf(rulesets).carryover_requires_application, true);

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.unused.contribution_carryover');
    rule.value.automatic = true;
    rule.value.subject_to_conversion_year_credit_limits.value = false;
  });
  const cap = capOf(mutated);
  assert.equal(cap.carryover_requires_application, false);
  assert.equal(cap.carryover_shares_future_year_credit_limit, false);
});

// ── 불확실성 표시 (D27의 구조적 발견) ────────────────────────────

test('불확실을 일부 해소해도 남은 것이 조용히 사라지지 않는다', () => {
  // 이것이 유무(boolean) 구조로는 표현할 수 없던 상태다.
  const value = {
    a: { unverified: '첫째' },
    b: { note: '둘째는 미확인이다' },
    c: { confidence: 'corroborated' },
    d: { age_range: null },
  };

  const all = uncertaintyNotesIn(value);
  assert.equal(all.length, 4);
  assert.deepStrictEqual(
    all.map((n) => n.kind).sort(),
    ['confidence_not_verified', 'text_marker', 'unverified', 'value_absent'],
  );
  assert.deepStrictEqual(all.map((n) => n.path), ['a.unverified', 'b.note', 'c.confidence', 'd.age_range']);

  // 하나를 해소한다. 유무만 보면 여전히 `true`라 아무 일도 없었던 것처럼 보이지만,
  // 목록은 3건으로 줄어 **무엇이 남았는지**를 말한다.
  delete value.a.unverified;
  const remaining = uncertaintyNotesIn(value);
  assert.equal(remaining.length, 3);
  assert.equal(remaining.some((n) => n.path === 'a.unverified'), false);

  // 남은 것까지 지우면 0이 된다 — 그때만 근거에서 불확실 표시가 사라진다.
  const resolved = uncertaintyNotesIn({});
  assert.deepStrictEqual(resolved, []);
});

test('배열 안의 표시는 몇 번째 항목인지까지 가리킨다', () => {
  const notes = uncertaintyNotesIn({ items: [{ ok: 1 }, { unverified: '둘째 항목' }] });
  assert.deepStrictEqual(notes, [{ path: 'items[1].unverified', kind: 'unverified' }]);
});

test('한 규칙 안의 여러 표시가 하나로 뭉개지지 않는다', () => {
  // **독립 오라클이다.** 아래 두 진술은 룰셋의 사실이고 `uncertaintyNotesIn`을 거치지 않는다 —
  // 응답을 그 함수의 출력과만 비교하면 함수가 첫 건만 남겨도 통과한다.
  const rule = findRule(rulesets, CONFIRMED_FILE, 'pension.credit.unused.contribution_carryover');
  assert.notEqual(rule.value.confidence, 'verified', '이 규칙의 confidence가 확정이 아니다');
  assert.ok(rule.value.net_contribution_limit_interaction.unverified, '그와 별개의 미확인이 하나 더 있다');

  const request = baseRequest({
    profile: {
      monthly_capacity_krw: 1_000_000,
      prior_year_tax: { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
    },
  });
  const entry = scenarioOf(compute(request, rulesets)).legal_basis.find(
    (e) => e.rule_id === 'pension.credit.unused.contribution_carryover',
  );

  assert.ok(entry, '세액 한도가 걸리는 이 요청에서는 전환 특례 규칙이 실제로 읽힌다');
  assert.equal(entry.has_uncertainty_note, true);
  assert.ok(
    entry.uncertainty_notes.length >= 2,
    '서로 다른 자리의 표시 둘이 한 건으로 뭉개졌다 — 그러면 하나를 해소해도 아무것도 달라 보이지 않는다',
  );
  assert.deepStrictEqual(entry.uncertainty_notes, uncertaintyNotesIn(rule.value));
});

// ── 배분안 자체 ──────────────────────────────────────────────────

test('납입 한도를 줄이면 납입한도 충당안의 배분이 따라 줄어든다', () => {
  const fillOf = (bundle) =>
    planOf(scenarioOf(compute(baseRequest(FULL), bundle)), 'pension_contribution_limit_fill')
      .allocations.find((a) => a.account === 'retirement_pension').annual_krw;

  const before = fillOf(rulesets);
  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.contribution.annual_limit');
    rule.value.amount_krw = Math.floor(rule.value.amount_krw / 2);
  });

  assert.equal(fillOf(mutated), Math.floor(before / 2), '납입 한도가 코드에 박혀 있으면 값이 안 변한다');
});
