import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  EXAMPLE_AGE_YEARS,
  EXAMPLE_SALARY_MANWON,
  EXAMPLE_MONTHLY_CAPACITY_MANWON,
  EXAMPLE_QUESTION_TEXT,
  EXAMPLE_PERSONA_2_NAME,
  EXAMPLE_PERSONA_2_AGE_YEARS,
  EXAMPLE_PERSONA_2_GLOBAL_INCOME_MANWON,
  EXAMPLE_PERSONA_2_MONTHLY_CAPACITY_MANWON,
  exampleOccupationLineText,
  exampleAgeLineText,
  exampleSalaryLineText,
  exampleCapacityLineText,
  exampleInputLineTexts,
  exampleBirthDate,
  examplePersona2BirthDate,
  buildExampleForm,
  buildExamplePersona2Form,
  computeExampleScenario,
  computeExamplePersona2Scenario,
  examplePersona2OccupationLineText,
  examplePersona2AgeLineText,
  examplePersona2IncomeLineText,
  examplePersona2CapacityLineText,
  examplePersona2InputLineTexts,
} from './example-showcase.js';
import { applyDonutSliceInlineLabels } from './charts.js';
import { buildEngineRequest, TAX_YEAR } from '../state/store.js';
import { compute as engineCompute } from '../../engine/index.mjs';
import { ageOn, endOfTaxYear, parseIsoDate } from '../../engine/dates.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..', '..');
function loadRulesets() {
  const dir = path.join(rootDir, 'data', 'tax-rules');
  return {
    '2026.json': JSON.parse(readFileSync(path.join(dir, '2026.json'), 'utf8')),
    '2027-proposed.json': JSON.parse(readFileSync(path.join(dir, '2027-proposed.json'), 'utf8')),
  };
}
const rulesets = loadRulesets();

/**
 * 관리자 지시(2026-08-14) 4번이 준 값 그대로인지 못박는다. 여기가 바뀌면
 * 화면 예시도 그 즉시 다른 값을 낸다(하드코딩된 문자열이 아니라 이 상수들을
 * 화면이 그대로 읽는다 — `example-showcase.js`의 `exampleInputLineTexts`).
 *
 * **[2026-08-17, D71] 연 평균 수익률 상수는 더는 없다** — 예시가 수익률
 * 가정 없이 계산되므로(D71) 그 값을 보여줄 입력 줄도, 그 값을 담는 상수도
 * 화면에서 사라졌다. 이 검사가 그 상수를 더 이상 찾지 않는 것 자체가 그
 * 삭제를 고정한다.
 */
test('고정 입력 셋이 관리자가 지정한 값과 정확히 같다', () => {
  assert.equal(EXAMPLE_AGE_YEARS, 30);
  assert.equal(EXAMPLE_SALARY_MANWON, 4000);
  assert.equal(EXAMPLE_MONTHLY_CAPACITY_MANWON, 150);
});

/**
 * [2026-08-17, 소유자 지시 1번 + 관리자 지시(2차) 5번] 입력 세 줄 — 「예시)」
 * 접두사 없이, 한 줄에 하나씩. 콜론 앞 공백의 비대칭("나이:"는 없음, "월
 * 납입금 :"는 있음)까지 그대로 맞춰야 한다 — 소유자가 실제로 그렇게 썼다.
 * 「여유 자금」은 관리자 지시(2차) 5번으로 「월 납입금」이 됐다(값은 그대로).
 */
/**
 * [2026-08-20, 관리자 지시] **네 줄로 뒤집힌 기대값.** 옛 검사는 세 줄
 * (나이·소득·월납입금)을 기대했다 — 「직업 : 직장인」이 맨 위에 더해지며
 * 네 줄이 됐다(관리자 지시 원문 "기본 정보 맨 위에 직업 줄 추가"). 지우지
 * 않고 뒤집는다.
 */
