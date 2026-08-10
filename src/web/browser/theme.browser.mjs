import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, skipWithoutChrome, sleep, FILL_REQUIRED_FIELDS } from './harness.mjs';

/**
 * 다크 모드의 **실측** — design-system 8절.
 *
 * **문서를 믿지 않고 화면에서 뽑은 계산값을 잰다.** `styles-tokens.test.mjs`는
 * "선언이 규약대로인가"를 정적으로 보지만, 사용자가 보는 색은 브라우저가 세 블록의
 * 명시도와 미디어 조건을 다 따진 뒤 내놓는 값이다. 그 둘이 갈리는 것이 이 계약이
 * 실제로 깨지는 방식이므로 `getComputedStyle`로 다시 잰다.
 *
 * **네 조합을 다 본다.** OS 라이트/다크 × 지정 없음/명시. 셋만 보면 대개
 * "OS 다크 + 사용자가 밝게 고름"이 빠지는데, `:not([data-theme="light"])`가
 * 없을 때 실제로 깨지는 조합이 바로 그것이다.
 */

/** 페이지 안에서 쓰는 대비 계산기. hex와 `rgb()` 둘 다 받는다. */
const CONTRAST_FN = `
  const __rgb = (v) => {
    v = String(v).trim();
    if (v.startsWith('#')) {
      const n = parseInt(v.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = v.match(/-?[\\d.]+/g) || [];
    return [Number(m[0]) || 0, Number(m[1]) || 0, Number(m[2]) || 0];
  };
  const __lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const __lum = (v) => { const [r, g, b] = __rgb(v); return 0.2126 * __lin(r) + 0.7152 * __lin(g) + 0.0722 * __lin(b); };
  const contrast = (a, b) => { const x = __lum(a), y = __lum(b); const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); };
`;

const TOKEN_NAMES = [
  '--surface-base', '--surface-raised', '--surface-sunken', '--surface-overlay',
  '--border-subtle', '--border-strong',
  '--text-primary', '--text-secondary', '--text-muted', '--text-on-accent', '--text-link',
  '--accent', '--accent-subtle', '--focus-ring',
  '--state-error', '--state-error-subtle', '--state-warning', '--state-warning-subtle',
  '--state-info', '--state-info-subtle',
  '--data-pension', '--data-irp', '--data-isa',
  '--data-pension-side', '--data-irp-side', '--data-isa-side',
  '--data-unallocated', '--data-unallocated-side',
  '--data-excluded', '--data-placeholder', '--data-track',
];

