(() => {
  const DATA_URL = '/data/kinks.json';
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  let data=null, role='Giving', idx=0, flat=[];
  const scores = {A:{},B:{}};
  let progressStats = { total:0, answered:0, answeredA:0, answeredB:0, pct:0 };
  let exportRows = [];

  // ---- Theme / Accent handling ----
  const THEME_KEY  = '__TK_THEME';
  const ACCENT_KEY = '__TK_ACCENT';

  function applyTheme(t){
    if(!t) return;
    document.documentElement.className = `theme-${t}`;
    localStorage.setItem(THEME_KEY, t);
    // visual active state
    $$('#themeControls .theme-btn').forEach(b=>b.classList.toggle('is-active', b.dataset.theme===t));
  }
  function applyAccent(hex){
    if(!hex) return;
    document.documentElement.style.setProperty('--accent', hex);
    localStorage.setItem(ACCENT_KEY, hex);
  }

  // restore saved settings
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  applyAccent(localStorage.getItem(ACCENT_KEY) || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

  // click handlers
  $('#themeControls')?.addEventListener('click', (e)=>{
    const t = e.target?.dataset?.theme;
    const a = e.target?.dataset?.accent;
    if(t){ applyTheme(t); }
    if(a){ applyAccent(a); }
  });

  const progressBar = $('#progressBar');
  const progressPct = $('#progressPct');
  const compatBar = $('#compatBar');
  const compatText = $('#compatText');
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
      const q = flat[idx]; const card = $('#questionCard');
      if(!q){ card.hidden = true; paintCompat(); return; }
      card.hidden = false;
      $('#questionPath').textContent = `${q.cat} • ${q.sub}`;
      $('#questionText').textContent = `${q.role}: Rate interest/comfort (0–5)`;
      $$('#roleTabs [role="tab"]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.role===role)));

      for(const who of ['A','B']){
        const row = $(`.scoreRow[data-partner="${who}"]`); row.innerHTML='';
        for(let i=0;i<=5;i++){
          const btn = document.createElement('button'); btn.textContent=String(i);
          btn.setAttribute('aria-pressed', scores[who][q.id]===i ? 'true':'false');
          btn.addEventListener('click',()=>{ scores[who][q.id]=i; paintCompat(); });
          row.appendChild(btn);
        }
      }
      paintCompat();
    }

    function paintCompat(){
      const q = flat[idx];
      const bar = compatBar;
      const txt = compatText;
      const flags = $('#flagRow');
      if(!bar || !txt || !flags){ progress(); updateSummary(); return; }
      flags.textContent='';
      txt.style.color = 'var(--fg)';
      if(!q){
        txt.textContent='N/A';
        bar.style.setProperty('--w', '0%');
        progress();
        updateSummary();
        return;
      }
      const a = scores.A[q.id];
      const b = scores.B[q.id];
      const compat = (Number.isInteger(a) && Number.isInteger(b)) ? 100 - (Math.abs(a-b)*20) : null;
      if(compat==null){
        txt.textContent='N/A';
        bar.style.setProperty('--w', '0%');
      } else {
        txt.textContent = `${compat}%`;
        bar.style.setProperty('--w', `${compat}%`);
        if(compat>=80) txt.style.color = 'var(--fg)';          // readable glow
        if(compat<=50) flags.textContent += ' 🚩';
        if(compat>=90) flags.textContent = '⭐' + flags.textContent;
        if((a===5 && Number.isInteger(b) && b<5) || (b===5 && Number.isInteger(a) && a<5))
          flags.textContent += ' 🟨';
      }
      progress();
      updateSummary();
    }

    function progress(){
      const total = flat.length;
      let answeredA = 0, answeredB = 0;
      for(const q of flat){
        if(Number.isInteger(scores.A[q.id])) answeredA += 1;
        if(Number.isInteger(scores.B[q.id])) answeredB += 1;
      }
      const answered = answeredA + answeredB;
      const pct = total ? Math.round((answered/(total*2))*100) : 0;
      progressStats = { total, answered, answeredA, answeredB, pct };
      const current = total ? Math.min(idx+1, total) : 0;
      $('#progressText').textContent = `Question ${current} of ${total}`;
      progressBar?.style.setProperty('--w', `${pct}%`);
      if(progressPct) progressPct.textContent = `${pct}%`;
    }

    // nav + tabs
    $('#prevBtn').addEventListener('click',()=>{ if(idx>0){ idx--; paint(); }});
    $('#nextBtn').addEventListener('click',()=>{ if(idx<flat.length-1){ idx++; paint(); }});
    $('#skipBtn')?.addEventListener('click',()=>{ if(idx<flat.length-1){ idx++; paint(); }});
    $('#roleTabs').addEventListener('click',e=>{
      const t = e.target?.dataset?.role; if(!t) return; role=t; paint();
    });

    $('#exportPDF')?.addEventListener('click', async()=>{
      if(typeof window.downloadCompatibilityPDF !== 'function'){
        console.warn('downloadCompatibilityPDF unavailable');
        return;
      }
      try{
        await window.downloadCompatibilityPDF({ rows: exportRows });
      }catch(err){
        console.error('PDF export failed', err);
      }
    });

    function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

    function compatValue(a,b){
      return (Number.isInteger(a) && Number.isInteger(b)) ? 100 - (Math.abs(a-b)*20) : null;
    }

    function updateSummary(){
      const table = $('#compatibilityTable');
      if(!table){ exportRows = []; return; }
      const rows = [];
      const total = progressStats.total || 0;
      rows.push({
        category:'Progress',
        A:`${progressStats.answeredA}/${total}`,
        pct:`${progressStats.pct}%`,
        B:`${progressStats.answeredB}/${total}`
      });
      const summary = new Map();
      for(const q of flat){
        const bucket = summary.get(q.cat) || {aTotal:0,aCount:0,bTotal:0,bCount:0,compatTotal:0,compatCount:0};
        const a = scores.A[q.id];
        const b = scores.B[q.id];
        if(Number.isInteger(a)){ bucket.aTotal += a; bucket.aCount += 1; }
        if(Number.isInteger(b)){ bucket.bTotal += b; bucket.bCount += 1; }
        const compat = compatValue(a,b);
        if(compat!=null){ bucket.compatTotal += compat; bucket.compatCount += 1; }
        summary.set(q.cat, bucket);
      }
      const order = data?.categories?.map(cat=>cat.name) || [];
      for(const name of order){
        if(!summary.has(name)) continue;
        const info = summary.get(name);
        rows.push({
          category:name,
          A:formatAverage(info.aTotal, info.aCount),
          pct:formatCompat(info.compatTotal, info.compatCount),
          B:formatAverage(info.bTotal, info.bCount)
        });
      }
      renderTable(table, rows);
      exportRows = rows;
    }

    function formatAverage(total, count){
      if(!count) return '—';
      const avg = total / count;
      return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
    }

    function formatCompat(total, count){
      if(!count) return 'N/A';
      const avg = Math.round(total / count);
      return `${avg}%`;
    }

    function renderTable(table, rows){
      table.innerHTML='';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Category</th><th>Partner A</th><th>Match</th><th>Partner B</th></tr>';
      const tbody = document.createElement('tbody');
      rows.forEach(row=>{
        const tr = document.createElement('tr');
        ['category','A','pct','B'].forEach(key=>{
          const cell = document.createElement('td');
          cell.textContent = row[key] ?? '—';
          tr.appendChild(cell);
        });
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
    }

    function updatePanelShadows(){
      if(!categoryPanel) return;
      const top = categoryPanel.scrollTop > 0;
      const bottom = categoryPanel.scrollHeight - categoryPanel.clientHeight - categoryPanel.scrollTop > 1;
      categoryPanel.classList.toggle('shadow-top', top);
      categoryPanel.classList.toggle('shadow-bottom', bottom);
    }
  })();
