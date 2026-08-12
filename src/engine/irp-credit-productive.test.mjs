// **아무것도 낳지 않는 IRP 배분을 기본안이 내지 않는다** (D52 1번).
//
// 소유자가 짚은 것 — 결정세액이 낮아 세액 한도가 작으면, 연금저축만으로 그 한도를 이미
// 넘긴다. 그 위에 IRP를 채우면 **세액공제를 한 원도 더 낳지 않으면서 중도인출 제한만
// 진다**(`pension.withdrawal.midterm_restriction` — 연금저축은 그 제한을 받지 않는다).
// 얻는 것이 0이고 잃는 것이 0보다 크므로 **엄격하게 나쁘다.**
//
// **이 파일이 잠그는 것은 경계의 양쪽이다.** 아래에서는 IRP가 0이고 위에서는 IRP가
// 여전히 배분된다 — 한쪽만 잠그면 「전부 0으로 만드는」 구현도 통과한다.
//
// **그리고 그 경계가 총급여가 아니라는 것**을 같은 총급여에서 결과를 갈라 보인다.
// 총급여로 자르는 구현은 아래 두 시험 중 하나에서 반드시 걸린다.
//
// **여기 세법 수치는 하나도 없다.** 좌표는 관리자가 조문으로 검산해
// `test-helpers.mjs`에 둔 것이고(D40), 한도·비율은 룰셋에서 읽는다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compute } from './index.mjs';
import {
  CAP_COORDINATES,
  CONFIRMED_FILE,
  allocationOf,
  baseRequest,
  loadRulesets,
  scenarioOf,
} from './test-helpers.mjs';

const rulesets = loadRulesets();
const HERE = dirname(fileURLToPath(import.meta.url));

const confirmedRule = (id) => {
  const found = rulesets[CONFIRMED_FILE].rules.find((r) => r.id === id);
  if (!found) throw new Error(`룰셋에 규칙이 없다: ${id}`);
  return found;
};

const ANNUITY_LIMIT = confirmedRule('pension.credit.limit.annuity_savings').value.amount_krw;
const COMBINED_LIMIT = confirmedRule('pension.credit.limit.combined').value.amount_krw;
const MONTHS = 12;

/** 연금 합산 공제한도를 다 채울 수 있는 예산. 그래야 IRP가 배분될 자리가 있다. */
const FULL_PENSION_MONTHLY = COMBINED_LIMIT / MONTHS;

function baselineAt(salary, overrides = {}) {
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          current_year_total_salary_krw: salary,
          prior_year_total_salary_krw: salary,
          monthly_capacity_krw: FULL_PENSION_MONTHLY,
          ...(overrides.profile ?? {}),
        },
        ...(overrides.accounts ? { accounts: overrides.accounts } : {}),
        ...(overrides.options ? { options: overrides.options } : {}),
      }),
      rulesets,
    ),
  );
  const baseline = scenario.plans.find((plan) => plan.is_baseline);
  assert.ok(baseline !== undefined, '기본안이 없다');
  return { scenario, baseline };
}

const irpOf = (plan) => allocationOf(plan, 'retirement_pension').annual_krw;
const creditOf = (plan) => plan.deterministic_benefit.pension_credit_total_krw;

/**
 * **IRP를 자르지 않는 안**의 배분. `annuity_savings_first`는 기본안 후보가 아니라
 * 트림이 걸리지 않으므로, 「잘라 낸 몫이 실제로 무엇을 낳았는가」의 비교 대상이 된다.
 *
 * **응답 하나에서 두 안을 꺼내지 않는다** (D53 3번). 표시 세액공제액이 같으면서 IRP만
 * 더 묶인 안은 이제 응답에서 빠지므로, 그 안을 응답에서 찾는 시험은 **비교 대상이
 * 사라졌다는 이유로 조용히 아무것도 재지 않게 된다.** 그래서 그 안만 따로 요청한다.
 */
function untouchedAt(salary, overrides = {}) {
  return baselineAt(salary, {
    ...overrides,
    options: { plan_variants: ['annuity_savings_first'] },
  }).baseline;
}

/** IRP 계좌를 닫아 **IRP가 0인 상태**의 세액공제액을 얻는다. 한도는 총급여가 정하므로 그대로다. */
function creditWithoutIrpAt(salary) {
  return creditOf(
    baselineAt(salary, {
      accounts: { retirement_pension: { annuity_start_status: 'started' } },
    }).baseline,
  );
}

