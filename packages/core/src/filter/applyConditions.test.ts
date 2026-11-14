import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import powerbank from '../../__fixtures__/powerbank.json' with { type: 'json' };
import type { Conditions } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { normalizeLoose } from '../utils/normalizeText.ts';
import { arbConditions, arbReview } from '../utils/testArbitraries.ts';
import { applyConditions } from './applyConditions.ts';

// 오라클: design 표를 필드별 술어로 따로 쓴다. applyConditions.ts의 구현은 쓰지 않는다.
function cleaned(list: string[] | undefined): string[] {
  return (list ?? []).map(normalizeLoose).filter((s) => s !== '');
}

function oracle(c: Conditions): (r: Review) => boolean {
  const option = cleaned(c.option);
  const includes = cleaned(c.includes);
  const excludes = cleaned(c.excludes);
  const preds: ((r: Review) => boolean)[] = [];
  if (c.rating?.min !== undefined) preds.push((r) => r.rating >= c.rating!.min!);
  if (c.rating?.max !== undefined) preds.push((r) => r.rating <= c.rating!.max!);
  if (c.date?.from !== undefined) preds.push((r) => r.date >= c.date!.from!);
  if (c.date?.to !== undefined) preds.push((r) => r.date <= c.date!.to!);
  if (c.hasPhoto !== undefined) preds.push((r) => r.hasPhoto === c.hasPhoto);
  if (c.source !== undefined) preds.push((r) => r.source === c.source);
  if (option.length > 0)
    preds.push((r) => r.option !== null && option.some((o) => normalizeLoose(r.option!).includes(o)));
  if (includes.length > 0) preds.push((r) => includes.every((w) => normalizeLoose(r.text).includes(w)));
  if (excludes.length > 0) preds.push((r) => !excludes.some((w) => normalizeLoose(r.text).includes(w)));
  return (r) => preds.every((p) => p(r));
}

// 정규화 후 빈 항목(Requirement 13.11)과 대소문자·공백 변형이 실제로 섞이게 한다.
const arbNoisyItem = fc.constantFrom(' ', '\n', '', '  \t');
function withNoise(list: fc.Arbitrary<string[] | undefined>): fc.Arbitrary<string[] | undefined> {
  return fc
    .tuple(list, fc.array(arbNoisyItem, { maxLength: 2 }), fc.boolean())
    .map(([l, noise, upper]) => {
      if (l === undefined) return noise.length > 0 ? noise : undefined;
      const items = upper ? l.map((s) => ` ${s.toUpperCase()} `) : l;
      return [...items, ...noise];
    });
}

const arbNoisyConditions: fc.Arbitrary<Conditions> = arbConditions.chain((c) =>
  fc
    .record({
      option: withNoise(fc.constant(c.option)),
      includes: withNoise(fc.constant(c.includes)),
      excludes: withNoise(fc.constant(c.excludes)),
    })
    .map((extra) => {
      const out: Conditions = { ...c };
      for (const k of ['option', 'includes', 'excludes'] as const) {
        if (extra[k] === undefined) delete out[k];
        else out[k] = extra[k];
      }
      return out;
    }),
);

const arbReviews = fc.array(arbReview, { maxLength: 25 });
const arbSemantic = fc.option(fc.string({ maxLength: 10 }), { nil: null });

describe('applyConditions', () => {
  // Feature: wash-rules, Property 11 (P11): 정해진 조건 필터는 정확하다
  // **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12**
  it('P11: 결과는 오라클 술어로 거른 입력과 같고 semantic과 무관하다', () => {
    fc.assert(
      fc.property(fc.oneof(arbConditions, arbNoisyConditions), arbReviews, arbSemantic, (c, reviews, sem) => {
        const expected = reviews.filter(oracle(c));
        expect(applyConditions(reviews, c)).toEqual(expected);
        expect(applyConditions(reviews, { ...c, semantic: sem })).toEqual(expected);
        const { semantic: _drop, ...noSemantic } = c;
        expect(applyConditions(reviews, noSemantic)).toEqual(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('예시: fixture에서 "사진 있음", "3점 이하"', () => {
    const reviews = powerbank as Review[];
    const photo = applyConditions(reviews, { hasPhoto: true });
    expect(photo.length).toBeGreaterThan(0);
    expect(photo).toEqual(reviews.filter((r) => r.hasPhoto));
    const low = applyConditions(reviews, { rating: { max: 3 } });
    expect(low).toEqual(reviews.filter((r) => r.rating <= 3));
    expect(applyConditions(reviews, {})).toEqual(reviews);
  });
});
