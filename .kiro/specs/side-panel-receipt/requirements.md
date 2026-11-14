# Requirements Document

## Introduction

별점세탁소 크롬 확장의 사이드 패널(React)과 확장 빌드를 정의한다. 사용자가 쿠팡 상품 페이지에서 사이드 패널을 열면 입고가 자동으로 시작된다. 사용자는 기본 세탁이나 섬세 세탁을 골라 세탁하기를 누르고, 사이드 패널은 `POST /wash` 응답으로 세탁 영수증과 세탁된 리뷰 카드 목록을 보여준다. 사용자가 문장으로 질문하면 `POST /ask` 결과로 리뷰 목록을 단계별로 좁혀 보여준다.

이 문서는 15:05~15:32 커밋으로 바뀐 steering(product, tech, hackathon, structure, fairness, api-contract, intake, testing)과 정민의 와이어프레임(화면 01~08)을 합쳐 다시 쓴 것이다. 동작, 계약, 빌드, 저장, 메시지는 steering을 따른다. 생김새, 배치, 문구는 와이어프레임을 따르되 아래 요구사항대로 고친다. 시각 세부는 design 단계에서 정한다.

이전 버전에서 바뀐 점:
- 빌드: `@crxjs/vite-plugin`을 빼고 Vite + `@vitejs/plugin-react`로 진입점 3개를 직접 설정한다
- 저장: "탭 ID + 상품 키" 대신 intake.md의 `tab:{tabId}` 레코드 하나를 쓴다
- 메시지: intake.md의 `intake:start`, `intake:progress`, `intake:done`, `intake:error`만 쓴다. 페이지 태그, 스크롤, 하이라이트 메시지는 없앴다
- 부분 세탁: 단일 주제 `/ask` 대신 `conditions`, `matches`, 조건 칩, 단계 스택을 쓴다
- 화면 08(쿠팡 페이지 위 표시)은 만들지 않는다

범위와 작업 규칙:
- 브랜치: `feat/side-panel-receipt`
- 담당 폴더: `apps/extension/src/sidepanel`, `apps/extension/src/components`, `apps/extension/src/services/api`, 패널이 쓰는 `apps/extension/src/constants`·`hooks`·`types`·`utils`·`styles`, 확장 빌드 설정, `apps/extension/public/manifest.json`
- 규리 폴더(`apps/extension/src/content`, `apps/extension/src/services/adapters`, `apps/extension/src/background`)에는 파일을 만들거나 고치지 않는다
- 라이브러리는 tech.md의 `apps/extension` 목록(react, react-dom, vite, @vitejs/plugin-react, @types/chrome)과 요청해 둔 @types/react, @types/react-dom만 쓴다. 설치는 재현이 한다
- 문구 상수를 바꾸면 `fairness-reviewer` 에이전트로 검토한다

우선순위 (16:35 통합, 17:15 기능 동결):

| 등급 | 요구사항 | 내용 | 목표 |
|---|---|---|---|
| ① | 1~14 | 빌드 뼈대, 임시 타입, API 클라이언트와 목, 화면 01·02(정지 그림)·03, 리뷰 카드, 질문 입력, 05 1단계, 문구·디자인 규칙, 순수 로직 테스트 | 16:35 통합 전 |
| ② | 15~19 | 조건 칩과 뒤로·처음부터, 04 근거 보기, 빠진 리뷰 보기, 07 경고 카드와 오류, 06 지원하지 않는 페이지 | 17:15 전 |
| ③ | 20 | 섬세 세탁 재세탁(판정 재사용) | 17:15 전, 남는 시간 |
| ④ | 21 | 사진 크게 보기, 02-2 세탁 끝과 애니메이션, 예시 리뷰 체험 | 마지막 |

- 자르는 순서: ④ → ③ → 단계 쌓기(요구사항 15, 1단계 질문만 남김). hackathon.md의 순서와 같다
- ③을 자르면 섬세 세탁은 판정 재사용 없이 `strict: true` 전체 세탁으로만 동작하고, 03의 "의심 얼룩도 빼고 다시 세탁" 버튼은 숨긴다
- 단계 쌓기를 자르면 05에서 낸 질문도 첫 질문으로 처리한다

외부 의존:
- 재현: @types/react, @types/react-dom 설치. `@star-laundry/core`의 공통 타입, `packages/core/src/types/messages.ts`, `applyStrict`, `averageRating`, `detectCertainStains`, `pushStep`·`popStep`·`resetSteps` 내보내기. 나오기 전에는 패널 폴더에 같은 이름과 모양의 임시 타입·함수를 둔다(평점 계산은 임시로도 만들지 않는다). `Step`에는 `quote`가 없으므로 패널은 현재 단계의 `quote`만 메모리에 둔다
- 규리: Background가 `chrome.storage.session.setAccessLevel`을 호출해 Content_Script가 Tab_Session에 쓸 수 있게 하고, 쿠팡 상품 페이지 탭마다 사이드 패널을 켠다. Content_Script가 `reviews`와 `intake`를 쓰고 입고 메시지를 보낸다. Background가 탭을 닫을 때와 상품이 바뀔 때 레코드를 지운다
- 주영: `/wash`의 `tags` 입력 처리, 통합용 로컬 API 서버(`http://localhost:8787`)
- README: 평가자 체험 시나리오 4단계 문구를 "섬세 세탁(의심 얼룩도 빼기)을 고르고 세탁하기"로 바꾼다

가정:
- Tab_Session의 `intake` 값으로 입고가 끝났는지 알 수 있다. 필드 의미는 `messages.ts`가 나오면 맞춘다
- `/ask` 응답의 `unsupported`는 `null`이거나 화면에 그대로 보여줄 수 있는 문구다

## Glossary

