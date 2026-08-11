// 연금저축·IRP를 **나중에 받을 때**의 세율 — 금액이 아니라 세율만 낸다 (D36).
//
// **여기에 금액을 만들지 않는다.** `pension.rate_gap.quantifiability`가 「금액으로도
// 구간으로도 낼 수 없다」고 확정했고 D36이 그것을 승인했다. 이 파일이 내는 것은 셋뿐이다.
//   1. 조문이 그대로 정하는 세율표 (새 입력 0개·가정 0개)
//   2. 계좌 밖 세율에서 계좌 안 세율을 뺀 **부호**와 폭 (%p)
//   3. 「지금 계산할 수 없음」이라는 사실과, 무엇이 미결로 남아 있는지의 코드
//
// **화면이 조항 번호나 문구를 지어내지 않게 하는 것이 이 파일의 목적이다.** 세율도
// 조문 인용도 전부 룰셋에서 나오고, 코드에 있는 문자열은 상황 이름(situation_code)뿐이다.

import {
  PENSION_RATE_GAP_COMPUTABILITY,
  RATE_GAP_SIGN,
  RULE,
  WITHDRAWAL_BRANCH,
} from './constants.mjs';
import { effectiveRate, toRatio } from './ratio.mjs';

const APPLIED_TO = 'pension_withdrawal_tax_reference';

/**
 * 세율표의 상황 이름을 **계좌 밖 / 계좌 안 갈래**로 나눈다.
 *
 * 여기 있는 것은 룰셋이 스스로 쓰는 이름이고 세법 수치가 아니다. 접두사로 가르는 것은
 * 연령 구간이 늘어도 따라가기 위해서다 — 이름을 하나씩 적어 두면 룰셋에 행이 하나
 * 늘었을 때 그 행이 조용히 빠진다. **어느 갈래에도 들지 않는 이름이 나오면 멈춘다.**
 */
const OUTSIDE_PREFIX = 'outside_account_';
const OUTSIDE_CHARACTER = {
  outside_account_interest_dividend: 'interest_dividend',
  outside_account_listed_equity_capital_gain: 'listed_equity_capital_gain',
};
const OVER_THRESHOLD = 'pension_annuity_over_separate_threshold';
const NON_ANNUITY = 'pension_non_annuity';
const ANNUITY_PREFIX = 'pension_annuity_';

function branchOf(situationCode) {
  if (situationCode.startsWith(OUTSIDE_PREFIX)) return null; // 계좌 밖
  if (situationCode === OVER_THRESHOLD) return WITHDRAWAL_BRANCH.ANNUITY_OVER_THRESHOLD;
  if (situationCode === NON_ANNUITY) return WITHDRAWAL_BRANCH.NON_ANNUITY;
  if (situationCode.startsWith(ANNUITY_PREFIX)) return WITHDRAWAL_BRANCH.ANNUITY_WITHIN_THRESHOLD;
  return undefined; // 분류할 수 없다 — 지어내지 않고 멈춘다
}

/** 소득 성격 × 인출 갈래 — 세율표를 두 축으로 갈라 낼 조합. 이름만 있고 수치는 없다. */
const GAP_COMBINATIONS = [
  { character: 'interest_dividend', branch: WITHDRAWAL_BRANCH.ANNUITY_WITHIN_THRESHOLD },
  { character: 'interest_dividend', branch: WITHDRAWAL_BRANCH.NON_ANNUITY },
  { character: 'interest_dividend', branch: WITHDRAWAL_BRANCH.ANNUITY_OVER_THRESHOLD },
  { character: 'listed_equity_capital_gain', branch: WITHDRAWAL_BRANCH.ANNUITY_WITHIN_THRESHOLD },
  { character: 'listed_equity_capital_gain', branch: WITHDRAWAL_BRANCH.NON_ANNUITY },
  { character: 'listed_equity_capital_gain', branch: WITHDRAWAL_BRANCH.ANNUITY_OVER_THRESHOLD },
  // 성격이 섞였거나 정해지지 않은 사람. 계좌 밖 세율도 계좌 안 세율도 하나로 좁혀지지
  // 않으므로 폭이 양쪽 끝을 다 본다. 그 결과가 0을 가로지른다는 것이 D36의 판정이다.
  { character: 'mixed_or_unknown', branch: WITHDRAWAL_BRANCH.ANY },
];

