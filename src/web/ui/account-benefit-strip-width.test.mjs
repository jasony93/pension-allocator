import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * `.account-benefit-strip`의 폭 공식 — D33 재개정(design-system 5.31.1절).
 *
 * jsdom은 레이아웃을 계산하지 않으므로 실제 렌더 폭(px)은 이 파일이 아니라
 * `browser/account-benefit-strip.browser.mjs`가 잰다. 이 파일은 그보다 한
 * 걸음 앞에서 **선언 자체**가 옛 값(도넛 외경의 50% → 130px 고정, 태블릿
 * 120px 고정)으로 되돌아가지 않았는지를 기계적으로 고정한다 — 관리자가
 * 세 번째로 이 위젯을 신고했던 근본 원인이 "숫자가 문서와 다르다"는 것이었으므로,
 * 다음에 문서가 또 바뀌면 이 테스트도 반드시 함께 깨져야 한다.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..'); // src/web/
const CSS = readFileSync(path.join(webRoot, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** `선택자 { … }` 블록 하나를 통째로 집는다. */
function blockFor(selectorPattern, source = CSS) {
  const re = new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`);
  const m = re.exec(source);
  return m ? m[1] : null;
}

test('기본 규칙(768px 이상) — 폭은 카드 내용 폭의 50%, 최소 240px이다', () => {
  const block = blockFor('\\.account-benefit-strip');
  assert.ok(block, '.account-benefit-strip 규칙을 찾지 못했습니다');
  assert.match(block, /width:\s*50%/, '폭이 카드 내용 폭의 50%를 따라가야 한다(D33)');
  assert.match(block, /min-width:\s*240px/, '좁은 데스크톱(1024px)에서도 트랙이 진행바로 줄어들지 않도록 최소 240px이 있어야 한다');
});

test('옛 값(도넛 외경의 50% = 130px 고정)이 기본 규칙에 남아 있지 않다', () => {
  const block = blockFor('\\.account-benefit-strip');
  assert.doesNotMatch(block, /max-width:\s*130px/, '폐기된 130px 고정폭이 남아 있습니다');
});

test('모바일(<768px)은 전체 폭이다 — 옛 "높이로 절반을 지킨다" 규칙은 폐기됐다', () => {
  // `max-width: 767px` 미디어 쿼리가 여러 개 있으므로(다른 컴포넌트도 같은
  // 경계를 쓴다), `.account-benefit-strip`을 담은 블록을 직접 찾는다.
  const re = /@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/g;
  let mobileBlock = null;
  let m;
  while ((m = re.exec(CSS))) {
    if (m[1].includes('.account-benefit-strip')) {
      mobileBlock = m[1];
      break;
    }
  }
  assert.ok(mobileBlock, '.account-benefit-strip을 담은 모바일 미디어 쿼리를 찾지 못했습니다');
  const block = blockFor('\\.account-benefit-strip', mobileBlock);
  assert.ok(block, '모바일 미디어 쿼리 안에 .account-benefit-strip 규칙이 있어야 한다');
  assert.match(block, /width:\s*100%/, '모바일에서는 전체 폭이어야 한다');
});

test('태블릿 전용 고정폭(120px)이 더 이상 없다 — 데스크톱과 같은 공식을 쓴다', () => {
  assert.doesNotMatch(
    CSS,
    /max-width:\s*120px/,
    '태블릿 전용 고정값(120px)이 남아 있습니다 — design-system 5.31.1절에서 폐기됐습니다',
  );
  assert.doesNotMatch(
    CSS,
    /min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)\s*\{\s*\.account-benefit-strip/,
    '태블릿 전용 미디어 쿼리 블록이 남아 있으면 안 됩니다(단일 공식으로 통합)',
  );
});

test('축 캡션 클래스(`.benefit-meter-axis-caption`, 장치③)가 정의되어 있다', () => {
  assert.match(CSS, /\.benefit-meter-axis-caption\s*\{/, '막대 아래 축 캡션 클래스가 styles.css에 없습니다');
});

test('트랙 굵기(장치④)는 6px로, C-2(20px)의 절반 미만을 유지한다', () => {
  const block = blockFor('\\.benefit-meter-track');
  assert.ok(block, '.benefit-meter-track 규칙을 찾지 못했습니다');
  assert.match(block, /height:\s*6px/, '폭을 키워도 트랙 굵기는 6px로 남아야 시각적 종속이 유지된다(D33)');
});
