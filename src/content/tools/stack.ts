// Site stack: what the page is built with. Our own rules, checked against the page only — no network.

type StackCat = 'framework' | 'cms' | 'ui' | 'analytics' | 'service' | 'build' | 'fonts';

const STACK_CAT_NAMES: Record<StackCat, [string, string]> = {
  framework: ['Фреймворки', 'Frameworks'],
  cms: ['CMS и конструкторы', 'CMS & site builders'],
  ui: ['Библиотеки', 'Libraries'],
  analytics: ['Аналитика', 'Analytics'],
  service: ['Сервисы', 'Services'],
  build: ['Сборка', 'Build tools'],
  fonts: ['Шрифты и иконки', 'Fonts & icons'],
};

const GLOBAL_CATS: Record<string, StackCat> = {
  'React': 'framework', 'Next.js': 'framework', 'Nuxt': 'framework', 'Vue': 'framework', 'Angular': 'framework',
  'Gatsby': 'framework', 'Remix': 'framework', 'Ember': 'framework', 'Backbone': 'framework', 'Alpine.js': 'framework', 'htmx': 'framework',
  'jQuery': 'ui', 'Lodash': 'ui', 'Three.js': 'ui', 'GSAP': 'ui', 'Swiper': 'ui', 'Bootstrap': 'ui',
  'Webpack': 'build',
  'Google Analytics': 'analytics', 'Google Tag Manager': 'analytics', 'Yandex Metrica': 'analytics', 'Meta Pixel': 'analytics', 'Hotjar': 'analytics', 'Sentry': 'analytics',
  'Stripe': 'service', 'reCAPTCHA': 'service', 'Intercom': 'service', 'Crisp': 'service', 'JivoChat': 'service',
  'Shopify': 'cms', '1C-Bitrix': 'cms', 'Webflow': 'cms', 'Wix': 'cms', 'Squarespace': 'cms', 'Drupal': 'cms', 'Tilda': 'cms',
};

