# Requirements Document

## Introduction

wash-rules는 별점세탁소의 공통 코어 패키지 `@star-laundry/core`(`packages/core`)를 만드는 spec이다. 담당은 재현이고 브랜치는 `feat/wash-rules`다.

이 패키지는 확장(`apps/extension`)과 세탁 API(`apps/api`)가 함께 쓰는 공통 타입과 순수 함수를 제공한다. 범위는 다음과 같다.

- 워크스페이스 설치와 패키지 설정 (빌드 없이 TS 소스를 바로 사용)
- 공통 타입 (`review.ts`, `wash.ts`, `ask.ts`, `messages.ts`)
- 코어 함수 11개: 입고 중복 제거, 애벌빨래(규칙 기반 확실한 얼룩 탐지), 판정 검수, 섬세 세탁 적용, 평점 계산, 영수증 계산, 요약 근거 검증, 정해진 조건 필터, 부분 세탁 결과 검수, 원문 포함 확인, 단계 스택
- correctness property P1~P15 중 코어에 해당하는 속성의 fast-check 테스트
- (선택) `scripts/eval` 최소 버전

일정 제약: 공통 타입과 코어 함수 시그니처(빈 구현)는 15:25 PR로 가장 먼저 `main`에 합친다. 16:35 통합, 17:15 기능 동결. 과한 추상화는 하지 않는다.

기준 문서: `.kiro/steering/api-contract.md`(코어 함수 표, 타입), `.kiro/steering/stain-rules.md`(규칙), `.kiro/steering/testing.md`(P1~P15), `.kiro/steering/fairness.md`(판정·요약 근거), `.kiro/steering/intake.md`(메시지 형식).

## Glossary

- **Core_Package**: npm 워크스페이스 패키지 `@star-laundry/core` (`packages/core`). `src/index.ts`에서 공개 타입과 함수를 내보낸다.
- **Workspace_Setup**: 루트 `package.json`, 각 워크스페이스의 `package.json`, `tsconfig` 파일과 설치된 라이브러리 묶음.
- **Review**: 입고한 리뷰 한 개. 필드는 `id`, `rating`(1~5 정수), `date`(YYYY-MM-DD), `text`, `badges`, `hasPhoto`, `photos?`, `option`, `source`.
- **WashTag**: 리뷰 한 개의 판정 결과. 필드는 `id`, `stain`(`none` | `certain` | `suspected`), `signal`(`platform_badge` | `disclosure` | `review_event` | `suspected` | `null`), `evidence`(문자열 | `null`), `include`(불리언).
- **Cited**: 근거 리뷰 ID가 달린 요약 문장. 필드는 `text`, `reviewIds`.
- **Receipt**: 세탁 영수증. 필드는 `basedOn`, `sources`, `before`, `after`, `stains`, `removed`, `partial`, `summary`, `pros`, `cons`.
- **Sources**: 입고 범위 통계 `{ best, latest, duplicates }`.
- **Conditions**: 부분 세탁 조건. 정해진 조건(`rating`, `date`, `hasPhoto`, `source`, `option`, `includes`, `excludes`)과 의미 조건(`semantic`).
- **Match**: 부분 세탁 결과 항목 `{ id, quote }`.
- **Step**: 단계 스택의 한 단계 `{ request, label, conditions, ids, rating, summary, pros, cons }`.
- **Intake_Message**: 확장 내부 메시지 타입 `intake:start`, `intake:progress`, `intake:done`, `intake:error`. 모든 메시지에 `tabId`가 있다.
- **Stain_Keywords**: `packages/core/src/rules/stainKeywords.ts`에 둔 규칙 문구 상수 (플랫폼 배지 문구, 대가성 명시 문구, 리뷰 이벤트 문구, 부정 표현).
- **Negation_Window**: 규칙 문구가 걸린 위치의 앞 15자와 뒤 15자 범위.
- **Normalized_Text**: 공백·줄바꿈·문장부호를 지운 문자열. 원문 포함 확인에 쓴다.
- **Dedupe_Function**: `dedupeReviews(best, latest)`.
- **Rule_Detector**: `detectCertainStains(reviews)`. 애벌빨래.
- **Judgment_Verifier**: `verifyJudgments(reviews, ruleTags, llmTags)`. 판정 검수.
- **Strict_Applier**: `applyStrict(tags, strict)`. 섬세 세탁 적용.
- **Rating_Calculator**: `averageRating(reviews)`.
- **Receipt_Builder**: `buildReceipt(reviews, tags, sources, partial)`.
- **Citation_Verifier**: `verifyCitations(cited, allowedIds)`.
- **Condition_Filter**: `applyConditions(reviews, conditions)`.
- **Match_Verifier**: `verifyMatches(reviews, matches)`.
- **Quote_Checker**: `containsQuote(text, quote)`.
- **Step_Stack**: `pushStep(steps, step)`, `popStep(steps)`, `resetSteps()`.
- **Property_Test_Suite**: `packages/core`의 `*.test.ts` 파일들에 있는 fast-check 속성 테스트 묶음.
- **Fixture_Set**: `packages/core/__fixtures__`의 AI로 만든 가상 리뷰 JSON 파일들.
- **Eval_Script**: `scripts/eval`의 세탁 품질 검사 스크립트.
- **Seed_Review_Snapshot**: 실제 리뷰 원문과 HTML 스냅샷. `scripts/eval/data/`(git 제외)에만 있다.

