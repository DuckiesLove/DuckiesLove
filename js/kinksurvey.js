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

/* ======================= TK DOCKED PANEL V3 =======================
 * Purpose: reshape the classic landing (Start/Compatibility/IKA buttons)
 *          into a left/right dock where the category panel stays visible.
 * Notes:   - Installs once (window.__tkDockV3 guard)
 *          - Moves the existing buttons into a right rail
 *          - Pulls the real category panel into the left column and
 *            strips drawer/overlay styles so it behaves inline
 *          - Falls back to MutationObserver until the panel exists
 * ================================================================= */
(function TK_DOCK_V3(){
  if (window.__tkDockV3) return;
  window.__tkDockV3 = true;

  const DOC = document;
  const $  = (sel, root = DOC) => root.querySelector(sel);
  const $$ = (sel, root = DOC) => Array.from(root.querySelectorAll(sel));
  const hasText = (el, rx) => !!el && rx.test((el.textContent || '').trim());

  const CSS = `
#tkDock{display:flex;gap:2rem;align-items:flex-start;margin:24px auto;max-width:1200px;padding:0 24px}
#tkDock .tk-left{flex:1 1 auto;min-width:640px}
#tkDock .tk-right{flex:0 0 25%;max-width:25%;display:flex;flex-direction:column;gap:20px}
#tkDock .tk-right > *{width:100%}
@media (max-width:1100px){#tkDock{flex-direction:column;padding:0 16px}#tkDock .tk-right{max-width:none;flex:0 0 auto}}
.tk-docked-panel{position:relative!important;inset:auto!important;transform:none!important;opacity:1!important;visibility:visible!important;display:flex!important;flex-direction:column;max-height:80vh;overflow:auto;z-index:10010!important}
#tkOverlay,.tk-overlay{display:none!important;pointer-events:none!important}
`;

  function injectCSS(){
    if (DOC.getElementById('tkDockStylesV3')) return;
    const style = DOC.createElement('style');
    style.id = 'tkDockStylesV3';
    style.textContent = CSS;
    DOC.head.appendChild(style);
  }

  function buildDock(){
    let dock = DOC.getElementById('tkDock');
    if (dock) return dock;

    dock = DOC.createElement('div');
    dock.id = 'tkDock';
    const left = DOC.createElement('div');
    left.className = 'tk-left';
    const right = DOC.createElement('div');
    right.className = 'tk-right';
    dock.append(left, right);

    const title = $$('h1,h2,.title,.hero', DOC.body).find(h => hasText(h, /talk\s*kink\s*survey/i));
    const anchor = title?.parentNode || DOC.body;
    anchor.insertBefore(dock, title ? title.nextSibling : anchor.firstChild);

    return dock;
  }

  function collectLandingButtons(){
    const pool = $$('a,button,[role="button"]', DOC.body)
      .filter(btn => !btn.closest('#categorySurveyPanel, .category-panel, #tkDock'));
    const grab = rx => pool.find(btn => hasText(btn, rx));
    return {
      start: grab(/^start\s*survey$/i),
      compatibility: grab(/compatibility\s*page/i),
      analysis: grab(/individual\s*kink\s*analysis/i)
    };
  }

  function moveUtilityButtons(buttons){
    const right = $('#tkDock .tk-right');
    if (!right) return;
    if (buttons.compatibility && buttons.compatibility.parentNode !== right) right.appendChild(buttons.compatibility);
    if (buttons.analysis && buttons.analysis.parentNode !== right) right.appendChild(buttons.analysis);
  }

  function hideLegacyLanding(buttons){
    const wrappers = new Set([buttons.start, buttons.compatibility, buttons.analysis]
      .filter(Boolean)
      .map(btn => btn.closest('section, main, .landing-wrapper, .stack, .hero, .container, .row, .col, div'))
      .filter(Boolean)
      .filter(wrapper => !wrapper.closest('#tkDock')));
    wrappers.forEach(wrapper => wrapper.setAttribute('data-tk-landing', 'removed'));
    if (buttons.start) buttons.start.style.display = 'none';
  }

  function tidyLanding(){
    const buttons = collectLandingButtons();
    moveUtilityButtons(buttons);
    hideLegacyLanding(buttons);
  }

  function pickPanel(){
    return $('#categorySurveyPanel') ||
      $('.category-panel') ||
      $$('aside,section,div').find(n => {
        const klass = n?.className || '';
        return /category/.test(klass) && /panel/.test(klass) && n.querySelector('input[type="checkbox"]');
      }) || null;
  }

  function resetPanelStyles(panel){
    if (!panel) return;
    ['position','inset','left','right','top','bottom','transform','opacity','visibility','display'].forEach(prop => {
      if (panel.style && panel.style[prop] !== undefined) panel.style[prop] = '';
    });
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
    panel.removeAttribute('inert');
    panel.classList.remove('hidden','is-hidden','closed','tk-hidden','tk-closed');
  }

  function killOverlays(){
    ['#tkOverlay', '.tk-overlay'].forEach(sel => {
      $$(sel).forEach(el => {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      });
    });
  }

  function dockPanel(panel){
    const left = $('#tkDock .tk-left');
    if (!panel || !left) return;
    if (panel.parentNode !== left) left.appendChild(panel);
    resetPanelStyles(panel);
    panel.classList.add('tk-docked-panel');
  }

  function ensurePanel(){
    const panel = pickPanel();
    if (!panel) return false;
    dockPanel(panel);
    killOverlays();
    DOC.documentElement.classList.remove('tk-panel-open');
    DOC.body?.classList?.remove('tk-panel-open');
    DOC.documentElement.style.overflow = '';
    if (DOC.body) DOC.body.style.overflow = '';
    return true;
  }

  function openPanelIfAvailable(){
    try {
      if (typeof window.tkOpenPanel === 'function') {
        window.tkOpenPanel();
        return;
      }
    } catch (err) {
      console.warn('[TK] tkOpenPanel failed during dock init:', err);
    }
    const trigger = $$('a,button,[role="button"]').find(el => hasText(el, /^start\s*survey$/i));
    if (trigger) {
      try { trigger.click(); } catch (_) {}
    }
  }

  function boot(){
    injectCSS();
    buildDock();
    tidyLanding();
    openPanelIfAvailable();

    if (ensurePanel()) return;

    const mo = new MutationObserver(() => {
      if (ensurePanel()) mo.disconnect();
    });
    mo.observe(DOC.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 30000);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

/* ======================= TK SURVEY FORCE-OPEN PATCH =======================
 * Purpose: make the “Start Survey” button open your categories drawer/panel,
 * even if IDs/classes changed. Includes a probe you can run: tkProbe().
 * Install: paste at the very bottom of kinksurvey.js (no <script> tags).
 * Remove: delete this block.
 * ======================================================================== */

(function TK_FORCE_OPEN(){
  const DOC = document, WIN = window;

  // ---- Candidates we’ll try for panel / overlay / start buttons ----
  const CAND = {
    panel: [
      '#categorySurveyPanel', '#tkCategoryDrawer', '#tkDrawer', '#drawer',
      '.category-panel', '.tkDrawerContent', '.tk-drawer-content', '.tk-drawer',
      '[role="region"][aria-label*="category"]', '[data-ksv-panel]'
    ],
    overlay: [
      '#tkOverlay', '#tkScrim', '.tk-scrim', '.drawer-backdrop', '[data-tk-scrim]'
    ],
    start: [
      '#startSurveyBtn', '#startSurvey', '#start-survey-btn', '.start-survey-btn',
      '[data-action="start-survey"]', '#tkStartNow', 'a[href="#start"]', 'button'
    ]
  };

  // ---- Helpers ----
  const q1 = sel => DOC.querySelector(sel);
  const qA = sel => Array.from(DOC.querySelectorAll(sel));
  const vis = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const byText = (els, re) => els.find(el => re.test((el.textContent||'').trim()));

  function firstMatch(list){
    for (const sel of list){
      const el = q1(sel);
      if (vis(el)) return el;
      if (el) return el; // allow hidden; we’ll unhide
    }
    return null;
  }

  // Find the panel by several strategies
  function findPanel(){
    // 1) Best guess from candidates
    let p = firstMatch(CAND.panel);
    if (p) return p;
    // 2) Fallback: anything that looks like a drawer with category text inside
    const regions = qA('[role="region"],aside,section,div')
      .filter(n => (n.className||'').match(/(drawer|category|panel)/i));
    for (const n of regions){
      if ((n.textContent||'').match(/Select\s+categories/i)) return n;
    }
    return null;
  }

  function findOverlay(){
    return firstMatch(CAND.overlay);
  }

  function findStartButtons(){
    // candidate selectors
    const hits = CAND.start.flatMap(sel => qA(sel));
    const uniq = Array.from(new Set(hits));
    // include any visible element whose text is "Start Survey"
    const textHit = byText(qA('a,button,[role="button"]'), /^\s*start\s*survey\s*$/i);
    if (textHit && !uniq.includes(textHit)) uniq.unshift(textHit);
    return uniq.filter(Boolean);
  }

  // ---- Open / Close logic (forces visibility) ----
  function tkOpenPanel(){
    const panel = findPanel();
    if (!panel){ console.warn('[TK] No panel found.'); return; }

    // Ensure it’s attached and visible
    panel.style.display = 'flex';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    panel.removeAttribute('aria-hidden');
    panel.setAttribute('aria-expanded', 'true');

    // Bring to the very top
    panel.style.position = panel.style.position || 'fixed';
    panel.style.zIndex = '2147483646';
    const overlay = findOverlay();
    if (overlay){
      overlay.style.display = 'block';
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '1';
      overlay.style.zIndex = '2147483645';
      overlay.style.pointerEvents = 'auto';
    }
    DOC.documentElement.classList.add('tk-panel-open');
    console.log('[TK] Panel opened.');
  }

  function tkClosePanel(){
    const panel = findPanel();
    if (panel){
      panel.style.pointerEvents = 'none';
      panel.style.opacity = '0';
      panel.style.visibility = 'hidden';
      panel.style.display = 'none';
      panel.setAttribute('aria-hidden','true');
      panel.setAttribute('aria-expanded','false');
    }
    const overlay = findOverlay();
    if (overlay){
      overlay.style.opacity = '0';
      overlay.style.visibility = 'hidden';
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
    }
    DOC.documentElement.classList.remove('tk-panel-open');
    console.log('[TK] Panel closed.');
  }

  // Expose for console/manual checks
  WIN.tkOpenPanel  = tkOpenPanel;
  WIN.tkClosePanel = tkClosePanel;

  // ---- Wire all “Start Survey” buttons to open the panel ----
  function wireStarts(){
    const starts = findStartButtons();
    let wired = 0;
    starts.forEach(btn=>{
      if (btn.dataset.tkWired === '1') return;
      // Only wire the ones that look like Start Survey or are your known buttons
      const label = (btn.textContent||'').trim();
      const isStart = /^\s*start\s*survey\s*$/i.test(label) ||
                      CAND.start.some(sel => btn.matches(sel));
      if (!isStart) return;
      btn.dataset.tkWired = '1';
      btn.addEventListener('click', e=>{
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        tkOpenPanel();
      }, {passive:false});
      wired++;
    });
    if (wired) console.log(`[TK] wired ${wired} Start Survey trigger(s).`);
  }

  // ---- Auto rewire if DOM changes (SPA safe) ----
  const mo = new MutationObserver(()=>{
    wireStarts();
  });
  mo.observe(DOC.documentElement, {childList:true, subtree:true});

  // ---- One-time CSS to avoid getting masked by site overlays ----
  (function ensureTopCSS(){
    if (DOC.getElementById('tkForceTop')) return;
    const s = DOC.createElement('style');
    s.id = 'tkForceTop';
    s.textContent = `
      html.tk-panel-open{overflow:hidden}
      .tk-scrim, #tkScrim, #tkOverlay{transition:none!important}
    `;
    DOC.head.appendChild(s);
  })();

  // ---- Initial wire after the page finishes its own setup ----
  setTimeout(wireStarts, 0);

  // ---- Probe helper so you can see what was found ----
  WIN.tkProbe = function(){
    const panel = findPanel();
    const overlay = findOverlay();
    const starts = findStartButtons();
    console.table([
      { key:'panel',   selector: panel ? (panel.id ? '#'+panel.id : panel.className) : '(none)', present: !!panel, visible: panel ? (panel.offsetParent!==null || panel.style.display!=='none') : false },
      { key:'overlay', selector: overlay ? (overlay.id ? '#'+overlay.id : overlay.className) : '(none)', present: !!overlay, visible: overlay ? (overlay.offsetParent!==null || overlay.style.display!=='none') : false },
      { key:'starts',  selector: starts.map(b=>b.id?('#'+b.id):b.className||b.tagName).join(', ') || '(none)', present: !!starts.length, visible: starts.some(vis) }
    ]);
    return {panel, overlay, starts};
  };

  console.log('[TK] Force-open patch loaded. Try tkProbe(), tkOpenPanel().');
})();
