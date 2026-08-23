/**
 * [D79 판정 2] 계산기2가 시작할 때 채우는 김철수씨 값. **첫 탭 예시
 * (`ui/example-showcase.js`)의 1행과 같은 사람, 같은 숫자**(만 30세·
 * 총급여 4,000만원·월 150만원)를 그대로 재사용한다 — 새 상수를 따로
 * 만들면 두 화면의 "김철수씨"가 서로 다른 나이·소득을 말할 수 있게 된다.
 *
 * **수익률은 [2026-08-23, D83 판정 2]부터 프리필한다 — D77 판정 1·D79
 * 판정 2의 명시 번복, 계산기2 한정.** 종전에는 여기서 `isaReturnEnabled`
 * 등을 아예 건드리지 않아 `initialForm()`의 기본값(꺼짐·빈 값)이 그대로
 * 남았다. 지금은 토글을 켜고 연 5%를 채운다 — 「서비스가 제시하는
 * 수익률」이 아니라 「예시 인물(김철수씨)이 정한 값, 편집 가능」이라는
 * 성격을 유지하기 위해 이 프리필 틀 안에 넣는다(D79 판정 2의 프리필 틀
 * 그대로, 값만 새로 추가). 소득 성격(`isaIncomeCharacter`)은 화면에서
 * 토글을 직접 켤 때와 같은 값 `'mixed_or_unknown'`을 채운다
 * (`ui/calc2-input-panel.js`의 `returnToggle.onChange`가 쓰는 값과 같다
 * — 계약 3.6절의 "모른다" 값, 화면이 새로 지어낸 답이 아니다). 이 값은
 * 계산기2 입력 화면에서 그대로 고쳐 쓸 수 있다 — 프리필은 시작값일 뿐
 * 잠그지 않는다. 첫 탭·역산기는 이 프리필을 쓰지 않으므로 무기본값이
 * 그대로 산다.
 *
 * **연금 수령 여부(`annuityStarted`)도 여기서 채우지 않는다** — 김철수씨는
 * 만 30세라 조문상 미개시가 확실하지만, 그 판단은 하드코딩이 아니라
 * `state/annuity-start-derivation.js`가 실제 `computeFundUseHorizonBoundaries`
 * 응답에서 도출한다(D79 판정 3). 이 프리필은 그 도출이 돌 수 있도록
 * 생년월일만 채운다.
 *
 * **자금 사용 시점(`fundUseHorizon`)은 `'unknown'`으로 채운다** — 첫 탭
 * 예시와 같은 값(`buildExampleForm`)이고, 「추가 정보」 접힘 안에 있어도
 * 계산을 막지 않아야 "결과가 바로 서 있다"(D79 판정 2)가 성립한다.
 */
import { EXAMPLE_AGE_YEARS, EXAMPLE_SALARY_MANWON, EXAMPLE_MONTHLY_CAPACITY_MANWON, exampleBirthDate } from './example-showcase.js';
import { TAX_YEAR } from '../state/store.js';

/** [2026-08-23, D83 소유자 지시 9번] 프리필되는 연 수익률(%) — 편집 가능한 시작값. */
export const CALC2_PREFILL_ISA_RETURN_RATE_PERCENT = '5';

export function buildCalc2PrefillForm() {
  return {
    birthDate: exampleBirthDate(TAX_YEAR),
    currentSalary: String(EXAMPLE_SALARY_MANWON),
    hasNonWageIncome: false,
    monthlyCapacity: String(EXAMPLE_MONTHLY_CAPACITY_MANWON),
    fundUseHorizon: 'unknown',
    isaReturnEnabled: true,
    isaReturnRatePercent: CALC2_PREFILL_ISA_RETURN_RATE_PERCENT,
    isaIncomeCharacter: 'mixed_or_unknown',
  };
}

export { EXAMPLE_AGE_YEARS as CALC2_PREFILL_AGE_YEARS };
