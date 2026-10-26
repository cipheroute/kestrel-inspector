// Page images: <img>, <picture>/srcset, CSS backgrounds, inline SVG, favicons and og:image.

type ImgKind = 'img' | 'bg' | 'svg' | 'icon';
interface PageImage { url: string; kind: ImgKind; w: number; h: number; }

function collectImages(): PageImage[] {
  const seen = new Map<string, PageImage>();
  const add = (raw: string | null | undefined, kind: ImgKind, w = 0, hh = 0) => {
    if (!raw || raw.startsWith('about:')) return;
    let url: string;
    try { url = new URL(raw, location.href).href; } catch { return; }
    if (!seen.has(url)) seen.set(url, { url, kind: /\.svg(\?|$)/i.test(url) && kind === 'img' ? 'svg' : kind, w, h: hh });
  };
  for (const img of Array.from(document.images)) add(img.currentSrc || img.src, 'img', img.naturalWidth, img.naturalHeight);
  for (const s of Array.from(document.querySelectorAll<HTMLSourceElement>('picture source[srcset]'))) {
    add(s.srcset.split(',').pop()?.trim().split(/\s+/)[0], 'img');
  }
  const all = document.body ? document.body.querySelectorAll('*') : [];
  for (let i = 0; i < Math.min(all.length, 5000); i++) {
    const bgImg = getComputedStyle(all[i]).backgroundImage;
    if (!bgImg || bgImg === 'none') continue;
    for (const m of bgImg.matchAll(/url\(["']?(.*?)["']?\)/g)) add(m[1], 'bg');
  }
  for (const svg of Array.from(document.querySelectorAll('svg')).slice(0, 200)) {
    const r = svg.getBoundingClientRect();
    if (r.width < 8) continue;
    const xml = new XMLSerializer().serializeToString(svg);
    add(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`, 'svg', Math.round(r.width), Math.round(r.height));
  }
  for (const l of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'))) add(l.href, 'icon');
  add(document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content, 'img');
  return [...seen.values()];
}

function mountImages(ctx: ToolCtx): void {
  const images = collectImages();
  let filter: 'all' | ImgKind = 'all';
  const grid = h('div', { class: 'thumbs' });
  const status = h('p', { class: 'note', style: 'margin:0' });

  async function download(urls: string[]): Promise<void> {
    const local = urls.filter((u) => u.startsWith('data:'));
    const remote = urls.filter((u) => !u.startsWith('data:'));
    local.forEach((u, i) => fetch(u).then((r) => r.blob()).then((b) => downloadBlob(b, `image-${i + 1}.svg`)));
    if (!remote.length) return;
    const ok = await bg<boolean>({ type: 'hasPerm', permissions: ['downloads'] }).catch(() => false);
    if (!ok) {
      bg({ type: 'openPermit', tool: 'images', permissions: ['downloads'] });
      status.textContent = tr('Разреши загрузки в открывшемся окне и нажми ещё раз.', 'Allow downloads in the window that opened, then click again.');
      return;
    }
    await bg({ type: 'download', urls: remote });
    status.textContent = tr(`Скачивается: ${remote.length}`, `Downloading: ${remote.length}`);
  }

  function render(): void {
    clear(grid);
    const list = images.filter((x) => filter === 'all' || x.kind === filter);
    for (const im of list.slice(0, 300)) {
      const thumb = h('div', { class: 'thumb' },
        h('img', { src: im.url, alt: '', loading: 'lazy' }),
        h('div', { class: 'tmeta' }, h('span', null, im.w ? `${im.w}×${im.h}` : im.kind.toUpperCase()),
          h('span', { class: 'tacts' },
            copyButton(() => im.url.startsWith('data:') ? decodeURIComponent(im.url.split(',')[1]) : im.url, t('copy')),
            (() => { const b = h('button', { class: 'wbtn', title: tr('Скачать', 'Download'), 'aria-label': tr('Скачать', 'Download') }, icon('download', 15)); b.addEventListener('click', () => download([im.url])); return b; })())));
      const img = thumb.querySelector('img')!;
      img.addEventListener('load', () => { if (!im.w) { im.w = img.naturalWidth; im.h = img.naturalHeight; thumb.querySelector('.tmeta span')!.textContent = `${im.w}×${im.h}`; } });
      img.addEventListener('click', () => window.open(im.url, '_blank', 'noopener'));
      grid.append(thumb);
    }
    if (!list.length) grid.append(h('p', { class: 'muted' }, tr('Ничего нет.', 'Nothing here.')));
  }

  const count = (k: ImgKind) => images.filter((x) => x.kind === k).length;
  ctx.body.append(
    segmented<'all' | ImgKind>([
      ['all', `${tr('Все', 'All')} ${images.length}`], ['img', `${tr('Фото', 'Images')} ${count('img')}`],
      ['bg', `${tr('Фоны', 'BG')} ${count('bg')}`], ['svg', `SVG ${count('svg')}`],
    ], filter, (v) => { filter = v; render(); }),
    grid,
    h('div', { class: 'btnrow' }, button(tr('Скачать все', 'Download all'), () => download(images.filter((x) => filter === 'all' || x.kind === filter).map((x) => x.url)), { icon: 'download', primary: true })),
    status,
  );
  render();
}