- **Side_Panel**: `apps/extension/src/sidepanel`의 React 사이드 패널 앱 전체. 화면 전환, Tab_Session 읽기·쓰기, 입고 메시지 처리를 맡는다
- **Waiting_Screen**: 화면 01 대기. 헤더, 페이지 카드, 세탁 코스 선택, 세탁하기 버튼, 안내 문구
- **Washing_Screen**: 화면 02 세탁 중
- **Wash_Done_Screen**: 화면 02-2 세탁 끝 (④)
- **Receipt_Screen**: 화면 03 세탁 영수증과 세탁된 리뷰 목록
- **Removed_Screen**: 빠진 리뷰 보기 화면
- **Evidence_Screen**: 화면 04 근거 보기
- **Refine_Screen**: 화면 05 부분 세탁
- **Unsupported_Screen**: 화면 06 지원하지 않는 페이지
- **Warning_Card**: 화면 07의 경고 카드. 부분 결과, 빈 요약, API 오류를 같은 모양으로 보여준다
- **Review_Card**: 리뷰 한 개를 보여주는 카드 (`ReviewCard`)
- **Photo_Viewer**: Review_Card의 사진을 패널 안에서 크게 보여주는 보기 (④)
- **Question_Input**: 화면 아래쪽의 질문 입력 영역 (`components/features/wash-request`)
- **Api_Client**: `apps/extension/src/services/api`의 `POST /wash`, `POST /ask` 호출 모듈. 요청 본문 조립과 응답 검증을 순수 함수로 포함한다
- **Mock_Api**: 목 모드에서 Api_Client의 네트워크 호출을 대신하는 구현
- **Extension_Build**: `apps/extension`의 Vite + `@vitejs/plugin-react` 빌드 설정과 출력 폴더
- **Manifest**: 빌드 출력에 들어가는 Manifest V3 `manifest.json`
- **Copy_Constants**: 판정·경고 문구를 모아 둔 `apps/extension/src/constants`의 상수 파일 하나
- **Extension_Tests**: `apps/extension`의 Vitest + fast-check 테스트
- **Content_Script**: `apps/extension/src/content`의 입고 스크립트 (규리, review-intake spec)
- **Background**: `apps/extension/src/background`의 service worker (규리)
- **Core**: 워크스페이스 패키지 `@star-laundry/core` (재현, wash-rules spec)
- **Tab_Session**: `chrome.storage.session`의 `tab:{tabId}` 레코드 `{ productId, reviews, intake, wash, steps }` (intake.md)
- **현재 탭**: 사이드 패널이 열린 창의 활성 탭
- **쿠팡 상품 페이지**: 주소가 `https://www.coupang.com/vp/products/`로 시작하는 페이지
- **입고**: Content_Script가 페이지에서 리뷰를 읽어 Tab_Session에 쓰는 단계 (`intake`)
- **입고 완료**: Content_Script가 `intake:done`을 보냈거나 Tab_Session의 `intake`가 끝난 상태
- **입고 중단**: `partial: true`인 입고 완료. `reason`이 이유 코드다
- **입고 실패**: Content_Script가 보낸 `intake:error` (읽은 리뷰 0개)
- **세탁 코스**: 기본 세탁(`strict: false`, 확실한 얼룩만 뺀다) 또는 섬세 세탁(`strict: true`, 의심 얼룩도 뺀다)
- **세탁 결과**: Tab_Session `wash`에 저장한 세탁 코스, `tags`, `receipt`
- **재세탁**: Tab_Session에 세탁 결과가 있는 상태에서 시작하는 `/wash` 호출
- **판정 재사용**: 재세탁 요청에 저장된 `tags`를 Core `applyStrict`로 다시 계산해 담는 것. API는 본세탁을 건너뛴다
- **세탁 영수증**: `/wash` 응답의 `receipt` (`basedOn`, `sources`, `before`, `after`, `stains`, `removed`, `partial`, `summary`, `pros`, `cons`)
- **세탁 태그**: `/wash` 응답 `tags`의 리뷰별 `stain`, `signal`, `evidence`, `include`
- **확실한 얼룩**: `stain: "certain"`인 리뷰
- **의심 얼룩**: `stain: "suspected"`인 리뷰
- **깨끗한 리뷰**: `stain: "none"`인 리뷰
- **세탁된 리뷰**: 세탁 결과에서 `include: true`인 리뷰
- **빠진 리뷰**: 세탁 결과에서 `include: false`인 리뷰
- **근거 행**: `summary`, `pros`, `cons` 항목 하나를 문장, "근거 {reviewIds 수}", 펼침 화살표(chevron)로 보여주는 행
- **단계 스택**: Tab_Session `steps`에 두는 부분 세탁 단계 목록 (Core `Step[]`, 최대 5개)
- **현재 목록**: 단계 스택이 비어 있으면 세탁된 리뷰 전체, 아니면 마지막 단계 `ids`의 리뷰
- **첫 질문**: 01 또는 03에서 낸 질문. 세탁된 리뷰 전체를 대상으로 한다
- **이어지는 질문**: 05에서 낸 질문. 현재 목록을 대상으로 한다
- **조건 칩**: 단계 스택을 보여주는 칩 줄 (`세탁된 리뷰 96 ★4.3 › 사진 있음 31 ★4.1`)
- **회색 막대**: 값이 아직 없는 자리에 숫자나 글 대신 보여주는 회색 자리 표시
- **목 모드**: `VITE_USE_MOCK_API`가 `"true"`인 빌드
- **목 시나리오**: 목 모드에서 고르는 응답 상황 10가지 (`normal`, `partial`, `summary_empty`, `after_null`, `matches_empty`, `unsupported`, `network_error`, `bad_request`, `timeout`, `server_error`)
- **예시 리뷰**: AI로 만든 가상 리뷰. 실존 업체, 인물, 작성자 이름이 없다
- **요청 시간 제한**: 패널 쪽 제한 시간. `/wash` 30초, `/ask` 20초

## Requirements

### Requirement 1: 확장 빌드와 manifest (①)

**User Story:** As a 사이드 패널 담당, I want 사이드 패널, content script, background를 확장 전용 플러그인 없이 한 번에 빌드하기, so that 팀 라이브러리 목록만으로 Releases zip을 만들 수 있다

#### Acceptance Criteria

