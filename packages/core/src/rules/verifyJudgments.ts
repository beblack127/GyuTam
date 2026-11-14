import type { Review } from '../types/review.ts';
import type { Signal, Stain, WashTag } from '../types/wash.ts';
import { containsQuote } from './containsQuote.ts';

const LLM_CERTAIN_SIGNALS: ReadonlySet<Signal> = new Set(['disclosure', 'review_event']);

/**
 * 규칙 판정과 LLM 판정을 합치고 근거를 검수한다 (Requirement 8).
 * 규칙 `certain`이 우선이고, LLM 판정은 evidence가 원문에 있을 때만 그 수준을 유지한다.
 * 검수에 실패하면 한 단계 낮추고 evidence를 null로 둔다.
 */
export function verifyJudgments(
  reviews: Review[],
  ruleTags: WashTag[],
  llmTags: WashTag[],
): WashTag[] {
  const ruleById = firstById(ruleTags);
  const llmById = firstById(llmTags);

  return reviews.map((review) => {
    const rule = ruleById.get(review.id) ?? noneTag(review.id);
    if (rule.stain === 'certain') return normalized(rule, review.id);

    const llm = llmById.get(review.id);
    if (!llm) return normalized(rule, review.id);

    const ok = llm.evidence !== null && containsQuote(review.text, llm.evidence);
    switch (llm.stain) {
      case 'certain':
        if (!ok) return make(review.id, 'suspected', 'suspected', null);
        if (llm.signal !== null && LLM_CERTAIN_SIGNALS.has(llm.signal)) {
          return make(review.id, 'certain', llm.signal, llm.evidence);
        }
        return make(review.id, 'suspected', 'suspected', llm.evidence);
      case 'suspected':
        if (!ok) return make(review.id, 'none', null, null);
        return make(review.id, 'suspected', 'suspected', llm.evidence);
      default:
        return make(review.id, 'none', null, null);
    }
  });
}

function firstById(tags: WashTag[]): Map<string, WashTag> {
  const map = new Map<string, WashTag>();
  for (const t of tags) if (!map.has(t.id)) map.set(t.id, t);
  return map;
}

function noneTag(id: string): WashTag {
  return make(id, 'none', null, null);
}

function make(id: string, stain: Stain, signal: Signal | null, evidence: string | null): WashTag {
  return { id, stain, signal, evidence, include: stain !== 'certain' };
}

/** 규칙 태그를 그대로 믿지 않고 형태만 정리한다. */
function normalized(tag: WashTag, id: string): WashTag {
  if (tag.stain === 'none') return make(id, 'none', null, null);
  if (tag.stain === 'suspected') return make(id, 'suspected', 'suspected', tag.evidence);
  return make(id, 'certain', tag.signal, tag.evidence);
}
