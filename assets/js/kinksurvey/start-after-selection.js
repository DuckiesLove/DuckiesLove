(() => {
  const onKinkSurvey = location.pathname.replace(/\/+$/,'') === '/kinksurvey';
  if (!onKinkSurvey) return;

  // ---- CSS: hide score areas pre-start; helper + CTA styles ----
  const css = `
    /* Hide ANY score rail/dock until Start Survey */
    body.tk-prestart #tkScoreDock,
    body.tk-prestart .tk-score-aside,
    body.tk-prestart .score-sidebar,
    body.tk-prestart [data-sticky="score"]{
      display:none !important;
    }
    /* Helper panel look */
    #tk-select-helper.tk-pane{
      margin:16px auto; max-width:880px; padding:18px 20px;
      border-radius:18px; border:1px solid rgba(255,255,255,.10);
      background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.01)) rgba(13,17,23,.82);
      box-shadow:inset 0 0 0 1px rgba(0,170,255,.15),0 8px 22px rgba(0,0,0,.35),0 0 28px rgba(0,170,255,.10);
    }
    #tk-select-helper h3{margin:0 0 8px 0}
    /* Start button */
    #tkStartBtn{
      display:inline-flex; align-items:center; justify-content:center;
      height:38px; padding:8px 14px; border-radius:999px; cursor:pointer;
      border:1px solid rgba(255,255,255,.10); background:#121821; color:#eaf3ff;
      font-weight:700; letter-spacing:.2px; outline:2px solid color-mix(in oklab, var(--accent, #4da3ff) 65%, transparent);
      box-shadow:0 0 0 1px rgba(0,0,0,.35) inset, 0 0 12px color-mix(in oklab, var(--accent, #4da3ff) 45%, transparent);
      transition:transform .12s ease, box-shadow .12s ease, background .12s ease, opacity .12s ease;
      margin-top:12px;
    }
    #tkStartBtn:hover:enabled{ transform:translateY(-1px); }
    #tkStartBtn:disabled{ opacity:.55; cursor:not-allowed; box-shadow:none; outline-color:transparent; }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---- small DOM helpers ----
  const $  = (s,sc=document)=>sc.querySelector(s);
  const $$ = (s,sc=document)=>Array.from(sc.querySelectorAll(s));

  const TK = (window.TK ||= {}); TK.state ||= { started:false, selectedGroups:[] };

  // Keep body in "prestart" until user clicks Start Survey
  document.documentElement.classList.add('theme-dark'); // keep colors consistent
  document.body.classList.add('tk-prestart');

  // ---------- LEFT PANEL ----------
  function ensureLeftPanel(){
    let panel = $('#categoryPanel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id='categoryPanel';
      panel.className='tk-pane';
      panel.innerHTML = `
        <h2 class="tk-side-title">Categories</h2>
        <div class="tk-cat-count">0 selected</div>
        <ul class="tk-catlist"></ul>`;
      ( $('#tkDockLeft') || $('body') ).prepend(panel);
    }
    panel.removeAttribute('style'); // strip inline styles that cause scrollbars
    return panel;
  }

  // ---------- SELECT HELPER + CTA ----------
  function mountSelectHelper(){
    if ($('#tk-select-helper')) return;
    const box = document.createElement('div');
    box.id='tk-select-helper'; box.className='tk-pane';
    box.innerHTML = `
      <h3>Select at least one category to begin</h3>
      <div class="how-to-score" style="opacity:.9;margin-bottom:8px">How to score</div>
      <ul style="margin:.25rem 0 0 1rem; line-height:1.35; opacity:.9">
        <li><strong>0</strong> — skip for now</li>
        <li><strong>1</strong> — hard limit (no-go)</li>
        <li><strong>2</strong> — soft limit / willing to try</li>
        <li><strong>3</strong> — context-dependent</li>
        <li><strong>4</strong> — enthusiastic yes</li>
        <li><strong>5</strong> — favorite / please do</li>
      </ul>
      <button id="tkStartBtn" disabled>Start Survey</button>
    `;
    ( $('#tkDockMid') || $('main') || document.body ).prepend(box);
    $('#tkStartBtn').addEventListener('click', () => window.startSurvey());
  }
  const removeSelectHelper = () => $('#tk-select-helper')?.remove();

  // ---------- CATEGORY LIST HOOK ----------
  window.buildCategoryList = function buildCategoryList(kinks){
    const panel = ensureLeftPanel();
    const list = $('.tk-catlist', panel); list.textContent='';
    const counter = $('.tk-cat-count', panel);

    const groups = [...new Set(kinks.map(k => k.group))].sort();
    groups.forEach(g=>{
      const li = document.createElement('li');
      li.className='tk-catrow';
      li.innerHTML = `
        <label class="tk-cat">
          <input type="checkbox" data-group="${g}"><span class="tk-catname">${g}</span>
        </label>`;
      list.appendChild(li);
    });

    // absolutely no pre-check
    $$('input[type="checkbox"]', list).forEach(cb => cb.checked=false);

    // show helper + CTA
    mountSelectHelper();

    // update state / enable CTA when there is at least one selection
    list.addEventListener('change', () => {
      TK.state.selectedGroups = $$('input:checked', list).map(cb => cb.dataset.group);
      const any = TK.state.selectedGroups.length > 0;
      counter.textContent = `${TK.state.selectedGroups.length} selected`;

      const helperBtn = $('#tkStartBtn');
      if (helperBtn) helperBtn.disabled = !any;

      const navBtn = $('#btnStart');
      if (navBtn) {
        navBtn.disabled = !any;
        navBtn.title = any ? '' : 'Select at least one category to start';
        navBtn.classList.toggle('tk-disabled', !any);
        navBtn.setAttribute('aria-disabled', String(!any));
        if (!navBtn.dataset.tkStartGateBound) {
          navBtn.addEventListener('click', () => window.startSurvey());
          navBtn.dataset.tkStartGateBound = '1';
        }
      }

      // If your boot exposes pool rebuild, call it (optional)
      if (typeof TK.rebuildPool === 'function') TK.rebuildPool(TK.state.selectedGroups);
    });
  };

  // ---------- START SURVEY GATE ----------
  window.startSurvey = function startSurvey(){
    if (TK.state.started) return;
    if (TK.state.selectedGroups.length === 0) { mountSelectHelper(); return; } // keep gated
    TK.state.started = true;

    // reveal score UI from now on
    document.body.classList.remove('tk-prestart');

    // hand off to your existing starter if present
    if (typeof TK.start === 'function') TK.start();
    else if (typeof TK.begin === 'function') TK.begin();

    removeSelectHelper();
  };

  // ---------- RENDER FIRST QUESTION HOOK ----------
  window.renderFirstQuestion = function renderFirstQuestion(){
    const host = $('#tk-question-host') || $('#tkDockMid') || $('main') || document.body;
    const card = $('#tk-question-card') || $('.question-card') || $('#questionCard');
    if (host && card && card.parentNode !== host) host.prepend(card);
    if (card) card.style.overflow='visible'; // avoid inner scrollbars
  };

  // boot
  (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', () => { ensureLeftPanel(); mountSelectHelper(); }, {once:true})
    : (ensureLeftPanel(), mountSelectHelper());
})();
