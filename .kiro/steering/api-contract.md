---
inclusion: fileMatch
fileMatchPattern: ["apps/api/**", "packages/core/**", "apps/extension/src/services/api/**", "apps/extension/src/sidepanel/**", "apps/extension/src/components/**", "infra/**"]
---

# API 계약

공통 타입은 `packages/core/src/types`에만 정의한다. 담당: 재현(코어 타입, 필터, 검증), 주영(API). 아래 계약이 바뀌면 이 파일과 타입을 같은 커밋에서 고친다.

## 기본·섬세 세탁 `POST /wash`
1. 애벌빨래: `packages/core/rules`가 확실한 얼룩을 찾는다 (플랫폼 배지, 대가성 명시 문구).
2. 본세탁: 경량 모델이 리뷰별로 `stain`, `signal`, `evidence`를 판정한다. 25개씩 나눠 병렬 호출한다.
3. 검수: 코드로 `evidence` 원문 포함 여부를 확인하고, 세탁 전·후 평점과 얼룩 수를 계산한다.
4. 세탁 후 요약: 상위 모델이 `include: true`인 리뷰만 받아 `summary`(2~3문장)와 장점·단점을 만든다. 코드가 `reviewIds`를 검증한다.

요청
```json
{ "site": "coupang", "strict": false,
  "sources": { "best": 50, "latest": 50, "duplicates": 4 },
  "partial": false,
  "reviews": [{ "id": "cp-123456", "rating": 5, "date": "2026-10-21", "text": "...", "badges": ["체험단"], "hasPhoto": false, "option": "블랙 / 10000mAh", "source": "best" }] }
```
- `sources`(선택): 입고 범위. 확장이 `dedupeReviews` 결과를 그대로 보낸다. API는 `receipt.sources`에 그대로 담는다. 없으면 `reviews`의 `source`로 센다(`duplicates: 0`).
- `partial`(선택): 입고가 일부만 됐는지(`intake.partial`). API는 본세탁 시간 초과 여부와 OR 해서 `receipt.partial`에 담는다. 없으면 `false`.
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
  "notice": null,
  "matches": [{ "id": "cp-3", "quote": "30분 쓰니까 손으로 못 잡을 만큼 뜨거워요" }],
  "matched": 4,
  "rating": { "average": 2.3, "count": 4 },
  "summary": [{ "text": "...", "reviewIds": ["cp-3"] }],
  "pros": [{ "text": "...", "reviewIds": ["cp-3"] }],
  "cons": [{ "text": "...", "reviewIds": ["cp-8"] }]
}
```
- `notice`: 사용자에게 보여줄 안내 문구. 평소에는 `null`. 결과가 0개이거나 리뷰와 관련 없는 질문이면 "관련된 리뷰를 찾을 수 없습니다." 같은 문구가 들어간다. 사이드 패널은 `notice`가 있으면 결과 목록 대신 이 문구를 보여준다.
- 정해진 조건으로만 고른 리뷰는 `quote: null`.
- `rating.average`는 코드가 계산한 값이다. 소수 첫째 자리 반올림, 결과가 0개면 `null`.
- 결과가 0개면 `matches: []`, `summary: []`, `pros: []`, `cons: []`. 확장은 이 단계를 쌓지 않고 직전 목록을 그대로 둔다.
- 리뷰와 관련 없는 질문(예: "배송 언제 와?")이면 `matches: []`와 `notice`로 안내한다.

### 단계 쌓기 (확장 쪽, API는 상태 없음)
- 확장은 단계 스택을 탭 메모리에 둔다: `[{ request, label, conditions, ids, rating, summary, pros, cons }]`. 상태 변경 로직은 `packages/core/src/filter`의 순수 함수(`pushStep`, `popStep`, `resetSteps`)로 만든다.
- 화면: 조건 칩 줄(`세탁된 리뷰 96 ★4.3 › 사진 있음 31 ★4.1 › 3점 이하 · 발열 4 ★2.3`), 그 아래 평균 별점, 요약, 장점·단점, 그 아래 리뷰 카드 목록.
- 마지막 칩의 ✕ = 한 단계 뒤로 (저장된 직전 결과를 그대로 보여주고 API를 다시 부르지 않는다). "처음부터" = 세탁된 리뷰 전체로.
- 중간 칩 삭제는 MVP에서 지원하지 않는다.
- 단계는 최대 5개. 넘으면 "처음부터"를 안내한다.

### 세탁 순서 자유롭게 섞기
부분 세탁의 단계는 항상 **바탕 세탁**(기본 또는 섬세) 위에 쌓인다. 칩 줄의 첫 칩이 바탕 세탁이다: `🧺 기본 96 ★4.3 › 사진 있음 31 ★4.1 › 발열 4 ★2.3`.

| 사용자 동작 | 결과 |
|---|---|
| 기본 → 부분 / 섬세 → 부분 | 영수증 아래 "🎯 이 결과에서 원하는 리뷰 찾기". 그 세탁이 바탕이 된다 |
| 부분 → 기본 / 섬세 영수증 보기 | 첫 칩(또는 위쪽 방식 버튼)을 누르면 영수증으로 간다. 쌓은 단계는 그대로 두고 "찾던 리뷰로 돌아가기"를 보여준다 |
| 부분 세탁 중에 바탕을 기본 → 섬세로 바꾸기 | 코드만으로 바로 바뀐다: 단계마다 의심 얼룩 리뷰를 `ids`에서 빼고 평균 별점을 다시 계산한다 (`narrowSteps`). 지금 보고 있는 단계의 요약만 `/ask`로 다시 만든다 |
| 부분 세탁 중에 바탕을 섬세 → 기본으로 바꾸기 | 다시 들어온 리뷰(의심 얼룩)만 단계별로 다시 확인한다. 정해진 조건은 코드로, 의미 조건은 다시 들어온 리뷰만 `/ask`로 보낸다. 결과를 각 단계에 더하고(`mergeIntoStep`) 지금 단계의 요약을 다시 만든다 |
| 시작 화면에서 🎯 부분 세탁 | 바탕은 기본 세탁. 나중에 첫 칩에서 섬세로 바꿀 수 있다 |

- 바탕을 바꾸는 동안 칩 줄에 "다시 맞추는 중"을 표시한다. 실패하면 단계를 지우지 말고 "이전 결과" 표시와 다시 시도 버튼을 보여준다.
- 시간이 모자라면(hackathon.md 자를 순서) 섬세 → 기본 전환은 "단계를 지우고 처음부터 다시 질문" 안내로 대신한다. 기본 → 섬세 전환은 코드만으로 되므로 남긴다.

## 코어 함수 (재현 → 주영·정민이 import)
`packages/core/src/index.ts`에서 내보낸다. 모두 순수 함수이고 입력을 바꾸지 않는다. 15:25까지 시그니처와 임시 구현(빈 결과)을 먼저 push하고, 내용은 그 뒤에 채운다.

```ts
// types/review.ts
type Site = 'coupang';
type Source = 'best' | 'latest';
interface Review {
  id: string;              // "cp-..."
  rating: 1 | 2 | 3 | 4 | 5;
  date: string;            // YYYY-MM-DD
  text: string;            // 전체 본문, 최대 2,000자
  badges: string[];        // 쿠팡이 붙인 표시 문구 그대로 (예: "쿠팡체험단")
  hasPhoto: boolean;
  photos?: string[];       // 확장 전용. API로 보내지 않는다
  option: string | null;   // 구매 옵션
  source: Source;
}

