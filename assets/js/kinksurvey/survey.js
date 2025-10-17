(() => {
  const DATA_URL = '/data/kinks.json';
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  let data=null, role='Giving', idx=0, flat=[];
  const scores = {A:{}};

  const TK_GUARD_SMALL = Object.freeze([
    { dot:'blue',  label:'0 — Brain did a cartwheel', desc:'skipped for now 😅' },
    { dot:'red',   label:'1 — Hard Limit',            desc:'full stop / non-negotiable' },
    { dot:'yellow',label:'2 — Soft Limit',            desc:'willing to try with strong boundaries & safeties' },
    { dot:'green', label:'3 — Curious / context-dependent', desc:'okay with discussion, mood, and trust' },
    { dot:'green', label:'4 — Comfortable / enjoy',   desc:'generally a yes; normal precautions' },
    { dot:'green', label:'5 — Favorite / enthusiastic yes', desc:'happy to dive in; green light' },
  ]);

  function renderGuardSmall(root){
    if(!root) return;
    root.innerHTML = `
      <div class="tk-guard-title">How to score</div>
      ${TK_GUARD_SMALL.map(row => `
        <div class="tk-row">
          <span class="dot ${row.dot}">${row.label.split('—')[0].trim()}</span>
          <div>
            <div style="font-weight:700">${row.label}</div>
            <div style="opacity:.85">${row.desc}</div>
          </div>
        </div>
      `).join('')}
    `;
  }

  const SCORE_PANEL_TITLE_REGEX = /rate\s+interest\/?comfort\s*\(0\s*[-–]\s*5\)/i;

  function normalizeText(str){
    return typeof str === 'string' ? str.replace(/\s+/g, ' ').trim().toLowerCase() : '';
  }

  function isScorePanel(el){
    if (!el) return false;
    const txt = normalizeText(el.textContent);
    return txt.includes('question guard') && txt.includes('how to score');
  }

  function findAllScorePanels(){
    const candidates = Array.from(document.querySelectorAll('#tk-guard, section, div'));
    return candidates.filter(isScorePanel);
  }

  function findQuestionCard(){
    const explicit = document.getElementById('questionCard');
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
          btn.classList.toggle('is-active', valid && btnValue === numeric);
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

  categoryPanel?.addEventListener('scroll', updatePanelShadows);

  fetch(DATA_URL).then(r=>r.json()).then(json=>{
    data = normalize(json);
    buildCategoryPanel();
    updateStartEnabled();
    progress();
    updatePanelShadows();
  });

  function normalize(json){
    const c = structuredClone(json);
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
    if(!host) return;
    const prev = new Set(selectedIds());
    host.innerHTML='';
    const frag = document.createDocumentFragment();
    for(const cat of data.categories){
      const catId = makeCategoryId(cat.name);
      const li = document.createElement('li'); li.className = 'tk-catrow';
      const label = document.createElement('label'); label.className = 'tk-cat';
      const input = Object.assign(document.createElement('input'), { type:'checkbox', value:catId, id:`cat-${catId}` });
      input.checked = prev.has(catId);
      input.addEventListener('change', () => {
        updateStartEnabled();
        emitSelection();
      });
      const span = document.createElement('span'); span.className = 'tk-catname'; span.textContent = cat.name;
      label.append(input, span);
      li.appendChild(label);
      frag.appendChild(li);
    }
    host.appendChild(frag);
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
  }

  function updateStartEnabled(){
    const n = selectedIds().length;
    updateSelectedCount();
    const btn = $('#btnStart');
    if (!btn) return;
    btn.disabled = n < 1;
    btn.title = n < 1 ? 'Select at least one category to start' : '';
  }

  // Start Survey: only builds questions using selected categories and reveals the UI
  $('#btnStart')?.addEventListener('click', () => {
    if (selectedIds().length < 1) return;
    rebuildQuestionList();
    idx = 0;
    scores.A = {};
    paint();
    progress();
    const cta = $('#ctaStack'); if (cta) cta.style.display = 'none';
    $('#surveyApp')?.classList.remove('is-hidden');
    $('#questionArea')?.scrollIntoView({behavior:'smooth', block:'start'});
  });

  function rebuildQuestionList(){
    flat = [];
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
    const q = flat[idx]; const card = $('#questionCard');
    if(!q){ card.hidden = true; progress(); return; }
    card.hidden = false;
    $('#questionPath').textContent = `${q.cat} • ${q.sub}`;
    $('#questionText').textContent = `${q.role}: Rate interest/comfort (0–5)`;
    $$('#roleTabs [role="tab"]').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.role===role)));

    // single score row (A)
    const rowA = $(`.scoreRow[data-partner="A"]`);
    rowA.innerHTML = '';
    const guardRoot = $('#tk-guard');
    renderGuardSmall(guardRoot);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(applyScorePanelLayoutFix);
    } else {
      setTimeout(applyScorePanelLayoutFix, 0);
    }
    const scaleRoot = $('#tk-scale');
    let scaleApi = null;
    const ratingButtons = [];

    for(let i=0;i<=5;i++){
      const btn = document.createElement('button');
      btn.textContent = String(i);
      btn.dataset.value = String(i);
      btn.setAttribute('aria-pressed', scores.A[q.id]===i ? 'true':'false');
      btn.addEventListener('click', ()=>{
        scores.A[q.id] = i;
        rowA.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
        progress();
        if (scaleApi) scaleApi.select(i);
      });
      rowA.appendChild(btn);
      ratingButtons.push(btn);
    }

    scaleApi = renderScale(scaleRoot, (value)=>{
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return;
      const target = ratingButtons.find(b => Number(b.dataset.value) === numeric);
      if (target) {
        target.click();
      } else {
        scores.A[q.id] = numeric;
        progress();
        if (scaleApi) scaleApi.select(numeric);
      }
    }, scores.A[q.id]);

    if (scaleApi) scaleApi.select(scores.A[q.id]);
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