/**
 * 두 실효율의 차. **정수 분수로 바꿔 빼고 마지막에 한 번만 나눈다** — 소수를 그대로
 * 빼면 이진 부동소수점 꼬리가 붙어 `+9.9%p`가 `9.900000000000002`로 화면에 나간다.
 * `ratio.mjs`가 세율을 다룰 때 쓰는 규율 그대로다.
 */
function subtractRates(a, b) {
  const left = toRatio(a);
  const right = toRatio(b);
  if (left === null || right === null) return null;
  return (left.num * right.den - right.num * left.den) / (left.den * right.den);
}

function signOf(minGap, maxGap) {
  if (minGap === null || maxGap === null) return RATE_GAP_SIGN.NOT_DETERMINED;
  if (minGap > 0) return RATE_GAP_SIGN.POSITIVE;
  if (maxGap < 0) return RATE_GAP_SIGN.NEGATIVE;
  return RATE_GAP_SIGN.CROSSES_ZERO;
}

/**
 * 세율표가 옮겨 적은 원 규칙들과 **세율 집합이 같은지** 본다.
 *
 * 표는 `pension.rate_gap.quantifiability` 한 곳에 모여 있고 원 세율은 네 규칙에 흩어져
 * 있다. 표만 읽으면 원 규칙이 개정됐는데 표가 낡은 상태를 아무도 잡지 못한다.
 * **집합으로 비교하는 것은 행 대 규칙의 짝을 지으려면 설명 문구를 읽어야 하기 때문이다** —
 * 문구를 읽는 순간 그 문구가 계약의 일부가 된다. 집합은 그 대가 없이 낡음을 잡는다.
 *
 * 대조가 어긋나면 `rule_missing`을 남기고 멈춘다. 어느 쪽이 맞는지는 엔진이 정하지 않는다.
 */
function crossCheckRates(access, insideRows) {
  const byAge = access.value(RULE.PENSION_INCOME_RATE_BY_AGE, ['value', 'brackets'], APPLIED_TO);
  const lifetime = access.value(RULE.PENSION_INCOME_RATE_LIFETIME, ['value', 'rate'], APPLIED_TO);
  const nonAnnuity = access.value(RULE.PENSION_EARLY_WITHDRAWAL_RATE, ['value', 'rate'], APPLIED_TO);
  const elective = access.value(
    RULE.PENSION_SEPARATE_TAXATION_ELECTIVE,
    ['value', 'options'],
    APPLIED_TO,
  );
  if (byAge === undefined || lifetime === undefined || nonAnnuity === undefined || elective === undefined) {
    return false;
  }

  const fromRules = new Set([
    ...byAge.map((bracket) => bracket?.rate),
    lifetime,
    nonAnnuity,
    ...elective.map((option) => option?.rate).filter((rate) => typeof rate === 'number'),
  ]);
  const fromTable = new Set(
    insideRows.map((row) => row.income_tax_rate).filter((rate) => typeof rate === 'number'),
  );

  const same =
    fromRules.size === fromTable.size && [...fromRules].every((rate) => fromTable.has(rate));
  if (!same) {
    // 값을 고르지 않는다. 표가 낡았는지 규칙이 바뀌었는지는 tax-domain이 정한다.
    access.value(
      RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
      ['value', 'rate_table', 'rows', 'income_tax_rate', 'disagrees_with_source_rules'],
      APPLIED_TO,
    );
    return false;
  }
  return true;
}

/**
 * 참고 구역 전체를 만든다. **요청의 어떤 입력에도 의존하지 않는다** — 새 입력 0개가
 * 이 표의 성립 조건이고, 입력에 반응하는 순간 「가정 0개」가 깨진다.
 */
