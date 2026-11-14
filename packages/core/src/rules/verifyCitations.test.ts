import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Match } from '../types/ask.ts';
import type { Cited } from '../types/wash.ts';
import {
  arbId,
  arbIdSubset,
  arbSubstringOf,
  arbText,
  arbUniqueReviews,
  arbWashTagFor,
} from '../utils/testArbitraries.ts';
import { applyStrict } from './applyStrict.ts';
import { verifyCitations } from './verifyCitations.ts';
import { verifyMatches } from './verifyMatches.ts';

// LLM이 낼 수 있는 Cited: 빈·공백 text, 빈 reviewIds, 중복 ID, 허용 밖 ID를 모두 포함한다.
const arbRawCited: fc.Arbitrary<Cited> = fc.record({
  text: fc.oneof(arbText, fc.constantFrom('', '   ', '\n')),
  reviewIds: fc.array(fc.oneof(arbId, fc.constant('not-in-input')), { maxLength: 5 }),
});
const arbCitedList = fc.array(arbRawCited, { maxLength: 6 });

function assertP8(result: Cited[], allowedIds: string[]): void {
  const allowed = new Set(allowedIds);
  for (const c of result) {
    expect(c.reviewIds.length).toBeGreaterThan(0);
    for (const id of c.reviewIds) expect(allowed.has(id)).toBe(true);
  }
}

describe('verifyCitations', () => {
  // Feature: wash-rules, Property 8 (P8): 요약 근거 ID는 비어 있지 않은 허용 ID 부분집합이다
  // **Validates: Requirements 12.1, 12.3, 12.6**
  it('P8: 임의 allowedIds에 대해 근거는 비어 있지 않은 허용 ID 부분집합이다', () => {
    fc.assert(
      fc.property(arbCitedList, arbIdSubset, (cited, allowedIds) => {
        assertP8(verifyCitations(cited, allowedIds), allowedIds);
      }),
      { numRuns: 200 },
    );
  });

  // **Validates: Requirements 12.1, 12.3, 12.6**
  it('P8: /wash 조합 (allowedIds = applyStrict 결과의 include: true ID)', () => {
    const arbInput = arbUniqueReviews.chain((reviews) =>
      fc.tuple(fc.tuple(...reviews.map(arbWashTagFor)), fc.boolean(), arbCitedList),
    );
    fc.assert(
      fc.property(arbInput, ([tags, strict, cited]) => {
        const allowedIds = applyStrict(tags, strict)
          .filter((t) => t.include)
          .map((t) => t.id);
        assertP8(verifyCitations(cited, allowedIds), allowedIds);
      }),
      { numRuns: 200 },
    );
  });

  // **Validates: Requirements 12.1, 12.3, 12.6**
  it('P8: /ask 조합 (allowedIds = verifyMatches 결과 ID)', () => {
    const arbInput = arbUniqueReviews.chain((reviews) => {
      const arbMatch: fc.Arbitrary<Match> =
        reviews.length === 0
          ? fc.record({ id: arbId, quote: fc.constant(null) })
          : fc.constantFrom(...reviews).chain((r) =>
              fc.record({
                id: fc.oneof(fc.constant(r.id), arbId),
                quote: fc.oneof(fc.constant(null), arbSubstringOf(r.text), fc.constant('§없는문장§')),
              }),
            );
      return fc.tuple(fc.constant(reviews), fc.array(arbMatch, { maxLength: 8 }), arbCitedList);
    });
    fc.assert(
      fc.property(arbInput, ([reviews, matches, cited]) => {
        const allowedIds = verifyMatches(reviews, matches).map((m) => m.id);
        assertP8(verifyCitations(cited, allowedIds), allowedIds);
      }),
      { numRuns: 200 },
    );
  });
});
