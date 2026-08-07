import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../../scripts/org/frontmatter.mjs';

test('스칼라 값을 파싱한다', () => {
  const { data, body } = parseFrontmatter('---\nname: qa\nmodel: sonnet\n---\n본문\n');
  assert.equal(data.name, 'qa');
  assert.equal(data.model, 'sonnet');
  assert.equal(body, '본문\n');
});

test('블록 리스트를 배열로 파싱한다', () => {
  const text = '---\nunit: tax-domain\nopen_questions:\n  - 경계 확인 필요\n  - 시행일 확인 필요\n---\n';
  const { data } = parseFrontmatter(text);
  assert.deepEqual(data.open_questions, ['경계 확인 필요', '시행일 확인 필요']);
});

test('빈 리스트는 빈 배열이 된다', () => {
  const { data } = parseFrontmatter('---\ninputs: []\n---\n');
  assert.deepEqual(data.inputs, []);
});

test('값에 콜론이 있어도 첫 콜론에서만 자른다', () => {
  const { data } = parseFrontmatter('---\ndescription: 세무 담당: 룰셋 작성\n---\n');
  assert.equal(data.description, '세무 담당: 룰셋 작성');
});

test('frontmatter가 없으면 던진다', () => {
  assert.throws(() => parseFrontmatter('# 제목\n본문\n'), /frontmatter 없음/);
});
