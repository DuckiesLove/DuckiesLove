/* === TALK KINK SURVEY START + RENDER FIX === */

// ensure the function exists globally
window.startSurvey = function () {
  console.log('✅ startSurvey triggered');

  // hide landing screen
  const landing = document.querySelector('#tk-landing') || document.querySelector('.landing');
  if (landing) landing.style.display = 'none';

  // show the main app container
  const app = document.querySelector('#tk-app') || document.querySelector('.survey-root');
  if (app) app.removeAttribute('hidden');

  // ensure question panel exists
  let qpanel = document.querySelector('#question-panel');
  if (!qpanel) {
    qpanel = document.createElement('div');
    qpanel.id = 'question-panel';
    document.body.appendChild(qpanel);
  }

  // render question card
  qpanel.innerHTML = `
    <article class="question-card">
      <header class="q-head">
        <div class="q-path">Appearance Play • Choosing My Partner S</div>
        <h2 class="q-title">Giving — Rate interest/comfort (0–5)</h2>
      </header>

      <div id="ratingRow" class="single">
        <div class="col">
          <div class="label">Rate interest/comfort (0–5)</div>
          <div id="tk-guard" aria-live="polite"></div>
          <div id="tk-scale" data-group="rating-A"></div>
          <div class="scoreRow" data-partner="A" data-group="rating-A"></div>
        </div>
      </div>
    </article>
  `;

  // render right-side guide (rating scale)
  let guide = document.querySelector('#tk-score-guide') || document.querySelector('.score-sidebar');
  if (!guide) {
    guide = document.createElement('aside');
    guide.id = 'tk-score-guide';
    guide.className = 'score-sidebar';
    document.body.appendChild(guide);
  }

  guide.innerHTML = `
    <h3 class="label">How to Score</h3>
    <div id="tk-scale-sidebar" data-group="rating-A" class="rating-grid"></div>
  `;

  // make scales interactive (sync both sides)
  function makeScale(el, group) {
    if (!el) return;
    el.dataset.group = group;
    el.innerHTML = '';
    for (let i = 0; i <= 5; i++) {
      const b = document.createElement('button');
      b.className = 'option';
      b.dataset.value = i;
      b.textContent = i;
      el.appendChild(b);
    }
  }

  makeScale(document.querySelector('#tk-scale'), 'rating-A');
  makeScale(document.querySelector('#tk-scale-sidebar'), 'rating-A');

  if (!window.__tkScaleBound) {
    window.__tkScaleBound = true;
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('button.option');
      if (!btn) return;
      const value = btn.dataset.value;
      const group = btn.closest('[data-group]')?.dataset.group || 'rating-A';

      document.querySelectorAll(`[data-group="${group}"] button.option`).forEach((b) => {
        b.classList.toggle('selected', b.dataset.value === value);
      });
      const guard = document.getElementById('tk-guard');
      if (guard) guard.textContent = `Selected ${value}`;
    });
  }
};

// wire Start Survey button(s)
(function bindStartButtons() {
  const tryBind = () => {
    const selectorList = [
      '#btnStart',
      "[data-action='start']",
      '.start-survey',
      '#startSurvey',
      '#startSurveyBtn',
      '#start'
    ];
    const legacy = Array.from(document.querySelectorAll('button, a'))
      .filter((el) => /start survey/i.test(el.textContent || ''));
    selectorList.forEach((sel) => legacy.push(...document.querySelectorAll(sel)));
    new Set(legacy).forEach((btn) => {
      if (!btn.__tkBound) {
        btn.__tkBound = true;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          window.startSurvey();
        });
      }
    });
  };

  // Run on load and whenever DOM changes
  const bindObserver = () => {
    tryBind();
    if (!document.body) return;
    if (window.__tkBindObserver) return;
    window.__tkBindObserver = new MutationObserver(tryBind);
    window.__tkBindObserver.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindObserver, { once: true });
  } else {
    bindObserver();
  }

  // optional ?autostart
  if (new URLSearchParams(location.search).has('autostart')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', window.startSurvey);
    } else {
      window.startSurvey();
    }
  }
})();
