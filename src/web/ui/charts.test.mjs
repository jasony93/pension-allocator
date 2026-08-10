import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNALLOCATED_LABEL } from '../copy.js';
import {
  computeTrackScalePercent,
  allocationSegments,
  annulusSlicePath,
  sliceAngles,
  donutLabelLayout,
  donutGeometry,
  preferredLabelMode,
  MIN_SLICE_DEG,
  LABEL_GUTTER,
  LABEL_TEXT_BUDGET,
  LABEL_BLOCK_BELOW,
  DONUT_OUTER_DIAMETER,
  CHART_ACCOUNT_ORDER,
  MAX_RESULT_SLICE_COUNT,
  PLACEHOLDER_SLICE_COUNT,
  PLACEHOLDER_FADE_MS,
  DONUT_SWEEP_MS,
  placeholderGeometry,
  placeholderSliceAngles,
  nextSeatStep,
  shapeOf,
} from './charts.js';

test('the account with the largest remaining limit always scales to exactly 100%', () => {
  assert.equal(computeTrackScalePercent(18000000, 18000000), 100);
});

test('a proportionally smaller remaining limit scales down by the same ratio', () => {
  assert.equal(computeTrackScalePercent(9000000, 18000000), 50);
});

test('an account with zero remaining limit gets the distinct "exhausted" floor, not zero width', () => {
  const pct = computeTrackScalePercent(0, 18000000);
  assert.ok(pct > 0, 'a 0-width track disappears entirely, per D16');
  assert.ok(pct < 8, 'the exhausted floor must read as visibly smaller than the small-but-nonzero floor');
});

test('an extremely small but nonzero remaining limit is floored so it stays visible/clickable', () => {
  const pct = computeTrackScalePercent(1000, 18000000); // 0.0056% raw
  assert.ok(pct >= 8, 'raw ratio would be imperceptible; the floor keeps it readable');
});

test('the floor never inflates a small value past a larger one — relative order is preserved', () => {
  const small = computeTrackScalePercent(100, 18000000);
  const medium = computeTrackScalePercent(9000000, 18000000);
  const large = computeTrackScalePercent(18000000, 18000000);
  const zero = computeTrackScalePercent(0, 18000000);
  assert.ok(zero < small, 'exhausted must read smaller than a merely-tiny-but-real remainder');
  assert.ok(small < medium, 'floor must not let a tiny value catch up to a genuinely mid-sized one');
  assert.ok(medium < large);
});

test('all three accounts exhausted (maxRemaining = 0) renders all tracks at the same exhausted floor, not NaN/Infinity', () => {
  const pct = computeTrackScalePercent(0, 0);
  assert.ok(Number.isFinite(pct));
  assert.ok(pct > 0 && pct < 8);
});

// --- 배제된 계좌의 조각 (4단계 관찰 O1) ------------------------------------

const ALLOCATIONS = [
  { account: 'retirement_pension', annual_krw: 9000000 },
  { account: 'annuity_savings', annual_krw: 0 },
  { account: 'isa', annual_krw: 0 },
];

test('C-1 and C-3 draw no slice for an account the engine excluded', () => {
  const segments = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 0, excludedAccounts: ['isa'] });
  assert.equal(
    segments.some((s) => s.account === 'isa'),
    false,
    '배제된 계좌는 조각 후보에도 오르지 않는다',
  );
});

test('excluding one account never removes the others', () => {
  const segments = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 0, excludedAccounts: ['isa'] });
  assert.deepEqual(
    segments.map((s) => s.account),
    ['annuity_savings', 'retirement_pension'],
    '조각 순서(연금저축 → IRP)는 A3 규약대로 고정이다',
  );
});

test('an excluded account carrying a nonzero amount is still not drawn — the amount cannot be spent there', () => {
  const contradictory = [
    { account: 'retirement_pension', annual_krw: 9000000 },
    { account: 'annuity_savings', annual_krw: 0 },
    { account: 'isa', annual_krw: 3000000 }, // 계약 위반(배제 계좌는 limited_by: not_eligible로 0이다)
  ];
  const segments = allocationSegments({ allocations: contradictory, unallocatedAnnualKrw: 0, excludedAccounts: ['isa'] });
  assert.equal(segments.some((s) => s.account === 'isa'), false);
});