test('입력 네 줄 — 소유자가 지정한 글자 그대로, 「예시)」 접두사가 없다', () => {
  assert.equal(exampleOccupationLineText(), '직업 : 직장인');
  assert.equal(exampleAgeLineText(), '나이: 만 30세');
  assert.equal(exampleSalaryLineText(), '소득: 4,000만원');
  assert.equal(exampleCapacityLineText(), '월 납입금 : 월 150만원');
  assert.deepEqual(exampleInputLineTexts(), [
    '직업 : 직장인',
    '나이: 만 30세',
    '소득: 4,000만원',
    '월 납입금 : 월 150만원',
  ]);
  for (const line of exampleInputLineTexts()) {
    assert.ok(!line.startsWith('예시)'), `입력 줄에 "예시)" 접두사가 남아 있다: "${line}"`);
    assert.ok(!line.includes('수익률'), `입력 줄에 수익률 언급이 남아 있다: "${line}"`);
  }
});

/**
 * [2026-08-20, 관리자 지시] **뒤집힌 기대값.** "월급" → "돈"으로 다시 썼다 —
 * 예시가 근로소득(김철수씨) 하나에서 근로·사업소득(이승은씨) 둘로 늘며
 * "월급"이 2행에는 거짓이 된다.
 */
test('EXAMPLE_QUESTION_TEXT — 소유자가 다시 쓴 물음 문장과 글자 그대로 같다', () => {
  assert.equal(EXAMPLE_QUESTION_TEXT, '당신의 소중한 돈, 어디에 넣어야 세금이 가장 적을까요?');
});

/**
 * [2026-08-20, 관리자 지시] 2행 — 이승은씨. 값 네 상수와 네 줄 문구가
 * 관리자 지시 원문과 글자 그대로 같은지 고정한다.
 */
test('2행(이승은씨) 고정 입력 넷과 문구 네 줄이 관리자 지시 원문과 같다', () => {
  assert.equal(EXAMPLE_PERSONA_2_NAME, '이승은씨');
  assert.equal(EXAMPLE_PERSONA_2_AGE_YEARS, 45);
  assert.equal(EXAMPLE_PERSONA_2_GLOBAL_INCOME_MANWON, 8000);
  assert.equal(EXAMPLE_PERSONA_2_MONTHLY_CAPACITY_MANWON, 200);
  assert.equal(examplePersona2OccupationLineText(), '직업 : 자영업자');
  assert.equal(examplePersona2AgeLineText(), '나이 : 만 45세');
  assert.equal(examplePersona2IncomeLineText(), '소득 : 8,000만원 (사업소득)');
  assert.equal(examplePersona2CapacityLineText(), '월 납입액 : 200만원');
  assert.deepEqual(examplePersona2InputLineTexts(), [
    '직업 : 자영업자',
    '나이 : 만 45세',
    '소득 : 8,000만원 (사업소득)',
    '월 납입액 : 200만원',
  ]);
});

/**
 * **생년월일이 날짜 리터럴이 아니라는 것을 여러 과세연도로 확인한다.** 고정
 * 문자열을 박았다면 과세연도가 바뀔 때 나이가 그대로일 이유가 없다 — 엔진 자신의
 * 날짜 산술(`dates.mjs`의 `ageOn`·`endOfTaxYear`, 화면이 다시 구현하지 않은 바로
 * 그 함수)로 각 과세연도마다 다시 재고, 매번 정확히 30이 되는지를 잰다.
 */
test('exampleBirthDate — 어느 과세연도에 물어도 과세기간 종료일 기준 정확히 만 30세다', () => {
  for (const taxYear of [2020, 2024, 2026, 2027, 2030, 2035]) {
    const birth = exampleBirthDate(taxYear);
    assert.match(birth, /^\d{4}-01-01$/, `${taxYear} → ${birth}가 YYYY-01-01 형태가 아니다`);
    const age = ageOn(parseIsoDate(birth), endOfTaxYear(taxYear));
    assert.equal(age, 30, `taxYear=${taxYear}, birth=${birth} → age=${age} (30이어야 한다)`);
  }
  // 서로 다른 과세연도는 서로 다른 생년월일을 낸다 — 진짜로 역산하고 있다는 증거
  // (고정 리터럴이면 모든 taxYear에서 같은 문자열이 나왔을 것이다).
  assert.notEqual(exampleBirthDate(2026), exampleBirthDate(2031));
});

