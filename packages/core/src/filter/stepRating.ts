// 내부 함수. index.ts에서 내보내지 않는다.
import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';

export function stepRating(_ids: string[], _reviews: Review[]): Step['rating'] {
  // TODO(wash-rules task 10.1)
  return { average: null, count: 0 };
}
