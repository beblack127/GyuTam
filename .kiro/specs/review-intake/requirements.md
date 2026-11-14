# Requirements Document

## Introduction

review-intake는 별점세탁소 크롬 확장의 "입고" 단계다. 사용자가 쿠팡 상품 페이지에서 사이드 패널을 열면 content script가 쿠팡 리뷰 목록 API(`GET /next-api/review`)에서 베스트순 5페이지와 최신순 5페이지를 차례로 읽고, 리뷰 카드와 세탁 API에 필요한 필드만 뽑아 탭별 세션 저장소에 둔다. 담당은 규리이고, 범위는 다음 네 가지다.

1. 패널을 열면 자동 입고 (content script, 메시지, 탭별 세션 저장, 최소한의 background 중계)
2. 쿠팡 어댑터 (요청 범위, 순서, 간격, 상한, 차단 시 중단, 중복 제거)
3. 리뷰 필드 추출 (작성자 정보 제외, 미확인 필드는 한 파일에서 안전한 대체값으로 처리)
4. 어댑터 파싱 테스트 (Vitest + fast-check, AI로 만든 가상 JSON fixture)

근거 문서: `.kiro/steering/intake.md`(입고 규칙, 메시지 표, "쿠팡 페이지 확인 결과 (규리)"), `api-contract.md`(`Review` 형식), `fairness.md`, `testing.md`(P1, P2), `structure.md`, `tech.md`, `hackathon.md`.

범위 밖:
- 화면에 보이는 리뷰를 DOM에서 읽는 대체 입고. 화면 DOM에는 리뷰 ID가 없고 선택자도 확인되지 않았다. MVP에서는 그때까지 API로 읽은 리뷰로만 진행한다.
- 사이드 패널 화면, manifest, Vite 설정, `package.json` (정민, 재현 담당).
- `packages/core/src/types`의 공통 타입 작성 (재현 담당). 그전까지 어댑터 폴더의 임시 타입을 쓴다.

## Glossary

- **Side_Panel**: 정민이 만드는 확장 사이드 패널. `intake:start`를 보내고 진행률과 결과를 표시한다.
- **Background_Relay**: `apps/extension/src/background`의 입고 중계 코드. 사이드 패널의 `intake:start`를 해당 탭의 content script로 전달하고 탭 세션 키의 수명을 관리한다.
- **Intake_Controller**: `apps/extension/src/content`의 content script 입고 조율 코드. 메시지를 받고, 탭 세션을 확인하고, 어댑터를 실행하고, 결과를 저장하고 메시지를 보낸다.
- **Coupang_Adapter**: `apps/extension/src/services/adapters/coupangAdapter.ts`. DOM에 의존하지 않는 쿠팡 리뷰 요청·응답 처리 코드. 요청 함수, 대기 함수, 난수, 시계, 탭 표시 대기를 주입받는다.
- **Field_Mapper**: `apps/extension/src/services/adapters/coupangFields.ts`. 쿠팡 응답의 리뷰 한 개(`rData.paging.contents[i]`)를 `Review`로 바꾸는 유일한 파일.
- **Session_Store**: `chrome.storage.session`. 키 `tab:{tabId}`에 `{ productId, reviews, intake, wash, steps }`를 둔다.
- **Review**: api-contract.md의 리뷰 형식. `id`, `rating`, `date`, `text`, `badges`, `photos`, `hasPhoto`, `option`, `source`.
- **Raw_Review**: 쿠팡 응답의 `rData.paging.contents` 배열 원소 한 개.
- **Sort**: 정렬 종류. 베스트순(`source: "best"`, `sortBy=ORDER_SCORE_ASC`)과 최신순(`source: "latest"`, `sortBy=DATE_DESC`).
- **Stop_Reason**: 입고가 중간에 멈춘 이유. `"blocked"`, `"captcha"`, `"unexpected"`, `"hidden_tab"`.
- **Intake_Result**: 입고 결과. `{ reviews, partial, reason, sources }`. `sources`는 `{ best, latest, duplicates }`.
- **Product_Id**: 페이지 URL 경로 `/vp/products/{숫자}`의 숫자.
- **Temp_Types**: `apps/extension/src/services/adapters/intakeTypes.ts`. 재현의 `@star-laundry/core` 타입이 올라오기 전까지 쓰는 임시 타입 파일.
- **Author_Fields**: 작성자 정보 필드. `member`, `displayWriter`, `displayName`, `displayWriterIconUrls`, `reviewerDisplayImage`, `reviewerRank`.
- **KST**: 한국 표준시 (UTC+9).
- **Synthetic_Fixture**: `apps/extension/src/services/adapters/__fixtures__/`에 두는, AI로 만든 가상 쿠팡 응답 JSON. 실제 리뷰 원문을 넣지 않는다.

