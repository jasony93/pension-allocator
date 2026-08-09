// 교차 필드 불변식 — 응답 구조 자체에 대한 검사.
//
// 4단계 교차검증이 같은 형태의 결함을 두 번 잡았다(M1·M3). 어떤 전제가 조건부로
// 바뀌면 그 전제를 공유하던 다른 출력이 뒤처지는데, **필드를 각각 검사하는 테스트로는
// 잡히지 않는다** — 각 필드는 저마다 옳고 관계가 틀리기 때문이다.
//
// 그래서 여기서는 특정 케이스의 기대값을 확인하지 않는다. 요청 행렬을 돌며
// **모든 응답이 만족해야 할 관계**를 검사한다. 다음에 어떤 전제를 조건부로 바꿔도
// 파급을 놓친 자리에서 실패한다.
//
// 불변식 목록과 각 항목이 막는 것: engine-design.md 7.1절.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  ACCOUNT_ORDER,
  ASSUMPTION,
  COMPARISON_NOTE,
  HORIZONS,
  NOTICE,
  PLAN,
  RULESET_STATUS,
  WARNING,
} from './constants.mjs';
import { loadRulesets, baseRequest, deepMerge, PROPOSED_FILE } from './test-helpers.mjs';

const rulesets = loadRulesets();

const KNOWN_NOTICES = new Set(Object.values(NOTICE));
const KNOWN_WARNINGS = new Set(Object.values(WARNING));
const KNOWN_ASSUMPTIONS = new Set(Object.values(ASSUMPTION));
const KNOWN_COMPARISON_NOTES = new Set(Object.values(COMPARISON_NOTE));

// ── 요청 행렬 ────────────────────────────────────────────────────
// 조건부 분기를 하나씩 켜고 끄는 프로필군. 여기에 시나리오와 horizon 네 값을 곱한다.

const PROFILES = [
  { label: '기본', patch: {} },
  { label: '납입 여력 0', patch: { profile: { monthly_capacity_krw: 0 } } },
  { label: '예산이 모든 한도 초과', patch: { profile: { monthly_capacity_krw: 30_000_000 } } },
  {
    label: '기납입이 한도 초과',
    patch: {
      accounts: {
        annuity_savings: { ytd_contribution_krw: 12_000_000 },
        retirement_pension: { ytd_contribution_krw: 12_000_000 },
      },
    },
  },
  {
    label: '청년 · 공제율 경계 위 · 연금저축 기납입 (M1 형태)',
    patch: {
      profile: {
        age_years: 30,
        current_year_total_salary_krw: 60_000_000,
        prior_year_total_salary_krw: 60_000_000,
        declared_youth: true,
        monthly_capacity_krw: 1_000_000,
      },
      accounts: { annuity_savings: { ytd_contribution_krw: 6_000_000 } },
    },
  },
  {
    label: 'ISA 의무가입기간 경과 (M2·M3 형태)',
    patch: {
      profile: { age_years: 56 },
      accounts: { isa: { cumulative_contribution_krw: 20_000_000, years_since_opening: 3 } },
    },
  },
  {
    label: 'ISA 의무가입기간 잔여 1년',
    patch: { accounts: { isa: { cumulative_contribution_krw: 5_000_000, years_since_opening: 2 } } },
  },
  {
    label: 'ISA 배제 (금융소득종합과세)',
    patch: { profile: { financial_income_taxpayer_last_3_years: true } },
  },
  {
    label: 'ISA 배제 (연령)',
    patch: {
      profile: { age_years: 14, prior_year_total_salary_krw: null },
      accounts: { isa: { exists: false, account_type: null, years_since_opening: null } },
    },
  },
  {
    label: 'ISA 만기 전환',
    patch: {
      accounts: { isa: { cumulative_contribution_krw: 50_000_000, years_since_opening: 4 } },
      isa_transfer: { amount_krw: 40_000_000 },
    },
  },
  {
    label: '부분 연도 (잔차 발생)',
    patch: { profile: { monthly_capacity_krw: 1_428_571, months_remaining_in_tax_year: 7 } },
  },
  {
    label: 'ISA 미보유 · 유형 미선언',
    patch: {
      accounts: { isa: { exists: false, account_type: null, years_since_opening: null } },
    },
  },
];

const SCENARIO_SETS = [['current'], ['proposed'], ['current', 'proposed']];

function* matrix() {
  for (const { label, patch } of PROFILES) {
    for (const scenarios of SCENARIO_SETS) {
      for (const horizon of HORIZONS) {
        const request = baseRequest(deepMerge(patch, { scenarios, profile: { fund_use_horizon: horizon } }));
        yield { label: `${label} / [${scenarios}] / ${horizon}`, request };
      }
    }
  }
}

