import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateArtifact, validateArtifactDirs } from '../../scripts/org/validate-artifact.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = join(ROOT, 'tests', 'org', 'fixtures');

const load = (name) => readFileSync(join(FIXTURES, name), 'utf8');

const header = (unit, stage, status = 'draft') =>
  ['---', `unit: ${unit}`, `stage: ${stage}`, `status: ${status}`, 'inputs: []', 'open_questions: []', '---', '', '# 문서', ''].join('\n');

/** 임시 저장소 루트를 만들어 디렉터리 스캔 전체를 돌린다. */
function inRoot(files, run) {
  const root = mkdtempSync(join(FIXTURES, 'tmp-artifact-'));
  try {
    for (const [relative, text] of Object.entries(files)) {
      const path = join(root, ...relative.split('/'));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('올바른 머리말은 오류가 없다', () => {
  assert.deepEqual(validateArtifact(load('artifact-valid.md'), 'artifact-valid.md'), []);
});

test('머리말이 없으면 실패시킨다', () => {
  const errors = validateArtifact(load('artifact-no-header.md'), 'artifact-no-header.md');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /머리말 없음/);
});

test('머리말이 있으나 형식이 깨졌으면 그 사실을 메시지에 담는다', () => {
  const errors = validateArtifact('---\nunit qa\n---\n', 'broken.md');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /형식이 잘못된 줄: unit qa/);
});

test('알 수 없는 unit 이름을 실패시킨다', () => {
  const text = load('artifact-valid.md').replace('unit: product-planner', 'unit: nobody');
  const errors = validateArtifact(text, 'x.md');
  assert.ok(errors.some((e) => /알 수 없는 unit/.test(e)));
});

test('status가 draft/approved가 아니면 실패시킨다', () => {
  const text = load('artifact-valid.md').replace('status: draft', 'status: done');
  const errors = validateArtifact(text, 'x.md');
  assert.ok(errors.some((e) => /status/.test(e)));
});

test('stage가 숫자가 아니면 실패시킨다', () => {
  const text = load('artifact-valid.md').replace('stage: 1', 'stage: 첫번째');
  const errors = validateArtifact(text, 'x.md');
  assert.ok(errors.some((e) => /stage/.test(e)));
});

test('README.md는 검사 대상에서 제외된다', () => {
  assert.deepEqual(validateArtifactDirs(ROOT), []);
});

test('제자리에 놓인 문서는 오류가 없다', () => {
  const errors = inRoot(
    { 'docs/stage-1-discovery/requirements.md': header('product-planner', 1) },
    validateArtifactDirs,
  );
  assert.deepEqual(errors, []);
});

test('머리말 stage가 디렉터리 단계와 다르면 실패시킨다', () => {
  const errors = inRoot(
    { 'docs/stage-1-discovery/requirements.md': header('product-planner', 99) },
    validateArtifactDirs,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /stage가 "99" — 이 디렉터리는 1단계다/);
});

test('머리말 stage가 0이어도 디렉터리와 대조한다', () => {
  const errors = inRoot(
    { 'docs/stage-1-discovery/requirements.md': header('product-planner', 0) },
    validateArtifactDirs,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /이 디렉터리는 1단계다/);
});

test('쓰기 범위 밖에 놓인 문서를 실패시킨다', () => {
  const errors = inRoot(
    { 'docs/stage-1-discovery/qa-notes.md': header('qa', 1) },
    validateArtifactDirs,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unit "qa"의 쓰기 범위 밖/);
});

test('디렉터리 접두사 writeScope는 그 아래 파일을 모두 허용한다', () => {
  const errors = inRoot(
    { 'docs/stage-6-operations/2026-09-qa.md': header('qa', 6) },
    validateArtifactDirs,
  );
  assert.deepEqual(errors, []);
});

test('정확한 경로 writeScope는 같은 디렉터리의 다른 파일을 허용하지 않는다', () => {
  const errors = inRoot(
    { 'docs/stage-1-discovery/requirements-v2.md': header('product-planner', 1) },
    validateArtifactDirs,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /쓰기 범위 밖/);
});

test('새로 생긴 단계 디렉터리도 목록에 없이 검사된다', () => {
  const errors = inRoot(
    { 'docs/stage-3-implementation/notes.md': header('web-dev', 1) },
    validateArtifactDirs,
  );
  assert.ok(errors.some((e) => e.startsWith('docs/stage-3-implementation/notes.md: ')));
  assert.ok(errors.some((e) => /이 디렉터리는 3단계다/.test(e)));
});

test('docs 디렉터리가 없어도 던지지 않는다', () => {
  assert.deepEqual(inRoot({ 'README.md': '루트만 있다' }, validateArtifactDirs), []);
});

test('머리말이 깨진 문서는 경로 검사까지 가지 않고 한 번만 보고된다', () => {
  const errors = inRoot(
    { 'docs/stage-1-discovery/requirements.md': '# 머리말 없음\n' },
    validateArtifactDirs,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /머리말 없음/);
});
