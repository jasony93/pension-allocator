/**
 * 연금 역산기 탭의 결과 패널. `screens.md` 14.3·14.4절 — 세 블록
 * (`StatutoryFactBlock`·`ContributionAmountBar`·`WithdrawalStrategyCards`)의
 * 위계와 다섯 상태(입력 부족·빈·로딩·오류·정상/모름)를 구현한다.
 */

import { el } from './dom.js';
import { renderStatutoryFactBlock } from './statutory-fact-block.js';
import { renderContributionAmountBar } from './contribution-amount-bar.js';
import { renderWithdrawalStrategyCards } from './withdrawal-strategy-cards.js';
import { REVERSE_CORE_REQUIREMENTS } from '../state/reverse-validation.js';
import {
  CONTRIBUTION_SCENARIO_ABSENT_LINE,
  PREFILL_BUTTON_LABEL,
  PREFILL_CAPTION,
  TODAY_CURRENCY_NOTE,
  INPUT_INCOMPLETE_TITLE,
  WHAT_THIS_SHOWS_TITLE,
  WHAT_THIS_SHOWS_LINES,
  BROWSER_ONLY_NOTE,
} from '../reverse-copy.js';
import { errorMessage } from '../copy.js';

function reverseRequirementChecklist(state) {
  const { form, validation } = state;
  const items = REVERSE_CORE_REQUIREMENTS.map((req) => {
    const filled = form[req.key] !== '' && form[req.key] != null && !validation.errors[req.key];
    return el('button', { type: 'button', class: 'req-item', 'data-key': req.key, onclick: () => focusReverseField(req.fieldId) }, [
      el('span', { class: 'req-dot', 'aria-hidden': 'true' }, [filled ? '●' : '○']),
      el('span', {}, [req.label]),
      el('span', { class: 'req-status' }, [filled ? '입력됨' : '→ 입력하기']),
    ]);
  });

  const total = validation.requiredTotal;
  const filledCount = validation.requiredFilledCount;

  return el('div', { class: 'requirement-checklist' }, [
    el('div', { class: 'req-progress-row' }, [
      el('span', { class: 'type-title-m' }, [INPUT_INCOMPLETE_TITLE]),
      el('span', { class: 'req-progress-label' }, [`${filledCount} / ${total}`]),
    ]),
    el('div', { class: 'req-progress-bar' }, [
      el('div', { class: 'req-progress-fill', style: { width: `${(filledCount / total) * 100}%` } }),
    ]),
    el('div', { class: 'req-checklist-box' }, items),
    // 분모 밖 안내 — 평균 수익률은 미입력이어도 진행을 막지 않는다(14.4.1절).
    el('p', { class: 'field-help' }, ['▸ 평균 수익률 — 입력하면 계좌별 월 납입액이 함께 표시됩니다']),
  ]);
}

function focusReverseField(id) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus();
  }
}

/**
 * 입력 부족 상태의 결과 자리(14.4.1절). **도넛·링 자리표시자를 가져오지
 * 않는다** — 이 탭의 결과가 표·막대·카드 세 형태로 나뉘어 있어 하나를
 * 흉내 내는 자리표시자는 나머지 둘에 대해 거짓 예고가 된다. 카드 윤곽만
 * 값 없이 그린다.
 */
function reverseInputIncompletePanel(state) {
  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'result-body' }, [
      reverseRequirementChecklist(state),
      el('div', { class: 'statutory-fact-block statutory-fact-block-placeholder' }, [
        el('h3', { class: 'type-title-s' }, ['법정 사실']),
        el('p', { class: 'type-body-s' }, ['값을 모두 넣으면 여기에 표시됩니다']),
      ]),
      el('div', { class: 'expectation-block' }, [
        el('h3', { class: 'type-title-s' }, [WHAT_THIS_SHOWS_TITLE]),
        el(
          'ul',
          {},
          WHAT_THIS_SHOWS_LINES.map((line) => el('li', {}, [line])),
        ),
      ]),
      el('p', { class: 'entry-copy' }, [BROWSER_ONLY_NOTE]),
    ]),
  ]);
}

