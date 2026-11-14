---
inclusion: auto
name: kakaomap-adapter
description: 카카오맵 장소 페이지 입고 어댑터, 카카오맵 리뷰이벤트 얼룩 판별, 이벤트 얼룩 제거 작업을 할 때 사용한다.
---

# 카카오맵 (다음 단계)

쿠팡의 평가자 체험 시나리오 1~5가 배포 환경에서 모두 동작한 뒤에만 시작한다.

## 범위
- 대상: 카카오맵 장소 상세 페이지의 후기
- 입고: "후기 더보기"로 최대 100개. 쿠팡과 같은 입고 규칙(한 번에 하나씩, 1~2초 간격, 차단 시 멈춤)
- 리뷰 ID 접두사: `km-`. `site: "kakaomap"`

## 얼룩 신호
| 판정 | 신호 | `signal` |
|---|---|---|
| 🔴 확실한 얼룩 | "리뷰 이벤트로 받은", "리뷰 약속", "리뷰 쓰고 서비스" 등 원문 명시 | `review_event` |
| 🟡 의심 얼룩 | "서비스 감사해요" + 5점, 내용 없는 짧은 극찬 | `suspected` |

## 할 일
1. `add-site-adapter` skill로 `kakaomapAdapter.ts`를 추가한다.
2. `packages/core/rules`에 리뷰이벤트 문구 규칙을 추가하고 testing.md의 속성 테스트를 통과시킨다.
3. manifest `host_permissions`에 카카오맵 도메인을 추가한다.
4. README, product.md의 "다음 단계" 표시를 지운다.

## 확인 결과
- 후기 목록 요청 방식과 한 번에 불러오는 개수: __
- 리뷰 고유 ID 위치: __
