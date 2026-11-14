// Lambda 진입점: POST /wash
import { createBedrockLlmCalls, readLlmEnv } from '../services/llm/llmCalls.ts';
import type { LlmCalls } from '../services/llm/llmCalls.ts';
import { runWash } from '../services/wash/washPipeline.ts';
import { handleJson } from '../utils/http.ts';
import type { HttpEvent, HttpResult } from '../utils/http.ts';
import { washRequest } from '../utils/requestSchemas.ts';

let llm: LlmCalls | undefined;

export async function handler(event: HttpEvent): Promise<HttpResult> {
  return handleJson(event, '/wash', washRequest, (body, clock) => {
    llm ??= createBedrockLlmCalls(readLlmEnv(process.env));
    return runWash(body, llm, clock);
  });
}
