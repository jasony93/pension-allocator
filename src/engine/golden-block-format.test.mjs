// 골든 블록 **형식 자체**의 시험. `golden-block.mjs`가 실제로 무는지를 본다.
//
// **왜 이 파일이 따로 있나.** D22가 넓히라고 한 네 축(`tax_credit_before_cap` ·
// `tax_liability_cap` · `objective_degenerate` · `pension_withdrawal_start`)은 **선택
// 항목**이다. 선택 항목은 두 가지로 죽는다 — (a) 오타가 조용히 무시되거나, (b) 적혔는데
// 대조를 건너뛰거나. 둘 다 "커버리지는 통과하는데 아무것도 보지 않는" 상태를 만들고,
// 이 저장소는 그 형태를 이미 세 번 밟았다. 그래서 **결함 주입을 일회성 확인이 아니라
// 상시 검사로 박아 둔다** — 아래 표의 모든 항목은 값을 하나 비틀면 반드시 실패해야 한다.
//
// **여기 적힌 값의 출처.** 정답지의 값은 `tax-domain`이 채운다. 이 파일은 형식이 도는
// 것만 보이면 되므로 **`tax-liability-cap.test.mjs`가 이미 고정해 둔 입력과 값**을
// 그대로 쓴다. 엔진을 돌려 나온 값을 옮겨 오지 않으며, 금액·연수는 룰셋에서 읽는다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute } from './index.mjs';
import {
  buildRequest,
  checkCase,
  validateBlock,
} from './golden-block.mjs';
import { uncertaintyNotesIn } from './ruleset.mjs';
import {
  CAP_COORDINATES,
  CONFIRMED_FILE,
  baseRequest,
  deepMerge,
  findRule,
  loadRulesets,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const confirmedRule = (id) => findRule(rulesets, CONFIRMED_FILE, id);

/**
 * 전환 특례 규칙의 **이름**과 그 규칙이 값으로 적어 둔 조건 둘(D55 후속).
 * **여기서도 룰셋에서 읽는다** — 참·거짓을 이 파일에 적으면 두 번째 진실 원천이 된다.
 */
const CARRYOVER_RULE = 'pension.credit.unused.contribution_carryover';
const CARRYOVER = confirmedRule(CARRYOVER_RULE).value;
const CARRYOVER_SHARES_LIMIT = CARRYOVER.subject_to_conversion_year_credit_limits.value;
const CARRYOVER_REQUIRES_APPLICATION = !CARRYOVER.automatic;
/** 한도 산출이 읽는 규칙 하나. 근거 목록에 **반드시 실려 있는** 이름이 필요해서 쓴다. */
const ROUNDING_RULE = 'tax.rounding.won_fraction';

// 룰셋에서 읽는다. 세법 수치를 이 파일에 적으면 두 번째 진실 원천이 된다.
const CREDIT_RATE = confirmedRule('pension.credit.rate').value.brackets.find(
  (b) => b.total_salary_only_max_krw !== null,
).rate;
const SURTAX_RATE = confirmedRule('tax.local.personal_income_surtax').value.rate_of_income_tax;
const COMBINED_LIMIT = confirmedRule('pension.credit.limit.combined').value.amount_krw;
const ANNUITY_LIMIT = confirmedRule('pension.credit.limit.annuity_savings').value.amount_krw;
const PENSION_REQUIREMENTS = confirmedRule('pension.withdrawal.eligibility').value.requirements;
const MIN_AGE = PENSION_REQUIREMENTS.find((r) => r.id === 'age').min_age;
const HOLDING_YEARS = PENSION_REQUIREMENTS.find((r) => r.id === 'holding_period').min_years;

/**
 * **한도를 총급여액으로 고른다**(D39·D40). 세 값 다 공제율 우대 구간(총급여 5,500만원
 * 이하) 안이므로 공제율은 같고 한도만 달라진다 — 이 파일이 한도 축 하나만 움직이려면
 * 그래야 한다. 세 값의 출처는 관리자가 조문으로 검산한 좌표다(D40).
 */
const SALARY = {
  /** 한도가 세액공제를 자르는 좌표. 이 총급여의 추정 한도는 정확히 900,000원이다. */
  CAP_BINDS: CAP_COORDINATES.BINDS.total_salary_krw,
  /** 과세표준이 정확히 0이 되는 좌표. 한도가 0이고 그 0은 추정이 아니라 등식이다. */
  CAP_ZERO: CAP_COORDINATES.ZERO_EXACT.total_salary_krw,
};

/** 한도가 이 룰셋의 최대 세액공제액보다 커서 아무것도 자르지 않는 좌표(기본 요청). */
const LOW_SALARY = 50_000_000;

const withSalary = (salary, patch = {}) =>
  baseRequest(
    deepMerge(
      {
        profile: {
          current_year_total_salary_krw: salary,
          prior_year_total_salary_krw: 60_000_000,
        },
      },
      patch,
    ),
  );

/**
 * `GC-90` 좌표에서 **실제로 공제를 낳는** 납입액의 소득세분(`12.0.0`, D52 1번).
 *
 * 그 좌표의 한도가 연금저축 자기 한도의 공제액보다 작으므로 IRP는 한 원도 배분되지
 * 않는다. 따라서 자르기 **전** 금액도 합산 한도가 아니라 **연금저축 한도**에서 나온다.
 * 수는 전부 룰셋에서 온다.
 */
const BEFORE_CAP = Math.floor(ANNUITY_LIMIT * CREDIT_RATE);

const surtaxOf = (incomeTax) => Math.floor(incomeTax * SURTAX_RATE);
const creditOf = (incomeTax) => ({
  income_tax: incomeTax,
  local_tax: surtaxOf(incomeTax),
  total: incomeTax + surtaxOf(incomeTax),
});

// ── 블록 넷. 넓힌 어휘를 하나도 빠짐없이 쓴다 ────────────────────────────────

/**
 * 자르기 전후가 갈리는 블록. 예산을 합산 한도까지 채운 뒤 그보다 낮은 한도를 준다 —
 * `tax-liability-cap.test.mjs`의 「자르기 전 금액과 자른 뒤 금액을 둘 다 낸다」와 같은 입력이다.
 */
const CAP_APPLIED = (() => {
  const uncapped = Math.floor(COMBINED_LIMIT * CREDIT_RATE);
  const capKrw = CAP_COORDINATES.BINDS.cap_krw;
  return {
    case: 'GC-90',
    request: withSalary(SALARY.CAP_BINDS, { profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 } }),
    expect: {
      current: {
        // D36 — 확정 축의 최댓값. **한도가 이 상한을 무는 좌표**라 관계 코드까지 함께 진다.
        // **이 축은 배분이 아니라 한도에서 나오므로 D52 1번이 움직이지 않는다.**
        pension_credit_ceiling: {
          ceiling_krw: uncapped + surtaxOf(uncapped),
          income_tax_krw: uncapped,
          local_tax_krw: surtaxOf(uncapped),
          credit_limit_krw: COMBINED_LIMIT,
          rate_source_code: 'credit_rate_bracket',
          tax_liability_cap_relation_code: 'cap_below_ceiling',
          fallback_applied: false,
          is_axis_degenerate: false,
        },
        plans: {
          max_tax_credit: {
            // 동점 구간이므로 인출이 자유로운 연금저축이 자기 한도까지 먼저 찬다.
            //
            // **`12.0.0`에서 IRP가 0이 됐다**(D52 1번). 이 좌표의 한도(899,999)는 연금저축
            // 자기 한도의 공제액(900,000)보다 **작다.** 그러므로 그 위에 IRP를 채워도
            // 세액공제가 한 원도 늘지 않고 중도인출 제한만 진다. 예산은 ISA로 간다.
            //
            // **한도가 여전히 문다** — 자르는 것은 IRP가 아니라 연금저축의 공제액이고
            // 그 1원의 자름이 `applied`를 참으로 만든다. 그것이 이 블록이 재려던 것이다.
            allocation: {
              annuity_savings: ANNUITY_LIMIT,
              retirement_pension: 0,
              isa: COMBINED_LIMIT - ANNUITY_LIMIT,
            },
            tax_credit: creditOf(capKrw),
            tax_credit_before_cap: creditOf(BEFORE_CAP),
            tax_liability_cap: {
              cap_krw: capKrw,
              applied: true,
              // 추정 한도가 상한이므로 이 자름은 실제 한도의 자름을 **증명한다**(D40).
              binding_code: 'binds_provably',
              threshold_income_tax_krw: BEFORE_CAP,
              // ── 이월 판정에 딸린 연쇄 (D55 후속) ──
              // 이 좌표는 표시 금액이 실제로 줄어드는 자리라 **이월 판정이 참**이고,
              // 그러면 조건 둘이 값을 갖고 전환 특례 규칙이 근거 목록에 실린다.
              // **넷을 함께 적어야 「`applied`를 따라갔는가」가 값으로 갈린다.**
              carryover_shares_future_year_credit_limit: CARRYOVER_SHARES_LIMIT,
              carryover_requires_application: CARRYOVER_REQUIRES_APPLICATION,
              basis_rule_ids: [CARRYOVER_RULE],
            },
            warning_count: 0,
          },
        },
      },
    },
  };
})();

