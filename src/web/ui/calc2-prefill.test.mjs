import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalc2PrefillForm } from './calc2-prefill.js';
import { initialForm, buildEngineRequest } from '../state/store.js';

/**
 * [2026-08-21, D80 판정 1] "계산기2는 올해 이미 넣은 돈을 묻지 않고 0으로
 * 가정한다"를 엔진 요청 조립부(`buildEngineRequest`, 첫 탭·계산기2가
 * 공유하는 바로 그 함수)에서 직접 잠근다.
 *
 * **계산기2가 실제로 낼 수 있는 폼만 쓴다.** `ui/calc2-input-panel.js`가
 * 이 네 필드(연금저축·IRP 당해연도 누적, ISA 가입 이후 누적·당해연도
 * 누적)의 입력 자체를 그리지 않으므로, 계산기2의 폼은 `initialForm()`
 * 기본값(빈 문자열)에서 이 네 필드가 절대 벗어나지 않는다 — 프리필
 * (`buildCalc2PrefillForm`)도 이 필드들을 건드리지 않는다. 그래서 "프리필
 * 경로"와 "사용자가 다른 필드를 편집한 경로"를 각각 폼으로 흉내 내
 * 둘 다 0을 내는지 확인한다.
 */
function accountYtdValues(request) {
  return {
    annuitySavingsYtd: request.accounts.annuity_savings.ytd_contribution_krw,
    retirementPensionYtd: request.accounts.retirement_pension.ytd_contribution_krw,
    isaCumulative: request.accounts.isa.cumulative_contribution_krw,
    isaYtd: request.accounts.isa.ytd_contribution_krw,
  };
}

test('D80 판정 1 — 계산기2 프리필 폼 그대로는 네 계좌 누적값이 전부 0이다', () => {
  const form = { ...initialForm(), ...buildCalc2PrefillForm() };
  const request = buildEngineRequest(form, ['current']);
  assert.deepEqual(accountYtdValues(request), {
    annuitySavingsYtd: 0,
    retirementPensionYtd: 0,
    isaCumulative: 0,
    isaYtd: 0,
  });
});

test('D80 판정 1 — 계산기2에서 편집 가능한 다른 필드(생년월일·소득·ISA 보유 등)를 바꿔도 네 계좌 누적값은 여전히 0이다', () => {
  // 계산기2에 남아 있는 필드만 건드린다 — 지워진 네 필드(annuitySavingsYtd
  // 등)는 이 폼에 아예 등장하지 않는다(제거된 입력이라 사용자가 값을 넣을
  // 경로 자체가 없다).
  const form = {
    ...initialForm(),
    ...buildCalc2PrefillForm(),
    birthDate: '1990-05-12',
    currentSalary: '8000',
    monthlyCapacity: '300',
    hasNonWageIncome: true,
    globalIncomeAmount: '1000',
    isaExists: true,
    isaAccountType: 'low_income',
    isaFinancialIncomeTaxpayer: 'no',
    isaReturnEnabled: true,
    isaReturnRatePercent: '5',
    isaIncomeCharacter: 'listed_equity_capital_gain',
  };
  const request = buildEngineRequest(form, ['current']);
  assert.deepEqual(accountYtdValues(request), {
    annuitySavingsYtd: 0,
    retirementPensionYtd: 0,
    isaCumulative: 0,
    isaYtd: 0,
  });
});