## Requirements

### Requirement 1: 패널을 열면 자동 입고

**User Story:** As a 쿠팡 쇼핑 사용자, I want 사이드 패널을 열면 리뷰 입고가 자동으로 시작되고 진행률이 보이기를, so that 따로 버튼을 누르지 않고 세탁 방식을 고를 수 있다.

#### Acceptance Criteria

1. WHEN Side_Panel이 `tabId`를 담은 `intake:start` 메시지를 보내면, THE Background_Relay SHALL 그 메시지를 해당 `tabId` 탭의 content script로 전달한다.
2. WHEN Intake_Controller가 `intake:start` 메시지를 받으면, THE Intake_Controller SHALL 페이지 URL에서 Product_Id를 읽고 Coupang_Adapter로 입고를 시작한다.
3. WHEN Coupang_Adapter가 한 페이지 응답 처리를 마치면, THE Intake_Controller SHALL `{ tabId, done, total }`을 담은 `intake:progress` 메시지를 보낸다. `done`은 지금까지 중복을 뺀 리뷰 수이고, `total`은 `MAX_REVIEWS`와 응답의 `rData.ratingSummaryTotal.ratingCount` 중 작은 값이다 (`ratingCount`가 없으면 `MAX_REVIEWS`).
4. WHEN 입고가 끝나고 읽은 리뷰가 1개 이상이면, THE Intake_Controller SHALL `{ tabId, reviews, partial, reason, sources }`를 담은 `intake:done` 메시지를 보낸다.
5. WHEN 입고가 오류 없이 끝나고 상품의 리뷰가 0개이면, THE Intake_Controller SHALL `reviews: []`, `partial: false`, `reason: null`을 담은 `intake:done` 메시지를 보낸다.
6. IF 입고가 Stop_Reason으로 멈추고 읽은 리뷰가 0개이면, THEN THE Intake_Controller SHALL `intake:error` 메시지를 보낸다. `reason`은 Stop_Reason이 `"blocked"` 또는 `"captcha"`이면 `"blocked"`, `"unexpected"`이면 `"parse_failed"`다.
7. IF 페이지 URL에서 Product_Id를 읽을 수 없으면, THEN THE Intake_Controller SHALL 요청을 보내지 않고 `reason: "not_product_page"`를 담은 `intake:error` 메시지를 보낸다.
8. IF `intake:start`를 받은 탭의 URL이 `https://www.coupang.com/vp/products/*` 형식이 아니면, THEN THE Background_Relay SHALL content script로 전달하지 않고 `reason: "not_product_page"`를 담은 `intake:error` 메시지를 보낸다.
9. WHILE 같은 탭에서 입고가 진행 중이면, THE Intake_Controller SHALL 새 `intake:start`를 받아도 두 번째 입고를 시작하지 않고 현재 진행률을 담은 `intake:progress` 메시지를 보낸다.
10. IF 메시지를 받을 사이드 패널이 없어 `chrome.runtime.sendMessage`가 실패하면, THEN THE Intake_Controller SHALL 그 실패를 무시하고 입고와 Session_Store 저장을 계속한다.
11. THE Intake_Controller SHALL 쿠팡 페이지의 DOM을 바꾸지 않는다.

### Requirement 2: 탭별 세션 저장과 한 번만 입고

**User Story:** As a 사용자, I want 패널을 닫았다 열어도 같은 상품의 리뷰를 다시 요청하지 않기를, so that 쿠팡에 불필요한 요청을 보내지 않고 결과를 바로 본다.

