/*! TalkKink Compatibility — SAFE labels + % bars (DOM + PDF)
   - Debounced MutationObserver (no loops / no freeze)
   - One-time cell tagging (no reprocessing)
   - Label sourcing: /data/labels.json, /data/labels-overrides.json, /data/kinks.json, window.KINKS_BANK, INLINE overrides
*/
(()=>{ if (window.__TK_COMPAT_PATCH__) return; window.__TK_COMPAT_PATCH__=true;
  const CB_RE=/\bcb_[a-z0-9]{5}\b/i, LABELS=Object.create(null);
  const nice=s=>String(s||'').trim();
  const mark=(el,a)=>el&&el.setAttribute(a,'1');
  const done=(el,a)=>el&&el.getAttribute(a)==='1';

  // --- Minimal inline overrides if you want hard-guaranteed labels (optional) ---
  const INLINE_LB = {
    // "cb_e4bdv": "Makeup as protocol or control",
    // "cb_hhxwj": "Accessory or ornament rules",
  };

  function addMap(obj){
    if (!obj || typeof obj!=='object') return;
    for (const [k,v] of Object.entries(obj)){
      if (CB_RE.test(k) && nice(v)) LABELS[k.toLowerCase()] = nice(v);
    }
  }
  async function fetchJSON(url){
    try{ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) return null;
      const ct=r.headers.get('content-type')||''; const t=await r.text();
      if(/html/i.test(ct) || /^\s*<!doctype/i.test(t)) return null; return JSON.parse(t);
    }catch{ return null; }
  }
  async function loadLabels(){
    // (1) small direct maps
    for (const u of ['/data/labels.json','/data/labels-overrides.json']){
      const j=await fetchJSON(u); if (j) addMap(j);
    }
    // (2) derive from canonical kinks bank
    let bank=await fetchJSON('/data/kinks.json'); if (!bank && Array.isArray(window.KINKS_BANK)) bank=window.KINKS_BANK;
    if (bank){
      const cats = Array.isArray(bank) ? bank : Object.entries(bank).map(([category,items])=>({category,items}));
      for (const c of cats){ for (const it of (c.items||[])){
        const key=(it.id||it.key||'').toLowerCase(); const label=it.label||it.text||it.name;
        if (CB_RE.test(key) && nice(label)) LABELS[key]=nice(label);
      }}
    }
    // (3) inline overrides last
    addMap(INLINE_LB);
  }
  function labelFor(code){ const k=(code||'').toLowerCase(); return LABELS[k]||code; }

  // --- CSS for on-page percent bars (lightweight, neutral layout) ---
  (function css(){
    if (document.getElementById('tk-pctbar-css')) return;
    const s=document.createElement('style'); s.id='tk-pctbar-css';
    s.textContent='td.pct-cell{min-width:5.5rem}.pct{position:relative;height:1.15em;line-height:1.15em}.pct .bar{position:absolute;inset:0 auto 0 0;width:0;background:rgba(0,230,255,.25);border-radius:2px}.pct .txt{position:relative;display:block;text-align:center}';
    document.head.appendChild(s);
  })();

  // --- Relabel + add bars (idempotent, one-time tags per cell) ---
  function relabelAndBars(){
    const tables=[...document.querySelectorAll('table')]; if(!tables.length) return;
    // try to detect columns once per table
    for (const tbl of tables){
      const rows = (tbl.tBodies[0]||tbl).rows;
      for (const tr of rows){
        const catCell = tr.cells?.[0];            // Category column (left)
        const pctCell = tr.cells?.[2];            // “Match %” column (3rd)
        if (catCell && !done(catCell,'data-tk-labeled')){
          const raw=nice(catCell.textContent); const m=raw.match(CB_RE);
          if (m){ const pretty=labelFor(m[0]); if(pretty&&pretty!==m[0]) catCell.textContent=pretty; }
          mark(catCell,'data-tk-labeled');
        }
        if (pctCell && !done(pctCell,'data-tk-barred')){
          const rawPct=nice(pctCell.textContent); const mm=rawPct.match(/^(\d{1,3})%$/);
          pctCell.classList.add('pct-cell');
          if (mm){ const pct=Math.max(0,Math.min(100,parseInt(mm[1],10)));
            const wrap=document.createElement('div'); wrap.className='pct';
            wrap.innerHTML='<span class="bar" style="width:'+pct+'%"></span><span class="txt">'+rawPct+'</span>';
            pctCell.innerHTML=''; pctCell.appendChild(wrap);
          } else { pctCell.innerHTML='<span class="txt">'+rawPct+'</span>'; }
          mark(pctCell,'data-tk-barred');
        }
      }
    }
  }

  // --- PDF: draw small cyan bar behind AutoTable “Match %” cells ---
  function patchAutoTableBars(){
    const JSPDF=window.jspdf&&window.jspdf.jsPDF; if(!JSPDF) return;
    const proto=JSPDF.API; if(!proto||!proto.autoTable||proto.autoTable.__tkPatched) return;
    const orig=proto.autoTable;
    proto.autoTable=function(opts){
      const user=opts&&opts.didDrawCell;
      const wrapped={...opts, didDrawCell:function(data){
        if (typeof user==='function') try{ user.call(this,data);}catch{}
        if(data.section==='body' && data.column.index===2){
          const raw=String(data.cell.raw??'').trim(); const m=raw.match(/^(\d{1,3})%$/);
          if (m){ const pct=Math.max(0,Math.min(100,parseInt(m[1],10)));
            const pad=1, x=data.cell.x+pad, y=data.cell.y+data.cell.height-2.2, w=Math.max(0,data.cell.width-pad*2)*(pct/100);
            this.setFillColor(0,230,255); this.rect(x,y,w,1.8,'F');
          }
        }
      }};
      wrapped.__tkFromPatched=true; return orig.call(this, wrapped);
    };
    proto.autoTable.__tkPatched=true;
  }

  // --- Export hook: ensure labels/bars just before generating PDF ---
  function wrapExporter(name){
    const fn=window[name]; if(!fn || fn.__tkWrapped) return false;
    window[name]=async function(...args){
      await loadLabels(); relabelAndBars(); patchAutoTableBars();
      return await fn.apply(this,args);
    };
    window[name].__tkWrapped=true; return true;
  }
  function wrapKnown(){ ['TKPDF_export','exportCompatibilityPdf','downloadPdf','generatePdf','TKPDF_forceDark'].forEach(wrapExporter); }

  // --- Debounced, disconnecting MutationObserver (prevents freeze) ---
  let mo=null, timer=0, busy=false;
  function observe(){
    if (mo) mo.disconnect();
    mo=new MutationObserver(()=>{ if (busy) return; clearTimeout(timer); timer=setTimeout(process,120); });
    mo.observe(document.body,{childList:true,subtree:true});
  }
  function process(){
    if (busy) return; busy=true;
    try{ mo && mo.disconnect(); relabelAndBars(); wrapKnown(); }
    finally{ observe(); busy=false; }
  }

  // --- Boot ---
  (async function init(){
    await loadLabels();
    relabelAndBars(); wrapKnown(); observe();
  })();
})();
