// 결함 주입 — **소스를 변형해** 새 불변식이 실제로 무는지 확인한다 (D32).
//
// 왜 룰셋 변형으로는 부족한가. `fault-injection.test.mjs`는 룰셋 사본을 바꿔 "이 값이
// 룰셋에서 온 것인가"를 확인한다. 그러나 이번 회차가 지켜야 하는 두 진술은 룰셋에
// 손잡이가 없다.
//
//   · **ISA가 3단계보다 먼저다** — 어느 규칙도 이 선후를 정하지 않는다. 소유자가 정했다.
//   · **3단계 몫이 공제액에 섞이지 않는다** — 섞는 것은 룰셋이 아니라 코드 한 줄이다.
//
// 그래서 **엔진 소스를 통째로 임시 디렉터리에 복사하고 그 사본만 변형한다.**
// `src/engine/`의 원본은 한 글자도 건드리지 않으며, 변형이 실제로 적용됐는지를
// 치환 횟수로 확인한다 — **주입이 조용히 빗나가면 그 테스트는 통과하면서 아무것도
// 증명하지 않는다.** 이 저장소가 세 번 겪은 형태의 결함이다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compute } from './index.mjs';
import { CAP_COORDINATES, baseRequest, loadRulesets } from './test-helpers.mjs';

const rulesets = loadRulesets();
// 경로에 공백·한글이 들어 있다. `URL.pathname`은 퍼센트 인코딩된 문자열이므로 쓰지 않는다.
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * 엔진 소스를 임시 디렉터리에 복사하고 파일 하나를 치환한 뒤 그 사본의 `compute`를 준다.
 *
 * `count`를 함께 받아 **치환이 정확히 그만큼 일어났는지** 확인한다. 소스가 바뀌어
 * 주입 대상 문자열이 사라지면 여기서 멈춘다 — 그것이 이 파일의 유통기한 장치다.
 */
async function mutatedCompute({ file, from, to, count = 1 }) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-mutant-'));
  for (const name of readdirSync(HERE)) {
    if (!name.endsWith('.mjs') || name.endsWith('.test.mjs')) continue;
    copyFileSync(join(HERE, name), join(dir, name));
  }

  const target = join(dir, file);
  const source = readFileSync(target, 'utf8');
  const occurrences = source.split(from).length - 1;
  assert.equal(
    occurrences,
    count,
    `주입 대상 문자열이 ${file}에 ${occurrences}번 있다(기대 ${count}) — ` +
      '소스가 바뀌어 이 주입이 빗나갔다. 주입이 빗나가면 아래 검사는 통과하면서 아무것도 막지 못한다',
  );
  writeFileSync(target, source.split(from).join(to));

  const module = await import(pathToFileURL(join(dir, 'index.mjs')).href);
  return module.compute;
}

/** 3단계 몫이 실제로 생기는 예산. 그래야 주입이 결과를 바꿀 수 있다. */
const REQUEST = baseRequest({ profile: { monthly_capacity_krw: 4_500_000 } });
const FULL = baseRequest({ profile: { monthly_capacity_krw: 5_000_000 } });
/**
 * **한쪽 연금계좌가 막힌 상태.** 3단계 몫이 공제액에 섞이는 결함은 여기서만 드러난다 —
 * 두 계좌가 다 열려 있으면 IRP가 합산 한도의 나머지를 가져가 그 한도가 묶어 버리고,
 * 결함이 있어도 금액이 같다. 연금저축이 혼자 납입 한도까지 채워야 **단독 공제한도**가
 * 실제로 묶는 자리가 되고, 그것이 지난 회차에 잡은 결함의 모양이다.
 */
const IRP_BLOCKED = baseRequest({
  profile: { monthly_capacity_krw: 5_000_000 },
  accounts: { retirement_pension: { annuity_start_status: 'started' } },
});

const baselineOf = (response) => {
  assert.equal(response.ok, true, JSON.stringify(response.errors));
  return response.scenarios[0].plans[0];
};
const amount = (plan, account) =>
  plan.allocations.find((a) => a.account === account).annual_krw;

// ── 주입 1. ISA와 3단계의 순서를 뒤집는다 ────────────────────────────────────

test('주입 / ISA와 3단계의 순서를 뒤집으면 기본안의 ISA 배분이 줄어든다', async () => {
  // `PENSION_EXTRA_BEFORE_ISA`에 모든 안을 넣는다 = 소유자가 정한 순서를 뒤집는 것.
  const mutated = await mutatedCompute({
    file: 'constants.mjs',
    from: 'export const PENSION_EXTRA_BEFORE_ISA = new Set([PLAN.PENSION_BEFORE_ISA]);',
    to: 'export const PENSION_EXTRA_BEFORE_ISA = new Set(PLAN_ORDER);',
  });

  const before = baselineOf(compute(REQUEST, rulesets));
  const after = baselineOf(mutated(REQUEST, rulesets));

  assert.ok(
    amount(after, 'isa') < amount(before, 'isa'),
    '순서를 뒤집었는데 ISA 배분이 그대로다 — 순서가 결과를 정하고 있지 않다',
  );
  // **세액은 그대로다.** 그래서 세액만 보는 검사로는 이 뒤집힘을 절대 잡을 수 없고,
  // 얼린 표에 ISA 배분액을 함께 넣어 둔 것이 그 때문이다.
  assert.equal(
    after.deterministic_benefit.pension_credit_total_krw,
    before.deterministic_benefit.pension_credit_total_krw,
    '이 뒤집힘은 세액을 바꾸지 않는다 — 공제액만 보는 검사는 여기서 눈이 먼다',
  );
});

test('주입 / 뒤집힌 순서는 얼려 둔 표에 걸린다', async () => {
  const mutated = await mutatedCompute({
    file: 'constants.mjs',
    from: 'export const PENSION_EXTRA_BEFORE_ISA = new Set([PLAN.PENSION_BEFORE_ISA]);',
    to: 'export const PENSION_EXTRA_BEFORE_ISA = new Set(PLAN_ORDER);',
  });

  const { BASELINE_CREDIT_FREEZE, freezeCases } = await import('./baseline-credit-freeze.mjs');
  let caught = 0;
  for (const [index, { request }] of freezeCases().entries()) {
    const response = mutated(request, rulesets);
    if (!response.ok) continue;
    const plan = response.scenarios[0].plans[0];
    // 얼린 일곱 값 중 마지막이 ISA 배분액이다.
    if (amount(plan, 'isa') !== BASELINE_CREDIT_FREEZE[index][1][6]) caught += 1;
  }

  assert.ok(
    caught > 0,
    '순서를 뒤집었는데 얼린 표가 한 좌표도 걸리지 않는다 — 그 표에 ISA 배분액이 빠졌다는 뜻이다',
  );
});

test('주입 / ISA를 아예 뒤로 미루면 배분안이 하나로 뭉개진다', async () => {
  // 뒤집힌 순서에서는 기본안과 `pension_contribution_before_isa`가 같은 벡터가 되어
  // 합쳐진다. **선택지가 실제로 사라진다** — 순서가 두 안을 가르는 유일한 축임을
  // 반대 방향에서 확인하는 것이다.
  const mutated = await mutatedCompute({
    file: 'constants.mjs',
    from: 'export const PENSION_EXTRA_BEFORE_ISA = new Set([PLAN.PENSION_BEFORE_ISA]);',
    to: 'export const PENSION_EXTRA_BEFORE_ISA = new Set(PLAN_ORDER);',
  });

  const before = compute(REQUEST, rulesets).scenarios[0].plans.map((p) => p.plan_id);
  const after = mutated(REQUEST, rulesets).scenarios[0].plans.map((p) => p.plan_id);

  assert.ok(before.includes('pension_contribution_before_isa'), before.join(', '));
  assert.equal(
    after.includes('pension_contribution_before_isa'),
    false,
    '순서가 같아지면 두 안이 같은 벡터가 되어 합쳐져야 한다',
  );
});