#### Acceptance Criteria

1. WHEN 입고가 끝나면, THE Intake_Controller SHALL Session_Store의 `tab:{tabId}` 키에 `productId`, `reviews`, `intake: { done, total, partial, reason, sources }`를 쓴다.
2. WHEN Intake_Controller가 Session_Store에 입고 결과를 쓸 때 기존 값의 `productId`가 현재 Product_Id와 같으면, THE Intake_Controller SHALL 기존 값의 `wash`와 `steps`를 그대로 둔다.
3. WHEN Intake_Controller가 `intake:start`를 받았을 때 Session_Store의 `tab:{tabId}`에 현재 Product_Id와 같은 `productId`의 입고 결과가 있으면, THE Intake_Controller SHALL 쿠팡에 요청하지 않고 저장된 `reviews`, `partial`, `reason`, `sources`로 `intake:done` 메시지를 바로 보낸다.
4. WHEN Intake_Controller가 `intake:start`를 받았을 때 Session_Store의 `tab:{tabId}`의 `productId`가 현재 Product_Id와 다르면, THE Intake_Controller SHALL 그 키를 지우고 입고를 새로 시작한다.
5. THE Intake_Controller SHALL 입고 결과를 `chrome.storage.session`에만 쓴다.
6. THE Background_Relay SHALL 확장이 시작될 때 content script가 Session_Store를 읽고 쓸 수 있도록 `chrome.storage.session`의 접근 수준을 `TRUSTED_AND_UNTRUSTED_CONTEXTS`로 설정한다.

### Requirement 3: 탭 숨김 시 멈춤과 이어 하기

**User Story:** As a 사용자, I want 다른 탭을 보는 동안에는 입고가 멈추기를, so that 보이지 않는 탭에서 요청이 계속 나가지 않는다.

#### Acceptance Criteria

1. WHILE `document.visibilityState`가 `"hidden"`이면, THE Coupang_Adapter SHALL 다음 요청을 보내지 않고 기다린다.
2. WHEN 탭이 다시 보이는 상태가 되면, THE Coupang_Adapter SHALL 멈춘 다음 페이지부터 입고를 이어 한다.
3. THE Coupang_Adapter SHALL 탭 표시 상태 확인을 주입받은 `waitUntilVisible` 함수로 한다.

### Requirement 4: 상품 변경과 탭 닫기

**User Story:** As a 사용자, I want 같은 탭에서 다른 상품으로 가면 그 상품의 리뷰를 새로 읽기를, so that 이전 상품의 리뷰가 섞이지 않는다.

#### Acceptance Criteria

1. WHEN 탭의 URL이 바뀌어 Product_Id가 Session_Store의 `tab:{tabId}`에 저장된 `productId`와 달라지면, THE Background_Relay SHALL 그 탭의 `tab:{tabId}` 키를 지운다.
2. WHEN 탭이 닫히면, THE Background_Relay SHALL 그 탭의 `tab:{tabId}` 키를 지운다.
3. WHEN 같은 Product_Id 안에서 `itemId`나 `vendorItemId` 같은 쿼리만 바뀌면, THE Background_Relay SHALL `tab:{tabId}` 키를 그대로 둔다.

### Requirement 5: 쿠팡 요청 범위와 순서

**User Story:** As a 개발자, I want 쿠팡 페이지가 쓰는 것과 같은 주소와 파라미터로 정해진 범위만 요청하기를, so that 차단 가능성을 낮추고 입고 범위를 정직하게 밝힐 수 있다.

#### Acceptance Criteria

