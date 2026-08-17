/**
 * ExampleShowcase — 관리자 지시(2026-08-14) 3·4·5·6번, D70(2026-08-16)으로
 * 배치 재작업. 헤더와 입력/결과 사이, "이 계산기로 무엇을 볼 수 있는지"를
 * 보여주는 간략한 예시(도넛 + 절세액 둘뿐 — 계좌별 세제혜택 막대·법령·가정
 * 사항은 여기 끌어오지 않는다).
 *
 * **[2026-08-17, 소유자 지시 여섯 + D71] 예시 구역을 다시 다듬었다 — 이번
 * 회차가 가장 크게 건드린 것은 다음 여섯이다.**
 *
 * 1. **입력을 세 줄로, 한 줄에 하나씩**("나이: 만 30세" / "소득: 4,000만원" /
 *    "여유 자금 : 월 150만원") — 옛 "예시) …/…/…/…" 한 줄을 갈랐다. **「예시)」
 *    접두사와 「연 평균 수익률」 줄은 삭제한다.**
 * 2. **도넛 조각 위(안)에 퍼센티지를 쓴다** — 지금까지는 범례에만 있었다.
 *    `applyDonutSlicePercentLabels`(이 파일 아래)가 마운트 뒤 실측(색
 *    대비·겹침)으로 그린다.
 * 3. **예시의 모든 문구 행간을 조금 더 넓힌다** — 절대 글자 크기는 5번(축소)
 *    때문에 줄지만, 줄간격 **배수**(line-height)는 오히려 올린다(`styles.css`).
 * 4. **물음 문구를 맨 위로, 입력 세 줄을 그 아래로** — DOM 순서가 뒤집혔다
 *    (아래 `exampleShowcaseSection`).
 * 5. **전체 20% 축소** — 화살표가 1440×900 첫 화면 안에 스크롤 없이 보이는
 *    것이 목표다(`styles.css`가 실제 수치를 진다. 실측 결과는 최종 보고 참고).
 * 6. **화살표에 움직임** — 위아래로 느리고 작게 반복 이동하는 CSS 애니메이션
 *    (`styles.css`의 `example-showcase-arrow-bounce`), `prefers-reduced-motion`
 *    이면 꺼진다.
 *
 * **D71 — 수익률 줄이 사라지므로 예시는 수익률 없이 계산한다.** 1번 지시로
 * 「연 평균 수익률」 입력 줄이 없어지면서, D70이 구성 두 줄 삭제를 허용했던
 * 조건("수익률 가정이 같은 시야에 있을 것")이 무너졌다. 판정(D71) — 예시
 * 요청에서 **ISA 수익률 옵트인 자체를 뺀다**(`buildExampleForm`, 아래). 그
 * 결과 헤드라인은 구간이 아니라 **확정 세액공제 하나(1,485,000원)**가 되고,
 * 라벨은 `amountCard`의 기존 분기(가정 성분이 없으면 「이 배분으로 계산된
 * 세액공제액」)를 그대로 탄다 — **이 화면이 새로 판단하지 않는다.** 화면에
 * 보이는 입력 세 줄이 곧 계산에 들어간 입력의 전부가 된다.
 *
 * **[2026-08-16, D70] 배치는 좌우 2열(문구|도넛/범례, 그 아래 절세액,
 * 맨 아래 화살표)을 유지한다.** 크기·정렬·2열/스택 전환은 `styles.css`의
 * `.example-showcase*` 규칙이 진다.
 *
 * **반드시 엔진으로 계산한다.** 예시 숫자를 하드코딩하지 않는다 — 세법이나
 * 배분 규칙이 바뀌면 이 예시도 같은 경로로 따라 바뀌어야 한다. 도넛은
 * `charts.js`의 `donutChart`를, 절세액 카드는 `result-panel.js`가 실제 결과에
 * 쓰는 바로 그 `amountCard`를 그대로 재사용한다 — 화면이 자기 결과를 그리는
 * 것과 같은 경로다.
 *
 * **고정 입력 셋** — 만 30세 · 소득 4,000만원 · 여유 자금 월 150만원(관리자가
 * 지정한 값 그대로). **넷째(연 평균 수익률)는 D71로 빠졌다.**
 *
 * **생년월일은 날짜 리터럴을 박지 않는다.** 룰셋을 고르는 과세연도
 * (`state/store.js`의 `TAX_YEAR` — 세법 수치가 아니라 어느 룰셋을 읽을지 고르는
 * 값)에서 역산한다. 1월 1일생으로 두면 과세기간 종료일(12/31, 엔진
 * `dates.mjs`의 `ageOn`이 이 기준일로 만 나이를 센다) 기준 만 나이가 정확히
 * 30이고, `TAX_YEAR`가 다음 회차에 올라도(예: 2027) 다시 그 해 기준 30세를
 * 낸다 — "고정 날짜를 박으면 해가 바뀔 때 만 31세가 된다"는 지적을 이 역산이
 * 구조적으로 막는다(`example-showcase.test.mjs`가 여러 과세연도로 고정한다).
 *
 * **소득 성격을 고르지 않는다**(`income_character: 'mixed_or_unknown'`)는
 * 더는 실리지 않는다 — D71로 ISA 수익률 옵트인 자체가 빠지므로
 * `isa_return_assumption`이 통째로 `null`이 되고, 그 안에 있던
 * `income_character`도 함께 사라진다(`buildExampleForm`, 아래).
 *
 * **크기 — 새 눈금을 만들지 않는다.** 소유자 문구(물음 + 입력 세 줄)는 이
 * 구역에서 가장 커야 하고 결과 헤드라인(`.amount-card-value`, `type-display`
 * 40px/700)을 넘지 않아야 한다(D69). 실제 픽셀 값은 5번 지시(전체 20% 축소)로
 * 다시 줄었다 — `styles.css` 참고.
 *
 * **`amountCard`를 `showCaption: false, showComposition: false`로 부른다**
 * (D70). **사용자 자신의 결과에서는 이 두 옵션을 절대 `false`로 부르지
 * 않는다** — 이 예외는 예시 하나에만 있다.
 *
 * **Shadow DOM 안에서 그린다.** 이 예시가 재사용하는 `donutChart`·`amountCard`는
 * 실제 결과 화면과 **같은 클래스 이름**(`.chart-donut`·`.amount-card` 등)을
 * 쓴다 — 재사용 자체가 목적이므로 당연하다. 그런데 이 저장소의 여러 브라우저
 * 검사가 `document.querySelector('.amount-card...')` · `.chart-donut` 개수처럼
 * **문서 전체를 뒤지는 질의**로 실제 결과 패널을 짚는다. 이 예시를 결과
 * 패널보다 앞선 DOM 순서에 그대로 얹으면 그 질의들이 예시 카드를 실제
 * 결과로 오인한다 — Shadow DOM(열림 모드)은 `document.querySelector`가 넘지
 * 않는 경계라 이 충돌이 구조적으로 사라진다. 스타일은 메인 문서의 스타일
 * (개발 모드는 `<link>`, `scripts/build.mjs`가 만든 배포 산출물은 인라인
 * `<style>`)을 그대로 옮겨 붙여, 문서 밖에서도 같은 디자인 토큰으로 렌더된다.
 *
 * **[2026-08-17, 관리자 지시(2차, D72) — UI 전면 수정 아홉 중 예시 관련 다섯]**
 *
 * 3. **물음 문구를 소유자 새 문장으로 교체**("당신의 소중한 월급, 어디에
 *    넣어야 세금이 가장 적을까요?") — `EXAMPLE_QUESTION_TEXT` 참고. **물음과
 *    입력 세 줄 사이 간격을 넓힌다**(두 줄 정도, `styles.css`
 *    `.example-showcase-input-line:first-of-type`) — 지금까지는 문구 칸의
 *    모든 줄이 같은 좁은 간격(`gap`)을 썼는데, "이 계산기가 무엇에 답하는지"
 *    (물음)와 "그 답이 어떤 조건 위에서 나왔는지"(입력 세 줄)를 시각적으로도
 *    분리한다.
 * 4. **도넛 — 배지 삭제, 조각에 이름.** ①②③ 배지와 그 조각·범례를 잇던 역할이
 *    통째로 없어졌다 — 조각 위에 계좌 이름 + 비율을 직접 쓴다. 이 로직은
 *    `charts.js`의 `applyDonutSliceInlineLabels`로 옮겼다(예시 전용이 아니라
 *    **결과 패널의 모바일 도넛과 공유**한다 — 둘 다 `donutChart`의 같은
 *    `legend` 모드를 쓰므로, 배지를 지우고 이름을 쓰는 판정은 두 곳 모두에
 *    적용된다). 범례는 이름+금액만 남고 번호·비율은 뺐다(`charts.js`
 *    `donutLegend` 머리말 — 역할 분담: 조각=이름·비율, 범례=이름·금액).
 * 5. **글자 색·문구.** 입력 세 줄 글자색을 `text-secondary`에서
 *    `text-primary`(검정)로 올린다 — "여유 자금" → "월 납입금"(라벨 교체,
 *    값은 그대로) — `exampleCapacityLineText`.
 * 6·7. **크기 −20% 추가.** 절세액 글자(85px→68px)·화살표(140px→112px) —
 *    `styles.css`가 실제 수치를 진다. 축소 후에도 1440×900 첫 화면 안에
 *    화살표가 스크롤 없이 보인다는 기준은 유지한다 — 헤더가 상단 고정
 *    (sticky)으로 되돌아가며 세로 예산이 다시 바뀌어 재실측했다(최종 보고).
 *    **[2026-08-17, 관리자 지시(3차) 4번] 추가 −10%.** 절세액 글자(68px→
 *    61px)·화살표(112px→100px) — 로고가 같은 회차에 +30%(관리자 지시(3차)
 *    1번) 되며 헤더 바 높이가 바뀔 수 있어 1440×900 첫 화면 기준을 다시
 *    재실측했다(최종 보고).
 * 9. **아이콘.** 물음 줄(h2) 앞에 물음표 아이콘을 붙였었다 —
 *    **[2026-08-17, 관리자 지시(3차) 3번]으로 지웠다.** `icons.js`의
 *    `iconQuestion`을 부르던 자리가 이것뿐이었으므로 그 함수 자체도
 *    `icons.js`에서 지웠다(다른 어디서도 쓰지 않는 값을 코드에 남기지
 *    않는다).
 *
 * **[2026-08-17, 관리자 지시(3차) 2번] man-icon — 입력 세 줄 왼쪽.** 「나이/
 * 소득/월 납입금」 세 줄(물음 줄은 포함하지 않는다) 왼쪽에 사람 아이콘
 * (`assets/man-icon.js`)을 놓는다 — 세 줄 전체 높이만큼 세로로 늘여
 * 그린다(`exampleInputBlock`, 아래). **왼쪽 가장자리에서 띄운다** — 소유자가
 * "가운데가 너무 비워 보여"라고 지적한 것을 왼쪽 열 콘텐츠를 안쪽(오른쪽)
 * 으로 들여 완화한다(`.example-showcase-input-block`의 `margin-left`,
 * `styles.css`). 다크 모드에서는 원본(검정 선화)이 다크 배경에 묻혀
 * `filter: invert(1)`로 반전한다(실측, 최종 보고).
 */

