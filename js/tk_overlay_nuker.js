/*! TK overlay nuker: aggressively remove blocking overlays and unlock scroll */
(() => {
  const FLAG = "__NUKE_OVERLAY__";
  if (window[FLAG]) { console.log("Already running."); return; }

  const CANDIDATE_SELECTORS = [
    "#tkPortal", "#tkDockPortal", ".tk-portal-overlay", "[data-tk-overlay]",
    ".cdk-overlay-container", ".cdk-global-overlay-wrapper",
    ".mdc-dialog", ".mdc-drawer",
    ".MuiModal-root", ".MuiBackdrop-root",
    ".ReactModalPortal", ".chakra-portal",
    ".modal-backdrop", ".ant-modal-root", ".ant-drawer",
    '[aria-modal="true"]', '[role="dialog"]', '[role="alertdialog"]',
    ".modal", ".drawer", ".sheet", ".overlay", ".backdrop",
    '#modal-root', '#overlay-root',
    '[class*="overlay"]', '[class*="Backdrop"]', '[class*="backdrop"]',
    '[class*="portal"]', '[id*="overlay"]', '[id*="portal"]'
  ];

  const looksLikeOverlay = (el) => {
    try {
      const cs = getComputedStyle(el);
      if (!(cs.position === "fixed" || cs.position === "sticky")) return false;
      const zi = parseInt(cs.zIndex || "0", 10);
      if (isNaN(zi) || zi < 999) return false;
      const r = el.getBoundingClientRect();
      return r.width >= innerWidth * 0.6 && r.height >= innerHeight * 0.6;
    } catch {
      return false;
    }
  };

  const kill = (el) => {
    try {
      el.remove();
    } catch {}
  };

  const unlockScroll = () => {
    for (const n of [document.documentElement, document.body]) {
      n.classList.remove("modal-open", "no-scroll", "overflow-hidden", "lock");
      n.style.overflow = "";
      n.style.height = "";
      n.style.position = n.style.position === "fixed" ? "" : n.style.position;
      n.style.top = n.style.left = n.style.right = n.style.bottom = "";
    }
  };

  const sweep = () => {
    const seen = new Set();

    for (const sel of CANDIDATE_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        kill(el);
      });
    }

    document.querySelectorAll("body *").forEach((el) => {
      if (looksLikeOverlay(el)) kill(el);
    });

    unlockScroll();
  };

  const mo = new MutationObserver((mut) => {
    let changed = false;
    for (const m of mut) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        if (CANDIDATE_SELECTORS.some((sel) => n.matches?.(sel)) || looksLikeOverlay(n)) {
          kill(n);
          changed = true;
        } else {
          const victim = n.querySelector?.(CANDIDATE_SELECTORS.join(","));
          if (victim) {
            kill(victim);
            changed = true;
          }
        }
      }
    }
    if (changed) unlockScroll();
  });

  sweep();
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window[FLAG] = true;
  console.log("%cOverlay nuker active.", "color:#0ff");
})();
