import type { Review } from '../types/review.ts';
import type { Signal, WashTag } from '../types/wash.ts';
import { compact } from '../utils/normalizeText.ts';
import {
  DISCLOSURE_PHRASES,
  NEGATION_WINDOW,
  NEGATIONS,
  PLATFORM_BADGE_TERM,
  PLATFORM_NOTICE,
  REVIEW_EVENT_PHRASES,
} from './stainKeywords.ts';

type Range = { start: number; end: number };

const WHITESPACE = /\s/u;
const SENTENCE_BOUNDARY = /[.!?。…\n\r]/u;
const COMPACT_NEGATIONS = NEGATIONS.map(compact).filter((n) => n.length > 0);

// 애벌빨래: 우선순위 platform_badge(배지 → 고지 문장) → disclosure → review_event (design "detectCertainStains").
export function detectCertainStains(reviews: Review[]): WashTag[] {
  return reviews.map(detectOne);
}

function detectOne(review: Review): WashTag {
  const { id, text, badges } = review;
  const badgeTerm = compact(PLATFORM_BADGE_TERM);
  if (badgeTerm.length > 0 && badges.some((b) => compact(b).includes(badgeTerm))) {
    return certain(id, 'platform_badge', null);
  }

  // 쿠팡 고정 고지 문장은 부정 검사를 하지 않는다.
  const notice = findPhrase(text, PLATFORM_NOTICE)[0];
  if (notice) return certain(id, 'platform_badge', sentenceAround(text, notice.start, notice.end));

  const disclosure = firstUnnegated(text, DISCLOSURE_PHRASES);
  if (disclosure) return certain(id, 'disclosure', sentenceAround(text, disclosure.start, disclosure.end));

  const event = firstUnnegated(text, REVIEW_EVENT_PHRASES);
  if (event) return certain(id, 'review_event', sentenceAround(text, event.start, event.end));

  return { id, stain: 'none', signal: null, evidence: null, include: true };
}

function certain(id: string, signal: Signal, evidence: string | null): WashTag {
  return { id, stain: 'certain', signal, evidence, include: false };
}

// 모든 문구의 모든 등장 중 부정 창에 걸리지 않은, 원문 위치가 가장 앞인 것.
function firstUnnegated(text: string, phrases: readonly string[]): Range | null {
  let best: Range | null = null;
  for (const phrase of phrases) {
    for (const r of findPhrase(text, phrase)) {
      if (best && r.start >= best.start) break;
      if (!isNegated(text, r)) {
        best = r;
        break;
      }
    }
  }
  return best;
}

// 띄어쓰기 무시 검색. 원문 범위 [start, end) 목록을 원문 순서로 돌려준다.
function findPhrase(text: string, phrase: string): Range[] {
  const needle = compact(phrase);
  if (needle.length === 0) return [];
  let compactText = '';
  const indexMap: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (WHITESPACE.test(ch)) continue;
    compactText += ch;
    indexMap.push(i);
  }
  const ranges: Range[] = [];
  let from = 0;
  for (;;) {
    const at = compactText.indexOf(needle, from);
    if (at < 0) break;
    ranges.push({ start: indexMap[at]!, end: indexMap[at + needle.length - 1]! + 1 });
    from = at + 1;
  }
  return ranges;
}

function isNegated(text: string, { start, end }: Range): boolean {
  const window = compact(
    text.slice(Math.max(0, start - NEGATION_WINDOW), Math.min(text.length, end + NEGATION_WINDOW)),
  );
  return COMPACT_NEGATIONS.some((n) => window.includes(n));
}

// start 앞 마지막 경계 다음부터 end 이후 첫 경계(포함)까지. 항상 원문의 연속 부분 문자열이다.
function sentenceAround(text: string, start: number, end: number): string {
  let from = start;
  while (from > 0 && !SENTENCE_BOUNDARY.test(text[from - 1]!)) from--;
  let to = end;
  while (to < text.length && !SENTENCE_BOUNDARY.test(text[to]!)) to++;
  if (to < text.length) to++;
  return text.slice(from, to).trim();
}
