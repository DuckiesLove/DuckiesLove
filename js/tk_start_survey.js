// === TalkKink Survey Final Init ===
console.log('TK init v2025-10-17-3');

// --- Ensure containers exist ---
(function ensureLayout() {
  const app = document.getElementById('tk-app') || (() => {
    const main = document.createElement('main');
    main.id = 'tk-app';
    main.className = 'tk-app';
    document.body.prepend(main);
    return main;
  })();

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

  if (!document.getElementById('tk-landing')) {
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

// --- Load categories from JSON ---
async function tkLoadCategories() {
  const list = document.getElementById('tk-cat-list');
  if (!list) return;
  list.textContent = 'Loading…';
  try {
    const res = await fetch('/data/kinks.json', { cache: 'no-store' });
    const data = await res.json();
    let cats = [];
    if (Array.isArray(data)) cats = data.map(x => x.name || x.title || x.category || String(x));
    else if (Array.isArray(data?.categories)) cats = data.categories.map(x => x.name || x.title || x.category || String(x));
    else if (typeof data === 'object') cats = Object.keys(data);
    cats = cats.filter(Boolean).sort((a, b) => a.localeCompare(b));
    list.innerHTML = cats.map((c, i) => `<label class="tk-cat"><input type="checkbox" id="cat_${i}"><span>${c}</span></label>`).join('');
    console.log(`✅ Categories loaded (${cats.length})`);
  } catch (err) {
    console.error('❌ Failed to load categories', err);
    list.textContent = 'Error loading categories';
  }
}

// --- Build rating scale ---
function tkMakeScale(container, group = 'rating-A') {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i <= 5; i++) {
    const b = document.createElement('button');
    b.className = 'tk-opt';
    b.type = 'button';
    b.dataset.group = group;
    b.dataset.value = i;
    b.textContent = i;
    b.setAttribute('aria-pressed', 'false');
    container.appendChild(b);
  }
}

// --- Question card renderer ---
function tkRenderQuestionCard() {
  const panel = document.getElementById('question-panel');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `
    <div class="tk-path">Appearance Play • Choosing My Partner</div>
    <h2 class="tk-title">Giving: Rate interest/comfort (0–5)</h2>
    <div class="tk-label">Rate interest/comfort (0–5)</div>
    <div id="tk-guard" aria-live="polite"></div>
    <div id="tk-scale" data-group="rating-A"></div>
  `;
  tkMakeScale(document.getElementById('tk-scale'), 'rating-A');
  tkMakeScale(document.getElementById('tk-scale-sidebar'), 'rating-A');
  document.getElementById('tk-right').hidden = false;
}

// --- Rating sync ---
if (!window.__tkBound) {
  window.__tkBound = true;
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('button.tk-opt');
    if (!btn) return;
    const group = btn.dataset.group;
    const value = btn.dataset.value;
    document.querySelectorAll(`[data-group="${group}"] button.tk-opt`).forEach(b => {
      const on = b.dataset.value === value;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const guard = document.getElementById('tk-guard');
    if (guard) guard.textContent = `Selected ${value} of 5`;
  });
}

// --- Start survey + wiring ---
window.startSurvey = function() {
  console.log('✅ startSurvey triggered');
  document.getElementById('tk-landing')?.setAttribute('hidden', 'hidden');
  tkRenderQuestionCard();
};

// --- DOM ready: load categories + autostart ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready — init TalkKink');
  tkLoadCategories();
  document.getElementById('btnStart')?.addEventListener('click', e => {
    e.preventDefault();
    startSurvey();
  });
  if (new URLSearchParams(location.search).has('autostart')) startSurvey();
});
