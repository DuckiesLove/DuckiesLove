if (localStorage.getItem('__TK_DISABLE_OVERLAY') === '1') {
  console.info('[TK] Overlay bootstrap skipped');
  window.TK_PANEL_OPTS = Object.assign(
    { overlay: false, drawer: false, locked: false },
    window.TK_PANEL_OPTS || {}
  );
}

(() => {
  const DATA_URL = new URL('data/kinks.json', document.baseURI).toString();
  const STORAGE_KEY = '__TK_SELECTED_CATEGORIES';
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  window.__TK_SCORE_RAIL_READY__ = false;

  let data=null, role='Giving', idx=0, flat=[];
  let storedSelection = new Set();
  const scores = {A:{}};

  const SCORE_GUIDE = Object.freeze([
    {
      value: 0,
      dot: 'blue',
      title: 'Brain did a cartwheel',
      detail: 'skipped for now 🥲',
    },
    {
      value: 1,
      dot: 'red',
      title: 'Hard Limit',
      detail: 'full stop / no-go (non-negotiable)',
    },
    {
      value: 2,
      dot: 'yellow',
      title: 'Soft Limit — willing to try',
      detail: 'strong boundaries, safety checks, aftercare planned',
    },
    {
      value: 3,
      dot: 'green',
      title: 'Curious / context-dependent',
      detail: 'okay with discussion, mood & trust; needs clear negotiation',
    },
    {
      value: 4,
      dot: 'green',
      title: 'Comfortable / enjoy',
      detail: 'generally a yes; normal precautions & check-ins',
    },
    {
      value: 5,
      dot: 'green',
      title: 'Favorite / enthusiastic yes',
      detail: 'happily into it; green light',
    },
  ]);

  function renderGuardSmall(root){
    if(!root) return;
    root.innerHTML = `
      <div class="tk-guard-title">How to score</div>
      ${SCORE_GUIDE.map((row) => `
        <div class="tk-row">
          <span class="dot ${row.dot}">${row.value}</span>
          <div>
            <div style="font-weight:700">${row.value} — ${row.title}</div>
            <div style="opacity:.85">${row.detail}</div>
          </div>
        </div>
      `).join('')}
    `;
  }

  function buildScoreDock(){
    const dock = document.createElement('aside');
    dock.id = 'tkScoreDock';
    dock.setAttribute('role', 'note');
    dock.innerHTML = `
      <h3 class="tk-h3">How to score</h3>
      <ul class="tk-row">
        ${SCORE_GUIDE.map(
          (row) => `
            <li class="tk-pill" data-n="${row.value}">
              <span class="dot">${row.value}</span>
              <div class="txt">
                <div class="t1">${row.title}</div>
                <div class="t2">${row.detail}</div>
              </div>
            </li>
          `
        ).join('')}
      </ul>
    `;
    return dock;
  }

  function hideLegacyScoreBlocks(context){
    if (!context) return;
    const legacy = context.querySelector('#tk-guard');
    if (legacy){
      legacy.classList.add('tk-hide-legacy-score');
      legacy.setAttribute('aria-hidden', 'true');
    }
  }

  function ensureScoreDock(questionCard){
    if (!questionCard) return;
    let dock = questionCard.querySelector('#tkScoreDock');
    if (!dock){
      dock = buildScoreDock();
      questionCard.appendChild(dock);
    }
    hideLegacyScoreBlocks(questionCard);
  }

  const SCORE_PANEL_TITLE_REGEX = /rate\s+interest\/?comfort\s*\(0\s*[-–]\s*5\)/i;

  function normalizeText(str){
    return typeof str === 'string' ? str.replace(/\s+/g, ' ').trim().toLowerCase() : '';
  }

  function isScorePanel(el){
    if (!el) return false;

    if (el.classList?.contains('tk-legend') || el.classList?.contains('how-to-score')) {
      return true;
    }

    const txt = normalizeText(el.textContent);
    if (!txt.includes('how to score')) return false;
    return txt.includes('question guard') || txt.includes('brain did a cartwheel') || txt.includes('hard limit');
  }

  function findAllScorePanels(){
    const candidates = Array.from(document.querySelectorAll('#tk-guard, .tk-legend, .how-to-score, section, div'));
    const panels = [];

    for (const el of candidates){
      if (!isScorePanel(el)) continue;

      if (el.classList && el.classList.contains('how-to-score-bottom')){
        if (typeof el.remove === 'function') el.remove();
        continue;
      }

      panels.push(el);
    }

    return panels;
  }

  function findQuestionCard(){
    const explicit = document.querySelector('#question-panel .question-card, #questionCard');
    if (explicit) return explicit;

    const headings = Array.from(document.querySelectorAll('h1,h2,h3,header,.tk-title,.title'));
    const hit = headings.find(h => SCORE_PANEL_TITLE_REGEX.test(h.textContent || ''));
    if (!hit) return null;

    let node = hit.closest('section,article,div');
    if (node && node.offsetHeight < 80 && node.parentElement) node = node.parentElement;
    return node;
  }

  function chooseKeptPanel(panels){
    if (!panels.length) return { kept: null, removed: [] };
    let kept = panels[0];
    for (const panel of panels){
      if ((panel.offsetWidth || 0) > (kept.offsetWidth || 0)) kept = panel;
    }
    const removed = [];
    for (const panel of panels){
      if (panel !== kept && panel.parentNode){
        panel.parentNode.removeChild(panel);
        removed.push(panel);
      }
    }
    return { kept, removed };
  }

  const findScoreSidebar = () =>
    document.querySelector('[data-sticky="score"]') ||
    document.querySelector('.score-sidebar');

  const removeDuplicateScoreCards = () => {
    const sidebar = findScoreSidebar();
    const selector = '.how-to-score, .tk-legend';
    let keep = sidebar ? sidebar.querySelector(selector) : null;

    document.querySelectorAll(selector).forEach((card) => {
      const inSidebar = sidebar ? sidebar.contains(card) : false;

      if (!sidebar) {
        if (!keep) {
          keep = card;
        } else if (card !== keep) {
          card.remove();
        }
        return;
      }

      if (!keep && inSidebar) {
        keep = card;
        return;
      }

      if (!inSidebar || card !== keep) {
        card.remove();
      }
    });
  };

  window.removeDuplicateScoreCards = removeDuplicateScoreCards;

  function renameScoreTitle(panel){
    if (!panel) return;
    const replacer = (s) => s
      .replace(/question\s*guard\s*(?:[•\-–]\s*)?/i, '')
      .replace(/how\s*to\s*score/i, 'How to score')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const titleNode = panel.querySelector('h1,h2,h3,.tk-score-title,.tk-guard-title,.title,strong,header');
    if (titleNode && titleNode.childNodes.length === 1 && titleNode.firstChild?.nodeType === Node.TEXT_NODE){
      titleNode.textContent = replacer(titleNode.textContent || '');
      return;
    }

    if (!panel.querySelector('.tk-score-title')){
      const heading = document.createElement('div');
      heading.className = 'tk-score-title';
      heading.textContent = 'How to score';
      panel.insertBefore(heading, panel.firstChild);
    }
  }

  function movePanelNearQuestion(panel, questionCard){
    if (!panel || !questionCard) return;

    const sidebar = findScoreSidebar();
    if (sidebar){
      if (!sidebar.contains(panel)){
        sidebar.appendChild(panel);
      }
      return;
    }

    const insideCard = questionCard.contains(panel);
    if (insideCard){
      if (panel.parentElement !== questionCard){
        questionCard.appendChild(panel);
      } else if (panel !== questionCard.lastElementChild){
        questionCard.appendChild(panel);
      }
      return;
    }

    const parent = questionCard.parentElement || document.querySelector('main') || document.body;
    const next = questionCard.nextSibling;
    if (panel.parentElement !== parent || panel.previousElementSibling !== questionCard){
      parent.insertBefore(panel, next);
    }
  }

  function applyScorePanelLayoutFix(){
    const questionCard = findQuestionCard();
    const panels = findAllScorePanels();
    if (!questionCard || !panels.length) return;

    const { kept } = chooseKeptPanel(panels);
    renameScoreTitle(kept);
    movePanelNearQuestion(kept, questionCard);
    removeDuplicateScoreCards();
  }

  function renderScale(root, onPick, selectedValue){
    if(!root) return null;
    const wrap = document.createElement('div');
    wrap.className = 'tk-scale-buttons';
    const buttons = [];

    [0,1,2,3,4,5].forEach(n=>{
      const btn = document.createElement('button');
      btn.type='button';
      btn.textContent=String(n);
      btn.className='tk-scale-btn';
      btn.dataset.value = String(n);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', ()=>{
        api.select(n);
        if (typeof onPick === 'function') {
          onPick(n);
        }
      });
      wrap.appendChild(btn);
      buttons.push(btn);
    });

    root.innerHTML = '';
    root.appendChild(wrap);

    const api = {
      select(value){
        const numeric = Number(value);
        const valid = Number.isFinite(numeric);
        buttons.forEach(btn=>{
          const btnValue = Number(btn.dataset.value);
          const isActive = valid && btnValue === numeric;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-pressed', String(isActive));
        });
      }
    };

    api.select(selectedValue);
    return api;
  }

  // ---- Theme handling ----
  const THEME_KEY  = '__TK_THEME';

  function applyTheme(t){
    if(!t) return;
    document.documentElement.className = `theme-${t}`;
    localStorage.setItem(THEME_KEY, t);
    // visual active state
    $$('#themeControls .theme-btn').forEach(b=>b.classList.toggle('is-active', b.dataset.theme===t));
  }
  // restore saved settings
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  // click handlers
  $('#themeControls')?.addEventListener('click', (e)=>{
    const t = e.target?.dataset?.theme;
    if(t){ applyTheme(t); }
  });

  const progressBar = $('#progressBar');
  const progressPct = $('#progressPct');
  const categoryPanel = $('#categoryPanel');

  function ensureQuestionPanel(){
    const area = document.getElementById('questionArea') || document.querySelector('.survey-center');
    let panel = document.getElementById('question-panel');
    if (!panel){
      panel = document.createElement('section');
      panel.id = 'question-panel';
      panel.className = 'survey-question-panel';
      const navRow = document.getElementById('navRow');
      if (area){
        area.insertBefore(panel, navRow || null);
      }
    }
    return panel;
  }

  function ensureQuestionRoot(){
    const area = document.getElementById('questionArea') || document.querySelector('.survey-center') || document.getElementById('surveyApp') || document.body;
    if (!area) return null;
    let root = document.getElementById('tkQuestionRoot');
    if (!root){
      root = document.createElement('section');
      root.id = 'tkQuestionRoot';
      root.className = 'survey-question-panel';
      const navRow = document.getElementById('navRow');
      if (navRow && navRow.parentElement === area){
        area.insertBefore(root, navRow);
      } else if (navRow && area.contains(navRow)){ 
        area.insertBefore(root, navRow);
      } else {
        area.appendChild(root);
      }
    }
    const legacyPanel = ensureQuestionPanel();
    if (legacyPanel){
      legacyPanel.setAttribute('hidden', 'hidden');
    }
    return root;
  }

  categoryPanel?.addEventListener('scroll', updatePanelShadows);

  (() => {
    const area = document.getElementById('questionArea');
    if (!area) return;
    ensureQuestionRoot();
    const mo = new MutationObserver(() => {
      const root = ensureQuestionRoot();
      if (root && flat.length && !root.querySelector('.question-card')){
        paint();
      }
    });
    mo.observe(area, { childList: true });
  })();

  async function loadData(){
    const url = `${DATA_URL}?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to load ${url}: ${res.status}`);
    }
    const json = await res.json();
    data = normalize(json);
  }

  function restoreSelection(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(raw)) {
        storedSelection = new Set(
          raw
            .map((value) => (typeof value === 'string' ? value : ''))
            .filter(Boolean)
        );
      } else {
        storedSelection = new Set();
      }
    } catch {
      storedSelection = new Set();
    }
  }

  function persistSelection(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...storedSelection]));
    } catch (err) {
      console.warn('[TK] Failed to persist category selection', err);
    }
  }

  function ensureAtLeastOneCategory(){
    const checkboxes = $$('#categoryChecklist input[type="checkbox"]');
    if (!checkboxes.length) return;
    const hasChecked = checkboxes.some((cb) => cb.checked);
    if (!hasChecked) {
      checkboxes[0].checked = true;
    }
    storedSelection = new Set(selectedIds());
    persistSelection();
  }

  function pruneStoredSelection(validIds){
    if (!(validIds instanceof Set)) return;
    storedSelection = new Set([...storedSelection].filter((id) => validIds.has(id)));
  }

  function pruneScores(){
    const valid = new Set(flat.map((item) => item.id));
    Object.keys(scores.A).forEach((key) => {
      if (!valid.has(key)) {
        delete scores.A[key];
      }
    });
  }

  function handleCategoryChange(){
    if (!data) return;
    storedSelection = new Set(selectedIds());
    persistSelection();
    updateStartEnabled();
    rebuildQuestionList();
    pruneScores();
    idx = 0;
    paint();
    progress();
    updatePanelShadows();
    emitSelection();
  }

  function unhideSurveyChrome(){
    document
      .querySelectorAll('.question-card.is-hidden, .score-rail.is-hidden')
      .forEach((el) => el.classList.remove('is-hidden'));
  }

  async function initSurvey(){
    try {
      await loadData();
      restoreSelection();
      buildCategoryPanel();
      ensureAtLeastOneCategory();
      handleCategoryChange();
    } catch (err) {
      console.error('[TK] Failed to initialize survey', err);
    } finally {
      window.__TK_SCORE_RAIL_READY__ = true;
      unhideSurveyChrome();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSurvey, { once: true });
  } else {
    initSurvey();
  }

  const safeClone = (value) => {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (err) {
        console.warn('[TK] structuredClone failed, falling back to JSON clone', err);
      }
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      console.warn('[TK] JSON clone failed; using source object directly', err);
      return value;
    }
  };

  function normalize(json){
    const c = safeClone(json);
    const collator = new Intl.Collator('en', { sensitivity: 'base' });

    for(const cat of c.categories||[]){
      const name = tidy(cat.name ?? cat.category ?? '');
      cat.name = name;
      if(typeof cat.category === 'string') cat.category = tidy(cat.category);
      for (const it of cat.items||[]){
        it.label = tidy(it.label);
      }
    }

    c.categories?.sort((a, b) => collator.compare(a.name, b.name));
    return c;

    function tidy(s=''){ return String(s).replace(/\bCB\b:?/gi,'').replace(/\s{2,}/g,' ').trim(); }
  }

  function buildCategoryPanel(){
    const host = $('#categoryChecklist');
    if(!host || !data?.categories) return;
    const prev = storedSelection.size ? new Set(storedSelection) : new Set(selectedIds());
    const validIds = new Set();
    host.innerHTML='';
    const frag = document.createDocumentFragment();
    for(const cat of data.categories){
      const catId = makeCategoryId(cat.name);
      validIds.add(catId);
      const li = document.createElement('li'); li.className = 'tk-catrow';
      const label = document.createElement('label'); label.className = 'tk-cat';
      const input = Object.assign(document.createElement('input'), { type:'checkbox', value:catId, id:`cat-${catId}` });
      input.classList.add('tk-cat-input');
      input.dataset.cat = cat.name;
      input.checked = prev.has(catId);
      input.addEventListener('change', handleCategoryChange);
      const span = document.createElement('span'); span.className = 'tk-catname'; span.textContent = cat.name;
      label.append(input, span);
      li.appendChild(label);
      frag.appendChild(li);
    }
    host.appendChild(frag);
    pruneStoredSelection(validIds);
    storedSelection = new Set(selectedIds());
    persistSelection();
    updateSelectedCount();
    emitSelection();
  }

  function selectedIds(){
    return $$('#categoryChecklist input[type="checkbox"]:checked').map(i=>i.value);
  }

  function updateSelectedCount(){
    const n = selectedIds().length;
    const badge = $('#selectedCountBadge');
    if (badge) {
      const total = data?.categories?.length ?? 0;
      badge.textContent = `${n} selected / ${total} total`;
    }
    const count = $('#tkCatSel');
    if(count) count.textContent = String(n);
    const prestartCount = $('#prestartCount');
    if (prestartCount) prestartCount.textContent = String(n);
    const notice = $('#prestartNotice');
    if (notice) notice.classList.toggle('is-ready', n >= 1);
  }

  function updateStartEnabled(){
    const n = selectedIds().length;
    updateSelectedCount();
    const btn = $('#btnStart');
    if (!btn) return;
    btn.disabled = n < 1;
    btn.title = n < 1 ? 'Select at least one category to start' : '';
  }

  function ensureCTAVisible() {
    const cta = $('#ctaStack');
    if (!cta) return;
    const show = () => {
      cta.style.removeProperty('display');
      cta.classList.add('tk-stack');
    };
    show();
    (window.requestAnimationFrame || ((fn) => setTimeout(fn, 16)))(show);
    setTimeout(show, 0);
    setTimeout(show, 250);
  }

  // Start Survey: only builds questions using selected categories and reveals the UI
  $('#btnStart')?.addEventListener('click', () => {
    if (selectedIds().length < 1) return;
    rebuildQuestionList();
    idx = 0;
    scores.A = {};
    paint();
    progress();
    ensureCTAVisible();
    $('#surveyApp')?.classList.remove('is-prestart');
    $('#questionArea')?.scrollIntoView({behavior:'smooth', block:'start'});
  });

  ensureCTAVisible();

  function rebuildQuestionList(){
    flat = [];
    if (!data?.categories) return;
    const wanted = new Set(selectedIds());
    for(const cat of data.categories){
      const catId = makeCategoryId(cat.name);
      if(wanted.size && !wanted.has(catId)) continue;
      for(const it of cat.items){
        const base = makeId(cat.name, it.label);
        for(const r of ['Giving','Receiving','General']){
          if((it.roles||[]).includes(r)){
            flat.push({ cat:cat.name, sub:it.label, role:r, id:`${base}::${r}` });
          }
        }
      }
    }
  }

  function paint(){
    const q = flat[idx];
    const questionPanel = ensureQuestionRoot();
    if (!questionPanel) return;

    const navRow = document.getElementById('navRow');
    const sidebarScaleHost = document.getElementById('tk-scale-sidebar');

    if(!q){
      questionPanel.innerHTML = `
        <article class="question-card tk-question-card is-empty" id="questionCard">
          <header class="q-head">
            <div class="q-path tk-meta" id="questionPath">TalkKink Survey</div>
            <h2 class="q-title">Select at least one category to begin</h2>
          </header>
          <div id="tk-guard" aria-live="polite"></div>
        </article>
      `;
      delete questionPanel.dataset.questionId;
      renderGuardSmall(questionPanel.querySelector('#tk-guard'));
      ensureScoreDock(questionPanel.querySelector('.question-card'));
      wireDownloadCTA(questionPanel.querySelector('.question-card'));
      if (sidebarScaleHost) renderScale(sidebarScaleHost, null, null);
      if (navRow) navRow.hidden = true;
      if (typeof window.initQuestionUI === 'function') {
        window.initQuestionUI();
      }
      progress();
      return;
    }

    const roleLabel = q.role || 'Role';
    const categoryName = q.cat || '';
    const prompt = q.sub || '';
    const selectedScore = Number.isInteger(scores.A[q.id]) ? scores.A[q.id] : null;

    questionPanel.dataset.questionId = q.id;
    questionPanel.innerHTML = `
      <article class="question-card tk-question-card" id="questionCard" data-role="${roleLabel}">
        <header class="q-head">
          <div class="q-path tk-meta" id="questionPath">${categoryName} • ${prompt}</div>
          <h2 class="q-title">${roleLabel}: Rate interest/comfort (0–5)</h2>
        </header>
        <div class="tk-rating">
          <div class="tk-rating__label">Rate interest/comfort (0–5)</div>
          <div class="tk-rating__choices" data-partner="A" data-group="rating-A"></div>
        </div>
        <div id="tk-guard" aria-live="polite"></div>
      </article>
    `;

    const activeRole = role || q.role || 'Giving';
    $$('#roleTabs [role="tab"]').forEach(btn=>{
      const isActive = btn.dataset.role === activeRole;
      btn.setAttribute('aria-selected', String(isActive));
    });

    const mainScaleHost = questionPanel.querySelector('.tk-rating__choices');
    const handlePick = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      scores.A[q.id] = numeric;
      progress();
      paint();
    };

    renderScale(mainScaleHost, handlePick, selectedScore);
    renderScale(sidebarScaleHost, handlePick, selectedScore);

    renderGuardSmall(questionPanel.querySelector('#tk-guard'));
    ensureScoreDock(questionPanel.querySelector('.question-card'));
    wireDownloadCTA(questionPanel.querySelector('.question-card'));

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(applyScorePanelLayoutFix);
    } else {
      setTimeout(applyScorePanelLayoutFix, 0);
    }

    if (navRow) navRow.hidden = false;
    if (typeof window.initQuestionUI === 'function') {
      window.initQuestionUI();
    }
    progress();
  }

  // nav
  $('#prevBtn')?.addEventListener('click', ()=>{ if(idx>0){ idx--; paint(); progress(); }});
  $('#nextBtn')?.addEventListener('click', ()=>{ if(idx<flat.length-1){ idx++; paint(); progress(); }});
  $('#skipBtn')?.addEventListener('click', ()=>{ if(idx<flat.length-1){ idx++; paint(); progress(); }});
  $('#roleTabs')?.addEventListener('click', e=>{
    const t = e.target?.dataset?.role; if(!t) return; role=t; paint();
  });

  function progress(){
    const total = flat.length;
    $('#progressText').textContent = `Question ${total ? (idx+1) : 0} of ${total}`;
    const answered = Object.keys(scores.A).filter(k=>Number.isInteger(scores.A[k])).length;
    const pct = total ? Math.round((answered/total)*100) : 0;
    progressBar?.style.setProperty('--w', `${pct}%`);
    if(progressPct) progressPct.textContent = `${pct}%`;
  }

  function makeId(cat, sub){
    return `${slug(cat)}::${slug(sub)}`;
  }

  function makeCategoryId(name){
    return slug(name);
  }

  function wireDownloadCTA(cardEl){
    if (!cardEl || !window.TKResults || typeof window.TKResults.install !== 'function') {
      return;
    }
    try {
      window.TKResults.install({
        getState: () => buildDownloadState(),
        cardEl
      });
    } catch (err) {
      console.error('[TK] download install failed', err);
    }
  }

  function buildDownloadState(){
    const total = flat.length;
    const active = flat[idx] || null;
    const selectedSet = new Set(selectedIds().map(String));
    const categories = Array.isArray(data?.categories) ? data.categories : [];

    const selections = categories
      .map((cat) => ({ id: makeCategoryId(cat.name), name: cat.name }))
      .filter((entry) => selectedSet.size ? selectedSet.has(entry.id) : false);

    const answers = {};
    if (selections.length) {
      selections.forEach((entry) => {
        if (!answers[entry.id]) answers[entry.id] = [];
      });
    }

    for (const item of flat) {
      const catId = makeCategoryId(item.cat);
      if (selectedSet.size && !selectedSet.has(catId)) continue;
      if (!answers[catId]) answers[catId] = [];
      answers[catId].push({
        label: item.sub,
        score: Number.isInteger(scores.A[item.id]) ? Number(scores.A[item.id]) : null,
        role: item.role || ''
      });
    }

    return {
      idx,
      total,
      title: active ? active.sub : '',
      selections,
      answers
    };
  }

  function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

  function updatePanelShadows(){
    if(!categoryPanel) return;
    const top = categoryPanel.scrollTop > 0;
    const bottom = categoryPanel.scrollHeight - categoryPanel.clientHeight - categoryPanel.scrollTop > 1;
    categoryPanel.classList.toggle('shadow-top', top);
    categoryPanel.classList.toggle('shadow-bottom', bottom);
  }

  function emitSelection(){
    const detail = { selected: selectedIds() };
    document.dispatchEvent(new CustomEvent('tk:categories:changed', { detail }));
  }
})();

