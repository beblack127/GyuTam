// 파이프라인이 아는 유일한 LLM 경계. 테스트는 이 인터페이스의 가짜 구현을 넣는다.
import type { Cited, Conditions, Match, WashTag } from '@star-laundry/core';

import { INTERPRET_SYSTEM, interpretUser } from '../../prompts/interpretPrompt.ts';
import { JUDGE_SYSTEM, judgeUser } from '../../prompts/judgePrompt.ts';
import { SELECT_SYSTEM, selectUser } from '../../prompts/selectPrompt.ts';
import { SUMMARY_SYSTEM, summaryUser } from '../../prompts/summaryPrompt.ts';
import { invokeJson } from './bedrockClient.ts';
import {
  cited,
  interpretOutput,
  judgeOutput,
  judgeTag,
  keepValid,
  selectMatch,
  selectOutput,
  summaryOutput,
} from './llmSchemas.ts';

export interface JudgeInput {
  id: string;
  text: string;
}
export interface SummaryInput {
  id: string;
  rating: number;
  text: string;
}
export interface SummaryOutput {
  summary: Cited[];
  pros: Cited[];
  cons: Cited[];
}
export interface Interpretation {
  conditions: Conditions;
  label: string;
  unsupported: string | null;
  answerable: boolean;
}

export interface LlmCalls {
  judge(batch: JudgeInput[], signal: AbortSignal): Promise<WashTag[]>;
  summarize(
    reviews: SummaryInput[],
    opts: { topic: string | null; withProsCons: boolean },
    signal: AbortSignal,
  ): Promise<SummaryOutput>;
  interpret(input: { request: string; history: string[]; today: string }, signal: AbortSignal): Promise<Interpretation>;
  select(batch: JudgeInput[], semantic: string, signal: AbortSignal): Promise<Match[]>;
}

export interface LlmEnv {
  judgeModelId: string;
  summaryModelId: string;
}

export const LABEL_MAX = 30;

export function readLlmEnv(env: Record<string, string | undefined>): LlmEnv {
  const judgeModelId = env.BEDROCK_JUDGE_MODEL_ID;
  const summaryModelId = env.BEDROCK_SUMMARY_MODEL_ID;
  if (!judgeModelId || !summaryModelId || !env.AWS_REGION) throw new Error('missing_env');
  return { judgeModelId, summaryModelId };
}

export function createBedrockLlmCalls(env: LlmEnv): LlmCalls {
  return {
    async judge(batch, signal) {
      const out = await invokeJson({
        modelId: env.judgeModelId,
        system: JUDGE_SYSTEM,
        user: judgeUser(batch),
        maxTokens: 3000,
        schema: judgeOutput,
        signal,
      });
      // include는 뒤의 applyStrict가 다시 정한다. 검증은 verifyJudgments가 한다.
      return keepValid(out.tags, judgeTag).map((t) => ({ ...t, include: true }));
    },

    async summarize(reviews, opts, signal) {
      const out = await invokeJson({
        modelId: env.summaryModelId,
        system: SUMMARY_SYSTEM,
        user: summaryUser(reviews, opts.topic, opts.withProsCons),
        maxTokens: 1500,
        schema: summaryOutput,
        signal,
      });
      return {
        summary: keepValid(out.summary, cited),
        pros: opts.withProsCons ? keepValid(out.pros, cited) : [],
        cons: opts.withProsCons ? keepValid(out.cons, cited) : [],
      };
    },

    async interpret(input, signal) {
      const out = await invokeJson({
        modelId: env.judgeModelId,
        system: INTERPRET_SYSTEM,
        user: interpretUser(input.request, input.history, input.today),
        maxTokens: 600,
        schema: interpretOutput,
        signal,
      });
      return {
        conditions: toConditions(out.conditions, input.today),
        label: (out.label.trim() || input.request.trim()).slice(0, LABEL_MAX),
        unsupported: out.unsupported?.trim() || null,
        answerable: out.answerable,
      };
    },

    async select(batch, semantic, signal) {
      const out = await invokeJson({
        modelId: env.judgeModelId,
        system: SELECT_SYSTEM,
        user: selectUser(semantic, batch),
        maxTokens: 3000,
        schema: selectOutput,
        signal,
      });
      return keepValid(out.matches, selectMatch);
    },
  };
}

type RawConditions = {
  rating?: { min?: number; max?: number };
  date?: { from?: string; to?: string };
  lastDays?: number;
  hasPhoto?: boolean;
  source?: 'best' | 'latest';
  option?: string[];
  includes?: string[];
  excludes?: string[];
  semantic?: string | null;
};

/** LLM 조건을 계약의 Conditions로 바꾼다. 빈 값은 지우고, lastDays는 코드가 date.from으로 바꾼다. */
export function toConditions(raw: RawConditions, today: string): Conditions {
  const c: Conditions = {};
  if (raw.rating && (raw.rating.min !== undefined || raw.rating.max !== undefined)) {
    c.rating = {};
    if (raw.rating.min !== undefined) c.rating.min = raw.rating.min;
    if (raw.rating.max !== undefined) c.rating.max = raw.rating.max;
  }
  const date: { from?: string; to?: string } = {};
  if (raw.date?.from) date.from = raw.date.from;
  if (raw.date?.to) date.to = raw.date.to;
  if (raw.lastDays !== undefined) date.from = daysBefore(today, raw.lastDays);
  if (date.from || date.to) c.date = date;
  if (raw.hasPhoto !== undefined) c.hasPhoto = raw.hasPhoto;
  if (raw.source) c.source = raw.source;
  const option = cleanList(raw.option);
  if (option) c.option = option;
  const includes = cleanList(raw.includes);
  if (includes) c.includes = includes;
  const excludes = cleanList(raw.excludes);
  if (excludes) c.excludes = excludes;
  c.semantic = raw.semantic?.trim() || null;
  return c;
}

/** today(YYYY-MM-DD)에서 days일 전 날짜. UTC 날짜로 계산한다. */
export function daysBefore(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const t = Date.UTC(y, m - 1, d) - days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function cleanList(list: string[] | undefined): string[] | undefined {
  const out = (list ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
  return out.length > 0 ? out : undefined;
}
