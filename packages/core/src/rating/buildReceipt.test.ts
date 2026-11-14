import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { WashTag } from '../types/wash.ts';
import { dedupeReviews } from '../utils/dedupeReviews.ts';
import { arbReview, arbWashTagFor, deepFreeze } from '../utils/testArbitraries.ts';
import { buildReceipt } from './buildReceipt.ts';

/** 임의 리뷰(같은 ID 포함)에 대한 임의 태그 배열. 입력에 없는 ID, 중복 ID 태그가 섞인다. */
const arbTags: fc.Arbitrary<WashTag[]> = fc
  .array(arbReview, { maxLength: 30 })
  .chain((rs) => fc.tuple(...rs.map(arbWashTagFor)));

describe('buildReceipt', () => {
  it('예시: api-contract.md 응답 예시 형태의 receipt 숫자를 만든다', () => {
    const [a, b, c] = fc.sample(arbReview, { numRuns: 3, seed: 2 });
    const best = [
      { ...a, id: 'cp-0', rating: 5 as const },
      { ...b, id: 'cp-1', rating: 4 as const },
    ];
    const latest = [
      { ...c, id: 'cp-1', rating: 1 as const },
      { ...c, id: 'cp-2', rating: 3 as const },
    ];
    const { reviews, sources } = dedupeReviews(best, latest);
    const tags: WashTag[] = [
      { id: 'cp-0', stain: 'certain', signal: 'platform_badge', evidence: null, include: false },
      { id: 'cp-1', stain: 'none', signal: null, evidence: null, include: true },
    ];
    expect(buildReceipt(reviews, tags, sources, false)).toEqual({
      basedOn: 3,
      sources: { best: 2, latest: 2, duplicates: 1 },
      before: 4,
      after: 3.5,
      stains: { platform_badge: 1, disclosure: 0, review_event: 0, suspected: 0 },
      removed: 1,
      partial: false,
    });
  });

  // **Validates: Requirements 5.5, 11.1**
  it('P2: basedOn은 중복 제거 후 리뷰 수와 같다', () => {
    fc.assert(
      fc.property(
        fc.array(arbReview, { maxLength: 30 }),
        fc.array(arbReview, { maxLength: 30 }),
        arbTags,
        fc.boolean(),
        (best, latest, tags, partial) => {
          const { reviews, sources } = dedupeReviews(deepFreeze(best), deepFreeze(latest));
          const receipt = buildReceipt(reviews, deepFreeze(tags), sources, partial);
          expect(receipt.basedOn).toBe(reviews.length);
          expect(receipt.sources.duplicates).toBe(best.length + latest.length - reviews.length);
        },
      ),
    );
  });
});