import { el, svgEl } from './dom.js';
import { donutChart, donutLegend, prefersReducedMotion, applyDonutSliceInlineLabels, watchDonutThemeChange } from './charts.js';
import { excludedAccounts } from './eligibility.js';
import { amountCard } from './result-panel.js';
import { buildEngineRequest, initialForm, TAX_YEAR } from '../state/store.js';
import { MAN_ICON_DATA_URI, MAN_ICON_INTRINSIC_WIDTH, MAN_ICON_INTRINSIC_HEIGHT } from '../assets/man-icon.js';

// ---------------------------------------------------------------------------
// 고정 입력 셋 — 관리자 지시(2026-08-14) 4번이 지정한 값 그대로.
// **연 평균 수익률은 D71로 빠졌다** — 예시가 더는 그 값을 요청에 싣지 않는다
// (`buildExampleForm`, 아래).
// ---------------------------------------------------------------------------
export const EXAMPLE_AGE_YEARS = 30;
export const EXAMPLE_SALARY_MANWON = 4000;
export const EXAMPLE_MONTHLY_CAPACITY_MANWON = 150;

/**
 * 과세기간 종료일(엔진 `dates.mjs`의 `endOfTaxYear` · `ageOn`) 기준으로 항상
 * 만 `EXAMPLE_AGE_YEARS`세가 되는 생년월일. 1월 1일생이면 그 해 1월 1일에
 * 이미 생일이 지나 있으므로 12월 31일에도 아직 한 해가 더 지나지 않았다 —
 * 두 조건(생일이 지났다 / 다음 생일 전이다) 모두 항상 참이 되는 유일한 날짜
 * 조합이다. 순수 함수라 여러 과세연도에 대해 그대로 검사할 수 있다
 * (`example-showcase.test.mjs`).
 */
