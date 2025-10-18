// === TalkKink Survey UI Bootstrap (Final Stable Version) ===
console.log('TK init v2025-10-17-4');

// 🔹 1. Auto-create structure if missing
(function setupLayout() {
  const app = document.getElementById('tk-app') || (() => {
    const m = document.createElement('main');
    m.id = 'tk-app';
    m.className = 'tk-app grid-layout';
    document.body.prepend(m);
    return m;
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

  // Center content
  if (!document.getElementById('tk-landing')) {
    const center = document.createElement('section');
    center.className = 'tk-center';
    center.innerHTML = `
      <section id="tk-landing" class="tk-card">
        <h2>TalkKink Survey</h2>
        <div class="tk-actions">
          <button id="btnStart" type="button" class="tk-button">Start Survey</button>
          <a href="#" id="btnAnalysis" class="tk-button secondary">Individual Kink Analysis</a>
          <a href="#" id="btnCompat" class="tk-button secondary">Compatibility Page</a>
        </div>
      </section>
      <section id="question-panel" class="tk-qcard tk-card" hidden></section>
    `;
    app.appendChild(center);
  }

  // Right scoring guide
  if (!document.getElementById('tk-right')) {
    const right = document.createElement('aside');
    right.id = 'tk-right';
    right.className = 'tk-right tk-card';
    right.hidden = true;
    right.innerHTML = `
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
    `;
    app.appendChild(right);
  }
})();

// 🔹 2. Load category data
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
    list.innerHTML = cats
      .map((c, i) => `<label class="tk-cat"><input type="checkbox" id="cat_${i}"><span>${c}</span></label>`)
      .join('');
    console.log(`✅ Categories loaded (${cats.length})`);
  } catch (err) {
    console.error('❌ Failed to load categories', err);
    list.textContent = 'Error loading categories.';
  }
}

// 🔹 3. Rating scale generator
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

// 🔹 4. Question card renderer
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

// 🔹 5. Rating button behavior
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

// 🔹 6. Guard the question panel from being cleared or hidden
if (!window.__tkQuestionPanelGuard) {
  window.__tkQuestionPanelGuard = true;
  const observer = new MutationObserver(() => {
    const qp = document.getElementById('question-panel');
    if (!qp) return;
    if (qp.hidden) {
      console.warn('[TK] question panel hidden — restoring…');
      qp.hidden = false;
    }
    if (!qp.innerHTML.trim()) {
      console.warn('[TK] question panel cleared — restoring…');
      qp.innerHTML = '<div>Loading question...</div>';
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
}

// 🔹 7. Start button + autostart logic
window.startSurvey = function() {
  document.getElementById('tk-landing')?.setAttribute('hidden', 'hidden');
  tkRenderQuestionCard();
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready — init TalkKink');
  tkLoadCategories();
  document.getElementById('btnStart')?.addEventListener('click', e => {
    e.preventDefault();
    startSurvey();
  });
  if (new URLSearchParams(location.search).has('autostart')) startSurvey();
});
