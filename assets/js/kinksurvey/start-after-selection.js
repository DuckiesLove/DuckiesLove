/* assets/js/kinksurvey/start-after-selection.js
   Robust init for Start-after-selection wiring */
(function () {
  if (window.__TK_START_AFTER_SELECTION_WIRED__) return;
  window.__TK_START_AFTER_SELECTION_WIRED__ = true;

  const log = (...a) => console.info("[TK:start-after-selection]", ...a);

  function onReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else cb();
  }

  function waitForEl(selector, { timeout = 8000, root = document } = {}) {
    return new Promise((resolve, reject) => {
      const first = root.querySelector(selector);
      if (first) return resolve(first);

      const obs = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(root, { childList: true, subtree: true });

      if (timeout) {
        setTimeout(() => {
          obs.disconnect();
          reject(new Error(`timeout waiting for ${selector}`));
        }, timeout);
      }
    });
  }

  onReady(async () => {
    try {
      // Only run on pages that actually have the portal
      const portal = document.getElementById("tkPortal");
      if (!portal) {
        log("No #tkPortal on this page; skipping.");
        return;
      }

      // Wait for category panel; if it never appears, no-op quietly
      const panel = await waitForEl("#categoryPanel").catch(() => null);
      if (!panel) {
        log("Category panel not present on this page; skipping.");
        return;
      }

      // If your logic needs specific elements, wait for them too
      const checklist   = await waitForEl("#categoryChecklist").catch(() => null);
      const startBtn    = await waitForEl("#startSurveyBtn").catch(() => null);
      const surveyApp   = document.getElementById("surveyApp");
      const scoreCard   = document.getElementById("surveyScoreCard");

      if (!checklist || !startBtn) {
        log("Required elements missing; skipping.");
        return;
      }

      // Keep start row off until categories are selected
      const selectedCount = () =>
        checklist.querySelectorAll('input[type="checkbox"]:checked').length;

      function update() {
        const n = selectedCount();
        // Disable the Start button (or your “start row”) until at least one selected
        startBtn.disabled = n === 0;

        // If you also show/hide a “start row,” toggle it here:
        // const startRow = document.querySelector("#startRow");
        // if (startRow) startRow.classList.toggle("hidden", n === 0);
      }

      checklist.addEventListener("change", (e) => {
        if (e.target && e.target.matches('input[type="checkbox"]')) update();
      });

      // Ensure engine & scorecard don’t flash early
      if (surveyApp)  surveyApp.hidden = true;
      if (scoreCard)  scoreCard.hidden = true;

      // Final initial state
      update();
      log("Wired successfully.");
    } catch (err) {
      console.warn("[TK:start-after-selection] bootstrap failed:", err.message);
    }
  });
})();
