---
inclusion: fileMatch
fileMatchPattern: ["apps/extension/src/content/**", "apps/extension/src/services/adapters/**", "apps/extension/src/background/**"]
---

# 입고 규칙

## 쿠팡
- 사이드 패널이 열리면 content script가 자동으로 입고를 시작한다. 패널은 진행률을 보여준다.
- 범위: 베스트순 5페이지(50개) + 최신순 5페이지(50개). 리뷰 ID로 중복을 뺀다. 리뷰가 적으면 있는 만큼만.
- 상한은 상수로 둔다: `PAGES_PER_SORT = 5`, `MAX_REVIEWS = 100`, `MAX_REQUESTS_PER_PRODUCT = 10`. 배포 환경에서 시간을 재 본 뒤에만 올린다.
- 차단 가능성을 낮추는 규칙:
  - 요청은 content script에서, 페이지가 리뷰 페이지를 넘길 때 쓰는 것과 같은 주소와 파라미터로 보낸다. 백그라운드나 서버에서 보내지 않는다.
  - 한 번에 하나씩 순서대로 보낸다. 병렬 요청 금지.
  - 요청 사이에 1~2초 무작위 간격을 둔다.
  - 탭이 보이는 상태일 때만 진행한다. 탭이 숨겨지면 멈췄다가 다시 보이면 이어서 한다.
  - 같은 탭, 같은 상품은 한 번만 입고한다. 패널을 닫았다 열어도 `chrome.storage.session`에 있으면 다시 요청하지 않는다.
  - 403, 429, 확인(캡차) 페이지, 예상과 다른 응답을 받으면 바로 멈춘다. 재시도하지 않는다. 그때까지 읽은 리뷰와 화면에 보이는 리뷰로 진행하고 `receipt.partial: true`.
  - 헤더 위조, 쿠키 조작, 차단 우회는 하지 않는다.
- 리뷰 `id`: 쿠팡 리뷰 ID에 `cp-`를 붙인다. 없으면 작성자·날짜·본문 앞부분의 해시. 같은 리뷰는 베스트순과 최신순에서 같은 ID가 나와야 한다 (중복 제거).
- 각 리뷰에 `source: "best" | "latest"`를 붙인다. 두 정렬에 모두 나오면 `"best"`로 둔다.
- 리뷰마다 추출: `id`, `rating`, `date`(YYYY-MM-DD), `text`(잘리지 않은 전체 본문), `badges`, `photos`(이미지 URL 배열, 최대 5개), `hasPhoto`, `option`(구매 옵션, 없으면 `null`). 부분 세탁의 정해진 조건과 리뷰 카드가 이 필드를 쓴다.
- `photos`는 사이드 패널의 리뷰 카드에만 쓴다. API에는 보내지 않는다 (`hasPhoto`만 보낸다).
- 작성자 이름은 추출하지 않는다. 사이드 패널과 API에 보내지 않는다.
- 쿠팡 페이지 DOM은 바꾸지 않는다. content script는 입고만 한다.


## 저장 위치 (탭별 세션)
- 사이드 패널은 창 단위로 하나 뜨고, 닫으면 패널 메모리가 사라진다. 그래서 입고 결과와 세탁 결과는 `chrome.storage.session`에 탭 ID별로 둔다.
  - 키: `tab:{tabId}` → `{ productId, reviews, intake: { done, total, partial, reason }, wash, steps }`
  - `chrome.storage.session`은 디스크에 쓰지 않는 메모리 저장소다. `chrome.storage.local`은 쓰지 않는다 (fairness.md).
  - `chrome.tabs.onRemoved`에서 그 탭 키를 지운다. 같은 탭에서 다른 상품으로 이동하면(`productId`가 바뀌면) 지우고 다시 입고한다.