(() => {
  const globalObj = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!globalObj) return;

  const DEFAULT_LABELS = Object.freeze({
    0: 'Brain buffer overflow',
    1: 'Not Interested',
    2: 'Willing (Partner)',
    3: 'Curious',
    4: 'Like It',
    5: 'Love It'
  });

  const CARD_HANDLE = '__tkQuestionCardEnhancer__';

  function isElement(node){
    return !!node && typeof node === 'object' && node.nodeType === 1;
  }

  function resolveRow(card, options){
    if (options && isElement(options.scoreRow)) return options.scoreRow;
    if (options && typeof options.scoreSelector === 'string'){
      const viaSelector = card.querySelector(options.scoreSelector);
      if (viaSelector) return viaSelector;
    }
    return card.querySelector('.scoreRow[data-partner="A"]') || card.querySelector('.scoreRow');
  }

  function ensureHelper(card, row){
    let helper = card.querySelector('.rating-helper');
    if (helper) return helper;
    const parent = row && row.parentElement ? row.parentElement : row || card;
    helper = document.createElement('div');
    helper.className = 'rating-helper muted';
    helper.dataset.tkAutoHelper = '1';
    helper.setAttribute('aria-live', 'polite');
    parent.appendChild(helper);
    return helper;
  }

  function parseButtonValue(button){
    if (!button) return NaN;
    const { dataset } = button;
    if (dataset && dataset.value != null){
      const fromDataset = Number(dataset.value);
      if (Number.isFinite(fromDataset)) return fromDataset;
    }
    if (button.value != null && button.value !== ''){
      const fromValue = Number(button.value);
      if (Number.isFinite(fromValue)) return fromValue;
    }
    const text = button.textContent;
    if (typeof text === 'string' && text.trim()){
      const fromText = Number(text.trim());
      if (Number.isFinite(fromText)) return fromText;
    }
    return NaN;
  }

  function readSelectedValue(buttons){
    const pressed = buttons.find(btn => btn.getAttribute('aria-pressed') === 'true');
    const value = parseButtonValue(pressed);
    return Number.isFinite(value) ? value : null;
  }

  function applyLabelUpdates(target, updates){
    if (!updates || typeof updates !== 'object') return;
    for (const [rawKey, rawValue] of Object.entries(updates)){
      const numKey = Number(rawKey);
      if (!Number.isFinite(numKey)) continue;
      const key = String(numKey);
      if (rawValue == null){
        delete target[key];
      } else {
        target[key] = String(rawValue);
      }
    }
  }

  function labelFor(value, labels){
    if (!Number.isFinite(value)) return '';
    const key = String(value);
    return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : '';
  }

  function buildDetail(card, button, type, value, event){
    return {
      card,
      button: button || null,
      event: event || null,
      type,
      value
    };
  }

  const g = globalObj;
  g.TK = g.TK || {};
  if (typeof g.TK.enhanceQuestionCard === 'function') return;

  g.TK.enhanceQuestionCard = function enhanceQuestionCard(card, options = {}){
    if (!isElement(card)) return null;
    if (card[CARD_HANDLE]) return card[CARD_HANDLE];

    const labels = {};
    applyLabelUpdates(labels, DEFAULT_LABELS);
    applyLabelUpdates(labels, options.labels);

    const row = resolveRow(card, options);
    const buttons = row ? Array.from(row.querySelectorAll('button')) : [];
    const helper = ensureHelper(card, row);
    const cleanup = [];

    const state = {
      selected: (() => {
        const value = readSelectedValue(buttons);
        return value ?? 0;
      })()
    };

    const update = (rawValue, type, button, event) => {
      const value = Number.isFinite(rawValue) ? rawValue : null;
      const label = value === null ? '' : labelFor(value, labels);
      const detail = buildDetail(card, button, type, value, event);

      let handledZero = false;
      if (value === 0 && typeof options.onZeroLabel === 'function'){
        handledZero = options.onZeroLabel(label, detail) === true;
      }

      if (helper && !(value === 0 && handledZero)){
        helper.textContent = label || '';
      }

      if (typeof options.onLabelChange === 'function'){
        options.onLabelChange(value, label, detail);
      }
    };

    for (const button of buttons){
      const value = parseButtonValue(button);
      if (!Number.isFinite(value)) continue;

      const handleEnter = event => update(value, 'hover', button, event);
      const handleLeave = event => update(state.selected, 'leave', button, event);
      const handleClick = event => {
        state.selected = value;
        update(value, 'select', button, event);
        if (typeof options.onSelect === 'function'){
          const label = labelFor(value, labels);
          const detail = buildDetail(card, button, 'select', value, event);
          options.onSelect(value, label, detail);
        }
      };

      button.addEventListener('mouseenter', handleEnter);
      button.addEventListener('focus', handleEnter);
      button.addEventListener('mouseleave', handleLeave);
      button.addEventListener('blur', handleLeave);
      button.addEventListener('click', handleClick);

      cleanup.push(() => {
        button.removeEventListener('mouseenter', handleEnter);
        button.removeEventListener('focus', handleEnter);
        button.removeEventListener('mouseleave', handleLeave);
        button.removeEventListener('blur', handleLeave);
        button.removeEventListener('click', handleClick);
      });
    }

    update(state.selected, 'init', null, null);

    const api = {
      updateLabels(next){
        applyLabelUpdates(labels, next);
        update(state.selected, 'labels', null, null);
      },
      destroy(){
        cleanup.forEach(fn => fn());
        cleanup.length = 0;
        if (helper && helper.dataset && helper.dataset.tkAutoHelper === '1'){
          helper.remove();
        }
        delete card[CARD_HANDLE];
      }
    };

    card[CARD_HANDLE] = api;
    return api;
  };

  Object.defineProperty(g.TK.enhanceQuestionCard, 'DEFAULT_LABELS', {
    value: DEFAULT_LABELS,
    enumerable: true,
    writable: false
  });
})();
(() => {
  const FLAG = '__TK_SINGLE_SCORE_CARD__';
  if (window[FLAG]) return;
  window[FLAG] = true;

  const HEADING_SELECTOR = 'h1,h2,h3,h4,h5,.card-title,.title';
  const TITLE_RX = /(how\s*to\s*score|question\s*guard)/i;

  const findScoreCards = (root = document) => {
    const containers = Array.from(
      root.querySelectorAll('.how-to-score, aside, section, article, div')
    );
    return containers.filter((el) => {
      if (el.closest('#questionCard')?.querySelector('.scoreRow')) return false;
      if (el.closest('#question-panel')?.querySelector('.scoreRow')) return false;
      if (el.querySelector('.scoreRow')) return false;
      const heading = el.querySelector(HEADING_SELECTOR);
      if (!heading) return false;
      const text = (heading.textContent || '').trim();
      return TITLE_RX.test(text);
    });
  };

  const pickRightColumnCard = (cards) => {
    if (!cards.length) return null;
    const midX = window.innerWidth * 0.55;
    const rightSide = cards.filter((el) => el.getBoundingClientRect().left > midX);
    if (rightSide.length) {
      return rightSide.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    }
    return cards[0];
  };

  const normalizeKeptCard = (card) => {
    if (!card) return;

    const heading = card.querySelector(HEADING_SELECTOR) || card.firstElementChild;
    if (heading) {
      heading.textContent = 'How to score';
    }

    Object.assign(card.style, {
      width: '',
      height: '',
      position: '',
      left: '',
      right: '',
      top: '',
      bottom: '',
    });

    card.classList.add('tk-score-aside');
  };

  const ensureSingle = () => {
    const cards = findScoreCards();
    if (!cards.length) return;

    const keep = pickRightColumnCard(cards);
    cards.forEach((card) => {
      if (card !== keep) card.remove();
    });

    normalizeKeptCard(keep);
  };

  const run = () => {
    try {
      ensureSingle();
    } catch (err) {
      console.warn('[TK Score Patch]', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  const mo = new MutationObserver(() => {
    clearTimeout(window.__tkScoreOnce__);
    window.__tkScoreOnce__ = setTimeout(run, 80);
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

(() => {
  window.addEventListener('error', (e) => {
    console.error('[Survey Fatal]', e?.message, `${e?.filename || ''}:${e?.lineno || 0}`);
  });

  const setupScoreCardCleanup = () => {
    removeDuplicateScoreCards();

    if (!window.MutationObserver || !document.body) return;

    const observer = new MutationObserver(() => {
      clearTimeout(window.__tkScoreCleanupTimer__);
      window.__tkScoreCleanupTimer__ = setTimeout(removeDuplicateScoreCards, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  const onReady = () => {
    const surveyRoot =
      document.querySelector('#question-panel, .survey-question-panel, .survey-root, main') ||
      document.body;

    if (!surveyRoot) return;

    setupScoreCardCleanup();

    surveyRoot.addEventListener(
      'click',
      (event) => {
        const btn = event.target?.closest?.('button, [role="button"]');
        if (!btn || !surveyRoot.contains(btn)) return;
        const text = (btn.textContent || '').trim();
        console.info('[Survey Click]', {
          text,
          id: btn.id || null,
          classes: btn.className || '',
        });
      },
      { capture: true }
    );

    const state = Object.create(null);
    surveyRoot.addEventListener('click', (event) => {
      const target = event.target?.closest?.('button.option, [data-action="select"]');
      if (!target || !surveyRoot.contains(target)) return;

      if (target.tagName === 'BUTTON') {
        const type = target.getAttribute('type');
        if (!type || type.toLowerCase() === 'submit') {
          target.type = 'button';
        }
      }

      event.preventDefault();

      const group = target.closest('[data-group]');
      const groupKey = group?.dataset?.group || 'default';
      group?.querySelectorAll('button.option, [data-action="select"]').forEach((btn) => {
        const active = btn === target;
        btn.classList.toggle('selected', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const value =
        target.dataset?.value ??
        target.value ??
        (target.textContent ? target.textContent.trim() : '');
      state[groupKey] = value;

      console.log('[Survey Selected]', { group: groupKey, value });
    });

    surveyRoot.addEventListener('tk:rating-change', (event) => {
      const detail = event?.detail || {};
      if (!detail || detail.group !== 'rating-A') return;
      const activeRoot = document.getElementById('tkQuestionRoot') || ensureQuestionPanel();
      const activeId = activeRoot?.dataset?.questionId;
      if (!activeId) return;

      if (detail.value === null || Number.isNaN(detail.value)) {
        delete scores.A[activeId];
      } else {
        scores.A[activeId] = Number(detail.value);
      }

      progress();
    });

    (async () => {
      if (typeof fetch !== 'function') return;
      try {
        const res = await fetch('/data/kinks.json', { cache: 'no-store' });
        const text = await res.text();
        try {
          JSON.parse(text);
        } catch (parseErr) {
          console.error('[kinks.json parse error]', parseErr, text.slice(0, 200));
        }
      } catch (fetchErr) {
        console.error('[kinks.json fetch error]', fetchErr);
      }
    })();
  };

  const boot = () => {
    removeDuplicateScoreCards();
    onReady();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

// Remove duplicate "How to score" cards by heading text, keep the rightmost (sidebar) one.
(function keepOnlySidebarScoreCard() {
  const SCORE_TEXT = /(^|\s)how to score/i;

  const getCards = () =>
    Array.from(document.querySelectorAll('section,div,article,aside')).filter((el) => {
      // must contain a heading-like element whose text starts with "How to score"
      const h = el.querySelector('h1,h2,h3,h4,[role="heading"]');
      return h && SCORE_TEXT.test((h.textContent || '').trim());
    });

  const prune = () => {
    const cards = getCards();
    if (!cards.length) return;

    // keep the rightmost card on screen (the sidebar one is on the right)
    const keep = cards.reduce((acc, el) => {
      const r = el.getBoundingClientRect();
      return !acc || r.left > acc._rect.left ? Object.assign(el, { _rect: r }) : acc;
    }, null);

    cards.forEach((el) => {
      if (el !== keep) el.remove();
    });
  };

  // run now
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prune, { once: true });
  } else {
    prune();
  }

  // run again after any dynamic changes (category/tab/question render)
  const mo = new MutationObserver(() => {
    // micro-throttle
    clearTimeout(prune._t);
    prune._t = setTimeout(prune, 50);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // expose for manual calls if you re-render explicitly
  window.__tkPruneScoreCards = prune;
})();

(() => {
  if (typeof window === 'undefined') return;
  if (window.TKResults && typeof window.TKResults.install === 'function') return;

  const STYLE_ID = 'tk-download-style';
  const DL_WRAP_CLASS = 'tk-download-wrap';
  const BTN_HTML = `
    <div class="${DL_WRAP_CLASS}">
      <button type="button" class="tk-download-btn">Download results</button>
    </div>`;

  const CSS = `
  .${DL_WRAP_CLASS}{display:none;margin:18px 0 0}
  .tk-download-btn{
    width:100%;padding:16px 20px;border-radius:18px;border:2px solid #33e0ff55;
    background:radial-gradient(120% 120% at 50% -20%,#0e2730 0%,#07161b 65%,#071116 100%);
    color:#dffbff;font-weight:800;font-size:20px;letter-spacing:.5px;
    box-shadow:0 0 22px #009ec333,inset 0 0 16px #00e1ff22;
    cursor:pointer;transition:transform .05s ease,box-shadow .15s ease;
  }
  .tk-download-btn:hover{box-shadow:0 0 28px #00e1ff66,inset 0 0 18px #00e1ff33}
  .tk-download-btn:active{transform:translateY(1px)}
  `;

  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head?.appendChild(style);
  }

  function install({ getState, cardEl }) {
    if (!cardEl) {
      console.warn('[TK] install: missing cardEl');
      return;
    }

    ensureStyle();

    let wrap = cardEl.querySelector(`.${DL_WRAP_CLASS}`);
    if (!wrap) {
      cardEl.insertAdjacentHTML('beforeend', BTN_HTML);
      wrap = cardEl.querySelector(`.${DL_WRAP_CLASS}`);
      const btn = wrap?.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          const state = safeState(getState);
          const file = buildDoc(state);
          triggerDownload(file.blob, file.filename);
        });
      }
    }

    if (!wrap) return;

    showIfLast(getState, wrap);

    if (!cardEl.__tkDownloadObserver) {
      const mo = new MutationObserver(() => showIfLast(getState, wrap));
      mo.observe(cardEl, { childList: true, subtree: true });
      cardEl.__tkDownloadObserver = mo;
    }
  }

  function showIfLast(getState, wrap) {
    const state = safeState(getState);
    const atLast =
      Number.isFinite(state.idx) &&
      Number.isFinite(state.total) &&
      state.total > 0 &&
      state.idx === state.total - 1;
    wrap.style.display = atLast ? 'block' : 'none';
  }

  function safeState(fn) {
    try {
      return Object(fn?.());
    } catch (err) {
      console.warn('[TK] download state error', err);
      return {};
    }
  }

  function buildDoc(state) {
    const when = new Date();
    const stamp = when.toISOString().replace(/[:.]/g, '-');
    const filename = `TalkKink_Survey_${stamp}.html`;

    const themeCSS = `
      html,body{margin:0;background:#000;color:#e9feff;font-family:system-ui,Segoe UI,Inter,Roboto,Arial,sans-serif;}
      .wrap{max-width:1100px;margin:32px auto;padding:24px}
      .hero{color:#c9faff;text-align:center;margin:0 0 20px;font-size:48px;font-weight:900;text-shadow:0 0 26px #00e1ff55}
      .meta{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;color:#a7dbe3}
      .chip{border:1px solid #0aa2c7;padding:6px 10px;border-radius:999px;background:#03191e}
      .section{margin:26px 0 24px;padding:18px 20px;border:1px solid #0aa2c7;border-radius:14px;background:#051216}
      .section h2{margin:0 0 8px;color:#c9faff;font-size:22px}
      .row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#07161b;margin:8px 0;color:#cfeff4}
      .score{min-width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-weight:900}
      .s0{background:#20313a;color:#cfeff4}
      .s1{background:#431c1c;color:#ffdada}
      .s2{background:#3a2f13;color:#ffeaa3}
      .s3{background:#14343a;color:#cfeff4}
      .s4{background:#173a17;color:#d1ffd1}
      .s5{background:#0f2f0f;color:#c9ffd1}
      .foot{margin-top:28px;color:#7cc9d6;text-align:center;font-size:12px}
      .catTitle{font-size:18px;font-weight:800;color:#a8f0ff;margin:14px 0 6px}
      .divider{height:1px;background:#07333d;margin:14px 0}
    `;

    const selections = Array.isArray(state.selections) ? state.selections : [];
    const chips = selections
      .map((entry) => `<span class="chip">${escapeHTML(entry?.name || 'Untitled')}</span>`)
      .join('');

    const sections = selections
      .map((selection) => {
        const list = Array.isArray(state.answers?.[selection.id]) ? state.answers[selection.id] : [];
        const rows = list.length
          ? list.map((item) => rowHTML(item)).join('')
          : '<div class="row">No answers recorded for this category.</div>';
        return `
          <div class="section">
            <div class="catTitle">${escapeHTML(selection.name || 'Untitled')}</div>
            ${rows}
          </div>`;
      })
      .join('');

    const content = sections || '<div class="section"><div class="row">No categories selected.</div></div>';

    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Talk Kink Survey Results</title><style>${themeCSS}</style></head>
<body>
  <div class="wrap">
    <h1 class="hero">Talk Kink Survey — Results</h1>
    <div class="meta">
      <span class="chip">Completed: ${escapeHTML(when.toLocaleString())}</span>
      <span class="chip">Questions: ${Number(state.total) || 0}</span>
      ${chips}
    </div>
    <div class="divider"></div>
    ${content}
    <div class="foot">Generated with TalkKink.org • Keep this file private.</div>
  </div>
</body></html>`;

    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename };
  }

  function rowHTML(item) {
    const score = clamp(Number(item?.score));
    const label = escapeHTML(item?.label ?? 'Item');
    const role = item?.role ? ` • ${escapeHTML(item.role)}` : '';
    return `
      <div class="row">
        <div class="score s${score}">${score}</div>
        <div>${label}${role}</div>
      </div>`;
  }

  function clamp(value) {
    const n = Number.isFinite(value) ? value : 0;
    return Math.min(5, Math.max(0, Math.round(n)));
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[ch]);
  }

  function triggerDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    });
  }

  window.TKResults = { install };
})();
