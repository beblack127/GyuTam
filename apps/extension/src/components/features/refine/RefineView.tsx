import { MAX_STEPS, averageRating, type Review, type Step, type WashTag } from '@star-laundry/core';

import CitedList from '@/components/common/CitedList';
import Notice from '@/components/common/Notice';
import ReviewList from '@/components/features/review-list/ReviewList';
import AskBox from '@/components/features/wash-request/AskBox';
import { fmtRating } from '@/utils/format';

import StepChips from './StepChips';

interface Props {
  strict: boolean;
  baseReviews: Review[];
  allReviews: Review[];
  steps: Step[];
  quotes: Map<string, string | null>[];
  tags: Map<string, WashTag>;
  busy: boolean;
  notice: { tone: 'info' | 'warn'; text: string } | null;
  focus: { ids: string[]; key: number } | null;
  onAsk: (request: string) => void;
  onPop: () => void;
  onReset: () => void;
  onBase: () => void;
  onCite: (ids: string[]) => void;
}

const EXAMPLES = ['사진 있는 리뷰만', '4점 이상 리뷰만'];

function RefineView(p: Props) {
  const current = p.steps[p.steps.length - 1];
  const byId = new Map(p.allReviews.map((r) => [r.id, r]));
  const list = current ? current.ids.map((id) => byId.get(id)).filter((r): r is Review => Boolean(r)) : p.baseReviews;
  const baseLabel = p.strict ? '🔍 섬세' : '🧺 기본';
  const full = p.steps.length >= MAX_STEPS;

  return (
    <div className="screen refine">
      <StepChips
        baseLabel={baseLabel}
        baseCount={p.baseReviews.length}
        baseAverage={averageRating(p.baseReviews)}
        steps={p.steps}
        onBase={p.onBase}
        onPop={p.onPop}
        onReset={p.onReset}
      />

      <p className="refine-scope">
        {current
          ? `지금 목록 ${list.length}개 안에서 더 좁혀요`
          : `${p.strict ? '섬세' : '기본'} 세탁된 리뷰 ${p.baseReviews.length}개 안에서 찾아요`}
      </p>

      <AskBox
        examples={current ? [] : EXAMPLES}
        busy={p.busy}
        disabled={full}
        placeholder={current ? '예: 그중에 최근 한 달만' : '예: 4점 이상 리뷰만'}
        onAsk={p.onAsk}
      />
      {full && <Notice>조건은 5단계까지 쌓을 수 있어요. 더 찾으려면 "처음부터"를 눌러 주세요.</Notice>}
      {p.busy && (
        <div className="finding" role="status">
          <span className="finding-bar" />
          조건에 맞는 리뷰를 찾고 있어요
        </div>
      )}
      {p.notice && <Notice tone={p.notice.tone}>{p.notice.text}</Notice>}

      {current && (
        <section className="result">
          <div className="result-rating">
            <span className="rating-num rating-num--big tabular">{fmtRating(current.rating.average)}</span>
            <span className="muted">리뷰 {current.rating.count}개의 평균 별점</span>
          </div>
          <CitedList title="요약" items={current.summary} onCite={p.onCite} />
          <div className="proscons">
            <CitedList title="장점" items={current.pros} tone="pro" onCite={p.onCite} />
            <CitedList title="단점" items={current.cons} tone="con" onCite={p.onCite} />
          </div>
        </section>
      )}

      <h2 className="list-title">{current ? `찾은 리뷰 ${list.length}` : `세탁된 리뷰 ${list.length}`}</h2>
      <ReviewList reviews={list} tags={p.tags} quotes={p.quotes[p.quotes.length - 1]} focus={p.focus} />
    </div>
  );
}

export default RefineView;