test('buildExampleForm이 지금 store.js가 읽는 TAX_YEAR로 생년월일을 만든다', () => {
  assert.equal(buildExampleForm().birthDate, exampleBirthDate(TAX_YEAR));
});

/**
 * [2026-08-17, D71] **ISA 수익률 옵트인을 켜지 않는다.** `initialForm()`
 * 기본값(전부 꺼짐)을 그대로 두는지를 직접 확인한다 — 옛(D70 이전) 구현은
 * 이 셋을 명시로 덮어 수익률 가정을 강제로 넣었다.
 */
test('buildExampleForm — ISA 수익률 옵트인을 켜지 않는다(D71)', () => {
  const form = buildExampleForm();
  assert.equal(form.isaReturnEnabled, false);
  assert.equal(form.isaReturnRatePercent, '');
  assert.equal(form.isaIncomeCharacter, null);
});

/**
 * **판별력이 있는 계약 검사.** `computeExampleScenario`가 내부에서 값을 만들어
 * 내는 것이 아니라, 주어진 `engineClient`가 돌려주는 것을 **그대로** 옮긴다는
 * 것을 가짜 엔진으로 확인한다 — 나중에 누가 이 함수를 "실제로는 값을 하드코딩하고
 * engineClient는 부르는 시늉만 한다"로 바꾸면 이 검사가 즉시 빨갛게 된다(가짜
 * 엔진이 돌려준 표식 값이 그대로 나오지 않으므로).
 *
 * 동시에 **요청 자체**가 만 30세·4,000만원·월 150만원을 정확한 단위(원 단위
 * 변환)로 실었는지, 그리고 [2026-08-17, D71] **`isa_return_assumption`이
 * `null`인지**(수익률 가정을 계산에 태우지 않는다는 것)도 함께 잰다.
 */
test('computeExampleScenario는 주어진 engineClient의 응답을 그대로 옮기고, 고정 입력 셋을 정확한 단위로 요청에 싣는다(수익률 가정은 싣지 않는다)', async () => {
  let capturedRequest = null;
  const sentinelPlan = {
    plan_id: 'max_tax_credit',
    is_baseline: true,
    allocations: [],
    unallocated_annual_krw: 0,
    unallocated_monthly_krw: 0,
    total_allocated_monthly_krw: 999999,
    deterministic_benefit: { pension_credit_total_krw: 123456789 },
  };
  const fakeScenario = { scenario_id: 'current', is_enacted: true, plans: [sentinelPlan], account_eligibility: [] };
  const fakeEngineClient = {
    compute: async (request) => {
      capturedRequest = request;
      return { ok: true, schema_version: request.schema_version, echo: {}, scenarios: [fakeScenario], assumptions: [] };
    },
  };

  const { scenario, plan } = await computeExampleScenario(fakeEngineClient);

  // 가짜 엔진이 돌려준 표식 값이 그대로 나온다 — 내부에서 다시 계산하거나
  // 하드코딩된 값으로 갈아치우지 않는다는 뜻이다.
  assert.equal(scenario, fakeScenario);
  assert.equal(plan.total_allocated_monthly_krw, 999999);
  assert.equal(plan.deterministic_benefit.pension_credit_total_krw, 123456789);

  // 요청 — 고정 입력 셋이 정확한 단위로 실렸는가.
  assert.ok(capturedRequest, 'engineClient.compute가 호출되지 않았다');
  assert.equal(capturedRequest.profile.birth_date, exampleBirthDate(TAX_YEAR));
  assert.equal(capturedRequest.profile.current_year_total_salary_krw, 40_000_000); // 4,000만원
  assert.equal(capturedRequest.profile.monthly_capacity_krw, 1_500_000); // 월 150만원
  assert.equal(capturedRequest.profile.has_non_wage_global_income_current_year, false);
  assert.deepEqual(capturedRequest.scenarios, ['current']);
  // D71 — 수익률 가정 객체 자체가 없다.
  assert.equal(capturedRequest.profile.isa_return_assumption, null, 'D71 — 예시가 수익률 가정을 요청에 실었다(있으면 안 된다)');
});