test('with nothing excluded every account keeps its segment, including zero-amount ones', () => {
  const segments = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 600000 });
  assert.deepEqual(
    segments.map((s) => s.account),
    ['annuity_savings', 'retirement_pension', 'isa', 'unallocated'],
  );
});

test('the unallocated segment appears only when there is an unallocated amount', () => {
  const none = allocationSegments({ allocations: ALLOCATIONS, unallocatedAnnualKrw: 0 });
  assert.equal(none.some((s) => s.isUnallocated), false);
});

// --- 조각 하나가 원 전체를 차지할 때 (브라우저 실측으로 잡은 폭 0 렌더) -------

test('a slice covering the whole circle is drawn as two arcs, not one that collapses to a line', () => {
  const full = annulusSlicePath(120, 120, 112, 61.6, 0.966, 0, 360);
  const arcs = full.match(/A /g) ?? [];
  assert.equal(arcs.length, 4, '반원 두 개 × 안팎 두 링. 호 하나로 그리면 시작점=끝점이라 아무것도 안 그려진다');
});

test('a partial slice keeps the original single-arc form', () => {
  const partial = annulusSlicePath(120, 120, 112, 61.6, 0.966, 0, 90);
  assert.equal((partial.match(/A /g) ?? []).length, 2);
});

test('the full-ring path spans both sides of the centre, so its bounding box cannot be zero-width', () => {
  const cx = 120;
  const full = annulusSlicePath(cx, 120, 112, 61.6, 0.966, 0, 360);
  const xs = [...full.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)|A [\d.]+ [\d.]+ 0 [01] [01] (-?[\d.]+) (-?[\d.]+)/g)]
    .map((m) => Number(m[1] ?? m[3]))
    .filter((n) => Number.isFinite(n));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0, '좌우로 벌어진 점이 없으면 폭 0으로 렌더된다');
});

// --- 조각 각도 (design-system 5.20절 확정 규약) ------------------------------

const seg = (account, amount) => ({ account, amount, isUnallocated: false });

test('a slice with a nonzero amount is never smaller than the minimum visible angle', () => {
  const arcs = sliceAngles([seg('retirement_pension', 100000000), seg('isa', 1)]);
  const isa = arcs.find((a) => a.account === 'isa');
  assert.ok(isa.end - isa.start >= MIN_SLICE_DEG, '보이지 않는 조각보다 약간 부정확한 조각이 낫다');
});

test('widening the tiny slice still leaves the ring closed at exactly 360°', () => {
  const arcs = sliceAngles([seg('retirement_pension', 100000000), seg('annuity_savings', 1), seg('isa', 1)]);
  assert.ok(Math.abs(arcs[arcs.length - 1].end - 360) < 1e-9);
});

test('a zero-amount account gets no arc at all', () => {
  const arcs = sliceAngles([seg('retirement_pension', 9000000), seg('annuity_savings', 0), seg('isa', 0)]);
  assert.deepEqual(arcs.map((a) => a.account), ['retirement_pension']);
});

test('a single account fills the whole ring — 0° to 360°', () => {
  const arcs = sliceAngles([seg('isa', 9600000)]);
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].start, 0);
  assert.equal(arcs[0].end, 360);
});

test('slices stay contiguous and in the fixed account order (A3)', () => {
  const arcs = sliceAngles([seg('annuity_savings', 3000000), seg('retirement_pension', 6000000), seg('isa', 1000000)]);
  assert.deepEqual(arcs.map((a) => a.account), ['annuity_savings', 'retirement_pension', 'isa']);
  for (let i = 1; i < arcs.length; i++) assert.equal(arcs[i].start, arcs[i - 1].end);
});

test('proportions are untouched when every slice is already above the minimum', () => {
  const arcs = sliceAngles([seg('annuity_savings', 1), seg('retirement_pension', 1)]);
  assert.equal(arcs[0].end - arcs[0].start, 180);
});

test('never exceeds 100% even if remaining somehow equals maxRemaining exactly at the boundary', () => {
  assert.equal(computeTrackScalePercent(18000000, 18000000), 100);
  assert.ok(computeTrackScalePercent(20000000, 18000000) <= 100); // 방어적 클램프 — remaining이 max를 넘는 입력은 없어야 하지만 클램프로 안전하게 막는다
});

