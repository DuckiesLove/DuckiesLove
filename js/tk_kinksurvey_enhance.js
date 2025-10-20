/* ---------------------------------------------------------------------------
   Dock layout bootstrap for /kinksurvey
   - Runs setupDockedSurveyLayout() after DOM is ready (and BFCache restore)
   - Ensures ensureDockLayoutNodes(), mountDockPanel(), mountDockActions() run
   - Skips dock on compatibility view and calls teardownDockLayout({compatibility:true})
   - Re-applies expected button rail classes from css/style.css if missing
--------------------------------------------------------------------------- */

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

  let DID_DOCK = false;

  function stripInlineStyles(selList) {
    selList.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.removeAttribute('style'));
    });
  }

  function ensureButtonRailClasses() {
    // These hooks are what css/style.css expects
    const rail =
      document.querySelector('.button-grid') ||
      document.querySelector('.compatibility-button-container') ||
      document.querySelector('[data-role="button-rail"]');

    if (!rail) return;

    if (!rail.classList.contains('button-grid') &&
        !rail.classList.contains('compatibility-button-container')) {
      rail.classList.add('button-grid'); // default hook
      D('added .button-grid to rail');
    }

    rail.querySelectorAll('button, a').forEach(btn => {
      if (!btn.classList.contains('compatibility-button')) {
        btn.classList.add('compatibility-button');
      }
    });
  }

  // Wait until required nodes exist, then resolve
  function waitForNodes(selectors, { timeout = 4000 } = {}) {
    const need = () => selectors.every(s => document.querySelector(s));
    if (need()) return Promise.resolve();

    return new Promise(resolve => {
      const obs = new MutationObserver(() => {
        if (need()) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }

  async function runDockBootstrap() {
    if (DID_DOCK) return;

    // Ensure key DOM exists (category rail, actions, question area)
    await waitForNodes([
      '#categoryPanel, [data-role="category-panel"]',
      '#surveyActions, [data-role="survey-actions"]',
      '#questionArea, .survey-question-panel'
    ]);

    // 1) create scaffolding containers if needed
    if (typeof ensureDockLayoutNodes === 'function') {
      ensureDockLayoutNodes();
    }

    // 2) move left/right payloads into the dock
    if (typeof mountDockPanel === 'function') {
      mountDockPanel();
    }
    if (typeof mountDockActions === 'function') {
      mountDockActions();
    }

    // 3) strip inline styles that fight the dock layout (legacy renderers)
    stripInlineStyles([
      '#categoryPanel, [data-role="category-panel"]',
      '#surveyActions, [data-role="survey-actions"]',
      '#questionArea, .survey-question-panel, .question-card'
    ]);

    // 4) finish configuring the dock (classes, listeners, etc.)
    if (typeof setupDockedSurveyLayout === 'function') {
      setupDockedSurveyLayout();
    }

    // 5) make sure the rail/buttons match css/style.css expectations
    ensureButtonRailClasses();

    DID_DOCK = true;
    document.documentElement.setAttribute('data-docked', 'true');
    D('docked layout initialized');
  }

  function runCompatTeardown() {
    if (typeof teardownDockLayout === 'function') {
      teardownDockLayout({ compatibility: true });
      D('compat teardown applied');
    }
    DID_DOCK = false;
    document.documentElement.removeAttribute('data-docked');
  }

  function router() {
    if (isCompatView()) {
      // Do NOT reintroduce the dock here; rely on compatibility.html centering CSS
      runCompatTeardown();
      return;
    }
    if (isKinkSurvey()) {
      runDockBootstrap();
      return;
    }
    // Other pages: remove dock if it was left around
    if (typeof teardownDockLayout === 'function') teardownDockLayout();
    DID_DOCK = false;
    document.documentElement.removeAttribute('data-docked');
  }

  // Run on ready + BFCache restore
  const onReady = () => router();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }

  // Back/forward cache restore
  window.addEventListener('pageshow', (e) => { if (e.persisted) router(); });

  // Safety net: if content is injected late, attempt once more
  const mo = new MutationObserver(() => {
    if (!DID_DOCK && isKinkSurvey()) runDockBootstrap();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