test('computeExampleScenario — 엔진이 ok:false를 돌려주면 사유를 담아 던진다(조용히 삼키지 않는다)', async () => {
  const fakeEngineClient = { compute: async () => ({ ok: false, errors: [{ code: 'ruleset_load_failed' }] }) };
  await assert.rejects(() => computeExampleScenario(fakeEngineClient), /example_showcase_compute_failed:ruleset_load_failed/);
});

/**
 * **실제 세법 엔진으로 끝까지 계산한다.** 목이 아니라 `src/engine/index.mjs`의
 * 진짜 `compute`다 — 세법이나 배분 규칙이 바뀌면(룰셋 JSON이 바뀌면) 이 값도
 * 함께 바뀐다는 것이 이 검사의 전제다.
 *
 * [2026-08-17, D71로 뒤집힌 기대값] **헤드라인이 이제 구간이 아니라 점(단일
 * 확정 세액공제)이다.** 옛 검사는 `bound_code === 'range'`·
 * `includes_assumption_component === true`를 기대했다 — 지우지 않고 뒤집는다
 * (관리자 판정과 같은 방향). D71 판정문이 인용한 실제 값(1,485,000원)까지
 * 그대로 확인한다.
 */
test('고정 입력 셋을 실제 엔진에 넣으면 계산 가능한 기본안이 나오고, 예산 항등식이 성립하며, 헤드라인이 단일 확정 세액공제다(D71)', () => {
  const request = buildEngineRequest(buildExampleForm(), ['current']);
  const response = engineCompute(request, rulesets);
  assert.equal(response.ok, true, `실제 엔진이 오류를 냈다: ${JSON.stringify(response.errors ?? response)}`);

  const scenario = response.scenarios.find((s) => s.scenario_id === 'current');
  assert.ok(scenario, 'current 시나리오가 없다');
  const plan = scenario.plans.find((p) => p.is_baseline) ?? scenario.plans[0];
  assert.ok(plan, '기본안이 없다');

  // 예산 항등식(engine-interface.md 0.12·10절, 7.0.0) — 화면이 반올림해 메우지
  // 않는다는 계약을 실제 엔진 출력으로 확인한다.
  const allocatedSum = plan.allocations.reduce((sum, a) => sum + a.monthly_krw, 0) + plan.unallocated_monthly_krw;
  assert.equal(allocatedSum, response.echo.monthly_capacity_krw);
  assert.equal(response.echo.monthly_capacity_krw, 1_500_000);

  // D71 — 뒤집힌 기대값. ISA 수익률 옵트인이 없으므로 가정 성분이 없고,
  // bound_code는 'point'다.
  assert.equal(plan.headline_composite_total.bound_code, 'point', 'D71 — 헤드라인이 구간이 아니라 점이어야 한다');
  assert.equal(plan.headline_composite_total.includes_assumption_component, false, 'D71 — 가정 성분이 없어야 한다');
  assert.equal(plan.headline_composite_total.point_estimate_krw, 1_485_000, 'D71 판정문이 인용한 값(1,485,000원)과 다르다');

  // 확정 성분(연금계좌 세액공제)은 이 소득 수준에서 0보다 커야 한다 — 완전히
  // 죽은 예시(전부 0)가 아니라는 최소한의 위생 검사.
  assert.ok(plan.deterministic_benefit.pension_credit_total_krw > 0, '세액공제액이 0이다 — 예시로 부적절하다');

  // [2026-08-17, 소유자 지시 2번 판별력 확인] 계좌 셋의 실제 배분 비율이
  // 정확히 33%/17%/50%(D71 판정문·소유자 지시 2번이 예로 든 값)인지 —
  // 도넛 조각 위 퍼센티지 라벨이 실제로 그릴 값이 이것이다.
  const byAccount = Object.fromEntries(plan.allocations.map((a) => [a.account, a.annual_krw]));
  const total = plan.allocations.reduce((sum, a) => sum + a.annual_krw, 0) + plan.unallocated_annual_krw;
  const pct = (account) => Math.round((byAccount[account] / total) * 100);
  assert.equal(pct('annuity_savings'), 33);
  assert.equal(pct('retirement_pension'), 17);
  assert.equal(pct('isa'), 50);
});

