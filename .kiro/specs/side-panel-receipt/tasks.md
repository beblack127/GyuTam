# Implementation Plan: side-panel-receipt

## Overview

TypeScript + React로 사이드 패널을 hackathon.md 우선순위대로 만든다. 11:20 계약 확정 전에도 화면이 돌도록 빌드 골격, 임시 계약 타입(`contractTypes.ts`), 목 API부터 만든다. 그다음 P0(입고 진행률, 세탁하기, 영수증)를 끝내고 근거 아코디언·하이라이트 → 부분 세탁 → 섬세 세탁 토글 → 탭 메모리 복원·오류 화면 다듬기 순서로 붙인다. 16:30 기능 동결에 맞춘 MVP 범위다.

- 새 라이브러리(`vite`, `@vitejs/plugin-react`, `@crxjs/vite-plugin`, `@types/chrome`, `@types/react`, `@types/react-dom`, 선택 사항 fast-check)는 **팀 승인 후에만 설치한다**. 승인 전에는 `package.json`에 적지 않는다.
- P0 핵심 로직 테스트(응답 검증, 요청 조립, Api_Client, Tab_Memory 키, reducer)는 필수다. 그 밖의 테스트는 `*`로 표시한 선택 작업이다.
- fast-check가 승인되지 않으면 테스트 파일 안의 시드 고정 난수 생성 함수로 속성마다 100회 반복한다(design.md "속성 테스트 방법").
- `background`, `runtimeMessages.ts`, `productKey.ts`, manifest는 입고·태그 담당과 합의한 뒤 커밋한다.

## Tasks

