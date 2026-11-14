// 내부 함수. index.ts에서 내보내지 않는다.
import { averageRating } from '../rating/averageRating.ts';
import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';

export function stepRating(ids: string[], reviews: Review[]): Step['rating'] {
  const byId = new Map<string, Review>();
  for (const r of reviews) if (!byId.has(r.id)) byId.set(r.id, r); // 첫 등장 기준
  const selected = ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
  return { average: averageRating(selected), count: ids.length };
}
