/* ===== TK /kinksurvey: robust Categories + Start gating ===== */
(() => {
  const isKinkSurvey = location.pathname.replace(/\/+$/,'') === '/kinksurvey';
  if (!isKinkSurvey) return;

  // ---------------- style: gate & start button ----------------
  const CSS = `
    html.tk-gated #questionArea,
    html.tk-gated #questionCard,
    html.tk-gated .survey-question-panel,
    html.tk-gated .question-layout,
    html.tk-gated [data-role="question-panel"],
    html.tk-gated #tkScoreDock,
    html.tk-gated .how-to-score,
    html.tk-gated [data-sticky="score"] { display:none !important; }

    #tkStartRow {
      margin: 12px 8px 0;
      display: flex;
      justify-content: center;
    }
    #tkStartBtn {
      appearance:none;
      border-radius:999px;
      padding:10px 14px;
      border:1px solid var(--border, #142331);
      background:#121821;
      color:var(--fg, #eaf4ff);
      font-weight:700;
      letter-spacing:.2px;
      cursor:not-allowed;
      opacity:.55;
    }
    #tkStartBtn.is-ready {
      cursor:pointer;
      opacity:1;
      box-shadow:0 0 0 1px rgba(0,0,0,.3) inset,
                 0 0 14px color-mix(in oklab, var(--accent, #4da3ff) 55%, transparent);
    }
  `;
  if (!document.getElementById('tk-gate2-css')) {
    const s = document.createElement('style');
    s.id = 'tk-gate2-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Gate the survey UI until Start
  document.documentElement.classList.add('tk-gated');

  // ---------------- utilities ----------------
  const $ = (sel, root=document) => { try { return root.querySelector(sel); } catch { return null; } };
  const $all = (sel, root=document) => { try { return Array.from(root.querySelectorAll(sel)); } catch { return []; } };

  // 1) broad direct selectors (covering old/new markup names)
  const DIRECT_CAT_SELECTORS = [
    '#categoryPanel',
    '#categoriesPanel',
    '#categories',
    '.category-panel',
    '.categories-panel',
    '.tk-categories',
    '[data-role="category-panel"]',
    '[data-panel="categories"]',
    'nav[aria-label="Categories"]',
    'aside[aria-label="Categories"]',
  ];

  // 2) heuristic: find a container with a "Categories" heading + checkboxes
  function headingText(node) {
    return node?.textContent?.trim().toLowerCase().replace(/\s+/g,' ') || '';
  }
  function looksLikeCategoriesContainer(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const hasHeading = $all('h1,h2,h3,h4', el).some(h => /categories/.test(headingText(h)));
    const hasManyBoxes = $all('input[type="checkbox"]', el).length >= 3
                      || $all('[role="checkbox"]', el).length >= 3;
    return hasHeading && hasManyBoxes;
  }

  function findCategoriesPanel() {
    // Try direct selectors first
    for (const sel of DIRECT_CAT_SELECTORS) {
      const n = $(sel);
      if (n) return n;
    }
    // Heuristic over common structural wrappers (left columns, asides)
    const candidates = [
      ...$all('aside, nav, section, div'),
    ].filter(looksLikeCategoriesContainer);

    // Prefer something that sits on the left side of the page
    candidates.sort((a,b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return candidates[0] || null;
  }

  // Observe DOM for late mounts
  const domWatcher = new MutationObserver(() => maybeMount());
  domWatcher.observe(document.documentElement, {childList:true, subtree:true});

  // Keep score area hidden while gated (in case it’s already in DOM)
  const scoreSelectors = ['#tkScoreDock', '.how-to-score', '[data-sticky="score"]'];
  function hideScore() { scoreSelectors.forEach(sel => { const n = $(sel); if (n) n.style.display = 'none'; }); }
  function showScore() { scoreSelectors.forEach(sel => { const n = $(sel); if (n) n.style.display = ''; }); }
  hideScore();

  // Wire the Start button to the real checkboxes
  let wired = false;
  function wireStartButton(catPanel) {
    if (!catPanel || wired) return;
    wired = true;

    // Make sure inline styles from earlier scripts don’t fight the layout
    catPanel.removeAttribute('style');

    // Inject Start row at the bottom of the panel (once)
    let row = $('#tkStartRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'tkStartRow';
      row.innerHTML = `<button id="tkStartBtn" disabled>Start Survey</button>`;
      catPanel.appendChild(row);
    }
    const startBtn = $('#tkStartBtn');

    // Track selection (native or ARIA checkboxes)
    const getBoxes = () => [
      ...$all('input[type="checkbox"]', catPanel),
      ...$all('[role="checkbox"]', catPanel)
    ];

    const updateState = () => {
      const boxes = getBoxes();
      const anySelected = boxes.some(b => b.checked || b.getAttribute('aria-checked') === 'true');
      startBtn.toggleAttribute('disabled', !anySelected);
      startBtn.classList.toggle('is-ready', anySelected);
    };

    // Changes in selection
    catPanel.addEventListener('change', e => {
      if ((e.target instanceof HTMLInputElement && e.target.type === 'checkbox') || e.target.getAttribute?.('role') === 'checkbox') {
        updateState();
      }
    });
    // ARIA checkbox might toggle via click
    catPanel.addEventListener('click', e => {
      const t = e.target;
      if (t && (t.getAttribute?.('role') === 'checkbox')) setTimeout(updateState, 0);
    });
    // React/Vue re-renders
    const mo = new MutationObserver(() => updateState());
    mo.observe(catPanel, {childList:true, subtree:true, attributes:true, attributeFilter:['checked','aria-checked']});
    updateState();

    // Start click
    startBtn.addEventListener('click', () => {
      if (startBtn.hasAttribute('disabled')) return;

      // Ungate UI
      document.documentElement.classList.remove('tk-gated');
      showScore();

      // Notify app if there’s a hook
      if (typeof window.TK?.startSurvey === 'function') {
        try { window.TK.startSurvey(); } catch {}
      } else if (typeof window.startSurvey === 'function') {
        try { window.startSurvey(); } catch {}
      }

      // Scroll to questions when they exist
      const questionSelectors = ['#questionArea', '#questionCard', '.survey-question-panel', '.question-layout', '[data-role="question-panel"]'];
      const tryScroll = () => {
        const q = questionSelectors.map(s => $(s)).find(Boolean);
        if (q) q.scrollIntoView({behavior:'smooth', block:'start'});
      };
      setTimeout(tryScroll, 100);
      setTimeout(tryScroll, 600);
    });
  }

  // Try to mount quickly, and keep retrying as DOM changes
  let lastPanel = null;
  function maybeMount() {
    const panel = findCategoriesPanel();
    if (!panel) return;      // keep waiting (observer stays active)
    if (panel === lastPanel) return;
    lastPanel = panel;
    wireStartButton(panel);
  }

  // First attempts
  maybeMount();
  // A few timed retries in case the panel is very late
  [400, 800, 1500, 3000, 5000, 8000, 12000].forEach(t => setTimeout(maybeMount, t));
})();
