// The panel: the rail on the right, the tool window, search, tooltips and keyboard handling.

const TON_ADDRESS = 'UQDdnORJX0lXISxEG5jxklKVRK36UjTNgiImltVcfrXdhBVR';
const GAP = 12;
const MIN_W = 260;
const MIN_H = 180;

class Panel {
  readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly layer: HTMLElement;
  private readonly rail: HTMLElement;
  private tip: HTMLElement | null = null;
  private win: HTMLElement | null = null;
  private winBody: HTMLElement | null = null;
  private ghost: HTMLElement | null = null;
  private pal: HTMLElement | null = null;
  private captures: HTMLElement[] = [];
  private visible = true;
  private wide = false;
  private active: string | null = null;
  private cleanup: (() => void) | null = null;
  private drag: { sx: number; sy: number; ox: number; oy: number; near: boolean } | null = null;
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.host = document.createElement('inspector-panel');
    this.host.style.cssText = 'all:initial !important;position:fixed !important;inset:0 !important;z-index:2147483647 !important;pointer-events:none !important;display:block !important;';
    const shadow = this.host.attachShadow({ mode: 'closed' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(PANEL_CSS);
      shadow.adoptedStyleSheets = [sheet];
    } catch {
      shadow.append(h('style', null, PANEL_CSS));
    }
    this.root = h('div', { class: 'root' });
    this.layer = h('div', { class: 'layer' });
    this.rail = h('div', { class: 'rail', role: 'toolbar', 'aria-label': 'Kestrel Inspector' });
    this.root.append(this.layer, this.rail);
    shadow.append(this.root);
    // Start off-screen so the very first appearance slides in like every later one.
    this.rail.classList.add('hidden');
    document.documentElement.append(this.host);
    requestAnimationFrame(() => requestAnimationFrame(() => this.rail.classList.toggle('hidden', !this.visible)));

    this.applyTheme();
    this.renderRail();
    this.placeRail();
    this.media.addEventListener('change', () => this.applyTheme());
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    window.addEventListener('resize', () => this.layout());
  }

  private layout(): void {
    this.placeRail();
    this.placeWindow();
  }

  // ---------- visibility, theme, language ----------

  toggle(): void {
    this.visible = !this.visible;
    this.rail.classList.toggle('hidden', !this.visible);
    if (!this.visible) {
      this.closeTool();
      this.closeSearch();
      this.hideTip();
    }
  }

