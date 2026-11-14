# Implementation Plan: side-panel-receipt

## Overview

TypeScript + React 사이드 패널. 1~9번은 커밋 `3d32b72`(feat(side-panel-receipt): 사이드 패널 화면과 예시 데이터 모드)에 이미 들어간 일을 계획 순서대로 다시 적은 것이다. 실제 코드와 design.md로 확인했고 `- [x]`로 표시했다. 10번부터는 design.md "## 코드와 요구사항의 차이 (남은 일)"의 항목을 그 절의 "우선 처리 제안" 순서대로 옮긴 남은 일이다. 각 task 끝의 `(G-…)`는 design.md 차이 목록의 ID다.

## Tasks

- [x] 1. 빌드 뼈대
  - [x] 1.1 Vite 빌드 스크립트와 패널 진입점 만들기
    - `apps/extension/build.mjs`: Vite JS API 두 번 호출(1회차 `sidepanel.html` + `src/background/index.ts` ES 모듈, 2회차 `src/content/index.ts` IIFE 단일 파일), `--watch` 지원, `configFile: false`, `@` 별칭
    - `apps/extension/package.json`(`dev`, `build`, `typecheck`), `tsconfig.json`(`jsx: react-jsx`, `types: [chrome, vite/client]`, `@/*`)
    - `sidepanel.html`, `src/sidepanel/main.tsx`(`StrictMode`, `styles/sidepanel.css` import)
    - _Requirements: 1.1, 1.2, 1.9_
  - [x] 1.2 manifest와 환경 변수 예시 만들기
    - `public/manifest.json`: MV3, 이름 "별점세탁소", 비공식 도구 `description`, `side_panel.default_path`, `background.service_worker`(module), `permissions: [sidePanel, storage, tabs]`, 쿠팡 상품 페이지 content script
    - `apps/extension/.env.example`: `VITE_API_BASE_URL=`
    - _Requirements: 1.7, 1.8_

- [x] 2. 공통 타입과 예시 데이터
  - [x] 2.1 Core 타입을 쓰는 API 응답 타입 정의
    - `src/types/api.ts`: `WashResponse`, `AskResponse`를 `@star-laundry/core`의 `WashTag`, `Receipt`, `Match`, `Cited`, `Conditions`로 조합. 패널 쪽 임시 타입 없음
    - _Requirements: 3.4, 20.6_
  - [x] 2.2 예시 리뷰와 목 응답 만들기
    - `src/services/api/mockData.ts`: AI로 쓴 가상 예시 리뷰 30여 개(`cp-1001`부터), `judge`, `mockWash`(3.2초, 재사용 0.9초), `mockAsk`(키워드 흉내), `MOCK_PRODUCT`, `MOCK_SOURCES`
    - _Requirements: 5.6, 5.7_

- [x] 3. 탭 세션과 자동 입고
  - [x] 3.1 `useTabSession` 훅 구현
    - `src/hooks/useTabSession.ts`: 활성 탭 조회, 쿠팡 상품 URL 판정, `chrome.storage.session`의 `tab:{tabId}` 읽기(`applyStored`)와 `onChanged` 반영, `intake:start` 송신, `intake:progress`·`intake:done`·`intake:error` 수신(`tabId`로 거름), `onActivated`·`onUpdated`로 탭 전환·새로고침 감지
    - _Requirements: 2.1, 2.7, 3.1, 3.2, 3.3, 3.6, 19.1_
  - [x] 3.2 예시 리뷰 체험 구현
    - `startDemo()`: 160ms마다 3개씩 진행하다 `ready`. 체험 중 `MOCK_REVIEWS`, `MOCK_SOURCES` 반환, `retryIntake()`
    - _Requirements: 5.2, 21.5_

- [x] 4. API 클라이언트
  - [x] 4.1 `wash`, `ask`, `ApiError`, `isMockApi` 구현
    - `src/services/api/washApi.ts`: `AbortController` 시간 제한, 429/400/그 밖의 오류/시간 초과/네트워크 분류, `photos` 제외(`forApi`), 재세탁 `applyStrict(reuse, strict)`, 목 응답 분기
    - 헤더는 `Content-Type`만, 비밀 정보 없음
    - _Requirements: 4.6, 20.6_

