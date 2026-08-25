/**
 * 차트 세 층 — `screens.md` 5절 확정안. C-1 입체 도넛, C-2 한도 트랙 막대,
 * C-3 스택바. 세법 수치는 다루지 않는다 — 전부 엔진이 낸 금액을 그대로 그린다.
 *
 * 기하 파라미터(기울기 15°·두께 8%·시작각 12시·조각 순서)는 디자인 시스템이
 * 고정한 값이다(design-system.md 5.20절). 세법 수치가 아니라 화면 기하 상수이므로
 * 여기 상수로 둔다 — 제품 원칙 1이 금지하는 "세법 수치 하드코딩"과는 다른 것이다.
 */

import { el, svgEl } from './dom.js';
import { ACCOUNT_LABEL, UNALLOCATED_LABEL, DONUT_CENTER_LABEL, PLACEHOLDER_VALUE_MARK } from '../copy.js';
import { formatKrw, formatKrwAbbreviated, formatPercent } from '../format.js';

const CHART_ACCOUNT_ORDER = ['annuity_savings', 'retirement_pension', 'isa'];
const TILT_DEG = 15;
const EXTRUDE_RATIO = 0.08;
const RY_RATIO = Math.cos((TILT_DEG * Math.PI) / 180);

const ACCOUNT_COLOR = {
  annuity_savings: 'var(--data-pension)',
  retirement_pension: 'var(--data-irp)',
  isa: 'var(--data-isa)',
};
/**
 * 압출 측면. **여기서 색을 계산하지 않는다.**
 *
 * 초판 설계는 "상단면 색의 명도 −18%"라는 산식만 주고 토큰을 만들지 않았다.
 * 그것은 구현할 수 없는 문장이다 — 어느 색공간의 명도인지, 곱인지 뺄셈인지가
 * 정해지지 않으면 구현마다 다른 색이 나온다. 설계가 산식(OKLCH L − 0.112)의
 * 결과를 토큰으로 박아 두었으므로(design-system 5.20절) 구현은 그 토큰을 읽기만
 * 한다. **계산으로 두면 계좌 색이 바뀔 때 측면이 따라오지 않는다.**
 */
const ACCOUNT_SIDE_COLOR = {
  annuity_savings: 'var(--data-pension-side)',
  retirement_pension: 'var(--data-irp-side)',
  isa: 'var(--data-isa-side)',
};
const UNALLOCATED_COLOR = 'var(--data-unallocated)';
/** 미배분 조각의 측면도 전용 토큰이다 — 상단면과 같은 색을 쓰면 깊이가 사라진다. */
const UNALLOCATED_SIDE_COLOR = 'var(--data-unallocated-side)';
const PLACEHOLDER_COLOR = 'var(--data-placeholder)';
// **[2026-08-17, D72] `CIRCLED_NUMBERS`(모바일 ①②③ 배지)는 여기 있었다 —
// 삭제됐다.** 조각 위에 계좌 이름을 직접 쓰는 방식으로 바뀌면서(아래
// `applyDonutSliceInlineLabels`) 조각과 범례를 잇는 번호 자체가 필요 없어졌다
// (계좌 이름이 조각 위에 이미 있으므로 범례도 이름으로 바로 짝지어진다).

function polar(cx, cy, rx, ry, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + rx * Math.sin(rad), cy - ry * Math.cos(rad)];
}

/**
 * 링 하나의 패스. 조각이 원 전체(360°)를 차지하면 시작점과 끝점이 같은 좌표가
 * 되고, **끝점이 시작점과 같은 SVG 호는 아무것도 그리지 않는다.** 그러면 패스가
 * 세로 선분으로 붕괴해 도넛이 폭 0으로 렌더된다 — 배분이 한 계좌에 전부 들어간
 * 사용자(배제된 계좌가 있으면 더 흔해진다)에게 도넛이 통째로 사라지는 것이고,
 * 관리자가 경고한 "0×0은 여백처럼 보인다"의 또 다른 사례다. 브라우저
 * `getBoundingClientRect()`로 폭 0을 실측해 확인했다. 360°는 반원 두 개로
 * 나눠 그린다.
 */
