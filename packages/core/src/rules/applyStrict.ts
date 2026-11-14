import type { WashTag } from '../types/wash.ts';

/** 섬세 세탁 적용. stain·signal·evidence는 그대로 두고 include만 다시 정한다. */
export function applyStrict(tags: WashTag[], strict: boolean): WashTag[] {
  return tags.map((t) => ({
    ...t,
    include: t.stain === 'none' || (t.stain === 'suspected' && !strict),
  }));
}
