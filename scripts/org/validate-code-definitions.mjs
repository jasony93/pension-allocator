// 엔진 계약의 "코드 조건은 한 곳에만 적는다" 규약(engine-interface.md 8.0절)의 기계 강제.
//
// 왜 있나 — M2·M3·D18이 전부 같은 형태의 결함이었다. **하나의 사실을 계약 두 곳에
// 적고 한쪽만 갱신했다.** 세 번 나왔으므로 개별 수정이 아니라 구조를 바꿨고,
// 그 구조가 유지되는지를 여기서 본다.
//
// 무엇을 보는가 — 산문의 뜻은 읽을 수 없으므로 **형태만** 본다. 대신 형태 검사는
// 오탐이 없어야 한다. 오탐이 잦은 검사는 곧 무시당하고 없는 것만 못하다.
//
//   A. 정의 행의 유일성. "첫 열 머리가 `코드`인 표"를 코드의 정의 표로 보고,
//      한 코드의 정의 행이 계약·설계 문서를 통틀어 하나인지 본다.
//      이중 등재는 계약이 명시 선언한 것만 허용하고 **양방향으로** 대조한다.
//   B. 정의 표의 위치. 정의 표는 계약 8.1~8.5절에만 둔다. 다른 절이나
//      engine-design.md에 `코드` 표가 생기면 그것이 두 번째 정의 자리다.
//   C. 정의 표와 src/engine/constants.mjs의 코드 집합이 정확히 같은가.
//   D. 계약이 선언한 "현재 계약 버전"과 SCHEMA_VERSION이 같은가.
//
// 무엇을 못 보는가 — **산문이 조건을 옮겨 적은 것**은 잡지 못한다. 표를 벗어나면
// 어디까지가 조건 서술인지 기계가 가릴 수 없고, 억지로 가리면 정상 참조까지
// 오탐으로 걸린다. 5.6절의 `tie_break.code`도 표 형태가 달라 밖이다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SCHEMA_VERSION,
  ERROR,
  NOTICE,
  ASSUMPTION,
  WARNING,
  COMPARISON_NOTE,
} from '../../src/engine/constants.mjs';

const INTERFACE = 'docs/stage-2-design/engine-interface.md';
const DESIGN = 'docs/stage-2-design/engine-design.md';

/** 정의 표를 둘 수 있는 절. 여기 밖에 `코드` 표가 생기면 두 번째 정의 자리다. */
const DEFINITION_SECTIONS = /^### 8\.[1-5] /;

const DEFINITION_HEADER = '코드';
const EXCEPTION_HEADER = '이중 등재 코드';

/**
 * 조건을 적은 열의 이름. 이 열을 가진 표는 어디에 있든 "코드가 언제 나가는지"를
 * 적은 표로 본다 — 정의 표 다섯 개가 전부 이 이름을 쓰고 있다.
 */
const CONDITION_HEADERS = new Set(['조건', '언제', '무엇을 가정했는가']);
const isConditionTable = (header) =>
  header[0] === DEFINITION_HEADER || header.some((cell) => CONDITION_HEADERS.has(cell));
const CODE_CELL = /^`([a-z0-9_]+)`$/;
const VERSION_LINE = /^\*\*현재 계약 버전: `([^`]+)`\.\*\*$/;

/** `\|`는 셀 안의 문자다. 표 구분자로 쓰이는 것은 앞에 역슬래시가 없는 `|`뿐이다. */
function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

const isTableRow = (line) => line.trim().startsWith('|');
const isSeparator = (line) => /^\|[\s:|-]+\|?$/.test(line.trim());

/**
 * 문서의 모든 표를 (머리말 첫 칸, 절 제목, 행) 형태로 뽑는다.
 * 표를 찾는 것이지 뜻을 읽는 것이 아니다.
 */
function tablesIn(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let heading = '';

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('#')) {
      heading = lines[i];
      continue;
    }
    if (!isTableRow(lines[i]) || !isTableRow(lines[i + 1] ?? '') || !isSeparator(lines[i + 1])) {
      continue;
    }

    const header = cells(lines[i]);
    const rows = [];
    let cursor = i + 2;
    while (cursor < lines.length && isTableRow(lines[cursor])) {
      rows.push({ cells: cells(lines[cursor]), line: cursor + 1 });
      cursor += 1;
    }
    tables.push({ header, heading, rows });
    i = cursor - 1;
  }

  return tables;
}

/** A·B — 정의 행을 모으면서 정의 표의 위치를 함께 본다. */
function collectDefinitions(docs, errors) {
  const definitions = new Map(); // code -> [{ label, line }]

  for (const { label, text, allowDefinitions } of docs) {
    for (const table of tablesIn(text)) {
      if (!isConditionTable(table.header)) continue;

      if (!allowDefinitions || !DEFINITION_SECTIONS.test(table.heading)) {
        errors.push(
          `${label}: 코드 조건 표(머리말 ${table.header.join(' | ')})가 ` +
            `"${table.heading.trim() || '(절 밖)'}"에 있다 — ` +
            '코드가 언제 나가는지를 적은 표는 engine-interface.md 8.1~8.5절에만 둔다(계약 8.0절). ' +
            '다른 곳에서는 조건을 다시 적지 말고 코드 이름으로 가리켜라',
        );
        continue;
      }

      for (const row of table.rows) {
        const match = CODE_CELL.exec(row.cells[0] ?? '');
        if (!match) {
          errors.push(
            `${label}:${row.line}: 정의 표의 첫 칸이 \`코드\` 한 개가 아니다 (받은 값: ${row.cells[0] ?? ''})`,
          );
          continue;
        }
        const found = definitions.get(match[1]) ?? [];
        found.push({ label, line: row.line });
        definitions.set(match[1], found);
      }
    }
  }

  return definitions;
}

