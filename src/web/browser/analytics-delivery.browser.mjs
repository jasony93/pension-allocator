import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startStaticServer, launchChrome, openPage, skipWithoutChrome, sleep } from './harness.mjs';
import { createServer } from 'node:http';

/**
 * 계측 전송이 실제로 도착하는지 재는 실측(관리자 판정 D63).
 *
 * **왜 단위 검사(`analytics-transport.test.mjs`)로는 이것을 못 잡나.** 그 파일은
 * `sendBeaconImpl`에 원하는 함수를 직접 꽂는다 — `(url, blob) => { ...; return true; }`.
 * 목을 세우면 목이 참을 돌려주고 검사가 통과한다. **결함과 똑같은 모양이다.**
 * 실제 `navigator.sendBeacon()`은 `Blob{type:'application/json'}`을 교차 오리진으로
 * 보낼 때 preflight(OPTIONS)가 필요하고, 그 뒤 조용히 버려지면서도 `true`를
 * 돌려준다 — 그 간극은 Node의 목이 아니라 **실제 브라우저의 CORS 처리**에서만
 * 드러난다. 그래서 여기서는 실제 Chrome을 띄우고, 실제 교차 오리진 수집기(로컬
 * HTTP 서버 — 정적 서버와 다른 포트라 다른 오리진이다)에 **본문이 도착하는 것**
 * 까지 확인한다.
 *
 * **판별력을 깨서 확인했다.** `analytics.js`를 D63 이전 코드(`sendBeacon`을 먼저
 * 시도하고 `true`면 `fetch`를 건너뛰는 코드)로 되돌린 뒤 이 파일을 단독으로
 * 돌리면 첫 검사가 "수집기가 POST를 받지 못했습니다"로 실패하는 것을 확인했다
 * (이 파일을 커밋하기 전 수동으로 되돌렸다 복원했다 — 저장소에는 고친 코드만
 * 남는다). 고친 코드로 되돌리면 다시 통과한다.
 *
 * 입력값이 새지 않는다는 것은 `analytics-transport.test.mjs`의 화이트리스트
 * 검사가 이미 담당한다 — 여기서 다시 재지 않는다(같은 것을 두 번 재면 어느 쪽이
 * 진짜 계약인지 흐려진다). 이 파일의 몫은 오직 "도착하는가"다.
 */

let collectorReceived;
let collector;
let collectUrl;
let server;
let chrome;
let page;

before(async () => {
  if (skipWithoutChrome) return;
  collectorReceived = [];
  collector = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      collectorReceived.push({ method: req.method, contentType: req.headers['content-type'] ?? null, body });
      res.writeHead(200, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '600',
        'content-type': 'application/json',
      });
      res.end('{}');
    });
  });
  await new Promise((resolve) => collector.listen(0, '127.0.0.1', resolve));
  collectUrl = `http://127.0.0.1:${collector.address().port}/api/send`;

  server = await startStaticServer();
  chrome = await launchChrome();
  page = await openPage(chrome.browserWsUrl, `${server.origin}/src/web/index.html`);
});

after(async () => {
  if (skipWithoutChrome) return;
  page.close();
  await chrome.close();
  await server.close();
  await new Promise((resolve) => collector.close(resolve));
});

test('실제 교차 오리진 수집기에 이벤트 본문이 정확히 한 번 도착한다', { skip: skipWithoutChrome }, async () => {
  collectorReceived.length = 0;

  const dispatched = await page.evaluate(`(async () => {
    const mod = await import('/src/web/analytics.js');
    const transport = mod.createUmamiTransport({
      config: { collectUrl: ${JSON.stringify(collectUrl)}, websiteId: 'delivery-check' },
      locationLike: { pathname: '/result', search: '?age=40', hash: '#x' },
      warn: () => {},
    });
    transport('save_share_action', { session_id: 's-delivery', ts: 1, method: 'pdf' });
    return true;
  })()`);
  assert.equal(dispatched, true, 'transport() 호출 자체가 예외를 던졌습니다');

  // fetch(keepalive)는 응답을 기다리지 않고 돌아오므로, 수집기 도착을 폴링으로 기다린다.
  const deadline = Date.now() + 4000;
  while (collectorReceived.length === 0 && Date.now() < deadline) {
    await sleep(50);
  }

  const posts = collectorReceived.filter((r) => r.method === 'POST');
  assert.ok(
    posts.length > 0,
    `수집기가 POST를 받지 못했습니다(sendBeacon의 true가 도착을 보장하지 않는 D63 결함이 재발했을 수 있습니다). 수신 전체: ${JSON.stringify(collectorReceived)}`,
  );

  const body = JSON.parse(posts[0].body);
  assert.equal(body.payload.name, 'save_share_action');
  assert.equal(body.payload.website, 'delivery-check');
  assert.equal(body.payload.url, '/result', '쿼리스트링·해시가 제거된 경로만 실려야 합니다');
  assert.deepEqual(body.payload.data, { session_id: 's-delivery', ts: 1, method: 'pdf' });

  // 정확히 한 번만 전송됐는지 — sendBeacon과 fetch를 함께 쓰다 이중 전송되는 것도
  // "보낸다고 믿는" 코드의 한 형태다.
  assert.equal(posts.length, 1, `POST가 ${posts.length}번 도착했습니다 — 중복 전송입니다`);
});

test('탭이 이벤트 직후 즉시 닫혀도(unload) 요청이 살아남는다', { skip: skipWithoutChrome }, async () => {
  // 이 검사만 자기 chrome/page를 따로 연다 — 실제로 탭을 닫아야 하므로 위
  // 검사들이 공유하는 fixture를 재사용하지 않는다.
  collectorReceived.length = 0;
  const localChrome = await launchChrome();
  const localPage = await openPage(localChrome.browserWsUrl, `${server.origin}/src/web/index.html`);

  await localPage.evaluate(`(async () => {
    const mod = await import('/src/web/analytics.js');
    const transport = mod.createUmamiTransport({
      config: { collectUrl: ${JSON.stringify(collectUrl)}, websiteId: 'delivery-check-unload' },
      locationLike: { pathname: '/result', search: '', hash: '' },
      warn: () => {},
    });
    transport('result_shown', { session_id: 's-unload', ts: 1, anon_id: 'a-1', has_alternatives: true });
  })()`);
  // 응답을 기다리지 않고 곧바로 탭을 닫는다 — 결과 화면 이탈과 같은 타이밍이다.
  try {
    localPage.close();
  } catch {
    /* 이미 닫혔을 수 있다 */
  }
  await localChrome.close();

  const deadline = Date.now() + 3000;
  while (collectorReceived.filter((r) => r.method === 'POST').length === 0 && Date.now() < deadline) {
    await sleep(50);
  }

  const posts = collectorReceived.filter((r) => r.method === 'POST');
  assert.ok(posts.length > 0, `탭을 닫은 뒤 수집기가 POST를 받지 못했습니다: ${JSON.stringify(collectorReceived)}`);
  const body = JSON.parse(posts[0].body);
  assert.equal(body.payload.name, 'result_shown');
});
