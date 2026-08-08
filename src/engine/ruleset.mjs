// 룰셋 접근. 엔진이 세법 값을 읽는 **유일한** 통로다.
// 없는 규칙·없는 값을 기본값으로 메우지 않는다 — 메우는 순간 룰셋이 단일 진실
// 원천이라는 전제가 깨지고 4단계 교차검증이 무력해진다.

import { ERROR, RULESET_STATUS, SCENARIO } from './constants.mjs';

/** 요청한 과세연도·시나리오에 맞는 룰셋 파일을 고른다. */
export function selectRulesets(bundle, taxYear, scenarioId) {
  if (bundle === null || typeof bundle !== 'object') {
    return { errors: [loadFailed('룰셋 번들이 객체가 아니다')] };
  }

  const entries = Object.entries(bundle);
  const parsed = [];
  for (const [file, doc] of entries) {
    if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.rules)) {
      return { errors: [loadFailed(`룰셋 형식이 아니다: ${file}`, { file })] };
    }
    parsed.push({ file, doc });
  }

  const base = parsed.find((e) => e.doc.status === RULESET_STATUS.CONFIRMED && e.doc.tax_year === taxYear);
  if (!base) {
    return { errors: [loadFailed('해당 과세연도의 확정 룰셋이 없다', { tax_year: taxYear })] };
  }

  if (scenarioId === SCENARIO.CURRENT) {
    return { base, proposed: null, files: [base.file] };
  }

  const proposed = parsed
    .filter((e) => e.doc.status === RULESET_STATUS.PROPOSED)
    .sort((a, b) => a.doc.tax_year - b.doc.tax_year)[0];

  if (!proposed) {
    return { errors: [loadFailed('개정예고 룰셋이 없다', { scenario: scenarioId })] };
  }

  return { base, proposed, files: [base.file, proposed.file] };
}

function loadFailed(message, params = {}) {
  return { code: ERROR.RULESET_LOAD_FAILED, field: null, params: { ...params, message } };
}

/**
 * 규칙 조회와 근거 수집을 함께 한다.
 * 읽은 규칙만 legal_basis에 실린다 — 읽지 않은 규칙을 근거로 싣지 않는다.
 */
export function createAccess({ base, proposed }) {
  const index = new Map();
  for (const { file, doc } of [base, ...(proposed ? [proposed] : [])]) {
    for (const rule of doc.rules) index.set(rule.id, { rule, file, doc });
  }

  const used = new Map();
  const missing = [];

  function record(ruleId, appliedTo) {
    const entry = index.get(ruleId);
    if (!entry) return null;
    if (!used.has(ruleId)) used.set(ruleId, { ...entry, applied: new Set() });
    if (appliedTo) used.get(ruleId).applied.add(appliedTo);
    return entry;
  }

  return {
    has: (ruleId) => index.has(ruleId),
    raw: (ruleId) => index.get(ruleId)?.rule ?? null,
    all: () => [...index.values()],

    /** 규칙 하나를 근거로 등록하고 반환한다. */
    use(ruleId, appliedTo) {
      const entry = record(ruleId, appliedTo);
      if (!entry) {
        missing.push({ code: ERROR.RULE_MISSING, field: null, params: { rule_id: ruleId } });
        return null;
      }
      return entry.rule;
    },

    /**
     * 규칙 안의 값을 경로로 읽는다. 규칙이 없거나 값이 없으면 계산을 멈춘다.
     * "규칙은 있는데 필요한 값이 없다"도 대체값을 만들 이유가 되지 않는다.
     */
    value(ruleId, path, appliedTo) {
      const rule = this.use(ruleId, appliedTo);
      if (rule === null) return undefined;

      let node = rule;
      for (const key of path) {
        if (node === null || node === undefined) break;
        node = node[key];
      }
      if (node === undefined || node === null) {
        missing.push({
          code: ERROR.RULE_MISSING,
          field: null,
          params: { rule_id: ruleId, path: path.join('.') },
        });
        return undefined;
      }
      return node;
    },

    markUsed: (ruleId, appliedTo) => record(ruleId, appliedTo),
    missing: () => missing,
    usedEntries: () => [...used.entries()],
  };
}

/**
 * 규칙 value 안에 불확실성 표시가 있는지 본다.
 * 화면이 "이 값은 아직 확정되지 않았다"를 붙일 단서를 만들기 위한 것이고,
 * 판단은 룰셋이 스스로 적어 둔 표시에만 근거한다.
 */
export function hasUncertaintyNote(value) {
  let found = false;

  const walk = (node, key) => {
    if (found) return;
    if (key === 'unverified') { found = true; return; }
    if (key === 'age_range' && node === null) { found = true; return; }
    if (key === 'confidence' && node !== 'verified') { found = true; return; }
    if (typeof node === 'string' && node.includes('미확인')) { found = true; return; }
    if (Array.isArray(node)) { node.forEach((item) => walk(item, key)); return; }
    if (node && typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node)) walk(child, childKey);
    }
  };

  walk(value, null);
  return found;
}

/** 근거 목록. 확정 → 개정예고, 그 안에서 rule_id 사전순 (engine-interface.md 6.1절). */
export function buildLegalBasis(access) {
  return access
    .usedEntries()
    .map(([ruleId, { rule, applied }]) => ({
      rule_id: ruleId,
      title: rule.title,
      // 룰셋 문자열을 한 글자도 바꾸지 않는다. 화면이 그대로 보여준다.
      law: rule.source.law,
      law_version: rule.source.law_version ?? null,
      url: rule.source.url,
      corroborating_url: rule.source.corroborating_url ?? null,
      status: rule.status,
      bill_stage: rule.bill_stage ?? null,
      effective_from: rule.effective_from,
      verified_on: rule.source.verified_on,
      applied_to: [...applied].sort(),
      has_uncertainty_note: hasUncertaintyNote(rule.value),
    }))
    .sort((a, b) => {
      const rank = (entry) => (entry.status === RULESET_STATUS.CONFIRMED ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return a.rule_id.localeCompare(b.rule_id);
    });
}
