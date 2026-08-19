import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVERSE_NOTICE, REVERSE_ASSUMPTION, REVERSE_FILL_BASIS, REVERSE_FILL_ORDER_VARIANT } from '../engine/constants.mjs';
import {
  reverseNoticeMessage,
  reverseAssumptionMessage,
  reverseFillBasisMessage,
  reverseFillOrderVariantMessage,
} from './reverse-copy.js';

/**
 * `wording.test.mjs`와 같은 형태의 전건 대조 시험 — 연금 역산기 판이다.
 *
 * `engine-interface.md` 8.11절: "역산기 문구 사전을 만들 때 `wording.test.mjs`와
 * **같은 형태의 전건 대조**를 `REVERSE_NOTICE`·`REVERSE_ASSUMPTION`에 대해서도
 * 세워야 한다." 코드 레지스트리의 단일 진실 원천은 `src/engine/constants.mjs`다
 * — 이 시험이 손으로 옮겨 적은 부분집합이 아니라 그 레지스트리를 직접 돌아,
 * 코드가 늘었는데 문구가 없으면 자동으로 붉어지는 구조를 만든다(4단계 게이트4
 * 재소집이 첫 탭에서 잡은 결함 — 손으로 옮긴 목록이 절반만 봤던 자리 — 을
 * 이 탭에서는 처음부터 만들지 않는다).
 */

test('every REVERSE_NOTICE code has a sentence — no raw code reaches the screen', () => {
  for (const code of Object.values(REVERSE_NOTICE)) {
    const text = reverseNoticeMessage({ code, params: {} });
    assert.notEqual(
      text,
      code,
      `REVERSE_NOTICE.${code}에 대응하는 문구가 reverse-copy.js의 REVERSE_NOTICE_MESSAGE에 없다 — fallback으로 코드 문자열이 그대로 화면에 뜬다`,
    );
    assert.ok(typeof text === 'string' && text.length > 0, `${code}: 빈 문자열이다`);
  }
});

test('every REVERSE_ASSUMPTION code has a sentence — no raw code reaches the screen', () => {
  for (const code of Object.values(REVERSE_ASSUMPTION)) {
    const text = reverseAssumptionMessage(code, {});
    assert.notEqual(
      text,
      code,
      `REVERSE_ASSUMPTION.${code}에 대응하는 문구가 reverse-copy.js의 REVERSE_ASSUMPTION_MESSAGE에 없다`,
    );
    assert.ok(typeof text === 'string' && text.length > 0, `${code}: 빈 문자열이다`);
  }
});

test('every sentence survives an empty params object without leaving a gap', () => {
  // wording.test.mjs가 첫 탭에서 지키는 것과 같은 규율 — 엔진이 params를 줄이거나
  // 늘려도 문장이 스스로 완결되어야 한다.
  for (const code of Object.values(REVERSE_NOTICE)) {
    const text = reverseNoticeMessage({ code, params: {} });
    assert.ok(!/^\s/.test(text), `${code}: 공백으로 시작한다 — ${JSON.stringify(text)}`);
    assert.ok(!/undefined|null|NaN/.test(text), `${code}: 값이 없는 자리가 그대로 새어 나왔다 — ${text}`);
    assert.ok(!/\s{2,}/.test(text), `${code}: 값이 빠진 자리에 공백이 두 칸 남았다 — ${JSON.stringify(text)}`);
  }
  for (const code of Object.values(REVERSE_ASSUMPTION)) {
    const text = reverseAssumptionMessage(code, {});
    assert.ok(!/^\s/.test(text), `${code}: 공백으로 시작한다 — ${JSON.stringify(text)}`);
    assert.ok(!/undefined|null|NaN/.test(text), `${code}: 값이 없는 자리가 그대로 새어 나왔다 — ${text}`);
    assert.ok(!/\s{2,}/.test(text), `${code}: 값이 빠진 자리에 공백이 두 칸 남았다 — ${JSON.stringify(text)}`);
  }
});

test('the return-rate-supplied sentence echoes the user\'s own number and disclaims that the service does not propose one — D77 판정 1과 같은 방어선', () => {
  const seven = reverseAssumptionMessage('reverse_return_rate_user_supplied', { annual_return_rate: 0.07 });
  const three = reverseAssumptionMessage('reverse_return_rate_user_supplied', { annual_return_rate: 0.03 });
  assert.notEqual(seven, three, '문구가 실제 입력이 아니라 고정된 숫자를 말하고 있다');
  assert.match(seven, /제시한 값이 아닙니다/);
});

test('the zero-growth assumption states that the user\'s return rate does not move the statutory judgement — AC-R16의 문구 대응', () => {
  const text = reverseAssumptionMessage('reverse_zero_growth_for_statutory_cap', {});
  assert.match(text, /무성장/);
  assert.match(text, /영향을 주지 않습니다/);
});