/** 계약이 명시 선언한 이중 등재 목록. 선언 자체가 없으면 그것이 오류다. */
function declaredDuplicates(text, errors) {
  const declared = new Set();
  let found = false;

  for (const table of tablesIn(text)) {
    if (table.header[0] !== EXCEPTION_HEADER) continue;
    found = true;
    for (const row of table.rows) {
      const match = CODE_CELL.exec(row.cells[0] ?? '');
      if (match) declared.add(match[1]);
      else errors.push(`${INTERFACE}:${row.line}: 이중 등재 표의 첫 칸이 \`코드\` 한 개가 아니다`);
    }
  }

  if (!found) {
    errors.push(
      `${INTERFACE}: 첫 열이 \`${EXCEPTION_HEADER}\`인 표가 없다 — ` +
        '8.0절의 이중 등재 예외 선언이 사라지면 유일성 검사가 근거를 잃는다',
    );
  }
  return declared;
}

export function validateCodeDefinitions(root) {
  const errors = [];
  const read = (relative) => readFileSync(join(root, relative), 'utf8');

  let interfaceText;
  let designText;
  try {
    interfaceText = read(INTERFACE);
    designText = read(DESIGN);
  } catch (error) {
    return [`엔진 계약 문서를 읽지 못했다: ${error.message}`];
  }

  const definitions = collectDefinitions(
    [
      { label: INTERFACE, text: interfaceText, allowDefinitions: true },
      { label: DESIGN, text: designText, allowDefinitions: false },
    ],
    errors,
  );

  // A — 정의 행의 유일성. 예외는 계약이 선언한 것만, 그리고 양방향으로 본다.
  const declared = declaredDuplicates(interfaceText, errors);

  for (const [code, places] of definitions) {
    const where = places.map((p) => `${p.label}:${p.line}`).join(' · ');
    if (places.length > 1 && !declared.has(code)) {
      errors.push(
        `\`${code}\`의 정의 행이 ${places.length}곳이다 (${where}) — ` +
          '조건은 한 곳에만 적는다. 이중 등재가 맞다면 계약 8.0절의 이중 등재 표에 적어라',
      );
    }
    if (places.length === 1 && declared.has(code)) {
      errors.push(
        `\`${code}\`가 계약 8.0절의 이중 등재 표에 있는데 정의 행은 한 곳뿐이다 (${where}) — ` +
          '예외 목록이 낡았다. 표에서 지워라',
      );
    }
  }

  for (const code of declared) {
    if (!definitions.has(code)) {
      errors.push(`\`${code}\`가 이중 등재 표에 있으나 정의 표 어디에도 없다 — 오타이거나 지워진 코드다`);
    }
  }

  // C — 계약의 코드 집합과 엔진 상수의 코드 집합이 같은가.
  const inCode = new Set([
    ...Object.values(ERROR),
    ...Object.values(NOTICE),
    ...Object.values(ASSUMPTION),
    ...Object.values(WARNING),
    ...Object.values(COMPARISON_NOTE),
  ]);

  for (const code of definitions.keys()) {
    if (!inCode.has(code)) {
      errors.push(`\`${code}\`가 계약 8절에 있으나 src/engine/constants.mjs에 없다 — 엔진이 내지 않는 코드다`);
    }
  }
  for (const code of inCode) {
    if (!definitions.has(code)) {
      errors.push(
        `\`${code}\`가 src/engine/constants.mjs에 있으나 계약 8절의 정의 표에 없다 — ` +
          '문서화되지 않은 코드가 화면에 나간다',
      );
    }
  }

  // D — 계약이 선언한 버전과 엔진이 내는 버전이 같은가. 이것도 한 사실이 두 곳에 적히는 자리다.
  const versionLine = interfaceText.split(/\r?\n/).find((line) => VERSION_LINE.test(line.trim()));
  if (!versionLine) {
    errors.push(`${INTERFACE}: "**현재 계약 버전: \`x.y.z\`.**" 줄을 찾지 못했다`);
  } else {
    const declaredVersion = VERSION_LINE.exec(versionLine.trim())[1];
    if (declaredVersion !== SCHEMA_VERSION) {
      errors.push(
        `계약이 선언한 버전(${declaredVersion})과 SCHEMA_VERSION(${SCHEMA_VERSION})이 다르다`,
      );
    }
  }

  return errors;
}