## Requirements

### Requirement 1: 워크스페이스와 패키지 설정

**User Story:** As 팀원(주영, 규리, 정민), I want 라이브러리가 한 번에 설치되고 코어 패키지를 빌드 없이 import할 수 있기를, so that `package-lock.json` 충돌 없이 15:25 이후 바로 작업할 수 있다.

#### Acceptance Criteria

1. THE Workspace_Setup SHALL install exactly the libraries listed in the tech.md 라이브러리 표 per workspace: root dev `typescript`, `vitest`, `fast-check`; `packages/core` `zod`; `apps/api` `@aws-sdk/client-bedrock-runtime`, `zod`; `apps/extension` `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/chrome`; `infra` `aws-cdk-lib`, `constructs`, dev `aws-cdk`.
2. THE Core_Package SHALL declare the package name `@star-laundry/core` and point `exports`, `main`, and `types` to `src/index.ts`.
3. THE Core_Package SHALL provide a `test` script that runs `vitest --run`.
4. THE Workspace_Setup SHALL provide a TypeScript configuration with `strict: true` that `packages/core`, `apps/api`, `apps/extension`, and `infra` extend.
5. WHEN `apps/api` or `apps/extension` imports `@star-laundry/core`, THE Workspace_Setup SHALL resolve the import to `packages/core/src/index.ts` without a build step.
6. THE Core_Package SHALL contain no `build` script and no `dist` output directory.

### Requirement 2: 공통 타입

**User Story:** As 확장과 API 담당자, I want 공통 타입이 한 곳에만 정의되기를, so that `/wash`, `/ask`, 확장 내부 메시지의 형식이 어긋나지 않는다.

#### Acceptance Criteria

1. THE Core_Package SHALL define `Site`, `Source`, and `Review` in `src/types/review.ts` with the fields and literal types given in api-contract.md.
2. THE Core_Package SHALL define `Stain`, `Signal`, `WashTag`, `Cited`, and `Receipt` in `src/types/wash.ts` with the fields and literal types given in api-contract.md.
3. THE Core_Package SHALL define `Conditions`, `Match`, and `Step` in `src/types/ask.ts` with the fields and literal types given in api-contract.md.
4. THE Core_Package SHALL define the Intake_Message types in `src/types/messages.ts`: `intake:start` with `tabId`; `intake:progress` with `tabId`, `done`, `total`; `intake:done` with `tabId`, `reviews`, `partial`, `reason` (`null` | `"blocked"` | `"captcha"` | `"unexpected"` | `"hidden_tab"`); `intake:error` with `tabId`, `reason` (`"not_product_page"` | `"blocked"` | `"parse_failed"`).
5. THE Core_Package SHALL define a union type of the four Intake_Message types discriminated by the `type` field.
6. THE Core_Package SHALL export every type in Requirement 2 from `src/index.ts`.

### Requirement 3: 시그니처 선공개 (15:25 PR)

