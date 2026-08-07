import { existsSync, readFileSync } from 'node:fs';
import { UNITS } from './units.mjs';

const GATES = ['게이트 1', '게이트 2', '게이트 3', '게이트 4', '게이트 5', '게이트 6', '게이트 7'];

export function validateCharter(path) {
  if (!existsSync(path)) return [`헌장 파일 없음 (${path})`];

  const text = readFileSync(path, 'utf8');
  const errors = [];

  for (const unit of UNITS) {
    if (!text.includes(unit.name)) errors.push(`헌장에 유닛 "${unit.name}" 미기재`);
  }
  for (const gate of GATES) {
    if (!text.includes(gate)) errors.push(`헌장에 "${gate}" 미기재`);
  }

  return errors;
}
