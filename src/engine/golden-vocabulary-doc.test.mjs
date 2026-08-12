// 정답지 문서가 **선언한** 블록 어휘와 실행기가 **받는** 어휘를 맞대 본다.
//
// ── 왜 이 파일이 생겼나 (D55 후속) ──────────────────────────────────────────
//
// `tax-domain`이 23차에 신고했다 — 「`carryover_shares_future_year_credit_limit` ·
// `carryover_requires_application` · `basis_rule_ids`의 연쇄를 어느 블록도 주장하지
// 않는다. **블록 어휘에 그 세 칸이 없기 때문이고**(1-A절), 어휘를 늘리는 것은 실행기의
// 몫이라 이 유닛의 산출물 밖이다.」
//
// **앞의 둘은 D26 이래 줄곧 어휘에 있었다.** `PLAN_TAX_CAP_KEYS`가 그것을 받고 있었고
// 형식 검사도 통과시켰다. 없었던 것은 어휘가 아니라 **그 어휘를 알리는 문장**이다 —
// 정답지 문서 1-A절의 「`tax_liability_cap`에 쓸 수 있는 키」 목록에 그 둘이 없다.
//
// **어휘가 두 자리에 손으로 적혀 있고, 그 둘을 맞대 보는 검사가 없었다.**
//   · 기계가 받는 자리 — `golden-block.mjs`의 `*_KEYS` 배열
//   · 사람이 읽는 자리 — `golden-cases.md` 1-A절의 「쓸 수 있는 키」 문장
//
// **어느 쪽이 위험한가는 정해져 있다.** 문서에만 있는 키(`known`이 그렇다)를 적으면
// 형식 검사가 「모르는 키」로 즉시 거절한다 — 시끄럽게 실패한다. 반대로 **코드에만 있는
// 키는 아무 소리도 내지 않는다.** 값을 적을 사람이 그 축이 있다는 것을 모르므로 그 축은
// **열린 적이 없는 것과 같다.** 이 저장소가 이번 세션에 세 번 밟은 형태 그대로다 —
// 「검사는 옳은데 재는 자리가 없다」.
//
// **그 침묵의 크기를 실측했다.** 문서가 안 적은 코드 어휘 열 개 중 **아홉 개가 그대로
// `VOCABULARY_DEBT`에 있다.** 즉 「`tax-domain`이 아직 안 채웠다」고 여러 회차 적어 온
// 빚의 대부분은 **채우지 않은 것이 아니라 있는 줄 몰랐던 것**이다.
//
// **이 파일은 값을 하나도 갖지 않는다.** 문서에서 읽고 코드에서 읽어 맞댈 뿐이다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BOUNDARY_KEYS,
  CREDIT_RATE_KEYS,
  ISA_ESTIMATE_KEYS,
  LEGAL_BASIS_KEYS,
  LIMIT_KEYS,
  NON_QUANTIFIED_FACT_KEYS,
  PENSION_START_KEYS,
  PLAN_KEYS,
  PLAN_TAX_CAP_KEYS,
  SCENARIO_KEYS,
} from './golden-block.mjs';

const DOC_RELATIVE = 'docs/stage-4-verification/golden-cases.md';
const DOC_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', ...DOC_RELATIVE.split('/'));
const LINES = readFileSync(DOC_PATH, 'utf8').split('\n');

// ── 문서에서 목록을 뽑는다 ───────────────────────────────────────────────────
//
// 목록은 「`a` · `b` · `c`」 꼴이다. 같은 줄에 설명 산문이 이어지고 그 산문에도 백틱이
// 있으므로(예: 「`cap_krw`의 `0`은 유효한 값이고 `null`과 다르다」) **가장 긴 이음만**
// 목록으로 본다. 굵게 표시된 키(`**\`x\`**`)와 바로 뒤에 붙는 괄호 주석도 받는다.

const TOKEN = /(?:\*\*)?`([a-z_][a-z0-9_]*)`(?:\*\*)?(?:\([^)]*\))?/y;
const SEPARATOR = /^(?: · | \/ )/;

function tokenRuns(line) {
  const runs = [];
  let cursor = 0;
  while (cursor < line.length) {
    TOKEN.lastIndex = cursor;
    const first = TOKEN.exec(line);
    if (first === null) {
      cursor += 1;
      continue;
    }
    const run = [first[1]];
    let end = TOKEN.lastIndex;
    for (;;) {
      const separator = SEPARATOR.exec(line.slice(end));
      if (separator === null) break;
      TOKEN.lastIndex = end + separator[0].length;
      const next = TOKEN.exec(line);
      if (next === null) break;
      run.push(next[1]);
      end = TOKEN.lastIndex;
    }
    runs.push(run);
    cursor = end;
  }
  return runs;
}

