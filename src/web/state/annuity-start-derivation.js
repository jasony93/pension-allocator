/**
 * [D79 판정 3] 「지금 연금을 받고 계신가요?」를 계산기2 화면에서 없애되,
 * 물음 없이 답을 지어내지 않는다. 시행령 §40조의2③1 — **만 55세 미만은
 * 연금 수령 개시가 조문상 불가**하므로, 그 나이 미만이면 "아직 받지 않는다"
 * (`annuityStarted: false`)가 조문으로 정해진 값이지 화면의 짐작이 아니다.
 *
 * **55라는 숫자를 여기 박지 않는다.** 그 나이는 `computeFundUseHorizonBoundaries`
 * (`engine-interface.md` 5.9절)가 룰셋에서 읽어 낸 `pension_min_age_years`로만
 * 안다. 이 파일은 그 응답에서 이미 계산된 `pension_years_remaining`(만 나이
 * 환산도 포함해 엔진이 낸 값)만 읽는다 — 나이도, 55도 화면이 계산하지 않는다.
 *
 * 반환값 셋 —
 * - `false` — 개시 연령까지 남은 해가 있다(`pension_years_remaining > 0`).
 *   **확실히 미개시다** — 묻지 않고 이 값을 쓴다.
 * - `null` — 아직 판단할 수 없다. `boundaries`가 없거나(생년월일 미입력·
 *   형식 오류), 남은 해가 0이면(이미 개시 연령에 닿았거나 지났다 — 어느
 *   쪽인지는 이 값만으로 갈리지 않는다, `FundUseHorizonBoundaries`가 "잔여
 *   0"으로 두 경우를 함께 표현한다) **물어야 한다.**
 *
 * `true`(개시했다)는 이 함수가 절대 내지 않는다 — "받고 있다"는 사실은
 * 조문에서 도출되지 않는다. 오직 사용자의 명시적 진술만이 그 값을 만든다
 * (이 파일 밖, 화면의 물음).
 */
export function deriveAnnuityStartedFromBoundaries(boundaries) {
  if (!boundaries || typeof boundaries.pension_years_remaining !== 'number') return null;
  if (!Number.isFinite(boundaries.pension_years_remaining)) return null;
  return boundaries.pension_years_remaining > 0 ? false : null;
}
