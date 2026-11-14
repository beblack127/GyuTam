// 테스트 전용 fast-check 생성기 (design "테스트 데이터"). index.ts에서 내보내지 않는다.
import fc from 'fast-check';

import type { Conditions, Step } from '../types/ask.ts';
import type { Review, Source } from '../types/review.ts';
import type { Cited, Signal, Stain, WashTag } from '../types/wash.ts';
import {
  DISCLOSURE_PHRASES,
  NEGATIONS,
  PLATFORM_BADGE_TERM,
  PLATFORM_NOTICE,
  REVIEW_EVENT_PHRASES,
} from '../rules/stainKeywords.ts';

/** 리뷰와 단계가 같이 쓰는 작은 ID 풀. 충돌이 자주 나게 한다. */
export const ID_POOL: readonly string[] = Array.from({ length: 20 }, (_, i) => `cp-${i}`);

/** 가상 리뷰 문장 조각 (AI로 만든 문장, 실존 업체·인물 없음). */
const SENTENCE_FRAGMENTS = [
  '충전 속도가 빨라요.',
  '생각보다 무거워요',
  '발열이 좀 있습니다.',
  '케이블이 짧아서 아쉬워요',
  '디자인이 예쁘고 가볍습니다!',
  '두 번 충전하면 다 닳아요…',
  '배송이 빨랐어요 👍',
  '가성비 좋아요',
  '제공받은 거 아니고 내돈내산입니다',
  '체험단 아닙니다',
] as const;

const PUNCTUATION = [' ', '\n', '.', ',', '!', '?', '~', '😊'] as const;

/** 리뷰 본문과 조건이 같이 쓰는 조각 풀. 조건이 실제로 걸리게 한다. */
export const TEXT_FRAGMENTS: readonly string[] = [
  ...SENTENCE_FRAGMENTS,
  ...DISCLOSURE_PHRASES,
  ...REVIEW_EVENT_PHRASES,
  ...NEGATIONS,
  PLATFORM_NOTICE,
];

export const OPTION_POOL: readonly string[] = ['블랙', '화이트', '10000mAh', '20000mAh 화이트'];

const BADGE_SETS: readonly string[][] = [[], [`쿠팡${PLATFORM_BADGE_TERM}`], ['베스트']];

const MIN_DATE = new Date('2025-01-01T00:00:00Z');
const MAX_DATE = new Date('2026-12-31T00:00:00Z');

export const arbId: fc.Arbitrary<string> = fc.constantFrom(...ID_POOL);

export const arbDate: fc.Arbitrary<string> = fc
  .date({ min: MIN_DATE, max: MAX_DATE, noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

export const arbText: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: fc.constantFrom(...TEXT_FRAGMENTS) },
      { weight: 2, arbitrary: fc.constantFrom(...PUNCTUATION) },
      { weight: 1, arbitrary: fc.string({ maxLength: 10 }) },
    ),
    { maxLength: 8 },
  )
  .map((parts) => parts.join(''));

export const arbReview: fc.Arbitrary<Review> = fc.record({
  id: arbId,
  rating: fc.constantFrom(1 as const, 2 as const, 3 as const, 4 as const, 5 as const),
  date: arbDate,
  text: arbText,
  badges: fc.constantFrom(...BADGE_SETS).map((b) => [...b]),
  hasPhoto: fc.boolean(),
  option: fc.option(fc.constantFrom(...OPTION_POOL), { nil: null }),
  source: fc.constantFrom<Source>('best', 'latest'),
});

export const arbUniqueReviews: fc.Arbitrary<Review[]> = fc.uniqueArray(arbReview, {
  selector: (r) => r.id,
  maxLength: ID_POOL.length,
});

/** 코드 포인트 단위 부분 문자열 (서로게이트 쌍을 자르지 않음). */
export function codePointSlice(s: string, a: number, b?: number): string {
  return Array.from(s).slice(a, b).join('');
}

/** 원문의 코드 포인트 부분 문자열. */
export function arbSubstringOf(text: string): fc.Arbitrary<string> {
  const len = Array.from(text).length;
  return fc
    .tuple(fc.nat({ max: len }), fc.nat({ max: len }))
    .map(([x, y]) => codePointSlice(text, Math.min(x, y), Math.max(x, y)));
}

