import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Review } from '../types/review.ts';
import { arbReview, deepFreeze } from '../utils/testArbitraries.ts';
import { averageRating } from './averageRating.ts';

const withRatings = (ratings: Review['rating'][]): Review[] => {
  const [base] = fc.sample(arbReview, { numRuns: 1, seed: 4 });
  return ratings.map((rating, i) => ({ ...base, id: `cp-${i}`, rating }));
};

describe('averageRating', () => {
  it('예시: [4, 5] → 4.5, [4, 4, 5] → 4.3', () => {
    expect(averageRating(withRatings([4, 5]))).toBe(4.5);
    expect(averageRating(withRatings([4, 4, 5]))).toBe(4.3);
  });

  // **Validates: Requirements 10.1, 10.2**
  it('P4: 평균은 정수 오라클의 반올림과 같고 1.0~5.0 사이다', () => {
    fc.assert(
      fc.property(fc.array(arbReview, { minLength: 1, maxLength: 100 }), (reviews) => {
        const n = reviews.length;
        const sum = reviews.reduce((s, r) => s + r.rating, 0);
        const result = averageRating(deepFreeze(reviews));
        expect(result).toBe(Math.floor((20 * sum + n) / (2 * n)) / 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(5);
      }),
    );
  });
});
