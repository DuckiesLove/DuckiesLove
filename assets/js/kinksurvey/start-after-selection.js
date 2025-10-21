(() => {
  // --- route guard: only run on /kinksurvey ---
  const onKinkSurvey = location.pathname.replace(/\/+$/,'') === '/kinksurvey';
  if (!onKinkSurvey) return;

  // --- tiny utils ---
  const onReady = fn => (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // --- state we coordinate with survey.js (non-breaking) ---
  const TK = (window.TK ||= {});
  TK.state ||= {};
  TK.state.started = false;
  TK.state.selectedGroups = [];

  // ============= LAYOUT (keep your left categories panel) =============
  function ensureLeftPanel() {
    // Use your existing left panel if it’s already present:
    let panel = $('#categoryPanel');
    if (!panel) {
      // If the app rendered it elsewhere, adopt it; otherwise create it.
      panel = document.createElement('section');
      panel.id = 'categoryPanel';
      panel.className = 'tk-pane';
      panel.innerHTML = `
        <h2 class="tk-side-title">Categories</h2>
        <div class="tk-cat-count">0 selected</div>
        <ul class="tk-catlist"></ul>`;
      // Try to place it in your left rail if it exists, else prepend to body.
      const leftRail = $('#tkDockLeft') || $('#leftCol') || $('body');
      leftRail.prepend(panel);
    }
    // Strip any inline CSS that caused fixed positioning/scroll bars
    panel.removeAttribute('style');
    return panel;
  }

  // ============= CATEGORIES (don’t pre-check; only start after select) =============
  // Called by survey bootstrap after kinks.json loads. The core app
  // looks for a global buildCategoryList hook – we provide it here.
  window.buildCategoryList = function buildCategoryList(kinks) {
    const panel = ensureLeftPanel();
    const list = panel.querySelector('.tk-catlist');
    const counter = panel.querySelector('.tk-cat-count');

    list.textContent = '';

    // Build unique group list (adjust if your JSON differs)
    const groups = [...new Set(kinks.map(k => k.group))].sort();

    // Build checkboxes – DO NOT pre-check anything
    groups.forEach(g => {
      const li = document.createElement('li');
      li.className = 'tk-catrow';
      li.innerHTML = `
        <label class="tk-cat">
          <input type="checkbox" data-group="${g}" />
          <span class="tk-catname">${g}</span>
        </label>`;
      list.appendChild(li);
    });

    // Make sure nothing is checked (guards browser/restore/autofill)
    $$('.tk-catlist input[type="checkbox"]').forEach(cb => cb.checked = false);

    // “Select to begin” helper UI (center panel placeholder)
    mountSelectHelper();

    // Wire changes
    list.addEventListener('change', onCategoryChange);
    updateSelectedCounter();

    // No auto-start here; user must choose.
  };

  function onCategoryChange() {
    const selected = $$('.tk-catlist input:checked').map(cb => cb.dataset.group);
    TK.state.selectedGroups = selected;
    updateSelectedCounter();

    // Rebuild your pool if the core app exposes a rebuild method.
    if (typeof TK.rebuildPool === 'function') TK.rebuildPool(selected);

    // Start survey the *moment* a user picks the first category
    if (!TK.state.started && selected.length > 0) {
      safeStartSurvey();
      removeSelectHelper();
    }

    // If the user unchecks everything after start, you may decide
    // to pause or keep going; we keep going to avoid data loss.
  }

  function updateSelectedCounter() {
    const n = TK.state.selectedGroups.length;
    const counter = $('.tk-cat-count');
    if (counter) counter.textContent = `${n} selected`;
  }

  // ============= START SURVEY (only after selection) =============
  // Your initializer calls startSurvey() – we expose a safe starter
  // that only fires once and only if a category is selected.
  window.startSurvey = function startSurvey() {
    if (TK.state.started) return;
    if (TK.state.selectedGroups.length === 0) {
      // No selection yet; show the helper and bail.
      mountSelectHelper();
      return;
    }
    safeStartSurvey();
  };

  function safeStartSurvey() {
    if (TK.state.started) return;
    TK.state.started = true;

    // If your core app has its own start, prefer it.
    if (typeof TK.start === 'function') {
      TK.start();
    } else if (typeof TK.begin === 'function') {
      TK.begin();
    } else {
      // Fallback: nothing to call – your survey.js may auto-advance
      // after buildCategoryList+renderFirstQuestion hooks.
      // We still hide the helper.
    }
  }

  // ============= FIRST QUESTION RENDER HOOK (keep your card) =============
  // If your bootstrap uses renderFirstQuestion(), make sure it puts the card
  // in the center and doesn’t create inner scrollbars.
  window.renderFirstQuestion = function renderFirstQuestion() {
    const host = document.querySelector('#tk-question-host') || $('#tkDockMid') || $('main') || document.body;
    const card = $('#tk-question-card') || $('.question-card') || $('#questionCard');
    if (host && card && card.parentNode !== host) host.prepend(card);
    if (card) card.style.overflow = 'visible';
  };

  // ============= “Select categories to begin” helper =============
  function mountSelectHelper() {
    if ($('#tk-select-helper')) return;
    const helper = document.createElement('div');
    helper.id = 'tk-select-helper';
    helper.className = 'tk-pane';
    helper.style.margin = '16px auto';
    helper.style.maxWidth = '880px';
    helper.style.padding = '18px 20px';
    helper.innerHTML = `
      <h3 style="margin:0 0 8px 0">Select at least one category to begin</h3>
      <div class="how-to-score">
        <div style="opacity:.85">How to score</div>
        <ul style="margin:.5rem 0 0 1rem; line-height:1.35">
          <li><strong>0</strong> — skip for now</li>
          <li><strong>1</strong> — hard limit (no-go)</li>
          <li><strong>2</strong> — soft limit / willing to try</li>
          <li><strong>3</strong> — context-dependent</li>
          <li><strong>4</strong> — enthusiastic yes</li>
          <li><strong>5</strong> — favorite / please do</li>
        </ul>
      </div>`;
    // drop it in the middle column
    const mid = $('#tkDockMid') || $('main') || document.body;
    mid.prepend(helper);
  }
  function removeSelectHelper() { $('#tk-select-helper')?.remove(); }

  // ============= Bootstrap after DOM is ready =============
  onReady(() => {
    // keep your existing left panel visible & in place
    ensureLeftPanel();
    // do NOT start the survey here; the hooks above will do it after selection
  });
})();
