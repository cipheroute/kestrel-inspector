// Kestrel mark v3: bold filled construction on a 96 grid.
// The eye is variant 06's blade shape, the foot is built from thick rounded toes ending in tapered hooked claws.
import { writeFileSync } from 'node:fs';
const W = '#F4F4F4';
const r = (n) => Math.round(n * 100) / 100;
const P = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${r(p[0])} ${r(p[1])}`).join('');

// Tapered claw continuing a toe: starts at `at` heading `dir` (degrees), sweeps by `sweep` degrees.
function claw(at, dir, len, width, sweep) {
  const steps = 14, left = [], right = [];
  let [x, y] = at, a = (dir * Math.PI) / 180;
  const da = ((sweep * Math.PI) / 180) / steps, dl = len / steps;
  for (let i = 0; i <= steps; i++) {
    const w = (width / 2) * Math.pow(1 - i / steps, 0.85);
    const nx = -Math.sin(a), ny = Math.cos(a);
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
    x += Math.cos(a) * dl; y += Math.sin(a) * dl; a += da;
  }
  return `<path d="${P([...left, ...right.reverse()])}Z" fill="${W}"/>`;
}
const toe = (pts, w) => `<path d="${P(pts)}" fill="none" stroke="${W}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dirOf = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

const EYE = 'M4.5 18 44 27.3C37.8 35.9 22.3 39 12.8 33 8 30 5.7 24.8 4.5 18Z';
// Outline eye (shape 06) and a solid pupil pressed into the inner lower corner: looking down-right.
const eye = (tx, ty, k, stroke) => `<g transform="translate(${tx} ${ty}) scale(${k})"><path d="${EYE}" fill="none" stroke="${W}" stroke-width="${stroke / k}" stroke-linejoin="round" stroke-linecap="round"/><circle cx="35.4" cy="29.2" r="3.9" fill="${W}"/></g>`;

function foot(heel, toes, toeW, clawLen, clawW) {
  let out = '';
  for (const t of toes) {
    const pts = [heel, ...t.pts];
    out += toe(pts, toeW);
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    out += claw(b, dirOf(a, b), clawLen * (t.k ?? 1), clawW, t.sweep);
  }
  return out;
}
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="256" height="256">\n<rect width="96" height="96" fill="#000"/>\n${body}\n</svg>\n`;

const leg = (a, b, w) => toe([a, b], w);
const variants = {
  "a-strike": eye(6, 4, 1.4, 5) + leg([44, 57], [46, 67], 6.5) + foot([46, 67], [
    { pts: [[50, 79]], sweep: 70 },
    { pts: [[60, 78]], sweep: 75 },
    { pts: [[67, 70]], sweep: 80 },
    { pts: [[38, 75]], sweep: -70, k: 0.8 },
  ], 6, 12, 5.6),
  "b-grip": eye(6, 4, 1.4, 5) + leg([44, 57], [46, 66], 6.5) + foot([46, 66], [
    { pts: [[49, 76]], sweep: 95 },
    { pts: [[58, 76]], sweep: 100 },
    { pts: [[65, 69]], sweep: 105 },
    { pts: [[38, 73]], sweep: -95, k: 0.8 },
  ], 6.5, 14, 6.2),
  "c-reach": eye(4, 4, 1.4, 5) + leg([42, 56], [45, 65], 6.5) + foot([45, 65], [
    { pts: [[48, 80]], sweep: 40 },
    { pts: [[59, 80]], sweep: 45 },
    { pts: [[69, 72]], sweep: 50 },
  ], 6, 14, 6),
  // No leg: the foot grows straight out of the lower lid, like a hand under the eye.
  "d-hand": eye(6, 2, 1.4, 5) + foot([47, 58], [
    { pts: [[50, 71]], sweep: 85 },
    { pts: [[60, 71]], sweep: 90 },
    { pts: [[67, 63]], sweep: 95 },
    { pts: [[38, 67]], sweep: -85, k: 0.8 },
  ], 6.5, 15, 6.4),
};
for (const [name, body] of Object.entries(variants)) writeFileSync(`kestrel-${name}.svg`, svg(body));
console.log(Object.keys(variants).join(' '));