/** 그 줄에서 가장 긴 이음. 없으면 빈 배열이고, 그때는 아래 검사가 실패한다. */
function declaredIn(marker) {
  const line = LINES.find((l) => l.includes(marker));
  if (line === undefined) return null;
  return tokenRuns(line).sort((a, b) => b.length - a.length)[0] ?? [];
}

// ── 무엇과 무엇을 맞대는가 ───────────────────────────────────────────────────
//
// `exempt`는 **필수 항목**이다. 문서의 두 목록은 이름이 「더 적을 수 있는 것」이므로
// 필수 항목이 거기 없는 것이 옳다 — 빚이 아니라 규약이다.

const PAIRS = [
  {
    marker: '시나리오 단위로 더 적을 수 있는 것',
    keys: SCENARIO_KEYS,
    exempt: ['plans'],
  },
  {
    marker: '배분안 단위로 더 적을 수 있는 것',
    keys: PLAN_KEYS,
    exempt: ['allocation', 'tax_credit', 'warning_count'],
  },
  { marker: '`legal_basis`에 쓸 수 있는 키', keys: LEGAL_BASIS_KEYS, exempt: [] },
  { marker: '`assumption_based_isa_estimate`에 쓸 수 있는 키', keys: ISA_ESTIMATE_KEYS, exempt: [] },
  { marker: '`facts`에 쓸 수 있는 키', keys: NON_QUANTIFIED_FACT_KEYS, exempt: [] },
  { marker: '`credit_rate`에 쓸 수 있는 키', keys: CREDIT_RATE_KEYS, exempt: [] },
  { marker: '`limits`에 쓸 수 있는 키', keys: LIMIT_KEYS, exempt: [] },
  { marker: '`boundaries`에 쓸 수 있는 키', keys: BOUNDARY_KEYS, exempt: [] },
  { marker: '`tax_liability_cap`에 쓸 수 있는 키', keys: PLAN_TAX_CAP_KEYS, exempt: [] },
  { marker: '`pension_withdrawal_start`에 쓸 수 있는 키', keys: PENSION_START_KEYS, exempt: [] },
];

// ── 지금 어긋나 있는 것 ──────────────────────────────────────────────────────
//
// **`VOCABULARY_DEBT`와 같은 성격이다** — 등식이 아니라 **상한**이다. 새로 어긋나면
// 실패하고, 여기 적힌 것이 맞춰지면 실패하지 않는다(갚힌 것은 진단으로 이름이 찍힌다).
//
// **왜 지금 전부 못 고치는가.** 고칠 자리가 `docs/stage-4-verification/`이고 그것은
// `tax-domain`의 산출물이다. 이 유닛은 그 디렉터리를 열지 않는다 — 정답지를 엔진 쪽에서
// 손대면 정답지가 검증 장치이기를 그만둔다. **그래서 이름과 사유를 여기 적어 넘긴다.**

const DOC_DRIFT_DEBT = {
  // 문서가 안 적은 코드 어휘. **아홉이 그대로 `VOCABULARY_DEBT`에 있다** — 안 채운 것이
  // 아니라 있는 줄 몰랐던 것이다.
  missing_in_doc: [
    // 유일하게 빚 목록에 없다 — 정답지가 어딘가에서 알아내 쓰고 있다(D36).
    'scenario.pension_credit_ceiling',
    // 아래 아홉은 전부 `VOCABULARY_DEBT`에도 있다.
    'scenario.unapplied_proposed_rules',
    'plan.headline_composite_total',
    'assumption_based_isa_estimate.principal_basis_code',
    'assumption_based_isa_estimate.return_accrual_code',
    'assumption_based_isa_estimate.is_lower_bound_for_aggregate_taxpayer',
    'assumption_based_isa_estimate.assumes_contract_held_to_settlement',
    'assumption_based_isa_estimate.axis_ceilings',
    'tax_liability_cap.carryover_shares_future_year_credit_limit',
    'tax_liability_cap.carryover_requires_application',
    // **이 회차에 새로 열었다**(D55 후속). 정답지가 GC-32a·32d·31·34에서 쓸 자리다.
    'tax_liability_cap.basis_rule_ids',
    'tax_liability_cap.basis_rule_ids_absent',
  ],
  // 문서에만 있는 키. 적으면 형식 검사가 「모르는 키」로 거절하므로 조용히 틀리지는
  // 않는다. 다만 다음 사람이 그 이름을 믿고 한 번 헛디딘다.
  extra_in_doc: [
    // D39·D40에 폐기됐다. 한도를 「모르는」 상태가 사라졌고 `binding_code`가 그 자리를
    // 대신한다 — 뜻이 다르다(「값을 아는가」 → 「걸린다는 것이 증명되는가」).
    'tax_liability_cap.known',
  ],
};

