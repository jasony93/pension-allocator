---
unit: tax-domain
stage: 4
status: draft
inputs:
  - data/tax-rules/2026.json
  - data/tax-rules/2027-proposed.json
  - docs/stage-2-design/engine-interface.md
  - docs/org/gate-decisions.md
  - docs/org/charter.md
open_questions:
  - "**[13차·대조가 어긋난 채로 남는 1건 — 관리자 판정이 필요하다]** `GC-61`이 `isa.tax_free_limit`의 미확인 표시를 **3건**으로 주장하고 엔진은 **1건**을 낸다. 룰셋의 `value.unverified`는 12차에 계약 5.7.1절의 지시대로 **3원소 배열**로 열렸는데, 엔진이 배열을 펼치지 않고 **키 하나를 표시 하나로** 센다. 이 유닛은 **엔진 쪽이 틀렸다고 보지만 단정하지 않는다** — 두 읽기와 각각의 근거·귀결은 12.6절에 표로 적었다. **(나)로 판정되면 12차의 배열 전환이 아무것도 바꾸지 않은 것이 되고, 계약 5.7.1절이 「구멍을 닫는 방법」으로 적은 문단을 함께 고쳐야 한다.** 이 케이스를 1로 낮춰 적으면 초록색이 되지만 그 순간 정답지가 엔진의 동작을 정답으로 옮겨 적은 것이 되므로 그러지 않았다. **이번이 첫 대조이므로 3회 반복 불일치 규칙에는 아직 걸리지 않는다.**"
  - "**[13차·RF-7을 어떻게 했는지와 남는 물음]** 「의무가입기간 전 해지 → 혜택 0」은 **세법의 답으로 유효하나 지금의 입력으로는 실행되지 않는다.** 해지는 사실이 아니라 미래의 선택이고 요청에 그 입력이 없다. 두 길(입력을 새로 받는다 / 가정 아래에서만 성립하는 케이스로 다시 적는다)을 저울에 올려 **뒤를 골랐고**(12.3절), 그래서 `GC-58`은 금액이 0이 아니라 374,000원이며 대신 **그 금액과 `early_termination_clawback_isa` 경고가 같은 안에 함께 실리는지**를 주장한다. **해지 여부를 입력으로 받을지는 관리자·`product-planner` 판정이다** — D13(입력 수가 완료율을 갉아먹는다)과 저울에 올려야 하고, 무엇보다 사용자가 「해지하겠는가」를 미리 답할 수 있는 물음인지가 먼저다."
  - "**[13차·표시 대장에 아직 자리가 없는 규칙 2건]** 미확인 표시를 가진 룰셋 규칙 15건 중 **13건**을 정답지가 주장한다. 남은 둘은 **엔진이 어느 골든 케이스에서도 읽지 않아 주장할 자리가 없다** — `pension.credit.per_account_attribution`(계좌별 세액공제액 표시에 관한 규칙이고 엔진은 계좌별 공제액을 내지 않는다. GC-32a·GC-51에 넣어 보았으나 둘 다 `present: false`였다)과 `proposed.productive_isa.pension_transfer.additional_contribution`(개정안 시나리오에 ISA 만기 전환이 함께 있는 케이스가 없다). **뒤의 것은 케이스를 하나 만들면 닫히지만 기대값 산출이 새로 필요하고, 이 회차는 「기대값을 다시 산출하지 않는다」는 지시 아래 있었다.** 다음 회차의 몫으로 남긴다."
  - "**[13차·거짓 양성 표시 1건]** `pension.credit.tax_liability_cap.source_form`의 유일한 표시는 `unknown_value_policy.direction_of_error`의 본문에 「한도 **미확인** 상태의 숫자는…」이라는 구절이 있어 `text_marker`로 세어진 것이다. **그 문장은 무언가를 확인하지 못했다는 표시가 아니라 「사용자가 한도를 모를 때 어떻게 하는가」라는 정책 서술이다.** 낱말을 바꾸면 이 규칙의 표시가 0이 되고, 실행기가 「목록의 규칙이 표시를 하나도 갖지 않게 됐다」며 사람 확인을 요구한다 — 그 요구가 정확히 옳은 동작이므로 **이 유닛이 조용히 지우지 않고 여기 올린다.** GC-40이 지금은 이 규칙의 건수를 1로 고정하고 있으므로, 문구를 고치는 회차에 그 주장도 함께 0으로 내려야 한다."
  - "~~**[12차·실행기 어휘 두 건]** (1) `credit_rate.basis`·`credit_rate.fallback_applied`·`credit_rate.effective`·`credit_rate.local_tax`가 `UNUSED_VOCABULARY`에 올라 있어 **쓰면 실패한다.** 그래서 GC-40~46이 `credit_rate.income_tax` 하나만 적었고, **엔진이 그 공제율을 어느 축으로 잰 것인지는 블록이 가리지 못한다**(11.4절 (나)). (2) **규칙별 미확인 건수를 실을 자리가 어느 층에도 없다** — 블록 최상위 허용 키는 `case`·`request`·`credit_rate`·`expect` 넷뿐이고 시나리오 단위에도 `legal_basis` 계열이 없다. 계약 5.7.1절이 이 축을 **첫 번째 방어선**으로 지목했는데 그 방어선이 비어 있다. 필요한 것은 시나리오 단위 키 하나(`uncertainty_note_counts: { 규칙id: 건수 }`)이고, **룰셋 쪽 준비는 이 회차에 끝냈다**(11.5절). `calc-engine-dev`의 몫이다.~~ **[13차에 해소]** 계약 `5.1.0`이 `credit_rate`의 네 키를 풀고 시나리오 단위에 `legal_basis`를 열었다. GC-40~46이 공제율 축 넷을 전부 적었고, 일곱 개 케이스가 규칙 13건의 표시 건수를 주장한다. **다만 그중 한 건(`isa.tax_free_limit`)은 대조가 어긋난 채로 남는다** — 맨 위 항목 참조."
  - "**[12차·정답지가 틀린 것 1건]** GC-51 개정안 `annuity_savings_first`의 IRP 배분을 **잔여 공제한도 3,000,000으로 잡아** 세액을 1,287,000으로 적었고, 대조에서 어긋나 재산출한 결과 **정답지가 틀렸다**(정답 9,000,000 / 1,485,000). 잔여 공제한도를 배분 상한으로 쓰는 것은 4단계 M1이 이미 잡은 결함(`engine-design.md` 6.4절)이고 계약 5.3절이 이름까지 붙여 경고한 자리인데, `max_tax_credit`에만 적용하고 이 안에는 적용하지 않았다. **엔진이 옳았다.** 같은 형태의 누락이 다른 회차에도 있는지는 관리자·`qa`가 볼 사안이다."
  - "**[12차·GC-43~46의 `prior_year_tax`]** 넷 다 `unknown`으로 두었다. S15의 결정세액 밴드가 **근로소득만 있는 사람의 것**이라(9절 5번) 근로소득 외의 합산소득이 있는 이 넷에는 성립하지 않기 때문이다. 그 결과 **이 넷은 세액 한도를 검사하지 않는다** — 공제율 축만 본다. 근로소득 외의 소득이 있는 사용자의 결정세액 밴드를 세우는 것은 별개 작업이고, 서비스 대상 가정(A6)이 근로소득자로 좁혀져 있는 한 우선순위가 낮다고 본다. 관리자 판정 사안이다."
  - "~~**[7차·실행할 수 없는 정답 9건]** D28로 확정한 ISA 혜택 산식의 정답 9건(10절)에 **`golden` 블록을 달지 못했다.** 엔진이 `profile.isa_return_assumption`을 받지 않고 `Plan.assumption_based_isa_estimate`를 내지 않아 대조할 필드가 없다. 계약이 그 둘을 들이는 회차에 `GC-` 번호로 옮기고 블록을 단다. **그때 기대값을 다시 산출하지 않는다 — 여기 적힌 값이 먼저다.**~~ **[13차에 해소]** 계약 `5.1.0`이 두 필드를 들였고 아홉 건이 `GC-52`~`GC-60`이 됐다(12절). **기대값을 다시 산출하지 않았다** — 10.2절의 값을 그대로 옮겼고, 형태가 달라진 둘(RF-6·RF-7)은 각각 12.2·12.3절에 근거를 적었다."
  - "~~**[7차·실행기 어휘]** 블록이 **구간**을 대조할 수 있어야 한다. `income_character`가 `mixed_or_unknown`·`listed_equity_capital_gain`이면 정답이 점이 아니라 구간이므로(RF-8), 허용 키에 `lower_bound_krw`·`upper_bound_krw`·`point_estimate_krw`(null 허용)·`settlement_years`·`is_annual`이 필요하다. **점만 적을 수 있는 어휘로는 이 회차의 결론이 검사받지 못한다** — 1-A.1절이 기록한 것과 같은 형태의 공백이다.~~ **[13차에 해소]** 허용 키에 `lower_bound_krw`·`upper_bound_krw`·`point_estimate_krw`·`settlement_years`·`is_annual`이 전부 열렸고, GC-57·GC-59가 구간으로 대조된다."
  - "**[7차·단수 처리 미확인]** 세액 계산의 원 미만·10원 미만 절사 규칙을 확인하지 못해 **절사가 걸리는 경계 케이스를 일부러 만들지 않았다**(10.3절). 비과세 한도를 1원 넘기는 케이스가 그 자리다 — 규칙을 확인한 뒤에 만든다. 없는 근거로 경계값을 만들지 않았다."
  - "**[6차·실행기]** **이번 회차에 움직인 축 넷을 블록에 적을 수 없었다**(1-A.1절). 실행기의 허용 키에 자르기 전 금액(`*_before_cap_krw`)·임계값(`threshold_income_tax_krw`)·`objective_degenerate`·`pension_withdrawal_start`의 날짜 항목이 없다. 산출은 끝나 있고 적을 자리가 없었을 뿐이므로, `calc-engine-dev`가 키를 늘리면 같은 회차 안에 채울 수 있다. **적지 못한 축은 이번 전건 통과가 보증하지 않는다** — 그 사실을 통과 기록 옆에 함께 적었다(7.6절)."
  - "**[6차·만 나이]** D21이 맡긴 기준일 규칙을 만들었다(`age.reckoning.reference_date`, 8절 (가)). **결론은 단일 기준일이 존재하지 않는다는 것이다** — 나이를 세는 방법(민법 §158)과 n년 뒤 날짜(민법 §160 ③)는 정해져 있으나 판정 시점은 요건마다 다르다. `pension.withdrawal.earliest_start`는 날짜로 환원되어 기준일이 필요 없고, `isa.eligibility`의 연령 요건은 **가입 시점**에 성립해야 한다. 엔진이 쓰는 과세기간 종료일은 ISA 쪽에서 **과대** 방향의 오차를 남긴다(그 해에 19세가 되는 사람). 계산 시점 입력을 넣을지, ISA 신규 가입 경로만 보류할지, 가정으로 드러낼지는 관리자 판정이다. 아울러 엔진의 가정 코드 `age_reference_date_not_in_ruleset`과 계약의 `reference_date_from_ruleset` 서술이 이제 사실과 다르다."
  - "**[6차·퇴직급여]** 퇴직급여 입금액이 연간 납입한도 1,800만원을 쓰는지에 **답을 내지 못했다**(8절 (다)). 시행령 §40의2 ② 1호 가목의 '납입한 금액'에 이연퇴직소득의 이체가 들어가는지를 1차 출처로 확인하지 못했다. 엔진의 선택(쓰는 쪽)은 오차 방향이 과소라 안전하므로 판정 전까지 유지를 권한다. **두 읽기가 갈리는 골든 케이스는 일부러 만들지 않았다** — 근거 없이 한쪽을 정답으로 적으면 다음 검증자가 그것을 세법 결론으로 오독한다."
  - "**[6차·지방세]** 개인지방소득세에 같은 세액 한도 구조가 있는지 **확인하지 못했다**(8절 (라)). 룰셋의 `tax.local.personal_income_surtax`는 원천징수 단계의 특별징수 규정이라 연말정산 후 확정되는 세액공제 구조를 말하지 않는다. 엔진의 선택(인정된 소득세분에 부가율 적용)은 절세액이 작게 나오는 방향이라 유지를 권하나, **방향에 근거한 선택이지 조문에 근거한 결론이 아니다.** `local_tax_follows_income_tax_cap` 가정이 결과 화면 고지 요소 4에 실려야 한다."
  - "**[6차·결정세액]** 각 케이스의 `prior_year_tax`는 **케이스의 정의이지 세법에서 산출된 값이 아니다**(2절 CD1). 총급여에서 결정세액을 산출하는 규칙(근로소득공제·기본세율·근로소득세액공제)이 룰셋에 없고 넣지 않기로 한 범위 밖이기 때문이다. 대신 성립 가능한 **밴드**를 내고 그 안에서 골랐으며 밴드의 하한은 4대보험 요율을 쓰므로 근사다. **밴드는 근로소득만 있는 사람의 것이고**, 근로소득 외의 소득이 있는 사용자(GC-09)에게는 성립하지 않아 `unknown`으로 두었다. 서비스 대상 가정(A6)이 바뀌면 이 절차를 다시 세워야 한다."
  - "~~**[6차·세액 한도]** 이 문서의 36건은 전부 **세액공제의 세액 한도가 충분하다는 암묵적 전제** 위에 서 있다. 프로필에 결정세액·산출세액이 없어 한도를 판정할 수 없었고, 그래서 기대 세액공제액을 `납입 인정액 × 공제율`로만 산출했다. 이번 6차 조사로 그 전제가 **조문상 성립하지 않을 수 있음**이 확인됐다 — 소득세법 제61조 제3항은 감면·공제 합계가 산출세액을 넘으면 **연금계좌세액공제를 가장 먼저 밀어낸다**(`pension.credit.tax_liability_cap`). 지금 36건이 깨지지 않은 것은 엔진이 아직 이 규칙을 읽지 않기 때문이지 기대값이 맞아서가 아니다. **엔진이 이 규칙을 구현하는 순간 세액공제액이 0이 아닌 모든 케이스의 기대값을 재산출해야 하고, 한도가 0인 경계 케이스와 한도가 절단선을 지나는 경계 케이스를 새로 추가해야 한다.** 근거는 `docs/stage-1-discovery/tax-rules-report.md` 13절.~~ **[6차에 해소]** 엔진이 계약 `4.0.0`으로 이 규칙을 구현했고, 이 회차에 36건 전부의 기대값을 세법에서 다시 산출하고 한도 경계 케이스 11건을 추가했다(7절). **기대값을 구현에 맞추지 않았다** — 산출을 먼저 적고 나서 돌렸다."
  - "**[5차]** 블록의 `request`에는 산문의 프로필이 적지 않은 필드가 있다(`fund_use_horizon` 등). 기대값이 아니라 케이스의 정의이므로 이 유닛이 골랐고 기준과 내역을 6.4절 (가)에 남겼으나, **케이스 정의를 사후에 채운 것은 사실이다.** 특히 horizon을 `at_or_after_pension_age`로 고정한 결과 그 케이스들의 `warning_count: 0`은 세법 산출이 아니라 입력 선택의 귀결이다. 다른 값으로 두는 편이 나은 케이스가 있는지는 관리자·`qa`가 볼 사안이다."
  - "**[5차]** GC-28의 `isa_lock_in_already_elapsed`를 블록에 적지 못했다. 계약 8.2절(조건을 `within_isa_lock_in`으로 한정)과 8.4절(잔여 기간 조건으로 경고가 꺼진 경우 이 코드가 대신 나간다 — `unknown`에도 걸린다)이 서로 다른 답을 함의하기 때문이다. 산출 근거가 갈리므로 `notice_codes`·`notice_codes_absent` 어느 쪽에도 넣지 않았다. 계약이 어느 쪽으로 통일되는지에 따라 이 케이스의 블록을 보강해야 한다. **[6차에 해소]** D18이 조건을 8.2절 한 곳으로 모으고 `unknown`에서는 나가지 않는 것으로 통일했으므로, GC-28의 블록에 `notice_codes_absent: [\"isa_lock_in_already_elapsed\"]`를 적었다."
  - "**[4차]** 연금 두 계좌 사이의 충당 순서는 **세법이 정하지 않는다.** 두 계좌의 과세가 완전히 같기 때문이다(`pension.withdrawal.midterm_restriction.value.tax_treatment_is_identical`). 이번 개정에서 기대 배분을 확정할 수 있었던 근거는 세법이 아니라 계약 0.4절의 제품 결정이고, 룰셋에서 읽은 것은 `partial_withdrawal_without_statutory_cause`라는 **사실 하나**뿐이다. 규칙의 `product_note`도 '어느 계좌를 먼저 채울지는 이 규칙이 정하지 않는다'고 못박는다. 따라서 이 문서의 분할 기대값은 **세법 정답이 아니라 제품 결정의 검산**이며, 제품 결정이 바뀌면 세법 재조사 없이도 바뀐다. 이 구분이 흐려지면 다음 검증자가 분할을 세법 결론으로 오독한다."
  - "**[4차]** `calc-engine-dev`의 자기확인은 14개 항목(GC-04·09·10·11·12·13·18a~d·22)이 움직인다고 했으나, 세법·룰셋·계약 0.4절에서 독립 산출한 결과는 **21건**이 움직인다(6절). 누락된 10건은 GC-01·02·03·05·06·14·21·27·28·29이고, 엔진 실행 결과도 그 10건 전부에서 종전 기록과 다르다. 자기확인이 무엇을 세었는지는 확인하지 않았다(테스트 파일을 열지 않았다). 영향 범위 산정의 근거를 관리자가 `calc-engine-dev`에게 확인시킬 사안이다."
  - "**[4차]** 이번 순서 변경으로 배분안이 하나로 합쳐지는 케이스가 6건 늘었다(GC-04·09·11·13·14·29). 동점 구간에서 `max_tax_credit`이 `annuity_savings_first`와 같아지기 때문이며 계약 6.2절이 예정한 결과다. 다만 **사용자가 보는 비교 선택지가 줄어드는 방향**이고 `growth`의 `has_alternatives` 계측(헌장 「계측 허용 판정」)의 분포도 함께 움직인다. 세법 사안이 아니므로 불일치로 세지 않았고 `designer`·`web-dev`·`growth`에게 넘긴다."
  - "GC-19c·GC-23의 기대값은 게이트 3 판정 D17(합산한도 절단 시 IRP 우선 인정)을 전제로 산출했다. 조문이 정하지 않는 사안이고 반대 해석이 성립한다(tax-rules-report.md 6.5절). 청년 IRP 우대가 국회를 통과하면 이 케이스들의 정답이 바뀔 수 있으므로 그때 전건 재산출이 필요하다."
  - "GC-21은 ISA 의무가입기간이 이미 경과한(isa_lock_in_years_remaining = 0) 사용자에게도 중도해지 추징 경고가 나가는지를 본다. 조특법 §91조의18⑦은 '3년이 되는 날 전' 해지에만 걸리므로 경과 후에는 추징 요건이 성립하지 않는다. 다만 engine-interface.md 8.4절이 경고 조건을 '배분액>0 이고 horizon이 within_isa_lock_in'으로만 정하고 있어, 고칠 곳이 엔진인지 계약인지는 관리자 판정이다."
  - "연금계좌 가입 경과연수 입력이 없어 pension.withdrawal.eligibility의 5년 보유요건을 골든 케이스에서도 판정하지 못했다. GC-21처럼 55세 이상인 사용자에게 연금 중도인출 경고가 나가는 것이 옳은지는 이 입력이 생겨야 판정된다. 게이트 1 D3이 인출 단계를 v2로 미뤘으므로 이번 범위에서는 미해결로 둔다."
  - "~~연금저축·IRP 사이의 배분 '분할'은 세법이 정하지 않으므로 기대값을 분할이 아니라 공제액·한도로 고정했다.~~ **[4차에 해소]** 관리자가 계약 0.4절로 제품 결정을 내렸고(동점이면 인출이 자유로운 계좌 우선), 그 결정이 룰셋의 확인된 사실 하나에 걸려 있으므로 이제 분할까지 기대값으로 고정했다. **다만 그것이 세법 결론이 된 것은 아니다** — 위 [4차] 첫 항목 참조."
---

# 4단계 검증 — 골든 케이스

- 산출일: 2026-08-09
- 개정일: 2026-08-09 (2차) — `calc-engine-dev`의 M1·M2 수정(커밋 `1a33f7e`) 재검증에 맞춰 **GC-24~28 5건을 추가**했다. 이번 수정이 "두 공제율이 갈릴 때만 치환한다"는 **조건부 동작**을 만들었으므로 그 조건의 양쪽과 경계를 덮는 케이스가 필요했다. 기존 29건의 기대값은 한 건도 바꾸지 않았다.
- 개정일: 2026-08-09 (3차) — M3 수정(커밋 `0ef9b52`) 재검증에 맞춰 **GC-29 1건을 추가**했다. M3 수정이 비교 안내의 조건을 **입력값이 아니라 결과의 사실**에 걸었으므로, 그 차이가 실제로 드러나는 케이스가 필요했다. 기존 34건의 기대값은 한 건도 바꾸지 않았다.
- **개정일: 2026-08-09 (4차) — 계약 `3.3.0`(0.4절)이 세제상 동점 구간의 충당 순서를 `[IRP → 연금저축 → ISA]`에서 `[연금저축 → IRP → ISA]`로 바꿨다. 기대 배분을 전건 재산출했고 21건이 움직였다(6절). 세액공제액은 36건 어디에서도 움직이지 않았다. GC-30 1건을 추가했다.**
- **개정일: 2026-08-09 (5차) — 기대값을 문서에서 기계가 읽는 블록(1-A절)으로 옮겼다. 블록이 없던 나머지 29건에 블록을 채워 **36건 전부가 실행된다.** 기대값은 한 건도 바꾸지 않았다 — 위 표에 이미 있던 값을 옮겨 적은 것이다. 표가 다루지 않아 새로 산출한 항목은 6.4절에 따로 적었다.**
- **개정일: 2026-08-10 (6차) — 계약 `4.0.0`이 세액 한도·연금수령 개시·개시 가능 시점·퇴직급여 입금을 요청과 응답에 들였다. 5차까지의 36건이 서 있던 「세액 한도가 충분하다」는 암묵적 전제를 걷어내고 **36건 전부의 기대값을 세법에서 다시 산출했다.** 케이스마다 `profile.prior_year_tax`를 정하고 그 근거를 적었으며(2절 CD1~CD4·S14·S15), 세액 한도만 보는 경계 케이스 **11건(GC-31 · 32a~c · 33 · 34 · 35 · 36 · 37 · 38 · 39)을 추가**했다. 움직인 기대값은 4건이다(7절).**
- 산출 유닛: `tax-domain`
- **개정일: 2026-08-10 (7차) — 관리자 판정 D28이 수익률을 입력으로 들였다. ISA 혜택 산식(`isa.benefit.formula`)의 정답 **9건(경계값 7건)** 을 10절에 새로 산출했다. 기존 47건의 기대값은 한 건도 바꾸지 않았다.**
- **개정일: 2026-08-10 (12차) — 계약 `5.0.0`(D26·D27)이 움직인 두 축의 정답 **12건(경계값 10건)** 을 11절에 새로 산출했다. 공제율 판정 축 7건(GC-40 ~ GC-46)과 새 배분안 `pension_contribution_limit_fill` 5건(GC-47 ~ GC-51)이다. 기존 47건의 기대값은 한 건도 바꾸지 않았다. 아울러 `isa.tax_free_limit`의 미확인 표시를 항목 배열로 열었다(11.5절).**
- **개정일: 2026-08-10 (13차) — 계약 `5.1.0`이 세 층을 열었다.** (1) 7차의 아홉 건(`RF-1`~`RF-9`)에 **`GC-52`~`GC-60`으로 번호와 블록을 달았다**(12절). 기대값은 다시 산출하지 않고 옮겨 적었으며, 그중 둘만 형태가 달라졌다 — `RF-6`의 「혜택 0」을 구간의 **아래 끝**으로 고쳐 적었고(12.2절), `RF-7`은 엔진이 낼 수 없는 형태라 **가정 아래에서만 성립하는 케이스로 다시 적었다**(12.3절). (2) **규칙별 미확인 건수 축을 처음으로 주장했다** — 표시를 가진 규칙 **15건 중 13건**을 일곱 개 케이스가 근거 목록에서 건수·종류·자리까지 고정한다(그중 1건은 어긋난 채로 남는다). (3) **공제율 판정 축 넷**(`basis`·`measured_amount`·`fallback_applied`·`fallback_direction`)을 GC-40~46에 적었다. 기존 59건의 기대 금액은 **한 건도 바꾸지 않았다.**
- 케이스 수: **69건** (그중 경계값 케이스 **57건**) · 기계가 읽는 블록 **69건 전부**
- **아직 실행할 수 없는 케이스: 0건.** 7차가 남긴 아홉 건이 12절에서 전부 실행에 올랐다.
- **대조에서 어긋난 채로 넘기는 케이스: 1건** — `GC-61`(12.6절). `isa.tax_free_limit`의 미확인 표시가 3건인지 1건인지에서 정답지와 엔진이 갈린다. **초록색으로 만들지 않은 것이 의도다** — 근거와 양쪽 읽기는 12.6절에 있고 판정은 관리자가 한다.
- 계약 버전: `schema_version` **5.1.0** (M2로 3.0.0 → 3.1.0, M3으로 3.1.0 → 3.2.0, 동점 순서로 3.2.0 → 3.3.0, D18 정정으로 3.3.1, 세액 한도·개시·퇴직급여로 3.3.1 → 4.0.0 major, 공제율 판정 축·새 배분안으로 4.0.0 → 5.0.0 major, **수익률 입력으로 5.0.0 → 5.1.0 minor**)
- 대조 결과: `docs/stage-4-verification/verification-report.md`

## 1. 이 문서의 지위

여기 적힌 기대값은 **엔진 코드를 보지 않고 세법 조문과 룰셋에서 직접 산출한 값**이다. 헌장과 유닛 정의가 요구하는 독립성 조건이며, 1~4차 어느 회차에서도 `src/engine/`과 `src/web/`은 한 줄도 읽지 않았다. 읽은 것은 `data/tax-rules/*.json`, `docs/stage-2-design/engine-interface.md`(입출력 형식과 계약 0.4절의 제품 결정 확인 목적), `docs/org/gate-decisions.md`, `docs/org/charter.md`뿐이다. `engine-design.md`(알고리즘)도, 엔진 유닛의 테스트 파일도 읽지 않았다.

**4차에서 한 가지가 달라졌다.** 이번 회차의 기대값 중 **연금 두 계좌 사이의 분할**만은 세법에서 나오지 않는다 — 세법에 그 답이 없기 때문이다(2절 S13). 그 부분의 출처는 계약 0.4절의 제품 결정과 룰셋의 사실 하나이며, 이 문서는 그 결정을 **세법과 충돌하지 않는지**(공제 총액 불변, 경고 성립 요건)의 관점에서 검산한다. 나머지 기대값의 출처는 종전과 같다.

엔진 결과가 아래 값과 다르면 **엔진이 틀렸거나 이 문서가 틀렸다.** 어느 쪽인지는 대조 리포트에서 근거를 붙여 가린다.

## 1-A. 기계가 읽는 블록 — 정보 문자열이 `golden`인 코드 블록

케이스마다 이 블록을 **하나씩** 둔다. `src/engine/golden-cases.test.mjs`가 이 문서를 읽어 블록마다 `compute()`를 돌리고 대조하므로, **블록이 없는 케이스는 실행되지 않는다.** 커버리지 검사가 그런 케이스를 전부 이름으로 나열하며 실패하고, 블록이 있는데 형식이 어긋나도 조용히 건너뛰지 않고 실패한다.

산문은 종전대로 산출 근거를 적는 자리이고, 블록은 그 결론만 기계가 읽을 수 있게 옮긴 것이다. **기대값의 저자는 이 문서다** — 엔진을 돌려 나온 값을 블록에 적으면 이 장치가 무의미해진다.

**뼈대.** 아래 항목만 필수다. `request`는 `engine-interface.md`의 요청 객체 그대로이고, `schema_version`과 `tax_year`는 생략하면 실행기가 채운다(각각 계약 버전과 2026).

```json
{
  "case": "GC-NN",
  "request": { "scenarios": ["current"], "profile": {}, "accounts": {}, "isa_transfer": null },
  "expect": {
    "current": {
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 0, "isa": 0 },
          "tax_credit": { "income_tax": 0, "local_tax": 0, "total": 0 },
          "warning_count": 0
        }
      }
    }
  }
}
```

`expect`의 키는 시나리오 id(`current` / `proposed`)이고, 요청한 시나리오만 적는다. `plans`의 키는 배분안 id(`max_tax_credit` / `annuity_savings_first` / `isa_first`)이고, **값을 아는 배분안만** 적으면 된다.

**시나리오 단위로 더 적을 수 있는 것** — `plan_count`(배분안 수) · `baseline_plan`(기본안) · `isa_eligible` · `isa_reason_codes` · `limits` · `boundaries` · `pension_withdrawal_start` · `notice_codes` / `notice_codes_absent` · `comparison_note_codes` / `comparison_note_codes_absent` · **`legal_basis`**. 코드 목록은 **포함 / 불포함** 검사이므로 전부 열거할 필요가 없다.

**배분안 단위로 더 적을 수 있는 것** — `warning_codes`(그 안에 붙은 경고 코드의 **전체 집합**) · `limited_by` · `fill_order` · `monthly_krw` · `unallocated_krw` · `unallocated_breakdown` · `credit_remaining_after_plan_krw` · `non_quantified_codes` · `monthly_rounding_residual_krw` · `delta_vs_baseline_krw` · `credit_eligible_krw` · `tie_break` · `tax_credit_before_cap` · `tax_liability_cap` · `objective_degenerate` · `is_baseline` · **`assumption_based_isa_estimate`**. 계좌별 항목(`limited_by` · `fill_order` · `monthly_krw`)은 적은 계좌만 검사한다.

**`legal_basis`에 쓸 수 있는 키 (13차에 열렸다)** — 규칙 id를 키로 두고 그 아래에 `present` · `status` · `bill_stage` · `has_uncertainty_note` · `uncertainty_note_count` · `uncertainty_kinds` · `uncertainty_paths` · `applied_to`. **`uncertainty_paths`의 경로는 규칙의 `value`를 뿌리로 하며 `value.` 접두를 붙이지 않는다**(계약 5.7.1절). `uncertainty_kinds`는 종류의 집합이고 사전순이다. `present: false`로 **읽지 않았다는 주장**도 할 수 있다 — 다만 그것은 세법 사실이 아니라 엔진 동작에 대한 주장이므로, 이 문서는 **같은 블록이 이미 그 규칙에서 나온 숫자를 주장하고 있을 때에만** `present: true`를 적는다.

**`assumption_based_isa_estimate`에 쓸 수 있는 키 (13차에 열렸다)** — `state` · `not_computable_reason_code` · `is_annual` · `settlement_years` · `settlement_years_source` · `taxable_share_min` · `taxable_share_max` · `principal_krw` · `total_return_krw` · `taxable_income_krw` · `loss_offset_applied_krw` · `net_income_krw` · `tax_free_limit_krw` · `comparison_side_tax_krw` · `isa_side_tax_krw` · `point_estimate_krw` · `lower_bound_krw` · `upper_bound_krw` · `axis_breakdown` · `comparison_baseline_code`. **점을 낼 수 없는 케이스에서는 `point_estimate_krw`가 `null`이고 두 끝만 적는다**(12.2절).

**`credit_rate`에 쓸 수 있는 키** — `income_tax` · `local_tax` · `effective` · `basis` · `measured_amount` · `fallback_applied` · `fallback_direction`. **13차에 `effective`를 뺀 나머지를 GC-40~46이 전부 쓴다.** `effective`만 남긴 이유는 그 값이 두 비율의 부동소수점 곱이라 **정답지가 자릿수까지 단정할 근거가 없기** 때문이다 — 근거 없는 값을 적지 않는다는 원칙이 여기에도 걸린다.

**`limits`에 쓸 수 있는 키** — `pension_combined_credit_limit_krw` · `pension_combined_credit_remaining_krw` · `pension_contribution_limit_remaining_krw` · `annuity_savings_credit_remaining_krw` · `isa_contribution_remaining_krw` · `isa_tax_free_limit_krw` · `isa_transfer_extra_credit_limit_krw`.

**`boundaries`에 쓸 수 있는 키** — `isa_lock_in_years` · `isa_lock_in_years_remaining` · `pension_min_age_years` · `pension_years_remaining` · `pension_holding_period_evaluated`.

**`tax_credit_before_cap`** — `tax_credit`과 형태가 같다(`income_tax` · `local_tax` · `total`, 셋 다 적는다). 계약 `4.0.0`에서 `tax_credit`이 **세액 한도를 적용한 뒤**의 인정액이 됐으므로, 자르기 전 금액은 이 키로 따로 적는다. 둘 다 적어야 "얼마가 잘렸는가"가 블록의 주장이 된다.

**`tax_liability_cap`에 쓸 수 있는 키** — `known` · `cap_krw` · `applied` · `threshold_income_tax_krw`. **배분안 단위다** — 같은 케이스라도 안마다 잘리는지가 다를 수 있다. `cap_krw`의 `0`은 유효한 값이고 `null`(모름)과 다르다. 아는 키만 적으면 되고, 적은 키는 전부 검사한다.

**`pension_withdrawal_start`에 쓸 수 있는 키** — 연금계좌 id(`retirement_pension` / `annuity_savings`)를 키로 두고, 그 아래에 `computable` · `earliest_start_date` · `years_until_earliest_start` · `age_requirement_date` · `holding_requirement_date` · `holding_requirement_waived` · `bound_by_holding_period` · `reason_code`. 날짜는 `YYYY-MM-DD` 또는 `null`이다. 적은 계좌·적은 항목만 검사한다.

모르는 키는 오타로 보고 실패시킨다. `tax_credit`·`tax_credit_before_cap`의 세 값은 소득세 + 지방세 = 합계가 맞는지도 함께 본다 — 옮겨 적다 어긋나는 자리이기 때문이다. 4차에 움직인 값(분할 · 배분안 수 · 경고 건수)은 위 표에 적었으면 블록에도 적는다. 그것이 이번 회차가 실제로 검사받는 부분이다.

**두 가지가 더 실패 사유다(6차 이후 추가).**

1. **빈 객체는 거절한다.** `tax_liability_cap: {}`처럼 적으면 키는 있는데 주장이 없어 "적었으니 검사됐다"로 보이면서 실제로는 아무것도 보지 않는다. 적을 것이 없으면 키째로 뺀다. `limits` · `boundaries` · `credit_rate` · `pension_withdrawal_start`에도 같이 걸린다.
2. **값끼리 어긋나면 대조 전에 거절한다.** `known: false`인데 `applied: true`이거나 `cap_krw`가 `null`이 아닌 경우, `computable: false`인데 `earliest_start_date`가 있는 경우다. 둘을 옮겨 적다 한쪽만 고친 자리를 잡는다. **13차에 이 검사가 새 어휘까지 무는 것을 결함 주입으로 확인했다** — `axis_breakdown` 세 축의 합이 `upper_bound_krw`와 어긋나거나, `fallback_applied: false`인데 `fallback_direction`이 남아 있거나, `uncertainty_note_count`가 `uncertainty_paths`의 길이와 다르면 **대조 전에 거절된다.** 옮겨 적다 한쪽만 고치는 사고가 이 축들에서도 막힌다.

**허용 키가 있는데 어느 블록도 쓰지 않으면 실행기가 그 목록을 대며 실패한다**(`golden-cases.test.mjs` 검사 4). **13차에 빚 13건을 갚았다** — `credit_rate`의 다섯(`basis`·`fallback_applied`·`fallback_direction`·`local_tax`·`measured_amount`)과 `legal_basis` 계열 여덟이다. 남아 있는 것은 `credit_rate.effective`(위의 이유로 일부러 비워 둔다)와 `boundaries.isa_lock_in_years` · `boundaries.pension_min_age_years`다.

> ⚠ **산문에 케이스 이름의 범위 표기(`~`)를 쓸 때 조심하라.** 실행기는 커버리지 검사를 위해 **블록 밖 산문의 케이스 이름까지** 읽고 범위를 펼친다. 읽을 수 있는 것은 두 형태뿐이다 — **번호끼리** 이어지는 것(`GC-NN~NN`, 접미사 없이)과 **같은 번호 안에서 접미사끼리** 이어지는 것(`GC-NNa~d`). 번호와 접미사를 섞은 표기(`GC-NN~NNd` 꼴)는 **형식 오류로 실패한다.** 4차에서 실제로 밟은 지뢰다. 섞어 가리켜야 하면 **쉼표로 나열하라.**

### 1-A.1 6차에 **적고 싶었으나 적지 못한 것** — 실행기의 어휘가 계약 `4.0.0`을 따라오지 못했다

지난 회차에 `qa`에게 넘긴 지적이 있었다 — 실행기는 **모든 케이스에 블록이 있는지**는 강제하지만 **각 블록이 얼마나 많이 주장하는지**는 검사하지 않으므로, 새로 움직이는 축이 블록에 실리지 않으면 그 축은 아무도 보지 않는다. 이번에 그 축은 넷이었다. **그중 둘은 실었고 둘은 실을 수 없었다.**

블록에 모르는 키를 넣으면 형식 검사가 허용 키 목록과 함께 실패한다. 그 목록을 확인한 결과 계약 `4.0.0`이 새로 낸 출력 중 블록이 실을 수 있는 것은 **`notices`·`comparison_note_codes`를 통한 간접 관측과 `tax_credit`(한도 적용 **후** 금액)뿐**이다.

| 6차에 움직이는 축 | 블록에 실었는가 | 어떻게 / 왜 못했나 |
|---|---|---|
| **인정 공제액** (한도 적용 후) | **실었다** | `plans.*.tax_credit`이 이제 한도 적용 후 값이다(계약 5.6절). GC-04·14·31·32a가 이 축에서 값이 갈린다 |
| **잘렸는가 / 한도가 0인가 / 모르는가** | **실었다** | `notice_codes` · `notice_codes_absent`로 `tax_liability_cap_applied` · `tax_liability_cap_zero` · `tax_liability_cap_unknown`을 **양방향으로** 적었다. 특히 `notice_codes_absent`가 "이 케이스는 잘리지 않는다"를 명시적 주장으로 만든다 — 6차 이전에는 그 사실이 아무 데도 적혀 있지 않았다 |
| **자르기 전 금액** (`*_before_cap_krw`) | **못 했다** | 배분안 단위 허용 키에 없다 |
| **임계값** (`tax_liability_cap.threshold_income_tax_krw`) | **못 했다** | 같음. 임계값은 자르기 전 소득세분과 같은 값이므로 위 항목이 생기면 함께 검사된다 |
| **`objective_degenerate`** | **못 했다** | 배분안 단위 허용 키에 없다. 대신 `comparison_note_codes`의 `tax_credit_axis_not_discriminating`으로 **시나리오 단위에서만** 같은 사실을 잡았다(GC-14·31) |
| **`pension_withdrawal_start`의 날짜·`bound_by_holding_period`** | **못 했다** | 시나리오 단위 허용 키에 없다. GC-38이 보려는 "시점을 정한 것이 나이가 아니라 5년 요건"이라는 사실은 산문에만 남았다 |
| **`tax_liability_cap.cap_krw` / `known` / `source_code`** | **못 했다** | 같음. 한도 자체는 `tax_credit`의 결과로만 간접 관측된다 |

**이 문서가 할 수 있는 것은 여기까지다.** 허용 키를 늘리는 것은 실행기(`src/engine/golden-cases.test.mjs`)의 몫이고 그 파일은 이 유닛이 열지 않는다. 필요한 키를 이름으로 적어 `open_questions`에 올렸다. **못 실은 축이 넷이라는 사실 자체를 여기 적어 두는 것이, 다음 회차에 그 축이 또 조용히 빠지는 것을 막는 유일한 장치다.**

---

## 2. 산출 규칙 — 내가 쓴 계산 절차

모든 케이스에 아래 절차를 같은 순서로 적용했다. 각 단계에 쓴 룰셋 규칙 id를 붙인다.

**S1. 연간 예산** = `monthly_capacity_krw` × `months_remaining_in_tax_year`. (룰셋 근거 없음 — 계약 3.1절)

**S2. 세액공제율 판정** — `pension.credit.rate`.
근로소득만 있는 경우 **해당** 과세기간 총급여액으로 판정한다. 55,000,000원 **이하**면 소득세 15%, 초과면 12%. 경계 포함 여부는 규칙의 `boundary_rule`이 "이하"로 정한다.
지방세분은 `tax.local.personal_income_surtax`의 `rate_of_income_tax` 0.1을 소득세 세액공제액에 곱해 얻는다. **16.5% / 13.2%를 상수로 쓰지 않는다.**

**S3. 연금계좌 납입 잔여 한도** — `pension.contribution.annual_limit`.
18,000,000 − (연금저축 ytd + 퇴직연금 ytd). 두 계좌가 같은 풀을 쓰므로 계좌별로 나누지 않는다. 0 미만이면 0.

**S4. ISA 전환 추가한도** — `pension.credit.isa_transfer.extra_limit`.
`min(전환금액 × 0.10, 3,000,000 − 직전 과세기간 적용액)`. 전환이 없으면 0.

**S5. 연금계좌 합산 세액공제 한도** — `pension.credit.limit.combined` + S4.
9,000,000 + 추가한도.

**S6. 세액공제 인정액** — `pension.credit.limit.annuity_savings`, `pension.credit.limit.combined`, **게이트 3 D17**.
1. 연금저축 납입액에 단독 한도 6,000,000을 먼저 적용한다(조문이 정한 순서 — §59조의3① 단서가 연금저축 한도를 먼저 쓴다).
2. 합산 한도(S5)를 채울 때 **퇴직연금 납입분을 먼저 인정한다**(D17). 조문이 정하지 않는 사안이며 관리자 판정이다.
   - `IRP인정 = min(IRP납입액, S5)`
   - `연금저축인정 = min(연금저축납입액, 6,000,000, S5 − IRP인정)`
3. 전환금액은 §59조의3③에 따라 목적지 계좌의 당해연도 납입액에 포함해 위 계산에 넣는다.

**S7. 세액공제액**
- 확정 시나리오: `(IRP인정 + 연금저축인정) × S2의 소득세율`
- 개정안 시나리오 + `declared_youth: true`: `IRP인정 × 0.15`(`proposed.pension.credit.youth_irp_rate`) `+ 연금저축인정 × S2의 소득세율`
- 지방세분 = 소득세분 × 0.1, 원 미만 버림.

**S8. ISA 납입 잔여 한도** — `isa.contribution.annual_limit`, `isa.account.requirements`.
`min( 20,000,000 × [1 + min(가입경과연수, 4)] − 누적납입액 , (100,000,000 − 재형저축등 계약금액) − 누적납입액 )`. 0 미만이면 0.

**S9. ISA 비과세 한도** — `isa.tax_free_limit`.
사용자 선언(`account_type`)을 따른다. 직전 과세기간 총급여 50,000,000원 **이하**면 서민형 4,000,000, 초과면 일반형 2,000,000. 선언과 소득 판정이 어긋나면 계산은 선언을 따르고 경고만 낸다(계약 8.2절).

**S10. ISA 자격** — `isa.eligibility`, `isa.exclusion.financial_income_taxpayer`.
19세 이상이거나 15세 이상 + 직전 과세기간 근로소득. 직전 3개 과세기간 중 1회 이상 금융소득종합과세 대상이면 배제.

**S11. 최대 세액공제 배분** — 목적함수는 세액공제액 최대화다.
확정 시나리오에서는 연금 두 계좌의 공제율이 같으므로 **연금계좌에 들어가는 총액**만 세법이 정하고, 두 계좌 사이의 분할은 정하지 않는다. 그 분할은 S13이 정한다. 개정안 + 청년이면 IRP 공제율이 높으므로 **세법이 분할까지 정한다** — 이것이 GC-19c·GC-23의 요지다.

**S12. 경계 연수** — `isa.account.requirements`(3년), `pension.withdrawal.eligibility`(55세).
`isa_lock_in_years_remaining = max(0, 3 − 가입경과연수)`, `pension_years_remaining = max(0, 55 − 나이)`.

**S13. 연금 두 계좌 사이의 충당 순서 (4차 추가)** — `pension.withdrawal.midterm_restriction`, 계약 0.4절.

**이 단계만 세법에서 나오지 않는다.** 그 사실을 먼저 적는다. 두 계좌의 **과세는 완전히 같다** — `pension.withdrawal.eligibility`(55세 + 5년)와 `pension.early_withdrawal.other_income_rate`(연금외수령 기타소득 15%)가 계좌 종류를 가리지 않고 걸리고, 규칙 자신이 `tax_treatment_is_identical`로 이를 명시한다. 그러므로 어느 쪽을 먼저 채우든 세액이 같고, 세법에는 순서를 정할 근거가 없다. 규칙의 `product_note`도 "어느 계좌를 먼저 채울지는 제품의 설계 결정이고 이 규칙이 정하지 않는다"고 못박는다.

룰셋에서 읽는 것은 **사실 하나**다.

| 계좌 | `partial_withdrawal_without_statutory_cause` | 뜻 |
|---|---|---|
| `annuity_savings` (연금저축계좌) | `true` | 사유 제한 없이 부분 인출이 가능하다 |
| `retirement_pension` (퇴직연금계좌) | `false` | 근퇴법 시행령 §18②의 **열거된 사유**에만 중도인출이 되고, 아니면 계좌 전체를 해지해야 한다 |

관리자가 계약 0.4절로 내린 결정이 이 사실을 순서로 옮긴다.

1. **한계 공제율이 같으면(동점)** 부분 인출이 자유로운 **연금저축을 먼저** 채운다. 상한은 연금저축 자기 한도 잔여 `max(0, 6,000,000 − 연금저축 ytd)`이고, 합산 잔여(S5 − 기납입 인정액)로도 함께 잘린다. 남은 몫이 IRP로 간다. **예산이 연금저축 한도에 못 미치면 IRP는 0이다.**
2. **한계 공제율이 갈리면(동점 아님)** 세액공제 최대화가 순서를 정한다 — 개정안 + `declared_youth: true` + 소득이 15% 경계 **위**면 IRP 우선이고 종전 경로 그대로다. **인출 편의로 세액을 깎지 않는다.**
3. 동점 판정은 `fund_use_horizon`과 무관하다. 계약 4.2절이 `allocation_amounts: false`를 스스로 선언하므로 동점 판정을 horizon에 걸면 그 선언이 거짓이 된다.

**검산 불변식 — 이 순서는 세액공제 총액을 바꾸지 않는다.** 동점의 정의상 두 계좌의 한계 공제율이 같으므로 인정액 합계도 세액도 분할과 무관하다. **어느 케이스에서든 공제 총액이 움직이면 그것은 이 변경의 오류다.** 36건 전건에서 이 불변식이 성립하는지 6.2절에서 확인했다.

**S13의 세 가지 파급.** 값이 아니라 순서만 바꿨는데도 세 곳이 함께 움직인다. 케이스별 기대값은 이 셋을 각각 따져 적었다.

- **(가) 배분안 합치기.** 동점이면 `max_tax_credit`의 충당 순서가 `annuity_savings_first`와 같아져 두 안의 배분 벡터가 일치하고 하나로 합쳐진다(계약 6.2절). ISA 잔여가 남은 예산을 다 받아내지 못하면 `isa_first`까지 같아져 **세 안이 전부 합쳐지고** `plans_collapsed_single`이 나간다.
- **(나) 인출 경고 건수.** 배분액 > 0인 연금계좌가 둘이 되므로 `early_withdrawal_penalty_pension`이 **두 건** 나간다. 과세가 같으므로 **한쪽에만 붙으면 그것이 오류다**(계약 0.4절 「지킨 선」 2).
- **(다) 월 반올림 잔차.** 계좌를 하나 더 나누면 버림이 한 번 더 일어난다. `잔차 = Σ(연간액 − floor(연간액 ÷ 개월수) × 개월수)`. 개월수가 12이고 연간액이 12의 배수인 케이스에서는 늘지 않고, GC-22(개월수 7)에서만 실제로 늘었다.

**S14. 세액 한도 (6차 추가)** — `pension.credit.tax_liability_cap`, `pension.credit.tax_liability_cap.source_form`, `tax.local.personal_income_surtax`.

**이 단계는 배분이 끝난 뒤에 붙는 상한이 아니라 공제액을 산출하는 마지막 단계다.** S7까지가 내는 것은 이제 **자르기 전** 금액이고, 인정액은 여기서 정해진다.

1. **한도를 얻는다.** `state`에 따라 갈린다.
   - `amount` → `결정세액 + 연금계좌 세액공제액`
   - `zero` → `0 + 연금계좌 세액공제액`
   - `nonzero_amount_unknown` / `unknown` → **모름**
2. **되더하기를 빠뜨리지 않는다.** 서식의 결정세액은 `산출세액 − 세액감면 계 − 세액공제 계`이고 그 안에 이미 연금계좌 세액공제가 들어 있다. 그대로 쓰면 이미 받은 공제만큼 한도가 줄어 보이는 순환이 생긴다. 되더하면 "연금계좌 세액공제가 없었다면 남았을 세액"이 되고, §61 ③이 연금계좌세액공제를 초과분의 흡수 대상으로 지목하므로 그 값이 **법정 한도와 일치한다.** 근사가 아니라 등식이다.
3. **인정 소득세분** = `min(자르기 전 소득세분, 한도)`. **한도를 모르면 자르지 않는다** — 지어낸 한도로 자르면 그 자름이 근거 없는 숫자가 된다. 그 결과는 "이만큼"이 아니라 "**최대** 이만큼"이다.
4. **초과는 "초과"다.** §61 ③이 "초과하는 경우 그 초과하는 금액"만 없는 것으로 보므로 **한도와 공제액이 같으면 아무것도 잘리지 않는다**(GC-32b).
5. **지방세분 = 인정된 소득세분 × 0.1, 원 미만 버림.** 자르기 전 소득세분에 곱하지 않는다 — 인정되지 않은 공제에 붙는 지방세를 남기지 않기 위해서다. 이 취급 자체는 룰셋이 정하지 않았다(개인지방소득세에 같은 한도 구조가 있는지 미확인). **오차의 방향은 지방세분을 작게 보는 쪽이라 과소이고, 과소한 절세액은 사용자를 잘못된 결정으로 밀지 않는다.**
6. **배분은 이 단계에서 움직이지 않는다.** 잘리는 것은 공제액이고 납입액은 시행령 §118의3의 전환 신청 대상으로 살아남는다(`pension.credit.unused.contribution_carryover`).

**S15. 각 케이스의 `prior_year_tax`를 무엇으로 정했는가 (6차 추가) — 이것이 이번 회차에서 가장 위험한 자리였다**

`prior_year_tax`는 기대값이 아니라 **케이스의 정의**다. 그러나 그 한 칸을 정하는 순간 그 케이스의 기대 공제액이 정해지므로, 아무 값이나 넣으면 36건이 전부 초록색이 되면서 한도 로직을 하나도 검사하지 못한다. **그것이 5차까지의 상태였고 이번에 닫는 것이 그 결함이다.** 그래서 고르는 규칙을 먼저 세우고 케이스마다 적용했다.

- **CD1 — 총급여에서 결정세액을 산출할 수 있는 규칙이 이 조직에 없다.** 근로소득공제(§47)·기본공제(§50)·기본세율(§55)·근로소득세액공제(§59)는 **룰셋에 없고, 넣지 않기로 한 범위 밖이다.** 그러므로 "이 소득이면 결정세액은 정확히 얼마"라고 단정하지 않는다. 단정하면 그것이 곧 지어낸 숫자다.
- **CD2 — 프로필이 스스로 함의하는 값이 있으면 그것을 따른다.** 직전 과세기간에 근로소득이 없었던 사람의 결정세액은 0이다(GC-14). 기납입액이 이미 한도를 넘긴 사람은 작년에도 납입해 공제를 받았을 것이므로 되더할 값이 0이 아니다(GC-07).
- **CD3 — 함의가 없으면 그 케이스가 검사하려는 축을 기준으로 고르되, 고른 값이 그 프로필에서 성립 가능한지를 밴드로 확인한다.** 아래 밴드 산출을 쓴다.
- **CD4 — 근거가 없으면 `unknown`으로 둔다.** 다만 `unknown`인 케이스는 한도를 검사하지 않으므로 최소한으로 쓴다. 47건 중 `unknown`은 GC-09·GC-34 둘, `nonzero_amount_unknown`은 GC-35 하나다.

**밴드 산출 — 정확한 값이 아니라 성립 가능한 구간을 낸다.** 어느 케이스에서도 이 구간의 끝값을 기대값으로 쓰지 않았고, 고른 값이 구간 안에 있는지 확인하는 데만 썼다.

| | 무엇을 뺐는가 | 왜 |
|---|---|---|
| **상한** | 근로소득공제 · 본인 기본공제 1,500,000 · 근로소득세액공제 · 표준세액공제 130,000 | 전부 소득세법 항목이다 |
| **하한** | 위에 더해 국민연금 4.5% · 건강보험 · 장기요양 · 고용보험 | 4대보험 요율은 **세법이 아니라 사회보험 법령에 있고 해마다 바뀐다.** 이 유닛이 확인하지 않았으므로 하한은 근사다 |

| 직전연도 총급여 | 하한 | 상한 |
|---|---|---|
| 20,000,000 | 95,968 | 146,750 |
| 40,000,000 | 1,449,255 | 2,013,500 |
| 45,000,000 | 2,040,224 | 2,675,000 |
| 50,000,000 | 2,682,194 | 3,387,500 |
| 52,000,000 | 2,938,981 | 3,672,500 |
| 55,000,000 | 3,324,163 | 4,100,000 |
| 60,000,000 | 3,966,133 | 4,812,500 |

**밴드는 부양가족이 없는 사람의 것이다.** 기본공제는 1인당 1,500,000원이고 이 소득대의 한계세율이 15%이므로 부양가족 한 사람마다 밴드가 **225,000원씩 아래로 평행이동한다.** 케이스가 절단선 근처의 값을 쓸 때는 그 사람에게 부양가족이 몇 명 필요한지를 함께 적었다(GC-04·32a~c·33).

**이 밴드로 확인된 사실 하나를 그대로 적는다.** 부양가족이 없는 근로자에게는 이 서비스가 다루는 소득대(40,000,000~60,000,000)에서 **한도가 거의 물지 않는다** — 자르기 전 공제액의 최대치가 1,485,000원인데 밴드 하한이 40,000,000에서 이미 1,449,255원이고 45,000,000부터는 2,000,000원을 넘는다. **한도가 무는 사람은 소득이 낮거나, 부양가족이 많거나, 중도입사·은퇴로 근로기간이 짧거나, 이미 다른 공제로 산출세액을 소진한 사람이다.** 6차에 새로 만든 11건이 전부 그런 사람인 이유가 이것이고, 기존 36건 중 넷만 한도에 걸리는 이유도 이것이다.

**S16. 연금수령 개시 (6차 추가)** — `pension.contribution.after_annuity_start`.

`started`면 그 계좌의 납입은 연금보험료로 인정되지 않으므로 **배분 대상에서 빠진다.** `unknown`이면 **그 계좌의 배분을 보류한다** — 아니오로 접으면 연금 수령 중인 사용자에게 납입 가능액을 주게 되고 그 오류의 방향이 과대다. **두 계좌를 구분하지 않는다**(13.6.1절 — 조문이 "연금계좌"를 대상으로 쓴다). 한 계좌가 빠졌을 때 남은 계좌의 상한은 그 계좌에 걸리는 한도가 정한다 — 연금저축만 남으면 자기 한도 6,000,000이, IRP만 남으면 합산 한도 9,000,000이 상한이다(GC-36 대 GC-37).

**S17. 퇴직급여 입금액·계약이전액 (6차 추가)** — `pension.credit.excluded_contributions`.

§59의3 ① 1호·2호가 이 금액을 연금계좌 납입액에서 제외하므로 **세액공제 대상 납입액이 아니다.** 이것은 확정이다.

**확정이 아닌 것 하나** — 이 금액이 연간 납입한도 1,800만원을 쓰는지를 룰셋이 정하지 않는다. 시행령 §40의2 ② 1호 가목의 문언은 "연금계좌에 납입한 금액의 합계액"이고, 이연퇴직소득의 이체가 그 "납입"에 들어가는지를 이 유닛이 1차 출처로 확인하지 못했다. **그러므로 답을 내지 않는다.** 엔진은 쓰는 쪽(배분이 작아지는 = 과소 방향)으로 보고 가정으로 드러내고 있으며, 방향이 과소이므로 판정이 날 때까지 그대로 두는 것이 안전하다. 6차 케이스는 두 읽기가 같은 답을 내는 자리에만 세웠다(GC-39).

**S18. 나이와 기간의 계산 (6차 추가)** — `age.reckoning.reference_date`(6차에 룰셋에 새로 넣었다).

- **만 나이** = 출생일을 산입한 만 나이, 연수 표시(민법 §158). 만 N세가 되는 날은 N번째 생일 당일이다. 세법에 특칙이 없으므로 민법이 그대로 적용된다(국세기본법 §4).
- **n년 뒤의 날짜**는 역에 의해 계산하고, **최종의 월에 해당일이 없으면 그 월의 말일**이다(민법 §160 ③). 2월 29일생·2월 29일 가입의 처리가 여기서 정해진다.
- **단일 기준일은 없다.** 각 요건이 성립하는 시점이 곧 그 요건의 판정 시점이다. `pension.withdrawal.earliest_start`는 나이가 아니라 **날짜**로 환원되므로 기준일을 필요로 하지 않고, `isa.eligibility`의 연령 요건은 **가입 시점**에 성립해야 한다. 자세한 것은 8절.

---

## 3. 확정 시나리오 케이스

전 케이스 공통: `tax_year: 2026`, 룰셋 `2026.json`, `financial_income_taxpayer_last_3_years: false`(GC-13 제외), `months_remaining_in_tax_year: 12`(GC-22 제외).

### GC-01 — 공제율 경계: 총급여 정확히 55,000,000원 【경계】

**프로필** 40세 · 해당연도 총급여 55,000,000 · 직전연도 55,000,000 · 월 750,000 · horizon `at_or_after_pension_age` · 연금 두 계좌 ytd 0 · ISA 보유/일반형/누적 0/경과 0년

**기대 결과**

| 항목 | 값 |
|---|---|
| 공제율 (소득세 / 지방세율 / 실효) | 0.15 / 0.1 / 0.165 |
| 연금 합산 공제한도 · 잔여 | 9,000,000 · 9,000,000 |
| 연금 납입 잔여 한도 | 18,000,000 |
| 연금저축 공제 잔여 | 6,000,000 |
| ISA 납입 잔여 · 비과세 한도 | 20,000,000 · 2,000,000 |
| 최대공제안 연금 배분 총액 | 9,000,000 (전액 예산) |
| **└ 분할 (4차)** | **연금저축 6,000,000(#1) + IRP 3,000,000(#2)** · ISA 0 |
| 세액공제 소득세 / 지방세 / 합계 | **1,350,000 / 135,000 / 1,485,000** |
| 미배분 | 0 |
| 경고 | 없음 (horizon이 `at_or_after_pension_age`) |
| 경계 연수 | ISA 잔여 3년 · 연금 잔여 15년 |
| **배분안 수 (4차)** | **2** (`max_tax_credit`+`annuity_savings_first` 합쳐짐, `isa_first` 별개) |

**도출 과정** S1 750,000×12 = 9,000,000 → S2 `pension.credit.rate` 55,000,000 ≤ 55,000,000 이므로 **15% 구간**(`boundary_rule`이 "이하") → S3 `pension.contribution.annual_limit` 18,000,000−0 → S5 `pension.credit.limit.combined` 9,000,000 → S11 예산 9,000,000 전액이 공제한도 안 → **S13 동점(두 계좌 모두 15%)이므로 연금저축을 자기 한도 6,000,000까지 먼저 채우고 남은 3,000,000이 IRP로 간다** → S6 인정액은 분할과 무관하게 9,000,000 → S7 9,000,000×0.15 = 1,350,000, `tax.local.personal_income_surtax` 1,350,000×0.1 = 135,000 → S8 `isa.contribution.annual_limit` 20,000,000×(1+0)−0 = 20,000,000 → S9 `isa.tax_free_limit` 직전 55,000,000 > 50,000,000 → 일반형 2,000,000 → S12 `isa.account.requirements` 3−0 = 3, `pension.withdrawal.eligibility` 55−40 = 15.

**4차 개정 사유** 종전에는 IRP가 합산한도 9,000,000을 먼저 다 가져갔다. S13이 동점 구간의 순서를 뒤집었으므로 연금저축 단독 한도 6,000,000이 먼저 소진되고 잔여 3,000,000만 IRP로 간다. **공제 총액은 1,485,000 그대로다** — 두 계좌의 한계 공제율이 같아 분할이 세액에 닿지 않는다. 잔차도 0 그대로다(6,000,000·3,000,000 모두 12로 나누어떨어진다).

**세액 한도 (6차 산출)** 직전연도 총급여 55,000,000의 결정세액 밴드는 S15로 [3,324,163 , 4,100,000]이고 그 안의 **3,600,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,600,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-01",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "pension_combined_credit_limit_krw": 9000000,
        "pension_combined_credit_remaining_krw": 9000000,
        "pension_contribution_limit_remaining_krw": 18000000,
        "annuity_savings_credit_remaining_krw": 6000000,
        "isa_contribution_remaining_krw": 20000000,
        "isa_tax_free_limit_krw": 2000000
      },
      "boundaries": {
        "isa_lock_in_years_remaining": 3,
        "pension_years_remaining": 15
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          },
          "unallocated_krw": 0,
          "monthly_rounding_residual_krw": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ],
      "notice_codes": [
        "pension_start_date_not_computable"
      ]
    }
  }
}
```

### GC-02 — 공제율 경계 +1원: 총급여 55,000,001원 【경계】

**프로필** GC-01과 동일, 해당연도·직전연도 총급여 55,000,001

**기대 결과** 공제율 **0.12** / 0.1 / 0.132. 세액공제 **1,080,000 / 108,000 / 1,188,000**. 배분·분할·배분안 수는 GC-01과 동일(**연금저축 6,000,000 + IRP 3,000,000**, 배분안 2).

**도출 과정** S2에서 55,000,001 > 55,000,000 이므로 두 번째 구간(12%). S7 9,000,000×0.12 = 1,080,000 → ×0.1 = 108,000. **GC-01과의 차이 297,000원이 1원 차이로 갈린다** — 공제율 경계가 절벽형(cliff)임을 이 쌍이 고정한다.

**4차 개정 사유** GC-01과 같다. 확정 시나리오에서는 12% 구간에서도 **두 계좌가 같은 12%**이므로 여전히 동점이고 S13이 그대로 걸린다. 공제율 구간이 동점 여부를 가르는 것은 **개정안 청년 우대가 걸릴 때뿐**이다(GC-26 참조).

**세액 한도 (6차 산출)** 직전연도 총급여 55,000,000의 결정세액 밴드는 S15로 [3,324,163 , 4,100,000]이고 그 안의 **3,600,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,600,000이다. 자르기 전 소득세분 1,080,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다. 공제율이 12%로 내려가 자르기 전 금액이 더 작으므로 여유가 더 크다 — **공제율 경계와 한도 경계는 서로를 가리지 않는다.**

```golden
{
  "case": "GC-02",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000001,
      "prior_year_total_salary_krw": 55000001,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1080000,
            "local_tax": 108000,
            "total": 1188000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          }
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-03 — 공제율 경계 −1원: 총급여 54,999,999원 【경계】

**프로필** GC-01과 동일, 총급여 54,999,999

**기대 결과** 공제율 **0.15**. 세액공제 **1,350,000 / 135,000 / 1,485,000**. 배분 **연금저축 6,000,000 + IRP 3,000,000**, 배분안 2. GC-01과 같다.

**도출 과정** S2에서 54,999,999 < 55,000,000 → 15% 구간. GC-01·GC-03이 같고 GC-02만 다르면 경계가 정확히 55,000,000에 있고 "이하"로 닫혀 있음이 확정된다.

**4차 개정 사유** GC-01과 같다(S13 동점 → 연금저축 우선).

**세액 한도 (6차 산출)** 직전연도 총급여 55,000,000의 결정세액 밴드는 S15로 [3,324,163 , 4,100,000]이고 그 안의 **3,600,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,600,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-03",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 54999999,
      "prior_year_total_salary_krw": 54999999,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          }
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-04 — 연금·ISA 한도를 정확히 채우고 예산이 남는 경우 【경계】

**프로필** 40세 · 총급여 40,000,000 · 직전 40,000,000 · 월 2,500,000(예산 30,000,000) · ISA 서민형/누적 0/경과 0년

**기대 결과**

| 항목 | 값 |
|---|---|
| 공제율 | 0.15 |
| 연금 배분 (최대공제안) | 9,000,000 — **연금저축 6,000,000(#1, `credit_limit`) + IRP 3,000,000(#2, `credit_limit`)** |
| ISA 배분 | 20,000,000 — `limited_by: contribution_limit` (#3) |
| ISA 비과세 한도 | 4,000,000 |
| 세액공제 | **1,350,000 / 135,000 / 1,485,000** |
| 미배분 | **1,000,000** |
| 월 반올림 잔차 | **8** |
| **배분안 수 (4차)** | **1** — `plans_collapsed_single` |

**도출 과정** S1 30,000,000 → S5 9,000,000 → S8 20,000,000 → 최대공제안은 공제를 낳는 연금계좌를 먼저 채우고(9,000,000, 공제한도에서 멈춘다 — 그 이상 넣어도 `pension.credit.limit.combined`상 공제가 늘지 않는다) 남은 21,000,000을 ISA에 넣되 S8이 20,000,000이므로 1,000,000이 남는다 → **S13 동점이므로 연금 9,000,000은 연금저축 6,000,000 + IRP 3,000,000으로 나뉜다** → S9 직전 40,000,000 ≤ 50,000,000 → 서민형 4,000,000 → 잔차: 연금저축 6,000,000 ÷ 12 = 500,000 정확 → 0. IRP 3,000,000 ÷ 12 = 250,000 정확 → 0. ISA 20,000,000 ÷ 12 = 1,666,666(버림), ×12 = 19,999,992 → 8. 합 **8**.

**4차 개정 사유** 분할이 바뀌었고 **배분안이 3개에서 1개로 합쳐졌다**(S13-가). ISA 잔여 20,000,000이 연금 배분 후 남는 예산 21,000,000보다 작으므로 `isa_first`도 결국 세 계좌를 같은 금액으로 채우게 되어 세 안의 배분 벡터가 전부 일치한다. **잔차 8은 그대로다** — 새로 나뉜 두 연금 금액이 모두 12로 나누어떨어져 버림이 생기지 않는다. 잔차가 언제 늘고 언제 안 느는지를 GC-22와 짝으로 고정한다.

**세액 한도 (6차 산출) — 이 케이스는 잘린다**

직전연도 총급여 40,000,000의 밴드는 S15로 [1,449,255 , 2,013,500]이고, **부양가족이 없는 사람에게는 이 케이스가 잘리지 않는다.** 그러나 이 사람은 배우자를 부양하는 외벌이로 정의한다 — 기본공제 1인이 늘면 과세표준이 1,500,000 줄고 한계세율 15%에서 세액이 225,000 낮아지므로 밴드가 **[1,224,255 , 1,788,500]**으로 내려온다. 그 안의 **1,300,000**을 골랐다.

**왜 이 케이스에 이 사람을 세웠나.** 36건 중 자르기 전 공제액이 밴드 하한에 가장 가까운 것이 이 케이스다(총급여 40,000,000인데 예산이 커서 연금 공제한도를 꽉 채운다). **실제로 한도가 무는 사람이 서 있는 자리가 여기이고, 그 자리를 비워 두고 넉넉한 결정세액을 넣으면 36건 어디에서도 자르기가 관측되지 않는다.** 이 케이스의 축(한도를 정확히 채우고 예산이 남는 배분)은 배분에 관한 것이고, 계약 4.2절이 **세액 한도는 배분을 바꾸지 않는다**고 선언하므로 두 축이 서로를 가리지 않는다.

| 항목 | 값 |
|---|---|
| 자르기 전 소득세분 (= 임계값) | 1,350,000 |
| 한도 (= 1,300,000 + 0) | **1,300,000** |
| 인정 소득세분 | **1,300,000** |
| 지방세분 | **130,000** (인정된 소득세분 × 0.1) |
| 합계 | **1,430,000** (종전 1,485,000) |
| 잘린 금액 | 소득세분 50,000 + 지방세분 5,000 |

**배분은 한 원도 움직이지 않는다.** 연금저축 6,000,000 + IRP 3,000,000 + ISA 20,000,000, 미배분 1,000,000, 잔차 8 전부 그대로다.

```golden
{
  "case": "GC-04",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 1300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 40000000,
      "prior_year_total_salary_krw": 40000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 2500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "limits": {
        "pension_combined_credit_limit_krw": 9000000,
        "isa_contribution_remaining_krw": 20000000,
        "isa_tax_free_limit_krw": 4000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 20000000
          },
          "tax_credit": {
            "income_tax": 1300000,
            "local_tax": 130000,
            "total": 1430000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2,
            "isa": 3
          },
          "limited_by": {
            "annuity_savings": "credit_limit",
            "retirement_pension": "credit_limit",
            "isa": "contribution_limit"
          },
          "unallocated_krw": 1000000,
          "monthly_rounding_residual_krw": 8
        }
      },
      "notice_codes": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-05 — ISA 서민형 경계: 직전 총급여 정확히 50,000,000원 【경계】

**프로필** 40세 · 해당연도 60,000,000 · **직전 50,000,000** · 서민형 선언 · 월 500,000(예산 6,000,000)

**기대 결과** 공제율 0.12. ISA 비과세 한도 **4,000,000**. 유형 충돌 경고 **없음**. 세액공제 **720,000 / 72,000 / 792,000**. 배분 **연금저축 6,000,000 · IRP 0 · ISA 0**. 배분안 2.

**도출 과정** S2 60,000,000 > 55,000,000 → 12%. S9 `isa.tax_free_limit` 직전 50,000,000 ≤ 50,000,000 → 서민형(`boundary_rule` "이하") → 선언과 일치 → 경고 없음. S11 예산 6,000,000 전액 연금(공제한도 9,000,000 여유) → **S13 동점이므로 연금저축부터 채우는데 예산 6,000,000이 연금저축 자기 한도 6,000,000을 정확히 채우고 끝나므로 IRP는 0이다** → S7 6,000,000×0.12 = 720,000.

**4차 개정 사유** 종전에는 IRP 6,000,000 · 연금저축 0이었다. 순서가 뒤집혀 정확히 반대가 됐다. **이 케이스가 "예산이 연금저축 자기 한도에 못 미치거나 딱 맞으면 IRP는 0"이라는 규칙의 경계 지점**이다 — 예산이 1원이라도 크면 그 초과분부터 IRP가 받는다. 공제 총액 792,000은 그대로다.

**두 소득 기준이 다른 해를 본다는 점이 이 케이스의 핵심이다.** 공제율은 **해당** 과세기간(60,000,000 → 12%), ISA 유형은 **직전** 과세기간(50,000,000 → 서민형)으로 갈린다.

**세액 한도 (6차 산출)** 직전연도 총급여 50,000,000의 결정세액 밴드는 S15로 [2,682,194 , 3,387,500]이고 그 안의 **3,000,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,000,000이다. 자르기 전 소득세분 720,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-05",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "isa_tax_free_limit_krw": 4000000
      },
      "notice_codes_absent": [
        "isa_type_conflicts_with_prior_income",
        "tax_liability_cap_applied"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 720000,
            "local_tax": 72000,
            "total": 792000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1
          }
        }
      }
    }
  }
}
```

### GC-06 — ISA 서민형 경계 +1원 + 선언 충돌 【경계】

**프로필** GC-05와 동일, **직전 50,000,001** · 여전히 서민형 선언

**기대 결과** ISA 비과세 한도 **4,000,000** (선언을 따른다) + 경고 `isa_type_conflicts_with_prior_income`(warning). 세액공제·배분 GC-05와 동일(**연금저축 6,000,000 · IRP 0**).

**4차 개정 사유** GC-05와 같다. ISA 유형 판정은 배분 순서와 독립이므로 이 케이스가 보는 것(선언 우선 + 경고)은 이번 변경에 영향받지 않는다.

**도출 과정** S9에서 직전 50,000,001 > 50,000,000 → 소득 기준으로는 일반형. 그러나 계약 3.2절이 "사용자 선언을 그대로 신뢰하고 엔진이 덮어쓰지 않는다"고 정하므로 한도는 4,000,000을 유지하고 불일치만 알린다. **세법 판정과 표시 값이 갈리는 유일한 지점이므로 경고 누락은 곧 오답이다.**

**세액 한도 (6차 산출)** 직전연도 총급여 50,000,000의 결정세액 밴드는 S15로 [2,682,194 , 3,387,500]이고 그 안의 **3,000,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,000,000이다. 자르기 전 소득세분 720,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-06",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 50000001,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "isa_tax_free_limit_krw": 4000000
      },
      "notice_codes": [
        "isa_type_conflicts_with_prior_income"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 720000,
            "local_tax": 72000,
            "total": 792000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-07 — 기납입액이 이미 합산한도를 초과 【경계】

**프로필** 40세 · 총급여 45,000,000 · 연금저축 ytd **7,000,000** · IRP ytd **5,000,000** · 월 1,000,000(예산 12,000,000) · ISA 서민형

**기대 결과**

| 항목 | 값 |
|---|---|
| 연금 합산 공제 잔여 | **0** (클램프) |
| 연금 납입 잔여 | **6,000,000** |
| 두 연금계좌 `clamped_to_zero` | true |
| 세액공제 인정액 | **9,000,000** |
| 세액공제 | **1,350,000 / 135,000 / 1,485,000** |
| 배분 | 연금 0, ISA 12,000,000 |
| 안내 | `existing_contribution_over_limit`(warning) |
| 배분안 | 1개로 합쳐짐 (`plans_collapsed_single`) |

**도출 과정** S3 18,000,000 − 12,000,000 = 6,000,000 → S6 연금저축 7,000,000에 단독 한도 6,000,000 적용 → 6,000,000. D17로 IRP 먼저: `IRP인정 = min(5,000,000, 9,000,000) = 5,000,000`, `연금저축인정 = min(6,000,000, 9,000,000−5,000,000) = 4,000,000`. 합 **9,000,000** → 합산한도 소진 → 잔여 0 → S7 9,000,000×0.15. 추가 납입은 공제를 늘리지 못하므로 전액 ISA.

**여기서 D17은 결과를 바꾸지 않는다.** 연금저축 우선으로 인정해도 6,000,000+3,000,000 = 9,000,000으로 총액이 같고 공제율이 동일하기 때문이다. 확정 시나리오에서 D17이 무해하다는 사실을 고정하는 케이스다.

**4차 — 기대값이 바뀌지 않는다. 이유는 "동점이 아니어서"가 아니다.** 동점은 맞다(두 계좌 모두 15%). 그런데 합산 공제 잔여가 0이라 **연금계좌에 갈 돈이 애초에 없다.** S13은 연금 배분 총액을 두 계좌에 나누는 규칙이므로 총액이 0이면 적용할 것이 없다. 배분안도 종전대로 하나로 합쳐진다(세 안 전부 ISA 12,000,000). **D17(인정 순서)과 S13(충당 순서)은 다른 단계라는 점도 이 케이스가 드러낸다** — D17은 기납입액을 어느 계좌 몫으로 인정할지, S13은 새 돈을 어디에 넣을지를 정한다. 여기서는 D17만 걸리고 S13은 걸리지 않는다.

**세액 한도 (6차 산출) — 되더하기가 실제로 결과를 바꾸는 케이스**

이 사람은 이미 연금저축 7,000,000 + IRP 5,000,000을 납입해 합산 한도를 넘긴 사람이다. **작년에 처음 그랬다고 볼 이유가 없다** — 이 규모로 납입하는 사람은 직전 과세연도에도 납입해 공제를 받았다고 보는 것이 CD2에 맞다. 그래서 되더할 값이 0이 아니다.

직전연도 총급여 45,000,000의 밴드는 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 한도로 잡되, 작년에 9,000,000을 납입해 1,350,000의 연금계좌 세액공제를 받았으므로 서식의 결정세액은 2,400,000 − 1,350,000 = **1,050,000**으로 적혀 있다. 즉 `결정세액 1,050,000 + 연금계좌 세액공제액 1,350,000 = 한도 2,400,000`이다.

**되더하기를 빠뜨리면 한도가 1,050,000이 되어 자르기 전 소득세분 1,350,000을 자른다** — 공제액이 1,485,000에서 1,155,000으로 330,000원 줄어든다. 되더하면 자르지 않는다. 블록의 `notice_codes_absent: ["tax_liability_cap_applied"]`가 이 차이를 검사한다.

```golden
{
  "case": "GC-07",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 1050000,
        "pension_credit_applied_krw": 1350000
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 7000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 5000000,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "notice_codes": [
        "existing_contribution_over_limit"
      ],
      "limits": {
        "pension_combined_credit_remaining_krw": 0,
        "pension_contribution_limit_remaining_krw": 6000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "credit_eligible_krw": 9000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,800,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다. 전환 추가한도로 인정액이 12,000,000까지 늘어난 케이스라 자르기 전 금액이 이 문서에서 가장 크다. 그래도 밴드 안이다.

```golden
{
  "case": "GC-15",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 50000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": {
      "amount_krw": 40000000,
      "destination": "retirement_pension",
      "prior_year_applied_extra_credit_krw": 0
    }
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "limits": {
        "isa_transfer_extra_credit_limit_krw": 3000000,
        "pension_combined_credit_limit_krw": 12000000,
        "pension_combined_credit_remaining_krw": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 1800000,
            "local_tax": 180000,
            "total": 1980000
          },
          "warning_count": 0,
          "credit_eligible_krw": 12000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-08 — 월 납입 여력 0 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 **0** · 모든 계좌 ytd 0

**기대 결과** 예산 0. 모든 배분 0. 세액공제 **0 / 0 / 0**. 안내 `zero_capacity`(info) + `plans_collapsed_single`. 한도는 정상 산출(연금 공제 잔여 9,000,000, ISA 20,000,000). **오류가 아니다.**

**도출 과정** S1 0×12 = 0. 기납입도 0이므로 S6 인정액 0 → S7 0. 한도 계산은 예산과 무관하므로 그대로 낸다.

**4차 — 기대값이 바뀌지 않는다.** 예산이 0이라 나눌 돈 자체가 없다. GC-07과 같은 이유(연금계좌에 갈 돈이 없음)이되 원인이 다르다 — GC-07은 한도 소진, 여기는 여력 0이다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 밴드 안에서 **2,400,000**을 골랐다. 다만 이 케이스에서 한도는 결과를 바꾸지 않는다 — 월 여력이 0이라 자르기 전 소득세분이 이미 0이고, `min(0, 한도)`는 한도가 무엇이든 0이다. **그럼에도 `unknown`으로 두지 않았다.** 여력 0을 보는 케이스에 한도 미확인 상태를 섞으면 `tax_liability_cap_unknown`이 붙어 이 케이스가 보려는 것과 다른 안내가 결과에 얹힌다.

```golden
{
  "case": "GC-08",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "notice_codes": [
        "zero_capacity"
      ],
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "limits": {
        "pension_combined_credit_remaining_krw": 9000000,
        "isa_contribution_remaining_krw": 20000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-09 — 예산이 모든 잔여 한도의 합을 초과 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 20,000,000(예산 240,000,000) · ISA 서민형/누적 0/경과 0년

**기대 결과** 연금 9,000,000(공제한도) — **연금저축 6,000,000 + IRP 3,000,000** — + ISA 20,000,000 = 29,000,000 배분, **미배분 211,000,000**. 세액공제 **1,350,000 / 135,000 / 1,485,000**. 안내 `budget_exceeds_all_limits`. 잔차 8. **배분안 수 1** — `plans_collapsed_single`.

**4차 개정 사유** 분할이 바뀌었고 GC-04와 같은 이유로 세 안이 하나로 합쳐졌다(예산이 세 계좌 잔여 한도의 합을 넘으므로 어떤 순서로 채워도 같은 벡터에 도달한다). 잔차 8은 그대로다(ISA 20,000,000만 12로 나누어떨어지지 않는다).

**도출 과정** 최대공제안은 공제를 낳지 않는 곳에 돈을 밀어 넣지 않는다. 연금 납입한도는 18,000,000이지만 9,000,000을 넘는 납입은 `pension.credit.limit.combined`상 공제가 붙지 않으므로 공제한도에서 멈추는 것이 목적함수에 부합한다. 따라서 미배분 = 240,000,000 − 29,000,000.

**세액 한도 (6차 산출) — 이 케이스는 `unknown`으로 둔다**

예산이 세 계좌의 잔여 한도를 전부 넘기는 사람이다. 여력이 연 240,000,000이면 직전 과세연도 결정세액이 얼마였을지를 **총급여 45,000,000이라는 진술만으로 말할 수 없다** — 근로소득 외의 소득이 있을 개연성이 높고, 그러면 S15의 밴드(근로소득만 있는 사람의 것)가 성립하지 않는다. **밴드가 성립하지 않는 자리에 밴드에서 뽑은 값을 넣는 것이 곧 지어내는 것이다.** CD4에 따라 `unknown`으로 둔다.

**그 대가로 이 케이스는 한도를 검사하지 않는다.** 대신 `tax_liability_cap_unknown`이 붙는다는 것과 **한도를 모르면 자르지 않는다**는 것을 검사한다 — 공제액은 자르기 전 값 1,485,000 그대로이고, 그 값은 "이만큼"이 아니라 "최대 이만큼"이다.

```golden
{
  "case": "GC-09",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 20000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "legal_basis": {
        "pension.contribution.beyond_credit_limit": {"present":true,"has_uncertainty_note":true,"uncertainty_note_count":1,"uncertainty_kinds":["unverified"],"uncertainty_paths":["unverified"]}
      },
      "plan_count": 1,
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "notice_codes": [
        "budget_exceeds_all_limits",
        "tax_liability_cap_unknown"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 20000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "unallocated_krw": 211000000,
          "monthly_rounding_residual_krw": 8
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "tax_liability_cap_zero"
      ]
    }
  }
}
```

### GC-10 — ISA 한도 산식의 경과연수 4년 상한 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 1,000,000(예산 12,000,000) · ISA 누적 30,000,000 · **경과 5년**

**기대 결과** ISA 납입 잔여 **70,000,000**. ISA 의무가입기간 잔여 **0년**. 배분 연금 9,000,000(**연금저축 6,000,000 + IRP 3,000,000**) + ISA 3,000,000. 세액공제 1,350,000 / 135,000 / 1,485,000. **배분안 수 2**(`isa_first`는 ISA 12,000,000으로 다르다). 잔차 0.

**4차 개정 사유** 분할만 바뀌었다. ISA 잔여 70,000,000이 남은 예산 3,000,000보다 훨씬 크므로 `isa_first`(ISA 12,000,000 · 연금 0)는 여전히 다른 벡터이고 합쳐지지 않는다. 세액공제와 한도는 그대로다.

**도출 과정** S8 `isa.contribution.annual_limit` = 20,000,000 × [1 + min(5, 4)] − 30,000,000 = 100,000,000 − 30,000,000 = **70,000,000**. 총한도 쪽도 100,000,000 − 30,000,000 = 70,000,000으로 같다. **경과 4년과 5년이 같은 값을 내야 한다** — 규칙의 `cap_behavior`가 그렇게 정한다. S12 3 − 5 < 0 → 0.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-10",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 30000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 5,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "isa_contribution_remaining_krw": 70000000
      },
      "boundaries": {
        "isa_lock_in_years_remaining": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "monthly_rounding_residual_krw": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-11 — ISA 누적 납입액이 총한도에 도달 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 2,000,000(예산 24,000,000) · ISA 누적 **100,000,000** · 경과 4년

**기대 결과** ISA 납입 잔여 **0** (`limited_by: contribution_limit`). 배분 연금 9,000,000 — **연금저축 6,000,000 + IRP 3,000,000** — ISA 0. 미배분 **15,000,000**. 세액공제 1,350,000 / 135,000 / 1,485,000. 안내 `budget_exceeds_all_limits`. **배분안 수 1** — `plans_collapsed_single`.

**4차 개정 사유** 분할이 바뀌었고 배분안이 2개에서 1개로 합쳐졌다. ISA에 넣을 수 있는 돈이 0이므로 `isa_first`도 결국 연금계좌만 채우게 되어 세 안이 같은 벡터가 된다.

**도출 과정** S8 20,000,000×5 − 100,000,000 = 0. 총한도 쪽도 0. 산식과 총한도가 정확히 같은 지점에서 맞물린다는 것을 고정한다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-11",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 2000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 100000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "notice_codes": [
        "budget_exceeds_all_limits"
      ],
      "limits": {
        "isa_contribution_remaining_krw": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "limited_by": {
            "isa": "contribution_limit"
          },
          "unallocated_krw": 15000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-12 — 재형저축 보유로 총 납입한도가 축소 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 1,000,000 · ISA 누적 0 · 경과 4년 · **재형저축등 계약금액 40,000,000**

**기대 결과** ISA 납입 잔여 **60,000,000**. 배분 연금 9,000,000(**연금저축 6,000,000 + IRP 3,000,000**) + ISA 3,000,000. **배분안 수 2**.

**4차 개정 사유** 분할만 바뀌었다. GC-10과 같은 구조다 — ISA 잔여가 크므로 `isa_first`가 별개 벡터로 남는다.

**도출 과정** S8 산식 쪽 = 20,000,000×5 − 0 = 100,000,000. 총한도 쪽 = (100,000,000 − 40,000,000) − 0 = 60,000,000. 둘 중 작은 값 **60,000,000**. `isa.account.requirements`의 `total_limit_reduction`이 근거다. **산식만 보고 총한도 차감을 빠뜨리면 40,000,000원을 과대 안내한다.**

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-12",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 40000000
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "isa_contribution_remaining_krw": 60000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-13 — 금융소득종합과세 대상자: ISA 배제

**프로필** 40세 · 총급여 45,000,000 · **직전 3개 과세기간 중 1회 이상 금융소득종합과세 대상 = true** · 월 2,500,000(예산 30,000,000)

**기대 결과** ISA `eligible: false`, 사유 `isa_excluded_financial_income_taxpayer`. ISA 납입 잔여 0, 배분 `limited_by: not_eligible`. 배분 연금 9,000,000 — **연금저축 6,000,000 + IRP 3,000,000** — 미배분 **21,000,000**. 세액공제 1,350,000 / 135,000 / 1,485,000. **배분안 수 1** — `plans_collapsed_single`.

**4차 개정 사유** 분할이 바뀌었고 배분안이 합쳐졌다. ISA가 배제되어 넣을 곳이 연금계좌뿐이므로 세 안이 같은 벡터가 된다(GC-11과 같은 형태이되 원인이 자격 배제다).

**도출 과정** S10 `isa.exclusion.financial_income_taxpayer` — 조특법 §129조의2① 배제. 판정 기준이 **직전 3개** 과세기간이라는 점이 핵심이며, 직전 1개만 보면 오판한다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-13",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": true,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 2500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "isa_eligible": false,
      "isa_reason_codes": [
        "isa_excluded_financial_income_taxpayer"
      ],
      "notice_codes": [
        "isa_excluded_financial_income_taxpayer"
      ],
      "comparison_note_codes": [
        "plans_collapsed_single"
      ],
      "limits": {
        "isa_contribution_remaining_krw": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "limited_by": {
            "isa": "not_eligible"
          },
          "unallocated_krw": 21000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-14 — 연령 미달로 ISA 배제 【경계】

**프로필** **14세** · 총급여 20,000,000 · 직전 총급여 **null** · 월 500,000(예산 6,000,000) · ISA 미보유

**기대 결과** ISA `eligible: false`, 사유 `isa_excluded_age`. ISA 비과세 한도 **null**(유형 미선언). 배분 연금 6,000,000 — **전액 연금저축, IRP 0**. 세액공제 **900,000 / 90,000 / 990,000**. 안내 `isa_excluded_age`, `isa_tenure_missing`, `isa_type_not_declared`, `prior_year_income_missing`, **`plans_collapsed_single`**. 연금 잔여 연수 **41년**. **배분안 수 1**.

**4차 개정 사유** 종전에는 IRP 6,000,000이었다. S13이 순서를 뒤집었고 예산 6,000,000이 연금저축 자기 한도를 딱 채우므로 IRP는 0이다(GC-05와 같은 형태). ISA가 배제되어 있어 세 안이 같은 벡터가 되므로 배분안도 2개에서 1개로 합쳐진다. 공제 총액 990,000은 그대로다.

**도출 과정** S10 `isa.eligibility` — 19세 미만이고 15세에도 미달하므로 두 요건 모두 불충족. S2 20,000,000 ≤ 55,000,000 → 15% → 6,000,000×0.15 = 900,000. S12 55 − 14 = 41.

**연금계좌에는 최소 연령 규칙이 룰셋에 없다.** 따라서 14세에게도 연금 배분이 나가고 안내 `pension_age_not_evaluated`가 함께 나가는 것이 맞다. 룰셋에 없는 규칙을 엔진이 지어내면 안 된다.

**세액 한도 (6차 산출) — 한도가 0이라 공제액이 0이 된다**

만 14세이고 직전 과세기간 근로소득이 없어 ISA 15세 경로가 성립하지 않는 사람이다. **직전 과세기간에 근로소득이 없었다면 그 해의 결정세액은 0이다** — 산출세액이 없으면 결정세액도 없다. CD2가 그대로 적용되는 자리이고, 여기에 넉넉한 결정세액을 넣는 것은 프로필과 모순된다. `state: "zero"`로 두고 연금계좌 세액공제액은 0이므로 **한도 = 0**이다.

| 항목 | 값 |
|---|---|
| 자르기 전 소득세분 (= 임계값) | 900,000 |
| 한도 | **0** |
| 인정 세액공제 소득세 / 지방세 / 합계 | **0 / 0 / 0** (종전 900,000 / 90,000 / 990,000) |
| 배분 | 연금저축 6,000,000 · IRP 0 · ISA 0 — **움직이지 않는다** |
| 안내 | `tax_liability_cap_zero` · `tax_liability_cap_applied` |
| 비교 안내 | `tax_credit_axis_not_discriminating` |

**이 케이스가 5차까지 990,000원을 약속하고 있었다.** 직전 과세기간에 소득이 없던 사람에게 99만원의 절세액을 제시하고 있었다는 뜻이고, **그것이 6차 조사가 지목한 바로 그 결함이다.** 기대값이 엔진과 같은 누락을 공유하고 있었으므로 대조가 이것을 잡지 못했다.

**해당 과세연도에는 총급여 20,000,000이 있으니 한도가 0이 아니지 않은가.** 그럴 수 있다. 그러나 `tax_liability_cap.source_form`의 `exactness`가 적어 둔 대로 이 값은 **직전 과세연도로 해당 과세연도를 추정하는 것**이고, 그 전제는 반드시 깨진다. 엔진이 추정을 고쳐 쓰기 시작하면 그 순간 지어내는 쪽으로 넘어간다. 사용자가 진술한 것을 그대로 쓰는 것이 옳다.

```golden
{
  "case": "GC-14",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "2012-06-15",
      "prior_year_tax": {
        "state": "zero",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 20000000,
      "prior_year_total_salary_krw": null,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": false,
        "account_type": null,
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": null,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "isa_eligible": false,
      "isa_reason_codes": [
        "isa_excluded_age"
      ],
      "notice_codes": [
        "isa_excluded_age",
        "isa_tenure_missing",
        "isa_type_not_declared",
        "prior_year_income_missing",
        "pension_age_not_evaluated",
        "tax_liability_cap_zero",
        "tax_liability_cap_applied"
      ],
      "comparison_note_codes": [
        "plans_collapsed_single",
        "tax_credit_axis_not_discriminating"
      ],
      "boundaries": {
        "pension_years_remaining": 41
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0
        }
      }
    }
  }
}
```

### GC-15 — ISA 만기 전환: 300만원 상한이 구속 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 1,000,000(예산 12,000,000) · ISA 누적 50,000,000/경과 4년 · **전환 40,000,000 → IRP, 직전 적용액 0**

**기대 결과**

| 항목 | 값 |
|---|---|
| 전환 추가한도 | **3,000,000** |
| 연금 합산 공제한도 | **12,000,000** · 잔여 **0** |
| 당해연도 납입 반영액 | 40,000,000 |
| 세액공제 인정액 | **12,000,000** |
| 세액공제 | **1,800,000 / 180,000 / 1,980,000** |
| 배분 | 연금 0, ISA 12,000,000 |

**도출 과정** S4 `pension.credit.isa_transfer.extra_limit` = min(40,000,000×0.10 = 4,000,000, 3,000,000 − 0) = **3,000,000** (300만원 상한이 구속) → S5 9,000,000 + 3,000,000 = 12,000,000 → 전환금액 40,000,000이 §59조의3③에 따라 IRP 당해연도 납입액에 포함되므로 S6에서 `IRP인정 = min(40,000,000, 12,000,000) = 12,000,000` → 합산한도 소진 → S7 12,000,000×0.15 = 1,800,000. 추가 납입은 공제를 늘리지 못하므로 예산 전액 ISA.

**4차 — GC-15·16·17 세 건 모두 기대값이 바뀌지 않는다.** 전환금액이 합산 공제한도를 이미 다 채워 **연금계좌에 갈 새 돈이 0**이기 때문이다. 동점이 아니어서가 아니다(세 건 다 동점이다). 배분안도 종전대로 하나로 합쳐진다.

### GC-16 — ISA 만기 전환: 10%가 구속 【경계】

**프로필** 40세 · 총급여 **60,000,000** · 월 1,000,000 · ISA 일반형/누적 50,000,000/경과 4년 · **전환 10,000,000 → IRP**

**기대 결과** 전환 추가한도 **1,000,000**. 연금 합산 공제한도 **10,000,000**. 인정액 10,000,000. 세액공제 **1,200,000 / 120,000 / 1,320,000**. ISA 비과세 한도 2,000,000.

**도출 과정** S4 min(10,000,000×0.10 = 1,000,000, 3,000,000) = **1,000,000** (이번엔 10%가 구속) → S5 10,000,000 → S6 IRP인정 10,000,000 → S2 60,000,000 > 55,000,000 → 12% → S7 10,000,000×0.12 = 1,200,000. GC-15와 쌍으로 `min` 두 항이 각각 구속되는 경우를 모두 덮는다.

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,200,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-16",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 50000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": {
      "amount_krw": 10000000,
      "destination": "retirement_pension",
      "prior_year_applied_extra_credit_krw": 0
    }
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_transfer_extra_credit_limit_krw": 1000000,
        "pension_combined_credit_limit_krw": 10000000,
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 1200000,
            "local_tax": 120000,
            "total": 1320000
          },
          "warning_count": 0,
          "credit_eligible_krw": 10000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-17 — ISA 만기 전환: 직전 과세기간 적용액 차감 【경계】

**프로필** GC-15와 동일, **직전 적용액 1,200,000**

**기대 결과** 전환 추가한도 **1,800,000**, 차감액 1,200,000. 연금 합산 공제한도 **10,800,000**. 세액공제 **1,620,000 / 162,000 / 1,782,000**.

**도출 과정** S4 min(4,000,000, 3,000,000 − 1,200,000 = 1,800,000) = **1,800,000**. 규칙의 `period` 필드가 정한 차감이다. S7 10,800,000×0.15 = 1,620,000.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,620,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-17",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 50000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": {
      "amount_krw": 40000000,
      "destination": "retirement_pension",
      "prior_year_applied_extra_credit_krw": 1200000
    }
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_transfer_extra_credit_limit_krw": 1800000,
        "pension_combined_credit_limit_krw": 10800000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 1620000,
            "local_tax": 162000,
            "total": 1782000
          },
          "warning_count": 0,
          "credit_eligible_krw": 10800000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-18a~d — `fund_use_horizon` 네 값: 금액 불변 【경계 4건】

**프로필(4건 공통)** 40세 · 총급여 45,000,000 · 월 1,000,000(예산 12,000,000) · ISA 서민형/누적 0/경과 0년 · horizon만 다름

**기대 결과 — 네 값 전부에서 동일해야 하는 것**

배분(**연금저축 6,000,000 + IRP 3,000,000** + ISA 3,000,000), 세액공제 **1,350,000 / 135,000 / 1,485,000**, 모든 한도, 잔차 0, 배분안 수 2. 계약 4.2절 `fund_use_horizon_affects`가 `allocation_amounts: false`, `tax_credit_amounts: false`, `limits: false`로 **스스로 선언한 보장**이다. **4차의 S13이 이 선언을 깨지 않았는지가 이 4건의 새 관전 포인트다** — 동점 판정을 horizon에 걸었다면 배분 금액이 네 값에 걸쳐 갈라졌을 것이다(계약 0.4절이 그렇게 하지 않은 이유를 적고 있다).

**기대 결과 — 값에 따라 달라져야 하는 것** (경고 건수는 4차에 전부 한 건씩 늘었다)

| horizon | 기본안 | 최대공제안의 경고 (건수·계좌·등급) | `isa_first`의 경고 | 비교 안내 |
|---|---|---|---|---|
| `within_isa_lock_in` (a) | `max_tax_credit` | **3건** — 연금저축·IRP·ISA, `warning` | 1건(ISA) | `all_accounts_have_early_exit_penalty` |
| `before_pension_age` (b) | **`isa_first`** | **2건** — 연금저축·IRP, `warning` | 0건 | `baseline_reordered_by_fund_use_horizon` |
| `at_or_after_pension_age` (c) | `max_tax_credit` | 0건 | 0건 | — |
| `unknown` (d) | `max_tax_credit` | **3건** — 연금저축·IRP·ISA, **`info`**, trigger `horizon_unknown` | 1건(ISA, `info`) | 안내 `fund_use_horizon_not_declared` |

**도출 과정** 경고 근거는 `pension.withdrawal.eligibility`·`pension.early_withdrawal.other_income_rate`(연금)와 `isa.early_termination.clawback`·`isa.account.requirements`(ISA)다. (b)에서 기본안이 바뀌므로 `delta_vs_baseline_krw`가 **양수 1,485,000**이 된다 — 계약 0.1절이 부호 제약을 없앤 바로 그 경우다. 부호를 "포기한 금액"으로 읽으면 이득을 손실로 표시한다.

**4차 개정 사유 — 경고 건수를 세법으로 정한다.** 경고는 `배분액 > 0`인 계좌마다 붙는다(계약 5.6절). S13이 연금 배분을 두 계좌로 쪼갰으므로 배분액이 양수인 연금계좌가 하나에서 **둘**이 됐고, 따라서 연금 경고도 하나에서 **둘**이 된다. **이것이 임의의 표시 규칙이 아니라 세법 결론이라는 점이 중요하다** — `pension.withdrawal.eligibility`와 `pension.early_withdrawal.other_income_rate`가 계좌 종류를 가리지 않고 똑같이 걸리므로, 연금저축 6,000,000에 붙는 불이익과 IRP 3,000,000에 붙는 불이익은 성질이 같다. **한쪽에만 붙이면 사용자는 자기 돈의 3분의 2에 걸린 제약을 못 본다.** (a)의 3건은 `연금저축 · IRP · ISA`이고, (b)의 2건은 `연금저축 · IRP`다. (c)는 요건 자체가 성립하지 않아 0건 그대로다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-18a",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "within_isa_lock_in",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "comparison_note_codes": [
        "all_accounts_have_early_exit_penalty"
      ],
      "plans": {
        "max_tax_credit": {
          "is_baseline": true,
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 3,
          "warning_codes": [
            "early_withdrawal_penalty_pension",
            "early_termination_clawback_isa"
          ],
          "monthly_rounding_residual_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 1,
          "warning_codes": [
            "early_termination_clawback_isa"
          ]
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-18b",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "before_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "comparison_note_codes": [
        "baseline_reordered_by_fund_use_horizon"
      ],
      "plans": {
        "max_tax_credit": {
          "is_baseline": false,
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 2,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ],
          "delta_vs_baseline_krw": 1485000
        },
        "isa_first": {
          "is_baseline": true,
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "delta_vs_baseline_krw": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-18c",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "comparison_note_codes_absent": [
        "all_accounts_have_early_exit_penalty",
        "baseline_reordered_by_fund_use_horizon"
      ],
      "plans": {
        "max_tax_credit": {
          "is_baseline": true,
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "monthly_rounding_residual_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-18d",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "unknown",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "notice_codes": [
        "fund_use_horizon_not_declared"
      ],
      "comparison_note_codes_absent": [
        "all_accounts_have_early_exit_penalty"
      ],
      "plans": {
        "max_tax_credit": {
          "is_baseline": true,
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 3,
          "warning_codes": [
            "early_withdrawal_penalty_pension",
            "early_termination_clawback_isa"
          ]
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 1,
          "warning_codes": [
            "early_termination_clawback_isa"
          ]
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-21 — ISA 의무가입기간·연금 개시연령이 모두 경과 【경계】

**프로필** **56세** · 총급여 45,000,000 · 월 1,000,000 · ISA 서민형/누적 20,000,000/**경과 3년** · horizon `within_isa_lock_in`

**기대 결과**

| 항목 | 값 |
|---|---|
| ISA 의무가입기간 잔여 | **0년** |
| 연금 개시연령 잔여 | **0년** |
| ISA 납입 잔여 | 60,000,000 |
| 배분 (최대공제안) | **연금저축 6,000,000 + IRP 3,000,000 + ISA 3,000,000** |
| 세액공제 | 1,350,000 / 135,000 / 1,485,000 |
| ISA 중도해지 추징 경고 | **나가지 않아야 한다** (아래) |
| 연금 중도인출 경고 (4차) | **2건** — 연금저축·IRP 둘 다, `warning` |
| 배분안 수 (4차) | **2** |

**도출 과정** S12 `isa.account.requirements`의 `min_contract_years` 3 − 경과 3 = 0. `pension.withdrawal.eligibility`의 `min_age` 55 − 56 < 0 → 0. S8 20,000,000×(1+3) − 20,000,000 = 60,000,000.

**추징 경고에 대한 판단.** `isa.early_termination.clawback`은 "계약기간이 **3년이 되는 날 전에** 계약을 해지하는 경우"에만 걸린다(조특법 §91조의18⑦). 경과 3년이면 그 요건이 성립할 수 없으므로 **추징을 근거로 한 경고는 세법상 성립하지 않는다.**

**2차 개정 — 계약 3.1.0 반영.** M2 수정으로 계약 8.4절에 `isa_lock_in_years_remaining > 0` 조건이 추가됐고 안내 코드 `isa_lock_in_already_elapsed`(info)가 신설됐다. 이에 따라 이 케이스의 기대값을 다음으로 확정한다.

- ISA 추징 경고 `early_termination_clawback_isa` — **나가지 않는다**
- 안내 `isa_lock_in_already_elapsed`(info) — **나간다**
- 연금 경고 `early_withdrawal_penalty_pension` — **그대로 나간다** (아래)
- 비교 안내 `all_accounts_have_early_exit_penalty` — **나가지 않아야 한다.** 이 코드의 뜻은 "세 계좌 전부에 중도 불이익이 걸려 **어느 배분안도 이를 피하지 못한다**"이다(계약 8.5절). ISA 경고가 성립하지 않게 된 이상 `isa_first` 안은 중도 불이익을 완전히 피하므로, 이 안내는 사실이 아니다.

연금 쪽 경고는 다르다. 56세로 연령요건은 충족했으나 **5년 보유요건은 입력이 없어 판정되지 않았다**(`pension_holding_period_evaluated: false`). 요건이 미충족일 수 있으므로 경고가 나가는 것이 오답은 아니다.

**4차 개정 — 연금 경고가 1건에서 2건으로 는다.** 분할이 바뀌어 배분액 > 0인 연금계좌가 둘이 됐기 때문이다. `all_accounts_have_early_exit_penalty`가 **여전히 나가지 않아야 한다**는 결론은 그대로다 — `isa_first` 안(ISA 12,000,000 · 연금 0)이 경고를 하나도 지지 않고, 그 안이 배분안 목록에 남아 있다. 즉 이번 변경이 3차에서 확정한 이 케이스의 정답을 흔들지 않았는지가 관전 포인트이며, 흔들지 않았다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-21",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1970-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "within_isa_lock_in",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 3,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "legal_basis": {
        "pension.withdrawal.non_deducted_principal": {"present":true,"has_uncertainty_note":true,"uncertainty_note_count":1,"uncertainty_kinds":["unverified"],"uncertainty_paths":["confirmation_procedure.unverified"]}
      },
      "plan_count": 2,
      "boundaries": {
        "isa_lock_in_years_remaining": 0,
        "pension_years_remaining": 0,
        "pension_holding_period_evaluated": false
      },
      "limits": {
        "isa_contribution_remaining_krw": 60000000
      },
      "notice_codes": [
        "isa_lock_in_already_elapsed",
        "pension_holding_period_not_evaluated"
      ],
      "comparison_note_codes_absent": [
        "all_accounts_have_early_exit_penalty"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 2,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ]
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-22 — 부분 연도 + 월 반올림 잔차 【경계】

**프로필** 40세 · 총급여 45,000,000 · 월 **1,428,571** · **남은 개월수 7**(예산 9,999,997) · ISA 서민형

**기대 결과 (4차 재산출)** 최대공제안: **연금저축 6,000,000 (월 857,142)** + **IRP 3,000,000 (월 428,571)** + ISA 999,997 (월 **142,856**), 잔차 **14**. 세액공제 1,350,000 / 135,000 / 1,485,000. 미배분 0. 배분안 수 2.

**도출 과정 (잔차)** 계좌마다 `연간액 − floor(연간액 ÷ 7) × 7`을 구해 더한다.

| 계좌 | 연간액 | ÷ 7 | 월액(버림) | ×7 | 잔차 |
|---|---|---|---|---|---|
| 연금저축 | 6,000,000 | 857,142.857… | **857,142** | 5,999,994 | **6** |
| IRP | 3,000,000 | 428,571.428… | **428,571** | 2,999,997 | **3** |
| ISA | 999,997 | 142,856.714… | **142,856** | 999,992 | **5** |
| | | | | | **합 14** |

**4차 개정 사유 — 이 케이스만 잔차가 실제로 늘었다(7 → 14).** 종전에는 연금 9,000,000이 한 계좌였고 9,000,000 ÷ 7의 잔차가 2였다(2 + 5 = 7). S13이 그 9,000,000을 6,000,000과 3,000,000으로 쪼개자 버림이 한 번 더 일어나 6 + 3 = 9가 되고, ISA의 5를 더해 **14**가 된다. **계좌를 더 나누면 잔차가 는다** — 개월수가 12이고 금액이 12의 배수인 다른 케이스(GC-04·GC-09)에서는 새 분할이 나누어떨어져 잔차가 8 그대로였다. 두 부류를 함께 두어야 "잔차가 늘 수도, 안 늘 수도 있다"가 우연이 아님이 고정된다.

**종전 3차 문서의 참고 문장은 이제 본문이 됐다.** 3차까지 "`annuity_savings_first` 안의 잔차는 14"라고 참고로 적어 둔 값이 그것이다. S13이 `max_tax_credit`을 그 안과 같은 순서로 만들었으므로 두 안이 합쳐졌고, 14가 최대공제안 자신의 잔차가 됐다. **잔차를 삼키지 않고 내보내는지가 여전히 요지다**(계약 5.5절).

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-22",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1428571,
      "months_remaining_in_tax_year": 7
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 999997
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "monthly_krw": {
            "annuity_savings": 857142,
            "retirement_pension": 428571,
            "isa": 142856
          },
          "monthly_rounding_residual_krw": 14,
          "unallocated_krw": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

---

## 4. 개정예고 시나리오 케이스

`scenarios: ["current", "proposed"]`. 개정안 시나리오는 `2026.json` + `2027-proposed.json`을 함께 읽고 `bill_stages: ["정부안"]`, 안내 `proposed_not_enacted`(warning)를 낸다.

### 4-0. 4차 — 이 절의 케이스는 **한 건도 바뀌지 않는다.** 이유가 두 가지다

관리자가 "개정안 시나리오는 동점이 아니므로 순서가 바뀌면 안 된다"를 확인 항목으로 지목했다. 재산출 결과 그 요구는 충족되나, **바뀌지 않는 이유가 케이스마다 다르므로 한 덩어리로 묶어 읽으면 안 된다.**

| 케이스 | 개정안에서 동점인가 | 왜 배분이 안 바뀌는가 |
|---|---|---|
| GC-19 개정안분 · GC-19c · GC-23 · GC-26 개정안분 | **아니다** (IRP 15% vs 연금저축 12%) | S13 제2호 — 동점이 아니므로 세액공제 최대화가 순서를 정한다. 종전 경로 그대로 IRP 우선이고, `tie_break`는 `not_applicable`이어야 한다 |
| GC-24 · GC-25 (두 시나리오 모두) · GC-19 확정분 · GC-20 · GC-26 확정분 | **그렇다** | 동점이라 S13이 걸리지만 **연금저축 자기 한도 잔여가 0**이다(연금저축 ytd 6,000,000이 이미 600만원을 채웠다). 먼저 채울 여지가 없으므로 첫 순위가 0을 받고 IRP가 그대로 받는다 |
| GC-19b · GC-23-oracle | 무관 | 월 여력 0이라 배분할 돈이 없다. 인정·공제 계산만 본다 |

**두 번째 줄이 이번 변경의 함정을 하나 드러낸다.** "동점이면 연금저축이 먼저"라는 문장을 "동점이면 연금저축에 돈이 간다"로 잘못 읽으면 GC-24·25에서 연금저축 3,000,000을 기대하게 된다. 그것은 오답이다 — 연금저축 납입액이 이미 600만원이므로 추가분은 `pension.credit.limit.annuity_savings` 단서에 따라 **"없는 것으로" 보아 공제 대상에서 빠지고**, 그러면 공제액이 1,485,000에서 990,000으로 떨어진다. **순서는 한도 안에서만 작동한다.**

### GC-19 — 청년 IRP 우대: 기납입 연금저축이 있는 경우 【D17 전제】

**프로필** 30세 · 총급여 **60,000,000**(공제율 경계 위) · `declared_youth: true` · 월 500,000(예산 6,000,000) · **연금저축 ytd 6,000,000** · IRP ytd 0 · ISA 일반형/누적 0

**기대 결과 — 확정 시나리오** 세액공제 **1,080,000 / 108,000 / 1,188,000** (인정액 9,000,000 × 12%). 배분은 연금 3,000,000 + ISA 3,000,000이든 연금 6,000,000이든 공제액이 같다.

**기대 결과 — 개정안 시나리오** 배분을 **IRP 6,000,000 전액**으로 잡을 때 세액공제 **1,260,000 / 126,000 / 1,386,000**.

**도출 과정** S6: 연금저축 6,000,000(단독 한도 내), IRP 6,000,000 → 합 12,000,000 > 9,000,000 → 초과 3,000,000은 "없는 것으로" 본다. **D17(IRP 우선 인정)**: `IRP인정 = min(6,000,000, 9,000,000) = 6,000,000`, `연금저축인정 = min(6,000,000, 6,000,000, 3,000,000) = 3,000,000`. S7(개정안): 6,000,000 × **0.15**(`proposed.pension.credit.youth_irp_rate`) + 3,000,000 × 0.12(`pension.credit.rate`) = 900,000 + 360,000 = **1,260,000** 소득세, 지방세 126,000.

**핵심** — 추가 IRP 납입은 단순히 잔여 공제한도 3,000,000을 채우는 것이 아니라, **이미 납입된 연금저축분을 공제 대상 풀에서 밀어내 12%짜리 3,000,000을 15%짜리로 바꾼다.** 잔여 공제한도만 보고 IRP를 3,000,000에서 멈추면 공제액이 1,170,000 소득세(총 1,287,000)에 그친다. **차이 99,000원.**

**D17 전제 표시** — 반대 해석(연금저축 우선 인정)이면 `연금저축인정 6,000,000 × 0.12` + `IRP인정 3,000,000 × 0.15` = 720,000 + 450,000 = 1,170,000 소득세가 되고, 추가 IRP 납입의 이점 자체가 사라진다. **이 케이스의 정답은 D17에 의존한다.** 법안 통과 시 재산출 대상이다.

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,260,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다. 확정 1,080,000 · 개정안 1,260,000 둘 다 한도 아래이므로 **청년 우대의 효과가 한도에 가려지지 않는다.** 이 케이스가 보려는 것이 그 효과이므로 가려지면 안 된다.

```golden
{
  "case": "GC-19",
  "request": {
    "scenarios": [
      "current",
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1080000,
            "local_tax": 108000,
            "total": 1188000
          },
          "warning_count": 0,
          "limited_by": {
            "retirement_pension": "credit_limit"
          }
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    },
    "proposed": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 6000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1260000,
            "local_tax": 126000,
            "total": 1386000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-19b — 인정 단계 격리 (배분 없음) 【D17 전제】

**프로필** GC-19와 동일하되 **월 여력 0**, **연금저축 ytd 6,000,000 · IRP ytd 6,000,000**

**기대 결과** 확정 **1,080,000 / 108,000 / 1,188,000**. 개정안 **1,260,000 / 126,000 / 1,386,000**. 인정액 둘 다 9,000,000. 연금 합산 공제 잔여 0.

**도출 과정** 배분을 0으로 묶어 **S6·S7만** 검사한다. 기납입만으로 IRP 6,000,000 + 연금저축 6,000,000이 이미 있으므로 D17 인정 결과는 GC-19의 목표 배분과 같다. **이 케이스가 맞고 GC-19c가 틀리면 결함은 인정 로직이 아니라 배분 탐색에 있다.**

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,260,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-19b",
  "request": {
    "scenarios": [
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "proposed": {
      "limits": {
        "pension_combined_credit_remaining_krw": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1260000,
            "local_tax": 126000,
            "total": 1386000
          },
          "credit_eligible_krw": 9000000,
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-19c — 배분 단계 격리 (ISA 미보유) 【D17 전제】

**프로필** 30세 · 총급여 60,000,000 · `declared_youth: true` · 월 500,000(예산 6,000,000) · **연금저축 ytd 6,000,000** · IRP ytd 0 · **ISA 미보유** · `scenarios: ["proposed"]`

**기대 결과** 최대공제안 배분 **IRP 6,000,000**, ISA 0. 세액공제 **1,260,000 / 126,000 / 1,386,000**.

**도출 과정** GC-19와 같되 ISA라는 대안 목적지를 없애 배분 선택을 좁혔다. 예산 6,000,000을 전부 IRP에 넣는 것이 세액공제를 최대화한다. 연금 납입 잔여 한도는 18,000,000 − 6,000,000 = 12,000,000이므로 6,000,000 납입은 가능하다.

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,260,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-19c",
  "request": {
    "scenarios": [
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": false,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": null,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "proposed": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 6000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1260000,
            "local_tax": 126000,
            "total": 1386000
          },
          "warning_count": 0,
          "limited_by": {
            "retirement_pension": "budget"
          }
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-23 — 청년 IRP 우대: 최대 격차 【D17 전제 · 경계】

**프로필** 30세 · 총급여 60,000,000 · `declared_youth: true` · 월 1,000,000(예산 12,000,000) · **연금저축 ytd 6,000,000** · IRP ytd 0 · ISA 일반형/누적 0 · `scenarios: ["proposed"]`

**기대 결과** 최대공제안 배분 **IRP 9,000,000** + ISA 3,000,000. 세액공제 **1,350,000 / 135,000 / 1,485,000**.

**도출 과정** S6: IRP 9,000,000을 넣으면 `IRP인정 = min(9,000,000, 9,000,000) = 9,000,000`, `연금저축인정 = min(6,000,000, 6,000,000, 0) = 0`. 즉 **기납입 연금저축 6,000,000이 공제 대상에서 전부 밀려나고 합산한도 전액이 15% 대상이 된다.** S7 9,000,000 × 0.15 = **1,350,000**. 잔여 예산 3,000,000은 ISA로.

**이것이 이 구조에서 가능한 최대 격차다.** 잔여 공제한도(3,000,000)만 보고 멈추면 1,170,000 소득세(총 1,287,000)이므로 **차이 198,000원.**

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-23",
  "request": {
    "scenarios": [
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "proposed": {
      "legal_basis": {
        "proposed.pension.credit.youth_irp_rate": {"present":true,"status":"개정예고","bill_stage":"정부안","has_uncertainty_note":true,"uncertainty_note_count":2,"uncertainty_kinds":["unverified","value_absent"],"uncertainty_paths":["age_range","unverified"]}
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 9000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "limited_by": {
            "retirement_pension": "credit_limit",
            "isa": "budget"
          }
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-23-oracle — 위 배분이 실제로 그 공제액을 낳는지 확인

**프로필** GC-23과 동일하되 **월 여력 0**, **IRP ytd 9,000,000 · 연금저축 ytd 6,000,000**

**기대 결과** 세액공제 **1,350,000 / 135,000 / 1,485,000**. 인정액 9,000,000. 연금 합산 공제 잔여 0.

**도출 과정** GC-23이 제안하는 최종 상태(IRP 9,000,000 + 연금저축 6,000,000)를 기납입으로 직접 주어 인정·공제 계산만 확인한다. **이 값이 1,485,000이면 GC-23의 기대값이 도달 가능한 상태임이 증명된다** — 배분 탐색이 그 상태를 못 찾았을 뿐이라는 결론이 성립한다.

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-23-oracle",
  "request": {
    "scenarios": [
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 9000000,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "proposed": {
      "notice_codes": [
        "zero_capacity"
      ],
      "limits": {
        "pension_combined_credit_remaining_krw": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "credit_eligible_krw": 9000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-20 — 청년 미신고: 우대 미적용

**프로필** GC-19와 동일하되 **`declared_youth: null`**

**기대 결과** 확정·개정안 두 시나리오 모두 **1,080,000 / 108,000 / 1,188,000**으로 같다. 안내 `youth_status_not_declared`(info). `proposed.pension.credit.youth_irp_rate`가 `unapplied_proposed_rules`에 `requires_input_not_collected`로 실린다.

**도출 과정** 규칙의 `unverified`가 "'대통령령으로 정하는 청년'의 연령 범위가 미확정이므로 엔진이 청년 여부를 스스로 판정해서는 안 된다"고 정한다. 따라서 나이 30세여도 자기신고가 없으면 우대를 적용하지 않는 것이 맞다. **엔진이 나이로 청년을 추정하면 오답이다.**

**세액 한도 (6차 산출)** 직전연도 총급여 60,000,000의 결정세액 밴드는 S15로 [3,966,133 , 4,812,500]이고 그 안의 **4,300,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 4,300,000이다. 자르기 전 소득세분 1,080,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-20",
  "request": {
    "scenarios": [
      "current",
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1080000,
            "local_tax": 108000,
            "total": 1188000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    },
    "proposed": {
      "notice_codes": [
        "youth_status_not_declared",
        "proposed_not_enacted"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1080000,
            "local_tax": 108000,
            "total": 1188000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

---

## 4-A. 조건부 치환의 양쪽 — M1 수정 이후 추가한 케이스 (2차)

M1 수정은 "추가 IRP 납입이 기납입 연금저축분을 공제 대상 풀에서 밀어낸다"는 **치환**을 배분 탐색에 넣은 것이다. `calc-engine-dev`는 여기에 **"두 공제율이 갈릴 때만 치환한다"**는 조건을 달았다고 보고했다.

그 조건은 필요하다. 두 율이 같으면 치환해도 공제액이 한 푼도 늘지 않는 반면, 자금이 ISA에서 연금계좌로 옮겨 가 **인출 제약만 무겁게 진다.** `pension.withdrawal.eligibility`(55세 + 5년)와 `pension.early_withdrawal.other_income_rate`(연금외수령 기타소득 15%)가 걸리는 자리가 늘어나는데 얻는 것이 없다.

**따라서 조건의 양쪽을 다 봐야 한다.** 치환해야 할 때 안 하면 M1이 그대로고, 치환하면 안 될 때 하면 새로운 해악이 생긴다. 아래 세 건(GC-24·25·26)이 그 조건의 내부·경계·경계+1을 덮는다.

세 건 공통: 30세 · `declared_youth: true` · 예산 12,000,000 · **연금저축 ytd 6,000,000** · IRP ytd 0 · ISA 일반형/누적 0/경과 0 · `scenarios: ["current","proposed"]`

### GC-24 — 조건 밖(두 율이 같음): 총급여 50,000,000원 【경계】

**프로필** 해당연도 총급여 50,000,000 · 직전 52,000,000

**기대 결과** 두 시나리오 모두 공제율 0.15. 개정안의 청년 IRP 우대율도 0.15로 **일반 공제율과 같다.**

| 시나리오 | 기대 배분 | 세액공제 |
|---|---|---|
| 확정 | IRP 3,000,000 + ISA 9,000,000 | 1,350,000 / 135,000 / 1,485,000 |
| 개정안 | **IRP 3,000,000 + ISA 9,000,000** (치환 없음) | 1,350,000 / 135,000 / 1,485,000 |

**도출 과정** S2 50,000,000 ≤ 55,000,000 → 15%. 개정안에서 `proposed.pension.credit.youth_irp_rate`의 0.15와 `pension.credit.rate`의 0.15가 같으므로, IRP를 9,000,000까지 밀어 넣어 연금저축 6,000,000을 밀어내도 인정액 9,000,000 × 0.15 = 1,350,000으로 **공제액이 동일하다.** 치환은 이득이 0이고 6,000,000원을 연금계좌에 추가로 묶는 손해만 남는다. **따라서 치환하지 않는 것이 정답이고, 개정안 배분이 확정 배분과 같아야 한다.**

**4차 — 기대값이 바뀌지 않는다. 다만 `tie_break`는 여기서 처음으로 `withdrawal_flexibility_first`가 된다.** 두 율이 같으므로 이 케이스는 **개정안 시나리오이면서 동점**인 유일한 부류다(GC-25도 같다). S13이 걸리지만 연금저축 자기 한도 잔여가 0이라 배분이 움직이지 않는다(4-0절). **금액이 안 움직인다고 S13이 안 걸린 것은 아니다** — 순서는 적용됐고 받을 몫이 없었을 뿐이다. 이 구분이 GC-26과의 대비를 만든다.

**세액 한도 (6차 산출)** 직전연도 총급여 52,000,000의 결정세액 밴드는 S15로 [2,938,981 , 3,672,500]이고 그 안의 **3,200,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,200,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-24",
  "request": {
    "scenarios": [
      "current",
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3200000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 50000000,
      "prior_year_total_salary_krw": 52000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    },
    "proposed": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "tie_break": "withdrawal_flexibility_first"
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-25 — 조건 경계 정확히: 총급여 55,000,000원 【경계】

**프로필** 해당연도·직전연도 총급여 55,000,000

**기대 결과** GC-24와 같다 — 두 시나리오 모두 15%, **치환 없음**, 배분 IRP 3,000,000 + ISA 9,000,000, 세액공제 1,350,000 / 135,000 / 1,485,000.

**도출 과정** `pension.credit.rate`의 `boundary_rule`이 "이하"이므로 55,000,000원 정확히는 15% 구간이다. 청년 우대율과 같아지는 마지막 지점이다.

**세액 한도 (6차 산출)** 직전연도 총급여 55,000,000의 결정세액 밴드는 S15로 [3,324,163 , 4,100,000]이고 그 안의 **3,600,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,600,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-25",
  "request": {
    "scenarios": [
      "current",
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.15
  },
  "expect": {
    "current": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    },
    "proposed": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "limited_by": {
            "retirement_pension": "credit_limit"
          },
          "tie_break": "withdrawal_flexibility_first"
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-26 — 조건 경계 +1원: 총급여 55,000,001원 【경계】

**프로필** 해당연도·직전연도 총급여 55,000,001

**기대 결과**

| 시나리오 | 기대 배분 | 세액공제 |
|---|---|---|
| 확정 | IRP 3,000,000 + ISA 9,000,000 | 1,080,000 / 108,000 / 1,188,000 |
| 개정안 | **IRP 9,000,000 + ISA 3,000,000** (치환 있음) | **1,350,000 / 135,000 / 1,485,000** |

**도출 과정** S2 55,000,001 > 55,000,000 → 일반 공제율 12%. 개정안에서 IRP만 15%가 되어 **두 율이 갈린다.** 치환하면 `IRP인정 = 9,000,000`, `연금저축인정 = 0` → 9,000,000 × 0.15 = 1,350,000. 치환하지 않으면 3,000,000 × 0.15 + 6,000,000 × 0.12 = 1,170,000. **차이 180,000원(소득세분).**

**GC-25와 GC-26이 이 수정의 조건 그 자체를 1원 단위로 고정한다.** 두 케이스는 개정안 세액공제액이 우연히 같지만(둘 다 1,485,000) **배분이 정반대**다. 금액만 보고 통과시키면 조건이 뒤집혀 있어도 못 잡는다 — 배분을 함께 봐야 한다.

**4차 — 기대값이 바뀌지 않는다. 그리고 이 쌍이 이제 `tie_break`의 경계까지 겸한다.** 55,000,000원(GC-25)에서는 개정안에서도 두 율이 15%로 같아 `tie_break: withdrawal_flexibility_first`이고, 55,000,001원(GC-26)에서는 IRP만 15%가 되어 `tie_break: not_applicable`로 뒤집힌다. **동점 판정의 경계가 공제율 경계와 정확히 같은 자리에 있다는 사실을 1원 단위로 고정하는 유일한 쌍이다.** 배분이 안 바뀌는 것은 두 케이스 모두 연금저축 자기 한도가 이미 소진돼 있기 때문이고(4-0절), 동점 판정 자체는 여기서 갈린다.

**세액 한도 (6차 산출)** 직전연도 총급여 55,000,000의 결정세액 밴드는 S15로 [3,324,163 , 4,100,000]이고 그 안의 **3,600,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 3,600,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다. 확정 시나리오의 자르기 전 금액은 1,080,000이고 개정안은 1,350,000이다. 둘 다 한도 아래다.

```golden
{
  "case": "GC-26",
  "request": {
    "scenarios": [
      "current",
      "proposed"
    ],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000001,
      "prior_year_total_salary_krw": 55000001,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 6000000,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.12
  },
  "expect": {
    "current": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 3000000,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 1080000,
            "local_tax": 108000,
            "total": 1188000
          },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    },
    "proposed": {
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 9000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "limited_by": {
            "retirement_pension": "credit_limit"
          },
          "tie_break": "not_applicable"
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-27 — M2 반대편: 의무가입기간이 남아 있으면 경고가 그대로 나가야 한다 【경계】

**프로필** 40세 · 총급여 45,000,000 · 예산 12,000,000 · ISA 서민형/누적 20,000,000/**경과 2년** · horizon `within_isa_lock_in`

**기대 결과** ISA 의무가입기간 잔여 **1년**. ISA 납입 잔여 **40,000,000**. 배분 **연금저축 6,000,000 + IRP 3,000,000 + ISA 3,000,000**. 세액공제 1,350,000 / 135,000 / 1,485,000. **`early_termination_clawback_isa` 경고가 배분액>0인 ISA에 `warning`으로 나가야 한다.** 비교 안내 `all_accounts_have_early_exit_penalty`도 나간다. **최대공제안의 경고는 4차에 2건 → 3건**(연금저축·IRP·ISA), 배분안 수 2.

**4차 개정 사유** 분할이 바뀌어 연금 경고가 하나 늘었다. **이 케이스의 목적(수정의 과잉 잡기)은 그대로 유효하고, 이번에는 잡을 것이 하나 더 늘었다** — 경고를 계좌 단위로 붙이는 로직이 새로 생긴 두 번째 연금계좌를 빠뜨리지 않는지까지 본다.

**도출 과정** S12 3 − 2 = **1** > 0 → `isa.early_termination.clawback`의 요건("3년이 되는 날 전 해지")이 성립할 수 있다. S8 20,000,000 × (1+2) − 20,000,000 = 40,000,000.

**이 케이스의 목적은 수정의 과잉을 잡는 것이다.** M2 수정이 조건을 좁히면서 잔여 기간이 남은 경우까지 경고를 없앴다면, 사용자는 실제로 지게 될 추징 위험을 고지받지 못한다. **경고를 없애는 수정에서 가장 흔한 실패 방식이다.**

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-27",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "within_isa_lock_in",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 2,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "boundaries": {
        "isa_lock_in_years_remaining": 1
      },
      "limits": {
        "isa_contribution_remaining_krw": 40000000
      },
      "comparison_note_codes": [
        "all_accounts_have_early_exit_penalty"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 3,
          "warning_codes": [
            "early_withdrawal_penalty_pension",
            "early_termination_clawback_isa"
          ]
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-28 — `unknown` horizon + 의무가입기간 경과 【경계】

**프로필** 56세 · 총급여 45,000,000 · 예산 12,000,000 · ISA 서민형/누적 20,000,000/경과 3년 · horizon **`unknown`**

**기대 결과** ISA 잔여 기간 0. **ISA 쪽 `early_termination_clawback_isa`가 `info`로도 나가지 않아야 한다.** 연금 쪽 경고는 `info`로 **2건**(연금저축·IRP) 나간다 — 4차에 1건에서 늘었다. 배분 **연금저축 6,000,000 + IRP 3,000,000 + ISA 3,000,000**, 배분안 수 2. 안내 `fund_use_horizon_not_declared`. 세액공제 1,350,000 / 135,000 / 1,485,000.

**4차 개정 사유** 분할이 바뀌어 연금 경고가 2건이 됐다. **`unknown`에서도 두 계좌 다 붙어야 한다는 것이 요지다** — 등급이 `info`로 낮아질 뿐 걸리는 계좌의 수가 줄어들 이유는 없다. ISA 쪽이 여전히 0건인 것도 그대로다.

**도출 과정** 계약 8.4절이 "`unknown`이면 배분액>0인 계좌 전부에 `info`로 낸다"고 하면서 **"ISA 쪽은 이때도 잔여 의무가입기간 조건이 함께 걸린다"**고 정한다. 세법상으로도 같다 — 사용자가 사용 시점을 밝히지 않았다고 해서 이미 경과한 의무가입기간이 되살아나지는 않는다. 추징 요건이 성립할 수 없으므로 정보 등급으로도 알릴 내용이 아니다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-28",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1970-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "unknown",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 3,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "boundaries": {
        "isa_lock_in_years_remaining": 0
      },
      "notice_codes": [
        "fund_use_horizon_not_declared"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 2,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ]
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "isa_lock_in_already_elapsed"
      ]
    }
  }
}
```

### GC-29 — 의무가입기간은 경과했으나 모든 배분안이 여전히 경고를 진다 【경계, 3차 추가】

M3 수정은 비교 안내 `all_accounts_have_early_exit_penalty`의 조건을 **결과의 사실**로 옮겼다 — "`within_isa_lock_in`이고 **반환된 배분안이 하나도 빠짐없이 `warnings`를 갖고 있을 때**"(계약 8.5절).

**이 케이스가 필요한 이유.** 같은 증상을 고치는 더 손쉬운 방법이 있었다 — "의무가입기간이 경과했으면 안내를 끈다"는 **입력값 기반** 조건이다. GC-21만으로는 두 구현이 구별되지 않는다. 둘 다 안내를 끄기 때문이다. **구별하려면 의무가입기간은 경과했는데 모든 배분안이 여전히 경고를 지는 상황이 필요하다.** 입력값 기반 구현은 여기서 안내를 잘못 끄고, 결과 기반 구현은 옳게 낸다.

**프로필** 40세 · 총급여 45,000,000 · 직전 45,000,000 · 예산 12,000,000 · horizon `within_isa_lock_in` · ISA 서민형/**누적 100,000,000**/**경과 4년**

**기대 결과**

| 항목 | 값 |
|---|---|
| ISA 의무가입기간 잔여 | **0년** |
| ISA 납입 잔여 한도 | **0** (총한도 소진) |
| 배분 (최대공제안) | **연금저축 6,000,000 + IRP 3,000,000** + ISA **0** (`limited_by: contribution_limit`) |
| 미배분 | 3,000,000 |
| 세액공제 | 1,350,000 / 135,000 / 1,485,000 |
| ISA 추징 경고 | **나가지 않는다** (잔여 0년) |
| 연금 중도인출 경고 | **모든 배분안에 나간다** — 4차에 1건 → **2건**(연금저축·IRP) |
| `all_accounts_have_early_exit_penalty` | **나가야 한다** |
| `isa_lock_in_already_elapsed` | 나간다(info) |
| **배분안 수 (4차)** | **1** — `plans_collapsed_single` (2개에서 줄었다. 아래 경고 참조) |

**도출 과정** S8 `isa.contribution.annual_limit` 20,000,000 × (1+4) − 100,000,000 = 0. 총한도 쪽도 0 → ISA에 넣을 수 있는 돈이 없다. 따라서 **어느 배분안이든 자금이 연금계좌로만 간다.** S12 3 − 4 < 0 → 잔여 0 → `isa.early_termination.clawback`의 요건이 성립하지 않아 ISA 경고는 없다. 그러나 `pension.withdrawal.eligibility`(55세 미달)와 `pension.early_withdrawal.other_income_rate`는 그대로 걸리고, 배분액>0인 연금계좌가 모든 안에 있으므로 **모든 안이 경고를 진다.**

**따라서 "어느 배분안도 중도 불이익을 피하지 못한다"는 진술은 참이고, 안내는 나가야 한다.** ISA 쪽 불이익이 사라졌다는 사실과 배분안 전체가 불이익을 피하지 못한다는 사실은 별개다. GC-21과 GC-29는 **의무가입기간 경과라는 같은 입력을 공유하면서 안내의 정답이 반대**다.

**4차 개정 사유 — 그리고 이 케이스가 잃은 것.** 분할이 바뀌어 연금 경고가 2건이 됐고, **배분안이 2개에서 1개로 합쳐졌다.** ISA에 넣을 돈이 0이므로 `isa_first`도 결국 연금계좌만 채우게 되어 세 안의 벡터가 전부 같아졌기 때문이다. 안내와 경고의 정답 자체는 그대로다.

**그러나 배분안이 하나가 되면서 이 케이스의 감별력이 떨어졌다.** GC-29는 3차에서 "안내 조건이 **입력값 기반인가 결과 기반인가**"를 가르려고 만들었고, 그 감별은 **배분안이 둘 이상이어야** 성립한다. 안이 하나뿐이면 "모든 안이 경고를 진다"와 "그 안이 경고를 진다"가 같은 문장이 되어, 잘못 구현된 쪽도 통과할 수 있다. **감별력을 되살리려면 의무가입기간이 경과했는데도 배분안이 둘로 갈리고 그 둘이 모두 경고를 지는 케이스가 필요하다.** 그것이 아래 GC-30이다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다.

```golden
{
  "case": "GC-29",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "within_isa_lock_in",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 100000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "boundaries": {
        "isa_lock_in_years_remaining": 0
      },
      "limits": {
        "isa_contribution_remaining_krw": 0
      },
      "notice_codes": [
        "isa_lock_in_already_elapsed"
      ],
      "comparison_note_codes": [
        "all_accounts_have_early_exit_penalty",
        "plans_collapsed_single"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 2,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ],
          "limited_by": {
            "isa": "contribution_limit"
          },
          "unallocated_krw": 3000000
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-30 — 의무가입기간 경과 + 배분안이 둘로 갈리는데 둘 다 경고를 진다 【경계, 4차 추가】

**왜 필요한가.** 위에서 적은 대로 GC-29가 단일 배분안으로 접혀 감별력을 잃었다. 그 감별을 되살리려면 **ISA에 넣을 돈이 완전히 0은 아니되 남은 예산을 다 받아내지도 못하는** 구간이 필요하다. 그 구간에서만 `isa_first`가 `max_tax_credit`과 다른 벡터를 유지하면서도 연금계좌에 돈을 남겨 경고를 진다.

**구간의 조건** ISA 잔여 한도를 `R`, 예산을 `B`, 연금 합산 공제 잔여를 `C`라 하면 `B − C < R < B`여야 한다. `R ≥ B`면 `isa_first`가 전액 ISA로 가 경고가 사라지고(GC-21이 그 자리다), `R ≤ B − C`면 두 안이 같은 벡터가 되어 합쳐진다(GC-29가 그 자리다). 아래 프로필은 `B = 12,000,000`, `C = 9,000,000`, `R = 5,000,000`으로 `3,000,000 < 5,000,000 < 12,000,000`을 만족한다.

**프로필** 40세 · 총급여 45,000,000 · 직전 45,000,000 · 월 1,000,000(예산 12,000,000) · horizon `within_isa_lock_in` · ISA 서민형/**누적 95,000,000**/**경과 4년**

**기대 결과**

| 항목 | 값 |
|---|---|
| ISA 의무가입기간 잔여 | **0년** |
| ISA 납입 잔여 한도 | **5,000,000** |
| 배분안 수 | **2** (합쳐지지 않는다) |
| 최대공제안 배분 | 연금저축 6,000,000(#1) + IRP 3,000,000(#2) + ISA 3,000,000(#3) |
| 최대공제안 세액공제 | **1,350,000 / 135,000 / 1,485,000** · 잔차 **0** |
| `isa_first` 배분 | ISA 5,000,000(#1, `contribution_limit`) + 연금저축 6,000,000(#2) + IRP 1,000,000(#3) |
| `isa_first` 세액공제 | **1,050,000 / 105,000 / 1,155,000** · `delta_vs_baseline_krw` **−330,000** · 잔차 **12** |
| ISA 추징 경고 | **나가지 않는다** (잔여 0년) |
| 연금 중도인출 경고 | **두 안 모두 2건**(연금저축·IRP, `warning`) |
| `all_accounts_have_early_exit_penalty` | **나가야 한다** |
| `isa_lock_in_already_elapsed` | 나간다(info) |

**도출 과정** S8 `isa.contribution.annual_limit` 산식 쪽 = 20,000,000 × (1 + min(4,4)) − 95,000,000 = **5,000,000**, 총한도 쪽 = 100,000,000 − 95,000,000 = **5,000,000** → 둘 중 작은 값 5,000,000 → S12 3 − 4 < 0 → 잔여 **0년** → `isa.early_termination.clawback`의 요건("3년이 되는 날 전 해지")이 성립하지 않아 ISA 경고 없음.

- **최대공제안** S13 동점 → 연금저축 6,000,000 → IRP 3,000,000(합산 9,000,000 소진) → 남은 3,000,000을 ISA로. 인정액 9,000,000 × 0.15 = 1,350,000. 잔차: 세 금액 모두 12로 나누어떨어지므로 **0**.
- **`isa_first`** ISA를 먼저 5,000,000까지 채우고(잔여 한도에서 멈춘다) 남은 7,000,000을 S13 순서로 연금저축 6,000,000 → IRP 1,000,000. 인정액 = 6,000,000 + 1,000,000 = **7,000,000**(합산 9,000,000 안) → 7,000,000 × 0.15 = **1,050,000**, 지방세 105,000. `delta` = 1,155,000 − 1,485,000 = **−330,000**.
- **`isa_first`의 잔차 12** — ISA 5,000,000 ÷ 12 = 416,666(버림) ×12 = 4,999,992 → 8. 연금저축 6,000,000 → 0. IRP 1,000,000 ÷ 12 = 83,333 ×12 = 999,996 → 4. 합 **12**.
- **비교 안내** 두 안 모두 연금계좌 배분이 양수라 경고를 지므로 "어느 배분안도 중도 불이익을 피하지 못한다"가 참이다 → 안내가 나간다.

**이 케이스가 무엇을 막는가.** (1) 안내 조건을 `isa_lock_in_years_remaining`(입력 파생값)으로 되돌리면 여기서 잘못 꺼진다 — GC-29가 단일 안으로 접힌 뒤 비어 버린 자리를 메운다. (2) `isa_first`가 ISA 잔여 한도를 넘겨 채우면 배분이 틀린다. (3) 두 번째 순위 이후에도 S13이 적용되는지를 본다 — `isa_first`의 연금 몫 7,000,000이 연금저축 6,000,000 + IRP 1,000,000으로 나뉘어야 하고, 순서가 안 걸리면 IRP 6,000,000 + 연금저축 1,000,000이 되는데 **인정액과 세액이 같아 금액으로는 구별되지 않는다.** 배분을 함께 봐야 잡힌다.

**세액 한도 (6차 산출)** 직전연도 총급여 45,000,000의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 안의 **2,400,000**을 골랐다 — 부양가족이 없는 근로자다. 연금계좌에 납입한 적이 없어 되더할 세액공제액은 0이므로 한도는 그대로 2,400,000이다. 자르기 전 소득세분 1,350,000보다 크므로 **자르지 않는다.** 블록의 `notice_codes_absent`가 그 주장을 담는다 — 6차 이전에는 이 케이스가 한도에 대해 아무 주장도 하지 않았다. 유동성 우선안의 자르기 전 소득세분은 1,050,000이므로 그쪽도 자르지 않는다.

```golden
{
  "case": "GC-30",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "within_isa_lock_in",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 95000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "boundaries": {
        "isa_lock_in_years_remaining": 0
      },
      "limits": {
        "isa_contribution_remaining_krw": 5000000
      },
      "notice_codes": [
        "isa_lock_in_already_elapsed"
      ],
      "comparison_note_codes": [
        "all_accounts_have_early_exit_penalty"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 2,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ],
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2,
            "isa": 3
          },
          "monthly_rounding_residual_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 1000000,
            "isa": 5000000
          },
          "tax_credit": {
            "income_tax": 1050000,
            "local_tax": 105000,
            "total": 1155000
          },
          "warning_count": 2,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ],
          "fill_order": {
            "isa": 1,
            "annuity_savings": 2,
            "retirement_pension": 3
          },
          "limited_by": {
            "isa": "contribution_limit"
          },
          "delta_vs_baseline_krw": -330000,
          "monthly_rounding_residual_krw": 12
        }
      },
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

---

## 4-B. 6차 — 세액 한도·연금수령 개시·개시 가능 시점·퇴직급여 입금 (신규 11건)

**이 절의 케이스는 전부 6차에 새로 만들었다.** 기존 36건 중 세액 한도가 실제로 무는 것은 GC-04(잘림)·GC-14(한도 0)·GC-07(되더하기)·GC-09(모름) 넷뿐이고, 그 넷은 다른 축을 보러 만든 케이스에 한도가 얹힌 것이다. **경계에서 오류가 난다** — 절단선의 양쪽과 그 위, 되더하기의 유무, `0`과 `모름`의 갈림은 그것만 보는 케이스가 있어야 닫힌다.

전 케이스 공통: `tax_year: 2026`, 룰셋 `2026.json`, `financial_income_taxpayer_last_3_years: false`.

### GC-31 - 결정세액 0: 한도가 0으로 확정된 사람 【경계 · 6차 추가】

**프로필** 만 40세(1986-06-15) · 해당연도 총급여 45,000,000 · **직전연도 총급여 20,000,000** · 월 750,000 · horizon `at_or_after_pension_age` · 연금 두 계좌 ytd 0 · 개시 `not_started` · ISA 보유/서민형/누적 0/경과 0년 · **직전 과세연도 결정세액 0 · 연금계좌 세액공제액 0**

**결정세액을 0으로 정한 근거 (CD2)** 이 사람은 직전 과세연도에 총급여 20,000,000이었고 부양가족이 둘 있었다. 그 조합에서 산출세액은 근로소득세액공제와 표준세액공제만으로 전부 소진된다 — S15의 밴드 산출을 총급여 20,000,000에 적용하면 상한이 146,750원이고, 여기에 부양가족 2인의 기본공제 3,000,000원(과세표준 −3,000,000 → 세액 −180,000)을 더 빼면 **0 아래로 내려간다.** 이 프로필에서 결정세액 0은 억지로 고른 값이 아니라 흔한 값이다. 연금계좌에 납입한 적이 없으므로 되더할 세액공제액도 0이다.

**기대 결과** 한도 = 0 + 0 = **0**. `pension.credit.tax_liability_cap`의 `effect_when_zero`가 이 경우를 이름으로 지목한다 — "연금계좌에 얼마를 납입하든 그 과세기간의 연금계좌 세액공제액은 0이다."

| 항목 | 값 |
|---|---|
| 자르기 전 소득세분 (= 임계값) | 1,350,000 |
| 세액 한도 | **0** |
| 인정 세액공제 소득세 / 지방세 / 합계 | **0 / 0 / 0** |
| 배분 (최대공제안) | 연금저축 6,000,000 + IRP 3,000,000 · ISA 0 — **한도가 넉넉한 경우와 완전히 같다** |
| 배분안 수 | 2 |
| 안내 | `tax_liability_cap_zero` · `tax_liability_cap_applied` |
| 비교 안내 | `tax_credit_axis_not_discriminating` · `alternatives_have_equal_tax_credit` |

**도출 과정** S1 750,000 × 12 = 9,000,000 → S2 45,000,000 ≤ 55,000,000 이므로 15% → S5 합산 공제한도 9,000,000 → S13 동점이므로 연금저축을 자기 한도 6,000,000까지 먼저 채우고 잔여 3,000,000이 IRP로 → S7 자르기 전 소득세분 9,000,000 × 0.15 = 1,350,000 → **S14 한도가 0이므로 인정액 min(1,350,000, 0) = 0**, 지방세분은 인정된 소득세분에 부가율을 곱하므로 0 × 0.1 = 0.

**배분이 움직이지 않는다는 것이 이 케이스의 절반이다.** 계약 4.2절 `tax_liability_cap_affects.allocation_amounts: false`가 그렇게 선언하고, 근거는 §61 ③이 초과분을 "받지 아니한 것으로" 의제해 시행령 §118의3의 전환 신청 대상으로 남기기 때문이다(`pension.credit.unused.contribution_carryover`). **"한도가 0이면 넣지 마라"는 세법의 결론이 아니다.** 배분을 0으로 만드는 엔진은 조문에 없는 선호를 지어낸 것이 된다.

**`tax_liability_cap_applied`도 함께 나가야 한다.** 계약 8.2절이 그 코드의 조건을 "반환된 배분안 중 하나 이상에서 계산된 세액공제액이 한도에 걸려 잘림"으로 정하고, 한도 0은 1,350,000을 0으로 자른 것이므로 조건을 충족한다. `tax_liability_cap_zero`가 따로 있다는 이유로 이쪽이 꺼진다고 볼 근거가 계약에 없다.

```golden
{
  "case": "GC-31",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 0,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 20000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "legal_basis": {
        "pension.credit.unused.contribution_carryover": {"present":true,"has_uncertainty_note":true,"uncertainty_note_count":2,"uncertainty_kinds":["confidence_not_verified","unverified"],"uncertainty_paths":["confidence","net_contribution_limit_interaction.unverified"]}
      },
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "limits": {
        "pension_combined_credit_limit_krw": 9000000,
        "pension_combined_credit_remaining_krw": 9000000,
        "isa_tax_free_limit_krw": 4000000
      },
      "boundaries": {
        "isa_lock_in_years_remaining": 3,
        "pension_years_remaining": 15
      },
      "notice_codes": [
        "tax_liability_cap_zero",
        "tax_liability_cap_applied"
      ],
      "notice_codes_absent": [
        "tax_liability_cap_unknown"
      ],
      "comparison_note_codes": [
        "tax_credit_axis_not_discriminating",
        "alternatives_have_equal_tax_credit"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          },
          "unallocated_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "delta_vs_baseline_krw": 0
        }
      }
    }
  }
}
```

### GC-32a~c - 한도가 공제액보다 1원 적을 때 / 정확히 같을 때 / 1원 많을 때 【경계 3건 · 6차 추가】

**공통 프로필** 만 40세(1986-06-15) · 해당·직전연도 총급여 45,000,000 · 월 750,000 · horizon `at_or_after_pension_age` · 연금 두 계좌 ytd 0 · 개시 `not_started` · ISA 보유/서민형/누적 0/경과 0년 · 직전 과세연도 **연금계좌 세액공제액 0**. 세 케이스는 **결정세액 한 칸만** 다르다.

**결정세액을 이 구간에서 고른 근거 (CD3)** 자르기 전 소득세분이 1,350,000원이므로 절단선이 거기 있다. 총급여 45,000,000이고 부양가족이 없는 사람의 결정세액 밴드는 S15로 [2,040,224 , 2,675,000]이고 그 구간은 절단선 **위**다 — 그 사람에게는 이 경계가 오지 않는다. 기본공제는 1인당 1,500,000원이고 이 소득이면 한계세율이 15%이므로 부양가족 한 사람마다 세액이 225,000원씩 낮아진다. **부양가족이 셋이면 밴드 하한이 2,040,224 − 675,000 = 1,365,224로 내려와 절단선 바로 위에 선다.** 즉 이 세 케이스의 사람은 총급여 45,000,000에 부양가족 3인인 외벌이이고, 그 사람의 결정세액이 1원 단위로 어디에 놓이느냐가 결과를 가른다. **지어낸 자리가 아니라 실제로 사람이 서 있는 자리다.**

| | 결정세액 | 한도 | 인정 소득세분 | 지방세분 | 합계 | 잘렸는가 |
|---|---|---|---|---|---|---|
| **GC-32a** | 1,349,999 | 1,349,999 | **1,349,999** | **134,999** | **1,484,998** | **예** |
| **GC-32b** | 1,350,000 | 1,350,000 | 1,350,000 | 135,000 | 1,485,000 | **아니오** |
| **GC-32c** | 1,350,001 | 1,350,001 | 1,350,000 | 135,000 | 1,485,000 | **아니오** |

**도출 과정** 세 건 모두 S1~S13이 GC-31과 같아 자르기 전 소득세분이 1,350,000이다. S14의 인정액 = `min(1,350,000, 한도)`.

- **32a** — `min(1,350,000, 1,349,999) = 1,349,999`. 지방세분은 **인정된** 소득세분에 부가율을 곱한다(`local_tax_follows_income_tax_cap`): 1,349,999 × 0.1 = 134,999.9 → **원 미만 버림으로 134,999**. 잘린 금액은 소득세분 1원과 지방세분 1원이다. 지방세분을 자르기 전 값 135,000으로 두면 인정되지 않은 공제에 붙은 지방세가 남는다.
- **32b** — 한도와 공제액이 **같으면 초과분이 없다.** §61 ③은 "합계액이 산출세액을 **초과**하는 경우 그 초과하는 금액"만 없는 것으로 보므로 같은 값에서는 아무것도 밀려나지 않는다. 따라서 `tax_liability_cap_applied`가 **나가면 안 된다** — 이 한 줄이 32a와 32b를 가른다.
- **32c** — 한도가 1원 남는다. 인정액은 공제액 그대로이고 남은 1원은 어디에도 쓰이지 않는다.

**왜 세 건을 다 두는가.** `<`와 `≤`를 뒤집는 오류는 32b에서만 드러난다. 32a만 있으면 "자른다"는 것만, 32c만 있으면 "안 자른다"만 확인된다. 경계는 양쪽과 그 위를 동시에 봐야 닫힌다 — GC-01·02·03이 공제율 경계에서 쓴 것과 같은 형태다.

```golden
{
  "case": "GC-32a",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 1349999,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "notice_codes": [
        "tax_liability_cap_applied"
      ],
      "notice_codes_absent": [
        "tax_liability_cap_zero",
        "tax_liability_cap_unknown"
      ],
      "comparison_note_codes_absent": [
        "tax_credit_axis_not_discriminating"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1349999,
            "local_tax": 134999,
            "total": 1484998
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          },
          "unallocated_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "delta_vs_baseline_krw": -1484998
        }
      }
    }
  }
}
```

```golden
{
  "case": "GC-32b",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 1350000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "tax_liability_cap_zero",
        "tax_liability_cap_unknown"
      ],
      "comparison_note_codes_absent": [
        "tax_credit_axis_not_discriminating"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          },
          "unallocated_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "delta_vs_baseline_krw": -1485000
        }
      }
    }
  }
}
```

```golden
{
  "case": "GC-32c",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 1350001,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "tax_liability_cap_zero",
        "tax_liability_cap_unknown"
      ],
      "comparison_note_codes_absent": [
        "tax_credit_axis_not_discriminating"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          },
          "unallocated_krw": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "delta_vs_baseline_krw": -1485000
        }
      }
    }
  }
}
```

### GC-33 - 되더하기가 순환을 없앤다: 결정세액 0 + 연금계좌 세액공제액 1,350,000 【경계 · 6차 추가】

**프로필** GC-32b와 같은 사람이되 **직전 과세연도에 이미 연금계좌 세액공제를 받아 결정세액이 0으로 내려간 경우**다. `state: "amount"` · 결정세액 **0** · 연금계좌 세액공제액 **1,350,000**.

**이 케이스가 보는 것은 §61 ③ 등식 하나다.** 서식의 결정세액은 `산출세액 − 세액감면 계 − 세액공제 계`이고 **세액공제 계 안에 이미 연금계좌 세액공제가 들어 있다**(`pension.credit.tax_liability_cap.source_form`의 `why_this_avoids_circularity`). 그 값을 그대로 한도로 쓰면 이미 받은 공제만큼 한도가 줄어 보이는 **순환**이 생긴다. 이 사람에게 그 순환이 극단으로 나타난다.

| | 한도 | 인정 소득세분 | 결과 |
|---|---|---|---|
| **되더하기를 하면 (옳음)** | 0 + 1,350,000 = **1,350,000** | 1,350,000 | 자르지 않는다 |
| **되더하기를 빠뜨리면 (틀림)** | 0 | 0 | 공제액이 통째로 0이 된다 |

**차이가 1,485,000원이다.** 그리고 그 오류는 **연금계좌에 꾸준히 납입해 온 사람에게만** 나타난다 — 납입한 적이 없으면 되더할 값이 0이라 두 계산이 같은 답을 낸다. 이 케이스가 없으면 §61 ③ 등식을 아무도 보지 않는다.

**작년에 결정세액이 0이 되는 것이 이상한가.** 아니다. 되더한 한도 1,350,000이 곧 `산출세액 − 감면 − 연금계좌 외 공제`이므로 이 사람은 그 잔여를 연금계좌 세액공제로 **정확히 다 쓴** 사람이다. GC-32b와 같은 프로필(총급여 45,000,000 · 부양가족 3인)에서 작년에도 9,000,000원을 납입했다면 나오는 값이다.

**기대 결과** GC-32b와 **한 원도 다르지 않다** — 1,350,000 / 135,000 / 1,485,000, 자르지 않음. 두 케이스가 같은 답을 내는 것이 이 쌍의 요지다. 같은 한도를 두 가지 방식으로 진술했을 뿐이기 때문이다.

```golden
{
  "case": "GC-33",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 0,
        "pension_credit_applied_krw": 1350000
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "tax_liability_cap_zero",
        "tax_liability_cap_unknown"
      ],
      "comparison_note_codes_absent": [
        "tax_credit_axis_not_discriminating"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          }
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "delta_vs_baseline_krw": -1485000
        }
      }
    }
  }
}
```

### GC-34 - 한도를 모른다 (`state: "unknown"`) 【경계 · 6차 추가】

**프로필** GC-32b와 같은 사람이되 직전 과세연도 세액을 **모른다.** `state: "unknown"` · 두 금액 칸 모두 `null`.

**기대 결과** 한도를 모르면 **자르지 않는다.** 지어낸 한도로 자르면 그 자름 자체가 근거 없는 숫자가 되기 때문이다(`unknown_value_policy.rule` — "사용자가 이 값을 모르면 엔진이 지어내지 않는다"). 따라서 인정액은 자르기 전 값 그대로 1,350,000 / 135,000 / 1,485,000이고 안내 `tax_liability_cap_unknown`이 붙는다. **이 결과는 "이만큼"이 아니라 "최대 이만큼"이다** — 한도가 공제액을 늘리는 경로가 조문에 없으므로 오차는 언제나 과대이거나 같다(`direction_of_error`).

**GC-31과 짝으로 읽어야 한다.** 두 케이스의 차이는 입력 한 칸뿐인데 결과가 0과 1,485,000으로 갈린다. **`0`과 `모름`을 같게 다루면 그중 하나는 반드시 틀린다.**

```golden
{
  "case": "GC-34",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "notice_codes": [
        "tax_liability_cap_unknown"
      ],
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "tax_liability_cap_zero"
      ],
      "comparison_note_codes_absent": [
        "tax_credit_axis_not_discriminating"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0
        }
      }
    }
  }
}
```

### GC-35 - "0은 아니었다"까지만 안다 (`state: "nonzero_amount_unknown"`) 【경계 · 6차 추가】

**프로필** GC-34와 같되 `state: "nonzero_amount_unknown"`. 사용자가 금액은 모르지만 직전 과세연도 결정세액이 0은 아니었다고 답한 경우다.

**이 상태를 왜 따로 두는가.** 6차 조사가 `unknown_value_policy.escape_hatch`로 지목한 대체 신호다 — 금액을 묻는 것보다 답하기 쉽고 **최악의 오류(한도 0인 사람에게 절세액을 제시하는 것)를 걸러낸다.** 다만 크기를 주지 않으므로 **한도는 여전히 모름**이고 결과는 상한이다.

**기대 결과** GC-34와 같다 — 자르지 않고 1,350,000 / 135,000 / 1,485,000, 안내 `tax_liability_cap_unknown`. 두 상태의 차이는 `declared_nonzero`에만 나타나고 그 값은 지금 블록이 실을 수 있는 항목이 아니다(1-A.1절).

```golden
{
  "case": "GC-35",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "nonzero_amount_unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "notice_codes": [
        "tax_liability_cap_unknown"
      ],
      "notice_codes_absent": [
        "tax_liability_cap_applied",
        "tax_liability_cap_zero"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0
        }
      }
    }
  }
}
```

### GC-36 - 연금수령을 개시한 계좌 (`started`) 【경계 · 6차 추가】

**프로필** 만 60세(1966-06-15) · 해당·직전연도 총급여 45,000,000 · 월 750,000 · horizon `at_or_after_pension_age` · **IRP `started` · 연금저축 `not_started`** · 두 계좌 ytd 0 · ISA 보유/서민형/누적 0/경과 0년 · 직전 과세연도 결정세액 2,400,000 · 연금계좌 세액공제액 0

**근거** `pension.contribution.after_annuity_start` — 연금계좌 납입액이 연금보험료로 인정되려면 "연금수령 개시를 신청한 날 이후에는 연금보험료를 납입하지 않을 것"이라는 요건을 갖추어야 한다(시행령 §40의2 ② 2호). 요건을 벗어난 납입은 연금보험료가 아니므로 **세액공제 대상 납입액이 될 수 없다.** 그래서 그 계좌는 배분 대상에서 빠진다.

**두 계좌를 구분하지 않는다.** 6차 조사 13.6.1절이 확인한 것이 이것이다 — 조문이 대상을 "연금계좌"로 쓰고 연금저축계좌와 퇴직연금계좌를 구분하지 않으며, 근퇴법 쪽에 대응하는 별도 제한도 없다. **중도인출이 비대칭이었다고 해서 이 항목도 그럴 것이라고 보면 안 된다.** 이 케이스에서 개시된 쪽을 IRP로 둔 것은 임의이고, 연금저축을 개시된 쪽으로 바꿔도 같은 구조의 답이 나와야 한다.

**기대 결과**

| 항목 | 값 |
|---|---|
| IRP 배분 | **0** (`limited_by: not_eligible`) |
| 연금저축 배분 | 6,000,000 — 자기 한도가 상한이다. IRP가 빠졌다고 합산 한도 9,000,000이 연금저축으로 넘어오지 않는다 |
| ISA 배분 | 3,000,000 (예산 잔액) |
| 세액공제 소득세 / 지방세 / 합계 | **900,000 / 90,000 / 990,000** |
| 배분안 수 | 2 |
| 안내 | `pension_contribution_blocked_annuity_started` |
| 경계 연수 | 연금 잔여 0년 (만 60세) |

**도출 과정** S1 9,000,000 → S3 납입 잔여 18,000,000 → S5 합산 공제한도 9,000,000 → **개시한 IRP는 배분 대상이 아니므로 연금 쪽 상한이 연금저축 자기 한도 6,000,000으로 좁혀진다**(`pension.credit.limit.annuity_savings`) → S13은 순서 문제이고 여기서는 채울 계좌가 하나뿐이라 걸리지 않는다 → 남은 예산 3,000,000이 ISA로(S8 잔여 20,000,000) → S7 6,000,000 × 0.15 = 900,000, 지방세분 90,000 → S14 한도 2,400,000 > 900,000이므로 자르지 않는다.

**이 케이스가 막는 오류는 방향이 정해져 있다.** 개시 여부를 기본값 "아니오"로 접으면 이 사람에게 IRP 납입 3,000,000원과 그에 붙는 세액공제 450,000원을 **없는데 있다고** 제시하게 된다. 6차 조사 13.12절 주의 2가 그 기본값을 명시적으로 금지한 이유다.

```golden
{
  "case": "GC-36",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1966-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "legal_basis": {
        "pension.contribution.after_annuity_start": {"present":true,"status":"확정","bill_stage":null,"has_uncertainty_note":true,"uncertainty_note_count":1,"uncertainty_kinds":["unverified"],"uncertainty_paths":["scope.unverified"]}
      },
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "limits": {
        "pension_combined_credit_limit_krw": 9000000,
        "pension_contribution_limit_remaining_krw": 18000000
      },
      "boundaries": {
        "pension_years_remaining": 0
      },
      "notice_codes": [
        "pension_contribution_blocked_annuity_started"
      ],
      "notice_codes_absent": [
        "pension_annuity_start_unknown",
        "tax_liability_cap_applied"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 0,
            "isa": 3000000
          },
          "tax_credit": {
            "income_tax": 900000,
            "local_tax": 90000,
            "total": 990000
          },
          "warning_count": 0,
          "fill_order": {
            "annuity_savings": 1,
            "isa": 2
          },
          "limited_by": {
            "retirement_pension": "not_eligible"
          },
          "unallocated_krw": 0
        }
      }
    }
  }
}
```

### GC-37 - 개시 여부를 모른다 (`unknown`): 아니오로 접지 않고 보류한다 【경계 · 6차 추가】

**프로필** 만 40세(1986-06-15) · 해당·직전연도 총급여 45,000,000 · 월 750,000 · horizon `at_or_after_pension_age` · **연금저축 `unknown` · IRP `not_started`** · 두 계좌 ytd 0 · ISA 보유/서민형/누적 0/경과 0년 · 직전 과세연도 결정세액 2,400,000 · 연금계좌 세액공제액 0

**근거** 모름은 아니오가 아니다. 아니오로 접으면 연금 수령 중인 사용자에게 납입 가능액을 주게 되고 그 오류의 방향은 **과대**다. 그래서 모름 상태의 처리는 **그 계좌의 배분 보류**이고, 이것은 계약이 새 입력을 선택 필드로 두지 않은 이유이기도 하다(0.5절 (1)).

**기대 결과** 연금저축 배분 **0**, IRP 배분 **9,000,000**(합산 공제한도가 상한), ISA 0. 세액공제는 **1,350,000 / 135,000 / 1,485,000**으로 GC-32b와 같다 — 보류된 것은 한 계좌이지 공제 자체가 아니고, 합산 한도가 계좌를 가리지 않기 때문이다.

**이 케이스가 GC-36과 다른 점.** GC-36에서는 개시된 계좌가 빠지면서 연금 쪽 상한이 연금저축 자기 한도 6,000,000으로 좁혀졌다. 여기서는 남은 계좌가 IRP라 **자기 한도가 없으므로** 합산 한도 9,000,000을 그대로 쓴다. 같은 "한 계좌가 빠진다"인데 결과가 다르고, 그 차이를 만드는 것은 `pension.credit.limit.annuity_savings`가 연금저축에만 걸린다는 사실이다.

**도출 과정** S5 합산 공제한도 9,000,000 → 연금저축 보류 → IRP가 예산 9,000,000 전액을 받는다(S3 납입 잔여 18,000,000이 더 크므로 걸리지 않는다) → S7 9,000,000 × 0.15 = 1,350,000 → S14 한도 2,400,000 > 1,350,000이므로 자르지 않는다.

```golden
{
  "case": "GC-37",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "unknown"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "baseline_plan": "max_tax_credit",
      "notice_codes": [
        "pension_annuity_start_unknown"
      ],
      "notice_codes_absent": [
        "pension_contribution_blocked_annuity_started",
        "tax_liability_cap_applied"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 9000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "fill_order": {
            "retirement_pension": 1
          },
          "unallocated_krw": 0
        }
      }
    }
  }
}
```

### GC-38 - 개시 가능 시점을 나이가 아니라 5년 요건이 정한다 (55세 근처 신규 가입) 【경계 · 6차 추가】

**프로필** 만 54세(1972-06-15) · 해당·직전연도 총급여 45,000,000 · 월 750,000 · **horizon `before_pension_age`** · 연금 두 계좌 `not_started` · **두 계좌 가입일 2026-03-02** · 이연퇴직소득 없음 · ISA 보유/서민형/누적 0/경과 0년 · 직전 과세연도 결정세액 2,400,000

**이 케이스가 잡는 것.** `pension.withdrawal.earliest_start`가 개시 가능 시점을 `max(만 55세가 되는 날, 가입일부터 5년이 되는 날)`로 정한다. 두 요건은 선택이 아니라 병렬이므로 **늦게 충족되는 쪽이 시점을 정한다.**

| | 값 | 근거 |
|---|---|---|
| 만 55세가 되는 날 | **2027-06-15** | 민법 §158 — 나이는 출생일을 산입해 만 나이로 계산한다. 1972-06-15생은 2027-06-15에 만 55세가 된다 |
| 가입일부터 5년이 되는 날 | **2031-03-02** | 국세기본법 §4 → 민법 §160 ② |
| 개시 가능 시점 | **2031-03-02** | 늦은 쪽 |
| 시점을 정한 요건 | **5년 요건** (나이 요건이 아니다) | |
| `pension_years_remaining` | **1** | S12 = max(0, 55 − 54) |

**경계 연수만 보면 이 사람에게 틀린 말을 하게 된다.** `pension_years_remaining`은 1년이라고 말하지만 이 사람의 실질 잠금기간은 **약 4년 2개월**이다. 계약 5.6절이 연금 경고의 `params`에 `earliest_start_date`·`years_until_earliest_start`·`earliest_start_computable`을 함께 싣게 한 이유가 정확히 이것이다 — "나이 요건만으로 만든 문구는 55세에 가까운 사람에게 틀린다."

**기대 결과** 배분·세액공제는 GC-32b와 같다(한도 2,400,000 > 1,350,000이므로 자르지 않는다). 움직이는 것은 horizon이 바꾸는 것들뿐이다 — 기본안이 `isa_first`로 옮겨지고(`baseline_reordered_by_fund_use_horizon`), 최대공제안의 연금 두 계좌에 `early_withdrawal_penalty_pension`이 **두 건** 붙는다. 가입일을 주었으므로 `pension_start_date_not_computable`은 **나가지 않는다.**

**도출 과정** S1~S14는 GC-32b와 같다. S12 `pension.withdrawal.eligibility`의 55세에서 만 54세를 빼 1년. 경고는 계약 8.4절 — 배분액 > 0인 연금계좌 둘, horizon이 `before_pension_age`. ISA 배분이 0이므로 ISA 경고는 성립하지 않는다.

```golden
{
  "case": "GC-38",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1972-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "before_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started",
        "opened_on": "2026-03-02"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started",
        "opened_on": "2026-03-02"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "baseline_plan": "isa_first",
      "boundaries": {
        "pension_years_remaining": 1,
        "isa_lock_in_years_remaining": 3
      },
      "notice_codes_absent": [
        "pension_start_date_not_computable",
        "tax_liability_cap_applied"
      ],
      "comparison_note_codes": [
        "baseline_reordered_by_fund_use_horizon"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 2,
          "is_baseline": false,
          "warning_codes": [
            "early_withdrawal_penalty_pension"
          ],
          "delta_vs_baseline_krw": 1485000
        },
        "isa_first": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 9000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "is_baseline": true,
          "delta_vs_baseline_krw": 0
        }
      }
    }
  }
}
```

### GC-39 - 퇴직급여 입금액은 세액공제 대상이 아니다 【경계 · 6차 추가】

**프로필** 만 58세(1968-06-15) · 해당·직전연도 총급여 45,000,000 · 월 750,000(= 본인이 새로 넣는 돈 9,000,000) · horizon `at_or_after_pension_age` · 연금 두 계좌 `not_started` · **IRP에 퇴직급여 입금액 3,000,000 · 그 계좌에 이연퇴직소득 있음** · ISA 보유/서민형 · 직전 과세연도 결정세액 2,400,000

**근거** `pension.credit.excluded_contributions` — 소득세법 §59의3 ① 1호는 "제146조 제2항에 따라 소득세가 원천징수되지 아니한 퇴직소득 등 과세가 이연된 소득"을 연금계좌 납입액에서 **제외**한다. 계좌 잔액은 늘지만 세액공제 대상 납입액이 아니다. 2호의 계약이전액도 같다.

**기대 결과** 세액공제 대상으로 인정된 납입액은 **9,000,000이지 12,000,000이 아니다.** 세액공제는 1,350,000 / 135,000 / 1,485,000이고, 퇴직급여 3,000,000원은 그 어느 칸에도 들어가지 않는다. 안내 `retirement_transfer_excluded_from_credit`가 붙는다.

**틀리면 얼마나 틀리는가.** 사용자가 퇴직급여 입금액을 "납입 여력"에 섞어 넣으면 인정액이 12,000,000이 되고 — 합산 한도 9,000,000이 그중 9,000,000만 받으므로 이 케이스에서는 공제액이 같아진다. **그래서 이 케이스만으로는 부족하고, 인정액 자체(`credit_eligible_krw`)를 블록에 적어야 검사가 성립한다.** 적어 두었다.

**이 케이스가 일부러 피해 간 것 하나 — 1,800만원 납입한도.** 퇴직급여 입금액이 연간 납입한도를 쓰는지를 룰셋이 정하지 않는다(S17). 이 케이스는 입금액을 3,000,000으로 두어 **두 읽기가 같은 답을 내는 자리**에 세웠다 — 쓰는 쪽이면 잔여 15,000,000, 안 쓰는 쪽이면 18,000,000이고 어느 쪽이든 예산 9,000,000보다 크므로 배분이 같다. 두 읽기가 갈리는 케이스(입금액 18,000,000 이상)는 **판정이 나온 뒤에 만든다.** 근거 없이 한쪽을 정답으로 적으면 그것이 곧 지어낸 정답이다. 그래서 `pension_contribution_limit_remaining_krw`도 이 블록에 적지 않았다.

```golden
{
  "case": "GC-39",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1968-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 2400000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 45000000,
      "prior_year_total_salary_krw": 45000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started",
        "retirement_transfer_in_krw": 3000000,
        "has_deferred_retirement_income": true
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "boundaries": {
        "pension_years_remaining": 0
      },
      "notice_codes": [
        "retirement_transfer_excluded_from_credit"
      ],
      "notice_codes_absent": [
        "tax_liability_cap_applied"
      ],
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 6000000,
            "retirement_pension": 3000000,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 1350000,
            "local_tax": 135000,
            "total": 1485000
          },
          "warning_count": 0,
          "credit_eligible_krw": 9000000,
          "fill_order": {
            "annuity_savings": 1,
            "retirement_pension": 2
          }
        }
      }
    }
  }
}
```

---

## 5. 경계값 커버리지 점검

| 요구된 경계 | 케이스 |
|---|---|
| 공제율이 바뀌는 총급여 경계 — 정확히 / −1원 / +1원 | GC-01 · GC-03 · GC-02 |
| 한도를 정확히 채우는 경우 | GC-04 · GC-11 |
| 한도를 넘기는 경우 | GC-04 · GC-09 · GC-13 |
| 기납입액이 이미 한도를 초과 | GC-07 · GC-15 · GC-17 |
| 월 납입 여력 0 | GC-08 |
| ISA 만기·중도해지 관련 경계 | GC-15~17(만기 전환) · GC-21(의무가입기간 경과) · GC-18a(기간 내) |
| `fund_use_horizon` 네 값 | GC-18a · b · c · d |
| 개정예고 시나리오(청년 IRP 우대) | GC-19 · 19b · 19c · 20 · 23 · 23-oracle |
| ISA 서민형 소득 경계 정확히 / +1원 | GC-05 · GC-06 |
| ISA 한도 산식의 경과연수 4년 상한 | GC-10 |
| ISA 총 납입한도 축소(재형저축) | GC-12 |
| 연령 자격 경계 | GC-14 · GC-21 |
| 월 반올림 잔차 | GC-22 · GC-04 |
| **조건부 치환의 조건 경계** — 두 율이 같음 / 정확히 경계 / 경계 +1원 (2차) | GC-24 · GC-25 · GC-26 |
| **중도해지 경고 조건의 양쪽** — 잔여 1년(경고 유지) / 잔여 0년(경고 소멸) (2차) | GC-27 · GC-21 |
| **`unknown` horizon × 의무가입기간 경과** (2차) | GC-28 |
| **비교 안내 조건이 입력 기반인가 결과 기반인가** — 같은 입력, 반대 정답 (3차) | GC-21 · GC-29 · **GC-30** |
| **동점 구간의 충당 순서** — 연금 배분 총액이 연금저축 자기 한도와 **같음** / **넘음** (4차) | GC-05 · GC-06 · GC-14 (같음 → IRP 0) · GC-01 외 다수 (넘음 → 잔여가 IRP로) |
| **⚠ 덮지 못한 구간 (4차)** — 연금 배분 총액이 자기 한도보다 **작고** 연금저축 자기 한도 잔여가 **남아 있는** 경우(예: 예산 4,000,000 → 연금저축 4,000,000 · IRP 0) | **없음.** 현재 케이스의 "IRP 0"은 전부 총액이 6,000,000과 정확히 같은 경계에서 나온다. 산식이 `min(총액, 자기 한도 잔여)`라 경계가 내부를 함의하지만, 그것은 산식을 전제한 논증이지 관측이 아니다 |
| **동점 판정의 경계** — 동점 / 동점 아님이 1원에서 갈림 (4차) | GC-25 · GC-26 |
| **동점인데 배분이 안 움직이는 경우** — 연금저축 자기 한도가 이미 소진 (4차) | GC-19 확정분 · GC-20 · GC-24 |
| **잔차가 늘어나는 분할 / 안 늘어나는 분할** (4차) | GC-22(7→14) · GC-04·GC-09(8 불변) |
| **배분안 합치기의 경계** — ISA 잔여 `R`과 예산 `B`·연금 공제잔여 `C`의 관계 (4차) | `R ≥ B`: GC-21 · `B−C < R < B`: **GC-30** · `R ≤ B−C`: GC-29 |
| **세액 한도가 0** (6차) | **GC-31**(`state: amount`, 결정세액 0) · **GC-14**(`state: zero`) — 두 진술 형태 모두 |
| **한도가 자르기 전 공제액보다 1원 적음 / 정확히 같음 / 1원 많음** (6차) | **GC-32a** · **GC-32b** · **GC-32c** |
| **한도가 무는 실제 케이스** — 다른 축을 보던 케이스 위에서 (6차) | **GC-04**(잘림 50,000) |
| **되더하기(§61 ③ 등식)가 결과를 바꾸는 경우** (6차) | **GC-33**(결정세액 0 + 공제액 1,350,000) · **GC-07**(결정세액 1,050,000 + 공제액 1,350,000) |
| **한도를 모름** — `unknown` / `nonzero_amount_unknown` (6차) | **GC-34** · **GC-35** · GC-09 |
| **지방세분이 인정된 소득세분을 따라간다** — 원 미만 버림이 걸리는 자리 (6차) | **GC-32a**(134,999) |
| **연금수령 개시** — `started` / `unknown` (6차) | **GC-36**(IRP 개시 → 상한이 연금저축 자기 한도로 좁혀짐) · **GC-37**(연금저축 모름 → 보류, 상한은 합산 한도) |
| **개시 가능 시점을 5년 요건이 정하는 경우** (6차) | **GC-38**(만 54세 신규 가입 — `pension_years_remaining` 1년, 실질 잠금 4년 2개월) |
| **가입일 미입력** — 시점을 계산하지 않음 (6차) | GC-01 외 `opened_on`을 주지 않은 전 케이스 (`pension_start_date_not_computable`) |
| **퇴직급여 입금액** — 세액공제 대상이 아님 (6차) | **GC-39**(`credit_eligible_krw` 9,000,000, 12,000,000이 아님) |
| **⚠ 덮지 못한 구간 (6차)** — 퇴직급여 입금액이 **1,800만원 납입한도를 쓰는가**로 답이 갈리는 자리 | **없음.** S17이 답을 내지 못했으므로 두 읽기가 갈리는 케이스(입금액 18,000,000 이상)를 만들지 않았다. 판정이 나오면 그때 만든다 |
| **⚠ 덮지 못한 구간 (6차)** — ISA 연령 요건의 기준일이 **과세기간 종료일과 가입 시점 사이에서 갈리는** 사람(그 과세연도 중에 19세가 되는 사람) | **없음.** 계산 시점이 요청에 없어 엔진이 낼 수 있는 답이 하나뿐이다. 8절 (가) 참조 |
| **공제율 판정 축이 총급여인 경우** — 1단계를 명시적으로 '아니오'로 답한 케이스 (12차) | **GC-40**(경계 정확히) · **GC-41** · **GC-42** |
| **환산 방식이 틀리는 구간** — 순수 근로소득자인데 근로소득금액이 4,500만원 이하 (12차) | **GC-41**(56,000,000 · 구간 안쪽) · **GC-42**(57,631,578 · **구간의 위쪽 끝**) |
| **공제율 판정 축이 종합소득금액인 경우** — 경계 −1원 / 정확히 / +1원 (12차) | **GC-45** · **GC-43** · **GC-44** |
| **총급여 축과 종합소득금액 축이 서로 다른 답을 내는 자리** (12차) | **GC-44**(총급여로는 15%, 종합소득금액으로는 12% — 25% 과대 결함의 지점) · **GC-46**(총급여로는 15%, 대체값으로는 12%) |
| **종합소득금액을 모를 때의 대체값과 그 표시** (12차) | **GC-46**(`credit_rate_global_income_missing`을 `notice_codes`에, GC-40 ~ GC-45는 같은 코드를 `notice_codes_absent`에 — 양방향) |
| **새 배분안의 인정액 경계** `max(C, L − (K − C))` — 아래 / 정확히 / 위 / 극단 (12차) | **GC-48**(S=12,000,000) · **GC-47**(S=15,000,000, 손실 0) · **GC-49**(S=16,000,000, 손실 165,000) · **GC-50**(S=18,000,000, 손실 495,000) |
| **새 배분안이 다른 안과 갈리는 경우 / 합쳐지는 경우** (12차) | 갈림: **GC-47 · GC-48 · GC-50 · GC-51**(배분안 3 또는 4) · 합쳐짐: **GC-49**(납입 잔여가 1차에서 다 소진되어 2차가 없다 → 배분안 2) |
| **개정안 청년 우대 × 새 배분안** — 1차 순서가 뒤집히는 자리 (12차) | **GC-51**(확정 연금저축 우선 / 개정안 IRP 우선, 2차는 양쪽 다 연금저축) |
| **배분안이 넷 전부 갈리는 입력** (12차) | **GC-51 개정안분** — 계약 10절이 "4를 전제로 레이아웃을 짜라"고 적은 상황 |
| **⚠ 덮지 못한 구간 (12차)** — 새 배분안이 **연금저축 배분으로** 경계를 넘기는 입력 | **없음.** 그 안의 1차는 IRP가 받을 수 있는 한 `K − C`를 정확히 채우므로 `S`가 경계를 넘지 않는다. 넘는 케이스(GC-49·GC-50)의 초과분은 **기납입 또는 계좌 폐쇄**에서 왔다. **경계 초과가 이 배분안 자체로는 일어나지 않는다는 것이 산출 결과이지, 케이스를 못 만든 것이 아니다** |
| **⚠ 덮지 못한 구간 (12차)** — 전환 추가한도가 붙어 `K`가 12,000,000이 되고 경계가 12,000,000으로 내려가는 자리 | **없음.** GC-15 ~ GC-17이 전환을 다루나 셋 다 연금 공제 잔여가 0이라 새 배분안이 다른 안과 갈리지 않는다. `K`의 변동이 경계를 옮기는 것을 실제로 보는 케이스는 다음 회차 |

---

## 6. 4차 재산출 — 무엇이 움직였고 무엇이 움직이지 않았나

### 6.1 움직인 21건

세법·룰셋·계약 0.4절에서 독립 산출한 결과다. **`calc-engine-dev`의 자기확인이 지목한 11건(GC-04·09·10·11·12·13·18a~d·22)보다 10건이 많다.**

**21건 전부에서 연금 배분의 분할이 바뀌고, 그 결과 배분안의 개수도 함께 바뀐다.** 동점이면 `max_tax_credit`이 `annuity_savings_first`와 같은 순서가 되어 두 안이 합쳐지기 때문이다(S13-가). 아래 표는 **분할·배분안 수 위에 무엇이 더 움직이는가**로 나눈 것이다.

| 분할·배분안 수 외에 더 움직이는 것 | 케이스 | 건수 |
|---|---|---|
| 없음 — 분할과 배분안 수만 | GC-01 · 02 · 03 · 05 · 06 · 10 · 12 · 18c | 8 |
| 배분안이 **하나로 합쳐진다**(`plans_collapsed_single` 신규 출현) | GC-04 · 09 · 11 · 13 · 14 · 29 | 6 |
| **경고 건수 +1**(연금계좌가 둘이 되어 연금 경고가 2건) | GC-18a · 18b · 18d · 21 · 27 · 28 | 6 |
| **월 반올림 잔차 7 → 14** | GC-22 | 1 |
| **합계** | | **21** |

**세액공제액이 움직인 케이스는 0건이다.** 한도가 움직인 케이스도 0건이다.

**"움직였다"의 기준을 밝힌다.** 3차까지의 문서는 확정 시나리오 케이스에서 **분할을 기대값으로 적지 않았다**(당시 머리말이 그 이유를 적어 두었다 — 세법이 정하지 않으므로 공제액·한도만 고정했다). 그러므로 위 21건 중 상당수는 "문서에 적힌 숫자가 틀렸다"가 아니라 **"문서가 비워 둔 자리에 이제 값이 들어간다"**이다. 다만 3차까지의 **도출 과정 서술**은 `IRP인정 9,000,000, 연금저축 0`처럼 IRP 우선을 전제로 쓰여 있었고, 그 서술은 이제 사실과 다르므로 케이스마다 고쳤다. 배분안 수도 3차까지 기록하지 않았으므로 이번에 처음 기대값으로 적는다.

### 6.2 검산 — 공제 총액 불변 (36건)

관리자가 지목한 불변식이다. S13은 인정액이 정해진 **뒤**의 분할만 바꾸므로 공제액에 닿을 수 없고, 실제로 36건 전건에서 3차 문서에 기록된 값과 한 원도 다르지 않다.

| 값 | 케이스 |
|---|---|
| 1,485,000 | GC-01 · 03 · 04 · 07 · 09 · 10 · 11 · 12 · 13 · 18a~d · 21 · 22 · 23 · 23-oracle · 24 · 25 · 26(개정안) · 27 · 28 · 29 · **30(최대공제안)** |
| 1,188,000 | GC-02 · 19(확정) · 19b(확정) · 20 · 26(확정) |
| 1,386,000 | GC-19(개정안) · 19b(개정안) · 19c |
| 990,000 | GC-14 |
| 792,000 | GC-05 · 06 |
| 1,980,000 / 1,320,000 / 1,782,000 | GC-15 / 16 / 17 |
| 0 | GC-08 |

한도도 전부 불변이다 — GC-10의 ISA 잔여 70,000,000, GC-11의 0, GC-12의 60,000,000, GC-15·16·17의 전환 추가한도 3,000,000 / 1,000,000 / 1,800,000이 그대로다.

### 6.3 움직이지 않은 14건 — 이유가 세 갈래다

**"안 바뀐다"를 한 덩어리로 읽으면 안 된다.** 이유가 다르면 다음에 무언가 바뀔 때 반응도 다르다.

| 이유 | 케이스 | 다음에 무엇이 이 결론을 흔드는가 |
|---|---|---|
| **동점이 아니다** — 세액공제 최대화가 순서를 정한다 | GC-19(개정안) · 19c · 23 · 26(개정안) | D17 재검토, 청년 우대 연령 범위 확정 |
| **연금계좌에 갈 돈이 없다** — 한도 소진·여력 0·전환금액이 한도를 채움 | GC-07 · 08 · 15 · 16 · 17 · 19b · 23-oracle | 한도 규칙 개정 |
| **동점이지만 연금저축 자기 한도 잔여가 0** | GC-19(확정) · 20 · 24 · 25 | `pension.credit.limit.annuity_savings`의 600만원 변경 |

---

## 6.4 5차 — 블록으로 옮기면서 새로 정한 것

블록의 `expect`에 적힌 값은 **전부 위 산문·표에서 가져온 것이다.** 엔진을 돌려 나온 값을 옮겨 적은 항목은 하나도 없다. 다만 옮기는 과정에서 두 종류의 빈칸이 드러났고, 그 처리 방식을 여기에 남긴다. 이것을 적어 두지 않으면 다음 검증자가 블록의 어느 값이 세법에서 나왔고 어느 값이 케이스 설계에서 나왔는지 구별하지 못한다.

### (가) 요청(입력)의 빈칸 — 산문이 프로필에 적지 않은 필드

`request`는 기대값이 아니라 **케이스의 정의**다. 산문이 명시하지 않은 필드는 이 절에서 고정한다. 고른 기준은 하나다 — **그 케이스가 보려는 것 외의 안내·경고가 새로 생기지 않는 값.**

| 필드 | 산문이 비워 둔 케이스 | 고른 값 | 이유 |
|---|---|---|---|
| `fund_use_horizon` | GC-01 외 horizon을 다루지 않는 전 케이스 | `at_or_after_pension_age` | 이 값에서만 중도 불이익 경고가 한 건도 성립하지 않는다(`pension.withdrawal.eligibility`·`isa.early_termination.clawback`의 요건이 걸리지 않음). 산문이 경고를 적지 않은 케이스의 `warning_count: 0`은 **그렇게 고른 입력의 결과**이지 별도 산출이 아니다 |
| `prior_year_total_salary_krw` | GC-07·08·09·10·11·12·13·15·17·18a~d·22·27·28 | 해당연도 총급여와 같은 값 | S9(ISA 유형)만 쓰는 값이고, 아래 `account_type`과 짝을 맞춰 충돌 경고가 나지 않게 했다 |
| `accounts.isa.account_type` | 위와 같은 케이스 | 직전연도 소득 판정과 **일치하는** 유형(45,000,000 → `low_income`, 60,000,000 → `general`) | 어긋나면 `isa_type_conflicts_with_prior_income`이 붙어 GC-06이 보려는 것과 뒤섞인다 |
| `accounts.isa.cumulative_contribution_krw` · `years_since_opening` | GC-05·06·08·13·18a~d·22 | 0 · 0 | 산문이 ISA 한도를 다루지 않는 케이스다. 0/0이면 S8이 20,000,000으로 단순해져 다른 케이스의 결론을 끌어오지 않는다 |
| `isa_transfer.prior_multi_year_applied_extra_credit_krw` | GC-15·16·17 | 넣지 않음 | 개정안 시나리오 전용 필드이고 이 세 건은 확정 시나리오만 돌린다 |

### (나) 기대값의 빈칸 — 표가 다루지 않아 산식에서 새로 산출한 항목

**필수 항목(`allocation`·`tax_credit`·`warning_count`)을 채우려면 표에 없는 값을 산출해야 하는 자리가 있었다.** 아래가 전부다. 각 항목의 근거를 붙인다.

| 케이스 | 새로 산출한 값 | 산출 근거 |
|---|---|---|
| GC-18a~d `isa_first` | 배분 ISA 12,000,000 · 연금 0, 세액공제 **0 / 0 / 0** | 표는 이 안의 **경고 건수만** 적었으나 블록의 필수 항목이 배분·공제액을 함께 요구한다. S8로 ISA 잔여 20,000,000 > 예산 12,000,000이므로 ISA가 예산 전액을 받고 연금계좌에 갈 돈이 0이다. 연금 납입이 0이고 기납입도 0이므로 S6 인정액 0 → S7 공제액 0 |
| GC-20 (두 시나리오) | 배분 IRP 3,000,000 + ISA 3,000,000, 연금저축 0 | 4-0절 두 번째 줄이 이 케이스를 "동점이지만 연금저축 자기 한도 잔여가 0"으로 분류한다. 연금저축 ytd 6,000,000이 자기 한도를 채웠으므로 S13의 첫 순위가 0을 받고, 합산 잔여 3,000,000이 IRP로 간다. 남은 예산 3,000,000은 ISA로 |
| GC-23-oracle | 배분 0 / 0 / 0, 안내 `zero_capacity` | 월 여력 0이므로 S1 예산 0이다(GC-08과 같은 근거) |
| GC-08 | 배분안 **1** | 예산이 0이라 세 안의 배분 벡터가 전부 0으로 같다 → 계약 6.2절로 합쳐진다. 산문의 `plans_collapsed_single`이 이미 같은 사실을 적고 있다 |
| GC-15·16·17 | 배분안 **1** · 배분 ISA 12,000,000 | 산문이 "배분안도 종전대로 하나로 합쳐진다"고 적었고, 합쳐진다는 것은 세 안의 벡터가 같다는 뜻이다. 연금 합산 공제 잔여가 0이므로 그 벡터는 예산 전액이 ISA로 가는 것 하나뿐이다 |
| GC-05·06·14 | `fill_order` 연금저축 = 1 | S13이 동점 구간의 첫 순위를 연금저축으로 정한다. 배분액이 0인 계좌는 `fill_order`가 `null`이므로(계약 5.5절) IRP·ISA는 적지 않았다 |
| GC-24 개정안분 | `tie_break: withdrawal_flexibility_first` | 산문이 이 케이스에서 그 값이 된다고 명시한다. GC-25의 블록과 같은 자리(개정안 시나리오)에 적었다 |

**적을 근거가 없어 비워 둔 항목도 남긴다.** 넣지 않은 것이 지어내는 것보다 낫다는 판단이다.

- **`tie_break`** — 산문이 값을 명시한 GC-24·25·26 외에는 적지 않았다. 확정 시나리오의 동점 케이스가 `withdrawal_flexibility_first`를 실을 것으로 보이지만, 산문이 그렇게 적은 적이 없고 계약 5.6절도 확정 시나리오의 표기를 따로 정하지 않는다.
- **GC-14의 ISA 비과세 한도 `null`** — 표는 `null`이라고 적었으나 `limits`에 넣지 않았다. 블록 형식이 `null`을 "값이 없음"으로 볼지 "값이 `null`임"으로 볼지가 1-A절에 없다.
- **GC-28의 `isa_lock_in_already_elapsed`** — 계약 8.2절이 이 코드의 조건을 `fund_use_horizon`이 `within_isa_lock_in`인 경우로 한정하는데 GC-28의 horizon은 `unknown`이다. 나가는지 안 나가는지를 산출할 근거가 없어 `notice_codes`·`notice_codes_absent` 어느 쪽에도 적지 않았다.
- **`isa_first`·`annuity_savings_first`의 값 일반** — 표가 다룬 GC-18a~d(경고 건수)와 GC-30(배분·공제액·잔차) 외에는 적지 않았다. 배분안 수는 `plan_count`로 고정했으므로 합쳐짐 여부는 그것으로 검사된다.

---

## 7. 6차 재산출 — 무엇이 움직였고 무엇이 움직이지 않았나

### 7.1 이 회차가 닫은 결함

5차의 머리말이 스스로 적어 둔 것이 이번 일의 정의다.

> 지금 36건이 깨지지 않은 것은 엔진이 아직 이 규칙을 읽지 않기 때문이지 기대값이 맞아서가 아니다. **골든 케이스와 엔진이 같은 누락을 공유하고 있어서 대조가 그 누락을 잡아내지 못한다.**

교차검증의 값어치는 독립성에서 나온다. 양쪽이 같은 것을 빠뜨리면 대조는 그 빠뜨림을 통과시킨다. 그래서 이번 회차는 **엔진이 세액 한도를 구현했다는 사실을 확인한 뒤에 기대값을 다시 산출한 것이 아니라, 세법에서 다시 산출한 값을 적고 나서 돌렸다.** 순서가 바뀌면 이 장치는 다시 무의미해진다.

### 7.2 요청이 47건 전부 바뀌었다

계약 `4.0.0`이 요청 형태를 바꿨으므로 블록의 `request`는 한 건도 예외 없이 손을 댔다.

| 무엇 | 몇 건 | 무엇으로 |
|---|---|---|
| `profile.age_years` 제거 → `profile.birth_date` | 47 | 만 40세 → `1986-06-15`, 만 14세 → `2012-06-15`, 만 56세 → `1970-06-15`, 만 30세 → `1996-06-15`, 만 60세 → `1966-06-15`, 만 54세 → `1972-06-15`, 만 58세 → `1968-06-15`. **모두 과세기간 종료일에 그 나이가 되도록 골랐다** — 케이스가 보려는 것을 바꾸지 않기 위해서다 |
| `profile.prior_year_tax` 추가 | 47 | 2절 S15의 규칙으로 케이스마다 정하고 근거를 각 케이스에 적었다 |
| `accounts.*.annuity_start_status` 추가 | 47 | 개시를 다루는 GC-36·37 외에는 전부 `not_started`. 기본값이 없는 필수 필드이므로 **비워 둘 수 없고, 무엇으로 채웠는지가 곧 케이스의 정의다** |
| `accounts.*.opened_on` 추가 | 1 | GC-38만. 나머지는 주지 않았고 그 결과 `pension_start_date_not_computable`이 나간다 |
| `accounts.retirement_pension.retirement_transfer_in_krw` 추가 | 1 | GC-39만 |

### 7.3 기대 금액이 움직인 것은 2건뿐이다

| 케이스 | 종전 | 6차 | 왜 |
|---|---|---|---|
| **GC-04** | 1,350,000 / 135,000 / 1,485,000 | **1,300,000 / 130,000 / 1,430,000** | 한도 1,300,000이 자르기 전 1,350,000을 자른다. 배우자를 부양하는 총급여 40,000,000 외벌이 |
| **GC-14** | 900,000 / 90,000 / 990,000 | **0 / 0 / 0** | 직전 과세기간 근로소득이 없어 결정세액이 0이고 되더할 공제액도 0이므로 한도가 0이다 |

**나머지 45건의 금액은 한 원도 움직이지 않았다.** 이유는 회피가 아니라 산출 결과다 — S15의 밴드가 보여 주듯 **부양가족이 없는 근로자에게는 이 소득대에서 한도가 거의 물지 않는다.** 그 사실을 확인한 것도 이번 회차의 산출물이다. 45건을 억지로 자르려면 그 케이스의 사람을 다른 사람으로 바꿔야 하고, 그것은 케이스가 보려던 것을 지우는 일이다.

### 7.4 금액은 안 움직였지만 **주장이 늘어난 것은 47건 전부다**

이것이 4차·5차와 다른 점이다. 종전 블록은 한도에 대해 **아무 말도 하지 않았다.** 이번에 47건 전부가 다음 중 하나 이상을 명시적으로 주장한다.

| 주장 | 케이스 수 | 어떻게 |
|---|---|---|
| **이 케이스는 잘리지 않는다** | 43 | `notice_codes_absent: ["tax_liability_cap_applied"]` |
| **이 케이스는 잘린다** | 4 | `notice_codes: ["tax_liability_cap_applied"]` — GC-04 · 14 · 31 · 32a |
| **한도가 0으로 확정됐다** | 2 | `notice_codes: ["tax_liability_cap_zero"]` — GC-14 · 31 |
| **한도를 모른다** | 3 | `notice_codes: ["tax_liability_cap_unknown"]` — GC-09 · 34 · 35 |
| **세액공제로는 배분안이 갈리지 않는다** | 2 | `comparison_note_codes: ["tax_credit_axis_not_discriminating"]` — GC-14 · 31 |
| **개시 상태가 배분을 바꾼다** | 2 | GC-36 · 37 |
| **퇴직급여 입금액은 인정액에 들어가지 않는다** | 1 | GC-39의 `credit_eligible_krw: 9000000` |

**`notice_codes_absent`가 이번 회차의 알맹이다.** 없는 것을 주장하지 않으면 "잘리지 않았다"는 사실은 검사되지 않는다 — 엔진이 한도를 아예 읽지 않아도 결과가 같기 때문이다. **5차까지의 36건이 정확히 그 상태였다.**

### 7.5 검산 — 세액 한도는 배분을 바꾸지 않았다

계약 4.2절 `tax_liability_cap_affects.allocation_amounts: false`가 스스로 선언한 성질이다. 47건 전건에서 확인했다.

- **배분·`limited_by`·`fill_order`·미배분액·월 반올림 잔차가 종전 값 그대로다.** 금액이 움직인 GC-04·14에서도 배분은 한 원도 다르지 않다.
- **배분안 수와 기본안도 그대로다.** 한도가 0인 GC-14·31에서도 `plans`가 합쳐지거나 기본안이 `isa_first`로 옮겨 가지 않는다 — 계약 5.12절이 그것을 하지 않기로 한 판단과 일치한다.
- 근거는 §61 ③이 초과분을 "받지 아니한 것으로" 의제하고 시행령 §118의3이 그 납입액을 이후 과세기간으로 전환 신청할 수 있게 하기 때문이다. **잘린 것은 공제액이고 납입액은 살아 있다.**

### 7.6 실행 결과

`node --test "src/engine/*.test.mjs"` — **전건 통과.** 골든 케이스 47건 + 형식·커버리지 검사 2건 = 49건이 통과했고, 이 문서가 세법에서 산출한 기대값과 엔진의 출력 사이에 **불일치가 0건**이다.

**이 초록색을 5차의 초록색과 같게 읽으면 안 된다.** 5차의 통과는 "양쪽이 같은 것을 빠뜨렸다"로도 설명되는 통과였고, 이번 통과는 그렇지 않다. 근거 셋을 적는다.

1. **기대값이 먼저 움직였다.** GC-04는 1,430,000을, GC-14는 0을, GC-32a는 1,484,998을 이 문서가 먼저 적었고 엔진이 거기에 맞았다. 특히 GC-32a의 지방세분 134,999는 **인정된 소득세분에 부가율을 곱하고 원 미만을 버린** 결과여야만 나오는 값이라, 자르기 전 금액에 곱했거나 반올림했으면 여기서 어긋난다.
2. **경계의 양쪽과 그 위를 모두 적었다.** GC-32a·b·c가 1원 간격으로 서 있으므로 `<`와 `≤`를 뒤집는 오류는 32b에서 반드시 드러난다.
3. **되더하기가 결과를 바꾸는 자리를 만들었다.** GC-33과 GC-07은 되더하기를 빠뜨리면 각각 1,485,000원과 330,000원이 사라진다. 두 케이스가 통과했다는 것은 §61 ③ 등식이 실제로 구현되어 있다는 뜻이다.

**그래도 이 통과가 덮지 못하는 것을 함께 적는다.** 1-A.1절의 넷(자르기 전 금액·임계값·`objective_degenerate`·개시 가능 시점의 날짜)은 블록이 실을 수 없어 **검사되지 않았다.** 그 축들이 옳다는 근거는 이 회차에 없다.

---

## 8. 엔진 유닛이 `open_questions`로 올린 넷에 대한 판정

계약 `4.0.0`의 머리말이 이 유닛의 판정을 기다린다고 적은 항목이 넷이다. **답을 낸 것 둘, 내지 못한 것 둘이다.** 내지 못한 것을 낸 척하지 않는다.

### (가) 만 나이의 기준일 — **규칙을 만들었다. 다만 단일 기준일은 만들 수 없다는 것이 그 규칙의 내용이다**

D21이 "기준일 규칙이 룰셋에 없으면 `tax-domain`이 만들고, 만들 수 없으면 그 사실이 `assumptions`에 실려야 한다"고 정했다. 6차에 룰셋 규칙 **`age.reckoning.reference_date`**를 넣었다.

**정해져 있는 것 둘.**

- **나이를 세는 방법** — 출생일을 산입한 만 나이, 연수 표시(민법 §158). 세법에 특칙이 없으므로 민법이 그대로 적용된다(국세기본법 §4). 만 N세가 되는 날은 N번째 생일 당일이다.
- **n년 뒤의 날짜** — 역에 의해 계산하고 최종의 월에 해당일이 없으면 그 월의 말일이다(민법 §160 ③).

**정해져 있지 않은 것 하나 — 그리고 그것이 "기준일"이다.** 만 나이를 어느 날짜 기준으로 판정하는지를 일률적으로 정한 규정은 없다. **각 요건이 성립해야 하는 시점이 곧 그 요건의 판정 시점이므로 기준일은 규칙마다 다르고, 하나로 정하면 오히려 틀린다.**

| 규칙 | 요건이 성립해야 하는 시점 | 기준일이 필요한가 |
|---|---|---|
| `pension.withdrawal.earliest_start` (만 55세) | 인출 시점 | **아니다.** 이 요건은 나이(정수)가 아니라 **날짜**로 환원된다 — 만 55세가 되는 날은 생년월일만으로 정해진다. 개시 가능 시점을 날짜로 산출하는 한 기준일 문제가 발생하지 않는다 |
| `isa.eligibility` (19세 / 15세) | **가입(계좌 개설) 시점** | **그렇다.** 조문이 가입할 수 있는 자의 요건으로 연령을 정한다 |

**엔진의 처리에 대한 판정.** 과세기간 종료일로 환산하는 것은 `pension` 쪽에서는 무해하다(그쪽은 날짜로 비교하면 되고 나이는 표시용 파생값이다). **`isa.eligibility`에서는 오차가 남고 그 방향이 과대다** — 그 과세연도 중에 19세가 되는 사람에게 아직 성립하지 않은 가입 자격을 준다. 다만 **엔진이 이것을 고칠 방법이 지금은 없다.** 요청에 계산 시점(또는 가입 예정일)이 없고, 순수 함수는 현재 시각을 읽지 않기 때문이다.

**권고 (관리자 판정 사안).** 셋 중 하나다.

1. 요청에 계산 시점을 넣는다 — 가장 정확하지만 입력이 하나 는다.
2. `accounts.isa.exists`가 `false`일 때만 연령 판정을 **보류**한다 — 이미 보유한 사용자에게는 판정이 끝난 사항이므로 실제로 문제가 되는 것은 신규 가입 경로뿐이다.
3. 지금대로 두고 가정으로 드러낸다 — 엔진이 이미 `age_reference_date_not_in_ruleset`을 내고 있으나, **그 가정의 문구는 "룰셋에 규칙이 없다"이고 이제 그것은 사실이 아니다.** 규칙은 있고, 그 규칙이 "이 자리에는 계산 시점이 필요하다"고 말한다. 가정 코드의 뜻을 고쳐야 한다.

**`echo.derived_age.reference_date_from_ruleset`이 항상 `false`라는 계약 서술도 함께 손봐야 한다.** 규칙이 생겼으므로 그 필드가 무엇을 뜻하는지가 달라진다 — 계약과 코드는 이 유닛의 소관이 아니므로 사실만 넘긴다.

### (나) 윤년 2월 29일 — **답을 냈고, 엔진의 처리가 맞다**

엔진이 "2월 29일생의 n년 뒤 날짜를 그 달의 마지막 날로 맞춘다"고 적고 확인을 요청했다. **민법 §160 ③이 정확히 그렇게 정한다** — "월 또는 연으로 정한 경우에 최종의 월에 해당일이 없는 때에는 그 월의 말일로 기간이 만료한다." 국세기본법 §4가 세법의 기간 계산에 민법을 준용하므로 그대로 적용된다.

따라서 2월 29일생이 만 55세가 되는 날, 그리고 2월 29일에 가입한 계좌의 5년이 되는 날은 **해당 해에 2월 29일이 없으면 2월 28일**이다. **엔진의 처리와 일치하고, 이제 그것은 가정이 아니라 룰셋의 규칙이다.**

### (다) 퇴직급여 입금액이 1,800만원 납입한도를 쓰는가 — **답을 내지 못했다**

시행령 §40의2 ② 1호 가목의 문언은 "연금계좌에 납입한 금액의 합계액이 연 1천800만원 이내일 것"이고, **이연퇴직소득의 이체가 그 "납입"에 들어가는지를 조문이 스스로 말하지 않는다.** 이번 회차에 1차 출처로 확인하지 못했다.

**그러므로 판정하지 않는다.** 엔진의 선택(쓰는 쪽)에 대해서는 다음을 적는다.

- **오차의 방향이 과소다.** 쓰는 쪽으로 보면 연금 배분이 작아지고 절세액이 작게 나온다. 반대로 틀리면 실제로 넣을 수 없는 금액을 권하게 된다. **판정이 날 때까지는 지금 선택을 유지하는 것이 안전하다.**
- **그 선택은 `assumptions`에 실려 있어야 한다.** 엔진이 `retirement_transfer_counted_in_contribution_limit`로 내고 있다고 적었다.
- **검증 방법을 지정한다.** 시행령 §40의2 ② 각 호 외의 부분이 "연금보험료"를 무엇으로 정의하는지, 그리고 §146 ②의 이연퇴직소득이 §40의2 ②의 적용을 받는지를 조문 원문으로 확인해야 한다. 국가법령정보센터 조문 화면이 동적 렌더링이라 이번 회차에 열리지 않았다.

**골든 케이스는 이 미결을 우회했다.** GC-39는 입금액을 3,000,000으로 두어 두 읽기가 같은 답을 내는 자리에 세웠다. **근거 없이 한쪽을 정답으로 적으면 그것이 곧 지어낸 정답이고, 다음 검증자가 그것을 세법 결론으로 오독한다.**

### (라) 개인지방소득세에 같은 세액 한도 구조가 있는가 — **답을 내지 못했다**

6차 조사 13.8절이 미확인으로 남긴 항목 그대로다. 이번 회차에도 확인하지 못했다.

**확인해야 하는 것은 둘이다.** (1) 개인지방소득세에 연금계좌 세액공제에 대응하는 세액공제가 별도로 규정되어 있는지, (2) 있다면 그 공제에도 산출세액 초과분을 없는 것으로 보는 구조가 있는지. 룰셋이 지금 갖고 있는 것은 `tax.local.personal_income_surtax` 하나이고, 그 규칙의 근거는 **원천징수 단계의 특별징수 규정**이라 연말정산 후 확정되는 개인지방소득세의 세액공제 구조를 말하지 않는다.

**엔진의 선택(인정된 소득세분에 부가율을 적용)에 대한 판단.** 유지하는 것이 옳다고 본다. 근거는 방향이다 — 인정되지 않은 공제에 붙는 지방세를 남기지 않으므로 절세액이 **작게** 나오고, 과소한 절세액은 사용자를 잘못된 결정으로 밀지 않는다. 반대로 자르기 전 소득세분에 곱하면 소득세 공제가 0인 사람에게 지방세 절세액만 남는 **성립하지 않는 숫자**가 나온다.

**다만 이것은 방향에 근거한 선택이지 조문에 근거한 결론이 아니다.** `local_tax_follows_income_tax_cap` 가정이 그대로 나가야 하고, 결과 화면의 고지 요소 4(가정)에 이 항목이 실려야 한다.

---

## 9. 6차에 남기는 미결

**이 절은 머리말 `open_questions`의 요약이 아니라, 다음 회차가 무엇부터 해야 하는지의 순서다.**

1. **실행기의 허용 키를 늘려야 한다** (`calc-engine-dev`). 1-A.1절의 넷 — `tax_credit_before_cap`(배분안 단위) · `tax_liability_cap`의 `cap_krw`·`known`·`applied`·`threshold_income_tax_krw`(배분안 단위) · `objective_degenerate`(배분안 단위) · `pension_withdrawal_start`의 `earliest_start_date`·`bound_by_holding_period`(시나리오 단위). **키가 생기면 이 문서는 같은 회차 안에 값을 채울 수 있다** — 산출은 이미 끝나 있고 적을 자리가 없었을 뿐이다.
2. **만 나이 기준일에 대한 관리자 판정** (8절 (가)의 셋 중 하나).
3. **퇴직급여 입금액의 납입한도 취급 확인** (8절 (다)). 확인되면 GC-39 옆에 두 읽기가 갈리는 케이스를 하나 더 만든다.
4. **개인지방소득세 한도 구조 확인** (8절 (라)).
5. **`prior_year_tax`의 밴드가 근로소득자만을 전제한다**(S15). 근로소득 외의 소득이 있는 사용자에게는 이 밴드가 성립하지 않고, GC-09를 `unknown`으로 둔 이유가 그것이다. 서비스 대상이 근로소득자로 좁혀져 있다는 가정(리포트 4.1절 A6)이 바뀌면 이 절차를 다시 세워야 한다.

---

## 10. ISA 혜택 산식의 정답 (11차, 2026-08-10) — **13차에 전부 실행에 올랐다**

> **13차 갱신.** 이 절이 기다리던 조건(계약이 `profile.isa_return_assumption`과 `Plan.assumption_based_isa_estimate`를 들이는 것)이 `5.1.0`에서 성립했다. 아홉 건은 **`GC-52`~`GC-60`으로 번호와 블록을 얻었고 12절에 있다.** 아래 10.0~10.4절은 **그때의 산출 근거를 그대로 남긴 것**이며, 12절은 그 값을 옮겨 적었을 뿐 다시 산출하지 않았다. 아래의 "아직 실행할 수 없다"는 서술은 11차·12차 시점의 기록으로 읽는다.

관리자 판정 **D28**이 수익률을 입력으로 받기로 했고, 이 유닛이 산식을 룰셋 규칙 `isa.benefit.formula`로 확정했다. 그 산식의 정답을 여기 적는다.

### 10.0 왜 `GC-` 번호를 붙이지 않았는가 — 그리고 왜 블록이 없는가

**엔진이 아직 이 값을 내지 않는다.** 요청에 `profile.isa_return_assumption`이 없고 응답에 `Plan.assumption_based_isa_estimate`가 없다(계약 개정 제안은 `tax-rules-report.md` 18.4절). 지금 블록을 적으면 실행기가 존재하지 않는 필드를 대조하다 실패한다.

그래서 **케이스 이름을 `RF-n`으로 두고 `golden` 블록을 달지 않았다.** `GC-` 번호를 붙이면 실행기의 커버리지 검사가 "블록 없는 케이스"로 잡아 실패시킨다 — 1-A절이 정한 규약이다. **실행할 수 없는 케이스를 실행되는 것처럼 보이게 하지 않는 것이 이 절의 형식이 지키는 것이다.**

**계약이 위 두 필드를 들이는 회차에 이 아홉 건을 `GC-` 번호로 옮기고 블록을 단다.** 그때 기대값을 다시 산출하지 않는다 — **여기 적힌 값이 먼저이고, 엔진은 뒤에 온다.**

**12차 확인 (2026-08-10).** 계약이 `4.0.0`에서 `5.0.0`으로 올라갔으므로 D28이 들어왔는지 다시 확인했다. **들어오지 않았다.** `engine-interface.md` `5.0.0` 전문에 `isa_return_assumption` · `assumption_based_isa_estimate` · `isa_return_affects` 어느 것도 없고, `5.0.0`이 major로 올라간 근거 셋(0.6절)은 공제율 판정 축 · 배분안 넷 · `credit_rate_bracket`의 의미 변경이며 수익률은 그중에 없다. `수익`이라는 낱말이 계약에 나오는 자리는 세 곳뿐이고 전부 다른 뜻이다(`returns_taxed_on_withdrawal` · 중도 인출 시 운용수익 · `isa_benefit_not_quantified`). **그러므로 이 아홉 건은 그대로 둔다** — `GC-` 번호도 블록도 달지 않는다. 위 문단이 정한 조건이 아직 성립하지 않았고, **조건이 성립하지 않았음을 확인했다는 사실 자체를 여기 적어 두는 것이 이 회차의 산출물이다.**

### 10.1 산출 절차 — 어느 규칙을 어떤 순서로 적용했는가

아홉 건 전부 아래 순서를 그대로 밟았다. 순서가 바뀌면 값이 달라지는 자리가 두 곳(②→③, ④→⑤)이므로 번호를 지킨다.

| # | 하는 일 | 규칙 |
|---|---|---|
| ① | 사용자가 준 수익률·기간·원금에서 계좌 총수익 `R`을 만든다. **단리**로 계산한다 | 룰셋에 없다 — `isa.benefit.settlement_period`가 "세법이 정하지 않으므로 단리가 과소 방향"이라고 적고, 엔진은 그 사실을 가정으로 낸다 |
| ② | 수익의 성격에서 과세 비율 `s`의 구간을 정하고 `G = R × s`를 만든다 | `isa.benefit.income_character` |
| ③ | 통산 대상 손실 `L`을 빼 `N = max(0, G − L)`을 만든다. `L`을 모르면 0 | `isa.net_income.loss_offset` · `isa.benefit.formula.loss_offset_placement` |
| ④ | 비과세 한도금액 `C`를 정한다 (일반형 2,000,000 / 서민형 4,000,000) | `isa.tax_free_limit` |
| ⑤ | ISA 쪽 세액 = `max(0, N − C) × 9% × 1.1` | `isa.excess.separate_tax_rate` · `tax.local.personal_income_surtax` |
| ⑥ | 비교 기준 세액 = `G × 14% × 1.1`. **`N`이 아니라 `G`다** — 계좌 밖에는 손익통산 규정이 없다 | `isa.benefit.formula.comparison_side_cases.case_a` (소득세법 §129 ① · §14 ③ 6호 · 조특법 §129조의2 ①) |
| ⑦ | 혜택 = ⑥ − ⑤. 세 축으로도 분해해 합이 같은지 되본다 | `isa.benefit.formula.axis_decomposition` |
| ⑧ | 의무가입기간 전 해지면 혜택을 0으로 덮는다 | `isa.early_termination.clawback` |
| ⑨ | 이 금액은 **몇 년치 정산인가**를 함께 적는다. 연간 금액으로 나누지 않는다 | `isa.benefit.settlement_period` |

**⑥에서 `G`를 쓰는 것이 이 절의 알맹이다.** `N`을 쓰면 손익통산 축이 통째로 사라져 RF-4·RF-5의 값이 각각 308,000원·308,000원 작아진다. 산식을 옮겨 적다 가장 틀리기 쉬운 자리다.

### 10.2 정답 아홉 건 — 경계값 일곱 건 포함

전부 일반형(`C` = 2,000,000)이며 RF-3만 서민형(`C` = 4,000,000)이다. 표시 없으면 `L` = 0, `s` = 1이다.

| # | 프로필 | 【경계】 | `G` | `N` | 혜택 | 손익통산 축 | 비과세 축 | 세율차 축 |
|---|---|---|---|---|---|---|---|---|
| **RF-1** | 이자·배당 순소득이 비과세 한도와 **정확히 같다** | 【경계】 한도선 | 2,000,000 | 2,000,000 | **308,000** | 0 | 308,000 | 0 |
| **RF-2** | 한도를 **100,000원 넘긴다** | 【경계】 한도 초과 진입 | 2,100,000 | 2,100,000 | **313,500** | 0 | 308,000 | 5,500 |
| **RF-3** | **서민형**이 한도와 정확히 같다 | 【경계】 유형 갈림 | 4,000,000 | 4,000,000 | **616,000** | 0 | 616,000 | 0 |
| **RF-4** | 이익 5,000,000 / **손실 2,000,000** → 통산 후에도 한도 초과 | 【경계】 손익통산 + 초과 | 5,000,000 | 3,000,000 | **671,000** | 308,000 | 308,000 | 55,000 |
| **RF-5** | 이익 3,000,000 / **손실 2,000,000** → 통산으로 한도 **아래로** 내려간다 | 【경계】 통산이 구간을 바꾼다 | 3,000,000 | 1,000,000 | **462,000** | 308,000 | 154,000 | 0 |
| **RF-6** | 수익이 전부 국내 상장주식 매매차익 (`s` = 0) | 【경계】 성격 하한 | 0 | 0 | **0** | 0 | 0 | 0 |
| **RF-7** | 의무가입기간 **전 해지** (다른 조건은 RF-1과 같다) | 【경계】 추징 | 2,000,000 | 2,000,000 | **0** | — | — | — |
| **RF-8** | 성격 `mixed_or_unknown`, `R` = 2,000,000 | — | 구간 | 구간 | **0 ~ 308,000** | — | — | — |
| **RF-9** | 일반형, 3년 계약, 매 해 이자·배당 순소득 2,000,000원 | 【경계】 계약 단위 대 과세기간 단위 | 6,000,000 | 6,000,000 | **528,000** | 0 | 308,000 | 220,000 |

**RF-9가 이 절이 새로 잡는 것이다.** 같은 프로필을 **연간 금액으로 환산하면 924,000원**(308,000 × 3)이 나온다. 조문대로 계약 단위로 정산하면 **528,000원**이고, 연간 환산은 **1.75배 과대**다. 비과세 한도금액이 "가입일 또는 연장일을 기준으로" 한 번 정해지기 때문이다(조특법 §91조의18 ②). **엔진이 ISA 혜택을 연간 금액으로 내면 이 케이스가 잡는다.**

**RF-8의 기대값이 점이 아니라 구간인 것도 의도다.** `mixed_or_unknown`·`listed_equity_capital_gain`에서 점을 내면 그 점을 고른 근거가 조문에 없다. 실행기가 구간을 대조할 수 있어야 하므로 블록 어휘에 `lower_bound_krw`·`upper_bound_krw`가 필요하다 — 18.4절 (나).

### 10.3 검산

- **세 축의 합이 혜택과 같은가.** RF-1 `0+308,000+0 = 308,000` ✓ · RF-2 `0+308,000+5,500 = 313,500` ✓ · RF-3 `0+616,000+0 = 616,000` ✓ · RF-4 `308,000+308,000+55,000 = 671,000` ✓ · RF-5 `308,000+154,000+0 = 462,000` ✓ · RF-9 `0+308,000+220,000 = 528,000` ✓
- **기존 규칙과 어긋나지 않는가.** RF-1의 308,000원과 RF-3의 616,000원이 `isa.benefit.quantification`의 `statable_amounts.conditional_max_tax_free_saving`에 이미 적혀 있는 일반형·서민형 값과 같다. **새 산식이 기존 규칙과 같은 값을 낸다.**
- **조문에서 나오는 부등식을 지키는가.** 아홉 건 전부 혜택 ≥ 0이고, RF-7을 뺀 여덟 건에서 혜택 ≥ `G × 5.5%`다(RF-1 308,000 ≥ 110,000 · RF-4 671,000 ≥ 275,000 · RF-9 528,000 ≥ 330,000). RF-7은 추징이 걸려 0이며 음수가 아니다.
- **단수 처리를 피했다.** 원 미만·10원 미만 절사 규칙을 확인하지 못했으므로(`tax-rules-report.md` 18.8절 6번) 아홉 건 모두 절사가 걸리지 않는 값으로 골랐다. 절사가 걸리는 경계 케이스는 그 규칙을 확인한 뒤에 만든다.

### 10.4 이 절이 **다루지 않는** 것

- **연금계좌 과세이연의 금액.** 낼 수 없다. 남는 미지수 다섯은 전부 인출 단계의 값이고 게이트 1 D3이 v2로 연기했다(`pension.tax_deferral.with_return_rate`). **낼 수 없는 것에 정답을 적지 않는다.**
- **금융소득종합과세 대상자(case B)의 실제 혜택.** 위 아홉 건은 전부 case A 기준이고 case B에서는 실제 혜택이 **더 크다.** 즉 이 표의 값은 그 사람들에게 **하한**이다.
- **복리로 계산했을 때의 값.** ①이 단리를 쓴다. 복리는 `R`을 키우고 혜택은 `R`에 단조 증가하므로 이 표의 값은 그쪽에서도 **하한**이다.


---

## 11. 12차 — 공제율 판정 축과 새 배분안의 정답 (신규 12건, 2026-08-10)

계약 `5.0.0`(D26·D27)이 두 가지를 새로 움직였고, **정답지는 그 둘 중 어느 것도 주장한 적이 없었다.** `calc-engine-dev`가 실행기의 미사용 어휘 목록에 빚으로 적어 둔 것을 이 회차에 갚는다.

| 이번에 채우는 축 | 왜 급한가 | 케이스 |
|---|---|---|
| **공제율 판정 축** (`profile.has_non_wage_global_income_current_year` · `current_year_global_income_krw`) | 사업소득 등이 있는 사람에게 **25% 과대**하던 결함을 고친 자리인데, 47건이 전부 근로소득만 있는 분기에 서 있어 **그 분기가 한 번도 검사되지 않았다** | GC-40 ~ GC-46 (7건) |
| **새 배분안 `pension_contribution_limit_fill`** | 배분안이 셋에서 넷으로 늘었고, 그 안이 연금저축에 **단독한도의 두 배 넘게** 넣는다. 그 배분이 공제를 잃는지 아닌지를 정답지가 말한 적이 없다 | GC-47 ~ GC-51 (5건) |

**세 번째 축(규칙별 미확인 건수)은 이번에도 적지 못했다.** 이유는 11.4절에 적었다 — 실행기의 블록 어휘에 그 축을 실을 자리가 아직 없다.

### 11.0 이 절이 쓰는 산출 절차 — 2절에 더하는 것 둘

**S2′ (S2를 대체한다). 세액공제율 판정 축을 먼저 고른다** — `pension.credit.rate`, `pension.credit.rate.basis_determination`.

소득세법 제59조의3 제1항 각 호 외의 부분은 **본문이 12%**, **대괄호 안이 15%**이고, 그 예외의 판정 기준을 "해당 과세기간에 종합소득과세표준을 계산할 때 합산하는 종합소득금액이 4천500만원 이하(**근로소득만 있는 경우에는** 총급여액 5천500만원 이하)"로 정한다. **소괄호는 병렬 선택지가 아니라 조건부 대체 기준이다.** 그러므로 판정은 두 단계다.

| 1단계 — 해당 과세기간에 근로소득 외에 **합산되는** 소득이 있는가 | 2단계 — 종합소득금액 | 재는 값 | 결과 |
|---|---|---|---|
| 아니오 | 묻지 않는다 | **총급여액** | 55,000,000 **이하** → 15%, 초과 → 12% |
| 예 | 안다 | **종합소득금액** | 45,000,000 **이하** → 15%, 초과 → 12% |
| 예 | 모른다 | 재지 않는다 | **12%**(본문). 대괄호 안의 예외를 적용하지 않는다 |

**환산하지 않는다.** 총급여액을 종합소득금액으로 환산해 하나의 축으로 합치면 새 결함이 생긴다. 제47조 제1항의 근로소득공제로 근로소득금액 = 0.95 × 총급여액 − 9,750,000이므로, **총급여액 55,000,001원 이상 57,631,578원 이하인 순수 근로소득자는 근로소득금액이 4,500만원 이하인데도 조문상 12%다.** 환산하면 그 사람들에게 15%를 준다. GC-41·GC-42가 그 구간에 세운 함정이다.

**S6′ (S6에 더한다). 인정액 산식과 그 산식이 낳는 경계** — `pension.credit.limit.annuity_savings`, `pension.credit.limit.combined`.

단서의 전단과 후단을 그대로 옮기면 인정액 `R = min( min(S, C) + P, K )`이다(S = 연금저축 납입액, P = 퇴직연금 납입액, C = 단독한도 6,000,000, K = 합산한도 9,000,000 + 전환 추가한도). 이 산식에서 산술로 따라 나오는 것이 **연금저축에 넣어도 인정액을 한 원도 잃지 않는 최대 금액**이다.

```
연금계좌에 넣는 총액을 L이라 할 때
  S ≤ C 이면  R = min(L, K)         (S에 의존하지 않는다 — 어떻게 나눠도 최대)
  S > C 이면  R = min(C + L − S, K)  (S에 대해 비증가)
따라서 R이 최대값 min(L, K)를 유지하는 조건은
  L ≥ K 이면  S ≤ L − (K − C)
  L < K 이면  S ≤ C
```

`L = 18,000,000`(납입한도) · `K = 9,000,000` · `C = 6,000,000`이면 경계는 **15,000,000**이다. **이 숫자를 상수로 쓰지 않는다** — 세 값 중 하나만 바뀌어도 따라 움직인다. 룰셋 `pension.credit.limit.combined.value.recognition_formula`에 산식과 그 경고를 함께 적었다.

### 11.1 공제율 판정 축 (GC-40 ~ GC-46)

일곱 건 공통: 만 40세(`1986-06-15`) · 월 750,000 × 12개월 = 예산 9,000,000 · horizon `at_or_after_pension_age` · 연금 두 계좌 ytd 0 / `not_started` · ISA 보유 / 누적 0 / 경과 0년 / 재형저축 0 · 전환 없음.

**예산 9,000,000이 배분과 배분안 수를 일곱 건 모두 같게 만든다.** S13 동점 순서로 연금저축 6,000,000(#1) + IRP 3,000,000(#2), ISA 0이고 배분안은 2다(`max_tax_credit`과 `annuity_savings_first`가 합쳐지고 `isa_first`가 남는다). **일곱 건에서 갈리는 것은 공제율 하나뿐이며, 그것이 이 묶음의 설계다** — 다른 것이 함께 움직이면 어느 축이 값을 바꿨는지 대조가 가리지 못한다.

| 케이스 | 1단계 | 2단계 금액 | 재는 값 | 공제율 | 세액공제 (소득세 / 지방세 / 합계) |
|---|---|---|---|---|---|
| **GC-40** | 아니오 | — | 총급여 55,000,000 | **0.15** | 1,350,000 / 135,000 / **1,485,000** |
| **GC-41** | 아니오 | — | 총급여 56,000,000 | **0.12** | 1,080,000 / 108,000 / **1,188,000** |
| **GC-42** | 아니오 | — | 총급여 57,631,578 | **0.12** | 1,080,000 / 108,000 / **1,188,000** |
| **GC-43** | 예 | 45,000,000 | 종합소득금액 | **0.15** | 1,350,000 / 135,000 / **1,485,000** |
| **GC-44** | 예 | 45,000,001 | 종합소득금액 | **0.12** | 1,080,000 / 108,000 / **1,188,000** |
| **GC-45** | 예 | 44,999,999 | 종합소득금액 | **0.15** | 1,350,000 / 135,000 / **1,485,000** |
| **GC-46** | 예 | **모른다** | 재지 않는다 | **0.12** | 1,080,000 / 108,000 / **1,188,000** |

**GC-43 ~ GC-46의 해당연도 총급여는 넷 다 50,000,000이다.** 총급여만으로 판정하면 넷 다 15%가 나온다. 따라서 **GC-44와 GC-46이 15%로 나오면 그것이 곧 D27이 고친 결함의 재발이고**, 그 두 건이 이 묶음의 알맹이다. GC-43·GC-45는 두 축이 같은 답을 내는 자리라 결함을 잡지는 못하지만, 경계가 어느 쪽으로 열려 있는지(45,000,000 **이하**)를 고정한다.

**GC-41·GC-42는 반대 방향의 함정이다.** 환산 방식으로 고쳤다면 이 둘이 15%가 된다.

| | 총급여 | 근로소득공제 (§47 ①) | 근로소득금액 | 환산 판정 | **조문 판정** |
|---|---|---|---|---|---|
| GC-41 | 56,000,000 | 12,000,000 + 11,000,000 × 0.05 = 12,550,000 | 43,450,000 | 4,500만 이하 → 15% | **12%** (총급여 5,500만 초과) |
| GC-42 | 57,631,578 | 12,000,000 + 12,631,578 × 0.05 = 12,631,578 | 45,000,000 | 4,500만 이하 → 15% | **12%** (총급여 5,500만 초과) |

GC-42의 총급여 57,631,578원은 **근로소득금액이 정확히 45,000,000원이 되는 총급여액**이다(0.95T − 9,750,000 = 45,000,000의 해가 57,631,578.9…이고, 원 미만 절사 여부와 무관하게 이 금액의 근로소득금액은 4,500만원 이하다). 즉 **환산 방식이 틀리는 구간의 위쪽 끝**이고, 그 위(57,631,579원)부터는 두 방식이 같은 답을 낸다.

**세액 한도 (S14·S15).**

- **GC-40 ~ GC-42** — 직전연도 총급여를 셋 다 55,000,000으로 두었다. S15의 밴드는 [3,324,163 , 4,100,000]이고 그 안의 **3,600,000**을 골랐다(부양가족 없는 근로자). 연금계좌 납입 이력이 없어 되더할 금액은 0이므로 한도가 3,600,000이고, 자르기 전 소득세분 1,350,000 / 1,080,000보다 크므로 **자르지 않는다.**
- **GC-43 ~ GC-46** — `state: "unknown"`으로 두었다. **밴드를 쓸 수 없기 때문이다.** S15의 밴드는 근로소득만 있는 사람의 것이고(9절 5번), 이 넷은 해당 과세기간에 근로소득 외의 합산 소득이 있는 사람이다. 직전 과세기간의 소득 구성을 케이스가 정한 바 없으므로 밴드가 성립하는지조차 말할 수 없다. **CD4에 따라 근거 없이 고르지 않는다.** 한도를 모르면 자르지 않으므로(S14-3) 기대 공제액은 자르기 전 금액 그대로이고, 그 결과가 "최대 이만큼"이라는 사실은 `tax_liability_cap_unknown`이 싣는다.

**ISA 유형.** GC-40 ~ GC-42는 직전 총급여 55,000,000 > 50,000,000이므로 `general`(비과세 한도 2,000,000), GC-43 ~ GC-46은 직전 50,000,000 ≤ 50,000,000이므로 `low_income`(4,000,000)으로 선언을 맞췄다. 어긋나게 두면 `isa_type_conflicts_with_prior_income`이 붙어 이 묶음이 보려는 것과 뒤섞인다(6.4절 (가)와 같은 기준).

**블록이 주장하는 것과 주장하지 못하는 것.** 블록의 `credit_rate.income_tax`가 공제율 자체를 고정하고, `notice_codes` / `notice_codes_absent`가 **대체값을 썼는지 아닌지**를 양방향으로 고정한다. `credit_rate.basis`(어느 축으로 쟀는가)와 `credit_rate.fallback_applied`는 **적지 못했다** — 11.4절 참조.

### GC-40 — 근로소득만 있는 사람: 축이 총급여 그대로 (총급여 55,000,000) 【축 기준선】

**프로필** 40세 · 해당연도 총급여 55,000,000 · **근로소득 외 합산소득 없음** · 직전연도 55,000,000 · 월 750,000 · ISA 일반형

**기대 결과** 공제율 **0.15** · 배분 연금저축 6,000,000 + IRP 3,000,000 + ISA 0 · 세액공제 **1,350,000 / 135,000 / 1,485,000** · 배분안 2 · 경고 0

**도출 과정** S2′ 1단계 **아니오** → 축은 총급여액 → 55,000,000 ≤ 55,000,000 이므로 `boundary_rule`의 "이하"에 걸려 **15%** → S3 납입 잔여 18,000,000 → S5 합산 공제한도 9,000,000 → S11 예산 9,000,000 전액이 공제한도 안 → S13 동점이므로 연금저축 단독한도 6,000,000까지 먼저, 잔여 3,000,000이 IRP → S6 인정액 9,000,000 → S7 9,000,000 × 0.15 = 1,350,000, 지방세분 ×0.1 = 135,000 → S14 한도 3,600,000 > 1,350,000이므로 자르지 않음.

**GC-01과 무엇이 다른가.** 금액은 같다. 다른 것은 **1단계 답이 블록에 명시적으로 적혀 있다는 점**이다. GC-01을 비롯한 47건은 그 값을 실행기가 계약 기본값으로 채우고 있어, **정답지가 그 분기를 고른 적이 없었다.** 이 케이스가 그 자리를 메운다.

```golden
{
  "case": "GC-40",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.15,
    "local_tax": 0.1,
    "basis": "total_salary",
    "measured_amount": 55000000,
    "fallback_applied": false,
    "fallback_direction": null
  },
  "expect": {
    "current": {
      "legal_basis": {
        "isa.account.requirements": {"present":true,"has_uncertainty_note":false,"uncertainty_note_count":0}
      },
      "plan_count": 2,
      "legal_basis": {
        "pension.credit.rate.basis_determination": { "present": true, "status": "확정", "bill_stage": null, "has_uncertainty_note": true, "uncertainty_note_count": 1, "uncertainty_kinds": ["unverified"], "uncertainty_paths": ["error_direction_when_judged_by_salary_only.reverse.unverified"] },
        "isa.early_termination.clawback": { "present": true, "has_uncertainty_note": true, "uncertainty_note_count": 1, "uncertainty_kinds": ["unverified"], "uncertainty_paths": ["unverified"] },
        "pension.withdrawal.eligibility": { "present": true, "has_uncertainty_note": true, "uncertainty_note_count": 1, "uncertainty_kinds": ["text_marker"], "uncertainty_paths": ["requirements[2].formula"] },
        "age.reckoning.reference_date": { "present": true, "has_uncertainty_note": true, "uncertainty_note_count": 1, "uncertainty_kinds": ["confidence_not_verified"], "uncertainty_paths": ["confidence"] },
        "pension.credit.tax_liability_cap.source_form": { "present": true, "has_uncertainty_note": true, "uncertainty_note_count": 1, "uncertainty_kinds": ["text_marker"], "uncertainty_paths": ["unknown_value_policy.direction_of_error"] }
      },
      "limits": { "isa_tax_free_limit_krw": 2000000 },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied",
        "tax_liability_cap_unknown"
      ]
    }
  }
}
```

### GC-41 — 환산하면 틀리는 구간: 순수 근로소득자 총급여 56,000,000 【경계 · 함정】

**프로필** 40세 · 해당연도 총급여 **56,000,000** · **근로소득 외 합산소득 없음** · 직전연도 55,000,000 · 월 750,000 · ISA 일반형

**기대 결과** 공제율 **0.12** · 배분은 GC-40과 동일 · 세액공제 **1,080,000 / 108,000 / 1,188,000** · 배분안 2

**도출 과정** S2′ 1단계 **아니오** → 축은 총급여액 → 56,000,000 > 55,000,000 → **12%** → 이하 GC-40과 같고 S7만 9,000,000 × 0.12 = 1,080,000 → 지방세분 108,000 → S14 한도 3,600,000 > 1,080,000이므로 자르지 않음.

**이 케이스가 막는 것.** 종합소득금액으로 환산해 판정하면 이 사람의 근로소득금액은 43,450,000원이라 4,500만원 **이하**가 되어 15%가 나온다. **조문상 정답은 12%이고 차이는 297,000원이다.** 소괄호의 총급여 기준은 환산 편의가 아니라 이 구간에서 **더 엄격한** 규정이라는 사실을 이 한 건이 고정한다.

```golden
{
  "case": "GC-41",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 56000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.12,
    "local_tax": 0.1,
    "basis": "total_salary",
    "measured_amount": 56000000,
    "fallback_applied": false,
    "fallback_direction": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1080000, "local_tax": 108000, "total": 1188000 },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-42 — 환산이 틀리는 구간의 위쪽 끝: 총급여 57,631,578 【경계】

**프로필** GC-41과 같고 해당연도 총급여만 **57,631,578**

**기대 결과** 공제율 **0.12** · 세액공제 **1,080,000 / 108,000 / 1,188,000** · 배분·배분안 수 GC-41과 동일

**도출 과정** S2′ 1단계 **아니오** → 57,631,578 > 55,000,000 → **12%**. 나머지는 GC-41과 같다.

**왜 이 금액인가.** 제47조 제1항으로 근로소득금액 = 0.95 × 총급여액 − 9,750,000이고, 이것이 45,000,000이 되는 총급여액은 57,631,578.9…원이다. 따라서 **총급여 55,000,001원부터 57,631,578원까지가 "환산하면 15%, 조문대로면 12%"인 구간**이고 이 케이스가 그 위쪽 끝이다. 57,631,579원부터는 두 방식이 12%로 일치하므로 함정이 닫힌다. GC-41(구간 안쪽)과 이 건(구간 끝)이 함께 서면 구간 전체가 고정된다.

```golden
{
  "case": "GC-42",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 57631578,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.12,
    "local_tax": 0.1,
    "basis": "total_salary",
    "measured_amount": 57631578,
    "fallback_applied": false,
    "fallback_direction": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1080000, "local_tax": 108000, "total": 1188000 },
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-43 — 종합소득금액 경계 정확히: 45,000,000 【경계】

**프로필** 40세 · 해당연도 총급여 50,000,000 · **근로소득 외 합산소득 있음** · **종합소득금액 45,000,000** · 직전연도 총급여 50,000,000 · 월 750,000 · ISA 서민형 · 직전 세액 `unknown`

**기대 결과** 공제율 **0.15** · 배분 연금저축 6,000,000 + IRP 3,000,000 · 세액공제 **1,350,000 / 135,000 / 1,485,000** · 배분안 2

**도출 과정** S2′ 1단계 **예** → 축은 종합소득금액 → 45,000,000 ≤ 45,000,000 이므로 대괄호 안의 예외에 해당(법문이 "이하") → **15%** → S11·S13 배분은 GC-40과 같다 → S7 1,350,000 / 135,000 → S14 한도 모름 → **자르지 않는다**(지어낸 한도로 자르면 그 자름이 근거 없는 숫자다). 결과는 "최대 이만큼"이고 그 사실을 `tax_liability_cap_unknown`이 싣는다.

```golden
{
  "case": "GC-43",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": true,
      "current_year_global_income_krw": 45000000,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.15,
    "local_tax": 0.1,
    "basis": "global_income",
    "measured_amount": 45000000,
    "fallback_applied": false,
    "fallback_direction": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": { "isa_tax_free_limit_krw": 4000000 },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "warning_count": 0
        }
      },
      "notice_codes": ["tax_liability_cap_unknown"],
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-44 — 종합소득금액 경계 +1원: 45,000,001 【경계 · 결함이 걸리던 바로 그 자리】

**프로필** GC-43과 같고 종합소득금액만 **45,000,001**

**기대 결과** 공제율 **0.12** · 세액공제 **1,080,000 / 108,000 / 1,188,000** · 배분·배분안 수 GC-43과 동일

**도출 과정** S2′ 1단계 **예** → 축은 종합소득금액 → 45,000,001 > 45,000,000 → 본문 구간 **12%** → S7 9,000,000 × 0.12 = 1,080,000 / 108,000.

**이 케이스가 막는 것.** **총급여액(50,000,000)만 보면 15%가 나온다.** D27이 고친 결함이 정확히 이 사람에게 걸렸고, 인정 납입액 9,000,000 기준으로 **1,485,000원 대 1,188,000원 — 25% 과대**였다. GC-43과 이 건이 1원 간격으로 서 있으므로 `<`와 `≤`를 뒤집는 오류도 함께 걸린다.

```golden
{
  "case": "GC-44",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": true,
      "current_year_global_income_krw": 45000001,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.12,
    "local_tax": 0.1,
    "basis": "global_income",
    "measured_amount": 45000001,
    "fallback_applied": false,
    "fallback_direction": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1080000, "local_tax": 108000, "total": 1188000 },
          "warning_count": 0
        }
      },
      "notice_codes": ["tax_liability_cap_unknown"],
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-45 — 종합소득금액 경계 −1원: 44,999,999 【경계】

**프로필** GC-43과 같고 종합소득금액만 **44,999,999**

**기대 결과** 공제율 **0.15** · 세액공제 **1,350,000 / 135,000 / 1,485,000**

**도출 과정** S2′ 1단계 **예** → 44,999,999 < 45,000,000 → **15%**. 나머지는 GC-43과 같다. **GC-43·44·45가 1원 간격으로 세 점을 이루므로 경계의 위치와 포함 여부가 함께 고정된다.**

```golden
{
  "case": "GC-45",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": true,
      "current_year_global_income_krw": 44999999,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.15,
    "local_tax": 0.1,
    "basis": "global_income",
    "measured_amount": 44999999,
    "fallback_applied": false,
    "fallback_direction": null
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "warning_count": 0
        }
      },
      "notice_codes": ["tax_liability_cap_unknown"],
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-46 — 종합소득이 있는데 금액을 모른다: 본문 구간을 적용하고 그 사실을 싣는다 【경계 · 대체값】

**프로필** GC-43과 같고 **종합소득금액을 주지 않는다**(`null`)

**기대 결과** 공제율 **0.12** · 세액공제 **1,080,000 / 108,000 / 1,188,000** · 안내 **`credit_rate_global_income_missing`**

**도출 과정** S2′ 1단계 **예**, 2단계 **모름** → **금액을 지어내지 않는다.** 조문 구조상 12%가 본문이고 15%가 대괄호 안의 예외이므로 예외의 요건이 확인되지 않으면 본문이 적용된다 → **12%** → S7 1,080,000 / 108,000.

**여기서 갈리는 두 가지를 구분한다.** GC-44와 GC-46은 **같은 공제율**을 내지만 이유가 다르다 — GC-44는 잰 금액이 경계를 넘었기 때문이고, GC-46은 **재지 못했기 때문**이다. 금액만으로는 둘이 구별되지 않으므로 안내 코드가 그 구분을 진다. **그래서 이 케이스는 `credit_rate_global_income_missing`을 `notice_codes`에 적고, GC-40 ~ GC-45는 같은 코드를 `notice_codes_absent`에 적는다.** 없는 것을 주장하지 않으면 "대체값을 쓰지 않았다"는 사실이 어디에도 검사되지 않는다.

**오차 방향이 반대라는 점을 기록한다.** 이 대체값은 우대 구간을 적용하지 않은 것이므로 결과가 **과소이거나 같다** — 세액 한도의 "최대 이만큼"과 방향이 반대다. 이 케이스는 두 표시가 **한 응답에 동시에** 들어 있는 자리이기도 하다(`tax_liability_cap_unknown`도 함께 나간다). 화면이 두 표시를 같은 문장 틀로 쓰면 한쪽이 반드시 거짓이 된다.

**대체값을 고른 것은 조문이 아니라 제품이다.** 조문 읽기로도 자연스럽지만, 이 조직이 그것을 고른 이유는 오차 방향이 한쪽이 아니어서 상한 표기로 덮이지 않기 때문이다(D27). 세법이 정한 것처럼 표시해서는 안 된다.

```golden
{
  "case": "GC-46",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "unknown",
        "determined_tax_krw": null,
        "pension_credit_applied_krw": null
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": true,
      "current_year_global_income_krw": null,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "credit_rate": {
    "income_tax": 0.12,
    "local_tax": 0.1,
    "basis": "statutory_default",
    "measured_amount": null,
    "fallback_applied": true,
    "fallback_direction": "understated_or_equal"
  },
  "expect": {
    "current": {
      "plan_count": 2,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1080000, "local_tax": 108000, "total": 1188000 },
          "warning_count": 0
        }
      },
      "notice_codes": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_unknown"
      ],
      "notice_codes_absent": ["tax_liability_cap_applied"]
    }
  }
}
```

### 11.2 새 배분안 `pension_contribution_limit_fill`과 그 경계 (GC-47 ~ GC-51)

다섯 건 공통: 만 40세(`1986-06-15`, GC-51만 만 30세) · horizon `at_or_after_pension_age` · ISA 보유 / 누적 0 / 경과 0년 / 재형저축 0 · 전환 없음 · `options.plan_variants`에 **네 안 전부**를 적어 요청한다.

**네 안을 명시적으로 요청하는 이유.** 실행기는 블록이 `options`를 주지 않으면 기존 세 안만 요청하도록 채운다. 그래야 47건의 기대값이 네 번째 안 때문에 흔들리지 않는다. 이 다섯 건은 **네 번째 안이 곧 주제**이므로 블록이 직접 네 안을 적는다.

**이 묶음이 확인하는 것은 하나다** — 그 안이 연금저축에 단독한도(6,000,000)를 훨씬 넘겨 넣는데, **그것이 세액공제를 잃는 배분인가.** 답은 S6′의 경계가 정한다.

| 케이스 | 연금 총액 `L` | 최종 `S`(연금저축) | 최종 `P`(퇴직연금) | 경계 `max(C, L−(K−C))` | 인정액 `R` | 최대 인정액 `min(L,K)` | 잃었는가 |
|---|---|---|---|---|---|---|---|
| **GC-47** | 18,000,000 | **15,000,000** | 3,000,000 | **15,000,000** | 9,000,000 | 9,000,000 | **아니다 (경계 위에 정확히 선다)** |
| **GC-48** | 18,000,000 | 12,000,000 | 6,000,000 | 15,000,000 | 9,000,000 | 9,000,000 | 아니다 (경계 아래) |
| **GC-49** | 18,000,000 | **16,000,000** | 2,000,000 | 15,000,000 | **8,000,000** | 9,000,000 | **잃는다 — 1,000,000 인정액 = 165,000원** |
| **GC-50** | 18,000,000 | **18,000,000** | 0 | 15,000,000 | **6,000,000** | 9,000,000 | **잃는다 — 3,000,000 인정액 = 495,000원** |
| **GC-51** 확정 | 18,000,000 | 15,000,000 | 3,000,000 | 15,000,000 | 9,000,000 | 9,000,000 | 아니다 |
| **GC-51** 개정안 | 18,000,000 | 9,000,000 | **9,000,000** | 15,000,000 | 9,000,000 | 9,000,000 | 아니다 (다만 순서가 뒤집힌다 — 11.3절) |

**GC-47이 이 묶음의 중심이다.** 그 안의 충당 순서가 **경계 위에 정확히 선다** — 1차가 공제 대상 한도까지만 채우므로 IRP가 `K − C = 3,000,000`을 정확히 받고, 2차의 잔여가 전부 연금저축으로 가 `S = L − (K − C) = 15,000,000`이 된다. 즉 이 배분안은 **경계를 우연히 지키는 것이 아니라 구조적으로 경계에 도달한다.** GC-48(경계 아래)과 GC-49·GC-50(경계 위)이 그 양쪽에 서서 경계가 실제로 무는 것을 보인다.

**GC-49·GC-50의 초과분은 배분안이 만든 것이 아니다.** 그 안의 1차·2차 순서로는 IRP가 받을 수 있는 한 `S`가 경계를 넘지 않는다. 넘게 만들려면 **IRP 쪽이 막혀 있어야** 하고, 그 두 가지가 GC-49(기납입 연금저축이 이미 16,000,000)와 GC-50(IRP가 연금수령 개시)이다. **경계 초과가 실제로 일어나는 입력이 무엇인지까지가 이 묶음의 산출물이다.**

**세액 한도.** 다섯 건 모두 자르기 전 소득세분이 1,350,000 이하이고 한도가 그보다 크므로 **자르지 않는다.** GC-47 ~ GC-50은 직전 총급여 50,000,000의 밴드 [2,682,194 , 3,387,500] 안에서 **3,000,000**을, GC-51은 직전 총급여 60,000,000의 밴드 [3,966,133 , 4,812,500] 안에서 **4,300,000**(GC-19·GC-23과 같은 값)을 골랐다. 넷 다 부양가족이 없는 근로자다.

### GC-47 — 새 배분안이 경계 위에 정확히 선다: 연금저축 15,000,000 + IRP 3,000,000 【경계 정확히】

**프로필** 40세 · 총급여 50,000,000 · 근로소득만 · 직전 50,000,000 · **월 1,500,000 × 12 = 예산 18,000,000** · 연금 두 계좌 ytd 0 · ISA 서민형

**기대 결과**

| 항목 | 값 |
|---|---|
| 공제율 | 0.15 |
| 연금 합산 공제한도 · 잔여 | 9,000,000 · 9,000,000 |
| 연금 납입 잔여 | 18,000,000 |
| 연금저축 공제 잔여 | 6,000,000 |
| ISA 납입 잔여 · 비과세 한도 | 20,000,000 · 4,000,000 |
| **`max_tax_credit`** (= `annuity_savings_first`) | 연금저축 6,000,000 + IRP 3,000,000 + ISA 9,000,000 · 인정 9,000,000 · **1,485,000** |
| **`isa_first`** | ISA 18,000,000 · 인정 0 · **0** |
| **`pension_contribution_limit_fill`** | **연금저축 15,000,000 + IRP 3,000,000 + ISA 0** · 인정 **9,000,000** · **1,485,000** |
| 배분안 수 | **3** |

**도출 과정** S1 예산 18,000,000 → S2′ 1단계 아니오 → 총급여 50,000,000 ≤ 55,000,000 → **15%** → S3 납입 잔여 18,000,000 → S5 합산 공제한도 9,000,000 → S8 ISA 잔여 20,000,000 → S9 직전 50,000,000 ≤ 50,000,000 → 서민형 4,000,000.

- `max_tax_credit`: 공제 대상 한도까지만 연금계좌를 채운다. S13 동점이므로 연금저축 6,000,000 먼저, IRP 3,000,000. 남은 예산 9,000,000은 ISA로(잔여 20,000,000). 인정액 = `min(min(6,000,000, 6,000,000) + 3,000,000, 9,000,000)` = 9,000,000 → 1,350,000 / 135,000.
- `pension_contribution_limit_fill`: **1차**가 위와 같이 연금저축 6,000,000 + IRP 3,000,000으로 공제 대상 한도를 채우고, **2차**가 남은 납입 한도 `18,000,000 − 9,000,000 = 9,000,000`을 채운다. 2차는 공제를 낳지 않는 몫이라 세액이 순서를 정하지 못하므로 인출이 자유로운 연금저축이 받는다 → 연금저축 합계 **15,000,000**. 예산이 소진되어 ISA는 0.
- **인정액을 다시 계산한다.** `R = min(min(15,000,000, 6,000,000) + 3,000,000, 9,000,000) = min(9,000,000, 9,000,000) = 9,000,000`. **최대값 `min(L, K) = 9,000,000`과 같다 — 한 원도 잃지 않는다.** S6′의 경계 `L − (K − C) = 18,000,000 − 3,000,000 = 15,000,000`과 `S`가 정확히 일치하기 때문이다.
- S7 두 안 모두 9,000,000 × 0.15 = 1,350,000 / 135,000 / **1,485,000**. S14 한도 3,000,000 > 1,350,000 → 자르지 않음.
- 배분 벡터가 `max_tax_credit` = `annuity_savings_first` ≠ `isa_first` ≠ `fill`이므로 배분안 **3**.
- 월 반올림 잔차 0 — 6,000,000 · 3,000,000 · 9,000,000 · 15,000,000이 모두 12로 나누어떨어진다.

**두 안의 세액공제액이 같다는 것이 이 케이스의 알맹이다.** 연금저축에 9,000,000원을 더 넣고도 올해 공제는 한 원도 늘지 않고, **줄지도 않는다.** 화면이 이 안을 "손해"로도 "이득"으로도 설명할 수 없는 이유가 여기 있다 — 세법이 정하는 것은 **올해 공제가 같다**는 사실 하나뿐이고, 그 돈이 인출이 제한된 계좌에 묶인다는 것과 원금이 인출 시 과세되지 않는다는 것은 다른 축이다.

```golden
{
  "case": "GC-47",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null,
    "options": {
      "plan_variants": ["max_tax_credit", "annuity_savings_first", "isa_first", "pension_contribution_limit_fill"]
    }
  },
  "credit_rate": { "income_tax": 0.15 },
  "expect": {
    "current": {
      "plan_count": 3,
      "limits": {
        "pension_combined_credit_limit_krw": 9000000,
        "pension_combined_credit_remaining_krw": 9000000,
        "pension_contribution_limit_remaining_krw": 18000000,
        "annuity_savings_credit_remaining_krw": 6000000,
        "isa_contribution_remaining_krw": 20000000,
        "isa_tax_free_limit_krw": 4000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 9000000 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "unallocated_krw": 0,
          "monthly_rounding_residual_krw": 0,
          "warning_count": 0
        },
        "isa_first": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 0, "isa": 18000000 },
          "tax_credit": { "income_tax": 0, "local_tax": 0, "total": 0 },
          "credit_eligible_krw": 0,
          "warning_count": 0
        },
        "pension_contribution_limit_fill": {
          "allocation": { "annuity_savings": 15000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "unallocated_krw": 0,
          "monthly_rounding_residual_krw": 0,
          "warning_count": 0
        }
      },
      "notice_codes_absent": [
        "credit_rate_global_income_missing",
        "tax_liability_cap_applied"
      ]
    }
  }
}
```

### GC-48 — 경계 아래: 연금저축 12,000,000인데도 한 원도 잃지 않는다 【경계 아래】

**프로필** 40세 · 총급여 50,000,000 · 근로소득만 · 직전 50,000,000 · 월 1,000,000 × 12 = 예산 12,000,000 · **IRP ytd 6,000,000** · 연금저축 ytd 0 · ISA 서민형

**기대 결과**

| 항목 | 값 |
|---|---|
| 연금 납입 잔여 | 18,000,000 − 6,000,000 = **12,000,000** |
| 연금 합산 공제 잔여 | 9,000,000 − 6,000,000 = **3,000,000** |
| 연금저축 공제 잔여 | **3,000,000** (단독 잔여 6,000,000과 합산 잔여 3,000,000 중 작은 쪽) |
| **`max_tax_credit`** (= `annuity_savings_first`) | 연금저축 3,000,000 + IRP 0 + ISA 9,000,000 · **1,485,000** |
| **`isa_first`** | ISA 12,000,000 · 인정 6,000,000(기납입 IRP) · **990,000** |
| **`pension_contribution_limit_fill`** | **연금저축 12,000,000** + IRP 0 + ISA 0 · 인정 **9,000,000** · **1,485,000** |
| 배분안 수 | **3** |

**도출 과정** S3 납입 잔여 12,000,000 → S6 기납입 인정액 = `min(min(0, 6,000,000) + 6,000,000, 9,000,000)` = 6,000,000 → 합산 공제 잔여 3,000,000. 연금저축의 공제 잔여는 단독 잔여(6,000,000)와 합산 잔여(3,000,000) 중 작은 쪽인 **3,000,000**이다 — 조문이 두 한도를 겹쳐 걸기 때문이고, 계약 5.3절도 계좌별 공제 잔여가 합산 잔여 이하라고 적는다.

- `pension_contribution_limit_fill`: **1차** 동점이므로 연금저축 먼저 → `min(3,000,000, 예산 12,000,000, 납입 잔여 12,000,000)` = 3,000,000. IRP는 합산 잔여가 소진되어 0. **2차** 남은 납입 한도 `12,000,000 − 3,000,000 = 9,000,000`을 연금저축이 받는다 → 연금저축 배분 합계 **12,000,000**.
- 최종 `S = 0 + 12,000,000 = 12,000,000`, `P = 6,000,000`, `L = 18,000,000`. **`S`가 경계 15,000,000보다 작다.**
- 인정액 `R = min(min(12,000,000, 6,000,000) + 6,000,000, 9,000,000) = min(12,000,000, 9,000,000) = 9,000,000`. 최대값 `min(L, K) = 9,000,000`과 같다 → **잃지 않는다.**
- S7 9,000,000 × 0.15 = 1,350,000 / 135,000 / **1,485,000**. `max_tax_credit`도 인정액이 같아 같은 값이다.
- `isa_first`는 연금계좌에 한 원도 넣지 않으므로 인정액이 기납입 IRP 6,000,000뿐이다 → 6,000,000 × 0.15 = 900,000 / 90,000 / **990,000**.

**이 케이스가 보이는 것.** 연금저축에 단독한도의 **두 배**를 넣고도 공제가 줄지 않는다. **경계를 정하는 것은 단독한도가 아니라 `L − (K − C)`이고, 그 둘은 다른 값이다.** 단독한도를 경계로 착각하면 이 배분을 "6,000,000을 넘겼으니 손해"라고 잘못 설명하게 된다.

```golden
{
  "case": "GC-48",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 6000000, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null,
    "options": {
      "plan_variants": ["max_tax_credit", "annuity_savings_first", "isa_first", "pension_contribution_limit_fill"]
    }
  },
  "credit_rate": { "income_tax": 0.15 },
  "expect": {
    "current": {
      "plan_count": 3,
      "limits": {
        "pension_combined_credit_limit_krw": 9000000,
        "pension_combined_credit_remaining_krw": 3000000,
        "pension_contribution_limit_remaining_krw": 12000000,
        "annuity_savings_credit_remaining_krw": 3000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 3000000, "retirement_pension": 0, "isa": 9000000 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "warning_count": 0
        },
        "isa_first": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 0, "isa": 12000000 },
          "tax_credit": { "income_tax": 900000, "local_tax": 90000, "total": 990000 },
          "credit_eligible_krw": 6000000,
          "warning_count": 0
        },
        "pension_contribution_limit_fill": {
          "allocation": { "annuity_savings": 12000000, "retirement_pension": 0, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "unallocated_krw": 0,
          "warning_count": 0
        }
      },
      "notice_codes_absent": ["tax_liability_cap_applied"]
    }
  }
}
```

### GC-49 — 경계 초과: 연금저축이 이미 16,000,000이면 인정액이 1,000,000 줄어든다 【경계 초과】

**프로필** 40세 · 총급여 50,000,000 · 근로소득만 · 직전 50,000,000 · **연금저축 ytd 16,000,000** · IRP ytd 0 · 월 2,000,000 × **1개월** = 예산 2,000,000 · ISA 서민형

**기대 결과**

| 항목 | 값 |
|---|---|
| 연금 납입 잔여 | 18,000,000 − 16,000,000 = **2,000,000** |
| 연금저축 공제 잔여 | **0** (기납입이 단독한도를 넘어 클램프) |
| 연금 합산 공제 잔여 | **3,000,000** |
| **`max_tax_credit`** (= `annuity_savings_first` = `pension_contribution_limit_fill`) | 연금저축 0 + IRP 2,000,000 + ISA 0 · 인정 **8,000,000** · **1,320,000** |
| **`isa_first`** | ISA 2,000,000 · 인정 6,000,000 · **990,000** |
| 배분안 수 | **2** |
| 안내 | `existing_contribution_over_limit` |

**도출 과정** S6 기납입 인정액 = `min(min(16,000,000, 6,000,000) + 0, 9,000,000)` = **6,000,000**. 연금저축은 단독한도를 이미 10,000,000 넘겨 납입했고 **그 초과분은 조문상 "없는 것으로" 본다** — 합산한도에 3,000,000의 여유가 남아 있어도 그 자리에 들어갈 수 없다. 이것이 단서 전단의 비대칭이 실제로 무는 자리다.

- 세 안 모두 연금저축의 공제 잔여가 0이므로 1차에서 연금저축이 아무것도 받지 못하고, IRP가 `min(합산 잔여 3,000,000, 예산 2,000,000, 납입 잔여 2,000,000)` = 2,000,000을 받는다. 2차에 남는 납입 한도가 0이라 `pension_contribution_limit_fill`도 같은 벡터가 되어 **세 안이 하나로 합쳐진다**(계약 6.2절). 합쳐진 안의 id는 6.1절의 고정 순서상 앞에 오는 `max_tax_credit`이므로 **블록은 그 id로 값을 적는다** — `pension_contribution_limit_fill`이라는 이름은 응답에 남지 않는다.
- **예산을 늘려도 이 합쳐짐은 풀리지 않는다.** 연금계좌 납입 잔여가 2,000,000뿐이라 2차가 받을 몫이 애초에 없기 때문이다. `pension_contribution_limit_fill`이 다른 안과 갈리려면 **납입 한도에 여유가 남아 있어야** 하고, 그 여유를 이 사람은 이미 다 써 버렸다.
- 최종 `S = 16,000,000`, `P = 2,000,000`, `L = 18,000,000`. **`S`가 경계 15,000,000을 1,000,000 초과한다.**
- 인정액 `R = min(6,000,000 + 2,000,000, 9,000,000) = 8,000,000`. 최대값 `min(L, K) = 9,000,000`보다 **1,000,000 작다** — 초과분과 정확히 같다.
- S7 8,000,000 × 0.15 = **1,200,000** / 120,000 / **1,320,000**. GC-47의 1,485,000과의 차이 **165,000원**이 `1,000,000 × 0.15 × 1.1`이다.
- S14 한도 3,000,000 > 1,200,000 → 자르지 않음.
- 월 반올림 잔차 0(개월수가 1이라 나눔이 일어나지 않는다).

**되더할 세액공제액을 0으로 둔 것.** 이 사람이 직전 과세기간에도 납입했을 가능성이 있으나 케이스가 그것을 정하지 않았다. 0으로 두면 한도가 작아지는 쪽이고, 그래도 1,200,000 < 3,000,000이라 **이 케이스의 결론은 그 선택에 의존하지 않는다.**

```golden
{
  "case": "GC-49",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 2000000,
      "months_remaining_in_tax_year": 1
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 16000000, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null,
    "options": {
      "plan_variants": ["max_tax_credit", "annuity_savings_first", "isa_first", "pension_contribution_limit_fill"]
    }
  },
  "credit_rate": { "income_tax": 0.15 },
  "expect": {
    "current": {
      "plan_count": 2,
      "limits": {
        "pension_combined_credit_remaining_krw": 3000000,
        "pension_contribution_limit_remaining_krw": 2000000,
        "annuity_savings_credit_remaining_krw": 0
      },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 2000000, "isa": 0 },
          "tax_credit": { "income_tax": 1200000, "local_tax": 120000, "total": 1320000 },
          "credit_eligible_krw": 8000000,
          "unallocated_krw": 0,
          "warning_count": 0
        },
        "isa_first": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 0, "isa": 2000000 },
          "tax_credit": { "income_tax": 900000, "local_tax": 90000, "total": 990000 },
          "credit_eligible_krw": 6000000,
          "warning_count": 0
        }
      },
      "notice_codes": ["existing_contribution_over_limit"],
      "notice_codes_absent": ["tax_liability_cap_applied"]
    }
  }
}
```

### GC-50 — 비대칭이 최대로 무는 자리: IRP가 막히면 18,000,000을 넣어도 인정은 6,000,000 【경계 극단】

**프로필** 40세 · 총급여 50,000,000 · 근로소득만 · 직전 50,000,000 · 월 1,500,000 × 12 = 예산 18,000,000 · 연금 두 계좌 ytd 0 · **IRP 연금수령 개시(`started`)** · ISA 서민형

**기대 결과**

| 항목 | 값 |
|---|---|
| **`max_tax_credit`** (= `annuity_savings_first`) | 연금저축 6,000,000 + ISA 12,000,000 · 인정 **6,000,000** · **990,000** |
| **`isa_first`** | ISA 18,000,000 · 인정 0 · **0** |
| **`pension_contribution_limit_fill`** | **연금저축 18,000,000** · 인정 **6,000,000** · **990,000** |
| 배분안 수 | **3** |
| 안내 | `pension_contribution_blocked_annuity_started` |

**도출 과정** S16 IRP가 `started`이므로 그 계좌의 납입은 연금보험료로 인정되지 않아 **배분 대상에서 빠진다.** 남은 계좌는 연금저축뿐이고, 그 계좌의 공제 상한은 단독한도 **6,000,000**이다(합산한도 9,000,000이 아니다 — GC-36과 같은 구조).

- `pension_contribution_limit_fill`: **1차** 연금저축 6,000,000(단독 공제한도). **2차** 남은 납입 한도 `18,000,000 − 6,000,000 = 12,000,000`을 연금저축이 받는다 → 연금저축 **18,000,000**. 예산이 소진되어 ISA 0.
- 최종 `S = 18,000,000`, `P = 0`, `L = 18,000,000`. 인정액 `R = min(min(18,000,000, 6,000,000) + 0, 9,000,000) = 6,000,000`.
- **최대값 `min(L, K) = 9,000,000`에 3,000,000 못 미친다.** 그런데 이 사람에게는 그 3,000,000을 되찾을 방법이 없다 — 되찾으려면 퇴직연금계좌에 넣어야 하는데 그 계좌가 막혀 있다. **`K − C = 3,000,000`은 퇴직연금계좌를 통해서만 열리는 자리이고, 그것이 단서의 비대칭이다.**
- S7 6,000,000 × 0.15 = 900,000 / 90,000 / **990,000**. S14 한도 3,000,000 > 900,000 → 자르지 않음.
- `max_tax_credit`은 연금저축 6,000,000에서 멈추고 남은 12,000,000을 ISA로 보낸다. **두 안의 공제액이 같다** — 연금계좌에 12,000,000을 더 넣어도 공제가 늘지 않는다.

**이 케이스가 GC-36에 더하는 것.** GC-36은 "IRP가 막히면 상한이 연금저축 단독한도로 좁아진다"를 확인한다. 이 케이스는 그 위에서 **새 배분안이 그 좁아진 상한을 넘겨 납입할 때 인정액이 어떻게 되는지**를 확인한다 — 넘긴 12,000,000은 인정액을 한 원도 늘리지 않는다.

```golden
{
  "case": "GC-50",
  "request": {
    "scenarios": ["current"],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 50000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "started" },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null,
    "options": {
      "plan_variants": ["max_tax_credit", "annuity_savings_first", "isa_first", "pension_contribution_limit_fill"]
    }
  },
  "credit_rate": { "income_tax": 0.15 },
  "expect": {
    "current": {
      "plan_count": 3,
      "limits": {
        "pension_contribution_limit_remaining_krw": 18000000,
        "annuity_savings_credit_remaining_krw": 6000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 0, "isa": 12000000 },
          "tax_credit": { "income_tax": 900000, "local_tax": 90000, "total": 990000 },
          "credit_eligible_krw": 6000000,
          "warning_count": 0
        },
        "pension_contribution_limit_fill": {
          "allocation": { "annuity_savings": 18000000, "retirement_pension": 0, "isa": 0 },
          "tax_credit": { "income_tax": 900000, "local_tax": 90000, "total": 990000 },
          "credit_eligible_krw": 6000000,
          "unallocated_krw": 0,
          "warning_count": 0
        }
      },
      "notice_codes": ["pension_contribution_blocked_annuity_started"],
      "notice_codes_absent": ["tax_liability_cap_applied"]
    }
  }
}
```

### 11.3 개정안 청년 우대가 새 배분안에 걸릴 때 — 순서가 뒤집힌다 (GC-51)

**확정 시나리오에서 이 안의 1차 순서는 연금저축 먼저다.** 두 연금계좌의 한계 공제율이 같아 동점이고, 동점이면 인출이 자유로운 계좌가 먼저이기 때문이다(계약 0.4절). **개정안 + 청년이면 그 전제가 깨진다** — IRP 납입분에 15%, 연금저축 납입분에 12%가 걸려 한계 공제율이 갈리므로 **1차는 세액공제 최대화가 순서를 정하고 IRP가 먼저 받는다.** 인출 편의로 세액을 깎지 않는다는 원칙이 여기서 작동한다.

**2차는 여전히 연금저축 먼저다.** 2차는 공제 대상 한도를 이미 넘긴 몫이라 **어느 계좌에 넣어도 공제가 0**이고, 그러면 청년 우대가 걸려 있든 아니든 두 계좌의 한계 공제율이 다시 같아진다(둘 다 0). 남는 축이 인출 가능성뿐이므로 인출이 자유로운 연금저축이 받는다. **즉 같은 배분안 안에서 1차와 2차의 순서 근거가 다르고, 개정안에서는 그 둘이 서로 반대 방향을 가리킨다.**

### GC-51 — 새 배분안 × 청년 IRP 우대: 같은 총액, 다른 분할, 다른 세액 【D17 전제 · 경계】

**프로필** 30세 · 총급여 **60,000,000**(12% 구간) · 근로소득만 · 직전 60,000,000 · `declared_youth: true` · 월 1,500,000 × 12 = 예산 18,000,000 · 연금 두 계좌 ytd 0 · ISA 일반형 · `scenarios: ["current", "proposed"]`

**기대 결과**

| 시나리오 | 배분안 | 배분 (연금저축 / IRP / ISA) | 인정액 (연금저축 / IRP) | 세액공제 |
|---|---|---|---|---|
| 확정 | `max_tax_credit` (= `annuity_savings_first`) | 6,000,000 / 3,000,000 / 9,000,000 | 6,000,000 / 3,000,000 | 1,080,000 / 108,000 / **1,188,000** |
| 확정 | `isa_first` | 0 / 0 / 18,000,000 | 0 / 0 | 0 / 0 / **0** |
| 확정 | **`pension_contribution_limit_fill`** | **15,000,000 / 3,000,000 / 0** | 6,000,000 / 3,000,000 | 1,080,000 / 108,000 / **1,188,000** |
| 확정 | 배분안 수 | **3** | | |
| 개정안 | `max_tax_credit` | 0 / 9,000,000 / 9,000,000 | 0 / 9,000,000 | 1,350,000 / 135,000 / **1,485,000** |
| 개정안 | `annuity_savings_first` | 6,000,000 / **9,000,000** / 3,000,000 | **0 / 9,000,000** | 1,350,000 / 135,000 / **1,485,000** |
| 개정안 | `isa_first` | 0 / 0 / 18,000,000 | 0 / 0 | 0 / 0 / **0** |
| 개정안 | **`pension_contribution_limit_fill`** | **9,000,000 / 9,000,000 / 0** | 0 / 9,000,000 | 1,350,000 / 135,000 / **1,485,000** |
| 개정안 | 배분안 수 | **4** | | |

**도출 과정 — 확정 시나리오** S2′ 1단계 아니오 → 총급여 60,000,000 > 55,000,000 → **12%**. 두 계좌의 한계 공제율이 같으므로 동점이다. `pension_contribution_limit_fill`의 1차는 연금저축 6,000,000 + IRP 3,000,000, 2차는 남은 납입 한도 9,000,000이 연금저축으로 → **연금저축 15,000,000 + IRP 3,000,000.** GC-47과 같은 구조이고 공제율만 12%다. 인정액 `R = min(6,000,000 + 3,000,000, 9,000,000) = 9,000,000` → 9,000,000 × 0.12 = 1,080,000 / 108,000.

**도출 과정 — 개정안 시나리오** `proposed.pension.credit.youth_irp_rate`가 퇴직연금계좌 납입분에 소득수준과 무관하게 **15%**를 주고, 연금저축 납입분은 `pension.credit.rate`의 12% 그대로다. **한계 공제율이 갈리므로 동점이 아니다.**

- **1차** 세액공제 최대화가 순서를 정한다 → IRP가 먼저 받고, 퇴직연금계좌에는 단독한도가 없으므로 합산한도 **9,000,000 전액**을 가져간다. 연금저축은 1차에서 0이다.
- **2차** 남은 납입 한도 `18,000,000 − 9,000,000 = 9,000,000`은 공제를 낳지 않는 몫이라 두 계좌의 한계 공제율이 다시 0으로 같아진다 → 인출이 자유로운 **연금저축**이 받는다.
- 최종 배분 **연금저축 9,000,000 + IRP 9,000,000**, `L = 18,000,000`.
- 인정액을 D17(합산한도 절단 시 IRP 우선 인정)로 나눈다 — `IRP인정 = min(9,000,000, 9,000,000) = 9,000,000`, `연금저축인정 = min(9,000,000, 6,000,000, 9,000,000 − 9,000,000) = 0`.
- S7 9,000,000 × **0.15** + 0 × 0.12 = **1,350,000** 소득세, 지방세 135,000 → **1,485,000**.
- `annuity_savings_first`는 연금저축을 먼저 단독한도 6,000,000까지 채운 **뒤에도 세액공제를 최대화한다.** 그 뒤의 IRP 상한은 잔여 공제한도(3,000,000)가 **아니라** "IRP 인정액이 합산한도에 닿는 지점"인 **9,000,000**이다 — 추가 IRP 납입이 이미 인정된 연금저축분을 공제 풀에서 밀어내고 밀려난 만큼이 12%에서 15%로 갈아타기 때문이다. `IRP인정 = min(9,000,000, 9,000,000) = 9,000,000`, `연금저축인정 = min(6,000,000, 6,000,000, 0) = 0` → 9,000,000 × 0.15 = **1,350,000** 소득세 → 1,485,000. 남은 예산 3,000,000이 ISA로 간다.
  - **이 자리에서 이 문서가 한 번 틀렸다.** 처음 산출할 때 IRP 상한을 잔여 공제한도 3,000,000으로 잡아 1,287,000을 적었고, 대조에서 엔진과 어긋나 다시 계산한 결과 **정답지가 틀렸다.** 잔여 공제한도를 배분 상한으로 쓰는 것이 4단계 M1이 이미 잡은 결함(`engine-design.md` 6.4절)과 정확히 같은 형태인데, 그것을 알고 있으면서 `max_tax_credit`에만 적용하고 이 안에는 적용하지 않았다. **계약 5.3절이 "`credit_eligible_limit_remaining_krw`는 배분 상한이 아니다"라고 이름까지 붙여 경고한 자리다.** 경위는 `verification-report.md` 12차에 남긴다.
- 개정안에서는 네 안의 배분 벡터가 모두 달라 합쳐지지 않는다 → 배분안 **4**. 계약 10절이 "4를 전제로 레이아웃을 짜라"고 적은 상황이 실제로 나타나는 자리다.
- **`annuity_savings_first`와 `pension_contribution_limit_fill`의 세액공제액이 같아진다**(둘 다 1,485,000). 두 안이 갈리는 것은 **남은 3,000,000이 ISA로 가느냐 연금저축으로 더 가느냐**이고, 그 선택을 세법이 정하지 않는다.

**S`가 경계를 넘지 않는다.** 개정안의 `S = 9,000,000`은 경계 15,000,000보다 작으므로 인정액이 최대값 `min(L, K) = 9,000,000`을 유지한다. **1차 순서가 뒤집혔는데도 경계를 넘지 않는 이유는, IRP가 1차에서 더 많이(9,000,000) 가져갈수록 2차에서 연금저축이 받는 몫이 줄기 때문이다.** 즉 이 배분안은 어느 순서에서든 `S ≤ L − (K − C)`를 지킨다 — IRP가 받을 수 있는 한.

**D17 전제.** 개정안 값은 GC-19c·GC-23과 같은 전제 위에 있다. 반대 해석(연금저축 우선 인정)이면 `연금저축인정 6,000,000 × 0.12 + IRP인정 3,000,000 × 0.15` = 1,170,000이 되어 `pension_contribution_limit_fill`과 `annuity_savings_first`의 세액이 같아진다. **조문이 정하지 않는 사안이며 관리자 판정이다.**

**세액 한도** 직전 총급여 60,000,000의 밴드 [3,966,133 , 4,812,500] 안의 **4,300,000**을 골랐다(GC-19·GC-23과 같은 값). 자르기 전 소득세분 최대 1,350,000보다 크므로 **자르지 않는다** — 청년 우대의 효과가 한도에 가려지면 이 케이스가 보려는 것이 사라진다.

```golden
{
  "case": "GC-51",
  "request": {
    "scenarios": ["current", "proposed"],
    "profile": {
      "birth_date": "1996-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 4300000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 60000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 60000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": true,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 1500000,
      "months_remaining_in_tax_year": 12
    },
    "accounts": {
      "annuity_savings": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "retirement_pension": { "ytd_contribution_krw": 0, "annuity_start_status": "not_started" },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null,
    "options": {
      "plan_variants": ["max_tax_credit", "annuity_savings_first", "isa_first", "pension_contribution_limit_fill"]
    }
  },
  "credit_rate": { "income_tax": 0.12 },
  "expect": {
    "current": {
      "plan_count": 3,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 9000000 },
          "tax_credit": { "income_tax": 1080000, "local_tax": 108000, "total": 1188000 },
          "credit_eligible_krw": 9000000,
          "warning_count": 0
        },
        "pension_contribution_limit_fill": {
          "allocation": { "annuity_savings": 15000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1080000, "local_tax": 108000, "total": 1188000 },
          "credit_eligible_krw": 9000000,
          "unallocated_krw": 0,
          "warning_count": 0
        }
      },
      "notice_codes_absent": ["tax_liability_cap_applied"]
    },
    "proposed": {
      "plan_count": 4,
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 9000000, "isa": 9000000 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "warning_count": 0
        },
        "annuity_savings_first": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 9000000, "isa": 3000000 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "warning_count": 0
        },
        "isa_first": {
          "allocation": { "annuity_savings": 0, "retirement_pension": 0, "isa": 18000000 },
          "tax_credit": { "income_tax": 0, "local_tax": 0, "total": 0 },
          "credit_eligible_krw": 0,
          "warning_count": 0
        },
        "pension_contribution_limit_fill": {
          "allocation": { "annuity_savings": 9000000, "retirement_pension": 9000000, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "credit_eligible_krw": 9000000,
          "unallocated_krw": 0,
          "warning_count": 0
        }
      },
      "notice_codes_absent": ["tax_liability_cap_applied"]
    }
  }
}
```

### 11.4 이번에도 적지 못한 것 — 세 축 중 하나가 남는다

> **13차 갱신 — 이 절의 (가)·(나)가 둘 다 해소됐다.** `calc-engine-dev`가 시나리오 단위에 `legal_basis`를 열었고 `credit_rate`의 네 키를 미사용 목록에서 풀었다. **(나)는 GC-40~46이 이 회차에 채웠고**(`basis`·`measured_amount`·`fallback_applied`·`fallback_direction`), **(가)는 여덟 개 케이스가 채웠다.** 다만 (가)에는 대조가 어긋난 건이 하나 남는다 — 12.6절. 아래 서술은 12차 시점의 기록이다.

**(가) 규칙별 미확인 건수 — 블록 어휘가 아직 없다.** 계약 5.7.1절이 `LegalBasisEntry.uncertainty_notes`를 목록으로 만들면서 **"정답지가 규칙별 미확인 건수를 주장하면 줄어든 사실이 대조에 걸린다"**를 첫 번째 방어선으로 지목했다. 이 회차에 그것을 채우려 했으나 **실행기의 블록 어휘에 그 축을 실을 자리가 없다.** 확인한 허용 키는 다음이 전부다.

| 자리 | 허용 키 |
|---|---|
| 블록 최상위 | `case` · `request` · `credit_rate` · `expect` |
| 시나리오 단위 | `plans` · `plan_count` · `baseline_plan` · `isa_eligible` · `isa_reason_codes` · `limits` · `boundaries` · `pension_withdrawal_start` · `notice_codes` · `notice_codes_absent` · `comparison_note_codes` · `comparison_note_codes_absent` |

**`legal_basis`도 `uncertainty_notes`도 어느 자리에도 없다.** 1-A.1절이 6차에 적은 것과 같은 형태의 공백이고, 필요한 것은 시나리오 단위 키 하나다 — 규칙 id를 키로, 그 규칙의 `uncertainty_notes` **건수**를 값으로 두는 형태(예: `uncertainty_note_counts: { "isa.tax_free_limit": 3 }`). **건수만 있으면 충분하다** — 이 축이 막으려는 것은 "작성자가 지워서는 안 될 표시를 지운 경우"이고 그것은 건수의 감소로 나타난다.

**룰셋 쪽은 이 회차에 준비를 마쳤다.** `isa.tax_free_limit.value.unverified`를 한 문자열에서 **항목 배열 3개**로 바꿨다(11.5절). 키가 생기는 회차에 정답지가 바로 `3`을 주장할 수 있다.

**(나) `credit_rate.basis`와 `credit_rate.fallback_applied`.** 어휘에는 있으나 **실행기의 `UNUSED_VOCABULARY` 목록에 아직 올라 있어**, 쓰면 "이제 쓰이는데 목록에 남아 있다"로 실패한다. 그 목록은 `src/engine/golden-cases.test.mjs`에 있고 이 유닛의 산출물이 아니다. 그래서 이번에는 `credit_rate.income_tax` 하나만 적었다.

**무엇을 잃었는지 분명히 적는다.** `income_tax`만으로도 GC-40 ~ GC-46의 **공제율 값**은 전부 검사된다. 검사되지 않는 것은 **엔진이 그 값을 어느 축으로 잰 것인지**다 — 예컨대 GC-44에서 엔진이 종합소득금액 45,000,001을 재서 12%를 냈는지, 아니면 다른 이유로 우연히 12%를 냈는지를 블록이 가리지 못한다. **`basis`가 있으면 그 구분이 값이 된다.** 다만 GC-43/44/45가 1원 간격으로 서 있고 셋 다 총급여는 같으므로, **축을 잘못 골랐다면 세 건이 같은 값을 내야 하는데 실제로는 갈린다** — 축 자체는 이 세 건의 조합이 간접적으로 잡는다.

**`calc-engine-dev`에게 요청하는 것은 둘이다.** (1) `UNUSED_VOCABULARY`에서 `credit_rate.basis` · `credit_rate.effective` · `credit_rate.fallback_applied` · `credit_rate.local_tax`를 지운다. (2) 시나리오 단위에 규칙별 미확인 건수 키를 하나 연다. **둘 다 열리면 이 문서가 같은 회차 안에 값을 채운다 — 산출은 끝나 있다.**

### 11.5 함께 판정한 것 — `isa.tax_free_limit`의 미확인 셋을 배열로 열었다

계약 5.7.1절이 이 유닛의 판단 사항으로 넘긴 물음에 답한다.

**판정: 미확인은 항목 배열로 적는다. 한 원소에 미확인 하나.**

근거는 계약이 스스로 적은 것 그대로다 — **세는 단위가 '사실'이 아니라 '표시의 위치'**이므로, 사실 하나가 자기 위치를 갖지 못하면 그 사실이 해소되어도 값이 움직이지 않는다. `isa.tax_free_limit`은 한 문자열에 셋을 담고 있어 **하나를 해소해도 건수가 3에서 2로 줄지 않았다.**

바꾼 내용은 셋이다.

1. `value.unverified`를 **문자열에서 3원소 배열로** 바꿨다. 각 원소가 자기 자리(`value.unverified[0]` ~ `[2]`)를 갖는다.
2. 이미 해소된 항목(농어민형 400만원의 근거 호를 다목으로 특정한 것)을 배열에서 빼 `value.unverified_resolved`로 옮겼다. **키 이름에 `unverified`를 쓰지 않은 것이 요점이다** — 해소된 것이 계속 세어지면 건수가 줄어든 사실이 보이지 않는다.
3. 원소 문장에 '미확인'이라는 낱말을 쓰지 않고 '확인하지 못했다'로 적었다. 계약 5.7.1절의 `kind`가 `unverified`(키 이름)와 `text_marker`(본문 낱말)를 따로 세므로, 같은 자리에서 둘이 겹치면 건수가 부풀어 **줄어든 사실이 다시 흐려진다.**

**작성 규약을 룰셋 안에 함께 박았다** — `isa.tax_free_limit.value.unverified_is_an_array_on_purpose`. 다음 작성자가 이 규칙을 고칠 때 규약을 문서가 아니라 값에서 읽는다.

**다른 규칙은 이번에 바꾸지 않았다.** 2026-08-10에 두 룰셋 파일의 `unverified` 12곳을 전수 확인한 결과 나머지 11곳은 전부 미확인 하나만 담고 있어 문자열 그대로도 위 원칙을 이미 지킨다. **둘 이상을 적게 되는 자리에서 배열로 연다.**

**이 판정이 닫지 못하는 것.** 계약 5.7.1절이 적은 대로, **엔진은 룰셋을 비출 뿐이므로 작성자가 지워서는 안 될 표시를 지운 경우는 여전히 엔진이 잡지 못한다.** 배열로 바꾼 것은 그 사실이 **값에 나타나게** 만든 것이지 잡은 것이 아니다. 실제로 잡으려면 11.4절 (가)의 블록 키가 필요하고, 그것이 없는 동안 이 방어선은 비어 있다.

---

## 12. 13차 — 7차의 아홉 건에 블록을 달았다 (GC-52 ~ GC-61, 2026-08-10)

계약 `5.1.0`이 `profile.isa_return_assumption`과 `Plan.assumption_based_isa_estimate`를 들였고, 10.0절이 정한 조건("계약이 위 두 필드를 들이는 회차에 이 아홉 건을 `GC-` 번호로 옮기고 블록을 단다")이 **성립했다.**

**기대값을 다시 산출하지 않았다.** 10.2절 표의 아홉 값이 먼저이고 이 절은 그것을 옮겨 적은 것이다. 산술은 10.3절에서 이미 검산했고 이 절이 다시 하지 않는다.

| 7차 이름 | 이 절의 번호 | 옮기면서 달라진 것 |
|---|---|---|
| RF-1 | **GC-52** | 없다 |
| RF-2 | **GC-53** | 없다 |
| RF-3 | **GC-54** | 없다 |
| RF-4 | **GC-55** | 없다 |
| RF-5 | **GC-56** | 없다 |
| RF-6 | **GC-57** | **혜택 0을 점이 아니라 구간의 아래 끝으로 적었다.** 12.2절 |
| RF-7 | **GC-58** | **케이스를 다시 적었다.** 원래 형태로는 엔진이 낼 수 없다. 12.3절 |
| RF-8 | **GC-59** | 없다 |
| RF-9 | **GC-60** | 없다 |

**GC-61은 7차의 아홉 건이 아니다.** 규칙별 미확인 건수 축의 한 건이며 12.6절에서 따로 다룬다.

### 12.1 케이스의 정의로 새로 고른 것 — 원금·수익률·정산 기간

10.2절의 표는 **`G`(이익의 합계)로** 케이스를 적었다. 요청은 `G`를 직접 받지 않고 **원금 × 수익률 × 기간**을 받으므로, 같은 `G`를 낳는 셋을 이 절에서 골라야 했다. **기대값이 아니라 케이스의 정의이고**, S15가 `prior_year_tax`에 세운 것과 같은 성격이다.

**고른 기준 셋.**

1. **월 납입 여력을 0으로 두었다**(GC-58만 예외). 원금은 `누적 납입액 + 그 안의 ISA 배분액`인데(계약 5.14절), 배분액은 배분안마다 다르다. 예산이 0이면 배분액이 어느 안에서도 0이라 **원금이 배분안과 무관해지고**, 아홉 건이 보려는 것(산식)만 남는다. GC-08이 예산 0에서 결과가 정상 산출됨을 이미 고정해 두었다.
2. **수익률을 전부 0.1로 고정하고 누적 납입액으로 `G`를 맞췄다.** 두 축을 함께 움직이면 어느 쪽이 값을 바꿨는지 대조가 가리지 못한다.
3. **정산 기간을 명시적으로 주었다.** 주지 않으면 룰셋의 계약기간 하한 3년이 대신 들어가고(`isa_settlement_years_defaulted_to_min_contract_years`), 그러면 GC-60이 보려는 **1년치와 3년치의 차이**가 케이스 정의에 섞인다.

| 케이스 | 누적 납입액 | 수익률 | 정산 기간 | `R` | 10.2절의 `G` |
|---|---|---|---|---|---|
| GC-52 | 20,000,000 | 0.1 | 1 | 2,000,000 | 2,000,000 |
| GC-53 | 21,000,000 | 0.1 | 1 | 2,100,000 | 2,100,000 |
| GC-54 | 40,000,000 | 0.1 | 1 | 4,000,000 | 4,000,000 |
| GC-55 | 50,000,000 | 0.1 | 1 | 5,000,000 | 5,000,000 (손실 2,000,000) |
| GC-56 | 30,000,000 | 0.1 | 1 | 3,000,000 | 3,000,000 (손실 2,000,000) |
| GC-57 | 20,000,000 | 0.1 | 1 | 2,000,000 | 성격이 정하는 구간 |
| GC-58 | 20,000,000 + 배분 12,000,000 | 0.1 | 1 | 3,200,000 | 12.3절에서 새로 산출 |
| GC-59 | 20,000,000 | 0.1 | 1 | 2,000,000 | 성격이 정하는 구간 |
| GC-60 | 20,000,000 | 0.1 | **3** | 6,000,000 | 6,000,000 |

**GC-52와 GC-60이 같은 계좌다.** 누적 납입액도 수익률도 같고 정산 기간만 1년과 3년으로 다르다. 그래서 두 케이스의 값을 나란히 놓으면 10.2절이 말한 1.75배가 그대로 나온다 — `308,000 × 3 = 924,000` 대 `528,000`. **연간 환산이 틀린다는 사실이 두 케이스의 차이로 검사된다.**

### 12.2 GC-57 — 「혜택 0」은 점이 아니라 구간의 아래 끝이다 (`calc-engine-dev`의 지적을 확인했다)

**지적이 맞다. 룰셋을 다시 읽고 확인했다.**

`isa.benefit.income_character`의 `what_to_ask_instead.options`에서 `listed_equity_capital_gain`의 `s_range`는 **`0 ≤ s < 1`**이고 `result`가 **"구간 [0, 상한]. 점을 낼 수 없다"**이다. 같은 규칙의 `upper_bound_definition`이 상한을 "`isa.benefit.formula`의 benefit을 `s = 1`로 두고 계산한 값"으로, `lower_bound_definition`이 하한을 0으로 정한다.

**7차의 표가 왜 0을 점처럼 적었나.** 표의 프로필 칸이 "수익이 **전부** 국내 상장주식 매매차익 (`s` = 0)"이었다. 그 문장은 `s`를 0으로 **고정한 뒤의** 값을 적은 것이고, 그러면 답은 정말로 0이다. 그러나 요청이 받는 것은 `s`가 아니라 **선택지**이고, 그 선택지가 정하는 것은 값이 아니라 구간이다. 같은 종목의 배당금이 `s`에 들어가므로 사용자가 이 선택지를 골라도 `s = 0`이라는 사실이 따라 나오지 않는다.

**그러므로 GC-57의 정답은 `lower_bound_krw: 0` · `upper_bound_krw: 308,000` · `point_estimate_krw: null`이다.** 0은 사라지지 않았고 **아래 끝으로 자리를 옮겼다.** 점으로 적었다면 조문에 없는 수치가 금액이 되는 것이고, 그것은 이 규칙이 `display_rule`로 금지한 바로 그 형태다.

**GC-57과 GC-59가 같은 값을 내는 것도 확인해 둔다.** `mixed_or_unknown`의 구간은 `0 ≤ s ≤ 1`, `listed_equity_capital_gain`은 `0 ≤ s < 1`이고 **양 끝이 같다.** 두 선택지가 가르는 것은 구간이 아니라 사용자가 무엇을 진술했는가이며, 금액으로는 갈리지 않는다. 이 사실을 두 케이스가 함께 고정한다.

### 12.3 GC-58 — RF-7을 어떻게 할지 정했다: **입력을 새로 요구하지 않고, 가정 아래에서만 성립하는 케이스로 다시 적는다**

**`calc-engine-dev`의 지적이 맞다.** 해지는 사실이 아니라 미래의 선택이고 요청에 그 입력이 없다. `fund_use_horizon: within_isa_lock_in`으로 대신 판정하는 것은 "쓸 **가능성**이 있다"는 진술을 "해지한다"로 바꿔 읽는 것이라 D14에 정면으로 어긋난다.

**두 길 중 어느 쪽을 고를 것인가.**

| 길 | 무엇을 얻나 | 무엇을 잃나 |
|---|---|---|
| (가) 해지 여부를 새 입력으로 받는다 | RF-7의 답(혜택 0)을 그대로 실행할 수 있다 | **입력이 하나 는다.** D13이 입력 수를 완료율의 문제로 못박았고, 무엇보다 **사용자가 "해지하겠다"를 미리 답할 수 있는 물음이 아니다.** 답을 강요하면 그 답이 곧 지어낸 값이 된다 |
| (나) 가정 아래에서만 성립하는 케이스로 다시 적는다 | 입력을 늘리지 않고, **가정과 그 가정을 무너뜨리는 사실이 한 화면에 함께 나가는지**를 검사한다 | RF-7의 「혜택 0」 자체는 실행되지 않는다 |

**(나)를 고른다.** 근거는 계약 5.14절이 이 자리에 이미 답을 두었다는 것이다 — `assumes_contract_held_to_settlement`가 **상수 `true`**이고, 그 문단이 "화면은 이 상수와 같은 안의 `warnings`(`early_termination_clawback_isa`)를 **함께** 읽어야 한다"고 정한다. **즉 「해지하면 0」은 금액이 아니라 금액 옆의 경고가 지는 몫이다.** 그러면 검사해야 할 것은 "혜택이 0인가"가 아니라 **"그 경고가 그 금액과 같은 안에 실려 있는가"**이고, 그것은 지금의 요청으로 검사할 수 있다.

**그래서 GC-58은 둘을 한 안에서 함께 주장한다.**

1. 금액이 **0이 아니다** — 계약을 유지한다는 전제 위의 374,000원이다.
2. 같은 안의 `warning_codes`가 **정확히** `["early_termination_clawback_isa"]`이다. 하나라도 빠지면 사용자는 전제가 있는 줄 모르고 금액만 본다.

**프로필을 이렇게 세운 이유.** 경고가 성립하려면 ISA 배분액이 0보다 커야 하므로(계약 8.4절) 이 케이스만 예산을 0으로 두지 않았다. 그러면 원금이 배분안에 따라 갈리는 문제가 되살아나므로, **연금 두 계좌를 `started`로 두어** 예산 전액이 어느 안에서나 ISA로 가게 했다. 가입경과연수 1년이라 잔여 의무가입기간이 2년이고, 그래야 M2가 좁힌 조건(잔여 > 0)을 통과해 경고가 실제로 나간다 — 그 조건의 반대편은 GC-21·GC-27이 이미 고정하고 있다.

**산출.** 원금 `20,000,000 + 12,000,000 = 32,000,000` → `R = 3,200,000` → `G = N = 3,200,000` → ISA 쪽 세액 `(3,200,000 − 2,000,000) × 0.09 × 1.1 = 118,800` → 비교 기준 세액 `3,200,000 × 0.14 × 1.1 = 492,800` → 혜택 **374,000**. 세 축 `0 + 308,000 + 66,000 = 374,000` ✓.

**남는 것을 분명히 적는다.** RF-7이 적은 「의무가입기간 전 해지 → 혜택 0」은 **세법의 답으로 여전히 유효하고**(조특법 §91조의18 ⑦, 룰셋 `isa.early_termination.clawback`), 다만 **이 서비스의 지금 입력으로는 실행되지 않는다.** 해지 여부를 입력으로 받을지는 관리자·`product-planner` 판정 사항이며 `open_questions`에 남긴다. 여기서 이 유닛이 한 것은 **답을 지운 것이 아니라 검사할 수 있는 부분만 검사에 올린 것**이다.

### 12.4 아홉 건 공통 — 블록이 주장하는 것

- **`is_annual: false`와 `settlement_years`.** 이 금액이 몇 년치인지가 값으로 실린다. `isa.benefit.settlement_period`의 `engine_rule`이 요구한 바로 그것이다.
- **`taxable_share_min` / `taxable_share_max`.** 성격이 정하는 구간의 양 끝. 점을 낼 수 있는 케이스에서는 둘이 같고, 낼 수 없는 케이스에서는 갈린다.
- **`comparison_side_tax_krw`가 `G`에서 나온다.** 10.1절 ⑥이 "`N`이 아니라 `G`"라고 못박은 자리다. GC-55·GC-56이 손실이 있는 케이스이므로, 비교 기준을 `N`으로 잘못 잡으면 두 건의 값이 각각 308,000원 작아져 즉시 걸린다.
- **`axis_breakdown` 네 칸.** 셋의 합 + 절사 잔차가 `upper_bound_krw`와 같다. 손익통산 축이 혜택의 일부라는 사실이 합계에 삼켜지지 않는지를 GC-55·GC-56이 본다.
- **`isa_return_estimate_reported_as_range`를 양방향으로 적었다.** 구간인 두 건(GC-57·GC-59)에는 있어야 하고 점인 여섯 건에는 없어야 한다.

### 12.5 블록에 적지 못한 것 둘

계약 5.14절이 정한 필드 중 **`assumes_contract_held_to_settlement`와 `is_lower_bound_for_aggregate_taxpayer`가 실행기의 허용 키에 없다.** 둘 다 상수이므로 값이 틀릴 여지는 없으나, **상수가 사라지는 것**은 이 축이 잡아야 할 사고다. GC-58이 그중 앞의 것을 경고로 우회해 잡고 있고, 뒤의 것(금융소득종합과세 대상자에게 이 값이 하한이라는 표시)은 **어느 케이스도 주장하지 못한다.**

### 12.6 GC-61 — 이 케이스는 **지금 빨간색이고, 그것이 이 케이스가 하는 일이다**

**주장:** `isa.tax_free_limit`의 미확인 표시가 **3건**이고 그 자리가 `unverified[0]` · `unverified[1]` · `unverified[2]`다.

**근거:** 12차에 이 규칙의 `value.unverified`를 **3원소 배열**로 열었다(11.5절). 계약 5.7.1절이 그 형태를 지시했다 — "미확인을 산문 한 덩어리가 아니라 **항목 배열**로 적으면(각 항목이 자기 자리를 갖는다) 이 구조가 그대로 셀 수 있다." 같은 절의 `UncertaintyNote.path` 정의도 "배열은 `items[1]`처럼 첨자를 단다"고 적는다. 룰셋에는 지금 확인하지 못한 항목이 셋 들어 있고 각자 자기 첨자를 갖는다.

**엔진이 내는 것은 1건이다** — 경로 `unverified`, 종류 `unverified`. **배열을 펼치지 않고 키 하나를 표시 하나로 센다.**

**어느 쪽이 틀렸다고 보는가 — 엔진 쪽이라고 본다. 다만 단정하지 않는다.**

| 읽기 | 근거 | 귀결 |
|---|---|---|
| **(가) 배열 원소마다 한 건** (이 문서의 주장) | 5.7.1절이 배열 형태를 **구멍을 닫는 방법으로** 지시했고, `path` 정의가 배열에 첨자를 달라고 적는다 | 셋 중 하나가 해소되면 건수가 3 → 2로 줄어 **값에 나타난다.** 이 축을 만든 목적이 그것이다 |
| **(나) `unverified` 키 하나가 표시 하나** (엔진의 동작) | `path`의 첨자 규정을 "표시에 이르는 **경로 위의** 배열"로 읽으면 성립한다. 실제로 `isa.benefit.settlement_period`의 경로가 `statutory_basis[1].unverified`로 그 형태다 | **12차의 배열 전환이 아무것도 바꾸지 않는다.** 원소 하나를 지워도 건수가 1에서 그대로 1이고, 5.7.1절이 이름으로 지목한 구멍이 열린 채 남는다 |

**(나)가 성립하면 계약 5.7.1절의 결론 문단이 거짓이 된다.** 그 문단은 룰셋을 배열로 바꾸는 것으로 구멍이 닫힌다고 적었고, 이 유닛은 그 지시를 따라 룰셋을 고쳤다. 고친 뒤에도 건수가 1이면 **고친 이유가 사라진다.**

**그래서 이 케이스를 지우거나 1로 낮춰 적지 않는다.** 1로 적으면 초록색이 되지만, 그 순간 이 문서가 엔진의 동작을 정답으로 옮겨 적은 것이 되고 — 정답지가 해서는 안 되는 유일한 일이다. **판정은 관리자가 한다.** 판정이 (나)로 나면 이 케이스를 지우고 계약 5.7.1절의 해당 문단을 함께 고쳐야 한다.

**케이스를 따로 세운 이유.** 이 주장을 GC-40에 얹으면 GC-40의 나머지 주장(공제율 축·배분·한도)이 같은 실패에 묻혀 검사되지 않는다. **빨간색 하나가 초록색 여럿을 가리지 않게** 자리를 분리했다.

**함께 고친 것 — 이 규칙의 건수가 3이 아니라 7로 세어지고 있었다.** 12차에 넣은 메타 키 `unverified_is_an_array_on_purpose`의 산문이 계약 5.7.1절의 `text_marker`가 세는 낱말을 **네 번** 쓰고 있었다. 규약을 설명하는 문장이 규약이 세려는 대상을 스스로 부풀린 것이다. 낱말을 바꿔 넷을 없앴고, 그 사실과 앞으로의 금지를 같은 키 안에 `this_key_must_not_carry_the_marker_word`로 박았다. **이 수정은 세법 값을 한 글자도 건드리지 않는다.**

### 12.7 GC-52 ~ GC-61

#### GC-52 — 이자·배당 순소득이 비과세 한도와 정확히 같다 【경계 · 한도선】

**프로필** 40세 · 예산 0 · ISA 일반형 누적 20,000,000 / 경과 4년 · 수익률 0.1 · `interest_dividend` · 정산 1년 · 손실 0

**기대 결과** `G = N = 2,000,000` = `C` · ISA 쪽 세액 **0** · 비교 기준 세액 **308,000** · 혜택 **308,000**(점) · 축 `0 / 308,000 / 0`

**도출 과정** 10.1절 ① 원금 20,000,000 × 0.1 × 1년 = 2,000,000 → ② `s = 1`이므로 `G = 2,000,000` → ③ `L = 0`이므로 `N = 2,000,000` → ④ 일반형 `C = 2,000,000` → ⑤ `max(0, 2,000,000 − 2,000,000) × 0.09 × 1.1 = 0` → ⑥ `2,000,000 × 0.14 × 1.1 = 308,000` → ⑦ 혜택 308,000 → ⑨ 1년치임을 함께 싣는다.

**이 케이스가 함께 고정하는 것.** `isa.benefit.formula`와 `isa.benefit.settlement_period` 두 규칙의 미확인 표시 건수를 근거 목록에서 주장한다. 두 규칙은 이 아홉 건에서만 읽히므로 **다른 어느 케이스도 그 자리를 대신할 수 없다.**

```golden
{
  "case": "GC-52",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 1,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "legal_basis": {
        "isa.benefit.formula": {
          "present": true,
          "status": "확정",
          "bill_stage": null,
          "has_uncertainty_note": true,
          "uncertainty_note_count": 1,
          "uncertainty_kinds": [
            "unverified"
          ],
          "uncertainty_paths": [
            "loss_offset_placement.unverified"
          ]
        },
        "isa.benefit.settlement_period": {
          "present": true,
          "status": "확정",
          "bill_stage": null,
          "has_uncertainty_note": true,
          "uncertainty_note_count": 1,
          "uncertainty_kinds": [
            "unverified"
          ],
          "uncertainty_paths": [
            "statutory_basis[1].unverified"
          ]
        }
      },
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 20000000,
            "total_return_krw": 2000000,
            "taxable_income_krw": 2000000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 2000000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 308000,
            "isa_side_tax_krw": 0,
            "point_estimate_krw": 308000,
            "lower_bound_krw": 308000,
            "upper_bound_krw": 308000,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 308000,
              "rate_gap_krw": 0,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes": [
        "isa_return_estimate_is_not_annual",
        "pension_tax_deferral_not_quantified"
      ],
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_return_estimate_reported_as_range",
        "isa_return_estimate_not_computable"
      ]
    }
  }
}
```

#### GC-53 — 한도를 100,000원 넘긴다 【경계 · 한도 초과 진입】

**프로필** GC-52와 같고 누적 납입액만 21,000,000

**기대 결과** `G = N = 2,100,000` · ISA 쪽 세액 **9,900** · 비교 기준 세액 **323,400** · 혜택 **313,500** · 축 `0 / 308,000 / 5,500`

**도출 과정** ⑤ `(2,100,000 − 2,000,000) × 0.09 × 1.1 = 9,900` → ⑥ `2,100,000 × 0.14 × 1.1 = 323,400` → ⑦ 313,500. 초과분 100,000원에 걸리는 것은 14%가 아니라 **14% − 9% = 5%**(지방세 포함 5.5%)이고, 그 몫 5,500원이 세율차 축이다. **비과세 축은 한도선을 넘어도 308,000원에서 더 늘지 않는다.**

```golden
{
  "case": "GC-53",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 1,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 21000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 21000000,
            "total_return_krw": 2100000,
            "taxable_income_krw": 2100000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 2100000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 323400,
            "isa_side_tax_krw": 9900,
            "point_estimate_krw": 313500,
            "lower_bound_krw": 313500,
            "upper_bound_krw": 313500,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 308000,
              "rate_gap_krw": 5500,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_return_estimate_reported_as_range"
      ]
    }
  }
}
```

#### GC-54 — 서민형이 한도와 정확히 같다 【경계 · 유형 갈림】

**프로필** 직전연도 총급여 **50,000,000**(서민형 경계선 안) · ISA **서민형** 누적 40,000,000 · 나머지는 GC-52와 같다

**기대 결과** `C = 4,000,000` · `G = N = 4,000,000` · ISA 쪽 세액 **0** · 혜택 **616,000** · 축 `0 / 616,000 / 0`

**도출 과정** ④에서 `isa.tax_free_limit`이 직전 총급여 50,000,000 **이하**이므로 서민형 4,000,000을 준다(`boundary_rule`의 "이하"). 나머지는 GC-52와 같은 순서다. `prior_year_tax`는 직전 총급여 50,000,000의 밴드 [2,682,194 , 3,387,500] 안에서 3,000,000을 골랐다.

**GC-05와 무엇이 다른가.** GC-05는 같은 경계에서 **한도금액**이 4,000,000으로 나오는지를 본다. 이 케이스는 그 한도금액이 **혜택 금액으로 얼마가 되는지**를 본다 — `616,000 = 4,000,000 × 0.14 × 1.1`이고, 이 값이 `isa.benefit.quantification`의 `statable_amounts`에 서민형 상한으로 이미 적혀 있는 값과 같다(10.3절 검산 2).

```golden
{
  "case": "GC-54",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3000000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 50000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 1,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "low_income",
        "cumulative_contribution_krw": 40000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 4000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 40000000,
            "total_return_krw": 4000000,
            "taxable_income_krw": 4000000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 4000000,
            "tax_free_limit_krw": 4000000,
            "comparison_side_tax_krw": 616000,
            "isa_side_tax_krw": 0,
            "point_estimate_krw": 616000,
            "lower_bound_krw": 616000,
            "upper_bound_krw": 616000,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 616000,
              "rate_gap_krw": 0,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_return_estimate_reported_as_range"
      ]
    }
  }
}
```

#### GC-55 — 이익 5,000,000 / 손실 2,000,000, 통산 후에도 한도를 넘는다 【경계 · 손익통산 + 초과】

**프로필** 누적 50,000,000 · 손실 **2,000,000** · 나머지는 GC-52와 같다

**기대 결과** `G = 5,000,000` · `N = 3,000,000` · ISA 쪽 세액 **99,000** · 비교 기준 세액 **770,000** · 혜택 **671,000** · 축 `308,000 / 308,000 / 55,000`

**도출 과정** ③ `N = max(0, 5,000,000 − 2,000,000) = 3,000,000` → ⑤ `(3,000,000 − 2,000,000) × 0.099 = 99,000` → ⑥ **`N`이 아니라 `G`로** `5,000,000 × 0.154 = 770,000` → ⑦ 671,000.

**이 케이스가 막는 것.** ⑥에서 `N`을 쓰면 값이 **462,000**으로 나온다 — 209,000원이 사라지고, 사라지는 것이 정확히 손익통산 축이다. 계좌 밖에는 손익통산 규정이 없으므로 비교 기준은 이익 전액에 붙는다. 10.1절이 "산식을 옮겨 적다 가장 틀리기 쉬운 자리"라고 적은 곳이다.

```golden
{
  "case": "GC-55",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 1,
        "loss_amount_krw": 2000000
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 50000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 50000000,
            "total_return_krw": 5000000,
            "taxable_income_krw": 5000000,
            "loss_offset_applied_krw": 2000000,
            "net_income_krw": 3000000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 770000,
            "isa_side_tax_krw": 99000,
            "point_estimate_krw": 671000,
            "lower_bound_krw": 671000,
            "upper_bound_krw": 671000,
            "axis_breakdown": {
              "loss_offset_krw": 308000,
              "tax_free_krw": 308000,
              "rate_gap_krw": 55000,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_return_estimate_reported_as_range"
      ]
    }
  }
}
```

#### GC-56 — 통산이 순소득을 한도 아래로 내린다 【경계 · 통산이 구간을 바꾼다】

**프로필** 누적 30,000,000 · 손실 **2,000,000** · 나머지는 GC-52와 같다

**기대 결과** `G = 3,000,000` · `N = 1,000,000` · ISA 쪽 세액 **0** · 비교 기준 세액 **462,000** · 혜택 **462,000** · 축 `308,000 / 154,000 / 0`

**도출 과정** ③ `N = 1,000,000` → ④ `C = 2,000,000` → ⑤ `max(0, 1,000,000 − 2,000,000) = 0`이므로 ISA 쪽 세액 0 → ⑥ `3,000,000 × 0.154 = 462,000` → ⑦ 462,000.

**GC-55와 짝이다.** 손실 금액이 같은데 통산 결과가 한도의 **위**에 남는가 **아래**로 내려가는가로 갈린다. 아래로 내려가면 세율차 축이 0이 되고 비과세 축이 `C`가 아니라 **`N`에** 걸린다(`1,000,000 × 0.154 = 154,000`) — 비과세 한도는 쓰지 않은 몫을 돌려주지 않는다.

```golden
{
  "case": "GC-56",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 1,
        "loss_amount_krw": 2000000
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 30000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 30000000,
            "total_return_krw": 3000000,
            "taxable_income_krw": 3000000,
            "loss_offset_applied_krw": 2000000,
            "net_income_krw": 1000000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 462000,
            "isa_side_tax_krw": 0,
            "point_estimate_krw": 462000,
            "lower_bound_krw": 462000,
            "upper_bound_krw": 462000,
            "axis_breakdown": {
              "loss_offset_krw": 308000,
              "tax_free_krw": 154000,
              "rate_gap_krw": 0,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_return_estimate_reported_as_range"
      ]
    }
  }
}
```

#### GC-57 — 수익이 국내 상장주식의 가격 상승으로 들어온다 【경계 · 성격 하한】

**프로필** GC-52와 같고 성격만 `listed_equity_capital_gain`

**기대 결과** 구간 **0 ~ 308,000** · `point_estimate_krw` **`null`** · `taxable_share` `0 ~ 1`

**도출 과정** ② `isa.benefit.income_character`의 `s_range`가 `0 ≤ s < 1` → 점을 낼 수 없다 → 아래 끝은 `lower_bound_definition`의 0, 위 끝은 `upper_bound_definition`이 정한 대로 `s = 1`에서 계산한 값 308,000. 자세한 근거는 12.2절.

```golden
{
  "case": "GC-57",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "listed_equity_capital_gain",
        "settlement_years": 1,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 0,
            "taxable_share_max": 1,
            "principal_krw": 20000000,
            "total_return_krw": 2000000,
            "taxable_income_krw": 2000000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 2000000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 308000,
            "isa_side_tax_krw": 0,
            "point_estimate_krw": null,
            "lower_bound_krw": 0,
            "upper_bound_krw": 308000,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 308000,
              "rate_gap_krw": 0,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes": [
        "isa_return_estimate_reported_as_range"
      ],
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied"
      ]
    }
  }
}
```

#### GC-58 — 계약을 유지한다는 전제 위의 금액과, 그 전제를 깨는 사실의 경고 【경계 · 추징】

**프로필** 40세 · 월 1,000,000 × 12 = 예산 12,000,000 · 연금 두 계좌 **연금수령 개시함** · ISA 일반형 누적 20,000,000 / 경과 **1년** · horizon **`within_isa_lock_in`** · 수익률 0.1 · `interest_dividend` · 정산 1년

**기대 결과** ISA 배분 **12,000,000** · 원금 **32,000,000** · 혜택 **374,000** · 축 `0 / 308,000 / 66,000` · 경고 **정확히 `["early_termination_clawback_isa"]`** · 잔여 의무가입기간 **2년**

**도출 과정** 12.3절.

```golden
{
  "case": "GC-58",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "within_isa_lock_in",
      "monthly_capacity_krw": 1000000,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 1,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 1,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "boundaries": {
        "isa_lock_in_years_remaining": 2
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 12000000
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 1,
          "warning_codes": [
            "early_termination_clawback_isa"
          ],
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 32000000,
            "total_return_krw": 3200000,
            "taxable_income_krw": 3200000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 3200000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 492800,
            "isa_side_tax_krw": 118800,
            "point_estimate_krw": 374000,
            "lower_bound_krw": 374000,
            "upper_bound_krw": 374000,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 308000,
              "rate_gap_krw": 66000,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_lock_in_already_elapsed"
      ]
    }
  }
}
```

#### GC-59 — 성격이 섞여 있거나 아직 정하지 않았다 【구간】

**프로필** GC-52와 같고 성격만 `mixed_or_unknown`

**기대 결과** 구간 **0 ~ 308,000** · `point_estimate_krw` **`null`**

**도출 과정** ② `s_range`가 `0 ≤ s ≤ 1` → 양 끝은 GC-57과 같다. 두 선택지가 금액으로 갈리지 않는다는 사실을 이 두 건이 함께 고정한다(12.2절).

```golden
{
  "case": "GC-59",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "mixed_or_unknown",
        "settlement_years": 1,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 1,
            "settlement_years_source": "user",
            "taxable_share_min": 0,
            "taxable_share_max": 1,
            "principal_krw": 20000000,
            "total_return_krw": 2000000,
            "taxable_income_krw": 2000000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 2000000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 308000,
            "isa_side_tax_krw": 0,
            "point_estimate_krw": null,
            "lower_bound_krw": 0,
            "upper_bound_krw": 308000,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 308000,
              "rate_gap_krw": 0,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes": [
        "isa_return_estimate_reported_as_range"
      ],
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied"
      ]
    }
  }
}
```

#### GC-60 — 같은 계좌, 정산 기간만 3년 【경계 · 계약 단위 대 과세기간 단위】

**프로필** GC-52와 **완전히 같고 정산 기간만 3년**

**기대 결과** `R = 6,000,000` · `G = N = 6,000,000` · ISA 쪽 세액 **396,000** · 비교 기준 세액 **924,000** · 혜택 **528,000** · 축 `0 / 308,000 / 220,000`

**도출 과정** ① 20,000,000 × 0.1 × **3** = 6,000,000 → ⑤ `(6,000,000 − 2,000,000) × 0.099 = 396,000` → ⑥ `6,000,000 × 0.154 = 924,000` → ⑦ 528,000 → ⑨ **3년치임을 함께 싣는다.**

**이 케이스가 막는 것.** GC-52의 308,000원을 3년치로 곱하면 924,000원이 나오고, 그것은 비과세 한도금액 `C`를 **해마다 새로 주는** 계산이다. 조문은 그 금액을 "가입일 또는 연장일을 기준으로" 계약 한 건에 대해 한 번 정한다(조특법 §91조의18 ②). 928,000이 아니라 528,000이며 **연간 환산은 1.75배 과대다.** 두 케이스의 `settlement_years`가 1과 3으로 다르게 실리는지도 함께 본다.

```golden
{
  "case": "GC-60",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 0,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": {
        "annual_return_rate": 0.1,
        "income_character": "interest_dividend",
        "settlement_years": 3,
        "loss_amount_krw": 0
      }
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 20000000,
        "ytd_contribution_krw": 0,
        "years_since_opening": 4,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "plan_count": 1,
      "limits": {
        "isa_tax_free_limit_krw": 2000000
      },
      "plans": {
        "max_tax_credit": {
          "allocation": {
            "annuity_savings": 0,
            "retirement_pension": 0,
            "isa": 0
          },
          "tax_credit": {
            "income_tax": 0,
            "local_tax": 0,
            "total": 0
          },
          "warning_count": 0,
          "assumption_based_isa_estimate": {
            "state": "computed",
            "is_annual": false,
            "settlement_years": 3,
            "settlement_years_source": "user",
            "taxable_share_min": 1,
            "taxable_share_max": 1,
            "principal_krw": 20000000,
            "total_return_krw": 6000000,
            "taxable_income_krw": 6000000,
            "loss_offset_applied_krw": 0,
            "net_income_krw": 6000000,
            "tax_free_limit_krw": 2000000,
            "comparison_side_tax_krw": 924000,
            "isa_side_tax_krw": 396000,
            "point_estimate_krw": 528000,
            "lower_bound_krw": 528000,
            "upper_bound_krw": 528000,
            "axis_breakdown": {
              "loss_offset_krw": 0,
              "tax_free_krw": 308000,
              "rate_gap_krw": 220000,
              "rounding_residual_krw": 0
            },
            "comparison_baseline_code": "withholding_at_general_rate"
          }
        }
      },
      "notice_codes": [
        "isa_return_estimate_is_not_annual"
      ],
      "notice_codes_absent": [
        "isa_return_assumption_not_supplied",
        "isa_return_estimate_reported_as_range"
      ]
    }
  }
}
```

#### GC-61 — `isa.tax_free_limit`의 미확인 표시는 몇 건인가 【불일치 · 판정 대기】

**주장과 근거, 그리고 왜 초록색으로 만들지 않았는지는 12.6절.**

```golden
{
  "case": "GC-61",
  "request": {
    "scenarios": [
      "current"
    ],
    "profile": {
      "birth_date": "1986-06-15",
      "prior_year_tax": {
        "state": "amount",
        "determined_tax_krw": 3600000,
        "pension_credit_applied_krw": 0
      },
      "current_year_total_salary_krw": 55000000,
      "has_non_wage_global_income_current_year": false,
      "prior_year_total_salary_krw": 55000000,
      "financial_income_taxpayer_last_3_years": false,
      "declared_youth": null,
      "fund_use_horizon": "at_or_after_pension_age",
      "monthly_capacity_krw": 750000,
      "months_remaining_in_tax_year": 12,
      "isa_return_assumption": null
    },
    "accounts": {
      "annuity_savings": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "retirement_pension": {
        "ytd_contribution_krw": 0,
        "annuity_start_status": "not_started"
      },
      "isa": {
        "exists": true,
        "account_type": "general",
        "cumulative_contribution_krw": 0,
        "ytd_contribution_krw": 0,
        "years_since_opening": 0,
        "other_savings_contract_krw": 0
      }
    },
    "isa_transfer": null
  },
  "expect": {
    "current": {
      "legal_basis": {
        "isa.tax_free_limit": {
          "present": true,
          "status": "확정",
          "bill_stage": null,
          "has_uncertainty_note": true,
          "uncertainty_note_count": 3,
          "uncertainty_kinds": [
            "unverified"
          ],
          "uncertainty_paths": [
            "unverified[0]",
            "unverified[1]",
            "unverified[2]"
          ]
        }
      },
      "plans": {
        "max_tax_credit": {
          "allocation": { "annuity_savings": 6000000, "retirement_pension": 3000000, "isa": 0 },
          "tax_credit": { "income_tax": 1350000, "local_tax": 135000, "total": 1485000 },
          "warning_count": 0
        }
      }
    }
  }
}
```

