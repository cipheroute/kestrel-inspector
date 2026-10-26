// Fonts: every font family used for text on the page, with weights and element counts.

interface FontGroup { family: string; stack: string; weights: Set<string>; elements: Element[]; }

function scanFonts(): FontGroup[] {
  const groups = new Map<string, FontGroup>();
  const all = document.body ? document.body.querySelectorAll('*') : [];
  const max = Math.min(all.length, 6000);
  for (let i = 0; i < max; i++) {
    const el = all[i];
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    const stack = cs.fontFamily;
    const family = stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
    let g = groups.get(family);
    if (!g) groups.set(family, (g = { family, stack, weights: new Set(), elements: [] }));
    g.weights.add(cs.fontWeight);
    g.elements.push(el);
  }
  return [...groups.values()].sort((a, b) => b.elements.length - a.elements.length);
}

function mountFonts(ctx: ToolCtx): () => void {
  const groups = scanFonts();
  let selected: FontGroup | null = null;
  let boxes: HTMLElement[] = [];

  function clearBoxes(): void { boxes.forEach((b) => b.remove()); boxes = []; }
  function drawBoxes(): void {
    clearBoxes();
    if (!selected) return;
    for (const el of selected.elements.slice(0, 80)) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || !r.width) continue;
      const b = h('div', { class: 'hl soft', style: `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px` });
      ctx.layer.append(b);
      boxes.push(b);
    }
  }

  function render(): void {
    clear(ctx.body);
    ctx.body.append(h('p', { class: 'lbl', style: 'margin:0' }, `${t('fontsOn')} · ${groups.length}`));
    for (const g of groups) {
      const row = h('button', { class: g === selected ? 'frow on' : 'frow' },
        h('div', { class: 'fs', style: `font-family:${g.stack}` }, 'Аа'),
        h('div', { class: 'fmeta' }, h('b', null, g.family), h('span', null, `${[...g.weights].sort().join(', ')} · ${g.elements.length} ${t('elements')}`)));
      row.addEventListener('click', () => { selected = selected === g ? null : g; render(); drawBoxes(); });
      ctx.body.append(row);
    }
    ctx.body.append(h('p', { class: 'note', style: 'margin:0' }, t('fontsHint')));
  }

  const onScroll = () => drawBoxes();
  window.addEventListener('scroll', onScroll, true);
  render();
  return () => { window.removeEventListener('scroll', onScroll, true); clearBoxes(); };
}
