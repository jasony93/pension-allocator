/**
 * 요약 내보내기(관리자 지시 6번, D74)가 담을 자료를 한 곳에서 조립하는
 * **순수 함수**. DOM에 의존하지 않는다 — 인쇄용 요약 시트(`result-panel.js`의
 * `summarySheet`)와 PNG 래스터라이즈용 SVG 빌더(`summary-image.js`, DOM 밖에서
 * 독립 SVG 문자열을 짠다)가 **같은 SVG 조립기 하나**(`buildSummarySvgMarkup`)를
 * 거쳐 나온다(D75, `ui/summary-image.js` 머리말) — 이 함수는 그 조립기가 그릴
 * 자료를 한 곳에서만 정의해, "요약에 무엇이 들어가는가"를 두 곳에 따로 적지
 * 않는다. 따로 적으면 둘 중 하나는 반드시 낡는다(이 저장소가 이미 여러 번
 * 겪은 결함 패턴, 예: `charts.js`의 `allocationSegments`가 도넛·스택바 공유로
 * 같은 문제를 풀었던 것과 같은 이유).
 *
 * **D74가 정한 다섯 항목만 담는다** — 도넛(배분 구성) · 계좌별 월 납입액 ·
 * 총 절세액(가정 성분이 있으면 조건절과 함께) · 계좌별 납입 잔여 한도 ·
 * 연 환산. **가정 사항·다른 배분 비교는 이 함수가 아예 읽지 않는다** —
 * D74가 명시로 뺀 항목이라 필드 자체가 없다.
 *
 * **[2026-08-18, 관리자 지시(6차) 2번, D75] 넷째 인자 `form`이 새로 생겼다 —
 * `inputs` 필드 하나가 함께 늘었다.** D74 시절 이 문단은 "원시 입력이 이
 * 함수를 통해 요약에 들어갈 방법이 없다"였다 — 소유자가 D75로 그 유보를
 * 명시로 덮었다(도넛 오른쪽에 입력값을 적으라는 지시). **그래도 원시
 * `form` 전체를 그대로 담지 않는다** — `buildSummaryInputs`(아래)가 D75가
 * 지정한 여섯 항목만 화이트리스트로 골라 담고, 나머지 수십 개 폼 필드는
 * 이 함수도 그 헬퍼도 아예 읽지 않는다. `form`을 생략하면(옛 호출부처럼)
 * `inputs`는 빈 배열이다 — 이 함수의 나머지 넷(도넛·계좌·총 절세액·과세연도)은
 * 여전히 `plan`·`scenario`·`annualReturnRate`만으로 완결된다(그 셋의 안전은
 * D74 시절과 똑같이 유효하다 — echo가 되비춘 계산 입력이지 원본 프로필이
 * 아니다).
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
  SUMMARY_INPUT_LABEL,
  ISA_INCOME_CHARACTER_LABEL,
} from '../copy.js';
import { formatPlanRowAmount } from '../format.js';
import { CHART_ACCOUNT_ORDER, allocationSegments, sliceAngles } from './charts.js';
import { accountLimitView, excludedAccounts } from './eligibility.js';

/** `''`/`null`/`undefined`를 "안 넣었다"로 접는다 — 공백만 있는 값도 마찬가지다. */
function nonEmptyText(raw) {
  const text = (raw ?? '').toString().trim();
  return text === '' ? null : text;
}

/**
 * 「만원」 단위 폼 입력을 그대로(원으로 환산하지 않고) 사람이 읽는 문자열로
 * 바꾼다 — 예: `"4000"` → `"4,000만원"`. **`validation.js`의
 * `parseManwonToWon`을 쓰지 않는다** — 그 함수는 계산에 쓸 원 단위 값을
 * 내는 것이 목적이고, 여기서는 사용자가 입력 화면에서 본 것과 같은 단위로
 * 그대로 되비추는 것이 목적이다(두 목적이 다르므로 반올림 규약이 갈려도
 * 문제가 되지 않는다 — 이 값은 계산에 다시 쓰이지 않고 화면 표시로 끝난다).
 */
