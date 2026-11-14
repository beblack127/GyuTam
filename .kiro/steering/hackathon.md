---
inclusion: always
---

# 해커톤 규칙

## 제출물과 심사
- 1차 제출물은 동작하는 최종 시스템과 레포다. 발표와 데모 영상은 1차에 필요 없다.
- 1차 심사: AI + 운영진이 레포와 시스템을 검토한다. 상위 3팀이 결선에 간다.

| 1차 항목 | 배점 | 우리가 할 일 |
|---|---|---|
| Kiro 활용 | 35 | 아래 "Kiro 활용 규칙". 증거는 `docs/KIRO.md`에 실제 숫자로 모은다 |
| 작동 | 30 | 평가자 체험 시나리오(product.md)가 README 안내만으로 동작. 배포된 API, Releases zip, 오류 화면 |
| 문제 정의 | 20 | README 1장 (출처 있는 숫자) |
| 사용자 가치 | 15 | 세탁 후 평점, 세탁 후 요약, 문장으로 계속 좁혀 가며 원하는 리뷰 원문 찾기 |

- 2차(결선, 상위 3팀만): 심사위원이 발표와 녹화 데모로 평가한다. 문제 정의 25, 사용자 가치 25, Kiro 활용 20(1차 등급 반영), 작동 15(녹화 데모), 발표 15. 결선에 진출하면 그때 준비한다.

## 목표와 우선순위
- 목표: 마감까지 평가자 체험 시나리오가 끊김 없이 동작하는 시스템. 완벽함보다 동작이 우선이다.
- 17:25 기능 동결. 이후에는 배포, 버그 수정, README 정리만 한다. 18:00 최종 제출.
- 시간이 모자라면 이 순서로 자른다: 사진 크게 보기 → "?" 상세 설명 → 부분 세탁 중 섬세 → 기본 바탕 전환 → 섬세 세탁 → 품질 검사 스크립트 → 단계 쌓기(1단계 질문만 남김).
- 우선순위: 쿠팡 자동 입고 + 시작 화면(세 버튼과 설명) + 기본 세탁(세탁 후 평점, 세탁 후 요약, 세탁된 리뷰 목록) → 부분 세탁 1단계(문장형 질문 → 조건에 맞는 리뷰 원문 + 요약) → 연속 구체화(조건 칩, 뒤로) → 리뷰 카드 사진·근거 강조 → 섬세 세탁.
- 대상은 쿠팡 상품 페이지 하나다. 다른 사이트는 만들지 않는다.

## Kiro 활용 규칙 (1차 35점)
- 모든 기능 코드는 spec의 task에서 나온다. spec 없이 큰 기능을 Vibe로 짜지 않는다. Vibe는 버그 수정과 탐색에만 쓴다.
- 각자 맡은 spec을 Kiro Spec 세션으로 requirements → design → tasks 순서로 만들고, 단계마다 검토·승인한 뒤 바로 커밋한다.
- design에 testing.md의 correctness property 중 그 spec에 해당하는 것을 넣고, fast-check 테스트로 구현한다.
- 구현은 tasks의 Start task로 한다. 커밋 메시지에 task 번호를 쓴다: `feat(wash-rules): 2.3 평점 계산`.
- 설계가 바뀌면 코드보다 spec(design.md, tasks.md)을 먼저 고친다. 마감 때 tasks 체크박스가 실제 상태와 같아야 한다.
- 반복 작업은 skill로: 프롬프트 수정은 `tune-wash-prompt`로 한다.
- UI 문구나 프롬프트를 바꾸면 `fairness-reviewer` 에이전트로 검토한다.
- GitHub MCP로 각 spec의 큰 task를 이슈로 만들고, PR에 이슈를 연결한다.
- Kiro가 계획이나 코드를 바꾼 사례(hook이 막은 것, 품질 검사가 잡은 하락, spec 검토에서 바뀐 설계)는 바로 `docs/KIRO.md` 7장에 적는다.
- 쓰지 않은 기능을 쓴 것처럼 적지 않는다. 마감 전에 빈 폴더와 쓰지 않은 설정은 지운다.

## 작업 규칙
- 테스트는 `packages/core`와 어댑터 파싱 같은 핵심 로직만. 과한 추상화 금지.
- 새 라이브러리를 추가하기 전에 먼저 물어본다.
- 비밀키는 Lambda 환경 변수에만. 절대 커밋하지 않는다.
- 커밋 메시지: `feat:` / `fix:` / `chore:` / `docs:` / `test:` 접두사.
- 수치는 코드가 계산한 값만 쓴다. 하드코딩하지 않는다.

