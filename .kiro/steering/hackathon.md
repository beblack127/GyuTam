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
| 사용자 가치 | 15 | 세탁 후 평점, 세탁 후 요약, 근거 하이라이트 |

- 2차(결선, 상위 3팀만): 심사위원이 발표와 녹화 데모로 평가한다. 문제 정의 25, 사용자 가치 25, Kiro 활용 20(1차 등급 반영), 작동 15(녹화 데모), 발표 15. 결선에 진출하면 그때 준비한다.

## 목표와 우선순위
- 목표: 마감까지 평가자 체험 시나리오가 끊김 없이 동작하는 시스템. 완벽함보다 동작이 우선이다.
- 16:30 기능 동결. 이후에는 버그 수정, 배포 확인, README 정리만 한다.
- 우선순위: 쿠팡 자동 입고 + 세탁하기(세탁 후 평점, 세탁 후 요약) → 세탁 태그·근거 하이라이트 → 부분 세탁(자연어 질문) → 섬세 세탁 토글 → 카카오맵.
- 카카오맵은 쿠팡 시나리오 1~5가 배포 환경에서 모두 동작한 뒤에만 시작한다.

## Kiro 활용 규칙 (1차 35점)
- 모든 기능 코드는 spec의 task에서 나온다. spec 없이 큰 기능을 Vibe로 짜지 않는다. Vibe는 버그 수정과 탐색에만 쓴다.
- 각자 맡은 spec을 Kiro Spec 세션으로 requirements → design → tasks 순서로 만들고, 단계마다 검토·승인한 뒤 바로 커밋한다.
- design에 testing.md의 correctness property 중 그 spec에 해당하는 것을 넣고, fast-check 테스트로 구현한다.
- 구현은 tasks의 Start task로 한다. 커밋 메시지에 task 번호를 쓴다: `feat(wash-pipeline): 2.3 평점 계산`.
- 설계가 바뀌면 코드보다 spec(design.md, tasks.md)을 먼저 고친다. 마감 때 tasks 체크박스가 실제 상태와 같아야 한다.
- 반복 작업은 skill로: 프롬프트 수정은 `tune-wash-prompt`, 카카오맵은 `add-site-adapter`로 추가한다.
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
| 역할 | 맡을 부분 | 폴더 | spec | 담당 |
|---|---|---|---|---|
| 입고·태그 | 패널 열면 자동 입고, 쿠팡 어댑터(베스트 50 + 최신 50, 차단 시 멈춤), 세탁 태그, 근거 하이라이트와 스크롤, 어댑터 파싱 테스트. 쿠팡이 끝나면 카카오맵 어댑터 | `apps/extension/src/content`, `apps/extension/src/services/adapters` | review-intake | 미정 |
| 세탁 파이프라인 | 공통 타입, 규칙 탐지, 평점 계산, `/wash`·`/ask` 핸들러, 판정·요약·부분 세탁 프롬프트, LLM 응답 검증 | `packages/core`, `apps/api` | wash-pipeline | 미정 |
| 사이드 패널 | 입고 진행률, 세탁하기 버튼과 섬세 세탁 토글, 질문 입력, 영수증, 요약 근거 클릭, 판정 결과 탭 메모리, 로딩·오류 화면, 확장 빌드 | `apps/extension/src/sidepanel`, `apps/extension/src/components`, `apps/extension/src/services/api` | side-panel-receipt | 미정 |
| 배포·Kiro·품질 | CDK 배포, 요청 제한, 비용 알림, 전체 연결 확인, Releases zip, `scripts/eval`, hooks·agents·skills 관리, `docs/KIRO.md`, README | `infra`, `scripts/eval`, `scripts/hooks`, `.kiro/hooks`, `.kiro/agents`, `.kiro/skills`, `docs`, `README.md` | infra | 미정 |

- 배포·Kiro·품질 담당은 평가자 역할도 맡는다. 1시간마다 README만 보고 평가자 체험 시나리오를 처음부터 실행해 보고, 막히는 곳을 담당자에게 넘긴다.

## 협업 규칙
- 11:20까지 공통 타입(`packages/core/src/types`)과 `POST /wash`, `POST /ask` 계약을 먼저 확정한다. 세탁 파이프라인 담당이 올리고 전원이 검토한다.
- 계약이 확정되기 전에는 사이드 패널 담당이 계약 예시 JSON으로 화면을 먼저 만든다.
- 그 뒤로는 각자 자기 폴더만 수정한다. 남의 폴더를 바꿔야 하면 담당자에게 먼저 말한다.
- 같은 파일을 동시에 여러 에이전트가 수정하지 않는다.
- 평가 데이터 라벨링(부분 세탁 주제, 세탁 후 요약 근거 확인)은 오후에 전원이 30분씩 나눠서 한다.

## 제출 전 체크리스트
- [ ] 배포된 API로 평가자 체험 시나리오 1~5 통과 (README만 보고 실행)
- [ ] Releases에 `byeoljeom-laundry-extension.zip` 업로드
- [ ] README의 예시 상품 URL, 품질 수치, 스크린샷 채우기 (작성자 이름 가림)
- [ ] `.kiro/specs`에 spec 4개의 requirements, design, tasks 커밋, tasks 체크박스가 실제 상태와 같음
- [ ] correctness property P1~P10 테스트 통과
- [ ] `kiro-evidence-writer`로 `docs/KIRO.md` 숫자 갱신, `__` 칸 정리
- [ ] `fairness-reviewer`로 최종 문구·프롬프트 검토
- [ ] 빈 폴더(`.gitkeep`만 있는 곳)와 쓰지 않은 설정 정리
- [ ] AWS Budgets 알림과 API 요청 제한 확인
- [ ] (결선 진출 시) 발표 자료와 녹화 데모 준비
