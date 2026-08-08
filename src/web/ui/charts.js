/**
 * 차트 세 층 — `screens.md` 5절 확정안. C-1 입체 도넛, C-2 한도 트랙 막대,
 * C-3 스택바. 세법 수치는 다루지 않는다 — 전부 엔진이 낸 금액을 그대로 그린다.
 *
 * 기하 파라미터(기울기 15°·두께 8%·시작각 12시·조각 순서)는 디자인 시스템이
 * 고정한 값이다(design-system.md 5.20절). 세법 수치가 아니라 화면 기하 상수이므로
 * 여기 상수로 둔다 — 제품 원칙 1이 금지하는 "세법 수치 하드코딩"과는 다른 것이다.
 */

import { svgEl } from './dom.js';
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

/** C-2 한도 트랙 막대 하나. `AllocationBar`(design-system 5.7절)의 최소 구현. */
export function allocationBar({ account, monthlyKrw, remainingLimitKrw, percentOfLimit, unavailable = false }) {
  const track = svgEl('div', { class: 'alloc-bar-track' }, [
    svgEl('div', {
      class: 'alloc-bar-fill',
      style: { width: `${Math.min(100, percentOfLimit * 100)}%`, background: unavailable ? UNALLOCATED_COLOR : ACCOUNT_COLOR[account] },
    }),
  ]);
  track.setAttribute('role', 'img');
  track.setAttribute('tabindex', '0');
  track.setAttribute(
    'aria-label',
    `${ACCOUNT_LABEL[account]}, 월 ${formatKrw(monthlyKrw)}, 잔여 한도의 ${formatPercent(percentOfLimit)}`,
  );
  return track;
}

/** C-3 스택바 한 행의 조각들(계좌색 + 미배분). */
export function stackBarSegments({ allocations, unallocatedAnnualKrw, totalBudgetKrw }) {
  const byAccount = Object.fromEntries(allocations.map((a) => [a.account, a.annual_krw]));
  const denom = totalBudgetKrw > 0 ? totalBudgetKrw : 1;
  const wrapper = svgEl('div', { class: 'stackbar-row-fill' });
  for (const account of CHART_ACCOUNT_ORDER) {
    const amount = byAccount[account] || 0;
    if (amount <= 0) continue;
    const seg = document.createElement('div');
    seg.className = 'stackbar-seg';
    seg.style.width = `${(amount / denom) * 100}%`;
    seg.style.background = `var(--data-${account === 'annuity_savings' ? 'pension' : account === 'retirement_pension' ? 'irp' : 'isa'})`;
    wrapper.append(seg);
  }
  if (unallocatedAnnualKrw > 0) {
    const seg = document.createElement('div');
    seg.className = 'stackbar-seg';
    seg.style.width = `${(unallocatedAnnualKrw / denom) * 100}%`;
    seg.style.background = UNALLOCATED_COLOR;
    wrapper.append(seg);
  }
  return wrapper;
}

export { CHART_ACCOUNT_ORDER };
