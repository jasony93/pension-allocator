/**
 * 입력 패널 — `screens.md` 3절. 좌측(데스크톱) / 상단(모바일) 영역.
 * 조건부 그룹은 다른 필드 값에서 추론하지 않고 사용자의 명시적 진술을 조건으로
 * 쓴다(게이트 2 D14) — 예: ISA 관련 항목은 `ISA 계좌가 있나요 = 예`가 조건이지
 * 누적 납입액이 0보다 크다는 사실이 조건이 아니다.
 *
 * **아무 입력도 접지 않는다**(R3, 3.11.3절). 접힌 블록은 사용자가 그 항목의
 * 존재를 모르게 만들고, 그러면 `[4-E]`가 "당신이 답하지 않아서"로 읽히지 못한다.
 * 조건부 노출(`ConditionalGroup`)을 대신 쓴다 — 접기와 조건부는 **여닫는 주체가
 * 다르다.** 접히는 것은 `SourceGuide` 하나뿐이고, 그것은 *답*이 아니라 *설명*이다.
 *
 * **그룹 수를 늘리지 않는다**(3.11.4절 (b)). 이번에 늘어난 입력 넷을 전부 기존 네
 * 그룹 안에 넣었다.
 */

import { el } from './dom.js';
import {
  FUND_USE_HORIZON_LABEL,
  FUND_USE_HORIZON_DESCRIPTION,
  HORIZON_EFFECT_CAPTION,
  BIRTH_DATE_LABEL,
  BIRTH_DATE_PLACEHOLDER,
  BIRTH_DATE_HELP,
  PRIOR_TAX_LABEL,
  PRIOR_TAX_UNKNOWN_LABEL,
  PRIOR_TAX_EFFECT_CAPTION,
  SOURCE_GUIDE_TRIGGER,
  SOURCE_GUIDE_ITEMS,
  SOURCE_GUIDE_PLACEHOLDER_NOTICE,
  ANNUITY_START_LABEL,
  ANNUITY_START_EFFECT_CAPTION,
  ANNUITY_STARTED_HORIZON_NOTE,
  FINANCIAL_INCOME_LABEL,
  FINANCIAL_INCOME_EFFECT_CAPTION,
  YOUTH_BLOCK_TITLE,
  YOUTH_DECLARE_LABEL,
  YOUTH_AGE_UNDETERMINED_LINE,
  YOUTH_SCENARIO_SCOPE_CAPTION,
  YOUTH_DECLARED_RANGE_NOTE,
  WITHHOLDING_RECEIPT_DIVIDER,
  PROPOSED_BADGE_LABEL,
} from '../copy.js';
import { formatYears } from '../format.js';
import { isWithinYouthAgeRange } from '../engine/provisional-rules.js';

/** `SourceGuide`는 한 번 펼치면 그 세션 동안 펼침 상태를 유지한다(design-system 5.27절). */
let sourceGuideOpen = false;

/**
 * `showMissing`는 **조건부 필수 항목에만** 켠다.
 *
 * 'missing'(단순히 비어 있음)은 기본적으로 여기서 빨간 오류로 보여주지 않는다 —
 * 그건 `RequirementChecklist`의 역할이고, 그렇지 않으면 첫 진입부터 아직 손대지
 * 않은 빈 필드가 전부 빨갛게 보인다.
 *
 * **그런데 그 위임이 성립하지 않는 자리가 하나 있다**(4단계 `qa` 결함 Q2).
 * 체크리스트의 조건부 행은 입력 부족 패널 안에만 있어서, 결과가 이미 나온 뒤에
 * 조건부 필수 항목을 비우면 위임처가 사라진다 — 결과는 갱신되지 않는데 화면
 * 어디에도 단서가 없다(AC 8 실패). 이 항목은 사용자가 방금 `예`를 눌러 스스로
 * 불러낸 필드이므로, 비어 있다는 사실을 필드 옆에서 바로 말하는 것이 맞다.
 */
function fieldError(errors, key, { showMissing = false } = {}) {
  const e = errors[key];
  if (!e) return null;
  if (e.code === 'missing' && !showMissing) return null;
  return e.message;
}

