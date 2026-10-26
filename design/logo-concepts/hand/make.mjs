// Kestrel logo drafts: blade eye (shape 06) looking down-right, a talon below it grabbing.
import { writeFileSync } from 'node:fs';
const INK = '#F2F2F2';
const r2 = (n) => Math.round(n * 100) / 100;
const s = (d, w = 3) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const f = (d) => `<path d="${d}" fill="${INK}"/>`;
const C = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

// A tapered, curved talon from a base point to a sharp tip. bend > 0 curves it clockwise.
function talon(bx, by, tx, ty, width, bend) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;            // normal
  const mx = bx + dx * 0.5 + nx * bend * len, my = by + dy * 0.5 + ny * bend * len;
  const w = width / 2;
  const a = [bx + nx * w, by + ny * w], b = [bx - nx * w, by - ny * w];
  const c1 = [mx + nx * w * 0.9, my + ny * w * 0.9], c2 = [mx - nx * w * 0.5, my - ny * w * 0.5];
  return `M${r2(a[0])} ${r2(a[1])}Q${r2(c1[0])} ${r2(c1[1])} ${r2(tx)} ${r2(ty)}Q${r2(c2[0])} ${r2(c2[1])} ${r2(b[0])} ${r2(b[1])}Z`;
}

const EYE = 'M4.5 18 44 27.3C37.8 35.9 22.3 39 12.8 33 8 30 5.7 24.8 4.5 18Z';
const eye = (px = 35.2, py = 29.4, pr = 3.7) => `<g transform="translate(1 0)">${s(EYE, 3)}${f(C(px, py, pr))}</g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">\n<rect width="64" height="64" fill="#000"/>\n${body}\n</svg>\n`;

const variants = {
  // Three talons fanned out from under the eye towards the lower right, hooks curling down.
  "fan-strike": eye() +
    f(talon(30, 40.5, 38, 57, 4.2, 0.22)) +
    f(talon(36.5, 40, 49, 54.5, 4.2, 0.24)) +
    f(talon(42.5, 37.5, 58, 47.5, 4, 0.26)),
  // Same, with a back talon (like a real bird foot) for a grip.
  "grip": eye() +
    f(talon(30, 40.5, 38, 57, 4.2, 0.22)) +
    f(talon(36.5, 40, 49, 54.5, 4.2, 0.24)) +
    f(talon(42.5, 37.5, 58, 47.5, 4, 0.26)) +
    f(talon(28.5, 41, 21, 52, 3.4, -0.25)),
  // Two big curved talons, like a hand closing from both sides on a point lower right.
  "pinch": eye() +
    f(talon(30, 40.5, 47, 59, 4.6, 0.3)) +
    f(talon(44, 36.5, 56, 55, 4.2, -0.22)),
};
for (const [name, body] of Object.entries(variants)) writeFileSync(`kestrel-${name}.svg`, svg(body));
console.log(Object.keys(variants).join(' '));
