/**
 * 연금 역산기 탭의 입력 패널. `screens.md` 14.2절 — 첫 탭과 같은 컴포넌트
 * 언어(`numberField`·`percentField`·`yearsField`·`segmentToggle`·
 * `conditionalGroup`·`BirthDateField`), 단일 폼 + 조건부 펼침(위저드 아님,
 * AC-R4). `requirements.md` 9.1절(2026-08-19 확정)의 조건부 노출 구조를
 * 그대로 옮긴다 — ISA 세 항목은 「ISA 계좌 보유 여부」라는 **명시 질문**
 * 뒤에서만 함께 나타난다(AC-R9, 잔액 금액에서 추론하지 않는다).
 */

import { el } from './dom.js';
import { iconProfile, iconBank, iconChart } from './icons.js';
import { openConfirm } from './modal.js';
import {
  numberField,
  yearsField,
  segmentToggle,
  groupTitleNode,
  conditionalGroup,
  maskBirthDate,
} from './input-panel.js';
import {
  RESET_CONFIRM_TITLE,
  RESET_CONFIRM_BODY,
  RESET_CONFIRM_ACCEPT,
  RESET_CONFIRM_CANCEL,
} from '../copy.js';
import {
  ISA_CONVERSION_LABEL,
  ISA_CONVERSION_NOT_DECLARED_NOTE,
  isaConversionYesEffectCaption,
} from '../reverse-copy.js';

// 첫 탭의 `input-panel.js`도 같은 이름의 헬퍼를 내보낸다 — 배포 빌드
// (`scripts/build.mjs`)가 모든 모듈을 한 스코프로 합치므로 이름이 겹치면
// 안 된다. 이 파일의 것은 더 단순한(조건부 필수 표시가 없는) 변형이라
// 굳이 재사용하지 않고 이름만 갈라 둔다.
function reverseFieldError(errors, key) {
  const e = errors[key];
  return e ? e.message : null;
}

/**
 * 연금 개시일 — `BirthDateField`(design-system 5.25절)와 같은 마스킹·자동완성
 * 금지 규약을 물려받는다(14.2절 규약 1). **"모름" 선택지는 두지 않는다** —
 * 반드시 아는 값을 사용자가 스스로 정하는 계획 값이기 때문이다.
 */
function annuityStartDateField({ value, error, onInput, onBlur, renderGuard }) {
  const inputEl = el('input', {
    id: 'annuityStartDate',
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    placeholder: 'YYYY-MM-DD',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? 'annuityStartDate-error' : 'annuityStartDate-help',
    oninput: (e) => onInput(maskBirthDate(e.target.value)),
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
  });
  return el('div', { class: 'field' }, [
    el('label', { for: 'annuityStartDate', class: 'field-label' }, ['연금 개시일']),
    el('div', { class: 'field-control' }, [inputEl]),
    error
      ? el('p', { id: 'annuityStartDate-error', class: 'field-error-msg', role: 'alert' }, [error])
      : el('p', { id: 'annuityStartDate-help', class: 'field-help' }, ['이미 수령 중이면 과거 날짜도 넣을 수 있습니다.']),
  ]);
}

/**
 * 평균 수익률(연) — D77 판정 1과 같은 방어선. **기본값·자리표시자·힌트 문구가
 * 없다**(AC-R6) — `percentField`를 그대로 쓰지 않는 이유는 다중 캡션 줄을
 * 위해서일 뿐, 필드 자체(입력·접미사)는 첫 탭의 ISA 수익률 필드와 동일한
 * 마크업이다.
 */
function averageReturnRateField({ value, error, onInput, onBlur, renderGuard }) {
  const inputEl = el('input', {
    id: 'averageReturnRatePercent',
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'decimal',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? 'averageReturnRatePercent-error' : 'averageReturnRatePercent-help',
    oninput: (e) => onInput(e.target.value),
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
  });
  return el('div', { class: 'field' }, [
    el('label', { for: 'averageReturnRatePercent', class: 'field-label' }, ['평균 수익률(연)']),
    el('div', { class: 'field-control' }, [inputEl, el('span', { class: 'field-suffix' }, ['%'])]),
    error
      ? el('p', { id: 'averageReturnRatePercent-error', class: 'field-error-msg', role: 'alert' }, [error])
      : el('div', { id: 'averageReturnRatePercent-help' }, [
          el('p', { class: 'field-help' }, ['이 값은 계좌별 월 납입액에만 씁니다.']),
          el('p', { class: 'field-help' }, ['연금수령한도 판정에는 쓰이지 않습니다.']),
          el('p', { class: 'field-help' }, ['미입력이어도 법정 사실은 표시됩니다.']),
        ]),
  ]);
}

