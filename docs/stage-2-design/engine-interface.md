---
unit: calc-engine-dev
stage: 2
status: approved
inputs:
  - docs/org/charter.md
  - docs/org/gate-decisions.md
  - docs/stage-1-discovery/requirements.md
  - docs/stage-1-discovery/tax-rules-report.md
  - docs/stage-2-design/engine-design.md
  - data/tax-rules/2026.json
  - data/tax-rules/2027-proposed.json
open_questions:
  - "requirements.md 2절의 입력 항목에 없는 필드를 넷 추가했다 — months_remaining_in_tax_year(2.3절), accounts.isa.years_since_opening(ISA 연간 한도 산식에 필요), accounts.isa.other_savings_contract_krw(총 납입한도 차감에 필요), isa_transfer.destination(연금저축 단독 한도 판정에 필요). 넷 다 룰셋의 규칙을 계산하려면 없으면 안 되는 값이다. requirements.md 개정이 필요한지 관리자 판정이 필요하다."
  - "개정안 시나리오는 전환 추가한도 상한에서 차감할 과거 적용액의 대상 기간이 넓어진다(proposed.productive_isa.pension_transfer.credit_extra_limit). 그 기간에 대응하는 입력 isa_transfer.prior_multi_year_applied_extra_credit_krw를 선택 필드로 두었으나, 사용자가 이 값을 알기 어렵다. null일 때 직전 1개 과세기간 값으로 대신하면 추가한도가 과대 산출될 수 있어 notice를 내도록 했다. 입력 화면에서 어떻게 물을지 product-planner·designer와 조율이 필요하다."
  - "오류·경고·안내의 사용자 표시 문구를 엔진이 만들지 않고 코드와 파라미터만 낸다(7절). 코드에 대응하는 문구 사전을 designer가 만들어야 한다. 게이트 2 D10으로 경고 코드 두 건이 새로 생겼고(8.4절) screens.md는 아직 그 반영 전이므로, 후속 2차 작업에서 대조가 필요하다."
  - "fund_use_horizon 선택지 캡션의 연수는 사용자의 나이와 ISA 가입경과연수에 따라 달라지므로, 그 둘이 아직 비어 있는 동안에는 캡션을 띄울 수 없다. 경계값 전용 진입점(9절)을 넣어 조회 자체는 가볍게 만들었으나, 캡션이 없는 상태에서 선택지를 어떻게 보일지는 화면의 문제로 남는다. designer와 조율이 필요하다."
  - "연금계좌 가입 경과연수 입력이 없어 pension.withdrawal.eligibility의 보유기간 요건을 반영하지 못한다. 경고가 실제보다 약하게 나갈 수 있고, 입력 항목을 늘릴지는 product-planner·관리자 판정이다. 현재는 assumptions에 담아 드러내는 것으로 처리했다."
---

# 2단계 설계 — 엔진 인터페이스 (web-dev와의 계약)

**이 문서는 계약이다.** 게이트 2에서 고정되고 이후 변경은 관리자 승인이 필요하다. 3단계에서 `web-dev`가 여기에 목(mock)을 물려 병렬로 UI를 만든다.

알고리즘과 판단 근거는 `engine-design.md`에 있다. 이 문서는 **무엇이 오가는가**만 정한다.

## 0. 버전

**현재 계약 버전: `3.0.0`.**

| 버전 | 무엇이 바뀌었나 |
|---|---|
| `1.0.0` | 최초 계약 (게이트 2 제출본) |
| `2.0.0` | **게이트 2 D10.** 입력 `profile.risk_profile`을 제거하고 `profile.fund_use_horizon`으로 대체. `Plan.warnings`, `ScenarioResult.fund_use_horizon_boundaries` 추가. `echo.risk_profile*`을 `echo.fund_use_horizon*`으로 교체 |
| `2.1.0` | **게이트 2 마감 판단.** 경계값 전용 진입점 `computeFundUseHorizonBoundaries` 추가(9절). 기존 진입점과 타입은 그대로이므로 minor다 — `2.0.0`에 맞춘 목은 계속 동작한다 |
| `3.0.0` | **3단계 구현 중 발견된 계약 오류의 정정.** `Plan.delta_vs_baseline_krw`의 "0 이하" 제약을 제거했다(0.1절). `AccountLimit`에 `contribution_limit_shared_with`·`credit_limit_shared_with`를 추가해 계좌 간 공유 한도를 구조로 드러냈다(5.3절) |

### 0.1 `delta_vs_baseline_krw` 제약을 제거한 경위

**원래 제약이 왜 있었나.** `1.0.0`에서 기본안은 언제나 `max_tax_credit`이었다. 목적함수가 세액공제액 최대화이므로 다른 어떤 안도 그보다 클 수 없고, 따라서 "기본안 대비 차이는 0 이하"가 **정리(theorem)로 성립했다.** 그 값은 "이 대안은 얼마를 포기하는가"를 뜻했다.

**무엇이 그것을 깼나.** 게이트 2 D10이 기본안을 `fund_use_horizon`의 함수로 만들었다. `before_pension_age`면 기본안이 `isa_first`가 되는데, 그 안은 세액공제를 최대화하지 않는다. 그러면 `max_tax_credit`의 차이가 **양수**가 된다. D10을 반영하면서 이 파급을 아무도 잡지 못했다 — 관리자 포함이다. 3단계 구현에서 실제 값으로 드러났다.

**어떻게 고쳤나.** 필드의 주된 정의("기본안 대비 세액공제액 차이")를 그대로 두고 부호 제약만 없앴다. 기본안이 `max_tax_credit`일 때는 여전히 전부 0 이하이므로, 원래의 성질은 조건부 사실로 남는다.

**왜 major인가.** 요청 형태는 한 글자도 바뀌지 않았고 응답 필드의 값 범위만 넓어졌다. 그래도 major로 올린 이유는 셋이다.

1. **깨지는 소비자가 실재한다.** 부호를 가정해 `−` 기호를 붙이거나 "포기하는 금액"으로 이름 붙인 화면은 이득을 손실로 표시한다. 값이 유효 범위 안이므로 어떤 검증에도 걸리지 않고 조용히 틀린다.
2. **조용한 실패는 시끄러운 실패보다 비싸다.** major로 올리면 `web-dev`의 목이 `schema_version_mismatch`로 즉시 멈춘다. 마이그레이션 비용은 버전 문자열 한 줄이고, 그 대가로 소비자가 이 필드를 반드시 다시 읽는다.
3. 아래 규약이 "기존 필드의 의미 변경"을 major로 정하고 있다. 계약이 보장하던 성질을 거두는 것은 그 범주다.

**채택하지 않은 대안:** patch로 처리하기(엔진이 그 제약을 지킨 적이 없으므로 문서 정정일 뿐이라는 읽기). 기각 근거는 소비자가 가진 것이 문서뿐이라는 점이다. 문서가 보장한 것을 거두면 그것은 계약 변경이다.

**버전 규약 (이 문서가 확정한다).**