// ── 경로 해석기 (I11) ────────────────────────────────────────────
// legal_basis[].applied_to가 가리키는 출력 경로가 실제로 존재하는지 확인한다.
// `plans[]`는 모든 배분안, `by_account[isa]`는 account가 isa인 원소를 뜻한다.

const TOKEN = /^([A-Za-z_]+)(?:\[([A-Za-z_]*)\])?$/;

function resolvePath(path, scenario, response) {
  const tokens = path.split('.');
  // 첨자를 떼고 뿌리를 고른다. `plans[]`를 그대로 키로 쓰면 어디에도 없다.
  const rootKey = TOKEN.exec(tokens[0])?.[1];
  if (!rootKey) return false;
  let nodes = [rootKey in scenario ? scenario : response];

  for (const token of tokens) {
    const match = TOKEN.exec(token);
    if (!match) return false;
    const [, key, index] = match;

    const next = [];
    for (const node of nodes) {
      if (node === null || node === undefined) continue;
      const value = node[key];
      if (value === undefined) continue;
      if (index === undefined) {
        next.push(value);
      } else if (index === '') {
        if (!Array.isArray(value)) return false;
        next.push(...value);
      } else {
        if (!Array.isArray(value)) return false;
        const found = value.filter((item) => item?.account === index);
        next.push(...found);
      }
    }
    if (next.length === 0) return false;
    nodes = next;
  }
  return true;
}

// ── 불변식 ───────────────────────────────────────────────────────

