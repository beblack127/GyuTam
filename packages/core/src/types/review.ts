export type Site = 'coupang';

export type Source = 'best' | 'latest';

export interface Review {
  id: string; // "cp-..."
  rating: 1 | 2 | 3 | 4 | 5;
  date: string; // YYYY-MM-DD
  text: string; // 전체 본문, 최대 2,000자
  badges: string[]; // 쿠팡이 붙인 표시 문구 그대로 (예: "쿠팡체험단")
  hasPhoto: boolean;
  photos?: string[]; // 확장 전용. API로 보내지 않는다
  option: string | null; // 구매 옵션
  source: Source;
}
