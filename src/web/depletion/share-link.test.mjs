import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeDepletionShareFragment,
  decodeDepletionShareFragment,
  isDepletionShareFragment,
  buildDepletionShareUrl,
  readDepletionShareFragmentFromLocation,
} from './share-link.js';
import { DEPLETION_SLIDER_PARAMS } from './constants.js';

const DEFAULTS = Object.fromEntries(DEPLETION_SLIDER_PARAMS.map((p) => [p.id, p.default]));

test('왕복 — 인코드한 값을 디코드하면 원래 값과 같다(기본값)', () => {
  const fragment = encodeDepletionShareFragment(DEFAULTS);
  const decoded = decodeDepletionShareFragment(fragment);
  assert.equal(decoded.ok, true);
  for (const p of DEPLETION_SLIDER_PARAMS) {
    assert.equal(decoded.values[p.id], DEFAULTS[p.id], `${p.id}이 왕복하며 달라졌다`);
  }
});

test('왕복 — 슬라이더를 조작한 값도 그대로 복원된다', () => {
  const values = { ...DEFAULTS, ror: 2, rate: 22, age: 70 };
  const fragment = encodeDepletionShareFragment(values);
  const decoded = decodeDepletionShareFragment(fragment);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.values.ror, 2);
  assert.equal(decoded.values.rate, 22);
  assert.equal(decoded.values.age, 70);
});

test('버전 필드 — dep1. 접두를 쓰고, 계산기2(v2.)·탭 id와 절대 겹치지 않는다', () => {
  const fragment = encodeDepletionShareFragment(DEFAULTS);
  assert.ok(fragment.startsWith('dep1.'), `접두가 dep1.이 아니다: ${fragment}`);
  assert.ok(!fragment.startsWith('v2.'), '계산기2 v2 접두와 겹친다');
  assert.equal(isDepletionShareFragment('calc2'), false, '탭 id를 이 탭의 공유 링크로 오판했다');
  assert.equal(isDepletionShareFragment('pension-depletion'), false);
  assert.equal(isDepletionShareFragment('v2.1.2.3'), false, '계산기2 v2 링크를 이 탭의 공유 링크로 오판했다');
  assert.equal(isDepletionShareFragment(fragment), true);
});

test('필드 개수가 다르면(스키마 변경) version_mismatch로 거절한다', () => {
  const decoded = decodeDepletionShareFragment('dep1.1,2,3');
  assert.equal(decoded.ok, false);
  assert.equal(decoded.reason, 'version_mismatch');
});

test('숫자로 못 읽는 값이 섞이면 parse_failed로 거절한다', () => {
  const bad = 'dep1.' + DEPLETION_SLIDER_PARAMS.map(() => 'NaN').join(',');
  const decoded = decodeDepletionShareFragment(bad);
  assert.equal(decoded.ok, false);
  assert.equal(decoded.reason, 'parse_failed');
});

test('범위 밖 값은 링크를 죽이지 않고 그 슬라이더의 min~max로 자른다', () => {
  const ror = DEPLETION_SLIDER_PARAMS.find((p) => p.id === 'ror');
  const values = { ...DEFAULTS, ror: ror.max + 100 };
  const decoded = decodeDepletionShareFragment(encodeDepletionShareFragment(values));
  assert.equal(decoded.ok, true);
  assert.equal(decoded.values.ror, ror.max, '범위를 넘는 값이 잘리지 않았다');
});

test('dep1.이 아닌 프래그먼트는 decode_failed로 거절한다', () => {
  assert.equal(decodeDepletionShareFragment('v2.1.2.3').ok, false);
  assert.equal(decodeDepletionShareFragment('').ok, false);
  assert.equal(decodeDepletionShareFragment('calc2').ok, false);
});

test('buildDepletionShareUrl — 쿼리 문자열이 없고, 프래그먼트에만 값이 실린다', () => {
  const url = buildDepletionShareUrl(DEFAULTS, { locationLike: { origin: 'https://example.com', pathname: '/app/' } });
  assert.ok(!url.includes('?'), `URL에 쿼리 문자열이 있다: ${url}`);
  assert.ok(url.includes('#dep1.'), `URL에 프래그먼트가 없다: ${url}`);
  assert.equal(url.startsWith('https://example.com/app/#dep1.'), true);
});

test('readDepletionShareFragmentFromLocation — 이 탭의 링크가 아니면 null', () => {
  assert.equal(readDepletionShareFragmentFromLocation({ hash: '' }), null);
  assert.equal(readDepletionShareFragmentFromLocation({ hash: '#' }), null);
  assert.equal(readDepletionShareFragmentFromLocation({ hash: '#calc2' }), null);
  assert.equal(readDepletionShareFragmentFromLocation({ hash: '#v2.1.2.3' }), null);
});

test('readDepletionShareFragmentFromLocation — 이 탭의 링크면 디코드한 값을 낸다', () => {
  const fragment = encodeDepletionShareFragment(DEFAULTS);
  const result = readDepletionShareFragmentFromLocation({ hash: `#${fragment}` });
  assert.equal(result.ok, true);
  assert.equal(result.values.ror, DEFAULTS.ror);
});
