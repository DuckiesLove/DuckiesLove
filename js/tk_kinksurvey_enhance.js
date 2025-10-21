/* ---------------------------------------------------------------------------
   Dock layout bootstrap for /kinksurvey
   - Runs setupDockedSurveyLayout() after DOM is ready (and BFCache restore)
   - Ensures ensureDockLayoutNodes(), mountDockPanel(), mountDockActions() run
   - Skips dock on compatibility view and calls teardownDockLayout({compatibility:true})
   - Re-applies expected button rail classes from css/style.css if missing
--------------------------------------------------------------------------- */

/* ---- TK /kinksurvey global shims ----
   Ensure the page can call the dock bootstrap by a stable global name.
   These aliases DO NOT affect other routes (landing page etc.) */
(function (w) {
  // Prefer your internally-defined functions if they exist
  const api = w.TK || w;

  // If your file defines these under any names, map/alias them here:
  // (Replace the right-hand sides with your real function names if different)
  api.ensureDockLayoutNodes =
    api.ensureDockLayoutNodes ||
    (typeof ensureDockLayoutNodes === 'function' ? ensureDockLayoutNodes : undefined);
  api.mountDockPanel =
    api.mountDockPanel ||
    (typeof mountDockPanel === 'function' ? mountDockPanel : undefined);
  api.mountDockActions =
    api.mountDockActions ||
    (typeof mountDockActions === 'function' ? mountDockActions : undefined);
  api.setupDockedSurveyLayout =
    api.setupDockedSurveyLayout ||
    (typeof setupDockedSurveyLayout === 'function' ? setupDockedSurveyLayout : undefined);

  // Export a single stable name the page will call:
  w.setupDockedSurveyLayout = api.setupDockedSurveyLayout;

  // Optional: safe no-op fallback so the page never hard-crashes
  if (typeof w.setupDockedSurveyLayout !== 'function') {
    w.setupDockedSurveyLayout = function () {
      console.warn('[TK] setupDockedSurveyLayout not found in enhancer – nothing to do.');
    };
  }
})(window);

(function () {
  const D = (...a) => (window.TK_DEBUG ? console.debug('[dock]', ...a) : void 0);

  const isKinkSurvey = () =>
    /\/kinksurvey\/?$/i.test(location.pathname) ||
    document.body.id === 'kinksurvey' ||
    document.documentElement.getAttribute('data-page') === 'kinksurvey';

  const isCompatView = () =>
    document.documentElement.hasAttribute('data-compatibility') ||
    document.body.classList.contains('is-compatibility') ||
    !!document.querySelector('[data-page="compatibility"]') ||
    /[?&](compat|compare|compatibility)(=1|=true)?\b/i.test(location.search);

  const DOCK_SELECTORS = [
    '#categoryPanel,[data-role="category-panel"]',
    '#surveyActions,[data-role="survey-actions"]',
    '#questionArea,.survey-question-panel,.question-card'
  ];

  let DID_DOCK = false;

  function ensureButtonRailClasses() {
    const rail =
      document.querySelector('.button-grid') ||
      document.querySelector('.compatibility-button-container') ||
      document.querySelector('[data-role="button-rail"]');

    if (!rail) return;

    if (!rail.classList.contains('button-grid') &&
        !rail.classList.contains('compatibility-button-container')) {
      rail.classList.add('button-grid');
      D('added .button-grid to rail');
    }

    rail.querySelectorAll('button, a').forEach(btn => {
      if (!btn.classList.contains('compatibility-button')) {
        btn.classList.add('compatibility-button');
      }
    });
  }

  function stripInlineStyles() {
    DOCK_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.removeAttribute('style'));
    });
  }

  function waitForNodes(selectors, { timeout = 4000 } = {}) {
    const need = () => selectors.every(s => document.querySelector(s));
    if (need()) return Promise.resolve();

    return new Promise(resolve => {
      const obs = new MutationObserver(() => {
        if (need()) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve();
      }, timeout);
    });
  }

  async function runDock() {
    if (DID_DOCK) return;

    await waitForNodes(DOCK_SELECTORS);

    if (typeof ensureDockLayoutNodes === 'function') {
      ensureDockLayoutNodes();
    }
    if (typeof mountDockPanel === 'function') {
      mountDockPanel();
    }
    if (typeof mountDockActions === 'function') {
      mountDockActions();
    }

    stripInlineStyles();

    if (typeof setupDockedSurveyLayout === 'function') {
      setupDockedSurveyLayout();
    }

    ensureButtonRailClasses();

    DID_DOCK = true;
    document.documentElement.setAttribute('data-docked', 'true');
    D('docked layout initialized');
  }

  function teardownCompat() {
    if (typeof teardownDockLayout === 'function') {
      teardownDockLayout({ compatibility: true });
      D('compat teardown applied');
    }
    DID_DOCK = false;
    document.documentElement.removeAttribute('data-docked');
  }

  function teardownAll() {
    if (typeof teardownDockLayout === 'function') {
      teardownDockLayout();
      D('dock teardown applied');
    }
    DID_DOCK = false;
    document.documentElement.removeAttribute('data-docked');
  }

  function router() {
    if (isCompatView()) {
      teardownCompat();
      return;
    }
    if (isKinkSurvey()) {
      runDock().catch(err => console.warn('[dock] bootstrap failed', err));
      return;
    }
    teardownAll();
  }

  const onReady = () => router();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) router();
  });

  const mo = new MutationObserver(() => {
    if (!DID_DOCK && isKinkSurvey()) {
      runDock().catch(err => console.warn('[dock] bootstrap retry failed', err));
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
