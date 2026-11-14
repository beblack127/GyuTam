import { useEffect, useState } from 'react';

import type { Review, WashTag as Tag } from '@star-laundry/core';

import Stars from '@/components/common/Stars';
import WashTag from '@/components/features/wash-tag/WashTag';

import { highlight } from './highlight';

interface Props {
  review: Review;
  tag?: Tag;
  quote?: string | null;
  focused?: boolean;
}

const LONG = 110;

function formatDate(date: string) {
  return date.replaceAll('-', '.');
}

function ReviewCard({ review, tag, quote, focused }: Props) {
  const [open, setOpen] = useState(false);
  const long = review.text.length > LONG;

  useEffect(() => {
    if (focused) setOpen(true);
  }, [focused]);

  const marks = [
    ...(quote ? [{ phrase: quote, className: 'mark-quote' }] : []),
    ...(tag?.evidence && tag.stain !== 'none'
      ? [{ phrase: tag.evidence, className: tag.stain === 'certain' ? 'mark-certain' : 'mark-suspected' }]
      : []),
  ];
  const photos = review.photos ?? [];

  return (
    <article className={focused ? 'review is-focused' : 'review'} data-review-id={review.id}>
      <header className="review-head">
        <Stars rating={review.rating} />
        <span className="review-meta">
          {formatDate(review.date)} · {review.source === 'best' ? '베스트' : '최신'}
        </span>
      </header>
      {tag && <WashTag tag={tag} />}
      {review.option && <p className="review-option">구매 옵션 {review.option}</p>}
      {photos.length > 0 ? (
        <div className="review-photos">
          {photos.slice(0, 3).map((src) => (
            <img key={src} src={src} alt="리뷰 사진" loading="lazy" />
          ))}
          {photos.length > 3 && <span className="review-photos-more">+{photos.length - 3}</span>}
        </div>
      ) : (
        review.hasPhoto && <p className="review-option">사진 있는 리뷰</p>
      )}
      <p className={long && !open ? 'review-text is-clamped' : 'review-text'}>{highlight(review.text, marks)}</p>
      {long && (
        <button type="button" className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '접기' : '더보기'}
        </button>
      )}
    </article>
  );
}

export default ReviewCard;
