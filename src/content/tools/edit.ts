// Page editor: edit text in place, delete elements, move elements. Everything can be undone,
// and nothing is saved — a reload brings the original page back.

type EditMode = 'text' | 'delete' | 'move';

function mountEdit(ctx: ToolCtx): () => void {
  let mode: EditMode = 'text';
  const undo: (() => void)[] = [];
  const hl = makeHighlighter(ctx.layer);
  const prevDesign = document.designMode;
  let dragging: { el: HTMLElement; sx: number; sy: number; tx: number; ty: number; before: string } | null = null;

  const count = h('b', null, '0');
  const undoBtn = button(tr('Отменить', 'Undo'), () => { undo.pop()?.(); update(); }, { icon: 'undo' });
  const resetBtn = button(tr('Вернуть всё', 'Reset all'), () => { while (undo.length) undo.pop()!(); update(); });
  function update(): void {
    count.textContent = String(undo.length);
    undoBtn.disabled = resetBtn.disabled = !undo.length;
  }

  function setMode(m: EditMode): void {
    mode = m;
    document.designMode = m === 'text' ? 'on' : prevDesign;
    hl.hide();
  }

  const target = (e: MouseEvent): HTMLElement | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el instanceof HTMLElement && !ctx.isOwn(el) && el !== document.body && el !== document.documentElement ? el : null;
  };

  // Text edits: remember the text before the first change of each element.
  const textBefore = new Set<Node>();
  const onBeforeInput = (e: Event) => {
    const el = (e.target as Node) ?? null;
    if (!el || ctx.isOwn(el) || mode !== 'text') return;
    const block = el instanceof Element ? el : el.parentElement;
    if (!block || textBefore.has(block)) return;
    textBefore.add(block);
    const saved = Array.from(block.childNodes, (n) => n.cloneNode(true));
    undo.push(() => { block.replaceChildren(...saved); textBefore.delete(block); });
    update();
  };

  const onMove = (e: MouseEvent) => {
    if (mode === 'text') return;
    if (dragging) {
      const dx = e.clientX - dragging.sx, dy = e.clientY - dragging.sy;
      dragging.el.style.translate = `${dragging.tx + dx}px ${dragging.ty + dy}px`;
      hl.show(dragging.el);
      return;
    }
    const el = target(e);
    if (el) hl.show(el); else hl.hide();
  };
  const onDown = (e: MouseEvent) => {
    if (mode !== 'move' || e.button !== 0) return;
    const el = target(e);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const [tx, ty] = (getComputedStyle(el).translate.split(' ').map(parseFloat).concat([0, 0]) as number[]).map((n) => n || 0);
    dragging = { el, sx: e.clientX, sy: e.clientY, tx, ty, before: el.style.translate };
  };
  const onUp = () => {
    if (!dragging) return;
    const { el, before } = dragging;
    if (el.style.translate !== before) { undo.push(() => { el.style.translate = before; }); update(); }
    dragging = null;
  };
  const onClick = (e: MouseEvent) => {
    if (mode === 'text' || ctx.isOwn(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (mode !== 'delete') return;
    const el = target(e);
    if (!el) return;
    const before = el.style.getPropertyValue('display');
    const prio = el.style.getPropertyPriority('display');
    el.style.setProperty('display', 'none', 'important');
    undo.push(() => { el.style.setProperty('display', before, prio); });
    hl.hide();
    update();
  };

  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('mouseup', onUp, true);
  document.addEventListener('click', onClick, true);

  ctx.body.append(
    section(tr('Режим', 'Mode'), segmented<EditMode>([['text', tr('Текст', 'Text')], ['delete', tr('Удалить', 'Delete')], ['move', tr('Двигать', 'Move')]], mode, setMode)),
    h('div', { class: 'kv' }, h('span', null, tr('Изменений', 'Changes')), count),
    h('div', { class: 'btnrow' }, undoBtn, resetBtn),
    h('p', { class: 'note', style: 'margin:0' }, tr(
      'Текст: нажми на любой текст на странице и печатай. Удалить: клик по элементу. Двигать: тяни элемент. После перезагрузки страница станет прежней.',
      'Text: click any text on the page and type. Delete: click an element. Move: drag an element. Reloading brings the page back.')),
  );
  setMode('text');
  update();

  return () => {
    document.designMode = prevDesign;
    document.removeEventListener('beforeinput', onBeforeInput, true);
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('mouseup', onUp, true);
    document.removeEventListener('click', onClick, true);
    hl.remove();
  };
}
