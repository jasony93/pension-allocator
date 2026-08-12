// **중복 키**를 잡는 스캐너의 시험 (D57). 정답지 블록과 룰셋 원문 둘 다 본다.
//
// ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────────────
//
// `tax-domain`이 24차에 찾았다 — **GC-40의 한 블록에 `legal_basis`가 두 번 있었다.**
// `JSON.parse`는 같은 객체 안의 같은 키를 예외도 경고도 없이 덮어쓴다
// (`{"a":1,"a":2}` → `{"a":2}`). 그래서 앞에 적힌 `isa.account.requirements` 주장은
// **한 번도 검사되지 않았고**, 블록은 형식 검사도 커버리지도 통과했다.
//
// **형식 검사로는 원리상 못 잡는다.** `validateBlock`이 키를 세는 시점에는 중복이 이미
// 하나로 뭉개져 있다. 버려진 쪽은 파싱 결과 어디에도 흔적이 없으므로, 파싱 뒤에 무엇을
// 세든 그것은 「없는 것을 세는 일」이다. **그래서 원문을 직접 훑는다** —
// `duplicateKeysIn`이 문자열 경계와 괄호 짝만 보고 키의 자리를 센다.
//
// 이 저장소가 이번 세션에 일곱 번째로 밟은 「검사는 옳은데 재는 자리가 없다」이고,
// **앞의 여섯과 성질이 다르다** — 앞의 여섯은 **재는 자리가 없었고**, 이것은
// **잴 대상이 파서 단계에서 사라졌다.**
//
// ── 이 파일이 무엇을 보이나 ──────────────────────────────────────────────────
//
//   1. 합성 원문으로 **무는 것**을 보인다 — 최상위 · 중첩 객체 · 배열 원소 안.
//   2. 합성 원문으로 **헛물지 않는 것**을 보인다 — 형제 객체의 같은 키, 값으로 쓰인
//      문자열, 문자열 안의 괄호·따옴표.
//   3. **실제 문서를 깨 본다** — 정답지 원문을 메모리에서 복사해 한 블록에 키를 겹쳐
//      넣고, `golden-cases.test.mjs`가 쓰는 것과 **같은 경로**(펜스 추출 → 스캐너)로
//      붉어지는지 본다. **문서는 한 글자도 쓰지 않는다** — 정답지는 이 유닛의 산출물이
//      아니고, 검증 장치를 검증하는 쪽이 손대면 장치이기를 그만둔다.
//   4. **룰셋 원문도 같은 눈으로 본다** — 아래에 이유를 적었다.
//   5. **배열이 코드로 접히는 자리**까지 본다 — 파서만 값을 버리는 것이 아니다.
//      `find`는 앞엣것을, `Map`은 나중 것을 남기고 나머지는 흔적이 없다. 검사 5의
//      머리말에 실측을 적었다.
//
// ── 왜 룰셋까지 보는가 (같은 성질의 자리를 훑다가 나왔다) ────────────────────
//
// 관리자가 「검사에 닿기 전에 값이 사라지는 자리가 더 있는지 훑으라」고 했다. **같은
// 형태가 `data/tax-rules/*.json`에 그대로 있다.** 룰셋도 `JSON.parse` 하나로 읽히고,
// 한 규칙의 `value` 안에서 `amount_krw`가 두 번 적히면 **앞엣것이 소리 없이 사라진다.**
// 그 파일은 이 저장소의 모든 숫자의 유일한 출처이므로 손실의 값이 정답지보다 크다.
//
// **지금은 깨끗하다**(둘 다 0건). **그리고 아무도 보고 있지 않았다** —
// `scripts/org/validate-rules.mjs`가 세는 `id 중복`은 배열 원소의 중복이라 다른 것이고,
// 그 검사조차 `JSON.parse` **뒤에** 센다. 그래서 여기에 상시 검사를 세운다.
// **룰셋은 읽기만 한다** — 변형은 전부 메모리 안이다.
//
// **이 파일에는 세법 수치도 기대값도 없다.** 합성 원문의 값은 전부 `1`·`2` 같은 자리
// 표시이고, 문서와 룰셋에서 읽는 것은 키의 이름과 줄 번호뿐이다.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compute } from './index.mjs';
import { ROUNDING_OP, ROUNDING_STAGE, RULE } from './constants.mjs';
import { duplicateKeysIn, extractBlocks } from './golden-block.mjs';
import {
  CONFIRMED_FILE,
  PROPOSED_FILE,
  baseRequest,
  cloneRulesets,
  findRule,
  loadRulesets,
  scenarioOf,
} from './test-helpers.mjs';