export function exampleBirthDate(taxYear) {
  return `${taxYear - EXAMPLE_AGE_YEARS}-01-01`;
}

/**
 * `state/store.js`의 폼 모양을 그대로 쓴다 — 엔진 요청 조립(`buildEngineRequest`)을
 * 다시 쓰지 않는다.
 *
 * **[2026-08-17, D71] ISA 수익률 옵트인을 켜지 않는다.** 옛(D70 이전) 구현은
 * `isaReturnEnabled: true` 등 셋을 명시로 덮어 수익률 가정을 강제로 넣었다 —
 * 그 값을 보여줄 「연 평균 수익률」 입력 줄이 화면에서 사라진 지금(소유자
 * 지시 1번), 화면에 안 보이는 가정을 계산에만 몰래 태우는 것이 D71이 막으려는
 * 바로 그 어긋남이다. `initialForm()`의 기본값(`isaReturnEnabled: false,
 * isaReturnRatePercent: '', isaIncomeCharacter: null`)을 그대로 둔다 —
 * 덮어쓰지 않는 것 자체가 이 판정의 구현이다. `buildIsaReturnAssumption`
 * (store.js)이 이 상태에서 `null`을 내고, 엔진은 이 규칙군을 한 건도 읽지
 * 않는다(engine-interface.md 0.9절) — 그 결과 헤드라인이 구간이 아니라
 * 확정 세액공제 하나가 된다(D71).
 */
