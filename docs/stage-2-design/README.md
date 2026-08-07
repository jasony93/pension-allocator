# 2단계 — 설계

`designer`, `calc-engine-dev`, `growth`가 동시에 작업한다.

| 파일 | 작성 유닛 |
|---|---|
| `design-system.md` | `designer` |
| `screens.md` | `designer` |
| `engine-design.md` | `calc-engine-dev` |
| `engine-interface.md` | `calc-engine-dev` |
| `analytics-plan.md` | `growth` |

계측 설계가 여기 있는 이유는 무엇을 측정할지가 설계 결정이기 때문이다. 화면이 다 만들어진 뒤에 이벤트를 심으려면 화면을 다시 뜯어야 하고, 그 시점의 압박 아래서 가장 먼저 잘려 나가는 것이 계측이다.

게이트 2에서 엔진 인터페이스가 고정된다. 이후 변경은 관리자 승인이 필요하다 — `web-dev`가 그 계약에 맞춰 작업 중이기 때문이다.
