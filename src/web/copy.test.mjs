import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_BENEFIT_STRIP_REF_CAPTION, benefitMeterAxisCaption } from './copy.js';

/**
 * `AccountBenefitStrip` 문구 — D33 재개정(design-system 5.31.1절 "크기가
 * 아니라 다른 것으로 오독을 막는다")이 넷 중 둘을 문구에 건다. 폭이 카드
 * 내용 폭의 50%로 넓어져도 이 두 문장이 그대로면 오독 방지가 깨진다 — 그래서
 * 문구 자체를 고정한다(레이아웃은 `browser/account-benefit-strip.browser.mjs`가 본다).
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

test('축 캡션(장치③)이 세액공제 인정 한도 대비 비율을 화면 문구로 낸다', () => {
  assert.equal(benefitMeterAxisCaption(92), '세액공제 인정 한도 대비 92%');
  assert.equal(benefitMeterAxisCaption(0), '세액공제 인정 한도 대비 0%');
  assert.equal(benefitMeterAxisCaption(100), '세액공제 인정 한도 대비 100%');
});

test('축 캡션은 C-2(AllocationBar)의 "납입 잔여 한도" 어휘와 겹치지 않는다', () => {
  // C-2 캡션(`contributionRemainingCaption`)은 "납입 잔여 한도"를 쓴다. 이
  // 위젯의 폭이 넓어져 두 막대의 길이가 비슷해 보이더라도, 캡션 어휘 자체가
  // 겹치면 "같은 것을 재는 두 막대"로 오독한다(design-system 5.31.1절 장치③).
  const caption = benefitMeterAxisCaption(50);
  assert.ok(!caption.includes('납입 잔여 한도'), `축 캡션이 C-2 어휘를 재사용했습니다: "${caption}"`);
  assert.ok(caption.includes('세액공제 인정 한도'), '이 위젯 고유의 축(denominator) 이름을 써야 한다');
});