// ── 경계의 아래 ──────────────────────────────────────────────────────────────

test('경계 아래 — 연금저축만으로 한도를 넘기면 IRP를 한 원도 배분하지 않는다', () => {
  const { scenario, baseline } = baselineAt(CAP_COORDINATES.BINDS.total_salary_krw);

  // 전제 — 이 좌표의 한도가 연금저축 자기 한도의 공제액보다 작다.
  const cap = scenario.pension_credit_tax_liability_cap.cap_krw;
  const rate = scenario.pension_credit_ceiling.income_tax_rate;
  assert.ok(
    cap < Math.floor(ANNUITY_LIMIT * rate),
    '연금저축만으로 한도를 넘기지 못하는 좌표다 — 이 시험이 재려는 상태가 아니다',
  );

  assert.equal(irpOf(baseline), 0);
  assert.equal(
    allocationOf(baseline, 'retirement_pension').limited_by,
    'no_additional_tax_credit',
    '막은 것이 예산이나 한도라고 잘못 보고한다',
  );
  // **연금저축은 건드리지 않는다.** 공제를 낳지 않아도 과세이연과 인출 자유가 남고
  // 조문이 이월 신청을 예정한다(소유자가 그은 선).
  assert.equal(allocationOf(baseline, 'annuity_savings').annual_krw, ANNUITY_LIMIT);
});

test('경계 아래 — 잘라 낸 몫의 대가가 0이다', () => {
  // **이 변경 전체의 전제다.** 잘라 낸 IRP가 세액공제를 한 원이라도 낳고 있었다면
  // 사용자가 실제로 돈을 잃는다. 손대지 않은 안과 공제액을 직접 맞댄다.
  const salary = CAP_COORDINATES.BINDS.total_salary_krw;
  const { baseline } = baselineAt(salary);
  const untouched = untouchedAt(salary);

  assert.ok(irpOf(untouched) > 0, '비교 대상이 IRP를 채우지 않으면 이 시험이 아무것도 재지 않는다');
  assert.equal(creditOf(baseline), creditOf(untouched), 'IRP를 잘라 세액공제를 잃었다');
  // 그 대신 잘라 낸 예산이 사라지지도 않는다 — 다른 계좌나 미배분으로 간다.
  assert.equal(
    baseline.total_allocated_annual_krw + baseline.unallocated_annual_krw,
    untouched.total_allocated_annual_krw + untouched.unallocated_annual_krw,
  );
});

// ── 경계의 위 ────────────────────────────────────────────────────────────────

/**
 * 경계를 **찾는다**. 좌표를 적어 두지 않는 이유가 둘이다 —
 * (1) 그 수는 세법이 정한 것이라 시험 코드에 적을 수 없고,
 * (2) 적어 두면 룰셋이 바뀌는 날 이 시험이 조용히 엉뚱한 자리를 재게 된다.
 *
 * 반복 횟수만 코드에 있고 그것은 세법과 무관하다. 창 안에서 못 찾으면 시험이 멈춘다.
 */
const BOUNDARY_SCAN_STEPS = 64;

function firstSalaryWithIrp(from) {
  for (let offset = 0; offset <= BOUNDARY_SCAN_STEPS; offset += 1) {
    if (irpOf(baselineAt(from + offset).baseline) > 0) return from + offset;
  }
  return null;
}