// ── 주입 2. 3단계 몫을 공제액에 섞는다 ───────────────────────────────────────

test('주입 / 3단계 몫을 인정액에 섞으면 기본안의 공제액이 과대가 된다', async () => {
  // **지난 회차에 찾아낸 결함을 그대로 되살린다.** `counted` clamp를 지우면 공제 한도를
  // 넘겨 넣은 몫까지 인정액에 들어가고, 연금저축이 단독 한도를 넘기면서 공제액이 커진다.
  // D32로 그 경로가 **기본안에** 들어왔으므로 이제 대다수 사용자의 절세액이 틀린다.
  const mutated = await mutatedCompute({
    file: 'plans.mjs',
    from: 'const counted = Math.min(amount, creditRoom);',
    to: 'const counted = amount;',
  });

  const before = baselineOf(compute(IRP_BLOCKED, rulesets));
  const after = baselineOf(mutated(IRP_BLOCKED, rulesets));

  assert.ok(
    after.deterministic_benefit.credit_eligible_contribution_krw >
      before.deterministic_benefit.credit_eligible_contribution_krw,
    'clamp를 지웠는데 인정 납입액이 그대로다 — 이 주입이 겨눈 자리가 아니다',
  );
  assert.ok(
    after.deterministic_benefit.pension_credit_total_krw >
      before.deterministic_benefit.pension_credit_total_krw,
    '인정액이 늘었는데 공제액이 그대로일 수는 없다',
  );
  // 배분 벡터는 한 원도 안 바뀐다. **배분만 보는 검사는 이 결함에 눈이 먼다.**
  for (const account of ['retirement_pension', 'annuity_savings', 'isa']) {
    assert.equal(amount(after, account), amount(before, account), account);
  }
});

test('주입 / 섞인 공제액은 얼려 둔 표에 걸린다', async () => {
  const mutated = await mutatedCompute({
    file: 'plans.mjs',
    from: 'const counted = Math.min(amount, creditRoom);',
    to: 'const counted = amount;',
  });

  const { BASELINE_CREDIT_FREEZE, freezeCases } = await import('./baseline-credit-freeze.mjs');
  let caught = 0;
  for (const [index, { request }] of freezeCases().entries()) {
    const response = mutated(request, rulesets);
    if (!response.ok) continue;
    // 얼린 일곱 값 중 네 번째가 공제 합계다.
    const total = response.scenarios[0].plans[0].deterministic_benefit.pension_credit_total_krw;
    if (total !== BASELINE_CREDIT_FREEZE[index][1][3]) caught += 1;
  }

  assert.ok(
    caught > 0,
    '3단계 몫을 공제액에 섞었는데 얼린 표가 한 좌표도 걸리지 않는다 — 그 표는 아무것도 보고 있지 않다',
  );
});

// ── 주입 3. 3단계 몫을 인출이 어려운 계좌에 먼저 넣는다 ──────────────────────

test('주입 / 3단계 몫을 더 묶이는 계좌에 먼저 넣으면 I36이 문다', async () => {
  const mutated = await mutatedCompute({
    file: 'plans.mjs',
    from: 'const flexibleFirst = ctx.withdrawalOrder ?? pensionPart;',
    to: 'const flexibleFirst = [...(ctx.withdrawalOrder ?? pensionPart)].reverse();',
  });

  // **기본안으로는 이 주입을 더 이상 볼 수 없다**(D52 1번). 기본안 후보는 공제를 낳지
  // 않는 몫을 IRP에 아예 넣지 않으므로, 순서를 뒤집어도 그 몫은 연금저축에 남는다 —
  // **다른 규칙이 같은 결과를 지고 있어 주입이 가려진다.** 그러므로 그 규칙이 걸리지
  // 않는 안, 즉 기본안 후보가 아닌 안에서 본다. 검사를 완화한 것이 아니라 **주입이
  // 실제로 보이는 자리로 옮긴 것**이고, 기본안 쪽은 I44가 따로 잠근다.
  const untouched = (response) => {
    assert.equal(response.ok, true, JSON.stringify(response.errors));
    const plan = response.scenarios[0].plans.find((p) => p.plan_id === 'annuity_savings_first');
    assert.ok(plan !== undefined, '기본안 후보가 아닌 안이 응답에 없다');
    return plan;
  };

  // 그 안 하나만 요청한다 — 함께 요청하면 벡터가 같아질 때 합쳐져 사라진다.
  const request = baseRequest({
    profile: { monthly_capacity_krw: 5_000_000 },
    options: { plan_variants: ['annuity_savings_first'] },
  });
  const before = untouched(compute(request, rulesets));
  const after = untouched(mutated(request, rulesets));

  const withoutCreditAccounts = (plan) =>
    plan.non_quantified_effects
      .filter((e) => e.code === 'pension_contribution_without_credit')
      .map((e) => e.account);

  assert.deepStrictEqual(
    withoutCreditAccounts(before),
    ['annuity_savings'],
    '지금은 공제를 낳지 않는 몫이 인출이 자유로운 계좌에 있다',
  );
  assert.deepStrictEqual(
    withoutCreditAccounts(after),
    ['retirement_pension'],
    '순서를 뒤집었는데 그 몫이 옮겨 가지 않는다 — 인출 순서가 결과를 정하고 있지 않다',
  );
  // 세액은 그대로다. **대가 없이 더 묶이는 계좌를 고른 것**이고, 그래서 금액 검사로는
  // 잡히지 않는다. I36이 이 자리를 보는 유일한 검사다.
  assert.equal(
    after.deterministic_benefit.pension_credit_total_krw,
    before.deterministic_benefit.pension_credit_total_krw,
  );
});

// ── 주입 4·5. 월 환산 잔차를 잘못 얹는다 ─────────────────────────────────────
//
// 소유자가 신고한 것은 「도넛 가운데가 1원 모자란다」였고, 고친 방향은 **잔차를 한도
// 여유가 남은 갈래에 얹는 것**이다. 그 고침에는 틀릴 길이 정확히 둘 있다.
//
//   · 여유가 **없는** 계좌에 얹는다 → 그 계좌의 연간 납입이 납입 한도를 넘는다.
//   · 내림 대신 **반올림**한다 → 여러 계좌가 한꺼번에 올라 한도와 예산을 함께 넘는다.
//
// 둘 다 **과대 방향**이다. 아래 두 주입이 그 둘을 실제로 만들어 보이고, I12.1(b)(c)가
// 무는지 확인한다. 검사식은 불변식 테스트와 같은 문장을 여기 다시 적는다 —
// 주입된 엔진에 그 파일을 물릴 수 없기 때문이다.

