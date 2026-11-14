// /wash, /ask 요청 본문 검증. 알 수 없는 필드(photos 등)는 zod object가 버린다.
import { z } from 'zod';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const review = z.object({
  id: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  date: ymd,
  text: z.string().max(2000),
  badges: z.array(z.string().max(200)).max(20).default([]),
  hasPhoto: z.boolean().default(false),
  option: z.string().max(200).nullable().default(null),
  source: z.enum(['best', 'latest']),
});

const reviews = z.array(review).min(1).max(100);

const washTag = z.object({
  id: z.string(),
  stain: z.enum(['none', 'certain', 'suspected']),
  signal: z.enum(['platform_badge', 'disclosure', 'review_event', 'suspected']).nullable(),
  evidence: z.string().max(2000).nullable(),
  include: z.boolean(),
});

const count = z.number().int().min(0);

export const washRequest = z.object({
  site: z.literal('coupang'),
  strict: z.boolean(),
  reviews,
  tags: z.array(washTag).max(100).optional(),
  sources: z.object({ best: count, latest: count, duplicates: count }).optional(),
  partial: z.boolean().optional(),
});

export const askRequest = z.object({
  site: z.literal('coupang'),
  request: z.string().trim().min(1).max(200),
  today: ymd,
  history: z.array(z.string().max(200)).max(5).default([]),
  reviews,
});

export type WashRequest = z.infer<typeof washRequest>;
export type AskRequest = z.infer<typeof askRequest>;
