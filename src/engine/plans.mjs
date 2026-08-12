// 배분안 산출. 우선순위 기반 순차 충당이다.
//
// **fund_use_horizon이 금액에 닿는 자리는 정확히 하나다**(D52 2번) — `allocate()` 첫머리의
// 「전액 미배분」 갈래이고, 그 판정은 `fund-use-horizon.mjs`가 룰셋을 읽어 만든다.
// **그 갈래를 빼면 D10이 세운 분리가 그대로다** — 나머지 계산은 자금 사용 시점을 읽지 않고,
// 경고 판정과 기본안 선택은 금액이 다 나온 뒤에 온다(engine-design.md 5절 9 / 11~12단계).
//
// **머리말을 고쳐 적은 이유.** 이 자리에는 「fund_use_horizon은 금액 계산이 끝난 뒤에만
// 쓰인다」가 적혀 있었다. D52 2번으로 그 문장이 거짓이 됐고, **거짓이 된 문장을 남겨 두는
// 것이 이 저장소가 반복해 밟은 결함이다.**

import {
  ACCOUNT,
  ACCOUNT_ORDER,
  BASELINE_BY_HORIZON,
  COMPARISON_NOTE,
  PENSION_EXTRA_BEFORE_ISA,
  FILL_SEQUENCE,
  HEADROOM_POOL,
  HORIZON,
  IRP_CREDIT_PRODUCTIVE_ONLY_PLANS,
  LIMITED_BY,
  MONTHLY_BUCKET,
  MONTHLY_UNASSIGNED_REASON,
  NON_QUANTIFIED,
  PLAN,
  PLAN_ORDER,
  PRIORITY_BASIS,
  RULE,
  TIE_BREAK,
  UNALLOCATED_REASON,
  WARNING,
} from './constants.mjs';
import { resolveCarryoverConditions } from './limits.mjs';
import { bindingCodeFor } from './liability-cap.mjs';
import { headlineCompositeTotalFor } from './headline.mjs';
import { isaEstimateFor } from './isa-return.mjs';
import { apportionMonthly } from './monthly.mjs';
import { applyRate, clampToZero, toRatio } from './ratio.mjs';
import { EXACT_ZERO, addExact, cmpExact, exactOf, minExact, scaleExact } from './exact.mjs';

const PENSION_ACCOUNTS = new Set([ACCOUNT.PENSION, ACCOUNT.ANNUITY]);

/**
 * 세제상 동점인가 — 두 연금계좌의 한계 공제율이 같은가.
 * 동점이면 어느 쪽에 넣어도 세액이 같으므로 순서를 다른 기준으로 정할 수 있다.
 * 동점이 아니면 **세액공제 최대화가 앞선다.** 인출 편의로 세액을 깎지 않는다.
 */
function creditRatesAreTied(rates) {
  return (rates.youthIrpRate ?? rates.incomeTaxRate) <= rates.incomeTaxRate;
}

/**
 * 이 배분안이 실제로 쓰는 충당 순서.
 *
 * `annuity_savings_first`는 이름이 순서를 이미 고정하므로 손대지 않는다.
 * 나머지는 연금 쌍의 순서가 이름에 매여 있지 않으므로, **세제상 동점 구간에서만**
 * 인출이 자유로운 계좌를 앞세운다(engine-design.md 3.3절).
 */
function fillSequenceFor(planId, { rates, withdrawalOrder }) {
  const standard = FILL_SEQUENCE[planId];
  if (planId === PLAN.ANNUITY_FIRST || withdrawalOrder === null) return standard;
  if (!creditRatesAreTied(rates)) return standard;

  const pensionPart = [...withdrawalOrder];
  return standard.map((account) =>
    account === ACCOUNT.ISA ? account : pensionPart.shift(),
  );
}

function tieBreakOf(planId, ctx) {
  const applied =
    planId !== PLAN.ANNUITY_FIRST &&
    ctx.withdrawalOrder !== null &&
    creditRatesAreTied(ctx.rates);

  return applied
    ? { code: TIE_BREAK.WITHDRAWAL_FLEXIBILITY, basis_rule_ids: [RULE.PENSION_MIDTERM_RESTRICTION] }
    : { code: TIE_BREAK.NOT_APPLICABLE, basis_rule_ids: [] };
}

/**
 * 충당 단계 목록. 계좌 하나가 두 번 나올 수 있으므로 순서 배열과 따로 만든다.
 *
 * **D32 — 이제 네 안이 전부 연금 쌍을 두 번 돈다.** 예전에는 세 안이 세액공제 대상
 * 한도에서 멈췄고 네 번째 안만 납입 한도까지 갔다. 소유자가 기본안도 납입 한도까지
 * 채우도록 정했으므로(미배분을 최대한 남기지 않는다) 두 단계 구조가 전부에 걸린다.
 *
 * 왜 두 단계여야 하는가 — 연금 납입 총액은 순서와 무관하게 같지만(납입 한도까지 채운다)
 * **그 총액을 두 계좌에 어떻게 쪼개는가**가 세액을 바꾼다. 조문 산식
 * `대상액 = min( min(연금저축, 단독한도) + 퇴직연금, 합산한도 )`에서 인정액은
 * **퇴직연금이 `합산한도 − 단독한도`만큼을 받는 한** 쪼개기와 무관하게 최대다.
 * 연금저축이 단독 한도 때문에 흡수하지 못하는 몫이 정확히 그만큼이기 때문이다.
 *
 * 즉 **비용이 0인 구간이 실재하고 그 폭이 넓다.** 그 구간 안에서는 세액이 완전히
 * 같으므로 D18·계약 0.4절이 세운 원칙이 그대로 선다 — **비용이 0이면 인출이 자유로운
 * 계좌를 먼저 채운다.** 그래서 단계를 이렇게 나눈다.
 *
 *   1차 — 연금 쌍을 **세액공제 대상 한도까지**. 순서는 그 안의 이름이 정하거나
 *          (동점이면 인출 자유 우선, 갈리면 세액공제 최대화) 규칙이 정한다.
 *   2차 — ISA를 **납입한도까지**.
 *   3차 — 남은 **연금 납입** 한도를 인출이 자유로운 계좌부터. 이 몫은 어느 계좌에
 *          넣어도 공제를 낳지 않으므로 세액이 순서를 정하지 못하고, 인출 가능성만 남는다.
 *
 * **2차와 3차의 선후가 소유자가 못 박은 지점이다.** ISA에는 자기 세제혜택이 있고
 * 3단계 몫은 올해 공제를 낳지 않으므로, 뒤집으면 사용자가 실제로 잃는다.
 * `PENSION_EXTRA_BEFORE_ISA`에 든 안만 뒤집힌 순서를 쓰고 **그 사실이 그 안의 이름이다.**
 *
 * 1차를 빼고 3차만 돌리면(연금저축부터 납입 한도까지) 연금저축이 단독 한도를 넘겨
 * 채워져 인정액이 줄고 **확정 세액이 실제로 깎인다.** 그것이 이 단계 구조의 이유다.
 */
function fillStepsFor(planId, ctx) {
  const sequence = fillSequenceFor(planId, ctx);
  const pensionPart = sequence.filter((account) => PENSION_ACCOUNTS.has(account));
  // 3차의 순서를 정하는 것은 세액이 아니라 인출 가능성이다. 규칙을 읽지 못했으면
  // 1차와 같은 순서를 쓴다 — 없는 근거로 순서를 정하지 않는다.
  const flexibleFirst = ctx.withdrawalOrder ?? pensionPart;
  const extraSteps = flexibleFirst.map((account) => ({ account, creditBounded: false }));
  const extraBeforeIsa = PENSION_EXTRA_BEFORE_ISA.has(planId);

  const steps = [];
  for (const account of sequence) {
    if (PENSION_ACCOUNTS.has(account)) {
      steps.push({ account, creditBounded: true });
      continue;
    }
    // ISA 자리. 3단계 몫을 ISA 앞에 두는 안은 여기서 갈린다.
    if (extraBeforeIsa) steps.push(...extraSteps);
    steps.push({ account, creditBounded: false });
  }
  if (!extraBeforeIsa) steps.push(...extraSteps);

  return steps;
}

/**
 * 응답에 실을 충당 순서. 실제로 돈이 들어간 순서를 앞에 두고, 한 푼도 받지 못한 계좌를
 * 단계 목록의 순서대로 뒤에 붙여 길이 3을 채운다. 계좌 하나를 두 번 적지 않는다.
 *
 * **D32 이후로는 네 안 모두 이 경로를 쓴다.** 계좌 하나가 두 단계에 걸쳐 채워질 수 있게
 * 되었으므로 단계 목록을 그대로 실을 수 없고, 1차에서 공제 여력이 0이라 아무것도 받지
 * 못한 계좌를 "먼저 채웠다"고 적으면 그것이 거짓 보고다.
 */