function checkScenario(scenario, response, request, at) {
  const horizon = request.profile.fund_use_horizon;
  const notes = scenario.comparison_note_codes;
  const noticeCodes = scenario.notices.map((n) => n.code);
  const plans = scenario.plans;
  const boundaries = scenario.fund_use_horizon_boundaries;
  const limitOf = (account) => scenario.limits.by_account.find((l) => l.account === account);
  const allocOf = (plan, account) => plan.allocations.find((a) => a.account === account);

  // I1 — 사실이 아닌 안내가 배분 비교보다 앞서지 않는다 (M3)
  assert.equal(
    notes.includes(COMPARISON_NOTE.ALL_ACCOUNTS_PENALTY),
    horizon === 'within_isa_lock_in' && plans.length > 0 && plans.every((p) => p.warnings.length > 0),
    `${at} I1: "어느 안도 피하지 못한다"는 안내가 실제 경고와 어긋난다`,
  );

  for (const plan of plans) {
    for (const warning of plan.warnings) {
      // I2 — 성립할 수 없는 법적 불이익을 고지하지 않는다 (M2)
      if (warning.code === WARNING.ISA_CLAWBACK) {
        assert.ok(
          boundaries.isa_lock_in_years_remaining > 0,
          `${at} I2: 의무가입기간이 끝났는데 추징 경고가 나갔다`,
        );
      }
      // I4 — 넣지 않은 돈에는 경고가 붙지 않는다
      assert.ok(
        allocOf(plan, warning.account).annual_krw > 0,
        `${at} I4: 배분액 0인 ${warning.account}에 경고가 붙었다`,
      );
      const unknown = horizon === 'unknown';
      assert.equal(warning.severity, unknown ? 'info' : 'warning', `${at} I4: severity가 horizon과 어긋난다`);
      assert.equal(
        warning.trigger,
        unknown ? 'horizon_unknown' : 'declared_horizon',
        `${at} I4: trigger가 horizon과 어긋난다`,
      );
      assert.ok(warning.basis_rule_ids.length > 0, `${at} I4: 경고에 근거 조항이 없다`);
      assert.ok(KNOWN_WARNINGS.has(warning.code), `${at} I17: 알 수 없는 경고 코드 ${warning.code}`);
    }
    if (horizon === 'at_or_after_pension_age') {
      assert.deepStrictEqual(plan.warnings, [], `${at} I4: 불이익이 없는 시점인데 경고가 나갔다`);
    }
  }

  // I3 — 경고를 끄면서 그 사실을 알린다
  assert.equal(
    noticeCodes.includes(NOTICE.ISA_LOCK_IN_ELAPSED),
    horizon === 'within_isa_lock_in' && boundaries.isa_lock_in_years_remaining === 0,
    `${at} I3: 입력과 현실의 어긋남 통지가 조건과 맞지 않는다`,
  );

  // I5 — 기본안이 옮겨 갔으면 화면이 알 수 있다
  assert.equal(
    notes.includes(COMPARISON_NOTE.BASELINE_REORDERED),
    plans[0].plan_id !== PLAN.MAX_CREDIT,
    `${at} I5: 기본안 재정렬 안내가 실제 기본안과 어긋난다`,
  );

  // I6 — 기준점과 차이값
  assert.equal(plans.filter((p) => p.is_baseline).length, 1, `${at} I6: 기본안이 정확히 하나가 아니다`);
  assert.equal(plans[0].is_baseline, true, `${at} I6: 기본안이 plans[0]이 아니다`);
  const baselineCredit = plans[0].deterministic_benefit.pension_credit_total_krw;
  for (const plan of plans) {
    assert.equal(
      plan.delta_vs_baseline_krw,
      plan.deterministic_benefit.pension_credit_total_krw - baselineCredit,
      `${at} I6: ${plan.plan_id}의 delta가 기본안 대비 차이와 다르다`,
    );
  }
  assert.equal(plans[0].delta_vs_baseline_krw, 0, `${at} I6: 기본안의 delta가 0이 아니다`);

  // I7 — 합쳐졌으면 두 곳에서 같은 말을 한다
  assert.equal(notes.includes(COMPARISON_NOTE.PLANS_COLLAPSED_SINGLE), plans.length === 1, `${at} I7`);
  assert.equal(noticeCodes.includes(NOTICE.PLANS_COLLAPSED_SINGLE), plans.length === 1, `${at} I7 (notices)`);
  assert.ok(plans.length >= 1 && plans.length <= 3, `${at} I7: 배분안 수가 범위 밖이다`);

  // I8 — 동률 대안
  assert.equal(
    notes.includes(COMPARISON_NOTE.EQUAL_TAX_CREDIT),
    plans.length > 1 && plans.slice(1).some((p) => p.delta_vs_baseline_krw === 0),
    `${at} I8: 동률 대안 안내가 실제와 어긋난다`,
  );

  // I10 — 공유 한도 표시가 실제 값과 맞물린다.
  //
  // 두 축의 성질이 다르다. 납입 한도는 계좌별 추가 제약이 없어 공유 계좌가 **같은 값**을
  // 보고한다. 세액공제 한도는 연금저축에만 단독 한도가 더 걸리므로 **값이 다를 수 있고**,
  // 공유가 뜻하는 것은 "더하면 안 된다"이지 "같다"가 아니다. 그래서 축마다 다르게 본다.
  for (const limit of scenario.limits.by_account) {
    for (const sharedField of ['contribution_limit_shared_with', 'credit_limit_shared_with']) {
      for (const other of limit[sharedField]) {
        assert.notEqual(other, limit.account, `${at} I10: 자기 자신을 공유 대상으로 적었다`);
        const peer = limitOf(other);
        assert.ok(peer, `${at} I10: 없는 계좌를 공유 대상으로 가리킨다`);
        assert.ok(peer[sharedField].includes(limit.account), `${at} I10: 공유 관계가 대칭이 아니다`);
      }
    }

    if (limit.contribution_limit_shared_with.length > 0) {
      assert.equal(
        limit.contribution_limit_remaining_krw,
        scenario.limits.pension_contribution_limit_remaining_krw,
        `${at} I10: 공유 납입 한도가 합계 필드와 다르다`,
      );
    }
    if (limit.credit_limit_shared_with.length > 0) {
      assert.ok(
        limit.credit_eligible_limit_remaining_krw <= scenario.limits.pension_combined_credit_remaining_krw,
        `${at} I10: 공유 공제 한도가 풀 상한을 넘었다`,
      );
    }
  }

  // 공유하는 계좌 중 적어도 하나는 풀 상한을 그대로 본다. 그렇지 않으면
  // 계좌별 값만으로는 남은 풀을 알 수 없게 되고 화면이 합산의 유혹을 받는다.
  const creditSharers = scenario.limits.by_account.filter((l) => l.credit_limit_shared_with.length > 0);
  if (creditSharers.length > 0) {
    assert.equal(
      Math.max(...creditSharers.map((l) => l.credit_eligible_limit_remaining_krw)),
      scenario.limits.pension_combined_credit_remaining_krw,
      `${at} I10: 어느 공유 계좌도 풀 상한을 그대로 보고하지 않는다`,
    );
  }

  // I11 — 근거가 가리키는 출력 경로가 실제로 있다
  for (const entry of scenario.legal_basis) {
    assert.ok(entry.applied_to.length > 0, `${at} I11: ${entry.rule_id}이 어디에 쓰였는지가 없다`);
    for (const path of entry.applied_to) {
      assert.ok(
        resolvePath(path, scenario, response),
        `${at} I11: ${entry.rule_id}의 applied_to "${path}"가 응답에 없다`,
      );
    }
  }

  // I12 — 돈이 새지 않는다
  const months = response.echo.months_remaining_in_tax_year;
  for (const plan of plans) {
    assert.equal(
      plan.total_allocated_annual_krw + plan.unallocated_annual_krw,
      response.echo.annual_budget_krw,
      `${at} I12: ${plan.plan_id}에서 배분 합 + 미배분이 예산과 다르다`,
    );
    let residual = 0;
    for (const allocation of plan.allocations) {
      assert.equal(
        allocation.monthly_krw,
        Math.floor(allocation.annual_krw / months),
        `${at} I12: 월 금액이 내림과 다르다`,
      );
      residual += allocation.annual_krw - allocation.monthly_krw * months;
    }
    assert.equal(plan.monthly_rounding_residual_krw, residual, `${at} I12: 잔차를 삼켰다`);
  }

  // I13 — 정수·비음수·납입 한도 준수
  walkAmounts(scenario, `${at} I13`);
  for (const plan of plans) {
    const pensionTotal =
      allocOf(plan, 'retirement_pension').annual_krw + allocOf(plan, 'annuity_savings').annual_krw;
    assert.ok(
      pensionTotal <= scenario.limits.pension_contribution_limit_remaining_krw,
      `${at} I13: 연금 배분이 납입 잔여 한도를 넘었다`,
    );
    assert.ok(
      allocOf(plan, 'isa').annual_krw <= limitOf('isa').contribution_limit_remaining_krw,
      `${at} I13: ISA 배분이 납입 잔여 한도를 넘었다`,
    );
  }

  // I14 — 자격 없는 계좌
  for (const eligibility of scenario.account_eligibility) {
    if (eligibility.eligible) continue;
    assert.ok(eligibility.reason_codes.length > 0, `${at} I14: 배제 사유가 없다`);
    for (const plan of plans) {
      assert.equal(allocOf(plan, eligibility.account).annual_krw, 0, `${at} I14: 자격 없는 계좌에 배분됐다`);
      assert.equal(allocOf(plan, eligibility.account).limited_by, 'not_eligible', `${at} I14`);
    }
  }

  // I15 — 확정과 개정예고를 섞지 않는다
  const isProposed = scenario.scenario_id === 'proposed';
  assert.equal(scenario.is_enacted, !isProposed, `${at} I15: is_enacted가 시나리오와 어긋난다`);
  assert.equal(scenario.bill_stages.length > 0, isProposed, `${at} I15: bill_stages가 시나리오와 어긋난다`);
  for (const entry of scenario.legal_basis) {
    if (!isProposed) {
      assert.equal(entry.bill_stage, null, `${at} I15: 확정 시나리오에 개정예고 규칙이 실렸다`);
      assert.equal(entry.status, RULESET_STATUS.CONFIRMED, `${at} I15`);
    }
  }

  // I16 — 개정예고 규칙이 조용히 사라지지 않는다
  if (isProposed) {
    const applied = new Set(scenario.legal_basis.filter((e) => e.bill_stage !== null).map((e) => e.rule_id));
    const unapplied = new Set(scenario.unapplied_proposed_rules.map((r) => r.rule_id));
    for (const rule of rulesets[PROPOSED_FILE].rules) {
      assert.ok(applied.has(rule.id) || unapplied.has(rule.id), `${at} I16: ${rule.id}이 사라졌다`);
    }
    for (const entry of scenario.unapplied_proposed_rules) {
      assert.ok(entry.reason_code.length > 0, `${at} I16: 미적용 사유가 없다`);
    }
  } else {
    assert.deepStrictEqual(scenario.unapplied_proposed_rules, [], `${at} I16`);
  }

  // I17 — 코드가 계약 목록 안에 있다
  for (const code of noticeCodes) assert.ok(KNOWN_NOTICES.has(code), `${at} I17: 알 수 없는 안내 코드 ${code}`);
  for (const code of notes) {
    assert.ok(KNOWN_COMPARISON_NOTES.has(code), `${at} I17: 알 수 없는 비교 안내 코드 ${code}`);
  }
}

