---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.ts", "**/*.test.tsx", "packages/core/__fixtures__/**", "scripts/eval/**"]
---

# 테스트 규칙

- 도구: Vitest + fast-check. 단발 실행은 `vitest --run`.
- 대상: `packages/core`(평점, 규칙, 검수)와 어댑터 파싱. UI 테스트와 E2E는 만들지 않는다.
- 테스트 데이터: `packages/core/__fixtures__`의 AI로 만든 가상 리뷰만. 실제 리뷰 원문 금지.
- 어댑터 파싱 테스트는 가상 리뷰로 만든 HTML/JSON 조각을 쓴다. 실제 쿠팡 응답을 그대로 넣지 않는다.

## Correctness property (속성 기반 테스트로 검증)
spec의 design에 아래 속성을 적고, 각 속성마다 fast-check 테스트를 하나씩 둔다. 테스트 이름에 속성 번호를 붙인다 (`P3: strict는 포함 집합을 줄이기만 한다`).

| 번호 | 속성 |
|---|---|
| P1 | 입고 중복 제거는 멱등이다. 두 번 해도 결과가 같고, 결과의 ID는 모두 다르다 |
| P2 | `basedOn`은 중복 제거 후 리뷰 수와 같다 |
| P3 | `strict: true`의 `include: true` 집합은 `strict: false`의 집합에 포함된다 |
| P4 | `after`는 `include: true` 리뷰 평점의 평균을 소수 첫째 자리로 반올림한 값이고, 1.0~5.0 사이이거나 `null`이다 |
| P5 | 포함 리뷰가 없을 때만 `after`가 `null`이다 |
| P6 | `evidence`가 `null`이 아니면 항상 해당 리뷰 원문에 들어 있다 |
| P7 | 원문에 없는 `evidence`를 댄 LLM 판정은 한 단계 낮아진다 (`certain` → `suspected`, `suspected` → `none`) |
| P8 | `summary`, `pros`, `cons`의 `reviewIds`는 항상 `include: true` 리뷰 ID의 부분집합이고, 비어 있지 않다 |
| P9 | `/ask`의 `quote`는 항상 해당 리뷰 원문에 들어 있다 |
| P10 | `stains`의 합은 얼룩으로 판정된 리뷰 수와 같고, `removed`는 `include: false` 리뷰 수와 같다 |