// --- C-1 라벨 배치 (screens.md 5.2·5.6절, A2 왜곡 완화 장치) -----------------
//
// 소유자가 "라벨이 안 보인다"고 지적했고 실측에서 원인이 드러났다 — 라벨을
// 도넛 반지름의 1.22배 지점에 찍으면서 viewBox는 도넛 크기 그대로였다. 즉
// **그림 밖에 그려져 잘려 나갔다.** 스크린샷으로는 "원래 그런 디자인"과
// 구분되지 않는 종류의 결함이므로 좌표를 테스트로 고정한다.

// 상자 수치를 테스트가 따로 베껴 두지 않는다 — 예전에는 그래서 지름을 바꿔도
// 테스트가 옛 상자를 검사하고 통과했다. 구현과 같은 순수 함수를 부른다.
const GEOM = donutGeometry('labelled');
const { R, width: WIDTH, height: HEIGHT } = GEOM;
const SIZE = GEOM.diameter;

const arcsOf = (...spans) => {
  let angle = 0;
  return spans.map(([account, sweep]) => {
    const arc = { account, isUnallocated: account === 'unallocated', amount: sweep, start: angle, end: angle + sweep };
    angle += sweep;
    return arc;
  });
};

test('every label lands inside the drawing box — a label outside the viewBox is simply invisible', () => {
  const layout = donutLabelLayout(arcsOf(['annuity_savings', 160], ['retirement_pension', 110], ['isa', 90]), GEOM);
  for (const l of layout) {
    assert.ok(l.textX >= 0 && l.textX <= WIDTH, `라벨 x가 상자 밖이다: ${l.account} → ${l.textX}`);
    // y는 첫 줄의 기준선이고 아래로 두 줄이 더 붙는다 — 블록 전체가 들어가야 한다.
    assert.ok(l.textY >= 0, `라벨 y가 상자 위로 나갔다: ${l.account} → ${l.textY}`);
    assert.ok(
      l.textY + LABEL_BLOCK_BELOW <= HEIGHT,
      `라벨 블록의 아래 두 줄이 상자 밖으로 잘린다: ${l.account} → ${l.textY} + ${LABEL_BLOCK_BELOW} > ${HEIGHT}`,
    );
  }
});

test('the box is wider than the donut, because labels need room beside it', () => {
  assert.ok(WIDTH > SIZE, '도넛과 같은 폭의 상자에서는 옆에 붙는 라벨이 잘린다');
});

test('every slice gets exactly one leader line, and it starts on that slice', () => {
  const arcs = arcsOf(['annuity_savings', 160], ['retirement_pension', 110], ['isa', 90]);
  const layout = donutLabelLayout(arcs, GEOM);
  assert.equal(layout.length, arcs.length, '지시선이 라벨 수보다 적으면 어느 조각의 값인지 모호해진다');
  for (const l of layout) {
    assert.equal(l.leader.length, 3, '조각 → 꺾임점 → 라벨의 세 점');
    const [[sx, sy]] = l.leader;
    const distance = Math.hypot(sx - GEOM.cx, sy - GEOM.cy);
    assert.ok(distance <= R + 1, '지시선은 조각의 테두리에서 출발해야 한다');
  }
});

test('labels never overlap vertically, even when three slices share one side', () => {
  // 오른쪽에 몰린 배치 — 겹치면 어느 조각의 금액인지 읽을 수 없다.
  const layout = donutLabelLayout(arcsOf(['annuity_savings', 20], ['retirement_pension', 20], ['isa', 20], ['unallocated', 300]), GEOM);
  for (const side of ['left', 'right']) {
    const ys = layout.filter((l) => l.side === side).map((l) => l.textY).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      assert.ok(ys[i] - ys[i - 1] >= 54, `라벨 블록(세 줄)이 겹친다: ${ys[i - 1]} / ${ys[i]}`);
    }
  }
});

test('labels sit outside the ring on the side their slice is on, anchored away from the donut', () => {
  const layout = donutLabelLayout(arcsOf(['annuity_savings', 90], ['isa', 270]), GEOM);
  for (const l of layout) {
    if (l.side === 'right') {
      assert.equal(l.anchor, 'start');
      assert.ok(l.textX > GEOM.cx + R, '오른쪽 라벨이 고리 위에 겹쳐 있다');
    } else {
      assert.equal(l.anchor, 'end');
      assert.ok(l.textX < GEOM.cx - R, '왼쪽 라벨이 고리 위에 겹쳐 있다');
    }
  }
});