export function annulusSlicePath(cx, cy, rOuter, rInner, ry, startDeg, endDeg) {
  if (endDeg - startDeg >= 360) {
    const midDeg = startDeg + 180;
    const [ox1, oy1] = polar(cx, cy, rOuter, rOuter * ry, startDeg);
    const [ox2, oy2] = polar(cx, cy, rOuter, rOuter * ry, midDeg);
    const [ix1, iy1] = polar(cx, cy, rInner, rInner * ry, startDeg);
    const [ix2, iy2] = polar(cx, cy, rInner, rInner * ry, midDeg);
    // 바깥 링은 시계방향, 안쪽 링은 반시계방향 — nonzero 채우기 규칙이 가운데를
    // 구멍으로 남긴다(도넛의 표준 작도).
    return [
      `M ${ox1} ${oy1}`,
      `A ${rOuter} ${rOuter * ry} 0 0 1 ${ox2} ${oy2}`,
      `A ${rOuter} ${rOuter * ry} 0 0 1 ${ox1} ${oy1}`,
      `M ${ix1} ${iy1}`,
      `A ${rInner} ${rInner * ry} 0 0 0 ${ix2} ${iy2}`,
      `A ${rInner} ${rInner * ry} 0 0 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ');
  }
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, rOuter * ry, startDeg);
  const [x2, y2] = polar(cx, cy, rOuter, rOuter * ry, endDeg);
  const [x3, y3] = polar(cx, cy, rInner, rInner * ry, endDeg);
  const [x4, y4] = polar(cx, cy, rInner, rInner * ry, startDeg);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter * ry} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner * ry} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * 조각으로 그릴 대상을 정하는 **순수 함수**. C-1 도넛과 C-3 스택바가 같은 것을
 * 쓴다 — 두 차트가 각자 판단하면 한쪽만 고쳐지는 사고가 난다(실제로 그랬다).
 *
 * `excludedAccounts`(엔진의 `account_eligibility`에서 온 배제 계좌)는 조각을
 * 아예 만들지 않는다. 계약상 배제된 계좌의 배분액은 항상 0이고
 * (`limited_by: "not_eligible"`), 따라서 이 필터가 실제 금액을 감추는 일은
 * 없다. 그럼에도 명시적으로 거르는 이유는 **0원 조각이 조용히 사라지는 것과
 * 배제를 이유로 그리지 않는 것이 다른 사실**이기 때문이다 — 후자는 테스트로
 * 고정할 수 있고, 배제 계좌에 금액이 실려 오는 계약 위반 상황에서도 받을 수
 * 없는 계좌에 돈을 넣은 그림을 그리지 않는다.
 */
export function allocationSegments({ allocations, unallocatedAnnualKrw = 0, excludedAccounts = [] }) {
  const excluded = new Set(excludedAccounts);
  const byAccount = Object.fromEntries((allocations ?? []).map((a) => [a.account, a.annual_krw]));
  const segments = CHART_ACCOUNT_ORDER.filter((account) => !excluded.has(account)).map((account) => ({
    account,
    amount: byAccount[account] || 0,
    isUnallocated: false,
  }));
  if (unallocatedAnnualKrw > 0) {
    segments.push({ account: 'unallocated', amount: unallocatedAnnualKrw, isUnallocated: true });
  }
  return segments;
}

export const MIN_SLICE_DEG = 2;

/**
 * gapPx(화면 px)를 반지름 `rMid` 기준 각도(도)로 환산한다. 호의 길이
 * `≈ rMid × radian`이라는 근사를 쓴다 — 자리표시자 조각 간격
 * (`PLACEHOLDER_GAP_PX`)이 원래 이 식을 인라인으로 갖고 있었는데,
 * [2026-08-14, 관리자 지시 2번]로 결과 도넛에도 같은 간격이 필요해지면서
 * 공유 지점으로 뽑았다.
 */
function pxGapToDeg(gapPx, rMid) {
  return rMid > 0 ? (gapPx / (2 * Math.PI * rMid)) * 360 : 0;
}

/**
 * 조각의 시작·끝 각도를 낸다. **금액이 0보다 크면 최소 `MIN_SLICE_DEG`를
 * 보장한다**(design-system 5.20절 확정 규약: "보이지 않는 조각보다 약간 부정확한
 * 조각이 낫고, 그 왜곡은 조각 라벨의 금액이 바로잡는다"). 늘린 만큼은 최소각보다
 * 큰 조각들에서 비례로 덜어내므로 합은 언제나 360°다.
 *
 * 순수 함수다 — 각도 규약을 DOM 없이 테스트로 고정하기 위해서다.
 */
export function sliceAngles(segments, { minDeg = MIN_SLICE_DEG } = {}) {
  const drawable = (segments ?? []).filter((s) => s.amount > 0);
  const total = drawable.reduce((sum, s) => sum + s.amount, 0);
  if (total <= 0) return [];

  const raw = drawable.map((s) => ({ ...s, sweep: (s.amount / total) * 360 }));
  const deficit = raw.reduce((sum, s) => sum + Math.max(0, minDeg - s.sweep), 0);
  const donorTotal = raw.filter((s) => s.sweep > minDeg).reduce((sum, s) => sum + s.sweep, 0);
  const adjusted = raw.map((s) => {
    if (s.sweep < minDeg) return { ...s, sweep: minDeg };
    if (deficit === 0 || donorTotal <= 0) return s;
    return { ...s, sweep: s.sweep - deficit * (s.sweep / donorTotal) };
  });

  let angle = 0;
  return adjusted.map((s) => {
    const arc = { ...s, start: angle, end: angle + s.sweep };
    angle += s.sweep;
    return arc;
  });
}

/**
 * 도넛 바깥지름. `screens.md` 5.2절(데스크톱 와이어프레임 주석 `외경 260px`)과
 * 5.7절(모바일 `C-1 외경 200px`)이 정한 값이다 — 설계가 답한 수치이므로 이
 * 유닛이 새로 정하지 않는다. 세법 수치가 아니라 화면 기하 상수다.
 *
 * `labelled`는 라벨이 도넛 옆에 붙는 모드(데스크톱), `legend`는 라벨이 도넛 아래
 * 리스트로 내려가는 모드(모바일, 5.7절)다.
 *
 * **`labelledWide`는 2026-08-12 D48 신설이다.** 결과 패널이 넓어지면서
 * (`styles.css` `.app-layout` 1360→1680px) 도넛만 고정폭이라 카드 안에서
 * 작아 보인다는 것이 관리자 판정이다(`docs/org/gate-decisions.md` D48 후속
 * "도넛도 키운다") — 소유자가 "전체적으로"·"전체 페이지에서 차지하는 비중"
 * 이라고 했으므로 도넛도 함께 커지되 **상한을 둔다**. 320은 컨테이너 최대폭이
 * 커진 비율(1360→1680px, ×1.235, design-system 4.4.1절 실측)을 그대로 적용한
 * 값이다(260×1.235 ≈ 321 → 320). 임의의 "더 크게"가 아니라 컨테이너가 커진
 * 비율과 같은 비율로 키운 값이고, 그 비율에서 멈추는 것이 상한이다 — 무한정
 * 키우면 옆의 `AccountBenefitStrip`·`AllocationBar`(전체 폭 100%, D35·D16)와의
 * 위계가 뒤집힌다(도넛은 "정체를 보여주는 아이콘"이지 "패널을 채우는
 * 도형"이 아니다, design-system 5.20절). 어느 뷰포트에서 켜지는지는
 * `preferredDonutSizeMode`가 정한다.
 */
export const DONUT_OUTER_DIAMETER = { labelled: 260, labelledWide: 320, legend: 200, legendCompact: 200 };

/**
 * 라벨 블록이 들어갈 좌우 여백을 반지름(R)으로부터 낸다.
 *
 * **유도식은 실측에서 나왔다.** 세 프로필의 라벨 블록 폭을 브라우저에서
 * `getBoundingClientRect()`로 재니 최대 108.8px이었고(가장 긴 줄은 금액
 * `1,250,000원 / 월`), 자릿수가 더 늘어날 여지를 두어 `LABEL_TEXT_BUDGET`을
 * 132px로 잡았다. 라벨의 x는 `cx ± (R×1.2 + 10)`이고 텍스트는 거기서 바깥쪽으로
 * 뻗으므로, 여백은 `(R×0.2 + 10 + 텍스트폭)` 이상이어야 한다(cx = R + gutter이므로
 * `gutter ≥ R×0.2 + 10 + 텍스트폭`). R=130에서 그 값은 168px이고, 여유 8px을
 * 더해 176으로 둔다 — `LABEL_GUTTER`가 그 값이다.
 *
 * **R=160(`labelledWide`, D48)에서는 상수 하나로 버티지 못한다.** 같은 식으로
 * 필요한 값이 174px이라 176px 여유는 2px밖에 안 남는다 — 상수 하나를 두 R에
 * 우연히 맞춰 쓰는 대신, 식 자체를 함수로 둔다. `labelGutterFor(130)`은
 * `LABEL_GUTTER`와 정확히 같은 176을 낸다(테스트가 그 동치를 고정한다).
 *
 * 이 관계는 테스트가 고정한다 — 예전 구현은 라벨을 `R×1.22` 지점에 찍으면서
 * viewBox는 도넛 크기 그대로여서 라벨이 통째로 잘려 나갔고, 스크린샷으로는
 * "원래 그런 디자인"과 구분되지 않았다.
 */
function labelGutterFor(R) {
  return Math.ceil(R * 0.2 + 10 + LABEL_TEXT_BUDGET) + 8;
}
export const LABEL_GUTTER = 176;
export const LABEL_TEXT_BUDGET = 132;
const LABEL_VPAD = 26;
/**
 * `legend` 모드(모바일 결과·계산기2 결과·팝업·예시) 도넛 둘레에 남기는 여백.
 *
 * **원래 이유(8→10, 조각 번호)는 D72로 없어졌다** — 조각 순번 배지
 * (`sliceNumbers`)를 지우고 계좌 이름을 조각 위에 직접 쓰는 방식으로
 * 바뀌면서, "번호가 상자 밖으로 잘리지 않게"라는 옛 근거 자체가 사라졌다.
 *
 * **[2026-08-23, 소유자 지시 1번(신규 회차)] 지금의 진짜 이유 — 고리 밖으로
 * 밀려난 조각 라벨(`applyDonutSliceInlineLabels`의 폴백 경로)이 이 여백
 * 밖으로 잘려 나갔다(실측 — 팝업의 "연금저축"이 잘렸다).** 그 폴백은
 * 라벨을 `rOuter + gap`(최소 `SLICE_LABEL_OUTSIDE_GAP_CLOSE`=5, 최대
 * `SLICE_LABEL_OUTSIDE_GAP`=16에서 시작해 겹침을 피해 더 밀려날 수 있다)
 * 반지름에 **글자 상자 중심**을 찍는다(`dominant-baseline: central`) —
 * 상자 절반이 그 반지름보다 더 바깥으로 나간다.
 *
 * **[2026-08-23, 소유자 지시 1·2번(신규 회차)] 40→65로 다시 올렸다.**
 * 지난 회차(40)는 라벨 글자 크기(`SLICE_LABEL_NAME_FONT_PX`)가 15px일 때도
 * "연금저축" 같은 넓은 라벨(4음절+두 자리 %)에서는 여전히 폴백이 글자를
 * 줄여야 했다 — 소유자가 "글자가 안 보인다"고 두 회차 연속 신고했고, 이번
 * 회차 지시는 "폴백으로 다시 줄이는 방향 금지, 공간을 늘려 해결"이었다.
 * 그런데 이번 회차는 그 글자 크기 자체도 15→16.5px로 키웠고, 고리를
 * 벗어나는 데 필요한 간격도 폭이 넓어진 라벨일수록 함께 늘어난다(고리
 * 겹침 회피와 여백 확보가 서로 되먹임한다) — 50으로도 "연금저축"이
 * 11.5px까지 줄었다(실측). 65에서는 가장 넓은 그 라벨도 15.5px(기본값의
 * 94%)까지만, 나머지는 16.5px 그대로 고리를 벗어나며 카드 안에 든다(실측
 * 확인, `donut-label-overlap.browser.mjs`의 `assertFontFloor`). 아래
 * `charts.test.mjs`의 `wasted` 상한도 함께 올렸다.
 *
 * **[2026-08-25, 관리자 지시 — 소유자 지시(6항목) 2번] 65→85.** 라벨
 * 기본 크기(`SLICE_LABEL_NAME_FONT_PX`)를 16.5→18로 올리며(그 상수 옆
 * 주석 — +20% 목표) "연금저축"이 65 여백에서는 다시 축소됐다(실측: 16px
 * 까지 눌려 최종 +13.5%에 그쳤다). 여백을 넓혀 그 축소 자체가 안 걸리게
 * 했다 — 85에서는 가장 넓은 라벨도 18px 그대로 고리·카드 경계를
 * 벗어난다(축소 폴백 0회, 실측 확인). 뷰박스가 330→370으로 커진 만큼
 * "도넛 CSS 폭 +10%"의 기준도 함께 역산했다(`styles.css`의 두 도넛 CSS
 * 규칙 옆 주석).
 */
const LEGEND_PAD = 85;
/**
 * [2026-08-25, 관리자 재지적 — 소유자 지시(6항목) 2번] `legendCompact` 전용
 * 여백 — 팝업 예시 도넛(148px CSS ÷ 370 뷰박스=배율 0.4)이 계산기2 결과
 * 도넛(배율 0.6967)과 같은 배율이 아니라서, `SLICE_LABEL_NAME_FONT_PX`를
 * 그대로 먹여도 최종 화면 픽셀이 다르다(위 `REFERENCE_RENDER_SCALE` 주석
 * — 진짜 원인 설명). 그 배율 차이를 라벨 글자 크기 보정(뷰박스 단위
 * 18→약 31.35)으로 상쇄하기로 했는데, `LEGEND_PAD`(85)는 18px 기준으로
 * 맞춘 여백이라 31px대 글자는 못 들어간다 — 실측(1차 시도, 85 그대로):
 * 가장 넓은 라벨("연금저축")만 여백 부족으로 다시 축소 폴백을 타 10px로
 * 되돌아갔다(짧은 "IRP"·"ISA"는 17px로 성공) — 소유자가 지적한 "축소
 * 로직이 다시 먹는" 바로 그 패턴이 여백을 계산기2와 공유하는 한 되풀이
 * 된다.
 *
 * **그래서 팝업 전용 도넛 모드(`legendCompact`)를 새로 만들어 계산기2
 * (`legend`)와 뷰박스를 분리했다** — 계산기2의 `LEGEND_PAD`(85)·CSS
 * 폭(257.77px)은 이 변경으로 전혀 흔들리지 않는다(다른 상수, 다른 호출부
 * — `result-panel.js`는 여전히 `legend`만 쓴다). 이 상수(150)는 85에
 * 보정 배율(REFERENCE_RENDER_SCALE÷0.4≈1.742)을 곱한 근사치(85×1.742≈148)
 * 에서 시작해 실측으로 다졌다 — "연금저축"이 축소 없이 목표 글자 크기
 * (뷰박스 31.35px, 렌더 17px) 그대로 고리·카드 경계를 벗어나는지 브라우저로
 * 확인했다(`donut-label-overlap.browser.mjs`). 뷰박스가 커지는 만큼
 * 링(도넛 그림) 렌더 크기가 줄지 않도록 `styles.css`의 팝업 도넛 CSS 폭도
 * "링 보존" 공식(이전 회차와 같은 유도)으로 함께 키웠다 — 소유자 지시
 * "도넛 그림 크기 자체는 지금대로"를 지킨다.
 */
const LEGEND_PAD_COMPACT = 150;
const LABEL_LINE_GAP = 56; // 세 줄짜리 라벨 블록의 최소 세로 간격
/**
 * 라벨의 y는 **첫 줄의 기준선**이고 아래로 두 줄이 더 붙는다. 이 값을 계산에
 * 넣지 않으면 마지막 라벨의 아래 두 줄이 상자 밖으로 나간다 — 실제로 브라우저
 * 실측에서 6px 잘려 나온 것을 잡았다. 라벨 하나가 아니라 **블록**이 자리를
 * 차지한다는 사실을 좌표 계산이 알아야 한다.
 */
export const LABEL_BLOCK_BELOW = 42;

/**
 * 도넛의 기하를 한 곳에서 낸다. **순수 함수다** — `donutChart`와 테스트가 같은
 * 값을 보게 하려는 것이다. 예전에는 이 계산이 렌더 함수 안에 있었고 테스트가
 * 상수를 따로 베껴 두고 있어서, 지름을 바꾸면 테스트는 옛 상자를 검사했다.
 */
export function donutGeometry(labelMode = 'labelled') {
  // D48 — 세 모드였다가, [2026-08-25, 관리자 재지적] `legendCompact`가
  // 넷째로 늘었다 — `legend`와 지름은 같지만(도넛 그림 자체 크기는 그대로,
  // 소유자 지시 "공간 제약") 여백(`LEGEND_PAD_COMPACT`)이 훨씬 넓다.
  // 이유는 아래 `LEGEND_PAD_COMPACT` 주석 참고. `legend`가 아니면 전부
  // "라벨을 옆에 그린다"는 뜻이고, `labelled`/`labelledWide`는 지름만
  // 다르다. 알 수 없는 값은 `labelled`로 떨어진다(예전과 같은 안전한
  // 기본값).
  const mode =
    labelMode === 'legend' || labelMode === 'legendCompact' || labelMode === 'labelledWide' ? labelMode : 'labelled';
  const isLegend = mode === 'legend' || mode === 'legendCompact';
  const diameter = DONUT_OUTER_DIAMETER[mode];
  const R = diameter / 2;
  const legendPad = mode === 'legendCompact' ? LEGEND_PAD_COMPACT : LEGEND_PAD;
  const pad = isLegend ? legendPad : LABEL_VPAD;
  const gutter = isLegend ? legendPad : labelGutterFor(R);
  const depth = R * EXTRUDE_RATIO;
  const width = diameter + gutter * 2;
  const height = diameter + depth + pad * 2;
  return { mode, diameter, R, rInner: R * 0.55, depth, width, height, cx: width / 2, cy: pad + R };
}

/**
 * 라벨을 옆에 붙일 것인가(데스크톱) 아래 리스트로 내릴 것인가(모바일).
 *
 * CSS만으로는 `viewBox`를 바꿀 수 없다. 그래서 모바일에서 라벨을
 * `display: none`으로 감추기만 했더니 **라벨 자리로 비워 둔 좌우 여백은 그대로
 * 남아** 같은 폭 안에서 도넛만 작아졌다 — 실측에서 모바일 도넛 외경이 127.7px로,
 * 설계가 정한 200px보다 72px 작았다. 폭이 아니라 상자 자체를 모드에 따라 다르게
 * 만들어야 한다.
 */
export function preferredLabelMode() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'labelled';
  return window.matchMedia(COMPACT_MEDIA_QUERY).matches ? 'legend' : 'labelled';
}

/** `styles.css`의 모바일 분기와 같은 폭이어야 한다. 어긋나면 라벨이 두 번 보이거나 아예 사라진다. */
export const COMPACT_MEDIA_QUERY = '(max-width: 767px)';

/**
 * D48 신설 — `preferredLabelMode`가 가르는 축(모바일이냐 아니냐)과 별개로,
 * 데스크톱 안에서 도넛이 확대 모드(`labelledWide`)를 쓸지를 가른다. 결과
 * 패널이 실제로 넓어지는 지점(`styles.css` `.app-layout` 최대폭이 뷰포트
 * 상한보다 좁아져 실제로 걸리기 시작하는 경계, design-system 4.4절
 * `≥1440px` 행 · 4.4.1절 "1280px는 세 후보 모두 무변화" 실측)과 같은
 * 값이다 — 컨테이너가 안 넓어졌는데 도넛만 넓어지면 둘이 따로 논다.
 */
export function preferredDonutSizeMode() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'labelled';
  if (window.matchMedia(COMPACT_MEDIA_QUERY).matches) return 'legend';
  return window.matchMedia(WIDE_DONUT_MEDIA_QUERY).matches ? 'labelledWide' : 'labelled';
}

/** `styles.css`의 `.app-layout` 폭 상한이 실제로 걸리기 시작하는 경계와 같다. */
export const WIDE_DONUT_MEDIA_QUERY = '(min-width: 1440px)';

/**
 * 도넛 라벨의 배치를 정하는 **순수 함수**.
 *
 * 왜 따로 뺐나 — 이전 구현은 라벨을 `R * 1.22` 지점에 찍었는데 viewBox는 도넛
 * 크기 그대로였다. 즉 **라벨이 그림 밖에 그려져 잘려 나갔다.** 소유자가 "라벨이
 * 안 보인다"고 한 것이 그것이고, 스크린샷으로는 "원래 그런 디자인"과 구분되지
 * 않는다. 좌표 계산을 DOM 밖으로 꺼내야 "라벨이 화면 안에 있는가"를 테스트로
 * 고정할 수 있다.
 *
 * 반환값의 `leader`는 조각 → 꺾임점 → 라벨로 이어지는 지시선의 점 목록이고,
 * 조각마다 정확히 하나다(screens.md 5.6절: 지시선 `border-strong` 1px).
 */
export function donutLabelLayout(arcs, { cx, cy, R, ry = RY_RATIO, width, height, gap = LABEL_LINE_GAP }) {
  const placed = arcs.map((a) => {
    const mid = (a.start + a.end) / 2;
    const [px, py] = polar(cx, cy, R, R * ry, mid); // 조각 바깥 테두리의 한 점
    const [ex, ey] = polar(cx, cy, R * 1.16, R * ry * 1.16, mid); // 꺾임점
    const side = px >= cx ? 'right' : 'left';
    return { arc: a, side, px, py, ex, ey, y: ey };
  });

  // 좌우 각각에서 위에서 아래로 밀어내 겹침을 없앤다. 라벨이 겹치면 어느 조각의
  // 값인지 알 수 없어 A2(직접 라벨)가 무너진다.
  const firstBaseline = LABEL_VPAD + 14; // 첫 줄 기준선이 상자 위쪽으로 나가지 않게
  const lastBaseline = height - LABEL_BLOCK_BELOW; // 아래 두 줄이 들어갈 자리를 남긴다
  for (const side of ['left', 'right']) {
    const column = placed.filter((p) => p.side === side).sort((a, b) => a.y - b.y);
    let cursor = firstBaseline;
    for (const item of column) {
      item.y = Math.max(item.y, cursor);
      cursor = item.y + gap;
    }
    const overflow = cursor - gap - lastBaseline;
    if (overflow > 0) for (const item of column) item.y = Math.max(firstBaseline, item.y - overflow);
  }

  return placed.map((p) => {
    const textX = p.side === 'right' ? Math.min(width - 8, cx + R * 1.2 + 10) : Math.max(8, cx - R * 1.2 - 10);
    const elbowX = p.side === 'right' ? textX - 8 : textX + 8;
    return {
      account: p.arc.account,
      isUnallocated: p.arc.isUnallocated,
      side: p.side,
      anchor: p.side === 'right' ? 'start' : 'end',
      textX,
      textY: p.y,
      leader: [
        [p.px, p.py],
        [p.ex, p.ey],
        [elbowX, p.y],
      ],
    };
  });
}

/**
 * C-1 입체 도넛. `allocations`는 계약의 `Allocation[]`(월·연 금액을 모두 갖는다),
 * `unallocatedAnnualKrw`/`unallocatedMonthlyKrw`는 이번 배분에서 남는 금액,
 * `isProposed`는 개정예고 시나리오 여부(상단면에만 사선 해칭, design-system
 * 3.5절 규약 3), `excludedAccounts`는 배분 대상에서 배제된 계좌(조각도 라벨도
 * 그리지 않는다 — design-system 5.20절 비활성 상태).
 *
 * **라벨은 계좌명 + 금액 + 비율 세 줄이다**(screens.md 5.2 와이어프레임 · 5.6절).
 * 금액이 빠지면 A2(직접 라벨)가 절반만 작동한다 — 입체 도넛의 원근 왜곡은
 * 비율만으로 보정되지 않고, 사용자가 면적을 눈으로 재지 않아도 값을 읽을 수
 * 있게 하는 것이 이 장치의 목적이기 때문이다(5.3절).
 */
/**
 * [2026-08-14, 관리자 지시 2번] "도넛에 검은 점이 보인다" — 원인과 수정.
 *
 * **원인.** 압출 측면(`sides`, 아래)은 상단면(`tops`)과 똑같은 조각 경계
 * (`a.start`/`a.end`)를 **y좌표만 `depth`만큼 내려서** 그린다(`cy + depth`).
 * 인접한 두 조각(예: 연금저축 0~120°, IRP 120~180°)의 상단면은 120°에서
 * 정확히 맞닿아 이음매가 깨끗하다 — 실측(`getComputedStyle`·`getBBox`)으로
 * 확인했다. **문제는 그 아래, 압출이 드러나는 "벽" 구간이다.** 이 구현은
 * 진짜 3D 회전체가 아니라 상단면을 그대로 아래로 평행이동한 것이라 벽의
 * 두께가 모든 각도에서 `depth`로 균일하고, 그 결과 두 조각의 벽이 만나는
 * 자리(정확히 경계각)에서 **뾰족하게 끝나는 쐐기 모양**이 생긴다. 실제
 * 픽셀을 대조 색(디버그 렌더링)으로 확인하니, 이 쐐기 안쪽 상당 부분을
 * "옆 조각"이 아니라 **먼저 그려진 조각의 압출 측면색**이 차지하고 있었다
 * — 조각이 커질수록(관리자 지시 2번 "도넛을 50% 키운다") 이 쐐기도 함께
 * 커져 눈에 띄는 어두운 반점("검은 점")으로 읽힌다.
 *
 * **수정.** design-system 3.5.5절 규약 5가 애초에 "조각 사이 2px 표면색
 * 간격 — 스택바의 인접 조각, **도넛의 인접 조각 모두**"라고 요구하고
 * 있었고, 자리표시자 링(`placeholderSliceAngles`)은 이미 그 간격
 * (`PLACEHOLDER_GAP_PX`)을 구현하고 있었다 — **결과 도넛만 빠져 있었다.**
 * 이 함수가 상단면·측면·해칭의 **렌더링(`d` 속성)에만** 그 2px 간격을
 * 적용한다. 인접한 두 조각의 벽이 서로 살짝 물러나면서 그 사이에 빈
 * 쐐기(배경이 비치는 진짜 여백)가 생기고, 어느 한쪽 색이 다른 쪽 자리를
 * 침범해 어두운 반점을 만들 여지가 사라진다.
 *
 * **`data-arc-start`/`data-arc-end`(계약이 읽는 참값)는 건드리지 않는다.**
 * 간격은 렌더링에서만 나고, 각도 합(360°)·비율·`aria-label`·`hit-test`
 * (조각 **중앙** 각도 기준이라 대칭으로 물러난 간격의 영향을 받지 않는다)
 * 는 전부 참값을 그대로 쓴다 — 그래서 기존 기하 실측 검사가 값을 바꾸지
 * 않고도 그대로 통과한다. 진입 애니메이션(`runDonutEntrance`)이 최종
 * 프레임에서 참값으로 되돌려 간격을 지우지 않도록, 렌더링용 각도를
 * `data-render-start`/`data-render-end`에 별도로 남긴다.
 */
export const SLICE_GAP_PX = 2;

/** 조각 하나(`a`)의 렌더링용(시각적) 각도 — 대칭으로 `gapDeg/2`씩 물러난다.
 * 아주 작은 조각(`MIN_SLICE_DEG`)이 간격 때문에 뒤집히지 않도록 자기 각도의
 * 40%를 넘게 물러나지 않는다. */
function visualSliceAngle(a, gapDeg) {
  if (gapDeg <= 0) return { start: a.start, end: a.end };
  const inset = Math.min(gapDeg / 2, (a.end - a.start) * 0.4);
  return { start: a.start + inset, end: a.end - inset };
}

export function donutChart({
  allocations,
  unallocatedAnnualKrw,
  unallocatedMonthlyKrw = 0,
  totalAllocatedMonthlyKrw = 0,
  isProposed = false,
  excludedAccounts = [],
  // D48 — 모바일(legend)/데스크톱(labelled)뿐 아니라 넓은 데스크톱
  // (labelledWide)까지 가른다. `placeholderRing`도 같은 함수를 기본값으로
  // 써야 한다 — 자리표시자 상자가 결과 도넛과 어긋나면 결과가 들어올 때
  // 자리가 밀린다(placeholderGeometry 머리말).
  labelMode = preferredDonutSizeMode(),
  // 자리표시자가 사라진 **다음 프레임에** 조각을 0°에서 펼친다(design-system
  // 5.29절 전환 2번). 값이 바뀌어 다시 그리는 경우에는 걸지 않는다 — 그때
  // 움직이는 것은 각도이지 "결과가 처음 생겼다"는 사실이 아니다.
  animateFromZero = false,
  // [2026-08-20, 관리자 지시 — 첫 탭 예시 도넛 개편] **`'full'`(기본, 기존
  // 동작 그대로)이 아니라 `'manwon'`이면 중앙 값을 만원 단위로 줄인다**
  // (`formatKrwAbbreviated`, "숫자 전체 표기 금지" 지시). 결과 패널 등 다른
  // 모든 호출부는 이 인자를 넘기지 않으므로 기본값(`'full'`)을 그대로
  // 받는다 — 이 옵션은 예시 전용이다.
  centerValueFormat = 'full',
}) {
  const geom = donutGeometry(labelMode);
  const { R, rInner, depth, width, height, cx, cy } = geom;
  // `legend`류(`legend`·`legendCompact`, 2026-08-25 추가)만 라벨을 이 함수
  // 안에서 직접 그리지 않는다(대신 마운트 뒤 `applyDonutSliceInlineLabels`가
  // 조각 위/밖에 후처리로 그린다) — `labelled`·`labelledWide`는 둘 다 이
  // 함수 안에서 옆에 지시선 라벨을 그린다(지름만 다르다).
  const drawLabels = geom.mode !== 'legend' && geom.mode !== 'legendCompact';

  const segments = allocationSegments({ allocations, unallocatedAnnualKrw, excludedAccounts });
  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const arcs = sliceAngles(segments);

  // [2026-08-14, 관리자 지시 2번] 조각이 하나뿐이면(원 전체) 물러날 이웃이
  // 없다 — 간격을 걸면 "이유 없이 한 점에서 잘린 원"이 되어 오히려 결함처럼
  // 보인다. `donutChart` 머리말 위, `SLICE_GAP_PX`·`visualSliceAngle` 참고.
  const gapDeg = arcs.length > 1 ? pxGapToDeg(SLICE_GAP_PX, (R + rInner) / 2) : 0;

  // 라벨에 쓸 월 금액 — 엔진이 준 값을 그대로 쓴다(화면이 연 금액을 나누지 않는다).
  const monthlyByAccount = Object.fromEntries((allocations ?? []).map((a) => [a.account, a.monthly_krw]));
  const monthlyOf = (arc) => (arc.isUnallocated ? unallocatedMonthlyKrw : (monthlyByAccount[arc.account] ?? 0));
  const nameOf = (arc) => (arc.isUnallocated ? UNALLOCATED_LABEL : ACCOUNT_LABEL[arc.account]);

  // **측면에 `opacity`를 걸지 않는다.** 설계가 측면 색을 토큰으로 확정하면서
  // 상단면 대비(1.57~1.62)와 인접 측면끼리의 적록 ΔE를 그 값으로 실측했다 —
  // 투명도를 얹으면 화면에 실제로 나오는 색이 그 값이 아니게 되어, 검증기가
  // 판정한 색과 사용자가 보는 색이 갈린다.
  //
  // **`d`는 언제나 최종 각도다.** 조각을 0°로 지웠다가 채우는 일은 이 함수
  // 안에서 하지 않는다 — `class="chart-donut-slice"`와 `data-arc-*`만 남겨
  // 두고, 진입 애니메이션은 마운트 뒤 `runDonutEntrance`가 실제 DOM 위에서
  // 돈다(아래 주석 참고). 이 함수가 만드는 노드가 그대로 화면에 붙는다는
  // 보장이 없기 때문이다 — `patch()`(dom.js)는 구조가 같으면 새 노드를 버리고
  // 기존 노드에 속성만 복사한다.
  const sides = arcs.map((a) => {
    const va = visualSliceAngle(a, gapDeg);
    return svgEl('path', {
      d: annulusSlicePath(cx, cy + depth, R, rInner, RY_RATIO, va.start, va.end),
      fill: a.isUnallocated ? UNALLOCATED_SIDE_COLOR : ACCOUNT_SIDE_COLOR[a.account],
      class: 'chart-donut-slice',
      'data-cy': cy + depth,
      'data-arc-start': a.start,
      'data-arc-end': a.end,
      'data-render-start': va.start,
      'data-render-end': va.end,
    });
  });

  const tops = arcs.map((a) => {
    const va = visualSliceAngle(a, gapDeg);
    const path = svgEl('path', {
      d: annulusSlicePath(cx, cy, R, rInner, RY_RATIO, va.start, va.end),
      fill: a.isUnallocated ? UNALLOCATED_COLOR : ACCOUNT_COLOR[a.account],
      class: 'chart-donut-slice',
      'data-cy': cy,
      'data-arc-start': a.start,
      'data-arc-end': a.end,
      'data-render-start': va.start,
      'data-render-end': va.end,
      // [2026-08-17, D72] `applyDonutSliceInlineLabels`(아래)가 이름·비율
      // 라벨을 마운트 뒤 실측으로 그릴 때 이 두 값만 읽는다 — 조각 자체가
      // 이미 아는 사실(어느 계좌인지·금액이 얼마인지)을 호출부가 다시
      // 넘길 필요가 없게 하려는 것이다(계약 두 번 구현하면 하나는 낡는다).
      'data-account': a.isUnallocated ? 'unallocated' : a.account,
      'data-amount': a.amount,
      tabindex: '0',
      role: 'img',
      'aria-label': `${nameOf(a)}, 월 ${formatKrw(monthlyOf(a))}, 연 ${formatKrw(a.amount)}, 전체의 ${formatPercent(total > 0 ? a.amount / total : 0)}`,
    });
    return path;
  });

  const hatches = isProposed
    ? arcs
        .filter((a) => !a.isUnallocated)
        .map((a) => {
          const va = visualSliceAngle(a, gapDeg);
          return svgEl('path', {
            d: annulusSlicePath(cx, cy, R, rInner, RY_RATIO, va.start, va.end),
            fill: 'url(#donut-hatch)',
            opacity: 0.5,
            class: 'chart-donut-slice',
            'data-cy': cy,
            'data-arc-start': a.start,
            'data-arc-end': a.end,
            'data-render-start': va.start,
            'data-render-end': va.end,
          });
        })
    : [];

  const layout = drawLabels ? donutLabelLayout(arcs, { cx, cy, R, width, height }) : [];

  // 지시선 — 조각마다 하나. 라벨이 어느 조각의 값인지 모호하면 라벨이 값을 잃는다.
  const leaders = layout.map((l) =>
    svgEl('polyline', {
      class: 'donut-leader',
      points: l.leader.map(([x, y]) => `${x},${y}`).join(' '),
      fill: 'none',
    }),
  );

  // 라벨 세 줄 — 계좌명(type-body-s) / 금액(type-num) / 비율(type-caption).
  // 위계를 크기와 굵기로 만든다. 전부 같은 크기면 무엇이 값인지 보이지 않는다.
  const labels = layout.map((l, i) => {
    const a = arcs[i];
    const pct = total > 0 ? a.amount / total : 0;
    return svgEl('text', { class: 'donut-label', x: l.textX, y: l.textY, 'text-anchor': l.anchor }, [
      svgEl('tspan', { class: 'donut-label-name', x: l.textX, dy: '0' }, [nameOf(a)]),
      svgEl('tspan', { class: 'donut-label-amount', x: l.textX, dy: '1.35em' }, [`${formatKrw(monthlyOf(a))} / 월`]),
      svgEl('tspan', { class: 'donut-label-pct', x: l.textX, dy: '1.3em' }, [formatPercent(pct)]),
    ]);
  });

  // **[2026-08-17, D72] 모바일(legend 모드)에서 조각과 범례를 잇던 ①②③
  // 배지·번호(`sliceNumbers`, `donut-slice-indexes`)는 여기 있었다 — 지웠다.**
  // 소유자가 배지를 지우고 조각 위에 계좌 이름을 직접 쓰라고 지시했다 —
  // 이름이 조각 위에 있으면 번호로 다시 짝지을 이유가 없다. 실제 텍스트는
  // `applyDonutSliceInlineLabels`(이 파일 아래)가 **마운트된 뒤** 실측
  // (`getBBox`·대비)으로 그린다 — 이 함수(`donutChart`)는 아직 DOM에 붙지
  // 않은 노드를 만들 뿐이라 글자가 실제로 조각 안에 들어가는지 여기서는 알
  // 수 없다(SVG `<text>`의 렌더 크기는 폰트가 실제로 적용된 뒤에만 잰다).
  // 대신 이 함수는 그 후처리가 읽을 자리(`data-account`·`data-amount`, 위
  // `tops`)와 진입점(`data-label-mode`, 아래 `svg` 속성)만 남겨 둔다.

  // 중앙 값 — **월 배분 총액**(screens.md 5.8절이 절감세액을 여기 두지 않기로
  // 하면서 확정한 값, 5.12절이 조각 하나일 때도 그대로 둔다고 재확인).
  //
  // **7.0.0(engine-interface.md 0.12·10절) — 네 조각의 합이다.** `total_allocated_monthly_krw`
  // (계좌 셋의 합)만 쓰면 미배분 조각의 월 금액이 빠져, 조각 넷을 그린 도넛의
  // 가운데가 그 조각들의 합과 어긋난다(2,500,000원을 넣었는데 2,499,999원이
  // 뜨던 신고가 이 어긋남이었다). `totalAllocatedMonthlyKrw`는 호출부
  // (`result-panel.js`)에서 이미 `total_allocated_monthly_krw + unallocated_monthly_krw`로
  // 계산해 넘긴다 — **여기서 다시 더하지 않는다**(곱셈·덧셈이 두 곳에 생기면
  // 둘이 갈린다는 경고가 계약 곳곳에 있다). `monthly_unassigned_krw`가 0보다
  // 크면 이 값은 `echo.monthly_capacity_krw`보다 그만큼 작다 — **그것이
  // 사실이므로 화면에서 반올림해 메우지 않는다.**
  // [2026-08-20, 관리자 지시] `centerValueFormat === 'manwon'`이면 만원
  // 단위(`formatKrwAbbreviated`)로 줄인다 — 예시 전용, 기본값('full')은
  // 옛 동작(`formatKrw`, 원 단위 전체 표기) 그대로다. **삼항식을 인라인으로
  // 둔다** — `totalAllocatedMonthlyKrw`를 `class: 'donut-center'` 바로
  // 옆에 그대로 남겨야 `wording.test.mjs`의 "가운데 값이 네 조각의 합"
  // 계약 검사(소스 문자열 매칭)가 이 변수 이름을 계속 찾을 수 있다.
  const centerText = svgEl('text', { class: 'donut-center', x: cx, y: cy, 'text-anchor': 'middle' }, [
    svgEl('tspan', { class: 'donut-center-label', x: cx, dy: '-0.4em' }, [DONUT_CENTER_LABEL]),
    svgEl('tspan', { class: 'donut-center-value', x: cx, dy: '1.5em' }, [
      centerValueFormat === 'manwon' ? formatKrwAbbreviated(totalAllocatedMonthlyKrw) : formatKrw(totalAllocatedMonthlyKrw),
    ]),
  ]);

  const defs = svgEl('defs', {}, [
    svgEl('pattern', { id: 'donut-hatch', width: 6, height: 6, patternTransform: 'rotate(45)', patternUnits: 'userSpaceOnUse' }, [
      svgEl('rect', { width: 6, height: 6, fill: 'transparent' }),
      svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--surface-raised)', 'stroke-width': 3 }),
    ]),
  ]);

  // viewBox가 도넛 크기 그대로였을 때 라벨이 그림 밖에 그려져 잘려 나갔다.
  // 이제 라벨 여백을 포함한 상자를 쓰고, 폭은 CSS가 반응형으로 줄인다.
  //
  // `chart-donut-entering`은 진입 애니메이션이 필요하다는 **표시일 뿐**이고
  // 애니메이션 자체는 여기서 돌지 않는다(`runDonutEntrance` 참고). 조각의
  // `d`는 위에서 이미 최종 각도로 그려졌으므로, 이 표시를 아무도 읽지 않아도
  // (예: 호출자가 `runDonutEntrance`를 부르지 않는 컨텍스트) 도넛은 완성된
  // 모양 그대로 화면에 남는다.
  const svg = svgEl(
    'svg',
    {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      class: `chart-donut${animateFromZero && !prefersReducedMotion() ? ' chart-donut-entering' : ''}`,
      preserveAspectRatio: 'xMidYMid meet',
      'data-cx': cx,
      'data-r-outer': R,
      'data-r-inner': rInner,
      'data-ry': RY_RATIO,
      // [2026-08-17, D72] `applyDonutSliceInlineLabels`가 "이 도넛이 조각 안
      // 이름 라벨을 필요로 하는 legend 모드인가"를 판단하는 유일한 신호다 —
      // `labelled`/`labelledWide`는 라벨을 이미 옆에 그리므로(`drawLabels`)
      // 후처리가 손댈 일이 없다.
      'data-label-mode': geom.mode,
    },
    [
      defs,
      ...sides,
      ...tops,
      ...hatches,
      drawLabels ? svgEl('g', { class: 'donut-labels' }, [...leaders, ...labels]) : null,
      centerText,
    ].filter(Boolean),
  );

  return svg;
}

/** `prefers-reduced-motion: reduce`이면 전환 시간을 전부 0으로 본다(6.2절). */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
/** 자리표시자 링이 사라지는 시간 · 결과 조각이 펼쳐지는 시간(design-system 6.2절). */
export const PLACEHOLDER_FADE_MS = 120;
export const DONUT_SWEEP_MS = 240;

/**
 * 조각 각도를 0°에서 최종값으로 편다. **길이(각도)만 변한다** — 회전도 확대도
 * 없다(design-system 5.20절: "뷰 각도 회전·확대 애니메이션 금지").
 *
 * 시작각은 처음부터 12시로 고정이고 각 조각은 자기 시작각에서 자란다.
 *
 * **`donutChart`가 만드는 노드가 아니라, 호출자가 마운트한 뒤 실제 DOM에서
 * 다시 찾은 노드 위에서 돈다.** 회귀의 원인이 이것이었다 — `patch()`(dom.js)는
 * 구조가 같은 트리를 다시 그릴 때 새로 만든 노드를 화면에 붙이지 않고,
 * 기존(이미 화면에 붙어 있는) 노드에 속성값만 복사한 뒤 새 노드는 버린다.
 * `donutChart` 안에서 애니메이션을 돌리면, 그 애니메이션이 붙잡고 있는 노드는
 * `patch`가 속성을 한 번 복사하고 나면 버려지는 사본이다 — 애니메이션은 그
 * 사본을 계속 갱신하지만 아무도 보지 않고, 화면에 실제로 붙어 있는 노드는
 * **속성이 복사된 첫 프레임(0°)에서 멈춘 채로 남는다.** 실측(`getBBox()`)으로
 * 모든 조각의 bbox가 0×N인 선분으로 붕괴한 것을 확인해 잡았다.
 *
 * 그래서 이 함수는 `donutChart` 호출 도중이 아니라 `patch` 이후, 실제로
 * 마운트된 컨테이너를 받아 그 안의 노드를 다시 조회한다. **호출되지 않아도,
 * `requestAnimationFrame`이 없어도, 도중에 다시 그려져 끊겨도 도넛은 이미
 * 완성된 최종 모양이다** — `donutChart`가 만드는 `d`는 처음부터 최종
 * 각도이고, 이 함수가 하는 일은 그 위에 0°에서 시작하는 시각 효과를 잠깐
 * 얹는 것뿐이다.
 */
export function runDonutEntrance(root, durationMs = DONUT_SWEEP_MS) {
  if (!root || typeof root.querySelector !== 'function') return;
  const svg = root.querySelector('.chart-donut.chart-donut-entering');
  if (!svg) return;
  // 한 번만 돈다 — 다음에 이 svg가 다시 patch되어도(값이 바뀌어도) 이 표시가
  // 남아 있으면 매번 처음부터 펼쳐진다. `donutChart`가 애초에 값이 바뀐
  // 재렌더에는 이 클래스를 달지 않지만, 노드를 재사용하는 `patch`의 성질상
  // 방어적으로 여기서도 지운다.
  svg.classList.remove('chart-donut-entering');
  if (typeof requestAnimationFrame !== 'function') return; // 애니메이션 없이 최종 모양 그대로

  const cx = Number(svg.dataset.cx);
  const rOuter = Number(svg.dataset.rOuter);
  const rInner = Number(svg.dataset.rInner);
  const ry = Number(svg.dataset.ry);
  // [2026-08-14, 관리자 지시 2번] **`data-render-*`를 쓴다, `data-arc-*`가
  // 아니다.** `data-arc-*`는 계약이 읽는 참값(간격 없는 진짜 경계)이고,
  // `data-render-*`는 조각 사이 2px 표면색 간격이 반영된 **시각적** 경계다
  // (`donutChart`의 `visualSliceAngle`). 여기서 참값을 쓰면 애니메이션의
  // 마지막 프레임이 간격을 다시 지워버린다 — 펼쳐지는 도중에는 간격이
  // 있다가 다 펼쳐진 순간 이음매가 도로 맞붙는 식으로.
  const specs = [...svg.querySelectorAll('.chart-donut-slice')].map((node) => ({
    node,
    cy: Number(node.dataset.cy),
    start: Number(node.dataset.renderStart ?? node.dataset.arcStart),
    end: Number(node.dataset.renderEnd ?? node.dataset.arcEnd),
  }));
  if (specs.length === 0) return;

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  for (const s of specs) s.node.setAttribute('d', annulusSlicePath(cx, s.cy, rOuter, rInner, ry, s.start, s.start));
  const step = (now) => {
    const p = Math.min(1, (now - t0) / durationMs);
    const eased = 1 - (1 - p) ** 3; // ease-out
    for (const s of specs) {
      if (!s.node.isConnected) return; // 다시 그려졌다 — 최종값은 새 노드가 갖고 있다
      s.node.setAttribute('d', annulusSlicePath(cx, s.cy, rOuter, rInner, ry, s.start, s.start + (s.end - s.start) * eased));
    }
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * 모바일 범례 — 도넛 라벨이 겹치는 폭에서 라벨을 대신한다(screens.md 5.7절).
 * **금액이 여기에도 들어간다** — 모바일에서 A2가 약해지는 것은 감수한 약점이지만
 * (5.13절), 금액까지 빠지면 값을 읽을 경로가 아예 사라진다.
 *
 * **배분액이 0인 계좌와 배제된 계좌는 여기 들어가지 않는다.** 범례는 도넛 라벨의
 * 대역이므로 조각과 1:1이어야 한다. 설계가 두 경우를 각각 정해 두었고
 * (5.9절: 배제 계좌는 "조각을 그리지 않는다. 라벨도 없다", 5.4절: 배분액 0인
 * 계좌는 C-2 캡션 `이 배분에서는 배분하지 않음`이 자리를 맡는다), 두 사실을
 * 말하는 자리는 모바일에서도 그대로 살아 있다(C-2는 폭만 줄고 그대로 성립한다,
 * 5.7절). 그래서 범례에 다시 적지 않는다.
 *
 * **[2026-08-17, D72] 번호(①②③)와 비율(%)을 뺐다 — 색 견본 + 이름 + 금액만
 * 남는다.** 배지를 지우고 조각 위에 계좌 이름을 직접 쓰기로 하면서(위
 * `applyDonutSliceInlineLabels`), 번호로 조각과 범례를 짝짓던 일 자체가
 * 없어졌다 — 이름이 조각 위에도, 범례에도 똑같이 적혀 있으므로 그 이름
 * 하나가 이미 짝을 짓는다. 비율도 조각 쪽(이름과 함께)이 이미 말하므로
 * 범례에서 중복하지 않는다 — **역할이 갈린다: 조각 라벨 = 이름·비율,
 * 범례 = 이름·금액.** 범례가 여전히 이름을 갖는 이유는 조각 라벨이 극단적으로
 * 좁은 조각에서 리더선 폴백으로 밀려날 때도(이 파일 `applyDonutSliceInlineLabels`
 * 머리말) 범례만으로 "이 색이 어느 계좌인가"가 항상 완결되게 하려는 것이다.
 */
export function donutLegend({ allocations, unallocatedAnnualKrw, unallocatedMonthlyKrw = 0, excludedAccounts = [] }) {
  const segments = allocationSegments({ allocations, unallocatedAnnualKrw, excludedAccounts });
  const arcs = sliceAngles(segments);
  const monthlyByAccount = Object.fromEntries((allocations ?? []).map((a) => [a.account, a.monthly_krw]));

  return el(
    'ul',
    { class: 'donut-legend' },
    arcs.map((a) => {
      const monthly = a.isUnallocated ? unallocatedMonthlyKrw : (monthlyByAccount[a.account] ?? 0);
      const color = a.isUnallocated ? UNALLOCATED_COLOR : ACCOUNT_COLOR[a.account];
      return el('li', { class: 'donut-legend-item' }, [
        el('span', { class: 'donut-legend-swatch', style: { background: color } }),
        el('span', { class: 'donut-legend-name' }, [a.isUnallocated ? UNALLOCATED_LABEL : ACCOUNT_LABEL[a.account]]),
        el('span', { class: 'donut-legend-amount type-num' }, [`${formatKrw(monthly)} / 월`]),
      ]);
    }),
  );
}

// ---------------------------------------------------------------------------
// [2026-08-17, D72] 도넛 조각 위(안) 이름+비율 라벨 — legend 모드 전용.
//
// **옛 위치.** 이 로직은 원래 `ui/example-showcase.js`의
// `applyDonutSlicePercentLabels`(퍼센티지만, 예시 전용)였다. 예시와 실제
// 결과 패널의 모바일(legend) 도넛이 **같은 `donutChart` 함수**를 쓰므로,
// 배지를 지우고 조각에 이름을 쓰는 판정(D72)은 둘 모두에 적용된다 — 여기
// 하나로 옮겨서 두 호출부(`ui/app.js`의 결과 패널, `ui/example-showcase.js`의
// 예시)가 같은 함수를 그대로 쓴다.
// ---------------------------------------------------------------------------

/** sRGB 채널(0~255)을 WCAG 상대 휘도 계산에 쓰는 선형값으로. */
function srgbChannelToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance([r, g, b]) {
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}
/** WCAG 대비비 — 밝은 쪽이 항상 분자다(순서 무관 ≥1). */
function contrastRatio(l1, l2) {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
/** `getComputedStyle(...).fill` 같은 `rgb(r, g, b)` 문자열을 채널 셋으로 판다. */
function parseRgbComponents(cssColor) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(cssColor ?? '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
}

/**
 * **실측 기반 대비 선택** — 배경(조각의 실제 렌더 색)을 읽어 흰/검 중 대비가
 * 더 큰 쪽을 고른다. 계좌 색 토큰은 테마마다 다른 값을 가지고(`styles.css`),
 * 미배분 색(`--data-unallocated`)은 라이트에서 어두운 회색(흰 글자가 이김,
 * 6.29:3.34)인데 다크에서는 밝은 회색(검은 글자가 압도적으로 이김,
 * 10.48:2.00)이라 **테마에 따라 승자가 실제로 뒤집힌다.** 그래서 값을 정해
 * 두지 않고 화면에 실제로 칠해진 색을 매번 다시 잰다(`applyDonutSliceInlineLabels`
 * 가 테마가 바뀔 때마다 다시 부른다).
 */
function bestTextColorOn(cssBackgroundColor) {
  const bgLuminance = relativeLuminance(parseRgbComponents(cssBackgroundColor));
  const whiteContrast = contrastRatio(bgLuminance, 1);
  const blackContrast = contrastRatio(bgLuminance, 0);
  // hex가 아니라 CSS 색 키워드다 — 흰/검은 WCAG 상대 휘도 스펙 자체가 1과 0으로
  // 정의하는 절댓값이라 어느 팔레트에도 속하지 않고, 테마가 바뀌어도 따라와야
  // 할 "토큰"이 애초에 없다(`styles-tokens.test.mjs`가 막는 것은 디자인 토큰을
  // 코드가 다시 계산하는 것이지 이 절댓값과는 다르다).
  return whiteContrast >= blackContrast ? 'white' : 'black';
}

// [2026-08-23, 소유자 지시 1·2번] +10% — 소유자가 두 회차 연속 "라벨이(특히
// 「연금저축」) 안 보인다"고 신고했다. 지난 회차는 카드 밖 잘림을 막으려고
// 조각 밖 라벨을 축소 폴백(`SLICE_LABEL_MIN_FONT_PX`까지)으로 우겨넣었는데,
// 그 자체가 가독성을 해쳤다 — **줄이는 방향으로 다시 풀지 않는다.** 대신
// 기본 크기를 키우고(15×1.1=16.5), 공간이 모자란 자리(팝업 예시 영역·결과
// 도넛)는 이 회차에서 폭을 늘려 맞춘다(아래 `styles.css`) — 글자를 줄이는
// 폴백은 여전히 있지만(정말 안 맞는 극단 대비), 첫 시도가 이 크기에서
// 끝나도록 공간을 먼저 늘리는 것이 이번 지시의 핵심이다.
// [2026-08-25, 관리자 지시 — 소유자 지시(6항목) 2번] **라벨 +20% —
// "반복 지적" 항목, 반드시 실측.** 소유자가 두 회차 연속 "라벨 확대가
// shrink-to-fit·viewBox 비례에 먹혀 무효화됐다"고 지적했다.
//
// **함정 하나 — "도넛 CSS 폭을 그대로 ×1.1만 하면" 안 된다.** 라벨이
// 들어갈 여백(`LEGEND_PAD`)을 넓히지 않으면 이 회차도 "연금저축"(가장
// 넓은 라벨)에서 다시 축소가 걸린다(1차 시도 실측: 이 상수를 16.5→18로만
// 올리고 여백을 그대로 뒀더니 "연금저축"이 16px까지 눌려 최종 +13.5%에
// 그쳤다 — 소유자가 우려한 바로 그 함정 재현). 그래서 여백(`LEGEND_PAD`,
// 아래)도 65→85로 함께 넓혔다.
//
// **함정 둘 — 여백을 넓히면 뷰박스 자체가 커져(330→370), "도넛(CSS
// 폭) +10%"를 옛 CSS 폭 그대로 ×1.1로 잡으면 뷰박스 대비 고리 비중이
// 줄어 오히려 보이는 고리가 작아진다**(실측으로 잡음 — 자세한 계산은
// `styles.css`의 두 도넛 CSS 규칙 옆 주석). 그래서 "도넛 +10%"는 **고리
// 자체의 렌더 px가 +10%**가 되도록 CSS 폭을 역산했다(styles.css) — 그
// 역산 결과, 이 폰트 상수는 컨테이너 확대율과 무관하게 정확히
// 16.5×12/11=**18**(여백을 넓혀도 "고리 렌더 px 기준 배율"은 CSS 폭에
// 실려 그대로 보존되므로, 이 상수 자체는 여백 크기와 무관하게 18로
// 고정된다 — 셈은 `styles.css` 주석에 있다).
//
// **실측(전·후, `getComputedStyle`+`getBBox`를 뷰박스→렌더 배율로 보정) —
// 계산기2 결과 도넛(옛 209px→새 257.77px)**: IRP·ISA
// 10.45px→12.54px(**+20.0%**), 연금저축(가장 넓은 라벨) 9.82px→12.54px
// (**+27.7%, 축소 폴백 0회** — 옛값보다 더 크게 끝났다). **팝업 예시
// 도넛(옛 120px→새 148px)**: IRP·ISA 6.00px→7.20px(**+20.0%**), 연금저축
// 5.64px→7.20px(**+27.7%, 축소 폴백 0회**). 두 도넛·세 라벨 전부 옛값보다
// 작아진 경우가 없다 — "축소 로직이 다시 먹으면 그 경로를 끊어라"는
// 지시대로, 여백을 넓혀 그 경로 자체가 걸리지 않게 됐다(비활성화가
// 아니라 조건을 없앴다). 관리자 보고에 이 수치를 그대로 남긴다.
const SLICE_LABEL_NAME_FONT_PX = 18;
// 바닥값도 같은 비율로 올린다(9×1.1×1.1=10.89 계열, 여기서는 위 폰트
// 배율 12/11을 그대로 적용해 9.9×12/11=10.8) — 폴백의 하한이지 목표가
// 아니다. 정상 경로는 위 기본 크기(18px)에서 끝나야 하고, 위 실측대로
// 이제 실제로 그렇게 끝난다(축소 폴백 자체가 안 걸린다).
const SLICE_LABEL_MIN_FONT_PX = 10.8;

// [2026-08-25, 관리자 재지적 — 소유자 지시(6항목) 2번, 실측 회귀] 위
// `SLICE_LABEL_NAME_FONT_PX`(18, **뷰박스 단위**)를 모든 legend 모드
// 도넛에 똑같이 먹이면 결과가 다르다 — **CSS 렌더 폭이 뷰박스보다 얼마나
// 작게 줄었는지(scale = 렌더 CSS px ÷ 뷰박스 단위)에 따라 최종 화면
// 픽셀이 갈린다.** 실측(`getBoundingClientRect`, 2026-08-25):
// 계산기2 결과 도넛(CSS 257.77px÷뷰박스 370=scale 0.6967)의 이름
// 라벨은 실제 17px로 렌더되는데, 팝업 예시 도넛(CSS 148px÷370=scale
// 0.4, 공간 제약으로 도넛 자체를 더 키울 수 없다)은 **같은 18(뷰박스
// 단위) 글자가 실제로는 10px로만 렌더된다** — CSS 속성(`getComputedStyle`
// .fontSize)은 두 곳 다 "18px"라고 답해 이 차이를 감춘다(둘 다 인라인
// style이 "18px"이기 때문 — 그 선언이 SVG 사용자좌표계 값이라는 것,
// `viewBox`가 최종 CSS 폭에 맞춰 통째로 축소·확대된다는 것을 모르면
// 못 잡는다). **소유자가 세 회차째 "안 고쳐진다"고 지적한 진짜 원인이
// 이것이다** — 지난 회차들의 "라벨 +N%"는 전부 이 뷰박스 단위 상수만
// 고쳤을 뿐, 그 상수가 컨테이너마다 다른 배율로 다시 축소된다는 사실을
// 놓쳤다.
//
// **고침 — 렌더 배율의 역수로 보정한다(관리자 지시 그대로).** 계산기2
// 결과 도넛의 현재 배율(0.6967)을 "이미 정상"이라고 확인된 기준으로
// 삼아 `REFERENCE_RENDER_SCALE`로 고정하고, 그 자신을 포함해 모든
// legend 도넛에 `fontPx = SLICE_LABEL_NAME_FONT_PX × (REFERENCE_RENDER_SCALE
// ÷ 이 svg의 실측 scale)`을 적용한다. 계산기2 자신은 배율이 이미 기준과
// 같아 보정 계수가 1이라 결과가 전혀 안 바뀐다(회귀 없음, 아래 실측이
// 확인한다). 팝업(배율 0.4)은 보정 계수가 0.6967/0.4≈1.74가 되어
// 18×1.74≈31.4(뷰박스 단위)로 커지고, 그 결과 실제 렌더 폭은 계산기2와
// 같은 물리 픽셀 수준(≈12.5px, 렌더 높이 기준 ≈17px)에 맞춰진다 — 도넛
// 그림 크기 자체(148px)는 그대로 두고 글자만 그 축소를 상쇄한다.
//
// `REFERENCE_RENDER_SCALE`은 계산기2 결과 도넛의 CSS 폭(257.77px,
// `styles.css`)을 legend 뷰박스 폭(370, `donutGeometry('legend').width`)
// 으로 나눈 값이다 — 계산기2 CSS 폭이 바뀌면 이 상수도 같이 갱신해야
// 한다(`donut-label-overlap.browser.mjs`의 렌더 높이 실측 시험이 어긋나면
// 알려준다).
const REFERENCE_RENDER_SCALE = 257.77 / 370;
/** 이 svg가 실제로 화면에 렌더된 CSS 폭 ÷ 자신의 viewBox 폭 — "뷰박스
 * 단위 1개가 최종 화면에서 몇 물리 픽셀인가"를 잰다. svg가 숨어 있거나
 * (`display:none`) 아직 레이아웃 전이면 폭이 0이라 이 비율을 낼 수 없다
 * — 그때는 `null`을 내 호출부가 보정 없이(계수 1) 옛 동작으로 안전하게
 * 물러나게 한다(숨은 동안의 오판은 `applyDonutSliceInlineLabels`의
 * `ResizeObserver`가 실제로 보이는 순간 다시 불러 바로잡는다, 위 D83
 * 판정 1 주석 참고). */
function measuredSvgRenderScale(svg) {
  const vb = svg.viewBox?.baseVal;
  if (!vb || !(vb.width > 0)) return null;
  const cssWidth = svg.getBoundingClientRect().width;
  if (!(cssWidth > 0)) return null;
  return cssWidth / vb.width;
}
const SLICE_LABEL_FIT_MARGIN = 0.92; // 조각 안 여유 8% — 테두리에 글자가 닿지 않게
const SLICE_LABEL_OUTSIDE_GAP = 16; // 리더선 폴백 — 고리(rOuter) 밖으로 이만큼(뷰박스 단위) 뺀다
// [2026-08-23, D82 소유자 지시 5번 — 계산기2 결과 도넛 한정] 지시선을 없애고
// 라벨을 조각에 더 가깝게 붙인다 — 위 간격(16)의 약 3분의 1. 0에 가깝게
// 붙이면(리더선이 없으므로) 라벨이 조각 테두리에 닿아 보여 "안에 쓴 것"처럼
// 오독될 수 있다 — 지시선이 있을 때보다 더 좁지만 여전히 눈에 띄는 간격을
// 남긴다(`hideLeader` 옵션, `applyDonutSliceInlineLabelsToSvg` 참고).
const SLICE_LABEL_OUTSIDE_GAP_CLOSE = 5;
// [2026-08-23, D83 판정 1] 라벨-링 비겹침 재시도 — 겹치면 이 만큼(뷰박스
// 단위)씩 더 밀어내며 다시 잰다. 큰 라벨(긴 계좌 이름 등)도 몇 번 안에
// 안전히 벗어나도록 8을 썼다(`SLICE_LABEL_OUTSIDE_GAP`의 절반) — 너무
// 작으면 겹치는 조각마다 반복 횟수가 늘어 계산이 느려지고, 너무 크면
// 필요 이상으로 멀리 밀려나 도넛과의 시각적 연결이 옅어진다.
const SLICE_LABEL_OVERLAP_STEP = 8;
const SLICE_LABEL_OVERLAP_MAX_ATTEMPTS = 12;
const SLICE_LABEL_LINE_GAP_EM = 1.25; // 이름 줄과 비율 줄 사이 간격(em, 이름 글자 크기 기준)

/**
 * 도넛 조각 위(안)에 **계좌 이름 + 배분 비율(%)**을 두 줄로 그린다(D72).
 * `donutChart`를 고치지 않는다 — 그 함수는 아직 화면에 붙지 않은 노드를
 * 만들 뿐이라 `getBBox()`(폰트가 실제로 적용된 뒤에만 정확한 값)를 쓸 수
 * 없다. 그래서 **마운트된 뒤** 이 함수가 실측 기반으로 후처리한다.
 *
 * **자기 완결적이다** — 인자로 조각 데이터를 받지 않는다. 조각 자신이 이미
 * 아는 사실(`data-account`·`data-amount`, `donutChart`의 `tops`)만 읽어
 * 이름·비율·총합을 여기서 다시 계산한다. 같은 뷰(예: 예시 vs 결과 패널)가
 * 서로 다른 도넛에 이 함수를 반복해 불러도, 매번 그 도넛 자신의 데이터만
 * 본다 — 호출부가 계약을 다시 조립할 필요가 없다.
 *
 * **배치 — 고리 반지름의 정확한 중간(0.5).** 옛 퍼센티지 전용 버전은 이제는
 * 없는 ①②③ 배지와 겹치지 않으려 0.34로 안쪽에 치우쳤었다 — 배지가 사라진
 * 지금은 그 제약이 없으므로 가장 읽기 좋은 정중앙을 쓴다.
 *
 * **겹침/넘침 — 실측.** 글자(이름+비율 두 줄)를 실제로 그린 뒤 `getBBox()`로
 * 그 조각이 그 반지름에서 낼 수 있는 현(chord) 길이·고리 두께와 비교한다.
 * 안 들어가면 먼저 두 줄 다 글자 크기를 바닥까지 함께 줄이고, 그래도 안
 * 들어가면 고리 밖으로 빼고 지시선을 긋는다(`donutLabelLayout`이 이미 쓰는
 * "조각 밖 라벨 + 지시선"과 같은 발상) — **이 서비스의 실제 조각(예:
 * 33%·17%·50%, 최소 17% ≈ 61° 스윕)에서는 실측상 이 폴백이 걸리지 않는다**
 * (`example-showcase.browser.mjs`가 이 사실 자체를 검사로 고정한다).
 *
 * **글자 색 — 실측.** 안쪽에 그릴 때는 `bestTextColorOn`이 조각의 실제 렌더
 * 색과 대조해 고른 흰/검을 쓴다. 고리 밖(폴백)으로 뺄 때는 배경이 더는 조각
 * 색이 아니라 카드 표면이므로 `var(--text-primary)`(이미 검증된 토큰)를 쓴다.
 *
 * @param {Document|ShadowRoot|Element} root 도넛이 그려진 DOM 루트(문서 또는
 *   shadow root) — 이 안에서 `.chart-donut[data-label-mode="legend"]`를 전부 찾는다.
 */
/**
 * [2026-08-20, 관리자 지시 — 첫 탭 예시 도넛 개편, D79 판정 4로 정정] 라벨은
 * 이제 이름+비율(퍼센트) 하나뿐이다 — 옛 `sliceContent: 'name_amount'`
 * (이름+월 금액) 모드는 예시 전용이었는데, 소유자가 예시 도넛 라벨을 다시
 * 퍼센트로 좁혔다(D79 판정 4, "금액 삭제"). 그 모드와 전용 렌더 함수
 * (`applyAmountSliceLabel`)를 통째로 지웠다 — 부르는 곳이 더는 없다(다른
 * 어디서도 쓰지 않는 값을 코드에 남기지 않는다는 이 저장소의 관행).
 *
 * `forceOutside`(D79 판정 4, "도넛 밖에(리더선 관행)") — 조각 안에 들어가는지
 * 실측하지 않고 **항상** 고리 밖 지시선 라벨로 그린다. 예시
 * (`example-showcase.js`)만 켠다 — 결과 패널·역산기 탭은 인자 없이 부르므로
 * (`forceOutside: false` 기본) 조각 안에 들어가면 안에 그리는 기존 동작이
 * 그대로다.
 *
 * `hideLeader`(D82 소유자 지시 5번, 계산기2 결과 도넛 한정) — `forceOutside`와
 * 항상 함께 켠다(고리 밖 폴백 경로에서만 뜻이 있다). 지시선(polyline)을
 * 아예 만들지 않고, 라벨을 고리에 더 가깝게(`SLICE_LABEL_OUTSIDE_GAP_CLOSE`)
 * 붙인다 — "조각 위(안)에는 쓰지 않는다"는 조건은 여전히 지킨다(고리 밖에
 * 그린다는 사실 자체는 바뀌지 않았다, 간격만 좁혔다).
 */
export function applyDonutSliceInlineLabels(root, { forceOutside = false, hideLeader = false } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  // [2026-08-25] `legendCompact`(팝업 전용, 위 `LEGEND_PAD_COMPACT` 주석)도
  // legend류다 — 두 속성값 다 잡는다. `:is()`는 이 저장소가 이미 다른
  // 곳(`.field-control:has(...)`)에서 쓰는 최신 CSS 선택자 관행과 같은 결이다.
  const svgs = [...root.querySelectorAll('.chart-donut[data-label-mode="legend"], .chart-donut[data-label-mode="legendCompact"]')];
  for (const svg of svgs) applyDonutSliceInlineLabelsToSvg(svg, forceOutside, hideLeader);
  // [2026-08-23, D83 판정 1] **숨은 도넛 보정 — 진짜 원인을 실측으로 찾았다.**
  // `getBBox()`는 SVG 명세상 그 원소(또는 조상)가 `display:none`이면 폭·높이
  // 0을 낸다. 첫 탭 예시·역산기 예시는 **기본 랜딩 탭이 계산기2로 바뀐
  // 뒤(D81)로 앱이 뜨자마자 숨은 탭 패널(`tab-panel-hidden`) 안에서
  // 그려진다** — 이 함수가 그 순간 라벨을 배치하면 `getBBox()`가 늘 0×0을
  // 내므로 `overlapsRing({width:0,height:0})`이 항상 거짓이 되어(0×0 상자는
  // 사실상 무엇과도 안 겹친다) **첫 시도(가장 좁은 간격)에서 곧장 "안 겹친다"고
  // 잘못 확정한다.** 나중에 사용자가 그 탭을 눌러 실제로 보이면, 라벨은 이미
  // 정해진(너무 좁은) 자리에 실제 크기로 그려져 고리와 겹친다 — 실측으로 잡은
  // 정확한 재현 경로다(`requestAnimationFrame`을 겹쳐 불러도 탭이 계속 숨어
  // 있으면 재보정 자체가 또 0×0을 재므로 소용없었다 — 값의 문제가 아니라
  // "숨어 있다"는 조건 자체를 잡아야 했다).
  //
  // **`ResizeObserver`로 "실제로 보이는 순간"을 기다려 다시 그린다 — 매번,
  // 조건 없이 붙인다.** 미리 `getBoundingClientRect()`로 "지금 숨었는지"를
  // 스냅샷으로 재고 그 결과로 붙일지 말지 가르면, 그 스냅샷을 재는 순간과
  // 실제 숨김·보임이 갈리는 자리 사이에 경합이 생길 수 있다(예: 역산기
  // 예시에서 실측으로 이 경합을 직접 봤다 — 스냅샷은 "이미 보인다"로 읽혔지만
  // 그 안쪽 텍스트 배치 자체는 여전히 숨은 상태를 쟀다). `ResizeObserver`는
  // `observe()`를 부르는 즉시 **현재 크기로 최소 한 번은 반드시 콜백을
  // 낸다**(명세) — 조건문으로 미리 걸러내지 않고 **항상** 붙이면, 이미
  // 보이는 상태였어도 그 첫 콜백에서 한 번 더 정확히 다시 그려 자가
  // 확인하고, 숨은 상태였다면 나중에 실제로 커지는 그 순간의 콜백에서
  // 다시 그린다 — 두 경우 모두 스냅샷 타이밍에 기대지 않는다. 크기가
  // 있는 값으로 한 번 다시 그리면 스스로 끊는다(자원이 새지 않는다). 이
  // 함수는 멱등이다(매번 `.donut-slice-label-group`을 지우고 새로 그린다)
  // — 다시 불러도 중복이 생기지 않는다.
  if (typeof ResizeObserver === 'function') {
    for (const svg of svgs) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.contentRect;
          if (box.width > 0 && box.height > 0) {
            applyDonutSliceInlineLabelsToSvg(svg, forceOutside, hideLeader);
            observer.disconnect();
            return;
          }
        }
      });
      observer.observe(svg);
    }
  }
}

