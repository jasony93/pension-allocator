import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateAgents } from './validate-agents.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const checks = [['에이전트 정의', () => validateAgents(join(ROOT, '.claude', 'agents'))]];

let failed = 0;
for (const [label, run] of checks) {
  const errors = run();
  if (errors.length === 0) {
    console.log(`OK   ${label}`);
  } else {
    failed += errors.length;
    console.log(`FAIL ${label} (${errors.length}건)`);
    for (const error of errors) console.log(`  - ${error}`);
  }
}

if (failed > 0) {
  console.log(`\n총 ${failed}건의 규약 위반이 있습니다.`);
  process.exit(1);
}
console.log('\n모든 조직 규약 검사를 통과했습니다.');
