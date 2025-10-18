(() => {
  // 0) Safety: disable any old overlay/guide duplicator
  try { window.__TK_DISABLE_OVERLAY = true; } catch {}
  const kill = () => {
    document.querySelectorAll('.tk-overlay, .tk-guard, .score-guide--floating').forEach(n => n.remove());
  };
  kill();

  // 1) Styles for right-side inline guide + compact horizontal pills
  const css = `
  /* two-column layout for the question area */
  .tkq-wrap {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .tkq-wrap { grid-template-columns: 1fr; }
  }

  /* the guide card to the right */
  .score-guide {
    border: 1px solid rgba(0, 255, 255, .25);
    background: rgba(8, 14, 18, .6);
    border-radius: 16px;
    box-shadow: 0 0 24px rgba(0, 255, 255, .08) inset, 0 0 0 1px rgba(0, 255, 255, .05);
    padding: 14px;
  }
  .score-guide h3 {
    margin: 0 0 10px;
    font-size: 15px;
    letter-spacing: .02em;
    color: #dff9ff;
    text-shadow: 0 0 8px rgba(0,255,255,.3);
  }

  /* horizontal, wrapping chip list */
  .score-list {
    display: flex; flex-wrap: wrap; gap: 10px;
  }
  .score-chip {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(20, 26, 32, .75);
    border: 1px solid rgba(255,255,255,.06);
    box-shadow: 0 2px 10px rgba(0,0,0,.35);
    min-width: 160px;
    max-width: 340px;
  }
  .score-chip .dot {
    flex: 0 0 26px;
    width: 26px; height: 26px; border-radius: 50%;
    display: inline-grid; place-items: center;
    color:#000; font-weight: 800;
    box-shadow: 0 0 0 2px rgba(0,0,0,.35) inset, 0 2px 6px rgba(0,0,0,.35);
  }
  .score-chip .txt { font-size: 13px; line-height: 1.25; color: #e7f6ff; }

  /* colors for traffic light + 0 */
  .dot.zero { background: #7db9ff; color:#031220; }
  .dot.red  { background: #ff4d4d; }
  .dot.yel  { background: #ffd84a; }
  .dot.grn  { background: #63ff89; color:#002010; }

  /* hide any old vertical/floating guide if it reappears */
  .score-guide--floating { display:none !important; }
  `;
  const style = document.createElement('style');
  style.id = 'tk-inline-score-guide-css';
  style.textContent = css;
  document.head.appendChild(style);

  // 2) Guide content model (short & compact)
  const ITEMS = [
    { n: 0, cls: 'zero', text: 'Brain did a cartwheel — skipped for now 😅' },
    { n: 1, cls: 'red',  text: 'Hard limit — full stop / non-negotiable' },
    { n: 2, cls: 'yel',  text: 'Soft limit — willing to try (boundaries, safety checks, aftercare)' },
    { n: 3, cls: 'grn',  text: 'Curious / context-dependent — needs a talk & clear negotiation' },
    { n: 4, cls: 'grn',  text: 'Comfortable / enjoy — generally a yes; normal precautions' },
    { n: 5, cls: 'grn',  text: 'Favorite / enthusiastic yes — green light' },
  ];

  function buildScoreGuide() {
    const guide = document.createElement('aside');
    guide.className = 'score-guide';
    guide.setAttribute('role', 'complementary');
    guide.innerHTML = `<h3>How to score</h3><div class="score-list"></div>`;
    const list = guide.querySelector('.score-list');

    ITEMS.forEach(({n, cls, text}) => {
      const chip = document.createElement('div');
      chip.className = 'score-chip';
      chip.innerHTML = `<span class="dot ${cls}">${n}</span><span class="txt">${text}</span>`;
      list.appendChild(chip);
    });
    return guide;
  }

  // 3) Find the current question card and install a single inline guide to its right
  function mount() {
    // Kill old duplicates if any
    kill();
    document.getElementById('tk-inline-score-guide')?.remove();

    // Heuristic: the current question “card” (container with the prompt + 0–5 buttons)
    // It’s the first big content card inside #surveyApp after the header controls.
    const app = document.getElementById('surveyApp') || document.querySelector('main#surveyApp') || document.body;
    // Try to grab the visible question block (contains the “Rate interest/comfort (0–5)” text)
    const questionCard =
      app.querySelector('.question-card') ||
      app.querySelector('.card:has(button, [role="radiogroup"]), section .card') ||
      app.querySelector('section:has(button)') ||
      app.querySelector('section');

    if (!questionCard) return; // nothing to do yet

    // Wrap questionCard in a grid that has a right column for the guide
    if (!questionCard.parentElement.classList.contains('tkq-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'tkq-wrap';
      questionCard.parentElement.insertBefore(wrap, questionCard);
      wrap.appendChild(questionCard);
      // guide on the right
      const guide = buildScoreGuide();
      guide.id = 'tk-inline-score-guide';
      wrap.appendChild(guide);
    }
  }

  // 4) Mount now & whenever the survey page swaps questions
  const boot = () => {
    mount();
    // Observe DOM swaps during question navigation
    const obs = new MutationObserver((muts) => {
      // If buttons, prompt, or the rating row changed, re-mount the single guide
      const changed = muts.some(m =>
        [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('button, .card, section, [role="radiogroup"]') ||
          n.querySelector?.('button, .card, section, [role="radiogroup"]')))
      );
      if (changed) mount();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
