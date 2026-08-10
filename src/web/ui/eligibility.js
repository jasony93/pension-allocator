/**
 * 계좌 자격(`ScenarioResult.account_eligibility`)을 화면 표시로 옮기는 단일 관문.
 *
 * **왜 별도 모듈인가.** 4단계 검증이 올린 관찰 O1(`verification-report.md` 4절):
 * ISA가 배제된 사용자(`eligible: false`)에게도 엔진이 계약대로
 * `limits.by_account[isa].tax_free_limit_krw`를 실어 보낸다. 계약 5.3절이 그
 * 필드를 `account_type`이 null일 때만 null로 정하고 있어 **엔진은 계약대로**이고,
 * 배제 여부를 함께 읽어 표시를 정하는 것은 화면의 몫이다. 그 판단이 도넛·한도
 * 트랙 막대·스택바·계좌별 표 네 곳에 흩어져 있으면 한 곳만 고치고 나머지에
 * 남는다 — 실제로 그렇게 남았다. 그래서 **네 곳이 전부 이 모듈을 통해서만**
 * 계좌의 한도·혜택 금액에 접근한다.
 *
 * 판정은 하지 않는다. 배제 여부도, 사유도 전부 엔진 응답에서 온다(금지사항:
 * 계산 로직을 구현하지 않는다). 이 모듈이 하는 일은 "배제된 계좌의 금액 필드를
 * null로 막고 사유를 함께 내보내는 것"뿐이다.
 */

/**
 * 배제된 계좌면 `{ reasonCodes, basisRuleIds }`, 아니면 `null`.
 * `account_eligibility`에 없는 계좌도 `null`(= 배제 아님)로 본다 — 계약은 세
 * 계좌 전부를 싣도록 정하지만, 없는 것을 배제로 읽으면 화면이 엔진보다 더 많이
 * 아는 척하는 것이 된다.
 */
export function accountExclusion(scenario, account) {
  const entry = scenario?.account_eligibility?.find((e) => e.account === account);
  if (!entry || entry.eligible !== false) return null;
  return {
    reasonCodes: entry.reason_codes ?? [],
    basisRuleIds: entry.basis_rule_ids ?? [],
  };
}

/**
 * 계좌 하나의 한도·혜택 금액을 화면이 읽는 형태로 낸다.
 *
 * **배제된 계좌는 금액 필드가 전부 `null`이다.** `null`은 "0원"이 아니라 "표시할
 * 값이 없다"는 뜻이고(계약 2.1절과 같은 규약), 호출부는 `null`을 받으면 금액
 * 대신 사유를 그린다. 받을 수 없는 혜택의 금액을 화면에 두면 사용자가 그 숫자를
 * 근거로 판단하게 된다.
 *
 * `taxFreeLimitKrw`는 지금 어느 화면도 그리지 않는다(설계에 없는 표시를 늘리지
 * 않는다). 그럼에도 이 뷰가 함께 내는 이유는, 나중에 이 값을 그리려는 코드가
 * 생기더라도 **`limits.by_account`를 직접 읽는 경로가 아니라 이 관문을 지나게**
 * 하기 위해서다. 배제 판정을 다시 잊는 것을 구조로 막는다.
 */
export function accountLimitView(scenario, account) {
  const exclusion = accountExclusion(scenario, account);
  if (exclusion) {
    return {
      account,
      excluded: true,
      reasonCodes: exclusion.reasonCodes,
      basisRuleIds: exclusion.basisRuleIds,
      remainingLimitKrw: null,
      taxFreeLimitKrw: null,
    };
  }
  const limit = scenario?.limits?.by_account?.find((l) => l.account === account) ?? null;
  return {
    account,
    excluded: false,
    reasonCodes: [],
    basisRuleIds: limit?.basis_rule_ids ?? [],
    remainingLimitKrw: limit ? limit.contribution_limit_remaining_krw : 0,
    taxFreeLimitKrw: limit ? (limit.tax_free_limit_krw ?? null) : null,
  };
}

/** 배제된 계좌 id 목록. 차트가 조각을 그릴 대상에서 빼는 데 쓴다. */
export function excludedAccounts(scenario) {
  return (scenario?.account_eligibility ?? []).filter((e) => e.eligible === false).map((e) => e.account);
}

