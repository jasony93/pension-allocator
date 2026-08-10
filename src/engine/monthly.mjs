// 연간 금액을 월 표시 금액으로 나누는 산술. **세법 수치가 한 줄도 없다** —
// 개월수·한도 여유·연간 금액을 전부 인자로 받는다. 그래서 이 파일은 룰셋을 읽지 않고,
// 룰셋이 바뀌어도 이 파일은 바뀌지 않는다.
//
// ── 왜 별도 모듈인가 ──────────────────────────────────────────────
//
// (1) **떼어 놓지 않으면 돌지 않는 갈래가 생긴다.** "어디에도 붙일 곳이 없다"는 갈래는
//     확정 룰셋에서 특정한 한도·예산 조합에서만 나오고, 응답만 시험하면 그 갈래가 한 번도
//     돌지 않는다. `splitUnallocated`를 떼어낸 것과 같은 이유다.
// (2) **불변식을 산술 수준에서 고정할 수 있다.** 아래 세 진술은 이 함수의 반환값만으로
//     증명된다 — 엔진 전체를 돌리지 않아도 된다.
//
// ── 문제 ─────────────────────────────────────────────────────────
//
// 연간 예산 B = 월 여력 C × 개월수 m 이고, 배분 결과는 네 갈래(세 계좌 + 미배분)의
// 연간 금액 a_i 로 나뉜다. 정의상 Σa_i = B = C·m 이다.
//
// 월 표시 금액을 각각 내림 f_i = floor(a_i/m) 으로 만들면
//
//     Σf_i = C − k,     k = (Σ(a_i mod m)) / m,     k ∈ {0,1,2,3}
//
// 이 되어 **화면의 네 조각을 더해도 월 여력이 되지 않는다.** 소유자가 신고한 1원이 이것이다.
//
// ── 왜 그냥 올림·반올림이 답이 아닌가 ─────────────────────────────
//
// 어떤 갈래 i를 +1원 올리면 그 갈래는 연 기준으로 (m − r_i)원을 더 내게 된다. 그 갈래가
// 계좌라면 **그 계좌의 연간 납입이 늘어난다.** 납입 한도가 이미 차 있으면 그 순간 답이
// 틀린다 — 이 프로젝트가 계속 경계해 온 과대 방향이다.
//
// **그리고 「각 계좌의 월 × m ≤ 그 계좌의 연 배분」을 지키면서 합을 맞추는 것은 불가능하다.**
// 증명: 모든 i에 대해 monthly_i·m ≤ a_i 이면 Σmonthly_i·m ≤ Σa_i = C·m 이므로
// Σmonthly_i ≤ C 이고, 등호는 모든 a_i가 m으로 나누어떨어질 때만 성립한다. 즉 나머지가
// 하나라도 있으면 **합을 맞추는 배정은 반드시 어느 한 갈래의 연 배분을 넘어선다.**
// 그러므로 지켜야 할 것은 「연 배분」이 아니라 **「납입 한도」**다. 한도는 조문이 정한
// 값이고 연 배분은 엔진이 예산을 쪼갠 결과다. 넘으면 안 되는 것은 앞엣것이다.
//
// ── 규칙 ─────────────────────────────────────────────────────────
//
// 1. 각 갈래에 내림 f_i를 준다.
// 2. 남은 k원/월을 **한 원씩, 그때그때 가장 싼 갈래에** 얹는다. 어떤 갈래에 1원/월을
//    얹는 값은 **그 갈래의 연 기준 초과분**이다 — 처음 얹을 때 (m − r_i), 두 번째부터는
//    m. 즉 나머지가 클수록 싸다(최대잔여법이 이 규칙의 첫 바퀴다).
//    **값이 곧 「연 배분에서 벗어나는 정도」이므로, 싼 것부터 고르는 것은 벗어남을
//    가장 작게 만드는 것이다.**
// 3. 얹을 수 있는 갈래의 조건은 둘이다.
//    · **연 기준 금액이 0보다 크다.** 「이 계좌에는 넣지 않는다」고 말해 놓고 월 금액을
//      보이면 그 자체가 거짓 보고다. 미배분도 같다 — 남길 것이 없으면 남긴다고 못 한다.
//    · **계좌는 납입 한도 여유가 그 값 이상이다.** 두 연금계좌는 납입 한도를 공유하므로
//      여유도 함께 깎는다. **미배분에는 이 조건이 없다** — 어느 계좌에도 들어가지 않는
//      돈이라 조문상 상한이 걸릴 자리가 없고, 그 갈래를 키우는 것은 「그만큼을 계좌에
//      넣지 않고 남긴다」는 참인 진술이기 때문이다.
// 4. 값이 같으면 **그 배분안이 실제로 쓴 충당 순서**로 깬다.
// 5. 얹을 곳이 하나도 없으면 멈추고, 남은 몫을 **삼키지 않고 `unassignedMonthlyKrw`로
//    낸다.** 그때는 합이 월 여력에 못 미치는 것이 사실이고, 그 사실을 숨기면 화면이
//    거짓말을 하게 된다. **실제로 그렇게 되는 입력이 있다** — 예산이 남은 한도의 합과
//    정확히 같아 미배분이 0인데 연 배분이 개월수로 나누어떨어지지 않는 경우다.
//
// **순서 원칙(인출 자유 계좌 우선)과 충돌하지 않는다.** 여기서 정하는 것은 배분이 아니라
// 표시 단위 환산의 나머지다. 크기가 갈래당 연 m원 미만이고 **세액공제액을 바꾸지 않는다** —
// 공제는 연 배분 위에서 계산되고 이 함수는 연 배분을 읽기만 한다. 그래서 **배분
// 우선순위를 여기서 다시 다투지 않는다.** 값(=벗어남)이 정하고, 값이 같을 때만 그
// 배분안이 이미 쓴 순서를 따른다 — 새 원칙을 만들지 않는다는 뜻이다.

