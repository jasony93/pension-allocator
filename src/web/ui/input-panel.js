/**
 * 입력 패널 — `screens.md` 3절. 좌측(데스크톱) / 상단(모바일) 영역.
 * 조건부 그룹은 다른 필드 값에서 추론하지 않고 사용자의 명시적 진술을 조건으로
 * 쓴다(게이트 2 D14) — 예: ISA 관련 항목은 `ISA 계좌가 있나요 = 예`가 조건이지
 * 누적 납입액이 0보다 크다는 사실이 조건이 아니다.
 */

import { el } from './dom.js';
import { FUND_USE_HORIZON_LABEL, FUND_USE_HORIZON_DESCRIPTION, HORIZON_EFFECT_CAPTION } from '../copy.js';
import { formatYears } from '../format.js';

function fieldError(errors, key) {
  return errors[key]?.message ?? null;
}

function numberField({ id, label, value, help, error, onInput, onBlur, suffix = '원', required = false }) {
  const inputEl = el('input', {
    id,
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : null,
    oninput: (e) => onInput(e.target.value),
    onblur: onBlur,
  });
  return el('div', { class: 'field' }, [
    el('label', { for: id, class: 'field-label' }, [label + (required ? '' : '')]),
    el('div', { class: 'field-control' }, [inputEl, suffix ? el('span', { class: 'field-suffix' }, [suffix]) : null]),
    error
      ? el('p', { id: `${id}-error`, class: 'field-error-msg', role: 'alert' }, [error])
      : help
        ? el('p', { id: `${id}-help`, class: 'field-help' }, [help])
        : null,
  ]);
}

function segmentToggle({ id, label, value, options, onChange }) {
  return el('div', { class: 'field' }, [
    el('span', { class: 'field-label' }, [label]),
    el(
      'div',
      { class: 'segment-group', role: 'radiogroup', 'aria-label': label },
      options.map((opt) =>
        el(
          'button',
          {
            type: 'button',
            class: `segment-option${value === opt.value ? ' segment-option-selected' : ''}`,
            role: 'radio',
            'aria-checked': value === opt.value,
            id: `${id}-${opt.value}`,
            onclick: () => onChange(opt.value),
          },
          [opt.label],
        ),
      ),
    ),
  ]);
}

function conditionalGroup(visible, children) {
  return visible ? el('div', { class: 'conditional-group' }, children) : null;
}

