---
unit: calc-engine-dev
stage: 2
status: draft
inputs:
  - docs/org/charter.md
  - docs/org/gate-decisions.md
  - docs/stage-1-discovery/requirements.md
  - docs/stage-1-discovery/tax-rules-report.md
  - docs/stage-2-design/engine-design.md
  - data/tax-rules/2026.json
  - data/tax-rules/2027-proposed.json
open_questions:
  - "**계약을 5.0.0(major)으로 올렸다**(0.6절). 근거 셋 — 새 필수 필드(`profile.has_non_wage_global_income_current_year`), `plans` 길이 상한 3→4, `credit_rate_bracket`의 비율이 다른 축에서 나올 수 있게 된 의미 변경. `src/web`의 목이 즉시 `schema_version_mismatch`로 멈춘다. **`src/web/engine/mock-engine.js`가 `4.0.0`에 맞춰져 있으므로 web-dev의 동기화가 필요하다** — 새 필수 입력 하나, 새 배분안 하나, 새 필드 넷(`unallocated_breakdown`·`pension_combined_credit_remaining_after_plan_krw`·`facts`·`uncertainty_notes`)."
  - "**골든 케이스 47건은 근로소득만 있는 사용자를 전제로 산출됐고, 실행기가 그 전제를 명시해 채운다**(`golden-block.mjs`의 `fillContractDefaults`). 그 분기에서 판정 축이 총급여액 그대로라 47건의 기대값이 한 원도 움직이지 않았다. **종합소득이 있는 분기와 금액을 모르는 분기의 정답지가 없다** — 결함이 25% 과대였던 바로 그 축이다. `tax-domain`이 산출해야 한다."
  - "**실행기가 골든 블록에 `options.plan_variants`를 채워 기존 세 안만 요청한다.** 47건은 세 안 체제에서 산출됐고 네 번째 안은 `plan_count`를 바꾼다. 기대값을 구현에 맞춰 고치지 않기 위한 조치이며, 감추는 것과 감추지 않는 것을 함수 주석에 적었다. **새 안의 정답지도 `tax-domain`의 몫이다.**"
  - "**불확실성 표시를 목록으로 바꿨으나 엔진은 여전히 룰셋을 비출 뿐이다**(5.7.1절). 작성자가 지워서는 안 될 표시를 지운 경우는 골든 블록·`scripts/org/validate-rules.mjs`·`qa` 회귀 리포트가 잡아야 한다. **규칙별 표시 대장을 룰셋 검증기에 두는 것이 가장 값싼 방어선**이라고 보고 `tax-domain`·관리자에게 올린다 — 그 검증기는 이 유닛의 산출물이 아니다."
  - "**`headrooms_overlap`은 지금의 네 충당 순서에서 언제나 `false`다**(5.13절). 필드를 남긴 것은 화면에 대한 보증이기 때문이고, 응답으로는 돌지 않는 갈래라 산술을 따로 시험한다. 이 판단이 옳은지(필드를 두는 것 대 지우는 것) 관리자 확인이 필요하다."
  - "**ISA 유형 교차확인에서 다목(농어민)을 끝내 확인하지 못한다**(0.8절). 결론을 내는 방향에서도 그 목이 남아 있어 `params.unverifiable_bracket_ids`로 드러낸다. 농어민 여부를 입력으로 받을지는 `product-planner`·관리자 판정이다 — D13이 입력을 늘리지 않기로 한 것과 저울에 올려야 한다."
  - "**세액 한도가 0일 때의 처리를 이 유닛이 스스로 판단했다**(5.12절). 배분을 그대로 두고 기본안도 옮기지 않으며, 비교 축이 사라졌다는 사실만 값으로 낸다. **양쪽 다 하지 않은 것**(연금계좌 배분을 0으로 만들기 / 세금 밖의 이유를 지어내기)이 옳은지 관리자 판정이 필요하다."
  - "**계약을 4.0.0(major)으로 올렸다**(0.5절). `src/web`의 목이 즉시 `schema_version_mismatch`로 멈춘다. 그것이 이 판단의 목적이지만 마이그레이션 일정은 web-dev·관리자의 몫이다."
  - "**designer의 E1을 그대로 받지 않았다**(3.5절 아래 표). 화면이 요구한 형태는 '정수 KRW 하나(null 허용)'였고 계약은 `state` 열거형을 가진 객체로 받는다. 근거는 (a) `null` 하나로는 3.8.3절이 가른 **빈**과 **모름**을 구분할 수 없고, (b) `tax-domain`이 P0으로 지목한 예/아니오 대체 신호를 실을 자리가 없기 때문이다. 화면의 `KnownOrUnknownField` 설계와 대조가 필요하다."
  - "requirements.md 2절의 입력 항목에 없는 필드를 넷 추가했다 — months_remaining_in_tax_year(2.3절), accounts.isa.years_since_opening(ISA 연간 한도 산식에 필요), accounts.isa.other_savings_contract_krw(총 납입한도 차감에 필요), isa_transfer.destination(연금저축 단독 한도 판정에 필요). 넷 다 룰셋의 규칙을 계산하려면 없으면 안 되는 값이다. requirements.md 개정이 필요한지 관리자 판정이 필요하다."
  - "개정안 시나리오는 전환 추가한도 상한에서 차감할 과거 적용액의 대상 기간이 넓어진다(proposed.productive_isa.pension_transfer.credit_extra_limit). 그 기간에 대응하는 입력 isa_transfer.prior_multi_year_applied_extra_credit_krw를 선택 필드로 두었으나, 사용자가 이 값을 알기 어렵다. null일 때 직전 1개 과세기간 값으로 대신하면 추가한도가 과대 산출될 수 있어 notice를 내도록 했다. 입력 화면에서 어떻게 물을지 product-planner·designer와 조율이 필요하다."
  - "오류·경고·안내의 사용자 표시 문구를 엔진이 만들지 않고 코드와 파라미터만 낸다(7절). 코드에 대응하는 문구 사전을 designer가 만들어야 한다. 게이트 2 D10으로 경고 코드 두 건이 새로 생겼고(8.4절) screens.md는 아직 그 반영 전이므로, 후속 2차 작업에서 대조가 필요하다."
  - "fund_use_horizon 선택지 캡션의 연수는 사용자의 나이와 ISA 가입경과연수에 따라 달라지므로, 그 둘이 아직 비어 있는 동안에는 캡션을 띄울 수 없다. 경계값 전용 진입점(9절)을 넣어 조회 자체는 가볍게 만들었으나, 캡션이 없는 상태에서 선택지를 어떻게 보일지는 화면의 문제로 남는다. designer와 조율이 필요하다."
  - "연금계좌 가입 경과연수 입력이 없어 pension.withdrawal.eligibility의 보유기간 요건을 반영하지 못한다. 경고가 실제보다 약하게 나갈 수 있고, 입력 항목을 늘릴지는 product-planner·관리자 판정이다. 현재는 assumptions에 담아 드러내는 것으로 처리했다."
  - "**만 나이의 기준일은 여전히 엔진이 고른다 — 다만 이제 그 사실에 룰셋 근거가 있다.** `tax-domain`이 `age.reckoning.reference_date`를 만들었고 그 결론이 **'단일 기준일은 존재하지 않는다'**이므로, 엔진이 쓰는 과세기간 종료일(`{tax_year}-12-31`)은 규칙이 생긴 뒤에도 룰셋에서 나온 값이 아니다. 엔진은 그 규칙을 읽어 `age_reference_date_not_in_ruleset` 가정의 근거로 싣고, **어느 요건이 기준일을 필요로 하는지**(`params.requires_reference_date_rule_ids`)를 룰셋에서 읽어 함께 낸다. **가정 코드의 이름이 낡았다** — 뜻은 8.3절이 정의하며, 개명은 계약 변경이라 `web-dev`의 `4.0.0` 구현이 들어온 뒤 계산 기준일 입력과 함께 처리한다(D22)."
  - "**가정 `age_reference_date_not_in_ruleset`의 `params`에 `requires_reference_date_rule_ids`가 추가됐고 `basis_rule_ids`가 더는 비어 있지 않다.** 더한 것뿐이라 기존 소비자는 깨지지 않으나 계약 표면이 넓어진 것은 사실이고, D22가 이번 회차의 버전 상향을 금지했으므로 `4.0.0`을 유지한 채 여기 적어 둔다. `src/web`의 목이 내는 같은 가정과 어긋나므로 web-dev의 동기화가 필요하다."
  - "**퇴직급여 입금액이 연간 납입한도(1,800만원)를 쓰는지 룰셋이 정하지 않는다.** pension.credit.excluded_contributions가 정한 것은 그 금액이 **세액공제 대상에서** 빠진다는 것뿐이다. 엔진은 납입한도를 쓰는 쪽(배분이 작아지는 = 과소 방향)으로 보고 `retirement_transfer_counted_in_contribution_limit` 가정을 낸다. tax-domain 판정이 필요하다."
  - "**개인지방소득세에 같은 세액 한도 구조가 있는지 미확인이다**(pension.credit.tax_liability_cap의 local_income_tax_note). 엔진은 인정된 소득세분에 부가율을 다시 적용해 지방세분을 낸다 — 인정되지 않은 공제에 붙는 지방세를 남기지 않기 위해서다. `local_tax_follows_income_tax_cap` 가정으로 나간다."
  - "**골든 케이스 36건이 세액 한도 전제 위에서 산출됐다.** 실행기(`src/engine/golden-cases.test.mjs`)가 블록에 없는 `profile.prior_year_tax`를 '한도가 자르지 않는 값'으로 채워 넣고 있고, 그 사실을 함수 주석에 적었다. 기대값 재산출과 한도 경계 케이스 추가는 tax-domain의 몫이다(tax-rules-report.md 13.11절)."
  - "**윤년 2월 29일생의 n년 뒤 날짜를 그 달의 마지막 날로 맞춘다.** 룰셋에 이 처리를 정한 규칙이 없고 어긋나는 날은 하루뿐이지만, 그 하루가 개시 가능 시점을 가르는 사용자가 있다. tax-domain 확인이 필요하다."
---

# 2단계 설계 — 엔진 인터페이스 (web-dev와의 계약)

**이 문서는 계약이다.** 게이트 2에서 고정되고 이후 변경은 관리자 승인이 필요하다. 3단계에서 `web-dev`가 여기에 목(mock)을 물려 병렬로 UI를 만든다.

알고리즘과 판단 근거는 `engine-design.md`에 있다. 이 문서는 **무엇이 오가는가**만 정한다.

## 0. 버전

**현재 계약 버전: `5.0.0`.**

| 버전 | 무엇이 바뀌었나 |
|---|---|
| `5.0.0` | **D26·D27.** 공제율 판정 축을 두 물음으로 나눴다 — `profile.has_non_wage_global_income_current_year`가 **필수로** 들어오고 `profile.current_year_global_income_krw`가 선택으로 붙는다. 배분안이 셋에서 **넷**으로 늘고(`pension_contribution_limit_fill`), `Plan`에 `unallocated_breakdown`·`pension_combined_credit_remaining_after_plan_krw`가 추가되며, `NonQuantifiedEffect`에 `facts`·`headroom_shared_with`가, `LegalBasisEntry`에 `uncertainty_notes`가 붙는다. **왜 major인지는 0.6절** |
| `4.0.0` | **세액 한도·연금수령 개시·개시 가능 시점·퇴직급여 입금.** `tax-domain` 6차 조사의 확정 규칙 6건을 엔진이 읽는다. 요청에 `profile.birth_date`·`profile.prior_year_tax`·`accounts.*.annuity_start_status`가 **필수로** 들어오고 `profile.age_years`가 **사라진다.** 응답에 `pension_credit_tax_liability_cap`·`pension_withdrawal_start`·`DeterministicBenefit`의 자르기 전후 금액이 추가된다. **왜 major인지는 0.5절** |
| `3.3.1` | **D18 — 조건이 두 곳에 적혀 어긋난 것의 정정, 그리고 재발 구조를 없앤 개정.** 8.4절 맺음 문장이 `isa_lock_in_already_elapsed`의 조건을 8.2절과 다르게 적고 있어 좁혀서 8.2절에 맞췄다. 조건을 **한 곳에만** 적게 하는 규약을 8.0절로 세우고 `engine-design.md` 3.2·3.3절의 중복 서술을 참조로 바꿨다. 확정 시나리오의 `tie_break` 값을 5.6절에 명시했다. **엔진 동작은 한 줄도 바뀌지 않았다** — 서술만 정리했으므로 patch다 |
| `1.0.0` | 최초 계약 (게이트 2 제출본) |
| `2.0.0` | **게이트 2 D10.** 입력 `profile.risk_profile`을 제거하고 `profile.fund_use_horizon`으로 대체. `Plan.warnings`, `ScenarioResult.fund_use_horizon_boundaries` 추가. `echo.risk_profile*`을 `echo.fund_use_horizon*`으로 교체 |
| `2.1.0` | **게이트 2 마감 판단.** 경계값 전용 진입점 `computeFundUseHorizonBoundaries` 추가(9절). 기존 진입점과 타입은 그대로이므로 minor다 — `2.0.0`에 맞춘 목은 계속 동작한다 |
| `3.0.0` | **3단계 구현 중 발견된 계약 오류의 정정.** `Plan.delta_vs_baseline_krw`의 "0 이하" 제약을 제거했다(0.1절). `AccountLimit`에 `contribution_limit_shared_with`·`credit_limit_shared_with`를 추가해 계좌 간 공유 한도를 구조로 드러냈다(5.3절) |
| `3.1.0` | **4단계 교차검증 M2의 정정.** `early_termination_clawback_isa` 경고 조건에 "의무가입기간이 남아 있을 것"을 추가했다(0.2절, 8.4절). 안내 코드 `isa_lock_in_already_elapsed`를 추가했다(8.2절). 필드 추가·제거가 없고 **없어야 할 경고가 사라지는 방향**이라 기존 소비자가 깨지지 않으므로 minor다 |
| `3.3.0` | **게이트 4 후속 — 세제상 동점일 때의 순서 원칙.** `max_tax_credit`·`isa_first`가 동점 구간에서 인출이 자유로운 연금계좌를 먼저 채운다(0.4절). `PriorityBasis`에 `tie_break`를 추가했다(5.6절). 필드 추가뿐이고 `max_tax_credit`이 세액공제를 최대화한다는 보장은 그대로여서 minor다 |
| `3.2.0` | **4단계 2차 교차검증 M3의 정정.** `all_accounts_have_early_exit_penalty`의 발생 조건을 8.4절의 경고와 맞췄다(0.3절, 8.5절). `3.1.0`과 같은 이유로 minor다 — **없어야 할 안내가 사라지는 방향**이다 |

