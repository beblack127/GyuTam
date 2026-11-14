import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BEST, LATEST, PRODUCT_ID, createHarness, makeRaw, okResponse } from './__fixtures__/adapterHarness';
import type { SortBy } from './__fixtures__/adapterHarness';
import { runCoupangIntake } from './coupangAdapter';
import { MAX_REVIEWS, PAGES_PER_SORT, PAGE_SIZE } from './intakeConstants';

// 가상 Raw_Review만 쓴다. 실제 리뷰 원문 없음.
// 작은 id 풀(1~30)로 페이지 안, 페이지 사이, Sort 사이 겹침을 자주 만든다.
const ID_POOL_MAX = 30;

/** 페이지 하나: Raw_Review id 0~10개. 꽉 찬 페이지(10개)에 가중치를 둬 뒤 페이지까지 자주 요청되게 한다. */
const pageArb = fc.oneof(
  { arbitrary: fc.array(fc.integer({ min: 1, max: ID_POOL_MAX }), { minLength: PAGE_SIZE, maxLength: PAGE_SIZE }), weight: 3 },
  { arbitrary: fc.array(fc.integer({ min: 1, max: ID_POOL_MAX }), { maxLength: PAGE_SIZE }), weight: 1 },
);

/** Sort 하나: 0~5페이지. 준비한 페이지를 넘는 요청은 빈 페이지로 답한다. */
const sortPagesArb = fc.array(pageArb, { maxLength: PAGES_PER_SORT });

describe('runCoupangIntake 속성', () => {
  // Feature: review-intake, Property 2: 입고 결과의 리뷰 수는 중복을 뺀 고유 ID 수와 같다
  // **Validates: Requirements 6.4, 8.5**
  it('P2: 입고 결과 리뷰 수는 고유 ID 수와 같다', async () => {
    await fc.assert(
      fc.asyncProperty(sortPagesArb, sortPagesArb, async (bestPages, latestPages) => {
        const pagesBySort: Record<SortBy, number[][]> = { [BEST]: bestPages, [LATEST]: latestPages };
        const h = createHarness({
          respond: ({ sortBy, page }) => okResponse((pagesBySort[sortBy][page - 1] ?? []).map(makeRaw)),
        });

        const result = await runCoupangIntake(PRODUCT_ID, h.deps);

        // 기대값: 어댑터가 실제로 요청한 페이지들의 고유 id
        const fetchedIds = new Set<string>();
        for (const call of h.calls) {
          const params = new URL(call.url).searchParams;
          const ids = pagesBySort[params.get('sortBy') as SortBy][Number(params.get('page')) - 1] ?? [];
          for (const id of ids) fetchedIds.add(`cp-${id}`);
        }

        const resultIds = result.reviews.map((r) => r.id);
        expect(result.partial).toBe(false);
        expect(new Set(resultIds).size).toBe(result.reviews.length);
        expect(new Set(resultIds)).toEqual(fetchedIds);
        expect(result.reviews.length).toBeLessThanOrEqual(MAX_REVIEWS);
        expect(result.reviews.length).toBe(
          result.sources.best + result.sources.latest - result.sources.duplicates,
        );
      }),
      { numRuns: 100 },
    );
  });
});
