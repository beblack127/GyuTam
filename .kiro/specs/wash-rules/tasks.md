# Implementation Plan: wash-rules

## Overview

`@star-laundry/core`를 TypeScript로 만든다. Task 1(15:25 PR)에서 최종 경로·시그니처·`index.ts`를 빈 구현으로 먼저 `main`에 합치고, Task 2~8에서 함수 본문과 속성 테스트를 채운다. 시그니처는 Task 1 이후 바꾸지 않는다. Task 2~8은 16:35 통합 전에 끝내고, Task 10(바탕 전환)은 정민의 방식 전환 작업이 시작되는 16:45 전에 합친다. Task 11~13은 16:45~17:15 구현 2차에 한다. 17:15 기능 동결.

커밋 메시지에 task 번호를 쓴다: `feat(wash-rules): 6.2 영수증 계산`, `test(wash-rules): 6.6 P10`.

## Tasks

- [ ] 1. 워크스페이스, 공통 타입, 빈 구현 (15:25 PR, 가장 먼저 `main`에 합침)
  - [x] 1.1 라이브러리 일괄 설치와 TS 설정
    - tech.md 라이브러리 표 그대로 한 번에 설치: 루트 dev `typescript`, `vitest`, `fast-check` / `packages/core` `zod` / `apps/api` `@aws-sdk/client-bedrock-runtime`, `zod` / `apps/extension` `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/chrome` / `infra` `aws-cdk-lib`, `constructs`, dev `aws-cdk`
    - 루트 `tsconfig.base.json` (design "설정 파일"의 compilerOptions 그대로)
    - `packages/core/package.json` (`@star-laundry/core`, `exports`·`main`·`types` → `./src/index.ts`, `test: vitest --run --passWithNoTests`, `typecheck: tsc --noEmit -p .`, `build` 없음)
    - `packages/core/tsconfig.json` (`lib: ["ES2022"]`, `types: []`, 테스트 파일과 `testArbitraries.ts` 제외)
    - `apps/api`, `apps/extension`, `infra`에 base만 상속하는 최소 `tsconfig.json`과 의존성만 있는 `package.json`. `apps/api`, `apps/extension`은 `"@star-laundry/core": "*"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 1.2 공통 타입 4개 파일
    - `src/types/review.ts` (`Site`, `Source`, `Review`), `wash.ts` (`Stain`, `Signal`, `WashTag`, `Cited`, `Receipt`, `ReceiptCounts`), `ask.ts` (`Conditions`, `Match`, `Step`), `messages.ts` (Intake 메시지 4종, `IntakeMessage` 유니온, `IntakeDoneReason`, `IntakeErrorReason`)
    - api-contract.md 정의를 글자 그대로 옮긴다. `enum` 없이 리터럴 유니온만 쓴다
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 1.3 `stainKeywords.ts`, 함수 15개 빈 구현, `index.ts`
    - `rules/stainKeywords.ts`에 Requirement 6의 초기값 (`PLATFORM_BADGE_TERM`, `PLATFORM_NOTICE`, `DISCLOSURE_PHRASES`, `REVIEW_EVENT_PHRASES`, `NEGATIONS`, `NEGATION_WINDOW = 15`)
    - design 파일 구조대로 함수 파일 생성(공개 함수 15개). design 표의 "PR 1 임시 구현" 값을 반환하고 첫 줄에 `// TODO(wash-rules task N)`. 안 쓰는 매개변수는 `_` 접두사
    - 바탕 전환 두 함수의 빈 구현: `filter/narrowSteps.ts`는 `steps.slice()`, `filter/mergeIntoStep.ts`는 `{ ...step }` (바탕을 바꿔도 단계가 그대로 남는 상태)
    - 내부 파일 `filter/stepRating.ts`도 만든다 (빈 구현 `{ average: null, count: 0 }`). `index.ts`에서 내보내지 않는다
    - `filter/steps.ts`에 `MAX_STEPS = 5` 포함
    - `src/index.ts`에서 타입 전부와 함수 15개(`narrowSteps`, `mergeIntoStep` 포함), `MAX_STEPS` export (`export type` / `.ts` 확장자 import)
    - 확인: `npm run typecheck --workspace packages/core` 0 에러, `npm test --workspace packages/core` 통과(테스트 없음)
    - _Requirements: 2.6, 3.1, 3.2, 3.3, 4.4, 6.12_