export function buildExampleForm() {
  return {
    ...initialForm(),
    birthDate: exampleBirthDate(TAX_YEAR),
    currentSalary: String(EXAMPLE_SALARY_MANWON),
    // 근로소득 외 다른 종합소득은 묻지 않는다 — 예시를 "간략"하게 두려는
    // 관리자 지시와 같은 이유로, 이 축은 대다수 사용자와 같은 값(아니오)으로 둔다.
    hasNonWageIncome: false,
    monthlyCapacity: String(EXAMPLE_MONTHLY_CAPACITY_MANWON),
    // 연금을 아직 받지 않는 30세 — 이 예시 페르소나에서 유일하게 사실인 값이다.
    annuityStarted: false,
    fundUseHorizon: 'unknown',
    // isaReturnEnabled/isaReturnRatePercent/isaIncomeCharacter는 여기서
    // 건드리지 않는다 — `initialForm()`의 기본값(전부 꺼짐)을 그대로 쓴다.
    // 위 함수 머리말 참고.
  };
}

/**
 * 실제 엔진 호출. `engineClient`는 `main.js`가 넘기는 바로 그 객체(브라우저에서는
 * 진짜 `src/engine/`을 부른다) — 예시 전용 엔진도, 별도 목도 없다.
 */
export async function computeExampleScenario(engineClient) {
  const request = buildEngineRequest(buildExampleForm(), ['current']);
  const response = await engineClient.compute(request);
  if (!response.ok) {
    throw new Error(`example_showcase_compute_failed:${response.errors?.[0]?.code ?? 'unknown'}`);
  }
  const scenario = response.scenarios.find((s) => s.scenario_id === 'current') ?? response.scenarios[0];
  if (!scenario) throw new Error('example_showcase_no_scenario');
  const plan = scenario.plans.find((p) => p.is_baseline) ?? scenario.plans[0];
  if (!plan) throw new Error('example_showcase_no_plan');
  return { scenario, plan };
}

/**
 * [2026-08-17, 소유자 지시 1번] 입력 세 줄 — 한 줄에 하나씩, 「예시)」 접두사
 * 없이. 값은 문자열로 다시 박지 않고 위 고정 입력 상수에서 조립한다 —
 * `example-showcase.test.mjs`가 정확히 이 문자열들을 상수와 대조해 고정한다.
 * "나이:"·"소득:"은 콜론 앞에 공백이 없고 "여유 자금 :"는 콜론 앞에 공백이
 * 있다 — 비대칭이지만 소유자가 그렇게 썼다(옛 한 줄 표기와 같은 규칙).
 */
export function exampleAgeLineText() {
  return `나이: 만 ${EXAMPLE_AGE_YEARS}세`;
}
export function exampleSalaryLineText() {
  return `소득: ${EXAMPLE_SALARY_MANWON.toLocaleString('ko-KR')}만원`;
}
/**
 * [2026-08-17, 관리자 지시(2차) 5번] 「여유 자금」→「월 납입금」 — 값(150만원)은
 * 그대로, 라벨만 바꾼다. 콜론 앞 공백은 옛 표기(`여유 자금 :`)와 같은 자리에
 * 그대로 남긴다 — 소유자가 그렇게 썼다는 사실은 라벨이 바뀌어도 변하지 않는다.
 */
export function exampleCapacityLineText() {
  return `월 납입금 : 월 ${EXAMPLE_MONTHLY_CAPACITY_MANWON.toLocaleString('ko-KR')}만원`;
}
/** 화면이 그리는 순서(나이 → 소득 → 여유 자금) 그대로다. */
export function exampleInputLineTexts() {
  return [exampleAgeLineText(), exampleSalaryLineText(), exampleCapacityLineText()];
}

/**
 * 물음 줄. **[2026-08-17, 관리자 지시(2차) 3번]** 소유자가 문장을 다시 썼다 —
 * "대한민국 청년이라면 …" → "당신의 소중한 월급, 어디에 넣어야 세금이 가장
 * 적을까요?". **[2026-08-17, 소유자 지시 4번] DOM·시각 양쪽에서 맨 위다** —
 * `exampleShowcaseSection` 참고. 정적 문구다 — 세법 수치나 이 예시의 계산
 * 결과를 담지 않으므로(질문일 뿐 값이 아니다) 고정 문자열로 둔다.
 */
