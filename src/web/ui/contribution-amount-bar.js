/**
 * `[14-B]` `ContributionAmountBar` — 계좌별 월 납입액 막대. 컴포넌트 명세는
 * `design-system.md` 5.35절, 배치는 `screens.md` 14.3.3절.
 *
 * **도넛도 아니고, `AllocationBar`(자기정규화)도 그대로 쓰지 않는다.** 세
 * 행이 하나의 공통 화폐 축을 공유하는 막대 목록이다 — 이유는 5.35절.
 *
 * `contribution_scenario`가 `null`이면 이 함수는 `null`을 돌려준다(AC-R6 —
 * 컴포넌트 자체를 그리지 않는다). 대체 안내 한 줄은 호출부
 * (`reverse-result-panel.js`)가 그린다 — `StatutoryFactBlock`과의 자리 관계를
 * 그쪽이 이미 알고 있기 때문이다.
 */

import { el } from './dom.js';
import { formatKrw } from '../format.js';
import { REVERSE_ACCOUNT_LABEL, returnRateConditionClause, CONTRIBUTION_SCENARIO_NEEDED_LINE, TODAY_CURRENCY_NOTE } from '../reverse-copy.js';

// 계좌 고정 색 매핑(design-system 3.5절) — `charts.js`의 `ACCOUNT_COLOR`와 같은
// 값이다(이름은 갈랐다 — 배포 빌드가 모든 모듈을 한 스코프로 합치므로
// 최상위 이름이 겹치면 안 된다). 클래스가 아니라 인라인 스타일로 적용한다 —
// 이 저장소의 기존 `AllocationBar`(`charts.js` `alloc-bar-fill`)도 같은 방식을 쓴다.
const REVERSE_ACCOUNT_COLOR = {
  annuity_savings: 'var(--data-pension)',
  retirement_pension: 'var(--data-irp)',
  isa: 'var(--data-isa)',
};

function barRow(allocation, axisMax, annualReturnRate) {
  const widthPercent = axisMax > 0 ? Math.min(100, (allocation.monthly_krw / axisMax) * 100) : 0;
  return el('div', { class: 'contribution-amount-row', 'data-key': `car-${allocation.account}` }, [
    el('div', { class: 'contribution-amount-row-head' }, [
      el('span', { class: 'contribution-amount-row-label' }, [REVERSE_ACCOUNT_LABEL[allocation.account] ?? allocation.account]),
      el('span', { class: 'contribution-amount-row-value' }, [
        `월 ${formatKrw(allocation.monthly_krw)} (${TODAY_CURRENCY_NOTE})`,
      ]),
    ]),
    el('div', { class: 'contribution-amount-track' }, [
      el('div', {
        class: 'contribution-amount-fill',
        style: { width: `${widthPercent}%`, background: REVERSE_ACCOUNT_COLOR[allocation.account] ?? 'var(--text-secondary)' },
      }),
    ]),
    // AC-R15 — 조건절은 매 행 반복. 축 제목에 한 번만 달지 않는다(5.35절).
    el('p', { class: 'type-caption contribution-amount-condition' }, [returnRateConditionClause(annualReturnRate)]),
    allocation.monthly_krw === 0
      ? el('p', { class: 'type-caption contribution-amount-not-needed' }, [CONTRIBUTION_SCENARIO_NEEDED_LINE])
      : null,
  ]);
}

/**
 * @param {object} params
 * @param {object|null} params.contributionScenario `PensionReverseResponse.contribution_scenario`
 */
export function renderContributionAmountBar({ contributionScenario }) {
  if (!contributionScenario) return null;
  const allocations = contributionScenario.allocations;
  const annualReturnRate = contributionScenario.condition_clause.annual_return_rate;
  const axisMax = Math.max(1, ...allocations.map((a) => a.monthly_krw));

  return el('section', { class: 'contribution-amount-bar', 'data-key': 'contributionAmountBar' }, [
    el('h3', { class: 'type-title-s' }, ['② 계좌별 월 납입액 — 시나리오']),
    ...allocations.map((allocation) => barRow(allocation, axisMax, annualReturnRate)),
  ]);
}
