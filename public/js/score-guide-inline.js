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

  // If your Start button copy differs, tweak this matcher to your exact label.
  const START_LABEL = /start\s*survey/i;
  const clickedStarts = new WeakSet();

  function clickStartIfPresent(root = document) {
    const candidates = Array.from(
      root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')
    );

    const match = candidates.find((node) => {
      const label = (node.textContent || node.value || '').trim();
      return START_LABEL.test(label);
    });

    if (!match || clickedStarts.has(match)) return false;

    clickedStarts.add(match);
    try {
      match.click();
      return true;
    } catch (err) {
      console.warn('[TK] Failed to click inferred Start button', err);
      return false;
    }
  }

  // Adjust this finder if your question card lives in a very different container.
  function findQuestionCardRoot() {
    const doc = document;

    const explicit = doc.querySelector(
      '#tkQuestionCard, #questionCard, [data-question-card], [data-testid="question-card"]'
    );
    if (explicit) return explicit;

    const panel = doc.getElementById('question-panel');
    if (panel) {
      const insidePanel =
        panel.querySelector('.question-card, article, section, div');
      if (insidePanel) return insidePanel;
    }

    const host =
      doc.getElementById('surveyApp') ||
      doc.querySelector('main#surveyApp') ||
      doc.body;
    if (!host) return null;

    const directSelectors = [
      '.question-card',
      '[data-role="question-card"]',
      '.card.question-card',
      '.card',
      'article.question-card',
      'section.question-card',
    ];

    for (const sel of directSelectors) {
      const node = host.querySelector(sel);
      if (node && !node.classList?.contains('tkq-wrap')) return node;
    }

    const containers = Array.from(host.querySelectorAll('section, article, div'));
    for (const node of containers) {
      if (node.classList?.contains('tkq-wrap')) continue;
      const hasInputs = node.querySelector(
        'button, [role="radiogroup"], [data-group], [data-value], input[type="radio"]'
      );
      if (!hasInputs) continue;
      const text = (node.textContent || '').toLowerCase();
      if (
        text.includes('rate interest') ||
        text.includes('rate comfort') ||
        text.includes('rate 0-5') ||
        text.includes('rate 0 – 5') ||
        text.includes('0–5') ||
        text.includes('how to score')
      ) {
        return node;
      }
    }

    return containers.find((node) =>
      node.querySelector('button, [role="radiogroup"], [data-group], [data-value], input[type="radio"]')
    ) || null;
  }

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

    let questionCard = findQuestionCardRoot();

    if (!questionCard) {
      const clicked = clickStartIfPresent();
      if (clicked) {
        setTimeout(mount, 120);
      }
      return; // nothing to do yet
    }

    if (questionCard.classList?.contains('tkq-wrap')) {
      questionCard = questionCard.querySelector(
        '.question-card, [data-question-card], article, section, div'
      ) || questionCard;
    }

    // Wrap questionCard in a grid that has a right column for the guide
    const parent = questionCard.parentElement;
    if (!parent) return;

    let wrap = questionCard.closest('.tkq-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'tkq-wrap';
      parent.insertBefore(wrap, questionCard);
      wrap.appendChild(questionCard);
    }

    if (!wrap.querySelector('#tk-inline-score-guide')) {
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
