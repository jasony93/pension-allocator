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
import { formatKrw, formatPercent } from '../format.js';

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
/** 모바일에서 조각과 범례를 잇는 번호(screens.md 5.7절 ①②③). */
const CIRCLED_NUMBERS = ['①', '②', '③', '④'];

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
 */
export const DONUT_OUTER_DIAMETER = { labelled: 260, legend: 200 };

/**
 * 라벨 블록이 들어갈 좌우 여백.
 *
 * **실측에서 정한 값이다.** 세 프로필의 라벨 블록 폭을 브라우저에서
 * `getBoundingClientRect()`로 재니 최대 108.8px이었고(가장 긴 줄은 금액
 * `1,250,000원 / 월`), 자릿수가 더 늘어날 여지를 두어 `LABEL_TEXT_BUDGET`을
 * 132px로 잡았다. 라벨의 x는 `cx ± (R×1.2 + 10)`이고 텍스트는 거기서 바깥쪽으로
 * 뻗으므로, 여백은 `(R×1.2 + 10 + 텍스트폭) − R` 이상이어야 한다. R=130에서
 * 그 값은 168px이고, 좌우 8px씩 더 남기려고 176으로 둔다.
 *
 * 이 관계는 테스트가 고정한다 — 예전 구현은 라벨을 `R×1.22` 지점에 찍으면서
 * viewBox는 도넛 크기 그대로여서 라벨이 통째로 잘려 나갔고, 스크린샷으로는
 * "원래 그런 디자인"과 구분되지 않았다.
 */
export const LABEL_GUTTER = 176;
export const LABEL_TEXT_BUDGET = 132;
const LABEL_VPAD = 26;
/**
 * 라벨을 그리지 않는 모드에서 도넛 둘레에 남기는 여백(압출 그림자·안티에일리어싱
 * · 조각 번호).
 *
 * **결함 ②의 수정으로 8→10이 됐다**(design-system 3.5.5절 규약 6). 조각 순번은
 * 이제 계좌 색 위가 아니라 고리 **바깥**에 그린다 — 계좌 색은 정의상 표면 대비
 * 3:1 대역에서 뽑히므로 4.5:1이 필요한 작은 글자를 그 위에 얹을 수 없다. 번호가
 * 상자 밖으로 잘리지 않으려면 여백이 조금 더 필요하고, `wasted <= 20`(테스트)
 * 안에서 최대로 늘린 값이 10이다.
 */
