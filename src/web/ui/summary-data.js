/**
 * 요약 내보내기(관리자 지시 6번, D74)가 담을 자료를 한 곳에서 조립하는
 * **순수 함수**. DOM에 의존하지 않는다 — 인쇄용 요약 시트(`result-panel.js`의
 * `summarySheet`, 실제 DOM 컴포넌트를 재사용한다)와 PNG 래스터라이즈용 SVG
 * 빌더(`summary-image.js`, DOM 밖에서 독립 SVG 문자열을 짠다)가 이 함수
 * 하나를 함께 불러 "요약에 무엇이 들어가는가"를 두 곳에 따로 적지 않는다 —
 * 따로 적으면 둘 중 하나는 반드시 낡는다(이 저장소가 이미 여러 번 겪은
 * 결함 패턴, 예: `charts.js`의 `allocationSegments`가 도넛·스택바 공유로
 * 같은 문제를 풀었던 것과 같은 이유).
 *
 * **D74가 정한 다섯 항목만 담는다** — 도넛(배분 구성) · 계좌별 월 납입액 ·
 * 총 절세액(가정 성분이 있으면 조건절과 함께) · 계좌별 납입 잔여 한도 ·
 * 연 환산. **가정 사항·다른 배분 비교는 이 함수가 아예 읽지 않는다** —
 * D74가 명시로 뺀 항목이라 필드 자체가 없다.
 *
 * **원시 입력(생년월일·총급여)이 이 함수를 통해 요약에 들어갈 방법이 없다.**
 * 인자는 `plan`·`scenario`·`annualReturnRate`(사용자가 준 수익률 가정,
 * `echo`에서 이미 되비친 값 — 계산에 실제로 쓰인 값이지 원본 프로필이
 * 아니다) 셋뿐이다. `profile.birth_date`·`profile.current_year_total_
 * salary_krw`가 든 `EngineRequest`나 `EngineResponse.echo` 전체를 통째로
 * 받지 않는다 — **함수 시그니처 자체가 그 값에 접근할 길을 막는다**
 * (`summary-data.test.mjs`가 반환값에 원시 입력이 없음을 기계로 고정한다).
 *
 * **절세액 처리(D74 조건).** 합계가 가정 성분(ISA 수익률)을 담으면
 * (`includes_assumption_component`) 조건절이 반드시 함께 있어야 한다는
 * 것이 D38 계열 규칙이다 — 여기서는 `determinedLine`/`assumptionLine`
 * (후자가 `headlineComponentAssumptionLine`이 이미 짜 넣는 「(연 ○% 가정)」
 * 조건절을 포함한다)을 항상 **함께** 채우거나 함께 비운다. 확정 성분만
 * 담을 때(사용자가 ISA 수익률을 켜지 않았을 때, 이 서비스의 기본 상태)는
 * 조건절 자체가 없다 — 없앨 것이 없으므로 안전하다.
 */

import {
  AMOUNT_CARD_LABEL_CREDIT_ONLY,
  AMOUNT_CARD_LABEL_COMPOSITE,
  AMOUNT_CARD_LABEL_DELTA,
  headlineValueText,
  headlineComponentDeterminedLine,
  headlineComponentAssumptionLine,
  ACCOUNT_LABEL,
} from '../copy.js';
import { formatPlanRowAmount } from '../format.js';
import { CHART_ACCOUNT_ORDER, allocationSegments, sliceAngles } from './charts.js';
import { accountLimitView, excludedAccounts } from './eligibility.js';

export function buildSummaryData(plan, scenario, annualReturnRate = null) {
  const excluded = excludedAccounts(scenario);
  const segments = allocationSegments({
    allocations: plan.allocations,
    unallocatedAnnualKrw: plan.unallocated_annual_krw,
    excludedAccounts: excluded,
  });
  const arcs = sliceAngles(segments);

  const accounts = CHART_ACCOUNT_ORDER.filter((account) => !excluded.includes(account)).map((account) => {
    const alloc = (plan.allocations ?? []).find((a) => a.account === account) ?? null;
    const view = accountLimitView(scenario, account);
    return {
      account,
      label: ACCOUNT_LABEL[account],
      monthlyKrw: alloc ? alloc.monthly_krw : 0,
      annualKrw: alloc ? alloc.annual_krw : 0,
      remainingLimitKrw: view.remainingLimitKrw,
    };
  });

  const headline = plan.headline_composite_total;
  const includesAssumption = plan.is_baseline ? Boolean(headline?.includes_assumption_component) : false;
  const totalTaxSavings = plan.is_baseline
    ? {
        label: includesAssumption ? AMOUNT_CARD_LABEL_COMPOSITE : AMOUNT_CARD_LABEL_CREDIT_ONLY,
        valueText: headlineValueText(headline),
        includesAssumption,
        determinedLine: includesAssumption ? headlineComponentDeterminedLine(headline) : null,
        assumptionLine: includesAssumption ? headlineComponentAssumptionLine(headline, annualReturnRate) : null,
      }
    : {
        // 대안 미리보기 — 헤드라인 자리에 기본안 대비 차이가 온다
        // (`result-panel.js`의 `alternativePlanDeltaCard`와 같은 값).
        label: AMOUNT_CARD_LABEL_DELTA,
        valueText: formatPlanRowAmount(plan),
        includesAssumption: false,
        determinedLine: null,
        assumptionLine: null,
      };

  return {
    donut: {
      segments,
      arcs,
      excludedAccounts: excluded,
      unallocatedAnnualKrw: plan.unallocated_annual_krw ?? 0,
      unallocatedMonthlyKrw: plan.unallocated_monthly_krw ?? 0,
      totalAllocatedMonthlyKrw: (plan.total_allocated_monthly_krw ?? 0) + (plan.unallocated_monthly_krw ?? 0),
    },
    accounts,
    totalTaxSavings,
    taxYear: scenario?.ruleset?.tax_year ?? null,
  };
}
