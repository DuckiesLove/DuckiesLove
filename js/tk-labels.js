(() => {
  const DICT_URLS = ["/data/kinks.json", "/kinksurvey/data/kinks.json", "/kinks.json"];
  const LABELS = Object.create(null);
  const UNKNOWN = new Set();

  function log(...a){ try{ console.log("[labels]", ...a);}catch{} }
  function warn(...a){ try{ console.warn("[labels]", ...a);}catch{} }

  async function fetchFirst(urls){
    for(const url of urls){
      try{
        const r = await fetch(url, {cache:"no-store"});
        if(!r.ok) throw new Error(r.status+" "+r.statusText);
        const json = await r.json();
        if(json && typeof json==="object" && json.labels){
          Object.assign(LABELS, json.labels);
          log("loaded", Object.keys(json.labels).length, "labels from", url);
          return true;
        }
      }catch(e){ /* try next */ }
    }
    warn("no label dictionary found at", urls.join(", "));
    return false;
  }

  function getCompatTables(){
    // find tables whose header includes “Category” and “Partner A”
    const tables = Array.from(document.querySelectorAll("table"));
    return tables.filter(t=>{
      const th = Array.from(t.querySelectorAll("thead th,th"));
      const h  = th.map(x=>x.textContent.trim().toLowerCase());
      return h.includes("category") && h.some(x=>x.includes("partner a"));
    });
  }

  function relabelCell(td){
    if(!td || td.dataset.tkLabeled === "1") return;
    const raw = (td.textContent||"").trim();
    if(!raw) return;

    const pretty = LABELS[raw];
    if(pretty){
      td.textContent = pretty;              // replace text only (no layout change)
      td.setAttribute("title", raw);        // keep original id as tooltip
      td.dataset.tkLabeled = "1";
    }else if(/^cb_[a-z0-9]{4,}$/i.test(raw)){
      // looks like a code but we don't have a label yet
      if(!UNKNOWN.has(raw)){ UNKNOWN.add(raw); warn("missing label for", raw); }
      td.dataset.tkLabeled = "0";
    }else{
      td.dataset.tkLabeled = "1";           // already human
    }
  }

  function relabelAll(){
    for(const table of getCompatTables()){
      const rows = table.tBodies.length ? table.tBodies[0].rows : table.rows;
      for(const tr of rows){
        const td = tr.cells && tr.cells[0];
        relabelCell(td);
      }
    }
  }

  function watchMutations(){
    const mo = new MutationObserver((muts)=>{
      let changed = false;
      for(const m of muts){
        if(m.addedNodes && m.addedNodes.length) changed = true;
        if(m.type==="attributes") changed = true;
        if(changed) break;
      }
      if(changed) relabelAll();
    });
    mo.observe(document.body, {subtree:true, childList:true, attributes:true});
  }

  // If survey JSON uploads include a {labels:{...}} block, merge that too.
  function tapFileInputs(){
    document.addEventListener("change", async (e)=>{
      const el = e.target;
      if(!(el instanceof HTMLInputElement)) return;
      if(el.type !== "file") return;
      for(const file of el.files||[]){
        if(!/\.json$/i.test(file.name)) continue;
        try{
          const text = await file.text();
          const data = JSON.parse(text);
          if(data && typeof data==="object" && data.labels){
            Object.assign(LABELS, data.labels);
            log("merged", Object.keys(data.labels).length, "labels from upload", file.name);
            relabelAll();
          }
        }catch{}
      }
    }, true);
  }

  // Boot
  document.addEventListener("DOMContentLoaded", async ()=>{
    await fetchFirst(DICT_URLS);
    relabelAll();
    watchMutations();
    tapFileInputs();

    // Helpful report (open DevTools console after uploading both surveys):
    setTimeout(()=>{
      if(UNKNOWN.size){
        warn("Add these to /data/kinks.json → \"labels\": { ... }", Array.from(UNKNOWN).sort());
      }
    }, 1200);
  });
})();
