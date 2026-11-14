import { useEffect, useState } from 'react';

import type { IntakeDoneReason as IntakeReason } from '@star-laundry/core';

import Notice from '@/components/common/Notice';

interface Props {
  ready: boolean;
  progress: { done: number; total: number };
  reviewCount: number;
  sources: { best: number; latest: number; duplicates: number } | null;
  partial: boolean;
  reason: IntakeReason;
  productName: string | null;
  hasWash: boolean;
  onPick: (mode: 'basic' | 'strict' | 'refine') => void;
  onShowLast: () => void;
  onReload: () => void;
}

const REASON: Record<Exclude<IntakeReason, null>, string> = {
  blocked: '쿠팡이 요청을 잠시 막았어요',
  captcha: '확인 페이지가 나왔어요',
  unexpected: '페이지 구조가 예상과 달라요',
  hidden_tab: '탭이 백그라운드에 있었어요',
};

const OPTIONS = [
  {
    key: 'basic' as const,
    icon: '🧺',
    title: '기본 세탁',
    desc: '체험단·제품 제공·리뷰 이벤트처럼 대가성이 확실한 리뷰를 빼고 평점과 요약을 보여줘요. 광고로 의심되는 리뷰는 표시만 해요.',
    help: '세탁 전 평점은 불러온 리뷰 전체의 평균이고, 세탁 후 평점은 얼룩을 뺀 리뷰의 평균이에요. 🔴 확실한 얼룩은 쿠팡 체험단 표시나 "제공받아" 같은 문구가 있는 리뷰예요.',
  },
  {
    key: 'strict' as const,
    icon: '🔍',
    title: '섬세 세탁',
    desc: '기본 세탁에 더해, 광고로 의심되는 리뷰도 빼고 계산해요. 의심은 추정이라 근거 문장을 함께 보여줘요.',
    help: '🟡 의심 얼룩은 대가성 표시는 없지만, 구체적인 내용 없이 칭찬만 있는 것처럼 광고일 수 있는 신호가 있는 리뷰예요. 가짜라고 단정하지 않아요.',
  },
  {
    key: 'refine' as const,
    icon: '🎯',
    title: '부분 세탁',
    desc: '원하는 리뷰만 문장으로 찾아요. 결과에 다시 질문해서 더 좁힐 수 있어요.',
    example: '예) "사진 있는 3점 이하 리뷰 중 발열 얘기"',
    help: '기본 세탁을 먼저 한 뒤, 남은 리뷰 안에서 찾아요. 별점·사진·옵션 같은 조건은 코드가 정확히 거르고, "발열 얘기" 같은 뜻은 AI가 골라 근거 문장을 보여줘요.',
  },
];

function StartScreen(p: Props) {
  const [help, setHelp] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);

  // 입고가 시작되지 않으면 새로고침을 안내한다 (설치 직후에는 content script가 없다).
  useEffect(() => {
    if (p.ready || p.progress.done > 0) {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), 5000);
    return () => window.clearTimeout(t);
  }, [p.ready, p.progress.done]);

  const pct = p.progress.total ? Math.min(100, Math.round((p.progress.done / p.progress.total) * 100)) : 0;

  return (
    <div className="screen start">
      {p.productName && <p className="product-name">{p.productName}</p>}

      {p.ready ? (
        <div className="intake intake--done">
          <h1 className="start-title">리뷰 {p.reviewCount}개를 불러왔어요</h1>
          {p.sources && (
            <p className="muted">
              베스트 {p.sources.best} + 최신 {p.sources.latest}, 중복 {p.sources.duplicates}개 제외
            </p>
          )}
        </div>
      ) : (
        <div className="intake">
          <h1 className="start-title">리뷰를 불러오는 중이에요</h1>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.progress.total} aria-valuenow={p.progress.done}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="muted tabular">
            {p.progress.done} / {p.progress.total}
          </p>
          {stalled && (
            <div className="stalled">
              <p className="muted">진행이 멈춰 있으면 페이지를 새로고침해 주세요. 확장을 방금 설치했다면 꼭 필요해요.</p>
              <button type="button" className="btn btn--ghost" onClick={p.onReload}>
                페이지 새로고침
              </button>
            </div>
          )}
        </div>
      )}

      {p.partial && p.reason && <Notice tone="warn">일부 리뷰만 불러왔어요 ({REASON[p.reason]}). 불러온 리뷰로 세탁할 수 있어요.</Notice>}

      <h2 className="start-question">어떤 세탁을 할까요?</h2>
      <ul className="options">
        {OPTIONS.map((o) => (
          <li key={o.key} className="option">
            <button type="button" className="option-main" disabled={!p.ready} onClick={() => p.onPick(o.key)}>
              <span className="option-icon" aria-hidden="true">
                {o.icon}
              </span>
              <span className="option-body">
                <span className="option-title">{o.title}</span>
                <span className="option-desc">{o.desc}</span>
                {o.example && <span className="option-example">{o.example}</span>}
              </span>
            </button>
            <button
              type="button"
              className="option-help"
              aria-label={`${o.title} 설명 보기`}
              aria-expanded={help === o.key}
              onClick={() => setHelp((h) => (h === o.key ? null : o.key))}
            >
              ?
            </button>
            {help === o.key && <p className="option-helptext">{o.help}</p>}
          </li>
        ))}
      </ul>

      {p.hasWash && (
        <button type="button" className="link-btn" onClick={p.onShowLast}>
          지난 세탁 결과 보기
        </button>
      )}
      <p className="fine">리뷰는 이 탭에만 잠시 두고 서버에 저장하지 않아요. 쿠팡과 제휴하지 않은 비공식 도구예요.</p>
    </div>
  );
}

export default StartScreen;
