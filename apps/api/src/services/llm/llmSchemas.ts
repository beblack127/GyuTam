// LLM 응답 스키마. 항목 하나가 틀려도 묶음 전체를 버리지 않도록 배열은 unknown으로 받고 항목별로 검사한다.
import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const star = z.number().int().min(1).max(5);
const strings = z.array(z.string());

export const judgeTag = z.object({
  id: z.string(),
  stain: z.enum(['none', 'certain', 'suspected']),
  signal: z.enum(['platform_badge', 'disclosure', 'review_event', 'suspected']).nullable().catch(null),
  evidence: z.string().nullable().catch(null),
});

export const judgeOutput = z.object({ tags: z.array(z.unknown()) });

export const cited = z.object({ text: z.string(), reviewIds: strings });

export const summaryOutput = z.object({
  summary: z.array(z.unknown()).catch([]),
  pros: z.array(z.unknown()).optional().catch(undefined),
  cons: z.array(z.unknown()).optional().catch(undefined),
});

// 필드마다 catch로 받아서, 한 필드가 틀려도 나머지 조건은 쓴다. null도 "없음"으로 본다.
export const interpretOutput = z.object({
  conditions: z
    .object({
      rating: z
        .object({ min: star.optional().catch(undefined), max: star.optional().catch(undefined) })
        .optional()
        .catch(undefined),
      date: z
        .object({ from: ymd.optional().catch(undefined), to: ymd.optional().catch(undefined) })
        .optional()
        .catch(undefined),
      lastDays: z.number().int().min(1).max(3650).optional().catch(undefined),
      hasPhoto: z.boolean().optional().catch(undefined),
      source: z.enum(['best', 'latest']).optional().catch(undefined),
      option: strings.optional().catch(undefined),
      includes: strings.optional().catch(undefined),
      excludes: strings.optional().catch(undefined),
      semantic: z.string().nullable().optional().catch(null),
    })
    .catch({}),
  label: z.string().catch(''),
  unsupported: z.string().nullable().catch(null),
  answerable: z.boolean().catch(true),
});

export const selectMatch = z.object({ id: z.string(), quote: z.string() });

export const selectOutput = z.object({ matches: z.array(z.unknown()).catch([]) });

/** 배열 항목 중 스키마에 맞는 것만 남긴다. */
export function keepValid<S extends z.ZodType>(items: unknown[] | undefined, schema: S): z.infer<S>[] {
  const out: z.infer<S>[] = [];
  for (const item of items ?? []) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}
