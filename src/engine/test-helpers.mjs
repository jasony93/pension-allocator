// 테스트 전용 헬퍼. 엔진 본체는 파일을 읽지 않는다 — 룰셋은 항상 인자로 주입된다.
// 이 파일이 `.test.mjs`가 아닌 이유는 러너가 테스트 파일로 잡지 않게 하기 위해서다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RULES_DIR = join(process.cwd(), 'data', 'tax-rules');

export const CONFIRMED_FILE = '2026.json';
export const PROPOSED_FILE = '2027-proposed.json';

/** 실제 룰셋을 읽어 RulesetBundle 형태(파일명 → 파싱된 객체)로 만든다. */
export function loadRulesets() {
  return {
    [CONFIRMED_FILE]: JSON.parse(readFileSync(join(RULES_DIR, CONFIRMED_FILE), 'utf8')),
    [PROPOSED_FILE]: JSON.parse(readFileSync(join(RULES_DIR, PROPOSED_FILE), 'utf8')),
  };
}

/** 룰셋을 건드리지 않고 사본만 바꾸기 위한 깊은 복사. */
export function cloneRulesets(bundle) {
  return structuredClone(bundle);
}

/** 사본 안에서 규칙 하나를 찾는다. 원본 파일은 절대 수정하지 않는다. */
export function findRule(bundle, file, ruleId) {
  const rule = bundle[file].rules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`테스트 픽스처에 규칙이 없다: ${ruleId}`);
  return rule;
}

/**
 * 유효한 기본 요청. 각 테스트는 필요한 부분만 덮어쓴다.
 * 금액은 세법 수치가 아니라 테스트 입력값이다.
 */
export function baseRequest(overrides = {}) {
  const request = {
    schema_version: '2.1.0',
    tax_year: 2026,
    scenarios: ['current'],
    profile: {
      age_years: 40,
      current_year_total_salary_krw: 50_000_000,
      // 서민형 구간 상한 위로 둔다. 기본 요청에서 ISA 유형 교차확인 경고가
      // 늘 켜져 있으면 그 경고를 검증하는 테스트가 의미를 잃는다.
      prior_year_total_salary_krw: 52_000_000,
      financial_income_taxpayer_last_3_years: false,
      declared_youth: null,
      fund_use_horizon: 'at_or_after_pension_age',
      monthly_capacity_krw: 500_000,
      months_remaining_in_tax_year: 12,
    },
    accounts: {
      annuity_savings: { ytd_contribution_krw: 0 },
      retirement_pension: { ytd_contribution_krw: 0 },
      isa: {
        exists: true,
        account_type: 'general',
        cumulative_contribution_krw: 0,
        ytd_contribution_krw: 0,
        years_since_opening: 1,
        other_savings_contract_krw: 0,
      },
    },
    isa_transfer: null,
    options: null,
  };

  return deepMerge(request, overrides);
}

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object' && out[key] !== null && !Array.isArray(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** 응답에서 시나리오 하나를 꺼낸다. 실패 응답이면 오류 코드를 그대로 노출해 디버깅을 돕는다. */
export function scenarioOf(response, scenarioId = 'current') {
  if (!response.ok) {
    throw new Error(`계산 실패: ${JSON.stringify(response.errors)}`);
  }
  const found = response.scenarios.find((s) => s.scenario_id === scenarioId);
  if (!found) throw new Error(`시나리오 없음: ${scenarioId}`);
  return found;
}

export function planOf(scenario, planId) {
  const plan = scenario.plans.find((p) => p.plan_id === planId);
  if (!plan) throw new Error(`배분안 없음: ${planId}`);
  return plan;
}

export function allocationOf(plan, account) {
  const found = plan.allocations.find((a) => a.account === account);
  if (!found) throw new Error(`배분 항목 없음: ${account}`);
  return found;
}

export function errorCodes(response) {
  return response.errors.map((e) => e.code);
}

export function noticeCodes(scenario) {
  return scenario.notices.map((n) => n.code);
}