test('경계 위 — 표시되는 세액공제액이 실제로 늘어나는 자리에서 IRP가 되살아난다', () => {
  // **한쪽만 잠그면 「IRP를 늘 0으로 두는」 구현도 통과한다.** 경계 위에서 배분이
  // 되살아나는 것을 본다.
  //
  // **`13.0.0`에서 이 시험의 기준이 바뀌었다** (D53 2번). 종전에는 총급여 1원 위에서
  // IRP가 되살아나는 것을 재고 있었는데, 그 자리의 IRP는 **1원**이었고 그 1원이 낳는
  // 것은 세액 한도의 소수부 0.1원이었다 — **어느 표시 금액에도 나타나지 않는다.**
  // 관리자가 D52 후속에 「그 1원이 실제로 공제를 낳는다」고 적었고 D53에서 스스로
  // 거짓임을 확인했다. 그래서 지금 재는 것은 **표시되는 세액공제액이 실제로 오르는가**다.
  const below = CAP_COORDINATES.BINDS.total_salary_krw;
  assert.equal(irpOf(baselineAt(below).baseline), 0);

  const boundary = firstSalaryWithIrp(below);
  assert.ok(boundary !== null, `총급여 ${below}원 위 ${BOUNDARY_SCAN_STEPS}원 안에서 IRP가 되살아나지 않는다`);
  assert.ok(boundary > below, '경계 아래에서 이미 IRP가 배분됐다');

  // **되살아난 그 자리에서 IRP는 표시 금액을 실제로 올린다.** IRP 계좌를 닫아
  // IRP가 0인 상태와 맞댄다 — 한도는 총급여가 정하므로 두 요청에서 같다.
  assert.ok(
    creditOf(baselineAt(boundary).baseline) > creditWithoutIrpAt(boundary),
    '되살아난 IRP가 표시되는 세액공제액을 한 원도 올리지 못한다 — 자물쇠만 지운 채 권한 것이다',
  );

  // **경계 아래의 모든 좌표에서 IRP를 꽉 채워도 표시 금액이 오르지 않는다.**
  // 여기가 D53 2번의 자리다 — 정확값 기준으로 되돌린 구현은 이 창 안에서 IRP를
  // 몇 원(이 좌표가 선 15% 구간에서 1~6원) 배분하고, 그 몫은 아래 등식을 깨지 않으면서
  // 사용자에게 중도인출 제한을 지운다.
  //
  // **12% 구간에는 같은 창이 없다**(`14.0.1` · D55). 그 구간에서는 한도가 아예 물지
  // 않으므로(한도 최솟값 > 최대 공제액) 트림도 없다. 계약이 적던 「12% 구간 1~8원」은
  // 틀린 것이 아니라 **전제를 만족하는 좌표가 없는** 서술이다.
  for (let salary = below; salary < boundary; salary += 1) {
    assert.equal(irpOf(baselineAt(salary).baseline), 0, `총급여 ${salary}: 경계 아래인데 IRP가 배분됐다`);
    assert.equal(
      creditOf(untouchedAt(salary)),
      creditWithoutIrpAt(salary),
      `총급여 ${salary}: IRP를 꽉 채운 안과 IRP가 없는 안의 표시 세액공제액이 다르다 — 경계 판정이 어긋났다`,
    );
  }
});

test('경계 한참 위 — 한도가 축의 끝에 닿으면 IRP가 남은 합산 한도를 전부 받는다', () => {
  const { baseline } = baselineAt(CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw);

  assert.equal(irpOf(baseline), COMBINED_LIMIT - ANNUITY_LIMIT);
  assert.equal(allocationOf(baseline, 'annuity_savings').annual_krw, ANNUITY_LIMIT);
  assert.notEqual(
    allocationOf(baseline, 'retirement_pension').limited_by,
    'no_additional_tax_credit',
    '자르지 않았는데 잘랐다고 보고한다',
  );
});

// ── 경계를 무엇이 정하는가 ───────────────────────────────────────────────────

test('경계는 총급여가 아니라 남은 한도가 정한다 — 같은 총급여에서 결과가 갈린다', () => {
  // **소유자 지시의 핵심 단서다.** 총급여 3,069만원은 기본 조건에서 나온 예시일 뿐이고,
  // 이미 넣은 돈·ISA 전환 추가한도·개정안 청년 우대가 그 경계를 움직인다.
  //
  // 여기서는 연금저축 계좌를 닫아 본다 — 그러면 그 한도를 쓰는 것이 IRP뿐이라
  // **같은 총급여에서 IRP가 0에서 되살아난다.** 총급여로 자르는 구현은 여기서 걸린다.
  const salary = CAP_COORDINATES.BINDS.total_salary_krw;
  const open = baselineAt(salary);
  const annuityClosed = baselineAt(salary, {
    accounts: { annuity_savings: { annuity_start_status: 'started' } },
  });

  assert.equal(
    open.scenario.pension_credit_tax_liability_cap.cap_krw,
    annuityClosed.scenario.pension_credit_tax_liability_cap.cap_krw,
    '두 요청의 한도가 다르면 이 시험이 재는 것이 총급여 축이 아니게 된다',
  );
  assert.equal(irpOf(open.baseline), 0);
  assert.ok(
    irpOf(annuityClosed.baseline) > 0,
    '연금저축이 닫혀 한도가 통째로 남았는데도 IRP가 0이다 — 경계를 총급여로 자르고 있다',
  );
  // 그리고 그 IRP는 실제로 공제를 낳는다.
  assert.ok(annuityClosed.baseline.deterministic_benefit.pension_credit_total_krw > 0);
});

