import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { UNITS } from './units.mjs';

const STAGE_DIRS = [
  'docs/stage-1-discovery',
  'docs/stage-2-design',
  'docs/stage-4-verification',
  'docs/stage-5-launch',
  'docs/stage-6-operations',
];

const STATUSES = ['draft', 'approved'];
const UNIT_NAMES = UNITS.map((u) => u.name);

export function validateArtifact(text, label) {
  let data;
  try {
    ({ data } = parseFrontmatter(text));
  } catch {
    return [`${label}: 머리말 없음 — 조직 표준 머리말이 있어야 한다`];
  }

  const errors = [];

  if (!UNIT_NAMES.includes(data.unit)) {
    errors.push(`${label}: 알 수 없는 unit "${data.unit}"`);
  }
  if (!/^\d+$/.test(String(data.stage ?? ''))) {
    errors.push(`${label}: stage가 "${data.stage}" — 숫자여야 한다`);
  }
  if (!STATUSES.includes(data.status)) {
    errors.push(`${label}: status가 "${data.status}" — 허용값은 ${STATUSES.join(' / ')}`);
  }
  if (!Array.isArray(data.inputs)) {
    errors.push(`${label}: inputs가 리스트가 아니다 (없으면 [] 로 적는다)`);
  }
  if (!Array.isArray(data.open_questions)) {
    errors.push(`${label}: open_questions가 리스트가 아니다 (없으면 [] 로 적는다)`);
  }

  return errors;
}

export function validateArtifactDirs(root) {
  const errors = [];

  for (const relative of STAGE_DIRS) {
    const dir = join(root, relative);
    if (!existsSync(dir)) continue;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md') || file === 'README.md') continue;
      const path = join(dir, file);
      errors.push(...validateArtifact(readFileSync(path, 'utf8'), `${relative}/${file}`));
    }
  }

  return errors;
}