/** 연금계좌 두 개 — 납입 한도도 세액공제 한도도 같은 풀을 본다(계약 5.3절). */
export const PENSION_ACCOUNTS = ['annuity_savings', 'retirement_pension'];

/**
 * 화면에서 계좌를 나열하는 순서. `charts.js`의 `CHART_ACCOUNT_ORDER`와 같아야
 * 한다(도넛·막대·표·문장이 서로 다른 순서로 계좌를 부르면 대조가 깨진다).
 * 여기서 다시 적는 이유는 이 모듈을 DOM 없이 유지하기 위해서이고, 두 목록이
 * 어긋나지 않는다는 것은 테스트가 고정한다.
 */
const ACCOUNT_DISPLAY_ORDER = ['annuity_savings', 'retirement_pension', 'isa'];

/**
 * 계약 5.5절 `Allocation.limited_by`가 취할 수 있는 값. 미배분 금액을 설명하는
 * 문장은 **이 값마다 달라야 한다.**
 *
 * `budget`은 목록에 있지만 미배분 사유가 될 수 없다 — 예산이 모자라 멈춘 것과
 * 예산이 남은 것은 동시에 성립하지 않는다. 그래서 문장에서 뺀다.
 *
 * **`credit_limit`은 6.0.0(D32)에서 계약 열거형에서 빠졌다** — 어떤 배분안도
 * 더 이상 세액공제 대상 한도에서 멈추지 않으므로(네 안 모두 연금 납입 한도까지
 * 채운다) 이 값은 응답으로 돌지 않는다(`engine-interface.md` 0.11·5.5절). 이
 * 자리를 지우지 않은 이유는 (a) 오래된 요청·기록된 응답을 재생하는 화면 밖
 * 소비자가 있을 수 있고, (b) 지워도 얻는 것이 없기 때문이다 — `unallocatedBlockers`가
 * 실제 응답에서 관측되지 않는 값을 걸러내므로 죽은 분기가 렌더로 이어지지 않는다.
 */
export const UNALLOCATED_REASON_ORDER = ['contribution_limit', 'credit_limit', 'not_eligible'];

/**
 * 미배분 금액이 **왜** 남았는지를 엔진의 `limited_by`에서 읽어 사유별로 묶는다.
 *
 * 4단계 `qa`가 잡은 Q1의 자리다. 화면은 "세 계좌의 납입 잔여 한도를 모두 채우고
 * 남은 금액"이라는 문장을 **무조건** 냈는데, 배분이 `credit_limit`이나
 * `not_eligible`로 멈춘 경우 그것은 거짓이다 — 납입 잔여 한도가 그대로 남아
 * 있는데 다 채웠다고 말하게 된다. 엔진 응답은 자기모순이 아니었고
 * (`limited_by`가 정확히 실려 있었다) **화면이 그것을 읽지 않은 것**이 결함이었다.
 *
 * 판정하지 않는다. 엔진이 각 배분에 적어 보낸 값을 묶기만 한다.
 */
export function unallocatedBlockers(plan) {
  const byReason = new Map();
  for (const account of ACCOUNT_DISPLAY_ORDER) {
    const allocation = (plan?.allocations ?? []).find((a) => a.account === account);
    const reason = allocation?.limited_by;
    if (!reason || !UNALLOCATED_REASON_ORDER.includes(reason)) continue;
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(account);
  }
  return UNALLOCATED_REASON_ORDER.filter((reason) => byReason.has(reason)).map((reason) => ({
    reason,
    accounts: byReason.get(reason),
  }));
}

/**
 * 연금계좌 묶음의 **세액공제 인정 여지**. 계약 5.3절이 이 값을 "추가로 인정될
 * 여지"로 정의하고 **배분 상한이 아니라고** 못박았다 — 개정안 청년 IRP 우대에서는
 * 추가 IRP 납입이 이미 인정된 연금저축 기납입분을 공제 풀에서 밀어내므로
 * **배분액이 이 값을 넘을 수 있다**(4단계가 잡은 M1과 같은 뿌리).
 *
 * 그래서 이 값은 트랙(넘을 수 없는 상한)에 쓰지 않고, `exceeded`를 함께 내서
 * 화면이 넘는 경우를 감추지 않게 한다(`screens.md` 5.10절).
 * 계좌별로 두 번 적지 않기 위해 **묶음 단위 합산값**만 낸다.
 */
