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

  fetch(DATA_URL).then(r=>r.json()).then(json=>{
    data = normalize(json);
    buildCategoryPanel();
    updateStartEnabled();
    progress();
    updatePanelShadows();
    paint();
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

  // Start Survey: only builds questions using selected categories and reveals the UI
  $('#btnStart')?.addEventListener('click', () => {
    if (selectedIds().length < 1) return;
    rebuildQuestionList();
    idx = 0;
    scores.A = {};
    paint();
    progress();
    const cta = $('#ctaStack'); if (cta) cta.style.display = 'none';
    $('#surveyApp')?.classList.remove('is-prestart');
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
    const q = flat[idx];
    const questionPanel = ensureQuestionRoot();
    if (!questionPanel) return;

    const navRow = document.getElementById('navRow');
    const sidebarScaleHost = document.getElementById('tk-scale-sidebar');

    if(!q){
      questionPanel.innerHTML = `
        <article class="question-card is-empty" id="questionCard">
          <header class="q-head">
            <div class="q-path" id="questionPath">TalkKink Survey</div>
            <h2 class="q-title">Select at least one category to begin</h2>
          </header>
          <div id="tk-guard" aria-live="polite"></div>
        </article>
      `;
      delete questionPanel.dataset.questionId;
      renderGuardSmall(questionPanel.querySelector('#tk-guard'));
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
      <article class="question-card" id="questionCard" data-role="${roleLabel}">
        <header class="q-head">
          <div class="q-path" id="questionPath">${categoryName} • ${prompt}</div>
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
