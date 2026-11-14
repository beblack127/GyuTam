import type { Step } from '../types/ask.ts';

export const MAX_STEPS = 5;

export function pushStep(steps: Step[], step: Step): Step[] {
  if (step.ids.length === 0 || steps.length >= MAX_STEPS) return steps.slice();
  return [...steps, step];
}

export function popStep(steps: Step[]): Step[] {
  return steps.slice(0, -1);
}

export function resetSteps(): Step[] {
  return [];
}
