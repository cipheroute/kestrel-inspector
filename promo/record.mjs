// Records a promo video of the extension, fully automatic and headless.
//   node promo/record.mjs            record + compose → promo/out/inspector-promo.mp4
//   node promo/record.mjs --lang=en  English interface
//
// 1. Makes a recording-only copy of the Chrome build (open shadow root so the script can find buttons,
//    access to all sites so the script can open the panel itself, PNG icons for Chromium).
// 2. Runs a scripted demo on a real site in headless Chromium, capturing frames via the DevTools screencast
//    and logging where the cursor is and where the "camera" should look.
// 3. Composes the final video: smooth zoom/pan to the action, a drawn cursor with click rings,
//    the page in a rounded frame on a dark backdrop. Encoded with ffmpeg.

import { chromium } from 'playwright';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const WORK = join(import.meta.dirname, 'work');
const OUT = join(import.meta.dirname, 'out');
const EXT = join(WORK, 'ext');
const FRAMES = join(WORK, 'frames');
const LANG = (process.argv.find((a) => a.startsWith('--lang=')) ?? '--lang=en').slice(7);
// Pace of the demo: every pause and cursor move is multiplied by this (1 = the original slow pace).
const PACE = Number(process.argv.find((a) => a.startsWith('--pace='))?.slice(7) ?? 0.55);
const URL = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? (LANG === 'ru' ? 'https://developer.mozilla.org/ru/' : 'https://developer.mozilla.org/en-US/');
const VW = 1440, VH = 900, DSF = 2;           // page viewport and pixel density of the capture
const OW = 1920, OH = 1080, FPS = 30;         // output video

const sleep = (ms) => new Promise((r) => setTimeout(r, ms * PACE));
const L = (ru, en) => (LANG === 'ru' ? ru : en);

// ---------- 1. recording copy of the extension ----------

async function prepareExtension(browser) {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  // Start from the always-fresh Firefox build and turn it into a Chromium one.
  cpSync(join(ROOT, 'dist', 'firefox'), EXT, { recursive: true });

  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const svg = readFileSync(join(ROOT, 'assets', 'icons', 'logo.svg'), 'utf8');
  for (const size of [16, 48, 128]) {
    await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await page.locator('svg').screenshot({ path: join(EXT, 'icons', `logo-${size}.png`), omitBackground: true });
  }
  await page.close();

  const mf = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
  mf.icons = { 16: 'icons/logo-16.png', 48: 'icons/logo-48.png', 128: 'icons/logo-128.png' };
  mf.action.default_icon = mf.icons;
  mf.host_permissions = ['<all_urls>'];
  delete mf.browser_specific_settings;
  mf.background = { service_worker: 'js/background.js' };
  mf.web_accessible_resources = [{ resources: ['fonts/*'], matches: ['<all_urls>'], use_dynamic_url: true }];
  writeFileSync(join(EXT, 'manifest.json'), JSON.stringify(mf, null, 2));

  const panelJs = join(EXT, 'js', 'content', 'panel.js');
  writeFileSync(panelJs, readFileSync(panelJs, 'utf8').replace("mode: 'closed'", "mode: 'open'"));
}

// ---------- 2. scripted demo ----------

const log = { start: 0, mouse: [], clicks: [], cam: [] };
let mouse = { x: VW * 0.5, y: VH * 0.62 };
const now = () => Date.now() - log.start;

function cam(z, cx = VW / 2, cy = VH / 2, dur = 750) {
  log.cam.push({ t: now(), z, cx, cy, dur });
}

async function moveTo(page, x, y, ms = 700) {
  const from = { ...mouse };
  ms *= PACE;
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // easeInOutCubic
    mouse = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
    await page.mouse.move(mouse.x, mouse.y);
    log.mouse.push({ t: now(), x: mouse.x, y: mouse.y });
    await new Promise((r) => setTimeout(r, 16));
  }
}

async function click(page) {
  log.clicks.push({ t: now(), x: mouse.x, y: mouse.y });
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, 70));
  await page.mouse.up();
}

