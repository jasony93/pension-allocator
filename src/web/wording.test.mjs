import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creditHeadroomCaption, contributionRemainingCaption, isaTaxFreeCaption } from './copy.js';

/**
 * 문구 규약의 정적 검사 — `design-system.md` 7.1절이 확정한 것:
 * **"잔여 한도"를 수식어 없이 쓰지 않는다.**
 *
 * 이 제품에는 성격이 다른 한도가 둘 있다. 넘을 수 없는 **납입 잔여 한도**
 * (`contribution_limit_remaining_krw`)와, **넘을 수 있는** 세액공제 인정 여지
 * (`credit_eligible_limit_remaining_krw` · `pension_combined_credit_remaining_krw`)다.
 * 후자에 "한도"라고 이름을 붙이면 개정안 청년 우대에서 배분액이 그 값을 넘는
 * 순간 화면이 사실과 어긋난다 — 4단계가 잡은 M1과 같은 뿌리다.
 *
 * 사람이 매번 기억하는 대신 테스트가 잡는다.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js') && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

/** 주석을 걷어낸 소스 — 규약은 화면에 나가는 문구에 걸린다. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('no screen string says "잔여 한도" without saying which limit it is', () => {
  const offenders = [];
  for (const file of walk(here)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const line of code.split('\n')) {
      let index = line.indexOf('잔여 한도');
      while (index !== -1) {
        const qualified = line.slice(Math.max(0, index - 3), index) === '납입 ';
        if (!qualified) offenders.push({ file: path.relative(here, file), line: line.trim().slice(0, 100) });
        index = line.indexOf('잔여 한도', index + 1);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `수식어 없는 "잔여 한도"가 남아 있습니다:\n${offenders.map((o) => `  ${o.file}: ${o.line}`).join('\n')}`,
  );
});

test('the credit headroom caption never calls itself a limit', () => {
  // 이 값은 배분 상한이 아니다(계약 5.3절). 이름에 "한도"가 들어가면 그 사실이 무너진다.
  const caption = creditHeadroomCaption(9000000);
  assert.ok(!caption.includes('한도'), caption);
  assert.ok(caption.includes('세액공제가 더 인정될 수 있는 금액'));
  assert.ok(caption.includes('(연금저축·IRP 합산)'), '계좌마다 적으면 사용자가 둘을 더한다');
});

test('the contribution caption names the limit it means, and the ISA caption stays a limit', () => {
  assert.ok(contributionRemainingCaption(18000000, 0.5).startsWith('납입 잔여 한도'));
  // 비과세 한도는 진짜 한도이므로 그렇게 부른다. 다만 절감액이 아니라는 것을 문장이 말한다.
  const isa = isaTaxFreeCaption(4000000);
  assert.ok(isa.includes('비과세 한도'));
  assert.ok(isa.includes('위 절세액에 들어 있지 않습니다'));
});