### 0.1 `delta_vs_baseline_krw` 제약을 제거한 경위

**원래 제약이 왜 있었나.** `1.0.0`에서 기본안은 언제나 `max_tax_credit`이었다. 목적함수가 세액공제액 최대화이므로 다른 어떤 안도 그보다 클 수 없고, 따라서 "기본안 대비 차이는 0 이하"가 **정리(theorem)로 성립했다.** 그 값은 "이 대안은 얼마를 포기하는가"를 뜻했다.

**무엇이 그것을 깼나.** 게이트 2 D10이 기본안을 `fund_use_horizon`의 함수로 만들었다. `before_pension_age`면 기본안이 `isa_first`가 되는데, 그 안은 세액공제를 최대화하지 않는다. 그러면 `max_tax_credit`의 차이가 **양수**가 된다. D10을 반영하면서 이 파급을 아무도 잡지 못했다 — 관리자 포함이다. 3단계 구현에서 실제 값으로 드러났다.

**어떻게 고쳤나.** 필드의 주된 정의("기본안 대비 세액공제액 차이")를 그대로 두고 부호 제약만 없앴다. 기본안이 `max_tax_credit`일 때는 여전히 전부 0 이하이므로, 원래의 성질은 조건부 사실로 남는다.

**왜 major인가.** 요청 형태는 한 글자도 바뀌지 않았고 응답 필드의 값 범위만 넓어졌다. 그래도 major로 올린 이유는 셋이다.

1. **깨지는 소비자가 실재한다.** 부호를 가정해 `−` 기호를 붙이거나 "포기하는 금액"으로 이름 붙인 화면은 이득을 손실로 표시한다. 값이 유효 범위 안이므로 어떤 검증에도 걸리지 않고 조용히 틀린다.
2. **조용한 실패는 시끄러운 실패보다 비싸다.** major로 올리면 `web-dev`의 목이 `schema_version_mismatch`로 즉시 멈춘다. 마이그레이션 비용은 버전 문자열 한 줄이고, 그 대가로 소비자가 이 필드를 반드시 다시 읽는다.
3. 아래 규약이 "기존 필드의 의미 변경"을 major로 정하고 있다. 계약이 보장하던 성질을 거두는 것은 그 범주다.

**채택하지 않은 대안:** patch로 처리하기(엔진이 그 제약을 지킨 적이 없으므로 문서 정정일 뿐이라는 읽기). 기각 근거는 소비자가 가진 것이 문서뿐이라는 점이다. 문서가 보장한 것을 거두면 그것은 계약 변경이다.

### 0.2 ISA 추징 경고 조건을 좁힌 경위 (4단계 M2)

**계약이 틀렸고 코드가 맞았다.** `tax-domain`의 독립 교차검증(GC-21)이 잡았다.

`2.0.0`의 8.4절은 `early_termination_clawback_isa`의 조건을 "ISA 배분액 > 0 이고 `fund_use_horizon`이 `within_isa_lock_in`"으로만 정했다. 그런데 근거 규칙 `isa.early_termination.clawback`(조특법 §91조의18⑦)은 **"3년이 되는 날 전"** 해지에만 추징을 건다. 의무가입기간이 이미 지난 사용자에게는 그 요건이 성립할 수 없다. 엔진은 계약을 정확히 구현했고, 그래서 **성립할 수 없는 법적 불이익을 고지하고 있었다.**

**관리자 판정: 계약을 고친다.** 사실과 다른 경고는 하지 않아도 될 걱정을 시켜 옳은 행동을 막는다. 조건에 `fund_use_horizon_boundaries.isa_lock_in_years_remaining > 0`을 추가했다.

**모순되는 입력을 어떻게 볼 것인가.** 사용자가 `within_isa_lock_in`을 골랐는데 잔여 기간이 0이면 그 선택의 ISA 쪽 절반은 공허해진다. 경고를 끄는 것만으로는 화면이 이 사실을 알 수 없으므로 안내 코드 `isa_lock_in_already_elapsed`(info)를 함께 낸다. **경고가 아니라 사실 통지다** — 법적 불이익이 아니라 입력과 현실이 어긋난다는 정보이고, 다시 물을지 문구를 바꿀지는 화면이 정한다. 연금 쪽 경고는 그대로 유효하다(자금이 곧 필요하다는 사용자의 진술은 연금계좌에 대해서는 여전히 성립한다).

### 0.3 비교 안내를 경고와 묶은 경위 (4단계 M3)

`3.1.0`이 ISA 추징 경고 조건을 좁히자 `isa_first` 배분안의 `warnings`가 빈 배열이 됐다. 그런데 `all_accounts_have_early_exit_penalty`는 `fund_use_horizon` 값만 보고 나가고 있어 **"어느 배분안도 불이익을 피하지 못한다"고 말하면서 실제로는 피하는 안이 목록에 있었다.** 계약이 이 안내를 배분 비교보다 앞세우라고 지시하므로, 사용자가 그것을 보고 비교를 포기하면 더 나은 선택을 놓친다.

**고친 방식:** 조건을 `fund_use_horizon` 값이 아니라 **결과의 사실**에 걸었다 — 모든 배분안이 실제로 경고를 지고 있을 때만 낸다(8.5절).

**이것이 M1과 같은 형태다.** 어떤 전제가 조건부로 바뀌었는데 그 전제를 공유하던 다른 출력이 따라오지 못했다. M1은 D17의 파급을 배분 탐색이 놓쳤고, M3은 M2의 파급을 비교 안내가 놓쳤다. 개별 수정만으로는 세 번째가 나온다. 그래서 **출력 필드 사이의 사실 일관성을 기계적으로 강제하는 불변식 테스트**를 세웠다 — `src/engine/invariants.test.mjs`. 목록과 각 항목이 막는 것은 `engine-design.md` 7.1절에 있다.

### 0.5 왜 major인가 — 새 입력을 선택 필드로 두지 않은 이유

**minor로 낼 수 있었다.** 새 필드를 전부 선택으로 두고 없으면 예전처럼 계산하면, 기존 목은 한 글자도 고치지 않고 계속 동작한다. 그 길을 택하지 않은 이유가 셋이고, **셋 다 "기본값이 어느 방향으로 틀리는가"에서 나온다.**

**(1) `annuity_start_status`의 기본값은 만들 수 없다.** 선택 필드로 두면 `null`일 때의 동작을 계약이 정해야 하는데, 후보가 둘뿐이고 둘 다 못 쓴다.

- `not_started`로 접는다 → **연금 수령 중인 사용자에게 납입 가능액을 준다.** `tax-domain`이 이 기본값을 명시적으로 금지했다(tax-rules-report.md 13.12절 주의 2). 오류의 방향이 과대다.
- `unknown`으로 본다 → 모름 상태의 처리는 **그 계좌의 배분 보류**다. 그러면 새 필드를 보내지 않는 기존 소비자의 **배분 금액이 통째로 달라진다.** 선택 필드가 기존 동작을 바꾸면 그것은 이미 minor가 아니다.

**(2) 빈 칸을 모름으로 간주하는 것은 침묵에서 답을 추론하는 것이다.** D14가 "명시적 진술이 추론보다 낫다"를 세웠고 `designer`가 3.8.3절에서 **빈 상태와 모름 상태를 다른 결과 패널로** 설계했다. 선택 필드로 두면 계약 2.3절("생략과 `null`은 같다")에 의해 그 둘이 한 값으로 합쳐져 화면 설계가 성립하지 않는다. `fund_use_horizon`이 **필수 + 명시적 `"unknown"`**인 것과 같은 형태이고, 새 패턴이 아니라 있는 패턴을 한 번 더 쓰는 것이다.

**(3) 조용한 실패가 시끄러운 실패보다 비싸다(0.1절과 같은 근거).** 새 입력을 선택으로 두면 기존 화면은 아무 신호 없이 예전 숫자를 계속 내보낸다. 그 숫자는 결정세액이 0인 사용자에게 **148만원만큼 틀린다.** major로 올리면 `src/web`의 목이 `schema_version_mismatch`로 즉시 멈추고, 멈추는 시점이 마침 그 화면이 새 입력을 받도록 바뀌어야 하는 시점이다.

**기존 소비자가 새 필드 없이 보낸 요청을 어떻게 다루는가 — 이것이 갈림길이었고, 답은 "계산하지 않는다"다.** `schema_version`의 major가 다르면 `schema_version_mismatch`, major는 맞는데 필드가 없으면 `missing_required`다. **어느 쪽도 부분 결과를 내지 않는다.** 값을 지어내 계산을 이어 가면 그것이 곧 (1)의 기본값 문제로 돌아온다.

**함께 major인 것 둘.**

- **`profile.age_years` 제거.** D21이 "만 나이 환산은 화면이 하지 않는다"를 정했으므로 화면은 생년월일을 보내야 한다. 두 필드를 함께 받으면 어긋날 때 어느 쪽이 이기는지를 계약이 또 정해야 하고, 무엇보다 **화면이 계속 나이를 계산할 길이 남는다.** 남겨 두면 D21이 막으려던 것이 그대로 남는다.
- **`DeterministicBenefit`의 금액이 한도 적용 후 값으로 바뀐다.** 같은 이름의 필드가 더 작은 값을 낼 수 있다 — 규약이 정한 "기존 필드의 의미 변경"이다. 자르기 전 값이 필요하면 새로 추가된 `*_before_cap_krw`를 읽는다.

**채택하지 않은 대안:** 새 필드를 선택으로 두고 `null`일 때 "한도 미확인" 상태로만 처리해 minor로 내기. 세액 한도 하나만 놓고 보면 성립한다 — 한도를 모르면 자르지 않으므로 옛 요청의 숫자가 그대로다. **깨지는 것은 `annuity_start_status`다.** 이 항목만 필수로 하고 나머지를 선택으로 두는 절충도 검토했으나, 결국 요청 형태가 바뀌어 목을 고쳐야 하는 것은 같고 계약의 상태 수만 늘어난다.

### 0.6 왜 `5.0.0`(major)인가 — 세 가지가 겹쳤다

**(1) 새 필수 필드가 하나 늘었다.** `profile.has_non_wage_global_income_current_year`를 선택으로 두면 `null`일 때의 동작을 계약이 정해야 하는데, 후보가 둘뿐이고 둘 다 못 쓴다.

- `false`로 접는다(= 근로소득만 있다) → **결함이 그대로 남는다.** 그것도 하필 결함이 걸리는 바로 그 사람들에게, **과대** 방향으로. 옛 화면은 아무 신호 없이 25% 큰 금액을 계속 내보낸다.
- 본문 구간(12%)으로 접는다 → 근로소득만 있는 **대다수 사용자의 금액이 조용히 줄어든다.** 선택 필드가 기존 동작을 바꾸면 그것은 이미 minor가 아니다.

`0.5절`의 `annuity_start_status`와 같은 형태이고 결론도 같다. **조용한 실패가 시끄러운 실패보다 비싸다** — major로 올리면 `src/web`의 목이 `schema_version_mismatch`로 즉시 멈추고, 멈추는 시점이 마침 그 화면이 새 입력을 받도록 바뀌어야 하는 시점이다.

**(2) `plans`의 길이 상한이 3에서 4로 바뀐다.** `10절`이 "3을 전제로 레이아웃을 짜라"고 적어 두었으므로 이것은 계약이 준 보장을 거두는 것이다. 규약이 정한 "기존 필드의 의미 변경"에 해당하고, `0.1절`이 `delta_vs_baseline_krw`에서 같은 이유로 major를 골랐다.

**(3) `credit_rate_bracket`의 세 비율이 뜻을 바꾼다.** 필드 이름과 자료형은 그대로인데, 같은 `income_tax_rate`가 이제 총급여액이 아니라 종합소득금액에서 나올 수 있다. **값이 유효 범위 안이므로 어떤 검증에도 걸리지 않고 조용히 달라진다** — 0.1절이 major의 근거로 든 바로 그 형태다.

**채택하지 않은 대안:** 새 배분안을 `options.plan_variants`로만 받을 수 있게 하고(기본 집합에서 빼고) minor로 내기. 기각한다 — 그러면 D26이 고치려던 것("사용자가 미배분을 '갈 곳이 없다'로 읽는다")이 기본 화면에서 그대로 남고, 옵션을 켤 줄 아는 소비자만 사실을 본다.

**`unallocated_breakdown`·`facts`·`uncertainty_notes` 자체는 추가일 뿐이다.** 이 셋만이었다면 minor였다.