async function drag(page, x, y, ms = 900) {
  log.clicks.push({ t: now(), x: mouse.x, y: mouse.y });
  await page.mouse.down();
  await moveTo(page, x, y, ms);
  await page.mouse.up();
}

const panel = (page) => page.locator('inspector-panel');

// Pick a real color: find an actual light-blue pixel of the first link under the headline, so the
// color picker clicks a letter stroke, not the gap. Done BEFORE recording: a clipped screenshot makes
// the browser briefly re-render the page zoomed in, and that frame must not end up in the video.
let pipetteTarget = null;
async function findLinkPixel(page) {
  const link = page.locator('h1').first().locator('xpath=following-sibling::*[1]').locator('a').first();
  const lr = await link.boundingBox().catch(() => null);
  if (!lr) return null;
  const png = (await page.screenshot({ clip: lr, scale: 'css' })).toString('base64');
  const hit = await page.evaluate(async ({ png, w, h }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let best = null;
    for (let y = 1; y < c.height - 1; y++) for (let x = 1; x < c.width - 1; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i + 2] > 200 && d[i] < 190 && d[i + 1] > 150) {
        const dist = Math.hypot(x - c.width * 0.3, y - c.height * 0.45);
        if (!best || dist < best.dist) best = { x, y, dist };
      }
    }
    return best && { x: (best.x * w) / c.width, y: (best.y * h) / c.height };
  }, { png, w: lr.width, h: lr.height });
  return hit ? { x: lr.x + hit.x, y: lr.y + hit.y } : null;
}

async function centerOf(locator) {
  const b = await locator.first().boundingBox();
  if (!b) throw new Error('element not found');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}

async function clickEl(page, locator, ms = 700) {
  const c = await centerOf(locator);
  await moveTo(page, c.x, c.y, ms);
  await sleep(120);
  await click(page);
  return c;
}

async function hover(page, locator, ms = 600) {
  const c = await centerOf(locator);
  await moveTo(page, c.x, c.y, ms);
  return c;
}

async function railButton(page, label) {
  return panel(page).locator(`.rail button[aria-label="${label}"]`);
}