**User Story:** As 주영과 정민, I want 코어 함수 11개의 시그니처가 먼저 공개되기를, so that 구현이 끝나기 전에도 같은 이름으로 import해 코드를 짤 수 있다.

#### Acceptance Criteria

1. THE Core_Package SHALL export `dedupeReviews`, `detectCertainStains`, `verifyJudgments`, `applyStrict`, `averageRating`, `buildReceipt`, `verifyCitations`, `applyConditions`, `verifyMatches`, `containsQuote`, `pushStep`, `popStep`, and `resetSteps` from `src/index.ts` with the input and output types given in the api-contract.md 코어 함수 표.
2. WHILE a core function has only a placeholder implementation, THE Core_Package SHALL return a type-correct empty result from that function (empty array, `null`, `false`, or a zero-count Receipt fields object).
3. WHEN the placeholder version of the Core_Package is type-checked with `tsc --noEmit`, THE Workspace_Setup SHALL report zero type errors.

### Requirement 4: 순수 함수와 입력 불변

**User Story:** As 확장과 API 담당자, I want 코어 함수가 브라우저와 Node 양쪽에서 같은 결과를 내기를, so that 확장과 Lambda에서 같은 함수를 안심하고 쓸 수 있다.

#### Acceptance Criteria

1. THE Core_Package SHALL implement every exported function without DOM APIs, Node built-in modules, network calls, timers, or randomness.
2. WHEN any exported function returns, THE Core_Package SHALL leave every input argument deeply equal to its value before the call.
3. WHEN an exported function is called twice with deeply equal inputs, THE Core_Package SHALL return deeply equal outputs.
4. THE Core_Package SHALL import no module from `apps/*` or `infra`.

### Requirement 5: 입고 중복 제거 (P1, P2)

**User Story:** As 입고 담당자(규리), I want 베스트순과 최신순 리뷰를 ID로 합치기를, so that 같은 리뷰가 두 번 세지지 않고 입고 범위를 정직하게 표시할 수 있다.

#### Acceptance Criteria

1. WHEN `best` and `latest` are given, THE Dedupe_Function SHALL return `reviews` that contain exactly one Review per distinct `id` found in `best` or `latest`.
2. WHEN a Review `id` appears in both `best` and `latest`, THE Dedupe_Function SHALL keep the field values of the first occurrence in `best` and set `source` to `"best"`.
3. WHEN a Review `id` appears only in `latest`, THE Dedupe_Function SHALL set `source` to `"latest"`.
4. THE Dedupe_Function SHALL order `reviews` by first occurrence, scanning `best` first and then `latest`.
5. THE Dedupe_Function SHALL return `sources` where `best` equals the length of the `best` input, `latest` equals the length of the `latest` input, and `duplicates` equals `best.length + latest.length - reviews.length`.
6. WHEN the Dedupe_Function output `reviews` is passed again as `best` with an empty `latest`, THE Dedupe_Function SHALL return the same `reviews` (P1).

### Requirement 6: 애벌빨래 규칙 탐지

**User Story:** As 세탁 API 담당자(주영), I want 규칙으로 확실한 얼룩을 먼저 찾기를, so that 명시된 대가성 리뷰를 LLM 없이 근거와 함께 걸러낼 수 있다.

#### Acceptance Criteria

