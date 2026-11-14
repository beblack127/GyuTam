import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { arbId, arbStep, arbSteps, deepFreeze } from '../utils/testArbitraries.ts';
import { MAX_STEPS, popStep, pushStep, resetSteps } from './steps.ts';

const arbNonEmptyStep = fc
  .tuple(arbStep, fc.uniqueArray(arbId, { minLength: 1 }))
  .map(([step, ids]) => ({ ...step, ids }));
const arbShortSteps = arbSteps.map((s) => s.slice(0, MAX_STEPS - 1));
const arbFullSteps = fc.array(arbStep, { minLength: MAX_STEPS, maxLength: MAX_STEPS });

describe('steps', () => {
  /** **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7** */
  it('P14: popStep(pushStep(s, x))는 s와 같다', () => {
    fc.assert(
      fc.property(arbShortSteps, arbNonEmptyStep, (s, x) => {
        deepFreeze(s);
        deepFreeze(x);
        const pushed = pushStep(s, x);
        expect(pushed).toEqual([...s, x]);
        expect(popStep(pushed)).toEqual(s);
      }),
    );
    fc.assert(
      fc.property(arbSteps, arbStep, (s, x) => {
        deepFreeze(s);
        const rejected = pushStep(s, { ...x, ids: [] });
        expect(rejected).toEqual(s);
        expect(rejected).not.toBe(s);
        expect(popStep(s)).toEqual(s.slice(0, -1));
        expect(resetSteps()).toEqual([]);
      }),
    );
    fc.assert(
      fc.property(arbFullSteps, arbNonEmptyStep, (s, x) => {
        expect(pushStep(s, x)).toEqual(s);
      }),
    );
  });

  it('6번째 push는 거절한다', () => {
    const step = { request: 'q', label: 'l', conditions: {}, ids: ['cp-1'], rating: { average: 5, count: 1 }, summary: [], pros: [], cons: [] };
    let steps = resetSteps();
    for (let i = 0; i < 6; i++) steps = pushStep(steps, step);
    expect(steps).toHaveLength(5);
    expect(popStep([])).toEqual([]);
  });
});