- **major** — 필드 제거, 필드 이름 변경, 자료형 변경, 기존 필드의 의미 변경, 열거형에서 값 제거. **요청뿐 아니라 응답 쪽 보장을 거두는 것도 포함한다** — 요청 형태가 그대로여도 소비자가 믿던 성질이 사라지면 major다(0.1절이 그 사례다).
- **minor** — 선택 필드 추가, 열거형에 값 추가, 코드 목록에 코드 추가. 기존 목이 계속 동작한다.
- **patch** — 문서 표현만 바뀌고 계약은 그대로.

엔진은 요청의 `schema_version`이 자신이 아는 major와 다르면 `schema_version_mismatch` 오류를 낸다. minor·patch 차이는 허용한다. 어느 경우든 **게이트 2 승인 이후의 변경에는 관리자 승인이 필요하다.**

---

## 1. 형태

진입점은 둘이다.

```
compute(request: EngineRequest, rulesets: RulesetBundle): EngineResponse
computeFundUseHorizonBoundaries(request: BoundariesRequest, rulesets: RulesetBundle): BoundariesResponse
```

두 번째는 **읽기 전용 조회**다. 배분을 계산하지 않고 `fund_use_horizon` 선택지의 경계 연수만 낸다(9절). 3~8절은 전부 `compute`에 관한 것이다.

- **순수 함수.** 네트워크·파일 I/O·현재 시각을 읽지 않는다. 룰셋은 인자로 주입된다. 같은 인자면 항상 같은 결과다.
- **예외를 던지지 않는다.** 도메인 오류는 물론 입력 형식 오류도 반환값으로 표현한다. `web-dev`는 `try/catch`가 아니라 `response.ok`로 분기한다.
- **표시 문구를 만들지 않는다.** 7절 참조.

`RulesetBundle`은 `data/tax-rules/*.json`을 파싱한 객체를 파일명 키로 담은 맵이다. 엔진은 이 맵에서만 세법 값을 읽는다.

---

## 2. 공통 규약

### 2.1 금액

- 모든 금액은 **정수 KRW(원)**다. 소수점이 없다. 문자열이 아니다.
- 필드명 접미사가 기간을 나타낸다.
  - `_monthly_krw` — **원/월**
  - `_annual_krw` — **원/연** (해당 과세연도 기준)
  - 접미사가 `_krw`뿐이면 **누적·잔액·한도** 같은 시점 금액이다. 각 필드 설명에 명시한다.
- 값이 없음을 나타낼 때 `0`을 쓰지 않는다. `null`을 쓴다. `0`은 "0원"이라는 사실이다.

### 2.2 기간

- 나이는 **만 나이 정수(년)**.
- 연수는 **정수(년)**.
- 개월수는 **정수(월)**.

### 2.3 필수·선택

각 필드 표의 "필수" 열이 계약이다.

- **필수** — 없으면 `missing_required` 오류. 엔진이 기본값을 만들지 않는다.
- **선택** — `null` 허용. 각 필드의 "null일 때" 열이 엔진의 동작을 정한다. **선택 필드를 생략한 것과 `null`을 보낸 것은 같다.**

### 2.4 식별자 명명

계좌 식별자는 세 개 고정이다.

| 값 | 가리키는 것 |
|---|---|
| `annuity_savings` | 연금저축계좌 |
| `retirement_pension` | 퇴직연금계좌(IRP·DC 가입자부담금) |
| `isa` | 개인종합자산관리계좌 |

---

## 3. 요청 — `EngineRequest`

### 3.0 최상위

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `schema_version` | string | — | 필수 | `"2.1.0"`. major가 다르면 `schema_version_mismatch` 오류(0절) |
| `tax_year` | integer | 년 | 필수 | 기준 과세연도. 확정 시나리오가 읽을 룰셋을 고른다 |
| `scenarios` | string[] | — | 필수 | 비어 있지 않은 배열. 값은 `"current"` / `"proposed"`. 중복은 제거된다. 순서는 응답 순서를 정하지 않는다(6.1절) |
| `profile` | Profile | — | 필수 | 3.1절 |
| `accounts` | Accounts | — | 필수 | 3.2절 |
| `isa_transfer` | IsaTransfer \| null | — | 선택 | 3.3절. null이면 전환 관련 계산과 출력이 전부 빠진다 |
| `options` | Options \| null | — | 선택 | 3.4절. null이면 전부 기본값 |

### 3.1 `Profile`

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `age_years` | integer | 년(만 나이) | 필수 | 0 이상. 정수가 아니면 `not_integer` 오류. `isa.eligibility` 판정에만 쓴다. 연금계좌 연령 자격은 판정하지 않는다(룰셋에 규칙 없음) |
| `current_year_total_salary_krw` | integer | 원/연 | 필수 | **해당** 과세기간 총급여액. `pension.credit.rate` 구간 판정에만 쓴다. 0 이상 |
| `prior_year_total_salary_krw` | integer \| null | 원/연 | 선택 | **직전** 과세기간 총급여액. `isa.tax_free_limit` 구간의 교차확인에만 쓴다. **null이면 교차확인을 건너뛰고 `prior_year_income_missing` notice를 낸다. 해당 연도 값으로 대체하지 않는다** |
| `financial_income_taxpayer_last_3_years` | boolean \| null | — | 선택 | 직전 3개 과세기간 중 1회 이상 금융소득종합과세 대상이었는가(`isa.exclusion.financial_income_taxpayer`). `true`면 ISA를 배분 대상에서 제외한다. **null이면 배제를 적용하지 않고 `financial_income_status_unknown` notice를 낸다** |
| `declared_youth` | boolean \| null | — | 선택 | 청년 우대 규칙 대상인지에 대한 **사용자 자기신고**. 엔진은 나이로 판정하지 않는다 — 연령 범위가 시행령 위임이고 미공개다. 개정안 시나리오에서만 쓴다. **null이면 우대를 적용하지 않고 `youth_status_not_declared` notice를 낸다** |
| `fund_use_horizon` | `"within_isa_lock_in"` \| `"before_pension_age"` \| `"at_or_after_pension_age"` \| `"unknown"` | — | **필수** | 이 자금을 언제 쓸 계획인가. **배분 금액과 세액공제액을 바꾸지 않는다.** 배분안의 순서와 경고만 바꾼다(3.1절 아래 설명). 값을 모르면 `"unknown"`을 보낸다 — **엔진이 기본값을 만들지 않는다.** 목록 밖 값이면 `invalid_enum` 오류 |
| `monthly_capacity_krw` | integer | 원/월 | 필수 | 월 납입 여력. 0 이상. **0은 유효한 입력이다**(오류가 아니다) |
| `months_remaining_in_tax_year` | integer \| null | 월 | 선택 | 해당 과세연도에 남은 납입 개월수. 1 이상 12 이하. **null이면 12로 본다**(과세연도 전체를 납입한다는 가정). 이 기본값 적용 사실은 `assumptions`에 실린다 |

