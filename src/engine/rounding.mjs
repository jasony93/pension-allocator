// 원 미만 끝수를 없애는 자리. **조문이 정한 자리와 우리가 정한 자리를 코드에서 가른다.**
//
// **무엇이 결함이었나** (D46 1번 · 검증 20절). 엔진이 근로소득공제를 먼저 버리고 총급여에서
// 뺐다. 그래서 과세표준이 조문보다 **항상 정확히 1원 컸다** — 우연이 아니라 항등식이고,
// 총급여가 20의 배수가 아닌 15% 구간 사용자 전원에게 걸렸다. 금액 차이는 1원인데 세액공제
// 상한이 정확히 900만 × 15%라 **`tax_liability_cap.applied`가 뒤집힌다.**
//
// **조문이 지목한 단계는 둘뿐이다**(「국고금 관리법」 제47조 — 조문 제목이 「국고금의 끝수
// 계산」이다).
//
//   · §47② 국세의 **과세표준액**을 산정할 때 1원 미만 끝수는 계산하지 아니한다
//   · §47① **국고금의 수입 또는 지출**에서 10원 미만 끝수는 계산하지 아니한다
//
// **단위가 단계마다 다르다.** 그 사이의 중간값·비교·표시 세 단계는 조문이 지목하지 않았고
// **이 조직이 규약을 세웠다.** 룰셋이 그 구분을 `determined_by_law`로 값에 적어 두었다.
//
// **그 구분을 코드에서도 지운 채 두지 않는다.** 이 파일이 내는 손잡이가 둘인 이유다 —
// `statutory()`는 `determined_by_law: true`인 자리에서만, `convention()`은 `false`인
// 자리에서만 동작한다. 둘을 뒤바꿔 부르면 값을 내지 않고 계산이 멈춘다. 룰셋에서 그 칸이
// 뒤집혀도 같은 일이 일어난다. **같은 형태의 결함이 이 조직에서 네 번 나왔다** — 하나의
// 사실을 두 곳에 적고 한쪽만 갱신하는 형태이고, 여기서는 「어느 자리가 조문인가」가 그
// 사실이다.
//
// **산문을 읽지 않는다.** 룰셋 자신이 그렇게 정했다(`engine_contract`: "엔진은 이 규칙의
// 산문을 읽지 않는다. stage_code와 operation_code, unit_krw만 읽는다"). `why`·`convention`·
// `statutory_text`는 사람이 읽는 칸이고, 앞에 한 단어가 붙는 것만으로 판정이 뒤집히는
// 자리를 다시 만들지 않는다(D41 1번).
//
// **세법 수치는 이 파일에 없다.** 「1원」도 「10원」도 없고 `Math.floor`도 없다 —
// 연산 이름과 단위는 룰셋에서 읽어 `exact.mjs`에 넘긴다.

import { ROUNDING_OP, ROUNDING_STAGE, RULE } from './constants.mjs';
import { exactToInteger, floorExactToUnit } from './exact.mjs';

/**
 * 단계 하나를 룰셋의 칸 그대로 읽어 둔 것.
 * @typedef {{ operationCode: string, unitKrw: number|null, determinedByLaw: boolean }} Stage
 */

/** 단계 노드가 엔진이 쓸 수 있는 형태인가. 아니면 `null` — 지어내지 않는다. */
function readStage(node) {
  if (node === null || typeof node !== 'object') return null;
  if (typeof node.operation_code !== 'string') return null;
  if (typeof node.determined_by_law !== 'boolean') return null;

  const unit = node.unit_krw ?? null;
  if (unit !== null && !Number.isSafeInteger(unit)) return null;

  // 엔진이 할 줄 아는 연산인가. 모르는 이름이면 **아무것도 하지 않는 쪽으로 넘어가지 않는다** —
  // 절사를 조용히 건너뛰면 조문이 정한 자리에서 끝수가 살아남는다.
  if (node.operation_code !== ROUNDING_OP.FLOOR && node.operation_code !== ROUNDING_OP.NONE) {
    return null;
  }
  // 버리는 연산인데 단위가 없으면 얼마 단위로 버릴지 알 수 없다. 1원으로 가정하지 않는다.
  if (node.operation_code === ROUNDING_OP.FLOOR && unit === null) return null;

  return { operationCode: node.operation_code, unitKrw: unit, determinedByLaw: node.determined_by_law };
}

/**
 * 원 미만 처리 규약을 룰셋에서 읽어 손잡이로 만든다.
 *
 * 읽지 못하면 `null`을 돌려준다 — 부르는 쪽이 계산을 멈춘다. 규약 없이 계산을 이어 가면
 * 어디선가 `Math.floor`를 다시 쓰게 되고, 그것이 조문에 없는 세 번째 절사 자리다.
 */
