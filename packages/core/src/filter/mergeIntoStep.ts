import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { stepRating } from './stepRating.ts';

export function mergeIntoStep(step: Step, reviews: Review[], addedIds: string[]): Step {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of [...step.ids, ...addedIds]) {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ...step, ids, rating: stepRating(ids, reviews) };
}