- 사이드 패널은 쿠팡 상품 페이지(`https://www.coupang.com/vp/products/*`) 탭에서만 켠다 (`chrome.sidePanel.setOptions`로 탭별 활성화). 다른 탭에서는 "쿠팡 상품 페이지에서 열어 주세요"를 보여준다.
- 사용자가 탭을 바꾸면 패널은 그 탭의 키를 읽어 화면을 바꾼다.
- `storage.session`의 용량 제한(10MB)을 넘지 않도록 리뷰 본문은 최대 2,000자, 사진 주소는 최대 5개만 둔다.

## 확장 내부 메시지
content script ↔ 사이드 패널 (`chrome.runtime` 메시지). 모든 메시지에 `tabId`를 포함한다. 타입은 `packages/core/src/types/messages.ts`에 둔다.

| 메시지 | 보내는 쪽 | 내용 |
|---|---|---|
| `intake:start` | 사이드 패널 | 입고 시작 요청. 이미 입고됐으면 content script는 `intake:done`을 바로 보낸다 |
| `intake:progress` | content script | `{ done, total }` (total은 예상 최대치) |
| `intake:done` | content script | `{ reviews, partial, reason }`. `reason`: `null` \| `"blocked"` \| `"captcha"` \| `"unexpected"` \| `"hidden_tab"` |
| `intake:error` | content script | `{ reason }`. 리뷰를 하나도 못 읽었을 때. `reason`: `"not_product_page"` \| `"blocked"` \| `"parse_failed"` |

- content script가 받은 리뷰는 `intake:done`과 함께 `chrome.storage.session`에도 쓴다 (패널이 닫혀 있어도 결과가 남도록).

## 쿠팡 페이지 확인 결과 (규리)
> 담당자가 예시 상품 페이지의 개발자 도구(Network, Elements)에서 확인해 채운다. 어댑터 코드와 재현의 체험단 규칙은 이 내용과 맞아야 한다. 확인한 응답은 `scripts/eval/data/`(git 제외)에만 저장한다.

예시 상품: https://www.coupang.com/vp/products/8476098818?itemId=25071030734&vendorItemId=92075130632
확인에 쓴 상품: P1 김치 `productId=9050755607`, P2 커피 `productId=9194350970` (추천순 상위 10개 중 9개가 쿠팡체험단). 예시 상품(8476098818)에서는 아직 다시 확인하지 않았다.

**리뷰 목록 요청**
- [x] 리뷰 목록을 불러오는 요청 주소: `GET https://www.coupang.com/next-api/review`
- [x] 상품 식별 파라미터 (productId 등)와 페이지 URL에서 얻는 방법: `productId`. 페이지 URL에서 `location.pathname.match(/products\/(\d+)/)[1]`
- [x] 페이지 번호 파라미터, 한 번에 오는 리뷰 수: `page`(1부터), `size=10`(한 번에 10개). 그 밖의 파라미터: `ratingSummary=true`, `ratings=`(빈 값), `market=`(빈 값)
- [x] 정렬 파라미터 값 (베스트순, 최신순): 베스트순(추천순) `sortBy=ORDER_SCORE_ASC`, 최신순 `sortBy=DATE_DESC`. 둘 다 `rCode: "RET0000"`, 리뷰 10개 확인
- [x] 응답 형식 (HTML 조각 / JSON): JSON. 성공 시 `rCode === "RET0000"`. 리뷰 배열은 `rData.paging.contents`. 쿠팡 표시 평점은 `rData.ratingSummaryTotal.ratingAverage`, 리뷰 수는 `rData.ratingSummaryTotal.ratingCount`
- [ ] content script에서 `fetch`로 같은 요청을 보냈을 때 정상 응답이 오는지: 페이지 Console에서 `fetch(url, { credentials: 'include' })`로 200, 1.5초 간격 10회까지 차단 없음. 콘솔에서는 정상. 미확인: content script에서 같은 요청은 확장 로드 후 확인 필요
- [ ] 차단될 때의 응답 모습 (상태 코드, 확인 페이지): 미확인. 10회까지는 차단을 보지 못했다. 어댑터는 200이 아니거나, JSON이 아니거나, `rCode`가 `RET0000`이 아니면 차단으로 보고 멈춘다

