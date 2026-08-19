// 정답지 18절(GC-P1 ~ GC-P9)을 그대로 옮긴 시험.
//
// **기대값을 이 파일이 만들지 않았다.** 전부 `docs/stage-4-verification/golden-cases.md`
// 18절에 `tax-domain`이 조문에서 도출해 적어 둔 수이고, 여기서는 그 수를 옮겨 적고
// 엔진이 같은 수를 내는지만 본다. 엔진이 다른 수를 내면 **엔진을 고친다** — 이 파일의
// 기대값을 엔진에 맞추는 순간 대조 장치가 무력해진다(정답지 18.0절의 규약).
//
// **왜 `GC-` 번호가 아니라 `GC-P`인가.** 이 아홉은 수령 단계이고, 25차까지 계약의
// 요청·응답 어휘에 수령 단계를 담을 칸이 없어 ```golden 블록을 달 수 없었다.
// D77의 역산기가 그 어휘를 들였으므로 이 회차에 시험으로 옮긴다.
//
// **공통 가정**(정답지 18.0절): 거주자 · 2013-03-01 이후 가입(GC-P5b만 예외) ·
// 이연퇴직소득과 과세제외금액 없음(GC-P7만 예외) · 확정기간형 · 종합소득공제는 본인
// 기본공제뿐 · 개인지방소득세는 소득세의 10%(상수로 쓰지 않고 두 규칙을 곱한다).

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadRulesets } from './test-helpers.mjs';
import { loadReverseRules } from './reverse-rules.mjs';
import { annualWithdrawalCap, minimumStartBalance } from './reverse-cap.mjs';
import {
  comprehensiveOption,
  deferredRetirementRatio,
  electiveSeparateOption,
  excessWithdrawalOtherIncome,
  isaDeemedTerminationOnWithdrawal,
  pensionIncomeDeduction,
  separateTaxationStatus,
  thresholdCountedAmount,
  withholdingOnPrivatePension,
} from './reverse-payout-tax.mjs';

const RULESETS = loadRulesets();
const TAX_YEAR = 2026;

function rules() {
  const loaded = loadReverseRules(RULESETS, TAX_YEAR);
  assert.deepEqual(loaded.errors, [], '룰셋에서 역산에 필요한 값을 전부 읽어야 한다');
  return loaded.rules;
}

// ── GC-P1 · GC-P1b — 연령별 원천징수세율 ────────────────────────────────

test('GC-P1 — 68세, 사적연금 연 1,200만원: 원천징수 660,000원으로 종결', () => {
  const r = rules();
  const withheld = withholdingOnPrivatePension(r, { annualKrw: 12_000_000, ageYears: 68 });

  assert.equal(withheld.rate, 0.05);
  assert.equal(withheld.income_tax_krw, 600_000);
  assert.equal(withheld.local_tax_krw, 60_000);
  assert.equal(withheld.total_krw, 660_000);

  // 다목 안이므로 §64조의4의 선택이 열리지 않고 여기서 끝난다.
  const status = separateTaxationStatus(r, { privatePensionAnnualKrw: 12_000_000 });
  assert.equal(status.within_threshold, true);
  assert.equal(status.elective_opens, false);
});

// **정답지 18.2절의 표가 자기 문서와 어긋난다 — 이 유닛은 정답지를 고치지 않았다.**
//
// 그 표는 「소득세 528,000 + 지방 52,800 = 580,800」이라고 적는데, `12,000,000 × 0.04`는
// **480,000**이다. 528,000은 480,000에 지방소득세를 이미 한 번 얹은 수이고, 표는 그 위에
// 한 번 더 얹었다. **같은 문서가 그 오류를 스스로 잡는다** — 바로 앞 18.1절이
// 「5%를 4%로 잘못 잡으면 **132,000원**이 어긋난다」고 적고, `660,000 − 132,000 = 528,000`이다.
// 즉 정답지 자신의 교차 검산이 **합계 528,000**을 가리킨다.
//
// 이 시험은 룰셋의 세율(4%)과 부가율(10%)을 곱해 나오는 값을 그대로 건다. **정답지의 수를
// 엔진에 맞춘 것이 아니라, 한 문서 안에서 갈린 두 수 중 조문·룰셋과 맞는 쪽을 골랐다.**
// 값의 저자는 `tax-domain`이므로 18.2절의 재산출이 필요하다 — 최종 보고에 올린다.
test('GC-P1b — 같은 사람이 만 70세면 528,000원 (경계는 위 구간에 붙는다)', () => {
  const r = rules();
  const withheld = withholdingOnPrivatePension(r, { annualKrw: 12_000_000, ageYears: 70 });

  assert.equal(withheld.rate, 0.04);
  assert.equal(withheld.income_tax_krw, 480_000);
  assert.equal(withheld.local_tax_krw, 48_000);
  assert.equal(withheld.total_krw, 528_000);

  // 정답지 18.1절이 적은 교차 검산 — 5%를 4%로 잘못 잡으면 132,000원이 어긋난다.
  const atFive = withholdingOnPrivatePension(r, { annualKrw: 12_000_000, ageYears: 68 });
  assert.equal(atFive.total_krw - withheld.total_krw, 132_000);

  // 69세는 아직 첫 구간이다 — 경계가 아래로 붙으면 이 줄이 깨진다.
  assert.equal(withholdingOnPrivatePension(r, { annualKrw: 12_000_000, ageYears: 69 }).rate, 0.05);
  // 80세 생일 당일부터 3%다.
  assert.equal(withholdingOnPrivatePension(r, { annualKrw: 12_000_000, ageYears: 80 }).rate, 0.03);
  assert.equal(withholdingOnPrivatePension(r, { annualKrw: 12_000_000, ageYears: 79 }).rate, 0.04);
});

