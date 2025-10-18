(function () {
  const once = (fn) => {
    let did = false;
    return (...args) => {
      if (did) return;
      did = true;
      fn(...args);
    };
  };

  // 1) Hard-disable legacy overlay/portal that caused flashing
  (function killOverlayEarly() {
    try {
      document.documentElement.classList.add('no-overlay');
      const junk = document.querySelectorAll(
        '.tk-overlay, [data-tk-overlay], .portal, [data-portal], #ctaStack'
      );
      junk.forEach((node) => node.remove());
    } catch (err) {
      console.warn('[survey.js] overlay cleanup failed', err);
    }
  })();

  // 2) Rating scale data (stable, single source)
  const SCORE_ITEMS = [
    { n: 0, cls: 'pill-0', text: 'Brain did a cartwheel — skipped for now 😅' },
    { n: 1, cls: 'pill-1', text: 'Hard Limit — full stop / no-go (non-negotiable)' },
    {
      n: 2,
      cls: 'pill-2',
      text: 'Soft Limit — willing to try; strong boundaries, safety checks, aftercare planned',
    },
    {
      n: 3,
      cls: 'pill-3',
      text: 'Curious / context-dependent — okay with discussion, mood, trust; needs clear negotiation',
    },
    {
      n: 4,
      cls: 'pill-4',
      text: 'Comfortable / enjoy — generally a yes; normal precautions and check-ins',
    },
    { n: 5, cls: 'pill-5', text: 'Favorite / enthusiastic yes — happily into it; green light' },
  ];

  // 3) Build SINGLE right-rail "How to score" card
  function renderScoreSidebar() {
    const host = document.getElementById('scoreSidebar');
    if (!host) return;
    host.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'score-card';
    card.innerHTML = '<h3>How to score</h3>';

    SCORE_ITEMS.forEach(({ n, cls, text }) => {
      const row = document.createElement('div');
      row.className = 'score-item';
      row.innerHTML = `
        <div class="score-pill ${cls}">${n}</div>
        <div class="score-text">${text}</div>
      `;
      card.appendChild(row);
    });

    host.appendChild(card);
  }

  // 4) Render the question card in the center column (no sidebar duplicate)
  function renderQuestionCard(options = {}) {
    const {
      title = 'Giving: Rate interest/comfort (0–5)',
      subtitle = 'Appearance Play • Choosing My Partner\'s Clothes',
    } = options;

    const app = document.getElementById('surveyApp');
    if (!app) return;

    app.innerHTML = '';

    const card = document.createElement('section');
    card.className = 'question-card';
    card.innerHTML = `
      <h2>${title}</h2>
      <div style="opacity:.8;margin-bottom:10px">${subtitle}</div>
      <div style="font-weight:600;margin:6px 0">Rate interest/comfort (0–5)</div>
      <div class="scale-row">
        ${[0, 1, 2, 3, 4, 5]
          .map((n) => `<button type="button" class="scale-btn" data-score="${n}">${n}</button>`)
          .join('')}
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button type="button" class="scale-btn" id="btnBack">Back</button>
        <button type="button" class="scale-btn" id="btnSkip">Skip</button>
      </div>
    `;

    app.appendChild(card);

    app.querySelectorAll('.scale-btn[data-score]').forEach((btn) => {
      btn.addEventListener('click', () => {
        console.log('score:', btn.dataset.score);
      });
    });
  }

  // 5) Ensure no bottom duplicate ever appears
  function removeBottomCardIfAny() {
    const bottom =
      document.getElementById('howToScoreBottom') ||
      document.querySelector('.how-to-score-bottom');
    if (bottom) bottom.remove();
  }

  // 6) Init once DOM is ready
  const boot = once(() => {
    removeBottomCardIfAny();
    renderScoreSidebar();
    renderQuestionCard();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