/** 남은 납입 한도의 합과 예산이 정확히 같은 요청. 세 계좌가 전부 한도에 닿는다. */
function exactlyAtLimitsRequest() {
  const probe = compute(baseRequest({ profile: { monthly_capacity_krw: 10_000_000 } }), rulesets)
    .scenarios[0];
  const isaLimit = probe.limits.by_account.find((l) => l.account === 'isa')
    .contribution_limit_remaining_krw;
  const pensionLimit = probe.limits.pension_contribution_limit_remaining_krw;
  const months = 12;
  const ytd = (pensionLimit + isaLimit) % months;
  const budget = pensionLimit + isaLimit - ytd;

  return {
    months,
    pensionLimit: pensionLimit - ytd,
    isaLimit,
    request: baseRequest({
      profile: { monthly_capacity_krw: budget / months, months_remaining_in_tax_year: months },
      accounts: { annuity_savings: { ytd_contribution_krw: ytd } },
    }),
  };
}

const pensionAnnualized = (plan) =>
  plan.allocations
    .filter((a) => a.account !== 'isa')
    .reduce((sum, a) => sum + a.monthly_annualized_krw, 0);

test('주입 / 한도 검사를 지우면 잔차가 한도가 찬 계좌에 얹힌다', async () => {
  const mutated = await mutatedCompute({
    file: 'monthly.mjs',
    from: "if (part.poolId !== null && (headroom[part.poolId] ?? 0) < cost) continue;",
    to: 'if (false) continue;',
  });

  const { months, pensionLimit, isaLimit, request } = exactlyAtLimitsRequest();
  const before = baselineOf(compute(request, rulesets));
  const after = baselineOf(mutated(request, rulesets));

  // 지금은 얹을 곳이 없어 **모자라는 사실을 값으로 낸다.**
  assert.ok(before.monthly_unassigned_krw > 0, '이 요청에서는 얹을 곳이 없어야 한다');
  assert.ok(pensionAnnualized(before) <= pensionLimit, '지금은 한도를 넘지 않는다');

  // 주입된 엔진은 합을 맞추는 대신 **한도를 넘긴다.**
  assert.equal(after.monthly_unassigned_krw, 0, '검사를 지웠는데도 얹지 못했다 — 주입이 겨눈 자리가 아니다');
  const isaAfter = after.allocations.find((a) => a.account === 'isa');
  assert.ok(
    pensionAnnualized(after) > pensionLimit || isaAfter.monthly_annualized_krw > isaLimit,
    '한도 검사를 지웠는데 어느 한도도 넘지 않는다 — 그 검사는 아무것도 막고 있지 않았다',
  );

  // 연 배분과 공제액은 그대로다. **연 기준만 보는 검사는 이 결함에 눈이 먼다.**
  for (const account of ['retirement_pension', 'annuity_savings', 'isa']) {
    assert.equal(amount(after, account), amount(before, account), account);
  }
  assert.equal(
    after.deterministic_benefit.pension_credit_total_krw,
    before.deterministic_benefit.pension_credit_total_krw,
  );
  assert.equal(months, 12);
});

test('주입 / 내림을 반올림으로 바꾸면 예산과 한도를 함께 넘긴다', async () => {
  const mutated = await mutatedCompute({
    file: 'monthly.mjs',
    from: 'const floorMonthlyKrw = Math.floor(bucket.annualKrw / months);',
    to: 'const floorMonthlyKrw = Math.round(bucket.annualKrw / months);',
  });

  // (a) 예산을 넘는다. 연 배분 두 갈래의 나머지가 정확히 개월수의 절반이면 **둘 다**
  //     올라가는데, 올릴 수 있는 몫은 하나뿐이다. 기납입 6원이 그 상태를 만든다.
  const halfway = baseRequest({
    profile: { monthly_capacity_krw: 2_500_000, months_remaining_in_tax_year: 12 },
    accounts: { annuity_savings: { ytd_contribution_krw: 6 } },
  });
  const rounded = mutated(halfway, rulesets);
  const roundedPlan = baselineOf(rounded);
  const monthlyOf = (plan) => plan.allocations.reduce((sum, a) => sum + a.monthly_krw, 0);

  assert.ok(
    monthlyOf(roundedPlan) * 12 > rounded.echo.annual_budget_krw,
    '반올림했는데 예산을 넘지 않는다 — 이 요청은 이 주입을 시험하지 못한다',
  );
  const sound = compute(halfway, rulesets);
  assert.ok(
    monthlyOf(baselineOf(sound)) * 12 <= sound.echo.annual_budget_krw,
    '지금의 엔진은 예산을 넘지 않는다',
  );

  // (b) 납입 한도를 넘는다. 세 계좌가 한도에 닿아 있으면 1원이라도 올리는 순간 넘는다.
  const { pensionLimit, request } = exactlyAtLimitsRequest();
  assert.ok(
    pensionAnnualized(baselineOf(mutated(request, rulesets))) > pensionLimit,
    '반올림했는데 납입 한도를 넘지 않는다',
  );
  assert.ok(pensionAnnualized(baselineOf(compute(request, rulesets))) <= pensionLimit);
});

// ── 주입 6~8. 헤드라인 합계를 틀리게 만든다 (D38) ────────────────────────────
//
// 이번 회차가 지켜야 하는 것도 룰셋에 손잡이가 없다. **합계의 아래 끝이 확정된
// 세액공제액과 같다**는 항등식은 조문의 귀결이지만, 그것을 실제로 지키는 것은 코드
// 한 줄이고 그 줄이 틀려도 **금액이 전부 유효 범위 안에 남는다** — 어떤 자료형 검사에도
// 걸리지 않는다. 그래서 소스를 변형해 새 검사가 실제로 무는지 확인한다.
//
// 검사식은 불변식·골든 테스트와 같은 문장을 여기 다시 적는다(위 주입 4·5와 같은 이유).

/** 구간 분기를 밟는 요청 — 기본안이 ISA에 300만을 넣고, 소득 성격은 미확정이다. */
const COMPOSITE = baseRequest({
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
});

const planById = (response, planId) => {
  assert.equal(response.ok, true, JSON.stringify(response.errors));
  const plan = response.scenarios[0].plans.find((p) => p.plan_id === planId);
  assert.ok(plan, `${planId}이 응답에 없다`);
  return plan;
};

test('주입 / 구간의 아래 끝에 위 끝을 넣으면 항등식 검사가 문다', async () => {
  const mutated = await mutatedCompute({
    file: 'headline.mjs',
    from: 'lower_bound_krw: determinedCreditKrw + estimate.lower_bound_krw,',
    to: 'lower_bound_krw: determinedCreditKrw + estimate.upper_bound_krw,',
  });

  const before = planById(compute(COMPOSITE, rulesets), 'max_tax_credit');
  const after = planById(mutated(COMPOSITE, rulesets), 'max_tax_credit');
  const credit = before.deterministic_benefit.pension_credit_total_krw;

  // 지금은 아래 끝이 확정된 세액공제액과 같은 수다.
  assert.equal(before.headline_composite_total.lower_bound_krw, credit);
  // 주입된 엔진에서는 그렇지 않다 — **그리고 두 끝은 여전히 뒤집히지 않았고 금액도 양수라**
  // 자료형 검사·범위 검사는 전부 통과한다. I42의 항등식만이 이 자리를 본다.
  assert.notEqual(
    after.headline_composite_total.lower_bound_krw,
    credit,
    '아래 끝을 위 끝으로 바꿨는데 값이 그대로다 — 이 주입이 겨눈 자리가 아니다',
  );
  assert.ok(after.headline_composite_total.lower_bound_krw <= after.headline_composite_total.upper_bound_krw);
  assert.ok(after.headline_composite_total.lower_bound_krw > 0);

  // 세액공제액도 정산액도 한 원 안 바뀐다. **성분만 보는 검사는 이 결함에 눈이 먼다.**
  assert.equal(after.deterministic_benefit.pension_credit_total_krw, credit);
  assert.equal(
    after.assumption_based_isa_estimate.upper_bound_krw,
    before.assumption_based_isa_estimate.upper_bound_krw,
  );
});

