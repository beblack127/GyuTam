---
inclusion: always
---

# 레포 구조

별점세탁소는 크롬 확장, Next.js 웹·API, 공통 코어로 나뉜 모노레포다. 최상위는 `apps/`, `packages/`로 나누고, 각 앱 안은 같은 `src/` 규칙을 따른다.

## 전체 디렉터리 구조

```
.
├── AGENTS.md                         # 에이전트 가이드
├── README.md
├── .kiro/
│   ├── specs/                        # review-intake · wash-pipeline · side-panel-receipt
│   ├── steering/                     # product · tech · structure · fairness · hackathon
│   ├── hooks/                        # eval-on-save · secret-scan · readme-sync
│   ├── agents/                       # Custom Agent
│   ├── skills/                       # 반복 Skill
│   └── settings/                     # MCP 등 설정 (mcp.json은 커밋하지 않음)
├── apps/
│   ├── web/                          # 가상 리뷰 플랫폼 + 세탁 API (Next.js App Router)
│   │   ├── public/                   # 정적 에셋 (가상 브랜드 이미지)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (platform)/shop/[targetId]/   # 쇼핑 탭 상품 페이지
│   │       │   ├── (platform)/place/[targetId]/  # 장소 탭 매장 페이지
│   │       │   └── api/wash/route.ts             # POST /api/wash
│   │       ├── components/
│   │       │   ├── common/           # Button, Tabs, StarRating …
│   │       │   └── features/
│   │       │       ├── shop/         # 상품 상세
│   │       │       ├── place/        # 매장 상세
│   │       │       └── review/       # 리뷰 목록, 리뷰 카드 (data-* 속성 렌더링)
│   │       ├── services/
│   │       │   ├── wash/             # 세탁 과정 ①~⑤ 조립 (washPipeline.ts)
│   │       │   └── llm/              # Bedrock 클라이언트, 응답 스키마 검증
│   │       ├── prompts/              # LLM 프롬프트 (접수, 본세탁, 영수증)
│   │       ├── hooks/ types/ utils/ constants/ styles/
│   └── extension/                    # 크롬 확장 (Manifest V3)
│       ├── public/                   # manifest.json, icons/
│       └── src/
│           ├── background/           # service worker (사이드 패널 열기, 메시지 중계)
│           ├── content/              # content script (입고, 세탁 태그, 근거 하이라이트)
│           ├── sidepanel/            # 사이드 패널 진입점
│           ├── components/
│           │   ├── common/
│           │   └── features/
│           │       ├── wash-request/ # 세탁 요청 입력
│           │       ├── receipt/      # 세탁 영수증, 평점 애니메이션
│           │       └── wash-tag/     # 리뷰 옆 판정 배지
│           ├── services/
│           │   ├── adapters/         # 입고 어댑터 (mockAdapter.ts, coupangAdapter.ts)
│           │   └── api/              # /api/wash 클라이언트
│           ├── hooks/ types/ utils/ constants/ styles/
├── packages/core/src/                # 순수 함수만 (DOM, fs, 네트워크 금지)
│   ├── types/                        # Review, Stain, WashCourse, WashTag, Receipt
│   ├── rating/                       # 세탁 전·후 평점, 얼룩 수 계산 (④ 검수)
│   ├── rules/                        # 규칙 기반 얼룩 탐지 (② 애벌빨래)
│   ├── course/                       # 세탁 요청 규칙 해석 보조 (① 접수)
│   └── utils/
├── data/reviews/                     # 라벨이 붙은 가상 리뷰 ({targetId}.json)
├── scripts/eval/                     # 세탁 품질 검사
└── docs/                             # 발표 자료, 아키텍처 그림
```

## 배치 규칙
- 확장과 서버가 같이 쓰는 타입은 `packages/core/src/types`에만 정의한다. 앱의 `types/`에는 그 앱에서만 쓰는 타입을 둔다.
- 평점과 개수 계산은 `packages/core/src/rating`에만 둔다. 앱 코드에서 다시 계산하지 않는다.
- 입고 어댑터는 `apps/extension/src/services/adapters/`에 하나에 하나씩 두고 공통 인터페이스를 구현한다.
- LLM 프롬프트는 `apps/web/src/prompts/`에 둔다. 라우트 핸들러에 문자열로 박지 않는다.
- 기능 하나에만 쓰는 컴포넌트는 `components/features/<feature>/`, 두 기능 이상에서 쓰면 `components/common/`.
- 테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다. 별도 `tests/` 폴더와 E2E 테스트는 만들지 않는다.
- 리뷰 데이터 ID: `{대상 접두사}-{3자리 번호}` (예: `pb-017`). `targetId`는 kebab-case (예: `powerbank-01`).

## 파일 명명 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 폴더 | kebab-case | `wash-request/` |
| 컴포넌트 파일 | PascalCase | `ReceiptCard.tsx` |
| 훅 파일 | camelCase, `use` 접두사 | `useWashRequest.ts` |
| 유틸리티·서비스 | camelCase | `calcWashRating.ts`, `coupangAdapter.ts` |
| 상수 파일 | camelCase | `stainKeywords.ts` |
| 타입 파일 | camelCase | `reviewTypes.ts` |
| 테스트 파일 | 원본 파일명 + `.test` | `calcWashRating.test.ts` |
| 스타일 파일 | 컴포넌트명 + `.module.css` | `ReceiptCard.module.css` |
| Next.js 라우트 | 프레임워크 규칙 | `page.tsx`, `route.ts`, `layout.tsx` |
| 리뷰 데이터 | `{targetId}.json` | `powerbank-01.json` |

- 함수·변수는 camelCase, 타입·컴포넌트는 PascalCase.
- 도메인 용어는 product.md 세탁소 용어 표의 코드 식별자를 따른다.

## 임포트 순서

```typescript
// 1. Node.js 내장 모듈
// 2. 외부 패키지 (react, next …)
// 3. 워크스페이스 패키지 (@star-laundry/core)
// 4. 앱 내부 절대 경로 (@/components, @/services …)
// 5. 상대 경로
```

## 컴포넌트 파일 구조

```typescript
// 1. 임포트
// 2. 타입 정의
// 3. 상수 (컴포넌트 외부)
// 4. 컴포넌트 본체 (export default 마지막)
// 5. 헬퍼 함수 (컴포넌트 외부)
```

## 금지 패턴
- `src/` 최상위에 임시 파일 생성 금지 (`temp.ts`, `test2.tsx` 등)
- 순환 의존성 금지. `packages/core`는 `apps/*`를 import하지 않는다.
- `index.ts` barrel 파일은 `components/common`과 `packages/core/src/index.ts` 같은 공개 경계에만 둔다.
- 확장 프로그램 코드에 API 키, LLM 호출 코드 금지.

## 문서
- `KIRO_GUIDE.md`는 참고 메모다. steering에 넣지 않는다.
- README의 품질 수치는 `scripts/eval` 결과로만 채운다.
