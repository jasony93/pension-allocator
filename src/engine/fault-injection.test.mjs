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
  CAP_COORDINATES,
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
        // 이 총급여의 추정 한도(900,000원)가 공제액(1,350,000원)을 자른다 — 전환 특례
        // 규칙이 실제로 읽히는 상태여야 이 검사가 뜻을 갖는다(D40의 검산 좌표).
        current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
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
      // 한도가 실제로 자르는 총급여(D40의 검산 좌표). 자르지 않으면 전환 특례 규칙이
      // 읽히지 않아 이 검사가 아무것도 보지 못한다.
      current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
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

// ── 헤드라인 합계와 축의 상한 (D38) ──────────────────────────────

/** 구간 분기를 실제로 밟는 요청. 기본안이 ISA에 300만을 넣는다. */
function compositeRequest(overrides = {}) {
  return baseRequest({
    profile: {
      monthly_capacity_krw: 1_000_000,
      isa_return_assumption: {
        annual_return_rate: 0.07,
        income_character: 'mixed_or_unknown',
        settlement_years: 3,
        loss_amount_krw: null,
      },
    },
    accounts: { isa: { cumulative_contribution_krw: 20_000_000, years_since_opening: 2 } },
    ...overrides,
  });
}

const headlineOf = (bundle) =>
  planOf(scenarioOf(compute(compositeRequest(), bundle)), 'max_tax_credit').headline_composite_total;

test('헤드라인 규칙이 없으면 합계를 지어내지 않고 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const doc = clone[CONFIRMED_FILE];
    doc.rules = doc.rules.filter((r) => r.id !== 'benefit.headline.composite_total');
  });

  const response = compute(compositeRequest(), mutated);
  assert.equal(response.ok, false, '규칙이 없는데 합계가 나왔다 — 그 형태가 코드에 박혀 있다는 뜻이다');
  assert.ok(errorCodes(response).includes('rule_missing'));
});

test('분기가 늘거나 이름이 바뀌면 모르는 채로 계산을 이어 가지 않는다', () => {
  const renamed = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'benefit.headline.composite_total');
    const shape = rule.value.the_rule.shape;
    shape.when_the_isa_component_is_partial = shape.when_it_does_not;
  });
  assert.equal(compute(compositeRequest(), renamed).ok, false, '갈래가 늘었는데 그대로 계산했다');

  const removed = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'benefit.headline.composite_total');
    delete rule.value.the_rule.shape.when_there_is_no_isa_component;
  });
  assert.equal(compute(compositeRequest(), removed).ok, false, '갈래가 사라졌는데 그대로 계산했다');
});

test('금지 목록이 사라지면 멈춘다 — 기간도 상한도 안 붙이는 근거가 그 목록이다', () => {
  const mutated = withMutation((clone) => {
    delete findRule(clone, CONFIRMED_FILE, 'benefit.headline.composite_total').value.the_rule.forbidden;
  });
  assert.equal(compute(compositeRequest(), mutated).ok, false);
});

test('구간의 아래 끝을 옮기면 합계의 아래 끝도 따라 옮겨진다 — 0이 코드에 없다', () => {
  // **항등식이 코드의 규약이 아니라 조문의 귀결임을 확인한다.** 지금 합계의 아래 끝이
  // 세액공제액과 같은 것은 소득 성격이 미확정일 때 `s`의 아래 끝이 0이기 때문이고,
  // 그 0은 룰셋의 `s_range`가 정한다. 구간을 올리면 합계의 아래 끝이 함께 올라가야 한다.
  const before = headlineOf(rulesets);
  const credit = planOf(scenarioOf(compute(compositeRequest(), rulesets)), 'max_tax_credit')
    .deterministic_benefit.pension_credit_total_krw;
  assert.equal(before.lower_bound_krw, credit, '이 좌표에서 항등식이 성립해야 시험이 성립한다');

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'isa.benefit.income_character');
    const option = rule.value.what_to_ask_instead.options.find((o) => o.id === 'mixed_or_unknown');
    option.s_range = '0.5 ≤ s ≤ 1';
  });
  const after = headlineOf(mutated);

  assert.ok(
    after.lower_bound_krw > credit,
    '구간의 아래 끝을 올렸는데 합계의 아래 끝이 그대로다 — 엔진이 0을 스스로 박아 넣고 있다',
  );
  assert.equal(after.upper_bound_krw, before.upper_bound_krw, '위 끝은 이 변형과 무관하다');
});