### 0.7 공제율 판정 축을 두 물음으로 나눈 경위 (D27)

**엔진이 총급여액만으로 판정하고 있었다.** 사업소득 등이 있어 종합소득금액이 4,500만원을 넘는 사람도 총급여가 5,500만원 이하면 15%를 받았다. 정답은 12%이고, 인정 납입액 900만원 기준으로 **1,485,000원 대 1,188,000원 — 25% 과대**다. 과대 방향이라 특히 나쁘다: 받을 수 없는 금액을 보고 인출이 어려운 계좌에 돈을 묶는다.

**"총급여액을 종합소득금액으로 환산해 판정한다"는 고침은 새 결함을 만든다.** 소괄호의 총급여 기준은 환산 편의가 아니라 **그 구간에서 더 엄격한 규정**이다. 총급여 5,500만원 초과 ~ 57,631,578원 이하인 순수 근로소득자는 근로소득금액이 4,500만원 **이하**인데도 조문상 12%다. 환산하면 그 사람들에게 15%를 준다. 엔진은 환산하지 않고 **축을 고른다.**

| 1단계 답 | 2단계 금액 | 판정 축 (`basis_code`) | 무엇으로 재는가 |
|---|---|---|---|
| 아니오 | 묻지 않는다 | `total_salary` | `current_year_total_salary_krw` |
| 예 | 있다 | `global_income` | `current_year_global_income_krw` |
| 예 | 모른다 | `statutory_default` | 재지 않는다 — 대괄호 안의 예외를 적용하지 않는다 |

**모를 때 본문 구간을 쓰는 것은 제품 결정이다.** 조문 구조상 12%가 본문이고 15%가 예외이므로 예외의 요건이 확인되지 않으면 본문이 적용된다는 것이 조문 읽기로도 자연스럽지만, 이 조직이 그것을 고른 이유는 **오차 방향이 한쪽이 아니라서**다. 지배적으로는 과대지만 결손금 통산이 걸리면 과소이므로, 지금까지 써 온 "최대 이만큼" 상한 표기로 덮이지 않는다. **덜 말하는 쪽이 이 서비스에서 안전한 방향**이다. 그 사실은 `fallback_applied`·`fallback_direction_code`와 안내 `credit_rate_global_income_missing`으로 **금액과 같은 화면에** 나가야 한다.

**1단계 질문을 좁혀 물은 것이 해석을 하나 채택한다.** 규칙의 `open_interpretation`이 "근로소득 외에 **합산되지 아니하는** 종합소득만 더 있는 사람이 '근로소득만 있는 경우'에 드는가"를 미확정으로 남겼다. 질문을 "합산되는 소득이 있는가"로 좁히면 그 사람은 '아니오'로 답해 총급여 기준으로 가고, 이는 두 해석 중 하나를 고른 것이 된다. **조문이 정한 것처럼 표시하지 않는다** — 가정 `credit_rate_wage_only_excludes_separately_taxed_income`으로 드러낸다.

### 0.8 ISA 유형 교차확인 — 결론을 낼 수 있을 때만 낸다 (D27의 "번지는 곳")

같은 결함이 `isa.tax_free_limit`에도 번져 있었다. 근거 조문(조특법 §91조의18 ② 1호)의 가·나·다목은 **서로를 막는 구조**인데 엔진이 `brackets`의 `match: "any_of"`를 그대로 읽고 있었다. 규칙 스스로 그 형태가 단순화라고 적어 두었다(`brackets_are_a_simplification`).

**틀리는 것은 한도금액이 아니다.** 계약이 ISA 유형을 사용자 선언으로 받고 엔진이 덮어쓰지 않으므로 비과세 한도금액은 그대로다. 틀리는 것은 **교차확인의 결론**이고, 그 결론이 **올바로 선언한 사용자를 잘못 정정한다.**

두 방향의 결론이 성립하는 조건이 다르다.

| 방향 | 엔진이 결론지을 수 있는가 | 무엇을 낸다 |
|---|---|---|
| "당신은 서민형이어야 한다" (직전 총급여가 낮다) | **없다.** 가목은 "근로소득만 있는 자"로, 나목은 총급여 상한으로, 다목은 농어민 여부로 한정되고 **엔진에는 세 한정 어느 것도 확인할 입력이 없다** | `isa_type_cross_check_inconclusive` (info) |
| "당신은 서민형이 아니다" (직전 총급여가 가목 상한을 넘는다) | **낸다.** 같은 사실이 가목을 금액 요건으로, 나목을 그 목의 한정으로 함께 닫는다 | 선언이 서민형이면 `isa_type_conflicts_with_prior_income` (warning) |

**결론을 내는 쪽에도 확인하지 못한 것이 남는다.** 다목(농어민)은 시행령 위임이고 입력이 수집되지 않는다. 그래서 두 안내 모두 `params.unverifiable_bracket_ids`에 **어느 목을 확인하지 못했는지**를 싣는다. 화면은 그 목록으로 문장을 누그러뜨릴 수 있다.

**한정이 사라지면 결론이 되살아난다.** 엔진은 `brackets_statutory.items`에서 `restriction`·`delegated`를 가진 목을 세고, **하나도 없으면** 총급여만으로 두 방향 다 결론짓는다. 조문이 정비되면 코드를 고치지 않아도 따라간다. 이 조건이 실제로 무는지는 결함 주입 테스트가 확인한다.

### 0.4 세제상 동점일 때의 순서 원칙 (게이트 4 후속)

소유자가 프로토타입에서 지적했다 — 일반적으로 연금저축을 먼저 채우는 것으로 아는데 엔진이 IRP로 기운다. 확인해 보니 두 안의 세액공제액이 **완전히 같았다.**

**무엇이 문제였나.** 2단계 설계는 합산 한도 구조상 퇴직연금 우선이 약우월임을 증명했고 그 자체는 옳다. 문제는 **동점을 깨는 방향**이었다 — 세금이 같을 때 더 묶이는 계좌를 먼저 권하고 있었다.

**새 근거.** `tax-domain`이 `pension.withdrawal.midterm_restriction`을 조사해 룰셋에 넣었다. 퇴직연금은 시행령이 중도인출 사유를 **열거**하고 열거에 없으면 부분 인출이 불가능해 계좌 전체를 해지해야 한다. 연금저축에는 그런 제한이 없다. **과세는 두 계좌가 완전히 같다** — 이 규칙이 가르는 것은 세금이 아니라 인출이 법적으로 가능한가다.

**원칙:** 세제상 동점이면 인출이 자유로운 계좌를 먼저 채운다. 비용이 0이고 이득이 양수인 선택이므로 기본값이어야 한다.

**지킨 선 넷.**

1. **동점일 때만.** 개정안 청년 우대로 두 계좌의 공제율이 갈리면 동점이 아니고, 그때는 세액공제 최대화가 앞선다. **인출 편의로 세액을 깎지 않는다.** `priority_basis.tie_break.code`가 어느 쪽이 적용됐는지 매 응답에 실린다.
2. **경고는 그대로 두 계좌에.** 과세가 같으므로 `early_withdrawal_penalty_pension`을 한쪽에만 붙이면 그것이 새 오류다.
3. **`fund_use_horizon`과 무관하게 항상 적용한다.** 근거는 아래.
4. **결론은 룰셋이 아니라 제품이 정했다.** 규칙의 `product_note`가 "어느 계좌를 먼저 채울지는 이 규칙이 정하지 않는다"고 명시한다. 엔진이 룰셋에서 읽는 것은 `partial_withdrawal_without_statutory_cause`라는 **사실**뿐이고, 사유 목록은 미확정이므로 목록에 의존하는 로직을 만들지 않았다.

**왜 `fund_use_horizon`에 걸지 않았나.** 자금을 일찍 쓸 수 있다고 밝힌 사용자에게만 적용하는 쪽이 자연스러워 보이지만 그렇게 하지 않았다.

- **비용이 0이다.** 동점의 정의상 세액이 같으므로, 자금을 늦게 쓸 사용자에게도 손해가 없고 회수 가능성만 는다. 조건을 달 이유가 없다.
- **`unknown`을 고른 사용자가 더 나쁜 기본값을 받게 된다.** 밝히지 않았다는 이유로 더 묶이는 배분을 주는 것은 그 입력을 넣은 취지에 어긋난다.
- **계약이 스스로 한 선언과 충돌한다.** `echo.fund_use_horizon_affects`는 이 입력이 `allocation_amounts`를 바꾸지 않는다고 선언한다(4.2절). 동점 판정을 horizon에 걸면 배분 금액이 horizon의 함수가 되어 그 선언이 거짓이 된다. **이것이 결정적이다.**
- 두 입력이 보는 축이 다르다. `fund_use_horizon`은 **언제** 쓸 것인가이고, 이 규칙은 **일부만 빼는 것이 법적으로 가능한가**다. 연금계좌 대 ISA는 전자가, 연금저축 대 퇴직연금은 후자가 가른다.

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
| `schema_version` | string | — | 필수 | `"4.0.0"`. major가 다르면 `schema_version_mismatch` 오류(0절) |
| `tax_year` | integer | 년 | 필수 | 기준 과세연도. 확정 시나리오가 읽을 룰셋을 고른다 |
| `scenarios` | string[] | — | 필수 | 비어 있지 않은 배열. 값은 `"current"` / `"proposed"`. 중복은 제거된다. 순서는 응답 순서를 정하지 않는다(6.1절) |
| `profile` | Profile | — | 필수 | 3.1절 |
| `accounts` | Accounts | — | 필수 | 3.2절 |
| `isa_transfer` | IsaTransfer \| null | — | 선택 | 3.3절. null이면 전환 관련 계산과 출력이 전부 빠진다 |
| `options` | Options \| null | — | 선택 | 3.4절. null이면 전부 기본값 |

### 3.1 `Profile`

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `birth_date` | string | `YYYY-MM-DD` | **필수** | 생년월일. **만 나이 환산은 엔진이 한다**(D21). 달력에 없는 날짜면 `invalid_date` 오류이고 그 오류의 `params`에 입력값을 되풀이하지 않는다. `isa.eligibility` 연령 요건과 `pension.withdrawal.earliest_start`의 만 55세 도달일에 쓴다. 연금계좌 **가입** 연령 자격은 판정하지 않는다(룰셋에 규칙 없음) |
| `prior_year_tax` | PriorYearTax | — | **필수** | 직전 과세연도의 세액. 세액 한도의 재료다. 3.5절 |
| `current_year_total_salary_krw` | integer | 원/연 | 필수 | **해당** 과세기간 총급여액. `pension.credit.rate` 구간 판정에만 쓴다. 0 이상. **아래 두 필드가 `total_salary` 축을 고를 때에만 실제로 쓰인다** |
| `has_non_wage_global_income_current_year` | boolean | — | **필수** | **해당** 과세기간에 근로소득 외에 **종합소득과세표준에 합산되는** 소득(사업·부동산임대·합산되는 이자배당·연금·기타)이 있는가. **`false`면 총급여액으로 판정하고 끝난다** — 대다수 사용자에게 입력이 늘지 않는다. 왜 선택 필드로 두지 않았는지는 0.6절, 질문을 이 범위로 좁힌 것이 무엇을 뜻하는지는 0.7절 |
| `current_year_global_income_krw` | integer \| null | 원/연 | 선택 | **해당** 과세기간의 종합소득과세표준에 합산되는 **종합소득금액**(수입금액이 아니다. 근로소득금액도 이 합계에 들어간다). 「종합소득세 과세표준확정신고 및 납부계산서」의 '종합소득금액' 칸. 0 이상. **`has_non_wage_global_income_current_year`가 `false`인데 값이 실려 오면 `invalid_enum` 오류** — 둘 중 무엇이 사용자의 답인지 엔진이 고르지 않는다. **`true`인데 `null`이면 본문 구간(우대가 아닌 쪽)을 적용하고 `credit_rate_global_income_missing` notice를 낸다** |
| `prior_year_total_salary_krw` | integer \| null | 원/연 | 선택 | **직전** 과세기간 총급여액. `isa.tax_free_limit` 구간의 교차확인에만 쓴다. **null이면 교차확인을 건너뛰고 `prior_year_income_missing` notice를 낸다. 해당 연도 값으로 대체하지 않는다** |
| `financial_income_taxpayer_last_3_years` | boolean \| null | — | 선택 | 직전 3개 과세기간 중 1회 이상 금융소득종합과세 대상이었는가(`isa.exclusion.financial_income_taxpayer`). `true`면 ISA를 배분 대상에서 제외한다. **null이면 배제를 적용하지 않고 `financial_income_status_unknown` notice를 낸다** |
| `declared_youth` | boolean \| null | — | 선택 | 청년 우대 규칙 대상인지에 대한 **사용자 자기신고**. 엔진은 나이로 판정하지 않는다 — 연령 범위가 시행령 위임이고 미공개다. 개정안 시나리오에서만 쓴다. **null이면 우대를 적용하지 않고 `youth_status_not_declared` notice를 낸다** |
| `fund_use_horizon` | `"within_isa_lock_in"` \| `"before_pension_age"` \| `"at_or_after_pension_age"` \| `"unknown"` | — | **필수** | 이 자금을 언제 쓸 계획인가. **배분 금액과 세액공제액을 바꾸지 않는다.** 배분안의 순서와 경고만 바꾼다(3.1절 아래 설명). 값을 모르면 `"unknown"`을 보낸다 — **엔진이 기본값을 만들지 않는다.** 목록 밖 값이면 `invalid_enum` 오류 |
| `monthly_capacity_krw` | integer | 원/월 | 필수 | 월 납입 여력. 0 이상. **0은 유효한 입력이다**(오류가 아니다) |
| `months_remaining_in_tax_year` | integer \| null | 월 | 선택 | 해당 과세연도에 남은 납입 개월수. 1 이상 12 이하. **null이면 12로 본다**(과세연도 전체를 납입한다는 가정). 이 기본값 적용 사실은 `assumptions`에 실린다 |

