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
      detail: 'skipped for now 🥲',
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
      detail: 'okay with discussion, mood & trust; needs clear negotiation',
    },
    {
      value: 4,
      title: 'Comfortable / enjoy',
      detail: 'generally a yes; normal precautions & check-ins',
    },
    {
      value: 5,
      title: 'Favorite / enthusiastic yes',
      detail: 'happily into it; green light',
    },
  ]);

  function ensureScoreStyles() {
    if (document.getElementById('tk-score-styles')) return;
    const style = document.createElement('style');
    style.id = 'tk-score-styles';
    style.textContent = `
  :root{
    --tk-surface: rgba(12,16,20,.65);
    --tk-border: rgba(0,255,255,.22);
    --tk-pill-bg: rgba(255,255,255,.04);
    --tk-glow: 0 0 .9rem rgba(0,255,255,.25);
    --tk-fg: #e8f7ff;
  }

  #surveyApp .question-card,
  #surveyApp section[aria-label*="Question"],
  #surveyApp .panel,
  #surveyApp .card{
    position: relative;
  }

  #tkScoreDock{
    position:absolute;
    top:64px;
    right:16px;
    width:min(560px,36vw);
    z-index:4;
    background:var(--tk-surface);
    border:1px solid var(--tk-border);
    border-radius:14px;
    padding:12px 14px;
    box-shadow: var(--tk-glow);
    backdrop-filter: blur(6px);
    color:var(--tk-fg);
  }
  #tkScoreDock .tk-h3{
    margin:0 0 8px 0;
    font-weight:800;
    font-size:14px;
    letter-spacing:.25px;
    text-transform:uppercase;
    opacity:.9;
  }
  #tkScoreDock .tk-row{
    display:flex;
    flex-wrap:wrap;
    gap:8px 10px;
    margin:0;
    padding:0;
    list-style:none;
  }
  #tkScoreDock .tk-pill{
    display:flex;
    align-items:center;
    gap:10px;
    border:1px solid rgba(255,255,255,.08);
    border-radius:12px;
    padding:8px 10px;
    background: var(--tk-pill-bg);
    max-width: calc(50% - 10px);
  }
  #tkScoreDock .dot{
    flex:0 0 auto;
    width:28px;height:28px;
    display:grid;place-items:center;
    border-radius:999px;
    font-weight:800;
    color:#071018;
    background: var(--c, #93c5fd);
    box-shadow: inset 0 0 0 2px rgba(0,0,0,.25);
  }
  #tkScoreDock .tk-pill[data-n="0"] .dot{ --c:#60a5fa; }
  #tkScoreDock .tk-pill[data-n="1"] .dot{ --c:#ef4444; }
  #tkScoreDock .tk-pill[data-n="2"] .dot{ --c:#f59e0b; }
  #tkScoreDock .tk-pill[data-n="3"] .dot{ --c:#10b981; }
  #tkScoreDock .tk-pill[data-n="4"] .dot{ --c:#22c55e; }
  #tkScoreDock .tk-pill[data-n="5"] .dot{ --c:#84cc16; }

  #tkScoreDock .t1{font-size:13px;font-weight:700;line-height:1.15;}
  #tkScoreDock .t2{font-size:12px;opacity:.85;line-height:1.15;}

  @media (max-width: 1100px){
    #tkScoreDock{
      position:relative;
      right:auto; top:auto;
      width:auto; margin:12px 0 0 0;
    }
    #tkScoreDock .tk-pill{ max-width:100%; }
  }

  .tk-hide-legacy-score{ display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function buildScoreDock() {
    const dock = document.createElement('aside');
    dock.id = 'tkScoreDock';
    dock.setAttribute('role', 'note');
    dock.innerHTML = `
      <h3 class="tk-h3">How to score</h3>
      <ul class="tk-row">
        ${SCORE_ITEMS.map(
          (item) => `
            <li class="tk-pill" data-n="${item.value}">
              <span class="dot">${item.value}</span>
              <div class="txt">
                <div class="t1">${item.title}</div>
                <div class="t2">${item.detail}</div>
              </div>
            </li>
          `
        ).join('')}
      </ul>`;
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
    let dock = questionCard.querySelector('#tkScoreDock');
    if (!dock) {
      dock = buildScoreDock();
      questionCard.appendChild(dock);
    }
    hideLegacyScoreBlocks(questionCard);
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
