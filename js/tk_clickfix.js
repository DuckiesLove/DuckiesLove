/* TalkKink /kinks/ – make the category list clickable and keep Start in sync */
(() => {
  const d = document, $ = (s, r=d) => r.querySelector(s), $$ = (s, r=d) => Array.from(r.querySelectorAll(s));

  function neutralizeFullScreenOverlays() {
    try {
      d.querySelectorAll('body *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed') {
          const r = el.getBoundingClientRect();
          const covers = r.left <= 0 && r.top <= 0 &&
                         r.right >= innerWidth - 1 && r.bottom >= innerHeight - 1 &&
                         cs.visibility !== 'hidden' && +cs.opacity > 0.01 &&
                         cs.pointerEvents !== 'none';
          if (covers) el.style.pointerEvents = 'none';
        }
      });
    } catch {}
  }

  function clearBlockedCursors() {
    $$('.category-panel, .category-panel *').forEach(n => {
      const cs = getComputedStyle(n);
      if (cs.cursor === 'not-allowed') n.style.cursor = 'auto';
    });
  }

  function punchThroughAboveCheckboxes() {
    const cbs = $$('.category-panel input[type="checkbox"], .category-checkbox');
    const offenders = new Set();
    for (const cb of cbs.slice(0, 200)) {
      const r = cb.getBoundingClientRect();
      const x = r.left + Math.min(10, Math.max(2, r.width / 2));
      const y = r.top  + Math.min(10, Math.max(2, r.height / 2));
      const top = d.elementFromPoint(x, y);
      if (top && top !== cb && !top.contains(cb) && !cb.contains(top)) offenders.add(top);
    }
    offenders.forEach(el => { el.style.pointerEvents = 'none'; });
  }

  function wireSelectionAndStart() {
    const start = $('#startSurvey') || $('#startSurveyBtn');
    const boxes = () => $$('.category-panel input[type="checkbox"], .category-checkbox');
    const selected = () => boxes().filter(cb => cb.checked);
    const syncStart = () => { if (start) start.disabled = selected().length === 0; };

    // Select / Deselect all
    $('#selectAll')?.addEventListener('click', e => {
      e.preventDefault();
      boxes().forEach(cb => (cb.checked = true));
      boxes()[0]?.dispatchEvent(new Event('change', { bubbles: true }));
      syncStart();
    });
    $('#deselectAll')?.addEventListener('click', e => {
      e.preventDefault();
      boxes().forEach(cb => (cb.checked = false));
      boxes()[0]?.dispatchEvent(new Event('change', { bubbles: true }));
      syncStart();
    });

    // Keep Start enabled/disabled as user checks boxes
    d.addEventListener('change', e => {
      if (e.target && e.target.matches('.category-panel input[type="checkbox"], .category-checkbox')) {
        syncStart();
      }
    }, { passive: true });

    // If native label toggle is blocked by CSS, do it manually
    $$('.category-panel label').forEach(lbl => {
      lbl.addEventListener('click', e => {
        const input = lbl.querySelector('input[type="checkbox"]');
        if (input) {
          e.preventDefault();
          input.checked = !input.checked;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });

    // Start → call KINKS_boot with the selected category names
    if (start) {
      start.addEventListener('click', e => {
        if (start.disabled) return;
        e.preventDefault();
        const cats = selected().map(cb => cb.value || cb.getAttribute('data-label') || cb.name || cb.id || 'unknown');
        const boot = window.KINKS_boot || window.KINKS_bootstrap || window.KINKS_start;
        if (typeof boot === 'function') {
          try { boot({ categories: cats }); }
          catch (err) { console.error('[tk_clickfix] boot error', err); alert('Failed to start the survey.'); }
        } else {
          console.warn('[tk_clickfix] KINKS_boot not found; categories:', cats);
          alert('Survey loader is unavailable on this build.');
        }
      });
    }

    syncStart();
  }

  function init() {
    neutralizeFullScreenOverlays();
    clearBlockedCursors();
    punchThroughAboveCheckboxes();
    wireSelectionAndStart();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

