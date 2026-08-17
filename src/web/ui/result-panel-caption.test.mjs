import { test } from 'node:test';
import assert from 'node:assert/strict';

import { amountCardBaseCaption } from './result-panel.js';
import { TAX_CAP_ESTIMATE_NOTE } from '../copy.js';

/**
 * 관리자 지시(2026-08-14) 5번 — `amountCard`의 `compactCaption` 옵션이 예시
 * 전용 축약이고, 사용자 자신의 결과(기본값)는 손대지 않았는지를 DOM 없이
 * 잠근다(`amountCardBaseCaption`은 순수 함수 — `result-panel.js` 머리말 참고).
 *
 * **D40·D61 회귀 방지가 이 파일의 목적이다.** `TAX_CAP_ESTIMATE_NOTE`는
 * 사용자 자신의 결과에서 "언제나" 붙어야 하는 문장이다 — 소유자가 세
 * 회차에 걸쳐 지운 것은 다른 문구(성격·자격 배너, `LimitNote`)였지 이
 * 문장이 아니다. 예시 전용 축약(`compactCaption: true`)을 추가하면서 실수로
 * 기본값까지 축약해 버리는 회귀를 이 테스트가 즉시 잡는다.
 */

const scenario2026 = { ruleset: { tax_year: 2026 } };
const scenario2027 = { ruleset: { tax_year: 2027 } };

test('amountCardBaseCaption — 옵션을 생략하면(사용자 자신의 결과) TAX_CAP_ESTIMATE_NOTE가 언제나 있다', () => {
  const caption = amountCardBaseCaption(scenario2026);
  assert.ok(caption.includes(TAX_CAP_ESTIMATE_NOTE), `기본 캡션에 TAX_CAP_ESTIMATE_NOTE가 없다: "${caption}"`);
  assert.ok(caption.includes('국세 + 개인지방소득세 합산'));
  assert.ok(caption.includes('다른 소득공제 미반영'));
  assert.ok(caption.includes('2026 과세연도 기준'));
});

test('amountCardBaseCaption — compactCaption: false를 명시해도 같은 결과다(기본값과 동치)', () => {
  assert.equal(amountCardBaseCaption(scenario2026, { compactCaption: false }), amountCardBaseCaption(scenario2026));
});

test('amountCardBaseCaption — compactCaption: true(예시 전용)일 때만 TAX_CAP_ESTIMATE_NOTE가 빠진다', () => {
  const caption = amountCardBaseCaption(scenario2026, { compactCaption: true });
  assert.equal(caption, '2026 과세연도 기준');
  assert.ok(!caption.includes(TAX_CAP_ESTIMATE_NOTE), '예시 캡션에 TAX_CAP_ESTIMATE_NOTE가 남아 있다');
  assert.ok(!caption.includes('국세 + 개인지방소득세 합산'));
  assert.ok(!caption.includes('다른 소득공제 미반영'));
});

test('amountCardBaseCaption — 과세연도는 scenario.ruleset.tax_year를 그대로 읽는다(하드코딩 아님)', () => {
  assert.ok(amountCardBaseCaption(scenario2027, { compactCaption: true }).includes('2027'));
  assert.ok(amountCardBaseCaption(scenario2027).includes('2027'));
});
