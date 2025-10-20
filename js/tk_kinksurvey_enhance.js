/* tk_kinksurvey_enhance.js — dock-layout bootstrap */

(function () {
  // --- guards --------------------------------------------------------------
  const isCompatView = () =>
    document.documentElement.hasAttribute('data-compatibility') ||
    /[?&]compat(=1|=true)?\b/i.test(location.search) ||
    document.body.classList.contains('is-compatibility') ||
    !!document.querySelector('[data-page="compatibility"]');

  const isKinkSurvey = () =>
    /\/kinksurvey\/?$/i.test(location.pathname) ||
    document.body.id === 'kinksurvey' ||
    document.documentElement.getAttribute('data-page') === 'kinksurvey';

  // Use a single re-entrancy flag so we don’t double-dock after BFCache, PJAX, etc.
  let DID_DOCK = false;

  // --- util: strip inline styles that fight the layout ---------------------
  function stripInlineStyles(root, selectors) {
    if (!root) return;
    selectors.forEach(sel => {
      root.querySelectorAll(sel).forEach(node => node.removeAttribute('style'));
    });
  }

  // --- CSS class sanity: make sure the rail/actions still use expected hooks
  function ensureButtonRailClasses() {
    // These classes are referenced in css/style.css and must exist
    const rail = document.querySelector('.button-grid, .compatibility-button-container, [data-role="button-rail"]');
    if (!rail) return;
    // If the markup lost our hooks, re-apply the primary one the CSS expects.
    if (!rail.classList.contains('button-grid') &&
        !rail.classList.contains('compatibility-button-container')) {
      rail.classList.add('button-grid');
    }
    // Individual buttons
    rail.querySelectorAll('button,a').forEach(btn => {
      if (!btn.classList.contains('compatibility-button')) {
        btn.classList.add('compatibility-button');
      }
    });
  }

  // --- main bootstrap for the docked survey layout -------------------------
  function runDockBootstrap() {
    if (DID_DOCK) return;

    // Ensure the dock containers exist (left/right scaffolding)
    // NOTE: these are provided by your helpers; they also make containers if missing.
    if (typeof ensureDockLayoutNodes === 'function') {
      ensureDockLayoutNodes();
    }

    // Physically move the category rail into the left dock,
    // and the action buttons into the right dock.
    if (typeof mountDockPanel === 'function') {
      mountDockPanel();
    }
    if (typeof mountDockActions === 'function') {
      mountDockActions();
    }

    // Strip any inline styles added by legacy renderers that break the dock.
    stripInlineStyles(document, [
      '#categoryPanel, [data-role="category-panel"]',
      '#surveyActions, [data-role="survey-actions"]',
      '#questionArea, .survey-question-panel, .question-card'
    ]);

    // The full dock setup (your existing function) — leaves the layout “owned”
    // by the dock containers and finalizes class names, listeners, etc.
    if (typeof setupDockedSurveyLayout === 'function') {
      setupDockedSurveyLayout();
    }

    // Make sure the button rail still maps to css/style.css rules.
    ensureButtonRailClasses();

    DID_DOCK = true;
    document.documentElement.setAttribute('data-docked', 'true');
  }

  // --- compatibility page: never dock; rely on compatibility.html styles ---
  function runCompatTeardown() {
    // This intentionally removes dock scaffolding and centers via compat sheet.
    if (typeof teardownDockLayout === 'function') {
      teardownDockLayout({ compatibility: true });
    }
    DID_DOCK = false;
    document.documentElement.removeAttribute('data-docked');
  }

  // --- page router: decide what to run on ready/BFCache --------------------
  function router() {
    if (isCompatView()) {
      runCompatTeardown();
      return;
    }
    if (isKinkSurvey()) {
      runDockBootstrap();
      return;
    }
    // Other pages: ensure we’re not leaving dock detritus around
    if (typeof teardownDockLayout === 'function') {
      teardownDockLayout();
    }
    DID_DOCK = false;
  }

  // --- ready hooks: DOMContentLoaded + BFCache restore ---------------------
  function onReady() { router(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
  // BFCache / back-forward cache: pageshow with persisted = true
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) router();
  });

  // Optional: micro observer to catch late-inserted markup that needs moving
  const mo = new MutationObserver(() => {
    // If we’re on survey and dock not complete (or containers re-appeared), retry the moves
    if (isKinkSurvey() && !document.documentElement.hasAttribute('data-docked')) {
      runDockBootstrap();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