// ── GC-P2 · GC-P3 — 1,500만원 문턱의 양쪽 1원 ──────────────────────────

test('GC-P2 — 15,000,000원은 「이하」이므로 문턱 안이고 825,000원으로 종결된다', () => {
  const r = rules();
  const status = separateTaxationStatus(r, { privatePensionAnnualKrw: 15_000_000 });

  assert.equal(status.threshold_krw, 15_000_000);
  assert.equal(status.within_threshold, true);
  assert.equal(status.elective_opens, false);

  const withheld = withholdingOnPrivatePension(r, { annualKrw: 15_000_000, ageYears: 68 });
  assert.equal(withheld.total_krw, 825_000);
});

test('GC-P3 — 15,000,001원은 문턱 밖이고, 밖이 되는 것은 1원이 아니라 전액이다', () => {
  const r = rules();
  const status = separateTaxationStatus(r, { privatePensionAnnualKrw: 15_000_001 });

  assert.equal(status.within_threshold, false);
  assert.equal(status.elective_opens, true);
  // all_or_nothing — §64조의4의 대상이 되는 금액이 초과분 1원이 아니라 전액이다.
  assert.equal(status.elective_base_krw, 15_000_001);

  // 원천징수는 750,000.05 → 750,000, 지방 75,000.
  const withheld = withholdingOnPrivatePension(r, { annualKrw: 15_000_001, ageYears: 68 });
  assert.equal(withheld.total_krw, 825_000);

  const comprehensive = comprehensiveOption(r, {
    privateAnnualKrw: 15_000_001,
    publicAnnualKrw: 0,
    otherGlobalIncomeKrw: 0,
  });
  assert.equal(comprehensive.total_pension_krw, 15_000_001);
  assert.equal(comprehensive.deduction_krw, 6_400_000); // 6,400,000.1의 표시값
  assert.equal(comprehensive.tax_base_krw, 7_100_000); // 7,100,000.9 → §47② 1원 미만 버림
  assert.equal(comprehensive.income_tax_krw, 426_000);
  assert.equal(comprehensive.local_tax_krw, 42_600);
  assert.equal(comprehensive.total_krw, 468_600);

  const elective = electiveSeparateOption(r, {
    privateAnnualKrw: 15_000_001,
    publicAnnualKrw: 0,
    otherGlobalIncomeKrw: 0,
  });
  assert.equal(elective.reading_a.total_krw, 2_475_000);

  // 468,600 < 2,475,000 → 제1호를 선택한다. 원천징수분 825,000과의 차액이 환급된다.
  assert.equal(825_000 - comprehensive.total_krw, 356_400);
});

// ── GC-P4 — 관리자가 지목한 좌표 ────────────────────────────────────────

