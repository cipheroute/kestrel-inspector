// The list of tools.

type ToolGroup = 'inspect' | 'modify' | 'capture' | 'data';

interface ToolCtx {
  body: HTMLElement;   // the tool window's content area
  layer: HTMLElement;  // full-screen layer for drawing over the page (does not catch the mouse)
  isOwn(target: EventTarget | null): boolean;  // true for the panel's own elements
  addCapture(): HTMLElement;  // full-screen element that catches the mouse, under the panel
  hideUi(hidden: boolean): void;
  close(): void;  // close this tool
}

interface ToolDef {
  id: string;
  icon: string;
  group: ToolGroup;
  key?: string;  // Alt+Shift+<key> while the panel is open
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  mount?: (ctx: ToolCtx) => (() => void) | void;
}

const GROUP_ORDER: ToolGroup[] = ['inspect', 'modify', 'capture', 'data'];
const GROUP_KEY: Record<ToolGroup, StrKey> = { inspect: 'gInspect', modify: 'gModify', capture: 'gCapture', data: 'gData' };

const TOOLS: ToolDef[] = [
  { id: 'css', icon: 'inspect', group: 'inspect', key: 'E', mount: mountCss,
    name: { ru: 'CSS-инспектор', en: 'CSS Inspector' },
    desc: { ru: 'Наведи на элемент — увидишь стили и отступы, правь их вживую и копируй.', en: 'Hover an element to see its styles and spacing, edit them live and copy.' } },
  { id: 'pipette', icon: 'pipette', group: 'inspect', key: 'C', mount: mountPipette,
    name: { ru: 'Пипетка', en: 'Color Picker' },
    desc: { ru: 'Возьми цвет с любого места страницы: HEX, RGB, HSL и история.', en: 'Pick a color anywhere on the page: HEX, RGB, HSL and history.' } },
  { id: 'ruler', icon: 'ruler', group: 'inspect', key: 'R', mount: mountRuler,
    name: { ru: 'Линейка', en: 'Ruler' },
    desc: { ru: 'Расстояния и размеры в пикселях.', en: 'Distances and sizes in pixels.' } },
  { id: 'fonts', icon: 'type', group: 'inspect', key: 'F', mount: mountFonts,
    name: { ru: 'Шрифты', en: 'Fonts' },
    desc: { ru: 'Все шрифты страницы, начертания и где они используются.', en: 'Every font on the page, its weights and where it is used.' } },
  { id: 'stack', icon: 'layers', group: 'inspect', mount: mountStack,
    name: { ru: 'Стек сайта', en: 'Site Stack' },
    desc: { ru: 'На чём сделан сайт: фреймворки, CMS, библиотеки. Без запросов в сеть.', en: 'What the site is built with: frameworks, CMS, libraries. No network requests.' } },
  { id: 'seo', icon: 'globe', group: 'inspect', mount: mountSeo,
    name: { ru: 'SEO и превью', en: 'SEO & Preview' },
    desc: { ru: 'Мета-теги, заголовки и как ссылка выглядит в соцсетях и мессенджерах.', en: 'Meta tags, headings and how the link looks in social apps.' } },
  { id: 'device', icon: 'phone', group: 'inspect', key: 'D', mount: mountDevice,
    name: { ru: 'Как на телефоне', en: 'Device View' },
    desc: { ru: 'Открой страницу в размерах телефона или планшета.', en: 'See the page at phone and tablet sizes.' } },
  { id: 'edit', icon: 'pencil', group: 'modify', mount: mountEdit,
    name: { ru: 'Правка страницы', en: 'Page Editor' },
    desc: { ru: 'Меняй текст, удаляй и двигай элементы прямо на сайте.', en: 'Edit text, delete and move elements right on the page.' } },
  { id: 'dark', icon: 'moon', group: 'modify', mount: mountDark,
    name: { ru: 'Тёмная тема для сайта', en: 'Dark Mode' },
    desc: { ru: 'Тёмный режим для любого сайта, отдельно для каждого домена.', en: 'Dark mode for any site, per domain.' } },
  { id: 'inject', icon: 'code', group: 'modify', mount: mountInject,
    name: { ru: 'Свои CSS и JS', en: 'Custom CSS & JS' },
    desc: { ru: 'Свои стили и скрипты для сайтов. JS — только после предупреждения.', en: 'Your own styles and scripts per site. JS only after a warning.' } },
  { id: 'outline', icon: 'grid', group: 'modify', mount: mountOutline,
    name: { ru: 'Контуры и сетки', en: 'Outlines & Grids' },
    desc: { ru: 'Подсветка блоков, флексов и сеток страницы.', en: 'Highlight blocks, flex and grid layouts.' } },
  { id: 'shot', icon: 'camera', group: 'capture', key: 'S', mount: mountShot,
    name: { ru: 'Скриншот', en: 'Screenshot' },
    desc: { ru: 'Видимая часть, вся страница или область. Стрелки и размытие.', en: 'Visible area, full page or a region. Arrows and blur.' } },
  { id: 'images', icon: 'image', group: 'capture', mount: mountImages,
    name: { ru: 'Картинки страницы', en: 'Page Images' },
    desc: { ru: 'Все изображения, фоны и SVG со скачиванием.', en: 'Every image, background and SVG, with download.' } },
  { id: 'cookies', icon: 'cookie', group: 'data', mount: mountCookies,
    name: { ru: 'Куки', en: 'Cookies' },
    desc: { ru: 'Смотри, ищи, правь и экспортируй куки сайта.', en: 'View, search, edit and export site cookies.' } },
  { id: 'json', icon: 'braces', group: 'data', mount: mountJson,
    name: { ru: 'JSON и кодировщик', en: 'JSON & Encoder' },
    desc: { ru: 'Форматирование JSON, Base64, URL, хэши.', en: 'Format JSON, Base64, URL, hashes.' } },
];

const TOOL_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));
