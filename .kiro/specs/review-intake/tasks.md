# Implementation Plan: review-intake

## Overview

DOM에 의존하지 않는 어댑터(타입·상수 → 필드 매핑 → 중복 제거 → 요청 루프)를 fixture 테스트와 함께 먼저 만들고, 그다음 content script와 background 중계로 실제 브라우저에 연결한다. 마지막으로 미확인 필드를 사용자와 확인해 `coupangFields.ts`만 고치고, 재현의 공통 타입이 올라오면 임시 타입을 바꾼다.

- 언어: TypeScript (strict). 테스트: Vitest + fast-check (재현이 루트에 설치. 이 계획의 작업에서는 `npm install`을 하지 않는다).
- 테스트 실행(설치 후, 사용자가): 루트에서 `npx vitest --run apps/extension/src/services/adapters`.
- 수정 가능 경로: `apps/extension/src/content/**`, `apps/extension/src/services/adapters/**`, `apps/extension/src/background/**`(입고 중계만), `.kiro/specs/review-intake/**`. 루트·확장 `package.json`, `package-lock.json`, Vite 설정, manifest, 사이드 패널, `packages/core/src/types`는 건드리지 않는다.

## Tasks

- [x] 1. 임시 타입과 상수
  - [x] 1.1 `apps/extension/src/services/adapters/intakeTypes.ts` 작성
    - 첫 줄 주석: `// 임시: 재현의 @star-laundry/core 타입이 올라오면 교체`
    - design의 `Source`, `Review`, `IntakeStopReason`, `IntakeErrorReason`, `IntakeSources`, `IntakeResult`, `IntakeMessage`, `TabSession`, `HttpResponse`, `IntakeDeps`, `ReviewAdapter`를 그대로 정의
    - _Requirements: 13.1, 1.3, 1.4, 1.6, 2.1_
  - [x] 1.2 `apps/extension/src/services/adapters/intakeConstants.ts` 작성
    - `PAGES_PER_SORT = 5`, `MAX_REVIEWS = 100`, `MAX_REQUESTS_PER_PRODUCT = 10`, `PAGE_SIZE`, `MIN_GAP_MS`, `MAX_GAP_MS`, `MAX_TEXT_LENGTH`, `MAX_PHOTOS`, `REVIEW_API_URL`, `SORTS`, `SUCCESS_RCODE`, `ADVENTURER_BADGE`
    - _Requirements: 5.6, 6.3, 6.4_

- [x] 2. 리뷰 필드 매핑
  - [x] 2.1 가상 fixture 작성 (`apps/extension/src/services/adapters/__fixtures__/`)
    - `coupangPageNormal.json`, `coupangPageAdventurer.json`, `coupangPageEdge.json`, `coupangPageShort.json`, `coupangPageEmpty.json`, `coupangPageRcodeError.json`, `coupangPageBadShape.json` (design의 Data Models 표 내용)
    - 리뷰 본문은 AI로 만든 가상 문장만, 작성자 필드는 `"가상작성자"` 같은 가짜 값, 사진 주소는 `https://example.invalid/...`. 실제 쿠팡 응답을 복사하지 않는다
    - _Requirements: 12.1_
  - [x] 2.2 `apps/extension/src/services/adapters/coupangFields.ts` 구현
    - 상단에 확인/미확인 주석과 후보 상수 `DATE_FIELDS`, `TEXT_FIELDS`, `PHOTO_URL_KEYS`, `OPTION_FIELD`, 참고용 `AUTHOR_FIELDS`
    - `mapCoupangReview(raw, source)`, `toKstDate`, `truncateText`(코드 포인트 기준), `extractPhotos`를 design의 매핑 표대로 구현. 결과는 9개 필드만 담은 새 객체, 매핑 불가 리뷰는 `null`
    - Author_Fields 키를 읽지 않는다
    - _Requirements: 8.1, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2_
  - [x] 2.3 `apps/extension/src/services/adapters/coupangFields.test.ts` 작성 (fixture 기반 예시 테스트)
    - 필드 매핑(`cp-{reviewId}`, 별점, 제목+본문 줄바꿈), 결과 키가 정확히 9개이고 Author_Fields 없음
    - KST 날짜: UTC `14:59:59.999Z` → 같은 날, `15:00:00Z` → 다음 날. `createdAt` 없을 때 `reviewAt` 대체
    - 체험단: `vine`·`isAdventurerReview`·`badgeTitle`에서 `"쿠팡체험단"` 한 번만, `TOP_REVIEWER` 배지 유지, 본문 고정 문구 유지
    - 사진: 7장 → 5장, `//` → `https:`, `http://` 버림, 중복 제거, `hasPhoto`
    - 옵션: `itemName` 숫자·빈 문자열·없음 → `null`
    - 본문 2,000자 자르기(이모지 서로게이트 쌍 포함), `reviewId` 없음·`rating` 0 → `null`
    - _Requirements: 8.1, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8, 10.2, 10.3, 10.4, 10.6, 10.7, 10.8, 11.1, 11.2, 12.2, 12.4_

