/**
 * 요약 내보내기(관리자 지시 6번, D74) — 이미지(PNG)·PDF 두 산출물이 함께
 * 거치는 **단 하나의 SVG 조립기**. **의존성 0** — html2canvas류 라이브러리를
 * 들이지 않는다(D74). 도넛의 arc 수학은 이미 `charts.js`에 순수 함수로
 * 있으므로(`annulusSlicePath`), 요약 전체를 그 위에서 짠 독립 SVG 문자열로
 * 구성한다.
 *
 * **[2026-08-18, 관리자 지시(6차) 3번, D75 시행] PDF도 이 SVG를 그대로
 * 쓴다 — "같은 요약 조립기 하나"가 문자 그대로다.** 옛(D74) 구현은 PNG는
 * 이 파일의 독립 SVG를, PDF는 `result-panel.js`의 `summarySheet`가 만드는
 * **별도** DOM(`donutChart`/`donutLegend` 재사용, 표는 `<table>`)을 각자
 * 찍었다 — 두 갈래였다. 관리자 지시가 "인쇄 시트가 이 SVG를 전면 배치하는
 * 형태가 가장 단순하다"고 지정했고, 그 형태로 통합했다 — `summarySheet`는
 * 이제 `buildSummarySvgMarkup`이 낸 문자열을 `DOMParser`로 파싱해 그대로
 * 삽입한다(`summarySvgElementFromMarkup`, 아래). **PNG 경로(`Image` →
 * `<canvas>` → `toDataURL`)와 PDF 경로(라이브 DOM에 인라인 삽입 →
 * `window.print()`)가 정확히 같은 마크업 문자열에서 갈라지므로, 둘 중
 * 하나만 고치고 잊는 경로가 구조적으로 없다.**
 *
 * **`foreignObject`는 쓰지 않는다**(D74) — 브라우저마다 `foreignObject` 안의
 * HTML을 캔버스로 구울 때 캔버스를 오염시켜(taint) `toDataURL`이
 * `SecurityError`를 던지는 사례가 알려져 있다. 이 파일이 만드는 SVG는
 * `<rect>`·`<path>`·`<text>`·`<polyline>`·`<line>`뿐이다.
 *
 * **왜 별도 SVG를 새로 짜고 `charts.js`의 `donutChart`(DOM 컴포넌트)를
 * 재사용하지 않는가.** `donutChart`가 그리는 색은 CSS 커스텀 프로퍼티
 * (`var(--data-pension)` 등)를 참조한다. 그 값은 **문서(document) 트리
 * 안에서만** 상속으로 풀린다 — `data:image/svg+xml,...`를 `Image.src`에
 * 넣으면 브라우저가 그 SVG를 별도의, 이 페이지 `:root`와 연결되지 않은
 * 독립 문서로 취급한다(실측 근거는 이 파일의 색 상수 주석). 이 문제는
 * PNG 경로에만 있었지만(별도 문서), **이제 PDF도 이 SVG를 그대로 쓰므로**
 * 애초에 두 경로 모두 리터럴 hex만 쓰는 것이 이 통합의 전제다 — 인라인
 * 삽입(PDF)이라면 `var(--...)`가 실제로 풀리겠지만, 그러면 PNG와 PDF가
 * "같은 문자열"이 아니라 "같은 함수, 다른 출력"이 되어 통합의 의미가 준다.
 *
 * **테마 — 라이트 고정.** 내보낸 이미지·PDF는 뷰어의 현재(라이트/다크)
 * 테마와 무관하게 **항상 같은 모양**이어야 한다는 것이 D74의 요구다.
 * 라이트로 고정한 근거 — (1) 메신저·문서 뷰어로 옮겨질 이미지는 배경이
 * 불투명한 흰 바탕을 기대하는 자리(카카오톡 채팅창, 워드 문서 등)에 더
 * 자주 붙는다 — 어두운 배경의 PNG는 밝은 배경 위에서 가독성이 떨어지고
 * 반대(밝은 PNG를 어두운 배경에)는 여전히 읽힌다(불투명 배경을 이 SVG
 * 자체가 `<rect>`로 깔기 때문). (2) 인쇄(PDF) 경로도 이미 라이트로
 * 고정되어 있다(`styles.css` `@media print` "인쇄는 테마와 무관하게
 * 라이트 팔레트를 강제한다", `styles-tokens.test.mjs`가 검사한다) — 리터럴
 * hex를 쓰는 이 SVG를 PDF에도 그대로 꽂으므로 이제는 "같은 결정을
 * 공유"하는 정도가 아니라 **같은 문자열이 두 산출물 모두를 만든다.**
 *
 * **[2026-08-18, 관리자 지시(6차) 2·3번, D75] 도넛 조각 라벨(이름+비율) +
 * 입력값 블록.** 화면 도넛(legend 모드)이 이미 하는 방식 — 조각 위에
 * 이름+비율을 직접 쓰고, 조각이 좁으면 고리 밖 리더선으로 뺀다
 * (`charts.js`의 `applyDonutSliceInlineLabelsToSvg`) — 을 이 독립 SVG에도
 * 적용한다(`sliceInlineLabelsMarkup`, 아래). **다만 그 함수와 달리
 * `getBBox()` 실측을 쓸 수 없다** — `buildSummarySvgMarkup`은
 * `summary-image.test.mjs`가 순수 Node(`node --test`, DOM 없음)에서 직접
 * 호출하는 문자열 빌더라, 마운트된 DOM에서만 되는 실측 API에 기댈 수
 * 없다. 대신 문자 폭을 근사식(`estimateTextWidthPx`)으로 추정해 조각
 * 안에 들어가는지 가늠한다 — 실제 렌더에서 잘리지 않는지는 크롭(최종
 * 보고)과 `Page.printToPDF` 실측으로 확인한다. 도넛 오른쪽의 입력값
 * 블록(`inputsBlockMarkup`)은 `data.inputs`(`summary-data.js`의
 * `buildSummaryInputs`가 이미 화이트리스트·"입력 안 한 값은 줄이 없다"를
 * 판정해 둔 배열)를 그대로 옮겨 적을 뿐, 여기서 다시 판단하지 않는다.
 */

