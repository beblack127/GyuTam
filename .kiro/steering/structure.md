---
inclusion: always
---

# 레포 구조

별점세탁소는 크롬 확장, Lambda 세탁 API, 공통 코어, CDK 인프라로 나뉜 모노레포다. 최상위는 `apps/`, `packages/`로 나누고, 각 앱 안은 같은 `src/` 규칙을 따른다.

## 전체 디렉터리 구조

```
.
├── AGENTS.md                         # 에이전트 가이드
├── README.md
├── LICENSE
├── .kiro/
│   ├── specs/                        # wash-rules · wash-llm · review-intake · side-panel-receipt
│   ├── steering/                     # always: product·tech·structure·fairness·hackathon / fileMatch: intake·api-contract·testing / auto: kakaomap / manual: kiro-evidence
│   ├── hooks/                        # secret-scan · guard-shell · eval-on-save · readme-sync · task-start · task-done · session-context
│   ├── agents/                       # fairness-reviewer · kiro-evidence-writer
│   ├── skills/                       # add-site-adapter · tune-wash-prompt
│   └── settings/                     # mcp.example.json (mcp.json은 커밋하지 않음)
├── apps/
│   ├── extension/                    # 크롬 확장 (Manifest V3)
│   │   ├── public/                   # manifest.json, icons/
│   │   └── src/
│   │       ├── background/           # service worker (사이드 패널 열기, 메시지 중계)
│   │       ├── content/              # content script (입고, 세탁 태그, 근거 하이라이트)
│   │       ├── sidepanel/            # 사이드 패널 진입점
│   │       ├── components/
│   │       │   ├── common/
│   │       │   └── features/
│   │       │       ├── wash-request/ # 세탁 요청 입력
│   │       │       ├── receipt/      # 세탁 영수증, 평점 애니메이션
│   │       │       ├── review-list/  # 리뷰 원문 목록, quote 강조, 페이지에서 보기
│   │       │       ├── refine/       # 조건 칩, 뒤로, 처음부터
│   │       │       └── wash-tag/     # 리뷰 옆 판정 배지
│   │       ├── services/
│   │       │   ├── adapters/         # 입고 어댑터 (coupangAdapter.ts, 다음 단계 kakaomapAdapter.ts)
│   │       │   └── api/              # POST /wash, POST /ask 클라이언트
│   │       ├── hooks/ types/ utils/ constants/ styles/
│   └── api/                          # 세탁 API (AWS Lambda)
│       └── src/
│           ├── handlers/             # Lambda 진입점 (washHandler.ts, askHandler.ts)
│           ├── services/
│           │   ├── wash/             # 세탁하기·부분 세탁 과정 조립 (washPipeline.ts, askPipeline.ts)
│           │   └── llm/              # Bedrock 클라이언트, 응답 스키마 검증
│           ├── prompts/              # LLM 프롬프트 (본세탁, 세탁 후 요약, 질문 해석, 의미 조건 고르기)
│           ├── dev/                  # 통합용 로컬 API 서버 (배포 전 확장 연결)
│           └── utils/
├── packages/core/                    # 순수 함수만 (DOM, fs, 네트워크 금지)
│   ├── src/
│   │   ├── types/                    # Review, Stain, Signal, WashCourse, WashTag, Receipt
│   │   ├── rating/                   # 세탁 전·후 평점, 얼룩 수 계산 (검수)
│   │   ├── rules/                    # 규칙 기반 확실한 얼룩 탐지 (애벌빨래), evidence·quote 원문 확인
│   │   ├── filter/                   # 정해진 조건 필터, 단계 스택 (pushStep, popStep, resetSteps)
│   │   └── utils/
│   └── __fixtures__/                 # AI로 만든 가상 리뷰 (단위 테스트 전용)
├── infra/                            # AWS CDK (API Gateway, Lambda, 요청 제한, Budgets)
│   ├── bin/
│   └── lib/
├── scripts/hooks/                    # hook이 실행하는 검사 스크립트
├── scripts/eval/                     # 세탁 품질 검사
│   └── data/                         # 실제 리뷰 원문, HTML 스냅샷 (git 제외, 로컬 전용)
└── docs/                             # KIRO.md(Kiro 활용 기록), eval-history.md, 아키텍처 그림
```

## 배치 규칙
- 확장과 API가 같이 쓰는 타입은 `packages/core/src/types`에만 정의한다. 앱의 `types/`에는 그 앱에서만 쓰는 타입을 둔다.
- 평점과 개수 계산은 `packages/core/src/rating`에만 둔다. 앱 코드에서 다시 계산하지 않는다.
- 입고 어댑터는 `apps/extension/src/services/adapters/`에 하나에 하나씩 두고 공통 인터페이스를 구현한다.
- LLM 프롬프트는 `apps/api/src/prompts/`에 둔다. 핸들러에 문자열로 박지 않는다.
- 기능 하나에만 쓰는 컴포넌트는 `components/features/<feature>/`, 두 기능 이상에서 쓰면 `components/common/`.
- 테스트 파일은 대상 파일 옆에 `*.test.ts(x)`로 둔다. 별도 `tests/` 폴더와 E2E 테스트는 만들지 않는다.
- 실제 리뷰 원문은 `scripts/eval/data/` 밖에 두지 않는다.

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
| 테스트용 가상 리뷰 | `{대상}.json` | `__fixtures__/powerbank.json` |

- 함수·변수는 camelCase, 타입·컴포넌트는 PascalCase.
- 도메인 용어는 product.md 세탁소 용어 표의 코드 식별자를 따른다.

## 임포트 순서

```typescript
// 1. Node.js 내장 모듈
// 2. 외부 패키지 (react, @aws-sdk …)
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
- 확장 프로그램 코드에 비밀 정보, Bedrock 호출 코드 금지.
- `scripts/eval/data/`의 파일을 커밋하지 않는다.

## 문서
- `KIRO_GUIDE.md`는 참고 메모다. steering에 넣지 않는다.
- README의 품질 수치는 `scripts/eval` 결과로만 채운다.
