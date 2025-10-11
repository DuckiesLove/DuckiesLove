// =============================
// 0) SAFETY SHIMS (load FIRST!)
// =============================
(function(){
  const MUST_HAVE = [
    '#btnCloseCats',
    '#btnSelectAll',
    '#btnDeselectAll',
    '#btnStartSurvey'
  ];

  function ensure(sel){
    if(!sel || sel[0] !== '#') return;
    if(document.querySelector(sel)) return;
    const id = sel.slice(1);
    const tag = (/btn|button|start|close/i.test(id) ? 'button' : 'div');
    const el  = document.createElement(tag);
    el.id = id;
    if(tag === 'button') el.type = 'button';
    el.style.display = 'none';
    document.body.appendChild(el);
    console.warn('[TK] created fallback element for missing selector', sel);
  }

  function ensureAll(){ MUST_HAVE.forEach(ensure); }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ensureAll, { once: true });
  } else {
    ensureAll();
  }

  window.tkSafe = {
    add(el, type, handler, opts){
      if(!el){
        console.warn('[TK] safeAdd: missing node for', type);
        return () => {};
      }
      el.addEventListener(type, handler, opts);
      return () => el.removeEventListener(type, handler, opts);
    },
    bySel(sel){
      return document.querySelector(sel);
    }
  };
})();

