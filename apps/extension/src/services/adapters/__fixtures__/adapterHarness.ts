// ---------------------------------------------------------------------------
// 쿠팡 어댑터 테스트 공용 가짜 도구 (coupangAdapter.test.ts, coupangAdapter.property.test.ts)
// 모든 리뷰는 가상 fixture 모양을 복제한 가짜 값이다.
// ---------------------------------------------------------------------------
import { PAGE_SIZE, SUCCESS_RCODE } from '../intakeConstants';
import type { HttpResponse, IntakeDeps } from '../intakeTypes';
import normalPage from './coupangPageNormal.json';

export type RawReview = Record<string, unknown>;
export type SortBy = 'ORDER_SCORE_ASC' | 'DATE_DESC';

export const PRODUCT_ID = '9000000001';
export const BEST = 'ORDER_SCORE_ASC';
export const LATEST = 'DATE_DESC';

const TEMPLATE_RAW = (normalPage.rData.paging.contents as RawReview[])[0];

/** fixture 리뷰 모양을 복제해 `reviewId`만 바꾼 가상 Raw_Review. */
export function makeRaw(reviewId: number): RawReview {
  const raw = JSON.parse(JSON.stringify(TEMPLATE_RAW)) as RawReview;
  raw.reviewId = reviewId;
  raw.title = `가상 리뷰 ${reviewId}`;
  return raw;
}

/** `startId`부터 연속된 id로 가상 Raw_Review `count`개. */
export function makeRaws(startId: number, count: number): RawReview[] {
  return Array.from({ length: count }, (_, i) => makeRaw(startId + i));
}

/** 성공 응답 본문 JSON 문자열. */
export function pageBody(raws: unknown[], ratingCount: number | null = 1234): string {
  const rData: Record<string, unknown> = {
    paging: { currentPage: 1, pageSize: PAGE_SIZE, totalPage: 0, contents: raws },
  };
  if (ratingCount !== null) rData.ratingSummaryTotal = { ratingCount, ratingAverage: 4, ratingSummaries: [] };
  return JSON.stringify({ rCode: SUCCESS_RCODE, rMessage: 'SUCCESS', rData });
}

/** 200 JSON 응답. */
export function okResponse(raws: unknown[], ratingCount: number | null = 1234): HttpResponse {
  return {
    status: 200,
    redirected: false,
    contentType: 'application/json;charset=UTF-8',
    bodyText: pageBody(raws, ratingCount),
  };
}

/** 베스트/최신과 페이지 번호로 겹치지 않는 id 시작값. */
export function idBase(sortBy: SortBy, page: number): number {
  return (sortBy === BEST ? 100_000 : 200_000) + page * 100;
}

/** 모든 페이지가 고유 리뷰 10개로 꽉 찬 응답. */
export function fullPage(sortBy: SortBy, page: number): HttpResponse {
  return okResponse(makeRaws(idBase(sortBy, page), PAGE_SIZE));
}

export function parseRequest(url: string): { sortBy: SortBy; page: number } {
  const params = new URL(url).searchParams;
  return { sortBy: params.get('sortBy') as SortBy, page: Number(params.get('page')) };
}

export type Responder = (req: { sortBy: SortBy; page: number; url: string }) => HttpResponse | Promise<HttpResponse>;

export interface FetchCall {
  url: string;
  argCount: number;
  at: number; // 가짜 시계 시각
}

export interface HarnessOptions {
  respond?: Responder;
  randomValues?: number[];
  waitUntilVisible?: () => Promise<void>;
}

/**
 * 가짜 의존성 묶음.
 * - `fetchPage`: 호출 URL·인자 수·시각 기록, 동시 진행 수 기록. 응답은 몇 번의 마이크로태스크 뒤에 돌려준다.
 * - `sleep`: 실제로 기다리지 않고 가짜 시계를 `ms`만큼 앞으로 민다.
 * - `random`: `randomValues`를 차례로 돌려 쓴다.
 * - `now`: 가짜 시계.
 * - `onProgress`: 호출 값과 시각 기록 (응답 처리 끝 시각으로 쓴다).
 */
export function createHarness(options: HarnessOptions = {}) {
  const respond: Responder = options.respond ?? (({ sortBy, page }) => fullPage(sortBy, page));
  const randomValues = options.randomValues ?? [0.5];
  let clock = 0;
  let randomIndex = 0;
  let inFlight = 0;

  const calls: FetchCall[] = [];
  const sleeps: { ms: number; requestsBefore: number }[] = [];
  const progress: { done: number; total: number; at: number }[] = [];
  const stats = { maxInFlight: 0 };

  const deps: IntakeDeps = {
    fetchPage: async (url: string, ...rest: unknown[]) => {
      calls.push({ url, argCount: 1 + rest.length, at: clock });
      inFlight++;
      stats.maxInFlight = Math.max(stats.maxInFlight, inFlight);
      try {
        for (let i = 0; i < 3; i++) await Promise.resolve();
        return await respond({ ...parseRequest(url), url });
      } finally {
        inFlight--;
      }
    },
    sleep: async (ms: number) => {
      sleeps.push({ ms, requestsBefore: calls.length });
      clock += ms;
    },
    random: () => {
      const value = randomValues[randomIndex % randomValues.length];
      if (value === undefined) throw new Error('randomValues가 비어 있다');
      randomIndex++;
      return value;
    },
    now: () => clock,
    waitUntilVisible: options.waitUntilVisible ?? (() => Promise.resolve()),
    onProgress: (p) => {
      progress.push({ ...p, at: clock });
    },
  };

  return { deps, calls, sleeps, progress, stats, now: () => clock };
}

/** 대기 중인 마이크로태스크를 넉넉히 비운다. */
export async function flush(times = 50): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

export function requestOrder(calls: FetchCall[]): string[] {
  return calls.map((c) => {
    const { sortBy, page } = parseRequest(c.url);
    return `${sortBy}:${page}`;
  });
}
