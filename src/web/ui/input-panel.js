/**
 * 입력 패널 — `screens.md` 3절. 좌측(데스크톱) / 상단(모바일) 영역.
 * 조건부 그룹은 다른 필드 값에서 추론하지 않고 사용자의 명시적 진술을 조건으로
 * 쓴다(게이트 2 D14) — 예: ISA 관련 항목은 `ISA 계좌가 있나요 = 예`가 조건이지
 * 누적 납입액이 0보다 크다는 사실이 조건이 아니다.
 *
 * **[게이트 6 D46] 딱 한 자리에서 이 원칙을 뒤집는다 — ISA 가입 후 경과연수.**
 * 여기서는 누적 납입액이 0보다 크다는 사실을 조건으로 쓴다
 * (`isaYearsSinceOpeningVisible`, state/validation.js의 주석 참고). 누적
 * 납입액이 0이면 그 값이 배분에 아무 영향을 주지 않아 묻는 것 자체가 불필요한
 * 질문이 되기 때문이다 — D46이 관리자 판정으로 명시했다.
 *
 * **아무 입력도 접지 않는다**(R3, 3.11.3절). 접힌 블록은 사용자가 그 항목의
 * 존재를 모르게 만들고, 그러면 `[4-E]`가 "당신이 답하지 않아서"로 읽히지 못한다.
 * 조건부 노출(`ConditionalGroup`)을 대신 쓴다 — 접기와 조건부는 **여닫는 주체가
 * 다르다.** 접히는 것은 `SourceGuide` 하나뿐이고, 그것은 *답*이 아니라 *설명*이다.
 *
 * **그룹 수를 늘리지 않는다는 3.11.4절 (b)를 이번 회차(5.1.0, D28·D29·D31 수익률
 * 가정)에서 어겼다 — ⑤가 새로 생겼다.** 다섯 필드(토글·수익률·소득 성격·정산
 * 기간·손실액)를 기존 네 그룹 어디에 넣어도 그 그룹의 주제와 어긋났고("④ ISA
 * 만기 자금 전환"과는 별개의 질문이다), 억지로 끼워 넣는 쪽이 3.11.4(b)가 막으려던
 * "사용자가 그룹의 성격을 못 읽는" 상태를 오히려 만든다고 판단했다. `designer`
 * 확인이 필요한 이탈로 최종 보고에 남긴다.
 */

import { el } from './dom.js';
import {
  FUND_USE_HORIZON_LABEL,
  fundUseHorizonLabel,
  FUND_USE_HORIZON_DESCRIPTION,
  HORIZON_EFFECT_CAPTION,
  HORIZON_CAPTION_BASIS_PREFIX,
  BIRTH_DATE_LABEL,
  BIRTH_DATE_PLACEHOLDER,
  BIRTH_DATE_HELP,
  HAS_NON_WAGE_INCOME_LABEL,
  HAS_NON_WAGE_INCOME_HELP,
  GLOBAL_INCOME_LABEL,
  GLOBAL_INCOME_HELP,
  ANNUITY_START_LABEL,
  ANNUITY_START_EFFECT_CAPTION,
  ANNUITY_STARTED_HORIZON_NOTE,
  FINANCIAL_INCOME_LABEL,
  FINANCIAL_INCOME_EFFECT_CAPTION,
  YOUTH_BLOCK_TITLE,
  YOUTH_BLOCK_TRIGGER,
  YOUTH_DECLARE_LABEL,
  YOUTH_AGE_UNDETERMINED_LINE,
  YOUTH_SCENARIO_SCOPE_CAPTION,
  YOUTH_DECLARED_RANGE_NOTE,
  PROPOSED_BADGE_LABEL,
  RESET_CONFIRM_TITLE,
  RESET_CONFIRM_BODY,
  RESET_CONFIRM_ACCEPT,
  RESET_CONFIRM_CANCEL,
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
  isaAccountTypeLabel,
  ISA_YEARS_SINCE_OPENING_LABEL,
  ISA_YEARS_SINCE_OPENING_HELP,
} from '../copy.js';
import { openConfirm } from './modal.js';
import { formatYears, formatKrw } from '../format.js';
import { isWithinYouthAgeRange } from '../engine/provisional-rules.js';
import { parseManwonToWon, ISA_INCOME_CHARACTERS, isaYearsSinceOpeningVisible } from '../state/validation.js';

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

