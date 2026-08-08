/** 프레임워크 없는 최소 DOM 헬퍼. 의존성 0 원칙(README)을 유지한다. */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
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
