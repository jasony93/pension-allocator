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
/** ISA보다 연금 납입을 먼저 채우는 안(D32). 옛 이름은 `pension_contribution_limit_fill`이었다. */
const BEFORE_ISA = 'pension_contribution_before_isa';

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
    // **D32 이후 이 효과는 기본안에서도 나온다.** 기본안으로 읽는다 — 대다수 사용자가
    // 보는 것이 그쪽이고, 룰셋의 사실이 거기까지 실제로 흐르는지가 확인 대상이다.
    const plan = scenarioOf(compute(baseRequest(FULL), bundle)).plans[0];
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

// ── 표시 자리가 배열일 때 (D32) ──────────────────────────────────
//
// 계약 5.7.1절이 남는 구멍을 닫는 방법으로 배열을 제시하면서 **"각 항목이 자기 자리를
// 갖는다"**고 못 박았다. 배열을 펼치지 않으면 산문 한 덩어리와 3원소 배열이 똑같이
// 1건으로 세어져 그 해법이 아무것도 바꾸지 않는다 — **그 상태가 계약이 막으려던 것이다.**

test('표시 자리가 배열이면 원소마다 자리를 갖는다 — 하나를 지우면 건수가 준다', () => {
  const value = { unverified: ['첫째 항목', '둘째 항목', '셋째 항목'] };

  assert.deepStrictEqual(uncertaintyNotesIn(value), [
    { path: 'unverified[0]', kind: 'unverified' },
    { path: 'unverified[1]', kind: 'unverified' },
    { path: 'unverified[2]', kind: 'unverified' },
  ]);

  // 항목 하나가 해소되어 원소가 빠지면 **그 사실이 값에 나타난다.**
  value.unverified.splice(1, 1);
  const remaining = uncertaintyNotesIn(value);
  assert.equal(remaining.length, 2);
  assert.equal(remaining.some((n) => n.path === 'unverified[2]'), false);
});

test('산문 한 덩어리로 되돌리면 다시 1건으로 세어진다 — 그것이 막으려던 상태다', () => {
  const asArray = uncertaintyNotesIn({ unverified: ['(1) 첫째', '(2) 둘째', '(3) 셋째'] });
  // 같은 사실 셋을 한 문자열에 적으면 자리가 하나뿐이라 **일부 해소가 보이지 않는다.**
  const asProse = uncertaintyNotesIn({ unverified: '(1) 첫째 (2) 둘째 (3) 셋째' });

  assert.equal(asArray.length, 3);
  assert.equal(asProse.length, 1);
  assert.deepStrictEqual(asProse, [{ path: 'unverified', kind: 'unverified' }]);
});

test('경로 위의 배열과 표시 자리의 배열이 섞이지 않는다', () => {
  // 앞은 표시로 **가는 길**에 배열이 있는 형태(`isa.benefit.settlement_period`),
  // 뒤는 표시를 담는 키 자체가 배열인 형태(`isa.tax_free_limit`)다. 건수가 갈린다.
  const onTheWay = uncertaintyNotesIn({ basis: [{ ok: 1 }, { unverified: '한 항목' }] });
  const atTheSpot = uncertaintyNotesIn({ unverified: ['한 항목', '또 한 항목'] });

  assert.deepStrictEqual(onTheWay.map((n) => n.path), ['basis[1].unverified']);
  assert.deepStrictEqual(atTheSpot.map((n) => n.path), ['unverified[0]', 'unverified[1]']);
});

