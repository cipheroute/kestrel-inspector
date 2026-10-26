// Cookies. Without extra permission we see what the page itself can see (document.cookie).
// With the user's permission for this site we also see HttpOnly cookies and their details.

interface CookieRow { name: string; value: string; domain?: string; path?: string; httpOnly?: boolean; secure?: boolean; expires?: number; full: boolean; }

function pageCookies(): CookieRow[] {
  if (!document.cookie) return [];
  return document.cookie.split('; ').map((pair) => {
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i), value: decodeURIComponent(pair.slice(i + 1)), full: false };
  });
}

function mountCookies(ctx: ToolCtx): void {
  const host = location.hostname;
  let rows: CookieRow[] = [];
  let full = false;
  let query = '';
  const list = h('div', { class: 'cklist' });
  const status = h('p', { class: 'note', style: 'margin:0' });

  async function load(): Promise<void> {
    full = await bg<boolean>({ type: 'hasPerm', permissions: ['cookies'], origins: [`*://${host}/*`] }).catch(() => false);
    if (full) {
      const all = await bg<chrome.cookies.Cookie[]>({ type: 'cookiesGet', url: location.href }).catch(() => []);
      rows = (all ?? []).map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, expires: c.expirationDate, full: true }));
    } else {
      rows = pageCookies();
    }
    render();
  }

  async function save(row: CookieRow, value: string): Promise<void> {
    if (row.full) {
      await bg({ type: 'cookiesSet', cookie: { url: location.href, name: row.name, value, domain: row.domain?.startsWith('.') ? row.domain : undefined, path: row.path, secure: row.secure, httpOnly: row.httpOnly, expirationDate: row.expires } });
    } else {
      document.cookie = `${row.name}=${encodeURIComponent(value)}; path=/`;
    }
    await load();
  }

  async function remove(row: CookieRow): Promise<void> {
    if (row.full) await bg({ type: 'cookiesRemove', url: location.href, name: row.name });
    else document.cookie = `${row.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    await load();
  }

  function render(): void {
    clear(list);
    const shown = rows.filter((r) => !query || r.name.toLowerCase().includes(query) || r.value.toLowerCase().includes(query));
    for (const row of shown) {
      const val = h('span', { class: 'ckval', contenteditable: 'true', spellcheck: 'false' }, row.value);
      val.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); val.blur(); } });
      val.addEventListener('blur', () => { const v = val.textContent ?? ''; if (v !== row.value) save(row, v); });
      const del = h('button', { class: 'wbtn', title: tr('Удалить', 'Delete'), 'aria-label': tr('Удалить', 'Delete') }, icon('trash', 15));
      del.addEventListener('click', () => remove(row));
      const flags = [row.httpOnly ? 'HttpOnly' : '', row.secure ? 'Secure' : '', row.domain ?? ''].filter(Boolean).join(' · ');
      list.append(h('div', { class: 'ckrow' },
        h('div', { class: 'ckhead' }, h('b', null, row.name), h('span', { class: 'tacts' }, copyButton(() => row.value, t('copy')), del)),
        val, flags ? h('span', { class: 'ckflags' }, flags) : null));
    }
    if (!shown.length) list.append(h('p', { class: 'muted' }, tr('Куки нет.', 'No cookies.')));
    status.textContent = `${tr('Всего', 'Total')}: ${rows.length}`;
  }

  const search = h('input', { class: 'inp', type: 'text', placeholder: tr('Поиск по имени или значению', 'Search by name or value'), spellcheck: 'false' });
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });
  const exportBtn = button(tr('Экспорт JSON', 'Export JSON'), () => downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `cookies-${host}.json`), { icon: 'download' });
  const moreBox = h('div');

  load().then(() => {
    if (!full) {
      moreBox.append(h('div', { class: 'autobox' },
        h('div', { class: 'fmeta' }, h('b', { style: 'font-weight:500' }, tr('Показать все куки', 'Show all cookies')),
          h('span', null, tr('Сейчас видны только те, что видит сама страница. Скрытые (HttpOnly) — с разрешения.', 'Only cookies the page itself can see are shown. Hidden (HttpOnly) ones need permission.'))),
        button(tr('Разрешить', 'Allow'), () => bg({ type: 'openPermit', tool: 'cookies', permissions: ['cookies'], host }))));
    }
  });

  ctx.body.append(search, list, h('div', { class: 'btnrow' }, exportBtn, button(tr('Обновить', 'Refresh'), () => load(), { icon: 'refresh' })), moreBox, status,
    h('p', { class: 'note', style: 'margin:0' }, tr('Нажми на значение, чтобы изменить его.', 'Click a value to edit it.')));
}
