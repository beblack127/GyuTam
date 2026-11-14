// Lambda 진입점: POST /ask
import { createBedrockLlmCalls, readLlmEnv } from '../services/llm/llmCalls.ts';
import type { LlmCalls } from '../services/llm/llmCalls.ts';
import { runAsk } from '../services/wash/askPipeline.ts';
import { handleJson } from '../utils/http.ts';
import type { HttpEvent, HttpResult } from '../utils/http.ts';
import { askRequest } from '../utils/requestSchemas.ts';

let llm: LlmCalls | undefined;

export async function handler(event: HttpEvent): Promise<HttpResult> {
  return handleJson(event, '/ask', askRequest, (body, clock) => {
    llm ??= createBedrockLlmCalls(readLlmEnv(process.env));
    return runAsk(body, llm, clock);
  });
}