연간 예산 = `monthly_capacity_krw × months_remaining_in_tax_year`.

**`fund_use_horizon`의 네 값** — 구간의 칸막이는 룰셋의 두 중도해지 규칙이 걸리기 시작하는 지점이다. 값 이름에 연수를 넣지 않은 이유와 `unknown`을 둔 이유는 `engine-design.md` 4.2절 (4)에 있다.

| 값 | 의미 | 걸리는 중도 불이익 |
|---|---|---|
| `within_isa_lock_in` | ISA 의무가입기간 안에 쓸 가능성이 있다 | 세 계좌 전부 |
| `before_pension_age` | 그보다는 뒤지만 연금 수령 개시 연령 전에 쓸 계획이다 | 연금저축·IRP |
| `at_or_after_pension_age` | 연금 수령 개시 연령까지 둘 수 있다 | 없음 |
| `unknown` | 모르겠다 | 판정하지 않음 |

화면에 보일 실제 연수(의무가입기간, 연금 수령 개시 연령까지 남은 해)는 **엔진이 룰셋에서 읽어 `fund_use_horizon_boundaries`로 내보낸다**(5.9절). 화면도 이 숫자를 코드에 박지 않는다.

**이 입력이 금액을 바꾸지 않는다는 보장.** `allocations`의 모든 금액과 `deterministic_benefit`의 모든 금액은 `fund_use_horizon`의 네 값 어디에서나 동일하다. 달라지는 것은 `plans` 배열의 순서, 각 안의 `is_baseline`, 각 안의 `warnings`, 그리고 `comparison_note_codes`뿐이다. 응답의 `echo.fund_use_horizon_affects`가 이 사실을 기계가 읽을 수 있는 형태로 싣는다(4.2절).

### 3.2 `Accounts`

```
accounts.annuity_savings   : PensionAccountState
accounts.retirement_pension: PensionAccountState
accounts.isa               : IsaAccountState
```

세 키 모두 **필수**다. 계좌가 없으면 객체를 빼지 말고 값을 0으로 채운다 — 키가 없는 것과 잔액이 0인 것은 다르고, 전자는 오류다.

**`PensionAccountState`**

| 필드 | 자료형 | 단위 | 필수 | 설명 |
|---|---|---|---|---|
| `ytd_contribution_krw` | integer | 원/연 | 필수 | 해당 과세연도의 누적 납입액. 0 이상. 계좌가 없으면 0 |

**`IsaAccountState`**

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `exists` | boolean | — | 필수 | 계좌 보유 여부. `false`면 신규 가입을 전제로 잔여 한도를 산출하고 그 취급을 `assumptions`에 담는다 |
| `account_type` | `"general"` \| `"low_income"` \| null | — | 선택 | 일반형 / 서민형. **사용자 선언을 그대로 신뢰한다.** 엔진이 소득으로 다시 판정해 덮어쓰지 않는다. null이면 `isa_type_not_declared` notice를 내고 비과세 한도 표시를 생략한다 |
| `cumulative_contribution_krw` | integer | 원(가입 이후 누적) | 필수 | `isa.contribution.annual_limit` 산식과 `isa.account.requirements`의 총 납입한도 판정에 쓴다. 0 이상 |
| `ytd_contribution_krw` | integer | 원/연 | 필수 | 해당 과세연도의 누적 납입액. 0 이상. `cumulative_contribution_krw` 이하여야 한다 |
| `years_since_opening` | integer \| null | 년 | 선택 | 가입 후 경과 연수. `isa.contribution.annual_limit` 산식의 변수다. **null이면 가장 보수적인 값 0으로 계산하고 `isa_tenure_missing` notice를 낸다. 추정하지 않는다** |
| `other_savings_contract_krw` | integer \| null | 원(계약금액 총액) | 선택 | 재형저축·장기집합투자증권저축 계약금액 총액. `isa.account.requirements`의 총 납입한도에서 차감된다. **null이면 0으로 본다**(해당 저축 미보유). 이 취급은 `assumptions`에 실린다 |

### 3.3 `IsaTransfer`

`null`이면 전환 계산 전체와 관련 출력이 빠진다(requirements.md 수용 기준: 전환 여부가 "아니오"면 추가 한도 항목을 표시하지 않는다).

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `amount_krw` | integer | 원 | 필수 | 만기 전환 금액. 1 이상. `accounts.isa.cumulative_contribution_krw` 초과면 `isa_transfer_exceeds_cumulative` 오류. **이 금액은 예산에서 나오지 않는다** — 배분 예산 제약에 들어가지 않는다 |
| `destination` | `"retirement_pension"` \| `"annuity_savings"` \| null | — | 선택 | 전환금액을 받는 연금계좌. **null이면 `"retirement_pension"`으로 본다.** 목적지가 연금저축이면 단독 한도(`pension.credit.limit.annuity_savings`) 판정에 먼저 걸리므로 결과가 달라진다 |
| `prior_year_applied_extra_credit_krw` | integer \| null | 원 | 선택 | 직전 과세기간에 이미 적용된 전환 추가공제액. `pension.credit.isa_transfer.extra_limit`의 상한에서 차감된다. **null이면 0으로 본다**(작년에 받지 않았다고 간주). `assumptions`에 실린다 |
| `prior_multi_year_applied_extra_credit_krw` | integer \| null | 원 | 선택 | 개정안 시나리오 전용. 넓어진 대상 기간 동안 적용된 금액의 합계. **null이면 `prior_year_applied_extra_credit_krw` 값으로 대신하고 `proposed_transfer_cap_period_input_missing` notice를 낸다** — 이 경우 추가한도가 과대 산출될 수 있다 |

### 3.4 `Options`

| 필드 | 자료형 | 필수 | 설명 / null일 때 |
|---|---|---|---|
| `plan_variants` | string[] \| null | 선택 | 받고 싶은 배분안 id 목록. null이면 엔진 기본 집합(5.2절 셋 전부). 알 수 없는 id는 `unknown_plan_variant` 오류 |
| `include_legal_basis` | boolean \| null | 선택 | null이면 `true`. **`false`로 두어도 화면에서 근거 표시를 뺄 수는 없다** — 헌장 고지 요소 3은 필수다. 이 옵션은 테스트·스냅샷 용도다 |

**제거된 필드.** `1.0.0`의 `profile.risk_profile`은 `2.0.0`에서 제거됐다. 게이트 2 D10 결정이며, 위험 성향이 아니라 자금 사용 시점이 룰셋에 근거를 갖는 변수라는 것이 이유다. 판단 이력은 `engine-design.md` 4.2절에 남아 있다. **`risk_profile`을 보내면 무시된다** — 오류로 만들지는 않되 응답 어디에도 실리지 않는다.

---

## 4. 응답 — `EngineResponse`

판별 유니온이다.

```
{ ok: true,  schema_version, echo, scenarios, assumptions }
{ ok: false, schema_version, errors }
```

`ok: false`면 `scenarios`가 없다. 부분 결과를 내지 않는다.