function applyDonutSliceInlineLabelsToSvg(svg, forceOutside = false, hideLeader = false) {
  if (!svg || typeof svg.querySelectorAll !== 'function') return;
  const cx = Number(svg.dataset.cx);
  const rOuter = Number(svg.dataset.rOuter);
  const rInner = Number(svg.dataset.rInner);
  const ry = Number(svg.dataset.ry);
  if (![cx, rOuter, rInner, ry].every(Number.isFinite)) return;

  // [2026-08-25, 관리자 재지적] 이 svg 자신의 실측 렌더 배율로 글자 크기를
  // 보정한다 — 위 `REFERENCE_RENDER_SCALE`/`measuredSvgRenderScale` 주석
  // 참고. 배율을 못 재면(숨은 상태 등) 계수 1(보정 없음, 옛 동작)로
  // 물러난다.
  const renderScale = measuredSvgRenderScale(svg);
  const labelScaleCompensation = renderScale && renderScale > 0 ? REFERENCE_RENDER_SCALE / renderScale : 1;
  const compensatedNameFontPx = SLICE_LABEL_NAME_FONT_PX * labelScaleCompensation;
  const compensatedMinFontPx = SLICE_LABEL_MIN_FONT_PX * labelScaleCompensation;
  // 비율(%) 줄은 이름 줄보다 늘 2px(뷰박스 단위, 옛 기준) 작았다 — 절대값
  // 대신 그 비(16/18)를 지켜 보정 배율과 무관하게 같은 관계를 유지한다.
  // 계수가 1이면(계산기2 자신) `18 × (16/18) = 16`으로 옛 값과 정확히
  // 같다 — 회귀 없음.
  const pctLineFontRatio = (SLICE_LABEL_NAME_FONT_PX - 2) / SLICE_LABEL_NAME_FONT_PX;

  const tops = [...svg.querySelectorAll('path.chart-donut-slice[role="img"]')];

  // 이전 호출(리사이즈·테마 전환 재호출)이 남긴 그룹을 지우고 새로 그린다 —
  // 매번 실측을 다시 하지 않으면 옛 테마·옛 폭 기준 색·위치가 남는다.
  svg.querySelector('.donut-slice-label-group')?.remove();
  const group = svgEl('g', { class: 'donut-slice-label-group' }, []);
  svg.appendChild(group);

  const total = tops.reduce((sum, top) => sum + (Number(top.dataset.amount) || 0), 0);
  if (total <= 0) return;

  const rLabel = (rInner + rOuter) / 2; // 고리 반지름 정중앙 — 배지가 없으므로 안쪽으로 치우칠 이유가 없다
  const bandThickness = rOuter - rInner;

  for (const top of tops) {
    const amount = Number(top.dataset.amount);
    if (!(amount > 0)) continue; // 0원 조각은 애초에 path 자체가 없다 — 방어적으로만 남긴다
    const account = top.dataset.account;
    const name = account === 'unallocated' ? UNALLOCATED_LABEL : (ACCOUNT_LABEL[account] ?? account);
    const cy = Number(top.dataset.cy);
    const start = Number(top.dataset.renderStart ?? top.dataset.arcStart);
    const end = Number(top.dataset.renderEnd ?? top.dataset.arcEnd);
    if (![cy, start, end].every(Number.isFinite)) continue;
    const mid = (start + end) / 2;
    const sweepRad = (Math.max(0, end - start) * Math.PI) / 180;
    // `Math.min(sweepRad, Math.PI)`로 180°에서 자른다 — 현 길이 `2r·sin(θ/2)`는
    // θ=180°(π)에서 최댓값(지름)을 찍고 그 뒤로는 다시 줄어든다(원의 시작점과
    // 끝점이 다시 가까워지기 때문). 조각이 클수록(180°를 넘어도) 글자가 들어갈
    // 자리는 줄지 않고 늘어나므로, 180°를 넘는 구간은 최댓값(지름)으로 고정한다.
    const chordAtMid = 2 * rLabel * Math.sin(Math.min(sweepRad, Math.PI) / 2);

    const pctText = formatPercent(amount / total);
    const insideColor = bestTextColorOn(getComputedStyle(top).fill);
    const [px, py] = polar(cx, cy, rLabel, rLabel * ry, mid);

    let fontPx = compensatedNameFontPx;
    const buildText = () =>
      svgEl(
        'text',
        {
          class: 'donut-slice-label',
          x: px, y: py,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
          fill: insideColor,
        },
        [
          svgEl('tspan', { class: 'donut-slice-label-name', x: px, dy: '-0.55em', style: `font-size:${fontPx}px` }, [name]),
          svgEl(
            'tspan',
            { class: 'donut-slice-label-pct', x: px, dy: `${SLICE_LABEL_LINE_GAP_EM}em`, style: `font-size:${Math.max(compensatedMinFontPx, fontPx * pctLineFontRatio)}px` },
            [pctText],
          ),
        ],
      );

    let text = buildText();
    group.appendChild(text);

    const fitsInsideSlice = () => {
      const box = text.getBBox();
      // [2026-08-23, D83 판정 1] svg(또는 조상)가 `display:none`이면
      // `getBBox()`는 명세상 0×0을 낸다 — 0×0은 어떤 상한 검사도 항상
      // 통과하므로("들어간다"고 잘못 확정), 숨은 순간엔 실측 없이 무조건
      // "안에 들어간다"고 속아 폴백(고리 밖) 경로 자체를 건너뛴다. 숨은
      // 동안은 반대로 판정한다(안 들어간다) — 위 `applyDonutSliceInlineLabels`의
      // `ResizeObserver`가 실제로 보이는 순간 이 함수를 포함해 전부 다시 그린다.
      if (box.width === 0 && box.height === 0) return false;
      return box.width <= chordAtMid * SLICE_LABEL_FIT_MARGIN && box.height <= bandThickness * SLICE_LABEL_FIT_MARGIN;
    };
    // [D79 판정 4] `forceOutside`면 안(조각)에 들어가는지 실측조차 하지 않고
    // 곧장 아래 고리 밖 폴백으로 넘어간다 — "도넛 밖에(리더선 관행)"는 안에
    // 들어갈 때만 밖으로 밀리는 조건부 동작이 아니라 예시의 항상-켜짐
    // 규칙이다.
    if (!forceOutside) {
      // 감소 폭도 보정 계수를 탄다 — "뷰박스 단위 1"이 이 svg에서 최종
      // 몇 물리 픽셀인지가 배율마다 다르므로, 배율이 작은(더 축소된) svg
      // 에서 "1 물리 픽셀만큼" 줄이려면 뷰박스 단위로는 더 크게 줄여야
      // 한다(보정과 반대 방향이면 단계가 무의미해진다).
      while (!fitsInsideSlice() && fontPx > compensatedMinFontPx) {
        fontPx -= labelScaleCompensation;
        const next = buildText();
        group.replaceChild(next, text);
        text = next;
      }
      if (fitsInsideSlice()) continue;
    }

    // 폴백(또는 `forceOutside`) — 고리 밖, 지시선과 함께(`hideLeader`가
    // 아니면). 배경이 카드 표면이 되므로 대비를 다시 잴 필요 없이 검증된
    // 토큰(text-primary)을 쓴다.
    // [D82 소유자 지시 5번] `hideLeader`면 간격을 좁힌다 — 지시선이 없으므로
    // 라벨과 조각의 관계를 거리로 대신 보여야 한다.
    // [2026-08-23, D83 판정 1 — 상설 규칙] "도넛 계좌별 라벨은 어떤 화면
    // 에서도 차트와 겹치지 않는다." 처음 간격(위)만으로는 라벨 텍스트
    // 사각형이 여전히 고리 사각형에 닿을 수 있다(실측 — 팝업의 연금저축
    // 33%·ISA 50%가 닿았다) — 중심점 하나만 밀어내는 방식은 텍스트
    // 자신의 폭·높이를 고려하지 않기 때문이다. **실제로 겹치지 않을
    // 때까지 간격을 늘려가며 다시 잰다**(최대
    // `SLICE_LABEL_OVERLAP_MAX_ATTEMPTS`회) — 이 회차부터 이 함수를 쓰는
    // 모든 도넛(예시·팝업·결과·역산기)이 이 보장을 공짜로 받는다.
    const ringLeft = cx - rOuter;
    const ringRight = cx + rOuter;
    const ringTop = cy - rOuter * ry;
    const ringBottom = cy + rOuter * ry;
    const overlapsRing = (box) => box.x < ringRight && box.x + box.width > ringLeft && box.y < ringBottom && box.y + box.height > ringTop;

    // [2026-08-23, 소유자 지시 1번(팝업) — D83 상설 규칙 확장] 고리를
    // 피해 밀려난 라벨이 카드(svg viewBox) 밖으로 나가면 잘려 보인다
    // (실측 — 팝업의 "연금저축"이 잘렸다). viewBox 경계 안에 온전히
    // 들어가는지도 함께 잰다.
    const vb = svg.viewBox.baseVal;
    const boxLeft = vb.x;
    const boxRight = vb.x + vb.width;
    const boxTop = vb.y;
    const boxBottom = vb.y + vb.height;
    const fitsInViewBox = (box) => box.x >= boxLeft && box.x + box.width <= boxRight && box.y >= boxTop && box.y + box.height <= boxBottom;

    let ox;
    let oy;
    let fallback = text;
    // [2026-08-23, 소유자 지시 1번] **간격만으로는 두 조건(고리 비겹침 +
    // 카드 안)을 동시에 만족 못할 때가 있다** — 라벨이 그 방향의 남은
    // 폭보다 넓으면, 고리를 벗어나는 순간 이미 카드 밖이다(간격을 더
    // 늘려도 더 나갈 뿐 나아지지 않는다). 그때는 조각 안 라벨(위
    // `fitsInsideSlice`)과 같은 방식으로 글자 크기를 줄여 다시 시도한다.
    // 바닥 크기에서도 못 맞추면 마지막으로 찾은 자리를 그대로 쓴다(예전
    // 동작 — 안 보이는 것보다 낫다).
    fontShrink: for (
      let outFontPx = compensatedNameFontPx;
      outFontPx >= compensatedMinFontPx;
      outFontPx -= labelScaleCompensation
    ) {
      let gap = hideLeader ? SLICE_LABEL_OUTSIDE_GAP_CLOSE : SLICE_LABEL_OUTSIDE_GAP;
      for (let attempt = 0; attempt < SLICE_LABEL_OVERLAP_MAX_ATTEMPTS; attempt++) {
        const outerRadius = rOuter + gap;
        [ox, oy] = polar(cx, cy, outerRadius, outerRadius * ry, mid);
        const next = svgEl(
          'text',
          { class: 'donut-slice-label', x: ox, y: oy, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--text-primary)' },
          [
            svgEl('tspan', { class: 'donut-slice-label-name', x: ox, dy: '-0.55em', style: `font-size:${outFontPx}px` }, [name]),
            svgEl(
              'tspan',
              { class: 'donut-slice-label-pct', x: ox, dy: `${SLICE_LABEL_LINE_GAP_EM}em`, style: `font-size:${Math.max(compensatedMinFontPx, outFontPx * pctLineFontRatio)}px` },
              [pctText],
            ),
          ],
        );
        group.replaceChild(next, fallback);
        fallback = next;
        const box = fallback.getBBox();
        if (!overlapsRing(box)) {
          if (fitsInViewBox(box)) break fontShrink; // 둘 다 만족 — 끝
          // 고리는 벗어났지만 카드 밖이다 — 이 글자 크기로는 간격을 더
          // 늘려도 카드 밖으로 더 나갈 뿐이다. 더 작은 글자로 넘어간다.
          break;
        }
        gap += SLICE_LABEL_OVERLAP_STEP;
      }
    }
    text = fallback;
    if (!hideLeader) {
      const [ex, ey] = polar(cx, cy, rOuter, rOuter * ry, mid);
      const leader = svgEl('polyline', { class: 'donut-slice-label-leader', points: `${ex},${ey} ${ox},${oy}`, fill: 'none' });
      group.insertBefore(leader, text);
    }
  }
}

