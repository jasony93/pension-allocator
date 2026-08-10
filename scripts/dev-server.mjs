// 개발용 정적 서버. 의존성 0 — Node 내장 http 만 쓴다.
//
//   node scripts/dev-server.mjs           → http://127.0.0.1:5173/src/web/index.html
//   node scripts/dev-server.mjs 8080      → 포트 지정
//
// **저장소 뿌리를 서빙한다.** 엔진 클라이언트가 룰셋을 `import.meta.url` 기준
// 상대경로(`../../../data/tax-rules/`)로 가져오므로, `src/web/`만 서빙하면 룰셋이
// 404가 난다. 뿌리를 서빙하면 그 경로가 저절로 맞는다.
//
// `file://`로는 열리지 않는다 — 위 fetch가 file 스킴에서 막힌다. 그래서 이 서버가 있다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? 5173);
const ENTRY = '/src/web/index.html';

// `.js`를 `text/javascript`로 내보내지 않으면 브라우저가 ESM 모듈로 실행하지 않는다.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const target = urlPath === '/' ? ENTRY : urlPath;

  // 경로 탈출 방지 — 서빙 뿌리 밖은 내주지 않는다.
  const abs = normalize(join(ROOT, target));
  if (relative(ROOT, abs).startsWith('..') || relative(ROOT, abs).split(sep)[0] === '..') {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('경로 밖');
    return;
  }

  try {
    const info = await stat(abs);
    if (info.isDirectory()) throw new Error('directory');
    const body = await readFile(abs);
    res.writeHead(200, {
      'content-type': MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream',
      // 고칠 때마다 새로고침으로 바로 보이게 한다.
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`없음: ${target}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${PORT}${ENTRY}`);
  console.log('');
  console.log('SSH로 접속 중이면 로컬 컴퓨터에서 포트를 넘겨받아야 브라우저로 열 수 있다:');
  console.log(`  ssh -L ${PORT}:127.0.0.1:${PORT} <사용자>@<이 서버>`);
  console.log(`  그다음 로컬 브라우저에서 http://127.0.0.1:${PORT}${ENTRY}`);
});
