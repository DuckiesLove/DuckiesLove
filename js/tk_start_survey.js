// --- One-time scaffold if containers are missing ---
(function tkScaffold(){
  const app = document.getElementById('tk-app') || (()=>{
    const m = document.createElement('main');
    m.id = 'tk-app'; m.className = 'tk-app';
    document.body.prepend(m); return m;
  })();

  // Left categories
  if (!document.getElementById('tk-categories')) {
    const left = document.createElement('aside');
    left.id = 'tk-categories';
    left.className = 'tk-left tk-card';
    left.innerHTML = `
      <h3>Categories</h3>
      <div id="tk-cat-list" role="listbox" aria-multiselectable="true">Loading…</div>
    `;
    app.appendChild(left);
  }

  // Center landing + question
  if (!document.getElementById('tk-landing') || !document.getElementById('question-panel')) {
    const center = document.createElement('section');
    center.className = 'tk-center';
    center.innerHTML = `
      <section id="tk-landing" class="tk-card">
        <h2 style="margin-top:0;">TalkKink Survey</h2>
        <div class="tk-actions">
          <button id="btnStart" type="button">Start Survey</button>
          <a href="#" id="btnAnalysis">Individual Kink Analysis</a>
          <a href="#" id="btnCompat">Compatibility Page</a>
        </div>
      </section>
      <section id="question-panel" class="tk-qcard tk-card" hidden></section>
    `;
    app.appendChild(center);
  }

  // Right score guide
  if (!document.getElementById('tk-right')) {
    const right = document.createElement('aside');
    right.id = 'tk-right';
    right.className = 'tk-right';
    right.hidden = true;
    right.innerHTML = `
      <section class="tk-guide tk-card how-to-score" id="tk-guide">
        <h3>How to score</h3>
        <ul class="legend">
          <li><b>0</b> — Brain did a cartwheel (skip for now)</li>
          <li><b>1</b> — Hard Limit (no-go)</li>
          <li><b>2</b> — Soft Limit (willing to try…)</li>
          <li><b>3</b> — Curious / context-dependent</li>
          <li><b>4</b> — Comfortable / enjoy</li>
          <li><b>5</b> — Favorite / enthusiastic yes</li>
        </ul>
        <div class="tk-ratingbox">
          <div class="tk-label">Rate interest/comfort (0–5)</div>
          <div class="tk-grid" id="tk-scale-sidebar" data-group="rating-A"></div>
        </div>
      </section>
    `;
    app.appendChild(right);
  }
})();

// --- Load categories (uses your /data/kinks.json) ---
async function tkLoadCategories(){
  const list = document.getElementById('tk-cat-list');
  if (!list) return;
  list.textContent = 'Loading…';
  try{
    const res = await fetch('/data/kinks.json', { cache: 'no-store' });
    const data = await res.json();
    let cats = [];
    if (Array.isArray(data)) cats = data.map(x => x?.name || x?.title || x?.category || String(x));
    else if (Array.isArray(data?.categories)) cats = data.categories.map(x => x?.name || x?.title || x?.category || String(x));
    else if (data && typeof data === 'object') cats = Object.keys(data);
    cats = cats.filter(Boolean).sort((a,b)=>a.localeCompare(b));
    list.innerHTML = cats.map((c,i)=>`<label class="tk-cat"><input type="checkbox" id="cat_${i}"><span>${c}</span></label>`).join('');
    console.log(`✅ Categories loaded (${cats.length})`);
  }catch(e){
    console.error('[Categories] load error', e);
    list.textContent = 'Failed to load categories.';
  }
}

// --- Rating scale + question render ---
function tkMakeScale(el, group='rating-A'){
  if(!el) return;
  el.dataset.group = group; el.innerHTML = '';
  for(let i=0;i<=5;i++){
    const b = document.createElement('button');
    b.className = 'tk-opt'; b.type='button'; b.dataset.value=String(i);
    b.textContent = String(i); b.setAttribute('aria-pressed','false');
    el.appendChild(b);
  }
}
function tkRenderQuestionCard(){
  const panel = document.getElementById('question-panel');
  panel.hidden = false;
  panel.innerHTML = `
    <div class="tk-path">Appearance Play • Choosing My Partner S</div>
    <h2 class="tk-title">Giving: Rate interest/comfort (0–5)</h2>
    <div class="tk-label">Rate interest/comfort (0–5)</div>
    <div id="tk-guard" aria-live="polite"></div>
    <div id="tk-scale" data-group="rating-A"></div>
  `;
  tkMakeScale(document.getElementById('tk-scale'), 'rating-A');
  tkMakeScale(document.getElementById('tk-scale-sidebar'), 'rating-A');
  document.getElementById('tk-right').hidden = false;
}

// --- Click sync once ---
if (!window.__tkClicksBound){
  window.__tkClicksBound = true;
  (document.getElementById('tk-app') || document.body).addEventListener('click', (e)=>{
    const btn = e.target.closest('button.tk-opt'); if(!btn) return;
    const group = btn.closest('[data-group]')?.dataset.group || 'rating-A';
    const value = btn.dataset.value ?? btn.textContent.trim();
    document.querySelectorAll(`[data-group="${group}"] button.tk-opt`).forEach(b=>{
      const on = b.dataset.value === value;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const guard = document.getElementById('tk-guard');
    if (guard) guard.textContent = `Selected ${value} of 5`;
  });
}

// --- Start survey + wiring ---
window.startSurvey = function(){
  document.getElementById('tk-landing')?.setAttribute('hidden','hidden');
  tkRenderQuestionCard();
};
function tkBindStartButton(){
  const btn = document.getElementById('btnStart');
  if (!btn || btn.__tkBound) return;
  btn.__tkBound = true;
  btn.addEventListener('click', (e)=>{ e.preventDefault(); window.startSurvey(); });
}
tkBindStartButton();

// Run on load
document.addEventListener('DOMContentLoaded', ()=>{
  tkLoadCategories();
  tkBindStartButton();
  // quick test: autostart with ?autostart
  if (new URLSearchParams(location.search).has('autostart')) window.startSurvey();
});
