/**
 * 섹션 아이콘 — [2026-08-17, 소유자 지시 9번] 입력·결과 주요 섹션 제목 앞에
 * 붙는 인라인 SVG. **외부 아이콘 라이브러리를 쓰지 않는다**(설치할 패키지
 * 관리자 자체가 이 저장소에 없다 — `package.json`이 없다). **이모지도 쓰지
 * 않는다** — 이모지는 글꼴·플랫폼마다 다른 그림으로 렌더되어 디자인 시스템의
 * 토큰(색·굵기)을 받지 못한다.
 *
 * **한 가지 스트로크 스타일로 통일한다** — `stroke-width: 2`(뷰박스 20×20
 * 사용자 단위 기준) · `stroke: currentColor` · `fill: none` ·
 * `stroke-linecap: round` · `stroke-linejoin: round`. 색은 아이콘이 놓이는
 * 자리의 글자색(`currentColor`)을 그대로 물려받으므로 라이트/다크 테마마다
 * 새로 계산할 색이 없다. `strokeIcon`(아래) 한 곳이 이 다섯 속성을 낸다 —
 * 아이콘마다 다시 적으면 하나가 어긋나도 눈에 잘 안 띈다.
 *
 * 크기는 CSS가 정한다(`.section-icon` 등, `styles.css`) — 여기서는 `width`/
 * `height` 속성을 주지 않고 `viewBox`만 고정해, 벡터가 어느 크기로 놓여도
 * 흐려지지 않게 한다.
 */
import { svgEl } from './dom.js';

function strokeIcon(children, { viewBox = '0 0 20 20', className = '' } = {}) {
  return svgEl(
    'svg',
    {
      viewBox,
      class: `section-icon${className ? ` ${className}` : ''}`,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    children,
  );
}

/** 「입력」 패널 제목 — 연필(작성/입력). */
export function iconEdit() {
  return strokeIcon([
    svgEl('path', { d: 'M12.5 3.5l4 4L6 18H2v-4L12.5 3.5z' }),
    svgEl('path', { d: 'M11 5l4 4' }),
  ]);
}

/** 「① 기본정보」 — 사람(신원·나이·소득이 이 사람에 대한 사실이라는 것). */
export function iconProfile() {
  return strokeIcon([
    svgEl('circle', { cx: 10, cy: 6.5, r: 3 }),
    svgEl('path', { d: 'M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6' }),
  ]);
}

/** 「② 월 납입액」 — 지갑(매달 넣는 돈). */
export function iconWallet() {
  return strokeIcon([
    svgEl('path', { d: 'M2.5 6.5A2 2 0 0 1 4.5 4.5h11a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6.5z' }),
    svgEl('path', { d: 'M13 10h3.5v3H13a1.5 1.5 0 0 1 0-3z' }),
  ]);
}

/** 「③ 계좌 현황」 — 은행(계좌가 지금 어디에 얼마나 있는지). */
export function iconBank() {
  return strokeIcon([
    svgEl('path', { d: 'M2 8l8-4.5L18 8' }),
    svgEl('path', { d: 'M3 8h14v8H3z' }),
    svgEl('path', { d: 'M6 8v8M10 8v8M14 8v8' }),
    svgEl('path', { d: 'M2 16.5h16' }),
  ]);
}

/** 「ISA 만기 자금 전환」 — 두 화살표가 서로 다른 계좌로 자금이 옮겨가는 것. */
export function iconTransfer() {
  return strokeIcon([
    svgEl('path', { d: 'M3 7h11.5M11 3.5L14.5 7 11 10.5' }),
    svgEl('path', { d: 'M17 13H5.5M9 9.5L5.5 13 9 16.5' }),
  ]);
}

/** 「④ ISA 예상 수익률」 — 우상향 꺾은선(수익률 추정). */
export function iconTrend() {
  return strokeIcon([
    svgEl('path', { d: 'M3 15l5-5 3.5 3L17 5' }),
    svgEl('path', { d: 'M12.5 5H17v4.5' }),
  ]);
}

/** 「결과」 섹션(도넛 헤더) — 도넛/파이 조각(배분 결과를 상징). */
export function iconChart() {
  return strokeIcon([
    svgEl('circle', { cx: 10, cy: 10, r: 7.5 }),
    svgEl('path', { d: 'M10 2.5V10l6.5-2.5' }),
  ]);
}