- [x] 3. 중복 제거
  - [x] 3.1 `apps/extension/src/services/adapters/dedupeReviews.ts` 구현 (임시)
    - 첫 줄 주석: `// 임시: 재현의 @star-laundry/core dedupeReviews가 올라오면 교체`
    - core와 같은 시그니처 `dedupeReviews(best, latest) → { reviews, sources }`. 베스트 우선, 같은 목록 안에서는 처음 것, 순서 유지, 입력 불변
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  - [x] 3.2 `apps/extension/src/services/adapters/dedupeReviews.test.ts`에 P1 속성 테스트 작성
    - **Property 1: 입고 중복 제거는 멱등이고 결과 ID는 모두 다르다**
    - 테스트 이름 `P1: 입고 중복 제거는 멱등이다`, `numRuns: 100`, 작은 id 풀에서 리뷰를 생성해 겹침을 만든다
    - 순서와 `sources` 예시 테스트도 같은 파일에 둔다
    - **Validates: Requirements 8.2, 8.3**

- [x] 4. 쿠팡 어댑터
  - [x] 4.1 `apps/extension/src/services/adapters/coupangAdapter.ts`에 `readProductId`, `buildReviewUrl`, `classifyResponse` 구현
    - URL 파라미터 순서 `productId, page, size=10, sortBy, ratingSummary=true, ratings=, market=`
    - design의 판정 순서(403/429 → 200 아님 → 리다이렉트·HTML → JSON 아님 → `rCode` → 모양)
    - _Requirements: 1.7, 5.1, 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 4.2 같은 파일에 `runCoupangIntake`와 `coupangAdapter` 구현
    - 베스트 1~5 → 최신 1~5 순차 요청, 첫 요청 제외 `sleep(1000 + random() × 1000)`, 요청마다 `waitUntilVisible()` 대기, 요청 수 10 상한
    - 짧은·빈 페이지에서 그 Sort 종료, 멈춤 사유에서 즉시 종료(재시도 없음), 네트워크 예외 → `unexpected`, 비어 있지 않은 페이지 전체 매핑 실패 → `unexpected`
    - `onProgress({ done, total })`, `dedupeReviews`로 결과·`sources`, `MAX_REVIEWS`로 자름, `partial`·`reason`·`requests`
    - 로그 출력 없음
    - _Requirements: 1.3, 3.1, 3.2, 3.3, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.5, 7.6, 7.7, 7.8, 8.2, 8.5, 11.3_
  - [x] 4.3 `apps/extension/src/services/adapters/coupangAdapter.test.ts`에 요청 예시 테스트 작성
    - 가짜 `fetchPage`(호출 URL·인자 기록, 동시 진행 수 기록), 가짜 `sleep`(가짜 시계를 앞으로 민다), 고정 `random`, `now`, `waitUntilVisible`
    - `buildReviewUrl` 정확한 문자열, `readProductId`, 요청 순서(베스트 1~5 → 최신 1~5), 동시 1개, 꽉 찬 페이지에서 정확히 10회, 짧은·빈 페이지 조기 종료
    - `sleep` 인자가 1000~2000ms(`random` 0, 0.5, 0.999)이고 첫 요청 전 호출 없음, 가짜 시계로 응답 처리 끝~다음 요청 간격 확인
    - `waitUntilVisible`이 resolve되기 전에는 요청 없음, resolve 후 같은 페이지부터 이어 함
    - `fetchPage`가 URL 하나만 받음(헤더 인자 없음), `onProgress`의 `done`/`total`(`ratingCount` 반영)
    - _Requirements: 1.3, 3.1, 3.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 12.2, 12.3_
  - [x] 4.4 `coupangAdapter.test.ts`에 멈춤 예시 테스트 추가
    - 베스트 2페이지 성공 후 3번째 요청이 403, 429, 500, `rCode` 오류, HTML, JSON 아님, 모양 다름, 네트워크 예외일 때: 요청 수 3에서 멈춤, 같은 URL 재요청 없음, `partial: true`, 해당 `reason`, 읽은 리뷰 20개 유지
    - 첫 요청에서 멈추면 리뷰 0개·`partial: true`, 정상 완료는 `partial: false`·`reason: null`, 리뷰 0개 상품은 `reviews: []`·`partial: false`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 12.2_
  - [x] 4.5 `coupangAdapter.test.ts`에 P2 속성 테스트 추가
    - **Property 2: 입고 결과의 리뷰 수는 중복을 뺀 고유 ID 수와 같다**
    - 테스트 이름 `P2: 입고 결과 리뷰 수는 고유 ID 수와 같다`, `numRuns: 100`. Sort마다 0~5페이지, 페이지마다 0~10개의 가상 Raw_Review(작은 id 풀로 겹침) 응답을 생성
    - `reviews.length === 고유 id 수 <= MAX_REVIEWS`, `=== sources.best + sources.latest - sources.duplicates`
    - **Validates: Requirements 6.4, 8.5**

