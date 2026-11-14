// POST /wash: 애벌빨래 → 본세탁 → 검수 → 세탁 후 요약. 숫자와 검증은 코어 함수만 쓴다.
import {
  applyStrict,
  buildReceipt,
  detectCertainStains,
  verifyCitations,
  verifyJudgments,
} from '@star-laundry/core';
import type { Receipt, Review, WashTag } from '@star-laundry/core';

import { beforeDeadline, systemClock } from '../../utils/deadline.ts';
import type { Clock, Deadlines } from '../../utils/deadline.ts';
import type { WashRequest } from '../../utils/requestSchemas.ts';
import type { LlmCalls, SummaryInput, SummaryOutput } from '../llm/llmCalls.ts';
import { chunk, errorKind, runBatches } from './batches.ts';

export interface WashResponse {
  tags: WashTag[];
  receipt: Receipt;
}

export interface WashStats {
  reviews: number;
  batches: number;
  failedBatches: number;
  partial: boolean;
  summaryError: string | null;
  errorKinds: string[];
}

const EMPTY_SUMMARY: SummaryOutput = { summary: [], pros: [], cons: [] };

export async function runWash(
  body: WashRequest,
  llm: LlmCalls,
  clock: Deadlines,
  now: Clock = systemClock,
): Promise<{ response: WashResponse; stats: WashStats }> {
  const reviews = body.reviews as Review[];
  const ruleTags = detectCertainStains(reviews);
  let partial = body.partial ?? false;
  let batches = 0;
  let failedBatches = 0;
  let errorKinds: string[] = [];

  let judged: WashTag[];
  if (body.tags) {
    // strict만 바꿔 다시 세탁: 본세탁을 건너뛰고 받은 판정을 다시 검수한다.
    judged = verifyJudgments(reviews, ruleTags, body.tags);
  } else {
    const ruleStain = new Map(ruleTags.map((t) => [t.id, t.stain]));
    const pending = reviews
      .filter((r) => (ruleStain.get(r.id) ?? 'none') === 'none')
      .map((r) => ({ id: r.id, text: r.text }));
    const groups = chunk(pending);
    batches = groups.length;
    const res = await runBatches(groups, (b, s) => llm.judge(b, s), clock.judgeEnd, now);
    failedBatches = res.failed;
    errorKinds = res.errorKinds;
    if (res.failed > 0) partial = true;
    judged = verifyJudgments(reviews, ruleTags, res.ok.flat());
  }

  const tags = applyStrict(judged, body.strict);
  const counts = buildReceipt(reviews, tags, body.sources ?? countSources(reviews), partial);

  const includeIds = new Set(tags.filter((t) => t.include).map((t) => t.id));
  const included: SummaryInput[] = reviews
    .filter((r) => includeIds.has(r.id))
    .map((r) => ({ id: r.id, rating: r.rating, text: r.text }));

  let summary = EMPTY_SUMMARY;
  let summaryError: string | null = null;
  if (included.length > 0) {
    try {
      summary = await beforeDeadline(
        (s) => llm.summarize(included, { topic: null, withProsCons: true }, s),
        clock.summaryEnd,
        now,
      );
    } catch (err) {
      summaryError = errorKind(err);
    }
  }

  const allowed = [...includeIds];
  return {
    response: {
      tags,
      receipt: {
        ...counts,
        summary: verifyCitations(summary.summary, allowed),
        pros: verifyCitations(summary.pros, allowed),
        cons: verifyCitations(summary.cons, allowed),
      },
    },
    stats: { reviews: reviews.length, batches, failedBatches, partial, summaryError, errorKinds },
  };
}

/** 요청에 sources가 없을 때: source 필드로 개수를 센다. 중복 수는 알 수 없어 0. */
export function countSources(reviews: Review[]): Receipt['sources'] {
  let best = 0;
  let latest = 0;
  for (const r of reviews) {
    if (r.source === 'best') best++;
    else latest++;
  }
  return { best, latest, duplicates: 0 };
}
