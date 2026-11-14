import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Review } from '../types/review.ts';
import type { WashTag } from '../types/wash.ts';
import { arbUniqueReviews, arbWashTagFor } from '../utils/testArbitraries.ts';
import { containsQuote } from './containsQuote.ts';
import { detectCertainStains } from './detectCertainStains.ts';
import { verifyJudgments } from './verifyJudgments.ts';

// 리뷰 배열과, 그 리뷰들에 대한 임의 LLM 태그(일부 누락·순서 섞임)
const arbInput = arbUniqueReviews.chain((reviews) =>
  fc
    .tuple(...reviews.map(arbWashTagFor))
    .chain((tags) => fc.shuffledSubarray(tags))
    .map((llmTags) => ({ reviews, llmTags })),
);

function evidenceInText(reviews: Review[], tags: WashTag[]): void {
  const byId = new Map(reviews.map((r) => [r.id, r]));
  for (const t of tags) {
    if (t.evidence === null) continue;
    const review = byId.get(t.id);
    expect(review).toBeDefined();
    expect(containsQuote(review!.text, t.evidence)).toBe(true);
  }
}

describe('verifyJudgments', () => {
  // Feature: wash-rules, Property 6 (P6): evidence가 null이 아니면 항상 원문에 들어 있다
  // **Validates: Requirements 6.3, 6.4, 6.5, 6.11, 8.12**
  it('P6: 규칙·검수 결과의 evidence는 null이거나 원문에 있다', () => {
    fc.assert(
      fc.property(arbInput, ({ reviews, llmTags }) => {
        const ruleTags = detectCertainStains(reviews);
        evidenceInText(reviews, ruleTags);
        evidenceInText(reviews, verifyJudgments(reviews, ruleTags, llmTags));
      }),
      { numRuns: 200 },
    );
  });

  it('LLM certain + 원문 문장 → certain 유지', () => {
    const review: Review = {
      id: 'cp-1',
      rating: 5,
      date: '2026-01-01',
      text: '판매자에게 샘플을 받아서 써 봤어요. 충전이 빨라요.',
      badges: [],
      hasPhoto: false,
      option: null,
      source: 'best',
    };
    const llm: WashTag = {
      id: 'cp-1',
      stain: 'certain',
      signal: 'disclosure',
      evidence: '판매자에게 샘플을 받아서 써 봤어요',
      include: false,
    };
    const [tag] = verifyJudgments([review], detectCertainStains([review]), [llm]);
    expect(tag.stain).toBe('certain');
    expect(tag.evidence).toBe(llm.evidence);
  });
});
