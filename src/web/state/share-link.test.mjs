import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_LINK_FIELDS,
  encodeShareFragment,
  encodeShareFragmentV1,
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

/**
 * [2026-08-23, D82 판정 3] v2가 실제로 다루는 필드 스물일곱 전부를 채운
 * "실사용에 가까운" 표본 — 길이 비교(v1 대비 몇 % 짧아졌는지)는 빈 폼이
 * 아니라 이 표본으로 재야 뜻이 있다(빈 폼은 v1도 짧아서 절감 폭이
 * 과장된다). `isaReturnRatePercent`에 소수점을 일부러 넣어 v2의 `.` 구분자
 * 이스케이프(값 안의 `.` → `%2E`)까지 이 표본 하나로 함께 잰다.
 */
function fullSampleForm() {
  return {
    ...initialForm(),
    birthDate: '1985-06-15',
    currentSalary: '6000',
    hasNonWageIncome: true,
    globalIncomeAmount: '2000',
    priorSalaryEnabled: true,
    priorSalary: '5800',
    annuityStarted: false,
    declaredYouth: false,
    fundUseHorizon: 'before_pension_age',
    monthlyCapacity: '200',
    annuitySavingsYtd: '100',
    retirementPensionYtd: '50',
    isaExists: true,
    isaAccountType: 'general',
    isaCumulative: '3000',
    isaYtd: '500',
    isaYearsSinceOpening: '2',
    isaFinancialIncomeTaxpayer: 'no',
    isaTransferEnabled: true,
    isaTransferAmount: '1000',
    isaTransferDestination: 'retirement_pension',
    isaTransferPriorApplied: '200',
    isaReturnEnabled: true,
    isaReturnRatePercent: '4.25',
    isaIncomeCharacter: 'interest_dividend',
    isaSettlementYears: '3',
    isaLossAmount: '0',
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

test('버전이 다르면 조용히 오독하지 않고 version_mismatch로 명시로 실패한다(v1 경로)', () => {
  // v: 1이 아닌 다른 버전으로 수동 조립 — 옛/미래 버전 링크를 흉내낸다.
  // "v2."로 시작하지 않으므로 v1 경로를 탄다(decodeShareFragment의 접두 분기).
  const payload = { v: 999, birthDate: '1993-04-17' };
  const fragment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const result = decodeShareFragment(fragment);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'version_mismatch');
});

/**
 * [2026-08-23, D82 판정 3] v2도 같은 방패를 진다 — `SHARE_LINK_FIELDS`
 * 개수와 세그먼트 개수가 다르면(스키마가 바뀌었거나 링크가 손상됐거나)
 * 엉뚱한 자리에 값을 꽂아 읽는 대신 명시로 거절한다.
 */
test('D82 판정 3 — v2 프래그먼트도 세그먼트 개수가 SHARE_LINK_FIELDS와 다르면 version_mismatch다', () => {
  const result = decodeShareFragment('v2.a.b.c');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'version_mismatch');
});

/**
 * [2026-08-23, D82 판정 3] **v1 하위 호환 — 이미 공유된 옛 링크가 계속
 * 열린다.** `encodeShareFragmentV1`로 옛 형식 그대로 프래그먼트를 만들고,
 * 지금의(v2를 내는) `decodeShareFragment` 하나로 그것을 읽는다 — 인코더가
 * 바뀌어도 디코더는 두 판 다 안다는 것을 직접 확인한다.
 */
test('D82 판정 3 — v1로 인코드한 옛 링크를 지금의 decodeShareFragment가 그대로 읽는다(하위 호환)', () => {
  const form = fullSampleForm();
  const v1Fragment = encodeShareFragmentV1(form);
  assert.ok(!v1Fragment.startsWith('v2.'), 'v1 프래그먼트가 우연히 v2 접두와 겹치면 이 시험 자체가 뜻을 잃는다');
  const result = decodeShareFragment(v1Fragment);
  assert.equal(result.ok, true, 'v1 프래그먼트를 지금의 디코더가 열지 못했다');
  for (const key of SHARE_LINK_FIELDS) {
    assert.deepEqual(result.form[key], form[key] ?? null, `v1 하위 호환 — 필드 ${key}가 달라졌습니다`);
  }
});

/**
 * [2026-08-23, D82 판정 3] v2가 v1보다 실제로 짧다 — 인코딩 밀도가 목적인
 * 회차라 이 사실 자체를 회귀 방지선으로 고정한다. 절반 이상 줄어드는지까지
 * 재는 이유 — "구분자만 바꾼 정도"가 아니라 "키 이름을 통째로 버렸다"는
 * 실질이 있는지 판별력 있게 잰다(같은 표본, 절반 근처에서만 걸리는 문턱이
 * 아니다 — 실측 84%대).
 */
