import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * 토큰 선언 순서의 **기계 검사** — design-system 8.2절이 "구현 계약"이라고 부른 것.
 *
 * 여기서 잡는 사고는 눈으로는 절대 안 보인다. 색을 미디어 쿼리 안에서만 정의하면
 * **두 조건 중 어느 것도 참이 아닌 실행 환경**에서 그 토큰이 비고, 글자가 반대쪽
 * 배경에 얹힌다. 개발자의 기계는 대개 둘 중 하나에 걸리므로 개발 중에는 멀쩡해
 * 보인다. 그래서 사람이 보는 대신 이 파일이 센다.
 *
 * 브라우저에서 실제로 계산된 색(`getComputedStyle`)을 재는 것은
 * `browser/theme.browser.mjs`가 한다. 둘 다 필요하다 — 이쪽은 "선언이 규약대로인가",
 * 저쪽은 "그래서 화면에 무엇이 나오는가"를 본다.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
// 주석을 먼저 걷어낸다 — 이 파일의 주석에는 대비값(`3:1`)과 hex가 그대로
// 적혀 있어서, 걷어내지 않으면 검사가 설명문을 선언으로 읽는다.
const CSS = readFileSync(path.join(here, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** `선택자 { … }` 블록 하나를 통째로 집는다(중첩 없는 단순 CSS 전제). */
function blockFor(selectorPattern, source = CSS) {
  const re = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`);
  const m = re.exec(source);
  return m ? m[1] : null;
}

function declarations(blockText) {
  const map = new Map();
  for (const raw of blockText.split(';')) {
    const [name, ...rest] = raw.split(':');
    if (!rest.length) continue;
    const key = name.trim();
    if (!key.startsWith('--') && key !== 'color-scheme') continue;
    map.set(key, rest.join(':').trim().toLowerCase());
  }
  return map;
}

const MEDIA_DARK = CSS.slice(CSS.indexOf('@media (prefers-color-scheme: dark)'));
const rootBlock = declarations(blockFor(':root', CSS.slice(0, CSS.indexOf('@media'))));
const mediaDarkBlock = declarations(blockFor(':root:where\\(:not\\(\\[data-theme="light"\\]\\)\\)', MEDIA_DARK));
const explicitDarkBlock = declarations(blockFor(':root\\[data-theme="dark"\\]', CSS));
const printBlock = declarations(blockFor(':root, :root\\[data-theme="dark"\\], :root\\[data-theme="light"\\]', CSS));

test('맨바닥 `:root`가 라이트 팔레트 전체를 갖는다 — 어떤 조건도 참이 아닐 때의 값이다', () => {
  assert.ok(rootBlock, ':root 블록을 찾지 못했습니다');
  assert.equal(rootBlock.get('color-scheme'), 'light');
  assert.ok(rootBlock.size > 30, `토큰이 너무 적습니다: ${rootBlock.size}`);
});

test('미디어 쿼리·[data-theme] 안에만 존재하는 색이 하나도 없다 (8.2절 규칙 1)', () => {
  // 이 규칙 하나가 "지정 없음" 상태에서 글자가 반대쪽 배경에 얹히는 사고를
  // 구조적으로 막는다. 하나라도 새면 그 색은 어떤 실행 환경에서 빈 값이 된다.
  const orphans = [];
  for (const block of [mediaDarkBlock, explicitDarkBlock, printBlock]) {
    for (const name of block.keys()) {
      if (name === 'color-scheme') continue;
      if (!rootBlock.has(name)) orphans.push(name);
    }
  }
  assert.deepEqual(orphans, [], `맨바닥 :root에 값이 없는 색: ${orphans.join(', ')}`);
});

test('미디어 블록의 선택자가 `:root:where(:not([data-theme="light"]))` 형태다 (8.2절 규칙 4)', () => {
  // `:not(...)`이 없으면 **명시적 라이트가 OS 다크를 못 이기고**, `:where()`가
  // 없으면 (0,2,0)끼리 부딪혀 승부가 선언 순서에 걸린다 — 누가 블록을 옮기면
  // 조용히 깨진다. 두 부분이 각각 일하므로 둘 다 있어야 한다.
  assert.ok(mediaDarkBlock, '미디어 다크 블록을 찾지 못했습니다 — 선택자 형태가 바뀌었을 수 있습니다');
  assert.ok(
    /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:where\(:not\(\[data-theme="light"\]\)\)/.test(CSS),
    '미디어 블록의 선택자가 계약 형태가 아닙니다',
  );
});

test('두 다크 블록의 선언이 한 글자도 어긋나지 않는다 — 같은 값을 두 곳에 적는 것이 이 계약의 비용이다', () => {
  assert.deepEqual(
    Object.fromEntries([...explicitDarkBlock].sort()),
    Object.fromEntries([...mediaDarkBlock].sort()),
    'OS 다크(미디어)와 명시적 다크가 다른 색을 냅니다 — 사용자가 어둡게를 고른 것만으로 색이 달라집니다',
  );
});

test('`color-scheme`이 테마와 함께 바뀐다 (8.2절 규칙 3)', () => {
  // 빠뜨리면 다크 화면에 밝은 스크롤바와 밝은 기본 폼 컨트롤이 남는다.
  assert.equal(mediaDarkBlock.get('color-scheme'), 'dark');
  assert.equal(explicitDarkBlock.get('color-scheme'), 'dark');
  assert.equal(printBlock.get('color-scheme'), 'light');
});

test('인쇄는 테마와 무관하게 라이트 팔레트를 강제한다 (8.5절)', () => {
  // 대부분의 프린터 설정에서 배경색이 빠진다. 그러면 다크용 밝은 글자색이 흰
  // 종이에 얹혀 **고지가 통째로 사라진다.**
  const mismatches = [];
  for (const [name, value] of rootBlock) {
    if (name === 'color-scheme' || !name.startsWith('--')) continue;
    if (!/^(#|rgba?\()/.test(value)) continue; // 간격·반경은 인쇄 블록에 다시 적지 않는다
    if (printBlock.get(name) !== value) mismatches.push(`${name}: ${value} vs ${printBlock.get(name)}`);
  }
  assert.deepEqual(mismatches, [], `인쇄 블록이 라이트 값과 다릅니다:\n${mismatches.join('\n')}`);
});

test('인쇄 블록이 `[data-theme="dark"]`보다 뒤에 있다 — 같은 명시도라 순서가 승부를 가른다', () => {
  assert.ok(CSS.indexOf('@media print') > CSS.indexOf(':root[data-theme="dark"]'));
});

// ---------------------------------------------------------------------------
// 대비 계층 — design-system 3.5.3절은 이것이 "기계적으로 검사 가능하다"고 적었다
// ---------------------------------------------------------------------------

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * linear(((n >> 16) & 255) / 255) + 0.7152 * linear(((n >> 8) & 255) / 255) + 0.0722 * linear((n & 255) / 255);
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  light: rootBlock,
  dark: explicitDarkBlock,
};

for (const [themeName, tokens] of Object.entries(THEMES)) {
  const raised = tokens.get('--surface-raised');
  const base = tokens.get('--surface-base');
  const sunken = tokens.get('--surface-sunken');

  test(`[${themeName}] 값을 나르는 색은 표면 대비 3:1 이상이다`, () => {
    for (const name of ['--data-pension', '--data-irp', '--data-isa', '--data-unallocated']) {
      for (const [surfaceName, surface] of [['카드', raised], ['페이지', base]]) {
        const ratio = contrast(tokens.get(name), surface);
        assert.ok(ratio >= 3, `${name} vs ${surfaceName} = ${ratio.toFixed(2)} (< 3)`);
      }
    }
  });

  test(`[${themeName}] 뜻을 나르는 경계(data-excluded)가 3:1 이상이다 — WCAG 1.4.11`, () => {
    // 배제 계좌의 점선은 "이 계좌는 계산 대상이 아니다"를 나르는 경계다.
    // 초판은 `border-subtle`(대비 1.27)이었다.
    const ratio = contrast(tokens.get('--data-excluded'), raised);
    assert.ok(ratio >= 3, `--data-excluded vs 카드 = ${ratio.toFixed(2)}`);
  });

  test(`[${themeName}] 아무것도 나르지 않는 색은 2:1 미만이다 — 자리표시자는 값의 잉크를 입을 수 없다`, () => {
    for (const name of ['--data-placeholder', '--data-track']) {
      const ratio = contrast(tokens.get(name), raised);
      assert.ok(ratio < 2, `${name} vs 카드 = ${ratio.toFixed(2)} (>= 2 — 값으로 읽힌다)`);
    }
  });

  test(`[${themeName}] 2:1과 3:1 사이가 비어 있다 — 이 틈이 "값이다/아직 값이 아니다"를 가른다`, () => {
    const dataTokens = [...tokens.keys()].filter((n) => n.startsWith('--data-') && !n.endsWith('-side'));
    const inGap = dataTokens.filter((n) => {
      const r = contrast(tokens.get(n), raised);
      return r >= 2 && r < 3;
    });
    assert.deepEqual(inGap, [], `대비 2~3 대역에 색이 들어왔습니다: ${inGap.join(', ')}`);
  });

  test(`[${themeName}] D23 — 입력 필드 경계가 어느 방향으로도 3:1을 넘는다`, () => {
    // 입력 필드의 경계는 **뜻을 나르는 경계**다: 어디까지가 입력 칸인지를 그것만이
    // 말한다. 어느 방향으로도 3:1을 못 넘으면 저시력 사용자에게 칸의 존재가
    // 사라진다. 초판은 라이트 1.44 / 다크 1.93이었다.
    const border = tokens.get('--border-strong');
    const inside = contrast(border, sunken);
    const outside = contrast(border, raised);
    assert.ok(inside >= 3, `border-strong vs 필드 안쪽 = ${inside.toFixed(2)}`);
    assert.ok(outside >= 3, `border-strong vs 카드 = ${outside.toFixed(2)}`);
  });

  test(`[${themeName}] 고지 요소가 전부 4.5:1 이상이다 (8.4절 실측표를 다시 잰다)`, () => {
    const t = (n) => tokens.get(n);
    const rows = [
      ['DisclosureBanner 본문 (고지 ①②)', '--text-secondary', '--state-info-subtle', 4.5],
      ['LawChip 텍스트 (고지 ③)', '--text-secondary', '--surface-sunken', 4.5],
      ['LawChip 호버', '--text-secondary', '--accent-subtle', 4.5],
      ['BasisBlock 원문 링크 (고지 ③)', '--text-link', '--surface-raised', 4.5],
      ['AssumptionBlock · LimitNote (고지 ④⑤)', '--text-secondary', '--surface-raised', 4.5],
      ['ProposedBadge (고지 ⑥)', '--state-info', '--state-info-subtle', 4.5],
      ['AmountCard 조건 캡션 (P1)', '--text-secondary', '--surface-raised', 4.5],
      ['WarningNote 본문', '--text-secondary', '--state-warning-subtle', 4.5],
      ['EligibilityNote 본문', '--text-secondary', '--state-info-subtle', 4.5],
      ['InlineAlert(error) 제목', '--text-primary', '--state-error-subtle', 4.5],
      ['InlineAlert(error) 본문', '--text-secondary', '--state-error-subtle', 4.5],
      ['오류 캡션', '--state-error', '--surface-raised', 4.5],
      ['WarningNote 좌측 바 (비텍스트)', '--state-warning', '--state-warning-subtle', 3],
      ['EligibilityNote 좌측 바 (비텍스트)', '--state-info', '--state-info-subtle', 3],
      ['플레이스홀더 (비텍스트 정보)', '--text-muted', '--surface-sunken', 3],
    ];
    const failures = rows
      .map(([label, fg, bg, floor]) => ({ label, ratio: contrast(t(fg), t(bg)), floor }))
      .filter((r) => r.ratio < r.floor)
      .map((r) => `${r.label}: ${r.ratio.toFixed(2)} < ${r.floor}`);
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}

// ---------------------------------------------------------------------------
// 흩어진 hex — 색을 정하는 자리는 토큰 블록뿐이어야 한다
// ---------------------------------------------------------------------------

test('토큰 블록 밖의 CSS가 raw hex로 색을 정하지 않는다', () => {
  // 하나라도 남으면 테마가 바뀔 때 그 자리만 옛 색으로 남는다 — 화면에 두 팔레트가
  // 섞이는 경로다.
  const afterTokens = CSS.slice(CSS.indexOf('* { box-sizing'), CSS.indexOf('@media print'));
  const stray = afterTokens.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(stray, [], `토큰 블록 밖에 hex가 있습니다: ${stray.join(', ')}`);
});

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('JS가 색을 계산하지 않는다 — 공유 이미지(항상 라이트)만 예외다', () => {
  // design-system 5.20절: 압출 측면 색은 **전용 토큰**이고 "구현은 산식을 다시
  // 돌리지 않는다". 초판처럼 "명도 −18%"를 코드가 계산하고 있으면 계좌 색이
  // 바뀌어도 측면이 따라오지 않아 화면에 두 세대의 색이 섞인다.
  const offenders = [];
  for (const file of walk(here)) {
    const rel = path.relative(here, file).replace(/\\/g, '/');
    if (rel === 'ui/share.js') continue; // 공유 이미지는 항상 라이트로 렌더한다(아래 검사가 따로 본다)
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const hex of text.match(/['"`]#[0-9a-fA-F]{3,8}['"`]/g) ?? []) offenders.push(`${rel}: ${hex}`);
    for (const fn of text.match(/\b(?:brightness|saturate|hsl|oklch|color-mix)\s*\(/g) ?? []) offenders.push(`${rel}: ${fn}`);
  }
  assert.deepEqual(offenders, [], `UI 코드가 색을 직접 정하거나 계산합니다:\n${offenders.join('\n')}`);
});

test('공유 이미지는 테마를 읽지 않는다 — 항상 라이트로 렌더된다 (8.5절)', () => {
  // 수신자의 환경을 알 수 없고, 이미지에 실린 고지가 반드시 읽혀야 한다.
  // 발신자의 테마가 수신자의 가독성을 정하게 두지 않는다.
  const share = readFileSync(path.join(here, 'ui/share.js'), 'utf8');
  assert.ok(!/getComputedStyle|data-theme|prefers-color-scheme|var\(--/.test(share), '공유 이미지가 화면 테마를 참조합니다');
  const light = new Set([...rootBlock.values()]);
  const used = share.match(/ctx\.fillStyle = '(#[0-9a-f]{6})'/g)?.map((s) => s.slice(-8, -1)) ?? [];
  assert.ok(used.length > 0, '공유 이미지가 색을 하나도 지정하지 않습니다');
  for (const hex of used) assert.ok(light.has(hex), `공유 이미지의 ${hex}가 라이트 토큰이 아닙니다`);
});
