import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createThemeController,
  readStoredTheme,
  persistTheme,
  applyThemeAttribute,
  THEME_STORAGE_KEY,
  THEME_VALUES,
} from './theme.js';
import { THEME_CONTROL } from '../copy.js';

/**
 * 테마 저장의 제약 넷을 **테스트로 고정한다** — 관리자 판정 D23이 승인하며 건 것들.
 *
 * 특히 두 번째("사용자가 누르기 전에는 아무것도 쓰지 않는다")가 중요하다.
 * 이 제품은 "입력한 값은 브라우저 밖으로 나가지 않습니다"를 화면에서 약속하고
 * 있고, 생년월일 항목에는 "이 필드가 그 관행을 깨는 첫 항목이 되지 않게 한다"고
 * 적혀 있다. 테마 키가 그 관행을 깨는 범위는 **명시적으로 선택한 사람**으로
 * 한정되어야 하며, 그 한정은 코드에 한 줄로 존재하는 것이라 조용히 사라질 수
 * 있다. 그래서 사람이 기억하는 대신 이 파일이 지킨다.
 */

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      writes.push(['set', k, v]);
      data.set(k, v);
    },
    removeItem: (k) => {
      writes.push(['remove', k]);
      data.delete(k);
    },
  };
}

function fakeRoot() {
  const attrs = new Map();
  return {
    attrs,
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
  };
}

test('제약 1 — 키가 하나뿐이고 값이 셋뿐이다', () => {
  assert.equal(THEME_STORAGE_KEY, 'theme');
  assert.deepEqual([...THEME_VALUES].sort(), ['dark', 'light', 'system']);
  // 자유 문자열이 아니므로 입력값이 흘러들 통로가 없다.
  const storage = fakeStorage();
  persistTheme(storage, 'dark');
  assert.deepEqual([...storage.data.keys()], ['theme']);
});

test('제약 1 — 아는 값 셋이 아니면 저장된 값을 믿지 않고 기본값으로 접는다', () => {
  assert.equal(readStoredTheme(fakeStorage({ theme: '{"salary":60000000}' })), 'system');
  assert.equal(readStoredTheme(fakeStorage({ theme: 'DARK' })), 'system');
  assert.equal(readStoredTheme(fakeStorage()), 'system');
  assert.equal(readStoredTheme(null), 'system');
});

test('제약 2 — 사용자가 누르기 전에는 아무것도 쓰지 않는다', () => {
  const storage = fakeStorage();
  const root = fakeRoot();
  // 첫 방문자: 페이지가 뜨고 컨트롤러가 만들어졌을 뿐 아무도 누르지 않았다.
  const controller = createThemeController({ storage, root });
  assert.equal(controller.value, 'system');
  assert.deepEqual(storage.writes, [], '첫 방문자에게 저장이 일어났습니다');
  assert.equal(storage.data.size, 0);
  // 읽기 경로를 여러 번 지나도 마찬가지다.
  readStoredTheme(storage);
  readStoredTheme(storage);
  assert.deepEqual(storage.writes, []);
});

test('제약 2 — 저장은 오직 `chooseTheme()`에서만 일어난다', () => {
  const storage = fakeStorage();
  const controller = createThemeController({ storage, root: fakeRoot() });
  controller.chooseTheme('dark');
  assert.deepEqual(storage.writes, [['set', 'theme', 'dark']]);
});

test('제약 3 — `자동`을 고르면 키를 지운다. 되돌릴 수 없는 저장을 만들지 않는다', () => {
  const storage = fakeStorage();
  const root = fakeRoot();
  const controller = createThemeController({ storage, root });
  controller.chooseTheme('dark');
  assert.equal(storage.getItem('theme'), 'dark');
  controller.chooseTheme('system');
  assert.equal(storage.getItem('theme'), null, '키가 남아 있으면 운영체제 설정으로 영영 못 돌아간다');
  assert.deepEqual(storage.writes.at(-1), ['remove', 'theme']);
});