- [x] 2. 텍스트 정규화, 원문 포함 확인, 테스트 생성기
  - [x] 2.1 `utils/normalizeText.ts`와 `containsQuote` 구현
    - `normalizeForQuote`, `normalizeLoose`, `compact` (design "텍스트 정규화" 표). NFC 변환 안 함
    - `containsQuote`: 정규화 후 빈 `quote`면 `false`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 2.2 `utils/testArbitraries.ts` 작성
    - `arbReview`(ID 풀 `cp-0`~`cp-19`), `arbUniqueReviews`, `arbWashTagFor`, `arbConditions`, `arbStep`, `arbSteps`(0~5), `codePointSlice`, `deepFreeze`
    - 키워드·부정 문구는 `stainKeywords.ts`에서 읽는다. `index.ts`에서 내보내지 않는다
    - _Requirements: 16.4_
  - [ ]* 2.3 `containsQuote` 예시 테스트와 S5 속성 테스트
    - **Property 20: (S5) 원문 포함 확인은 정규화 포함 모델과 같다**
    - 예시: 줄바꿈·문장부호 차이, 빈 `quote`, 이모지
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 3. 입고 중복 제거 (규리가 15:35부터 사용)
  - [x] 3.1 `dedupeReviews` 구현
    - best 우선, 첫 등장 순서, `source` 덮어쓰기, `sources.duplicates = best.length + latest.length - reviews.length`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 3.2 P1 속성 테스트 (`dedupeReviews.test.ts`)
    - **Property 1: (P1) 입고 중복 제거는 멱등이다**
    - 예시: `best`·`latest` 겹침 1건
    - **Validates: Requirements 5.1, 5.6**
  - [ ]* 3.3 S2 속성 테스트
    - **Property 17: (S2) 중복 제거는 best 우선 합집합 모델과 같다**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 4. 애벌빨래 규칙 탐지 (주영의 `/wash`가 사용)
  - [x] 4.1 `__fixtures__/powerbank.json` 작성
    - AI로 만든 가상 보조배터리 리뷰 약 12개: 배지, 고지 문장, 대가성 문구, 리뷰 이벤트, "제공 받아", "제공받은 거 아니고 내돈내산입니다", "체험단 아닙니다", 의심 기준 예시, 사진·옵션 유무
    - 실존 업체·인물·실제 리뷰 문장 금지
    - _Requirements: 16.4, 16.5_
  - [x] 4.2 부정 표현 "아닙" 추가와 문서 갱신
    - `stainKeywords.ts`의 `NEGATIONS`에 "아닙" 추가
    - 같은 task에서 `.kiro/steering/stain-rules.md` 부정 표현 목록(18행)과 `.kiro/specs/wash-rules/requirements.md` 6.7의 목록에 "아닙" 추가
    - _Requirements: 6.7, 6.12_
  - [x] 4.3 `detectCertainStains` 구현
    - 내부 `findPhrase`(공백 제거 + `indexMap`), 부정 창(원문 기준 앞뒤 15자), `sentenceAround`(경계 `.`, `!`, `?`, `。`, `…`, 줄바꿈)
    - 우선순위 배지 → 고지 문장 → `disclosure` → `review_event`. `certain`이면 `include: false`, 없으면 `none / null / null / true`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_
  - [x] 4.4 규칙 탐지 예시 테스트 (`detectCertainStains.test.ts`)
    - fixture로 신호별 1건, "제공 받아", 고지 문장 → `platform_badge` + 문장, "제공받은 거 아니고 내돈내산입니다" → `none`, "체험단 아닙니다" → `none`
    - _Requirements: 16.3_
  - [ ]* 4.5 S4 속성 테스트
    - **Property 19: (S4) 규칙 문구 탐지는 띄어쓰기에 무관하고 부정과 우선순위를 따른다**
    - 생성기는 `stainKeywords.ts` 상수에서 문구를 읽는다
    - **Validates: Requirements 6.2, 6.4, 6.5, 6.6, 6.7, 6.8, 17.2**