/** 한도가 0인 블록. 목적함수가 무너진 사실이 배분안 단위로 나간다(계약 5.12절). */
const CAP_ZERO = {
  case: 'GC-91',
  // 예산을 연금저축 자기 한도에 맞춰 둔다 — 그러면 배분이 룰셋 값 하나로 정해져
  // 한도가 바뀌어도 이 블록이 뜻을 잃지 않는다.
  request: withSalary(SALARY.CAP_ZERO, { profile: { monthly_capacity_krw: ANNUITY_LIMIT / 12 } }),
  expect: {
    current: {
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: ANNUITY_LIMIT, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(0),
          tax_liability_cap: { cap_krw: 0, applied: true, binding_code: 'binds_provably' },
          // 이름이 내세운 근거가 이 입력에서 아무것도 가르지 못한다.
          objective_degenerate: true,
          warning_count: 0,
        },
        isa_first: {
          allocation: { annuity_savings: 0, retirement_pension: 0, isa: ANNUITY_LIMIT },
          tax_credit: creditOf(0),
          // 인출 가능성을 근거로 든 안이라 한도가 0이어도 이름이 거짓말하지 않는다.
          objective_degenerate: false,
          warning_count: 0,
        },
      },
    },
  },
};

/** 개시 가능 시점이 나이가 아니라 5년 요건으로 정해지는 블록. */
const START_DATES = {
  case: 'GC-92',
  request: baseRequest({
    // 만 54세. 나이 요건은 곧 충족되지만 계좌를 올해 열면 5년이 새로 시작된다.
    profile: { birth_date: '1972-06-15', monthly_capacity_krw: ANNUITY_LIMIT / 12 },
    accounts: {
      retirement_pension: { opened_on: '2026-01-10' },
      annuity_savings: { opened_on: '2000-01-10' },
    },
  }),
  expect: {
    current: {
      pension_withdrawal_start: {
        retirement_pension: {
          computable: true,
          age_requirement_date: `${1972 + MIN_AGE}-06-15`,
          holding_requirement_date: `${2026 + HOLDING_YEARS}-01-10`,
          earliest_start_date: `${2026 + HOLDING_YEARS}-01-10`,
          holding_requirement_waived: false,
          bound_by_holding_period: true,
        },
        annuity_savings: {
          earliest_start_date: `${1972 + MIN_AGE}-06-15`,
          bound_by_holding_period: false,
        },
      },
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: ANNUITY_LIMIT, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(Math.floor(ANNUITY_LIMIT * CREDIT_RATE)),
          warning_count: 0,
        },
      },
    },
  },
};

/** 가입일을 모르는 블록. 시점을 추정하지 않는다는 사실이 값으로 나간다. */
const START_UNKNOWN = {
  case: 'GC-93',
  request: baseRequest({ profile: { monthly_capacity_krw: ANNUITY_LIMIT / 12 } }),
  expect: {
    current: {
      pension_withdrawal_start: {
        retirement_pension: {
          computable: false,
          earliest_start_date: null,
          years_until_earliest_start: null,
          reason_code: 'opened_on_missing',
        },
      },
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: ANNUITY_LIMIT, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(Math.floor(ANNUITY_LIMIT * CREDIT_RATE)),
          // 한 항목만 적는다 — 나머지 없이 `binding_code` 하나만 적어도 대조가 도는지를
          // 이 자리에서 본다(선택 항목의 부분 기재). 이 좌표는 한도가 자르지 않으므로
          // **걸리는지가 증명되지 않는다** — 「걸리지 않는다」가 아니다(D40).
          tax_liability_cap: { binding_code: 'binding_not_determined' },
          warning_count: 0,
        },
      },
    },
  },
};

// ── 8차에 넓힌 어휘 셋 (D30·D28) ─────────────────────────────────────────────
//
// 값은 전부 **룰셋과 계약**에서 나온다. 엔진을 돌려 나온 값을 옮겨 오면 이 파일이
// "엔진이 자기 답을 자기에게 되묻는" 자리가 된다.

const AGE_RULE = confirmedRule('age.reckoning.reference_date');
const AGE_UNCERTAINTY = uncertaintyNotesIn(AGE_RULE.value);
/** 계약 4.2절이 이 규칙의 근거가 어느 출력에 붙는지를 정한다 — 엔진의 답이 아니다. */
const AGE_APPLIED_TO = ['echo.derived_age.reference_date'];

/** 규칙별 근거·미확인 건수(D30). 계약 5.7.1절이 첫 번째 방어선으로 지목한 축이다. */
const LEGAL_BASIS = {
  case: 'GC-94',
  request: baseRequest({ profile: { monthly_capacity_krw: ANNUITY_LIMIT / 12 } }),
  // 총급여만으로 판정한 축. 25% 과대였던 그 자리를 정답지가 직접 주장한다.
  credit_rate: {
    income_tax: CREDIT_RATE,
    basis: 'total_salary',
    measured_amount: LOW_SALARY,
    fallback_applied: false,
    fallback_direction: null,
  },
  expect: {
    current: {
      legal_basis: {
        'age.reckoning.reference_date': {
          present: true,
          status: AGE_RULE.status,
          bill_stage: null,
          has_uncertainty_note: AGE_UNCERTAINTY.length > 0,
          uncertainty_note_count: AGE_UNCERTAINTY.length,
          uncertainty_kinds: [...new Set(AGE_UNCERTAINTY.map((note) => note.kind))].sort(),
          uncertainty_paths: AGE_UNCERTAINTY.map((note) => note.path),
          applied_to: AGE_APPLIED_TO,
        },
        // 요청에 전환이 없으므로 전환 특례 규칙은 근거에 실리지 않는다.
        // **없다는 것도 주장이다** — 읽지 않은 규칙을 근거로 싣지 않는다는 규약이 그 자리다.
        'pension.credit.isa_transfer.extra_limit': { present: false },
      },
      // 확정 시나리오에는 반영하지 않은 개정예고 규칙이 없다. **비어 있다는 것도 사실이므로
      // 주장할 수 있어야 한다** — 표시를 가진 개정예고 규칙 둘이 근거가 아니라 이 배열로
      // 나가기 때문에 열어 둔 자리다(D32 후속).
      unapplied_proposed_rules: {
        'proposed.productive_isa.youth_income_deduction': { present: false },
      },
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: ANNUITY_LIMIT, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(Math.floor(ANNUITY_LIMIT * CREDIT_RATE)),
          warning_count: 0,
        },
      },
    },
  },
};

/** 종합소득금액을 몰라 본문 구간으로 간 경우. `fallback_*` 세 칸이 서로를 규정한다. */
const CREDIT_RATE_FALLBACK = {
  case: 'GC-95',
  request: baseRequest({
    profile: {
      monthly_capacity_krw: 0,
      has_non_wage_global_income_current_year: true,
      current_year_global_income_krw: null,
    },
  }),
  credit_rate: {
    basis: 'statutory_default',
    // 재지 않은 금액을 되돌려주지 않는다.
    measured_amount: null,
    fallback_applied: true,
    // 우대 구간을 적용하지 않은 것이므로 과소이거나 같다. 세액 한도의 "최대"와 방향이 반대다.
    fallback_direction: 'understated_or_equal',
  },
  expect: {
    current: {
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: 0, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(0),
          warning_count: 0,
        },
      },
    },
  },
};

// ── 가정 기반 ISA 정산액 (D28·D29·D31) ──
//
// 원금·수익률·기간을 골라 **총수익이 비과세 한도금액과 정확히 같아지게** 둔다. 그러면
// 기대값이 룰셋 값 하나에서 나오고 한도가 바뀌어도 이 블록이 뜻을 잃지 않는다.

const GENERAL_RATE = confirmedRule('isa.benefit.quantification').value.statable_amounts.find(
  (item) => item.id === 'rate_gap',
).income_tax.general;
const TAX_FREE_LIMIT = confirmedRule('isa.tax_free_limit').value.brackets.find(
  (b) => (b.prev_total_salary_max_krw ?? null) === null && (b.prev_global_income_max_krw ?? null) === null,
).limit_krw;
const MIN_CONTRACT_YEARS = confirmedRule('isa.account.requirements').value.min_contract_years;

/** 소득세 + 지방세. 엔진이 다른 곳에서 쓰는 두 단계와 같다. */
const withSurtax = (amount, rate) => {
  const incomeTax = Math.floor(amount * rate);
  return incomeTax + Math.floor(incomeTax * SURTAX_RATE);
};

const ISA_YEARS = 2;
const ISA_RETURN_RATE = 0.05;
/** 이 원금·수익률·기간이면 총수익이 정확히 비과세 한도금액이 된다. */
const ISA_PRINCIPAL = TAX_FREE_LIMIT / (ISA_RETURN_RATE * ISA_YEARS);
const ISA_SETTLEMENT = withSurtax(TAX_FREE_LIMIT, GENERAL_RATE);

const isaReturnRequest = (character, extra = {}) =>
  baseRequest({
    profile: {
      monthly_capacity_krw: 0,
      isa_return_assumption: {
        annual_return_rate: ISA_RETURN_RATE,
        income_character: character,
        settlement_years: ISA_YEARS,
        loss_amount_krw: null,
        ...extra,
      },
    },
    accounts: { isa: { cumulative_contribution_krw: ISA_PRINCIPAL, years_since_opening: 5 } },
  });