function numberField({ id, label, value, help, error, warning, onInput, onBlur, renderGuard, suffix = '원' }) {
  const inputEl = el('input', {
    id,
    class: `field-input${error ? ' field-input-error' : warning ? ' field-input-warning' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : warning ? `${id}-warning` : help ? `${id}-help` : null,
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
    el('label', { for: id, class: 'field-label' }, [label]),
    el('div', { class: 'field-control' }, [inputEl, suffix ? el('span', { class: 'field-suffix' }, [suffix]) : null]),
    error
      ? el('p', { id: `${id}-error`, class: 'field-error-msg', role: 'alert' }, [error])
      : warning
        ? el('p', { id: `${id}-warning`, class: 'field-warning-msg', role: 'status' }, [warning])
        : help
          ? el('p', { id: `${id}-help`, class: 'field-help' }, [help])
          : null,
  ]);
}

function segmentToggle({ id, label, value, options, onChange, help }) {
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
            id: `${id}-${String(opt.value)}`,
            onclick: () => onChange(opt.value),
          },
          [opt.label],
        ),
      ),
    ),
    help ? el('p', { class: 'field-help' }, [help]) : null,
  ]);
}

function conditionalGroup(visible, children) {
  return visible ? el('div', { class: 'conditional-group' }, children) : null;
}

/**
 * 8자리 숫자를 `YYYY-MM-DD`로 마스킹한다. `CurrencyField`의 천 단위 쉼표와 같은
 * 마스킹 규약이다(design-system 5.25절). 붙여넣기는 하이픈이 있든 없든 받아
 * 8자리로 정규화한다.
 *
 * **여기서 만 나이를 만들지 않는다.** 이 함수가 다루는 것은 날짜 문자열뿐이다.
 */
export function maskBirthDate(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * `BirthDateField` — 한 칸(design-system 5.25절).
 *
 * 세 칸 분리는 자동 포커스 이동이 접근성 회귀이고, 달력 위젯은 먼 과거 날짜에
 * 최악의 도구다(3.7.2절). 여기서 지키는 못 넷이 코드로 보인다 —
 * `autocomplete="off"`, 값 되비추기 없음, 첫 진입 자동 포커스 없음,
 * 오류 문구에 입력값 되풀이 없음(문구는 `validation.js`가 만든다).
 */
function birthDateField({ value, error, onInput, onBlur, renderGuard }) {
  const inputEl = el('input', {
    id: 'birthDate',
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    // 표준 자동완성 토큰(`bday`)을 쓰지 않는다 — 값이 브라우저 프로필과 동기화
    // 계정으로 흘러 우리가 통제하지 못하는 표면이 생긴다(3.7.5절 못 6).
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    placeholder: BIRTH_DATE_PLACEHOLDER,
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? 'birthDate-error' : 'birthDate-help',
    oninput: (e) => onInput(maskBirthDate(e.target.value)),
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
  });
  return el('div', { class: 'field' }, [
    el('label', { for: 'birthDate', class: 'field-label' }, [BIRTH_DATE_LABEL]),
    el('div', { class: 'field-control' }, [inputEl]),
    // 만 나이를 옆에 되비추지 않는다. 도움말은 항상 표시하고 비울 수 없다.
    error
      ? el('p', { id: 'birthDate-error', class: 'field-error-msg', role: 'alert' }, [error])
      : el('p', { id: 'birthDate-help', class: 'field-help' }, [BIRTH_DATE_HELP]),
  ]);
}

/** `SourceGuide` — 인라인 확장. 모달·툴팁이 아니다(design-system 5.27절). */
function sourceGuide() {
  const items = SOURCE_GUIDE_ITEMS.map((item) =>
    el('li', {}, [
      el('span', { class: 'source-guide-heading' }, [item.heading]),
      el('span', { class: 'source-guide-body' }, [item.body]),
      // D19 — 미설정 상태는 조용하면 안 된다. 자리표시자가 남아 있으면 개발
      // 빌드가 그 사실을 드러낸다.
      item.placeholder ? el('span', { class: 'source-guide-placeholder' }, [SOURCE_GUIDE_PLACEHOLDER_NOTICE]) : null,
    ]),
  );
  return el(
    'details',
    {
      class: 'source-guide',
      open: sourceGuideOpen,
      ontoggle: (e) => {
        sourceGuideOpen = e.target.open;
      },
    },
    [el('summary', { class: 'source-guide-trigger' }, [SOURCE_GUIDE_TRIGGER]), el('ul', {}, items)],
  );
}

/**
 * `KnownOrUnknownField` — 값 또는 "모름"(design-system 5.26절).
 *
 * **금액 칸과 `모르겠습니다`는 배타적이다.** 금액을 치면 `모르겠습니다`가 풀리고,
 * `모르겠습니다`를 누르면 금액 칸이 **비워진다** — 값을 남겨 두고 숨기지 않는다.
 * **기본 선택이 없다.** `모르겠습니다`도 사용자가 눌러야 선택된다.
 */
function priorTaxField({ form, errors, warnings, store, renderGuard }) {
  const isUnknown = form.priorTaxState === 'unknown';
  const error = fieldError(errors, 'priorTaxAmount');
  const warning = warnings.priorTaxAmount?.message ?? null;

  const amountInput = el('input', {
    id: 'priorTaxAmount',
    class: `field-input${error ? ' field-input-error' : warning ? ' field-input-warning' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    value: isUnknown ? '' : form.priorTaxAmount,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? 'priorTaxAmount-error' : warning ? 'priorTaxAmount-warning' : 'priorTaxAmount-effect',
    oninput: (e) => store.setField('priorTax', { state: 'amount', amount: e.target.value }),
    onblur: () => {
      if (!renderGuard?.active) store.flush();
    },
  });

  const unknownOption = el(
    'button',
    {
      type: 'button',
      role: 'radio',
      id: 'priorTaxUnknown',
      'aria-checked': isUnknown,
      class: `known-unknown-option${isUnknown ? ' known-unknown-option-selected' : ''}`,
      onclick: () => store.setField('priorTax', { state: 'unknown', amount: '' }, { immediate: true }),
    },
    [el('span', { class: 'known-unknown-dot', 'aria-hidden': 'true' }, [isUnknown ? '●' : '○']), PRIOR_TAX_UNKNOWN_LABEL],
  );

  return el('div', { class: 'field known-unknown-field' }, [
    el('label', { for: 'priorTaxAmount', class: 'field-label' }, [PRIOR_TAX_LABEL]),
    el('div', { class: 'field-control' }, [amountInput, el('span', { class: 'field-suffix' }, ['원'])]),
    el('div', { class: 'known-unknown-group', role: 'radiogroup', 'aria-label': PRIOR_TAX_LABEL }, [unknownOption]),
    error ? el('p', { id: 'priorTaxAmount-error', class: 'field-error-msg', role: 'alert' }, [error]) : null,
    warning && !error ? el('p', { id: 'priorTaxAmount-warning', class: 'field-warning-msg', role: 'status' }, [warning]) : null,
    // 효과 고지 캡션 — **비울 수 없는 슬롯**(R1).
    el('p', { id: 'priorTaxAmount-effect', class: 'field-help' }, [PRIOR_TAX_EFFECT_CAPTION]),
    sourceGuide(),
  ]);
}

/**
 * 청년 자기신고 — `screens.md` 3.9절의 B-1.
 *
 * **화면이 나이로 자동 판정해 `declared_youth`를 채워 보내지 않는다.** 엔진이
 * 하지 않기로 한 판정을 화면이 대신 하는 것이므로 어느 계층에서 하든 같은
 * 잘못이다(3.9.1절). 체크박스는 미선택이 기본이다.
 *
 * **연령 범위 숫자가 이 블록 어디에도 없다.** 룰셋에 값이 실리고 엔진이 낸 만
 * 나이가 그 범위 안일 때만 `YOUTH_DECLARED_RANGE_NOTE` 한 줄이 더 나타난다 —
 * 그 줄에도 숫자는 없고, 룰셋의 값은 **해당 여부를 판정하는 데만** 쓰인다.
 * 시행령이 공개돼 룰셋에 값이 들어오면 그날 저절로 켜진다.
 */
function youthBlock({ form, store, provisionalYouth, derivedAgeYears }) {
  // 규칙을 못 읽으면 그리지 않는다 — `LawChip` 없는 세법 서술을 화면에 두지
  // 않는다(design-system 5.28절).
  if (!provisionalYouth) return null;

  const showRangeNote = isWithinYouthAgeRange(provisionalYouth.ageRange, derivedAgeYears);

  return el('div', { class: 'provisional-note' }, [
    el('h4', { class: 'provisional-note-title' }, [YOUTH_BLOCK_TITLE]),
    showRangeNote ? el('p', { class: 'type-body-s' }, [YOUTH_DECLARED_RANGE_NOTE]) : null,
    el('p', { class: 'type-body-s' }, [YOUTH_AGE_UNDETERMINED_LINE]),
    el('p', { class: 'note-laws' }, [
      provisionalYouth.billStage ? el('span', { class: 'proposed-badge' }, [PROPOSED_BADGE_LABEL]) : null,
      el('span', { class: 'law-chip' }, [provisionalYouth.law]),
    ]),
    el('label', { class: 'checkbox-row' }, [
      el('input', {
        type: 'checkbox',
        id: 'declaredYouth',
        checked: form.declaredYouth,
        onchange: (e) => store.setField('declaredYouth', e.target.checked, { immediate: true }),
      }),
      el('span', {}, [YOUTH_DECLARE_LABEL]),
    ]),
    el('p', { class: 'field-help' }, [YOUTH_SCENARIO_SCOPE_CAPTION]),
  ]);
}

export function renderInputPanel({ state, store, boundariesInfo, renderGuard }) {
  const { form, validation, provisionalYouth, result } = state;
  const errors = validation.errors;
  const warnings = validation.warnings ?? {};
  // 만 나이는 **엔진이 낸 값**만 쓴다(D21). 화면은 이 값을 사용자에게 되비추지
  // 않고, 룰셋의 청년 연령 범위와 대조하는 데만 쓴다.
  const derivedAgeYears = result?.echo?.derived_age?.age_years ?? null;

  // ---- 그룹 ① ------------------------------------------------------------
  const birthField = birthDateField({
    value: form.birthDate,
    error: fieldError(errors, 'birthDate'),
    onInput: (v) => store.setField('birthDate', v),
    onBlur: () => store.flush(),
    renderGuard,
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
    birthField,
    youthBlock({ form, store, provisionalYouth, derivedAgeYears }),
    // 출처가 같은 입력을 인접시킨다(3.11.4절 (c)) — 두 값이 흩어져 있으면
    // 사용자가 서류를 두 번 꺼내야 한다.
    el('p', { class: 'input-source-divider' }, [WITHHOLDING_RECEIPT_DIVIDER]),
    salaryField,
    priorSalaryCheckbox,
    priorSalaryHelp,
    priorSalaryField,
    priorTaxField({ form, errors, warnings, store, renderGuard }),
  ]);

  // ---- 그룹 ② ------------------------------------------------------------
  const capacityField = numberField({
    id: 'monthlyCapacity',
    label: '월 납입 여력',
    // 퇴직급여 입금액·계약이전액이 여기 섞여 들어오면 세액공제액이 과대
    // 계산된다(계약 3.2절). 그래서 "본인이 새로 넣는 돈"임을 명시한다.
    help: '본인이 새로 넣는 돈 기준으로 입력합니다. 퇴직급여 입금액·계약이전액은 포함하지 않습니다.',
    value: form.monthlyCapacity,
    error: fieldError(errors, 'monthlyCapacity'),
    onInput: (v) => store.setField('monthlyCapacity', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  // 자리: `fund_use_horizon` **바로 위**(3.10.1절). 이 항목이 그 선택지의 전제를
  // 무너뜨리는 값이라, 순서를 뒤집으면 사용자가 성립하지 않는 질문에 먼저 답한다.
  const annuityStartToggle = segmentToggle({
    id: 'annuityStarted',
    label: ANNUITY_START_LABEL,
    value: form.annuityStarted,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('annuityStarted', v, { immediate: true }),
    help: ANNUITY_START_EFFECT_CAPTION,
  });

  // `예`일 때 선택지 그룹 위에 사실 통지를 둔다(3.10.1절 (b)). `state-info`이고
  // 경고 색이 아니며 조치를 지시하지 않는다.
  const annuityStartedNote =
    form.annuityStarted === true
      ? el('div', { class: 'eligibility-note' }, [el('p', { class: 'type-body-s' }, [ANNUITY_STARTED_HORIZON_NOTE])])
      : null;

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
          // 캡션의 연수는 **엔진이 룰셋에서 읽어 낸 값**이다. 값이 오지 않으면
          // 캡션 줄 자체를 그리지 않는다 — 라벨만으로 선택이 완결된다(3.4절).
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
              id: `fundUseHorizon-${value}`,
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
    annuityStartToggle,
    annuityStartedNote,
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
  // 기준 2 — 계좌 하나를 통째로 배분 대상에서 빼는 값이므로 묻되, **그 계좌의
  // 조건부 블록 안에** 둔다(3.11.1절). 사유와 계좌는 붙어 있어야 한다.
  // 체크리스트 분모에 넣지 않는다.
  const financialIncomeToggle = segmentToggle({
    id: 'isaFinancialIncomeTaxpayer',
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

  const isaBlock = conditionalGroup(form.isaExists, [isaCumulativeField, isaYtdField, isaTypeToggle, financialIncomeToggle]);

  const groupThree = el('section', { class: 'input-group' }, [
    el('h3', { class: 'input-group-title' }, ['③ 계좌 현황']),
    el('p', { class: 'field-help' }, ['계좌가 없으면 0으로 둡니다. 본인이 새로 넣은 금액만 적습니다.']),
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
      // 조건부 필수 — 비어 있으면 계산이 멈추므로 그 사실을 필드 옆에서 말한다(Q2).
      error: fieldError(errors, 'isaTransferAmount', { showMissing: true }),
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
