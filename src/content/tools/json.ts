// JSON formatter and encoder/decoder. Runs locally; hashes use the browser's built-in crypto (and a small MD5).

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function b64decode(s: string): string {
  const bin = atob(s.trim().replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function htmlEncode(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function htmlDecode(s: string): string {
  return new DOMParser().parseFromString(`<!doctype html><body>${s}`, 'text/html').body.textContent ?? '';
}

function hexEncode(s: string): string {
  return Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(s: string): string {
  const clean = s.replace(/[^0-9a-f]/gi, '');
  return new TextDecoder().decode(Uint8Array.from(clean.match(/../g) ?? [], (x) => parseInt(x, 16)));
}

// MD5 (RFC 1321). Not for security — only because people still need to compare MD5 sums.
function md5(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const words = new Uint32Array((((len + 8) >> 6) + 1) * 16);
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[words.length - 2] = len * 8;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < words.length; off += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c;
      c = b;
      const sum = (a + f + K[i] + words[off + g]) >>> 0;
      const s = S[(i >> 4) * 4 + (i % 4)];
      b = (b + ((sum << s) | (sum >>> (32 - s)))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map((n) => Array.from({ length: 4 }, (_, i) => ((n >>> (i * 8)) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

async function sha(algo: string, text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function mountJson(ctx: ToolCtx): void {
  let tab: 'json' | 'enc' = 'json';
  const content = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  const jsonArea = h('textarea', { class: 'ta tall', spellcheck: 'false', placeholder: '{"hello": "world"}' });
  const encIn = h('textarea', { class: 'ta', spellcheck: 'false', placeholder: tr('Текст', 'Text') });
  const encOut = h('textarea', { class: 'ta', spellcheck: 'false', readonly: true, placeholder: tr('Результат', 'Result') });
  const msg = h('p', { class: 'note', style: 'margin:0' });

  function json(op: 'format' | 'minify' | 'sort'): void {
    try {
      let v = JSON.parse(jsonArea.value);
      if (op === 'sort') v = sortKeys(v);
      jsonArea.value = op === 'minify' ? JSON.stringify(v) : JSON.stringify(v, null, 2);
      msg.textContent = tr('JSON правильный.', 'Valid JSON.');
    } catch (e) {
      msg.textContent = `${tr('Ошибка', 'Error')}: ${(e as Error).message}`;
    }
  }

  function enc(fn: (s: string) => string): void {
    try { encOut.value = fn(encIn.value); msg.textContent = ''; }
    catch { msg.textContent = tr('Не получилось: проверь входные данные.', 'Failed: check the input.'); }
  }

  async function hashes(): Promise<void> {
    const s = encIn.value;
    encOut.value = [`MD5     ${md5(s)}`, `SHA-1   ${await sha('SHA-1', s)}`, `SHA-256 ${await sha('SHA-256', s)}`, `SHA-512 ${await sha('SHA-512', s)}`].join('\n');
  }

  function render(): void {
    clear(content);
    msg.textContent = '';
    if (tab === 'json') {
      content.append(jsonArea, h('div', { class: 'btnrow' },
        button(tr('Красиво', 'Format'), () => json('format'), { primary: true }),
        button(tr('В строку', 'Minify'), () => json('minify')),
        button(tr('Сортировать ключи', 'Sort keys'), () => json('sort')),
        copyButton(() => jsonArea.value, t('copy'))));
    } else {
      const pair = (name: string, to: (s: string) => string, from: (s: string) => string) => h('div', { class: 'encrow' },
        h('span', null, name), button('→', () => enc(to)), button('←', () => enc(from)));
      content.append(encIn,
        h('div', { class: 'encgrid' },
          pair('Base64', b64encode, b64decode),
          pair('URL', encodeURIComponent, decodeURIComponent),
          pair('HTML', htmlEncode, htmlDecode),
          pair('Hex', hexEncode, hexDecode)),
        h('div', { class: 'btnrow' }, button(tr('Хэши', 'Hashes'), () => { hashes(); }), copyButton(() => encOut.value, t('copy'))),
        encOut,
        h('p', { class: 'note', style: 'margin:0' }, tr('→ закодировать, ← раскодировать.', '→ encode, ← decode.')));
    }
    content.append(msg);
  }

  // If the page itself is JSON, start with it.
  const pre = document.body?.children.length === 1 ? document.querySelector('body > pre') : null;
  if (pre && /^\s*[[{]/.test(pre.textContent ?? '')) jsonArea.value = pre.textContent ?? '';

  ctx.body.append(segmented<'json' | 'enc'>([['json', 'JSON'], ['enc', tr('Кодировщик', 'Encoder')]], tab, (v) => { tab = v; render(); }), content);
  render();
  if (jsonArea.value) json('format');
}
