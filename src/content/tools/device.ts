// Device view: the current page inside a phone/tablet-sized frame on top of the page.
// The frame shows the same site, so sites that allow framing themselves (most do) work right here;
// for the rest there is a separate small window of the same size.

type DeviceGroup = 'phone' | 'fold' | 'tablet';

// w × h are CSS pixels in the device's natural orientation. `folds` = hinge lines drawn over the screen.
// Foldable sizes are calculated from the panel resolution (pixels ÷ device pixel ratio), so they are estimates.
interface DevicePreset { id: string; group: DeviceGroup; name: string; state?: [string, string]; w: number; h: number; folds?: number; estimate?: boolean; }

const DEVICE_GROUPS: [DeviceGroup, string, string][] = [
  ['phone', 'Телефоны', 'Phones'],
  ['fold', 'Складные', 'Foldables'],
  ['tablet', 'Планшеты и ноутбуки', 'Tablets & laptops'],
];

const DEVICES: DevicePreset[] = [
  { id: 'se', group: 'phone', name: 'iPhone SE', w: 375, h: 667 },
  { id: 'iphone', group: 'phone', name: 'iPhone 15', w: 393, h: 852 },
  { id: 'promax', group: 'phone', name: 'iPhone 15 Pro Max', w: 430, h: 932 },
  { id: 'pixel', group: 'phone', name: 'Pixel 8', w: 412, h: 915 },
  { id: 'galaxy', group: 'phone', name: 'Galaxy S24', w: 360, h: 780 },
  // iPhone Duo: 1398 × 2034 cover and 1878 × 2670 inner panel (apple.com), at 3× density.
  { id: 'duo-cover', group: 'fold', name: 'iPhone Duo', state: ['сложен', 'folded'], w: 466, h: 678, estimate: true },
  // Opened it is two covers side by side, so the inner screen is wider than tall.
  { id: 'duo-open', group: 'fold', name: 'iPhone Duo', state: ['раскрыт', 'open'], w: 890, h: 626, folds: 1, estimate: true },
  // Huawei Mate XT: 1008 × 2232, 2048 × 2232, 3184 × 2232 panel (huawei.com), at 3× density.
  { id: 'xt-1', group: 'fold', name: 'Huawei Mate XT', state: ['сложен', 'folded'], w: 336, h: 744, estimate: true },
  { id: 'xt-2', group: 'fold', name: 'Huawei Mate XT', state: ['два экрана', 'two screens'], w: 683, h: 744, folds: 1, estimate: true },
  { id: 'xt-3', group: 'fold', name: 'Huawei Mate XT', state: ['три экрана', 'three screens'], w: 1061, h: 744, folds: 2, estimate: true },
  // Galaxy Z TriFold: 1080 × 2520 cover at 2.625×, 2160 × 1584 inner at 2×.
  { id: 'tri-cover', group: 'fold', name: 'Galaxy Z TriFold', state: ['сложен', 'folded'], w: 412, h: 960, estimate: true },
  { id: 'tri-open', group: 'fold', name: 'Galaxy Z TriFold', state: ['раскрыт', 'open'], w: 1080, h: 792, folds: 2, estimate: true },
  { id: 'ipadmini', group: 'tablet', name: 'iPad mini', w: 768, h: 1024 },
  { id: 'ipad', group: 'tablet', name: 'iPad Pro 11"', w: 834, h: 1194 },
  { id: 'laptop', group: 'tablet', name: 'Laptop', w: 1280, h: 800 },
];

function deviceName(d: DevicePreset): string {
  const name = d.id === 'laptop' ? tr('Ноутбук', 'Laptop') : d.name;
  return d.state ? `${name} · ${d.state[currentLang === 'ru' ? 0 : 1]}` : name;
}

