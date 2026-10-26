// Runs only on sites where the user turned on "apply automatically" and allowed access.
// Asks the background to re-apply that site's dark mode / custom CSS / custom JS.
chrome.runtime.sendMessage({ type: 'siteApply' }).catch(() => {});