- [x] 5. 디자인 토큰과 공통 컴포넌트
  - [x] 5.1 스타일과 공통 컴포넌트 만들기
    - `src/styles/sidepanel.css`(디자인 토큰, 움직임 줄이기), `src/utils/format.ts`(`fmtRating`)
    - `src/components/common/`: `CitedList`, `ModeBar`, `Notice`, `Stars`, `StatusScreen`, `WashingMachine`
    - _Requirements: 13.1, 21.3, 21.4_

- [x] 6. 화면 흐름과 주요 화면
  - [x] 6.1 `App.tsx` 화면 상태 머신 구현
    - `src/sidepanel/App.tsx`: `View`(`home`·`washing`·`done`·`receipt`·`refine`·`error`), `runWash`, `pick`, `onAsk`, `ERROR_TEXT`, 세대 번호 `run`으로 늦은 `/wash` 응답 버리기, 헤더 로고·"예시 데이터" 배지
    - _Requirements: 2.6, 6.11, 18.9_
  - [x] 6.2 01 시작 화면 구현
    - `components/features/start/StartScreen.tsx`: 입고 진행 막대, 입고 완료·중단 안내, 기본·섬세·부분 선택지와 "?" 설명, 입고 전 비활성, 하단 안내
    - _Requirements: 6.3, 6.9_
  - [x] 6.3 02 세탁 중, 02-2 세탁 끝 화면 구현
    - `components/features/receipt/WashingScreen.tsx`(세탁기 회전, 경과 초, "세탁 그만두기"), `DoneScreen.tsx`(영수증 쪽지, 자동 넘김)
    - _Requirements: 7.4, 7.11, 21.2, 21.3_
  - [x] 6.4 03 영수증 화면 구현
    - `components/features/receipt/ReceiptView.tsx`: 코스 이름, 범위 줄, 세탁 전 → 후 평점, 얼룩 줄, 요약·장점·단점 `CitedList`, `partial`·빈 요약 `Notice`, 세탁된/빠진 리뷰 탭
    - _Requirements: 8.1, 8.7, 8.9_

- [x] 7. 리뷰 카드와 세탁 태그
  - [x] 7.1 리뷰 목록, 카드, 강조 구현
    - `components/features/review-list/ReviewList.tsx`(포커스 스크롤), `ReviewCard.tsx`(별점, 날짜, 옵션, 사진 썸네일, 본문 접기), `highlight.tsx`(겹치지 않는 `<mark>`, 원문에 없는 문구 무시)
    - `components/features/wash-tag/WashTag.tsx`: 얼룩 배지, `SIGNAL_LABEL`
    - _Requirements: 9.1, 9.2, 9.3, 9.7_

- [x] 8. 질문 입력과 05 부분 세탁 1단계
  - [x] 8.1 질문 입력과 부분 세탁 화면 구현
    - `components/features/wash-request/AskBox.tsx`: 200자 제한, 공백만이면 제출 안 함, `busy`·`disabled` 비활성
    - `components/features/refine/RefineView.tsx`: 진행 막대, 결과 카드(평균, 개수, 요약, 장점, 단점), `matches` 순서의 리뷰 목록과 `quote` 강조
    - _Requirements: 10.2, 10.3, 11.1, 11.5, 11.7_

- [x] 9. 단계 쌓기 기본 동작
  - [x] 9.1 조건 칩과 단계 스택 연결
    - `components/features/refine/StepChips.tsx`: 첫 칩, 단계 칩, 마지막 칩 ✕, "처음부터"
    - `App.tsx`: Core `pushStep`·`popStep`·`MAX_STEPS`, 바탕 세탁 기본 → 섬세 전환 때 `narrowSteps`
    - _Requirements: 15.2, 15.6_