/**
 * `numberField` — **만원 단위 금액 입력**(소유자 지시, 6절). "5000"을 치면
 * 5,000만원으로 인식한다. `inputmode="decimal"`로 바꿔 소수점을 모바일
 * 키패드에서도 칠 수 있게 한다 — 만원 정수만 받으면 만원 미만 금액(월 납입액
 * 등)을 넣을 방법이 없어진다.
 *
 * 원 단위 환산을 **되비춘다**(`field-won-preview`) — "5000 → 5,000만원"이
 * 실제로 인식됐다는 확인을, 계산이 끝나길 기다리지 않고 입력 즉시 보여준다.
 * 계산 자체는 여전히 `state/store.js`의 `manwonToWonOrZero`가 하고, 여기서는
 * 같은 순수 함수(`parseManwonToWon`)로 미리보기만 만든다 — 값을 새로 계산하지
 * 않고 화면이 이미 아는 변환을 한 번 더 보여줄 뿐이다.
 */
function numberField({ id, label, value, help, error, warning, onInput, onBlur, renderGuard, suffix = '만원' }) {
  const inputEl = el('input', {
    id,
    class: `field-input${error ? ' field-input-error' : warning ? ' field-input-warning' : ''}`,
    type: 'text',
    inputmode: 'decimal',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : warning ? `${id}-warning` : help ? `${id}-help` : null,
    oninput: (e) => onInput(e.target.value),
    // 재렌더가 이 필드를 갈아치우는 순간에도 브라우저가 blur를 발생시킨다
    // (포커스가 있던 노드가 DOM에서 떨어져 나가므로). 그 합성 blur까지 실제
    // blur로 취급해 재계산을 걸면 "렌더 → 포커스 노드 제거 → blur → 재계산 →
    // 재렌더 → …" 무한 루프가 된다(브라우저에서 실제로 재현해 크래시까지
    // 확인한 버그). `renderGuard`로 "우리가 지금 막 이 노드를 지운 것"과
    // "사용자가 실제로 포커스를 옮긴 것"을 구분한다 — app.js가 렌더 호출을
    // 감싸는 동안만 true다.
    //
    // 지금은 렌더가 노드를 **고쳐 쓰므로**(app.js `patch`) 평소에는 이 합성
    // blur가 아예 나지 않는다. 그래도 구조가 어긋나 노드를 교체하는 경로는
    // 남아 있어 가드를 없애지 않았다.
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
  });
  return el('div', { class: 'field' }, [
    el('label', { for: id, class: 'field-label' }, [label]),
    el('div', { class: 'field-control' }, [inputEl, suffix ? el('span', { class: 'field-suffix' }, [suffix]) : null]),
    wonPreviewNode(value, error),
    error
      ? el('p', { id: `${id}-error`, class: 'field-error-msg', role: 'alert' }, [error])
      : warning
        ? el('p', { id: `${id}-warning`, class: 'field-warning-msg', role: 'status' }, [warning])
        : help
          ? el('p', { id: `${id}-help`, class: 'field-help' }, [help])
          : null,
  ]);
}

/**
 * "입력값 → 원 단위 환산"을 되비추는 한 줄. 값이 비어 있거나 파싱되지 않으면
 * (오류 메시지가 이미 그 사실을 말하므로) 그리지 않는다 — 두 곳이 같은 사실을
 * 다른 말로 하면 어느 쪽을 믿을지 사용자가 갈린다.
 */
function wonPreviewNode(value, error) {
  if (error || value === '' || value == null) return null;
  const won = parseManwonToWon(value);
  if (Number.isNaN(won)) return null;
  return el('p', { class: 'field-won-preview' }, [`= ${formatKrw(won)}`]);
}

