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

  // Feature: wash-rules, Property 7 (P7): 원문에 없는 evidence를 댄 LLM 판정은 한 단계 낮아진다
  // **Validates: Requirements 8.5, 8.6, 8.7**
  it('P7: evidence가 null이거나 원문에 없으면 LLM 판정이 한 단계 낮아진다', () => {
    const arbBadLlm = arbUniqueReviews.chain((reviews) =>
      fc
        .tuple(
          ...reviews.map((r) =>
            fc.record({
              id: fc.constant(r.id),
              stain: fc.constantFrom('certain' as const, 'suspected' as const),
              signal: fc.constantFrom('disclosure' as const, 'review_event' as const, 'suspected' as const, null),
              evidence: fc.option(
                fc.string({ minLength: 1 }).filter((e) => !containsQuote(r.text, e)),
                { nil: null },
              ),
              include: fc.boolean(),
            }),
          ),
        )
        .map((llmTags) => ({ reviews, llmTags: llmTags as WashTag[] })),
    );
    fc.assert(
      fc.property(arbBadLlm, ({ reviews, llmTags }) => {
        const ruleTags = detectCertainStains(reviews);
        const ruleCertain = new Set(ruleTags.filter((t) => t.stain === 'certain').map((t) => t.id));
        const llmById = new Map(llmTags.map((t) => [t.id, t]));
        for (const out of verifyJudgments(reviews, ruleTags, llmTags)) {
          if (ruleCertain.has(out.id)) continue;
          const llm = llmById.get(out.id)!;
          if (llm.stain === 'certain') {
            expect([out.stain, out.signal, out.evidence]).toEqual(['suspected', 'suspected', null]);
          } else {
            expect([out.stain, out.signal, out.evidence]).toEqual(['none', null, null]);
          }
        }
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