### 4.1 성공 응답 최상위

| 필드 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `ok` | `true` | 항상 | |
| `schema_version` | string | 항상 | 요청과 같은 값 |
| `echo` | Echo | 항상 | 4.2절 |
| `scenarios` | ScenarioResult[] | 항상 | 요청한 시나리오마다 하나. 6.1절의 고정 순서 |
| `assumptions` | Assumption[] | 항상 | 입력값 외에 엔진이 세운 가정. 헌장 고지 요소 4의 재료다. 빈 배열일 수 있다 |

### 4.2 `Echo`

입력이 결과에 어떻게 반영됐는지를 화면이 되짚을 수 있게 한다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `tax_year` | integer | 년 | 요청값 |
| `monthly_capacity_krw` | integer | 원/월 | 요청값 |
| `months_remaining_in_tax_year` | integer | 월 | 실제 적용된 값(기본값 적용 후) |
| `annual_budget_krw` | integer | 원/연 | 위 둘의 곱 |
| `fund_use_horizon` | string | — | 요청값 그대로 |
| `fund_use_horizon_affects` | FundUseHorizonEffect | — | 이 입력이 무엇을 바꾸고 무엇을 바꾸지 않는지. 아래 |
| `credit_rate_bracket` | CreditRateBracket | — | 어떤 공제율 구간으로 판정됐는지. `{ income_tax_rate, local_tax_rate, effective_rate, basis_rule_ids }`. 세 비율은 룰셋에서 산출된 값이며 숫자는 런타임에 정해진다 |

**`FundUseHorizonEffect`** — 값이 고정이다. 계약이 스스로 "이 입력은 금액을 바꾸지 않는다"를 선언하고, `qa`가 게이트 4에서 이 선언과 실제 동작을 대조할 수 있다.

| 필드 | 자료형 | 값 |
|---|---|---|
| `allocation_amounts` | boolean | 항상 `false` |
| `tax_credit_amounts` | boolean | 항상 `false` |
| `limits` | boolean | 항상 `false` |
| `plan_ordering` | boolean | 항상 `true` |
| `baseline_selection` | boolean | 항상 `true` |
| `warnings` | boolean | 항상 `true` |

### 4.3 `Assumption`

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | 안정적인 코드. 8.3절 목록 |
| `params` | object | 문구 조립용 파라미터(금액·연수 등) |
| `applies_to_scenarios` | string[] | 이 가정이 걸리는 시나리오 id |
| `basis_rule_ids` | string[] | 관련 규칙 id. 룰셋 근거가 없는 순수 표시 규칙이면 빈 배열 |

---

## 5. `ScenarioResult`

| 필드 | 자료형 | 필수 | 설명 |
|---|---|---|---|
| `scenario_id` | `"current"` \| `"proposed"` | 항상 | |
| `is_enacted` | boolean | 항상 | 룰셋 `status`가 확정이면 `true`. 화면이 두 시나리오를 구분할 최소 단서 |
| `ruleset` | RulesetRef | 항상 | 5.1절 |
| `bill_stages` | string[] | 항상 | **헌장 고지 요소 6.** 실제로 적용된 개정예고 규칙의 `bill_stage` 값을 룰셋에서 그대로 읽어 중복 없이 담는다. 확정 시나리오에서는 빈 배열. **엔진도 화면도 이 문자열을 코드에 박지 않는다** |
| `account_eligibility` | AccountEligibility[] | 항상 | 세 계좌 각각 |
| `limits` | LimitBreakdown | 항상 | 5.3절 |
| `isa_transfer_extra_limit` | IsaTransferExtraLimit \| null | 항상 | 요청에 `isa_transfer`가 없으면 `null` |
| `fund_use_horizon_boundaries` | FundUseHorizonBoundaries | 항상 | 5.9절. 화면이 선택지 라벨과 경고 문구에 넣을 실제 연수. **룰셋에서 읽은 값이다** |
| `plans` | Plan[] | 항상 | 1개 이상 3개 이하. 첫 번째가 기본안이다. 5.5절 |
| `comparison_note_codes` | string[] | 항상 | 배분안 비교에 대한 안내 코드. 8.5절 |
| `legal_basis` | LegalBasisEntry[] | 항상 | **헌장 고지 요소 3.** 5.7절 |
| `unapplied_proposed_rules` | UnappliedRule[] | 항상 | 개정안 시나리오에서 반영하지 **않은** 개정예고 규칙과 사유. 확정 시나리오에서는 빈 배열 |
| `notices` | Notice[] | 항상 | 8.2절 |

### 5.1 `RulesetRef`

| 필드 | 자료형 | 설명 |
|---|---|---|
| `files` | string[] | 이 시나리오가 읽은 룰셋 파일명. 개정안 시나리오는 확정 파일과 개정예고 파일 둘 다 실린다 |
| `tax_year` | integer | 룰셋의 `tax_year` |
| `status` | string | 룰셋의 `status` 값을 그대로. 확정 / 개정예고 |
| `effective_from` | string | `YYYY-MM-DD` |

### 5.2 `AccountEligibility`

| 필드 | 자료형 | 설명 |
|---|---|---|
| `account` | 계좌 id | |
| `eligible` | boolean | 배분 대상인가 |
| `reason_codes` | string[] | `eligible: false`일 때의 사유 코드. `eligible: true`면 빈 배열 |
| `basis_rule_ids` | string[] | 판정에 쓴 규칙 id. 판정 근거 규칙이 없으면 빈 배열(연금계좌가 그렇다) |

### 5.3 `LimitBreakdown`

계좌별 한도를 두 축으로 나눠 낸다. **납입할 수 있는 한도**와 **세액공제를 받을 수 있는 한도**는 다른 것이고, 룰셋도 두 규칙군으로 나눠 두었다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `by_account` | AccountLimit[] | — | 세 계좌 각각 |
| `pension_combined_credit_limit_krw` | integer | 원/연 | 연금계좌 합산 세액공제 대상 한도(전환 추가한도 반영 후) |
| `pension_combined_credit_remaining_krw` | integer | 원/연 | 위에서 기납입·전환금액을 뺀 잔여. 0 미만이면 0 |
| `pension_contribution_limit_remaining_krw` | integer | 원/연 | 연금계좌 납입 자체의 합산 잔여 한도 |
| `basis_rule_ids` | string[] | — | |

**`AccountLimit`**

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `account` | 계좌 id | — | |
| `contribution_limit_remaining_krw` | integer | 원/연 | 납입 자체의 잔여 한도. 0 이상 |
| `contribution_limit_shared_with` | 계좌 id[] | — | 이 한도를 **함께 쓰는 다른 계좌** 목록. 비어 있으면 이 계좌 전용이다. 아래 경고 참조 |
| `credit_eligible_limit_remaining_krw` | integer \| null | 원/연 | 세액공제 대상 잔여 한도. **ISA는 항상 `null`**(세액공제 대상이 아니다) |
| `credit_limit_shared_with` | 계좌 id[] | — | 세액공제 대상 한도를 함께 쓰는 다른 계좌 목록 |
| `tax_free_limit_krw` | integer \| null | 원 | ISA 비과세 한도. **ISA 외의 계좌는 `null`.** `account_type`이 null이면 ISA도 `null` |
| `clamped_to_zero` | boolean | — | 기납입액이 한도를 넘어 0으로 클램프됐는가 |
| `basis_rule_ids` | string[] | — | |

