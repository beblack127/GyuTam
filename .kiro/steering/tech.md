---
inclusion: always
---

# 기술 스택

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript (strict) |
| 모노레포 | npm workspaces (`apps/*`, `packages/*`, `infra`) |
| 확장 | Chrome Extension Manifest V3, Side Panel API, Content Script. 사이드 패널 UI는 React. 대상 사이트는 쿠팡 (카카오맵은 다음 단계) |
| 확장 빌드 | 미정 (Vite 후보). review-intake 또는 side-panel-receipt spec의 design에서 정한다 |
| API | AWS Lambda (Node.js, TypeScript) + API Gateway |
| LLM | Amazon Bedrock. 판정은 경량 모델, 요약과 부분 세탁은 상위 모델. 모델 ID는 Lambda 환경 변수로 바꿀 수 있다 |
| 인프라 | AWS CDK (`infra/`) |
| 테스트 | Vitest (코어 로직, 어댑터 파싱) + fast-check (속성 기반 테스트) |

## 아키텍처 규칙
- 확장 프로그램은 Bedrock을 직접 호출하지 않는다. 항상 API Gateway를 거친다.
- 확장은 manifest의 `host_permissions`에 API 도메인과 쿠팡을 넣는다. 카카오맵은 지원할 때 추가한다.
- 평점, 개수 계산은 `packages/core`의 순수 함수로 한다. LLM 응답의 숫자는 쓰지 않는다.
- `packages/core`는 브라우저, Node 양쪽에서 돌아야 한다. DOM, `fs`, 네트워크 의존 금지.
- API는 상태를 갖지 않는다. 판정 결과는 확장의 탭 메모리에 두고, 부분 세탁 때 확장이 세탁된 리뷰만 보낸다.

## 상세 규칙 (작업 파일에 따라 자동 포함)
- 입고 규칙: `intake.md` (content script, 어댑터 작업 시)
- API 계약: `api-contract.md` (API, 코어, 확장의 API 호출·화면 작업 시)
- 테스트와 correctness property: `testing.md` (테스트 파일 작업 시)
- 카카오맵: `kakaomap.md` (카카오맵 관련 요청 시)

## 보안과 남용 방지
- AWS 자격 증명과 모델 설정은 Lambda 환경에만 둔다. 확장 코드, 커밋에 비밀 정보를 넣지 않는다.
- API는 키 없이 공개된다. 그래서 다음을 반드시 둔다: API Gateway 요청 제한(throttling), 위 입력 검증, AWS Budgets 비용 알림.
- 대회가 끝나면 API를 끄거나 요청 제한을 낮춘다.

## 명령어 (구현 후 갱신)
- 테스트: `npm test --workspaces` (Vitest는 `vitest --run`으로 단발 실행)
- 품질 검사: `scripts/eval` 실행
- 배포: `infra`에서 CDK 배포 (Supervised 모드로 실행)