export const EXAMPLE_QUESTION_TEXT = '당신의 소중한 월급, 어디에 넣어야 세금이 가장 적을까요?';

/**
 * [2026-08-14, 관리자 지시 6번] 예시 맨 아래의 이동 화살표. 누르면(또는
 * 키보드로 Enter를 치면) 입력/결과 구역(`.app-main`, 빛 DOM — 이 컴포넌트
 * 바로 다음 형제, `ui/app.js` 참고)이 뷰포트 안 잘 보이는 위치로 스크롤된다.
 *
 * **버튼이다**(`<a>`가 아니다) — 이동할 뿐 다른 문서로 가지 않는다.
 *
 * **`prefers-reduced-motion`이면 즉시 이동한다**(`smooth` 대신) —
 * `charts.js`의 `prefersReducedMotion`(도넛 진입 애니메이션이 이미 따르는
 * 같은 판정)을 그대로 재사용한다. 헤더가 이제 고정(sticky)이 아니므로
 * 목적지 계산에 헤더 높이를 따로 빼지 않아도 된다 — `block: 'start'`가
 * 그대로 맞는다(브라우저 검사가 스크롤 뒤 실제 위치를 잰다,
 * `example-showcase.browser.mjs`).
 */
function scrollToInputResult() {
  if (typeof document === 'undefined') return;
  const target = document.querySelector('.app-main');
  if (!target || typeof target.scrollIntoView !== 'function') return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/**
 * [2026-08-16, D70] 화살표 아이콘 — **채운 원이 아니라 굵은 윤곽(stroke) 원 +
 * 굵고 끝이 둥근 화살표**(소유자가 첨부한 이미지 스타일). SVG `stroke`는
 * 두께(`stroke-width`)와 끝 모양(`stroke-linecap: round`)을 직접 그린다.
 *
 * **색은 `currentColor`** — 버튼 자신의 `color`(`styles.css`의
 * `.example-showcase-scroll-arrow`)를 그대로 물려받는다.
 *
 * **circle(윤곽 원)**과 **path(화살표: 세로줄 + 아래로 꺾인 두 획)**를 한
 * `viewBox="0 0 100 100"` 안에 그린다 — 벡터라 버튼 크기가 바뀌어도(5번
 * 지시로 140px, `styles.css`) 흐려지지 않는다.
 */
function exampleShowcaseScrollArrowIcon() {
  return svgEl(
    'svg',
    {
      viewBox: '0 0 100 100',
      class: 'example-showcase-scroll-arrow-icon',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [
      svgEl('circle', {
        class: 'example-showcase-scroll-arrow-ring',
        cx: 50, cy: 50, r: 42,
        fill: 'none', stroke: 'currentColor', 'stroke-width': 7,
      }),
      svgEl('path', {
        class: 'example-showcase-scroll-arrow-glyph',
        // 세로줄(M50,27→50,64) + 아래로 꺾인 두 획(34,45→50,64→66,45) — 하나의
        // path에 이어 그린 두 서브패스. round linecap·linejoin이 각 끝·꺾이는
        // 지점을 뾰족하지 않고 둥글게 만든다("끝이 둥근 화살표").
        d: 'M50,27 L50,64 M34,45 L50,64 L66,45',
        fill: 'none', stroke: 'currentColor', 'stroke-width': 9,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }),
    ],
  );
}

function exampleShowcaseScrollArrow() {
  const button = el(
    'button',
    {
      type: 'button',
      class: 'example-showcase-scroll-arrow',
      'aria-label': '아래 입력·결과 구역으로 이동',
    },
    [exampleShowcaseScrollArrowIcon()],
  );
  button.addEventListener('click', scrollToInputResult);
  // **키보드 접근 — Enter/Space를 명시로 처리한다.** `<button>`은 원래
  // 네이티브로 Enter·Space에 반응해야 하지만, 그 동작은 "합성 클릭 이벤트"에
  // 기대는 경로라 자동화 하니스(`harness.mjs`)가 CDP `Input.dispatchKeyEvent`로
  // 보내는 키 입력에서는 재현되지 않는 것을 실측으로 확인했다. **그래서 직접
  // 처리해 실제 브라우저·자동화 양쪽에서 결정적으로 동작하게 한다.**
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    scrollToInputResult();
  });
  return button;
}

