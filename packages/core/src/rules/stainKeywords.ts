// 규칙 문구 상수. 이 파일이 유일한 정의 위치다 (Requirement 6.12).
// PLATFORM_BADGE_TERM, PLATFORM_NOTICE는 임시 값이다. intake.md "쿠팡 페이지 확인 결과"가 채워지면 task 11.1에서 교체한다.
export const PLATFORM_BADGE_TERM = '체험단';
export const PLATFORM_NOTICE = '쿠팡체험단 이벤트로 상품을 무료로 제공받아 작성된 후기입니다';
export const DISCLOSURE_PHRASES = [
  '체험단',
  '제공받아',
  '제공 받아',
  '협찬',
  '원고료',
  '소정의',
  '무상으로 제공',
  '무료로 제공',
  '업체로부터',
  '지원받아',
] as const;
export const REVIEW_EVENT_PHRASES = [
  '리뷰 이벤트',
  '리뷰이벤트',
  '포토리뷰 이벤트',
  '리뷰 작성 시',
  '리뷰 쓰면',
  '사은품 받',
  '적립금 받',
] as const;
export const NEGATIONS = [
  '아니',
  '아님',
  '아닙',
  '않',
  '안 받',
  '없이',
  '내돈내산',
  '내 돈 내 산',
  '직접 구매',
  '제 돈으로',
] as const;
export const NEGATION_WINDOW = 15;
