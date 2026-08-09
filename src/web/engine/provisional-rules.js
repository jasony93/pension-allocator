/**
 * 아직 법으로 정해지지 않은 상태를 화면이 말하려면 **룰셋에서 읽어야 한다.**
 *
 * 청년 우대(`proposed.pension.credit.youth_irp_rate`)의 연령 범위는 시행령 위임이고
 * 시행령 개정안이 아직 공개되지 않아 룰셋에 `age_range: null`로 들어 있다.
 * 세제개편안 상세본이 특정 연령대로 설명했지만 **조문이 아니므로** 화면이 그
 * 숫자를 쓰면 출처 없는 숫자를 말하는 것이 된다(제품 원칙 1·2, `screens.md`
 * 3.9.2절). 그래서 화면은 숫자를 갖지 않고, 룰셋이 값을 실을 때만 그 줄이 켜지는
 * 구조로 둔다 — `HorizonChoiceGroup`의 보조 캡션과 정확히 같은 처리다.
 *
 * **왜 엔진 응답이 아니라 룰셋을 직접 읽는가.** 이 블록은 입력 패널에 있고,
 * 사용자가 아직 아무것도 계산하지 않은 시점에도 그려져야 한다. 그때는
 * `scenario.legal_basis`가 없다. `LawChip`이 담을 문자열(`source.law`)과 연령 범위
 * 유무는 룰셋에만 있으므로 여기서 읽는다 — 화면이 지어내는 것이 아니라 룰셋에서
 * 가져온다는 규약(design-system 5.9절)은 그대로다.
 *
 * 순수 함수다. 파싱된 룰셋 맵을 받아 필요한 것만 뽑는다.
 */

/** 청년 우대 규칙의 id. 세법 수치가 아니라 룰셋의 식별자다. */
export const YOUTH_PENSION_RULE_ID = 'proposed.pension.credit.youth_irp_rate';

function findRule(rulesets, ruleId) {
  for (const file of Object.values(rulesets ?? {})) {
    if (!file || !Array.isArray(file.rules)) continue;
    const rule = file.rules.find((r) => r && r.id === ruleId);
    if (rule) return rule;
  }
  return null;
}

/**
 * 화면이 청년 블록을 그리는 데 필요한 것만 낸다.
 *
 * - `law` / `billStage` — `LawChip`과 `ProposedBadge`에 그대로 들어간다.
 * - `ageRange` — **화면에 인쇄하지 않는다.** 해당 여부를 판정하는 데만 쓰이고,
 *   `null`이면 판정 자체를 하지 않는다.
 *
 * 규칙이 룰셋에 없으면 `null` — 그러면 화면은 이 블록을 그리지 않는다.
 * (`LawChip` 없는 세법 서술을 화면에 두지 않는다, design-system 5.28절)
 */
export function youthProvisionalRule(rulesets) {
  const rule = findRule(rulesets, YOUTH_PENSION_RULE_ID);
  if (!rule || !rule.source || typeof rule.source.law !== 'string') return null;
  const ageRange = rule.value?.age_range ?? null;
  return {
    ruleId: rule.id,
    law: rule.source.law,
    billStage: rule.bill_stage ?? null,
    ageRange: normalizeAgeRange(ageRange),
  };
}

/**
 * 룰셋의 연령 범위를 `{ minAge, maxAge }`로 정규화한다. 형태가 정해지지 않았으므로
 * 두 가지를 받아들인다 — `{ min_age, max_age }` 객체와 `[min, max]` 배열.
 * **값을 지어내지 않는다.** 알아볼 수 없으면 `null`이고, `null`이면 아무 줄도
 * 그려지지 않는다.
 */
export function normalizeAgeRange(ageRange) {
  if (ageRange == null) return null;
  if (Array.isArray(ageRange) && ageRange.length === 2) {
    const [minAge, maxAge] = ageRange;
    return Number.isInteger(minAge) && Number.isInteger(maxAge) ? { minAge, maxAge } : null;
  }
  if (typeof ageRange === 'object') {
    const minAge = ageRange.min_age ?? ageRange.minAge;
    const maxAge = ageRange.max_age ?? ageRange.maxAge;
    if (Number.isInteger(minAge) && Number.isInteger(maxAge)) return { minAge, maxAge };
  }
  return null;
}

/**
 * 이 사람의 만 나이가 룰셋의 청년 연령 범위 안인가.
 *
 * **나이를 만들지 않는다.** 인자로 받는 `ageYears`는 엔진이 낸 `echo.derived_age`의
 * 값이다 — 어느 날짜를 기준으로 세는지는 세법 판단이고 화면이 정하지 않는다(D21).
 * 여기서 하는 일은 룰셋이 실은 범위와의 **비교**뿐이고, 그 결과도 화면에 숫자로
 * 나가지 않는다(해당 여부만 쓴다).
 *
 * 범위가 없거나 나이를 모르면 `false` — 판정하지 않았다는 뜻이고, 그때 화면은
 * 발표 기준 해당 여부를 말하는 줄을 그리지 않는다.
 */
export function isWithinYouthAgeRange(ageRange, ageYears) {
  const range = normalizeAgeRange(ageRange);
  if (!range || !Number.isInteger(ageYears)) return false;
  return ageYears >= range.minAge && ageYears <= range.maxAge;
}