test('축의 상한 유무가 룰셋에서 오고, 없다고 적힌 축에 금액을 만들지 않는다', () => {
  const ceilingsOf = (bundle) =>
    planOf(scenarioOf(compute(compositeRequest(), bundle)), 'max_tax_credit')
      .assumption_based_isa_estimate.axis_ceilings;

  assert.equal(ceilingsOf(rulesets).rate_gap_has_ceiling, false);

  // 저율분리과세 축에 상한이 생겼다고 적힌 룰셋 — 이 계약에는 그 금액을 만들 산식이
  // 없다. 조용히 `false`로 내보내면 룰셋이 바뀐 사실이 응답에서 사라진다.
  const opened = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'isa.benefit.axis_ceiling').value.rate_gap_axis.has_a_ceiling = true;
  });
  assert.equal(compute(compositeRequest(), opened).ok, false, '상한이 생겼는데 없다고 계속 말한다');

  // 비과세 축의 상한이 없어졌다고 적힌 룰셋도 같다 — 분모를 지어내지 않는다.
  const closed = withMutation((clone) => {
    findRule(clone, CONFIRMED_FILE, 'isa.benefit.axis_ceiling').value.tax_free_axis.has_a_ceiling = false;
  });
  assert.equal(compute(compositeRequest(), closed).ok, false);

  // 규칙 자체가 없으면 멈춘다.
  const gone = withMutation((clone) => {
    const doc = clone[CONFIRMED_FILE];
    doc.rules = doc.rules.filter((r) => r.id !== 'isa.benefit.axis_ceiling');
  });
  assert.equal(compute(compositeRequest(), gone).ok, false);
});

test('비과세 한도를 바꾸면 축의 상한이 따라 바뀐다 — 308,000이 코드에 없다', () => {
  const ceilingOf = (bundle) =>
    planOf(scenarioOf(compute(compositeRequest(), bundle)), 'max_tax_credit')
      .assumption_based_isa_estimate.axis_ceilings.tax_free_krw;

  const before = ceilingOf(rulesets);
  const mutated = withMutation((clone) => {
    const brackets = findRule(clone, CONFIRMED_FILE, 'isa.tax_free_limit').value.brackets;
    for (const bracket of brackets) bracket.limit_krw = Math.floor(bracket.limit_krw / 2);
  });

  assert.equal(ceilingOf(mutated) * 2, before, '한도를 반으로 줄였는데 상한이 그대로다');
});

// ── 세액 한도를 총급여액에서 산출하는 경로 (D39·D40) ─────────────
//
// **이 묶음이 무는 것은 값이 아니라 방향이다.** 값이 룰셋에서 오는지는 아래 넷이 보고,
// **오차 방향이 뒤집히는 주입**은 그 뒤 셋이 본다. 이 조직에서 회차마다 나온 것이
// 「통과하지만 아무것도 증명하지 않는 검사」였고, 방향은 값과 달리 **틀려도 금액이
// 그럴듯해 보이는** 축이다.

/** 한도가 실제로 자르는 좌표. 한도가 결과를 바꾸지 못하면 아래 주입이 전부 무의미하다. */
const CAP_REQUEST = baseRequest({
  profile: {
    current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
    monthly_capacity_krw: 5_000_000,
  },
});

const capOf = (bundle, request = CAP_REQUEST) =>
  scenarioOf(compute(request, bundle)).pension_credit_tax_liability_cap;

test('한도 산출에 쓰는 규칙이 하나라도 없으면 총급여로 어림잡지 않고 멈춘다', () => {
  for (const ruleId of [
    'income.wage.deduction',
    'income.deduction.basic.self',
    'tax.rate.basic',
    'credit.wage_income',
    'pension.credit.tax_liability_cap.current_year_estimate',
  ]) {
    const mutated = withMutation((clone) => {
      const doc = clone[CONFIRMED_FILE];
      doc.rules = doc.rules.filter((r) => r.id !== ruleId);
    });
    const response = compute(CAP_REQUEST, mutated);
    assert.equal(response.ok, false, `${ruleId}이 없는데 계산이 끝났다 — 산식이 코드에 박혀 있다`);
    assert.ok(errorCodes(response).includes('rule_missing'));
  }
});

test('근로소득공제 구간을 바꾸면 한도가 따라 바뀐다 — 산식이 코드에 없다', () => {
  const before = capOf(rulesets);
  const mutated = withMutation((clone) => {
    const brackets = findRule(clone, CONFIRMED_FILE, 'income.wage.deduction').value.brackets;
    // 공제를 늘리면 과세표준이 줄고 산출세액이 줄어 **한도가 내려간다.**
    for (const bracket of brackets) bracket.base_krw += 1_000_000;
  });
  const after = capOf(mutated);

  assert.ok(after.wage_income_deduction_krw > before.wage_income_deduction_krw);
  assert.ok(after.cap_krw < before.cap_krw, '근로소득공제를 늘렸는데 한도가 그대로다');
});

