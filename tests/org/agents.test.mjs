import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateAgents } from '../../scripts/org/validate-agents.mjs';
import { UNITS } from '../../scripts/org/units.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = (name) => join(ROOT, 'tests', 'org', 'fixtures', name);

test('명세표에 8개 유닛이 있다', () => {
  assert.equal(UNITS.length, 8);
});

test('유닛 이름이 중복되지 않는다', () => {
  assert.equal(new Set(UNITS.map((u) => u.name)).size, UNITS.length);
});

test('정의가 없는 디렉터리는 유닛 수만큼 오류가 난다', () => {
  assert.equal(validateAgents(fixture('no-agents')).length, UNITS.length);
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

test('실제 유닛 정의가 모두 명세표와 일치한다', () => {
  assert.deepEqual(validateAgents(join(ROOT, '.claude', 'agents')), []);
});
