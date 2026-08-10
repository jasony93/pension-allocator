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
  CREDIT_BOUNDED_PLANS,
  HORIZONS,
  NOTICE,
  NON_QUANTIFIED,
  PLAN,
  PLAN_ORDER,
  RULESET_STATUS,
  UNCERTAINTY_KIND,
  WARNING,
} from './constants.mjs';
import {
  loadRulesets,
  baseRequest,
  birthDateForAge,
  deepMerge,
  PROPOSED_FILE,
  CONFIRMED_FILE,
} from './test-helpers.mjs';

const rulesets = loadRulesets();

const CREDIT_BRACKETS = rulesets[CONFIRMED_FILE].rules.find((r) => r.id === 'pension.credit.rate')
  .value.brackets;

/** 공제율 경계 위인가 — 룰셋에서 읽는다. 경계 위 + 청년 + 개정안이면 동점이 아니다. */
const CREDIT_BOUNDARY = CREDIT_BRACKETS[0].total_salary_only_max_krw;
const overBoundary = (request) => request.profile.current_year_total_salary_krw > CREDIT_BOUNDARY;

/**
 * **총급여액만으로 고른 구간의 비율.** I28의 기대값이고, 종합소득 입력이 들어오기 전
 * 엔진이 하던 판정 그대로다. 룰셋에서 직접 고르므로 엔진의 답을 엔진에게 되묻지 않는다.
 */
/**
 * 부분 인출이 법정 사유 없이 가능한 연금계좌. **룰셋에서 읽는다** — 엔진이 고른 답을
 * 엔진에게 되묻지 않기 위해서다(I36의 기대값).
 */
const FLEXIBLE_PENSION_ACCOUNT = (() => {
  const byAccount = rulesets[CONFIRMED_FILE].rules.find(
    (r) => r.id === 'pension.withdrawal.midterm_restriction',
  ).value.by_account;
  return byAccount['연금저축계좌'].partial_withdrawal_without_statutory_cause
    ? 'annuity_savings'
    : 'retirement_pension';
})();

function rateByTotalSalaryOnly(totalSalary) {
  const bracket = CREDIT_BRACKETS.find(
    (b) => (b.total_salary_only_max_krw ?? null) === null || totalSalary <= b.total_salary_only_max_krw,
  );
  return bracket.rate;
}

