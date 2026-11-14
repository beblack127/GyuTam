import { useState } from 'react';

import type { Receipt, Review, Signal, WashTag } from '@star-laundry/core';

import CitedList from '@/components/common/CitedList';
import Notice from '@/components/common/Notice';
import ReviewList from '@/components/features/review-list/ReviewList';
import { signalLabel } from '@/components/features/wash-tag/WashTag';
import { fmtRating } from '@/utils/format';

interface Props {
  receipt: Receipt;
  strict: boolean;
  reviews: Review[];
  tags: Map<string, WashTag>;
  focus: { ids: string[]; key: number } | null;
  onCite: (ids: string[]) => void;
  onRefine: () => void;
}

const CERTAIN_SIGNALS: Signal[] = ['platform_badge', 'disclosure', 'review_event'];

function delta(before: number | null, after: number | null) {
  if (before === null || after === null) return null;
  const d = Math.round((after - before) * 10) / 10;
  if (d === 0) return '그대로';
  return d < 0 ? `${Math.abs(d)} 낮아짐` : `${d} 높아짐`;
}

function ReceiptView({ receipt, strict, reviews, tags, focus, onCite, onRefine }: Props) {
  const [tab, setTab] = useState<'kept' | 'removed'>('kept');
  const kept = reviews.filter((r) => tags.get(r.id)?.include !== false);
  const removed = reviews.filter((r) => tags.get(r.id)?.include === false);
  const certain = CERTAIN_SIGNALS.reduce((n, s) => n + receipt.stains[s], 0);
  const certainParts = CERTAIN_SIGNALS.filter((s) => receipt.stains[s] > 0).map((s) => `${signalLabel(s)} ${receipt.stains[s]}`);
  const change = delta(receipt.before, receipt.after);
  const cite = (ids: string[]) => {
    setTab('kept');
    onCite(ids);
  };

  return (
    <div className="screen receipt-screen">
      <section className="receipt" aria-label="세탁 영수증">
        <header className="receipt-head">
          <h1>세탁 영수증</h1>
          <span>{strict ? '🔍 섬세 세탁' : '🧺 기본 세탁'}</span>
        </header>
        <p className="receipt-scope">
          리뷰 {receipt.basedOn}개 기준 · 베스트 {receipt.sources.best} + 최신 {receipt.sources.latest}, 중복 {receipt.sources.duplicates}개 제외
        </p>
        {receipt.partial && <Notice tone="warn">일부 리뷰는 AI 판정을 끝내지 못해 규칙으로만 판정했어요.</Notice>}

        <div className="receipt-rating">
          <div className="rating-before">
            <span className="rating-label">세탁 전</span>
            <span className="rating-num tabular">{fmtRating(receipt.before)}</span>
          </div>
          <span className="rating-arrow" aria-hidden="true">
            →
          </span>
          <div className="rating-after">
            <span className="rating-label">세탁 후</span>
            {receipt.after === null ? (
              <span className="rating-none">계산할 리뷰 없음</span>
            ) : (
              <span className="rating-num rating-num--big tabular">{fmtRating(receipt.after)}</span>
            )}
          </div>
          {change && <span className="rating-delta">{change}</span>}
        </div>

        <dl className="receipt-lines">
          <div className="receipt-line">
            <dt>
              <span className="dot dot--certain" aria-hidden="true" />
              확실한 얼룩
            </dt>
            <dd className="tabular">{certain}개 뺐어요</dd>
            {certainParts.length > 0 && <dd className="receipt-sub">{certainParts.join(' · ')}</dd>}
          </div>
          <div className="receipt-line">
            <dt>
              <span className="dot dot--suspected" aria-hidden="true" />
              의심 얼룩
            </dt>
            <dd className="tabular">
              {receipt.stains.suspected}개 {strict ? '뺐어요' : '표시만 했어요'}
            </dd>
          </div>
          <div className="receipt-line receipt-line--total">
            <dt>평점에 쓴 리뷰</dt>
            <dd className="tabular">{receipt.basedOn - receipt.removed}개</dd>
          </div>
        </dl>
      </section>

      {receipt.summary.length === 0 ? (
        <Notice>요약을 만들지 못했어요. 평점과 태그는 그대로 볼 수 있어요.</Notice>
      ) : (
        <CitedList title="세탁 후 요약" items={receipt.summary} onCite={cite} />
      )}
      <div className="proscons">
        <CitedList title="장점" items={receipt.pros} tone="pro" onCite={cite} />
        <CitedList title="단점" items={receipt.cons} tone="con" onCite={cite} />
      </div>

      <button type="button" className="btn btn--primary btn--block" onClick={onRefine}>
        🎯 이 결과에서 원하는 리뷰 찾기
      </button>

      <div className="tabs" role="tablist" aria-label="리뷰 목록">
        <button type="button" role="tab" aria-selected={tab === 'kept'} className={tab === 'kept' ? 'tab is-active' : 'tab'} onClick={() => setTab('kept')}>
          세탁된 리뷰 {kept.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'removed'} className={tab === 'removed' ? 'tab is-active' : 'tab'} onClick={() => setTab('removed')}>
          빠진 리뷰 {removed.length}
        </button>
      </div>
      <ReviewList
        reviews={tab === 'kept' ? kept : removed}
        tags={tags}
        focus={tab === 'kept' ? focus : null}
        empty={tab === 'kept' ? '남은 리뷰가 없어요.' : '빠진 리뷰가 없어요.'}
      />
    </div>
  );
}

export default ReceiptView;
