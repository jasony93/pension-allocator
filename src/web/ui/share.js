/**
 * 저장·공유 — `screens.md` 9절. 미리보기를 먼저 보여준 뒤 내보낸다.
 *
 * **이미지에 포함되는 것**: 계좌별 배분 금액과 비율, 절감세액, 기준 과세연도,
 * 적용 법령 조항, 고지 ①②③(요약)⑤, 개정예고 배지(해당 시), 가명칭 워터마크.
 * **포함되지 않는 것**: 나이·총급여액·월 납입 여력·기납입액 등 입력값 전부.
 * 이 모듈은 `plan`·`scenario`에서 계좌별 배분 결과와 법령 근거만 읽는다 —
 * 폼 상태(form) 자체를 인자로 받지 않는다. 받지 않으면 실수로라도 개인 값이
 * 새어 나갈 방법이 없다.
 */

import { el } from './dom.js';
import {
  ACCOUNT_LABEL,
  PLAN_LABEL,
  SERVICE_NAME,
  DISCLOSURE,
  BOUNDED_AMOUNT_PREFIX,
  boundedDirectionNote,
  capReducedNote,
  AMOUNT_CARD_CAPTION_ZERO_CLAUSE,
} from '../copy.js';
import { formatKrw, formatPercent } from '../format.js';
import { CHART_ACCOUNT_ORDER } from './charts.js';
import { taxCreditHeadlineView, HEADLINE_MODE } from '../tax-credit-view.js';

/**
 * **화면에서는 조건이 붙은 금액이 이미지에서는 조건 없이 나가는 상태를 만들지
 * 않는다**(`screens.md` 9절). 이미지는 화면 밖으로 나가면 정정할 기회가 없고,
 * 조건 없는 금액 표시는 헌장이 정면으로 금지한 것이다. 그래서 헤드라인 표기를
 * 화면과 **같은 함수**(`taxCreditHeadlineView`)로 고른다 — 두 곳에서 따로
 * 판정하면 한쪽만 고쳐진다.
 */
export function shareHeadline(plan) {
  const view = taxCreditHeadlineView(plan);
  if (view.mode === HEADLINE_MODE.BOUNDED) {
    return {
      amountText: `${BOUNDED_AMOUNT_PREFIX} ${formatKrw(view.totalKrw)}`,
      conditionText: view.thresholdIncomeTaxKrw != null ? boundedDirectionNote(view.thresholdIncomeTaxKrw) : '',
    };
  }
  if (view.mode === HEADLINE_MODE.ZERO) {
    return { amountText: formatKrw(view.totalKrw), conditionText: AMOUNT_CARD_CAPTION_ZERO_CLAUSE };
  }
  if (view.mode === HEADLINE_MODE.REDUCED) {
    return { amountText: formatKrw(view.totalKrw), conditionText: capReducedNote(view.beforeCapKrw, view.reducedTotalKrw) };
  }
  return { amountText: formatKrw(view.totalKrw), conditionText: '' };
}

function shareableSummary(plan, scenario) {
  const total = plan.allocations.reduce((s, a) => s + a.annual_krw, 0) + plan.unallocated_annual_krw;
  const rows = CHART_ACCOUNT_ORDER.map((account) => {
    const a = plan.allocations.find((x) => x.account === account);
    const pct = total > 0 ? a.annual_krw / total : 0;
    return { label: ACCOUNT_LABEL[account], monthly: a.monthly_krw, pct };
  });
  const headline = shareHeadline(plan);
  return {
    planLabel: PLAN_LABEL[plan.plan_id],
    rows,
    headline,
    taxYear: scenario.ruleset.tax_year,
    lawEntries: scenario.legal_basis.map((l) => l.law),
    isProposed: !scenario.is_enacted,
  };
}

