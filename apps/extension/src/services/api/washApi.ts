import { applyStrict, type Review, type WashTag } from '@star-laundry/core';

import type { AskResponse, WashResponse } from '@/types/api';

import { mockAsk, mockWash } from './mockData';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const TIMEOUT_MS = 32_000;

/** API 주소가 없으면 예시 응답을 쓴다. */
export const isMockApi = BASE === '';

export type ApiErrorKind = 'busy' | 'server' | 'timeout' | 'network' | 'invalid';

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string) {
    super(message);
  }
}

/** API로 보내기 전에 사진 주소를 뺀다 (api-contract.md: photos는 확장에만 둔다). */
function forApi(reviews: Review[]) {
  return reviews.map(({ photos: _photos, ...rest }) => rest);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 429) throw new ApiError('busy', '요청이 많아요');
    if (res.status === 400) throw new ApiError('invalid', '보낼 수 없는 요청이에요');
    if (!res.ok) throw new ApiError('server', `서버 오류 ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('timeout', '시간 초과');
    throw new ApiError('network', '연결 실패');
  } finally {
    clearTimeout(timer);
  }
}

/** reuse: 직전 판정. 있으면 strict만 바꿔 다시 계산한다 (본세탁을 건너뛰고 요약만 다시 만든다). */
export function wash(reviews: Review[], strict: boolean, reuse?: WashTag[], useMock = isMockApi): Promise<WashResponse> {
  if (useMock) return mockWash(reviews, strict, reuse);
  const tags = reuse ? applyStrict(reuse, strict) : undefined;
  return post<WashResponse>('/wash', { site: 'coupang', strict, reviews: forApi(reviews), ...(tags ? { tags } : {}) });
}

export function ask(request: string, history: string[], reviews: Review[], useMock = isMockApi): Promise<AskResponse> {
  if (useMock) return mockAsk(request, reviews);
  const today = new Date().toISOString().slice(0, 10);
  return post<AskResponse>('/ask', { site: 'coupang', request, today, history, reviews: forApi(reviews) });
}
