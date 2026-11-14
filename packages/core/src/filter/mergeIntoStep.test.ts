import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { averageRating } from '../rating/averageRating.ts';
import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { arbId, arbReview, arbStep, deepFreeze } from '../utils/testArbitraries.ts';
import { mergeIntoStep } from './mergeIntoStep.ts';

// 오라클: stepRating.ts를 쓰지 않고 첫 등장 byId를 따로 만든다.
function oracleRating(ids: string[], reviews: Review[]) {
  const byId = new Map<string, Review>();
  for (const r of reviews) if (!byId.has(r.id)) byId.set(r.id, r);
  const picked = ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
  return { average: averageRating(picked), count: ids.length };
}

function firstOccurrence(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}

// 작은 ID 풀이라 같은 ID가 두 번 나오는 리뷰 배열과 addedIds가 생긴다.
const arbReviews = fc.array(arbReview, { maxLength: 30 });
const arbIds = fc.array(arbId, { maxLength: 25 });
// step.ids에도 중복이 있는 경우를 섞는다 (Requirement 20.5).
const arbAnyStep: fc.Arbitrary<Step> = fc.oneof(
  arbStep,
  fc.tuple(arbStep, arbIds).map(([s, ids]) => ({ ...s, ids })),
);

describe('mergeIntoStep', () => {
  /** **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5** */
  it('P17: 바탕 넓히기는 합집합을 만들고 평균을 다시 계산한다', () => {
    fc.assert(
      fc.property(arbAnyStep, arbReviews, arbIds, (step, reviews, addedIds) => {
        deepFreeze(step);
        deepFreeze(reviews);
        deepFreeze(addedIds);
        const m = mergeIntoStep(step, reviews, addedIds);
        expect(m.ids).toEqual(firstOccurrence([...step.ids, ...addedIds]));
        expect(new Set(m.ids).size).toBe(m.ids.length);
        expect(new Set(m.ids)).toEqual(new Set([...step.ids, ...addedIds]));
        expect(m.rating).toEqual(oracleRating(m.ids, reviews));
        expect(m.request).toBe(step.request);
        expect(m.label).toBe(step.label);
        expect(m.conditions).toEqual(step.conditions);
        expect(m.summary).toEqual(step.summary);
        expect(m.pros).toEqual(step.pros);
        expect(m.cons).toEqual(step.cons);
      }),
    );
  });

  const review = (id: string, rating: Review['rating']): Review => ({
    id, rating, date: '2026-10-01', text: '가성비 좋아요', badges: [], hasPhoto: false, option: null, source: 'best',
  });
  const step = (ids: string[]): Step => ({
    request: 'q', label: 'l', conditions: {}, ids, rating: { average: null, count: 0 }, summary: [], pros: [], cons: [],
  });

  it('이미 있는 ID를 더하면 중복 없음', () => {
    const reviews = [review('cp-1', 5), review('cp-2', 2), review('cp-3', 4)];
    const m = mergeIntoStep(step(['cp-1', 'cp-2']), reviews, ['cp-2', 'cp-3']);
    expect(m.ids).toEqual(['cp-1', 'cp-2', 'cp-3']);
    expect(m.rating).toEqual({ average: 3.7, count: 3 });
  });

  it('빈 addedIds면 ids 그대로, rating은 다시 계산', () => {
    const reviews = [review('cp-1', 5), review('cp-2', 2)];
    const m = mergeIntoStep(step(['cp-1', 'cp-2']), reviews, []);
    expect(m.ids).toEqual(['cp-1', 'cp-2']);
    expect(m.rating).toEqual({ average: 3.5, count: 2 });
  });
});
