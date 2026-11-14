---
inclusion: always
---

# 레포 구조

```
.
├─ .kiro/
│  ├─ steering/   product · tech · structure · fairness · hackathon
│  ├─ specs/      review-intake · wash-pipeline · side-panel-receipt
│  └─ hooks/      eval-on-save · secret-scan · readme-sync
├─ apps/
│  ├─ web/        가상 리뷰 플랫폼 + /api/wash (Next.js)
│  └─ extension/  크롬 확장 (입고 어댑터, 사이드 패널, 세탁 태그)
├─ packages/core/ 타입 · 세탁 후 평점 · 규칙 판별 (+ 테스트)
├─ data/reviews/  라벨이 붙은 가상 리뷰 JSON ({targetId}.json)
├─ scripts/eval/  세탁 품질 검사
└─ README.md
```

## 배치 규칙
- 공통 타입(`Review`, `Stain`, `WashCourse`, `WashTag`, `Receipt`)은 `packages/core`에서만 정의하고 다른 곳은 import한다.
- 입고 어댑터는 `apps/extension/src/adapters/{name}.ts` 하나에 하나씩. 공통 인터페이스를 구현한다 (`mock`, `coupang`).
- LLM 프롬프트는 `apps/web`의 별도 파일로 분리한다. 라우트 핸들러에 문자열로 박지 않는다.
- 테스트 파일은 대상 옆에 `*.test.ts`로 둔다.
- 리뷰 데이터 ID 규칙: `{대상 접두사}-{3자리 번호}` (예: `pb-017`). `targetId`는 kebab-case (예: `powerbank-01`).

## 네이밍
- 파일: kebab-case. 타입/컴포넌트: PascalCase. 함수/변수: camelCase.
- 도메인 용어는 product.md의 세탁소 용어 표의 코드 식별자를 따른다.

## 문서
- `KIRO_GUIDE.md`는 참고 메모다. steering에 넣지 않는다.
- README의 품질 수치는 `scripts/eval` 결과로만 채운다.