- [ ] 10. 커밋 범위 정리
  - [ ] 10.1 `package-lock.json` 되돌리기
    - `git checkout 3d32b72~1 -- package-lock.json`으로 지워진 `"libc": [...]` 30줄을 되살리고 이 파일만 따로 커밋한다 (G-X1)
    - _Requirements: 1.9_
  - [-] 10.2 background에서 storage.session 접근 수준 열기
    - `apps/extension/src/background/index.ts`: 서비스 워커 최상위에서 `chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })`를 호출한다. `onInstalled` 안에만 두지 않아 브라우저·서비스 워커 재시작 뒤에도 다시 실행된다. 실패한 promise는 무시하고 오류 종류만 로그로 남긴다
    - 기존 `setPanelBehavior`는 그대로 둔다
    - 이유를 주석으로 적는다: content script(규리)가 `tab:{tabId}` 레코드를 직접 쓴다 (intake.md) (G-X2)
    - _Requirements: 2.1, 2.7_

- [ ] 11. 재세탁, 시간 제한, 날짜, 공정 표현
  - [ ] 11.1 재세탁 판정 재사용 조건 고치기
    - `src/sidepanel/App.tsx` `runWash`: 저장된 `washState.strict`와 새 `strict`가 다르고 `washState.receipt.partial === false`일 때만 `reuse = washState.tags`. 그 밖(같은 코스, `partial: true`, "다시 시도")은 `tags` 없이 전체 판정 (G-W1)
    - _Requirements: 20.3, 20.4, 18.10_
  - [ ] 11.2 요청별 시간 제한과 400 재시도
    - `src/services/api/washApi.ts`: `TIMEOUT_MS` 하나를 `/wash` 30초, `/ask` 20초로 나눈다. `tags`를 담은 `/wash`가 400이면 `tags`를 빼고 한 번만 다시 호출 (G-A3)
    - _Requirements: 4.8, 20.5_
  - [ ] 11.3 `/ask`의 `today`를 로컬 날짜로
    - `src/utils/format.ts`에 `localDate(now: Date): string`(`getFullYear/getMonth/getDate`, `YYYY-MM-DD`) 추가, `washApi.ts` `ask`의 `toISOString().slice(0, 10)`을 교체 (G-A2)
    - _Requirements: 4.3_
  - [ ] 11.4 공정 표현 문구를 상수로 옮기고 고치기
    - `src/constants/fairnessCopy.ts` 새로 만들기: `SIGNAL_LABEL`(`platform_badge` "체험단 표시", `disclosure` "대가성 명시", `review_event` "리뷰 이벤트", `suspected` "대가성 가능성"), `STAIN_LABEL`, 코스 설명 문구, `BANNED_WORDS`("가짜", "조작", "사기")
    - `WashTag.tsx`는 이 파일의 `SIGNAL_LABEL`을 쓴다. `StartScreen.tsx` `OPTIONS`의 "광고로 의심되는 리뷰…", "광고일 수 있는 신호", "가짜라고 단정하지 않아요"를 "대가성 가능성" 표현으로 바꾼다 (G-C2, G-C3)
    - _Requirements: 12.2, 12.3, 12.5_
  - [ ]* 11.5 공정 표현 문구 단위 테스트
    - `src/constants/fairnessCopy.test.ts`: 모든 문구 상수에 `BANNED_WORDS`가 없음, `SIGNAL_LABEL` 네 값 확인
    - _Requirements: 12.2, 12.3_

