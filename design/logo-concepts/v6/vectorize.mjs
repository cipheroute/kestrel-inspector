// Turns the generated raster logo into clean single-colour SVGs with potrace.
// src-0 = original line weight, src-4/src-8 = lines thickened (ffmpeg dilation) for small icon sizes.
// The viewBox is cropped to the drawing plus a margin, so the mark fills the icon.
import potrace from 'potrace';
import { writeFileSync } from 'node:fs';

const trace = (file) => new Promise((res, rej) => potrace.trace(file, { threshold: 128, blackOnWhite: false, turdSize: 60, optTolerance: 0.4, color: '#F4F4F4' }, (e, s) => (e ? rej(e) : res(s))));
// Content box of the drawing in the 1254 source (measured from the image), plus margin.
const box = { x: 250, y: 200, w: 760, h: 830 };
const m = 50;
const side = Math.max(box.w, box.h) + m * 2;
const vx = box.x + box.w / 2 - side / 2, vy = box.y + box.h / 2 - side / 2;
for (const [src, out] of [['src-0.png', 'kestrel-logo.svg'], ['src-4.png', 'kestrel-icon-32.svg'], ['src-8.png', 'kestrel-icon-16.svg']]) {
  const raw = await trace(src);
  const d = [...raw.matchAll(/ d="([^"]+)"/g)].map((x) => x[1]).join(' ');
  writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${side} ${side}" width="256" height="256">\n<rect x="${vx}" y="${vy}" width="${side}" height="${side}" fill="#000"/>\n<path d="${d}" fill="#F4F4F4" fill-rule="evenodd"/>\n</svg>\n`);
  console.log(out, d.length);
}
