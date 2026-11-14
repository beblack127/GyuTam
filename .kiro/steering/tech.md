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
| LLM | Amazon Bedrock. 판정은 경량 모델, 요약은 상위 모델. 모델 ID는 Lambda 환경 변수로 바꿀 수 있다 |
| 인프라 | AWS CDK (`infra/`) |
| 테스트 | Vitest (코어 로직, 어댑터 파싱) |

## 아키텍처 규칙
- 확장 프로그램은 Bedrock을 직접 호출하지 않는다. 항상 API Gateway의 `POST /wash`를 거친다.
- 확장은 manifest의 `host_permissions`에 API 도메인과 대상 사이트(쿠팡)를 넣는다. 카카오맵은 지원할 때 추가한다.
- 평점, 개수 계산은 `packages/core`의 순수 함수로 한다. LLM 응답의 숫자는 쓰지 않는다.
- `packages/core`는 브라우저, Node 양쪽에서 돌아야 한다. DOM, `fs`, 네트워크 의존 금지.

## 세탁 과정
1. 접수: 세탁 요청을 `course`로 해석한다.
2. 애벌빨래: `packages/core/rules`가 확실한 얼룩을 찾는다 (플랫폼 배지, 대가성 명시 문구).
3. 본세탁: 경량 모델이 리뷰별로 `stain`, `signal`, `evidence`, `topics`를 판정한다. 25개씩 나눠 병렬 호출한다.
4. 검수: 코드로 `evidence` 원문 포함 여부를 확인하고, 세탁 전·후 평점과 얼룩 수를 계산한다.
5. 영수증: 상위 모델이 `include: true`인 리뷰만 받아 세탁 후 요약(`summary`, 2~3문장)과 장점·단점(부분 세탁이면 주제 기준)을 만든다. 코드가 `reviewIds`를 검증한다.
   - 입력에 없는 ID나 `include: false`인 리뷰 ID는 지운다. 남은 근거가 없는 문장은 버린다.
   - 요약 호출이 실패하거나 시간이 모자라면 `summary: []`로 두고 평점과 태그는 그대로 보여준다.

- LLM 출력은 JSON으로 받고 스키마 검증 후 사용한다. 검증에 실패한 묶음은 애벌빨래 결과로 대신한다.
- 시간 예산: API Gateway 통합 제한은 29초다. 본세탁 20초, 영수증(요약) 7초 안팎으로 나눈다. 본세탁이 20초 안에 끝나지 않으면 남은 리뷰는 애벌빨래 결과로 대신하고 `receipt.partial: true`로 표시한다.

## API 계약 (초안)
`POST /wash`

요청
```json
{
  "request": "체험단 리뷰 빼고 무게 관련만 요약해줘",
  "site": "coupang",
  "reviews": [{ "id": "cp-123456", "rating": 5, "date": "2026-10-21", "text": "...", "badges": ["체험단"] }]
}
```
- `site`: `"coupang"` (카카오맵 지원 시 `"kakaomap"` 추가)
- `reviews`: 1~100개. `text`는 리뷰당 최대 2,000자. 넘으면 400 응답.
- 리뷰 `id`: 사이트에 원래 있는 리뷰 ID에 사이트 접두사를 붙인다 (`cp-`, `km-`). 없으면 작성자·날짜·본문 앞부분의 해시를 쓴다. 근거 하이라이트에 쓰므로 DOM 요소와 1:1로 대응해야 한다.

응답
```json
{
  "course": { "exclude": ["sponsored"], "topics": ["무게"], "strict": false },
  "tags": [{ "id": "cp-123456", "stain": "certain", "signal": "platform_badge", "evidence": null, "topics": ["무게"], "include": false }],
  "receipt": {
    "basedOn": 100, "before": 4.8, "after": 4.3,
    "stains": { "platform_badge": 18, "disclosure": 7, "review_event": 0, "suspected": 6 },
    "removed": 25, "matched": 14, "partial": false,
    "summary": [{ "text": "...", "reviewIds": ["cp-3", "cp-21"] }],
    "pros": [{ "text": "...", "reviewIds": ["cp-1"] }],
    "cons": [{ "text": "...", "reviewIds": ["cp-2"] }]
  }
}
```
- `course.exclude`: `"sponsored"`(체험단·제품 제공) | `"review_event"`. 비어 있으면 확실한 얼룩 전부를 뺀다.
- `course.strict`: 섬세 코스이면 `true`. 의심 얼룩도 평점에서 뺀다.
- `signal`: `"platform_badge" | "disclosure" | "review_event" | "suspected"`
- `stain: "none"`이면 `signal`, `evidence`는 `null`.
- 평점은 소수 첫째 자리까지 반올림한다. 빼고 남은 리뷰가 없으면 `after: null`이고 UI는 "계산할 리뷰 없음"을 표시한다.

## 보안과 남용 방지
- AWS 자격 증명과 모델 설정은 Lambda 환경에만 둔다. 확장 코드, 커밋에 비밀 정보를 넣지 않는다.
- API는 키 없이 공개된다. 그래서 다음을 반드시 둔다: API Gateway 요청 제한(throttling), 위 입력 크기 검증, AWS Budgets 비용 알림.
- 대회가 끝나면 API를 끄거나 요청 제한을 낮춘다.

## 명령어 (구현 후 갱신)
- 테스트: `npm test --workspaces` (Vitest는 `vitest --run`으로 단발 실행)
- 품질 검사: `scripts/eval` 실행
- 배포: `infra`에서 CDK 배포 (Supervised 모드로 실행)