- [ ] 1. 빌드 골격과 계약 타입
  - [ ] 1.1 확장 빌드 골격 만들기
    - **먼저 팀 승인**: `vite`, `@vitejs/plugin-react`, `@crxjs/vite-plugin`, `@types/chrome`, `@types/react`, `@types/react-dom` 추가 여부를 묻고, 승인된 뒤에 설치한다
    - 루트 `package.json`(npm workspaces)이 없으면 팀에 알리고 만든다(design.md "의존성과 미결 사항")
    - `apps/extension/package.json`(`@star-laundry/extension`, 스크립트 `build`, `test: vitest --run`; `dev`는 사용자가 직접 실행), `tsconfig.json`(strict, `@/*` 경로)
    - `vite.config.ts`: `react()`, `crx({ manifest })`, `VITE_API_BASE_URL`·`VITE_USE_MOCK_API` 외 `VITE_*` 변수가 있으면 빌드 실패, vitest `src/**/*.test.ts`
    - `manifest.config.ts`: MV3, `description`(쿠팡, 카카오와 제휴하지 않은 비공식 도구 문구), `side_panel.default_path`, background, 쿠팡 상품 content script, `permissions: ["sidePanel", "storage"]`, host 권한(목 모드에서는 API origin 제외). `public/`에는 아이콘만 둔다
    - `src/sidepanel/index.html`, `main.tsx`, 빈 `App.tsx`, `src/background/index.ts`에 `openPanelOnActionClick: true`만 (입고·태그 담당과 합의)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [ ] 1.2 임시 계약 타입과 메시지 타입 정의
    - `services/api/contractTypes.ts`: tech.md 계약을 옮긴 `Review`, `WashTag`, `Receipt`, `WashRequest`(선택 `tags`), `WashResponse`, `AskRequest`, `AskResponse`. 확장 코드는 항상 이 파일에서 import한다
    - `sidepanel/runtimeMessages.ts`: `PanelToContentMessage`, `ContentToPanelMessage`, 응답 타입, `IntakeAbortReason`, `isContentToPanelMessage` (입고·태그 담당과 합의할 초안)
    - `sidepanel/productKey.ts`: `parseProductKey(url)` → `coupang:{productId}` 또는 `null`
    - _Requirements: 1.5, 6.4, 11.3_
  - [ ] 1.3 공정한 표현 상수 만들기
    - `constants/fairnessCopy.ts`: `STAIN_LABEL`, `SIGNAL_LABEL`, `RECEIPT_COPY`, `INTAKE_COPY`, `ASK_COPY`, `ERROR_COPY`, `EVIDENCE_COPY`, `DISCLAIMER`, `BANNED_WORDS`, `describeTag`
    - 컴포넌트는 판정 문구를 직접 쓰지 않고 이 파일만 쓴다
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 2. Api_Client와 목 API
  - [ ] 2.1 응답 검증 타입 가드 구현
    - `services/api/validateResponse.ts`: `isWashResponse`, `isAskResponse` (필수 필드·타입·`stain`/`signal` 값·`after: number | null`·`reviewIds` 문자열 배열, 추가 필드 허용)
    - _Requirements: 10.6, 11.3_
  - [ ] 2.2 응답 검증 속성 테스트
    - **Property 5: 응답 검증은 계약에 맞는 값을 통과시키고 어긋난 값을 거부한다**
    - tech.md 예시 JSON, `after: null`, `summary: []`, `matches: []` 예시 포함
    - **Validates: Requirements 10.6, 11.3**
  - [ ] 2.3 요청 조립 구현
    - `services/api/buildRequests.ts`: `MAX_WASH_REVIEWS = 100`, `buildWashRequest(reviews, strict, prevWash)`(strict만 바뀌고 같은 ID 집합일 때만 `tags` 포함), `buildAskRequest(reviews, tags, request)`(`include: true`만, 입고 순서, `trim()`, 0개면 `null`)
    - _Requirements: 3.1, 3.5, 4.2, 4.3, 7.2, 7.8_
  - [ ] 2.4 세탁 요청 조립 속성 테스트
    - **Property 1: 세탁 요청은 입고 순서대로 최대 100개와 토글 값을 담는다**
    - 리뷰 0개, 100개, 101개 경계 포함
    - **Validates: Requirements 3.1, 3.5, 4.2**
  - [ ] 2.5 판정 재사용 조건 속성 테스트
    - **Property 2: 판정 재사용은 strict만 바뀌고 리뷰 집합이 같을 때만 일어난다**
    - **Validates: Requirements 4.3**
  - [ ] 2.6 부분 세탁 요청 조립 속성 테스트
    - **Property 6: 부분 세탁 요청은 include: true 리뷰만 입고 순서대로 담는다**
    - **Validates: Requirements 7.2, 7.8**
  - [ ] 2.7 Api_Client와 API 설정 구현
    - `services/api/apiClient.ts`: `ApiError`, `ApiResult`, `Transport`, `createApiClient(config, transport)`, `classifyHttpStatus`, `WASH_TIMEOUT_MS = 30_000`, `ASK_TIMEOUT_MS = 20_000`
    - 예외를 던지지 않고 `ApiResult` 반환, 헤더는 `Content-Type`만, `credentials: 'omit'`, 호출자 abort는 결과 버림, `tags` 포함 요청의 400은 `tags` 없이 한 번 재호출
    - `services/api/apiConfig.ts`: `import.meta.env`에서 두 변수만 읽어 `apiClient` 생성 (`baseUrl` 하드코딩 금지)
    - _Requirements: 1.3, 4.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.3, 11.4, 11.5_
  - [ ] 2.8 400 폴백 속성 테스트
    - **Property 3: tags 포함 요청의 400은 tags 없이 정확히 한 번 다시 호출한다**
    - **Validates: Requirements 4.4, 10.2**
  - [ ] 2.9 오류 분류 속성 테스트와 시간 초과 예시 테스트
    - **Property 4: HTTP 상태와 transport 실패는 정해진 오류 종류로 분류된다**
    - 가짜 타이머로 `/wash` 30초·`/ask` 20초 시간 초과, 헤더가 `Content-Type` 하나뿐, URL이 `baseUrl + "/wash"`
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 11.5**
  - [ ] 2.10 목 API 구현
    - `services/api/mockData.ts`, `mockTransport.ts`: 시나리오 `normal`, `after_null`, `summary_empty`, `partial`, `matches_empty`, `network_error`, `bad_request`, `timeout`, `invalid_shape`. 태그와 `reviewIds`는 요청 리뷰 ID로 만든다
    - `MockScenarioPicker.tsx`: 목 모드에서만 렌더링하는 select
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 3. 패널 상태와 Tab_Memory 키
  - [ ] 3.1 Tab_Memory 키 함수 구현
    - `sidepanel/tabMemoryKey.ts`: `tabMemoryKey`, `tabMemoryPrefix`, `parseTabMemoryKey`
    - _Requirements: 8.1, 8.3, 8.4_
  - [ ] 3.2 Tab_Memory 키 속성 테스트
    - **Property 11: Tab_Memory 키는 되돌릴 수 있고 탭 접두사는 다른 탭과 겹치지 않는다**
    - `tab:1:` vs `tab:12:` 예시 포함
    - **Validates: Requirements 8.1, 8.3, 8.4**
  - [ ] 3.3 panelReducer와 셀렉터 구현
    - `sidepanel/panelReducer.ts`: `PanelState`, `PanelAction`, `initialState`, `panelReducer`, `selectScreen`, `selectCanWash`
    - target이 다른 액션 무시, `TARGET_CHANGED`는 `strict` 유지, `WASH_STARTED`·`WASH_FAILED`는 `wash.result` 유지
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 3.2, 8.3, 10.7_
  - [ ] 3.4 세탁하기 활성 조건 속성 테스트
    - **Property 8: 세탁하기 버튼은 입고가 끝나고 리뷰가 있을 때만 활성화된다**
    - 입고 0개 안내 예시 포함
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.6**
  - [ ] 3.5 세탁 중 잠금과 직전 영수증 유지 속성 테스트
    - **Property 9: 세탁 중에는 조작이 잠기고 실패해도 직전 영수증이 남는다**
    - **Validates: Requirements 3.2, 10.7**
  - [ ] 3.6 다른 탭·상품 액션 무시 속성 테스트
    - **Property 10: 다른 탭·상품의 액션은 상태를 바꾸지 않는다**
    - **Validates: Requirements 8.3**