function manwonDisplayText(raw) {
  const text = nonEmptyText(raw);
  if (text === null) return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return `${num.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}만원`;
}

function isaReturnRateDisplayText(raw) {
  const text = nonEmptyText(raw);
  if (text === null) return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return null;
  return `연 ${num.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}%`;
}

function isaSettlementYearsDisplayText(raw) {
  const text = nonEmptyText(raw);
  if (text === null || !/^\d+$/.test(text) || Number(text) < 1) return null;
  return `${Number(text)}년`;
}

/**
 * [2026-08-18, 관리자 지시(6차) 2번, D75] 요약 도넛 오른쪽에 적을 입력값
 * 목록 — **소유자가 명시로 지정한 항목만** 담는 화이트리스트다. `form`
 * (`state/store.js`의 폼) 전체를 통째로 순회하지 않는다 — 여기 나열한 여섯
 * 키 이외의 어떤 폼 필드도 이 함수가 읽지 않으므로, 폼에 새 필드가 늘어도
 * 이 함수를 통해 몰래 새어 나갈 길이 없다.
 *
 * **입력하지 않은 값은 줄 자체가 없다(D75 선 ①).** 항목마다 개별로
 * 판정한다 — ISA 수익률을 켰어도 정산 기간을 비웠으면 그 줄만 빠진다.
 * `settlement_years`가 없으면 엔진이 룰셋의 계약기간 하한을 쓰는 것과
 * 같은 이유로, 화면도 "안 적었다"를 지어내 채우지 않는다.
 *
 * 순수 함수 — DOM도, 엔진도 부르지 않는다. 반환 순서는 항상 같다(생년월일
 * → 총급여액 → 월 납입액 → [켰다면] 예상 수익률 → 수익 성격 → 정산 기간).
 */
export function buildSummaryInputs(form) {
  if (!form) return [];
  const lines = [];

  const birthDate = nonEmptyText(form.birthDate);
  if (birthDate) lines.push({ key: 'birth_date', label: SUMMARY_INPUT_LABEL.birth_date, valueText: birthDate });

  const salary = manwonDisplayText(form.currentSalary);
  if (salary) lines.push({ key: 'current_salary', label: SUMMARY_INPUT_LABEL.current_salary, valueText: salary });

  const capacity = manwonDisplayText(form.monthlyCapacity);
  if (capacity) lines.push({ key: 'monthly_capacity', label: SUMMARY_INPUT_LABEL.monthly_capacity, valueText: `월 ${capacity}` });

  if (form.isaReturnEnabled) {
    const rateText = isaReturnRateDisplayText(form.isaReturnRatePercent);
    if (rateText) lines.push({ key: 'isa_return_rate', label: SUMMARY_INPUT_LABEL.isa_return_rate, valueText: rateText });

    const characterLabel = ISA_INCOME_CHARACTER_LABEL[form.isaIncomeCharacter];
    if (characterLabel) {
      lines.push({ key: 'isa_income_character', label: SUMMARY_INPUT_LABEL.isa_income_character, valueText: characterLabel });
    }

    const yearsText = isaSettlementYearsDisplayText(form.isaSettlementYears);
    if (yearsText) lines.push({ key: 'isa_settlement_years', label: SUMMARY_INPUT_LABEL.isa_settlement_years, valueText: yearsText });
  }

  return lines;
}

export function buildSummaryData(plan, scenario, annualReturnRate = null, form = null) {
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
    // [2026-08-18, D75] `form`을 생략한 호출부(옛 D74 시절 호출 자리가 아직
    // 남아 있을 수 있다)에서는 빈 배열 — "안 담는다"가 아니라 "담을 값을
    // 안 받았다"이므로 필드 자체는 항상 있다(호출부가 `data.inputs.length`를
    // 조건 없이 물을 수 있게).
    inputs: buildSummaryInputs(form),
  };
}
