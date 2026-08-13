/**
 * 개정안 시나리오가 확정 시나리오와 **화면에 보이는 결과**에서 같은지를 잰다
 * (D46 4번, 관리자 판정).
 *
 * 소유자가 신고한 것: "개정안 탭 안의 내용이 확정 세법 기준과 똑같이 나온다".
 * 관찰은 맞지만 소유자 입력이 우연히 개정예고 규칙 12건 중 어디에도 걸리지
 * 않았을 뿐이다 — 청년 퇴직연금 공제율(소득 무관 15%)·ISA 미납분 이월
 * 폐지·계약기간 5년 상한·생산적금융 ISA처럼 실제로 결과를 바꾸는 규칙이
 * 여럿 있다. 그래서 "항상 같다"고 가정해 탭 내용을 통째로 한 줄로 바꾸면
 * 그 규칙에 걸리는 사용자에게서 실제 차이가 조용히 사라진다.
 *
 * **새 세법 판단이 아니다.** 엔진이 두 시나리오를 이미 각각 계산해서
 * `EngineResponse.scenarios`로 낸다 — 이 모듈은 그 두 응답을 대조할 뿐이다.
 *
 * **무엇을 비교하는가 — 화면에 보이는 것만.** `scenario_id`·`is_enacted`·
 * `ruleset`(연도·상태)·`bill_stages`·`legal_basis`·`unapplied_proposed_rules`는
 * 뺀다. 앞 셋은 시나리오가 다르면 **항상** 다른 정체성 필드라 넣으면 두
 * 시나리오가 결코 "같다"고 판정되지 않는다(비교 자체가 무의미해진다). 뒤
 * 셋은 D46 2·3번으로 화면이 더 이상 렌더하지 않는 조항·개정 단계 표시다 —
 * 화면에 안 보이는 값이 다르다고 해서 사용자가 보는 결과가 다른 것은 아니다
 * (`bill_stages`·`unapplied_proposed_rules`는 애초에 어느 화면 함수도 읽지
 * 않는다는 것을 `result-panel.js`에서 확인했다).
 *
 * **`basis_rule_ids`는 어디에 나오든 뺀다.** 실측으로 잡았다 — 같은 값이라도
 * 확정·개정예고 룰셋은 서로 다른 rule id로 그 값을 정의한다(예: ISA 연간
 * 납입한도가 확정에서는 `isa.contribution.annual_limit`, 개정안에서는
 * `proposed.isa.annual_contribution_limit`). 이 필드를 넣으면 **금액이 한 원도
 * 다르지 않아도** `allocations[].basis_rule_ids`·`priority_basis.tie_break.
 * basis_rule_ids` 등이 항상 갈려 "같다"가 사실상 성립할 수 없는 비교가
 * 된다 — D59로 `LawChip`이 남은 두 자리(배제 사유·법정 순서 태그)에서도
 * 정작 사용자가 읽는 것은 조항 **문구**(`entry.law`)이지 rule id 문자열이
 * 아니다. D46 2·3번·D59로 화면 대부분에서 조항 인용 자체가 빠졌으므로 이
 * 필드는 비교 목적에서 "안 보이는 값"으로 취급한다.
 *
 * `notices`에서는 셋을 뺀다. **실제 엔진(`src/engine/`)에 요청을 넣어 실측하고
 * 정했다** — mock이 아니라 `src/engine/compute.mjs`를 직접 불러 확인했다.
 *
 * - `proposed_not_enacted` — 시나리오가 개정안이라는 사실 자체를 알리는
 *   것이라(고지 ⑥) 정의상 확정 시나리오에는 없고, 남겨두면 위 정체성
 *   필드들과 같은 이유로 비교가 무의미해진다.
 * - `youth_status_not_declared` — `scenario === 'proposed'`이고
 *   `declared_youth !== true`이면 **입력과 무관하게 항상** 실린다(청년
 *   우대가 개정안에만 있는 개념이라는 사실 자체를 알릴 뿐이고
 *   `basis_rule_ids`도 비어 있다). 넣으면 개정예고 규칙 12건 중 아무것도
 *   걸리지 않은 입력에서도 "같다"가 성립하지 않는다.
 * - `isa_tenure_missing` — **이 화면은 `accounts.isa.years_since_opening`을
 *   애초에 묻지 않는다**(게이트 2 D13, 화면에서 뺀 선택 입력 4개 중 하나).
 *   그래서 이 값은 모든 요청에서 항상 `null`이고, 확정 시나리오는 그때마다
 *   `isa_tenure_missing`을 낸다(`isa.contribution.annual_limit`이 그 값을
 *   변수로 쓰므로) — 반면 개정안의 정액 한도(`proposed.isa.annual_
 *   contribution_limit`)는 그 변수를 아예 쓰지 않아 같은 안내가 나갈 수
 *   없다. 즉 **이 안내의 유무는 사용자 입력이 아니라 이 화면이 그 필드를
 *   묻지 않기로 한 결정에서만 갈린다.** 실제 엔진으로 두 좌표(ISA 신규·
 *   ISA 연령배제)를 직접 확인해 이 안내만 다르고 `limits.by_account[isa].
 *   contribution_limit_remaining_krw`는 두 시나리오가 같은 값(두 좌표 각각
 *   20,000,000원 · 0원)임을 검증했다 — 조문상 "0년 신규 계좌" 기본값과
 *   개정안 정액이 우연이 아니라 구조적으로 같은 자리에서 갈라지지 않는다.
 *
 * 나머지 notice는 실제로 화면 문구를 바꾸거나 사용자 입력에 따라 달라지므로
 * (예: `credit_rate_global_income_missing`) 그대로 비교한다.
 */

