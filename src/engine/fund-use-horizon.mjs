// 자금 사용 시점이 **금액을 바꾸는** 유일한 자리 (D52 2번).
//
// **D10을 뒤집은 것이 이 파일이다.** D10은 「자금 사용 시점은 금액을 바꾸지 않는다」고
// 정했고, 그 뒤로 `plans.mjs`의 구조가 그 진술을 코드로 보장해 왔다. 소유자가 그것을
// 뒤집었고 근거가 조문에 있다 — **3년 안에 쓸 돈이면 세 계좌 중 어느 것도 이롭지 않다.**
//
//   · ISA — 의무가입기간(`isa.account.requirements.min_contract_years`)을 못 채우고
//     해지하면 과세특례를 적용받은 세액을 **추징**한다(`isa.early_termination.clawback`).
//   · 연금계좌 — 55세 전 인출은 연금외수령이라 **기타소득세**가 붙는다
//     (`pension.early_withdrawal.other_income_rate` + 개인지방소득세 부가).
//
// 그 세율이 세액공제율보다 낮지 않다. **받은 것을 도로 내거나 더 낸다.**
//
// **판정은 계좌마다 따로 선다 (D53 1번).** ISA 쪽 근거는 「의무가입기간이 되는 날 전에
// 해지하면 추징한다」이고, **남은 의무가입기간이 0인 사용자에게는 그 요건이 성립하지
// 않는다.** 성립하지 않는 불이익을 이유로 그 계좌를 비우면 화면은 「넣지 마세요」를
// 말하면서 근거를 대지 못한다. 그래서 **그 경우 ISA는 배분을 유지한다.**
//
// **연금 두 계좌는 그대로 비운다.** 55세 전 인출이 연금외수령이라는 사실은 ISA
// 의무가입기간과 아무 관계가 없다 — 한쪽 요건이 소멸했다고 다른 쪽이 따라 소멸하지 않는다.
//
// **같은 사실을 계약이 이미 반쪽만 쓰고 있었다.** 8.5절이 `all_accounts_have_early_exit_penalty`를
// 끄는 조건에 「예: ISA 의무가입기간이 이미 지난 사용자」를 적어 두고, 배분을 비우는
// 자리(3.1절·5.13절)에서는 같은 사용자를 보지 않았다. **경고를 끄는 자리에서 보이는
// 사용자가 배분을 비우는 자리에서 안 보이면 그 둘 중 하나는 반드시 거짓이다.**
//
// **여기 세법 수치는 하나도 없다.** 연수도 세율도 전부 룰셋에서 읽고, 읽지 못하면
// 판정을 만들지 않고 멈춘다(`rule_missing`) — 근거를 대지 못하는 결론을 내지 않는다.
// **`0`도 세법 수치가 아니다** — 잔여 연수를 만든 것은 `boundaries.mjs`가 룰셋의
// `min_contract_years`에서 뺀 값이고, 여기서 재는 것은 「남은 것이 있는가」뿐이다.

import { ACCOUNT, ACCOUNT_ORDER, HORIZON, RULE, UNALLOCATED_REASON } from './constants.mjs';
import { effectiveRate } from './ratio.mjs';

const APPLIED_TO = 'plans[].unallocated_breakdown';

/** 어느 계좌도 비우지 않는 판정. 규칙을 한 건도 읽지 않은 상태다. */
function noSuppression() {
  return {
    applies: false,
    accounts: Object.fromEntries(ACCOUNT_ORDER.map((account) => [account, false])),
    reason_code: null,
    basis_rule_ids: [],
    facts: null,
  };
}

