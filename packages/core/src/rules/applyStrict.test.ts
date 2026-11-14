import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { arbUniqueReviews, arbWashTagFor } from '../utils/testArbitraries.ts';
import { applyStrict } from './applyStrict.ts';

const arbTags = arbUniqueReviews.chain((reviews) => fc.tuple(...reviews.map(arbWashTagFor)));

function includedIds(tags: { id: string; include: boolean }[]): Set<string> {
  return new Set(tags.filter((t) => t.include).map((t) => t.id));
}

describe('applyStrict', () => {
  // Feature: wash-rules, Property 3 (P3): strict의 include 집합은 기본 세탁 include 집합에 포함된다
  // **Validates: Requirements 9.6**
  it('P3: strict는 포함 집합을 줄이기만 한다', () => {
    fc.assert(
      fc.property(arbTags, (tags) => {
        const strictIds = includedIds(applyStrict(tags, true));
        const basicIds = includedIds(applyStrict(tags, false));
        for (const id of strictIds) expect(basicIds.has(id)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
