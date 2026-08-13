// 배포용 단일 파일 빌드.
//
//   node scripts/build.mjs                → dist/index.html
//   node scripts/build.mjs out/other.html → 출력 경로를 바꾼다
//   node scripts/build.mjs --with-note    → 아티팩트 안내문을 포함한다(아래 참고)
//
// `src/web/`의 ESM 모듈을 의존성 순서로 이어붙여 **하나의 모듈 스코프**로 만들고,
// `data/tax-rules/`의 룰셋 JSON을 인라인한다. 나온 HTML 파일 하나만 있으면 서버
// 없이 돌아간다 — GitHub Pages에 그대로 올릴 수 있다(D66). 룰셋을 인라인하므로
// 상대경로 fetch가 없고, 페이지가 어떤 경로에서 서빙되든(루트든 서브패스든)
// 깨지지 않는다.
//
// **`src/`의 동작을 바꾸지 않는다.** 이 스크립트는 이어붙이기·이름 정리만 한다 —
// 계산 로직도, 화면 컴포넌트도 여기서 손대지 않는다.
//
// ── 이름 충돌 ────────────────────────────────────────────────────────────
// 모듈 스코프 하나로 합치므로 최상위 이름이 파일 간에 겹치면 중복 선언이 된다.
// 아래 RENAME 표가 지금까지 발견된 충돌을 개명으로 해소한다. **이 표에 없는
// 충돌이 남아 있으면(엔진에 새 파일이 들어오는 등) 이 스크립트가 예외를 던지고
// 멈춘다** — 조용히 깨진 산출물을 내지 않는다는 것이 이 빌드의 핵심 성질이다.
// 새 충돌이 나면 오류 메시지가 이름을 알려준다. 그 이름을 아래 표에 추가하고,
// 그 이름이 밖으로 내보내지는 값인지(참조하는 자리가 있는지) 확인한 뒤 개명한다.
//
// ── 검사 ─────────────────────────────────────────────────────────────────
// 이 스크립트가 도는 것만으로는 산출물이 실제로 뜨는지 보장하지 않는다.
// `src/web/browser/artifact-build.browser.mjs`가 실제 Chrome으로 이 스크립트의
// 출력을 열어 입력을 채우고 결과가 그려지는지까지 확인한다 — 배포 전 마지막
// 안전망이다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const INCLUDE_NOTE = args.includes('--with-note') || process.env.INCLUDE_ARTIFACT_NOTE === '1';
const OUT = resolve(ROOT, args.find((a) => !a.startsWith('--')) ?? 'dist/index.html');

const idOf = (abs) => relative(ROOT, abs).split('\\').join('/');

// 상대경로 이름 있는 임포트/익스포트(`import { A } from './x.js'`,
// `export { A } from './x.js'`)와 네임스페이스 임포트(`import * as ns from './x.js'`)
// 를 함께 잡는다. **네임스페이스 임포트도 잡아야 하는 이유** — `main.js`가
// `import * as engineClient from './engine/engine-client.js'`를 쓰는데, 이것만으로
// 의존성을 찾으면 이 정규식이 놓쳐 그래프에서 빠질 뻔했다(실제로는 `state/store.js`가
// 같은 파일을 이름 있는 형태로 또 임포트해 우연히 그래프에 들어와 있었다 — 그
// 우연에 기대지 않도록 여기서 직접 잡는다).
const SPEC_RE =
  /(?:^import\s*\{[\s\S]*?\}|^import\s*\*\s*as\s+[A-Za-z_$][\w$]*|^export\s*\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/gm;

const mods = new Map();
(function collect(abs) {
  const id = idOf(abs);
  if (mods.has(id)) return;
  let code = readFileSync(abs, 'utf8');

  // 브라우저는 룰셋을 `fetch`로 읽지만(engine-client.js), 아티팩트에는 서버가
  // 없다 — 룰셋을 파일에 미리 박아 넣고 그것을 돌려주는 함수로 바꿔친다.
  if (id === 'src/web/engine/engine-client.js') {
    const before = code;
    code = code.replace(
      /const RULESET_DIR[\s\S]*?\n}\n/,
      `export async function loadRulesets({ force = false } = {}) {
  if (rulesetsCache && !force) return rulesetsCache;
  rulesetsCache = globalThis.__INLINE_RULESETS__;
  return rulesetsCache;
}
`,
    );
    if (code === before) throw new Error('engine-client 룰셋 로더를 찾지 못했다 — engine-client.js가 바뀌었다면 이 정규식도 맞춰야 한다');
  }

  const deps = [];
  for (const m of code.matchAll(SPEC_RE)) {
    if (!m[1].startsWith('.')) throw new Error(`상대경로가 아닌 임포트: ${m[1]} (${id})`);
    deps.push(resolve(dirname(abs), m[1]));
  }
  mods.set(id, { abs, code, deps: deps.map(idOf) });
  for (const d of deps) collect(d);
})(join(ROOT, 'src', 'web', 'main.js'));

