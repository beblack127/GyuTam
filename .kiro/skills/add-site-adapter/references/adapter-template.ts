// 입고 어댑터 템플릿. {site}를 바꿔서 쓴다.
// 규칙: .kiro/steering/intake.md (한 번에 하나씩, 1~2초 무작위 간격, 차단 시 즉시 중단, 우회 금지)
import type { IntakeAdapter, IntakeProgress, Review } from '@star-laundry/core';

const SITE = '{site}' as const;
const ID_PREFIX = '{prefix}-';

export const {site}Adapter: IntakeAdapter = {
  site: SITE,

  // 현재 페이지가 이 사이트의 리뷰 페이지인지
  matches(url: URL): boolean {
    throw new Error('TODO: 대상 페이지 URL 패턴');
  },

  // 리뷰를 읽는다. 차단 응답(403, 429, 확인 페이지)을 받으면 그때까지 읽은 리뷰를 partial로 돌려준다.
  async intake(onProgress: (p: IntakeProgress) => void): Promise<{ reviews: Review[]; partial: boolean }> {
    throw new Error('TODO: 페이지가 쓰는 것과 같은 요청으로 리뷰 목록 가져오기');
  },
};

// 응답 하나를 Review[]로 바꾼다. 테스트는 이 함수에 가상 응답을 넣어 검증한다.
export function parse{Site}Reviews(raw: string): Review[] {
  throw new Error(`TODO: ${ID_PREFIX} 접두사로 id 만들기`);
}
