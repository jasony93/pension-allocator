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
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch'],
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
    writeScope: ['docs/stage-4-verification/qa-report.md'],
  },
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
