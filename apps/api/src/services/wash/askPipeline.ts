// POST /ask: 해석 → 정해진 조건 필터(코드) → 의미 조건 고르기 → 검수 → 평균 별점(코드) → 요약.
import { applyConditions, averageRating, verifyCitations, verifyMatches } from '@star-laundry/core';
import type { Cited, Conditions, Match, Review } from '@star-laundry/core';

import { beforeDeadline, systemClock } from '../../utils/deadline.ts';
import type { Clock, Deadlines } from '../../utils/deadline.ts';
import type { AskRequest } from '../../utils/requestSchemas.ts';
import type { Interpretation, LlmCalls, SummaryOutput } from '../llm/llmCalls.ts';
import { chunk, errorKind, runBatches } from './batches.ts';

export const NO_MATCH_NOTICE = '관련된 리뷰를 찾을 수 없습니다.';
/** 결과가 이보다 적으면 장점·단점 없이 요약만 쓴다 (api-contract.md). */
export const PROS_CONS_MIN = 4;

export interface AskResponse {
  conditions: Conditions;
  label: string;
  unsupported: string | null;
  matches: Match[];
  matched: number;
  rating: { average: number | null; count: number };
  summary: Cited[];
  pros: Cited[];
  cons: Cited[];
  notice: string | null;
}

export interface AskStats {
  reviews: number;
  batches: number;
  matched: number;
  summaryError: string | null;
}

/** /ask 해석이나 고르기가 실패했다. 핸들러가 503으로 바꾼다. */
export class LlmUnavailable extends Error {
  stage: 'interpret' | 'select';
  kinds: string[];
  constructor(stage: 'interpret' | 'select', kinds: string[]) {
    super('llm_unavailable');
    this.name = 'LlmUnavailable';
    this.stage = stage;
    this.kinds = kinds;
  }
}

const EMPTY_SUMMARY: SummaryOutput = { summary: [], pros: [], cons: [] };

export async function runAsk(
  body: AskRequest,
  llm: LlmCalls,
  clock: Deadlines,
  now: Clock = systemClock,
): Promise<{ response: AskResponse; stats: AskStats }> {
  const reviews = body.reviews as Review[];
  const stats: AskStats = { reviews: reviews.length, batches: 0, matched: 0, summaryError: null };

  let it: Interpretation;
  try {
    it = await beforeDeadline(
      (s) => llm.interpret({ request: body.request, history: body.history, today: body.today }, s),
      clock.interpretEnd,
      now,
    );
  } catch (err) {
    throw new LlmUnavailable('interpret', [errorKind(err)]);
  }

  if (!it.answerable) return finish(noMatch(it), stats);

  const filtered = applyConditions(reviews, it.conditions);
  const semantic = it.conditions.semantic?.trim() || null;

  let matches: Match[];
  if (!semantic) {
    matches = filtered.map((r) => ({ id: r.id, quote: null }));
  } else {
    const groups = chunk(filtered.map((r) => ({ id: r.id, text: r.text })));
    stats.batches = groups.length;
    const res = await runBatches(groups, (b, s) => llm.select(b, semantic, s), clock.selectEnd, now);
    // 일부 묶음만 고른 목록을 완전한 결과처럼 보여주지 않는다.
    if (res.failed > 0) throw new LlmUnavailable('select', res.errorKinds);
    matches = inInputOrder(filtered, verifyMatches(filtered, res.ok.flat()));
  }

  // 입고한 리뷰 안에서만 찾는다. 더 불러오지 않는다 (Requirement 12, fairness.md 요청 10번).
  if (matches.length === 0) return finish(noMatch(it), stats);

  const ids = new Set(matches.map((m) => m.id));
  const matchedReviews = reviews.filter((r) => ids.has(r.id));
  const withProsCons = matches.length >= PROS_CONS_MIN;

  let summary = EMPTY_SUMMARY;
  try {
    summary = await beforeDeadline(
      (s) =>
        llm.summarize(
          matchedReviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text })),
          { topic: semantic, withProsCons },
          s,
        ),
      clock.summaryEnd,
      now,
    );
  } catch (err) {
    stats.summaryError = errorKind(err);
  }

  const allowed = [...ids];
  return finish(
    {
      conditions: it.conditions,
      label: it.label,
      unsupported: it.unsupported,
      matches,
      matched: matches.length,
      rating: { average: averageRating(matchedReviews), count: matches.length },
      summary: verifyCitations(summary.summary, allowed),
      pros: withProsCons ? verifyCitations(summary.pros, allowed) : [],
      cons: withProsCons ? verifyCitations(summary.cons, allowed) : [],
      notice: null,
    },
    stats,
  );
}

export function noMatch(it: Interpretation): AskResponse {
  return {
    conditions: it.conditions,
    label: it.label,
    unsupported: it.unsupported,
    matches: [],
    matched: 0,
    rating: { average: null, count: 0 },
    summary: [],
    pros: [],
    cons: [],
    notice: NO_MATCH_NOTICE,
  };
}

function finish(response: AskResponse, stats: AskStats): { response: AskResponse; stats: AskStats } {
  stats.matched = response.matched;
  return { response, stats };
}

/** 검수를 통과한 매치를 입력 리뷰 순서로 정렬하고, 같은 id는 처음 것만 둔다. */
function inInputOrder(reviews: Review[], matches: Match[]): Match[] {
  const quoteById = new Map<string, string | null>();
  for (const m of matches) if (!quoteById.has(m.id)) quoteById.set(m.id, m.quote);
  return reviews.filter((r) => quoteById.has(r.id)).map((r) => ({ id: r.id, quote: quoteById.get(r.id) ?? null }));
}
