// Build: TypeScript → plain readable JS (no bundling, no minification), then copy assets
// and write a manifest for each browser into dist/<browser>/.
//   node scripts/build.mjs           build once
//   node scripts/build.mjs --watch   rebuild on change (used by `npm run dev`)

import { execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, watch } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const watchMode = process.argv.includes('--watch');

function copyStatic() {
  const ff = join(dist, 'firefox');
  mkdirSync(ff, { recursive: true });
  cpSync(join(root, 'assets'), ff, { recursive: true });
  for (const f of ['LICENSE.md', 'THIRD_PARTY.md']) {
    try { cpSync(join(root, f), join(ff, f)); } catch { /* optional */ }
  }
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  writeFileSync(join(ff, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function makeChrome() {
  const ff = join(dist, 'firefox');
  const cr = join(dist, 'chrome');
  rmSync(cr, { recursive: true, force: true });
  cpSync(ff, cr, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  delete manifest.browser_specific_settings;
  manifest.background = { service_worker: 'js/background.js' };
  manifest.web_accessible_resources = [{ resources: ['fonts/*'], matches: ['<all_urls>'], use_dynamic_url: true }];
  writeFileSync(join(cr, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

if (watchMode) {
  copyStatic();
  const tsc = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], { cwd: root, stdio: 'inherit', shell: true });
  watch(join(root, 'assets'), { recursive: true }, () => copyStatic());
  watch(join(root, 'manifest.json'), () => copyStatic());
  process.on('SIGINT', () => { tsc.kill(); process.exit(0); });
} else {
  rmSync(dist, { recursive: true, force: true });
  execSync('npx tsc', { cwd: root, stdio: 'inherit' });
  copyStatic();
  makeChrome();
  console.log('Built dist/firefox and dist/chrome');
}