test('a single full-ring slice still gets a label with a leader', () => {
  const layout = donutLabelLayout(arcsOf(['isa', 360]), GEOM);
  assert.equal(layout.length, 1);
  assert.equal(layout[0].leader.length, 3);
});

// --- 도넛 바깥지름과 라벨 여백 (designer 미결 (a)) ---------------------------
//
// `screens.md` 5.2절 주석이 데스크톱 외경 260px, 5.7절이 모바일 200px로 답한다.
// 실측에서는 각각 224.0px·127.7px이 나왔다 — 둘 다 설계보다 작았고, 모바일 쪽은
// 라벨을 CSS로 감추기만 하고 라벨 자리(좌우 여백)는 그대로 둔 것이 원인이었다.

test('the donut is drawn at the outer diameter the design fixed, on both layouts', () => {
  assert.equal(donutGeometry('labelled').diameter, 260, 'screens.md 5.2절 데스크톱 외경');
  assert.equal(donutGeometry('legend').diameter, 200, 'screens.md 5.7절 모바일 외경');
  assert.deepEqual(DONUT_OUTER_DIAMETER, { labelled: 260, legend: 200 });
});

test('the legend layout spends almost none of its box on label margin — that margin is why the mobile donut shrank', () => {
  const legend = donutGeometry('legend');
  const wasted = legend.width - legend.diameter;
  assert.ok(wasted <= 20, `라벨을 그리지 않는데 여백이 ${wasted}px 남아 있으면 도넛만 그만큼 작아진다`);
});

test('the labelled box leaves room for the whole label block on both sides', () => {
  // 라벨의 x는 cx ± (R×1.2 + 10)이고 텍스트는 거기서 **바깥쪽으로** 뻗는다.
  // anchor가 end/start라 x를 상자 안으로 잘라내는 것만으로는 글자가 안 들어온다.
  const right = GEOM.cx + GEOM.R * 1.2 + 10 + LABEL_TEXT_BUDGET;
  const left = GEOM.cx - GEOM.R * 1.2 - 10 - LABEL_TEXT_BUDGET;
  assert.ok(right <= GEOM.width, `가장 긴 라벨이 오른쪽으로 ${(right - GEOM.width).toFixed(1)}px 삐져나간다`);
  assert.ok(left >= 0, `가장 긴 라벨이 왼쪽으로 ${(-left).toFixed(1)}px 삐져나간다`);
  assert.ok(LABEL_TEXT_BUDGET >= 109, '실측 최대 라벨 폭 108.8px보다 좁게 잡으면 긴 금액이 잘린다');
  assert.ok(LABEL_GUTTER >= GEOM.R * 0.2 + 10 + LABEL_TEXT_BUDGET);
});

test('label mode falls back to the labelled layout where there is no matchMedia (tests, SSR)', () => {
  assert.equal(preferredLabelMode(), 'labelled');
});

// --- 미배분 조각과 모바일 범례 (designer 미결 (c)·(d)) -----------------------

test('the unallocated slice is named once, in the copy dictionary, not inline in the chart', () => {
  // 조각 라벨의 형태는 계좌 조각과 같다 — 이름 / 금액 / 비율 세 줄(screens.md
  // 5.6절). 다른 것은 이름뿐이고, 미배분은 계좌가 아니므로 `ACCOUNT_LABEL`이
  // 아니라 별도 상수에서 온다. **왜 남았는지는 라벨에 넣지 않는다** — 그 사유는
  // `limited_by`마다 달라지고 `[4-D]` 표의 미배분 행이 이미 말한다(qa 결함 Q1).
  assert.equal(UNALLOCATED_LABEL, '미배분');
  const source = readFileSync(new URL('./charts.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/['"]미배분['"]/.test(source), '차트가 이름을 직접 적으면 사전과 갈라진다');
});

