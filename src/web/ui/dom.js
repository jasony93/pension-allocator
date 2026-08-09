/** 프레임워크 없는 최소 DOM 헬퍼. 의존성 0 원칙(README)을 유지한다. */

/**
 * 핸들러는 노드에 **한 번만** 붙이고, 실제 함수는 이 맵에서 갈아 끼운다.
 *
 * `patch()`가 노드를 재사용하려면 매 렌더의 새 클로저로 핸들러를 교체할 수
 * 있어야 한다. `addEventListener`는 교체 수단이 없으므로(같은 타입을 다시
 * 붙이면 둘 다 불린다) 디스패처 하나를 붙여 두고 맵만 바꾼다.
 */
const HANDLERS = Symbol('handlers');

function setHandler(node, type, fn) {
  let map = node[HANDLERS];
  if (!map) {
    map = new Map();
    node[HANDLERS] = map;
    // 심볼 프로퍼티는 노드가 사라질 때 함께 사라진다 — 별도 정리가 필요 없다.
  }
  if (!map.has(type)) {
    node.addEventListener(type, (event) => {
      const current = node[HANDLERS].get(type);
      if (current) current(event);
    });
  }
  map.set(type, fn);
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') setHandler(node, key.slice(2).toLowerCase(), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (typeof value === 'boolean') {
      if (value) node.setAttribute(key, '');
    } else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(parent, node) {
  clear(parent);
  parent.append(node);
  return node;
}

// ---------------------------------------------------------------------------
// 커서 위치를 **문자 인덱스가 아니라 유효문자 개수**로 센다
// ---------------------------------------------------------------------------

/**
 * 마스크가 끼워 넣는 구분자(`-`, `,`, 공백 …)는 커서 위치의 기준이 될 수 없다.
 * `19930`(커서 5)이 `1993-0`이 되면 문자 인덱스 5는 `0` **앞**을 가리키고,
 * 그 자리에 다음 글자가 끼어들어 `1993-41-70`이 된다 — 실제 브라우저에서
 * 재현해 잡은 버그다.
 *
 * 그래서 커서를 "앞에 있는 **유효문자**(글자·숫자)의 개수"로 기억하고, 새 값에서
 * 같은 개수의 유효문자 뒤에 놓는다. 마스크가 무엇을 어디에 끼워 넣든 어긋나지
 * 않는다. 천 단위 쉼표를 쓰는 금액 칸에도 같은 규칙이 그대로 성립한다.
 */
const SIGNIFICANT = /[\p{L}\p{N}]/u;

export function significantCount(value, index) {
  const text = String(value ?? '');
  const end = Math.min(Math.max(index ?? 0, 0), text.length);
  let count = 0;
  for (let i = 0; i < end; i++) if (SIGNIFICANT.test(text[i])) count++;
  return count;
}

export function indexAfterSignificant(value, count) {
  const text = String(value ?? '');
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (!SIGNIFICANT.test(text[i])) continue;
    seen++;
    if (seen === count) return i + 1;
  }
  return text.length;
}

// ---------------------------------------------------------------------------
// patch — 지우고 다시 만들지 않고, 있는 노드를 고쳐 쓴다
// ---------------------------------------------------------------------------

/**
 * **왜 `mount`로 갈아치우면 안 되는가.**
 *
 * 입력 패널을 통째로 지우고 다시 만들면 초점을 가진 `input`이 DOM에서 떨어져
 * 나간다. 그 위에 초점·커서 복원을 덧대는 방식이 실제로 낸 결함이 둘이었다 —
 * 커서 인덱스가 마스크와 어긋나 생년월일 순서가 뒤집혔고(위 참조), 다른 칸을
 * 클릭하는 순간 `blur → 재계산 → 재렌더`가 **방금 클릭한 노드**를 갈아치워
 * 클릭 두 번에 한 번은 초점이 붙지 않았다. 둘 다 "복원이 틀렸다"가 아니라
 * **"복원할 일을 만들지 않았어야 했다"**가 원인이다.
 *
 * 그래서 노드를 재사용하고 속성·핸들러·자식만 갱신한다. 초점을 가진 노드가
 * 살아 있으면 초점도 커서도 애초에 잃지 않는다.
 *
 * 구조가 어긋나는 자리(조건부 블록이 생겼다 사라지는 등)에서는 예전처럼 노드를
 * 교체한다 — 그때의 동작은 지금과 같고, 그 자리는 전부 클릭으로만 일어나므로
 * 텍스트 칸이 초점을 가진 채 교체되는 경우가 없다. 교체가 남아 있으므로
 * `renderGuard`(app.js)도 그대로 필요하다.
 */
function isElement(node) {
  return node.nodeType === 1;
}

