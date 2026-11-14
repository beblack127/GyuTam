---
inclusion: fileMatch
fileMatchPattern: ["apps/api/**", "packages/core/**", "apps/extension/src/services/api/**", "apps/extension/src/sidepanel/**", "apps/extension/src/components/**", "infra/**"]
---

# API 계약

공통 타입은 `packages/core/src/types`에만 정의한다. 담당: 재현(코어 타입, 필터, 검증), 주영(API). 아래 계약이 바뀌면 이 파일과 타입을 같은 커밋에서 고친다.

## 세탁하기 `POST /wash`
1. 애벌빨래: `packages/core/rules`가 확실한 얼룩을 찾는다 (플랫폼 배지, 대가성 명시 문구).
2. 본세탁: 경량 모델이 리뷰별로 `stain`, `signal`, `evidence`를 판정한다. 25개씩 나눠 병렬 호출한다.
3. 검수: 코드로 `evidence` 원문 포함 여부를 확인하고, 세탁 전·후 평점과 얼룩 수를 계산한다.
4. 세탁 후 요약: 상위 모델이 `include: true`인 리뷰만 받아 `summary`(2~3문장)와 장점·단점을 만든다. 코드가 `reviewIds`를 검증한다.

요청
```json
{ "site": "coupang", "strict": false,
  "reviews": [{ "id": "cp-123456", "rating": 5, "date": "2026-10-21", "text": "...", "badges": ["체험단"], "hasPhoto": false, "option": "블랙 / 10000mAh", "source": "best" }] }
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

## 부분 세탁 `POST /ask` (조건을 계속 좁혀 가기)
사용자는 자유로운 문장으로 조건을 입력한다. 결과는 요약과 함께 **조건에 맞는 리뷰 원문 목록**으로 사이드 패널에 뜬다. 그 목록에 다시 질문하면 그 안에서 더 좁힌다.

### 흐름
1. 해석: 경량 모델이 질문을 `conditions`로 바꾼다. 정해진 조건과 의미 조건으로 나눈다.
2. 정해진 조건 필터: `packages/core/src/filter`가 코드로 거른다. LLM은 거르지 않는다.
3. 의미 조건 고르기: 의미 조건이 있을 때만, 남은 리뷰를 25개씩 나눠 경량 모델이 고르고 원문 문장(`quote`)을 근거로 댄다.
4. 검수: `quote`가 원문에 있는지, ID가 입력에 있는지 코드로 확인한다. 실패한 항목은 버린다.
5. 평균 별점: 코드가 결과 리뷰의 평균 별점을 계산한다 (`/wash`와 같은 평점 함수).
6. 요약: 상위 모델이 결과 리뷰로 `summary`(2~3문장)와 장점·단점(`pros`, `cons`)을 쓴다. 결과가 0개면 요약하지 않는다. 결과가 4개 미만이면 `pros`, `cons`는 비우고 `summary`만 쓴다.

### 조건
| 종류 | 필드 | 예시 질문 | 처리 |
|---|---|---|---|
| 정해진 | `rating: { min?, max? }` | "3점 이하만", "5점 빼고" | 코드 |
| 정해진 | `date: { from?, to? }` (YYYY-MM-DD) | "최근 한 달", "올해 리뷰만" | 코드. 상대 날짜는 요청의 `today` 기준으로 해석 |
| 정해진 | `hasPhoto: boolean` | "사진 있는 리뷰만" | 코드 |
| 정해진 | `source: "best" \| "latest"` | "최신 리뷰만" | 코드 |
| 정해진 | `option: string[]` | "블랙 산 사람만" | 코드 (구매 옵션 문자열 포함 여부) |
| 정해진 | `includes: string[]`, `excludes: string[]` | "'환불' 들어간 리뷰", "배송 얘기 빼고" 중 정확한 단어 | 코드 (원문 포함 여부) |
| 의미 | `semantic: string \| null` | "무게 관련", "발볼 넓은 사람", "아이 키우는 집", "오래 써 본 사람" | LLM + `quote` 검증 |

- 한 질문에 여러 조건이 섞여도 된다: "3점 이하 중에 발열 얘기만" → `rating.max: 3` + `semantic: "발열"`.
- 해석할 수 없는 부분은 버리지 말고 `unsupported`에 담아 화면에 "이 부분은 적용하지 못했어요"로 보여준다.
- `label`은 조건 칩에 표시할 짧은 문구다 ("3점 이하 · 발열").

### 요청
```json
{
  "site": "coupang",
  "request": "그중에 3점 이하이고 발열 얘기한 것만",
  "today": "2026-11-14",
  "history": ["사진 있는 리뷰만"],
  "reviews": [{ "id": "cp-3", "rating": 2, "date": "2026-10-02", "text": "...", "hasPhoto": true, "option": "블랙 / 10000mAh", "source": "latest" }]
}
```
- `reviews`: 현재 목록(직전 단계의 결과)만 보낸다. 첫 질문이면 세탁된 리뷰(`include: true`) 전체.
- `photos`(사진 URL)는 확장에만 두고 `/wash`, `/ask` 어디에도 보내지 않는다. API는 `hasPhoto`만 받는다.
- `history`: 앞 단계의 질문들. "그중에", "아니 4점 이상으로" 같은 말을 해석하는 데만 쓴다. 필터는 `reviews`에만 적용한다.

### 응답
```json
{
  "conditions": { "rating": { "max": 3 }, "semantic": "발열" },
  "label": "3점 이하 · 발열",
  "unsupported": null,
  "matches": [{ "id": "cp-3", "quote": "30분 쓰니까 손으로 못 잡을 만큼 뜨거워요" }],
  "matched": 4,
  "rating": { "average": 2.3, "count": 4 },
  "summary": [{ "text": "...", "reviewIds": ["cp-3"] }],
  "pros": [{ "text": "...", "reviewIds": ["cp-3"] }],
  "cons": [{ "text": "...", "reviewIds": ["cp-8"] }]
}
```
- 정해진 조건으로만 고른 리뷰는 `quote: null`.
- `rating.average`는 코드가 계산한 값이다. 소수 첫째 자리 반올림, 결과가 0개면 `null`.
- 결과가 0개면 `matches: []`, `summary: []`, `pros: []`, `cons: []`. 확장은 이 단계를 쌓지 않고 직전 목록을 그대로 둔다.
- 리뷰와 관련 없는 질문(예: "배송 언제 와?")이면 `matches: []`와 "리뷰에서 찾을 수 없는 질문" 안내.

### 단계 쌓기 (확장 쪽, API는 상태 없음)
- 확장은 단계 스택을 탭 메모리에 둔다: `[{ request, label, conditions, ids, rating, summary, pros, cons }]`. 상태 변경 로직은 `packages/core/src/filter`의 순수 함수(`pushStep`, `popStep`, `resetSteps`)로 만든다.
- 화면: 조건 칩 줄(`세탁된 리뷰 96 ★4.3 › 사진 있음 31 ★4.1 › 3점 이하 · 발열 4 ★2.3`), 그 아래 평균 별점, 요약, 장점·단점, 그 아래 리뷰 카드 목록.
- 마지막 칩의 ✕ = 한 단계 뒤로 (저장된 직전 결과를 그대로 보여주고 API를 다시 부르지 않는다). "처음부터" = 세탁된 리뷰 전체로.
- 중간 칩 삭제는 MVP에서 지원하지 않는다.
- 단계는 최대 5개. 넘으면 "처음부터"를 안내한다.

## 공통 규칙
- LLM 출력은 JSON으로 받고 스키마 검증 후 사용한다. 검증에 실패한 판정 묶음은 애벌빨래 결과로 대신한다.
- 입력에 없는 ID, `include: false`인 리뷰 ID는 요약 근거에서 지운다. 남은 근거가 없는 문장은 버린다.
- 요약 호출이 실패하거나 시간이 모자라면 `summary: []`로 두고 평점과 태그는 그대로 보여준다.
- 시간 예산: API Gateway 통합 제한 29초. `/wash`는 본세탁 20초 + 요약 7초 안팎. `/ask`는 해석 3초 + 의미 조건 고르기 10초 + 요약 5초 안팎이고, 의미 조건이 없으면 고르기를 건너뛴다. 본세탁이 20초를 넘기면 남은 리뷰는 애벌빨래 결과로 대신하고 `partial: true`.
- 입력 검증: `reviews` 1~100개, `text`는 리뷰당 최대 2,000자, `request`는 최대 200자, `history`는 최대 5개. 넘으면 400.
- 평점은 소수 첫째 자리까지 반올림한다. 빼고 남은 리뷰가 없으면 `after: null`이고 UI는 "계산할 리뷰 없음"을 표시한다.
- 리뷰 수를 100개보다 늘리려면 먼저 사용하는 Bedrock 모델의 계정 할당량(분당 요청 수, 토큰 수)을 Service Quotas에서 확인하고, 배포 환경에서 `/wash` 응답 시간을 잰다.