/**
 * [2026-08-20, 관리자 지시] `examplePersona2BirthDate` — `exampleBirthDate`와
 * 같은 역산 방식이지만 나이가 다르다(만 45세). 여러 과세연도로 확인해
 * 날짜 리터럴이 아니라는 것을 같은 방식으로 고정한다.
 */
test('examplePersona2BirthDate — 어느 과세연도에 물어도 과세기간 종료일 기준 정확히 만 45세다', () => {
  for (const taxYear of [2020, 2024, 2026, 2027, 2030, 2035]) {
    const birth = examplePersona2BirthDate(taxYear);
    assert.match(birth, /^\d{4}-01-01$/, `${taxYear} → ${birth}가 YYYY-01-01 형태가 아니다`);
    const age = ageOn(parseIsoDate(birth), endOfTaxYear(taxYear));
    assert.equal(age, 45, `taxYear=${taxYear}, birth=${birth} → age=${age} (45여야 한다)`);
  }
});

test('buildExamplePersona2Form이 지금 store.js가 읽는 TAX_YEAR로 생년월일을 만들고, 종합소득금액 축을 요청한다', () => {
  const form = buildExamplePersona2Form();
  assert.equal(form.birthDate, examplePersona2BirthDate(TAX_YEAR));
  assert.equal(form.currentSalary, '0', '근로소득이 없어야 한다(자영업자)');
  assert.equal(form.hasNonWageIncome, true);
  assert.equal(form.globalIncomeAmount, '8000');
  assert.equal(form.monthlyCapacity, '200');
  // D71과 같은 원칙 — ISA 수익률 옵트인을 켜지 않는다.
  assert.equal(form.isaReturnEnabled, false);
  assert.equal(form.isaReturnRatePercent, '');
  assert.equal(form.isaIncomeCharacter, null);
});

/**
 * **판별력이 있는 계약 검사(2행 판).** `computeExamplePersona2Scenario`가
 * `engineClient`의 응답을 그대로 옮기는지, 그리고 요청 자체가 종합소득금액
 * 축(총급여 0원 + `has_non_wage_global_income_current_year: true` +
 * `current_year_global_income_krw`)을 정확히 싣는지 잰다.
 */
test('computeExamplePersona2Scenario는 engineClient의 응답을 그대로 옮기고, 종합소득금액 축을 요청에 정확히 싣는다', async () => {
  let capturedRequest = null;
  const sentinelPlan = {
    plan_id: 'max_tax_credit',
    is_baseline: true,
    allocations: [],
    unallocated_annual_krw: 0,
    unallocated_monthly_krw: 0,
    total_allocated_monthly_krw: 888888,
    deterministic_benefit: { pension_credit_total_krw: 987654321 },
  };
  const fakeScenario = { scenario_id: 'current', is_enacted: true, plans: [sentinelPlan], account_eligibility: [] };
  const fakeEngineClient = {
    compute: async (request) => {
      capturedRequest = request;
      return { ok: true, schema_version: request.schema_version, echo: {}, scenarios: [fakeScenario], assumptions: [] };
    },
  };

  const { scenario, plan } = await computeExamplePersona2Scenario(fakeEngineClient);
  assert.equal(scenario, fakeScenario);
  assert.equal(plan.total_allocated_monthly_krw, 888888);

  assert.ok(capturedRequest, 'engineClient.compute가 호출되지 않았다');
  assert.equal(capturedRequest.profile.birth_date, examplePersona2BirthDate(TAX_YEAR));
  assert.equal(capturedRequest.profile.current_year_total_salary_krw, 0, '근로소득이 없어야 한다');
  assert.equal(capturedRequest.profile.has_non_wage_global_income_current_year, true);
  assert.equal(capturedRequest.profile.current_year_global_income_krw, 80_000_000); // 8,000만원
  assert.equal(capturedRequest.profile.monthly_capacity_krw, 2_000_000); // 월 200만원
  assert.equal(capturedRequest.profile.isa_return_assumption, null);
});