1. THE Coupang_Adapter SHALL 리뷰를 `GET https://www.coupang.com/next-api/review`에 `productId`, `page`, `size=10`, `sortBy`, `ratingSummary=true`, `ratings=`(빈 값), `market=`(빈 값) 파라미터로 요청한다.
2. THE Coupang_Adapter SHALL 베스트순(`sortBy=ORDER_SCORE_ASC`) `page` 1~`PAGES_PER_SORT`를 먼저 요청하고, 그다음 최신순(`sortBy=DATE_DESC`) `page` 1~`PAGES_PER_SORT`를 요청한다.
3. THE Coupang_Adapter SHALL 한 번에 요청 하나만 보내고, 앞 요청의 응답 처리가 끝난 뒤에 다음 요청을 보낸다.
4. WHEN 한 Sort의 응답에서 `rData.paging.contents`가 비어 있거나 10개보다 적으면, THE Coupang_Adapter SHALL 그 Sort의 남은 페이지를 요청하지 않고 다음 Sort로 넘어간다.
5. THE Coupang_Adapter SHALL 요청에 `credentials: "include"`만 지정하고 요청 헤더를 추가하거나 바꾸지 않는다.
6. THE Coupang_Adapter SHALL 상수 `PAGES_PER_SORT = 5`, `MAX_REVIEWS = 100`, `MAX_REQUESTS_PER_PRODUCT = 10`을 한 상수 파일에서 가져다 쓴다.

### Requirement 6: 요청 간격과 상한

**User Story:** As a 개발자, I want 요청 사이에 1~2초 무작위 간격과 요청 수 상한을 두기를, so that 사람이 페이지를 넘기는 속도와 비슷하게 요청한다.

#### Acceptance Criteria

1. WHEN 앞 요청의 응답 처리가 끝나고 다음 요청이 남아 있으면, THE Coupang_Adapter SHALL 주입받은 `random()` 값 r로 `1000 + r × 1000` 밀리초를 주입받은 `sleep`으로 기다린 뒤 다음 요청을 보낸다.
2. THE Coupang_Adapter SHALL 첫 요청 전에는 간격 대기를 하지 않는다.
3. THE Coupang_Adapter SHALL 한 상품의 한 번 입고에서 `MAX_REQUESTS_PER_PRODUCT`(10)보다 많은 요청을 보내지 않는다.
4. THE Coupang_Adapter SHALL 중복을 뺀 리뷰를 최대 `MAX_REVIEWS`(100)개까지만 결과에 담는다.

### Requirement 7: 차단·이상 응답 시 바로 멈춤

**User Story:** As a 개발자, I want 차단이나 예상과 다른 응답을 받으면 재시도 없이 바로 멈추기를, so that 차단을 우회하지 않고 그때까지 읽은 리뷰로 진행한다.

#### Acceptance Criteria

1. IF 응답 상태 코드가 403 또는 429이면, THEN THE Coupang_Adapter SHALL 더 요청하지 않고 Stop_Reason `"blocked"`로 멈춘다.
2. IF 응답 상태 코드가 200이 아니고 403, 429도 아니면, THEN THE Coupang_Adapter SHALL 더 요청하지 않고 Stop_Reason `"blocked"`로 멈춘다.
3. IF 응답이 다른 주소로 리다이렉트되었거나 `Content-Type`이 `text/html`이거나 본문을 JSON으로 읽을 수 없으면, THEN THE Coupang_Adapter SHALL 더 요청하지 않고 Stop_Reason `"captcha"`로 멈춘다.
4. IF 응답 JSON의 `rCode`가 `"RET0000"`이 아니면, THEN THE Coupang_Adapter SHALL 더 요청하지 않고 Stop_Reason `"blocked"`로 멈춘다.
5. IF 응답 JSON에 배열인 `rData.paging.contents`가 없거나, 비어 있지 않은 페이지에서 `Review`로 바꿀 수 있는 Raw_Review가 하나도 없으면, THEN THE Coupang_Adapter SHALL 더 요청하지 않고 Stop_Reason `"unexpected"`로 멈춘다.
6. IF 요청 함수가 네트워크 오류로 예외를 던지면, THEN THE Coupang_Adapter SHALL 더 요청하지 않고 Stop_Reason `"unexpected"`로 멈춘다.
7. WHEN Coupang_Adapter가 Stop_Reason으로 멈추면, THE Coupang_Adapter SHALL 같은 요청을 다시 보내지 않고 그때까지 읽은 리뷰와 `partial: true`, 해당 `reason`을 Intake_Result로 돌려준다.
8. WHEN Coupang_Adapter가 모든 Sort를 멈춤 없이 끝내면, THE Coupang_Adapter SHALL `partial: false`, `reason: null`을 Intake_Result로 돌려준다.

