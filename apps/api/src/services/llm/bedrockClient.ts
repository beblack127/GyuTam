// Bedrock InvokeModel (OpenAI 호환 본문) → 최종 텍스트 → JSON → zod.
// 로그와 오류 메시지에 리뷰 본문, 응답 본문을 넣지 않는다 (fairness.md).
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { z } from 'zod';

export type LlmErrorKind = 'timeout' | 'bedrock_error' | 'invalid_json' | 'schema_mismatch';

export class LlmError extends Error {
  kind: LlmErrorKind;
  /** SDK 예외 이름과 HTTP 상태만 (예: "ThrottlingException 429"). 본문 없음. */
  detail: string | null;
  constructor(kind: LlmErrorKind, detail: string | null = null) {
    super(kind);
    this.name = 'LlmError';
    this.kind = kind;
    this.detail = detail;
  }
}

let client: BedrockRuntimeClient | undefined;

function getClient(): BedrockRuntimeClient {
  // maxAttempts 1: 재시도는 마감을 넘기기 쉽다. 실패는 파이프라인의 대체 동작으로 처리한다.
  client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION, maxAttempts: 1 });
  return client;
}

export interface InvokeJsonArgs<S extends z.ZodType> {
  modelId: string;
  system: string;
  user: string;
  maxTokens: number;
  schema: S;
  signal: AbortSignal;
}

export async function invokeJson<S extends z.ZodType>(args: InvokeJsonArgs<S>): Promise<z.infer<S>> {
  const body = {
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    max_tokens: args.maxTokens,
    temperature: 0,
    reasoning_effort: 'none',
  };
  let raw: unknown;
  try {
    const res = await getClient().send(
      new InvokeModelCommand({
        modelId: args.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      }),
      { abortSignal: args.signal },
    );
    raw = JSON.parse(new TextDecoder().decode(res.body));
  } catch (err) {
    if (args.signal.aborted) throw new LlmError('timeout');
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    throw new LlmError('bedrock_error', `${e.name ?? 'Error'} ${e.$metadata?.httpStatusCode ?? ''}`.trim());
  }
  const content = (raw as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new LlmError('invalid_json');
  const parsed = extractJson(content);
  if (parsed === undefined) throw new LlmError('invalid_json');
  const result = args.schema.safeParse(parsed);
  if (!result.success) throw new LlmError('schema_mismatch');
  return result.data;
}

/** 텍스트에서 첫 JSON 객체 하나를 꺼낸다. 코드 펜스와 앞뒤 설명을 무시한다. 없으면 undefined. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