**⚠ 계좌별 한도를 더하면 안 된다.** 연금저축과 퇴직연금은 **같은 풀**을 본다 — 납입 한도는 `pension.contribution.annual_limit`이 계좌 합산으로 정하고, 세액공제 한도는 `pension.credit.limit.combined`가 합산으로 정한다. 두 계좌의 값을 더하면 이중계상이고 실제보다 큰 한도가 화면에 뜬다.

`*_shared_with`가 이 사실을 **구조로** 드러낸다. 값이 비어 있지 않은 필드는 다른 계좌와 같은 풀을 가리키므로 합산 대상이 아니다. 합계가 필요하면 이미 계산된 `LimitBreakdown.pension_contribution_limit_remaining_krw`와 `pension_combined_credit_remaining_krw`를 쓴다. 규약으로 막지 않고 데이터가 스스로 말하게 한 것이다.

### 5.4 `IsaTransferExtraLimit`

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `transfer_amount_krw` | integer | 원 | 요청값 |
| `destination` | 계좌 id | — | 실제 적용된 목적지 |
| `extra_credit_limit_krw` | integer | 원/연 | 규칙 산식으로 산출된 추가한도. 0 이상 |
| `prior_applied_deducted_krw` | integer | 원 | 상한에서 차감된 과거 적용액 |
| `counted_as_contribution_krw` | integer | 원/연 | 전환금액 중 당해연도 연금계좌 납입액으로 선반영된 금액 |
| `basis_rule_ids` | string[] | — | |

### 5.5 `Plan`

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `plan_id` | string | — | `"max_tax_credit"` / `"annuity_savings_first"` / `"isa_first"` |
| `is_baseline` | boolean | — | 정확히 하나가 `true`이고 그것이 `plans[0]`이다. 어느 안이 되는지는 `fund_use_horizon`이 정한다(`engine-design.md` 3.1절). 배분안이 하나로 합쳐지면 남은 하나가 `true` |
| `warnings` | PlanWarning[] | — | 이 배분안에서 걸리는 중도 불이익. 5.6절. 빈 배열일 수 있다 |
| `priority_basis` | PriorityBasis | — | **무엇을 우선한 안인가.** 5.6절 |
| `allocations` | Allocation[] | — | **항상 세 계좌 전부.** 배분액이 0인 계좌도 생략하지 않는다 |
| `total_allocated_monthly_krw` | integer | 원/월 | |
| `total_allocated_annual_krw` | integer | 원/연 | |
| `unallocated_monthly_krw` | integer | 원/월 | 한도가 모자라 배분되지 않은 금액 |
| `unallocated_annual_krw` | integer | 원/연 | |
| `monthly_rounding_residual_krw` | integer | 원/연 | 연간 금액을 개월수로 나눌 때 버려진 잔차의 합계. 삼키지 않고 내보낸다 |
| `deterministic_benefit` | DeterministicBenefit | — | 5.6절 |
| `delta_vs_baseline_krw` | integer | 원/연 | 기본안(`plans[0]`) 대비 세액공제액 차이. **기본안은 언제나 0. 다른 안은 음수·0·양수 모두 가능하다.** 기본안이 `max_tax_credit`일 때만 나머지가 전부 0 이하다 — 그때만 기본안이 세액공제액을 최대화하기 때문이다. `fund_use_horizon`이 기본안을 다른 안으로 옮기면(`comparison_note_codes`에 `baseline_reordered_by_fund_use_horizon`) 양수가 나온다. **부호를 "포기한 금액"으로 읽지 마라** — 경위는 0.1절 |
| `non_quantified_effects` | NonQuantifiedEffect[] | — | 금액으로 낼 수 없는 효과. 5.6절 |

**`Allocation`**

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `account` | 계좌 id | — | |
| `monthly_krw` | integer | 원/월 | `floor(annual_krw / months_remaining_in_tax_year)` |
| `annual_krw` | integer | 원/연 | 계산의 1차 단위 |
| `fill_order` | integer \| null | — | 이 안에서 몇 번째로 채웠는가(1부터). 배분액이 0이면 `null` |
| `limited_by` | string \| null | — | 무엇 때문에 더 못 넣었는가. `"budget"` / `"contribution_limit"` / `"credit_limit"` / `"not_eligible"` / `null` |
| `basis_rule_ids` | string[] | — | 이 계좌의 한도 판정에 쓴 규칙 id |

### 5.6 배분안의 부속 타입

**`PriorityBasis`** — 헌장이 요구하는 "각 안이 무엇을 우선한 안인지".

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | `"tax_credit_maximization"` / `"annuity_savings_limit_first"` / `"isa_liquidity_first"` |
| `fill_sequence` | 계좌 id[] | 이 안의 충당 순서. 길이 3 |
| `basis_rule_ids` | string[] | 이 우선순위를 뒷받침하는 규칙 id. 예: 유동성 우선안은 연금계좌 인출 요건·연금외수령 과세 규칙 |

**`DeterministicBenefit`** — 금액이 확정적으로 계산되는 효과. 현재는 연금계좌 세액공제뿐이다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `pension_credit_income_tax_krw` | integer | 원/연 | 소득세분 |
| `pension_credit_local_tax_krw` | integer | 원/연 | 개인지방소득세분 |
| `pension_credit_total_krw` | integer | 원/연 | 두 값의 합 |
| `credit_eligible_contribution_krw` | integer | 원/연 | 세액공제 대상으로 인정된 납입액(전환금액 포함) |
| `basis_rule_ids` | string[] | — | |

**`NonQuantifiedEffect`** — 금액으로 낼 수 없는 효과. **`DeterministicBenefit`과 같은 축에서 더하면 안 된다.**

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `code` | string | — | 예: `"isa_tax_free_headroom"` |
| `account` | 계좌 id | — | |
| `headroom_krw` | integer \| null | 원 | 관련 한도 금액(있으면). 절세액이 아니다 |
| `quantifiable` | `false` | — | 항상 `false` |
| `reason_code` | string | — | 왜 금액을 못 내는가. 예: `"depends_on_investment_return_not_in_ruleset"` |
| `basis_rule_ids` | string[] | — | |

