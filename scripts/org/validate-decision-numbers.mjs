// 게이트 판정 번호가 두 결정을 가리키는 것을 막는다.
//
// **왜 이 검사가 있나.** `gate-decisions.md`는 append-only라 「끝에 붙이면 다음
// 번호」가 참이라고 여기기 쉽다. 그 가정은 **적는 사람이 문서의 마지막 상태를
// 보고 있을 때만** 참이다 — 세션이 여럿 돌면 앞서간 판정을 못 본 채 이어 붙게
// 되고, 그러면 같은 번호가 두 결정을 가리킨다. 실제로 세 번 났다(D32 · D33 ·
// 관리자가 D46으로 적었다가 D59로 고친 것).
//
// **번호가 겹치면 인용이 갈라진다.** 다른 문서와 코드 주석이 「D33이 정했다」로
// 근거를 대는데, D33이 둘이면 그 근거가 어느 쪽인지 문장 밖에서 정해진다.
//
// **이 검사가 못 잡는 것.**
// - **이미 겹쳐 있는 것을 고쳐 주지 않는다.** 새로 겹치는 것만 막는다. 기존
//   중복은 사람이 판정 본문에서 갈라 놓아야 한다(아래 ACKNOWLEDGED 참조).
// - **번호가 같은지만 본다.** 서로 다른 번호가 같은 결정을 두 번 적은 것은
//   못 잡는다.
// - **`###` 후속 절은 세지 않는다.** 같은 판정에 나중 회차가 덧붙인 기록이라
//   중복이 아니다 — 이것을 중복으로 세면 실제로 열여섯 건이 잡히고 그중
//   열넷이 오탐이다.
import { readFileSync, existsSync } from 'node:fs';

// 이미 겹쳐 있는 것 — 새로 늘어나는 것만 막기 위해 여기 이름으로 적어 둔다.
// **줄이는 방향으로만 고친다.** 여기에 번호를 더하려면 그 이유가 판정으로
// 남아야 한다.
const ACKNOWLEDGED = new Map([
  ['D32', '게이트 3 회차와 게이트 4 회차가 같은 번호를 썼다. 본문이 각각 무엇을 정했는지 적고 있다.'],
  ['D33', '위와 같다.'],
]);

export function validateDecisionNumbers(path) {
  if (!existsSync(path)) return [`${path}: 게이트 판정 기록을 찾지 못했다`];
  const text = readFileSync(path, 'utf8');

  // `## D12 — 제목` 만 정의로 본다. `###`는 후속 절이라 세지 않는다.
  const defined = new Map();
  for (const m of text.matchAll(/^##\s+(D\d+)\s*[—-]\s*(.*)$/gm)) {
    const [, number, title] = m;
    if (!defined.has(number)) defined.set(number, []);
    defined.get(number).push(title.trim());
  }

  const errors = [];
  for (const [number, titles] of defined) {
    if (titles.length < 2) continue;
    if (ACKNOWLEDGED.has(number)) continue;
    errors.push(
      `${number}가 ${titles.length}개 판정을 가리킨다 — ${titles.map((t) => `「${t.slice(0, 40)}」`).join(' 대 ')}`,
    );
  }

  // 알려진 중복이 실제로 고쳐졌으면 목록에서 빼야 한다. 안 빼면 다음에 같은
  // 번호가 새로 겹쳐도 이 검사가 눈감는다.
  for (const [number, why] of ACKNOWLEDGED) {
    const count = defined.get(number)?.length ?? 0;
    if (count < 2) errors.push(`${number}는 더 이상 겹치지 않는다 — ACKNOWLEDGED에서 빼라 (${why})`);
  }

  return errors;
}