test('제약 4 — 테마 모듈이 계측을 부르지 않고, 계측 스키마에 테마 자리가 없다', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const themeSrc = strip(readFileSync(path.join(here, 'theme.js'), 'utf8'));
  assert.ok(!/analytics|track\(/.test(themeSrc), '테마 모듈이 계측을 참조합니다');
  const analyticsSrc = strip(readFileSync(path.join(here, '../analytics.js'), 'utf8'));
  assert.ok(!/theme/i.test(analyticsSrc), '계측 스키마에 테마가 들어왔습니다');
});

// --- 세 가지 상태 (design-system 8.1절) -------------------------------------

test('`자동`은 루트에 아무 표시도 남기지 않는다 — 그래야 prefers-color-scheme만이 결정한다', () => {
  const root = fakeRoot();
  applyThemeAttribute(root, 'dark');
  assert.equal(root.getAttribute('data-theme'), 'dark');
  applyThemeAttribute(root, 'system');
  assert.equal(root.getAttribute('data-theme'), null, 'data-theme="system"을 쓰면 CSS의 세 블록 계약이 무너진다');
});

test('명시적 라이트·다크는 각각의 표시를 남긴다', () => {
  const root = fakeRoot();
  const controller = createThemeController({ storage: fakeStorage(), root });
  controller.chooseTheme('light');
  assert.equal(root.getAttribute('data-theme'), 'light');
  controller.chooseTheme('dark');
  assert.equal(root.getAttribute('data-theme'), 'dark');
});

test('저장된 값이 있으면 컨트롤러가 그 상태로 시작한다', () => {
  const root = fakeRoot();
  const controller = createThemeController({ storage: fakeStorage({ theme: 'light' }), root });
  assert.equal(controller.value, 'light');
  assert.equal(root.getAttribute('data-theme'), 'light');
});

test('저장소 접근이 예외를 던져도 화면은 산다 — 테마가 계산 기능을 막지 않는다', () => {
  const hostile = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  const root = fakeRoot();
  const controller = createThemeController({ storage: hostile, root });
  assert.equal(controller.value, 'system');
  controller.chooseTheme('dark');
  assert.equal(root.getAttribute('data-theme'), 'dark', '저장이 막혀도 이번 세션의 선택은 살아 있다');
});

// --- 3택 · 첫 페인트 전 적용 -------------------------------------------------

test('2택 토글이 아니라 3택이다 — 토글은 `자동`을 표현할 수 없다', () => {
  assert.equal(THEME_CONTROL.options.length, 3);
  assert.deepEqual(
    THEME_CONTROL.options.map((o) => o.label),
    ['자동', '밝게', '어둡게'],
  );
  assert.equal(THEME_CONTROL.options[0].value, 'system', '기본 선택은 `자동`이다');
});

test('저장된 테마가 첫 페인트 이전에 적용되고, 그 스크립트는 그 한 가지만 한다', () => {
  // 렌더 후에 JS로 바꾸면 어두운 화면을 기대한 사용자에게 흰 화면이 한 프레임
  // 번쩍인다. 그래서 `<head>`의 **동기** 스크립트여야 한다.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(path.join(here, '../index.html'), 'utf8');
  const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  const script = /<script>([\s\S]*?)<\/script>/.exec(head);
  assert.ok(script, '<head>에 인라인 테마 스크립트가 없습니다 — 첫 페인트에 흰 화면이 번쩍입니다');
  const body = script[1];
  assert.ok(/getItem\(['"]theme['"]\)/.test(body), '키 하나를 읽어야 합니다');
  assert.ok(/setAttribute\(['"]data-theme['"]/.test(body), '루트에 표시를 찍어야 합니다');
  // **아무것도 쓰지 않는다** — 이 스크립트가 제약 2를 깨는 가장 쉬운 자리다.
  assert.ok(!/setItem|removeItem/.test(body), '첫 페인트 스크립트가 저장소에 씁니다');
  assert.ok(!/defer|async/.test(head.slice(head.indexOf('<script'), head.indexOf('<script') + 40)));
  // 스타일시트보다 뒤에 와야 토큰이 이미 정의된 상태에서 표시가 찍힌다.
  assert.ok(head.indexOf('styles.css') < head.indexOf('<script>'));
});
