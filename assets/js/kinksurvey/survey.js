(() => {
  const DATA_URL = '/data/kinks.json';
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  const MODE = 'survey'; // this page is survey-only (no partner B, no file IO)

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
    buildCategoryPanel(); rebuild(); paint(); updatePanelShadows();
  });

  function normalize(json){
    const c = structuredClone(json);
    for(const cat of c.categories||[]){
      cat.name = tidy(cat.name);
      for (const it of cat.items||[]) it.label = tidy(it.label);
    }
    return c;
    function tidy(s=''){ return String(s).replace(/\bCB\b:?/gi,'').replace(/\s{2,}/g,' ').trim(); }
  }

  function buildCategoryPanel(){
      const host = $('#categoryChecklist'); host.innerHTML='';
      for(const cat of data.categories){
        const wrap = document.createElement('div'); wrap.className='cat';
        wrap.innerHTML = `<h4>${cat.name}</h4>`;
        for(const it of cat.items){
          const id = `${slug(cat.name)}::${slug(it.label)}`;
          const row = document.createElement('label'); row.className='item';
          const cb = Object.assign(document.createElement('input'),{type:'checkbox',checked:false});
          cb.addEventListener('change',()=>{ rebuild(); paint(); });
          row.append(cb, document.createTextNode(it.label));
          wrap.appendChild(row);
          row.dataset.qid = id;
        }
        host.appendChild(wrap);
      }
      updatePanelShadows();
    }

  function selectedIds(){
    return $$('#categoryChecklist .item input:checked').map(i=>i.parentElement.dataset.qid);
  }

  function rebuild(){
    flat = [];
    const wanted = new Set(selectedIds());
      for(const cat of data.categories){
        for(const it of cat.items){
          const id = `${slug(cat.name)}::${slug(it.label)}`;
          if(!wanted.size || wanted.has(id)){
            for(const r of ['Giving','Receiving','General']){
              if((it.roles||[]).includes(r)){
                flat.push({cat:cat.name, sub:it.label, role:r, id:`${id}::${r}`});
              }
            }
          }
        }
      }
      idx = 0;
      $('#selectedCountBadge').textContent = `${wanted.size} selected`;
    }

    function paint(){
      const q = flat[idx];
      const card = $('#questionCard');
      if(!q){
        card.hidden = true;
        progress();
        return;
      }

      card.hidden = false;
      $('#questionPath').textContent = `${q.cat} • ${q.sub}`;
      $('#questionText').textContent = `${q.role}: Rate interest/comfort (0–5)`;
      $$('#roleTabs [role="tab"]').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.role===role)));

      const rowA = $(`.scoreRow[data-partner="A"]`);
      rowA.innerHTML = '';
      for (let i=0;i<=5;i++){
        const btn = document.createElement('button');
        btn.textContent = String(i);
        btn.setAttribute('aria-pressed', scores.A[q.id]===i ? 'true':'false');
        btn.addEventListener('click', ()=>{
          scores.A[q.id] = i;
          rowA.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
          btn.setAttribute('aria-pressed','true');
          progress(); // update ND-friendly progress
        });
        rowA.appendChild(btn);
      }

      progress();
    }

    function progress(){
      const total = flat.length;
      const current = total ? Math.min(idx+1, total) : 0;
      $('#progressText').textContent = `Question ${current} of ${total}`;

      let answered = 0;
      for(const q of flat){
        if(Number.isInteger(scores.A[q.id])) answered += 1;
      }
      const pct = total ? Math.round((answered/total)*100) : 0;
      progressBar?.style.setProperty('--w', `${pct}%`);
      if(progressPct) progressPct.textContent = `${pct}%`;
    }

    // nav + tabs
    $('#prevBtn').addEventListener('click',()=>{ if(idx>0){ idx--; paint(); }});
    $('#nextBtn').addEventListener('click',()=>{ if(idx<flat.length-1){ idx++; paint(); }});
    $('#skipBtn')?.addEventListener('click',()=>{
      if(idx < flat.length-1){
        idx++;
        paint();
        progress();
      }
    });
    $('#roleTabs').addEventListener('click',e=>{
      const t = e.target?.dataset?.role; if(!t) return; role=t; paint();
    });

    function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

    // survey-only mode skips export + compatibility summary

    function updatePanelShadows(){
      if(!categoryPanel) return;
      const top = categoryPanel.scrollTop > 0;
      const bottom = categoryPanel.scrollHeight - categoryPanel.clientHeight - categoryPanel.scrollTop > 1;
      categoryPanel.classList.toggle('shadow-top', top);
      categoryPanel.classList.toggle('shadow-bottom', bottom);
    }

    document.getElementById('btnStart')?.addEventListener('click', () => {
      // hide the CTA stack, scroll to first question
      const cta = document.getElementById('ctaStack');
      if (cta) cta.style.display = 'none';
      document.getElementById('questionArea')?.scrollIntoView({behavior:'smooth', block:'start'});
    });
  })();
