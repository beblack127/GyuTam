import type { Review } from '../types/review.ts';
import type { Receipt } from '../types/wash.ts';

export function dedupeReviews(
  _best: Review[],
  _latest: Review[],
): { reviews: Review[]; sources: Receipt['sources'] } {
  // TODO(wash-rules task 3.1)
  return { reviews: [], sources: { best: 0, latest: 0, duplicates: 0 } };
}