function observedSequence(fillOrder, planId, ctx) {
  const filled = ACCOUNT_ORDER.filter((account) => fillOrder[account] !== undefined).sort(
    (a, b) => fillOrder[a] - fillOrder[b],
  );
  const rest = [];
  for (const { account } of fillStepsFor(planId, ctx)) {
    if (fillOrder[account] === undefined && !rest.includes(account)) rest.push(account);
  }
  return [...filled, ...rest];
}

/**
 * 세액공제 소득세분의 **자르기 전** 정확값. 인정액 산식이 사는 유일한 자리다.
 *
 * **떼어낸 이유**(D52 1번). 「이 IRP 납입이 세액공제를 한 원이라도 더 낳는가」를 재려면
 * 배분 단계가 공제 산식을 알아야 한다. 산식을 그 자리에 다시 적으면 **두 벌이 되고**,
 * 두 벌이 갈리는 날 배분과 공제액이 서로 다른 산식 위에 서게 된다. 그래서 한 벌만 둔다.
 */
function creditIncomeTaxExact({ annuityCounted, pensionCounted }, { state, rates }) {
  const eligibleTotal = Math.min(annuityCounted + pensionCounted, state.combinedLimit);

  // ⚠ 조문이 정하지 않아 엔진이 정한 지점(D17). engine-design.md 6.4절에 전말이 있다.
  //   합산 한도가 걸릴 때 어느 쪽 납입분이 잘리는지를 조문이 말하지 않는다.
  //   퇴직연금분을 먼저 인정하고 남는 만큼을 연금저축분으로 본다.
  //   **답이 달라지면 고칠 곳은 아래 두 줄뿐이다.**
  const pensionEligible = Math.min(pensionCounted, state.combinedLimit);
  const annuityEligible = clampToZero(eligibleTotal - pensionEligible);

  const pensionRate = rates.youthIrpRate ?? rates.incomeTaxRate;
  const groups = new Map();
  const add = (rate, amount) => groups.set(rate, (groups.get(rate) ?? 0) + amount);
  add(pensionRate, pensionEligible);
  add(rates.incomeTaxRate, annuityEligible);

  // **율마다 따로 버리지 않는다.** 공제율이 둘인 경우(개정안의 청년 우대) 갈래마다
  // 버리면 조문에 없는 절사 자리가 갈래 수만큼 생긴다. 정확값으로 더하고 표시 직전에
  // 한 번 버린다 — 룰셋 `intermediate_amount`/`displayed_amount`의 규약이다.
  let incomeTaxExact = EXACT_ZERO;
  for (const [rate, amount] of groups) {
    incomeTaxExact = addExact(incomeTaxExact, scaleExact(exactOf(amount), toRatio(rate)));
  }
  return { incomeTaxExact, eligibleTotal };
}

/**
 * 한 배분안의 금액.
 *
 * `trimIrp`를 끄면 **D52 1번의 트림을 하지 않은** 배분이 나온다. 그 배분은 응답에 실리지
 * 않는다 — 쓰는 곳은 한 자리, 「세액 한도가 이 사용자에게 실제로 물었는가」의 기준점이다
 * (`applyCap`의 머리말). **기본값은 그 안이 기본안 후보인지가 정한다.**
 */
