import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { UNITS } from './units.mjs';

const STAGE_DIR = /^stage-(\d+)/;

const STATUSES = ['draft', 'approved'];
const UNIT_NAMES = UNITS.map((u) => u.name);
const UNIT_BY_NAME = new Map(UNITS.map((u) => [u.name, u]));

/**
 * 검사 대상 단계 디렉터리를 디스크에서 읽는다.
 * 목록을 코드에 박아 두면 나중에 생기는 `docs/stage-3-implementation/`이
 * 아무 경고 없이 검사에서 빠진다.
 */
function stageDirs(root) {
  const docs = join(root, 'docs');
  if (!existsSync(docs)) return [];

  return readdirSync(docs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && STAGE_DIR.test(entry.name))
    .map((entry) => ({ relative: `docs/${entry.name}`, stage: STAGE_DIR.exec(entry.name)[1] }))
    .sort((a, b) => a.relative.localeCompare(b.relative));
}

/** `writeScope` 항목이 `/`로 끝나면 디렉터리 접두사, 아니면 정확히 그 경로 하나다. */
function coversPath(scope, path) {
  return scope.endsWith('/') ? path.startsWith(scope) : path === scope;
}

export function validateArtifact(text, label) {
  let data;
  try {
    ({ data } = parseFrontmatter(text));
  } catch (error) {
    return [`${label}: 머리말 없음 — 조직 표준 머리말이 있어야 한다 (${error.message})`];
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

  for (const { relative, stage } of stageDirs(root)) {
    const dir = join(root, relative);

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md') || file === 'README.md') continue;

      const label = `${relative}/${file}`;
      const text = readFileSync(join(dir, file), 'utf8');
      errors.push(...validateArtifact(text, label));

      let data;
      try {
        ({ data } = parseFrontmatter(text));
      } catch {
        continue; // 머리말을 못 읽으면 위에서 이미 보고했다.
      }

      // 머리말이 자기 위치와 어긋나면 둘 중 하나는 틀린 것이다.
      // 이 대조가 없으면 `stage: 99`짜리 문서가 1단계 디렉터리에 앉아 있어도 통과한다.
      if (String(data.stage ?? '') !== stage) {
        errors.push(`${label}: stage가 "${data.stage}" — 이 디렉터리는 ${stage}단계다`);
      }

      // 헌장 규칙 1 "쓰기 범위 제한"의 기계적 강제.
      const unit = UNIT_BY_NAME.get(data.unit);
      if (unit && !unit.writeScope.some((scope) => coversPath(scope, label))) {
        errors.push(
          `${label}: unit "${data.unit}"의 쓰기 범위 밖 — 허용 경로는 ${unit.writeScope.join(', ')}`,
        );
      }
    }
  }

  return errors;
}
