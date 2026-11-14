import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';

export function narrowSteps(steps: Step[], _reviews: Review[], _allowedIds: string[]): Step[] {
  // TODO(wash-rules task 10.2)
  return steps.slice();
}
