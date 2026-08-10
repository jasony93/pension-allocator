// D32 — 소유자가 기본안의 배분을 바꿨다. **그 변경이 세액공제액을 건드리지 않았음**을
// 기계로 못 박는다.
//
// 왜 이 파일이 따로 있나 — 이번 변경은 기본안의 충당 순서에 단계를 하나 더한다.
// 그 단계의 몫은 **올해의 세액공제를 한 원도 낳지 않는다**는 것이 이 변경의 전제이고,
// 전제가 깨지면 사용자가 보는 절세액이 조용히 달라진다. 조용히 달라지는 것은
// 어떤 검사에도 걸리지 않으므로 **변경 전의 값을 얼려 두는 것 말고 방법이 없다.**
//
// 얼린 값은 `baseline-credit-freeze.mjs`에 있고 그 파일은 엔진이 임포트하지 않는다.
//
// 지난 회차에 같은 자리에서 결함이 하나 나왔다 — 연금저축이 자기 단독 공제한도를
// 넘겨 채워지면서 인정액에 섞여 **공제액이 과대**로 나왔다. 그때는 그 경로가
// 별도 배분안에만 있었고 지금은 **기본안에 들어간다.** 그래서 같은 결함이
// 되살아나는지를 여기서 본다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import { BASELINE_CREDIT_FREEZE, freezeCases } from './baseline-credit-freeze.mjs';
import { loadRulesets } from './test-helpers.mjs';

const rulesets = loadRulesets();

const FIELDS = [
  'plan_id',
  'pension_credit_income_tax_krw',
  'pension_credit_local_tax_krw',
  'pension_credit_total_krw',
  'pension_credit_total_before_cap_krw',
  'credit_eligible_contribution_krw',
  'isa_annual_krw',
];

function actualTuple(response, scenarioId) {
  const scenario = response.scenarios.find((s) => s.scenario_id === scenarioId);
  const plan = scenario.plans[0];
  const benefit = plan.deterministic_benefit;
  return [
    plan.plan_id,
    benefit.pension_credit_income_tax_krw,
    benefit.pension_credit_local_tax_krw,
    benefit.pension_credit_total_krw,
    benefit.pension_credit_total_before_cap_krw,
    benefit.credit_eligible_contribution_krw,
    plan.allocations.find((a) => a.account === 'isa').annual_krw,
  ];
}

test('얼린 표가 지금의 격자와 정확히 맞물린다 — 표가 낡으면 검사가 헐거워진다', () => {
  const cases = freezeCases();
  assert.equal(
    BASELINE_CREDIT_FREEZE.length,
    cases.length,
    '격자를 바꾸고 표를 다시 만들지 않았다 — 그 상태에서는 일부 좌표가 검사되지 않는다',
  );
  assert.deepStrictEqual(
    BASELINE_CREDIT_FREEZE.map(([key]) => key),
    cases.map((c) => c.key),
    '표의 좌표와 격자의 좌표가 어긋난다',
  );
  // 얼린 표가 한 줄도 없으면 아래 검사는 통과하면서 아무것도 막지 못한다.
  assert.ok(cases.length > 100, '격자가 이렇게 좁으면 얼려 둘 값이 없다');
});

test('D32 — 기본안의 세액공제액이 변경 전과 한 원도 다르지 않다', () => {
  const cases = freezeCases();
  const mismatches = [];

  for (const [index, { key, request }] of cases.entries()) {
    const response = compute(request, rulesets);
    assert.equal(response.ok, true, `${key}: ${JSON.stringify(response.errors)}`);

    const [, frozenCurrent, frozenProposed] = BASELINE_CREDIT_FREEZE[index];
    for (const [scenarioId, frozen] of [
      ['current', frozenCurrent],
      ['proposed', frozenProposed],
    ]) {
      const actual = actualTuple(response, scenarioId);
      for (const [field, expected] of frozen.entries()) {
        if (actual[field] !== expected) {
          mismatches.push(
            `${key} / ${scenarioId} / ${FIELDS[field]}: 변경 전 ${expected} → 지금 ${actual[field]}`,
          );
        }
      }
    }
  }

  assert.deepStrictEqual(
    mismatches,
    [],
    `기본안의 확정 세액이 달라졌다 (${mismatches.length}건). 3단계 몫은 공제를 낳지 않으므로 ` +
      '이 값들은 움직여서는 안 된다',
  );
});

test('얼린 값이 실제로 무는지 — 인정액이 달라지는 룰셋에서는 표가 깨진다', () => {
  // 통과만 하는 표는 아무것도 증명하지 않는다. **합산 공제한도를 넓히면** 인정 납입액이
  // 실제로 늘어 공제액이 달라지므로, 그때 이 표가 깨지지 않으면 표가 보고 있는 것이 없다.
  //
  // 단독 한도를 넓히는 것으로는 안 된다 — 확정 기준에서 묶고 있는 것은 합산 한도이고,
  // 단독 한도를 넓혀도 인정액 총액이 그대로다. **어느 한도가 실제로 묶고 있는지를
  // 모르고 고른 주입은 통과해 버린다.**
  const widened = structuredClone(rulesets);
  for (const doc of Object.values(widened)) {
    const rule = doc.rules.find((r) => r.id === 'pension.credit.limit.combined');
    if (rule) rule.value.amount_krw = rule.value.amount_krw * 2;
  }

  const cases = freezeCases();
  let changed = 0;
  for (const [index, entry] of cases.entries()) {
    const response = compute(entry.request, widened);
    if (!response.ok) continue;
    const [, frozenCurrent] = BASELINE_CREDIT_FREEZE[index];
    const actual = actualTuple(response, 'current');
    if (frozenCurrent.some((value, field) => value !== actual[field])) changed += 1;
  }

  assert.ok(
    changed > 0,
    '룰셋을 바꿔도 얼린 표가 그대로 통과한다 — 이 표는 아무것도 보고 있지 않다',
  );
});
