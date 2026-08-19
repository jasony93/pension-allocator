/**
 * `[14-A]` `StatutoryFactBlock` — 법정 사실 블록. 컴포넌트 명세는
 * `design-system.md` 5.34절, 배치는 `screens.md` 14.3.2절.
 *
 * **이 블록은 고지가 아니라 결과의 1급 산출물이다** — `state-info` 파랑을
 * 쓰지 않는다. 중립 카드(`surface-raised`)를 쓴다.
 *
 * **[2026-08-19, 게이트 5 D78 ①] 조문 칩을 최소화한다.** 소유자 판정 —
 * "법적 근거·조항 내용이 너무 많아 복잡해 보인다." 남기는 기준: **한 사실당
 * 최대 한 칩·표 안에서는 칩 전면 제거.** 이 블록에 남는 칩은 개시 시점
 * 필요 최소 평가액 하나뿐이다(design-system 5.34절 — 칩 7개 → 1개, 86%
 * 감축). **지우는 것은 화면의 칩이지 엔진 응답의 `legal_basis`가 아니다.**
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
import { reverseLawEntriesFor, reverseLawChipRow, amountWithTodayCurrency, capChips } from './reverse-shared.js';

/**
 * 재원별 문턱 사용 여부 표 — **근거(`LawChip`) 열을 전면 제거한다**(D78 ①,
 * "표 안에서는 칩 전면 제거"). 라벨 열 + 값 열 두 칸만 남는다.
 *
 * **ISA 전환금액분 행은 `row.in_plan`이 참일 때만 그린다** — 엔진이 이미
 * "ISA 계좌가 있나요? = 예 그리고 전환 계획 = 예이며 개시 시점에도 의무
 * 가입기간이 찼는가"를 전부 반영해 이 값을 계산해 준다(`engine-interface.md`
 * 12.6절 `threshold_consumption.rows[].in_plan`, D78 ④). 화면이 조건을
 * 다시 판정하지 않는다.
 */
function thresholdTable(rows) {
  const visibleRows = rows.filter((row) => row.source_code !== 'isa_conversion_amount' || row.in_plan);
  return el('table', { class: 'statutory-fact-table' }, [
    el('thead', {}, [el('tr', {}, [el('th', {}, ['재원']), el('th', {}, ['문턱 사용'])])]),
    el(
      'tbody',
      {},
      visibleRows.map((row) =>
        el('tr', {}, [
          el('td', {}, [SOURCE_LABEL[row.source_code] ?? row.source_code]),
          el('td', {}, [row.consumes_threshold ? '사용함' : '사용 안 함']),
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
    // 이 블록에 남는 유일한 칩(D78 ①) — 한 사실당 최대 한 칩이므로 잘라낸다.
    reverseLawChipRow(capChips(reverseLawEntriesFor(legalBasis, msb.basis_rule_ids))),
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
   *
   * **[D78 ①] 이 문장에는 칩을 달지 않는다** — 문장은 그대로 두고 칩만 뺀다.
   */
  const legalSuccessSection = el('div', { class: 'statutory-fact-row' }, [
    el('p', { class: 'type-body' }, [`${LEGAL_SUCCESS_LABEL}: `, el('strong', {}, [LEGAL_SUCCESS_HOLDS])]),
    // AC-R12 — 문턱보다 짧으면 표시, 아니면 표시하지 않는다. 칩 없음(D78 ①).
    msb.cap_binds_before_balance
      ? el('p', { class: 'type-caption statutory-fact-warning-text' }, [`▸ ${CAP_BINDS_FIRST_LINE}`])
      : null,
  ]);

  const thresholdSection = el('div', { class: 'statutory-fact-row' }, [
    el('p', { class: 'type-body-s statutory-fact-label' }, ['재원별 사적연금 분리과세 문턱 사용 여부']),
    thresholdTable(rows),
  ]);

  // 14.3.2절 — `[14-B]`가 실제 금액을 낸 뒤에만 추가된다. **비교 기준은
  // `contribution_ceiling.total_monthly_krw`(전환 여부와 무관한 세 계좌
  // 법정 상한 합계)가 아니라 `contribution_scenario.source_ceiling_monthly_krw`
  // (이 계획이 실제로 재원으로 쓸 수 있는 상한 — ISA가 재원이 아니면 연금
  // 두 계좌 몫뿐이다)다(`engine-interface.md` 12.6·12.7절, `14.1.1`). AC-R17이
  // 견주는 자가 이 값이다. 칩 없음(D78 ①).
  const ceilingSection = contributionScenario
    ? el('div', { class: 'statutory-fact-row' }, [
        el('p', { class: 'type-body-s statutory-fact-label' }, ['세 계좌 법정 납입 상한과의 비교']),
        el('p', { class: 'type-body' }, [amountWithTodayCurrency(contributionScenario.source_ceiling_monthly_krw)]),
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
