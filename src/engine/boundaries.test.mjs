// 필수 테스트 1 — 두 진입점의 경계값 동일성.
// engine-interface.md 9절이 "바이트 단위로 같아야 한다"를 3단계 구현 조건으로 박았다.

import test from 'node:test';
import assert from 'node:assert/strict';

import { compute, computeFundUseHorizonBoundaries } from './index.mjs';
import { boundariesSource } from './boundaries.mjs';
import { loadRulesets, baseRequest, scenarioOf } from './test-helpers.mjs';

const rulesets = loadRulesets();

function boundariesRequestFrom(request, scenario = 'current') {
  return {
    schema_version: request.schema_version,
    tax_year: request.tax_year,
    age_years: request.profile.age_years,
    isa_exists: request.accounts.isa.exists,
    isa_years_since_opening: request.accounts.isa.years_since_opening,
    scenario,
  };
}

const CASES = [
  { label: '기본', patch: {} },
  { label: 'ISA 미보유', patch: { accounts: { isa: { exists: false, years_since_opening: null } } } },
  { label: '가입경과연수 미입력', patch: { accounts: { isa: { years_since_opening: null } } } },
  { label: '연금 개시 연령 이후', patch: { profile: { age_years: 70 } } },
  { label: '아주 젊은 사용자', patch: { profile: { age_years: 19 } } },
  { label: '가입경과연수가 의무기간보다 큼', patch: { accounts: { isa: { years_since_opening: 9 } } } },
];

for (const { label, patch } of CASES) {
  test(`경계값 동일성 — ${label}`, () => {
    const request = baseRequest(patch);

    const full = compute(request, rulesets);
    const light = computeFundUseHorizonBoundaries(boundariesRequestFrom(request), rulesets);

    assert.equal(light.ok, true);
    const fromFull = scenarioOf(full).fund_use_horizon_boundaries;

    assert.deepStrictEqual(light.boundaries, fromFull);
    // 깊은 비교만으로는 키 순서 차이를 잡지 못한다. 직렬화 결과까지 같아야
    // 화면이 두 경로를 섞어 써도 캡션이 흔들리지 않는다.
    assert.equal(JSON.stringify(light.boundaries), JSON.stringify(fromFull));
  });
}

test('두 진입점이 같은 내부 함수를 쓴다', () => {
  // 결과가 우연히 같은 것과 같은 코드를 쓰는 것은 다르다.
  // 공유 함수가 실제로 호출되는지를 모듈 경계에서 확인한다.
  assert.equal(typeof boundariesSource, 'function');

  const request = baseRequest();
  const direct = boundariesSource(
    { ageYears: 40, isaExists: true, isaYearsSinceOpening: 1 },
    rulesets,
    'current',
    request.tax_year,
  );

  assert.equal(direct.ok, true);
  assert.deepStrictEqual(direct.boundaries, scenarioOf(compute(request, rulesets)).fund_use_horizon_boundaries);
});

test('경계값은 룰셋에서 온다 — 값을 바꾸면 결과가 따라 바뀐다', () => {
  const boundaries = computeFundUseHorizonBoundaries(
    boundariesRequestFrom(baseRequest()),
    rulesets,
  ).boundaries;

  const isaRule = rulesets['2026.json'].rules.find((r) => r.id === 'isa.account.requirements');
  const pensionRule = rulesets['2026.json'].rules.find((r) => r.id === 'pension.withdrawal.eligibility');
  const minAge = pensionRule.value.requirements.find((r) => r.id === 'age').min_age;

  assert.equal(boundaries.isa_lock_in_years, isaRule.value.min_contract_years);
  assert.equal(boundaries.pension_min_age_years, minAge);
  assert.equal(boundaries.pension_years_remaining, minAge - 40);
  assert.equal(boundaries.pension_holding_period_evaluated, false);
});

test('경계값 조회는 소득·납입액·예산을 받지 않아도 동작한다', () => {
  const response = computeFundUseHorizonBoundaries(
    { schema_version: '2.1.0', tax_year: 2026, age_years: 30, isa_exists: false },
    rulesets,
  );

  assert.equal(response.ok, true);
  assert.ok(response.legal_basis.length > 0, '캡션이 세법 수치를 보이므로 근거 조항이 함께 나가야 한다');
  // 이 진입점은 fund_use_horizon을 묻지 않으므로 그 코드가 실려서는 안 된다.
  assert.equal(response.notices.some((n) => n.code === 'fund_use_horizon_not_declared'), false);
});

test('경계값 조회도 잘못된 입력을 반환값으로 표현한다', () => {
  const response = computeFundUseHorizonBoundaries(
    { schema_version: '2.1.0', tax_year: 2026, age_years: 30.5, isa_exists: false },
    rulesets,
  );

  assert.equal(response.ok, false);
  assert.deepStrictEqual(response.errors.map((e) => e.code), ['not_integer']);
});
