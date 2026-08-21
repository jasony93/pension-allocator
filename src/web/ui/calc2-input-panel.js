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
 *
 * **[2026-08-21, D80] 더 벗겼다 — 셋.**
 * 1. **중항목 라벨 굵게**(판정 3, 스타일 지시) — `.calc2-input-panel
 *    .field-label { font-weight: 700 }`(styles.css) 한 규칙으로 끝난다,
 *    이 파일은 손대지 않는다.
 * 2. **「올해 이미 넣은 돈」 입력 전부 삭제 + 0 가정**(판정 1) — 연금저축·
 *    IRP 당해연도 누적, ISA 가입 이후 누적·당해연도 누적 넷을 없앴다.
 *    이 필드들의 입력 자체가 없으므로 `form.*`가 `initialForm()`의 빈
 *    문자열을 벗어날 길이 없고, `state/store.js`의 `manwonToWonOrZero`가
 *    그 값을 그대로 0으로 본다 — 화면 캡션은 두지 않는다(이 주석이 기록).
 *    **연쇄로 「ISA 만기 자금 전환」 블록도 없앴다** — 전환 금액은 ISA
 *    가입 이후 누적 이하여야 하는데(state/validation.js), 그 누적이 항상
 *    0이면 0보다 큰 전환 금액은 영원히 검증에 걸린다 — 채울 수 없는
 *    질문을 남기지 않는다.
 * 3. **조건절·근거 문구 넷 삭제**(판정 2) — 프리필 안내줄(이 파일이
 *    더는 그리지 않는다), 헤드라인 밑 조건절·이월 개정안 경고·「두
 *    연금계좌 중 왜 이 순서인가」(전부 `ui/result-panel.js`의 공유
 *    컴포넌트 — `resultKey === 'calc2'`일 때만 끈다, 그 파일 주석 참고).
 */