test('주입 / ISA 배분 조건을 지우면 「합계 = 확정 성분」 좌표가 문다', async () => {
  const mutated = await mutatedCompute({
    file: 'headline.mjs',
    from: 'estimate.state === ISA_ESTIMATE_STATE.COMPUTED && isaAllocatedKrw > 0',
    to: 'estimate.state === ISA_ESTIMATE_STATE.COMPUTED',
  });

  // 이 안은 ISA에 한 푼도 넣지 않는데 계좌에는 기존 납입액이 있다. 조건을 지우면
  // **이 배분안이 만들지 않은 혜택**이 합계에 들어간다.
  const before = planById(compute(COMPOSITE, rulesets), 'pension_contribution_before_isa');
  const after = planById(mutated(COMPOSITE, rulesets), 'pension_contribution_before_isa');
  const credit = before.deterministic_benefit.pension_credit_total_krw;

  assert.equal(before.allocations.find((a) => a.account === 'isa').annual_krw, 0);
  assert.equal(before.headline_composite_total.upper_bound_krw, credit);
  assert.equal(before.headline_composite_total.includes_assumption_component, false);

  assert.equal(
    after.headline_composite_total.includes_assumption_component,
    true,
    '조건을 지웠는데 가정 성분이 들어오지 않는다 — 이 주입이 겨눈 자리가 아니다',
  );
  assert.ok(after.headline_composite_total.upper_bound_krw > credit);
  // 아래 끝은 여전히 세액공제액과 같다. **항등식만 보는 검사는 이 결함에 눈이 먼다** —
  // 그래서 「합계 = 확정 성분」 좌표를 골든으로 따로 얼려 둔다.
  assert.equal(after.headline_composite_total.lower_bound_krw, credit);
});

test('주입 / 합계에 분모나 기간을 붙이면 구조 검사가 문다', async () => {
  const withCeiling = await mutatedCompute({
    file: 'headline.mjs',
    from: 'has_statutory_ceiling: false,',
    to: 'has_statutory_ceiling: false, ceiling_krw: 0,',
    count: 2,
  });
  const headline = planById(withCeiling(COMPOSITE, rulesets), 'max_tax_credit')
    .headline_composite_total;
  assert.ok(
    Object.keys(headline).includes('ceiling_krw'),
    '분모를 넣었는데 응답에 나타나지 않는다 — 이 주입이 겨눈 자리가 아니다',
  );
  // 합계에 법정 상한이 없으므로 이 칸은 **무엇을 담아도 지어낸 분모다.** 금액 칸 목록을
  // 통째로 고정하는 검사만이 이 자리를 본다 — 값 검사는 0을 정상으로 본다.
  assert.notDeepStrictEqual(
    Object.keys(headline).filter((key) => key.endsWith('_krw')).sort(),
    [
      'assumption_component_krw',
      'determined_component_krw',
      'lower_bound_krw',
      'point_estimate_krw',
      'upper_bound_krw',
    ],
  );

  const annual = await mutatedCompute({
    file: 'headline.mjs',
    from: 'is_annual: false,',
    to: 'is_annual: true,',
    count: 2,
  });
  assert.equal(
    planById(annual(COMPOSITE, rulesets), 'max_tax_credit').headline_composite_total.is_annual,
    true,
    '연간 선언을 넣었는데 응답이 그대로다',
  );
});

// ── 주입 6. 상한을 하한처럼 다룬다 (D40) ─────────────────────────────────────
//
// **이 주입이 겨누는 것은 금액이 아니라 방향이다.** 세액 한도는 이제 그 사람의 확정된
// 한도가 아니라 **상한**이고, 그 성질에서 나오는 결론은 한쪽뿐이다 — 「상한이 자르면
// 실제로도 자른다」는 참이고 「상한이 자르지 않으면 실제로도 자르지 않는다」는 거짓이다.
// 구현이 그 비대칭을 잃으면 **금액은 전부 그대로인 채** 화면이 증명되지 않은 문장을
// 말하기 시작한다. 값 검사로는 잡히지 않는 결함이므로 여기서 소스를 뒤집어 확인한다.

/** 한도가 실제로 자르는 좌표. 자르지 않으면 아래 주입이 아무것도 뒤집지 못한다. */
const CAP_BINDING_REQUEST = baseRequest({
  profile: {
    current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
    monthly_capacity_krw: 5_000_000,
  },
});

const capOfPlan = (response) =>
  planById(response, 'max_tax_credit').deterministic_benefit.tax_liability_cap;

test('주입 / 한도를 상한이 아니라 하한으로 취급하면(min → max) 공제액이 자르기 전보다 커진다', async () => {
  const before = capOfPlan(compute(CAP_BINDING_REQUEST, rulesets));
  assert.equal(before.applied, true, '이 좌표에서 자르지 않으면 주입이 아무것도 보지 못한다');

  const flipped = await mutatedCompute({
    file: 'plans.mjs',
    from: 'const recognizedIncomeTaxExact = minExact(incomeTaxExact, capExact);',
    // `maxExact`로 바꾸면 되지만 그 이름은 `plans.mjs`가 들여오지 않는다 — 주입이
    // 참조 오류로 끝나면 아무것도 재지 못하므로, 이미 있는 이름으로 같은 뜻을 적는다.
    to: 'const recognizedIncomeTaxExact = cmpExact(incomeTaxExact, capExact) >= 0 ? incomeTaxExact : capExact;',
  });
  // (1) 자르던 좌표에서 **표시 금액이 자름을 잃는다.** 자름 표시(`applied`) 자체는
  //     정확값의 대소가 정하므로 이 주입으로 뒤집히지 않고(D46 1번 이후), 그래서 결과는
  //     **「잘렸다고 적으면서 한 원도 잘리지 않은」 상태**가 된다 — 불변식 I23이 무는 자리다.
  const bound = capOfPlan(flipped(CAP_BINDING_REQUEST, rulesets));
  assert.notEqual(
    bound.applied,
    bound.reduced_income_tax_krw > 0,
    '주입이 자름 표시와 잘린 금액을 어긋나게 하지 못했다 — I23이 물 자리가 없다',
  );

  // (2) 한도가 넉넉한 좌표에서는 인정 공제액이 **자르기 전 금액을 넘는다.** 조문이
  //     "없는 것으로 한다"고 한 금액을 넘어서는 값이 결과에 남는 것이고, 불변식 I22가
  //     무는 자리다.
  const ample = baseRequest({ profile: { monthly_capacity_krw: 5_000_000 } });
  const benefit = planById(flipped(ample, rulesets), 'max_tax_credit').deterministic_benefit;
  assert.ok(
    benefit.pension_credit_income_tax_krw > benefit.pension_credit_income_tax_before_cap_krw,
    '주입이 금액을 바꾸지 못했다 — 이 검사는 통과하면서 아무것도 증명하지 않는다',
  );
});