### Requirement 8: 중복 제거와 출처 표시

**User Story:** As a 사용자, I want 베스트순과 최신순에 모두 나온 리뷰가 한 번만 세어지기를, so that 세탁 전·후 평점이 같은 리뷰를 두 번 세지 않는다.

#### Acceptance Criteria

1. THE Field_Mapper SHALL 리뷰 `id`를 `cp-{reviewId}` 형식으로 만든다.
2. WHEN 같은 `id`의 리뷰가 베스트순과 최신순에 모두 있으면, THE Coupang_Adapter SHALL 베스트순 리뷰 하나만 `source: "best"`로 결과에 담는다.
3. WHEN 같은 `id`의 리뷰가 한 Sort 안에서 두 번 이상 나오면, THE Coupang_Adapter SHALL 처음 나온 리뷰 하나만 결과에 담는다.
4. THE Coupang_Adapter SHALL 결과 `reviews`를 베스트순 리뷰를 읽은 순서대로 먼저, 최신순에만 있는 리뷰를 읽은 순서대로 그 뒤에 둔다.
5. THE Coupang_Adapter SHALL Intake_Result의 `sources`에 베스트순에서 읽은 고유 리뷰 수(`best`), 최신순에서 읽은 고유 리뷰 수(`latest`), 두 Sort에 모두 나온 리뷰 수(`duplicates`)를 담는다.

### Requirement 9: 확인된 리뷰 필드 추출

**User Story:** As a 사용자, I want 리뷰 카드에 별점, 작성일, 전체 본문, 체험단 표시가 정확히 나오기를, so that 세탁 판정과 조건 필터가 맞는 값으로 동작한다.

#### Acceptance Criteria

1. THE Field_Mapper SHALL Raw_Review의 `rating`(정수 1~5)을 `Review.rating`으로 둔다.
2. THE Field_Mapper SHALL `Review.text`를 Raw_Review의 `title`과 `content` 중 비어 있지 않은 값을 줄바꿈 하나로 이어 붙이고 앞뒤 공백을 지운 문자열로 만든다.
3. IF `Review.text`가 2,000자를 넘으면, THEN THE Field_Mapper SHALL 앞에서부터 2,000자(유니코드 코드 포인트 기준)만 남긴다.
4. THE Field_Mapper SHALL Raw_Review의 `reviewerBadges[].badgeTitle` 문자열을 순서대로 중복 없이 `Review.badges`에 담는다.
5. WHEN Raw_Review의 `vine` 또는 `isAdventurerReview`가 `true`이고 `badges`에 `"쿠팡체험단"`이 없으면, THE Field_Mapper SHALL `badges`에 `"쿠팡체험단"`을 더한다.
6. THE Field_Mapper SHALL 본문의 쿠팡체험단 고정 문구를 지우지 않고 `Review.text`에 그대로 둔다.
7. THE Field_Mapper SHALL 각 리뷰에 그 리뷰를 읽은 Sort의 `source`(`"best"` 또는 `"latest"`)를 붙인다.
8. IF Raw_Review에 숫자 `reviewId`가 없거나 `rating`이 1~5 정수가 아니거나 날짜를 만들 수 없으면, THEN THE Field_Mapper SHALL 그 Raw_Review를 건너뛰고 결과에 담지 않는다.

### Requirement 10: 미확인 필드의 매핑과 안전한 대체값

**User Story:** As a 개발자, I want 아직 확인하지 못한 필드를 한 파일에서 안전한 대체값으로 처리하기를, so that 확인 결과가 나오면 그 파일 하나만 고치면 된다.

#### Acceptance Criteria

