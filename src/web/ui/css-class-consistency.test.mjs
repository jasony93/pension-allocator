import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * 정적 일치성 검사 — `styles.css`가 정의한 클래스와 `class:` 프롭이 실제로
 * 쓰는 클래스 이름을 대조한다.
 *
 * 관리자가 브라우저 실측으로 잡은 이번 버그의 직접 원인은 클래스 이름
 * 불일치가 아니라 `svgEl`로 만든 div가 SVG 네임스페이스에 들어가 CSS가
 * 아예 안 먹힌 것이었지만("이름은 맞는데 원소가 틀렸다"), 관리자가 요청한
 * 대로 **이름 자체가 어긋나는 부류의 회귀**를 잡는 테스트를 별도로 남긴다.
 * jsdom은 레이아웃을 계산하지 않으므로 렌더 크기(0×0) 자체는 이 테스트로
 * 잡을 수 없다 — 그건 브라우저 실측의 몫이다(css-render-size 확인은 사람 또는
 * 별도 E2E 도구가 한다).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..'); // src/web/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.mjs') && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

function cssDefinedClasses(cssText) {
  const classes = new Set();
  const re = /\.([a-zA-Z][\w-]*)/g;
  let m;
  while ((m = re.exec(cssText))) classes.add(m[1]);
  return classes;
}

/** `class:` 프롭에 쓰인 원시 텍스트(따옴표 안쪽)를 전부 뽑는다. */
function classPropRawValues(jsText) {
  const values = [];
  // class: '...'  |  class: "..."  |  class: `...`
  const re = /\bclass\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(jsText))) values.push(m[2]);
  return values;
}

/** 원시 텍스트에서 정적 클래스 토큰을 뽑는다 — 템플릿 보간과 삼항 안의 문자열 리터럴 둘 다. */
function extractClassTokens(raw) {
  const tokens = new Set();

  // ${...} 안에 있는 문자열 리터럴('...'/"...")도 후보로 줍는다(삼항 분기 클래스).
  const nestedStringRe = /['"]([a-zA-Z][\w -]*)['"]/g;
  let nm;
  while ((nm = nestedStringRe.exec(raw))) {
    for (const t of nm[1].trim().split(/\s+/)) if (t) tokens.add(t);
  }

  // ${...} 블록을 지운 나머지(항상 존재하는 정적 부분)를 공백으로 분리한다.
  const staticPart = raw.replace(/\$\{[^}]*\}/g, ' ');
  for (const t of staticPart.trim().split(/\s+/)) {
    if (!t || !/^[a-zA-Z][\w-]*$/.test(t)) continue;
    // `warning-note-${severity}`처럼 보간이 클래스 접미사로 바로 붙는 경우,
    // ${...} 제거 후 "warning-note-"처럼 끝이 하이픈인 미완성 조각이 남는다.
    // 이건 실제 클래스가 아니라 접두사일 뿐이라 정적으로 완성할 수 없다 —
    // 완성된 형태(`warning-note-warning` 등)는 위 nestedStringRe나 다른
    // 호출부의 리터럴 문자열 쪽에서 이미 잡힌다. 오탐을 피하려고 건너뛴다.
    if (t.endsWith('-')) continue;
    tokens.add(t);
  }

  return tokens;
}

test('every literal class used in a `class:` prop exists in styles.css', () => {
  const cssText = readFileSync(path.join(webRoot, 'styles.css'), 'utf8');
  const cssClasses = cssDefinedClasses(cssText);

  const jsFiles = walk(webRoot);
  const missing = [];

  for (const file of jsFiles) {
    const text = readFileSync(file, 'utf8');
    for (const raw of classPropRawValues(text)) {
      for (const token of extractClassTokens(raw)) {
        if (!cssClasses.has(token)) {
          missing.push({ file: path.relative(webRoot, file), token });
        }
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `class: 프롭이 styles.css에 없는 클래스를 참조합니다:\n${missing.map((m) => `  ${m.file}: "${m.token}"`).join('\n')}`,
  );
});
