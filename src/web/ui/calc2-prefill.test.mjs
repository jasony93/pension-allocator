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

// ---------------------------------------------------------------------------
// [2026-08-23, D83 소유자 지시 9번 / 판정 2] 수익률 프리필 — D77 판정 1·D79
// 판정 2의 명시 번복, 계산기2 한정. 예전에는 `buildCalc2PrefillForm()`이
// 수익률 관련 필드를 건드리지 않아 `initialForm()` 기본값(꺼짐·빈 값)이
// 그대로 남는다는 것을 이 시험이 확인했었다 — 이제는 반대로 5%가 채워져
// 있는지, 그리고 그 값이 여전히 고쳐 쓸 수 있는 시작값일 뿐(잠기지 않음)
// 인지를 확인한다. 첫 탭 무기본값(`state/store.test.mjs`의 "the screen
// never proposes or prefills a return rate")은 `initialForm()` 자체를
// 재는 시험이라 이 프리필과 무관하게 그대로 산다 — 계산기2는 그 기본값
// 위에 `buildCalc2PrefillForm()`을 덧씌운 결과로만 5%를 갖는다.
test('D83 판정 2 — 계산기2 프리필은 ISA 예상 수익률을 켜고 연 5%를 채운다', () => {
  const form = buildCalc2PrefillForm();
  assert.equal(form.isaReturnEnabled, true, '계산기2 프리필은 수익률 토글을 켜 둬야 한다');
  assert.equal(form.isaReturnRatePercent, '5', '계산기2 프리필의 수익률 기본값은 5여야 한다');
  assert.equal(form.isaIncomeCharacter, 'mixed_or_unknown', '수익률 토글을 켤 때와 같은 소득 성격 기본값이어야 한다');
});

test('D83 판정 2 — 계산기2 프리필의 수익률은 잠기지 않은 시작값이다(편집 후 다른 값으로 덮어써진다)', () => {
  const form = { ...initialForm(), ...buildCalc2PrefillForm(), isaReturnRatePercent: '7.5' };
  assert.equal(form.isaReturnRatePercent, '7.5', '프리필 뒤에도 사용자가 고친 값이 그대로 남아야 한다');
});

test('D77 판정 1 — 계산기2와 무관한 첫 탭 기본 폼(`initialForm`)은 여전히 수익률을 프리필하지 않는다(회귀)', () => {
  // `buildCalc2PrefillForm()`을 덧씌우지 않은 순수 `initialForm()` — 첫
  // 탭·역산기가 실제로 쓰는 그 상태다. D83 판정 2는 계산기2 프리필
  // 함수에만 5%를 넣었을 뿐, 이 기본값 자체는 바꾸지 않았다.
  const form = initialForm();
  assert.equal(form.isaReturnEnabled, false);
  assert.equal(form.isaReturnRatePercent, '', '계산기2 프리필과 무관하게 첫 탭 기본 폼은 빈 값이어야 한다');
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