**`PlanWarning`** — 자금 사용 시점에 따라 걸리는 중도 불이익. 게이트 2 D10으로 추가됐다.

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | 8.4절의 두 코드 중 하나 |
| `account` | 계좌 id | 어느 계좌의 배분에 걸리는가. **배분액이 0인 계좌에는 경고가 붙지 않는다** |
| `severity` | `"warning"` \| `"info"` | 사용자가 사용 시점을 밝혔으면 `warning`, `unknown`이면 `info` |
| `trigger` | `"declared_horizon"` \| `"horizon_unknown"` | 어떤 근거로 낸 경고인가. `horizon_unknown`은 구성요건을 판정하지 않고 사실을 알린 것이다 |
| `basis_rule_ids` | string[] | 근거 규칙 id. 화면은 이 경고 옆에도 법령 조항을 붙일 수 있다 |
| `params` | object | 문구 조립용. `fund_use_horizon_boundaries`의 값이 들어간다 |

**경고에 금액은 없다.** 중도 인출 시 얼마를 물게 되는지는 인출 시점의 운용수익과 세액공제 수령분에 달려 있고, 인출 단계는 v2로 연기됐다(게이트 1 D3). 엔진은 "이 규칙이 걸린다"는 사실과 근거만 낸다.

### 5.7 `LegalBasisEntry` — 헌장 고지 요소 3

**실제로 읽은 규칙만 담는다.** 읽지 않은 규칙을 근거로 싣지 않는다.

| 필드 | 자료형 | 설명 |
|---|---|---|
| `rule_id` | string | 룰셋의 `id` |
| `title` | string | 룰셋의 `title` |
| `law` | string | **룰셋 `source.law`를 한 글자도 바꾸지 않고 그대로.** 요약·의역하지 않는다 |
| `law_version` | string \| null | 룰셋 `source.law_version` |
| `url` | string | 룰셋 `source.url` |
| `corroborating_url` | string \| null | 룰셋 `source.corroborating_url` |
| `status` | string | 규칙의 `status` |
| `bill_stage` | string \| null | 개정예고 규칙만 값이 있다 |
| `effective_from` | string | `YYYY-MM-DD` |
| `verified_on` | string | 룰셋 `source.verified_on`. 기준 시점 표시에 쓴다 |
| `applied_to` | string[] | 이 규칙이 쓰인 출력 필드 경로 목록. 화면이 값 옆에 근거를 붙일 수 있게 한다 |
| `has_uncertainty_note` | boolean | 규칙 `value`에 `unverified` / `age_range: null` / `confidence`가 확정이 아닌 표시가 있으면 `true`. 화면이 불확실성 표시를 붙일 단서다 |

각 숫자 필드에 붙는 `basis_rule_ids`가 이 목록의 `rule_id`를 가리킨다. 화면은 두 방향(값 → 근거, 근거 → 값) 모두로 연결할 수 있다.

### 5.8 `UnappliedRule`

| 필드 | 자료형 | 설명 |
|---|---|---|
| `rule_id` | string | |
| `title` | string | |
| `reason_code` | string | `"out_of_product_scope"` / `"affects_multi_year_only"` / `"requires_rule_not_in_ruleset"` / `"requires_input_not_collected"` |

### 5.9 `FundUseHorizonBoundaries`

`fund_use_horizon` 선택지의 칸막이가 실제로 몇 년인지를 룰셋에서 읽어 내보낸다. **화면이 선택지 라벨과 경고 문구에 넣을 숫자의 출처다.** 이 값이 없으면 화면이 연수를 직접 적게 되고, 그 순간 세법 수치가 화면 코드에 박힌다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `isa_lock_in_years` | integer \| null | 년 | ISA 의무가입기간. 룰셋에서 읽는다 |
| `isa_lock_in_years_remaining` | integer \| null | 년 | 위에서 `accounts.isa.years_since_opening`을 뺀 잔여. 0 미만이면 0. 가입경과연수가 null이면 보수적으로 전체 기간 |
| `pension_min_age_years` | integer | 년 | 연금 수령 개시 연령. 룰셋에서 읽는다 |
| `pension_years_remaining` | integer | 년 | 위에서 `profile.age_years`를 뺀 잔여. 0 미만이면 0 |
| `pension_holding_period_evaluated` | `false` | — | 항상 `false`. 연금계좌 가입 경과연수 입력이 없어 보유기간 요건은 판정하지 않았다는 표시 |
| `basis_rule_ids` | string[] | — | `isa.account.requirements`, `isa.early_termination.clawback`, `pension.withdrawal.eligibility` 등 실제로 읽은 규칙 |

---

## 6. 순서와 결정성

### 6.1 고정 순서

요청의 배열 순서와 무관하게 응답의 순서가 고정된다. 스냅샷 테스트와 목이 요청 순서에 흔들리면 안 되기 때문이다.

| 배열 | 순서 |
|---|---|
| `scenarios` | `current` → `proposed` |
| `plans` | **기본안이 첫 번째.** 나머지는 `max_tax_credit` → `annuity_savings_first` → `isa_first`에서 기본안을 뺀 순서. 기본안은 `fund_use_horizon`이 정한다(`engine-design.md` 3.1절) |
| `plans[].warnings` | `allocations`와 같은 계좌 순서, 같은 계좌 안에서는 코드 사전순 |
| `allocations` | `retirement_pension` → `annuity_savings` → `isa` |
| `account_eligibility`, `limits.by_account` | `allocations`와 같은 순서 |
| `legal_basis` | 확정 → 개정예고, 그 안에서는 `rule_id` 사전순 |

### 6.2 배분안 합치기

배분 벡터가 같은 안은 하나로 합친다. 합친 결과 `plans` 길이가 1이면 `comparison_note_codes`에 `plans_collapsed_single`이 들어간다. 이때 `web-dev`는 비교 UI 대신 단일 결과 UI로 전환해야 한다.

---

## 7. 오류·경고·안내의 표현

**엔진은 사용자에게 보이는 문장을 만들지 않는다.** 코드와 파라미터만 낸다.

이유는 둘이다. (1) 화면 문구는 헌장의 세무사법 문구 정책이 걸리는 자리이고 그 책임은 `designer`에게 있다. 엔진이 문장을 만들면 정책이 두 곳으로 흩어져 `qa`가 한 곳에서 검사할 수 없다. (2) 순수 함수는 로케일·표기 정책을 몰라야 한다.

`web-dev`는 `code`를 키로 하는 문구 사전을 화면 쪽에 두고 `params`로 채운다.

### 7.1 `EngineError` (`ok: false`)

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | 8.1절 목록 |
| `field` | string \| null | 점 경로. 예: `profile.age_years`, `accounts.isa.ytd_contribution_krw` |
| `params` | object | 문구 조립용 |

오류는 **발견한 것을 전부** 담는다. 첫 오류에서 멈추지 않는다 — 입력 화면이 여러 필드의 오류를 한 번에 표시해야 하기 때문이다.

### 7.2 `Notice`

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | 8.2절 목록 |
| `severity` | `"info"` \| `"warning"` | `warning`은 결과의 정확도에 영향을 주는 것 |
| `field` | string \| null | 관련 입력 경로 |
| `params` | object | |
| `basis_rule_ids` | string[] | 관련 규칙 id. 없으면 빈 배열 |

**notice는 계산을 막지 않는다.** 결과는 항상 나온다.

---

