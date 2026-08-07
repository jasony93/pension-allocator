import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRuleset, validateRulesDir } from '../../scripts/org/validate-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = join(ROOT, 'tests', 'org', 'fixtures');

const load = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

test('올바른 룰셋은 오류가 없다', () => {
  assert.deepEqual(validateRuleset(load('rules-valid.json'), 'rules-valid.json'), []);
});

test('source 없는 규칙을 실패시킨다', () => {
  const errors = validateRuleset(load('rules-no-source.json'), 'rules-no-source.json');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /source 없음/);
});

test('확정 파일에 개정예고 규칙이 섞이면 실패시킨다', () => {
  const errors = validateRuleset(load('rules-mixed-status.json'), 'rules-mixed-status.json');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /개정예고 규칙이 섞여 있음/);
});

test('id가 중복되면 실패시킨다', () => {
  const doc = load('rules-valid.json');
  doc.rules.push({ ...doc.rules[0] });
  const errors = validateRuleset(doc, 'dup');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /id 중복/);
});

test('개정예고 규칙에 bill_stage가 없으면 실패시킨다', () => {
  const doc = load('rules-valid.json');
  doc.status = '개정예고';
  doc.rules[0].status = '개정예고';
  const errors = validateRuleset(doc, 'proposed');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /bill_stage/);
});

test('룰셋 디렉터리에 JSON이 없어도 오류가 아니다', () => {
  assert.deepEqual(validateRulesDir(join(ROOT, 'data', 'tax-rules')), []);
});