  private applyTheme(): void {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && this.media.matches);
    this.root.dataset.theme = dark ? 'dark' : 'light';
  }

  private setLang(lang: Lang): void {
    currentLang = lang;
    settings.lang = lang;
    saveSettings();
    this.renderRail();
    if (this.active) this.reopen();
  }

  private railWidth(): number {
    return this.wide ? 300 : 56;
  }

  // Where the rail is. Docked: full height at the right edge. Moved by the user: wherever it was dropped.
  private railBox(): { x: number; y: number; w: number } {
    const w = this.railWidth();
    if (!settings.railFree) return { x: window.innerWidth - GAP - w, y: GAP, w };
    let x = settings.railX;
    if (this.wide && this.railOnRight()) x = settings.railX + 56 - w;  // grow towards the middle of the screen
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    const y = Math.max(8, Math.min(window.innerHeight - 160, settings.railY));
    return { x, y, w };
  }

  private railOnRight(): boolean {
    return !settings.railFree || settings.railX + 28 > window.innerWidth / 2;
  }

  // Height of the rail's content, so a moved rail can shrink to fit it.
  private railContentHeight(): number {
    const narrow = this.rail.querySelector<HTMLElement>('.narrow');
    if (!narrow) return Infinity;
    let total = 18; // padding + border
    for (const child of Array.from(narrow.children) as HTMLElement[]) {
      const cs = getComputedStyle(child);
      // The favorites list is stretched to fill the rail, so measure its buttons, not the list itself.
      let height = child.offsetHeight;
      if (child.classList.contains('favs')) {
        const first = child.firstElementChild, last = child.lastElementChild;
        height = first && last ? last.getBoundingClientRect().bottom - first.getBoundingClientRect().top + 4 : 0;
      }
      total += height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    }
    return total;
  }

  // The height is always set explicitly so it can animate both ways (CSS cannot animate to "auto").
  private placeRail(): void {
    const s = this.rail.style;
    this.rail.classList.toggle('free', settings.railFree);
    this.rail.classList.toggle('left', !this.railOnRight());
    if (!settings.railFree) {
      s.left = '';
      s.top = '';
      s.height = `${window.innerHeight - GAP * 2}px`;
      return;
    }
    const b = this.railBox();
    const maxH = window.innerHeight - b.y - GAP;
    s.left = `${b.x}px`;
    s.top = `${b.y}px`;
    s.height = `${this.wide ? maxH : Math.min(this.railContentHeight(), maxH)}px`;
  }

  private bindRailDrag(handle: HTMLElement): void {
    let d: { sx: number; sy: number; ox: number; oy: number; near: boolean } | null = null;
    let ghost: HTMLElement | null = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = this.rail.getBoundingClientRect();
      d = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, near: false };
      handle.setPointerCapture(e.pointerId);
      this.hideTip();
      this.closeSearch();
      this.rail.classList.add('moving');
      this.win?.classList.add('sizing');
      settings.railFree = true;
      settings.railX = r.left;
      settings.railY = r.top;
      ghost = h('div', { class: 'ghost', style: `right:${GAP}px;top:${GAP}px;bottom:${GAP}px;width:56px;height:auto` });
      this.root.insertBefore(ghost, this.rail);
      this.layout();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!d) return;
      settings.railX = d.ox + e.clientX - d.sx;
      settings.railY = d.oy + e.clientY - d.sy;
      d.near = window.innerWidth - (settings.railX + 56) < 64;
      ghost?.classList.toggle('near', d.near);
      this.layout();
    });
    const end = () => {
      if (!d) return;
      if (d.near) settings.railFree = false;
      d = null;
      ghost?.remove();
      ghost = null;
      this.rail.classList.remove('moving');
      this.win?.classList.remove('sizing');
      saveSettings();
      this.layout();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    handle.addEventListener('dblclick', () => { settings.railFree = false; saveSettings(); this.layout(); });
  }

  // ---------- rail ----------

  private railButton(iconName: string | null, label: string, opts: { id?: string; on?: boolean; key?: string; onClick: () => void; text?: string; extra?: Node; className?: string }): HTMLButtonElement {
    const btn = h('button', { class: `rbtn${opts.on ? ' on' : ''}${opts.className ? ' ' + opts.className : ''}`, 'data-id': opts.id, 'aria-label': label },
      iconName ? icon(iconName, 20) : opts.text ?? '', opts.extra ?? null);
    btn.addEventListener('click', () => { this.hideTip(); opts.onClick(); });
    btn.addEventListener('mouseenter', () => this.showTip(btn, label, opts.key));
    btn.addEventListener('mouseleave', () => this.hideTip());
    return btn;
  }

  private renderRail(): void {
    clear(this.rail);
    this.rail.classList.toggle('wide', this.wide);
    if (this.wide) { this.renderWide(); return; }

    const favs = h('div', { class: 'favs' });
    for (const id of settings.favs) {
      const tool = TOOL_BY_ID.get(id);
      if (!tool) continue;
      favs.append(this.railButton(tool.icon, tool.name[currentLang], {
        id,
        on: this.active === id,
        key: tool.key ? `Alt + Shift + ${tool.key}` : undefined,
        onClick: () => this.openTool(id),
      }));
    }

    this.rail.append(h('div', { class: 'narrow' },
      h('div', { class: 'logo' }, icon('logo', 30)),
      this.railButton('search', t('search'), { id: 'search', on: !!this.pal, key: 'Ctrl + K', onClick: () => this.toggleSearch() }),
      h('div', { class: 'sep' }),
      favs,
      h('div', { class: 'sep' }),
      this.railButton('allTools', t('allTools'), { onClick: () => { this.wide = true; this.closeSearch(); this.renderRail(); this.layout(); } }),
      h('div', { class: 'sep' }),
      this.railButton(null, t('langTip'), { text: currentLang.toUpperCase(), className: 'langchip', onClick: () => this.setLang(currentLang === 'ru' ? 'en' : 'ru') }),
      this.railButton('shield', t('privTip'), { id: 'privacy', on: this.active === 'privacy', extra: h('span', { class: 'okdot' }), onClick: () => this.openTool('privacy') }),
      this.railButton('gear', t('settings'), { id: 'settings', on: this.active === 'settings', onClick: () => this.openTool('settings') }),
      h('div', { class: 'sep' }),
      this.railGrip(),
    ));
    if (settings.railFree) this.placeRail();
  }

  // Handle at the bottom of the rail for moving the whole panel.
  private railGrip(): HTMLElement {
    const grip = h('button', { class: 'rgrip', 'aria-label': t('moveRail') }, icon('gripH', 20));
    grip.addEventListener('mouseenter', () => this.showTip(grip, t('moveRail')));
    grip.addEventListener('mouseleave', () => this.hideTip());
    this.bindRailDrag(grip);
    return grip;
  }

  // Update highlighted buttons in place, without rebuilding the rail (no flicker).
  private syncRail(): void {
    this.rail.querySelectorAll<HTMLElement>('.rbtn[data-id]').forEach((b) => {
      const id = b.dataset.id;
      b.classList.toggle('on', id === 'search' ? !!this.pal : id === this.active);
    });
  }

  private renderWide(): void {
    const collapse = h('button', { class: 'wbtn', 'aria-label': t('collapse'), title: t('collapse') }, icon('chevronRight', 17));
    collapse.addEventListener('click', () => { this.wide = false; this.renderRail(); this.layout(); });
    const list = h('div', { class: 'wlist' });
    for (const group of GROUP_ORDER) {
      list.append(h('div', { class: 'glbl' }, t(GROUP_KEY[group])));
      for (const tool of TOOLS.filter((x) => x.group === group)) {
        const isFav = settings.favs.includes(tool.id);  // initial state only
        const row = h('button', { class: 'trow' }, icon(tool.icon, 18), tool.name[currentLang]);
        row.addEventListener('click', () => this.openTool(tool.id));
        const star = h('button', { class: isFav ? 'star on' : 'star', 'aria-label': isFav ? t('unfav') : t('fav'), title: isFav ? t('unfav') : t('fav') }, icon('star', 16));
        star.addEventListener('click', () => {
          const fav = !settings.favs.includes(tool.id);
          settings.favs = fav ? [...settings.favs, tool.id] : settings.favs.filter((f) => f !== tool.id);
          saveSettings();
          // Only the star changes; the narrow rail is rebuilt when the list collapses.
          star.classList.toggle('on', fav);
          star.setAttribute('aria-label', fav ? t('unfav') : t('fav'));
          star.title = fav ? t('unfav') : t('fav');
        });
        list.append(h('div', { class: 'titem' }, row, star));
      }
    }
    this.rail.append(h('div', { class: 'wide-list' }, h('div', { class: 'whd' }, h('b', null, t('allTools')), collapse), list));
  }

  private showTip(anchor: HTMLElement, text: string, key?: string): void {
    if (this.wide || this.drag) return;
    const r = anchor.getBoundingClientRect();
    if (!this.tip) {
      this.tip = h('div', { class: 'tip' });
      this.root.append(this.tip);
    }
    this.tip.replaceChildren(text, key ? h('span', { class: 'tipk' }, key) : '');
    this.tip.style.top = `${r.top + r.height / 2}px`;
    const rail = this.rail.getBoundingClientRect();
    // Tooltips open towards the middle of the screen.
    this.tip.classList.toggle('right', !this.railOnRight());
    if (this.railOnRight()) { this.tip.style.right = `${window.innerWidth - rail.left + 10}px`; this.tip.style.left = ''; }
    else { this.tip.style.left = `${rail.right + 10}px`; this.tip.style.right = ''; }
  }

  private hideTip(): void {
    this.tip?.remove();
    this.tip = null;
  }

  // ---------- tool window ----------

  openTool(id: string): void {
    if (!this.visible) this.toggle();
    if (this.active === id) { this.closeTool(); return; }
    this.closeTool();
    this.closeSearch();
    this.active = id;
    this.buildWindow();
    this.syncRail();
  }

  private reopen(): void {
    const id = this.active;
    this.closeTool();
    if (id) { this.active = id; this.buildWindow(); this.syncRail(); }
  }

  // The panel forgets the tool at once (so another one can open right away), while its window and
  // overlays play a short exit animation; the tool's own cleanup runs when they are gone.
  closeTool(): void {
    const cleanup = this.cleanup;
    const leaving = [...this.captures, ...(this.win ? [this.win] : [])];
    // The tool's drawings over the page (highlights, lines) go at once: a tool opened right after
    // (e.g. the color picker taking a screenshot) must not see them.
    Array.from(this.layer.children).forEach((el) => (el as HTMLElement).style.setProperty('display', 'none', 'important'));
    this.cleanup = null;
    this.captures = [];
    this.win = null;
    this.winBody = null;
    this.active = null;
    this.syncRail();
    leaving.forEach((el) => el.classList.add('leaving'));
    setTimeout(() => {
      if (cleanup) { try { cleanup(); } catch (err) { console.warn('[inspector]', err); } }
      leaving.forEach((el) => el.remove());
    }, 220);
  }

  private buildWindow(): void {
    const id = this.active!;
    const tool = TOOL_BY_ID.get(id);
    const title = id === 'settings' ? t('settings') : id === 'privacy' ? t('privacy') : tool?.name[currentLang] ?? '';
    const iconName = id === 'settings' ? 'gear' : id === 'privacy' ? 'shieldCheck' : tool?.icon ?? 'logo';

    const head = h('div', { class: 'whead' },
      icon('grip', 18, 'grip'),
      h('span', { class: 'wicon' }, icon(iconName, 18)),
      h('span', { class: 'wtitle' }, title));
    if (!settings.docked) {
      const pin = h('button', { class: 'wbtn', 'data-pin': '1', 'aria-label': t('dock'), title: t('dock') }, icon('pin', 17));
      pin.addEventListener('pointerdown', (e) => e.stopPropagation());
      pin.addEventListener('click', () => { settings.docked = true; saveSettings(); this.placeWindow(); pin.remove(); });
      head.append(pin);
    }
    const close = h('button', { class: 'wbtn', 'aria-label': t('close'), title: t('close') }, icon('x', 17));
    close.addEventListener('pointerdown', (e) => e.stopPropagation());
    close.addEventListener('click', () => this.closeTool());
    head.append(close);
    this.bindDrag(head);

    this.winBody = h('div', { class: 'wbody' });
    const grip = h('div', { class: 'rsz', title: t('resize') }, icon('resizeLeft', 14, 'rl'), icon('resizeRight', 14, 'rr'));
    this.bindResize(grip);
    this.win = h('div', { class: 'win', role: 'dialog', 'aria-label': title }, head, this.winBody, grip);
    this.root.append(this.win);
    this.placeWindow();

    if (id === 'settings') this.renderSettings(this.winBody);
    else if (id === 'privacy') this.renderPrivacy(this.winBody);
    else if (tool?.mount) this.cleanup = tool.mount(this.makeCtx(this.winBody)) ?? null;
    else if (tool) this.renderSoon(this.winBody, tool);
  }

  private makeCtx(body: HTMLElement): ToolCtx {
    return {
      body,
      layer: this.layer,
      isOwn: (target) => target === this.host,
      addCapture: () => {
        const c = h('div', { class: 'capture' });
        this.root.insertBefore(c, this.rail);
        this.captures.push(c);
        return c;
      },
      hideUi: (hidden) => { this.host.style.setProperty('visibility', hidden ? 'hidden' : 'visible', 'important'); },
      close: () => this.closeTool(),
    };
  }

  // Window width: what the user set, but never wider than the free space next to the rail.
  private winWidth(): number {
    const room = window.innerWidth - this.railWidth() - GAP * 3;
    return Math.max(Math.min(MIN_W, room), Math.min(settings.winW, room));
  }

  // A docked window sits next to the rail, on the side facing the middle of the screen.
  private dockPos(): { x: number; y: number } {
    const b = this.railBox();
    return { x: this.railOnRight() ? b.x - GAP - this.winWidth() : b.x + b.w + GAP, y: b.y };
  }

  private growsLeft(): boolean {
    return settings.docked && this.railOnRight();
  }

  private placeWindow(): void {
    if (!this.win) return;
    const w = this.winWidth();
    let { x, y } = settings.docked ? this.dockPos() : { x: settings.winX, y: settings.winY };
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - 120, y));
    const maxH = window.innerHeight - y - GAP;
    this.win.style.left = `${x}px`;
    this.win.style.top = `${y}px`;
    this.win.style.width = `${w}px`;
    this.win.style.maxHeight = `${maxH}px`;
    this.win.style.height = settings.winH ? `${Math.min(settings.winH, maxH)}px` : '';
    // A window docked to a right-side rail grows to the left; otherwise it grows to the right.
    this.win.classList.toggle('docked', this.growsLeft());
  }

  private bindResize(grip: HTMLElement): void {
    let start: { x: number; y: number; w: number; h: number; right: number } | null = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.win) return;
      e.stopPropagation();
      const r = this.win.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, right: r.right };
      grip.setPointerCapture(e.pointerId);
      this.win.classList.add('sizing');
      this.hideTip();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!start || !this.win) return;
      const dx = e.clientX - start.x;
      settings.winW = Math.max(MIN_W, Math.round(this.growsLeft() ? start.w - dx : start.w + dx));
      settings.winH = Math.max(MIN_H, Math.round(start.h + e.clientY - start.y));
      if (!settings.docked) settings.winX = this.win.getBoundingClientRect().left;
      this.placeWindow();
    });
    const end = () => {
      if (!start || !this.win) return;
      start = null;
      this.win.classList.remove('sizing');
      saveSettings();
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => { settings.winW = 360; settings.winH = 0; saveSettings(); this.placeWindow(); });
  }

  private bindDrag(head: HTMLElement): void {
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.win) return;
      const r = this.win.getBoundingClientRect();
      this.drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, near: false };
      head.setPointerCapture(e.pointerId);
      this.win.classList.add('drag');
      this.hideTip();
      const dp = this.dockPos();
      this.ghost = h('div', { class: 'ghost', style: `left:${dp.x}px;top:${dp.y}px;width:${this.winWidth()}px` });
      this.root.insertBefore(this.ghost, this.win);
    });
    head.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || !this.win) return;
      const x = Math.max(8, Math.min(window.innerWidth - this.winWidth() - 8, d.ox + e.clientX - d.sx));
      const y = Math.max(8, Math.min(window.innerHeight - 60, d.oy + e.clientY - d.sy));
      this.win.style.left = `${x}px`;
      this.win.style.top = `${y}px`;
      const dp = this.dockPos();
      d.near = Math.abs(x - dp.x) < 56 && Math.abs(y - dp.y) < 56;
      this.ghost?.classList.toggle('near', d.near);
    });
    const end = () => {
      const d = this.drag;
      if (!d || !this.win) return;
      this.drag = null;
      this.win.classList.remove('drag');
      this.ghost?.remove();
      this.ghost = null;
      const r = this.win.getBoundingClientRect();
      const moved = Math.abs(r.left - d.ox) > 3 || Math.abs(r.top - d.oy) > 3;
      if (!moved) return;
      settings.docked = d.near;
      settings.winX = r.left;
      settings.winY = r.top;
      saveSettings();
      this.placeWindow();
      // Show or hide the dock button to match the new state.
      if (this.active) this.reopenKeepingPosition();
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }

  // Rebuild the header (dock button) without remounting the tool.
  private reopenKeepingPosition(): void {
    const head = this.win?.querySelector('.whead');
    if (!head) return;
    const existing = head.querySelector('[data-pin]');
    if (settings.docked) { existing?.remove(); return; }
    if (existing) return;
    const pin = h('button', { class: 'wbtn', 'data-pin': '1', 'aria-label': t('dock'), title: t('dock') }, icon('pin', 17));
    pin.addEventListener('pointerdown', (e) => e.stopPropagation());
    pin.addEventListener('click', () => { settings.docked = true; saveSettings(); this.placeWindow(); pin.remove(); });
    head.insertBefore(pin, head.lastElementChild);
  }

  // ---------- built-in windows ----------

  private renderSoon(body: HTMLElement, tool: ToolDef): void {
    body.append(
      h('p', { style: 'font-size:14px' }, tool.desc[currentLang]),
      h('div', { class: 'kv' }, h('span', null, t('soon')), h('span', null, t('soonText'))),
    );
  }

  private segment(options: [string, string][], current: string, onPick: (value: string) => void): HTMLElement {
    return h('div', { class: 'seg' }, options.map(([value, label]) => {
      const b = h('button', { class: value === current ? 'on' : '' }, label);
      b.addEventListener('click', () => onPick(value));
      return b;
    }));
  }

  private renderSettings(body: HTMLElement): void {
    const hotkeys: [string, string[]][] = [
      [t('hkOpen'), ['Alt', 'Shift', 'I']],
      [t('hkSearch'), ['Ctrl', 'K']],
      ...TOOLS.filter((x) => x.key && x.mount).map((x): [string, string[]] => [x.name[currentLang], ['Alt', 'Shift', x.key!]]),
      [t('hkExit'), ['Esc']],
    ];
    body.append(
      h('div', null, h('p', { class: 'lbl' }, t('theme')),
        this.segment([['system', t('themeSys')], ['dark', t('themeDark')], ['light', t('themeLight')]], settings.theme, (v) => {
          settings.theme = v as ThemePref; saveSettings(); this.applyTheme(); this.reopen();
        })),
      h('div', null, h('p', { class: 'lbl' }, t('language')),
        this.segment([['ru', 'Русский'], ['en', 'English']], currentLang, (v) => this.setLang(v as Lang))),
      h('div', null, h('p', { class: 'lbl' }, t('keys')),
        h('div', null, hotkeys.map(([label, keys]) => h('div', { class: 'hkrow' }, h('span', null, label), kbd(...keys)))),
        h('p', { class: 'note' }, t('keysNote'))),
      h('div', null, h('p', { class: 'lbl' }, t('support')),
        h('div', { class: 'addrbox' }, h('span', { style: 'flex:1' }, TON_ADDRESS), copyButton(() => TON_ADDRESS, t('copy'))),
        h('p', { class: 'note' }, t('supportNote'))),
      h('p', { class: 'note', style: 'margin:0' }, `${t('license')} · ${t('version')} ${chrome.runtime.getManifest().version}`),
    );
  }

  private renderPrivacy(body: HTMLElement): void {
    const perms: [string, string][] = [
      [t('permTab'), t('permTabState')],
      [t('permScripting'), t('permScriptingState')],
      [t('permStorage'), t('permStorageState')],
    ];
    const extra = h('div');
    body.append(
      h('div', { class: 'netok' }, icon('shieldCheck', 28), h('div', null, h('b', null, t('netTitle')), h('span', null, t('netSub')))),
      h('div', null, h('p', { class: 'lbl' }, t('perms')),
        perms.map(([name, state]) => h('div', { class: 'perm' }, h('b', { style: 'font-weight:500' }, name), h('span', null, state))),
        h('p', { class: 'note' }, t('permsNote'))),
      extra,
      h('div', null, h('p', { class: 'lbl' }, t('log')), h('div', { class: 'empty' }, t('logEmpty')),
        h('p', { class: 'note' }, tr(
          'Некоторые инструменты показывают картинки или страницу самого сайта (SEO, картинки, «как на телефоне») — их загружает браузер с этого сайта, как при обычном просмотре.',
          'Some tools show images or the page of the site itself (SEO, images, device view) — the browser loads them from that site, as in normal browsing.'))),
      h('div', null, h('p', { class: 'lbl' }, t('verify')), h('p', null, t('verifyText'))),
    );
    this.renderGranted(extra);
  }

  // Permissions the user granted later, each with a revoke button.
  private async renderGranted(box: HTMLElement): Promise<void> {
    const all = await bg<chrome.permissions.Permissions>({ type: 'permsList' }).catch(() => null);
    clear(box);
    const names: Record<string, string> = { cookies: tr('Куки', 'Cookies'), downloads: tr('Загрузки', 'Downloads') };
    const items: [string, chrome.permissions.Permissions][] = [
      ...(all?.permissions ?? []).filter((p) => p in names).map((p): [string, chrome.permissions.Permissions] => [names[p], { permissions: [p] }]),
      ...(all?.origins ?? []).map((o): [string, chrome.permissions.Permissions] => [o.replace(/^\*:\/\//, '').replace(/\/\*$/, ''), { origins: [o] }]),
    ];
    if (!items.length) return;
    box.append(section(tr('Выдано по запросу', 'Granted on request'), items.map(([label, p]) => {
      const revoke = h('button', { class: 'linkbtn' }, tr('Отозвать', 'Revoke'));
      revoke.addEventListener('click', async () => { await bg({ type: 'revoke', ...p }); this.renderGranted(box); });
      return h('div', { class: 'perm' }, h('b', { style: 'font-weight:500' }, label), revoke);
    })));
  }

  // ---------- search ----------

  private toggleSearch(): void {
    if (this.pal) this.closeSearch(); else this.openSearch();
  }

  private closeSearch(): void {
    if (!this.pal) return;
    this.pal.remove();
    this.pal = null;
    this.syncRail();
  }

  private openSearch(): void {
    if (!this.visible) this.toggle();
    if (this.wide) { this.wide = false; this.renderRail(); this.layout(); }
    const input = h('input', { type: 'text', placeholder: t('searchPh'), 'aria-label': t('searchPh'), autocomplete: 'off', spellcheck: 'false' });
    const list = h('div', { class: 'pallist' });
    let results: ToolDef[] = [];
    let sel = 0;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      results = TOOLS.filter((x) => !q || x.name.ru.toLowerCase().includes(q) || x.name.en.toLowerCase().includes(q) || x.id.includes(q));
      sel = Math.min(sel, Math.max(0, results.length - 1));
      clear(list);
      if (!results.length) { list.append(h('div', { class: 'empty', style: 'margin:6px' }, t('nothing'))); return; }
      results.forEach((x, i) => {
        const row = h('button', { class: i === sel ? 'palrow sel' : 'palrow' }, icon(x.icon, 18), x.name[currentLang], h('small', null, t(GROUP_KEY[x.group])));
        row.addEventListener('click', () => this.openTool(x.id));
        list.append(row);
      });
    };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, results.length - 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && results[sel]) { this.openTool(results[sel].id); }
    });
    this.pal = h('div', { class: 'pal', role: 'dialog', 'aria-label': t('search') },
      h('label', { class: 'palin' }, icon('search', 18), input, h('span', { class: 'k' }, 'Esc')), list);
    const rb = this.railBox();
    this.pal.style.top = `${rb.y}px`;
    if (this.railOnRight()) this.pal.style.right = `${window.innerWidth - rb.x + GAP}px`;
    else this.pal.style.left = `${rb.x + rb.w + GAP}px`;
    this.root.append(this.pal);
    draw();
    this.syncRail();
    setTimeout(() => input.focus(), 0);
  }

  // ---------- keyboard ----------

  private onKey(e: KeyboardEvent): void {
    if (!this.visible) return;
    const fromPanel = e.composedPath().includes(this.host);
    if (e.key === 'Escape') {
      if (this.pal) this.closeSearch();
      else if (this.wide) { this.wide = false; this.renderRail(); this.layout(); }
      else if (this.active) this.closeTool();
      else return;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyK') {
      this.toggleSearch();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code.startsWith('Key')) {
      const letter = e.code.slice(3);
      const tool = TOOLS.find((x) => x.key === letter && x.mount);
      if (tool) {
        this.openTool(tool.id);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    // Typing inside the panel must not trigger the site's own shortcuts.
    if (fromPanel) e.stopPropagation();
  }
}
