import type { Review } from '../types/review.ts';

export function averageRating(reviews: Review[]): number | null {
  const n = reviews.length;
  if (n === 0) return null;
  let sum = 0;
  for (const review of reviews) sum += review.rating;
  return Math.round((sum * 10) / n) / 10;
}
