# 세법 룰셋

`tax-domain` 유닛만 이 디렉터리에 쓴다.

- `<연도>.json` — 시행 중인 확정 규칙.
- `<연도>-proposed.json` — 개정예고 규칙. 확정 규칙과 절대 섞지 않는다.

참고한 법령·자료 목록은 `docs/stage-1-discovery/tax-rules-report.md`에 있다. 이 디렉터리에 따로 두지 않는다.

모든 규칙은 `source`(`law`, `url`, `verified_on`, `verified_by`)를 가져야 한다.
`node scripts/org/validate.mjs`가 이를 강제한다.

스키마는 `scripts/org/validate-rules.mjs`가 정의한다.