## 역할 분담
| 역할 | 담당 | 맡을 부분 | 폴더 | spec |
|---|---|---|---|---|
| 1a. 세탁 규칙 | 재현 | 공통 타입, 체험단·리뷰이벤트 규칙 탐지, 평점 계산, 정해진 조건 필터, 단계 스택 함수, 근거 검증(evidence, quote, reviewIds), 속성 기반 테스트. 끝나면 `scripts/eval` | `packages/core`, `scripts/eval` | wash-rules |
| 1b. 세탁 LLM | 주영 | 의심 얼룩 판정, 질의 해석(조건 추출), 의미 조건 고르기, 요약 프롬프트, Bedrock 호출, `/wash`·`/ask` 핸들러, LLM 응답 스키마 검증, 통합용 로컬 API 서버 | `apps/api` | wash-llm |
| 2. 입고 | 규리 | 패널 열면 자동 입고, 쿠팡 어댑터(베스트 50 + 최신 50, 차단 시 멈춤), 리뷰 카드에 필요한 필드 추출(전체 본문, 작성일, 별점, 구매 옵션, 사진 주소, 체험단 표시. 작성자 제외), 어댑터 파싱 테스트 | `apps/extension/src/content`, `apps/extension/src/services/adapters`, `apps/extension/src/background` | review-intake |
| 3. 사이드 패널 | 정민 | 입고 진행률, 시작 화면(기본·섬세·부분 세 버튼과 안내 문구), 방식 전환, 영수증, 질문 창, 조건 칩과 단계 이동, 리뷰 카드 목록(사진 썸네일, 더보기, 근거 강조, 세탁 태그), 요약 근거 클릭 시 카드 이동, 로딩·오류 화면, 확장 빌드, Releases zip | `apps/extension/src/sidepanel`, `apps/extension/src/components`, `apps/extension/src/services/api` | side-panel-receipt |

- 짝: 재현 ↔ 주영 (코어 함수를 API가 쓴다), 규리 ↔ 정민 (같은 확장 프로그램, 메시지 형식 공유). 막히면 짝이 먼저 돕는다.
- 배포는 역할에서 뺀다. 마지막에 AWS 계정이 있는 사람이 `infra`로 배포한다. 그전까지 확장은 주영의 로컬 API 서버(`localhost`)로 연결해 처음부터 끝까지 확인한다.
- 배포 당일 막히지 않도록 오전에 `cdk bootstrap`과 Bedrock 모델 사용 권한만 확인해 둔다.
- `docs/KIRO.md`와 README 마무리는 마지막에 `kiro-evidence-writer` 에이전트로 숫자를 세고, 각자 자기 spec 칸을 확인한다.
- 1시간마다 한 명(돌아가며)이 README만 보고 평가자 체험 시나리오를 처음부터 실행해 보고, 막히는 곳을 담당자에게 넘긴다.

