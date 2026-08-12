import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_BENEFIT_STRIP_REF_CAPTION,
  benefitMeterAxisCaption,
  confirmedAxisAmountSentence,
  confirmedAxisBasisSentence,
  assumptionAxisCaption,
  isaTaxFreeCeilingSentence,
  ACCOUNT_BENEFIT_NO_STATUTORY_CEILING_SUFFIX,
  fundUseHorizonLabel,
  FUND_USE_HORIZON_LABEL,
  unallocatedBreakdownMessage,
  notAllocatedInPlanCaption,
  NOT_ALLOCATED_IN_PLAN_CAPTION,
} from './copy.js';

/**
 * `AccountBenefitStrip` 문구 — D33(design-system 5.31.1절) → D36(5.31.3절)
 * 재개정. 폭이 카드 내용 폭 그대로(100%)로 넓어져도 이 문장들이 그대로면
 * 오독 방지가 깨진다 — 그래서 문구 자체를 고정한다(레이아웃은
 * `browser/account-benefit-strip.browser.mjs`가 본다).
 */

test('참조 캡션(장치②)이 "새로 계산한 값이 아니다"를 명시한다', () => {
  assert.ok(
    ACCOUNT_BENEFIT_STRIP_REF_CAPTION.includes('요약'),
    '이 블록이 파생물이라는 것을 "요약"이라는 말로 못박아야 한다',
  );
  assert.ok(
    ACCOUNT_BENEFIT_STRIP_REF_CAPTION.includes('새로 계산한 값이 아닙니다'),
    '"조건이 같다"뿐 아니라 "값도 같다(새로 계산하지 않았다)"까지 말해야 한다',
  );
});

test('행 아래 축 캡션(장치③, D36)이 축 중립 문구를 낸다', () => {
  // D36 — 축이 확정/가정 둘로 갈라졌으므로 모든 행에 "세액공제 인정 한도
  // 대비"를 쓰면 ISA·저율분리 행에서 성립하지 않는 비교로 읽힌다
  // (design-system 5.31.2절). 어느 축을 재는지는 소구획 캡션이 말한다.
  assert.equal(benefitMeterAxisCaption(92), '이 축 기준 92%');
  assert.equal(benefitMeterAxisCaption(0), '이 축 기준 0%');
  assert.equal(benefitMeterAxisCaption(100), '이 축 기준 100%');
});

test('행 아래 축 캡션은 C-2(AllocationBar)의 "납입 잔여 한도" 어휘와 겹치지 않는다', () => {
  // C-2 캡션(`contributionRemainingCaption`)은 "납입 잔여 한도"를 쓴다. 이
  // 위젯의 폭이 넓어져 두 막대의 길이가 비슷해 보이더라도, 캡션 어휘 자체가
  // 겹치면 "같은 것을 재는 두 막대"로 오독한다.
  const caption = benefitMeterAxisCaption(50);
  assert.ok(!caption.includes('납입 잔여 한도'), `축 캡션이 C-2 어휘를 재사용했습니다: "${caption}"`);
});

test('확정 축 한 줄(D38 재개정)은 지방소득세 포함 상한과 실제 공제액을 한 줄로 합친다', () => {
  const sentence = confirmedAxisAmountSentence(
    { ceiling_krw: 1485000, income_tax_krw: 1350000, local_tax_krw: 135000 },
    '550,000원',
  );
  // D37 1번 — 사용자의 연말정산 서류는 소득세분·지방소득세분을 따로 적는다.
  // 합계만 적으면 사용자가 자기 서류에서 그 수를 못 찾는다.
  assert.ok(sentence.includes('소득세'), '소득세분을 밝혀야 한다');
  assert.ok(sentence.includes('지방소득세'), '지방소득세분을 밝혀야 한다');
  assert.ok(sentence.includes('1,350,000') && sentence.includes('135,000'), '두 몫이 실제 값이어야 한다');
  assert.ok(sentence.includes('중 550,000원'), '「최대 X 중 Y」 형태로 실제 공제액이 함께 있어야 한다');
});

