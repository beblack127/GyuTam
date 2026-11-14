// API Gateway REST 프록시 이벤트와 Lambda Function URL 이벤트를 같이 받는다.
// 로그에는 경로, 상태, 시간, 개수, 오류 종류만 남긴다 (리뷰 본문, 질문 원문 금지).
import type { z } from 'zod';

import { errorKind } from '../services/wash/batches.ts';
import { createDeadlines } from './deadline.ts';
import type { Deadlines } from './deadline.ts';

export interface HttpEvent {
  httpMethod?: string;
  requestContext?: { http?: { method?: string } };
  headers?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function getMethod(event: HttpEvent): string {
  return (event.httpMethod ?? event.requestContext?.http?.method ?? '').toUpperCase();
}

export function getHeader(event: HttpEvent, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) if (k.toLowerCase() === lower) return v;
  return undefined;
}

/** chrome-extension:// 출처만 반사한다. 확장 ID는 설치마다 달라 하나로 고정할 수 없다. */
export function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !origin.startsWith('chrome-extension://')) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function json(statusCode: number, body: unknown, origin: string | undefined): HttpResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
    body: JSON.stringify(body),
  };
}

function readBody(event: HttpEvent): unknown {
  const raw = event.body ?? '';
  const text = event.isBase64Encoded ? new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))) : raw;
  return JSON.parse(text);
}

type Run<T> = (body: T, clock: Deadlines) => Promise<{ response: unknown; stats: object }>;

/** 공통 처리: 메서드 → JSON → zod → 파이프라인 → 상태 코드. */
export async function handleJson<S extends z.ZodType>(
  event: HttpEvent,
  route: string,
  schema: S,
  run: Run<z.infer<S>>,
): Promise<HttpResult> {
  const start = Date.now();
  const origin = getHeader(event, 'origin');
  const method = getMethod(event);
  const log = (status: number, extra: object = {}) =>
    console.log(JSON.stringify({ route, status, ms: Date.now() - start, ...extra }));

  if (method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  if (method !== 'POST') {
    log(405);
    return json(405, { error: 'method_not_allowed' }, origin);
  }

  let raw: unknown;
  try {
    raw = readBody(event);
  } catch {
    log(400, { errorKind: 'invalid_json' });
    return json(400, { error: 'invalid_request', message: '본문이 올바른 JSON이 아닙니다' }, origin);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'invalid';
    log(400, { errorKind: 'schema' });
    return json(400, { error: 'invalid_request', message }, origin);
  }

  try {
    const { response, stats } = await run(parsed.data, createDeadlines(start));
    log(200, stats);
    return json(200, response, origin);
  } catch (err) {
    if (err instanceof Error && err.name === 'LlmUnavailable') {
      const e = err as Error & { stage?: string; kinds?: string[] };
      log(503, { errorKind: 'llm_unavailable', stage: e.stage, kinds: e.kinds });
      return json(503, { error: 'llm_unavailable' }, origin);
    }
    log(500, { errorKind: errorKind(err) });
    return json(500, { error: 'internal' }, origin);
  }
}