1. THE Extension_Build SHALL Vite와 `@vitejs/plugin-react`만으로 사이드 패널 HTML, Content_Script, Background 진입점 3개를 직접 설정해 하나의 출력 폴더로 빌드한다
2. THE Extension_Build SHALL Content_Script를 import 문이 없는 파일 하나로 묶는다
3. IF Content_Script 또는 Background 진입 파일이 아직 없으면, THEN THE Extension_Build SHALL 그 진입점을 건너뛰고 Manifest에서도 해당 항목을 뺀 채 빌드를 끝낸다
4. THE Extension_Build SHALL 확장 코드에 노출하는 환경 변수를 `VITE_API_BASE_URL`과 `VITE_USE_MOCK_API` 두 개로 한정하고, 개발용 `VITE_API_BASE_URL` 값으로 `http://localhost:8787`을 쓴다
5. IF 목 모드가 아닌 빌드에서 `VITE_API_BASE_URL`이 비어 있으면, THEN THE Extension_Build SHALL 빌드를 실패시키고 빠진 변수 이름을 출력한다
6. THE Manifest SHALL `permissions`를 `sidePanel`, `storage`, `tabs`로, `host_permissions`를 `https://www.coupang.com/*`와 `VITE_API_BASE_URL`의 origin으로 선언한다
7. THE Manifest SHALL 이름 "별점세탁소", 사이드 패널 기본 경로, 툴바 action을 선언하고, `description`에 쿠팡과 제휴하지 않은 비공식 도구라는 문구를 넣는다
8. WHERE Content_Script 진입점이 있으면, THE Manifest SHALL Content_Script를 쿠팡 상품 페이지(`https://www.coupang.com/vp/products/*`)에 선언한다
9. THE Extension_Build SHALL Core를 워크스페이스 패키지 `@star-laundry/core`로 가져오고, tech.md 목록과 @types/react, @types/react-dom 밖의 라이브러리를 의존성에 넣지 않는다

### Requirement 2: 탭 세션 저장 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 패널을 닫았다 열거나 탭을 바꿔도 결과가 남아 있기, so that 같은 상품을 다시 입고하거나 세탁하지 않아도 된다

#### Acceptance Criteria

1. WHEN 사이드 패널이 열리거나 현재 탭이 바뀌면, THE Side_Panel SHALL 현재 탭 ID의 Tab_Session을 읽어 화면을 그린다
2. WHEN Tab_Session을 읽으면, THE Side_Panel SHALL 단계 스택이 있으면 05, 세탁 결과만 있으면 03, 둘 다 없으면 01을 보여준다
3. THE Side_Panel SHALL Tab_Session의 `wash`와 `steps`만 쓰고, `productId`, `reviews`, `intake`는 읽은 값 그대로 둔다
4. WHEN `/wash` 응답을 받으면, THE Side_Panel SHALL 요청을 시작한 탭의 Tab_Session `wash`에 세탁 코스, `tags`, `receipt`를 저장하고 `steps`를 빈 배열로 바꾼다
5. WHEN 현재 탭의 Tab_Session이 지워지거나 다른 상품의 레코드로 바뀌면, THE Side_Panel SHALL 01을 보여주고 요구사항 3의 자동 입고를 시작한다
6. WHEN 현재 탭이 바뀔 때 `/wash` 또는 `/ask` 요청이 진행 중이면, THE Side_Panel SHALL 진행 중인 요청을 중단하고 새 탭의 Tab_Session으로 화면을 그린다
7. THE Side_Panel SHALL 리뷰와 세탁 결과를 `chrome.storage.session`에만 저장하고 `chrome.storage.local`, `localStorage`, 서버, 디스크를 저장 위치로 쓰지 않는다
8. THE Side_Panel SHALL 콘솔 로그에 리뷰 본문 대신 리뷰 ID와 개수만 남긴다

### Requirement 3: 자동 입고와 입고 메시지 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 패널을 열기만 하면 리뷰 읽기가 시작되기, so that 따로 버튼을 누르지 않고 바로 세탁할 수 있다

#### Acceptance Criteria

1. WHEN 사이드 패널이 열리거나 현재 탭이 다시 로드되거나 다른 주소로 이동했을 때 현재 탭이 쿠팡 상품 페이지이고 입고 완료가 아니면, THE Side_Panel SHALL 현재 탭에 `{ type: "intake:start", tabId }` 메시지를 보낸다
2. WHEN `intake:progress`, `intake:done`, `intake:error` 메시지를 받으면, THE Side_Panel SHALL 메시지의 `tabId`가 현재 탭 ID와 같을 때만 화면에 반영한다
3. THE Side_Panel SHALL Content_Script와 `intake:start`, `intake:progress`, `intake:done`, `intake:error` 네 메시지만 주고받고, 쿠팡 페이지 DOM을 바꾸는 메시지를 보내지 않는다
4. WHERE Core의 `messages.ts`가 아직 없으면, THE Side_Panel SHALL intake.md와 같은 모양의 임시 메시지 타입을 패널 폴더에 두고 사용한다
5. IF `intake:start`를 받을 Content_Script가 현재 탭에 없으면, THEN THE Side_Panel SHALL 06을 보여준다
6. IF `intake:error`의 `reason`이 `"not_product_page"`이면, THEN THE Side_Panel SHALL 06을 보여준다

### Requirement 4: API 클라이언트 (①)

**User Story:** As a 사이드 패널 담당, I want 계약대로 요청을 만들고 응답을 검증하는 클라이언트, so that 사진 주소나 얼룩 리뷰가 API로 새지 않고 잘못된 응답에 화면이 깨지지 않는다

#### Acceptance Criteria

1. WHEN 세탁을 시작하면, THE Api_Client SHALL `VITE_API_BASE_URL`의 `/wash`로 `{ site: "coupang", strict, reviews }`를 POST하고, `reviews`에 Tab_Session 리뷰를 입고 순서대로 최대 100개 담는다
2. THE Api_Client SHALL `/wash` 리뷰 항목에 `id`, `rating`, `date`, `text`, `badges`, `hasPhoto`, `option`, `source`만 담는다
3. WHEN 질문을 보내면, THE Api_Client SHALL `/ask`로 `{ site: "coupang", request, today, history, reviews }`를 POST하고, `request`에는 앞뒤 공백을 뺀 질문을, `today`에는 기기 시간 기준 `YYYY-MM-DD`를 담는다
4. THE Api_Client SHALL 첫 질문의 `reviews`에 세탁된 리뷰 전체를, 이어지는 질문의 `reviews`에 현재 목록을 담고, `history`에 단계 스택의 `request`를 순서대로 최대 5개 담는다
5. THE Api_Client SHALL `/ask` 리뷰 항목에 `id`, `rating`, `date`, `text`, `hasPhoto`, `option`, `source`만 담아 `photos`를 확장 안에만 둔다
6. THE Api_Client SHALL 요청 헤더와 본문에 API 키, AWS 자격 증명 같은 비밀 정보를 담지 않는다
7. WHEN 응답을 받으면, THE Api_Client SHALL 응답 본문이 api-contract.md의 `/wash` 또는 `/ask` 응답 모양과 맞는지 확인한 뒤에만 Side_Panel에 넘긴다
8. IF 요청 시간 제한(`/wash` 30초, `/ask` 20초) 안에 응답이 오지 않으면, THEN THE Api_Client SHALL 요청을 중단하고 시간 초과 오류를 돌려준다
9. IF 요청이 실패하면, THEN THE Api_Client SHALL 실패를 네트워크 오류, 시간 초과, 400, 429, 그 밖의 4xx, 5xx, 응답 형식 오류 중 하나로 분류해 돌려준다
10. WHEN Side_Panel이 요청 중단을 요청하면, THE Api_Client SHALL 진행 중인 요청을 중단하고 결과를 버린다