export function renderReverseInputPanel({ state, store, renderGuard }) {
  const { form, validation } = state;
  const errors = validation.errors;

  // ---- ① 언제, 얼마를 받고 싶은가 -----------------------------------------
  const birthField = (() => {
    const error = reverseFieldError(errors, 'birthDate');
    const inputEl = el('input', {
      id: 'reverseBirthDate',
      class: `field-input${error ? ' field-input-error' : ''}`,
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      placeholder: 'YYYY-MM-DD',
      value: form.birthDate,
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? 'reverseBirthDate-error' : 'reverseBirthDate-help',
      oninput: (e) => store.setField('birthDate', maskBirthDate(e.target.value)),
      onblur: () => {
        if (!renderGuard?.active) store.flush();
      },
    });
    return el('div', { class: 'field' }, [
      el('label', { for: 'reverseBirthDate', class: 'field-label' }, ['생년월일']),
      el('div', { class: 'field-control' }, [inputEl]),
      error
        ? el('p', { id: 'reverseBirthDate-error', class: 'field-error-msg', role: 'alert' }, [error])
        : el('p', { id: 'reverseBirthDate-help', class: 'field-help' }, ['만 나이 계산과 최소 개시 연령 확인에만 씁니다.']),
    ]);
  })();

  const targetField = numberField({
    id: 'targetMonthlyIncome',
    label: '원하는 연금 수령액(월)',
    value: form.targetMonthlyIncome,
    error: reverseFieldError(errors, 'targetMonthlyIncome'),
    onInput: (v) => store.setField('targetMonthlyIncome', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  const startDateField = annuityStartDateField({
    value: form.annuityStartDate,
    // AC-R5 — 형식 오류든(클라이언트) 최소 개시 연령 미달이든(엔진) 이 필드에 표시한다.
    error: reverseFieldError(errors, 'annuityStartDate') ?? (state.engineFieldError?.field === 'annuityStartDate' ? state.engineFieldError.message : null),
    onInput: (v) => store.setField('annuityStartDate', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  const payoutYearsField = yearsField({
    id: 'payoutYears',
    label: '연금 필요 기간',
    value: form.payoutYears,
    help: '짧을수록 연금수령한도가 먼저 걸릴 수 있습니다.',
    error: reverseFieldError(errors, 'payoutYears'),
    onInput: (v) => store.setField('payoutYears', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  const groupOne = el('section', { class: 'input-group' }, [
    groupTitleNode(iconProfile, '① 언제, 얼마를 받고 싶은가'),
    birthField,
    targetField,
    startDateField,
    payoutYearsField,
  ]);

  // ---- ② 계좌 현황과 예상 수익률 -------------------------------------------
  const annuitySavingsField = numberField({
    id: 'annuitySavingsBalance',
    label: '연금저축 (현재 잔액)',
    value: form.annuitySavingsBalance,
    error: reverseFieldError(errors, 'annuitySavingsBalance'),
    onInput: (v) => store.setField('annuitySavingsBalance', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const retirementPensionField = numberField({
    id: 'retirementPensionBalance',
    label: 'IRP (현재 잔액)',
    value: form.retirementPensionBalance,
    error: reverseFieldError(errors, 'retirementPensionBalance'),
    onInput: (v) => store.setField('retirementPensionBalance', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  // AC-R9(2026-08-19 확정) — 명시 질문. 잔액 금액에서 추론하지 않는다.
  const isaExistsToggle = segmentToggle({
    id: 'reverseIsaExists',
    label: 'ISA 계좌가 있나요?',
    value: form.isaExists,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('isaExists', v, { immediate: true }),
  });
  const isaBalanceField = numberField({
    id: 'isaBalance',
    label: 'ISA (현재 잔액)',
    value: form.isaBalance,
    error: reverseFieldError(errors, 'isaBalance'),
    onInput: (v) => store.setField('isaBalance', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const isaYearsSinceOpeningField = yearsField({
    // DOM id는 첫 탭의 같은 이름 필드(`isaYearsSinceOpening`)와 겹치지 않게
    // 접두어를 붙인다 — 두 탭의 패널이 동시에 마운트되어(2.1.2절 (3)) 같은
    // 문서 안에 함께 있으므로 id가 겹치면 `document.getElementById`가 첫
    // 탭의 노드만 찾게 된다. 폼 필드 이름(`isaYearsSinceOpening`, `onInput`
    // 아래)은 이 탭의 store 안에서만 쓰이므로 겹쳐도 되지만 DOM id는 아니다.
    id: 'reverseIsaYearsSinceOpening',
    label: 'ISA 가입경과연수',
    value: form.isaYearsSinceOpening,
    help: '비워 두면 0년(경과 미달)으로 계산합니다.',
    error: reverseFieldError(errors, 'isaYearsSinceOpening'),
    onInput: (v) => store.setField('isaYearsSinceOpening', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  // AC-R29(2026-08-19 신설) — 미입력이면 해지 의제 판정을 내지 않는다.
  const isaCumulativeField = numberField({
    id: 'isaCumulativeContribution',
    label: 'ISA 누적 납입액',
    value: form.isaCumulativeContribution,
    help: '비워 두면 가입 3년 경과 후 원금 초과 인출의 계약 해지 의제 여부를 판정하지 않습니다.',
    error: reverseFieldError(errors, 'isaCumulativeContribution'),
    onInput: (v) => store.setField('isaCumulativeContribution', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  // 게이트 5 D78 ④, AC-R30 — 명시 질문이고 **기본값이 없는 예외적인 2택
  // 라디오**다(14.2절 규약 8). "ISA 계좌가 있나요? = 예"가 노출 조건이고,
  // 잔액 값에서 추론하지 않는다.
  const isaConversionToggle = segmentToggle({
    id: 'isaConversionPlanned',
    label: ISA_CONVERSION_LABEL,
    value: form.isaConversionPlanned,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('isaConversionPlanned', v, { immediate: true }),
  });
  // 아무것도 고르지 않았을 때만 — "아니오"와 계산상 같은 수를 내지만
  // 사용자가 답한 것이 아니라는 사실을 알린다(AC-R30, 14.2절 규약 8).
  const isaConversionUndeclaredNote =
    form.isaExists && form.isaConversionPlanned === null
      ? el('div', { class: 'inline-alert inline-alert-info', role: 'status' }, [
          el('p', {}, [ISA_CONVERSION_NOT_DECLARED_NOTE]),
        ])
      : null;
  // "예"일 때의 효과 고지 — 이미 계산된 결과가 있으면 실제 문턱 금액을
  // 옮기고, 없으면 숫자 없이 사실만 말한다(세법 수치를 화면 코드에
  // 박지 않는다).
  const isaConversionYesNote =
    form.isaExists && form.isaConversionPlanned === true
      ? el('p', { class: 'field-help' }, [
          isaConversionYesEffectCaption(state.result?.statutory_facts?.threshold_consumption?.threshold_krw ?? null),
        ])
      : null;

  const isaBlock = conditionalGroup(
    form.isaExists,
    [isaBalanceField, isaYearsSinceOpeningField, isaCumulativeField, isaConversionToggle, isaConversionUndeclaredNote, isaConversionYesNote],
    'reverseIsaBlock',
  );

  const returnRateField = averageReturnRateField({
    value: form.averageReturnRatePercent,
    error: reverseFieldError(errors, 'averageReturnRatePercent'),
    onInput: (v) => store.setField('averageReturnRatePercent', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  const groupTwo = el('section', { class: 'input-group' }, [
    groupTitleNode(iconBank, '② 계좌 현황과 예상 수익률'),
    annuitySavingsField,
    retirementPensionField,
    isaExistsToggle,
    isaBlock,
    returnRateField,
  ]);

  // ---- ③ 결과를 더 정확하게 하는 선택 입력 --------------------------------
  const deferredToggle = segmentToggle({
    id: 'deferredRetirementPresent',
    label: '퇴직금(이연퇴직소득) 재원이 있나요?',
    value: form.deferredRetirementPresent,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('deferredRetirementPresent', v, { immediate: true }),
  });
  const deferredAmountField = numberField({
    id: 'deferredRetirementAmount',
    label: '퇴직금(이연퇴직소득) 금액',
    value: form.deferredRetirementAmount,
    error: reverseFieldError(errors, 'deferredRetirementAmount'),
    onInput: (v) => store.setField('deferredRetirementAmount', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const deferredGroup = conditionalGroup(form.deferredRetirementPresent, [deferredAmountField], 'deferredGroup');

  const publicPensionToggle = segmentToggle({
    id: 'publicPensionPlan',
    label: '국민연금 등 공적연금 수령 계획',
    value: form.publicPensionPlan,
    options: [
      { value: 'no', label: '아니오' },
      { value: 'yes', label: '예' },
      { value: 'unknown', label: '모름' },
    ],
    onChange: (v) => store.setField('publicPensionPlan', v, { immediate: true }),
  });
  const publicPensionField = numberField({
    id: 'publicPensionExpectedMonthly',
    label: '국민연금 등 공적연금 예상 월액',
    value: form.publicPensionExpectedMonthly,
    error: reverseFieldError(errors, 'publicPensionExpectedMonthly'),
    onInput: (v) => store.setField('publicPensionExpectedMonthly', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const publicPensionSourceGuide = el('div', { class: 'field-help' }, [
    el('p', {}, ['▸ 이 값을 어디서 찾나요']),
    el('p', {}, ['국민연금공단 예상연금액 조회 결과를 그대로 입력하세요.']),
  ]);
  const publicPensionGroup = conditionalGroup(
    form.publicPensionPlan === 'yes',
    [publicPensionField, publicPensionSourceGuide],
    'publicPensionGroup',
  );

  // 연금 수령 시기 예상 연금 외 소득 — `KnownOrUnknownField`(design-system
  // 5.26절). **값 칸과 "모르겠습니다"가 항상 함께 보인다**(조건부로 숨기지
  // 않는다) — 배타 규약: 값을 치면 모르겠습니다가 풀리고, 모르겠습니다를
  // 누르면 값 칸이 비워진다. 기본 선택은 없다지만 이 서비스는 접촉하지
  // 않은 상태와 "모름"을 계산상 같게 다루므로(9.1절 — 기본값 "모름") 화면
  // 초기 상태에서 "모르겠습니다"가 미리 눌려 있지 않고, 폼 기본값
  // (`otherIncomeKnown: false`)이 계산에서 "모름"과 같은 효과를 낸다.
  const otherIncomeField = numberField({
    id: 'otherIncomeAnnual',
    label: '연금 수령 시기 예상 연금 외 소득(연간)',
    value: form.otherIncomeAnnual,
    error: reverseFieldError(errors, 'otherIncomeAnnual'),
    onInput: (v) => store.setFields({ otherIncomeAnnual: v, otherIncomeKnown: v !== '' }),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const otherIncomeUnknownToggle = el(
    'div',
    { class: 'field', role: 'radiogroup', 'aria-label': '연금 수령 시기 예상 연금 외 소득을 아는가' },
    [
      el(
        'button',
        {
          type: 'button',
          role: 'radio',
          id: 'otherIncomeUnknown',
          'aria-checked': !form.otherIncomeKnown,
          class: `known-or-unknown-option${!form.otherIncomeKnown ? ' known-or-unknown-option-selected' : ''}`,
          onclick: () => store.setFields({ otherIncomeKnown: false, otherIncomeAnnual: '' }, { immediate: true }),
        },
        ['모르겠습니다'],
      ),
    ],
  );
  const otherIncomeHelp = el('p', { class: 'field-help' }, [
    "입력하지 않거나 '모르겠습니다'를 고르면 수령 전략 비교에서 유불리를 판정하지 않고 사실만 보여줍니다.",
  ]);

  const groupThree = el('section', { class: 'input-group' }, [
    groupTitleNode(iconChart, '③ 결과를 더 정확하게 하는 선택 입력'),
    deferredToggle,
    deferredGroup,
    publicPensionToggle,
    publicPensionGroup,
    otherIncomeField,
    otherIncomeUnknownToggle,
    otherIncomeHelp,
  ]);

  const resetButton = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-text',
      onclick: () =>
        openConfirm({
          title: RESET_CONFIRM_TITLE,
          body: RESET_CONFIRM_BODY,
          acceptLabel: RESET_CONFIRM_ACCEPT,
          cancelLabel: RESET_CONFIRM_CANCEL,
          onAccept: () => store.reset(),
        }),
    },
    ['초기화'],
  );

  return el('div', { class: 'input-panel' }, [
    el('div', { class: 'input-panel-header' }, [el('h2', { class: 'panel-title' }, [el('span', {}, ['입력'])]), resetButton]),
    groupOne,
    groupTwo,
    groupThree,
  ]);
}
