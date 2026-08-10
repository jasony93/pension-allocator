// 골든 케이스 전건 실행기.
//
// `docs/stage-4-verification/golden-cases.md` 안의 ```golden 펜스 블록을 읽어
// 케이스마다 compute()를 돌리고 대조한다.
//
// **이 파일에는 기대값이 한 개도 없다.** 값은 전부 그 문서에서 온다.
// 기대값의 저자는 `tax-domain`이고, 엔진 코드를 보지 않고 세법·룰셋에서 산출한다.
// 값을 이 파일로 옮겨 적는 순간 "옮기는 김에 엔진이 내놓은 값을 적는" 여지가 생기므로
// 옮겨 적을 자리 자체를 두지 않았다. `golden-regression.test.mjs` 머리말이 주석으로
// 부탁하던 것("엔진에 맞춰 고치지 않는다")을 이 구조가 대신 강제한다.
//
// 형식과 대조 절차는 `golden-block.mjs`에 있다. 그 파일이 실제로 무는지는
// `golden-block-format.test.mjs`가 합성 블록으로 시험한다 — 값을 이 파일에 들이지
// 않으면서 형식을 시험하려고 갈라 둔 것이다.
//
// 네 가지가 실패 사유다.
//   1. 대조 불일치 — 어느 케이스가 깨졌는지 이름이 나온다.
//   2. **커버리지** — 문서에 `GC-XX`로 등장하는데 블록이 없으면 실패한다.
//      이 검사가 이 장치의 핵심이다. 없으면 다음에 케이스를 추가한 사람이
//      블록을 빠뜨려도 아무도 모르고 골든 케이스는 다시 문서로만 남는다.
//   3. **파싱·형식 오류** — 블록이 있는데 읽히지 않으면 조용히 건너뛰지 않고 실패한다.
//      조용히 건너뛰면 커버리지 검사가 통과하면서 케이스는 안 돌아가는,
//      가장 나쁜 상태가 된다.
//   4. **어휘 사용량** — 허용 키가 있는데 47건 어느 블록도 쓰지 않으면 그 축은
//      아무도 보지 않는다. 검사 4가 그 목록을 고정한다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compute } from './index.mjs';
import {
  VOCABULARY,
  buildRequest,
  caseIdsIn,
  checkCase,
  extractBlocks,
  validateBlock,
  vocabularyUsedBy,
} from './golden-block.mjs';
import { loadRulesets } from './test-helpers.mjs';

const DOC_RELATIVE = 'docs/stage-4-verification/golden-cases.md';
const DOC_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', ...DOC_RELATIVE.split('/'));

const rulesets = loadRulesets();
const markdown = readFileSync(DOC_PATH, 'utf8');

// ── 읽기 ─────────────────────────────────────────────────────────────────────

const { blocks, prose } = extractBlocks(markdown);
const { ids: declaredIds, problems: rangeProblems } = caseIdsIn(prose);

/** @type {Map<string, {parsed: object, line: number}>} */
const cases = new Map();
/** @type {string[]} */
const blockProblems = [...rangeProblems];

for (const { body, line } of blocks) {
  const where = `${DOC_RELATIVE}:${line}`;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    blockProblems.push(`${where}: JSON을 읽을 수 없다 — ${error.message}`);
    continue;
  }

  const errors = validateBlock(parsed, where);
  if (errors.length > 0) {
    blockProblems.push(...errors);
    continue;
  }
  if (cases.has(parsed.case)) {
    blockProblems.push(`${where}: ${parsed.case}의 블록이 두 개다 (앞선 블록 ${DOC_RELATIVE}:${cases.get(parsed.case).line})`);
    continue;
  }
  cases.set(parsed.case, { parsed, line });
}

// ── 검사 1. 블록이 있는데 읽히지 않는 경우 ───────────────────────────────────

test('골든 케이스 블록이 전부 형식에 맞는다', () => {
  assert.deepStrictEqual(
    blockProblems,
    [],
    `읽을 수 없는 블록이 ${blockProblems.length}건이다. 조용히 건너뛰면 커버리지 검사가 통과하면서 ` +
      `케이스는 돌지 않는다.\n${blockProblems.map((p) => `  - ${p}`).join('\n')}`,
  );
});

// ── 검사 2. 커버리지 ─────────────────────────────────────────────────────────
//
// 이 검사가 장치의 핵심이다. 문서가 이름을 대는 케이스는 전부 블록을 가져야 한다.

