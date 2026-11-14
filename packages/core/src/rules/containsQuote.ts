import { normalizeForQuote } from '../utils/normalizeText.ts';

export function containsQuote(text: string, quote: string): boolean {
  const q = normalizeForQuote(quote);
  if (q.length === 0) return false;
  return normalizeForQuote(text).includes(q);
}