/** 소득 성격이 확정적일 때 — 점 하나가 나오고 구간의 두 끝이 그 점과 같다. */
const ISA_POINT = {
  case: 'GC-96',
  request: isaReturnRequest('interest_dividend'),
  expect: {
    current: {
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: 0, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(0),
          warning_count: 0,
          assumption_based_isa_estimate: {
            state: 'computed',
            not_computable_reason_code: null,
            // **1년치가 아니다.** 연 환산은 비과세 한도를 해마다 새로 주는 계산이 된다.
            is_annual: false,
            settlement_years: ISA_YEARS,
            settlement_years_source: 'user',
            taxable_share_min: 1,
            taxable_share_max: 1,
            principal_krw: ISA_PRINCIPAL,
            total_return_krw: TAX_FREE_LIMIT,
            taxable_income_krw: TAX_FREE_LIMIT,
            loss_offset_applied_krw: 0,
            net_income_krw: TAX_FREE_LIMIT,
            tax_free_limit_krw: TAX_FREE_LIMIT,
            comparison_side_tax_krw: ISA_SETTLEMENT,
            isa_side_tax_krw: 0,
            point_estimate_krw: ISA_SETTLEMENT,
            lower_bound_krw: ISA_SETTLEMENT,
            upper_bound_krw: ISA_SETTLEMENT,
            axis_breakdown: {
              loss_offset_krw: 0,
              tax_free_krw: ISA_SETTLEMENT,
              rate_gap_krw: 0,
              rounding_residual_krw: 0,
            },
            comparison_baseline_code: 'withholding_at_general_rate',
            // **비과세 축의 상한**(D38 6번). 이 블록은 총수익이 정확히 비과세 한도금액이라
            // 축의 값과 상한이 같아진다 — 그래서 **기간 칸이 빠지면 아무 금액도 틀리지 않는다.**
            // 그 자리를 정답지가 주장할 수 있어야 「기간 없이 최댓값만 적는」 회귀가 걸린다.
            axis_ceilings: {
              tax_free_krw: ISA_SETTLEMENT,
              tax_free_period_code: 'contract_settlement_period',
              tax_free_settlement_years: ISA_YEARS,
              tax_free_is_lower_bound: true,
              // **없다는 것이 조문의 판정이다.** 유무가 값으로 나가고 금액 칸은 없다.
              rate_gap_has_ceiling: false,
              loss_offset_has_ceiling: false,
            },
            // 계약이 상수로 고정한 넷. **상수라서 오히려 주장되어야 한다** —
            // 아무도 안 보면 조용히 달라지고, 달라져도 어떤 금액도 틀리지 않는다.
            principal_basis_code: 'cumulative_contribution_plus_plan_allocation',
            return_accrual_code: 'simple_interest',
            is_lower_bound_for_aggregate_taxpayer: true,
            assumes_contract_held_to_settlement: true,
          },
          // **헤드라인 합계**(D38). 이 블록은 납입 여력이 0이라 ISA 배분도 0이므로
          // 정산액이 계산돼 있어도 합계에 들어가지 않는다 — 그 혜택은 이 배분안이 만든
          // 것이 아니다. **합계가 확정 성분과 같은 한 수인 갈래**가 이 자리다.
          headline_composite_total: {
            lower_bound_krw: 0,
            upper_bound_krw: 0,
            point_estimate_krw: 0,
            bound_code: 'point',
            includes_assumption_component: false,
            determined_component_krw: 0,
            assumption_component_krw: null,
            assumption_settlement_years: null,
            assumption_settlement_years_source: null,
          },
        },
      },
    },
  },
};

/**
 * 성격을 밝히지 않았을 때 — **점이 아니라 구간**이다. 구간의 두 끝은 조문에서 나오므로
 * 추정이 아니고, 구간 안의 한 점을 고르는 것만이 추정이다(D31).
 * 정산 기간도 주지 않아 룰셋의 계약기간 하한이 대체값으로 들어간다.
 */
const ISA_RANGE = {
  case: 'GC-97',
  request: isaReturnRequest('mixed_or_unknown', { settlement_years: null }),
  expect: {
    current: {
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: 0, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(0),
          warning_count: 0,
          assumption_based_isa_estimate: {
            state: 'computed',
            settlement_years: MIN_CONTRACT_YEARS,
            settlement_years_source: 'ruleset_min_contract_years',
            taxable_share_min: 0,
            taxable_share_max: 1,
            // 점을 낼 근거가 조문에 없다.
            point_estimate_krw: null,
            lower_bound_krw: 0,
          },
        },
      },
    },
  },
};

// ── 공제를 낳지 않는 연금 납입의 사실들 (D26·D32 후속) ──
//
// **여기 적은 값의 출처를 하나씩 밝힌다.** 이 블록은 형식이 도는 것만 보이면 되므로
// 엔진을 돌려 나온 값을 옮겨 오지 않는다.
//   · 금액 둘 — 룰셋에서 읽는다(`납입 한도 − 합산 공제한도`가 공제를 낳지 않는 몫이다).
//   · 사실 넷 — **`pension-contribution-fill.test.mjs`가 이미 고정해 둔 값**이다.
//     그 파일이 같은 넷을 응답에서 직접 확인하고 있고, 값의 출처는 룰셋이다.
//   · 사유 코드 — 계약 5.6절이 열거한 둘 중 하나다.

const PENSION_CONTRIBUTION_LIMIT = confirmedRule('pension.contribution.annual_limit').value.amount_krw;
/** 연금 납입 한도까지 채웠을 때 **공제를 낳지 않는** 몫. 두 한도의 차이다. */
const WITHOUT_CREDIT = PENSION_CONTRIBUTION_LIMIT - COMBINED_LIMIT;
const MONTHS = 12;

/**
 * 예산을 연금 납입 한도에 딱 맞추고 ISA 자격을 막는다. 그러면 배분이 룰셋 값 셋으로
 * 정해지고, 인출이 자유로운 연금저축이 3단계 몫을 전부 받는다 — **IRP에는 이 효과가
 * 붙지 않는다는 것도 이 블록의 주장이다.**
 */
const WITHOUT_CREDIT_FACTS = {
  case: 'GC-98',
  request: baseRequest({
    profile: {
      monthly_capacity_krw: PENSION_CONTRIBUTION_LIMIT / MONTHS,
      months_remaining_in_tax_year: MONTHS,
      financial_income_taxpayer_last_3_years: true,
    },
  }),
  expect: {
    current: {
      isa_eligible: false,
      plans: {
        max_tax_credit: {
          allocation: {
            annuity_savings: ANNUITY_LIMIT + WITHOUT_CREDIT,
            retirement_pension: COMBINED_LIMIT - ANNUITY_LIMIT,
            isa: 0,
          },
          tax_credit: creditOf(Math.floor(COMBINED_LIMIT * CREDIT_RATE)),
          warning_count: 0,
          non_quantified_codes: ['pension_contribution_without_credit'],
          non_quantified_effects: {
            pension_contribution_without_credit: {
              annuity_savings: {
                present: true,
                // 세법이 유불리를 정하지 않는다는 사실. 「과세이연으로 ○○원 이득」을
                // 대신 쓰지 못하게 하는 자리다(계약 5.6절 「쓰면 안 되는 문장」).
                reason_code: 'benefit_depends_on_return_horizon_and_withdrawal_form_not_in_ruleset',
                facts: {
                  credit_this_year_krw: 0,
                  contribution_without_credit_krw: WITHOUT_CREDIT,
                  // 넷이 함께 나가야 화면 문장이 참이 된다(계약 5.6절).
                  principal_taxed_on_withdrawal: false,
                  principal_tax_free_requires_confirmation: true,
                  principal_tax_free_confirmation_prospective_only: true,
                  returns_taxed_on_withdrawal: true,
                },
              },
              // 이 안에서 IRP는 공제 한도 안쪽에서 멈춘다. **붙지 않는다는 것도 주장이다.**
              retirement_pension: { present: false },
            },
          },
        },
      },
    },
  },
};

const BLOCKS = [
  CAP_APPLIED,
  CAP_ZERO,
  START_DATES,
  START_UNKNOWN,
  LEGAL_BASIS,
  CREDIT_RATE_FALLBACK,
  ISA_POINT,
  ISA_RANGE,
  WITHOUT_CREDIT_FACTS,
];

const runBlock = (block) => checkCase(block, compute(buildRequest(block), rulesets));

// ── 1. 기준선 — 넓힌 어휘가 실제 응답과 맞는다 ───────────────────────────────

for (const block of BLOCKS) {
  test(`형식 시험 블록 ${block.case}이 형식에 맞고 대조를 통과한다`, () => {
    assert.deepStrictEqual(validateBlock(block, block.case), []);
    runBlock(block);
  });
}

// ── 2. 결함 주입 — 값을 하나 비틀면 반드시 실패한다 ──────────────────────────
//
// 이 표가 이 파일의 알맹이다. **선택 항목이 조용히 건너뛰어지면 여기서 걸린다.**
// 각 행은 "이 항목의 값을 바꾸면 그 항목의 이름이 실패 메시지에 나온다"를 주장한다.

const setPath = (block, path, value) => {
  const copy = structuredClone(block);
  let node = copy;
  for (const key of path.slice(0, -1)) node = node[key];
  node[path.at(-1)] = value;
  return copy;
};

