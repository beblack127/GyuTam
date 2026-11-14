import type { Source } from './review.ts';
import type { Cited } from './wash.ts';

export interface Conditions {
  rating?: { min?: number; max?: number };
  date?: { from?: string; to?: string };
  hasPhoto?: boolean;
  source?: Source;
  option?: string[];
  includes?: string[];
  excludes?: string[];
  semantic?: string | null;
}

export interface Match {
  id: string;
  quote: string | null;
}

export interface Step {
  request: string;
  label: string;
  conditions: Conditions;
  ids: string[];
  rating: { average: number | null; count: number };
  summary: Cited[];
  pros: Cited[];
  cons: Cited[];
}