function allocate(planId, ctx, trimIrp = IRP_CREDIT_PRODUCTIVE_ONLY_PLANS.has(planId)) {
  const { state, budget, eligible, rates } = ctx;

  // **D32 이후 모든 안이 납입 한도까지 채운다.** 그래서 어느 안에서든 공제를 낳지 않는
  // 납입분이 생길 수 있고, 그 몫은 인정액에 들어가지 않는다 — 아래 `counted`가 그
  // 분리를 강제한다. **그 분리가 기본안에서 무너지면 절세액이 조용히 과대가 된다.**
  let remainingBudget = budget;
  let annuityCounted = state.annuityCounted;
  let pensionCounted = state.pensionCounted;
  let pensionPool = state.pensionContributionRemaining;
  let isaPool = state.isaRemaining;

  const amounts = { [ACCOUNT.PENSION]: 0, [ACCOUNT.ANNUITY]: 0, [ACCOUNT.ISA]: 0 };
  /** 계좌별로 **세액공제를 낳지 않은** 납입액. 3단계가 받은 몫이 여기로 간다. */
  const withoutCredit = { [ACCOUNT.PENSION]: 0, [ACCOUNT.ANNUITY]: 0 };
  const limitedBy = {};
  const fillOrder = {};
  let order = 0;

  // ⚠ D17(합산 한도 절단 시 IRP 우선 인정)이 코드에 새겨지는 두 번째 지점이다.
  //   첫 번째는 benefitOf()의 인정 로직이고, 여기는 그 인정 구조를 아는 배분 탐색이다.
  //   D17은 조문이 정하지 않아 소유자가 판정한 해석이며 **법안 통과 시 재검토 대상**이다.
  //   전말과 재검토 절차는 engine-design.md 6.4절 표에 있다.
  //
  //   퇴직연금 공제율이 연금저축보다 높으면(개정안 청년 우대) 추가 IRP 납입은
  //   잔여 공제한도를 채우는 데 그치지 않는다. D17의 IRP 우선 인정 아래에서
  //   **이미 인정된 연금저축분을 공제 풀에서 밀어내고 그만큼이 높은 율로 갈아탄다.**
  //   따라서 상한은 "남은 합산 room"이 아니라 "IRP 인정액이 합산 한도에 닿는 지점"이다.
  //   4단계 교차검증 M1이 잡아낸 결함이 정확히 이 구분을 놓친 것이었다.
  const pensionRateIsHigher = !creditRatesAreTied(rates);

  const creditCapacity = (account) => {
    // **1단계가 서지 않으면 공제를 낳는 여력이 한 원도 없다**(소득세법 §59조의3① —
    // 「종합소득이 있는 거주자가」). 종합소득이 없는 사람에게는 어느 계좌에 얼마를 넣든
    // 공제가 성립하지 않으므로, 공제 여력을 한도에서 읽어 오면 그것이 거짓이 된다.
    //
    // **배분을 막는 것이 아니다.** 계좌는 그대로 열려 있고 3단계(납입 한도 몫)가 여전히
    // 채운다 — 룰셋이 「납입은 할 수 있고 미공제 원금이 될 뿐이다」라고 적은 그대로다.
    // 달라지는 것은 **순서**뿐이고, 공제를 낳지 않는 납입을 공제를 이유로 앞세우지
    // 않는다는 것이 그 순서의 뜻이다.
    if (!ctx.creditEligibility.requirement_met) return 0;

    const combinedRoom = clampToZero(state.combinedLimit - (annuityCounted + pensionCounted));
    if (account === ACCOUNT.PENSION) {
      // 두 율이 같으면 치환해도 세액이 그대로다. 공제를 늘리지 못하는 납입을
      // 연금계좌에 밀어 넣지 않는다 — 인출 제약만 지게 된다.
      if (!pensionRateIsHigher) return combinedRoom;
      return clampToZero(state.combinedLimit - pensionCounted);
    }
    // 연금저축 추가분은 IRP를 밀어내지 못한다(D17). 남은 room이 그대로 상한이다.
    return clampToZero(Math.min(state.annuityLimit - annuityCounted, combinedRoom));
  };

  /**
   * **이 IRP 납입이 표시되는 세액공제액을 한 원이라도 늘리는 지점까지만** 자른다
   * (D52 1번, 기준은 D53 2번에서 옮겼다).
   *
   * 인정 공제액은 `min(산식(인정 납입액), 세액 한도)`이고 납입액에 대해 **단조**다.
   * 표시 금액은 그 정확값을 버림한 것이라 역시 단조다. 그러므로 「같은 표시 공제액을
   * 내는 가장 작은 납입액」이 존재하고, 그 위의 몫은 **어느 표시 금액도 늘리지 않는다.**
   * 그 몫을 IRP에 넣으면 얻는 것 없이 중도인출 제한만 진다
   * (`pension.withdrawal.midterm_restriction`).
   *
   * **기준이 정확값이 아니라 표시 금액인 이유** (D53 2번). 관리자가 D52 후속에
   * 「그 1원이 실제로 공제를 낳는다」고 적었고 **그것이 거짓이었다.** 세액 한도에 소수부가
   * 있으면 정확값 기준의 탐색은 **0.1원짜리 증가**를 「낳았다」고 세고, 그 0.1원은
   * `tax_credit`에도 `tax_credit_before_cap`에도 나타나지 않는다. 한 좌표의 일이 아니라
   * **한도에 소수부가 있으면서 무는 모든 좌표**에서 몇 원의 무의미한 IRP가 남는다.
   * D52 1번의 취지가 「아무것도 낳지 않는 자물쇠를 권하지 않는다」이고,
   * **어느 표시 금액에도 안 나타나는 몫은 얻은 것이 아니다.**
   *
   * **비교는 소득세분과 지방소득세분의 표시 금액을 더해서 한다.** 화면이 사용자에게
   * 내미는 수가 그 합이고, 두 칸이 서로 다른 단계에서 버려지므로(§47③이 임의규정이라
   * 지방세분 단계가 룰셋에 따로 있다) 소득세분만 보면 규약이 갈리는 날 어긋난다.
   *
   * **경계를 총급여로 자르지 않는다.** 자르는 것은 남은 세액 한도이고, 그 값은 이미
   * 넣은 연금저축·ISA 전환 추가한도·개정안 청년 우대에 따라 사람마다 다르다.
   * 총급여 3,069만원은 **기본 조건에서 이 함수가 0을 내는 지점**일 뿐이고
   * 코드 어디에도 그 수가 없다.
   *
   * 닫힌 식 대신 이분 탐색을 쓰는 이유 — 공제율이 둘로 갈리는 분기(청년 우대)와
   * D17의 밀어내기가 겹치면 기울기가 구간마다 다르다. 그 식을 여기 다시 유도해 적으면
   * 공제 산식이 두 벌이 된다. **단조성만 쓰면 유도가 필요 없다.**
   */
  const creditProductiveCap = (maxAmount, creditRoom) => {
    // 표시되는 세액공제액. **`benefitOf`가 응답에 싣는 것과 같은 두 손잡이를 쓴다** —
    // 절사 단계도 단위도 룰셋에서 온 것이고 여기서 다시 정하지 않는다.
    const displayedCreditAt = (amount) => {
      const recognized = minExact(
        creditIncomeTaxExact(
          { annuityCounted, pensionCounted: pensionCounted + Math.min(amount, creditRoom) },
          ctx,
        ).incomeTaxExact,
        ctx.capExact,
      );
      const localExact = scaleExact(recognized, toRatio(rates.surtaxRate));
      return ctx.rounding.display(recognized) + ctx.rounding.displayLocal(localExact);
    };

    const target = displayedCreditAt(maxAmount);
    let low = 0;
    let high = maxAmount;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (displayedCreditAt(mid) >= target) high = mid;
      else low = mid + 1;
    }
    return low;
  };

  const trimUnproductiveIrp = trimIrp;
  /** 트림이 **실제로** 금액을 깎았는가. 기준점 배분을 한 번 더 만들지 말지가 여기 달렸다. */
  let irpTrimmed = false;

  for (const { account, creditBounded: stepIsCreditBounded } of fillStepsFor(planId, ctx)) {
    if (!eligible[account]) {
      // **자격이 없는 계좌에는 `not_eligible`이 이긴다.** 그 사실은 아래 시점 판정과
      // 무관하게 참이고, 덮으면 화면이 자격 문제를 못 본다.
      limitedBy[account] = LIMITED_BY.NOT_ELIGIBLE;
      continue;
    }

    // **자금 사용 시점이 금액에 닿는 유일한 자리다**(D52 2번 · D53 1번). 판정은 룰셋을
    // 읽어 `fund-use-horizon.mjs`가 계좌마다 만들고, 여기서는 그 결론만 본다.
    // **계좌별인 것이 이 자리의 요지다** — 의무가입기간이 지난 ISA는 추징 요건이
    // 성립하지 않아 살아남고, 그때도 연금 두 계좌는 그대로 비워진다.
    if (ctx.horizonSuppression.accounts[account]) {
      limitedBy[account] = LIMITED_BY.FUND_USE_HORIZON;
      continue;
    }

    const isPension = PENSION_ACCOUNTS.has(account);
    const creditRoom = isPension ? creditCapacity(account) : 0;

    // 이 단계의 상한들. **1차 단계에는 공제 여력 항이 하나 더 걸리지만 그것은
    // `limited_by`로 보고되지 않는다** — 그 계좌는 3차에서 다시 채워지므로 공제 한도가
    // 그 계좌를 막은 것이 아니고, `credit_limit`으로 보고하면 거짓말이 된다(D32).
    const stepCaps = isPension
      ? [
          [LIMITED_BY.BUDGET, remainingBudget],
          [LIMITED_BY.CONTRIBUTION_LIMIT, pensionPool],
        ]
      : [
          [LIMITED_BY.BUDGET, remainingBudget],
          [LIMITED_BY.CONTRIBUTION_LIMIT, isaPool],
        ];

    const reportedCap = Math.min(...stepCaps.map(([, value]) => value));
    let amount = stepIsCreditBounded ? Math.min(reportedCap, creditRoom) : reportedCap;
    let reason = stepCaps.find(([, value]) => value === reportedCap)[0];

    if (trimUnproductiveIrp && account === ACCOUNT.PENSION && amount > 0) {
      const productive = creditProductiveCap(amount, creditRoom);
      if (productive < amount) {
        amount = productive;
        reason = LIMITED_BY.NO_ADDITIONAL_CREDIT;
        irpTrimmed = true;
      }
    }

    // 뒤 단계가 앞 단계의 판정을 덮는다. **마지막에 실제로 막은 것**이 사실이기 때문이다.
    //
    // **한 값만 덮이지 않는다.** 위에서 잘라 낸 IRP는 그 뒤 단계에서 예산이 이미 다른
    // 계좌로 갔거나 3차 몫이 0이라 「예산」·「납입 한도」로 다시 판정되는데, **그 상태가
    // 바로 이 판정의 결과다.** 덮으면 원인이 결과로 바뀌어 화면이 이유를 잃는다.
    if (limitedBy[account] !== LIMITED_BY.NO_ADDITIONAL_CREDIT) limitedBy[account] = reason;

    if (amount > 0) {
      // 계좌가 두 단계에 걸쳐 채워질 수 있다. 순서는 **처음 받은 시점**이다 —
      // 그래야 fill_sequence가 말하는 순서와 어긋나지 않는다.
      if (fillOrder[account] === undefined) {
        order += 1;
        fillOrder[account] = order;
      }
      amounts[account] += amount;
      remainingBudget -= amount;

      if (account === ACCOUNT.ISA) {
        isaPool -= amount;
      } else {
        pensionPool -= amount;
        // **납입액과 인정액을 가른다.** 공제 한도를 넘겨 넣은 몫은 조문상 "없는 것으로"
        // 되므로 인정액에 더하지 않는다. 1차 단계에서는 두 값이 같아 D32 전의 공제액이
        // 그대로 유지되고, 3차 단계에서는 `creditRoom`이 이미 0이라 전액이 갈라진다.
        //
        // ⚠ **이 한 줄이 기본안의 절세액을 지킨다.** 지난 회차에 별도 배분안에서
        //   연금저축이 단독 공제한도를 넘겨 채워지며 공제액이 과대로 나온 결함을 이 clamp가
        //   막았고, D32로 그 경로가 **기본안에** 들어왔다. `baseline-freeze.test.mjs`가
        //   변경 전 값을 얼려 두고 있고 `mutation.test.mjs`가 이 줄을 지워 확인한다.
        const counted = Math.min(amount, creditRoom);
        if (account === ACCOUNT.ANNUITY) annuityCounted += counted;
        else pensionCounted += counted;
        withoutCredit[account] += amount - counted;
      }
    }
  }

  return {
    amounts,
    limitedBy,
    fillOrder,
    // **보고하는 순서는 실제로 돈이 들어간 순서다.** 두 단계로 도는 안에서는 계좌 하나가
    // 두 번 나오므로 단계 목록을 그대로 실을 수 없고, 무엇보다 1차에서 공제 여력이 0이라
    // 아무것도 못 받은 계좌를 "먼저 채웠다"고 적으면 그것이 거짓 보고다.
    observedSequence: observedSequence(fillOrder, planId, ctx),
    annuityCounted,
    pensionCounted,
    remainingBudget,
    withoutCredit,
    pensionPoolRemaining: pensionPool,
    isaPoolRemaining: isaPool,
    irpTrimmed,
  };
}