/**
 * 도넛 + 절세액 **둘로만** 좁힌다(관리자 지시 — "간략한 예시"). 계좌별 세제혜택
 * 막대·법령·가정 사항은 끌어오지 않는다.
 *
 * **[2026-08-16, D70] 좌우 2열 — 왼쪽 문구, 오른쪽 도넛/범례, 아래 전폭
 * 절세액, 맨 아래 전폭 화살표.** 시각 배치는 `grid-template-areas`가 정하고,
 * DOM 순서(키보드 tab·스크린리더 낭독 순서)는 아래에서 정한다.
 *
 * **[2026-08-17, 소유자 지시 4번] DOM 순서가 뒤집혔다 — 물음이 먼저, 입력
 * 세 줄이 그 아래.** "무엇에 대한 예시인지"를 먼저 듣고 그다음 그 조건(입력)을
 * 듣는 순서다. `aria-labelledby`는 여전히 물음(h2)을 가리킨다 — 위치가 바뀌어도
 * "이 섹션이 무엇에 대한 것인지"를 답하는 것은 늘 그 물음이었다.
 */
function exampleShowcaseSection({ scenario, plan }) {
  const excluded = excludedAccounts(scenario);
  const donutArgs = {
    allocations: plan.allocations,
    unallocatedAnnualKrw: plan.unallocated_annual_krw,
    unallocatedMonthlyKrw: plan.unallocated_monthly_krw,
    excludedAccounts: excluded,
  };
  const donut = donutChart({
    ...donutArgs,
    // 도넛 중앙 값 = 계좌 셋 + 미배분(engine-interface.md 0.12·10절) —
    // `result-panel.js`의 `chartArea`와 같은 산식.
    totalAllocatedMonthlyKrw: plan.total_allocated_monthly_krw + plan.unallocated_monthly_krw,
    isProposed: !scenario.is_enacted,
    // "간략한" 예시라 항상 컴팩트(라벨을 아래 리스트로 내리는) 모드로 그린다.
    labelMode: 'legend',
  });

  // 헤딩은 물음 줄(h2) 하나다. `aria-labelledby`가 h2를 가리켜 스크린리더
  // 사용자에게도 "무엇에 대한 예시인지"가 물음으로 들린다.
  //
  // [2026-08-17, 관리자 지시(2차) 9번 → 관리자 지시(3차) 3번] 물음표 아이콘을
  // 물음 글자 앞에 붙였었는데 이번 회차에 지웠다 — h2는 다시 글자 span 하나뿐이다.
  //
  // [2026-08-17, 관리자 지시(3차) 2번] man-icon — 「나이/소득/월 납입금」 세
  // 줄(물음 줄 다음)을 감싼 `.example-showcase-input-block`이 이미지 하나 +
  // 줄 셋을 담는 열을 나란히 둔다. 장식적 이미지(정보가 문장 자체에 이미
  // 있다)이므로 `alt=""` + `aria-hidden="true"`로 스크린리더가 건너뛴다.
  const inputBlock = el('div', { class: 'example-showcase-input-block' }, [
    el('img', {
      class: 'example-showcase-input-icon',
      src: MAN_ICON_DATA_URI,
      alt: '',
      width: MAN_ICON_INTRINSIC_WIDTH,
      height: MAN_ICON_INTRINSIC_HEIGHT,
      'aria-hidden': 'true',
    }),
    el(
      'div',
      { class: 'example-showcase-input-lines' },
      exampleInputLineTexts().map((line) => el('p', { class: 'example-showcase-input-line' }, [line])),
    ),
  ]);
  const textCol = el('div', { class: 'example-showcase-text-col' }, [
    el('h2', { class: 'example-showcase-question', id: 'example-showcase-question' }, [
      el('span', { class: 'example-showcase-question-text' }, [EXAMPLE_QUESTION_TEXT]),
    ]),
    inputBlock,
  ]);
  // D71 — ISA 수익률 옵트인을 넣지 않았으므로 `headline_composite_total`은
  // 가정 성분이 없다(includes_assumption_component: false). `annualReturnRate`
  // 인자를 넘길 이유가 없다 — 넘겨도 `amountCard`는 그 값을 가정 성분이 있을
  // 때만 읽는다(compositionBlock, showComposition도 어차피 false다).
  const amountBlock = el('div', { class: 'example-showcase-amount' }, [
    amountCard(plan, scenario, null, { compactCaption: true, showCaption: false, showComposition: false }),
  ]);
  const visualCol = el('div', { class: 'example-showcase-visual-col' }, [donut, donutLegend(donutArgs)]);
  const arrowWrap = el('div', { class: 'example-showcase-arrow-wrap' }, [exampleShowcaseScrollArrow()]);

  return el('section', { class: 'example-showcase', 'aria-labelledby': 'example-showcase-question' }, [
    textCol,
    amountBlock,
    visualCol,
    arrowWrap,
  ]);
}