/** 결함 주입이 겨눌 자리의 이름. **전부 `constants.mjs`에서 읽는다** — 여기 적지 않는다. */
const ROUNDING_RULE = RULE.ROUNDING_WON_FRACTION;
const DISPLAY_STAGE = ROUNDING_STAGE.DISPLAYED;
const NO_ROUNDING = ROUNDING_OP.NONE;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC_RELATIVE = 'docs/stage-4-verification/golden-cases.md';
const DOC_PATH = join(ROOT, ...DOC_RELATIVE.split('/'));

// ── 검사 1. 무는가 ───────────────────────────────────────────────────────────

const BITES = [
  {
    name: '최상위에 같은 키가 두 번',
    text: '{"case": "GC-01", "case": "GC-02"}',
    paths: ['$.case'],
  },
  {
    name: '중첩된 객체 안 — 실제로 걸린 자리가 최상위가 아니었다',
    text: '{"expect": {"current": {"legal_basis": {"a": 1}, "plans": 2, "legal_basis": {"b": 3}}}}',
    paths: ['$.expect.current.legal_basis'],
  },
  {
    name: '배열 원소인 객체 안',
    text: '{"effects": [{"code": "x"}, {"code": "y", "account": 1, "code": "z"}]}',
    paths: ['$.effects[1].code'],
  },
  {
    name: '두 자리가 동시에',
    text: '{"a": 1, "a": 2, "b": {"c": 3, "c": 4}}',
    paths: ['$.a', '$.b.c'],
  },
  {
    name: '세 번 적히면 두 건이다 — 살아남는 것은 마지막 하나뿐이다',
    text: '{"a": 1, "a": 2, "a": 3}',
    paths: ['$.a', '$.a'],
  },
  {
    name: '줄이 나뉘어 있어도 (정답지 블록의 실제 모양이다)',
    text: '{\n  "expect": {\n    "legal_basis": {},\n    "plans": {},\n    "legal_basis": {}\n  }\n}',
    paths: ['$.expect.legal_basis'],
  },
];

for (const { name, text, paths } of BITES) {
  test(`중복 키를 잡는다: ${name}`, () => {
    const found = duplicateKeysIn(text);
    assert.deepStrictEqual(
      found.map((d) => d.path),
      paths,
      `중복이 있는데 못 잡았거나 엉뚱한 자리를 짚었다. JSON.parse는 이것을 조용히 통과시킨다:\n${text}`,
    );
    // 스캐너가 무는 것과 파서가 버리는 것이 **같은 자리**임을 같은 원문으로 보인다.
    assert.doesNotThrow(() => JSON.parse(text), '이 원문은 파서에게는 멀쩡하다는 것이 이 검사의 전제다');
  });
}

test('앞에 적힌 값이 실제로 파서에게서 사라진다 — 이 검사의 전제', () => {
  // 관리자가 확인한 것과 같은 관찰을 검사로 박아 둔다. 이 동작이 언젠가 바뀌어
  // 파서가 중복을 거절하게 되면, 이 검사가 먼저 실패해서 그 사실을 알린다.
  const text = '{"a": 1, "a": 2}';
  assert.deepStrictEqual(JSON.parse(text), { a: 2 });
  assert.equal(Object.keys(JSON.parse(text)).length, 1, '파싱 뒤에 키를 세면 중복은 세어지지 않는다');
  assert.equal(duplicateKeysIn(text).length, 1, '원문에서는 두 번이다');
});

// ── 검사 2. 헛물지 않는가 ────────────────────────────────────────────────────
//
// 오탐이 나면 정답지를 채우는 유닛이 멀쩡한 블록 앞에서 멈춘다. 무는 것만큼 중요하다.