test('룰셋의 배열이 실제로 펼쳐져 근거로 나간다 — 원소를 지우면 응답의 건수가 준다', () => {
  const ruleId = 'isa.tax_free_limit';
  const base = scenarioOf(compute(baseRequest(), rulesets)).legal_basis.find(
    (e) => e.rule_id === ruleId,
  );
  const elements = findRule(rulesets, CONFIRMED_FILE, ruleId).value.unverified;
  assert.ok(Array.isArray(elements) && elements.length > 1, '이 규칙의 표시 자리가 여러 원소짜리 배열이다');
  assert.equal(
    base.uncertainty_notes.filter((n) => n.path.startsWith('unverified[')).length,
    elements.length,
    '룰셋의 원소 수와 응답의 표시 건수가 다르다 — 배열이 펼쳐지지 않았다',
  );

  const mutated = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, ruleId).value.unverified.pop();
  });
  const after = scenarioOf(compute(baseRequest(), mutated)).legal_basis.find(
    (e) => e.rule_id === ruleId,
  );
  assert.equal(
    after.uncertainty_notes.length,
    base.uncertainty_notes.length - 1,
    '원소를 하나 지웠는데 응답의 건수가 그대로다',
  );

  // 배열을 산문 한 덩어리로 되돌리면 셋이 하나로 뭉개진다. **정답지의 건수 주장이 그것을 문다.**
  const collapsed = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, ruleId).value.unverified = elements.join(' ');
  });
  const asProse = scenarioOf(compute(baseRequest(), collapsed)).legal_basis.find(
    (e) => e.rule_id === ruleId,
  );
  assert.equal(asProse.uncertainty_notes.filter((n) => n.kind === 'unverified').length, 1);
  assert.equal(asProse.has_uncertainty_note, true, '뭉개져도 유무는 그대로 참이다 — 유무로는 못 잡는다');
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

test('납입 한도를 줄이면 기본안의 연금 배분이 따라 줄어든다', () => {
  // 줄어드는 쪽은 **연금 두 계좌의 합계**다. IRP의 몫은 `합산 공제한도 − 연금저축 단독
  // 한도`로 고정되고(그만큼만 연금저축이 흡수하지 못한다), 납입 한도의 변화는 전부
  // 인출이 자유로운 계좌가 흡수한다.
  const pensionTotalOf = (bundle) => {
    const plan = scenarioOf(compute(baseRequest(FULL), bundle)).plans[0];
    return plan.allocations
      .filter((a) => a.account !== 'isa')
      .reduce((sum, a) => sum + a.annual_krw, 0);
  };

  const before = pensionTotalOf(rulesets);
  const reduced = Math.floor((before * 3) / 4);
  const mutated = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'pension.contribution.annual_limit').value.amount_krw = reduced;
  });

  assert.equal(pensionTotalOf(mutated), reduced, '납입 한도가 코드에 박혀 있으면 값이 안 변한다');
});

test('납입 한도가 공제 대상 한도까지 좁아지면 이 안이 사라진다', () => {
  // 두 한도가 같으면 3단계가 받을 몫 자체가 없어지므로 ISA와의 선후가 아무것도 바꾸지
  // 못하고, 배분 벡터가 기본안과 같아져 하나로 합쳐진다.
  // **선택지가 없는데 있는 척하지 않는다.**
  const combined = findRule(rulesets, CONFIRMED_FILE, 'pension.credit.limit.combined').value.amount_krw;
  const mutated = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'pension.contribution.annual_limit').value.amount_krw = combined;
  });

  const planIds = scenarioOf(compute(baseRequest(FULL), mutated)).plans.map((p) => p.plan_id);
  assert.equal(planIds.includes(BEFORE_ISA), false, planIds.join(', '));
});

test('연금저축 단독 공제한도가 IRP의 몫을 정한다 — 비용 0 경계가 룰셋에서 온다', () => {
  const irpOf = (bundle) =>
    scenarioOf(compute(baseRequest(FULL), bundle)).plans[0].allocations.find(
      (a) => a.account === 'retirement_pension',
    ).annual_krw;

  const combined = findRule(rulesets, CONFIRMED_FILE, 'pension.credit.limit.combined').value.amount_krw;
  const annuity = findRule(rulesets, CONFIRMED_FILE, 'pension.credit.limit.annuity_savings').value
    .amount_krw;
  assert.equal(irpOf(rulesets), combined - annuity, 'IRP는 연금저축이 흡수 못 하는 몫만 받는다');

  // 단독 한도를 넓히면 연금저축이 더 많이 흡수하므로 IRP의 몫이 그만큼 줄어야 한다.
  const widened = annuity + 1_000_000;
  const mutated = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'pension.credit.limit.annuity_savings').value.amount_krw = widened;
  });
  assert.equal(irpOf(mutated), combined - widened, '경계가 코드에 박혀 있으면 값이 안 변한다');
});