1. THE Rule_Detector SHALL return exactly one WashTag per input Review, in input order, with the same `id`.
2. WHEN a Review `badges` entry contains the Stain_Keywords platform badge term (initial value `"체험단"`), THE Rule_Detector SHALL return `stain: "certain"`, `signal: "platform_badge"`, `evidence: null`.
3. WHEN a Review `text` contains the Stain_Keywords platform notice sentence (initial value `"쿠팡체험단 이벤트로 상품을 무료로 제공받아 작성된 후기입니다"`), THE Rule_Detector SHALL return `stain: "certain"`, `signal: "platform_badge"`, and `evidence` set to the sentence of the original `text` that contains the notice.
4. WHEN a Review `text` contains a Stain_Keywords disclosure phrase ("체험단", "제공받아", "제공 받아", "협찬", "원고료", "소정의", "무상으로 제공", "무료로 제공", "업체로부터", "지원받아") with no negation expression inside the Negation_Window, THE Rule_Detector SHALL return `stain: "certain"`, `signal: "disclosure"`, and `evidence` set to the sentence of the original `text` that contains the phrase.
5. WHEN a Review `text` contains a Stain_Keywords review event phrase ("리뷰 이벤트", "리뷰이벤트", "포토리뷰 이벤트", "리뷰 작성 시", "리뷰 쓰면", "사은품 받", "적립금 받") with no negation expression inside the Negation_Window, THE Rule_Detector SHALL return `stain: "certain"`, `signal: "review_event"`, and `evidence` set to the sentence of the original `text` that contains the phrase.
6. THE Rule_Detector SHALL match platform notice, disclosure, and review event phrases regardless of whitespace differences between the phrase and the `text` (for example, "제공 받아" matches "제공받아").
7. IF a negation expression ("아니", "아님", "않", "안 받", "없이", "내돈내산", "내 돈 내 산", "직접 구매", "제 돈으로") appears inside the Negation_Window of a matched disclosure or review event phrase, THEN THE Rule_Detector SHALL ignore that match.
8. WHEN a Review matches more than one signal, THE Rule_Detector SHALL choose the signal in the priority order `platform_badge`, `disclosure`, `review_event`.
9. WHEN a Review matches no rule, THE Rule_Detector SHALL return `stain: "none"`, `signal: null`, `evidence: null`, `include: true`.
10. WHEN the Rule_Detector returns `stain: "certain"`, THE Rule_Detector SHALL set `include: false`.
11. WHEN the Rule_Detector returns a non-null `evidence`, THE Quote_Checker SHALL return `true` for that Review `text` and that `evidence` (P6).
12. THE Core_Package SHALL define the platform badge term, platform notice sentence, disclosure phrases, review event phrases, and negation expressions only in Stain_Keywords.

### Requirement 7: 원문 포함 확인

**User Story:** As 세탁 API 담당자, I want LLM이 댄 근거 문장이 원문에 있는지 확인하기를, so that 원문에 없는 근거로 판정하거나 강조하지 않는다.

#### Acceptance Criteria

1. WHEN the Normalized_Text of `quote` is a substring of the Normalized_Text of `text`, THE Quote_Checker SHALL return `true`.
2. WHEN the Normalized_Text of `quote` is not a substring of the Normalized_Text of `text`, THE Quote_Checker SHALL return `false`.
3. IF the Normalized_Text of `quote` is an empty string, THEN THE Quote_Checker SHALL return `false`.
4. WHEN `quote` is any contiguous substring of `text` whose Normalized_Text is non-empty, THE Quote_Checker SHALL return `true`.

### Requirement 8: 판정 검수 (P6, P7)

**User Story:** As 세탁 API 담당자, I want 규칙 판정과 LLM 판정을 합치고 근거를 검수하기를, so that `certain`은 규칙이나 원문 대가성 문장이 있을 때만 남고 추정은 `suspected`까지만 남는다.

#### Acceptance Criteria

1. THE Judgment_Verifier SHALL return exactly one WashTag per input Review, in input order.
2. WHEN a rule WashTag for a Review has `stain: "certain"`, THE Judgment_Verifier SHALL return that rule WashTag for the Review.
3. WHEN no LLM WashTag exists for a Review, THE Judgment_Verifier SHALL return the rule WashTag for the Review.
4. THE Judgment_Verifier SHALL ignore LLM WashTags whose `id` is not an input Review `id`.
5. IF an LLM WashTag has `stain: "certain"` and its `evidence` is `null` or fails the Quote_Checker against the Review `text`, THEN THE Judgment_Verifier SHALL return `stain: "suspected"`, `signal: "suspected"` for the Review (P7).
6. IF an LLM WashTag has `stain: "suspected"` and its `evidence` is `null` or fails the Quote_Checker against the Review `text`, THEN THE Judgment_Verifier SHALL return `stain: "none"`, `signal: null`, `evidence: null` for the Review (P7).
7. WHEN an LLM WashTag is downgraded because its `evidence` fails the Quote_Checker, THE Judgment_Verifier SHALL set `evidence` to `null` in the returned WashTag.
8. IF an LLM WashTag has `stain: "certain"` and a `signal` other than `disclosure` or `review_event`, THEN THE Judgment_Verifier SHALL return `stain: "suspected"`, `signal: "suspected"` with the verified `evidence`.
9. WHEN the Judgment_Verifier returns `stain: "suspected"`, THE Judgment_Verifier SHALL set `signal` to `"suspected"`.
10. WHEN the Judgment_Verifier returns `stain: "none"`, THE Judgment_Verifier SHALL set `signal` and `evidence` to `null`.
11. THE Judgment_Verifier SHALL set `include` to `false` for `stain: "certain"` and to `true` for `stain: "none"` and `stain: "suspected"`.
12. WHEN the Judgment_Verifier returns a non-null `evidence`, THE Quote_Checker SHALL return `true` for the Review `text` and that `evidence` (P6).

