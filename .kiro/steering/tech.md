---
inclusion: always
---

# 기술 스택

| 영역 | 선택 |
|---|---|
| 언어 | TypeScript (strict) |
| 모노레포 | npm workspaces (`apps/*`, `packages/*`, `infra`) |
| 확장 | Chrome Extension Manifest V3, Side Panel API, Content Script. 사이드 패널 UI는 React. 대상 사이트는 쿠팡 (카카오맵은 다음 단계) |
| 확장 빌드 | 미정 (Vite 후보). review-intake 또는 side-panel-receipt spec의 design에서 정한다 |
| API | AWS Lambda (Node.js, TypeScript) + API Gateway |
| LLM | Amazon Bedrock. 판정은 경량 모델, 요약과 부분 세탁은 상위 모델. 모델 ID는 Lambda 환경 변수로 바꿀 수 있다 |
| 인프라 | AWS CDK (`infra/`) |
| 테스트 | Vitest (코어 로직, 어댑터 파싱) |

## 아키텍처 규칙
- 확장 프로그램은 Bedrock을 직접 호출하지 않는다. 항상 API Gateway를 거친다.
- 확장은 manifest의 `host_permissions`에 API 도메인과 쿠팡을 넣는다. 카카오맵은 지원할 때 추가한다.
- 평점, 개수 계산은 `packages/core`의 순수 함수로 한다. LLM 응답의 숫자는 쓰지 않는다.
- `packages/core`는 브라우저, Node 양쪽에서 돌아야 한다. DOM, `fs`, 네트워크 의존 금지.
- API는 상태를 갖지 않는다. 판정 결과는 확장의 탭 메모리에 두고, 부분 세탁 때 확장이 세탁된 리뷰만 보낸다.

## 입고 (쿠팡)
- 사이드 패널이 열리면 content script가 자동으로 입고를 시작한다. 패널은 진행률을 보여준다.
- 범위: 베스트순 5페이지(50개) + 최신순 5페이지(50개). 리뷰 ID로 중복을 뺀다. 리뷰가 적으면 있는 만큼만.
- 상한은 상수로 둔다: `PAGES_PER_SORT = 5`, `MAX_REVIEWS = 100`, `MAX_REQUESTS_PER_PRODUCT = 10`. 배포 환경에서 시간을 재 본 뒤에만 올린다.
- 차단 가능성을 낮추는 규칙:
  - 요청은 content script에서, 페이지가 리뷰 페이지를 넘길 때 쓰는 것과 같은 주소와 파라미터로 보낸다. 백그라운드나 서버에서 보내지 않는다.
  - 한 번에 하나씩 순서대로 보낸다. 병렬 요청 금지.
  - 요청 사이에 1~2초 무작위 간격을 둔다.
  - 탭이 보이는 상태일 때만 진행한다. 탭이 숨겨지면 멈췄다가 다시 보이면 이어서 한다.
  - 같은 탭, 같은 상품은 한 번만 입고한다. 패널을 닫았다 열어도 탭 메모리에 있으면 다시 요청하지 않는다.
  - 403, 429, 확인(캡차) 페이지, 예상과 다른 응답을 받으면 바로 멈춘다. 재시도하지 않는다. 그때까지 읽은 리뷰와 화면에 보이는 리뷰로 진행하고 `receipt.partial: true`.
  - 헤더 위조, 쿠키 조작, 차단 우회는 하지 않는다.
- 리뷰 `id`: 쿠팡 리뷰 ID에 `cp-`를 붙인다. 없으면 작성자·날짜·본문 앞부분의 해시. DOM 요소와 1:1로 대응해야 한다 (태그, 하이라이트).
- 각 리뷰에 `source: "best" | "latest"`를 붙인다. 두 정렬에 모두 나오면 `"best"`로 둔다.

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

## 보안과 남용 방지
- AWS 자격 증명과 모델 설정은 Lambda 환경에만 둔다. 확장 코드, 커밋에 비밀 정보를 넣지 않는다.
- API는 키 없이 공개된다. 그래서 다음을 반드시 둔다: API Gateway 요청 제한(throttling), 위 입력 검증, AWS Budgets 비용 알림.
- 대회가 끝나면 API를 끄거나 요청 제한을 낮춘다.

## 명령어 (구현 후 갱신)
- 테스트: `npm test --workspaces` (Vitest는 `vitest --run`으로 단발 실행)
- 품질 검사: `scripts/eval` 실행
- 배포: `infra`에서 CDK 배포 (Supervised 모드로 실행)
