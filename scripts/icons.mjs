// Renders assets/icons/logo.svg into the PNG sizes browsers and stores need.
//   node scripts/icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'assets', 'icons', 'logo.svg'), 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 96, 128]) {
  await page.setContent(`<body style="margin:0">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body>`);
  await page.locator('svg').screenshot({ path: join(root, 'assets', 'icons', `logo-${size}.png`), omitBackground: true });
}
await browser.close();
console.log('icons written');
