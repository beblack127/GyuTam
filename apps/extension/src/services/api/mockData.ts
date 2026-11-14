// 화면 확인용 가상 리뷰와 가상 API 응답. 실제 리뷰 원문이 아니다.
// VITE_API_BASE_URL 이 비어 있거나 "예시 리뷰로 체험하기"를 누르면 쓴다.
import type { Cited, Conditions, Match, Review, Signal, WashTag } from '@star-laundry/core';

import type { AskResponse, WashResponse } from '@/types/api';

// 가짜 API 안의 계산. 실제로는 API가 코어 함수로 계산한다.
function averageRating(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  return Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10;
}

function applyStrict(tags: WashTag[], strict: boolean): WashTag[] {
  return tags.map((t) => ({ ...t, include: t.stain === 'none' || (t.stain === 'suspected' && !strict) }));
}

type Seed = [rating: Review['rating'], text: string, extra?: Partial<Review>];

const SEEDS: Seed[] = [
  [5, '쿠팡체험단으로 제공받아 작성한 리뷰입니다. 디자인이 깔끔하고 충전 속도도 만족스러워요.', { badges: ['쿠팡체험단'], hasPhoto: true }],
  [5, '가방에 넣고 다녀도 무겁다는 느낌이 없어요. 폰 두 번은 거뜬히 충전됩니다.', { hasPhoto: true }],
  [4, '용량은 만족하는데 고속 충전할 때 열이 많이 나요. 그래도 가격 생각하면 괜찮습니다.'],
  [3, '한 시간쯤 충전하면 본체가 꽤 뜨거워져요. 가방 안에 넣고 쓰기는 조금 걱정됩니다.', { hasPhoto: true }],
  [5, '최고예요 강추합니다!!'],
  [5, '업체로부터 제품을 제공받아 솔직하게 작성했습니다. 마감이 좋고 케이블도 들어 있어요.', { hasPhoto: true }],
  [4, '바지 주머니에 넣으면 묵직해서 처지네요. 가방용으로는 딱 좋아요.'],
  [2, '두 달 쓰니까 충전 표시등이 가끔 안 켜져요. 교환 문의 중입니다.'],
  [5, '쿠팡체험단 리뷰입니다. 아이폰 충전 잘 되고 크기도 적당해요.', { badges: ['쿠팡체험단'] }],
  [5, '좋아요 좋아요 너무 좋아요'],
  [4, '출장 갈 때 챙겼는데 노트북은 안 되고 폰이랑 태블릿만 됩니다. 설명을 잘 읽고 사세요.'],
  [3, '여름에는 손으로 잡기 부담스러울 만큼 따뜻해집니다. 그 외에는 좋아요.'],
  [5, '충전 속도가 확실히 빨라요. 30분에 절반 넘게 찹니다.', { hasPhoto: true }],
  [1, '받자마자 불량이라 반품했습니다. 포장은 꼼꼼했어요.', { hasPhoto: true }],
  [5, '쿠팡체험단으로 받았습니다. 무게가 생각보다 가벼워서 놀랐어요.', { badges: ['쿠팡체험단'], hasPhoto: true }],
  [4, '크기가 손바닥만 해서 휴대하기 좋아요. 다만 케이블이 짧아요.'],
  [5, '부모님 선물로 샀는데 버튼이 하나라 쓰기 쉽다고 하세요.'],
  [2, '고속 충전 지원이라더니 제 폰에서는 일반 속도로만 충전돼요.'],
  [5, '너무 좋아요 최고!! 강추'],
  [4, '캠핑 가서 이틀 동안 잘 썼어요. 무게는 좀 있는 편입니다.', { hasPhoto: true }],
  [5, '협찬으로 받은 제품입니다. 색상이 사진과 똑같고 예뻐요.', { badges: [] }],
  [3, '충전은 잘 되는데 본체 충전에 시간이 오래 걸려요. 밤새 꽂아 둬야 합니다.'],
  [5, '두 개째 사요. 첫 번째 것도 1년 넘게 잘 쓰고 있어요.'],
  [4, '선 정리가 편하고 잔량 표시가 숫자로 나와서 좋아요.', { hasPhoto: true }],
];

const OPTIONS = ['블랙 / 20000mAh', '화이트 / 20000mAh', '블랙 / 10000mAh'];

export const MOCK_PRODUCT = '보조배터리 20000mAh (예시 상품)';

export const MOCK_REVIEWS: Review[] = SEEDS.map(([rating, text, extra], i) => {
  const day = String(28 - (i % 27)).padStart(2, '0');
  const month = i < 12 ? '10' : '09';
  return {
    id: `cp-${1001 + i}`,
    rating,
    date: `2026-${month}-${day}`,
    text,
    badges: [],
    hasPhoto: false,
    option: OPTIONS[i % OPTIONS.length] ?? null,
    source: i % 2 === 0 ? 'best' : 'latest',
    ...extra,
  };
});

export const MOCK_SOURCES = { best: 12, latest: 14, duplicates: 2 };

const DISCLOSURE = ['제공받아', '협찬'];
const SUSPECT = ['강추', '너무 좋아요', '좋아요 좋아요'];