/**
 * 테마가 바뀌면(명시적 라이트/다크 전환 또는 시스템 설정 전환) 조각 라벨의
 * 흰/검 대비 승자가 뒤집힐 수 있다(`bestTextColorOn` 머리말) — 그래서 값이
 * 바뀌지 않아도 다시 그려야 한다. `document.documentElement`의 `data-theme`
 * 속성 변화와 `prefers-color-scheme` 미디어쿼리 변화 둘 다 듣는다(`theme.js`
 * 머리말 "세 가지 상태" — 화면 색을 실제로 바꾸는 유일한 두 경로).
 */
export function watchDonutThemeChange(onThemeChange) {
  if (typeof onThemeChange !== 'function') return;
  if (typeof document !== 'undefined' && typeof MutationObserver === 'function') {
    new MutationObserver(onThemeChange).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof schemeQuery.addEventListener === 'function') schemeQuery.addEventListener('change', onThemeChange);
  }
}

// D16 — 트랙 길이의 공통 배율. screens.md 5.4절: "세 막대는 공통 배율을 쓴다.
// 납입 잔여 한도가 가장 큰 계좌의 트랙이 화면 폭을 채우고, 나머지는 그 비율만큼
// 짧아진다." 납입 잔여 한도가 가장 큰 계좌를 100%로 잡는다 — 그 계좌가 이 회차에
// 실제로 더 채울 수 있는 최대치이므로, "이 배분 시점에 계좌들이 서로 얼마나
// 여유로운가"를 그대로 반영하는 자연스러운 기준이다. 총 납입한도(ISA 1억원 등
// 세법 상수) 같은 고정값을 100%로 잡지 않은 이유: 그 값은 여기 화면에 안
// 나온다(세법 수치를 코드에 두지 않는다는 원칙과도 맞지 않는다), 계좌마다
// 성격이 달라(연금계좌는 매년 리셋되는 공유 풀, ISA는 누적 총액) 공통 분모가
// 없다.
const MIN_TRACK_PERCENT = 8; // 납입 잔여 한도가 있지만 최댓값 대비 작은 계좌가 안 보이지 않게 하는 바닥값
const ZERO_TRACK_PERCENT = 3; // "완전히 소진"을 "작지만 남음"과 구분하는, 그보다 더 낮은 바닥값
// 배제된 계좌의 트랙 폭. 한도에서 계산하지 않는 고정값이다 — 이 계좌에 대해
// 화면이 말할 수 있는 한도가 없다는 사실 자체를 길이가 아니라 형태(빗금 · 채움
// 없음)로 보인다. 0으로 두면 요소가 여백처럼 사라진다.
const UNAVAILABLE_TRACK_PERCENT = 12;