/* /js/kinksurvey.js
   Reliable Start Survey → Category Panel + label map + full-bleed PDF.
*/
// ============ 3) SAFE WIRING (JS) ============ //
(function(){
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const openButton =
    $('#btnOpenCats') ||
    $('#startSurveyBtn') ||
    document.querySelector('[data-legacy-id="btnStartSurvey"]') ||
    document.querySelector('[data-tk-start-survey]');

  const el = {
    open:        openButton,
    panel:       $('#categorySurveyPanel'),
    list:        $('#categoryList'),
    selectAll:   $('#btnSelectAll'),
    deselectAll: $('#btnDeselectAll'),
    close:       $('#btnCloseCats'),
    start:       $('#btnStartSurvey'),
    count:       $('#catCount')
  };

  if(!el.panel || !el.list){
    console.warn('[TK] Panel skeleton missing; skip enhanced wiring.');
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
      .sort((a,b)=>a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const frag = document.createDocumentFragment();
    normalized.forEach(cat => {
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
    (window.kinks && (window.kinks.categories || window.kinks)) ||
    []
  );

  const show = () => {
    el.panel.setAttribute('aria-hidden', 'false');
    el.panel.style.display = 'block';
  };
  const hide = () => {
    el.panel.setAttribute('aria-hidden', 'true');
    el.panel.style.display = 'none';
  };

  hide();

  tkSafe.add(el.open, 'click', show);
  const legacyOpeners = new Set([
    $('#startSurveyBtn'),
    document.querySelector('[data-legacy-id="btnStartSurvey"]'),
    ...document.querySelectorAll('[data-tk-start-survey]')
  ].filter(Boolean));
  legacyOpeners.forEach(btn => {
    if (btn !== el.open) {
      tkSafe.add(btn, 'click', evt => {
        evt?.preventDefault?.();
        show();
      });
    }
  });
  tkSafe.add(el.close, 'click', hide);

  function updateCount(){
    const total = $$('input[type="checkbox"]', el.list).length;
    const sel   = $$('input[type="checkbox"]:checked', el.list).length;
    if(el.count) el.count.textContent = `${sel} selected / ${total} total`;
  }

  tkSafe.add(el.selectAll, 'click', () => {
    $$('input[type="checkbox"]', el.list).forEach(c => { c.checked = true; });
    updateCount();
  });
  tkSafe.add(el.deselectAll, 'click', () => {
    $$('input[type="checkbox"]', el.list).forEach(c => { c.checked = false; });
    updateCount();
  });

  tkSafe.add(el.list, 'change', (e) => {
    if(e.target && e.target.matches('input[type="checkbox"]')) updateCount();
  });
  updateCount();

  tkSafe.add(el.start, 'click', () => {
    const selected = $$('input[type="checkbox"]:checked', el.list).map(c => c.value);
    if(typeof window.tkBeginSurvey === 'function'){
      window.tkBeginSurvey({ categories: selected });
    } else {
      console.info('[TK] selected categories', selected);
    }
    hide();
  });

  window.tkWireCategoryPanel = (cats) => {
    currentCategories = renderCategories(cats);
    return currentCategories;
  };
  window.tkOpenCategories = show;
  window.tkCloseCategories = hide;
  window.tkGetSelectedCategories = () =>
    $$('input[type="checkbox"]:checked', el.list).map(c => c.value);
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
/* ========= TK SURVEY UX PATCH (safe, console/inline-ready) =========
   What this does:
   1) Finds visible "Start Survey" buttons/links and makes them open the
      category panel.
   2) Ensures the panel/overlay sit above any site scrim (z-index fix).
   3) Exposes tkOpenPanel()/tkClosePanel() for programmatic control.
   4) Adds a tiny Theme switcher ("Theme" label on the page) that toggles
      between 'theme-dark' and 'theme-light' and remembers the choice.

   How to install:
   - Put this entire block at the very end of kinksurvey.js (or load it
     in a separate file AFTER kinksurvey.js).
   - No markup changes required. It uses your existing panel.

   Rollback:
   - Remove this block or wrap in a feature flag.
==================================================================== */

(function TK_SURVEY_PATCH(){
  const WIN = window;
  const DOC = document;

  // ---------- Configurable selectors ----------
  const SEL = {
    startButtons: 'a,button,[role="button"]',
    panel:        '#categorySurveyPanel',  // Your drawer panel element
    overlay:      '#tkOverlay',            // Your dark backdrop if present
    portalRoot:   '#tkPortalRoot',         // Root container if present
    themeAnchor:  '#themeSelector, .theme-selector, [data-tk-theme]', // optional
  };

  // ---------- z-index hard-fix (keeps your panel above any scrim) ----------
  (function injectZFix(){
    if (DOC.getElementById('tkZFix')) return;
    const style = DOC.createElement('style');
    style.id = 'tkZFix';
    style.textContent = `
      /* Keep our layer on top of any site overlay */
      #tkPortalRoot{position:fixed; inset:0; z-index:2147483646; pointer-events:none}
      #tkOverlay{z-index:2147483645}
      #categorySurveyPanel{z-index:2147483646}
      html.tk-panel-open{overflow:hidden}
      html.tk-panel-open #categorySurveyPanel{display:flex; visibility:visible; opacity:1; pointer-events:auto}
    `;
    DOC.documentElement.appendChild(style);
  })();

  // ---------- Utilities ----------
  function bySel(s){ return DOC.querySelector(s); }
  function bySelAll(s){ return Array.from(DOC.querySelectorAll(s)); }
  function isVisible(el){
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return !!(r.width || r.height) && getComputedStyle(el).visibility !== 'hidden';
  }
  function textEquals(el, re){
    const t = (el.textContent || '').trim();
    return re.test(t);
  }

  // ---------- Panel control ----------
  function getPanel(){ return bySel(SEL.panel); }
  function getOverlay(){ return bySel(SEL.overlay); }

  function tkOpenPanel(){
    const panel = getPanel();
    if (!panel){ console.warn('[TK] No panel found at', SEL.panel); return; }
    // Ensure panel is attached to top portal so it’s not clipped
    let root = bySel(SEL.portalRoot);
    if (!root){
      root = DOC.createElement('div');
      root.id = 'tkPortalRoot';
      DOC.body.appendChild(root);
    }
    if (!root.contains(panel)) root.appendChild(panel);

    // Make sure panel is interactable (your CSS does the rest)
    panel.style.display     = 'flex';
    panel.style.visibility  = 'visible';
    panel.style.opacity     = '1';
    panel.style.pointerEvents = 'auto';

    const ov = getOverlay();
    if (ov){
      ov.style.display = 'block';
      ov.style.visibility = 'visible';
      ov.style.opacity = '1';
    }

    DOC.documentElement.classList.add('tk-panel-open');
  }

  function tkClosePanel(){
    const panel = getPanel();
    if (panel){
      panel.style.pointerEvents = 'none';
      panel.style.opacity = '0';
      panel.style.visibility = 'hidden';
      panel.style.display = 'none';
    }
    const ov = getOverlay();
    if (ov){
      ov.style.opacity = '0';
      ov.style.visibility = 'hidden';
      ov.style.display = 'none';
    }
    DOC.documentElement.classList.remove('tk-panel-open');
  }

  // Expose for console/other code
  WIN.tkOpenPanel  = tkOpenPanel;
  WIN.tkClosePanel = tkClosePanel;

  // ---------- Wire “Start Survey” buttons ----------
  function wireStarts(){
    const RE = /^\s*start\s*survey\s*$/i;
    let count = 0;
    bySelAll(SEL.startButtons).forEach(el=>{
      if (!isVisible(el)) return;
      if (!textEquals(el, RE)) return;
      if (el.dataset.tkWired === '1') return;
      el.dataset.tkWired = '1';
      el.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); }catch(_){}
        tkOpenPanel();
      }, {passive:false});
      count++;
    });
    if (count) console.log(`[TK] wired ${count} Start Survey trigger(s).`);
  }

  // ---------- Keyboard ESC to close, "S" to open ----------
  function wireKeys(){
    if (DOC.documentElement.dataset.tkKeys === '1') return;
    DOC.documentElement.dataset.tkKeys = '1';
    DOC.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') tkClosePanel();
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) tkOpenPanel();
    });
  }

  // ---------- Theme toggle (simple, persistent) ----------
  function applyTheme(theme){
    const html = DOC.documentElement;
    html.classList.remove('theme-light', 'theme-dark');
    html.classList.add(theme);
    try{ localStorage.setItem('tkTheme', theme); }catch(_){}
  }
  function readTheme(){
    try { return localStorage.getItem('tkTheme') || 'theme-dark'; }
    catch(_){ return 'theme-dark'; }
  }
  function ensureThemeUI(){
    // If you have a specific placeholder element, we’ll use it; otherwise add one under the main buttons.
    let host = bySel(SEL.themeAnchor);
    if (!host){
      host = bySel('#theme') || bySel('h1, .title, .page-title');
      if (host && host.nextElementSibling && host.nextElementSibling.matches('.tk-theme-row')) {
        // already installed
      } else {
        const row = DOC.createElement('div');
        row.className = 'tk-theme-row';
        row.style.cssText = 'margin:16px 0; display:flex; gap:12px; align-items:center; justify-content:center; font-size:18px;';
        row.innerHTML = `
          <span style="opacity:.75">Theme</span>
          <button type="button" class="themed-button" id="tkThemeDark">Dark</button>
          <button type="button" class="themed-button" id="tkThemeLight">Light</button>
        `;
        (host && host.parentNode ? host.parentNode : DOC.body).appendChild(row);
      }
    }
    const t = readTheme();
    applyTheme(t);
    const btnDark = bySel('#tkThemeDark');
    const btnLight = bySel('#tkThemeLight');
    if (btnDark && !btnDark.dataset.w){
      btnDark.dataset.w='1';
      btnDark.addEventListener('click', ()=>applyTheme('theme-dark'));
    }
    if (btnLight && !btnLight.dataset.w){
      btnLight.dataset.w='1';
      btnLight.addEventListener('click', ()=>applyTheme('theme-light'));
    }
  }

  // ---------- Rewire on DOM changes (resilient to page updates) ----------
  function rewire(){
    wireStarts();
    wireKeys();
    ensureThemeUI();
  }
  WIN.addEventListener('tk-rewire', rewire);

  // Initial wiring (after current microtask to let your core UI finish)
  setTimeout(rewire, 0);

  console.log('[TK] UX patch installed. You can call tkOpenPanel() / tkClosePanel().');
})();