const P = (planId, ...rest) => ['expect', 'current', 'plans', planId, ...rest];
/** 확정 축의 최댓값(D36). 시나리오 단위이므로 배분안을 지나지 않는다. */
const CEIL = (key) => ['expect', 'current', 'pension_credit_ceiling', key];
const S = (account, key) => ['expect', 'current', 'pension_withdrawal_start', account, key];
const L = (ruleId, key) => ['expect', 'current', 'legal_basis', ruleId, key];
const CR = (key) => ['credit_rate', key];
const E = (...rest) => P('max_tax_credit', 'assumption_based_isa_estimate', ...rest);
/** 비정량 효과 — 코드 × 계좌 두 겹을 지나 항목까지. */
const NQ = (account, ...rest) =>
  P('max_tax_credit', 'non_quantified_effects', 'pension_contribution_without_credit', account, ...rest);
const NQF = (key) => NQ('annuity_savings', 'facts', key);
/** 헤드라인 합계(D38)와 축의 상한. 배분안 단위다. */
const H = (key) => P('max_tax_credit', 'headline_composite_total', key);
const AC = (key) => E('axis_ceilings', key);

/**
 * 잡히는 층을 행마다 밝힌다.
 *  - `compare` — 형식은 통과하고 **대조**가 문다. 선택 항목이 조용히 건너뛰어지면 여기서 걸린다.
 *  - `format` — 값끼리 어긋나 **형식**이 먼저 문다. 두 값을 옮겨 적다 하나만 고친 경우다.
 */