### Requirement 5: 목 모드 (①)

**User Story:** As a 사이드 패널 담당, I want content script와 API 없이 화면 01~05를 돌려 보기, so that 16:35 통합 전에 화면과 오류 경로를 모두 확인할 수 있다

#### Acceptance Criteria

1. WHERE 목 모드이면, THE Api_Client SHALL 네트워크 호출 대신 Mock_Api를 쓰고 실제 API와 같은 함수 시그니처와 같은 응답 타입을 쓴다
2. WHERE 목 모드이면, THE Side_Panel SHALL Content_Script 대신 예시 리뷰로 입고 진행률(`리뷰 읽는 중 {done} / {total}개`)을 늘려 가다 입고 완료를 만든다
3. WHERE 목 모드이면, THE Side_Panel SHALL 현재 탭이 쿠팡 상품 페이지가 아니어도 01~05를 보여주고, `chrome.storage.session`을 쓸 수 없는 환경에서는 Tab_Session을 패널 메모리에 둔다
4. WHERE 목 모드이면, THE Side_Panel SHALL 목 시나리오 선택 메뉴를 보여주고, 목 모드가 아닌 빌드에서는 이 메뉴를 그리지 않는다
5. WHERE 목 모드이면, THE Mock_Api SHALL 고른 목 시나리오에 따라 정상 응답(`normal`), `receipt.partial: true`(`partial`), `summary: []`(`summary_empty`), `after: null`(`after_null`), `matches: []`(`matches_empty`), `unsupported` 값이 있는 `/ask` 응답(`unsupported`), 네트워크 오류, 400, 시간 초과, 5xx를 돌려준다
6. THE Mock_Api SHALL 예시 리뷰의 ID만 쓰는 api-contract.md 모양의 응답을 돌려준다
7. THE Side_Panel SHALL 예시 리뷰를 패널 폴더에 두고, 실제 리뷰 원문을 목 데이터로 쓰지 않는다

### Requirement 6: 01 대기 화면 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 패널을 열면 지금 페이지와 입고 상황을 보고 세탁 코스를 고르기, so that 기다리는 동안 상황을 알고 바로 세탁할 수 있다

#### Acceptance Criteria

1. THE Waiting_Screen SHALL 헤더에 로고, "별점세탁소", 접근 이름이 "새 세탁 시작"인 "+" 버튼을 보여준다
2. THE Waiting_Screen SHALL 페이지 카드에 "지금 보는 페이지 · 쿠팡", 현재 탭 제목에서 " | 쿠팡"을 뺀 상품 이름, 입고 상태를 보여준다
3. WHILE 입고가 진행 중인 동안, THE Waiting_Screen SHALL 입고 상태를 "리뷰 읽는 중 {done} / {total}개"로 보여준다
4. WHEN 입고 완료가 `partial: false`이면, THE Waiting_Screen SHALL 입고 상태를 "리뷰 {n}개를 읽었어요"로 보여준다
5. WHEN 입고 중단이면, THE Waiting_Screen SHALL 입고 상태를 "리뷰 {n}개까지 읽고 멈췄어요 · {이유}"로 보여주고, {이유}에 Copy_Constants의 이유 문구(`blocked` "요청 차단", `captcha` "확인 페이지", `unexpected` "예상과 다른 응답", `hidden_tab` "탭이 숨겨짐")를 쓴다
6. IF 입고 실패의 `reason`이 `"blocked"` 또는 `"parse_failed"`이면, THEN THE Waiting_Screen SHALL 입고 상태를 "리뷰를 읽지 못했어요 · {이유}"로 보여주고 "페이지 새로고침" 버튼을 보여준다
7. THE Waiting_Screen SHALL 세탁 코스 선택지 두 개, "기본 세탁"(확실한 얼룩을 빼고 평점과 요약)과 "섬세 세탁"(의심 얼룩도 빼기)을 보여주고 기본 세탁을 처음 선택값으로 둔다
8. THE Waiting_Screen SHALL 주 버튼 "세탁하기"와 그 아래 안내 "베스트순 50 + 최신순 50, 최대 100개를 읽어요"를 보여준다
9. WHILE 입고 완료가 아니거나 입고한 리뷰가 0개인 동안, THE Waiting_Screen SHALL 세탁하기 버튼을 비활성으로 둔다
10. IF 입고 완료인데 입고한 리뷰가 0개이면, THEN THE Waiting_Screen SHALL "세탁할 리뷰가 없어요"를 보여준다
11. WHEN 사용자가 세탁하기를 누르면, THE Side_Panel SHALL 고른 세탁 코스의 `strict` 값으로 `/wash`를 호출하고 02를 보여준다
12. THE Waiting_Screen SHALL Question_Input 아래에 "패널을 열 때만 리뷰를 읽고, 서버에 저장하지 않아요."와 작은 글씨의 "쿠팡과 제휴하지 않은 비공식 도구예요."를 보여준다
13. WHEN 사용자가 02가 아닌 화면에서 "+" 버튼을 누르면, THE Side_Panel SHALL 입고 결과와 세탁 결과를 그대로 둔 채 01을 보여주고 입고를 다시 요청하지 않는다

### Requirement 7: 02 세탁 중 화면 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 세탁하는 동안 무엇을 하고 있는지 보기, so that 20초 남짓 기다리는 동안 멈춘 것으로 오해하지 않는다

#### Acceptance Criteria