test('the mobile legend stands in for the labels, so it lists exactly the slices that exist', () => {
  // 범례의 번호 ①②③은 조각 위의 번호와 같은 배열에서 나온다. 조각이 없는 줄이
  // 범례에 있으면 그 대응이 무너진다 — 배제된 계좌(5.9절)도, 배분액이 0인
  // 계좌(5.4절)도 조각이 없으므로 범례에도 오르지 않는다.
  const allocations = [
    { account: 'retirement_pension', annual_krw: 3000000, monthly_krw: 250000 },
    { account: 'annuity_savings', annual_krw: 0, monthly_krw: 0 },
    { account: 'isa', annual_krw: 0, monthly_krw: 0 },
  ];
  const arcs = sliceAngles(allocationSegments({ allocations, unallocatedAnnualKrw: 600000, excludedAccounts: ['isa'] }));
  assert.deepEqual(
    arcs.map((a) => a.account),
    ['retirement_pension', 'unallocated'],
    '배분 0원인 연금저축도, 배제된 ISA도 조각이 없으니 범례에도 없다',
  );
});

// --- ResultPlaceholder (design-system 5.29절 · screens.md 8.1절) -------------
//
// **자리표시자가 결과로 읽히지 않게 하는 장치 넷을 여기서 고정한다.** 소유자가
// 도넛 형태를 지시했고 designer가 형태 금지를 풀되 "결과가 만들 수 없는 형태로만"
// 허용했다(D23 판정 3). 넷 중 하나라도 흐려지면 사용자가 자리표시자를 답으로
// 읽으므로, 넷 다 눈이 아니라 수치로 지켜야 한다.

test('B1 — 자리표시자의 조각 수가 결과 도넛의 최대 조각 수보다 많다', () => {
  // 결과 도넛은 계좌 셋 + 미배분 하나로 최대 4조각이다. 12는 이 제품의 어떤
  // 입력으로도 나올 수 없는 수이고, 세다가 다섯 번째에서 결과가 아니라는 것이
  // 확정된다. **`12`를 상수로 적는 것만으로는 이 사실이 지켜지지 않는다** —
  // 계좌가 늘면 최대 조각 수도 는다. 그래서 둘의 관계를 검사한다.
  assert.equal(MAX_RESULT_SLICE_COUNT, CHART_ACCOUNT_ORDER.length + 1);
  assert.ok(
    PLACEHOLDER_SLICE_COUNT > MAX_RESULT_SLICE_COUNT,
    `자리표시자 ${PLACEHOLDER_SLICE_COUNT}조각이 결과 최대 ${MAX_RESULT_SLICE_COUNT}조각 이하입니다 — 결과로 읽힐 수 있습니다`,
  );
  assert.equal(placeholderSliceAngles({ rMid: 100 }).length, PLACEHOLDER_SLICE_COUNT);
});

test('B2 — 12조각이 전부 같은 각이다. 균등 분할은 비율 정보가 0이라 읽을 값이 없다', () => {
  const arcs = placeholderSliceAngles({ rMid: 100 });
  const sweeps = arcs.map((a) => a.end - a.start);
  const first = sweeps[0];
  for (const s of sweeps) assert.ok(Math.abs(s - first) < 1e-9, `조각 각이 다릅니다: ${sweeps.join(', ')}`);
  // 간격을 빼기 전의 몫은 정확히 30°다.
  assert.equal(360 / arcs.length, 30);
});

test('B2 — 조각이 원을 한 바퀴만 돌고, 사이 간격이 결과 도넛(2px)보다 넓다', () => {
  const rMid = 100;
  const arcs = placeholderSliceAngles({ rMid });
  assert.equal(arcs[0].start > 0, true, '첫 조각도 시작에서 간격만큼 물러난다');
  assert.ok(arcs[arcs.length - 1].end < 360);
  const gapDeg = arcs[1].start - arcs[0].end;
  const gapPx = (gapDeg / 360) * 2 * Math.PI * rMid;
  assert.ok(Math.abs(gapPx - 4) < 1e-6, `간격이 4px가 아닙니다: ${gapPx}`);
  assert.ok(gapPx > 2, '넓은 간격이 "조각"이 아니라 "눈금"으로 읽히게 한다');
});