const QUIET = [
  { name: '형제 객체의 같은 키', text: '{"a": {"code": 1}, "b": {"code": 2}}' },
  { name: '배열의 원소마다 같은 키', text: '{"xs": [{"code": 1}, {"code": 2}, {"code": 3}]}' },
  { name: '키처럼 생긴 문자열 값', text: '{"a": "code", "b": "code"}' },
  { name: '값으로 쓰인 문자열이 키 이름과 같다', text: '{"legal_basis": "legal_basis"}' },
  { name: '문자열 안의 중괄호와 쉼표', text: '{"note": "{\\"a\\": 1, \\"a\\": 2}", "a": 1}' },
  { name: '문자열 안의 이스케이프된 따옴표', text: '{"note": "he said \\"a\\": 1", "a": 1}' },
  { name: '깊이 다른 같은 키', text: '{"a": {"a": {"a": 1}}}' },
  { name: '빈 객체와 빈 배열', text: '{"a": {}, "b": [], "c": [{}]}' },
];

for (const { name, text } of QUIET) {
  test(`중복이 아닌 것을 물지 않는다: ${name}`, () => {
    assert.deepStrictEqual(
      duplicateKeysIn(text),
      [],
      `멀쩡한 원문을 중복으로 신고했다 — 오탐은 정답지를 채우는 쪽을 막는다:\n${text}`,
    );
  });
}

// ── 검사 3. 실제 문서를 깨서 확인한다 ────────────────────────────────────────
//
// 위의 합성 원문은 스캐너를 시험할 뿐이다. **정답지가 실제로 지나가는 경로**(펜스 추출 →
// 스캐너)가 무는지는 진짜 문서로 보여야 한다. 문서는 메모리에서만 변형한다.

const markdown = readFileSync(DOC_PATH, 'utf8');
const { blocks } = extractBlocks(markdown);

