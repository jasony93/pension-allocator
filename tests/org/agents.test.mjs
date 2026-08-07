import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateAgents } from '../../scripts/org/validate-agents.mjs';
import { UNITS } from '../../scripts/org/units.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = join(ROOT, 'tests', 'org', 'fixtures');
const fixture = (name) => join(FIXTURES, name);

const VALID_QA = readFileSync(join(fixture('one-valid-agent'), 'qa.md'), 'utf8');

/**
 * 임시 디렉터리에 정의 파일을 깔고 검증기를 돌린다.
 * 검사 하나마다 픽스처 디렉터리를 만들어 두면 저장소에 죽은 파일이 쌓이고,
 * 어느 픽스처가 어느 검사를 지키는지 알 수 없게 된다.
 */
function inAgentDir(files, run) {
  const dir = mkdtempSync(join(FIXTURES, 'tmp-agents-'));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** qa 정의 하나만 둔 디렉터리를 검사하고, qa에 대한 오류만 돌려준다. */
const qaErrors = (text) =>
  inAgentDir({ 'qa.md': text }, (dir) => validateAgents(dir).filter((e) => e.startsWith('qa:')));

test('명세표에 8개 유닛이 있다', () => {
  assert.equal(UNITS.length, 8);
});

test('유닛 이름이 중복되지 않는다', () => {
  assert.equal(new Set(UNITS.map((u) => u.name)).size, UNITS.length);
});

test('정의가 없는 디렉터리는 유닛 수만큼 오류가 난다', () => {
  assert.equal(validateAgents(fixture('no-agents')).length, UNITS.length);
});

test('없는 디렉터리를 넘겨도 던지지 않는다', () => {
  assert.equal(validateAgents(fixture('존재하지-않는-디렉터리')).length, UNITS.length);
});

test('명세표를 만족하는 정의는 오류를 내지 않는다', () => {
  const errors = validateAgents(fixture('one-valid-agent'));
  assert.equal(errors.length, UNITS.length - 1);
  assert.equal(errors.filter((e) => e.startsWith('qa:')).length, 0);
});

test('명세표보다 넓은 도구 권한을 실패시킨다', () => {
  const errors = validateAgents(fixture('bad-tools')).filter((e) => e.startsWith('qa:'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /tools 불일치/);
});

test('명세표에 없는 .md 정의를 실패시킨다', () => {
  const errors = inAgentDir({ 'qa.md': VALID_QA, 'shadow-admin.md': VALID_QA }, (dir) =>
    validateAgents(dir),
  );
  const rogue = errors.filter((e) => /명세표에 없는 에이전트 정의/.test(e));
  assert.equal(rogue.length, 1);
  assert.match(rogue[0], /^shadow-admin\.md: /);
  assert.equal(errors.filter((e) => e.startsWith('qa:')).length, 0);
});

test('.md가 아닌 파일은 정의로 보지 않는다', () => {
  const errors = inAgentDir({ 'qa.md': VALID_QA, 'NOTES.txt': '메모' }, (dir) =>
    validateAgents(dir),
  );
  assert.equal(errors.filter((e) => /명세표에 없는 에이전트 정의/.test(e)).length, 0);
});

test('frontmatter name이 파일명과 다르면 실패시킨다', () => {
  const errors = qaErrors(VALID_QA.replace('name: qa', 'name: quality'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /frontmatter name이 "quality" — 파일명과 불일치/);
});

test('description이 없으면 실패시킨다', () => {
  const errors = qaErrors(VALID_QA.replace('description: 픽스처용 정의\n', ''));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /description 없음/);
});

test('model이 명세표와 다르면 실패시킨다', () => {
  const errors = qaErrors(VALID_QA.replace('model: sonnet', 'model: opus'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /model이 "opus" — 명세표는 "sonnet"/);
});

test('필수 섹션이 없으면 실패시킨다', () => {
  const errors = qaErrors(VALID_QA.replace('## 금지사항\n픽스처.\n', ''));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"## 금지사항" 섹션 없음/);
});

test('필수 섹션이 비어 있으면 실패시킨다', () => {
  const errors = qaErrors(VALID_QA.replace('## 금지사항\n픽스처.\n', '## 금지사항\n\n'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"## 금지사항" 섹션이 비어 있음/);
});

test('산출물 섹션에 쓰기 경로가 빠지면 실패시킨다', () => {
  const errors = qaErrors(VALID_QA.replace('docs/stage-6-operations/<YYYY-MM>-qa.md\n', ''));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /산출물 섹션에 쓰기 경로 "docs\/stage-6-operations\/" 미기재/);
});

test('파싱 실패는 유닛 오류로 보고되고 나머지 검사를 막지 않는다', () => {
  const errors = inAgentDir({ 'qa.md': '머리말이 없는 정의\n' }, (dir) => validateAgents(dir));
  const qa = errors.filter((e) => e.startsWith('qa:'));
  assert.equal(qa.length, 1);
  assert.match(qa[0], /파싱 실패 — frontmatter 없음/);
  assert.equal(errors.length, UNITS.length);
});

test('실제 유닛 정의가 모두 명세표와 일치한다', () => {
  assert.deepEqual(validateAgents(join(ROOT, '.claude', 'agents')), []);
});
