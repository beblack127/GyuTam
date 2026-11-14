---
inclusion: always
---

# 기술 스택

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript (strict) |
| 모노레포 | npm workspaces (`apps/*`, `packages/*`) |
| 확장 | Chrome Extension Manifest V3, Side Panel API, Content Script |
| 웹·API | Next.js (App Router). 가상 리뷰 플랫폼 + `/api/wash` 라우트. Vercel 배포 |
| LLM | Amazon Bedrock (Claude). 대체 API 키는 서버 `.env` |
| 테스트 | Vitest (코어 로직, 어댑터 파싱) |

## 아키텍처 규칙
- 확장 프로그램은 LLM을 직접 호출하지 않는다. 항상 `/api/wash`를 거친다.
- 평점, 개수, 비율 계산은 `packages/core`의 순수 함수로 한다. LLM 응답의 숫자는 쓰지 않는다.
- 세탁 과정: ① 접수(요청 해석) → ② 애벌빨래(규칙 기반 탐지) → ③ 본세탁(LLM 리뷰별 판정) → ④ 검수(코드로 계산) → ⑤ 영수증(근거 포함 요약).
- LLM 출력은 JSON으로 받고 스키마 검증 후 사용한다. 검증 실패 시 규칙 기반 결과로 대체한다.
- `packages/core`는 브라우저, Node 양쪽에서 돌아야 한다. DOM, `fs`, 네트워크 의존 금지.

## API 계약 (초안)
`POST /api/wash`
- 요청: `{ request: string, category: "product" | "place", reviews: { id, rating, date, text }[] }`
- 응답: `{ course: { exclude, topics }, tags: { id, stain, topics, include, evidence }[], receipt: { basedOn, before, after, stainsRemoved: { explicit, hidden }, matched, pros, cons } }`
- `pros`/`cons` 항목: `{ text, reviewIds: string[] }`

## 보안
- API 키는 서버 `.env`에만 둔다. 확장 프로그램 코드, 클라이언트 번들, 커밋에 절대 넣지 않는다.
- `.env.example`에 키 이름만 적는다.

## 명령어 (구현 후 갱신)
- 테스트: `npm test --workspaces` (Vitest는 `vitest --run`으로 단발 실행)
- 품질 검사: `scripts/eval` 실행