async function scenario(page, sw) {
  const toggle = () => sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await togglePanel(tab.id); // global in background.js
  });

  cam(1);
  await sleep(1200);
  await moveTo(page, VW * 0.72, VH * 0.4, 900);
  await sleep(300);

  // Open the panel.
  await toggle();
  await sleep(900);
  cam(1.6, VW - 120, VH * 0.4);
  await sleep(500);
  for (const label of [L('Пипетка', 'Color Picker'), L('Линейка', 'Ruler'), L('Шрифты', 'Fonts')]) {
    await hover(page, await railButton(page, label), 450);
    await sleep(650);
  }

  // CSS inspector.
  cam(1);
  await clickEl(page, await railButton(page, L('CSS-инспектор', 'CSS Inspector')));
  await sleep(500);
  const h1 = page.locator('h1').first();
  const hc = await centerOf(h1);
  cam(1.35, hc.x + 180, hc.y + 120);
  await moveTo(page, hc.x - 120, hc.y, 900);
  await sleep(600);
  await moveTo(page, hc.x + 60, hc.y + 70, 700);
  await sleep(500);
  await moveTo(page, hc.x - 40, hc.y, 600);
  await click(page);
  await sleep(700);
  cam(1.5, VW - 330, VH * 0.45);
  await sleep(2200);

  // Color picker.
  cam(1);
  await clickEl(page, await railButton(page, L('Пипетка', 'Color Picker')));
  await sleep(1300);
  // The exact blue pixel was found before recording started (see findLinkPixel).
  const target = pipetteTarget ?? { x: hc.x + 30, y: hc.y + 4 };
  cam(1.45, target.x - 60, target.y);
  await moveTo(page, target.x - 220, target.y - 30, 900);
  await sleep(400);
  await moveTo(page, target.x, target.y, 900);
  await sleep(300);
  await click(page);
  await sleep(500);
  cam(1.5, VW - 330, VH * 0.3);
  await sleep(1800);

  // Ruler: snap on, two measurements.
  cam(1);
  await clickEl(page, await railButton(page, L('Линейка', 'Ruler')));
  await sleep(600);
  await clickEl(page, panel(page).locator('.win .switch'), 600);
  await sleep(400);
  // Measure the headline: its width (snapping to both edges), then the gap down to the next line.
  const r1 = await h1.boundingBox();
  const r2 = await h1.evaluate((el) => { const n = el.nextElementSibling; const b = n?.getBoundingClientRect(); return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null; });
  cam(1.35, r1.x + r1.width / 2, r1.y + r1.height / 2 + 40);
  await moveTo(page, r1.x - 5, r1.y + r1.height * 0.4, 800);
  await drag(page, r1.x + r1.width + 4, r1.y + r1.height * 0.4, 1100);
  await sleep(500);
  await clickEl(page, panel(page).locator('.win button', { hasText: L('Ещё замер', 'Add measure') }), 700);
  await sleep(300);
  const vx = r1.x + 90;
  await moveTo(page, vx, r1.y + r1.height + 4, 800);
  await drag(page, vx, (r2 ? r2.y : r1.y + r1.height + 60) - 4, 900);
  await sleep(500);
  cam(1.45, VW - 330, VH * 0.4);
  await sleep(1800);

  // Device view.
  cam(1);
  await clickEl(page, await railButton(page, L('Как на телефоне', 'Device View')));
  await sleep(1800);
  cam(1.15, VW * 0.45, VH * 0.5);
  await sleep(1200);
  await clickEl(page, panel(page).locator('.devlist button', { hasText: 'Galaxy Z TriFold' }).last(), 800);
  await sleep(1600);
  await clickEl(page, panel(page).locator('.otile').last(), 700);
  await sleep(1600);
  await clickEl(page, panel(page).locator('.devlist button', { hasText: 'iPhone 15' }).first(), 800);
  await sleep(1600);

  // Search: Ctrl+K, type a word, the list narrows down live — then close it and the panel.
  cam(1);
  await page.keyboard.press('Escape');
  await sleep(700);
  await page.keyboard.press('Control+K');
  await sleep(500);
  cam(1.6, VW - 330, 150);
  for (const ch of L('цвет', 'color')) { await page.keyboard.type(ch); await sleep(170); }
  await sleep(1300);
  await page.keyboard.press('Backspace'); await sleep(90);
  await page.keyboard.press('Backspace'); await sleep(90);
  await page.keyboard.press('Backspace'); await sleep(90);
  await page.keyboard.press('Backspace'); await sleep(90);
  await page.keyboard.press('Backspace'); await sleep(250);
  for (const ch of L('шрифт', 'font')) { await page.keyboard.type(ch); await sleep(170); }
  await sleep(1300);
  cam(1);
  await page.keyboard.press('Escape');
  await sleep(600);
  await toggle();      // the panel slides away
  await sleep(1600);
}

async function record() {
  const prep = await chromium.launch({ headless: true });
  await prepareExtension(prep);
  await prep.close();

  const ctx = await chromium.launchPersistentContext(join(WORK, 'profile'), {
    channel: 'chromium',
    headless: true,
    viewport: { width: VW, height: VH },
    deviceScaleFactor: DSF,
    locale: LANG === 'ru' ? 'ru-RU' : 'en-US',
    colorScheme: 'dark',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--lang=${LANG === 'ru' ? 'ru' : 'en-US'}`],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker');

  // Recording browser only: MDN sends "X-Frame-Options: DENY", which Chromium obeys even for frames an
  // extension creates (Firefox/Zen let them through). Drop it so the device view can show the site.
  await ctx.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    const headers = { ...res.headers() };
    delete headers['x-frame-options'];
    if (headers['content-security-policy']) headers['content-security-policy'] = headers['content-security-policy'].replace(/frame-ancestors[^;]*;?/i, '');
    await route.fulfill({ response: res, headers });
  });

  // No third-party ads in our video: hide MDN's ad placements in every page and frame, including
  // the copy of the site shown inside the device frame.
  await ctx.addInitScript(() => {
    const css = 'mdn-placement-top, mdn-placement-hp-main, mdn-placement-bottom, mdn-placement-sidebar, .page-layout__banner { display: none !important; }';
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.append(s); };
    if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
  });

  const page = ctx.pages()[0] ?? await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.bringToFront();
  await sleep(1500);
  pipetteTarget = await findLinkPixel(page);
  await sleep(300);

  const cdp = await ctx.newCDPSession(page);
  let frameNo = 0;
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(FRAMES, `${String(frameNo++).padStart(6, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ t: f.metadata.timestamp * 1000 - log.start, file });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  log.start = Date.now();
  await page.mouse.move(mouse.x, mouse.y);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VW * DSF, maxHeight: VH * DSF, everyNthFrame: 1 });

  try {
    await scenario(page, sw);
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {});
    log.end = now();
    await sleep(300);
    writeFileSync(join(WORK, 'timeline.json'), JSON.stringify({ ...log, frames }, null, 1));
    await ctx.close();
  }
  console.log(`recorded ${frames.length} frames, ${(log.end / 1000).toFixed(1)} s`);
}