function walkAmounts(node, at, path = '') {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkAmounts(item, at, `${path}[${i}]`));
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const child = `${path}.${key}`;
    if (typeof value === 'number' && key.endsWith('_krw')) {
      assert.ok(Number.isInteger(value), `${at}: ${child}가 정수가 아니다 (${value})`);
      // delta는 부호가 있다. 나머지 금액은 음수가 될 수 없다.
      if (key !== 'delta_vs_baseline_krw') {
        assert.ok(value >= 0, `${at}: ${child}가 음수다 (${value})`);
      }
    } else {
      walkAmounts(value, at, child);
    }
  }
}

// ── 실행 ─────────────────────────────────────────────────────────

// 검사기가 스스로 통과하는지 먼저 확인한다. 경로 해석기가 무엇이든 참을 반환하면
// I11은 아무것도 막지 못하면서 통과한다 — 조용히 무력해지는 전형적인 자리다.
test('경로 해석기가 실제로 없는 경로를 걸러낸다', () => {
  const response = compute(baseRequest(), rulesets);
  const scenario = response.scenarios[0];

  for (const good of [
    'limits.pension_combined_credit_limit_krw',
    'limits.by_account[isa].contribution_limit_remaining_krw',
    'plans[].deterministic_benefit',
    'plans[].priority_basis',
    'account_eligibility[isa]',
    'fund_use_horizon_boundaries',
    'echo.credit_rate_bracket',
  ]) {
    assert.ok(resolvePath(good, scenario, response), `있는 경로를 없다고 했다: ${good}`);
  }

  for (const bad of [
    'limits.nope',
    'limits.by_account[nosuch].contribution_limit_remaining_krw',
    'plans[].no_such_field',
    'nope.at.all',
    'plans.deterministic_benefit',
    'account_eligibility[isa].nope',
  ]) {
    assert.equal(resolvePath(bad, scenario, response), false, `없는 경로를 있다고 했다: ${bad}`);
  }
});

