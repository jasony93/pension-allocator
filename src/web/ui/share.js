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
import { ACCOUNT_LABEL, PLAN_LABEL, SERVICE_NAME, DISCLOSURE } from '../copy.js';
import { formatKrw, formatPercent } from '../format.js';
import { CHART_ACCOUNT_ORDER } from './charts.js';

function shareableSummary(plan, scenario) {
  const total = plan.allocations.reduce((s, a) => s + a.annual_krw, 0) + plan.unallocated_annual_krw;
  const rows = CHART_ACCOUNT_ORDER.map((account) => {
    const a = plan.allocations.find((x) => x.account === account);
    const pct = total > 0 ? a.annual_krw / total : 0;
    return { label: ACCOUNT_LABEL[account], monthly: a.monthly_krw, pct };
  });
  return {
    planLabel: PLAN_LABEL[plan.plan_id],
    rows,
    creditTotal: plan.deterministic_benefit.pension_credit_total_krw,
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
  ctx.fillText(formatKrw(summary.creditTotal), 24, 130);
  ctx.font = '400 12px sans-serif';
  ctx.fillStyle = '#4a535c';
  ctx.fillText(
    `${summary.taxYear} 과세연도 기준 · ${summary.planLabel} · 국세+개인지방소득세 합산`,
    24,
    150,
  );
  if (summary.isProposed) {
    ctx.fillStyle = '#2f5d8c';
    ctx.fillText('정부안 · 국회 통과 전 시나리오', 24, 168);
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
    el('p', { class: 'type-display-sub' }, [formatKrw(summary.creditTotal)]),
    el('p', { class: 'type-caption' }, [`${summary.taxYear} 과세연도 기준 · ${summary.planLabel}`]),
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
      '나이·소득·월 납입 여력·기납입액 등 입력값은 이 이미지에 포함되지 않습니다.',
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