import { el } from './dom.js';
import { iconProfile, iconWallet, iconBank, iconTrend } from './icons.js';
import {
  numberField,
  percentField,
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
  ISA_RETURN_SECTION_TITLE,
  ISA_RETURN_TOGGLE_LABEL,
  ISA_RETURN_SECTION_HELP,
  ISA_RETURN_RATE_LABEL,
} from '../copy.js';
import { CALC2_MORE_INFO_TRIGGER, CALC2_ESSENTIAL_GROUP_TITLE } from '../calc2-copy.js';
import { ISA_INCOME_CHARACTERS } from '../state/validation.js';
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

  // [2026-08-21, D80 판정 1] 「올해 이미 넣은 돈」 필드를 전부 없앤다 —
  // 연금저축·IRP의 당해연도 누적 입력(`annuityField`·`retirementField`,
  // 옛 구현)을 지운다. 이 필드가 없으면 `form.annuitySavingsYtd`·
  // `form.retirementPensionYtd`는 계산기2에서 어떤 경로로도 초기값(`''`)을
  // 벗어나지 않고, `state/store.js`의 `manwonToWonOrZero`가 빈 문자열을
  // `0`으로 본다 — 그래서 엔진 요청은 프리필·사용자 편집 어느 경로든 항상
  // `ytd_contribution_krw: 0`을 싣는다(소유자가 "결과는 어느 정도 가정을
  // 해서 보여줘"로 이 0 가정을 명시 승인했다). **화면 캡션은 두지 않는다**
  // — 이 주석이 그 판정을 기록한다.

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
  // [2026-08-21, D80 판정 1] ISA 누적 입력 둘(가입 이후 누적·당해연도 누적)도
  // 같은 이유로 없앤다 — `form.isaCumulative`·`form.isaYtd`가 계산기2에서
  // 초기값(`''`)을 벗어날 길이 없어 엔진 요청은 항상 두 값 다 0을 싣는다.
  // **`isaYearsSinceOpeningField`(경과연수 칸)도 함께 사라진다** —
  // `isaYearsSinceOpeningVisible`(state/validation.js)이 "누적 납입액이
  // 0보다 클 때만" 그 칸을 보이는데, 누적 입력 자체가 없어져 그 조건이
  // 계산기2에서는 항상 거짓이다 — 화면에 나타날 수 없는 칸을 코드에
  // 남기지 않는다.
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
  const isaBlock = conditionalGroup(form.isaExists, [financialIncomeToggle], 'calc2IsaBlock');

  // [2026-08-21, D80 판정 1] 「ISA 만기 자금 전환」 블록도 함께 없앤다 —
  // 전환 금액은 검증상 반드시 `isaCumulative`(가입 이후 누적) 이하여야
  // 하는데(`state/validation.js`의 `exceeds_cumulative`), 그 누적 입력이
  // 없어져 값이 항상 0으로 고정되면 0보다 큰 전환 금액은 어떤 값을 넣어도
  // 영원히 "누적 납입액을 넘었다" 오류가 난다 — 채울 수 없는 질문을 남기지
  // 않는다.

  // ---- ISA 예상 수익률(선택 — 계산기2는 이 한 칸까지만 묻는다) --------------
  // [신규 회차] ISA 입력 축소 — 소유자 지시. 첫 탭 groupFive는 다섯 필드
  // (토글·수익률·소득 성격·정산 기간·손실액)를 묻지만, 계산기2는 **수익률
  // 까지만** 묻는다. 뒤 셋(소득 성격·정산 기간·손실액)을 뺐다.
  //
  // **엔진 계약 확인 결과.** `state/store.js`의 `buildIsaReturnAssumption`은
  // `income_character`가 `ISA_INCOME_CHARACTERS`(세 값) 중 하나가 아니면
  // 정산액 추정 객체 전체를 `null`로 접는다 — 이 필드에는 "기본 경로"가
  // 없다(계약이 필수로 요구한다). 정산 기간·손실액은 다르다 — 계약이 이미
  // "모르면 채우지 않는다 → 룰셋 하한/0으로 본다"는 최소가정 기본 경로를
  // 정의해 뒀다(`buildIsaReturnAssumption` 주석). 그래서 이 둘은 화면에서
  // 지워도 자동으로 가장 보수적인 값으로 계산된다 — 손댈 코드가 없다.
  //
  // **소득 성격만 골라야 했다.** 셋 중 `'mixed_or_unknown'`("수익 성격을
  // 모른다/섞였다")을 골랐다 — 계약 3.6절이 이미 정의한 "모른다" 값이지
  // 화면이 새로 지어낸 답이 아니다(D80 계보 — 가장 가정이 적은 쪽). 물음
  // 자체를 없앴으므로 이 값은 **토글을 켤 때 조용히 채운다**(사용자가
  // 답한 것처럼 보이면 안 되지만, 안 채우면 수익률을 입력해도 추정 자체가
  // 서지 않아 이 칸을 두는 의미가 없어진다).
  const returnToggle = segmentToggle({
    id: 'calc2IsaReturnEnabled',
    label: ISA_RETURN_TOGGLE_LABEL,
    value: form.isaReturnEnabled,
    options: [
      { value: false, label: '아니오' },
      { value: true, label: '예' },
    ],
    onChange: (v) => {
      store.setField('isaReturnEnabled', v, { immediate: true });
      if (v && !ISA_INCOME_CHARACTERS.includes(form.isaIncomeCharacter)) {
        store.setField('isaIncomeCharacter', 'mixed_or_unknown', { immediate: true });
      }
    },
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
  const returnInner = conditionalGroup(form.isaReturnEnabled, [rateField], 'calc2IsaReturnGroup');
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
          isaExistsToggle,
          isaTypeToggle,
          isaBlock,
        ]),
        returnGroup,
        youthBlock({ form, store, provisionalYouth, derivedAgeYears, idPrefix: 'calc2' }),
      ]),
    ],
  );

  // [2026-08-21, D80 판정 2] 프리필 안내줄을 지운다 — 소유자가 조건절·근거
  // 문구 넷 중 하나로 명시로 지목했다(D59~D61 계보와 같은 성질). D79
  // 판정 2가 요구했던 자리였지만, 이번 회차가 그 요구를 뒤집는다.
  return el('div', { class: 'input-panel calc2-input-panel' }, [essentialGroup, moreInfo]);
}
