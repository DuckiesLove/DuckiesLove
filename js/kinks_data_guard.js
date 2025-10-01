/*! TK data guard: robustify /kinks/ UI */
(function(){
  const d=document,$=(s,r=d)=>r.querySelector(s),$$=(s,r=d)=>Array.from(r.querySelectorAll(s));
  const norm=s=>String(s||"").trim().replace(/\s+/g," ").toLowerCase();

  async function getData(){
    // try live JSON; if HTML/invalid/404, fall back to embedded or fallback file
    const tryUrls=[
      "/data/kinks.json?v="+Date.now(),
      "/kinks.json?v="+Date.now()
    ];
    for (const u of tryUrls){
      try{
        const r=await fetch(u,{cache:"no-store"}); const ct=r.headers.get("content-type")||"";
        const t=await r.text();
        if (!r.ok) continue;
        if (/^<!doctype html/i.test(t)||/<html[\s>]/i.test(t)||/text\/html/i.test(ct)) continue;
        try{
          const j=JSON.parse(t);
          if (Array.isArray(j)) return j;
          if (j && Array.isArray(j.categories)) return j.categories;
          if (j && Array.isArray(j.kinks)) return j.kinks;
          return [];
        }catch{}
      }catch{}
    }
    // embedded <script type="application/json" id="kinks-embedded-data">
    try{
      const emb=$("#kinks-embedded-data");
      if (emb) {
        const j=JSON.parse(emb.textContent||"[]");
        if (Array.isArray(j)) return j;
        if (j && Array.isArray(j.categories)) return j.categories;
        if (j && Array.isArray(j.kinks)) return j.kinks;
      }
    }catch{}
    // final local fallback (very small) so UI is usable
    try{
      const r=await fetch("/data/kinks.fallback.json?v="+Date.now(),{cache:"no-store"});
      if (r.ok) return await r.json();
    }catch{}
    return [];
  }

  function paintNotice(avail, missing, total, message){
    if ($("#tk-guard-note")) return;
    const st=d.createElement("style");
    st.textContent=`
      .tk-missing{opacity:.45;filter:grayscale(.3)}
      .tk-missing input{pointer-events:none!important}
      #tk-guard-note{background:#111;color:#e6f2ff;border:1px solid #333;padding:.6rem .8rem;border-radius:.6rem;margin:.75rem 0;font:12px system-ui}
      #tk-guard-note b{color:#00e6ff}
    `;
    d.head.appendChild(st);
    const host=$(".category-panel")||d.body;
    const note=d.createElement("div");note.id="tk-guard-note";
    if (message){
      note.textContent=message;
    } else {
      const a=avail.map(x=>x.label).join(", ")||"none";
      const m=missing.map(x=>x.label).join(", ")||"none";
      note.innerHTML=`Data categories available: <b>${avail.length}</b> / UI categories: <b>${avail.length+missing.length}</b>. `+
                     `Active: <b>${a}</b>. Disabled for now: ${m}.`;
    }
    host.prepend(note);
  }

  function wireStart(){
    const start=$("#start,#startSurvey,#startSurveyBtn"); if(!start) return;
    const upd=()=>{ const any=$$(".category-panel input[type='checkbox']").some(cb=>!cb.disabled&&cb.checked); start.disabled=!any; };
    $$(".category-panel input[type='checkbox']").forEach(cb=>cb.addEventListener("change",upd));
    upd();
  }

  async function run(){
    // Give normal boot a head start; bail if selects have appeared
    let waited=0; const id=setInterval(()=>{ waited+=150; if ($$("select").length>0){clearInterval(id)} },150);
    setTimeout(()=>clearInterval(id), 1800);

    const data=await getData();
    const cats=new Set();
    (Array.isArray(data)?data:[]).forEach(k=>{
      const key=norm(k?.category||k?.cat);
      if (key) cats.add(key);
    });
    const ui=[];
    const panel=$(".category-panel")||d;
    panel.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      const container=cb.closest("label,li,div")||cb.parentElement;
      const label=(container?.textContent||"").replace(/\s+/g," ").trim();
      const key=norm(label);
      if (key) ui.push({cb,label,key,row:container});
    });

    if (!cats.size){
      paintNotice([], [], 0, "Unable to load survey categories. All options remain selectable so you can start manually.");
      wireStart();
      console.warn("[TK-GUARD] No category data fetched; leaving checkboxes enabled.");
      return;
    }

    // Dim / disable categories not present in data
    const avail=ui.filter(x=>cats.has(x.key)), missing=ui.filter(x=>!cats.has(x.key));
    if (!avail.length){
      paintNotice([], [], data.length||0, "Survey data did not match any listed categories. Everything stays enabled.");
      wireStart();
      console.warn("[TK-GUARD] Category data available but no matches found; skipping disable logic.");
      return;
    }
    missing.forEach(x=>{ x.cb.checked=false; x.cb.disabled=true; x.row?.classList?.add("tk-missing"); });
    // Auto-select first available if none selected
    if (!avail.some(x=>x.cb.checked) && avail.length){ avail[0].cb.checked=true; avail[0].cb.dispatchEvent(new Event("change",{bubbles:true})); }
    paintNotice(avail, missing, data.length);
    wireStart();
    console.log(`[TK-GUARD] data items=${data.length} availCats=${avail.length} missingCats=${missing.length}`);
  }

  if (document.readyState==="complete"||document.readyState==="interactive") run();
  else document.addEventListener("DOMContentLoaded", run, {once:true});
})();