/**
 * `remaining`(이 계좌의 납입 잔여 한도)을 `maxRemaining`(세 계좌 중 최댓값) 대비
 * 트랙 길이(%)로 바꾼다. 순서(0 < 작음 < … < 최댓값=100)는 어떤 입력에서도
 * 뒤집히지 않는다 — 바닥값은 "안 보일 정도로 작은 값"만 끌어올릴 뿐, 상대
 * 크기 비교 자체를 왜곡하지 않는다. 정확한 값은 트랙 옆 캡션에 원 단위로
 * 그대로 적으므로, 바닥값으로 눌린 트랙이라도 사용자가 실제 숫자를 볼 수 있다.
 */
export function computeTrackScalePercent(remaining, maxRemaining) {
  if (maxRemaining <= 0) return ZERO_TRACK_PERCENT; // 세 계좌 모두 한도 소진 — 동률로 그린다
  if (remaining <= 0) return ZERO_TRACK_PERCENT;
  const raw = (remaining / maxRemaining) * 100;
  return Math.min(100, Math.max(MIN_TRACK_PERCENT, raw));
}

/**
 * C-2 한도 트랙 막대 하나. `AllocationBar`(design-system 5.7절)의 최소 구현.
 *
 * **`svgEl`이 아니라 `el`을 쓴다.** 이 함수가 만드는 것은 SVG 도형이 아니라
 * 일반 HTML `<div>` 두 겹(트랙+채움)이다. `svgEl`로 만들면
 * `document.createElementNS(SVG_NS, 'div')`가 되어 **SVG 네임스페이스의
 * div**가 생기고, 브라우저 기본 스타일시트에는 그런 원소에 대한
 * `display: block` 규칙이 없어 `display: inline`으로 계산된다 — 인라인
 * 요소는 `width`/`height`를 무시하므로 CSS에 `height: 20px`가 있어도 렌더
 * 크기가 0×0이 된다. 관리자가 브라우저 실측(`getBoundingClientRect`)으로
 * 잡은 버그이고, `stackBarSegments`의 래퍼도 같은 실수였다.
 *
 * **트랙 자체의 길이도 `trackScalePercent`로 스케일한다(D16).** 채움
 * (`percentOfLimit`)은 그 트랙 **안에서** 몇 %를 채웠는지이고, 트랙 길이는
 * 그 계좌의 한도가 세 계좌 중 얼마나 큰지다 — 서로 다른 두 사실이라 같은
 * 요소의 서로 다른 치수(트랙 폭 vs 채움 폭)로 나눠 표현한다.
 */