test('기본세율표와 기본공제를 바꾸면 한도가 따라 바뀐다', () => {
  const before = capOf(rulesets).cap_krw;

  const rateChanged = withMutation((clone) => {
    const brackets = findRule(clone, CONFIRMED_FILE, 'tax.rate.basic').value.brackets;
    for (const bracket of brackets) bracket.rate_on_excess /= 2;
  });
  assert.ok(capOf(rateChanged).cap_krw < before, '세율을 반으로 줄였는데 한도가 그대로다');

  const deductionChanged = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'income.deduction.basic.self');
    rule.value.amount_krw *= 3;
  });
  const after = capOf(deductionChanged);
  assert.ok(after.basic_deduction_krw > 0 && after.cap_krw < before, '기본공제가 한도에 걸리지 않는다');
});

test('근로소득세액공제 제2항 한도를 바꾸면 한도가 따라 바뀐다 — 산식 문자열을 실제로 읽는다', () => {
  const before = capOf(rulesets);
  const mutated = withMutation((clone) => {
    const brackets = findRule(clone, CONFIRMED_FILE, 'credit.wage_income').value.limit_brackets;
    // 첫 구간은 금액, 나머지는 산식 문자열이다. **둘 다** 반으로 줄인다.
    for (const bracket of brackets) {
      if (typeof bracket.limit_krw === 'number') bracket.limit_krw = Math.floor(bracket.limit_krw / 2);
      if (typeof bracket.formula === 'string') {
        bracket.formula = bracket.formula.replace(/^(\d+)/, (m) => String(Math.floor(Number(m) / 2)));
      }
      if (typeof bracket.floor_krw === 'number') bracket.floor_krw = Math.floor(bracket.floor_krw / 2);
    }
  });
  const after = capOf(mutated);

  // 근로소득세액공제가 줄면 빼는 값이 줄어 **한도가 올라간다.**
  assert.ok(after.wage_income_credit_krw < before.wage_income_credit_krw);
  assert.ok(after.cap_krw > before.cap_krw, '제2항 한도를 반으로 줄였는데 한도가 그대로다');
});

test('산식 문자열의 형태가 깨지면 어림잡지 않고 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const brackets = findRule(clone, CONFIRMED_FILE, 'credit.wage_income').value.limit_brackets;
    for (const bracket of brackets) {
      if (typeof bracket.formula === 'string') bracket.formula = '총급여액에 따라 정한다';
    }
  });
  // **총급여가 첫 구간(금액이 적힌 구간)을 넘어야 산식 자리에 닿는다.** 검산 좌표
  // 34,143,912원이 그 구간 밖이다 — 여기서 멈추지 않으면 산식을 읽지 않았다는 뜻이다.
  const response = compute(
    baseRequest({
      profile: {
        current_year_total_salary_krw: CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw,
        monthly_capacity_krw: 5_000_000,
      },
    }),
    mutated,
  );
  assert.equal(response.ok, false, '읽을 수 없는 산식을 만나고도 값을 냈다');
  assert.ok(errorCodes(response).includes('rule_missing'));
});

// ── 오차 방향을 뒤집는 주입 ──────────────────────────────────────

test('주입 / 룰셋의 오차 방향 코드를 바꾸면 응답의 방향도 바뀐다 — 코드가 엔진에 박혀 있지 않다', () => {
  assert.equal(capOf(rulesets).error_direction_code, 'overstated_or_equal');

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.tax_liability_cap.current_year_estimate');
    rule.value.error_direction.code = 'understated_or_equal';
    // **주입하는 칸이 옮겨졌다** (D41 1번). 전에는 분기의 산문(`direction`)을 바꿔야 방향이
    // 뒤집혔다. 이제 엔진이 읽는 칸은 `direction_code` 하나다. 옮긴 것은 좌표이고, 이 시험이
    // 보려는 사실("코드가 엔진에 박혀 있지 않다")은 그대로다.
    for (const branch of Object.values(rule.value.branches)) {
      if (branch.direction_code === 'overstated_or_equal') {
        branch.direction_code = 'understated_or_equal';
      }
    }
  });

  assert.equal(
    capOf(mutated).error_direction_code,
    'understated_or_equal',
    '룰셋이 방향을 바꿨는데 응답이 그대로다 — 코드가 엔진에 박혀 있다는 뜻이다',
  );
});

