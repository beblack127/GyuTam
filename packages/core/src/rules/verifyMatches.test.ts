import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Match } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { arbId, arbReview, arbSubstringOf, arbUniqueReviews } from '../utils/testArbitraries.ts';
import { containsQuote } from './containsQuote.ts';
import { verifyMatches } from './verifyMatches.ts';

// LLM이 낼 수 있는 Match: 입력 밖 ID, quote null, 원문 부분 문자열, 원문에 없는 문자열, 같은 ID 반복.
function arbMatchesFor(reviews: Review[]): fc.Arbitrary<Match[]> {
  const fromReview: fc.Arbitrary<Match>[] = reviews.map((r) =>
    fc.record({
      id: fc.constant(r.id),
      quote: fc.oneof(
        fc.constant(null),
        arbSubstringOf(r.text),
        fc.string({ maxLength: 10 }).map((s) => `§원문에없는문장§${s}`),
      ),
    }),
  );
  const random: fc.Arbitrary<Match> = fc.record({
    id: fc.oneof(arbId, fc.constant('not-in-input')),
    quote: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
  });
  return fc.array(fromReview.length > 0 ? fc.oneof(random, ...fromReview) : random, {
    maxLength: 12,
  });
}

// 같은 ID가 여러 번 있는 리뷰 배열도 넣는다 (byId는 첫 번째 리뷰 기준).
const arbReviews: fc.Arbitrary<Review[]> = fc.oneof(
  arbUniqueReviews,
  fc.array(arbReview, { maxLength: 12 }),
);

describe('verifyMatches', () => {
  it('P9: /ask의 quote는 항상 원문에 들어 있다', () => {
    // **Validates: Requirements 14.2, 14.6**
    fc.assert(
      fc.property(
        arbReviews.chain((reviews) => fc.tuple(fc.constant(reviews), arbMatchesFor(reviews))),
        ([reviews, matches]) => {
          const firstById = new Map<string, Review>();
          for (const r of reviews) if (!firstById.has(r.id)) firstById.set(r.id, r);
          for (const m of verifyMatches(reviews, matches)) {
            if (m.quote === null) continue;
            const review = firstById.get(m.id);
            expect(review).toBeDefined();
            expect(containsQuote(review!.text, m.quote)).toBe(true);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
