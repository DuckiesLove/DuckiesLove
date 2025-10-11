/* /js/kinksurvey.js
   Reliable Start Survey → Category Panel + label map + full-bleed PDF.
*/
// ============ 3) SAFE WIRING (JS) ============ //
// Drop into /js/kinksurvey.js (after your data loader). This avoids the null .addEventListener crash
// and prints the “[TK] Panel skeleton not found” only if the HTML above is missing.
(function(){
  const q = (sel, root=document) => root.querySelector(sel);
  const el = {
    open: q('#btnOpenCats'),
    panel: q('#categorySurveyPanel'),
    list: q('#categoryList'),
    selectAll: q('#btnSelectAll'),
    deselectAll: q('#btnDeselectAll'),
    close: q('#btnCloseCats'),
    start: q('#btnStartSurvey'),
    count: q('#catCount')
  };
  // Guard: if the skeleton is not present, don’t try to wire (prevents “null.addEventListener”)
  if(!el.panel || !el.list || !el.selectAll || !el.deselectAll || !el.close || !el.start){
    console.warn('[TK] Panel skeleton not found; skipping enhanced wiring.');
    return;
  }

  const toArray = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input === 'object') return Object.values(input);
    return [];
  };

  const normalizeCategory = (cat) => {
    if (!cat) return null;
    if (typeof cat === 'string') {
      const text = cat.trim();
      return text ? { id: text, name: text } : null;
    }
    if (typeof cat !== 'object') return null;
    const id = cat.id ?? cat.code ?? cat.key ?? cat.value ?? cat.slug ?? cat.name ?? '';
    const name = cat.name ?? cat.label ?? cat.title ?? id;
    const cleanName = String(name ?? '').trim();
    const cleanId = String(id ?? cleanName ?? '').trim();
    if (!cleanName && !cleanId) return null;
    return {
      id: cleanId || cleanName,
      name: cleanName || cleanId
    };
  };

  function renderCategories(source){
    const normalized = toArray(source)
      .map(normalizeCategory)
      .filter(Boolean)
      .sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));

    const frag = document.createDocumentFragment();
    normalized.forEach(cat=>{
      const pill = document.createElement('label');
      pill.className = 'pill';
      pill.dataset.id = cat.id;
      pill.innerHTML = `
        <input type="checkbox" value="${cat.id}" aria-label="${cat.name}">
        <span class="lbl">${cat.name}</span>
      `;
      frag.appendChild(pill);
    });
    el.list.replaceChildren(frag);
    updateCount();
    return normalized;
  }

  let currentCategories = renderCategories(
    (window.tkLoadKinkData && window.tkLoadKinkData.categories) ||
    window.tkCategories ||
    (window.kinks && (window.kinks.categories || window.kinks))
  );

  // Panel open/close
  const show = () => { el.panel.setAttribute('aria-hidden','false'); el.panel.style.display='block'; };
  const hide = () => { el.panel.setAttribute('aria-hidden','true');  el.panel.style.display='none';  };
  hide(); // start hidden
  el.open?.addEventListener('click', show);
  const legacyOpeners = [q('#startSurveyBtn'), ...document.querySelectorAll('[data-tk-start-survey]')];
  legacyOpeners.forEach(btn => {
    if(btn && btn !== el.open){
      btn.addEventListener('click', evt => { evt?.preventDefault?.(); show(); });
    }
  });
  el.close.addEventListener('click', hide);

  // Select / Deselect all
  el.selectAll.addEventListener('click', ()=>{
    el.list.querySelectorAll('input[type="checkbox"]').forEach(c=>{ c.checked = true; });
    updateCount();
  });
  el.deselectAll.addEventListener('click', ()=>{
    el.list.querySelectorAll('input[type="checkbox"]').forEach(c=>{ c.checked = false; });
    updateCount();
  });

  // Count badge
  el.list.addEventListener('change', e=>{
    if(e.target && e.target.matches('input[type="checkbox"]')) updateCount();
  });
  function updateCount(){
    const total = el.list.querySelectorAll('input[type="checkbox"]').length;
    const sel   = el.list.querySelectorAll('input[type="checkbox"]:checked').length;
    el.count.textContent = `${sel} selected / ${total} total`;
  }

  // Start Survey → hand off selected category ids to your existing flow
  el.start.addEventListener('click', ()=>{
    const selected = Array.from(el.list.querySelectorAll('input[type="checkbox"]:checked')).map(c=>c.value);
    // You likely already have a function to proceed; call it here:
    if(typeof window.tkBeginSurvey === 'function'){
      window.tkBeginSurvey({ categories: selected });
    }
    hide();
  });

  window.tkWireCategoryPanel = (cats) => {
    currentCategories = renderCategories(cats);
  };
  window.tkOpenCategories = show;
  window.tkCloseCategories = hide;
})();

