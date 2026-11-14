# 사이드 패널 (apps/extension)

```bash
npm install                                   # 레포 루트에서 한 번
npm run dev -w @star-laundry/extension        # 저장할 때마다 dist/ 다시 빌드
```

`chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → `apps/extension/dist`.
쿠팡 상품 페이지가 아닌 곳에서 패널을 열면 **예시 리뷰로 체험하기**로 전체 화면을 확인할 수 있다.

## API 주소
`apps/extension/.env`에 `VITE_API_BASE_URL`을 넣는다 (`.env.example` 참고). 비워 두면 `/wash`, `/ask` 대신 예시 응답(`src/services/api/mockData.ts`)을 쓴다. 이때 화면 오른쪽 위에 "예시 데이터"가 표시된다.

## 다른 담당과 맞물리는 곳
| 파일 | 지금 | 바꿀 때 |
|---|---|---|
| `src/types/contract.ts` | api-contract.md 타입의 임시 사본 | 코어 타입이 push되면 지우고 `@star-laundry/core`에서 import |
| `src/utils/coreFallback.ts` | `averageRating`, `applyStrict`, `pushStep`, `popStep`, `narrowSteps` 임시 구현 | 코어 함수로 교체 |
| `src/hooks/useTabSession.ts` | `chrome.storage.session`의 `tab:{tabId}`를 읽고 변경을 구독 | 입고 담당과 저장 형식 확인. `productName`, `intake.sources`는 패널이 표시만 하는 선택 필드 |
| `build.mjs` | `src/content/index.ts`가 없으면 빈 `content.js`를 만든다 | 입고 코드가 들어오면 자동으로 함께 빌드 |