export function pensionCreditHeadroomView(scenario, plan) {
  const remainingKrw = scenario?.limits?.pension_combined_credit_remaining_krw ?? null;
  const allocatedKrw = (plan?.allocations ?? [])
    .filter((a) => PENSION_ACCOUNTS.includes(a.account))
    .reduce((sum, a) => sum + a.annual_krw, 0);
  return {
    remainingKrw,
    allocatedKrw,
    exceeded: remainingKrw !== null && allocatedKrw > remainingKrw,
  };
}

/**
 * 연금 두 계좌의 충당 순서를 **세제상 동점이 갈랐는가**, 갈랐다면 어느 쪽이
 * 먼저인가. 화면이 "왜 이 순서인가"를 설명할 재료다(계약 0.4·5.6절).
 *
 * 판정하지 않는다. 엔진의 `priority_basis`를 읽기만 한다.
 * - `tie_break.code`가 `withdrawal_flexibility_first`가 아니면 `null`. 공제율이
 *   갈리는 구간에서는 순서를 정한 것이 인출 유연성이 아니라 세액공제
 *   최대화이므로(계약 0.4절 "지킨 선" 1), 그 설명을 붙이면 거짓말이 된다.
 * - 순서는 `fill_sequence`(**실제로 쓴 순서**)에서 읽는다. 계약 5.6절이
 *   "고정 배열로 가정하지 말고 이 값을 읽어라"고 명시한다.
 * - 먼저 채운 계좌에 실제로 들어간 금액이 0이면 `null`. 순서가 화면 어디에도
 *   나타나지 않으므로 설명할 대상이 없다(예: ISA를 먼저 채우는 배분에서 연금
 *   쌍이 둘 다 0원인 경우).
 */
export function fillOrderTieBreak(plan) {
  const basis = plan?.priority_basis;
  if (basis?.tie_break?.code !== 'withdrawal_flexibility_first') return null;

  const pair = (basis.fill_sequence ?? []).filter((account) => PENSION_ACCOUNTS.includes(account));
  if (pair.length !== 2) return null;
  const [flexible, restricted] = pair;

  const firstAllocation = (plan.allocations ?? []).find((a) => a.account === flexible);
  if (!firstAllocation || firstAllocation.annual_krw <= 0) return null;

  return { flexible, restricted, basisRuleIds: basis.tie_break.basis_rule_ids ?? [] };
}

/**
 * `AccountBenefitStrip`(design-system 5.31절 · screens.md 5.14절)이 그릴 행 둘을
 * 낸다 — 연금계좌 묶음(`pension`)과 ISA(`isa`). **계산하지 않는다.** 계약이 이미
 * 낸 값(`deterministic_benefit`은 pooled 합산값뿐이고, `non_quantified_effects`가
 * ISA의 비과세 한도를 담는다)을 고르고 배제 여부로 상태만 가른다.
 *
 * **연금 두 계좌를 갈라 보여주지 않는다.** 계약(`engine-interface.md` 5.6절)의
 * `DeterministicBenefit`이 계좌별 필드를 갖지 않는다 — 세액 한도가 걸리면
 * 계좌별 몫이라는 개념 자체가 조문에 없고(`tax-rules-report.md` 15.3절), 합산
 * 한도가 걸리면 세법이 정하는 것은 구간뿐이다(15.2.3절). 화면이 임의로 나누면
 * 조문에 없는 배분을 만드는 것이라 `pooled` 하나로 묶어 둔다. `calc-engine-dev`
 * ·`tax-domain`이 나중에 계좌별 분리 값을 내면 그 계좌만 `amount`로 승격하면
 * 되고, 이 함수의 나머지는 바뀌지 않는다(design-system 5.31절 forward-compat).
 *
 * **ISA 칸에 0원을 쓰지 않는다.** ISA는 세액공제 대상이 아닐 뿐 혜택이 없는
 * 것이 아니다(`tax-rules-report.md` 15.4.5절) — 그래서 ISA 행은 배제되지 않는
 * 한 언제나 `narrative`다. `non_quantified_effects`에 값이 없어도(계좌 유형
 * 미확정 등) 서술 자체는 성립하므로 행을 감추지 않는다.
 */
