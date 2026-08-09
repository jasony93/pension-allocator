/**
 * `Modal` / `BottomSheet` — design-system 5.18절의 뼈대.
 *
 * **왜 이 파일이 생겼나.** 초기화 버튼이 `window.confirm()`을 쓰고 있었다.
 * 아티팩트는 `sandbox="allow-scripts"` iframe 안에서 도는데 `allow-modals`가
 * 없으면 `confirm()`은 **아무것도 띄우지 않고 `false`를 돌려준다.** 그래서
 * `store.reset()`이 아예 불리지 않았고 버튼이 죽은 것처럼 보였다. 브라우저 모달은
 * ① 실행 환경이 조용히 막을 수 있고 ② 테스트에서 그 실패가 드러나지 않으며
 * ③ 디자인 통제 밖이다. 확인은 화면 안에서 받는다.
 *
 * 5.18절이 요구하는 것을 여기서 한 곳에 구현한다 — 포커스 트랩, `Esc` 닫기,
 * 열릴 때 배경 스크롤 잠금, 닫히면 **트리거로 포커스 복귀**. `share.js`가 따로
 * 갖고 있던 모달 뼈대도 이것으로 모았다(그쪽에는 트랩·스크롤 잠금·포커스 복귀가
 * 빠져 있었다).
 */

import { el } from './dom.js';

const FOCUSABLE = 'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

function focusableIn(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((node) => !node.hasAttribute('disabled'));
}

/**
 * @param {object} opts
 * @param {string} opts.label      `aria-label` — 이 대화상자가 무엇인지.
 * @param {Node[]} opts.body       내용 노드들.
 * @param {Node[]} opts.actions    하단 버튼들. 첫 번째가 열릴 때 포커스를 받는다.
 * @param {() => void} [opts.onClose]
 * @returns {{ close: () => void, root: HTMLElement }}
 */
export function openModal({ label, body, actions, onClose }) {
  // 닫히면 여기로 포커스를 돌려준다(5.18절). 트리거를 인자로 받지 않는 이유는
  // 호출부가 잊으면 조용히 어긋나기 때문이다 — 열리는 순간의 사실을 그대로 쓴다.
  const trigger = document.activeElement;
  const previousOverflow = document.body.style.overflow;

  const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, [
    ...body,
    el('div', { class: 'modal-actions' }, actions),
  ]);

  const scrim = el(
    'div',
    {
      class: 'modal-scrim',
      onclick: (e) => {
        if (e.target === scrim) close();
      },
    },
    [dialog],
  );

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    scrim.remove();
    document.removeEventListener('keydown', onKeydown, true);
    document.body.style.overflow = previousOverflow;
    if (trigger && typeof trigger.focus === 'function' && trigger.isConnected) trigger.focus({ preventScroll: true });
    onClose?.();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    // 포커스 트랩 — 대화상자 밖으로 탭이 새면 뒤에 있는 입력 칸을 만질 수 있게
    // 되고, 그러면 "확인을 받는 중"이라는 상태가 거짓말이 된다.
    const items = focusableIn(dialog);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', onKeydown, true);
  document.body.style.overflow = 'hidden';
  document.body.append(scrim);
  (focusableIn(dialog)[0] ?? dialog).focus?.({ preventScroll: true });

  return { close, root: scrim };
}

/**
 * 되돌릴 수 없는 동작 앞의 확인 — `window.confirm()`의 자리를 대신한다.
 *
 * 기본 포커스는 **취소**에 둔다. `Enter`가 눌린 채로 열려도 값이 지워지지
 * 않는다. 실행 버튼은 design-system 5.4절의 `danger` 변종이다.
 */
export function openConfirm({ title, body, acceptLabel, cancelLabel, onAccept }) {
  let modal;
  const cancel = el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, [cancelLabel]);
  const accept = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-danger',
      onclick: () => {
        modal.close();
        onAccept();
      },
    },
    [acceptLabel],
  );
  modal = openModal({
    label: title,
    body: [el('h2', { class: 'type-title-m' }, [title]), el('p', { class: 'type-body-s' }, [body])],
    // 순서가 곧 포커스 순서다 — 먼저 오는 것이 열릴 때 포커스를 받는다.
    actions: [cancel, accept],
  });
  return modal;
}