- [x] 5. 판정 검수와 섬세 세탁
  - [x] 5.1 `verifyJudgments` 구현
    - design 의사코드 그대로: 규칙 `certain` 우선, LLM `certain`은 `disclosure`·`review_event` + 원문 확인일 때만 유지, 실패 시 한 단계 낮추고 `evidence: null`, `normalized()`로 형태 정리
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12_
  - [x] 5.2 P6 속성 테스트 (`verifyJudgments.test.ts`)
    - **Property 6: (P6) evidence가 null이 아니면 항상 원문에 들어 있다**
    - `detectCertainStains` 결과와 `verifyJudgments` 결과 둘 다 검사
    - 예시: LLM `certain` + 원문 문장 → 유지
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.11, 8.12**
  - [x] 5.3 P7 속성 테스트
    - **Property 7: (P7) 원문에 없는 evidence를 댄 LLM 판정은 한 단계 낮아진다**
    - **Validates: Requirements 8.5, 8.6, 8.7**
  - [ ]* 5.4 S6 속성 테스트
    - **Property 21: (S6) 판정 검수는 규칙 우선이고 LLM은 platform_badge를 낼 수 없다**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.8**
  - [x] 5.5 `applyStrict` 구현
    - `include = stain === 'none' || (stain === 'suspected' && !strict)`, 다른 필드 유지
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [x] 5.6 P3 속성 테스트 (`applyStrict.test.ts`)
    - **Property 3: (P3) strict는 포함 집합을 줄이기만 한다**
    - **Validates: Requirements 9.6**
  - [ ]* 5.7 S3 속성 테스트
    - **Property 18: (S3) 판정 태그는 형태 불변식을 지킨다**
    - `detectCertainStains`, `verifyJudgments`, `applyStrict` 결과의 길이·순서·`id`와 WashTag 불변식
    - **Validates: Requirements 6.1, 6.9, 6.10, 8.1, 8.9, 8.10, 8.11, 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 6. 평점과 영수증
  - [x] 6.1 `averageRating` 구현
    - 빈 배열 `null`, `Math.round((sum * 10) / n) / 10`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 6.2 `buildReceipt` 구현
    - 첫 등장 기준 `tagById`, 태그 없음 = `none / include true`, `stain ≠ none`인데 `signal: null`이면 `suspected`로 집계, `stains` 네 키 항상 존재
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_
  - [x] 6.3 P2 속성 테스트 (`buildReceipt.test.ts`)
    - **Property 2: (P2) basedOn은 중복 제거 후 리뷰 수와 같다**
    - 예시: api-contract.md 응답 예시 형태 1건
    - **Validates: Requirements 5.5, 11.1**
  - [x] 6.4 P4 속성 테스트 (`averageRating.test.ts`, `buildReceipt.test.ts`)
    - **Property 4: (P4) after는 포함 리뷰 평균의 반올림이고 1.0~5.0 사이다**
    - 오라클 `Math.floor((20 * sum + n) / (2 * n)) / 10`. 예시: `[4, 5]` → 4.5, `[4, 4, 5]` → 4.3
    - **Validates: Requirements 10.1, 10.2, 11.4**
  - [-] 6.5 P5 속성 테스트 (`averageRating.test.ts`, `buildReceipt.test.ts`)
    - **Property 5: (P5) 포함 리뷰가 없을 때만 after가 null이다**
    - 예시: `[]` → `null`
    - **Validates: Requirements 10.3, 10.4, 11.4**
  - [ ] 6.6 P10 속성 테스트 (`buildReceipt.test.ts`)
    - **Property 10: (P10) stains 합은 얼룩 리뷰 수, removed는 제외 리뷰 수다**
    - **Validates: Requirements 11.6, 11.7**
  - [ ]* 6.7 S8 속성 테스트
    - **Property 23: (S8) 영수증은 리뷰와 태그의 직접 집계와 같다**
    - **Validates: Requirements 11.2, 11.3, 11.5, 11.8, 11.9**