1. THE Washing_Screen SHALL 요청 말풍선에 기본 세탁이면 "체험단 리뷰 빼고 평점이랑 요약해줘", 섬세 세탁이면 "의심 얼룩까지 빼고 평점이랑 요약해줘"를 보여준다
2. THE Washing_Screen SHALL 진행 카드에 "세탁 중이에요", 세탁 코스 이름, 세탁기 정지 그림을 보여준다
3. WHILE `/wash` 요청이 진행 중인 동안, THE Washing_Screen SHALL "얼룩 판정 중 · {경과}초"를 1초마다 갱신하고 끝을 알 수 없는(indeterminate) 진행 막대를 보여준다
4. THE Washing_Screen SHALL 경과 초 밖의 진행 숫자(퍼센트, 남은 시간, 처리한 리뷰 수)를 보여주지 않는다
5. WHILE `/wash` 요청이 진행 중인 동안, THE Washing_Screen SHALL 단계 표시에서 접수와 입고를 완료로, 판정을 진행 중으로, 검수와 영수증을 대기로 보여준다
6. THE Washing_Screen SHALL 점선 테두리의 임시 영수증에 Core `averageRating`으로 구한 세탁 전 평점과 Core `detectCertainStains` 결과의 확실한 얼룩 수로 "규칙으로 먼저 찾은 확실한 얼룩 {N}개"를 보여준다
7. WHERE Core의 `averageRating` 또는 `detectCertainStains`를 아직 쓸 수 없으면, THE Washing_Screen SHALL 해당 값 자리에 회색 막대를 보여준다
8. WHEN 사용자가 "세탁 중단"을 누르면, THE Side_Panel SHALL `/wash` 요청을 중단하고 Tab_Session을 바꾸지 않은 채 세탁을 시작하기 전 화면으로 돌아간다
9. WHILE `/wash` 요청이 진행 중인 동안, THE Question_Input SHALL 입력을 비활성으로 두고 "세탁이 끝나면 물어볼 수 있어요"를 보여준다
10. WHILE `/wash` 요청이 진행 중인 동안, THE Side_Panel SHALL 헤더의 "+" 버튼을 비활성으로 둔다
11. WHEN `/wash` 응답을 받으면, THE Washing_Screen SHALL 검수와 영수증 단계를 완료로 바꾸고, Wash_Done_Screen이 없으면 바로 03을 보여준다

### Requirement 8: 03 세탁 영수증 화면 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 세탁 결과를 영수증 한 장과 세탁된 리뷰 목록으로 보기, so that 평점이 얼마나 바뀌었고 무엇을 기준으로 했는지 한눈에 안다

#### Acceptance Criteria

1. THE Receipt_Screen SHALL 영수증 머리에 세탁 결과의 세탁 코스에 따라 "기본 세탁" 또는 "섬세 세탁"을 보여준다
2. THE Receipt_Screen SHALL `before` → `after`를 소수 첫째 자리(예: 4.0)로 보여주고, 표시용 차이 x(`|after − before|`, 소수 첫째 자리)로 `after`가 낮으면 "{x} 낮아짐", 높으면 "{x} 높아짐", 같으면 "변화 없음" 알약 표시를 붙인다
3. IF `before` 또는 `after`가 `null`이면, THEN THE Receipt_Screen SHALL `null`인 평점 자리에 "계산할 리뷰 없음"을 보여주고 차이 알약 표시를 생략한다
4. THE Receipt_Screen SHALL "리뷰 {basedOn}개 기준 · {basedOn − removed}개로 다시 계산"과 "베스트순 {best} + 최신순 {latest}, 중복 {duplicates}개 제외"를 보여준다
5. THE Receipt_Screen SHALL 얼룩 요약 버튼에 "확실한 얼룩 {N}개 제외"(N은 `platform_badge`, `disclosure`, `review_event` 개수의 합), 신호별 개수, 기본 세탁이면 "의심 얼룩 {suspected}개 표시만", 섬세 세탁이면 "의심 얼룩 {suspected}개 제외"를 보여준다
6. THE Receipt_Screen SHALL 요약 묶음 제목 "세탁 후 요약 · 문장을 누르면 근거 리뷰로 이동" 아래에 `summary`를, "장점"과 "단점" 아래에 `pros`와 `cons`를 근거 행으로 보여준다
7. IF `pros` 또는 `cons`가 빈 배열이면, THEN THE Receipt_Screen SHALL 해당 묶음을 그리지 않는다
8. THE Receipt_Screen SHALL 영수증 아래에 "세탁된 리뷰 {n}개" 제목과 세탁된 리뷰의 Review_Card 목록을 보여준다
9. THE Receipt_Screen SHALL 평점과 개수를 `/wash` 응답 값으로만 보여주고, 리뷰 목록으로 평점을 다시 계산하지 않는다

### Requirement 9: 리뷰 카드 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 리뷰 원문을 패널에서 바로 읽기, so that 쿠팡 화면을 스크롤하지 않고 근거를 확인할 수 있다

#### Acceptance Criteria

1. THE Review_Card SHALL 별점, 작성일, 구매 옵션, 사진 썸네일, 본문 전체, `quote` 강조, 세탁 태그만 보여주고 작성자 정보를 담지 않는다
2. THE Review_Card SHALL 본문을 Tab_Session의 `text` 그대로 보여준다
3. THE Review_Card SHALL 사진 썸네일을 Tab_Session `photos`의 쿠팡 이미지 주소에서 바로 불러온다
4. IF 사진을 불러오지 못하면, THEN THE Review_Card SHALL 썸네일 대신 "사진 {photos 수}장"을 보여준다
5. IF 본문이 150자를 넘으면, THEN THE Review_Card SHALL 앞 150자까지만 보여주고 "더보기" 토글로 전체 본문을 펼치고 "접기"로 다시 접는다
6. WHEN Review_Card에 `null`이 아닌 `quote`가 주어지면, THE Review_Card SHALL 본문을 펼친 상태로 보여주고 본문에서 `quote`와 같은 부분을 강조한다
7. IF 주어진 `quote`를 본문에서 찾지 못하면, THEN THE Review_Card SHALL 강조 없이 본문 전체를 보여준다
8. THE Review_Card SHALL 확실한 얼룩에 채운 점과 "확실한 얼룩", 의심 얼룩에 속이 빈 고리와 "의심 얼룩"을 신호 이름, 근거 문장과 함께 보여주고, 깨끗한 리뷰에는 세탁 태그를 붙이지 않는다
9. THE Review_Card SHALL 확실한 얼룩과 의심 얼룩을 색이 아닌 모양(채운 점, 빈 고리)으로 구분한다
10. IF 세탁 태그의 `evidence`가 `null`이면, THEN THE Review_Card SHALL 근거 문장 자리 없이 신호 이름만 보여준다

### Requirement 10: 질문 입력 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 화면 아래 입력창에 문장으로 물어보기, so that 원하는 리뷰만 골라 볼 수 있다

