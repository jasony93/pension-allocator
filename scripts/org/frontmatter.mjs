const BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * YAML의 아주 작은 부분집합만 파싱한다.
 * 지원: `key: value` 스칼라, `key: []` 빈 리스트, `key:` 다음 줄부터의 `  - item` 블록 리스트.
 * 조직 산출물 머리말은 이 범위를 벗어나지 않으므로 의존성을 추가하지 않는다.
 */
export function parseFrontmatter(text) {
  const match = BLOCK.exec(text);
  if (!match) throw new Error('frontmatter 없음');

  const data = {};
  let currentListKey = null;

  for (const raw of match[1].split(/\r?\n/)) {
    if (!raw.trim()) continue;

    const item = /^\s+-\s*(.*)$/.exec(raw);
    if (item) {
      if (currentListKey === null) throw new Error(`리스트 항목이 키 없이 등장: ${raw}`);
      data[currentListKey].push(item[1].trim());
      continue;
    }

    const idx = raw.indexOf(':');
    if (idx === -1) throw new Error(`형식이 잘못된 줄: ${raw}`);
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();

    if (value === '') {
      data[key] = [];
      currentListKey = key;
    } else if (value === '[]') {
      data[key] = [];
      currentListKey = null;
    } else {
      data[key] = value;
      currentListKey = null;
    }
  }

  return { data, body: text.slice(match[0].length) };
}