- [ ] 4. Checkpoint - 핵심 로직 테스트 통과 확인
  - `npm run test -w apps/extension`(`vitest --run`)으로 P0 테스트가 모두 통과하는지 확인한다. 질문이 생기면 사용자에게 묻는다.

- [ ] 5. P0 화면: 입고 진행률, 세탁하기, 영수증
  - [ ] 5.1 영수증 포맷 함수 구현
    - `components/features/receipt/receiptFormat.ts`: `formatIntakeProgress`, `formatRating`, `formatDelta`
    - _Requirements: 2.1, 5.3, 5.4, 5.9_
  - [ ]* 5.2 영수증 포맷 속성 테스트
    - **Property 13: 영수증 표시 값은 API 응답 값을 그대로 담는다**
    - `before 4.8, after 4.3 → "-0.5"`, 차이 0 → `"±0.0"`
    - **Validates: Requirements 2.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.9**
  - [ ] 5.3 Receipt_View 컴포넌트 구현
    - `ReceiptView.tsx`, `RatingCompare.tsx`, `StainCounts.tsx`, `SummarySection.tsx` (summary·pros·cons, 근거 링크 자리는 일단 리뷰 수만 표시)
    - `after: null`, `partial: true`, `summary: []` 안내는 `RECEIPT_COPY` 사용
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  - [ ] 5.4 입고 표시와 공용 컴포넌트 구현
    - `components/features/intake/IntakeProgress.tsx`, `UnsupportedPageNotice.tsx`
    - `components/common/ErrorNotice.tsx`(이유 + 다시 시도 버튼, 기본형), `PanelFooter.tsx`(`DISCLAIMER`), `common/index.ts`
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 9.5, 10.1_
  - [ ] 5.5 usePanelController 기본 흐름 구현
    - `sidepanel/usePanelController.ts`: 현재 탭 추적(`tabs.query`, `onActivated`, `onUpdated`) → `TARGET_CHANGED`, 진행 중 요청 abort
    - `intake/start` 전송(실패 시 `INTAKE_ABORTED { reason: 'unavailable' }`), `runtime.onMessage`에서 `isContentToPanelMessage` + `sender.tab.id` 확인 후 dispatch
    - 목 모드에서는 Content_Script 없이 가짜 입고 진행률과 가상 리뷰를 dispatch
    - `actions.wash()`: `buildWashRequest` → `apiClient.wash` → `WASH_SUCCEEDED`/`WASH_FAILED` → 성공 시 `tags/apply` 전송
    - 콘솔에는 오류 종류와 메시지 `type`만 남긴다
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.4, 8.3, 8.6_
  - [ ] 5.6 세탁하기 버튼과 App 화면 분기 연결
    - `components/features/wash-request/WashControls.tsx`: 세탁하기 버튼(토글은 10.1에서 추가)
    - `App.tsx`: `selectScreen`별 분기, 세탁 중 로딩, 오류 + 직전 영수증, `MockScenarioPicker`, `PanelFooter`
    - _Requirements: 2.3, 2.5, 3.2, 10.7, 11.2_

