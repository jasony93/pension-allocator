import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentFile } from '../../scripts/org/parse-agent.mjs';

const SAMPLE = [
  '---',
  'name: qa',
  'description: 품질 검증이 필요할 때 호출',
  'tools: Read, Glob, Grep, Bash, Write',
  'model: sonnet',
  '---',
  '## 역할',
  '품질을 검증한다.',
  '',
  '### 세부',
  '하위 제목은 섹션을 새로 열지 않는다.',
  '',
  '## 완료 기준',
  '리포트가 작성되면 끝.',
  '',
].join('\n');

test('frontmatter와 섹션을 함께 파싱한다', () => {
  const { frontmatter, sections } = parseAgentFile(SAMPLE);
  assert.equal(frontmatter.name, 'qa');
  assert.equal(frontmatter.tools, 'Read, Glob, Grep, Bash, Write');
  assert.deepEqual(Object.keys(sections), ['역할', '완료 기준']);
  assert.match(sections['역할'], /품질을 검증한다/);
});

test('h3 이하는 상위 섹션 본문에 포함된다', () => {
  const { sections } = parseAgentFile(SAMPLE);
  assert.match(sections['역할'], /하위 제목은 섹션을 새로 열지 않는다/);
});

test('frontmatter가 없으면 던진다', () => {
  assert.throws(() => parseAgentFile('## 역할\n내용\n'), /frontmatter 없음/);
});
