// /wash, /ask 응답 모양 (api-contract.md). 공통 타입은 @star-laundry/core 에서 가져온다.
import type { Cited, Conditions, Match, Receipt, WashTag } from '@star-laundry/core';

export interface WashResponse {
  tags: WashTag[];
  receipt: Receipt;
}

export interface AskResponse {
  conditions: Conditions;
  label: string;
  unsupported: string | null;
  matches: Match[];
  matched: number;
  rating: { average: number | null; count: number };
  summary: Cited[];
  pros: Cited[];
  cons: Cited[];
}
