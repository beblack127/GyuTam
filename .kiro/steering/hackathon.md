---
inclusion: always
---

# 해커톤 규칙

- 목표: 18:00까지 데모 시나리오(product.md)가 끊김 없이 동작하는 MVP. 완벽함보다 동작이 우선이다.
- 16:30 기능 동결. 이후에는 버그 수정과 데모 안정화만 한다.
- 우선순위: 쿠팡 입고 + 표준 코스 → 부분 세탁 → 카카오맵 입고 + 이벤트 얼룩 제거 → 섬세 코스.
- 테스트는 `packages/core`와 어댑터 파싱 같은 핵심 로직만. 과한 추상화 금지.
- 새 라이브러리를 추가하기 전에 먼저 물어본다.
- 비밀키는 Lambda 환경 변수에만. 절대 커밋하지 않는다.
- 커밋 메시지: `feat:` / `fix:` / `chore:` / `docs:` / `test:` 접두사.
- 데모 수치는 코드가 계산한 값만 쓴다. 하드코딩하지 않는다.

## 역할 분담
| 역할 | 맡을 부분 | 폴더 | spec | 담당 |
|---|---|---|---|---|
| 입고 | 쿠팡·카카오맵 어댑터, 세탁 태그, 근거 하이라이트 | `apps/extension/src/content`, `apps/extension/src/services/adapters` | review-intake | 미정 |
| 세탁 파이프라인 | 공통 타입, 규칙 탐지, 평점 계산, Lambda 핸들러, 프롬프트 | `packages/core`, `apps/api` | wash-pipeline | 미정 |
| 사이드 패널 | 세탁 요청 입력, 영수증, 평점 애니메이션, API 호출 | `apps/extension/src/sidepanel`, `apps/extension/src/components` | side-panel-receipt | 미정 |
| 인프라·품질 | CDK, 요청 제한, 비용 알림, 품질 검사, Releases zip, README·발표·데모 녹화 | `infra`, `scripts/eval`, `docs` | infra | 미정 |

## 협업 규칙
- 11:20까지 공통 타입(`packages/core/src/types`)과 `POST /wash` 계약을 먼저 확정한다. 세탁 파이프라인 담당이 올리고 전원이 검토한다.
- 그 뒤로는 각자 자기 폴더만 수정한다. 남의 폴더를 바꿔야 하면 담당자에게 먼저 말한다.
- 같은 파일을 동시에 여러 에이전트가 수정하지 않는다.
- 평가 데이터 라벨링은 오후에 전원이 30분씩 나눠서 한다.
- 오전에 인프라·품질 담당은 카카오맵 장소 페이지의 리뷰 DOM과 "후기 더보기" 동작을 먼저 확인한다.

## 제출 전 체크리스트
- [ ] Releases에 `byeoljeom-laundry-extension.zip` 업로드
- [ ] README의 예시 URL, 품질 수치, 스크린샷 채우기 (작성자 이름 가림)
- [ ] 데모 녹화본 백업 (현장 와이파이, 사이트 구조 변경 대비)
- [ ] AWS Budgets 알림과 API 요청 제한 확인
