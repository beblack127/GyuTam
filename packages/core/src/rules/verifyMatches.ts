import type { Match } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { containsQuote } from './containsQuote.ts';

// 부분 세탁 결과 검수 (Requirement 14). 입력에 없는 ID, 원문에 없는 quote를 가진 항목을 버린다.
// seen은 통과한 항목만 기록해서, 같은 ID의 앞 항목이 떨어지면 뒤의 유효한 항목이 남는다.
export function verifyMatches(reviews: Review[], matches: Match[]): Match[] {
  const byId = new Map<string, Review>();
  for (const r of reviews) if (!byId.has(r.id)) byId.set(r.id, r);

  const seen = new Set<string>();
  const out: Match[] = [];
  for (const m of matches) {
    const review = byId.get(m.id);
    if (!review) continue;
    if (m.quote !== null && !containsQuote(review.text, m.quote)) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id, quote: m.quote });
  }
  return out;
}
