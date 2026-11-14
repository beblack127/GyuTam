/**
 * content script 진입점. (design.md "content/index.ts")
 * 실제 의존성(fetch, setTimeout, Math.random, Date.now, document, chrome.*)을 컨트롤러에 연결하고
 * `intake:start` 메시지를 받는다. 쿠팡 페이지 DOM은 읽지도 바꾸지도 않는다 (visibilityState만 읽음).
 * 리뷰 원문을 로그에 남기지 않는다.
 */
import { coupangAdapter } from '../services/adapters/coupangAdapter';
import type { HttpResponse, IntakeMessage } from '../services/adapters/intakeTypes';
import { createIntakeController } from './intakeController';
import { clearTabSession, readTabSession, writeIntakeResult } from './sessionStore';
import { waitUntilVisible } from './visibility';

/**
 * 같은 출처 요청. 로그인 쿠키만 실리고 헤더는 추가하지 않는다. (Requirements 5.5, 3.3)
 * 응답 본문을 읽다 실패하면 그대로 던진다. 어댑터가 요청 예외로 보고 그 자리에서 멈춘다.
 */
async function fetchPage(url: string): Promise<HttpResponse> {
  const r = await fetch(url, { credentials: 'include' });
  const bodyText = await r.text();
  return {
    status: r.status,
    redirected: r.redirected,
    contentType: r.headers.get('content-type'),
    bodyText,
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** 받을 사이드 패널이 없으면 거부된다. 컨트롤러도 삼키지만 여기서도 거부를 남기지 않는다. */
const send = async (msg: IntakeMessage): Promise<void> => {
  await chrome.runtime.sendMessage(msg);
};

const controller = createIntakeController({
  getPathname: () => location.pathname,
  readSession: (tabId) => readTabSession(tabId),
  writeResult: (tabId, productId, result, total) =>
    writeIntakeResult(tabId, productId, result, total),
  clearSession: (tabId) => clearTabSession(tabId),
  send,
  adapter: coupangAdapter,
  adapterDeps: {
    fetchPage,
    sleep,
    random: () => Math.random(),
    now: () => Date.now(),
    waitUntilVisible: () => waitUntilVisible(document),
  },
});

function isStartMessage(msg: unknown): msg is { type: 'intake:start'; tabId: number } {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as { type?: unknown; tabId?: unknown };
  return m.type === 'intake:start' && typeof m.tabId === 'number';
}

// sendResponse를 쓰지 않으므로 true를 반환하지 않는다.
chrome.runtime.onMessage.addListener((msg: unknown) => {
  if (!isStartMessage(msg)) return;
  const { tabId } = msg;
  controller.handleStart(tabId).catch(() => {
    // 세션 저장소 읽기·쓰기 실패 등. 원문 없이 parse_failed로만 알린다.
    send({ type: 'intake:error', tabId, reason: 'parse_failed' }).catch(() => undefined);
  });
});
