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
    {
      n: 0,
      cls: 'pill-0',
      short: 'Skipped',
      full: 'Brain did a cartwheel — skipped for now 😅',
    },
    {
      n: 1,
      cls: 'pill-1',
      short: 'Hard',
      full: 'Hard Limit — full stop / no-go (non-negotiable)',
    },
    {
      n: 2,
      cls: 'pill-2',
      short: 'Soft',
      full: 'Soft Limit — willing to try; strong boundaries, safety checks, aftercare planned',
    },
    {
      n: 3,
      cls: 'pill-3',
      short: 'Context',
      full: 'Curious / context-dependent — okay with discussion, mood, and trust; needs clear negotiation',
    },
    {
      n: 4,
      cls: 'pill-4',
      short: 'Comfy',
      full: 'Comfortable / enjoy — generally a yes; normal precautions and check-ins',
    },
    {
      n: 5,
      cls: 'pill-5',
      short: 'Enthusiastic',
      full: 'Favorite / enthusiastic yes — happily into it; green light',
    },
  ];

  // 3) Build HORIZONTAL "How to score" bar (center, above question)
  function renderScoreBarHorizontal() {
    const host = document.getElementById('scoreBar');
    if (!host) return;
    host.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'score-bar';

    SCORE_ITEMS.forEach(({ n, cls, short, full }) => {
      const tile = document.createElement('div');
      tile.className = 'score-tile';
      tile.setAttribute('role', 'group');
      tile.setAttribute('aria-label', `${n} — ${full}`);
      tile.title = `${n} — ${full}`;
      tile.innerHTML = `
        <div class="pill ${cls}">${n}</div>
        <div class="tile-label">${short}</div>
      `;
      bar.appendChild(tile);
    });

    host.appendChild(bar);
  }

  // 4) Render the question card in the center column (no sidebar duplicate)
  function renderQuestionCard(options = {}) {
    const {
      title = 'Giving: Rate interest/comfort (0–5)',
      subtitle = 'Appearance Play • Choosing My Partner\'s Clothes',
    } = options;

    const app = document.getElementById('questionMount') || document.getElementById('surveyApp');
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
    renderScoreBarHorizontal();
    renderQuestionCard();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