// types/wash.ts
type Stain = 'none' | 'certain' | 'suspected';
type Signal = 'platform_badge' | 'disclosure' | 'review_event' | 'suspected';
interface WashTag { id: string; stain: Stain; signal: Signal | null; evidence: string | null; include: boolean; }
interface Cited { text: string; reviewIds: string[]; }
interface Receipt {
  basedOn: number; sources: { best: number; latest: number; duplicates: number };
  before: number | null; after: number | null;
  stains: Record<Signal, number>; removed: number; partial: boolean;
  summary: Cited[]; pros: Cited[]; cons: Cited[];
}

// types/ask.ts
interface Conditions {
  rating?: { min?: number; max?: number };
  date?: { from?: string; to?: string };
  hasPhoto?: boolean; source?: Source; option?: string[];
  includes?: string[]; excludes?: string[];
  semantic?: string | null;
}
interface Match { id: string; quote: string | null; }
interface Step {
  request: string; label: string; conditions: Conditions; ids: string[];
  rating: { average: number | null; count: number }; summary: Cited[]; pros: Cited[]; cons: Cited[];
}
```

| 함수 | 입력 → 출력 | 하는 일 | 쓰는 사람 | 속성 |
|---|---|---|---|---|
| `dedupeReviews(best, latest)` | `Review[], Review[]` → `{ reviews, sources }` | ID로 중복 제거, 겹치면 `source: "best"` | 규리 | P1, P2 |
| `detectCertainStains(reviews)` | `Review[]` → `WashTag[]` | 규칙으로 확실한 얼룩 판정. 얼룩이 아니면 `stain: "none"` (LLM 판정 대기) | 주영 | stain-rules.md |
| `verifyJudgments(reviews, ruleTags, llmTags)` | → `WashTag[]` | 규칙 판정이 우선. LLM의 `evidence`가 원문에 없으면 한 단계 낮춘다. 빠진 리뷰는 규칙 결과로 채운다 | 주영 | P6, P7 |
| `applyStrict(tags, strict)` | `WashTag[], boolean` → `WashTag[]` | `include`를 정한다. `certain`은 항상 제외, `suspected`는 strict일 때 제외 | 주영, 정민 | P3 |
| `averageRating(reviews)` | `Review[]` → `number \| null` | 평균을 소수 첫째 자리로 반올림. 비면 `null` | 주영, 정민 | P4, P5, P15 |
| `buildReceipt(reviews, tags, sources, partial)` | → `Omit<Receipt, 'summary' \| 'pros' \| 'cons'>` | 세탁 전·후 평점, 얼룩 수, 제거 수 | 주영 | P2, P4, P10 |
| `verifyCitations(cited, allowedIds)` | `Cited[], string[]` → `Cited[]` | 허용되지 않은 ID를 지우고, 근거가 빈 문장은 버린다 | 주영 | P8 |
| `applyConditions(reviews, conditions)` | `Review[], Conditions` → `Review[]` | 정해진 조건 필터 (`semantic`은 무시) | 주영 | P11, P12 |
| `verifyMatches(reviews, matches)` | `Review[], Match[]` → `Match[]` | 입력에 없는 ID, 원문에 없는 `quote`를 버린다 | 주영 | P9, P13 |
| `containsQuote(text, quote)` | `string, string` → `boolean` | 공백·줄바꿈·문장부호 차이를 무시하고 원문 포함 여부 확인 | 내부 | P6, P9 |
| `pushStep(steps, step)` / `popStep(steps)` / `resetSteps()` | `Step[]` → `Step[]` | 단계 스택. 결과 0개 단계는 쌓지 않음, 최대 5단계 | 정민 | P14 |
| `narrowSteps(steps, reviews, allowedIds)` | `Step[], Review[], string[]` → `Step[]` | 바탕이 좁아질 때(기본 → 섬세). 단계마다 `ids`를 허용 ID로 줄이고, 평균 별점과 개수를 다시 계산하고, 근거 ID가 사라진 요약 문장을 지운다. 비게 된 단계부터 뒤는 잘라낸다 | 정민 | P16 |
| `mergeIntoStep(step, reviews, addedIds)` | `Step, Review[], string[]` → `Step` | 바탕이 넓어질 때(섬세 → 기본). 다시 확인해 통과한 리뷰 ID를 더하고 평균 별점과 개수를 다시 계산한다 | 정민 | P17 |

- `/wash`에서 `strict`만 바꿔 다시 세탁할 때 정민은 저장된 `tags`에 `applyStrict`를 적용하고 `/wash`를 `tags`와 함께 다시 부른다 (요약만 다시 만든다).

## 공통 규칙
- LLM 출력은 JSON으로 받고 스키마 검증 후 사용한다. 검증에 실패한 판정 묶음은 애벌빨래 결과로 대신한다.
- 입력에 없는 ID, `include: false`인 리뷰 ID는 요약 근거에서 지운다. 남은 근거가 없는 문장은 버린다.
- 요약 호출이 실패하거나 시간이 모자라면 `summary: []`로 두고 평점과 태그는 그대로 보여준다.
- 시간 예산: API Gateway 통합 제한 29초. `/wash`는 본세탁 20초 + 요약 7초 안팎. `/ask`는 해석 3초 + 의미 조건 고르기 10초 + 요약 5초 안팎이고, 의미 조건이 없으면 고르기를 건너뛴다. 본세탁이 20초를 넘기면 남은 리뷰는 애벌빨래 결과로 대신하고 `partial: true`.
- 입력 검증: `reviews` 1~100개, `text`는 리뷰당 최대 2,000자, `request`는 최대 200자, `history`는 최대 5개. 넘으면 400.
- 평점은 소수 첫째 자리까지 반올림한다. 빼고 남은 리뷰가 없으면 `after: null`이고 UI는 "계산할 리뷰 없음"을 표시한다.
- 리뷰 수를 100개보다 늘리려면 먼저 사용하는 Bedrock 모델의 계정 할당량(분당 요청 수, 토큰 수)을 Service Quotas에서 확인하고, 배포 환경에서 `/wash` 응답 시간을 잰다.