function mountDevice(ctx: ToolCtx): () => void {
  let device = DEVICES[1];
  let rotated = false; // false = held the usual way for this device
  const orientBox = h('div', { class: 'orient' });
  const stage = ctx.addCapture();
  stage.className = 'stage';
  const frame = h('iframe', { class: 'devframe', title: device.name, sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals' });
  const hinges = h('div', { class: 'hinges' });
  // Phones have overlay scrollbars that take no width and show up only while scrolling.
  // So the page's own scrollbar is hidden (that also keeps the width exact) and we draw a thin one.
  const thumb = h('div', { class: 'vthumb' });
  const vbar = h('div', { class: 'vbar' }, thumb);
  const screen = h('div', { class: 'devscreen' }, frame, hinges, vbar);
  let scale = 1;
  let hideTimer = 0;
  let hovered = false;

  const scroller = (): Element | null => {
    try { return frame.contentDocument?.scrollingElement ?? null; } catch { return null; }
  };

  function updateBar(): void {
    const el = scroller();
    const viewH = screen.clientHeight;
    if (!el || el.scrollHeight <= el.clientHeight + 1) { vbar.style.display = 'none'; return; }
    vbar.style.display = '';
    const thumbH = Math.max(28, (el.clientHeight / el.scrollHeight) * viewH);
    const top = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * (viewH - thumbH);
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }

  function flashBar(): void {
    updateBar();
    vbar.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => { if (!hovered) vbar.classList.remove('show'); }, 900);
  }

  screen.addEventListener('mouseenter', () => { hovered = true; flashBar(); });
  screen.addEventListener('mouseleave', () => { hovered = false; flashBar(); });

  let drag: { y: number; top: number } | null = null;
  thumb.addEventListener('pointerdown', (e) => {
    const el = scroller();
    if (!el) return;
    drag = { y: e.clientY, top: el.scrollTop };
    thumb.setPointerCapture(e.pointerId);
    vbar.classList.add('drag');
  });
  thumb.addEventListener('pointermove', (e) => {
    const el = scroller();
    if (!drag || !el) return;
    const viewH = screen.clientHeight;
    const thumbH = thumb.offsetHeight;
    const k = (el.scrollHeight - el.clientHeight) / Math.max(1, viewH - thumbH);
    el.scrollTop = drag.top + ((e.clientY - drag.y) / scale) * k;
  });
  const endDrag = () => { drag = null; vbar.classList.remove('drag'); flashBar(); };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);
  const label = h('div', { class: 'devlabel' });
  const blocked = h('div', { class: 'devblocked', style: 'display:none' },
    h('b', null, tr('Сайт не разрешает показывать себя в рамке', 'This site does not allow itself to be framed')),
    h('span', null, tr('Открой его в отдельном окне нужного размера — кнопка в окне инструмента.', 'Open it in a separate window of this size — the button is in the tool window.')));
  const shell = h('div', { class: 'devshell' }, screen, blocked, label);
  stage.append(shell);
  stage.addEventListener('click', (e) => { if (e.target === stage) ctx.close(); });

  function size(): { w: number; h: number } {
    return rotated ? { w: device.h, h: device.w } : { w: device.w, h: device.h };
  }

  // Two tiles that show the actual shape of the screen in each position — pick by look, not by word.
  function renderOrient(): void {
    clear(orientBox);
    for (const r of [false, true]) {
      const w = r ? device.h : device.w, hh = r ? device.w : device.h;
      const k = 44 / Math.max(w, hh);
      const n = device.folds ?? 0;
      const silhouette = h('span', { class: 'silh', style: `width:${Math.round(w * k)}px;height:${Math.round(hh * k)}px` },
        Array.from({ length: n }, (_, i) => h('span', { class: r ? 'sfold hz' : 'sfold vt', style: `${r ? 'top' : 'left'}:${((i + 1) / (n + 1)) * 100}%` })));
      const tile = h('button', { class: r === rotated ? 'otile on' : 'otile', 'aria-pressed': String(r === rotated) },
        h('span', { class: 'oframe' }, silhouette),
        h('b', null, r ? tr('Повёрнут', 'Rotated') : tr('Обычно', 'Usual')),
        h('small', null, `${w} × ${hh}`));
      tile.addEventListener('click', () => { if (rotated !== r) { rotated = r; layout(); } });
      orientBox.append(tile);
    }
  }

  function layout(): void {
    const { w, h: hh } = size();
    const panelSpace = 56 + 360 + 12 * 4;
    scale = Math.min(1, (window.innerWidth - panelSpace - 48) / w, (window.innerHeight - 96) / hh);
    setTimeout(updateBar, 400);
    screen.style.width = `${w}px`;
    screen.style.height = `${hh}px`;
    screen.style.transform = `scale(${scale})`;
    shell.style.width = `${w * scale}px`;
    shell.style.height = `${hh * scale}px`;
    shell.style.marginRight = `${panelSpace}px`;
    label.textContent = `${deviceName(device)} · ${w} × ${hh}${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}`;
    renderOrient();
    // Hinge lines split the screen into equal panels; rotating the device turns them sideways.
    clear(hinges);
    const n = device.folds ?? 0;
    for (let i = 1; i <= n; i++) {
      const pos = `${(i / (n + 1)) * 100}%`;
      hinges.append(h('div', { class: rotated ? 'hinge hz' : 'hinge vt', style: rotated ? `top:${pos}` : `left:${pos}` }));
    }
  }

  frame.addEventListener('load', () => {
    let ok = false;
    try { ok = frame.contentWindow!.location.href !== 'about:blank'; } catch { ok = false; }
    blocked.style.display = ok ? 'none' : 'flex';
    if (!ok) return;
    // Shown only once the page has painted — no white flash while it loads.
    requestAnimationFrame(() => frame.classList.add('ready'));
    try {
      const doc = frame.contentDocument!;
      for (const el of [doc.documentElement, doc.body]) el?.style.setProperty('scrollbar-width', 'none', 'important');
      frame.contentWindow!.addEventListener('scroll', flashBar, { passive: true });
      frame.contentWindow!.addEventListener('resize', updateBar);
    } catch { /* cross-origin after a redirect — leave the page's own scrollbar */ }
    updateBar();
  });
  frame.src = location.href;

  const deviceList = h('div', { class: 'devlist' });
  function renderList(): void {
    clear(deviceList);
    for (const [group, ru, en] of DEVICE_GROUPS) {
      deviceList.append(h('div', { class: 'glbl', style: 'padding:8px 10px 4px' }, currentLang === 'ru' ? ru : en));
      for (const d of DEVICES.filter((x) => x.group === group)) {
        const b = h('button', { class: d === device ? 'palrow sel' : 'palrow' },
          icon(d.folds ? 'fold' : d.w >= 1000 ? 'grid' : 'phone', 16), deviceName(d), h('small', null, `${d.w} × ${d.h}`));
        b.addEventListener('click', () => { device = d; rotated = false; renderList(); layout(); });
        deviceList.append(b);
      }
    }
  }
  renderList();
  layout();

  ctx.body.append(
    section(tr('Устройство', 'Device'), deviceList),
    section(tr('Как держать', 'How it is held'), orientBox),
    h('div', { class: 'btnrow' },
      button(tr('Перезагрузить', 'Reload'), () => { frame.classList.remove('ready'); frame.src = location.href; }, { icon: 'refresh' }),
      button(tr('В отдельном окне', 'Separate window'), () => { const s = size(); bg({ type: 'deviceWindow', url: location.href, w: s.w, h: s.h }); }, { icon: 'external' })),
    h('p', { class: 'note', style: 'margin:0' }, tr(
      'Ширина экрана настоящая, поэтому адаптивная вёрстка срабатывает как на устройстве. Сам браузер остаётся компьютерным.',
      'The screen width is real, so responsive layouts behave like on the device. The browser itself stays a desktop one.')),
    h('p', { class: 'note', style: 'margin:0' }, tr(
      'Размеры складных рассчитаны по разрешению экрана из характеристик производителя и могут отличаться от настоящих на несколько пикселей. Пунктир — линии сгиба.',
      'Foldable sizes are calculated from the maker\'s screen resolution and may differ from the real ones by a few pixels. Dashed lines are the folds.')),
  );

  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('resize', onResize); frame.src = 'about:blank'; };
}
