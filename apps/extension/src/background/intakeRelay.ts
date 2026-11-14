// 입고 중계: 패널의 intake:start를 탭의 content script로 전달하고, 탭 세션 키의 수명을 관리한다.
// 리뷰 본문은 읽거나 로그로 남기지 않는다. content script → 패널 메시지는 다시 중계하지 않는다.
import type { IntakeMessage } from '../services/adapters/intakeTypes';

export const PRODUCT_URL_RE = /^https:\/\/www\.coupang\.com\/vp\/products\/(\d+)/;

/** 쿠팡 상품 페이지 URL에서 Product_Id를 읽는다. 쿼리(itemId, vendorItemId)는 무시한다. */
export function productIdFromUrl(url: string | undefined): string | null {
  if (url === undefined) return null;
  const match = PRODUCT_URL_RE.exec(url);
  return match?.[1] ?? null;
}

// content/sessionStore.ts의 tabKey와 같은 형식 (intake.md: `tab:{tabId}`).
function tabKey(tabId: number): string {
  return `tab:${tabId}`;
}

type IntakeStartMessage = Extract<IntakeMessage, { type: 'intake:start' }>;

function isIntakeStart(msg: unknown): msg is IntakeStartMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as { type?: unknown; tabId?: unknown };
  return m.type === 'intake:start' && typeof m.tabId === 'number' && Number.isInteger(m.tabId);
}

function sendNotProductPage(tabId: number): void {
  const msg: IntakeMessage = { type: 'intake:error', tabId, reason: 'not_product_page' };
  // 패널이 닫혀 있으면 받는 쪽이 없어 실패한다. 무시한다.
  chrome.runtime.sendMessage(msg).then(
    () => undefined,
    () => undefined,
  );
}

async function relayStart(msg: IntakeStartMessage): Promise<void> {
  const { tabId } = msg;
  let url: string | undefined;
  try {
    const tab = await chrome.tabs.get(tabId);
    url = tab.url;
  } catch {
    url = undefined; // 탭이 이미 닫혔거나 없는 탭
  }
  if (productIdFromUrl(url) === null) {
    sendNotProductPage(tabId);
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // 받는 content script가 없다 (확장 설치 전에 열린 탭 등). 새로고침 안내용 이유 값은 열린 항목.
    sendNotProductPage(tabId);
  }
}

async function readStoredProductId(key: string): Promise<string | null> {
  const stored = await chrome.storage.session.get(key);
  const value: unknown = stored[key];
  if (typeof value !== 'object' || value === null) return null;
  const productId: unknown = (value as { productId?: unknown }).productId;
  return typeof productId === 'string' ? productId : null;
}

async function clearIfProductChanged(tabId: number, url: string): Promise<void> {
  const key = tabKey(tabId);
  const storedProductId = await readStoredProductId(key);
  if (storedProductId === null) return; // 저장값이 없으면 지울 것도 없다
  if (productIdFromUrl(url) !== storedProductId) {
    await chrome.storage.session.remove(key);
  }
}

export function registerIntakeRelay(): void {
  // content script가 storage.session을 직접 읽고 쓰도록 접근 수준을 연다.
  chrome.storage.session
    .setAccessLevel({ accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS })
    .catch(() => undefined);

  chrome.runtime.onMessage.addListener((msg: unknown, sender: chrome.runtime.MessageSender) => {
    // 패널(확장 페이지)에서 온 intake:start만 처리한다. content script발 메시지는 sender.tab이 있다.
    if (sender.tab !== undefined || sender.id !== chrome.runtime.id) return;
    if (!isIntakeStart(msg)) return;
    void relayStart(msg);
    // sendResponse를 쓰지 않으므로 true를 반환하지 않는다.
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url === undefined) return;
    clearIfProductChanged(tabId, changeInfo.url).catch(() => undefined);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.session.remove(tabKey(tabId)).catch(() => undefined);
  });
}
