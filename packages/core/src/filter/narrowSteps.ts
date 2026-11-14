import { verifyCitations } from '../rules/verifyCitations.ts';
import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { stepRating } from './stepRating.ts';

// 바탕 좁히기 (기본 → 섬세). 입력을 바꾸지 않는다.
export function narrowSteps(steps: Step[], reviews: Review[], allowedIds: string[]): Step[] {
  const allowed = new Set(allowedIds);
  const out: Step[] = [];
  for (const step of steps) {
    const ids = step.ids.filter((id) => allowed.has(id));
    if (ids.length === 0) break; // 비게 된 단계부터 뒤는 잘라낸다
    out.push({
      request: step.request,
      label: step.label,
      conditions: step.conditions,
      ids,
      rating: stepRating(ids, reviews),
      summary: verifyCitations(step.summary, ids),
      pros: verifyCitations(step.pros, ids),
      cons: verifyCitations(step.cons, ids),
    });
  }
  return out;
}
