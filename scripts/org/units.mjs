export const REQUIRED_SECTIONS = ['역할', '입력', '산출물', '금지사항', '완료 기준'];

/**
 * 조직 유닛의 단일 진실 원천.
 * 에이전트 정의 파일의 tools/model이 여기서 벗어나면 검증 실패다.
 * 권한을 넓히려면 이 표를 먼저 고치고 그 변경을 리뷰받아야 한다.
 */
export const UNITS = [
  {
    name: 'product-planner',
    model: 'sonnet',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'],
    writeScope: ['docs/stage-1-discovery/requirements.md'],
  },
  {
    name: 'tax-domain',
    model: 'opus',
    // D24와 같은 이유로 Bash를 준다. 이 유닛의 완료 기준이 `node scripts/org/validate.mjs`와
    // 골든 케이스 실행인데 셸이 없어 두 번 연속으로 "돌리지 못했다"고 보고했다.
    // 확인이 사라진 것이 아니라 관리자에게 조용히 옮겨왔을 뿐이다.
    // **`src/engine/`을 읽지 않는 4단계 금지는 그대로다** — 도구가 아니라 규약이 막는다.
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Bash'],
    writeScope: [
      'docs/stage-1-discovery/tax-rules-report.md',
      'data/tax-rules/',
      'docs/stage-4-verification/golden-cases.md',
      'docs/stage-4-verification/verification-report.md',
    ],
  },
  {
    name: 'designer',
    model: 'sonnet',
    // Bash·WebFetch가 있어야 하는 이유: 이 유닛의 결정 대부분이 **재야 하는**
    // 것이다. 팔레트 검증기를 돌려야 색을 고를 수 있고(눈으로 고르지 말라는
    // 것이 dataviz 규약이다), 개발 서버로 지금 화면을 봐야 무엇이 문제인지
    // 진단할 수 있으며, 소유자가 참고 사이트를 주면 열어 봐야 한다. 도구 없이
    // 맡겼더니 검증이 필요 없는 안전한 안만 나왔다 — 판단이 아니라 도구가
    // 결론을 정한 것이다.
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebFetch'],
    writeScope: ['docs/stage-2-design/design-system.md', 'docs/stage-2-design/screens.md'],
  },
  {
    name: 'calc-engine-dev',
    model: 'opus',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
    writeScope: [
      'docs/stage-2-design/engine-design.md',
      'docs/stage-2-design/engine-interface.md',
      'src/engine/',
    ],
  },
  {
    name: 'web-dev',
    model: 'sonnet',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
    writeScope: ['src/web/'],
  },
  {
    name: 'qa',
    model: 'sonnet',
    tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
    // `scripts/qa/`는 D62로 열었다. `qa`가 게이트 4에서 검사 둘을 만들었는데
    // **저장소에 넣을 자리가 없어 보고서 본문에만 남았다** — 다음 회차에
    // 아무것도 돌지 않는다. 검사를 만드는 것이 이 유닛의 일인데 그것을 둘 곳이
    // 없었던 것이므로, 범위가 산출물의 모양을 바꾸고 있었다.
    //
    // `scripts/org/`는 열지 않는다 — 검증기 자체는 관리자 것이고, 유닛이
    // 자기를 검사하는 장치를 자기가 고치면 그 검사가 무엇을 지키는지 흐려진다.
    writeScope: ['docs/stage-4-verification/qa-report.md', 'docs/stage-6-operations/', 'scripts/qa/'],
  },
  // `qa`·`growth`·`biz-model`은 `docs/stage-6-operations/`를 디렉터리 단위로 공유한다.
  // 검증기는 디렉터리까지만 강제하므로, 한 파일에 한 저자라는 원칙은
  // 유닛별 파일명 규약(`<YYYY-MM>-qa.md` / `-growth.md` / `-biz.md`)이 지탱한다.
  // 규약을 바꾸려면 각 유닛 정의 파일의 `## 산출물`과 6단계 README를 함께 고쳐야 한다.
  {
    name: 'growth',
    model: 'sonnet',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    writeScope: [
      'docs/stage-1-discovery/channel-research.md',
      'docs/stage-2-design/analytics-plan.md',
      'docs/stage-5-launch/',
      'docs/stage-6-operations/',
    ],
  },
  {
    name: 'biz-model',
    model: 'sonnet',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    writeScope: [
      'docs/stage-1-discovery/demand-validation-plan.md',
      'docs/stage-6-operations/',
    ],
  },
];
