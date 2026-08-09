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
import { CONFIRMED_FILE, baseRequest, deepMerge, findRule, loadRulesets } from './test-helpers.mjs';

const rulesets = loadRulesets();
const confirmedRule = (id) => findRule(rulesets, CONFIRMED_FILE, id);

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

/** `tax-liability-cap.test.mjs`와 같은 프로필. 공제율이 우대 구간으로 판정된다. */
const LOW_SALARY = 50_000_000;
const withCap = (prior, patch = {}) =>
  baseRequest(
    deepMerge(
      {
        profile: {
          current_year_total_salary_krw: LOW_SALARY,
          prior_year_total_salary_krw: 60_000_000,
          prior_year_tax: {
            determined_tax_krw: null,
            pension_credit_applied_krw: null,
            ...prior,
          },
        },
      },
      patch,
    ),
  );

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
  const capKrw = 300_000;
  return {
    case: 'GC-90',
    request: withCap(
      { state: 'amount', determined_tax_krw: capKrw, pension_credit_applied_krw: 0 },
      { profile: { monthly_capacity_krw: COMBINED_LIMIT / 12 } },
    ),
    expect: {
      current: {
        plans: {
          max_tax_credit: {
            // 동점 구간이므로 인출이 자유로운 연금저축이 자기 한도까지 먼저 찬다.
            allocation: {
              annuity_savings: ANNUITY_LIMIT,
              retirement_pension: COMBINED_LIMIT - ANNUITY_LIMIT,
              isa: 0,
            },
            tax_credit: creditOf(capKrw),
            tax_credit_before_cap: creditOf(uncapped),
            tax_liability_cap: {
              known: true,
              cap_krw: capKrw,
              applied: true,
              threshold_income_tax_krw: uncapped,
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
  request: withCap(
    { state: 'zero', determined_tax_krw: null },
    { profile: { monthly_capacity_krw: ANNUITY_LIMIT / 12 } },
  ),
  expect: {
    current: {
      plans: {
        max_tax_credit: {
          allocation: { annuity_savings: ANNUITY_LIMIT, retirement_pension: 0, isa: 0 },
          tax_credit: creditOf(0),
          tax_liability_cap: { known: true, cap_krw: 0, applied: true },
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
          // 한도를 안다는 것만 적는다 — 나머지 세 항목 없이 `known` 하나만 적어도
          // 대조가 도는지를 이 자리에서 본다(선택 항목의 부분 기재).
          tax_liability_cap: { known: true },
          warning_count: 0,
        },
      },
    },
  },
};

const BLOCKS = [CAP_APPLIED, CAP_ZERO, START_DATES, START_UNKNOWN];

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
const S = (account, key) => ['expect', 'current', 'pension_withdrawal_start', account, key];

const UNCAPPED = Math.floor(COMBINED_LIMIT * CREDIT_RATE);

/**
 * 잡히는 층을 행마다 밝힌다.
 *  - `compare` — 형식은 통과하고 **대조**가 문다. 선택 항목이 조용히 건너뛰어지면 여기서 걸린다.
 *  - `format` — 값끼리 어긋나 **형식**이 먼저 문다. 두 값을 옮겨 적다 하나만 고친 경우다.
 */
const INJECTIONS = [
  // ── 자르기 전 금액 ──
  // 소득세분을 1원 올리면 지방세·합계까지 따라 움직여야 형식을 통과한다. 그 상태로도 대조가 문다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_credit_before_cap(전체)', path: P('max_tax_credit', 'tax_credit_before_cap'), value: creditOf(UNCAPPED + 1), mentions: ['GC-90', 'current', 'max_tax_credit', '자르기 전'] },
  // 소득세분은 그대로 두고 지방세분만 어긋나게 한다 — 지방세분을 따로 보는지 확인한다.
  { via: 'compare', block: CAP_APPLIED, name: 'tax_credit_before_cap.local_tax', path: P('max_tax_credit', 'tax_credit_before_cap'), value: { income_tax: UNCAPPED, local_tax: surtaxOf(UNCAPPED) + 1, total: UNCAPPED + surtaxOf(UNCAPPED) + 1 }, mentions: ['GC-90', 'max_tax_credit', '자르기 전'] },
  // 합계만 1원 틀리면 대조까지 가기 전에 형식이 문다(소득세 + 지방세 = 합계).
  { via: 'format', block: CAP_APPLIED, name: 'tax_credit_before_cap.total 단독', path: P('max_tax_credit', 'tax_credit_before_cap', 'total'), value: UNCAPPED + surtaxOf(UNCAPPED) + 1, token: '옮겨 적으면서 어긋났다' },

  // ── 배분안 단위 세액 한도 네 항목 ──
  { via: 'compare', block: START_UNKNOWN, name: 'tax_liability_cap.known', path: P('max_tax_credit', 'tax_liability_cap', 'known'), value: false, mentions: ['GC-93', 'max_tax_credit', 'known'] },
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.cap_krw', path: P('max_tax_credit', 'tax_liability_cap', 'cap_krw'), value: 1, mentions: ['GC-90', 'max_tax_credit', 'cap_krw'] },
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.applied', path: P('max_tax_credit', 'tax_liability_cap', 'applied'), value: false, mentions: ['GC-90', 'applied'] },
  { via: 'compare', block: CAP_APPLIED, name: 'tax_liability_cap.threshold_income_tax_krw', path: P('max_tax_credit', 'tax_liability_cap', 'threshold_income_tax_krw'), value: 1, mentions: ['GC-90', 'threshold_income_tax_krw'] },
  // 한도가 0인 쪽에서도 같은 항목이 문다 — `0`과 `null`을 섞지 않는지 함께 본다.
  { via: 'compare', block: CAP_ZERO, name: 'tax_liability_cap.cap_krw (한도 0)', path: P('max_tax_credit', 'tax_liability_cap', 'cap_krw'), value: 1, mentions: ['GC-91', 'cap_krw'] },
  { via: 'format', block: CAP_APPLIED, name: 'known:false + applied:true', path: P('max_tax_credit', 'tax_liability_cap'), value: { known: false, applied: true }, token: '모르는 한도로 자를 수 없다' },

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
  for (const path of [
    P('max_tax_credit', 'tax_liability_cap'),
    ['expect', 'current', 'pension_withdrawal_start'],
    ['expect', 'current', 'pension_withdrawal_start', 'retirement_pension'],
  ]) {
    const errors = validateBlock(setPath(START_DATES, path, {}), 'GC-92');
    assert.ok(
      errors.some((e) => e.includes('빈 객체')),
      `빈 객체가 통과했다: ${path.join('.')}\n${errors.join('\n')}`,
    );
  }
});
