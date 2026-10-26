// Kestrel mark v4: hunting eye (shape 06, pupil down-right) + a human hand below it, fingers hooked to grab.
// Fingers are thick rounded strokes; each gets a black halo first so neighbours stay separated (icon technique).
import { writeFileSync } from 'node:fs';
const W = '#F4F4F4', B = '#000';
const r = (n) => Math.round(n * 100) / 100;
const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${r(p[0])} ${r(p[1])}`).join('');
const seg = (pts, w, color) => `<path d="${pathOf(pts)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const limb = (pts, w, halo = 3) => seg(pts, w + halo * 2, B) + seg(pts, w, W);
const EYE = 'M4.5 18 44 27.3C37.8 35.9 22.3 39 12.8 33 8 30 5.7 24.8 4.5 18Z';
const eye = (tx, ty, k, stroke) => `<g transform="translate(${tx} ${ty}) scale(${k})"><path d="${EYE}" fill="none" stroke="${W}" stroke-width="${stroke / k}" stroke-linejoin="round" stroke-linecap="round"/><circle cx="35.4" cy="29.2" r="3.9" fill="${W}"/></g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="256" height="256">\n<rect width="96" height="96" fill="#000"/>\n${body}\n</svg>\n`;

// Hand built from a palm blob + fingers. `fingers`: arrays of points from knuckle to tip (back to front order).
function hand({ wrist, palm, palmR, fingers, thumb, fw, tw }) {
  let s = seg(wrist, palmR * 1.25, W) + `<circle cx="${palm[0]}" cy="${palm[1]}" r="${palmR}" fill="${W}"/>`;
  for (const f of fingers) s += limb(f, fw);
  if (thumb) s += limb(thumb, tw);
  return s;
}

const variants = {
  // Open hand reaching right: fingers spread with slightly hooked tips, thumb opposite — an open "C" about to grab.
  "reach-open": eye(6, -1, 1.4, 5) + hand({
    wrist: [[18, 101], [34, 83]], palm: [39, 78], palmR: 8,
    fingers: [
      [[44, 72], [56, 62], [65, 62]],
      [[46, 75], [60, 70], [69, 72]],
      [[46, 79], [59, 78], [66, 82]],
    ],
    thumb: [[37, 83], [47, 91], [57, 89], [61, 85]], fw: 5.6, tw: 6,
  }),
  // Four fingers, more spread, claw-like tips.
  "reach-claw": eye(6, 0, 1.4, 5) + hand({
    wrist: [[16, 99], [33, 80]], palm: [38, 75], palmR: 8,
    fingers: [
      [[42, 68], [52, 56], [61, 54], [65, 58]],
      [[45, 70], [58, 62], [67, 63], [70, 68]],
      [[46, 74], [60, 71], [68, 74], [70, 79]],
      [[45, 78], [56, 80], [62, 84]],
    ],
    thumb: [[36, 81], [44, 90], [55, 91]], fw: 5.2, tw: 5.8,
  }),
};
for (const [name, body] of Object.entries(variants)) writeFileSync(`kestrel-${name}.svg`, svg(body));
console.log(Object.keys(variants).join(' '));