function drawToCanvas(summary) {
  const width = 640;
  const height = 520 + summary.lawEntries.length * 20;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#14181c';
  ctx.font = '600 14px sans-serif';
  ctx.fillText(SERVICE_NAME, 24, 32);
  ctx.font = '400 11px sans-serif';
  ctx.fillStyle = '#4a535c';
  ctx.fillText(DISCLOSURE.nature, 24, 56, width - 48);
  ctx.fillText(DISCLOSURE.qualification, 24, 74, width - 48);

  ctx.fillStyle = '#14181c';
  ctx.font = '700 28px sans-serif';
  ctx.fillText(summary.headline.amountText, 24, 130);
  ctx.font = '400 12px sans-serif';
  ctx.fillStyle = '#4a535c';
  ctx.fillText(
    `${summary.taxYear} 과세연도 기준 · ${summary.planLabel} · 국세+개인지방소득세 합산`,
    24,
    150,
  );
  let conditionY = 168;
  // 상한 접두가 붙은 금액은 그 조건 한 줄이 **같은 이미지 안에** 함께 들어간다.
  if (summary.headline.conditionText) {
    ctx.fillText(summary.headline.conditionText, 24, conditionY, width - 48);
    conditionY += 18;
  }
  if (summary.isProposed) {
    ctx.fillStyle = '#2f5d8c';
    ctx.fillText('정부안 · 국회 통과 전 시나리오', 24, conditionY);
  }

  let y = 200;
  ctx.fillStyle = '#14181c';
  ctx.font = '600 13px sans-serif';
  for (const row of summary.rows) {
    ctx.fillText(`${row.label}   ${formatKrw(row.monthly)} / 월   (${formatPercent(row.pct)})`, 24, y);
    y += 22;
  }

  y += 12;
  ctx.font = '600 12px sans-serif';
  ctx.fillText('적용한 법령 조항', 24, y);
  y += 18;
  ctx.font = '400 11px sans-serif';
  ctx.fillStyle = '#4a535c';
  for (const law of summary.lawEntries) {
    ctx.fillText(`· ${law}`, 24, y, width - 48);
    y += 18;
  }

  y += 10;
  ctx.font = '400 10.5px sans-serif';
  for (const line of DISCLOSURE.limit) {
    ctx.fillText(line, 24, y, width - 48);
    y += 16;
  }

  return canvas;
}

export function openShareModal({ plan, scenario, onExport, onClose }) {
  const summary = shareableSummary(plan, scenario);

  const previewList = el(
    'ul',
    { class: 'share-preview-list' },
    summary.rows.map((r) => el('li', {}, [`${r.label} — ${formatKrw(r.monthly)} / 월 (${formatPercent(r.pct)})`])),
  );

  const body = el('div', { class: 'share-modal-body' }, [
    el('p', { class: 'type-body-strong' }, [SERVICE_NAME]),
    el('p', { class: 'type-caption' }, [DISCLOSURE.nature]),
    el('p', { class: 'type-caption' }, [DISCLOSURE.qualification]),
    el('p', { class: 'type-display-sub' }, [summary.headline.amountText]),
    el('p', { class: 'type-caption' }, [`${summary.taxYear} 과세연도 기준 · ${summary.planLabel}`]),
    summary.headline.conditionText ? el('p', { class: 'type-caption' }, [summary.headline.conditionText]) : null,
    previewList,
    el(
      'ul',
      { class: 'share-preview-list type-caption' },
      summary.lawEntries.map((law) => el('li', {}, [law])),
    ),
    el(
      'div',
      { class: 'limit-note' },
      DISCLOSURE.limit.map((line) => el('p', {}, [line])),
    ),
    el('p', { class: 'type-caption share-warning' }, [
      '배분 금액의 합계로 월 납입 여력이 추정될 수 있습니다.',
    ]),
    el('p', { class: 'type-caption' }, [
      // 3.7.5절 못 일곱 중 일곱 번째 — 목록에 `나이`로만 적혀 있던 자리를
      // `생년월일`로 교체했다. 이미지에는 만 나이조차 싣지 않는다.
      '생년월일·만 나이·총급여액·직전 과세연도 결정세액·월 납입 여력·기납입액 등 입력값은 이 이미지에 포함되지 않습니다.',
    ]),
  ]);

  const closeBtn = el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => close() }, ['닫기']);
  const exportBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary',
      onclick: () => {
        const canvas = drawToCanvas(summary);
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'allocation-result.png';
          a.click();
          URL.revokeObjectURL(url);
        });
        onExport?.();
      },
    },
    ['이미지로 저장'],
  );

  const overlay = el('div', { class: 'modal-scrim', onclick: (e) => { if (e.target === overlay) close(); } }, [
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '결과 저장·공유 미리보기' }, [
      el('h2', { class: 'type-title-m' }, ['저장·공유 미리보기']),
      body,
      el('div', { class: 'modal-actions' }, [exportBtn, closeBtn]),
    ]),
  ]);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    onClose?.();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);
  document.body.append(overlay);
  exportBtn.focus();
  return { close };
}
