/* TALK KINK — startSurvey wiring + render helpers (JS-ONLY VERSION) */

/* Provide minimal renderers if not already present */
(function ensureTKRenderers(){
  if (typeof window.tkRenderQuestionCard === 'function') return;

  window.tkRenderQuestionCard = function ({category='Appearance Play', prompt='Choosing My Partner S', role='Giving'} = {}) {
    const qpanel = document.getElementById('question-panel');
    if (!qpanel) return;

    qpanel.innerHTML = `
      <article class="question-card">
        <header class="q-head">
          <div class="q-path">${category} • ${prompt}</div>
          <h2 class="q-title">${role}: Rate interest/comfort (0–5)</h2>
        </header>
        <div id="ratingRow" class="single">
          <div class="col">
            <div class="label">Rate interest/comfort (0–5)</div>
            <div id="tk-guard" aria-live="polite"></div>
            <div id="tk-scale" data-group="rating-A"></div>
            <div class="scoreRow" data-partner="A" data-group="rating-A"></div>
          </div>
        </div>
        <!-- inline guide is hidden by CSS if present -->
        <section class="how-to-score how-to-score--inline" style="display:none"></section>
      </article>
    `;

    // build 0–5 grids (center + right)
    function makeScaleButtons(el, group='rating-A'){
      if(!el) return;
      el.dataset.group = group;
      el.innerHTML = '';
      for(let i=0;i<=5;i++){
        const b=document.createElement('button');
        b.className='option'; b.type='button'; b.dataset.value=String(i);
        b.textContent=String(i); b.setAttribute('aria-pressed','false');
        el.appendChild(b);
      }
    }
    makeScaleButtons(document.getElementById('tk-scale'), 'rating-A');
    makeScaleButtons(document.getElementById('tk-scale-sidebar'), 'rating-A');
  };

  // delegated click handler (syncs both grids)
  if (!window.__tkBound) {
    window.__tkBound = true;
    const root = document.querySelector('.survey-root') || document.body;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.option');
      if (!btn) return;
      if (!btn.type || btn.type.toLowerCase()==='submit') btn.type='button';
      const group = btn.closest('[data-group]'); if (!group) return;
      const key = group.dataset.group || 'default';
      const value = btn.dataset.value ?? btn.value ?? btn.textContent.trim();
      document.querySelectorAll(`[data-group="${key}"] button.option`).forEach(b=>{
        const on = b.dataset.value===value;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-pressed', on?'true':'false');
      });
      const guard = document.getElementById('tk-guard');
      if (guard) guard.textContent = `Selected ${value} of 5`;
      console.log('[Survey Selected]', { group: key, value });
    });
  }
})();

/* Start Survey + wiring */
function startSurvey(){
  console.log('Starting TalkKink Survey…');
  const landing = document.getElementById('tk-landing');
  landing && (landing.style.display='none');
  const app = document.getElementById('tk-app');
  app && app.removeAttribute('hidden');

  // ensure right-side compact grid exists
  if (!document.getElementById('tk-scale-sidebar')) {
    const guide = document.getElementById('tk-score-guide') || document.querySelector('.score-sidebar');
    if (guide) {
      const box = document.createElement('div');
      box.className='rating-box';
      box.innerHTML = `
        <div class="label">Rate interest/comfort (0–5)</div>
        <div class="rating-grid" id="tk-scale-sidebar" data-group="rating-A"></div>
      `;
      guide.appendChild(box);
    }
  }

  // render first question
  if (typeof tkRenderQuestionCard === 'function') {
    tkRenderQuestionCard({ category:'Appearance Play', prompt:'Choosing My Partner S', role:'Giving' });
  }
}

/* Bind Start button and optional autostart */
(function wireStart(){
  const hook = () => {
    const btn = document.querySelector('#btnStart, button[data-action="start"], a[data-action="start"]');
    if (btn && !btn.__tkWired) { btn.__tkWired = true; btn.addEventListener('click', e=>{ e.preventDefault(); startSurvey(); }); }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hook, { once:true });
  } else {
    hook();
  }

  if (new URLSearchParams(location.search).has('autostart')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startSurvey, { once:true });
    } else {
      startSurvey();
    }
  }
})();
