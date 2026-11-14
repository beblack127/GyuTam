// 통합용 로컬 API 서버: http://localhost:8787 → Lambda와 같은 핸들러.
// 실행: apps/api에서 `npm run dev` (루트 .env를 읽는다). 환경 변수 값은 출력하지 않는다.
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';

import { handler as askHandler } from '../handlers/askHandler.ts';
import { handler as washHandler } from '../handlers/washHandler.ts';
import type { HttpEvent, HttpResult } from '../utils/http.ts';

const PORT = 8787;
const MAX_BODY = 1024 * 1024;
const REQUIRED = ['AWS_REGION', 'BEDROCK_JUDGE_MODEL_ID', 'BEDROCK_SUMMARY_MODEL_ID'];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`환경 변수가 없습니다: ${missing.join(', ')} (레포 루트 .env 확인)`);
  process.exit(1);
}
if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
  console.warn('AWS_BEARER_TOKEN_BEDROCK가 없습니다. 기본 AWS 자격 증명을 찾습니다.');
}

const routes: Record<string, (e: HttpEvent) => Promise<HttpResult>> = {
  '/wash': washHandler,
  '/ask': askHandler,
};

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0] ?? '/';
  const route = routes[path];
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'not_found' }));
    return;
  }
  try {
    const body = await readBody(req);
    if (body === null) {
      res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'payload_too_large' }));
      return;
    }
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
    const result = await route({ httpMethod: req.method, headers, body, isBase64Encoded: false });
    res.writeHead(result.statusCode, result.headers).end(result.body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'internal' }));
  }
}).listen(PORT, () => {
  console.log(`세탁 API 로컬 서버: http://localhost:${PORT} (POST /wash, POST /ask)`);
});
