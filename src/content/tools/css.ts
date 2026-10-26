// CSS inspector: hover to see an element's box and styles, click to pin, edit values live.

const CSS_PROPS = [
  'display', 'position', 'width', 'height', 'margin', 'padding', 'gap',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'color', 'background-color', 'border', 'border-radius', 'box-shadow', 'opacity', 'z-index',
];
const COLOR_PROPS = new Set(['color', 'background-color']);
const SKIP_VALUES = new Set(['none', 'normal', 'auto', '0px', 'rgba(0, 0, 0, 0)', 'static', 'visible']);

function elementLabel(el: Element): string {
  let s = el.tagName.toLowerCase();
  if (el.id) s += `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 2);
  if (classes.length) s += `.${classes.join('.')}`;
  return s;
}

function sides(cs: CSSStyleDeclaration, prop: 'margin' | 'padding'): string {
  const v = ['top', 'right', 'bottom', 'left'].map((side) => parseFloat(cs.getPropertyValue(`${prop}-${side}`)) || 0).map((n) => Math.round(n * 10) / 10);
  if (v.every((n) => n === v[0])) return String(v[0]);
  if (v[0] === v[2] && v[1] === v[3]) return `${v[0]} ${v[1]}`;
  return v.join(' ');
}

function mountCss(ctx: ToolCtx): () => void {
  let hovered: Element | null = null;
  let pinned: Element | null = null;
  const box = h('div', { class: 'hl', style: 'display:none' });
  const tag = h('div', { class: 'hltag', style: 'display:none' });
  ctx.layer.append(box, tag);
  ctx.body.append(h('p', { class: 'muted' }, t('cssEmpty')));

  function place(el: Element): void {
    const r = el.getBoundingClientRect();
    box.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    box.classList.toggle('pinned', el === pinned);
    tag.textContent = `${elementLabel(el)} · ${Math.round(r.width)} × ${Math.round(r.height)}`;
    tag.style.cssText = `display:block;left:${Math.max(4, r.left)}px;top:${r.top > 30 ? r.top - 26 : r.bottom + 6}px`;
  }

  function render(el: Element): void {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const chain: Element[] = [];
    for (let cur: Element | null = el; cur && chain.length < 4 && cur !== document.documentElement; cur = cur.parentElement) chain.unshift(cur);

    const rows = CSS_PROPS
      .map((prop) => [prop, cs.getPropertyValue(prop).trim()] as const)
      .filter(([prop, value]) => value && (!SKIP_VALUES.has(value) || prop === 'display'));

    const list = h('div', { class: 'plist' }, rows.map(([prop, value]) => {
      const valueEl = h('span', { contenteditable: 'true', spellcheck: 'false' }, value);
      valueEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); valueEl.blur(); }
      });
      valueEl.addEventListener('blur', () => {
        const next = (valueEl.textContent ?? '').trim();
        if (next && next !== value) (el as HTMLElement).style?.setProperty(prop, next);
        place(el);
      });
      return h('div', { class: 'prow' },
        h('span', { class: 'pk' }, prop),
        h('span', { class: 'pv' }, COLOR_PROPS.has(prop) ? h('span', { class: 'sw', style: `background:${value}` }) : null, valueEl));
    }));

    const cssText = () => `${elementLabel(el)} {\n${rows.map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`;
    const copyBtn = h('button', { class: 'btn' }, icon('copy', 16), t('copyCss'));
    copyBtn.addEventListener('click', async () => {
      if (await copyText(cssText())) {
        copyBtn.replaceChildren(icon('check', 16), t('copied'));
        setTimeout(() => copyBtn.replaceChildren(icon('copy', 16), t('copyCss')), 1200);
      }
    });

    clear(ctx.body);
    ctx.body.append(
      h('div', null,
        h('p', { class: 'lbl' }, t('element')),
        h('div', { class: 'crumb' }, chain.map((c, i) => [i ? h('span', null, '›') : null, c === el ? h('b', null, elementLabel(c)) : h('span', null, elementLabel(c))]))),
      h('div', null,
        h('p', { class: 'lbl' }, t('box')),
        h('div', { class: 'bm' }, `margin · ${sides(cs, 'margin')}`,
          h('div', { class: 'p' }, `padding · ${sides(cs, 'padding')}`,
            h('div', { class: 'c' }, `${Math.round(r.width)} × ${Math.round(r.height)}`)))),
      h('div', null, h('p', { class: 'lbl' }, t('props')), list, h('p', { class: 'note' }, t('cssEditNote'))),
      copyBtn,
    );
  }

  const onMove = (e: MouseEvent) => {
    if (pinned) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || ctx.isOwn(el)) return;
    if (el !== hovered) { hovered = el; render(el); }
    place(el);
  };
  const onClick = (e: MouseEvent) => {
    if (ctx.isOwn(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || ctx.isOwn(el)) return;
    pinned = pinned === el ? null : el;
    hovered = el;
    render(el);
    place(el);
  };
  const onScroll = () => { if (hovered) place(hovered); };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onScroll, true);
  return () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('scroll', onScroll, true);
    box.remove();
    tag.remove();
  };
}