function errorPanel(state) {
  const message = state.engineFieldError ? errorMessage({ code: state.engineFieldError.code, params: state.engineFieldError.params }) : null;
  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'inline-alert inline-alert-error', role: 'alert' }, [
      el('p', { class: 'type-body-strong' }, [message ?? '연금 개시일을 확인해 주세요.']),
      el('button', { type: 'button', class: 'btn btn-text', onclick: () => focusReverseField('annuityStartDate') }, ['→ 항목 보기']),
    ]),
  ]);
}

function reverseFatalErrorPanel() {
  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'inline-alert inline-alert-error', role: 'alert' }, [
      el('p', { class: 'type-body-strong' }, ['계산에 필요한 세법 규칙을 불러오지 못했습니다. 결과를 표시하지 않습니다.']),
    ]),
  ]);
}

/**
 * `[14-D]` 절세계좌 계산기로의 연결 — 총액 프리필까지만(AC-R21·AC-R22).
 * `contributionScenario`가 있을 때만(=②가 값을 낸 뒤) 나타난다.
 */
function prefillSection(contributionScenario, onPrefill) {
  if (!contributionScenario) return null;
  const totalMonthlyKrw = contributionScenario.allocated_monthly_total_krw;
  return el('div', { class: 'reverse-prefill', 'data-key': 'reversePrefill' }, [
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-secondary',
        onclick: () => onPrefill?.(totalMonthlyKrw),
      },
      [PREFILL_BUTTON_LABEL],
    ),
    el('p', { class: 'field-help' }, [PREFILL_CAPTION]),
  ]);
}

/** `[14-E]` 한계·범위 고지 — 오늘 화폐 기준(AC-R24)·종신형/다년 시뮬레이션 비범위(AC-R23·AC-R25). */
function scopeNote() {
  return el('div', { class: 'reverse-scope-note' }, [
    el('p', { class: 'type-caption' }, [
      `이 결과의 모든 금액은 ${TODAY_CURRENCY_NOTE}입니다. 종신형 연금상품은 다루지 않고, 연차별 잔액·세액 변화를 보여주는 완전한 다년 시뮬레이션도 제공하지 않습니다.`,
    ]),
  ]);
}

function resultPanel(state, { onPrefill }) {
  const { result } = state;
  const contributionScenarioBlock = result.contribution_scenario
    ? renderContributionAmountBar({ contributionScenario: result.contribution_scenario })
    : el('p', { class: 'field-help contribution-amount-absent', 'data-key': 'contributionScenarioAbsent' }, [
        CONTRIBUTION_SCENARIO_ABSENT_LINE,
      ]);

  return el('div', { class: 'result-panel-inner' }, [
    el('div', { class: 'result-body' }, [
      renderStatutoryFactBlock({
        statutoryFacts: result.statutory_facts,
        legalBasis: result.legal_basis,
        contributionScenario: result.contribution_scenario,
      }),
      contributionScenarioBlock,
      renderWithdrawalStrategyCards({ payoutStrategies: result.payout_strategies, legalBasis: result.legal_basis }),
      prefillSection(result.contribution_scenario, onPrefill),
      scopeNote(),
    ]),
  ]);
}

export function renderReverseResultPanel({ state, onPrefill }) {
  const { status } = state;
  if (status === 'fatal_error') return reverseFatalErrorPanel();
  if (status === 'error') return errorPanel(state);
  if (status === 'blank' || status === 'input_incomplete') return reverseInputIncompletePanel(state);
  // 'loading'·'result' — 로딩 중에도 직전 결과가 있으면 그것을 남긴다
  // (design-system 6.1절 4번). 첫 결과를 아직 못 냈으면 입력 부족과 같은
  // 자리를 임시로 보여준다(스켈레톤 대신 — 이 탭은 형태가 하나로
  // 통일되어 있지 않아 스켈레톤이 특정 형태를 거짓 예고한다, 14.4.1절과
  // 같은 원칙을 로딩에도 적용).
  if (!state.result) return reverseInputIncompletePanel(state);
  const panel = resultPanel(state, { onPrefill });
  if (status === 'loading') panel.classList.add('result-loading-overlay');
  return panel;
}