연간 예산 = `monthly_capacity_krw × months_remaining_in_tax_year`.

**`age_years`는 `4.0.0`에서 제거됐다.** 생년월일에서 만 나이를 얻으려면 **어느 날짜 기준인지**를 정해야 하고 그것은 세법 판단이다. 화면이 그것을 정하면 `web-dev` 금지사항 1번을 정면으로 어긴다(D21). 그래서 요청은 생년월일을 싣고 환산은 엔진이 한다. **기준일 규칙은 룰셋에 없다** — 엔진은 규칙을 만들지 않고 과세기간 종료일로 환산한 뒤 그 사실을 `assumptions`에 싣는다. 쓴 나이와 기준일은 `echo.derived_age`로 되돌아온다.

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

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `ytd_contribution_krw` | integer | 원/연 | 필수 | 해당 과세연도의 누적 납입액. 0 이상. 계좌가 없으면 0. **본인이 새로 넣는 돈만이다** — 퇴직급여 입금액과 계약이전액은 아래 칸으로 분리해 받는다 |
| `annuity_start_status` | `"not_started"` \| `"started"` \| `"unknown"` | — | **필수** | 이 계좌의 연금수령을 개시했는가. **`"unknown"`이 1급 값이고 기본값은 없다.** `"started"`면 그 계좌에 납입할 수 없어 배분 대상에서 빠지고(`pension.contribution.after_annuity_start`), `"unknown"`이면 그 계좌의 배분을 **보류한다.** 목록 밖 값이면 `invalid_enum` 오류. 왜 선택 필드로 두지 않았는지는 0.5절 |
| `opened_on` | string \| null | `YYYY-MM-DD` | 선택 | 이 연금계좌의 가입일. `pension.withdrawal.earliest_start`의 5년 요건에 쓴다. **null이면 개시 가능 시점을 "계산할 수 없음"으로 두고 나이 요건만 낸다. 남은 기간을 추정하지 않는다** |
| `has_deferred_retirement_income` | boolean \| null | — | 선택 | 이 계좌에 이연퇴직소득이 있는가. `true`면 5년 요건이 면제된다. **null이면 없는 것으로 본다** — 잠금기간을 길게 보는 쪽이라 보수적이고, 그 사실이 `assumptions`에 실린다 |
| `retirement_transfer_in_krw` | integer \| null | 원/연 | 선택 | 퇴직급여 입금액·계약이전액. **세액공제 대상 납입액이 아니다**(`pension.credit.excluded_contributions`). **null이면 0으로 본다.** 이 금액은 예산에서 나오지 않고 600·900만원 한도를 쓰지 않는다 |

**`retirement_transfer_in_krw`를 분리해 받는 이유.** 사용자의 "연간 납입 여력"에 퇴직급여 입금액이 섞여 들어오면 세액공제액이 **과대** 계산된다. 입력 폼이 "본인이 새로 넣는 돈"임을 명시해 분리해야 한다.

**연간 납입한도(1,800만원) 쪽 취급은 룰셋이 정하지 않았다.** 엔진은 한도를 **쓰는 쪽**으로 본다 — 그쪽으로 틀리면 배분이 작아져 절세액이 과소로 나오고, 반대로 틀리면 실제로 넣을 수 없는 금액을 권하게 된다. 이 선택은 `assumptions`로 나가고 `open_questions`에 올렸다.

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

### 3.5 `PriorYearTax` — 세액 한도의 재료

**한도 = 결정세액 + 연금계좌 세액공제액.** 소득세법 §61 ③이 산출세액이 모자랄 때 밀려나는 공제로 연금계좌세액공제를 이름으로 지목하므로, 되더한 값이 곧 법정 한도와 **일치한다.** 근사가 아니라 등식이고 결정세액이 0인 경우에도 성립한다.

**두 값을 짝으로 받는다.** 결정세액만 받으면 이미 받은 공제만큼 한도가 줄어 보이는 순환이 생겨 한도를 **과소평가**하고, 공제액만 받으면 한도를 계산할 수조차 없다. 그래서 두 칸을 **한 객체 안에** 두고 되더하기의 출발점인 결정세액을 그 객체의 필수 항목으로 만들었다 — 짝이라는 사실이 규약이 아니라 자료형으로 강제된다.

| 필드 | 자료형 | 단위 | 필수 | 설명 / null일 때 |
|---|---|---|---|---|
| `state` | `"amount"` \| `"zero"` \| `"nonzero_amount_unknown"` \| `"unknown"` | — | **필수** | 사용자가 답한 형태. 엔진이 상태를 추론해 만들지 않는다. 아래 표 |
| `determined_tax_krw` | integer \| null | 원 | `state`가 `"amount"`면 필수 | 직전 과세연도 **결정세액.** 근로소득 원천징수영수증 **Ⅲ 세액명세**의 「결정세액」 칸. `state`가 `"amount"`가 아닌데 값이 있으면 `invalid_enum` 오류 — 둘 중 무엇이 사용자의 답인지 엔진이 고르지 않는다 |
| `pension_credit_applied_krw` | integer \| null | 원 | 선택 | 같은 서식 **Ⅲ 세액명세 → 연금계좌** 네 칸(「근로자퇴직급여 보장법」에 따른 퇴직연금 / 연금저축 / 「과학기술인공제회법」에 따른 퇴직연금 / ISA 만기 시 연금계좌 납입액)의 **세액공제액** 합계. **null이면 0으로 본다** — 한도가 과소로 나오는 방향이고 과소한 한도는 절세액을 과대로 만들지 않는다. 그 사실이 `assumptions`에 실린다 |

**`state`의 네 값**

| 값 | 사용자가 답한 것 | 한도 |
|---|---|---|
| `amount` | 결정세액 금액을 안다 | `determined_tax_krw + pension_credit_applied_krw` |
| `zero` | 금액은 모르나 "직전 과세연도 결정세액이 0이었다" | `pension_credit_applied_krw` (0 + 되더하기) |
| `nonzero_amount_unknown` | "0은 아니었다"까지만 안다 | **모름.** 최악의 오류(한도 0인 사용자에게 절세액을 제시하는 것)는 걸러지지만 크기를 주지 않으므로 결과는 여전히 상한이다 |
| `unknown` | 모르겠다 | **모름** |

**모를 때 지어내지 않는다. 대신 오차의 방향을 낸다.** 한도가 공제액을 **늘리는** 경로가 조문에 없으므로, 한도를 무시하고 계산한 값은 **언제나 과대이거나 같고 결코 과소일 수 없다.** 응답의 `error_direction_code`가 이 사실을 싣는다. 화면은 그 값을 근거로 "이만큼"이 아니라 "**최대 이만큼**"이라고 적는다.

**`0`과 `모름`은 다르다.** `state: "amount", determined_tax_krw: 0`은 "낼 세금이 없다"는 사실이고 `state: "unknown"`은 "얼마인지 모른다"는 사실이다. 두 상태의 결과가 다르다.

**`designer`가 넘긴 여섯(E1~E6)을 어디로 받았는가.** `screens.md` 3.8.5절의 요구를 계약이 어떻게 받았는지, 그리고 **그대로 받지 않은 곳과 그 이유**를 함께 적는다.

| # | 화면이 요구한 것 | 계약이 낸 것 | 그대로 받았는가 |
|---|---|---|---|
| E1 | 요청 필드 하나 — 낼 세금(정수 KRW, `null` 허용) | `profile.prior_year_tax` (객체, `state` 열거형 + 두 금액 칸) | **아니다.** `null` 하나로는 3.8.3절이 가른 **빈**과 **모름**을 구분할 수 없고(D14), `tax-domain`이 P0으로 지목한 예/아니오 대체 신호(`zero`·`nonzero_amount_unknown`)를 실을 자리가 없다. 그리고 되더하기가 두 칸을 **짝으로** 요구한다 |
| E2 | 자른 뒤 금액과 자르기 전 금액을 둘 다 | `pension_credit_*_krw`와 `pension_credit_*_before_cap_krw` | 그렇다 |
| E3 | 잘렸는지 여부와 잘린 금액 | `tax_liability_cap.applied` / `reduced_*_krw` | 그렇다. **배분안마다 다를 수 있으므로 배분안 단위로 낸다** |
| E4 | 임계값 | `tax_liability_cap.threshold_income_tax_krw` | 그렇다. **소득세분 기준임을 필드 이름에 넣었다** — 사용자가 대조할 값(결정세액)이 소득세이므로 지방세를 섞으면 대조가 어긋난다 |
| E5 | `모름`일 때의 notice 코드 | `tax_liability_cap_unknown` (8.2절) | 그렇다 |
| E6 | 낼 세금이 0일 때 배분안이 어떻게 되는지 | 5.12절 — 배분은 그대로, 공제액만 0, `tax_credit_axis_not_discriminating` + `objective_degenerate` | 그렇다. 4.8절 (3)의 두 갈래 중 **(가)**이고, 화면이 걱정한 "근거 없는 문장"을 쓰지 않아도 되도록 근거를 값으로 낸다 |

**E2·E4가 같은 규약에서 나온다** — 화면이 뺄셈을 시작하면 그 순간 세법 판단이 화면 코드로 새어 들어간다. 그래서 두 항과 그 차이를 엔진이 전부 낸다.

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
| `credit_rate_bracket` | CreditRateBracket | — | 어떤 공제율 구간으로, **무엇을 재서** 판정됐는지. 아래 표. 세 비율은 룰셋에서 산출된 값이며 숫자는 런타임에 정해진다 |
| `derived_age` | DerivedAge | — | 생년월일에서 엔진이 만든 만 나이와 **그 기준일.** `{ age_years, reference_date, reference_date_from_ruleset }`. `reference_date_from_ruleset`은 항상 `false`이고, **그 `false`의 뿌리가 규칙의 부재가 아니라 규칙의 내용이다** — 아래 참고. **화면은 이 나이를 사용자에게 되비추지 않는다**(designer가 박은 프라이버시 못) |
| `tax_liability_cap_affects` | TaxLiabilityCapEffect | — | 세액 한도가 무엇을 바꾸고 무엇을 바꾸지 않는지. 아래 |

**`reference_date_from_ruleset`이 `false`인 이유 (7차에 다시 씀).** 룰셋에 `age.reckoning.reference_date`가 생겼고 **그 규칙의 결론이 "단일 기준일은 존재하지 않는다"이다.** 세법이 정하는 것은 (1) 나이를 세는 방법과 (2) 각 요건이 언제 성립해야 하는가뿐이고, 요건마다 판정 시점이 다르므로 기준일을 하나의 날짜로 만들 수 없다 — 만드는 것이 오히려 틀린다. 그러므로 이 값은 규칙이 생긴 뒤에도 `false`이고, **달라진 것은 그 `false`가 이제 근거를 갖는다는 점이다.** 엔진은 그 규칙을 읽고(`legal_basis`의 `applied_to`가 `echo.derived_age.reference_date`를 가리킨다) 어느 요건이 기준일을 필요로 하는지를 8.3절의 가정에 싣는다.

**요건마다 판정 시점이 다르다는 사실은 이미 두 곳에 값으로 나가 있다.** 기준일을 필요로 하지 않는 쪽(`pension.withdrawal.earliest_start`)은 나이가 아니라 **날짜**로 환원되므로 `pension_withdrawal_start`가 날짜 그 자체를 낸다. 기준일을 필요로 하는 쪽(`isa.eligibility`)은 가정의 `params.requires_reference_date_rule_ids`에 이름으로 실린다. **그 구분이 값으로 나가야 하는 이유**는, 나가지 않으면 화면이 이 가정을 계산 **전체**에 걸린 것으로 읽고 실제로는 ISA 자격 판정 하나에만 걸리기 때문이다. 남은 오차(그 해에 19세가 되는 사람에게 **과대** 방향)는 요청에 계산 시점이 없어 지금 고칠 수 없고, D22가 다음 회차로 미뤘다.

**`CreditRateBracket`** — 비율만 되돌려주면 화면은 그 비율이 어느 축에서 나왔는지 알 수 없다. D27이 고친 결함이 정확히 그 구분의 부재였다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `income_tax_rate` | number | 비율(0~1) | 소득세 공제율. 룰셋에서 산출된다 |
| `local_tax_rate` | number | 비율(0~1) | 개인지방소득세 부가율 |
| `effective_rate` | number | 비율(0~1) | 위 둘을 합친 실효율 |
| `basis_code` | `"total_salary"` \| `"global_income"` \| `"statutory_default"` | — | **무엇으로 판정했는가.** 0.7절의 표가 세 값의 뜻을 정한다 |
| `measured_amount_krw` | integer \| null | 원/연 | 판정에 **실제로 쓴 금액.** `statutory_default`면 `null`이다 — 지어낸 금액을 되돌려주지 않는다 |
| `fallback_applied` | boolean | — | 종합소득금액을 몰라 본문 구간을 대신 적용했는가. `basis_code === "statutory_default"`와 같은 값이다 |
| `fallback_direction_code` | `"understated_or_equal"` \| null | — | 대체값을 적용했을 때 결과가 어느 쪽으로 틀리는가. **우대 구간을 적용하지 않은 것이므로 과소이거나 같다.** 아니면 `null` |
| `basis_rule_ids` | string[] | — | |