- [ ] 12. 릴리스 빌드에서 목 모드 막기
  - [ ] 12.1 목 모드를 `VITE_USE_MOCK_API`로만 켜기
    - `washApi.ts`: `isMockApi = import.meta.env.VITE_USE_MOCK_API === 'true'`. 빈 주소로 목 응답에 빠지지 않는다
    - `apps/extension/.env.example`: `VITE_API_BASE_URL=`, `VITE_USE_MOCK_API=false`와 설명 주석("비우면 예시 데이터" 문구 삭제) (G-A1, G-M1)
    - _Requirements: 1.4, 5.1_
  - [ ] 12.2 빌드 검사와 배포 API origin 넣기
    - `build.mjs`: 목 모드가 아니고 `VITE_API_BASE_URL`이 비면 변수 이름을 출력하고 `process.exit(1)`. 빌드 뒤 `dist/manifest.json`의 `host_permissions`에 `new URL(VITE_API_BASE_URL).origin + '/*'`를 더한다 (목 모드면 더하지 않음) (G-A1)
    - _Requirements: 1.5, 1.6_
  - [ ] 12.3 진입 파일이 없을 때 빌드 처리
    - `build.mjs`: background 진입 파일 존재 확인. content 진입 파일이 없으면 빈 `content.js` 대신 `dist/manifest.json`에서 `content_scripts` 항목을 빼고 경고 (G-B2)
    - _Requirements: 1.3, 1.8_

- [ ] 13. API 요청 조립과 응답 검증
  - [ ] 13.1 요청 조립 순수 함수 꺼내기
    - `src/services/api/requests.ts` 새로 만들기: `toWashReview`(허용 목록 `id, rating, date, text, badges, hasPhoto, option, source`), `toAskReview`(`badges` 제외), `buildWashBody(reviews, strict, saved?)`(앞에서 100개, `saved.receipt.partial === false`이고 `strict`가 바뀔 때만 `applyStrict` 결과 `tags`), `buildAskBody(request, now, steps, reviews)`(`trim`, `localDate`, `history`), `askTargets(tags, steps, reviews)` (G-A6, G-A7)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 13.2 응답 검증과 오류 분류 꺼내기
    - `src/services/api/validate.ts`: `isWashResponse`, `isAskResponse`(api-contract.md 필수 필드·타입, 추가 필드 허용)
    - `src/services/api/errors.ts`: `classifyStatus(status)` → `invalid`(400), `busy`(429), `client`(그 밖의 4xx), `server`(5xx), 그리고 `shape`(응답 형식 오류) 분류 추가 (G-A4, G-A5)
    - _Requirements: 4.7, 4.9_
  - [ ] 13.3 `washApi.ts`에 순수 함수 연결
    - `wash`·`ask`가 `buildWashBody`·`buildAskBody`, `classifyStatus`, `isWashResponse`·`isAskResponse`를 쓴다. 검증 실패는 `ApiError('shape')`. 옵션 인자로 외부 `AbortSignal`을 받아 내부 타이머와 함께 중단 (G-A8)
    - _Requirements: 4.7, 4.9, 4.10_
  - [ ] 13.4 패널의 요청 중단과 질문 흐름 고치기
    - `App.tsx`: 세탁 그만두기·탭 전환 때 `AbortController.abort()`. `onAsk`도 세대 번호를 확인해 늦은 `/ask` 결과를 버린다. 01·03에서 질문하면 Core `resetSteps` 뒤 첫 질문, 05에서는 이어지는 질문(`askTargets` 사용). `ERROR_TEXT`에 `client`, `shape` 문구 추가 (G-A8, G-A9)
    - `quotes` 갱신을 `src/utils/steps.ts`의 `pushQuotes`, `popQuotes`, `resetQuotes`로 꺼낸다
    - _Requirements: 2.6, 4.4, 4.10, 7.8, 10.6, 11.1, 11.2_
  - [ ] 13.5 목 데이터의 Core 함수 사본 지우기
    - `mockData.ts`의 `averageRating`, `applyStrict` 사본을 지우고 `@star-laundry/core`에서 import (G-M3)
    - _Requirements: 5.6, 20.6_

