# Requirements Document

## Introduction

wash-llm은 별점세탁소의 세탁 API(`apps/api`)를 만드는 spec이다. 담당은 주영이고 브랜치는 `feat/wash-llm`이다.

범위는 다음과 같다.

- Amazon Bedrock 호출 (모델 ID·리전은 환경 변수, 추론 끄기, 시간 제한, JSON 응답 검증)
- LLM 프롬프트 4개: 본세탁 판정, 요약, 질문 해석, 의미 조건 고르기
- `POST /wash` (기본·섬세 세탁)와 `POST /ask` (부분 세탁) 파이프라인과 Lambda 핸들러
- 요청 본문 검증 (zod)
- 통합용 로컬 API 서버 (`http://localhost:8787`)

범위 밖: 공통 타입과 코어 함수(wash-rules, 재현), CDK 배포(마지막에 AWS 계정 보유자), 확장 프로그램(규리, 정민).

일정 제약: 16:35 통합 1에서 확장 → 로컬 API → Bedrock이 끝까지 이어져야 한다. 17:15 기능 동결. 과한 추상화는 하지 않는다.

기준 문서: `.kiro/steering/api-contract.md`(계약, 코어 함수 표), `.kiro/steering/stain-rules.md`(의심 얼룩 기준), `.kiro/steering/fairness.md`(표현, 근거, 로그), `.kiro/steering/tech.md`(환경 변수, CORS, 요청 제한), `.kiro/steering/testing.md`(correctness property).

## Glossary

- **Wash_API**: `apps/api` 워크스페이스. Lambda 핸들러 2개와 로컬 서버를 가진다.
- **Wash_Handler** / **Ask_Handler**: `src/handlers/washHandler.ts`, `src/handlers/askHandler.ts`. Lambda 진입점.
- **Wash_Pipeline** / **Ask_Pipeline**: `src/services/wash/washPipeline.ts`, `askPipeline.ts`. 코어 함수와 LLM 호출을 순서대로 조립한다.
- **Llm_Client**: `src/services/llm/bedrockClient.ts`. Bedrock `InvokeModel`을 호출하고 JSON 응답을 검증한다.
- **Llm_Calls**: 판정, 요약, 질문 해석, 의미 조건 고르기 네 가지 LLM 호출을 묶은 인터페이스. 파이프라인은 이 인터페이스만 안다.
- **Judge_Prompt**, **Summary_Prompt**, **Interpret_Prompt**, **Select_Prompt**: `src/prompts/`의 프롬프트 4개.
- **Local_Server**: `src/dev/localServer.ts`. 같은 핸들러를 `http://localhost:8787`로 띄운다.
- **Batch**: LLM에 한 번에 보내는 리뷰 묶음. 최대 25개.
- **Deadline**: 요청 시작 시각 기준으로 정한 단계별 마감 시각.
- **Core**: `@star-laundry/core`. `detectCertainStains`, `verifyJudgments`, `applyStrict`, `buildReceipt`, `averageRating`, `verifyCitations`, `applyConditions`, `verifyMatches`를 제공한다.
- **Allowed_Ids**: 요약 근거로 허용되는 리뷰 ID. `/wash`는 `include: true` 리뷰, `/ask`는 `matches`의 리뷰.

## Requirements

### Requirement 1: 요청 본문 검증

**User Story:** As 사이드 패널 담당(정민), I want 잘못된 요청에 명확한 400 응답을 받기를, so that 화면에 원인을 보여줄 수 있다.

#### Acceptance Criteria

1. WHEN a `/wash` request arrives, THE Wash_Handler SHALL validate the body with zod: `site` is `"coupang"`, `strict` is boolean, `reviews` has 1~100 items, each `text` is at most 2,000 characters, each `rating` is an integer 1~5, each `date` is `YYYY-MM-DD`, optional `tags` items match the WashTag shape, optional `sources` is `{ best, latest, duplicates }` of non-negative integers, and optional `partial` is boolean.
2. WHEN an `/ask` request arrives, THE Ask_Handler SHALL validate the body with zod: `site` is `"coupang"`, `request` is 1~200 characters, `today` is `YYYY-MM-DD`, `history` has at most 5 strings, and `reviews` has 1~100 items with the same review rules as 1.1.
3. IF validation fails or the body is not valid JSON, THEN THE handler SHALL respond `400` with `{ "error": "invalid_request", "message": <짧은 이유> }` and SHALL NOT call Bedrock.
4. THE handlers SHALL ignore unknown fields, including `photos`, and SHALL NOT forward them to Bedrock.