/**
 * 세액 한도를 적용한다. **자르기 전 금액과 자른 뒤 금액을 둘 다 낸다** —
 * 화면이 "최대 이만큼인데 낼 세금 때문에 이만큼이 된다"를 말하려면 뺄셈의 두 항이 다 필요하고,
 * 그 뺄셈을 화면이 하게 두면 세법 판단이 화면 코드로 새어 들어간다.
 *
 * **자르는 대상은 소득세분이다.** 사용자가 답하는 결정세액이 소득세이고 §61 ②③도 소득세의
 * 조문이다. 개인지방소득세는 그 소득세액의 10%로 산출되므로, 인정되지 않은 소득세 공제에
 * 붙는 지방세를 남겨 두면 근거가 사라진 금액이 남는다. 그래서 **인정된 소득세분에 부가율을
 * 다시 적용한다.** 지방세 쪽에 같은 한도 구조가 있는지는 룰셋이 미확인으로 남겨 두었고,
 * 그 사실은 assumptions로 나간다.
 *
 * **`applied`가 재는 것은 「이 사용자에게 한도가 물었는가」이지 「이 배분에서 뺄셈이
 * 일어났는가」가 아니다** (`13.0.0`). 둘이 갈리는 자리를 D52 1번이 만들었다 — 한도가
 * 물기 때문에 IRP를 잘라 내는데, 잘라 낸 **뒤의** 금액과 한도를 대면 자름이 사라져 보인다.
 * **원인과 결과가 뒤집힌다.** 정답지가 GC-32d에서 같은 말을 이미 적었다("트림한 것 자체가
 * 한도가 물었기 때문이다. 트림 후 값이 한도와 같아졌다고 해서 한도가 안 물었다고 적으면
 * 원인과 결과를 뒤집는다"). `11.0.0`까지는 두 값이 우연히 같아 이 구분이 필요 없었고,
 * D53 2번이 트림 기준을 표시 금액으로 옮기면서 **끝수가 있는 모든 한도에서** 갈라졌다.
 *
 * 그래서 `bindingExact`(트림 전 배분의 자르기 전 소득세분)를 받는다. 트림이 없었으면
 * `null`이고 그때는 이 배분의 값이 그대로 기준이다 — 두 값이 같기 때문이다.
 * **`reduced_*`와 `threshold_income_tax_krw`는 여전히 이 배분의 표시 금액이다.**
 * 그 셋은 화면이 나란히 놓고 더하고 빼는 수이고, 실리지 않은 배분의 수를 섞으면
 * 화면에서 합이 맞지 않는다(불변식 I23).
 */
function applyCap(
  incomeTaxExact,
  localTaxExact,
  { cap, capExact, rates, rounding, access, bindingExact = null },
) {
  // **비교는 정확값으로 한다**(룰셋 `tax.rounding.won_fraction`의 `comparison` 단계).
  // 한도 1,349,999.888과 공제액 1,350,000은 조문상 한도가 더 작아 절단이 일어나는
  // 자리인데, 한도를 먼저 1,350,000으로 만들어 비교하면 그 절단이 사라진다.
  const recognizedIncomeTaxExact = minExact(incomeTaxExact, capExact);
  const recognizedLocalTaxExact = scaleExact(recognizedIncomeTaxExact, toRatio(rates.surtaxRate));

  const incomeTax = rounding.display(incomeTaxExact);
  const localTax = rounding.displayLocal(localTaxExact);
  const recognizedIncomeTax = rounding.display(recognizedIncomeTaxExact);
  const recognizedLocalTax = rounding.displayLocal(recognizedLocalTaxExact);

  // **잘렸는가는 정확값의 대소가 정한다.** 표시 금액의 차이가 아니다 — 그 둘이 갈리는
  // 좌표가 실재하고(끝수만 잘린 경우), 표시 쪽으로 판정하면 D46 1번이 고친 결함이 다른
  // 자리에서 그대로 되살아난다. **대는 상대는 트림 전 금액이다**(위 머리말).
  const applied = cmpExact(capExact, bindingExact ?? incomeTaxExact) < 0;
  // 표시되는 잘린 금액은 **표시 금액끼리의 뺄셈**이다. 화면이 세 수를 나란히 놓으므로
  // 그 셋이 서로 맞아야 한다(불변식 I23).
  const reducedIncomeTax = incomeTax - recognizedIncomeTax;

  // 잘린 것은 공제액이고 납입액이 아니다. 그 납입액은 전환 신청의 대상이 된다 —
  // "넣은 돈이 사라진다"가 아니라 "올해의 공제는 0이고 납입액은 넘길 수 있다"가 정확한 서술이다.
  //
  // **다만 그 서술에는 조건이 둘 붙는다**(D26). 이름 하나(`..._available`)가 그것을
  // 감추고 있었으므로 조건을 값으로 함께 낸다. 전환이 걸리지 않는 안에서는 읽지 않는다 —
  // 읽지 않은 규칙을 근거로 싣지 않는다는 규약 때문이다.
  const carryover = applied ? resolveCarryoverConditions(access) : null;

  return {
    incomeTax,
    localTax,
    recognizedIncomeTax,
    recognizedLocalTax,
    cap: {
      cap_krw: cap.cap_krw,
      applied,
      // **잘렸다는 사실과 「걸린다는 것이 증명된다」는 사실은 다르다.** 추정 한도가
      // 상한인 분기에서만 잘림이 실제 한도의 잘림을 증명한다. 자르지 않은 경우는
      // 어느 분기에서도 아무것도 증명하지 못한다 — 화면이 「걸리지 않았습니다」를
      // 적으면 거짓이 될 수 있고, 그것을 막는 것이 이 값이다(D40).
      binding_code: bindingCodeFor(applied, cap.is_upper_bound),
      reduced_income_tax_krw: reducedIncomeTax,
      reduced_local_tax_krw: localTax - recognizedLocalTax,
      reduced_total_krw: incomeTax + localTax - (recognizedIncomeTax + recognizedLocalTax),
      // 임계값. 낼 세금이 이 값보다 적으면 결과가 달라진다 — 사용자가 나중에
      // 영수증을 보고 스스로 대조할 수 있게 하는 값이고, 화면이 만들지 않는다.
      threshold_income_tax_krw: incomeTax,
      // 초과분의 세액공제액은 이월되지 않는다. 다만 그 납입액은 신청으로 넘길 수 있다.
      credit_carryforward: cap.credit_carryforward,
      contribution_carryover_available: applied,
      // 전환금액도 **전환한 해의** 600만·900만 한도를 그 해의 새 납입액과 나눠 쓴다.
      // 매년 한도를 채우는 사용자에게는 전환할 자리가 생기지 않는다.
      carryover_shares_future_year_credit_limit: carryover?.shares_future_year_credit_limit ?? null,
      // 신청주의다. 자동이 아니다.
      carryover_requires_application: carryover?.requires_application ?? null,
      error_direction_code: cap.error_direction_code,
      basis_rule_ids: [
        ...cap.basis_rule_ids,
        ...(applied ? [RULE.CREDIT_UNUSED_CARRYOVER] : []),
      ].sort(),
    },
  };
}

/** 세액공제액. 대상액을 계좌별 공제율로 나눠 적용한다. */
function benefitOf(counted, ctx, bindingExact = null) {
  const { rates, cap, capExact, rounding, access } = ctx;
  // **산식은 한 벌뿐이다.** 배분 단계의 「이 IRP 납입이 공제를 더 낳는가」 판정도
  // 같은 함수를 부른다(D52 1번). 두 벌이 되면 배분과 공제액이 갈릴 수 있다.
  const { incomeTaxExact, eligibleTotal } = creditIncomeTaxExact(counted, ctx);
  const localTaxExact = scaleExact(incomeTaxExact, toRatio(rates.surtaxRate));

  const capped = applyCap(incomeTaxExact, localTaxExact, {
    cap,
    capExact,
    rates,
    rounding,
    access,
    bindingExact,
  });

  return {
    pension_credit_income_tax_krw: capped.recognizedIncomeTax,
    pension_credit_local_tax_krw: capped.recognizedLocalTax,
    pension_credit_total_krw: capped.recognizedIncomeTax + capped.recognizedLocalTax,
    // 자르기 전 금액. 화면이 "계산된 공제액 중 얼마가 이번 과세연도에 쓰이지 않는지"를
    // 말하려면 이 값이 함께 있어야 한다.
    pension_credit_income_tax_before_cap_krw: capped.incomeTax,
    pension_credit_local_tax_before_cap_krw: capped.localTax,
    pension_credit_total_before_cap_krw: capped.incomeTax + capped.localTax,
    // 세액공제 대상으로 **인정된 납입액**은 한도로 잘리지 않는다. 잘리는 것은 공제액이고
    // 납입액은 살아남아 전환 신청의 대상이 된다(시행령 §118의3).
    credit_eligible_contribution_krw: eligibleTotal,
    tax_liability_cap: capped.cap,
    basis_rule_ids: [
      RULE.CREDIT_RATE,
      RULE.CREDIT_LIMIT_ANNUITY,
      RULE.CREDIT_LIMIT_COMBINED,
      RULE.CREDIT_TAX_CAP,
      RULE.LOCAL_SURTAX,
      ...(rates.youthIrpRate !== null ? [RULE.PROPOSED_YOUTH_IRP_RATE] : []),
    ].sort(),
  };
}

