export type Stain = 'none' | 'certain' | 'suspected';

export type Signal = 'platform_badge' | 'disclosure' | 'review_event' | 'suspected';

export interface WashTag {
  id: string;
  stain: Stain;
  signal: Signal | null;
  evidence: string | null;
  include: boolean;
}

export interface Cited {
  text: string;
  reviewIds: string[];
}

export interface Receipt {
  basedOn: number;
  sources: { best: number; latest: number; duplicates: number };
  before: number | null;
  after: number | null;
  stains: Record<Signal, number>;
  removed: number;
  partial: boolean;
  summary: Cited[];
  pros: Cited[];
  cons: Cited[];
}

/** `buildReceipt` 반환 타입. 구조는 계약의 `Omit<Receipt, 'summary' | 'pros' | 'cons'>`와 같다. */
export type ReceiptCounts = Omit<Receipt, 'summary' | 'pros' | 'cons'>;
