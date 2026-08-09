import { test } from 'node:test';
import assert from 'node:assert/strict';
import { significantCount, indexAfterSignificant } from './dom.js';

/**
 * 커서 위치 계산 — 생년월일 순서가 뒤집히던 버그의 산수 부분.
 *
 * 값 대입으로 입력을 흉내 내는 테스트로는 이 부류가 잡히지 않는다(그때는 커서가
 * 존재하지 않는다). 그래서 **산수는 여기서**, **실제 타이핑은 브라우저 실측에서**
 * (`browser/input-caret.browser.mjs`) 나눠 잡는다. 둘 중 하나만으로는 부족하다.
 */

test('커서 앞의 유효문자 개수를 센다 — 구분자는 세지 않는다', () => {
  assert.equal(significantCount('19930', 5), 5);
  assert.equal(significantCount('1993-0', 6), 5);
  assert.equal(significantCount('1993-04-17', 10), 8);
  assert.equal(significantCount('1993-04-17', 5), 4, '하이픈 바로 뒤는 앞의 숫자 넷과 같은 개수다');
  assert.equal(significantCount('', 0), 0);
});

test('범위를 벗어난 인덱스를 받아도 값 안으로 접는다', () => {
  assert.equal(significantCount('1993', 99), 4);
  assert.equal(significantCount('1993', -3), 0);
  assert.equal(significantCount(null, 2), 0);
});

test('같은 개수의 유효문자 뒤 위치를 되돌려 준다', () => {
  // 이 한 줄이 버그의 핵심이다: `19930`(커서 5)이 `1993-0`이 되면 문자 인덱스 5는
  // `0` **앞**을 가리키고 다음 글자가 그 자리에 끼어들었다. 유효문자 5개 뒤는 6이다.
  assert.equal(indexAfterSignificant('1993-0', 5), 6);
  assert.equal(indexAfterSignificant('1993-04-17', 8), 10);
  assert.equal(indexAfterSignificant('1993-04-17', 4), 4, '넷 뒤는 하이픈 앞이다');
  assert.equal(indexAfterSignificant('1993-04-17', 5), 6);
  assert.equal(indexAfterSignificant('1993', 0), 0);
});

test('개수가 값보다 많으면 끝으로 보낸다 — 마스크가 잘라낸 경우', () => {
  // `maskBirthDate`는 8자리로 자른다. 아홉 번째 숫자를 친 직후가 이 경우다.
  assert.equal(indexAfterSignificant('1993-04-17', 12), 10);
  assert.equal(indexAfterSignificant('', 3), 0);
});

test('천 단위 쉼표에도 같은 규칙이 성립한다 — 마스크가 무엇을 끼워 넣든 상관없다', () => {
  // 금액 칸에 쉼표 마스킹이 들어오더라도 이 계산은 고칠 필요가 없다.
  assert.equal(significantCount('1234567', 4), 4);
  assert.equal(indexAfterSignificant('1,234,567', 4), 5);
});

test('한글·영문도 유효문자다 — 숫자 전용 규칙이 아니다', () => {
  assert.equal(significantCount('가나-다', 4), 3);
  assert.equal(indexAfterSignificant('가나-다', 3), 4);
});
