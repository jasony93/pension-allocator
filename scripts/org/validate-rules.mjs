import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RULE_STATUSES = ['확정', '개정예고'];
const BILL_STAGES = ['정부안', '국회 계류', '공포'];
const SOURCE_FIELDS = ['law', 'url', 'verified_on', 'verified_by'];

export function validateRuleset(doc, label) {
  const errors = [];

  for (const key of ['tax_year', 'status', 'effective_from', 'rules']) {
    if (doc?.[key] === undefined) errors.push(`${label}: 최상위 "${key}" 없음`);
  }
  if (!Array.isArray(doc?.rules)) {
    errors.push(`${label}: rules가 배열이 아님`);
    return errors;
  }

  const seen = new Set();

  for (const [index, rule] of doc.rules.entries()) {
    const at = `${label}[${index}] ${rule?.id ?? '(id 없음)'}`;

    for (const key of ['id', 'title', 'conditions', 'value', 'status', 'effective_from']) {
      if (rule?.[key] === undefined) errors.push(`${at}: "${key}" 없음`);
    }

    if (rule?.id !== undefined) {
      if (seen.has(rule.id)) errors.push(`${at}: id 중복`);
      seen.add(rule.id);
    }

    if (rule?.status !== undefined && !RULE_STATUSES.includes(rule.status)) {
      errors.push(`${at}: status가 "${rule.status}" — 허용값은 ${RULE_STATUSES.join(' / ')}`);
    }

    // 출처 검사는 어떤 경우에도 건너뛰지 않는다. 한 규칙에 위반이 여러 개면
    // 한 번의 실행으로 전부 보고해야 세무 유닛이 왕복을 줄인다.
    if (!rule?.source) {
      errors.push(`${at}: source 없음 — 법령 조항 없는 숫자는 근거 없는 숫자다`);
    } else {
      for (const field of SOURCE_FIELDS) {
        if (!rule.source[field]) errors.push(`${at}: source.${field} 없음`);
      }
    }

    // 확정 파일과 개정예고 파일을 섞지 않는다 (스펙 6.2절).
    // 이 규칙은 애초에 이 파일에 있으면 안 되므로 bill_stage까지 따지지 않는다.
    if (doc.status === '확정' && rule?.status === '개정예고') {
      errors.push(`${at}: 확정 룰셋에 개정예고 규칙이 섞여 있음`);
      continue;
    }

    if (rule?.status === '개정예고' && !BILL_STAGES.includes(rule?.bill_stage)) {
      errors.push(`${at}: bill_stage가 "${rule?.bill_stage}" — 허용값은 ${BILL_STAGES.join(' / ')}`);
    }
  }

  return errors;
}

export function validateRulesDir(dir) {
  if (!existsSync(dir)) return [];

  const errors = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const path = join(dir, file);
    let doc;
    try {
      doc = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      errors.push(`${file}: JSON 파싱 실패 — ${error.message}`);
      continue;
    }
    errors.push(...validateRuleset(doc, file));
  }
  return errors;
}
