import type { Signal, WashTag as Tag } from '@star-laundry/core';

const SIGNAL_LABEL: Record<Signal, string> = {
  platform_badge: '체험단 표시',
  disclosure: '대가성 문구',
  review_event: '리뷰 이벤트',
  suspected: '광고 의심 신호',
};

export function signalLabel(signal: Signal): string {
  return SIGNAL_LABEL[signal];
}

interface Props {
  tag: Tag;
}

// 리뷰 카드에 붙는 판정 배지. "가짜"라고 단정하지 않고 신호만 적는다 (fairness.md).
function WashTag({ tag }: Props) {
  if (tag.stain === 'none' || !tag.signal) return null;
  const certain = tag.stain === 'certain';
  return (
    <span className={certain ? 'washtag washtag--certain' : 'washtag washtag--suspected'}>
      <span className="washtag-dot" aria-hidden="true" />
      {certain ? '확실한 얼룩' : '의심 얼룩'} · {signalLabel(tag.signal)}
    </span>
  );
}

export default WashTag;
