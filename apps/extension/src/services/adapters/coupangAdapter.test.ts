import { describe, expect, it } from 'vitest';
import {
  BEST,
  LATEST,
  PRODUCT_ID,
  createHarness,
  flush,
  fullPage,
  idBase,
  makeRaws,
  okResponse,
  requestOrder,
} from './__fixtures__/adapterHarness';
import badShapePage from './__fixtures__/coupangPageBadShape.json';
import rcodeErrorPage from './__fixtures__/coupangPageRcodeError.json';
import { buildReviewUrl, coupangAdapter, readProductId, runCoupangIntake } from './coupangAdapter';
import {
  MAX_GAP_MS,
  MAX_REQUESTS_PER_PRODUCT,
  MIN_GAP_MS,
  PAGES_PER_SORT,
  PAGE_SIZE,
  REVIEW_API_URL,
} from './intakeConstants';
import type { HttpResponse } from './intakeTypes';

// 공용 가짜 도구(가짜 fetchPage·sleep·random·시계, 가상 Raw_Review)는 ./__fixtures__/adapterHarness.ts에 있다.
// P2 속성 테스트는 coupangAdapter.property.test.ts에 있다.

// ---------------------------------------------------------------------------
// 4.3 요청 예시 테스트
// ---------------------------------------------------------------------------

describe('readProductId', () => {
  it('상품 경로에서 숫자 Product_Id를 읽는다', () => {
    expect(readProductId('/vp/products/9000000001')).toBe('9000000001');
    expect(readProductId('/vp/products/123?itemId=1')).toBe('123');
  });

  it('상품 경로가 아니면 null', () => {
    expect(readProductId('/np/search')).toBeNull();
    expect(readProductId('/vp/products/')).toBeNull();
    expect(readProductId('')).toBeNull();
  });

  it('coupangAdapter가 같은 함수를 내놓는다', () => {
    expect(coupangAdapter.site).toBe('coupang');
    expect(coupangAdapter.readProductId('/vp/products/42')).toBe('42');
  });
});

describe('buildReviewUrl', () => {
  it('파라미터를 정해진 순서와 값으로 만든다', () => {
    expect(buildReviewUrl('9000000001', 1, BEST)).toBe(
      'https://www.coupang.com/next-api/review?productId=9000000001&page=1&size=10&sortBy=ORDER_SCORE_ASC&ratingSummary=true&ratings=&market=',
    );
    expect(buildReviewUrl('42', 5, LATEST)).toBe(
      `${REVIEW_API_URL}?productId=42&page=5&size=10&sortBy=DATE_DESC&ratingSummary=true&ratings=&market=`,
    );
  });
});

describe('runCoupangIntake: 요청 범위와 순서', () => {
  it('꽉 찬 페이지면 베스트 1~5 → 최신 1~5 순서로 정확히 10회 요청한다', async () => {
    const h = createHarness();
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);

    expect(h.calls).toHaveLength(MAX_REQUESTS_PER_PRODUCT);
    expect(result.requests).toBe(MAX_REQUESTS_PER_PRODUCT);
    const expectedUrls = [
      ...Array.from({ length: PAGES_PER_SORT }, (_, i) => buildReviewUrl(PRODUCT_ID, i + 1, BEST)),
      ...Array.from({ length: PAGES_PER_SORT }, (_, i) => buildReviewUrl(PRODUCT_ID, i + 1, LATEST)),
    ];
    expect(h.calls.map((c) => c.url)).toEqual(expectedUrls);
    expect(result.reviews).toHaveLength(100);
    expect(result.partial).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('한 번에 요청 하나만 진행한다', async () => {
    const h = createHarness();
    await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(h.stats.maxInFlight).toBe(1);
  });

  it('짧은 페이지면 그 Sort를 끝내고, 빈 페이지면 다음 Sort도 끝낸다', async () => {
    const h = createHarness({
      respond: ({ sortBy, page }) => {
        if (sortBy === BEST && page === 2) return okResponse(makeRaws(idBase(BEST, 2), 3));
        if (sortBy === LATEST && page === 1) return okResponse([]);
        return fullPage(sortBy, page);
      },
    });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);

    expect(requestOrder(h.calls)).toEqual([`${BEST}:1`, `${BEST}:2`, `${LATEST}:1`]);
    expect(result.requests).toBe(3);
    expect(result.reviews).toHaveLength(13);
    expect(result.sources).toEqual({ best: 13, latest: 0, duplicates: 0 });
    expect(result.partial).toBe(false);
  });

  it('베스트가 꽉 차고 최신 3페이지가 짧으면 8회에서 끝난다', async () => {
    const h = createHarness({
      respond: ({ sortBy, page }) =>
        sortBy === LATEST && page === 3 ? okResponse(makeRaws(idBase(LATEST, 3), 9)) : fullPage(sortBy, page),
    });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(result.requests).toBe(8);
    expect(requestOrder(h.calls).slice(5)).toEqual([`${LATEST}:1`, `${LATEST}:2`, `${LATEST}:3`]);
  });

  it('fetchPage는 URL 하나만 받는다 (헤더·옵션 인자 없음)', async () => {
    const h = createHarness();
    await runCoupangIntake(PRODUCT_ID, h.deps);
    for (const call of h.calls) {
      expect(call.argCount).toBe(1);
      expect(typeof call.url).toBe('string');
    }
  });
});

