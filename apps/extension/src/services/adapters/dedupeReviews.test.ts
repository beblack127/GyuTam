import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { dedupeReviews } from './dedupeReviews';
import type { Review, Source } from './intakeTypes';

// 가상 리뷰만 쓴다. 실제 리뷰 원문 없음.
function makeReview(id: string, source: Source, text = `가상 리뷰 ${id}`): Review {
  return {
    id,
    rating: 4,
    date: '2025-01-01',
    text,
    badges: [],
    hasPhoto: false,
    photos: [],
    option: null,
    source,
  };
}

const ids = (list: readonly Review[]): string[] => list.map((r) => r.id);

// 작은 id 풀(cp-1 ~ cp-6)로 목록 안·목록 사이 겹침을 자주 만든다.
const ID_POOL = ['cp-1', 'cp-2', 'cp-3', 'cp-4', 'cp-5', 'cp-6'];

function reviewListArb(source: Source): fc.Arbitrary<Review[]> {
  return fc.array(
    fc.record({
      id: fc.constantFrom(...ID_POOL),
      rating: fc.constantFrom(1, 2, 3, 4, 5) as fc.Arbitrary<Review['rating']>,
      text: fc.string({ maxLength: 20 }),
    }),
    { maxLength: 12 },
  ).map((items) =>
    items.map(({ id, rating, text }) => ({ ...makeReview(id, source, text), rating })),
  );
}

describe('dedupeReviews', () => {
  // Feature: review-intake, Property 1: 입고 중복 제거는 멱등이고 결과 ID는 모두 다르다
  // **Validates: Requirements 8.2, 8.3**
  it('P1: 입고 중복 제거는 멱등이다', () => {
    fc.assert(
      fc.property(reviewListArb('best'), reviewListArb('latest'), (best, latest) => {
        const bestSnapshot = structuredClone(best);
        const latestSnapshot = structuredClone(latest);

        const r = dedupeReviews(best, latest);

        // 결과 id는 모두 다르다
        expect(new Set(ids(r.reviews)).size).toBe(r.reviews.length);

        // 두 번 적용해도 같다
        expect(dedupeReviews(r.reviews, []).reviews).toEqual(r.reviews);
        expect(dedupeReviews(r.reviews, r.reviews).reviews).toEqual(r.reviews);

        // 같은 id는 best에서 처음 나온 리뷰, 한 목록 안에서는 처음 나온 리뷰
        for (const review of r.reviews) {
          const firstBest = best.find((b) => b.id === review.id);
          const expected = firstBest ?? latest.find((l) => l.id === review.id);
          expect(review).toBe(expected);
          if (firstBest) expect(review.source).toBe('best');
        }

        // 결과 id 집합은 입력 id 합집합과 같다
        expect(new Set(ids(r.reviews))).toEqual(new Set([...ids(best), ...ids(latest)]));

        // sources 합계
        expect(r.sources.best + r.sources.latest - r.sources.duplicates).toBe(r.reviews.length);

        // 입력 불변
        expect(best).toEqual(bestSnapshot);
        expect(latest).toEqual(latestSnapshot);
      }),
      { numRuns: 100 },
    );
  });

  it('베스트순 리뷰를 먼저, 최신순에만 있는 리뷰를 그 뒤에 읽은 순서대로 둔다', () => {
    const best = [makeReview('cp-3', 'best'), makeReview('cp-1', 'best')];
    const latest = [
      makeReview('cp-5', 'latest'),
      makeReview('cp-1', 'latest'),
      makeReview('cp-2', 'latest'),
    ];

    const { reviews } = dedupeReviews(best, latest);

    expect(ids(reviews)).toEqual(['cp-3', 'cp-1', 'cp-5', 'cp-2']);
    expect(reviews.map((r) => r.source)).toEqual(['best', 'best', 'latest', 'latest']);
    expect(reviews[1]).toBe(best[1]);
  });

  it('한 목록 안에서 같은 id가 다시 나오면 처음 것만 남긴다', () => {
    const first = makeReview('cp-1', 'latest', '처음 가상 문장');
    const again = makeReview('cp-1', 'latest', '나중 가상 문장');

    const { reviews, sources } = dedupeReviews([], [first, makeReview('cp-2', 'latest'), again]);

    expect(ids(reviews)).toEqual(['cp-1', 'cp-2']);
    expect(reviews[0]).toBe(first);
    expect(sources).toEqual({ best: 0, latest: 2, duplicates: 0 });
  });

  it('sources에 Sort별 고유 리뷰 수와 겹친 수를 담는다', () => {
    const best = [
      makeReview('cp-1', 'best'),
      makeReview('cp-2', 'best'),
      makeReview('cp-2', 'best'),
      makeReview('cp-3', 'best'),
    ];
    const latest = [
      makeReview('cp-3', 'latest'),
      makeReview('cp-4', 'latest'),
      makeReview('cp-1', 'latest'),
      makeReview('cp-4', 'latest'),
    ];

    const { reviews, sources } = dedupeReviews(best, latest);

    expect(sources).toEqual({ best: 3, latest: 3, duplicates: 2 });
    expect(reviews).toHaveLength(4);
  });

  it('빈 입력은 빈 결과와 0인 sources를 돌려준다', () => {
    expect(dedupeReviews([], [])).toEqual({
      reviews: [],
      sources: { best: 0, latest: 0, duplicates: 0 },
    });
  });
});
