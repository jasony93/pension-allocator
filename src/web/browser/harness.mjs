/**
 * 브라우저 실측 하니스 — 실제 Chrome을 띄우고 CDP로 두드린다.
 *
 * **왜 저장소에 있나.** 소유자가 찾은 결함 셋은 전부 "웹 테스트 218건이 모두
 * 통과하는 상태에서 실사용은 안 되는" 부류였다. 셋 다 Node 안의 검사로는 원리상
 * 잡히지 않는다 —
 *
 * - 값 대입(`el.value = …`)에는 **커서가 없다.** 커서가 어긋나 생년월일 순서가
 *   뒤집히는 것은 한 글자씩 실제로 입력해야 나타난다(`Input.insertText`).
 * - 합성 `MouseEvent`는 **초점을 브라우저가 옮기지 않는다.** 클릭 두 번에 한 번
 *   초점이 붙지 않던 것은 진짜 마우스 입력(`Input.dispatchMouseEvent`)에서만
 *   나타난다(합성 이벤트로는 15회 전부 통과했다).
 * - `window.confirm()`은 **테스트 환경에서 막히지 않는다.** 샌드박스 iframe이
 *   조용히 `false`를 돌려주는 것은 실제 iframe 안에서만 드러난다.
 *
 * 그래서 이 검사는 임시 스크립트가 아니라 저장소에 남을 값이 있다.
 *
 * **의존성은 늘리지 않았다.** Node 내장 `http`(정적 서버) · `child_process`
 * (Chrome 실행) · 전역 `WebSocket`(CDP)만 쓴다. Puppeteer도 jsdom도 없다.
 *
 * 실행:
 *   node --test "src/web/**\/*.browser.mjs"
 *
 * Chrome을 찾지 못하면 각 테스트는 **실패가 아니라 건너뛴다**(`CHROME_PATH`로
 * 경로를 지정할 수 있다). 단위 검사(`*.test.mjs`)는 이 파일들을 집지 않으므로
 * 평소 실행은 그대로 빠르고 브라우저가 필요 없다.
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/**
 * 저장소 루트를 그대로 서빙한다. 페이지는 `/src/web/index.html`, 룰셋은
 * `/data/tax-rules/*.json` — 실제 배포와 같은 상대 위치다.
 */
export async function startStaticServer(root = REPO_ROOT) {
  const server = createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
      const full = path.join(root, rel);
      if (!full.startsWith(root)) return void res.writeHead(403).end();
      const buf = await readFile(full);
      res.writeHead(200, {
        'content-type': MIME[path.extname(full)] ?? 'application/octet-stream',
        // 불투명 출처(`sandbox="allow-scripts"`) iframe 안에서는 모듈 스크립트
        // 요청이 CORS로 나간다. 이 헤더가 없으면 샌드박스 검사가 앱을 띄우지
        // 못하고, 그러면 검사하려던 것과 다른 이유로 실패한다.
        'access-control-allow-origin': '*',
      });
      res.end(buf);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findChrome() {
  return CHROME_CANDIDATES.find((c) => existsSync(c)) ?? null;
}

/** Chrome이 없으면 검사를 건너뛴다 — 개발 기계마다 있다고 가정하지 않는다. */
export const skipWithoutChrome = findChrome()
  ? false
  : 'Chrome을 찾지 못했습니다 (CHROME_PATH 환경변수로 경로를 지정할 수 있습니다)';

async function devtoolsVersion(port, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch {
      /* 아직 안 떴다 */
    }
    await sleep(150);
  }
  throw new Error('DevTools 엔드포인트가 열리지 않았습니다');
}

