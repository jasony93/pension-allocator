/**
 * 「절세계좌 계산기2」(D79) 입력 패널 — 첫 탭(`input-panel.js`)과 **같은
 * store 모양, 같은 필드, 같은 검증**을 쓰되 입력 UX가 다르다(D79 판정 1).
 *
 * **재사용 원칙 — 모양만 새로 짜고, 필드 컴포넌트·문구·검증은 첫 탭에서
 * 그대로 가져온다.** `numberField`·`segmentToggle`·`conditionalGroup`·
 * `groupTitleNode`·`fieldError`·`birthDateField`·`fundUseHorizonGroup`·
 * `youthBlock`는 전부 `input-panel.js`에서 가져온 바로 그 함수다 — 라벨·
 * 도움말·오류 문구·조건부 노출 조건이 첫 탭과 한 글자도 어긋나지 않는다.
 * 색·레이아웃만 `styles.css`의 `.calc2-input-panel` 스코프 규칙이 새로
 * 입힌다(밑줄형 입력·2열 그리드·아이콘+가운데 제목 — snowball72.com 참고
 * 화면의 **구성 방식**만 차용했다. 문구·계산·수치는 가져오지 않았다).
 *
 * **최소 기입 + 접힘(D79 판정 1 셋째 문단).** 처음 보이는 것은 계산에
 * 필수인 최소 필드(생년월일·총급여액·다른 종합소득 여부·월 납입 여력)뿐이다
 * — 이 넷은 `CORE_REQUIREMENTS`(state/validation.js)의 필수 여섯 항목 중
 * "묻는 즉시 값이 되는" 넷이다. 나머지(자금 사용 시점·연금 수령 여부·ISA
 * 상세·수익률 가정·직전 과세기간·청년 우대)는 「추가 정보」 접힘 안에
 * 있다 — 계산기2는 **항상 프리필로 시작**하므로(판정 2, 아래) 접힌 필드도
 * 값을 이미 갖고 있어 첫 계산을 막지 않는다.
 *
 * **연금 수령 여부(D79 판정 3).** 물음 자체를 보이는 폼에서 없앤다 — 다만
 * 답을 가정하지 않는다. `state/annuity-start-derivation.js`의
 * `deriveAnnuityStartedFromBoundaries`가 `false`(확실히 미개시, 만 55세
 * 미만 — 시행령 §40조의2③1)를 내면 **`ui/app.js`가**(이 파일이 아니다 —
 * 아래) store의 `onChange` 경로에서 `applySharedForm`으로 그 값을 조용히
 * 채운다. 이 파일은 순수 뷰만 진다 — 도출값을 읽어 `false`면 물음 자체를
 * 그리지 않고, `null`(아직 모른다 / 이미 개시 연령에 닿았거나 지났다)이면
 * 「추가 정보」 안에 그 물음을 그린다 — 필요할 때만 나타나는 물음이지,
 * 물음의 삭제가 아니다.
 */

import { el } from './dom.js';
import { iconProfile, iconWallet, iconBank, iconTransfer, iconTrend } from './icons.js';
import {
  numberField,
  percentField,
  yearsField,
  segmentToggle,
  conditionalGroup,
  groupTitleNode,
  fieldError,
  birthDateField,
  fundUseHorizonGroup,
  youthBlock,
} from './input-panel.js';
import {
  HAS_NON_WAGE_INCOME_LABEL,
  HAS_NON_WAGE_INCOME_HELP,
  GLOBAL_INCOME_LABEL,
  GLOBAL_INCOME_HELP,
  ANNUITY_START_LABEL,
  ANNUITY_START_EFFECT_CAPTION,
  ANNUITY_STARTED_HORIZON_NOTE,
  FINANCIAL_INCOME_LABEL,
  FINANCIAL_INCOME_EFFECT_CAPTION,
  isaAccountTypeLabel,
  ISA_YEARS_SINCE_OPENING_LABEL,
  ISA_YEARS_SINCE_OPENING_HELP,
  ISA_RETURN_SECTION_TITLE,
  ISA_RETURN_TOGGLE_LABEL,
  ISA_RETURN_SECTION_HELP,
  ISA_RETURN_RATE_LABEL,
  ISA_RETURN_INCOME_CHARACTER_LABEL,
  ISA_RETURN_INCOME_CHARACTER_HELP,
  ISA_RETURN_SETTLEMENT_YEARS_LABEL,
  ISA_RETURN_SETTLEMENT_YEARS_HELP,
  ISA_RETURN_LOSS_LABEL,
  ISA_RETURN_LOSS_HELP,
  ISA_INCOME_CHARACTER_LABEL,
  ISA_INCOME_CHARACTER_EXAMPLE,
} from '../copy.js';
import { CALC2_MORE_INFO_TRIGGER, CALC2_ESSENTIAL_GROUP_TITLE, CALC2_PREFILL_NOTE } from '../calc2-copy.js';
import { ISA_INCOME_CHARACTERS, isaYearsSinceOpeningVisible } from '../state/validation.js';
import { deriveAnnuityStartedFromBoundaries } from '../state/annuity-start-derivation.js';