test('지금 정답지의 블록 전부에 중복 키가 없다', () => {
  const problems = [];
  for (const { body, line } of blocks) {
    for (const duplicate of duplicateKeysIn(body)) {
      problems.push(`${DOC_RELATIVE}:${line + duplicate.line} — ${duplicate.path}`);
    }
  }
  assert.deepStrictEqual(problems, [], `중복 키 ${problems.length}건:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  assert.ok(blocks.length > 0, '블록을 하나도 못 읽었다 — 위 검사가 아무것도 재지 않고 통과한다');
});

/**
 * 블록 원문의 **첫 키를 그 객체 안에 한 번 더 적는다.** 값은 그대로 두므로 파싱 결과는
 * 변형 전과 완전히 같다 — 즉 **다른 어떤 검사도 이 변형을 감지하지 못한다.** 그것이
 * 이 결함의 성질이고, 스캐너만 물어야 한다.
 */
function withDuplicatedFirstKey(body) {
  const match = /^(\s*\{\s*\n)(\s*)("([a-z_]+)"\s*:\s*)/.exec(body);
  assert.ok(match, `블록 원문이 예상한 모양이 아니다 — 결함 주입이 아무것도 안 바꿨을 수 있다:\n${body.slice(0, 200)}`);
  const [, open, indent, keyAndColon, key] = match;
  const injected = `${open}${indent}"${key}": null,\n${indent}${keyAndColon}`;
  return { text: body.replace(match[0], injected), key };
}

test('결함 주입: 정답지 블록에 키를 한 번 더 적으면 붉어진다', () => {
  assert.ok(blocks.length > 0, '깨 볼 블록이 없다');

  const broken = [];
  for (const { body, line } of blocks) {
    const { text, key } = withDuplicatedFirstKey(body);

    // 파싱 결과는 변형 전과 같다. **이 단언이 이 검사의 핵심이다** — 값이 하나도 안
    // 바뀌었으므로 대조 검사도 형식 검사도 이 변형을 볼 수 없다.
    assert.deepStrictEqual(
      JSON.parse(text),
      JSON.parse(body),
      `${DOC_RELATIVE}:${line} — 키를 겹쳐 적었는데 파싱 결과가 달라졌다. 주입이 다른 것을 바꿨다는 뜻이다`,
    );

    const found = duplicateKeysIn(text);
    if (found.length === 1 && found[0].path === `$.${key}`) continue;
    broken.push(`${DOC_RELATIVE}:${line} — ${key}를 겹쳐 적었는데 ${found.length}건을 잡았다`);
  }

  assert.deepStrictEqual(
    broken,
    [],
    `블록에 키를 일부러 겹쳐 넣었는데 스캐너가 못 잡은 곳 ${broken.length}건 ` +
      `(전체 ${blocks.length}개 블록):\n${broken.map((p) => `  - ${p}`).join('\n')}`,
  );
});

test('결함 주입: 겹친 키가 문서 전체 경로(펜스 추출 → 스캐너)에서도 붉어진다', () => {
  const target = blocks[0];
  const { text } = withDuplicatedFirstKey(target.body);
  const mutated = markdown.replace(target.body, text);
  assert.notEqual(mutated, markdown, '문서 사본이 안 바뀌었다 — 아래 검사가 아무것도 재지 않는다');

  const problems = [];
  for (const { body, line } of extractBlocks(mutated).blocks) {
    for (const duplicate of duplicateKeysIn(body)) {
      problems.push({ where: `${DOC_RELATIVE}:${line + duplicate.line}`, docLine: line + duplicate.line, path: duplicate.path });
    }
  }

  assert.equal(
    problems.length,
    1,
    `문서 사본의 한 블록에 키를 겹쳐 넣었는데 ${problems.length}건이 나왔다. ` +
      `1건이어야 한다 — 못 잡으면 골든 케이스 검사도 못 잡는다: ${JSON.stringify(problems)}`,
  );
  // 줄 번호가 실제로 그 자리를 가리키는지 본다. 못 짚으면 다음 사람이 74개 블록을 눈으로 훑는다.
  const { docLine } = problems[0];
  assert.ok(
    docLine > target.line && docLine <= target.line + target.body.split('\n').length,
    `신고된 줄 ${docLine}이 그 블록(${target.line}부터 ${target.body.split('\n').length}줄) 안이 아니다`,
  );
});

// ── 검사 4. 룰셋 원문 (이번 회차의 훑기에서 나온 자리) ───────────────────────
//
// **같은 손실이 룰셋에서도 가능하고, 값이 더 크다.** 정답지에서 사라지면 주장 하나가
// 검사되지 않는 데서 그치지만, **룰셋에서 사라지면 잘못된 수로 계산이 돈다** — 그리고
// 엔진의 모든 검사는 파싱된 값을 보므로 하나도 모른다.
//
// 손으로 확인한 것 하나를 적어 둔다 — `validate-rules.mjs`가 세는 `id 중복`은 **규칙
// 배열의 원소**가 겹치는 것이고, 여기서 보는 것은 **한 객체 안의 키**다. 서로를 대신하지
// 못한다. 그리고 그 검사도 `JSON.parse` 뒤에 돌므로 이 손실 앞에서는 눈이 없다.

const RULESET_FILES = [CONFIRMED_FILE, PROPOSED_FILE];
const rulesetText = new Map(
  RULESET_FILES.map((file) => [file, readFileSync(join(ROOT, 'data', 'tax-rules', file), 'utf8')]),
);

test('룰셋 원문에 같은 객체의 중복 키가 없다', () => {
  const problems = [];
  for (const [file, text] of rulesetText) {
    for (const duplicate of duplicateKeysIn(text)) {
      problems.push(`data/tax-rules/${file}:${duplicate.line} — ${duplicate.path} (앞선 것은 ${duplicate.firstLine}줄)`);
    }
  }
  assert.deepStrictEqual(
    problems,
    [],
    `룰셋에 중복 키 ${problems.length}건. **앞에 적은 값은 JSON.parse가 버린다** — 엔진은 ` +
      `살아남은 값으로 계산하고 어떤 검사도 그 사실을 모른다:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
  assert.equal(rulesetText.size, RULESET_FILES.length, '룰셋 파일을 못 읽었다면 위 검사는 아무것도 재지 않는다');
});

test('결함 주입: 룰셋의 규칙 하나에 키를 겹쳐 적으면 붉어진다', () => {
  for (const [file, text] of rulesetText) {
    // 어떤 규칙의 `value` 블록 안에 키를 하나 더 적는다. **중첩된 자리**를 고른 것은
    // 실제로 걸린 자리(GC-40)가 최상위가 아니었기 때문이다.
    const match = /("value"\s*:\s*\{\s*\n)(\s*)("([a-z_]+)"\s*:\s*)/.exec(text);
    assert.ok(match, `${file}에서 주입할 자리를 못 찾았다 — 이 검사가 아무것도 재지 않는다`);
    const [, open, indent, keyAndColon, key] = match;
    const mutated = text.replace(match[0], `${open}${indent}"${key}": null,\n${indent}${keyAndColon}`);

    // 파싱 결과는 그대로다. 즉 **이 변형은 스캐너 말고는 아무도 볼 수 없다.**
    assert.deepStrictEqual(JSON.parse(mutated), JSON.parse(text), `${file} — 주입이 파싱 결과를 바꿨다`);

    const found = duplicateKeysIn(mutated);
    assert.equal(found.length, 1, `${file}에 ${key}를 겹쳐 적었는데 ${found.length}건이 나왔다`);
    assert.equal(found[0].key, key, `${file} — 엉뚱한 키를 짚었다: ${found[0].path}`);
    assert.ok(found[0].path.endsWith(`.${key}`), `${file} — 경로가 그 자리를 안 가리킨다: ${found[0].path}`);
  }
});

// ── 검사 5. 같은 성질의 두 번째 자리 — 배열이 키로 접히는 곳 ─────────────────
//
// **훑다가 나온 것이다.** 중복 키는 `JSON.parse`가 값을 버리는 자리였다. 그런데 값이
// 사라지는 자리가 파서만은 아니다 — **배열을 코드로 키 매겨 읽는 순간에도 한 원소가
// 사라진다.** 룰셋에는 그런 배열이 27자리 있다(`rules` · `stages` · `requirements` ·
// `effects` · `statutory_path` …).
//
// **두 관습이 서로 다른 쪽을 버린다는 것이 이 자리의 성질을 그대로 보여 준다.**
//   · `new Map(...).set(code, x)` — **나중 것**이 이긴다 (`rounding.mjs`의 단계 표)
//   · `array.find((x) => x.id === …)` — **앞엣것**이 이긴다 (`test-helpers.findRule` 등)
// 같은 데이터가 읽는 자리에 따라 다른 값이 된다. 어느 쪽이든 **버려진 원소는 흔적이 없다.**
//
// **`rules[].id` 하나만 보호되고 있었다** — `scripts/org/validate-rules.mjs`가 센다.
// 나머지 스물여섯 자리는 아무도 안 본다. **그리고 그 손실은 세액을 바꾼다** — 아래
// 결함 주입이 실측한다: 단계 표에 `displayed_amount`를 하나 더 적으면 절세액이 바뀌는데
// `ok`는 `true`이고 오류도 안내도 한 건 늘지 않는다.
//
// **지금 룰셋은 27자리 전부 깨끗하다.** 그래서 이 검사는 지금 아무것도 신고하지 않는다 —
// 그러나 다음에 생기면 조용하지 않다.

/** 배열이 「코드로 찾아 읽는 표」인지 판정할 때 보는 이름들. 세법 수치가 아니라 필드명이다. */
const IDENTIFYING_FIELDS = ['id', 'code', 'rule_id', 'stage_code'];

/**
 * 파싱된 룰셋에서 **모든 원소가 같은 이름의 문자열 식별자를 가진 배열**을 찾아, 그 값이
 * 겹치는 곳을 신고한다. 그런 배열은 엔진이 `find`나 `Map`으로 읽는 표이고, 겹치면 한
 * 원소가 소리 없이 사라진다.
 */
function duplicateCodesIn(doc, root) {
  const sites = [];
  const duplicates = [];

  (function walk(node, path) {
    if (Array.isArray(node)) {
      const objects = node.filter((x) => x !== null && typeof x === 'object' && !Array.isArray(x));
      if (objects.length === node.length && node.length > 1) {
        for (const field of IDENTIFYING_FIELDS) {
          if (!objects.every((o) => typeof o[field] === 'string')) continue;
          sites.push(`${path}(${field})`);
          const seen = new Set();
          for (const [index, object] of objects.entries()) {
            if (seen.has(object[field])) duplicates.push(`${path}[${index}].${field} = "${object[field]}"`);
            seen.add(object[field]);
          }
        }
      }
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const key of Object.keys(node)) walk(node[key], `${path}.${key}`);
    }
  })(doc, root);

  return { sites, duplicates };
}

test('룰셋에서 코드로 읽는 표에 같은 코드가 두 번 나오지 않는다', () => {
  const duplicates = [];
  let siteCount = 0;
  for (const file of RULESET_FILES) {
    const found = duplicateCodesIn(JSON.parse(rulesetText.get(file)), `data/tax-rules/${file}`);
    siteCount += found.sites.length;
    duplicates.push(...found.duplicates);
  }

  assert.deepStrictEqual(
    duplicates,
    [],
    `코드로 찾아 읽는 표에 겹친 코드 ${duplicates.length}건. **엔진은 그중 하나만 읽는다** — ` +
      `Map은 나중 것을, find는 앞엣것을 남기고 나머지는 흔적 없이 사라진다:\n` +
      duplicates.map((d) => `  - ${d}`).join('\n'),
  );
  // 이번 세션이 일곱 번 밟은 형태를 이 검사 자신에게도 적용한다 — **재는 자리가 있는가.**
  assert.ok(siteCount > 0, '코드로 읽는 표를 하나도 못 찾았다 — 위 단언은 아무것도 재지 않는다');
});

/**
 * **입력이지 세법 수치가 아니다.** 이 월 납입 여력에서 세액공제액의 정확값에 원 미만
 * 끝수가 생기고, 그래서 「표시 직전 절사」 단계가 답을 바꾸는 자리가 된다. 끝수가 없는
 * 좌표를 고르면 아래 주입이 아무것도 안 바꾸면서 통과한다.
 */
const CAPACITY_WITH_FRACTION_KRW = 333_333;

test('결함 주입: 단계 표에 같은 코드를 하나 더 적으면 세액이 바뀌는데 아무도 안 멈춘다', () => {
  const request = baseRequest({ profile: { monthly_capacity_krw: CAPACITY_WITH_FRACTION_KRW } });
  const before = compute(request, loadRulesets());

  const mutated = cloneRulesets(loadRulesets());
  const stages = findRule(mutated, CONFIRMED_FILE, ROUNDING_RULE).value.stages;
  const twin = structuredClone(stages.find((s) => s.stage_code === DISPLAY_STAGE));
  assert.ok(twin, `${ROUNDING_RULE}에 ${DISPLAY_STAGE} 단계가 없다 — 주입할 자리를 못 찾았다`);
  // **뒤에 붙인다.** `Map`은 나중 것을 남기므로 앞의 진짜 단계가 사라진다.
  twin.operation_code = NO_ROUNDING;
  delete twin.unit_krw;
  stages.push(twin);

  const after = compute(request, mutated);

  // (1) 아무도 안 멈춘다 — 이것이 이 자리의 성질이다.
  assert.equal(after.ok, true, '주입한 룰셋이 오류로 걸렸다면 이 자리는 조용하지 않다는 뜻이다');
  assert.deepStrictEqual(after.errors ?? [], before.errors ?? [], '오류가 늘었다면 이미 누군가 보고 있다는 뜻이다');

  // (2) 그런데 답은 바뀐다.
  assert.notDeepStrictEqual(
    scenarioOf(after, 'current').plans,
    scenarioOf(before, 'current').plans,
    '같은 코드를 하나 더 적었는데 답이 그대로다 — 이 좌표에서는 끝수가 없다는 뜻이므로 좌표를 고쳐 잡는다',
  );

  // (3) 위의 검사가 그것을 문다.
  const { duplicates } = duplicateCodesIn(mutated[CONFIRMED_FILE], CONFIRMED_FILE);
  assert.equal(duplicates.length, 1, `겹친 코드를 ${duplicates.length}건 잡았다 — 1건이어야 한다`);
  assert.ok(
    duplicates[0].includes(DISPLAY_STAGE),
    `엉뚱한 자리를 짚었다: ${duplicates[0]}`,
  );
});
