// Ruler: drag from point to point. Hold Shift for a straight horizontal or vertical line.
// Several measurements can stay on screen: "+" starts a new one, clicking a card picks which one to redraw.

const RULER_COLORS = ['#FF6B3D', '#3DA5FF', '#2ECC71', '#B066FF', '#F2B544', '#FF4D8D'];

interface Measure {
  color: string;
  x1: number; y1: number; x2: number; y2: number;
  drawn: boolean;
  g: SVGGElement;
  line: SVGLineElement;
  tag: HTMLElement;
}

function mountRuler(ctx: ToolCtx): () => void {
  const SVG = 'http://www.w3.org/2000/svg';
  const cap = ctx.addCapture();
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'mline');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  ctx.layer.append(svg);

  const measures: Measure[] = [];
  let active = -1;
  let dragging = false;
  let colorIndex = 0;
  // Snapping to element edges. Edges are usually approached from outside (e.g. from the gap between
  // two cards), so we look at elements under the cursor AND a ring of points around it, then pull
  // each axis to the nearest edge within SNAP pixels. What it snapped to is shown with guide lines.
  const SNAP = 12;
  const snapBoxX = makeHighlighter(ctx.layer, 'hl soft');
  const snapBoxY = makeHighlighter(ctx.layer, 'hl soft');
  const guideX = h('div', { class: 'guide gx', style: 'display:none' });
  const guideY = h('div', { class: 'guide gy', style: 'display:none' });
  ctx.layer.append(guideX, guideY);

  function hideSnap(): void {
    snapBoxX.hide(); snapBoxY.hide();
    guideX.style.display = guideY.style.display = 'none';
  }

  function snapPoint(x: number, y: number): { x: number; y: number; ex: Element | null; ey: Element | null } {
    const candidates = new Set<Element>();
    const offsets = [[0, 0], [SNAP, 0], [-SNAP, 0], [0, SNAP], [0, -SNAP], [SNAP, SNAP], [-SNAP, -SNAP], [SNAP, -SNAP], [-SNAP, SNAP]];
    for (const [dx, dy] of offsets) {
      for (const el of document.elementsFromPoint(x + dx, y + dy).slice(0, 8)) {
        if (ctx.isOwn(el) || el === document.documentElement || el === document.body) continue;
        candidates.add(el);
      }
    }
    let bx = { d: SNAP + 1, v: x, el: null as Element | null };
    let by = { d: SNAP + 1, v: y, el: null as Element | null };
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // An edge only counts near the element itself, not along its whole infinite line.
      const nearV = y >= r.top - SNAP && y <= r.bottom + SNAP;
      const nearH = x >= r.left - SNAP && x <= r.right + SNAP;
      if (nearV) for (const ex of [r.left, r.right]) { const d = Math.abs(ex - x); if (d < bx.d) bx = { d, v: ex, el }; }
      if (nearH) for (const ey of [r.top, r.bottom]) { const d = Math.abs(ey - y); if (d < by.d) by = { d, v: ey, el }; }
    }
    return { x: Math.round(bx.v), y: Math.round(by.v), ex: bx.el, ey: by.el };
  }

  function at(e: PointerEvent): [number, number] {
    if (!settings.rulerSnap) { hideSnap(); return [e.clientX, e.clientY]; }
    const p = snapPoint(e.clientX, e.clientY);
    if (p.ex) { snapBoxX.show(p.ex); guideX.style.cssText = `display:block;left:${p.x}px`; } else { snapBoxX.hide(); guideX.style.display = 'none'; }
    if (p.ey && p.ey !== p.ex) snapBoxY.show(p.ey); else snapBoxY.hide();
    if (p.ey) guideY.style.cssText = `display:block;top:${p.y}px`; else guideY.style.display = 'none';
    return [p.x, p.y];
  }

  function addMeasure(): void {
    const color = RULER_COLORS[colorIndex++ % RULER_COLORS.length];
    const g = document.createElementNS(SVG, 'g');
    const line = document.createElementNS(SVG, 'line');
    line.style.stroke = color;
    const a = document.createElementNS(SVG, 'circle');
    const b = document.createElementNS(SVG, 'circle');
    for (const dot of [a, b]) { dot.setAttribute('r', '3'); dot.style.fill = color; }
    g.append(line, a, b);
    g.style.display = 'none';
    svg.append(g);
    const tag = h('div', { class: 'mtag', style: `display:none;background:${color}` });
    ctx.layer.append(tag);
    measures.push({ color, x1: 0, y1: 0, x2: 0, y2: 0, drawn: false, g, line, tag });
    active = measures.length - 1;
  }

  function stats(m: Measure): { w: number; h: number; d: number; a: number } {
    return {
      w: Math.round(Math.abs(m.x2 - m.x1)),
      h: Math.round(Math.abs(m.y2 - m.y1)),
      d: Math.round(Math.hypot(m.x2 - m.x1, m.y2 - m.y1)),
      a: Math.round((Math.atan2(m.y1 - m.y2, m.x2 - m.x1) * 180) / Math.PI),
    };
  }

  function draw(m: Measure): void {
    const [a, b] = Array.from(m.g.querySelectorAll('circle'));
    m.line.setAttribute('x1', String(m.x1)); m.line.setAttribute('y1', String(m.y1));
    m.line.setAttribute('x2', String(m.x2)); m.line.setAttribute('y2', String(m.y2));
    a.setAttribute('cx', String(m.x1)); a.setAttribute('cy', String(m.y1));
    b.setAttribute('cx', String(m.x2)); b.setAttribute('cy', String(m.y2));
    m.g.style.display = m.drawn ? '' : 'none';
    const s = stats(m);
    m.tag.textContent = `${s.d} px · ${s.w} × ${s.h}`;
    m.tag.style.display = m.drawn ? 'block' : 'none';
    m.tag.style.left = `${(m.x1 + m.x2) / 2 + 10}px`;
    m.tag.style.top = `${(m.y1 + m.y2) / 2 + 10}px`;
  }

  function remove(i: number): void {
    const [m] = measures.splice(i, 1);
    m.g.remove();
    m.tag.remove();
    if (!measures.length) addMeasure();
    active = Math.min(active, measures.length - 1);
    renderBody();
  }

  function renderBody(): void {
    clear(ctx.body);
    const list = h('div', { class: 'mlist' });
    measures.forEach((m, i) => {
      const s = stats(m);
      const del = h('button', { class: 'wbtn', title: tr('Удалить', 'Delete'), 'aria-label': tr('Удалить', 'Delete') }, icon('trash', 15));
      del.addEventListener('click', (e) => { e.stopPropagation(); remove(i); });
      const card = h('div', { class: i === active ? 'mcard on' : 'mcard', role: 'button', tabindex: '0', style: `--mc:${m.color}` },
        h('div', { class: 'mhead' }, h('span', { class: 'mdot' }), h('b', null, `${tr('Замер', 'Measure')} ${i + 1}`), del),
        m.drawn
          ? h('div', { class: 'mgrid' },
              h('span', null, t('mWidth')), h('b', null, `${s.w} px`),
              h('span', null, t('mHeight')), h('b', null, `${s.h} px`),
              h('span', null, t('mDist')), h('b', null, `${s.d} px`),
              h('span', null, t('mAngle')), h('b', null, `${s.a}°`))
          : h('p', { class: 'muted', style: 'font-size:12px' }, t('noMeasure')));
      card.addEventListener('click', () => { active = i; renderBody(); });
      list.append(card);
    });
    const add = button(tr('Ещё замер', 'Add measure'), () => { addMeasure(); renderBody(); }, { icon: 'plus' });
    const clearAll = button(tr('Очистить', 'Clear'), () => {
      measures.splice(0).forEach((m) => { m.g.remove(); m.tag.remove(); });
      colorIndex = 0;
      addMeasure();
      renderBody();
    });
    ctx.body.append(
      switchRow(tr('Прилипать к краям элементов', 'Snap to element edges'), settings.rulerSnap, (on) => {
        settings.rulerSnap = on;
        saveSettings();
        if (!on) hideSnap();
      }, tr('Концы линии цепляются за границы блоков на странице.', 'Line ends catch the borders of blocks on the page.')),
      list, h('div', { class: 'btnrow' }, add, clearAll),
      h('p', { class: 'note', style: 'margin:0' }, tr('Shift — ровная линия. Нажми на замер, чтобы перерисовать его.', 'Shift — straight line. Click a measure to redraw it.')));
  }

  function point(e: PointerEvent, m: Measure): [number, number] {
    let [x, y] = at(e);
    if (e.shiftKey) {
      if (Math.abs(x - m.x1) > Math.abs(y - m.y1)) y = m.y1; else x = m.x1;
    }
    return [x, y];
  }

  cap.addEventListener('pointerdown', (e) => {
    const m = measures[active];
    if (!m) return;
    const [x, y] = at(e);
    m.x1 = m.x2 = x;
    m.y1 = m.y2 = y;
    m.drawn = true;
    dragging = true;
    cap.setPointerCapture(e.pointerId);
    draw(m);
  });
  cap.addEventListener('pointermove', (e) => {
    const m = measures[active];
    if (!dragging || !m) { at(e); return; }  // show what the start point would snap to
    [m.x2, m.y2] = point(e, m);
    draw(m);
  });
  cap.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    renderBody();
  });

  addMeasure();
  renderBody();
  cap.addEventListener('pointerleave', () => hideSnap());
  return () => { svg.remove(); measures.forEach((m) => m.tag.remove()); snapBoxX.remove(); snapBoxY.remove(); guideX.remove(); guideY.remove(); };
}