**리뷰 한 개에서 뽑을 것** (응답 안의 위치나 선택자)
- [x] 리뷰 고유 ID: `rData.paging.contents[i].reviewId`(숫자) → `cp-{reviewId}`. 화면 DOM에는 리뷰 ID가 없다 (두 상품에서 속성 전체 검색 결과 없음)
- [x] 별점 (1~5): `rating`(숫자 1~5)
- [ ] 작성일과 형식 (예: 2026.10.02): `createdAt`을 쓴다(`reviewAt`은 수정일로 보인다). 10개 중 7개는 두 값이 같고 3개는 `reviewAt`이 3~8일 늦다. 나중에 내용을 덧붙인 리뷰가 `reviewAt`이 더 늦었다. 화면 표시는 `YYYY.MM.DD`. 남은 확인: 화면 표시 날짜가 `createdAt`과 같은지. 변환은 한국 시간(KST) 기준 YYYY-MM-DD
- [x] 본문. 긴 리뷰가 잘려서 오는지, 잘리면 전체 본문을 얻는 방법: 제목 `title`(빈 문자열일 수 있음) + 본문 `content`. API `content`는 잘리지 않은 전체 본문이다 (615~1,458자, 나중에 덧붙인 내용까지 포함). 화면의 "더보기" 접힘과 무관하다
- [x] 사진 주소 (썸네일 / 원본): `attachments[].imgSrcOrigin`(원본), `imgSrcThumbnail`(썸네일, 확인한 리뷰에서는 같은 주소). 주소는 `https://thumbnail.coupangcdn.com/...jpg`. 리뷰당 5~10장, `ordering` 순. `uploadedFilePath`는 주소가 아니라 쓰지 않는다. 동영상은 `videoAttachments`
- [x] 구매 옵션 (예: "블랙 / 10000mAh"): `itemName`(문자열). 상품명과 옵션이 붙어 온다 (예: "티오피 배럴 에이지드향 커피 마일드, 24개, 380ml"). 그대로 표시한다. 옵션이 여러 개인 상품에서 리뷰마다 달라지는지는 아직 못 봤다
- [x] 체험단 표시 문구와 위치 (예: "쿠팡체험단 이벤트로 상품을 무료로 제공받아 작성된 후기입니다"): 신호 세 가지. ① 필드 `vine: true`, `isAdventurerReview: true` ② `reviewerBadges` 안 `badgeTitle: "쿠팡체험단"` ③ 본문 고정 문구 "쿠팡체험단 이벤트로 상품을 무료 제공받아 작성한 리뷰입니다." P2에서 체험단 9개는 세 신호가 모두 있었고, 일반 리뷰 1개는 모두 없었다. 화면에서는 작성자 이름 옆 파란 [쿠팡체험단] 딱지. `incentive` 필드는 처음 확인 때 60개 모두 `false`였고, 다시 확인하니 P2에서 `null`이었다. 의미 미확인, 판정에 쓰지 않는다
- [x] 그 밖의 배지 (재구매, 한 달 사용 등): `reviewerBadges`의 `reviewerBadgeType`: `"TOP_REVIEWER"`(TOP100/500/1000), `"REAL_NAME_REVIEWER"`(실명리뷰어). 재구매·한 달 사용 같은 리뷰 배지는 아직 못 봤다
- [x] 작성자 이름 위치 (추출하지 않도록 제외할 위치): `member`, `displayWriter`, `displayName`, `displayWriterIconUrls`, `reviewerDisplayImage`, `reviewerRank`. 이 필드는 읽지 않는다

**사이드 패널 표시**
- [ ] 사이드 패널(`<img>`)에서 쿠팡 리뷰 사진 주소가 그대로 열리는지: 미확인. 주소 필드는 `imgSrcOrigin`으로 확정. 확장 로드 후 패널에서 열리는지 확인한다 (안 열리면 "사진 N장"으로만 표시)