### Requirement 9: 섬세 세탁 적용 (P3)

**User Story:** As 사이드 패널 담당자(정민), I want "의심 얼룩도 빼기"에 따라 포함 여부를 정하기를, so that 판정을 다시 하지 않고 평점과 요약만 다시 계산할 수 있다.

#### Acceptance Criteria

1. THE Strict_Applier SHALL return one WashTag per input WashTag, in input order, with `id`, `stain`, `signal`, and `evidence` unchanged.
2. THE Strict_Applier SHALL set `include: false` for every WashTag with `stain: "certain"`.
3. THE Strict_Applier SHALL set `include: true` for every WashTag with `stain: "none"`.
4. WHERE `strict` is `true`, THE Strict_Applier SHALL set `include: false` for every WashTag with `stain: "suspected"`.
5. WHERE `strict` is `false`, THE Strict_Applier SHALL set `include: true` for every WashTag with `stain: "suspected"`.
6. THE Strict_Applier SHALL produce a set of `include: true` IDs for `strict: true` that is a subset of the set of `include: true` IDs for `strict: false` (P3).

### Requirement 10: 평점 계산 (P4, P5, P15)

**User Story:** As 사용자, I want 평점이 코드로 계산되기를, so that LLM이 만든 숫자가 아닌 입고 리뷰 기준의 정확한 평점을 본다.

#### Acceptance Criteria

1. WHEN `reviews` is non-empty, THE Rating_Calculator SHALL return the arithmetic mean of `rating` values rounded half up to one decimal place.
2. WHEN `reviews` is non-empty, THE Rating_Calculator SHALL return a value between 1.0 and 5.0 inclusive (P4).
3. IF `reviews` is empty, THEN THE Rating_Calculator SHALL return `null` (P5).
4. WHEN `reviews` is non-empty, THE Rating_Calculator SHALL return a non-null value (P5).
5. WHEN the Rating_Calculator is applied to the Reviews referenced by the Match_Verifier output, THE Core_Package SHALL yield a `{ average, count }` pair where `count` equals the number of Match_Verifier output items and `average` is `null` only when `count` is 0 (P15).

### Requirement 11: 영수증 계산 (P2, P4, P10)

**User Story:** As 사용자, I want 세탁 영수증의 숫자가 판정 결과와 정확히 맞기를, so that 몇 개를 기준으로 몇 개가 빠졌는지 믿을 수 있다.

#### Acceptance Criteria

1. THE Receipt_Builder SHALL set `basedOn` to the number of input Reviews (P2).
2. THE Receipt_Builder SHALL set `sources` and `partial` to the given input values.
3. THE Receipt_Builder SHALL set `before` to the Rating_Calculator result over all input Reviews.
4. THE Receipt_Builder SHALL set `after` to the Rating_Calculator result over the input Reviews whose WashTag has `include: true` (P4, P5).
5. THE Receipt_Builder SHALL set each `stains[signal]` count to the number of input Reviews whose WashTag has `stain` other than `"none"` and that `signal`, with every Signal key present.
6. THE Receipt_Builder SHALL produce `stains` counts whose sum equals the number of input Reviews whose WashTag has `stain` other than `"none"` (P10).
7. THE Receipt_Builder SHALL set `removed` to the number of input Reviews whose WashTag has `include: false` (P10).
8. IF an input Review has no WashTag with the same `id`, THEN THE Receipt_Builder SHALL count that Review as `stain: "none"`, `include: true`.
9. THE Receipt_Builder SHALL ignore WashTags whose `id` is not an input Review `id`.

