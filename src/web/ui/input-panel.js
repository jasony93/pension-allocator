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
  const e = errors[key];
  if (!e) return null;
  // 'missing'(단순히 비어 있음)은 여기서 빨간 오류로 보여주지 않는다 — 그건
  // RequirementChecklist의 역할이다. 여기서 보여주는 건 실제로 잘못된 값
  // (정수가 아님, 음수, 누적액 초과 등)뿐이다. 그렇지 않으면 첫 진입부터
  // 아직 손대지 않은 빈 필드가 전부 빨갛게 보인다.
  if (e.code === 'missing') return null;
  return e.message;
}

function numberField({ id, label, value, help, error, onInput, onBlur, renderGuard, suffix = '원', required = false }) {
  const inputEl = el('input', {
    id,
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : null,
    oninput: (e) => onInput(e.target.value),
    // 재렌더가 이 필드를 통째로 갈아치우는 순간에도 브라우저가 blur를 발생시킨다
    // (포커스가 있던 노드가 DOM에서 떨어져 나가므로). 그 합성 blur까지 실제
    // blur로 취급해 재계산을 걸면 "렌더 → 포커스 노드 제거 → blur → 재계산 →
    // 재렌더 → …" 무한 루프가 된다(브라우저에서 실제로 재현해 크래시까지
    // 확인한 버그). `renderGuard`로 "우리가 지금 막 이 노드를 지운 것"과
    // "사용자가 실제로 포커스를 옮긴 것"을 구분한다 — app.js가 mount() 호출을
    // 감싸는 동안만 true다.
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
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

export function renderInputPanel({ state, store, boundariesInfo, renderGuard }) {
  const { form, validation } = state;
  const errors = validation.errors;

  const ageField = numberField({
    id: 'age',
    label: '나이 (만)',
    value: form.age,
    error: fieldError(errors, 'age'),
    onInput: (v) => store.setField('age', v),
    onBlur: () => store.flush(),
    renderGuard,
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
    renderGuard,
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
      renderGuard,
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
    renderGuard,
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
      fieldError(errors, 'fundUseHorizon')
        ? el('p', { class: 'field-error-msg', role: 'alert' }, [fieldError(errors, 'fundUseHorizon')])
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
    renderGuard,
  });
  const retirementField = numberField({
    id: 'retirementPensionYtd',
    label: 'IRP (2026년 누적)',
    value: form.retirementPensionYtd,
    error: fieldError(errors, 'retirementPensionYtd'),
    onInput: (v) => store.setField('retirementPensionYtd', v),
    onBlur: () => store.flush(),
    renderGuard,
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
    renderGuard,
  });
  const isaYtdField = numberField({
    id: 'isaYtd',
    label: 'ISA 납입액 (2026년 당해연도 누적)',
    value: form.isaYtd,
    error: fieldError(errors, 'isaYtd'),
    onInput: (v) => store.setField('isaYtd', v),
    onBlur: () => store.flush(),
    renderGuard,
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
      renderGuard,
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
      renderGuard,
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