/**
 * `percentField` — D28 수익률 입력. **`numberField`를 재사용하지 않는다** —
 * `numberField`의 원화 미리보기(`wonPreviewNode`)가 `parseManwonToWon`으로
 * 값을 만원 단위로 잘못 해석하게 된다. 이 필드는 퍼센트이지 금액이 아니다.
 *
 * **기본값도, placeholder에 예시 숫자도 넣지 않는다**(0.10절) — `value`는
 * 사용자가 아직 아무것도 치지 않았으면 항상 빈 문자열이고, 이 함수가 그
 * 자리에 아무 숫자도 채워 넣지 않는다.
 */
function percentField({ id, label, value, help, error, onInput, onBlur, renderGuard }) {
  const inputEl = el('input', {
    id,
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'decimal',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : null,
    oninput: (e) => onInput(e.target.value),
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
  });
  return el('div', { class: 'field' }, [
    el('label', { for: id, class: 'field-label' }, [label]),
    el('div', { class: 'field-control' }, [inputEl, el('span', { class: 'field-suffix' }, ['%'])]),
    error
      ? el('p', { id: `${id}-error`, class: 'field-error-msg', role: 'alert' }, [error])
      : help
        ? el('p', { id: `${id}-help`, class: 'field-help' }, [help])
        : null,
  ]);
}