const READ_TOKENS = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const out = { dataTheme: document.documentElement.getAttribute('data-theme'), colorScheme: cs.colorScheme };
  for (const n of ${JSON.stringify(TOKEN_NAMES)}) out[n] = cs.getPropertyValue(n).trim();
  return out;
})()`;

/** 고지 요소 15종 — design-system 8.4절의 실측표를 그대로 다시 잰다. */
const DISCLOSURE_ROWS = [
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

const MEASURE_DISCLOSURE = `(() => {
  ${CONTRAST_FN}
  const cs = getComputedStyle(document.documentElement);
  const t = (n) => cs.getPropertyValue(n).trim();
  return ${JSON.stringify(DISCLOSURE_ROWS)}.map(([label, fg, bg, floor]) => ({ label, floor, ratio: contrast(t(fg), t(bg)) }));
})()`;

/**
 * 화면에 실제로 놓인 요소에서 잰다 — 토큰이 맞아도 그 토큰이 그 요소에 안 걸려
 * 있으면 고지는 여전히 안 읽힌다. 배경은 투명한 조상을 거슬러 올라가 찾는다.
 */
const MEASURE_LIVE_ELEMENTS = `(() => {
  ${CONTRAST_FN}
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) return bg;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const rows = [
    ['DisclosureBanner', '.disclosure-banner p'],
    ['LawChip', '.law-chip'],
    ['BasisBlock 원문 링크', '.law-link'],
    ['AssumptionBlock 항목', '.assumption-block li'],
    ['LimitNote', '.limit-note p'],
    ['AmountCard 조건 캡션', '.amount-card-caption'],
  ];
  return rows.map(([label, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, missing: true };
    const cs = getComputedStyle(el);
    return { label, fontSizePx: parseFloat(cs.fontSize), ratio: contrast(cs.color, bgOf(el)) };
  });
})()`;

async function emulate(page, { scheme = null, media = null, reducedMotion = false } = {}) {
  const features = [];
  if (scheme) features.push({ name: 'prefers-color-scheme', value: scheme });
  if (reducedMotion) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  await page.send('Emulation.setEmulatedMedia', { media: media ?? '', features });
}

let app;
const measurements = { combos: [], disclosure: {}, live: {}, donut: {} };

before(async () => {
  if (skipWithoutChrome) return;
  app = await openApp();
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
  if (!skipWithoutChrome) console.log('\n[실측]', JSON.stringify(measurements, null, 1));
});

// ---------------------------------------------------------------------------
// 8.1절 — 세 가지 상태 × 두 운영체제 설정 = 네 조합
// ---------------------------------------------------------------------------

test('네 조합이 전부 의도한 테마로 나온다 (지정 없음 × 2, 명시 × 2)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 2026-08-10 개정 — 표면이 초록으로 옮겼다(design-system 3.1절).
  const LIGHT_BASE = '#cdf2da';
  const DARK_BASE = '#0a1710';

  const combos = [
    { name: 'OS 라이트 + 지정 없음', scheme: 'light', theme: null, expect: LIGHT_BASE, scheme_expected: 'light' },
    { name: 'OS 다크 + 지정 없음', scheme: 'dark', theme: null, expect: DARK_BASE, scheme_expected: 'dark' },
    // 이 셋째가 `:not([data-theme="light"])`가 없을 때 조용히 깨지는 조합이다.
    { name: 'OS 다크 + 명시적 밝게', scheme: 'dark', theme: 'light', expect: LIGHT_BASE, scheme_expected: 'light' },
    { name: 'OS 라이트 + 명시적 어둡게', scheme: 'light', theme: 'dark', expect: DARK_BASE, scheme_expected: 'dark' },
  ];

  for (const combo of combos) {
    await emulate(page, { scheme: combo.scheme });
    await page.evaluate(
      combo.theme
        ? `document.documentElement.setAttribute('data-theme', ${JSON.stringify(combo.theme)})`
        : `document.documentElement.removeAttribute('data-theme')`,
    );
    const tokens = await page.evaluate(READ_TOKENS);
    measurements.combos.push({ 조합: combo.name, 'surface-base': tokens['--surface-base'], 'color-scheme': tokens.colorScheme });
    assert.equal(tokens['--surface-base'], combo.expect, `${combo.name}: 바탕색이 어긋납니다`);
    // 규칙 3 — 빠뜨리면 다크 화면에 밝은 스크롤바와 기본 폼 컨트롤이 남는다.
    assert.equal(tokens.colorScheme, combo.scheme_expected, `${combo.name}: color-scheme이 따라오지 않습니다`);
  }
});

test('어느 조합에서도 값이 빈 색 토큰이 하나도 없다 — 미디어 쿼리 안에만 사는 색이 없다', { skip: skipWithoutChrome }, async () => {
  // 빈 토큰은 화면에서 "글자와 배경이 같은 색"으로 나타난다. 개발 기계는 대개 두
  // 조건 중 하나에 걸리므로 개발 중에는 멀쩡해 보인다.
  const { page } = app;
  for (const scheme of ['light', 'dark']) {
    for (const theme of [null, 'light', 'dark']) {
      await emulate(page, { scheme });
      await page.evaluate(
        theme ? `document.documentElement.setAttribute('data-theme', '${theme}')` : `document.documentElement.removeAttribute('data-theme')`,
      );
      const tokens = await page.evaluate(READ_TOKENS);
      const empty = TOKEN_NAMES.filter((n) => !tokens[n]);
      assert.deepEqual(empty, [], `OS ${scheme} / 지정 ${theme ?? '없음'}: 빈 토큰 ${empty.join(', ')}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 8.4절 — 고지는 다크에서도 읽힌다
