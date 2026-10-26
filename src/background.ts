// Background script. It never makes network requests. Its jobs:
// 1) inject the panel into the current tab when the user clicks the toolbar icon
//    (or presses the shortcut) — this is what grants the temporary activeTab access;
// 2) do things content scripts are not allowed to do: screenshots, inserting CSS past the
//    page's CSP, reading page globals, cookies, downloads, small windows;
// 3) re-apply per-site settings (dark mode, custom CSS/JS) on sites where the user allowed it.

const CONTENT_FILES = [
  'js/content/i18n.js',
  'js/content/icons.js',
  'js/content/styles.js',
  'js/content/store.js',
  'js/content/dom.js',
  'js/content/tools/css.js',
  'js/content/tools/pipette.js',
  'js/content/tools/ruler.js',
  'js/content/tools/fonts.js',
  'js/content/tools/stack.js',
  'js/content/tools/seo.js',
  'js/content/tools/device.js',
  'js/content/tools/edit.js',
  'js/content/tools/dark.js',
  'js/content/tools/inject.js',
  'js/content/tools/outline.js',
  'js/content/tools/shot.js',
  'js/content/tools/images.js',
  'js/content/tools/cookies.js',
  'js/content/tools/json.js',
  'js/content/tools/registry.js',
  'js/content/panel.js',
  'js/content/main.js',
];

// Dark mode: invert the page, then invert media back so photos look normal.
const DARK_CSS = `html{filter:invert(.92) hue-rotate(180deg)!important;background:#fff!important}
img,video,picture,canvas,iframe,embed,object,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}`;

const OUTLINE_CSS = `*{outline:1px solid rgba(91,124,255,.55)!important;outline-offset:-1px!important}`;

interface SiteConfig { dark?: boolean; css?: string; js?: string; jsOn?: boolean; }

function fontCss(): string {
  const url = chrome.runtime.getURL('fonts/Unbounded.ttf');
  return `@font-face{font-family:"InspectorDisplay";src:url("${url}") format("truetype");font-weight:200 900;font-display:swap}`;
}

async function togglePanel(tabId: number): Promise<void> {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (globalThis as { __inspectorLoaded?: boolean }).__inspectorLoaded === true,
  });
  if (probe?.result) {
    await chrome.tabs.sendMessage(tabId, { type: 'toggle' });
    return;
  }
  // Fonts are declared on the page document so the closed shadow root can use them.
  await chrome.scripting.insertCSS({ target: { tabId }, css: fontCss() });
  await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  togglePanel(tab.id).catch((err) => {
    // Pages like about:*, the add-ons store or the new tab page do not allow extensions.
    console.warn('[inspector] cannot open on this page:', err);
  });
});

// ---------- per-site settings ----------

async function siteConfig(host: string): Promise<SiteConfig> {
  const { sites } = await chrome.storage.local.get('sites') as { sites?: Record<string, SiteConfig> };
  return sites?.[host] ?? {};
}

function hostPattern(host: string): string {
  return `*://${host}/*`;
}

// Register (or remove) the tiny runner that re-applies a site's settings on every visit.
// It only exists for sites the user explicitly allowed.
async function syncSite(host: string): Promise<boolean> {
  const id = `site-${host}`;
  try { await chrome.scripting.unregisterContentScripts({ ids: [id] }); } catch { /* not registered */ }
  const cfg = await siteConfig(host);
  const needed = !!(cfg.dark || cfg.css || (cfg.js && cfg.jsOn));
  const granted = await chrome.permissions.contains({ origins: [hostPattern(host)] });
  if (!needed || !granted) return false;
  await chrome.scripting.registerContentScripts([{ id, matches: [hostPattern(host)], js: ['js/site-runner.js'], runAt: 'document_start' }]);
  return true;
}

async function applySite(tabId: number, frameId: number, host: string): Promise<void> {
  const cfg = await siteConfig(host);
  const target = { tabId, frameIds: [frameId] };
  if (cfg.dark) await chrome.scripting.insertCSS({ target, css: DARK_CSS });
  if (cfg.css) await chrome.scripting.insertCSS({ target, css: cfg.css });
  if (cfg.js && cfg.jsOn) await runPageScript(tabId, cfg.js);
}

// Runs user code in the page itself. The page's own CSP still applies, as it should.
async function runPageScript(tabId: number, code: string): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [code],
    func: (src: string) => {
      const s = document.createElement('script');
      s.textContent = src;
      (document.head || document.documentElement).append(s);
      s.remove();
    },
  });
}

