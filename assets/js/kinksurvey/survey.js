(() => {
  const DATA_URL = '/data/kinks.json';
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  let data=null, role='Giving', idx=0, flat=[];
  const scores = {A:{},B:{}};

  // theme switch
  $('#themeControls')?.addEventListener('click', e=>{
    const t = e.target?.dataset?.theme; if(!t) return;
    document.documentElement.className = `theme-${t}`;
  });

  fetch(DATA_URL).then(r=>r.json()).then(json=>{
    data = normalize(json);
    buildCategoryPanel(); rebuild(); paint(); progress();
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
        cb.addEventListener('change',()=>{ rebuild(); paint(); progress(); });
        row.append(cb, document.createTextNode(it.label));
        wrap.appendChild(row);
        row.dataset.qid = id;
      }
      host.appendChild(wrap);
    }
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
    idx = Math.min(idx, Math.max(0, flat.length-1));
    $('#selectedCountBadge').textContent = `${wanted.size} selected`;
  }

  function paint(){
    const q = flat[idx]; const card = $('#questionCard');
    if(!q){ card.hidden = true; return; }
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
    const q = flat[idx]; if(!q) return;
    const a = scores.A[q.id], b = scores.B[q.id];
    const compat = (Number.isInteger(a) && Number.isInteger(b)) ? 100 - (Math.abs(a-b)*20) : null;
    const bar = $('#compatBar'), txt = $('#compatText'), flags = $('#flagRow');
    flags.textContent='';
    if(compat==null){ txt.textContent='N/A'; bar.style.setProperty('background','#000'); return; }
    txt.textContent = `${compat}%`;
    if(compat>=90) flags.textContent = '⭐';
    if(compat<=50) flags.textContent += ' 🚩';
    if((a===5 && Number.isInteger(b) && b<5) || (b===5 && Number.isInteger(a) && a<5)) flags.textContent += ' 🟨';
  }

  function progress(){
    const total = flat.length; $('#progressText').textContent = `Question ${total?(idx+1):0} of ${total}`;
  }

  // nav + tabs
  $('#prevBtn').addEventListener('click',()=>{ if(idx>0){ idx--; paint(); progress(); }});
  $('#nextBtn').addEventListener('click',()=>{ if(idx<flat.length-1){ idx++; paint(); progress(); }});
  $('#roleTabs').addEventListener('click',e=>{
    const t = e.target?.dataset?.role; if(!t) return; role=t; paint();
  });

  function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
})();
