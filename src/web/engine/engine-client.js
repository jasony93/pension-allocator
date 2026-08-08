/**
 * 엔진 경계 — 화면이 계산을 요청하는 유일한 통로.
 *
 * **교체 완료.** 3단계 구현 중 `calc-engine-dev`가 병렬로 실제 엔진
 * (`src/engine/`)을 내놓았다 — 이 파일이 병렬 작업이 끝나면 목을 교체하는
 * 자리다(`web-dev.md`). 호출 시그니처는 계약이 고정한 대로다.
 *
 * `mock-engine.js`는 지우지 않고 남겨 둔다 — 회귀 테스트 fixture이자, 실제
 * 엔진이 계약과 다르게 동작할 때 대조할 기준(계약을 얼마나 충실히 이해하고
 * 있었는지)으로 쓴다. 실행 경로에서는 더 이상 이 파일을 부르지 않는다.
 *
 * **발견한 것.** 교체 직전 실제 엔진에 요청을 넣어 보니 `schema_version_mismatch`
 * 오류가 났다 — `engine-interface.md`가 3단계 구현 중 `2.1.0` → `3.0.0`으로
 * 이미 개정되어 있었다(커밋 `c190ff2`, "Engine contract: drop the delta sign
 * guarantee, bump to 3.0.0"). `Plan.delta_vs_baseline_krw`의 "0 이하" 보장이
 * 빠졌다 — 게이트 2 D10이 기본안을 `fund_use_horizon`의 함수로 바꾸면서 깨진
 * 불변식이었는데 아무도 잡지 못했었다고 커밋 메시지가 적고 있다. 이 파일과
 * `state/store.js`가 보내던 `'2.1.0'`은 이 개정 전 버전이었다 — 실제 엔진과
 * 맞춰 `'3.0.0'`으로 올렸다. 이 사실은 최종 보고에도 남긴다.
 */
import {
  compute as engineCompute,
  computeFundUseHorizonBoundaries as engineBoundaries,
  SCHEMA_VERSION,
} from '../../engine/index.mjs';

// 요청을 만드는 쪽(state/store.js)이 이 값을 그대로 쓴다 — 문자열을 두 곳에
// 따로 적어 두면 다음 버전 올림에서 한쪽만 바뀌는 사고가 난다.
export { SCHEMA_VERSION };

let rulesetsCache = null;

/**
 * `data/tax-rules/*.json`을 읽어 `RulesetBundle`(파일명 키의 맵)로 만든다.
 * 브라우저 fetch를 쓴다 — Node 테스트에서는 이 함수를 쓰지 않고 rulesets를 직접
 * 주입한다(mock-engine.test.mjs 참고).
 */
// import.meta.url을 기준으로 삼는다 — 이 파일은 src/web/engine/에 있고
// 룰셋은 저장소 루트의 data/tax-rules/에 있다. 페이지가 어떤 경로에서
// 서빙되든(루트든 서브패스든) 항상 같은 상대 위치를 가리키게 하려는 것이다.
// 페이지 URL 기준 상대경로(예: "./data/...")를 썼다면 index.html이 src/web/
// 아래에서 서빙되는 순간 404가 난다 — 실제로 브라우저에서 확인된 버그였다.
const RULESET_DIR = new URL('../../../data/tax-rules/', import.meta.url);

export async function loadRulesets({ force = false } = {}) {
  if (rulesetsCache && !force) return rulesetsCache;
  const [current, proposed] = await Promise.all([
    fetch(new URL('2026.json', RULESET_DIR)).then((r) => {
      if (!r.ok) throw new Error(`ruleset_load_failed: 2026.json (${r.status})`);
      return r.json();
    }),
    fetch(new URL('2027-proposed.json', RULESET_DIR)).then((r) => {
      if (!r.ok) throw new Error(`ruleset_load_failed: 2027-proposed.json (${r.status})`);
      return r.json();
    }),
  ]);
  rulesetsCache = { '2026.json': current, '2027-proposed.json': proposed };
  return rulesetsCache;
}

export async function compute(request) {
  const rulesets = await loadRulesets();
  return engineCompute(request, rulesets);
}

export async function computeFundUseHorizonBoundaries(request) {
  const rulesets = await loadRulesets();
  return engineBoundaries(request, rulesets);
}