// Looks for well-known globals in the page's own JavaScript world. Must be self-contained.
function detectGlobals(): [string, string | null][] {
  const w = window as unknown as Record<string, any>;
  const found: [string, string | null][] = [];
  const add = (name: string, ok: unknown, version?: unknown) => {
    if (ok) found.push([name, typeof version === 'string' || typeof version === 'number' ? String(version) : null]);
  };
  try {
    const hook = w.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const renderer = hook?.renderers && [...hook.renderers.values()][0];
    add('React', w.React || renderer, w.React?.version ?? renderer?.version);
  } catch { /* ignore */ }
  add('Next.js', w.__NEXT_DATA__ || w.next, w.next?.version);
  add('Nuxt', w.__NUXT__ || w.$nuxt);
  add('Vue', w.Vue || w.__VUE__, w.Vue?.version);
  add('Angular', w.ng || w.getAllAngularRootElements);
  add('jQuery', w.jQuery?.fn?.jquery, w.jQuery?.fn?.jquery);
  add('Lodash', w._?.VERSION && w._?.chunk, w._?.VERSION);
  add('Gatsby', w.___gatsby);
  add('Remix', w.__remixContext);
  add('Alpine.js', w.Alpine, w.Alpine?.version);
  add('htmx', w.htmx, w.htmx?.version);
  add('Ember', w.Ember, w.Ember?.VERSION);
  add('Backbone', w.Backbone, w.Backbone?.VERSION);
  add('Three.js', w.THREE, w.THREE?.REVISION);
  add('GSAP', w.gsap, w.gsap?.version);
  add('Swiper', w.Swiper);
  add('Bootstrap', w.bootstrap, w.bootstrap?.Tooltip?.VERSION);
  add('Webpack', Object.keys(w).some((k) => k.startsWith('webpackChunk')) || w.webpackJsonp);
  add('Google Analytics', w.gtag || w.ga || w.GoogleAnalyticsObject);
  add('Google Tag Manager', w.google_tag_manager);
  add('Yandex Metrica', w.ym || w.Ya?.Metrika2);
  add('Meta Pixel', w.fbq);
  add('Hotjar', w.hj);
  add('Sentry', w.__SENTRY__ || w.Sentry);
  add('Stripe', w.Stripe);
  add('Shopify', w.Shopify);
  add('1C-Bitrix', w.BX);
  add('Webflow', w.Webflow);
  add('Wix', w.wixBiSession);
  add('Squarespace', w.Static?.SQUARESPACE_CONTEXT);
  add('Drupal', w.Drupal);
  add('reCAPTCHA', w.grecaptcha);
  add('Intercom', w.Intercom);
  add('Crisp', w.$crisp);
  add('JivoChat', w.jivo_api);
  add('Tilda', w.tildaForm || w.t_onReady);
  return found;
}

// ---------- messages from the panel ----------

type Reply = (value: unknown) => void;

function handle(msg: any, sender: chrome.runtime.MessageSender): Promise<unknown> | null {
  const tabId = sender.tab?.id;
  switch (msg?.type) {
    case 'capture':
      if (sender.tab?.windowId == null) return null;
      return chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
        .then((url) => ({ ok: true, url }), (err) => ({ ok: false, error: String(err) }));
    case 'insertCss':
      return tabId == null ? null : chrome.scripting.insertCSS({ target: { tabId }, css: msg.css }).then(() => true);
    case 'removeCss':
      return tabId == null ? null : chrome.scripting.removeCSS({ target: { tabId }, css: msg.css }).then(() => true);
    case 'dark':
      if (tabId == null) return null;
      return (msg.on ? chrome.scripting.insertCSS({ target: { tabId }, css: DARK_CSS }) : chrome.scripting.removeCSS({ target: { tabId }, css: DARK_CSS })).then(() => true);
    case 'outline':
      if (tabId == null) return null;
      return (msg.on ? chrome.scripting.insertCSS({ target: { tabId }, css: OUTLINE_CSS }) : chrome.scripting.removeCSS({ target: { tabId }, css: OUTLINE_CSS })).then(() => true);
    case 'runJs':
      return tabId == null ? null : runPageScript(tabId, msg.code).then(() => ({ ok: true }), (err) => ({ ok: false, error: String(err) }));
    case 'globals':
      if (tabId == null) return null;
      return chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: detectGlobals })
        .then(([r]) => r?.result ?? [], () => []);
    case 'hasPerm':
      return chrome.permissions.contains({ permissions: msg.permissions ?? [], origins: msg.origins ?? [] });
    case 'permsList':
      return chrome.permissions.getAll();
    case 'revoke':
      return chrome.permissions.remove({ permissions: msg.permissions ?? [], origins: msg.origins ?? [] })
        .then(async (ok) => {
          for (const o of msg.origins ?? []) {
            const host = String(o).replace(/^\*:\/\//, '').replace(/\/\*$/, '');
            await syncSite(host);
          }
          return ok;
        });
    case 'openPermit': {
      const q = new URLSearchParams({ tool: msg.tool, perms: (msg.permissions ?? []).join(','), host: msg.host ?? '' });
      return chrome.windows.create({ url: chrome.runtime.getURL(`permit.html?${q}`), type: 'popup', width: 460, height: 420 }).then(() => true);
    }
    case 'siteSync':
      return syncSite(msg.host);
    case 'siteApply': {
      if (tabId == null || !sender.url) return null;
      return applySite(tabId, sender.frameId ?? 0, new URL(sender.url).hostname).then(() => true);
    }
    case 'cookiesGet':
      return chrome.cookies.getAll({ url: msg.url });
    case 'cookiesSet':
      return chrome.cookies.set(msg.cookie);
    case 'cookiesRemove':
      return chrome.cookies.remove({ url: msg.url, name: msg.name });
    case 'download':
      return Promise.all((msg.urls as string[]).map((url) => chrome.downloads.download({ url }).catch(() => null))).then(() => true);
    case 'deviceWindow':
      // Rough window frame; the page area ends up close to the requested size.
      return chrome.windows.create({ url: msg.url, type: 'popup', width: msg.w + 16, height: msg.h + 88 }).then(() => true);
    default:
      return null;
  }
}

// Tell open panels that permissions changed, so "Allow" boxes update without reopening the tool.
async function broadcastPerms(): Promise<void> {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'permsChanged' }).catch(() => { /* no panel in this tab */ });
  }
}
chrome.permissions.onAdded.addListener(() => { broadcastPerms(); });
chrome.permissions.onRemoved.addListener(() => { broadcastPerms(); });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse: Reply) => {
  const p = handle(msg, sender);
  if (!p) return false;
  p.then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});
