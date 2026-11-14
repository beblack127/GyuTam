---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.ts", "**/*.test.tsx", "packages/core/__fixtures__/**", "scripts/eval/**"]
---

# 테스트 규칙

- 도구: Vitest + fast-check. 단발 실행은 `vitest --run`.
- 대상: `packages/core`(평점, 규칙, 검수, 조건 필터, 단계 스택)와 어댑터 파싱. UI 테스트와 E2E는 만들지 않는다.
- 테스트 데이터: `packages/core/__fixtures__`의 AI로 만든 가상 리뷰만. 실제 리뷰 원문 금지.
- 어댑터 파싱 테스트는 가상 리뷰로 만든 HTML/JSON 조각을 쓴다. 실제 쿠팡 응답을 그대로 넣지 않는다.

## Correctness property (속성 기반 테스트로 검증)
spec의 design에 아래 속성을 적고(대부분 wash-rules, P1·P2는 review-intake와 함께), 각 속성마다 fast-check 테스트를 하나씩 둔다. 테스트 이름에 속성 번호를 붙인다 (`P3: strict는 포함 집합을 줄이기만 한다`).

| 번호 | 속성 |
|---|---|
| P1 | 입고 중복 제거는 멱등이다. 두 번 해도 결과가 같고, 결과의 ID는 모두 다르다 |
| P2 | `basedOn`은 중복 제거 후 리뷰 수와 같다 |
| P3 | `strict: true`의 `include: true` 집합은 `strict: false`의 집합에 포함된다 |
| P4 | `after`는 `include: true` 리뷰 평점의 평균을 소수 첫째 자리로 반올림한 값이고, 1.0~5.0 사이이거나 `null`이다 |
| P5 | 포함 리뷰가 없을 때만 `after`가 `null`이다 |
| P6 | `evidence`가 `null`이 아니면 항상 해당 리뷰 원문에 들어 있다 |
| P7 | 원문에 없는 `evidence`를 댄 LLM 판정은 한 단계 낮아진다 (`certain` → `suspected`, `suspected` → `none`) |
| P8 | `summary`, `pros`, `cons`의 `reviewIds`는 비어 있지 않고, `/wash`에서는 `include: true` 리뷰 ID의, `/ask`에서는 `matches` ID의 부분집합이다 |
| P9 | `/ask`의 `quote`는 항상 해당 리뷰 원문에 들어 있다 |
| P10 | `stains`의 합은 얼룩으로 판정된 리뷰 수와 같고, `removed`는 `include: false` 리뷰 수와 같다 |
| P11 | 정해진 조건 필터는 정확하다: 결과의 모든 리뷰가 조건을 만족하고, 입력 중 조건을 만족하는 리뷰는 모두 결과에 있다 |
| P12 | 정해진 조건 필터는 멱등이고 순서와 무관하다: 같은 조건을 두 번 적용하거나 조건을 나눠 차례로 적용해도 결과가 같다 |
| P13 | `/ask`의 결과는 항상 입력 `reviews`의 부분집합이다. 단계를 쌓을수록 목록은 줄거나 같다 |
| P16 | `narrowSteps` 뒤에 모든 단계의 `ids`는 허용 ID의 부분집합이고, 단계 순서대로 줄거나 같다. 각 단계의 `rating`은 그 `ids`의 `averageRating`과 같다 |
| P17 | `mergeIntoStep`의 결과 `ids`는 원래 `ids`와 더한 ID의 합집합(중복 없음)이고, `rating`은 그 합집합의 `averageRating`과 같다 |
| P15 | `/ask`의 `rating.average`는 `matches` 리뷰 별점 평균의 반올림이고, `count`는 `matched`와 같다. 결과가 0개일 때만 `null` |
| P14 | 단계 스택: `popStep(pushStep(s, x))`는 `s`와 같고, `resetSteps`는 세탁된 리뷰 전체로 돌아간다. 결과가 0개인 단계는 쌓이지 않는다 |