**`fallback_applied`가 `true`면 화면은 그 사실과 오차 방향을 금액과 같은 화면에 적어야 한다.** `tax_liability_cap.error_direction_code`와 같은 형태이되 **방향이 반대다** — 세액 한도 쪽은 "최대 이만큼"이고 이쪽은 "적어도 이만큼"이다. 두 표기를 같은 문장 틀로 쓰면 한쪽이 거짓이 된다.

**`FundUseHorizonEffect`** — 값이 고정이다. 계약이 스스로 "이 입력은 금액을 바꾸지 않는다"를 선언하고, `qa`가 게이트 4에서 이 선언과 실제 동작을 대조할 수 있다.

| 필드 | 자료형 | 값 |
|---|---|---|
| `allocation_amounts` | boolean | 항상 `false` |
| `tax_credit_amounts` | boolean | 항상 `false` |
| `limits` | boolean | 항상 `false` |
| `plan_ordering` | boolean | 항상 `true` |
| `baseline_selection` | boolean | 항상 `true` |
| `warnings` | boolean | 항상 `true` |

**`TaxLiabilityCapEffect`** — `FundUseHorizonEffect`와 같은 형태의 자기 선언이다. 값이 고정이라 `qa`가 실제 동작과 대조할 수 있다.

| 필드 | 자료형 | 값 |
|---|---|---|
| `allocation_amounts` | boolean | 항상 `false` |
| `tax_credit_amounts` | boolean | 항상 `true` |
| `limits` | boolean | 항상 `false` |
| `plan_ordering` | boolean | 항상 `false` |
| `baseline_selection` | boolean | 항상 `false` |
| `warnings` | boolean | 항상 `false` |

**세액 한도가 배분을 바꾸지 않는다는 보장.** 한도는 **공제액만** 자른다. `allocations`의 모든 금액, `limits`, `plans`의 순서와 `is_baseline`은 `prior_year_tax`의 어떤 값에서도 동일하다. 근거는 §61 ③이 밀려난 금액을 "연금계좌세액공제를 받지 아니한 것으로" 의제하고 시행령 §118의3이 **그 납입액을 이후 과세기간으로 전환 신청할 수 있게** 하기 때문이다 — 넣은 돈이 사라지지 않으므로 "한도가 0이면 넣지 마라"는 세법의 결론이 아니라 제품 판단이고, 엔진이 그 판단을 지어내지 않는다.

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
| `pension_credit_tax_liability_cap` | TaxLiabilityCap | 항상 | 5.10절. 세액 한도와 그것을 어떻게 알았는지 |
| `pension_withdrawal_start` | PensionWithdrawalStart[] | 항상 | 5.11절. 두 연금계좌 각각의 개시 가능 시점 |
| `isa_transfer_extra_limit` | IsaTransferExtraLimit \| null | 항상 | 요청에 `isa_transfer`가 없으면 `null` |
| `fund_use_horizon_boundaries` | FundUseHorizonBoundaries | 항상 | 5.9절. 화면이 선택지 라벨과 경고 문구에 넣을 실제 연수. **룰셋에서 읽은 값이다** |
| `plans` | Plan[] | 항상 | **1개 이상 4개 이하.** 첫 번째가 기본안이다. 5.5절 |
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
| `retirement_transfer_in_krw` | integer | 원/연 | 요청의 두 계좌 `retirement_transfer_in_krw` 합계. **세액공제 대상이 아니다.** 분리해 받은 값을 분리한 채로 되돌려 준다 — 화면이 이 금액을 절세액과 같은 축에 놓지 않게 하기 위해서다 |
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

**`credit_eligible_limit_remaining_krw`는 "추가로 인정될 여지"이지 배분 상한이 아니다.** 개정안 시나리오에서 청년 우대가 적용되면(`proposed.pension.credit.youth_irp_rate`) 추가 IRP 납입이 이미 인정된 연금저축 기납입분을 공제 풀에서 밀어내고 그만큼이 높은 율로 갈아탄다. 그래서 **배분액이 이 값을 넘을 수 있다.** 화면이 "잔여 한도"로 라벨을 붙여 배분액과 나란히 놓으면 모순처럼 보인다 — 근거와 전말은 `engine-design.md` 6.4절이다.

`*_shared_with`가 이 사실을 **구조로** 드러낸다. 값이 비어 있지 않은 필드는 다른 계좌와 같은 풀을 가리키므로 합산 대상이 아니다. 합계가 필요하면 이미 계산된 `LimitBreakdown.pension_contribution_limit_remaining_krw`와 `pension_combined_credit_remaining_krw`를 쓴다. 규약으로 막지 않고 데이터가 스스로 말하게 한 것이다.

**공유는 "같다"가 아니라 "더하면 안 된다"는 뜻이다.** 두 축의 성질이 다르다.

- **납입 한도** — 계좌별 추가 제약이 없으므로 공유 계좌가 **같은 값**을 보고하고, 그 값은 `pension_contribution_limit_remaining_krw`와 같다.
- **세액공제 한도** — 연금저축에만 단독 한도가 더 걸리므로 **두 계좌의 값이 다를 수 있다.** 각 값은 `pension_combined_credit_remaining_krw` 이하이고, 추가 제약이 없는 쪽(퇴직연금)이 그 풀 값을 그대로 보고한다.

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
| `plan_id` | string | — | `"max_tax_credit"` / `"annuity_savings_first"` / `"isa_first"` / `"pension_contribution_limit_fill"` |
| `is_baseline` | boolean | — | 정확히 하나가 `true`이고 그것이 `plans[0]`이다. 어느 안이 되는지는 `fund_use_horizon`이 정한다(`engine-design.md` 3.1절). 배분안이 하나로 합쳐지면 남은 하나가 `true` |
| `warnings` | PlanWarning[] | — | 이 배분안에서 걸리는 중도 불이익. 5.6절. 빈 배열일 수 있다 |
| `priority_basis` | PriorityBasis | — | **무엇을 우선한 안인가.** 5.6절 |
| `allocations` | Allocation[] | — | **항상 세 계좌 전부.** 배분액이 0인 계좌도 생략하지 않는다 |
| `total_allocated_monthly_krw` | integer | 원/월 | |
| `total_allocated_annual_krw` | integer | 원/연 | |
| `unallocated_monthly_krw` | integer | 원/월 | 한도가 모자라 배분되지 않은 금액 |
| `unallocated_annual_krw` | integer | 원/연 | |
| `unallocated_breakdown` | UnallocatedBreakdown | — | **미배분액이 어디로 갈 수 있는가.** 5.13절. 항상 있다 |
| `pension_combined_credit_remaining_after_plan_krw` | integer | 원/연 | **이 배분을 실행한 뒤** 남는 연금계좌 합산 세액공제 대상 한도. 0 이상. **`limits.pension_combined_credit_remaining_krw`는 배분 *전* 값이고 이것과 다른 것이다.** 화면이 뺄셈으로 만들지 마라 — 5.13절 아래 문장 틀을 보라 |
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
| `code` | string | `"tax_credit_maximization"` / `"annuity_savings_limit_first"` / `"isa_liquidity_first"` / `"pension_contribution_limit_first"` |
| `fill_sequence` | 계좌 id[] | **실제로 쓴 충당 순서.** 길이 3. `max_tax_credit`·`isa_first`에서는 연금 쌍의 순서가 `tie_break`에 따라 달라지므로 **고정 배열로 가정하지 말고 이 값을 읽어라** |
| `basis_rule_ids` | string[] | 이 우선순위를 뒷받침하는 규칙 id. 동점 판정이 적용됐으면 그 근거 규칙도 포함된다 |
| `tie_break` | TieBreak | 세제상 동점을 무엇으로 깼는가. 아래 |
| `objective_degenerate` | boolean | **이 안이 이름으로 내세운 목적함수가 이 입력에서 순위를 정하지 못하는가.** 세액 한도가 0이면 연금계좌에 얼마를 넣든 공제액이 0이라 최대값이 유일하지 않다. **이름이 세액공제를 근거로 든 두 안**(`max_tax_credit`·`annuity_savings_first`)에서만 `true`가 될 수 있다. `isa_first`(근거는 인출 가능성)와 `pension_contribution_limit_fill`(근거는 납입 한도)은 언제나 `false`다 — 한도가 0이어도 그 근거는 그대로 성립하므로 이름이 거짓말하지 않는다. 5.12절 |

**`TieBreak`**

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | `"withdrawal_flexibility_first"` — 두 연금계좌의 한계 공제율이 같아 인출이 자유로운 쪽을 먼저 채웠다. `"not_applicable"` — 공제율이 갈려 세액공제 최대화가 순서를 정했거나, **순서가 고정된 안**(`annuity_savings_first`·`pension_contribution_limit_fill`)이다 |
| `basis_rule_ids` | string[] | `withdrawal_flexibility_first`일 때 근거 규칙(`pension.withdrawal.midterm_restriction`). 아니면 빈 배열 |

**이 표가 `tie_break.code`의 정의 자리다**(8.0절). 다른 절과 `engine-design.md`는 조건을 다시 적지 않고 여기를 가리킨다.

**`pension_contribution_limit_fill`에 동점 규칙을 적용하지 않는 이유.** 동점 규칙을 정당화한 근거는 "비용이 0"이었다(0.4절). 그 안은 연금계좌를 **납입** 한도까지 채우므로 배분액이 연금저축 단독 공제한도를 넘어서고, 그 구간에서 연금저축을 앞세우면 단독 한도에 막혀 **세액공제 대상 인정액이 실제로 줄어든다.** 한계 공제율이 같아도 비용이 0이 아니므로 동점이 아니다. **인출 편의로 확정 세액을 깎지 않는다**는 선(0.4절 지킨 선 1)이 여기서 그대로 걸린다.

**확정 시나리오에서는 언제나 `withdrawal_flexibility_first`다.** 확정 룰셋에는 계좌에 따라 공제율이 갈리는 규칙이 없어 두 연금계좌의 한계 공제율이 **언제나** 같다. 따라서 `pension.withdrawal.midterm_restriction`이 룰셋에 있는 한(확정 룰셋에 있다) 확정 시나리오의 `max_tax_credit`·`isa_first`는 소득 구간·나이·`fund_use_horizon`과 무관하게 `tie_break.code`가 `withdrawal_flexibility_first`다. 공제율이 갈리는 것은 개정안 시나리오의 청년 우대뿐이고, 그때만 `not_applicable`이 된다.

**이 문장이 여기 있는 이유.** 계약이 확정 시나리오의 값을 적은 적이 없어 `tax-domain`이 골든 블록의 그 자리를 비워 둘 수밖에 없었다(`golden-cases.md` 6.4절, `verification-report.md` 5차). **값을 지어내지 않고 멈춘 판단이 옳았고, 빈 자리를 메우는 것은 계약의 몫이다.** 이제 확정 시나리오의 `tie_break`를 기대값으로 고정할 수 있다. 엔진 동작은 이 문장 이전과 이후가 같다 — 새로 적은 것이지 새로 정한 것이 아니다.

**`max_tax_credit`이라는 이름이 뜻하는 것.** 이 안은 **언제나 세액공제액을 최대화한다** — 그 보장은 바뀌지 않았다. `tie_break`가 말하는 것은 최대화하는 배분이 여럿일 때 그중 무엇을 골랐는가다. 세액이 갈리는 구간에서는 공제가 큰 쪽이 이기고, 동점 구간에서만 인출 유연성이 순서를 정한다. 경위는 0.4절.

**동점 구간에서는 `max_tax_credit`과 `annuity_savings_first`의 배분이 같아져 하나로 합쳐진다**(6.2절). 남는 비교 대상은 `isa_first`다. 화면은 `plans.length`를 읽어 대응한다.

**`DeterministicBenefit`** — 금액이 확정적으로 계산되는 효과. 현재는 연금계좌 세액공제뿐이다.

**`4.0.0`에서 앞의 세 필드가 한도 적용 **후** 값이 됐다.** 자르기 전 값이 필요하면 `*_before_cap_krw`를 읽는다. 화면이 뺄셈을 하지 않도록 두 항을 모두 낸다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `pension_credit_income_tax_krw` | integer | 원/연 | 소득세분. **세액 한도를 적용한 뒤의 인정액이다** |
| `pension_credit_local_tax_krw` | integer | 원/연 | 개인지방소득세분. **인정된 소득세분에 부가율을 적용해 산출한다** |
| `pension_credit_total_krw` | integer | 원/연 | 두 값의 합 |
| `pension_credit_income_tax_before_cap_krw` | integer | 원/연 | 한도를 적용하기 전 소득세분 |
| `pension_credit_local_tax_before_cap_krw` | integer | 원/연 | 한도를 적용하기 전 지방소득세분 |
| `pension_credit_total_before_cap_krw` | integer | 원/연 | 위 둘의 합 |
| `credit_eligible_contribution_krw` | integer | 원/연 | 세액공제 대상으로 인정된 납입액(전환금액 포함). **세액 한도로 잘리지 않는다** — 잘리는 것은 공제액이고 납입액은 전환 신청의 대상으로 살아남는다 |
| `tax_liability_cap` | PlanTaxLiabilityCap | — | 이 안에서 한도가 어떻게 걸렸는가. 아래 |
| `basis_rule_ids` | string[] | — | |

