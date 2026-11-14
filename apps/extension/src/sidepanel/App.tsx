import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { narrowSteps, popStep, pushStep, type Receipt, type Step, type WashTag } from '@star-laundry/core';

import ModeBar, { type ModeKey } from '@/components/common/ModeBar';
import StatusScreen from '@/components/common/StatusScreen';
import DoneScreen from '@/components/features/receipt/DoneScreen';
import ReceiptView from '@/components/features/receipt/ReceiptView';
import WashingScreen from '@/components/features/receipt/WashingScreen';
import RefineView from '@/components/features/refine/RefineView';
import StartScreen from '@/components/features/start/StartScreen';
import { useTabSession } from '@/hooks/useTabSession';
import { ApiError, type ApiErrorKind, ask, isMockApi, wash } from '@/services/api/washApi';

type View = 'home' | 'washing' | 'done' | 'receipt' | 'refine' | 'error';

interface WashState {
  tags: WashTag[];
  receipt: Receipt;
  strict: boolean;
}

const ERROR_TEXT: Record<ApiErrorKind, string> = {
  busy: '요청이 몰려 잠시 막혔어요. 잠시 후 다시 시도해 주세요.',
  server: '세탁 서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  timeout: '세탁이 30초 안에 끝나지 않았어요. 잠시 후 다시 시도해 주세요.',
  network: '세탁 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  invalid: '보낼 수 없는 리뷰가 섞여 있어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
};

