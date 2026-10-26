// Entry point, injected into the current tab when the user clicks the toolbar icon.

(globalThis as { __inspectorLoaded?: boolean }).__inspectorLoaded = true;

// After the extension is updated or reloaded, the old panel can stay in the page without its code.
document.querySelectorAll('inspector-panel').forEach((el) => el.remove());

loadSettings().then(() => {
  const panel = new Panel();
  // Dark mode remembered for this site applies as soon as the panel is opened here.
  getSite().then((site) => { if (site.dark) bg({ type: 'dark', on: true }); }).catch(() => {});
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'toggle') panel.toggle();
  });
});
