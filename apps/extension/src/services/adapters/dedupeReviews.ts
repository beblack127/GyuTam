// 임시: 재현의 @star-laundry/core dedupeReviews가 올라오면 교체
// 형식 근거: api-contract.md 핵심 함수 표의 `dedupeReviews(best, latest)`.
// 베스트 목록을 먼저 순서대로 넣고(같은 id는 처음 것), 그다음 최신 목록 중 아직 없는 id만 순서대로 넣는다.
// 입력 배열과 리뷰 객체는 바꾸지 않는다.

import type { IntakeSources, Review } from './intakeTypes';

function uniqueIds(list: readonly Review[]): Set<string> {
  const ids = new Set<string>();
  for (const review of list) ids.add(review.id);
  return ids;
}

export function dedupeReviews(
  best: readonly Review[],
  latest: readonly Review[],
): { reviews: Review[]; sources: IntakeSources } {
  const bestIds = uniqueIds(best);
  const latestIds = uniqueIds(latest);

  let duplicates = 0;
  for (const id of latestIds) {
    if (bestIds.has(id)) duplicates += 1;
  }

  const seen = new Set<string>();
  const reviews: Review[] = [];
  for (const review of [...best, ...latest]) {
    if (seen.has(review.id)) continue;
    seen.add(review.id);
    reviews.push(review);
  }

  return {
    reviews,
    sources: { best: bestIds.size, latest: latestIds.size, duplicates },
  };
}