- [x] 7. 요약 근거 검증
  - [x] 7.1 `verifyCitations` 구현
    - 빈 `text` 제거, 허용 ID만 남기고 첫 등장 순서로 중복 제거, 빈 근거 제거, `text` 그대로
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [x] 7.2 P8 속성 테스트 (`verifyCitations.test.ts`)
    - **Property 8: (P8) 요약 근거 ID는 비어 있지 않은 허용 ID 부분집합이다**
    - `/wash` 조합(`applyStrict`의 `include: true` ID)과 `/ask` 조합(`verifyMatches` 결과 ID) 포함
    - **Validates: Requirements 12.1, 12.3, 12.6**

- [ ] 8. 부분 세탁: 조건 필터, 결과 검수, 단계 스택 (16:35 통합 전에 합침)
  - [x] 8.1 `applyConditions` 구현
    - 필드별 술어 (design 표), `option`·`includes`·`excludes`는 `normalizeLoose`, 정규화 후 빈 항목 무시, `semantic` 무시
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11_
  - [x] 8.2 P11 속성 테스트 (`applyConditions.test.ts`)
    - **Property 11: (P11) 정해진 조건 필터는 정확하다**
    - 오라클 술어는 `applyConditions.ts`를 import하지 않고 테스트 안에 따로 쓴다. 예시: fixture로 "사진 있음", "3점 이하"
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12**
  - [x] 8.3 P12 속성 테스트
    - **Property 12: (P12) 정해진 조건 필터는 멱등이고 순서와 무관하다**
    - **Validates: Requirements 13.13, 13.14**
  - [x] 8.4 `verifyMatches` 구현
    - 첫 등장 기준 `byId`, 원문 밖 `quote` 제거, `quote: null` 유지, `seen`은 통과 항목만 기록
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
  - [x] 8.5 P9 속성 테스트 (`verifyMatches.test.ts`)
    - **Property 9: (P9) /ask의 quote는 항상 원문에 들어 있다**
    - **Validates: Requirements 14.2, 14.6**
  - [x] 8.6 P13 속성 테스트
    - **Property 13: (P13) /ask 결과는 입력의 부분집합이고 단계를 쌓을수록 줄거나 같다**
    - **Validates: Requirements 14.7, 14.8**
  - [-] 8.7 P15 속성 테스트
    - **Property 15: (P15) /ask의 rating은 matches 평균이고 count는 matched와 같다**
    - `verifyMatches` + `averageRating` 조합 그대로 검증 (별도 함수 없음)
    - **Validates: Requirements 10.5**
  - [ ]* 8.8 S7 속성 테스트 (`verifyCitations.test.ts`, `verifyMatches.test.ts`)
    - **Property 22: (S7) 근거 검증과 매치 검수는 순서를 지키는 필터 모델과 같다**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 14.1, 14.2, 14.3, 14.4, 14.5**
  - [x] 8.9 단계 스택 구현 (`filter/steps.ts`)
    - `pushStep`: 빈 `ids` 또는 5개면 `steps.slice()`, 아니면 `[...steps, step]`. `popStep`: `steps.slice(0, -1)`. `resetSteps`: `[]`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  - [x] 8.10 P14 속성 테스트 (`steps.test.ts`)
    - **Property 14: (P14) popStep(pushStep(s, x))는 s와 같다**
    - 예시: 6번째 push 거절
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7**