test('주입 / 「자르지 않았다」를 「걸리지 않는다」로 읽으면(부정 뒤집기) 증명 표시가 거짓이 된다', async () => {
  // 한도가 자르지 **않는** 요청. 여기서 `binds_provably`가 나오면 화면이
  // 「한도에 걸립니다」를 증명 없이 말하게 된다.
  const ample = baseRequest({ profile: { monthly_capacity_krw: 5_000_000 } });
  assert.equal(capOfPlan(compute(ample, rulesets)).binding_code, 'binding_not_determined');

  const flipped = await mutatedCompute({
    file: 'liability-cap.mjs',
    from: 'return applied && isUpperBound ? CAP_BINDING.PROVABLE : CAP_BINDING.NOT_DETERMINED;',
    to: 'return !applied && isUpperBound ? CAP_BINDING.PROVABLE : CAP_BINDING.NOT_DETERMINED;',
  });

  assert.equal(
    capOfPlan(flipped(ample, rulesets)).binding_code,
    'binds_provably',
    '주입이 표시를 뒤집지 못했다 — 이 자리를 무는 검사가 실제로는 없다는 뜻이다',
  );
  // 뒤집힌 상태에서 자르는 좌표는 반대로 증명을 잃는다. 양쪽 방향이 다 움직여야
  // 이 값이 실제로 두 사실을 가르고 있다는 것이 확인된다.
  assert.equal(capOfPlan(flipped(CAP_BINDING_REQUEST, rulesets)).binding_code, 'binding_not_determined');
});

test('주입 / 근로소득세액공제 차감을 빼면 한도가 검산 좌표에서 어긋난다', async () => {
  // **관리자가 조문으로 검산한 좌표가 이 단계를 실제로 재는지 본다.** 4단계를 빼면
  // 한도가 「산출세액 그 자체」가 되어 더 커지고, 상한이 더 헐거워진다 — 과대 방향이다.
  const withoutStep = await mutatedCompute({
    file: 'liability-cap.mjs',
    from: 'const capExact = clampExactToZero(subExact(computedTax, wageCredit));',
    to: 'const capExact = clampExactToZero(computedTax);',
  });

  const scenario = withoutStep(CAP_BINDING_REQUEST, rulesets).scenarios[0];
  assert.notEqual(
    scenario.pension_credit_tax_liability_cap.cap_krw,
    CAP_COORDINATES.BINDS.cap_krw,
    '4단계를 빼도 검산 좌표가 그대로다 — 골든 좌표가 그 단계를 재지 않고 있다',
  );
  assert.ok(
    scenario.pension_credit_tax_liability_cap.cap_krw > CAP_COORDINATES.BINDS.cap_krw,
    '공제를 덜 빼면 한도는 올라간다 — 방향이 반대로 나왔다면 산식이 뒤집힌 것이다',
  );
});

// ── 주입 4-B. 원 미만 끝수 — 단계의 순서와 자리 (D46 1번) ────────────────────
//
// **룰셋 변형으로는 이 둘을 잡지 못한다.** 룰셋이 정하는 것은 「어느 단계에서 얼마 단위로
// 버리는가」까지이고, **엔진이 그 단계에 어느 값을 들고 서는가는 코드 한 줄**이다. 그 한 줄이
// 되돌아가면 과세표준이 조문보다 1원 커지고 `applied`가 뒤집힌다 — 검증 20절이 찾은 결함이
// 정확히 이 형태였고, 금액으로는 1원이라 눈으로는 지나친다.

/** §47②가 물어 자름이 일어나는 좌표. 1원이 boolean을 가르는 자리다. */
const ONE_WON_REQUEST = baseRequest({
  profile: {
    birth_date: '1986-06-15',
    current_year_total_salary_krw: CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw,
    monthly_capacity_krw: 750_000,
    months_remaining_in_tax_year: 12,
  },
});

test('주입 / 근로소득공제를 먼저 버리고 빼면 과세표준이 1원 커지고 자름이 사라진다', async () => {
  const before = capOfPlan(compute(ONE_WON_REQUEST, rulesets));
  assert.equal(before.applied, true, '이 좌표에서 자르지 않으면 주입이 아무것도 보지 못한다');
  assert.equal(before.cap_krw, CAP_COORDINATES.BINDS_BY_ONE_WON.cap_krw);

  // **조문이 지목하지 않은 자리에 절사를 하나 더 만든다.** 표시 규약을 중간값에 걸면
  // 되고, 그것이 20차 이전 엔진이 하던 일이다.
  const flooredFirst = await mutatedCompute({
    file: 'liability-cap.mjs',
    from: 'const wageIncome = subExact(exactOf(totalSalary), wageDeduction);',
    to: 'const wageIncome = subExact(exactOf(totalSalary), rounding.convention(ROUNDING_STAGE.DISPLAYED, wageDeduction));',
  });

  const scenario = flooredFirst(ONE_WON_REQUEST, rulesets).scenarios[0];
  const cap = scenario.pension_credit_tax_liability_cap;
  // 과세표준이 정확히 1원 크다 — 20.3절의 항등식 그대로다.
  assert.equal(cap.tax_base_krw, 22_272_325);
  assert.equal(cap.cap_krw, 1_350_000);
  // **그리고 boolean이 뒤집힌다.** 화면은 D37의 문장을 잃는다.
  assert.equal(
    capOfPlan(flooredFirst(ONE_WON_REQUEST, rulesets)).applied,
    false,
    '주입이 자름을 없애지 못했다 — 이 좌표가 그 단계를 재지 않고 있다',
  );
});

test('주입 / 조문이 정한 자리에서 우리 규약의 손잡이를 쓰면 값을 내지 않고 멈춘다', async () => {
  // `determined_by_law`가 `true`인 단계를 `convention()`으로 부르는 것 —
  // **조문 자리와 우리 자리를 뒤섞는 주입**이다. 값을 지어내면 안 되는 자리다.
  const mixed = await mutatedCompute({
    file: 'liability-cap.mjs',
    from: '  const taxBase = rounding.statutory(',
    to: '  const taxBase = rounding.convention(',
  });

  const response = mixed(ONE_WON_REQUEST, rulesets);
  assert.equal(response.ok, false, '두 자리를 섞었는데 계산이 끝났다 — 구분이 값에 매여 있지 않다');
  assert.ok(response.errors.some((e) => e.code === 'rule_missing'));
});

test('주입 / 표시 자리에서 조문 단계를 부르면 멈춘다 — 반대 방향도 같다', async () => {
  const mixed = await mutatedCompute({
    file: 'liability-cap.mjs',
    from: 'const display = (exact) => exactToInteger(rounding.convention(ROUNDING_STAGE.DISPLAYED, exact));',
    to: 'const display = (exact) => exactToInteger(rounding.convention(ROUNDING_STAGE.TAX_BASE, exact));',
  });

  const response = mixed(ONE_WON_REQUEST, rulesets);
  assert.equal(response.ok, false, '표시 금액을 조문 단계로 만들었는데 계산이 끝났다');
  assert.ok(response.errors.some((e) => e.code === 'rule_missing'));
});