const NOT_IN_TEXT_MARKER = '§원문에없는문장§';

/** 리뷰에 대한 임의 LLM 태그. evidence는 null, 원문 부분 문자열, 원문에 없는 문자열 중 하나. */
export function arbWashTagFor(review: Review): fc.Arbitrary<WashTag> {
  return fc.record({
    id: fc.constant(review.id),
    stain: fc.constantFrom<Stain>('none', 'certain', 'suspected'),
    signal: fc.option(
      fc.constantFrom<Signal>('platform_badge', 'disclosure', 'review_event', 'suspected'),
      { nil: null },
    ),
    evidence: fc.oneof(
      fc.constant(null),
      arbSubstringOf(review.text),
      fc.string({ maxLength: 10 }).map((s) => `${NOT_IN_TEXT_MARKER}${s}`),
    ),
    include: fc.boolean(),
  });
}

export const arbConditions: fc.Arbitrary<Conditions> = fc.record(
  {
    rating: fc.record(
      { min: fc.integer({ min: 1, max: 5 }), max: fc.integer({ min: 1, max: 5 }) },
      { requiredKeys: [] },
    ),
    date: fc.record({ from: arbDate, to: arbDate }, { requiredKeys: [] }),
    hasPhoto: fc.boolean(),
    source: fc.constantFrom<Source>('best', 'latest'),
    option: fc.array(fc.constantFrom(...OPTION_POOL), { maxLength: 2 }),
    includes: fc.array(fc.constantFrom(...TEXT_FRAGMENTS), { maxLength: 2 }),
    excludes: fc.array(fc.constantFrom(...TEXT_FRAGMENTS), { maxLength: 2 }),
    semantic: fc.option(fc.constantFrom('발볼 넓은 사람', '캠핑용', '발열'), { nil: null }),
  },
  { requiredKeys: [] },
);

/** 같은 ID 풀의 부분집합. 빈 배열과 풀 전체를 포함한다. */
export const arbIdSubset: fc.Arbitrary<string[]> = fc.subarray([...ID_POOL]);

const arbCited: fc.Arbitrary<Cited> = fc.record({
  text: fc.constantFrom(...SENTENCE_FRAGMENTS),
  reviewIds: fc.uniqueArray(arbId, { minLength: 1, maxLength: 3 }),
});

function arbStepWithIds(ids: fc.Arbitrary<string[]>): fc.Arbitrary<Step> {
  return fc.record({
    request: fc.string({ maxLength: 20 }),
    label: fc.string({ maxLength: 20 }),
    conditions: arbConditions,
    ids,
    rating: fc.record({
      average: fc.option(
        fc.integer({ min: 10, max: 50 }).map((n) => n / 10),
        { nil: null },
      ),
      count: fc.nat({ max: ID_POOL.length }),
    }),
    summary: fc.array(arbCited, { maxLength: 3 }),
    pros: fc.array(arbCited, { maxLength: 3 }),
    cons: fc.array(arbCited, { maxLength: 3 }),
  });
}

export const arbStep: fc.Arbitrary<Step> = arbStepWithIds(
  fc.uniqueArray(arbId, { maxLength: ID_POOL.length }),
);

export const arbSteps: fc.Arbitrary<Step[]> = fc.array(arbStep, { minLength: 0, maxLength: 5 });

/** 각 단계 ids가 직전 단계 ids의 부분 시퀀스인 단계 배열 (P16 중첩 체인). */
export const arbNestedSteps: fc.Arbitrary<Step[]> = fc
  .nat({ max: 5 })
  .chain((n) => buildNested(n, [...ID_POOL]));

function buildNested(n: number, parentIds: string[]): fc.Arbitrary<Step[]> {
  if (n === 0) return fc.constant([]);
  return fc
    .subarray(parentIds)
    .chain((ids) =>
      fc
        .tuple(arbStepWithIds(fc.constant(ids)), buildNested(n - 1, ids))
        .map(([step, rest]) => [step, ...rest]),
    );
}

/** 입력 불변 검사용. 객체·배열을 재귀적으로 얼린다. */
export function deepFreeze<T>(x: T): T {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}