- [ ] 14. 탭 세션에 세탁 결과와 단계 저장
  - [ ] 14.1 `useTabSession`이 `productId`, `wash`, `steps`를 읽게 하기
    - `useTabSession.ts`: `StoredTab`에 `productId`, `wash`, `steps` 추가, `TabSession`에 `productId`, `storedWash`, `storedSteps` 노출
    - _Requirements: 2.2, 2.5_
  - [ ] 14.2 세탁 결과·단계 저장과 복원
    - `App.tsx`: `/wash` 응답을 요청을 시작한 탭의 `tab:{tabId}`에 `{ strict, tags, receipt }`로, 단계 변경 때 `steps`를 쓴다(읽고 `wash`, `steps`만 바꿔 쓰기, `quote`는 저장 안 함). 열 때 단계가 있으면 05, 세탁 결과만 있으면 03으로 복원. 초기화 effect는 `reviews.length` 대신 `productId` 변화로 판단 (G-S1, G-S2)
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 11.2_

- [ ] 15. 순수 로직 테스트
  - [ ] 15.1 Vitest 설정
    - `apps/extension/vitest.config.ts`: `include: ['src/**/*.test.ts']`, `passWithNoTests: true`, `@` 별칭. 실행은 `npx vitest --run` (G-B3, G-T1)
    - _Requirements: 14.6, 14.7_
  - [ ] 15.2 Property 1 속성 테스트
    - **Property 1: API로 가는 리뷰 항목은 허용 필드만 담는다**
    - `src/services/api/requests.fields.test.ts`, fast-check `numRuns: 100`
    - **Validates: Requirements 4.2, 4.5, 14.1**
  - [ ] 15.3 Property 2 속성 테스트
    - **Property 2: `/wash` 리뷰는 입고 순서대로 최대 100개**
    - `src/services/api/requests.limit.test.ts`
    - **Validates: Requirements 4.1, 14.3**
  - [ ] 15.4 Property 3 속성 테스트
    - **Property 3: 질문 대상 목록**
    - `src/services/api/requests.targets.test.ts`
    - **Validates: Requirements 4.4, 14.2**
  - [ ] 15.5 Property 4 속성 테스트
    - **Property 4: 질문 문자열과 날짜**
    - `src/services/api/requests.ask.test.ts`
    - **Validates: Requirements 4.3**
  - [ ] 15.6 Property 5 속성 테스트
    - **Property 5: 재세탁은 완전한 판정만 재사용한다**
    - `src/services/api/requests.reuse.test.ts`
    - **Validates: Requirements 14.4, 20.3, 20.4**
  - [ ] 15.7 Property 6 속성 테스트
    - **Property 6: 응답 검증**
    - `src/services/api/validate.test.ts`
    - **Validates: Requirements 4.7, 14.5**
  - [ ]* 15.8 Property 9 속성 테스트
    - **Property 9: 오류 분류**
    - `src/services/api/errors.test.ts`
    - **Validates: Requirements 4.9**
  - [ ]* 15.9 Property 7 속성 테스트
    - **Property 7: 강조는 원문을 바꾸지 않는다**
    - `src/components/features/review-list/highlight.test.ts`
    - **Validates: Requirements 9.2, 9.6, 9.7**
  - [ ]* 15.10 Property 10 속성 테스트
    - **Property 10: quote 목록은 단계 스택과 함께 움직인다**
    - `src/utils/steps.test.ts`
    - **Validates: Requirements 11.2, 15.3**
  - [ ]* 15.11 API 클라이언트 예시 테스트
    - `src/services/api/washApi.test.ts`: 가짜 타이머로 `/wash` 30초·`/ask` 20초 시간 초과, `tags` 담은 400의 재시도 1회
    - _Requirements: 4.8, 20.5_

