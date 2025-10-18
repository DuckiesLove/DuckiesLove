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

(() => {
  const FLAG = '__tkHowToScoreInjected';
  if (window[FLAG]) return;
  window[FLAG] = true;

  const css = `
  /* layout: two-column when there's room */
  .tk-qwrap {
    display: grid;
    grid-template-columns: 1fr minmax(600px, 42vw);
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .tk-qwrap { grid-template-columns: 1fr; }
  }

  /* the horizontal "How to score" card */
  .tk-howto-card {
    border: 1px solid #153c4a;
    border-radius: 16px;
    background: rgba(0, 20, 30, 0.6);
    box-shadow: 0 0 0 1px rgba(0,255,255,.08), 0 6px 24px rgba(0,0,0,.35) inset;
    padding: 16px 16px 12px;
  }
  .tk-howto-title {
    margin: 0 0 10px;
    font-weight: 700;
    letter-spacing: .02em;
    color: #a9faff;
    text-shadow: 0 0 10px rgba(0,255,255,.25);
  }
  /* horizontal items: auto-wrap, fixed min width so all are visible without scroll */
  .tk-howto-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .tk-pill {
    display: grid;
    grid-template-columns: 36px 1fr;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: #0b1116;
    border: 1px solid rgba(255,255,255,.06);
  }
  .tk-badge {
    width: 32px; height: 32px; border-radius: 999px;
    display: grid; place-items: center;
    font: 700 14px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
    color: #031016; box-shadow: inset 0 -2px 0 rgba(0,0,0,.2);
  }
  .tk-b0 { background: #9ed0ff; }
  .tk-b1 { background: #ff8b8b; }
  .tk-b2 { background: #ffd05c; }
  .tk-b3 { background: #9cff8f; }
  .tk-b4 { background: #70d7ff; }
  .tk-b5 { background: #c7a6ff; }

  .tk-text { color: #d9edf2; font-size: 14px; }
  .tk-text b { color: #ffffff; }
  `;

  const putCSS = () => {
    if (document.getElementById('tk-howto-css')) return;
    const style = document.createElement('style');
    style.id = 'tk-howto-css';
    style.textContent = css;
    document.head.appendChild(style);
  };

  const makePill = (num, title, desc, badgeClass) => {
    const row = document.createElement('div');
    row.className = 'tk-pill';

    const badge = document.createElement('div');
    badge.className = `tk-badge ${badgeClass}`;
    badge.textContent = num;

    const txt = document.createElement('div');
    txt.className = 'tk-text';
    txt.innerHTML = `<b>${title}</b> — ${desc}`;

    row.append(badge, txt);
    return row;
  };

  const buildHowToCard = () => {
    document.querySelectorAll('.tk-howto-card').forEach((n) => n.remove());

    const card = document.createElement('aside');
    card.className = 'tk-howto-card';
    card.setAttribute('aria-label', 'How to score');

    const h = document.createElement('h3');
    h.className = 'tk-howto-title';
    h.textContent = 'How to score';

    const grid = document.createElement('div');
    grid.className = 'tk-howto-grid';

    grid.append(
      makePill('0', 'Brain did a cartwheel', 'skipped for now 😅', 'tk-b0'),
      makePill('1', 'Hard Limit', 'full stop / no-go (non-negotiable)', 'tk-b1'),
      makePill('2', 'Soft Limit — willing to try', 'with strong boundaries, safety checks, and aftercare planned', 'tk-b2'),
      makePill('3', 'Curious / context-dependent', 'okay with discussion, mood, and trust; needs clear negotiation', 'tk-b3'),
      makePill('4', 'Comfortable / enjoy', 'generally a yes; normal precautions and check-ins', 'tk-b4'),
      makePill('5', 'Favorite / enthusiastic yes', 'green light; hype and joy', 'tk-b5'),
    );

    card.append(h, grid);
    return card;
  };

  const mount = () => {
    putCSS();

    const app = document.getElementById('surveyApp') || document.querySelector('main') || document.body;
    const questionCard =
      document.querySelector('#surveyApp [role="region"]') ||
      document.querySelector('#surveyApp section') ||
      document.querySelector('#surveyApp .question-card') ||
      document.querySelector('#surveyApp');

    if (!app || !questionCard) return;

    let wrap = document.querySelector('.tk-qwrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'tk-qwrap';
      questionCard.parentNode.insertBefore(wrap, questionCard);
      wrap.append(questionCard);
    }

    const howto = buildHowToCard();
    wrap.append(howto);
  };

  const boot = () => {
    mount();
    const root = document.getElementById('surveyApp') || document.body;
    const mo = new MutationObserver(() => {
      if (!document.querySelector('.tk-howto-card')) mount();
    });
    mo.observe(root, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
