(() => {
  const DATA_URL = '/data/kinks.json';
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  let data=null, role='Giving', idx=0, flat=[];
  const scores = {A:{}};

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
      cat.name = tidy(cat.name);
      for (const it of cat.items||[]) it.label = tidy(it.label);
    }
    c.categories?.sort((a, b) => collator.compare(a.name, b.name));
    return c;
    function tidy(s=''){ return String(s).replace(/\bCB\b:?/gi,'').replace(/\s{2,}/g,' ').trim(); }
  }

  function buildCategoryPanel(){
    const host = $('#categoryChecklist'); host.innerHTML='';
    for(const cat of data.categories){
      const wrap = document.createElement('div'); wrap.className='cat';
      const h4 = document.createElement('h4'); h4.textContent = cat.name; wrap.appendChild(h4);
      for(const it of cat.items){
        const id = makeId(cat.name, it.label);
        const row = document.createElement('label'); row.className='item';
        row.dataset.qid = id;
        const cb = Object.assign(document.createElement('input'), {type:'checkbox'});
        cb.addEventListener('change', updateStartEnabled);
        row.append(cb, document.createTextNode(it.label));
        wrap.appendChild(row);
      }
      host.appendChild(wrap);
    }
    updateSelectedCount();
  }

  function selectedIds(){
    return $$('#categoryChecklist .item input:checked').map(i=>i.parentElement.dataset.qid);
  }

  function updateSelectedCount(){
    const n = selectedIds().length;
    const badge = $('#selectedCountBadge'); if (badge) badge.textContent = `${n} selected`;
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
      for(const it of cat.items){
        const base = makeId(cat.name, it.label);
        if(!wanted.size || wanted.has(base)){
          for(const r of ['Giving','Receiving','General']){
            if((it.roles||[]).includes(r)){
              flat.push({ cat:cat.name, sub:it.label, role:r, id:`${base}::${r}` });
            }
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
    for(let i=0;i<=5;i++){
      const btn = document.createElement('button');
      btn.textContent = String(i);
      btn.setAttribute('aria-pressed', scores.A[q.id]===i ? 'true':'false');
      btn.addEventListener('click', ()=>{
        scores.A[q.id] = i;
        rowA.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
        progress();
      });
      rowA.appendChild(btn);
    }
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

  function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

  function updatePanelShadows(){
    if(!categoryPanel) return;
    const top = categoryPanel.scrollTop > 0;
    const bottom = categoryPanel.scrollHeight - categoryPanel.clientHeight - categoryPanel.scrollTop > 1;
    categoryPanel.classList.toggle('shadow-top', top);
    categoryPanel.classList.toggle('shadow-bottom', bottom);
  }
})();