- [ ] 16. Checkpoint - 테스트 통과 확인
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. 화면 차이 ① (요구사항 6~13)
  - [ ] 17.1 01 대기 화면 맞추기
    - `StartScreen.tsx`: 페이지 카드("지금 보는 페이지 · 쿠팡", 상품명), 코스 라디오 두 개 + "세탁하기" 주 버튼, 안내 "베스트순 50 + 최신순 50…", 입고 문구, 하단 안내. `App.tsx` 헤더에 "+" 버튼("새 세탁") (G-U1)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.11, 6.12, 6.13_
  - [ ] 17.2 입고 예외와 목 모드 시작 처리
    - `useTabSession.ts`: `intake:start` 송신 실패면 `unsupported`(06), 0개로 끝난 입고는 `ready`(리뷰 0개), 탭 제목에서 " | 쿠팡"을 뺀 `productName`, 목 모드면 쿠팡 페이지가 아니어도 예시 리뷰로 입고 (G-S3, G-S4, G-S5, G-M4)
    - _Requirements: 3.5, 5.2, 5.3, 6.2, 6.10_
  - [ ] 17.3 02 세탁 중 화면 맞추기
    - `WashingScreen.tsx`: 요청 말풍선, 5단계 표시(접수·입고·판정·검수·영수증), 끝을 알 수 없는 진행 막대, "얼룩 판정 중 · {경과}초", 임시 영수증(Core `averageRating`, `detectCertainStains`), Question_Input 비활성 안내, 버튼 "세탁 중단" (G-U2)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.8, 7.9_
  - [ ] 17.4 03 영수증 화면 맞추기
    - `src/utils/format.ts`에 `ratingDelta(before, after)` 추가("변화 없음", `null`이면 문구 없음), `ReceiptView.tsx`의 `delta()`를 교체. `null` 평점 "계산할 리뷰 없음", 범위 두 줄 형식, 얼룩 요약 버튼 "확실한 얼룩 {N}개 제외", 요약 제목 "세탁 후 요약 · 문장을 누르면 근거 리뷰로 이동" (G-U4)
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 17.5 Property 8 속성 테스트
    - **Property 8: 평점 차이 표시**
    - `src/utils/format.test.ts`
    - **Validates: Requirements 8.2, 8.3**
  - [ ] 17.6 리뷰 카드와 세탁 태그 맞추기
    - `ReviewCard.tsx`: 접는 기준 150자, 사진 로드 실패 시 "사진 {n}장", `quote`가 있으면 펼치기, 출처 표시 제거. `WashTag.tsx`: 근거 문장(`evidence`) 표시, `null`이면 생략 (G-U5, G-C5)
    - _Requirements: 9.1, 9.4, 9.5, 9.6, 9.8, 9.10, 12.4_
  - [ ] 17.7 01·03 질문 입력 붙이기
    - `AskBox.tsx`: 보이는 이름표 "또는 직접 물어보기". `StartScreen.tsx`, `ReceiptView.tsx`에 AskBox 배치. `App.tsx`: 세탁 결과 없이 질문하면 기본 세탁 뒤 같은 질문 전송, 세탁된 리뷰 0개면 `/ask` 없이 안내, 진행 중 요청 말풍선과 경과 초 (G-U6)
    - _Requirements: 10.1, 10.4, 10.5, 10.6, 10.7, 10.8_
  - [ ] 17.8 05 부분 세탁 화면 맞추기
    - `RefineView.tsx`: 접힌 영수증 행, 결과 카드 "부분 세탁 · {label}", "{matched}개", "{보낸 리뷰 수}개 중…", `unsupported`·`matches: []` 문구 (G-U7)
    - _Requirements: 11.3, 11.4, 11.6, 11.8_
  - [ ] 17.9 흩어진 문구를 상수로 모으기
    - `src/constants/fairnessCopy.ts`로 `StartScreen.tsx` `REASON`(요구사항 문구로: `blocked` "요청 차단" 등), `App.tsx` `ERROR_TEXT`, 각 화면의 판정·경고 문구를 옮긴다 (G-C1, G-C4)
    - _Requirements: 6.5, 12.1_
  - [ ] 17.10 디자인 토큰 맞추기
    - `sidepanel.css`: 글꼴 `"Noto Sans KR", system-ui, …`, 주 버튼 높이 48px, 누르는 영역 최소 44px, 확실한 얼룩 채운 점·의심 얼룩 고리 모양 구분 (G-U14)
    - _Requirements: 9.9, 13.2, 13.3, 13.4_
  - [ ] 17.11 목 시나리오 10개와 선택 메뉴
    - `mockData.ts`에 시나리오 10개(정상, `partial`, 빈 요약, `matches: []`, 429, 400, 5xx, 시간 초과, 네트워크, 응답 형식 오류), `App.tsx` 목 모드 헤더에 선택 메뉴 (G-M2)
    - _Requirements: 5.4, 5.5_