## 8. 코드 목록

이 목록이 계약의 일부다. 코드를 추가·변경하려면 관리자 승인이 필요하다.

### 8.1 오류 코드

| 코드 | 언제 |
|---|---|
| `schema_version_mismatch` | 요청의 `schema_version`이 엔진이 아는 값이 아님 |
| `missing_required` | 필수 필드 누락 |
| `not_integer` | 정수여야 하는 값이 정수가 아님 |
| `negative_value` | 0 이상이어야 하는 값이 음수 |
| `out_of_range` | 허용 범위 밖(예: `months_remaining_in_tax_year`) |
| `invalid_enum` | 허용된 값 목록에 없는 문자열 |
| `isa_transfer_exceeds_cumulative` | 전환금액이 ISA 누적 납입액을 초과 |
| `isa_ytd_exceeds_cumulative` | ISA 당해연도 납입액이 누적 납입액을 초과 |
| `empty_scenarios` | `scenarios`가 빈 배열 |
| `unknown_scenario` | 알 수 없는 시나리오 id |
| `unknown_plan_variant` | 알 수 없는 배분안 id |
| `ruleset_load_failed` | 룰셋 파싱 실패 |
| `rule_missing` | 계산에 필요한 규칙 id가 룰셋에 없음. `params.rule_id` 포함. **대체값을 만들지 않는다** |

### 8.2 안내 코드

| 코드 | severity | 언제 |
|---|---|---|
| `zero_capacity` | info | 월 납입 여력이 0 |
| `budget_exceeds_all_limits` | info | 예산이 세 계좌 잔여 한도 합계를 넘음 |
| `existing_contribution_over_limit` | warning | 기납입액이 이미 한도를 넘어 잔여 한도를 0으로 클램프 |
| `prior_year_income_missing` | info | 직전 과세기간 소득 미입력으로 ISA 유형 교차확인 생략 |
| `isa_type_conflicts_with_prior_income` | warning | 사용자가 선언한 ISA 유형이 직전 과세기간 소득 기준 판정과 다름. **계산은 사용자 선언을 따른다** |
| `isa_type_not_declared` | info | ISA 유형 미선언으로 비과세 한도 표시 생략 |
| `isa_tenure_missing` | warning | ISA 가입경과연수 미입력으로 가장 보수적인 값으로 계산 |
| `financial_income_status_unknown` | info | 금융소득종합과세 대상 여부 미입력으로 배제 규칙 미적용 |
| `isa_excluded_financial_income_taxpayer` | warning | 금융소득종합과세 대상자로 ISA 배제 |
| `isa_excluded_age` | warning | 연령 요건 미달로 ISA 배제 |
| `pension_age_not_evaluated` | info | 연금계좌 최소 가입 연령 규칙이 룰셋에 없어 판정하지 않음 |
| `youth_status_not_declared` | info | 청년 자기신고 없음으로 개정안 청년 우대 미적용 |
| `youth_age_range_undetermined` | warning | 청년 우대를 적용했으나 연령 범위가 시행령 미공개 |
| `proposed_transfer_cap_period_input_missing` | warning | 개정안의 넓어진 차감 기간에 대응하는 입력이 없어 직전 1개 과세기간 값으로 대신함 |
| `proposed_not_enacted` | warning | 개정안 시나리오. `bill_stages`와 함께 나간다 |
| `plans_collapsed_single` | info | 배분안이 하나로 합쳐짐 |
| `fund_use_horizon_not_declared` | info | `fund_use_horizon`이 `"unknown"`. 기본안을 바꾸지 않고 중도 불이익 경고를 `info`로 냄 |
| `pension_holding_period_not_evaluated` | info | 연금계좌 가입 경과연수 입력이 없어 `pension.withdrawal.eligibility`의 보유기간 요건을 판정하지 않음 |

### 8.3 가정 코드

| 코드 | 무엇을 가정했는가 |
|---|---|
| `months_remaining_defaulted` | 남은 개월수 미입력으로 과세연도 전체를 가정 |
| `isa_new_account_assumed` | ISA 미보유 사용자에 대해 신규 가입을 전제로 잔여 한도를 산출 |
| `isa_tenure_zero_assumed` | 가입경과연수를 보수적으로 0으로 봄 |
| `other_savings_zero_assumed` | 재형저축·장기집합투자증권저축 미보유로 봄 |
| `prior_transfer_credit_zero_assumed` | 직전 과세기간 전환 추가공제 적용액을 0으로 봄 |
| `single_tax_year_only` | 해당 과세연도 하나만 계산. 다년도 시뮬레이션 아님 |
| `other_deductions_excluded` | 연말정산의 다른 공제·감면은 반영하지 않음 |
| `rounding_floor_to_won` | 원 미만 버림. 룰셋 근거가 아닌 표시 규칙 |
| `isa_benefit_not_quantified` | ISA의 절세 효과는 운용수익의 함수라 금액으로 내지 않음 |
| `fund_use_horizon_excluded_from_amounts` | 자금 사용 시점은 배분 금액·세액공제액에 반영하지 않음. 순서와 경고에만 쓰임 |
| `early_exit_penalty_not_quantified` | 중도 인출·해지 시의 세부담은 금액으로 내지 않음. 인출 단계가 v2로 연기됐고 필요한 수치가 룰셋에 없음 |
| `pension_holding_period_not_evaluated` | 연금계좌 보유기간 요건은 입력 부재로 판정하지 않음 |

### 8.4 경고 코드 (`Plan.warnings`)

| 코드 | 계좌 | 조건 | 근거 규칙 |
|---|---|---|---|
| `early_withdrawal_penalty_pension` | `annuity_savings`, `retirement_pension` | 배분액 > 0 이고 `fund_use_horizon`이 `within_isa_lock_in` 또는 `before_pension_age` | `pension.withdrawal.eligibility`, `pension.early_withdrawal.other_income_rate` |
| `early_termination_clawback_isa` | `isa` | 배분액 > 0 이고 `fund_use_horizon`이 `within_isa_lock_in` | `isa.early_termination.clawback`, `isa.account.requirements` |

`fund_use_horizon`이 `"unknown"`이면 위 둘을 배분액 > 0인 계좌 전부에 대해 `severity: "info"` · `trigger: "horizon_unknown"`으로 낸다. `"at_or_after_pension_age"`면 경고를 내지 않는다.

### 8.5 배분안 비교 안내 코드 (`comparison_note_codes`)

| 코드 | 언제 |
|---|---|
| `plans_collapsed_single` | 배분 벡터가 같아 배분안이 하나로 합쳐짐 |
| `all_accounts_have_early_exit_penalty` | `fund_use_horizon`이 `within_isa_lock_in`. 세 계좌 전부에 중도 불이익이 걸려 **어느 배분안도 이를 피하지 못한다**. 화면은 배분 비교보다 이 사실을 앞세워야 한다 |
| `baseline_reordered_by_fund_use_horizon` | 기본안이 `max_tax_credit`이 아닌 다른 안으로 바뀜 |
| `alternatives_have_equal_tax_credit` | 둘 이상의 안이 같은 세액공제액을 냄(`delta_vs_baseline_krw`가 0) |

