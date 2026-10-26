// Extracts the current Windows arrow cursor (.cur) into a PNG + hotspot for the promo video.
// A .cur file is an ICO container: a directory of images, each PNG or BMP, with a hotspot per image.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function currentCursorPath(name = 'Arrow') {
  const out = execFileSync('reg', ['query', 'HKCU\\Control Panel\\Cursors', '/v', name], { encoding: 'utf8' });
  const m = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
  const path = m?.[1].trim().replace(/%SystemRoot%/i, process.env.SystemRoot ?? 'C:\\Windows');
  return path || join(process.env.SystemRoot ?? 'C:\\Windows', 'Cursors', 'aero_arrow.cur');
}

// Returns { png: Buffer, hotX, hotY, size } for the largest PNG image in the file.
export function readCursor(file) {
  const buf = readFileSync(file);
  if (buf.readUInt16LE(2) !== 2) throw new Error('not a .cur file');
  const count = buf.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    const size = buf[e] || 256;
    const hotX = buf.readUInt16LE(e + 4), hotY = buf.readUInt16LE(e + 6);
    const len = buf.readUInt32LE(e + 8), off = buf.readUInt32LE(e + 12);
    const data = buf.subarray(off, off + len);
    const isPng = data.subarray(0, 4).toString('hex') === '89504e47';
    if (isPng && (!best || size > best.size)) best = { png: data, hotX, hotY, size };
  }
  if (!best) throw new Error('cursor has no PNG images (BMP-only cursors are not supported yet)');
  return best;
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const dir = join(import.meta.dirname, 'work');
  mkdirSync(dir, { recursive: true });
  const path = currentCursorPath();
  const c = readCursor(path);
  writeFileSync(join(dir, 'cursor.png'), c.png);
  console.log(JSON.stringify({ path, size: c.size, hotX: c.hotX, hotY: c.hotY }));
}
