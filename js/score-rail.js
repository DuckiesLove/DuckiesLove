(() => {
  const TAG = '[TK rail]';
  const prior = window.__TK_SCORE_RAIL__;
  if (prior && typeof prior.destroy === 'function') {
    try { prior.destroy(); } catch (err) { console.warn(TAG, 'previous instance cleanup failed', err); }
  } else if (prior) {
    console.debug(TAG, 'already mounted');
    return;
  }

  window.__TK_SCORE_RAIL__ = { destroy: null, pending: true };
// mark the rail as ready so the boot loader sees it
window.__TK_SCORE_RAIL_READY__ = true;


  const boot = () => {
    // ---------- Styles ----------
    const css = document.createElement('style');
    css.textContent = `
      :root{
        --tk-rail-pad:14px; --tk-rail-br:16px;
        --tk-rail-bg: rgba(8,14,18,.72);
        --tk-rail-b: 1px solid rgba(0,255,255,.25);
        --tk-rail-glow: 0 0 24px rgba(0,224,255,.25);
        --tk-chip-bg:#0e1418; --tk-chip-fg:#e8f6ff; --tk-chip-br:12px;
      }
      .tk-rail{
        position: fixed; top: 128px; right: 16px;
        z-index: 999999; /* stay on top */
        width: min(var(--tk-rail-w,420px), calc(100vw - var(--tk-rail-left,0px) - 32px));
        background:var(--tk-rail-bg); border-radius:var(--tk-rail-br);
        border:var(--tk-rail-b); box-shadow:var(--tk-rail-glow);
        color:var(--tk-chip-fg); padding:var(--tk-rail-pad);
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      }
      .tk-rail h3{ margin:0 0 10px; font:600 14px/1.2 ui-sans-serif,system-ui; color:#bfefff;
                   text-shadow:0 0 10px rgba(0,224,255,.35) }
      .tk-row{ display:flex; flex-wrap:wrap; gap:10px; align-items:stretch }
      .tk-chip{ display:inline-flex; align-items:center; gap:8px; padding:8px 10px;
                background:var(--tk-chip-bg); border-radius:var(--tk-chip-br);
                border:1px solid rgba(255,255,255,.08);
                box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
                white-space:nowrap; font-size:13px }
      .tk-num{ width:22px;height:22px;min-width:22px;display:grid;place-items:center;
               border-radius:999px;font-weight:700;color:#021016;
               box-shadow:0 0 0 2px rgba(0,0,0,.35) inset }
      .tk-0 .tk-num{ background:#9bdcff } /* blue skip/joke */
      .tk-1 .tk-num{ background:#ff7474 } /* red stop */
      .tk-2 .tk-num{ background:#ffd04d } /* yellow caution */
      .tk-3 .tk-num{ background:#78f9a6 } /* green bucket */
      .tk-4 .tk-num{ background:#57e28c }
      .tk-5 .tk-num{ background:#35c970 }
      .tk-mini{ margin-top:8px; font-size:11px; color:#88a3b8 }
      @media (max-width:900px){ .tk-rail{ top: 110px; right: 8px } }
    `;
    document.head.appendChild(css);

    // ---------- DOM ----------
    const rail = document.createElement('aside');
    rail.className = 'tk-rail';
    rail.setAttribute('role', 'complementary');
    rail.setAttribute('aria-label', 'How to score');
    rail.innerHTML = `
      <h3>How to score</h3>
      <div class="tk-row">
        ${chip(0,'Brain did a cartwheel — skipped for now 😅')}
        ${chip(1,'Hard Limit — full stop / non-negotiable')}
        ${chip(2,'Soft Limit — willing to try with strong boundaries & aftercare')}
        ${chip(3,'Curious / context-dependent — discuss & negotiate')}
        ${chip(4,'Comfortable / enjoy — generally a yes')}
        ${chip(5,'Favorite / enthusiastic yes — happily into it')}
      </div>
      <div class="tk-mini">Traffic light: red stop • yellow caution • green go.</div>
    `;
    document.body.appendChild(rail);

    const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (cb) => setTimeout(cb, 16);
    const caf = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout;

    let pendingFrame = null;
    const fitNow = () => {
      const cat = getCategoryPanel();
      const leftEdge = cat ? cat.getBoundingClientRect().right : 0;
      const available = window.innerWidth - leftEdge - 32; // 16px margins
      const desired = 420; // target width
      const width = Math.max(280, Math.min(desired, available));
      rail.style.setProperty('--tk-rail-w', width + 'px');
      rail.style.setProperty('--tk-rail-left', Math.max(0, leftEdge) + 'px');
    };

    const scheduleFit = () => {
      if (pendingFrame !== null) { return; }
      pendingFrame = raf(() => {
        pendingFrame = null;
        fitNow();
      });
    };

    const onResize = () => scheduleFit();
    const onOrientation = () => scheduleFit();
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onOrientation);

    const observe = setupObservers({ scheduleFit });

    fitNow();
    console.debug(TAG, 'rendered & observing');

    const destroy = () => {
      removeEventListener('resize', onResize);
      removeEventListener('orientationchange', onOrientation);
      if (pendingFrame !== null) {
        caf(pendingFrame);
        pendingFrame = null;
      }
      observe.disconnect();
      rail.remove();
      css.remove();
      window.__TK_SCORE_RAIL__ = null;
      window.__TK_SCORE_RAIL_READY__ = false;
    };

    window.__TK_SCORE_RAIL__ = { destroy };
    window.__TK_SCORE_RAIL_READY__ = true;
  };

  const setupWhenReady = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  };

  const setupObservers = ({ scheduleFit }) => {
    let observedCat = null;
    const ro = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => scheduleFit())
      : null;

    const observeCat = () => {
      if (!ro) { return; }
      const cat = getCategoryPanel();
      if (!cat || cat === observedCat) { return; }
      observedCat = cat;
      ro.disconnect();
      ro.observe(cat);
    };

    observeCat();

    const mo = typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          observedCat = null;
          observeCat();
          scheduleFit();
        })
      : null;

    if (mo && document.body) {
      mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    return {
      disconnect() {
        ro?.disconnect();
        mo?.disconnect();
      }
    };
  };

  const getCategoryPanel = () =>
    document.getElementById('categoryPanel') || document.querySelector('[aria-label="Categories"]');

  const chip = (n, txt) =>
    `<span class="tk-chip tk-${n}"><span class="tk-num">${n}</span><span>${txt}</span></span>`;

  setupWhenReady();
})();
