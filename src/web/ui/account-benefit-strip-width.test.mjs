import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * `.account-benefit-strip`의 폭·컨테이너 — D35→D36 재개정(design-system
 * 5.31.2·5.31.3절).
 *
 * **D33의 "카드 내용 폭의 50%"는 폐기됐다.** 소유자가 "반 사이즈로 하란 말
 * 취소"(D35)했고, 관리자 실측이 100% 폭에서 C-2 배분 막대와 겹쳐 읽힌다는
 * 것을 확인했다 — 오독 방지는 **폭이 아니라 컨테이너(배경·테두리 박스)**가
 * 진다. 그래서 폭은 이제 모든 뷰포트에서 카드 내용 폭 그대로(100%)이고,
 * 폭 전용 미디어 쿼리는 없다.
 *
 * jsdom은 레이아웃을 계산하지 않으므로 실제 렌더 폭(px)·컨테이너가 실제로
 * C-2와 구분되어 읽히는지는 이 파일이 아니라 브라우저 실측(dev-server +
 * 스크린샷)이 본다. 이 파일은 그보다 한 걸음 앞에서 **선언 자체**가 옛
 * 값(카드 내용 폭의 50%, 도넛 외경의 50% = 130px 고정)으로 되돌아가지
 * 않았는지를 기계적으로 고정한다.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..'); // src/web/
const CSS = readFileSync(path.join(webRoot, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** `선택자 { … }` 블록 하나를 통째로 집는다. 선택자가 다른 선택자의 접미사로
 * 나타나는 것(예: `.benefit-row-secondary .benefit-meter-track`)을 피하려고
 * 앞에 `{`·`}`·줄바꿈·쉼표 중 하나가 오는 자리에서만 찾는다. */
function blockFor(selectorPattern, source = CSS) {
  const re = new RegExp(`(?:^|[\\n,{}])\\s*${selectorPattern}\\s*\\{([^}]*)\\}`);
  const m = re.exec(source);
  return m ? m[1] : null;
}

test('폭은 카드 내용 폭 그대로다(100%) — D33의 50%는 폐기됐다', () => {
  const block = blockFor('\\.account-benefit-strip');
  assert.ok(block, '.account-benefit-strip 규칙을 찾지 못했습니다');
  assert.match(block, /width:\s*100%/, '폭이 카드 내용 폭 전체를 따라가야 한다(D35·D36)');
});

test('옛 폭 값(카드 내용 폭의 50%, 도넛 외경의 50% = 130px 고정)이 남아 있지 않다', () => {
  const block = blockFor('\\.account-benefit-strip');
  assert.doesNotMatch(block, /width:\s*50%/, '폐기된 50% 폭이 남아 있습니다(D33)');
  assert.doesNotMatch(block, /min-width:\s*240px/, '폐기된 min-width: 240px가 남아 있습니다(D33)');
  assert.doesNotMatch(block, /max-width:\s*130px/, '폐기된 130px 고정폭이 남아 있습니다');
});

test('폭 전용 미디어 쿼리가 없다 — 모든 뷰포트에서 같은 규칙이다(D36)', () => {
  const re = /@media \([^)]*\)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(CSS))) {
    assert.ok(
      !m[1].includes('.account-benefit-strip'),
      '.account-benefit-strip이 여전히 폭 전용 미디어 쿼리 안에 있습니다 — D36으로 폭이 뷰포트와 무관해졌습니다',
    );
  }
});

test('컨테이너 — `surface-overlay` 배경 + 테두리 박스로 오독을 막는다(D35)', () => {
  const block = blockFor('\\.account-benefit-strip');
  assert.ok(block, '.account-benefit-strip 규칙을 찾지 못했습니다');
  assert.match(block, /background:\s*var\(--surface-overlay\)/, 'surface-overlay 배경이 있어야 한다 — surface-sunken은 라이트 IRP 대비 미달로 기각됐다');
  assert.match(block, /border:\s*1px solid var\(--border-subtle\)/, '테두리가 있어야 "별개의 상자"로 읽힌다');
  assert.match(block, /border-radius:\s*var\(--radius-m\)/, '카드 모서리 반경과 같은 규약을 써야 한다');
});

// ---------------------------------------------------------------------------
// 2026-08-11 재수정 — 관리자가 라이트 모드 스크린샷에서 잡은 결함.
// `--surface-overlay`와 `--surface-raised`가 라이트에서 둘 다 `#FFFFFF`였다
// (색조 복귀가 두 표면을 같은 흰색으로 뭉갰다). 그때의 검사는 "테두리가
// 투명하지 않다"만 쟀고 **배경이 뒤 표면과 같은 색인지는 한 번도 묻지
// 않아** 통과하면서 아무것도 증명하지 못했다. 여기서 그 구멍을 메운다 —
// 「배경색 ≠ 뒤 표면색」을 직접 대조하고, 실제 WCAG 상대휘도 대비비로
// 계좌 색 셋(마크)이 이 배경 위에서 3:1을 넘는지 재확인한다
// (`styles-tokens.test.mjs`가 이미 하는 전수 검사와 같은 산식이되, 이
// 위젯이 실제로 쓰는 토큰 값에 직접 건다 — 토큰 이름이 아니라 값이 바뀌는
// 회귀를 잡기 위해서다).
// ---------------------------------------------------------------------------