### Requirement 2: Bedrock 호출

**User Story:** As 세탁 LLM 담당(주영), I want 한 곳에서 Bedrock을 호출하고 결과를 검증하기를, so that 모델을 바꾸거나 시간 제한을 걸 때 한 파일만 고친다.

#### Acceptance Criteria

1. THE Llm_Client SHALL read the model IDs from `BEDROCK_JUDGE_MODEL_ID` and `BEDROCK_SUMMARY_MODEL_ID` and the Region from `AWS_REGION`. THE Wash_API SHALL NOT hard-code model IDs, credentials, or API keys in source files.
2. THE Llm_Client SHALL call the Bedrock Runtime `InvokeModel` API with a system message, a user message, `max_tokens`, `temperature: 0`, and `reasoning_effort: "none"`.
3. THE Llm_Client SHALL accept an `AbortSignal` and SHALL abort the Bedrock request when the signal fires.
4. WHEN Bedrock returns, THE Llm_Client SHALL take the final answer text only (not the reasoning text), extract one JSON object from it, and validate it with the caller's zod schema.
5. IF the request fails, times out, or the JSON fails validation, THEN THE Llm_Client SHALL throw an error whose message contains only the error kind (`timeout`, `bedrock_error`, `invalid_json`, `schema_mismatch`), not the review text.
6. THE Wash_API SHALL NOT write review text, `evidence`, `quote`, or `request` to logs. Logs MAY contain route, counts, durations, and error kinds.

### Requirement 3: 본세탁 판정 (`/wash`)

**User Story:** As 쿠팡 사용자, I want 규칙이 놓친 대가성 리뷰와 의심 리뷰도 판정되기를, so that 세탁 후 평점이 더 정확해진다.

#### Acceptance Criteria

1. THE Wash_Pipeline SHALL run `detectCertainStains(reviews)` first and SHALL send to the LLM only the reviews whose rule tag is `stain: "none"`.
2. THE Wash_Pipeline SHALL send each review to the Judge_Prompt as `{ id, text }` only. Rating, date, option, and badges SHALL NOT be sent to the judge.
3. THE Wash_Pipeline SHALL split the LLM reviews into Batches of at most 25 and call them in parallel.
4. WHEN a Batch does not finish before the judge Deadline (request start + 20 s) or fails, THE Wash_Pipeline SHALL use the rule tags for that Batch's reviews and set `receipt.partial` to `true`.
5. THE Wash_Pipeline SHALL combine results with `verifyJudgments(reviews, ruleTags, llmTags)` and then `applyStrict(tags, strict)`, and SHALL return one tag per input review in input order.
6. WHEN the request contains `tags`, THE Wash_Pipeline SHALL skip the judge calls and use `applyStrict(verifyJudgments(reviews, ruleTags, request.tags), strict)`.

### Requirement 4: 영수증과 세탁 후 요약 (`/wash`)

**User Story:** As 쿠팡 사용자, I want 얼룩을 뺀 리뷰로만 만든 요약을 보기를, so that 대가성 리뷰에 휘둘리지 않고 판단할 수 있다.

#### Acceptance Criteria

1. THE Wash_Pipeline SHALL compute counts and ratings only with `buildReceipt(reviews, tags, sources, partial)` and SHALL NOT use any number from LLM output. `sources` SHALL be the request `sources` if present, otherwise counts of `source` values with `duplicates: 0`. `partial` SHALL be `true` if the request `partial` is `true` or any judge Batch fell back to rule tags.
2. THE Wash_Pipeline SHALL send to the Summary_Prompt only reviews whose tag has `include: true`, as `{ id, rating, text }`.
3. THE Wash_Pipeline SHALL pass `summary`, `pros`, and `cons` through `verifyCitations(cited, allowedIds)` where `allowedIds` are the `include: true` review IDs.
4. IF no review has `include: true`, THEN THE Wash_Pipeline SHALL skip the summary call and return `summary: []`, `pros: []`, `cons: []`.
5. IF the summary call fails or does not finish before the summary Deadline (request start + 26 s), THEN THE Wash_Pipeline SHALL return `summary: []`, `pros: []`, `cons: []` with the tags and counts unchanged and status `200`.