## 오늘 일정 (16:20 기준으로 다시 짬, 18:00 제출)
공통 타입 PR(#2)은 16:19에 `main`에 합쳐졌다. 남은 시간이 1시간 40분이라 spec은 Quick Spec으로 빠르게 만들고 바로 구현한다.

| 시간 | 재현 (wash-rules) | 주영 (wash-llm) | 규리 (review-intake) | 정민 (side-panel-receipt) |
|---|---|---|---|---|
| 16:20–16:35 | task 2~7 (검증, 중복 제거, 규칙 탐지, 평점·영수증) | Quick Spec 작성·승인, Bedrock 권한 확인 | intake.md 체크리스트 채우기 → Quick Spec | Quick Spec 작성·승인 |
| 16:35–17:15 | task 8 (조건 필터, 단계 스택) → task 10 (바탕 전환) | `/wash`, `/ask`, 프롬프트, 로컬 API 서버 | 쿠팡 파싱 → 자동 입고 → 진행률 | 시작 화면 세 버튼, 영수증, 리뷰 카드, 질문 창, 조건 칩 |
| 17:15–17:25 | 통합: 실제 쿠팡 페이지 → 확장 → 로컬 API (전원) | | | |
| 17:25 | 기능 동결 | | | |
| 17:25–17:45 | CDK 배포 (AWS 계정 보유자와) | 배포 주소로 확인 | README만 보고 처음부터 실행 (평가자 역할) | API 주소 교체, 빌드, zip |
| 17:45–18:00 | `kiro-evidence-writer`로 KIRO.md, tasks 체크박스 정리 | `fairness-reviewer` 검토 | 버그 공유 | README 예시·스크린샷, Releases 업로드, 제출 |

- 통합(17:15)에서 끝까지 이어지지 않으면 남은 기능을 멈추고 연결부터 고친다.
- 시간이 모자라면 hackathon.md "자를 순서"를 바로 적용한다. 끝까지 남길 것: 자동 입고, 시작 화면, 기본 세탁(평점·요약·리뷰 카드), 부분 세탁 1단계.
- 배포가 17:45까지 안 되면 Lambda Function URL로 바로 올린다.

- 라이브러리는 PR #2로 설치됐다. 더 필요하면 재현에게 말한다 (`package-lock.json` 충돌 방지).
- 코어 함수는 지금 빈 구현이다. 주영과 정민은 그대로 import해서 쓰고, 재현이 내용을 채우면 자동으로 동작한다.
- 배포가 17:40까지 안 되면 Lambda Function URL로 바로 배포한다 (요청 제한은 Lambda 동시 실행 수 제한으로 대신).
- spec은 Quick Spec으로 만든다. requirements, design, tasks가 모두 생기므로 Kiro 활용 증거는 그대로 남는다.
- 30분마다 `git pull --rebase origin main` 후 자기 브랜치에 push하고 PR을 연다.

## 브랜치와 PR
| 브랜치 | 담당 | spec |
|---|---|---|
| `feat/wash-rules` | 재현 | wash-rules |
| `feat/wash-llm` | 주영 | wash-llm |
| `feat/review-intake` | 규리 | review-intake |
| `feat/side-panel-receipt` | 정민 | side-panel-receipt |

- `main`에 직접 push하지 않는다. 각자 브랜치에서 작업하고 PR로 `main`에 합친다.
- 공통 타입 PR #2는 합쳐졌다. 나머지 세 명은 `git pull --rebase origin main`으로 받는다.
- PR은 작게, 자주: 30분마다 또는 task 2~3개마다 한 번. 17:15 통합 전에 모두 한 번씩 합친다.
- 각자 spec을 만든 직후 GitHub MCP로 spec의 큰 task를 이슈로 만든다. PR 본문에 `Closes #이슈번호`를 쓴다.
- PR 리뷰는 짝이 본다 (재현 ↔ 주영, 규리 ↔ 정민). 5분 안에 보고 합친다. 막히면 작성자가 직접 합친다.
- 공통 파일(`package.json`, `package-lock.json`, `packages/core/src/types`, steering)은 재현만 바꾼다. 필요하면 재현에게 말한다.
- 충돌이 나면 브랜치 주인이 rebase로 푼다. 남의 폴더 변경은 받아들이는 쪽(theirs)을 기본으로 한다.

## 협업 규칙
- 공통 타입(`packages/core/src/types`)과 `POST /wash`, `POST /ask` 계약은 확정됐다 (PR #2, api-contract.md). 재현이 타입을, 주영이 계약을 올리고 전원이 검토한다. 이때 재현과 주영이 코어 함수 이름과 시그니처도 정한다.
- 계약이 확정되기 전에는 사이드 패널 담당이 계약 예시 JSON으로 화면을 먼저 만든다.
- 그 뒤로는 각자 자기 폴더만 수정한다. 남의 폴더를 바꿔야 하면 담당자에게 먼저 말한다.
- 같은 파일을 동시에 여러 에이전트가 수정하지 않는다.
- 평가 데이터 라벨링(질문별 정답 리뷰, 세탁 후 요약 근거 확인)은 오후에 전원이 30분씩 나눠서 한다.

## 제출 전 체크리스트
- [ ] 배포된 API로 평가자 체험 시나리오 1~6 통과 (README만 보고 실행)
- [ ] Releases에 `byeoljeom-laundry-extension.zip` 업로드
- [ ] README의 예시 상품 URL, 품질 수치, 스크린샷 채우기 (작성자 이름 가림)
- [ ] `.kiro/specs`에 spec 4개의 requirements, design, tasks 커밋, tasks 체크박스가 실제 상태와 같음
- [ ] correctness property P1~P17 테스트 통과
- [ ] `kiro-evidence-writer`로 `docs/KIRO.md` 숫자 갱신, `__` 칸 정리
- [ ] `fairness-reviewer`로 최종 문구·프롬프트 검토
- [ ] 빈 폴더(`.gitkeep`만 있는 곳)와 쓰지 않은 설정 정리
- [ ] AWS Budgets 알림과 API 요청 제한 확인
- [ ] (결선 진출 시) 발표 자료와 녹화 데모 준비
