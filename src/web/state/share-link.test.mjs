import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_LINK_FIELDS,
  encodeShareFragment,
  decodeShareFragment,
  buildShareUrl,
  readShareFragmentFromLocation,
} from './share-link.js';
import { initialForm } from './store.js';

function sampleForm() {
  return {
    ...initialForm(),
    birthDate: '1993-04-17',
    currentSalary: '4000',
    hasNonWageIncome: false,
    monthlyCapacity: '150',
    isaExists: true,
    isaAccountType: 'general',
  };
}

test('D74 7번 — 왕복(encode→decode)이 SHARE_LINK_FIELDS 전부를 그대로 복원한다', () => {
  const form = sampleForm();
  const fragment = encodeShareFragment(form);
  const result = decodeShareFragment(fragment);
  assert.equal(result.ok, true);
  for (const key of SHARE_LINK_FIELDS) {
    assert.deepEqual(result.form[key], form[key] ?? null, `필드 ${key}가 왕복 후 달라졌습니다`);
  }
});

test('버전이 다르면 조용히 오독하지 않고 version_mismatch로 명시로 실패한다', () => {
  // v: 1이 아닌 다른 버전으로 수동 조립 — 옛/미래 버전 링크를 흉내낸다.
  const payload = { v: 999, birthDate: '1993-04-17' };
  const fragment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const result = decodeShareFragment(fragment);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'version_mismatch');
});

test('깨진 프래그먼트(base64url이 아닌 임의 문자열)는 decode_failed 또는 parse_failed로 실패한다 — 예외를 던지지 않는다', () => {
  const result = decodeShareFragment('!!!not-a-valid-fragment!!!');
  assert.equal(result.ok, false);
  assert.ok(['decode_failed', 'parse_failed'].includes(result.reason), `예상 밖 reason: ${result.reason}`);
});

test('빈 프래그먼트는 empty로 실패한다', () => {
  const result = decodeShareFragment('');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty');
});

test('D74 — buildShareUrl은 프래그먼트(#)에 싣는다. 쿼리 문자열(?)이 어디에도 없다', () => {
  const form = sampleForm();
  const locationLike = { origin: 'https://jasony93.github.io', pathname: '/pension-allocator/' };
  const url = buildShareUrl(form, { locationLike });
  assert.ok(url.includes('#'), 'URL에 #이 없습니다');
  assert.ok(!url.includes('?'), `URL에 물음표(쿼리 문자열)가 있습니다: ${url}`);
  assert.equal(url.indexOf('#'), url.lastIndexOf('#'), '#이 하나여야 한다');
  const [base, fragment] = url.split('#');
  assert.equal(base, 'https://jasony93.github.io/pension-allocator/');
  assert.ok(fragment.length > 0, '프래그먼트가 비어 있습니다');
  // 프래그먼트 자체가 실제로 디코드 가능한지도 확인한다 — URL만 그럴듯하고
  // 내용이 깨진 회귀를 잡는다.
  const decoded = decodeShareFragment(fragment);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.form.birthDate, form.birthDate);
});

test('buildShareUrl이 낸 프래그먼트는 base64url 문자 집합([A-Za-z0-9_-])만 쓴다 — 쿼리로 격하될 만한 특수문자(=, +, /)가 없다', () => {
  const form = sampleForm();
  const fragment = encodeShareFragment(form);
  assert.match(fragment, /^[A-Za-z0-9_-]+$/, `프래그먼트에 URL 이스케이프가 필요한 문자가 있습니다: ${fragment}`);
});

test('readShareFragmentFromLocation — 해시가 없으면(일반 방문) null이다 — "잘못된 링크"와 구분된다', () => {
  assert.equal(readShareFragmentFromLocation({ hash: '' }), null);
  assert.equal(readShareFragmentFromLocation({ hash: '#' }), null);
});

test('readShareFragmentFromLocation — 해시가 있으면 decodeShareFragment와 같은 결과를 낸다', () => {
  const form = sampleForm();
  const fragment = encodeShareFragment(form);
  const result = readShareFragmentFromLocation({ hash: `#${fragment}` });
  assert.equal(result.ok, true);
  assert.equal(result.form.birthDate, form.birthDate);
});

test('SHARE_LINK_FIELDS는 initialForm()이 아는 키만 담는다 — 존재하지 않는 필드를 실어 나르지 않는다', () => {
  const form = initialForm();
  for (const key of SHARE_LINK_FIELDS) {
    assert.ok(key in form, `SHARE_LINK_FIELDS의 "${key}"가 initialForm()에 없습니다 — 이름이 어긋났습니다`);
  }
});