test('확정 축 판정 기준 문장은 basis_code 세 갈래로 갈린다', () => {
  assert.equal(confirmedAxisBasisSentence({ basis_code: 'total_salary', fallback_applied: false }), '총급여 기준으로 계산한 값입니다.');
  assert.equal(
    confirmedAxisBasisSentence({ basis_code: 'global_income', fallback_applied: false }),
    '종합소득금액 기준으로 계산한 값입니다.',
  );
  const fallback = confirmedAxisBasisSentence({ basis_code: 'statutory_default', fallback_applied: true });
  assert.ok(fallback.includes('우대 공제율'), 'fallback은 기존 안내 문구(credit_rate_global_income_missing)를 재사용해야 한다');
});

test('가정 축 머리글(D38 재개정)은 정산 기간과 수익률 조건절만 붙이고 금액을 적지 않는다', () => {
  const caption = assumptionAxisCaption({
    estimate: { settlement_years: 3, axis_breakdown_bound_code: 'point' },
    annualReturnRate: 0.07,
  });
  assert.ok(caption.includes('3년 동안'), '가정 축은 정산 기간을 명시해야 한다');
  assert.ok(caption.includes('수익률이 연 7%라면'), '가정 축은 조건절을 반드시 붙여야 한다(D36)');
  assert.ok(!/\d/.test(caption.replace('3', '').replace('7', '')), '공통 최댓값을 더 이상 적지 않는다(D38 재개정)');
});

test('ISA 비과세 행은 기간을 문장 맨 앞에 못박고 「최대 X 중 Y」로 적는다', () => {
  const sentence = isaTaxFreeCeilingSentence({
    axis_ceilings: {
      tax_free_krw: 308000,
      tax_free_settlement_years: 5,
      tax_free_settlement_years_source: 'user',
    },
    axis_breakdown: { tax_free_krw: 210000 },
    axis_breakdown_bound_code: 'point',
  });
  assert.ok(sentence.startsWith('5년 계약 전체에서'), '기간이 문장 맨 앞이어야 한다');
  assert.ok(sentence.includes('최대 308,000원 중 210,000원'), '「최대 X 중 Y」 형태여야 한다');
});

test('ISA 비과세 행은 분자가 구간 위 끝이면 괄호 부기를 쓰고 「최대」를 두 번 쓰지 않는다', () => {
  const sentence = isaTaxFreeCeilingSentence({
    axis_ceilings: {
      tax_free_krw: 308000,
      tax_free_settlement_years: 5,
      tax_free_settlement_years_source: 'ruleset_min_contract_years',
    },
    axis_breakdown: { tax_free_krw: 210000 },
    axis_breakdown_bound_code: 'upper_bound',
  });
  assert.ok(sentence.includes('210,000원(구간 위 끝)'), '분자는 접두 대신 괄호 부기를 써야 한다');
  assert.equal((sentence.match(/최대/g) ?? []).length, 1, '한 줄에 「최대」가 두 번 나오면 안 된다');
  assert.ok(sentence.includes('계약기간을 입력하지 않아'), '계약기간 하한 대입 사실을 밝혀야 한다');
});

test('법정 상한이 없는 축에는 고정 접미사가 있다', () => {
  assert.equal(ACCOUNT_BENEFIT_NO_STATUTORY_CEILING_SUFFIX, '법정 상한 없음');
});

// ---------------------------------------------------------------------------
// 지평 선택지 라벨 (소유자 3번 · D52 3번)
// ---------------------------------------------------------------------------

test('within_isa_lock_in 라벨은 경계값이 있으면 그 연수를 명시한다', () => {
  const label = fundUseHorizonLabel('within_isa_lock_in', { isa_lock_in_years: 3, pension_years_remaining: 9 });
  assert.ok(label.includes('3년'), `라벨이 의무가입기간 연수를 담아야 한다: "${label}"`);
});

test('before_pension_age 라벨은 아래 끝(의무가입기간)과 위 끝(그 사람의 값)을 함께 적는다', () => {
  const label = fundUseHorizonLabel('before_pension_age', { isa_lock_in_years: 3, pension_years_remaining: 9 });
  assert.ok(label.includes('3년') && label.includes('9년'), `라벨이 범위를 명시해야 한다: "${label}"`);
  // 위 끝은 사람마다 다르다 — 지어낸 상수(예: 10년)를 쓰지 않는다.
  assert.ok(!label.includes('10년'), `위 끝을 지어내면 안 된다: "${label}"`);
});