describe('runCoupangIntake: 요청 간격', () => {
  it('random 0, 0.5, 0.999 → sleep 1000, 1500, 1999ms, 첫 요청 전에는 쉬지 않는다', async () => {
    const h = createHarness({ randomValues: [0, 0.5, 0.999] });
    await runCoupangIntake(PRODUCT_ID, h.deps);

    expect(h.sleeps).toHaveLength(MAX_REQUESTS_PER_PRODUCT - 1);
    expect(h.sleeps[0]?.requestsBefore).toBe(1); // 첫 sleep은 첫 요청 뒤
    expect(h.sleeps.slice(0, 3).map((s) => s.ms)).toEqual([1000, 1500, 1999]);
    for (const s of h.sleeps) {
      expect(s.ms).toBeGreaterThanOrEqual(MIN_GAP_MS);
      expect(s.ms).toBeLessThan(MAX_GAP_MS);
    }
    expect(h.calls[0]?.at).toBe(0);
  });

  it('응답 처리 끝(onProgress)부터 다음 요청까지 가짜 시계로 1000~2000ms', async () => {
    const h = createHarness({ randomValues: [0, 0.5, 0.999] });
    await runCoupangIntake(PRODUCT_ID, h.deps);

    expect(h.progress).toHaveLength(h.calls.length);
    for (let i = 1; i < h.calls.length; i++) {
      const call = h.calls[i];
      const prev = h.progress[i - 1];
      if (!call || !prev) throw new Error(`요청 ${i} 또는 그 앞 진행 기록이 없다`);
      const gap = call.at - prev.at;
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP_MS);
      expect(gap).toBeLessThan(MAX_GAP_MS);
      expect(gap).toBe(h.sleeps[i - 1]?.ms);
    }
  });

  it('두 Sort 모두 첫 페이지가 비면 요청 2회 사이에만 sleep 1회', async () => {
    const h = createHarness({ respond: () => okResponse([], 0) });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(result.requests).toBe(2);
    expect(h.sleeps).toHaveLength(1);
    expect(h.sleeps[0]?.requestsBefore).toBe(1);
  });
});

describe('runCoupangIntake: 탭 숨김 대기', () => {
  it('waitUntilVisible이 resolve되기 전에는 요청하지 않는다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = createHarness({ waitUntilVisible: () => gate });

    const running = runCoupangIntake(PRODUCT_ID, h.deps);
    await flush();
    expect(h.calls).toHaveLength(0);

    release();
    await running;
    expect(h.calls).toHaveLength(MAX_REQUESTS_PER_PRODUCT);
  });

  it('중간에 숨겨지면 멈췄다가 resolve 후 같은 페이지부터 이어 한다', async () => {
    let waits = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const h = createHarness({
      waitUntilVisible: () => {
        waits++;
        return waits === 3 ? gate : Promise.resolve(); // 세 번째 요청 직전에 숨김
      },
    });

    const running = runCoupangIntake(PRODUCT_ID, h.deps);
    await flush(200);
    expect(requestOrder(h.calls)).toEqual([`${BEST}:1`, `${BEST}:2`]);

    release();
    const result = await running;
    expect(requestOrder(h.calls)[2]).toBe(`${BEST}:3`);
    expect(new Set(h.calls.map((c) => c.url)).size).toBe(h.calls.length); // 같은 페이지 재요청 없음
    expect(result.requests).toBe(MAX_REQUESTS_PER_PRODUCT);
    expect(waits).toBe(MAX_REQUESTS_PER_PRODUCT);
  });
});