#### Acceptance Criteria

1. THE Question_Input SHALL 01과 03에서 이름표 "또는 직접 물어보기"와 자리 표시 문구 "예: 사진 있는 리뷰만 보여줘"를, 05에서 이름표 "이어서 물어보기"를 보여준다
2. THE Question_Input SHALL 입력을 최대 200자로 제한한다
3. WHILE 입력이 비어 있거나 공백만 있는 동안, THE Question_Input SHALL 제출 버튼을 비활성으로 둔다
4. WHILE 입고 완료가 아니거나 입고한 리뷰가 0개이거나 `/wash`·`/ask` 요청이 진행 중인 동안, THE Question_Input SHALL 제출을 막는다
5. WHEN 사용자가 Tab_Session에 세탁 결과가 없는 상태에서 질문을 제출하면, THE Side_Panel SHALL 기본 세탁을 먼저 실행해 세탁 결과를 저장한 뒤 같은 질문으로 `/ask`를 호출한다
6. WHEN 사용자가 세탁 결과가 있는 상태에서 01 또는 03에서 질문을 제출하면, THE Side_Panel SHALL 그 질문을 첫 질문으로 `/ask`에 보낸다
7. IF 세탁된 리뷰가 0개이면, THEN THE Side_Panel SHALL `/ask`를 호출하지 않고 "질문할 세탁된 리뷰가 없어요"를 보여준다
8. WHILE `/ask` 요청이 진행 중인 동안, THE Side_Panel SHALL 현재 화면 아래에 요청 말풍선과 "조건에 맞는 리뷰 찾는 중 · {경과}초" 카드(끝을 알 수 없는 진행 막대)를 보여준다

### Requirement 11: 05 부분 세탁 1단계 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want "사진 있는 리뷰만"처럼 물으면 조건에 맞는 리뷰 원문과 요약 보기, so that 리뷰 수백 개를 넘기지 않고 궁금한 것만 확인한다

#### Acceptance Criteria

1. WHEN `matches`가 비어 있지 않은 `/ask` 응답을 받으면, THE Side_Panel SHALL Core `pushStep`으로 단계를 쌓아(첫 질문이면 `resetSteps` 뒤에 쌓는다) Tab_Session `steps`에 저장하고 05를 보여준다
2. THE Side_Panel SHALL 현재 단계 `matches`의 `quote`를 패널 메모리에만 두고 Tab_Session에 저장하지 않는다
3. THE Refine_Screen SHALL 맨 위에 세탁 코스와 세탁 전 → 세탁 후 평점을 한 줄로 접은 영수증 행을 보여주고, 사용자가 이 행을 누르면 단계 스택을 그대로 둔 채 03을 보여준다
4. THE Refine_Screen SHALL 질문 요청 말풍선 아래 결과 카드에 "부분 세탁 · {label}", 큰 글씨 "{matched}개", "★{rating.average}", "{보낸 리뷰 수}개 중 조건에 맞는 리뷰"를 보여준다
5. THE Refine_Screen SHALL 결과 카드에 `summary`, `pros`, `cons`를 근거 행으로 보여주고, 빈 배열인 묶음은 그리지 않는다
6. IF `unsupported`가 `null`이 아니면, THEN THE Refine_Screen SHALL "이 부분은 적용하지 못했어요: {unsupported}"를 보여준다
7. THE Refine_Screen SHALL 결과 카드 아래에 `matches` 순서대로 Review_Card 목록을 보여주고, 각 카드에 해당 `quote`를 넘겨 강조한다
8. IF `/ask` 응답의 `matches`가 빈 배열이면, THEN THE Side_Panel SHALL 단계를 쌓지 않고 직전 화면과 직전 목록을 그대로 둔 채 "조건에 맞는 리뷰가 없어요. 리뷰에서 찾을 수 없는 질문이거나 조건이 너무 좁을 수 있어요."를 보여준다

### Requirement 12: 공정한 표현과 문구 상수 (①)

**User Story:** As a 별점세탁소 팀, I want 판정을 단정하지 않고 신호와 근거로만 보여주기, so that fairness.md와 공정위 지침을 지킨다

#### Acceptance Criteria

1. THE Copy_Constants SHALL 얼룩 이름, 신호 이름, 세탁 태그 설명, 입고 이유, 경고 문구를 모두 담고, Side_Panel은 판정 문구를 Copy_Constants에서만 가져온다
2. THE Copy_Constants SHALL 판정을 "대가성 가능성" 수준의 표현으로 쓰고 "가짜", "조작", "사기"라는 단어를 담지 않는다
3. THE Copy_Constants SHALL 신호 이름을 `platform_badge` "체험단 표시", `disclosure` "대가성 명시", `review_event` "리뷰 이벤트", `suspected` "대가성 가능성"으로 정한다
4. WHEN Side_Panel이 얼룩 이름을 보여줄 때, THE Side_Panel SHALL 같은 자리에 신호 이름과 근거 문장(`evidence`가 `null`이면 신호 이름만)을 함께 보여준다
5. THE Side_Panel SHALL 의심 얼룩을 "의심 얼룩"과 "대가성 가능성" 문구로만 부른다
6. THE Side_Panel SHALL 사이트를 글자 "쿠팡"으로만 표시하고 쿠팡 로고 이미지를 쓰지 않는다

### Requirement 13: 디자인 토큰 (①)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 누를 수 있는 곳이 한눈에 보이고 누르기 쉬운 화면, so that 좁은 사이드 패널에서도 헤매지 않는다

#### Acceptance Criteria

1. THE Side_Panel SHALL 보라색 #9046FF를 누를 수 있는 요소에만 쓰고, 나머지 요소를 회색조로 칠한다
2. THE Side_Panel SHALL 누를 수 있는 모든 요소의 누르는 영역을 가로세로 44px 이상으로 둔다
3. THE Side_Panel SHALL 주 버튼의 높이를 48px로 둔다
4. THE Side_Panel SHALL 글꼴을 "Noto Sans KR", 시스템 글꼴 순서로 지정하고 웹 글꼴 파일을 내려받지 않는다

### Requirement 14: 순수 로직 테스트 (①)

**User Story:** As a 사이드 패널 담당, I want 요청 조립과 응답 검증만 속성 기반 테스트로 확인하기, so that 사진 주소나 얼룩 리뷰가 API로 새는 실수를 빠르게 잡는다

#### Acceptance Criteria