test('주입 / 상한을 하한으로 뒤집으면 「걸린다」의 증명이 사라진다', () => {
  // **이 주입이 이 파일의 핵심이다.** 값은 한 원도 바뀌지 않고 방향만 뒤집힌다.
  // 잡히지 않으면 화면이 「한도에 걸린다」를 증명 없이 말하게 된다.
  const before = planOf(scenarioOf(compute(CAP_REQUEST, rulesets)), 'max_tax_credit')
    .deterministic_benefit.tax_liability_cap;
  assert.equal(before.applied, true, '한도가 자르지 않는 좌표에서는 이 주입이 아무것도 못 본다');
  assert.equal(before.binding_code, 'binds_provably');

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.tax_liability_cap.current_year_estimate');
    // 상한 코드는 그대로 두고 **분기의 방향 코드만** 상한이 아닌 것으로 바꾼다.
    rule.value.branches.wage_income_only.direction_code = 'direction_indeterminate';
  });

  const scenario = scenarioOf(compute(CAP_REQUEST, mutated));
  const after = planOf(scenario, 'max_tax_credit').deterministic_benefit.tax_liability_cap;

  // 자르는 것은 그대로다 — 금액은 한 원도 바뀌지 않는다.
  assert.equal(after.applied, true);
  assert.equal(after.cap_krw, before.cap_krw);
  // 그러나 그 자름이 실제 한도의 자름을 증명하지 못하게 된다.
  assert.equal(
    after.binding_code,
    'binding_not_determined',
    '분기가 상한이 아니게 됐는데도 「걸린다」가 증명된다고 말한다',
  );
  assert.equal(scenario.pension_credit_tax_liability_cap.is_upper_bound, false);
  assert.equal(scenario.pension_credit_tax_liability_cap.error_direction_code, 'direction_indeterminate');
  assert.ok(noticeCodes(scenario).includes('tax_liability_cap_direction_indeterminate'));
});

test('주입 / 미정 분기를 상한으로 바꾸면 등식 표시가 되살아난다 — 그 자리가 실제로 매여 있다', () => {
  const request = baseRequest({
    profile: {
      current_year_total_salary_krw: CAP_COORDINATES.ZERO_EXACT.total_salary_krw,
      has_non_wage_global_income_current_year: true,
      current_year_global_income_krw: null,
    },
  });

  // 미정 분기에서는 한도가 0이어도 등식이 아니다.
  assert.equal(capOf(rulesets, request).is_exact, false);

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.tax_liability_cap.current_year_estimate');
    rule.value.branches.global_income_amount_missing.direction_code = 'overstated_or_equal';
  });

  // 룰셋이 그 분기를 상한이라고 말하면 0이 등식이 된다. 판정이 룰셋에 매여 있다는 뜻이다.
  assert.equal(capOf(mutated, request).is_exact, true);
});

// ── 산문을 건드리는 주입 — **아무것도 바뀌면 안 된다** (D41 1번·D42 5절 (나)) ─────────────
//
// **이 두 시험이 이번 회차에 새로 세운 축이다.** 룰셋의 `branches_reading_rule`이
// `engine_must_not_read: "direction"`을 명시로 적었는데 엔진이 그 칸을 읽고 있었다.
// 산문 앞에 한 단어가 붙으면 판정이 뒤집혔고, **뒤집혀도 아무 시험이 실패하지 않았다.**

test('주입 / 분기의 산문을 뒤집어도 방향 판정이 흔들리지 않는다 — 엔진이 산문을 읽지 않는다', () => {
  const before = capOf(rulesets);
  assert.equal(before.error_direction_code, 'overstated_or_equal');
  assert.equal(before.is_upper_bound, true);

  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.tax_liability_cap.current_year_estimate');
    // 코드 칸은 그대로 두고 **산문만** 반대 방향으로 바꾼다. 접두사를 검사하던 엔진은
    // 여기서 조용히 미정으로 넘어갔다.
    for (const branch of Object.values(rule.value.branches)) {
      branch.direction = `understated_or_equal. ${branch.direction}`;
    }
  });

  const after = capOf(mutated);
  assert.equal(
    after.error_direction_code,
    'overstated_or_equal',
    '산문을 바꿨더니 방향이 따라 움직였다 — 엔진이 코드 칸이 아니라 산문을 읽고 있다',
  );
  assert.equal(after.is_upper_bound, true);
  assert.equal(after.cap_krw, before.cap_krw, '방향과 무관한 금액이 함께 움직였다');
});

test('주입 / 분기에 방향 코드가 없으면 방향을 지어내지 않고 멈춘다', () => {
  const mutated = withMutation((clone) => {
    const rule = findRule(clone, CONFIRMED_FILE, 'pension.credit.tax_liability_cap.current_year_estimate');
    // 산문은 남겨 둔다. 산문이 남아 있다고 해서 그것으로 대신 읽으면 안 된다.
    delete rule.value.branches.wage_income_only.direction_code;
  });

  const response = compute(CAP_REQUEST, mutated);
  assert.equal(response.ok, false, '방향 코드가 없는데도 값을 냈다 — 어딘가에서 방향을 만들었다');
  assert.ok(errorCodes(response).includes('rule_missing'));
});
