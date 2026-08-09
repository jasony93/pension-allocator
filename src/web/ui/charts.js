/**
 * 차트 세 층 — `screens.md` 5절 확정안. C-1 입체 도넛, C-2 한도 트랙 막대,
 * C-3 스택바. 세법 수치는 다루지 않는다 — 전부 엔진이 낸 금액을 그대로 그린다.
 *
 * 기하 파라미터(기울기 15°·두께 8%·시작각 12시·조각 순서)는 디자인 시스템이
 * 고정한 값이다(design-system.md 5.20절). 세법 수치가 아니라 화면 기하 상수이므로
 * 여기 상수로 둔다 — 제품 원칙 1이 금지하는 "세법 수치 하드코딩"과는 다른 것이다.
 */

import { el, svgEl } from './dom.js';
import { ACCOUNT_LABEL } from '../copy.js';
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
const ACCOUNT_COLOR_DARK = {
  annuity_savings: 'var(--data-pension-side)',
  retirement_pension: 'var(--data-irp-side)',
  isa: 'var(--data-isa-side)',
};
const UNALLOCATED_COLOR = 'var(--data-unallocated)';

function polar(cx, cy, rx, ry, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + rx * Math.sin(rad), cy - ry * Math.cos(rad)];
}

function annulusSlicePath(cx, cy, rOuter, rInner, ry, startDeg, endDeg) {
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
 * C-1 입체 도넛. `allocations`는 `{account, annual_krw}[]`, `unallocatedAnnualKrw`는
 * 이번 배분에서 남는 금액(없으면 0), `isProposed`는 개정예고 시나리오 여부
 * (상단면에만 사선 해칭, design-system 3.5절 규약 3).
 */
export function donutChart({ allocations, unallocatedAnnualKrw, size = 240, isProposed = false }) {
  const R = size / 2 - 8;
  const rInner = R * 0.55;
  const cx = size / 2;
  const cy = size / 2 + R * EXTRUDE_RATIO; // 압출 두께만큼 아래로 여유
  const depth = R * EXTRUDE_RATIO;

  const byAccount = Object.fromEntries(allocations.map((a) => [a.account, a.annual_krw]));
  const total = CHART_ACCOUNT_ORDER.reduce((s, a) => s + (byAccount[a] || 0), 0) + unallocatedAnnualKrw;

  const segments = [
    ...CHART_ACCOUNT_ORDER.map((account) => ({ account, amount: byAccount[account] || 0, isUnallocated: false })),
    ...(unallocatedAnnualKrw > 0 ? [{ account: 'unallocated', amount: unallocatedAnnualKrw, isUnallocated: true }] : []),
  ];

  let angle = 0;
  const arcs = [];
  for (const seg of segments) {
    if (total <= 0 || seg.amount <= 0) continue;
    const sweep = (seg.amount / total) * 360;
    arcs.push({ ...seg, start: angle, end: angle + sweep });
    angle += sweep;
  }

  const sides = arcs.map((a) =>
    svgEl('path', {
      d: annulusSlicePath(cx, cy + depth, R, rInner, RY_RATIO, a.start, a.end),
      fill: a.isUnallocated ? UNALLOCATED_COLOR : ACCOUNT_COLOR_DARK[a.account],
      opacity: 0.9,
    }),
  );

  const tops = arcs.map((a) => {
    const path = svgEl('path', {
      d: annulusSlicePath(cx, cy, R, rInner, RY_RATIO, a.start, a.end),
      fill: a.isUnallocated ? UNALLOCATED_COLOR : ACCOUNT_COLOR[a.account],
      tabindex: '0',
      role: 'img',
      'aria-label': `${a.isUnallocated ? '미배분' : ACCOUNT_LABEL[a.account]}, 연 ${formatKrw(a.amount)}, 전체의 ${formatPercent(total > 0 ? a.amount / total : 0)}`,
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
          }),
        )
    : [];

  const labels = arcs.map((a) => {
    const mid = (a.start + a.end) / 2;
    const [lx, ly] = polar(cx, cy, R * 1.22, R * RY_RATIO * 1.1, mid);
    const pct = total > 0 ? a.amount / total : 0;
    return svgEl(
      'text',
      { x: lx, y: ly, class: 'donut-label', 'text-anchor': lx > cx ? 'start' : lx < cx ? 'end' : 'middle' },
      [`${a.isUnallocated ? '미배분' : ACCOUNT_LABEL[a.account]} ${formatPercent(pct)}`],
    );
  });

  const defs = svgEl('defs', {}, [
    svgEl('pattern', { id: 'donut-hatch', width: 6, height: 6, patternTransform: 'rotate(45)', patternUnits: 'userSpaceOnUse' }, [
      svgEl('rect', { width: 6, height: 6, fill: 'transparent' }),
      svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--surface-raised)', 'stroke-width': 3 }),
    ]),
  ]);

  return svgEl(
    'svg',
    { viewBox: `0 0 ${size} ${size + depth + 4}`, width: size, height: size + depth + 4, class: 'chart-donut' },
    [defs, ...sides, ...tops, ...hatches, ...labels],
  );
}

// D16 — 트랙 길이의 공통 배율. screens.md 5.4절: "세 막대는 공통 배율을 쓴다.
// 잔여 한도가 가장 큰 계좌의 트랙이 화면 폭을 채우고, 나머지는 그 비율만큼
// 짧아진다." 잔여 한도가 가장 큰 계좌를 100%로 잡는다 — 그 계좌가 이 회차에
// 실제로 더 채울 수 있는 최대치이므로, "이 배분 시점에 계좌들이 서로 얼마나
// 여유로운가"를 그대로 반영하는 자연스러운 기준이다. 총 납입한도(ISA 1억원 등
// 세법 상수) 같은 고정값을 100%로 잡지 않은 이유: 그 값은 여기 화면에 안
// 나온다(세법 수치를 코드에 두지 않는다는 원칙과도 맞지 않는다), 계좌마다
// 성격이 달라(연금계좌는 매년 리셋되는 공유 풀, ISA는 누적 총액) 공통 분모가
// 없다.
const MIN_TRACK_PERCENT = 8; // 잔여 한도가 있지만 최댓값 대비 작은 계좌가 안 보이지 않게 하는 바닥값
const ZERO_TRACK_PERCENT = 3; // "완전히 소진"을 "작지만 남음"과 구분하는, 그보다 더 낮은 바닥값

/**
 * `remaining`(이 계좌의 잔여 한도)을 `maxRemaining`(세 계좌 중 최댓값) 대비
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
export function allocationBar({ account, monthlyKrw, remainingLimitKrw, percentOfLimit, trackScalePercent = 100, unavailable = false }) {
  const track = el(
    'div',
    { class: 'alloc-bar-track', role: 'img', tabindex: '0', style: { width: `${trackScalePercent}%` } },
    [
      el('div', {
        class: 'alloc-bar-fill',
        style: { width: `${Math.min(100, percentOfLimit * 100)}%`, background: unavailable ? UNALLOCATED_COLOR : ACCOUNT_COLOR[account] },
      }),
    ],
  );
  track.setAttribute(
    'aria-label',
    `${ACCOUNT_LABEL[account]}, 월 ${formatKrw(monthlyKrw)}, 잔여 한도 ${formatKrw(remainingLimitKrw)} 중 ${formatPercent(percentOfLimit)} 사용`,
  );
  return track;
}

/** C-3 스택바 한 행의 조각들(계좌색 + 미배분). */
export function stackBarSegments({ allocations, unallocatedAnnualKrw, totalBudgetKrw }) {
  const byAccount = Object.fromEntries(allocations.map((a) => [a.account, a.annual_krw]));
  const denom = totalBudgetKrw > 0 ? totalBudgetKrw : 1;
  const wrapper = el('div', { class: 'stackbar-row-fill' });
  for (const account of CHART_ACCOUNT_ORDER) {
    const amount = byAccount[account] || 0;
    if (amount <= 0) continue;
    const seg = el('div', {
      class: 'stackbar-seg',
      style: {
        width: `${(amount / denom) * 100}%`,
        background: `var(--data-${account === 'annuity_savings' ? 'pension' : account === 'retirement_pension' ? 'irp' : 'isa'})`,
      },
    });
    wrapper.append(seg);
  }
  if (unallocatedAnnualKrw > 0) {
    const seg = el('div', { class: 'stackbar-seg', style: { width: `${(unallocatedAnnualKrw / denom) * 100}%`, background: UNALLOCATED_COLOR } });
    wrapper.append(seg);
  }
  return wrapper;
}

export { CHART_ACCOUNT_ORDER };
