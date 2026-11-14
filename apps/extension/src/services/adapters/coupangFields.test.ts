import { describe, expect, it } from 'vitest';
import adventurerPage from './__fixtures__/coupangPageAdventurer.json';
import edgePage from './__fixtures__/coupangPageEdge.json';
import normalPage from './__fixtures__/coupangPageNormal.json';
import { AUTHOR_FIELDS, mapCoupangReview } from './coupangFields';
import { ADVENTURER_BADGE, MAX_PHOTOS, MAX_TEXT_LENGTH } from './intakeConstants';
import type { Review } from './intakeTypes';

type RawReview = Record<string, unknown>;

const normal = normalPage.rData.paging.contents as RawReview[];
const adventurer = adventurerPage.rData.paging.contents as RawReview[];
const edge = edgePage.rData.paging.contents as RawReview[];

const ALLOWED_KEYS = ['badges', 'date', 'hasPhoto', 'id', 'option', 'photos', 'rating', 'source', 'text'];

function byId(list: RawReview[], reviewId: number): RawReview {
  const found = list.find((r) => r.reviewId === reviewId);
  if (!found) throw new Error(`fixture에 reviewId ${reviewId}가 없다`);
  return found;
}

function mapOk(raw: unknown, source: 'best' | 'latest' = 'best'): Review {
  const review = mapCoupangReview(raw, source);
  if (review === null) throw new Error('매핑 결과가 null이다');
  return review;
}

describe('mapCoupangReview: 필드 매핑', () => {
  it('reviewId, 별점, 제목+본문, 옵션, source를 옮긴다', () => {
    const review = mapOk(byId(normal, 1001), 'latest');
    expect(review).toEqual({
      id: 'cp-1001',
      rating: 5,
      date: '2026-01-05',
      text: '가볍고 충전이 빨라요\n가방에 넣어도 부담이 없고 출근길에 휴대폰을 두 번 충전했어요.',
      badges: [],
      photos: [
        'https://example.invalid/review/photo-1.jpg',
        'https://example.invalid/review/photo-2.jpg',
      ],
      hasPhoto: true,
      option: '가상 보조배터리 10000mAh, 블랙, 1개',
      source: 'latest',
    });
  });

  it('제목만 있거나 본문만 있으면 줄바꿈 없이 그 값만 쓴다', () => {
    expect(mapOk(byId(normal, 1003)).text).toBe('제목만 남겨요');
    expect(mapOk(byId(normal, 1004)).text).toBe(
      '제목 없이 본문만 쓰는 가상 리뷰입니다. 표시등이 밝아서 밤에 잘 보여요.',
    );
  });

  it('결과 키는 정확히 9개이고 작성자 필드와 값이 없다 (사진 없어도 photos: [])', () => {
    for (const raw of [...normal, ...adventurer]) {
      const review = mapOk(raw);
      expect(Object.keys(review).sort()).toEqual(ALLOWED_KEYS);
      for (const field of AUTHOR_FIELDS) expect(review).not.toHaveProperty(field);
      expect(JSON.stringify(review)).not.toContain('가상작성자');
      expect(JSON.stringify(review)).not.toContain('fake-writer');
    }
    expect(mapOk(byId(normal, 1002)).photos).toEqual([]);
  });
});

describe('mapCoupangReview: KST 날짜', () => {
  it('UTC 14:59:59.999Z는 같은 날, 15:00:00Z는 다음 날', () => {
    expect(mapOk(byId(edge, 3008)).date).toBe('2026-01-04');
    expect(mapOk(byId(edge, 3007)).date).toBe('2026-01-05');
  });

  it('createdAt이 있으면 reviewAt보다 우선한다', () => {
    // 1002: createdAt 2026-01-03, reviewAt 2026-03-20
    expect(mapOk(byId(normal, 1002)).date).toBe('2026-01-03');
  });

  it('createdAt이 없으면 reviewAt을 쓴다', () => {
    expect(mapOk(byId(normal, 1005)).date).toBe('2025-12-28');
  });

  it('날짜 필드가 둘 다 없으면 null', () => {
    const { createdAt: _c, reviewAt: _r, ...raw } = byId(normal, 1001);
    expect(mapCoupangReview(raw, 'best')).toBeNull();
  });
});

describe('mapCoupangReview: 체험단 배지', () => {
  it('vine·isAdventurerReview·badgeTitle이 겹쳐도 "쿠팡체험단"은 한 번만', () => {
    expect(mapOk(byId(adventurer, 2001)).badges).toEqual([ADVENTURER_BADGE]);
    expect(mapOk(byId(adventurer, 2002)).badges).toEqual([ADVENTURER_BADGE]);
  });

  it('vine만 참이어도, isAdventurerReview만 참이어도 추가한다', () => {
    expect(mapOk(byId(adventurer, 2003)).badges).toEqual([ADVENTURER_BADGE]);
    expect(mapOk(byId(adventurer, 2004)).badges).toEqual([ADVENTURER_BADGE]);
  });

  it('TOP_REVIEWER 배지를 순서대로 유지하고 중복 배지는 하나로', () => {
    expect(mapOk(byId(adventurer, 2005)).badges).toEqual(['TOP 500', ADVENTURER_BADGE]);
    expect(mapOk(byId(adventurer, 2007)).badges).toEqual(['TOP 500']);
  });

  it('일반 구매 리뷰에는 배지가 없다', () => {
    expect(mapOk(byId(adventurer, 2006)).badges).toEqual([]);
  });

  it('본문의 체험단 고정 문구를 지우지 않는다', () => {
    const phrase = '쿠팡체험단 이벤트로 상품을 무료 제공받아 작성한 리뷰입니다.';
    expect(mapOk(byId(adventurer, 2001)).text).toBe(
      '체험단으로 써 봤어요\n디자인이 깔끔하고 충전 속도가 빨라요.\n' + phrase,
    );
    expect(mapOk(byId(adventurer, 2005)).text).toContain(phrase);
  });
});

