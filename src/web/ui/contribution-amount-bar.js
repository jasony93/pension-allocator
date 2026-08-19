/**
 * `[14-B]` `ContributionAmountBar` — 계좌별 월 납입액. 컴포넌트 명세는
 * `design-system.md` 5.35절, 배치는 `screens.md` 14.3.3절.
 *
 * **[2026-08-19, 게이트 5 D78 ③] 소유자가 막대 목록 판정을 명시로 덮었다.**
 * 실제로 그리는 것은 `AccountDonut`(첫 탭과 같은 컴포넌트, 중앙 라벨 「월
 * 총 납입액」) + 도넛 옆(데스크톱)/아래(모바일) 배분표다. 컴포넌트 파일
 * 이름·내보내는 함수 이름은 계약을 따라 그대로 둔다. 막대 목록이었던
 * 이전 설계는 `design-system.md` 5.35절에 "그 판단이 왜 내려졌었는지의
 * 기록"으로 남아 있다 — 이 파일은 지우지 않고 실제 렌더만 교체한다.
 *
 * `contribution_scenario`가 `null`이면 이 함수는 `null`을 돌려준다(AC-R6 —
 * 컴포넌트 자체를 그리지 않는다). 대체 안내 한 줄은 호출부
 * (`reverse-result-panel.js`)가 그린다.
 *
 * **[게이트 5 D78 ④, AC-R30] ISA가 이 계획의 재원이 아니면 도넛·표 어디에도
 * ISA 행이 나타나지 않는다** — `0원`으로 그리면 위반이다. 엔진이
 * `Allocation.limited_by === "not_a_source"`로 그 사실을 낸다
 * (`engine-interface.md` 12.7·8.11절, `14.1.1`).
 */

import { el } from './dom.js';
import { formatKrw } from '../format.js';
import { donutChart, CHART_ACCOUNT_ORDER } from './charts.js';
import {
  REVERSE_ACCOUNT_LABEL,
  returnRateConditionClause,
  CONTRIBUTION_SCENARIO_NEEDED_LINE,
  TODAY_CURRENCY_NOTE,
  reverseFillBasisMessage,
  reverseFillOrderVariantMessage,
} from '../reverse-copy.js';
import { sourceAllocations } from './reverse-shared.js';

/**
 * 그 행이 채워진 근거(들) — `Allocation.fill_steps[].basis_code`(계약
 * `14.2.0`, D78 ④ 후속). **`screens.md` §14.3.3 갱신분이 아직 이 자리를
 * 정하지 않아, 관리자 지시대로 배분표 행 아래 한 줄로 둔다.** 한 계좌가
 * 서로 다른 근거로 두 자리(예: 세액공제 한도까지 + 그 한도를 넘는 몫)에
 * 걸쳐 채워질 수 있어(연금저축), 근거 코드를 중복 없이 모아 각각 한 문장씩 낸다.
 */
function fillBasisCaptions(allocation) {
  const codes = [...new Set((allocation.fill_steps ?? []).map((step) => step.basis_code).filter(Boolean))];
  return codes.map((code) => el('p', { class: 'type-caption contribution-amount-fill-basis' }, [reverseFillBasisMessage(code)]));
}

function allocationTable(allocations) {
  return el('div', { class: 'account-table-scroll' }, [
    el('table', { class: 'account-table' }, [
      el('thead', {}, [el('tr', {}, ['계좌', '월 금액', '연 환산'].map((h) => el('th', {}, [h])))]),
      el(
        'tbody',
        {},
        allocations.flatMap((allocation) => {
          const row = el('tr', {}, [
            el('td', {}, [REVERSE_ACCOUNT_LABEL[allocation.account] ?? allocation.account]),
            allocation.monthly_krw === 0
              ? el('td', { colspan: 2 }, [CONTRIBUTION_SCENARIO_NEEDED_LINE])
              : el('td', {}, [`월 ${formatKrw(allocation.monthly_krw)}`]),
            allocation.monthly_krw === 0 ? null : el('td', {}, [`연 ${formatKrw(allocation.annual_krw)}`]),
          ]);
          const captions = allocation.monthly_krw > 0 ? fillBasisCaptions(allocation) : [];
          const captionRow = captions.length
            ? el('tr', { class: 'table-row-note' }, [el('td', { colspan: 3 }, captions)])
            : null;
          return captionRow ? [row, captionRow] : [row];
        }),
      ),
    ]),
  ]);
}

/**
 * @param {object} params
 * @param {object|null} params.contributionScenario `PensionReverseResponse.contribution_scenario`
 */
export function renderContributionAmountBar({ contributionScenario }) {
  if (!contributionScenario) return null;
  // ISA가 이 계획의 재원이 아니면(`limited_by === "not_a_source"`) 도넛·표
  // 어디에도 올리지 않는다 — 0원으로 그리는 것과는 다르다(AC-R30).
  const includedAllocations = sourceAllocations(contributionScenario.allocations);
  const excludedAccounts = CHART_ACCOUNT_ORDER.filter((account) => !includedAllocations.some((a) => a.account === account));
  const annualReturnRate = contributionScenario.condition_clause.annual_return_rate;
  const totalMonthlyKrw = includedAllocations.reduce((sum, a) => sum + a.monthly_krw, 0);

  const donut = donutChart({
    allocations: includedAllocations,
    unallocatedAnnualKrw: 0,
    unallocatedMonthlyKrw: 0,
    totalAllocatedMonthlyKrw: totalMonthlyKrw,
    excludedAccounts,
  });
  donut.classList.add('contribution-amount-donut');

  // 배분 순서 변형 근거(계약 `fill_order.variant_code`, `14.2.0`) — 표
  // 전체에 한 번만 선다(행 하나가 아니라 순서 자체에 대한 근거이므로).
  const fillOrderNote = contributionScenario.fill_order
    ? el('p', { class: 'type-caption contribution-amount-fill-order' }, [
        reverseFillOrderVariantMessage(contributionScenario.fill_order.variant_code),
      ])
    : null;

  return el('section', { class: 'contribution-amount-bar', 'data-key': 'contributionAmountBar' }, [
    el('h3', { class: 'type-title-s' }, ['② 계좌별 월 납입액 — 시나리오']),
    el('div', { class: 'contribution-amount-donut-row' }, [donut, allocationTable(includedAllocations)]),
    fillOrderNote,
    // 조건절은 도넛과 표 전체를 감싸는 캡션 한 줄로 한 번만 선다(D78 ③,
    // design-system 5.35절 3번 — 세 값이 도넛 하나로 묶이는 순간
    // `AccountBenefitStrip`의 가정 축 관행이 다시 성립한다).
    el('p', { class: 'type-caption contribution-amount-condition' }, [
      `${returnRateConditionClause(annualReturnRate)} (${TODAY_CURRENCY_NOTE})`,
    ]),
  ]);
}
