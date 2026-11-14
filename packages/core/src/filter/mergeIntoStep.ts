import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';

export function mergeIntoStep(step: Step, _reviews: Review[], _addedIds: string[]): Step {
  // TODO(wash-rules task 10.3)
  return { ...step };
}