export function resolvePensionWithdrawalTaxReference(access) {
  const rows = access.value(
    RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
    ['value', 'rate_table', 'rows'],
    APPLIED_TO,
  );
  const unresolved = access.value(
    RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
    ['value', 'what_remains_unknown_even_with_all_of_them'],
    APPLIED_TO,
  );
  const minimumInputs = access.value(
    RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
    ['value', 'minimum_input_set', 'items'],
    APPLIED_TO,
  );
  // 「세액공제를 받은 납입액은 나중에 다시 과세된다」는 고정 문장이 서 있는 자리.
  // 이 자리가 비면 화면의 그 문장이 근거를 잃는다.
  const halfLedger = access.value(
    RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
    ['value', 'the_half_ledger_problem', 'what_can_be_said_without_opening_it'],
    APPLIED_TO,
  );
  const threshold = access.value(
    RULE.PENSION_SEPARATE_TAXATION_THRESHOLD,
    ['value', 'amount_krw'],
    APPLIED_TO,
  );
  const surtaxRate = access.value(RULE.LOCAL_SURTAX, ['value', 'rate_of_income_tax'], APPLIED_TO);
  // 「금액으로 낼 수 없다」는 판정 자체가 실린 자리. 규칙이 그 판정을 거두면 멈춘다.
  const producible = access.value(
    RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
    ['value', 'what_can_be_produced_today'],
    APPLIED_TO,
  );

  if (
    rows === undefined ||
    unresolved === undefined ||
    minimumInputs === undefined ||
    halfLedger === undefined ||
    threshold === undefined ||
    surtaxRate === undefined ||
    producible === undefined
  ) {
    return null;
  }

  const table = [];
  const outside = new Map();
  const inside = new Map();

  for (const row of rows) {
    const code = row?.situation_code;
    if (typeof code !== 'string' || typeof row.law !== 'string') {
      access.value(
        RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
        ['value', 'rate_table', 'rows', 'situation_code'],
        APPLIED_TO,
      );
      return null;
    }
    const incomeTaxRate = typeof row.income_tax_rate === 'number' ? row.income_tax_rate : null;

    // **표의 `effective_rate` 칸을 읽지 않는다.** 룰셋이 스스로 적어 두었다 —
    // "derived_effective_rates는 참고용이다. 엔진은 이 표를 상수로 읽지 말고 각
    // 소득세율 × 1.1로 산출해야 세율이 하나만 바뀌어도 전부 따라 움직인다."
    // 읽어서 대조하는 쪽을 골랐다가 부가율이 바뀌는 좌표에서 계산이 멈추는 것을 확인했다.
    const rowEffective = incomeTaxRate === null ? null : effectiveRate(incomeTaxRate, surtaxRate);
    if (incomeTaxRate !== null && rowEffective === null) {
      access.value(
        RULE.LOCAL_SURTAX,
        ['value', 'rate_of_income_tax', 'not_a_readable_ratio'],
        APPLIED_TO,
      );
      return null;
    }

    const branch = branchOf(code);
    if (branch === undefined) {
      access.value(
        RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
        ['value', 'rate_table', 'rows', code, 'unclassifiable_situation_code'],
        APPLIED_TO,
      );
      return null;
    }

    table.push({
      situation_code: code,
      description: typeof row['설명'] === 'string' ? row['설명'] : null,
      side_code: branch === null ? 'outside_account' : 'inside_account',
      withdrawal_branch_code: branch,
      income_tax_rate: incomeTaxRate,
      effective_rate: rowEffective,
      law: row.law,
      note: typeof row.note === 'string' ? row.note : null,
    });

    const bucket = branch === null ? outside : inside;
    const key = branch === null ? OUTSIDE_CHARACTER[code] : branch;
    if (key === undefined) {
      access.value(
        RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
        ['value', 'rate_table', 'rows', code, 'unmapped_income_character'],
        APPLIED_TO,
      );
      return null;
    }
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push({ situation_code: code, effective_rate: rowEffective });
  }

  // **계좌 밖 세율은 대조 상대가 없다.** 이자·배당 원천징수세율은 ISA 산식 규칙에도
  // 있으나, 두 자리는 같은 조문의 **따로 된 전사**이고 어느 한쪽만 바꾸는 것이 정당한
  // 좌표가 실재한다(ISA 쪽만 비트는 회귀 테스트가 그 좌표다). 그래서 대조하지 않는다 —
  // 그 자리는 룰셋 안의 이중 전사이고, 계약이 아니라 `tax-domain`이 지킬 몫이다.
  if (!crossCheckRates(access, table.filter((row) => row.side_code === 'inside_account'))) {
    return null;
  }

  const gapCases = GAP_COMBINATIONS.map(({ character, branch }) => {
    const outsideRows =
      character === 'mixed_or_unknown' ? [...outside.values()].flat() : (outside.get(character) ?? []);
    const insideRows =
      branch === WITHDRAWAL_BRANCH.ANY ? [...inside.values()].flat() : (inside.get(branch) ?? []);

    const determinedInside = insideRows.filter((row) => row.effective_rate !== null);
    const undetermined = insideRows
      .filter((row) => row.effective_rate === null)
      .map((row) => row.situation_code)
      .sort();

    let minGap = null;
    let maxGap = null;
    if (outsideRows.length > 0 && determinedInside.length > 0) {
      const gaps = [];
      for (const out of outsideRows) {
        for (const inRow of determinedInside) {
          gaps.push(subtractRates(out.effective_rate, inRow.effective_rate));
        }
      }
      minGap = Math.min(...gaps);
      maxGap = Math.max(...gaps);
    }

    return {
      income_character_code: character,
      withdrawal_branch_code: branch,
      outside_situation_codes: outsideRows.map((row) => row.situation_code).sort(),
      inside_situation_codes: insideRows.map((row) => row.situation_code).sort(),
      // 세율이 조문으로 닫히지 않는 상황. 폭에서 빠졌다는 사실을 값으로 낸다 —
      // 빠진 것을 말하지 않으면 화면이 좁은 폭을 전부인 것처럼 적는다.
      undetermined_situation_codes: undetermined,
      gap_min_rate: minGap,
      gap_max_rate: maxGap,
      sign_code: signOf(minGap, maxGap),
      basis_rule_ids: [RULE.PENSION_RATE_GAP_QUANTIFIABILITY],
    };
  });

  return {
    // **0원이 아니다.** 계산했더니 0인 것과 계산 자체를 하지 못하는 것은 다른 사실이다.
    computability_code: PENSION_RATE_GAP_COMPUTABILITY,
    unresolved_codes: unresolved
      .map((item) => item?.id)
      .filter((id) => typeof id === 'string')
      .sort(),
    // 「그것을 다 받아도 미지수가 남는다」의 앞자리. 숫자를 코드에 박지 않고 센다.
    minimum_input_count: minimumInputs.length,
    unresolved_count: unresolved.length,
    separate_taxation_threshold_krw: threshold,
    rate_table: table,
    rate_gap_cases: gapCases,
    // 고정 문장의 근거. 금액이 없으므로 인출 단계를 여는 것이 아니다.
    principal_retaxed_on_withdrawal: true,
    basis_rule_ids: [
      RULE.PENSION_EARLY_WITHDRAWAL_RATE,
      RULE.PENSION_INCOME_RATE_BY_AGE,
      RULE.PENSION_INCOME_RATE_LIFETIME,
      RULE.PENSION_RATE_GAP_QUANTIFIABILITY,
      RULE.PENSION_SEPARATE_TAXATION_ELECTIVE,
      RULE.PENSION_SEPARATE_TAXATION_THRESHOLD,
      RULE.LOCAL_SURTAX,
    ].sort(),
  };
}
