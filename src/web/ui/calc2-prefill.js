/**
 * [D79 판정 2] 계산기2가 시작할 때 채우는 김철수씨 값. **첫 탭 예시
 * (`ui/example-showcase.js`)의 1행과 같은 사람, 같은 숫자**(만 30세·
 * 총급여 4,000만원·월 150만원)를 그대로 재사용한다 — 새 상수를 따로
 * 만들면 두 화면의 "김철수씨"가 서로 다른 나이·소득을 말할 수 있게 된다.
 *
 * **수익률은 프리필하지 않는다**(D77 판정 1 유지, D79 판정 2가 재확인).
 * `isaReturnEnabled` 등은 여기서 아예 건드리지 않는다 — `initialForm()`의
 * 기본값(꺼짐)이 그대로 남는다.
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

export function buildCalc2PrefillForm() {
  return {
    birthDate: exampleBirthDate(TAX_YEAR),
    currentSalary: String(EXAMPLE_SALARY_MANWON),
    hasNonWageIncome: false,
    monthlyCapacity: String(EXAMPLE_MONTHLY_CAPACITY_MANWON),
    fundUseHorizon: 'unknown',
  };
}

export { EXAMPLE_AGE_YEARS as CALC2_PREFILL_AGE_YEARS };
