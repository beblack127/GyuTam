// 지금 탭의 입고 상태 (intake.md).
// - 패널이 열리면 content script에 intake:start 를 보낸다. 이미 입고됐으면 content script가 intake:done 을 바로 보낸다.
// - intake:progress / intake:done / intake:error 메시지와 chrome.storage.session 의 tab:{tabId} 를 함께 본다.
// 입고 자체는 content script(입고 담당)가 하고, 패널은 결과를 읽고 진행률만 보여준다.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { IntakeDoneReason, IntakeErrorReason, IntakeMessage, Review } from '@star-laundry/core';

import { MOCK_PRODUCT, MOCK_REVIEWS, MOCK_SOURCES } from '@/services/api/mockData';

export type SessionStatus = 'loading' | 'unsupported' | 'intake' | 'ready' | 'failed';

interface StoredTab {
  productId?: string;
  reviews?: Review[];
  intake?: { done?: number; total?: number; partial?: boolean; reason?: IntakeDoneReason };
}

export interface TabSession {
  status: SessionStatus;
  demo: boolean;
  tabId: number | null;
  productName: string | null;
  reviews: Review[];
  progress: { done: number; total: number };
  partial: boolean;
  reason: IntakeDoneReason;
  failure: IntakeErrorReason | null;
  sources: { best: number; latest: number; duplicates: number } | null;
  startDemo: () => void;
  retryIntake: () => void;
}

const hasChrome = typeof chrome !== 'undefined' && Boolean(chrome.storage?.session);
const PRODUCT_URL = /^https:\/\/www\.coupang\.com\/vp\/products\//;
const EMPTY: Review[] = [];

function finished(t: StoredTab | undefined): boolean {
  if (!t?.reviews?.length || !t.intake) return false;
  const { done = 0, total = 0, partial = false } = t.intake;
  return partial || (total > 0 && done >= total);
}

export function useTabSession(): TabSession {
  const [tabId, setTabId] = useState<number | null>(null);
  const [status, setStatus] = useState<SessionStatus>(hasChrome ? 'loading' : 'unsupported');
  const [reviews, setReviews] = useState<Review[]>(EMPTY);
  const [progress, setProgress] = useState({ done: 0, total: 100 });
  const [partial, setPartial] = useState(false);
  const [reason, setReason] = useState<IntakeDoneReason>(null);
  const [failure, setFailure] = useState<IntakeErrorReason | null>(null);
  const [demo, setDemo] = useState(false);
  const [demoDone, setDemoDone] = useState(0);
  const demoTimer = useRef<number | null>(null);
  const tabRef = useRef<number | null>(null);

  const applyStored = useCallback((data: StoredTab | undefined) => {
    if (!data) return;
    if (data.intake) setProgress({ done: data.intake.done ?? 0, total: data.intake.total ?? 100 });
    if (finished(data)) {
      setReviews(data.reviews ?? EMPTY);
      setPartial(data.intake?.partial ?? false);
      setReason(data.intake?.reason ?? null);
      setStatus('ready');
    }
  }, []);

  const startIntake = useCallback(async (id: number) => {
    try {
      await chrome.tabs.sendMessage(id, { type: 'intake:start', tabId: id } satisfies IntakeMessage);
    } catch {
      // content script가 아직 없다 (설치 직후). 시작 화면이 새로고침을 안내한다.
    }
  }, []);

  // 지금 보고 있는 탭을 찾고, 탭을 바꾸면 다시 찾는다.
  useEffect(() => {
    if (!hasChrome) return;
    const refresh = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      tabRef.current = tab.id;
      setTabId(tab.id);
      setDemo(false);
      setReviews(EMPTY);
      setProgress({ done: 0, total: 100 });
      setPartial(false);
      setReason(null);
      setFailure(null);
      if (!tab.url || !PRODUCT_URL.test(tab.url)) {
        setStatus('unsupported');
        return;
      }
      setStatus('intake');
      const key = `tab:${tab.id}`;
      const data = (await chrome.storage.session.get(key))[key] as StoredTab | undefined;
      applyStored(data);
      if (!finished(data)) void startIntake(tab.id);
    };
    void refresh();
    const onActivated = () => void refresh();
    const onUpdated = (id: number, info: { status?: string; url?: string }) => {
      if (id === tabRef.current && (info.status === 'complete' || info.url)) void refresh();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [applyStored, startIntake]);

  // content script 메시지와 저장소 변경을 반영한다.
  useEffect(() => {
    if (!hasChrome || tabId === null) return;
    const onMessage = (msg: IntakeMessage) => {
      if (!msg || msg.tabId !== tabId) return;
      if (msg.type === 'intake:progress') setProgress({ done: msg.done, total: msg.total });
      if (msg.type === 'intake:done') {
        setReviews(msg.reviews);
        setPartial(msg.partial);
        setReason(msg.reason);
        setStatus('ready');
      }
      if (msg.type === 'intake:error') {
        setFailure(msg.reason);
        setStatus(msg.reason === 'not_product_page' ? 'unsupported' : 'failed');
      }
    };
    const key = `tab:${tabId}`;
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'session' && key in changes) applyStored(changes[key]?.newValue as StoredTab | undefined);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [tabId, applyStored]);

  // 예시 리뷰로 체험하기: 입고 진행률을 흉내 낸 뒤 예시 리뷰를 쓴다.
  const startDemo = useCallback(() => {
    if (demoTimer.current) window.clearInterval(demoTimer.current);
    setDemo(true);
    setDemoDone(0);
    setStatus('intake');
    demoTimer.current = window.setInterval(() => {
      setDemoDone((d) => {
        const next = Math.min(d + 3, MOCK_REVIEWS.length);
        if (next >= MOCK_REVIEWS.length && demoTimer.current) {
          window.clearInterval(demoTimer.current);
          demoTimer.current = null;
          setStatus('ready');
        }
        return next;
      });
    }, 160);
  }, []);

  useEffect(
    () => () => {
      if (demoTimer.current) window.clearInterval(demoTimer.current);
    },
    [],
  );

  const retryIntake = useCallback(() => {
    if (tabId === null) return;
    setFailure(null);
    setStatus('intake');
    void startIntake(tabId);
  }, [tabId, startIntake]);

  if (demo) {
    return {
      status,
      demo,
      tabId,
      productName: MOCK_PRODUCT,
      reviews: status === 'ready' ? MOCK_REVIEWS : EMPTY,
      progress: { done: demoDone, total: MOCK_REVIEWS.length },
      partial: false,
      reason: null,
      failure: null,
      sources: MOCK_SOURCES,
      startDemo,
      retryIntake,
    };
  }

  return {
    status,
    demo,
    tabId,
    productName: null,
    reviews: status === 'ready' ? reviews : EMPTY,
    progress,
    partial,
    reason,
    failure,
    sources: null,
    startDemo,
    retryIntake,
  };
}
