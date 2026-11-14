import { useEffect } from 'react';

import WashingMachine from '@/components/common/WashingMachine';
import { fmtRating } from '@/utils/format';

interface Props {
  before: number | null;
  after: number | null;
  removed: number;
  onNext: () => void;
}

const DURATION = 1600;

// 세탁 끝. 짧게 보여주고 영수증으로 넘어간다. 누르면 바로 넘어간다.
function DoneScreen({ before, after, removed, onNext }: Props) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(onNext, reduce ? 0 : DURATION);
    return () => window.clearTimeout(t);
  }, [onNext]);

  return (
    <button type="button" className="screen done" onClick={onNext} aria-label="세탁 영수증 보기">
      <WashingMachine state="done" size={168} />
      <span className="slot" aria-hidden="true" />
      <span className="slip">
        <span className="slip-title">세탁 영수증</span>
        <span className="slip-rating tabular">
          {fmtRating(before)} → {fmtRating(after)}
        </span>
        <span className="slip-line">얼룩 {removed}개 뺐어요</span>
      </span>
    </button>
  );
}

export default DoneScreen;