**`PlanTaxLiabilityCap`**

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `known` | boolean | — | 한도를 알고 있는가. `ScenarioResult.pension_credit_tax_liability_cap.known`과 같은 값 |
| `cap_krw` | integer \| null | 원/연 | 한도. 모르면 `null` |
| `applied` | boolean | — | **이 안에서 실제로 잘렸는가.** 잘린 상태와 잘리지 않은 상태의 문구가 다르다 |
| `reduced_income_tax_krw` | integer | 원/연 | 잘린 소득세분 |
| `reduced_local_tax_krw` | integer | 원/연 | 잘린 지방소득세분 |
| `reduced_total_krw` | integer | 원/연 | 잘린 합계 |
| `threshold_income_tax_krw` | integer | 원/연 | **임계값.** 낼 세금(결정세액 + 연금계좌 세액공제액)이 이 값보다 적으면 결과가 달라진다. 자르기 전 소득세분과 같다. **화면이 배분액에 공제율을 곱해 만들지 않는다** — 사용자가 나중에 영수증을 보고 스스로 대조할 수 있게 하는 값이다 |
| `credit_carryforward` | `false` | — | 초과분의 **세액공제액**은 이월되지 않는다. 룰셋에서 읽은 값이다 |
| `contribution_carryover_available` | boolean | — | 잘린 공제에 대응하는 **납입액**을 이후 과세기간으로 전환 신청할 수 있는가(시행령 §118의3). `applied`와 같이 움직인다. **"넣은 돈이 사라진다"는 틀린 문구다** — 정확한 서술은 "올해의 세액공제는 0이고 그 납입액은 신청을 통해 이후 과세기간으로 넘길 수 있다"이다. **이 이름 하나가 조건 둘을 감추고 있었다**(D26) — 아래 두 칸을 함께 읽어야 한다 |
| `carryover_shares_future_year_credit_limit` | `true` \| null | — | 전환금액이 **전환한 해의** 600만·900만 한도를 그 해의 새 납입액과 나눠 쓰는가. 룰셋에서 읽는다. **`true`이므로 매년 한도를 채우는 사용자에게는 전환할 자리가 생기지 않는다** — 그 사용자에게 "다음 해에 이월해 공제받을 수 있습니다"는 **거짓**이다. `contribution_carryover_available`이 `false`면 이 칸은 `null`(읽지 않은 규칙을 주장하지 않는다) |
| `carryover_requires_application` | `true` \| null | — | 신청주의인가. 룰셋의 `automatic`에서 읽는다. **자동이 아니다.** 위와 같은 이유로 `null`일 수 있다 |
| `error_direction_code` | string \| null | — | `known: false`일 때 `"overstated_or_equal"`. 아니면 `null` |
| `basis_rule_ids` | string[] | — | 잘렸으면 전환 특례 규칙이 함께 실린다 |

**`NonQuantifiedEffect`** — 금액으로 낼 수 없는 효과. **`DeterministicBenefit`과 같은 축에서 더하면 안 된다.**

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `code` | string | — | `"isa_tax_free_headroom"` / `"pension_contribution_without_credit"` |
| `account` | 계좌 id | — | |
| `headroom_krw` | integer \| null | 원 | 관련 한도 금액(있으면). 절세액이 아니다 |
| `headroom_shared_with` | 계좌 id[] | — | 이 한도를 **함께 쓰는 다른 계좌.** 비어 있으면 전용이다. `AccountLimit.*_shared_with`와 같은 뜻이고 같은 금지가 걸린다 — **비어 있지 않으면 두 계좌의 `headroom_krw`를 더하면 이중계상이다** |
| `quantifiable` | `false` | — | 항상 `false` |
| `reason_code` | string | — | 왜 금액을 못 내는가. `"depends_on_investment_return_not_in_ruleset"` / `"benefit_depends_on_return_horizon_and_withdrawal_form_not_in_ruleset"` |
| `facts` | object \| null | — | 이 효과에 딸린 **참·거짓 사실들.** `pension_contribution_without_credit`에만 있고 다른 코드에서는 `null`. 아래 표 |
| `basis_rule_ids` | string[] | — | |

**`pension_contribution_without_credit` — 세액공제를 낳지 않는 연금계좌 납입 (D26).** `pension_contribution_limit_fill` 배분안에서만 나온다. `headroom_krw`는 그 안을 실행한 뒤 남는 **연금계좌 합산 납입 여력**이고 두 계좌가 나눠 쓴다.

**`facts` — 셋 중 하나라도 빠지면 화면 문장이 거짓이 된다.** 값은 전부 룰셋에서 읽는다.

| 키 | 자료형 | 뜻 |
|---|---|---|
| `credit_this_year_krw` | integer | 이 납입이 **올해** 낳는 세액공제액. `0`이다 |
| `contribution_without_credit_krw` | integer | 이 배분안이 그 계좌에 넣은 금액 중 **세액공제를 낳지 않는 몫** |
| `principal_taxed_on_withdrawal` | boolean | 그 **원금**이 인출 시 과세되는가. `false` — 과세제외금액이고 가장 먼저 인출된다 |
| `principal_tax_free_requires_confirmation` | boolean | 그 성격을 인정받는 데 **세무서 확인서를 금융회사에 내는 절차**가 필요한가. `true` |
| `principal_tax_free_confirmation_prospective_only` | boolean | 그 확인이 **확인받은 날부터** 적용되는가(소급하지 않는가). `true` |
| `returns_taxed_on_withdrawal` | boolean | 그 원금이 번 **수익**에 인출 시 세금이 붙는가. `true` |

**`principal_tax_free_requires_confirmation`이 이 표의 이유다.** 이 값이 없으면 화면은 "나중에 비과세로 돌아옵니다"를 쓰게 되고, **그 문장은 절차를 말하지 않는 한 거짓이다.** 절차를 밟지 않은 채 인출하면 한 번도 공제받지 못한 원금에 세금이 붙을 수 있다.

**쓰면 안 되는 문장** — 이 효과 옆에 다음을 쓰지 않는다.

- "공제 못 받아도 다음 해에 이월해서 공제받을 수 있습니다" — 전환금액이 전환 연도의 공제한도를 나눠 쓰므로 매년 한도를 채우는 사용자에게 거짓이다. **이 효과의 `basis_rule_ids`에 전환 특례 규칙이 없는 것이 그 이유다.**
- "과세이연으로 ○○원 이득" — 금액을 낼 수 없다. `quantifiable: false`가 그 사실이다.
- "연금계좌에 더 넣는 것이 유리합니다 / 손해입니다" — 세법이 어느 쪽도 정하지 않는다.

**`PlanWarning`** — 자금 사용 시점에 따라 걸리는 중도 불이익. 게이트 2 D10으로 추가됐다.

| 필드 | 자료형 | 설명 |
|---|---|---|
| `code` | string | 8.4절의 두 코드 중 하나 |
| `account` | 계좌 id | 어느 계좌의 배분에 걸리는가. **배분액이 0인 계좌에는 경고가 붙지 않는다** |
| `severity` | `"warning"` \| `"info"` | 사용자가 사용 시점을 밝혔으면 `warning`, `unknown`이면 `info` |
| `trigger` | `"declared_horizon"` \| `"horizon_unknown"` | 어떤 근거로 낸 경고인가. `horizon_unknown`은 구성요건을 판정하지 않고 사실을 알린 것이다 |
| `basis_rule_ids` | string[] | 근거 규칙 id. 화면은 이 경고 옆에도 법령 조항을 붙일 수 있다 |
| `params` | object | 문구 조립용. `fund_use_horizon_boundaries`의 값과, 연금계좌 경고에는 그 계좌의 `earliest_start_date`·`years_until_earliest_start`·`earliest_start_computable`이 함께 들어간다. **나이 요건만으로 만든 문구는 55세에 가까운 사람에게 틀린다** — 그 사람은 5년 요건이 새로 시작되므로 실질 잠금기간이 5년이다 |

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
| `has_uncertainty_note` | boolean | 불확실성 표시가 하나라도 있는가. **언제나 `uncertainty_notes.length > 0`과 같다** |
| `uncertainty_notes` | UncertaintyNote[] | **어떤 표시가 어디에 몇 건 남아 있는가.** 아래 |

각 숫자 필드에 붙는 `basis_rule_ids`가 이 목록의 `rule_id`를 가리킨다. 화면은 두 방향(값 → 근거, 근거 → 값) 모두로 연결할 수 있다.

**`UncertaintyNote`**

| 필드 | 자료형 | 설명 |
|---|---|---|
| `path` | string | 규칙 `value` 안에서의 위치. 점 경로이고 배열은 `items[1]`처럼 첨자를 단다 |
| `kind` | `"unverified"` \| `"confidence_not_verified"` \| `"value_absent"` \| `"text_marker"` | 어떤 형태의 표시인가. 순서대로 — 규칙이 `unverified` 키로 스스로 적은 것 / `confidence`가 `verified`가 아닌 것 / 시행령 위임 등으로 값 자체가 비어 있는 것 / 본문에 '미확인'이라 적힌 것 |

배열은 `path` 사전순으로 고정된다.

#### 5.7.1 왜 유무(boolean)가 아니라 목록인가 — 계약이 정한 것과 정하지 못하는 것

**룰셋의 `unverified`는 문서가 아니라 사용자 고지의 트리거다.** 불확실성 표시가 있는 규칙은 근거에 그 사실이 붙고 화면이 그것을 보인다.

**유무만 보는 구조로는 "일부 해소"를 표현할 수 없다.** 한 규칙 안에 미확인이 셋 남아 있는데 그중 하나를 해소하며 `unverified` **키를 통째로 지우면**, boolean은 `true`에서 `false`로 넘어가고 **남은 둘까지 조용히 사라진다.** 실제로 그럴 뻔했고 테스트가 잡았다(D27의 구조적 발견). 목록이면 3건이 2건으로 줄어드는 것이 값에 나타난다 — **줄어든 것과 사라진 것이 구별된다.**

**이 계약이 막지 못하는 것을 분명히 적는다.** 엔진은 룰셋을 그대로 비출 뿐이므로, **작성자가 지워서는 안 될 표시를 지운 경우는 여전히 엔진이 잡지 못한다.** 그 자리를 무는 것은 셋이다.

1. **`tax-domain`의 골든 블록** — 규칙별 미확인 건수를 정답지가 주장하면 줄어든 사실이 대조에 걸린다. 지금 정답지는 이 축을 주장하지 않으며, 그것은 `golden-cases.test.mjs`의 미사용 어휘 목록에 빚으로 적혀 있다.
2. **`scripts/org/validate-rules.mjs`** — 룰셋 유닛의 검증기이고 이 유닛의 산출물이 아니다. 규칙별 표시 대장을 두는 것이 가장 값싼 방어선이라고 보고, `tax-domain`·관리자에게 올린다.
3. **`qa`의 회귀 리포트** — 근거 블록에 보이는 건수가 회차 사이에 줄었는지를 사람이 본다.

**바꾸지 않는 선택도 검토했고 기각했다.** boolean을 유지하면 위 1~3이 볼 것이 "true/false"뿐이라 **줄어든 것을 볼 수가 없다.** 목록으로 바꾸는 비용은 필드 하나 추가(minor 성격)이고, 그 대가로 세 방어선 전부가 셀 수 있는 대상을 갖는다.

### 5.13 `UnallocatedBreakdown` — 「미배분」을 갈래로 나눈다 (D26)

**소유자가 지적한 것은 배분이 아니라 이름이었다.** 연금 공제한도와 ISA 한도가 다 차면 나머지가 「미배분」으로 빠지는데, 사용자는 그것을 **"갈 곳이 없다"**로 읽는다. 세법상 사실은 **"갈 곳은 있고, 다만 올해 공제는 늘지 않는다"**이다. 월 500만원 예시에서 미배분 1,100만원 중 900만원은 연금계좌에 **적법하게 더 넣을 수 있는** 돈이다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `total_annual_krw` | integer | 원/연 | `Plan.unallocated_annual_krw`와 같은 값. 이 객체 안에서 합이 맞는지 화면이 확인할 수 있게 다시 싣는다 |
| `pension_contribution_headroom_krw` | integer | 원/연 | 미배분액 중 **연금계좌에 법적으로 더 납입할 수 있는 금액.** `min(미배분액, 이 배분 후 남은 연금 납입 한도)`. **세액공제를 낳지 않는다.** 두 연금계좌가 모두 납입 불가 상태면 `0` |
| `isa_contribution_headroom_krw` | integer | 원/연 | 같은 방식으로 ISA 쪽. ISA 자격이 없으면 `0` |
| `no_headroom_krw` | integer | 원/연 | 세 계좌 어디에도 넣을 수 없는 금액. **이 몫에 대해서만 「미배분」의 옛 뜻이 참이다** |
| `headrooms_overlap` | boolean | — | 위 두 여력이 **같은 돈을 두 번 세고 있는가.** 미배분액이 두 여력의 합보다 작으면 `true`. **`true`일 때 화면은 두 값을 더하면 안 된다** |
| `basis_rule_ids` | string[] | — | |

**`headrooms_overlap`을 둔 이유는 `AccountLimit.*_shared_with`와 같다**(5.3절) — 규약 문장으로 막지 않고 데이터가 스스로 "더하면 안 된다"고 말하게 한다.

**지금의 네 충당 순서에서 이 값은 언제나 `false`다.** 네 순서 모두 ISA를 채우므로 예산이 남았다는 것은 ISA 한도가 이미 찼다는 뜻이고, 그러면 ISA 여력이 0이라 겹칠 수가 없다. **필드를 지우지 않는 이유는 그것이 화면에 대한 보증이기 때문이다** — 화면은 두 값을 더해도 되는지를 규약이 아니라 데이터로 알아야 하고, ISA를 끝까지 채우지 않는 안이 생기는 날 이 값은 저절로 참이 된다. 응답만으로는 그 갈래가 돌지 않으므로 산술을 따로 시험한다(`splitUnallocated`).

