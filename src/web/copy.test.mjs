import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_BENEFIT_STRIP_REF_CAPTION,
  benefitMeterAxisCaption,
  confirmedAxisCaption,
  assumptionAxisCaption,
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

test('확정 축 캡션(D37 1번)은 「올해」를 쓰고 지방소득세 포함을 밝힌다', () => {
  const caption = confirmedAxisCaption({ ceiling_krw: 1485000, income_tax_krw: 1350000, local_tax_krw: 135000 });
  assert.ok(caption.includes('올해'), '확정 축은 조건절 없이 「올해」로만 기간을 말해야 한다(D36)');
  assert.ok(!caption.includes('라면'), '확정 축에는 조건절(가정)을 붙이지 않는다');
  // D37 1번 — 사용자의 연말정산 서류는 소득세분·지방소득세분을 따로 적는다.
  // 합계만 적으면 사용자가 자기 서류에서 그 수를 못 찾는다.
  assert.ok(caption.includes('소득세'), '소득세분을 밝혀야 한다');
  assert.ok(caption.includes('지방소득세'), '지방소득세분을 밝혀야 한다');
  assert.ok(caption.includes('1,350,000') && caption.includes('135,000'), '두 몫이 실제 값이어야 한다');
});

test('가정 축 캡션(D36)은 정산 기간과 수익률 조건절을 반드시 붙인다', () => {
  const caption = assumptionAxisCaption({
    estimate: { settlement_years: 3, upper_bound_krw: 90000, axis_breakdown_bound_code: 'point' },
    annualReturnRate: 0.07,
  });
  assert.ok(caption.includes('3년 동안'), '가정 축은 정산 기간을 명시해야 한다');
  assert.ok(caption.includes('수익률이 연 7%라면'), '가정 축은 조건절을 반드시 붙여야 한다(D36)');
});

test('가정 축 캡션은 점 추정이 없으면(구간의 위 끝) 「최대」를 붙인다', () => {
  const caption = assumptionAxisCaption({
    estimate: { settlement_years: 5, upper_bound_krw: 90000, axis_breakdown_bound_code: 'upper_bound' },
    annualReturnRate: 0.05,
  });
  assert.ok(caption.includes('최대'), '점 추정이 없으면(구간의 위 끝) 실제보다 크게 말하지 않도록 「최대」를 붙여야 한다(D36)');
});
