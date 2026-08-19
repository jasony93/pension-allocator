/**
 * `[14-C]` `WithdrawalStrategyCards` — 수령 전략 비교. 컴포넌트 명세는
 * `design-system.md` 5.36절, 배치는 `screens.md` 14.3.4절.
 *
 * **스택바가 아니라 카드 셋을 가로로 나열한다** — 세 전략은 공통 분모가
 * 없는 서로 배타적인 법정 경로이지 같은 총액의 다른 나눔이 아니다(5.36절).
 * 세 카드는 항상 같은 표면(`surface-raised`)이고, 색으로도 순서로도 우열을
 * 매기지 않는다(AC-R19).
 */

import { el } from './dom.js';
import { formatPercentTrimmed } from '../format.js';
import {
  STRATEGY_TITLE,
  TAX_OPTION_LABEL,
  EXCEED_THRESHOLD_UNDETERMINED_LINE,
  ELECTIVE_BASIS_UNDETERMINED_LINE,
  EXCEED_THRESHOLD_NOT_APPLICABLE_LINE,
  ISA_HELD_WITHDRAWAL_UNDETERMINED_LINE,
  isaDeemedTerminationLine,
  reverseNoticeMessage,
} from '../reverse-copy.js';
import { reverseLawEntriesFor, reverseLawChipRow, amountWithTodayCurrency } from './reverse-shared.js';

function withinThresholdCard(strategy, legalBasis) {
  return el('div', { class: 'withdrawal-strategy-card', 'data-key': 'strategy-within-threshold' }, [
    el('h4', { class: 'type-body-strong' }, [STRATEGY_TITLE.within_threshold]),
    el('p', { class: 'type-body-s' }, [
      `사적연금 합계를 ${amountWithTodayCurrency(strategy.private_pension_annual_krw)} 이내로 맞추는 배분입니다.`,
    ]),
    el('p', { class: 'type-body-s' }, [
      `연 ${formatPercentTrimmed(strategy.first_year_withholding.rate)}로 원천징수되어 과세가 종결됩니다.`,
    ]),
    reverseLawChipRow(reverseLawEntriesFor(legalBasis, strategy.basis_rule_ids)),
  ]);
}

function exceedThresholdCard(strategy, legalBasis) {
  const lines = [
    el('h4', { class: 'type-body-strong' }, [STRATEGY_TITLE.exceed_threshold]),
  ];

  if (strategy.comparison_code === 'threshold_not_exceeded') {
    lines.push(el('p', { class: 'type-body-s' }, [EXCEED_THRESHOLD_NOT_APPLICABLE_LINE]));
    lines.push(reverseLawChipRow(reverseLawEntriesFor(legalBasis, strategy.basis_rule_ids)));
    return el('div', { class: 'withdrawal-strategy-card', 'data-key': 'strategy-exceed-threshold' }, lines);
  }

  lines.push(
    el('p', { class: 'type-body-s' }, [
      `사적연금 합계 ${amountWithTodayCurrency(strategy.private_pension_annual_krw)}이 문턱을 넘습니다.`,
    ]),
  );
  lines.push(reverseLawChipRow(reverseLawEntriesFor(legalBasis, strategy.basis_rule_ids)));

  if (strategy.comparison_code === 'determined') {
    const lowerLabel = TAX_OPTION_LABEL[strategy.lower_option_code] ?? strategy.lower_option_code;
    lines.push(
      el('p', { class: 'type-body-s' }, [
        `${lowerLabel}이 더 낮습니다`,
        strategy.first_year_after_tax_krw != null ? ` (세후 ${amountWithTodayCurrency(strategy.first_year_after_tax_krw)})` : '',
      ]),
    );
  } else if (strategy.comparison_code === 'elective_basis_undetermined') {
    lines.push(el('p', { class: 'type-body-s withdrawal-strategy-undetermined' }, [ELECTIVE_BASIS_UNDETERMINED_LINE]));
  } else {
    // 'other_income_unknown' — AC-R10. 유불리를 판정하지 않는다.
    lines.push(el('p', { class: 'type-body-s withdrawal-strategy-undetermined' }, [EXCEED_THRESHOLD_UNDETERMINED_LINE]));
  }

  return el('div', { class: 'withdrawal-strategy-card', 'data-key': 'strategy-exceed-threshold' }, lines);
}

function isaSupplementCard(strategy, legalBasis) {
  const path = strategy.pension_conversion_path;
  const pathLine =
    path.path_open === true
      ? '가입경과연수가 최소 연수 이상이라 연금계좌로 전환하는 경로가 열려 있습니다. 이 경로는 문턱을 쓰지 않습니다.'
      : reverseNoticeMessage({
          code: 'reverse_isa_conversion_path_not_open',
          params: { min_contract_years: path.min_contract_years },
        });

  const withdrawal = strategy.contract_held_withdrawal;
  const withdrawalNodes = [];
  if (withdrawal.deemed_terminated !== null) {
    withdrawalNodes.push(el('p', { class: 'type-body-s' }, [isaDeemedTerminationLine(withdrawal.deemed_terminated)]));
  }
  withdrawalNodes.push(
    el('p', { class: 'type-body-s withdrawal-strategy-undetermined' }, [ISA_HELD_WITHDRAWAL_UNDETERMINED_LINE]),
  );

  return el('div', { class: 'withdrawal-strategy-card', 'data-key': 'strategy-isa-supplement' }, [
    el('h4', { class: 'type-body-strong' }, [STRATEGY_TITLE.isa_supplement]),
    el('p', { class: 'type-body-s' }, [pathLine]),
    reverseLawChipRow(reverseLawEntriesFor(legalBasis, strategy.basis_rule_ids)),
    ...withdrawalNodes,
  ]);
}

/**
 * @param {object} params
 * @param {Array} params.payoutStrategies `PensionReverseResponse.payout_strategies` — 길이 2 또는 3
 * @param {Array} params.legalBasis `PensionReverseResponse.legal_basis`
 */
export function renderWithdrawalStrategyCards({ payoutStrategies, legalBasis }) {
  if (!payoutStrategies || !payoutStrategies.length) return null;
  const cards = payoutStrategies.map((strategy) => {
    if (strategy.strategy_code === 'within_threshold') return withinThresholdCard(strategy, legalBasis);
    if (strategy.strategy_code === 'exceed_threshold') return exceedThresholdCard(strategy, legalBasis);
    return isaSupplementCard(strategy, legalBasis);
  });

  return el('section', { class: 'withdrawal-strategy-cards', 'data-key': 'withdrawalStrategyCards' }, [
    el('h3', { class: 'type-title-s' }, ['③ 수령 전략 비교']),
    el('div', { class: 'withdrawal-strategy-grid' }, cards),
  ]);
}