/**
 * 이 자금 사용 시점에서 **어느 계좌를 비우는가**.
 *
 * 반환값이 `null`이면 필요한 규칙·값을 읽지 못한 것이고, 부르는 쪽이 계산을 멈춘다.
 * `applies: false`면 이 시점에는 이 판정이 걸리지 않는다는 뜻이고 그때는 규칙을
 * 한 건도 읽지 않는다 — **읽지 않은 규칙을 근거로 싣지 않는다**는 규약 그대로다.
 *
 * `accounts`가 계좌별 답이고 `applies`는 「하나라도 비웠는가」다. 둘을 가른 이유는
 * `applies`가 재는 것이 **자금 사용 시점이 금액을 바꿨는가**이기 때문이다 — 가정
 * `fund_use_horizon_excluded_from_amounts`와 안내 `budget_exceeds_all_limits`가
 * 그 물음에 매달려 있고, ISA 하나가 살아남아도 그 답은 여전히 「바꿨다」다.
 *
 * @param {number|null} isaLockInYearsRemaining 남은 ISA 의무가입기간(년).
 *   `boundaries.mjs`가 룰셋의 `min_contract_years`에서 만든 값이다.
 */
export function resolveHorizonSuppression(access, { horizon, isaLockInYearsRemaining }) {
  if (horizon !== HORIZON.WITHIN_ISA_LOCK_IN) return noSuppression();

  // ISA 쪽 — 의무가입기간과 그 기간을 못 채웠을 때의 추징.
  const minContractYears = access.value(
    RULE.ISA_ACCOUNT_REQUIREMENTS,
    ['value', 'min_contract_years'],
    APPLIED_TO,
  );
  const clawback = access.value(RULE.ISA_CLAWBACK, ['value', 'rule'], APPLIED_TO);

  // 연금계좌 쪽 — 55세 전 인출에 붙는 기타소득세율. 지방소득세 부가율은 공제율에
  // 쓰는 것과 같은 규칙에서 읽는다(엔진이 두 자리에서 다른 부가율을 쓰지 않는다).
  const earlyWithdrawalRate = access.value(
    RULE.PENSION_EARLY_WITHDRAWAL_RATE,
    ['value', 'rate'],
    APPLIED_TO,
  );
  const surtaxRate = access.value(RULE.LOCAL_SURTAX, ['value', 'rate_of_income_tax'], APPLIED_TO);

  if (
    typeof minContractYears !== 'number' ||
    typeof clawback !== 'string' ||
    typeof earlyWithdrawalRate !== 'number' ||
    typeof surtaxRate !== 'number' ||
    typeof isaLockInYearsRemaining !== 'number'
  ) {
    return null;
  }

  // **ISA만 예외다** (D53 1번). 남은 의무가입기간이 없으면 추징 요건이 성립하지 않고,
  // 성립하지 않는 불이익은 배분을 비울 근거가 되지 못한다. 같은 판정을 `warningsOf`가
  // ISA 경고에 이미 걸고 있다 — 두 자리가 같은 사실을 보게 하는 것이 이 회차의 요지다.
  const isaPenaltyStands = isaLockInYearsRemaining > 0;

  return {
    applies: true,
    accounts: {
      [ACCOUNT.PENSION]: true,
      [ACCOUNT.ANNUITY]: true,
      [ACCOUNT.ISA]: isaPenaltyStands,
    },
    reason_code: UNALLOCATED_REASON.NO_ACCOUNT_BENEFICIAL,
    basis_rule_ids: [
      RULE.ISA_ACCOUNT_REQUIREMENTS,
      RULE.ISA_CLAWBACK,
      RULE.PENSION_EARLY_WITHDRAWAL_RATE,
      RULE.LOCAL_SURTAX,
    ].sort(),
    // 판정의 재료를 값으로 남긴다. **금액이 아니다** — 화면이 이 수로 "얼마를 잃는다"를
    // 만들면 안 된다(인출 시점의 운용수익과 수령 형태에 달려 있고 요청에 그 입력이 없다).
    facts: {
      isa_min_contract_years: minContractYears,
      pension_early_withdrawal_income_tax_rate: earlyWithdrawalRate,
      pension_early_withdrawal_local_tax_rate: surtaxRate,
      pension_early_withdrawal_effective_rate: effectiveRate(earlyWithdrawalRate, surtaxRate),
    },
  };
}
