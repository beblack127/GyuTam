---
inclusion: always
---

# 기술 스택

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript (strict) |
| 모노레포 | npm workspaces (`apps/*`, `packages/*`, `infra`) |
| 확장 | Chrome Extension Manifest V3, Side Panel API, Content Script, `chrome.storage.session`. 사이드 패널 UI는 React. 대상은 쿠팡 상품 페이지뿐이다 |
| 확장 빌드 | Vite. 확장 전용 플러그인 없이 진입점 3개(sidepanel HTML, content script, background)를 직접 설정한다. content script는 하나의 파일로 묶는다 |
| API | AWS Lambda (Node.js, TypeScript) + API Gateway |
| LLM | Amazon Bedrock. 판정·질문 해석·의미 조건 고르기는 경량 모델, 요약은 상위 모델. 모델 ID와 리전은 환경 변수(`BEDROCK_JUDGE_MODEL_ID`, `BEDROCK_SUMMARY_MODEL_ID`, `AWS_REGION`)로 정한다. 어떤 모델을 쓸지는 주영이 계정에서 확인해 정한다 |
| 인프라 | AWS CDK (`infra/`) |
| 테스트 | Vitest (코어 로직, 어댑터 파싱) + fast-check (속성 기반 테스트) |
| 검증 | zod (LLM 응답 JSON, API 요청 본문 검증) |

## 아키텍처 규칙
- 확장 프로그램은 Bedrock을 직접 호출하지 않는다. 항상 API Gateway를 거친다.
- 확장은 manifest의 `host_permissions`에 API 도메인과 `https://www.coupang.com/*`만 넣는다. 권한은 `sidePanel`, `storage`, `tabs`만 쓴다.
- 평점, 개수 계산은 `packages/core`의 순수 함수로 한다. LLM 응답의 숫자는 쓰지 않는다.
- `packages/core`는 브라우저, Node 양쪽에서 돌아야 한다. DOM, `fs`, 네트워크 의존 금지.
- API는 상태를 갖지 않는다. 판정 결과는 확장의 탭 메모리에 두고, 부분 세탁 때 확장이 세탁된 리뷰만 보낸다.

## 라이브러리 (15:10에 재현이 한 번에 설치)
| 위치 | 라이브러리 |
|---|---|
| 루트 (dev) | typescript, vitest, fast-check |
| `packages/core` | zod |
| `apps/api` | @aws-sdk/client-bedrock-runtime, zod |
| `apps/extension` | react, react-dom, vite, @vitejs/plugin-react, @types/chrome |
| `infra` | aws-cdk-lib, constructs, aws-cdk (dev) |

- 이 목록 밖의 라이브러리는 팀에 먼저 묻고, 설치는 재현이 한다 (`package-lock.json` 충돌 방지).

## 배포와 심사위원 사용
심사위원이 Releases의 zip을 설치해 배포된 API로 직접 쓴다. 그래서 배포본은 아래를 만족해야 한다.
- API 주소는 빌드할 때 환경 변수(`VITE_API_BASE_URL`)로 넣는다. 개발 중에는 주영의 로컬 서버(`http://localhost:8787`), Releases 빌드는 배포된 주소.
- API Gateway에서 CORS로 `chrome-extension://*` 출처의 `POST`를 허용한다. 확장 ID는 설치마다 달라서 출처를 하나로 고정할 수 없다.
- 요청 제한: API Gateway 기본 throttling(초당 5, 버스트 10), 같은 IP에서 너무 많이 오면 429. 심사위원 여러 명이 동시에 써도 되는 수준으로 둔다.
- 429, 5xx, 시간 초과일 때 사이드 패널은 "잠시 후 다시 시도해 주세요"와 다시 시도 버튼을 보여준다.
- 대회가 끝날 때까지 API를 켜 두고, 끝나면 끈다. 비용 알림은 AWS Budgets로 둔다.
- 배포 순서는 hackathon.md 일정. 배포는 마지막에 AWS 계정이 있는 사람이 한다.

## 상세 규칙 (작업 파일에 따라 자동 포함)
- 입고 규칙: `intake.md` (content script, 어댑터 작업 시)
- API 계약: `api-contract.md` (API, 코어, 확장의 API 호출·화면 작업 시)
- 테스트와 correctness property: `testing.md` (테스트 파일 작업 시)
- 얼룩 판정 기준: `stain-rules.md` (규칙, 프롬프트, 품질 검사 작업 시)

## 보안과 남용 방지
- AWS 자격 증명과 모델 설정은 Lambda 환경에만 둔다. 확장 코드, 커밋에 비밀 정보를 넣지 않는다.
- API는 키 없이 공개된다. 그래서 다음을 반드시 둔다: API Gateway 요청 제한(throttling), 위 입력 검증, AWS Budgets 비용 알림.
- 대회가 끝나면 API를 끄거나 요청 제한을 낮춘다.

## 명령어 (구현 후 갱신)
- 테스트: `npm test --workspaces` (Vitest는 `vitest --run`으로 단발 실행)
- 품질 검사: `scripts/eval` 실행
- 배포: `infra`에서 CDK 배포 (Supervised 모드로 실행)