function App() {
  const session = useTabSession();
  const useMock = isMockApi || session.demo;

  const [view, setView] = useState<View>('home');
  const [washState, setWashState] = useState<WashState | null>(null);
  const [pending, setPending] = useState<{ strict: boolean; quick: boolean; next: 'receipt' | 'refine' }>({
    strict: false,
    quick: false,
    next: 'receipt',
  });
  const [error, setError] = useState<ApiErrorKind | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [quotes, setQuotes] = useState<Map<string, string | null>[]>([]);
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [focus, setFocus] = useState<{ ids: string[]; key: number } | null>(null);
  const run = useRef(0);

  // 탭이나 리뷰가 바뀌면 처음부터.
  useEffect(() => {
    run.current += 1;
    setView('home');
    setWashState(null);
    setSteps([]);
    setQuotes([]);
    setNotice(null);
    setFocus(null);
  }, [session.tabId, session.demo, session.reviews.length]);

  const tagMap = useMemo(() => new Map((washState?.tags ?? []).map((t) => [t.id, t])), [washState]);
  const baseReviews = useMemo(
    () => session.reviews.filter((r) => tagMap.get(r.id)?.include !== false),
    [session.reviews, tagMap],
  );

  const runWash = useCallback(
    async (strict: boolean, next: 'receipt' | 'refine') => {
      const reuse = washState?.tags;
      const id = ++run.current;
      setPending({ strict, quick: Boolean(reuse), next });
      setError(null);
      setView('washing');
      try {
        const res = await wash(session.reviews, strict, reuse, useMock);
        if (id !== run.current) return;
        // 부분 세탁 중에 바탕이 바뀌면 단계를 맞춘다 (api-contract.md "세탁 순서 자유롭게 섞기").
        if (washState && washState.strict !== strict && steps.length > 0) {
          if (strict) {
            const allowed = res.tags.filter((t) => t.include).map((t) => t.id);
            const narrowed = narrowSteps(steps, session.reviews, allowed);
            setSteps(narrowed);
            setQuotes((q) => q.slice(0, narrowed.length));
            setNotice({ tone: 'info', text: '의심 얼룩을 빼고 찾던 조건을 다시 맞췄어요.' });
          } else {
            setSteps([]);
            setQuotes([]);
            setNotice({ tone: 'info', text: '기본 세탁으로 바꿔서 조건을 지웠어요. 처음부터 다시 찾아 주세요.' });
          }
        }
        setWashState({ tags: res.tags, receipt: res.receipt, strict });
        setView(reuse ? next : 'done');
      } catch (err) {
        if (id !== run.current) return;
        setError(err instanceof ApiError ? err.kind : 'network');
        setView('error');
      }
    },
    [washState, steps, session.reviews, useMock],
  );

  const pick = (mode: ModeKey) => {
    setFocus(null);
    if (mode === 'refine') {
      if (washState) setView('refine');
      else void runWash(false, 'refine');
      return;
    }
    const strict = mode === 'strict';
    if (washState && washState.strict === strict) setView('receipt');
    else void runWash(strict, 'receipt');
  };

  const onAsk = async (request: string) => {
    const current = steps[steps.length - 1];
    const byId = new Map(session.reviews.map((r) => [r.id, r]));
    const list = current ? current.ids.map((id) => byId.get(id)).filter((r) => r !== undefined) : baseReviews;
    setAsking(true);
    setNotice(null);
    setFocus(null);
    try {
      const res = await ask(request, steps.map((s) => s.request), list, useMock);
      const unsupported = res.unsupported ? `"${res.unsupported}" 부분은 적용하지 못했어요.` : null;
      if (res.matches.length === 0) {
        setNotice({
          tone: 'info',
          text: `${unsupported ?? ''} 조건에 맞는 리뷰가 없어요. 목록은 그대로 두었어요.`.trim(),
        });
        return;
      }
      const step: Step = {
        request,
        label: res.label,
        conditions: res.conditions,
        ids: res.matches.map((m) => m.id),
        rating: res.rating,
        summary: res.summary,
        pros: res.pros,
        cons: res.cons,
      };
      setSteps((s) => pushStep(s, step));
      setQuotes((q) => [...q, new Map(res.matches.map((m) => [m.id, m.quote]))]);
      if (unsupported) setNotice({ tone: 'info', text: unsupported });
    } catch (err) {
      const kind = err instanceof ApiError ? err.kind : 'network';
      setNotice({ tone: 'warn', text: ERROR_TEXT[kind] });
    } finally {
      setAsking(false);
    }
  };

  const cite = (ids: string[]) => setFocus({ ids, key: Date.now() });
  const reload = () => {
    if (session.tabId !== null) void chrome.tabs.reload(session.tabId);
  };
  const toDone = useCallback(() => setView(pending.next), [pending.next]);

  const showModeBar = view === 'receipt' || view === 'refine';
  const activeMode: ModeKey = view === 'refine' ? 'refine' : washState?.strict ? 'strict' : 'basic';

  return (
    <div className="panel">
      <header className="panel-head">
        <button type="button" className="brand" onClick={() => setView('home')} aria-label="별점세탁소 처음 화면">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          별점세탁소
        </button>
        {(useMock || session.demo) && session.status !== 'unsupported' && <span className="demo-badge">예시 데이터</span>}
      </header>

      {showModeBar && <ModeBar active={activeMode} onChange={pick} />}

      <main className="panel-body">
        {session.status === 'loading' && <p className="empty">불러오는 중이에요</p>}

        {session.status === 'unsupported' && (
          <StatusScreen
            title="쿠팡 상품 페이지에서 열어 주세요"
            body="상품 페이지를 열면 리뷰를 자동으로 불러와요. 확장을 방금 설치했다면 페이지를 새로고침해 주세요."
          >
            <button type="button" className="btn btn--ghost" onClick={session.startDemo}>
              예시 리뷰로 체험하기
            </button>
          </StatusScreen>
        )}

        {session.status === 'failed' && (
          <StatusScreen
            title="리뷰를 읽지 못했어요"
            body={
              session.failure === 'blocked'
                ? '쿠팡이 요청을 잠시 막았어요. 잠시 뒤 다시 시도하거나 예시 리뷰로 체험해 보세요.'
                : '페이지에서 리뷰를 찾지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.'
            }
          >
            <button type="button" className="btn btn--primary" onClick={session.retryIntake}>
              다시 불러오기
            </button>
            <button type="button" className="btn btn--ghost" onClick={session.startDemo}>
              예시 리뷰로 체험하기
            </button>
          </StatusScreen>
        )}

        {(session.status === 'intake' || session.status === 'ready') && (
          <>
            {view === 'home' && (
              <StartScreen
                ready={session.status === 'ready'}
                progress={session.progress}
                reviewCount={session.reviews.length}
                sources={session.sources}
                partial={session.partial}
                reason={session.reason}
                productName={session.productName}
                hasWash={washState !== null}
                onPick={pick}
                onShowLast={() => setView('receipt')}
                onReload={reload}
              />
            )}
            {view === 'washing' && (
              <WashingScreen
                strict={pending.strict}
                quick={pending.quick}
                reviewCount={session.reviews.length}
                onCancel={() => {
                  run.current += 1;
                  setView(washState ? 'receipt' : 'home');
                }}
              />
            )}
            {view === 'done' && washState && (
              <DoneScreen
                before={washState.receipt.before}
                after={washState.receipt.after}
                removed={washState.receipt.removed}
                onNext={toDone}
              />
            )}
            {view === 'receipt' && washState && (
              <ReceiptView
                receipt={washState.receipt}
                strict={washState.strict}
                reviews={session.reviews}
                tags={tagMap}
                focus={focus}
                onCite={cite}
                onRefine={() => pick('refine')}
              />
            )}
            {view === 'refine' && washState && (
              <RefineView
                strict={washState.strict}
                baseReviews={baseReviews}
                allReviews={session.reviews}
                steps={steps}
                quotes={quotes}
                tags={tagMap}
                busy={asking}
                notice={notice}
                focus={focus}
                onAsk={onAsk}
                onPop={() => {
                  setSteps(popStep);
                  setQuotes((q) => q.slice(0, -1));
                  setNotice(null);
                }}
                onReset={() => {
                  setSteps([]);
                  setQuotes([]);
                  setNotice(null);
                }}
                onBase={() => setView('receipt')}
                onCite={cite}
              />
            )}
            {view === 'error' && error && (
              <StatusScreen title="세탁하지 못했어요" body={ERROR_TEXT[error]}>
                <button type="button" className="btn btn--primary" onClick={() => void runWash(pending.strict, pending.next)}>
                  다시 시도
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setView('home')}>
                  처음 화면으로
                </button>
              </StatusScreen>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
