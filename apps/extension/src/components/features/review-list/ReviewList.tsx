import { useEffect } from 'react';

import type { Review, WashTag } from '@star-laundry/core';

import ReviewCard from './ReviewCard';

interface Props {
  reviews: Review[];
  tags: Map<string, WashTag>;
  quotes?: Map<string, string | null>;
  focus: { ids: string[]; key: number } | null;
  empty?: string;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ReviewList({ reviews, tags, quotes, focus, empty = '보여줄 리뷰가 없어요.' }: Props) {
  // 요약 문장을 누르면 첫 근거 리뷰 카드로 스크롤한다.
  useEffect(() => {
    const first = focus?.ids.find((id) => reviews.some((r) => r.id === id));
    if (!first) return;
    const el = document.querySelector(`[data-review-id="${CSS.escape(first)}"]`);
    el?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  }, [focus, reviews]);

  if (reviews.length === 0) return <p className="empty">{empty}</p>;
  const focused = new Set(focus?.ids ?? []);
  return (
    <div className="review-list">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} tag={tags.get(r.id)} quote={quotes?.get(r.id)} focused={focused.has(r.id)} />
      ))}
    </div>
  );
}

export default ReviewList;
