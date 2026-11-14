import type { Cited } from '../types/wash.ts';

export function verifyCitations(cited: Cited[], allowedIds: string[]): Cited[] {
  const allowed = new Set(allowedIds);
  const out: Cited[] = [];
  for (const c of cited) {
    if (c.text.trim() === '') continue;
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const id of c.reviewIds) {
      if (!allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (ids.length === 0) continue;
    out.push({ text: c.text, reviewIds: ids });
  }
  return out;
}