// ── 위상 정렬 ────────────────────────────────────────────────────────────
const order = [];
const state = new Map();
(function visit(id, stack = []) {
  if (state.get(id) === 'done') return;
  if (stack.includes(id)) throw new Error(`순환 의존: ${[...stack, id].join(' → ')}`);
  for (const d of mods.get(id).deps) visit(d, [...stack, id]);
  state.set(id, 'done');
  order.push(id);
})('src/web/main.js');

// ── 이름 충돌 해소 ───────────────────────────────────────────────────────
// 지금까지 발견된 넷. 새 충돌이 나면 아래 "남은 이름 충돌" 검사가 잡아 멈춘다.
const RENAME = {
  'src/engine/compute.mjs': { compute: 'engineCompute', computeFundUseHorizonBoundaries: 'engineBoundaries' },
  // plans.mjs 쪽은 내보내지 않는 내부 상수라 개명해도 밖에서 참조하지 않는다.
  // (eligibility.js 쪽을 바꾸면 그 이름으로 임포트하는 자리에서 별칭 바인딩이
  //  원래 이름을 되살려 다시 충돌한다.)
  'src/engine/plans.mjs': { PENSION_ACCOUNTS: 'PENSION_ACCOUNTS_ENGINE' },
  // 다섯 모듈이 각자 `APPLIED_TO`(또는 `branchOf`) 라는 내부 상수/함수를 쓴다.
  // 진짜 ESM 에서는 스코프가 달라 문제가 없고, 한 스코프로 합치는 이 번들러에서만
  // 겹친다. **모두 내보내지 않는 내부 이름이라 개명해도 밖에서 참조하지 않는다.**
  'src/engine/isa-return.mjs': { APPLIED_TO: 'APPLIED_TO_ISA_RETURN' },
  'src/engine/pension-reference.mjs': { APPLIED_TO: 'APPLIED_TO_PENSION_REF' },
  'src/engine/headline.mjs': { APPLIED_TO: 'APPLIED_TO_HEADLINE' },
  'src/engine/liability-cap.mjs': { branchOf: 'branchOfLiabilityCap' },
  'src/engine/fund-use-horizon.mjs': { APPLIED_TO: 'APPLIED_TO_HORIZON' },
  // 엔진과 화면이 각자 `ISA_INCOME_CHARACTERS` 를 내보낸다(엔진은 룰셋에서 뽑고,
  // 화면은 입력 검증용으로 직접 적는다). **엔진 쪽은 테스트만 임포트하고 실행
  // 경로가 쓰지 않으므로** 엔진 쪽을 개명한다. 내보내는 이름이라도 아래 INV 표가
  // 원래 이름을 되살려 별칭 바인딩이 그대로 맞는다.
  'src/engine/constants.mjs': { ISA_INCOME_CHARACTERS: 'ISA_INCOME_CHARACTERS_ENGINE' },
};

const ident = (n) => new RegExp(`(?<![.\\w$])${n}(?![\\w$])`, 'g');
for (const [id, map] of Object.entries(RENAME)) {
  const m = mods.get(id);
  if (!m) throw new Error(`RENAME 대상이 없다: ${id}`);
  for (const [from, to] of Object.entries(map)) m.code = m.code.replace(ident(from), to);
}