/**
 * [2026-08-14, 관리자 지시 — 배포 번들 실측 회귀] 절세액(카드 안)의 금액
 * 덩어리(`.amount-value-chunk`, `amountValueNode` 참고)가 카드보다 넓으면
 * **폭에 맞는 최대 글자 크기까지 실측 기반으로 줄인다.**
 *
 * **왜 CSS `clamp()`가 아니라 JS 실측인가.** `clamp()`는 뷰포트 폭(`vw`) 또는
 * 컨테이너 쿼리 단위 기준이라, "이 특정 문자열의 이 특정 덩어리가 이 카드
 * 안에 들어가는가"라는, **문자열 길이(자릿수)에 따라 달라지는** 질문에는
 * 안 맞는다. **[2026-08-17, D71]** 헤드라인이 구간(최대 두 덩어리)에서 확정
 * 단일 값(한 덩어리)으로 줄어 이 실측이 개입할 일은 크게 줄었지만, 안전망
 * 으로 그대로 둔다 — 세법이 바뀌어 자릿수가 늘어나는 경우까지 막는다.
 *
 * **덩어리 자체는 절대 쪼개지 않는다** — `nowrap`(styles.css `.amount-value-chunk`)
 * 은 그대로 두고 오직 글자 크기만 줄인다.
 */
const AMOUNT_VALUE_MIN_FONT_PX = 32;

function fitAmountValueToCard(root) {
  const value = root.querySelector('.example-showcase-amount .amount-card-value');
  if (!value) return;
  const chunks = [...value.querySelectorAll('.amount-value-chunk')];
  if (chunks.length === 0) return;
  // 이전 실측이 남긴 인라인 크기를 먼저 지운다 — CSS(미디어쿼리)가 정한
  // 기본 크기부터 다시 잰다. 안 지우면 좁아졌다가 넓어진 경우(창 크기 조절)
  // 계속 줄어들기만 한다.
  value.style.fontSize = '';
  const cssFontPx = parseFloat(getComputedStyle(value).fontSize);
  if (!(cssFontPx > 0)) return;

  // 최대 3회 — 글자 크기와 실제 렌더 폭은 완전히 선형이 아니라(자간·숫자
  // 폭 미세 차이) 한 번의 비례식으로 정확히 맞아떨어지지 않을 수 있다.
  // 여유 4%를 남겨 서브픽셀 반올림으로 다시 넘치는 것을 막는다.
  for (let i = 0; i < 3; i++) {
    const available = value.clientWidth;
    if (!(available > 0)) return;
    // `getBoundingClientRect().width`를 쓴다 — 인라인 요소(`<span>`)의
    // `scrollWidth`/`clientWidth`는 Chrome에서 0을 낸다(실측 확인).
    const widest = Math.max(...chunks.map((c) => c.getBoundingClientRect().width));
    if (widest <= available) return; // 이미 들어간다 — 더 줄일 필요 없다
    const current = parseFloat(getComputedStyle(value).fontSize);
    const next = Math.max(AMOUNT_VALUE_MIN_FONT_PX, Math.floor(current * (available / widest) * 0.96));
    value.style.fontSize = `${next}px`;
    if (next === AMOUNT_VALUE_MIN_FONT_PX) return; // 바닥에 닿았다 — 더 줄여도 소용없다
  }
}

/**
 * 메인 문서의 스타일을 shadow root 안으로 옮겨 붙인다. 개발 모드는 index.html의
 * `<link rel="stylesheet">`를, `scripts/build.mjs`가 만드는 배포 산출물은 인라인
 * `<style>`을 쓴다 — 둘 다 지원해야 한다(머리말 참고). shadow root는 별도
 * 스타일 스코프라 이 작업 없이는 디자인 토큰 값만 상속되고(커스텀 프로퍼티는
 * shadow 경계를 넘는다) 클래스 규칙은 하나도 적용되지 않는다.
 *
 * **[2026-08-17, 소유자 스크린샷 회귀] 첫 번째 `<style>`만 집지 않는다 —
 * `document.querySelectorAll('style, link[rel="stylesheet"]')`로 문서에 있는
 * 전부를, 문서 순서 그대로 복제한다.** 원인 — 아티팩트 발행 시스템은 이
 * 파일(콘텐츠만, doctype 없음)을 자기 skeleton으로 감싸면서 최소 CSS reset을
 * `<head>`에 먼저 주입한다. HTML 파싱 규칙상 감싸인 문서 안에 중첩된 `<head>`는
 * 무시되고 그 안의 우리 `<style>`은 `<body>`의 자식으로 재배치된다 — 그러면
 * `document.querySelector('head > style')`의 **첫(그리고 유일한) 매치가 그
 * 주입된 reset이고, 우리 스타일시트는 통째로 빠진다**(실측:
 * `artifact-build.browser.mjs`의 "아티팩트 뷰어처럼 감싼 문서" 검사이 고치기
 * 전 코드로 이 정확한 실패를 재현한다). 개발 서버·GitHub Pages 배포본은
 * 감싸는 바깥 문서가 없어 첫 스타일이 항상 우리 것이라 이 결함이 드러나지
 * 않았다 — 아티팩트 뷰어에서만 재현된다.
 *
 * **전부 복제하면 문서 순서(주입 reset이 먼저, 우리 것이 나중)가 캐스케이드
 * 순서로 그대로 보존된다** — 어떤 호스트가 무엇을 얼마나 주입하든 우리
 * 규칙이 항상 마지막에 적용된다.
 */
