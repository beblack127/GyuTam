# Kiro 활용 기록

별점세탁소를 Kiro로 어떻게 만들었는지 기록한다. 숫자는 모두 레포에서 다시 셀 수 있는 값이고, `kiro-evidence-writer` 에이전트가 갱신한다. 아직 채우지 못한 칸은 `__`로 둔다.

## 한눈에 보기
| 항목 | 값 | 확인 위치 |
|---|---|---|
| Spec | __ / 4개 (requirements → design → tasks 완료) | [.kiro/specs](../.kiro/specs) |
| 완료한 task | __ / __ | 각 spec의 `tasks.md` |
| task 번호가 붙은 커밋 | __개 | `git log --grep "feat("` |
| Correctness property (속성 기반 테스트) | __ / 14개 통과 | [testing.md](../.kiro/steering/testing.md) |
| Steering | 10개 (always 5 · fileMatch 3 · auto 1 · manual 1) + AGENTS.md | [.kiro/steering](../.kiro/steering) |
| Hooks | 7개 | [.kiro/hooks](../.kiro/hooks) |
| 품질 검사 자동 실행 | __회 | [eval-history.md](eval-history.md) |
| Custom agents | 2개 | [.kiro/agents](../.kiro/agents) |
| Skills | 2개 | [.kiro/skills](../.kiro/skills) |

## 1. Spec 기반 개발
| Spec | 담당 | 범위 | 상태 |
|---|---|---|---|
| [wash-rules](../.kiro/specs/wash-rules) | 재현 | 공통 타입, 규칙 탐지, 평점 계산, 정해진 조건 필터, 단계 스택, 근거 검증 | __ |
| [wash-llm](../.kiro/specs/wash-llm) | 주영 | 의심 얼룩 판정, 질문 해석, 의미 조건 고르기, 요약, `/wash`·`/ask` | __ |
| [review-intake](../.kiro/specs/review-intake) | 규리 | 쿠팡 자동 입고, 리뷰 카드 필드 추출(사진, 옵션, 전체 본문) | __ |
| [side-panel-receipt](../.kiro/specs/side-panel-receipt) | 정민 | 세탁하기, 영수증, 질문 창, 조건 칩, 리뷰 카드 목록 | __ |

- 각 spec은 Kiro Spec 세션에서 requirements → design → tasks 순서로 만들고, 단계마다 사람이 검토하고 승인했다.
- design에 correctness property를 적고, 그대로 fast-check 테스트로 옮겼다 (P1~P14).
- 구현은 tasks의 Start task로 진행했고, `task-start`·`task-done` hook이 spec 확인과 테스트·커밋을 맡았다.

## 2. Steering: 필요한 때만 불러오기
| 파일 | 포함 방식 | 왜 |
|---|---|---|
| product, fairness, structure, tech, hackathon | always | 모든 작업에 필요한 용어, 공정성 규칙, 구조, 역할 |
| intake | fileMatch: content script, 어댑터 | 쿠팡 입고·차단 방지 규칙은 입고 코드에만 필요 |
| api-contract | fileMatch: API, 코어, 사이드 패널 | 계약 세부는 계약을 쓰는 코드에만 필요 |
| testing | fileMatch: `*.test.ts`, fixtures, eval | correctness property 목록은 테스트 작성 때만 필요 |
| kakaomap | auto (카카오맵 요청 시) | 다음 단계 범위라 평소 컨텍스트에서 뺌 |
| kiro-evidence | manual (`#kiro-evidence`) | 이 문서를 갱신할 때만 |

always 파일을 줄이고 나머지를 조건부로 돌려서 매 대화의 컨텍스트와 크레딧을 아꼈다.

## 3. Hooks: 규칙을 사람이 아니라 hook이 지킨다
| Hook | 트리거 | 하는 일 | 실제로 잡은 것 |
|---|---|---|---|
| secret-scan | PreToolUse (파일 쓰기) | AWS 키, 개인 키, 토큰이 들어간 쓰기를 막음 | __ |
| guard-shell | PreToolUse (셸) | 커밋 전 스테이징 변경의 비밀 정보와 실제 리뷰 원문 차단, `cdk deploy`·강제 push는 사람 확인 | __ |
| eval-on-save | PostFileSave (규칙, 프롬프트) | 세탁 품질 검사 실행, 결과를 eval-history.md에 기록 | __ |
| readme-sync | PostFileSave (API 계약, 타입) | README API 예시와 계약을 맞춤 | __ |
| task-start | PreTaskExec | spec 요구사항·property 확인, 담당 폴더 밖 수정 금지 | __ |
| task-done | PostTaskExec | 테스트 실행, task 번호로 커밋 | __ |
| session-context | SessionStart | 최근 커밋과 변경 파일을 공유해 팀원 작업 충돌 방지 | __ |

## 4. Custom agents와 Skills
| 이름 | 종류 | 하는 일 | 사용 기록 |
|---|---|---|---|
| fairness-reviewer | agent (읽기 전용) | 문구·프롬프트의 단정 표현, 근거 누락, 리뷰 저장 코드 검토 | __ |
| kiro-evidence-writer | agent | 레포 기록을 세어 이 문서 갱신 | __ |
| add-site-adapter | skill | 새 사이트 어댑터 추가 절차와 템플릿 | __ (카카오맵 추가에 사용 예정) |
| tune-wash-prompt | skill | 프롬프트 수정 → 품질 검사 전후 비교 → 기록 | __ |

## 5. MCP
| 서버 | 용도 | 결과 |
|---|---|---|
| GitHub | tasks → 이슈, PR 생성과 연결 | __ |
| AWS Documentation | Bedrock, CDK, API Gateway 코드 작성 시 공식 문서 참고 | __ |
| Notion | 구성안 → spec 입력 | __ |

설정 예시는 [mcp.example.json](../.kiro/settings/mcp.example.json). 토큰이 들어가는 `mcp.json`은 커밋하지 않는다.

## 6. Autopilot / Supervised
| 작업 | 모드 | 이유 |
|---|---|---|
| spec 승인 후 tasks 구현 | Autopilot | 검토한 설계 안에서 빠르게 |
| CDK 배포, IAM, 비용 설정 | Supervised + guard-shell hook | 되돌리기 어렵고 비용이 든다 |

## 7. Kiro가 바꾼 결정
spec 검토, hook, 에이전트가 계획이나 코드를 바꾼 사례. 날짜와 커밋을 남긴다.

| 날짜 | 무엇이 | 무엇을 바꿨나 | 커밋 |
|---|---|---|---|
| 2026-11-14 | steering 검토 | "특정 기간에 몰린 5점" 신호를 불확실해서 제외 | `d5a756f` |
| 2026-11-14 | steering 검토 | API Gateway 29초 제한 때문에 리뷰 100개, 25개씩 병렬 판정으로 확정 | `fdcb243` |
| 2026-11-14 | steering 검토 | 부분 세탁의 별점·기간·사진 조건을 LLM 대신 코드가 거르도록 분리 ("숫자는 코드가" 원칙) | __ |
| 2026-11-14 | hook 첫 실행 | guard-shell hook이 자기 스크립트의 문법 오류로 셸을 막는 걸 발견하고 패턴을 고침 | __ |
| __ | | | |