// 각 모듈이 내보내는 **원래 이름** → 합친 뒤의 실제 식별자.
// 코드는 이미 개명된 상태이므로, 개명 맵을 뒤집어 원래 이름을 되찾는다.
const INV = Object.fromEntries(
  Object.entries(RENAME).map(([id, map]) => [id, Object.fromEntries(Object.entries(map).map(([a, b]) => [b, a]))]),
);
const exportsOf = new Map();
for (const id of order) {
  const table = {};
  const code = mods.get(id).code;
  for (const m of code.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    const now = m[1];
    table[INV[id]?.[now] ?? now] = now;
  }
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}\s*(?:from\s*['"]([^'"]+)['"])?\s*;?/gm)) {
    const dep = m[2] ? idOf(resolve(dirname(mods.get(id).abs), m[2])) : null;
    for (const part of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const [orig, alias = orig] = part.split(/\s+as\s+/).map((s) => s.trim());
      table[alias] = dep ? exportsOf.get(dep)[orig] : orig;
    }
  }
  exportsOf.set(id, table);
}

// 이제 남는 충돌이 있으면 멈춘다 — **여기서 죽는 것이 이 빌드의 핵심 안전망이다.**
// 이름을 밝히고, 그 이름을 위 RENAME 표에 추가하는 것이 다음 조치다.
{
  const owner = new Map();
  const bad = [];
  const DECL = /^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  for (const id of order) {
    for (const m of mods.get(id).code.matchAll(DECL)) {
      if (owner.has(m[1])) bad.push(`${m[1]}  (${owner.get(m[1])} ↔ ${id})`);
      else owner.set(m[1], id);
    }
  }
  if (bad.length) {
    throw new Error(
      `이름 충돌 ${bad.length}건 — 아래 이름을 scripts/build.mjs의 RENAME 표에 추가해야 빌드가 다시 돈다:\n  ` +
        bad.join('\n  '),
    );
  }
}

// ── 임포트/익스포트 정리 ─────────────────────────────────────────────────
const chunks = order.map((id) => {
  let code = mods.get(id).code;

  // import * as NS from './x.js'  →  그 모듈의 익스포트로 객체를 만든다.
  code = code.replace(/^import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*['"]([^'"]+)['"]\s*;?/gm, (_, ns, spec) => {
    const dep = idOf(resolve(dirname(mods.get(id).abs), spec));
    const pairs = Object.entries(exportsOf.get(dep)).map(([name, real]) => `${name}: ${real}`);
    return `const ${ns} = { ${pairs.join(', ')} };`;
  });

  // import { A, B as C } from './x.js'  →  이름이 이미 스코프에 있으므로
  // 별칭만 바인딩으로 남긴다.
  //
  // **함정.** 두 모듈이 같은 이름을 내보내고 둘 다 임포트되면, 개명으로 선언
  // 충돌을 없애도 `const 원래이름 = 개명된이름;` 바인딩이 원래 이름을 **다시**
  // 만들어 낸다. 위쪽 충돌 검사는 이 단계 전에 돌므로 그것을 못 본다
  // (실제로 `ISA_INCOME_CHARACTERS` 가 이 경로로 빠져나가 브라우저에서 죽었다).
  // 그래서 **별칭 없이 원래 이름으로 임포트한 것이 개명된 경우에는 바인딩을
  // 만들지 않고 그 모듈 안의 쓰임을 개명된 이름으로 바꾼다.**
  const usageRenames = [];
  code = code.replace(/^import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm, (_, names, spec) => {
    const dep = idOf(resolve(dirname(mods.get(id).abs), spec));
    const binds = names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => {
        const [orig, alias = orig] = n.split(/\s+as\s+/).map((s) => s.trim());
        const real = exportsOf.get(dep)[orig];
        if (!real) throw new Error(`${dep} 가 ${orig} 를 내보내지 않는다 (${id})`);
        if (alias === real) return null;
        if (alias === orig) {
          usageRenames.push([alias, real]);
          return null;
        }
        return `const ${alias} = ${real};`;
      })
      .filter(Boolean);
    return binds.join(' ');
  });
  for (const [from, to] of usageRenames) code = code.replace(ident(from), to);

  code = code.replace(/^export\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?/gm, '');
  code = code.replace(/^export\s*\{[^}]*\}\s*;?/gm, '');
  code = code.replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\s)/gm, '');

  const bare = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/^\s*export\b/m.test(bare)) throw new Error(`처리하지 못한 export: ${id}`);
  if (/^\s*import\b/m.test(bare)) throw new Error(`처리하지 못한 import: ${id}`);
  if (/import\.meta/.test(bare)) throw new Error(`import.meta 가 남았다: ${id}`);

  return `// ───────── ${id} ─────────\n${code.trim()}\n`;
});