test('computeExamplePersona2Scenario — 엔진이 ok:false를 돌려주면 사유를 담아 던진다', async () => {
  const fakeEngineClient = { compute: async () => ({ ok: false, errors: [{ code: 'ruleset_load_failed' }] }) };
  await assert.rejects(
    () => computeExamplePersona2Scenario(fakeEngineClient),
    /example_showcase_persona2_compute_failed:ruleset_load_failed/,
  );
});

/**
 * **실제 세법 엔진으로 끝까지 계산한다(2행).** 이 검사의 핵심 주장 —
 * 이승은씨의 공제율 판정 축이 실제로 `global_income`(종합소득금액)이지
 * `total_salary`가 아니라는 것을 실제 엔진 응답(`echo.credit_rate_bracket.
 * basis_code`)으로 확인한다(engine-interface.md 0.7절). **판별력** —
 * `buildExamplePersona2Form`이 `hasNonWageIncome`을 빠뜨리거나
 * `currentSalary`를 0이 아닌 값으로 잘못 채우면 `basis_code`가
 * `total_salary`로 되돌아가 이 검사가 즉시 빨갛게 된다.
 */
test('이승은씨 요청을 실제 엔진에 넣으면 판정 축이 total_salary가 아니라 global_income이고, 계산 가능한 기본안이 나온다', () => {
  const request = buildEngineRequest(buildExamplePersona2Form(), ['current']);
  const response = engineCompute(request, rulesets);
  assert.equal(response.ok, true, `실제 엔진이 오류를 냈다: ${JSON.stringify(response.errors ?? response)}`);

  assert.equal(response.echo.credit_rate_bracket.basis_code, 'global_income', '판정 축이 종합소득금액이 아니다');
  assert.equal(response.echo.credit_rate_bracket.measured_amount_krw, 80_000_000);
  assert.equal(response.echo.credit_rate_bracket.fallback_applied, false, '본문 구간으로 떨어지면 안 된다 — 값을 실제로 실었다');

  const scenario = response.scenarios.find((s) => s.scenario_id === 'current');
  assert.ok(scenario, 'current 시나리오가 없다');
  const plan = scenario.plans.find((p) => p.is_baseline) ?? scenario.plans[0];
  assert.ok(plan, '기본안이 없다');

  const allocatedSum = plan.allocations.reduce((sum, a) => sum + a.monthly_krw, 0) + plan.unallocated_monthly_krw;
  assert.equal(allocatedSum, response.echo.monthly_capacity_krw);
  assert.equal(response.echo.monthly_capacity_krw, 2_000_000);

  assert.ok(plan.deterministic_benefit.pension_credit_total_krw > 0, '세액공제액이 0이다 — 예시로 부적절하다');
});

/**
 * [2026-08-17, D72] `applyDonutSliceInlineLabels`(이제 `charts.js`에 있다 —
 * 예시와 결과 패널 모바일 도넛이 공유한다)는 DOM이 없으면(또는 구조가
 * 어긋나면) 조용히 아무것도 하지 않는다 — 던지지 않는다. 이 파일의 나머지
 * 함수(순수 로직)와 달리 이 함수는 브라우저 DOM(SVG `getBBox`·
 * `getComputedStyle`)에 의존하므로 Node 단위 검사에서는 방어적 반환 경로만
 * 확인한다 — 실제 렌더·실측은 `example-showcase.browser.mjs`가 한다.
 */
test('applyDonutSliceInlineLabels — root가 없으면(또는 도넛을 못 찾으면) 조용히 아무것도 하지 않는다', () => {
  assert.doesNotThrow(() => applyDonutSliceInlineLabels(null));
  const fakeRoot = { querySelectorAll: () => [] };
  assert.doesNotThrow(() => applyDonutSliceInlineLabels(fakeRoot));
});