test('문서의 모든 골든 케이스에 기계가 읽는 블록이 있다', () => {
  const missing = [...declaredIds].filter((id) => !cases.has(id)).sort();
  const orphan = [...cases.keys()].filter((id) => !declaredIds.has(id)).sort();

  const report = [];
  if (missing.length > 0) {
    report.push(
      `${DOC_RELATIVE}에 있으나 \`\`\`golden 블록이 없는 케이스 ${missing.length}건 ` +
        `(전체 ${declaredIds.size}건 중 ${cases.size}건만 채워졌다):`,
      ...missing.map((id) => `  - ${id}`),
      '',
      '이 케이스들은 문서일 뿐 테스트가 아니다. 기대값의 저자는 `tax-domain`이며,',
      '각 케이스 절 끝에 ```golden 펜스 블록을 하나씩 넣어 채운다(형식은 문서 1-A절).',
    );
  }
  if (orphan.length > 0) {
    report.push(
      `문서 산문에 등장하지 않는 케이스의 블록 ${orphan.length}건:`,
      ...orphan.map((id) => `  - ${id}`),
    );
  }

  assert.equal(report.length, 0, report.join('\n'));
});

// ── 검사 3. 전건 대조 ────────────────────────────────────────────────────────
//
// 응답은 한 번만 만들어 검사 3·5가 함께 쓴다.

/** @type {Map<string, object>} */
const responses = new Map();
for (const [caseId, { parsed }] of cases) {
  responses.set(caseId, compute(buildRequest(parsed), rulesets));
}

for (const [caseId, { parsed, line }] of cases) {
  test(`골든 케이스 ${caseId} (${DOC_RELATIVE}:${line})`, () => {
    checkCase(parsed, responses.get(caseId));
  });
}

// ── 검사 4. 어휘 사용량 — `qa`가 지적한 "블록이 얼마나 주장하는가" ───────────
//
// **커버리지 검사(2)는 블록이 있는지만 본다.** 블록이 있어도 그 안에 아무것도 안 적으면
// 필수 세 항목만 검사된다. 그러면 어떤 축이 움직여도 정답지가 그 축을 잡지 못하는데,
// 그것이 6차에 실제로 일어난 일이다(D22).
//
// **세는 단위를 허용 키로 잡은 이유 — 다른 형태를 재 보고 버렸다.** `qa`가 말한 것을
// 글자 그대로 옮기면 "응답의 어떤 필드가 47건 어느 블록에서도 주장되지 않는가"를 세는
// 형태가 된다. 실측했다: 두 시나리오·근거 포함 응답의 잎 경로가 **155개**인데 넓힌
// 어휘가 닿는 것은 **50개**다. 나머지 105개의 갈래는 `basis_rule_ids` 18 · `legal_basis`의
// 법령 문자열·URL 12 · `echo`의 자기 선언 15 · 그 밖(안내의 severity·field·params, 룰셋
// 메타, 미적용 규칙, 한도의 공유 표시 등) 60이다. **그 105개는 정답지가 다룰 대상이
// 아니다** — 매 회차 105줄을 내는 검사는 예외 목록만 자라다가 아무도 안 읽는다.
// 지난번에 산문 검사를 기각한 것과 같은 기준이다.
//
// **어휘를 세면 예외가 없다.** 어휘는 블록이 주장할 수 있는 것의 전부이므로, 쓰이지 않은
// 어휘는 언제나 "그 축을 아무도 보지 않는다"를 뜻한다. 지금 실측치도 그것을 뒷받침한다 —
// 넓히기 전 어휘 38개 중 34개가 이미 쓰이고 있었고 빈 것은 4개뿐이었다(오탐이 없다).
//
// **이 검사가 D22의 결함 자체를 잡지는 못한다.** 이번 결함은 "어휘에 키가 없었다"이지
// "키가 있는데 안 썼다"가 아니다. 어휘와 계약을 기계로 대조하려면 계약이 기계가 읽는
// 형태여야 하고 지금은 아니다. 그래서 이 검사가 막는 것은 **다음 회차의 절반** — 키를
// 넓혀 놓고 아무도 채우지 않는 경우다. 나머지 절반(어휘에 없는 축이 움직이는 경우)은
// 여전히 사람이 계약과 대조해야 하며, 그 사실을 여기 적어 둔다.
//
// 목록이 비어 있지 않은 것은 정상이 아니라 **빚**이다. 갚으면 이 목록에서 지운다.
//
// ── 목록의 성격을 바꿨다 (D30) ───────────────────────────────────────────────
//
// **전에는 이 목록이 등식이었다.** 목록에 있는 키를 블록이 쓰기 시작하면 "이제 쓰이는데
// 목록에 남아 있다"고 실패했고, 그 실패는 `src/engine/`을 고쳐야 사라진다. 그런데 값을
// 채우는 주체는 `tax-domain`이고 그 유닛은 독립성 때문에 `src/engine/`을 **읽지도 않는다.**
// 그래서 `credit_rate.basis`처럼 값을 이미 갖고 있는 축조차 **적으면 빌드가 깨지는** 상태가
// 됐다. 빚 목록이 빚을 갚는 것을 막고 있었다.
//
// **고친 방향: 등식이 아니라 상한으로 둔다.**
//
//   - 늘어나는 쪽(목록에 없는 키가 비게 됨) — **막는다.** 새 축을 열어 놓고 아무도 채우지
//     않는 상태가 이 검사가 막으려는 것 전부이고, 그 판단에는 사람이 필요하다.
//   - 줄어드는 쪽(목록에 있는 키를 쓰기 시작함) — **막지 않는다.** 빚을 갚은 것이므로
//     실패시킬 이유가 없다. 갚힌 항목은 검사가 이름을 찍어 주고, 다음 엔진 회차가 지운다.
//
// **남는 구멍을 정확히 적어 둔다.** 갚은 뒤 목록에서 지우기 전에 그 키를 다시 쓰지 않게
// 되면, 그 되돌림은 목록에 가려 조용히 지나간다. 그 대가로 얻은 것은 `tax-domain`이 값을
// 갖고도 못 적는 상태의 해소이고, **작업을 막는 검사가 곧 우회되는 검사**라는 점에서
// 이쪽이 크다고 보았다. 목록을 회차마다 실제로 줄이는 것이 이 구멍의 유일한 방어선이다.