export function accountBenefitRows(scenario, plan) {
  const pensionEligible = PENSION_ACCOUNTS.filter((account) => !accountExclusion(scenario, account));
  const pension =
    pensionEligible.length === 0
      ? {
          state: 'excluded',
          accounts: PENSION_ACCOUNTS,
          reasonCodes: PENSION_ACCOUNTS.flatMap((a) => accountExclusion(scenario, a)?.reasonCodes ?? []),
          basisRuleIds: PENSION_ACCOUNTS.flatMap((a) => accountExclusion(scenario, a)?.basisRuleIds ?? []),
        }
      : {
          state: 'pooled',
          accounts: pensionEligible,
          basisRuleIds: plan?.deterministic_benefit?.basis_rule_ids ?? [],
          // `BenefitMeter`(design-system 5.31절)의 확정 등급 재료 — 트랙은
          // 한도 적용 전, 채움은 적용 후다. 계산하지 않는다, 계약이 이미 낸
          // 두 값을 고를 뿐이다.
          beforeCapKrw: plan?.deterministic_benefit?.pension_credit_total_before_cap_krw ?? null,
          afterCapKrw: plan?.deterministic_benefit?.pension_credit_total_krw ?? null,
        };

  const isaExclusion = accountExclusion(scenario, 'isa');
  const isaEffect = (plan?.non_quantified_effects ?? []).find((e) => e.account === 'isa' && e.code === 'isa_tax_free_headroom');
  const isa = isaExclusion
    ? { state: 'excluded', reasonCodes: isaExclusion.reasonCodes, basisRuleIds: isaExclusion.basisRuleIds }
    : {
        state: 'narrative',
        headroomKrw: isaEffect?.headroom_krw ?? null,
        basisRuleIds: isaEffect?.basis_rule_ids ?? [],
        // 5.1.0(D28·D29·D31) — 가정 기반 ISA 정산액. 계약이 `profile.isa_return_assumption`을
        // 받지 않은 요청에는 `null`이다. **`state`는 그대로 `narrative`다** —
        // ISA는 여전히 `DeterministicBenefit`을 갖지 않는다. 렌더 등급만
        // (없음 → `assumption`) 이 값으로 승격된다(design-system 5.31절 표).
        estimate: plan?.assumption_based_isa_estimate ?? null,
      };

  return { pension, isa };
}

/**
 * 규칙 id 목록에 해당하는 `legal_basis` 항목들. 배제 사유 옆에 붙일 `LawChip`의
 * 출처다 — 헌장 "계산에 쓴 법령 조항을 결과 화면에 노출한다"와 `screens.md`
 * 8.4(b) "차단 사유에 반드시 LawChip을 붙인다"를 같은 방식으로 지킨다.
 * `legal_basis`의 순서를 그대로 유지하고 중복을 제거한다.
 */
export function lawEntriesFor(scenario, ruleIds) {
  const wanted = new Set(ruleIds ?? []);
  if (wanted.size === 0) return [];
  const seen = new Set();
  return (scenario?.legal_basis ?? []).filter((entry) => {
    if (!wanted.has(entry.rule_id) || seen.has(entry.rule_id)) return false;
    seen.add(entry.rule_id);
    return true;
  });
}

/**
 * 특정 출력 필드에 실제로 쓰인 규칙들. 계약 5.7절의 `applied_to`가 "화면이 값
 * 옆에 근거를 붙일 수 있게" 두 방향 연결을 보장한다. 값마다 어떤 규칙이 쓰였는지
 * 화면이 추측하지 않고 엔진이 적어 준 것을 읽는다.
 */
export function lawEntriesForPath(scenario, path) {
  return (scenario?.legal_basis ?? []).filter((entry) => (entry.applied_to ?? []).includes(path));
}
