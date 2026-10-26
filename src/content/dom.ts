// Tiny DOM helper: h('div', { class: 'row', onclick: fn }, child, 'text').

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2), value as EventListener);
      } else if (key === 'style') {
        el.style.cssText = String(value);
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else if (child != null && child !== false) parent.appendChild(document.createTextNode(String(child)));
  }
}

function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function kbd(...keys: string[]): HTMLElement {
  return h('span', { class: 'keys' }, keys.map((k) => h('span', { class: 'k' }, k)));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Ask the background script to do something content scripts cannot.
function bg<T = unknown>(msg: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

// Calls cb whenever the user grants or revokes a permission, while el is still on screen.
function onPermsChanged(el: Element, cb: () => void): void {
  const listener = (msg: { type?: string }) => {
    if (msg?.type !== 'permsChanged') return;
    if (!el.isConnected) { chrome.runtime.onMessage.removeListener(listener); return; }
    cb();
  };
  chrome.runtime.onMessage.addListener(listener);
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function button(label: string, onClick: () => void, opts: { icon?: string; primary?: boolean } = {}): HTMLButtonElement {
  const b = h('button', { class: opts.primary ? 'btn primary' : 'btn' }, opts.icon ? icon(opts.icon, 16) : null, label);
  b.addEventListener('click', onClick);
  return b;
}

// On/off switch row: label on the left, switch on the right.
function switchRow(label: string, on: boolean, onChange: (on: boolean) => void, note?: string): HTMLElement {
  const sw = h('button', { class: on ? 'switch on' : 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': label }, h('span'));
  sw.addEventListener('click', () => {
    const next = !sw.classList.contains('on');
    sw.classList.toggle('on', next);
    sw.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return h('div', { class: 'swrow2' }, h('div', { class: 'fmeta' }, h('b', { style: 'font-weight:500' }, label), note ? h('span', null, note) : null), sw);
}

function segmented<T extends string>(options: [T, string][], current: T, onPick: (value: T) => void): HTMLElement {
  const wrap = h('div', { class: 'seg' });
  for (const [value, label] of options) {
    const b = h('button', { class: value === current ? 'on' : '' }, label);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onPick(value);
    });
    wrap.append(b);
  }
  return wrap;
}

function section(title: string, ...children: Child[]): HTMLElement {
  return h('div', null, h('p', { class: 'lbl' }, title), ...children);
}

// Hover highlighter shared by tools that pick an element on the page.
function makeHighlighter(layer: HTMLElement, cls = 'hl'): { show(el: Element): void; hide(): void; remove(): void } {
  const box = h('div', { class: cls, style: 'display:none' });
  const tag = h('div', { class: 'hltag', style: 'display:none' });
  layer.append(box, tag);
  return {
    show(el) {
      const r = el.getBoundingClientRect();
      box.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      tag.textContent = `${el.tagName.toLowerCase()} · ${Math.round(r.width)} × ${Math.round(r.height)}`;
      tag.style.cssText = `display:block;left:${Math.max(4, r.left)}px;top:${r.top > 30 ? r.top - 26 : r.bottom + 6}px`;
    },
    hide() { box.style.display = 'none'; tag.style.display = 'none'; },
    remove() { box.remove(); tag.remove(); },
  };
}

// Copy button that briefly shows a check mark.
function copyButton(getText: () => string, label: string): HTMLButtonElement {
  const btn = h('button', { class: 'wbtn', 'aria-label': label, title: label }, icon('copy', 15));
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (await copyText(getText())) {
      btn.replaceChildren(icon('check', 15));
      setTimeout(() => btn.replaceChildren(icon('copy', 15)), 1200);
    }
  });
  return btn;
}