1. THE Extension_Tests SHALL fast-check로 만든 임의 입력에서 `/wash`와 `/ask` 요청 본문의 어떤 리뷰 항목에도 `photos` 필드가 없음을 확인한다
2. THE Extension_Tests SHALL fast-check로 만든 임의 세탁 결과에서 첫 질문의 `/ask` `reviews`가 세탁된 리뷰와 같은 ID 집합이고, 이어지는 질문의 `reviews`가 세탁된 리뷰의 부분집합임을 확인한다
3. THE Extension_Tests SHALL fast-check로 만든 임의 입고 리뷰(0~150개)에서 `/wash` 요청의 `reviews`가 100개 이하임을 확인한다
4. THE Extension_Tests SHALL fast-check로 만든 임의 세탁 결과에서 재세탁 요청이 `receipt.partial: false`일 때만 `tags`를 담고, 담은 `tags`가 Core `applyStrict(저장된 tags, strict)` 결과와 같음을 확인한다
5. THE Extension_Tests SHALL 계약 모양의 `/wash`·`/ask` 응답은 응답 검증을 통과하고, 필수 필드를 하나 뺀 응답은 응답 형식 오류가 됨을 확인한다
6. WHEN `apps/extension`에 테스트 파일이 없을 때 `vitest --run`을 실행하면, THE Extension_Tests SHALL 성공으로 끝난다
7. THE Extension_Tests SHALL 순수 함수만 대상으로 하고, UI 렌더링 테스트와 E2E 테스트를 두지 않는다 (Core의 P3, P14는 Core에서 테스트한다)

### Requirement 15: 단계 쌓기, 조건 칩, 뒤로, 처음부터 (②)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 결과에 다시 질문해 목록을 계속 좁히고 한 단계씩 되돌리기, so that 원하는 리뷰를 차근차근 찾아간다

#### Acceptance Criteria

1. THE Refine_Screen SHALL 조건 칩 줄에 "세탁된 리뷰 {세탁된 리뷰 수} ★{after}"와 단계마다 "{label} {rating.count} ★{rating.average}"를 `›`로 이어 보여준다
2. WHEN 사용자가 05에서 질문을 제출하면, THE Side_Panel SHALL 그 질문을 이어지는 질문으로 `/ask`에 보낸다
3. WHEN 사용자가 마지막 조건 칩의 ✕를 누르면, THE Side_Panel SHALL API를 부르지 않고 Core `popStep`으로 한 단계를 빼서 저장된 직전 단계 결과를 `quote` 강조 없이 보여준다
4. WHEN 사용자가 "처음부터"를 누르면, THE Side_Panel SHALL Core `resetSteps`로 단계 스택을 비우고 03을 보여준다
5. WHEN `popStep` 결과로 단계 스택이 비면, THE Side_Panel SHALL 03을 보여준다
6. WHILE 단계 스택에 단계가 5개 있는 동안, THE Question_Input SHALL 제출을 막고 "단계는 5개까지 쌓을 수 있어요. 처음부터 다시 좁혀 주세요."와 "처음부터" 버튼을 보여준다
7. THE Refine_Screen SHALL "이어서 좁히기" 아래에 예시 칩 "사진 있는 리뷰만", "3점 이하만", "최근 한 달"을 보여준다
8. WHEN 사용자가 예시 칩을 누르면, THE Side_Panel SHALL 칩 문구를 이어지는 질문으로 제출한다
9. THE Side_Panel SHALL 단계 스택을 Core `pushStep`, `popStep`, `resetSteps`로만 바꾼다

### Requirement 16: 04 근거 보기 (②)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 요약 문장을 눌러 근거 리뷰 원문을 보기, so that 요약이 실제 리뷰에서 나왔는지 확인한다

#### Acceptance Criteria

1. WHEN 사용자가 03 또는 05의 근거 행을 누르면, THE Side_Panel SHALL 그 항목의 04를 보여준다
2. THE Evidence_Screen SHALL 뒤로 가기 링크를 03에서 열었으면 "세탁 영수증으로", 05에서 열었으면 "부분 세탁으로"로 보여주고, 누르면 연 화면으로 돌아간다
3. THE Evidence_Screen SHALL 고른 문장 카드, "근거 리뷰 {N}개 · 얼룩 리뷰는 근거로 쓰지 않아요", `reviewIds` 리뷰의 Review_Card 목록만 보여준다
4. WHEN 05에서 연 근거 리뷰가 현재 단계 `matches`에서 `null`이 아닌 `quote`를 가지면, THE Evidence_Screen SHALL 해당 Review_Card에 그 `quote`를 넘겨 강조한다
5. WHEN 03에서 04를 열면, THE Evidence_Screen SHALL `quote` 강조 없이 Review_Card를 보여준다

### Requirement 17: 빠진 리뷰 보기 (②)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 얼룩으로 빠진 리뷰를 따로 보기, so that 무엇이 왜 빠졌는지 직접 판단한다

#### Acceptance Criteria

1. WHEN 사용자가 03의 얼룩 요약 버튼을 누르면, THE Side_Panel SHALL Removed_Screen을 보여준다
2. THE Removed_Screen SHALL "세탁 영수증으로" 뒤로 가기 링크를 보여주고, 사용자가 누르면 03을 보여준다
3. THE Removed_Screen SHALL "세탁 태그 읽는 법" 안내 카드에 "확실한 얼룩: 평점에서 제외", "의심 얼룩: 대가성 가능성, 기본 세탁에서는 표시만", "태그가 없으면 깨끗한 리뷰예요"를 보여준다
4. THE Removed_Screen SHALL 빠진 리뷰의 Review_Card를 세탁 태그, 신호 이름, 근거 문장과 함께 보여준다
5. IF 빠진 리뷰가 0개이면, THEN THE Removed_Screen SHALL "빠진 리뷰가 없어요"를 보여준다

### Requirement 18: 07 경고 카드와 오류 화면 (②)

**User Story:** As a 평가자, I want 일부만 처리되거나 실패해도 이유와 다음 행동을 보기, so that 체험 시나리오를 멈추지 않고 이어 간다

#### Acceptance Criteria