test('모든 응답이 교차 필드 불변식을 만족한다', () => {
  let checked = 0;
  for (const { label, request } of matrix()) {
    const response = compute(request, rulesets);
    assert.equal(response.ok, true, `${label}: 계산이 실패했다 — ${JSON.stringify(response.errors)}`);

    for (const code of response.assumptions.map((a) => a.code)) {
      assert.ok(KNOWN_ASSUMPTIONS.has(code), `${label} I17: 알 수 없는 가정 코드 ${code}`);
    }
    assert.deepStrictEqual(
      response.scenarios.map((s) => s.scenario_id),
      request.scenarios,
      `${label}: 시나리오 순서가 고정되지 않았다`,
    );

    for (const scenario of response.scenarios) {
      checkScenario(scenario, response, request, `${label} / ${scenario.scenario_id}`);
      assert.deepStrictEqual(
        scenario.account_eligibility.map((e) => e.account),
        ACCOUNT_ORDER,
        `${label}: 계좌 순서가 고정되지 않았다`,
      );
    }
    checked += 1;
  }

  assert.ok(checked >= 100, `행렬이 너무 작다 (${checked}건)`);
});

// I9 — 자금 사용 시점은 금액을 바꾸지 않는다.
// 계약 4.2절이 스스로 한 선언과 실제 동작을 프로필군 전체에 걸쳐 대조한다.
test('I9 — fund_use_horizon 네 값에서 금액·한도가 동일하다', () => {
  // 금액만 본다. `fill_order`는 배분안이 어떤 순서로 채웠는지를 나타내는 메타이고,
  // 같은 벡터를 내는 두 안이 합쳐질 때 어느 쪽이 남는지가 horizon에 달려 있어
  // 정당하게 달라진다. 계약이 보장한 것은 **금액**이 흔들리지 않는다는 것이다.
  const shape = (scenario) => ({
    limits: scenario.limits,
    plans: scenario.plans
      .map((plan) => ({
        allocations: plan.allocations.map((a) => [a.account, a.annual_krw, a.monthly_krw]),
        benefit: plan.deterministic_benefit,
        unallocated: plan.unallocated_annual_krw,
        residual: plan.monthly_rounding_residual_krw,
      }))
      // 배분안 순서도 horizon의 함수이므로 정렬해 비교한다.
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });

  for (const { label, patch } of PROFILES) {
    for (const scenarios of SCENARIO_SETS) {
      const shapes = HORIZONS.map((horizon) => {
        const response = compute(
          baseRequest(deepMerge(patch, { scenarios, profile: { fund_use_horizon: horizon } })),
          rulesets,
        );
        assert.deepStrictEqual(response.echo.fund_use_horizon_affects, {
          allocation_amounts: false,
          tax_credit_amounts: false,
          limits: false,
          plan_ordering: true,
          baseline_selection: true,
          warnings: true,
        });
        return response.scenarios.map(shape);
      });

      for (let i = 1; i < shapes.length; i += 1) {
        assert.deepStrictEqual(
          shapes[i],
          shapes[0],
          `${label} / [${scenarios}]: ${HORIZONS[i]}의 금액이 ${HORIZONS[0]}과 다르다`,
        );
      }
    }
  }
});
