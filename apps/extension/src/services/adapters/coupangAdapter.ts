/**
 * 쿠팡 리뷰 입고 어댑터. URL 만들기, 응답 분류, 요청 루프.
 * (design.md "coupangAdapter.ts", steering/intake.md)
 *
 * DOM, chrome.*, 전역 fetch에 의존하지 않는다. 요청 함수는 주입받는다.
 * 이 파일은 로그를 남기지 않는다.
 */
import { mapCoupangReview } from './coupangFields';
import { dedupeReviews } from './dedupeReviews';
import {
  MAX_GAP_MS,
  MAX_REQUESTS_PER_PRODUCT,
  MAX_REVIEWS,
  MIN_GAP_MS,
  PAGES_PER_SORT,
  PAGE_SIZE,
  REVIEW_API_URL,
  SORTS,
  SUCCESS_RCODE,
} from './intakeConstants';
import type {
  HttpResponse,
  IntakeDeps,
  IntakeResult,
  IntakeStopReason,
  Review,
  ReviewAdapter,
} from './intakeTypes';

const PRODUCT_ID_RE = /products\/(\d+)/;

/** 페이지 경로(`location.pathname`)에서 Product_Id를 읽는다. 없으면 `null`. (Requirement 1.7) */
export function readProductId(pathname: string): string | null {
  const match = PRODUCT_ID_RE.exec(pathname);
  return match?.[1] ?? null;
}

/**
 * 리뷰 목록 요청 주소. 페이지가 리뷰 페이지를 넘길 때 쓰는 것과 같은 파라미터를 같은 순서로 둔다.
 * `productId, page, size=10, sortBy, ratingSummary=true, ratings=, market=` (Requirement 5.1)
 */
export function buildReviewUrl(productId: string, page: number, sortBy: string): string {
  const params = new URLSearchParams();
  params.append('productId', productId);
  params.append('page', String(page));
  params.append('size', String(PAGE_SIZE));
  params.append('sortBy', sortBy);
  params.append('ratingSummary', 'true');
  params.append('ratings', '');
  params.append('market', '');
  return `${REVIEW_API_URL}?${params.toString()}`;
}

export type PageOutcome =
  | { kind: 'ok'; raws: unknown[]; ratingCount: number | null }
  | { kind: 'stop'; reason: 'blocked' | 'captcha' | 'unexpected' };

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/**
 * 응답 하나를 분류한다. 예외를 던지지 않는다. (Requirements 7.1~7.5)
 * 판정 순서:
 * 1. 403, 429 → blocked
 * 2. 200 아님 → blocked
 * 3. 리다이렉트됐거나 Content-Type에 text/html → captcha
 * 4. JSON으로 읽을 수 없음 → captcha
 * 5. rCode가 RET0000 아님 → blocked
 * 6. rData.paging.contents가 배열 아님 → unexpected
 * 7. 그 밖 → ok (`ratingCount`는 `rData.ratingSummaryTotal.ratingCount`가 숫자면 그 값)
 *
 * "비어 있지 않은 페이지에서 매핑된 리뷰가 하나도 없음"(7.5 후반)은 매핑 뒤에 요청 루프가 판정한다.
 */
export function classifyResponse(res: HttpResponse): PageOutcome {
  if (res.status === 403 || res.status === 429) return { kind: 'stop', reason: 'blocked' };
  if (res.status !== 200) return { kind: 'stop', reason: 'blocked' };
  if (res.redirected || (res.contentType ?? '').toLowerCase().includes('text/html')) {
    return { kind: 'stop', reason: 'captcha' };
  }

  const parsed = parseJson(res.bodyText);
  if (!parsed.ok) return { kind: 'stop', reason: 'captcha' };

  const body = parsed.value;
  if (!isRecord(body) || body.rCode !== SUCCESS_RCODE) return { kind: 'stop', reason: 'blocked' };

  const rData = body.rData;
  const paging = isRecord(rData) ? rData.paging : undefined;
  const contents = isRecord(paging) ? paging.contents : undefined;
  if (!Array.isArray(contents)) return { kind: 'stop', reason: 'unexpected' };
  const raws: unknown[] = contents;

  const summary = isRecord(rData) ? rData.ratingSummaryTotal : undefined;
  const count = isRecord(summary) ? summary.ratingCount : undefined;
  const ratingCount = typeof count === 'number' && Number.isFinite(count) ? count : null;

  return { kind: 'ok', raws, ratingCount };
}

function isReview(value: Review | null): value is Review {
  return value !== null;
}

/**
 * 베스트순 1~5페이지 → 최신순 1~5페이지를 하나씩 순서대로 요청한다.
 * (Requirements 1.3, 3.1~3.3, 5.2~5.4, 6.1~6.4, 7.5~7.8, 8.2, 8.5, 11.3)
 *
 * - 첫 요청 전에는 쉬지 않고, 그 뒤 요청마다 `MIN_GAP_MS ~ MAX_GAP_MS` 무작위로 쉰다.
 * - 요청마다 `waitUntilVisible()`을 기다린다. 숨겨진 시간은 간격에 더해질 뿐 줄이지 않는다.
 * - 짧은 페이지(`PAGE_SIZE` 미만)나 빈 페이지면 그 Sort를 끝낸다.
 * - 멈춤 사유(blocked, captcha, unexpected)를 받으면 바로 끝낸다. 같은 요청을 다시 보내지 않는다.
 * - `deps.now`는 쓰지 않는다 (테스트가 간격을 재는 데만 쓴다).
 */
export async function runCoupangIntake(productId: string, deps: IntakeDeps): Promise<IntakeResult> {
  let requests = 0;
  let stop: IntakeStopReason | null = null;
  let total = MAX_REVIEWS;
  const best: Review[] = [];
  const latest: Review[] = [];

  outer: for (const { source, sortBy } of SORTS) {
    for (let page = 1; page <= PAGES_PER_SORT; page++) {
      if (requests >= MAX_REQUESTS_PER_PRODUCT) break outer;
      if (requests > 0) {
        await deps.sleep(MIN_GAP_MS + deps.random() * (MAX_GAP_MS - MIN_GAP_MS));
      }
      await deps.waitUntilVisible();
      requests++;

      let res: HttpResponse;
      try {
        res = await deps.fetchPage(buildReviewUrl(productId, page, sortBy));
      } catch {
        stop = 'unexpected';
        break outer;
      }

      const outcome = classifyResponse(res);
      if (outcome.kind === 'stop') {
        stop = outcome.reason;
        break outer;
      }

      if (outcome.ratingCount !== null) total = Math.min(MAX_REVIEWS, outcome.ratingCount);

      const mapped = outcome.raws.map((raw) => mapCoupangReview(raw, source)).filter(isReview);
      if (outcome.raws.length > 0 && mapped.length === 0) {
        stop = 'unexpected';
        break outer;
      }

      (source === 'best' ? best : latest).push(...mapped);
      const done = Math.min(MAX_REVIEWS, dedupeReviews(best, latest).reviews.length);
      deps.onProgress?.({ done, total });

      if (outcome.raws.length < PAGE_SIZE) break; // 이 Sort의 마지막 페이지
    }
  }

  const { reviews, sources } = dedupeReviews(best, latest);
  return {
    reviews: reviews.slice(0, MAX_REVIEWS),
    partial: stop !== null,
    reason: stop,
    sources,
    requests,
  };
}

export const coupangAdapter: ReviewAdapter = {
  site: 'coupang',
  readProductId,
  run: runCoupangIntake,
};