export function allocationBar({
  account,
  monthlyKrw,
  remainingLimitKrw,
  percentOfLimit,
  trackScalePercent = 100,
  unavailable = false,
  unavailableLabel = '',
}) {
  // 배제된 계좌(`unavailable`)에는 채움을 그리지 않고 트랙 길이도 한도에서
  // 끌어오지 않는다 — 길이가 곧 금액인 그림이므로, 표시하지 않기로 한 금액이
  // 길이로 새어 나가면 같은 결함이 형태만 바꿔 남는다. 계좌를 지우지는 않는다
  // (`screens.md` 5.4절: "계좌를 화면에서 지우면 왜 빠졌는지를 알 수 없다").
  //
  // **트랙은 점선 윤곽으로 그린다**(`screens.md` 5.9절 확정). 채움 없는 실선
  // 트랙은 "한도는 있는데 이번에 안 채웠다"와 "대상이 아니다"를 같은 그림으로
  // 만든다 — 두 사실을 가르는 것은 색이나 길이가 아니라 선의 형태다.
  const track = el(
    'div',
    {
      class: `alloc-bar-track${unavailable ? ' alloc-bar-track-unavailable' : ''}`,
      role: 'img',
      tabindex: '0',
      style: { width: `${unavailable ? UNAVAILABLE_TRACK_PERCENT : trackScalePercent}%` },
    },
    unavailable
      ? []
      : [
          el('div', {
            class: 'alloc-bar-fill',
            style: { width: `${Math.min(100, percentOfLimit * 100)}%`, background: ACCOUNT_COLOR[account] },
          }),
        ],
  );
  track.setAttribute(
    'aria-label',
    unavailable
      ? `${ACCOUNT_LABEL[account]}, ${unavailableLabel}`
      : `${ACCOUNT_LABEL[account]}, 월 ${formatKrw(monthlyKrw)}, 납입 잔여 한도 ${formatKrw(remainingLimitKrw)} 중 ${formatPercent(percentOfLimit)} 사용`,
  );
  return track;
}