1. THE Field_Mapper SHALL Raw_Review에서 `Review`로 가는 모든 필드 매핑을 `coupangFields.ts` 한 파일에 두고, 미확인 필드마다 후보 필드 이름과 대체 규칙을 주석으로 적는다.
2. THE Field_Mapper SHALL `Review.date`를 Raw_Review의 `createdAt`(epoch 밀리초)이 숫자이면 `createdAt`으로, 아니면 `reviewAt`으로 만든다.
3. THE Field_Mapper SHALL `Review.date`를 KST 기준 `YYYY-MM-DD` 문자열로 만든다.
4. THE Field_Mapper SHALL Raw_Review의 `itemName`이 비어 있지 않은 문자열이면 앞뒤 공백을 지워 `Review.option`으로 두고, 아니면 `Review.option`을 `null`로 둔다.
5. THE Field_Mapper SHALL Raw_Review의 `attachments` 원소마다 후보 URL 키를 정해진 순서로 확인해 처음 찾은 URL 하나를 `Review.photos`에 담는다.
6. THE Field_Mapper SHALL `//`로 시작하는 사진 주소 앞에 `https:`를 붙이고, `https://`로 시작하지 않는 주소는 버린다.
7. THE Field_Mapper SHALL `Review.photos`에 중복 없이 최대 5개 주소만 담는다.
8. THE Field_Mapper SHALL Raw_Review의 `attachments`가 비어 있지 않은 배열이면 `Review.hasPhoto`를 `true`로, 아니면 `false`로 둔다.
9. WHEN 사용자가 미확인 필드의 확인 결과를 알려 주면, THE Field_Mapper SHALL `coupangFields.ts`의 매핑만 바꿔 확인 결과를 반영한다.

### Requirement 11: 작성자 정보 제외

**User Story:** As a 리뷰 작성자, I want 내 이름과 프로필이 확장에 저장되거나 전송되지 않기를, so that 개인정보가 퍼지지 않는다.

#### Acceptance Criteria

1. THE Field_Mapper SHALL Author_Fields를 읽지 않는다.
2. THE Field_Mapper SHALL `Review`에 `id`, `rating`, `date`, `text`, `badges`, `photos`, `hasPhoto`, `option`, `source` 외의 필드를 담지 않는다.
3. THE Coupang_Adapter SHALL 리뷰 원문과 응답 본문을 콘솔이나 로그에 남기지 않는다.

### Requirement 12: 어댑터 파싱 테스트

**User Story:** As a 개발자, I want 가상 응답 fixture로 어댑터를 테스트하기를, so that 실제 리뷰 원문 없이 파싱과 중단 규칙을 확인한다.

#### Acceptance Criteria

1. THE Synthetic_Fixture SHALL AI로 만든 가상 리뷰 본문과 가상 작성자 값만 담고, 실제 쿠팡 응답 원문을 담지 않는다.
2. THE Coupang_Adapter 테스트 SHALL Vitest와 fast-check로 작성하고 Node 환경에서 DOM 없이 실행된다.
3. THE Coupang_Adapter 테스트 SHALL 요청 함수, `sleep`, `random`, `now`, `waitUntilVisible`을 가짜 구현으로 주입한다.
4. THE 테스트 파일 SHALL 대상 파일 옆에 `*.test.ts` 이름으로 둔다.

### Requirement 13: 임시 타입과 공통 타입 교체

**User Story:** As a 팀원, I want 입고 코드가 재현의 공통 타입이 올라오기 전에도 같은 형식을 쓰기를, so that 공통 타입이 올라오면 import만 바꿔 합칠 수 있다.

#### Acceptance Criteria

1. WHILE `@star-laundry/core`에 `Review`와 메시지 타입이 없으면, THE Temp_Types SHALL api-contract.md의 `Review`와 intake.md의 메시지 형식과 같은 타입을 정의하고, 첫 줄에 "임시: 재현의 @star-laundry/core 타입이 올라오면 교체" 주석을 둔다.
2. WHEN `@star-laundry/core`가 `Review`, 메시지 타입, `dedupeReviews`를 내보내면, THE Coupang_Adapter와 Intake_Controller SHALL Temp_Types와 임시 중복 제거 함수 대신 `@star-laundry/core`의 것을 import한다.
3. THE review-intake 코드 SHALL `apps/extension/src/content/**`, `apps/extension/src/services/adapters/**`, `apps/extension/src/background/**`의 입고 중계 파일, `.kiro/specs/review-intake/**` 안에만 둔다.