const VOCABULARY_DEBT = [
  // D22가 넓히라고 한 넷. `tax-domain`이 7차에 값을 채우면 아래에서 지운다.
  // 지우지 않으면 검사가 "이제 쓰이는데 목록에 남아 있다"고 실패한다 — 목록이 스스로
  // 낡지 않게 하는 장치다.
  'plan.tax_credit_before_cap',
  'plan.tax_liability_cap',
  'plan.objective_degenerate',
  'scenario.pension_withdrawal_start',
  'tax_liability_cap.known',
  'tax_liability_cap.cap_krw',
  'tax_liability_cap.applied',
  'tax_liability_cap.threshold_income_tax_krw',
  'pension_withdrawal_start.computable',
  'pension_withdrawal_start.earliest_start_date',
  'pension_withdrawal_start.years_until_earliest_start',
  'pension_withdrawal_start.age_requirement_date',
  'pension_withdrawal_start.holding_requirement_date',
  'pension_withdrawal_start.holding_requirement_waived',
  'pension_withdrawal_start.bound_by_holding_period',
  'pension_withdrawal_start.reason_code',

  // 넓히기 이전부터 비어 있던 넷. 6차 이전에는 아무도 세지 않아 드러나지 않았다.
  //
  // 경계 연수의 **원값** 둘. 블록은 잔여 연수(`..._remaining`)만 적어 왔고, 그 잔여를
  // 만들어 낸 룰셋 원값(ISA 의무가입기간·연금 개시연령)은 한 번도 주장하지 않았다.
  // 잔여가 맞으면 원값도 맞다고 보아 온 셈인데, 나이·가입경과연수가 0인 케이스에서는
  // 그 함의가 성립하지 않는다. 채울 값이 있는 자리이므로 `tax-domain`에 넘긴다.
  'boundaries.isa_lock_in_years',
  'boundaries.pension_min_age_years',

  // 공제율의 지방세분과 실효율은 소득세율에서 산출되는 값이라 블록이 소득세율만
  // 적어 왔다. 산출식이 맞는지는 `ruleset-driven.test.mjs`가 룰셋에서 직접 보지만,
  // **정답지는 그 축을 한 번도 주장하지 않았다**는 사실은 남는다.
  'credit_rate.local_tax',
  'credit_rate.effective',

  // ── 계약 5.0.0이 낸 공제율 판정 축 (D27). ──
  //
  // **왜 지금 비어 있는가.** 47건은 근로소득만 있는 사용자를 전제로 산출됐고, 실행기가
  // 그 전제를 `has_non_wage_global_income_current_year: false`로 명시해 채운다
  // (`golden-block.mjs`). 그 분기에서 판정 축은 총급여액이라 기대값이 움직이지 않았다.
  // **움직이는 쪽 — 종합소득이 있는 사용자와 금액을 모르는 사용자 — 의 정답지가 없다.**
  // 이 결함이 25% 과대였고 지금 정답지는 그 축을 한 번도 주장하지 않는다.
  //
  // **넷 다 지금 당장 적을 수 있다.** 목록이 상한이 됐으므로 `tax-domain`은 이 회차에
  // 바로 값을 채울 수 있고, 그때 이 검사는 실패하지 않는다(D30).
  'credit_rate.basis',
  'credit_rate.measured_amount',
  'credit_rate.fallback_applied',
  'credit_rate.fallback_direction',

  // ── 규칙별 근거·미확인 건수 (D30). 계약 5.7.1절의 첫 번째 방어선. ──
  // 이 축은 이번 회차에 어휘가 처음 생겼다. `tax-domain`이 채우면 검사 5의 목록도 함께 준다.
  'scenario.legal_basis',
  'legal_basis.present',
  'legal_basis.status',
  'legal_basis.bill_stage',
  'legal_basis.has_uncertainty_note',
  'legal_basis.uncertainty_note_count',
  'legal_basis.uncertainty_kinds',
  'legal_basis.uncertainty_paths',
  'legal_basis.applied_to',

  // ── 가정 기반 ISA 정산액 (D28·D29·D31). ──
  // `tax-domain`이 RF-1~RF-9로 정답을 이미 산출해 두었고 적을 자리가 없었을 뿐이다
  // (`golden-cases.md` 10절). 계약이 필드를 들였으므로 이제 `GC-` 번호로 옮기고
  // 블록을 달 수 있다. **이 유닛은 값을 채우지 않는다.**
  'plan.assumption_based_isa_estimate',
  'assumption_based_isa_estimate.state',
  'assumption_based_isa_estimate.not_computable_reason_code',
  'assumption_based_isa_estimate.is_annual',
  'assumption_based_isa_estimate.settlement_years',
  'assumption_based_isa_estimate.settlement_years_source',
  'assumption_based_isa_estimate.taxable_share_min',
  'assumption_based_isa_estimate.taxable_share_max',
  'assumption_based_isa_estimate.principal_krw',
  'assumption_based_isa_estimate.total_return_krw',
  'assumption_based_isa_estimate.taxable_income_krw',
  'assumption_based_isa_estimate.loss_offset_applied_krw',
  'assumption_based_isa_estimate.net_income_krw',
  'assumption_based_isa_estimate.tax_free_limit_krw',
  'assumption_based_isa_estimate.comparison_side_tax_krw',
  'assumption_based_isa_estimate.isa_side_tax_krw',
  'assumption_based_isa_estimate.point_estimate_krw',
  'assumption_based_isa_estimate.lower_bound_krw',
  'assumption_based_isa_estimate.upper_bound_krw',
  'assumption_based_isa_estimate.axis_breakdown',
  'assumption_based_isa_estimate.comparison_baseline_code',
  'isa_axis_breakdown.loss_offset_krw',
  'isa_axis_breakdown.tax_free_krw',
  'isa_axis_breakdown.rate_gap_krw',
  'isa_axis_breakdown.rounding_residual_krw',

  // 미배분 갈래. 소유자가 지적한 자리이고 47건 중 미배분이 0이 아닌 케이스가 있는데도
  // 갈래는 아무도 주장하지 않는다.
  'plan.unallocated_breakdown',
  'unallocated_breakdown.total_annual_krw',
  'unallocated_breakdown.pension_contribution_headroom_krw',
  'unallocated_breakdown.isa_contribution_headroom_krw',
  'unallocated_breakdown.no_headroom_krw',
  'unallocated_breakdown.headrooms_overlap',

  // 배분 **후** 잔여 공제 한도. 16.6절의 문구를 참으로 만드는 세 값 중 하나다.
  'plan.credit_remaining_after_plan_krw',

  // 비정량 효과의 코드 목록. 새 배분안의 `pension_contribution_without_credit`이
  // 여기서만 주장될 수 있다.
  'plan.non_quantified_codes',

  // 전환 특례에 붙은 조건 둘. `contribution_carryover_available`이라는 이름이
  // 감추고 있던 것이고, 정답지가 그 이름만 봐서는 이 조건들을 검사하지 못한다.
  'tax_liability_cap.carryover_shares_future_year_credit_limit',
  'tax_liability_cap.carryover_requires_application',
].sort();

