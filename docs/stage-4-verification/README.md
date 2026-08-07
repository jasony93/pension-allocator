# 4단계 — 검증

`tax-domain`의 독립 교차검증 후 `qa`가 순차로 작업한다.

| 파일 | 작성 유닛 |
|---|---|
| `golden-cases.md` | `tax-domain` |
| `verification-report.md` | `tax-domain` |
| `qa-report.md` | `qa` |

`tax-domain`은 이 단계에서 `src/engine/`을 읽지 않는다. 코드를 보면 코드의 논리에 끌려가 같은 실수를 반복하게 된다.