test('B3 — 평면이다. 기울기 0°, 압출 0 — 결과 도넛의 15°/8%와 같은 도형일 수 없다', () => {
  const geom = placeholderGeometry('labelled');
  assert.equal(geom.tiltDeg, 0);
  assert.equal(geom.extrudeDepth, 0);
  assert.equal(geom.ry, 1, 'ry가 1이 아니면 원근이 생겨 입체로 읽힌다');
  // 결과 도넛은 기울기 15°를 쓰므로 ry가 1보다 작다 — 둘이 같아지면 B3이 무너진다.
  assert.ok(Math.cos((15 * Math.PI) / 180) < geom.ry);
});

test('자리표시자의 상자가 결과 도넛과 완전히 같다 — 결과가 들어올 때 자리가 밀리지 않는다', () => {
  for (const mode of ['labelled', 'legend']) {
    const donut = donutGeometry(mode);
    const ph = placeholderGeometry(mode);
    assert.equal(ph.width, donut.width, `${mode}: 폭이 다르다`);
    assert.equal(ph.height, donut.height, `${mode}: 높이가 다르다`);
    assert.equal(ph.R, donut.R);
    assert.equal(ph.rInner, donut.rInner, '링 두께 비율도 같다');
  }
});

// --- 자리표시자 ↔ 결과 전환 (design-system 5.29절) ---------------------------

test('전환 어느 단계에서도 그리는 도형은 하나뿐이다 — 겹치는 프레임이 구조적으로 없다', () => {
  // 크로스페이드·모프를 넣으려면 이 함수의 반환 타입부터 바꿔야 한다. 12등분이
  // 결과 조각으로 변형되는 것처럼 보이면 "자리표시자가 답이었다"는 인상이 남는다.
  const seen = [];
  let phase = 'idle';
  let lastShape = 'placeholder';
  for (let i = 0; i < 4; i++) {
    const step = nextSeatStep({ desired: 'donut', lastShape, phase, reducedMotion: false });
    seen.push(step.draw);
    phase = step.phase === 'leaving' ? 'entering' : step.phase; // 타이머가 하는 일
    lastShape = shapeOf(step.draw);
  }
  assert.deepEqual(seen, ['placeholder-leaving', 'donut-entering', 'donut', 'donut']);
  for (const draw of seen) assert.equal(typeof draw, 'string', 'draw는 도형 하나를 가리키는 값이다');
});

test('링을 지우는 시간이 먼저 흐르고, 그 다음에 조각이 펼쳐진다', () => {
  const step = nextSeatStep({ desired: 'donut', lastShape: 'placeholder', phase: 'idle', reducedMotion: false });
  assert.equal(step.draw, 'placeholder-leaving');
  assert.equal(step.scheduleFadeMs, PLACEHOLDER_FADE_MS);
  assert.equal(PLACEHOLDER_FADE_MS, 120);
  assert.equal(DONUT_SWEEP_MS, 240);
});

test('결과 → 자리표시자 복귀는 역재생이 아니라 즉시 교체다', () => {
  // 역방향 애니메이션은 "결과가 자리표시자로 줄어든다"로 읽혀 금액이 감소한 것처럼
  // 보인다(5.29절).
  const step = nextSeatStep({ desired: 'placeholder', lastShape: 'donut', phase: 'idle', reducedMotion: false });
  assert.equal(step.draw, 'placeholder');
  assert.equal(step.scheduleFadeMs, null);
  assert.equal(step.phase, 'idle');
});

test('prefers-reduced-motion이면 전환이 0ms다 — 페이드 단계 자체가 없다', () => {
  const step = nextSeatStep({ desired: 'donut', lastShape: 'placeholder', phase: 'idle', reducedMotion: true });
  assert.equal(step.draw, 'donut', '사라지는 링을 거치지 않고 곧바로 도넛이다');
  assert.equal(step.scheduleFadeMs, null);
});

test('결과가 이미 있는 상태에서 값만 바뀌면 조각을 다시 펼치지 않는다', () => {
  // 그때 움직이는 것은 각도이지 "결과가 처음 생겼다"는 사실이 아니다. 테마 변경도
  // 같다 — 값이 바뀐 것이 아니므로 조각은 그 자리에 있다(design-system 5.30절).
  const step = nextSeatStep({ desired: 'donut', lastShape: 'donut', phase: 'idle', reducedMotion: false });
  assert.equal(step.draw, 'donut');
});
