import type { Review } from '../types/review.ts';
import type { Receipt } from '../types/wash.ts';

/**
 * 베스트순·최신순 입고 결과를 합친다. best 우선, 첫 등장 순서를 지키고
 * 남은 리뷰의 `source`를 출처로 덮어쓴다. 입력 배열과 리뷰 객체는 바꾸지 않는다.
 */
export function dedupeReviews(
  best: Review[],
  latest: Review[],
): { reviews: Review[]; sources: Receipt['sources'] } {
  const seen = new Set<string>();
  const reviews: Review[] = [];

  for (const review of best) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    reviews.push({ ...review, source: 'best' });
  }
  for (const review of latest) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    reviews.push({ ...review, source: 'latest' });
  }

  return {
    reviews,
    sources: {
      best: best.length,
      latest: latest.length,
      duplicates: best.length + latest.length - reviews.length,
    },
  };
}
