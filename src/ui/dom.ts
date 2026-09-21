type Attrs = Record<string, string | number | boolean | null | undefined>;

/**
 * Terse element builder: el('button.btn.btn--primary', { type: 'button' }, 'Play').
 * The tag comes from a string, so the element type is supplied explicitly where
 * it matters: el<HTMLCanvasElement>('canvas').
 */
export function el<T extends HTMLElement = HTMLElement>(
  spec: string,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): T {
  const [head, ...classes] = spec.split('.');
  const node = document.createElement(head || 'div');

  if (classes.length) node.className = classes.join(' ');

  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') {
      node.textContent = String(v);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }

  for (const c of children) {
    if (c === null || c === undefined) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  return node as T;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Sizes a canvas to its CSS box at device pixel ratio and returns the context. */
export function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  const want = { w: Math.round(w * dpr), h: Math.round(h * dpr) };
  if (canvas.width !== want.w || canvas.height !== want.h) {
    canvas.width = want.w;
    canvas.height = want.h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}
