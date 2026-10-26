// All panel styles live inside a closed shadow root, so the page cannot restyle the panel
// and the panel cannot leak styles into the page.

const PANEL_CSS = `
:host { all: initial; }
.root {
  --display: "InspectorDisplay", "Segoe UI Variable Display", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif;
  --ui: "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif;
  --mono: ui-monospace, "Cascadia Code", Consolas, "SF Mono", Menlo, monospace;
  --ease: cubic-bezier(.2,.8,.2,1);
  position: fixed; inset: 0; pointer-events: none;
  font-family: var(--ui); font-size: 13px; line-height: 1.45; color: var(--text);
  -webkit-font-smoothing: antialiased; text-align: left; letter-spacing: normal;
}
.root[data-theme="dark"] {
  --s1:#1E1F23; --s2:#25262B; --s2h:#2A2B31; --s3:#2F3036; --s4:#383A41;
  --line:rgba(255,255,255,.08); --line2:rgba(255,255,255,.22);
  --text:#ECEDF0; --muted:#A3A6AF; --faint:#6E717A;
  --accent:#93A8FF; --accentSoft:rgba(147,168,255,.14); --accentInk:#111526;
  --tipBg:#ECEDF0; --tipText:#17181C; --tipMuted:#5B5F69;
  --ok:#5FD39A; --okSoft:rgba(95,211,154,.10);
  --shadow:0 10px 30px rgba(0,0,0,.35); --shadowLg:0 18px 50px rgba(0,0,0,.45); --shadowXl:0 28px 70px rgba(0,0,0,.55);
  color-scheme: dark;
}
.root[data-theme="light"] {
  --s1:#F4F5F7; --s2:#FFFFFF; --s2h:#F7F8FA; --s3:#ECEEF2; --s4:#E2E5EA;
  --line:rgba(16,18,24,.10); --line2:rgba(16,18,24,.28);
  --text:#16171B; --muted:#585C66; --faint:#9A9EA8;
  --accent:#3B5BDB; --accentSoft:rgba(59,91,219,.10); --accentInk:#FFFFFF;
  --tipBg:#1E1F23; --tipText:#ECEDF0; --tipMuted:#A3A6AF;
  --ok:#1E8A52; --okSoft:rgba(30,138,82,.09);
  --shadow:0 10px 30px rgba(20,24,40,.12); --shadowLg:0 18px 50px rgba(20,24,40,.16); --shadowXl:0 28px 70px rgba(20,24,40,.24);
  color-scheme: light;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; }
p { margin: 0; }
.ic { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex: none; transition: transform .18s var(--ease); }
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes fadeOut { to { opacity: 0 } }
@keyframes winOut { to { opacity: 0; transform: translateX(14px) scale(.98) } }
@keyframes devIn { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: none } }
@keyframes devOut { to { opacity: 0; transform: scale(.96) } }
.win.leaving { animation: winOut .2s var(--ease) forwards; pointer-events: none; }
.capture.leaving, .stage.leaving { animation: fadeOut .2s ease-in forwards; pointer-events: none; }
.stage.leaving .devshell, .stage.leaving .shotwrap { animation: devOut .2s ease-in forwards; }
@keyframes winIn { from { opacity: 0; transform: translateX(14px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes tipIn { from { opacity: 0; transform: translate(6px,-50%) } to { opacity: 1; transform: translate(0,-50%) } }
@keyframes tipInR { from { opacity: 0; transform: translate(-6px,-50%) } to { opacity: 1; transform: translate(0,-50%) } }

/* rail */
.rail {
  position: fixed; z-index: 3; top: 12px; right: 12px; width: 56px; height: calc(100vh - 24px);
  background: var(--s1); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; align-items: center; padding: 8px 0; overflow: hidden;
  pointer-events: auto;
  transition: width .3s var(--ease), height .3s var(--ease), transform .34s var(--ease), opacity .22s, left .3s var(--ease), top .3s var(--ease);
}
.rail.hidden { transform: translateX(calc(100% + 24px)); opacity: 0; pointer-events: none; }
.rail.left.hidden { transform: translateX(calc(-100% - 24px)); }
.rail.free { right: auto; }
.rail.moving { transition: width .3s var(--ease), height .3s var(--ease), opacity .22s; }
.rgrip { width: 40px; height: 24px; border: 0; border-radius: 8px; background: transparent; color: var(--faint); display: grid; place-items: center; cursor: grab; flex: none; padding: 0; touch-action: none; transition: background .15s, color .15s; }
.rgrip:hover { background: var(--s3); color: var(--text); }
.rail.moving .rgrip { cursor: grabbing; color: var(--accent); background: var(--accentSoft); }
.rgrip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rail.wide { width: 300px; }
.logo { width: 40px; height: 40px; display: grid; place-items: center; color: var(--text); flex: none; }
.rbtn {
  position: relative; width: 40px; height: 40px; border: 0; border-radius: 11px; background: transparent;
  color: var(--muted); display: grid; place-items: center; cursor: pointer; flex: none; padding: 0;
  transition: background .15s, color .15s, transform .12s;
}
.rbtn:hover { background: var(--s3); color: var(--text); }
.rbtn:hover .ic { transform: scale(1.1); }
.rbtn:active { transform: scale(.92); }
.rbtn.on { background: var(--accentSoft); color: var(--accent); }
.rbtn.on::before { content: ""; position: absolute; left: -8px; top: 11px; bottom: 11px; width: 3px; border-radius: 3px; background: var(--accent); animation: fade .2s ease-out; }
.rbtn:focus-visible, .wbtn:focus-visible, .trow:focus-visible, .star:focus-visible, .palrow:focus-visible, .seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.langchip { font-family: var(--display); font-size: 11px; font-weight: 600; letter-spacing: .02em; }
.okdot { position: absolute; right: 8px; top: 8px; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 2px var(--s1); }
.sep { width: 24px; height: 1px; background: var(--line); margin: 6px 0; flex: none; }
.favs { flex: 1 1 auto; min-height: 0; width: 100%; overflow-y: auto; scrollbar-width: none; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 2px 0; }
.favs::-webkit-scrollbar { display: none; }
.narrow { display: flex; flex-direction: column; align-items: center; width: 100%; flex: 1 1 auto; min-height: 0; }
.wide-list { width: 100%; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; animation: fade .25s .08s ease-out both; }
.whd { display: flex; align-items: center; gap: 8px; padding: 0 8px 0 14px; height: 44px; flex: none; }
.whd b { flex: 1; font-family: var(--display); font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
.wlist { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; padding: 0 8px 8px; }
.glbl { font-size: 12px; color: var(--muted); padding: 14px 8px 6px; }
.titem { display: flex; align-items: center; gap: 4px; border-radius: 10px; transition: background .15s; }
.titem:hover { background: var(--s3); }
.trow { flex: 1; display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 8px; border: 0; background: transparent; font-size: 13px; text-align: left; cursor: pointer; border-radius: 10px; min-width: 0; color: var(--text); }
.trow .ic { color: var(--muted); }
.titem:hover .trow .ic { color: var(--text); }
.star { width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--faint); display: grid; place-items: center; cursor: pointer; padding: 0; transition: color .15s, transform .15s; }
.star:hover { color: var(--text); }
.star:active { transform: scale(.85); }
.star.on { color: #F2B544; }
.star.on .ic { fill: #F2B544; }

/* tooltip */
.tip {
  position: fixed; z-index: 6; transform: translateY(-50%);
  background: var(--tipBg); color: var(--tipText); font-size: 12px; font-weight: 500; padding: 7px 9px; border-radius: 8px;
  display: flex; gap: 10px; align-items: center; white-space: nowrap; pointer-events: none;
  box-shadow: 0 6px 18px rgba(0,0,0,.25); animation: tipIn .16s .22s var(--ease) both;
}
.tip.right { animation-name: tipInR; }
.tipk { font-family: var(--mono); font-size: 11px; color: var(--tipMuted); }

/* tool window */
.win {
  position: fixed; z-index: 4; width: 360px; min-width: 260px; min-height: 180px; display: flex; flex-direction: column;
  background: var(--s2); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadowLg);
  pointer-events: auto; animation: winIn .24s var(--ease);
  transition: left .3s var(--ease), top .3s var(--ease), box-shadow .2s;
}
.win.drag { box-shadow: var(--shadowXl); transition: box-shadow .2s; }
.win.sizing { transition: none; user-select: none; }
.rsz { position: absolute; bottom: 3px; right: 3px; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; color: var(--faint); cursor: nwse-resize; touch-action: none; transition: color .15s, background .15s; z-index: 1; }
.win.docked .rsz { right: auto; left: 3px; cursor: nesw-resize; }
.rsz .rl { display: none; }
.win.docked .rsz .rl { display: block; }
.win.docked .rsz .rr { display: none; }
.win:hover .rsz { color: var(--muted); }
.rsz:hover, .win.sizing .rsz { color: var(--accent); background: var(--accentSoft); }
.whead { display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 8px 0 6px; border-bottom: 1px solid var(--line); cursor: grab; user-select: none; touch-action: none; border-radius: 14px 14px 0 0; transition: background .15s; flex: none; }
.whead:hover { background: var(--s2h); }
.win.drag .whead { cursor: grabbing; }
.grip { color: var(--faint); transition: color .15s; }
.whead:hover .grip { color: var(--muted); }
.wicon { color: var(--accent); display: grid; place-items: center; }
.wtitle { flex: 1; font-family: var(--display); font-weight: 600; font-size: 14px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbtn { width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer; flex: none; padding: 0; transition: background .15s, color .15s; }
.wbtn:hover { background: var(--s3); color: var(--text); }
.wbody { flex: 1 1 auto; overflow-y: auto; padding: 14px 14px 26px; display: flex; flex-direction: column; gap: 16px; scrollbar-width: thin; min-height: 0; }
.ghost { position: fixed; z-index: 3; width: 360px; height: 220px; border: 1.5px dashed var(--line2); border-radius: 14px; transition: border-color .15s, background .15s; animation: fade .15s ease-out; }
.ghost.near { border-color: var(--accent); background: var(--accentSoft); }

/* window content */
.lbl { font-size: 13px; font-weight: 600; color: var(--text); margin: 0 0 8px; }
.muted { color: var(--muted); }
.note { font-size: 12px; color: var(--muted); margin-top: 8px; }
.crumb { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-family: var(--mono); font-size: 12px; color: var(--muted); word-break: break-all; }
.crumb b { color: var(--text); font-weight: 600; }
.bm { border: 1px dashed rgba(246,178,107,.7); background: rgba(246,178,107,.10); border-radius: 8px; padding: 8px 10px; text-align: center; font-family: var(--mono); font-size: 11px; color: var(--muted); }
.bm .p { border: 1px dashed rgba(147,196,125,.7); background: rgba(147,196,125,.10); border-radius: 6px; padding: 8px 10px; margin-top: 4px; }
.bm .c { background: rgba(111,168,220,.22); border: 1px solid rgba(111,168,220,.6); border-radius: 4px; padding: 8px; margin-top: 4px; color: var(--text); }
.plist { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.prow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; font-family: var(--mono); font-size: 12px; }
.prow + .prow { border-top: 1px solid var(--line); }
.pk { color: var(--muted); flex: none; }
.pv { display: flex; align-items: center; gap: 6px; min-width: 0; }
.pv span[contenteditable] { outline: none; border-radius: 4px; padding: 1px 4px; margin: -1px -4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text; }
.pv span[contenteditable]:hover { background: var(--s3); }
.pv span[contenteditable]:focus { background: var(--s3); box-shadow: 0 0 0 1.5px var(--accent); white-space: normal; }
.sw { width: 12px; height: 12px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(128,128,128,.35); flex: none; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--line); background: var(--s3); font-size: 13px; cursor: pointer; transition: background .15s, transform .12s; }
.btn:hover { background: var(--s4); }
.btn:active { transform: scale(.97); }
.big { display: flex; gap: 12px; align-items: center; }
.bigsw { width: 64px; height: 64px; border-radius: 14px; box-shadow: inset 0 0 0 1px rgba(128,128,128,.3); flex: none; }
.fmeta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fmeta b { font-weight: 600; }
.fmeta span { font-size: 12px; color: var(--muted); }
.fmt { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 34px; padding: 0 2px 0 10px; border-radius: 9px; background: var(--s3); font-family: var(--mono); font-size: 12px; }
.swrow { display: flex; gap: 8px; flex-wrap: wrap; }
.swb { width: 30px; height: 30px; border-radius: 8px; border: 0; cursor: pointer; padding: 0; box-shadow: inset 0 0 0 1px rgba(128,128,128,.3); transition: transform .15s; }
.swb:hover { transform: translateY(-2px); }
.frow { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; background: var(--s3); border: 1px solid transparent; cursor: pointer; text-align: left; width: 100%; transition: border-color .15s; }
.frow:hover { border-color: var(--line2); }
.frow.on { border-color: var(--accent); }
.fs { width: 44px; height: 44px; border-radius: 10px; background: var(--s2); display: grid; place-items: center; font-size: 20px; flex: none; overflow: hidden; }
.seg { display: flex; background: var(--s3); border-radius: 10px; padding: 3px; gap: 2px; }
.seg button { flex: 1; border: 0; background: transparent; color: var(--muted); height: 30px; border-radius: 8px; font-size: 12.5px; cursor: pointer; transition: background .15s, color .15s; }
.seg button:hover { color: var(--text); }
.seg button.on { background: var(--s2); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.hkrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; }
.hkrow + .hkrow { border-top: 1px solid var(--line); }
.keys { display: inline-flex; gap: 4px; align-items: center; }
.k { display: inline-flex; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 6px; background: var(--s3); border: 1px solid var(--line); border-bottom-width: 2px; font-family: var(--mono); font-size: 11px; align-items: center; justify-content: center; color: var(--text); }
.addrbox { display: flex; align-items: center; gap: 8px; padding: 8px 4px 8px 10px; border-radius: 10px; background: var(--s3); font-family: var(--mono); font-size: 11.5px; word-break: break-all; }
.netok { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; background: var(--okSoft); }
.netok .ic { color: var(--ok); }
.netok b { display: block; font-weight: 600; }
.netok span { font-size: 12px; color: var(--muted); }
.perm { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; }
.perm + .perm { border-top: 1px solid var(--line); }
.perm span { color: var(--muted); font-size: 12px; text-align: right; }
.empty { padding: 16px; border: 1px dashed var(--line2); border-radius: 10px; color: var(--muted); text-align: center; font-size: 12px; }
.kv { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 9px; background: var(--s3); }
.kv span { color: var(--muted); }
.kv b { font-weight: 600; font-family: var(--mono); font-size: 12px; }

.btn.primary { background: var(--accent); color: var(--accentInk); border-color: transparent; font-weight: 600; }
.btn.primary:hover { filter: brightness(1.08); background: var(--accent); }
.btn:disabled { opacity: .45; cursor: default; }
.btnrow { display: flex; flex-wrap: wrap; gap: 6px; }
.btnrow .btn { flex: 1 1 auto; }
.linkbtn { border: 0; background: none; color: var(--accent); cursor: pointer; padding: 0; font-size: 12px; }
.linkbtn:hover { text-decoration: underline; }
.switch { position: relative; width: 38px; height: 22px; border-radius: 999px; border: 0; padding: 0; background: var(--s4); cursor: pointer; flex: none; transition: background .2s; }
.switch span { position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); transition: transform .22s var(--ease); }
.switch.on { background: var(--accent); }
.switch.on span { transform: translateX(16px); }
.switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.swrow2 { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--s3); }
.autobox { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; border: 1px dashed var(--line2); }
.warn { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: rgba(255,107,61,.10); border: 1px solid rgba(255,107,61,.45); }
.warn span { color: var(--text); font-size: 12.5px; }
.ta { width: 100%; min-height: 140px; resize: vertical; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--s3); color: var(--text); font: 12px/1.5 var(--mono); outline: none; tab-size: 2; }
.ta.tall { min-height: 260px; }
.ta:focus, .inp:focus { border-color: var(--accent); }
.inp { width: 100%; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--s3); color: var(--text); font: inherit; outline: none; }
.encgrid { display: flex; flex-direction: column; gap: 6px; }
.encrow { display: grid; grid-template-columns: 1fr 52px 52px; gap: 6px; align-items: center; }
.encrow span { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: none; margin-top: 6px; }
.dot.ok { background: var(--ok); } .dot.warn { background: #F2B544; } .dot.bad { background: #FF6B6B; }
.seorow { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; }
.seorow + .seorow { border-top: 1px solid var(--line); }
.preview { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--s3); }
.preview img { display: block; width: 100%; aspect-ratio: 1.91 / 1; object-fit: cover; background: var(--s4); }
.preview .noimg { aspect-ratio: 1.91 / 1; display: grid; place-items: center; color: var(--muted); font-size: 12px; background: var(--s4); }
.pv-body { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; }
.pv-body span { color: var(--muted); font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pv-host { text-transform: lowercase; }
.outline { display: flex; flex-direction: column; margin-top: 8px; max-height: 220px; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; }
.oitem { display: flex; gap: 8px; align-items: baseline; border: 0; background: none; color: var(--text); text-align: left; padding: 5px 8px; font-size: 12.5px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oitem:hover { background: var(--s3); }
.thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.thumb { border-radius: 10px; overflow: hidden; background: var(--s3); border: 1px solid var(--line); display: flex; flex-direction: column; }
.thumb img { width: 100%; aspect-ratio: 1; object-fit: contain; cursor: zoom-in; background: repeating-conic-gradient(rgba(128,128,128,.18) 0 25%, transparent 0 50%) 0 0 / 12px 12px; }
.tmeta { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 2px 2px 2px 8px; font: 11px var(--mono); color: var(--muted); }
.tacts { display: flex; }
.tacts .wbtn { width: 26px; height: 26px; }
.cklist { display: flex; flex-direction: column; gap: 6px; }
.ckrow { display: flex; flex-direction: column; gap: 2px; padding: 8px 6px 8px 10px; border-radius: 10px; background: var(--s3); }
.ckhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ckhead b { font: 600 12px var(--mono); word-break: break-all; }
.ckval { font: 12px var(--mono); color: var(--muted); word-break: break-all; outline: none; border-radius: 4px; padding: 1px 4px; margin: 0 -4px; }
.ckval:focus { color: var(--text); box-shadow: 0 0 0 1.5px var(--accent); }
.ckflags { font-size: 11px; color: var(--faint); }
.devlist { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; padding: 4px; }
.stage { position: fixed; inset: 0; z-index: 2; pointer-events: auto; background: rgba(10,11,14,.72); display: flex; align-items: center; justify-content: center; animation: fade .2s ease-out; }
.devshell { position: relative; flex: none; animation: devIn .3s var(--ease); }
.devscreen { position: absolute; left: 0; top: 0; transform-origin: 0 0; border-radius: 22px; overflow: hidden; background: #16171a; box-shadow: 0 0 0 10px #0d0e11, 0 0 0 11px rgba(255,255,255,.12), 0 30px 80px rgba(0,0,0,.6); }
.orient { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.otile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; border-radius: 12px; border: 1.5px solid transparent; background: var(--s3); color: var(--muted); cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
.otile:hover { color: var(--text); border-color: var(--line2); }
.otile.on { color: var(--accent); border-color: var(--accent); background: var(--accentSoft); }
.otile b { font-weight: 600; color: var(--text); }
.otile small { font: 11px var(--mono); color: var(--muted); }
.otile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.oframe { width: 52px; height: 52px; display: grid; place-items: center; }
.silh { position: relative; border: 2px solid currentColor; border-radius: 5px; transition: width .3s var(--ease), height .3s var(--ease); }
.sfold { position: absolute; }
.sfold.vt { top: 2px; bottom: 2px; border-left: 1.5px dashed currentColor; }
.sfold.hz { left: 2px; right: 2px; border-top: 1.5px dashed currentColor; }
.devshell, .devscreen { transition: width .35s var(--ease), height .35s var(--ease), transform .35s var(--ease); }
.vbar { position: absolute; top: 2px; right: 2px; bottom: 2px; width: 10px; opacity: 0; transition: opacity .25s; pointer-events: none; z-index: 1; }
.vbar.show, .vbar.drag { opacity: 1; pointer-events: auto; }
.vthumb { position: absolute; left: 3px; right: 1px; top: 0; border-radius: 999px; background: rgba(128,128,128,.55); cursor: grab; transition: left .15s, background .15s; }
.vbar:hover .vthumb, .vbar.drag .vthumb { left: 0; background: rgba(128,128,128,.8); }
.vbar.drag .vthumb { cursor: grabbing; }
.hinges { position: absolute; inset: 0; pointer-events: none; }
.hinge { position: absolute; }
.hinge.vt { top: 0; bottom: 0; width: 0; border-left: 1.5px dashed rgba(120,120,140,.55); }
.hinge.hz { left: 0; right: 0; height: 0; border-top: 1.5px dashed rgba(120,120,140,.55); }
.devlist { max-height: 340px; overflow-y: auto; }
.devframe { width: 100%; height: 100%; border: 0; display: block; background: transparent; opacity: 0; transition: opacity .25s ease-out; }
.devframe.ready { opacity: 1; }
.devlabel { position: absolute; left: 0; right: 0; bottom: -40px; text-align: center; color: #D8D9DE; font: 500 12px var(--mono); }
.devblocked { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 6px; align-items: center; justify-content: center; text-align: center; padding: 24px; background: var(--s2); border-radius: 22px; color: var(--text); }
.devblocked span { color: var(--muted); font-size: 12.5px; }
.shotsel { cursor: crosshair; }
.frozen { position: fixed; inset: 0; width: 100vw; height: 100vh; }
.selbox { position: fixed; border: 1.5px solid #fff; box-shadow: 0 0 0 9999px rgba(0,0,0,.45); }
.shotwrap { flex: none; animation: devIn .3s var(--ease); }
.shotview { display: block; border-radius: 8px; box-shadow: 0 30px 80px rgba(0,0,0,.6); cursor: crosshair; }
.obox { position: fixed; pointer-events: none; border: 1.5px dashed; border-radius: 2px; }
.obox.flex { border-color: rgba(91,124,255,.85); background: rgba(91,124,255,.06); }
.obox.grid { border-color: rgba(176,102,255,.9); background: rgba(176,102,255,.07); }
.obox span { position: absolute; left: -1px; top: -18px; font: 500 10px/1 var(--mono); color: #fff; padding: 3px 5px; border-radius: 3px; white-space: nowrap; }
.obox.flex span { background: rgba(91,124,255,.95); }
.obox.grid span { background: rgba(176,102,255,.95); }

/* search palette */
.pal { position: fixed; z-index: 5; top: 12px; width: 380px; background: var(--s2); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadowLg); overflow: hidden; pointer-events: auto; animation: winIn .2s var(--ease); }
.palin { display: flex; align-items: center; gap: 10px; height: 50px; padding: 0 14px; border-bottom: 1px solid var(--line); color: var(--muted); }
.palin input { flex: 1; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; font-size: 14px; min-width: 0; }
.palin input::placeholder { color: var(--faint); }
.pallist { max-height: 360px; overflow-y: auto; padding: 6px; }
.palrow { display: flex; align-items: center; gap: 10px; width: 100%; height: 40px; padding: 0 10px; border: 0; border-radius: 9px; background: transparent; font-size: 13px; cursor: pointer; text-align: left; color: var(--text); }
.palrow:hover, .palrow.sel { background: var(--s3); }
.palrow .ic { color: var(--muted); }
.palrow small { margin-left: auto; color: var(--faint); font-size: 12px; }

/* page overlays drawn by tools */
.layer { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
.capture { position: fixed; inset: 0; z-index: 2; pointer-events: auto; cursor: crosshair; }
.hl { position: fixed; border: 1.5px solid #5B7CFF; background: rgba(91,124,255,.10); border-radius: 2px; pointer-events: none; transition: all .08s linear; }
.hl.pinned { border-color: #F2B544; background: rgba(242,181,68,.10); }
.hl.soft { border-style: dashed; }
.hltag { position: fixed; background: #5B7CFF; color: #fff; font: 500 11px/1 var(--mono); padding: 5px 7px; border-radius: 4px; white-space: nowrap; pointer-events: none; }
.loupe { position: fixed; width: 132px; height: 152px; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.loupe canvas { width: 132px; height: 132px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 10px 30px rgba(0,0,0,.4); image-rendering: pixelated; }
.loupe span { font: 600 11px/1 var(--mono); background: rgba(0,0,0,.7); color: #fff; padding: 4px 6px; border-radius: 4px; }
.mline { position: fixed; inset: 0; pointer-events: none; }
.mline line { stroke: #FF6B3D; stroke-width: 1.5; }
.mline circle { fill: #FF6B3D; }
.guide { position: fixed; pointer-events: none; }
.guide.gx { top: 0; bottom: 0; width: 0; border-left: 1px dashed #FF3D9A; }
.guide.gy { left: 0; right: 0; height: 0; border-top: 1px dashed #FF3D9A; }
.mlist { display: flex; flex-direction: column; gap: 6px; }
.mcard { display: flex; flex-direction: column; gap: 8px; padding: 10px 10px 10px 12px; border-radius: 10px; background: var(--s3); border: 1px solid transparent; cursor: pointer; transition: border-color .15s, background .15s; }
.mcard:hover { border-color: var(--line2); }
.mcard.on { border-color: var(--mc); }
.mcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mhead { display: flex; align-items: center; gap: 8px; }
.mhead b { flex: 1; font-weight: 600; }
.mhead .wbtn { width: 26px; height: 26px; margin: -4px -2px -4px 0; }
.mdot { width: 10px; height: 10px; border-radius: 50%; background: var(--mc); flex: none; }
.mgrid { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 4px 10px; font-size: 12px; }
.mgrid span { color: var(--muted); }
.mgrid b { font: 600 12px var(--mono); }
.mtag { position: fixed; background: #FF6B3D; color: #fff; font: 600 11px/1 var(--mono); padding: 5px 7px; border-radius: 4px; white-space: nowrap; pointer-events: none; }
`;
