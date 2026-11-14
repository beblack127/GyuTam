---
inclusion: always
---

# 해커톤 규칙

## 제출물과 심사
- 1차 제출물은 동작하는 최종 시스템과 레포다. 발표와 데모 영상은 1차에 필요 없다.
- 1차 심사: AI + 운영진이 레포와 시스템을 검토한다. 상위 3팀이 결선에 간다.

| 1차 항목 | 배점 | 우리가 할 일 |
|---|---|---|
| Kiro 활용 | 35 | spec 4개를 Kiro로 requirements → design → tasks 순서로 진행하고 커밋, steering·hooks·AGENTS.md 정리, README에 링크 |
| 작동 | 30 | 평가자 체험 시나리오(product.md)가 README 안내만으로 동작. 배포된 API, Releases zip, 오류 화면 |
| 문제 정의 | 20 | README 1장 (출처 있는 숫자) |
| 사용자 가치 | 15 | 세탁 후 평점, 세탁 후 요약, 근거 하이라이트 |

- 2차(결선, 상위 3팀만): 심사위원이 발표와 녹화 데모로 평가한다. 문제 정의 25, 사용자 가치 25, Kiro 활용 20(1차 등급 반영), 작동 15(녹화 데모), 발표 15. 결선에 진출하면 그때 준비한다.

## 목표와 우선순위
- 목표: 마감까지 평가자 체험 시나리오가 끊김 없이 동작하는 시스템. 완벽함보다 동작이 우선이다.
- 16:30 기능 동결. 이후에는 버그 수정, 배포 확인, README 정리만 한다.
- 우선순위: 쿠팡 입고 + 표준 코스(세탁 후 평점, 세탁 후 요약) → 근거 하이라이트 → 부분 세탁 → 섬세 코스 → 카카오맵.
- 카카오맵은 쿠팡 시나리오 1~5가 배포 환경에서 모두 동작한 뒤에만 시작한다.

## 작업 규칙
- 각자 맡은 spec은 Kiro Spec 세션으로 만들고, 문서를 승인한 뒤 tasks로 구현한다. spec 문서는 그대로 커밋한다 (Kiro 활용 증거).
- 테스트는 `packages/core`와 어댑터 파싱 같은 핵심 로직만. 과한 추상화 금지.
- 새 라이브러리를 추가하기 전에 먼저 물어본다.
- 비밀키는 Lambda 환경 변수에만. 절대 커밋하지 않는다.
- 커밋 메시지: `feat:` / `fix:` / `chore:` / `docs:` / `test:` 접두사.
- 수치는 코드가 계산한 값만 쓴다. 하드코딩하지 않는다.

## 역할 분담
| 역할 | 맡을 부분 | 폴더 | spec | 담당 |
|---|---|---|---|---|
| 입고·태그 | 쿠팡 어댑터(최대 100개, 1초 간격), 세탁 태그, 근거 하이라이트와 스크롤, 어댑터 파싱 테스트. 쿠팡이 끝나면 카카오맵 어댑터 | `apps/extension/src/content`, `apps/extension/src/services/adapters` | review-intake | 미정 |
| 세탁 파이프라인 | 공통 타입, 규칙 탐지, 평점 계산, Lambda 핸들러, 판정·세탁 후 요약 프롬프트, LLM 응답 검증 | `packages/core`, `apps/api` | wash-pipeline | 미정 |
| 사이드 패널 | 세탁 요청 입력, 영수증, 세탁 후 요약 표시와 근거 클릭, 로딩·오류 화면, 확장 빌드 | `apps/extension/src/sidepanel`, `apps/extension/src/components`, `apps/extension/src/services/api` | side-panel-receipt | 미정 |
| 배포·Kiro·품질 | CDK 배포, 요청 제한, 비용 알림, 전체 연결 확인, Releases zip, `scripts/eval`과 hooks 3개, README의 Kiro 활용·품질 수치 | `infra`, `scripts/eval`, `.kiro/hooks`, `README.md` | infra | 미정 |

- 배포·Kiro·품질 담당은 평가자 역할도 맡는다. 1시간마다 README만 보고 평가자 체험 시나리오를 처음부터 실행해 보고, 막히는 곳을 담당자에게 넘긴다.

## 협업 규칙
- 11:20까지 공통 타입(`packages/core/src/types`)과 `POST /wash` 계약을 먼저 확정한다. 세탁 파이프라인 담당이 올리고 전원이 검토한다.
- 계약이 확정되기 전에는 사이드 패널 담당이 계약 예시 JSON으로 화면을 먼저 만든다.
- 그 뒤로는 각자 자기 폴더만 수정한다. 남의 폴더를 바꿔야 하면 담당자에게 먼저 말한다.
- 같은 파일을 동시에 여러 에이전트가 수정하지 않는다.
- 평가 데이터 라벨링(부분 세탁 주제, 세탁 후 요약 근거 확인)은 오후에 전원이 30분씩 나눠서 한다.

## 제출 전 체크리스트
- [ ] 배포된 API로 평가자 체험 시나리오 1~5 통과 (README만 보고 실행)
- [ ] Releases에 `byeoljeom-laundry-extension.zip` 업로드
- [ ] README의 예시 상품 URL, 품질 수치, 스크린샷 채우기 (작성자 이름 가림)
- [ ] `.kiro/specs`에 spec 4개의 requirements, design, tasks 커밋
- [ ] `.kiro/hooks`에 eval-on-save, secret-scan, readme-sync 커밋
- [ ] AWS Budgets 알림과 API 요청 제한 확인
- [ ] (결선 진출 시) 발표 자료와 녹화 데모 준비