function judge(r: Review): WashTag {
  if (r.badges.some((b) => b.includes('체험단'))) {
    return { id: r.id, stain: 'certain', signal: 'platform_badge', evidence: null, include: false };
  }
  const disclosed = DISCLOSURE.find((w) => r.text.includes(w));
  if (disclosed) {
    const sentence = r.text.split(/(?<=[.!?])\s+/).find((s) => s.includes(disclosed)) ?? disclosed;
    return { id: r.id, stain: 'certain', signal: 'disclosure', evidence: sentence, include: false };
  }
  if (r.text.length < 20 && SUSPECT.some((w) => r.text.includes(w))) {
    return { id: r.id, stain: 'suspected', signal: 'suspected', evidence: r.text, include: true };
  }
  return { id: r.id, stain: 'none', signal: null, evidence: null, include: true };
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function cite(text: string, ids: string[], allowed: Set<string>): Cited | null {
  const kept = ids.filter((id) => allowed.has(id));
  return kept.length ? { text, reviewIds: kept } : null;
}

export async function mockWash(reviews: Review[], strict: boolean, reuse?: WashTag[]): Promise<WashResponse> {
  await delay(reuse ? 900 : 3200);
  const tags = applyStrict(reuse ?? reviews.map(judge), strict);
  const included = new Set(tags.filter((t) => t.include).map((t) => t.id));
  const stains: Record<Signal, number> = { platform_badge: 0, disclosure: 0, review_event: 0, suspected: 0 };
  for (const t of tags) if (t.signal) stains[t.signal] += 1;
  const summary = [
    cite('가볍고 충전이 빠르다는 평가가 많다.', ['cp-1002', 'cp-1013', 'cp-1016'], included),
    cite('오래 쓰면 뜨거워진다는 리뷰도 꾸준히 있다.', ['cp-1003', 'cp-1004', 'cp-1012'], included),
  ].filter((c): c is Cited => c !== null);
  const pros = [
    cite('가방에 넣기 부담 없는 무게', ['cp-1002', 'cp-1016'], included),
    cite('충전 속도가 빠름', ['cp-1013'], included),
    cite('잔량 표시와 선 정리가 편함', ['cp-1024'], included),
  ].filter((c): c is Cited => c !== null);
  const cons = [
    cite('오래 쓰면 발열', ['cp-1003', 'cp-1004', 'cp-1012'], included),
    cite('주머니에 넣기엔 무거움', ['cp-1007', 'cp-1020'], included),
    cite('일부 기기에서 고속 충전이 안 됨', ['cp-1018'], included),
  ].filter((c): c is Cited => c !== null);
  return {
    tags,
    receipt: {
      basedOn: reviews.length,
      sources: MOCK_SOURCES,
      before: averageRating(reviews),
      after: averageRating(reviews.filter((r) => included.has(r.id))),
      stains,
      removed: tags.filter((t) => !t.include).length,
      partial: false,
      summary,
      pros,
      cons,
    },
  };
}

const TOPICS = ['발열', '무게', '충전', '크기', '불량', '케이블', '선물'];
const TOPIC_WORDS: Record<string, string[]> = {
  발열: ['뜨거', '열이', '따뜻'],
  무게: ['무게', '무겁', '묵직', '가벼'],
  충전: ['충전'],
  크기: ['크기', '손바닥'],
  불량: ['불량', '반품', '교환'],
  케이블: ['케이블', '선 '],
  선물: ['선물'],
};

export async function mockAsk(request: string, reviews: Review[]): Promise<AskResponse> {
  await delay(1400);
  const conditions: Conditions = {};
  const labels: string[] = [];
  if (/사진/.test(request)) {
    conditions.hasPhoto = true;
    labels.push('사진 있음');
  }
  const max = request.match(/([1-5])\s*점\s*이하/);
  const min = request.match(/([1-5])\s*점\s*이상/);
  if (max) {
    conditions.rating = { max: Number(max[1]) };
    labels.push(`${max[1]}점 이하`);
  } else if (min) {
    conditions.rating = { min: Number(min[1]) };
    labels.push(`${min[1]}점 이상`);
  }
  const topic = TOPICS.find((t) => request.includes(t)) ?? null;
  if (topic) {
    conditions.semantic = topic;
    labels.push(topic);
  }
  const unsupported = labels.length === 0 ? request : null;

  const matches: Match[] = [];
  for (const r of reviews) {
    if (conditions.hasPhoto && !r.hasPhoto) continue;
    if (conditions.rating?.max && r.rating > conditions.rating.max) continue;
    if (conditions.rating?.min && r.rating < conditions.rating.min) continue;
    if (topic) {
      const words = TOPIC_WORDS[topic] ?? [topic];
      const sentence = r.text.split(/(?<=[.!?])\s+/).find((s) => words.some((w) => s.includes(w)));
      if (!sentence) continue;
      matches.push({ id: r.id, quote: sentence });
    } else if (labels.length) {
      matches.push({ id: r.id, quote: null });
    }
  }
  const picked = reviews.filter((r) => matches.some((m) => m.id === r.id));
  const ids = picked.map((r) => r.id);
  const first = ids.slice(0, 2);
  return {
    conditions,
    label: labels.join(' · ') || request.slice(0, 12),
    unsupported,
    matches,
    matched: matches.length,
    rating: { average: averageRating(picked), count: picked.length },
    summary: picked.length ? [{ text: `조건에 맞는 리뷰 ${picked.length}개를 예시 데이터로 골랐어요.`, reviewIds: first }] : [],
    pros: picked.length >= 4 ? [{ text: '예시 장점 문장', reviewIds: first }] : [],
    cons: picked.length >= 4 ? [{ text: '예시 단점 문장', reviewIds: ids.slice(-1) }] : [],
  };
}
