import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVERSE_NOTICE, REVERSE_ASSUMPTION } from '../engine/constants.mjs';
import { reverseNoticeMessage, reverseAssumptionMessage } from './reverse-copy.js';

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

test('isa_tenure_missing intentionally shares its sentence with the first tab — same fact, same words', () => {
  // 계약 8.11절: "첫 탭과 같은 문자열을 일부러 쓴다 — 같은 사실이고, 두 사전이
  // 같은 문장을 쓸 수 있어야 한다."
  const text = reverseNoticeMessage({ code: 'isa_tenure_missing', params: {} });
  assert.match(text, /경과연수/);
  assert.match(text, /0년/);
});
