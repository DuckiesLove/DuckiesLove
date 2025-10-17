/* ============================
   FILE: assets/js/survey.js
   APPEND THIS AT THE END
   ============================ */
(() => {
  const BOOT = '__tkOneScoreCard_v2';
  if (window[BOOT]) return;
  window[BOOT] = true;

  // Matches both "How to score" and older "Question Guard • How to score"
  const SCORE_TITLE_RX = /(how\s*to\s*score|question\s*guard)/i;

  const q = (sel, root = document) => root.querySelector(sel);
  const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function findQuestionSection() {
    // Heuristics: find the main question body that contains the rating row (0–5) or the “Giving/Receiving/General” header
    const host = q('#surveyApp') || q('main') || document.body;
    if (!host) return null;

    // Prefer the container that holds the row of 0–5 buttons
    const btnRow = qa('button, [role="button"]', host).filter(b => {
      const t = (b.textContent || '').trim();
      return /^[0-5]$/.test(t);
    });

    if (btnRow.length) {
      // Climb up to a reasonable card/section container
      let node = btnRow[0];
      for (let i = 0; i < 6 && node; i++) {
        if (node.matches('section, article, .card, .panel')) return node;
        node = node.parentElement;
      }
    }

    // Fallback: any section/article that contains “Rate interest/comfort”
    const maybe = qa('section,article,div', host).find(el =>
      /rate\s*interest\s*\/?\s*comfort/i.test(el.textContent || '')
    );
    return maybe || null;
  }

  function findScoreCards() {
    // Any block with a title that looks like the score guide
    const blocks = qa('aside, section, article, div');
    return blocks.filter(el => {
      const h = q('h1,h2,h3,h4,h5,.title,.card-title', el);
      return h && SCORE_TITLE_RX.test((h.textContent || '').trim());
    });
  }

  function ensureGrid(questionEl, scoreEl) {
    // Wrap question + score in a two-column grid container
    let wrapper = questionEl.closest('.tk-grid') || questionEl.parentElement;
    if (!wrapper.classList.contains('tk-grid')) {
      const grid = document.createElement('div');
      grid.className = 'tk-grid';
      wrapper.insertBefore(grid, questionEl);
      grid.appendChild(questionEl);
      wrapper = grid;
    }
    // Move the score aside to be the right column
    if (scoreEl.parentElement !== wrapper) {
      wrapper.appendChild(scoreEl);
    }
    // Basic safety: make sure question area is visible
    questionEl.style.minHeight = '320px';
  }

  function normalizeScoreCard(scoreEl) {
    scoreEl.classList.add('tk-score-aside');
    const h = q('h1,h2,h3,h4,h5,.title,.card-title', scoreEl);
    if (h) h.textContent = 'How to score';
  }

  function run() {
    const question = findQuestionSection();
    if (!question) return;

    const cards = findScoreCards();
    if (!cards.length) return;

    // Keep the right-most card (preferred for right rail). If no “right”, keep the last.
    cards.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const keep = cards[cards.length - 1];
    cards.forEach(el => { if (el !== keep) el.remove(); });

    normalizeScoreCard(keep);
    ensureGrid(question, keep);
  }

  const kick = () => setTimeout(run, 60);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kick, { once: true });
  } else {
    kick();
  }

  // Re-apply on SPA step changes / re-renders
  const mo = new MutationObserver(kick);
  mo.observe(document.body, { childList: true, subtree: true });

  // Optional tiny debug helper:
  window.__TK_SCORE_STATUS__ = () => ({
    question: !!findQuestionSection(),
    scoreCount: findScoreCards().length
  });
})();