const vocabularyUsed = (() => {
  const used = new Set();
  for (const [, { parsed }] of cases) {
    for (const key of vocabularyUsedBy(parsed)) used.add(key);
  }
  return used;
})();

test('아무 블록도 쓰지 않는 허용 키가 빚 목록 안에 있다', (t) => {
  const unused = VOCABULARY.filter((key) => !vocabularyUsed.has(key)).sort();
  const newlyUnused = unused.filter((key) => !VOCABULARY_DEBT.includes(key));

  assert.deepStrictEqual(
    newlyUnused,
    [],
    [
      `${cases.size}건 어느 블록도 쓰지 않는 허용 키가 새로 ${newlyUnused.length}건 생겼다:`,
      ...newlyUnused.map((key) => `  - ${key}`),
      '',
      '값을 채우거나(권장), 채울 수 없는 이유와 함께 VOCABULARY_DEBT에 적는다.',
      '적힌 키를 쓰기 시작하는 것은 실패가 아니다 — 목록은 등식이 아니라 상한이다(D30).',
    ].join('\n'),
  );

  // 갚힌 빚은 **실패가 아니라 보고다.** 이름을 찍어 두어야 다음 엔진 회차가 지운다.
  const paid = VOCABULARY_DEBT.filter((key) => vocabularyUsed.has(key));
  if (paid.length > 0) {
    t.diagnostic(`갚힌 어휘 빚 ${paid.length}건 — 다음 엔진 회차에 VOCABULARY_DEBT에서 지운다: ${paid.join(', ')}`);
  }
});