1. IF 입고 완료가 `partial: false`인데 `receipt.partial`이 `true`이면, THEN THE Receipt_Screen SHALL "AI 판정을 다 끝내지 못했어요" Warning_Card와 "다시 세탁" 버튼을 보여주고 영수증에 "일부만 세탁됨" 알약 표시를 붙인다
2. IF 입고 중단 결과로 세탁했으면, THEN THE Receipt_Screen SHALL 영수증에 "리뷰를 {입고한 리뷰 수}개까지만 읽었어요"를 보여준다
3. IF `receipt.summary`가 빈 배열이면, THEN THE Receipt_Screen SHALL 요약 자리에 회색 막대와 "요약을 만들지 못했어요. 다시 세탁하면 채워져요." Warning_Card를 "다시 세탁" 버튼과 함께 보여준다
4. IF 요청이 429, 400이 아닌 그 밖의 4xx, 5xx, 시간 초과, 응답 형식 오류로 실패하면, THEN THE Side_Panel SHALL "잠시 후 다시 시도해 주세요" Warning_Card와 "다시 시도" 버튼을 보여준다
5. IF 요청이 400으로 실패하면, THEN THE Side_Panel SHALL "요청이 허용 범위를 넘었어요. 리뷰는 1~100개, 질문은 200자까지 보낼 수 있어요." Warning_Card를 보여준다
6. IF 요청이 네트워크 오류로 실패하면, THEN THE Side_Panel SHALL "세탁소에 연결하지 못했어요. 인터넷 연결을 확인해 주세요." Warning_Card와 "다시 시도" 버튼을 보여준다
7. IF `/wash`가 실패하면, THEN THE Side_Panel SHALL 세탁을 시작하기 전 화면으로 돌아가 그 화면에 Warning_Card를 보여준다
8. WHILE Warning_Card로 오류를 보여주는 동안, THE Side_Panel SHALL 직전 세탁 영수증과 직전 리뷰 목록을 그대로 보여준다
9. WHEN 사용자가 "다시 시도"를 누르면, THE Side_Panel SHALL 실패한 사용자 동작(세탁 또는 질문)을 같은 입력으로 다시 실행한다
10. WHEN 사용자가 Warning_Card의 "다시 세탁"을 누르면, THE Side_Panel SHALL 같은 세탁 코스로 재세탁을 시작하고 02를 보여준다
11. THE Side_Panel SHALL 모든 경고와 오류를 같은 Warning_Card 모양으로 보여준다

### Requirement 19: 06 지원하지 않는 페이지 (②)

**User Story:** As a 평가자, I want 다른 페이지에서 패널을 열었을 때 어디서 열어야 하는지 보기, so that 막히지 않고 쿠팡 상품 페이지로 옮겨 간다

#### Acceptance Criteria

1. IF 현재 탭이 쿠팡 상품 페이지가 아니면, THEN THE Side_Panel SHALL 입고를 요청하지 않고 06을 보여준다
2. THE Unsupported_Screen SHALL "세탁할 리뷰를 찾지 못했어요"와 "쿠팡 상품 페이지에서 열어 주세요. 방금 설치했다면 페이지를 새로고침해야 해요."를 보여준다
3. WHEN 사용자가 "페이지 새로고침"을 누르면, THE Side_Panel SHALL 현재 탭을 다시 로드한다
4. THE Unsupported_Screen SHALL 안내 카드에 "세탁할 수 있는 곳: 쿠팡 상품 페이지" 한 줄만 보여준다
5. THE Unsupported_Screen SHALL 이름표 "세탁 요청"인 비활성 Question_Input과 "쿠팡과 제휴하지 않은 비공식 도구예요."를 보여준다

### Requirement 20: 섬세 세탁 재세탁 (③)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 기본 세탁 결과에서 의심 얼룩까지 빼고 다시 세탁하기, so that 판정을 처음부터 다시 기다리지 않고 더 엄격한 평점을 본다

#### Acceptance Criteria

1. WHILE 세탁 결과가 기본 세탁인 동안, THE Receipt_Screen SHALL "의심 얼룩도 빼고 다시 세탁" 텍스트 버튼을 보여준다
2. WHEN 사용자가 "의심 얼룩도 빼고 다시 세탁"을 누르거나 01에서 섬세 세탁을 골라 세탁하기를 누르면, THE Side_Panel SHALL 섬세 세탁으로 재세탁을 시작하고 02를 보여준다
3. WHEN 재세탁을 시작할 때 저장된 `receipt.partial`이 `false`이면, THE Api_Client SHALL 저장된 `tags`에 Core `applyStrict(tags, strict)`를 적용한 결과를 `/wash` 요청의 `tags`에 담는다
4. WHEN 재세탁을 시작할 때 저장된 `receipt.partial`이 `true`이면, THE Api_Client SHALL `tags` 없이 `/wash`를 호출한다
5. IF `tags`를 담은 `/wash` 요청이 400으로 실패하면, THEN THE Api_Client SHALL `tags`를 뺀 같은 요청으로 `/wash`를 한 번 다시 호출한다
6. WHERE Core `applyStrict`를 아직 쓸 수 없으면, THE Side_Panel SHALL 같은 이름과 동작의 임시 함수를 패널 폴더에 두고 사용한다

### Requirement 21: 마무리 기능 (④)

**User Story:** As a 쿠팡 쇼핑 사용자, I want 사진을 크게 보고 세탁이 끝나는 순간을 보기, so that 체험이 더 분명하고 즐겁다

#### Acceptance Criteria

1. WHEN 사용자가 Review_Card의 사진 썸네일을 누르면, THE Photo_Viewer SHALL 그 사진을 패널 안에서 크게 보여주고 닫기 버튼으로 원래 목록으로 돌아간다
2. WHERE Wash_Done_Screen이 있으면, WHEN `/wash` 응답을 받으면, THE Wash_Done_Screen SHALL "세탁이 끝났어요"와 다섯 단계 모두 완료를 1.5초 동안 보여준 뒤 03을 보여준다
3. WHERE 세탁기 애니메이션이 있으면, THE Side_Panel SHALL 02와 02-2에서 세탁기 그림을 움직인다
4. WHILE 사용자 환경이 `prefers-reduced-motion: reduce`인 동안, THE Side_Panel SHALL 애니메이션 없이 정지 그림을 보여준다
5. WHERE 예시 리뷰 체험이 있으면, WHEN 사용자가 06의 "예시 리뷰로 체험하기"를 누르면, THE Side_Panel SHALL Tab_Session 대신 패널 메모리에 둔 예시 리뷰로 01~05 흐름을 시작한다
6. WHILE 예시 리뷰 체험 중인 동안, THE Side_Panel SHALL 페이지 카드와 모든 Review_Card에 "예시 리뷰" 표시를 붙인다