export async function launchChrome() {
  const bin = findChrome();
  if (!bin) throw new Error('chrome not found');
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'web-browser-check-'));
  // 포트 0을 주면 Chrome이 고른 포트를 알아내기 번거로우므로 임의의 높은 포트를
  // 쓰고 실패하면 다음 포트로 넘어간다.
  const port = 9200 + Math.floor(Math.random() * 700);
  const proc = spawn(
    bin,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--window-size=1400,1100',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const version = await devtoolsVersion(port);
  return {
    browserWsUrl: version.webSocketDebuggerUrl,
    async close() {
      try {
        proc.kill();
      } catch {
        /* 이미 죽었다 */
      }
      await sleep(200);
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

class CdpConnection {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message}: ${JSON.stringify(msg.error.data ?? {})}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new CdpConnection(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

/**
 * 페이지 하나를 열고 편의 API를 돌려준다.
 *
 * `childSessions`에는 자동 부착된 하위 타깃이 쌓인다 — 샌드박스 iframe은 불투명
 * 출처라 별도 프로세스로 떨어지므로(OOPIF) 부모 세션의 `Runtime.evaluate`로는
 * 안이 보이지 않는다.
 */
export async function openPage(browserWsUrl, url) {
  const cdp = await CdpConnection.connect(browserWsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: main } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const pageErrors = [];
  const childSessions = [];
  cdp.listeners.push((msg) => {
    if (msg.method === 'Target.attachedToTarget' && msg.params.sessionId !== main) {
      const sid = msg.params.sessionId;
      childSessions.push({ sessionId: sid, info: msg.params.targetInfo });
      cdp.send('Runtime.enable', {}, sid).catch(() => {});
      cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sid).catch(() => {});
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  });

  await cdp.send('Page.enable', {}, main);
  await cdp.send('Runtime.enable', {}, main);
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, main);

  async function evaluate(expression, sessionId = main) {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  const page = {
    pageErrors,
    childSessions,
    evaluate,
    send: (method, params, sessionId = main) => cdp.send(method, params, sessionId),

    /**
     * **프래그먼트만 다른 URL로는 부르지 마라.** 현재 문서와 경로·쿼리가
     * 같고 프래그먼트만 다르면 브라우저는 이것을 "같은 문서 안 이동"으로
     * 처리해 `Page.loadEventFired`를 다시 쏘지 않는다 — 그러면 아래 대기가
     * 영원히 안 끝난다(실측 — `#calculator`로만 바뀐 재호출이 그랬다).
     * 진짜 새로고침이 필요하면 쿼리스트링을 하나 얹어 경로 자체를 다르게
     * 만들어라. 이 함수 자체는 그 실수를 막지 않는 대신, 30초 안에
     * `Page.loadEventFired`가 안 오면 원인을 바로 알 수 있게 타임아웃으로
     * 던진다(예전에는 이 실수 하나가 전체 검사 프로세스를 무기한 멈췄다).
     */
    async goto(target) {
      const loaded = new Promise((resolve) => {
        const fn = (msg) => {
          if (msg.sessionId === main && msg.method === 'Page.loadEventFired') {
            cdp.listeners = cdp.listeners.filter((f) => f !== fn);
            resolve();
          }
        };
        cdp.listeners.push(fn);
      });
      await cdp.send('Page.navigate', { url: target }, main);
      const timedOut = Symbol('timeout');
      const result = await Promise.race([
        loaded,
        new Promise((resolve) => setTimeout(() => resolve(timedOut), 30000)),
      ]);
      if (result === timedOut) {
        throw new Error(
          `page.goto(${JSON.stringify(target)})가 30초 안에 Page.loadEventFired를 받지 못했습니다 — ` +
            `현재 문서와 프래그먼트만 다른 URL로 부르지 않았는지 확인하세요(같은 문서 안 이동은 load를 다시 쏘지 않습니다).`,
        );
      }
    },

    /**
     * 요소를 화면 안으로 넣고 **진짜 마우스 입력**으로 누른다. 합성 이벤트가 아니다.
     *
     * 좌표는 두 번 잰다 — 한 번은 스크롤을 일으키기 위해, 한 번은 스크롤이 끝난
     * 뒤 실제 자리를 얻기 위해. 그리고 **이미 눌릴 수 있는 상태면 스크롤하지
     * 않는다**(`position: fixed` 모달 안의 버튼에 `scrollIntoView`를 걸면 바깥
     * 프레임이 움직여 좌표가 어긋난다 — 실제로 클릭이 빗나가는 것을 보고 고쳤다).
     *
     * **"화면 안"의 기준을 `window.innerHeight`만으로 재면 안이 아닌데 안이라고
     * 잘못 판정한다.** `.result-slot`처럼 `overflow-y: auto` + `max-height`로
     * 스스로를 자르는 조상이 있으면, 버튼의 좌표가 창 안에 있어도 그 조상의
     * 잘린 경계 밖(내부 스크롤로만 닿는 자리)일 수 있다 — 그 자리는 아무것도
     * 그려지지 않고 클릭이 조상의 배경이나 다른 형제에게 떨어진다. 그래서 창
     * 경계 대신 **그 좌표에서 실제로 맨 위에 있는 원소가 이 원소(또는 그 후손)인가**로
     * 판정한다 — `elementFromPoint`는 모든 조상의 잘림·겹침을 이미 반영한 값이라
     * `overflow` 조상이 몇 겹이든 따로 셀 필요가 없다. 이미 맨 위라면(모달의
     * 고정 위치 버튼처럼) 스크롤을 걸지 않아 위 주석의 결함이 재발하지 않는다.
     *
     * `offset`은 iframe 안의 좌표를 바깥 페이지 좌표로 옮길 때 쓴다. 마우스 입력은
     * 언제나 최상위 프레임 좌표계로 들어간다. `elementFromPoint`는 그 프레임
     * 안에서만 보므로(다른 프레임의 원소는 알 수 없다) offset과 무관하게 맞다.
     */
    async clickElement(selectorExpr, { sessionId = main, offset = { x: 0, y: 0 } } = {}) {
      const measure = `(() => {
        const el = ${selectorExpr};
        const hitAtCenter = () => {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return false;
          const top = document.elementFromPoint(cx, cy);
          return !!top && (top === el || el.contains(top));
        };
        if (!hitAtCenter()) {
          el.scrollIntoView({ block: 'center' });
        }
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      })()`;
      await evaluate(measure, sessionId);
      await sleep(80);
      const box = await evaluate(measure, sessionId);
      const x = box.x + offset.x;
      const y = box.y + offset.y;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, main);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, main);
    },

    /** 한 글자씩 실제로 친다 — 값 대입이 아니라 커서가 움직이는 입력이다. */
    async typeText(text, { delayMs = 20 } = {}) {
      for (const ch of text) {
        await cdp.send('Input.insertText', { text: ch }, main);
        await sleep(delayMs);
      }
    },

    /** 조건이 참이 될 때까지 기다린다 — 디바운스·비동기 계산이 끝나기를 임의의 sleep으로 재지 않는다. */
    async waitFor(expression, { timeoutMs = 5000, sessionId = main } = {}) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (await evaluate(expression, sessionId)) return true;
        if (Date.now() > deadline) throw new Error(`조건이 ${timeoutMs}ms 안에 참이 되지 않았습니다: ${expression}`);
        await sleep(60);
      }
    },

    async pressKey(key, code = key, windowsVirtualKeyCode = 0) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode }, main);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode }, main);
    },

    close: () => cdp.ws.close(),
  };

  await page.goto(url);
  return page;
}