// ── 주입 5. 미정을 배제로 옮긴다 (D44) ───────────────────────────────────────
//
// **룰셋 변형으로는 이 자리를 잡지 못한다.** 룰셋이 정하는 것은 「이 분기의 결론이
// 미정이다」까지이고, **미정을 어떻게 다루는지는 엔진 한 줄**이다. 그 한 줄이 배제 쪽으로
// 넘어가면 조문상 자격이 확실한 사업소득자가 스스로 드러나지 않는 방식으로 막힌다 —
// 화면이 「불가」라고 했으므로 그 사용자는 확인하러 가지도 않는다(D44 판정 1).

/** 총급여 0 · 합산소득 있음. 미정 분기가 걸리는 좌표이고 소유자 케이스 8이 여기다. */
const UNDETERMINED = baseRequest({
  profile: {
    current_year_total_salary_krw: 0,
    has_non_wage_global_income_current_year: true,
    current_year_global_income_krw: 80_000_000,
    monthly_capacity_krw: 1_000_000,
  },
});

const irpOf = (response) => {
  assert.equal(response.ok, true, JSON.stringify(response.errors));
  return response.scenarios[0].account_eligibility.find((e) => e.account === 'retirement_pension');
};

test('주입 / 미정을 배제로 다루면 프리랜서의 IRP가 사라진다', async () => {
  const excludesUndetermined = await mutatedCompute({
    file: 'statutory-eligibility.mjs',
    from: 'const excluded = branch.outcome_code === IRP_OUTCOME.NOT_ELIGIBLE;',
    to: 'const excluded = branch.outcome_code !== IRP_OUTCOME.ELIGIBLE;',
  });

  const before = irpOf(compute(UNDETERMINED, rulesets));
  assert.equal(before.eligible, true);
  assert.ok(amount(baselineOf(compute(UNDETERMINED, rulesets)), 'retirement_pension') > 0);

  const after = irpOf(excludesUndetermined(UNDETERMINED, rulesets));
  assert.equal(after.eligible, false, '미정을 배제로 옮겼는데 자격이 그대로다 — 그 갈래가 죽어 있다');
  assert.equal(
    amount(baselineOf(excludesUndetermined(UNDETERMINED, rulesets)), 'retirement_pension'),
    0,
    '자격을 뺐는데 배분이 그대로다 — 자격이 배분을 정하고 있지 않다',
  );
  // **결론 코드는 그대로 미정이다.** 그래서 코드만 보는 검사는 이 뒤집힘을 못 잡고,
  // `eligible`과 배분액을 함께 보는 검사만 잡는다. 소유자 케이스 8이 그 자리다.
  assert.equal(after.determination_code, 'irp_eligibility_undetermined');
});

test('주입 / 배제 분기를 통과시키면 무소득자에게 IRP가 다시 나타난다', async () => {
  const neverExcludes = await mutatedCompute({
    file: 'statutory-eligibility.mjs',
    from: 'const excluded = branch.outcome_code === IRP_OUTCOME.NOT_ELIGIBLE;',
    to: 'const excluded = false;',
  });

  const noIncome = baseRequest({
    profile: {
      current_year_total_salary_krw: 0,
      has_non_wage_global_income_current_year: false,
      monthly_capacity_krw: 1_000_000,
    },
  });

  assert.equal(amount(baselineOf(compute(noIncome, rulesets)), 'retirement_pension'), 0);
  assert.equal(irpOf(neverExcludes(noIncome, rulesets)).eligible, true);
});

test('주입 / 세액공제 요건을 무시하면 요건이 서지 않는 사람에게 공제액이 되살아난다', async () => {
  // **1단계를 건너뛰는 구현**을 만든다. 오늘의 좌표에서는 산출세액이 0이라 최종 공제액은
  // 여전히 0이지만, **자르기 전 금액**과 인정액이 되살아나고 배분 순서가 바뀐다 —
  // 「잘렸다」와 「요건이 서지 않는다」를 가르는 값이 정확히 그것들이다.
  const ignoresRequirement = await mutatedCompute({
    file: 'plans.mjs',
    from: 'if (!ctx.creditEligibility.requirement_met) return 0;',
    to: 'if (false) return 0;',
  });

  const noIncome = baseRequest({
    profile: {
      current_year_total_salary_krw: 0,
      has_non_wage_global_income_current_year: false,
      monthly_capacity_krw: 1_000_000,
    },
  });

  const before = baselineOf(compute(noIncome, rulesets)).deterministic_benefit;
  assert.equal(before.pension_credit_total_before_cap_krw, 0);
  assert.equal(before.credit_eligible_contribution_krw, 0);
  assert.equal(before.tax_liability_cap.applied, false);

  const after = baselineOf(ignoresRequirement(noIncome, rulesets)).deterministic_benefit;
  assert.ok(
    after.pension_credit_total_before_cap_krw > 0,
    '요건 검사를 지웠는데 자르기 전 금액이 그대로 0이다 — 그 검사가 아무것도 하고 있지 않다',
  );
  assert.equal(
    after.tax_liability_cap.applied,
    true,
    '요건을 무시하면 그 0은 「한도가 잘랐다」로 나온다 — 이것이 우리가 갈라낸 두 경로다',
  );
});

// ── 주입 4-C. 트림의 기준을 표시 금액에서 정확값으로 되돌린다 (D53 2번) ───────
//
// **관리자가 D52 후속에 「그 1원이 실제로 공제를 낳는다」고 적었고 그것이 거짓이었다.**
// 정확값 기준의 탐색은 세액 한도의 **소수부**를 「낳았다」로 세고, 그 소수부는
// `tax_credit`에도 `tax_credit_before_cap`에도 나타나지 않는다. 그래서 사용자는
// **어느 화면에도 안 나타나는 것**을 대가로 중도인출이 제한되는 계좌에 돈을 넣게 된다.
//
// 되돌리는 주입이 무는지를 여기서 확인한다. 되돌린 구현은 **기본 조건에서 옳은 답을
// 낸다** — 끝수가 없는 한도(GC-32d 좌표)에서는 두 기준이 같은 수를 낸다. 그래서
// 경계 하나만 보는 검사로는 잡히지 않는다.

/** 한도에 **끝수가 있으면서 무는** 좌표. 두 기준이 갈리는 자리는 여기뿐이다. */
const FRACTIONAL_CAP_REQUEST = baseRequest({
  profile: {
    birth_date: '1986-06-15',
    current_year_total_salary_krw: CAP_COORDINATES.BINDS_BY_ONE_WON.total_salary_krw,
    monthly_capacity_krw: 750_000,
    months_remaining_in_tax_year: 12,
  },
});

