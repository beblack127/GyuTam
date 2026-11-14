import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { dedupeReviews } from './dedupeReviews.ts';
import { arbReview, deepFreeze } from './testArbitraries.ts';

describe('dedupeReviews', () => {
  it('예시: best·latest 겹침 1건은 best 쪽 값으로 하나만 남는다', () => {
    const [a, b, c] = fc.sample(arbReview, { numRuns: 3, seed: 1 });
    const best = [{ ...a, id: 'cp-0' }, { ...b, id: 'cp-1' }];
    const latest = [{ ...c, id: 'cp-1' }, { ...c, id: 'cp-2' }];
    const { reviews, sources } = dedupeReviews(best, latest);
    expect(reviews.map((r) => r.id)).toEqual(['cp-0', 'cp-1', 'cp-2']);
    expect(reviews[1]).toEqual({ ...b, id: 'cp-1', source: 'best' });
    expect(reviews[2].source).toBe('latest');
    expect(sources).toEqual({ best: 2, latest: 2, duplicates: 1 });
  });

  // **Validates: Requirements 5.1, 5.6**
  it('P1: 입고 중복 제거는 멱등이다', () => {
    fc.assert(
      fc.property(
        fc.array(arbReview, { maxLength: 30 }),
        fc.array(arbReview, { maxLength: 30 }),
        (best, latest) => {
          const r = dedupeReviews(deepFreeze(best), deepFreeze(latest)).reviews;
          const ids = r.map((x) => x.id);
          expect(new Set(ids).size).toBe(ids.length);
          const again = dedupeReviews(r, []).reviews;
          const againIds = again.map((x) => x.id);
          expect(againIds).toEqual(ids);
          expect(new Set(againIds).size).toBe(againIds.length);
          expect(again.map(({ source: _s, ...rest }) => rest)).toEqual(
            r.map(({ source: _s, ...rest }) => rest),
          );
        },
      ),
    );
  });
});