import { annulusSlicePath } from './charts.js';
import { formatPercent } from '../format.js';
import { SUMMARY_INPUTS_HEADING } from '../copy.js';

/**
 * `styles.css` `:root`(라이트, 8.2절 규칙 1 — 맨바닥 `:root`가 라이트
 * 팔레트 전체를 갖는다)에서 그대로 옮긴 값이다. **세법 수치가 아니라 디자인
 * 토큰**이므로 하드코딩 금지 원칙(세법 수치)에 걸리지 않는다 — 이 저장소의
 * `charts.js`도 같은 이유로 계좌 색 상수를 코드에 갖고 있다(`ACCOUNT_COLOR`,
 * 그쪽은 `var(--data-pension)` 참조, 이쪽은 독립 문서라 참조가 아니라 값
 * 자체가 필요하다는 차이뿐이다). **값이 바뀌면 이 상수도 함께 고쳐야
 * 한다** — `summary-image-colors.test.mjs`가 `styles.css`를 파싱해 이 값과
 * 대조하므로, 둘이 어긋나면 그 검사가 잡는다(드리프트 방지).
 */
export const SUMMARY_EXPORT_COLORS = {
  surfaceRaised: '#ffffff',
  surfaceOverlay: '#f4f6f8',
  borderSubtle: '#e1e5ea',
  textPrimary: '#14181c',
  textSecondary: '#4a535c',
  dataPension: '#0a9a96',
  dataIrp: '#da7134',
  dataIsa: '#8758c1',
  dataUnallocated: '#5a6166',
};

const ACCOUNT_EXPORT_COLOR = {
  annuity_savings: SUMMARY_EXPORT_COLORS.dataPension,
  retirement_pension: SUMMARY_EXPORT_COLORS.dataIrp,
  isa: SUMMARY_EXPORT_COLORS.dataIsa,
};

