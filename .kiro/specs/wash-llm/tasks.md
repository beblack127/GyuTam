# Implementation Plan: wash-llm

## Overview

`apps/api`에 세탁 API를 만든다. Task 1은 재현의 PR 1(공통 타입, 코어 함수 시그니처)이 `main`에 합쳐진 뒤 시작한다 (16:19 합쳐짐). 코어 함수 본문이 아직 비어 있으면 그대로 import해서 쓴다 (시그니처는 바뀌지 않는다). 16:20 일정 재조정에 따라 Task 1~8은 17:15 통합 전에 끝내고, Task 10은 시간이 남으면 통합 직후, 17:25 기능 동결, Task 11은 동결 이후 배포 확인이다.

커밋 메시지에 task 번호를 쓴다: `feat(wash-llm): 5.2 washPipeline`, `test(wash-llm): 5.3 W1`.

## Tasks

- [x] 1. 준비와 Bedrock 연결 확인
  - [x] 1.1 `main` 받기와 `apps/api` 설정
    - 재현의 PR 1이 합쳐지면 `git pull --rebase origin main`
    - `apps/api/package.json`에 scripts만 추가: `dev`(`node --env-file=.env src/dev/localServer.ts`), `test`(`vitest --run --passWithNoTests`), `typecheck`(`tsc --noEmit -p .`). 의존성은 바꾸지 않는다
    - `apps/api/tsconfig.json`: base 상속, `lib: ["ES2022"]`, `types: ["node"]`. `@types/node`가 설치되어 있지 않으면 재현에게 요청한다
    - _Requirements: 10.2, design 열린 결정 5_
  - [x] 1.2 로컬 자격 증명 정하기
    - design 열린 결정 2의 (a) 또는 (b)를 정하고 `apps/api/.env`에 넣는다 (`AWS_REGION=ap-northeast-2`, 두 모델 ID `global.moonshotai.kimi-k3.1`)
    - `git status`로 `.env`가 추적되지 않는지 확인한다
    - _Requirements: 2.1, 10.3_
  - [x] 1.3 `dev/bedrockPing.ts`로 실제 응답 형태와 지연 확인
    - 가상 리뷰 2개로 `InvokeModel` 한 번 (`reasoning_effort: "none"`, `temperature: 0`)
    - 응답 본문의 최상위 키와 최종 텍스트 위치만 출력한다 (본문 전체는 출력하지 않음). 지연 ms, 입력·출력 토큰 수 출력
    - 결과로 design "bedrockClient.ts 응답 처리" 1번과 "확인된 사실" 표를 고친다. `temperature`나 `reasoning_effort`가 거부되면 design을 먼저 고친다
    - _Requirements: 2.2, 2.4_

- [ ] 2. LLM 클라이언트
  - [x] 2.1 `utils/deadline.ts`와 `services/wash/batches.ts`
    - `createDeadlines`(+20s, +5s, +17s, +26s), `signalUntil`, `chunk`, `runBatches`(allSettled, 남은 시간 1초 미만이면 호출 안 함)
    - _Requirements: 3.3, 3.4, 6.3, 11.1, 11.2_
  - [x] 2.2 `services/llm/llmSchemas.ts`
    - `judgeOutput`, `summaryOutput`, `interpretOutput`(+`lastDays`), `selectOutput` (design 표). 알 수 없는 키는 버린다
    - _Requirements: 2.4, 5.2_
  - [x] 2.3 `services/llm/bedrockClient.ts`
    - 모듈 수준 `BedrockRuntimeClient`(`maxAttempts: 1`), `invokeJson`, `extractJson`, 오류 종류 4개. 로그에 본문을 남기지 않는다
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [ ]* 2.4 `extractJson` 예시 테스트
    - 코드 펜스, 앞뒤 설명 텍스트, 중첩 중괄호, 문자열 안의 `}`, JSON 없음
    - _Requirements: 2.4, 2.5_

