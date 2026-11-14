import type { Review } from '../types/review.ts';
import type { Receipt, ReceiptCounts, WashTag } from '../types/wash.ts';

export function buildReceipt(
  _reviews: Review[],
  _tags: WashTag[],
  _sources: Receipt['sources'],
  _partial: boolean,
): ReceiptCounts {
  // TODO(wash-rules task 6.2)
  return {
    basedOn: 0,
    sources: { best: 0, latest: 0, duplicates: 0 },
    before: null,
    after: null,
    stains: { platform_badge: 0, disclosure: 0, review_event: 0, suspected: 0 },
    removed: 0,
    partial: false,
  };
}
