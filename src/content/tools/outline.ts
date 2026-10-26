// Outlines & grids: outline every block, and mark flex and grid containers with their gaps.

function mountOutline(ctx: ToolCtx): () => void {
  const state = { all: false, flex: true, grid: true };
  let boxes: HTMLElement[] = [];

  function draw(): void {
    boxes.forEach((b) => b.remove());
    boxes = [];
    if (!state.flex && !state.grid) return;
    const els = document.body ? document.body.querySelectorAll('*') : [];
    const max = Math.min(els.length, 5000);
    for (let i = 0; i < max && boxes.length < 400; i++) {
      const el = els[i];
      const display = getComputedStyle(el).display;
      const isFlex = display.includes('flex'), isGrid = display.includes('grid');
      if (!((isFlex && state.flex) || (isGrid && state.grid))) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      const gap = [cs.rowGap, cs.columnGap].filter((g) => g && g !== 'normal' && g !== '0px');
      const b = h('div', { class: isGrid ? 'obox grid' : 'obox flex', style: `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px` },
        h('span', null, `${isGrid ? 'grid' : 'flex'}${gap.length ? ` · gap ${[...new Set(gap)].join(' ')}` : ''}`));
      ctx.layer.append(b);
      boxes.push(b);
    }
  }

  let timer = 0;
  const redraw = () => { clearTimeout(timer); timer = window.setTimeout(draw, 60); };

  ctx.body.append(
    switchRow(tr('Контуры всех блоков', 'Outline every block'), state.all, (on) => { state.all = on; bg({ type: 'outline', on }); }),
    switchRow(tr('Flex-контейнеры', 'Flex containers'), state.flex, (on) => { state.flex = on; draw(); }, tr('Синие, с отступом gap', 'Blue, with their gap')),
    switchRow(tr('Grid-контейнеры', 'Grid containers'), state.grid, (on) => { state.grid = on; draw(); }, tr('Фиолетовые, с отступом gap', 'Purple, with their gap')),
    h('p', { class: 'note', style: 'margin:0' }, tr('Показывается то, что видно на экране; при прокрутке обновляется.', 'Shows what is on screen and updates as you scroll.')),
  );
  draw();
  window.addEventListener('scroll', redraw, true);
  window.addEventListener('resize', redraw);
  return () => {
    window.removeEventListener('scroll', redraw, true);
    window.removeEventListener('resize', redraw);
    boxes.forEach((b) => b.remove());
    if (state.all) bg({ type: 'outline', on: false });
  };
}