### Requirement 12: 요약 근거 검증 (P8)

**User Story:** As 사용자, I want 요약 문장마다 실제 근거 리뷰가 있기를, so that 근거 없는 요약이나 얼룩 리뷰를 근거로 한 요약을 보지 않는다.

#### Acceptance Criteria

1. THE Citation_Verifier SHALL remove from each Cited `reviewIds` every ID that is not in `allowedIds`.
2. THE Citation_Verifier SHALL remove duplicate IDs within each Cited `reviewIds`, keeping first occurrence order.
3. IF a Cited has an empty `reviewIds` after filtering, THEN THE Citation_Verifier SHALL drop that Cited.
4. IF a Cited has a `text` that is empty after trimming whitespace, THEN THE Citation_Verifier SHALL drop that Cited.
5. THE Citation_Verifier SHALL keep the remaining Cited items in input order with `text` unchanged.
6. THE Citation_Verifier SHALL return Cited items whose `reviewIds` are non-empty subsets of `allowedIds` (P8).

### Requirement 13: 정해진 조건 필터 (P11, P12)

**User Story:** As 사용자, I want 별점·기간·사진·정렬·옵션·단어 조건을 코드가 정확히 거르기를, so that 정해진 조건의 결과를 LLM 추정 없이 믿을 수 있다.

#### Acceptance Criteria

1. THE Condition_Filter SHALL return the input Reviews that satisfy every specified fixed condition, in input order.
2. WHERE `rating.min` is specified, THE Condition_Filter SHALL keep only Reviews with `rating >= rating.min`.
3. WHERE `rating.max` is specified, THE Condition_Filter SHALL keep only Reviews with `rating <= rating.max`.
4. WHERE `date.from` is specified, THE Condition_Filter SHALL keep only Reviews with `date >= date.from` compared as YYYY-MM-DD strings.
5. WHERE `date.to` is specified, THE Condition_Filter SHALL keep only Reviews with `date <= date.to` compared as YYYY-MM-DD strings.
6. WHERE `hasPhoto` is specified, THE Condition_Filter SHALL keep only Reviews whose `hasPhoto` equals the condition value.
7. WHERE `source` is specified, THE Condition_Filter SHALL keep only Reviews whose `source` equals the condition value.
8. WHERE `option` is a non-empty array, THE Condition_Filter SHALL keep only Reviews whose `option` is non-null and contains at least one array entry, ignoring whitespace and letter case.
9. WHERE `includes` is a non-empty array, THE Condition_Filter SHALL keep only Reviews whose `text` contains every entry, ignoring whitespace and letter case.
10. WHERE `excludes` is a non-empty array, THE Condition_Filter SHALL keep only Reviews whose `text` contains no entry, ignoring whitespace and letter case.
11. THE Condition_Filter SHALL ignore the `semantic` field, undefined fields, and empty arrays.
12. THE Condition_Filter SHALL include in the output every input Review that satisfies every specified fixed condition (P11).
13. WHEN the Condition_Filter output is filtered again with the same Conditions, THE Condition_Filter SHALL return the same Reviews (P12).
14. WHEN Conditions are split by field into two Conditions objects and applied one after another, THE Condition_Filter SHALL return the same Reviews as applying the combined Conditions once (P12).

### Requirement 14: 부분 세탁 결과 검수 (P9, P13)

**User Story:** As 사용자, I want 부분 세탁 결과가 실제 입력 리뷰와 원문 문장으로만 이루어지기를, so that 강조된 근거 문장이 리뷰 원문에 진짜 있다.

#### Acceptance Criteria

1. THE Match_Verifier SHALL drop every Match whose `id` is not an input Review `id`.
2. IF a Match has a non-null `quote` that fails the Quote_Checker against the matching Review `text`, THEN THE Match_Verifier SHALL drop that Match.
3. THE Match_Verifier SHALL keep a Match whose `quote` is `null` when its `id` is an input Review `id`.
4. WHEN two or more Matches share the same `id`, THE Match_Verifier SHALL keep only the first valid one.
5. THE Match_Verifier SHALL keep the remaining Matches in input order.
6. THE Match_Verifier SHALL return Matches whose non-null `quote` values pass the Quote_Checker against the matching Review `text` (P9).
7. THE Match_Verifier SHALL return Matches whose IDs are a subset of the input Review IDs (P13).
8. WHEN the Match_Verifier output IDs are used to select the next input Reviews, THE Match_Verifier SHALL return a list no longer than the previous list for every following step (P13).

