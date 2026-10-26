# Kestrel Inspector

Free toolkit for web developers and designers, in a panel on any page: CSS inspector, color picker,
ruler, fonts, site stack, SEO & link preview, device view (phones, foldables, tablets), page editor,
dark mode, custom CSS/JS, outlines & grids, screenshots, page images, cookies, JSON & encoder.

- Works locally. No servers, no analytics, no tracking, no remote code.
- Minimal permissions: `activeTab`, `scripting`, `storage`. Cookies, downloads and per-site access
  are optional and requested only when a tool needs them.
- The packaged code is plain, unminified JavaScript compiled from the TypeScript in `src/`.

## Build

Requirements: Node.js 22 or newer, npm.

```sh
npm ci
npm run build
```

This compiles `src/` with the TypeScript compiler (no bundler, no minifier) and writes:

- `dist/firefox/` — the Firefox / Zen build (this is what is uploaded to addons.mozilla.org)
- `dist/chrome/` — the Chromium build

`scripts/build.mjs` only runs `tsc`, copies `assets/` and writes `manifest.json` for each browser.

## License

PolyForm Noncommercial 1.0.0 with an additional permission — see `LICENSE.md`.
Third-party material — see `THIRD_PARTY.md`.

Author: cipheroute