test('GC-P4 — 68세, 연 1,600만원, 연금 외 소득 0: 528,000원 (미확정 위에 서지 않는 좌표)', () => {
  const r = rules();

  const withheld = withholdingOnPrivatePension(r, { annualKrw: 16_000_000, ageYears: 68 });
  assert.equal(withheld.total_krw, 880_000);

  const comprehensive = comprehensiveOption(r, {
    privateAnnualKrw: 16_000_000,
    publicAnnualKrw: 0,
    otherGlobalIncomeKrw: 0,
  });
  assert.equal(comprehensive.deduction_krw, 6_500_000);
  assert.equal(comprehensive.pension_income_krw, 9_500_000);
  assert.equal(comprehensive.tax_base_krw, 8_000_000);
  assert.equal(comprehensive.total_krw, 528_000);

  const elective = electiveSeparateOption(r, {
    privateAnnualKrw: 16_000_000,
    publicAnnualKrw: 0,
    otherGlobalIncomeKrw: 0,
  });
  // 읽기 A(총연금액 기준)와 읽기 B(연금소득금액 기준)가 값은 다르지만
  assert.equal(elective.reading_a.total_krw, 2_640_000);
  assert.equal(elective.reading_b.total_krw, 1_567_500);
  // 둘 다 제1호보다 크므로 **이 좌표에서는 미확정이 결론을 바꾸지 않는다.**
  assert.equal(elective.basis_is_undetermined, true);
  assert.equal(elective.readings_agree_on_lower_option, true);

  assert.equal(880_000 - comprehensive.total_krw, 352_000);
});

// ── GC-P5 · GC-P5b — 연금수령한도와 그 역산 ────────────────────────────

test('GC-P5 — 평가액 2억, 1년차: 첫해 한도 24,000,000원 (월 200만원)', () => {
  const r = rules();
  assert.equal(
    annualWithdrawalCap(r, { balanceKrw: 200_000_000, withdrawalYearIndex: 1 }),
    24_000_000,
  );
});

test('GC-P5b — 기산연차가 6년차면 같은 평가액에 한도가 두 배다', () => {
  const r = rules();
  assert.equal(
    annualWithdrawalCap(r, { balanceKrw: 200_000_000, withdrawalYearIndex: 6 }),
    48_000_000,
  );
});

test('GC-P5 역방향 — 월 200만원을 첫해에 전부 연금수령하려면 개시 시점 평가액 2억', () => {
  const r = rules();
  const floor = minimumStartBalance(r, { annualWithdrawalKrw: 24_000_000, payoutYears: 1 });
  assert.equal(floor.first_year_floor_krw, 200_000_000);
  assert.equal(floor.required_krw, 200_000_000);
});

test('연금수령한도가 사라지는 연차 이후에는 한도가 없다', () => {
  const r = rules();
  assert.equal(annualWithdrawalCap(r, { balanceKrw: 200_000_000, withdrawalYearIndex: 11 }), null);
});

// ── GC-P6 — 한도를 넘겨 인출한다 ────────────────────────────────────────

test('GC-P6 — 한도 초과는 초과분에만 걸린다. 30,000,000 전부가 연금외수령이 되는 것이 아니다', () => {
  const r = rules();
  const cap = annualWithdrawalCap(r, { balanceKrw: 200_000_000, withdrawalYearIndex: 1 });
  assert.equal(cap, 24_000_000);

  const excess = 30_000_000 - cap;
  assert.equal(excess, 6_000_000);

  const otherIncome = excessWithdrawalOtherIncome(r, { excessKrw: excess });
  assert.equal(otherIncome.rate, 0.15);
  assert.equal(otherIncome.income_tax_krw, 900_000);
  assert.equal(otherIncome.local_tax_krw, 90_000);
  assert.equal(otherIncome.total_krw, 990_000);

  const withheld = withholdingOnPrivatePension(r, { annualKrw: cap, ageYears: 68 });
  assert.equal(withheld.total_krw, 1_320_000);

  // 한도 안의 24,000,000은 다목 밖이므로 §64조의4로 정산된다.
  const status = separateTaxationStatus(r, { privatePensionAnnualKrw: cap });
  assert.equal(status.elective_opens, true);

  const comprehensive = comprehensiveOption(r, {
    privateAnnualKrw: cap,
    publicAnnualKrw: 0,
    otherGlobalIncomeKrw: 0,
  });
  assert.equal(comprehensive.deduction_krw, 7_300_000);
  assert.equal(comprehensive.pension_income_krw, 16_700_000);
  assert.equal(comprehensive.tax_base_krw, 15_200_000);
  assert.equal(comprehensive.total_krw, 1_122_000);

  const elective = electiveSeparateOption(r, {
    privateAnnualKrw: cap,
    publicAnnualKrw: 0,
    otherGlobalIncomeKrw: 0,
  });
  assert.equal(elective.reading_a.total_krw, 3_960_000);
});

// ── GC-P7 — 이연퇴직소득의 연차 경계와 재원 구분 ────────────────────────

