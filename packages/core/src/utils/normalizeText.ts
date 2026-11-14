// 코드 포인트 단위로 문자를 지우는 필터만 쓴다. NFC 변환은 하지 않는다 (design "텍스트 정규화").
const QUOTE_NOISE = /[\s\p{P}\p{S}]/gu;
const WHITESPACE = /\s/gu;

export const normalizeForQuote = (s: string): string => s.replace(QUOTE_NOISE, '');
export const normalizeLoose = (s: string): string => s.replace(WHITESPACE, '').toLowerCase();
export const compact = (s: string): string => s.replace(WHITESPACE, '');
