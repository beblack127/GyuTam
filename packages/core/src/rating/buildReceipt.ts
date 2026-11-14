import type { Review } from '../types/review.ts';
import type { Receipt, ReceiptCounts, Signal, WashTag } from '../types/wash.ts';
import { averageRating } from './averageRating.ts';

export function buildReceipt(
  reviews: Review[],
  tags: WashTag[],
  sources: Receipt['sources'],
  partial: boolean,
): ReceiptCounts {
  // 같은 ID 태그가 여러 개면 첫 번째만 쓴다. 입력에 없는 ID의 태그는 조회되지 않아 무시된다.
  const tagById = new Map<string, WashTag>();
  for (const tag of tags) {
    if (!tagById.has(tag.id)) tagById.set(tag.id, tag);
  }

  const stains: Record<Signal, number> = {
    platform_badge: 0,
    disclosure: 0,
    review_event: 0,
    suspected: 0,
  };
  const included: Review[] = [];
  let removed = 0;

  for (const review of reviews) {
    const tag = tagById.get(review.id); // 태그 없음 = none / include true
    if (tag && tag.stain !== 'none') stains[tag.signal ?? 'suspected'] += 1;
    if (tag && !tag.include) removed += 1;
    else included.push(review);
  }

  return {
    basedOn: reviews.length,
    sources: { ...sources },
    before: averageRating(reviews),
    after: averageRating(included),
    stains,
    removed,
    partial,
  };
}