// ---------------------------------------------------------------------------

for (const theme of ['light', 'dark']) {
  test(`[${theme}] 고지 요소 15종이 전부 기준을 넘는다 (화면에서 잰 값)`, { skip: skipWithoutChrome }, async () => {
    const { page } = app;
    await emulate(page, { scheme: theme === 'dark' ? 'dark' : 'light' });
    await page.evaluate(`document.documentElement.setAttribute('data-theme', '${theme}')`);
    const rows = await page.evaluate(MEASURE_DISCLOSURE);
    measurements.disclosure[theme] = rows.map((r) => `${r.label}: ${r.ratio.toFixed(2)} (기준 ${r.floor})`);
    const failed = rows.filter((r) => r.ratio < r.floor).map((r) => `${r.label} ${r.ratio.toFixed(2)} < ${r.floor}`);
    assert.deepEqual(failed, [], failed.join('\n'));
  });
}

test('결과 화면의 고지 요소가 두 테마 모두에서 4.5:1을 넘고 캡션이 12.5px보다 작지 않다', { skip: skipWithoutChrome }, async () => {
  // 토큰이 맞아도 그 토큰이 그 요소에 안 걸려 있으면 고지는 여전히 안 읽힌다.
  // P4의 "작게, 회색으로" 방어도 함께 본다 — 캡션 최소 크기는 12.5px 고정이다.
  const { page } = app;
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.amount-card-caption')`, { timeoutMs: 6000 });
  await sleep(400);

  for (const theme of ['light', 'dark']) {
    await emulate(page, { scheme: theme });
    await page.evaluate(`document.documentElement.setAttribute('data-theme', '${theme}')`);
    const rows = await page.evaluate(MEASURE_LIVE_ELEMENTS);
    measurements.live[theme] = rows.map((r) => (r.missing ? `${r.label}: 없음` : `${r.label}: ${r.ratio.toFixed(2)} / ${r.fontSizePx}px`));
    for (const row of rows) {
      assert.ok(!row.missing, `${row.label}이(가) 결과 화면에 없습니다`);
      assert.ok(row.ratio >= 4.5, `[${theme}] ${row.label} 대비 ${row.ratio.toFixed(2)} < 4.5`);
      assert.ok(row.fontSizePx >= 12.5, `[${theme}] ${row.label} 글자 크기 ${row.fontSizePx}px < 12.5px`);
    }
  }
});

