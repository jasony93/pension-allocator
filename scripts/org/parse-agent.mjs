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
      sections[current] = '';
    } else if (current !== null) {
      sections[current] += line + '\n';
    }
  }

  return { frontmatter: data, sections };
}