- [ ] 6. Checkpoint - 목 모드로 P0 동작 확인
  - 테스트가 통과하고 `npm run build -w apps/extension`이 성공하는지 확인한다. `dist/manifest.json`에 MV3, 사이드 패널 HTML, service worker, content script가 있는지 본다. 질문이 생기면 사용자에게 묻는다.

- [ ] 7. Checkpoint - 계약 전환 (core 타입과 배포 API)
  - 11:20 계약이 확정되고 `@star-laundry/core`가 타입을 내보내면, `contractTypes.ts` 내용을 `export type { ... } from '@star-laundry/core';` 한 줄로 바꾸고 `package.json`에 워크스페이스 의존성을 추가한다. 타입 차이가 있으면 core를 따르고 `validateResponse.ts`·`mockData.ts`를 맞춘다. core가 검증 함수를 내보내면 `validateResponse.ts`는 그것을 다시 내보낸다.
  - infra 담당이 API를 배포하면 `VITE_USE_MOCK_API=false`, `VITE_API_BASE_URL=<배포 주소>`로 빌드하고 manifest host 권한에 API origin이 들어갔는지 확인한다.
  - 테스트가 모두 통과하는지 확인한다. 질문이 생기면 사용자에게 묻는다.
  - _Requirements: 1.3, 1.5, 11.3, 11.4_

- [ ] 8. 근거 아코디언과 하이라이트
  - [ ] 8.1 근거 표시 컴포넌트 구현
    - `components/common/StainBadge.tsx`(`describeTag` 사용), `EvidenceAccordion.tsx`(평점·날짜·본문·세탁 태그, `notInDom` 안내), `EvidenceLink.tsx`
    - _Requirements: 6.1, 6.3, 9.3, 9.4_
  - [ ] 8.2 근거 클릭 흐름 연결
    - `SummarySection.tsx`에 `EvidenceLink`·`EvidenceAccordion` 연결
    - `usePanelController.ts`에 `actions.openEvidence(reviewId)`: `EVIDENCE_TOGGLED` → `evidence/focus` 전송, `found: false`나 전송 실패면 `EVIDENCE_NOT_IN_DOM`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 8.3 세탁 태그 설명 속성 테스트
    - **Property 14: 세탁 태그 설명은 의심 수준을 드러내고 근거가 없으면 신호 이름을 쓴다**
    - **Validates: Requirements 9.3, 9.4**
  - [ ]* 8.4 금지 표현 속성 테스트
    - **Property 15: 판정 문구 상수에는 단정 표현이 없다**
    - **Validates: Requirements 9.2**

- [ ] 9. 부분 세탁
  - [ ] 9.1 세탁 요청 입력 정규화 구현
    - `components/features/wash-request/washRequestInput.ts`: `normalizeRequestInput`(200자), `canSubmitRequest`
    - _Requirements: 7.1, 7.7_
  - [ ]* 9.2 세탁 요청 입력 속성 테스트
    - **Property 7: 세탁 요청 입력은 200자로 제한되고 공백만 있으면 제출할 수 없다**
    - **Validates: Requirements 7.1, 7.7**
  - [ ] 9.3 부분 세탁 입력·결과 컴포넌트 구현
    - `WashRequestInput.tsx`(글자 수, 제출 비활성), `AskResultView.tsx`(`topics`, `matched`, 요약 + 근거 링크, `quote`, `matches: []`일 때 안내와 예시 질문, 깨끗한 리뷰 없음 안내)
    - _Requirements: 7.1, 7.4, 7.6, 7.7, 7.8_
  - [ ] 9.4 부분 세탁 흐름 연결
    - `usePanelController.ts`에 `actions.ask()`: 세탁 결과 없으면 `strict: false` 세탁 먼저 → `buildAskRequest` → `null`이면 `ASK_SKIPPED` → `apiClient.ask` → `ASK_SUCCEEDED` 후 `matches/highlight` 전송
    - `App.tsx`에 부분 세탁 영역 배치(ask 오류는 이 영역 안의 `ErrorNotice`)
    - _Requirements: 7.2, 7.3, 7.5, 7.8_