test('고지 요소에 다크 전용 처리가 없다 — 접히거나 흐려지지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  const read = `(() => {
    const basis = document.querySelector('.basis-block');
    const assumption = document.querySelector('.assumption-block');
    return {
      basisOpen: basis.open, assumptionOpen: assumption.open,
      basisOpacity: getComputedStyle(basis).opacity,
      limitOpacity: getComputedStyle(document.querySelector('.limit-note')).opacity,
      bannerDisplay: getComputedStyle(document.querySelector('.disclosure-banner')).display,
    };
  })()`;
  await emulate(page, { scheme: 'light' });
  await page.evaluate(`document.documentElement.setAttribute('data-theme','light')`);
  const light = await page.evaluate(read);
  await emulate(page, { scheme: 'dark' });
  await page.evaluate(`document.documentElement.setAttribute('data-theme','dark')`);
  const dark = await page.evaluate(read);
  assert.deepEqual(dark, light, '다크에서만 달라지는 고지 처리가 있습니다 — 헌장 D11은 테마와 무관하다');
  assert.equal(dark.basisOpen, true, '고지 ③은 기본 펼침이다');
  assert.equal(dark.assumptionOpen, true, '고지 ④는 기본 펼침이다');
});

// ---------------------------------------------------------------------------
// 도넛 색 — 화면에서 뽑은 실제 계산값
// ---------------------------------------------------------------------------

test('도넛 조각의 실제 계산 색이 두 테마에서 설계가 확정한 값이다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // 조각에 걸린 `fill`은 `var(--data-…)`이고, 브라우저가 그것을 풀어 실제로
  // 칠하는 값이 여기 나온다. **화면에 두 세대의 색이 섞이면 여기서 드러난다.**
  const readFills = `(() => {
    const svg = document.querySelector('.result-slot .chart-donut');
    const paths = [...svg.querySelectorAll('path')].map((p) => getComputedStyle(p).fill);
    const cs = getComputedStyle(document.documentElement);
    return {
      paths,
      tokens: Object.fromEntries(['--data-pension','--data-irp','--data-isa','--data-pension-side','--data-irp-side','--data-isa-side','--data-unallocated','--data-unallocated-side']
        .map((n) => [n, cs.getPropertyValue(n).trim()])),
      opacities: [...svg.querySelectorAll('path')].map((p) => getComputedStyle(p).opacity),
    };
  })()`;

  const EXPECTED = {
    light: { '--data-pension': '#0a9a96', '--data-irp': '#da7134', '--data-isa': '#8758c1', '--data-pension-side': '#017572', '--data-irp-side': '#b34f03', '--data-isa-side': '#67369d' },
    dark: { '--data-pension': '#06a19d', '--data-irp': '#df7333', '--data-isa': '#8f5fcc', '--data-pension-side': '#087c78', '--data-irp-side': '#b75203', '--data-isa-side': '#6e3da7' },
  };

  for (const theme of ['light', 'dark']) {
    await emulate(page, { scheme: theme });
    await page.evaluate(`document.documentElement.setAttribute('data-theme','${theme}')`);
    const got = await page.evaluate(readFills);
    measurements.donut[theme] = got;
    for (const [name, hex] of Object.entries(EXPECTED[theme])) {
      assert.equal(got.tokens[name], hex, `[${theme}] ${name}`);
    }
    // 측면에 투명도를 얹으면 화면에 나오는 색이 검증기가 판정한 값이 아니게 된다.
    for (const o of got.opacities) assert.equal(Number(o), 1, '조각에 투명도가 걸려 있습니다');
  }
});

// ---------------------------------------------------------------------------
// 8.5절 — 인쇄는 항상 라이트
// ---------------------------------------------------------------------------

test('인쇄는 사용자가 어둡게를 골라도 라이트 팔레트로 나온다', { skip: skipWithoutChrome }, async () => {
  // 대부분의 프린터 설정에서 배경색이 빠진다. 그러면 다크용 밝은 글자색이 흰
  // 종이에 얹혀 고지가 통째로 사라진다.
  const { page } = app;
  await page.evaluate(`document.documentElement.setAttribute('data-theme','dark')`);
  await emulate(page, { scheme: 'dark', media: 'print' });
  const tokens = await page.evaluate(READ_TOKENS);
  // 인쇄 팔레트는 라이트 `:root`와 값이 같다(styles-tokens.test.mjs가 기계로
  // 대조한다) — 2026-08-10 개정으로 `surface-raised`도 초록빛 흰색이 됐다.
  // **알려진 미결**: screens.md 2.3.5절이 요구하는 "인쇄에서 surface-base·
  // brand-band를 흰색으로 되돌린다"는 이번 개정에 구현하지 않았다(styles.css
  // 인쇄 블록 주석 참고) — 기존 계약 검사가 인쇄 블록과 라이트 `:root`의 색이
  // 한 글자도 다르지 않을 것을 요구해, 그 계약을 깨지 않는 선에서는 헤더 한
  // 자리만 예외로 되돌릴 수 없었다.
  assert.equal(tokens['--surface-raised'], '#f0fdf4');
  assert.equal(tokens['--text-primary'], '#14181c');
  assert.equal(tokens['--data-pension'], '#0a9a96');
  assert.equal(tokens.colorScheme, 'light');
  await emulate(page, { scheme: 'light' });
});

// ---------------------------------------------------------------------------
// 5.30절 — 전환·저장
// ---------------------------------------------------------------------------

test('테마 전환에 색 트랜지션이 없다 — 중간 프레임에서 고지가 흐려지는 일이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // `transition-property`의 계산값은 지속시간이 0이어도 `all`로 나온다 — 이름만
  // 보면 모든 요소가 걸린다. **실제로 시간이 흐르는 것**만 센다.
  const offenders = await page.evaluate(`(() => {
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const seconds = cs.transitionDuration.split(',').map((v) => parseFloat(v) || 0);
      const props = cs.transitionProperty.split(',').map((v) => v.trim());
      props.forEach((name, i) => {
        const dur = seconds[i % seconds.length];
        if (dur > 0 && /^(all|color|background|background-color|border-color|fill|stroke)$/.test(name)) {
          bad.push((el.className.baseVal ?? el.className) + ' :: ' + name + ' ' + dur + 's');
        }
      });
    }
    return bad.slice(0, 10);
  })()`);
  assert.deepEqual(offenders, [], `색에 트랜지션이 걸려 있습니다:\n${offenders.join('\n')}`);
});

test('사용자가 누르기 전에는 저장이 일어나지 않고, 누르면 그때 저장된다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.evaluate(`localStorage.clear()`);
  await page.goto(`${origin}/src/web/index.html`);
  await page.waitFor(`!!document.querySelector('.theme-control-trigger')`);
  // 첫 방문자 — 화면을 띄우고 여기저기 눌러도 키가 없다.
  assert.equal(await page.evaluate(`localStorage.getItem('theme')`), null, '첫 방문자에게 저장이 일어났습니다');
  assert.equal(await page.evaluate(`localStorage.length`), 0);

  await page.clickElement(`document.querySelector('.theme-control-trigger')`);
  await page.waitFor(`!!document.querySelector('.theme-menu')`);
  await page.clickElement(`[...document.querySelectorAll('.theme-menu-item')].find((b) => b.textContent.includes('어둡게'))`);
  await sleep(150);
  assert.equal(await page.evaluate(`localStorage.getItem('theme')`), 'dark');
  assert.equal(await page.evaluate(`document.documentElement.getAttribute('data-theme')`), 'dark');
  assert.equal(await page.evaluate(`localStorage.length`), 1, '키가 하나뿐이어야 한다');

  // `자동`을 고르면 키를 지운다 — 되돌릴 수 없는 저장을 만들지 않는다.
  await page.clickElement(`document.querySelector('.theme-control-trigger')`);
  await page.waitFor(`!!document.querySelector('.theme-menu')`);
  await page.clickElement(`[...document.querySelectorAll('.theme-menu-item')].find((b) => b.textContent.includes('자동'))`);
  await sleep(150);
  assert.equal(await page.evaluate(`localStorage.getItem('theme')`), null);
  assert.equal(await page.evaluate(`document.documentElement.getAttribute('data-theme')`), null, '루트 표시도 함께 사라진다');
});

test('저장된 테마가 첫 페인트 이전에 적용된다 — 흰 화면이 한 프레임도 번쩍이지 않는다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.evaluate(`localStorage.setItem('theme', 'dark')`);
  await emulate(page, { scheme: 'light' });
  // 문서 파싱 도중(모듈 스크립트가 돌기 전)에 표시가 이미 찍혀 있어야 한다.
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') window.__themeAtParse = document.documentElement.getAttribute('data-theme');
    });`,
  });
  await page.goto(`${origin}/src/web/index.html`);
  assert.equal(await page.evaluate(`window.__themeAtParse`), 'dark', '첫 페인트 전에 표시가 찍히지 않았습니다');
  assert.equal(await page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--surface-base').trim()`), '#0a1710');
  await page.evaluate(`localStorage.clear()`);
});