// ── 손대지 않는 안 ───────────────────────────────────────────────────────────

test('기본안 후보가 아닌 안은 트림하지 않는다 — 트림은 그 안의 목적이 아니다', () => {
  // **자르는 것과 내지 않는 것은 다른 일이다.** 이 시험이 재는 것은 앞엣것이다 —
  // 기본안 후보가 아닌 안의 IRP는 계산 단계에서 잘리지 않는다. 그 안이 응답에
  // **실리는가**는 아래 시험이 따로 잰다(D53 3번).
  for (const planId of ['annuity_savings_first', 'pension_contribution_before_isa']) {
    const plan = baselineAt(CAP_COORDINATES.BINDS.total_salary_krw, {
      options: { plan_variants: [planId] },
    }).baseline;
    assert.equal(plan.plan_id, planId);
    assert.ok(irpOf(plan) > 0, `${planId}의 IRP까지 잘렸다 — 트림이 기본안 후보 밖으로 샜다`);
    assert.notEqual(allocationOf(plan, 'retirement_pension').limited_by, 'no_additional_tax_credit');
  }
});

// ── 목적 없이 IRP만 더 묶는 안은 내지 않는다 (D53 3번) ───────────────────────

test('표시 공제액이 같고 IRP만 더 묶인 안은 응답에서 빠진다', () => {
  // 관리자가 D52 후속에 「목적이 있는 안은 남긴다」고 정했고 D53에서 그 읽기를 깼다 —
  // **절세액이 같으면 그 안의 목적이 절세일 수 없다.** 이름이 아니라 값으로 잰다.
  const salary = CAP_COORDINATES.BINDS.total_salary_krw;
  const { scenario, baseline } = baselineAt(salary);
  const dropped = untouchedAt(salary);

  // 전제 — 그 안은 실재하고, 기본안과 표시 공제액이 같으면서 IRP만 더 묶는다.
  assert.equal(creditOf(dropped), creditOf(baseline), '두 안의 표시 공제액이 달라 이 시험의 전제가 없다');
  assert.ok(irpOf(dropped) > irpOf(baseline));
  assert.ok(
    allocationOf(dropped, 'annuity_savings').annual_krw <=
      allocationOf(baseline, 'annuity_savings').annual_krw &&
      allocationOf(dropped, 'isa').annual_krw <= allocationOf(baseline, 'isa').annual_krw,
    '다른 계좌가 더 받았다면 맞바꾼 것이지 순손해가 아니다 — 이 시험의 전제가 아니다',
  );

  // 그러므로 넷을 다 요청한 응답에는 그 벡터가 하나도 없어야 한다.
  for (const plan of scenario.plans) {
    assert.ok(
      irpOf(plan) <= irpOf(baseline) || creditOf(plan) !== creditOf(baseline),
      `${plan.plan_id}: 표시 공제액이 같은데 IRP만 더 묶인 안이 선택지로 남았다`,
    );
  }
});

test('다른 계좌가 실제로 더 받으면 그 안은 남는다 — 맞바꿈은 순손해가 아니다', () => {
  // **지배 판정이 「IRP가 더 많다」만 보면 안 된다.** 연금저축을 더 채우는 안은 IRP도
  // 더 묶지만 연금저축도 더 받는다 — 그 맞바꿈의 값어치를 조문이 정하지 않으므로
  // 엔진이 대신 판정하지 않는다. 예산을 넉넉히 주면 그 상태가 실제로 만들어진다.
  const scenario = scenarioOf(
    compute(
      baseRequest({
        profile: {
          current_year_total_salary_krw: CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw,
          prior_year_total_salary_krw: CAP_COORDINATES.NO_LONGER_BINDS.total_salary_krw,
          monthly_capacity_krw: FULL_PENSION_MONTHLY * 2,
        },
      }),
      rulesets,
    ),
  );

  const before = scenario.plans.find((p) => p.plan_id === 'pension_contribution_before_isa');
  assert.ok(before !== undefined, '연금 납입 한도를 ISA보다 먼저 채우는 안이 사라졌다');
  const baseline = scenario.plans.find((p) => p.is_baseline);
  assert.ok(
    allocationOf(before, 'annuity_savings').annual_krw >
      allocationOf(baseline, 'annuity_savings').annual_krw ||
      irpOf(before) > irpOf(baseline),
    '두 안이 같은 벡터라면 이 시험이 아무것도 재지 않는다',
  );
});

