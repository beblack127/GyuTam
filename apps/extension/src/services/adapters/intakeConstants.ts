/**
 * 리뷰 입고(Coupang_Adapter) 상수. 상한은 배포 환경에서 시간을 재 본 뒤에만 올린다.
 * (steering/intake.md, Requirements 5.6, 6.3, 6.4)
 */

/** Sort 하나당 요청할 최대 페이지 수 */
export const PAGES_PER_SORT = 5;
/** 중복 제거 후 결과에 담는 최대 리뷰 수 */
export const MAX_REVIEWS = 100;
/** 한 상품 한 번 입고에서 보낼 수 있는 최대 요청 수 */
export const MAX_REQUESTS_PER_PRODUCT = 10;
/** 한 페이지 응답의 리뷰 수. 이보다 적으면 그 Sort의 마지막 페이지 */
export const PAGE_SIZE = 10;
/** 요청 사이 최소 간격 (ms) */
export const MIN_GAP_MS = 1000;
/** 요청 사이 최대 간격 (ms) */
export const MAX_GAP_MS = 2000;
/** 리뷰 본문 최대 길이 */
export const MAX_TEXT_LENGTH = 2000;
/** 리뷰당 최대 사진 수 */
export const MAX_PHOTOS = 5;
/** 쿠팡 리뷰 API 주소 */
export const REVIEW_API_URL = 'https://www.coupang.com/next-api/review';
/** 요청 순서: 베스트순 먼저, 그다음 최신순 */
export const SORTS = [
  { source: 'best', sortBy: 'ORDER_SCORE_ASC' },
  { source: 'latest', sortBy: 'DATE_DESC' },
] as const;
/** 성공 응답의 rCode */
export const SUCCESS_RCODE = 'RET0000';
/** 체험단 배지 문구 */
export const ADVENTURER_BADGE = '쿠팡체험단';