function attachHostStyles(shadowRoot) {
  const nodes = [...document.querySelectorAll('style, link[rel="stylesheet"]')];
  const loadWaits = [];
  for (const node of nodes) {
    if (node.tagName === 'STYLE') {
      const clone = document.createElement('style');
      clone.textContent = node.textContent;
      shadowRoot.appendChild(clone);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href;
      shadowRoot.appendChild(link);
      loadWaits.push(
        new Promise((resolve) => {
          link.addEventListener('load', resolve, { once: true });
          link.addEventListener('error', resolve, { once: true });
        }),
      );
    }
  }
  if (nodes.length === 0) {
    // 개발 모드인데 아직 <link>가 index.html에 없는 것 같은 예외적인 경우
    // 대비 — 옛 구현의 기본 경로를 그대로 유지한다.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './styles.css';
    shadowRoot.appendChild(link);
    loadWaits.push(
      new Promise((resolve) => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      }),
    );
  }
  return Promise.all(loadWaits);
}

/**
 * 마운트 지점. `hostEl`은 header와 `.app-main` 사이에 놓인 빈 컨테이너
 * (`ui/app.js`)다. 실패해도(엔진 오류 등) 본 계산기(입력·결과)는 영향을 받지
 * 않는다 — 조용히 자리를 비운다. 사용자 입력값이 여기 들어올 일이 없으므로
 * 콘솔 로그는 계측 금지 규약(사용자 입력을 밖으로 내지 않는다)과 무관하다.
 *
 * **[2026-08-17, D72] 도넛 조각 라벨(이름+비율)은 이제 `charts.js`의
 * `applyDonutSliceInlineLabels`가 그린다** — 이 예시의 shadow root와 결과
 * 패널(모바일)이 같은 함수를 공유한다. 테마 전환 재계산도 그 파일의
 * `watchDonutThemeChange`(같은 두 경로 — 명시적 전환·시스템 설정 전환)를
 * 그대로 쓴다.
 */
export async function mountExampleShowcase(hostEl, { engineClient }) {
  if (!hostEl || typeof hostEl.attachShadow !== 'function') return;
  const shadowRoot = hostEl.shadowRoot ?? hostEl.attachShadow({ mode: 'open' });
  shadowRoot.replaceChildren();
  const stylesReady = attachHostStyles(shadowRoot);
  try {
    const [data] = await Promise.all([computeExampleScenario(engineClient), stylesReady]);
    shadowRoot.appendChild(exampleShowcaseSection(data));

    const refresh = () => {
      fitAmountValueToCard(shadowRoot);
      applyDonutSliceInlineLabels(shadowRoot);
    };
    // **동기로, 바로 잰다 — `requestAnimationFrame`을 쓰지 않는다.** 다음
    // 프레임까지 미루면 그 사이(첫 페인트가 CSS 기본값 그대로 나가는) 한
    // 프레임 동안 절세액이 카드·뷰포트를 넘는 순간이 실제로 생긴다 —
    // 브라우저 하니스가 그 프레임을 잡아 좁은 폭에서 가로 스크롤 검사가
    // 간헐적으로 실패하는 것으로 드러났다. `getBoundingClientRect()`·
    // `getBBox()`는 호출 즉시 레이아웃을 강제로 계산하므로(paint를 기다리지
    // 않는다), 이 시점(`stylesReady`가 이미 끝나 스타일은 적용된 상태)에
    // 곧바로 재도 정확한 값을 얻는다.
    refresh();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(refresh, 150);
      });
    }
    watchDonutThemeChange(() => applyDonutSliceInlineLabels(shadowRoot));
  } catch (err) {
    console.error('[example-showcase] 예시를 계산하지 못했습니다', err);
  }
}
