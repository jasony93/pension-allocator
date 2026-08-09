import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  youthProvisionalRule,
  isWithinYouthAgeRange,
  normalizeAgeRange,
  YOUTH_PENSION_RULE_ID,
} from './provisional-rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

function realRulesets() {
  const dir = path.join(repoRoot, 'data', 'tax-rules');
  const bundle = {};
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.json')) bundle[name] = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
  }
  return bundle;
}

test('the youth rule is read from the ruleset, law string and all', () => {
  const rule = youthProvisionalRule(realRulesets());
  assert.ok(rule, `${YOUTH_PENSION_RULE_ID}를 룰셋에서 찾지 못했다`);
  assert.equal(typeof rule.law, 'string');
  assert.ok(rule.law.length > 0, 'LawChip이 담을 문자열이 룰셋에서 와야 한다');
  assert.equal(rule.billStage, '정부안');
});

test('today the ruleset carries no age range, so the screen has nothing to say about it', () => {
  // 시행령 개정안이 아직 공개되지 않았다. 세제개편안 상세본이 특정 연령대로
  // 설명했지만 **조문이 아니므로** 화면이 그 숫자를 쓰면 출처 없는 숫자를
  // 말하는 것이 된다(제품 원칙 1·2, screens.md 3.9.2절).
  const rule = youthProvisionalRule(realRulesets());
  assert.equal(rule.ageRange, null);
  assert.equal(isWithinYouthAgeRange(rule.ageRange, 30), false, '범위가 없으면 판정하지 않는다');
});

test('the day the ruleset carries a range, the line switches itself on', () => {
  // 이 테스트가 "그날 저절로 켜진다"는 약속을 고정한다. 화면 코드는 한 글자도
  // 바뀌지 않고 룰셋만 바뀌면 된다.
  const withRange = {
    'x.json': {
      rules: [
        {
          id: YOUTH_PENSION_RULE_ID,
          bill_stage: '정부안',
          value: { age_range: { min_age: 15, max_age: 34 } },
          source: { law: '소득세법 제59조의3 제1항' },
        },
      ],
    },
  };
  const rule = youthProvisionalRule(withRange);
  assert.deepEqual(rule.ageRange, { minAge: 15, maxAge: 34 });
  assert.equal(isWithinYouthAgeRange(rule.ageRange, 30), true);
  assert.equal(isWithinYouthAgeRange(rule.ageRange, 15), true, '경계는 포함이다');
  assert.equal(isWithinYouthAgeRange(rule.ageRange, 34), true);
  assert.equal(isWithinYouthAgeRange(rule.ageRange, 35), false);
  assert.equal(isWithinYouthAgeRange(rule.ageRange, null), false, '나이를 모르면 판정하지 않는다');
});

test('an age range in an unrecognised shape is treated as absent, never guessed', () => {
  assert.equal(normalizeAgeRange('15~34세'), null);
  assert.equal(normalizeAgeRange({ min_age: 15 }), null);
  assert.deepEqual(normalizeAgeRange([15, 34]), { minAge: 15, maxAge: 34 });
});

test('a missing rule means the block is not drawn — no LawChip, no sentence', () => {
  assert.equal(youthProvisionalRule({}), null);
  assert.equal(youthProvisionalRule({ 'x.json': { rules: [{ id: YOUTH_PENSION_RULE_ID, value: {} }] } }), null, 'source.law이 없으면 그리지 않는다');
});

test('no youth age number appears anywhere in the screen code', () => {
  // 세제개편안이 설명한 연령대를 화면이 적으면 출처 없는 숫자를 말하는 것이다.
  const webRoot = path.resolve(here, '..');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        const text = readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        for (const pattern of [/15\s*~\s*34/, /\b34세\b/, /\b15세\b/]) {
          if (pattern.test(text)) offenders.push(`${path.relative(webRoot, full)}: ${pattern}`);
        }
      }
    }
  };
  walk(webRoot);
  assert.deepEqual(offenders, [], `청년 연령 범위 숫자가 화면 코드에 있다:\n${offenders.join('\n')}`);
});