/** `yearsField` — 정산 기간(선택, 년). 금액이 아니므로 `numberField`를 쓰지 않는다. */
function yearsField({ id, label, value, help, error, onInput, onBlur, renderGuard }) {
  const inputEl = el('input', {
    id,
    class: `field-input${error ? ' field-input-error' : ''}`,
    type: 'text',
    inputmode: 'numeric',
    value,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : null,
    oninput: (e) => onInput(e.target.value),
    onblur: (e) => {
      if (!renderGuard?.active) onBlur(e);
    },
  });
  return el('div', { class: 'field' }, [
    el('label', { for: id, class: 'field-label' }, [label]),
    el('div', { class: 'field-control' }, [inputEl, el('span', { class: 'field-suffix' }, ['년'])]),
    error
      ? el('p', { id: `${id}-error`, class: 'field-error-msg', role: 'alert' }, [error])
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

/**
 * `data-key`는 `dom.js`의 `patch`가 노드를 짝지을 때 쓰는 표식이다. 조건부 블록은
 * 나타났다 사라지면서 형제들의 자리를 밀어내는데, 표식이 없으면 `div` 하나가
 * 다른 `div`로 **고쳐 써지면서** 안쪽을 통째로 갈아엎는다. 표식을 붙이면 그 자리는
 * 깔끔한 교체가 되고, 그 위아래의 입력 칸은 건드리지 않는다.
 */
function conditionalGroup(visible, children, key) {
  return visible ? el('div', { class: 'conditional-group', 'data-key': key }, children) : null;
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

// **`sourceGuide()`·`priorTaxField()`가 여기 있었다** [2026-08-11 D39로 폐기].
// 소유자 지시로 직전 과세연도 결정세액 입력·문구를 전부 없앴다 — 그 물음
// 자체가 없으므로 `SourceGuide`("이 값을 어디서 찾나요")도 `KnownOrUnknownField`
// 입력도 그릴 대상이 없다. 컴포넌트가 쓰던 클래스(`.source-guide`·
// `.known-unknown-field` 등)는 `styles.css`에 남아 있을 수 있으나 여기서
// 부르는 자리는 없다. 법정 한도 자체는 사라지지 않는다 — 엔진이 총급여액에서
// 직접 산출한다(`resolveTaxLiabilityCapMock`, D40).

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
/** 청년 우대 블록은 한 번 펼치면 그 세션 동안 펼침 상태를 유지한다(옛 `SourceGuide`와 같은 규약). */
let youthBlockOpen = false;

/**
 * [2026-08-11 D39 §2] 기본 접힘 `<details>` 안에 둔다(screens.md 3.9.3.1절).
 * **펼치면 안의 내용은 그대로다** — 바뀌는 것은 기본 상태(펼침 → 접힘)뿐이다.
 */
function youthBlock({ form, store, provisionalYouth, derivedAgeYears }) {
  // 규칙을 못 읽으면 그리지 않는다 — 룰셋에 근거가 없는 세법 서술을 화면에
  // 두지 않는다는 원칙은 그대로다(design-system 5.28절). **D46 2·3번(관리자
  // 판정) 이후로는 그 근거를 `LawChip`으로 화면에 인쇄하지 않는다** — 게이트
  // 조건(`if (!provisionalYouth) return null`)은 근거의 유무를 계속 지키고,
  // 근거 자체(`provisionalYouth.law`)는 여전히 룰셋의 `source`에서 온 값이다.
  if (!provisionalYouth) return null;

  const showRangeNote = isWithinYouthAgeRange(provisionalYouth.ageRange, derivedAgeYears);

  return el(
    'details',
    {
      class: 'provisional-note-details',
      open: youthBlockOpen,
      ontoggle: (e) => {
        youthBlockOpen = e.target.open;
      },
    },
    [
      el('summary', { class: 'provisional-note-trigger' }, [YOUTH_BLOCK_TRIGGER]),
      el('div', { class: 'provisional-note', 'data-key': 'youthBlock' }, [
        el('h4', { class: 'provisional-note-title' }, [YOUTH_BLOCK_TITLE]),
        showRangeNote ? el('p', { class: 'type-body-s' }, [YOUTH_DECLARED_RANGE_NOTE]) : null,
        el('p', { class: 'type-body-s' }, [YOUTH_AGE_UNDETERMINED_LINE]),
        provisionalYouth.billStage
          ? el('p', { class: 'note-laws' }, [el('span', { class: 'proposed-badge' }, [PROPOSED_BADGE_LABEL])])
          : null,
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
      ]),
    ],
  );
}

export function renderInputPanel({ state, store, boundariesInfo, renderGuard }) {
  const { form, validation, provisionalYouth, result } = state;
  const errors = validation.errors;
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
    // 12.2(c) — ISA 필드가 이미 쓰는 「당해연도」와 어휘를 맞췄다.
    label: '총급여액 (2026년, 당해연도)',
    value: form.currentSalary,
    help: '근로소득 원천징수영수증의 총급여액',
    error: fieldError(errors, 'currentSalary'),
    onInput: (v) => store.setField('currentSalary', v),
    onBlur: () => store.flush(),
    renderGuard,
  });

  // 5.0.0(D27) — 공제율 판정 축의 첫 물음. **`아니오`면 입력이 하나도 안 늘어난다**
  // — 대다수 사용자가 여기다. `예`일 때만 둘째 물음(종합소득금액)이 나타난다.
  const hasNonWageIncomeToggle = segmentToggle({
    id: 'hasNonWageIncome',
    label: HAS_NON_WAGE_INCOME_LABEL,
    value: form.hasNonWageIncome,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => store.setField('hasNonWageIncome', v, { immediate: true }),
    help: HAS_NON_WAGE_INCOME_HELP,
  });
  const globalIncomeField = conditionalGroup(
    form.hasNonWageIncome === true,
    [
      numberField({
        id: 'globalIncomeAmount',
        label: GLOBAL_INCOME_LABEL,
        value: form.globalIncomeAmount,
        help: GLOBAL_INCOME_HELP,
        error: fieldError(errors, 'globalIncomeAmount'),
        onInput: (v) => store.setField('globalIncomeAmount', v),
        onBlur: () => store.flush(),
        renderGuard,
      }),
    ],
    'globalIncomeGroup',
  );

  const priorSalaryCheckbox = el('label', { class: 'checkbox-row' }, [
    el('input', {
      type: 'checkbox',
      checked: form.priorSalaryEnabled,
      onchange: (e) => store.setField('priorSalaryEnabled', e.target.checked, { immediate: true }),
    }),
    el('span', {}, ['직전 과세기간(2025년) 총급여액이 다릅니다']),
  ]);
  // 12.2(c) — 같은 사실을 짧게. "교차확인"이 무엇의 교차확인인지는 체크박스
  // 라벨(ISA 비과세 한도 구간)이 이미 말한다.
  const priorSalaryHelp = el('p', { class: 'field-help' }, ['체크하지 않으면 해당 연도 소득만으로 계산합니다(교차확인 없음).']);
  const priorSalaryField = conditionalGroup(
    form.priorSalaryEnabled,
    [
      numberField({
        id: 'priorSalary',
        label: '총급여액 (2025년, 직전 과세기간)',
        value: form.priorSalary,
        error: fieldError(errors, 'priorSalary'),
        onInput: (v) => store.setField('priorSalary', v),
        onBlur: () => store.flush(),
        renderGuard,
      }),
    ],
    'priorSalaryGroup',
  );

  const groupOne = el('section', { class: 'input-group' }, [
    el('h3', { class: 'input-group-title' }, ['① 기본정보']),
    birthField,
    youthBlock({ form, store, provisionalYouth, derivedAgeYears }),
    // **12.2(d) — 「원천징수영수증에서 오는 값」 구분선을 지웠다.** 낼 세금
    // 입력이 D39로 없어지면서 이 구분선 아래 필드가 사실상 하나(총급여액,
    // 조건부로 둘)만 남아 그룹핑의 값이 옅어졌다(screens.md 12.2(d)).
    salaryField,
    hasNonWageIncomeToggle,
    globalIncomeField,
    priorSalaryCheckbox,
    priorSalaryHelp,
    priorSalaryField,
  ]);

  // ---- 그룹 ② ------------------------------------------------------------
  const capacityField = numberField({
    id: 'monthlyCapacity',
    label: '월 납입 여력',
    // 퇴직급여 입금액·계약이전액이 여기 섞여 들어오면 세액공제액이 과대
    // 계산된다(계약 3.2절). 그래서 "본인이 새로 넣는 돈"임을 명시한다.
    // 12.2(c) — 같은 사실을 더 짧게.
    help: '새로 넣는 돈 기준입니다(퇴직급여 입금액·계약이전액 제외).',
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
      ? el('div', { class: 'eligibility-note', 'data-key': 'annuityStartedNote' }, [
          el('p', { class: 'type-body-s' }, [ANNUITY_STARTED_HORIZON_NOTE]),
        ])
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
        horizonOptions.map((value, index) => {
          const selected = form.fundUseHorizon === value;
          // 캡션의 연수는 **엔진이 룰셋에서 읽어 낸, 이 사용자의 실제 계산값**이다
          // (`fund_use_horizon_boundaries`) — 예시가 아니다. 값이 오지 않으면
          // 캡션 줄 자체를 그리지 않는다 — 라벨만으로 선택이 완결된다(3.4절).
          // **"입력하신 값 기준"을 항상 붙인다** — 아직 고르지 않은 선택지에도
          // 같은 형식의 숫자가 붙어 "가상의 경우"처럼 읽혔던 것을, 말을 지어내지
          // 않고 사실(입력에서 계산됐다는 것)을 캡션 자체에 새겨 바로잡는다.
          //
          // **소유자 3번(D52 3번) — 범위의 위 끝은 이제 라벨 자체에 있다**
          // (`fundUseHorizonLabel`). `within_isa_lock_in`의 캡션은 그래도 남긴다 —
          // 라벨의 숫자(고정된 의무가입기간 총 연수)와 이 캡션의 숫자(**남은**
          // 연수, 이미 계좌를 갖고 있으면 총 연수보다 작을 수 있다)가 다른 사실을
          // 말하기 때문이다. `before_pension_age`는 라벨이 이미 같은 숫자(그
          // 나이까지 남은 연수)를 말하므로 캡션을 중복해 그리지 않는다.
          const caption =
            value === 'within_isa_lock_in' && boundariesInfo?.isa_lock_in_years_remaining != null
              ? `${HORIZON_CAPTION_BASIS_PREFIX} · 남은 의무가입기간 ${formatYears(boundariesInfo.isa_lock_in_years_remaining)}`
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
              el('span', { class: 'horizon-option-head' }, [
                // 숫자 아이콘 — 소유자 지시. 순서만 나타내고 값을 나르지 않으므로
                // `aria-hidden`이다(선택 상태는 `aria-checked`가 이미 말한다).
                el('span', { class: 'horizon-option-index', 'aria-hidden': 'true' }, [String(index + 1)]),
                el('span', { class: 'horizon-option-label' }, [fundUseHorizonLabel(value, boundariesInfo)]),
              ]),
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
    el('h3', { class: 'input-group-title' }, ['② 월 납입액']),
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
  // [게이트 6 D46] 누적 납입액이 채워졌을 때만 나타난다 — 0이면 이 값이
  // 연간 한도의 이월분 계산에 아무 영향을 주지 않는다. 이 파일 머리말의
  // 일반 원칙(명시적 진술만 조건으로 쓴다, D14)의 예외를 여기서만 둔다
  // (`isaYearsSinceOpeningVisible`의 주석 참고).
  const isaYearsSinceOpeningField = yearsField({
    id: 'isaYearsSinceOpening',
    label: ISA_YEARS_SINCE_OPENING_LABEL,
    value: form.isaYearsSinceOpening,
    error: fieldError(errors, 'isaYearsSinceOpening'),
    help: ISA_YEARS_SINCE_OPENING_HELP,
    onInput: (v) => store.setField('isaYearsSinceOpening', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const isaYearsSinceOpeningGroup = conditionalGroup(
    isaYearsSinceOpeningVisible(form),
    [isaYearsSinceOpeningField],
    'isaYearsSinceOpeningGroup',
  );
  // **ISA 보유 여부 토글 밖으로 뗐다(2026-08-10).** 엔진은 ISA 미보유
  // 사용자에게도 신규 가입을 전제로 배분하고(`isa_new_account_assumed`),
  // 계약 3.2절에서 `account_type`은 `exists`와 독립된 선택 필드다 — 일반형/
  // 서민형은 소득 요건이지 계좌 보유 여부가 아니다. 이 토글이 `isaBlock`
  // 안(= `isaExists`가 `true`일 때만)에 있으면 ISA가 없는 사람은 유형을
  // 선언할 자리가 없어, 비과세 한도 표시와(계약 3.2·5.3절) 수익률 가정
  // 기반 정산액(⑤ 그룹)이 유형 미선언으로 항상 계산되지 못했다. **묻는
  // 말은 보유 여부에 따라 달라진다** — 이미 가진 것처럼 묻지 않는다
  // (`isaAccountTypeLabel`).
  const isaTypeToggle = segmentToggle({
    id: 'isaAccountType',
    label: isaAccountTypeLabel(form.isaExists),
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

  // `isaTypeToggle`은 더 이상 이 조건부 블록 안에 없다 — 위 주석 참고.
  const isaBlock = conditionalGroup(
    form.isaExists,
    [isaCumulativeField, isaYearsSinceOpeningGroup, isaYtdField, financialIncomeToggle],
    'isaBlock',
  );

  const groupThree = el('section', { class: 'input-group' }, [
    el('h3', { class: 'input-group-title' }, ['③ 계좌 현황']),
    // 12.2(c) — 같은 사실을 더 짧게.
    el('p', { class: 'field-help' }, ['계좌가 없으면 0, 새로 넣은 금액만 적습니다.']),
    annuityField,
    retirementField,
    isaExistsToggle,
    isaTypeToggle,
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

    const transferInner = conditionalGroup(
      form.isaTransferEnabled,
      [transferAmountField, destinationToggle, destinationHelp, priorAppliedField],
      'isaTransferGroup',
    );

    groupFour = el('section', { class: 'input-group input-group-conditional', 'data-key': 'groupFour' }, [
      el('h3', { class: 'input-group-title' }, ['④ ISA 만기 자금 전환']),
      transferToggle,
      transferInner,
    ]);
  }

  // ---- 그룹 ⑤ — 수익률 가정 (D28·D29·D31) ----------------------------------
  //
  // **소유자 지시(screens.md 3.11.4(b))보다 이 필드군을 우선한다.** 그 규약은
  // 이 계약(5.1.0)이 들어오기 전에 정해졌고, 이 다섯 필드(토글·수익률·소득
  // 성격·정산 기간·손실액)를 기존 그룹 어디에 넣어도 그 그룹의 주제와
  // 어긋난다 — "④ ISA 만기 자금 전환"과는 별개의 질문이다. 새 그룹을 만드는
  // 판단은 `designer` 확인이 필요한 항목으로 최종 보고에 남긴다.
  //
  // **`isaExists` 조건을 걷어냈다(2026-08-10 — 소유자 신고 대응).** 초판은
  // 이 그룹 전체를 "④ ISA 만기 자금 전환"과 나란히 `if (form.isaExists)`로
  // 묶었다. 그런데 엔진은 ISA 미보유자에게도 **신규 가입을 전제로** ISA에
  // 배분한다(`isa_new_account_assumed`, `accounts.isa.exists: false`) — 배분은
  // 받는데 그 배분에 얹을 수익률은 넣을 자리가 없는 상태가 됐다. 수익률
  // 가정은 ISA 혜택 **추정에만** 쓰이고 배분·공제액·순서·경고를 바꾸지
  // 않으므로(`echo.isa_return_affects`, 계약 4.2절), 계좌 보유 여부와 함께
  // 묻힐 이유가 없다. `state/validation.js`·`state/store.js`의 대응하는
  // `isaExists` 조건도 같은 근거로 함께 걷어냈다 — 여기만 고치면 토글은
  // 보이는데 값은 조용히 버려지는 상태가 됐을 것이다.
  //
  // **기본값도, placeholder 예시 숫자도 없다.** 토글은 꺼진 채로 시작하고
  // (`initialForm`), 사용자가 스스로 켜야 나머지 넷이 나타난다 — 이 서비스가
  // 수익률을 제안하지 않는다는 구분이 D31 이후 남은 방어선 전부다(0.10절).
  const returnToggle = segmentToggle({
    id: 'isaReturnEnabled',
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
    id: 'isaReturnRatePercent',
    label: ISA_RETURN_RATE_LABEL,
    value: form.isaReturnRatePercent,
    error: fieldError(errors, 'isaReturnRatePercent', { showMissing: true }),
    onInput: (v) => store.setField('isaReturnRatePercent', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const characterToggle = segmentToggle({
    id: 'isaIncomeCharacter',
    label: ISA_RETURN_INCOME_CHARACTER_LABEL,
    value: form.isaIncomeCharacter,
    options: ISA_INCOME_CHARACTERS.map((id) => ({ value: id, label: ISA_INCOME_CHARACTER_LABEL[id] })),
    onChange: (v) => store.setField('isaIncomeCharacter', v, { immediate: true }),
    help: ISA_RETURN_INCOME_CHARACTER_HELP,
  });
  // 버튼 라벨은 짧다 — 고른 항목의 예시를 그 아래 한 줄로 구체화한다.
  const characterExample = form.isaIncomeCharacter
    ? el('p', { class: 'field-help' }, [ISA_INCOME_CHARACTER_EXAMPLE[form.isaIncomeCharacter]])
    : null;
  const settlementYearsFieldNode = yearsField({
    id: 'isaSettlementYears',
    label: ISA_RETURN_SETTLEMENT_YEARS_LABEL,
    value: form.isaSettlementYears,
    error: fieldError(errors, 'isaSettlementYears'),
    help: ISA_RETURN_SETTLEMENT_YEARS_HELP,
    onInput: (v) => store.setField('isaSettlementYears', v),
    onBlur: () => store.flush(),
    renderGuard,
  });
  const lossField = numberField({
    id: 'isaLossAmount',
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
    'isaReturnGroup',
  );

  // **`input-group-conditional`(accent-subtle 강조)을 쓰지 않는다.** 그 표시는
  // "앞선 답 때문에 나타난 그룹"(예: ④)에 쓰는 것이고, 이 그룹은 이제 앞선
  // 답과 무관하게 항상 있다 — ①②③과 같은 성격의 그룹이다.
  const groupFive = el('section', { class: 'input-group', 'data-key': 'groupFive' }, [
    el('h3', { class: 'input-group-title' }, [ISA_RETURN_SECTION_TITLE]),
    returnToggle,
    returnInner,
  ]);

  const resetButton = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-text',
      // 브라우저 모달(`confirm`)을 쓰지 않는다 — 샌드박스 iframe이 조용히 막으면
      // 버튼이 죽은 것처럼 보인다(copy.js `RESET_CONFIRM_TITLE` 머리말). 확인은
      // 화면 안에서 받는다(screens.md 3.2절 · design-system 5.18절).
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
    el('div', { class: 'input-panel-header' }, [el('h2', { class: 'panel-title' }, ['입력']), resetButton]),
    groupOne,
    groupTwo,
    groupThree,
    groupFour,
    groupFive,
  ]);
}