// ── 룰셋 인라인 ──────────────────────────────────────────────────────────
const rulesets = {
  '2026.json': JSON.parse(readFileSync(join(ROOT, 'data/tax-rules/2026.json'), 'utf8')),
  '2027-proposed.json': JSON.parse(readFileSync(join(ROOT, 'data/tax-rules/2027-proposed.json'), 'utf8')),
};

// ── 껍데기 조립 ──────────────────────────────────────────────────────────
const css = readFileSync(join(ROOT, 'src/web/styles.css'), 'utf8');
const html = readFileSync(join(ROOT, 'src/web/index.html'), 'utf8');

const headMatch = /<head>([\s\S]*?)<\/head>/.exec(html);
if (!headMatch) throw new Error('src/web/index.html에서 <head>를 찾지 못했다');
// <link rel="stylesheet">는 뺀다 — CSS는 <style>로 인라인하고, 애초에 이 파일은
// src/web/ 밖(dist/, 또는 GitHub Pages 루트)에서 서빙되므로 그 상대경로가 안 맞는다.
// **나머지 <head> 내용(charset·viewport·title·description, 그리고 테마 깜빡임
// 방지 인라인 스크립트)은 그대로 가져온다** — index.html이 바뀌면 이 빌드도
// 자동으로 따라간다. 특히 테마 스크립트를 놓치면 저장된 다크 모드가 첫 페인트에
// 한 프레임 밝게 번쩍인다(design-system 5.30절 · D23).
const headInner = headMatch[1].replace(/[ \t]*<link rel="stylesheet"[^>]*>\s*\n/, '\n').trim();
const langMatch = /<html[^>]*\blang="([^"]*)"/.exec(html);
const lang = langMatch ? langMatch[1] : 'ko';

// 아티팩트용 안내문 — **기본적으로 뺀다.**
//
// 이 안내문은 소유자에게 스크래치패드 미리보기를 보여주려고 넣은 것으로,
// "동작하는 프로토타입 · 마지막 커밋 기준" 같은 내부용 표현을 쓰고 구현 이력
// (입력이 늘고 준 내역)을 설명한다. `screens.md`가 정의한 화면이 아니고, 실제로
// 이 세션에서 두 번 낡았다(이미 사라진 입력을 설명하고 있었다) — 화면이 바뀔
// 때마다 이 텍스트를 따로 손보지 않으면 다시 낡는다. 공개 배포본은 불특정
// 방문자를 향하므로 내부 진행 상황이 아니라 `screens.md`/`copy.js`가 이미
// 다루는 문구(도움말·가정 사항)로 충분해야 한다. 그래서 기본값은 제외다.
//
// 그래도 소유자에게 미리보기를 보여줄 필요가 다시 생길 수 있어 `--with-note`로
// 남겨 둔다 — 이때도 내용은 여기서 다시 한 번 현재 화면과 대조해야 한다(아래
// 문구는 2026-08-13 기준으로 `copy.js`와 대조를 마쳤다).
const artifactNote = `<div class="artifact-note"><div>
<b>동작하는 프로토타입</b> — 마지막 커밋 기준<br>
금액은 <b>만원 단위</b>입니다. <code>5500</code> = 5,500만원이고, 소수점도 받아 <code>123.4567</code>처럼 정확한 금액을 그대로 넣을 수 있습니다.<br>
<b>낼 세금이 없으면 세액공제도 없습니다.</b> 그 한도는 총급여에서 계산하므로 따로 묻지 않습니다 —
다만 다른 소득공제를 반영하지 않아 <b>실제보다 넉넉한 값</b>이고, 화면이 그렇게 적습니다.<br>
<b>근로소득 외 다른 종합소득이 있으면 공제율이 달라집니다.</b> 없으면 추가 입력이 생기지 않습니다.<br>
세액공제액이 같은 구간에서는 <b>연금저축을 먼저</b> 채웁니다 — IRP는 법령이 열거한 사유가 있어야 중도인출이 되기 때문이고, 이 선택으로 공제액이 줄지 않습니다.<br>
<b>「가정 사항」은 접혀 있습니다.</b> 펼치면 중요한 것부터 보이고 나머지도 같은 화면에서 전부 볼 수 있습니다.
오른쪽 위에서 <b>밝게 / 어둡게</b>를 고를 수 있습니다.<br>
세법 룰셋이 이 파일 안에 들어 있고 계산은 이 브라우저 안에서 끝납니다. 생년월일을 포함해 <b>입력값은 어디로도 전송되지 않습니다.</b>
</div></div>`;

