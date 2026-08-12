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
  LIMITED_BY,
  HORIZONS,
  ISA_ESTIMATE_DISPLAY,
  ISA_INCOME_CHARACTERS,
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
  findRule,
  CAP_COORDINATES,
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
    // **월 환산 잔차가 한 갈래에 몰리는 좌표다.** 다른 프로필은 한도·예산이 전부 개월수로
    // 나누어떨어져 조정이 한 번도 일어나지 않고, 그러면 I12.1(d)의 범위 검사가 통과하면서
    // 아무것도 막지 못한다. 기납입 1원·9원이 네 갈래의 나머지를 0이 아니게 만들고,
    // 예산이 모든 한도를 넘어 세 계좌가 막히므로 미배분이 잔차를 혼자 떠안는다.
    // **여기서 조정액이 2를 넘고 이탈이 개월수를 넘는다** — 계약 `7.0.0`이 그 범위를
    // `±(개월수 − 1)`로 적었던 자리이고, 그 서술이 틀렸다는 것이 이 좌표로 드러난다.
    label: '월 환산 잔차가 미배분에 몰린다 (계약 0.12절)',
    patch: {
      profile: { monthly_capacity_krw: 10_000_000 },
      accounts: {
        annuity_savings: { ytd_contribution_krw: 1 },
        retirement_pension: { ytd_contribution_krw: 1 },
        isa: { cumulative_contribution_krw: 9, ytd_contribution_krw: 9, years_since_opening: 3 },
      },
    },
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
  //
  // **한도가 입력에서 총급여액의 함수로 바뀌었다**(D39·D40). 그래서 이 세 줄은 이제
  // 세액 한도가 아니라 **총급여액**을 갈아 끼운다 — 좌표의 값은 관리자가 조문으로
  // 검산한 것이고(`CAP_COORDINATES`), 셋 다 공제율 우대 구간 안이라 갈리는 축은 한도뿐이다.
  {
    label: '세액 한도 0 (과세표준이 정확히 0인 총급여)',
    patch: {
      profile: { current_year_total_salary_krw: CAP_COORDINATES.ZERO_EXACT.total_salary_krw },
    },
  },
  {
    label: '세액 한도가 공제액을 자름',
    patch: {
      profile: { current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw },
    },
  },
  {
    label: '세액 한도가 최대 공제액과 정확히 같아지는 총급여',
    patch: {
      profile: {
        current_year_total_salary_krw: CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw,
      },
    },
  },
  {
    label: '오차 방향이 미정인 분기 (종합소득 있음 · 금액 모름)',
    patch: {
      profile: {
        has_non_wage_global_income_current_year: true,
        current_year_global_income_krw: null,
      },
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

  // I12 — 돈이 새지 않는다 (연 기준)
  const months = response.echo.months_remaining_in_tax_year;
  for (const plan of plans) {
    assert.equal(
      plan.total_allocated_annual_krw + plan.unallocated_annual_krw,
      response.echo.annual_budget_krw,
      `${at} I12: ${plan.plan_id}에서 배분 합 + 미배분이 예산과 다르다`,
    );
    let residual = 0;
    for (const allocation of plan.allocations) {
      residual += allocation.annual_krw % months;
    }
    assert.equal(
      plan.monthly_rounding_residual_krw,
      residual,
      `${at} I12: 잔차를 삼켰다 — 내림으로 버려지는 몫의 합과 다르다`,
    );
  }

  // I12.1 — **월 표시 금액이 월 납입 여력과 맞아떨어진다** (소유자 신고: 도넛 가운데 1원 부족)
  //
  // 여기서 고정하는 것은 넷이다. 하나라도 빠지면 지난 결함이 되돌아온다.
  //   (a) 네 갈래(세 계좌 + 미배분) + 담지 못한 몫 = 월 납입 여력. **정확히 같다.**
  //   (b) 월 배분의 합 × 개월수 ≤ 예산. 월 금액을 올려 예산을 넘기지 않는다.
  //   (c) 각 계좌의 월 × 개월수 ≤ **그 계좌의 납입 잔여 한도.** 연 배분이 아니라 한도다 —
  //       둘을 다 지키면서 합을 맞추는 것은 불가능하고(monthly.mjs 머리말의 증명),
  //       넘으면 안 되는 것은 조문이 정한 한도 쪽이다.
  //   (d) 벗어남이 **잔차 몫으로 정확히 설명되고** 그 범위 안에 있다. 배분이 0인 갈래는
  //       월 금액도 0이다.
  //
  // ── (d)의 범위를 16차에 고쳤다. 전에 적혀 있던 「갈래당 개월수 미만」은 틀렸다 ──
  //
  // 이탈 = `조정액 × 개월수 − (연 배분 mod 개월수)`이고, **조정액이 2 이상인 갈래가 실재한다**
  // (`monthly.test.mjs`의 「한 갈래가 조정을 둘 이상 받는다」와 아래 회귀 좌표). 그래서
  // 위쪽 범위는 개월수가 아니라 **(갈래 수 − 1) × (개월수 − 1)**이다. 증명은 두 줄이다.
  //
  //   얹어야 할 총량을 k라 하면 Σ(연 배분 mod m) = k·m 이고, 어느 갈래의 조정액도 k 이하다.
  //   갈래 X의 나머지는 r_X = k·m − Σ_{Y≠X} r_Y ≥ k·m − (갈래 수 − 1)(m − 1) 이므로
  //   이탈_X = 조정액_X·m − r_X ≤ k·m − r_X ≤ (갈래 수 − 1)(m − 1).
  //
  // 아래쪽은 조정액이 0이고 나머지가 최대일 때이므로 −(m − 1) 그대로다. **두 끝 다 실제로
  // 닿는다** — 계약 0.12절에 좌표를 적었다.
  const capacity = response.echo.monthly_capacity_krw;
  // 세 계좌 + 미배분. 세법 수치가 아니라 갈래의 개수다.
  const branchCount = ACCOUNT_ORDER.length + 1;
  const deviationRange = (deviation, where) => {
    assert.ok(
      deviation >= -(months - 1) && deviation <= (branchCount - 1) * (months - 1),
      `${where}: 월 환산 이탈 ${deviation}이 범위 [${-(months - 1)}, ${(branchCount - 1) * (months - 1)}]를 벗어났다`,
    );
  };
  for (const plan of plans) {
    const allocatedMonthly = plan.allocations.reduce((sum, a) => sum + a.monthly_krw, 0);
    assert.equal(
      allocatedMonthly + plan.unallocated_monthly_krw + plan.monthly_unassigned_krw,
      capacity,
      `${at} I12.1(a): ${plan.plan_id}의 월 표시 금액 합이 월 납입 여력과 다르다`,
    );
    assert.ok(
      allocatedMonthly * months <= response.echo.annual_budget_krw,
      `${at} I12.1(b): 월 배분 × 개월수가 예산을 넘었다`,
    );

    let pensionAnnualized = 0;
    for (const allocation of plan.allocations) {
      assert.equal(
        allocation.monthly_krw,
        Math.floor(allocation.annual_krw / months) + allocation.monthly_rounding_adjustment_krw,
        `${at} I12.1: 월 금액이 「내림 + 잔차 몫」과 다르다`,
      );
      assert.equal(
        allocation.monthly_annualized_krw,
        allocation.monthly_krw * months,
        `${at} I12.1: 연 환산이 월 × 개월수와 다르다`,
      );
      // (d) 배분이 0인 계좌에 월 금액이 붙으면 「넣지 않는다」는 보고가 거짓이 된다.
      if (allocation.annual_krw === 0) {
        assert.equal(allocation.monthly_krw, 0, `${at} I12.1(d): 배분 0인 계좌에 월 금액이 붙었다`);
      }
      // 벗어남의 크기가 잔차 몫으로 정확히 설명된다. 설명되지 않는 어긋남은 결함이다.
      assert.equal(
        allocation.monthly_annualized_krw - allocation.annual_krw,
        allocation.monthly_rounding_adjustment_krw * months - (allocation.annual_krw % months),
        `${at} I12.1(d): 월 환산의 벗어남이 잔차 몫으로 설명되지 않는다`,
      );
      deviationRange(
        allocation.monthly_annualized_krw - allocation.annual_krw,
        `${at} I12.1(d): ${plan.plan_id}/${allocation.account}`,
      );
      if (allocation.account === 'isa') {
        assert.ok(
          allocation.monthly_annualized_krw <= limitOf('isa').contribution_limit_remaining_krw,
          `${at} I12.1(c): ISA 월 × 개월수가 납입 잔여 한도를 넘었다`,
        );
      } else {
        pensionAnnualized += allocation.monthly_annualized_krw;
      }
    }
    assert.ok(
      pensionAnnualized <= scenario.limits.pension_contribution_limit_remaining_krw,
      `${at} I12.1(c): 연금 월 × 개월수의 합이 납입 잔여 한도를 넘었다`,
    );

    // 담지 못한 몫이 있으면 **이유가 값으로 나온다.** 조용히 모자라지 않는다.
    assert.equal(
      plan.monthly_unassigned_reason_code !== null,
      plan.monthly_unassigned_krw > 0,
      `${at} I12.1: 담지 못한 몫과 그 이유가 어긋난다`,
    );
    // 미배분이 0인데 월 미배분이 붙으면 「남길 것이 없다」는 보고가 거짓이 된다.
    if (plan.unallocated_annual_krw === 0) {
      assert.equal(plan.unallocated_monthly_krw, 0, `${at} I12.1(d): 미배분 0인데 월 미배분이 붙었다`);
    }
    // 미배분 갈래도 같은 범위 안이다. **위쪽 끝에 실제로 닿는 것이 이 갈래다** —
    // 한도 조건이 없어 세 계좌가 전부 막힌 좌표에서 잔차를 혼자 다 떠안는다.
    deviationRange(
      plan.unallocated_monthly_krw * months - plan.unallocated_annual_krw,
      `${at} I12.1(d): ${plan.plan_id}/미배분`,
    );
    // 얹은 몫 + 못 얹은 몫 = 내림으로 잃은 총량 ÷ 개월수. **갈래가 넷이므로 3을 넘지 못한다.**
    const flooringLoss =
      plan.allocations.reduce((sum, a) => sum + (a.annual_krw % months), 0) +
      (plan.unallocated_annual_krw % months);
    const carried =
      plan.allocations.reduce((sum, a) => sum + a.monthly_rounding_adjustment_krw, 0) +
      plan.unallocated_monthly_rounding_adjustment_krw;
    assert.equal(
      carried + plan.monthly_unassigned_krw,
      flooringLoss / months,
      `${at} I12.1: 얹은 몫과 못 얹은 몫의 합이 내림으로 잃은 양과 다르다`,
    );
    assert.ok(carried + plan.monthly_unassigned_krw <= ACCOUNT_ORDER.length, `${at} I12.1: 잔차가 갈래 수를 넘었다`);
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
      // **여기서 순서를 검사하지 않는다.** D32로 네 안이 전부 연금 쌍을 두 단계로 돌게
      // 되었고, `fill_sequence`는 **실제로 돈이 들어간 순서**라서 1차에 공제 여력이 0이던
      // 계좌가 3차에 더 많이 받으면서도 뒤에 올 수 있다. 그 배열을 여기서 고정하면
      // **정상 동작을 위반으로 잡는다.**
      //
      // 동점 규칙이 실제로 지켜졌는지는 순서가 아니라 **공제를 낳지 않는 몫이 어느 계좌에
      // 있는가**로 본다 — I36이 그 검사이고, D32에서 네 안 전부로 넓혔다.
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
  //
  // **한도에 「모름」이 없다**(D39·D40). 총급여액이 있으면 값이 하나로 정해지므로
  // 갈래가 하나뿐이고, 그래서 이 불변식이 모든 요청에 걸린다.
  assert.equal(Number.isInteger(cap.cap_krw), true, `${at} I22: 한도가 정수가 아니다`);
  for (const plan of plans) {
    const benefit = plan.deterministic_benefit;
    assert.ok(
      benefit.pension_credit_income_tax_krw <= cap.cap_krw,
      `${at} I22: 인정 공제액(${benefit.pension_credit_income_tax_krw})이 한도(${cap.cap_krw})를 넘었다`,
    );
  }

  // I30 — **과세표준은 조문이 지목한 단계에서 한 번만 버려진다** (D46 1번).
  //
  // 「국고금 관리법」 §47②가 끝수를 없애라고 지목한 것은 **과세표준액**이고, 그 앞의
  // 근로소득공제액·근로소득금액은 지목하지 않았다. 지목되지 않은 자리에서 버리면 조문에
  // 없는 절사 지점이 생기고, 그 끝수가 위로 밀려 **과세표준이 조문보다 1원 커진다** —
  // 20차 검증이 항등식으로 보인 결함이 이것이다.
  //
  // 두 관계로 값에 세운다.
  //   (가) 과세표준 = 그 앞 단계의 금액 − 종합소득공제. **버림이 여기 한 번뿐이면**
  //        기본공제가 정수이므로 이 뺄셈이 정확히 맞아떨어진다.
  //   (나) 「공제를 먼저 버리고 뺀」 값과의 차이는 **0 또는 1**이다. 그보다 크면 어딘가에서
  //        한 번 더 버렸거나 더 굵은 단위로 버린 것이다.
  //
  // **(나)만으로는 20차의 결함을 잡지 못한다** — 옛 엔진은 언제나 0을 냈다. 차이가 실제로
  // 1이 되는 좌표는 `rounding.test.mjs`가 값으로 못 박는다. 여기서 막는 것은 **그보다 나쁜
  // 것**(절사가 둘 이상이거나 단위가 1원이 아닌 것)이다.
  const taxBaseSource =
    cap.branch_code === 'global_income_amount_supplied'
      ? cap.measured_global_income_krw
      : cap.wage_income_amount_krw;
  assert.equal(Number.isInteger(cap.tax_base_krw), true, `${at} I30: 과세표준이 정수가 아니다`);
  if (taxBaseSource > cap.basic_deduction_krw) {
    assert.equal(
      cap.tax_base_krw,
      taxBaseSource - cap.basic_deduction_krw,
      `${at} I30: 과세표준이 (앞 단계 금액 − 종합소득공제)와 다르다 — 절사가 한 번이 아니다`,
    );
    if (cap.branch_code !== 'global_income_amount_supplied') {
      const flooredFirst =
        cap.measured_total_salary_krw - cap.wage_income_deduction_krw - cap.basic_deduction_krw;
      const gap = flooredFirst - cap.tax_base_krw;
      assert.ok(
        gap === 0 || gap === 1,
        `${at} I30: 「공제를 먼저 버린」 과세표준과의 차이가 ${gap}원이다 — 0이나 1이어야 한다`,
      );
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
    // **잘림 표시와 잘린 금액의 관계는 한쪽 방향이다** (D46 1번 이후).
    //
    // `applied`는 **정확값의 대소**가 정한다 — 룰셋 `tax.rounding.won_fraction`의
    // `comparison` 단계가 「비교 전에 양쪽을 절사하지 않는다」고 정했고, 절사하고 비교하면
    // 1원 미만의 차이가 사라져 판정이 뒤집힌다. 반면 **표시되는 잘린 금액은 표시 금액의
    // 뺄셈**이다. 그래서 **잘린 양이 1원에 못 미치면 `applied`가 참인데 잘린 금액이 0**일
    // 수 있다(총급여 24,795,208 · 예산 2,666,667원이 그런 좌표다 — `tax-liability-cap.test.mjs`).
    //
    // 그 한 방향은 여전히 무조건 참이고, 그것이 화면을 지킨다 — **한 원이라도 줄었으면
    // 반드시 잘린 것이다.** 반대로 자르지 않았으면 줄어든 금액이 없다.
    assert.ok(
      c.reduced_income_tax_krw >= 0,
      `${at} I23: 잘린 금액이 음수다 — 인정액이 자르기 전보다 크다`,
    );
    if (c.reduced_income_tax_krw > 0) {
      assert.equal(c.applied, true, `${at} I23: 금액이 줄었는데 잘림 표시가 없다`);
    }
    if (!c.applied) {
      assert.equal(c.reduced_income_tax_krw, 0, `${at} I23: 자르지 않았는데 금액이 줄었다`);
      assert.equal(c.reduced_total_krw, 0, `${at} I23: 자르지 않았는데 합계가 줄었다`);
    }
    // **자름과 「걸림의 증명」은 대칭이 아니다**(D40). 상한인 분기에서 잘렸을 때만
    // 실제 한도의 자름이 증명된다. 이 등식이 무너지면 화면이 「걸리지 않았습니다」를
    // 적을 근거를 갖게 되고, 그 문장은 이 경로에서 참이 아니다.
    assert.equal(
      c.binding_code,
      c.applied && cap.is_upper_bound ? 'binds_provably' : 'binding_not_determined',
      `${at} I23: 걸림 증명 표시가 자름·오차 방향과 어긋난다`,
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
  const axisFlat = cap.cap_krw === 0;
  assert.equal(
    notes.includes(COMPARISON_NOTE.TAX_CREDIT_AXIS_FLAT),
    axisFlat,
    `${at} I24: 비교 축 상실 안내가 한도 0 여부와 어긋난다`,
  );
  for (const plan of plans) {
    // 이름이 세액공제를 근거로 든 안만 "이 입력에서 내 근거가 아무것도 가르지 못한다"를
    // 신고한다. `isa_first`(인출 가능성)와 `pension_contribution_before_isa`(ISA와의 선후)는
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
      // **D32로 이 효과가 네 안 전부에 붙을 수 있게 됐다.** 예전에는 "공제 한도까지만
      // 채우는 안에는 붙지 않는다"가 검사였는데, 그런 안이 더는 없으므로 그 검사는
      // 공허해졌다. 대신 **효과가 실제 배분 위에 서 있는지**를 본다 — 그 계좌가 받은
      // 금액보다 큰 「공제 없는 납입」은 존재할 수 없다.
      const allocated = plan.allocations.find((a) => a.account === effect.account);
      assert.ok(
        allocated && effect.facts.contribution_without_credit_krw <= allocated.annual_krw,
        `${at} I30: 배분액보다 큰 공제 없는 납입을 주장한다`,
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

  // I33 — **ISA보다 연금 납입을 먼저 채우는 안은 기본안이 되지 않는다.**
  // 소유자가 정한 순서는 ISA가 먼저다(D32). 그 반대 순서를 엔진이 기본으로 올리면
  // 소유자가 정하지 않은 것을 엔진이 고른 것이 된다.
  assert.notEqual(
    plans[0].plan_id,
    PLAN.PENSION_BEFORE_ISA,
    `${at} I33: 소유자가 정한 순서와 반대인 안을 엔진이 기본으로 골랐다`,
  );

  // I34 — **`limited_by`에 계약이 정의하지 않은 값이 나가지 않는다.**
  // D32로 `credit_limit`이 사라졌다 — 어떤 안도 세액공제 대상 한도에서 멈추지 않으므로
  // 그 값은 어느 계좌의 상한도 아니게 됐다. 남겨 두면 **아무 입력에서도 나오지 않는 값**이
  // 계약에 남고, 화면은 결코 실행되지 않는 갈래를 만든다.
  const KNOWN_LIMITED_BY = new Set(Object.values(LIMITED_BY));
  for (const plan of plans) {
    for (const allocation of plan.allocations) {
      if (allocation.limited_by === null) continue;
      assert.ok(
        KNOWN_LIMITED_BY.has(allocation.limited_by),
        `${at} I34: ${plan.plan_id}/${allocation.account}이 계약에 없는 ` +
          `limited_by(${allocation.limited_by})를 보고한다`,
      );
    }
  }

  // I35 — **연금 납입 한도까지 채우는 것이 확정 세액을 한 원도 깎지 않는다.**
  // 조문 산식상 연금 납입 총액을 두 계좌에 어떻게 쪼개든, 퇴직연금이 `합산한도 − 단독한도`
  // 만큼만 받으면 인정액이 최대다. **D32로 이 진술의 대상이 한 안에서 네 안 전부로 넓어졌다** —
  // 기본안도 이제 납입 한도까지 채우므로, 여기서 어긋나면 사용자의 절세액이 실제로 준다.
  //
  // ISA와의 선후는 세액을 바꾸지 못한다(둘 다 올해 공제를 낳지 않는다). 그러므로
  // **네 안의 인정액과 공제액이 전부 같아야 한다.** 다만 예산이 모자라 ISA가 연금 몫을
  // 먼저 가져가는 구간에서는 갈릴 수 있으므로, 연금 쌍의 순서만 다른 안들끼리 본다.
  const beforeIsaPlan = plans.find((p) => p.plan_id === PLAN.PENSION_BEFORE_ISA);
  if (beforeIsaPlan && maxCreditPlan) {
    const pensionOf = (plan) =>
      plan.allocations
        .filter((a) => a.account !== 'isa')
        .reduce((sum, a) => sum + a.annual_krw, 0);
    // 연금에 같은 금액을 넣은 두 안이라면 인정액도 공제액도 같아야 한다.
    if (pensionOf(beforeIsaPlan) === pensionOf(maxCreditPlan)) {
      assert.equal(
        beforeIsaPlan.deterministic_benefit.credit_eligible_contribution_krw,
        maxCreditPlan.deterministic_benefit.credit_eligible_contribution_krw,
        `${at} I35: 같은 연금 납입액인데 인정 납입액이 다르다 — 순서를 잘못 골라 세액을 버렸다`,
      );
      assert.equal(
        beforeIsaPlan.deterministic_benefit.pension_credit_total_krw,
        maxCreditPlan.deterministic_benefit.pension_credit_total_krw,
        `${at} I35: 같은 연금 납입액인데 확정 세액이 다르다 — 그 대가는 0이어야 한다`,
      );
    }
  }

  // I36 — **3단계 몫(공제를 낳지 않는 연금 납입)은 인출이 자유로운 계좌에 먼저 간다.**
  // 그 몫은 어느 계좌에 넣어도 세액이 같으므로 세금이 순서를 정하지 못하고,
  // 남는 축은 인출 가능성뿐이다(D18·계약 0.4절). 대가 없이 더 묶이는 쪽을 고르지 않는다.
  //
  // **D32에서 네 안 전부로 넓혔다.** 예전에는 배분안 하나에만 걸리던 검사인데,
  // 이제 대다수 사용자가 기본안에서 이 몫을 받으므로 기본안이 이 검사 밖에 있으면
  // 관리자가 요구한 "3단계 몫이 인출 자유 계좌에 먼저 간다"가 기계로 고정되지 않는다.
  for (const plan of plans) {
    for (const effect of plan.non_quantified_effects) {
      if (effect.code !== NON_QUANTIFIED.PENSION_WITHOUT_CREDIT) continue;
      if (!eligibleOf(FLEXIBLE_PENSION_ACCOUNT)) continue;
      assert.equal(
        effect.account,
        FLEXIBLE_PENSION_ACCOUNT,
        `${at} I36: ${plan.plan_id}이 공제를 낳지 않는 납입을 대가 없이 더 묶이는 계좌에 넣었다`,
      );
    }
  }

  // I39 — **어떤 배분안의 공제액도 확정 축의 최댓값을 넘지 않는다**(D36).
  // 축은 「합산 인정한도 × 걸릴 수 있는 가장 높은 율」이고 인정액은 그 한도를 넘지 못하므로
  // 산술로 성립한다. **깨지면 화면의 막대가 트랙 밖으로 나간다** — 축을 소득세분으로
  // 만들거나 낮은 공제율로 만든 구현이 정확히 여기서 걸린다(engine-design.md 9.3절).
  const ceiling = scenario.pension_credit_ceiling;
  assert.equal(
    ceiling.ceiling_krw,
    ceiling.income_tax_krw + ceiling.local_tax_krw,
    `${at} I39: 축의 끝이 소득세분과 지방소득세분의 합이 아니다`,
  );
  for (const plan of plans) {
    assert.ok(
      plan.deterministic_benefit.pension_credit_total_before_cap_krw <= ceiling.ceiling_krw,
      `${at} I39: ${plan.plan_id}의 자르기 전 공제액(` +
        `${plan.deterministic_benefit.pension_credit_total_before_cap_krw})이 ` +
        `축의 끝(${ceiling.ceiling_krw})을 넘었다`,
    );
  }

  // I42 — 헤드라인 합계(D38). 배분안마다 성분이 다르므로 안마다 본다.
  for (const plan of plans) checkHeadline(plan, `${at} [${plan.plan_id}]`);

  // I17 — 코드가 계약 목록 안에 있다
  for (const code of noticeCodes) assert.ok(KNOWN_NOTICES.has(code), `${at} I17: 알 수 없는 안내 코드 ${code}`);
  for (const code of notes) {
    assert.ok(KNOWN_COMPARISON_NOTES.has(code), `${at} I17: 알 수 없는 비교 안내 코드 ${code}`);
  }
}

/**
 * I42 — **헤드라인 합계**(D38, `benefit.headline.composite_total`).
 *
 * 여섯 관계를 한 자리에서 본다. **첫 번째가 이 설계 전체를 떠받치는 항등식이다** —
 * 합계 구간의 아래 끝이 확정된 세액공제액과 **같은 수**여야 「최소 ○원」이 조문만으로
 * 정해지는 수가 되고, 확정과 가정의 구분이 부기가 아니라 숫자에 들어간다.
 *
 * **점 분기에서는 그 항등식이 성립하지 않고, 성립해서도 안 된다.** 소득 성격이
 * 확정적이면 규칙이 합계를 한 수로 적으라고 정하므로 아래 끝에 ISA 성분이 들어간다.
 * 그래서 항등식은 **`bound_code`에 따라 갈라 건다** — 갈라 걸지 않으면 어느 한쪽이
 * 거짓이 되어 검사가 통째로 무력해진다.
 */
function checkHeadline(plan, at) {
  const headline = plan.headline_composite_total;
  const credit = plan.deterministic_benefit.pension_credit_total_krw;
  const estimate = plan.assumption_based_isa_estimate;

  assert.ok(headline, `${at} I42: 헤드라인 합계가 없다`);
  assert.equal(headline.determined_component_krw, credit, `${at} I42: 확정 성분이 세액공제액과 다르다`);
  // **합계에는 어느 기간도 붙지 않는다.** 두 성분의 단위 기간이 다르기 때문이다.
  assert.equal(headline.is_annual, false, `${at} I42: 합계가 연간 금액이라고 선언했다`);
  // **합계에 법정 상한이 없다.** ISA 세 축 중 둘에 뚜껑이 없다.
  assert.equal(headline.has_statutory_ceiling, false, `${at} I42: 합계에 상한이 있다고 선언했다`);
  assert.ok(headline.lower_bound_krw <= headline.upper_bound_krw, `${at} I42: 두 끝이 뒤집혔다`);

  if (!headline.includes_assumption_component) {
    // 가정 성분이 없으면 합계는 확정 성분과 같은 한 수다. 이 갈래에서만 확정 등급이다.
    assert.deepStrictEqual(
      [
        headline.lower_bound_krw,
        headline.upper_bound_krw,
        headline.point_estimate_krw,
        headline.bound_code,
        headline.assumption_component_krw,
        headline.assumption_settlement_years,
        headline.assumption_settlement_years_source,
      ],
      [credit, credit, credit, 'point', null, null, null],
      `${at} I42: 가정 성분이 없는데 합계가 확정 세액공제액과 다르다`,
    );
    // 그 갈래의 조건도 함께 문다 — 정산액을 냈고 ISA에 넣은 돈이 있는데 성분이 빠졌다면
    // 사용자가 실제로 받는 혜택 하나가 헤드라인에서 조용히 사라진 것이다.
    const isaAllocated = plan.allocations.find((a) => a.account === 'isa').annual_krw;
    assert.ok(
      estimate === null || estimate.state !== 'computed' || isaAllocated === 0,
      `${at} I42: 정산액을 냈고 ISA 배분도 있는데 합계에 가정 성분이 없다`,
    );
    return;
  }

  assert.equal(estimate.state, 'computed', `${at} I42: 정산액이 없는데 가정 성분이 들어갔다`);
  // **이 안이 ISA에 넣은 돈이 있어야 한다.** 없으면 그 정산액은 이 배분안이 만든 것이
  // 아니므로 「이 배분으로 계산된」이라는 한정 밖이다 — 기존 계좌의 혜택을 이 안의
  // 성과로 적는 셈이 된다. 응답 안쪽만 보면 아무 모순이 없어 이 줄만이 그 자리를 본다.
  assert.ok(
    plan.allocations.find((a) => a.account === 'isa').annual_krw > 0,
    `${at} I42: ISA에 한 푼도 넣지 않은 안의 합계에 가정 성분이 들어갔다`,
  );
  assert.equal(
    headline.assumption_settlement_years,
    estimate.settlement_years,
    `${at} I42: 합계에 실린 기간이 정산 기간과 다르다`,
  );
  assert.equal(
    headline.assumption_settlement_years_source,
    estimate.settlement_years_source,
    `${at} I42: 기간의 출처가 정산액과 다르다`,
  );

  if (headline.bound_code === 'range') {
    // ★ 항등식. 구간의 아래 끝 = 올해 확정된 세액공제액.
    assert.equal(
      headline.lower_bound_krw,
      credit,
      `${at} I42: 구간의 아래 끝이 확정된 세액공제액과 다르다 — 이 항등식이 설계 전체를 떠받친다`,
    );
    assert.equal(headline.point_estimate_krw, null, `${at} I42: 구간인데 점이 있다`);
    assert.equal(estimate.point_estimate_krw, null, `${at} I42: 점이 있는데 구간으로 적었다`);
    assert.equal(headline.assumption_component_krw, estimate.upper_bound_krw, `${at} I42: 위 끝의 성분이 다르다`);
  } else {
    assert.equal(headline.bound_code, 'point', `${at} I42: 모르는 분기 코드 ${headline.bound_code}`);
    assert.equal(headline.point_estimate_krw, headline.lower_bound_krw, `${at} I42: 점과 아래 끝이 다르다`);
    assert.equal(headline.point_estimate_krw, headline.upper_bound_krw, `${at} I42: 점과 위 끝이 다르다`);
    assert.equal(headline.assumption_component_krw, estimate.point_estimate_krw, `${at} I42: 점의 성분이 다르다`);
  }

  // 두 성분의 합이 위 끝이다. **화면이 이 덧셈을 하지 않게 하려고 세 값을 다 낸다.**
  assert.equal(
    headline.upper_bound_krw,
    credit + estimate.upper_bound_krw,
    `${at} I42: 위 끝이 두 성분의 합이 아니다`,
  );
  assert.equal(
    headline.lower_bound_krw,
    credit + estimate.lower_bound_krw,
    `${at} I42: 아래 끝이 두 성분의 합이 아니다`,
  );
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
  assert.ok(
    plansSeen.has(PLAN.PENSION_BEFORE_ISA),
    'ISA보다 연금 납입을 먼저 채우는 안이 행렬에 한 번도 등장하지 않았다',
  );
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
//
// **한도를 어떻게 움직이는가가 D39·D40으로 바뀌었다.** 전에는 요청의 결정세액을 갈아
// 끼웠고 지금은 그런 입력이 없다. 그래서 **총급여액**을 움직인다 — 다만 공제율 구간
// 경계를 넘으면 공제율까지 함께 달라져 이 검사가 뜻을 잃으므로, **한 구간 안에서만**
// 움직인다. 그 제약이 이 검사를 오히려 넓혔다: 이제 "한도가 배분을 바꾸지 않는다"에
// 더해 **"총급여액이 (공제율을 통하지 않고는) 배분을 바꾸지 않는다"**까지 고정한다.
test('I26 — 세액 한도가 배분·한도·순서를 바꾸지 않는다', () => {
  // 넷 다 공제율 우대 구간(총급여 5,500만원 이하) 안이다. 갈리는 것은 한도뿐이고,
  // 셋은 관리자가 조문으로 검산한 좌표다(D40).
  const SALARIES = [
    CAP_COORDINATES.ZERO_EXACT.total_salary_krw,
    CAP_COORDINATES.BINDS.total_salary_krw,
    CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw,
    50_000_000,
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
    // 총급여를 이미 지정한 프로필군은 이 검사의 대상이 아니다 — 여기서 덮어쓰면
    // 같은 것을 두 번 보거나, 더 나쁘게는 그 프로필이 보려던 것을 지운다.
    if (JSON.stringify(patch).includes('current_year_total_salary_krw')) continue;
    if (JSON.stringify(patch).includes('has_non_wage_global_income_current_year')) continue;
    for (const horizon of HORIZONS) {
      const responses = SALARIES.map((salary) =>
        compute(
          baseRequest(
            deepMerge(patch, {
              scenarios: ['current', 'proposed'],
              profile: {
                fund_use_horizon: horizon,
                current_year_total_salary_krw: salary,
                // ISA 유형 교차확인은 직전 연도 값이 정한다. 한도 축과 섞지 않는다.
                prior_year_total_salary_krw: 60_000_000,
              },
            }),
          ),
          rulesets,
        ),
      );

      for (const response of responses) {
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

      // 한도가 실제로 갈렸는가. 갈리지 않았다면 이 좌표에서 이 검사는 아무것도 막지 못한다.
      const caps = responses.map((r) => r.scenarios[0].pension_credit_tax_liability_cap.cap_krw);
      assert.ok(
        new Set(caps).size === SALARIES.length,
        `${label} / ${horizon}: 네 총급여가 서로 다른 한도를 내지 않았다 (${caps.join(', ')})`,
      );

      const first = responses[0].scenarios.map(shape);
      for (let i = 1; i < responses.length; i += 1) {
        assert.deepStrictEqual(
          responses[i].scenarios.map(shape),
          first,
          `${label} / ${horizon}: 한도 ${caps[i]}에서 배분이 달라졌다`,
        );
      }
    }
  }
});

// I27 — **총급여액이 오르면 세액 한도는 내려가지 않는다.**
//
// 이 불변식이 상한 성질의 뼈대다(D40). 한도 = 산출세액 − 근로소득세액공제인데,
// 산출세액은 과세표준에 대해 단조증가하고(`tax.rate.basic.monotonicity`) 잔여
// `x − 근로소득세액공제(x)`도 산출세액에 대해 단조증가한다
// (`credit.wage_income.monotonicity` — 55% 구간에서 기울기 0.45, 30% 구간에서 0.7,
// 제2항 한도가 걸린 뒤 1). **두 성질을 룰셋이 값으로 적어 두었고 여기서 다시 유도하지
// 않는다** — 하는 일은 그 귀결이 엔진에서 실제로 성립하는지 재는 것뿐이다.
//
// **깨지면 무엇이 무너지는가.** 단조가 깨진다는 것은 소득이 늘었는데 한도가 줄어드는
// 좌표가 있다는 뜻이고, 그런 좌표에서는 "이 값은 실제 한도보다 크거나 같다"는 보장이
// 성립할 이유가 없다. 근로소득세액공제를 빼는 4단계가 상한 성질을 깨지 않는다는 것을
// 기계로 확인하는 자리이기도 하다 — 그 단계가 없으면 이 검사는 통과하지만
// 골든 좌표(900,000·1,350,000)가 어긋난다.
test('I27 — 총급여가 오르면 한도가 내려가지 않는다 (상한 성질의 뼈대)', () => {
  const capAt = (salary) =>
    compute(
      baseRequest({
        profile: {
          current_year_total_salary_krw: salary,
          prior_year_total_salary_krw: 60_000_000,
          monthly_capacity_krw: 0,
        },
      }),
      rulesets,
    ).scenarios[0].pension_credit_tax_liability_cap.cap_krw;

  // 구간 경계 언저리를 촘촘히 훑는다. 구간표를 잘못 읽으면 경계에서 값이 튄다.
  const salaries = new Set();
  const brackets = [
    ...findRule(rulesets, CONFIRMED_FILE, 'income.wage.deduction').value.brackets.map(
      (b) => b.total_salary_max_krw,
    ),
    ...findRule(rulesets, CONFIRMED_FILE, 'credit.wage_income').value.limit_brackets.map(
      (b) => b.total_salary_max_krw,
    ),
  ].filter((value) => value !== null && value !== undefined);

  for (const edge of brackets) {
    for (const delta of [-2, -1, 0, 1, 2]) salaries.add(Math.max(0, edge + delta));
  }
  for (let salary = 0; salary <= 60_000_000; salary += 250_000) salaries.add(salary);
  for (const coordinate of Object.values(CAP_COORDINATES)) {
    salaries.add(coordinate.total_salary_krw - 1);
    salaries.add(coordinate.total_salary_krw);
    salaries.add(coordinate.total_salary_krw + 1);
  }

  const sorted = [...salaries].sort((a, b) => a - b);
  let previous = -1;
  let previousSalary = null;
  for (const salary of sorted) {
    const cap = capAt(salary);
    assert.ok(
      cap >= previous,
      `I27: 총급여 ${previousSalary} → ${salary}에서 한도가 ${previous} → ${cap}로 내려갔다`,
    );
    previous = cap;
    previousSalary = salary;
  }

  // 실제로 오르기는 하는가. 전 구간이 0이면 위 검사는 통과하면서 아무것도 막지 못한다.
  assert.ok(previous > 0, 'I27: 훑은 구간에서 한도가 한 번도 오르지 않았다');
});

// I37 — **수익률 가정은 배분·공제액·배분안 순서·경고를 한 글자도 바꾸지 않는다.**
//
// D28이 그은 선 ①(확정 세액공제와 가정 기반 추정치를 한 목적함수에 더하지 않는다)을
// 규약이 아니라 **자료형과 회귀 테스트로** 강제하는 자리다. `echo.isa_return_affects`가
// 네 값을 전부 `false`로 선언하고, 이 검사가 그 선언과 실제 동작을 대조한다.
//
// **D31이 규제 검토 없이 표시를 켜기로 한 뒤 이 선이 전보다 중요해졌다.** 자본시장법
// 쪽 검토가 한 번도 없는 상태에서 남은 방어선이 "이 서비스가 내는 것은 사용자가 제시한
// 수익률을 조문에 넣은 결과이지 권고가 아니다"인데, 수익률이 배분을 움직이는 순간
// 그 문장이 거짓이 된다.
//
// **비교 대상에 「가정을 주지 않은 요청」을 넣은 것이 의도다.** 네 값이 `false`라는 것은
// 값을 바꿔도 안 움직인다는 뜻만이 아니라 **가정을 들이는 것 자체가 안 움직인다**는 뜻이다.
const ISA_RETURN_VARIANTS = [
  { label: '가정 없음', assumption: null, display: null },
  ...ISA_INCOME_CHARACTERS.map((character) => ({
    label: `성격 ${character}`,
    assumption: {
      annual_return_rate: 0.07,
      income_character: character,
      settlement_years: null,
      loss_amount_krw: null,
    },
    display: null,
  })),
  {
    label: '수익률·기간·손실이 전부 다름',
    assumption: {
      annual_return_rate: 0.21,
      income_character: 'interest_dividend',
      settlement_years: 9,
      loss_amount_krw: 3_000_000,
    },
    display: null,
  },
  {
    label: '수익률 0',
    assumption: {
      annual_return_rate: 0,
      income_character: 'interest_dividend',
      settlement_years: 1,
      loss_amount_krw: 0,
    },
    display: null,
  },
  {
    // D31 — 표시를 끈 상태에서도 나머지가 그대로여야 "계산과 입력은 두고 표시만 끈다"가 참이다.
    label: '표시 끔',
    assumption: {
      annual_return_rate: 0.07,
      income_character: 'interest_dividend',
      settlement_years: 3,
      loss_amount_krw: null,
    },
    display: ISA_ESTIMATE_DISPLAY.SUPPRESS,
  },
];

test('I37 — 수익률 가정이 배분·공제액·순서·경고를 바꾸지 않는다', () => {
  // 선언된 네 축을 **그 이름 그대로** 뽑는다. 이름과 실제로 비교하는 것이 어긋나면
  // 이 검사가 통과하면서 아무것도 보증하지 않는 상태가 된다.
  const affected = (response) =>
    response.scenarios.map((scenario) => ({
      allocation_amounts: scenario.plans.map((plan) =>
        plan.allocations.map((a) => [a.account, a.annual_krw, a.monthly_krw, a.fill_order, a.limited_by]),
      ),
      tax_credit_amounts: scenario.plans.map((plan) => plan.deterministic_benefit),
      plan_ordering: scenario.plans.map((plan) => [plan.plan_id, plan.is_baseline]),
      warnings: scenario.plans.map((plan) => plan.warnings),
      // 선언에는 없지만 함께 고정한다 — 한도와 비교 안내가 흔들리면 그것도 목적함수 오염이다.
      limits: scenario.limits,
      comparison_note_codes: scenario.comparison_note_codes,
    }));

  for (const { label, patch } of PROFILES) {
    for (const scenarios of SCENARIO_SETS) {
      const shapes = ISA_RETURN_VARIANTS.map((variant) => {
        const response = compute(
          baseRequest(
            deepMerge(patch, {
              scenarios,
              profile: { isa_return_assumption: variant.assumption },
              options: variant.display === null ? null : { assumption_based_isa_estimate: variant.display },
            }),
          ),
          rulesets,
        );
        assert.equal(response.ok, true, `${label} / ${variant.label}: 계산이 실패했다`);
        assert.deepStrictEqual(
          response.echo.isa_return_affects,
          { allocation_amounts: false, tax_credit_amounts: false, plan_ordering: false, warnings: false },
          `${label} / ${variant.label}: 계약이 선언한 형태가 아니다`,
        );
        return affected(response);
      });

      for (let i = 1; i < shapes.length; i += 1) {
        assert.deepStrictEqual(
          shapes[i],
          shapes[0],
          `${label} / [${scenarios}]: "${ISA_RETURN_VARIANTS[i].label}"에서 배분·공제액·순서·경고가 ` +
            `"${ISA_RETURN_VARIANTS[0].label}"과 달라졌다 — echo.isa_return_affects의 네 false가 거짓이 됐다`,
        );
      }
    }
  }
});

// I38 — **표시를 껐을 때 금액이 하나도 새어 나가지 않는다.**
// D31이 되돌릴 수 있게 하라고 한 구조의 검사다. `state`만 바뀌고 금액이 남아 있으면
// 화면이 그것을 렌더링할 수 있고, 그러면 "표시를 껐다"가 규약일 뿐 사실이 아니게 된다.
test('I38 — 표시를 끄면 가정 기반 금액이 하나도 남지 않는다', () => {
  const assumption = {
    annual_return_rate: 0.07,
    income_character: 'interest_dividend',
    settlement_years: 3,
    loss_amount_krw: null,
  };

  for (const { label, patch } of PROFILES) {
    const response = compute(
      baseRequest(
        deepMerge(patch, {
          scenarios: ['current', 'proposed'],
          profile: { isa_return_assumption: assumption },
          options: { assumption_based_isa_estimate: ISA_ESTIMATE_DISPLAY.SUPPRESS },
        }),
      ),
      rulesets,
    );
    assert.equal(response.ok, true, `${label}: 계산이 실패했다`);

    for (const scenario of response.scenarios) {
      assert.ok(
        scenario.notices.some((n) => n.code === NOTICE.ISA_RETURN_ESTIMATE_SUPPRESSED),
        `${label}: 표시를 껐는데 그 사실이 조용하다 — 미설정 상태는 스스로를 드러내야 한다(D19)`,
      );
      for (const plan of scenario.plans) {
        const estimate = plan.assumption_based_isa_estimate;
        assert.equal(estimate.state, 'display_suppressed', `${label}: 상태가 감춤이 아니다`);
        for (const [key, value] of Object.entries(estimate)) {
          // `axis_ceilings`는 이름이 `_krw`로 끝나지 않지만 **안에 금액을 담는다**(D38).
          // 목록에 넣지 않으면 표시를 껐는데 분모가 그대로 나가는 자리가 된다.
          if (!key.endsWith('_krw') && key !== 'axis_breakdown' && key !== 'axis_ceilings') continue;
          assert.equal(value, null, `${label}: 표시를 껐는데 ${key}에 금액이 남아 있다`);
        }
        // 헤드라인 합계에도 가정 성분이 남으면 안 된다 — 정산액을 감췄는데 그 금액이
        // 합계 안에 섞여 나가면 표시를 껐다는 것이 규약일 뿐 사실이 아니게 된다.
        assert.equal(
          plan.headline_composite_total.includes_assumption_component,
          false,
          `${label}: 표시를 껐는데 합계에 가정 성분이 들어 있다`,
        );
        assert.equal(
          plan.headline_composite_total.upper_bound_krw,
          plan.deterministic_benefit.pension_credit_total_krw,
          `${label}: 표시를 껐는데 합계가 확정 세액공제액보다 크다`,
        );
      }
    }
  }
});

// I42 — **헤드라인 합계**(D38). 본 행렬에는 수익률 가정이 없어 확정 성분 단독 갈래만
// 돌므로, 여기서 성격 세 값과 표시 스위치를 곱해 **네 갈래를 전부** 밟는다.
//
// **갈래가 다 돌았는지를 함께 센다.** 한쪽만 돌면 위 `checkHeadline`은 통과하면서
// 아무것도 막지 못한다 — 이 저장소가 지난 회차에 같은 형태로 0건 실패를 만난 자리다.
test('I42 — 헤드라인 합계가 네 갈래 전부에서 관계를 지킨다', () => {
  const boundsSeen = new Set();
  const componentsSeen = new Set();
  let checked = 0;

  for (const { label, patch } of PROFILES) {
    for (const variant of ISA_RETURN_VARIANTS) {
      const response = compute(
        baseRequest(
          deepMerge(patch, {
            scenarios: ['current', 'proposed'],
            profile: { isa_return_assumption: variant.assumption },
            options: variant.display === null ? null : { assumption_based_isa_estimate: variant.display },
          }),
        ),
        rulesets,
      );
      assert.equal(response.ok, true, `${label} / ${variant.label}: 계산이 실패했다`);

      for (const scenario of response.scenarios) {
        for (const plan of scenario.plans) {
          checkHeadline(plan, `${label} / ${variant.label} / ${scenario.scenario_id} [${plan.plan_id}]`);
          boundsSeen.add(plan.headline_composite_total.bound_code);
          componentsSeen.add(plan.headline_composite_total.includes_assumption_component);
          checked += 1;
        }
      }
    }
  }

  assert.ok(checked >= 100, `행렬이 너무 작다 (${checked}건)`);
  assert.deepStrictEqual([...boundsSeen].sort(), ['point', 'range'], '합계가 점인 좌표와 구간인 좌표가 둘 다 나와야 한다');
  assert.deepStrictEqual([...componentsSeen].sort(), [false, true], '가정 성분이 있는 좌표와 없는 좌표가 둘 다 나와야 한다');
});
