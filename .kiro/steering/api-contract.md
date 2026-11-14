---
inclusion: fileMatch
fileMatchPattern: ["apps/api/**", "packages/core/**", "apps/extension/src/services/api/**", "apps/extension/src/sidepanel/**", "apps/extension/src/components/**", "infra/**"]
---

# API 계약

공통 타입은 `packages/core/src/types`에만 정의한다. 아래 계약이 바뀌면 이 파일과 타입을 같은 커밋에서 고친다.

## 세탁하기 `POST /wash`
1. 애벌빨래: `packages/core/rules`가 확실한 얼룩을 찾는다 (플랫폼 배지, 대가성 명시 문구).
2. 본세탁: 경량 모델이 리뷰별로 `stain`, `signal`, `evidence`를 판정한다. 25개씩 나눠 병렬 호출한다.
3. 검수: 코드로 `evidence` 원문 포함 여부를 확인하고, 세탁 전·후 평점과 얼룩 수를 계산한다.
4. 세탁 후 요약: 상위 모델이 `include: true`인 리뷰만 받아 `summary`(2~3문장)와 장점·단점을 만든다. 코드가 `reviewIds`를 검증한다.

요청
```json
{ "site": "coupang", "strict": false,
  "reviews": [{ "id": "cp-123456", "rating": 5, "date": "2026-10-21", "text": "...", "badges": ["체험단"], "source": "best" }] }
```
응답
```json
{
  "tags": [{ "id": "cp-123456", "stain": "certain", "signal": "platform_badge", "evidence": null, "include": false }],
  "receipt": {
    "basedOn": 96, "sources": { "best": 50, "latest": 50, "duplicates": 4 },
    "before": 4.8, "after": 4.3,
    "stains": { "platform_badge": 18, "disclosure": 7, "review_event": 0, "suspected": 6 },
    "removed": 25, "partial": false,
    "summary": [{ "text": "...", "reviewIds": ["cp-3", "cp-21"] }],
    "pros": [{ "text": "...", "reviewIds": ["cp-1"] }],
    "cons": [{ "text": "...", "reviewIds": ["cp-2"] }]
  }
}
```
- `strict`: 섬세 세탁이면 `true`. 의심 얼룩도 `include: false`가 된다.
- `signal`: `"platform_badge" | "disclosure" | "review_event" | "suspected"`. `stain: "none"`이면 `signal`, `evidence`는 `null`.
- `strict`만 바꿔 다시 세탁할 때 확장은 판정을 재사용할 수 있다. 이때는 평점과 요약만 다시 계산한다 (요청에 `tags`를 같이 보내면 본세탁을 건너뛴다).

## 부분 세탁 `POST /ask`
1. 접수: 상위 모델이 질문에서 `topics`를 뽑는다.
2. 고르기: 같은 호출에서 주제를 말한 리뷰와 그 문장(`quote`)을 고른다.
3. 검수: `quote`가 원문에 있는지, ID가 입력에 있는지 코드로 확인한다. 실패한 항목은 버린다.
4. 요약: 그 주제에 대한 `summary`(2~3문장)와 근거 리뷰 ID.

요청: `{ "site": "coupang", "request": "무게 관련 리뷰만 보여줘", "reviews": [/* include: true인 리뷰만 */] }`
응답: `{ "topics": ["무게"], "matches": [{ "id": "cp-3", "quote": "..." }], "matched": 14, "summary": [{ "text": "...", "reviewIds": ["cp-3"] }] }`
- 주제와 관련 없는 질문(예: "배송 언제 와?")이면 `matches: []`와 함께 "리뷰에서 찾을 수 없는 질문"이라는 안내를 돌려준다.

## 공통 규칙
- LLM 출력은 JSON으로 받고 스키마 검증 후 사용한다. 검증에 실패한 판정 묶음은 애벌빨래 결과로 대신한다.
- 입력에 없는 ID, `include: false`인 리뷰 ID는 요약 근거에서 지운다. 남은 근거가 없는 문장은 버린다.
- 요약 호출이 실패하거나 시간이 모자라면 `summary: []`로 두고 평점과 태그는 그대로 보여준다.
- 시간 예산: API Gateway 통합 제한 29초. `/wash`는 본세탁 20초 + 요약 7초 안팎, `/ask`는 15초 안에 끝낸다. 본세탁이 20초를 넘기면 남은 리뷰는 애벌빨래 결과로 대신하고 `partial: true`.
- 입력 검증: `reviews` 1~100개, `text`는 리뷰당 최대 2,000자, `request`는 최대 200자. 넘으면 400.
- 평점은 소수 첫째 자리까지 반올림한다. 빼고 남은 리뷰가 없으면 `after: null`이고 UI는 "계산할 리뷰 없음"을 표시한다.
- 리뷰 수를 100개보다 늘리려면 먼저 사용하는 Bedrock 모델의 계정 할당량(분당 요청 수, 토큰 수)을 Service Quotas에서 확인하고, 배포 환경에서 `/wash` 응답 시간을 잰다.