describe('runCoupangIntake: 진행률', () => {
  it('꽉 찬 페이지에서 done은 10씩 늘고 total은 MAX_REVIEWS(ratingCount가 더 크면)', async () => {
    const h = createHarness();
    await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(h.progress.map((p) => p.done)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(h.progress.every((p) => p.total === 100)).toBe(true);
  });

  it('ratingCount가 100보다 작으면 total에 반영한다', async () => {
    const h = createHarness({
      respond: ({ sortBy, page }) => {
        if (sortBy === BEST && page === 3) return okResponse(makeRaws(idBase(BEST, 3), 3), 23);
        if (sortBy === LATEST) return okResponse([], 23);
        return okResponse(makeRaws(idBase(sortBy, page), PAGE_SIZE), 23);
      },
    });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(h.progress.map(({ done, total }) => ({ done, total }))).toEqual([
      { done: 10, total: 23 },
      { done: 20, total: 23 },
      { done: 23, total: 23 },
      { done: 23, total: 23 },
    ]);
    expect(result.reviews).toHaveLength(23);
  });

  it('최신순에서 베스트와 겹친 리뷰는 done에 더하지 않는다', async () => {
    const h = createHarness({
      respond: ({ page }) => {
        if (page > 1) return okResponse([]);
        // 최신 1페이지는 베스트 1페이지와 같은 리뷰 10개
        return okResponse(makeRaws(idBase(BEST, 1), PAGE_SIZE));
      },
    });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(h.progress.map((p) => p.done)).toEqual([10, 10, 10, 10]);
    expect(result.sources).toEqual({ best: 10, latest: 10, duplicates: 10 });
  });
});

// ---------------------------------------------------------------------------
// 4.4 멈춤 예시 테스트
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown): HttpResponse {
  return {
    status: 200,
    redirected: false,
    contentType: 'application/json;charset=UTF-8',
    bodyText: JSON.stringify(body),
  };
}

const STOP_CASES: { name: string; reason: 'blocked' | 'captcha' | 'unexpected'; third: () => HttpResponse }[] = [
  { name: '403', reason: 'blocked', third: () => ({ status: 403, redirected: false, contentType: 'text/plain', bodyText: '' }) },
  { name: '429', reason: 'blocked', third: () => ({ status: 429, redirected: false, contentType: 'text/plain', bodyText: '' }) },
  { name: '500', reason: 'blocked', third: () => ({ status: 500, redirected: false, contentType: 'text/plain', bodyText: '' }) },
  { name: 'rCode 오류', reason: 'blocked', third: () => jsonResponse(rcodeErrorPage) },
  {
    name: '리다이렉트',
    reason: 'captcha',
    third: () => ({ ...fullPage(BEST, 3), redirected: true }),
  },
  {
    name: 'HTML',
    reason: 'captcha',
    third: () => ({ status: 200, redirected: false, contentType: 'text/html; charset=UTF-8', bodyText: '<html></html>' }),
  },
  {
    name: 'JSON 아님',
    reason: 'captcha',
    third: () => ({ status: 200, redirected: false, contentType: 'application/json', bodyText: 'not json {' }),
  },
  { name: '모양 다름', reason: 'unexpected', third: () => jsonResponse(badShapePage) },
];

describe('runCoupangIntake: 멈춤', () => {
  for (const c of STOP_CASES) {
    it(`베스트 2페이지 뒤 3번째 요청이 ${c.name}이면 요청 3에서 멈추고 reason=${c.reason}`, async () => {
      const h = createHarness({
        respond: ({ sortBy, page }) => (sortBy === BEST && page === 3 ? c.third() : fullPage(sortBy, page)),
      });
      const result = await runCoupangIntake(PRODUCT_ID, h.deps);

      expect(h.calls).toHaveLength(3);
      expect(result.requests).toBe(3);
      expect(new Set(h.calls.map((x) => x.url)).size).toBe(3);
      expect(result.partial).toBe(true);
      expect(result.reason).toBe(c.reason);
      expect(result.reviews).toHaveLength(20);
    });
  }

  it('베스트 2페이지 뒤 3번째 요청에서 네트워크 예외면 요청 3에서 멈추고 reason=unexpected', async () => {
    const h = createHarness({
      respond: ({ sortBy, page }) => {
        if (sortBy === BEST && page === 3) throw new TypeError('Failed to fetch');
        return fullPage(sortBy, page);
      },
    });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);

    expect(h.calls).toHaveLength(3);
    expect(result.requests).toBe(3);
    expect(new Set(h.calls.map((x) => x.url)).size).toBe(3);
    expect(result.partial).toBe(true);
    expect(result.reason).toBe('unexpected');
    expect(result.reviews).toHaveLength(20);
  });

  it('첫 요청에서 멈추면 리뷰 0개, partial: true', async () => {
    const h = createHarness({
      respond: () => ({ status: 403, redirected: false, contentType: 'text/plain', bodyText: '' }),
    });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);

    expect(h.calls).toHaveLength(1);
    expect(result.requests).toBe(1);
    expect(result.reviews).toEqual([]);
    expect(result.partial).toBe(true);
    expect(result.reason).toBe('blocked');
  });

  it('정상 완료면 partial: false, reason: null', async () => {
    const h = createHarness();
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(result.partial).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('리뷰 0개 상품이면 reviews: [], partial: false', async () => {
    const h = createHarness({ respond: () => okResponse([], 0) });
    const result = await runCoupangIntake(PRODUCT_ID, h.deps);
    expect(result.reviews).toEqual([]);
    expect(result.partial).toBe(false);
    expect(result.reason).toBeNull();
  });
});