test('주입 / 트림 기준을 정확값으로 되돌리면 표시 금액을 한 원도 못 올리는 IRP가 되살아난다', async () => {
  const exactBased = await mutatedCompute({
    file: 'plans.mjs',
    from: '      return ctx.rounding.display(recognized) + ctx.rounding.displayLocal(localExact);',
    // 정확값을 비교 가능한 하나의 수로 만든다. 표시 단계를 건너뛰는 것이 이 결함의 전부다.
    // `exact.mjs`의 정확값은 `{ n, d }`(BigInt)다. 크기가 100만 원대이고 분모가
    // 작아 double로 옮겨도 순서가 보존된다 — 되돌린 구현과 순서가 같은 함수다.
    to: '      return Number(recognized.n) / Number(recognized.d);',
  });

  const before = baselineOf(compute(FRACTIONAL_CAP_REQUEST, rulesets));
  const after = baselineOf(exactBased(FRACTIONAL_CAP_REQUEST, rulesets));

  // **되돌린 구현은 IRP를 6원 더 묶는다.**
  assert.equal(amount(before, 'retirement_pension'), 2_999_994);
  assert.equal(amount(after, 'retirement_pension'), 3_000_000);

  // **그리고 그 6원이 낳는 표시 금액은 0원이다.** 소득세분도 지방세분도 합계도 같다.
  const creditOf = (plan) => [
    plan.deterministic_benefit.pension_credit_income_tax_krw,
    plan.deterministic_benefit.pension_credit_local_tax_krw,
    plan.deterministic_benefit.pension_credit_total_krw,
  ];
  assert.deepStrictEqual(
    creditOf(after),
    creditOf(before),
    '되돌린 구현이 표시 금액을 실제로 올렸다 — 그러면 이 회차의 전제가 거짓이다',
  );

  // 잃는 것은 값으로 남는다 — 그 6원은 중도인출이 제한되는 계좌에 묶인다.
  assert.equal(
    before.allocations.find((a) => a.account === 'retirement_pension').limited_by,
    'no_additional_tax_credit',
  );
  assert.equal(amount(before, 'isa'), 6, '잘라 낸 6원이 사라졌다 — 다른 계좌로 가야 한다');
});

test('주입 / 트림 기준을 정확값으로 되돌려도 끝수 없는 한도에서는 같은 답이다 — 그래서 좌표가 필요하다', async () => {
  // **이 시험이 위 시험의 좌표를 정당화한다.** 되돌린 구현이 아무 데서나 갈리면
  // 좌표를 고를 이유가 없다. 실제로는 **한도에 끝수가 있어야만** 갈린다.
  const exactBased = await mutatedCompute({
    file: 'plans.mjs',
    from: '      return ctx.rounding.display(recognized) + ctx.rounding.displayLocal(localExact);',
    // `exact.mjs`의 정확값은 `{ n, d }`(BigInt)다. 크기가 100만 원대이고 분모가
    // 작아 double로 옮겨도 순서가 보존된다 — 되돌린 구현과 순서가 같은 함수다.
    to: '      return Number(recognized.n) / Number(recognized.d);',
  });

  // GC-32d의 좌표 — §59②의 8/1000까지 정수로 떨어져 한도에 끝수가 없다.
  const wholeCap = baseRequest({
    profile: {
      birth_date: '1986-06-15',
      current_year_total_salary_krw: 34_142_000,
      monthly_capacity_krw: 750_000,
      months_remaining_in_tax_year: 12,
    },
  });

  assert.equal(
    amount(baselineOf(exactBased(wholeCap, rulesets)), 'retirement_pension'),
    amount(baselineOf(compute(wholeCap, rulesets)), 'retirement_pension'),
  );
});

// ── 주입 4-D. 의무가입기간 예외를 지운다 (D53 1번) ────────────────────────────
//
// **관리자가 D52 후속으로 판정해 놓고 계약에 옮기지 않은 자리다.** 남은 의무가입기간이
// 0이면 조특법 §91조의18⑦의 추징 요건("3년이 되는 날 전 해지")이 성립할 수 없고,
// 성립하지 않는 불이익은 배분을 비울 근거가 되지 못한다. **경고를 끄는 자리(8.5절)에서는
// 그 사용자를 이미 보고 있었고 배분을 비우는 자리에서만 안 보고 있었다.**

/** GC-21·GC-30의 형태 — 시점은 `within_isa_lock_in`인데 의무가입기간이 이미 지났다. */
const ELAPSED_LOCK_IN_REQUEST = baseRequest({
  profile: {
    birth_date: '1986-06-15',
    current_year_total_salary_krw: 45_000_000,
    prior_year_total_salary_krw: 45_000_000,
    fund_use_horizon: 'within_isa_lock_in',
    monthly_capacity_krw: 1_000_000,
    months_remaining_in_tax_year: 12,
  },
  accounts: {
    isa: {
      account_type: 'low_income',
      cumulative_contribution_krw: 20_000_000,
      years_since_opening: 3,
    },
  },
});

test('주입 / 의무가입기간 예외를 지우면 추징이 성립하지 않는 사용자의 ISA가 다시 비워진다', async () => {
  const noException = await mutatedCompute({
    file: 'fund-use-horizon.mjs',
    from: '  const isaPenaltyStands = isaLockInYearsRemaining > 0;',
    to: '  const isaPenaltyStands = true;',
  });

  const before = baselineOf(compute(ELAPSED_LOCK_IN_REQUEST, rulesets));
  const after = baselineOf(noException(ELAPSED_LOCK_IN_REQUEST, rulesets));

  assert.equal(amount(before, 'isa'), 12_000_000, '예외가 적용되면 ISA가 예산 전액을 받는다');
  assert.equal(amount(after, 'isa'), 0, '주입이 결과를 바꾸지 못했다 — 예외가 값에 매여 있지 않다');

  // **그리고 화면이 그 사용자에게 댈 근거가 없어진다.** 배분을 비운 이유가 시점이라고
  // 나가는데, 같은 응답의 경고 조건은 그 불이익이 성립하지 않는다고 말한다.
  assert.equal(
    after.allocations.find((a) => a.account === 'isa').limited_by,
    'fund_use_horizon',
  );
  assert.equal(
    after.unallocated_breakdown.reason_code,
    'no_account_beneficial_within_fund_use_horizon',
  );
  assert.equal(
    before.unallocated_annual_krw,
    0,
    '예외가 적용되면 미배분이 없다 — 이 대비가 이 주입의 무게다',
  );
});

test('주입 / 예외를 연금계좌까지 넓히면 55세 요건이 사라진다 — 예외가 ISA에만 걸린다', async () => {
  // **반대 방향의 주입이다.** D53 1번은 ISA만 살린다 — 55세 전 인출 페널티는
  // 의무가입기간과 무관하게 성립하므로 연금 두 계좌는 그대로 비워져야 한다.
  const tooWide = await mutatedCompute({
    file: 'fund-use-horizon.mjs',
    from: '      [ACCOUNT.PENSION]: true,\n      [ACCOUNT.ANNUITY]: true,',
    to: '      [ACCOUNT.PENSION]: isaPenaltyStands,\n      [ACCOUNT.ANNUITY]: isaPenaltyStands,',
  });

  const before = baselineOf(compute(ELAPSED_LOCK_IN_REQUEST, rulesets));
  const after = baselineOf(tooWide(ELAPSED_LOCK_IN_REQUEST, rulesets));

  assert.equal(amount(before, 'retirement_pension'), 0);
  assert.equal(amount(before, 'annuity_savings'), 0);
  assert.ok(
    amount(after, 'retirement_pension') + amount(after, 'annuity_savings') > 0,
    '주입이 결과를 바꾸지 못했다 — 연금 쪽 판정이 값에 매여 있지 않다',
  );
});

// ── 주입 4-E. 목적 없이 IRP만 더 묶는 안을 다시 선택지로 낸다 (D53 3번) ──────

