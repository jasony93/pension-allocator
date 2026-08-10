// 룰셋 접근. 엔진이 세법 값을 읽는 **유일한** 통로다.
// 없는 규칙·없는 값을 기본값으로 메우지 않는다 — 메우는 순간 룰셋이 단일 진실
// 원천이라는 전제가 깨지고 4단계 교차검증이 무력해진다.

import { ERROR, RULESET_STATUS, SCENARIO, UNCERTAINTY_KIND } from './constants.mjs';

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
 * 규칙 value 안의 불확실성 표시를 **전부 모아 위치와 함께** 낸다.
 *
 * **왜 유무(boolean)가 아니라 목록인가.** 룰셋의 `unverified`는 문서가 아니라 사용자
 * 고지의 트리거다. 그런데 유무만 보는 구조에서는 **불확실을 일부 해소하며 표시 하나를
 * 지우면 남은 불확실까지 한꺼번에 사라진다.** 실제로 그럴 뻔했고 테스트가 잡았다
 * (D27의 "구조적 발견"). 목록이면 3건 → 2건으로 줄어드는 것이 값에 나타나므로
 * **"일부 해소"가 표현 가능해진다.**
 *
 * **이 함수가 막지 못하는 것을 분명히 해 둔다.** 룰셋 작성자가 지워서는 안 될 표시를
 * 지운 경우는 여전히 잡지 못한다 — 엔진은 룰셋을 그대로 비출 뿐이다. 그 자리를 무는 것은
 * `tax-domain`의 골든 블록과 룰셋 검증기이고, 엔진이 하는 일은 **세고 가리킬 수 있게
 * 만드는 것**까지다(계약 5.7절).
 *
 * **표시 자리가 배열이면 원소마다 자리를 준다 (D32).** 계약 5.7.1절이 남는 구멍을 닫는
 * 방법으로 배열을 제시하면서 **"각 항목이 자기 자리를 갖는다"**고 못 박았다. 배열을 펼치지
 * 않으면 산문 한 덩어리와 3원소 배열이 똑같이 1건으로 세어져 **계약이 스스로 내놓은 해법이
 * 아무것도 바꾸지 않는다.** 규정을 그 목적이 사라지는 쪽으로 읽지 않는다.
 */
export function uncertaintyNotesIn(value) {
  const found = [];

  const walk = (node, key, path) => {
    if (key === 'unverified') {
      // 배열이면 원소 하나가 확인하지 못한 항목 하나다. 첨자가 그 자리의 이름이 된다 —
      // 하나가 해소되어 원소가 빠지면 3에서 2로 줄어든 사실이 값에 나타난다.
      // 문자열 하나면 자리도 하나다. **그것이 계약이 막으려던 상태**이므로 늘리지 않는다.
      if (Array.isArray(node)) {
        node.forEach((_, index) =>
          found.push({ path: `${path}[${index}]`, kind: UNCERTAINTY_KIND.UNVERIFIED }),
        );
        return;
      }
      found.push({ path, kind: UNCERTAINTY_KIND.UNVERIFIED });
      return;
    }
    // 시행령 위임 등으로 값 자체가 비어 있는 자리. `age_range: null`이 그 첫 사례였다.
    if (key === 'age_range' && node === null) {
      found.push({ path, kind: UNCERTAINTY_KIND.VALUE_ABSENT });
      return;
    }
    if (key === 'confidence' && node !== 'verified') {
      found.push({ path, kind: UNCERTAINTY_KIND.CONFIDENCE_NOT_VERIFIED });
      return;
    }
    if (typeof node === 'string' && node.includes('미확인')) {
      found.push({ path, kind: UNCERTAINTY_KIND.TEXT_MARKER });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, key, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node)) {
        walk(child, childKey, path === '' ? childKey : `${path}.${childKey}`);
      }
    }
  };

  walk(value, null, '');
  // 같은 규칙 안에서 순서가 흔들리면 결정성이 깨진다. 경로 사전순으로 고정한다.
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** 근거 목록. 확정 → 개정예고, 그 안에서 rule_id 사전순 (engine-interface.md 6.1절). */
export function buildLegalBasis(access) {
  return access
    .usedEntries()
    .map(([ruleId, { rule, applied }]) => {
      const uncertaintyNotes = uncertaintyNotesIn(rule.value);
      return {
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
        // 유지되는 boolean. 언제나 `uncertainty_notes.length > 0`과 같다.
        has_uncertainty_note: uncertaintyNotes.length > 0,
        // 몇 건이 어디에 남아 있는가. 일부 해소가 값으로 드러나는 자리다.
        uncertainty_notes: uncertaintyNotes,
      };
    })
    .sort((a, b) => {
      const rank = (entry) => (entry.status === RULESET_STATUS.CONFIRMED ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return a.rule_id.localeCompare(b.rule_id);
    });
}