// ---------------------------------------------------------------------------
// `BenefitMeter` — `AccountBenefitStrip`(design-system 5.31절 · screens.md
// 5.14절) 행 안의 미니 막대. `AllocationBar`와 같은 마크 언어를 절반 굵기로
// 재사용한다(D31 ①).
//
// **[2026-08-11, D43] 등급별 모양 구분(D28 — 확정 solid / 가정 윤곽+빗금)을
// 없앴다.** 지금은 등급과 무관하게 전부 같은 solid 채움이다. 확정/가정 구분은
// D36이 물리적으로 가른 두 축의 제목(조건절)과 행의 정산 기간이 진다
// (design-system 5.31.6절). `range` 등급은 계약에 필드가 아직 없어 이 회차에서도
// 그리지 않는다(design-system 5.31절 "지금 그릴 수 있는 것과 없는 것").
// ---------------------------------------------------------------------------

/**
 * 확정(solid) 등급의 채움 비율. 트랙 = 한도 적용 **전** 금액, 채움 = 적용
 * **후** 금액 — 화면이 뺄셈을 하지 않는다(design-system 5.31절 "값의 출처").
 * `beforeCapKrw`가 0 이하면 채울 대상 자체가 없으므로 0을 낸다.
 *
 * **값이 0보다 크면 최소한 보이게 한다**(design-system 5.31절 "값이 0보다
 * 크면 최소 3px는 보이게 한다" — 도넛의 "최소 2°"와 같은 정신). 절대 px이므로
 * 여기서는 만들지 않고 CSS(`.benefit-meter-fill`)의 `min-width: 3px`로
 * 지킨다 — 퍼센트 폭만으로는 작은 값이 화면에서 사라질 수 있다.
 */