function xmlEscape(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function svgText(x, y, text, { size = 16, weight = 400, color = SUMMARY_EXPORT_COLORS.textPrimary, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${xmlEscape(
    text,
  )}</text>`;
}

const CANVAS_WIDTH = 960;
const PADDING = 56;
const DONUT_CX = 260;
const DONUT_CY_OFFSET = 190; // 도넛 영역 시작 y로부터의 상대 오프셋
const DONUT_R = 150;
const DONUT_R_INNER = DONUT_R * 0.55;
// [2026-08-18, D75] 범례는 도넛 오른쪽이 아니라 도넛 **아래**로 내려간다 —
// 도넛 오른쪽 자리를 입력값 블록에 내주기 위해서다(관리자 지시 원문 "도넛
// 오른쪽에 사용자가 입력한 값을 적어라"). 도넛 자체의 x(`DONUT_CX`)는
// 그대로이므로 이 재배치가 도넛·조각 라벨 기하에는 영향을 주지 않는다.
const LEGEND_X = PADDING;
// 입력값 블록(D75) — 도넛 오른쪽. `CANVAS_WIDTH`(960)를 넓히지 않고도 들어간다
// — 도넛이 x=110~410을 쓰므로 480에서 시작하면 70px 여백을 두고 시작해
// `CANVAS_WIDTH - PADDING`(904)까지 424px를 쓸 수 있다(렌더 크롭으로 확인,
// 최종 보고).
const INPUTS_BLOCK_X = 480;

/**
 * 도넛(평면 2D — 인쇄 경로의 입체 도넛과 달리 기울기·압출을 넣지 않는다,
 * 요약은 "정보 전달"이 목적이라 단순함을 우선한다는 것을 이 파일이 스스로
 * 정한다). `data.donut.arcs`는 `charts.js`의 `sliceAngles`가 낸 순수 각도
 * 배열이다. 범례는 별도 함수(`legendMarkup`, 아래)가 그린다.
 */
function donutMarkup(data, top) {
  const cy = top + DONUT_CY_OFFSET;
  const parts = [];
  for (const arc of data.donut.arcs) {
    const color = arc.isUnallocated ? SUMMARY_EXPORT_COLORS.dataUnallocated : ACCOUNT_EXPORT_COLOR[arc.account];
    const d = annulusSlicePath(DONUT_CX, cy, DONUT_R, DONUT_R_INNER, 1, arc.start, arc.end);
    parts.push(`<path d="${d}" fill="${color}" />`);
  }
  return { markup: parts.join(''), cy };
}

// ---------------------------------------------------------------------------
// [2026-08-18, 관리자 지시(6차) 2번, D75] 도넛 조각 위(안) 이름+비율 라벨.
// `charts.js`의 `applyDonutSliceInlineLabelsToSvg`(화면 도넛, legend 모드)와
// 같은 방식 — 조각 안에 이름+비율 두 줄, 안 들어가면 고리 밖 + 리더선 —
// 을 이 독립 SVG에도 적용한다. 이 파일 머리말 참고: `getBBox()` 실측을 쓸
// 수 없어(Node에서도 호출되는 순수 문자열 빌더) **문자 폭을 근사식으로
// 추정**한다.
// ---------------------------------------------------------------------------

function polarFlat(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

/**
 * 문자 폭 근사 — Pretendard Bold 기준, ASCII(숫자·라틴·기호·`%`)는 대략
 * 0.62em, 한글 등 전각 문자는 대략 1.0em으로 본다. **실제 DOM 측정이 아니다**
 * (이 함수가 필요한 이유는 이 파일의 머리말 참고) — 실제 렌더에서 잘리지
 * 않는지는 크롭·`Page.printToPDF` 실측으로 별도 확인한다.
 */
export function estimateTextWidthPx(text, fontPx) {
  let width = 0;
  for (const ch of String(text)) {
    // eslint 없이도 명확하도록: 코드포인트가 ASCII 범위(0x00~0xFF)면 좁은 글자.
    width += ch.codePointAt(0) <= 0xff ? fontPx * 0.62 : fontPx * 1.0;
  }
  return width;
}

function summarySrgbChannelToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function relativeLuminanceHex(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * summarySrgbChannelToLinear(r) + 0.7152 * summarySrgbChannelToLinear(g) + 0.0722 * summarySrgbChannelToLinear(b);
}
function summaryContrastRatio(l1, l2) {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
/**
 * 배경 hex와 대비가 더 큰 쪽(흰/검)을 고른다 — `charts.js`의 `bestTextColorOn`과
 * 같은 셈법, hex 리터럴을 직접 받는다는 점만 다르다(이 파일은 CSS 계산값이
 * 아니라 리터럴 색 상수를 쓴다). **반환값은 hex가 아니라 CSS 색 키워드
 * (`'white'`/`'black'`)다** — `charts.js`의 같은 함수가 이미 쓰는 근거를
 * 그대로 따른다: 흰/검은 WCAG 상대 휘도 스펙이 1과 0으로 정의하는 절댓값이라
 * 어느 팔레트에도 속하지 않고, 디자인 토큰이 애초에 없다. hex로 쓰면
 * `styles-tokens.test.mjs`의 "예외 파일도 `SUMMARY_EXPORT_COLORS` 밖에서는
 * hex를 쓰지 않는다" 검사에 걸린다 — 이 함수가 실측으로 고른 값이
 * `SUMMARY_EXPORT_COLORS`에 속하지 않는 임의의 색이 아니라 WCAG 절댓값임을
 * 코드 형태로도 드러낸다.
 */
function bestTextColorOnHex(hex) {
  const bg = relativeLuminanceHex(hex);
  const whiteContrast = summaryContrastRatio(bg, 1);
  const blackContrast = summaryContrastRatio(bg, 0);
  return whiteContrast >= blackContrast ? 'white' : 'black';
}

const SUMMARY_SLICE_LABEL_NAME_FONT_PX = 15;
const SUMMARY_SLICE_LABEL_MIN_FONT_PX = 9;
const SUMMARY_SLICE_LABEL_FIT_MARGIN = 0.92;
const SUMMARY_SLICE_LABEL_OUTSIDE_GAP = 16;

/**
 * 조각마다 이름+비율 두 줄을 그린다. `charts.js`의 `applyDonutSliceInlineLabelsToSvg`
 * 머리말과 같은 배치 규칙 — 고리 반지름 정중앙, 안 들어가면 글자를 바닥값까지
 * 줄이고 그래도 안 들어가면 고리 밖 + 리더선.
 */
function sliceInlineLabelsMarkup(data, cx, cy) {
  const total = (data.donut.segments ?? []).reduce((sum, seg) => sum + seg.amount, 0);
  if (!(total > 0)) return '';
  const rLabel = (DONUT_R + DONUT_R_INNER) / 2;
  const bandThickness = DONUT_R - DONUT_R_INNER;
  const parts = [];

  for (const arc of data.donut.arcs) {
    if (!(arc.amount > 0)) continue;
    const color = arc.isUnallocated ? SUMMARY_EXPORT_COLORS.dataUnallocated : ACCOUNT_EXPORT_COLOR[arc.account];
    const acc = data.accounts.find((a) => a.account === arc.account);
    const name = arc.isUnallocated ? '미배분' : (acc?.label ?? arc.account);
    const pctText = formatPercent(arc.amount / total);
    const mid = (arc.start + arc.end) / 2;
    const sweepRad = (Math.max(0, arc.end - arc.start) * Math.PI) / 180;
    // 180°(π)에서 현 길이가 최댓값(지름)을 찍고 그 뒤로 다시 줄어드는 것은
    // `charts.js`의 같은 식과 같은 이유다(그 파일 머리말 참고).
    const chordAtMid = 2 * rLabel * Math.sin(Math.min(sweepRad, Math.PI) / 2);
    const insideColor = bestTextColorOnHex(color);

    let nameFont = SUMMARY_SLICE_LABEL_NAME_FONT_PX;
    const fits = (fontPx) => {
      const pctFont = Math.max(SUMMARY_SLICE_LABEL_MIN_FONT_PX, fontPx - 2);
      const widest = Math.max(estimateTextWidthPx(name, fontPx), estimateTextWidthPx(pctText, pctFont));
      const blockHeight = fontPx + pctFont + 6;
      return widest <= chordAtMid * SUMMARY_SLICE_LABEL_FIT_MARGIN && blockHeight <= bandThickness * SUMMARY_SLICE_LABEL_FIT_MARGIN;
    };
    while (!fits(nameFont) && nameFont > SUMMARY_SLICE_LABEL_MIN_FONT_PX) nameFont -= 1;
    const pctFont = Math.max(SUMMARY_SLICE_LABEL_MIN_FONT_PX, nameFont - 2);

    if (fits(nameFont)) {
      const [px, py] = polarFlat(cx, cy, rLabel, mid);
      parts.push(
        `<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="central" fill="${insideColor}" font-family="'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif">` +
          `<tspan x="${px}" dy="-0.55em" font-size="${nameFont}" font-weight="700">${xmlEscape(name)}</tspan>` +
          `<tspan x="${px}" dy="1.25em" font-size="${pctFont}" font-weight="700">${xmlEscape(pctText)}</tspan>` +
          `</text>`,
      );
    } else {
      const outerR = DONUT_R + SUMMARY_SLICE_LABEL_OUTSIDE_GAP;
      const [ox, oy] = polarFlat(cx, cy, outerR, mid);
      const [ex, ey] = polarFlat(cx, cy, DONUT_R, mid);
      parts.push(
        `<polyline points="${ex},${ey} ${ox},${oy}" stroke="${SUMMARY_EXPORT_COLORS.borderSubtle}" stroke-width="1" fill="none" />`,
      );
      parts.push(
        `<text x="${ox}" y="${oy}" text-anchor="middle" dominant-baseline="central" fill="${SUMMARY_EXPORT_COLORS.textPrimary}" font-family="'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif">` +
          `<tspan x="${ox}" dy="-0.55em" font-size="${SUMMARY_SLICE_LABEL_NAME_FONT_PX}" font-weight="700">${xmlEscape(name)}</tspan>` +
          `<tspan x="${ox}" dy="1.25em" font-size="${Math.max(SUMMARY_SLICE_LABEL_MIN_FONT_PX, SUMMARY_SLICE_LABEL_NAME_FONT_PX - 2)}" font-weight="700">${xmlEscape(pctText)}</tspan>` +
          `</text>`,
      );
    }
  }
  return parts.join('');
}

/** 범례(계좌 스와치+이름+월 금액) — [2026-08-18, D75] 도넛 아래로 옮겼다(위
 * `LEGEND_X` 주석). `top`은 범례 블록이 시작하는 y 좌표 그대로다(옛
 * `top + 40` 오프셋은 호출부가 이미 도넛 하단에서 간격을 두고 넘기므로 이
 * 함수 안에서 다시 더하지 않는다 — 두 곳에서 간격을 조정하면 어느 한쪽만
 * 고쳐질 위험이 생긴다). */
function legendMarkup(data, top) {
  const rows = [];
  let y = top;
  for (const arc of data.donut.arcs) {
    const account = arc.account;
    const color = arc.isUnallocated ? SUMMARY_EXPORT_COLORS.dataUnallocated : ACCOUNT_EXPORT_COLOR[account];
    const acc = data.accounts.find((a) => a.account === account);
    const label = arc.isUnallocated ? '미배분' : (acc?.label ?? account);
    const monthly = arc.isUnallocated ? data.donut.unallocatedMonthlyKrw : (acc?.monthlyKrw ?? 0);
    rows.push(`<rect x="${LEGEND_X}" y="${y - 14}" width="14" height="14" fill="${color}" />`);
    rows.push(svgText(LEGEND_X + 24, y - 3, label, { size: 16, weight: 700 }));
    rows.push(
      svgText(LEGEND_X + 24, y + 18, `${monthly.toLocaleString('ko-KR')}원 / 월`, {
        size: 14,
        weight: 400,
        color: SUMMARY_EXPORT_COLORS.textSecondary,
      }),
    );
    y += 52;
  }
  return { markup: rows.join(''), bottom: y };
}

/**
 * [2026-08-18, 관리자 지시(6차) 2번, D75] 도넛 오른쪽 입력값 블록.
 * `data.inputs`(`summary-data.js`의 `buildSummaryInputs`)를 그대로 옮겨
 * 적는다 — 이 함수는 "무엇을 담는가"를 다시 판단하지 않는다(D75 선 ①은
 * 그 함수가 이미 지켰다). `data.inputs`가 비어 있으면(옛 D74 시절 호출부처럼
 * `form`을 안 넘긴 경우) **블록 자체를 그리지 않는다** — 빈 제목만 떠 있는
 * 상태를 만들지 않는다.
 */
function inputsBlockMarkup(data, top) {
  const inputs = data.inputs ?? [];
  if (inputs.length === 0) return { markup: '', bottom: top };
  const rows = [];
  let y = top;
  rows.push(svgText(INPUTS_BLOCK_X, y, SUMMARY_INPUTS_HEADING, { size: 15, weight: 700, color: SUMMARY_EXPORT_COLORS.textSecondary }));
  y += 30;
  for (const item of inputs) {
    rows.push(svgText(INPUTS_BLOCK_X, y, item.label, { size: 13, weight: 600, color: SUMMARY_EXPORT_COLORS.textSecondary }));
    y += 20;
    rows.push(svgText(INPUTS_BLOCK_X, y, item.valueText, { size: 17, weight: 700 }));
    y += 30;
  }
  return { markup: rows.join(''), bottom: y };
}

function totalTaxSavingsMarkup(data, top) {
  const rows = [];
  let y = top + 32;
  rows.push(svgText(PADDING, y, data.totalTaxSavings.label, { size: 18, weight: 700, color: SUMMARY_EXPORT_COLORS.textSecondary }));
  y += 52;
  rows.push(svgText(PADDING, y, data.totalTaxSavings.valueText, { size: 44, weight: 700 }));
  y += 20;
  if (data.totalTaxSavings.includesAssumption) {
    y += 30;
    rows.push(svgText(PADDING, y, data.totalTaxSavings.determinedLine, { size: 16, weight: 600 }));
    y += 26;
    rows.push(svgText(PADDING, y, data.totalTaxSavings.assumptionLine, { size: 16, weight: 600 }));
    y += 10;
  }
  return { markup: rows.join(''), bottom: y + 24 };
}

const TABLE_COL_X = { account: PADDING, monthly: 430, annual: 620, remaining: 900 };

function tableMarkup(data, top) {
  const rows = [];
  let y = top + 28;
  rows.push(svgText(TABLE_COL_X.account, y, '계좌', { size: 14, weight: 700, color: SUMMARY_EXPORT_COLORS.textSecondary }));
  rows.push(
    svgText(TABLE_COL_X.monthly, y, '월 납입액', { size: 14, weight: 700, color: SUMMARY_EXPORT_COLORS.textSecondary, anchor: 'end' }),
  );
  rows.push(svgText(TABLE_COL_X.annual, y, '연 환산', { size: 14, weight: 700, color: SUMMARY_EXPORT_COLORS.textSecondary, anchor: 'end' }));
  rows.push(
    svgText(TABLE_COL_X.remaining, y, '납입 잔여 한도', {
      size: 14,
      weight: 700,
      color: SUMMARY_EXPORT_COLORS.textSecondary,
      anchor: 'end',
    }),
  );
  y += 12;
  rows.push(`<line x1="${PADDING}" y1="${y}" x2="${CANVAS_WIDTH - PADDING}" y2="${y}" stroke="${SUMMARY_EXPORT_COLORS.borderSubtle}" stroke-width="1" />`);
  for (const account of data.accounts) {
    y += 40;
    rows.push(svgText(TABLE_COL_X.account, y, account.label, { size: 16, weight: 600 }));
    rows.push(svgText(TABLE_COL_X.monthly, y, `${account.monthlyKrw.toLocaleString('ko-KR')}원`, { size: 16, anchor: 'end' }));
    rows.push(svgText(TABLE_COL_X.annual, y, `${account.annualKrw.toLocaleString('ko-KR')}원`, { size: 16, anchor: 'end' }));
    rows.push(
      svgText(TABLE_COL_X.remaining, y, `${account.remainingLimitKrw.toLocaleString('ko-KR')}원`, { size: 16, anchor: 'end' }),
    );
  }
  return { markup: rows.join(''), bottom: y + 32 };
}

/**
 * `data`는 `summary-data.js`의 `buildSummaryData`가 낸 값이다 — 이 함수는
 * 그것을 SVG 문자열로 옮기기만 하고 "무엇을 담는가"는 다시 판단하지 않는다.
 * 반환값은 **완결된 SVG 문서 문자열**(`<svg ...>...</svg>`)이다.
 *
 * **[2026-08-18, 관리자 지시(6차) 2·3번, D75] 배치 — 도넛(조각 라벨 포함) +
 * 범례를 왼쪽 열에, 입력값 블록을 도넛 오른쪽에 둔다.** 옛(D74) 배치는
 * 범례가 도넛 오른쪽(`x=460`)에 있었다 — 그 자리를 입력값 블록에 내주고,
 * 범례는 도넛 **아래**로 내렸다(`legendMarkup`·`LEGEND_X` 주석). 도넛
 * 구역의 세로 높이는 "왼쪽 열(도넛+범례)"과 "오른쪽 열(입력값)" 중 더 긴
 * 쪽이 정한다 — 어느 한쪽만 보고 자르면 다른 쪽이 잘려 나간다.
 * `CANVAS_WIDTH`(960)는 그대로다 — 입력값 블록이 옛 범례 자리(x=460)보다
 * 조금 더 오른쪽(x=480)에서 시작해도 `CANVAS_WIDTH - PADDING`(904)까지
 * 여유가 있다(렌더 크롭 실측, 최종 보고).
 */
export function buildSummarySvgMarkup(data) {
  const titleTop = PADDING;
  const donutSectionTop = titleTop + 40;
  const cy = donutSectionTop + DONUT_CY_OFFSET;
  const { markup: donutSvg } = donutMarkup(data, donutSectionTop);
  const sliceLabelsSvg = sliceInlineLabelsMarkup(data, DONUT_CX, cy);
  const { markup: legendSvg, bottom: legendBottom } = legendMarkup(data, cy + DONUT_R + 32);
  const { markup: inputsSvg, bottom: inputsBottom } = inputsBlockMarkup(data, donutSectionTop + 8);

  const donutColumnBottom = Math.max(cy + DONUT_R + 40, legendBottom);
  const donutSectionBottom = Math.max(donutColumnBottom, inputsBottom);

  const { markup: totalSvg, bottom: totalBottom } = totalTaxSavingsMarkup(data, donutSectionBottom + 16);
  const { markup: tableSvg, bottom: tableBottom } = tableMarkup(data, totalBottom + 8);

  const height = Math.ceil(tableBottom + PADDING);

  const body = [
    `<rect x="0" y="0" width="${CANVAS_WIDTH}" height="${height}" fill="${SUMMARY_EXPORT_COLORS.surfaceRaised}" />`,
    svgText(PADDING, titleTop + 24, '배분 요약', { size: 24, weight: 700 }),
    `<line x1="${PADDING}" y1="${donutSectionBottom + 8}" x2="${CANVAS_WIDTH - PADDING}" y2="${donutSectionBottom + 8}" stroke="${SUMMARY_EXPORT_COLORS.borderSubtle}" stroke-width="1" />`,
    donutSvg,
    sliceLabelsSvg,
    legendSvg,
    inputsSvg,
    totalSvg,
    `<line x1="${PADDING}" y1="${totalBottom + 4}" x2="${CANVAS_WIDTH - PADDING}" y2="${totalBottom + 4}" stroke="${SUMMARY_EXPORT_COLORS.borderSubtle}" stroke-width="1" />`,
    tableSvg,
  ].join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${height}" viewBox="0 0 ${CANVAS_WIDTH} ${height}">${body}</svg>`;
}

/**
 * SVG 문자열 → `data:` URI. base64가 아니라 `encodeURIComponent`를 쓴다 —
 * 한글(계좌 이름·라벨)이 섞인 문자열을 `btoa`에 바로 넣으면 Latin1 밖의
 * 문자에서 예외가 난다(`btoa`는 바이트 문자열만 받는다). `encodeURIComponent`는
 * UTF-8 퍼센트 인코딩이라 이 문제가 없다.
 */
export function svgMarkupToDataUri(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

/**
 * [2026-08-18, 관리자 지시(6차) 3번, D75] SVG 문자열 → 현재 문서에 삽입 가능한
 * 라이브 `<svg>` 엘리먼트. **PDF 경로(`result-panel.js`의 `summarySheet`)가
 * 쓴다** — PNG 경로는 `Image`/`<canvas>`로 별도 문서 취급해 굽지만, PDF는
 * `window.print()`가 찍는 **이 페이지 자신의 라이브 DOM**의 일부라 인라인
 * 삽입이 더 단순하고, `Image` 로드를 기다리는 비동기 경합도 없다(`ui/print.js`
 * 머리말이 경계하는 "인쇄 스냅샷 타이밍" 부류의 문제를 애초에 만들지 않는다
 * — 이 SVG는 인쇄가 시작되기 전에 이미 정적으로 DOM에 붙어 있다).
 *
 * `DOMParser`로 문자열을 파싱한 뒤 `document.importNode`로 현재 문서에 소유권을
 * 옮긴다 — 파싱 직후의 노드는 아직 `DOMParser`가 만든 별도 문서에 속해 있어
 * 그대로 `appendChild`하면 `WrongDocumentError`가 난다.
 */
export function summarySvgElementFromMarkup(svgMarkup) {
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') return null;
  const parsed = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;
  return typeof document.importNode === 'function' ? document.importNode(svg, true) : svg;
}

/**
 * SVG 문자열을 `<canvas>`에 래스터라이즈해 PNG data URL을 낸다. `Image`가
 * `data:image/svg+xml,...`를 로드하는 것은 **별도의, 이 문서와 연결되지
 * 않은 독립 문서**를 그리는 것이라(위 머리말) `foreignObject`도, CSS
 * 커스텀 프로퍼티 상속도 필요하지 않다 — `buildSummarySvgMarkup`이 이미
 * 리터럴 색만으로 완결된 문서를 짜 두었기 때문에 이 함수는 그것을 그대로
 * 화소로 굽기만 한다.
 *
 * `scale`(기본 2)은 레티나 디스플레이에서도 흐리지 않게 캔버스 실제
 * 픽셀을 CSS 논리 크기의 배수로 키운다 — SVG는 벡터라 확대해 그려도
 * 화질 손실이 없다.
 */
export function rasterizeSvgToPngDataUrl(svgMarkup, { width, height, scale = 2 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('summary_image_no_browser_environment'));
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('summary_image_svg_load_failed'));
    img.src = svgMarkupToDataUri(svgMarkup);
  });
}

