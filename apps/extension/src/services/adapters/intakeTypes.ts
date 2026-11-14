// 임시: 재현의 @star-laundry/core 타입이 올라오면 교체
// 형식 근거: api-contract.md의 Review, intake.md의 확장 내부 메시지 표.
// DOM, chrome.*, 전역 fetch에 의존하지 않는 타입만 둔다.

export type Source = 'best' | 'latest';

export interface Review {
  id: string; // "cp-{reviewId}"
  rating: 1 | 2 | 3 | 4 | 5;
  date: string; // YYYY-MM-DD (KST)
  text: string; // 제목+본문, 최대 2,000자
  badges: string[];
  hasPhoto: boolean;
  photos?: string[]; // 확장 전용, 최대 5개, https만
  option: string | null;
  source: Source;
}

/** 입고가 중간에 멈춘 이유. `hidden_tab`은 타입에만 둔다 (MVP는 숨김 시 무기한 대기). */
export type IntakeStopReason = 'blocked' | 'captcha' | 'unexpected' | 'hidden_tab';

/** 리뷰를 하나도 못 읽었을 때 `intake:error`의 이유. */
export type IntakeErrorReason = 'not_product_page' | 'blocked' | 'parse_failed';

export interface IntakeSources {
  best: number;
  latest: number;
  duplicates: number;
}

export interface IntakeResult {
  reviews: Review[];
  partial: boolean;
  reason: IntakeStopReason | null;
  sources: IntakeSources;
  requests: number; // 보낸 요청 수 (테스트·진단용, 메시지에는 싣지 않음)
}

/**
 * 확장 내부 입고 메시지. 모든 메시지에 `tabId`를 담는다.
 * `intake:done.sources`는 intake.md 표에 없는 추가 필드다 (design 열린 항목 1).
 */
export type IntakeMessage =
  | { type: 'intake:start'; tabId: number }
  | { type: 'intake:progress'; tabId: number; done: number; total: number }
  | {
      type: 'intake:done';
      tabId: number;
      reviews: Review[];
      partial: boolean;
      reason: IntakeStopReason | null;
      sources: IntakeSources;
    }
  | { type: 'intake:error'; tabId: number; reason: IntakeErrorReason };

/** `chrome.storage.session`의 `tab:{tabId}` 값. */
export interface TabSession {
  productId: string;
  reviews: Review[];
  intake: {
    done: number;
    total: number;
    partial: boolean;
    reason: IntakeStopReason | null;
    sources: IntakeSources;
  };
  wash?: unknown; // 정민 소유, 입고 코드는 읽지 않고 보존만
  steps?: unknown; // 정민 소유
}

/** 주입받는 요청 함수의 응답. 실제 fetch 연결은 content script가 한다. */
export interface HttpResponse {
  status: number;
  redirected: boolean;
  contentType: string | null;
  bodyText: string;
}

/** 어댑터가 주입받는 의존성. 테스트에서는 가짜 구현을 넣는다. */
export interface IntakeDeps {
  fetchPage: (url: string) => Promise<HttpResponse>;
  sleep: (ms: number) => Promise<void>;
  random: () => number; // [0, 1)
  now: () => number; // epoch ms
  waitUntilVisible: () => Promise<void>;
  onProgress?: (p: { done: number; total: number }) => void;
}

export interface ReviewAdapter {
  site: 'coupang';
  readProductId(pathname: string): string | null;
  run(productId: string, deps: IntakeDeps): Promise<IntakeResult>;
}