const KNOWN_NOTICES = new Set(Object.values(NOTICE));
const KNOWN_WARNINGS = new Set(Object.values(WARNING));
const KNOWN_ASSUMPTIONS = new Set(Object.values(ASSUMPTION));
const KNOWN_COMPARISON_NOTES = new Set(Object.values(COMPARISON_NOTE));
const KNOWN_UNCERTAINTY_KINDS = new Set(Object.values(UNCERTAINTY_KIND));

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
        birth_date: birthDateForAge(30),
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
      profile: { birth_date: birthDateForAge(56) },
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
      profile: { birth_date: birthDateForAge(14), prior_year_total_salary_krw: null },
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
  // ── 세액 한도가 실제로 걸리는 상태들 ────────────────────────────
  // 한도를 넣기 전의 행렬은 전부 "한도가 넉넉하다"는 한 상태만 돌았다.
  // 그 행렬에서는 I22~I26이 통과하면서도 아무것도 막지 못한다.
  {
    label: '세액 한도 0 (결정세액 0 신고)',
    patch: { profile: { prior_year_tax: { state: 'zero', determined_tax_krw: null } } },
  },
  {
    label: '세액 한도가 공제액을 자름',
    patch: {
      profile: {
        prior_year_tax: { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
      },
    },
  },
  {
    label: '세액 한도 모름',
    patch: { profile: { prior_year_tax: { state: 'unknown', determined_tax_krw: null } } },
  },
  {
    label: '세액 한도 모름 (0은 아니라고 답함)',
    patch: {
      profile: { prior_year_tax: { state: 'nonzero_amount_unknown', determined_tax_krw: null } },
    },
  },
  {
    label: '연금 수령 개시 (퇴직연금)',
    patch: { accounts: { retirement_pension: { annuity_start_status: 'started' } } },
  },
  {
    label: '연금 수령 개시 여부 모름 (두 계좌)',
    patch: {
      accounts: {
        retirement_pension: { annuity_start_status: 'unknown' },
        annuity_savings: { annuity_start_status: 'unknown' },
      },
    },
  },
  // ── 공제율 판정 축이 갈리는 상태들 (D27) ────────────────────────
  // 이 셋이 없으면 I28은 한 갈래만 돌면서 통과한다.
  {
    label: '종합소득 있음 · 금액이 우대 구간 위',
    patch: {
      profile: {
        has_non_wage_global_income_current_year: true,
        current_year_global_income_krw: 50_000_000,
        monthly_capacity_krw: 1_000_000,
      },
    },
  },
  {
    label: '종합소득 있음 · 금액이 우대 구간 안',
    patch: {
      profile: {
        has_non_wage_global_income_current_year: true,
        current_year_global_income_krw: 30_000_000,
        monthly_capacity_krw: 1_000_000,
      },
    },
  },
  {
    label: '종합소득 있음 · 금액 모름 (본문 구간 대체)',
    patch: {
      profile: {
        has_non_wage_global_income_current_year: true,
        current_year_global_income_krw: null,
        monthly_capacity_krw: 1_000_000,
      },
    },
  },
  // ── 연금 공제한도를 넘기는 예산 (D26 소유자 재현) ────────────────
  // 미배분 1,100만이 나오고 연금 납입 여력 900만이 남는 바로 그 상태다.
  {
    label: '공제한도 초과 예산 (미배분 갈래 재현)',
    patch: { profile: { monthly_capacity_krw: 5_000_000 } },
  },
  {
    label: '퇴직급여 IRP 입금 · 가입일 있음',
    patch: {
      accounts: {
        retirement_pension: {
          retirement_transfer_in_krw: 80_000_000,
          has_deferred_retirement_income: true,
          opened_on: '2020-05-01',
        },
        annuity_savings: { opened_on: '2015-01-02' },
      },
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
  const eligibleOf = (account) =>
    scenario.account_eligibility.find((e) => e.account === account).eligible;
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
  assert.ok(
    plans.length >= 1 && plans.length <= PLAN_ORDER.length,
    `${at} I7: 배분안 수가 범위 밖이다`,
  );

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

  // I18 — 인출 편의로 세액을 깎지 않는다.
  // 동점 판정이 들어오면서 가장 먼저 무너질 수 있는 선이다. 순서를 무엇으로 정하든
  // `max_tax_credit`의 공제액은 어떤 안보다 작아서는 안 된다.
  const maxCreditPlan = plans.find((p) => p.plan_id === PLAN.MAX_CREDIT);
  if (maxCreditPlan) {
    for (const plan of plans) {
      assert.ok(
        plan.deterministic_benefit.pension_credit_total_krw <=
          maxCreditPlan.deterministic_benefit.pension_credit_total_krw,
        `${at} I18: ${plan.plan_id}가 최대공제안보다 공제액이 크다`,
      );
    }
  }

  // I19 — 동점일 때만 인출 유연을 앞세운다.
  // 동점이 아니면(개정안 청년 우대) 공제가 큰 쪽이 이겨야 한다.
  const tied = !(request.profile.declared_youth === true && scenario.scenario_id === 'proposed' && overBoundary(request));
  for (const plan of plans) {
    const tieBreak = plan.priority_basis.tie_break;
    if (plan.plan_id === PLAN.ANNUITY_FIRST) {
      assert.equal(tieBreak.code, 'not_applicable', `${at} I19: 이름이 순서를 고정한 안에 동점 판정이 붙었다`);
      continue;
    }
    assert.equal(
      tieBreak.code,
      tied ? 'withdrawal_flexibility_first' : 'not_applicable',
      `${at} I19: ${plan.plan_id}의 동점 판정이 실제 공제율 관계와 어긋난다`,
    );
    if (tieBreak.code === 'withdrawal_flexibility_first') {
      assert.ok(tieBreak.basis_rule_ids.length > 0, `${at} I19: 동점 판정에 근거 규칙이 없다`);
      // **보고되는 순서는 실제로 돈이 들어간 순서다.** 연금 쌍을 두 단계로 도는
      // 납입한도 충당안에서는 1차에 공제 여력이 0이던 계좌가 2차에 더 많이 받으면서도
      // 순서상 뒤에 올 수 있다. 그 안에서 동점 규칙이 지켜졌는지는 순서가 아니라
      // **공제를 낳지 않는 몫이 어느 계좌에 있는가**로 본다(I36).
      if (CREDIT_BOUNDED_PLANS.has(plan.plan_id)) {
        assert.deepStrictEqual(
          plan.priority_basis.fill_sequence.filter((a) => a !== 'isa'),
          ['annuity_savings', 'retirement_pension'],
          `${at} I19: 동점인데 더 묶이는 계좌를 먼저 채운다`,
        );
      }
    }
  }

  // I20 — 순서 보고가 거짓말하지 않는다.
  // fill_sequence가 실제 배분 순서(fill_order)와 어긋나면 화면이 근거를 잘못 설명한다.
  for (const plan of plans) {
    const filled = plan.allocations
      .filter((a) => a.fill_order !== null)
      .sort((x, y) => x.fill_order - y.fill_order)
      .map((a) => a.account);
    const expected = plan.priority_basis.fill_sequence.filter((account) =>
      filled.includes(account),
    );
    assert.deepStrictEqual(filled, expected, `${at} I20: 보고한 순서와 실제 충당 순서가 다르다`);
  }

  // I21 — 이 규칙이 가르는 것은 과세가 아니다.
  // 중도인출 제약은 연금저축과 IRP를 가르지만 과세는 같다. 경고를 한쪽에만 붙이면
  // 그것이 새로운 오류다.
  for (const plan of plans) {
    for (const account of ['retirement_pension', 'annuity_savings']) {
      if (allocOf(plan, account).annual_krw <= 0) continue;
      if (horizon === 'at_or_after_pension_age') continue;
      assert.ok(
        plan.warnings.some((w) => w.code === WARNING.PENSION_EARLY_WITHDRAWAL && w.account === account),
        `${at} I21: ${account}에 연금 인출 경고가 빠졌다 — 과세는 두 계좌가 같다`,
      );
    }
  }

  // ── 세액 한도 ────────────────────────────────────────────────
  const cap = scenario.pension_credit_tax_liability_cap;

  // I22 — **인정 공제액은 결코 한도를 넘지 않는다.**
  // 이 불변식 하나가 §61 ②③의 "그 초과하는 금액은 없는 것으로 한다"를 기계로 고정한다.
  for (const plan of plans) {
    const benefit = plan.deterministic_benefit;
    if (cap.known) {
      assert.ok(
        benefit.pension_credit_income_tax_krw <= cap.cap_krw,
        `${at} I22: 인정 공제액(${benefit.pension_credit_income_tax_krw})이 한도(${cap.cap_krw})를 넘었다`,
      );
    } else {
      // 한도를 모르면 자르지 않는다 — 지어낸 한도로 자르는 것이 더 나쁘다.
      assert.equal(
        benefit.pension_credit_income_tax_krw,
        benefit.pension_credit_income_tax_before_cap_krw,
        `${at} I22: 한도를 모르는데 값이 잘렸다`,
      );
      assert.equal(benefit.tax_liability_cap.applied, false, `${at} I22: 모르는 한도를 적용했다`);
    }
  }

  // I23 — 자르기 전 금액과 자른 뒤 금액, 그리고 그 차이가 서로 어긋나지 않는다.
  // 화면이 "계산된 공제액 중 얼마가 이번 과세연도에 들어 있지 않은지"를 이 셋으로 말한다.
  for (const plan of plans) {
    const b = plan.deterministic_benefit;
    const c = b.tax_liability_cap;
    assert.ok(
      b.pension_credit_income_tax_krw <= b.pension_credit_income_tax_before_cap_krw,
      `${at} I23: 자른 뒤가 자르기 전보다 크다`,
    );
    assert.equal(
      c.reduced_income_tax_krw,
      b.pension_credit_income_tax_before_cap_krw - b.pension_credit_income_tax_krw,
      `${at} I23: 잘린 소득세분이 두 값의 차이와 다르다`,
    );
    assert.equal(
      c.reduced_total_krw,
      b.pension_credit_total_before_cap_krw - b.pension_credit_total_krw,
      `${at} I23: 잘린 합계가 두 값의 차이와 다르다`,
    );
    // 임계값은 "낼 세금이 얼마 아래면 결과가 달라지는가"다. 자르기 전 소득세분이 그 값이다.
    assert.equal(
      c.threshold_income_tax_krw,
      b.pension_credit_income_tax_before_cap_krw,
      `${at} I23: 임계값이 자르기 전 소득세분과 다르다`,
    );
    assert.equal(
      c.applied,
      cap.known && c.reduced_income_tax_krw > 0,
      `${at} I23: 잘림 표시가 실제 잘린 금액과 어긋난다`,
    );
    // 잘린 것은 공제액이고 납입액이 아니다. 납입액은 전환 신청의 대상으로 살아남는다.
    assert.equal(
      c.contribution_carryover_available,
      c.applied,
      `${at} I23: 잘렸는데 납입액 전환 가능 표시가 따라오지 않았다`,
    );
  }

  // I24 — 한도가 0이면 세액공제로는 배분안이 갈리지 않는다는 사실이 값으로 나간다.
  // 조용히 아무 배분이나 고르고 `max_tax_credit`이라는 이름을 다는 것이 이 검사가 막는 것이다.
  const axisFlat = cap.known && cap.cap_krw === 0;
  assert.equal(
    notes.includes(COMPARISON_NOTE.TAX_CREDIT_AXIS_FLAT),
    axisFlat,
    `${at} I24: 비교 축 상실 안내가 한도 0 여부와 어긋난다`,
  );
  for (const plan of plans) {
    // 이름이 세액공제를 근거로 든 안만 "이 입력에서 내 근거가 아무것도 가르지 못한다"를
    // 신고한다. `isa_first`(인출 가능성)와 `pension_contribution_limit_fill`(납입 한도)은
    // 근거가 세액공제가 아니므로 한도가 0이어도 이름이 거짓말하지 않는다.
    const creditNamed = [PLAN.MAX_CREDIT, PLAN.ANNUITY_FIRST].includes(plan.plan_id);
    assert.equal(
      plan.priority_basis.objective_degenerate,
      axisFlat && creditNamed,
      `${at} I24: ${plan.plan_id}의 목적함수 무력화 표시가 어긋난다`,
    );
    if (axisFlat) {
      assert.equal(
        plan.deterministic_benefit.pension_credit_total_krw,
        0,
        `${at} I24: 한도가 0인데 공제액이 남아 있다`,
      );
    }
  }

  // I25 — 연금수령을 개시했거나 개시 여부를 모르는 계좌에는 배분하지 않는다.
  // **두 계좌를 구분하지 않는다** — 조문이 '연금계좌'를 대상으로 쓰기 때문이다.
  for (const account of ['retirement_pension', 'annuity_savings']) {
    const status = request.accounts[account].annuity_start_status;
    const entry = scenario.account_eligibility.find((e) => e.account === account);
    assert.equal(
      entry.eligible,
      status === 'not_started',
      `${at} I25: ${account}의 자격이 연금수령 개시 상태와 어긋난다 (${status})`,
    );
  }

  // I28 — **근로소득만 있는 사용자의 공제율은 총급여액이 정한다.**
  // 종합소득 입력이 계약에 들어오기 전과 같은 결과라는 뜻이고, 대다수 사용자에게
  // 회귀가 없다는 것을 기계로 고정하는 자리다. 기대 비율은 룰셋에서 직접 고른다 —
  // 엔진이 고른 값을 다시 엔진에게 물으면 아무것도 확인하지 못한다.
  const bracket = response.echo.credit_rate_bracket;
  if (request.profile.has_non_wage_global_income_current_year !== true) {
    assert.equal(bracket.basis_code, 'total_salary', `${at} I28: 근로소득만 있는데 다른 축으로 판정했다`);
    assert.equal(bracket.fallback_applied, false, `${at} I28: 근로소득만 있는데 대체값을 적용했다`);
    assert.equal(
      bracket.measured_amount_krw,
      request.profile.current_year_total_salary_krw,
      `${at} I28: 판정에 쓴 금액이 총급여액이 아니다`,
    );
    assert.equal(
      bracket.income_tax_rate,
      rateByTotalSalaryOnly(request.profile.current_year_total_salary_krw),
      `${at} I28: 총급여액만으로 고른 구간과 다르다`,
    );
  }
  assert.equal(
    bracket.fallback_direction_code,
    bracket.fallback_applied ? 'understated_or_equal' : null,
    `${at} I28: 대체값 적용 표시와 오차 방향이 어긋난다`,
  );

  // I29 — **미배분 갈래가 미배분 총액과 맞물린다.**
  // 갈래를 나눈 목적이 "갈 곳이 없다"와 "갈 곳은 있으나 공제가 없다"를 가르는 것이므로,
  // 갈래가 총액과 어긋나면 그 구분 자체가 거짓이 된다.
  for (const plan of plans) {
    const b = plan.unallocated_breakdown;
    const label = `${at} I29 [${plan.plan_id}]`;
    assert.equal(b.total_annual_krw, plan.unallocated_annual_krw, `${label}: 총액이 미배분과 다르다`);
    assert.ok(b.pension_contribution_headroom_krw <= b.total_annual_krw, `${label}: 연금 여력이 총액을 넘었다`);
    assert.ok(b.isa_contribution_headroom_krw <= b.total_annual_krw, `${label}: ISA 여력이 총액을 넘었다`);
    assert.equal(
      Math.min(b.total_annual_krw, b.pension_contribution_headroom_krw + b.isa_contribution_headroom_krw) +
        b.no_headroom_krw,
      b.total_annual_krw,
      `${label}: 갈래의 합이 총액과 맞지 않는다`,
    );
    assert.equal(
      b.headrooms_overlap,
      b.pension_contribution_headroom_krw + b.isa_contribution_headroom_krw > b.total_annual_krw,
      `${label}: 겹침 표시가 실제와 어긋난다 — true인데 더하면 이중계상이다`,
    );
    // 자격이 없는 계좌에는 넣을 수 없다. 여력이라고 부르면 거짓이다.
    if (!eligibleOf('isa')) {
      assert.equal(b.isa_contribution_headroom_krw, 0, `${label}: 자격 없는 ISA에 여력이 있다고 말한다`);
    }
    if (!eligibleOf('retirement_pension') && !eligibleOf('annuity_savings')) {
      assert.equal(b.pension_contribution_headroom_krw, 0, `${label}: 막힌 연금계좌에 여력이 있다고 말한다`);
    }
  }

  // I30 — **공제를 낳지 않는 연금 납입에는 세 사실이 반드시 함께 붙는다.**
  // 셋 중 하나라도 빠지면 화면 문장이 거짓이 된다(D26). 특히 확인 절차가 빠지면
  // 화면은 "나중에 비과세로 돌아옵니다"를 쓰게 되고 그 문장은 거짓이다.
  for (const plan of plans) {
    for (const effect of plan.non_quantified_effects) {
      assert.equal(effect.quantifiable, false, `${at} I30: 정량화 표시가 어긋난다`);
      if (effect.code !== NON_QUANTIFIED.PENSION_WITHOUT_CREDIT) {
        assert.equal(effect.facts, null, `${at} I30: 이 코드에는 facts가 붙지 않는다`);
        continue;
      }
      assert.ok(
        !CREDIT_BOUNDED_PLANS.has(plan.plan_id),
        `${at} I30: 공제 한도까지만 채우는 ${plan.plan_id}에서 공제 없는 납입이 생겼다`,
      );
      assert.deepStrictEqual(
        Object.keys(effect.facts).sort(),
        [
          'contribution_without_credit_krw',
          'credit_this_year_krw',
          'principal_tax_free_confirmation_prospective_only',
          'principal_tax_free_requires_confirmation',
          'principal_taxed_on_withdrawal',
          'returns_taxed_on_withdrawal',
        ],
        `${at} I30: 함께 나가야 하는 사실이 빠졌다`,
      );
      assert.ok(effect.facts.contribution_without_credit_krw > 0, `${at} I30: 금액이 0인데 효과가 붙었다`);
      assert.equal(effect.facts.credit_this_year_krw, 0, `${at} I30`);
      assert.deepStrictEqual(
        effect.headroom_shared_with,
        [effect.account === 'retirement_pension' ? 'annuity_savings' : 'retirement_pension'],
        `${at} I30: 연금 납입 여력은 두 계좌가 나눠 쓴다 — 더하면 이중계상이다`,
      );
    }
  }

  // I31 — **불확실성 표시는 유무가 아니라 목록으로 나간다.**
  // 유무만 보는 구조로는 "일부 해소"를 표현할 수 없고, 표시 하나를 지우면 남은 것까지
  // 조용히 사라진다(D27의 구조적 발견).
  for (const entry of scenario.legal_basis) {
    assert.equal(
      entry.has_uncertainty_note,
      entry.uncertainty_notes.length > 0,
      `${at} I31: ${entry.rule_id}의 유무 표시와 목록이 어긋난다`,
    );
    for (const note of entry.uncertainty_notes) {
      assert.ok(note.path.length > 0, `${at} I31: ${entry.rule_id}의 불확실 표시에 위치가 없다`);
      assert.ok(KNOWN_UNCERTAINTY_KINDS.has(note.kind), `${at} I31: 알 수 없는 종류 ${note.kind}`);
    }
  }

  // I32 — **배분 후 잔여 공제 한도가 배분 전 한도와 인정액에서 나온다.**
  // 화면이 "한도 · 이 배분이 쓴 양 · 남은 양" 셋을 함께 적으려면 그 셋이 맞물려야 한다.
  for (const plan of plans) {
    assert.equal(
      plan.pension_combined_credit_remaining_after_plan_krw,
      Math.max(
        0,
        scenario.limits.pension_combined_credit_limit_krw -
          plan.deterministic_benefit.credit_eligible_contribution_krw,
      ),
      `${at} I32: ${plan.plan_id}의 배분 후 잔여 한도가 한도−인정액과 다르다`,
    );
  }

  // I33 — **납입한도 충당안은 기본안이 되지 않는다.** 세법이 유불리를 정하지 않으므로
  // 엔진이 그것을 고르면 그것이 곧 자문이다(D26).
  assert.notEqual(
    plans[0].plan_id,
    PLAN.PENSION_LIMIT_FILL,
    `${at} I33: 세법이 정하지 않은 안을 엔진이 기본으로 골랐다`,
  );

  // I34 — `credit_limit`이 상한이었다는 보고는 공제 한도까지만 채우는 안에서만 나온다.
  for (const plan of plans) {
    if (CREDIT_BOUNDED_PLANS.has(plan.plan_id)) continue;
    for (const allocation of plan.allocations) {
      assert.notEqual(
        allocation.limited_by,
        'credit_limit',
        `${at} I34: ${plan.plan_id}가 공제 한도에 막혔다고 보고한다 — 그 안의 상한이 아니다`,
      );
    }
  }

  // I35 — **납입한도 충당안은 확정 세액을 한 원도 깎지 않는다.**
  // 조문 산식상 연금 납입 총액을 두 계좌에 어떻게 쪼개든, 퇴직연금이 `합산한도 − 단독한도`
  // 만큼만 받으면 인정액이 최대다. 그러므로 이 안의 인정액과 공제액은 최대공제안과
  // **같아야 한다.** 같지 않다면 순서를 잘못 골라 세액을 버린 것이다.
  const fillPlan = plans.find((p) => p.plan_id === PLAN.PENSION_LIMIT_FILL);
  if (fillPlan && maxCreditPlan) {
    assert.equal(
      fillPlan.deterministic_benefit.credit_eligible_contribution_krw,
      maxCreditPlan.deterministic_benefit.credit_eligible_contribution_krw,
      `${at} I35: 납입한도 충당안이 인정 납입액을 잃었다`,
    );
    assert.equal(
      fillPlan.deterministic_benefit.pension_credit_total_krw,
      maxCreditPlan.deterministic_benefit.pension_credit_total_krw,
      `${at} I35: 납입한도 충당안이 확정 세액을 깎았다 — 그 대가는 0이어야 한다`,
    );
  }

  // I36 — **공제를 낳지 않는 몫은 인출이 자유로운 계좌에 있다.**
  // 그 몫은 어느 계좌에 넣어도 세액이 같으므로 세금이 순서를 정하지 못하고,
  // 남는 축은 인출 가능성뿐이다(D18·계약 0.4절). 대가 없이 더 묶이는 쪽을 고르지 않는다.
  if (fillPlan) {
    const withoutCredit = fillPlan.non_quantified_effects.filter(
      (e) => e.code === NON_QUANTIFIED.PENSION_WITHOUT_CREDIT,
    );
    for (const effect of withoutCredit) {
      if (!eligibleOf(FLEXIBLE_PENSION_ACCOUNT)) continue;
      assert.equal(
        effect.account,
        FLEXIBLE_PENSION_ACCOUNT,
        `${at} I36: 공제를 낳지 않는 납입을 대가 없이 더 묶이는 계좌에 넣었다`,
      );
    }
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
  // 조건부 분기가 양쪽 다 실제로 등장했는지 센다. 한쪽만 돌면 그 불변식은
  // 통과하면서도 아무것도 막지 못한다.
  const tieBreaksSeen = new Set();
  const basisSeen = new Set();
  const plansSeen = new Set();
  const nonQuantifiedSeen = new Set();
  for (const { label, request } of matrix()) {
    const response = compute(request, rulesets);
    assert.equal(response.ok, true, `${label}: 계산이 실패했다 — ${JSON.stringify(response.errors)}`);
    basisSeen.add(response.echo.credit_rate_bracket.basis_code);

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
      for (const plan of scenario.plans) {
        tieBreaksSeen.add(plan.priority_basis.tie_break.code);
        plansSeen.add(plan.plan_id);
        for (const effect of plan.non_quantified_effects) nonQuantifiedSeen.add(effect.code);
      }
      assert.deepStrictEqual(
        scenario.account_eligibility.map((e) => e.account),
        ACCOUNT_ORDER,
        `${label}: 계좌 순서가 고정되지 않았다`,
      );
    }
    checked += 1;
  }

  assert.ok(checked >= 100, `행렬이 너무 작다 (${checked}건)`);
  assert.deepStrictEqual(
    [...tieBreaksSeen].sort(),
    ['not_applicable', 'withdrawal_flexibility_first'],
    '동점 판정의 양쪽이 모두 행렬에 등장해야 I19가 실제로 무언가를 막는다',
  );
  // 공제율 판정 축 세 갈래가 모두 돌아야 I28이 무언가를 막는다. 하나만 돌면
  // "근로소득만 있는 사용자에게 회귀가 없다"는 진술이 공허해진다.
  assert.deepStrictEqual(
    [...basisSeen].sort(),
    ['global_income', 'statutory_default', 'total_salary'],
    '공제율 판정 축 세 갈래가 모두 행렬에 등장해야 한다',
  );
  // 새 배분안과 새 비정량 효과가 실제로 나온 적이 없으면 I30·I33·I34는 통과만 한다.
  assert.ok(plansSeen.has(PLAN.PENSION_LIMIT_FILL), '납입한도 충당안이 행렬에 한 번도 등장하지 않았다');
  assert.ok(
    nonQuantifiedSeen.has(NON_QUANTIFIED.PENSION_WITHOUT_CREDIT),
    '공제 없는 연금 납입 효과가 행렬에 한 번도 등장하지 않았다',
  );
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

// I26 — 세액 한도는 배분을 바꾸지 않는다.
// 계약 4.2절의 `tax_liability_cap_affects` 선언과 실제 동작을 대조한다.
//
// **왜 이 선이 필요한가.** "공제를 늘리지 못하는 납입은 넣지 않는다"는 기존 규칙을
// 한도에까지 밀면, 한도가 0인 사용자의 연금계좌 배분이 0이 된다. 그것은 세법이 정한
// 결론이 아니다 — 시행령 §118의3이 그 납입액을 이후 과세기간으로 넘길 수 있게 하므로
// "넣지 마라"는 제품 판단이지 조문의 결론이 아니다. 그래서 한도는 **공제액만** 자른다.
test('I26 — 세액 한도가 배분·한도·순서를 바꾸지 않는다', () => {
  const CAPS = [
    { state: 'unknown', determined_tax_krw: null },
    { state: 'nonzero_amount_unknown', determined_tax_krw: null },
    { state: 'zero', determined_tax_krw: null },
    { state: 'amount', determined_tax_krw: 0, pension_credit_applied_krw: 0 },
    { state: 'amount', determined_tax_krw: 300_000, pension_credit_applied_krw: 0 },
    { state: 'amount', determined_tax_krw: 100_000_000, pension_credit_applied_krw: 0 },
  ];

  const shape = (scenario) => ({
    limits: scenario.limits,
    plans: scenario.plans.map((plan) => ({
      plan_id: plan.plan_id,
      is_baseline: plan.is_baseline,
      allocations: plan.allocations.map((a) => [a.account, a.annual_krw, a.limited_by, a.fill_order]),
      warnings: plan.warnings.map((w) => [w.code, w.account, w.severity]),
      credit_eligible_krw: plan.deterministic_benefit.credit_eligible_contribution_krw,
      // 자르기 **전** 금액은 한도의 함수가 아니다. 자른 뒤 금액만 달라져야 한다.
      before_cap: plan.deterministic_benefit.pension_credit_total_before_cap_krw,
    })),
  });

  for (const { label, patch } of PROFILES) {
    // 한도를 이미 지정한 프로필군은 이 검사의 대상이 아니다 — 여기서 덮어쓰면 같은 것을 두 번 본다.
    if (JSON.stringify(patch).includes('prior_year_tax')) continue;
    for (const horizon of HORIZONS) {
      const shapes = CAPS.map((prior) =>
        compute(
          baseRequest(
            deepMerge(patch, {
              scenarios: ['current', 'proposed'],
              profile: { fund_use_horizon: horizon, prior_year_tax: prior },
            }),
          ),
          rulesets,
        ),
      );

      for (const response of shapes) {
        assert.equal(response.ok, true, `${label}: 계산이 실패했다`);
        assert.deepStrictEqual(response.echo.tax_liability_cap_affects, {
          allocation_amounts: false,
          tax_credit_amounts: true,
          limits: false,
          plan_ordering: false,
          baseline_selection: false,
          warnings: false,
        });
      }

      const first = shapes[0].scenarios.map(shape);
      for (let i = 1; i < shapes.length; i += 1) {
        assert.deepStrictEqual(
          shapes[i].scenarios.map(shape),
          first,
          `${label} / ${horizon}: 한도 ${CAPS[i].state}에서 배분이 달라졌다`,
        );
      }
    }
  }
});

// I27 — **한도를 모를 때의 값은 아는 경우의 값보다 작지 않다.**
// 룰셋이 확정한 오차 방향(과대이거나 같고 결코 과소일 수 없다)을 기계로 고정한다.
// 이것이 무너지면 "최대 이만큼"이라는 화면 문구가 근거를 잃는다.
test('I27 — 한도 미확인의 결과는 언제나 상한이다', () => {
  const KNOWN = [0, 1, 300_000, 989_999, 990_000, 100_000_000];

  for (const { label, patch } of PROFILES) {
    if (JSON.stringify(patch).includes('prior_year_tax')) continue;
    for (const scenarios of SCENARIO_SETS) {
      const run = (prior) =>
        compute(
          baseRequest(deepMerge(patch, { scenarios, profile: { prior_year_tax: prior } })),
          rulesets,
        );

      const unknown = run({ state: 'unknown', determined_tax_krw: null });
      assert.equal(unknown.ok, true);

      for (const determined of KNOWN) {
        const known = run({
          state: 'amount',
          determined_tax_krw: determined,
          pension_credit_applied_krw: 0,
        });
        assert.equal(known.ok, true);

        for (let s = 0; s < known.scenarios.length; s += 1) {
          const knownPlans = known.scenarios[s].plans;
          const unknownPlans = unknown.scenarios[s].plans;
          assert.equal(knownPlans.length, unknownPlans.length, `${label}: 배분안 수가 달라졌다`);

          for (let i = 0; i < knownPlans.length; i += 1) {
            assert.equal(knownPlans[i].plan_id, unknownPlans[i].plan_id);
            assert.ok(
              unknownPlans[i].deterministic_benefit.pension_credit_total_krw >=
                knownPlans[i].deterministic_benefit.pension_credit_total_krw,
              `${label} / ${knownPlans[i].plan_id}: 한도를 모를 때의 값이 아는 경우(${determined})보다 작다`,
            );
          }
        }
      }
    }
  }
});