---

## 9. 경계값 전용 진입점 — `computeFundUseHorizonBoundaries`

`designer`가 지적한 문제에 대한 답이다. `fund_use_horizon`의 선택지 캡션에 실제 연수를 넣으려면 `fund_use_horizon_boundaries`가 필요한데, **그 값이 필요한 시점은 사용자가 아직 `fund_use_horizon`에 답하기 전이다.** `compute`는 이 필드를 필수로 요구하므로, 라벨을 얻으려면 `"unknown"`을 임시로 넣어 전체 계산을 돌리고 결과를 버려야 한다.

**도입 근거는 성능이 아니다.** 이 엔진의 계산량은 세 계좌에 대한 정수 순차 충당 세 번 × 시나리오 수이고, 룰셋 파싱은 진입점 밖에서 한 번 끝난다. 실시간 미리보기가 입력마다 호출해도 브라우저에서 문제가 되는 규모가 아니다. 성능만 근거였다면 넣지 않았다.

넣는 이유는 **계약의 정직성**이다. 필수 필드에 자리표시자를 넣어 부산물을 꺼내 쓰는 호출은 계약이 의도하지 않은 사용법이고, 세 가지 실제 문제를 낳는다. (a) 버려야 할 완전한 결과가 생겨 화면이 그것을 실수로 렌더링할 여지가 남는다. (b) `notices`에 `fund_use_horizon_not_declared`가 붙어 나오는데 그것은 사용자가 답을 미룬 상태가 아니라 화면이 아직 묻지 않은 상태다 — 같은 코드가 두 가지를 뜻하게 된다. (c) 3단계에서 `compute`의 성능이나 부작용을 손보면 라벨 표시가 함께 깨진다.

**계약 표면이 넓어지는 비용은 작다.** 새 타입은 요청 하나뿐이고 응답은 이미 정의된 타입을 재사용한다. `web-dev`가 관리하는 것은 "두 경로"가 아니라 계산 하나와 조회 하나다.

**드리프트 방지 규약(3단계 구현 조건).** `computeFundUseHorizonBoundaries`가 내는 `boundaries`는 같은 입력에 대해 `compute`가 내는 `scenarios[].fund_use_horizon_boundaries`와 **바이트 단위로 같아야 한다.** 두 진입점이 같은 내부 함수를 호출하는 것으로 구현하고, 그 동일성을 단위 테스트로 고정한다. 이 규약이 없으면 진입점을 늘린 값보다 어긋날 위험이 커진다.

### 9.1 `BoundariesRequest`

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `schema_version` | string | — | 필수 | major가 다르면 `schema_version_mismatch` 오류 |
| `tax_year` | integer | 년 | 필수 | 읽을 룰셋을 고른다 |
| `age_years` | integer | 년(만 나이) | 필수 | 연금 수령 개시 연령까지 남은 해를 낸다 |
| `isa_exists` | boolean | — | 필수 | `false`면 신규 가입 전제로 의무가입기간 잔여를 산출한다 |
| `isa_years_since_opening` | integer \| null | 년 | 선택 | null이면 보수적으로 0으로 본다. `compute`와 같은 취급이다 |
| `scenario` | `"current"` \| `"proposed"` \| null | — | 선택 | null이면 `"current"`. 경계값을 정하는 두 규칙은 개정예고 대상이 아니므로 대개 같은 값이 나오지만, 룰셋이 바뀌면 따라가도록 인자로 둔다 |

`compute`가 받는 소득·납입액·예산은 **받지 않는다.** 경계값 산출에 쓰이지 않고, 받으면 이 진입점이 두 번째 계산기처럼 보인다.

### 9.2 `BoundariesResponse`

```
{ ok: true,  schema_version, boundaries, legal_basis, notices }
{ ok: false, schema_version, errors }
```

| 필드 | 자료형 | 설명 |
|---|---|---|
| `boundaries` | FundUseHorizonBoundaries | 5.9절과 같은 타입 |
| `legal_basis` | LegalBasisEntry[] | 5.7절과 같은 타입. **캡션이 세법 수치를 보이므로 근거 조항이 함께 나가야 한다**(헌장 고지 요소 3) |
| `notices` | Notice[] | `pension_holding_period_not_evaluated`, `isa_tenure_missing` 등이 실릴 수 있다. `fund_use_horizon_not_declared`는 **실리지 않는다** — 이 진입점은 그 질문을 하지 않는다 |
| `errors` | EngineError[] | 8.1절과 같은 코드 체계 |

---

## 10. `web-dev`가 목을 만들 때

- `response.ok`로만 분기한다. 예외는 오지 않는다.
- `plans`의 길이는 **1 이상 3 이하**다. 3을 전제로 레이아웃을 짜되 1일 때를 처리해야 한다.
- `allocations`는 배분액이 0이어도 세 계좌 전부 온다.
- 시나리오를 하나만 요청해도 `scenarios`는 배열이다.
- `bill_stages`와 `legal_basis[].law`는 **룰셋에서 온 문자열이다.** 목에 넣을 값은 실제 룰셋 파일에서 복사한다. 임의로 지어내면 게이트 4에서 고지 요소 3·6 검사에 걸린다.
- 금액은 전부 정수 원이다. 표시 단위(만원 등) 변환은 화면의 몫이다.
- **`fund_use_horizon`을 바꿔도 배분 금액과 세액공제액은 달라지지 않는다.** 달라지는 것은 `plans` 순서, `is_baseline`, `warnings`, `comparison_note_codes`뿐이다. 목을 만들 때 금액은 한 벌만 두고 이 넷만 값에 따라 갈라 두면 된다.
- **기본안은 `plans[0]`이다.** `plan_id`가 `max_tax_credit`인 것을 첫 번째로 가정하지 마라.
- 경고 문구에 넣을 연수는 `fund_use_horizon_boundaries`에서 가져온다. 화면에 숫자를 적지 않는다.
- 선택지 캡션처럼 **경계 연수만 필요할 때는 `computeFundUseHorizonBoundaries`를 쓴다**(9절). `compute`에 `fund_use_horizon: "unknown"`을 넣어 부산물을 꺼내 쓰지 않는다.
- `DeterministicBenefit`의 금액과 `NonQuantifiedEffect`의 `headroom_krw`를 **더하지 않는다.** 다른 축의 값이다.
- **`limits.by_account`의 한도를 계좌별로 더하지 않는다.** `*_shared_with`가 비어 있지 않으면 그 값은 다른 계좌와 같은 풀이다(5.3절). 합계는 `LimitBreakdown`의 `pension_*` 필드에 이미 있다.
- **`delta_vs_baseline_krw`의 부호를 가정하지 않는다.** 기본안이 재정렬되면 양수가 나온다(0.1절). "포기한 금액"으로 라벨을 붙이면 이득을 손실로 표시하게 된다.
