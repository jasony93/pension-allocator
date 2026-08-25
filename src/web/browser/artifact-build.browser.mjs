import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openApp, skipWithoutChrome, sleep, dismissDepletionIntroModalIfOpen } from './harness.mjs';

/**
 * 배포 아티팩트(`dist/index.html`)의 실측 — `scripts/build.mjs`가 도는 것만으로는
 * 부족하다. **번들이 실제 Chrome에서 뜨는지**를 봐야 한다(D66).
 *
 * 이 저장소에서 세 번 겪은 것 — 모듈을 하나의 스코프로 합치는 번들러는 이름
 * 충돌이나 빠진 모듈이 있어도 Node의 나머지 검사에는 전혀 나타나지 않는다.
 * `src/`의 개별 테스트는 여전히 전부 통과하는데 산출물은 빈 화면일 수 있다 —
 * 실제로 이름 충돌로 세 번 막혔고, 한 번은 실패한 줄 모르고 옛 빌드를 발행할
 * 뻔했다. 그래서 이 검사가 배포 전 마지막 안전망이다.
 *
 * **먼저 빌드를 새로 돌린다.** 이 파일이 보는 것은 "지금 소스가 만드는 산출물"
 * 이지 디스크에 남아 있을지 모르는 옛 `dist/index.html`이 아니다.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

let app;
let buildResult;

before(async () => {
  buildResult = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts/build.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (skipWithoutChrome) return;
  app = await openApp({ url: '/dist/index.html' });
  // [2026-08-21, D81] 기본 탭이 calc2로 바뀌었다 — 첫 로드부터 예시 팝업이
  // 뜰 수 있어 먼저 치운다. [2026-08-24, D84] 「절세계좌 계산기2(근거판)」
  // (`tab-calculator`)가 지워지고 calc2가 유일한 계산 탭이자 기본 활성
  // 탭이라, 이제 명시로 다른 탭을 켤 필요가 없다 — calc2가 이미 활성이다.
  // [2026-08-25, D86] 랜딩이 다시 바뀌어 이제 기본 활성 탭은 시뮬레이터다
  // — calc2 프리필·결과 렌더가 그려지려면 이 탭으로 직접 전환해야 한다.
  await dismissDepletionIntroModalIfOpen(app.page);
  await app.page.clickElement(`document.getElementById('tab-calc2')`);
}, { skip: skipWithoutChrome });

after(async () => {
  if (app) await app.close();
});

test('빌드 스크립트가 성공한다(exit 0)', () => {
  assert.equal(
    buildResult.status,
    0,
    `scripts/build.mjs가 실패했습니다:\n${buildResult.stdout}\n${buildResult.stderr}`,
  );
});

test('빌드 출력이 이름 충돌 0을 보고한다', () => {
  assert.match(buildResult.stdout, /이름 충돌 0/, `빌드 출력에 충돌 0 보고가 없습니다:\n${buildResult.stdout}`);
});

test('아티팩트를 열어도 boot-fail이 비어 있다 — 부팅 중 예외가 없었다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  await sleep(300); // 모듈 스크립트 평가 + mountApp이 끝날 시간
  const failText = await page.evaluate(`document.getElementById('boot-fail').textContent`);
  assert.equal(failText, '', `아티팩트가 부팅 중 죽었습니다: ${failText}`);
  assert.deepEqual(page.pageErrors, [], `페이지에서 처리되지 않은 예외가 있었습니다: ${JSON.stringify(page.pageErrors)}`);
});

test('입력 패널이 실제로 그려진다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // [2026-08-24, D84] 「절세계좌 계산기2(근거판)」(첫 탭, `#birthDate`·
  // 입력 전 자리표시자가 있던 곳)이 지워졌다 — 이제 유일한 계산 탭인
  // calc2는 로드와 동시에 예시 값으로 프리필돼 결과가 바로 서므로(D79
  // 판정 2) "입력 전 자리표시자" 상태 자체가 이 탭에는 없다(그 개념은
  // `result-placeholder.browser.mjs`가 별도로 다룬다).
  assert.equal(await page.evaluate(`!!document.getElementById('calc2BirthDate')`), true, '계산기2 입력 폼이 렌더되지 않았습니다');
});

test('아티팩트 안에서 실제로 계산 결과가 렌더된다(계산기2, 프리필)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  // [2026-08-24, D84] calc2는 로드와 동시에 예시 값으로 프리필돼 결과가
  // 바로 서므로(D79 판정 2) 필드를 채울 필요가 없다.
  await page.waitFor(`!!document.getElementById('tabpanel-calc2')?.querySelector('.calc2-result-slot .chart-donut')`, { timeoutMs: 8000 });
  await sleep(600);

  const donut = await page.evaluate(`(() => {
    const svg = document.querySelector('.calc2-result-slot svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const paths = [...svg.querySelectorAll('path')].map((p) => (p.getAttribute('d') || '').length);
    return { width: r.width, height: r.height, paths };
  })()`);
  assert.ok(donut, '결과 도넛 SVG가 없습니다 — 엔진 룰셋 인라인이 깨졌을 수 있습니다');
  assert.ok(donut.width > 0 && donut.height > 0, `도넛이 0×0으로 그려졌습니다: ${JSON.stringify(donut)}`);
  assert.ok(donut.paths.length > 0 && donut.paths.every((len) => len > 0), '조각 path가 비어 있습니다');

  const amountText = await page.evaluate(`document.querySelector('.calc2-result-slot').textContent`);
  assert.match(amountText, /\d/, '결과 영역에 계산된 숫자가 없습니다');

  // 부팅 후에도 boot-fail이 비어 있어야 한다 — 계산 도중 예외가 나면 여기 남는다.
  assert.equal(await page.evaluate(`document.getElementById('boot-fail').textContent`), '');
});

test('공개 배포 기본값 — 아티팩트 안내문(artifact-note)이 없다', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(
    await page.evaluate(`!!document.querySelector('.artifact-note')`),
    false,
    '기본 빌드에 내부 미리보기 안내문이 남아 있습니다 — scripts/build.mjs 기본값을 확인하세요',
  );
});

// **뒤집힌 검사.** 요구사항 템플릿은 "자문이 아님 고지가 결과 화면에 표시된다"를
// 완료 기준으로 든다. 그러나 이 저장소의 실제 판정(D59~D61)은 그 반대다 —
// 소유자가 세 회차에 걸쳐 성격·자격·유보 문구를 전부 지우라고 명시했고,
// D60은 「고지 배너가 렌더된다」를 요구하는 검사가 있으면 지우지 말고 **뒤집어**
// 「그 문구가 없다」로 두라고 못 박았다(낡은 체크리스트가 올바른 구현을 결함으로
// 잡는 것을 막기 위해서). 그래서 여기서도 뒤집는다 — 다만 이 충돌은 조용히
// 넘기지 않고 최종 보고에 그대로 올린다.
// 정확한 지운 문장(gate-decisions.md D64가 인용한 원문)만 짚는다. "세무사법"
// 단어 자체는 배제 사유의 조항 근거(예: 시행령 제33조)로 정당하게 남아 있을 수
// 있으므로(D61 "배제 사유의 조항 칩은 남긴다"), 넓게 그 단어를 금지하면 오탐이다.
const REMOVED_DISCLOSURE_PHRASES = [
  '상담·자문이나 신고 대리', // DISCLOSURE.nature
  '세무사법 제6조', // DISCLOSURE.qualification — 등록 세무대리인 관련 조항
  '세무대리인이 아닙니다',
  '세무사 등 자격자 확인이 필요합니다', // DISCLOSURE.limit
];
test('D60/D61 — 성격·자격·유보 고지 세 문장이 화면에 없다(소유자 지시로 전부 삭제됨)', { skip: skipWithoutChrome }, async () => {
  const { page } = app;
  assert.equal(await page.evaluate(`!!document.querySelector('.disclosure-banner, [class*="disclosure"], .limit-note')`), false);
  // **`textContent`가 아니라 `innerText`를 쓴다.** 이 페이지는 `<script type="module">`
  // 안에 번들된 소스 전체(주석 포함)를 담고 있고, `textContent`는 렌더되지 않는
  // `<script>` 텍스트까지 훑는다 — 실제로 지워진 문장을 "왜 지웠는가"를 설명하는
  // 주석(`result-panel.js` 1422행)이 그대로 걸려 거짓 실패가 났다. `innerText`는
  // 실제로 화면에 그려지는 것만 본다.
  const bodyText = await page.evaluate(`document.body.innerText`);
  for (const phrase of REMOVED_DISCLOSURE_PHRASES) {
    assert.equal(bodyText.includes(phrase), false, `지워졌어야 할 고지 문구가 화면에 남아 있습니다: "${phrase}"`);
  }
});

/**
 * [2026-08-24, D84 판정 1] 이 파일에는 원래 「절세계좌 계산기2(근거판)」
 * (첫 탭)의 다인물 예시 캐러셀(`.example-showcase-slot`, 이동 화살표
 * 포함)의 배포 번들 실측이 여기서부터 끝까지 있었다 — 그 탭이 지워지며
 * 그 컴포넌트가 앱 어디에도 마운트되지 않는다(`ui/example-showcase.js`의
 * 최상위 `mountExampleShowcase`가 이제 죽은 코드로 남아 있는 것과 같은
 * 이유). 아래 삭제된 시험들이 확인하던 것: 절세액 금액 덩어리 줄바꿈
 * (1440px·375px), 좌우 2열 정렬, 이동 화살표 크기·위치·첫 화면 노출,
 * 아티팩트 뷰어처럼 감싼 조건에서의 캐러셀 스타일 유실.
 *
 * **알려진 빈 자리 — 마지막 시험(감싼 조건 스타일 유실 검사)은 계산기2의
 * 새 예시 모달(`ui/calc2-example-modal.js`, 같은 shadow-DOM host 패턴)로
 * 다시 세울 가치가 있다** — 그 검사가 잡던 결함(외부 아티팩트 뷰어가
 * 우리 `<head><style>`를 재배치해 shadow DOM 스타일이 유실되는 것)은
 * calc2 예시 모달도 같은 `attachHostStyles` 패턴을 쓰는 한 여전히 일어날
 * 수 있는 결함이다 — 이번 회차는 시간상 다시 세우지 못했다(관리자 보고에
 * 후속 과제로 남긴다).
 */
