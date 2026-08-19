import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep } from './harness.mjs';

/**
 * 연금 역산기 탭 — 입력 → 세 블록 파이프라인의 실측(design-system 5.34~5.36절,
 * `screens.md` 14절, `requirements.md` 9.4절 AC-R).
 *
 * **"있다 ≠ 보인다"** — `contribution_scenario: null`일 때 `ContributionAmountBar`
 * 컴포넌트 자체가 DOM에 없어야 한다(AC-R6). `getBoundingClientRect`로 대체
 * 안내 줄이 **실제로 화면에 그려지는지**(0크기가 아닌지)까지 함께 잰다 —
 * `display:none`으로 숨긴 자리를 "없다"로 잘못 세지 않기 위해서다.
 */

let app;

function setValue(id, v) {
  return `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
}

const FILL_REVERSE_CORE = `(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('reverseBirthDate', '19800101');
  set('targetMonthlyIncome', '200');
  set('annuityStartDate', '20450101');
  set('payoutYears', '20');
})()`;

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
  await app.page.clickElement(`document.getElementById('tab-pension-reverse')`);
  await sleep(150);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('필수 넷을 채우면 별도 제출 없이 법정 사실 블록이 자동으로 나타난다(AC-R3)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(FILL_REVERSE_CORE);
  // `.statutory-fact-block-placeholder`(입력 부족 상태의 빈 카드 윤곽, 14.4.1절)도
  // `.statutory-fact-block` 클래스를 함께 쓴다 — 실제 내용이 채워졌는지는
  // 그 안에서만 나는 `.statutory-fact-amount`로 확인해야 한다(디바운스
  // 400ms가 끝나기 전에 잘못 통과하지 않도록).
  await page.waitFor(`!!document.querySelector('.statutory-fact-amount')`, { timeoutMs: 6000 });
  const box = await page.evaluate(`(() => { const r = document.querySelector('.statutory-fact-block').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
  assert.ok(box.width > 0 && box.height > 0, `법정 사실 블록이 실제로 화면에 그려진다: ${JSON.stringify(box)}`);
  const amount = await page.evaluate(`document.querySelector('.statutory-fact-amount').innerText`);
  assert.match(amount, /원/, '개시 시점 필요 최소 평가액이 금액으로 표시된다');
});

test('법정 사실 블록 안의 조문 칩은 최대 한 개다(게이트 5 D78 ①)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const chipCount = await page.evaluate(`document.querySelectorAll('.statutory-fact-block .law-chip').length`);
  assert.ok(chipCount <= 1, `법정 사실 블록의 칩 개수(${chipCount})가 1개를 넘는다 — "한 사실당 최대 한 칩" 위반`);
  // 표 안에는 칩이 전면 제거되어야 한다(D78 ①, 별도로 다시 확인).
  const tableChipCount = await page.evaluate(`document.querySelectorAll('.statutory-fact-table .law-chip').length`);
  assert.equal(tableChipCount, 0, '재원별 표 안에는 칩이 하나도 없어야 한다');
});