### Requirement 5: 질문 해석 (`/ask`)

**User Story:** As 쿠팡 사용자, I want 자유로운 문장으로 원하는 리뷰를 찾기를, so that 리뷰 수백 개를 스크롤하지 않아도 된다.

#### Acceptance Criteria

1. THE Ask_Pipeline SHALL send `request`, `history`, and `today` to the Interpret_Prompt and receive `conditions`, `label`, `unsupported`, and `answerable`. Review text SHALL NOT be sent to the interpreter.
2. THE Ask_Pipeline SHALL validate the interpreted `conditions` with zod: `rating.min`/`rating.max` integers 1~5, `date.from`/`date.to` in `YYYY-MM-DD`, `source` in `best | latest`, string arrays for `option`, `includes`, `excludes`, and `semantic` as string or `null`.
3. WHEN the interpreter returns a relative period as a day count, THE Ask_Pipeline SHALL convert it to `date.from` in code using `today`, not by the LLM.
4. THE Ask_Pipeline SHALL return `label` of at most 30 characters for the condition chip.
5. WHEN the interpreter returns `answerable: false`, THE Ask_Pipeline SHALL return `matches: []`, `matched: 0`, `rating: { average: null, count: 0 }`, empty `summary`/`pros`/`cons`, and an `unsupported` message saying the question cannot be answered from reviews.
6. IF the interpreter call fails or exceeds its Deadline (request start + 5 s), THEN THE Ask_Handler SHALL respond `503` with `{ "error": "llm_unavailable" }`.

### Requirement 6: 조건 필터와 의미 조건 고르기 (`/ask`)

**User Story:** As 쿠팡 사용자, I want "3점 이하" 같은 조건이 정확히 적용되기를, so that 결과를 믿을 수 있다.

#### Acceptance Criteria

1. THE Ask_Pipeline SHALL apply fixed conditions only with `applyConditions(reviews, conditions)`.
2. WHEN `conditions.semantic` is `null` or empty, THE Ask_Pipeline SHALL return every filtered review as a match with `quote: null` and SHALL NOT call the Select_Prompt.
3. WHEN `conditions.semantic` is set, THE Ask_Pipeline SHALL send the filtered reviews to the Select_Prompt as `{ id, text }` in Batches of at most 25 in parallel, and each selected item SHALL carry a `quote` copied from the review text.
4. THE Ask_Pipeline SHALL pass the selected items through `verifyMatches(filteredReviews, matches)` and keep the input review order.
5. IF any select Batch fails or does not finish before the select Deadline (request start + 17 s), THEN THE Ask_Handler SHALL respond `503` with `{ "error": "llm_unavailable" }`, so that an incomplete list is never shown as a complete result.
6. THE Ask_Pipeline SHALL return `matched` equal to `matches.length`.

### Requirement 7: 부분 세탁 평균 별점과 요약 (`/ask`)

**User Story:** As 쿠팡 사용자, I want 좁힌 리뷰의 평균 별점과 요약을 보기를, so that 그 조건의 평가를 한눈에 안다.

#### Acceptance Criteria

1. THE Ask_Pipeline SHALL compute `rating.average` with `averageRating` over the matched reviews and set `rating.count` to `matched`.
2. WHEN `matched` is 0, THE Ask_Pipeline SHALL skip the summary call and return empty `summary`, `pros`, and `cons`.
3. WHEN `matched` is 1~3, THE Ask_Pipeline SHALL request only `summary` and return `pros: []`, `cons: []`.
4. WHEN `matched` is 4 or more, THE Ask_Pipeline SHALL request `summary`, `pros`, and `cons`, with `conditions.semantic` (if any) as the summary topic.
5. THE Ask_Pipeline SHALL pass `summary`, `pros`, and `cons` through `verifyCitations` with `allowedIds` equal to the `matches` IDs.
6. IF the summary call fails or does not finish before the summary Deadline (request start + 26 s), THEN THE Ask_Pipeline SHALL return the matches and rating with empty `summary`, `pros`, and `cons` and status `200`.

