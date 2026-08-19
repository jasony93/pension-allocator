/**
 * 연금 역산기 세 컴포넌트(`statutory-fact-block.js`·`contribution-amount-bar.js`·
 * `withdrawal-strategy-cards.js`)가 함께 쓰는 아주 작은 헬퍼. 계산은 하지
 * 않는다 — 엔진이 낸 값을 표시 형태로만 옮긴다.
 */

import { el } from './dom.js';
import { formatKrw } from '../format.js';
import { TODAY_CURRENCY_NOTE } from '../reverse-copy.js';

/**
 * `legal_basis[]`에서 `rule_id` 목록에 해당하는 항목만 골라낸다(5.7절).
 * 이름 앞에 `reverse`를 붙인다 — `ui/eligibility.js`도 같은 이름의 헬퍼를
 * 갖고 있고, 배포 빌드(`scripts/build.mjs`)가 모든 모듈을 한 스코프로
 * 합치므로 최상위 이름이 겹치면 안 된다.
 */
export function reverseLawEntriesFor(legalBasis, ruleIds) {
  if (!ruleIds || !ruleIds.length || !Array.isArray(legalBasis)) return [];
  const set = new Set(ruleIds);
  return legalBasis.filter((entry) => set.has(entry.rule_id));
}

/**
 * `LawChip` 행(design-system 5.9절). **이 블록의 어떤 금액·판정도 `LawChip`
 * 없이 서지 않는다**(5.34절) — 근거가 없으면 이 함수는 `null`을 돌려주고,
 * 호출부가 그 항목 자체를 그리지 않아야 한다(근거 없는 항목은 이 블록에
 * 올리지 않는다). `ui/result-panel.js`도 같은 이름의 헬퍼를 가지므로 여기도
 * `reverse` 접두어로 이름을 가른다.
 */
export function reverseLawChipRow(entries) {
  if (!entries.length) return null;
  return el(
    'p',
    { class: 'note-laws' },
    entries.map((entry) => el('span', { class: 'law-chip' }, [entry.law])),
  );
}

/** AC-R24 — 모든 금액 표시는 "오늘 화폐 기준" 문구를 동반한다. 금액을 만들지 않는다 — 표시만 만든다. */
export function amountWithTodayCurrency(amountKrw) {
  return `${formatKrw(amountKrw)} (${TODAY_CURRENCY_NOTE})`;
}