- [x] 3. 프롬프트 4개
  - [x] 3.1 `prompts/judgePrompt.ts`
    - design 프롬프트 표 + stain-rules.md 🟡 네 기준. 금지 단어를 쓰지 않는다
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - [x] 3.2 `prompts/summaryPrompt.ts` (`topic`, `withProsCons` 인자)
    - _Requirements: 8.1, 8.3, 8.4, 8.5_
  - [x] 3.3 `prompts/interpretPrompt.ts`
    - 계약 조건 표, `lastDays`, `unsupported`, `answerable`, `label`. 예시 질문: "사진 있는 리뷰만", "그중에 3점 이하이고 발열 얘기한 것만", "최근 한 달 리뷰 중에 발볼 넓은 사람 후기", "배송 언제 와?"
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 8.1, 8.5_
  - [x] 3.4 `prompts/selectPrompt.ts`
    - _Requirements: 6.3, 8.1, 8.3, 8.5_
  - [x] 3.5 `fairness-reviewer` 에이전트로 프롬프트 4개 검토
    - 지적 사항을 고친 뒤 커밋. 바뀐 점이 있으면 `docs/KIRO.md` 7장에 적는다
    - _Requirements: 8.6_

- [ ] 4. `Llm_Calls` 실제 구현
  - [x] 4.1 `services/llm/llmCalls.ts`
    - `createBedrockLlmCalls(env)`: 프롬프트 + `invokeJson`. `judge`는 `include: true`를 붙여 `WashTag[]`로, `interpret`는 `lastDays` → `date.from` 변환과 `label` 30자 자르기를 코드로 한다
    - _Requirements: 3.2, 5.1, 5.3, 5.4, 6.3_
  - [ ]* 4.2 `lastDays` 변환 예시 테스트
    - `today: "2026-11-14"`, `lastDays: 30` → `date.from: "2026-10-15"`. 월·연 경계
    - _Requirements: 5.3_

- [ ] 5. `POST /wash`
  - [x] 5.1 `utils/requestSchemas.ts`의 `washRequest`
    - Requirement 1.1 + 선택 필드 `tags`, `sources`, `partial` (design 열린 결정 1)
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 5.2 `services/wash/washPipeline.ts`의 `runWash`
    - design 의사코드 그대로. 숫자는 `buildReceipt`만, 근거는 `verifyCitations`만
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 5.3 W1, W3 속성 테스트 (`washPipeline.test.ts`)
    - **Property W1: 판정 태그는 입력과 1:1이고 evidence는 원문에 있다**
    - **Property W3: strict는 포함 집합을 줄이기만 한다**
    - 가짜 judge: 임의 id, 원문에 없는 evidence, `certain` 남발, 빈 배열, 예외
    - **Validates: Requirements 3.1, 3.4, 3.5, 3.6**
  - [ ]* 5.4 W2(`/wash`), W6 속성 테스트
    - **Property W2: 요약 근거는 허용 ID 안에 있다**
    - **Property W6: LLM이 모두 실패해도 /wash는 규칙 결과로 끝난다**
    - **Validates: Requirements 3.4, 4.3, 4.5**

- [ ] 6. `POST /ask`
  - [x] 6.1 `utils/requestSchemas.ts`의 `askRequest`
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 6.2 `services/wash/askPipeline.ts`의 `runAsk`와 `LlmUnavailable` 오류
    - design 의사코드 그대로. 1~3개면 `pros`, `cons`는 `[]` 고정
    - 결과 0개: `noMatch(it)`, `notice: "관련된 리뷰를 찾을 수 없습니다."`. 리뷰를 더 불러오지 않는다
    - _Requirements: 5.1, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 12.1, 12.2, 12.3_
  - [ ]* 6.3 W4, W5, W2(`/ask`) 속성 테스트 (`askPipeline.test.ts`)
    - **Property W4: 부분 세탁 결과는 입력 안에 있고 quote는 원문에 있다**
    - **Property W5: 부분 세탁 평균 별점은 코드가 계산한 값이다**
    - **Property W2: 요약 근거는 허용 ID 안에 있다 (/ask)**
    - 가짜 interpret: 임의 `Conditions`. 가짜 select: 임의 id, 원문에 없는 quote, 중복 id
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.6, 7.1, 7.2, 7.3, 7.5**

- [ ] 7. 핸들러
  - [x] 7.1 `utils/http.ts`
    - `HttpEvent`/`HttpResult`, 메서드 읽기(REST·Function URL), base64 해제, CORS(`chrome-extension://` 반사), `json(status, body, origin)`, 요청 한 줄 로그
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 2.6_
  - [x] 7.2 `handlers/washHandler.ts`, `handlers/askHandler.ts`
    - 시작 시각 → `createDeadlines` → 검증 → 파이프라인 → 상태 코드 표(200/400/405/503/500)
    - _Requirements: 1.3, 5.6, 6.5, 9.6, 11.1_
  - [ ]* 7.3 CORS·상태 코드 예시 테스트
    - `chrome-extension://abc` 반사, 다른 출처는 헤더 없음, OPTIONS 204, GET 405, 깨진 JSON 400
    - _Requirements: 1.3, 9.3, 9.4, 9.5_