const NOTICE_CODES_ALWAYS_DIFFER = new Set(['proposed_not_enacted', 'youth_status_not_declared', 'isa_tenure_missing']);

function normalizedNotices(notices) {
  return (notices ?? []).filter((n) => !NOTICE_CODES_ALWAYS_DIFFER.has(n.code));
}

/**
 * `basis_rule_ids` 키를 어느 깊이에서든 제거한 깊은 복사본. 배열/객체만
 * 재귀한다 — 원시값은 그대로 둔다. 값을 바꾸지 않는다, 오직 그 한 키만 뺀다.
 */
function stripBasisRuleIds(value) {
  if (Array.isArray(value)) return value.map(stripBasisRuleIds);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'basis_rule_ids') continue;
      out[k] = stripBasisRuleIds(v);
    }
    return out;
  }
  return value;
}

/** 비교에 실제로 쓰는 부분 — 값이 아니라 화면이 읽는 필드만 골라낸다. */
export function scenarioDisplaySnapshot(scenario) {
  return stripBasisRuleIds({
    account_eligibility: scenario?.account_eligibility ?? null,
    limits: scenario?.limits ?? null,
    pension_credit_tax_liability_cap: scenario?.pension_credit_tax_liability_cap ?? null,
    pension_credit_ceiling: scenario?.pension_credit_ceiling ?? null,
    pension_withdrawal_tax_reference: scenario?.pension_withdrawal_tax_reference ?? null,
    pension_withdrawal_start: scenario?.pension_withdrawal_start ?? null,
    isa_transfer_extra_limit: scenario?.isa_transfer_extra_limit ?? null,
    fund_use_horizon_boundaries: scenario?.fund_use_horizon_boundaries ?? null,
    plans: scenario?.plans ?? null,
    comparison_note_codes: scenario?.comparison_note_codes ?? null,
    notices: normalizedNotices(scenario?.notices),
  });
}

/**
 * 두 시나리오가 화면에 보이는 결과에서 같은가. 순서에 안정적인 `JSON.stringify`
 * 비교다 — 두 응답이 같은 계약(같은 필드 순서)에서 나오므로 충분하다.
 */
export function scenarioDisplaysEqual(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(scenarioDisplaySnapshot(a)) === JSON.stringify(scenarioDisplaySnapshot(b));
}
