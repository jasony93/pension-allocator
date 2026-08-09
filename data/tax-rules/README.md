# 세법 룰셋

`tax-domain` 유닛만 이 디렉터리에 쓴다.

- `<연도>.json` — 시행 중인 확정 규칙.
- `<연도>-proposed.json` — 개정예고 규칙. 확정 규칙과 절대 섞지 않는다.

## 범위 — 세법이 아닌 규칙이 하나 있다

디렉터리 이름은 "세법 룰셋"이지만 **계좌의 법적 제약 중 배분 계산에 직접 걸리는 것**도 담는다. 현재 해당하는 규칙은 `pension.withdrawal.midterm_restriction`(근로자퇴직급여 보장법) 하나다.

그런 규칙은 `domain` 필드로 성격을 표시하고 `domain_note`에 사유를 적는다. `domain`이 없으면 세법 규칙이다.

판단 근거와 채택하지 않은 대안은 `docs/stage-1-discovery/tax-rules-report.md` 11.4절에 있다. **범위를 더 넓히려면 그 절을 먼저 고치고 관리자 승인을 받는다** — 근거 없이 늘어나면 이 디렉터리가 "제품에 필요한 모든 사실"의 창고가 된다.

참고한 법령·자료 목록은 `docs/stage-1-discovery/tax-rules-report.md`에 있다. 이 디렉터리에 따로 두지 않는다.

모든 규칙은 `source`(`law`, `url`, `verified_on`, `verified_by`)를 가져야 한다.
`node scripts/org/validate.mjs`가 이를 강제한다.

스키마는 `scripts/org/validate-rules.mjs`가 정의한다.