#### 5.13.1 「세액공제가 더 인정될 수 있는 금액」을 참으로 만드는 세 값

옛 문구는 배분 **전** 잔여 한도를 배분 **후** 숫자들 옆에 놓아 거짓이었다. 참이 되려면 **한도 · 이 배분이 쓴 양 · 남은 양** 셋이 함께 있어야 하고, **화면이 뺄셈을 하면 안 된다.**

| 무엇 | 어디서 읽는가 |
|---|---|
| 한도 | `ScenarioResult.limits.pension_combined_credit_limit_krw` |
| 이 배분이 쓴 양 | `Plan.deterministic_benefit.credit_eligible_contribution_krw` |
| 남은 양 | `Plan.pension_combined_credit_remaining_after_plan_krw` |

**남은 양이 0인 사용자에게 여유가 있는 것처럼 말하지 않는다.** 그 사용자에게 이어질 수 있는 문장은 "올해 연금계좌에 더 납입해도 올해의 세액공제는 늘지 않습니다"이고, 그 뒤에 미배분 갈래를 붙일 수 있다 — "남은 ○○원은 연금계좌에 납입할 수는 있습니다(`pension_contribution_headroom_krw`). 다만 그 납입은 올해의 세액공제를 늘리지 않습니다." **그 뒤를 더 쓰려면 `NonQuantifiedEffect.facts`의 세 사실을 함께 적어야 한다**(5.6절).

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

### 5.10 `TaxLiabilityCap`

세액 한도와 **그것을 어떻게 알았는지.** 두 시나리오에서 같은 값이다 — 한도는 개정예고 규칙의 대상이 아니다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `known` | boolean | — | 한도를 알고 있는가 |
| `cap_krw` | integer \| null | 원/연 | 한도. **`0`은 유효한 값이고 `null`(모름)과 다르다** |
| `determined_tax_krw` | integer \| null | 원 | 요청에서 받은 결정세액. 금액을 받지 않았으면 `null` |
| `prior_pension_credit_krw` | integer \| null | 원 | 되더한 연금계좌 세액공제액. 한도를 모르면 `null` |
| `source_code` | `"determined_tax_add_back"` \| `"declared_zero"` \| null | — | 한도를 어떻게 얻었는가. 모르면 `null` |
| `declared_nonzero` | boolean | — | 한도가 0이 아니라는 것까지는 아는가. `state`가 `"nonzero_amount_unknown"`이거나 한도가 양수로 확정된 경우 `true` |
| `error_direction_code` | `"overstated_or_equal"` \| null | — | 한도를 모른 채 낸 값이 어느 쪽으로 틀리는가. **조문상 방향이 한쪽으로만 열려 있다** — 한도가 공제액을 늘리는 경로가 없다. 한도를 알면 `null` |
| `credit_carryforward` | `false` | — | 초과분의 세액공제액이 이월되는가. 룰셋에서 읽는다 |
| `basis_rule_ids` | string[] | — | |

### 5.11 `PensionWithdrawalStart`

두 연금계좌 각각에 대해 **연금으로 꺼낼 수 있는 가장 이른 시점**을 낸다. 배열 순서는 `retirement_pension` → `annuity_savings`다.

| 필드 | 자료형 | 단위 | 설명 |
|---|---|---|---|
| `account` | 계좌 id | — | 연금계좌 둘만 실린다. ISA에는 이 개념이 없다 |
| `computable` | boolean | — | 시점을 계산할 수 있었는가 |
| `earliest_start_date` | string \| null | `YYYY-MM-DD` | `max(만 55세가 되는 날, 가입일부터 5년이 되는 날)`. 이연퇴직소득이 있으면 5년 요건이 면제되어 나이 요건만으로 정해진다 |
| `years_until_earliest_start` | integer \| null | 년 | 과세기간 종료일부터 위 날짜까지 남은 햇수(**올림**). 짧게 보이는 쪽이 위험하므로 올림이다 |
| `age_requirement_date` | string | `YYYY-MM-DD` | 만 55세가 되는 날. 가입일을 몰라도 이 값은 나온다 |
| `holding_requirement_date` | string \| null | `YYYY-MM-DD` | 가입일부터 5년이 되는 날. 가입일을 모르면 `null` |
| `holding_requirement_waived` | boolean | — | 이연퇴직소득이 있어 5년 요건이 적용되지 않는가 |
| `bound_by_holding_period` | boolean | — | 나이 요건이 아니라 **5년 요건이 시점을 정했는가.** 55세에 가까운 사람이 계좌를 처음 열면 실질 잠금기간이 5년이 되는 것이 이 값으로 드러난다 |
| `reason_code` | `"opened_on_missing"` \| null | — | 계산하지 못한 이유 |
| `basis_rule_ids` | string[] | — | |

**남은 기간을 배분 비율로 옮기지 않는다.** 세법이 정하는 것은 (a) 자금이 언제부터 연금으로 나올 수 있는가와 (b) 그 전에 꺼내면 얼마가 과세되는가뿐이고, **그 둘을 비율로 옮기는 것은 제품의 설계 결정이라고 규칙이 명시한다**(`not_determined_by_tax_law`). 엔진은 시점만 내고 비율을 만들지 않는다.

### 5.12 세액 한도가 0일 때 — 목적함수가 무너지는 자리

**문제.** 한도가 0이면 연금계좌에 얼마를 넣든 공제액이 0이라 `max_tax_credit`의 최대값이 **유일하지 않다.** 이때 엔진이 조용히 아무 배분이나 고르고 그 이름을 그대로 달면, **근거 없는 답을 근거 있는 답처럼** 내놓는 것이 된다.

**엔진이 하는 세 가지.**

1. **배분을 그대로 둔다.** 한도가 넉넉한 경우와 배분 벡터가 완전히 같다(4.2절의 `tax_liability_cap_affects`가 이것을 선언한다).
2. **모든 안의 공제액을 0으로 낸다.** 자르기 전 금액은 남으므로 화면이 "계산된 공제액 중 얼마가 이번 과세연도에 들어 있지 않은지"를 말할 수 있다.
3. **비교의 축이 사라졌다는 사실을 값으로 낸다** — `comparison_note_codes`의 `tax_credit_axis_not_discriminating`과 각 안의 `priority_basis.objective_degenerate`.

**엔진이 하지 않는 두 가지, 그리고 그 근거.**

- **연금계좌 배분을 0으로 만들지 않는다.** 잘린 것은 공제액이고 **납입액은 살아남는다** — §61 ③이 초과분을 "받지 아니한 것으로" 의제하고 시행령 §118의3이 그 납입액을 이후 과세기간으로 전환 신청할 수 있게 한다. 즉 "한도가 0이면 넣을 이유가 없다"는 **세법의 결론이 아니다.** 그것을 엔진이 결론으로 내면 조문에 없는 선호를 지어낸 것이 된다. (동시에 이 특례가 납입을 **권하는** 근거도 아니다 — 이후 연도의 한도를 미리 쓰고 그동안 인출이 제한된 계좌에 돈이 묶인다. 그래서 엔진은 어느 쪽으로도 결론을 내지 않고 사실만 낸다.)
- **기본안을 옮기지 않는다.** 세액이 전부 같아졌으니 유동성 우선안(`isa_first`)을 기본으로 올리는 것이 자연스러워 보이지만, 그것은 **세금 밖의 선호를 엔진이 새로 만드는 것**이다. 0.4절이 동점 규칙을 정당화한 근거는 "두 연금계좌의 **과세가 완전히 같다**"였고, 연금계좌와 ISA 사이에는 그 전제가 성립하지 않는다(ISA는 비과세 한도라는 다른 축을 갖고 그 효과는 금액으로 낼 수 없다). 기본안은 여전히 `fund_use_horizon`이 정하고, 그 순위가 세액에서 나온 것이 **아니라는** 사실을 위 두 값이 화면에 알린다.

**`isa_first`만 `objective_degenerate: false`인 이유.** 그 안의 근거는 `pension.withdrawal.eligibility`와 `pension.early_withdrawal.other_income_rate`, 즉 **인출 가능성**이다. 한도가 0이어도 그 사실은 그대로 성립하므로 이름이 거짓말하지 않는다. 반대로 `max_tax_credit`(`tax_credit_maximization`)과 `annuity_savings_first`(`annuity_savings_limit_first`)는 둘 다 공제를 근거로 든 이름이라, 그 근거가 이 입력에서 아무것도 가르지 못한다는 사실을 스스로 밝혀야 한다.

---

## 6. 순서와 결정성

### 6.1 고정 순서

요청의 배열 순서와 무관하게 응답의 순서가 고정된다. 스냅샷 테스트와 목이 요청 순서에 흔들리면 안 되기 때문이다.

| 배열 | 순서 |
|---|---|
| `scenarios` | `current` → `proposed` |
| `plans` | **기본안이 첫 번째.** 나머지는 `max_tax_credit` → `annuity_savings_first` → `isa_first` → `pension_contribution_limit_fill`에서 기본안을 뺀 순서. 기본안은 `fund_use_horizon`이 정한다(`engine-design.md` 3.1절). **`pension_contribution_limit_fill`은 기본 집합에서 결코 기본안이 되지 않는다** — 마지막에 두는 것도 그 때문이다 |
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

### 8.0 조건은 한 곳에만 적는다 (D18)

**규약.** 코드마다 **정의 자리**가 하나 정해져 있다. 그 코드가 **언제 나가는지는 정의 자리에만 적는다.** 문서의 다른 곳은 조건을 다시 서술하지 않고 **코드 이름으로 가리킨다** — "8.2절의 조건과 같다"로 충분하다.

| 코드 종류 | 정의 자리 |
|---|---|
| 오류 코드 | 8.1절 |
| 안내 코드 | 8.2절 |
| 가정 코드 | 8.3절 |
| 경고 코드 | 8.4절 |
| 비교 안내 코드 | 8.5절 |
| `tie_break.code` | 5.6절 |

**정의 자리의 형태가 정해져 있다.** 첫 열 머리가 `코드`인 표, 또는 `조건`·`언제`·`무엇을 가정했는가` 열을 가진 표는 **코드 조건 표**로 본다. 그런 표는 8.1~8.5절에만 둔다. 이 문서와 `engine-design.md`를 통틀어 한 코드의 정의 행은 **하나뿐이어야 한다.**

**예외 — 두 표에 함께 실리는 코드.** 같은 사실이 서로 다른 배열로 나가는 경우다. 아래 표에 적힌 것만 예외이고, **예외를 늘리려면 여기에 적어야 한다.** 검사기는 양방향으로 본다 — 여기 없는 이중 등재도, 이중 등재가 아닌데 여기 적힌 것도 실패다.

| 이중 등재 코드 | 실리는 표 | 나가는 배열 |
|---|---|---|
| `plans_collapsed_single` | 8.2절 · 8.5절 | `notices` · `comparison_note_codes` |
| `pension_holding_period_not_evaluated` | 8.2절 · 8.3절 | `notices` · `assumptions` |

**0절은 경위이지 정본이 아니다.** 0절의 서술과 정의 자리가 어긋나면 **정의 자리가 이긴다.** 0절은 왜 그렇게 정해졌는지를 남기는 자리이고, 그 서술은 적힌 시점의 사정을 담는다.

**기계 검사.** `scripts/org/validate-code-definitions.mjs`가 (a) 코드 조건 표가 8.1~8.5절 밖에 생기지 않았는지, (b) 정의 행이 유일한지와 위 예외 목록이 양방향으로 맞는지, (c) 정의 표와 `src/engine/constants.mjs`의 코드 집합이 같은지, (d) 위 "현재 계약 버전"과 `SCHEMA_VERSION`이 같은지를 본다.

**이 검사가 못 보는 것을 분명히 해 둔다.** 검사기는 **표만** 본다. **산문이 조건을 옮겨 적은 것은 잡지 못하며, D18의 결함 자체도 잡지 못했을 것이다** — 그것은 8.4절의 산문 한 문장이었다. 표를 벗어나면 어디까지가 조건 서술이고 어디부터가 정상 참조인지 기계가 가릴 수 없고, 억지로 가리면 "없으면 `missing_required` 오류" 같은 정상 참조 수십 건이 오탐으로 걸린다. **오탐이 잦은 검사는 곧 무시당하고 없는 것만 못하다.** 그래서 검사기는 **조건을 두 번 적을 수 있는 그릇(표)이 생기는 것**을 막고, 산문은 위 규약과 사람이 지킨다. 5.6절의 `tie_break.code`도 표 형태가 달라 검사 밖이다.

**왜 이 규약이 생겼나.** M2·M3·D18이 전부 같은 형태의 결함이었다 — **하나의 사실을 계약 두 곳에 적고 한쪽만 갱신했다.** D18에서는 8.2절과 8.4절이 `isa_lock_in_already_elapsed`에 대해 정반대 답을 내, `tax-domain`이 GC-28의 기대값을 채우다 멈췄다. 개별 수정으로는 네 번째가 나온다. **조건을 두 번 적을 자리를 없애는 것이 고침이다.**

### 8.1 오류 코드