- [ ] 9. Checkpoint (16:35 통합 전)
  - Ensure all tests pass, ask the user if questions arise.
  - `npm run typecheck --workspace packages/core`와 `npm test --workspace packages/core`가 한 번에 통과해야 한다 (Requirement 16.6)

- [ ] 10. 부분 세탁 바탕 전환: 단계 평균, 바탕 좁히기·넓히기 (16:45 전에 합침, 정민의 방식 전환이 사용)
  - `averageRating`(6.1)과 `verifyCitations`(7.1)에 기대므로 Task 6, 7 뒤에 한다
  - 시간이 모자라면 이 task를 통째로 미루고 Task 1.3의 빈 구현(`narrowSteps` → `steps.slice()`, `mergeIntoStep` → `{ ...step }`)을 그대로 남긴다. 화면은 "바탕을 바꿔도 단계는 그대로"로 동작한다. 이때도 10.4, 10.5(P16, P17)는 제출 체크리스트 항목이므로 체크하지 않고 미완료로 남겨 실제 상태와 맞춘다
  - [-] 10.1 `filter/stepRating.ts` 구현 (내부, `index.ts`에서 내보내지 않음)
    - `reviews`의 첫 등장 기준 `byId`, `ids` 중 `reviews`에 있는 리뷰만 `averageRating`, `count = ids.length`, 빈 `ids` → `{ average: null, count: 0 }`
    - _Requirements: 19.2, 19.10, 20.3_
  - [ ] 10.2 `filter/narrowSteps.ts` 구현
    - 단계마다 `ids`를 `allowedIds`로 입력 순서대로 거르고, 비면 그 단계와 뒤 단계를 잘라낸다
    - `rating: stepRating(ids, reviews)`, `summary`·`pros`·`cons`는 `verifyCitations(필드, ids)`, `request`·`label`·`conditions`는 그대로(같은 참조)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_
  - [ ] 10.3 `filter/mergeIntoStep.ts` 구현
    - `[...step.ids, ...addedIds]`에서 첫 등장만 남기고 `rating: stepRating(ids, reviews)`, 나머지 필드는 입력과 같다
    - _Requirements: 20.1, 20.4, 20.5_
  - [ ] 10.4 P16 속성 테스트 (`narrowSteps.test.ts`)
    - **Property 24: (P16) 바탕 좁히기는 허용 ID로 단계를 줄이고 평균을 다시 계산한다**
    - `testArbitraries.ts`에 `arbNestedSteps`(직전 단계 `ids`의 `fc.subarray`), `arbIdSubset`(빈 배열·풀 전체 포함) 추가. `reviews`에 같은 ID 중복이 나오게 `arbReview`의 작은 ID 풀을 쓴다
    - 오라클은 `stepRating.ts`를 import하지 않고 테스트 안의 첫 등장 `byId` + `averageRating`, `verifyCitations`로 만든다
    - 예시: 2단계 중 둘째 단계가 비면 첫 단계만 남음, 근거 ID가 모두 빠진 요약 문장 삭제, 빈 `steps` → `[]`
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10**
  - [ ] 10.5 P17 속성 테스트 (`mergeIntoStep.test.ts`)
    - **Property 25: (P17) 바탕 넓히기는 합집합을 만들고 평균을 다시 계산한다**
    - 오라클은 10.4와 같은 방식 (`stepRating.ts` import 안 함)
    - 예시: 이미 있는 ID를 더하면 중복 없음, 빈 `addedIds`면 `ids` 그대로·`rating` 재계산
    - **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5**

- [ ] 11. 체험단 문구 교체 (intake.md "쿠팡 페이지 확인 결과"가 채워진 뒤)
  - [-] 11.1 `stainKeywords.ts` 상수와 관련 예시 테스트만 교체
    - intake.md에 기록된 실제 배지 문구·고지 문장으로 `PLATFORM_BADGE_TERM`, `PLATFORM_NOTICE`를 바꾸고, `detectCertainStains.test.ts`와 `__fixtures__/powerbank.json`의 해당 예시만 맞춘다. `detectCertainStains.ts` 로직은 건드리지 않는다
    - 확인 결과가 초기값과 같으면 바꾸지 않고 체크만 한다
    - _Requirements: 17.1, 17.2_

