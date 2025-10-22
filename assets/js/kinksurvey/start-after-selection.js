/* ===== TK: restore left Categories + Start gate (only for /kinksurvey) ===== */
(() => {
  const onKinkSurvey = location.pathname.replace(/\/+$/, '') === '/kinksurvey';
  if (!onKinkSurvey) return;

  // ---------- tiny CSS to gate Q&A/score until Start ----------
  const GATE_CSS = `
    html.tk-gated #questionArea,
    html.tk-gated #questionCard,
    html.tk-gated .survey-question-panel,
    html.tk-gated .question-layout,
    html.tk-gated [data-role="question-panel"],
    html.tk-gated #tkScoreDock,
    html.tk-gated .how-to-score,
    html.tk-gated [data-sticky="score"] { display:none !important; }

    /* Start row styling to match your dark theme */
    #tkStartRow { margin: 10px 8px 0; display:flex; justify-content:center; }
    #tkStartBtn {
      appearance:none; border-radius:999px; padding:10px 14px;
      border:1px solid var(--border, #142331); background:#121821; color:var(--fg, #eaf4ff);
      font-weight:700; letter-spacing:.2px; cursor:not-allowed; opacity:.55;
    }
    #tkStartBtn.is-ready { cursor:pointer; opacity:1;
      box-shadow:0 0 0 1px rgba(0,0,0,.3) inset, 0 0 14px color-mix(in oklab, var(--accent, #4da3ff) 55%, transparent);
    }
  `;
  if (!document.getElementById('tk-gate-css')) {
    const s = document.createElement('style'); s.id = 'tk-gate-css'; s.textContent = GATE_CSS; document.head.appendChild(s);
  }

  // Gate UI until Start clicks
  document.documentElement.classList.add('tk-gated');

  // Accept any of these for the category panel (old + new markup)
  const CAT_SELECTORS = [
    '#categoryPanel',
    '.category-panel',
    '[data-role="category-panel"]',
    '.tk-categories',
    'aside:has(.tk-catlist)',
    'aside:has(input[type="checkbox"][name^="cat"])'
  ];

  const QP_SELECTORS = [
    '#questionArea', '#questionCard', '.survey-question-panel', '.question-layout', '[data-role="question-panel"]'
  ];

  const SCORE_SELECTORS = ['#tkScoreDock', '.how-to-score', '[data-sticky="score"]'];

  const $ = (sel, root = document) => { try { return root.querySelector(sel); } catch { return null; } };
  const any = (sels, root = document) => sels.map((s) => $(s, root)).find(Boolean) || null;

  function waitFor(fn, ms = 6000) {
    return new Promise((res) => {
      const stopAt = performance.now() + ms;
      (function tick() {
        const val = fn();
        if (val) return res(val);
        if (performance.now() > stopAt) return res(null);
        requestAnimationFrame(tick);
      })();
    });
  }

  function wireStartButton(catPanel) {
    // Add a Start row under the categories panel (only once)
    let row = document.getElementById('tkStartRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'tkStartRow';
      row.innerHTML = '<button id="tkStartBtn" disabled>Start Survey</button>';
      // Prefer bottom of the left panel; if it’s your #categoryPanel, append inside; else, place after it.
      (catPanel || document.body).appendChild(row);
    }
    const startBtn = document.getElementById('tkStartBtn');

    // Track selected categories (works for native or ARIA checkboxes)
    const boxes = catPanel ? catPanel.querySelectorAll('input[type="checkbox"], [role="checkbox"]') : [];
    const update = () => {
      const selected = Array.from(boxes).some((b) => b.checked || b.getAttribute('aria-checked') === 'true');
      startBtn.toggleAttribute('disabled', !selected);
      startBtn.classList.toggle('is-ready', selected);
    };
    boxes.forEach((b) => b.addEventListener('change', update));
    // If the list re-renders, keep status fresh
    const mo = new MutationObserver(update);
    if (catPanel) mo.observe(catPanel, { childList: true, subtree: true, attributes: true });
    update();

    startBtn.onclick = async () => {
      if (startBtn.hasAttribute('disabled')) return;
      // Un-gate UI
      document.documentElement.classList.remove('tk-gated');

      // Move/ensure score card is visible if present
      const score = any(SCORE_SELECTORS);
      if (score) score.style.display = '';

      // Call any existing engine hook if present
      if (typeof window.TK?.startSurvey === 'function') window.TK.startSurvey();
      else if (typeof window.startSurvey === 'function') window.startSurvey();

      // Smooth scroll to first question once it’s in DOM
      const q = await waitFor(() => any(QP_SELECTORS), 3000);
      q?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  async function boot() {
    // Hide questions & score immediately (if engine mounted early)
    const score = any(SCORE_SELECTORS);
    if (score) score.style.display = 'none';

    // Find (or wait for) the categories panel
    const cat = await waitFor(() => any(CAT_SELECTORS), 8000);
    if (!cat) {
      console.warn('[TK] Categories panel not found yet; keeping Start row off for now.');
      return;
    }
    // Make sure inline sizes from previous scripts don’t fight layout
    cat.removeAttribute('style');
    wireStartButton(cat);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();