describe('mapCoupangReview: 사진', () => {
  it('// 보정, http:// 버림, 중복 제거, imgSrcOrigin 없으면 imgSrcThumbnail (fixture 3002)', () => {
    const review = mapOk(byId(edge, 3002));
    expect(review.photos).toEqual([
      'https://example.invalid/review/photo-21.jpg',
      'https://example.invalid/review/photo-22.jpg',
      'https://example.invalid/review/photo-24.jpg',
      'https://example.invalid/review/photo-25.jpg',
      'https://example.invalid/review/photo-26.jpg',
    ]);
    expect(review.hasPhoto).toBe(true);
  });

  it('유효한 사진이 7장이면 앞의 5장만 남긴다', () => {
    const attachments = Array.from({ length: 7 }, (_, i) => ({
      id: 990000 + i,
      uploadedFilePath: `/fake/review/limit/${i + 1}.jpg`,
      ordering: i,
      imgSrcOrigin: `https://example.invalid/review/limit-${i + 1}.jpg`,
      imgSrcThumbnail: `https://example.invalid/review/limit-thumb-${i + 1}.jpg`,
      attachmentType: 'IMAGE',
      caption: null,
    }));
    const review = mapOk({ ...byId(edge, 3002), attachments });
    expect(review.photos).toHaveLength(MAX_PHOTOS);
    expect(review.photos).toEqual(attachments.slice(0, 5).map((a) => a.imgSrcOrigin));
    expect(review.hasPhoto).toBe(true);
  });

  it('imgSrcOrigin이 null이면 imgSrcThumbnail을 쓴다', () => {
    expect(mapOk(byId(normal, 1007)).photos).toEqual(['https://example.invalid/review/photo-4.jpg']);
    expect(mapOk(byId(normal, 1010)).photos).toEqual([
      'https://example.invalid/review/photo-5.jpg',
      'https://example.invalid/review/photo-6.jpg',
      'https://example.invalid/review/photo-7.jpg',
    ]);
  });

  it('uploadedFilePath는 URL로 쓰지 않는다', () => {
    const attachments = [
      { id: 1, uploadedFilePath: '/fake/review/only-path.jpg', imgSrcOrigin: null, imgSrcThumbnail: null },
    ];
    const review = mapOk({ ...byId(normal, 1001), attachments });
    expect(review.photos).toEqual([]);
    expect(review.hasPhoto).toBe(true);
  });

  it('attachments가 빈 배열이거나 없으면 hasPhoto는 false', () => {
    expect(mapOk(byId(normal, 1002)).hasPhoto).toBe(false);
    const { attachments: _a, ...raw } = byId(normal, 1001);
    const review = mapOk(raw);
    expect(review.hasPhoto).toBe(false);
    expect(review.photos).toEqual([]);
  });
});

describe('mapCoupangReview: 옵션', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(mapOk(byId(normal, 1003)).option).toBe('가상 보조배터리 20000mAh, 블랙, 1개');
  });

  it('itemName이 숫자·빈 문자열·없음이면 null', () => {
    expect(mapOk(byId(edge, 3003)).option).toBeNull();
    expect(mapOk(byId(edge, 3004)).option).toBeNull();
    expect(mapOk(byId(normal, 1004)).option).toBeNull();
  });
});

describe('mapCoupangReview: 본문 길이와 잘못된 리뷰', () => {
  it('본문을 코드 포인트 2,000개로 자르고 서로게이트 쌍을 쪼개지 않는다', () => {
    const raw = byId(edge, 3001);
    const review = mapOk(raw);
    const points = Array.from(review.text);
    expect(points).toHaveLength(MAX_TEXT_LENGTH);
    expect(review.text).toBe(Array.from(`긴 리뷰\n${raw.content as string}`).slice(0, MAX_TEXT_LENGTH).join(''));
    expect(review.text.startsWith('긴 리뷰\n🔋😀')).toBe(true);
    // 끝에 짝 없는 서로게이트가 남지 않는다
    expect(review.text).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it('2,000번째 코드 포인트가 이모지여도 쪼개지 않는다', () => {
    const content = 'a'.repeat(MAX_TEXT_LENGTH - 1) + '😀😀';
    const review = mapOk({ ...byId(normal, 1004), content });
    expect(Array.from(review.text)).toHaveLength(MAX_TEXT_LENGTH);
    expect(review.text.endsWith('a😀')).toBe(true);
  });

  it('reviewId가 없으면 null', () => {
    const raw = edge.find((r) => r.reviewId === undefined);
    expect(raw).toBeDefined();
    expect(mapCoupangReview(raw, 'best')).toBeNull();
  });

  it('rating이 0이면 null', () => {
    expect(mapCoupangReview(byId(edge, 3006), 'best')).toBeNull();
  });

  it('edge fixture에서 잘못된 두 리뷰만 빠진다', () => {
    const ids = edge
      .map((r) => mapCoupangReview(r, 'latest'))
      .filter((r): r is Review => r !== null)
      .map((r) => r.id);
    expect(ids).toEqual(['cp-3001', 'cp-3002', 'cp-3003', 'cp-3004', 'cp-3007', 'cp-3008']);
  });
});
