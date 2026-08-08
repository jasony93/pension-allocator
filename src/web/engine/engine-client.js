/**
 * 엔진 경계 — 화면이 계산을 요청하는 유일한 통로.
 *
 * `calc-engine-dev`의 실제 엔진(`src/engine/`)이 준비되면 아래 두 함수의 구현만
 * 바꾸면 된다. 호출 시그니처(`compute(request, rulesets)` /
 * `computeFundUseHorizonBoundaries(request, rulesets)`)는 `engine-interface.md`가
 * 고정한 계약이므로 이 파일 밖 어디에서도 바뀌지 않는다.
 *
 * 지금은 `mock-engine.js`를 그대로 재노출한다.
 */
import { compute as mockCompute, computeFundUseHorizonBoundaries as mockBoundaries } from './mock-engine.js';

let rulesetsCache = null;

/**
 * `data/tax-rules/*.json`을 읽어 `RulesetBundle`(파일명 키의 맵)로 만든다.
 * 브라우저 fetch를 쓴다 — Node 테스트에서는 이 함수를 쓰지 않고 rulesets를 직접
 * 주입한다(mock-engine.test.mjs 참고).
 */
export async function loadRulesets({ force = false } = {}) {
  if (rulesetsCache && !force) return rulesetsCache;
  const [current, proposed] = await Promise.all([
    fetch('./data/tax-rules/2026.json').then((r) => {
      if (!r.ok) throw new Error(`ruleset_load_failed: 2026.json (${r.status})`);
      return r.json();
    }),
    fetch('./data/tax-rules/2027-proposed.json').then((r) => {
      if (!r.ok) throw new Error(`ruleset_load_failed: 2027-proposed.json (${r.status})`);
      return r.json();
    }),
  ]);
  rulesetsCache = { '2026.json': current, '2027-proposed.json': proposed };
  return rulesetsCache;
}

export async function compute(request) {
  const rulesets = await loadRulesets();
  return mockCompute(request, rulesets);
}

export async function computeFundUseHorizonBoundaries(request) {
  const rulesets = await loadRulesets();
  return mockBoundaries(request, rulesets);
}
