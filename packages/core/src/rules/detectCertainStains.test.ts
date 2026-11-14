import { describe, expect, it } from 'vitest';

import fixture from '../../__fixtures__/powerbank.json';
import type { Review } from '../types/review.ts';
import { detectCertainStains } from './detectCertainStains.ts';

const reviews = fixture as Review[];
const tags = detectCertainStains(reviews);
const tagOf = (id: string) => tags.find((t) => t.id === id)!;
const textOf = (id: string) => reviews.find((r) => r.id === id)!.text;

// 규칙 탐지 예시 테스트 (task 4.4)
// **Validates: Requirements 16.3**
describe('detectCertainStains (powerbank fixture)', () => {
  it('리뷰마다 태그 하나를 같은 순서로 돌려준다', () => {
    expect(tags.map((t) => t.id)).toEqual(reviews.map((r) => r.id));
  });

  it('배지 "쿠팡체험단" → platform_badge, evidence null', () => {
    expect(tagOf('cp-1001')).toEqual({
      id: 'cp-1001', stain: 'certain', signal: 'platform_badge', evidence: null, include: false,
    });
  });

  it('쿠팡 고지 문장 → platform_badge + 고지 문장', () => {
    const tag = tagOf('cp-1002');
    expect(tag.stain).toBe('certain');
    expect(tag.signal).toBe('platform_badge');
    expect(tag.evidence).toBe('쿠팡체험단 이벤트로 상품을 무료 제공받아 작성한 리뷰입니다.');
    expect(tag.include).toBe(false);
  });

  it('"제공받아" → disclosure + 원문 문장', () => {
    expect(tagOf('cp-1003')).toEqual({
      id: 'cp-1003', stain: 'certain', signal: 'disclosure',
      evidence: '판매자분께 제품을 제공받아 사용해 보았습니다.', include: false,
    });
  });

  it('"리뷰 이벤트 참여" → review_event + 원문 문장', () => {
    expect(tagOf('cp-1004')).toEqual({
      id: 'cp-1004', stain: 'certain', signal: 'review_event',
      evidence: '리뷰 이벤트 참여하고 남기는 후기예요.', include: false,
    });
  });

  it('띄어쓴 "제공 받아"도 disclosure로 찾는다', () => {
    const tag = tagOf('cp-1005');
    expect(tag.signal).toBe('disclosure');
    expect(tag.evidence).toBe('업체에서 제공 받아 써 본 솔직 후기입니다.');
  });

  it.each(['cp-1006', 'cp-1007'])('부정 문장 %s → none', (id) => {
    expect(tagOf(id)).toEqual({ id, stain: 'none', signal: null, evidence: null, include: true });
  });

  it('규칙 문구가 없는 리뷰(의심 기준 예시 포함)는 none', () => {
    for (const id of ['cp-1008', 'cp-1009', 'cp-1010', 'cp-1011', 'cp-1012']) {
      expect(tagOf(id).stain).toBe('none');
    }
  });

  it('evidence가 있으면 원문에 들어 있다', () => {
    for (const t of tags) if (t.evidence !== null) expect(textOf(t.id)).toContain(t.evidence);
  });
});
