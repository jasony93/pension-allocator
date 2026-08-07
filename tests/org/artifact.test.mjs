import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateArtifact, validateArtifactDirs } from '../../scripts/org/validate-artifact.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = join(ROOT, 'tests', 'org', 'fixtures');

const load = (name) => readFileSync(join(FIXTURES, name), 'utf8');

test('올바른 머리말은 오류가 없다', () => {
  assert.deepEqual(validateArtifact(load('artifact-valid.md'), 'artifact-valid.md'), []);
});

test('머리말이 없으면 실패시킨다', () => {
  const errors = validateArtifact(load('artifact-no-header.md'), 'artifact-no-header.md');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /머리말 없음/);
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