- [x] 5. Checkpoint - 어댑터 테스트 통과 확인
  - Ensure all tests pass, ask the user if questions arise. (재현의 설치 전이면 사용자에게 `npx vitest --run apps/extension/src/services/adapters` 실행을 요청한다)

- [x] 6. content script 연결
  - [x] 6.1 `apps/extension/src/content/visibility.ts`에 `waitUntilVisible(doc)` 구현
    - visible이면 바로 resolve, 아니면 `visibilitychange`로 visible이 될 때 resolve하고 리스너 제거. DOM은 읽기만
    - _Requirements: 3.1, 3.2, 1.11_
  - [x] 6.2 `apps/extension/src/content/sessionStore.ts` 구현
    - `tabKey`, `readTabSession`, `writeIntakeResult`(같은 `productId`면 `wash`·`steps` 보존), `clearTabSession`. `chrome.storage.session`만 사용
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  - [x] 6.3 `apps/extension/src/content/intakeController.ts`에 `createIntakeController(deps)` 구현
    - design의 `handleStart` 1~6단계: Product_Id 없음 → `not_product_page`, 진행 중이면 `intake:progress`만, 같은 `productId` 저장값 → 바로 `intake:done`, 다르면 지우고 새로 입고, 진행률 메시지, 결과 저장 후 `intake:done`, 리뷰 0개+멈춤 → `intake:error`(`blocked`/`parse_failed`)
    - 모든 메시지에 `tabId`, `send` 실패 무시
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 1.10, 2.1, 2.3, 2.4_
  - [ ]* 6.4 `apps/extension/src/content/intakeController.test.ts` 작성
    - 가짜 deps(메모리 세션, 가짜 어댑터)로 저장값 재사용 시 어댑터 미호출, `productId` 변경 시 지우고 재입고, 진행 중 두 번째 시작 무시, 0개+`blocked` → `intake:error blocked`, `send` 실패에도 저장
    - _Requirements: 1.6, 1.9, 1.10, 2.3, 2.4_
  - [x] 6.5 `apps/extension/src/content/index.ts`에서 실제 의존성 연결
    - `fetch(url, { credentials: 'include' })`(헤더 추가 없음) → `HttpResponse`, `setTimeout` 기반 `sleep`, `Math.random`, `Date.now`, `waitUntilVisible(document)`, `chrome.runtime.sendMessage`
    - `chrome.runtime.onMessage`에서 `intake:start`이고 `tabId`가 숫자일 때만 `handleStart` 호출
    - _Requirements: 1.2, 5.5, 3.3_