test('GC-P7a·b — 실제 수령연차 10년차는 70%, 11년차는 60%. 경계가 아래 구간에 붙는다', () => {
  const r = rules();

  const tenth = deferredRetirementRatio(r, { actualPayoutYearIndex: 10 });
  assert.equal(tenth.ratio_of_base_rate, 0.7);
  assert.equal(tenth.statutory, '가목');

  const eleventh = deferredRetirementRatio(r, { actualPayoutYearIndex: 11 });
  assert.equal(eleventh.ratio_of_base_rate, 0.6);
  assert.equal(eleventh.statutory, '나목');

  assert.equal(deferredRetirementRatio(r, { actualPayoutYearIndex: 20 }).ratio_of_base_rate, 0.6);
  assert.equal(deferredRetirementRatio(r, { actualPayoutYearIndex: 21 }).ratio_of_base_rate, 0.5);

  // 밑세율(퇴직소득세)은 이 룰셋의 범위 밖이다. 엔진은 금액을 내지 않는다.
  assert.equal(tenth.base_rate_in_scope, false);
  assert.equal(tenth.income_tax_krw, null);
});

test('GC-P7 — 이연퇴직소득 1,000만원은 문턱의 합계액에 한 원도 들어가지 않는다', () => {
  const r = rules();
  const counted = thresholdCountedAmount(r, {
    taxCreditedAndReturnKrw: 15_000_000,
    deferredRetirementKrw: 10_000_000,
    nonTaxablePrincipalKrw: 0,
    isaConversionKrw: 0,
  });
  // 총 수령액은 2,500만원인데 문턱 판정은 1,500만원으로 한다.
  assert.equal(counted, 15_000_000);

  const status = separateTaxationStatus(r, { privatePensionAnnualKrw: counted });
  assert.equal(status.within_threshold, true);
});

// ── GC-P8 — 연금소득공제 900만원 한도가 무는 자리 ───────────────────────

test('GC-P8a·b — 총연금액 41,000,000원에서 공제가 한도에 정확히 닿고, 그 위로는 늘지 않는다', () => {
  const r = rules();

  assert.equal(pensionIncomeDeduction(r, { totalPensionKrw: 41_000_000 }), 9_000_000);
  assert.equal(pensionIncomeDeduction(r, { totalPensionKrw: 41_000_001 }), 9_000_000);

  // 공제는 공적연금과 사적연금에 **합쳐서 한 번** 걸린다.
  const withPublic = comprehensiveOption(r, {
    privateAnnualKrw: 21_000_000,
    publicAnnualKrw: 20_000_000,
    otherGlobalIncomeKrw: 0,
  });
  assert.equal(withPublic.total_pension_krw, 41_000_000);
  assert.equal(withPublic.deduction_krw, 9_000_000);

  // 사적연금만 따로 계산하면 7,000,000이 되어 실제 잔여의 세 배가 넘는다 — 그러면 안 된다.
  assert.notEqual(withPublic.deduction_krw, pensionIncomeDeduction(r, { totalPensionKrw: 21_000_000 }));
});

// ── GC-P9 — ISA 원금 초과 인출의 3년 전 경계 ────────────────────────────

test('GC-P9a·b — 3년 전이라도 원금 범위 내 인출은 해지 의제가 아니고, 1원 초과부터 걸린다', () => {
  const r = rules();

  const atPrincipal = isaDeemedTerminationOnWithdrawal(r, {
    yearsSinceOpening: 2,
    cumulativeContributionKrw: 30_000_000,
    withdrawalKrw: 30_000_000,
  });
  assert.equal(atPrincipal.deemed_terminated, false);

  const overPrincipal = isaDeemedTerminationOnWithdrawal(r, {
    yearsSinceOpening: 2,
    cumulativeContributionKrw: 30_000_000,
    withdrawalKrw: 30_000_001,
  });
  assert.equal(overPrincipal.deemed_terminated, true);

  // 3년이 지난 뒤의 원금 초과 인출은 조문이 규율하지 않는다 — 확정 문장을 쓰지 않는다.
  const afterThreeYears = isaDeemedTerminationOnWithdrawal(r, {
    yearsSinceOpening: 3,
    cumulativeContributionKrw: 30_000_000,
    withdrawalKrw: 30_000_001,
  });
  assert.equal(afterThreeYears.deemed_terminated, null);
  assert.equal(afterThreeYears.reason_code, 'after_min_contract_years_not_settled');
});