/** 서버 + 브라우저 + 앱 페이지를 한 번에 세우고, 정리 함수를 함께 돌려준다. */
export async function openApp({ url = '/src/web/index.html' } = {}) {
  const server = await startStaticServer();
  const chrome = await launchChrome();
  const page = await openPage(chrome.browserWsUrl, `${server.origin}${url}`);
  return {
    page,
    origin: server.origin,
    async close() {
      page.close();
      await chrome.close();
      await server.close();
    },
  };
}

/**
 * 아티팩트가 도는 조건 그대로 — `sandbox="allow-scripts"` iframe 안에 앱을 띄운다.
 *
 * 불투명 출처라 별도 프로세스(OOPIF)로 떨어지므로 바깥 세션의 `Runtime.evaluate`로는
 * 안이 보이지 않는다. 자동 부착으로 잡은 자식 세션을 찾아 묶어 준다. 마우스 입력은
 * 최상위 프레임 좌표계로만 들어가므로 iframe의 위치를 더해 준다.
 */
export async function attachSandboxedFrame(page, { path: framePath = '/src/web/index.html', sandbox = 'allow-scripts' } = {}) {
  const frameElementId = 'sandboxed-frame';
  await page.evaluate(`(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.innerHTML = '';
    const f = document.createElement('iframe');
    f.id = ${JSON.stringify(frameElementId)};
    f.setAttribute('sandbox', ${JSON.stringify(sandbox)});
    f.style.cssText = 'position:absolute;left:0;top:0;width:1360px;height:1000px;border:0';
    f.src = location.origin + ${JSON.stringify(framePath)};
    document.body.append(f);
  })()`);

  let session = null;
  for (let i = 0; i < 60 && !session; i++) {
    await sleep(100);
    session = page.childSessions.find((c) => c.info.type === 'iframe');
  }
  if (!session) throw new Error('샌드박스 iframe 세션을 찾지 못했습니다');
  // 문서가 실제로 살아날 때까지 기다린다(앱이 떴는지 여부는 검사가 판단할 몫이다).
  for (let i = 0; i < 60; i++) {
    try {
      if ((await page.evaluate('document.readyState', session.sessionId)) === 'complete') break;
    } catch {
      /* 아직 컨텍스트가 없다 */
    }
    await sleep(100);
  }

  const offset = async () => {
    const r = await page.evaluate(
      `(() => { const r = document.getElementById(${JSON.stringify(frameElementId)}).getBoundingClientRect(); return { x: r.left, y: r.top }; })()`,
    );
    return r;
  };

  return {
    sessionId: session.sessionId,
    evaluate: (expression) => page.evaluate(expression, session.sessionId),
    async click(selectorExpr) {
      return page.clickElement(selectorExpr, { sessionId: session.sessionId, offset: await offset() });
    },
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * [2026-08-21, D81] 계산기2가 기본 탭이 되면서, 예시 팝업("계산기2 예시 인사")이
 * **명시적 탭 클릭 없이 순전한 새 페이지 로드만으로도** 뜰 수 있게 됐다
 * (`ui/app.js`의 초기 로드 분기 — D81 원문 "첫 방문 로드 포함"). 이 모달은
 * 뷰포트 전체를 덮는 스크림(`.modal-scrim`, position: fixed; inset: 0)을
 * 쓰므로, 팝업 자체를 검사하지 않는 다른 시험이 좌표 기반 클릭
 * (`page.clickElement`)을 이어가면 그 클릭이 스크림에서 끝나 원래 누르려던
 * 요소(탭 버튼 등)를 놓친다(실측 — 탭 전환이 조용히 무효가 됐다). `openApp()`
 * 직후 이 함수로 미리 치워 둔다 — localStorage에 오늘 날짜를 적어 **앞으로의**
 * 자동 재등장을 막고, 이미 열려 있을 수 있는 모달은 좌표가 아니라 DOM으로
 * (스크림에 가릴 일이 없다) 직접 닫는다. 팝업 자체를 검사하는 시험은 이
 * 함수를 부르지 않거나, 부른 뒤 스스로 `localStorage.clear()`로 되돌린다.
 */
export async function dismissCalc2ExampleModalIfOpen(page) {
  await page.evaluate(`localStorage.setItem('calc2ExampleModalDismissedDate', (() => {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  })())`);
  await page.evaluate(`(() => {
    const closeBtn = document.querySelector('.calc2-example-modal-close');
    if (closeBtn) closeBtn.click();
  })()`);
}

/**
 * [2026-08-25, 소유자 지시 9번] 「연금고갈 시뮬레이션」 탭 전용 팝업 —
 * 계산기2 예시 팝업과 같은 이유(위 함수 머리말)로 같은 대비가 필요하다.
 * **별도 키**(`depletionIntroModalDismissedDate`, 계산기2와 독립)를 쓴다 —
 * 이 함수가 계산기2 쪽 키를 건드리면 두 팝업의 "독립 억제"를 검사하는
 * 시험 자신이 그 독립성을 깨게 된다.
 */
export async function dismissDepletionIntroModalIfOpen(page) {
  await page.evaluate(`localStorage.setItem('depletionIntroModalDismissedDate', (() => {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  })())`);
  await page.evaluate(`(() => {
    const closeBtn = document.querySelector('.depletion-intro-modal-close');
    if (closeBtn) closeBtn.click();
  })()`);
}

/**
 * 필수 항목을 채워 결과가 나오는 상태로 만든다(값 대입 — 여기서는 커서가 관심사가
 * 아니다). 금액 입력란은 **만원 단위**다(소유자 지시, 6절) — `calc2CurrentSalary`
 * `6000`은 60,000,000원, `calc2MonthlyCapacity` `50`은 500,000원과 같다. 이 값을
 * 바꾸면 실제 원 단위 금액도 함께 바뀌므로, 다른 실측이 기대하는 결과(도넛
 * 크기·경계값 등)가 흔들리지 않게 **단위 전환 전과 같은 원 금액**을 유지했다.
 *
 * [2026-08-24, D84 정리] **필드 id를 `calc2` 접두어로 정정한다.** 이 상수가
 * 가리키던 `birthDate`·`currentSalary`·`monthlyCapacity`·`hasNonWageIncome-false`
 * ·`annuityStarted-false`·`fundUseHorizon-before_pension_age`는 D84로 삭제된
 * 「절세계좌 계산기2(근거판)」 탭의 id였다 — 그 탭이 지워지며 이 상수가
 * 가리키는 요소가 전부 사라져, 이 상수를 쓰는 모든 시험이 조용히
 * `getElementById(...) === null`에서 죽고 있었다. 지금 유일한 계산 탭인
 * calc2의 id(`calc2BirthDate` 등, `ui/calc2-input-panel.js`)로 옮긴다.
 */
export const FILL_REQUIRED_FIELDS = `(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('calc2BirthDate', '19800101');
  set('calc2CurrentSalary', '6000');
  // 계약 5.0.0(D27) — 공제율 판정 축의 첫 물음. 대다수 사용자가 여기(아니오)다.
  document.getElementById('calc2HasNonWageIncome-false').click();
  set('calc2MonthlyCapacity', '50');
  // 9.0.0(D39) — 「직전 과세연도 결정세액」 입력이 사라졌다. 클릭할 대상이 없다.
  // [D79 판정 3] 생년월일이 만 55세 미만(이 상수의 '19800101'은 만 55세
  // 미만)이면 도출값이 확실한 미개시라 이 물음 자체를 그리지 않는다 —
  // 존재할 때만 누른다.
  document.getElementById('calc2AnnuityStarted-false')?.click();
  document.getElementById('calc2fundUseHorizon-before_pension_age').click();
})()`;