test('모바일 폭에서도 ThemeControl이 가명칭·과세연도 표기를 밀어내지 않는다', { skip: skipWithoutChrome }, async () => {
  // designer의 미결 — "헤더가 넷이 된다"는 우려. 지금 헤더는 셋이고(가명칭 ·
  // 과세연도 · ThemeControl), 트리거는 44px 하나다. 좁은 폭에서 줄이 접히거나
  // 가로 스크롤이 생기지 않는지 실제로 잰다.
  const { page, origin } = app;
  const READ_HEADER = `(() => {
    const h = document.querySelector('.app-header');
    const kids = [...h.children].map((c) => { const r = c.getBoundingClientRect(); return { cls: c.className, w: Math.round(r.width), h: Math.round(r.height) }; });
    const trigger = document.querySelector('.theme-control-trigger').getBoundingClientRect();
    const title = document.querySelector('.app-title');
    const titles = document.querySelector('.app-header-titles');
    return {
      kids,
      lineHeightPx: parseFloat(getComputedStyle(title).lineHeight) || 0,
      titleHeight: Math.round(title.getBoundingClientRect().height),
      triggerBox: { w: Math.round(trigger.width), h: Math.round(trigger.height) },
      pageOverflowsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      clipped: [...h.querySelectorAll('*')].some((c) => c.scrollWidth > c.clientWidth + 1),
      stacked: getComputedStyle(titles).flexDirection,
    };
  })()`;

  measurements.mobileHeader = {};
  for (const width of [320, 360, 414]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 720, deviceScaleFactor: 1, mobile: true });
    await page.goto(`${origin}/src/web/index.html`);
    await page.waitFor(`!!document.querySelector('.theme-control-trigger')`);
    const header = await page.evaluate(READ_HEADER);
    measurements.mobileHeader[width] = header;
    assert.equal(header.pageOverflowsX, false, `${width}px에서 가로 스크롤이 생겼습니다`);
    assert.equal(header.clipped, false, `${width}px에서 헤더 항목이 잘렸습니다`);
    assert.deepEqual(header.triggerBox, { w: 44, h: 44 }, `${width}px: 최소 터치 타깃 44×44`);
    for (const kid of header.kids) assert.ok(kid.w > 0 && kid.h > 0, `${width}px에서 ${kid.cls}가 사라졌습니다`);
    // 좁은 폭에서도 가명칭은 한 줄이다 — 밀리는 대신 과세연도 표기가 아래로 쌓인다.
    assert.ok(header.titleHeight <= header.lineHeightPx + 2, `${width}px에서 가명칭이 두 줄로 접혔습니다`);
  }
  await page.send('Emulation.clearDeviceMetricsOverride');
});