// ── 검사 1. 목록이 문서에 있기는 한가 ────────────────────────────────────────
//
// 문장이 사라지거나 이름이 바뀌면 아래 두 검사가 **아무것도 못 재면서 통과한다.**
// 그 상태가 이 파일이 막으려는 것 자체이므로 따로 문다.

test('정답지 문서가 어휘 목록을 열 개 다 선언한다', () => {
  const missing = PAIRS.filter(({ marker }) => declaredIn(marker) === null).map((p) => p.marker);
  assert.deepStrictEqual(
    missing,
    [],
    `${DOC_RELATIVE}에서 어휘 선언 문장을 찾지 못했다 ${missing.length}건 — ` +
      '문장이 사라지면 아래 검사가 아무것도 재지 않으면서 통과한다:\n' +
      missing.map((m) => `  - ${m}`).join('\n'),
  );

  const empty = PAIRS.filter(({ marker }) => (declaredIn(marker) ?? []).length === 0).map((p) => p.marker);
  assert.deepStrictEqual(empty, [], `키를 하나도 못 읽은 선언 문장 ${empty.length}건: ${empty.join(', ')}`);
});

// ── 검사 2. 코드에 있는데 문서가 안 알리는 축 ────────────────────────────────
//
// **이 방향이 조용하다.** 값을 적을 사람이 축의 존재를 모르므로 그 축은 열린 적이 없다.

test('실행기가 받는 어휘를 정답지 문서가 전부 알린다', () => {
  const drift = [];
  for (const { marker, keys, exempt } of PAIRS) {
    const declared = declaredIn(marker) ?? [];
    const container = marker.match(/`([a-z_]+)`/)?.[1] ?? (marker.startsWith('시나리오') ? 'scenario' : 'plan');
    for (const key of keys) {
      if (exempt.includes(key)) continue;
      if (declared.includes(key)) continue;
      drift.push(`${container}.${key}`);
    }
  }

  const unrecorded = drift.filter((k) => !DOC_DRIFT_DEBT.missing_in_doc.includes(k)).sort();
  assert.deepStrictEqual(
    unrecorded,
    [],
    [
      `실행기는 받는데 ${DOC_RELATIVE} 1-A절이 알리지 않는 어휘가 새로 ${unrecorded.length}건 생겼다:`,
      ...unrecorded.map((key) => `  - ${key}`),
      '',
      '**어휘를 열어 놓고 정답지 문서에 안 적으면 그 축은 열린 적이 없다.** 값을 적는',
      '유닛은 이 파일을 읽지 않는다. 1-A절의 「쓸 수 있는 키」 문장에 이름을 넣거나,',
      '넣을 수 없는 이유와 함께 DOC_DRIFT_DEBT.missing_in_doc에 적는다.',
    ].join('\n'),
  );

  const settled = DOC_DRIFT_DEBT.missing_in_doc.filter((k) => !drift.includes(k));
  assert.deepStrictEqual(
    settled,
    [],
    `문서가 이미 알리는데 빚 목록에 남아 있는 것 ${settled.length}건 — 그 줄을 지운다:\n` +
      settled.map((key) => `  - ${key}`).join('\n'),
  );
});

// ── 검사 3. 문서에만 있는 키 ─────────────────────────────────────────────────
//
// 적으면 형식 검사가 거절하므로 조용하지는 않다. 그래도 다음 사람의 한 번을 아낀다.

test('정답지 문서가 알리는 어휘를 실행기가 전부 받는다', () => {
  const drift = [];
  for (const { marker, keys } of PAIRS) {
    const declared = declaredIn(marker) ?? [];
    const container = marker.match(/`([a-z_]+)`/)?.[1] ?? (marker.startsWith('시나리오') ? 'scenario' : 'plan');
    for (const key of declared) {
      if (keys.includes(key)) continue;
      drift.push(`${container}.${key}`);
    }
  }

  const unrecorded = drift.filter((k) => !DOC_DRIFT_DEBT.extra_in_doc.includes(k)).sort();
  assert.deepStrictEqual(
    unrecorded,
    [],
    [
      `${DOC_RELATIVE} 1-A절이 알리는데 실행기가 받지 않는 키가 새로 ${unrecorded.length}건 생겼다:`,
      ...unrecorded.map((key) => `  - ${key}`),
      '',
      '적으면 형식 검사가 「모르는 키」로 거절한다. 어휘에서 지운 축이거나 오타다.',
    ].join('\n'),
  );

  const settled = DOC_DRIFT_DEBT.extra_in_doc.filter((k) => !drift.includes(k));
  assert.deepStrictEqual(
    settled,
    [],
    `문서에서 이미 사라졌는데 빚 목록에 남아 있는 것 ${settled.length}건 — 그 줄을 지운다:\n` +
      settled.map((key) => `  - ${key}`).join('\n'),
  );
});