test('주입 / 지배 판정을 지우면 절세액이 같은데 IRP만 더 묶는 안이 선택지로 돌아온다', async () => {
  const noDominance = await mutatedCompute({
    file: 'plans.mjs',
    from: '    if (kept.some((other) => dominatedByIrpLock(result, benefit, other))) continue;',
    to: '    if (false) continue;',
  });

  // 세액 한도가 0인 좌표 — **네 안의 절세액이 전부 0**이라 「목적이 절세」일 수 없다.
  const capZero = baseRequest({
    profile: {
      birth_date: '1986-06-15',
      current_year_total_salary_krw: CAP_COORDINATES.ZERO_EXACT.total_salary_krw,
      monthly_capacity_krw: 750_000,
      months_remaining_in_tax_year: 12,
    },
  });

  const kept = compute(capZero, rulesets).scenarios[0].plans;
  const restored = noDominance(capZero, rulesets).scenarios[0].plans;

  assert.ok(restored.length > kept.length, '주입이 안을 되살리지 못했다 — 지배 판정이 죽어 있다');

  const back = restored.find((plan) => !kept.some((k) => k.plan_id === plan.plan_id));
  const baseline = kept[0];
  assert.equal(
    back.deterministic_benefit.pension_credit_total_krw,
    baseline.deterministic_benefit.pension_credit_total_krw,
    '되살아난 안의 절세액이 기본안과 다르면 이 주입이 겨눈 형태가 아니다',
  );
  assert.ok(
    amount(back, 'retirement_pension') > amount(baseline, 'retirement_pension'),
    '되살아난 안이 IRP를 더 묶지 않으면 이 주입이 겨눈 형태가 아니다',
  );
});

// ── 주입 4-F. 이월 판정의 자를 표시 금액에서 정확값으로 되돌린다 (D54) ────────
//
// **이 주입은 금액을 한 원도 바꾸지 않는다.** 배분도 세액공제액도 그대로이고 뒤집히는
// 것은 참·거짓 한 칸뿐이다. 그래서 **금액을 보는 어떤 검사에도 걸리지 않는다** — 이
// 저장소가 반복해 밟은 형태이고(값은 다 유효 범위 안인데 화면 문장이 거짓이 된다),
// 되돌린 구현은 실제로 `13.0.0`까지의 코드다.
//
// 되돌리면 **인출을 의제할 대상이 계좌에 없는 사용자**에게 「납입액을 이후 과세기간으로
// 넘길 수 있습니다」가 나간다. 원 미만의 연금보험료를 「가장 먼저 인출하여 다시 납입한
// 것으로 본다」는 처분은 실행될 수 없으므로, 그 안내는 사용자를 없는 절차로 보낸다.

/** 정확값 초과분이 1원에 못 미치는 좌표. 두 자가 갈리는 자리는 여기다. */
const SUB_WON_EXCESS_REQUEST = baseRequest({
  profile: {
    birth_date: '1986-06-15',
    current_year_total_salary_krw: 24_795_208,
    monthly_capacity_krw: 2_666_667,
    months_remaining_in_tax_year: 1,
  },
});

/** 응답에서 금액으로 나가는 것 전부. 주입이 금액을 건드렸는지 보는 자다. */
const amountsOf = (plan) => ({
  allocations: plan.allocations.map((a) => [a.account, a.annual_krw, a.monthly_krw]),
  credit: [
    plan.deterministic_benefit.pension_credit_income_tax_krw,
    plan.deterministic_benefit.pension_credit_local_tax_krw,
    plan.deterministic_benefit.pension_credit_total_krw,
    plan.deterministic_benefit.pension_credit_income_tax_before_cap_krw,
    plan.deterministic_benefit.pension_credit_local_tax_before_cap_krw,
    plan.deterministic_benefit.pension_credit_total_before_cap_krw,
    plan.deterministic_benefit.credit_eligible_contribution_krw,
  ],
  cap: [
    plan.deterministic_benefit.tax_liability_cap.cap_krw,
    plan.deterministic_benefit.tax_liability_cap.reduced_income_tax_krw,
    plan.deterministic_benefit.tax_liability_cap.reduced_local_tax_krw,
    plan.deterministic_benefit.tax_liability_cap.reduced_total_krw,
    plan.deterministic_benefit.tax_liability_cap.threshold_income_tax_krw,
  ],
});

test('주입 / 이월 판정을 정확값(applied)으로 되돌리면 밀려난 납입액이 없는 사람에게 이월 안내가 되살아난다', async () => {
  const exactBased = await mutatedCompute({
    file: 'plans.mjs',
    // `13.0.0`까지의 코드 그대로다 — 두 뜻을 한 값으로 쓰던 자리.
    from: 'const carryoverAvailable = reducedIncomeTax > 0;',
    to: 'const carryoverAvailable = applied;',
  });

  const before = baselineOf(compute(SUB_WON_EXCESS_REQUEST, rulesets));
  const after = baselineOf(exactBased(SUB_WON_EXCESS_REQUEST, rulesets));

  const capBefore = before.deterministic_benefit.tax_liability_cap;
  const capAfter = after.deterministic_benefit.tax_liability_cap;

  // 갈리는 자리인지부터 확인한다 — 한도가 물었는데 표시로는 한 원도 안 줄었다.
  assert.equal(capBefore.applied, true);
  assert.equal(capBefore.reduced_total_krw, 0);

  assert.equal(capBefore.contribution_carryover_available, false);
  assert.equal(
    capAfter.contribution_carryover_available,
    true,
    '주입이 판정을 뒤집지 못했다 — 이 자리는 이미 정확값을 쓰고 있거나 주입이 빗나갔다',
  );

  // **되살아나는 것은 한 칸이 아니다.** 조건 둘과 근거 규칙이 함께 따라 나간다.
  assert.equal(capAfter.carryover_shares_future_year_credit_limit, true);
  assert.equal(capAfter.carryover_requires_application, true);
  assert.ok(capAfter.basis_rule_ids.includes('pension.credit.unused.contribution_carryover'));

  // **그리고 금액은 한 원도 움직이지 않는다.** 이것이 이 주입의 요점이다 — 금액을 보는
  // 검사로는 잡히지 않으므로 이 칸을 값으로 못 박아 두지 않으면 아무도 보지 않는다.
  assert.deepStrictEqual(
    amountsOf(after),
    amountsOf(before),
    '주입이 금액을 바꿨다 — 그러면 이 주입이 겨눈 형태가 아니다',
  );
});

test('주입 / 되돌려도 표시로 잘리는 좌표에서는 같은 답이다 — 그래서 좌표가 필요하다', async () => {
  // **위 시험의 좌표를 정당화한다.** 되돌린 구현은 대부분의 자리에서 옳은 답을 낸다 —
  // 표시로 1원이라도 잘리면 두 자가 같은 값을 낸다. 경계 하나만 보는 검사로는 못 잡는다.
  const exactBased = await mutatedCompute({
    file: 'plans.mjs',
    from: 'const carryoverAvailable = reducedIncomeTax > 0;',
    to: 'const carryoverAvailable = applied;',
  });

  const binds = baseRequest({
    profile: {
      birth_date: '1986-06-15',
      current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
      monthly_capacity_krw: 750_000,
      months_remaining_in_tax_year: 12,
    },
  });

  const before = baselineOf(compute(binds, rulesets)).deterministic_benefit.tax_liability_cap;
  const after = baselineOf(exactBased(binds, rulesets)).deterministic_benefit.tax_liability_cap;

  assert.ok(before.reduced_income_tax_krw > 0, '표시로 잘리지 않으면 대조군이 아니다');
  assert.equal(before.contribution_carryover_available, true);
  assert.equal(after.contribution_carryover_available, before.contribution_carryover_available);
});
