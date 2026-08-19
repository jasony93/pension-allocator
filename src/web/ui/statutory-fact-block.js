/**
 * `[14-A]` `StatutoryFactBlock` — 법정 사실 블록. 컴포넌트 명세는
 * `design-system.md` 5.34절, 배치는 `screens.md` 14.3.2절.
 *
 * **이 블록은 고지가 아니라 결과의 1급 산출물이다** — `state-info` 파랑을
 * 쓰지 않는다. 중립 카드(`surface-raised`)를 쓴다.
 */

import { el } from './dom.js';
import {
  STATUTORY_BLOCK_TITLE,
  MINIMUM_START_BALANCE_LABEL,
  LEGAL_SUCCESS_LABEL,
  LEGAL_SUCCESS_HOLDS,
  PRE_2013_CAPTION_MAIN,
  PRE_2013_CAPTION_DETAIL,
  CAP_BINDS_FIRST_LINE,
  CONTRIBUTION_CEILING_EXCEEDED,
  SOURCE_LABEL,
} from '../reverse-copy.js';
import { reverseLawEntriesFor, reverseLawChipRow, amountWithTodayCurrency } from './reverse-shared.js';

function thresholdTable(rows, legalBasis) {
  return el('table', { class: 'statutory-fact-table' }, [
    el('thead', {}, [
      el('tr', {}, [el('th', {}, ['재원']), el('th', {}, ['문턱 사용']), el('th', {}, ['근거'])]),
    ]),
    el(
      'tbody',
      {},
      rows.map((row) =>
        el('tr', {}, [
          el('td', {}, [SOURCE_LABEL[row.source_code] ?? row.source_code]),
          el('td', {}, [row.consumes_threshold ? '사용함' : '사용 안 함']),
          el('td', {}, [reverseLawChipRow(reverseLawEntriesFor(legalBasis, row.basis_rule_ids))]),
        ]),
      ),
    ),
  ]);
}

/**
 * @param {object} params
 * @param {object|null} params.statutoryFacts `PensionReverseResponse.statutory_facts`
 * @param {Array} params.legalBasis `PensionReverseResponse.legal_basis`
 * @param {object|null} params.contributionScenario `PensionReverseResponse.contribution_scenario` —
 *   `null`이면 "세 계좌 법정 납입 상한과의 비교" 행이 아직 나오지 않는다(14.3.2절).
 */
export function renderStatutoryFactBlock({ statutoryFacts, legalBasis, contributionScenario }) {
  if (!statutoryFacts) return null;
  const msb = statutoryFacts.minimum_start_balance;
  const rows = statutoryFacts.threshold_consumption.rows;

  const minBalanceSection = el('div', { class: 'statutory-fact-row' }, [
    el('p', { class: 'type-body-s statutory-fact-label' }, [MINIMUM_START_BALANCE_LABEL]),
    el('p', { class: 'type-display statutory-fact-amount' }, [amountWithTodayCurrency(msb.required_krw)]),
    reverseLawChipRow(reverseLawEntriesFor(legalBasis, msb.basis_rule_ids)),
    // GC-P5b — 접지 않는다(design-system 5.34절 "2013-03-01 캡션" 규약).
    el('p', { class: 'type-caption' }, [PRE_2013_CAPTION_MAIN]),
    el('p', { class: 'type-caption statutory-fact-caption-detail' }, [`▸ ${PRE_2013_CAPTION_DETAIL}`]),
  ]);

  /**
   * "월 수령액의 법정 성립 여부" — `engine-interface.md` 8.1절이 `annuity_
   * start_below_minimum_age`를 정의하며 명시한 대로("성립하지 않는 개시
   * 시점 위에서 낸 「최소 평가액」은 사실이 아니다"), 이 블록이 서 있다는
   * 사실 자체가 이미 개시 시점이 최소 개시 연령 요건을 통과했다는 뜻이다
   * (AC-R5가 그 반대 경우를 걸러 블록 자체를 없앤다). 그 요건을 통과하면
   * `minimum_start_balance.required_krw`는 언제나 계산 가능한 하한이므로,
   * 이 블록이 나타나는 동안 이 문장이 "성립하지 않음"이 되는 별도의 엔진
   * 신호는 이 계약에 없다 — 그래서 이 블록이 서 있는 한 이 문장은 언제나
   * "성립함"이다. (최종 보고에 판단 근거로 남긴다.)
   */
  const legalSuccessSection = el('div', { class: 'statutory-fact-row' }, [
    el('p', { class: 'type-body' }, [`${LEGAL_SUCCESS_LABEL}: `, el('strong', {}, [LEGAL_SUCCESS_HOLDS])]),
    reverseLawChipRow(reverseLawEntriesFor(legalBasis, msb.basis_rule_ids)),
    // AC-R12 — 문턱보다 짧으면 표시, 아니면 표시하지 않는다.
    msb.cap_binds_before_balance
      ? el('div', { class: 'statutory-fact-cap-binds' }, [
          el('p', { class: 'type-caption statutory-fact-warning-text' }, [`▸ ${CAP_BINDS_FIRST_LINE}`]),
          reverseLawChipRow(reverseLawEntriesFor(legalBasis, msb.basis_rule_ids)),
        ])
      : null,
  ]);

  const thresholdSection = el('div', { class: 'statutory-fact-row' }, [
    el('p', { class: 'type-body-s statutory-fact-label' }, ['재원별 사적연금 분리과세 문턱 사용 여부']),
    thresholdTable(rows, legalBasis),
  ]);

  // 14.3.2절 — `[14-B]`가 실제 금액을 낸 뒤에만 추가된다.
  const ceilingSection = contributionScenario
    ? el('div', { class: 'statutory-fact-row' }, [
        el('p', { class: 'type-body-s statutory-fact-label' }, ['세 계좌 법정 납입 상한과의 비교']),
        el('p', { class: 'type-body' }, [amountWithTodayCurrency(statutoryFacts.contribution_ceiling.total_monthly_krw)]),
        reverseLawChipRow(reverseLawEntriesFor(legalBasis, statutoryFacts.contribution_ceiling.basis_rule_ids)),
        contributionScenario.exceeds_statutory_contribution_ceiling
          ? el('p', { class: 'type-caption statutory-fact-warning-text' }, [`▸ ${CONTRIBUTION_CEILING_EXCEEDED}`])
          : null,
      ])
    : null;

  return el('section', { class: 'statutory-fact-block', 'data-key': 'statutoryFactBlock' }, [
    el('h3', { class: 'type-title-s' }, [`① ${STATUTORY_BLOCK_TITLE}`]),
    minBalanceSection,
    legalSuccessSection,
    thresholdSection,
    ceilingSection,
  ]);
}