- [ ] 8. 로컬 API 서버
  - [x] 8.1 `dev/localServer.ts`
    - `node:http` 8787, 라우팅, 1MB 413, 404, 필수 환경 변수 확인(이름만 출력)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ] 8.2 로컬 수동 확인
    - `npm run dev` 후 가상 리뷰 25개로 `/wash`(strict false/true, tags 재사용), `/ask`("사진 있는 리뷰만", "그중에 3점 이하이고 발열 얘기한 것만", "배송 언제 와?")를 호출해 응답 형태와 시간을 확인한다
    - 결과(시간, 이상한 응답)를 design "확인된 사실"에 적는다. 리뷰 본문은 적지 않는다
    - _Requirements: 3.5, 4.3, 5.5, 6.2, 11.3_

- [ ] 9. Checkpoint (17:15 통합)
  - Ensure all tests pass, ask the user if questions arise.
  - `npm run typecheck --workspace apps/api`, `npm test --workspace apps/api` 통과
  - 로컬 서버를 띄우고 규리·정민의 확장으로 실제 쿠팡 페이지 → `/wash` → 영수증까지 이어지는지 확인한다

- [ ] 10. 구현 2차 (16:45~17:15)
  - [ ] 10.1 시간 초과·partial 동작 확인
    - 가짜 시계와 끝나지 않는 가짜 LLM으로 마감 동작 확인
    - _Requirements: 3.4, 4.5, 6.5, 7.6, 11.2, 11.3_
  - [ ]* 10.2 W7 예시 테스트
    - **Property W7: 마감이 지나면 기다리지 않는다**
    - **Validates: Requirements 11.1, 11.2, 11.3**
  - [ ] 10.3 `history` 해석 확인
    - 두세 단계 질문("사진 있는 리뷰만" → "그중에 3점 이하만" → "아니 4점 이상으로")을 로컬 서버로 보내 `conditions`가 맞는지 본다. 틀리면 `tune-wash-prompt` skill로 `interpretPrompt`를 고친다
    - _Requirements: 5.1, 5.2_
  - [ ] 10.4 오류 응답 정리
    - 정민과 상태 코드·`error` 값을 맞춘다. 바뀌면 design 표를 먼저 고친다
    - _Requirements: 1.3, 5.6, 6.5, 9.6_

- [ ] 11. 배포 후 확인 (17:15~17:35)
  - [ ] 11.1 배포 담당에게 넘길 것 정리
    - 핸들러 경로 2개, 환경 변수 3개와 값, Lambda 제한 시간 29s, IAM(`bedrock:InvokeModel`: 글로벌 추론 프로필 ARN + 모델 ARN)
    - _Requirements: 2.1_
  - [ ] 11.2 배포된 주소로 `/wash`, `/ask` 확인
    - 8.2와 같은 요청으로 상태 코드와 시간 확인. CORS 헤더 확인
    - _Requirements: 9.3, 11.3_

- [ ] 12. Final checkpoint (17:15 기능 동결 전)
  - Ensure all tests pass, ask the user if questions arise.
  - `fairness-reviewer`로 최종 프롬프트 검토, tasks 체크박스가 실제 상태와 같은지 확인

## Notes

- `*`가 붙은 sub-task는 선택이다. 시간이 모자라면 W7, 예시 테스트부터 미루고 W1, W2, W4는 가능하면 남긴다.
- 코어 함수 본문이 아직 비어 있어도 파이프라인은 작성할 수 있다. 속성 테스트(5.3, 5.4, 6.3)는 재현의 해당 함수가 합쳐진 뒤에 의미가 있다.
- 프롬프트를 고칠 때는 `tune-wash-prompt` skill을 쓴다. 고친 뒤 `fairness-reviewer`로 검토한다.
- 계약을 바꿔야 하면(열린 결정 1, 3) design.md를 먼저 고치고, api-contract.md 수정은 재현에게 요청한다.
- 실제 리뷰 원문은 쓰지 않는다. 수동 확인도 가상 리뷰로 한다.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "5.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["1.3", "2.3", "3.5", "7.3"] },
    { "id": 3, "tasks": ["2.4", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "6.2"] },
    { "id": 5, "tasks": ["5.3", "5.4", "6.3", "7.2"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 9, "tasks": ["11.1", "11.2"] }
  ]
}
```