(() => {
  const log = (...args) => console.log('[TK]', ...args);

  const fetchJSON = async (url) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  };

  const Data = { kinks: null, labelOverrides: {}, labelMap: {}, categories: [] };

  function deriveCategoriesFromKinks(kinks) {
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    const set = new Set();
    for (const item of list) {
      if (item?.category) set.add(String(item.category).trim());
      if (Array.isArray(item?.categories)) item.categories.forEach((cat) => cat && set.add(String(cat).trim()));
      if (item?.group) set.add(String(item.group).trim());
    }
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function buildLabelMap(kinks, overrides) {
    const map = { ...(overrides || {}) };
    const list = Array.isArray(kinks) ? kinks : (kinks?.items || []);
    for (const item of list) {
      if (item?.id && item?.name) map[String(item.id)] = String(item.name);
      if (item?.code && item?.name) map[String(item.code)] = String(item.name);
      if (item?.cb && item?.label) map[String(item.cb)] = String(item.label);
    }
    return map;
  }

  async function loadAll() {
    Data.kinks = await fetchJSON('/data/kinks.json');
    try {
      Data.labelOverrides = await fetchJSON('/data/labels-overrides.json');
    } catch {
      Data.labelOverrides = {};
    }

    Data.labelMap = buildLabelMap(Data.kinks, Data.labelOverrides);
    const baseCategories = Array.isArray(window.__TK_CATEGORIES__) && window.__TK_CATEGORIES__.length
      ? window.__TK_CATEGORIES__.slice()
      : deriveCategoriesFromKinks(Data.kinks);

    Data.categories = baseCategories.slice();

    const categoriesArray = baseCategories
      .map((entry) => {
        if (typeof entry === 'string') {
          const text = entry.trim();
          return text ? { code: text, name: text } : null;
        }
        if (!entry || typeof entry !== 'object') return null;
        const code = entry.code ?? entry.id ?? entry.key ?? entry.name ?? '';
        const name = entry.name ?? entry.label ?? entry.title ?? code;
        const cleanCode = String(code || name || '').trim();
        const cleanName = String(name || code || '').trim();
        if (!cleanCode || !cleanName) return null;
        return { code: cleanCode, name: cleanName };
      })
      .filter(Boolean);

    window.__TK__ = Data;
    window.tkCategories = categoriesArray;
    if (typeof window.tkWireCategoryPanel === 'function') {
      window.tkWireCategoryPanel(categoriesArray);
    }

    log(`Loaded ${categoriesArray.length} categories; UI wired.`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAll, { once: true });
  } else {
    loadAll();
  }
})();

/* ================== Compatibility: code → name swap ================== */
(() => {
  async function ensureLabelMap() {
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const f=async u=>(await fetch(u,{cache:"no-store"})).json();
    const k=await f("/data/kinks.json"); const o=await f("/data/labels-overrides.json").catch(()=>({}));
    const map={...o}; (Array.isArray(k)?k:(k?.items||[])).forEach(it=>{ if(it?.id&&it?.name)map[String(it.id)]=String(it.name); if(it?.code&&it?.name)map[String(it.code)]=String(it.name); if(it?.cb&&it?.label)map[String(it.cb)]=String(it.label);}); return map;
  }
  async function swapCodes() {
    const map = await ensureLabelMap();
    document.querySelectorAll("table td:first-child, table th:first-child").forEach(td => {
      const raw = td.textContent.trim();
      if (raw.startsWith("cb_") && map[raw]) td.textContent = map[raw];
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", swapCodes, { once: true });
  else swapCodes();
})();

/* ================== Full-bleed black PDF export ================== */
(() => {
  const loadScript = (src) => new Promise((ok,err)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=err; document.head.appendChild(s); });
  async function ensurePDFLibs() {
    if (!window.jspdf)       await loadScript("/js/vendor/jspdf.umd.min.js");
    if (!window.html2canvas) await loadScript("/js/vendor/html2canvas.min.js");
  }
  async function ensureLabelMap(){
    if (window.__TK__?.labelMap) return window.__TK__.labelMap;
    const f=async u=>(await fetch(u,{cache:"no-store"})).json();
    const k=await f("/data/kinks.json"); const o=await f("/data/labels-overrides.json").catch(()=>({}));
    const map={...o}; (Array.isArray(k)?k:(k?.items||[])).forEach(it=>{ if(it?.id&&it?.name)map[String(it.id)]=String(it.name); if(it?.code&&it?.name)map[String(it.code)]=String(it.name); if(it?.cb&&it?.label)map[String(it.cb)]=String(it.label);}); return map;
  }
  async function makeFullBleedPDF(){
    await ensurePDFLibs(); const map=await ensureLabelMap();
    const table=document.querySelector("table"); if(!table) return alert("No table to export.");
    const clone=table.cloneNode(true);
    clone.querySelectorAll("td:first-child, th:first-child").forEach(td=>{ const raw=td.textContent.trim(); if(raw.startsWith("cb_") && map[raw]) td.textContent=map[raw]; });
    const wrap=document.createElement("div"); wrap.style.background="#000"; wrap.style.padding="0"; wrap.style.margin="0"; wrap.appendChild(clone); document.body.appendChild(wrap);
    const canvas=await html2canvas(wrap,{backgroundColor:"#000",scale:2}); document.body.removeChild(wrap);
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    const w=pdf.internal.pageSize.getWidth(), h=pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,w,h,undefined,"FAST");
    pdf.save("compatibility.pdf");
  }
  const btn=document.getElementById("dl") || document.querySelector("[data-tk='download']");
  btn?.addEventListener("click",(e)=>{ e.preventDefault(); makeFullBleedPDF(); });
  window.tkMakeCompatibilityPDF = makeFullBleedPDF;
})();