export function renderInputPanel({ state, store, boundariesInfo }) {
  const { form, validation } = state;
  const errors = validation.errors;

  const ageField = numberField({
    id: 'age',
    label: '나이 (만)',
    value: form.age,
    error: fieldError(errors, 'age'),
    onInput: (v) => store.setField('age', v),
    onBlur: () => store.flush(),
    suffix: '세',
  });

  const salaryField = numberField({
    id: 'currentSalary',
    label: '총급여액 (2026년, 해당 과세연도)',
    value: form.currentSalary,
    help: '근로소득 원천징수영수증의 총급여액',
    error: fieldError(errors, 'currentSalary'),
    onInput: (v) => store.setField('currentSalary', v),
    onBlur: () => store.flush(),
  });

  const priorSalaryCheckbox = el('label', { class: 'checkbox-row' }, [
    el('input', {
      type: 'checkbox',
      checked: form.priorSalaryEnabled,
      onchange: (e) => store.setField('priorSalaryEnabled', e.target.checked, { immediate: true }),
    }),
    el('span', {}, ['직전 과세기간(2025년) 총급여액이 다릅니다']),
  ]);
  const priorSalaryHelp = el('p', { class: 'field-help' }, [
    '체크하지 않으면 ISA 비과세 한도 구간의 교차확인 없이 해당 연도 소득만으로 계산합니다.',
  ]);
  const priorSalaryField = conditionalGroup(form.priorSalaryEnabled, [
    numberField({
      id: 'priorSalary',
      label: '총급여액 (2025년, 직전 과세기간)',
      value: form.priorSalary,
      error: fieldError(errors, 'priorSalary'),
      onInput: (v) => store.setField('priorSalary', v),
      onBlur: () => store.flush(),
    }),
  ]);

  const groupOne = el('section', { class: 'input-group' }, [
    el('h3', { class: 'input-group-title' }, ['① 나에 대해']),
    ageField,
    salaryField,
    priorSalaryCheckbox,
    priorSalaryHelp,
    priorSalaryField,
  ]);

  // ---- 그룹 ② ------------------------------------------------------------
  const capacityField = numberField({
    id: 'monthlyCapacity',
    label: '월 납입 여력',
    value: form.monthlyCapacity,
    help: '지금 당장 배분 가능한 여윳돈 기준으로 입력하세요.',
    error: fieldError(errors, 'monthlyCapacity'),
    onInput: (v) => store.setField('monthlyCapacity', v),
    onBlur: () => store.flush(),
  });

  const horizonOptions = ['within_isa_lock_in', 'before_pension_age', 'at_or_after_pension_age', 'unknown'];
  const horizonGroup = el(
    'div',
    { class: 'field', role: 'radiogroup', 'aria-label': '이 돈을 언제 쓸 계획인가요?' },
    [
      el('span', { class: 'field-label' }, ['이 돈을 언제 쓸 계획인가요?']),
      el(
        'div',
        { class: 'horizon-choice-group' },
        horizonOptions.map((value) => {
          const selected = form.fundUseHorizon === value;
          const caption =
            value === 'within_isa_lock_in' && boundariesInfo?.isa_lock_in_years_remaining != null
              ? `남은 의무가입기간 ${formatYears(boundariesInfo.isa_lock_in_years_remaining)}`
              : value === 'before_pension_age' && boundariesInfo?.pension_years_remaining != null
                ? `그 나이까지 ${formatYears(boundariesInfo.pension_years_remaining)}`
                : null;
          return el(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': selected,
              class: `horizon-option${selected ? ' horizon-option-selected' : ''}`,
              onclick: () => store.setField('fundUseHorizon', value, { immediate: true }),
            },
            [
              el('span', { class: 'horizon-option-label' }, [FUND_USE_HORIZON_LABEL[value]]),
              FUND_USE_HORIZON_DESCRIPTION[value]
                ? el('span', { class: 'horizon-option-desc' }, [FUND_USE_HORIZON_DESCRIPTION[value]])
                : null,
              caption ? el('span', { class: 'horizon-option-caption' }, [`└ ${caption}`]) : null,
            ],
          );
        }),
      ),
      errors.fundUseHorizon
        ? el('p', { class: 'field-error-msg', role: 'alert' }, [errors.fundUseHorizon.message])
        : el('p', { class: 'field-help' }, [HORIZON_EFFECT_CAPTION]),
    ],
  );

  const groupTwo = el('section', { class: 'input-group' }, [
    el('h3', { class: 'input-group-title' }, ['② 이번에 배분할 돈']),
    capacityField,
    horizonGroup,
  ]);

  // ---- 그룹 ③ ------------------------------------------------------------
  const annuityField = numberField({
    id: 'annuitySavingsYtd',
    label: '연금저축 (2026년 누적)',
    value: form.annuitySavingsYtd,
    error: fieldError(errors, 'annuitySavingsYtd'),
    onInput: (v) => store.setField('annuitySavingsYtd', v),
    onBlur: () => store.flush(),
  });
  const retirementField = numberField({
    id: 'retirementPensionYtd',
    label: 'IRP (2026년 누적)',
    value: form.retirementPensionYtd,
    error: fieldError(errors, 'retirementPensionYtd'),
    onInput: (v) => store.setField('retirementPensionYtd', v),
    onBlur: () => store.flush(),
  });

  const isaExistsToggle = segmentToggle({
    id: 'isaExists',
    label: 'ISA 계좌가 있나요?',
    value: form.isaExists,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('isaExists', v, { immediate: true }),
  });

  const isaCumulativeField = numberField({
    id: 'isaCumulative',
    label: 'ISA 납입액 (가입 이후 누적)',
    value: form.isaCumulative,
    error: fieldError(errors, 'isaCumulative'),
    onInput: (v) => store.setField('isaCumulative', v),
    onBlur: () => store.flush(),
  });
  const isaYtdField = numberField({
    id: 'isaYtd',
    label: 'ISA 납입액 (2026년 당해연도 누적)',
    value: form.isaYtd,
    error: fieldError(errors, 'isaYtd'),
    onInput: (v) => store.setField('isaYtd', v),
    onBlur: () => store.flush(),
  });
  const isaTypeToggle = segmentToggle({
    id: 'isaAccountType',
    label: 'ISA 계좌 유형',
    value: form.isaAccountType,
    options: [
      { value: 'general', label: '일반형' },
      { value: 'low_income', label: '서민형' },
    ],
    onChange: (v) => store.setField('isaAccountType', v, { immediate: true }),
  });

  const isaBlock = conditionalGroup(form.isaExists, [isaCumulativeField, isaYtdField, isaTypeToggle]);

  const groupThree = el('section', { class: 'input-group' }, [
    el('h3', { class: 'input-group-title' }, ['③ 계좌 현황']),
    el('p', { class: 'field-help' }, ['계좌가 없으면 0으로 둡니다.']),
    annuityField,
    retirementField,
    isaExistsToggle,
    isaBlock,
  ]);

  // ---- 그룹 ④ (ISA 보유 시에만) --------------------------------------------
  let groupFour = null;
  if (form.isaExists) {
    const transferToggle = segmentToggle({
      id: 'isaTransferEnabled',
      label: '만기 자금을 연금계좌로 전환합니까?',
      value: form.isaTransferEnabled,
      options: [
        { value: false, label: '아니오' },
        { value: true, label: '예' },
      ],
      onChange: (v) => store.setField('isaTransferEnabled', v, { immediate: true }),
    });

    const transferAmountField = numberField({
      id: 'isaTransferAmount',
      label: '전환 금액',
      value: form.isaTransferAmount,
      error: fieldError(errors, 'isaTransferAmount'),
      onInput: (v) => store.setField('isaTransferAmount', v),
      onBlur: () => store.flush(),
    });
    const destinationToggle = segmentToggle({
      id: 'isaTransferDestination',
      label: '전환한 자금을 받을 계좌',
      value: form.isaTransferDestination,
      options: [
        { value: 'retirement_pension', label: 'IRP' },
        { value: 'annuity_savings', label: '연금저축' },
      ],
      onChange: (v) => store.setField('isaTransferDestination', v, { immediate: true }),
    });
    const destinationHelp = el('p', { class: 'field-help' }, ['받는 계좌에 따라 적용되는 한도가 달라 결과가 바뀝니다.']);
    const priorAppliedField = numberField({
      id: 'isaTransferPriorApplied',
      label: '직전 과세기간에 이미 적용받은 추가공제액',
      value: form.isaTransferPriorApplied,
      error: fieldError(errors, 'isaTransferPriorApplied'),
      onInput: (v) => store.setField('isaTransferPriorApplied', v),
      onBlur: () => store.flush(),
    });

    const transferInner = conditionalGroup(form.isaTransferEnabled, [
      transferAmountField,
      destinationToggle,
      destinationHelp,
      priorAppliedField,
    ]);

    groupFour = el('section', { class: 'input-group input-group-conditional' }, [
      el('h3', { class: 'input-group-title' }, ['④ ISA 만기 자금 전환']),
      transferToggle,
      transferInner,
    ]);
  }

  const resetButton = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-text',
      onclick: () => {
        if (confirm('입력한 모든 값을 지우고 처음부터 다시 시작할까요?')) store.reset();
      },
    },
    ['초기화'],
  );

  return el('div', { class: 'input-panel' }, [
    el('div', { class: 'input-panel-header' }, [el('h2', { class: 'panel-title' }, ['입력']), resetButton]),
    groupOne,
    groupTwo,
    groupThree,
    groupFour,
  ]);
}
