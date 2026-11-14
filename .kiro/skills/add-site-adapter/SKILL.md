---
name: add-site-adapter
description: 별점세탁소에 새 리뷰 사이트(카카오맵, 네이버 지도 등)의 입고 어댑터를 추가한다. 새 사이트 지원, 어댑터 추가, 입고 확장 요청에 사용한다.
---

# 새 사이트 입고 어댑터 추가

세탁 과정(`/wash`, `/ask`)은 사이트와 상관없이 같다. 새 사이트는 어댑터와 규칙만 추가하면 된다.

## 시작 전에 사용자에게 받을 것
- 대상 페이지 URL 예시 1개
- 개발자 도구에서 확인한 리뷰 목록 요청 방식(주소, 파라미터, 응답 형식), 한 번에 오는 리뷰 수
- 리뷰 고유 ID 위치, 대가성 표시(배지·문구)

없으면 추측해서 진행하지 말고 먼저 묻는다.

## 순서
1. `.kiro/steering/intake.md`(쿠팡 규칙)를 읽는다. 새 사이트도 같은 차단 방지 규칙을 따른다.
2. `references/adapter-template.ts`를 복사해 `apps/extension/src/services/adapters/{site}Adapter.ts`를 만든다.
3. 리뷰 ID 접두사를 정한다 (`km-`, `nv-` 등). `packages/core/src/types`의 `Site` 타입에 사이트를 추가한다.
4. `packages/core/src/rules`에 그 사이트의 확실한 얼룩 문구 규칙을 추가한다. `signal` 값은 api-contract.md의 목록만 쓴다.
5. 가상 리뷰로 만든 응답 조각으로 `{site}Adapter.test.ts`를 쓴다. 실제 응답을 넣지 않는다.
6. testing.md의 P1, P2, P6 속성 테스트가 새 사이트 fixture로도 통과하는지 확인한다.
7. manifest `host_permissions`에 도메인을 추가한다.
8. README 3장 표, product.md 지원 사이트 표, docs/KIRO.md의 "Skill 사용 기록"에 한 줄씩 추가한다.
