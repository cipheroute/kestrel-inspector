// Small extension page that asks the browser for one extra permission.
// Browsers only allow permission requests from extension pages after a click, so the panel opens this.

(async () => {
  const stored = await chrome.storage.local.get('settings') as { settings?: { lang?: Lang } };
  if (stored.settings?.lang) currentLang = stored.settings.lang;

  const params = new URLSearchParams(location.search);
  const tool = params.get('tool') ?? '';
  const host = params.get('host') ?? '';
  const permissions = (params.get('perms') ?? '').split(',').filter(Boolean);
  const origins = host ? [`*://${host}/*`] : [];

  const reasons: Record<string, [string, string]> = {
    cookies: [
      'Чтобы показать все куки сайта, включая скрытые от скриптов (HttpOnly), и менять их.',
      'To show all cookies of the site, including HttpOnly ones hidden from scripts, and edit them.',
    ],
    images: [
      'Чтобы скачивать картинки файлами. Браузер покажет их в своих загрузках.',
      'To save images as files. They will appear in your browser downloads.',
    ],
    dark: [
      'Чтобы тёмная тема включалась сама при каждом заходе на этот сайт, без клика по значку.',
      'To turn dark mode on by itself every time you open this site, without clicking the icon.',
    ],
    inject: [
      'Чтобы твои CSS и JS применялись сами при каждом заходе на этот сайт.',
      'To apply your CSS and JS by themselves every time you open this site.',
    ],
  };
  const what: string[] = [];
  if (permissions.includes('cookies')) what.push(tr('Куки', 'Cookies'));
  if (permissions.includes('downloads')) what.push(tr('Загрузки файлов', 'File downloads'));
  if (host) what.push(tr(`Доступ к сайту ${host}`, `Access to ${host}`));

  const set = (id: string, text: string) => { document.getElementById(id)!.textContent = text; };
  document.documentElement.lang = currentLang;
  set('title', tr('Нужно разрешение', 'Permission needed'));
  set('why', (reasons[tool] ?? ['', ''])[currentLang === 'ru' ? 0 : 1]);
  set('whatLabel', tr('Что разрешаешь', 'What you allow'));
  set('what', what.join(' · '));
  set('note', tr(
    'Только это и только для этого. Отозвать можно в любой момент в разделе «Прозрачность».',
    'Only this, only for this purpose. You can revoke it any time in Transparency.',
  ));
  set('cancel', tr('Не сейчас', 'Not now'));
  set('allow', tr('Разрешить', 'Allow'));

  document.getElementById('cancel')!.addEventListener('click', () => window.close());
  document.getElementById('allow')!.addEventListener('click', async () => {
    const ok = await chrome.permissions.request({ permissions: permissions as chrome.runtime.ManifestPermission[], origins });
    if (ok && host) await chrome.runtime.sendMessage({ type: 'siteSync', host });
    set('title', ok ? tr('Готово', 'Done') : tr('Не разрешено', 'Not allowed'));
    set('why', ok ? tr('Вернись на страницу и повтори действие.', 'Go back to the page and try again.') : '');
    setTimeout(() => window.close(), ok ? 900 : 1600);
  });
})();