function tokenBlock(selectorPattern) {
  const re = new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = re.exec(CSS);
  if (!m) return new Map();
  const tokens = new Map();
  for (const decl of m[1].split(';')) {
    const mm = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/.exec(decl);
    if (mm) tokens.set(mm[1], mm[2]);
  }
  return tokens;
}

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * linear(((n >> 16) & 255) / 255) + 0.7152 * linear(((n >> 8) & 255) / 255) + 0.0722 * linear((n & 255) / 255);
}
function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('라이트 모드 — 위젯 배경(surface-overlay)이 카드 배경(surface-raised)과 실제로 다른 값이다', () => {
  const root = tokenBlock(':root');
  const overlay = root.get('--surface-overlay');
  const raised = root.get('--surface-raised');
  assert.ok(overlay && raised, '토큰을 :root에서 읽지 못했습니다');
  assert.notEqual(
    overlay.toLowerCase(),
    raised.toLowerCase(),
    `surface-overlay(${overlay})와 surface-raised(${raised})가 라이트에서 같은 색이면, 이 위젯의 배경이 카드와 구분되지 않는다 — 남는 것은 1px 테두리뿐이고, 그것으로 폭 100%를 정당화한 D35의 전제가 무너진다`,
  );
});

test('라이트 모드 — 계좌 색 셋이 위젯 배경(surface-overlay) 위에서 실제로 3:1 이상이다', () => {
  const root = tokenBlock(':root');
  const overlay = root.get('--surface-overlay');
  for (const name of ['--data-pension', '--data-irp', '--data-isa']) {
    const hex = root.get(name);
    const ratio = contrastRatio(hex, overlay);
    assert.ok(ratio >= 3, `${name}(${hex}) vs surface-overlay(${overlay}) = ${ratio.toFixed(3)} (< 3)`);
  }
});

test('두 축(확정·가정) 사이에 물리적 구분선이 있다(D36)', () => {
  const block = blockFor('\\.benefit-axis-divider');
  assert.ok(block, '.benefit-axis-divider 규칙을 찾지 못했습니다 — 두 축이 배치로 갈라져야 한다');
  assert.match(block, /border-top:\s*1px solid var\(--border-subtle\)/, '구분선은 border-subtle 1px여야 한다');
});

test('축 캡션 클래스(`.benefit-meter-axis-caption`, 장치③)가 정의되어 있다', () => {
  assert.match(CSS, /\.benefit-meter-axis-caption\s*\{/, '막대 아래 축 캡션 클래스가 styles.css에 없습니다');
});

test('트랙 굵기(장치④)는 12px다 — D33의 6px(취소된 "반 사이즈로" 지시의 잔재)가 아니다', () => {
  // 소유자가 D35 1번에서 "반 사이즈로" 지시를 명시로 취소했다. 길이는
  // 100%·두 축으로 커졌는데 굵기가 6px로 남아 있던 것이 관리자가 실측에서
  // 잡은 결함이다 — 브라우저로 6~14px을 비교해 12px을 골랐다
  // (styles.css `.benefit-meter-track` 주석의 실측 근거).
  const block = blockFor('\\.benefit-meter-track');
  assert.ok(block, '.benefit-meter-track 규칙을 찾지 못했습니다');
  assert.match(block, /height:\s*12px/, '트랙 굵기가 12px이어야 한다');
  assert.doesNotMatch(block, /height:\s*6px/, '취소된 D33 지시의 6px로 되돌아가면 안 된다');
});

test('트랙 굵기는 C-2(20px)보다 여전히 얇다 — 두 막대가 하나로 읽히지 않을 굵기 비율을 유지한다', () => {
  const block = blockFor('\\.benefit-meter-track');
  const m = /height:\s*(\d+)px/.exec(block);
  assert.ok(m, '트랙 굵기를 읽지 못했습니다');
  const heightPx = Number(m[1]);
  assert.ok(heightPx < 20, `이 위젯의 트랙(${heightPx}px)이 C-2(20px)보다 얇아야 시각적으로 종속된다`);
  assert.ok(heightPx / 20 <= 0.7, `굵기 비율(${(heightPx / 20).toFixed(2)})이 0.7을 넘으면 D35가 지목한 겹침 위험 구간에 들어간다`);
});
