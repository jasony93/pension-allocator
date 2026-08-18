/**
 * 요약 내보내기(관리자 지시 6번, D74) — 이미지(PNG) 경로. **의존성 0** —
 * html2canvas류 라이브러리를 들이지 않는다(D74). 도넛의 arc 수학은 이미
 * `charts.js`에 순수 함수로 있으므로(`annulusSlicePath`), 요약 전체를 그
 * 위에서 짠 독립 SVG 문자열로 구성하고 → `Image`로 로드 → `<canvas>`에
 * 그려 → `toDataURL('image/png')`로 내보낸다. **`foreignObject`는 쓰지
 * 않는다**(D74) — 브라우저마다 `foreignObject` 안의 HTML을 캔버스로 구울 때
 * 캔버스를 오염시켜(taint) `toDataURL`이 `SecurityError`를 던지는 사례가
 * 알려져 있다. 이 파일이 만드는 SVG는 `<rect>`·`<path>`·`<text>`뿐이다.
 *
 * **왜 별도 SVG를 새로 짜고 `charts.js`의 `donutChart`(DOM 컴포넌트)를
 * 재사용하지 않는가.** `donutChart`가 그리는 색은 CSS 커스텀 프로퍼티
 * (`var(--data-pension)` 등)를 참조한다. 그 값은 **문서(document) 트리
 * 안에서만** 상속으로 풀린다 — `data:image/svg+xml,...`를 `Image.src`에
 * 넣으면 브라우저가 그 SVG를 별도의, 이 페이지 `:root`와 연결되지 않은
 * 독립 문서로 취급한다(실측 근거는 이 파일의 색 상수 주석). 그래서 이
 * 경로는 실제 hex 값을 SVG 문자열에 직접 박아야 하고, `donutChart`를
 * 그대로 쓸 수 없다 — 인쇄(PDF) 경로는 라이브 문서의 일부라 이 문제가
 * 없으므로 거기서는 `donutChart`를 그대로 재사용한다(`result-panel.js`의
 * `summarySheet`).
 *
 * **테마 — 라이트 고정.** 내보낸 이미지는 뷰어의 현재(라이트/다크) 테마와
 * 무관하게 **항상 같은 모양**이어야 한다는 것이 D74의 요구다. 라이트로
 * 고정한 근거 — (1) 메신저·문서 뷰어로 옮겨질 이미지는 배경이 불투명한
 * 흰 바탕을 기대하는 자리(카카오톡 채팅창, 워드 문서 등)에 더 자주
 * 붙는다 — 어두운 배경의 PNG는 밝은 배경 위에서 가독성이 떨어지고
 * 반대(밝은 PNG를 어두운 배경에)는 여전히 읽힌다(불투명 배경을 이 SVG
 * 자체가 `<rect>`로 깔기 때문). (2) 인쇄(PDF) 경로도 이미 라이트로
 * 고정되어 있다(`styles.css` `@media print` "인쇄는 테마와 무관하게
 * 라이트 팔레트를 강제한다", `styles-tokens.test.mjs`가 검사한다) — 두
 * 내보내기 경로가 같은 결정을 공유하면 "인쇄에서는 라이트인데 이미지는
 * 다크로 나온다" 같은 산출물 간 불일치가 생기지 않는다.
 */

import { annulusSlicePath } from './charts.js';

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

/**
 * 도넛(평면 2D — 인쇄 경로의 입체 도넛과 달리 기울기·압출을 넣지 않는다,
 * 요약은 "정보 전달"이 목적이라 단순함을 우선한다는 것을 이 파일이 스스로
 * 정한다) + 범례를 그린다. `data.donut.arcs`는 `charts.js`의 `sliceAngles`가
 * 낸 순수 각도 배열이다.
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

function legendMarkup(data, top) {
  const rows = [];
  let y = top + 40;
  const legendX = 460;
  for (const arc of data.donut.arcs) {
    const account = arc.account;
    const color = arc.isUnallocated ? SUMMARY_EXPORT_COLORS.dataUnallocated : ACCOUNT_EXPORT_COLOR[account];
    const acc = data.accounts.find((a) => a.account === account);
    const label = arc.isUnallocated ? '미배분' : (acc?.label ?? account);
    const monthly = arc.isUnallocated ? data.donut.unallocatedMonthlyKrw : (acc?.monthlyKrw ?? 0);
    rows.push(`<rect x="${legendX}" y="${y - 14}" width="14" height="14" fill="${color}" />`);
    rows.push(svgText(legendX + 24, y - 3, label, { size: 16, weight: 700 }));
    rows.push(
      svgText(legendX + 24, y + 18, `${monthly.toLocaleString('ko-KR')}원 / 월`, {
        size: 14,
        weight: 400,
        color: SUMMARY_EXPORT_COLORS.textSecondary,
      }),
    );
    y += 52;
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
 */
export function buildSummarySvgMarkup(data) {
  const titleTop = PADDING;
  const donutSectionTop = titleTop + 40;
  const { markup: donutSvg } = donutMarkup(data, donutSectionTop);
  const { markup: legendSvg, bottom: legendBottom } = legendMarkup(data, donutSectionTop);
  const donutSectionBottom = Math.max(donutSectionTop + DONUT_CY_OFFSET + DONUT_R + 40, legendBottom);

  const { markup: totalSvg, bottom: totalBottom } = totalTaxSavingsMarkup(data, donutSectionBottom + 16);
  const { markup: tableSvg, bottom: tableBottom } = tableMarkup(data, totalBottom + 8);

  const height = Math.ceil(tableBottom + PADDING);

  const body = [
    `<rect x="0" y="0" width="${CANVAS_WIDTH}" height="${height}" fill="${SUMMARY_EXPORT_COLORS.surfaceRaised}" />`,
    svgText(PADDING, titleTop + 24, '배분 요약', { size: 24, weight: 700 }),
    `<line x1="${PADDING}" y1="${donutSectionBottom + 8}" x2="${CANVAS_WIDTH - PADDING}" y2="${donutSectionBottom + 8}" stroke="${SUMMARY_EXPORT_COLORS.borderSubtle}" stroke-width="1" />`,
    donutSvg,
    legendSvg,
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