// 빚 목록이 스스로 낡는 형태 하나는 여전히 막는다 — **어휘에 없는 키가 목록에 남는 것.**
// 오타이거나 지워진 축이고, 어느 쪽이든 그 줄은 아무것도 뜻하지 않으면서 자리를 지킨다.
test('빚 목록에 어휘 밖의 키가 없다', () => {
  const orphan = VOCABULARY_DEBT.filter((key) => !VOCABULARY.includes(key)).sort();
  assert.deepStrictEqual(
    orphan,
    [],
    `VOCABULARY_DEBT에 있으나 허용 키가 아닌 것 ${orphan.length}건 — 오타이거나 지워진 축이다:\n` +
      orphan.map((key) => `  - ${key}`).join('\n'),
  );
});

// ── 검사 5. 규칙별 미확인 표시를 정답지가 주장하는가 ─────────────────────────
//
// **계약 5.7.1절이 첫 번째 방어선으로 지목한 자리다.** 엔진은 룰셋을 그대로 비출 뿐이라
// 작성자가 지워서는 안 될 불확실성 표시를 지운 경우를 잡지 못한다. 그 자리를 무는 것이
// 「정답지가 규칙별 미확인 건수를 주장한다」이고, 이번 회차에 어휘를 열었다.
//
// **기대 건수를 이 파일에 적지 않는다.** `tax-domain`이 그 형태를 거부했고 관리자가
// 승인했다 — 해소할 때마다 검증기를 고쳐야 하고, 그러면 대장이 곧 무시된다. 여기서 세는
// 것은 **건수가 아니라 「그 규칙을 주장하는 블록이 하나라도 있는가」**이므로, 건수가
// 3에서 2로 줄어도 이 검사는 손댈 일이 없다 — 줄어든 사실은 그 블록의 대조가 잡는다.
//
// **방향이 둘이고 성격이 다르다.**
//   (가) 표시를 가진 규칙이 늘었는데 아무 블록도 주장하지 않는다 → **막는다.** 새 미확인이
//        조용히 들어오는 것을 잡는 자리이고, 아래 목록에 사유와 함께 적어야 통과한다.
//   (나) 목록에 적힌 규칙이 표시를 **하나도 갖지 않게 됐다** → **사람 확인을 요구한다.**
//        해소된 것일 수도 있고 지워진 것일 수도 있으며, 둘을 기계가 가리지 못한다.
//        `tax-domain`이 제안하고 관리자가 승인한 "줄어들 때만 사람 확인" 형태가 이것이다.
//
// (나)가 `src/engine/`을 고쳐야 풀린다는 것은 의도다. 어휘 빚 목록과 성격이 다르다 —
// 저쪽은 **일상적인 진척**을 막고 있었고, 이쪽이 막는 것은 **사용자 고지가 사라지는 사건**이라
// 관리자에게 올라가는 것이 옳다.

