import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAgentFile } from './parse-agent.mjs';
import { REQUIRED_SECTIONS, UNITS } from './units.mjs';

function normalizeTools(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(', ');
}

export function validateAgents(dir) {
  const errors = [];

  for (const unit of UNITS) {
    const path = join(dir, `${unit.name}.md`);

    if (!existsSync(path)) {
      errors.push(`${unit.name}: 정의 파일 없음 (${path})`);
      continue;
    }

    let parsed;
    try {
      parsed = parseAgentFile(readFileSync(path, 'utf8'));
    } catch (error) {
      errors.push(`${unit.name}: 파싱 실패 — ${error.message}`);
      continue;
    }

    const { frontmatter: fm, sections } = parsed;

    if (fm.name !== unit.name) {
      errors.push(`${unit.name}: frontmatter name이 "${fm.name}" — 파일명과 불일치`);
    }
    if (!fm.description) {
      errors.push(`${unit.name}: description 없음 — 관리자가 호출 시점을 판단할 수 없음`);
    }
    if (fm.model !== unit.model) {
      errors.push(`${unit.name}: model이 "${fm.model}" — 명세표는 "${unit.model}"`);
    }
    if (normalizeTools(fm.tools) !== normalizeTools(unit.tools.join(','))) {
      errors.push(
        `${unit.name}: tools 불일치 — 명세표 [${unit.tools.join(', ')}], 실제 [${fm.tools ?? ''}]`,
      );
    }

    for (const name of REQUIRED_SECTIONS) {
      if (!(name in sections)) errors.push(`${unit.name}: "## ${name}" 섹션 없음`);
      else if (!sections[name].trim()) errors.push(`${unit.name}: "## ${name}" 섹션이 비어 있음`);
    }

    const outputs = sections['산출물'] ?? '';
    for (const scope of unit.writeScope) {
      if (!outputs.includes(scope)) {
        errors.push(`${unit.name}: 산출물 섹션에 쓰기 경로 "${scope}" 미기재`);
      }
    }
  }

  return errors;
}