- [ ] 18. 화면 차이 ② (요구사항 15~19)
  - [ ] 18.1 조건 칩, 뒤로, 처음부터 맞추기
    - `StepChips.tsx`: 첫 칩 평점을 `receipt.after`로, "처음부터" 문구. `RefineView.tsx`: 예시 칩 "사진 있는 리뷰만", "3점 이하만", "최근 한 달"을 "이어서 좁히기" 아래에 두고 누르면 바로 이어지는 질문으로 제출, 5단계 안내. `App.tsx`: "처음부터"는 `resetSteps` 뒤 03, ✕로 비면 03, ✕ 뒤 `quote` 강조 없음 (G-U8)
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_
  - [ ] 18.2 04 근거 보기 화면
    - `src/components/features/evidence/EvidenceScreen.tsx` 새로 만들기(뒤로 가기 링크, 문장 카드, "근거 리뷰 {N}개 · 얼룩 리뷰…", 05에서 열면 `quote` 강조). `App.tsx`에 `evidence` view 추가, 근거 행 클릭을 스크롤 대신 04로 연결 (G-U9)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  - [ ] 18.3 빠진 리뷰 화면
    - `src/components/features/receipt/RemovedScreen.tsx` 새로 만들기("세탁 영수증으로" 링크, "세탁 태그 읽는 법" 카드, 빠진 리뷰 카드, 0개 안내). `ReceiptView.tsx`의 탭을 지우고 얼룩 요약 버튼으로 연결, `App.tsx`에 `removed` view (G-U10)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  - [ ] 18.4 07 경고 카드
    - `src/components/common/WarningCard.tsx` 새로 만들기. `App.tsx`: `/wash` 실패 시 직전 화면·영수증·목록을 유지한 채 카드 표시, 요구사항 오류 문구. `ReceiptView.tsx`: `partial`·빈 요약·입고 중단에 카드와 "다시 세탁". `RefineView.tsx`: `/ask` 실패에 "다시 시도" (G-U11)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11_
  - [ ] 18.5 06 지원하지 않는 페이지
    - `src/components/features/start/UnsupportedScreen.tsx` 새로 만들기("세탁할 리뷰를 찾지 못했어요", "페이지 새로고침" 버튼, 안내 카드, 비활성 "세탁 요청" 입력, 예시 리뷰 체험 버튼). `App.tsx`의 `unsupported` 분기를 교체 (G-U12)
    - _Requirements: 19.2, 19.3, 19.4, 19.5_

- [ ] 19. 화면 차이 ③ (요구사항 20)
  - [ ] 19.1 "의심 얼룩도 빼고 다시 세탁" 버튼
    - `ReceiptView.tsx`: 기본 세탁 결과일 때 버튼 표시. `App.tsx`: 누르면 `runWash(true, 'receipt')` (G-U4)
    - _Requirements: 20.1, 20.2_

- [ ] 20. 화면 차이 ④ (요구사항 21)
  - [ ] 20.1 사진 크게 보기
    - `src/components/features/review-list/PhotoViewer.tsx` 새로 만들기, `ReviewCard.tsx` 썸네일 클릭 연결 (G-U13)
    - _Requirements: 21.1_
  - [ ] 20.2 예시 리뷰 표시
    - `StartScreen.tsx` 페이지 카드와 `ReviewCard.tsx`에 체험 중 "예시 리뷰" 표시 (G-U13)
    - _Requirements: 21.6_
  - [ ] 20.3 02-2 세탁 끝 시간과 재사용 세탁
    - `DoneScreen.tsx` 1.5초로, `App.tsx`에서 판정 재사용 세탁에도 02-2를 거치게 한다 (G-U3)
    - _Requirements: 21.2_