const INJECTIONS = [
  // ── 자르기 전 금액 ──
  // 소득세분을 1원 올리면 지방세·합계까지 따라 움직여야 형식을 통과한다. 그 상태로도 대조가 문다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_credit_before_cap(전체)', path: P('max_tax_credit', 'tax_credit_before_cap'), value: creditOf(BEFORE_CAP + 1), mentions: ['GC-90', 'current', 'max_tax_credit', '자르기 전'] },
  // 소득세분은 그대로 두고 지방세분만 어긋나게 한다 — 지방세분을 따로 보는지 확인한다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_credit_before_cap.local_tax', path: P('max_tax_credit', 'tax_credit_before_cap'), value: { income_tax: BEFORE_CAP, local_tax: surtaxOf(BEFORE_CAP) + 1, total: BEFORE_CAP + surtaxOf(BEFORE_CAP) + 1 }, mentions: ['GC-90', 'max_tax_credit', '자르기 전'] },
  // 합계만 1원 틀리면 대조까지 가기 전에 형식이 문다(소득세 + 지방세 = 합계).
  { via: 'format', block: CAP_APPLIED, name: 'tax_credit_before_cap.total 단독', path: P('max_tax_credit', 'tax_credit_before_cap', 'total'), value: BEFORE_CAP + surtaxOf(BEFORE_CAP) + 1, token: '옮겨 적으면서 어긋났다' },

  // ── 확정 축의 최댓값 여덟 항목 (D36) ──
  // **이 층이 없으면 GC-63·GC-64가 적은 축의 끝이 조용히 건너뛰어진다.** 결함 주입으로
  // 확인한 자리다 — 대조 루프를 지우면 골든 케이스가 그대로 통과했다.
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.ceiling_krw', path: CEIL('ceiling_krw'), value: 1, mentions: ['GC-90', 'current', '확정 축', 'ceiling_krw'] },
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.income_tax_krw', path: CEIL('income_tax_krw'), value: 1, mentions: ['GC-90', '확정 축', 'income_tax_krw'] },
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.local_tax_krw', path: CEIL('local_tax_krw'), value: 1, mentions: ['GC-90', '확정 축', 'local_tax_krw'] },
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.credit_limit_krw', path: CEIL('credit_limit_krw'), value: 1, mentions: ['GC-90', '확정 축', 'credit_limit_krw'] },
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.rate_source_code', path: CEIL('rate_source_code'), value: 'proposed_youth_irp_rate', mentions: ['GC-90', '확정 축', 'rate_source_code'] },
  // **한도가 무는 좌표에서 관계 코드를 뒤집는다.** 축을 한도로 자르는 구현이면 여기가 갈린다.
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.tax_liability_cap_relation_code', path: CEIL('tax_liability_cap_relation_code'), value: 'cap_at_or_above_ceiling', mentions: ['GC-90', '확정 축', 'tax_liability_cap_relation_code'] },
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.fallback_applied', path: CEIL('fallback_applied'), value: true, mentions: ['GC-90', '확정 축', 'fallback_applied'] },
  { via: 'compare', block: CAP_APPLIED, name: 'pension_credit_ceiling.is_axis_degenerate', path: CEIL('is_axis_degenerate'), value: true, mentions: ['GC-90', '확정 축', 'is_axis_degenerate'] },

  // ── 배분안 단위 세액 한도 네 항목 ──
  { via: 'compare', block: START_UNKNOWN, name: 'tax_liability_cap.binding_code', path: P('max_tax_credit', 'tax_liability_cap', 'binding_code'), value: 'binds_provably', mentions: ['GC-93', 'max_tax_credit', 'binding_code'] },
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.cap_krw', path: P('max_tax_credit', 'tax_liability_cap', 'cap_krw'), value: 1, mentions: ['GC-90', 'max_tax_credit', 'cap_krw'] },
  // 두 칸을 **함께** 뒤집는다. 하나만 뒤집으면 형식 검사가 먼저 물어 대조 층을 시험하지
  // 못한다 — 그 형식 검사 자체는 바로 아래에서 따로 시험한다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.applied', path: P('max_tax_credit', 'tax_liability_cap'), value: { applied: false, binding_code: 'binding_not_determined' }, mentions: ['GC-90', 'applied'] },
  // **오차 방향을 뒤집는 주입**(D40). 한도가 실제로 자른 좌표에서 블록이 「걸리는지
  // 증명되지 않았다」고 적으면 대조가 물어야 한다 — 이 자리가 통과해 버리면 화면이
  // 상한과 확정값을 같은 말로 부르기 시작한다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.binding_code (증명→미정)', path: P('max_tax_credit', 'tax_liability_cap', 'binding_code'), value: 'binding_not_determined', mentions: ['GC-90', 'binding_code'] },
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.threshold_income_tax_krw', path: P('max_tax_credit', 'tax_liability_cap', 'threshold_income_tax_krw'), value: 1, mentions: ['GC-90', 'threshold_income_tax_krw'] },
  // 한도가 0인 쪽에서도 같은 항목이 문다 — `0`과 `null`을 섞지 않는지 함께 본다.
  { via: 'compare', block: CAP_ZERO, name: 'tax_liability_cap.cap_krw (한도 0)', path: P('max_tax_credit', 'tax_liability_cap', 'cap_krw'), value: 1, mentions: ['GC-91', 'cap_krw'] },
  // **형식 자체가 방향을 무는 자리.** 자르지 않았는데 걸림이 증명된다고 적는 블록은
  // 대조 이전에 형식에서 걸린다 — 옮겨 적다 방향이 뒤집히는 것이 가장 흔한 사고다.
  { via: 'format', block: CAP_APPLIED, name: 'applied:false + binds_provably', path: P('max_tax_credit', 'tax_liability_cap'), value: { applied: false, binding_code: 'binds_provably' }, token: '한도가 걸린다는 것을 증명하지 못한다' },
  { via: 'format', block: CAP_APPLIED, name: 'binding_code에 없는 값', path: P('max_tax_credit', 'tax_liability_cap'), value: { binding_code: 'cap_has_headroom' }, token: '계약 8.7절의 두 값이 아니다' },
  // ── 이월 판정의 자 (`14.0.0` · D54) ──
  // **`applied`와 다른 자를 쓰는 칸이라 따로 물어야 한다.** GC-90은 표시로 1원이 잘리는
  // 좌표이므로 `true`가 옳고, 정답지가 `false`로 적으면 대조가 물어야 한다.
  //
  // **연쇄를 통째로 뒤집는다**(D55 후속). 칸 하나만 뒤집으면 형식이 먼저 물어 대조 층을
  // 시험하지 못한다 — 그 형식 검사는 바로 아래에서 따로 시험한다. **여기서 재는 것은
  // 「`applied`를 따라간 구현으로 되돌리면 대조가 무는가」이고**, `13.0.0`의 직결 구현은
  // 이 좌표에서 넷을 전부 이 값으로 낸다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap 이월 연쇄(참→거짓)', path: P('max_tax_credit', 'tax_liability_cap'), value: { contribution_carryover_available: false, carryover_shares_future_year_credit_limit: null, carryover_requires_application: null, basis_rule_ids_absent: [CARRYOVER_RULE] }, mentions: ['GC-90', 'max_tax_credit', 'contribution_carryover_available'] },
  // 근거 목록의 두 자를 따로 문다 — **포함**과 **불포함**이 서로 다른 실패 메시지를 낸다.
  { via: 'compare', block: CAP_APPLIED, name: 'basis_rule_ids (실려야 하는데 없음)', path: P('max_tax_credit', 'tax_liability_cap', 'basis_rule_ids'), value: ['pension.credit.rate.made_up'], mentions: ['GC-90', '근거에 실려야 할 규칙이 없다'] },
  { via: 'compare', block: CAP_APPLIED, name: 'basis_rule_ids_absent (빠져야 하는데 실림)', path: P('max_tax_credit', 'tax_liability_cap', 'basis_rule_ids_absent'), value: [ROUNDING_RULE], mentions: ['GC-90', '근거에서 빠져야 할 규칙이 실렸다'] },
  // **한 방향만 형식이 문다.** 자르지 않았는데 이월할 납입액이 있다고 적는 것은 불가능하다.
  // 반대 방향(`applied:true` + `false`)은 **실재하는 좌표이므로 막지 않는다** — 막으면
  // 정답지가 두 자가 갈리는 자리를 적을 수 없게 되고, 그것이 이 회차가 연 자리다.
  { via: 'format', block: CAP_APPLIED, name: 'applied:false + 이월 가능', path: P('max_tax_credit', 'tax_liability_cap'), value: { applied: false, binding_code: 'binding_not_determined', contribution_carryover_available: true }, token: '자르지 않았으면 밀려난 납입액이 없다' },
  // ── 딸린 셋이 그 판정을 따라갔는가 (D55 후속) ──
  // **옮겨 적다 한쪽만 고치는 자리다.** 형식에서 걸면 어긋난 짝의 이름이 그대로 나온다.
  { via: 'format', block: CAP_APPLIED, name: '이월 거짓인데 조건이 남음', path: P('max_tax_credit', 'tax_liability_cap'), value: { contribution_carryover_available: false, carryover_requires_application: true }, token: '전환이 걸리지 않는 안에서는 조건을 읽지 않으므로 null이다' },
  { via: 'format', block: CAP_APPLIED, name: '이월 참인데 조건이 null', path: P('max_tax_credit', 'tax_liability_cap'), value: { contribution_carryover_available: true, carryover_shares_future_year_credit_limit: null }, token: '전환이 걸리면 조건 둘을 읽는다' },
  { via: 'format', block: CAP_APPLIED, name: '이월 거짓인데 근거에 전환 특례', path: P('max_tax_credit', 'tax_liability_cap'), value: { contribution_carryover_available: false, basis_rule_ids: [CARRYOVER_RULE] }, token: '읽지 않은 규칙은 근거로 실리지 않는다' },
  { via: 'format', block: CAP_APPLIED, name: '이월 참인데 근거에서 뺐다고 적음', path: P('max_tax_credit', 'tax_liability_cap'), value: { contribution_carryover_available: true, carryover_shares_future_year_credit_limit: true, carryover_requires_application: true, basis_rule_ids_absent: [CARRYOVER_RULE] }, token: '전환이 걸리면 그 규칙을 읽는다' },
  { via: 'format', block: CAP_APPLIED, name: '같은 규칙을 실렸다고도 빠졌다고도 적음', path: P('max_tax_credit', 'tax_liability_cap'), value: { basis_rule_ids: [ROUNDING_RULE], basis_rule_ids_absent: [ROUNDING_RULE] }, token: '실렸다고도 빠졌다고도 적었다' },

  // ── 목적함수 무력화 — 양쪽 방향 다 ──
  { via: 'compare', block: CAP_ZERO, name: 'objective_degenerate (참→거짓)', path: P('max_tax_credit', 'objective_degenerate'), value: false, mentions: ['GC-91', 'max_tax_credit', '목적함수'] },
  { via: 'compare', block: CAP_ZERO, name: 'objective_degenerate (거짓→참)', path: P('isa_first', 'objective_degenerate'), value: true, mentions: ['GC-91', 'isa_first', '목적함수'] },

  // ── 개시 가능 시점 여덟 항목 ──
  { via: 'compare', block: START_DATES, name: 'pension_withdrawal_start.computable', path: ['expect', 'current', 'pension_withdrawal_start', 'retirement_pension'], value: { computable: false }, mentions: ['GC-92', 'retirement_pension', 'computable'] },
  { via: 'compare', block: START_DATES, name: 'earliest_start_date', path: S('retirement_pension', 'earliest_start_date'), value: '2099-01-01', mentions: ['GC-92', 'earliest_start_date'] },
  { via: 'compare', block: START_DATES, name: 'age_requirement_date', path: S('retirement_pension', 'age_requirement_date'), value: '2099-01-01', mentions: ['GC-92', 'age_requirement_date'] },
  { via: 'compare', block: START_DATES, name: 'holding_requirement_date', path: S('retirement_pension', 'holding_requirement_date'), value: '2099-01-01', mentions: ['GC-92', 'holding_requirement_date'] },
  { via: 'compare', block: START_DATES, name: 'holding_requirement_waived', path: S('retirement_pension', 'holding_requirement_waived'), value: true, mentions: ['GC-92', 'holding_requirement_waived'] },
  { via: 'compare', block: START_DATES, name: 'bound_by_holding_period', path: S('retirement_pension', 'bound_by_holding_period'), value: false, mentions: ['GC-92', 'bound_by_holding_period'] },
  // 두 계좌를 구분해서 본다 — 한쪽 값을 다른 쪽에 써도 걸려야 한다.
  { via: 'compare', block: START_DATES, name: '계좌 교차(annuity에 IRP 날짜)', path: S('annuity_savings', 'earliest_start_date'), value: `${2026 + HOLDING_YEARS}-01-10`, mentions: ['GC-92', 'annuity_savings'] },
  { via: 'compare', block: START_UNKNOWN, name: 'years_until_earliest_start', path: S('retirement_pension', 'years_until_earliest_start'), value: 0, mentions: ['GC-93', 'years_until_earliest_start'] },
  { via: 'compare', block: START_UNKNOWN, name: 'reason_code', path: S('retirement_pension', 'reason_code'), value: 'other_reason', mentions: ['GC-93', 'reason_code'] },
  { via: 'format', block: START_UNKNOWN, name: 'computable:false + 날짜', path: S('retirement_pension', 'earliest_start_date'), value: '2099-01-01', token: 'computable:false' },

  // ── 규칙별 근거·미확인 건수 (D30) ──
  // **이 여덟 줄이 계약 5.7.1절의 첫 번째 방어선이 실제로 무는지를 시험한다.**
  // 건수·위치·유무를 **어긋나지 않게** 함께 올린다 — 형식만 통과하고 대조가 무는지를 본다.
  { via: 'compare', block: LEGAL_BASIS, name: 'uncertainty_note_count', path: ['expect', 'current', 'legal_basis', 'age.reckoning.reference_date'], value: { has_uncertainty_note: true, uncertainty_note_count: AGE_UNCERTAINTY.length + 1, uncertainty_paths: [...AGE_UNCERTAINTY.map((n) => n.path), 'value.one_more'] }, mentions: ['GC-94', 'age.reckoning.reference_date', '미확인 건수'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'uncertainty_paths', path: L('age.reckoning.reference_date', 'uncertainty_paths'), value: AGE_UNCERTAINTY.map(() => 'value.somewhere_else'), mentions: ['GC-94', '미확인 표시의 위치'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'uncertainty_kinds', path: L('age.reckoning.reference_date', 'uncertainty_kinds'), value: ['value_absent'], mentions: ['GC-94', '미확인 표시의 종류'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'legal_basis.status', path: L('age.reckoning.reference_date', 'status'), value: '개정예고', mentions: ['GC-94', 'status'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'legal_basis.bill_stage', path: L('age.reckoning.reference_date', 'bill_stage'), value: '입법예고', mentions: ['GC-94', 'bill_stage'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'legal_basis.applied_to', path: L('age.reckoning.reference_date', 'applied_to'), value: ['plans[].allocations'], mentions: ['GC-94', '쓰인 출력 경로'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'present (실렸는데 아니라고 적음)', path: ['expect', 'current', 'legal_basis', 'age.reckoning.reference_date'], value: { present: false }, mentions: ['GC-94', '근거 실림 여부'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'present (안 실렸는데 실렸다고 적음)', path: ['expect', 'current', 'legal_basis', 'pension.credit.isa_transfer.extra_limit'], value: { present: true }, mentions: ['GC-94', '근거 실림 여부'] },
  // 건수와 유무를 한쪽만 고치면 대조까지 가기 전에 형식이 문다.
  { via: 'format', block: LEGAL_BASIS, name: 'has_uncertainty_note만 뒤집기', path: L('age.reckoning.reference_date', 'has_uncertainty_note'), value: false, token: 'has_uncertainty_note' },
  { via: 'format', block: LEGAL_BASIS, name: '건수만 0으로', path: L('age.reckoning.reference_date', 'uncertainty_note_count'), value: 0, token: 'uncertainty_note_count' },
  { via: 'format', block: LEGAL_BASIS, name: '모르는 표시 종류', path: L('age.reckoning.reference_date', 'uncertainty_kinds'), value: ['made_up_kind'], token: '모르는 표시' },
  { via: 'format', block: LEGAL_BASIS, name: 'present:false인데 내용을 주장', path: ['expect', 'current', 'legal_basis', 'pension.credit.isa_transfer.extra_limit'], value: { present: false, uncertainty_note_count: 1 }, token: 'present:false' },

  // ── 공제율을 **무엇으로** 쟀는가 (D27·D30) ──
  // 비율만 맞고 축이 틀린 상태를 잡는다. 25% 과대였던 결함이 정확히 이 자리였다.
  { via: 'compare', block: LEGAL_BASIS, name: 'credit_rate.measured_amount', path: CR('measured_amount'), value: LOW_SALARY + 1, mentions: ['GC-94', '공제율', 'measured_amount'] },
  { via: 'compare', block: LEGAL_BASIS, name: 'credit_rate.basis (축 자체를 바꿈)', path: ['credit_rate'], value: { income_tax: CREDIT_RATE, basis: 'global_income', measured_amount: LOW_SALARY, fallback_applied: false, fallback_direction: null }, mentions: ['GC-94', '공제율', 'basis'] },
  { via: 'compare', block: CREDIT_RATE_FALLBACK, name: 'credit_rate.fallback_applied (대체 적용 여부)', path: ['credit_rate'], value: { basis: 'total_salary', measured_amount: 1, fallback_applied: false, fallback_direction: null }, mentions: ['GC-95', '공제율'] },
  { via: 'format', block: CREDIT_RATE_FALLBACK, name: 'basis와 fallback_applied가 어긋남', path: CR('fallback_applied'), value: false, token: 'fallback_applied' },
  { via: 'format', block: CREDIT_RATE_FALLBACK, name: '대체 구간인데 잰 금액이 있음', path: CR('measured_amount'), value: 1, token: 'measured_amount가 null이 아니다' },
  { via: 'format', block: LEGAL_BASIS, name: '축은 있는데 잰 금액이 없음', path: CR('measured_amount'), value: null, token: '무엇을 쟀는지가 없다' },
  { via: 'format', block: LEGAL_BASIS, name: '모르는 판정 축', path: CR('basis'), value: 'converted_salary', token: '모르는 판정 축' },

  // ── 가정 기반 ISA 정산액 (D28·D29·D31) ──
  // 구간으로 내야 하는 입력에 점을 적으면 대조가 문다 — 근거 없는 점을 고른 것이다.
  { via: 'compare', block: ISA_RANGE, name: 'point_estimate_krw (구간에 점을 적음)', path: E('point_estimate_krw'), value: 0, mentions: ['GC-97', 'ISA 정산액', 'point_estimate_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'principal_krw', path: E('principal_krw'), value: ISA_PRINCIPAL + 1, mentions: ['GC-96', 'principal_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'total_return_krw', path: E('total_return_krw'), value: TAX_FREE_LIMIT + 1, mentions: ['GC-96', 'total_return_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'taxable_income_krw', path: E('taxable_income_krw'), value: TAX_FREE_LIMIT + 1, mentions: ['GC-96', 'taxable_income_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'net_income_krw', path: E('net_income_krw'), value: TAX_FREE_LIMIT - 1, mentions: ['GC-96', 'net_income_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'tax_free_limit_krw', path: E('tax_free_limit_krw'), value: TAX_FREE_LIMIT + 1, mentions: ['GC-96', 'tax_free_limit_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'comparison_side_tax_krw', path: E('comparison_side_tax_krw'), value: ISA_SETTLEMENT + 1, mentions: ['GC-96', 'comparison_side_tax_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'isa_side_tax_krw', path: E('isa_side_tax_krw'), value: 1, mentions: ['GC-96', 'isa_side_tax_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'loss_offset_applied_krw', path: E('loss_offset_applied_krw'), value: 1, mentions: ['GC-96', 'loss_offset_applied_krw'] },
  // 축 둘을 합이 유지되게 옮긴다 — 합만 맞으면 통과하는 상태를 만들지 않는다.
  { via: 'compare', block: ISA_POINT, name: 'axis_breakdown (합은 같고 갈래가 틀림)', path: E('axis_breakdown'), value: { loss_offset_krw: ISA_SETTLEMENT, tax_free_krw: 0, rate_gap_krw: 0, rounding_residual_krw: 0 }, mentions: ['GC-96', 'ISA 정산액 축'] },
  { via: 'compare', block: ISA_RANGE, name: 'upper_bound_krw', path: E('upper_bound_krw'), value: 1, mentions: ['GC-97', 'upper_bound_krw'] },
  { via: 'compare', block: ISA_RANGE, name: 'lower_bound_krw', path: E('lower_bound_krw'), value: 1, mentions: ['GC-97', 'lower_bound_krw'] },
  { via: 'compare', block: ISA_RANGE, name: 'settlement_years (대체값)', path: E('settlement_years'), value: MIN_CONTRACT_YEARS + 1, mentions: ['GC-97', 'settlement_years'] },
  { via: 'compare', block: ISA_RANGE, name: 'settlement_years_source', path: E('settlement_years_source'), value: 'user', mentions: ['GC-97', 'settlement_years_source'] },
  { via: 'compare', block: ISA_RANGE, name: 'taxable_share_max', path: E('taxable_share_max'), value: 0, mentions: ['GC-97', 'taxable_share_max'] },
  { via: 'compare', block: ISA_POINT, name: 'state', path: E(), value: { state: 'not_computable' }, mentions: ['GC-96', 'state'] },
  // 구간 케이스에 점을 적으면 "근거 없는 점을 골랐다"가 된다. 대조가 그것을 문다.
  { via: 'compare', block: ISA_POINT, name: 'point_estimate_krw를 null로 (점을 지움)', path: E('point_estimate_krw'), value: null, mentions: ['GC-96', 'point_estimate_krw'] },
  { via: 'format', block: ISA_POINT, name: 'is_annual:true', path: E('is_annual'), value: true, token: '1년치가 아니다' },
  { via: 'format', block: ISA_POINT, name: '축의 합이 상한과 다름', path: E('axis_breakdown', 'tax_free_krw'), value: ISA_SETTLEMENT + 1, token: '네 축의 합' },
  { via: 'format', block: ISA_POINT, name: '상한만 바꿔 축의 합이 깨짐', path: E('upper_bound_krw'), value: ISA_SETTLEMENT + 1, token: '네 축의 합' },
  { via: 'format', block: ISA_POINT, name: '점이 구간의 끝과 다름', path: E('lower_bound_krw'), value: 0, token: 'point_estimate_krw' },
  { via: 'format', block: ISA_RANGE, name: '하한이 상한보다 큼', path: E(), value: { state: 'computed', lower_bound_krw: 1, upper_bound_krw: 0 }, token: 'lower_bound_krw' },
  { via: 'format', block: ISA_POINT, name: 'computed인데 못 낸 이유가 있음', path: E('not_computable_reason_code'), value: 'isa_tax_free_limit_unknown', token: 'not_computable_reason_code' },
  { via: 'format', block: ISA_RANGE, name: '금액 없는 상태인데 금액을 주장', path: E('state'), value: 'not_computable', token: '금액을 주장한다' },
  { via: 'format', block: ISA_POINT, name: '모르는 상태 이름', path: E('state'), value: 'estimated', token: '모르는 상태' },

  // ── 계약이 상수로 고정한 넷 (D32 후속) ──
  // 상수는 아무도 주장하지 않으면 조용히 달라지고, 달라져도 어떤 금액도 틀리지 않아
  // 다른 검사에 걸리지 않는다. 그래서 **주장할 수 있는지**와 **주장하면 무는지**를 함께 본다.
  { via: 'compare', block: ISA_POINT, name: 'principal_basis_code', path: E('principal_basis_code'), value: 'account_balance', mentions: ['GC-96', 'principal_basis_code'] },
  { via: 'compare', block: ISA_POINT, name: 'return_accrual_code', path: E('return_accrual_code'), value: 'compound_interest', mentions: ['GC-96', 'return_accrual_code'] },
  // 두 boolean 상수는 `false`가 형식 단계에서 거절되므로 그쪽으로 확인한다 —
  // 계약이 하지 않은 선언을 정답지가 대신 하는 것을 막는다.
  { via: 'format', block: ISA_POINT, name: 'is_lower_bound_for_aggregate_taxpayer:false', path: E('is_lower_bound_for_aggregate_taxpayer'), value: false, token: '하한이다' },
  { via: 'format', block: ISA_POINT, name: 'assumes_contract_held_to_settlement:false', path: E('assumes_contract_held_to_settlement'), value: false, token: '중도해지는 요청에 입력이 없어' },

  // ── 반영하지 않은 개정예고 규칙 (D32 후속) ──
  { via: 'compare', block: LEGAL_BASIS, name: 'unapplied (없는데 있다고 적음)', path: ['expect', 'current', 'unapplied_proposed_rules', 'proposed.productive_isa.youth_income_deduction'], value: { present: true }, mentions: ['GC-94', '미반영 규칙 실림 여부'] },
  { via: 'format', block: LEGAL_BASIS, name: 'present:false인데 사유를 주장', path: ['expect', 'current', 'unapplied_proposed_rules', 'proposed.productive_isa.youth_income_deduction'], value: { present: false, reason_code: 'out_of_product_scope' }, token: '없는 항목의 사유' },

  // ── 공제 없는 연금 납입의 사실들 (D26·D32 후속) ──
  // **네 사실이 하나씩 다 물리는지를 본다.** 하나라도 건너뛰어지면 그 사실은 응답에서
  // 값이 뒤집혀도 정답지가 통과하고, 그때 화면 문장이 거짓이 된다(계약 5.6절).
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'principal_tax_free_requires_confirmation', path: NQF('principal_tax_free_requires_confirmation'), value: false, mentions: ['GC-98', 'current', 'max_tax_credit', 'principal_tax_free_requires_confirmation'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'principal_tax_free_confirmation_prospective_only', path: NQF('principal_tax_free_confirmation_prospective_only'), value: false, mentions: ['GC-98', 'principal_tax_free_confirmation_prospective_only'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'principal_taxed_on_withdrawal', path: NQF('principal_taxed_on_withdrawal'), value: true, mentions: ['GC-98', 'principal_taxed_on_withdrawal'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'returns_taxed_on_withdrawal', path: NQF('returns_taxed_on_withdrawal'), value: false, mentions: ['GC-98', 'returns_taxed_on_withdrawal'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'contribution_without_credit_krw', path: NQF('contribution_without_credit_krw'), value: WITHOUT_CREDIT + 1, mentions: ['GC-98', 'contribution_without_credit_krw'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'reason_code', path: NQ('annuity_savings', 'reason_code'), value: 'depends_on_investment_return_not_in_ruleset', mentions: ['GC-98', '비정량 효과 사유'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'present (붙었는데 아니라고 적음)', path: NQ('annuity_savings'), value: { present: false }, mentions: ['GC-98', '비정량 효과 실림 여부', 'annuity_savings'] },
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: 'present (안 붙었는데 붙었다고 적음)', path: NQ('retirement_pension'), value: { present: true }, mentions: ['GC-98', '비정량 효과 실림 여부', 'retirement_pension'] },
  // 두 연금계좌를 구분해서 본다 — 한쪽의 사실을 다른 쪽에 적어도 걸려야 한다.
  { via: 'compare', block: WITHOUT_CREDIT_FACTS, name: '계좌 교차(IRP에 연금저축의 사실을 적음)', path: NQ('retirement_pension'), value: { present: true, facts: { contribution_without_credit_krw: WITHOUT_CREDIT, principal_taxed_on_withdrawal: false, principal_tax_free_requires_confirmation: true, principal_tax_free_confirmation_prospective_only: true, returns_taxed_on_withdrawal: true } }, mentions: ['GC-98', 'retirement_pension'] },

  // 형식이 먼저 무는 자리 — **옮겨 적다 한쪽만 고친 블록을 대조까지 보내지 않는다.**
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: '세 사실 중 하나를 빼고 적음', path: NQ('annuity_savings', 'facts'), value: { principal_taxed_on_withdrawal: false, principal_tax_free_confirmation_prospective_only: true, returns_taxed_on_withdrawal: true }, token: '함께 나가야 하는 사실이 빠졌다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: '금액만 적고 사실을 하나도 안 적음', path: NQ('annuity_savings', 'facts'), value: { contribution_without_credit_krw: WITHOUT_CREDIT }, token: '사실을 하나도 적지 않았다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: 'present:false인데 사실을 주장', path: NQ('retirement_pension'), value: { present: false, facts: { principal_taxed_on_withdrawal: false, principal_tax_free_requires_confirmation: true, principal_tax_free_confirmation_prospective_only: true, returns_taxed_on_withdrawal: true } }, token: '없는 효과의 내용을 적을 수 없다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: '올해 공제액을 0이 아니라고 적음', path: NQF('credit_this_year_krw'), value: 1, token: '언제나 0이다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: '공제 없는 몫이 0', path: NQF('contribution_without_credit_krw'), value: 0, token: '0보다 커야 한다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: 'facts가 붙지 않는 코드에 facts를 적음', path: P('max_tax_credit', 'non_quantified_effects', 'isa_tax_free_headroom'), value: { isa: { present: true, facts: { principal_taxed_on_withdrawal: false, principal_tax_free_requires_confirmation: true, principal_tax_free_confirmation_prospective_only: true, returns_taxed_on_withdrawal: true } } }, token: 'facts가 붙지 않는다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: '붙는 코드에 facts:null', path: NQ('annuity_savings', 'facts'), value: null, token: '언제나 facts가 붙는다' },
  { via: 'format', block: WITHOUT_CREDIT_FACTS, name: '사실 자리에 참·거짓이 아닌 값', path: NQF('principal_tax_free_requires_confirmation'), value: 'true', token: '참/거짓이어야 한다' },

  // ── 헤드라인 합계와 축의 상한 (D38) ──
  // **이 회차에 자리가 처음 생겼다.** 적으면 실제로 대조되는지, 그리고 자기모순인 블록이
  // 형식 단계에서 걸리는지를 층을 갈라 본다.
  // 두 끝과 점을 **함께** 올린다 — 하나만 올리면 자기모순이 되어 형식 단계에서 걸리고,
  // 그러면 대조가 무는지를 시험하지 못한다. 층을 갈라 둔 이유가 이것이다.
  { via: 'compare', block: ISA_POINT, name: 'headline.lower_bound_krw', path: P('max_tax_credit', 'headline_composite_total'), value: { lower_bound_krw: 1, upper_bound_krw: 1, point_estimate_krw: 1, bound_code: 'point', includes_assumption_component: false, determined_component_krw: 0, assumption_component_krw: null, assumption_settlement_years: null, assumption_settlement_years_source: null }, mentions: ['GC-96', '헤드라인 합계', 'lower_bound_krw'] },
  { via: 'compare', block: ISA_POINT, name: 'headline.determined_component_krw', path: H('determined_component_krw'), value: 1, mentions: ['GC-96', '헤드라인 합계', 'determined_component_krw'] },
  // **가정 성분이 있다고 적으면 걸려야 한다.** ISA 배분이 0인 안의 합계에 그 성분이
  // 들어가면 어느 안을 골라도 같은 금액이 헤드라인에 붙어 안 사이의 비교가 무의미해진다.
  { via: 'compare', block: ISA_POINT, name: 'headline.includes_assumption_component', path: H('includes_assumption_component'), value: true, mentions: ['GC-96', '헤드라인 합계', 'includes_assumption_component'] },
  { via: 'compare', block: ISA_POINT, name: 'axis_ceilings.tax_free_krw', path: AC('tax_free_krw'), value: ISA_SETTLEMENT + 1, mentions: ['GC-96', '축의 상한', 'tax_free_krw'] },
  // **금액은 그대로 두고 기간만 비튼다** — 이 자리가 비면 아무 금액도 틀리지 않는다.
  { via: 'compare', block: ISA_POINT, name: 'axis_ceilings.tax_free_settlement_years', path: AC('tax_free_settlement_years'), value: ISA_YEARS + 1, mentions: ['GC-96', '축의 상한', 'tax_free_settlement_years'] },
  { via: 'compare', block: ISA_POINT, name: 'axis_ceilings.tax_free_period_code', path: AC('tax_free_period_code'), value: 'tax_year', mentions: ['GC-96', '축의 상한', 'tax_free_period_code'] },
  { via: 'format', block: ISA_POINT, name: '가정 성분이 없는데 구간으로 적음', path: H('bound_code'), value: 'range', token: '가정 성분이 없는데 구간으로' },
  { via: 'format', block: ISA_POINT, name: '가정 성분이 없는데 기간을 주장', path: H('assumption_settlement_years_source'), value: 'user', token: '가정 성분이 없다고 적고' },
  { via: 'format', block: ISA_POINT, name: '합계의 점이 구간의 끝과 다름', path: H('upper_bound_krw'), value: 1, token: 'point_estimate_krw' },
  { via: 'format', block: ISA_POINT, name: '모르는 분기 코드', path: H('bound_code'), value: 'upper_bound', token: '모르는 분기' },
  { via: 'format', block: ISA_POINT, name: '상한 없는 축에 상한이 있다고 적음', path: AC('rate_gap_has_ceiling'), value: true, token: '언제나 false다' },
  { via: 'format', block: ISA_POINT, name: '축의 상한을 법정 최댓값이라고 적음', path: AC('tax_free_is_lower_bound'), value: false, token: '언제나 true다' },
];

for (const injection of INJECTIONS) {
  const { via, block, name, path, value } = injection;
  test(`결함 주입[${via}]: ${block.case} ${name}`, () => {
    const broken = setPath(block, path, value);
    const formatErrors = validateBlock(broken, broken.case);

    if (via === 'format') {
      assert.ok(
        formatErrors.some((e) => e.includes(injection.token)),
        `형식이 물어야 하는데 통과했다: ${name}\n${formatErrors.join('\n')}`,
      );
      return;
    }

    // 형식에서 걸리면 **대조가** 무는지를 시험하지 못한다. 층을 갈라 둔 이유다.
    assert.deepStrictEqual(formatErrors, [], `주입한 값이 형식 단계에서 걸렸다: ${name}`);

    let error = null;
    try {
      runBlock(broken);
    } catch (thrown) {
      error = thrown;
    }
    assert.ok(error, `값을 비틀었는데 통과했다 — 이 항목은 적혀도 검사되지 않는다: ${name}`);
    for (const token of injection.mentions) {
      assert.ok(
        error.message.includes(token),
        `실패 메시지에 "${token}"이 없다. 어디가 깨졌는지 읽을 수 없다:\n${error.message}`,
      );
    }
  });
}

// ── 3. 모르는 키는 계속 오타로 본다 ──────────────────────────────────────────

const TYPOS = [
  { where: '배분안', path: P('max_tax_credit', 'tax_credit_before_caps'), block: CAP_APPLIED },
  { where: '세액 한도', path: P('max_tax_credit', 'tax_liability_cap', 'cap'), block: CAP_APPLIED },
  { where: '목적함수', path: P('max_tax_credit', 'objective_degenerated'), block: CAP_ZERO },
  { where: '시나리오', path: ['expect', 'current', 'pension_withdrawal_starts'], block: START_DATES },
  { where: '개시 시점 계좌', path: ['expect', 'current', 'pension_withdrawal_start', 'isa'], block: START_DATES },
  { where: '개시 시점 항목', path: S('retirement_pension', 'earliest_start'), block: START_DATES },
  { where: '근거 목록', path: ['expect', 'current', 'legal_basises'], block: LEGAL_BASIS },
  { where: '근거 항목', path: L('age.reckoning.reference_date', 'uncertainty_note_counts'), block: LEGAL_BASIS },
  { where: '공제율', path: CR('basis_code'), block: LEGAL_BASIS },
  { where: 'ISA 정산액', path: E('upper_bound'), block: ISA_POINT },
  { where: 'ISA 정산액 축', path: E('axis_breakdown', 'tax_free'), block: ISA_POINT },
  { where: 'ISA 축의 상한', path: AC('tax_free'), block: ISA_POINT },
  { where: '헤드라인 합계', path: H('lower_bound'), block: ISA_POINT },
  { where: '미반영 규칙 항목', path: ['expect', 'current', 'unapplied_proposed_rules', 'proposed.productive_isa.youth_income_deduction', 'reason'], block: LEGAL_BASIS },
  { where: '비정량 효과', path: P('max_tax_credit', 'non_quantified_effect'), block: WITHOUT_CREDIT_FACTS },
  { where: '비정량 효과 코드', path: P('max_tax_credit', 'non_quantified_effects', 'pension_contribution_without_credits'), block: WITHOUT_CREDIT_FACTS },
  { where: '비정량 효과 계좌', path: P('max_tax_credit', 'non_quantified_effects', 'pension_contribution_without_credit', 'pension'), block: WITHOUT_CREDIT_FACTS },
  { where: '비정량 효과 항목', path: NQ('annuity_savings', 'reason'), block: WITHOUT_CREDIT_FACTS },
  { where: '비정량 효과 사실', path: NQF('principal_tax_free_requires_confirmations'), block: WITHOUT_CREDIT_FACTS },
];

for (const { where, path, block } of TYPOS) {
  test(`오타 거절: ${where} — ${path.at(-1)}`, () => {
    const errors = validateBlock(setPath(block, path, {}), block.case);
    assert.ok(
      errors.some((e) => e.includes('모르는 키') && e.includes(path.at(-1))),
      `오타가 조용히 무시됐다. 그러면 그 항목은 검사되지 않는데도 검사된 것처럼 보인다:\n${errors.join('\n')}`,
    );
  });
}

// ── 4. 빈 객체는 아무것도 주장하지 않는다 ────────────────────────────────────

test('빈 객체로 적으면 형식 검사가 거절한다', () => {
  const cases = [
    [START_DATES, P('max_tax_credit', 'tax_liability_cap')],
    [START_DATES, ['expect', 'current', 'pension_withdrawal_start']],
    [START_DATES, ['expect', 'current', 'pension_withdrawal_start', 'retirement_pension']],
    // 이번에 넓힌 세 층에도 같은 못을 박는다 — 주장처럼 보이면서 아무것도 보지 않는 상태.
    [LEGAL_BASIS, ['expect', 'current', 'legal_basis']],
    [LEGAL_BASIS, ['expect', 'current', 'legal_basis', 'age.reckoning.reference_date']],
    [LEGAL_BASIS, ['credit_rate']],
    [ISA_POINT, E()],
    [ISA_POINT, E('axis_breakdown')],
    [ISA_POINT, E('axis_ceilings')],
    [ISA_POINT, P('max_tax_credit', 'headline_composite_total')],
    // 이번에 넓힌 세 겹에도 같은 못을 박는다.
    [WITHOUT_CREDIT_FACTS, P('max_tax_credit', 'non_quantified_effects')],
    [WITHOUT_CREDIT_FACTS, P('max_tax_credit', 'non_quantified_effects', 'pension_contribution_without_credit')],
    [WITHOUT_CREDIT_FACTS, NQ('annuity_savings')],
    [WITHOUT_CREDIT_FACTS, NQ('annuity_savings', 'facts')],
  ];

  for (const [block, path] of cases) {
    const errors = validateBlock(setPath(block, path, {}), block.case);
    assert.ok(
      errors.some((e) => e.includes('빈 객체')),
      `빈 객체가 통과했다: ${path.join('.')}\n${errors.join('\n')}`,
    );
  }
});

// ── 5. **응답** 쪽 결함 주입 — 이 어휘를 연 이유가 이 절이다 ─────────────────
//
// 위의 주입은 전부 **블록**을 비틀었고, 그것이 보이는 것은 "적으면 검사된다"까지다.
// 이번 회차의 물음은 반대 방향이다 — **응답에서 그 사실이 사라지면 정답지가 무는가.**
// 그래서 여기서는 블록을 그대로 두고 응답을 비튼다.
//
// **왜 이 절이 필요한가.** 계약 5.6절이 「셋 중 하나라도 빠지면 화면 문장이 거짓이 된다」고
// 적고 D32가 그 효과를 기본안으로 옮겼는데, 넓히기 전 어휘로는 `non_quantified_codes`
// (코드 목록)만 적을 수 있었다. **코드는 그대로 두고 사실만 뒤집으면 정답지가 통과한다** —
// 아래 마지막 시험이 그 상태를 재현해 이 절이 실제로 그 구멍을 메웠음을 보인다.

const BASE_RESPONSE = compute(buildRequest(WITHOUT_CREDIT_FACTS), rulesets);

/** 응답 사본에서 문제의 효과를 찾아 돌려준다. 원본은 건드리지 않는다. */
const brokenResponse = (mutate) => {
  const copy = structuredClone(BASE_RESPONSE);
  const plan = copy.scenarios
    .find((s) => s.scenario_id === 'current')
    .plans.find((p) => p.plan_id === 'max_tax_credit');
  mutate(plan);
  return copy;
};

const effectOf = (plan) =>
  plan.non_quantified_effects.find(
    (e) => e.code === 'pension_contribution_without_credit' && e.account === 'annuity_savings',
  );

const RESPONSE_INJECTIONS = [
  {
    name: '확인 절차 사실을 응답에서 **지운다**',
    mutate: (plan) => {
      delete effectOf(plan).facts.principal_tax_free_requires_confirmation;
    },
    mentions: ['GC-98', 'current', 'max_tax_credit', 'principal_tax_free_requires_confirmation'],
  },
  {
    name: '확인 절차 사실의 값을 뒤집는다',
    mutate: (plan) => {
      effectOf(plan).facts.principal_tax_free_requires_confirmation = false;
    },
    mentions: ['GC-98', 'max_tax_credit', 'principal_tax_free_requires_confirmation'],
  },
  {
    name: '불소급 사실을 지운다',
    mutate: (plan) => {
      delete effectOf(plan).facts.principal_tax_free_confirmation_prospective_only;
    },
    mentions: ['GC-98', 'principal_tax_free_confirmation_prospective_only'],
  },
  {
    name: '수익 과세 사실을 지운다',
    mutate: (plan) => {
      delete effectOf(plan).facts.returns_taxed_on_withdrawal;
    },
    mentions: ['GC-98', 'returns_taxed_on_withdrawal'],
  },
  {
    name: 'facts를 통째로 null로 만든다',
    mutate: (plan) => {
      effectOf(plan).facts = null;
    },
    mentions: ['GC-98', 'facts가 null이다'],
  },
  {
    name: '효과를 통째로 지운다',
    mutate: (plan) => {
      plan.non_quantified_effects = plan.non_quantified_effects.filter(
        (e) => e.code !== 'pension_contribution_without_credit',
      );
    },
    mentions: ['GC-98', '비정량 효과'],
  },
  {
    name: '효과를 IRP 쪽으로 옮긴다 (코드 목록은 그대로다)',
    mutate: (plan) => {
      effectOf(plan).account = 'retirement_pension';
    },
    mentions: ['GC-98', '비정량 효과 실림 여부'],
  },
];

for (const injection of RESPONSE_INJECTIONS) {
  test(`결함 주입[response]: GC-98 ${injection.name}`, () => {
    let error = null;
    try {
      checkCase(WITHOUT_CREDIT_FACTS, brokenResponse(injection.mutate));
    } catch (thrown) {
      error = thrown;
    }
    assert.ok(
      error,
      `응답에서 사실을 비틀었는데 정답지가 통과했다 — 그 사실은 사라져도 아무도 모른다: ${injection.name}`,
    );
    for (const token of injection.mentions) {
      assert.ok(
        error.message.includes(token),
        `실패 메시지에 "${token}"이 없다. 어디가 깨졌는지 읽을 수 없다:\n${error.message}`,
      );
    }
  });
}

/**
 * **넓히기 전 어휘로는 못 잡는다는 것을 같은 자리에서 보인다.**
 *
 * 코드 목록만 적은 블록은 사실이 뒤집혀도 통과한다 — `non_quantified_codes`가 보는 것은
 * 코드의 집합뿐이고 그 집합은 이 주입으로 한 글자도 바뀌지 않기 때문이다. 이 시험이
 * 실패한다면 그것은 좋은 소식이다(다른 축이 그 구멍을 메웠다는 뜻이므로 여기를 고쳐 적는다).
 */
test('코드 목록만 적은 블록은 사실이 뒤집혀도 통과한다 — 이 회차가 메운 구멍', () => {
  const codesOnly = structuredClone(WITHOUT_CREDIT_FACTS);
  delete codesOnly.expect.current.plans.max_tax_credit.non_quantified_effects;

  assert.deepStrictEqual(validateBlock(codesOnly, codesOnly.case), []);
  checkCase(
    codesOnly,
    brokenResponse((plan) => {
      effectOf(plan).facts.principal_tax_free_requires_confirmation = false;
    }),
  );
});
