// Screenshots: visible area, a selected region, or the full page (scrolled and stitched),
// then mark it up with arrows, boxes and blur, and save or copy. Nothing is uploaded anywhere.

type ShotTool = 'arrow' | 'rect' | 'blur';
interface Shape { kind: ShotTool; x1: number; y1: number; x2: number; y2: number; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Two frames plus a little extra: the browser must actually repaint without the panel before a screenshot.
const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));

async function captureImage(): Promise<HTMLImageElement | null> {
  const res = await bg<{ ok: boolean; url?: string }>({ type: 'capture' }).catch(() => null);
  if (!res?.ok || !res.url) return null;
  const img = new Image();
  img.src = res.url;
  await img.decode();
  return img;
}

function mountShot(ctx: ToolCtx): () => void {
  let base: HTMLCanvasElement | null = null;
  const shapes: Shape[] = [];
  let tool: ShotTool = 'arrow';
  let stage: HTMLElement | null = null;
  let view: HTMLCanvasElement | null = null;
  let viewScale = 1;
  let busy = false;
  const status = h('p', { class: 'note', style: 'margin:0' });

  async function grabVisible(): Promise<HTMLCanvasElement | null> {
    ctx.hideUi(true);
    await twoFrames();
    const img = await captureImage();
    ctx.hideUi(false);
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return c;
  }

  async function grabFullPage(): Promise<HTMLCanvasElement | null> {
    const startY = window.scrollY;
    const vh = window.innerHeight;
    const total = Math.min(document.documentElement.scrollHeight, vh * 30);
    // Fixed headers would repeat on every screen — hide them after the first one.
    const fixed = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => /fixed|sticky/.test(getComputedStyle(el).position));
    const saved = fixed.map((el) => [el, el.style.getPropertyValue('visibility'), el.style.getPropertyPriority('visibility')] as const);
    let out: HTMLCanvasElement | null = null;
    let scale = 1;
    ctx.hideUi(true);
    try {
      for (let y = 0, i = 0; y < total; y += vh, i++) {
        window.scrollTo(0, y);
        await twoFrames();
        await sleep(i ? 550 : 150); // browsers allow about two screenshots per second
        const img = await captureImage();
        if (!img) return null;
        if (!out) {
          scale = img.naturalWidth / window.innerWidth;
          out = document.createElement('canvas');
          out.width = img.naturalWidth;
          out.height = Math.min(32000, Math.round(total * scale));
          fixed.forEach((el) => el.style.setProperty('visibility', 'hidden', 'important'));
        }
        out.getContext('2d')!.drawImage(img, 0, Math.round(window.scrollY * scale));
        status.textContent = `${Math.min(100, Math.round(((y + vh) / total) * 100))}%`;
      }
    } finally {
      saved.forEach(([el, v, p]) => el.style.setProperty('visibility', v, p));
      window.scrollTo(0, startY);
      ctx.hideUi(false);
    }
    return out;
  }

  function closeStage(): void {
    stage?.remove();
    stage = null;
    view = null;
  }

  // Region selection on top of a frozen screenshot of the visible area.
  function selectRegion(full: HTMLCanvasElement): void {
    const sel = ctx.addCapture();
    sel.className = 'capture shotsel';
    const pic = h('canvas', { class: 'frozen' });
    pic.width = full.width; pic.height = full.height;
    pic.getContext('2d')!.drawImage(full, 0, 0);
    const box = h('div', { class: 'selbox', style: 'display:none' });
    sel.append(pic, box);
    let start: { x: number; y: number } | null = null;
    sel.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; sel.setPointerCapture(e.pointerId); });
    sel.addEventListener('pointermove', (e) => {
      if (!start) return;
      const x = Math.min(start.x, e.clientX), y = Math.min(start.y, e.clientY);
      box.style.cssText = `display:block;left:${x}px;top:${y}px;width:${Math.abs(e.clientX - start.x)}px;height:${Math.abs(e.clientY - start.y)}px`;
    });
    sel.addEventListener('pointerup', (e) => {
      if (!start) return;
      const k = full.width / window.innerWidth;
      const x = Math.min(start.x, e.clientX) * k, y = Math.min(start.y, e.clientY) * k;
      const w = Math.abs(e.clientX - start.x) * k, hh = Math.abs(e.clientY - start.y) * k;
      sel.remove();
      if (w < 4 || hh < 4) return;
      const crop = document.createElement('canvas');
      crop.width = w; crop.height = hh;
      crop.getContext('2d')!.drawImage(full, x, y, w, hh, 0, 0, w, hh);
      openEditor(crop);
    });
  }

  function redraw(): void {
    if (!view || !base) return;
    const g = view.getContext('2d')!;
    g.drawImage(base, 0, 0);
    for (const s of shapes) drawShape(g, s);
  }

  function drawShape(g: CanvasRenderingContext2D, s: Shape): void {
    const lw = Math.max(3, base!.width / 400);
    g.strokeStyle = '#FF3D3D';
    g.fillStyle = '#FF3D3D';
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (s.kind === 'rect') {
      g.strokeRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
    } else if (s.kind === 'arrow') {
      const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), head = lw * 5;
      g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
      g.beginPath(); g.moveTo(s.x2, s.y2);
      g.lineTo(s.x2 - head * Math.cos(a - 0.45), s.y2 - head * Math.sin(a - 0.45));
      g.lineTo(s.x2 - head * Math.cos(a + 0.45), s.y2 - head * Math.sin(a + 0.45));
      g.closePath(); g.fill();
    } else {
      // Blur by pixelating: shrink the region and stretch it back.
      const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2), w = Math.abs(s.x2 - s.x1), hh = Math.abs(s.y2 - s.y1);
      if (w < 2 || hh < 2) return;
      const k = Math.max(8, Math.round(base!.width / 120));
      const tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(w / k)); tmp.height = Math.max(1, Math.round(hh / k));
      tmp.getContext('2d')!.drawImage(base!, x, y, w, hh, 0, 0, tmp.width, tmp.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, hh);
      g.imageSmoothingEnabled = true;
    }
  }

  function openEditor(canvas: HTMLCanvasElement): void {
    closeStage();
    base = canvas;
    shapes.length = 0;
    stage = ctx.addCapture();
    stage.className = 'stage shotstage';
    view = h('canvas', { class: 'shotview' });
    view.width = canvas.width; view.height = canvas.height;
    const wrap = h('div', { class: 'shotwrap' }, view);
    stage.append(wrap);
    const panelSpace = 56 + 360 + 12 * 4;
    viewScale = Math.min(1, (window.innerWidth - panelSpace - 48) / canvas.width, (window.innerHeight - 48) / canvas.height);
    view.style.width = `${canvas.width * viewScale}px`;
    view.style.height = `${canvas.height * viewScale}px`;
    wrap.style.marginRight = `${panelSpace}px`;
    redraw();

    let cur: Shape | null = null;
    const pos = (e: PointerEvent) => { const r = view!.getBoundingClientRect(); return { x: (e.clientX - r.left) / viewScale, y: (e.clientY - r.top) / viewScale }; };
    view.addEventListener('pointerdown', (e) => { const p = pos(e); cur = { kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }; shapes.push(cur); view!.setPointerCapture(e.pointerId); });
    view.addEventListener('pointermove', (e) => { if (!cur) return; const p = pos(e); cur.x2 = p.x; cur.y2 = p.y; redraw(); });
    view.addEventListener('pointerup', () => { cur = null; });
    stage.addEventListener('click', (e) => { if (e.target === stage) closeStage(); });
    renderBody();
  }

  async function take(kind: 'visible' | 'region' | 'full'): Promise<void> {
    if (busy) return;
    busy = true;
    closeStage();
    status.textContent = tr('Снимаю…', 'Capturing…');
    const c = kind === 'full' ? await grabFullPage() : await grabVisible();
    busy = false;
    status.textContent = c ? '' : t('captureFail');
    if (!c) return;
    if (kind === 'region') selectRegion(c); else openEditor(c);
  }

  function fileName(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${location.hostname}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
  }

  function renderBody(): void {
    clear(ctx.body);
    ctx.body.append(section(tr('Снять', 'Capture'), h('div', { class: 'btnrow' },
      button(tr('Видимое', 'Visible'), () => take('visible'), { icon: 'camera' }),
      button(tr('Область', 'Region'), () => take('region'), { icon: 'crop' }),
      button(tr('Всю страницу', 'Full page'), () => take('full'), { icon: 'scroll' }))));
    if (view && base) {
      ctx.body.append(
        section(tr('Пометки', 'Markup'),
          segmented<ShotTool>([['arrow', tr('Стрелка', 'Arrow')], ['rect', tr('Рамка', 'Box')], ['blur', tr('Размытие', 'Blur')]], tool, (v) => { tool = v; }),
          h('div', { class: 'btnrow', style: 'margin-top:8px' }, button(tr('Отменить', 'Undo'), () => { shapes.pop(); redraw(); }, { icon: 'undo' }))),
        section(tr('Готово', 'Done'), h('div', { class: 'btnrow' },
          button(tr('Скачать PNG', 'Save PNG'), () => view!.toBlob((b) => b && downloadBlob(b, fileName()), 'image/png'), { icon: 'download', primary: true }),
          button(tr('Копировать', 'Copy'), () => view!.toBlob(async (b) => {
            if (!b) return;
            try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); status.textContent = t('copied'); }
            catch { status.textContent = tr('Браузер не дал скопировать картинку — сохрани файлом.', 'The browser blocked copying — save as a file.'); }
          }, 'image/png'), { icon: 'copy' }))),
      );
    }
    ctx.body.append(status);
  }

  renderBody();
  return () => closeStage();
}
