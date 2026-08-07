import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateCharter } from '../../scripts/org/validate-charter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('없는 헌장 파일은 오류를 낸다', () => {
  const errors = validateCharter(join(ROOT, 'tests', 'org', 'fixtures', 'missing-charter.md'));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /헌장 파일 없음/);
});

test('실제 헌장이 모든 유닛과 게이트를 기술한다', () => {
  assert.deepEqual(validateCharter(join(ROOT, 'docs', 'org', 'charter.md')), []);
});
