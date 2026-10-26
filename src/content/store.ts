// User settings, kept in chrome.storage.local on this device only.

type ThemePref = 'system' | 'dark' | 'light';

interface Settings {
  theme: ThemePref;
  lang: Lang | null; // null = follow the browser language
  favs: string[];
  docked: boolean;
  winX: number;
  winY: number;
  winW: number;
  winH: number; // 0 = fit content
  colorHistory: string[];
  jsWarned: boolean; // the user has read the custom-JS warning
  railFree: boolean; // the user moved the rail away from the right edge
  railX: number;
  railY: number;
  rulerSnap: boolean; // ruler line ends snap to element edges
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  lang: null,
  favs: ['css', 'pipette', 'ruler', 'fonts', 'shot', 'images', 'device', 'cookies'],
  docked: true,
  winX: 0,
  winY: 0,
  winW: 360,
  winH: 0,
  colorHistory: [],
  jsWarned: false,
  railFree: false,
  railX: 0,
  railY: 0,
  rulerSnap: false,
};

const settings: Settings = { ...DEFAULT_SETTINGS };
let saveTimer = 0;

async function loadSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get('settings');
    Object.assign(settings, stored.settings ?? {});
  } catch {
    // storage unavailable — keep defaults
  }
  if (settings.lang) currentLang = settings.lang;
}

// Per-site settings (dark mode, custom CSS/JS), keyed by host name.
interface SiteSettings { dark?: boolean; css?: string; js?: string; jsOn?: boolean; }

async function getSite(host = location.hostname): Promise<SiteSettings> {
  const { sites } = await chrome.storage.local.get('sites') as { sites?: Record<string, SiteSettings> };
  return sites?.[host] ?? {};
}

async function setSite(patch: SiteSettings, host = location.hostname): Promise<SiteSettings> {
  const { sites = {} } = await chrome.storage.local.get('sites') as { sites?: Record<string, SiteSettings> };
  const next = { ...(sites[host] ?? {}), ...patch };
  sites[host] = next;
  await chrome.storage.local.set({ sites });
  await bg({ type: 'siteSync', host });
  return next;
}

function saveSettings(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    chrome.storage.local.set({ settings: { ...settings } }).catch(() => {});
  }, 200);
}