function structuralKey(node) {
  if (!isElement(node)) return '';
  return node.id || node.getAttribute('data-key') || '';
}

function sameNode(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType === 3) return true; // 텍스트는 내용만 맞추면 된다
  if (!isElement(a)) return false;
  if (a.tagName !== b.tagName) return false;
  // 이름이 같아도 네임스페이스가 다르면 다른 원소다. 이 저장소는 이미
  // "이름은 맞는데 원소가 틀린"(SVG 네임스페이스에 만들어진 div) 버그를 한 번
  // 겪었다 — 그 부류를 고쳐 쓰기가 되살리지 않도록 여기서 막는다.
  if (a.namespaceURI !== b.namespaceURI) return false;
  return structuralKey(a) === structuralKey(b);
}

const VALUE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** 값을 바꿔 쓸 때 커서를 유효문자 개수 기준으로 옮겨 준다. */
function syncControlValue(node, nextValue) {
  if (node.value === nextValue) return;
  const focused = typeof document !== 'undefined' && document.activeElement === node;
  const caretStart = focused && typeof node.selectionStart === 'number' ? significantCount(node.value, node.selectionStart) : null;
  const caretEnd = focused && typeof node.selectionEnd === 'number' ? significantCount(node.value, node.selectionEnd) : null;
  node.value = nextValue;
  if (caretStart == null || typeof node.setSelectionRange !== 'function') return;
  try {
    node.setSelectionRange(indexAfterSignificant(nextValue, caretStart), indexAfterSignificant(nextValue, caretEnd ?? caretStart));
  } catch {
    /* 일부 input type은 setSelectionRange를 지원하지 않는다 — 무시한다 */
  }
}

function syncAttributes(oldNode, newNode) {
  for (const attr of Array.from(newNode.attributes)) {
    if (oldNode.getAttribute(attr.name) !== attr.value) oldNode.setAttribute(attr.name, attr.value);
  }
  for (const attr of Array.from(oldNode.attributes)) {
    if (!newNode.hasAttribute(attr.name)) oldNode.removeAttribute(attr.name);
  }
}

/**
 * 사용자가 한 번이라도 친 `input`은 **속성(`value=`)이 아니라 프로퍼티**가
 * 화면에 보이는 값이다(dirty value flag). 속성만 맞추면 갱신이 반영되지 않으므로
 * 프로퍼티를 따로 맞춘다. 체크박스의 `checked`도 같은 이유로 따로 맞춘다.
 */
function syncFormState(oldNode, newNode) {
  if (!VALUE_TAGS.has(oldNode.tagName)) return;
  if (oldNode.type === 'checkbox' || oldNode.type === 'radio') {
    const next = newNode.hasAttribute('checked');
    if (oldNode.checked !== next) oldNode.checked = next;
    return;
  }
  if (newNode.hasAttribute('value')) syncControlValue(oldNode, newNode.getAttribute('value'));
}

function syncHandlers(oldNode, newNode) {
  const next = newNode[HANDLERS];
  const prev = oldNode[HANDLERS];
  if (prev) for (const type of prev.keys()) if (!next || !next.has(type)) prev.set(type, null);
  if (next) for (const [type, fn] of next) setHandler(oldNode, type, fn);
}

function patchNode(oldNode, newNode) {
  if (oldNode.nodeType === 3) {
    if (oldNode.nodeValue !== newNode.nodeValue) oldNode.nodeValue = newNode.nodeValue;
    return oldNode;
  }
  syncAttributes(oldNode, newNode);
  syncFormState(oldNode, newNode);
  syncHandlers(oldNode, newNode);
  patchChildren(oldNode, newNode);
  return oldNode;
}

function patchChildren(oldParent, newParent) {
  const oldKids = Array.from(oldParent.childNodes);
  const newKids = Array.from(newParent.childNodes);
  for (let i = 0; i < newKids.length; i++) {
    const incoming = newKids[i];
    const existing = oldKids[i];
    if (!existing) oldParent.append(incoming);
    else if (sameNode(existing, incoming)) patchNode(existing, incoming);
    else oldParent.replaceChild(incoming, existing);
  }
  for (let i = newKids.length; i < oldKids.length; i++) oldParent.removeChild(oldKids[i]);
}

/**
 * `mount`과 같은 자리에 쓰되, 이미 같은 종류의 트리가 있으면 그것을 고쳐 쓴다.
 * 반환값은 **화면에 실제로 남은 노드**다(재사용했으면 기존 노드).
 */
export function patch(parent, nextTree) {
  const current = parent.firstChild;
  if (!current || parent.childNodes.length !== 1 || !sameNode(current, nextTree)) return mount(parent, nextTree);
  return patchNode(current, nextTree);
}

export const svgNS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, props = {}, children = []) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}