/**
 * `buildSummaryData` 반환값 → PNG data URL. `summarySheet`(인쇄 경로)와
 * "무엇이 담기는가"를 공유하고 `buildSummarySvgMarkup`이 낸 문서의 실제
 * 크기(`width`/`height`, `<svg>` 속성에서 그대로 읽는다)를 캔버스 크기로
 * 쓴다 — 크기를 두 곳(SVG 속성·rasterize 호출부)에 따로 적지 않는다.
 */
export async function exportSummaryPng(data) {
  const svgMarkup = buildSummarySvgMarkup(data);
  const widthMatch = /width="(\d+)"/.exec(svgMarkup);
  const heightMatch = /height="(\d+)"/.exec(svgMarkup);
  const width = Number(widthMatch[1]);
  const height = Number(heightMatch[1]);
  return rasterizeSvgToPngDataUrl(svgMarkup, { width, height });
}

/**
 * `data:` URL(위 함수가 낸 PNG)을 파일로 내려받는다. `<a download>`를
 * 클릭한다 — 새 의존성이 필요 없다. **`sandbox="allow-scripts"`만 있는
 * iframe(아티팩트 뷰어)에서는 다운로드 자체가 브라우저 정책으로 막힌다**
 * (`allow-downloads`가 없다) — `ui/print.js`의 `window.print()`가 같은
 * 환경에서 조용히 막히는 것과 같은 부류다. 이 함수는 그 실패를 감지할
 * 신호가 없어(클릭은 예외 없이 "성공"한다 — 브라우저가 조용히 무시할 뿐)
 * `onBlocked` 콜백을 받지 않는다 — 호출부가 실제 검증에서 dev server로
 * 확인해야 한다(최종 보고 참고).
 */
export function downloadDataUrl(dataUrl, filename) {
  if (typeof document === 'undefined') return false;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