test('D82 판정 3 — 같은 입력에서 v2 프래그먼트가 v1보다 절반 이상 짧다', () => {
  const form = fullSampleForm();
  const v1Fragment = encodeShareFragmentV1(form);
  const v2Fragment = encodeShareFragment(form);
  assert.ok(
    v2Fragment.length < v1Fragment.length * 0.5,
    `v2(${v2Fragment.length}자)가 v1(${v1Fragment.length}자)의 절반보다 길다 — 인코딩 밀도 개선이 실질을 잃었다`,
  );
});

/**
 * [2026-08-23, D82 판정 3] `null`(아직 안 고름)과 `''`(빈 문자열)은 다른
 * 값이다 — `initialForm()`이 그렇게 정의한다(열거값 물음 셋은 `null`,
 * 금액·날짜는 `''`). v2의 빈 슬롯이 필드마다 올바른 쪽으로 복원되는지
 * 직접 확인한다 — 하나로 뭉치면 라디오 그룹이 "아무것도 안 고름"과 "빈
 * 문자열을 골랐다"를 구분 못 하게 된다.
 */
test('D82 판정 3 — v2 빈 슬롯은 열거값 물음 셋(fundUseHorizon 등)은 null로, 나머지는 빈 문자열로 되돌아간다', () => {
  const form = initialForm();
  const fragment = encodeShareFragment(form);
  const result = decodeShareFragment(fragment);
  assert.equal(result.ok, true);
  assert.equal(result.form.fundUseHorizon, null);
  assert.equal(result.form.isaFinancialIncomeTaxpayer, null);
  assert.equal(result.form.isaIncomeCharacter, null);
  assert.equal(result.form.birthDate, '');
  assert.equal(result.form.currentSalary, '');
});

/**
 * [2026-08-23, D82 판정 3] v2의 유일한 소수점 필드(`isaReturnRatePercent`,
 * 예: "4.25")가 구분자(`.`)와 부딪히지 않는다 — 이스케이프
 * (`.`→`%2E`)가 실제로 값을 지키는지, 그리고 그 필드 **뒤**에 오는
 * 나머지 필드들이 자리가 밀리지 않는지(`isaIncomeCharacter` 등) 함께 잰다.
 */
test('D82 판정 3 — isaReturnRatePercent의 소수점이 v2 구분자와 부딪히지 않는다', () => {
  const form = { ...fullSampleForm(), isaReturnRatePercent: '4.25' };
  const fragment = encodeShareFragment(form);
  const result = decodeShareFragment(fragment);
  assert.equal(result.ok, true);
  assert.equal(result.form.isaReturnRatePercent, '4.25');
  assert.equal(result.form.isaIncomeCharacter, 'interest_dividend', '소수점 뒤 필드가 자리를 밀렸다');
  assert.equal(result.form.isaSettlementYears, '3', '소수점 뒤 필드가 자리를 밀렸다');
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

/**
 * [2026-08-23, D82 판정 3 — 뒤집힌 기대값] v1은 base64url이 알파벳 전부였다
 * ([A-Za-z0-9_-]) — v2는 위치 기반 표기라 구분자(`.`)와 드문 이스케이프
 * (`%`)가 늘었다. **지우지 않고 좁힌다** — RFC 3986 기준 URL 프래그먼트에
 * 그대로 써도 되는 문자(영숫자·`_`·`-`·`.`·`%`)만 쓰는지, 그리고 D74가
 * 원래 막으려던 "쿼리로 격하될 만한 특수문자"(`=`·`+`·`/`·공백)는 여전히
 * 하나도 없는지를 잰다 — 안전성의 실질은 그대로, 알파벳만 v2에 맞게
 * 넓어졌다.
 */
test('D82 판정 3 — buildShareUrl이 낸 프래그먼트는 URL 프래그먼트에 그대로 써도 되는 문자만 쓴다 — 쿼리로 격하될 만한 특수문자(=, +, /, 공백)가 없다', () => {
  const form = fullSampleForm();
  const fragment = encodeShareFragment(form);
  assert.match(fragment, /^[A-Za-z0-9_.%-]+$/, `프래그먼트에 URL 이스케이프가 필요한 문자가 있습니다: ${fragment}`);
  assert.doesNotMatch(fragment, /[=+/ ]/, `프래그먼트에 쿼리로 격하될 만한 문자가 있습니다: ${fragment}`);
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