/** 자금 사용 시점에 따라 걸리는 중도 불이익. 금액은 내지 않는다. */
function warningsOf(amounts, { horizon, boundaries, startDates }) {
  if (horizon === HORIZON.AT_OR_AFTER_PENSION_AGE) return [];

  const unknown = horizon === HORIZON.UNKNOWN;
  const severity = unknown ? 'info' : 'warning';
  const trigger = unknown ? 'horizon_unknown' : 'declared_horizon';
  const out = [];

  // 의무가입기간이 이미 지났으면 추징 요건 자체가 성립할 수 없다 —
  // `isa.early_termination.clawback`은 "3년이 되는 날 전" 해지에만 걸린다.
  // 성립할 수 없는 불이익을 고지하면 하지 않아도 될 걱정을 시켜 옳은 행동을 막는다.
  // 4단계 교차검증 M2. 계약 8.4절을 함께 고쳤다.
  const isaLockInRemaining = boundaries.isa_lock_in_years_remaining ?? 0;

  for (const account of ACCOUNT_ORDER) {
    if (amounts[account] <= 0) continue;

    if (PENSION_ACCOUNTS.has(account)) {
      // 나이 요건만이 아니라 **가입 후 5년 요건까지 반영된 시점**을 함께 싣는다.
      // 55세에 가까운 사람이 계좌를 처음 여는 경우 실질 잠금기간은 5년이고,
      // 나이만 보고 만든 문구는 그 사람에게 틀린다.
      const startDate = startDates?.find((entry) => entry.account === account) ?? null;
      out.push({
        code: WARNING.PENSION_EARLY_WITHDRAWAL,
        account,
        severity,
        trigger,
        basis_rule_ids: [
          RULE.PENSION_EARLIEST_START,
          RULE.PENSION_WITHDRAWAL_ELIGIBILITY,
          RULE.PENSION_EARLY_WITHDRAWAL_RATE,
        ].sort(),
        params: {
          pension_min_age_years: boundaries.pension_min_age_years,
          pension_years_remaining: boundaries.pension_years_remaining,
          earliest_start_date: startDate?.earliest_start_date ?? null,
          years_until_earliest_start: startDate?.years_until_earliest_start ?? null,
          earliest_start_computable: startDate?.computable ?? false,
        },
      });
    } else if ((unknown || horizon === HORIZON.WITHIN_ISA_LOCK_IN) && isaLockInRemaining > 0) {
      out.push({
        code: WARNING.ISA_CLAWBACK,
        account,
        severity,
        trigger,
        basis_rule_ids: [RULE.ISA_CLAWBACK, RULE.ISA_ACCOUNT_REQUIREMENTS].sort(),
        params: {
          isa_lock_in_years: boundaries.isa_lock_in_years,
          isa_lock_in_years_remaining: boundaries.isa_lock_in_years_remaining,
        },
      });
    }
  }

  return out;
}

/**
 * 열려 있는 계좌 **전부**에 중도 불이익이 걸리는가 (D52 2번).
 *
 * 전액 미배분이라 실제 배분에는 경고가 붙지 않는다. 그래서 **가상의 배분**을 만들어
 * 같은 판정 함수에 묻는다 — 조건을 여기 다시 적으면 M2·M3·D18이 세 번 밟은 형태
 * (한 사실을 두 곳에 적고 한쪽만 고침)가 네 번째로 나온다.
 *
 * 금액 1원은 **「배분액이 0보다 크다」를 satisfy 하기 위한 표시**이고 계산에 쓰이지 않는다.
 */
function everyOpenAccountHasPenalty(ctx) {
  const open = ACCOUNT_ORDER.filter((account) => ctx.eligible[account]);
  if (open.length === 0) return false;

  const probe = Object.fromEntries(ACCOUNT_ORDER.map((a) => [a, ctx.eligible[a] ? 1 : 0]));
  const covered = new Set(warningsOf(probe, ctx).map((warning) => warning.account));
  return open.every((account) => covered.has(account));
}

/**
 * 금액으로 낼 수 없는 효과.
 *
 * 두 번째 항목이 D26의 자리다 — **세액공제를 낳지 않는 연금계좌 납입.** 세법이 유불리를
 * 정하지 않으므로(`not_determined_by_tax_law`) 엔진은 결론을 내지 않고, 대신 조문이
 * 정하는 사실 셋을 `facts`로 낸다. **이월 전환특례를 근거로 쓰지 않는다** — 매년 한도를
 * 채우는 사용자에게 전환할 자리가 없으므로 이 안의 근거가 될 수 없다.
 */
function nonQuantifiedOf(result, ctx) {
  const { state, withoutCreditFacts } = ctx;
  const amounts = result.amounts;
  const out = [];

  // **수익률 가정이 들어오면 이 효과는 더 이상 "금액으로 낼 수 없는 것"이 아니다.**
  // 규칙이 스스로 `quantifiable_conditionally: true`라고 적고 "사용자가 직접 주면 조건부
  // 산출은 추정이 아니다"라고 정한다. 가정이 있는데도 이 항목을 그대로 내보내면 응답이
  // 자기 자신과 어긋난다 — `assumption_based_isa_estimate`가 그 자리를 대신한다.
  if (amounts[ACCOUNT.ISA] > 0 && !ctx.isaReturn.supplied) {
    out.push({
      code: NON_QUANTIFIED.ISA_HEADROOM,
      account: ACCOUNT.ISA,
      headroom_krw: state.taxFreeLimit,
      headroom_shared_with: [],
      quantifiable: false,
      // 수익률은 세법 값이 아니고 룰셋에 없다. 가정을 만들지 않는다.
      reason_code: NON_QUANTIFIED.REASON_RETURN_UNKNOWN,
      facts: null,
      basis_rule_ids: [RULE.ISA_TAX_FREE_LIMIT, RULE.ISA_EXCESS_RATE, RULE.ISA_LOSS_OFFSET].sort(),
    });
  }

  if (withoutCreditFacts !== null) {
    for (const account of [ACCOUNT.PENSION, ACCOUNT.ANNUITY]) {
      const withoutCredit = result.withoutCredit[account] ?? 0;
      if (withoutCredit <= 0) continue;
      out.push({
        code: NON_QUANTIFIED.PENSION_WITHOUT_CREDIT,
        account,
        // 연금 두 계좌의 납입 한도는 **같은 풀**이다. 더하면 이중계상이므로
        // `LimitBreakdown.*_shared_with`와 같은 형태로 데이터가 스스로 말하게 한다.
        headroom_krw: result.pensionPoolRemaining,
        headroom_shared_with: [account === ACCOUNT.PENSION ? ACCOUNT.ANNUITY : ACCOUNT.PENSION],
        quantifiable: false,
        reason_code: NON_QUANTIFIED.REASON_DEFERRAL_UNKNOWN,
        facts: {
          credit_this_year_krw: withoutCreditFacts.credit_this_year_krw,
          contribution_without_credit_krw: withoutCredit,
          principal_taxed_on_withdrawal: withoutCreditFacts.principal_taxed_on_withdrawal,
          principal_tax_free_requires_confirmation:
            withoutCreditFacts.principal_tax_free_requires_confirmation,
          principal_tax_free_confirmation_prospective_only:
            withoutCreditFacts.principal_tax_free_confirmation_prospective_only,
          returns_taxed_on_withdrawal: withoutCreditFacts.returns_taxed_on_withdrawal,
        },
        basis_rule_ids: withoutCreditFacts.basis_rule_ids,
      });
    }
  }

  return out;
}

/**
 * 미배분 금액을 **갈래로 나눈다**(D26).
 *
 * 소유자가 지적한 것은 배분이 아니라 이름이었다. 사용자는 「미배분」을 "갈 곳이 없다"로
 * 읽는데 세법상 사실은 **"갈 곳은 있고, 다만 올해 공제는 늘지 않는다"**이다.
 *
 * **두 여력을 더하면 안 되는 경우가 있다.** 미배분액이 두 여력의 합보다 작으면 같은 돈을
 * 두 번 센 것이므로 `headrooms_overlap`이 그 사실을 값으로 말한다.
 */
