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
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    writeScope: ['docs/stage-1-discovery/requirements.md'],
  },
  {
    name: 'tax-domain',
    model: 'opus',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
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
    writeScope: ['docs/stage-4-verification/qa-report.md', 'docs/stage-6-operations/'],
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