const out = `<!doctype html>
<html lang="${lang}">
<head>
${headInner}

<style>
${css}

/* 배너도 페이지 토큰을 쓴다. 하드코딩하면 다크모드에서 이 줄만 밝게 남는다. */
.artifact-note {
  max-width: 1400px; margin: 0 auto; padding: 14px 20px 0;
  font: 14px/1.6 "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, "Segoe UI", system-ui, sans-serif;
  color: var(--text-secondary, #45535d);
}
.artifact-note > div {
  background: var(--surface-raised, #fff);
  border: 1px solid var(--border-subtle, #dbe3e8);
  border-left: 3px solid var(--accent, #1f6feb);
  border-radius: 0 8px 8px 0; padding: 14px 18px;
}
.artifact-note b { color: var(--text-primary, #131a1f); }
.artifact-fail {
  max-width: 1400px; margin: 0 auto; padding: 20px;
  font: 13px/1.6 ui-monospace, Consolas, monospace; color: #9b340a; white-space: pre-wrap;
}
</style>
</head>
<body>
${INCLUDE_NOTE ? artifactNote + '\n' : ''}<div id="app"></div>
<div id="boot-fail" class="artifact-fail"></div>

<script>
globalThis.__INLINE_RULESETS__ = ${JSON.stringify(rulesets)};
globalThis.__SHOW_FAIL__ = function (msg) {
  var el = document.getElementById('boot-fail');
  if (el) el.textContent = '화면을 띄우지 못했습니다 — ' + msg;
};
window.addEventListener('error', function (e) { globalThis.__SHOW_FAIL__(e.message); });
window.addEventListener('unhandledrejection', function (e) {
  var r = e.reason; globalThis.__SHOW_FAIL__((r && (r.stack || r.message)) || r);
});
</script>

<script type="module">
try {
${chunks.join('\n')}
} catch (e) {
  globalThis.__SHOW_FAIL__((e && (e.stack || e.message)) || e);
}
</script>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out, 'utf8');

console.log(`모듈 ${mods.size}개 · 이름 충돌 0 · 순환 0`);
console.log(`출력 ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB → ${relative(ROOT, OUT).split('\\').join('/')}`);
console.log(
  INCLUDE_NOTE
    ? '아티팩트 안내문: 포함됨 (--with-note)'
    : '아티팩트 안내문: 제외됨(공개 배포 기본값 — 내부 미리보기가 필요하면 --with-note)',
);

// ── 계측 설정 확인 ───────────────────────────────────────────────────────
// analytics-config.js가 비어 있으면 이 빌드는 계측을 전송하지 않는다 — 그
// 자체는 정상 동작이지만(analytics.js가 조용히 꺼진 채 동작한다), 아무도
// 모르게 넘어가면 나중에 "왜 방문자 통계가 안 쌓이지"를 처음부터 다시 뒤져야
// 한다. 그래서 빌드가 매번 소리 내어 말한다.
const analyticsConfigSrc = readFileSync(join(ROOT, 'src/web/analytics-config.js'), 'utf8');
const collectUrl = /collectUrl:\s*'([^']*)'/.exec(analyticsConfigSrc)?.[1] ?? '';
const websiteId = /websiteId:\s*'([^']*)'/.exec(analyticsConfigSrc)?.[1] ?? '';
if (!collectUrl || !websiteId) {
  console.warn(
    '[build] 경고: src/web/analytics-config.js의 collectUrl/websiteId가 비어 있다 — ' +
      '이 산출물은 계측 이벤트를 어디로도 보내지 않는다(계산 기능은 정상 동작한다). ' +
      '수집을 시작하려면 자체 호스팅 Umami 인스턴스 정보를 채우고 다시 빌드해야 한다.',
  );
} else {
  console.log(`[build] 계측 수집기 설정됨 — websiteId: ${websiteId}`);
}