function unallocatedBreakdownOf(result, unallocated, ctx) {
  const { eligible, state, horizonSuppression } = ctx;
  // 두 연금계좌가 모두 막혀 있으면 납입 여력이 남아 있어도 넣을 수 없다.
  const pensionOpen = eligible[ACCOUNT.PENSION] || eligible[ACCOUNT.ANNUITY];

  return {
    ...splitUnallocated({
      unallocated,
      pensionRoom: pensionOpen ? clampToZero(result.pensionPoolRemaining) : 0,
      isaRoom: clampToZero(result.isaPoolRemaining),
    }),
    // **왜 미배분인가**(D52 2번). 「한도가 남지 않아서」와 「그 시점에는 어느 계좌도
    // 이롭지 않아서」는 화면에서 다른 문장이 되고, 이름 하나로 두 뜻을 나르면
    // 화면이 그 둘을 구별할 수 없다. 미배분이 0원이면 설명할 것이 없으므로 `null`이다.
    reason_code: unallocated === 0 ? null : reasonFor(ctx),
    basis_rule_ids: [
      ...new Set([
        RULE.PENSION_CONTRIBUTION_LIMIT,
        RULE.PENSION_BEYOND_CREDIT_LIMIT,
        ...state.isaBasisRuleIds,
        // 시점 때문에 미배분이라면 **그 시점 판정의 근거**가 함께 나가야 한다.
        // 그 규칙들은 `fund-use-horizon.mjs`가 실제로 읽은 것뿐이다.
        ...(unallocated === 0 ? [] : horizonSuppression.basis_rule_ids),
      ]),
    ].sort(),
  };
}

/**
 * 미배분의 이유 코드.
 *
 * **「어느 계좌도 이롭지 않다」는 말이 참이려면 정말로 하나도 없어야 한다** (D53 1번).
 * 의무가입기간이 지난 ISA가 살아남아 실제로 돈을 받는 사용자에게 그 코드를 내면
 * 화면은 **방금 돈을 넣은 계좌를 가리키며 「이로운 계좌가 없습니다」**라고 말한다.
 * 그 사용자의 남은 돈은 ISA 납입 잔여 한도에서 멈춘 것이므로 이유는 한도다.
 */
function reasonFor({ horizonSuppression, eligible }) {
  const openAndBeneficial = ACCOUNT_ORDER.some(
    (account) => eligible[account] && !horizonSuppression.accounts[account],
  );
  return horizonSuppression.applies && !openAndBeneficial
    ? horizonSuppression.reason_code
    : UNALLOCATED_REASON.CONTRIBUTION_ROOM_EXHAUSTED;
}

/**
 * 미배분액을 두 여력과 나머지로 가르는 순수 산술. **밖으로 내보내 따로 시험한다.**
 *
 * 이유를 적어 둔다 — 지금의 네 충당 순서에서는 `headrooms_overlap`이 언제나 `false`다.
 * 네 순서 모두 ISA를 채우므로, 예산이 남았다는 것은 ISA 한도가 이미 찼다는 뜻이고
 * 그러면 ISA 여력이 0이라 겹칠 수가 없다. 그래서 **응답만 시험하면 이 갈래는 한 번도
 * 돌지 않고**, 돌지 않는 분기는 통과하면서 아무것도 막지 못한다. 산술을 떼어내
 * 겹치는 입력을 직접 넣어 본다.
 *
 * 필드를 지우지 않는 이유는 그것이 **화면에 대한 보증**이기 때문이다. 화면은 두 값을
 * 더해도 되는지를 규약이 아니라 데이터로 알아야 하고, 충당 순서가 바뀌면(예: ISA를
 * 끝까지 채우지 않는 안이 생기면) 이 값은 그날부터 참이 된다.
 */
export function splitUnallocated({ unallocated, pensionRoom, isaRoom }) {
  const pensionHeadroom = Math.min(unallocated, pensionRoom);
  const isaHeadroom = Math.min(unallocated, isaRoom);

  return {
    total_annual_krw: unallocated,
    pension_contribution_headroom_krw: pensionHeadroom,
    isa_contribution_headroom_krw: isaHeadroom,
    no_headroom_krw: clampToZero(unallocated - (pensionRoom + isaRoom)),
    headrooms_overlap: pensionHeadroom + isaHeadroom > unallocated,
  };
}

/**
 * 이 배분안이 이름으로 내세운 목적함수가 이 입력에서 순위를 정하지 못하는가.
 *
 * 한도가 0이면 연금계좌에 얼마를 넣든 공제액이 0이라 **최대값이 유일하지 않다.**
 * 그때 엔진이 조용히 아무 배분이나 고르고 `max_tax_credit`이라는 이름을 그대로 달면,
 * 근거 없는 답을 근거 있는 답처럼 내놓는 것이 된다. 이름이 실제 근거를 말해야 한다는
 * 원칙(D17·tie_break)이 여기서도 그대로 걸리므로, 이름을 유지하되 **그 이름이 이 입력에서
 * 아무것도 가르지 못한다는 사실을 값으로** 낸다.
 *
 * `isa_first`는 해당하지 않는다. 그 안의 근거는 세액공제가 아니라 인출 가능성이고
 * (`pension.withdrawal.eligibility`·`early_withdrawal.other_income_rate`), 한도가 0이어도
 * 그 사실은 그대로 성립한다. `pension_contribution_limit_fill`도 같다 — 그 안이 채우는
 * 것은 납입 한도이고 그 사실은 세액 한도와 무관하게 성립한다.
 */
const CREDIT_NAMED_PLANS = new Set([PLAN.MAX_CREDIT, PLAN.ANNUITY_FIRST]);

function objectiveDegenerate(planId, { cap }) {
  return cap.cap_krw === 0 && CREDIT_NAMED_PLANS.has(planId);
}

/**
 * 이 배분안의 월 표시 금액. **한도 여유를 어디서 읽는가가 이 함수의 전부다.**
 *
 * 잔차를 얹으면 그 갈래의 연간 납입이 (개월수 − 나머지)원 늘어난다. 그것이 한도를 넘지
 * 않으려면 **그 배분안을 실행한 뒤 남은 납입 한도**와 대야 하고, 그 값은 이미 배분 결과가
 * 들고 있다(`pensionPoolRemaining`·`isaPoolRemaining`). 배분 **전** 한도와 대면 이미
 * 배분된 몫을 두 번 세게 되어 한도를 넘길 수 있다.
 *
 * 나머지가 같을 때의 순서는 **그 배분안이 실제로 쓴 충당 순서**다. 잔차는 배분 결정이
 * 아니므로 우선순위를 다시 다투지 않는다(`monthly.mjs` 머리말).
 */
function monthlySplitOf(result, { unallocatedAnnual, months, capacity, ctx }) {
  const { eligible } = ctx;
  const pensionOpen = eligible[ACCOUNT.PENSION] || eligible[ACCOUNT.ANNUITY];
  const lastOrder = ACCOUNT_ORDER.length;

  const outcome = apportionMonthly({
    months,
    capacityMonthlyKrw: capacity,
    buckets: [
      ...ACCOUNT_ORDER.map((account) => ({
        id: account,
        annualKrw: result.amounts[account],
        poolId: account === ACCOUNT.ISA ? HEADROOM_POOL.ISA : HEADROOM_POOL.PENSION,
        // 돈을 받지 못한 계좌는 `fillOrder`가 없다. 그런 계좌는 나머지가 0이라 후보가
        // 되지 않지만, 순서를 미정으로 두지 않기 위해 고정 계좌 순서로 뒤에 세운다.
        orderIndex: result.fillOrder[account] ?? lastOrder + ACCOUNT_ORDER.indexOf(account),
      })),
      {
        id: MONTHLY_BUCKET.UNALLOCATED,
        annualKrw: unallocatedAnnual,
        // 한도가 없는 갈래. 어느 계좌에도 들어가지 않는 돈이다.
        poolId: null,
        orderIndex: lastOrder * 2,
      },
    ],
    poolHeadroomKrw: {
      // 두 연금계좌가 모두 막혀 있으면 납입 여력이 남아 있어도 넣을 수 없다
      // (`unallocatedBreakdownOf`와 같은 판정이다).
      [HEADROOM_POOL.PENSION]: pensionOpen ? clampToZero(result.pensionPoolRemaining) : 0,
      [HEADROOM_POOL.ISA]: eligible[ACCOUNT.ISA] ? clampToZero(result.isaPoolRemaining) : 0,
    },
  });

  const byId = new Map(outcome.buckets.map((bucket) => [bucket.id, bucket]));
  return {
    get: (id) => byId.get(id),
    unassignedMonthlyKrw: outcome.unassignedMonthlyKrw,
  };
}