- [ ] 21. Final checkpoint - 테스트 통과 확인
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*`가 붙은 task는 선택 작업이다. 시간이 없으면 건너뛴다.
- 자르는 순서(hackathon.md): 사진 크게 보기 → "?" 상세 설명 → 부분 세탁 중 섬세 → 기본 바탕 전환 → 섬세 세탁 → 품질 검사 스크립트 → 단계 쌓기(1단계 질문만 남김). 이 spec에서는 20(④) → 19(③) → 18.1(단계 쌓기) 순으로 자른다. 끝까지 남길 것: 자동 입고, 시작 화면, 기본 세탁(평점·요약·리뷰 카드), 부분 세탁 1단계. ③을 자르면 섬세 세탁은 `strict: true` 전체 세탁만 하고 "의심 얼룩도 빼고 다시 세탁" 버튼은 숨긴다.
- 커밋 메시지: `feat(side-panel-receipt): <번호> <요약>` (예: `feat(side-panel-receipt): 11.2 요청별 시간 제한`). 10.1은 lock 파일만 담아 따로 커밋한다.
- `npm install`을 하지 않는다. `package.json`, `package-lock.json`은 재현만 바꾼다.
- 규리 폴더(`apps/extension/src/content`, `src/services/adapters`)와 재현 폴더(`packages/core`, `scripts/eval`, 공통 `package.json`·`package-lock.json`, steering)는 고치지 않는다. `src/background`는 규리 요청(2026-11-14 16:50)으로 정민 담당이 됐다.
- 코드가 아닌 일 (지금 바로):
  - 재현에게 `@types/react`, `@types/react-dom` 설치를 요청한다 (G-B1). `apps/extension`에 `vitest`·`fast-check` 의존성과 `test` 스크립트(`vitest --run`) 추가도 같이 요청한다 (G-B3). 그 전까지는 루트 `node_modules`의 것으로 `npx vitest --run`을 쓴다.
  - `src/background/index.ts`는 규리 요청(2026-11-14 16:50)으로 정민(side-panel-receipt) 파일이 됐다. `setPanelBehavior`와 `storage.session` 접근 수준 설정(10.2)을 정민이 맡는다 (G-X2). `src/content`, `src/services/adapters`는 계속 규리 폴더다.
  - 주영에게 배포 API 주소를 받는다 (12.2에 필요).
  - 11.4, 17.9의 문구는 커밋 전에 `fairness-reviewer` 검토를 받는다.
- 화면 01~07은 목 모드와 확장 로드로 수동 확인한다. UI 렌더링 테스트와 E2E는 하지 않는다 (Req 14.7).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["10.1", "10.2", "11.1", "11.2", "11.4", "12.2", "13.2", "13.5", "15.1"] },
    { "id": 1, "tasks": ["11.3", "11.5", "12.3", "14.1", "15.7", "15.8", "15.9"] },
    { "id": 2, "tasks": ["12.1", "13.1"] },
    { "id": 3, "tasks": ["13.3", "15.2", "15.3", "15.4", "15.5", "15.6"] },
    { "id": 4, "tasks": ["13.4", "15.11"] },
    { "id": 5, "tasks": ["14.2", "15.10"] },
    { "id": 6, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.6", "17.8", "17.10"] },
    { "id": 7, "tasks": ["17.5", "17.7"] },
    { "id": 8, "tasks": ["17.9"] },
    { "id": 9, "tasks": ["17.11"] },
    { "id": 10, "tasks": ["18.1"] },
    { "id": 11, "tasks": ["18.2"] },
    { "id": 12, "tasks": ["18.3"] },
    { "id": 13, "tasks": ["18.4"] },
    { "id": 14, "tasks": ["18.5", "20.1"] },
    { "id": 15, "tasks": ["19.1", "20.2"] },
    { "id": 16, "tasks": ["20.3"] }
  ]
}
```