test('경계값을 아직 모르면(생년월일 미입력) 숫자를 지어내지 않고 원래 문구로 떨어진다', () => {
  assert.equal(fundUseHorizonLabel('within_isa_lock_in', null), FUND_USE_HORIZON_LABEL.within_isa_lock_in);
  assert.equal(fundUseHorizonLabel('before_pension_age', undefined), FUND_USE_HORIZON_LABEL.before_pension_age);
  assert.equal(fundUseHorizonLabel('before_pension_age', { isa_lock_in_years: 3, pension_years_remaining: null }), FUND_USE_HORIZON_LABEL.before_pension_age);
});

test('나머지 두 선택지는 경계값과 무관하게 고정 문구다', () => {
  assert.equal(fundUseHorizonLabel('at_or_after_pension_age', { isa_lock_in_years: 3 }), FUND_USE_HORIZON_LABEL.at_or_after_pension_age);
  assert.equal(fundUseHorizonLabel('unknown', { isa_lock_in_years: 3 }), FUND_USE_HORIZON_LABEL.unknown);
});

// ---------------------------------------------------------------------------
// 미배분 갈래 (D52 2번·D53 1번) — 이유마다 다른 문장
// ---------------------------------------------------------------------------

test('reason_code가 no_account_beneficial이면 여력을 권유로 적지 않는다', () => {
  const message = unallocatedBreakdownMessage({
    total_annual_krw: 12000000,
    pension_contribution_headroom_krw: 9000000,
    isa_contribution_headroom_krw: 21000000,
    no_headroom_krw: 0,
    headrooms_overlap: true,
    reason_code: 'no_account_beneficial_within_fund_use_horizon',
  });
  assert.ok(message.includes('12,000,000'), '전액이 문장에 있어야 한다');
  assert.ok(!message.includes('더 납입할 수 있습니다'), `권유 문장이 남아 있으면 안 된다: "${message}"`);
  assert.ok(message.includes('이롭지 않'), `이유가 명시돼야 한다: "${message}"`);
});

test('reason_code가 contribution_room_exhausted이면 기존 권유 문장을 그대로 쓴다', () => {
  const message = unallocatedBreakdownMessage({
    total_annual_krw: 5000000,
    pension_contribution_headroom_krw: 5000000,
    isa_contribution_headroom_krw: 0,
    no_headroom_krw: 0,
    headrooms_overlap: false,
    reason_code: 'contribution_room_exhausted',
  });
  assert.ok(message.includes('더 납입할 수 있습니다'), `한도가 남았으면 권유 문장이 있어야 한다: "${message}"`);
});

test('미배분액이 0이면(설명할 미배분이 없다) null을 낸다', () => {
  assert.equal(unallocatedBreakdownMessage({ total_annual_krw: 0, reason_code: null }), null);
  assert.equal(unallocatedBreakdownMessage(null), null);
});

// ---------------------------------------------------------------------------
// 계좌 한 행의 "배분 없음" 캡션 (D52·D53) — 시점·IRP 트림이면 이유를 말한다
// ---------------------------------------------------------------------------

test('fund_use_horizon으로 0원인 계좌는 그 행에서 바로 이유를 말한다', () => {
  const caption = notAllocatedInPlanCaption('fund_use_horizon');
  assert.ok(caption.includes('이롭지 않'), `"${caption}"`);
  assert.notEqual(caption, NOT_ALLOCATED_IN_PLAN_CAPTION);
});

test('no_additional_tax_credit으로 0원인 IRP는 그 행에서 트림 이유를 말한다', () => {
  const caption = notAllocatedInPlanCaption('no_additional_tax_credit');
  assert.ok(caption.includes('세액공제액이 늘지 않아'), `"${caption}"`);
  assert.notEqual(caption, NOT_ALLOCATED_IN_PLAN_CAPTION);
});

test('그 밖의 이유(예산·한도·없음)는 원래의 일반 캡션으로 떨어진다', () => {
  for (const reason of ['budget', 'contribution_limit', null, undefined]) {
    assert.equal(notAllocatedInPlanCaption(reason), NOT_ALLOCATED_IN_PLAN_CAPTION);
  }
});
