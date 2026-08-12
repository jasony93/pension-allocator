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
// **여기 세법 수치는 하나도 없다.** 연수도 세율도 전부 룰셋에서 읽고, 읽지 못하면
// 판정을 만들지 않고 멈춘다(`rule_missing`) — 근거를 대지 못하는 결론을 내지 않는다.

import { HORIZON, RULE, UNALLOCATED_REASON } from './constants.mjs';
import { effectiveRate } from './ratio.mjs';

const APPLIED_TO = 'plans[].unallocated_breakdown';

/**
 * 이 자금 사용 시점에서 **어느 계좌에도 넣지 않는가**.
 *
 * 반환값이 `null`이면 필요한 규칙·값을 읽지 못한 것이고, 부르는 쪽이 계산을 멈춘다.
 * `applies: false`면 이 시점에는 이 판정이 걸리지 않는다는 뜻이고 그때는 규칙을
 * 한 건도 읽지 않는다 — **읽지 않은 규칙을 근거로 싣지 않는다**는 규약 그대로다.
 */
export function resolveHorizonSuppression(access, { horizon }) {
  if (horizon !== HORIZON.WITHIN_ISA_LOCK_IN) {
    return { applies: false, reason_code: null, basis_rule_ids: [], facts: null };
  }

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
    typeof surtaxRate !== 'number'
  ) {
    return null;
  }

  return {
    applies: true,
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