function detectDom(): [string, StackCat, string | null][] {
  const found: [string, StackCat, string | null][] = [];
  const html = document.documentElement;
  const scripts = Array.from(document.scripts).map((s) => s.src).filter(Boolean).join('\n');
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[href]')).map((l) => l.href).join('\n');
  const generator = document.querySelector<HTMLMetaElement>('meta[name="generator" i]')?.content ?? '';
  const add = (name: string, cat: StackCat, ok: unknown, version: string | null = null) => { if (ok) found.push([name, cat, version]); };
  const gen = (re: RegExp) => generator.match(re);

  add('WordPress', 'cms', /wp-content|wp-includes/.test(scripts + links) || gen(/WordPress/i), gen(/WordPress ([\d.]+)/i)?.[1] ?? null);
  add('Joomla', 'cms', gen(/Joomla/i));
  add('Ghost', 'cms', gen(/Ghost/i), gen(/Ghost ([\d.]+)/i)?.[1] ?? null);
  add('Hugo', 'build', gen(/Hugo/i), gen(/Hugo ([\d.]+)/i)?.[1] ?? null);
  add('Astro', 'framework', document.querySelector('astro-island') || gen(/Astro/i), gen(/Astro v?([\d.]+)/i)?.[1] ?? null);
  add('Docusaurus', 'build', gen(/Docusaurus/i));
  add('Tilda', 'cms', /tildacdn|tilda\.ws/.test(scripts + links));
  add('1C-Bitrix', 'cms', /\/bitrix\//.test(scripts + links));
  add('Shopify', 'cms', /cdn\.shopify\.com/.test(scripts + links));
  add('Wix', 'cms', /static\.parastorage\.com|wixstatic/.test(scripts + links));
  add('Webflow', 'cms', html.hasAttribute('data-wf-site'));
  add('Framer', 'cms', /framerusercontent|framer\.com\/m\//.test(scripts + links) || gen(/Framer/i));
  add('Squarespace', 'cms', /squarespace/.test(scripts + links));
  add('Angular', 'framework', document.querySelector('[ng-version]'), document.querySelector('[ng-version]')?.getAttribute('ng-version') ?? null);
  add('Svelte', 'framework', document.querySelector('[class*="svelte-"]'));
  add('Vue', 'framework', document.querySelector('[data-v-app], [data-server-rendered]'));
  add('Next.js', 'framework', document.getElementById('__NEXT_DATA__') || /\/_next\//.test(scripts));
  add('Nuxt', 'framework', document.getElementById('__nuxt') || /\/_nuxt\//.test(scripts));
  add('Gatsby', 'framework', document.getElementById('___gatsby'));
  add('Vite', 'build', document.querySelector('script[type="module"][src*="/assets/index-"]'));
  add('Tailwind CSS', 'ui', getComputedStyle(html).getPropertyValue('--tw-ring-offset-width') !== '' || document.querySelector('[class*="tw-"]'));
  add('Bootstrap', 'ui', /bootstrap(\.min)?\.(css|js)/.test(scripts + links));
  add('Google Fonts', 'fonts', /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(links + scripts));
  add('Font Awesome', 'fonts', /font-?awesome|fontawesome/.test(links + scripts) || document.querySelector('.fa, .fas, .fa-solid'));
  add('Cloudflare', 'service', /\/cdn-cgi\//.test(scripts + links));
  add('Google Tag Manager', 'analytics', /googletagmanager\.com/.test(scripts));
  add('Yandex Metrica', 'analytics', /mc\.yandex\.ru/.test(scripts));
  add('reCAPTCHA', 'service', /recaptcha/.test(scripts));
  add('hCaptcha', 'service', /hcaptcha/.test(scripts));
  add('jsDelivr', 'service', /cdn\.jsdelivr\.net/.test(scripts + links));
  add('cdnjs', 'service', /cdnjs\.cloudflare\.com/.test(scripts + links));
  add('unpkg', 'service', /unpkg\.com/.test(scripts + links));
  return found;
}

function mountStack(ctx: ToolCtx): void {
  ctx.body.append(h('p', { class: 'muted' }, tr('Ищу признаки…', 'Looking for clues…')));
  bg<[string, string | null][]>({ type: 'globals' }).catch(() => []).then((globals) => {
    const all = new Map<string, { cat: StackCat; version: string | null }>();
    for (const [name, cat, version] of detectDom()) all.set(name, { cat, version });
    for (const [name, version] of globals ?? []) {
      const prev = all.get(name);
      all.set(name, { cat: GLOBAL_CATS[name] ?? prev?.cat ?? 'ui', version: version ?? prev?.version ?? null });
    }
    clear(ctx.body);
    if (!all.size) {
      ctx.body.append(h('p', { class: 'muted' }, tr('Ничего знакомого не нашлось. Возможно, сайт сделан вручную.', 'Nothing familiar found. The site may be hand-made.')));
    }
    for (const cat of Object.keys(STACK_CAT_NAMES) as StackCat[]) {
      const items = [...all.entries()].filter(([, v]) => v.cat === cat).sort(([a], [b]) => a.localeCompare(b));
      if (!items.length) continue;
      ctx.body.append(section(STACK_CAT_NAMES[cat][currentLang === 'ru' ? 0 : 1],
        h('div', { class: 'plist' }, items.map(([name, v]) => h('div', { class: 'prow', style: 'font-family:var(--ui);font-size:13px' },
          h('span', null, name), h('span', { class: 'pk', style: 'font-family:var(--mono);font-size:12px' }, v.version ?? ''))))));
    }
    ctx.body.append(h('p', { class: 'note', style: 'margin:0' }, tr(
      'Определено по признакам в коде страницы, без запросов в сеть. Может ошибаться.',
      'Detected from clues in the page code, without network requests. May be wrong.')));
  });
}
