// Dark mode for any site, remembered per site. Turning it on works right away in this tab;
// "turn on by itself" needs the user's permission for this one site.

async function autoRow(tool: 'dark' | 'inject', label: string, note: string): Promise<HTMLElement> {
  const host = location.hostname;
  const box = h('div');
  const render = async () => {
    const granted = await bg<boolean>({ type: 'hasPerm', origins: [`*://${host}/*`] }).catch(() => false);
    clear(box);
    box.append(granted
      ? h('div', { class: 'kv' }, h('span', null, label), h('b', { style: 'font-family:var(--ui)' }, tr('включено', 'on')))
      : h('div', { class: 'autobox' },
        h('div', { class: 'fmeta' }, h('b', { style: 'font-weight:500' }, label), h('span', null, note)),
        button(tr('Разрешить', 'Allow'), () => bg({ type: 'openPermit', tool, host }))));
  };
  await render();
  onPermsChanged(box, render);
  return box;
}

function mountDark(ctx: ToolCtx): void {
  const host = location.hostname;
  getSite().then(async (site) => {
    ctx.body.append(
      switchRow(tr(`Тёмная тема на ${host}`, `Dark mode on ${host}`), !!site.dark, async (on) => {
        await bg({ type: 'dark', on });
        await setSite({ dark: on });
      }, tr('Запоминается для этого сайта.', 'Remembered for this site.')),
      await autoRow('dark', tr('Включать сама при заходе', 'Turn on by itself'),
        tr('Без клика по значку. Нужен доступ к этому сайту.', 'Without clicking the icon. Needs access to this site.')),
      h('p', { class: 'note', style: 'margin:0' }, tr(
        'Цвета страницы инвертируются, а фото и видео остаются как есть. На сайтах, которые уже тёмные, просто выключи.',
        'Page colors are inverted while photos and videos stay as they are. On sites that are already dark, just turn it off.')),
    );
  });
}
