import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RESET_CONFIRM_TITLE, RESET_CONFIRM_BODY, RESET_CONFIRM_ACCEPT, RESET_CONFIRM_CANCEL } from '../copy.js';

/**
 * **브라우저 모달 금지의 정적 검사.**
 *
 * `window.confirm()`은 테스트 환경에서 막히지 않는다 — 그래서 웹 테스트 218건이
 * 전부 통과하는 동안 초기화 버튼이 실사용에서 죽어 있었다. 아티팩트는
 * `sandbox="allow-scripts"` iframe 안에서 도는데 `allow-modals`가 없으면
 * `confirm()`이 **아무것도 띄우지 않고 곧바로 `false`**를 돌려주기 때문이다
 * (브라우저 실측으로 확인했다 — `browser/sandboxed-frame.browser.mjs`).
 *
 * 실행 환경이 조용히 막을 수 있는 장치는 다시 들어오면 안 된다. 사람이 매번
 * 기억하는 대신 이 테스트가 잡는다.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('화면 코드 어디에도 브라우저 모달(confirm·alert·prompt) 호출이 없다', () => {
  const offenders = [];
  for (const file of walk(webRoot)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    // `window.confirm(` / `confirm(` 둘 다. 문자열 안의 `확인` 같은 문구는 걸리지 않는다.
    const re = /(?:^|[^.\w])(?:window\s*\.\s*)?(confirm|alert|prompt)\s*\(/g;
    let m;
    while ((m = re.exec(code))) offenders.push({ file: path.relative(webRoot, file), call: m[1] });
  }
  assert.deepEqual(
    offenders,
    [],
    `브라우저 모달은 샌드박스 iframe에서 조용히 막힌다. 화면 안에서 확인을 받으세요(ui/modal.js):\n${offenders
      .map((o) => `  ${o.file}: ${o.call}()`)
      .join('\n')}`,
  );
});

/**
 * storage 접근도 같은 부류다 — `allow-same-origin` 없는 iframe에서는 **프로퍼티를
 * 읽는 것만으로** SecurityError가 난다. 그 예외가 `main.js`에서 터져 계산 화면이
 * 통째로 뜨지 않는 것을 브라우저에서 확인했다. `typeof`는 이 예외를 막지 못한다.
 */
test('storage는 반드시 예외를 삼키는 통로를 거쳐 읽는다', () => {
  const code = stripComments(readFileSync(path.join(webRoot, 'analytics.js'), 'utf8'));
  const raw = code.match(/(?:^|[^.\w'"`])(?:window\s*\.\s*)?(?:session|local)Storage\b/g) ?? [];
  // `optionalStorage('sessionStorage')`처럼 문자열로 이름을 넘기는 형태만 허용한다.
  assert.deepEqual(raw, [], `storage를 직접 읽으면 샌드박스 iframe에서 앱 전체가 죽는다: ${raw.join(', ')}`);
  assert.ok(code.includes('function optionalStorage'), 'try/catch로 감싼 통로가 있어야 한다');
});

test('초기화 확인 문구는 되돌릴 수 없다는 사실을 말한다', () => {
  // screens.md 3.2절 — "누른 뒤 되돌릴 수 없으므로" 확인을 거친다. 확인 문구가
  // 그 이유를 말하지 않으면 확인 단계가 형식만 남는다.
  assert.ok(RESET_CONFIRM_BODY.includes('되돌릴 수 없'), RESET_CONFIRM_BODY);
  assert.ok(RESET_CONFIRM_TITLE.length > 0 && RESET_CONFIRM_CANCEL.length > 0);
  // 실행 버튼이 무엇을 하는지 라벨만 보고 알 수 있어야 한다 — `예`/`확인`은 안 된다.
  assert.ok(!['예', '확인', 'OK'].includes(RESET_CONFIRM_ACCEPT), RESET_CONFIRM_ACCEPT);
});
