/**
 * PDF 내보내기 — `screens.md` 9절(저장·공유)의 후신. 소유자 지시(2026-08-10)로
 * "공유용 이미지 만들기"(캔버스로 다시 그린 PNG)를 걷어내고 브라우저 인쇄
 * (`window.print()` + `styles.css`의 `@media print`)로 대체한다.
 *
 * **의존성을 늘리지 않는다.** Chrome·Edge·Safari 모두 인쇄 대화상자에서
 * "PDF로 저장"을 이미 제공한다 — PDF 생성 라이브러리가 필요 없다.
 *
 * **개인 식별 가능 입력값을 싣지 않는다는 원칙은 그대로다**(9절 · designer
 * 금지사항). 예전엔 `share.js`가 캔버스를 새로 그려 안전한 값만 옮겨 담는
 * 방식으로 그 원칙을 지켰다. 인쇄는 화면의 DOM을 그대로 찍으므로, 같은 보장을
 * **CSS**로 옮겼다 — `styles.css`의 `@media print`가 `.input-slot`(생년월일·
 * 총급여액·낼 세금·월 납입 여력 등 입력값이 실제로 담긴 자리)을 통째로 숨긴다.
 * 값을 가리는 결정이 JS 조건문 하나에 달려 있지 않고 스타일시트 규칙 하나로
 * 끝나므로, 이 파일이 실수로 값을 흘릴 방법이 없다 — 애초에 입력값을 읽지도
 * 않는다.
 *
 * **접힌 `<details>`(가정 사항·법령 조항)를 펴는 로직은 이 파일에 없다 —
 * 처음엔 `beforeprint`에서 `open` 속성을 켜는 JS로 구현했으나, `Page.printToPDF`
 * (CDP 헤드리스 인쇄)로 실제 PDF를 뽑아 확인하니 접힌 채로 나왔다.** Chromium의
 * 인쇄 렌더 패스가 이벤트 핸들러의 DOM 변경을 스냅샷에 반영하기 전에 레이아웃을
 * 굳히는 것으로 보인다 — 화면(라이브 미리보기)에서는 되는 것처럼 보이다가 실제
 * 산출물에서만 어긋나는, 이 저장소가 가장 경계하는 부류의 결함이다. 그래서 CSS로
 * 옮겼다 — `styles.css`의 `@media print`가 `details:not([open]) > *:not(summary)`를
 * `!important`로 덮어써 펼친다. 레이아웃 계산 자체에 들어가는 선언이라 스냅샷
 * 타이밍 문제가 없다.
 */

/**
 * "PDF로 저장" 버튼의 핸들러.
 *
 * **`window.print()`는 아티팩트가 실제로 도는 `sandbox="allow-scripts"` iframe
 * 안에서 조용히 아무 일도 하지 않는다** — `allow-modals`가 없으면 예외도,
 * `beforeprint` 이벤트도 없이 그냥 열리지 않는다(`ui/modal.js`가 적어 둔
 * `window.confirm()`·`<a download>`와 같은 실패 형태다, 실측으로 확인했다).
 * 그 자리에서 아무 신호도 못 받으면 사용자는 버튼이 죽었다고 여긴다. 그래서
 * `beforeprint`가 짧은 시간 안에 오는지를 보고 오지 않으면 `onBlocked`를
 * 불러 화면이 대체 안내를 낼 수 있게 한다.
 *
 * `window.print`가 아예 없는 환경(매우 오래된 브라우저)에서는 즉시 `onBlocked`를
 * 부른다.
 */
export function exportToPdf({ onBlocked, detectWindowMs = 500 } = {}) {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    onBlocked?.();
    return false;
  }
  let fired = false;
  const onBeforePrint = () => {
    fired = true;
  };
  window.addEventListener('beforeprint', onBeforePrint, { once: true });
  window.print();
  setTimeout(() => {
    window.removeEventListener('beforeprint', onBeforePrint);
    if (!fired) onBlocked?.();
  }, detectWindowMs);
  return true;
}
