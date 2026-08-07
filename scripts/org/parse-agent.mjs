import { parseFrontmatter } from './frontmatter.mjs';

const H2 = /^##\s+(.+?)\s*$/;

export function parseAgentFile(text) {
  const { data, body } = parseFrontmatter(text);

  const sections = {};
  let current = null;

  for (const line of body.split(/\r?\n/)) {
    const heading = H2.exec(line);
    if (heading) {
      current = heading[1];
      // 같은 제목이 두 번 나오면 앞 섹션의 본문이 조용히 사라진다.
      // 권한을 가르는 파일에서 내용이 소리 없이 없어지는 것은 최악의 실패 방식이다.
      if (Object.hasOwn(sections, current)) {
        throw new Error(`"## ${current}" 섹션이 중복 정의됨`);
      }
      sections[current] = '';
    } else if (current !== null) {
      sections[current] += line + '\n';
    }
  }

  return { frontmatter: data, sections };
}
