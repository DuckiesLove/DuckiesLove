/* TalkKink – hard-disable the overlay/portal and stop flashes */
(() => {
  // 0) Kill switch so we can flip from DevTools too if ever needed
  try { localStorage.setItem('__TK_DISABLE_OVERLAY', '1'); } catch {}

  // 1) CSS: hide any known overlay shells and stop animations (prevents flash)
  const css = document.createElement('style');
  css.id = 'tk-no-overlay-css';
  css.textContent = `
    /* Known/likely overlay containers */
    #tkPortal, #tkOverlay, .tkPortal, .tkOverlay, .tkDockShell,
    #tkDevOverlay, .tkDevOverlay, [data-tk-overlay], [data-portal] {
      display: none !important; opacity: 0 !important; visibility: hidden !important;
      pointer-events: none !important;
    }
    /* Prevent transition flashes during removal */
    * { transition: none !important; animation: none !important; }
  `;
  document.head.appendChild(css);

  // 2) Best-effort: disconnect mutation observers that keep re-parenting
  (function tryDisconnectThirdPartyMOs(root = window) {
    const MO = root.MutationObserver || root.WebKitMutationObserver;
    if (!MO || !MO.prototype) return;
    const _observe = MO.prototype.observe;
    const _disconnect = MO.prototype.disconnect;

    // Track new observers so we can disconnect them immediately
    const tracked = new Set();
    MO.prototype.observe = function () { tracked.add(this); return _observe.apply(this, arguments); };
    MO.prototype.disconnect = function () { try { tracked.delete(this); } catch {} return _disconnect.apply(this, arguments); };
    // Disconnect any existing ones (best effort)
    tracked.forEach(o => { try { o.disconnect(); } catch {} });
  })();

  // 3) Remove any overlay nodes already on the page (defensive)
  const OVERLAY_SEL = [
    '#tkPortal', '#tkOverlay', '.tkPortal', '.tkOverlay', '.tkDockShell',
    '#tkDevOverlay', '.tkDevOverlay', '[data-tk-overlay]', '[data-portal]'
  ].join(',');
  document.querySelectorAll(OVERLAY_SEL).forEach(n => { try { n.remove(); } catch {} });

  // 4) Make sure the main app stays above any residual junk
  const app = document.querySelector('#surveyApp') || document.querySelector('main');
  if (app) {
    app.style.position = 'relative';
    app.style.zIndex = '2147483640';
  }

  // 5) Safety log
  console.info('[TK] no-overlay.js executed — overlay disabled + flashes suppressed');
})();

export {}; // (No-op, keeps module bundlers happy)