- [x] 7. background 입고 중계
  - [x] 7.1 `apps/extension/src/background/intakeRelay.ts` 구현
    - `PRODUCT_URL_RE`, `productIdFromUrl`, `registerIntakeRelay()`
    - `storage.session.setAccessLevel(TRUSTED_AND_UNTRUSTED_CONTEXTS)`, 패널발 `intake:start`를 `chrome.tabs.sendMessage(tabId, msg)`로 전달, 상품 페이지가 아니거나 받는 쪽이 없으면 `intake:error not_product_page`
    - `tabs.onUpdated`에서 `productId`가 달라질 때만 `tab:{tabId}` 삭제(쿼리만 바뀌면 유지), `tabs.onRemoved`에서 삭제
    - _Requirements: 1.1, 1.8, 2.6, 4.1, 4.2, 4.3_
  - [x] 7.2 `apps/extension/src/background/index.ts`에서 `registerIntakeRelay()` 호출
    - 파일이 없으면 이 호출만 담아 만들고, 정민 코드가 있으면 import와 호출 한 줄만 추가한다
    - _Requirements: 1.1, 13.3_
  - [ ]* 7.3 `apps/extension/src/background/intakeRelay.test.ts` 작성
    - `productIdFromUrl`: 상품 URL, 쿼리만 다른 URL, 상품이 아닌 URL, `undefined`
    - _Requirements: 1.8, 4.1, 4.3_

- [~] 8. Checkpoint - 전체 테스트와 타입 확인
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. 미확인 필드 확인과 매핑 갱신
  - [x] 9.1 사용자와 미확인 필드를 확인하고 `coupangFields.ts`만 고친다
    - design "미확인 필드 확인 방법"의 Console 코드를 사용자에게 주고(필드 이름·타입과 개인정보가 아닌 값만 출력), 결과를 받는다. 출력은 레포에 올리지 않는다
    - 결과에 따라 `DATE_FIELDS`, `TEXT_FIELDS`, `PHOTO_URL_KEYS`, `OPTION_FIELD`를 바꾸고, `__fixtures__`의 가상 응답과 `coupangFields.test.ts` 기대값을 맞춘다. 다른 파일은 바꾸지 않는다
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.9_
  - [x] 9.2 `.kiro/steering/intake.md`의 "쿠팡 페이지 확인 결과 (규리)" 체크리스트 갱신
    - 확인된 항목(작성일 필드, 본문 전체 여부, 사진 URL 키, 구매 옵션 필드)의 `[ ]`를 `[x]`로 바꾸고 결과를 적는다. 그 섹션 밖은 바꾸지 않는다
    - _Requirements: 10.9_

- [ ] 10. 공통 타입으로 교체 (재현의 `@star-laundry/core`가 올라온 뒤)
  - [~] 10.1 `intakeTypes.ts`·`dedupeReviews.ts`의 사용처를 `@star-laundry/core`의 `Review`, 메시지 타입, `dedupeReviews`로 바꾼다
    - `coupangFields.ts`, `coupangAdapter.ts`, `content/*`, `background/intakeRelay.ts`의 import 교체. core에 없는 타입(`HttpResponse`, `IntakeDeps`, `ReviewAdapter`, `intake:done.sources` 등)은 `intakeTypes.ts`에 남기거나 재현에게 추가를 요청한다
    - P1 테스트가 core `dedupeReviews`를 가리키게 바꾸고, 쓰지 않게 된 임시 코드를 지운다
    - _Requirements: 13.2_

- [~] 11. Final checkpoint - 모든 테스트 통과 확인
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 표시 task는 선택이다. fixture 기반 파싱 테스트(2.3, 4.3, 4.4)와 P1·P2 속성 테스트(3.2, 4.5)는 필수다.
- 테스트는 Node에서 DOM과 `chrome` 없이 돈다. 어댑터는 요청 함수, `sleep`, `random`, `now`, `waitUntilVisible`을 주입받는다.
- 화면 DOM 대체 입고는 범위 밖이다 (design 열린 항목 5).
- 정민과 맞출 것: manifest `content_scripts`·background 진입점 등록, 키가 지워진 뒤 패널의 `intake:start` 재전송, `intake:done.sources` 표시. 재현과 맞출 것: core `messages.ts`에 `sources`와 새로고침 안내 이유 값 추가 여부.
- 커밋 메시지에 task 번호를 쓴다: `feat(review-intake): 4.2 쿠팡 요청 루프`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "6.1", "6.2", "7.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "4.1", "7.2", "7.3"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["4.3", "6.3"] },
    { "id": 5, "tasks": ["4.4", "6.4", "6.5"] },
    { "id": 6, "tasks": ["4.5"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2"] },
    { "id": 9, "tasks": ["10.1"] }
  ]
}
```
