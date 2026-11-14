import type { Conditions } from '../types/ask.ts';
import type { Review } from '../types/review.ts';
import { normalizeLoose } from '../utils/normalizeText.ts';

// 정해진 조건만 코드로 거른다. semantic, undefined 필드, 빈 배열은 무시한다 (Requirement 13).
export function applyConditions(reviews: Review[], conditions: Conditions): Review[] {
  const { rating, date, hasPhoto, source } = conditions;
  const option = nonEmpty(conditions.option);
  const includes = nonEmpty(conditions.includes);
  const excludes = nonEmpty(conditions.excludes);

  return reviews.filter((r) => {
    if (rating?.min !== undefined && r.rating < rating.min) return false;
    if (rating?.max !== undefined && r.rating > rating.max) return false;
    if (date?.from !== undefined && r.date < date.from) return false;
    if (date?.to !== undefined && r.date > date.to) return false;
    if (hasPhoto !== undefined && r.hasPhoto !== hasPhoto) return false;
    if (source !== undefined && r.source !== source) return false;
    if (option) {
      if (r.option === null) return false;
      const opt = normalizeLoose(r.option);
      if (!option.some((o) => opt.includes(o))) return false;
    }
    if (includes || excludes) {
      const text = normalizeLoose(r.text);
      if (includes && !includes.every((w) => text.includes(w))) return false;
      if (excludes && excludes.some((w) => text.includes(w))) return false;
    }
    return true;
  });
}

function nonEmpty(list: string[] | undefined): string[] | null {
  const items = (list ?? []).map(normalizeLoose).filter((s) => s !== '');
  return items.length > 0 ? items : null;
}
