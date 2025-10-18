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

  // 2) Score copy — shared single source of truth
  const SCORE_ITEMS = Object.freeze([
    {
      value: 0,
      title: 'Brain did a cartwheel',
      detail: 'skipped for now 😅',
    },
    {
      value: 1,
      title: 'Hard Limit',
      detail: 'full stop / no-go (non-negotiable)',
    },
    {
      value: 2,
      title: 'Soft Limit — willing to try',
      detail: 'strong boundaries, safety checks, aftercare planned',
    },
    {
      value: 3,
      title: 'Curious / context-dependent',
      detail: 'okay with discussion, mood, and trust; needs clear negotiation',
    },
    {
      value: 4,
      title: 'Comfortable / enjoy',
      detail: 'generally a yes; normal precautions and check-ins',
    },
    {
      value: 5,
      title: 'Favorite / enthusiastic yes',
      detail: 'green light; hype and joy',
    },
  ]);

  function ensureScoreStyles() {
    if (document.getElementById('tk-score-styles')) return;
    const style = document.createElement('style');
    style.id = 'tk-score-styles';
    style.textContent = `
  .tk-qwrap {
    display: grid;
    grid-template-columns: 1fr minmax(600px, 42vw);
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .tk-qwrap { grid-template-columns: 1fr; }
  }

  #tkScoreDock {
    border: 1px solid #153c4a;
    border-radius: 16px;
    background: rgba(0, 20, 30, 0.6);
    box-shadow: 0 0 0 1px rgba(0,255,255,.08), 0 6px 24px rgba(0,0,0,.35) inset;
    padding: 16px 16px 12px;
  }
  #tkScoreDock .tk-howto-title {
    margin: 0 0 10px;
    font-weight: 700;
    letter-spacing: .02em;
    color: #a9faff;
    text-shadow: 0 0 10px rgba(0,255,255,.25);
  }
  #tkScoreDock .tk-howto-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  #tkScoreDock .tk-pill {
    display: grid;
    grid-template-columns: 36px 1fr;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: #0b1116;
    border: 1px solid rgba(255,255,255,.06);
  }
  #tkScoreDock .tk-badge {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font: 700 14px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
    color: #031016;
    box-shadow: inset 0 -2px 0 rgba(0,0,0,.2);
  }
  #tkScoreDock .tk-text {
    color: #d9edf2;
    font-size: 14px;
  }
  #tkScoreDock .tk-text b {
    color: #ffffff;
  }
  #tkScoreDock .tk-b0 { background: #9ed0ff; }
  #tkScoreDock .tk-b1 { background: #ff8b8b; }
  #tkScoreDock .tk-b2 { background: #ffd05c; }
  #tkScoreDock .tk-b3 { background: #9cff8f; }
  #tkScoreDock .tk-b4 { background: #70d7ff; }
  #tkScoreDock .tk-b5 { background: #c7a6ff; }

  .tk-hide-legacy-score { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function buildScoreDock() {
    const dock = document.createElement('aside');
    dock.id = 'tkScoreDock';
    dock.className = 'tk-howto-card';
    dock.setAttribute('role', 'complementary');
    dock.setAttribute('aria-label', 'How to score');

    const title = document.createElement('h3');
    title.className = 'tk-howto-title';
    title.textContent = 'How to score';

    const grid = document.createElement('div');
    grid.className = 'tk-howto-grid';

    SCORE_ITEMS.forEach((item) => {
      const pill = document.createElement('div');
      pill.className = 'tk-pill';

      const badge = document.createElement('div');
      badge.className = `tk-badge tk-b${item.value}`;
      badge.textContent = item.value;

      const txt = document.createElement('div');
      txt.className = 'tk-text';
      txt.innerHTML = `<b>${item.title}</b> — ${item.detail}`;

      pill.append(badge, txt);
      grid.appendChild(pill);
    });

    dock.append(title, grid);
    return dock;
  }

  function hideLegacyScoreBlocks(context) {
    if (!context) return;
    const matches = context.querySelectorAll('#tk-guard, .tk-legend, .how-to-score');
    matches.forEach((node) => {
      if (node.closest('#tkScoreDock')) return;
      node.classList.add('tk-hide-legacy-score');
      node.setAttribute('aria-hidden', 'true');
    });
  }

  function ensureScoreDock(questionCard) {
    if (!questionCard) return;
    ensureScoreStyles();
    let wrap = questionCard.closest('.tk-qwrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'tk-qwrap';
      questionCard.parentElement.insertBefore(wrap, questionCard);
      wrap.appendChild(questionCard);
    }

    let dock = wrap.querySelector('#tkScoreDock');
    if (!dock) {
      dock = buildScoreDock();
      wrap.appendChild(dock);
    }

    hideLegacyScoreBlocks(wrap);
    hideLegacyScoreBlocks(document.body || document);
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
    ensureScoreDock(card);

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
    renderQuestionCard();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