const LEGEND_PAD = 10;
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
  const mode = labelMode === 'legend' ? 'legend' : 'labelled';
  const diameter = DONUT_OUTER_DIAMETER[mode];
  const R = diameter / 2;
  const pad = mode === 'labelled' ? LABEL_VPAD : LEGEND_PAD;
  const gutter = mode === 'labelled' ? LABEL_GUTTER : LEGEND_PAD;
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
export function donutChart({
  allocations,
  unallocatedAnnualKrw,
  unallocatedMonthlyKrw = 0,
  totalAllocatedMonthlyKrw = 0,
  isProposed = false,
  excludedAccounts = [],
  labelMode = preferredLabelMode(),
  // 자리표시자가 사라진 **다음 프레임에** 조각을 0°에서 펼친다(design-system
  // 5.29절 전환 2번). 값이 바뀌어 다시 그리는 경우에는 걸지 않는다 — 그때
  // 움직이는 것은 각도이지 "결과가 처음 생겼다"는 사실이 아니다.
  animateFromZero = false,
}) {
  const geom = donutGeometry(labelMode);
  const { R, rInner, depth, width, height, cx, cy } = geom;
  const drawLabels = geom.mode === 'labelled';

  const segments = allocationSegments({ allocations, unallocatedAnnualKrw, excludedAccounts });
  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const arcs = sliceAngles(segments);

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
  const sides = arcs.map((a) =>
    svgEl('path', {
      d: annulusSlicePath(cx, cy + depth, R, rInner, RY_RATIO, a.start, a.end),
      fill: a.isUnallocated ? UNALLOCATED_SIDE_COLOR : ACCOUNT_SIDE_COLOR[a.account],
      class: 'chart-donut-slice',
      'data-cy': cy + depth,
      'data-arc-start': a.start,
      'data-arc-end': a.end,
    }),
  );

  const tops = arcs.map((a) => {
    const path = svgEl('path', {
      d: annulusSlicePath(cx, cy, R, rInner, RY_RATIO, a.start, a.end),
      fill: a.isUnallocated ? UNALLOCATED_COLOR : ACCOUNT_COLOR[a.account],
      class: 'chart-donut-slice',
      'data-cy': cy,
      'data-arc-start': a.start,
      'data-arc-end': a.end,
      tabindex: '0',
      role: 'img',
      'aria-label': `${nameOf(a)}, 월 ${formatKrw(monthlyOf(a))}, 연 ${formatKrw(a.amount)}, 전체의 ${formatPercent(total > 0 ? a.amount / total : 0)}`,
    });
    return path;
  });

  const hatches = isProposed
    ? arcs
        .filter((a) => !a.isUnallocated)
        .map((a) =>
          svgEl('path', {
            d: annulusSlicePath(cx, cy, R, rInner, RY_RATIO, a.start, a.end),
            fill: 'url(#donut-hatch)',
            opacity: 0.5,
            class: 'chart-donut-slice',
            'data-cy': cy,
            'data-arc-start': a.start,
            'data-arc-end': a.end,
          }),
        )
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

  // 모바일 — 라벨 블록이 겹치므로 아래 리스트로 내리고 조각과는 색 + 번호로
  // 잇는다(screens.md 5.7절). 리스트는 SVG 밖에 둔다.
  //
  // **번호는 계좌 색 위에 직접 얹지 않는다**(결함 ② 수정, design-system 3.5.5절
  // 규약 6). 계좌 색은 정의상 표면 대비 3:1 대역에서 뽑혔고 글자는 4.5:1이
  // 필요해 애초에 자격이 없다 — 초판은 `surface-raised` 글자를 조각 위에 바로
  // 얹어 라이트 3.46/3.28, 다크 5.02/5.06으로 두 계좌가 미달이었다. **표면 색
  // 배지를 조각 바깥 테두리에 얹고 그 위에 번호를 놓는다** — 배지 자체가
  // `surface-raised`(마크 표면, 계좌 색과 무관하게 항상 밝다)이므로 번호는
  // 언제나 카드 표면 위의 `text-primary`가 되어 대비가 조각 색과 분리된다.
  const NUMBER_BADGE_RADIUS = 9;
  const sliceNumbers = arcs.flatMap((a, i) => {
    const mid = (a.start + a.end) / 2;
    const [nx, ny] = polar(cx, cy, R, R * RY_RATIO, mid); // 고리 바깥 테두리의 한 점
    return [
      svgEl('circle', { class: 'donut-slice-index-badge', cx: nx, cy: ny, r: NUMBER_BADGE_RADIUS }),
      svgEl('text', { class: 'donut-slice-index', x: nx, y: ny, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, [
        CIRCLED_NUMBERS[i] ?? String(i + 1),
      ]),
    ];
  });

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
  const centerText = svgEl('text', { class: 'donut-center', x: cx, y: cy, 'text-anchor': 'middle' }, [
    svgEl('tspan', { class: 'donut-center-label', x: cx, dy: '-0.4em' }, [DONUT_CENTER_LABEL]),
    svgEl('tspan', { class: 'donut-center-value', x: cx, dy: '1.5em' }, [formatKrw(totalAllocatedMonthlyKrw)]),
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
    },
    [
      defs,
      ...sides,
      ...tops,
      ...hatches,
      drawLabels ? svgEl('g', { class: 'donut-labels' }, [...leaders, ...labels]) : null,
      drawLabels ? null : svgEl('g', { class: 'donut-slice-indexes' }, sliceNumbers),
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
  const specs = [...svg.querySelectorAll('.chart-donut-slice')].map((node) => ({
    node,
    cy: Number(node.dataset.cy),
    start: Number(node.dataset.arcStart),
    end: Number(node.dataset.arcEnd),
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
 * 대역이므로 조각과 1:1이어야 한다 — 조각이 없는데 번호가 붙은 줄이 있으면
 * ①②③이 어느 조각을 가리키는지가 무너진다. 설계가 두 경우를 각각 정해 두었고
 * (5.9절: 배제 계좌는 "조각을 그리지 않는다. 라벨도 없다", 5.4절: 배분액 0인
 * 계좌는 C-2 캡션 `이 배분에서는 배분하지 않음`이 자리를 맡는다), 두 사실을
 * 말하는 자리는 모바일에서도 그대로 살아 있다(C-2는 폭만 줄고 그대로 성립한다,
 * 5.7절). 그래서 범례에 다시 적지 않는다.
 */
export function donutLegend({ allocations, unallocatedAnnualKrw, unallocatedMonthlyKrw = 0, excludedAccounts = [] }) {
  const segments = allocationSegments({ allocations, unallocatedAnnualKrw, excludedAccounts });
  const arcs = sliceAngles(segments);
  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  const monthlyByAccount = Object.fromEntries((allocations ?? []).map((a) => [a.account, a.monthly_krw]));

  return el(
    'ul',
    { class: 'donut-legend' },
    arcs.map((a, i) => {
      const monthly = a.isUnallocated ? unallocatedMonthlyKrw : (monthlyByAccount[a.account] ?? 0);
      const color = a.isUnallocated ? UNALLOCATED_COLOR : ACCOUNT_COLOR[a.account];
      return el('li', { class: 'donut-legend-item' }, [
        el('span', { class: 'donut-legend-index' }, [CIRCLED_NUMBERS[i] ?? String(i + 1)]),
        el('span', { class: 'donut-legend-swatch', style: { background: color } }),
        el('span', { class: 'donut-legend-name' }, [a.isUnallocated ? UNALLOCATED_LABEL : ACCOUNT_LABEL[a.account]]),
        el('span', { class: 'donut-legend-amount type-num' }, [`${formatKrw(monthly)} / 월`]),
        el('span', { class: 'donut-legend-pct' }, [formatPercent(total > 0 ? a.amount / total : 0)]),
      ]);
    }),
  );
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
// **세 등급은 색이 아니라 모양으로 갈린다**(D28) — 꽉 찬 채움(`solid`) ·
// 윤곽만(`assumption`). `range` 등급은 계약에 필드가 아직 없어 이 회차에서도
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
 * `grade`:
 * - `'solid'` — 확정. 채움을 계좌색으로 칠한다.
 * - `'assumption'` — 가정(D28). 채움을 비우고 값의 위치까지 계좌색 **윤곽선만**
 *   그린다. 트랙은 이 값 자신을 100%로 자기정규화한다(다른 계좌·다른 행과
 *   길이를 비교하지 않는다 — `AllocationBar`의 "각자 자기 before_cap이
 *   100%"와 같은 원칙).
 */
export function benefitMeter({ account, grade, fillPercent }) {
  const track = el('div', { class: 'benefit-meter-track', 'aria-hidden': 'true' });
  if (fillPercent > 0) {
    // 완성된 클래스 이름을 그대로 문자열 리터럴로 쓴다 — 접두사와 보간을
    // 한 템플릿에서 잇지 않는다(정적 클래스 일치성 검사기가 완성된 이름만
    // 본다, `css-class-consistency.test.mjs`).
    const isAssumption = grade === 'assumption';
    const fillClass = isAssumption ? 'benefit-meter-fill-outline' : 'benefit-meter-fill-solid';
    const fill = el('div', {
      class: `benefit-meter-fill ${fillClass}`,
      style: isAssumption
        ? { width: `${fillPercent}%`, borderColor: ACCOUNT_COLOR[account] }
        : { width: `${fillPercent}%`, background: ACCOUNT_COLOR[account] },
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
  const gapDeg = rMid > 0 ? Math.min(step / 2, (gapPx / (2 * Math.PI * rMid)) * 360) : 0;
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
export function placeholderRing({ labelMode = preferredLabelMode() } = {}) {
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
