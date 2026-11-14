import { useEffect, useState } from 'react';

import WashingMachine from '@/components/common/WashingMachine';

interface Props {
  strict: boolean;
  reviewCount: number;
  quick: boolean;
  onCancel: () => void;
}

// 세탁 중. 실제 진행률을 모르므로 지난 시간만 보여준다.
function WashingScreen({ strict, reviewCount, quick, onCancel }: Props) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="screen washing" aria-live="polite">
      <WashingMachine state="spin" size={168} />
      <h1 className="washing-title">{quick ? '평점과 요약을 다시 계산하고 있어요' : '세탁 중이에요'}</h1>
      <p className="muted">
        {strict ? '🔍 섬세 세탁' : '🧺 기본 세탁'} · 리뷰 {reviewCount}개
      </p>
      <ol className="stepper" aria-label="세탁 단계">
        <li className="is-done">입고</li>
        <li className="is-now">{quick ? '다시 계산' : '얼룩 판정과 요약'}</li>
        <li>영수증</li>
      </ol>
      <p className="muted tabular">{sec}초 지남 · 보통 30초 안에 끝나요</p>
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        세탁 그만두기
      </button>
    </div>
  );
}

export default WashingScreen;