export function createRoundingPolicy(access, appliedTo) {
  const value = access.value(RULE.ROUNDING_WON_FRACTION, ['value'], appliedTo);
  if (value === undefined) return null;

  const declared = value.stages;
  if (!Array.isArray(declared)) {
    access.value(RULE.ROUNDING_WON_FRACTION, ['value', 'stages'], appliedTo);
    return null;
  }

  /** @type {Map<string, Stage>} */
  const stages = new Map();
  for (const node of declared) {
    if (node === null || typeof node !== 'object' || typeof node.stage_code !== 'string') continue;
    const stage = readStage(node);
    if (stage === null) return null;
    stages.set(node.stage_code, stage);
  }

  // 엔진이 서는 다섯 단계가 전부 선언되어 있어야 한다. 하나라도 없으면 그 자리에서
  // 무엇을 할지 정해지지 않은 것이고, 정해지지 않은 것을 정하는 것은 엔진의 일이 아니다.
  for (const stageCode of Object.values(ROUNDING_STAGE)) {
    if (!stages.has(stageCode)) {
      access.value(RULE.ROUNDING_WON_FRACTION, ['value', 'stages', stageCode], appliedTo);
      return null;
    }
  }

  // §47①이 우리에게 걸리는가. **룰셋이 값으로 답한다** — 산문이 아니라 `binds_engine_output`
  // 칸이다. 이 엔진이 내는 것은 납부세액도 환급세액도 아니라 세액공제로 줄어드는 세액과
  // 그 한도이므로 오늘의 답은 `false`다. 그 칸이 `true`가 되는 날, **어느 출력이 국고금의
  // 수입·지출인지는 룰셋이 말해 주지 않으므로** 엔진은 10원 단위를 아무 데나 걸지 않고 멈춘다.
  const treasuryBinds = declared.find((node) => node?.stage_code === ROUNDING_STAGE.TREASURY)
    ?.binds_engine_output;
  if (treasuryBinds !== false) {
    access.value(
      RULE.ROUNDING_WON_FRACTION,
      ['value', 'stages', ROUNDING_STAGE.TREASURY, 'binds_engine_output'],
      appliedTo,
    );
    return null;
  }

  // 개인지방소득세분은 `stages` 밖에 따로 있다(§47③이 「준용할 수 있다」는 임의규정이라
  // 조문으로 정해지지 않는다). 그 사실도 룰셋이 `determined_by_law: false`로 적어 두었다.
  const localStage = readStage(value.local_income_tax_stage ?? null);
  if (localStage === null) {
    access.value(RULE.ROUNDING_WON_FRACTION, ['value', 'local_income_tax_stage'], appliedTo);
    return null;
  }

  /** 단계의 연산을 정확값에 적용한다. 연산도 단위도 룰셋의 칸에서 온다. */
  function apply(stage, exact) {
    if (stage === undefined || exact === null) return null;
    if (stage.operationCode === ROUNDING_OP.NONE) return exact;
    return floorExactToUnit(exact, stage.unitKrw);
  }

  /** 조문이 정한 자리인지 우리가 정한 자리인지를 부르는 쪽이 **선언하고** 들어온다. */
  function at(stageCode, exact, requiredDeterminedByLaw) {
    const stage = stages.get(stageCode);
    if (stage === undefined || stage.determinedByLaw !== requiredDeterminedByLaw) return null;
    return apply(stage, exact);
  }

  return {
    /** 조문이 정한 자리(§47②). `determined_by_law`가 `true`가 아니면 값을 내지 않는다. */
    statutory: (stageCode, exact) => at(stageCode, exact, true),

    /** 이 조직이 정한 자리. `determined_by_law`가 `false`가 아니면 값을 내지 않는다. */
    convention: (stageCode, exact) => at(stageCode, exact, false),

    /** 개인지방소득세분. 조문이 정하지 않았으므로 규약 쪽이다. */
    localSurtax: (exact) => (localStage.determinedByLaw === false ? apply(localStage, exact) : null),

    /** 응답에 정수 원으로 싣는다. 표시 단계는 **우리가 정한 자리**다. */
    display: (exact) => exactToInteger(at(ROUNDING_STAGE.DISPLAYED, exact, false)),

    /** 개인지방소득세분을 정수 원으로. 단계가 따로 있으므로 손잡이도 따로 둔다. */
    displayLocal: (exact) =>
      exactToInteger(localStage.determinedByLaw === false ? apply(localStage, exact) : null),

    /** 단계 표를 그대로 볼 수 있게 낸다 — 시험이 룰셋과 견줄 때만 쓴다. */
    stageOf: (stageCode) => stages.get(stageCode) ?? null,
  };
}