/**
 * 이 안이 **목적 없이 IRP만 더 묶는가** — 그렇다면 선택지로 내지 않는다 (D53 3번).
 *
 * D52 후속은 「목적이 있는 안은 남긴다」고 정했고 관리자가 그 읽기를 **직접 깼다**.
 * `annuity_savings_first`와 `max_tax_credit`의 **절세액이 둘 다 0**인데 앞엣것이 IRP를
 * 더 묶는 좌표가 실재한다. **절세액이 0이면 그 안의 목적이 절세일 수 없다.**
 *
 * 그래서 「목적」을 이름이 아니라 **값**으로 잰다. 표시되는 세액공제액이 같고, 다른 두
 * 계좌가 한 원도 더 받지 못하며, 오직 IRP만 더 묶여 있으면 — 그 안이 사용자에게 주는
 * 것이 **중도인출 제한뿐**이다(`pension.withdrawal.midterm_restriction`). 고를 이유가
 * 없는 것이 아니라 **고르면 엄격하게 손해다.**
 *
 * **연금저축이나 ISA가 한 원이라도 더 들어가면 지배가 아니다.** 그때는 IRP 몫이 다른
 * 무엇과 맞바꿔진 것이고, 그 맞바꿈의 값어치는 이 엔진이 판정하지 않는다(과세이연·
 * 인출 자유는 조문이 유불리를 정하지 않는 축이다). **비교는 표시 금액으로 한다** —
 * 정확값으로 재면 어느 화면에도 안 나타나는 0.1원이 「다르다」가 되어 D53 2번이 방금
 * 닫은 구멍이 이 자리에서 다시 열린다.
 */
function dominatedByIrpLock(result, benefit, other) {
  if (benefit.pension_credit_total_krw !== other.credit) return false;
  if (result.amounts[ACCOUNT.PENSION] <= other.amounts[ACCOUNT.PENSION]) return false;
  return (
    result.amounts[ACCOUNT.ANNUITY] <= other.amounts[ACCOUNT.ANNUITY] &&
    result.amounts[ACCOUNT.ISA] <= other.amounts[ACCOUNT.ISA]
  );
}