/** 「추가 정보」는 옛 청년 블록(`youthBlockOpen`)과 같은 규약 — 한 번 열면 그 세션 동안 열려 있다. */
let calc2MoreInfoOpen = false;

function calc2AnnuityStartQuestion({ form, store, derivedAnnuityStarted }) {
  // [D79 판정 3] 도출값이 확실한 미개시(`false`)면 묻지 않는다 — 그 값은
  // `renderCalc2InputPanel`이 이미 `applySharedForm`으로 채워 뒀다.
  if (derivedAnnuityStarted === false) return null;
  const toggle = segmentToggle({
    id: 'calc2AnnuityStarted',
    label: ANNUITY_START_LABEL,
    value: form.annuityStarted,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('annuityStarted', v, { immediate: true }),
    help: ANNUITY_START_EFFECT_CAPTION,
  });
  const note =
    form.annuityStarted === true
      ? el('div', { class: 'eligibility-note', 'data-key': 'calc2AnnuityStartedNote' }, [
          el('p', { class: 'type-body-s' }, [ANNUITY_STARTED_HORIZON_NOTE]),
        ])
      : null;
  return el('div', { 'data-key': 'calc2AnnuityStartGroup' }, [toggle, note]);
}

export function renderCalc2InputPanel({ state, store, renderGuard }) {
  const { form, validation, provisionalYouth, result, boundaries } = state;
  const errors = validation.errors;
  const derivedAgeYears = result?.echo?.derived_age?.age_years ?? null;
  // [D79 판정 3] 도출("확실히 미개시") 자체는 `ui/app.js`가 store의
  // `onChange` 경로에서 `applySharedForm`으로 채운다(`maybeAutoDeriveCalc2AnnuityStarted`)
  // — 이 함수(순수 뷰)는 그 결과를 **읽기만** 해서 물음을 그릴지 말지
  // 고른다. 뷰 함수 안에서 store를 직접 고치지 않는다(다른 렌더 함수와
  // 같은 순수성 규약).
  const derivedAnnuityStarted = deriveAnnuityStartedFromBoundaries(boundaries);

  // ---- 필수 최소 ------------------------------------------------------
  const birthField = birthDateField({
    id: 'calc2BirthDate',
    value: form.birthDate,
    error: fieldError(errors, 'birthDate'),
    onInput: (v) => store.setField('birthDate', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const salaryField = numberField({
    id: 'calc2CurrentSalary',
    label: '총급여액 (2026년, 당해연도)',
    value: form.currentSalary,
    help: '근로소득 원천징수영수증의 총급여액',
    error: fieldError(errors, 'currentSalary'),
    onInput: (v) => store.setField('currentSalary', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const hasNonWageIncomeToggle = segmentToggle({
    id: 'calc2HasNonWageIncome',
    label: HAS_NON_WAGE_INCOME_LABEL,
    value: form.hasNonWageIncome,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('hasNonWageIncome', v, { immediate: true }),
    help: HAS_NON_WAGE_INCOME_HELP,
  });
  const capacityField = numberField({
    id: 'calc2MonthlyCapacity',
    label: '월 납입 여력',
    help: '새로 넣는 돈 기준입니다(퇴직급여 입금액·계약이전액 제외).',
    value: form.monthlyCapacity,
    error: fieldError(errors, 'monthlyCapacity'),
    onInput: (v) => store.setField('monthlyCapacity', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const globalIncomeField = conditionalGroup(
    form.hasNonWageIncome === true,
    [
      numberField({
        id: 'calc2GlobalIncomeAmount',
        label: GLOBAL_INCOME_LABEL,
        value: form.globalIncomeAmount,
        help: GLOBAL_INCOME_HELP,
        error: fieldError(errors, 'globalIncomeAmount'),
        onInput: (v) => store.setField('globalIncomeAmount', v),
        onBlur: () => store.flush(),
        renderGuard,
      }),
    ],
    'calc2GlobalIncomeGroup',
  );

  const essentialGroup = el('section', { class: 'input-group calc2-essential-group' }, [
    groupTitleNode(iconProfile, CALC2_ESSENTIAL_GROUP_TITLE),
    el('div', { class: 'calc2-field-grid' }, [birthField, salaryField]),
    el('div', { class: 'calc2-field-grid' }, [capacityField, hasNonWageIncomeToggle]),
    globalIncomeField,
  ]);

  // ---- 「추가 정보」 접힘 ------------------------------------------------
  const horizonGroup = fundUseHorizonGroup({ form, store, boundariesInfo: boundaries, errors, idPrefix: 'calc2' });
  const annuityQuestion = calc2AnnuityStartQuestion({ form, store, derivedAnnuityStarted });

  const priorSalaryCheckbox = el('label', { class: 'checkbox-row' }, [
    el('input', {
      type: 'checkbox',
      checked: form.priorSalaryEnabled,
      onchange: (e) => store.setField('priorSalaryEnabled', e.target.checked, { immediate: true }),
    }),
    el('span', {}, ['직전 과세기간(2025년) 총급여액이 다릅니다']),
  ]);
  const priorSalaryField = conditionalGroup(
    form.priorSalaryEnabled,
    [
      numberField({
        id: 'calc2PriorSalary',
        label: '총급여액 (2025년, 직전 과세기간)',
        value: form.priorSalary,
        error: fieldError(errors, 'priorSalary'),
        onInput: (v) => store.setField('priorSalary', v),
        onBlur: () => store.flush(),
        renderGuard,
      }),
    ],
    'calc2PriorSalaryGroup',
  );

  const annuityField = numberField({
    id: 'calc2AnnuitySavingsYtd',
    label: '연금저축 (2026년 누적)',
    value: form.annuitySavingsYtd,
    error: fieldError(errors, 'annuitySavingsYtd'),
    onInput: (v) => store.setField('annuitySavingsYtd', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const retirementField = numberField({
    id: 'calc2RetirementPensionYtd',
    label: 'IRP (2026년 누적)',
    value: form.retirementPensionYtd,
    error: fieldError(errors, 'retirementPensionYtd'),
    onInput: (v) => store.setField('retirementPensionYtd', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  const isaExistsToggle = segmentToggle({
    id: 'calc2IsaExists',
    label: 'ISA 계좌가 있나요?',
    value: form.isaExists,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('isaExists', v, { immediate: true }),
  });
  const isaTypeToggle = segmentToggle({
    id: 'calc2IsaAccountType',
    label: isaAccountTypeLabel(form.isaExists),
    value: form.isaAccountType,
    options: [
      { value: 'general', label: '일반형' },
      { value: 'low_income', label: '서민형' },
    ],
    onChange: (v) => store.setField('isaAccountType', v, { immediate: true }),
  });
  const isaCumulativeField = numberField({
    id: 'calc2IsaCumulative',
    label: 'ISA 납입액 (가입 이후 누적)',
    value: form.isaCumulative,
    error: fieldError(errors, 'isaCumulative'),
    onInput: (v) => store.setField('isaCumulative', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const isaYtdField = numberField({
    id: 'calc2IsaYtd',
    label: 'ISA 납입액 (2026년 당해연도 누적)',
    value: form.isaYtd,
    error: fieldError(errors, 'isaYtd'),
    onInput: (v) => store.setField('isaYtd', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const isaYearsSinceOpeningField = conditionalGroup(
    isaYearsSinceOpeningVisible(form),
    [
      yearsField({
        id: 'calc2IsaYearsSinceOpening',
        label: ISA_YEARS_SINCE_OPENING_LABEL,
        value: form.isaYearsSinceOpening,
        error: fieldError(errors, 'isaYearsSinceOpening'),
        help: ISA_YEARS_SINCE_OPENING_HELP,
        onInput: (v) => store.setField('isaYearsSinceOpening', v),
        onBlur: () => store.flush(),
        renderGuard,
      }),
    ],
    'calc2IsaYearsSinceOpeningGroup',
  );
  const financialIncomeToggle = segmentToggle({
    id: 'calc2IsaFinancialIncomeTaxpayer',
    label: FINANCIAL_INCOME_LABEL,
    value: form.isaFinancialIncomeTaxpayer,
    options: [
      { value: 'no', label: '아니오' },
      { value: 'yes', label: '예' },
      { value: 'unknown', label: '모르겠음' },
    ],
    onChange: (v) => store.setField('isaFinancialIncomeTaxpayer', v, { immediate: true }),
    help: FINANCIAL_INCOME_EFFECT_CAPTION,
  });
  const isaBlock = conditionalGroup(
    form.isaExists,
    [isaCumulativeField, isaYearsSinceOpeningField, isaYtdField, financialIncomeToggle],
    'calc2IsaBlock',
  );

  // ---- ISA 만기 자금 전환 (ISA 보유 시에만, 첫 탭 groupFour와 같은 조건) ----
  let transferBlock = null;
  if (form.isaExists) {
    const transferToggle = segmentToggle({
      id: 'calc2IsaTransferEnabled',
      label: '만기 자금을 연금계좌로 전환합니까?',
      value: form.isaTransferEnabled,
      options: [
        { value: false, label: '아니오' },
        { value: true, label: '예' },
      ],
      onChange: (v) => store.setField('isaTransferEnabled', v, { immediate: true }),
    });
    const transferAmountField = numberField({
      id: 'calc2IsaTransferAmount',
      label: '전환 금액',
      value: form.isaTransferAmount,
      error: fieldError(errors, 'isaTransferAmount', { showMissing: true }),
      onInput: (v) => store.setField('isaTransferAmount', v),
      onBlur: () => store.flush(),
      renderGuard,
    });
    const destinationToggle = segmentToggle({
      id: 'calc2IsaTransferDestination',
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
      id: 'calc2IsaTransferPriorApplied',
      label: '직전 과세기간에 이미 적용받은 추가공제액',
      value: form.isaTransferPriorApplied,
      error: fieldError(errors, 'isaTransferPriorApplied'),
      onInput: (v) => store.setField('isaTransferPriorApplied', v),
      onBlur: () => store.flush(),
      renderGuard,
    });
    const transferInner = conditionalGroup(
      form.isaTransferEnabled,
      [transferAmountField, destinationToggle, destinationHelp, priorAppliedField],
      'calc2IsaTransferGroup',
    );
    transferBlock = el('section', { class: 'input-group input-group-conditional', 'data-key': 'calc2TransferBlock' }, [
      groupTitleNode(iconTransfer, 'ISA 만기 자금 전환'),
      transferToggle,
      transferInner,
    ]);
  }

  // ---- ISA 예상 수익률(선택, D28·D29·D31 — 첫 탭 groupFive와 같은 필드) ----
  const returnToggle = segmentToggle({
    id: 'calc2IsaReturnEnabled',
    label: ISA_RETURN_TOGGLE_LABEL,
    value: form.isaReturnEnabled,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('isaReturnEnabled', v, { immediate: true }),
    help: ISA_RETURN_SECTION_HELP,
  });
  const rateField = percentField({
    id: 'calc2IsaReturnRatePercent',
    label: ISA_RETURN_RATE_LABEL,
    value: form.isaReturnRatePercent,
    error: fieldError(errors, 'isaReturnRatePercent', { showMissing: true }),
    onInput: (v) => store.setField('isaReturnRatePercent', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const characterToggle = segmentToggle({
    id: 'calc2IsaIncomeCharacter',
    label: ISA_RETURN_INCOME_CHARACTER_LABEL,
    value: form.isaIncomeCharacter,
    options: ISA_INCOME_CHARACTERS.map((id) => ({ value: id, label: ISA_INCOME_CHARACTER_LABEL[id] })),
    onChange: (v) => store.setField('isaIncomeCharacter', v, { immediate: true }),
    help: ISA_RETURN_INCOME_CHARACTER_HELP,
  });
  const characterExample = form.isaIncomeCharacter
    ? el('p', { class: 'field-help' }, [ISA_INCOME_CHARACTER_EXAMPLE[form.isaIncomeCharacter]])
    : null;
  const settlementYearsFieldNode = yearsField({
    id: 'calc2IsaSettlementYears',
    label: ISA_RETURN_SETTLEMENT_YEARS_LABEL,
    value: form.isaSettlementYears,
    error: fieldError(errors, 'isaSettlementYears'),
    help: ISA_RETURN_SETTLEMENT_YEARS_HELP,
    onInput: (v) => store.setField('isaSettlementYears', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const lossField = numberField({
    id: 'calc2IsaLossAmount',
    label: ISA_RETURN_LOSS_LABEL,
    value: form.isaLossAmount,
    error: fieldError(errors, 'isaLossAmount'),
    help: ISA_RETURN_LOSS_HELP,
    onInput: (v) => store.setField('isaLossAmount', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const returnInner = conditionalGroup(
    form.isaReturnEnabled,
    [rateField, characterToggle, characterExample, settlementYearsFieldNode, lossField],
    'calc2IsaReturnGroup',
  );
  const returnGroup = el('section', { class: 'input-group', 'data-key': 'calc2ReturnGroup' }, [
    groupTitleNode(iconTrend, ISA_RETURN_SECTION_TITLE),
    returnToggle,
    returnInner,
  ]);

  const moreInfo = el(
    'details',
    {
      class: 'provisional-note-details calc2-more-info',
      open: calc2MoreInfoOpen,
      ontoggle: (e) => {
        calc2MoreInfoOpen = e.target.open;
      },
    },
    [
      el('summary', { class: 'provisional-note-trigger' }, [CALC2_MORE_INFO_TRIGGER]),
      el('div', { class: 'calc2-more-info-body', 'data-key': 'calc2MoreInfoBody' }, [
        el('section', { class: 'input-group', 'data-key': 'calc2HorizonGroup' }, [
          groupTitleNode(iconWallet, '월 납입액 상세'),
          annuityQuestion,
          horizonGroup,
          priorSalaryCheckbox,
          priorSalaryField,
        ]),
        el('section', { class: 'input-group', 'data-key': 'calc2AccountGroup' }, [
          groupTitleNode(iconBank, '계좌 현황'),
          el('div', { class: 'calc2-field-grid' }, [annuityField, retirementField]),
          isaExistsToggle,
          isaTypeToggle,
          isaBlock,
        ]),
        transferBlock,
        returnGroup,
        youthBlock({ form, store, provisionalYouth, derivedAgeYears, idPrefix: 'calc2' }),
      ]),
    ],
  );

  // [D79 판정 2] "그 결과가 미리 채운 인물의 것임이 화면에 있어야 한다" —
  // 직접 고치면 이 줄이 사라지는 것까지는 요구하지 않는다(관리자 지시 원문
  // "단순하게"). 항상 그린다.
  const prefillNote = el('p', { class: 'calc2-prefill-note', role: 'status' }, [CALC2_PREFILL_NOTE]);

  return el('div', { class: 'input-panel calc2-input-panel' }, [prefillNote, essentialGroup, moreInfo]);
}
