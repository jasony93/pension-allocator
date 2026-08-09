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

for (const [caseId, { parsed, line }] of cases) {
  test(`골든 케이스 ${caseId} (${DOC_RELATIVE}:${line})`, () => {
    checkCase(parsed, compute(buildRequest(parsed), rulesets));
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

const UNUSED_VOCABULARY = [
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
].sort();

test('블록이 쓰지 않는 허용 키가 기록된 목록과 정확히 같다', () => {
  const used = new Set();
  for (const [, { parsed }] of cases) {
    for (const key of vocabularyUsedBy(parsed)) used.add(key);
  }
  const unused = VOCABULARY.filter((key) => !used.has(key)).sort();

  const newlyUnused = unused.filter((key) => !UNUSED_VOCABULARY.includes(key));
  const nowUsed = UNUSED_VOCABULARY.filter((key) => used.has(key));

  const report = [];
  if (newlyUnused.length > 0) {
    report.push(
      `${cases.size}건 어느 블록도 쓰지 않는 허용 키가 새로 ${newlyUnused.length}건 생겼다:`,
      ...newlyUnused.map((key) => `  - ${key}`),
      '',
      '값을 채우거나(권장), 채울 수 없는 이유와 함께 UNUSED_VOCABULARY에 적는다.',
    );
  }
  if (nowUsed.length > 0) {
    report.push(
      `UNUSED_VOCABULARY에 적혀 있는데 이제 쓰이는 키 ${nowUsed.length}건 — 목록에서 지운다:`,
      ...nowUsed.map((key) => `  - ${key}`),
    );
  }

  assert.equal(report.length, 0, report.join('\n'));
});
