// SEO & link preview: meta tags, headings outline, image alts, and how a shared link will look.

function metaContent(selector: string): string {
  return document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? '';
}

function mountSeo(ctx: ToolCtx): void {
  const title = document.title.trim();
  const desc = metaContent('meta[name="description" i]');
  const og = (p: string) => metaContent(`meta[property="og:${p}"], meta[name="og:${p}"]`);
  const tw = (p: string) => metaContent(`meta[name="twitter:${p}"], meta[property="twitter:${p}"]`);
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '';
  const robots = metaContent('meta[name="robots" i]');
  const lang = document.documentElement.lang;
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const imgs = Array.from(document.images);
  const noAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
  const links = Array.from(document.links);
  const external = links.filter((a) => a.hostname && a.hostname !== location.hostname).length;

  const status = (ok: boolean, warn = false) => h('span', { class: ok ? 'dot ok' : warn ? 'dot warn' : 'dot bad' });
  const row = (k: string, v: string, ok: boolean, hint = '') =>
    h('div', { class: 'seorow' }, status(ok, !v), h('div', { class: 'fmeta' }, h('b', { style: 'font-weight:500' }, k), h('span', { style: 'word-break:break-word' }, v || tr('нет', 'missing')), hint ? h('span', null, hint) : null));

  // Link preview card, the way most social apps and messengers render og:* tags.
  const pTitle = og('title') || tw('title') || title;
  const pDesc = og('description') || tw('description') || desc;
  const pImage = og('image') || tw('image');
  const card = h('div', { class: 'preview' },
    pImage ? h('img', { src: new URL(pImage, location.href).href, alt: '' }) : h('div', { class: 'noimg' }, tr('Нет картинки og:image', 'No og:image')),
    h('div', { class: 'pv-body' },
      h('span', { class: 'pv-host' }, location.hostname),
      h('b', null, pTitle || tr('Без заголовка', 'No title')),
      pDesc ? h('span', null, pDesc) : null));

  const counts = [1, 2, 3, 4, 5, 6].map((n) => headings.filter((x) => x.tagName === `H${n}`).length);
  const h1 = counts[0];

  ctx.body.append(
    section(tr('Превью ссылки', 'Link preview'), card,
      pImage ? h('p', { class: 'note' }, tr('Картинку загружает браузер с самого сайта.', 'The browser loads the image from the site itself.')) : null),
    section(tr('Основное', 'Basics'),
      row('title', title, title.length >= 10 && title.length <= 65, `${title.length} ${tr('симв., лучше 10–65', 'chars, best 10–65')}`),
      row('description', desc, desc.length >= 50 && desc.length <= 160, desc ? `${desc.length} ${tr('симв., лучше 50–160', 'chars, best 50–160')}` : ''),
      row('canonical', canonical, !!canonical),
      row('robots', robots || tr('не задан (индексируется)', 'not set (indexed)'), !/noindex/i.test(robots)),
      row('lang', lang, !!lang),
      row('og:title / og:image', [og('title'), og('image')].filter(Boolean).join(' · '), !!og('title') && !!og('image'))),
    section(tr('Заголовки', 'Headings'),
      h('div', { class: 'kv' }, h('span', null, 'H1 · H2 · H3 · H4 · H5 · H6'), h('b', null, counts.join(' · '))),
      h1 !== 1 ? h('p', { class: 'note' }, h1 === 0 ? tr('На странице нет H1.', 'No H1 on the page.') : tr('H1 больше одного.', 'More than one H1.')) : null,
      h('div', { class: 'outline' }, headings.slice(0, 60).map((x) => {
        const level = +x.tagName[1];
        const item = h('button', { class: 'oitem', style: `padding-left:${(level - 1) * 12 + 8}px` }, h('span', { class: 'pk' }, x.tagName), (x.textContent ?? '').trim().slice(0, 90) || '—');
        item.addEventListener('click', () => x.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return item;
      }))),
    section(tr('Картинки и ссылки', 'Images & links'),
      h('div', { class: 'kv' }, h('span', null, tr('Картинок без alt', 'Images without alt')), h('b', null, `${noAlt} / ${imgs.length}`)),
      h('div', { class: 'kv', style: 'margin-top:6px' }, h('span', null, tr('Ссылок: внутренние · внешние', 'Links: internal · external')), h('b', null, `${links.length - external} · ${external}`))),
  );
}