export function benefitMeterFillPercent(afterCapKrw, beforeCapKrw) {
  if (!(beforeCapKrw > 0)) return 0;
  return Math.min(100, Math.max(0, (afterCapKrw / beforeCapKrw) * 100));
}

/**
 * 행 안의 막대 하나. **막대는 `aria-hidden`이다** — 행 전체(버튼)의 접근
 * 이름이 계좌명·금액·비율을 말한다(design-system 5.31절 "접근성").
 *
 * **[2026-08-11, D43] 등급 인자를 없앴다.** 지금까지 `grade: 'assumption'`
 * (가정, D28)은 채움을 비우고 계좌색 윤곽선 + 45° 빗금만 그렸다. 소유자가
 * 같은 신고("ISA 막대 안이 비어 있다")를 두 번째로 냈고, 관리자 D43이
 * 채움으로 바꾸도록 판정했다 — **확정/가정 구분은 이제 이 함수가 아니라
 * 가정 축 제목의 조건절(`{n}년 동안, 수익률이 연 {n}%라면`)과 행의 정산
 * 기간(`{n}년 계약 전체에서`)이 진다**(D36이 이미 두 축을 물리적 구분선으로
 * 갈라놓았으므로 이웃한 막대의 형태로 다시 가를 필요가 없어졌다). 모든
 * 호출부가 같은 solid 채움을 쓰므로 등급 인자 자체를 지웠다 — 남겨 두면
 * "쓰이지 않는 값"이라는 것이 코드만으로는 드러나지 않는다.
 */
export function benefitMeter({ account, fillPercent }) {
  const track = el('div', { class: 'benefit-meter-track', 'aria-hidden': 'true' });
  if (fillPercent > 0) {
    // 완성된 클래스 이름을 그대로 문자열 리터럴로 쓴다 — 접두사와 보간을
    // 한 템플릿에서 잇지 않는다(정적 클래스 일치성 검사기가 완성된 이름만
    // 본다, `css-class-consistency.test.mjs`).
    const fill = el('div', {
      class: 'benefit-meter-fill benefit-meter-fill-solid',
      style: { width: `${fillPercent}%`, background: ACCOUNT_COLOR[account] },
    });
    track.append(fill);
  }
  return track;
}

/** C-3 스택바 한 행의 조각들(계좌색 + 미배분). 배제된 계좌는 조각을 만들지 않는다. */
export function stackBarSegments({ allocations, unallocatedAnnualKrw, totalBudgetKrw, excludedAccounts = [] }) {
  const denom = totalBudgetKrw > 0 ? totalBudgetKrw : 1;
  const wrapper = el('div', { class: 'stackbar-row-fill' });
  for (const seg of allocationSegments({ allocations, unallocatedAnnualKrw, excludedAccounts })) {
    if (seg.amount <= 0) continue;
    const node = el('div', {
      class: 'stackbar-seg',
      style: {
        width: `${(seg.amount / denom) * 100}%`,
        background: seg.isUnallocated
          ? UNALLOCATED_COLOR
          : `var(--data-${seg.account === 'annuity_savings' ? 'pension' : seg.account === 'retirement_pension' ? 'irp' : 'isa'})`,
      },
    });
    wrapper.append(node);
  }
  return wrapper;
}

// ---------------------------------------------------------------------------
// ResultPlaceholder — 결과가 아직 없는 자리 (design-system 5.29절 · screens.md 8.1절)
// ---------------------------------------------------------------------------

/**
 * 결과 도넛이 만들 수 있는 조각 수의 **상한**. 계좌 셋 + 미배분 하나다.
 * 자리표시자의 조각 수는 이 값보다 커야 한다 — 그것이 장치 B1의 내용이다.
 */
export const MAX_RESULT_SLICE_COUNT = CHART_ACCOUNT_ORDER.length + 1;

/** B1 — 12는 이 제품의 어떤 입력으로도 나올 수 없는 조각 수다. */
export const PLACEHOLDER_SLICE_COUNT = 12;
/** 조각 사이 간격. 결과 도넛의 2px보다 넓다 — 넓은 간격이 "조각"이 아니라 "눈금"으로 읽히게 한다. */
export const PLACEHOLDER_GAP_PX = 4;

/**
 * 자리표시자 링의 기하. **상자는 `AccountDonut`과 완전히 같고**(결과가 들어올 때
 * 자리가 밀리면 안 된다) 도형만 다르다 — B3: 기울기 0°, 압출 0, 그래서 `ry = 1`.
 *
 * 순수 함수다. 넷 중 셋(B1·B2·B3)이 여기서 결정되므로 테스트가 이 함수만 보면
 * 자리표시자가 결과로 읽힐 수 없다는 것을 고정할 수 있다.
 */
export function placeholderGeometry(labelMode = 'labelled') {
  const box = donutGeometry(labelMode);
  return { ...box, tiltDeg: 0, extrudeDepth: 0, ry: 1, rMid: (box.R + box.rInner) / 2 };
}

/**
 * B2 — 12조각 **전부 같은 각(30°)**. 균등 분할은 비율 정보가 0이므로 읽을 값이
 * 없다. 조각 사이 간격은 각 조각의 양끝에서 같은 만큼 덜어 만든다(가운데 반지름
 * 기준 호 길이가 `gapPx`가 되는 각).
 */
export function placeholderSliceAngles({ count = PLACEHOLDER_SLICE_COUNT, gapPx = PLACEHOLDER_GAP_PX, rMid = 0 } = {}) {
  const step = 360 / count;
  const gapDeg = Math.min(step / 2, pxGapToDeg(gapPx, rMid));
  return Array.from({ length: count }, (_, i) => ({
    start: i * step + gapDeg / 2,
    end: (i + 1) * step - gapDeg / 2,
  }));
}

/**
 * 자리표시자 링. **결과가 만들 수 없는 형태로만** 도넛 모양을 쓴다 —
 * 12조각(B1) · 균등 30°(B2) · 평면(B3) · `data-placeholder` 단색(B4).
 *
 * 하지 않는 것: `data-unallocated`(그 회색은 "미배분 100%"라는 **실재 가능한
 * 결과**다) · 45° 해칭(`bill_stage` 전용) · 회전·맥동·shimmer(움직이면 "곧
 * 온다"로 읽힌다) · 숫자·눈금·범례·지시선.
 */
export function placeholderRing({ labelMode = preferredDonutSizeMode() } = {}) {
  const geom = placeholderGeometry(labelMode);
  const { R, rInner, ry, width, height, cx, cy, rMid } = geom;
  const arcs = placeholderSliceAngles({ rMid });

  const slices = arcs.map((a) =>
    svgEl('path', {
      d: annulusSlicePath(cx, cy, R, rInner, ry, a.start, a.end),
      fill: PLACEHOLDER_COLOR,
    }),
  );

  // 중앙 — 라벨 줄은 결과와 **같은 문자열·같은 자리**이고 값 줄만 `?`다.
  const center = svgEl('text', { x: cx, y: cy, 'text-anchor': 'middle' }, [
    svgEl('tspan', { class: 'placeholder-center-label', x: cx, dy: '-0.4em' }, [DONUT_CENTER_LABEL]),
    svgEl('tspan', { class: 'placeholder-center-value', x: cx, dy: '1.5em' }, [PLACEHOLDER_VALUE_MARK]),
  ]);

  return svgEl(
    'svg',
    {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      class: 'placeholder-ring',
      preserveAspectRatio: 'xMidYMid meet',
      // 링과 `?`는 장식이다. 대체 문장은 결과 패널이 시각적으로 숨겨 따로 낸다.
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [...slices, center],
  );
}

/**
 * 결과 자리에 지금 무엇을 그릴지 정하는 **순수 함수**. design-system 5.29절의
 * 전환 규약이 통째로 여기 들어 있다.
 *
 * **`draw`는 언제나 도형 하나다.** 두 도형이 동시에 나오는 반환값이 없으므로
 * "겹쳐 보이는 프레임"이 구조적으로 생기지 않는다 — 그것이 이 함수가 순수한
 * 이유이고, 테스트가 고정하는 것도 그 사실이다. 크로스페이드·모프를 넣으려면
 * 이 함수의 반환 타입부터 바꿔야 한다.
 *
 * 되돌아가는 전환(결과 → 자리표시자)에는 `leaving`이 없다 — **역재생하지 않고
 * 즉시 교체한다.** 역방향 애니메이션은 "결과가 자리표시자로 줄어든다"로 읽혀
 * 금액이 감소한 것처럼 보인다.
 *
 * @param {'placeholder'|'donut'|'none'} desired 지금 상태가 요구하는 도형
 * @param {'placeholder'|'donut'|null} lastShape 직전에 실제로 그린 도형
 * @param {'idle'|'leaving'|'entering'} phase
 * @param {boolean} reducedMotion `prefers-reduced-motion: reduce`
 */
export function nextSeatStep({ desired, lastShape = null, phase = 'idle', reducedMotion = false }) {
  if (desired !== 'donut') {
    return { draw: desired === 'placeholder' ? 'placeholder' : 'none', phase: 'idle', scheduleFadeMs: null };
  }
  if (phase === 'leaving') return { draw: 'placeholder-leaving', phase: 'leaving', scheduleFadeMs: null };
  if (phase === 'entering') return { draw: 'donut-entering', phase: 'idle', scheduleFadeMs: null };
  if (lastShape === 'placeholder' && !reducedMotion) {
    return { draw: 'placeholder-leaving', phase: 'leaving', scheduleFadeMs: PLACEHOLDER_FADE_MS };
  }
  return { draw: 'donut', phase: 'idle', scheduleFadeMs: null };
}

/** `draw` 값이 남기는 "직전에 그린 도형". 다음 호출의 `lastShape`가 된다. */
export function shapeOf(draw) {
  if (draw === 'placeholder' || draw === 'placeholder-leaving') return 'placeholder';
  if (draw === 'donut' || draw === 'donut-entering') return 'donut';
  return null;
}

export { CHART_ACCOUNT_ORDER };