export function buildPlans(ctx) {
  const { options, horizon, months, budget, capacity, access, cap } = ctx;
  const requested = options.plan_variants ?? PLAN_ORDER;

  // ── 금액 계산. 자금 사용 시점을 읽지 않는다. ──────────────────────
  const computed = new Map();
  for (const planId of PLAN_ORDER) {
    if (!requested.includes(planId)) continue;
    const result = allocate(planId, ctx);
    // **한도가 이 사용자에게 물었는가의 기준점**(`applyCap` 머리말). 트림이 실제로
    // 금액을 깎았을 때만 만든다 — 안 깎였으면 두 배분이 같아 기준점도 같다.
    // 이 배분은 **응답에 실리지 않는다.**
    const bindingExact = result.irpTrimmed
      ? creditIncomeTaxExact(allocate(planId, ctx, false), ctx).incomeTaxExact
      : null;
    computed.set(planId, { result, benefit: benefitOf(result, ctx, bindingExact) });
  }

  // ── 여기서부터 자금 사용 시점이 쓰인다. 금액은 이미 확정됐다. ──────
  let baselineId = BASELINE_BY_HORIZON[horizon];
  if (!computed.has(baselineId)) {
    baselineId = PLAN_ORDER.find((id) => computed.has(id));
  }
  const orderedIds = [baselineId, ...PLAN_ORDER.filter((id) => id !== baselineId && computed.has(id))];

  const plans = [];
  const seenVectors = new Set();
  /** 이미 남기기로 한 안의 (표시 세액공제액, 세 계좌 금액). 지배 판정의 상대다. */
  const kept = [];
  for (const planId of orderedIds) {
    const { result, benefit } = computed.get(planId);
    const vector = ACCOUNT_ORDER.map((a) => result.amounts[a]).join('|');
    if (seenVectors.has(vector)) continue;
    if (kept.some((other) => dominatedByIrpLock(result, benefit, other))) continue;
    seenVectors.add(vector);
    kept.push({ amounts: result.amounts, credit: benefit.pension_credit_total_krw });

    access.markUsed(RULE.CREDIT_RATE, 'plans[].deterministic_benefit');
    for (const ruleId of PRIORITY_BASIS[planId].basis_rule_ids) {
      access.markUsed(ruleId, 'plans[].priority_basis');
    }
    // 순서를 이 규칙으로 정했으면 화면이 근거를 보여줄 수 있어야 한다(헌장 고지 요소 3).
    for (const ruleId of tieBreakOf(planId, ctx).basis_rule_ids) {
      access.markUsed(ruleId, 'plans[].priority_basis');
    }

    const warnings = warningsOf(result.amounts, ctx);
    for (const warning of warnings) {
      for (const ruleId of warning.basis_rule_ids) access.markUsed(ruleId, 'plans[].warnings');
    }

    const totalAnnual = ACCOUNT_ORDER.reduce((sum, a) => sum + result.amounts[a], 0);
    const unallocatedAnnual = clampToZero(budget - totalAnnual);

    // 월 환산. **연간 금액이 확정된 뒤에 붙는다** — 위의 어떤 값도 월 금액을 읽지 않으므로
    // 「월 표시가 연 계산을 바꾸지 않는다」가 코드 구조로 참이 된다.
    const monthlySplit = monthlySplitOf(result, { unallocatedAnnual, months, capacity, ctx });

    const allocations = ACCOUNT_ORDER.map((account) => ({
      account,
      monthly_krw: monthlySplit.get(account).monthlyKrw,
      // **월 표시 금액 × 개월수다. 연 배분과 다를 수 있다**(monthly.mjs 머리말의 증명).
      // 화면이 직접 곱하게 두면 곱셈이 두 곳에 생기고, 둘이 갈리면 화면이 조용히 틀린다.
      monthly_annualized_krw: monthlySplit.get(account).monthlyAnnualizedKrw,
      // 이 계좌가 떠안은 월 환산 잔차(0 또는 1원/월). `monthly_krw = 내림 + 이 값`이다.
      monthly_rounding_adjustment_krw: monthlySplit.get(account).roundingAdjustmentMonthlyKrw,
      annual_krw: result.amounts[account],
      fill_order: result.fillOrder[account] ?? null,
      limited_by: result.limitedBy[account] ?? null,
      basis_rule_ids: basisForAccount(account, ctx, result.limitedBy[account] ?? null),
    }));

    const totalMonthly = allocations.reduce((sum, a) => sum + a.monthly_krw, 0);
    const unallocatedMonthly = monthlySplit.get(MONTHLY_BUCKET.UNALLOCATED);
    const unallocatedBreakdown = unallocatedBreakdownOf(result, unallocatedAnnual, ctx);
    for (const ruleId of unallocatedBreakdown.basis_rule_ids) {
      access.markUsed(ruleId, 'plans[].unallocated_breakdown');
    }

    const nonQuantified = nonQuantifiedOf(result, ctx);
    for (const effect of nonQuantified) {
      for (const ruleId of effect.basis_rule_ids) access.markUsed(ruleId, 'plans[].non_quantified_effects');
    }

    // 가정 기반 ISA 정산액. **금액 계산이 전부 끝난 뒤에 붙는다** — 위의 어떤 값도
    // 이 값을 읽지 않으므로 `echo.isa_return_affects`의 네 `false`가 코드 구조로 참이 된다.
    // 원금은 「가입 이후 누적 납입액 + 이 배분안의 ISA 배분액」이다.
    const isaEstimate = isaEstimateFor({
      context: ctx.isaReturn,
      display: ctx.isaEstimateDisplay,
      taxFreeLimitKrw: ctx.state.taxFreeLimit,
      principalKrw: ctx.isaCumulativeContributionKrw + result.amounts[ACCOUNT.ISA],
      surtaxRate: ctx.rates.surtaxRate,
    });
    if (isaEstimate !== null) {
      for (const ruleId of isaEstimate.basis_rule_ids) {
        access.markUsed(ruleId, 'plans[].assumption_based_isa_estimate');
      }
    }

    // 헤드라인 합계(D38). **정산액과 세액공제액이 다 나온 뒤에 붙는다** — 이 값은 그 둘의
    // 합이고, 어떤 금액도 이 값을 읽지 않으므로 목적함수에 들어갈 길이 없다.
    // **가정 성분이 들어가려면 이 안이 ISA에 실제로 넣은 돈이 있어야 한다**(headline.mjs).
    const headline = headlineCompositeTotalFor({
      determinedCreditKrw: benefit.pension_credit_total_krw,
      estimate: isaEstimate,
      isaAllocatedKrw: result.amounts[ACCOUNT.ISA],
      rule: ctx.headlineRule,
    });
    for (const ruleId of headline.basis_rule_ids) {
      access.markUsed(ruleId, 'plans[].headline_composite_total');
    }

    plans.push({
      plan_id: planId,
      is_baseline: false,
      warnings,
      priority_basis: {
        code: PRIORITY_BASIS[planId].code,
        // 표준 순서가 아니라 **실제로 쓴 순서**를 낸다. 순서 보고가 거짓말하면
        // 화면이 근거를 잘못 설명한다.
        fill_sequence: result.observedSequence,
        basis_rule_ids: [
          ...new Set([
            ...PRIORITY_BASIS[planId].basis_rule_ids,
            ...tieBreakOf(planId, ctx).basis_rule_ids,
          ]),
        ].sort(),
        tie_break: tieBreakOf(planId, ctx),
        objective_degenerate: objectiveDegenerate(planId, ctx),
      },
      allocations,
      total_allocated_monthly_krw: totalMonthly,
      total_allocated_annual_krw: totalAnnual,
      unallocated_monthly_krw: unallocatedMonthly.monthlyKrw,
      unallocated_monthly_rounding_adjustment_krw: unallocatedMonthly.roundingAdjustmentMonthlyKrw,
      unallocated_annual_krw: unallocatedAnnual,
      // 「미배분」이 "갈 곳이 없다"로 읽히지 않게 갈래를 나눈다(D26).
      unallocated_breakdown: unallocatedBreakdown,
      // **배분 전 잔여 한도가 아니라 배분 후 잔여 한도다.** 화면이 "한도 · 이 배분이 쓴 양 ·
      // 남은 양" 셋을 함께 적을 수 있어야 그 문장이 참이 된다. 뺄셈을 화면이 하게 두면
      // 세법 판단이 화면 코드로 새어 들어간다.
      pension_combined_credit_remaining_after_plan_krw: clampToZero(
        ctx.state.combinedLimit - benefit.credit_eligible_contribution_krw,
      ),
      // **연 배분을 개월수로 내림할 때 버려지는 몫의 합(원/연).** 값의 뜻은 계약
      // `1.0.0` 이래 그대로이고 값 자체도 그대로다 — 다만 `총 연 − 총 월 × 개월수`로
      // 다시 계산하면 더 이상 이 값이 나오지 않는다. 월 금액이 순수한 내림이 아니게
      // 되었기 때문이다(계약 0.12절). **잔차가 사라진 것이 아니라 갈 곳이 생겼다.**
      monthly_rounding_residual_krw: ACCOUNT_ORDER.reduce(
        (sum, account) => sum + (result.amounts[account] % months),
        0,
      ),
      // **그 잔차 중 끝내 어디에도 얹지 못한 몫(원/월).** 0이면 월 표시 금액 넷의 합이
      // 월 납입 여력과 정확히 같다. 0이 아니면 **합이 모자라는 것이 사실이고**, 그
      // 사실을 값으로 낸다 — 화면에서 반올림해 보이면 계좌별 금액의 합과 어긋난다.
      monthly_unassigned_krw: monthlySplit.unassignedMonthlyKrw,
      monthly_unassigned_reason_code:
        monthlySplit.unassignedMonthlyKrw > 0
          ? MONTHLY_UNASSIGNED_REASON.NO_DESTINATION_WITHIN_CONTRIBUTION_LIMIT
          : null,
      deterministic_benefit: benefit,
      delta_vs_baseline_krw: 0,
      non_quantified_effects: nonQuantified,
      // **`DeterministicBenefit`과 같은 축에 놓거나 더하면 안 된다.** 앞은 조문이 그
      // 과세연도에 대해 정하는 금액이고 이것은 사용자가 준 가정 위의 계산이다.
      // 요청에 `profile.isa_return_assumption`이 없으면 `null`이다.
      assumption_based_isa_estimate: isaEstimate,
      // **위 두 값을 더한 자리는 여기 하나뿐이다**(D38). 두 성분의 단위 기간이 달라
      // 합계에는 어느 기간도 붙지 않고, 확정과 가정의 구분은 구간의 두 끝이 진다.
      headline_composite_total: headline,
    });
  }

  plans[0].is_baseline = true;
  const baselineCredit = plans[0].deterministic_benefit.pension_credit_total_krw;
  for (const plan of plans) {
    plan.delta_vs_baseline_krw = plan.deterministic_benefit.pension_credit_total_krw - baselineCredit;
  }

  const comparisonNotes = [];
  if (plans.length === 1) comparisonNotes.push(COMPARISON_NOTE.PLANS_COLLAPSED_SINGLE);
  // 이 안내의 뜻은 "어느 배분안도 불이익을 피하지 못한다"이고, 계약은 이것을
  // 배분 비교보다 앞세우라고 지시한다.
  //
  // **`12.0.0`에서 재는 방법이 바뀌었다**(D52 2번). 전에는 「모든 안이 경고를 지고 있을
  // 때」로 재었는데, 이제 그 시점에는 **어느 안도 한 원을 넣지 않으므로 경고가 붙을 배분이
  // 없다.** 옛 조건을 그대로 두면 이 안내는 **어떤 입력에서도 나가지 않는 죽은 코드**가
  // 되고, 화면은 전액 미배분의 이유를 잃는다.
  //
  // **그렇다고 시점만 보고 내지는 않는다.** 그것이 정확히 M3이 고친 결함이다 — 성립하지
  // 않는 불이익을 「어느 안도 피하지 못한다」로 주장하던 자리. 그래서 **「이 시점에 이
  // 계좌에 돈을 넣었다면 불이익이 걸리는가」를 경고 판정 함수에 그대로 물어** 세 계좌가
  // 빠짐없이 걸릴 때만 낸다. 조건을 두 번 적지 않으므로 8.4절 경고 조건이 바뀌면
  // 이 안내도 함께 움직인다(M2가 ISA 경고를 좁혔을 때 놓쳐서 M3이 됐다).
  if (ctx.horizonSuppression.applies && everyOpenAccountHasPenalty(ctx)) {
    comparisonNotes.push(COMPARISON_NOTE.ALL_ACCOUNTS_PENALTY);
  }
  if (plans[0].plan_id !== PLAN.MAX_CREDIT) comparisonNotes.push(COMPARISON_NOTE.BASELINE_REORDERED);
  if (plans.length > 1 && plans.slice(1).some((p) => p.delta_vs_baseline_krw === 0)) {
    comparisonNotes.push(COMPARISON_NOTE.EQUAL_TAX_CREDIT);
  }
  // 한도가 0이면 모든 안의 공제액이 0이라 비교의 축이 사라진다. `alternatives_have_equal_tax_credit`
  // 만으로는 부족하다 — 그것은 "동률"이라고만 말하고 **왜** 동률인지, 그리고 그 동률이
  // 앞으로도 어떤 배분에서든 깨지지 않는다는 사실을 말하지 않는다.
  if (cap.cap_krw === 0) {
    comparisonNotes.push(COMPARISON_NOTE.TAX_CREDIT_AXIS_FLAT);
  }

  return { plans, comparisonNotes };
}

function basisForAccount(account, { state, horizonSuppression }, limitedBy) {
  // 시점 때문에 막혔으면 그 판정의 근거를 함께 낸다 — 화면이 계좌 옆에서 바로 읽는다.
  const horizonBasis =
    limitedBy === LIMITED_BY.FUND_USE_HORIZON ? horizonSuppression.basis_rule_ids : [];

  if (account === ACCOUNT.ISA) return [...new Set([...state.isaBasisRuleIds, ...horizonBasis])].sort();
  if (account === ACCOUNT.ANNUITY) {
    return [
      ...new Set([
        RULE.CREDIT_LIMIT_ANNUITY,
        RULE.CREDIT_LIMIT_COMBINED,
        RULE.PENSION_CONTRIBUTION_LIMIT,
        ...horizonBasis,
      ]),
    ].sort();
  }
  return [
    ...new Set([
      RULE.CREDIT_LIMIT_COMBINED,
      RULE.PENSION_CONTRIBUTION_LIMIT,
      ...horizonBasis,
      // **더 넣어도 공제가 늘지 않아 멈춘 자리**(D52 1번). 그 판정이 IRP에만 걸리는
      // 이유가 이 규칙이다 — 연금저축은 같은 제한을 받지 않는다.
      ...(limitedBy === LIMITED_BY.NO_ADDITIONAL_CREDIT ? [RULE.PENSION_MIDTERM_RESTRICTION] : []),
    ]),
  ].sort();
}