/**
 * @param {object} input
 * @param {number} input.months            개월수. 1 이상의 정수.
 * @param {number} input.capacityMonthlyKrw 월 납입 여력(원/월).
 * @param {Array<{id: string, annualKrw: number, poolId: string|null, orderIndex: number}>} input.buckets
 *        `poolId`가 `null`이면 한도가 없는 갈래(미배분)다. `orderIndex`는 값이 같을 때의
 *        순서이고 작을수록 먼저다.
 * @param {Record<string, number>} input.poolHeadroomKrw 풀별 납입 잔여 한도(원/연).
 * @returns {{
 *   buckets: Array<{id: string, monthlyKrw: number, floorMonthlyKrw: number,
 *                   roundingAdjustmentMonthlyKrw: number, remainderKrw: number,
 *                   monthlyAnnualizedKrw: number}>,
 *   unassignedMonthlyKrw: number,
 *   carriers: string[],
 * }}
 */
export function apportionMonthly({ months, capacityMonthlyKrw, buckets, poolHeadroomKrw }) {
  const parts = buckets.map((bucket) => {
    const floorMonthlyKrw = Math.floor(bucket.annualKrw / months);
    return {
      ...bucket,
      floorMonthlyKrw,
      remainderKrw: bucket.annualKrw - floorMonthlyKrw * months,
      roundingAdjustmentMonthlyKrw: 0,
    };
  });

  // 얹어야 할 1원/월의 개수. 예산이 정확히 C·m이므로 정수다.
  const assignedFloorTotal = parts.reduce((sum, part) => sum + part.floorMonthlyKrw, 0);
  let remaining = capacityMonthlyKrw - assignedFloorTotal;

  // 풀별 여유를 깎아 가며 배정한다. 인자를 변형하지 않는다.
  const headroom = { ...poolHeadroomKrw };
  const carriers = [];

  /** 이 갈래에 1원/월을 더 얹으면 연 기준으로 얼마를 더 벗어나는가. */
  const costOf = (part) =>
    part.roundingAdjustmentMonthlyKrw === 0 ? months - part.remainderKrw : months;

  // k ≤ 3이고 갈래가 넷이라 한 원씩 도는 것으로 충분하다. 반복 횟수는 세법과 무관하다.
  while (remaining > 0) {
    let chosen = null;
    for (const part of parts) {
      // 「넣지 않는다」고 말한 갈래에는 월 금액을 붙이지 않는다.
      if (part.annualKrw <= 0) continue;
      const cost = costOf(part);
      if (part.poolId !== null && (headroom[part.poolId] ?? 0) < cost) continue;
      if (chosen === null || cost < chosen.cost || (cost === chosen.cost && part.orderIndex < chosen.part.orderIndex)) {
        chosen = { part, cost };
      }
    }
    if (chosen === null) break;

    if (chosen.part.poolId !== null) headroom[chosen.part.poolId] -= chosen.cost;
    if (chosen.part.roundingAdjustmentMonthlyKrw === 0) carriers.push(chosen.part.id);
    chosen.part.roundingAdjustmentMonthlyKrw += 1;
    remaining -= 1;
  }

  return {
    buckets: parts.map((part) => {
      const monthlyKrw = part.floorMonthlyKrw + part.roundingAdjustmentMonthlyKrw;
      return {
        id: part.id,
        monthlyKrw,
        floorMonthlyKrw: part.floorMonthlyKrw,
        roundingAdjustmentMonthlyKrw: part.roundingAdjustmentMonthlyKrw,
        remainderKrw: part.remainderKrw,
        monthlyAnnualizedKrw: monthlyKrw * months,
      };
    }),
    // 끝내 얹지 못한 몫(원/월). 0이 아니면 **월 표시 금액의 합이 월 여력에 못 미친다.**
    unassignedMonthlyKrw: remaining < 0 ? 0 : remaining,
    carriers,
  };
}