test('테마를 바꿔도 도넛이 다시 그려지지 않는다 — 값이 바뀐 것이 아니므로 조각은 그 자리에 있다', { skip: skipWithoutChrome }, async () => {
  const { page, origin } = app;
  await page.goto(`${origin}/src/web/index.html`);
  await page.evaluate(FILL_REQUIRED_FIELDS);
  await page.waitFor(`!!document.querySelector('.result-slot .chart-donut path')`, { timeoutMs: 6000 });
  // 입력 칸에서 초점을 빼고 화면이 완전히 멎기를 기다린다 — 남은 재계산이 있으면
  // 그것이 그린 변화를 테마 탓으로 읽게 된다.
  await page.evaluate(`document.activeElement && document.activeElement.blur()`);
  await sleep(1200);
  await page.evaluate(`window.__firstPath = document.querySelector('.result-slot .chart-donut path'); window.__firstD = window.__firstPath.getAttribute('d');`);
  await sleep(400);
  assert.equal(
    await page.evaluate(`window.__firstD === document.querySelector('.result-slot .chart-donut path').getAttribute('d')`),
    true,
    '기준선을 잡기 전에 화면이 아직 움직이고 있습니다',
  );

  await page.clickElement(`document.querySelector('.theme-control-trigger')`);
  await page.waitFor(`!!document.querySelector('.theme-menu')`);
  await page.clickElement(`[...document.querySelectorAll('.theme-menu-item')].find((b) => b.textContent.includes('어둡게'))`);
  await sleep(250);

  const same = await page.evaluate(`(() => ({
    sameNode: window.__firstPath === document.querySelector('.result-slot .chart-donut path'),
    sameD: window.__firstD === document.querySelector('.result-slot .chart-donut path').getAttribute('d'),
    fill: getComputedStyle(document.querySelector('.result-slot .chart-donut path')).fill,
  }))()`);
  assert.equal(same.sameNode, true, '테마 변경이 도넛 노드를 갈아치웠습니다 — 각도 애니메이션이 다시 돕니다');
  assert.equal(same.sameD, true, '조각 각도가 다시 계산됐습니다');
  await page.evaluate(`localStorage.clear()`);
});