| 코드 | 언제 |
|---|---|
| `schema_version_mismatch` | 요청의 `schema_version`이 엔진이 아는 값이 아님 |
| `missing_required` | 필수 필드 누락 |
| `not_integer` | 정수여야 하는 값이 정수가 아님 |
| `negative_value` | 0 이상이어야 하는 값이 음수 |
| `out_of_range` | 허용 범위 밖(예: `months_remaining_in_tax_year`) |
| `invalid_enum` | 허용된 값 목록에 없는 문자열. `prior_year_tax.state`가 금액을 뜻하지 않는데 `determined_tax_krw`가 실려 온 경우도 여기다 |
| `invalid_date` | `YYYY-MM-DD` 형식이 아니거나 달력에 없는 날짜(`profile.birth_date`, `accounts.*.opened_on`). **오류 `params`에 입력값을 되풀이하지 않는다** |
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
| `isa_type_conflicts_with_prior_income` | warning | 사용자가 **서민형**을 선언했는데 직전 과세기간 총급여액이 `isa.tax_free_limit`의 서민형 총급여 상한을 **넘는** 경우. 그때만 조문이 서민형 경로를 스스로 닫는다(0.8절). `params.unverifiable_bracket_ids`에 엔진이 확인하지 못한 목의 id. **계산은 사용자 선언을 따른다** |
| `isa_type_cross_check_inconclusive` | info | 직전 과세기간 총급여액이 위 상한 **이하**이고, `isa.tax_free_limit`의 `brackets_statutory.items` 중 엔진이 확인할 입력을 갖지 못한 목(`restriction`·`delegated`)이 하나라도 있는 경우. **결론을 내지 않았다는 사실 통지이며 선언이 틀렸다는 뜻이 아니다.** `params.unverifiable_bracket_ids` 포함 |
| `credit_rate_global_income_missing` | warning | `has_non_wage_global_income_current_year`가 `true`인데 `current_year_global_income_krw`가 `null`이어서 종합소득금액을 확인하지 못함. 본문 구간(우대가 아닌 쪽)을 적용했다. `params.error_direction`이 `"understated_or_equal"`. **이 안내가 붙은 결과의 금액은 "적어도 이만큼"이다** — 세액 한도의 "최대 이만큼"과 방향이 반대이므로 같은 문장 틀을 쓰면 한쪽이 거짓이 된다 |
| `isa_type_not_declared` | info | ISA 유형 미선언으로 비과세 한도 표시 생략 |
| `isa_tenure_missing` | warning | ISA 가입경과연수 미입력으로 가장 보수적인 값으로 계산 |
| `isa_lock_in_already_elapsed` | info | `fund_use_horizon`이 **`within_isa_lock_in`일 때만**이고, 그때 `fund_use_horizon_boundaries.isa_lock_in_years_remaining`이 0이다. 입력과 현실이 어긋난다는 **사실 통지**이며 법적 불이익 고지가 아니다. `fund_use_horizon`이 `"unknown"`이면 나가지 않는다 — `unknown`을 고른 사용자는 어긋날 주장을 한 적이 없다(D18). 이 조건은 **여기에만 적는다**(8.0절) |
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
| `tax_liability_cap_unknown` | warning | `profile.prior_year_tax.state`가 `"unknown"` 또는 `"nonzero_amount_unknown"`이어서 세액 한도를 확인하지 못함. `params.error_direction`이 `"overstated_or_equal"`, `params.declared_nonzero`가 0이 아님을 답했는지를 싣는다. **이 안내가 붙은 결과의 금액은 "이만큼"이 아니라 "최대 이만큼"이다** |
| `tax_liability_cap_zero` | info | 세액 한도가 0으로 확정됨. **오류가 아니라 결과다** — 이 사용자에게는 0이 정확한 답이므로 오류·경고 색을 쓰지 않는다 |
| `tax_liability_cap_applied` | info | 반환된 배분안 중 하나 이상에서 계산된 세액공제액이 한도에 걸려 잘림 |
| `pension_contribution_blocked_annuity_started` | warning | `accounts.*.annuity_start_status`가 `"started"`. 그 계좌는 납입이 연금보험료로 인정되지 않아 배분 대상에서 빠진다. `params.account`에 계좌 id. **두 연금계좌를 구분하지 않는다** |
| `pension_annuity_start_unknown` | warning | `accounts.*.annuity_start_status`가 `"unknown"`. 그 계좌의 배분을 보류한다. `params.account`에 계좌 id |
| `pension_start_date_not_computable` | info | `accounts.*.opened_on`이 없어 개시 가능 시점을 계산하지 못함. 나이 요건만 낸다 |
| `retirement_transfer_excluded_from_credit` | info | 퇴직급여 입금액·계약이전액이 입력에 있어 세액공제 대상 납입액에서 제외함. `params.amount_krw` 포함 |

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
| `age_reference_date_not_in_ruleset` | **이름이 낡았다. 뜻은 이 칸이 정의한다** — 룰셋 규칙 `age.reckoning.reference_date`가 **단일 기준일은 존재하지 않는다**고 정하므로, 엔진이 만 나이를 환산할 기준일은 여전히 룰셋에서 나오지 않고 엔진이 과세기간 종료일을 골랐다는 뜻이다. `params.reference_date`와 **이 가정이 걸리는 요건의 목록** `params.requires_reference_date_rule_ids`(룰셋의 `no_single_reference_date.per_rule`에서 `needs_reference_date`인 것) 포함. `basis_rule_ids`에 그 규칙이 실린다. **코드 문자열을 바꾸면 계약이 깨지므로** 개명은 계산 기준일 입력과 함께 다음 회차에 처리한다(D22) |
| `prior_pension_credit_zero_assumed` | 직전 과세연도 연금계좌 세액공제액 미입력으로 0으로 봄. 한도가 과소로 나오는 방향이고 과소한 한도는 절세액을 과대로 만들지 않음 |
| `retirement_transfer_counted_in_contribution_limit` | 퇴직급여 입금액·계약이전액이 연간 납입한도를 쓰는지 룰셋이 정하지 않아 **쓰는 쪽**(배분이 작아지는 방향)으로 봄. `params.amount_krw` 포함 |
| `deferred_retirement_income_absent_assumed` | 이연퇴직소득 유무 미입력으로 없는 것으로 봄. 5년 요건이 살아 있어 잠금기간을 길게 보는 방향 |
| `local_tax_follows_income_tax_cap` | 개인지방소득세에 같은 세액 한도 구조가 있는지 룰셋이 미확인이므로, **인정된 소득세분**에 부가율을 적용해 지방세분을 산출함 |
| `credit_rate_wage_only_excludes_separately_taxed_income` | `has_non_wage_global_income_current_year`가 `true`가 아니어서 **총급여액 기준**으로 공제율을 판정함. 1단계 질문을 "종합소득과세표준에 **합산되는** 소득이 있는가"로 좁혀 물었으므로, 분리과세로 종결된 소득만 더 있는 사람도 이 분기로 온다. 규칙의 `open_interpretation`이 그 쟁점을 **미확정**으로 남겼고 이 가정이 두 해석 중 하나를 채택한 것이다. **조문이 정한 것이 아니다.** 0.7절 |

### 8.4 경고 코드 (`Plan.warnings`)

| 코드 | 계좌 | 조건 | 근거 규칙 |
|---|---|---|---|
| `early_withdrawal_penalty_pension` | `annuity_savings`, `retirement_pension` | 배분액 > 0 이고 `fund_use_horizon`이 `within_isa_lock_in` 또는 `before_pension_age` | `pension.withdrawal.eligibility`, `pension.early_withdrawal.other_income_rate` |
| `early_termination_clawback_isa` | `isa` | 배분액 > 0 이고 `fund_use_horizon`이 `within_isa_lock_in` **이고 `fund_use_horizon_boundaries.isa_lock_in_years_remaining > 0`** | `isa.early_termination.clawback`, `isa.account.requirements` |

`fund_use_horizon`이 `"unknown"`이면 위 둘을 배분액 > 0인 계좌 전부에 대해 `severity: "info"` · `trigger: "horizon_unknown"`으로 낸다. **ISA 쪽은 이때도 잔여 의무가입기간 조건이 함께 걸린다.** `"at_or_after_pension_age"`면 경고를 내지 않는다.

**잔여 의무가입기간 조건의 근거.** 추징 규칙은 의무가입기간이 되는 날 **전** 해지에만 걸린다. 기간이 지난 계좌에는 추징 위험이 없으므로 경고도 성립하지 않는다. 경위는 0.2절.

**이 조건 때문에 경고가 꺼졌을 때 안내 코드 `isa_lock_in_already_elapsed`가 함께 나가는지는 8.2절이 정한다.** 그 조건은 여기에 다시 적지 않는다 — 두 곳에 적힌 것이 어긋난 것이 D18의 결함이었다(8.0절).

### 8.5 배분안 비교 안내 코드 (`comparison_note_codes`)

| 코드 | 언제 |
|---|---|
| `plans_collapsed_single` | 배분 벡터가 같아 배분안이 하나로 합쳐짐 |
| `all_accounts_have_early_exit_penalty` | `fund_use_horizon`이 `within_isa_lock_in` **이고 반환된 배분안이 하나도 빠짐없이 `warnings`를 갖고 있을 때**. 뜻은 "어느 배분안도 중도 불이익을 피하지 못한다"이고, 화면은 배분 비교보다 이 사실을 앞세워야 한다. **경고를 지지 않는 안이 하나라도 있으면 나가지 않는다** — 피할 수 있는 선택지가 있는데 없다고 말하지 않기 위해서다(0.3절) |
| `baseline_reordered_by_fund_use_horizon` | 기본안이 `max_tax_credit`이 아닌 다른 안으로 바뀜 |
| `alternatives_have_equal_tax_credit` | 둘 이상의 안이 같은 세액공제액을 냄(`delta_vs_baseline_krw`가 0) |
| `tax_credit_axis_not_discriminating` | 세액 한도가 **0으로 확정**되어 어떤 배분을 해도 세액공제액이 0이다. 뜻은 "세액공제액으로는 배분안이 갈리지 않는다"이고, `alternatives_have_equal_tax_credit`과 달리 **그 동률이 앞으로 어떤 배분에서도 깨지지 않는다**는 사실까지 말한다. 화면은 금액 열 위에 그 사실을 한 줄로 두고 계좌 구성의 차이로 비교를 이어 간다. 5.12절 |

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
| `birth_date` | string | `YYYY-MM-DD` | 필수 | 생년월일. 만 나이 환산은 `compute`와 **같은 내부 함수**가 한다. 달력에 없는 날짜면 `invalid_date` 오류 |
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
- `plans`의 길이는 **1 이상 4 이하**다. 4를 전제로 레이아웃을 짜되 1일 때를 처리해야 한다.
- **`pension_contribution_limit_fill`을 "추천"으로 보이지 않게 한다.** 세법이 이 안의 유불리를 정하지 않으므로 엔진이 그것을 고르면 그것이 곧 자문이다(D26). 이 안은 언제나 `is_baseline: false`이고, 화면도 순서를 올리거나 강조로 그 판단을 대신하지 않는다.
- **이 안을 보일 때 `non_quantified_effects`의 `facts` 세 사실을 함께 낸다.** 특히 `principal_tax_free_requires_confirmation`을 빼고 "나중에 비과세로 돌아옵니다"라고 쓰면 그 문장은 거짓이다(5.6절).
- **미배분을 "갈 곳이 없다"로 쓰지 않는다.** `unallocated_breakdown.no_headroom_krw`에 대해서만 그 말이 참이다(5.13절).
- **`unallocated_breakdown`의 두 여력을 더하지 않는다.** `headrooms_overlap`이 `true`면 같은 돈을 두 번 세는 것이다.
- **`credit_rate_bracket.fallback_applied`가 `true`면 금액에 "적어도"를 붙인다.** 세액 한도의 "최대 이만큼"과 **방향이 반대**이므로 두 표기를 같은 문장 틀로 쓰면 한쪽이 거짓이 된다(4.2절).
- **`isa_type_cross_check_inconclusive`를 "선언이 틀렸다"로 읽지 않는다.** 결론을 내지 못했다는 사실 통지이고, `isa_type_conflicts_with_prior_income`과 문구의 세기가 달라야 한다(8.2절).
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
- **`pension_credit_*_krw`는 한도 적용 후 값이다.** 자르기 전 값이 필요하면 `*_before_cap_krw`를 읽는다. **두 값의 뺄셈을 화면이 하지 않는다** — `tax_liability_cap.reduced_*_krw`에 이미 있다.
- **`pension_credit_tax_liability_cap.known`이 `false`면 금액에 "최대"를 붙인다.** 그 결과는 상한이고, 근거는 `error_direction_code`다. 이 표시는 금액과 **같은 화면**에 있어야 한다.
- **`cap_krw: 0`과 `cap_krw: null`을 같게 다루지 않는다.** 앞은 "낼 세금이 없다"는 확정 사실이고 뒤는 "얼마인지 모른다"는 사실이다.
- **한도가 0일 때 `priority_basis.objective_degenerate`를 읽는다.** 배분안이 여전히 셋이지만 세액공제액으로는 갈리지 않는다. 순위를 절세액 순으로 설명하면 없는 근거를 말하게 된다(5.12절).
- **`contribution_carryover_available`이 `true`면 "넣은 돈이 사라진다"고 쓰지 않는다.** 소멸하는 것은 그해의 세액공제액이고 납입액은 **신청을 통해** 이후 과세기간으로 넘길 수 있다.
- **생년월일을 보낸다. 만 나이를 계산하지 않는다**(D21). 엔진이 쓴 나이와 기준일은 `echo.derived_age`에 있고, **그 값을 사용자에게 되비추지 않는다.**
- **`annuity_start_status`의 기본값을 `"not_started"`로 두지 않는다.** 사용자가 답하지 않았으면 `"unknown"`을 보낸다 — 접는 방향의 오류가 과대다.
- **퇴직급여 입금액을 `ytd_contribution_krw`에 합치지 않는다.** `retirement_transfer_in_krw`로 분리해 보낸다. 합치면 세액공제액이 과대 계산된다.