// ---------- 3. compose ----------

const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

function cameraAt(t, cams) {
  let cur = { z: 1, cx: VW / 2, cy: VH / 2 };
  for (const c of cams) {
    if (c.t > t) break;
    const k = smooth((t - c.t) / c.dur);
    cur = { z: cur.z + (c.z - cur.z) * k, cx: cur.cx + (c.cx - cur.cx) * k, cy: cur.cy + (c.cy - cur.cy) * k };
  }
  return cur;
}

function mouseAt(t, samples) {
  let lo = 0, hi = samples.length - 1;
  if (!samples.length) return { x: VW / 2, y: VH / 2 };
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[hi].t) return samples[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].t <= t) lo = mid; else hi = mid; }
  const a = samples[lo], b = samples[hi], k = (t - a.t) / Math.max(1, b.t - a.t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

async function compose() {
  const tl = JSON.parse(readFileSync(join(WORK, 'timeline.json'), 'utf8'));
  const frames = tl.frames.filter((f) => f.t >= 0).sort((a, b) => a.t - b.t);
  const total = Math.floor((tl.end / 1000) * FPS);
  const OUTF = join(WORK, 'out');
  mkdirSync(OUTF, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: OW, height: OH }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:#0f1013"><canvas id="c" width="${OW}" height="${OH}"></canvas></body>`);
  // The user's own cursor: Bibata Modern Classic (black with a white outline), from its vector source.
  const cursorSvg = readFileSync(join(import.meta.dirname, 'assets', 'left_ptr.svg'), 'utf8').replaceAll('#00FF00', '#000000').replaceAll('#0000FF', '#FFFFFF');
  await page.evaluate(async (svg) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    window.cursorImg = img;
  }, cursorSvg);

  // Title card: the Kestrel logo and name on black, used at the start and at the end.
  const logoSvg = readFileSync(join(ROOT, 'assets', 'icons', 'logo.svg'), 'utf8');
  const fontB64 = readFileSync(join(ROOT, 'assets', 'fonts', 'Unbounded.ttf')).toString('base64');
  await page.evaluate(async ({ svg, font }) => {
    const face = new FontFace('Unbounded', `url(data:font/ttf;base64,${font})`, { weight: '200 900' });
    await face.load();
    document.fonts.add(face);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    window.logoImg = img;
  }, { svg: logoSvg, font: fontB64 });
  const card = (alpha) => page.evaluate(({ alpha, OW, OH }) => {
    const g = document.getElementById('c').getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, OW, OH);
    g.globalAlpha = alpha;
    const s = 340;
    g.drawImage(window.logoImg, (OW - s) / 2, OH / 2 - s + 40, s, s);
    g.font = '600 72px Unbounded';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#F4F4F4';
    g.fillText('Kestrel Inspector', OW / 2, OH / 2 + 150);
    g.globalAlpha = 1;
    return document.getElementById('c').toDataURL('image/jpeg', 0.93).split(',')[1];
  }, { alpha, OW, OH });

  let outN = 0;
  const put = (b64) => writeFileSync(join(OUTF, `${String(outN++).padStart(6, '0')}.jpg`), Buffer.from(b64, 'base64'));
  const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

  // Intro: logo and name fade in on black, hold, fade out.
  const INTRO = 2.8, IN = 0.6, OUTF_ = 0.7;
  for (let n = 0; n < INTRO * FPS; n++) {
    const s = n / FPS;
    put(await card(ease(s / IN) * (1 - ease((s - (INTRO - OUTF_)) / OUTF_))));
  }

  // Main part, fading up from black at the start and down to black at the end.
  const FADE_IN = 0.6, FADE_OUT = 0.8;
  const PAD = 56, FW = OW - PAD * 2, FH = Math.round(FW * (VH / VW));
  const FY = Math.round((OH - FH) / 2);
  let fi = 0;
  for (let n = 0; n < total; n++) {
    const t = (n / FPS) * 1000;
    const black = Math.max(1 - ease(t / 1000 / FADE_IN), ease((t / 1000 - (total / FPS - FADE_OUT)) / FADE_OUT));
    while (fi + 1 < frames.length && frames[fi + 1].t <= t) fi++;
    const c = cameraAt(t, tl.cam);
    const m = mouseAt(t, tl.mouse);
    const clicks = tl.clicks.filter((k) => t >= k.t && t - k.t < 450).map((k) => ({ x: k.x, y: k.y, p: (t - k.t) / 450 }));
    const img = readFileSync(frames[fi].file).toString('base64');
    const data = await page.evaluate(async ({ img, c, m, clicks, black, VW, VH, PAD, FW, FH, FY, OW, OH }) => {
      const cv = document.getElementById('c');
      const g = cv.getContext('2d');
      const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${img}`)).blob());
      g.fillStyle = '#0f1013';
      g.fillRect(0, 0, OW, OH);
      // visible part of the page in page coordinates
      const vw = VW / c.z, vh = VH / c.z;
      const sx = Math.min(VW - vw, Math.max(0, c.cx - vw / 2));
      const sy = Math.min(VH - vh, Math.max(0, c.cy - vh / 2));
      const kx = bmp.width / VW, ky = bmp.height / VH;
      g.save();
      g.shadowColor = 'rgba(0,0,0,.55)';
      g.shadowBlur = 50;
      g.shadowOffsetY = 18;
      g.beginPath();
      g.roundRect(PAD, FY, FW, FH, 18);
      g.fillStyle = '#000';
      g.fill();
      g.restore();
      g.save();
      g.beginPath();
      g.roundRect(PAD, FY, FW, FH, 18);
      g.clip();
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, sx * kx, sy * ky, vw * kx, vh * ky, PAD, FY, FW, FH);
      // cursor, mapped through the camera
      const s = FW / vw;
      const px = PAD + (m.x - sx) * s, py = FY + (m.y - sy) * s;
      for (const k of clicks) {
        const cx = PAD + (k.x - sx) * s, cy = FY + (k.y - sy) * s;
        g.beginPath();
        g.arc(cx, cy, 10 + 26 * k.p, 0, Math.PI * 2);
        g.strokeStyle = `rgba(147,168,255,${0.9 * (1 - k.p)})`;
        g.lineWidth = 3;
        g.stroke();
      }
      // Cursor: 256-unit artwork with its hotspot at (55, 17); grows a little with the zoom.
      const size = 40 * (1 + (c.z - 1) * 0.45);
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
      g.drawImage(window.cursorImg, px - (55 / 256) * size, py - (17 / 256) * size, size, size);
      g.restore();
      if (black > 0) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, OW, OH); }
      bmp.close();
      return cv.toDataURL('image/jpeg', 0.93).split(',')[1];
    }, { img, c, m, clicks, black, VW, VH, PAD, FW, FH, FY, OW, OH });
    put(data);
    if (n % 150 === 0) console.log(`composed ${n}/${total}`);
  }

  // Outro: logo and name fade in on black and stay.
  const OUTRO = 3.2;
  for (let n = 0; n < OUTRO * FPS; n++) put(await card(ease((n / FPS) / 0.8)));
  await browser.close();

  const file = join(OUT, `kestrel-promo-${LANG}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(OUTF, '%06d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: 'inherit' });
  console.log(`done: ${file}`);
}

if (!process.argv.includes('--compose-only')) await record();
await compose();