### Requirement 15: 단계 스택 (P14)

**User Story:** As 사이드 패널 담당자, I want 부분 세탁 단계를 쌓고 되돌리는 순수 함수를 쓰기를, so that 조건 칩의 ✕와 "처음부터"가 API 재호출 없이 정확히 동작한다.

#### Acceptance Criteria

1. WHEN `step.ids` is non-empty and `steps` has fewer than 5 entries, THE Step_Stack `pushStep` SHALL return a new array equal to `steps` followed by `step`.
2. IF `step.ids` is empty, THEN THE Step_Stack `pushStep` SHALL return an array equal to `steps`.
3. IF `steps` already has 5 entries, THEN THE Step_Stack `pushStep` SHALL return an array equal to `steps`.
4. WHEN `steps` is non-empty, THE Step_Stack `popStep` SHALL return a new array equal to `steps` without its last entry.
5. IF `steps` is empty, THEN THE Step_Stack `popStep` SHALL return an empty array.
6. THE Step_Stack `resetSteps` SHALL return an empty array, which represents the full list of washed Reviews.
7. WHEN `step.ids` is non-empty and `steps` has fewer than 5 entries, THE Step_Stack SHALL satisfy `popStep(pushStep(steps, step))` equal to `steps` (P14).

### Requirement 16: 속성 기반 테스트와 테스트 데이터

**User Story:** As 심사위원, I want 코어 함수의 correctness property가 테스트로 검증되기를, so that 세탁 숫자와 근거 검증을 믿을 수 있다.

#### Acceptance Criteria

1. THE Property_Test_Suite SHALL contain one fast-check test for each core property P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, and P15, placed next to the target file as `*.test.ts`.
2. THE Property_Test_Suite SHALL start each property test name with its property number (for example, `P3: strict는 포함 집합을 줄이기만 한다`).
3. THE Property_Test_Suite SHALL contain example tests for the Rule_Detector covering each signal, whitespace-insensitive matching, and negation inside the Negation_Window ("제공받은 거 아니고 내돈내산입니다", "체험단 아닙니다").
4. THE Property_Test_Suite SHALL use only Fixture_Set reviews and fast-check generated data as review input.
5. THE Fixture_Set SHALL contain only AI-generated fictional reviews with no real company names, real person names, or Seed_Review_Snapshot content.
6. WHEN `npm test --workspace packages/core` runs, THE Property_Test_Suite SHALL finish in a single run with all tests passing.

### Requirement 17: 체험단 문구 갱신

**User Story:** As 입고 담당자(규리), I want 쿠팡 확인 결과로 체험단 문구만 바꾸기를, so that 어댑터와 규칙이 같은 문구를 쓴다.

#### Acceptance Criteria

1. WHEN the intake.md 쿠팡 페이지 확인 결과 records the actual platform badge text or notice sentence, THE Core_Package SHALL update only the corresponding values in Stain_Keywords and the related example tests.
2. WHEN Stain_Keywords values change, THE Property_Test_Suite SHALL pass without changes to Rule_Detector logic.

### Requirement 18: 세탁 품질 검사 최소 버전 (선택)

**User Story:** As 팀, I want 애벌빨래 규칙의 품질을 로컬 데이터로 확인하기를, so that README의 품질 수치를 코드가 계산한 값으로 채울 수 있다.

#### Acceptance Criteria

1. WHERE the Eval_Script is implemented, THE Eval_Script SHALL read labeled reviews only from `scripts/eval/data/`.
2. WHERE the Eval_Script is implemented, THE Eval_Script SHALL run the Rule_Detector on the labeled reviews and print precision and recall of `stain: "certain"` against the labels.
3. WHERE the Eval_Script is implemented, THE Eval_Script SHALL print counts and rates only, with no review text in its output.
4. IF `scripts/eval/data/` contains no labeled reviews, THEN THE Eval_Script SHALL print a message naming the expected data file path and exit with a non-zero code.
