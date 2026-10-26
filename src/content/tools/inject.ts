// Custom CSS and JS per site. CSS is safe. JS runs on the site as you — so it stays locked
// behind an explicit warning until the user accepts responsibility.

function mountInject(ctx: ToolCtx): () => void {
  const host = location.hostname;
  let appliedCss = '';
  let tab: 'css' | 'js' = 'css';

  const cssArea = h('textarea', { class: 'ta', spellcheck: 'false', placeholder: 'body {\n  font-size: 18px;\n}' });
  const jsArea = h('textarea', { class: 'ta', spellcheck: 'false', placeholder: "document.querySelector('.banner')?.remove();" });
  const status = h('p', { class: 'note', style: 'margin:0' });
  const content = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });

  async function applyCss(): Promise<void> {
    if (appliedCss) await bg({ type: 'removeCss', css: appliedCss });
    appliedCss = cssArea.value;
    if (appliedCss.trim()) await bg({ type: 'insertCss', css: appliedCss });
  }

  function warning(): HTMLElement {
    const ok = button(tr('Понимаю, ответственность на мне', 'I understand, it is on me'), () => { settings.jsWarned = true; saveSettings(); render(); }, { primary: true });
    return h('div', { class: 'warn' },
      h('b', null, tr('Код выполняется на сайте от твоего имени', 'Code runs on the site as you')),
      h('span', null, tr(
        'Он видит всё, что видишь ты, и может делать всё, что можешь ты: читать письма, переводить деньги, менять пароль. Никогда не вставляй код от незнакомых людей, даже если обещают «секретную функцию». Ответственность за вставленный код только на тебе.',
        'It sees everything you see and can do everything you can: read mail, send money, change passwords. Never paste code from strangers, even if they promise a "secret feature". You alone are responsible for the code you paste.')),
      ok);
  }

  function render(): void {
    clear(content);
    if (tab === 'css') {
      content.append(cssArea, h('div', { class: 'btnrow' },
        button(tr('Применить', 'Apply'), async () => { await applyCss(); status.textContent = tr('Применено на этой вкладке.', 'Applied in this tab.'); }, { primary: true }),
        button(tr('Сохранить для сайта', 'Save for site'), async () => { await setSite({ css: cssArea.value }); await applyCss(); status.textContent = tr(`Сохранено для ${host}.`, `Saved for ${host}.`); })));
    } else if (!settings.jsWarned) {
      content.append(warning());
    } else {
      content.append(jsArea, h('div', { class: 'btnrow' },
        button(tr('Выполнить', 'Run'), async () => {
          const r = await bg<{ ok: boolean; error?: string }>({ type: 'runJs', code: jsArea.value });
          status.textContent = r?.ok ? tr('Выполнено. Если ничего не произошло, сайт мог запретить чужие скрипты.', 'Done. If nothing happened, the site may block injected scripts.') : (r?.error ?? '');
        }, { primary: true }),
        button(tr('Сохранить для сайта', 'Save for site'), async () => { await setSite({ js: jsArea.value, jsOn: true }); status.textContent = tr(`Сохранено для ${host}.`, `Saved for ${host}.`); })));
    }
    content.append(status);
  }

  getSite().then(async (site) => {
    cssArea.value = site.css ?? '';
    jsArea.value = site.js ?? '';
    appliedCss = site.css ?? '';
    ctx.body.append(
      segmented<'css' | 'js'>([['css', 'CSS'], ['js', 'JavaScript']], tab, (v) => { tab = v; status.textContent = ''; render(); }),
      content,
      await autoRow('inject', tr('Применять сами при заходе', 'Apply by themselves'),
        tr('Сохранённые CSS и JS — при каждом открытии сайта. Нужен доступ к этому сайту.', 'Saved CSS and JS on every visit. Needs access to this site.')),
    );
    render();
  });

  return () => {};
}
