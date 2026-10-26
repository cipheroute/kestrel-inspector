// Color picker. Firefox has no EyeDropper API, so we take a screenshot of the visible tab
// (allowed by activeTab) and read pixels from it. The screenshot never leaves the browser.

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return [Math.round(hue), Math.round(s * 100), Math.round(l * 100)];
}

function cssColorToHex(value: string): string | null {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m || (m[4] !== undefined && parseFloat(m[4]) < 0.05)) return null;
  return toHex(+m[1], +m[2], +m[3]);
}

function pagePalette(limit = 10): string[] {
  const counts = new Map<string, number>();
  const all = document.body ? document.body.querySelectorAll('*') : [];
  const max = Math.min(all.length, 4000);
  for (let i = 0; i < max; i++) {
    const cs = getComputedStyle(all[i]);
    for (const v of [cs.color, cs.backgroundColor]) {
      const hex = cssColorToHex(v);
      if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([hex]) => hex);
}

function mountPipette(ctx: ToolCtx): () => void {
  const src = document.createElement('canvas');
  const srcCtx = src.getContext('2d', { willReadFrequently: true })!;
  let ready = false;
  let scale = 1;
  let picked: string | null = settings.colorHistory[0] ?? null;
  let regrabTimer = 0;
  const palette = pagePalette();

  const cap = ctx.addCapture();
  const loupeCanvas = h('canvas', { width: '132', height: '132' });
  const loupeLabel = h('span', null, '');
  const loupe = h('div', { class: 'loupe', style: 'display:none' }, loupeCanvas, loupeLabel);
  ctx.layer.append(loupe);
  const lctx = loupeCanvas.getContext('2d')!;

  function pick(hex: string): void {
    picked = hex;
    settings.colorHistory = [hex, ...settings.colorHistory.filter((c) => c !== hex)].slice(0, 12);
    saveSettings();
    copyText(hex);
    renderBody();
  }

  function swatches(list: string[]): HTMLElement {
    return h('div', { class: 'swrow' }, list.map((hex) => {
      const b = h('button', { class: 'swb', style: `background:${hex}`, title: hex, 'aria-label': hex });
      b.addEventListener('click', () => pick(hex));
      return b;
    }));
  }

  function renderBody(status?: string): void {
    clear(ctx.body);
    if (status) ctx.body.append(h('p', { class: 'muted' }, status));
    if (picked) {
      const [r, g, b] = hexToRgb(picked);
      const [hh, s, l] = rgbToHsl(r, g, b);
      const formats = [picked, `rgb(${r}, ${g}, ${b})`, `hsl(${hh}, ${s}%, ${l}%)`];
      ctx.body.append(
        h('div', { class: 'big' }, h('div', { class: 'bigsw', style: `background:${picked}` }),
          h('div', { class: 'fmeta' }, h('span', null, t('current')), h('b', { style: 'font-family:var(--mono);font-size:15px' }, picked))),
        h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          formats.map((f) => h('div', { class: 'fmt' }, h('span', null, f), copyButton(() => f, t('copy'))))),
      );
    } else if (!status) {
      ctx.body.append(h('p', { class: 'muted' }, t('noColorYet')));
    }
    if (settings.colorHistory.length) ctx.body.append(h('div', null, h('p', { class: 'lbl' }, t('recent')), swatches(settings.colorHistory)));
    if (palette.length) ctx.body.append(h('div', null, h('p', { class: 'lbl' }, t('pagePalette')), swatches(palette)));
  }

  async function grab(): Promise<void> {
    ready = false;
    loupe.style.display = 'none';
    ctx.hideUi(true);
    // Give the browser time to actually repaint without the panel before taking the screenshot.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 80));
    let res: { ok: boolean; url?: string } | undefined;
    try {
      res = await chrome.runtime.sendMessage({ type: 'capture' });
    } catch {
      res = undefined;
    }
    ctx.hideUi(false);
    if (!res?.ok || !res.url) { renderBody(t('captureFail')); return; }
    const img = new Image();
    img.src = res.url;
    await img.decode();
    src.width = img.naturalWidth;
    src.height = img.naturalHeight;
    srcCtx.drawImage(img, 0, 0);
    scale = img.naturalWidth / window.innerWidth;
    ready = true;
  }

  function colorAt(x: number, y: number): string {
    const d = srcCtx.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1).data;
    return toHex(d[0], d[1], d[2]);
  }

  cap.addEventListener('mousemove', (e) => {
    if (!ready) return;
    const px = Math.floor(e.clientX * scale), py = Math.floor(e.clientY * scale);
    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, 132, 132);
    lctx.drawImage(src, px - 5, py - 5, 11, 11, 0, 0, 132, 132);
    lctx.strokeStyle = '#fff';
    lctx.lineWidth = 2;
    lctx.strokeRect(60, 60, 12, 12);
    const hex = colorAt(e.clientX, e.clientY);
    loupeLabel.textContent = hex;
    const left = e.clientX + 150 > window.innerWidth ? e.clientX - 150 : e.clientX + 18;
    const top = e.clientY + 170 > window.innerHeight ? e.clientY - 170 : e.clientY + 18;
    loupe.style.cssText = `display:flex;left:${left}px;top:${top}px`;
  });
  cap.addEventListener('mouseleave', () => { loupe.style.display = 'none'; });
  cap.addEventListener('click', (e) => { if (ready) pick(colorAt(e.clientX, e.clientY)); });
  cap.addEventListener('wheel', (e) => {
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    window.scrollBy(e.deltaX * k, e.deltaY * k);
    ready = false;
    loupe.style.display = 'none';
    clearTimeout(regrabTimer);
    regrabTimer = window.setTimeout(grab, 250);
  }, { passive: true });

  renderBody(t('capturing'));
  grab().then(() => { if (ready) renderBody(); });

  return () => {
    clearTimeout(regrabTimer);
    loupe.remove();
  };
}