// ── 결함 주입 ────────────────────────────────────────────────────────────────

/**
 * 엔진 소스를 임시 디렉터리에 복사하고 파일 하나를 치환한다.
 * `mutation.test.mjs`와 같은 장치이고, 치환이 빗나가면 거기서 멈춘다 —
 * **주입이 조용히 빗나가면 그 시험은 통과하면서 아무것도 증명하지 않는다.**
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
    `주입 대상 문자열이 ${file}에 ${occurrences}번 있다(기대 ${count}) — 주입이 빗나갔다`,
  );
  writeFileSync(target, source.split(from).join(to));

  const module = await import(pathToFileURL(join(dir, 'index.mjs')).href);
  return module.compute;
}

test('주입 / 경계를 총급여로 자르면(고정 임계) 같은 총급여에서 갈리는 시험이 문다', async () => {
  // **소유자가 계산한 3,069만원을 코드에 박은 구현**을 흉내 낸다. 한도를 고정 수치와
  // 비교해 전부/전무로 자르는 형태이고, 기본 조건에서는 옳은 답을 낸다 —
  // 그래서 경계 아래·위만 보는 시험으로는 잡히지 않는다.
  // 임계 수치도 룰셋에서 만든다. **결함을 흉내 내는 문자열에도 세법 수치를 적지 않는다** —
  // 적으면 룰셋이 바뀌는 날 이 주입이 조용히 빗나간다.
  const maxRate = Math.max(
    ...confirmedRule('pension.credit.rate').value.brackets.map((b) => b.rate),
  );
  const threshold = Math.floor(ANNUITY_LIMIT * maxRate);
  const mutated = await mutatedCompute({
    file: 'plans.mjs',
    from: '      const productive = creditProductiveCap(amount, creditRoom);',
    to: `      const productive = ctx.cap.cap_krw < ${threshold} ? 0 : amount;`,
  });

  const salary = CAP_COORDINATES.BINDS.total_salary_krw;
  const request = (accounts) =>
    baseRequest({
      profile: {
        current_year_total_salary_krw: salary,
        prior_year_total_salary_krw: salary,
        monthly_capacity_krw: FULL_PENSION_MONTHLY,
      },
      ...(accounts ? { accounts } : {}),
    });
  const closed = { annuity_savings: { annuity_start_status: 'started' } };

  const irpFrom = (response) => {
    const scenario = scenarioOf(response);
    return irpOf(scenario.plans.find((plan) => plan.is_baseline));
  };

  // 기본 조건에서는 주입한 구현도 같은 답을 낸다 — 그것이 이 결함이 조용한 이유다.
  assert.equal(irpFrom(mutated(request(null), rulesets)), 0);
  assert.equal(irpFrom(compute(request(null), rulesets)), 0);

  // 연금저축을 닫아 한도가 통째로 남으면 갈린다.
  assert.ok(irpFrom(compute(request(closed), rulesets)) > 0);
  assert.equal(
    irpFrom(mutated(request(closed), rulesets)),
    0,
    '주입이 결과를 바꾸지 못했다 — 그러면 위 시험이 이 결함을 잡는다는 주장이 거짓이다',
  );
});

test('주입 / 잘라 낸 이유를 예산으로 뭉개면 케이스 4 시험이 문다', async () => {
  // `limited_by`가 「예산이 막았다」로 나가면 화면은 「돈을 더 넣으면 IRP가 찬다」를
  // 적게 된다. **금액은 한 원도 다르지 않으므로 금액 검사로는 잡히지 않는다.**
  const mutated = await mutatedCompute({
    file: 'plans.mjs',
    from: '        reason = LIMITED_BY.NO_ADDITIONAL_CREDIT;',
    to: '        reason = LIMITED_BY.BUDGET;',
  });

  const request = baseRequest({
    profile: {
      current_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
      prior_year_total_salary_krw: CAP_COORDINATES.BINDS.total_salary_krw,
      monthly_capacity_krw: FULL_PENSION_MONTHLY,
    },
  });

  const limitedByFrom = (response) => {
    const scenario = scenarioOf(response);
    const baseline = scenario.plans.find((plan) => plan.is_baseline);
    return [allocationOf(baseline, 'retirement_pension').limited_by, irpOf(baseline)];
  };

  assert.deepStrictEqual(limitedByFrom(compute(request, rulesets)), ['no_additional_tax_credit', 0]);
  assert.deepStrictEqual(limitedByFrom(mutated(request, rulesets)), ['budget', 0]);
});