test('no REVERSE_NOTICE/REVERSE_ASSUMPTION sentence uses vocabulary the charter forbids', () => {
  const banned = ['세무 상담', '세무 자문', '세무 대리', '세무 진단', '컨설팅', '추천합니다', '하세요', '넣으세요', '손해', '위험', '!', '선택하세요', '권장'];
  for (const code of Object.values(REVERSE_NOTICE)) {
    const text = reverseNoticeMessage({ code, params: { crossing_ages: [70, 80] } });
    for (const word of banned) assert.ok(!text.includes(word), `REVERSE_NOTICE.${code}: "${word}" — ${text}`);
  }
  for (const code of Object.values(REVERSE_ASSUMPTION)) {
    const text = reverseAssumptionMessage(code, { annual_return_rate: 0.05 });
    for (const word of banned) assert.ok(!text.includes(word), `REVERSE_ASSUMPTION.${code}: "${word}" — ${text}`);
  }
});

// ---------------------------------------------------------------------------
// [2026-08-19, 게이트 5 D78 ④ 후속 · `tax-rules-report.md` 32절] 배분 근거
// 코드 — `REVERSE_FILL_BASIS`·`REVERSE_FILL_ORDER_VARIANT`. 관리자 지시:
// "지금은 NOTICE·ASSUMPTION만 훑어 이 다섯은 문구가 없어도 안 붉어진다 —
// 두 목록에도 같은 형태의 대조를 세워라."
// ---------------------------------------------------------------------------

test('every REVERSE_FILL_BASIS code has a sentence — no raw code reaches the screen', () => {
  for (const code of Object.values(REVERSE_FILL_BASIS)) {
    const text = reverseFillBasisMessage(code);
    assert.notEqual(text, code, `REVERSE_FILL_BASIS.${code}에 대응하는 문구가 reverse-copy.js에 없다`);
    assert.ok(typeof text === 'string' && text.length > 0, `${code}: 빈 문자열이다`);
  }
});

test('every REVERSE_FILL_ORDER_VARIANT code has a sentence — no raw code reaches the screen', () => {
  for (const code of Object.values(REVERSE_FILL_ORDER_VARIANT)) {
    const text = reverseFillOrderVariantMessage(code);
    assert.notEqual(text, code, `REVERSE_FILL_ORDER_VARIANT.${code}에 대응하는 문구가 reverse-copy.js에 없다`);
    assert.ok(typeof text === 'string' && text.length > 0, `${code}: 빈 문자열이다`);
  }
});

test('no REVERSE_FILL_BASIS/REVERSE_FILL_ORDER_VARIANT sentence claims the tax law fixes the fill order', () => {
  // 32.6절 1번 — "세법이 이 순서를 정한다"는 뜻을 쓰지 않는다. 쓸 수 있는
  // 수준은 "조문이 고정한 사실이 이 방향을 지지한다"뿐이다.
  const bannedOrderClaims = ['세법이 정', '법이 정한 순서', '법령이 정한 순서', '세법이 이 순서'];
  for (const code of Object.values(REVERSE_FILL_BASIS)) {
    const text = reverseFillBasisMessage(code);
    for (const phrase of bannedOrderClaims) assert.ok(!text.includes(phrase), `REVERSE_FILL_BASIS.${code}: "${phrase}" — ${text}`);
  }
  for (const code of Object.values(REVERSE_FILL_ORDER_VARIANT)) {
    const text = reverseFillOrderVariantMessage(code);
    for (const phrase of bannedOrderClaims) assert.ok(!text.includes(phrase), `REVERSE_FILL_ORDER_VARIANT.${code}: "${phrase}" — ${text}`);
  }
});

test('the ISA transfer fill-basis sentence names the conversion plan as its premise', () => {
  // 관리자 지시 — "전환 계획이 전제라는 사실 명시".
  const text = reverseFillBasisMessage('reverse_fill_isa_transfer_opens_extra_credit_limit_if_converted');
  assert.match(text, /전환할 계획/);
});

test('the no-credit-this-year fill-basis sentence neither says "혜택 없음" nor claims a credit is granted', () => {
  // 32.6절 판정 — 「혜택 없음」·「세액공제를 받습니다」 둘 다 금지. 쓸 수 있는
  // 것은 "그 해의 세액공제를 낳지 않으나 인출 시 원금이 과세되지 않습니다"뿐이다.
  const text = reverseFillBasisMessage('reverse_fill_no_credit_this_year_but_principal_untaxed_on_withdrawal');
  assert.ok(!text.includes('혜택이 없'), text);
  assert.ok(!text.includes('혜택 없'), text);
  assert.ok(!/(?<!낳지 않)세액공제를 받습니다/.test(text), `세액공제를 받는다고 잘못 단정한다: ${text}`);
  assert.match(text, /세액공제를 낳지 않습니다/);
  assert.match(text, /과세되지 않습니다/);
});

test('isa_tenure_missing intentionally shares its sentence with the first tab — same fact, same words', () => {
  // 계약 8.11절: "첫 탭과 같은 문자열을 일부러 쓴다 — 같은 사실이고, 두 사전이
  // 같은 문장을 쓸 수 있어야 한다."
  const text = reverseNoticeMessage({ code: 'isa_tenure_missing', params: {} });
  assert.match(text, /경과연수/);
  assert.match(text, /0년/);
});
