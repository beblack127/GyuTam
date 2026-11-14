// 탭별 입고 결과 저장소. intake.md "저장 위치": `chrome.storage.session`의 `tab:{tabId}`.
// `chrome.storage.local`은 쓰지 않는다 (fairness.md).
import type { IntakeResult, TabSession } from '../services/adapters/intakeTypes';

/** 테스트에서 메모리 구현을 넣을 수 있도록 필요한 메서드만 받는다. */
export type SessionArea = Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>;

const defaultArea = (): SessionArea => chrome.storage.session;

export const tabKey = (tabId: number): string => `tab:${tabId}`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 저장값의 최소 모양 확인. 모양이 다르면 없는 것으로 본다. */
function isTabSession(v: unknown): v is TabSession {
  return (
    isRecord(v) &&
    typeof v.productId === 'string' &&
    Array.isArray(v.reviews) &&
    isRecord(v.intake)
  );
}

export async function readTabSession(
  tabId: number,
  area: SessionArea = defaultArea(),
): Promise<TabSession | null> {
  const key = tabKey(tabId);
  const items: Record<string, unknown> = await area.get(key);
  const value = items[key];
  return isTabSession(value) ? value : null;
}

/**
 * 입고 결과를 쓴다. 기존 값의 `productId`가 같으면 `wash`, `steps`를 보존하고
 * `productId`, `reviews`, `intake`만 덮어쓴다. 다르거나 없으면 새 값으로 쓴다.
 */
export async function writeIntakeResult(
  tabId: number,
  productId: string,
  result: IntakeResult,
  total: number,
  area: SessionArea = defaultArea(),
): Promise<void> {
  const prev = await readTabSession(tabId, area);
  const next: TabSession = {
    productId,
    reviews: result.reviews,
    intake: {
      done: result.reviews.length,
      total,
      partial: result.partial,
      reason: result.reason,
      sources: result.sources,
    },
  };
  if (prev !== null && prev.productId === productId) {
    if ('wash' in prev) next.wash = prev.wash;
    if ('steps' in prev) next.steps = prev.steps;
  }
  await area.set({ [tabKey(tabId)]: next });
}

export async function clearTabSession(
  tabId: number,
  area: SessionArea = defaultArea(),
): Promise<void> {
  await area.remove(tabKey(tabId));
}