### Requirement 8: 프롬프트 공정성

**User Story:** As 팀, I want 프롬프트가 fairness.md를 지키기를, so that 단정 표현이나 지어낸 내용이 화면에 나오지 않는다.

#### Acceptance Criteria

1. THE prompts SHALL live in `apps/api/src/prompts/` as exported string constants or builder functions, not inline in handlers or pipelines.
2. THE Judge_Prompt SHALL state the stain-rules.md 🟡 criteria (경험 없는 칭찬, 홍보 문구 반복, 외부 유도, 판매자 말투), SHALL allow `certain` only when a 대가성 sentence is in the review text, SHALL tell the model not to judge by rating alone, and SHALL tell the model to choose `none` when unsure.
3. THE Judge_Prompt, Select_Prompt, and Summary_Prompt SHALL require `evidence` and `quote` to be copied from the review text without changes.
4. THE Summary_Prompt SHALL forbid facts not stated in the given reviews (스펙, 가격, 비교 상품) and SHALL require at least one review ID per sentence.
5. THE prompts SHALL NOT contain the words "가짜", "조작", or "사기".
6. WHEN a prompt changes, THE author SHALL run the `fairness-reviewer` agent on it before the PR.

### Requirement 9: Lambda 핸들러와 HTTP 응답

**User Story:** As 사이드 패널 담당(정민), I want API Gateway와 로컬 서버에서 같은 응답을 받기를, so that 개발 중과 배포 후에 코드를 바꾸지 않는다.

#### Acceptance Criteria

1. THE handlers SHALL accept both the API Gateway REST proxy event (`httpMethod`) and the Lambda Function URL event (`requestContext.http.method`).
2. THE handlers SHALL respond with JSON and `Content-Type: application/json`.
3. WHEN the `Origin` header starts with `chrome-extension://`, THE handlers SHALL echo it in `Access-Control-Allow-Origin` and allow `POST`, `OPTIONS` and header `Content-Type`.
4. WHEN the method is `OPTIONS`, THE handlers SHALL respond `204` with the CORS headers.
5. WHEN the method is not `POST` or `OPTIONS`, THE handlers SHALL respond `405`.
6. IF an unexpected error occurs, THEN THE handlers SHALL respond `500` with `{ "error": "internal" }` and SHALL log only the error kind.

### Requirement 10: 통합용 로컬 API 서버

**User Story:** As 입고·사이드 패널 담당(규리, 정민), I want 배포 전에도 실제 API에 연결하기를, so that 16:35 통합에서 처음부터 끝까지 확인할 수 있다.

#### Acceptance Criteria

1. THE Local_Server SHALL listen on `http://localhost:8787` and route `POST /wash` and `POST /ask` to the same handler functions used by Lambda.
2. THE Local_Server SHALL use only Node.js built-in modules and SHALL start with one npm script in `apps/api`.
3. THE Local_Server SHALL read configuration from `apps/api/.env`, which is ignored by git, and SHALL fail at start with a clear message if a required variable is missing.
4. WHEN the request body exceeds 1 MB, THE Local_Server SHALL respond `413`. WHEN the path is unknown, it SHALL respond `404`.

### Requirement 11: 시간 예산

**User Story:** As 쿠팡 사용자, I want 세탁이 API Gateway 제한(29초) 안에 끝나기를, so that 시간 초과 오류를 보지 않는다.

#### Acceptance Criteria

1. THE Wash_Pipeline and Ask_Pipeline SHALL compute every Deadline from one start time taken when the handler begins.
2. THE pipelines SHALL abort pending LLM calls when their Deadline passes.
3. THE `/wash` and `/ask` responses SHALL be sent within 27 s of the handler start under any LLM behavior (slow, failing, or invalid output).