/** 미확인 표시를 가졌으나 아직 어느 블록도 주장하지 않는 규칙. 사유를 함께 적는다. */
const UNASSERTED_UNCERTAINTY_RULES = [
  // **이번 회차에 어휘가 처음 생겼다.** 아래 열한 건은 지금 골든 케이스 응답의 근거에
  // 실리면서 불확실성 표시를 갖고 있는 규칙 전부다. `tax-domain`이 건수를 적는 대로 줄어든다.
  //
  // 이 목록이 **실행 결과에서 나온 값**이라는 점이 중요하다. 룰셋 전체를 훑어 적으면
  // 근거로 실리지도 않는 규칙까지 들어와 정답지가 주장할 수 없는 것을 요구하게 된다.
  'age.reckoning.reference_date',
  'isa.early_termination.clawback',
  'isa.tax_free_limit',
  'pension.contribution.after_annuity_start',
  'pension.contribution.beyond_credit_limit',
  'pension.credit.rate.basis_determination',
  'pension.credit.tax_liability_cap.source_form',
  'pension.credit.unused.contribution_carryover',
  'pension.withdrawal.eligibility',
  'pension.withdrawal.non_deducted_principal',
  'proposed.pension.credit.youth_irp_rate',
];

test('미확인 표시를 가진 규칙은 정답지가 그 축을 주장하거나 빚 목록에 있다', () => {
  /** 근거로 실제 실린 규칙 중 표시가 남아 있는 것. 건수는 세지 않는다. */
  const withUncertainty = new Set();
  for (const response of responses.values()) {
    if (!response.ok) continue;
    for (const scenario of response.scenarios) {
      for (const entry of scenario.legal_basis) {
        if (entry.uncertainty_notes.length > 0) withUncertainty.add(entry.rule_id);
      }
    }
  }

  /** 블록이 그 규칙의 미확인 축을 실제로 주장했는가. */
  const asserted = new Set();
  for (const [, { parsed }] of cases) {
    for (const expectation of Object.values(parsed.expect ?? {})) {
      for (const [ruleId, entry] of Object.entries(expectation.legal_basis ?? {})) {
        const claims = ['uncertainty_note_count', 'uncertainty_paths', 'uncertainty_kinds'];
        if (claims.some((key) => key in entry)) asserted.add(ruleId);
      }
    }
  }

  const report = [];

  const unasserted = [...withUncertainty]
    .filter((ruleId) => !asserted.has(ruleId) && !UNASSERTED_UNCERTAINTY_RULES.includes(ruleId))
    .sort();
  if (unasserted.length > 0) {
    report.push(
      `불확실성 표시를 가졌는데 어느 블록도 그 축을 주장하지 않는 규칙 ${unasserted.length}건:`,
      ...unasserted.map((ruleId) => `  - ${ruleId}`),
      '',
      '블록의 legal_basis에 uncertainty_note_count를 적거나(권장),',
      '적을 수 없는 이유와 함께 UNASSERTED_UNCERTAINTY_RULES에 넣는다.',
    );
  }

  const vanished = UNASSERTED_UNCERTAINTY_RULES.filter((ruleId) => !withUncertainty.has(ruleId)).sort();
  if (vanished.length > 0) {
    report.push(
      `**사람 확인이 필요하다.** 빚 목록에 있는데 불확실성 표시가 하나도 남지 않은 규칙 ${vanished.length}건:`,
      ...vanished.map((ruleId) => `  - ${ruleId}`),
      '',
      '표시가 실제로 해소된 것인지, 아니면 지워진 것인지를 기계가 가리지 못한다.',
      '해소가 맞으면 이 목록에서 지우고, 아니면 룰셋을 되돌려라 — 이것은 관리자 보고 대상이다.',
    );
  }

  assert.equal(report.length, 0, report.join('\n'));
});