- [ ] 12. 공개 경계 보조 검사 (16:45 이후)
  - [ ]* 12.1 `index.test.ts`: export 확인과 S1 속성 테스트
    - 예시: `index.ts`가 함수 15개와 `MAX_STEPS`를 내보내는지
    - **Property 16: (S1) 모든 공개 함수는 입력을 바꾸지 않고 결정적이다** (`deepFreeze` 입력, `structuredClone` 두 번 호출 비교, `numRuns: 50` 허용)
    - **Validates: Requirements 4.2, 4.3**

- [ ] 13. 세탁 품질 검사 최소 버전 (선택, 16:45 이후)
  - [ ]* 13.1 `scripts/eval/evalRules.ts` 작성
    - `scripts/eval/data/labeled-reviews.json`만 읽고, 없거나 비면 경로를 출력하고 `process.exit(1)`
    - `detectCertainStains`로 `certain` TP/FP/FN, 정밀도, 재현율 출력 (분모 0이면 `N/A`). 리뷰 본문과 ID는 출력하지 않는다
    - 실행: `node --experimental-strip-types scripts/eval/evalRules.ts`
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [ ] 14. Final checkpoint (17:15 기능 동결 전)
  - Ensure all tests pass, ask the user if questions arise.
  - tasks 체크박스가 실제 상태와 같은지 확인한다

## Notes

- `*`가 붙은 sub-task는 선택이다. 시간이 모자라면 S1~S8과 `scripts/eval`부터 미룬다. P1~P17 속성 테스트와 규칙 탐지 예시 테스트(4.4)는 제출 체크리스트 항목이라 `*`를 붙이지 않았다.
- 예시 테스트는 같은 테스트 파일의 속성 sub-task에 함께 넣었다 (따로 task를 만들지 않음).
- 2~8은 30분 규칙에 따라 끝나는 대로 작은 PR로 합친다. 순서 권장: 2 → 3 → 4 → 5 → 6 → 7 → 8 → 10. 3(규리)과 4·5·6(주영)이 소비자가 먼저 기다리는 함수다. 10(정민의 방식 전환)은 16:45 전에 합친다.
- hackathon.md의 자르는 순서에서 "기본 바탕 전환"은 앞쪽에 있다. 시간이 모자라면 Task 10을 미루고 Task 1.3의 빈 구현을 남긴다. 10.4, 10.5는 체크하지 않은 채로 둔다 (design "구현 순서").
- `packages/core`의 zod는 이 spec에서 쓰지 않는다. 마감까지 wash-llm이 코어에 스키마를 두지 않으면 core 의존성에서 뺀다 (design "열린 결정").
- 시그니처를 바꿔야 하면 api-contract.md와 타입을 같은 커밋에서 고치고 design.md를 먼저 갱신한다.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1", "2.2", "3.1", "4.1", "4.2", "5.5", "6.1", "7.1", "8.9"] },
    { "id": 4, "tasks": ["2.3", "3.2", "4.3", "5.1", "5.6", "6.2", "8.1", "8.4", "8.10"] },
    { "id": 5, "tasks": ["3.3", "4.4", "5.2", "5.7", "6.3", "7.2", "8.2", "8.5"] },
    { "id": 6, "tasks": ["4.5", "5.3", "6.4", "8.3", "8.6"] },
    { "id": 7, "tasks": ["5.4", "6.5", "8.7", "10.1", "11.1"] },
    { "id": 8, "tasks": ["6.6", "8.8", "10.2", "10.3", "13.1"] },
    { "id": 9, "tasks": ["6.7", "10.4"] },
    { "id": 10, "tasks": ["10.5", "12.1"] }
  ]
}
```
