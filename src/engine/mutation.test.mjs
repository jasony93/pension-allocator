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
import { baseRequest, loadRulesets } from './test-helpers.mjs';

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

  const before = baselineOf(compute(FULL, rulesets));
  const after = baselineOf(mutated(FULL, rulesets));

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