test('평균 수익률을 입력하지 않으면 ContributionAmountBar 자체가 DOM에 없고, 대체 한 줄만 실제로 보인다(AC-R6)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const state = await page.evaluate(`(() => {
    const bar = document.querySelector('.contribution-amount-bar');
    const fallback = document.querySelector('[data-key="contributionScenarioAbsent"]');
    const r = fallback ? fallback.getBoundingClientRect() : null;
    const fallbackBox = r ? { width: r.width, height: r.height } : null;
    return {
      barExists: !!bar,
      fallbackExists: !!fallback,
      fallbackVisible: fallbackBox ? fallbackBox.width > 0 && fallbackBox.height > 0 : false,
      fallbackText: fallback ? fallback.innerText : null,
    };
  })()`);
  assert.equal(state.barExists, false, 'contribution_scenario가 null이면 컴포넌트 자체가 없어야 한다 — 0원으로 그리면 위반이다');
  assert.equal(state.fallbackExists, true);
  assert.equal(state.fallbackVisible, true, '대체 안내 줄이 DOM에 있다는 사실만으로는 부족하다 — 실제로 화면에 그려져야 한다');
  assert.match(state.fallbackText, /입력하면/);
});

test('평균 수익률 입력란에는 기본값·자리표시자·힌트 숫자가 없다(AC-R6)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const field = await page.evaluate(`(() => {
    const el = document.getElementById('averageReturnRatePercent');
    return { value: el.value, placeholder: el.getAttribute('placeholder'), hasDefaultAttr: el.hasAttribute('value') && el.getAttribute('value') !== '' };
  })()`);
  assert.equal(field.value, '', '수익률 필드는 빈 문자열로 시작해야 한다');
  assert.equal(field.placeholder, null, '수익률 필드에 placeholder 속성이 있으면 위반이다(D77 판정 1)');
  assert.equal(field.hasDefaultAttr, false);
});

test('평균 수익률을 입력하면 ContributionAmountBar가 실제로 나타나고, 조건절이 도넛·표를 감싼다(AC-R15, D78 ③로 형태가 바뀌었다)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(setValue('averageReturnRatePercent', '5'));
  await page.waitFor(`!!document.querySelector('.contribution-amount-bar')`, { timeoutMs: 6000 });
  // D78 ③ — 이제 계좌별 행이 아니라 배분표 행(연금저축·IRP 두 계좌, ISA는
  // 아직 전환 계획을 답하지 않아 재원이 아니다)이다.
  const state = await page.evaluate(`(() => {
    const bar = document.querySelector('.contribution-amount-bar');
    const rows = [...bar.querySelectorAll('.account-table tbody tr')].filter((tr) => !tr.classList.contains('table-row-note'));
    const condition = bar.querySelector('.contribution-amount-condition')?.innerText ?? null;
    return { rowCount: rows.length, condition };
  })()`);
  assert.equal(state.rowCount, 2, '아직 ISA 전환 계획을 답하지 않아 연금저축·IRP 두 행만 있어야 한다');
  assert.match(state.condition ?? '', /연 5%가 유지된다면/, '조건절이 도넛·표를 감싸는 캡션 한 줄로 있어야 한다(D78 ③, design-system 5.35절 3번)');
});

test('계좌별 월 납입액 시나리오는 AccountDonut + 배분표다(게이트 5 D78 ③) — 막대 목록이 아니다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const state = await page.evaluate(`(() => {
    const bar = document.querySelector('.contribution-amount-bar');
    const donut = bar?.querySelector('.chart-donut');
    const donutBox = donut ? donut.getBoundingClientRect() : null;
    return {
      hasDonut: !!donut,
      donutVisible: donutBox ? donutBox.width > 0 && donutBox.height > 0 : false,
      hasTable: !!bar?.querySelector('.account-table'),
      hasOldBarRows: !!bar?.querySelector('.contribution-amount-track'),
    };
  })()`);
  assert.equal(state.hasDonut, true, 'AccountDonut이 실제로 그려져야 한다');
  assert.equal(state.donutVisible, true, '도넛이 0×0이 아니라 실제로 보여야 한다');
  assert.equal(state.hasTable, true, '도넛 옆(또는 아래) 배분표가 있어야 한다');
  assert.equal(state.hasOldBarRows, false, '옛 막대 목록(D78 ③ 이전 설계)이 다시 그려지면 위반이다');
});

test('수령 전략 비교는 항상 두 카드, ISA 잔액이 있으면 세 카드다(AC-R18)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const beforeIsa = await page.evaluate(`document.querySelectorAll('.withdrawal-strategy-card').length`);
  assert.equal(beforeIsa, 2, 'ISA 잔액이 0이면 두 카드만 있어야 한다');

  await page.clickElement(`document.getElementById('reverseIsaExists-true')`);
  await sleep(150);
  await page.evaluate(setValue('isaBalance', '300'));
  await sleep(500);
  const afterIsa = await page.evaluate(`document.querySelectorAll('.withdrawal-strategy-card').length`);
  assert.equal(afterIsa, 3, 'ISA 잔액이 0보다 크면 세 카드여야 한다');
});

test('수령 전략 카드 하나당 조문 칩은 최대 한 개다(게이트 5 D78 ①)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const counts = await page.evaluate(`[...document.querySelectorAll('.withdrawal-strategy-card')].map((c) => c.querySelectorAll('.law-chip').length)`);
  assert.equal(counts.length, 3, '지금은 ISA 카드까지 세 카드가 있어야 한다');
  for (const count of counts) assert.ok(count <= 1, `카드 하나에 칩이 ${count}개 있다 — "카드당 최대 한 칩" 위반`);
});

test('ISA 계좌 보유 여부가 "예"일 때만 전환 계획 토글이 나타난다(게이트 5 D78 ④, AC-R30)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 지금 ISA 계좌 보유 여부는 "예"다(앞선 시험들이 그렇게 남겨 두었다).
  const whileIsaExists = await page.evaluate(`(() => {
    const yes = document.getElementById('isaConversionPlanned-true');
    const no = document.getElementById('isaConversionPlanned-false');
    return {
      toggleExists: !!yes,
      // segmentToggle은 선택 상태를 'segment-option-selected' 클래스로 표시한다
      // (aria-checked는 el()이 boolean 속성 관례를 따라 false일 때
      // 속성 자체를 생략한다 — null도 "선택 안 됨"으로 읽어야 한다).
      yesSelected: yes?.classList.contains('segment-option-selected') ?? null,
      noSelected: no?.classList.contains('segment-option-selected') ?? null,
    };
  })()`);
  assert.equal(whileIsaExists.toggleExists, true, 'ISA가 있으면 전환 계획 토글이 보여야 한다');
  assert.equal(whileIsaExists.yesSelected, false, '"예"가 미리 선택돼 있으면 위반이다(AC-R30)');
  assert.equal(whileIsaExists.noSelected, false, '"아니오"도 미리 선택돼 있으면 안 된다 — 이 필드는 기본값이 없다(AC-R30)');

  await page.clickElement(`document.getElementById('reverseIsaExists-false')`);
  await sleep(150);
  const whileIsaAbsent = await page.evaluate(`!!document.getElementById('isaConversionPlanned-true')`);
  assert.equal(whileIsaAbsent, false, 'ISA 계좌 보유 여부가 "아니오"면 전환 계획 토글 자체가 없어야 한다');

  // 이후 시험을 위해 다시 켠다.
  await page.clickElement(`document.getElementById('reverseIsaExists-true')`);
  await sleep(150);
  await page.evaluate(setValue('isaBalance', '300'));
  await sleep(300);
});

test('ISA 계좌 보유 여부가 "아니오"면 ISA 잔액·경과연수·누적 납입액 입력란이 모두 없다(AC-R9)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.clickElement(`document.getElementById('reverseIsaExists-false')`);
  await sleep(150);
  const hidden = await page.evaluate(`(() => ({
    balance: !!document.getElementById('isaBalance'),
    years: !!document.getElementById('reverseIsaYearsSinceOpening'),
    cumulative: !!document.getElementById('isaCumulativeContribution'),
    conversion: !!document.getElementById('isaConversionPlanned-true'),
  }))()`);
  assert.deepEqual(hidden, { balance: false, years: false, cumulative: false, conversion: false });
});

test('개시일이 최소 개시 연령 미만이면 그 필드에 오류가 뜨고 법정 사실 블록은 사라진다(AC-R5)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 2020년생이 2021년에 개시하면 만 나이가 최소 개시 연령에 한참 못 미친다.
  await page.evaluate(setValue('reverseBirthDate', '20200101'));
  await page.evaluate(setValue('annuityStartDate', '20210101'));
  await sleep(700);
  const state = await page.evaluate(`(() => ({
    hasStatutoryAmount: !!document.querySelector('.statutory-fact-amount'),
    errorText: document.querySelector('.inline-alert-error p')?.innerText ?? null,
  }))()`);
  assert.equal(state.hasStatutoryAmount, false, '개시일이 최소 개시 연령 미만이면 법정 사실 블록이 나타나지 않아야 한다');
  assert.match(state.errorText ?? '', /최소 개시 연령/, '오류 문구가 화면에 보여야 한다');
  // 문구의 나이 숫자(예: "만 55세")는 화면 코드에 박은 것이 아니라 엔진 오류의
  // `params.minimum_age_years`를 그대로 옮긴 값이다(copy.js `ERROR_MESSAGE.
  // annuity_start_below_minimum_age`) — 문장에 숫자가 실제로 있다는 사실 자체가
  // 그 값이 어딘가에서 왔다는 증거다(하드코딩 여부는 코드 리뷰가 확인할 몫이다).
  assert.match(state.errorText ?? '', /만 \d+세/);

  // 이후 시험이 유효한 상태에서 시작하도록 되돌린다.
  await page.evaluate(FILL_REVERSE_CORE);
  await page.waitFor(`!!document.querySelector('.statutory-fact-amount')`, { timeoutMs: 6000 });
});

test('"절세계좌 계산기에 반영"은 계좌별 시나리오가 나온 뒤에만 나타나고, 누르면 월 납입 여력에 합계만 채운다(AC-R21·AC-R22)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await page.evaluate(FILL_REVERSE_CORE);
  await page.evaluate(setValue('averageReturnRatePercent', '5'));
  await page.waitFor(`!!document.querySelector('.reverse-prefill button')`, { timeoutMs: 6000 });

  await page.clickElement(`document.querySelector('.reverse-prefill button')`);
  await sleep(200);
  const state = await page.evaluate(`(() => ({
    hash: location.hash,
    monthlyCapacity: document.getElementById('monthlyCapacity').value,
    birthDateUntouched: document.getElementById('birthDate').value === '',
  }))()`);
  assert.equal(state.hash, '#calculator', '누르면 절세계좌 계산기 탭으로 전환된다');
  assert.ok(state.monthlyCapacity !== '' && state.monthlyCapacity !== '0', '월 납입 여력에 합계가 채워져야 한다');
  assert.equal(state.birthDateUntouched, true, '합계 외의 다른 필드(생년월일 등)는 건드리지 않는다');
});
