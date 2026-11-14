import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { averageRating } from '../rating/averageRating.ts';
import { verifyCitations } from '../rules/verifyCitations.ts';
import type { Step } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import {
  arbIdSubset,
  arbNestedSteps,
  arbReview,
  arbSteps,
  deepFreeze,
} from '../utils/testArbitraries.ts';
import { narrowSteps } from './narrowSteps.ts';

// 오라클: stepRating.ts를 쓰지 않고 첫 등장 byId를 따로 만든다.
function oracleRating(ids: string[], reviews: Review[]) {
  const byId = new Map<string, Review>();
  for (const r of reviews) if (!byId.has(r.id)) byId.set(r.id, r);
  const picked = ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
  return { average: averageRating(picked), count: ids.length };
}

// 작은 ID 풀이라 같은 ID가 두 번 나오는 리뷰 배열이 생긴다.
const arbReviews = fc.array(arbReview, { maxLength: 30 });

function checkNarrow(steps: Step[], reviews: Review[], allowedIds: string[]) {
  deepFreeze(steps);
  deepFreeze(reviews);
  deepFreeze(allowedIds);
  const out = narrowSteps(steps, reviews, allowedIds);
  const allowed = new Set(allowedIds);
  let k = steps.findIndex((s) => s.ids.filter((id) => allowed.has(id)).length === 0);
  if (k === -1) k = steps.length;
  expect(out).toHaveLength(k);
  out.forEach((o, i) => {
    const ids = steps[i].ids.filter((id) => allowed.has(id));
    expect(o.ids).toEqual(ids);
    expect(o.rating).toEqual(oracleRating(ids, reviews));
    expect(o.summary).toEqual(verifyCitations(steps[i].summary, ids));
    expect(o.pros).toEqual(verifyCitations(steps[i].pros, ids));
    expect(o.cons).toEqual(verifyCitations(steps[i].cons, ids));
    expect(o.request).toBe(steps[i].request);
    expect(o.label).toBe(steps[i].label);
    expect(o.conditions).toEqual(steps[i].conditions);
  });
  return out;
}

describe('narrowSteps', () => {
  /** **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10** */
  it('P16: 바탕 좁히기는 허용 ID로 단계를 줄이고 평균을 다시 계산한다', () => {
    fc.assert(
      fc.property(arbSteps, arbReviews, arbIdSubset, (steps, reviews, allowedIds) => {
        checkNarrow(steps, reviews, allowedIds);
      }),
    );
    fc.assert(
      fc.property(arbNestedSteps, arbReviews, arbIdSubset, (steps, reviews, allowedIds) => {
        const out = checkNarrow(steps, reviews, allowedIds);
        const allowed = new Set(allowedIds);
        out.forEach((o, i) => {
          expect(o.ids.every((id) => allowed.has(id))).toBe(true);
          if (i > 0) {
            const prev = new Set(out[i - 1].ids);
            expect(o.ids.every((id) => prev.has(id))).toBe(true);
          }
        });
      }),
    );
  });

  const review = (id: string, rating: Review['rating']): Review => ({
    id, rating, date: '2026-10-01', text: '가성비 좋아요', badges: [], hasPhoto: false, option: null, source: 'best',
  });
  const step = (ids: string[], summary: Step['summary'] = []): Step => ({
    request: 'q', label: 'l', conditions: {}, ids, rating: { average: null, count: 0 }, summary, pros: [], cons: [],
  });

  it('둘째 단계가 비면 첫 단계만 남는다', () => {
    const reviews = [review('cp-1', 5), review('cp-2', 2), review('cp-3', 4)];
    const out = narrowSteps([step(['cp-1', 'cp-2', 'cp-3']), step(['cp-2'])], reviews, ['cp-1', 'cp-3']);
    expect(out).toHaveLength(1);
    expect(out[0].ids).toEqual(['cp-1', 'cp-3']);
    expect(out[0].rating).toEqual({ average: 4.5, count: 2 });
  });

  it('근거 ID가 모두 빠진 요약 문장은 지운다', () => {
    const summary = [
      { text: '빠질 문장', reviewIds: ['cp-2'] },
      { text: '남을 문장', reviewIds: ['cp-1', 'cp-2'] },
    ];
    const out = narrowSteps([step(['cp-1', 'cp-2'], summary)], [review('cp-1', 5)], ['cp-1']);
    expect(out[0].summary).toEqual([{ text: '남을 문장', reviewIds: ['cp-1'] }]);
  });

  it('빈 steps면 []', () => {
    expect(narrowSteps([], [], ['cp-1'])).toEqual([]);
  });
});
