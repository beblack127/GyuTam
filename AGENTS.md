# AGENTS.md

별점세탁소 레포에서 작업하는 에이전트(Kiro 등)를 위한 안내다. 자세한 규칙은 `.kiro/steering/`에 있다.

## 먼저 읽을 것
| 파일 | 내용 |
|---|---|
| `.kiro/steering/product.md` | 문제, 세탁소 용어, 데모 시나리오 |
| `.kiro/steering/tech.md` | 스택, 세탁 과정 ①~⑤, `/api/wash` 계약 |
| `.kiro/steering/structure.md` | 폴더 구조, 명명 규칙 |
| `.kiro/steering/fairness.md` | 표현·근거·데이터 수집 기준 |
| `.kiro/steering/hackathon.md` | MVP 우선순위, 커밋 규칙 |

## 핵심 규칙
- 평점과 개수는 `packages/core`의 코드로 계산한다. LLM은 판정만 한다.
- "가짜 리뷰"라고 단정하지 않는다. "대가성 가능성 + 근거"로 표현한다.
- 요약 항목마다 근거 리뷰 ID가 있어야 한다.
- AWS 자격 증명과 모델 설정은 Lambda 환경에만 둔다. 확장 프로그램에 비밀 정보를 넣지 않는다.
- 실제 리뷰 원문은 `scripts/eval/data/`(git 제외)에만 둔다.
- 새 라이브러리를 추가하기 전에 먼저 묻는다.

## 작업 위치
- 세탁 API (Lambda): `apps/api`
- AWS 인프라 (CDK): `infra`
- 크롬 확장 (쿠팡·카카오맵 입고, 사이드 패널, 세탁 태그): `apps/extension`
- 타입, 평점 계산, 규칙 판별: `packages/core`
- 기능 명세: `.kiro/specs/`
