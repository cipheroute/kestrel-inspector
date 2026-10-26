// Kestrel mark v5: our hunting eye (shape 06, pupil down-right) + a professionally drawn hand from
// Phosphor Icons (MIT, (c) 2023 Phosphor Icons) — the hand is not drawn by us.
import { readFileSync, writeFileSync } from 'node:fs';
const W = '#F4F4F4';
const inner = (f) => readFileSync(`src/${f}.svg`, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="[^"]*"/g, '');
const EYE = 'M4.5 18 44 27.3C37.8 35.9 22.3 39 12.8 33 8 30 5.7 24.8 4.5 18Z';
const eye = (tx, ty, k, stroke) => `<g transform="translate(${tx} ${ty}) scale(${k})"><path d="${EYE}" fill="none" stroke="${W}" stroke-width="${stroke / k}" stroke-linejoin="round" stroke-linecap="round"/><circle cx="35.4" cy="29.2" r="3.9" fill="${W}"/></g>`;
// Phosphor icons live in a 256 box; place one with its centre at (cx, cy), size in our units, rotation in degrees.
const hand = (file, cx, cy, size, rot = 0) => `<g fill="${W}" transform="translate(${cx} ${cy}) rotate(${rot}) scale(${size / 256}) translate(-128 -128)">${inner(file)}</g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="256" height="256">\n<rect width="96" height="96" fill="#000"/>\n${body}\n</svg>\n`;

const variants = {
  'grab-fill': eye(6, 2, 1.4, 5) + hand('hand-grabbing-fill', 54, 72, 44, -12),
  'grab-bold': eye(6, 2, 1.4, 5) + hand('hand-grabbing-bold', 54, 72, 44, -12),
  'grab-fill-big': eye(10, -2, 1.25, 4.6) + hand('hand-grabbing-fill', 56, 70, 52, -18),
  'open-fill': eye(6, 2, 1.4, 5) + hand('hand-fill', 56, 72, 44, 20),
};
for (const [name, body] of Object.entries(variants)) writeFileSync(`kestrel-${name}.svg`, svg(body));
console.log(Object.keys(variants).join(' '));