- [ ] 10. 섬세 세탁 토글
  - [ ] 10.1 "의심 얼룩도 빼기" 토글과 판정 재사용 연결
    - `WashControls.tsx`에 토글 추가(`STRICT_TOGGLED`, 세탁 중 비활성)
    - `usePanelController.ts`의 세탁이 `state.strict`와 직전 `wash.result`를 `buildWashRequest`에 넘기는지 확인 (`tags` 재사용, 400 폴백은 2.3·2.7에서 구현됨)
    - `ReceiptView.tsx`에 `RECEIPT_COPY.strictBadge` 표시
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 11. 탭 메모리 복원
  - [ ] 11.1 Tab_Memory 저장소 구현
    - `sidepanel/tabMemory.ts`: `createTabMemory(area)`(`load`, `saveIntake`, `saveWash`, `removeTab`), `version: 1`이 아니면 `null`, 쓰기 실패는 오류 종류만 로그
    - `chrome.storage.session`만 사용
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - [ ]* 11.2 Tab_Memory 저장소 속성 테스트
    - **Property 12: Tab_Memory는 저장한 값을 돌려주고 탭 삭제는 그 탭 키만 지운다**
    - 메모리 내 가짜 storage 사용, 이전 `version` 값은 `null`
    - **Validates: Requirements 8.1, 8.2, 8.4**
  - [ ] 11.3 복원·저장·탭 삭제 연결
    - `usePanelController.ts`: 대상 변경 시 `load` → 있으면 `MEMORY_RESTORED` 후 `tags/apply` 재전송, 없으면 입고 시작. `intake/done`·`aborted` 때 `saveIntake`, 세탁 성공 때 `saveWash`
    - `background/index.ts`: `chrome.tabs.onRemoved`에서 `removeTab(tabId)` (입고·태그 담당과 합의)
    - _Requirements: 3.3, 8.1, 8.2, 8.3, 8.4_

- [ ] 12. 오류 화면 다듬기
  - [ ] 12.1 오류 종류별 안내와 다시 시도 마무리
    - `ErrorNotice.tsx`: `ApiError.kind`별 `ERROR_COPY`(network, bad_request 허용 범위, wash/ask 시간 초과, server, invalid_response)
    - `usePanelController.ts`: 마지막 명령을 `useRef`에 두고 다시 시도, 목 모드가 아닌데 `baseUrl`이 비면 세탁 전에 오류 표시
    - 코드에 `chrome.storage.local`, `localStorage`, 리뷰를 담은 `console.*`가 없는지 검색해 정리
    - _Requirements: 8.5, 8.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 13. Final checkpoint - 전체 테스트와 빌드 확인
  - 테스트가 모두 통과하고 배포 API로 빌드한 확장이 로드되는지 확인한다. 질문이 생기면 사용자에게 묻는다.

## Notes

- `*` 표시 작업은 선택이다. P0 핵심 로직 테스트(2.2, 2.4~2.6, 2.8, 2.9, 3.2, 3.4~3.6)는 필수다.
- 새 라이브러리는 팀 승인 전에 설치하지 않는다(1.1). fast-check도 같다.
- 16:30 기능 동결 이후에는 버그 수정과 배포 확인만 한다. 시간이 모자라면 12 → 10 순서로 범위를 줄인다. 11(탭 메모리 복원)은 tech.md의 "같은 탭, 같은 상품은 한 번만 입고한다" 차단 방지 규칙과 연결되므로 줄이지 않는다.
- 각 작업은 requirements.md의 조항 번호를 참조한다.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.7", "3.2", "3.3"] },
    { "id": 3, "tasks": ["2.5", "2.8", "2.10", "3.4", "5.1"] },
    { "id": 4, "tasks": ["2.6", "2.9", "3.5", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 5, "tasks": ["3.6", "5.6"] },
    { "id": 6, "tasks": ["8.1", "8.3", "9.1", "11.1"] },
    { "id": 7, "tasks": ["8.2", "8.4", "9.2", "9.3", "11.2"] },
    { "id": 8, "tasks": ["9.4"] },
    { "id": 9, "tasks": ["10.1"] },
    { "id": 10, "tasks": ["11.3"] },
    { "id": 11, "tasks": ["12.1"] }
  ]
}
```
